/* ===================== refsanim.js — VÍDEOS DE REFERÊNCIA para a IA criar animações =====================
   A IA (Claude) não assiste vídeo: cada vídeo vira uma FOLHA de quadros (várias cenas lado a lado) que vai junto no pedido.
   - Base da equipe: referencias/animacao/indice.json (ex.: o test drive da Lumi em 3 vistas) — vai em todo pedido de animação.
   - De cada projeto: personagem do Ateliê (def.refsAnim, imagem em personagens/<id>/img/ref….jpg, vai para a nuvem junto)
     e animação do editor (P.refsAnim, vai no .animador). Links do YouTube (separados por vírgula, espaço ou Enter) ou vídeos do computador.
   Não é treinar o modelo: são exemplos mandados a cada pedido. */
'use strict';
const RefsAnim = {
  _base: null,
  ytId(s) { const m = String(s).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([\w-]{11})/i); return m ? m[1] : null; },
  async b64(blob) { return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(blob); }); },
  bloco(durl) { const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(durl || ''); return m ? { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } } : null; },
  async base() {
    if (!this._base) this._base = (async () => {
      try { const L = await (await fetch('referencias/animacao/indice.json', { cache: 'no-cache' })).json();
        return (await Promise.all(L.map(async r => { try { const b = await (await fetch('referencias/animacao/' + r.arquivo)).blob(); return { ...r, img: await this.b64(new Blob([b], { type: /\.png$/i.test(r.arquivo) ? 'image/png' : 'image/jpeg' })) }; } catch { return null; } }))).filter(Boolean);
      } catch { return []; }
    })();
    return this._base;
  },
  // o que vai junto no pedido para a IA: as referências da equipe + as do projeto
  async conteudo(lista = [], o = {}) {
    const out = [], base = o.base === false ? [] : await this.base(), meus = (lista || []).slice(0, 6);
    if (!base.length && !meus.length) return out;
    const editor = o.modo === 'editor';
    out.push({ type: 'text', text: editor
      ? 'VÍDEOS DE REFERÊNCIA DE ANIMAÇÃO E EDIÇÃO (cada imagem é uma folha de quadros do vídeo, lida da esquerda para a direita e de cima para baixo; o tempo aparece no canto de cada quadro). COPIE O ESTILO deles nesta animação: o jeito de animar (timing, poses-chave, segurar a pose, antecipação, troca de expressão na palavra forte, sobe-e-desce do andar, troca de vista) E o jeito de EDITAR (quando a câmera aproxima/afasta ou corta, enquadramento, zoom na fala/na piada, tremor/flash nos impactos, ritmo das trocas de cena, legendas). Não copie o desenho nem a história: use as camadas e personagens deste projeto.'
      : 'VÍDEOS DE REFERÊNCIA DE ANIMAÇÃO (cada imagem é uma folha de quadros do vídeo, lida da esquerda para a direita e de cima para baixo). Use só como GUIA para as animações de teste deste personagem: o TIMING, as poses-chave e o jeito de mexer (sobe-e-desce do andar, antecipação, segurar a pose, trocas de expressão). Não copie o desenho: adapte às peças deste personagem.' });
    for (const r of base) { const b = this.bloco(r.img); if (!b) continue; out.push(b); out.push({ type: 'text', text: `↑ ${r.nome} (${r.segundos} s, ${r.quadros_na_folha}). ${r.descricao} ${r.como_usar || ''}` }); }
    for (const r of meus) {
      const blob = r.k ? await Arq.pegaBlob(r.k).catch(() => null) || (/^personagens\//.test(r.k) ? await Nuvem.baixar(r.k).catch(() => null) : null) : null; if (!blob) continue;
      const b = this.bloco(await this.b64(blob)); if (!b) continue;
      out.push(b); out.push({ type: 'text', text: `↑ ${editor ? 'REFERÊNCIA DESTA ANIMAÇÃO (copie o estilo de animação e edição dela com prioridade)' : 'REFERÊNCIA DESTE PERSONAGEM (siga com prioridade)'}: ${r.nome || 'vídeo'}${r.tipo === 'youtube' ? ' — do YouTube (4 cenas espalhadas pelo vídeo)' : ` — ${r.quadros || 12} quadros espalhados por ${r.seg ? r.seg.toFixed(1) + ' s' : 'um vídeo'}`}${r.nota ? '. Nota: ' + r.nota : ''}` });
    }
    return out;
  },
  // ---------- montar a folha ----------
  async folha(imgs, cols, larg = 256, rotulos) {
    const im0 = imgs[0], k = larg / (im0.width || im0.videoWidth), H = Math.round((im0.height || im0.videoHeight) * k), rows = Math.ceil(imgs.length / cols);
    const c = document.createElement('canvas'); c.width = cols * larg; c.height = rows * H; const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
    imgs.forEach((im, i) => { const px = (i % cols) * larg, py = Math.floor(i / cols) * H; x.drawImage(im, px, py, larg, H);
      if (rotulos?.[i]) { x.font = '600 13px sans-serif'; const w = x.measureText(rotulos[i]).width + 10; x.fillStyle = 'rgba(0,0,0,.72)'; x.fillRect(px + 3, py + 3, w, 19); x.fillStyle = '#fff'; x.fillText(rotulos[i], px + 8, py + 17); } });
    return new Promise(ok => c.toBlob(ok, 'image/jpeg', .8));
  },
  async doVideo(f, n = 12) {
    const url = URL.createObjectURL(f), v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url;
    try {
      await new Promise((ok, no) => { v.onloadedmetadata = ok; v.onerror = () => no(new Error('o navegador não abriu este vídeo')); setTimeout(() => no(new Error('o vídeo demorou demais para abrir')), 20000); });
      const dur = v.duration || 1, quadros = [], rot = [];
      for (let i = 0; i < n; i++) {
        v.currentTime = Math.min(dur - .05, (i + .5) * dur / n); await new Promise(ok => { const f2 = () => { v.removeEventListener('seeked', f2); ok(); }; v.addEventListener('seeked', f2); setTimeout(ok, 4000); });
        const c = document.createElement('canvas'), k = Math.min(1, 512 / Math.max(v.videoWidth, v.videoHeight)); c.width = Math.max(1, v.videoWidth * k); c.height = Math.max(1, v.videoHeight * k); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); quadros.push(c); rot.push(Trechos.txt(v.currentTime, 1));
      }
      const vertical = v.videoHeight > v.videoWidth;
      return { blob: await this.folha(quadros, vertical ? 6 : 4, vertical ? 170 : 256, rot), seg: dur, quadros: n };
    } finally { URL.revokeObjectURL(url); }
  },
  async doYoutube(id) {
    const hd = await Nuvem.hd(), srv = Nuvem.srv; let nome = 'Vídeo do YouTube';
    try { const j = await (await fetch(`${srv}/yt/info?id=${id}`, { headers: hd })).json(); if (j.title) nome = j.title; } catch { }
    const ims = [];
    for (const f of ['hq1', 'hq2', 'hq3', 'hqdefault']) { try { const r = await fetch(`${srv}/yt/img?id=${id}&f=${f}`, { headers: hd }); if (r.ok) ims.push(await createImageBitmap(await r.blob())); } catch { } }
    if (!ims.length) throw new Error('não consegui pegar as imagens deste vídeo');
    return { blob: await this.folha(ims, 2, 480), nome };
  },
  // ---------- campo: chips + caixa de links (vírgula, espaço ou Enter separam) + vídeo do computador ----------
  // o = { lista(): array guardada no projeto, chave(): nome do arquivo novo, mudou() }
  campo(o) {
    const el = h(`<div class="refs-anim"><div class="refs-cab">${ic('film', 14)} <b>Vídeos de referência</b><small>${o.modo === 'editor' ? 'a IA copia o estilo de animação e de edição deles ao criar (além do test drive da equipe)' : 'só guiam a IA nas animações de teste deste personagem (além do test drive da equipe)'}</small></div>
      <div class="refs-l"></div><div class="refs-in"><input type="text" placeholder="Cole links do YouTube (vírgula, espaço ou Enter separam)"><button class="btn sm" data-arq title="Vídeo do computador (MP4, WEBM, MOV)">${ic('upload', 13)} Vídeo</button></div><div class="refs-st"></div></div>`);
    const inp = $('input', el), st = $('.refs-st', el);
    const pinta = () => {
      const l = $('.refs-l', el); l.innerHTML = '';
      for (const r of o.lista()) {
        const c = h(`<div class="ref-chip" title="${esc(r.nome || '')}"><span class="th"></span><span class="nm">${ic(r.tipo === 'youtube' ? 'play' : 'film', 12)} ${esc(r.nome || 'Vídeo')}</span><button class="ibtn" data-x title="Tirar">${ic('x', 12)}</button></div>`);
        Arq.pegaBlob(r.k).then(b => { if (b) $('.th', c).style.backgroundImage = `url('${URL.createObjectURL(b)}')`; });
        $('[data-x]', c).onclick = () => { const L = o.lista(), i = L.indexOf(r); if (i >= 0) L.splice(i, 1); o.mudou(); pinta(); };
        l.appendChild(c);
      }
      if (!o.lista().length) l.appendChild(h('<div class="refs-vazio">Nenhum vídeo deste projeto ainda.</div>'));
    };
    const add = async (fazer, rotulo) => {
      st.innerHTML = `<span class="spin-dot"></span> ${esc(rotulo)}…`;
      try { const r = await fazer(); const k = o.chave(); await Arq.guardar(r.blob, k); o.lista().push({ id: uid('rf'), k, ...r.info }); o.mudou(); pinta(); st.textContent = ''; }
      catch (e) { st.textContent = 'Não deu: ' + e.message; }
    };
    const vistos = () => new Set(o.lista().map(r => r.vid).filter(Boolean));
    const le = async (fim) => {
      const partes = inp.value.split(/[\s,;]+/); const resto = fim ? '' : partes.pop(); inp.value = resto || '';
      for (const p of partes.filter(Boolean)) { const id = this.ytId(p); if (!id) { st.textContent = `"${p.slice(0, 40)}" não parece um link do YouTube.`; continue; } if (vistos().has(id)) continue;
        await add(async () => { const r = await this.doYoutube(id); return { blob: r.blob, info: { tipo: 'youtube', vid: id, url: 'https://youtu.be/' + id, nome: r.nome } }; }, 'Pegando as cenas do vídeo do YouTube'); }
    };
    inp.addEventListener('input', () => { if (/[\s,;]/.test(inp.value)) le(false); });
    inp.addEventListener('paste', () => setTimeout(() => le(true), 0));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); le(true); } e.stopPropagation(); });
    inp.addEventListener('blur', () => { if (inp.value.trim()) le(true); });
    $('[data-arq]', el).onclick = async () => { const fs = await pickFiles('video/*', true); for (const f of fs) await add(async () => { const r = await this.doVideo(f, o.quadros || 12); return { blob: r.blob, info: { tipo: 'video', nome: f.name.replace(/\.[^.]+$/, '').slice(0, 60), seg: r.seg, quadros: r.quadros } }; }, `Tirando os quadros de "${f.name}"`); };
    el.ondragover = e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); } };
    el.ondrop = async e => { const fs = [...e.dataTransfer.files].filter(f => /^video\//.test(f.type) || /\.(mp4|webm|mov|m4v)$/i.test(f.name)); if (!fs.length) return; e.preventDefault(); e.stopPropagation();
      for (const f of fs) await add(async () => { const r = await this.doVideo(f, o.quadros || 12); return { blob: r.blob, info: { tipo: 'video', nome: f.name.replace(/\.[^.]+$/, '').slice(0, 60), seg: r.seg, quadros: r.quadros } }; }, `Tirando os quadros de "${f.name}"`); };
    pinta(); return el;
  },
};
