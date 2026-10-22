/* ===================== paineis.js — Ateliê: PAINÉIS QUE MUDAM DE LUGAR =====================
   Vistas, Partes, Imagens e o painel da direita (Peça/Poses/Animações) têm a alça de pontinhos: arraste para a outra coluna,
   para outra posição na mesma coluna, ou solte no meio da tela para virar uma janela solta (dá para mover e mudar o tamanho).
   Dois cliques na alça volta o painel para o lugar de sempre. Fica guardado neste computador (localStorage
   `animador-atelie-layout`); o botão "Design padrão" no topo aparece só quando algo mudou (painéis ou tamanhos das bordas). */
'use strict';
const Paineis = {
  CHAVE: 'animador-atelie-layout',
  PADRAO: { esq: ['vistas', 'partes', 'imagens'], dir: ['lado'], solto: {} },
  NOMES: { vistas: 'Vistas', partes: 'Partes', imagens: 'Imagens', lado: 'Peça · Poses · Animações' },
  st: null, sec: {},
  le() {
    if (this.st) return this.st; let s = null; try { s = JSON.parse(localStorage.getItem(this.CHAVE) || 'null'); } catch { }
    return (this.st = this.valida(s || this.PADRAO));
  },
  valida(s) {
    const ids = Object.keys(this.NOMES), vistos = new Set(), f = l => (Array.isArray(l) ? l : []).filter(i => ids.includes(i) && !vistos.has(i) && vistos.add(i));
    const o = { esq: f(s.esq), dir: f(s.dir), solto: {} };
    for (const [i, v] of Object.entries(s.solto || {})) if (ids.includes(i) && !vistos.has(i) && v) { vistos.add(i); o.solto[i] = { x: +v.x || 80, y: +v.y || 80, w: +v.w || 300, h: +v.h || 360 }; }
    for (const i of ids) if (!vistos.has(i)) (this.PADRAO.esq.includes(i) ? o.esq : o.dir).push(i);
    return o;
  },
  grava() { try { localStorage.setItem(this.CHAVE, JSON.stringify(this.st)); } catch { } this.pintaBotao(); },
  mudou() {
    const t = window.Divisores ? Divisores.le() : null;
    return JSON.stringify(this.st) !== JSON.stringify(this.PADRAO) || (t && JSON.stringify({ ...Divisores.PADRAO, ...t }) !== JSON.stringify(Divisores.PADRAO));
  },
  pintaBotao() { const b = $('#at-layout-padrao'); if (b) b.hidden = !this.mudou(); },
  padrao() {
    this.st = this.valida(this.PADRAO); this.grava();
    if (window.Divisores) { Divisores.t = { ...Divisores.PADRAO }; Divisores.grava(); Divisores.aplica(); }
    this.aplica(); UI.toast('Voltou ao design padrão do Ateliê.', { kind: 'ok' });
  },
  // ---------- montar (uma vez): cada painel vira uma <section> com a alça ----------
  liga() {
    if (this._ok) return; const at = $('#atelie'), esq = $('#atelie .at > aside:first-child'), dir = $('#atelie .at > aside:last-child'); if (!at || !esq || !dir) return; this._ok = true;
    this.col = { esq, dir }; this.le();
    const cabDe = id => $('#' + id)?.previousElementSibling;
    const grupos = { vistas: [$('#at-vistas')], partes: [cabDe('at-partes'), $('#at-partes')], imagens: [cabDe('at-imgs'), $('#at-imgs')], lado: [$('#at-abas'), $('#at-lado')] };
    for (const [id, els] of Object.entries(grupos)) {
      if (els.some(e => !e)) continue; const s = h(`<section class="dock" data-dock="${id}"><span class="dock-pega" title="Arraste para mudar o painel de lugar (outra coluna, outra posição ou solto na tela) · dois cliques: volta para o lugar de sempre">${ic('grip', 13)}</span></section>`);
      els[0].before(s); for (const e of els) s.appendChild(e); this.sec[id] = s; this.alca(id, $('.dock-pega', s));
    }
    this.soltos = h('<div class="dock-soltos"></div>'); at.appendChild(this.soltos);
    const b = h(`<button class="btn sm" id="at-layout-padrao" hidden title="Os painéis ou os tamanhos foram mudados: volta tudo ao jeito de sempre">${ic('undo', 13)} Design padrão</button>`); b.onclick = () => this.padrao();
    $('#at-autores')?.before(b);
    if (window.Divisores && !Divisores._avisaPaineis) { Divisores._avisaPaineis = true; const g = Divisores.grava.bind(Divisores); Divisores.grava = () => { g(); this.pintaBotao(); }; }
    this.ro = new ResizeObserver(ents => { let mud = false; for (const e of ents) { const id = e.target.dataset.dock, v = this.st.solto[id]; if (!v || !e.target.isConnected) continue; const r = e.target.getBoundingClientRect(); if (Math.abs(r.width - v.w) > 2 || Math.abs(r.height - v.h) > 2) { v.w = Math.round(r.width); v.h = Math.round(r.height); mud = true; } } if (mud) { clearTimeout(this._tg); this._tg = setTimeout(() => this.grava(), 300); } });
    addEventListener('resize', () => this.cabe());
    this.aplica();
  },
  // põe cada painel no lugar guardado
  aplica() {
    if (!this._ok) return; const st = this.le();
    for (const c of ['esq', 'dir']) { const col = this.col[c], div = $(':scope > .at-div', col); for (const id of st[c]) { const s = this.sec[id]; if (!s) continue; s.classList.remove('dock-solto'); s.removeAttribute('style'); this.ro.unobserve(s); div ? col.insertBefore(s, div) : col.appendChild(s); } }
    for (const [id, v] of Object.entries(st.solto)) { const s = this.sec[id]; if (!s) continue; s.classList.add('dock-solto'); this.soltos.appendChild(s); Object.assign(s.style, { left: v.x + 'px', top: v.y + 'px', width: v.w + 'px', height: v.h + 'px' }); this.ro.observe(s); }
    const at = $('#atelie'); at.classList.toggle('sem-esq', !st.esq.some(i => this.sec[i])); at.classList.toggle('sem-dir', !st.dir.some(i => this.sec[i]));
    this.cabe(); this.pintaBotao(); requestAnimationFrame(() => { Atelie.tamanho?.(); });
  },
  // janelas soltas sempre dentro da tela
  cabe() { for (const [id, v] of Object.entries(this.st?.solto || {})) { const s = this.sec[id]; if (!s) continue; const x = clamp(v.x, 0, Math.max(0, innerWidth - 120)), y = clamp(v.y, 46, Math.max(46, innerHeight - 60)); if (x !== v.x || y !== v.y) { v.x = x; v.y = y; s.style.left = x + 'px'; s.style.top = y + 'px'; } } },
  tira(id) { const st = this.st; st.esq = st.esq.filter(i => i !== id); st.dir = st.dir.filter(i => i !== id); delete st.solto[id]; },
  // ---------- arrastar pela alça ----------
  alca(id, pega) {
    pega.addEventListener('dblclick', () => { this.tira(id); const c = this.PADRAO.esq.includes(id) ? 'esq' : 'dir', L = this.st[c], pos = this.PADRAO[c].indexOf(id); L.splice(Math.min(pos, L.length), 0, id); this.grava(); this.aplica(); });
    pega.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; e.preventDefault(); pega.setPointerCapture(e.pointerId);
      const s = this.sec[id], r0 = s.getBoundingClientRect(), dx = e.clientX - r0.left, dy = e.clientY - r0.top, solto = !!this.st.solto[id];
      const fant = h(`<div class="dock-fant">${ic('grip', 12)} ${esc(this.NOMES[id])}</div>`), linha = h('<div class="dock-linha"></div>'); document.body.append(fant, linha); document.body.classList.add('arrastando-dock');
      let alvo = null, mexeu = false;
      const acha = ev => {
        const x = ev.clientX, y = ev.clientY, perto = 36;
        for (const c of ['esq', 'dir']) {
          const col = this.col[c], rc = col.getBoundingClientRect(), vazia = rc.width < 20;
          const dentro = !vazia && x >= rc.left && x <= rc.right && y >= rc.top && y <= rc.bottom, borda = c === 'esq' ? x < perto : x > innerWidth - perto;
          if (!dentro && !borda) continue;
          const L = this.st[c].filter(i => i !== id && this.sec[i]); let i = L.length;
          for (let k = 0; k < L.length; k++) { const b = this.sec[L[k]].getBoundingClientRect(); if (y < b.top + b.height / 2) { i = k; break; } }
          const lx = vazia ? (c === 'esq' ? 0 : innerWidth - 6) : rc.left, lw = vazia ? 6 : rc.width; let ly;
          if (vazia || !L.length) ly = rc.top || 46; else if (i < L.length) ly = this.sec[L[i]].getBoundingClientRect().top; else ly = this.sec[L[L.length - 1]].getBoundingClientRect().bottom;
          return { c, i, linha: vazia ? { x: lx, y: 46, w: lw, h: innerHeight - 46 } : { x: lx, y: ly - 2, w: lw, h: 4 } };
        }
        return { solto: true, x: Math.round(x - dx), y: Math.round(y - dy) };
      };
      const mov = ev => {
        if (!mexeu && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return; mexeu = true;
        alvo = acha(ev); fant.style.left = ev.clientX + 12 + 'px'; fant.style.top = ev.clientY + 10 + 'px';
        if (alvo.solto) { linha.style.display = 'none'; if (solto) { s.style.left = alvo.x + 'px'; s.style.top = Math.max(46, alvo.y) + 'px'; } fant.classList.add('solto'); fant.innerHTML = `${ic('grip', 12)} ${esc(this.NOMES[id])} <small>${solto ? 'mover' : 'janela solta'}</small>`; }
        else { fant.classList.remove('solto'); fant.innerHTML = `${ic('grip', 12)} ${esc(this.NOMES[id])} <small>${alvo.c === 'esq' ? 'coluna da esquerda' : 'coluna da direita'}</small>`; Object.assign(linha.style, { display: 'block', left: alvo.linha.x + 'px', top: alvo.linha.y + 'px', width: alvo.linha.w + 'px', height: alvo.linha.h + 'px' }); }
      };
      const fim = () => {
        pega.removeEventListener('pointermove', mov); pega.removeEventListener('pointerup', fim); pega.removeEventListener('pointercancel', fim);
        fant.remove(); linha.remove(); document.body.classList.remove('arrastando-dock'); if (!mexeu || !alvo) return;
        const ant = this.st.solto[id]; this.tira(id);
        if (alvo.solto) this.st.solto[id] = { x: alvo.x, y: Math.max(46, alvo.y), w: Math.round(ant?.w || Math.max(260, Math.min(r0.width, 420))), h: Math.round(ant?.h || Math.max(220, Math.min(r0.height, 560))) };
        else this.st[alvo.c].splice(alvo.i, 0, id);
        this.grava(); this.aplica(); Atelie.enquadrar?.();
      };
      pega.addEventListener('pointermove', mov); pega.addEventListener('pointerup', fim); pega.addEventListener('pointercancel', fim);
    });
  },
};
