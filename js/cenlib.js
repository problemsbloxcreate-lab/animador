/* ===================== cenlib.js — SISTEMA DE CENÁRIOS (janela "Cenários") =====================
   Gera, organiza e ajusta CENÁRIOS EM CAMADAS (o formato do Planetário do Problems; guia em cenarios/CAMADAS.md).
   BIBLIOTECA (coluna da esquerda):
     · Nesta animação — os cenários que já estão na cena (pastas de cenário)
     · Da casa — pacotes do repositório: cenarios/biblioteca.json → cenarios/<id>/cenario.json + camadas/*.svg|png + miniatura.jpg
     · Meus — salvos neste computador (variações, cenários montados com imagens, importados de arquivo .cenario)
     · Rabiscados — os prontos antigos (js/cenarios.js), viram camadas PNG ao abrir
   CENÁRIO (pacote): { formato:'cenario-camadas', v:1, id, nome, tags, w:1920, h:1080, cena:{luz,con,sat,mat},
     camadas:[ { id, nome, arq|k, tipo:'svg'|'png', w, h, cx, cy, s, r, flip, oculta, trava, fx:{luz,con,sat,mat} } ] }  (de trás para a frente;
     cx/cy = centro em px da tela 1920×1080, s = escala sobre w×h, r = giro em graus, fx = cor e luz da camada).
   NA CENA: uma PASTA (pasta.cenario = true, pasta.cenLib = { id, nome, origem }) cobrindo a câmera, com uma camada de imagem por camada
     (n.camCen = id da camada). Chaves das camadas: x, y (= cx, cy), s, r, sx (−1 = espelhada), op e fx. A pasta também tem fx (cena inteira).
   PADRÃO × KEYFRAME (como no Ateliê: a pose padrão é a base e o que muda num frame fica só nele):
     · Padrão — muda a camada em TODOS os quadros (a diferença vai para todas as chaves dela; as animações continuam iguais por cima)
     · Neste keyframe — cria/muda a chave no quadro atual e SEGURA o valor de antes no próximo keyframe do cenário: só este trecho muda.
   As imagens das camadas da casa usam a chave "cenarios/<id>/camadas/<arquivo>" no Arq: se não estiverem no computador, vêm do site
   (Arq.bitmap) e ficam guardadas; vão junto no .animador como qualquer imagem. */
