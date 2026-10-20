/* ===================== paineis.js — painéis encaixáveis/flutuantes + arrumações (igual ao Krita) =====================
   Os painéis da esquerda (Cena e mídia) e da direita (Configurações) podem:
   ficar encaixados na esquerda ou na direita (um em cima do outro se ficarem do mesmo lado), virar janela flutuante
   (arrastar pela barrinha ⋮⋮, puxar o canto para mudar o tamanho) ou ser escondidos.
   Arrumações prontas: Padrão, Para desenhar, Para animar, Para editar vídeo — e dá para guardar a sua. */
'use strict';
const Paineis = {
  P: { left: { sel: '#editor > .panel.left, .dock > .panel.left, .panel.left.pn-float', name: '📚 Cena e mídia' }, right: { sel: '.panel.right', name: '⚙️ Configurações' } },
  st: null,
  def() { return { left: { dock: 'left', x: 80, y: 90, w: 300, h: 520 }, right: { dock: 'right', x: innerWidth - 380, y: 90, w: 340, h: 560 } }; },
  el(k) { return $('.panel.' + k); },
  init() {
    const ed = $('#editor'); if (!ed || $('#dock-L')) return;
    try { this.st = JSON.parse(localStorage.getItem('pn-state') || 'null'); } catch { } if (!this.st?.left) this.st = this.def();
    document.body.classList.remove('lay-swap'); try { localStorage.removeItem('lay-swap'); } catch { }
    const L = h('<div class="dock" id="dock-L"></div>'), R = h('<div class="dock" id="dock-R"></div>');
    ed.insertBefore(L, $('main.center', ed)); $('main.center', ed).after(R);
    L.appendChild($('#split-l')); R.appendChild($('#split-r'));
    for (const k of ['left', 'right']) {
      const p = this.el(k), hd = h(`<div class="pn-h" title="Arraste para soltar ou encaixar o painel"><span class="pn-grip">⋮⋮</span><b>${this.P[k].name}</b><span class="sp"></span><button data-s title="Mudar de lado (encaixar do outro lado)">⇄</button><button data-f title="Soltar como janela flutuante / encaixar de volta">⧉</button><button data-x title="Esconder (volta pelo menu Exibir ou pela arrumação)">—</button></div>`);
      p.prepend(hd);
      $('[data-s]', hd).onclick = () => { const s = this.st[k]; s.dock = s.dock === 'left' ? 'right' : s.dock === 'right' ? 'left' : (s.x + s.w / 2 < innerWidth / 2 ? 'left' : 'right'); this.apply(); };
      $('[data-f]', hd).onclick = () => { const s = this.st[k]; if (s.dock === 'float') s.dock = s.x + s.w / 2 < innerWidth / 2 ? 'left' : 'right'; else { const r = p.getBoundingClientRect(); Object.assign(s, { w: r.width, h: Math.min(r.height, innerHeight - 160) }); s.x = clamp(r.left + 30, 0, innerWidth - s.w - 10); s.y = r.top + 30; s.dock = 'float'; } this.apply(); };
      $('[data-x]', hd).onclick = () => { this.st[k].dock = 'hide'; this.apply(); UI.toast(`${this.P[k].name} escondido. Para voltar: menu <b>Exibir → Painéis</b>.`, { time: 3000 }); };
      hd.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; this.drag(k, e); });
      new ResizeObserver(() => { const s = this.st[k]; if (s.dock !== 'float' || this._applying) return; const r = p.getBoundingClientRect(); if (r.width > 50) { s.w = Math.round(r.width); s.h = Math.round(r.height); this.save(); App.fitPreview?.(); } }).observe(p);
    }
    this.apply();
  },
  save() { try { localStorage.setItem('pn-state', JSON.stringify(this.st)); } catch { } },
  apply() {
    this._applying = true; const ed = $('#editor'), L = $('#dock-L'), R = $('#dock-R');
    for (const k of ['left', 'right']) {
      const p = this.el(k), s = this.st[k]; p.classList.toggle('pn-float', s.dock === 'float'); p.style.display = s.dock === 'hide' ? 'none' : '';
      if (s.dock === 'left') L.insertBefore(p, $('#split-l', L)); else if (s.dock === 'right') R.insertBefore(p, $('#split-r', R)); else ed.appendChild(p);
      if (s.dock === 'float') { s.w = clamp(s.w, 220, innerWidth - 20); s.h = clamp(s.h, 160, innerHeight - 20); s.x = clamp(s.x, 0, innerWidth - Math.min(s.w, 200)); s.y = clamp(s.y, 30, innerHeight - 40); Object.assign(p.style, { left: s.x + 'px', top: s.y + 'px', width: s.w + 'px', height: s.h + 'px' }); }
      else Object.assign(p.style, { left: '', top: '', width: '', height: '' });
    }
    // na ordem: o da esquerda fica em cima quando os dois estão juntos
    const vis = d => ['left', 'right'].some(k => this.st[k].dock === d);
    ed.classList.toggle('no-dockL', !vis('left')); ed.classList.toggle('no-dockR', !vis('right'));
    this.save(); this._applying = false; if (!this._quiet) Arrumacoes.changed(); App.fitPreview?.(); Timeline?.drawRuler?.(); EdDraw?.place?.(); setTimeout(() => App.fitPreview?.(), 50);
  },
  // arrastar pela barrinha: solta como janela; perto da borda esquerda/direita = encaixa (mostra a área azul)
  drag(k, e) {
    const p = this.el(k), s = this.st[k], r0 = p.getBoundingClientRect(), dx0 = e.clientX - r0.left, dy0 = e.clientY - r0.top; let started = s.dock === 'float', zone = null;
    const hint = h('<div class="pn-zone"></div>'); document.body.appendChild(hint);
    dragPointer(e, ev => {
      if (!started) { if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 12) return; started = true; Object.assign(s, { w: r0.width, h: Math.min(r0.height, innerHeight - 160) }); s.dock = 'float'; this.apply(); }
      s.x = ev.clientX - Math.min(dx0, s.w - 40); s.y = ev.clientY - Math.min(dy0, 20); Object.assign(p.style, { left: s.x + 'px', top: s.y + 'px' });
      const top = $('#editor .menubar').getBoundingClientRect().bottom; zone = ev.clientX < 60 ? 'left' : ev.clientX > innerWidth - 60 ? 'right' : null;
      hint.style.display = zone ? 'block' : 'none'; if (zone) Object.assign(hint.style, { top: top + 'px', bottom: '0', left: zone === 'left' ? '0' : '', right: zone === 'right' ? '0' : '', width: '300px' });
    }, () => { hint.remove(); if (zone) s.dock = zone; this.apply(); });
  },
  show(k) { const s = this.st[k]; if (s.dock === 'hide') s.dock = k; this.apply(); },
  swap() { for (const k of ['left', 'right']) { const s = this.st[k]; if (s.dock === 'left') s.dock = 'right'; else if (s.dock === 'right') s.dock = 'left'; } this.apply(); },
  reset() { this.st = this.def(); this.apply(); },
};

