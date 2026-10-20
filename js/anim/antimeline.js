/* ===================== anim/antimeline.js — timeline de animação (estilo Harmony) =====================
   À esquerda a árvore de partes (com olho para esconder); à direita os quadros.
   ◆ = keyframe (qualquer canal da parte naquele quadro) · faixas coloridas = troca de desenho (exposição)
   Clique no número do quadro para ir até ele · arraste um ◆ para mudar o tempo · botão direito = opções */
'use strict';

const AnTL = {
  fw: 14, rh: 24, left: 230, head: 26, scrollX: 0, scrollY: 0, selKeys: new Set(), collapsed: new Set(),
  el: null, cv: null,
  mount(el) {
    this.el = el;
    el.innerHTML = `<div class="atl-bar"><div class="tp-btns" data-tp></div><span class="atl-time" data-time></span><span class="sp"></span>
      <label class="atl-fld">Duração <input type="number" data-dur min="1" step="1"> quadros</label>
      <label class="atl-fld">FPS <select data-fps><option>24</option><option>25</option><option>30</option><option>12</option></select></label>
      <button class="ibtn xs" data-z="-" title="Diminuir zoom da timeline">−</button><button class="ibtn xs" data-z="+" title="Aumentar zoom da timeline">+</button></div>
      <div class="atl-wrap"><canvas class="atl-cv"></canvas></div>`;
    this.cv = $('.atl-cv', el);
    const tp = $('[data-tp]', el);
    [['start', 'skipStart', 'Início (Home)', () => Studio.seek(0)], ['prev', 'stepBack', 'Quadro anterior (,)', () => Studio.seek(Studio.f - 1)], ['play', 'play', 'Tocar / pausar (Espaço)', () => Studio.togglePlay()], ['next', 'stepFwd', 'Próximo quadro (.)', () => Studio.seek(Studio.f + 1)], ['pk', 'diamond', 'Keyframe anterior ( [ )', () => Studio.jumpKey(-1)], ['nk', 'diamond', 'Próximo keyframe ( ] )', () => Studio.jumpKey(1)]].forEach(([k, icn, t, fn]) => {
      const b = h(`<button class="ibtn" data-k="${k}" title="${t}">${ic(icn === 'diamond' ? 'diamond' : icn === 'play' ? 'play' : icn === 'skipStart' ? 'start' : icn === 'stepBack' ? 'left' : 'right', 15)}</button>`); b.onclick = fn; tp.appendChild(b);
    });
    $('[data-dur]', el).onchange = e => { const v = Math.max(1, Math.round(+e.target.value || 1)); Studio.P.frames = v; Studio.commit('Duração alterada'); };
    $('[data-fps]', el).onchange = e => { Studio.P.settings.fps = +e.target.value; Studio.commit('FPS alterado'); };
    el.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { this.fw = clamp(this.fw * (b.dataset.z === '+' ? 1.3 : 1 / 1.3), 4, 60); this.draw(); });
    const wrap = $('.atl-wrap', el);
    wrap.addEventListener('wheel', e => { e.preventDefault(); if (e.ctrlKey) { this.fw = clamp(this.fw * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 4, 60); } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) this.scrollX = Math.max(0, this.scrollX + (e.deltaX || e.deltaY)); else this.scrollY = Math.max(0, this.scrollY + e.deltaY); this.draw(); }, { passive: false });
    this.cv.addEventListener('mousedown', e => this.down(e));
    this.cv.addEventListener('contextmenu', e => { e.preventDefault(); this.menu(e); });
    this.cv.addEventListener('dblclick', e => this.dbl(e));
    new ResizeObserver(() => this.draw()).observe(wrap);
  },
  rows() {
    const P = Studio.P, out = [];
    for (const a of P.audio || []) out.push({ t: 'audio', a, label: '♪ ' + (Assets.meta(a.asset)?.name || 'Áudio') });
    out.push({ t: 'cam', label: '🎥 Câmera' });
    for (const rig of P.rigs) {
      out.push({ t: 'stage', rig, label: rig.name, lv: 0 });
      if (this.collapsed.has(rig.id)) continue;
      for (const [n, lv] of Rig.ordered(rig)) out.push({ t: 'node', rig, n, lv: lv + 1, label: n.name });
    }
    return out;
  },
  get frames() { return Studio.P.frames; },
  x(f) { return this.left + f * this.fw - this.scrollX; },
  fAt(x) { return Math.floor((x - this.left + this.scrollX) / this.fw); },
  keysOf(r) {
    if (r.t === 'node') return Rig.keyFrames(r.rig, r.n.id);
    if (r.t === 'stage') return Rig.keyFrames(r.rig, '@');
    if (r.t === 'cam') { const s = new Set(); for (const ks of Object.values(Studio.P.camera.keys || {})) ks.forEach(k => s.add(k.f)); return [...s].sort((a, b) => a - b); }
    return [];
  },
  // cores da linha do tempo seguem o tema (cinza estilo Toon Boom, escuro…)
  pal() {
    const T = typeof Tema !== 'undefined' ? Tema : null, cs = getComputedStyle(this.el.closest('.an-root') || document.documentElement), v = k => cs.getPropertyValue(k).trim();
    const base = v('--an-p') || '#18191e', mix = (h, k) => T ? T.mix(h, k) : h, ac = T ? T.rgb(T.cfg.cor) : '61,139,255';
    if (this._palKey === base + ac) return this._pal; this._palKey = base + ac;
    return (this._pal = { bg: mix(base, -.25), row1: mix(base, -.1), row2: mix(base, -.04), selRow: `rgba(${ac},.16)`, g1: mix(base, .16), g2: mix(base, .08), g3: mix(base, .02), left: mix(base, -.08), selLeft: `rgba(${ac},.28)`, line: v('--an-line') || '#2a2d34', head: mix(base, -.14) });
  },
  draw() {
    if (!this.cv || !Studio.P) return;
    const wrap = this.cv.parentElement, W = wrap.clientWidth, H = wrap.clientHeight, dpr = devicePixelRatio || 1;
    if (this.cv.width !== W * dpr || this.cv.height !== H * dpr) { this.cv.width = W * dpr; this.cv.height = H * dpr; this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px'; }
    const c = this.cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const rows = this.rows(), fps = Studio.P.settings.fps, F = this.frames, fw = this.fw;
    this.scrollY = Math.min(this.scrollY, Math.max(0, rows.length * this.rh - (H - this.head) + 10));
    $('[data-time]', this.el).textContent = `Quadro ${Studio.f + 1} / ${F} · ${fmtTime(Studio.f / fps, fps)}`;
    const di = $('[data-dur]', this.el); if (document.activeElement !== di) di.value = F; $('[data-fps]', this.el).value = String(fps);
    const pb = $('[data-k=play]', this.el); if (pb) pb.innerHTML = ic(Studio.playing ? 'pause' : 'play', 15);
    // fundo das linhas
    const K = this.pal();
    c.fillStyle = K.bg; c.fillRect(0, 0, W, H);
    rows.forEach((r, i) => {
      const y = this.head + i * this.rh - this.scrollY; if (y < this.head - this.rh || y > H) return;
      const sel = r.t === 'node' ? Studio.selNode?.id === r.n.id : r.t === 'stage' ? Studio.selRig?.id === r.rig.id && !Studio.selNode : r.t === 'cam' ? Studio.selCam : false;
      c.fillStyle = sel ? K.selRow : i % 2 ? K.row1 : K.row2; c.fillRect(0, y, W, this.rh);
    });
    // grade dos quadros
    const f0 = Math.max(0, this.fAt(this.left)), f1 = Math.min(F, this.fAt(W) + 1);
    for (let f = f0; f <= f1; f++) {
      const x = this.x(f); if (x < this.left) continue;
      c.fillStyle = f % fps === 0 ? K.g1 : f % (fps / 2 | 0 || 6) === 0 ? K.g2 : K.g3; c.fillRect(x, this.head, 1, H);
    }
    // fim da cena
    const xe = this.x(F); if (xe < W) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(Math.max(this.left, xe), this.head, W, H); }
    // conteúdo
    rows.forEach((r, i) => {
      const y = this.head + i * this.rh - this.scrollY; if (y < this.head - this.rh || y > H) return;
      c.save(); c.beginPath(); c.rect(this.left, y, W - this.left, this.rh); c.clip();
      if (r.t === 'audio') this.drawAudio(c, r.a, y);
      if (r.t === 'node' && r.n.drawings.length > 1) this.drawExposure(c, r, y);
      for (const f of this.keysOf(r)) { const x = this.x(f) + fw / 2; if (x < this.left - 8 || x > W + 8) continue; const k = (r.t === 'node' ? r.n.id : r.t === 'stage' ? '@' + r.rig.id : 'cam') + ':' + f, s = this.selKeys.has(k);
        c.fillStyle = s ? '#ffd23d' : r.t === 'cam' ? '#7fd1ff' : '#e9ecf3'; c.strokeStyle = '#000'; c.lineWidth = 1; const R = Math.min(6, fw * .42 + 1.5); c.beginPath(); c.moveTo(x, y + this.rh / 2 - R); c.lineTo(x + R, y + this.rh / 2); c.lineTo(x, y + this.rh / 2 + R); c.lineTo(x - R, y + this.rh / 2); c.closePath(); c.fill(); c.stroke(); }
      c.restore();
    });
    // nomes (coluna da esquerda)
    c.fillStyle = K.left; c.fillRect(0, this.head, this.left, H);
    c.font = '12px ' + getComputedStyle(document.body).fontFamily; c.textBaseline = 'middle';
    rows.forEach((r, i) => {
      const y = this.head + i * this.rh - this.scrollY; if (y < this.head - this.rh || y > H) return;
      const sel = r.t === 'node' ? Studio.selNode?.id === r.n.id : r.t === 'stage' ? Studio.selRig?.id === r.rig.id && !Studio.selNode : r.t === 'cam' && Studio.selCam;
      if (sel) { c.fillStyle = K.selLeft; c.fillRect(0, y, this.left, this.rh); }
      const ind = 8 + (r.lv || 0) * 13;
      if (r.t === 'stage') { c.fillStyle = '#9aa3b5'; c.fillText(this.collapsed.has(r.rig.id) ? '▸' : '▾', 6, y + this.rh / 2); }
      if (r.t === 'node') { c.fillStyle = r.n.hidden ? '#555' : '#8d95a8'; c.fillText(r.n.hidden ? '◌' : '●', this.left - 18, y + this.rh / 2); c.fillStyle = { cabeca: '#ff9f6b', olho: '#7fd1ff', boca: '#ff7aa8', braco: '#a8e07a', antebraco: '#a8e07a', mao: '#c7f29a', perna: '#7aa8ff', coxa: '#7aa8ff', pe: '#9fc0ff', cabelo: '#d29bff' }[r.n.role] || '#c9cdd6'; c.fillRect(ind, y + 8, 3, this.rh - 16); }
      c.fillStyle = r.t === 'stage' ? '#fff' : r.n?.hidden ? '#666' : '#d7dae2'; c.font = (r.t === 'stage' ? 'bold ' : '') + '12px ' + getComputedStyle(document.body).fontFamily;
      const txt = r.label + (r.t === 'node' && r.n.drawings.length > 1 ? `  (${r.n.drawings.length} desenhos)` : '') + (r.t === 'node' && r.n.follow ? '  ~' : '');
      c.fillText(txt.length > 30 ? txt.slice(0, 29) + '…' : txt, ind + 8, y + this.rh / 2);
    });
    c.fillStyle = K.line; c.fillRect(this.left - 1, this.head, 1, H);
    // régua
    c.fillStyle = K.head; c.fillRect(0, 0, W, this.head); c.fillStyle = '#7d8494'; c.font = '10px ' + getComputedStyle(document.body).fontFamily;
    const step = fw >= 12 ? 1 : fw >= 6 ? 2 : 5;
    for (let f = f0; f <= f1; f++) { const x = this.x(f); if (x < this.left) continue; if (f % step === 0 && (fw >= 10 || f % (step * 2) === 0)) { c.fillStyle = f % fps === 0 ? '#e0e3ea' : '#7d8494'; c.fillText(String(f + 1), x + 2, 13); } }
    c.fillStyle = '#9aa3b5'; c.font = 'bold 11px ' + getComputedStyle(document.body).fontFamily; c.fillText('Camadas', 10, 13);
    // cabeça de leitura
    const xp = this.x(Studio.f); if (xp >= this.left - fw) { c.fillStyle = 'rgba(255,77,106,.18)'; c.fillRect(xp, this.head, fw, H); c.fillStyle = '#ff4d6a'; c.fillRect(xp, 0, fw, this.head); c.fillStyle = '#fff'; c.font = 'bold 10px ' + getComputedStyle(document.body).fontFamily; c.fillText(String(Studio.f + 1), xp + 2, 13); }
    // papel-cebola
    if (Studio.onion) { c.fillStyle = 'rgba(255,90,90,.25)'; for (let k = 1; k <= Studio.onionN; k++) c.fillRect(this.x(Studio.f - k), this.head - 4, fw, 3); c.fillStyle = 'rgba(90,255,140,.3)'; for (let k = 1; k <= Studio.onionN; k++) c.fillRect(this.x(Studio.f + k), this.head - 4, fw, 3); }
    this._rows = rows;
  },
  drawAudio(c, a, y) {
    const rt = Assets.get(a.asset); if (!rt?.peaks || !rt.buffer) return;
    const fps = Studio.P.settings.fps, dur = rt.buffer.duration, x0 = this.x(a.start), x1 = this.x(a.start + (dur - (a.offset || 0)) * fps);
    c.fillStyle = a.kind === 'musica' ? 'rgba(44,154,90,.35)' : `rgba(${typeof Tema !== 'undefined' ? Tema.rgb(Tema.cfg.cor) : '61,139,255'},.3)`; c.fillRect(x0, y + 2, x1 - x0, this.rh - 4);
    c.fillStyle = a.kind === 'musica' ? '#6fe0a0' : '#8fc1ff'; const pk = rt.peaks, n = pk.length;
    for (let x = Math.max(this.left, x0); x < Math.min(this.cv.width, x1); x++) { const t = (x - x0) / (x1 - x0) * (dur - (a.offset || 0)) + (a.offset || 0); const v = pk[Math.floor(t / dur * n)] || 0; const hh = v * (this.rh - 6); c.fillRect(x, y + this.rh / 2 - hh / 2, 1, hh || 1); }
  },
  drawExposure(c, r, y) {
    const ks = r.rig.keys[r.n.id]?.d || [], cols = ['#3d5a99', '#7a3d99', '#3d8a6b', '#99623d', '#993d55', '#5d993d', '#3d8799', '#99943d'];
    const segs = []; let cur = r.n.d || 0, from = 0;
    for (const k of ks) { if (k.f > from) segs.push([from, k.f, cur]); cur = Math.round(k.v); from = k.f; }
    segs.push([from, this.frames, cur]);
    for (const [a, b, d] of segs) { const x0 = this.x(a), x1 = this.x(b); c.fillStyle = cols[d % cols.length] + 'aa'; c.fillRect(x0, y + 3, x1 - x0 - 1, this.rh - 6); if (x1 - x0 > 30) { c.fillStyle = '#fff'; c.font = '10px sans-serif'; c.fillText((r.n.drawings[d]?.name || String(d + 1)).slice(0, Math.floor((x1 - x0) / 7)), x0 + 4, y + this.rh / 2); } }
  },
  hit(e) { const b = this.cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, i = Math.floor((y - this.head + this.scrollY) / this.rh); return { x, y, row: y > this.head ? this._rows?.[i] : null, f: this.fAt(x) }; },
  rowKey(r, f) { return (r.t === 'node' ? r.n.id : r.t === 'stage' ? '@' + r.rig.id : 'cam') + ':' + f; },
  down(e) {
    if (e.button !== 0) return;
    const H = this.hit(e);
    if (H.y < this.head) { const move = ev => { const h2 = this.hit(ev); Studio.seek(clamp(h2.f, 0, this.frames - 1)); }; move(e); const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); }; addEventListener('mousemove', move); addEventListener('mouseup', up); return; }
    const r = H.row; if (!r) return;
    if (H.x < this.left) {
      if (r.t === 'stage' && H.x < 18) { this.collapsed.has(r.rig.id) ? this.collapsed.delete(r.rig.id) : this.collapsed.add(r.rig.id); return this.draw(); }
      if (r.t === 'node' && H.x > this.left - 26) { r.n.hidden = !r.n.hidden; Studio.commit(r.n.hidden ? 'Parte escondida' : 'Parte visível'); return; }
      Studio.select(r); return;
    }
    Studio.select(r);
    const ks = this.keysOf(r), onKey = ks.includes(H.f);
    if (!onKey) { this.selKeys.clear(); Studio.seek(clamp(H.f, 0, this.frames - 1)); return; }
    const k = this.rowKey(r, H.f);
    if (e.shiftKey) { this.selKeys.has(k) ? this.selKeys.delete(k) : this.selKeys.add(k); } else if (!this.selKeys.has(k)) { this.selKeys.clear(); this.selKeys.add(k); }
    Studio.seek(H.f);
    // arrastar keys selecionados (muda o tempo)
    const startF = H.f; let last = 0;
    const move = ev => { const d = this.hit(ev).f - startF; if (d === last) return; this.shiftKeys(d - last); last = d; this.draw(); Studio.render(); };
    const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); if (last) Studio.commit('Keyframes movidos'); };
    addEventListener('mousemove', move); addEventListener('mouseup', up);
  },
  channelsFor(id) { const P = Studio.P; if (id === 'cam') return P.camera.keys; if (id.startsWith('@')) { const rig = P.rigs.find(r => r.id === id.slice(1)); return rig?.keys['@']; } for (const rig of P.rigs) if (rig.nodes.some(n => n.id === id)) return rig.keys[id]; return null; },
  shiftKeys(d) {
    const list = [...this.selKeys].map(k => { const i = k.lastIndexOf(':'); return [k.slice(0, i), +k.slice(i + 1)]; });
    if (list.some(([, f]) => f + d < 0)) return;
    const moved = new Set();
    for (const [id, f] of list) { const chs = this.channelsFor(id); if (!chs) continue; for (const ks of Object.values(chs)) for (const k of ks) if (k.f === f && !moved.has(k)) { k.f = f + d; moved.add(k); } for (const ks of Object.values(chs)) { ks.sort((a, b) => a.f - b.f); for (let i = ks.length - 1; i > 0; i--) if (ks[i].f === ks[i - 1].f) ks.splice(moved.has(ks[i]) ? i - 1 : i, 1); } }
    this.selKeys = new Set(list.map(([id, f]) => id + ':' + (f + d)));
  },
  dbl(e) { const H = this.hit(e); if (H.row && H.x > this.left) { Studio.select(H.row); Studio.seek(H.f); Studio.keyHere(); } },
  menu(e) {
    const H = this.hit(e), r = H.row; if (!r || H.x < this.left) return;
    Studio.select(r); Studio.seek(clamp(H.f, 0, this.frames - 1));
    const has = this.keysOf(r).includes(H.f), easeSub = Object.entries(EASE_LABEL).map(([k, l]) => ({ label: l, action: () => Studio.setEase(k) }));
    UI.ctx(e.clientX, e.clientY, [
      { label: has ? 'Atualizar keyframe aqui' : 'Criar keyframe aqui', icon: 'diamond', key: 'K', action: () => Studio.keyHere() },
      has && { label: 'Apagar keyframe(s)', icon: 'trash', key: 'Del', action: () => Studio.deleteKeys() },
      { label: 'Curva de movimento (até o próximo)', icon: 'move', sub: easeSub },
      '-',
      { label: 'Copiar pose (Ctrl+C)', icon: 'copy', action: () => Studio.copyPose() },
      { label: 'Colar pose (Ctrl+V)', icon: 'paste', disabled: !Studio.clip, action: () => Studio.pastePose() },
      { label: 'Salvar pose na biblioteca…', icon: 'bookmark', action: () => Studio.savePose() },
      '-',
      { label: 'Inserir 1 quadro aqui (empurra os keys)', icon: 'plus', action: () => Studio.insertFrames(H.f, 1) },
      { label: 'Remover 1 quadro aqui', icon: 'minus', action: () => Studio.insertFrames(H.f, -1) },
    ].filter(Boolean));
  },
};
