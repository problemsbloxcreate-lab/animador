/* ===================== cenvideo.js — CENÁRIO EM VÍDEO PRESO À CÂMERA (12/11/2026) =====================
   Nó { tipo: 'video', arq, vfps, vquadros, vw, vh, de, ate, presoCamera: true } na hierarquia (P.raiz). O mp4 fica no armazenamento
   de arquivos (Arq, DB 'arquivos', igual às imagens); o projeto só guarda a chave (n.arq). Entra no Toon.ids, então vai junto no
   .animador, na nuvem da animação (js/nuvemanim.js) e no ao vivo como qualquer imagem/áudio.
   No quadro q da timeline desenha o quadro do vídeo do tempo (q - de) / P.fps cobrindo o QUADRO DA CÂMERA inteiro (Render.umNo passa
   `fr` = px do vídeo final → tela): não sofre pan/zoom/giro da câmera. Fora de [de, de + duração) não desenha nada.
   - Parado / scrub: busca o quadro (seek no <video>, espera 'seeked') e copia num canvas; enquanto não chega, mostra o último que chegou.
   - Tocando: o <video> toca de verdade (play(), mudo; sem seek a cada quadro) e só é corrigido (seek) quando escorrega mais de 1 quadro
     do relógio da timeline (e nunca no meio de outra busca).
   - Exportar (js/exportar.js): `await CenarioVideo.prepara(P, q)` antes de cada quadro = quadro EXATO (outro <video>, só do export,
     para o palco não brigar com ele), e o Render.quadro do export roda com `CenarioVideo.emExport = true`.
   Por script: `await CenarioVideo.adicionar(blobOuFile, { nome, inicio: 0, posicao: 'fundo' | 'topo' })`.
   TRANSPARÊNCIA (12/11/2026): aceita WebM VP9 com canal alfa (yuva420p): o Chrome decodifica o alfa e o drawImage do <video> o mantém;
   o canvas de cada quadro é limpo antes de copiar (senão o quadro de antes aparecia nos buracos). posicao 'topo' = na FRENTE dos
   personagens (topo da hierarquia, logo abaixo das camadas de efeito que valem a animação toda, para o visual valer nele também).
   O export espera o quadro exato de TODOS os vídeos visíveis no quadro (um <video> de export para cada nó). */