/* ---------- Arrumações (workspaces) ---------- */
const Arrumacoes = {
  PRONTAS: {
    padrao: { name: '🏠 Padrão', pan: { left: 'left', right: 'right' }, lw: 296, rw: 336, tlh: 330, tltop: false, pv: 'mover', tl: 'edicao', modo: null },
    desenho: { name: '✏️ Para desenhar', pan: { left: 'hide', right: 'right' }, lw: 260, rw: 290, tlh: 190, tltop: false, pv: 'desenhar', tl: 'animacao', flash: true, modo: 'anim' },
    animar: { name: '🦴 Para animar', pan: { left: 'left', right: 'right' }, lw: 260, rw: 320, tlh: 300, tltop: false, pv: 'ossos', tl: 'animacao', flash: true, modo: 'anim' },
    edicao: { name: '🎬 Para editar vídeo', pan: { left: 'left', right: 'right' }, lw: 300, rw: 320, tlh: 380, tltop: false, pv: 'mover', tl: 'edicao', modo: 'final' },
  },
  // mexeu na tela à mão → vira "Personalizado" (guardado sozinho)
  changed() {
    if (this._using || !Paineis.st) return; clearTimeout(this._chT);
    this._chT = setTimeout(() => { let mine = {}; try { mine = JSON.parse(localStorage.getItem('arrumacoes') || '{}'); } catch { } mine.personalizado = { ...this.now(), name: '✋ Personalizado' }; try { localStorage.setItem('arrumacoes', JSON.stringify(mine)); localStorage.setItem('arrumacao', 'personalizado'); } catch { } this.label(); }, 150);
  },
  all() { let mine = {}; try { mine = JSON.parse(localStorage.getItem('arrumacoes') || '{}'); } catch { } return { ...this.PRONTAS, ...mine }; },
  cur() { try { return localStorage.getItem('arrumacao') || 'padrao'; } catch { return 'padrao'; } },
  now() {
    const ed = $('#editor'), v = n => Math.round(parseFloat(getComputedStyle(ed).getPropertyValue(n)) || 0);
    return { pan: { left: Paineis.st.left.dock, right: Paineis.st.right.dock }, float: JSON.parse(JSON.stringify(Paineis.st)), lw: v('--lw') || 296, rw: v('--rw') || 336, tlh: v('--tlh') || 330, tltop: document.body.classList.contains('lay-tltop'), pv: $('#pv-modo button.on')?.dataset.v || 'mover', tl: EdAnimTL.on ? 'animacao' : 'edicao', flash: EdAnimTL.flash, modo: Cena.mode || null };
  },
  use(id) {
    const A = this.all()[id]; if (!A) return; const ed = $('#editor'); this._using = true; clearTimeout(this._chT);
    if (A.float) for (const k of ['left', 'right']) Object.assign(Paineis.st[k], A.float[k]);
    for (const k of ['left', 'right']) Paineis.st[k].dock = A.pan[k];
    ed.style.setProperty('--lw', A.lw + 'px'); ed.style.setProperty('--rw', A.rw + 'px'); ed.style.setProperty('--tlh', clamp(A.tlh, 150, innerHeight - 260) + 'px');
    try { localStorage.setItem('ps--lw', A.lw + 'px'); localStorage.setItem('ps--rw', A.rw + 'px'); localStorage.setItem('ps-tlh', A.tlh + 'px'); localStorage.setItem('arrumacao', id); } catch { }
    if (document.body.classList.contains('lay-tltop') !== !!A.tltop) Layout.toggle('tltop');
    Paineis.apply();
    if (App.project) {
      if (A.modo && Cena.mode !== A.modo) Cena.setMode(A.modo);
      if (A.flash != null) { EdAnimTL.flash = A.flash; EdAnimTL.ui(); }
      EdAnimTL.set(A.tl === 'animacao');
      if (A.pv) App.setPvModo(A.pv);
    }
    this._using = false; this.label(); UI.toast('Arrumação: ' + A.name, { time: 1400 });
  },
  label() { const b = $('#ws-btn'); if (b) b.innerHTML = `🧩 <span>${esc((this.all()[this.cur()]?.name || 'Padrão').replace(/^\S+\s/, ''))}</span> ▾`; },
  async saveAs(id) {
    let mine = {}; try { mine = JSON.parse(localStorage.getItem('arrumacoes') || '{}'); } catch { }
    let name = id ? this.all()[id].name : await UI.prompt({ title: 'Nome da arrumação', label: 'Nome', value: 'Minha arrumação' }); if (!name) return;
    const key = id || 'u_' + Date.now().toString(36); if (!id && !/^\p{Extended_Pictographic}/u.test(name)) name = '⭐ ' + name;
    mine[key] = { ...this.now(), name }; try { localStorage.setItem('arrumacoes', JSON.stringify(mine)); localStorage.setItem('arrumacao', key); } catch { }
    this.label(); UI.toast(`Guardado em "${name}"`, { kind: 'ok', time: 1600 });
  },
  forget(id) { let mine = {}; try { mine = JSON.parse(localStorage.getItem('arrumacoes') || '{}'); } catch { } delete mine[id]; try { localStorage.setItem('arrumacoes', JSON.stringify(mine)); } catch { } this.label(); },
  menuItems() {
    const all = this.all(), cur = this.cur(); let mine = {}; try { mine = JSON.parse(localStorage.getItem('arrumacoes') || '{}'); } catch { }
    return [{ head: 'Arrumação da tela' }, ...Object.entries(all).map(([id, A]) => ({ label: A.name + (mine[id] && this.PRONTAS[id] ? ' (sua versão)' : ''), checked: id === cur, action: () => this.use(id) })), '-',
      { label: `💾 Guardar a tela atual em "${(all[cur]?.name || '').replace(/^\S+\s/, '')}"`, action: () => this.saveAs(cur) },
      { label: '➕ Guardar como arrumação nova…', action: () => this.saveAs() },
      ...(mine[cur] && cur !== 'personalizado' ? [{ label: this.PRONTAS[cur] ? '↺ Voltar esta ao original' : '🗑 Apagar esta arrumação', action: () => { this.forget(cur); if (!this.PRONTAS[cur]) { try { localStorage.setItem('arrumacao', 'padrao'); } catch { } } this.use(this.PRONTAS[cur] ? cur : 'padrao'); } }] : []), '-',
      { head: 'Painéis' },
      ...['left', 'right'].map(k => ({ label: (Paineis.st[k].dock === 'hide' ? '👁 Mostrar ' : '— Esconder ') + Paineis.P[k].name, action: () => { if (Paineis.st[k].dock === 'hide') Paineis.show(k); else { Paineis.st[k].dock = 'hide'; Paineis.apply(); } } })),
      ...['left', 'right'].map(k => ({ label: (Paineis.st[k].dock === 'float' ? '📌 Encaixar ' : '⧉ Soltar (janela) ') + Paineis.P[k].name, action: () => $(`.panel.${k} [data-f]`).click() })),
    ];
  },
  mount() {
    const ma = $('#editor .menu-actions'); if (!ma || $('#ws-btn')) return;
    const b = h('<button class="btn sm ws-btn" id="ws-btn" title="Arrumação da tela (igual ao Krita): Padrão, Para desenhar, Para animar, Para editar… e as suas"></button>'); ma.prepend(b);
    b.onclick = () => { const r = b.getBoundingClientRect(); UI.ctx(r.left, r.bottom + 4, this.menuItems()); }; this.label();
  },
};
Paineis._quiet = true; Paineis.init(); Paineis._quiet = false; Arrumacoes.mount();