'use strict';
const CenLib = {
  W: 1920, H: 1080, FX0: { luz: 100, con: 100, sat: 100, mat: 0 },
  AJ: [['luz', 'Iluminação', 20, 200, '%'], ['con', 'Contraste', 20, 200, '%'], ['sat', 'Saturação', 0, 250, '%'], ['mat', 'Cor (matiz)', -180, 180, '°']],
  _casa: null, _pac: {},
  fil(f) { return f && Object.keys(this.FX0).some(c => (f[c] ?? this.FX0[c]) !== this.FX0[c]) ? Modelo.filtroFx({ ...this.FX0, ...f }) : 'none'; },

  /* ---------- biblioteca ---------- */
  async casa() {
    if (!this._casa) { try { const r = await fetch('cenarios/biblioteca.json', { cache: 'no-cache' }); this._casa = r.ok ? (await r.json()).cenarios || [] : []; } catch { this._casa = []; } }
    return this._casa;
  },
  async pacote(id) {
    if (!this._pac[id]) { const r = await fetch(`cenarios/${id}/cenario.json`, { cache: 'no-cache' }); if (!r.ok) throw new Error(`Não achei o cenário "${id}" no site.`); this._pac[id] = await r.json(); }
    const j = clone(this._pac[id]);
    for (const c of j.camadas) c.k = `cenarios/${id}/${c.arq}`;
    return { ...j, origem: 'casa', mini: j.miniatura ? `cenarios/${id}/${j.miniatura}` : null };
  },
  async meus() { try { return (await DB.get('arquivos', 'cenlib-meus')) || []; } catch { return []; } },
  async gravaMeus(l) { await DB.put('arquivos', l, 'cenlib-meus'); },
  async salvaMeu(def, mini) {
    const l = await this.meus(), i = l.findIndex(x => x.id === def.id), it = { id: def.id, nome: def.nome, tags: def.tags || [], em: Date.now(), mini, def: this.limpa(def) };
    if (i >= 0) l[i] = it; else l.unshift(it); await this.gravaMeus(l); return it;
  },
  limpa(def) { return { formato: 'cenario-camadas', v: 1, id: def.id, nome: def.nome, tags: def.tags || [], estilo: def.estilo, w: this.W, h: this.H, cena: { ...this.FX0, ...(def.cena || {}) },
    camadas: def.camadas.map(c => { const o = { id: c.id, nome: c.nome, k: c.k, tipo: c.tipo, w: c.w, h: c.h, cx: round(c.cx, 1), cy: round(c.cy, 1), s: round(c.s ?? 1, 4), r: round(c.r || 0, 2) };
      if (c.flip) o.flip = true; if (c.oculta) o.oculta = true; if (c.trava) o.trava = true; if (c.op != null && c.op < 1) o.op = round(c.op, 3); if (c.fx && this.fil(c.fx) !== 'none') o.fx = { ...this.FX0, ...c.fx }; return o; }) }; },
  // os rabiscados antigos (js/cenarios.js) viram camadas PNG
  async deRabiscado(id, nome) {
    const est = await Cenarios.estadoDe(await Cenarios.pronto(id)), camadas = [];
    for (const p of est.pecas) { const b = await Cenarios.blob(p.cv), k = await Arq.guardar(b, uid('a') + '.png'); Arq.img.set(k, await createImageBitmap(b));
      camadas.push({ id: slugCen(p.nome) + '-' + camadas.length, nome: p.nome, k, tipo: 'png', w: p.cv.width, h: p.cv.height, cx: p.x + p.w / 2, cy: p.y + p.h / 2, s: round(p.w / p.cv.width, 4), r: 0, ...(p.trava ? { trava: true } : {}) }); }
    return { id: 'rab-' + id, nome, origem: 'rabiscado', tags: ['rabiscado'], cena: { ...this.FX0 }, camadas, mini: `cenarios/miniaturas/${id}.jpg` };
  },
  // imagens/SVGs do computador → cenário novo (cada arquivo uma camada, a primeira cobrindo a tela)
  async deArquivos(fs, nome) {
    const camadas = [];
    for (const f of fs) {
      const svg = /\.svg$/i.test(f.name) || f.type === 'image/svg+xml', k = await Arq.guardar(f, uid('a') + (svg ? '.svg' : '.png'));
      const bm = await Arq.deBlob(f, k); if (!bm) { UI.toast(`Não abri "${esc(f.name)}".`, { kind: 'err' }); continue; } Arq.img.set(k, bm);
      const w = bm.width || 512, hh = bm.height || 512, s = camadas.length ? Math.min(1, 700 / Math.max(w, hh)) : Math.max(this.W / w, this.H / hh);
      camadas.push({ id: slugCen(f.name.replace(/\.[^.]+$/, '')) + '-' + camadas.length, nome: f.name.replace(/\.[^.]+$/, '').slice(0, 30) || 'Camada', k, tipo: svg ? 'svg' : 'png', w, h: hh, cx: this.W / 2, cy: camadas.length ? this.H * .55 : this.H / 2, s: round(s, 4), r: 0 });
    }
    if (!camadas.length) return null;
    return { id: uid('cen'), nome: nome || 'Cenário novo', origem: 'meu', tags: [], cena: { ...this.FX0 }, camadas };
  },

  /* ---------- na cena ---------- */
  pastasNaCena() { const out = []; if (App.P) Modelo.cada(App.P.raiz, n => { if (n.tipo === 'pasta' && (n.cenLib || n.cenario)) out.push(n); }); return out; },
  async porNaCena(def) {
    const P = App.P, q = App.q; if (!P) throw new Error('Abra uma animação primeiro.');
    await Arq.garantir(def.camadas.map(c => c.k));
    const c = Modelo.camera(P, q), z = c.zoom || 1, s = round(Math.max(P.w / z / this.W, P.h / z / this.H) * 1.02, 3);
    const pasta = Modelo.novoNo('pasta', { nome: 'Cenário: ' + String(def.nome || 'novo').slice(0, 30) });
    Object.assign(pasta, { de: q, aberto: false, cenario: true, interp: false, cenLib: { id: def.id, nome: def.nome, origem: def.origem || 'meu' } });
    pasta.chaves = { [q]: { x: Math.round(c.x - this.W / 2 * s), y: Math.round(c.y - this.H / 2 * s), r: 0, s, sx: 1, op: 1, ...(this.fil(def.cena) !== 'none' ? { fx: { ...this.FX0, ...def.cena } } : {}) } };
    for (const L of [...def.camadas].reverse()) { // a da frente primeiro na pasta
      const n = Modelo.novoNo('imagem', { arq: L.k, nome: L.nome }); n.de = q; n.camCen = L.id; n.interp = false; if (L.tipo === 'svg') n.vetor = true;
      if (L.oculta) n.vis = false; if (L.trava) n.trava = true;
      n.chaves = { [q]: { x: L.cx, y: L.cy, r: L.r || 0, s: this.escalaNo(L), sx: L.flip ? -1 : 1, op: L.op ?? 1, ...(L.fx && this.fil(L.fx) !== 'none' ? { fx: { ...this.FX0, ...L.fx } } : {}) } };
      pasta.filhos.push(n);
    }
    const i = P.raiz.findIndex(x => x.cenario || x.fundoPadrao); if (i >= 0) P.raiz.splice(i, 0, pasta); else P.raiz.push(pasta);
    App.sel = pasta.id; App.commit('Cenário em camadas'); return pasta;
  },
  // s da camada na cena: o bitmap pode ter outro tamanho que o w×h do pacote (SVG = o mesmo; PNG grande = menor)
  escalaNo(L) { const bm = Arq.img.get(L.k), bw = bm?.width || L.w; return round((L.s ?? 1) * L.w / bw, 4); },
  // keyframes do cenário: os quadros com chave na pasta ou em alguma camada dela
  keyframes(pasta) { const ks = new Set(Object.keys(pasta.chaves || {}).map(Number)); for (const n of pasta.filhos || []) for (const k of Object.keys(n.chaves || {})) ks.add(+k); return [...ks].sort((a, b) => a - b); },
  // a camada na cena, no quadro q, no formato do pacote
  daCena(n, q) {
    const t = Modelo.transf(n, q), bm = Arq.img.get(n.arq), bw = bm?.width || 100, bh = bm?.height || 100, f = Modelo.fxNo(n, q);
    return { id: n.id, nome: n.nome, k: n.arq, tipo: n.vetor || Vetor?.eh?.(n.arq) ? 'svg' : 'png', w: bw, h: bh, cx: t.x, cy: t.y, s: Math.abs(t.s), r: t.r, flip: (t.sx || 1) < 0, op: t.op, oculta: n.vis === false, trava: !!n.trava, fx: f || { ...this.FX0 }, no: n.id };
  },
  // pasta da cena → pacote (no quadro q): para salvar na biblioteca ou ver na janela
  defDaPasta(pasta, q) {
    const cena = Modelo.fxNo(pasta, q) || { ...this.FX0 };
    return { id: pasta.cenLib?.id || uid('cen'), nome: (pasta.cenLib?.nome || pasta.nome || 'Cenário').replace(/^Cenário: /, ''), origem: 'cena', no: pasta.id, tags: [], cena,
      camadas: [...(pasta.filhos || [])].filter(n => n.tipo === 'imagem').reverse().map(n => this.daCena(n, q)) };
  },
  // muda uma camada (ou a pasta, com campos de cena) na cena. modo 'padrao' = em todo o tempo; 'quadro' = só neste keyframe (segura o de antes no próximo)
  mudaNo(pasta, n, vals, modo, q) {
    const ks = Modelo.quadrosChave(n); if (!ks.length) n.chaves = { [n.de || 0]: {} };
    const tr = {}, fx = {};
    for (const [c, v] of Object.entries(vals)) { if (c in this.FX0) fx[c] = v; else tr[c] = v; }
    if (modo === 'padrao') {
      const t0 = Modelo.transf(n, q), f0 = Modelo.fxNo(n, q) || { ...this.FX0 }, todas = Object.values(n.chaves);
      for (const [c, v] of Object.entries(tr)) {
        if (c === 'vis') { n.vis = v; continue; }
        if (c === 'trava') { n.trava = v; continue; }
        const tem = todas.filter(k => k[c] != null); if (!tem.length) { n.chaves[Modelo.quadrosChave(n)[0]][c] = v; continue; }
        if (c === 'x' || c === 'y' || c === 'r') { const d = v - (t0[c] ?? 0); for (const k of tem) k[c] = round(k[c] + d, 3); }
        else if (c === 's' || c === 'op') { const a = t0[c] || 0; for (const k of tem) k[c] = a ? round(k[c] * v / a, 4) : v; if (c === 'op') for (const k of tem) k.op = clamp(k.op, 0, 1); }
        else if (c === 'sx') { for (const k of tem) k.sx = Math.abs(k.sx || 1) * Math.sign(v || 1); }
      }
      if (Object.keys(fx).length) {
        const tem = todas.filter(k => k.fx); if (!tem.length) n.chaves[Modelo.quadrosChave(n)[0]].fx = { ...this.FX0 };
        for (const k of todas.filter(k => k.fx)) for (const [c, v] of Object.entries(fx)) k.fx[c] = round((k.fx[c] ?? this.FX0[c]) + (v - (f0[c] ?? this.FX0[c])), 2);
      }
      return;
    }
    // SÓ NESTE KEYFRAME: o próximo keyframe do cenário segura o valor de antes
    const kfs = this.keyframes(pasta), prox = kfs.find(k => k > q), antes = prox != null ? { t: Modelo.transf(n, prox), f: Modelo.fxNo(n, prox) } : null;
    if ('vis' in tr) { tr.op = tr.vis ? (Modelo.transf(n, q).op || 1) || 1 : 0; delete tr.vis; }
    delete tr.trava;
    const fAgora = Modelo.fxNo(n, q) || { ...this.FX0 };
    Modelo.poeTransf(n, q, tr);
    if (Object.keys(fx).length) n.chaves[q].fx = { ...fAgora, ...fx };
    if (prox != null && !n.chaves[prox]) { const k = Modelo.chave(n, prox); for (const c of Modelo.TRANSF) k[c] = antes.t[c]; k.fx = antes.f || { ...this.FX0 }; }
    else if (prox != null) { const k = n.chaves[prox]; for (const c of Object.keys(tr)) if (k[c] == null) k[c] = antes.t[c]; if (Object.keys(fx).length && !k.fx) k.fx = antes.f || { ...this.FX0 }; }
  },
  // "Voltar ao padrão" num keyframe: tira o que a chave deste quadro muda (a primeira chave nunca sai: ela É o padrão)
  tiraDoKeyframe(n, q) { const ks = Modelo.quadrosChave(n); if (!n.chaves[q] || ks[0] === q) return false; delete n.chaves[q]; return true; },

  /* ---------- importar / exportar (.cenario) ---------- */
  async exportar(def) {
    const j = this.limpa(def);
    for (const c of j.camadas) { const b = await Arq.pegaBlob(c.k) || await fetch(c.k).then(r => r.ok ? r.blob() : null).catch(() => null); if (!b) throw new Error(`A imagem da camada "${c.nome}" não está neste computador.`);
      c.durl = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(c.tipo === 'svg' ? new Blob([b], { type: 'image/svg+xml' }) : b); }); delete c.k; }
    downloadBlob(new Blob([JSON.stringify({ tipo: 'cenario-camadas', ...j })], { type: 'application/json' }), slugCen(def.nome) + '.cenario');
  },
  async importar(j) {
    if (j?.tipo !== 'cenario-camadas' || !Array.isArray(j.camadas)) throw new Error('Este arquivo não é um cenário em camadas.');
    const camadas = [];
    for (const c of j.camadas.slice(0, 200)) {
      if (!/^data:image\/(png|jpeg|webp|svg\+xml)/.test(c.durl || '')) continue;
      const b = await (await fetch(c.durl)).blob(), svg = /svg/.test(b.type), k = await Arq.guardar(b, uid('a') + (svg ? '.svg' : '.png'));
      camadas.push({ ...c, durl: undefined, k, tipo: svg ? 'svg' : 'png' });
    }
    const def = { ...j, id: uid('cen'), origem: 'meu', camadas }; delete def.tipo;
    await this.salvaMeu(def, await this.miniDe(def)); return def;
  },
  async miniDe(def, larg = 384) { const cv = await this.compoe(def, larg); return cv.toDataURL('image/jpeg', .82); },
  // desenha o cenário inteiro (prévia, miniatura, baixar PNG)
  async compoe(def, larg = this.W, o = {}) {
    const k = larg / this.W, cv = document.createElement('canvas'); cv.width = Math.round(this.W * k); cv.height = Math.round(this.H * k);
    await Arq.garantir(def.camadas.map(c => c.k));
    const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height; const x = t.getContext('2d'); x.imageSmoothingQuality = 'high';
    for (const c of def.camadas) this.desenhaCamada(x, c, k, o);
    const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height); g.filter = this.fil(def.cena); g.drawImage(t, 0, 0); g.filter = 'none';
    return cv;
  },
  desenhaCamada(x, c, k, o = {}) {
    if ((c.oculta || c.op === 0) && !o.fantasma?.(c)) return; const bm = Arq.img.get(c.k); if (!bm) return;
    const s = c.s ?? 1, w = c.w * s, h = c.h * s;
    x.save(); x.globalAlpha = (c.oculta || c.op === 0) ? .25 : (c.op ?? 1); x.filter = this.fil(c.fx); x.setTransform(k, 0, 0, k, 0, 0); x.translate(c.cx, c.cy); x.rotate((c.r || 0) * Math.PI / 180); if (c.flip) x.scale(-1, 1);
    x.drawImage(bm, -w / 2, -h / 2, w, h); x.restore();
  },
};
function slugCen(t) { return String(t || 'cenario').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cenario'; }

/* ===================== a JANELA ===================== */
Object.assign(CenLib, {
  // o = { no: id da pasta na cena } para abrir já nela; o.def = um cenário pronto para mostrar
  async abrir(o = {}) {
    if (!App?.P) return UI.toast('Abra uma animação primeiro.', { kind: 'err' });
    const st = { def: null, orig: null, sel: null, modo: 'padrao', pasta: o.no || null, desf: [], ref: [], busca: '', tag: '', vez: 0, multi: false };
    const body = h(`<div class="cl">
      <aside class="cl-bib">
        <input type="search" class="cl-busca" placeholder="Buscar cenário…" aria-label="Buscar cenário">
        <div class="cl-tags"></div>
        <div class="cl-lista"></div>
        <div class="cl-novo">
          <button class="btn sm" data-n="imgs" title="Cada imagem ou SVG vira uma camada (a primeira cobre a tela)">${ic('image', 13)} Novo com imagens…</button>
          <button class="btn sm ia" data-n="ia" title="A IA desenha no estilo rabiscado; depois vira camadas aqui">${ic('sparkles', 13)} Criar com a IA…</button>
          <button class="btn sm" data-n="nuvem">${ic('cloud', 13)} Da nuvem da equipe…</button>
          <button class="btn sm" data-n="arq" title="Abrir um arquivo .cenario">${ic('upload', 13)} Abrir arquivo…</button>
        </div>
      </aside>
      <section class="cl-meio">
        <div class="cl-topo"><b class="cl-nome" title="Clique para renomear">Escolha um cenário</b><span class="cl-selo"></span><span class="sp"></span>
          <div class="cl-seg" role="tablist" hidden><button data-m="padrao" title="Mudanças valem em todos os quadros">Padrão</button><button data-m="quadro" title="Mudanças valem só a partir deste quadro até o próximo keyframe">Neste keyframe</button></div>
          <button class="ibtn" data-un title="Desfazer (Ctrl+Z)">${ic('undo', 14)}</button><button class="ibtn" data-re title="Refazer (Ctrl+Shift+Z)">${ic('redo', 14)}</button></div>
        <div class="cl-palco"><canvas width="1280" height="720" tabindex="0" aria-label="Cenário: clique numa camada para escolher, arraste para mover"></canvas><div class="cl-vazio">${ic('paisagem', 28)}<span>Escolha um cenário na biblioteca</span></div></div>
        <div class="cl-tempo" hidden>
          <button class="ibtn" data-kp title="Keyframe anterior">${ic('prev', 14)}</button>
          <div class="cl-kfs"></div>
          <button class="ibtn" data-kn title="Próximo keyframe">${ic('next', 14)}</button>
          <span class="cl-q"></span><span class="sp"></span>
          <label class="cl-ck" title="Entre um keyframe e outro: segurar (troca de uma vez) ou ir mudando aos poucos"><input type="checkbox" data-interp> Ir mudando entre os keyframes</label>
        </div>
        <div class="cl-aviso"></div>
      </section>
      <aside class="cl-lado"><div class="cl-sub">Camadas <span>(em cima = na frente)</span></div><div class="cl-camadas"></div><div class="cl-props"></div></aside>
    </div>`);
    const cv = $('canvas', body), g = cv.getContext('2d'), K = cv.width / this.W;
    let api = null, btPor = null, btSalvar = null, btExp = null;
    const pasta = () => st.pasta ? Modelo.achar(App.P, st.pasta)?.no || null : null;
    const naCena = () => !!pasta();
    // ---- o cenário que está na janela (da cena: lido de novo das chaves a cada mudança) ----
    const relê = () => { const p = pasta(); if (p) { const sel = st.sel; st.def = this.defDaPasta(p, App.q); st.sel = st.def.camadas.some(c => c.id === sel) ? sel : null; } };
    const camada = id => st.def?.camadas.find(c => c.id === id) || null;
    // ---- desenho ----
    const desenha = (vivo) => {
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#151515'; g.fillRect(0, 0, cv.width, cv.height);
      $('.cl-vazio', body).hidden = !!st.def; if (!st.def) return;
      const t = this._tela ||= document.createElement('canvas'); t.width = cv.width; t.height = cv.height; const x = t.getContext('2d'); x.clearRect(0, 0, t.width, t.height); x.imageSmoothingQuality = 'high';
      for (const c of st.def.camadas) this.desenhaCamada(x, vivo?.id === c.id ? { ...c, ...vivo } : c, K, { fantasma: c2 => c2.id === st.sel });
      g.filter = this.fil(st.def.cena); g.drawImage(t, 0, 0); g.filter = 'none';
      const c = camada(st.sel); if (c) { const v = vivo?.id === c.id ? { ...c, ...vivo } : c, q = this.cantosDe(v);
        g.save(); g.strokeStyle = st.modo === 'quadro' && naCena() ? '#ffb347' : '#19d3f0'; g.lineWidth = 1.5; g.setLineDash([6, 4]); g.beginPath(); q.forEach(([a, b], i) => i ? g.lineTo(a * K, b * K) : g.moveTo(a * K, b * K)); g.closePath(); g.stroke(); g.setLineDash([]);
        if (!c.trava) { g.fillStyle = g.strokeStyle; for (const [a, b] of q) g.fillRect(a * K - 5, b * K - 5, 10, 10); const [rx, ry] = this.alcaGiro(v); g.beginPath(); g.arc(rx * K, ry * K, 6, 0, 7); g.fill(); g.beginPath(); g.moveTo(rx * K, ry * K); g.lineTo((q[0][0] + q[1][0]) / 2 * K, (q[0][1] + q[1][1]) / 2 * K); g.stroke(); }
        g.restore(); }
    };
    const pinta = () => { desenha(); pintaCamadas(); pintaProps(); pintaTopo(); pintaTempo(); };
    // ---- mudar: grava no cenário (biblioteca) ou na cena (padrão/keyframe) ----
    const foto = () => naCena() ? null : JSON.stringify(st.def);
    const guarda = () => { if (naCena()) return; st.desf.push(foto()); if (st.desf.length > 80) st.desf.shift(); st.ref = []; };
    // valores no formato do pacote numa camada (os de cor e luz vão para c.fx)
    const aplica = (c, vals) => { for (const [k, v] of Object.entries(vals)) { if (k === 'fx') c.fx = { ...this.FX0, ...v }; else if (k in this.FX0) c.fx = { ...this.FX0, ...(c.fx || {}), [k]: v }; else c[k] = v; } };
    const muda = (id, vals, fim = true) => {
      if (!st.def) return;
      if (naCena() && vals.fx) { const { fx, ...r } = vals; vals = { ...r, ...fx }; }
      if (naCena()) {
        const p = pasta(), alvo = id === '__cena' ? p : Modelo.achar(App.P, id)?.no; if (!alvo) return;
        const v = { ...vals }; if ('cx' in v) { v.x = v.cx; delete v.cx; } if ('cy' in v) { v.y = v.cy; delete v.cy; } if ('flip' in v) { v.sx = v.flip ? -1 : 1; delete v.flip; } if ('oculta' in v) { v.vis = !v.oculta; delete v.oculta; }
        if ('s' in v && id !== '__cena') { const bm = Arq.img.get(alvo.arq), L = camada(id); v.s = round(v.s * (L?.w || 1) / (bm?.width || L?.w || 1), 5); }
        this.mudaNo(p, alvo, v, st.modo, App.q);
        if (fim) App.commit(st.modo === 'quadro' ? 'Cenário: keyframe' : 'Cenário: padrão'); else App.pinta();
        relê();
      } else {
        if (fim) guarda();
        if (id === '__cena') Object.assign(st.def.cena, vals.fx || vals); else { const c = camada(id); if (c) aplica(c, vals); }
        st.mexido = true;
      }
      pinta();
    };
    const desfaz = volta => {
      if (naCena()) { volta ? App.redo() : App.undo(); relê(); return pinta(); }
      const de = volta ? st.ref : st.desf, para = volta ? st.desf : st.ref, s = de.pop(); if (!s) return; para.push(foto()); st.def = JSON.parse(s); pinta();
    };
    // ---- biblioteca ----
    const lista = $('.cl-lista', body), tags = $('.cl-tags', body);
    const cartao = (nome, mini, info, ativo, fn, menu) => {
      const b = h(`<div class="cl-card ${ativo ? 'sel' : ''}" tabindex="0" title="${esc(nome)}">${mini ? `<img src="${mini}" alt="">` : '<i></i>'}<div><b>${esc(nome)}</b><small>${info || ''}</small></div></div>`);
      const im = $('img', b); if (im) im.onerror = () => im.replaceWith(h('<i></i>'));
      b.onclick = () => fn(); b.onkeydown = e => { if (e.key === 'Enter') fn(); }; if (menu) b.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, menu()); }; return b;
    };
    const casa = await this.casa(); let meus = await this.meus();
    const pintaBib = async () => {
      const bus = st.busca.trim().toLowerCase(), ok = (nome, tg = []) => (!bus || String(nome).toLowerCase().includes(bus) || tg.some(t => t.toLowerCase().includes(bus))) && (!st.tag || tg.includes(st.tag));
      const todasTags = [...new Set([...casa.flatMap(c => c.tags || []), ...meus.flatMap(m => m.tags || [])])].sort();
      tags.innerHTML = ''; if (todasTags.length) for (const t of ['', ...todasTags]) { const b = h(`<button class="cl-tag ${st.tag === t ? 'on' : ''}">${esc(t || 'Todos')}</button>`); b.onclick = () => { st.tag = t; pintaBib(); }; tags.appendChild(b); }
      lista.innerHTML = '';
      const grupo = (titulo, itens) => { if (!itens.length) return; lista.appendChild(h(`<div class="cl-g">${titulo}</div>`)); itens.forEach(x => lista.appendChild(x)); };
      grupo('Nesta animação', this.pastasNaCena().filter(p => ok(p.nome)).map(p => { const c = cartao(p.nome.replace(/^Cenário: /, ''), null, `${p.filhos.length} camadas · ${this.keyframes(p).length} keyframe(s)`, st.pasta === p.id, () => escolheCena(p.id));
        this.compoe(this.defDaPasta(p, App.q), 168).then(cv => { const i = $('i', c); if (i) i.replaceWith(Object.assign(new Image(), { src: cv.toDataURL('image/jpeg', .8), alt: '' })); }).catch(() => { }); return c; }));
      grupo('Da casa', casa.filter(c => ok(c.nome, c.tags)).map(c => cartao(c.nome, `cenarios/${c.id}/${c.miniatura || 'miniatura.jpg'}`, (c.tags || []).join(' · '), !naCena() && st.def?.origem === 'casa' && st.def.id === c.id, () => escolhe(() => this.pacote(c.id)))));
      grupo('Meus <span>(neste computador)</span>', meus.filter(m => ok(m.nome, m.tags)).map(m => cartao(m.nome, m.mini, fmtDate(m.em), !naCena() && st.def?.id === m.id, () => escolhe(async () => ({ ...clone(m.def), origem: 'meu' })), () => [
        { label: 'Renomear…', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome do cenário', value: m.nome }); if (!n?.trim()) return; m.nome = m.def.nome = n.trim().slice(0, 40); await this.gravaMeus(meus); if (st.def?.id === m.id) st.def.nome = m.nome; pintaBib(); pintaTopo(); } },
        { label: 'Duplicar', icon: 'dup', action: async () => { const d = { ...clone(m.def), id: uid('cen'), nome: m.nome + ' (cópia)' }; await this.salvaMeu(d, m.mini); meus = await this.meus(); pintaBib(); } },
        { label: 'Exportar arquivo .cenario', icon: 'download', action: () => this.exportar(m.def).catch(e => UI.toast(esc(e.message), { kind: 'err' })) }, '-',
        { label: 'Apagar deste computador', icon: 'trash', danger: true, action: async () => { if (!(await UI.confirm({ title: 'Apagar o cenário?', msg: `"<b>${esc(m.nome)}</b>" sai da sua biblioteca. As animações que já usam continuam com ele.`, ok: 'Apagar', danger: true }))) return; meus = meus.filter(x => x.id !== m.id); await this.gravaMeus(meus); pintaBib(); } },
      ])));
      grupo('Rabiscados <span>(prontos antigos)</span>', Cenarios.PRONTOS.filter(p => ok(p.nome, ['rabiscado'])).map(p => cartao(p.nome, `cenarios/miniaturas/${p.id}.jpg`, 'rabiscado', st.def?.id === 'rab-' + p.id, () => escolhe(() => this.deRabiscado(p.id, p.nome)))));
      if (!lista.children.length) lista.appendChild(h('<div class="cl-nada">Nada encontrado.</div>'));
    };
    const ocupa = async (txt, fn) => { const av = $('.cl-aviso', body); av.textContent = txt; body.classList.add('cl-ocupado'); try { return await fn(); } catch (e) { UI.toast(esc(e?.message || e), { kind: 'err' }); console.warn('cenários', e); } finally { body.classList.remove('cl-ocupado'); } };
    const escolhe = fn => ocupa('Abrindo o cenário…', async () => { const d = await fn(); if (!d) return; await Arq.garantir(d.camadas.map(c => c.k)); st.pasta = null; st.def = d; st.orig = clone(d); st.sel = null; st.desf = []; st.ref = []; st.mexido = false; pintaBib(); pinta(); });
    const escolheCena = id => ocupa('Abrindo o cenário da cena…', async () => { st.pasta = id; const p = pasta(); await Arq.garantir(p.filhos.map(n => n.arq)); relê(); st.orig = null; st.sel = null; pintaBib(); pinta(); });
    $('.cl-busca', body).oninput = e => { st.busca = e.target.value; pintaBib(); };
    // ---- topo, keyframes e aviso ----
    const pintaTopo = () => {
      const nm = $('.cl-nome', body), se = $('.cl-selo', body), seg = $('.cl-seg', body);
      nm.textContent = st.def?.nome || 'Escolha um cenário'; se.textContent = !st.def ? '' : naCena() ? 'na cena' : { casa: 'da casa', meu: 'meu', rabiscado: 'rabiscado' }[st.def.origem] || '';
      se.className = 'cl-selo ' + (naCena() ? 'cena' : st.def?.origem || ''); seg.hidden = !naCena();
      $$('button', seg).forEach(b => b.classList.toggle('on', b.dataset.m === st.modo));
      $('[data-un]', body).disabled = naCena() ? false : !st.desf.length; $('[data-re]', body).disabled = naCena() ? false : !st.ref.length;
      if (btPor) { btPor.textContent = naCena() ? 'Concluir' : 'Pôr na cena'; btPor.disabled = !st.def; }
      if (btSalvar) { btSalvar.disabled = !st.def; btSalvar.innerHTML = ic('save', 14) + (st.def?.origem === 'meu' && !naCena() ? 'Salvar' : 'Salvar na biblioteca'); }
      if (btExp) btExp.disabled = !st.def;
      const av = $('.cl-aviso', body);
      av.className = 'cl-aviso ' + (naCena() ? st.modo : '');
      av.innerHTML = !st.def ? 'Os cenários em camadas guardam o <b>padrão</b> de cada camada (lugar, tamanho, giro, cor e luz). Na cena, cada keyframe pode mudar o que quiser só naquele trecho.'
        : !naCena() ? `Editando o <b>padrão</b> do cenário (só nesta janela). <b>Pôr na cena</b> usa como está${st.def.origem === 'casa' ? '; <b>Salvar na biblioteca</b> guarda como uma variação sua' : ''}.`
        : st.modo === 'padrao' ? `<b>Padrão:</b> o que você mudar vale em <b>todos os quadros</b> (o que já foi animado continua, por cima).`
        : `<b>Neste keyframe (quadro ${App.q}):</b> o que você mudar vale daqui até o próximo keyframe do cenário${this.keyframes(pasta()).find(k => k > App.q) == null ? ' (não há outro: vale até o fim)' : ''}. ${this.keyframes(pasta()).includes(App.q) ? '' : 'Ainda não há keyframe aqui: mudar algo cria um.'}`;
    };
    const pintaTempo = () => {
      const box = $('.cl-tempo', body), p = pasta(); box.hidden = !p; if (!p) return;
      const kfs = this.keyframes(p), l = $('.cl-kfs', box); l.innerHTML = '';
      for (const k of kfs) { const b = h(`<button class="cl-kf ${k === App.q ? 'on' : ''}" title="Ir para o quadro ${k}">${k}</button>`); b.onclick = () => irPara(k); l.appendChild(b); }
      if (!kfs.includes(App.q)) { const b = h(`<span class="cl-kf agora" title="Quadro atual (sem keyframe do cenário)">${App.q}</span>`); const i = kfs.findIndex(k => k > App.q); i < 0 ? l.appendChild(b) : l.insertBefore(b, l.children[i]); }
      $('.cl-q', box).textContent = `quadro ${App.q} · ${Math.floor(App.q / (App.P.fps || 24))}s`;
      $('[data-interp]', box).checked = (p.filhos || []).some(n => n.interp);
    };
    const irPara = q => { App.setQ(q, { forca: true }); relê(); pinta(); };
    $('[data-kp]', body).onclick = () => { const k = this.keyframes(pasta()).filter(k => k < App.q).pop(); if (k != null) irPara(k); };
    $('[data-kn]', body).onclick = () => { const k = this.keyframes(pasta()).find(k => k > App.q); if (k != null) irPara(k); };
    $('[data-interp]', body).onchange = e => { const p = pasta(); for (const n of p.filhos) n.interp = e.target.checked; p.interp = e.target.checked; App.commit('Cenário: entre keyframes'); relê(); pinta(); };
    $$('.cl-seg button', body).forEach(b => b.onclick = () => { st.modo = b.dataset.m; pinta(); });
    $('[data-un]', body).onclick = () => desfaz(false); $('[data-re]', body).onclick = () => desfaz(true);
    $('.cl-nome', body).onclick = async () => { if (!st.def) return; const n = await UI.prompt({ title: 'Nome do cenário', value: st.def.nome }); if (!n?.trim()) return;
      if (naCena()) { const p = pasta(); p.nome = 'Cenário: ' + n.trim().slice(0, 30); p.cenLib = { ...(p.cenLib || {}), nome: n.trim().slice(0, 40) }; App.commit('Renomear cenário'); relê(); } else { guarda(); st.def.nome = n.trim().slice(0, 40); } pinta(); pintaBib(); };
    // ---- lista de camadas (em cima = na frente) ----
    const pintaCamadas = () => {
      const box = $('.cl-camadas', body); box.innerHTML = ''; if (!st.def) return;
      const cena = h(`<div class="cl-cam cena ${st.sel === '__cena' ? 'sel' : ''}">${ic('sliders', 14)}<span>Cena inteira (cor e luz)</span></div>`); cena.onclick = () => { st.sel = '__cena'; pinta(); }; box.appendChild(cena);
      [...st.def.camadas].reverse().forEach(c => {
        const p = naCena() ? pasta() : null, n = p && Modelo.achar(App.P, c.id)?.no, noKf = n && n.chaves?.[App.q] && Modelo.quadrosChave(n)[0] !== App.q;
        const it = h(`<div class="cl-cam ${c.id === st.sel ? 'sel' : ''} ${c.oculta || c.op === 0 ? 'off' : ''}" draggable="${!naCena()}" data-id="${esc(c.id)}">
          <button class="ibtn" data-v title="${c.oculta || c.op === 0 ? 'Mostrar' : 'Esconder'}">${ic(c.oculta || c.op === 0 ? 'eyeOff' : 'eye', 13)}</button>
          <span class="cl-cam-n">${esc(c.nome)}</span>${noKf ? `<em class="cl-kfm" title="Esta camada muda neste keyframe">kf</em>` : ''}<small class="cl-tipo ${c.tipo}">${c.tipo === 'svg' ? 'SVG' : 'PNG'}</small>
          <button class="ibtn" data-t title="${c.trava ? 'Destravar' : 'Travar'}">${ic(c.trava ? 'lock' : 'unlock', 13)}</button></div>`);
        it.onclick = e => { if (e.target.closest('button')) return; st.sel = c.id; pinta(); };
        $('[data-v]', it).onclick = () => muda(c.id, { oculta: !(c.oculta || c.op === 0), ...(naCena() ? {} : { op: c.op === 0 ? 1 : c.op }) });
        $('[data-t]', it).onclick = () => naCena() ? (() => { const no = Modelo.achar(App.P, c.id)?.no; if (no) { no.trava = !no.trava; App.commit('Travar camada'); relê(); pinta(); } })() : muda(c.id, { trava: !c.trava });
        it.oncontextmenu = e => { e.preventDefault(); st.sel = c.id; pinta(); menuCamada(e.clientX, e.clientY, c); };
        if (!naCena()) { // arrastar muda a ordem (só no padrão do cenário; na cena a ordem é a da hierarquia)
          it.ondragstart = e => { e.dataTransfer.setData('text/cl', c.id); it.classList.add('arr'); }; it.ondragend = () => it.classList.remove('arr');
          it.ondragover = e => { if ([...e.dataTransfer.types].includes('text/cl')) { e.preventDefault(); it.classList.add('alvo'); } }; it.ondragleave = () => it.classList.remove('alvo');
          it.ondrop = e => { e.preventDefault(); it.classList.remove('alvo'); const de = e.dataTransfer.getData('text/cl'); if (!de || de === c.id) return; guarda(); const L = st.def.camadas, a = L.findIndex(x => x.id === de), m = L.splice(a, 1)[0], b = L.findIndex(x => x.id === c.id); L.splice(b + 1, 0, m); pinta(); };
        }
        box.appendChild(it);
      });
    };
    const ordem = (c, para) => { // frente/trás: no padrão do cenário mexe na lista; na cena mexe na pasta (vale no tempo todo)
      if (naCena()) { const p = pasta(), L = p.filhos, i = L.findIndex(n => n.id === c.id), j = clamp(para === 'frente' ? 0 : para === 'tras' ? L.length - 1 : i - para, 0, L.length - 1); if (i < 0 || i === j) return; L.splice(j, 0, L.splice(i, 1)[0]); App.commit('Ordem do cenário'); relê(); return pinta(); }
      guarda(); const L = st.def.camadas, i = L.indexOf(c), j = clamp(para === 'frente' ? L.length - 1 : para === 'tras' ? 0 : i + para, 0, L.length - 1); if (i === j) return; L.splice(j, 0, L.splice(i, 1)[0]); pinta(); };
    const menuCamada = (x, y, c) => UI.ctx(x, y, [{ head: c.nome },
      { label: 'Para a frente de tudo', icon: 'up', action: () => ordem(c, 'frente') }, { label: 'Um para a frente', icon: 'up', action: () => ordem(c, 1) },
      { label: 'Um para trás', icon: 'down', action: () => ordem(c, -1) }, { label: 'Para trás de tudo', icon: 'down', action: () => ordem(c, 'tras') }, '-',
      { label: 'Espelhar', icon: 'flip', action: () => muda(c.id, { flip: !c.flip }) },
      { label: 'Desfazer o giro', icon: 'undo', action: () => muda(c.id, { r: 0 }) },
      { label: 'Zerar cor e luz', icon: 'sliders', action: () => muda(c.id, { ...this.FX0 }) },
      naCena() && st.modo === 'quadro' && { label: 'Voltar ao padrão neste keyframe', icon: 'undo', action: () => { const n = Modelo.achar(App.P, c.id)?.no; if (n && this.tiraDoKeyframe(n, App.q)) { App.commit('Cenário: tirar do keyframe'); relê(); pinta(); } else UI.toast('Esta camada não muda neste keyframe.'); } },
      !naCena() && st.orig && { label: 'Como era no pacote', icon: 'undo', action: () => { const o = st.orig.camadas.find(x => x.id === c.id); if (o) muda(c.id, { cx: o.cx, cy: o.cy, s: o.s, r: o.r || 0, flip: !!o.flip, fx: { ...this.FX0, ...(o.fx || {}) }, oculta: !!o.oculta }); } },
      { label: 'Baixar a imagem desta camada', icon: 'download', action: async () => { const b = await Arq.pegaBlob(c.k); if (b) downloadBlob(b, slugCen(c.nome) + (c.tipo === 'svg' ? '.svg' : '.png')); } },
      !naCena() && '-', !naCena() && { label: 'Tirar do cenário', icon: 'trash', danger: true, action: () => { guarda(); st.def.camadas = st.def.camadas.filter(x => x !== c); st.sel = null; pinta(); } },
    ].filter(Boolean));
    // ---- propriedades ----
    const linha = (rot, campo, val, min, max, passo, un, fim) => {
      const r = h(`<label class="cl-pr"><span>${rot}</span><input type="range" min="${min}" max="${max}" step="${passo}" value="${val}"><input type="number" class="n" min="${min}" max="${max}" step="${passo}" value="${round(val, 1)}"><i>${un}</i></label>`);
      const [rg, nb] = $$('input', r); let pend = false;
      rg.oninput = () => { nb.value = rg.value; pend = true; fim(+rg.value, false); }; rg.onchange = () => { if (pend) fim(+rg.value, true); pend = false; };
      nb.onchange = () => { const v = clamp(+nb.value || 0, min, max); rg.value = v; fim(v, true); }; nb.onkeydown = e => { if (e.key === 'Enter') nb.blur(); };
      rg.ondblclick = () => { const d = campo in this.FX0 ? this.FX0[campo] : campo === 's' ? 100 : campo === 'op' ? 100 : 0; rg.value = nb.value = d; fim(d, true); };
      return r;
    };
    // sliders: na cena, cada movimento redesenha e só o soltar grava (um passo do Ctrl+Z)
    const vivoNaCena = (id, vals, fim) => { if (fim) return muda(id, vals, true); if (!naCena()) { muda(id, vals, false); return; }
      const c = id === '__cena' ? null : camada(id); // prévia: só na janela (sem mexer nas chaves até soltar)
      if (id === '__cena') st.def.cena = { ...st.def.cena, ...vals }; else if (c) aplica(c, vals); desenha(); };
    const pintaProps = () => {
      const box = $('.cl-props', body); box.innerHTML = ''; if (!st.def) return;
      if (st.sel === '__cena' || !st.sel) {
        box.appendChild(h(`<div class="cl-sub">Cena inteira <span>${naCena() && st.modo === 'quadro' ? '· neste keyframe' : '· padrão'}</span></div>`));
        for (const [c, n, a, b, u] of this.AJ) box.appendChild(linha(n, c, st.def.cena?.[c] ?? this.FX0[c], a, b, 1, u, (v, fim) => vivoNaCena('__cena', { [c]: v }, fim)));
        if (!st.sel) box.appendChild(h('<p class="cl-dica">Clique numa camada (no cenário ou na lista) para mexer nela. Arraste para mover, cantos mudam o tamanho, a bolinha gira (Shift: de 15 em 15°), setas mexem (Shift: 10 px).</p>'));
        return;
      }
      const c = camada(st.sel); if (!c) return;
      box.appendChild(h(`<div class="cl-sub">${esc(c.nome)} <span>${naCena() && st.modo === 'quadro' ? '· neste keyframe' : '· padrão'}</span></div>`));
      box.appendChild(linha('X', 'cx', round(c.cx, 1), -400, this.W + 400, 1, 'px', (v, fim) => vivoNaCena(c.id, { cx: v }, fim)));
      box.appendChild(linha('Y', 'cy', round(c.cy, 1), -400, this.H + 400, 1, 'px', (v, fim) => vivoNaCena(c.id, { cy: v }, fim)));
      box.appendChild(linha('Tamanho', 's', round((c.s ?? 1) * 100, 1), 5, 400, 1, '%', (v, fim) => vivoNaCena(c.id, { s: v / 100 }, fim)));
      box.appendChild(linha('Giro', 'r', round(c.r || 0, 1), -180, 180, .5, '°', (v, fim) => vivoNaCena(c.id, { r: v }, fim)));
      box.appendChild(linha('Opacidade', 'op', round((c.op ?? 1) * 100), 0, 100, 1, '%', (v, fim) => vivoNaCena(c.id, { op: v / 100 }, fim)));
      const bt = h(`<div class="cl-bts"><button class="btn sm" data-f>${ic('flip', 13)} Espelhar</button><button class="btn sm" data-fr>${ic('up', 13)} Frente</button><button class="btn sm" data-tr>${ic('down', 13)} Trás</button></div>`);
      $('[data-f]', bt).onclick = () => muda(c.id, { flip: !c.flip }); $('[data-fr]', bt).onclick = () => ordem(c, 1); $('[data-tr]', bt).onclick = () => ordem(c, -1); box.appendChild(bt);
      box.appendChild(h('<div class="cl-sub">Cor e luz desta camada</div>'));
      for (const [k, n, a, b, u] of this.AJ) box.appendChild(linha(n, k, c.fx?.[k] ?? this.FX0[k], a, b, 1, u, (v, fim) => vivoNaCena(c.id, { [k]: v }, fim)));
      if (naCena() && st.modo === 'quadro') { const n = Modelo.achar(App.P, c.id)?.no, tem = n?.chaves?.[App.q] && Modelo.quadrosChave(n)[0] !== App.q;
        if (tem) { const b = h(`<button class="btn sm" style="margin-top:6px">${ic('undo', 13)} Voltar ao padrão neste keyframe</button>`); b.onclick = () => { if (this.tiraDoKeyframe(n, App.q)) { App.commit('Cenário: tirar do keyframe'); relê(); pinta(); } }; box.appendChild(b); } }
    };
    // ---- mouse no cenário: escolher, mover, cantos, girar ----
    const aTela = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * this.W, (e.clientY - r.top) / r.height * this.H]; };
    const acha = (x, y) => { // a de cima que tem pintura debaixo do mouse (pela transparência de verdade)
      const L = st.def?.camadas || [], t = this._toque ||= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }), tg = t.getContext('2d', { willReadFrequently: true });
      for (let i = L.length - 1; i >= 0; i--) { const c = L[i]; if (c.oculta || c.op === 0) continue;
        tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, 1, 1); tg.save(); tg.translate(-x, -y); const bm = Arq.img.get(c.k); if (!bm) { tg.restore(); continue; } const s = c.s ?? 1; tg.translate(c.cx, c.cy); tg.rotate((c.r || 0) * Math.PI / 180); if (c.flip) tg.scale(-1, 1); tg.drawImage(bm, -c.w * s / 2, -c.h * s / 2, c.w * s, c.h * s); tg.restore();
        if (tg.getImageData(0, 0, 1, 1).data[3] > 20) return c; }
      return null;
    };
    cv.addEventListener('pointerdown', e => {
      if (!st.def || e.button !== 0) return; cv.focus(); const [x, y] = aTela(e); let c = camada(st.sel), modo = null, canto = -1;
      if (c && !c.trava) { const q = this.cantosDe(c), [rx, ry] = this.alcaGiro(c); if (Math.hypot(rx - x, ry - y) * K < 10) modo = 'giro'; else { canto = q.findIndex(([a, b]) => Math.hypot(a - x, b - y) * K < 10); if (canto >= 0) modo = 'tam'; } }
      if (!modo) { c = acha(x, y); st.sel = c?.id || null; pinta(); if (!c || c.trava) return; modo = 'mover'; }
      cv.setPointerCapture(e.pointerId); const v0 = { cx: c.cx, cy: c.cy, s: c.s ?? 1, r: c.r || 0 }; let vivo = null;
      const d0 = Math.hypot(x - c.cx, y - c.cy) || 1, a0 = Math.atan2(y - c.cy, x - c.cx);
      const move = ev => { const [mx, my] = aTela(ev); let dx = mx - x, dy = my - y;
        if (modo === 'mover') { if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; } vivo = { id: c.id, cx: round(v0.cx + dx, 1), cy: round(v0.cy + dy, 1) }; }
        else if (modo === 'tam') vivo = { id: c.id, s: round(Math.max(.03, v0.s * Math.hypot(mx - c.cx, my - c.cy) / d0), 4) };
        else { let r = v0.r + (Math.atan2(my - c.cy, mx - c.cx) - a0) * 180 / Math.PI; r = ((r + 540) % 360) - 180; if (ev.shiftKey) r = Math.round(r / 15) * 15; vivo = { id: c.id, r: round(r, 1) }; }
        desenha(vivo); };
      const sobe = () => { cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', sobe); cv.removeEventListener('pointercancel', sobe); if (vivo) { const { id, ...v } = vivo; muda(id, v); } };
      cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', sobe); cv.addEventListener('pointercancel', sobe);
    });
    cv.addEventListener('mousemove', e => { if (!st.def || e.buttons) return; const [x, y] = aTela(e), c = camada(st.sel);
      if (c && !c.trava) { const [rx, ry] = this.alcaGiro(c); if (Math.hypot(rx - x, ry - y) * K < 10) return cv.style.cursor = 'grab'; if (this.cantosDe(c).some(([a, b]) => Math.hypot(a - x, b - y) * K < 10)) return cv.style.cursor = 'nwse-resize'; }
      cv.style.cursor = acha(x, y)?.trava === false ? 'move' : 'default'; });
    cv.addEventListener('contextmenu', e => { e.preventDefault(); if (!st.def) return; const c = acha(...aTela(e)); if (!c) return; st.sel = c.id; pinta(); menuCamada(e.clientX, e.clientY, c); });
    const tecla = e => {
      if (!cv.isConnected) return document.removeEventListener('keydown', tecla, true);
      if (document.querySelectorAll('.modal-back').length > 1 || document.querySelector('.ctx') || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || !st.def) return;
      const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (ctrl && k === 'z') { e.preventDefault(); e.stopPropagation(); return desfaz(e.shiftKey); }
      if (ctrl && k === 'y') { e.preventDefault(); e.stopPropagation(); return desfaz(true); }
      const c = camada(st.sel); if (!c || st.sel === '__cena') return;
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (d && !c.trava) { e.preventDefault(); e.stopPropagation(); const n = e.shiftKey ? 10 : 1; muda(c.id, { cx: round(c.cx + d[0] * n, 1), cy: round(c.cy + d[1] * n, 1) }); }
      if (e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); muda(c.id, { oculta: true }); }
    };
    document.addEventListener('keydown', tecla, true);
    // soltar imagens: viram camadas novas (só no padrão do cenário)
    cv.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); e.stopPropagation(); } });
    cv.addEventListener('drop', async e => { const fs = [...(e.dataTransfer?.files || [])].filter(f => /^image\//.test(f.type) || /\.svg$/i.test(f.name)); if (!fs.length) return; e.preventDefault(); e.stopPropagation();
      if (!st.def || naCena()) return novoComImagens(fs); const [x, y] = aTela(e), d = await this.deArquivos(fs); if (!d) return; guarda();
      for (const c of d.camadas) { c.s = Math.min(1, 700 / Math.max(c.w, c.h)); c.cx = x; c.cy = y; st.def.camadas.push(c); } st.sel = d.camadas.at(-1).id; pinta(); });
    // ---- novos ----
    const novoComImagens = async fs => { fs = fs || await pickFiles('image/*,.svg', true); if (!fs?.length) return;
      await ocupa('Montando as camadas…', async () => { const d = await this.deArquivos(fs, 'Cenário novo'); if (!d) return; st.pasta = null; st.def = d; st.orig = clone(d); st.sel = null; st.desf = []; st.ref = []; pintaBib(); pinta(); UI.toast('Cada imagem virou uma camada. Arrume e use <b>Salvar na biblioteca</b>.', { kind: 'ok', time: 5000 }); }); };
    $('[data-n="imgs"]', body).onclick = () => novoComImagens();
    $('[data-n="ia"]', body).onclick = () => { api?.close(); setTimeout(() => Cenarios.abrir(), 60); };
    $('[data-n="nuvem"]', body).onclick = () => { api?.close(); setTimeout(() => CenariosNuvem.escolher(), 60); };
    $('[data-n="arq"]', body).onclick = async () => { const [f] = await pickFiles('.cenario,application/json', false); if (!f) return;
      await ocupa('Abrindo o arquivo…', async () => { const j = JSON.parse(await f.text()); if (j?.tipo === 'cenario-animador') { api?.close(); return Cenarios.abrirArquivo(f); } const d = await this.importar(j); meus = await this.meus(); await escolhe(async () => d); UI.toast(`<b>${esc(d.nome)}</b> entrou em Meus cenários.`, { kind: 'ok' }); }); };
    // ---- salvar / exportar / pôr na cena ----
    const salvar = async () => {
      if (!st.def) return; let def = clone(st.def), nome = def.nome;
      if (naCena() || def.origem !== 'meu') { nome = await UI.prompt({ title: 'Salvar na biblioteca (neste computador)', value: def.origem === 'casa' ? def.nome + ' (variação)' : def.nome }); if (!nome?.trim()) return; def = { ...def, id: uid('cen'), nome: nome.trim().slice(0, 40) }; }
      def.origem = 'meu'; def.camadas.forEach(c => { delete c.no; if (naCena()) c.id = slugCen(c.nome) + '-' + uid('c').slice(-4); });
      await ocupa('Salvando…', async () => { await this.salvaMeu(def, await this.miniDe(def)); meus = await this.meus(); if (!naCena()) { st.def = { ...def }; st.mexido = false; } pintaBib(); pintaTopo(); UI.toast(`<b>${esc(def.nome)}</b> está em Meus cenários.`, { kind: 'ok' }); });
    };
    await UI.modal({ title: 'Cenários', icon: 'paisagem', width: 1240, body, sticky: true, noFocus: true,
      onOpen: a => { api = a; a.el.querySelector('.modal').classList.add('cl-modal'); [btSalvar, btExp, , btPor] = a.foot.querySelectorAll('.btn');
        if (st.pasta) escolheCena(st.pasta); else if (o.def) escolhe(async () => o.def); else pintaBib(); pinta(); },
      buttons: [
        { label: 'Salvar na biblioteca', icon: 'save', left: true, onClick: () => { salvar(); return false; } },
        { label: 'Exportar…', icon: 'download', onClick: () => { if (st.def) ocupa('Preparando o arquivo…', () => this.exportar(st.def)); return false; } },
        { label: 'Fechar', value: null, onClick: async () => !st.mexido || naCena() || await UI.confirm({ title: 'Fechar sem salvar?', msg: 'As mudanças no padrão deste cenário não foram salvas nem postas na cena.', ok: 'Fechar' }) || false },
        { label: 'Pôr na cena', kind: 'primary', onClick: async () => { if (!st.def) return false; if (naCena()) return true; let ok = false; await ocupa('Pondo na cena…', async () => { const p = await this.porNaCena(st.def); ok = true; UI.toast(`<b>${esc(st.def.nome)}</b> entrou na cena com ${p.filhos.length} camadas. Botão direito no cenário › <b>Cenário: padrão e keyframes…</b> para mexer.`, { kind: 'ok', time: 6000 }); }); return ok; } },
      ] });
    document.removeEventListener('keydown', tecla, true);
  },
  cantosDe(c) { const s = c.s ?? 1, w = c.w * s / 2, h = c.h * s / 2, a = (c.r || 0) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
    return [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => [c.cx + x * co - y * si, c.cy + x * si + y * co]); },
  alcaGiro(c) { const s = c.s ?? 1, h = c.h * s / 2 + 28, a = (c.r || 0) * Math.PI / 180; return [c.cx + h * Math.sin(a), c.cy - h * Math.cos(a)]; },
});
