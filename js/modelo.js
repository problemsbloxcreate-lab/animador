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
       base:{ img, x,y,r,s,sx, vis, d:{ imgId:{x,y} } } }],   (d = posição da imagem só na base/naquele preset) sessoes:[{ id, nome, partes:[ids], presets:[{ id, nome, estado:{ parteId:{...} } }] }],
       raiz (id da parte principal), animacoes:[{ id, nome, vel (ms por passo), trilhas:[[ passo:{ s:{sessaoId:presetId}, p:{parteId:{img,r}} } ]] }],
       vis:{ fundo:'xadrez'|'branco'|'cenario', fantasma:{ k, w, h, x, y, s, op, on } }, autor, edicoes }
     Cada parte encaixa no PIVÔ do pai (ponto "encaixe", nas coordenadas do pai). Trocar a imagem não tira a parte do lugar,
     porque o encaixe não depende da imagem; se uma imagem ficar desalinhada, o "ajuste" dela corrige só ela. */
'use strict';

const Modelo = {
  TRANSF: ['x', 'y', 'r', 's', 'sx', 'op'],
  novoProjeto(o = {}) {
    const w = o.w || 1920, h = o.h || 1080;
    return { v: 2, id: uid('p'), nome: o.nome || 'Animação nova', w, h, fps: o.fps || 24, duracao: o.duracao || 72, fundo: o.fundo || '#ffffff',
      raiz: [], camera: { chaves: { 0: { x: w / 2, y: h / 2, zoom: 1, r: 0 } } }, efeitos: { visual: 'normal', tela: [] },
      audios: [], legendas: [], personagens: {}, modificado: Date.now(), nuvemAuto: true, /* animação nova vai sozinha para a nuvem da equipe (js/nuvemanim.js) */ ...(o.semFundo ? {} : { raiz: [Modelo.fundoPadrao(w, h, o.fundo)] }) };
  },
  // a folha branca do tamanho da câmera vira uma camada de verdade (dá para mudar cor, tamanho, mover ou apagar)
  fundoPadrao(w, h, cor) { const n = Modelo.novoNo('forma', { nome: 'Fundo padrão', forma: 'ret', w, h, cor: cor || '#ffffff', x: w / 2, y: h / 2 }); n.fundoPadrao = true; return n; },
  novoNo(tipo, o = {}) {
    const n = { id: uid('n'), tipo, nome: o.nome || { pasta: 'Pasta', personagem: 'Personagem', imagem: 'Imagem', texto: 'Texto', efeito: 'Efeito', forma: 'Forma' }[tipo], vis: true, trava: false,
      de: o.de ?? 0, ate: o.ate ?? null, interp: tipo !== 'personagem' ? true : true, chaves: { [o.de ?? 0]: { x: o.x ?? 0, y: o.y ?? 0, r: 0, s: o.s ?? 1, sx: 1, op: 1 } } };
    if (tipo === 'pasta') { n.filhos = []; n.aberto = true; }
    if (tipo === 'personagem') n.ref = o.ref;
    if (tipo === 'imagem') n.arq = o.arq;
    if (tipo === 'efeito') { n.efeitos = o.efeitos || []; n.nomeAuto = true; }
    if (tipo === 'forma') Object.assign(n, { forma: o.forma || 'ret', w: o.w || 400, h: o.h || 400, cor: o.cor || '#4a90e2', borda: o.borda || '#111111', bordaL: o.bordaL ?? 0, raio: o.raio ?? 0 });
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
  // intercala entre as chaves a e b ([quadro, valor]) com ease; a chave a pode guardar curva[c] = [t0, t1] = só um pedaço da curva
  // original (a IA mudou só um trecho: a chave que segura a borda do trecho continua a mesma curva de antes, sem degrau)
  mistura(ch, a, b, c, q) {
    // a curva é a da chave de CHEGADA (b.ir: suave, linear, freando, corte seco, curva própria…; js/util.js Ease.daChave)
    const t = (q - a[0]) / (b[0] - a[0]), cv = ch[a[0]]?.curva?.[c], E = Ease.daChave(ch[b[0]]); let e = E(t);
    if (cv) { const e0 = E(cv[0]), e1 = E(cv[1]); e = Math.abs(e1 - e0) < 1e-9 ? t : (E(cv[0] + (cv[1] - cv[0]) * t) - e0) / (e1 - e0); }
    return a[1] + (b[1] - a[1]) * e;
  },
  // ENTRADA e SAÍDA da camada (como os "pop"/"carimbo" dos textos dos Shorts): n.entra / n.sai = { tipo, q (quadros) }.
  // Só no desenho (Render): as chaves nunca guardam esses valores. Saída só quando a camada tem fim (n.ate).
  ANIMS: { pop: 'Pop', carimbo: 'Carimbo', aparecer: 'Aparecer', subir: 'Subir', descer: 'Descer', girar: 'Girar', esticar: 'Esticar' },
  transfVis(n, q) {
    const t = Modelo.transf(n, q), um = (o, u) => { // u = 0 (escondido) → 1 (normal)
      if (!o?.tipo || u >= 1) return; const k = clamp(u, 0, 1), e = Ease.out(k);
      if (o.tipo === 'pop') { t.s *= Ease.back(k) || .001; t.op *= Math.min(1, k * 3); }
      else if (o.tipo === 'carimbo') { t.s *= 2.2 - 1.2 * e; t.op *= Math.min(1, k * 2.5); }
      else if (o.tipo === 'aparecer') t.op *= e;
      else if (o.tipo === 'subir') { t.y += (1 - e) * 90; t.op *= e; }
      else if (o.tipo === 'descer') { t.y -= (1 - e) * 90; t.op *= e; }
      else if (o.tipo === 'girar') { t.r += (1 - Ease.back(k)) * -120; t.s *= Math.max(.001, e); }
      else if (o.tipo === 'esticar') { t.s *= Math.max(.001, Ease.elastic(k)); }
    };
    if (n.entra?.tipo) um(n.entra, (q - (n.de || 0) + 1) / Math.max(1, n.entra.q || 6));
    if (n.sai?.tipo && n.ate != null) um(n.sai, (n.ate - q + 1) / Math.max(1, n.sai.q || 6));
    return t;
  },
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
      if (b && n.interp && c !== 'sx') out[c] = Modelo.mistura(n.chaves, a, b, c, q); else out[c] = a[1];
    }
    return out;
  },
  // COR E LUZ da camada no quadro q (chave.fx = { luz, con, sat, mat }: iluminação/contraste/saturação em %, matiz em graus).
  // Vai mudando entre as chaves como x/y (ou segura, sem interp). Usado nas camadas dos cenários em camadas (js/cenlib.js);
  // vale para qualquer camada e para a pasta (a da pasta soma por cima das de dentro). null = sem ajuste.
  FX0: { luz: 100, con: 100, sat: 100, mat: 0 },
  fxNo(n, q) {
    const ks = Modelo.quadrosChave(n).filter(k => n.chaves[k].fx); if (!ks.length) return null;
    const out = { ...Modelo.FX0 }; let algum = false;
    for (const c of Object.keys(Modelo.FX0)) {
      let a = null, b = null; for (const k of ks) { const v = n.chaves[k].fx[c]; if (v == null) continue; if (k <= q) a = [k, v]; else { b = [k, v]; break; } }
      if (!a && b) out[c] = b[1]; else if (a && b && n.interp) out[c] = Modelo.mistura(n.chaves, a, b, c, q); else if (a) out[c] = a[1]; else continue; algum = true;
    }
    return algum && Object.keys(Modelo.FX0).some(c => Math.abs(out[c] - Modelo.FX0[c]) > .01) ? out : null;
  },
  filtroFx(f) { return f ? `brightness(${f.luz / 100}) contrast(${f.con / 100}) saturate(${f.sat / 100}) hue-rotate(${f.mat}deg)` : ''; },
  // escolhas do personagem no quadro q (sessões e ajustes de parte seguram até a próxima chave)
  estadoPersonagem(n, q) {
    const ks = Modelo.quadrosChave(n), sessoes = {}, partes = {}; let vista = null;
    for (const k of ks) { if (k > q) break; const c = n.chaves[k]; if (c.vista !== undefined) vista = c.vista; if (c.sessoes) Object.assign(sessoes, c.sessoes); if (c.partes) for (const [pid, v] of Object.entries(c.partes)) partes[pid] = v === null ? undefined : { ...(partes[pid] || {}), ...v }; }
    return { sessoes, partes, vista };
  },
  chave(n, q, criar = true) { if (!n.chaves) n.chaves = {}; if (!n.chaves[q] && criar) n.chaves[q] = {}; return n.chaves[q]; },
  // grava uma transformação na chave do quadro q (criando a chave com o valor atual, para não pular)
  poeTransf(n, q, vals) { const atual = Modelo.transf(n, q), k = Modelo.chave(n, q); for (const c of Modelo.TRANSF) if (k[c] == null) k[c] = atual[c]; Object.assign(k, vals); },

  /* ---------- VISTAS (ângulos): frente, três-quartos, lado, costas… ----------
     Cada vista é um conjunto próprio de partes, sessões/poses, animações de teste, raiz e visualização.
     A vista ativa fica no próprio def (def.partes, def.sessoes…, como sempre); as outras ficam guardadas em def.vistas
     ({ id, nome, tipo, partes, sessoes, animacoes, raiz, vis }). A entrada da vista ativa em def.vistas só tem id/nome/tipo.
     Sessões, presets e partes com o MESMO nome nas vistas usam o MESMO id: no editor, trocar de vista mantém as poses escolhidas. */
  TIPOS_VISTA: [['frente', 'Frente'], ['tres-quartos', 'Três-quartos'], ['lado', 'Lado'], ['tres-quartos-costas', 'Três-quartos de costas'], ['costas', 'Costas'], ['cima', 'De cima'], ['outra', 'Outra']],
  nomeTipo(t) { return (Modelo.TIPOS_VISTA.find(x => x[0] === t) || [, 'Vista'])[1]; },
  CAMPOS_VISTA: ['partes', 'sessoes', 'animacoes', 'raiz', 'vis'],
  // garante que o personagem tem a lista de vistas (personagens antigos: a vista que já existe vira a 1ª)
  // FPS DO PERSONAGEM (def.fps, padrão 24 = o do Animador) e o tempo de cada frame das animações de teste em QUADROS (a.q, inteiro).
  // a.vel (ms) continua existindo, sempre igual a q quadros nesse fps, para tudo que toca/mostra usar como antes.
  FPS_PADRAO: 24,
  fpsDe(def) { const f = +def?.fps; return f >= 1 && f <= 120 ? f : Modelo.FPS_PADRAO; },
  todasAnims(def) { return [...(def?.animacoes || []), ...(def?.vistas || []).filter(v => v.id !== def.vistaAtual).flatMap(v => v.animacoes || [])]; },
  // q faltando (animação antiga ou que a IA fez em ms) = o nº de quadros mais perto do tempo; depois a.vel = q quadros
  sincAnims(def) { if (!def) return def; const fps = Modelo.fpsDe(def);
    for (const a of Modelo.todasAnims(def)) { if (!(+a.q >= 1) || (a._fps && a._fps !== fps)) a.q = Math.max(1, Math.round((+a.vel || 250) / 1000 * fps)); a.q = Math.min(240, Math.round(+a.q)); a.vel = Math.round(a.q * 1000 / fps); delete a._fps; }
    return def; },
  // mudar o fps do personagem: o TEMPO de cada frame fica (o nº de quadros é recalculado)
  trocaFps(def, fps) { fps = Math.round(clamp(+fps || Modelo.FPS_PADRAO, 1, 120)); for (const a of Modelo.todasAnims(def)) a.q = Math.max(1, Math.round((+a.vel || 250) / 1000 * fps)); def.fps = fps; return Modelo.sincAnims(def); },
  garanteVistas(def) {
    // conserta o que já chegou estragado (listas que viraram objeto, duas vistas com o mesmo id, a ativa sumida) SEM jogar fora nenhuma parte/preset
    const lista = x => Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : x;
    if (def.vistas && !Array.isArray(def.vistas)) def.vistas = lista(def.vistas);
    for (const c of ['partes', 'sessoes', 'animacoes']) if (def[c] && !Array.isArray(def[c])) def[c] = lista(def[c]);
    if (def.vistas?.length) {
      const vistos = new Set(); def.vistas = def.vistas.filter(v => v && typeof v === 'object');
      let n = 0; for (const v of def.vistas) { n++; if (!v.id || vistos.has(v.id)) { let id = (v.id || 'vi') + '-' + n; while (vistos.has(id)) id += 'x'; v.id = id; } vistos.add(v.id); /* id novo SEM sorteio: ao vivo todos consertam igual */ for (const c of ['partes', 'sessoes', 'animacoes']) if (v[c] && !Array.isArray(v[c])) v[c] = lista(v[c]); }
      if (!def.vistas.some(v => v.id === def.vistaAtual)) { // a ativa sumiu: é a entrada sem partes (a da ativa só tem id/nome/tipo); se não houver, vira uma vista nova
        const vazia = def.vistas.find(v => !v.partes); if (vazia) def.vistaAtual = vazia.id; else { let id = def.vistaAtual || 'vi-ativa'; while (vistos.has(id)) id += 'x'; def.vistas.unshift({ id, nome: 'Vista', tipo: 'frente' }); def.vistaAtual = id; } }
      return def;
    }
    const t = /tr[eê]s.?quartos|3\/4/i.test(def.nome || '') ? 'tres-quartos' : /\blado\b|perfil/i.test(def.nome || '') ? 'lado' : /costas/i.test(def.nome || '') ? 'costas' : 'frente';
    const id = uid('vi'); def.vistas = [{ id, nome: Modelo.nomeTipo(t), tipo: t }]; def.vistaAtual = id; return def;
  },
  // o personagem visto de uma vista (para desenhar no editor); sem vista = a ativa
  // sem vista escolhida = a 1ª da lista (a "principal"; dá para mudar arrastando as vistas no Ateliê)
  naVista(def, id) {
    if (!id) id = def?.vistas?.[0]?.id;
    if (!def || !id || !def.vistas || id === def.vistaAtual) return def;
    const v = def.vistas.find(x => x.id === id); if (!v || !v.partes) return def;
    return { ...def, partes: v.partes, sessoes: v.sessoes || [], animacoes: v.animacoes || [], raiz: v.raiz, vis: v.vis, _vista: v.id };
  },
  vistaDe(def, id = def?.vistaAtual) { return def?.vistas?.find(v => v.id === id) || null; },
  // troca a vista ativa (guarda a atual na lista e traz a outra para o def)
  ativaVista(def, id) {
    Modelo.garanteVistas(def); if (id === def.vistaAtual) return def;
    const cur = def.vistas.find(v => v.id === def.vistaAtual), tgt = def.vistas.find(v => v.id === id); if (!tgt) return def;
    for (const c of Modelo.CAMPOS_VISTA) { cur[c] = def[c]; def[c] = tgt[c] ?? (c === 'raiz' || c === 'vis' ? undefined : []); delete tgt[c]; }
    if (def.raiz === undefined) delete def.raiz; if (def.vis === undefined) delete def.vis; def.vistaAtual = id; return def;
  },
  // todas as partes de todas as vistas (para baixar, mandar para a nuvem, backup…)
  todasPartes(def) { return [...(def?.partes || []), ...(def?.vistas || []).filter(v => v.id !== def.vistaAtual).flatMap(v => v.partes || [])]; },
  // máscaras de APAGADO só num keyframe (ap: { idDaImagem: { k, x, y } } nos passos/presets, e def.apKeys as que foram para chaves do editor)
  chavesAp(o, out = []) { if (o && typeof o === 'object') for (const [c, v] of Object.entries(o)) { if (c === 'ap' && v && typeof v === 'object') { for (const m of Object.values(v)) if (m?.k) out.push(m.k); } else if (v && typeof v === 'object') Modelo.chavesAp(v, out); } return out; },
  chavesImgs(def) { return [...new Set([...Modelo.chavesAp(def), ...(def?.apKeys || []), ...Modelo.todasPartes(def).flatMap(p => p.imgs.flatMap(i => [i.k, ...(i.camadas || []).map(c => c.k)])), def?.vis?.fantasma?.k, ...(def?.vistas || []).map(v => v.vis?.fantasma?.k), ...(def?.refsAnim || []).map(r => r.k)].filter(Boolean))]; },
  // a vista onde está uma animação de teste
  vistaDaAnim(def, animId) { if ((def.animacoes || []).some(a => a.id === animId)) return def._vista || def.vistaAtual || null; return (def.vistas || []).find(v => (v.animacoes || []).some(a => a.id === animId))?.id || null; }, // def visto de uma vista (naVista) = ESSA vista, não a ativa do Ateliê
  // usa os mesmos ids das outras vistas para o que tem o mesmo nome (sessões, presets, partes, imagens, animações)
  alinhaIds(def) {
    Modelo.garanteVistas(def); const outras = def.vistas.filter(v => v.id !== def.vistaAtual && v.partes); if (!outras.length) return 0;
    const n = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(), mapa = {}, usados = new Set(), poe = (velho, novo) => { if (velho !== novo && novo && !usados.has(novo)) { mapa[velho] = novo; usados.add(novo); } };
    const ref = (lista, nome) => { for (const v of outras) { const x = (v[lista] || []).find(y => n(y.nome) === n(nome)); if (x) return x; } return null; };
    const meus = new Set([...def.partes.map(p => p.id), ...def.sessoes.map(s => s.id)]);
    for (const p of def.partes) { const o = ref('partes', p.nome); if (o && !meus.has(o.id)) { poe(p.id, o.id); for (const i of p.imgs) { const oi = o.imgs.find(y => n(y.nome) === n(i.nome)); if (oi) poe(i.id, oi.id); } } }
    for (const s of def.sessoes) { const o = ref('sessoes', s.nome); if (o && !meus.has(o.id)) { poe(s.id, o.id); for (const pr of s.presets) { const op = o.presets.find(y => n(y.nome) === n(pr.nome)); if (op) poe(pr.id, op.id); } } }
    for (const a of def.animacoes || []) { const o = ref('animacoes', a.nome); if (o) poe(a.id, o.id); }
    const ks = Object.keys(mapa); if (!ks.length) return 0;
    let txt = JSON.stringify(Object.fromEntries(Modelo.CAMPOS_VISTA.map(c => [c, def[c]]))); for (const k of ks) txt = txt.split(`"${k}"`).join(`"${mapa[k]}"`);
    Object.assign(def, JSON.parse(txt)); return ks.length;
  },
  // o mesmo personagem espelhado (para fazer o outro lado): a raiz (ou as partes soltas) vira de costas no X
  espelhar(campos) { const raizes = campos.partes.filter(p => campos.raiz ? p.id === campos.raiz : !p.pai); for (const p of raizes) p.base.sx = -(p.base.sx || 1); return campos; },

  /* ---------- personagem: estado de cada parte e matriz (ordem de desenho) ---------- */
  // estado final das partes = base → presets das sessões escolhidas → ajustes da chave
  partesNoEstado(def, escolhas) {
    const est = {};
    for (const p of def.partes) est[p.id] = { ...p.base };
    const tocou = new Set();
    for (const s of def.sessoes || []) {
      const pid = escolhas?.sessoes?.[s.id]; if (!pid) continue;
      const pr = s.presets.find(x => x.id === pid); if (!pr) continue;
      // d = posição de cada imagem SÓ naquele preset: a da base não vale dentro de um preset que mexe na parte
      for (const [parte, e] of Object.entries(pr.estado || {})) if (est[parte]) { if (!tocou.has(parte)) { delete est[parte].d; tocou.add(parte); } Object.assign(est[parte], e); }
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
      const img = p.imgs.find(i => i.id === e.img) || null, dd = img && e.d?.[img.id], mp = mat(p.id);
      // m = onde a imagem é desenhada (com o "d" desta imagem neste preset) · mp = a parte (as filhas encaixam nela, sem o d)
      out.push({ parte: p, img, cor: def.corInterna || null, ap: (img && e.ap?.[img.id]) || null, m: dd ? mp.translate(dd.x || 0, dd.y || 0) : mp, mp, z: (p.z || 0) + (e.z || 0) + (img?.z || 0) }); // img.z: camada só daquela imagem (ex.: braço de trás que fica por cima do corpo só na pose base)
    }
    return out.sort((a, b) => a.z - b.z);
  },
  // caixa (em coordenadas locais do personagem) para seleção
  caixaPersonagem(def, est) {
    if (typeof Rig !== 'undefined') { const b = Rig.caixaDe(def, est); if (b) return b; } // só onde tem tinta (as peças vêm no tamanho da folha inteira)
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
    const ks = Object.keys(P.camera.chaves).map(Number).sort((a, b) => a - b), out = { x: P.w / 2, y: P.h / 2, zoom: 1, r: 0, tremor: 0 };
    for (const c of ['x', 'y', 'zoom', 'r', 'tremor']) {
      let a = null, b = null; for (const k of ks) { const v = P.camera.chaves[k][c]; if (v == null) continue; if (k <= q) a = [k, v]; else { b = [k, v]; break; } }
      if (!a && b) out[c] = b[1]; else if (a && b) out[c] = Modelo.mistura(P.camera.chaves, a, b, c, q); else if (a) out[c] = a[1];
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
  img: new Map(), blob: new Map(), carregando: new Map(), avisar: new Map(),
  async guardar(blob, id = uid('a')) { await DB.put('arquivos', blob, id); this.blob.set(id, blob); return id; },
  async pegaBlob(id) { if (this.blob.has(id)) return this.blob.get(id); const b = await DB.get('arquivos', id); if (b) this.blob.set(id, b); return b || null; },
  // imagem pronta para desenhar (null enquanto carrega; avisa TODO MUNDO que pediu quando chegar —
  // antes só o primeiro que pediu era avisado, e a tela ficava sem a imagem até alguém clicar)
  bitmap(id, aoChegar) {
    if (!id) return null; if (this.img.has(id)) return this.img.get(id);
    if (aoChegar) { const l = this.avisar.get(id) || new Map(), k = String(aoChegar); l.set(/native code/.test(k) ? aoChegar : k, aoChegar); this.avisar.set(id, l); } // o mesmo pedido repetido (ex.: redesenhar) conta uma vez só
    if (!this.carregando.has(id)) this.carregando.set(id, (async () => {
      let b = await this.pegaBlob(id);
      if (!b && /^personagens\//.test(id)) b = await Nuvem.baixar(id).catch(() => null); // imagem de personagem: da nuvem da equipe
      if (!b && /^cenarios\/[a-z0-9-]+\/camadas\//.test(id)) { b = await fetch(id).then(r => r.ok ? r.blob() : null).catch(() => null); if (b) { await DB.put('arquivos', b, id).catch(() => { }); this.blob.set(id, b); } } // camada de um cenário da casa (js/cenlib.js): vem do site
      if (!b) return null;
      const bm = await this.deBlob(b, id); if (bm) this.img.set(id, bm); return bm;
    })().then(bm => { this.carregando.delete(id); const l = this.avisar.get(id); this.avisar.delete(id); l?.forEach(f => { try { f(bm); } catch (e) { console.error(e); } }); return bm; }));
    return null;
  },
  // blob → imagem para desenhar (SVG vira <img> de vetor: o navegador desenha no tamanho da tela, sem perder qualidade)
  async deBlob(b, k) {
    let svg = typeof Vetor !== 'undefined' && (Vetor.eh(k) || b.type === 'image/svg+xml');
    if (!svg && typeof Vetor !== 'undefined' && (!b.type || b.type === 'application/octet-stream')) { try { svg = /<svg[\s>]/i.test(await b.slice(0, 600).text()); } catch { } } // veio de um .animador (zip): o arquivo não traz o tipo
    return svg ? Vetor.imagem(b) : createImageBitmap(b).catch(() => null); },
  // a imagem com o APAGADO daquele keyframe (máscara recortada: só a área apagada, posição em pixels da imagem). Fica guardada em memória
  // (uma por imagem+máscara) e refaz sozinha se a imagem mudar (ex.: prévia do pincel). Sem máscara (ou carregando) = a imagem normal.
  apCache: new Map(),
  comAp(bm, it, aoChegar) {
    const tr = it?.troca?.length && typeof Controles !== 'undefined', sv = tr && typeof Vetor !== 'undefined' && Vetor.eh(it.img?.k);
    bm = sv ? Controles.comTroca(bm, it, aoChegar) /* SVG: troca de cor dos controles (já com a cor interna) */ : this.comCor(bm, it, aoChegar); if (tr && !sv) bm = Controles.comTroca(bm, it, aoChegar); // COR INTERNA do personagem (def.corInterna / cor do personagem no editor), antes do apagado
    const ap = it?.ap; if (!bm || !ap?.k) return bm; if (typeof Vetor !== 'undefined' && Vetor.eh(ap.k) && Vetor.eh(it.img.k)) return Vetor.comAp(bm, it, aoChegar); /* keyframe de imagem SVG: o apagado também é vetor */ const m = this.bitmap(ap.k, aoChegar); if (!m) return bm;
    const ch = it.img.k + '|' + ap.k + '|' + ap.x + '|' + ap.y, c = this.apCache.get(ch); if (c && c.src === bm) return c.cv;
    const cv = document.createElement('canvas'); cv.width = bm.width; cv.height = bm.height; const x = cv.getContext('2d'); x.drawImage(bm, 0, 0); x.globalCompositeOperation = 'destination-out'; x.drawImage(m, ap.x || 0, ap.y || 0);
    this.apCache.set(ch, { cv, src: bm }); if (this.apCache.size > 160) this.apCache.delete(this.apCache.keys().next().value); return cv;
  },
  // COR INTERNA: o preenchimento BRANCO puro (#FFFFFF) do personagem vira a cor escolhida (def.corInterna no Ateliê, ou a cor só
  // daquele personagem na animação, n.cor). SVG: troca o fill no próprio vetor (as linhas não mudam, continua nítido no zoom);
  // imagem comum: multiplica pela cor (o branco vira a cor, o preto continua preto). Guarda uma por imagem+cor; refaz se a imagem mudar.
  corCache: new Map(), _corFaz: new Set(),
  comCor(bm, it, aoChegar) {
    const cor = it?.cor; if (!bm || !cor || !it.img?.k || !/^#[0-9a-f]{6}$/i.test(cor) || /^#ffffff$/i.test(cor)) return bm;
    const k = it.img.k, ch = k + '|' + cor.toLowerCase(), c = this.corCache.get(ch); if (c && c.src === bm) return c.out;
    const guarda = out => { this.corCache.set(ch, { src: bm, out }); if (this.corCache.size > 300) this.corCache.delete(this.corCache.keys().next().value); };
    if (typeof Vetor !== 'undefined' && Vetor.eh(k)) {
      if (!this._corFaz.has(ch)) { this._corFaz.add(ch); (async () => { try { const t = Vetor.recolore(await Vetor.texto(k), cor), im = await Vetor.imagem(new Blob([t], { type: 'image/svg+xml' })); if (im) guarda(im); }
        catch (e) { console.warn('[cor interna]', e); } finally { this._corFaz.delete(ch); } aoChegar?.(); })(); }
      return c ? c.out : bm; // enquanto a versão nova carrega, desenha a anterior (ou a branca)
    }
    const cv = document.createElement('canvas'); cv.width = bm.width; cv.height = bm.height; const x = cv.getContext('2d');
    x.drawImage(bm, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = cor; x.fillRect(0, 0, cv.width, cv.height); x.globalCompositeOperation = 'destination-in'; x.drawImage(bm, 0, 0);
    guarda(cv); return cv;
  },
  // ORIGINAL sem perda: imagens que foram para a nuvem em webp continuam com a PNG original guardada neste navegador (arquivos["orig:<chave webp>"] = chave da original)
  async original(k) { if (!/\.webp$/i.test(k || '')) return null; try { const o = await DB.get('arquivos', 'orig:' + k); return o ? await this.pegaBlob(o) : null; } catch { return null; } },
  async blobMelhor(k) { return (await this.original(k)) || (await this.pegaBlob(k)); },
  // na memória, a imagem da webp passa a ser desenhada/editada a partir da original (editar não acumula perda)
  async usarOriginais(ids) { await Promise.all([...new Set(ids.filter(k => /\.webp$/i.test(k || '')))].map(async k => { const b = await this.original(k); if (b) { const bm = await createImageBitmap(b).catch(() => null); if (bm) this.img.set(k, bm); } })); },
  async garantir(ids) { await Promise.all([...new Set(ids.filter(Boolean))].map(id => new Promise(ok => { if (this.bitmap(id, ok)) ok(); }))); },
};
