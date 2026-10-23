/* ===================== paineis.js — Ateliê: PAINÉIS QUE MUDAM DE LUGAR =====================
   Vistas, Partes, Imagens, o painel da direita (Peça/Poses/Animações) e a timeline têm a alça de pontinhos. Arrastando:
   - para dentro de qualquer lugar que já tem painéis (coluna, janela solta ou a faixa de baixo do palco) → entra ali, na posição da linha azul;
   - na BEIRA de uma coluna (lado esquerdo/direito dela) → cria uma COLUNA NOVA ao lado;
   - na beira da tela → coluna nova naquele lado; no meio do palco → JANELA SOLTA (move pela barra de cima, tamanho pelo canto).
   Dois cliques na alça = volta para o lugar de sempre. Colunas mudam de largura pela borda. Guardado neste computador
   (localStorage `animador-atelie-layout`); "Design padrão" no topo aparece só quando algo mudou e volta tudo. */
'use strict';
const Paineis = {
  CHAVE: 'animador-atelie-layout',
  NOMES: { vistas: 'Vistas', partes: 'Partes', imagens: 'Imagens', lado: 'Peça · Poses · Animações', linha: 'Timeline' },
  BEIRA: 22,
  st: null, sec: {},
  padraoSt() { return { cols: [{ id: 'e1', lado: 'esq', w: 270, p: ['vistas', 'partes', 'imagens'] }, { id: 'd1', lado: 'dir', w: 320, p: ['lado'] }], baixo: ['linha'], jan: [] }; },
  le() {
    if (this.st) return this.st; let s = null; try { s = JSON.parse(localStorage.getItem(this.CHAVE) || 'null'); } catch { }
    if (s && !s.cols && (s.esq || s.dir)) { // formato antigo (uma coluna de cada lado)
      const t = window.Divisores ? Divisores.le() : { esq: 270, dir: 320 };
      s = { cols: [{ id: 'e1', lado: 'esq', w: t.esq, p: s.esq || [] }, { id: 'd1', lado: 'dir', w: t.dir, p: s.dir || [] }], baixo: [], jan: Object.entries(s.solto || {}).map(([i, v], n) => ({ id: 'j' + n, ...v, p: [i] })) };
    }
    return (this.st = this.valida(s || this.padraoSt()));
  },
  valida(s) {
    const ids = Object.keys(this.NOMES), vistos = new Set(), f = l => (Array.isArray(l) ? l : []).filter(i => ids.includes(i) && !vistos.has(i) && vistos.add(i));
    const o = { cols: [], baixo: [], jan: [] };
    for (const c of s.cols || []) { const p = f(c.p); if (p.length) o.cols.push({ id: String(c.id || uid('c')), lado: c.lado === 'dir' ? 'dir' : 'esq', w: clamp(+c.w || 280, 190, 620), p }); }
    o.baixo = f(s.baixo);
    for (const j of s.jan || []) { const p = f(j.p); if (p.length) o.jan.push({ id: String(j.id || uid('j')), x: +j.x || 80, y: +j.y || 80, w: +j.w || 300, h: +j.h || 360, p, ...(j.preso?.alvo ? { preso: { alvo: String(j.preso.alvo), lado: j.preso.lado, off: +j.preso.off || 0, esticar: !!j.preso.esticar } } : {}) }); }
    // quem sumiu (painel novo numa versão nova) volta para o lugar de sempre
    const pad = this.padraoSt();
    for (const i of ids) if (!vistos.has(i)) { if (pad.baixo.includes(i)) { o.baixo.push(i); continue; } const pc = pad.cols.find(c => c.p.includes(i)); let c = o.cols.find(x => x.lado === pc.lado); if (!c) { c = { ...pc, p: [] }; pc.lado === 'esq' ? o.cols.unshift(c) : o.cols.push(c); } c.p.push(i); }
    return o;
  },
  grava() { try { localStorage.setItem(this.CHAVE, JSON.stringify(this.st)); } catch { } this.pintaBotao(); },
  mudou() {
    const t = window.Divisores ? Divisores.le() : null;
    let barra = false; try { barra = !!localStorage.getItem('animador-ferr-lugar') || !!localStorage.getItem('animador-ferr-lugar-ed') || !!localStorage.getItem(this.CH_ALT); } catch { }
    return JSON.stringify(this.st) !== JSON.stringify(this.padraoSt()) || (t && t.tl) || barra;
  },
  pintaBotao() { const b = $('#at-layout-padrao'); if (b) b.hidden = !this.mudou(); },
  padrao() {
    this.st = this.padraoSt(); this.alt = {}; try { localStorage.removeItem(this.CH_ALT); } catch { } this.grava();
    if (window.Divisores) { Divisores.t = { ...Divisores.PADRAO }; Divisores.grava(); Divisores.aplica(); }
    if (typeof Pintura !== 'undefined') { Pintura._lugar = Pintura._lugarEd = null; try { localStorage.removeItem('animador-ferr-lugar'); localStorage.removeItem('animador-ferr-lugar-ed'); } catch { } } // a barra de ferramentas também volta ao lugar de sempre
    this.aplica(); if (typeof Pintura !== 'undefined') Pintura.posBarra(); UI.toast('Voltou ao design padrão do Ateliê.', { kind: 'ok' });
  },
  // ---------- montar (uma vez) ----------
  liga() {
    if (this._ok) return; const at = $('#atelie'), esq = $('#atelie .at > aside:first-child'), dir = $('#atelie .at > aside:last-child'), pal = $('#atelie .at-palco'); if (!at || !esq || !dir || !pal) return; this._ok = true;
    this.area = { esq, dir }; esq.classList.add('dock-area'); dir.classList.add('dock-area'); $('#atelie .at').classList.add('com-docks');
    this.baixoEl = h('<div class="dock-baixo"></div>'); pal.appendChild(this.baixoEl);
    this.soltos = h('<div class="dock-soltos"></div>'); at.appendChild(this.soltos);
    const cabDe = id => $('#' + id)?.previousElementSibling;
    const grupos = { vistas: [$('#at-vistas')], partes: [cabDe('at-partes'), $('#at-partes')], imagens: [cabDe('at-imgs'), $('#at-imgs')], lado: [$('#at-abas'), $('#at-lado')], linha: [$('#at-tl')] };
    for (const [id, els] of Object.entries(grupos)) {
      if (els.some(e => !e)) continue; const s = h(`<section class="dock" data-dock="${id}"><span class="dock-pega" title="Arraste para mudar este painel de lugar: dentro de outro lugar, na beira de uma coluna (coluna nova) ou solto na tela · dois cliques: volta para o lugar de sempre">${ic('grip', 13)}</span></section>`);
      els[0].before(s); for (const e of els) s.appendChild(e); this.sec[id] = s; this.alca(id, $('.dock-pega', s));
    }
    const b = h(`<button class="btn sm" id="at-layout-padrao" hidden title="Os painéis ou os tamanhos foram mudados: volta tudo ao jeito de sempre">${ic('undo', 13)} Design padrão</button>`); b.onclick = () => this.padrao();
    ($('#at-autores') || $('#at-ia'))?.before(b);
    if (window.Divisores && !Divisores._avisaPaineis) { Divisores._avisaPaineis = true; const g = Divisores.grava.bind(Divisores); Divisores.grava = () => { g(); this.pintaBotao(); }; }
    // a timeline pode sair de baixo do palco: o palco desconta só o que está na faixa de baixo
    if (window.Linha && !Linha._dock) { Linha._dock = true; Linha.altura = () => { const p = $('.at-palco'); if (!p) return; const hgt = this.baixoEl.offsetHeight; if (p._tl === hgt) return; const primeira = p._tl0 === undefined; p._tl = p._tl0 = hgt; p.style.setProperty('--tl', hgt + 'px'); Atelie.tamanho?.(); if (primeira) Atelie.enquadrar?.(); }; }
    new ResizeObserver(() => Linha?.altura?.()).observe(this.baixoEl);
    this.ro = new ResizeObserver(ents => { let mud = false; for (const e of ents) { const j = this.st.jan.find(x => x.id === e.target.dataset.jan); if (!j || !e.target.isConnected) continue; const r = e.target.getBoundingClientRect(); if (!r.width || !r.height) continue; /* escondida (editor de imagem): não guarda tamanho 0 */ if (!j.preso?.esticar && (Math.abs(r.width - j.w) > 2 || Math.abs(r.height - j.h) > 2)) { j.w = Math.round(r.width); j.h = Math.round(r.height); mud = true; } } Ima.arruma(); if (mud) { clearTimeout(this._tg); this._tg = setTimeout(() => this.grava(), 300); } });
    addEventListener('resize', () => this.cabe()); new ResizeObserver(() => Ima.arruma()).observe($('#atelie .at'));
    this.le(); this.aplica();
  },
  NO_ED: ['partes', 'imagens', 'lado'], // painéis que continuam no editor de imagem (o resto some; o lugar de cada um é o mesmo)
  // ---------- desenhar o layout guardado ----------
  aplica() {
    if (!this._ok) return; const st = this.le(), ed = (c) => c.p.some(i => this.NO_ED.includes(i)) ? '' : ' sem-ed'; // no EDITOR DE IMAGEM só ficam Partes, Imagens e o painel da direita
    for (const lado of ['esq', 'dir']) {
      const area = this.area[lado]; $$(':scope > .dock-col', area).forEach(c => c.remove());
      const div = $(':scope > .at-div', area);
      for (const c of st.cols.filter(x => x.lado === lado)) {
        const col = h(`<div class="dock-col${ed(c)}" data-col="${c.id}" style="width:${c.w}px"><div class="dock-col-borda ${lado}" title="Arraste para mudar a largura da coluna"></div></div>`);
        for (const id of c.p) if (this.sec[id]) col.appendChild(this.sec[id]);
        this.bordaCol(c, $('.dock-col-borda', col), lado); div ? area.insertBefore(col, div) : area.appendChild(col);
      }
      area.classList.toggle('vazia', !st.cols.some(x => x.lado === lado));
    }
    for (const id of st.baixo) if (this.sec[id]) this.baixoEl.appendChild(this.sec[id]);
    this.baixoEl.classList.toggle('sem-ed', !st.baixo.some(i => this.NO_ED.includes(i)));
    $$('.dock-janela', this.soltos).forEach(j => { this.ro.unobserve(j); j.remove(); });
    for (const j of st.jan) {
      const w = h(`<div class="dock-janela${ed(j)}" data-jan="${j.id}" style="left:${j.x}px;top:${j.y}px;width:${j.w}px;height:${j.h}px"><div class="dock-jbar" title="Arraste para mover a janela · o canto de baixo muda o tamanho">${ic('grip', 12)}<span>${j.p.map(i => esc(this.NOMES[i])).join(' · ')}</span></div></div>`);
      for (const id of j.p) if (this.sec[id]) w.appendChild(this.sec[id]);
      this.moveJanela(j, $('.dock-jbar', w), w); $('.dock-jbar', w).oncontextmenu = e => Ima.menu(e, j.preso, v => { j.preso = v; this.grava(); this.aplica(); }); this.soltos.appendChild(w); this.ro.observe(w);
    }
    this.alturas(); this.cabe(); this.pintaBotao(); Linha?.altura?.(); requestAnimationFrame(() => { Atelie.tamanho?.(); Linha?.altura?.(); Ima.arruma(); });
  },
  // ALTURA dos painéis empilhados (numa coluna ou janela): borda arrastável entre um e outro (dois cliques = volta ao normal)
  CH_ALT: 'animador-atelie-alturas',
  leAlt() { if (!this.alt) { try { this.alt = JSON.parse(localStorage.getItem(this.CH_ALT) || '{}') || {}; } catch { this.alt = {}; } } return this.alt; },
  gravaAlt() { try { if (Object.keys(this.alt).length) localStorage.setItem(this.CH_ALT, JSON.stringify(this.alt)); else localStorage.removeItem(this.CH_ALT); } catch { } this.pintaBotao(); },
  alturas() {
    const A = this.leAlt(), fixo = id => id === 'vistas'; // as Vistas têm a altura do conteúdo: arrastando, ganham altura em px
    for (const box of $$('#atelie .dock-col, .dock-janela')) {
      const ds = $$(':scope > .dock', box).filter(d => d.dataset.dock !== 'linha');
      ds.forEach((d, i) => { const id = d.dataset.dock, v = A[id]; $(':scope > .dock-hb', d)?.remove();
        d.style.flex = v ? (fixo(id) ? `0 0 ${v}px` : `${v} 1 0`) : ''; if (v && fixo(id)) d.style.overflow = 'auto'; else d.style.overflow = '';
        if (!i) return; const hb = h('<div class="dock-hb" title="Arraste para mudar a altura · dois cliques: volta ao normal"></div>'); d.appendChild(hb); this.bordaAlt(hb, ds[i - 1], d, ds); });
    }
  },
  bordaAlt(hb, a, b, ds) {
    hb.ondblclick = () => { for (const d of ds) delete this.alt[d.dataset.dock]; this.gravaAlt(); this.alturas(); };
    hb.onpointerdown = e => { e.preventDefault(); hb.setPointerCapture(e.pointerId); hb.classList.add('on');
      for (const d of ds) this.alt[d.dataset.dock] = d.offsetHeight; // tudo em px a partir daqui (senão os pesos misturam)
      const y0 = e.clientY, ha = a.offsetHeight, hbb = b.offsetHeight, MIN = 44;
      const mv = ev => { let dy = ev.clientY - y0; dy = clamp(dy, MIN - ha, hbb - MIN); this.alt[a.dataset.dock] = Math.round(ha + dy); this.alt[b.dataset.dock] = Math.round(hbb - dy);
        for (const d of [a, b]) { const id = d.dataset.dock, v = this.alt[id]; d.style.flex = id === 'vistas' ? `0 0 ${v}px` : `${v} 1 0`; if (id === 'vistas') d.style.overflow = 'auto'; } };
      const up = () => { hb.classList.remove('on'); hb.removeEventListener('pointermove', mv); hb.removeEventListener('pointerup', up); hb.removeEventListener('pointercancel', up); this.gravaAlt(); Atelie.tamanho?.(); Ima.arruma(); };
      hb.addEventListener('pointermove', mv); hb.addEventListener('pointerup', up); hb.addEventListener('pointercancel', up); };
  },
  // janelas GRUDADAS em outra coisa (js/ima.js): ficam no lugar dela (e andam junto quando ela anda)
  posPresos() {
    for (const j of this.st?.jan || []) { if (!j.preso) continue; const w = $(`.dock-janela[data-jan="${j.id}"]`, this.soltos); if (!w) continue;
      if (!j.preso.esticar) { w.style.height = j.h + 'px'; w.style.width = j.w + 'px'; }
      const o = Ima.pos(j.preso, w.offsetWidth, w.offsetHeight); if (!o) continue; // onde grudou está escondido/sumiu: fica onde estava
      j.x = Math.round(o.x); j.y = Math.round(o.y); w.style.left = j.x + 'px'; w.style.top = j.y + 'px'; if (j.preso.esticar) { if (j.preso.lado === 'esq' || j.preso.lado === 'dir') w.style.height = o.h + 'px'; else w.style.width = o.w + 'px'; } }
  },
  cabe() { for (const j of this.st?.jan || []) { const x = clamp(j.x, 0, Math.max(0, innerWidth - 120)), y = clamp(j.y, 46, Math.max(46, innerHeight - 60)); if (x !== j.x || y !== j.y) { j.x = x; j.y = y; const w = $(`.dock-janela[data-jan="${j.id}"]`, this.soltos); if (w) { w.style.left = x + 'px'; w.style.top = y + 'px'; } } } },
  bordaCol(c, b, lado) {
    b.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); document.body.classList.add('arrastando-div'); const x0 = e.clientX, w0 = c.w, col = b.parentElement;
      const mov = ev => { c.w = clamp(Math.round(w0 + (lado === 'esq' ? 1 : -1) * (ev.clientX - x0)), 190, 620); col.style.width = c.w + 'px'; Atelie.tamanho?.(); };
      const up = () => { b.removeEventListener('pointermove', mov); b.removeEventListener('pointerup', up); b.classList.remove('on'); document.body.classList.remove('arrastando-div'); this.grava(); Atelie.enquadrar?.(); };
      b.addEventListener('pointermove', mov); b.addEventListener('pointerup', up); });
    b.addEventListener('dblclick', () => { c.w = c.lado === 'dir' ? 320 : 270; this.grava(); this.aplica(); });
  },
  // mover a JANELA SOLTA pela barra de cima: solta numa coluna, na beira (coluna nova), noutra janela ou embaixo do palco = os painéis dela
  // GRUDAM lá (linha azul mostra onde); solta no meio = continua solta, e encosta sozinha na beira da tela/das outras janelas (ímã)
  moveJanela(j, bar, w) {
    bar.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; e.preventDefault(); bar.setPointerCapture(e.pointerId); const dx = e.clientX - j.x, dy = e.clientY - j.y;
      const linha = h('<div class="dock-linha"></div>'); document.body.appendChild(linha); document.body.classList.add('arrastando-dock'); let alvo = null;
      const ima = (x, y) => { // encosta nas bordas da tela, das colunas e das outras janelas
        const W = w.offsetWidth, H = w.offsetHeight, top = $('#atelie .at').getBoundingClientRect().top, D = 14, xs = [0, innerWidth], ys = [top, innerHeight];
        for (const el of [...$$('.dock-col'), ...$$('.dock-janela', this.soltos).filter(o => o !== w)]) { const r = el.getBoundingClientRect(); if (!r.width) continue; xs.push(r.left, r.right); ys.push(r.top, r.bottom); }
        let bx = x, by = y, mx = D, my = D; for (const v of xs) for (const [ed, off] of [[x, 0], [x + W, W]]) if (Math.abs(ed - v) < mx) { mx = Math.abs(ed - v); bx = v - off; }
        for (const v of ys) for (const [ed, off] of [[y, 0], [y + H, H]]) if (Math.abs(ed - v) < my) { my = Math.abs(ed - v); by = v - off; } return [Math.round(bx), Math.round(Math.max(top, by))]; };
      const mov = ev => {
        alvo = this.acha(ev.clientX, ev.clientY, j.p[0], dx, dy, j.id);
        if (alvo.solto) { [j.x, j.y] = ima(ev.clientX - dx, ev.clientY - dy); j.preso = null; w.classList.remove('vai-grudar'); linha.style.display = 'none';
          // perto da borda de outra janela/coluna/palco: GRUDA nela (e depois anda junto)
          const exc = new Set(['jan:' + j.id, ...Ima.presos('jan:' + j.id, this.st.jan.map(x => ['jan:' + x.id, x.preso]))]), p = Ima.acha({ left: j.x, top: j.y, right: j.x + w.offsetWidth, bottom: j.y + w.offsetHeight }, exc);
          if (p && p.alvo.startsWith('jan:')) { j.preso = p; this.posPresos(); } else { w.style.left = j.x + 'px'; w.style.top = j.y + 'px'; }
          Ima.arruma(); }
        else { w.style.left = Math.round(ev.clientX - dx) + 'px'; w.style.top = Math.round(Math.max(46, ev.clientY - dy)) + 'px'; w.classList.add('vai-grudar'); Object.assign(linha.style, { display: 'block', left: alvo.linha.x + 'px', top: alvo.linha.y + 'px', width: alvo.linha.w + 'px', height: alvo.linha.h + 'px' }); }
      };
      const up = () => {
        bar.removeEventListener('pointermove', mov); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); linha.remove(); document.body.classList.remove('arrastando-dock'); w.classList.remove('vai-grudar');
        if (alvo && !alvo.solto) { const ps = [...j.p], st = this.st; st.jan = st.jan.filter(x => x !== j);
          if (alvo.novaCol) st.cols.splice(alvo.novaCol.k, 0, { id: uid('c'), lado: alvo.novaCol.lado, w: clamp(Math.round(j.w), 220, 460), p: ps });
          else if (alvo.col) st.cols.find(c => c.id === alvo.col)?.p.splice(alvo.i, 0, ...ps);
          else if (alvo.jan) st.jan.find(x => x.id === alvo.jan)?.p.splice(alvo.i, 0, ...ps);
          else if (alvo.baixo) st.baixo.splice(alvo.i, 0, ...ps);
          this.limpa(); this.grava(); this.aplica(); Atelie.enquadrar?.(); return; }
        this.cabe(); this.grava(); Ima.arruma();
      };
      bar.addEventListener('pointermove', mov); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
    });
  },
  // tira o painel de onde está (e some com coluna/janela que ficou vazia)
  tira(id) {
    const st = this.st; let antes = null;
    for (const c of st.cols) if (c.p.includes(id)) { antes = { col: c, sozinho: c.p.length === 1 }; c.p = c.p.filter(i => i !== id); }
    for (const j of st.jan) if (j.p.includes(id)) { antes = { jan: { ...j }, sozinho: j.p.length === 1 }; j.p = j.p.filter(i => i !== id); }
    st.baixo = st.baixo.filter(i => i !== id); return antes;
  },
  limpa() { this.st.cols = this.st.cols.filter(c => c.p.length); this.st.jan = this.st.jan.filter(j => j.p.length); },
  // ---------- onde o painel vai cair ----------
  acha(x, y, id, dx, dy, semJan) {
    const B = this.BEIRA, ignora = L => L.filter(i => i !== id && this.sec[i]), lugarNa = (L, el) => { // índice pela altura + a linha azul
      const r = el.getBoundingClientRect(), V = ignora(L); let i = V.length;
      for (let k = 0; k < V.length; k++) { const b = this.sec[V[k]].getBoundingClientRect(); if (y < b.top + b.height / 2) { i = k; break; } }
      const ly = !V.length ? r.top + 2 : i < V.length ? this.sec[V[i]].getBoundingClientRect().top : this.sec[V[V.length - 1]].getBoundingClientRect().bottom;
      return { i, linha: { x: r.left, y: ly - 2, w: r.width, h: 4 } };
    };
    for (const j of this.st.jan) { if (j.id === semJan) continue; const el = $(`.dock-janela[data-jan="${j.id}"]`, this.soltos); if (!el) continue; const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { const l = lugarNa(j.p, el); return { jan: j.id, i: l.i, linha: l.linha, nome: 'nesta janela' }; } }
    for (const c of this.st.cols) { const el = $(`.dock-col[data-col="${c.id}"]`); if (!el || !el.offsetWidth) continue; const r = el.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      if (x - r.left < B || r.right - x < B) { const depois = r.right - x < B, k = this.st.cols.indexOf(c); return { novaCol: { lado: c.lado, k: depois ? k + 1 : k }, linha: { x: depois ? r.right - 3 : r.left - 3, y: r.top, w: 6, h: r.height }, nome: 'coluna nova' }; }
      const l = lugarNa(c.p, el); return { col: c.id, i: l.i, linha: l.linha, nome: c.lado === 'esq' ? 'nesta coluna (esquerda)' : 'nesta coluna (direita)' }; }
    const pal = $('#atelie .at-palco').getBoundingClientRect(), rb = this.baixoEl.getBoundingClientRect();
    if (x >= pal.left && x <= pal.right && y >= Math.min(rb.top, pal.bottom - 46) && y <= pal.bottom) { const l = lugarNa(this.st.baixo, this.baixoEl); if (!this.st.baixo.length) l.linha = { x: pal.left, y: pal.bottom - 5, w: pal.width, h: 5 }; return { baixo: true, i: l.i, linha: l.linha, nome: 'embaixo do palco' }; }
    const top = $('#atelie .at').getBoundingClientRect().top;
    if (x < pal.left + B) { const k = this.st.cols.filter(c => c.lado === 'esq').length; return { novaCol: { lado: 'esq', k: this.idxLado('esq', k) }, linha: { x: pal.left, y: top, w: 6, h: innerHeight - top }, nome: 'coluna nova' }; }
    if (x > pal.right - B) { return { novaCol: { lado: 'dir', k: this.idxLado('dir', 0) }, linha: { x: pal.right - 6, y: top, w: 6, h: innerHeight - top }, nome: 'coluna nova' }; }
    return { solto: true, x: Math.round(x - dx), y: Math.round(y - dy), nome: 'janela solta' };
  },
  // posição na lista geral de colunas para a k-ésima coluna daquele lado
  idxLado(lado, k) { const L = this.st.cols; if (lado === 'esq') { let n = 0; for (let i = 0; i < L.length; i++) { if (L[i].lado !== 'esq') continue; if (n === k) return i; n++; } const u = L.map(c => c.lado).lastIndexOf('esq'); return u + 1; } const p = L.findIndex(c => c.lado === 'dir'); return p < 0 ? L.length : p + k; },
  // ---------- arrastar pela alça ----------
  alca(id, pega) {
    pega.addEventListener('dblclick', () => { this.tira(id); const pad = this.padraoSt(); if (pad.baixo.includes(id)) this.st.baixo.push(id); else { const pc = pad.cols.find(c => c.p.includes(id)); let c = this.st.cols.find(x => x.lado === pc.lado && (pc.lado === 'esq' ? x === this.st.cols.find(y => y.lado === 'esq') : true)); if (pc.lado === 'dir') c = [...this.st.cols].reverse().find(x => x.lado === 'dir'); if (!c) { c = { id: uid('c'), lado: pc.lado, w: pc.w, p: [] }; pc.lado === 'esq' ? this.st.cols.unshift(c) : this.st.cols.push(c); } c.p.splice(Math.min(pc.p.indexOf(id), c.p.length), 0, id); }
      this.limpa(); this.grava(); this.aplica(); });
    pega.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; e.preventDefault(); pega.setPointerCapture(e.pointerId);
      const s = this.sec[id], r0 = s.getBoundingClientRect(), dx = Math.min(e.clientX - r0.left, 40), dy = Math.min(e.clientY - r0.top, 20);
      const fant = h('<div class="dock-fant"></div>'), linha = h('<div class="dock-linha"></div>'); document.body.append(fant, linha); document.body.classList.add('arrastando-dock'); s.classList.add('dock-indo');
      let alvo = null, mexeu = false;
      const mov = ev => {
        if (!mexeu && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return; mexeu = true;
        alvo = this.acha(ev.clientX, ev.clientY, id, dx, dy); fant.style.left = ev.clientX + 12 + 'px'; fant.style.top = ev.clientY + 10 + 'px';
        fant.innerHTML = `${ic('grip', 12)} ${esc(this.NOMES[id])} <small>${alvo.nome}</small>`; fant.classList.toggle('solto', !!alvo.solto);
        if (alvo.linha) Object.assign(linha.style, { display: 'block', left: alvo.linha.x + 'px', top: alvo.linha.y + 'px', width: alvo.linha.w + 'px', height: alvo.linha.h + 'px' }); else linha.style.display = 'none';
      };
      const fim = () => {
        pega.removeEventListener('pointermove', mov); pega.removeEventListener('pointerup', fim); pega.removeEventListener('pointercancel', fim);
        fant.remove(); linha.remove(); document.body.classList.remove('arrastando-dock'); s.classList.remove('dock-indo'); if (!mexeu || !alvo) return;
        const ant = this.tira(id), st = this.st;
        if (alvo.solto) { const jw = ant?.jan && ant.sozinho ? ant.jan : null; st.jan.push({ id: uid('j'), x: alvo.x, y: Math.max(46, alvo.y), w: Math.round(jw?.w || clamp(r0.width, 260, 460)), h: Math.round(jw?.h || clamp(r0.height, 200, 560)), p: [id] }); }
        else if (alvo.novaCol) { const w = clamp(Math.round(ant?.col?.w || (id === 'linha' ? 360 : r0.width) || 280), 220, 460); st.cols.splice(alvo.novaCol.k, 0, { id: uid('c'), lado: alvo.novaCol.lado, w, p: [id] }); }
        else if (alvo.col) st.cols.find(c => c.id === alvo.col)?.p.splice(alvo.i, 0, id);
        else if (alvo.jan) st.jan.find(j => j.id === alvo.jan)?.p.splice(alvo.i, 0, id);
        else if (alvo.baixo) st.baixo.splice(alvo.i, 0, id);
        this.limpa(); this.grava(); this.aplica(); Atelie.enquadrar?.();
      };
      pega.addEventListener('pointermove', mov); pega.addEventListener('pointerup', fim); pega.addEventListener('pointercancel', fim);
    });
  },
};