'use strict';
const CenarioVideo = {
  els: new Map(), // 'ed:<id do nó>' (palco) / 'exp:<id do nó>' (export) → { arq, v, url, cv, f, alvo, ocupado, laco, pronto }
  emExport: false,

  // tempo da timeline → índice do quadro no vídeo (ou -1 fora do vídeo)
  quadroDe(P, n, q) {
    if (n.tipo !== 'video' || !n.arq) return -1; const fpsV = n.vfps || P.fps || 24, t = (q - (n.de || 0)) / (P.fps || 24); if (t < 0) return -1;
    const f = Math.floor(t * fpsV + 1e-6); return n.vquadros && f >= n.vquadros ? -1 : f;
  },
  // quantos quadros da timeline o vídeo ocupa
  duracaoQ(P, n) { return Math.max(1, Math.ceil((n.vquadros || 1) * (P.fps || 24) / (n.vfps || P.fps || 24) - 1e-6)); },

  /* ---------- o <video> de cada nó ---------- */
  _caixa() { let d = document.getElementById('cenvideo-els'); if (!d) { d = document.createElement('div'); d.id = 'cenvideo-els'; d.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1'; document.body.appendChild(d); } return d; }, // no DOM (invisível): o navegador decodifica sem pausar o vídeo
  el(n, canal = 'ed') {
    const ch = canal + ':' + n.id; let e = this.els.get(ch); if (e && e.arq === n.arq) return e; if (e) this.solta1(ch);
    e = { arq: n.arq, v: null, url: null, cv: null, f: -1, alvo: null, ocupado: false, laco: null, falhou: 0 }; this.els.set(ch, e);
    e.pronto = (async () => {
      let b = await Arq.pegaBlob(n.arq).catch(() => null); if (!b) { e.falhou = Date.now(); return false; } // ainda não chegou (nuvem/ao vivo): tenta de novo depois
      if (!b.type || b.type === 'application/octet-stream') b = new Blob([b], { type: await this.tipo(b) }); // veio de um .animador (zip): sem o tipo
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; e.url = URL.createObjectURL(b); v.src = e.url; this._caixa().appendChild(v);
      await new Promise(ok => { if (v.readyState >= 2) return ok(); const fim = () => { v.removeEventListener('loadeddata', fim); v.removeEventListener('error', fim); ok(); }; v.addEventListener('loadeddata', fim); v.addEventListener('error', fim); });
      if (v.error || !v.videoWidth) { e.falhou = Date.now(); console.warn('[cenário em vídeo] não abriu', n.arq, v.error); v.remove(); return false; }
      e.cv = document.createElement('canvas'); e.cv.width = v.videoWidth; e.cv.height = v.videoHeight; e.v = v; return true; // e.v só depois de abrir: sem ele ninguém busca nem desenha
    })();
    return e;
  },
  solta1(ch) { const e = this.els.get(ch); if (!e) return; this.els.delete(ch); try { e.v?.pause(); e.v?.removeAttribute('src'); e.v?.load(); e.v?.remove(); } catch { } if (e.url) URL.revokeObjectURL(e.url); },
  solta(canal) { for (const ch of [...this.els.keys()]) if (!canal || ch.startsWith(canal + ':')) this.solta1(ch); },

  /* ---------- buscar um quadro (seek) e copiar no canvas ---------- */
  async busca(e, f, fpsV) {
    const v = e.v; if (!v) return; if (!v.paused) v.pause();
    const t = (f + .5) / fpsV; // meio do quadro: o navegador mostra exatamente o quadro f
    await new Promise(ok => { let to = 0; const fim = () => { clearTimeout(to); v.removeEventListener('seeked', fim); ok(); }; to = setTimeout(fim, 5000); v.addEventListener('seeked', fim); v.currentTime = t; });
    const g = e.cv.getContext('2d'); g.clearRect(0, 0, e.cv.width, e.cv.height); g.drawImage(v, 0, 0, e.cv.width, e.cv.height); e.f = f; // limpa antes: vídeo com transparência
  },
  // vai buscando até chegar no quadro pedido (o último pedido vale: no scrub os do meio são pulados)
  pede(e, f, fpsV, aoChegar) {
    e.alvo = f; if (e.ocupado) return e.laco; e.ocupado = true;
    return (e.laco = (async () => {
      await null; // espera o desenho de agora terminar (casca de cebola etc. pedem outros quadros antes do de agora)
      try { if (!await e.pronto) return; while (e.alvo != null && e.alvo !== e.f) { await this.busca(e, e.alvo, fpsV); aoChegar?.(); } }
      catch (err) { console.warn('[cenário em vídeo]', err); } finally { e.ocupado = false; }
    })());
  },

  /* ---------- o que o Render desenha (sem esperar) ---------- */
  desenhavel(P, n, q) {
    const f = this.quadroDe(P, n, q); if (f < 0) return null; const fpsV = n.vfps || P.fps || 24;
    if (this.emExport) { const e = this.els.get('exp:' + n.id); return e && e.f === f ? e.cv : null; } // o export já esperou o quadro (prepara)
    const e = this.el(n); if (!e.v) { if (e.falhou && Date.now() - e.falhou > 5000) this.solta1('ed:' + n.id); e.pronto?.then(ok => ok && Render.aoChegarImagem?.()); return null; }
    const tocando = typeof App !== 'undefined' && App.tocando && App.P === P;
    if (tocando) { // TOCANDO: o <video> anda sozinho e é corrigido se escorregar do relógio da timeline
      if (e.f === f) return e.cv; e.alvo = null; const t = (f + .5) / fpsV, v = e.v;
      if (v.paused) { if (!e.ocupado) { v.currentTime = t; v.play().catch(() => { }); } }
      else if (!v.seeking && Math.abs(v.currentTime - t) > 1.5 / fpsV) v.currentTime = t; // tolerância de ±1 quadro (o meio do quadro ± 1,5 = até 1 quadro de diferença); só busca de novo se escorregar mais, e nunca no meio de outra busca
      clearTimeout(e.to); e.to = setTimeout(() => { if (!(App.tocando && App.P === P)) v.pause(); }, 300); // parou de tocar (ou o vídeo saiu do trecho): pausa
      return v.readyState >= 2 ? v : (e.f >= 0 ? e.cv : null);
    }
    if (!e.v.paused) e.v.pause();
    if (e.f !== f) this.pede(e, f, fpsV, () => Render.aoChegarImagem?.());
    return e.f >= 0 ? e.cv : null; // enquanto o quadro certo não chega, o último que chegou (o scrub não pisca)
  },
  // desenha cobrindo o quadro da câmera (fr = px do vídeo final → tela), sem distorcer (cobre e corta o que sobrar)
  desenha(ctx, P, n, q, fr) {
    const im = this.desenhavel(P, n, q); if (!im) return false; const iw = im.videoWidth || im.width, ih = im.videoHeight || im.height; if (!iw || !ih) return false;
    const k = Math.max(P.w / iw, P.h / ih), w = iw * k, h = ih * k; ctx.setTransform(fr || new DOMMatrix()); ctx.drawImage(im, (P.w - w) / 2, (P.h - h) / 2, w, h); return true;
  },

  /* ---------- export: quadro EXATO ---------- */
  nos(P) { return Modelo.todos(P).filter(n => n.tipo === 'video' && n.arq); },
  tem(P) { return this.nos(P).length > 0; },
  async prepara(P, q) {
    const vivos = []; Render.cadaVisivel(P, q, n => { if (n.tipo === 'video') vivos.push(n); }); // só os visíveis neste quadro (pasta escondida/fora do tempo não)
    await Promise.all(vivos.map(async n => { const f = this.quadroDe(P, n, q); if (f < 0) return; const e = this.el(n, 'exp'); if (!await e.pronto) return;
      while (e.f !== f) await this.pede(e, f, n.vfps || P.fps || 24); }));
  },

  /* ---------- criar ---------- */
  // tipo pelo começo do arquivo: WebM/Matroska começa com 1A 45 DF A3 (o resto vai como mp4)
  async tipo(b) { try { const u = new Uint8Array(await b.slice(0, 4).arrayBuffer()); if (u[0] === 0x1a && u[1] === 0x45 && u[2] === 0xdf && u[3] === 0xa3) return 'video/webm'; } catch { } return 'video/mp4'; },
  // lê duração e tamanho do vídeo
  async info(blob) {
    const u = URL.createObjectURL(blob), v = document.createElement('video'); v.muted = true; v.preload = 'metadata'; v.src = u;
    try { await new Promise((ok, no) => { v.onloadedmetadata = ok; v.onerror = () => no(new Error('Não consegui abrir esse vídeo (use mp4 H.264, ou WebM VP9 para transparência).')); });
      let d = v.duration; if (!isFinite(d)) { v.currentTime = 1e7; await new Promise(ok => { v.onseeked = ok; setTimeout(ok, 3000); }); d = v.duration; } // mp4 sem a duração no começo
      return { dur: isFinite(d) ? d : 0, w: v.videoWidth, h: v.videoHeight }; }
    finally { v.removeAttribute('src'); v.load(); URL.revokeObjectURL(u); }
  },
  /* API por script: await CenarioVideo.adicionar(blobOuFile, { nome, inicio = 0, fps = 24, posicao = 'fundo', P = App.P, salvar = true })
     Guarda o vídeo nos arquivos e salva o projeto. Devolve o nó. posicao 'fundo' = camada MAIS DE BAIXO (logo acima do "Fundo padrão",
     que é uma folha branca do tamanho da câmera e o esconderia); 'topo' = na frente de tudo (WebM com alfa por cima dos personagens),
     logo abaixo das camadas de efeito que estão no topo (o visual/efeitos do vídeo todo continuam valendo nele). */
  async adicionar(arquivo, o = {}) {
    const P = o.P || (typeof App !== 'undefined' ? App.P : null); if (!P) throw new Error('Abra uma animação antes.'); if (!(arquivo instanceof Blob)) throw new Error('Mande um Blob ou File de vídeo (mp4).');
    let blob = arquivo; if (!blob.type || blob.type === 'application/octet-stream') blob = new Blob([blob], { type: await this.tipo(blob) });
    const topo = o.posicao === 'topo'; if (o.posicao && !topo && o.posicao !== 'fundo') throw new Error("posicao: 'fundo' ou 'topo'.");
    const inf = await this.info(blob), vfps = +o.fps || 24, vquadros = Math.max(1, Math.round(inf.dur * vfps));
    const arq = await Arq.guardar(blob, uid('vid'));
    const nome = String(o.nome || arquivo.name?.replace(/\.[^.]+$/, '') || 'Cenário em vídeo').slice(0, 60), de = Math.max(0, Math.round(+o.inicio || 0));
    const n = Modelo.novoNo('video', { nome, de }); Object.assign(n, { arq, vfps, vquadros, vw: inf.w, vh: inf.h, presoCamera: true }); if (topo) n.frente = true; else n.cenario = true;
    n.ate = de + this.duracaoQ(P, n) - 1;
    if (topo) { let i = 0; while (P.raiz[i]?.tipo === 'efeito') i++; P.raiz.splice(i, 0, n); } // na frente: depois só das camadas de efeito do topo
    else { const i = P.raiz.findIndex(x => x.fundoPadrao); if (i >= 0) P.raiz.splice(i, 0, n); else P.raiz.push(n); } // o 1º da lista fica na frente: o fim é o fundo
    if (inf.w !== P.w || inf.h !== P.h) UI?.toast?.(`O vídeo é ${inf.w}×${inf.h} e a animação ${P.w}×${P.h}: ele cobre o quadro da câmera e corta o que sobrar.`, { kind: 'warn', time: 6000 });
    if (o.salvar !== false) {
      if (typeof App !== 'undefined' && App.P === P) { App.sel = n.id; App.commit('Vídeo de cenário'); await App.salvarJa(); }
      else { P.modificado = Date.now(); await DB.put('projetos', JSON.parse(JSON.stringify(P))); }
    }
    return n;
  },
  // botão/menu: escolhe o arquivo de vídeo e põe no quadro de agora
  async escolher(o = {}) {
    if (!App.P) return; const [f] = await pickFiles('video/mp4,video/webm,video/*', false); if (!f) return;
    const t = UI.toast('<span class="spin-dot"></span> Guardando o vídeo…', { time: 120000 });
    try { const n = await this.adicionar(f, { nome: f.name.replace(/\.[^.]+$/, ''), inicio: App.q, posicao: o.posicao }); UI.toast(`<b>${esc(n.nome)}</b> entrou como ${n.frente ? 'vídeo NA FRENTE' : 'cenário em vídeo'} (preso à câmera), do quadro ${n.de + 1} ao ${n.ate + 1}.`, { kind: 'ok' }); }
    catch (e) { UI.toast(esc(e.message || String(e)), { kind: 'err' }); } finally { t.remove(); }
  },
};
