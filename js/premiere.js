/* ===================== premiere.js — TIMELINE DO MODO VÍDEO igual à do Adobe Premiere Pro =====================
   Pedido da dona (05/11/2026): quem edita no Premiere não pode ter curva de aprendizado. Só vale no modo VÍDEO
   (botões Animação | Vídeo); o modo Animação continua o de sempre (js/folha.js) — aqui só se troca Folha.pinta/desenha/setModo
   quando Folha.modo === 'video'.
   TRILHAS: V3/V2/V1 em cima (V1 embaixo, perto do meio) e A1/A2/A3 embaixo, com cabeçalho igual ao do Premiere (alvo V1/A1,
   cadeado, olho no vídeo, M/S no áudio, nome "Vídeo 1"/"Áudio 1"; arrastar a borda de baixo muda a altura, dois cliques
   abre/fecha). Legendas = trilha de legendas (C1) no topo; a Câmera fica numa linha fina só com as chaves.
   BLOCOS: cada camada do TOPO da hierarquia é um bloco de vídeo (pasta/animação/personagem = azul íris, imagem/forma =
   lavanda, texto = rosa, camada de efeito = violeta, como camada de ajuste), com nome e miniatura; cada áudio é um bloco
   verde com a onda. `n.corTL` = rótulo escolhido (menu Rótulo).
   TRILHA DE CADA BLOCO: `n.trilha` (1 = V1) e `a.trilha` (1 = A1). Projeto antigo não tem: a trilha sai da ORDEM DO PALCO
   (`layout`: de trás para a frente, cada bloco vai para cima de tudo o que está atrás dele no mesmo tempo), então abrir não
   muda nada. Na primeira edição no modo Vídeo as trilhas são gravadas (`congela`). Trilha mais alta = mais na frente: mudar
   um bloco de trilha reordena P.raiz (`ordena`, estável), como no Premiere (V2 cobre V1). Dois blocos nunca ficam na mesma
   trilha no mesmo tempo (soltar em cima de outro = volta, com aviso; o Premiere sobrescreveria).
   Estado das trilhas no projeto: `P.trilhas = { v: { '1': { trava, nome } }, a: {...} }`. Olho/M/S não guardam nada novo:
   mexem em n.vis / a.mudo / a.solo de todos os blocos da trilha (aceso = todos assim).
   MARCADORES: `P.marcadores = [{ id, q, nome, cor }]`. ENTRADA/SAÍDA (I/O) = `Folha.trecho` (o mesmo "Marcado na régua"
   da exportação e da IA). Preferências de tela (encaixe, alturas) ficam no navegador (localStorage `animador-pr`).
   FERRAMENTAS: Seleção (V), Edição em ondulação (B), Navalha (C), Mão (H). ATALHOS (com a timeline em foco — clique nela;
   entrar no modo Vídeo já dá o foco): Ctrl+K, Ctrl+Shift+K, Q, W, Delete, Shift+Delete, Espaço, J/K/L (K+J/L = 1 quadro),
   I/O, Shift+I/O, Ctrl+Shift+I/O/X, ←/→ (Shift = 5), ↑/↓ pontos de edição, +/-/\ zoom, M, Shift+M, Ctrl+Shift+M,
   Ctrl+Alt+M, S, Shift+E, Ctrl+A, Ctrl+Shift+A, Ctrl+C/Ctrl+V, Ctrl+D/Shift+D/Ctrl+Shift+D, Alt+arrastar = duplicar,
   Ctrl+arrastar a ponta = ondulação. Ctrl+Z/Ctrl+Shift+Z ficam com o App. */
