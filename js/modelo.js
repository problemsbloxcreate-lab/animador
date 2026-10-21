/* ===================== modelo.js — dados do Animador (projeto, camadas, personagens) e cálculo de cada quadro =====================
   PROJETO
     { v:2, id, nome, w, h, fps, duracao (quadros), fundo, raiz:[nós], camera:{ chaves:{q:{x,y,zoom,r}} },
       efeitos:{ visual, tela:[{id,tipo,de,ate,forca}] }, audios:[{id,nome,arq,de,vol}], legendas:[{de,ate,texto}],
       personagens:{ id: definição (cópia da biblioteca usada no projeto) }, modificado }
   NÓ (camada da hierarquia)
     { id, tipo:'pasta'|'personagem'|'imagem'|'texto', nome, vis, trava, aberto (pasta), filhos:[] (pasta),
       ref (personagem: id da definição), arq (imagem: id do arquivo), texto/cor/tam/fonte (texto),
       de, ate (quadros em que aparece), interp:true|false (intercalar movimento entre chaves),
       chaves:{ q: { x,y,r,s,sx,op, sessoes:{ sessaoId: presetId }, partes:{ parteId:{ x,y,r,s,sx,img,vis } } } } }
     A pasta também tem chaves de x/y/r/s/op: mexer nela mexe em tudo dentro (como um "pegbar").
   PERSONAGEM (biblioteca)
     { v:2, id, nome, pasta, thumb, partes:[{ id, nome, pai, z, encaixe:{x,y}, imgs:[{ id, nome, k, w, h, pivo:{x,y}, ajuste:{x,y} }],
       base:{ img, x,y,r,s,sx, vis } }], sessoes:[{ id, nome, partes:[ids], presets:[{ id, nome, estado:{ parteId:{...} } }] }] }
     Cada parte encaixa no PIVÔ do pai (ponto "encaixe", nas coordenadas do pai). Trocar a imagem não tira a parte do lugar,
     porque o encaixe não depende da imagem; se uma imagem ficar desalinhada, o "ajuste" dela corrige só ela. */
'use strict';

