/* ===================== app.js — o editor de animação: estado, desfazer, salvar, palco (canvas infinito + câmera) e atalhos ===================== */
'use strict';
const App = {
  P: null, q: 0, sel: null, tocando: false, onion: false, ferr: 'mover', modoVista: 'mundo', vista: { x: 0, y: 0, z: .4 },
  desfazer: [], refazer: [], ultimo: null, salvoEm: 0,

  /* ---------- abrir / fechar ---------- */
  async abrir(P) {
    if (!P.temFundoPadrao) { P.temFundoPadrao = true; if (!Modelo.todos(P).some(n => n.fundoPadrao)) P.raiz.push(Modelo.fundoPadrao(P.w, P.h, P.fundo)); } // projetos de antes: a folha vira camada
    this.P = P; this.q = 0; this.sel = null; this.desfazer = []; this.refazer = []; this.ultimo = JSON.stringify(P);
    Promise.all(Object.values(P.personagens || {}).map(def => Arq.garantir(Modelo.chavesImgs(def)))).then(() => Icone.garanteNoEditor(P)); // personagens sem ícone/cor ganham (a cabeça e a cor que mais aparece)
    Telas.mostra('editor'); $('#proj-nome').textContent = P.nome; this.titulo();
    this.palco.liga(); this.enquadrar(); Arvore.pinta(); Folha.liga(); Lado.pinta(); Som.prepara(P);
    this.salvoTxt('Salvo neste computador');
  },
  async fechar() { this.pausa(); await this.salvarJa(); this.P = null; Telas.mostra('home'); Home.pinta(); this.titulo(); },
  titulo() { document.title = (this.P ? this.P.nome + ' — ' : '') + 'ANIMADOR · Estúdio Problems'; },

  /* ---------- mudanças, desfazer, salvar ---------- */
  // chame depois de mudar o projeto (o que estava antes vai para o desfazer)
  commit(rotulo, o = {}) {
    const agora = JSON.stringify(this.P); if (agora === this.ultimo) return this.atualiza(o);
    this.desfazer.push(this.ultimo); if (this.desfazer.length > 120) this.desfazer.shift(); this.refazer = []; this.ultimo = agora;
    this.P.modificado = Date.now(); this.salvarLogo(); this.atualiza(o);
  },
  undo() { if (!this.desfazer.length) return UI.toast('Nada para desfazer'); this.refazer.push(this.ultimo); this.ultimo = this.desfazer.pop(); this.troca(JSON.parse(this.ultimo)); },
  redo() { if (!this.refazer.length) return; this.desfazer.push(this.ultimo); this.ultimo = this.refazer.pop(); this.troca(JSON.parse(this.ultimo)); },
  troca(P) { const id = this.P.id; this.P = P; this.P.id = id; if (this.sel && !Modelo.achar(P, this.sel) && this.sel !== 'camera') this.sel = null; this.salvarLogo(); this.atualiza(); },
  atualiza(o = {}) { if (!o.semArvore) Arvore.pinta(); Folha.pinta(); if (!o.semLado) Lado.pinta(); this.pinta(); },
  _tSalvar: null,
  salvarLogo() { clearTimeout(this._tSalvar); this.salvoTxt('Salvando…'); this._tSalvar = setTimeout(() => this.salvarJa(), 700); },
  async salvarJa() {
    clearTimeout(this._tSalvar); if (!this.P) return;
    try { this.P.thumb = Render.miniatura(this.P, this.q); await DB.put('projetos', JSON.parse(JSON.stringify(this.P))); this.salvoTxt('Salvo neste computador'); EstudioConta?.espaco?.atualizar?.(); return true; }
    catch (e) { this.salvoTxt('Não salvou: ' + e.message); return false; }
  },
  salvoTxt(t) { const e = $('#salvo'); if (e) e.textContent = t; },

  /* ---------- quadro atual e reprodução ---------- */
  setQ(q, o = {}) {
    q = clamp(Math.round(q), 0, Modelo.ultimoQuadro(this.P)); if (q === this.q && !o.forca) return;
    this.q = q; Folha.pinta(); if (!this.tocando) Lado.pinta(); this.pinta(); if (o.som && !this.tocando) Som.raspa(q);
  },
  tocar() {
    if (this.tocando) return this.pausa(); if (this.q >= Modelo.ultimoQuadro(this.P)) this.q = 0;
    this.tocando = true; $('#b-tocar').innerHTML = ic('pause', 15); Som.toca(this.q);
    const t0 = performance.now(), q0 = this.q, fps = this.P.fps;
    const passo = () => {
      if (!this.tocando) return;
      let q = q0 + Math.floor((performance.now() - t0) / 1000 * fps);
      if (q > Modelo.ultimoQuadro(this.P)) { if (Folha.loop) { this.pausa(); this.q = 0; return this.tocar(); } this.pausa(); q = Modelo.ultimoQuadro(this.P); }
      if (q !== this.q) { this.q = q; Folha.pinta(); this.pinta(); }
      requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  },
  pausa() { if (!this.tocando) return; this.tocando = false; Som.para(); const b = $('#b-tocar'); if (b) b.innerHTML = ic('play', 15); Lado.pinta(); },

  /* ---------- seleção ---------- */
  selecionar(id, o = {}) { this.sel = id; Arvore.pinta(); Folha.pinta(); if (!o.semLado) Lado.pinta(); this.pinta(); },
  noSel() { return this.sel && this.sel !== 'camera' ? Modelo.achar(this.P, this.sel)?.no : null; },
  // matriz do pai do nó (pastas acima) no quadro atual: para mover no espaço certo
  matPai(id) { let m = new DOMMatrix(); for (const a of Modelo.ancestrais(this.P, id)) m = Render.matNo(m, Modelo.transf(a, this.q)); return m; },
  centroMundo() { return { x: this.P.w / 2, y: this.P.h / 2 }; },

  /* ---------- adicionar coisas ---------- */
  ondeColocar() { const s = this.noSel(); if (s?.tipo === 'pasta') return s.filhos; const r = s ? Modelo.achar(this.P, s.id) : null; return r ? r.lista : this.P.raiz; },
  inserir(n, rotulo, o = {}) {
    const lista = this.ondeColocar(), s = this.noSel(), i = s && lista.includes(s) ? lista.indexOf(s) : 0;
    // posição: centro da câmera, no espaço do pai
    const c = Modelo.camera(this.P, this.q), alvo = lista === this.P.raiz ? null : Modelo.todos(this.P).find(x => x.filhos === lista);
    const inv = alvo ? this.matPai(alvo.id).multiply(Render.matNo(new DOMMatrix(), Modelo.transf(alvo, this.q))).inverse() : new DOMMatrix();
    const p = inv.transformPoint(new DOMPoint(c.x, c.y)), esc0 = Object.values(n.chaves || {})[0]?.s ?? 1;
    n.de = this.q; n.chaves = { [this.q]: { x: Math.round(p.x), y: Math.round(p.y + (lista === this.P.raiz ? o.dy || 0 : 0)), r: 0, s: esc0, sx: 1, op: 1 } };
    lista.splice(i, 0, n); this.sel = n.id; this.commit(rotulo || 'Adicionar');
  },
  async addPersonagem() {
    const def = await Biblioteca.escolher(); if (!def) return;
    this.P.personagens[def.id] = def; await Arq.garantir(Modelo.chavesImgs(def)); Icone.garanteNoEditor(this.P);
    const b = Modelo.caixaPersonagem(def, Modelo.partesNoEstado(def, {})), s = b.h > 0 ? clamp(this.P.h * .55 / b.h, .1, 4) : 1;
    const n = Modelo.novoNo('personagem', { ref: def.id, nome: def.nome, s: round(s, 2) }); n.chaves[0].s = round(s, 2);
    this.inserir(n, 'Personagem ' + def.nome); UI.toast(`<b>${esc(def.nome)}</b> entrou no quadro ${this.q + 1}. Os botões das sessões estão no painel da direita.`, { kind: 'ok' });
  },
  async addImagem() {
    const fs = await pickFiles('image/*', true); for (const f of fs) {
      const id = await Arq.guardar(f); const bm = await createImageBitmap(f).catch(() => null);
      const s = bm ? Math.min(1, this.P.w * .8 / bm.width, this.P.h * .8 / bm.height) : 1;
      const n = Modelo.novoNo('imagem', { arq: id, nome: f.name.replace(/\.[^.]+$/, '').slice(0, 40), s: round(s, 3) }); n.chaves[0].s = round(s, 3);
      Arq.img.set(id, bm); this.inserir(n, 'Imagem');
    }
  },
  addForma(forma) {
    const P = this.P, m = Math.round(Math.min(P.w, P.h) * .3), nomes = { ret: 'Retângulo', elipse: 'Círculo', tri: 'Triângulo', estrela: 'Estrela' };
    this.inserir(Modelo.novoNo('forma', { forma, nome: nomes[forma], w: m, h: m, cor: ['#4a90e2', '#f5a623', '#7ed321', '#e94e77'][Object.keys(nomes).indexOf(forma)] }), nomes[forma]);
  },
  menuForma(x, y) { UI.ctx(x, y, [['ret', 'Retângulo', 'square'], ['elipse', 'Círculo', 'circle'], ['tri', 'Triângulo', 'shapes'], ['estrela', 'Estrela', 'star']].map(([f, l, i]) => ({ label: l, icon: i, action: () => this.addForma(f) }))); },
  addTexto() { this.inserir(Modelo.novoNo('texto', { texto: 'Texto' }), 'Texto', { dy: Math.round(this.P.h * .3) }); },
  // cenário: vai para o fundo de tudo e cobre a câmera inteira. Fica só nesta animação (salvar na nuvem é no botão direito)
  async addCenario(blob, nome, extra = {}) {
    const P = this.P, q = this.q, id = await Arq.guardar(blob), bm = await createImageBitmap(blob).catch(() => null); if (bm) Arq.img.set(id, bm);
    const c = Modelo.camera(P, q), z = c.zoom || 1, s = bm ? round(Math.max(P.w / z / bm.width, P.h / z / bm.height) * 1.02, 3) : 1;
    const n = Modelo.novoNo('imagem', { arq: id, nome: (nome || 'Cenário').slice(0, 40), s }); Object.assign(n, extra);
    n.de = q; n.chaves = { [q]: { x: Math.round(c.x), y: Math.round(c.y), r: 0, s, sx: 1, op: 1 } };
    n.cenario = true; const i = P.raiz.findIndex(x => x.cenario || x.fundoPadrao); // fica na frente dos cenários que já existem e atrás do resto
    if (i >= 0) P.raiz.splice(i, 0, n); else P.raiz.push(n); this.sel = n.id; this.commit('Cenário ' + n.nome); return n;
  },
  menuTremulo(n) { // efeito "trêmulo" na camada (ver Render.tremor)
    const poe = m => () => { if (!m) delete n.tremulo; else n.tremulo = { forca: .4, ritmo: 2, ...(n.tremulo || {}), modo: m }; this.commit(m ? 'Trêmulo' : 'Sem trêmulo'); };
    return { label: 'Trêmulo', icon: 'wave', sub: [{ label: 'Tremer', checked: n.tremulo?.modo === 'tremer', action: poe('tremer') }, { label: 'Ondular', checked: n.tremulo?.modo === 'ondular', action: poe('ondular') }, { label: 'Desligado', checked: !n.tremulo, action: poe('') }] };
  },
  /* ---------- camada de efeito: vale para o que está abaixo dela (até a próxima camada de efeito) ---------- */
  nomeEfeito(n) { if (n.nomeAuto !== false) n.nome = n.efeitos.length ? 'Efeito: ' + n.efeitos.map(e => Efeitos.nomeEf(e)).join(' + ') : 'Efeito'; },
  addEfeito(e, o = {}) {
    const P = this.P, q = this.q, s = this.noSel(), toda = o.toda ?? (Lado.toda ?? true);
    e = { id: uid('ef'), ...e };
    let n = s?.tipo === 'efeito' ? s : null;
    if (n) { // na camada escolhida: clicar de novo no mesmo tira; cor: uma só por camada (troca)
      const igual = x => x.tipo === e.tipo && (e.tipo !== 'tremulo' || x.modo === e.modo) && (e.tipo !== 'cor' || x.visual === e.visual);
      const i = n.efeitos.findIndex(igual);
      if (i >= 0) { n.efeitos.splice(i, 1); this.nomeEfeito(n); return this.commit('Tirar ' + Efeitos.nomeEf(e)); }
      if (e.tipo === 'cor') n.efeitos = n.efeitos.filter(x => x.tipo !== 'cor');
      n.efeitos.push(e);
    } else {
      const curto = { flash: Math.round(P.fps / 3), tremor: Math.round(P.fps * .7) }[e.tipo], de = q, ate = Math.min(P.duracao - 1, q + (curto || P.fps * 2));
      const r = s ? Modelo.achar(P, s.id) : null, lista = r ? r.lista : P.raiz, i = r ? lista.indexOf(s) : 0, abaixo = lista[i];
      if (abaixo?.tipo === 'efeito') { // logo abaixo já tem uma camada de efeito: uma nova aqui não pegaria nada, então entra nela (com o tempo dele)
        n = abaixo; if (!toda || curto) { e.de = de; e.ate = ate; } if (e.tipo === 'cor') n.efeitos = n.efeitos.filter(x => x.tipo !== 'cor'); n.efeitos.push(e);
      } else {
        n = Modelo.novoNo('efeito', { efeitos: [e] });
        if (!toda || curto) { n.de = de; n.ate = ate; n.chaves = { [q]: n.chaves[0] }; }
        lista.splice(i, 0, n); // logo acima da escolhida (ou no topo)
      }
    }
    this.nomeEfeito(n); this.sel = n.id; this.commit(Efeitos.nomeEf(e));
  },
  converterEfeitosAntigos() {
    const P = this.P, n = Modelo.novoNo('efeito', { efeitos: [] });
    if (P.efeitos.visual && P.efeitos.visual !== 'normal') n.efeitos.push({ id: uid('ef'), tipo: 'cor', visual: P.efeitos.visual });
    for (const e of P.efeitos.tela || []) n.efeitos.push({ id: uid('ef'), tipo: e.tipo, forca: e.forca, de: e.de, ate: e.ate });
    P.efeitos = { visual: 'normal', tela: [] }; this.nomeEfeito(n); P.raiz.unshift(n); this.sel = n.id; this.commit('Efeitos viram camada');
  },
  // a camada de efeito do topo que vale a animação toda (a IA põe as coisas dela aqui)
  efeitoTopo() { const P = this.P; let n = P.raiz[0]; if (n?.tipo === 'efeito' && !(n.de > 0) && n.ate == null) return n; n = Modelo.novoNo('efeito', { efeitos: [] }); P.raiz.unshift(n); return n; },
  /* ---------- régua e ímã: ao mover, gruda nas bordas/meio da câmera, do Fundo padrão e dos outros (desliga no botão da régua ou com R; Ctrl solta sem grudar) ---------- */
  regua() { if (this._regua == null) { try { this._regua = localStorage.getItem('animador-regua') !== '0'; } catch { this._regua = true; } } return this._regua; },
  trocaRegua() { this._regua = !this.regua(); try { localStorage.setItem('animador-regua', this._regua ? '1' : '0'); } catch { } $('#b-regua')?.classList.toggle('on', this._regua); UI.toast(this._regua ? 'Régua e ímã ligados (Ctrl segura para não grudar)' : 'Régua e ímã desligados'); this.pinta(); },
  caixaMundo(cantos) { const xs = cantos.map(p => p.x), ys = cantos.map(p => p.y); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; },
  imaInicio(n) {
    const P = this.P, q = this.q, cx = Render.caixas(P, q), eu = cx.find(c => c.no === n); if (!eu) return null;
    const meus = new Set(); Modelo.cada([n], x => meus.add(x.id));
    const alvos = cx.filter(c => !meus.has(c.no.id) && c.no.vis !== false).map(c => ({ ...this.caixaMundo(c.cantos), nome: c.no.nome }));
    const c = Modelo.camera(P, q), cw = P.w / (c.zoom || 1) / 2, ch = P.h / (c.zoom || 1) / 2;
    alvos.unshift({ x0: c.x - cw, x1: c.x + cw, y0: c.y - ch, y1: c.y + ch, cx: c.x, cy: c.y, nome: 'Câmera', cam: true });
    return { box: this.caixaMundo(eu.cantos), alvos };
  },
  gruda(ima, w0, w, travado) {
    const dx0 = w.x - w0.x, dy0 = w.y - w0.y, b = ima.box, lim = 8 / (this.vista.z || 1);
    const mx = [b.x0 + dx0, b.cx + dx0, b.x1 + dx0], my = [b.y0 + dy0, b.cy + dy0, b.y1 + dy0];
    let bx = null, by = null;
    for (const a of ima.alvos) {
      for (const lx of [a.x0, a.cx, a.x1]) for (const m of mx) { const d = lx - m; if (Math.abs(d) <= lim && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, x: lx, a }; }
      for (const ly of [a.y0, a.cy, a.y1]) for (const m of my) { const d = ly - m; if (Math.abs(d) <= lim && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, y: ly, a }; }
    }
    if (travado) { if (w.y === w0.y) by = null; if (w.x === w0.x) bx = null; }
    this.guias = [bx && { x: bx.x, cam: bx.a.cam }, by && { y: by.y, cam: by.a.cam }].filter(Boolean);
    return { x: w.x + (bx?.d || 0), y: w.y + (by?.d || 0) };
  },
  // desenha as guias do ímã e as réguas (em cima e à esquerda do palco)
  desenhaRegua(ctx, V, W, H, d) {
    if (this.guias?.length) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.lineWidth = 1 * d;
      for (const g of this.guias) { ctx.strokeStyle = g.cam ? '#ff5fd2' : '#19d3f0'; ctx.setLineDash(g.cam ? [] : [6 * d, 4 * d]); ctx.beginPath();
        if (g.x != null) { const x = Math.round(V.transformPoint(new DOMPoint(g.x, 0)).x) + .5; ctx.moveTo(x, 0); ctx.lineTo(x, H); } else { const y = Math.round(V.transformPoint(new DOMPoint(0, g.y)).y) + .5; ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke(); }
      ctx.restore(); }
    if (!this.regua()) return;
    const T = 18 * d, z = Math.hypot(V.a, V.b), inv = V.inverse(); let passo = 10; for (const p of [10, 25, 50, 100, 250, 500, 1000, 2500, 5000]) { passo = p; if (p * z >= 60 * d) break; }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(24,24,24,.92)'; ctx.fillRect(0, 0, W, T); ctx.fillRect(0, 0, T, H);
    ctx.strokeStyle = '#555'; ctx.fillStyle = '#9a9a9a'; ctx.font = `${9.5 * d}px Segoe UI`; ctx.lineWidth = 1; ctx.beginPath();
    const xa = inv.transformPoint(new DOMPoint(T, 0)).x, xb = inv.transformPoint(new DOMPoint(W, 0)).x, ya = inv.transformPoint(new DOMPoint(0, T)).y, yb = inv.transformPoint(new DOMPoint(0, H)).y;
    for (let v = Math.ceil(xa / (passo / 5)) * (passo / 5); v <= xb; v += passo / 5) { const x = Math.round(V.transformPoint(new DOMPoint(v, 0)).x) + .5, g = Math.abs(v % passo) < 1e-6; ctx.moveTo(x, T); ctx.lineTo(x, T - (g ? 8 : 4) * d); if (g) ctx.fillText(String(Math.round(v)), x + 2 * d, 9 * d); }
    for (let v = Math.ceil(ya / (passo / 5)) * (passo / 5); v <= yb; v += passo / 5) { const y = Math.round(V.transformPoint(new DOMPoint(0, v)).y) + .5, g = Math.abs(v % passo) < 1e-6; ctx.moveTo(T, y); ctx.lineTo(T - (g ? 8 : 4) * d, y);
      if (g) { ctx.save(); ctx.translate(9 * d, y - 2 * d); ctx.rotate(-Math.PI / 2); ctx.fillText(String(Math.round(v)), 0, 0); ctx.restore(); } }
    ctx.stroke();
    // onde está o escolhido, marcado nas réguas
    const s = this.noSel(), cx = s && Render.caixas(this.P, this.q).find(c => c.no === s);
    if (cx) { const b = this.caixaMundo(cx.cantos), p0 = V.transformPoint(new DOMPoint(b.x0, b.y0)), p1 = V.transformPoint(new DOMPoint(b.x1, b.y1)); ctx.fillStyle = 'rgba(25,211,240,.35)'; ctx.fillRect(Math.max(T, p0.x), 0, p1.x - Math.max(T, p0.x), T); ctx.fillRect(0, Math.max(T, p0.y), T, p1.y - Math.max(T, p0.y)); }
    ctx.fillStyle = '#202020'; ctx.fillRect(0, 0, T, T); ctx.restore();
  },
  menuCenario(x, y) {
    UI.ctx(x, y, [
      { label: 'Prontos e com a IA (estilo da casa)…', icon: 'paisagem', ai: true, action: () => Cenarios.abrir() },
      { label: 'Salvos na nuvem da equipe…', icon: 'cloud', action: () => CenariosNuvem.escolher() },
    ]);
  },
  async salvarNaNuvem(n) {
    if (n?.tipo !== 'imagem') return;
    const t = UI.toast('<span class="spin-dot"></span> Salvando o cenário na nuvem da equipe…', { time: 60000 });
    try { n.nuvem = await Nuvem.salvarCenario(n); this.commit('Salvar na nuvem', { semArvore: false }); t.remove(); UI.toast(`<b>${esc(n.nome)}</b> está nos cenários da equipe: todo mundo pode usar.`, { kind: 'ok' }); }
    catch (e) { t.remove(); UI.toast('Não salvou: ' + esc(e.message), { kind: 'err' }); }
  },
  addPasta() {
    const n = Modelo.novoNo('pasta', { nome: 'Pasta' }); const s = this.noSel();
    if (s && s.tipo !== 'pasta') { const r = Modelo.achar(this.P, s.id); const i = r.lista.indexOf(s); r.lista.splice(i, 1, n); n.filhos.push(s); this.sel = n.id; n.chaves = { [this.q]: { x: 0, y: 0, r: 0, s: 1, sx: 1, op: 1 } }; return this.commit('Nova pasta'); }
    n.chaves = { 0: { x: 0, y: 0, r: 0, s: 1, sx: 1, op: 1 } }; this.P.raiz.unshift(n); this.sel = n.id; this.commit('Nova pasta');
  },
  duplicar() {
    const s = this.noSel(); if (!s) return; const r = Modelo.achar(this.P, s.id), c = clone(s);
    Modelo.cada([c], x => { x.id = uid('n'); }); c.nome = s.nome + ' (cópia)'; r.lista.splice(r.lista.indexOf(s), 0, c); this.sel = c.id; this.commit('Duplicar');
  },
  async apagarSel() {
    const s = this.noSel(); if (!s) return;
    if (s.filhos?.length && !(await UI.confirm({ title: 'Apagar a pasta?', msg: `"<b>${esc(s.nome)}</b>" e tudo dentro dela saem da animação.`, ok: 'Apagar', danger: true }))) return;
    const r = Modelo.achar(this.P, s.id); r.lista.splice(r.lista.indexOf(s), 1); this.sel = null; this.commit('Apagar');
  },
  // chaves do nó selecionado
  chaveAqui() { const s = this.noSel(); if (!s) return UI.toast('Escolha uma camada primeiro'); Modelo.poeTransf(s, this.q, {}); this.commit('Chave no quadro ' + (this.q + 1)); },
  tiraChave() {
    const s = this.sel === 'camera' ? this.P.camera : this.noSel(); if (!s?.chaves?.[this.q]) return UI.toast('Não há chave neste quadro');
    if (Object.keys(s.chaves).length <= 1) return UI.toast('Toda camada precisa de pelo menos uma chave');
    delete s.chaves[this.q]; this.commit('Tirar chave');
  },

  /* ---------- palco: canvas infinito com a câmera ---------- */
  palco: {
    cv: null, ctx: null, dpr: 1, arr: null, espaco: false,
    liga() {
      if (this.cv) return this.tamanho(); this.cv = $('#palco-cv'); this.ctx = this.cv.getContext('2d');
      new ResizeObserver(() => this.tamanho()).observe(this.cv.parentElement); this.tamanho();
      this.cv.addEventListener('pointerdown', e => this.desce(e)); this.cv.addEventListener('wheel', e => this.roda(e), { passive: false });
      this.cv.addEventListener('dblclick', e => this.duplo(e)); this.cv.addEventListener('contextmenu', e => { e.preventDefault(); this.menu(e); });
      Render.aoChegarImagem = () => { if (App._rafImg) return; App._rafImg = requestAnimationFrame(() => { App._rafImg = 0; App.pinta(); Folha.pinta(); }); }; // várias imagens chegando: redesenha uma vez por quadro
    },
    tamanho() { const r = this.cv.getBoundingClientRect(); this.dpr = devicePixelRatio || 1; this.cv.width = Math.max(2, r.width * this.dpr); this.cv.height = Math.max(2, r.height * this.dpr); App.pinta(); },
    // mundo ↔ tela
    vista() { const v = App.vista; return new DOMMatrix().scale(this.dpr).translate(v.x, v.y).scale(v.z); },
    paraMundo(e) { const r = this.cv.getBoundingClientRect(), v = App.vista; return { x: (e.clientX - r.left - v.x) / v.z, y: (e.clientY - r.top - v.y) / v.z }; },
    paraTela(p) { const v = App.vista; return { x: p.x * v.z + v.x, y: p.y * v.z + v.y }; },
    roda(e) {
      e.preventDefault(); const r = this.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, v = App.vista;
      if (e.ctrlKey || !e.shiftKey) { const f = Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015)), z = clamp(v.z * f, .03, 12); v.x = mx - (mx - v.x) * z / v.z; v.y = my - (my - v.y) * z / v.z; v.z = z; }
      else { v.x -= e.deltaX || e.deltaY; }
      App.pinta(); App.zoomTxt();
    },
    // cantos/alças do selecionado na tela
    alcas() {
      const s = App.noSel(); if (!s) return null; const cx = Render.caixas(App.P, App.q).find(c => c.no === s); if (!cx) return null;
      const pts = cx.cantos.map(p => this.paraTela(p)), meioTopo = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const cen = this.paraTela(cx.m.transformPoint(new DOMPoint(0, 0))), dx = meioTopo.x - cen.x, dy = meioTopo.y - cen.y, L = Math.hypot(dx, dy) || 1;
      return { pts, cen, girar: { x: meioTopo.x + dx / L * 28, y: meioTopo.y + dy / L * 28 }, escala: pts[2], cx };
    },
    desce(e) {
      this.cv.setPointerCapture(e.pointerId); const tela = { x: e.offsetX, y: e.offsetY }, P = App.P;
      if (e.button === 1 || e.button === 0 && (this.espaco || App.ferr === 'mao' || e.altKey)) return this.arrastaVista(e);
      if (e.button !== 0) return;
      if (App.ferr === 'camera' || App.sel === 'camera') return this.arrastaCamera(e);
      const al = this.alcas(), perto = (a, b, r = 10) => a && Math.hypot(a.x - b.x, a.y - b.y) < r;
      const s = App.noSel();
      if (al && s && !s.trava && perto(al.girar, tela, 11)) return this.arrastaGiro(e, s, al);
      if (al && s && !s.trava && perto(al.escala, tela, 11)) return this.arrastaEscala(e, s, al);
      const w = this.paraMundo(e), alvo = Render.caixas(P, App.q).find(c => !c.no.trava && dentroPoligono(w, c.cantos));
      if (!alvo) { if (App.sel) App.selecionar(null); return this.arrastaVista(e, true); }
      if (alvo.no.id !== App.sel) App.selecionar(alvo.no.id);
      this.arrastaMover(e, alvo.no);
    },
    fim(e, mov, fim) { const up = ev => { this.cv.removeEventListener('pointermove', mov); this.cv.removeEventListener('pointerup', up); this.cv.removeEventListener('pointercancel', up); fim?.(ev); }; this.cv.addEventListener('pointermove', mov); this.cv.addEventListener('pointerup', up); this.cv.addEventListener('pointercancel', up); },
    arrastaVista(e, soSeMover) {
      const v = App.vista, x0 = e.clientX, y0 = e.clientY, vx = v.x, vy = v.y; $('#palco').classList.add('arrasta');
      this.fim(e, ev => { v.x = vx + ev.clientX - x0; v.y = vy + ev.clientY - y0; App.pinta(); }, () => $('#palco').classList.remove('arrasta'));
    },
    arrastaMover(e, n) {
      const w0 = this.paraMundo(e), t0 = Modelo.transf(n, App.q), inv = App.matPai(n.id).inverse(), a0 = inv.transformPoint(new DOMPoint(w0.x, w0.y)); let mexeu = false;
      const ima = App.imaInicio(n); // bordas e meios para grudar (câmera, Fundo padrão, outros personagens/objetos)
      this.fim(e, ev => { let w = this.paraMundo(ev); if (ev.shiftKey) { if (Math.abs(w.x - w0.x) > Math.abs(w.y - w0.y)) w = { x: w.x, y: w0.y }; else w = { x: w0.x, y: w.y }; }
        if (ima && App.regua() && !ev.ctrlKey) w = App.gruda(ima, w0, w, ev.shiftKey); else App.guias = null;
        const a = inv.transformPoint(new DOMPoint(w.x, w.y)), dx = a.x - a0.x, dy = a.y - a0.y;
        Modelo.poeTransf(n, App.q, { x: round(t0.x + dx, 1), y: round(t0.y + dy, 1) }); mexeu = true; App.pinta(); }, () => { App.guias = null; if (mexeu) App.commit('Mover', { semArvore: true }); else App.pinta(); });
    },
    arrastaGiro(e, n, al) {
      const t0 = Modelo.transf(n, App.q), ang = p => Math.atan2(p.y - al.cen.y, p.x - al.cen.x) * 180 / Math.PI, a0 = ang({ x: e.offsetX, y: e.offsetY });
      this.fim(e, ev => { let r = t0.r + ang({ x: ev.offsetX, y: ev.offsetY }) - a0; if (ev.shiftKey) r = Math.round(r / 15) * 15; Modelo.poeTransf(n, App.q, { r: round(r, 1) }); App.pinta(); }, () => App.commit('Girar', { semArvore: true }));
    },
    arrastaEscala(e, n, al) {
      const t0 = Modelo.transf(n, App.q), d0 = Math.hypot(e.offsetX - al.cen.x, e.offsetY - al.cen.y) || 1;
      this.fim(e, ev => { const d = Math.hypot(ev.offsetX - al.cen.x, ev.offsetY - al.cen.y); Modelo.poeTransf(n, App.q, { s: round(clamp(t0.s * d / d0, .02, 40), 3) }); App.pinta(); }, () => App.commit('Tamanho', { semArvore: true }));
    },
    arrastaCamera(e) {
      const k = Modelo.camera(App.P, App.q), w0 = this.paraMundo(e); App.sel = 'camera';
      this.fim(e, ev => { const w = this.paraMundo(ev); App.P.camera.chaves[App.q] = { ...k, ...(App.P.camera.chaves[App.q] || {}), x: round(k.x + w.x - w0.x, 1), y: round(k.y + w.y - w0.y, 1) }; App.pinta(); },
        () => App.commit('Mover a câmera'));
    },
    duplo(e) { const w = this.paraMundo(e), alvo = Render.caixas(App.P, App.q).find(c => dentroPoligono(w, c.cantos)); if (alvo?.no.tipo === 'texto') Lado.editarTexto(alvo.no); else if (alvo?.no.tipo === 'personagem') Lado.aba('quadro'); },
    menu(e) {
      const s = App.noSel();
      UI.ctx(e.clientX, e.clientY, [
        { label: 'Personagem…', icon: 'plus', action: () => App.addPersonagem() }, { label: 'Imagem…', icon: 'image', action: () => App.addImagem() }, { label: 'Cenário (prontos e IA)…', icon: 'paisagem', ai: true, action: () => Cenarios.abrir() }, { label: 'Cenário da nuvem da equipe…', icon: 'cloud', action: () => CenariosNuvem.escolher() }, { label: 'Texto', icon: 'text', action: () => App.addTexto() }, '-',
        s?.tipo === 'imagem' && (s.nuvem ? { label: 'Já está na nuvem da equipe', icon: 'check', disabled: true } : { label: 'Salvar na nuvem', icon: 'cloud', action: () => App.salvarNaNuvem(s) }),
        s?.tipo === 'personagem' && { label: `Editar no Ateliê (pose do quadro ${App.q + 1})`, icon: 'edit', action: () => Animacoes.editarNoAtelie(s) },
        s?.tipo === 'personagem' && { label: 'Abrir no Ateliê como pose nova…', icon: 'plus', action: () => Animacoes.poseNova(s) },
        s?.tipo === 'personagem' && { label: (Modelo.transf(s, App.q).sx || 1) < 0 ? 'Desespelhar (voltar para o lado de antes)' : 'Espelhar (virar para o outro lado)', icon: 'transition', action: () => Animacoes.espelhar(s) },
        s && { label: 'Chave neste quadro', icon: 'diamond', key: 'K', action: () => App.chaveAqui() },
        s && { label: 'Duplicar', icon: 'dup', key: 'Ctrl+D', action: () => App.duplicar() },
        s && { label: 'Pôr numa pasta', icon: 'folder', key: 'Ctrl+G', action: () => App.addPasta() },
        s && s.tipo !== 'efeito' && App.menuTremulo(s),
        s && { label: 'Apagar', icon: 'trash', danger: true, key: 'Del', action: () => App.apagarSel() },
        '-', { label: 'Enquadrar a câmera', icon: 'crop', key: 'F', action: () => App.enquadrar() },
        '-', { label: `Citar o quadro ${App.q + 1} em mensagens…`, icon: 'chat', action: () => Citacao.animacao(App.P, App.q, App.sel) },
      ].filter(Boolean));
    },
  },
  _raf: 0,
  pinta() { if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this.desenhaPalco(); }); },
  desenhaPalco() {
    const pc = this.palco, P = this.P; if (!P || !pc.ctx) return;
    const ctx = pc.ctx, W = pc.cv.width, H = pc.cv.height; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#151515'; ctx.fillRect(0, 0, W, H);
    if (this.modoVista === 'camera') { // só o que a câmera vê, com cor, efeitos e legenda (igual ao vídeo)
      const k = Math.min(W / P.w, H / P.h) * .94, w = Math.round(P.w * k), h = Math.round(P.h * k);
      if (!this._fin || this._fin.width !== w || this._fin.height !== h) { this._fin = new OffscreenCanvas(w, h); }
      Render.quadro(this._fin.getContext('2d'), P, this.q, w, h); ctx.drawImage(this._fin, (W - w) / 2, (H - h) / 2); return;
    }
    const V = pc.vista(), c = Modelo.camera(P, this.q), cw = P.w / (c.zoom || 1), ch = P.h / (c.zoom || 1);
    const camM = new DOMMatrix().translate(c.x, c.y).rotate(c.r || 0), cantosCam = [[-cw / 2, -ch / 2], [cw / 2, -ch / 2], [cw / 2, ch / 2], [-cw / 2, ch / 2]].map(([x, y]) => camM.transformPoint(new DOMPoint(x, y)));
    // casca de cebola: quadros vizinhos bem clarinhos
    if (this.onion && !this.tocando) for (const [d, a] of [[-2, .1], [-1, .22], [1, .16]]) { const qq = this.q + d; if (qq < 0 || qq > Modelo.ultimoQuadro(P)) continue; ctx.save(); ctx.filter = d < 0 ? 'sepia(1) hue-rotate(160deg) saturate(3)' : 'sepia(1) hue-rotate(-40deg) saturate(3)'; Render.camadas(ctx, P, qq, V, a); ctx.restore(); }
    ctx.save(); ctx.filter = Efeitos.filtro(P, this.q); Render.camadas(ctx, P, this.q, V, 1, { fundo: true, sombra: pc.dpr }); ctx.restore(); // o fundo (quadriculado/liso) entra como a camada mais de baixo: os efeitos valem nele também
    // fora da câmera fica escurecido
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath(); ctx.rect(0, 0, W, H); const ct = cantosCam.map(p => V.transformPoint(p)); ct.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    ctx.fillStyle = 'rgba(21,21,21,.38)'; ctx.fill('evenodd');
    ctx.strokeStyle = this.sel === 'camera' ? '#9fc3ff' : 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5 * pc.dpr; ctx.beginPath(); ct.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = `${11 * pc.dpr}px Segoe UI`; ctx.fillText(`Câmera · ${P.w}×${P.h}`, ct[0].x + 6 * pc.dpr, ct[0].y - 6 * pc.dpr);
    this.desenhaRegua(ctx, V, W, H, pc.dpr);
    // seleção com alças (girar em cima, tamanho no canto)
    const al = this.palco.alcas();
    if (al) {
      const d = pc.dpr, s = this.noSel(); ctx.strokeStyle = s.trava ? '#e8c25a' : '#9fc3ff'; ctx.lineWidth = 1.5 * d; ctx.setLineDash([5 * d, 4 * d]);
      ctx.beginPath(); al.pts.forEach((p, i) => i ? ctx.lineTo(p.x * d, p.y * d) : ctx.moveTo(p.x * d, p.y * d)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      if (!s.trava) {
        const mt = { x: (al.pts[0].x + al.pts[1].x) / 2, y: (al.pts[0].y + al.pts[1].y) / 2 };
        ctx.beginPath(); ctx.moveTo(mt.x * d, mt.y * d); ctx.lineTo(al.girar.x * d, al.girar.y * d); ctx.stroke();
        for (const [p, r] of [[al.girar, 6], [al.escala, 5]]) { ctx.beginPath(); ctx.arc(p.x * d, p.y * d, r * d, 0, Math.PI * 2); ctx.fillStyle = '#1b1b1b'; ctx.fill(); ctx.stroke(); }
      }
      ctx.beginPath(); ctx.arc(al.cen.x * d, al.cen.y * d, 3.5 * d, 0, Math.PI * 2); ctx.fillStyle = '#9fc3ff'; ctx.fill();
    }
  },
  // quadradinhos no espaço do mundo (seguem o zoom e a mão); o tamanho dobra/divide para nunca ficar miúdo demais
  // fundo onde não tem nada (canvas infinito): quadriculado ou cor lisa. É da animação: aparece igual na Cena, na Câmera e no vídeo
  fundoPalco() { return Render.fundoDe(this.P); },
  mudaFundoPalco(m, salvar = true) { Object.assign(this.fundoPalco(), m); if (salvar) this.commit('Fundo', { semArvore: true }); else this.pinta(); },
  quadriculado(ctx, V, W, H) { Render.fundo(ctx, this.P, V, W, H); },
  enquadrar() { const pc = this.palco; if (!pc.cv || !this.P) return; const r = pc.cv.getBoundingClientRect(), c = Modelo.camera(this.P, this.q), z = Math.min(r.width / (this.P.w / c.zoom), r.height / (this.P.h / c.zoom)) * .86;
    this.vista = { z, x: r.width / 2 - c.x * z, y: r.height / 2 - c.y * z }; this.pinta(); this.zoomTxt(); },
  zoomTxt() { const e = $('#zoom-txt'); if (e) e.textContent = Math.round(this.vista.z * 100) + '%'; },
  setFerr(f) { this.ferr = f; $$('[data-ferr]').forEach(b => b.classList.toggle('on', b.dataset.ferr === f)); $('#palco').classList.toggle('pan', f === 'mao'); if (f === 'camera') this.selecionar('camera'); },
  setVista(m) { this.modoVista = m; $$('[data-vista]').forEach(b => b.classList.toggle('on', b.dataset.vista === m)); this.pinta(); },

  /* ---------- atalhos (como num programa de animação) ---------- */
  teclas(e) {
    if (!this.P || $('#editor').classList.contains('hidden')) return;
    const alvo = e.target, digitando = alvo.closest('input,textarea,select,[contenteditable]') && alvo.type !== 'range' && alvo.type !== 'checkbox';
    if (digitando || $('#modal-root').children.length) return;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey, s = this.noSel();
    if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); return e.shiftKey ? this.redo() : this.undo(); }
    if (ctrl && k === 'y') { e.preventDefault(); return this.redo(); }
    if (ctrl && k === 'd') { e.preventDefault(); return this.duplicar(); }
    if (ctrl && k === 'g') { e.preventDefault(); return this.addPasta(); }
    if (ctrl && k === 's') { e.preventDefault(); this.salvarJa(); return UI.toast('Salvo neste computador', { kind: 'ok' }); }
    if (ctrl) return;
    if (k === ' ') { e.preventDefault(); return this.tocar(); }
    if (k === ',' || k === '<') { e.preventDefault(); return this.setQ(this.q - (e.shiftKey ? 5 : 1), { som: true }); }
    if (k === '.' || k === '>') { e.preventDefault(); return this.setQ(this.q + (e.shiftKey ? 5 : 1), { som: true }); }
    if (k === 'Home') return this.setQ(0); if (k === 'End') return this.setQ(Modelo.ultimoQuadro(this.P));
    if (k.startsWith('Arrow')) {
      e.preventDefault();
      if (!s || s.trava) { if (k === 'ArrowLeft') this.setQ(this.q - 1, { som: true }); if (k === 'ArrowRight') this.setQ(this.q + 1, { som: true }); return; }
      const p = e.shiftKey ? 10 : 1, t = Modelo.transf(s, this.q), d = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, -p], ArrowDown: [0, p] }[k];
      Modelo.poeTransf(s, this.q, { x: t.x + d[0], y: t.y + d[1] }); clearTimeout(this._tSeta); this.pinta(); this._tSeta = setTimeout(() => this.commit('Mover', { semArvore: true }), 350); return;
    }
    const kk = k.toLowerCase();
    if (kk === 'k') return e.shiftKey ? this.tiraChave() : this.chaveAqui();
    if (kk === 'r') return this.trocaRegua();
    if (kk === 'o') { this.onion = !this.onion; $('#b-onion').classList.toggle('on', this.onion); return this.pinta(); }
    if (kk === 'v') return this.setFerr('mover'); if (kk === 'h') return this.setFerr('mao'); if (kk === 'c') return this.setFerr('camera');
    if (kk === 'f') return this.enquadrar();
    if (k === 'Tab') { e.preventDefault(); return this.setVista(this.modoVista === 'mundo' ? 'camera' : 'mundo'); }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); return this.apagarSel(); }
    if (s && !s.trava && (kk === 'q' || kk === 'e')) { const t = Modelo.transf(s, this.q); Modelo.poeTransf(s, this.q, { r: t.r + (kk === 'q' ? -1 : 1) * (e.shiftKey ? 15 : 2) }); this.pinta(); clearTimeout(this._tSeta); this._tSeta = setTimeout(() => this.commit('Girar', { semArvore: true }), 350); return; }
    if (s && !s.trava && (k === '+' || k === '=' || k === '-')) { const t = Modelo.transf(s, this.q); Modelo.poeTransf(s, this.q, { s: round(clamp(t.s * (k === '-' ? .95 : 1.05), .02, 40), 3) }); this.pinta(); clearTimeout(this._tSeta); this._tSeta = setTimeout(() => this.commit('Tamanho', { semArvore: true }), 350); return; }
  },
};
addEventListener('keydown', e => App.teclas(e));
addEventListener('keydown', e => { if (e.key === ' ' && e.target === document.body) e.preventDefault(); });

/* trocar de tela (início, editor, ateliê) */
const Telas = { mostra(id) { for (const t of ['home', 'editor', 'atelie']) $('#' + t).classList.toggle('hidden', t !== id); } };