'use strict';
const TLP = {
  RG: 44, CABW: 210, HV: 48, HA: 48, HC: 28, HCAM: 20, HDIV: 7, ROLA: 10,
  pxq: 0, sx: 0, sy: 0, ferr: 'sel', sel: new Set(), foco: false, semAlvo: new Set(), vel: 0, copia: null, lacuna: null,
  ROT: [['#9b8bd9', 'Violeta'], ['#7d8fe0', 'Íris'], ['#29b896', 'Caribe'], ['#c79be6', 'Lavanda'], ['#3aa0d8', 'Cerúleo'], ['#5c9b3f', 'Floresta'], ['#e889ad', 'Rosa'], ['#e8a040', 'Manga'],
    ['#a35cc9', 'Roxo'], ['#4a68d8', 'Azul'], ['#2e8f91', 'Azul-petróleo'], ['#d14fa3', 'Magenta'], ['#c9a77a', 'Bronzeado'], ['#4ca34c', 'Verde'], ['#8f5f3a', 'Marrom'], ['#d9cc45', 'Amarelo']],
  MARC: [['#3fbf61', 'Verde'], ['#e5534b', 'Vermelho'], ['#e46fbd', 'Rosa'], ['#f0883e', 'Laranja'], ['#e3c341', 'Amarelo'], ['#e8e8e8', 'Branco'], ['#4a7fe0', 'Azul'], ['#3cc6d6', 'Ciano']],
  pref: (() => { try { return JSON.parse(localStorage.getItem('animador-pr') || '{}') || {}; } catch { return {}; } })(),
  guardaPref() { try { localStorage.setItem('animador-pr', JSON.stringify(this.pref)); } catch { } },
  get ima() { return this.pref.ima !== false; },

  /* ---------- montar ---------- */
  liga() {
    if (this.el) return true; const tl = $('#editor .tl'); if (!tl) return false;
    this.el = h(`<div class="pr" id="pr">
      <div class="pr-ferr">${[['sel', 'cursor', 'Ferramenta Seleção (V)'], ['ondula', 'ripple', 'Ferramenta Edição em ondulação (B): puxar a ponta empurra o que vem depois'], ['navalha', 'scissors', 'Ferramenta Navalha (C): clique para cortar o bloco (Shift = todas as trilhas)'], ['mao', 'move', 'Ferramenta Mão (H): arrastar a timeline']].map(([f, i, t]) => `<button class="pr-f" data-f="${f}" title="${t}">${ic(i, 15)}</button>`).join('')}</div>
      <div class="pr-tc-area"><div class="pr-tc" title="Tempo da agulha (horas:minutos:segundos:quadros). Clique para digitar um tempo">00:00:00:00</div>
        <div class="pr-bts"><button class="pr-b" data-ima title="Encaixar na timeline (S)">${ic('magnet', 13)}</button><button class="pr-b" data-marca title="Adicionar marcador (M)">${ic('marker', 13)}</button><button class="pr-b" data-cfg title="Configurações de exibição da timeline">${ic('gear', 13)}</button><button class="pr-b" data-atalhos title="Atalhos (iguais aos do Premiere)">${ic('keyboard', 13)}</button></div></div>
      <div class="pr-cabs"><div class="pr-cabs-in"></div></div>
      <div class="pr-area"><canvas class="pr-cv"></canvas></div>
      <div class="pr-vbar"><i></i></div>
      <div class="pr-pe"></div>
      <div class="pr-hbar" title="Arraste para andar na timeline · puxe as bolinhas das pontas para dar zoom"><div class="pr-hpol"><i class="e"></i><i class="d"></i></div></div>
    </div>`);
    tl.appendChild(this.el);
    this.cv = $('.pr-cv', this.el); this.area = $('.pr-area', this.el); this.cabs = $('.pr-cabs-in', this.el);
    new ResizeObserver(() => this.pinta()).observe(this.area);
    $$('[data-f]', this.el).forEach(b => b.onclick = () => this.setFerr(b.dataset.f));
    $('[data-ima]', this.el).onclick = () => this.trocaIma();
    $('[data-marca]', this.el).onclick = () => this.marcador();
    $('[data-cfg]', this.el).onclick = e => this.menuCfg(e);
    $('[data-atalhos]', this.el).onclick = () => this.ajuda();
    $('.pr-tc', this.el).onclick = () => this.digitaTempo();
    this.cv.addEventListener('pointerdown', e => this.desce(e));
    this.cv.addEventListener('pointermove', e => { if (!e.buttons) this.cursor(e); });
    this.cv.addEventListener('dblclick', e => this.duplo(e));
    this.cv.addEventListener('contextmenu', e => { e.preventDefault(); this.menu(e); });
    this.cv.addEventListener('wheel', e => this.roda(e), { passive: false });
    $('.pr-cabs', this.el).addEventListener('wheel', e => { e.preventDefault(); this.rolaV(e.deltaY); }, { passive: false });
    this.ligaCabs(); this.ligaBarras();
    // arrastar efeitos/entradas/fades da aba Efeitos (a mesma lógica do modo Vídeo antigo: Folha.alvoDrop/aplicaDrop)
    this.area.addEventListener('dragover', e => { const d = Folha.arrasto; if (!d) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; Folha.drop = Folha.alvoDrop(this.pontoDrop(e), d); this.desenha(); Folha.rotuloDrop(e); });
    this.area.addEventListener('dragleave', e => { if (this.area.contains(e.relatedTarget)) return; Folha.drop = null; this.desenha(); Folha.rotuloDrop(); });
    this.area.addEventListener('drop', e => { const d = Folha.arrasto; if (!d) return; e.preventDefault(); const a = Folha.alvoDrop(this.pontoDrop(e), d); Folha.drop = null; Folha.rotuloDrop(); this.congela(); Folha.aplicaDrop(a, d); });
    this.setFerr('sel'); this.pintaIma();
    return true;
  },
  setFerr(f) { this.ferr = f; $$('[data-f]', this.el).forEach(b => b.classList.toggle('on', b.dataset.f === f)); this.cv.style.cursor = { navalha: 'crosshair', mao: 'grab' }[f] || ''; },
  trocaIma() { this.pref.ima = !this.ima; this.guardaPref(); this.pintaIma(); UI.toast(this.ima ? 'Encaixar: ligado' : 'Encaixar: desligado'); },
  pintaIma() { $('[data-ima]', this.el)?.classList.toggle('on', this.ima); },
  aoModo() {
    const v = Folha.modo === 'video'; if (!v) { this.paraShuttle(); return; }
    if (!this.liga()) return; this.foco = true; this.pintaFoco();
    // (2.0.x, 12/11/2026, dona: "pode remover isso ok? pra n atrapalhar") o modo Vídeo NÃO leva mais o palco sozinho para a Câmera: fica onde estava
    if (!this.pxq) requestAnimationFrame(() => this.encaixaTudo());
  },
  pintaFoco() { $('#editor .tl')?.classList.toggle('pr-foco', this.foco && Folha.modo === 'video'); },

  /* ---------- tempo ---------- */
  tc(q) { const P = App.P, fps = P?.fps || 24, f = Math.max(0, Math.round(q)), s = Math.floor(f / fps), p = n => String(n).padStart(2, '0'); return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}:${p(f % fps)}`; },
  lerTc(t) { const P = App.P, fps = P.fps; t = String(t).trim(); if (!t) return null; if (/^\d+$/.test(t)) { const n = +t; return t.length > 2 ? this.lerTc(t.padStart(8, '0').replace(/(\d\d)(?=\d)/g, '$1:')) : n; } // "120" = 1 s e 20 quadros? não: só números curtos = quadros
    const ps = t.split(/[:;.,]/).map(x => +x || 0); while (ps.length < 4) ps.unshift(0); const [hh, mm, ss, ff] = ps.slice(-4); return ((hh * 60 + mm) * 60 + ss) * fps + ff; },
  fimSeq() { const P = App.P; let f = P.duracao - 1; for (const a of P.audios || []) f = Math.max(f, Folha.fimAudio(P, a)); return f; },
  W() { return this.cv.width / (devicePixelRatio || 1); }, H() { return this.cv.height / (devicePixelRatio || 1); },
  q2x(q) { return q * this.pxq - this.sx; }, x2q(x) { return (x + this.sx) / this.pxq; },
  encaixaTudo() { const W = this.W(); if (W < 40 || !App.P) return; this.pxq = clamp((W - 30) / (this.fimSeq() + 1), .02, 60); this.sx = 0; this.pinta(); },
  zoomEm(px, ax) { const W = this.W(); if (ax == null) { const xp = this.q2x(App.q); ax = xp >= 0 && xp <= W ? xp : W / 2; } const q = this.x2q(ax); this.pxq = clamp(px, Math.min(.02, (W - 30) / (this.fimSeq() + 1)), 60); this.sx = q * this.pxq - ax; this.limita(); this.pinta(); },
  limita() { const W = this.W(), tot = (this.fimSeq() + 1) * this.pxq + W * .5; this.sx = clamp(this.sx, 0, Math.max(0, tot - W)); this.sy = clamp(this.sy, 0, Math.max(0, this.altTotal - (this.H() - this.RG))); },
  roda(e) {
    e.preventDefault(); if (e.altKey || e.ctrlKey) { const r = this.cv.getBoundingClientRect(); return this.zoomEm(this.pxq * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX - r.left); }
    if (e.shiftKey) return this.rolaV(e.deltaY); this.sx += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY); this.limita(); this.desenha(); this.pintaBarras();
  },
  rolaV(d) { this.sy += d; this.limita(); this.desenha(); this.pintaCabsPos(); this.pintaBarras(); },

  /* ---------- trilhas ---------- */
  tipoNo(n) { return n.tipo === 'efeito' ? 'efeito' : n.tipo === 'texto' ? 'texto' : n.tipo === 'imagem' || n.tipo === 'forma' || n.tipo === 'video' ? 'still' : 'anim'; },
  corNo(n) { return n.corTL || { efeito: '#9b8bd9', texto: '#e889ad', still: '#c79be6', anim: '#7d8fe0' }[this.tipoNo(n)]; },
  corAudio(a) { return a.corTL || '#29b896'; },
  estT(k, t) { return App.P.trilhas?.[k]?.[t] || {}; },
  poeEstT(k, t, m) { const P = App.P; P.trilhas ||= { v: {}, a: {} }; P.trilhas[k] ||= {}; const o = { ...(P.trilhas[k][t] || {}), ...m }; for (const x in o) if (o[x] == null || o[x] === false || o[x] === '') delete o[x]; if (Object.keys(o).length) P.trilhas[k][t] = o; else delete P.trilhas[k][t]; },
  travada(c) { return !!this.estT(c.lado, c.tr).trava; },
  // quem fica em qual trilha (ver o cabeçalho). o.semZ: só as trilhas gravadas (durante um arrasto); o.movendo: esses vão por último
  layout(o = {}) {
    const P = App.P, semZ = o.semZ, mov = o.movendo || new Set(), v = [], ocV = {}, ocA = {};
    const livre = (oc, t, de, fim) => !(oc[t] || []).some(([a, b]) => a <= fim && b >= de), poe = (oc, t, de, fim) => (oc[t] ||= []).push([de, fim]);
    const ordem = []; for (let i = P.raiz.length - 1; i >= 0; i--) if (!mov.has(P.raiz[i])) ordem.push(P.raiz[i]); for (let i = P.raiz.length - 1; i >= 0; i--) if (mov.has(P.raiz[i])) ordem.push(P.raiz[i]);
    for (const n of ordem) {
      const de = n.de || 0, fim = Modelo.fimNo(P, n); let t = +n.trilha || 0;
      if (!semZ || !t) { let lim = 1; for (const c of v) if (c.de <= fim && c.fim >= de) lim = Math.max(lim, c.tr + 1); t = Math.max(t, lim); }
      while (!livre(ocV, t, de, fim)) t++; poe(ocV, t, de, fim);
      v.push({ k: 'n', lado: 'v', n, id: 'n:' + n.id, de, fim, tr: t });
    }
    const a = [], base = { voz: 1, efeito: 2, musica: 3 }, la = (P.audios || []).filter(x => !mov.has(x)).concat((P.audios || []).filter(x => mov.has(x)));
    for (const x of la) { const de = x.de || 0, fim = Folha.fimAudio(P, x); let t = +x.trilha || base[Som.tipo(x)] || 1; while (!livre(ocA, t, de, fim)) t++; poe(ocA, t, de, fim); a.push({ k: 'a', lado: 'a', a: x, id: 'a:' + x.id, de, fim, tr: t }); }
    const c = (P.legendas || []).map((g, i) => ({ k: 'g', lado: 'c', g, id: 'g:' + i, de: g.de, fim: g.ate ?? g.de, tr: 1 }));
    const te = (P.efeitos?.tela || []).map((ef, i) => ({ k: 't', lado: 't', ef, id: 't:' + i, de: ef.de ?? 0, fim: ef.ate ?? P.duracao - 1, tr: 1 }));
    const maxV = Math.max(0, ...v.map(x => x.tr)), maxA = Math.max(0, ...a.map(x => x.tr));
    return { v, a, c, te, nV: Math.max(3, maxV + 1), nA: Math.max(3, maxA + 1), todos: [...v, ...a, ...c, ...te] };
  },
  alt(k) { return this.pref.alt?.[k] || (k[0] === 'v' ? this.HV : this.HA); },
  linhasPR(L) {
    const P = App.P, rows = []; let y = 0; const add = r => { r.y = y; y += r.h; rows.push(r); };
    if (L.c.length) add({ tipo: 'c', lado: 'c', tr: 1, h: this.HC + 4, lbl: 'C1', nome: 'Legendas' });
    if (L.te.length) add({ tipo: 't', lado: 't', tr: 1, h: this.HC + 4, lbl: 'FX', nome: 'Efeitos de tela' });
    add({ tipo: 'cam', lado: 'cam', h: this.HCAM, nome: 'Câmera' });
    for (let t = L.nV; t >= 1; t--) add({ tipo: 'v', lado: 'v', tr: t, h: this.alt('v' + t), lbl: 'V' + t, nome: this.estT('v', t).nome || 'Vídeo ' + t });
    add({ tipo: 'div', h: this.HDIV });
    for (let t = 1; t <= L.nA; t++) add({ tipo: 'a', lado: 'a', tr: t, h: this.alt('a' + t), lbl: 'A' + t, nome: this.estT('a', t).nome || 'Áudio ' + t });
    this.altTotal = y + 30; return rows;
  },
  linhaDe(c) { return this.rows.find(r => r.lado === c.lado && (r.tr === c.tr || r.lado === 'c' || r.lado === 't')); },
  // grava a trilha de cada bloco (na 1ª edição do modo Vídeo; depois só confirma)
  congela() { const L = this.layout(); for (const c of L.v) c.n.trilha = c.tr; for (const c of L.a) c.a.trilha = c.tr; },
  // TRILHAS SEM ESCADA (2.0.x, 12/11/2026, dona: "o que de pra usar em uma linha só se mantem nela"): bloco NOVO (sem n.trilha) entra na
  // PRIMEIRA trilha do mesmo tipo onde cabe sem encostar em outro no tempo; só abre trilha nova se não couber. Igual ao Premiere: a trilha
  // manda em quem fica na frente (ordena). Vale em animação nova (P.rive) e em projeto que já tem trilhas gravadas; projeto antigo sem
  // trilhas continua com as trilhas saindo da ordem do palco (abrir não muda nada). Chamado pelo App.commit, antes de guardar o desfazer.
  encaixaNovos(P) {
    if (!P || !Array.isArray(P.raiz)) return false; const aud = P.audios || [];
    const ja = P.raiz.some(n => +n.trilha) || aud.some(a => +a.trilha); if (!ja && !P.rive) return false;
    if (!ja) { if (P !== App.P) return false; this.congela(); return true; } // 1ª vez: grava as trilhas que já aparecem (sem mudar quem está na frente)
    const novosV = P.raiz.filter(n => !(+n.trilha)), novosA = aud.filter(a => !(+a.trilha)); if (!novosV.length && !novosA.length) return false;
    const encaixa = (todos, novos, fim) => { const oc = {}; for (const x of todos) if (+x.trilha) (oc[+x.trilha] ||= []).push([x.de || 0, fim(x)]);
      for (const x of novos.slice().reverse()) { const de = x.de || 0, f = fim(x); let t = 1; while ((oc[t] || []).some(([a, b]) => a <= f && b >= de)) t++; x.trilha = t; (oc[t] ||= []).push([de, f]); } };
    encaixa(P.raiz, novosV, n => Modelo.fimNo(P, n)); encaixa(aud, novosA, a => Folha.fimAudio(P, a));
    if (novosV.length) this.ordena(); return true;
  },
  // COMPACTAR TRILHAS (projetos que já existem): refaz as trilhas pela ordem do palco, no mínimo de trilhas que NÃO muda o que aparece
  // na tela (quem está na frente continua na frente) e tira trilhas vazias. Ctrl+Z desfaz.
  compactar() { const P = App.P; if (!P) return; const antes = this.layout(), nV = antes.nV, nA = antes.nA;
    for (const n of P.raiz) delete n.trilha; for (const a of P.audios || []) delete a.trilha;
    const L = this.layout(); for (const c of L.v) c.n.trilha = c.tr;
    const oc = {}; for (const c of L.a.slice().sort((x, y) => x.de - y.de)) { let t = 1; while ((oc[t] || []).some(([a, b]) => a <= c.fim && b >= c.de)) t++; c.a.trilha = t; (oc[t] ||= []).push([c.de, c.fim]); }
    const depois = this.layout(); App.commit('Compactar trilhas');
    UI.toast(`Trilhas: vídeo ${nV} → ${depois.nV}, áudio ${nA} → ${depois.nA} (Ctrl+Z desfaz)`); },
  // trilha mais alta = desenhada na frente (P.raiz[0] é a da frente)
  ordena() { const P = App.P, idx = new Map(P.raiz.map((n, i) => [n, i])); P.raiz.sort((x, y) => (+y.trilha || 0) - (+x.trilha || 0) || idx.get(x) - idx.get(y)); },

  /* ---------- pintar ---------- */
  pinta() {
    if (!this.el || !App.P || Folha.modo !== 'video') return;
    if (App.P.id !== this._pid) { this._pid = App.P.id; this.pxq = 0; this.sx = this.sy = 0; this.sel.clear(); this.lacuna = null; this.selMarca = null; this._sigCabs = ''; } // outro projeto: zoom para ver tudo
    Folha.barra(); Short.pinta?.();
    const d = devicePixelRatio || 1, r = this.area.getBoundingClientRect();
    if (r.width > 2 && (this.cv.width !== Math.round(r.width * d) || this.cv.height !== Math.round(r.height * d))) { this.cv.width = Math.round(r.width * d); this.cv.height = Math.round(r.height * d); this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px'; }
    if (!this.pxq && r.width > 40) { this.pxq = clamp((r.width - 30) / (this.fimSeq() + 1), .02, 60); }
    if (!this.pxq) return;
    this.L = this.layout(this.arr?.lay || {}); this.rows = this.arr?.rows || this.linhasPR(this.L); // arrastando: as linhas ficam paradas
    // a seleção do palco/hierarquia vira a seleção da timeline
    if (App.sel !== this._appSel) { this._appSel = App.sel; const k = App.sel && (App.P.raiz.some(n => n.id === App.sel) ? 'n:' + App.sel : (App.P.audios || []).some(a => a.id === App.sel) ? 'a:' + App.sel : null); if (k && !this.sel.has(k)) this.sel = new Set([k]); else if (!App.sel) this.sel.clear(); }
    // a agulha sempre à vista (tocando: vira a página, como no Premiere)
    const W = this.W(), xp = this.q2x(App.q);
    if (this._qVisto !== App.q && !this.arr && (xp < 0 || xp > W - 20)) { this.sx = App.tocando || this.vel ? Math.max(0, App.q * this.pxq - 20) : Math.max(0, App.q * this.pxq - W / 3); }
    this._qVisto = App.q; this.limita();
    this.pintaCabs(); this.desenha(); this.pintaBarras();
    $('.pr-tc', this.el).textContent = this.tc(App.q);
  },
  // cabeçalhos (DOM): só refaz quando muda algo
  pintaCabs() {
    const L = this.L, rows = this.rows, P = App.P;
    const est = r => { const cl = r.lado === 'v' ? L.v.filter(c => c.tr === r.tr) : r.lado === 'a' ? L.a.filter(c => c.tr === r.tr) : [];
      return { n: cl.length, oculta: r.lado === 'v' && cl.length && cl.every(c => c.n.vis === false), mudo: r.lado === 'a' && cl.length && cl.every(c => c.a.mudo), solo: r.lado === 'a' && cl.length && cl.every(c => c.a.solo), trava: !!this.estT(r.lado, r.tr).trava, alvo: !this.semAlvo.has(r.lado + r.tr) }; };
    const sig = rows.map(r => `${r.tipo}${r.tr}|${r.h}|${r.nome}|${JSON.stringify(est(r))}`).join(';');
    if (sig === this._sigCabs) return this.pintaCabsPos(); this._sigCabs = sig;
    this.cabs.innerHTML = rows.map((r, i) => {
      const s = est(r), st = `height:${r.h}px`;
      if (r.tipo === 'div') return `<div class="pr-cab div" style="${st}"></div>`;
      if (r.tipo === 'cam') return `<div class="pr-cab cam" style="${st}" title="Chaves da câmera (mudar no modo Animação ou no palco)">${ic('camera', 11)}<span class="nm">Câmera</span></div>`;
      if (r.tipo === 'c' || r.tipo === 't') return `<div class="pr-cab ${r.tipo} ${s.trava ? 'travada' : ''}" data-r="${i}" style="${st}"><span class="pr-alvo on">${r.lbl}</span><button class="pr-ic ${s.trava ? 'on' : ''}" data-trava title="Bloquear a trilha">${ic(s.trava ? 'lock' : 'unlock', 12)}</button><span class="nm">${esc(r.nome)}</span></div>`;
      const v = r.tipo === 'v', curto = r.h < 34;
      return `<div class="pr-cab ${r.tipo} ${s.trava ? 'travada' : ''} ${curto ? 'curto' : ''}" data-r="${i}" style="${st}">
        <button class="pr-alvo ${s.alvo ? 'on' : ''}" data-alvo title="Trilha de destino (os atalhos Ctrl+K, Q, W, ↑/↓ e Ctrl+D valem nas trilhas acesas)">${r.lbl}</button>
        <button class="pr-ic ${s.trava ? 'on' : ''}" data-trava title="Bloquear a trilha">${ic(s.trava ? 'lock' : 'unlock', 13)}</button>
        ${v ? `<button class="pr-ic ${s.oculta ? 'off' : ''}" data-olho title="Ativar/desativar a saída da trilha (esconde os blocos dela)" ${s.n ? '' : 'disabled'}>${ic(s.oculta ? 'eyeOff' : 'eye', 13)}</button>`
        : `<button class="pr-ms m ${s.mudo ? 'on' : ''}" data-mudo title="Silenciar a trilha" ${s.n ? '' : 'disabled'}>M</button><button class="pr-ms s ${s.solo ? 'on' : ''}" data-solo title="Trilha solo" ${s.n ? '' : 'disabled'}>S</button>`}
        <span class="nm" title="Dois cliques: renomear a trilha">${esc(r.nome)}</span><i class="pr-alt" data-alt title="Arraste para mudar a altura da trilha"></i></div>`;
    }).join('') + '<div style="height:30px"></div>';
    this.pintaCabsPos();
  },
  pintaCabsPos() { this.cabs.style.transform = `translateY(${-this.sy}px)`; },
  ligaCabs() {
    const box = this.cabs;
    box.addEventListener('click', e => {
      const cab = e.target.closest('.pr-cab[data-r]'); if (!cab) return; const r = this.rows[+cab.dataset.r]; if (!r) return; const k = r.lado, t = r.tr, L = this.L;
      const cl = k === 'v' ? L.v.filter(c => c.tr === t) : k === 'a' ? L.a.filter(c => c.tr === t) : [];
      if (e.target.closest('[data-alvo]')) { const id = k + t; if (this.semAlvo.has(id)) this.semAlvo.delete(id); else this.semAlvo.add(id); this._sigCabs = ''; return this.pinta(); }
      if (e.target.closest('[data-trava]')) { this.congela(); this.poeEstT(k, t, { trava: !this.estT(k, t).trava }); for (const c of cl) this.sel.delete(c.id); return App.commit(this.estT(k, t).trava ? `Bloquear ${r.lbl}` : `Desbloquear ${r.lbl}`, { semLado: true }); }
      if (e.target.closest('[data-olho]')) { const esconde = cl.some(c => c.n.vis !== false); this.congela(); for (const c of cl) c.n.vis = !esconde; return App.commit(esconde ? `Saída de ${r.lbl} desligada` : `Saída de ${r.lbl} ligada`); }
      if (e.target.closest('[data-mudo]')) { const m = !cl.every(c => c.a.mudo); this.congela(); for (const c of cl) c.a.mudo = m; if (App.tocando) Som.toca(App.q); return App.commit(m ? `Silenciar ${r.lbl}` : `Som de ${r.lbl} de volta`); }
      if (e.target.closest('[data-solo]')) { const s = !cl.every(c => c.a.solo); this.congela(); for (const c of cl) c.a.solo = s; if (App.tocando) Som.toca(App.q); return App.commit(s ? `Solo em ${r.lbl}` : `Sem solo em ${r.lbl}`); }
    });
    box.addEventListener('dblclick', e => {
      const cab = e.target.closest('.pr-cab[data-r]'); if (!cab || e.target.closest('button,[data-alt]')) return; const r = this.rows[+cab.dataset.r]; if (r.lado !== 'v' && r.lado !== 'a') return;
      if (e.target.closest('.nm')) return this.renomeiaTrilha(r);
      const k = r.lado + r.tr; this.pref.alt ||= {}; this.pref.alt[k] = this.alt(k) >= 60 ? 26 : 84; this.guardaPref(); this.pinta(); // dois cliques no cabeçalho: abre/fecha a trilha
    });
    box.addEventListener('contextmenu', e => { const cab = e.target.closest('.pr-cab[data-r]'); if (!cab) return; e.preventDefault(); const r = this.rows[+cab.dataset.r]; if (r.lado !== 'v' && r.lado !== 'a') return;
      UI.ctx(e.clientX, e.clientY, [{ head: `${r.lbl} · ${r.nome}` }, { label: 'Renomear', icon: 'edit', action: () => this.renomeiaTrilha(r) },
        { label: this.alt(r.lado + r.tr) >= 60 ? 'Recolher a trilha' : 'Expandir a trilha', icon: 'sliders', action: () => { const k = r.lado + r.tr; this.pref.alt ||= {}; this.pref.alt[k] = this.alt(k) >= 60 ? 26 : 84; this.guardaPref(); this.pinta(); } },
        { label: 'Altura padrão em todas', icon: 'x', action: () => { delete this.pref.alt; this.guardaPref(); this.pinta(); } }]); });
    box.addEventListener('pointerdown', e => {
      const al = e.target.closest('[data-alt]'); if (!al) return; e.preventDefault(); const r = this.rows[+al.closest('.pr-cab').dataset.r], k = r.lado + r.tr, h0 = r.h, y0 = e.clientY; al.setPointerCapture(e.pointerId);
      const mov = ev => { this.pref.alt ||= {}; this.pref.alt[k] = clamp(Math.round(h0 + ev.clientY - y0), 22, 160); this.pinta(); };
      const up = () => { al.removeEventListener('pointermove', mov); al.removeEventListener('pointerup', up); this.guardaPref(); }; al.addEventListener('pointermove', mov); al.addEventListener('pointerup', up);
    });
  },
  async renomeiaTrilha(r) { const v = await UI.prompt({ title: `Nome da trilha ${r.lbl}`, value: r.nome, ok: 'Renomear' }); if (v == null) return; const pad = (r.lado === 'v' ? 'Vídeo ' : 'Áudio ') + r.tr; this.poeEstT(r.lado, r.tr, { nome: v.trim() && v.trim() !== pad ? v.trim().slice(0, 40) : null }); this.congela(); App.commit('Renomear trilha', { semLado: true }); },

  /* ---------- desenho ---------- */
  desenha() {
    if (!this.el || !App.P || !this.rows || Folha.modo !== 'video') return;
    const P = App.P, c = this.cv.getContext('2d'), d = devicePixelRatio || 1, W = this.W(), H = this.H(), RG = this.RG, sy = this.sy, fps = P.fps;
    c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = '#1e1e21'; c.fillRect(0, 0, W, H); this._miniN = 0;
    c.save(); c.beginPath(); c.rect(0, RG, W, H - RG); c.clip();
    const xFim = this.q2x(P.duracao);
    for (const r of this.rows) { const y = RG + r.y - sy; if (y > H || y + r.h < RG) continue;
      if (r.tipo === 'div') { c.fillStyle = '#151517'; c.fillRect(0, y, W, r.h); c.fillStyle = '#333338'; c.fillRect(0, y + 3, W, 1); continue; }
      c.fillStyle = r.tipo === 'cam' ? '#242428' : '#202024'; c.fillRect(0, y, W, r.h); c.fillStyle = '#151517'; c.fillRect(0, y + r.h - 1, W, 1);
      if (xFim < W) { c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(Math.max(0, xFim), y, W, r.h - 1); } } // depois do fim da animação
    // entrada/saída: faixa clara nas trilhas
    const tr = Folha.trecho; if (tr) { c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(this.q2x(tr.de), RG, (tr.ate - tr.de + 1) * this.pxq, H); }
    // lacuna escolhida
    if (this.lacuna) { const r = this.rows.find(x => x.lado === this.lacuna.lado && x.tr === this.lacuna.tr); if (r) { c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(this.q2x(this.lacuna.de), RG + r.y - sy + 1, (this.lacuna.fim - this.lacuna.de + 1) * this.pxq, r.h - 2); } }
    for (const cl of this.L.todos) { const r = this.linhaDe(cl); if (!r) continue; const y = RG + r.y - sy; if (y > H || y + r.h < RG) continue; const x0 = this.q2x(cl.de), x1 = this.q2x(cl.fim + 1); if (x1 < 0 || x0 > W) continue;
      this.bloco(c, cl, x0, x1, y, r.h, W); }
    // câmera: só as chaves
    const rc = this.rows.find(r => r.tipo === 'cam'); if (rc) { const y = RG + rc.y - sy + rc.h / 2; c.fillStyle = '#8fb4e8'; for (const k of Object.keys(P.camera?.chaves || {}).map(Number)) { const x = this.q2x(k + .5); if (x < -5 || x > W + 5) continue; c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 4, y); c.lineTo(x, y + 4); c.lineTo(x - 4, y); c.fill(); } }
    // trilhas bloqueadas: listras por cima
    for (const r of this.rows) if ((r.lado === 'v' || r.lado === 'a') && this.estT(r.lado, r.tr).trava) { const y = RG + r.y - sy; c.save(); c.beginPath(); c.rect(0, y, W, r.h - 1); c.clip(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.beginPath(); for (let x = -r.h - (this.sx % 12); x < W + r.h; x += 12) { c.moveTo(x, y + r.h); c.lineTo(x + r.h, y); } c.stroke(); c.restore(); }
    // arrasto da aba Efeitos
    const dr = Folha.drop; if (dr?.i != null && this.rows[dr.i]) { const r = this.rows[dr.i], y = RG + r.y - sy; c.fillStyle = dr.ok ? 'rgba(90,169,232,.22)' : 'rgba(255,107,107,.15)'; c.strokeStyle = dr.ok ? '#5aa9e8' : '#ff8a8a'; c.lineWidth = 2; c.beginPath(); c.roundRect(this.q2x(dr.de) + 1, y + 2, Math.max(4, (dr.ate - dr.de + 1) * this.pxq - 2), r.h - 4, 3); c.fill(); c.stroke(); }
    // laço (seleção por retângulo)
    const m = this.laco; if (m) { const x = Math.min(m.x0, m.x1), y = Math.min(m.y0, m.y1); c.fillStyle = 'rgba(255,255,255,.08)'; c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; c.fillRect(x, y, Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0)); c.strokeRect(x + .5, y + .5, Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0)); }
    // encaixe: linha + triângulos
    if (this.encaixe != null) { const x = Math.round(this.q2x(this.encaixe)) + .5; c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, RG); c.lineTo(x, H); c.stroke(); }
    // agulha: linha VERMELHA nas trilhas
    const xa = Math.round(this.q2x(App.q)) + .5; if (xa >= -2 && xa <= W + 2) { c.strokeStyle = '#ff453a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(xa, RG); c.lineTo(xa, H); c.stroke(); }
    c.restore();
    this.regua(c, W);
  },
  bloco(c, cl, x0, x1, y, h, W) {
    const P = App.P, sel = this.sel.has(cl.id), arr = this.arr, ruim = arr?.ruim?.has(cl.id), top = y + 1, hh = h - 3, w = x1 - x0;
    let cor, nome, off = false;
    if (cl.k === 'n') { cor = this.corNo(cl.n); nome = cl.n.nome; off = cl.n.vis === false; }
    else if (cl.k === 'a') { cor = this.corAudio(cl.a); nome = cl.a.nome; off = !Som.ouve(P, cl.a); }
    else if (cl.k === 'g') { cor = '#b59a3c'; nome = String(cl.g.texto || '').replace(/\*/g, ''); }
    else { cor = '#9b8bd9'; nome = Efeitos.TELA?.find(t => t.id === cl.ef.tipo)?.nome || cl.ef.tipo; }
    const [r0, g0, b0] = hexToRgb(cor), mix = (k, a) => `rgb(${Math.round(r0 + (k - r0) * a)},${Math.round(g0 + (k - g0) * a)},${Math.round(b0 + (k - b0) * a)})`;
    c.save(); c.beginPath(); c.rect(Math.max(x0, -2), top, Math.min(w, W + 4 - Math.max(x0, -2)), hh); c.clip(); c.globalAlpha = off ? .45 : 1;
    // corpo: cor do rótulo (escolhido = mais claro, como no Premiere)
    c.fillStyle = sel ? mix(255, .18) : mix(0, cl.k === 'a' ? .45 : .25); c.fillRect(x0, top, w, hh);
    const faixa = hh >= 26 ? 14 : 0; // faixa do nome em cima
    if (faixa) { c.fillStyle = sel ? mix(255, .35) : cor; c.fillRect(x0, top, w, faixa); }
    // miniatura (vídeo) ou onda (áudio)
    if (cl.k === 'n' && hh - faixa >= 12 && !this.pref.semMini) this.mini(c, cl, x0, top + faixa, hh - faixa, w);
    if (cl.k === 'a') this.onda(c, cl, x0, w, top + faixa, hh - faixa, sel ? mix(255, .6) : mix(255, .55), W);
    if (cl.k === 'n' && !this.pref.semChaves) { c.fillStyle = 'rgba(255,255,255,.7)'; const yk = top + hh - 5; for (const k of Object.keys(cl.n.chaves || {}).map(Number)) { if (k < cl.de || k > cl.fim) continue; const kx = this.q2x(k + .5); if (kx < x0 + 2 || kx > x1 - 2) continue; c.beginPath(); c.moveTo(kx, yk - 3); c.lineTo(kx + 3, yk); c.lineTo(kx, yk + 3); c.lineTo(kx - 3, yk); c.fill(); } }
    // transições (entrada/saída) e fades do som: caixa na ponta com a diagonal, como no Premiere
    const trs = cl.k === 'n' ? [['entra', cl.n.entra?.q, Modelo.ANIMS[cl.n.entra?.tipo] === 'Aparecer' ? 'Dissolução cruzada' : Modelo.ANIMS[cl.n.entra?.tipo]], ['sai', cl.n.sai?.q, Modelo.ANIMS[cl.n.sai?.tipo] === 'Aparecer' ? 'Dissolução cruzada' : Modelo.ANIMS[cl.n.sai?.tipo]]]
      : cl.k === 'a' ? [['entra', (+cl.a.fi || 0) * P.fps, 'Potência constante'], ['sai', (+cl.a.fo || 0) * P.fps, 'Potência constante']] : [];
    for (const [lado, q, nm] of trs) { if (!q) continue; const tw = Math.min(w, q * this.pxq), tx = lado === 'entra' ? x0 : x1 - tw, ts = this.sel.has(`x:${lado}:${cl.id}`);
      c.fillStyle = ts ? 'rgba(170,150,230,.95)' : 'rgba(140,125,200,.88)'; c.fillRect(tx, top + faixa, tw, hh - faixa); c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1; c.beginPath(); if (lado === 'entra') { c.moveTo(tx, top + hh); c.lineTo(tx + tw, top + faixa); } else { c.moveTo(tx, top + faixa); c.lineTo(tx + tw, top + hh); } c.stroke();
      if (ts) { c.strokeStyle = '#fff'; c.strokeRect(tx + .5, top + faixa + .5, tw - 1, hh - faixa - 1); }
      if (tw > 70 && hh - faixa > 14) { c.fillStyle = '#111'; c.font = '10px Segoe UI'; c.textBaseline = 'top'; c.fillText(nm || '', tx + 4, top + faixa + 2); } }
    // fx: tem efeito em cima (camada de ajuste) ou transição
    const temFx = cl.k === 'n' && (cl.n.entra || cl.n.sai || cl.n.tremulo || Folha.efeitoDe?.(cl.n));
    // nome
    c.font = '11px Segoe UI'; c.textBaseline = 'middle'; const ty = faixa ? top + 7.5 : top + hh / 2; let tx = Math.max(x0, 0) + 4;
    if (temFx && w > 30) { c.fillStyle = sel ? '#000' : '#e2c33a'; c.font = 'bold italic 10px Segoe UI'; c.fillText('fx', tx, ty); tx += 14; c.font = '11px Segoe UI'; }
    if (w > 24) { c.fillStyle = faixa ? (sel ? '#000' : '#0b0b0b') : '#fff'; if (!faixa) { c.shadowColor = '#000'; c.shadowBlur = 2; } c.fillText(nome || '', tx, ty); c.shadowBlur = 0; }
    c.restore();
    // bordas
    c.lineWidth = 1; c.strokeStyle = ruim ? '#ff4d4d' : sel ? '#ffffff' : 'rgba(0,0,0,.6)'; c.strokeRect(Math.round(x0) + .5, top + .5, Math.max(1, Math.round(w) - 1), hh - 1);
    if (ruim) { c.lineWidth = 2; c.strokeRect(Math.round(x0) + 1, top + 1, Math.max(1, Math.round(w) - 2), hh - 2); }
  },
  // miniatura do bloco: o próprio bloco sozinho, visto pela câmera, no primeiro quadro (cache por bloco/quadro/tamanho/versão)
  mini(c, cl, x0, y, hh, w) {
    const P = App.P, mh = Math.max(10, Math.round(hh - 2)), mw = Math.round(mh * P.w / P.h); if (w < mw * .6) return;
    const n = cl.n, q = Math.min(cl.fim, cl.de + (n.entra ? Math.min(n.entra.q, cl.fim - cl.de) : 0)), ver = (App.desfazer?.length || 0) + ':' + (App.ultimo?.length || 0), k = `${n.id}:${q}:${mw}x${mh}`;
    this._mini ||= new Map(); let m = this._mini.get(k);
    if ((!m || (m.ver !== ver && !App.tocando) || (m.tenta < 3 && performance.now() - m.t > 900)) && (this._miniN = (this._miniN || 0) + 1) <= 2) {
      const d = devicePixelRatio || 1, cv = m?.cv || document.createElement('canvas'); cv.width = mw * d; cv.height = mh * d;
      try { const P2 = Object.assign({}, P, { raiz: [n], legendas: [], efeitos: { ...P.efeitos, tela: [] } }); Render.quadro(cv.getContext('2d'), P2, q, cv.width, cv.height, { semLegenda: true }); } catch { }
      m = { cv, ver, t: performance.now(), tenta: m && m.ver === ver ? m.tenta + 1 : 1 }; this._mini.set(k, m);
      if (m.tenta < 3) { clearTimeout(this._tMini); this._tMini = setTimeout(() => this.desenha(), 950); } // as imagens chegam depois: tenta de novo
      if (this._mini.size > 300) this._mini.delete(this._mini.keys().next().value);
    }
    if (m) { c.drawImage(m.cv, x0 + 1, y + 1, mw, mh); c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x0 + 1 + mw, y + 1, 1, mh); }
  },
  onda(c, cl, x0, w, top, hh, cor, W) {
    const P = App.P, a = cl.a, fps = P.fps, b = Som.buf.get(a.arq), mid = top + hh / 2, m = hh / 2 - 2; if (hh < 8) return;
    if (!b || !Som.finos(a.arq)) { c.fillStyle = cor; c.fillRect(x0, mid, w, 1); return; }
    const ini = Som.ini(a), tl0 = (a.de || 0) / fps, fim = tl0 + Som.compr(a, b), Lb = Math.max(.05, b.duration - ini), xa = Math.max(x0, 0), xz = Math.min(x0 + w, W), passo = 1.5, pts = [];
    for (let x = xa; x <= xz; x += passo) { const t = (x + this.sx) / this.pxq / fps, t2 = (x + passo + this.sx) / this.pxq / fps; let u0 = t - tl0, u1 = t2 - tl0; if (a.loop) { u0 = u0 % Lb; u1 = u0 + (t2 - t); }
      const v = Som.picoEntre(a.arq, ini + u0, ini + u1) * Som.ganho(a, Math.floor(t * fps)) * Som.fade(a, t, tl0, fim); pts.push([x, Math.min(1, Math.sqrt(v)) * m]); }
    if (!pts.length) return; c.fillStyle = cor; c.beginPath(); c.moveTo(pts[0][0], mid); for (const [x, v] of pts) c.lineTo(x, mid - Math.max(.5, v)); for (let i = pts.length - 1; i >= 0; i--) c.lineTo(pts[i][0], mid + Math.max(.5, pts[i][1])); c.closePath(); c.fill();
  },
  regua(c, W) {
    const P = App.P, RG = this.RG, fps = P.fps, px = this.pxq;
    c.fillStyle = '#242428'; c.fillRect(0, 0, W, RG); c.fillStyle = '#151517'; c.fillRect(0, RG - 1, W, 1);
    const cand = [1, 2, 5, 10, fps, fps * 2, fps * 5, fps * 10, fps * 15, fps * 30, fps * 60, fps * 120, fps * 300, fps * 600, fps * 1800, fps * 3600].filter((v, i, l) => !i || v > l[i - 1]);
    const passo = cand.find(v => v * px >= 92) || cand[cand.length - 1], sub = passo >= fps ? (passo / fps % 5 === 0 ? 5 : passo / fps % 2 === 0 ? 4 : passo === fps ? (fps % 4 === 0 ? 4 : fps % 3 === 0 ? 3 : 2) : 2) : (passo % 5 === 0 ? 5 : passo), mini = passo / sub;
    const q0 = Math.max(0, Math.floor(this.x2q(0) / passo) * passo), q1 = this.x2q(W);
    c.font = '500 11px Inter, "Segoe UI", sans-serif'; c.textBaseline = 'top';
    // entrada/saída na régua
    const tr = Folha.trecho; if (tr) { const xa = this.q2x(tr.de), xb = this.q2x(tr.ate + 1); c.fillStyle = 'rgba(160,160,160,.35)'; c.fillRect(xa, 22, xb - xa, 12); c.fillStyle = '#d8d8d8'; c.fillRect(xa, 22, 2, 12); c.fillRect(xb - 2, 22, 2, 12); }
    for (let q = q0; q <= q1; q += mini) { const x = Math.round(this.q2x(q)) + .5, grande = Math.abs(q / passo - Math.round(q / passo)) < 1e-6; if (mini * px < 4 && !grande) continue;
      c.fillStyle = grande ? '#8e8e93' : '#4a4a52'; c.fillRect(x - .5, grande ? 17 : 27, 1, grande ? 17 : 7); if (grande) { c.fillStyle = 'rgba(235,235,245,.64)'; c.fillText(this.tc(q), x + 3, 4); } }
    // marcadores
    for (const mk of P.marcadores || []) { const x = this.q2x(mk.q); if (x < -10 || x > W + 10) continue; c.fillStyle = mk.cor || '#3fbf61'; c.beginPath(); c.moveTo(x - 5, 17); c.lineTo(x + 5, 17); c.lineTo(x + 5, 26); c.lineTo(x, 31); c.lineTo(x - 5, 26); c.closePath(); c.fill(); if (this.selMarca === mk.id) { c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke(); } }
    // barra de render: linha vermelha embaixo da régua onde há bloco de vídeo (amarela onde só tem foto/forma/texto)
    const L = this.L; if (L) { const yb = RG - 5; for (const cl of L.v) { if (cl.n.vis === false) continue; const xa = Math.max(0, this.q2x(cl.de)), xb = Math.min(W, this.q2x(cl.fim + 1)); if (xb <= xa) continue; c.fillStyle = this.tipoNo(cl.n) === 'anim' || this.tipoNo(cl.n) === 'efeito' ? '#d62a1e' : '#d8c21f'; c.fillRect(xa, yb, xb - xa, 3); } }
    // agulha: cabeça VERMELHA (2.0, pedido da dona: agulha vermelha, como a linha)
    const x = Math.round(this.q2x(App.q)) + .5; if (x >= -8 && x <= W + 8) { c.fillStyle = '#ff453a'; c.beginPath(); c.moveTo(x - 6, 16); c.lineTo(x + 6, 16); c.lineTo(x + 6, 27); c.lineTo(x, 34); c.lineTo(x - 6, 27); c.closePath(); c.fill(); c.strokeStyle = '#e8362d'; c.beginPath(); c.moveTo(x, 34); c.lineTo(x, RG); c.stroke(); }
  },
  // barras de rolagem (a de baixo dá zoom pelas pontas, como no Premiere)
  ligaBarras() {
    const hb = $('.pr-hbar', this.el), pol = $('.pr-hpol', hb), vb = $('.pr-vbar', this.el), vt = $('i', vb);
    pol.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pol.setPointerCapture(e.pointerId); const ponta = e.target.closest('.e') ? 'e' : e.target.closest('.d') ? 'd' : null, x0 = e.clientX, sx0 = this.sx, px0 = this.pxq, W = this.W(), BW = hb.clientWidth, tot = this.totalPx();
      const q0 = this.x2q(0), q1 = this.x2q(W);
      const mov = ev => { const dx = ev.clientX - x0;
        if (!ponta) { this.sx = sx0 + dx * tot / BW; }
        else { const fq = (this.fimSeq() + 1) * 1.5, dq = dx / BW * fq; let a = q0, b = q1; if (ponta === 'e') a = Math.min(q1 - 5, q0 + dq); else b = Math.max(q0 + 5, q1 + dq); this.pxq = clamp(W / (b - a), .02, 60); this.sx = a * this.pxq; }
        this.limita(); this.desenha(); this.pintaBarras(); };
      const up = () => { pol.removeEventListener('pointermove', mov); pol.removeEventListener('pointerup', up); }; pol.addEventListener('pointermove', mov); pol.addEventListener('pointerup', up); });
    hb.addEventListener('pointerdown', e => { if (e.target !== hb) return; const r = hb.getBoundingClientRect(); this.sx = (e.clientX - r.left) / r.width * this.totalPx() - this.W() / 2; this.limita(); this.desenha(); this.pintaBarras(); });
    hb.addEventListener('dblclick', () => this.encaixaTudo());
    vt.addEventListener('pointerdown', e => { e.preventDefault(); vt.setPointerCapture(e.pointerId); const y0 = e.clientY, sy0 = this.sy, BH = vb.clientHeight, tot = this.altTotal;
      const mov = ev => { this.sy = sy0 + (ev.clientY - y0) * tot / BH; this.limita(); this.desenha(); this.pintaCabsPos(); this.pintaBarras(); };
      const up = () => { vt.removeEventListener('pointermove', mov); vt.removeEventListener('pointerup', up); }; vt.addEventListener('pointermove', mov); vt.addEventListener('pointerup', up); });
  },
  totalPx() { return Math.max(this.W(), (this.fimSeq() + 1) * this.pxq + this.W() * .5); },
  pintaBarras() {
    const hb = $('.pr-hbar', this.el), pol = $('.pr-hpol', hb), BW = hb.clientWidth, tot = this.totalPx(), W = this.W();
    const w = Math.max(28, W / tot * BW), x = Math.min(BW - w, this.sx / tot * BW); pol.style.left = x + 'px'; pol.style.width = w + 'px';
    const vb = $('.pr-vbar', this.el), vt = $('i', vb), BH = vb.clientHeight, vis = this.H() - this.RG, totV = this.altTotal || 1;
    if (totV <= vis + 2) vt.style.display = 'none'; else { vt.style.display = ''; const hh = Math.max(20, vis / totV * BH); vt.style.height = hh + 'px'; vt.style.top = Math.min(BH - hh, this.sy / totV * BH) + 'px'; }
  },

  /* ---------- mouse ---------- */
  ponto(e) {
    const r = this.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, q = this.x2q(x), p = { x, y, q, qi: Math.floor(q), qr: Math.round(q) };
    if (y < this.RG) { p.regua = true; return p; }
    const yy = y - this.RG + this.sy; p.ri = this.rows.findIndex(r => yy >= r.y && yy < r.y + r.h); p.row = this.rows[p.ri];
    if (p.row && p.row.tipo !== 'div' && p.row.tipo !== 'cam') {
      const cls = this.L.todos.filter(c => c.lado === p.row.lado && (c.tr === p.row.tr || c.lado === 'c' || c.lado === 't') && x >= this.q2x(c.de) - 3 && x <= this.q2x(c.fim + 1) + 3);
      p.clip = cls.find(c => q >= c.de && q < c.fim + 1) || cls[0] || null;
    }
    return p;
  },
  // o mesmo formato do Folha.ponto (para Folha.alvoDrop): i = linha, l = "linha" do bloco embaixo
  pontoDrop(e) { const p = this.ponto(e), c = p.clip; return { q: p.qi, x: p.x, y: p.y, i: p.ri ?? -1, l: c?.k === 'n' ? { tipo: 'no', no: c.n, video: true } : c?.k === 'a' ? { tipo: 'audio', a: c.a } : null }; },
  zona(p) {
    const c = p.clip; if (!c) return null; const x0 = this.q2x(c.de), x1 = this.q2x(c.fim + 1), w = x1 - x0, b = Math.min(7, w / 4), P = App.P, r = p.row, top = this.RG + r.y - this.sy + 1, faixa = r.h - 3 >= 26 ? 14 : 0;
    const tq = c.k === 'n' ? [c.n.entra?.q, c.n.sai?.q] : c.k === 'a' ? [(+c.a.fi || 0) * P.fps, (+c.a.fo || 0) * P.fps] : [0, 0];
    if (p.y > top + faixa) { if (tq[0] && p.x >= x0 + b && p.x <= x0 + tq[0] * this.pxq) return 'tr-entra'; if (tq[1] && p.x <= x1 - b && p.x >= x1 - tq[1] * this.pxq) return 'tr-sai'; }
    if (p.x - x0 < b) return 'ini'; if (x1 - p.x < b) return 'fim'; return 'meio';
  },
  cursor(e) {
    if (this.ferr !== 'sel' && this.ferr !== 'ondula') return; const p = this.ponto(e); if (p.regua) { this.cv.style.cursor = ''; return; }
    const z = this.zona(p), trava = p.clip && this.travada(p.clip); this.cv.style.cursor = trava ? 'not-allowed' : z === 'ini' || z === 'fim' ? (this.ferr === 'ondula' || e.ctrlKey ? 'col-resize' : 'ew-resize') : '';
  },
  pegaSom() { App.pausa(); this.paraShuttle(); },
  arrastar(e, mov, up) { const id = e.pointerId; this.cv.setPointerCapture(id); const m = ev => mov(this.ponto(ev), ev); const u = ev => { this.cv.removeEventListener('pointermove', m); this.cv.removeEventListener('pointerup', u); this.cv.removeEventListener('pointercancel', u); up?.(this.ponto(ev), ev); }; this.cv.addEventListener('pointermove', m); this.cv.addEventListener('pointerup', u); this.cv.addEventListener('pointercancel', u); },
  desce(e) {
    if (!App.P) return; this.foco = true; this.pintaFoco(); const p = this.ponto(e);
    if (e.button === 1 || (e.button === 0 && this.ferr === 'mao')) { e.preventDefault(); const x0 = e.clientX, y0 = e.clientY, sx0 = this.sx, sy0 = this.sy; this.cv.style.cursor = 'grabbing';
      return this.arrastar(e, (pp, ev) => { this.sx = sx0 - (ev.clientX - x0); this.sy = sy0 - (ev.clientY - y0); this.limita(); this.desenha(); this.pintaCabsPos(); this.pintaBarras(); }, () => { this.cv.style.cursor = this.ferr === 'mao' ? 'grab' : ''; }); }
    if (e.button !== 0) { if (p.clip && !this.sel.has(p.clip.id) && !this.travada(p.clip)) this.escolhe([p.clip.id]); return; }
    if (p.regua) { // marcador ou agulha
      const mk = (App.P.marcadores || []).find(m => Math.abs(this.q2x(m.q) - p.x) < 6 && p.y >= 14 && p.y <= 33);
      if (mk) { this.selMarca = mk.id; const q0 = mk.q; this.desenha(); return this.arrastar(e, pp => { mk.q = clamp(this.encaixa(pp.qr, { semAgulha: false }), 0, this.fimSeq()); this.desenha(); }, () => { this.encaixe = null; if (mk.q !== q0) App.commit('Mover marcador', { semLado: true }); else this.desenha(); }); }
      this.selMarca = null; this.pegaSom(); const vai = (pp, ev) => { let q = clamp(pp.qi, 0, Modelo.ultimoQuadro(App.P)); if (ev?.shiftKey) q = this.encaixa(q, { semAgulha: true, forca: true }); App.setQ(q, { som: true }); };
      vai(p, e); return this.arrastar(e, vai, () => { this.encaixe = null; this.desenha(); });
    }
    const c = p.clip;
    if (this.ferr === 'navalha') { if (!c || this.travada(c)) return; const q = this.ima ? this.encaixa(p.qr, { forca: false }) : p.qr; this.encaixe = null; this.congela(); const n = e.shiftKey ? this.cortaTudo(q) : this.corta(c, q) ? 1 : 0; if (n) App.commit('Cortar com a navalha'); return; }
    if (!c) { // vazio: lacuna ou laço
      this.lacuna = null; if (!e.shiftKey && !e.ctrlKey) this.escolhe([]);
      this.lacuna = this.lacunaEm(p); if (this.lacuna) this.desenha();
      const base = new Set(this.sel); this.laco = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      return this.arrastar(e, pp => { this.laco.x1 = pp.x; this.laco.y1 = pp.y; if (Math.abs(this.laco.x1 - this.laco.x0) + Math.abs(this.laco.y1 - this.laco.y0) > 4) { this.lacuna = null; this.sel = new Set([...base, ...this.dentroLaco()]); } this.desenha(); }, () => { const mexeu = Math.abs(this.laco.x1 - this.laco.x0) + Math.abs(this.laco.y1 - this.laco.y0) > 4; this.laco = null; if (mexeu) this.escolhe([...this.sel]); else this.desenha(); });
    }
    this.lacuna = null; this.selMarca = null;
    if (this.travada(c)) return UI.toast(`A trilha ${c.lado.toUpperCase()}${c.tr} está bloqueada (cadeado no cabeçalho)`);
    const z = this.zona(p);
    if (z === 'tr-entra' || z === 'tr-sai') return this.arrastaTransicao(e, p, c, z.slice(3));
    if (e.shiftKey || e.ctrlKey && z === 'meio') { const s = new Set(this.sel); if (s.has(c.id)) s.delete(c.id); else s.add(c.id); this.escolhe([...s]); if (!s.has(c.id)) return; }
    else if (!this.sel.has(c.id)) this.escolhe([c.id]);
    if (z === 'ini' || z === 'fim') return this.apara(e, p, c, z, this.ferr === 'ondula' || e.ctrlKey);
    this.move(e, p, c);
  },
  escolhe(ids) {
    this.sel = new Set(ids); this.lacuna = null; const ult = ids[ids.length - 1]; let alvo = null;
    if (ult?.startsWith('n:') || ult?.startsWith('a:')) alvo = ult.slice(2);
    if (alvo && alvo !== App.sel) { this._appSel = alvo; App.selecionar(alvo); if (ult.startsWith('a:')) Lado.aba?.('som'); }
    else if (!ids.length && App.sel) { this._appSel = null; App.selecionar(null); }
    else this.desenha();
  },
  dentroLaco() { const m = this.laco, xa = Math.min(m.x0, m.x1), xb = Math.max(m.x0, m.x1), ya = Math.min(m.y0, m.y1), yb = Math.max(m.y0, m.y1), out = [];
    for (const c of this.L.todos) { const r = this.linhaDe(c); if (!r || this.travada(c)) continue; const y0 = this.RG + r.y - this.sy, y1 = y0 + r.h; if (this.q2x(c.fim + 1) >= xa && this.q2x(c.de) <= xb && y1 >= ya && y0 <= yb) out.push(c.id); } return out; },
  clipe(id) { return this.L?.todos.find(c => c.id === id); },
  escolhidos() { return [...this.sel].map(id => this.clipe(id)).filter(Boolean); },
  // ---------- encaixe (S): agulha, pontas dos blocos, marcadores, entrada/saída ----------
  pontosEncaixe(ignora = new Set()) { const P = App.P, s = new Set([0]); if (!this._semAgulha) s.add(App.q); for (const c of this.L.todos) { if (ignora.has(c.id)) continue; s.add(c.de); s.add(c.fim + 1); } for (const m of P.marcadores || []) s.add(m.q); if (Folha.trecho) { s.add(Folha.trecho.de); s.add(Folha.trecho.ate + 1); } return [...s]; },
  encaixa(q, o = {}) { this.encaixe = null; if (!this.ima && !o.forca) return q; this._semAgulha = o.semAgulha; const tol = 8 / this.pxq; let best = null; for (const v of this.pontosEncaixe(o.ignora)) { const d = Math.abs(v - q); if (d <= tol && (best == null || d < Math.abs(best - q))) best = v; } this._semAgulha = false; if (best != null) { this.encaixe = best; return best; } return q; },
  // melhor deslocamento dq para um grupo de pontas (de e fim+1 dos blocos que se mexem)
  encaixaGrupo(dq, pontas, ignora) { this.encaixe = null; if (!this.ima) return dq; const tol = 8 / this.pxq, alvos = this.pontosEncaixe(ignora); let best = null, onde = null;
    for (const p of pontas) for (const v of alvos) { const d = v - (p + dq); if (Math.abs(d) <= tol && (best == null || Math.abs(d) < Math.abs(best))) { best = d; onde = v; } }
    if (best != null) { this.encaixe = onde; return dq + best; } return dq; },

  /* ---------- foto/volta dos blocos (para arrastos) ---------- */
  foto(c) { if (c.k === 'n') return { c, nos: [c.n, ...Modelo.todos({ raiz: c.n.filhos || [] })].map(x => ({ x, de: x.de, ate: x.ate, ch: clone(x.chaves || {}) })), tr: c.n.trilha, en: clone(c.n.entra), sa: clone(c.n.sai) };
    if (c.k === 'a') return { c, a: { ...c.a } }; if (c.k === 'g') return { c, g: clone(c.g) }; return { c, ef: { ...c.ef } }; },
  volta(f) { if (f.nos) { for (const o of f.nos) { o.x.de = o.de; o.x.ate = o.ate; o.x.chaves = clone(o.ch); } f.c.n.trilha = f.tr; f.c.n.entra = clone(f.en); f.c.n.sai = clone(f.sa); if (!f.en) delete f.c.n.entra; if (!f.sa) delete f.c.n.sai; }
    else if (f.a) { for (const k of Object.keys(f.c.a)) delete f.c.a[k]; Object.assign(f.c.a, f.a); } else if (f.g) { for (const k of Object.keys(f.c.g)) delete f.c.g[k]; Object.assign(f.c.g, clone(f.g)); } else { for (const k of Object.keys(f.c.ef)) delete f.c.ef[k]; Object.assign(f.c.ef, f.ef); } },
  // anda dq quadros (a partir da foto): a camada, o que tem dentro e as chaves
  anda(f, dq) { if (f.nos) for (const o of f.nos) { o.x.de = (o.de || 0) + dq; if (o.de == null && !dq) delete o.x.de; if (o.ate != null) o.x.ate = o.ate + dq; o.x.chaves = Object.fromEntries(Object.entries(o.ch).map(([k, v]) => [+k + dq, v])); }
    else if (f.a) f.c.a.de = Math.max(0, (f.a.de || 0) + dq); else if (f.g) { f.c.g.de = f.g.de + dq; f.c.g.ate = f.g.ate + dq; if (Array.isArray(f.g.pal)) f.c.g.pal = f.g.pal.map(w => Array.isArray(w) ? [w[0], ...(w.slice(1).map(v => typeof v === 'number' ? v + dq : v))] : w); }
    else { if (f.ef.de != null) f.c.ef.de = f.ef.de + dq; if (f.ef.ate != null) f.c.ef.ate = f.ef.ate + dq; } },
  desloca(c, dq) { this.anda(this.foto(c), dq); },

  /* ---------- mover (meio do bloco): tempo e trilha; Alt = duplicar ---------- */
  move(e, p, c0) {
    const P = App.P; let cls = this.escolhidos().filter(c => !this.travada(c)); if (!cls.length) return;
    this.congela(); this.L = this.layout();
    if (e.altKey) { const novos = this.duplica(cls); if (!novos.length) return; this.L = this.layout(); cls = novos.map(id => this.clipe(id)).filter(Boolean); this.sel = new Set(novos); this._dup = true; }
    const fotos = cls.map(c => this.foto(c)), r0 = p.row, ids = new Set(cls.map(c => c.id)), movendo = new Set(cls.map(c => c.n || c.a).filter(Boolean));
    const pontas = cls.flatMap(c => [c.de, c.fim + 1]), minDe = Math.min(...cls.map(c => c.de)), maxFimN = Math.max(-1, ...cls.filter(c => c.k === 'n').map(c => c.fim)), tr0 = new Map(cls.map(c => [c.id, c.k === 'n' ? +c.n.trilha || c.tr : c.k === 'a' ? +c.a.trilha || c.tr : c.tr])); // a trilha gravada (a cópia do Alt nasce na trilha do original)
    let dq = 0, dt = 0, mexeu = false;
    this.arr = { lay: { semZ: true, movendo }, ruim: new Set(), rows: this.rows }; const nV0 = this.L.nV, nA0 = this.L.nA;
    this.arrastar(e, pp => {
      let nd = Math.round(pp.q - p.q); if (!mexeu && Math.abs(pp.x - p.x) < 3 && Math.abs(pp.y - p.y) < 3) return; mexeu = true;
      nd = this.encaixaGrupo(nd, pontas, ids); nd = Math.max(nd, -minDe); if (maxFimN >= 0) nd = Math.min(nd, P.duracao - 1 - maxFimN);
      // trilha: quantas linhas do mesmo lado o mouse andou
      let ndt = 0; const rr = pp.row; if (rr && r0 && rr.lado === r0.lado && (rr.lado === 'v' || rr.lado === 'a')) ndt = rr.tr - r0.tr;
      else if (pp.y < this.RG + (this.rows.find(r => r.lado === 'v')?.y ?? 0) - this.sy && r0?.lado === 'v') ndt = this.L.nV - r0.tr; // acima da trilha de cima = trilha nova
      const doLado = cls.filter(c => c.lado === r0?.lado).map(c => tr0.get(c.id)); ndt = clamp(ndt, 1 - Math.min(...doLado, 99), (r0?.lado === 'a' ? nA0 : nV0) - Math.max(...doLado, 1));
      if (nd === dq && ndt === dt) return; dq = nd; dt = ndt;
      for (const f of fotos) { this.volta(f); this.anda(f, dq); const c = f.c; if (c.k === 'n' && c.lado === r0?.lado) c.n.trilha = tr0.get(c.id) + dt; if (c.k === 'a' && c.lado === r0?.lado) c.a.trilha = tr0.get(c.id) + dt;
        if (c.k === 'n' && c.n.ate == null && dq) c.n.ate = Math.min(P.duracao - 1, Modelo.ultimoQuadro(P) + dq); } // bloco "até o fim" passa a ter um tamanho (como no Premiere)
      this.L = this.layout(this.arr.lay); this.arr.ruim = new Set(cls.filter(c => { const n = this.clipe(c.id); return n && (c.k === 'n' || c.k === 'a') && n.tr !== (c.k === 'n' ? c.n.trilha : c.a.trilha); }).map(c => c.id));
      this.desenha(); App.pinta();
    }, () => {
      const ruim = this.arr?.ruim?.size; this.arr = null; this.encaixe = null;
      if (ruim) { const nm = this.sobrescreve(cls, movendo);
        if (!nm) { for (const f of fotos) this.volta(f); if (this._dup) { this.apaga(cls, { quieto: true }); } this._dup = false; UI.toast('Não deu para sobrescrever o bloco de baixo (som carregando ou em repetição): o bloco voltou.', { kind: 'warn' }); return App.atualiza({ semLado: true }); }
        this._dup = false; this.ordena(); this.congela(); UI.toast(`Sobrescreveu ${nm} (Ctrl+Z desfaz)`); return App.commit('Sobrescrever'); }
      if (!mexeu && !this._dup) { if (!e.shiftKey && !e.ctrlKey && this.sel.size > 1) this.escolhe([c0.id]); return; }
      this._dup = false; this.ordena(); this.congela(); App.commit(e.altKey ? 'Duplicar bloco' : dt ? 'Mover para outra trilha' : 'Mover no tempo');
    });
  },
  // SOBRESCREVER (como soltar em cima de outro bloco no Premiere): o pedaço do bloco de baixo que fica embaixo do que chegou sai
  // (corta nas pontas e apaga o meio). Devolve os nomes, ou null se não deu (aí o arrasto volta)
  sobrescreve(cls, movendo) {
    const nomes = new Set(); for (let volta = 0; volta < 60; volta++) {
      const L = this.layout({ semZ: true, movendo }), lista = [...L.v, ...L.a]; let feito = false;
      for (const m of cls) { const o = m.n || m.a; if (!o) continue; const t = +o.trilha, lado = m.n ? 'v' : 'a', mc = lista.find(x => (x.n || x.a) === o); if (!mc) continue;
        const x = lista.find(y => y.lado === lado && y.tr === t && !movendo.has(y.n || y.a) && y.de <= mc.fim && y.fim >= mc.de); if (!x) continue;
        if (this.travada(x)) return null; nomes.add('"' + (x.n?.nome || x.a?.nome) + '"');
        if (x.de < mc.de) { if (!this.corta(x, mc.de)) return null; }
        else if (x.fim > mc.fim) { if (!this.corta(x, mc.fim + 1)) return null; }
        else this.apaga([x], { quieto: true });
        feito = true; break; }
      if (!feito) return [...nomes].join(', ') || null;
    } return null;
  },
  // Alt+arrastar: cópia dos blocos escolhidos, no mesmo lugar (o arrasto leva a cópia)
  duplica(cls) { const P = App.P, ids = [];
    for (const c of cls) {
      if (c.k === 'n') { const n = clone(c.n); Modelo.cada([n], x => { x.id = uid('n'); }); n.nome = c.n.nome; P.raiz.splice(P.raiz.indexOf(c.n), 0, n); ids.push('n:' + n.id); }
      else if (c.k === 'a') { const a = clone(c.a); a.id = uid('au'); P.audios.push(a); ids.push('a:' + a.id); }
    } return ids; },

  /* ---------- aparar as pontas (normal ou em ondulação) ---------- */
  apara(e, p, c, ponta, ondula) {
    const P = App.P, fps = P.fps; this.congela(); this.L = this.layout(); c = this.clipe(c.id);
    const mesma = this.L[{ v: 'v', a: 'a', c: 'c', t: 'te' }[c.lado]].filter(x => x !== c && x.tr === c.tr);
    const antes = Math.max(-1, ...mesma.filter(x => x.fim < c.de).map(x => x.fim)), depois = Math.min(Infinity, ...mesma.filter(x => x.de > c.fim).map(x => x.de));
    const f = this.foto(c), depoisDe = ondula ? this.L.todos.filter(x => x !== c && x.de > (ponta === 'ini' ? c.de : c.fim) && !this.travada(x)).map(x => this.foto(x)) : [];
    const marc0 = (P.marcadores || []).map(m => m.q), b = c.k === 'a' ? Som.buf.get(c.a.arq) : null; if (c.k === 'a' && !b) return UI.toast('O som ainda está carregando');
    let d = 0, mexeu = false;
    this.arr = { lay: { semZ: true }, ruim: new Set() };
    this.arrastar(e, pp => {
      let alvoQ = ponta === 'ini' ? c.de + Math.round(pp.q - p.q) : c.fim + 1 + Math.round(pp.q - p.q); alvoQ = this.encaixa(alvoQ, { ignora: new Set([c.id]) });
      let nd = alvoQ - (ponta === 'ini' ? c.de : c.fim + 1); if (nd === d && mexeu) return; mexeu = true;
      // limites
      if (ponta === 'ini') { nd = Math.min(nd, c.fim - c.de); if (!ondula) nd = Math.max(nd, antes + 1 - c.de); nd = Math.max(nd, -c.de); }
      else { nd = Math.max(nd, c.de - c.fim); if (!ondula) nd = Math.min(nd, depois - 1 - c.fim); if (c.k === 'n') nd = Math.min(nd, P.duracao - 1 - c.fim); }
      if (c.k === 'a') { const ini0 = Som.ini(f.a), comp0 = Som.compr(f.a, b), nat = b.duration;
        if (ponta === 'ini') { nd = Math.max(nd, -Math.floor(ini0 * fps)); } else if (!f.a.loop) nd = Math.min(nd, Math.floor((nat - ini0 - comp0) * fps)); }
      d = nd; this.volta(f); for (const g of depoisDe) this.volta(g); P.marcadores?.forEach((m, i) => { m.q = marc0[i]; });
      if (c.k === 'n') { const n = c.n;
        if (ponta === 'ini') { if (ondula) { this.anda(f, -d); n.de = c.de; if (n.ate != null || d) n.ate = c.fim - d; } else n.de = c.de + d; } // ondulação no começo: o começo fica, o conteúdo anda
        else n.ate = c.fim + d >= P.duracao - 1 && f.nos[0].ate == null ? null : c.fim + d; }
      else if (c.k === 'a') { const a = c.a, ini0 = Som.ini(f.a), comp0 = Som.compr(f.a, b);
        if (ponta === 'ini') { a.ini = round(Math.max(0, ini0 + d / fps), 3); if (!a.ini) delete a.ini; a.dur = round(Math.max(1 / fps, comp0 - d / fps), 3); if (!ondula) a.de = c.de + d; }
        else { a.dur = round(Math.max(1 / fps, comp0 + d / fps), 3); if (!a.loop && Math.abs(a.dur - (b.duration - ini0)) < .5 / fps) delete a.dur; } }
      else if (c.k === 'g') { if (ponta === 'ini') c.g.de = c.de + d; else c.g.ate = c.fim + d; }
      else { if (ponta === 'ini') c.ef.de = c.de + d; else c.ef.ate = c.fim + d; }
      if (ondula) { const sh = ponta === 'ini' ? -d : d; for (const g of depoisDe) this.anda(g, sh); P.marcadores?.forEach((m, i) => { if (marc0[i] > (ponta === 'ini' ? c.de : c.fim)) m.q = marc0[i] + sh; }); }
      this.L = this.layout(this.arr.lay); this.rows = this.linhasPR(this.L); this.desenha(); App.pinta();
      if (ponta === 'ini' && !ondula) App.setQ(clamp(c.de + d, 0, Modelo.ultimoQuadro(P))); else if (ponta === 'fim') App.setQ(clamp(c.fim + d, 0, Modelo.ultimoQuadro(P)));
    }, () => { this.arr = null; this.encaixe = null; if (!mexeu || !d) return this.desenha(); App.commit(ondula ? 'Aparar em ondulação' : 'Aparar'); });
  },
  // arrastar dentro da caixa da transição = muda a duração (como puxar a ponta da transição no Premiere)
  arrastaTransicao(e, p, c, lado) {
    const P = App.P, fps = P.fps, tam = c.fim - c.de + 1; this.escolhe([`x:${lado}:${c.id}`]); this.congela(); let mexeu = false;
    this.arrastar(e, pp => { const qq = lado === 'entra' ? Math.round(pp.q - c.de) : Math.round(c.fim + 1 - pp.q), v = clamp(qq, 1, Math.min(lado === 'entra' ? tam : tam, 240)); mexeu = true;
      if (c.k === 'n') { const n = c.n; if (lado === 'sai' && n.ate == null) n.ate = c.fim; n[lado] = { tipo: n[lado]?.tipo || 'aparecer', q: v }; }
      else { c.a[lado === 'entra' ? 'fi' : 'fo'] = round(v / fps, 2); }
      this.desenha(); App.pinta(); }, () => { if (mexeu) App.commit('Duração da transição', { semLado: true }); });
  },

  /* ---------- cortar (navalha / Ctrl+K) ---------- */
  corta(c, q) {
    const P = App.P; if (q <= c.de || q > c.fim) return false;
    if (c.k === 'n') { const n = c.n, k = clone(n); Modelo.cada([k], x => { x.id = uid('n'); }); k.nome = n.nome; k.de = q; k.ate = n.ate; n.ate = q - 1; delete n.sai; delete k.entra; k.trilha = n.trilha; P.raiz.splice(P.raiz.indexOf(n), 0, k); if (this.sel.has(c.id)) this.sel.add('n:' + k.id); return true; }
    if (c.k === 'a') { const a = c.a, b = Som.buf.get(a.arq); if (!b) { UI.toast('O som ainda está carregando'); return false; } if (a.loop) { UI.toast('Som em repetição (↻): tire a repetição para cortar', { kind: 'warn' }); return false; }
      const fps = P.fps, de = a.de || 0, ini = Som.ini(a), comp = Som.compr(a, b), t = (q - de) / fps; if (t <= 0 || t >= comp) return false;
      const k = clone(a); k.id = uid('au'); a.dur = round(t, 3); delete a.fo; k.de = q; k.ini = round(ini + t, 3); k.dur = round(comp - t, 3); delete k.fi; P.audios.splice(P.audios.indexOf(a) + 1, 0, k); if (this.sel.has(c.id)) this.sel.add('a:' + k.id); return true; }
    if (c.k === 'g') { const k = clone(c.g); c.g.ate = q - 1; k.de = q; delete k.pal; P.legendas.splice(P.legendas.indexOf(c.g) + 1, 0, k); return true; }
    if (c.k === 't') { const k = clone(c.ef); if (k.id) k.id = uid('e'); c.ef.ate = q - 1; k.de = q; P.efeitos.tela.splice(P.efeitos.tela.indexOf(c.ef) + 1, 0, k); return true; }
    return false;
  },
  cortaTudo(q, soAlvo) { let n = 0; for (const c of this.layout().todos.slice()) { if (this.travada(c)) continue; if (soAlvo && (c.lado === 'v' || c.lado === 'a') && this.semAlvo.has(c.lado + c.tr)) continue; if (this.corta(c, q)) n++; } return n; },
  // Ctrl+K: na agulha, nas trilhas de destino (ou só nos blocos escolhidos que passam pela agulha)
  adicionaEdicao(todas) { const q = App.q; this.congela(); this.L = this.layout(); let n = 0;
    const esc = this.escolhidos().filter(c => q > c.de && q <= c.fim && !this.travada(c));
    if (esc.length && !todas) { for (const c of esc) if (this.corta(c, q)) n++; } else n = this.cortaTudo(q, !todas);
    if (n) App.commit(n === 1 ? 'Adicionar edição' : `Adicionar edição (${n} blocos)`); else UI.toast('Nenhum bloco passa pela agulha nas trilhas de destino'); },

  /* ---------- apagar / ondulação ---------- */
  apaga(cls, o = {}) { const P = App.P;
    for (const c of cls) { if (c.k === 'n') P.raiz.splice(P.raiz.indexOf(c.n), 1); else if (c.k === 'a') P.audios.splice(P.audios.indexOf(c.a), 1); else if (c.k === 'g') P.legendas.splice(P.legendas.indexOf(c.g), 1); else if (c.k === 't') P.efeitos.tela.splice(P.efeitos.tela.indexOf(c.ef), 1); }
    for (const c of cls) this.sel.delete(c.id); if (cls.some(c => (c.n || c.a)?.id === App.sel)) App.sel = null; if (!o.quieto) App.commit(cls.length > 1 ? `Apagar ${cls.length} blocos` : 'Apagar bloco'); },
  // fecha o buraco [de, de+L-1] em todas as trilhas sem cadeado: o que vem depois anda L para a esquerda.
  // Um bloco de outra trilha que passa por cima do buraco impede (como no Premiere, com a sincronia ligada) — menos os que não mexem
  // depois dali (só uma chave antes; ex.: o fundo), que só encurtam.
  // ESPAÇO VAZIO embaixo do mouse numa trilha de vídeo, áudio ou legendas (C1): do fim do bloco de antes (ou do começo) até o próximo.
  // Clique (ou botão direito) escolhe; Delete ou o menu apagam (pedido da dona, 06/11/2026). Sem bloco depois = nada a apagar.
  lacunaEm(p) {
    const r = p?.row; if (!r || !['v', 'a', 'c'].includes(r.lado) || this.estT(r.lado, r.tr).trava) return null;
    const cl = (this.L[r.lado] || []).filter(x => r.lado === 'c' || x.tr === r.tr), antes = Math.max(-1, ...cl.filter(x => x.fim < p.q).map(x => x.fim)), depois = Math.min(...cl.filter(x => x.de > p.q).map(x => x.de));
    return Number.isFinite(depois) && depois - 1 >= antes + 1 ? { lado: r.lado, tr: r.tr, de: antes + 1, fim: depois - 1 } : null;
  },
  fechaBuraco(de, L, ignora = new Set()) {
    const P = App.P, fim = de + L - 1, lay = this.layout(), muda = [], encurta = [];
    const ajusta = [];
    for (const c of lay.todos) { if (ignora.has(c.id) || this.travada(c)) continue; if (c.fim < de) continue; if (c.de > fim) { muda.push(c); continue; }
      if (c.k === 'n' && c.de < de && c.fim >= fim && this.parado(c.n, de)) { encurta.push(c); continue; }
      if ((c.k === 'g' || c.k === 't') && !(c.de >= de && c.fim <= fim)) { ajusta.push(c); continue; } // legenda/efeito de tela: encolhe
      return { erro: `${c.lado === 'c' ? 'C1' : c.lado.toUpperCase() + c.tr}: "${(c.n?.nome || c.a?.nome || c.g?.texto || '').slice(0, 30)}" passa por cima do buraco (ponha o cadeado nessa trilha para ela não andar)` }; }
    for (const c of muda) this.desloca(c, -L); for (const c of encurta) { if (c.n.ate != null) c.n.ate = Math.max(c.n.de || 0, c.n.ate - L); }
    for (const c of ajusta) { const o = c.g || c.ef, a0 = c.de, b0 = c.fim, na = a0 < de ? a0 : de, nb = b0 > fim ? b0 - L : de - 1; o.de = na; o.ate = Math.max(na, nb); if (c.g) delete c.g.pal; }
    for (const k of Object.keys(P.camera?.chaves || {}).map(Number).sort((a, b) => a - b)) { if (k > fim) { P.camera.chaves[k - L] = P.camera.chaves[k]; delete P.camera.chaves[k]; } }
    for (const m of P.marcadores || []) if (m.q > fim) m.q -= L;
    return { ok: true, n: muda.length };
  },
  parado(n, desde) { let ok = true; Modelo.cada([n], x => { for (const k of Object.keys(x.chaves || {})) if (+k >= desde) ok = false; }); return ok; },
  exclusaoOndulacao() {
    const P = App.P; this.congela(); this.L = this.layout();
    if (this.lacuna) { const g = this.lacuna; this.lacuna = null; const r = this.fechaBuraco(g.de, g.fim - g.de + 1); if (r.erro) { this.desenha(); return UI.toast('Não dá para fechar o buraco: ' + r.erro, { kind: 'warn' }); } return App.commit('Exclusão em ondulação (lacuna)'); }
    const cls = this.escolhidos().filter(c => !c.id.startsWith('x:') && !this.travada(c)); if (!cls.length) return UI.toast('Escolha um bloco ou clique num buraco entre dois blocos');
    const antes = JSON.stringify(P), ids = new Set(cls.map(c => c.id)); cls.sort((a, b) => b.de - a.de);
    this.apaga(cls, { quieto: true });
    for (const c of cls) { const r = this.fechaBuraco(c.de, c.fim - c.de + 1, ids); if (r.erro) { App.troca(JSON.parse(antes)); return UI.toast('Exclusão em ondulação não deu: ' + r.erro + '. Use Delete (deixa o buraco).', { kind: 'warn' }); } }
    App.commit('Exclusão em ondulação');
  },
  // Q / W: apara até a agulha e fecha o buraco
  aparaAgulha(lado) {
    const P = App.P, q = App.q; this.congela(); this.L = this.layout();
    const alvo = this.L.todos.filter(c => (c.lado === 'v' || c.lado === 'a') && !this.semAlvo.has(c.lado + c.tr) && !this.travada(c) && c.de < q && c.fim >= q);
    if (!alvo.length) return UI.toast('Nenhum bloco embaixo da agulha nas trilhas de destino');
    const antes = JSON.stringify(P);
    if (lado === 'q') { const de = Math.max(...alvo.map(c => c.de)), L = q - de; for (const c of alvo) { const r = this.cortaFrente(c, q); if (!r) { App.troca(JSON.parse(antes)); return; } }
      const r = this.fechaBuraco(de, L); if (r.erro) { App.troca(JSON.parse(antes)); return UI.toast('Não deu: ' + r.erro, { kind: 'warn' }); }
      App.setQ(de); return App.commit('Aparar o começo até a agulha (Q)'); }
    const fim = Math.min(...alvo.map(c => c.fim)), L = fim - q + 1; for (const c of alvo) this.cortaAtras(c, q);
    const r = this.fechaBuraco(q, L); if (r.erro) { App.troca(JSON.parse(antes)); return UI.toast('Não deu: ' + r.erro, { kind: 'warn' }); }
    App.commit('Aparar o fim até a agulha (W)');
  },
  cortaFrente(c, q) { const P = App.P; if (c.k === 'n') { c.n.de = q; return true; } const b = Som.buf.get(c.a.arq); if (!b) { UI.toast('O som ainda está carregando'); return false; } const d = (q - c.de) / P.fps, comp = Som.compr(c.a, b); c.a.ini = round(Som.ini(c.a) + d, 3); c.a.dur = round(comp - d, 3); c.a.de = q; return true; },
  cortaAtras(c, q) { const P = App.P; if (c.k === 'n') { c.n.ate = q - 1; delete c.n.sai; return; } c.a.dur = round((q - c.de) / P.fps, 3); delete c.a.fo; },

  /* ---------- transições padrão (Ctrl+D / Shift+D) e ativar (Shift+E) ---------- */
  transicaoPadrao(video, audio) {
    const P = App.P, s = this.escolhidos(), q = App.q, um = P.fps; this.congela(); let n = 0; const L = this.layout();
    const cls = s.length ? s : L.todos.filter(c => (c.lado === 'v' || c.lado === 'a') && !this.semAlvo.has(c.lado + c.tr) && (c.de === q || c.fim + 1 === q));
    for (const c of cls) { if (this.travada(c)) continue; const tam = c.fim - c.de + 1, qq = Math.max(1, Math.min(um, Math.floor(tam / 2))), ini = !s.length ? c.de === q : true, fim = !s.length ? c.fim + 1 === q : true;
      if (video && c.k === 'n') { if (ini) { c.n.entra = { tipo: 'aparecer', q: qq }; n++; } if (fim) { if (c.n.ate == null) c.n.ate = c.fim; c.n.sai = { tipo: 'aparecer', q: qq }; n++; } }
      if (audio && c.k === 'a') { if (ini) { c.a.fi = round(qq / P.fps, 2); n++; } if (fim) { c.a.fo = round(qq / P.fps, 2); n++; } } }
    if (n) App.commit(video && audio ? 'Transições padrão' : video ? 'Transição de vídeo padrão (Dissolução cruzada)' : 'Transição de áudio padrão (Potência constante)'); else UI.toast('Escolha blocos ou ponha a agulha num ponto de edição');
  },
  ativa() { const cls = this.escolhidos().filter(c => c.k === 'n' || c.k === 'a'); if (!cls.length) return; this.congela(); const liga = cls.some(c => c.k === 'n' ? c.n.vis === false : c.a.mudo);
    for (const c of cls) { if (c.k === 'n') c.n.vis = liga; else c.a.mudo = !liga; } App.commit(liga ? 'Ativar' : 'Desativar'); },

  /* ---------- copiar / colar ---------- */
  copiar() { const cls = this.escolhidos().filter(c => c.k === 'n' || c.k === 'a' || c.k === 'g'); if (!cls.length) return; const de0 = Math.min(...cls.map(c => c.de));
    this.copia = cls.map(c => ({ k: c.k, o: clone(c.n || c.a || c.g), tr: c.tr, rel: c.de - de0 })); UI.toast(cls.length > 1 ? `${cls.length} blocos copiados` : 'Bloco copiado'); },
  colar() { if (!this.copia?.length) return; const P = App.P, q = App.q; this.congela(); const novos = [];
    for (const it of this.copia) { const o = clone(it.o), dq = q + it.rel - (it.o.de || 0);
      if (it.k === 'n') { Modelo.cada([o], x => { x.id = uid('n'); }); P.raiz.unshift(o); o.trilha = it.tr; this.desloca({ k: 'n', n: o }, dq); novos.push('n:' + o.id); }
      else if (it.k === 'a') { o.id = uid('au'); o.trilha = it.tr; o.de = Math.max(0, (o.de || 0) + dq); P.audios.push(o); novos.push('a:' + o.id); }
      else { o.de += dq; o.ate += dq; delete o.pal; P.legendas.push(o); } }
    this.congela(); this.ordena(); this.sel = new Set(novos); App.commit('Colar'); },

  /* ---------- marcadores e entrada/saída ---------- */
  marcador() { const P = App.P, q = App.q; P.marcadores ||= []; const ja = P.marcadores.find(m => m.q === q); if (ja) return this.editaMarcador(ja); const m = { id: uid('mk'), q, nome: '', cor: '#3fbf61' }; P.marcadores.push(m); P.marcadores.sort((a, b) => a.q - b.q); this.selMarca = m.id; App.commit('Adicionar marcador', { semLado: true }); },
  async editaMarcador(m) {
    const body = h(`<div class="pr-mk"><label>Nome<input type="text" data-nm value="${esc(m.nome || '')}"></label><label>Comentários<textarea data-cm rows="3">${esc(m.nota || '')}</textarea></label>
      <div class="pr-mk-cores">${this.MARC.map(([c, n]) => `<button class="${(m.cor || '#3fbf61') === c ? 'on' : ''}" data-c="${c}" title="${n}" style="--c:${c}"></button>`).join('')}</div><small>Tempo: ${this.tc(m.q)}</small></div>`);
    let cor = m.cor || '#3fbf61'; $$('[data-c]', body).forEach(b => b.onclick = () => { cor = b.dataset.c; $$('[data-c]', body).forEach(x => x.classList.toggle('on', x === b)); });
    const r = await UI.modal({ title: 'Marcador', icon: 'marker', width: 360, body, buttons: [{ label: 'Apagar', value: 'apagar', kind: 'danger' }, { label: 'Cancelar', value: null }, { label: 'OK', kind: 'primary', value: 'ok' }] });
    if (r === 'apagar') { App.P.marcadores = App.P.marcadores.filter(x => x !== m); return App.commit('Apagar marcador', { semLado: true }); }
    if (r !== 'ok') return; m.nome = $('[data-nm]', body).value.trim().slice(0, 60); const nota = $('[data-cm]', body).value.trim().slice(0, 400); if (nota) m.nota = nota; else delete m.nota; m.cor = cor; App.commit('Marcador', { semLado: true });
  },
  vaiMarcador(dir) { const P = App.P, l = (P.marcadores || []).map(m => m.q).sort((a, b) => a - b), q = App.q, alvo = dir > 0 ? l.find(x => x > q) : l.reverse().find(x => x < q); if (alvo != null) App.setQ(alvo); },
  poeIO(k) { const P = App.P, q = App.q, ult = Modelo.ultimoQuadro(P), t = Folha.trecho ? { ...Folha.trecho } : { de: 0, ate: ult }; if (k === 'i') { t.de = q; if (t.ate < q) t.ate = ult; } else { t.ate = q; if (t.de > q) t.de = 0; } Folha.trecho = t; this.desenha(); },
  tiraIO(k) { const P = App.P, t = Folha.trecho; if (!t) return; if (k === 'x') Folha.trecho = null; else if (k === 'i') { if (t.ate >= Modelo.ultimoQuadro(P)) Folha.trecho = null; else t.de = 0; } else { if (t.de <= 0) Folha.trecho = null; else t.ate = Modelo.ultimoQuadro(P); } this.desenha(); },
  pontosEdicao(todas) { const s = new Set([0]); for (const c of this.layout().todos) { if ((c.lado === 'v' || c.lado === 'a') && !todas && this.semAlvo.has(c.lado + c.tr)) continue; if (c.lado === 'c' || c.lado === 't') continue; s.add(c.de); s.add(c.fim + 1); } return [...s].sort((a, b) => a - b); },
  vaiEdicao(dir, todas) { const l = this.pontosEdicao(todas), q = App.q, alvo = dir > 0 ? l.find(x => x > q) : l.reverse().find(x => x < q); if (alvo != null) App.setQ(Math.min(alvo, Modelo.ultimoQuadro(App.P))); },

  /* ---------- J K L ---------- */
  shuttle(r) {
    this.vel = r; cancelAnimationFrame(this._sh);
    if (r === 0) { App.pausa(); return; }
    if (r === 1) { if (!App.tocando) App.tocar(); return; }
    App.pausa(); const t0 = performance.now(), q0 = App.q, fps = App.P.fps, ult = Modelo.ultimoQuadro(App.P);
    const passo = () => { if (this.vel !== r) return; const q = Math.round(q0 + (performance.now() - t0) / 1000 * fps * r); if (q < 0 || q > ult) { this.vel = 0; App.setQ(clamp(q, 0, ult)); return; } if (q !== App.q) { App.setQ(q); Lado.aoVivo?.(); } this._sh = requestAnimationFrame(passo); };
    this._sh = requestAnimationFrame(passo); UI.toast(`${r > 0 ? 'Para a frente' : 'Para trás'} ${Math.abs(r)}×`, { time: 900 });
  },
  paraShuttle() { if (this.vel && this.vel !== 1) { this.vel = 0; cancelAnimationFrame(this._sh); } else this.vel = 0; },

  /* ---------- teclado (só com a timeline em foco, no modo Vídeo) ---------- */
  tecla(e) {
    if (Folha.modo !== 'video' || !this.el || !App.P || !this.foco) return; if ($('#editor')?.classList.contains('hidden')) return;
    const alvo = e.target; if (alvo.closest?.('input,textarea,select,[contenteditable]') && alvo.type !== 'range' && alvo.type !== 'checkbox') return; if ($('#modal-root')?.children.length || document.querySelector('#ctx-root .ctx')) return;
    const k = e.key, kk = k.length === 1 ? k.toLowerCase() : k, ctrl = e.ctrlKey || e.metaKey, sh = e.shiftKey, alt = e.altKey;
    const feito = fn => { e.preventDefault(); e.stopImmediatePropagation(); fn(); };
    if (e.type === 'keyup') { if (kk === 'k') this.kSeg = false; return; }
    if (ctrl && !alt && kk === 'k') return feito(() => this.adicionaEdicao(sh));
    if (ctrl && !alt && kk === 'c') return feito(() => this.copiar());
    if (ctrl && !alt && kk === 'v') return feito(() => this.colar());
    if (ctrl && !alt && kk === 'x') { if (sh) return feito(() => this.tiraIO('x')); return feito(() => { this.copiar(); const cls = this.escolhidos().filter(c => !c.id.startsWith('x:') && !this.travada(c)); if (cls.length) { this.congela(); this.apaga(cls); } }); }
    if (ctrl && sh && !alt && kk === 'i') return feito(() => this.tiraIO('i'));
    if (ctrl && sh && !alt && kk === 'o') return feito(() => this.tiraIO('o'));
    if (ctrl && !alt && kk === 'a') return feito(() => sh ? this.escolhe([]) : this.escolhe(this.layout().todos.filter(c => !this.travada(c)).map(c => c.id)));
    if (ctrl && !alt && kk === 'd') return feito(() => this.transicaoPadrao(true, sh));
    if (ctrl && alt && kk === 'm') return feito(() => { const P = App.P; if (sh) { if (P.marcadores?.length) { P.marcadores = []; App.commit('Limpar todos os marcadores', { semLado: true }); } } else { const m = (P.marcadores || []).find(x => x.q === App.q); if (m) { P.marcadores = P.marcadores.filter(x => x !== m); App.commit('Limpar marcador', { semLado: true }); } } });
    if (ctrl && sh && kk === 'm') return feito(() => this.vaiMarcador(-1));
    if (ctrl && (kk === '=' || kk === '+' || kk === '-')) return; // zoom do navegador
    if (ctrl) return; // Ctrl+Z / Ctrl+Shift+Z / Ctrl+S…: com o App
    if (kk === ' ') return feito(() => { if (this.vel && this.vel !== 1) return this.shuttle(0); this.vel = App.tocando ? 0 : 1; App.tocar(); });
    if (kk === 'l' || kk === 'j') return feito(() => { if (this.kSeg) { App.pausa(); return App.setQ(App.q + (kk === 'l' ? 1 : -1), { som: true }); } const v = App.tocando && !this.vel ? 1 : this.vel; this.shuttle(kk === 'l' ? (v <= 0 ? 1 : Math.min(8, v * 2)) : (v >= 0 ? -1 : Math.max(-8, v * 2))); });
    if (kk === 'k') return feito(() => { this.kSeg = true; this.shuttle(0); });
    if (kk === 'v') return feito(() => this.setFerr('sel'));
    if (kk === 'b') return feito(() => this.setFerr('ondula'));
    if (kk === 'c') return feito(() => this.setFerr('navalha'));
    if (kk === 'h') return feito(() => this.setFerr('mao'));
    if (kk === 's' && !alt) return feito(() => this.trocaIma());
    if (kk === 'm' && !alt) return feito(() => sh ? this.vaiMarcador(1) : this.marcador());
    if (kk === 'i' && !alt) return feito(() => sh ? (Folha.trecho && App.setQ(Folha.trecho.de)) : this.poeIO('i'));
    if (kk === 'o' && !alt) return feito(() => sh ? (Folha.trecho && App.setQ(Folha.trecho.ate)) : this.poeIO('o'));
    if (kk === 'q' && !alt) return feito(() => this.aparaAgulha('q'));
    if (kk === 'w' && !alt) return feito(() => this.aparaAgulha('w'));
    if (kk === 'e' && sh) return feito(() => this.ativa());
    if (kk === 'e' || kk === 't' || kk === 'a') return feito(() => { }); // no Premiere são outras coisas; aqui não giram/deformam a camada sem querer
    if (k === 'Delete' || k === 'Backspace') return feito(() => {
      if (this.selMarca && !this.sel.size) { const P = App.P; P.marcadores = (P.marcadores || []).filter(m => m.id !== this.selMarca); this.selMarca = null; return App.commit('Apagar marcador', { semLado: true }); }
      if (sh || alt) return this.exclusaoOndulacao();
      if (this.lacuna) return this.exclusaoOndulacao();
      const tr = [...this.sel].filter(id => id.startsWith('x:')); if (tr.length) { this.congela(); for (const id of tr) { const [, lado, ...r] = id.split(':'), c = this.clipe(r.join(':')); if (!c) continue; if (c.k === 'n') delete c.n[lado]; else delete c.a[lado === 'entra' ? 'fi' : 'fo']; } this.sel.clear(); return App.commit('Apagar transição'); }
      const cls = this.escolhidos().filter(c => !this.travada(c)); if (cls.length) { this.congela(); this.apaga(cls); } });
    if (k === 'ArrowLeft' || k === 'ArrowRight') return feito(() => { App.pausa(); this.paraShuttle(); App.setQ(App.q + (k === 'ArrowRight' ? 1 : -1) * (sh ? 5 : 1), { som: true }); });
    if (k === 'ArrowUp' || k === 'ArrowDown') return feito(() => { App.pausa(); this.paraShuttle(); this.vaiEdicao(k === 'ArrowDown' ? 1 : -1, sh); });
    if (k === '+' || k === '=') return feito(() => this.zoomEm(this.pxq * 1.5));
    if (k === '-' || k === '_') return feito(() => this.zoomEm(this.pxq / 1.5));
    if (k === '\\') return feito(() => this.encaixaTudo());
    if (k === 'Escape') return feito(() => { this.lacuna = null; this.escolhe([]); });
  },

  /* ---------- dois cliques e menus ---------- */
  duplo(e) {
    const p = this.ponto(e);
    if (p.regua) { const mk = (App.P.marcadores || []).find(m => Math.abs(this.q2x(m.q) - p.x) < 6); if (mk) this.editaMarcador(mk); return; }
    const c = p.clip; if (!c) return;
    if (c.k === 'a') return CorteVoz.abrir(c.a); // como abrir no Monitor de origem
    if (c.k === 'g') return Lado.aba?.('som');
    if (c.k === 'n') { // como abrir uma sequência aninhada: vai para o modo Animação com a camada aberta
      const n = c.n; if (n.filhos) n.aberto = true; App.setQ(clamp(Math.max(App.q, c.de), c.de, c.fim)); Folha.setModo('anim'); App.selecionar(n.id); UI.toast('Modo Animação: as camadas e chaves de "' + n.nome + '"'); }
  },
  menu(e) {
    const p = this.ponto(e), P = App.P, q = clamp(Math.round(p.q), 0, Modelo.ultimoQuadro(P));
    if (p.regua) { const mk = (P.marcadores || []).find(m => Math.abs(this.q2x(m.q) - p.x) < 6);
      return UI.ctx(e.clientX, e.clientY, [{ head: this.tc(q) }, mk && { label: 'Editar marcador…', icon: 'marker', action: () => this.editaMarcador(mk) },
        { label: 'Adicionar marcador', icon: 'marker', key: 'M', action: () => { App.setQ(q); this.marcador(); } },
        { label: 'Ir para o próximo marcador', icon: 'next', key: 'Shift+M', action: () => this.vaiMarcador(1) }, { label: 'Ir para o marcador anterior', icon: 'prev', key: 'Ctrl+Shift+M', action: () => this.vaiMarcador(-1) },
        mk && { label: 'Limpar este marcador', icon: 'x', action: () => { P.marcadores = P.marcadores.filter(x => x !== mk); App.commit('Limpar marcador', { semLado: true }); } },
        P.marcadores?.length && { label: 'Limpar todos os marcadores', icon: 'trash', danger: true, key: 'Ctrl+Alt+Shift+M', action: () => { P.marcadores = []; App.commit('Limpar todos os marcadores', { semLado: true }); } },
        '-', { label: 'Marcar entrada', key: 'I', icon: 'start', action: () => { App.setQ(q); this.poeIO('i'); } }, { label: 'Marcar saída', key: 'O', icon: 'end', action: () => { App.setQ(q); this.poeIO('o'); } },
        Folha.trecho && { label: 'Limpar entrada e saída', key: 'Ctrl+Shift+X', icon: 'x', action: () => this.tiraIO('x') },
        Folha.trecho && { label: 'Citar o trecho de entrada/saída na IA', icon: 'sparkles', ai: true, action: () => Assistente.citar({ tipo: 'trecho', de: Folha.trecho.de, ate: Folha.trecho.ate }) },
        '-', { label: `Citar o quadro ${q + 1} em mensagens…`, icon: 'chat', action: () => Citacao.animacao(P, q, App.sel) }].filter(Boolean)); }
    const c = p.clip;
    if (!c) { this.lacuna = this.lacunaEm(p); this.desenha(); return UI.ctx(e.clientX, e.clientY, [{ head: this.tc(q) }, this.lacuna && { label: 'Apagar este espaço vazio (o resto anda para trás)', icon: 'ripple', key: 'Delete', action: () => this.exclusaoOndulacao() },
      this.copia && { label: 'Colar na agulha', icon: 'paste', key: 'Ctrl+V', action: () => this.colar() }, { label: 'Selecionar tudo', icon: 'marquee', key: 'Ctrl+A', action: () => this.escolhe(this.layout().todos.filter(x => !this.travada(x)).map(x => x.id)) }].filter(Boolean)); }
    if (this.travada(c)) return;
    const cls = this.escolhidos(), varios = cls.length > 1, nm = c.n?.nome || c.a?.nome || String(c.g?.texto || '').replace(/\*/g, '') || '';
    const rotulo = { label: 'Rótulo', icon: 'palette', sub: this.ROT.map(([cor, n]) => ({ label: n, iconHtml: `<i class="pr-rot" style="background:${cor}"></i>`, action: () => { this.congela(); for (const x of cls) { if (x.k === 'n') x.n.corTL = cor; if (x.k === 'a') x.a.corTL = cor; } App.commit('Rótulo: ' + n, { semLado: true }); } })).concat([{ label: 'Cor padrão', icon: 'x', action: () => { for (const x of cls) delete (x.n || x.a || {}).corTL; App.commit('Rótulo padrão', { semLado: true }); } }]) };
    const comum = [{ label: 'Recortar', icon: 'cut', key: 'Ctrl+X', action: () => { this.copiar(); this.congela(); this.apaga(cls.filter(x => !this.travada(x))); } }, { label: 'Copiar', icon: 'copy', key: 'Ctrl+C', action: () => this.copiar() }, this.copia && { label: 'Colar na agulha', icon: 'paste', key: 'Ctrl+V', action: () => this.colar() },
      { label: 'Apagar', icon: 'trash', key: 'Delete', action: () => { this.congela(); this.apaga(cls); } }, { label: 'Exclusão em ondulação', icon: 'ripple', key: 'Shift+Delete', action: () => this.exclusaoOndulacao() }];
    const dentro = App.q > c.de && App.q <= c.fim;
    if (c.k === 'n') { const n = c.n;
      return UI.ctx(e.clientX, e.clientY, [{ head: `${varios ? cls.length + ' blocos' : nm} · V${c.tr} · ${this.tc(c.de)} – ${this.tc(c.fim + 1)}` },
        { label: 'Ativar', icon: n.vis !== false ? 'check' : null, key: 'Shift+E', action: () => this.ativa() }, '-', ...comum.filter(Boolean),
        dentro && { label: 'Dividir na agulha', icon: 'split', key: 'Ctrl+K', action: () => this.adicionaEdicao(false) }, '-',
        { label: 'Aplicar transição padrão', icon: 'transition', key: 'Ctrl+D', action: () => this.transicaoPadrao(true, false) },
        !varios && n.tipo !== 'efeito' && { label: 'Entrada', icon: 'start', sub: [{ label: 'Nenhuma', icon: !n.entra ? 'check' : null, action: () => { delete n.entra; App.commit('Sem entrada'); } }, ...Object.entries(Modelo.ANIMS).map(([id, nmA]) => ({ label: nmA === 'Aparecer' ? 'Dissolução cruzada (aparecer)' : nmA, icon: n.entra?.tipo === id ? 'check' : null, action: () => { this.congela(); n.entra = { tipo: id, q: n.entra?.q || Math.round(P.fps * .5) }; App.commit('Entrada: ' + nmA); } }))] },
        !varios && n.tipo !== 'efeito' && { label: 'Saída', icon: 'end', sub: [{ label: 'Nenhuma', icon: !n.sai ? 'check' : null, action: () => { delete n.sai; App.commit('Sem saída'); } }, ...Object.entries(Modelo.ANIMS).map(([id, nmA]) => ({ label: nmA === 'Aparecer' ? 'Dissolução cruzada (sumir)' : nmA, icon: n.sai?.tipo === id ? 'check' : null, action: () => { this.congela(); if (n.ate == null) n.ate = c.fim; n.sai = { tipo: id, q: n.sai?.q || Math.round(P.fps * .5) }; App.commit('Saída: ' + nmA); } }))] },
        '-', rotulo, !varios && { label: 'Renomear…', icon: 'edit', action: async () => { const v = await UI.prompt({ title: 'Renomear o bloco', value: n.nome, ok: 'Renomear' }); if (v?.trim()) { n.nome = v.trim().slice(0, 80); App.commit('Renomear'); } } },
        !varios && { label: 'Abrir no modo Animação', icon: 'diamond', key: 'dois cliques', action: () => this.duplo(e) },
        '-', !varios && { label: `Citar na IA: ${nm}`, icon: 'sparkles', ai: true, action: () => Assistente.citar({ tipo: 'camada', id: n.id, nome: n.nome, q }) }].filter(Boolean));
    }
    if (c.k === 'a') { const a = c.a;
      return UI.ctx(e.clientX, e.clientY, [{ head: `${varios ? cls.length + ' blocos' : nm} · A${c.tr} · ${this.tc(c.de)} – ${this.tc(c.fim + 1)}` },
        { label: 'Ativar', icon: !a.mudo ? 'check' : null, key: 'Shift+E', action: () => this.ativa() }, '-', ...comum.filter(Boolean),
        dentro && { label: 'Dividir na agulha', icon: 'split', key: 'Ctrl+K', action: () => this.adicionaEdicao(false) }, '-',
        { label: 'Aplicar transição de áudio padrão', icon: 'transition', key: 'Shift+D', action: () => this.transicaoPadrao(false, true) },
        !varios && { label: a.fi ? 'Tirar o fade de entrada' : 'Fade de entrada (Potência constante)', icon: 'start', action: () => { this.congela(); if (a.fi) delete a.fi; else a.fi = .5; App.commit('Fade de entrada do som'); } },
        !varios && { label: a.fo ? 'Tirar o fade de saída' : 'Fade de saída (Potência constante)', icon: 'end', action: () => { this.congela(); if (a.fo) delete a.fo; else a.fo = .5; App.commit('Fade de saída do som'); } },
        !varios && { label: 'Editar o corte…', icon: 'cut', key: 'dois cliques', action: () => CorteVoz.abrir(a) }, !varios && { label: 'Limpar e nivelar a voz', icon: 'wand', action: () => Som.limpar(a) },
        '-', rotulo, !varios && { label: 'Renomear…', icon: 'edit', action: async () => { const v = await UI.prompt({ title: 'Renomear o som', value: a.nome, ok: 'Renomear' }); if (v?.trim()) { a.nome = v.trim().slice(0, 80); App.commit('Renomear'); } } }].filter(Boolean));
    }
    return UI.ctx(e.clientX, e.clientY, [{ head: nm.slice(0, 40) }, ...comum.filter(Boolean), dentro && { label: 'Dividir na agulha', icon: 'split', key: 'Ctrl+K', action: () => this.adicionaEdicao(false) }].filter(Boolean));
  },
  menuCfg(e) { const r = e.currentTarget.getBoundingClientRect(), t = (k, nm) => ({ label: nm, icon: !this.pref[k] ? 'check' : null, action: () => { this.pref[k] = !this.pref[k]; this.guardaPref(); this.desenha(); } });
    UI.ctx(r.left, r.bottom + 4, [{ head: 'Configurações de exibição' }, t('semMini', 'Mostrar miniaturas do vídeo'), t('semChaves', 'Mostrar as chaves nos blocos'),
      { label: 'Expandir todas as trilhas', icon: 'sliders', action: () => { this.pref.alt = {}; for (const r2 of this.rows) if (r2.lado === 'v' || r2.lado === 'a') this.pref.alt[r2.lado + r2.tr] = 84; this.guardaPref(); this.pinta(); } },
      { label: 'Recolher todas as trilhas', icon: 'sliders', action: () => { this.pref.alt = {}; for (const r2 of this.rows) if (r2.lado === 'v' || r2.lado === 'a') this.pref.alt[r2.lado + r2.tr] = 26; this.guardaPref(); this.pinta(); } },
      { label: 'Altura padrão das trilhas', icon: 'x', action: () => { delete this.pref.alt; this.guardaPref(); this.pinta(); } },
      '-', { label: 'Compactar trilhas', icon: 'sliders', action: () => this.compactar() }, { label: 'Mostrar a timeline toda', icon: 'zoomOut', key: '\\', action: () => this.encaixaTudo() }]); },
  async digitaTempo() { const el = $('.pr-tc', this.el); if (el.querySelector('input')) return; const i = h(`<input class="pr-tc-in" value="${this.tc(App.q)}">`); el.textContent = ''; el.appendChild(i); i.select();
    const fim = ok => { if (ok) { const q = this.lerTc(i.value); if (q != null) App.setQ(q); } el.textContent = this.tc(App.q); };
    i.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') fim(true); if (ev.key === 'Escape') fim(false); }; i.onblur = () => fim(true); },
  ajuda() {
    const L = [['Ferramentas', [['V', 'Seleção'], ['B', 'Edição em ondulação'], ['C', 'Navalha'], ['H', 'Mão']]],
      ['Tocar', [['Espaço', 'Tocar / parar'], ['J  K  L', 'Para trás / parar / para frente (aperte de novo: mais rápido)'], ['K + J / L', 'Um quadro'], ['← →', 'Um quadro (Shift: 5)'], ['↑ ↓', 'Ponto de edição anterior / seguinte'], ['Home / End', 'Começo / fim']]],
      ['Editar', [['Ctrl+K', 'Adicionar edição (cortar na agulha)'], ['Ctrl+Shift+K', 'Cortar em todas as trilhas'], ['Q / W', 'Aparar o começo / o fim até a agulha (em ondulação)'], ['Delete', 'Apagar (deixa o buraco)'], ['Shift+Delete', 'Exclusão em ondulação'], ['Shift+E', 'Ativar / desativar o bloco'], ['Ctrl+C / Ctrl+V / Ctrl+X', 'Copiar / colar na agulha / recortar'], ['Alt + arrastar', 'Duplicar'], ['Ctrl + arrastar a ponta', 'Aparar em ondulação'], ['Ctrl+D / Shift+D', 'Transição padrão de vídeo / de áudio'], ['Ctrl+Z / Ctrl+Shift+Z', 'Desfazer / refazer']]],
      ['Marcar', [['M', 'Marcador'], ['Shift+M / Ctrl+Shift+M', 'Próximo / anterior'], ['Ctrl+Alt+M', 'Limpar o marcador'], ['I / O', 'Entrada / saída'], ['Shift+I / Shift+O', 'Ir para a entrada / saída'], ['Ctrl+Shift+X', 'Limpar entrada e saída']]],
      ['Ver', [['+ / -', 'Zoom'], ['\\', 'Ver a timeline toda'], ['S', 'Encaixar'], ['Alt + rodinha', 'Zoom no mouse'], ['Shift + rodinha', 'Rolar as trilhas']]]];
    UI.modal({ title: 'Atalhos da timeline (iguais aos do Premiere)', icon: 'keyboard', width: 560, body: h(`<div class="pr-ajuda">${L.map(([t, l]) => `<div><b>${t}</b>${l.map(([k, d]) => `<p><kbd>${esc(k)}</kbd><span>${esc(d)}</span></p>`).join('')}</div>`).join('')}<small>Os atalhos valem com a timeline em foco (clique nela; a borda fica azul).</small></div>`), buttons: [{ label: 'OK', kind: 'primary', value: true }] });
  },
};

/* ---------- ligar na Folha (só o modo Vídeo muda) ---------- */
(() => {
  const base = { pinta: Folha.pinta, desenha: Folha.desenha, setModo: Folha.setModo, pintaModo: Folha.pintaModo };
  Folha.pinta = function () { if (this.modo === 'video' && App.P && TLP.liga()) return TLP.pinta(); return base.pinta.call(this); };
  Folha.desenha = function () { if (this.modo === 'video' && TLP.el) return TLP.desenha(); return base.desenha.call(this); };
  Folha.setModo = function (m) { base.setModo.call(this, m); TLP.aoModo(); TLP.pintaFoco(); };
  // o Folha.liga do modo Animação liga o resto (barra, Short, arrastar efeitos); no modo Vídeo a timeline nova já entra
  const liga0 = Folha.liga; Folha.liga = function () { const r = liga0.call(this); if (this.modo === 'video') TLP.aoModo(); return r; };
  addEventListener('keydown', e => TLP.tecla(e), true); addEventListener('keyup', e => TLP.tecla(e), true);
  addEventListener('pointerdown', e => { if (Folha.modo !== 'video' || !TLP.el) return; const em = !!e.target.closest?.('#editor .tl'); if (em !== TLP.foco) { TLP.foco = em; TLP.pintaFoco(); } }, true);
})();