const Modelo = {
  TRANSF: ['x', 'y', 'r', 's', 'sx', 'op'],
  novoProjeto(o = {}) {
    const w = o.w || 1920, h = o.h || 1080;
    return { v: 2, id: uid('p'), nome: o.nome || 'Animação nova', w, h, fps: o.fps || 24, duracao: o.duracao || 72, fundo: o.fundo || '#ffffff',
      raiz: [], camera: { chaves: { 0: { x: w / 2, y: h / 2, zoom: 1, r: 0 } } }, efeitos: { visual: 'normal', tela: [] },
      audios: [], legendas: [], personagens: {}, modificado: Date.now() };
  },
  novoNo(tipo, o = {}) {
    const n = { id: uid('n'), tipo, nome: o.nome || { pasta: 'Pasta', personagem: 'Personagem', imagem: 'Imagem', texto: 'Texto', efeito: 'Efeito' }[tipo], vis: true, trava: false,
      de: o.de ?? 0, ate: o.ate ?? null, interp: tipo !== 'personagem' ? true : true, chaves: { [o.de ?? 0]: { x: o.x ?? 0, y: o.y ?? 0, r: 0, s: o.s ?? 1, sx: 1, op: 1 } } };
    if (tipo === 'pasta') { n.filhos = []; n.aberto = true; }
    if (tipo === 'personagem') n.ref = o.ref;
    if (tipo === 'imagem') n.arq = o.arq;
    if (tipo === 'efeito') { n.efeitos = o.efeitos || []; n.nomeAuto = true; }
    if (tipo === 'texto') Object.assign(n, { texto: o.texto || 'Texto', cor: '#111111', tam: 72, fonte: 'Segoe UI', borda: '#ffffff', bordaL: 0, negrito: true });
    return n;
  },
  novoPersonagem(nome = 'Personagem novo') {
    return { v: 2, id: slugId(nome), nome, pasta: 'Personagens', thumb: null, partes: [], sessoes: [], modificado: Date.now() };
  },
  novaParte(nome, pai = null) {
    return { id: uid('pt'), nome, pai, z: 0, encaixe: { x: 0, y: 0 }, imgs: [], base: { img: null, x: 0, y: 0, r: 0, s: 1, sx: 1, vis: true } };
  },

  /* ---------- percorrer a árvore ---------- */
  cada(lista, fn, pai = null, nivel = 0) { for (const n of lista) { if (fn(n, pai, nivel) === false) return false; if (n.filhos && Modelo.cada(n.filhos, fn, n, nivel + 1) === false) return false; } },
  achar(P, id) { let a = null, pai = null; Modelo.cada(P.raiz, (n, p) => { if (n.id === id) { a = n; pai = p; return false; } }); return a ? { no: a, pai, lista: pai ? pai.filhos : P.raiz } : null; },
  todos(P) { const out = []; Modelo.cada(P.raiz, n => { out.push(n); }); return out; },
  ancestrais(P, id) { const out = []; let r = Modelo.achar(P, id); while (r && r.pai) { out.unshift(r.pai); r = Modelo.achar(P, r.pai.id); } return out; },
  // nós na ordem da lista (de cima para baixo), com o nível: é a ordem da hierarquia e das linhas da timeline
  linhas(P) { const out = []; const vai = (lista, nivel) => { for (const n of lista) { out.push({ no: n, nivel }); if (n.filhos && n.aberto !== false) vai(n.filhos, nivel + 1); } }; vai(P.raiz, 0); return out; },

  /* ---------- chaves ---------- */
  ultimoQuadro(P) { return Math.max(0, (P.duracao || 1) - 1); },
  fimNo(P, n) { return n.ate == null ? Modelo.ultimoQuadro(P) : n.ate; },
  aparece(P, n, q) { return q >= (n.de || 0) && q <= Modelo.fimNo(P, n); },
  quadrosChave(n) { return Object.keys(n.chaves || {}).map(Number).sort((a, b) => a - b); },
  // transformação no quadro q: segura a última chave (ou intercala até a próxima, se interp)
  transf(n, q) {
    const ks = Modelo.quadrosChave(n), base = { x: 0, y: 0, r: 0, s: 1, sx: 1, op: 1 };
    if (!ks.length) return base;
    const out = { ...base };
    for (const c of Modelo.TRANSF) {
      let a = null, b = null;
      for (const k of ks) { const v = n.chaves[k][c]; if (v == null) continue; if (k <= q) a = [k, v]; else { b = [k, v]; break; } }
      if (!a && b) { out[c] = b[1]; continue; }
      if (!a) continue;
      if (b && n.interp && c !== 'sx') { const t = (q - a[0]) / (b[0] - a[0]); out[c] = a[1] + (b[1] - a[1]) * Ease.inOut(t); } else out[c] = a[1];
    }
    return out;
  },
  // escolhas do personagem no quadro q (sessões e ajustes de parte seguram até a próxima chave)
  estadoPersonagem(n, q) {
    const ks = Modelo.quadrosChave(n), sessoes = {}, partes = {};
    for (const k of ks) { if (k > q) break; const c = n.chaves[k]; if (c.sessoes) Object.assign(sessoes, c.sessoes); if (c.partes) for (const [pid, v] of Object.entries(c.partes)) partes[pid] = v === null ? undefined : { ...(partes[pid] || {}), ...v }; }
    return { sessoes, partes };
  },
  chave(n, q, criar = true) { if (!n.chaves) n.chaves = {}; if (!n.chaves[q] && criar) n.chaves[q] = {}; return n.chaves[q]; },
  // grava uma transformação na chave do quadro q (criando a chave com o valor atual, para não pular)
  poeTransf(n, q, vals) { const atual = Modelo.transf(n, q), k = Modelo.chave(n, q); for (const c of Modelo.TRANSF) if (k[c] == null) k[c] = atual[c]; Object.assign(k, vals); },

  /* ---------- personagem: estado de cada parte e matriz (ordem de desenho) ---------- */
  // estado final das partes = base → presets das sessões escolhidas → ajustes da chave
  partesNoEstado(def, escolhas) {
    const est = {};
    for (const p of def.partes) est[p.id] = { ...p.base };
    for (const s of def.sessoes || []) {
      const pid = escolhas?.sessoes?.[s.id]; if (!pid) continue;
      const pr = s.presets.find(x => x.id === pid); if (!pr) continue;
      for (const [parte, e] of Object.entries(pr.estado || {})) if (est[parte]) Object.assign(est[parte], e);
    }
    for (const [parte, e] of Object.entries(escolhas?.partes || {})) if (est[parte] && e) Object.assign(est[parte], e);
    return est;
  },
  // devolve [{ parte, img, m:DOMMatrix (do pivô da parte), z }] na ordem de desenho
  montar(def, est, m0 = new DOMMatrix()) {
    const porId = Object.fromEntries(def.partes.map(p => [p.id, p])), cache = {};
    const mat = (pid, guarda = 0) => {
      if (cache[pid]) return cache[pid]; const p = porId[pid]; if (!p || guarda > 40) return m0;
      const e = est[pid] || p.base, pai = p.pai && porId[p.pai] ? mat(p.pai, guarda + 1) : m0;
      const m = pai.translate(p.encaixe?.x || 0, p.encaixe?.y || 0).translate(e.x || 0, e.y || 0).rotate(e.r || 0).scale((e.s ?? 1) * (e.sx || 1), e.s ?? 1);
      cache[pid] = m; return m;
    };
    const out = [];
    for (const p of def.partes) {
      const e = est[p.id] || p.base; if (e.vis === false) continue;
      const img = p.imgs.find(i => i.id === e.img) || null;
      out.push({ parte: p, img, m: mat(p.id), z: (p.z || 0) + (e.z || 0) });
    }
    return out.sort((a, b) => a.z - b.z);
  },
  // caixa (em coordenadas locais do personagem) para seleção
  caixaPersonagem(def, est) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const it of Modelo.montar(def, est)) {
      if (!it.img) continue; const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2, ax = it.img.ajuste?.x || 0, ay = it.img.ajuste?.y || 0;
      for (const [x, y] of [[0, 0], [it.img.w, 0], [0, it.img.h], [it.img.w, it.img.h]]) { const p = it.m.transformPoint(new DOMPoint(x - px + ax, y - py + ay)); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    }
    return isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: -60, y: -120, w: 120, h: 240 };
  },
  // personagens que aparecem no quadro q (para a lista "No quadro")
  noQuadro(P, q) {
    const out = [];
    const vai = (lista, visivel) => { for (const n of lista) { const v = visivel && n.vis !== false && Modelo.aparece(P, n, q); if (n.tipo === 'personagem' && v && P.personagens[n.ref]) out.push(n); if (n.filhos) vai(n.filhos, v); } };
    vai(P.raiz, true); return out;
  },
  camera(P, q) {
    const ks = Object.keys(P.camera.chaves).map(Number).sort((a, b) => a - b), out = { x: P.w / 2, y: P.h / 2, zoom: 1, r: 0 };
    for (const c of ['x', 'y', 'zoom', 'r']) {
      let a = null, b = null; for (const k of ks) { const v = P.camera.chaves[k][c]; if (v == null) continue; if (k <= q) a = [k, v]; else { b = [k, v]; break; } }
      if (!a && b) out[c] = b[1]; else if (a && b) out[c] = a[1] + (b[1] - a[1]) * Ease.inOut((q - a[0]) / (b[0] - a[0])); else if (a) out[c] = a[1];
    }
    return out;
  },
};
function slugId(s) { return (String(s || 'personagem').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'personagem') + '-' + Math.random().toString(36).slice(2, 6); }

/* ---------- banco do navegador (projetos e arquivos) ---------- */
const DB = (() => {
  let db = null;
  const abre = () => db || (db = new Promise((ok, no) => {
    const r = indexedDB.open('animador-v2', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('projetos', { keyPath: 'id' }); d.createObjectStore('arquivos'); d.createObjectStore('personagens', { keyPath: 'id' }); };
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  }));
  const op = async (loja, modo, fn) => { const d = await abre(); return new Promise((ok, no) => { const t = d.transaction(loja, modo), q = fn(t.objectStore(loja)); t.oncomplete = () => ok(q?.result); t.onerror = () => no(t.error); }); };
  return {
    get: (l, k) => op(l, 'readonly', s => s.get(k)), put: (l, v, k) => op(l, 'readwrite', s => k === undefined ? s.put(v) : s.put(v, k)),
    del: (l, k) => op(l, 'readwrite', s => s.delete(k)), all: l => op(l, 'readonly', s => s.getAll()), keys: l => op(l, 'readonly', s => s.getAllKeys()),
  };
})();

/* ---------- arquivos (imagens e áudios) : guardados no navegador; imagens viram ImageBitmap na memória ---------- */
const Arq = {
  img: new Map(), blob: new Map(), carregando: new Map(),
  async guardar(blob, id = uid('a')) { await DB.put('arquivos', blob, id); this.blob.set(id, blob); return id; },
  async pegaBlob(id) { if (this.blob.has(id)) return this.blob.get(id); const b = await DB.get('arquivos', id); if (b) this.blob.set(id, b); return b || null; },
  // imagem pronta para desenhar (null enquanto carrega; avisa quando chegar)
  bitmap(id, aoChegar) {
    if (!id) return null; if (this.img.has(id)) return this.img.get(id);
    if (!this.carregando.has(id)) this.carregando.set(id, (async () => {
      let b = await this.pegaBlob(id);
      if (!b && /^personagens\//.test(id)) b = await Nuvem.baixar(id).catch(() => null); // imagem de personagem: da nuvem da equipe
      if (!b) return null;
      const bm = await createImageBitmap(b).catch(() => null); if (bm) this.img.set(id, bm); return bm;
    })().then(bm => { this.carregando.delete(id); aoChegar?.(bm); return bm; }));
    return null;
  },
  async garantir(ids) { await Promise.all([...new Set(ids.filter(Boolean))].map(id => new Promise(ok => { if (this.bitmap(id, ok)) ok(); }))); },
};
