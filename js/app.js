/* ===================== app.js — estado do editor, prévia, atalhos e menus ===================== */
'use strict';

const App = {
  project: null, t: 0, playing: false, loop: false, sel: new Set(), selFx: null, activeTrack: null,
  history: [], hIndex: -1, dirty: false, tool: 'select', snap: true, ripple: false,
  pvScale: 1, guides: false, needRender: true, clipboard: null, fxClipboard: null,

  /* ---------- modelo ---------- */
  newProject({ name, w, h, fps, bg }) {
    const tk = (type, name) => ({ id: uid('t_'), type, name, hidden: false, mute: false, lock: false, solo: false, volume: 100, h: type === 'fx' ? 44 : type === 'audio' ? 58 : 64 });
    return {
      id: uid('p_'), name: name || 'Meu projeto', created: Date.now(), modified: Date.now(), version: 1, versaoEstudio: typeof Upgrade !== 'undefined' ? Upgrade.VER : 4, camera: { keys: {} }, formato: (+h || 1080) > (+w || 1920) ? 'shorts' : 'video',
      settings: { w: +w || 1920, h: +h || 1080, fps: +fps || 30, bg: bg || '#ffffff' },
      tracks: [tk('fx', 'Efeitos 1'), tk('visual', 'Vídeo 2'), tk('visual', 'Vídeo 1'), tk('audio', 'Áudio 1'), tk('audio', 'Áudio 2')],
      clips: [], markers: [], bin: [], folders: [], assetFolders: {},
    };
  },
  makeClip(type, o = {}) {
    const c = {
      id: uid('c_'), type, trackId: o.trackId, start: o.start || 0, dur: o.dur || 3, offset: o.offset || 0, speed: 1, name: o.name || '',
      assetId: o.assetId || null, tr: TR_DEFAULT(), color: { ...COLOR_DEFAULT(), tint: '#ff8a2a' }, crop: { l: 0, t: 0, r: 0, b: 0 },
      kf: {}, anims: [], fx: [], trIn: null, trOut: null, volume: 100, fadeIn: 0, fadeOut: 0, muted: false, afx: AFX_DEFAULT(),
    };
    if (type === 'text') { const st = TEXT_STYLES[o.style || 'title']; c.text = { text: st.text, font: st.font, size: st.size, color: st.color, stroke: st.stroke, strokeW: st.strokeW, shadow: st.shadow, bold: !!st.bold, italic: false, align: 'center', lineH: 1.15, spacing: 0, bg: st.bg || '#000000', bgAmt: st.bgAmt || 0 }; c.name = st.name; if (o.style === 'subtitle') c.tr.y = this.project.settings.h * .36; }
    if (type === 'shape') { c.shape = { kind: o.kind || 'rect', w: 400, h: o.kind === 'line' ? 40 : o.kind === 'bubble' || o.kind === 'think' ? 300 : 400, fill: o.kind === 'bubble' || o.kind === 'think' ? '#ffffff' : '#19d3f0', stroke: '#000000', strokeW: o.kind === 'bubble' || o.kind === 'think' ? 8 : 0, fillOn: true, radius: 40 }; c.name = SHAPES[c.shape.kind]; }
    if (type === 'color') { c.colorFill = { mode: 'solid', c1: o.color || '#1e88e5', c2: '#7b1fa2', angle: 90 }; c.name = 'Cor sólida'; if (o.pattern) { c.colorFill = { ...PatternBG.DEF(), angle: 90, ...o.pattern }; c.name = 'Fundo: ' + (PATTERNS[c.colorFill.padrao] || 'padrão'); } }
    if (type === 'fx') { const def = FX[o.fxType]; c.sfx = { type: o.fxType, params: defaultParams(def), sound: defaultSound(def), amount: 100, fade: 0, target: 'below' }; c.name = def.name; c.dur = o.dur || def.dur; }
    return c;
  },
  get duration() { let d = 0; for (const c of this.project.clips) d = Math.max(d, c.start + c.dur); return d; },
  get fps() { return this.project.settings.fps; },
  track(id) { return this.project.tracks.find(t => t.id === id); },
  clip(id) { return this.project.clips.find(c => c.id === id); },
  selected() { return this.project.clips.filter(c => this.sel.has(c.id)); },
  frame(t) { const f = this.fps; return Math.round(t * f) / f; },

  /* ---------- histórico ---------- */
  resetHistory() { this.history = [JSON.stringify(this.project)]; this.hIndex = 0; this.updateUndo(); },
  commit(label, o = {}) {
    this.project.modified = Date.now();
    const s = JSON.stringify(this.project);
    if (this.history[this.hIndex] === s) return;
    this.history = this.history.slice(0, this.hIndex + 1); this.history.push(s);
    if (this.history.length > 150) this.history.shift();
    this.hIndex = this.history.length - 1;
    this.lastLabel = label;
    this.setDirty(true); this.updateUndo();
    if (o.toast) UI.toast(label, { kind: o.kind || 'ok', undo: () => this.undo() });
    if (!o.noRefresh) this.refresh(o);
  },
  commitSoon: debounce(function (label) { App.commit(label, { noRefresh: true }); }, 450),
  undo() { if (!this.project) return; if (this.hIndex <= 0) return UI.toast('Nada para desfazer', { kind: 'warn' }); this.hIndex--; this.restore(); UI.toast('Desfeito', { time: 1400 }); },
  redo() { if (!this.project) return; if (this.hIndex >= this.history.length - 1) return UI.toast('Nada para refazer', { kind: 'warn' }); this.hIndex++; this.restore(); UI.toast('Refeito', { time: 1400 }); },
  restore() {
    const id = this.project.id; this.project = JSON.parse(this.history[this.hIndex]); this.project.id = id;
    for (const s of [...this.sel]) if (!this.clip(s)) this.sel.delete(s);
    if (this.selFx && !this.clip(this.selFx.clipId)) this.selFx = null;
    this.setDirty(true); this.updateUndo(); this.refresh({ all: true });
  },
  updateUndo() { $('#btn-undo').disabled = this.hIndex <= 0; $('#btn-redo').disabled = this.hIndex >= this.history.length - 1; },
  setDirty(v) { this.dirty = v; $('#editor').classList.toggle('dirty', v); this.saveState(v ? 'dirty' : 'saved'); if (v) this.autosave(); },
  saveState(st) {
    const el = $('#save-state'); if (!el) return;
    if (st === 'saved') this.savedAt = new Date();
    const time = this.savedAt ? this.savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    el.className = 'save-state ' + st;
    el.innerHTML = st === 'saving' ? `<span class="spin-dot"></span>Salvando…` : st === 'dirty' ? `${ic('alert', 12)}Não salvo` : `${ic('check', 12, 3)}Salvo${time ? ' às ' + time : ''}`;
    el.title = st === 'dirty' ? 'Tem mudanças ainda não salvas (salva sozinho em instantes). Clique para salvar agora.' : st === 'saved' ? 'Tudo salvo neste computador (no navegador). Para levar para outro PC use "Salvar .toon".' : 'Salvando…';
  },
  autosave: debounce(() => App.save(true), 1500),

  async save(auto = false) {
    if (!this.project) return;
    try {
      const p = this.project; this.saveState('saving');
      try { p.aiChat = Assistant.serialize(); } catch { }
      const thumb = this.makeThumb();
      this.lastThumb = thumb;
      await DB.put('projects', { id: p.id, name: p.name, created: p.created, modified: p.modified, thumb, lastT: this.t, settings: p.settings, dur: this.duration, data: JSON.stringify(p) });
      this.setDirtyQuiet(false); this.updateStorage();
      if (!auto) UI.toast('Salvo neste computador (no navegador). Para levar a outro PC ou mandar para alguém: <b>Salvar .toon</b>', { kind: 'ok', time: 4500, action: { label: 'Salvar .toon', fn: () => Actions.saveToon() } });
    } catch (e) { this.saveState('dirty'); UI.toast('Erro ao salvar: ' + esc(e.message), { kind: 'err' }); }
  },
  setDirtyQuiet(v) { this.dirty = v; $('#editor').classList.toggle('dirty', v); this.saveState(v ? 'dirty' : 'saved'); },
  // capa do projeto: a mídia escolhida, ou a cena onde está o cursor vermelho ao salvar
  makeThumb() {
    try {
      const s = this.project.settings, q = 360 / Math.max(s.w, s.h), cv = document.createElement('canvas');
      const cov = this.project.cover && Assets.get(this.project.cover);
      if (cov) {
        cv.width = Math.round(s.w * q); cv.height = Math.round(s.h * q); const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
        let el = cov.img || null, w = cov.meta.w, hh = cov.meta.h;
        if (cov.meta.kind === 'gif') el = Assets.gifFrame(cov, 0);
        if (cov.meta.kind === 'video') { const v = [...VideoPool.map.values()].find(e => e.assetId === cov.meta.id)?.v; if (v && v.readyState >= 2) el = v; else if (cov.meta.thumb) { const i = new Image(); i.src = cov.meta.thumb; el = i.complete ? i : null; } }
        if (el) { const k = Math.max(cv.width / w, cv.height / hh); c.drawImage(el, (cv.width - w * k) / 2, (cv.height - hh * k) / 2, w * k, hh * k); }
      } else Renderer.render(cv, this.project, Math.min(this.t, Math.max(0, this.duration - .01)), { q, noSync: true });
      return cv.toDataURL('image/jpeg', .75);
    } catch { return null; }
  },

  /* ---------- abrir / fechar ---------- */
  async open(rec) {
    $('#home').classList.add('hidden'); $('#editor').classList.remove('hidden');
    Assets.unloadAll();
    this.project = typeof rec.data === 'string' ? JSON.parse(rec.data) : rec;
    this.migrate(this.project);
    this.t = rec.lastT || 0; this.sel.clear(); this.selFx = null; this.activeTrack = this.project.tracks.find(t => t.type === 'visual')?.id;
    this.resetHistory(); this.setDirtyQuiet(false);
    try { Assistant.restore(this.project); } catch { }
    Timeline.init(); Props.init(); LibUI.init(); if (typeof EdAnimTL !== 'undefined') EdAnimTL.mount(); if (typeof Cena !== 'undefined') Cena.setMode(Cena.mode, true); if (typeof Upgrade !== 'undefined') setTimeout(() => Upgrade.offer(), 800);
    this.refresh({ all: true });
    const n = await Assets.loadProjectAssets(this.project.id);
    await SoundLib.load();
    this.refresh({ all: true });
    this.fitPreview();
    const missing = this.project.clips.filter(c => c.assetId && !c.assetId.startsWith('snd:') && !Assets.get(c.assetId));
    if (missing.length) UI.toast(`${missing.length} clipe(s) com mídia que não foi encontrada neste computador.`, { kind: 'warn', time: 6000 });
    localStorage.setItem('ps-last', this.project.id);
    setTimeout(() => Notify.offer(), 1200);
    setTimeout(() => { try { Transcribe.onOpen(); } catch (e) { console.error(e); } }, 800);
  },
  migrate(p) {
    p.markers ||= []; p.bin ||= []; p.refs ||= []; p.transcripts ||= {}; p.folders ||= []; p.assetFolders ||= {};
    for (const c of p.clips) { c.tr = { ...TR_DEFAULT(), ...c.tr }; c.color ||= { ...COLOR_DEFAULT(), tint: '#ff8a2a' }; c.crop ||= { l: 0, t: 0, r: 0, b: 0 }; c.kf ||= {}; c.anims ||= []; c.fx ||= []; c.afx ||= AFX_DEFAULT(); }
  },
  async goHome(force) {
    if (Assistant.working) { UI.toast('A IA ainda está trabalhando. Espere ela terminar (ou clique em <b>Parar</b> no assistente).', { kind: 'warn' }); return; }
    if (this.playing) this.pause();
    if (!force && this.dirty) await this.save(true);
    Mic.close(); $('#toast-root').innerHTML = ''; Assistant.toggle(false); Assistant.log = []; Assistant.history = [];
    $('#editor').classList.add('hidden'); $('#home').classList.remove('hidden');
    VideoPool.clear(); this.project = null; document.title = ESTUDIO.titulo;
    Home.render();
  },

  /* ---------- atualização da tela ---------- */
  refresh(o = {}) {
    if (!this.project) return;
    $('#proj-name').textContent = this.project.name;
    document.title = this.project.name + ' — ' + ESTUDIO.titulo;
    const s = this.project.settings;
    $('#proj-meta').textContent = `${s.w}×${s.h} · ${s.fps}fps`;
    Timeline.render(); this.updateTime();
    if (o.props !== false) Props.render();
    if (o.all || o.lib || LibUI.tab === 'cena') LibUI.render();
    this.requestRender();
  },
  onAssetsChanged(light) { if (!this.project) return; LibUI.render(); if (!light) Timeline.render(); else Timeline.render(); this.requestRender(); },
  requestRender() { this.needRender = true; },

  /* ---------- seleção ---------- */
  select(ids, add = false) {
    if (!add) this.sel.clear(); this.selGap = null; if (ids && (!Array.isArray(ids) || ids.length)) this.camSel = false;
    (Array.isArray(ids) ? ids : [ids]).forEach(id => id && this.sel.add(id));
    if (this.selFx && !this.sel.has(this.selFx.clipId)) this.selFx = null;
    const c = this.selected()[0]; if (c) this.activeTrack = c.trackId;
    this.refresh();
  },
  toggleSel(id) { this.sel.has(id) ? this.sel.delete(id) : this.sel.add(id); this.refresh(); },
  clearSel() { this.sel.clear(); this.selFx = null; this.selGap = null; this.refresh(); },

  /* ---------- tempo / reprodução ---------- */
  seek(t, { snapFrame = true } = {}) {
    t = Math.max(0, t); if (snapFrame) t = this.frame(t);
    this.t = t;
    if (this.playing) { this.playFrom = t; this.audioT0 = this.silent ? Assets.ctx().currentTime : AudioEngine.play(this.project, t); }
    Timeline.updatePlayhead(); this.updateTime(); this.requestRender();
    if (!this.playing) { Props.refreshKeys(); if ((this.camTool || this.camSel) && !this.sel.size) Props.render(); }
  },
  play(o = {}) {
    if (this.playing) return;
    if (this.t >= this.duration - 1e-3 && !o.keepPos) this.t = 0;
    this.playing = true; this.playFrom = this.t; this.silent = !!o.silent; this.stopAt = o.stopAt ?? null;
    if (o.silent) { const ctx = Assets.ctx(); if (ctx.state === 'suspended') ctx.resume(); this.audioT0 = ctx.currentTime; }
    else this.audioT0 = AudioEngine.play(this.project, this.t);
    $('#tp-play').innerHTML = ic('pause', 18);
  },
  pause() {
    if (!this.playing) return;
    this.playing = false; this.silent = false; AudioEngine.stop(); VideoPool.pauseAll();
    this.t = this.frame(this.t);
    $('#tp-play').innerHTML = ic('play', 18);
    this.requestRender(); Props.render();
  },
  toggle() { this.playing ? this.pause() : this.play(); },
  updateTime() { $('#tp-cur').textContent = fmtTime(this.t, this.fps); $('#tp-dur').textContent = fmtTime(this.duration, this.fps); Timeline.updateTime(); },

  tick() {
    requestAnimationFrame(() => this.tick());
    if (!this.project) return;
    if (this.playing) {
      const ctx = Assets.ctx();
      let t = this.playFrom + Math.max(0, ctx.currentTime - this.audioT0);
      const end = this.recording ? Infinity : this.stopAt ?? Math.max(this.duration, .1);
      if (t >= end) {
        if (this.stopAt != null) { this.t = this.stopAt; this.stopAt = null; this.pause(); Timeline.updatePlayhead(); this.updateTime(); return; }
        if (this.loop) { this.t = 0; this.playFrom = 0; this.audioT0 = AudioEngine.play(this.project, 0); t = 0; }
        else { this.t = end; this.pause(); Timeline.updatePlayhead(); this.updateTime(); return; }
      }
      this.t = t; Timeline.updatePlayhead(true); this.updateTime();
      if (this.recording) Timeline.updateRec();
      this.draw();
    } else if (this.needRender) { this.draw(); }
    if (Mic.nodes) LibUI.meter && LibUI.meter();
  },
  draw() {
    this.needRender = false;
    const cv = $('#pv-canvas'), s = this.project.settings;
    const qs = $('#pv-quality').value;
    let q = qs === 'auto' ? Math.min(1, this.pvScale * (devicePixelRatio || 1)) : +qs;
    let view = null;
    if (this.outside && this.iv) { const d = devicePixelRatio || 1, R = qs === 'auto' ? Math.min(d, 1.5) : Math.min(d, +qs * d / Math.max(this.pvScale, 1e-3)); const vw = Math.round(this.iv.w * R), vh = Math.round(this.iv.h * R); view = { view: new DOMMatrix().scaleSelf(R, R).translateSelf(this.iv.x, this.iv.y).scaleSelf(this.iv.z, this.iv.z), viewW: vw, viewH: vh }; q = R * this.iv.z; }
    if (qs === 'auto' && this.playing && s.w * s.h * q * q > 2.2e6) q = Math.sqrt(2.2e6 / (s.w * s.h));
    const used = new Set();
    try { Renderer.render(cv, this.project, this.t, { q, ...(view || {}), checker: true, noCam: !!this.outside, noFx: typeof EdDraw !== 'undefined' && !!EdDraw.tool, playing: this.playing, usedVideos: used }); } catch (e) { console.error(e); }
    for (const [id, e] of VideoPool.map) if (!used.has(id) && !e.v.paused) e.v.pause();
    this.drawOverlay(); this.drawFinal(); if (typeof Cena !== 'undefined') Cena.placeAI();
    $('#pv-info').textContent = `${s.w}×${s.h} · ${Math.round(q * 100)}%`;
  },

  /* ---------- prévia: tamanho e sobreposição ---------- */
  fitPreview() {
    if (!this.project) return;
    const st = $('#pv-stage'), s = this.project.settings, z = $('#pv-zoom').value;
    const sw = st.clientWidth - 32, sh = st.clientHeight - 32; this.pvPad = 0;
    let w, h;
    if (this.outside) { // espaço infinito: a prévia ocupa tudo, com zoom e arrastar
      w = Math.max(50, sw); h = Math.max(50, sh);
      if (!this.iv || this.iv.w !== w || this.iv.h !== h) { const old = this.iv; const z0 = Math.max(.02, Math.min(w / (s.w * 1.6), h / (s.h * 1.35))); this.iv = old ? { ...old, x: old.x + (w - old.w) / 2, y: old.y + (h - old.h) / 2, w, h } : { z: z0, x: (w - s.w * z0) / 2, y: (h - s.h * z0) / 2, w, h }; }
      this.pvScale = this.iv.z;
    } else {
      this.pvScale = z === 'fit' ? Math.max(.02, Math.min(sw / s.w, sh / s.h)) : +z;
      w = Math.round(s.w * this.pvScale); h = Math.round(s.h * this.pvScale);
    }
    const wrap = $('#pv-wrap'); wrap.style.width = w + 'px'; wrap.style.height = h + 'px';
    const ov = $('#pv-overlay'), d = devicePixelRatio || 1; ov.width = w * d; ov.height = h * d;
    this.requestRender();
  },
  toProject(e) {
    const r = $('#pv-overlay').getBoundingClientRect(), o = this.outside && this.iv ? this.iv : { x: 0, y: 0 }, p = { x: (e.clientX - r.left - o.x) / this.pvScale, y: (e.clientY - r.top - o.y) / this.pvScale };
    const cm = !this.outside && this.camM(); if (!cm) return p; const q = cm.inverse().transformPoint(new DOMPoint(p.x, p.y)); return { x: q.x, y: q.y }; // vendo pela câmera: tela → mundo
  },
  camM(t = this.t) { return this.project ? Renderer.camMatrix(this.project, t) : null; },
  // mostrar o que está fora do quadro (área cinza em volta, como no Toon Boom)
  // modo da prévia: mover clipes / mexer nos ossos / desenhar
  pvModo() { return this.camTool ? 'camera' : typeof EdDraw !== 'undefined' && EdDraw.tool ? 'desenhar' : typeof RigEdit !== 'undefined' && RigEdit.on ? 'ossos' : 'mover'; },
  setPvModo(m) {
    this.camTool = m === 'camera'; if (m === 'camera') { this.sel.clear(); this.camSel = true; } Props.render();
    if (m === 'camera') { if (EdDraw.tool) EdDraw.setTool(null); }
    else if (m === 'desenhar') { EdDraw.setTool(EdDraw.lastTool || 'pincel'); }
    else { if (EdDraw.tool) EdDraw.setTool(null); RigEdit.on = m === 'ossos'; if (m === 'ossos' && !RigEdit.sel()) { const c = this.project.clips.find(x => x.type === 'anim' && this.t >= x.start && this.t < x.start + x.dur); if (c) this.select(c.id); else UI.toast('Selecione um personagem com ossos (ou transforme uma imagem em personagem editável).', { kind: 'warn', time: 3500 }); } }
    this.updatePvModo(); this.requestRender(); Props.render();
  },
  updatePvModo() { const m = this.pvModo(); $$('#pv-modo button').forEach(b => b.classList.toggle('on', b.dataset.v === m)); },
  setOutside(on) { this.outside = on; try { localStorage.setItem('ed-fora', on ? '1' : '0'); } catch { } this.labelOutside(); this.fitPreview(); },
  centerView() { this.iv = null; this.fitPreview(); },
  labelOutside() { const c = $('#pv-center'); if (c) c.style.display = this.outside ? '' : 'none'; const b = $('#pv-outside'); if (!b) return; b.innerHTML = this.outside ? '🎥 Só câmera' : '👁 Ver fora'; b.title = this.outside ? 'Mostrar só o que está dentro da câmera' : 'Mostrar o que está fora da câmera (área em volta, com a moldura da câmera)'; b.classList.toggle('on', !!this.outside); },
  updateFinal() { $('#pv-final')?.classList.toggle('on', !!this.showFinal); const bx = $('#pv-final-box'); if (!bx) return; bx.classList.toggle('on', !!this.showFinal); this.finalDrag(bx); this.placeFinal(); },
  // quadrinho "Resultado final": arraste pelo título; perto das bordas/cantos ele gruda
  placeFinal() { const bx = $('#pv-final-box'); if (!bx) return; let p = null; try { p = JSON.parse(localStorage.getItem('ed-final-pos') || 'null'); } catch { } const par = bx.parentElement, W = par.clientWidth, H = par.clientHeight, w = bx.offsetWidth || 170, h = bx.offsetHeight || 260;
    if (!p) { bx.style.left = ''; bx.style.top = ''; bx.style.right = '12px'; bx.style.bottom = '12px'; return; } bx.style.right = bx.style.bottom = 'auto'; bx.style.left = clamp(p.x, 0, Math.max(0, W - w)) + 'px'; bx.style.top = clamp(p.y, 0, Math.max(0, H - h)) + 'px'; },
  finalDrag(bx) { if (bx._drag) return; bx._drag = true; const hd = $('b', bx); hd.title = 'Arraste para mover · perto da borda ele gruda · duplo clique = canto padrão';
    hd.ondblclick = () => { try { localStorage.removeItem('ed-final-pos'); } catch { } this.placeFinal(); };
    hd.onpointerdown = e => { e.preventDefault(); const par = bx.parentElement, pr = par.getBoundingClientRect(), r = bx.getBoundingClientRect(), x0 = r.left - pr.left, y0 = r.top - pr.top;
      dragPointer(e, (ev, dx, dy) => { const W = par.clientWidth, H = par.clientHeight, w = bx.offsetWidth, h = bx.offsetHeight, S = 28, m = 8; let x = x0 + dx, y = y0 + dy;
        for (const gx of [m, (W - w) / 2, W - w - m]) if (Math.abs(x - gx) < S) x = gx; for (const gy of [m, (H - h) / 2, H - h - m]) if (Math.abs(y - gy) < S) y = gy;
        try { localStorage.setItem('ed-final-pos', JSON.stringify({ x, y })); } catch { } this.placeFinal(); }); }; },
  drawFinal() {
    if (!this.showFinal) return; const cv = $('#pv-final-cv'); if (!cv) return; const s = this.project.settings, w = s.w > s.h ? 240 : 150, q = w / s.w * (devicePixelRatio || 1);
    cv.style.width = w + 'px'; cv.style.height = w * s.h / s.w + 'px';
    try { Renderer.render(cv, this.project, this.t, { q, playing: this.playing }); } catch { }
  },
  hitTest(px, py) {
    const p = this.project;
    for (const tk of p.tracks) {
      if (tk.type !== 'visual' || tk.hidden || tk.lock) continue;
      const act = p.clips.filter(c => c.trackId === tk.id && this.t >= c.start && this.t < c.start + c.dur).sort((a, b) => b.start - a.start);
      for (const c of act) {
        const g = Renderer.geom(p, c, this.t), inv = g.m.inverse(), pt = inv.transformPoint(new DOMPoint(px, py));
        if (pt.x >= g.box.x && pt.x <= g.box.x + g.box.w && pt.y >= g.box.y && pt.y <= g.box.y + g.box.h) return c;
      }
    }
    return null;
  },
  pathAnim() { const s = this.selFx; if (!s || s.kind !== 'anim') return null; const c = this.clip(s.clipId); const a = c?.anims.find(a => a.id === s.id); return a && a.type === 'path' ? { c, a } : null; },
  drawOverlay() {
    const ov = $('#pv-overlay'), c = ov.getContext('2d'), d = devicePixelRatio || 1, k = this.pvScale * d, p = this.project, s = p.settings;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, ov.width, ov.height);
    if (this.outside && this.iv) { // espaço infinito: escurece o que a câmera não pega e mostra a linha da câmera (segue zoom/giro/posição)
      const ox = this.iv.x * d, oy = this.iv.y * d, cm = this.camM(), inv = cm ? cm.inverse() : new DOMMatrix(), P4 = [[0, 0], [s.w, 0], [s.w, s.h], [0, s.h]].map(([x, y]) => inv.transformPoint(new DOMPoint(x, y))).map(q => [q.x * k + ox, q.y * k + oy]);
      const path = () => { c.beginPath(); P4.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); };
      c.fillStyle = 'rgba(12,12,14,.5)'; c.beginPath(); c.rect(0, 0, ov.width, ov.height); P4.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill('evenodd');
      c.save(); c.lineJoin = 'round'; path(); c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 6 * d; c.stroke(); path(); c.strokeStyle = '#ffffff'; c.lineWidth = 3 * d; c.stroke();
      const zc = this.camM() ? Math.round(Renderer.camAt(p, this.t).Z * 100) : 100, lb = `🎥 CÂMERA  ${s.w}×${s.h}${zc !== 100 ? ' · ' + zc + '%' : ''}`, fs = 12 * d; c.font = `800 ${fs}px sans-serif`; const tw = c.measureText(lb).width + 14 * d, lx = P4[0][0], ly = P4[0][1] - fs - 12 * d;
      c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect ? c.roundRect(lx, ly, tw, fs + 8 * d, 5 * d) : c.rect(lx, ly, tw, fs + 8 * d); c.fill(); c.fillStyle = '#16161a'; c.fillText(lb, lx + 7 * d, ly + fs + 1 * d); c.restore();
      c.setTransform(1, 0, 0, 1, ox, oy);
    } else { const cm = this.camM(); if (cm) c.setTransform(new DOMMatrix().scaleSelf(k, k).multiply(cm).multiply(new DOMMatrix().scaleSelf(1 / k, 1 / k))); }
    if (typeof EdDraw !== 'undefined') try { EdDraw.drawOnion(c, k, d); } catch (e) { console.warn(e); }
    if (this.guides) {
      c.strokeStyle = 'rgba(25,211,240,.6)'; c.setLineDash([6, 6]); c.lineWidth = 1;
      [[.05, .05], [.1, .1]].forEach(([mx, my]) => c.strokeRect(s.w * mx * k, s.h * my * k, s.w * (1 - 2 * mx) * k, s.h * (1 - 2 * my) * k));
      c.beginPath(); c.moveTo(s.w / 2 * k, 0); c.lineTo(s.w / 2 * k, s.h * k); c.moveTo(0, s.h / 2 * k); c.lineTo(s.w * k, s.h / 2 * k); c.stroke();
      [1 / 3, 2 / 3].forEach(f => { c.globalAlpha = .4; c.beginPath(); c.moveTo(s.w * f * k, 0); c.lineTo(s.w * f * k, s.h * k); c.moveTo(0, s.h * f * k); c.lineTo(s.w * k, s.h * f * k); c.stroke(); c.globalAlpha = 1; });
      c.setLineDash([]);
    }
    if (this.snapLines) {
      this.snapLines.forEach(l => {
        c.save(); c.strokeStyle = l.k === 'obj' ? '#ffb020' : '#c04dff'; c.lineWidth = (l.k === 'edge' ? 3 : 1.5) * d; if (l.k === 'obj') c.setLineDash([6 * d, 4 * d]);
        c.shadowColor = c.strokeStyle; c.shadowBlur = 6 * d; c.beginPath();
        const ex = l.x !== undefined ? Math.min(Math.max(l.x * k, 1.5 * d), ov.width - 1.5 * d) : 0, ey = l.y !== undefined ? Math.min(Math.max(l.y * k, 1.5 * d), ov.height - 1.5 * d) : 0;
        if (l.x !== undefined) { c.moveTo(ex, 0); c.lineTo(ex, s.h * k); } else { c.moveTo(0, ey); c.lineTo(s.w * k, ey); }
        c.stroke(); c.restore();
      });
    }
    if (this.playing) { if (typeof RigEdit !== 'undefined') try { RigEdit.drawOverlay(c, k, d); } catch (e) { } return; }
    for (const cl of this.selected()) {
      if (cl.type === 'audio' || cl.type === 'fx' || this.t < cl.start || this.t >= cl.start + cl.dur) continue;
      const g = Renderer.geom(p, cl, this.t), b = g.box;
      const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => g.m.transformPoint(new DOMPoint(x, y)));
      c.strokeStyle = (typeof Tema !== 'undefined' ? Tema.cfg.cor : '#3d8bff'); c.lineWidth = 1.5 * d; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q.x * k, q.y * k) : c.moveTo(q.x * k, q.y * k)); c.closePath(); c.stroke();
      const top = g.m.transformPoint(new DOMPoint(b.x + b.w / 2, b.y)), rot = this.rotHandle(g);
      c.beginPath(); c.moveTo(top.x * k, top.y * k); c.lineTo(rot.x * k, rot.y * k); c.stroke();
      c.fillStyle = '#fff'; c.strokeStyle = (typeof Tema !== 'undefined' ? Tema.cfg.cor : '#3d8bff');
      pts.forEach(q => { c.beginPath(); c.rect(q.x * k - 5 * d, q.y * k - 5 * d, 10 * d, 10 * d); c.fill(); c.stroke(); });
      c.beginPath(); c.arc(rot.x * k, rot.y * k, 6 * d, 0, 7); c.fill(); c.stroke();
      // caminho dos keyframes de posição
      if (KF.has(cl, 'tr.x') || KF.has(cl, 'tr.y')) {
        const ts = KF.times(cl); c.strokeStyle = 'rgba(255,176,32,.7)'; c.setLineDash([4 * d, 4 * d]); c.beginPath();
        for (let i = 0; i <= 60; i++) { const lt = ts[0] + (ts[ts.length - 1] - ts[0]) * i / 60, x = s.w / 2 + KF.value(cl, 'tr.x', lt), y = s.h / 2 + KF.value(cl, 'tr.y', lt); i ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k); }
        c.stroke(); c.setLineDash([]);
        ts.forEach(lt => { const x = s.w / 2 + KF.value(cl, 'tr.x', lt), y = s.h / 2 + KF.value(cl, 'tr.y', lt); c.fillStyle = '#ffb020'; c.beginPath(); c.moveTo(x * k, y * k - 5 * d); c.lineTo(x * k + 5 * d, y * k); c.lineTo(x * k, y * k + 5 * d); c.lineTo(x * k - 5 * d, y * k); c.fill(); });
      }
    }
    for (const cl of p.clips) { if (!(cl.type === 'shape' && cl.shape?.livre) || cl.hidden || this.t < cl.start || this.t >= cl.start + cl.dur) continue; const g = Renderer.geom(p, cl, this.t), b = g.box, P4 = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => g.m.transformPoint(new DOMPoint(x, y))); c.save(); c.setLineDash([8 * d, 5 * d]); c.strokeStyle = cl.shape.grupo ? '#2fd6c4' : '#a48bff'; c.lineWidth = 1.5 * d; c.beginPath(); P4.forEach((q, i) => i ? c.lineTo(q.x * k, q.y * k) : c.moveTo(q.x * k, q.y * k)); c.closePath(); c.stroke(); c.setLineDash([]); c.fillStyle = c.strokeStyle; c.font = `bold ${11 * d}px sans-serif`; c.fillText((cl.shape.grupo ? '📎 ' : '❔ ') + (cl.name || 'Item livre'), P4[0].x * k + 4 * d, P4[0].y * k + 14 * d); c.restore(); }
    if (typeof RigEdit !== 'undefined') try { RigEdit.drawOverlay(c, k, d); } catch (e) { console.warn(e); }
    const pa = this.pathAnim();
    if (pa) {
      const bx = s.w / 2 + pa.c.tr.x, by = s.h / 2 + pa.c.tr.y, P = pa.a.params;
      c.strokeStyle = '#ffd34d'; c.lineWidth = 2 * d; c.setLineDash([8 * d, 5 * d]); c.beginPath();
      for (let i = 0; i <= 100; i++) { const q = pathPoint(P.points, i / 100, P.smooth); i ? c.lineTo((bx + q.x) * k, (by + q.y) * k) : c.moveTo((bx + q.x) * k, (by + q.y) * k); }
      c.stroke(); c.setLineDash([]);
      P.points.forEach((q, i) => { c.fillStyle = i === 0 ? '#2fcf7a' : i === P.points.length - 1 ? '#ff4d6a' : '#ffd34d'; c.strokeStyle = '#000'; c.lineWidth = 1.5 * d; c.beginPath(); c.arc((bx + q.x) * k, (by + q.y) * k, 7 * d, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#000'; c.font = `bold ${10 * d}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(i + 1, (bx + q.x) * k, (by + q.y) * k); });
    }
  },
  rotHandle(g) { const b = g.box, top = g.m.transformPoint(new DOMPoint(b.x + b.w / 2, b.y)), ctr = g.m.transformPoint(new DOMPoint(b.x + b.w / 2, b.y + b.h / 2)); const dx = top.x - ctr.x, dy = top.y - ctr.y, l = Math.hypot(dx, dy) || 1, off = 34 / this.pvScale; return { x: top.x + dx / l * off, y: top.y + dy / l * off }; },

  /* define um valor (cria keyframe automaticamente se a propriedade já for animada) */
  setProp(clip, path, v) {
    const lt = clamp(this.t - clip.start, 0, clip.dur);
    if (KF.has(clip, path)) KF.set(clip, path, lt, v);
    else if (this.autoKey && ANIMATABLE[path]) { const old = getPath(clip, path); if (lt > 1e-3) KF.set(clip, path, 0, old ?? v); KF.set(clip, path, lt, v); }
    else setPath(clip, path, v);
  },
  setAutoKey(on) {
    this.autoKey = on; const b = $('#pv-autokey');
    b.innerHTML = `${ic('diamond', 12)} ${on ? 'Gravando keys' : 'Auto-key'}`; b.classList.toggle('on', on); b.style.borderColor = on ? '#ff4d6a' : ''; b.style.background = on ? 'rgba(255,77,106,.18)' : '';
    $('#pv-wrap').style.outline = on ? '2px solid #ff4d6a' : ''; $('#pv-wrap').style.outlineOffset = '3px';
    UI.toast(on ? 'Modo animar ligado: mova o cursor vermelho e mexa no objeto (posição, tamanho, giro, valores) — cada mudança vira keyframe.' : 'Modo animar desligado', { time: on ? 5000 : 1500 });
  },

  /* ---------- interação na prévia ---------- */
  initPreview() {
    const ov = $('#pv-overlay');
    ov.addEventListener('wheel', e => {
      if (typeof EdCam !== 'undefined' && EdCam.wheel(e)) return;
      if (!this.outside || !this.iv) return; e.preventDefault(); e.stopImmediatePropagation(); // espaço infinito: rodinha = zoom no mouse, Shift = andar
      const r = ov.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, v = this.iv;
      if (e.shiftKey) { v.x -= e.deltaY || e.deltaX; } else { const z = clamp(v.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), .02, 8); v.x = mx - (mx - v.x) * z / v.z; v.y = my - (my - v.y) * z / v.z; v.z = z; this.pvScale = z; }
      this.requestRender();
    }, { passive: false });
    addEventListener('keydown', e => { if (e.code === 'Space' && this.outside && !e.target.closest('input,textarea,select')) this._spaceDown = true; });
    addEventListener('keyup', e => { if (e.code === 'Space') this._spaceDown = false; });
    ov.addEventListener('pointerdown', e => { // andar pelo espaço: botão do meio, ou Espaço + arrastar
      if (!this.outside || !this.iv || !(e.button === 1 || (e.button === 0 && this._spaceDown))) return;
      e.preventDefault(); e.stopImmediatePropagation(); const x0 = this.iv.x, y0 = this.iv.y; ov.style.cursor = 'grabbing';
      dragPointer(e, (ev, dx, dy) => { this.iv.x = x0 + dx; this.iv.y = y0 + dy; this.requestRender(); }, () => { ov.style.cursor = ''; });
    }, true);
    ov.addEventListener('pointerdown', e => {
      if (!this.project || e.button !== 0) return;
      if (typeof EdDraw !== 'undefined' && EdDraw.tool && EdDraw.down(e)) return; // desenhando na prévia
      if (this.camTool && EdCam.down(e)) return; // mexendo a câmera
      if (this.playing) this.pause();
      const pt = this.toProject(e), s = this.project.settings, tol = 9 / this.pvScale;
      // pontos do caminho
      const pa = this.pathAnim();
      if (pa) {
        const bx = s.w / 2 + pa.c.tr.x, by = s.h / 2 + pa.c.tr.y;
        const i = pa.a.params.points.findIndex(q => Math.hypot(bx + q.x - pt.x, by + q.y - pt.y) < tol * 1.3);
        if (i >= 0) {
          const q = pa.a.params.points[i], ox = q.x, oy = q.y;
          dragPointer(e, (ev, dx, dy) => { q.x = Math.round(ox + dx / this.pvScale); q.y = Math.round(oy + dy / this.pvScale); this.requestRender(); }, () => { this.commit('Caminho ajustado'); });
          return;
        }
      }
      // diamantes do caminho de keyframes (posição)
      for (const cl of this.selected()) {
        if (!(KF.has(cl, 'tr.x') || KF.has(cl, 'tr.y'))) continue;
        const kt = KF.times(cl).find(lt => Math.hypot(s.w / 2 + KF.value(cl, 'tr.x', lt) - pt.x, s.h / 2 + KF.value(cl, 'tr.y', lt) - pt.y) < tol);
        if (kt === undefined) continue;
        const x0 = KF.value(cl, 'tr.x', kt), y0 = KF.value(cl, 'tr.y', kt); let moved = false;
        if (!KF.at(cl, 'tr.x', kt, 1e-3)) KF.set(cl, 'tr.x', kt, x0); if (!KF.at(cl, 'tr.y', kt, 1e-3)) KF.set(cl, 'tr.y', kt, y0);
        dragPointer(e, (ev, dx, dy) => { moved = true; KF.at(cl, 'tr.x', kt, 1e-3).v = Math.round(x0 + dx / this.pvScale); KF.at(cl, 'tr.y', kt, 1e-3).v = Math.round(y0 + dy / this.pvScale); this.requestRender(); Props.liveUpdate(); },
          () => { if (moved) this.commit('Keyframe de posição movido'); else this.seek(cl.start + kt); });
        return;
      }
      // ossos do personagem (clipe com boneco)
      if (typeof RigEdit !== 'undefined' && RigEdit.down(e, pt)) return;
      // alças da seleção
      for (const cl of this.selected()) {
        if (cl.type === 'audio' || cl.type === 'fx' || this.t < cl.start || this.t >= cl.start + cl.dur || this.track(cl.trackId)?.lock) continue;
        const g = Renderer.geom(this.project, cl, this.t), b = g.box;
        const rot = this.rotHandle(g);
        if (Math.hypot(rot.x - pt.x, rot.y - pt.y) < tol * 1.2) return this.dragRotate(e, cl, g);
        const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
        for (const [x, y] of corners) { const q = g.m.transformPoint(new DOMPoint(x, y)); if (Math.hypot(q.x - pt.x, q.y - pt.y) < tol) return this.dragScale(e, cl, g, x, y); }
      }
      const hit = this.hitTest(pt.x, pt.y);
      if (!hit) { if (!e.shiftKey) this.clearSel(); return; }
      if (e.shiftKey) this.toggleSel(hit.id); else if (!this.sel.has(hit.id)) this.select(hit.id);
      this.dragMove(e, this.selected().filter(c => c.type !== 'audio' && !this.track(c.trackId)?.lock));
    });
    ov.addEventListener('dblclick', e => {
      if (!this.pathAnim()) { const pt0 = this.toProject(e), h0 = this.hitTest(pt0.x, pt0.y);
        if (h0?.type === 'anim' && typeof Cena !== 'undefined') { const rig = RigEdit.rig(h0), n = rig?.nodes.find(x => x.id === RigEdit.selNode); if (n && RigEdit.sel() === h0) return Cena.editPart(h0, n); this.select(h0.id); Props.tab = 'rig'; Props.render(); return; }
        if (h0?.type === 'image' && typeof ImgEdit !== 'undefined') return ImgEdit.open({ asset: h0.assetId, name: h0.name, onSave: id => { h0.assetId = id; this.commit('Imagem editada'); }, onLayers: items => RigEdit.fromLayers(h0, items) }); }
      const pa = this.pathAnim(); if (!pa) { const pt = this.toProject(e), hit = this.hitTest(pt.x, pt.y); if (hit && hit.type === 'text') { this.select(hit.id); Props.tab = 'content'; Props.render(); setTimeout(() => { const ta = $('#props textarea'); ta && ta.focus(); }, 50); } return; }
      const pt = this.toProject(e), s = this.project.settings, bx = s.w / 2 + pa.c.tr.x, by = s.h / 2 + pa.c.tr.y;
      const pts = pa.a.params.points, np = { x: Math.round(pt.x - bx), y: Math.round(pt.y - by) };
      // insere no segmento mais próximo
      let best = pts.length, bd = Infinity;
      for (let i = 0; i < pts.length - 1; i++) { const m = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 }, dd = Math.hypot(m.x - np.x, m.y - np.y); if (dd < bd) { bd = dd; best = i + 1; } }
      const dl = Math.hypot(pts[pts.length - 1].x - np.x, pts[pts.length - 1].y - np.y); if (dl < bd) best = pts.length;
      pts.splice(best, 0, np); this.commit('Ponto adicionado ao caminho');
    });
    ov.addEventListener('contextmenu', e => {
      e.preventDefault();
      const pa = this.pathAnim(), pt = this.toProject(e), s = this.project.settings;
      if (pa) {
        const bx = s.w / 2 + pa.c.tr.x, by = s.h / 2 + pa.c.tr.y, pts = pa.a.params.points;
        const i = pts.findIndex(q => Math.hypot(bx + q.x - pt.x, by + q.y - pt.y) < 12 / this.pvScale);
        if (i >= 0) return UI.ctx(e.clientX, e.clientY, [{ label: 'Remover ponto ' + (i + 1), icon: 'trash', danger: true, disabled: pts.length <= 2, action: () => { pts.splice(i, 1); this.commit('Ponto removido'); } }]);
      }
      const hit = this.hitTest(pt.x, pt.y); if (hit && !this.sel.has(hit.id)) this.select(hit.id);
      if (hit) Timeline.clipMenu(e, hit);
    });
    ov.addEventListener('wheel', e => {
      if (!e.ctrlKey) return; e.preventDefault();
      const zs = [.1, .25, .5, .75, 1, 1.5, 2, 3]; let cur = this.pvScale, i = zs.findIndex(z => z > cur + 1e-3);
      const nz = e.deltaY < 0 ? (zs[i] || 3) : (zs.slice().reverse().find(z => z < cur - 1e-3) || .1);
      const sel = $('#pv-zoom'); if (![...sel.options].some(o => o.value == nz)) sel.add(new Option(Math.round(nz * 100) + '%', nz)); sel.value = nz; this.fitPreview();
    }, { passive: false });
  },
  // caixa do objeto na tela (alinhada aos eixos), em unidades do projeto
  bounds(c) {
    const g = Renderer.geom(this.project, c, this.t), b = g.box;
    const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => g.m.transformPoint(new DOMPoint(x, y)));
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
  },
  dragMove(e, clips) {
    if (!clips.length) return;
    const s = this.project.settings, start = clips.map(c => ({ c, x: KF.value(c, 'tr.x', this.t - c.start), y: KF.value(c, 'tr.y', this.t - c.start) }));
    // alvos para grudar: centro e bordas da tela + bordas/centros dos outros objetos visíveis
    const b0 = clips.map(c => this.bounds(c)).reduce((a, q) => ({ l: Math.min(a.l, q.l), r: Math.max(a.r, q.r), t: Math.min(a.t, q.t), b: Math.max(a.b, q.b) }));
    const tx = [{ v: 0, k: 'edge' }, { v: s.w / 2, k: 'center' }, { v: s.w, k: 'edge' }], ty = [{ v: 0, k: 'edge' }, { v: s.h / 2, k: 'center' }, { v: s.h, k: 'edge' }];
    const ids = new Set(clips.map(c => c.id));
    this.project.clips.filter(c => !ids.has(c.id) && !['audio', 'fx', 'color'].includes(c.type) && this.t >= c.start && this.t < c.start + c.dur && !this.track(c.trackId)?.hidden).forEach(c => {
      const q = this.bounds(c); tx.push({ v: q.l, k: 'obj' }, { v: q.r, k: 'obj' }, { v: (q.l + q.r) / 2, k: 'obj' }); ty.push({ v: q.t, k: 'obj' }, { v: q.b, k: 'obj' }, { v: (q.t + q.b) / 2, k: 'obj' });
    });
    let moved = false;
    dragPointer(e, (ev, dx, dy) => {
      moved = true; let mx = dx / this.pvScale, my = dy / this.pvScale;
      this.snapLines = null;
      if (this.snap && !ev.altKey) {
        const th = 9 / this.pvScale, lines = [];
        const best = (edges, targets) => { let r = null; for (const [ev2, name] of edges) for (const t of targets) { const d = t.v - ev2; if (Math.abs(d) < th && (!r || Math.abs(d) < Math.abs(r.d))) r = { d, v: t.v, k: t.k }; } return r; };
        const ex = [[b0.l + mx, 'l'], [(b0.l + b0.r) / 2 + mx, 'c'], [b0.r + mx, 'r']], ey = [[b0.t + my, 't'], [(b0.t + b0.b) / 2 + my, 'c'], [b0.b + my, 'b']];
        const sx = best(ex, tx), sy = best(ey, ty);
        if (sx) { mx += sx.d; lines.push({ x: sx.v, k: sx.k }); }
        if (sy) { my += sy.d; lines.push({ y: sy.v, k: sy.k }); }
        this.snapLines = lines.length ? lines : null;
      }
      if (ev.shiftKey) { if (Math.abs(mx) > Math.abs(my)) my = 0; else mx = 0; }
      start.forEach(o => { this.setProp(o.c, 'tr.x', Math.round(o.x + mx)); this.setProp(o.c, 'tr.y', Math.round(o.y + my)); });
      this.requestRender(); Props.liveUpdate();
    }, () => { this.snapLines = null; if (moved) this.commit('Posição alterada'); this.requestRender(); });
  },
  dragScale(e, cl, g, lx, ly) {
    const s0 = KF.value(cl, 'tr.scale', this.t - cl.start), sx0 = cl.tr.sx, sy0 = cl.tr.sy;
    const ctr = g.m.transformPoint(new DOMPoint(g.box.x + g.box.w / 2, g.box.y + g.box.h / 2));
    const c0 = g.m.transformPoint(new DOMPoint(lx, ly)), d0 = Math.hypot(c0.x - ctr.x, c0.y - ctr.y) || 1;
    dragPointer(e, ev => {
      const pt = this.toProject(ev), d = Math.hypot(pt.x - ctr.x, pt.y - ctr.y);
      if (ev.shiftKey) { // esticar livre
        const inv = g.m.inverse(), lp = inv.transformPoint(new DOMPoint(pt.x, pt.y)), cx = g.box.x + g.box.w / 2, cy = g.box.y + g.box.h / 2;
        this.setProp(cl, 'tr.sx', round(Math.max(.01, sx0 * Math.abs(lp.x - cx) / Math.abs(lx - cx)), 3)); this.setProp(cl, 'tr.sy', round(Math.max(.01, sy0 * Math.abs(lp.y - cy) / Math.abs(ly - cy)), 3));
      } else this.setProp(cl, 'tr.scale', round(Math.max(.01, s0 * d / d0), 3));
      this.requestRender(); Props.liveUpdate();
    }, () => this.commit('Tamanho alterado'));
  },
  dragRotate(e, cl, g) {
    const ctr = g.m.transformPoint(new DOMPoint(g.box.x + g.box.w / 2, g.box.y + g.box.h / 2)), r0 = KF.value(cl, 'tr.rot', this.t - cl.start);
    const p0 = this.toProject(e), a0 = Math.atan2(p0.y - ctr.y, p0.x - ctr.x);
    dragPointer(e, ev => {
      const pt = this.toProject(ev); let r = r0 + (Math.atan2(pt.y - ctr.y, pt.x - ctr.x) - a0) * 180 / Math.PI;
      if (ev.shiftKey) r = Math.round(r / 15) * 15;
      this.setProp(cl, 'tr.rot', round(r, 1)); this.requestRender(); Props.liveUpdate();
    }, () => this.commit('Rotação alterada'));
  },

  /* ---------- menus ---------- */
  menus() {
    const sel = this.sel.size > 0;
    return {
      'Arquivo': [
        { label: 'Novo projeto…', icon: 'plus', action: () => Home.newProjectModal() },
        { label: 'Salvar', icon: 'save', key: Keys.label('save'), action: () => this.save() },
        { label: 'Salvar arquivo .toon (com todas as mídias)…', icon: 'package', key: Keys.label('saveToon'), action: () => Actions.saveToon() },
        { label: '🔄 Atualizar este projeto para a versão nova', action: () => { const ch = Upgrade.run(); UI.toast(ch.length ? 'Atualizado: ' + ch.join(', ') : 'Já estava na versão nova', { kind: 'ok', time: 3000 }); } },
        { label: 'Abrir arquivo .toon…', icon: 'folder', action: () => Home.openToon() },
        '-',
        { label: 'Importar mídia…', icon: 'upload', key: Keys.label('import'), action: () => Actions.importDialog() },
        { label: 'Personagem com ossos…', icon: 'layers', action: () => RigEdit.addRigModal() },
        { label: 'Exportar…', icon: 'download', key: Keys.label('export'), action: () => Exporter.open() },
        { label: 'Exportar quadro atual (PNG)', icon: 'camera', action: () => Exporter.snapshot() },
        '-',
        { label: 'Voltar à tela inicial', icon: 'home', action: () => this.goHome() },
      ],
      'Editar': [
        { label: 'Desfazer', icon: 'undo', key: Keys.label('undo'), disabled: this.hIndex <= 0, action: () => this.undo() },
        { label: 'Refazer', icon: 'redo', key: Keys.label('redo'), disabled: this.hIndex >= this.history.length - 1, action: () => this.redo() },
        '-',
        { label: 'Recortar', key: Keys.label('cut'), disabled: !sel, action: () => Actions.cut() },
        { label: 'Copiar', icon: 'copy', key: Keys.label('copy'), disabled: !sel, action: () => Actions.copy() },
        { label: 'Colar', icon: 'paste', key: Keys.label('paste'), disabled: !this.clipboard, action: () => Actions.paste() },
        { label: 'Copiar efeitos do clipe', icon: 'wand', key: Keys.label('copyFx'), disabled: this.sel.size !== 1, action: () => Actions.copyEffects() },
        { label: 'Colar efeitos nos selecionados…', icon: 'sparkles', key: Keys.label('pasteFx'), disabled: !this.fxClipboard || !sel, action: () => Actions.pasteEffectsDialog() },
        { label: 'Duplicar', icon: 'dup', key: Keys.label('duplicate'), disabled: !sel, action: () => Actions.duplicate() },
        { label: 'Excluir', icon: 'trash', key: Keys.label('delete'), disabled: !sel, action: () => Actions.deleteSel() },
        '-',
        { label: 'Ao soltar mídia em cima de um clipe', icon: 'image', sub: [['ask', 'Perguntar'], ['replace', 'Substituir sempre'], ['add', 'Colocar como clipe novo']].map(([k, l]) => ({ label: l, checked: Actions.replacePref === k, action: () => { Actions.replacePref = k; UI.toast('Ao soltar mídia em cima de um clipe: ' + l, { kind: 'ok' }); } })) },
        '-',
        { label: 'Selecionar tudo', key: Keys.label('selectAll'), action: () => this.select(this.project.clips.map(c => c.id)) },
        { label: 'Selecionar tudo depois do cursor', action: () => this.select(this.project.clips.filter(c => c.start >= this.t - 1e-3).map(c => c.id)) },
      ],
      'Clipe': [
        { label: 'Dividir no cursor', icon: 'scissors', key: Keys.label('split'), disabled: !sel, action: () => Actions.split() },
        { label: 'Adicionar keyframe (posição/escala/rotação)', icon: 'diamond', key: Keys.label('keyframe'), disabled: this.sel.size !== 1, action: () => Actions.keyAll() },
        { label: 'Animação rápida De → Para…', icon: 'move', disabled: this.sel.size !== 1, action: () => Actions.quickAnim() },
        { label: 'Salvar efeitos deste clipe como predefinição…', icon: 'bookmark', disabled: this.sel.size !== 1, action: () => Actions.savePresetFromClip() },
        { label: 'Remover todos os efeitos', icon: 'x', disabled: !sel, action: () => Actions.clearEffects() },
        '-',
        { label: 'Ajustar ao tamanho da tela', disabled: !sel, action: () => Actions.fitSel('contain') },
        { label: 'Preencher a tela', disabled: !sel, action: () => Actions.fitSel('cover') },
        { label: 'Centralizar', disabled: !sel, action: () => Actions.centerSel() },
      ],
      'Faixa': [
        { label: 'Nova faixa de vídeo/imagem', icon: 'film', action: () => Actions.addTrack('visual') },
        { label: 'Nova faixa de áudio', icon: 'music', action: () => Actions.addTrack('audio') },
        { label: 'Nova faixa de efeitos (tela toda)', icon: 'sparkles', action: () => Actions.addTrack('fx') },
        '-',
        { label: 'Adicionar marcador', icon: 'marker', key: Keys.label('marker'), action: () => Actions.addMarker() },
      ],
      'Projeto': [
        { label: 'Configurações do projeto…', icon: 'gear', action: () => Actions.projectSettings() },
        { label: 'Terminar edição pela transcrição (legendas e reações)', icon: 'text', disabled: !Transcribe.pendingAuto().length, action: () => Transcribe.finishAuto() },
        { label: 'Salvar como modelo…', icon: 'grid', action: () => Actions.saveAsTemplate() },
        { label: 'Mídias não usadas: limpar…', icon: 'trash', action: () => Actions.cleanUnused() },
        { label: 'Espaço usado no navegador…', icon: 'package', action: () => Home.storageModal() },
      ],
      'Exibir': [
        { label: 'Tema e cores…', icon: 'palette', action: () => Tema.open() },
        '-',
        { label: '⇄ Trocar os painéis de lado', action: () => Layout.toggle('swap') },
        { label: '⬆ Linha do tempo em cima', checked: document.body.classList.contains('lay-tltop'), action: () => Layout.toggle('tltop') },
        { label: '✏️ Barra de desenho: grudar na esquerda', action: () => { try { localStorage.removeItem('ed-draw-pos'); } catch { } EdDraw.place(); } },
        { label: '↺ Arrumação padrão', action: () => Layout.reset() },
        '-', ...Arrumacoes.menuItems(),
      ],
      'Ajuda': [
        { label: 'Atalhos do teclado (trocar)…', icon: 'keyboard', action: () => Keys.open() },
        { label: 'Como funciona', icon: 'info', action: () => Actions.howTo() },
        { label: `Sair da conta (${TurmaAuth.email || ''})`, icon: 'lock', action: () => TurmaAuth.signOut() },
        { label: Notify.on ? 'Notificações ativadas ✓' : 'Ativar notificações…', icon: 'info', disabled: Notify.on, action: () => Notify.offer(true) },
      ],
    };
  },
  initMenus() {
    const nav = $('#menus'); nav.innerHTML = '';
    for (const name of Object.keys(this.menus())) {
      const b = h(`<button class="menu-btn">${name}</button>`);
      b.onclick = () => { const r = b.getBoundingClientRect(); b.classList.add('open'); UI.ctx(r.left, r.bottom + 4, this.menus()[name]); const off = () => { b.classList.remove('open'); }; setTimeout(() => document.addEventListener('mousedown', off, { once: true }), 0); };
      nav.appendChild(b);
    }
    // o círculo de espaço usado no navegador agora é o padrão de todos os projetos (/estudio-conta.js, ao lado do Menu)
    this.updateStorage();
  },
  async updateStorage() {
    const g = $('#store-ring'); if (!g) return;
    try {
      const u = await Home.usedBytes(), pct = u.quota ? u.usage / u.quota * 100 : 0;
      const col = pct > 85 ? 'var(--err)' : pct > 60 ? 'var(--warn)' : 'var(--cy)';
      const arc = $('[data-arc]', g); arc.setAttribute('stroke-dasharray', `${Math.max(pct > 0 ? 2 : 0, Math.min(100, pct)).toFixed(1)} 100`); arc.setAttribute('stroke', col);
      $('[data-txt]', g).textContent = fmtBytes(u.usage);
      g.title = `Espaço no navegador: ${fmtBytes(u.usage)} usados${u.quota ? ` de ${fmtBytes(u.quota)} (${pct < 1 ? pct.toFixed(2) : Math.round(pct)}%) · livre: ${fmtBytes(Math.max(0, u.quota - u.usage))}` : ''}\nClique para ver os projetos e limpar`;
    } catch { }
  },

  /* ---------- teclado ---------- */
  initKeys() { Keys.init(); },

  /* ---------- inicialização ---------- */
  init() {
    $('#btn-undo').innerHTML = ic('undo'); $('#btn-redo').innerHTML = ic('redo');
    $('#btn-save').innerHTML = ic('save', 15); $('#btn-save').classList.add('ibtn-like'); $('#btn-toon').innerHTML = ic('package', 15) + '.toon'; $('#btn-toon').classList.add('ibtn-like'); $('#btn-toon').onclick = () => Actions.saveToon(); $('#btn-ai').innerHTML = ic('sparkles', 14) + 'Assistente'; $('#btn-ai').onclick = () => Assistant.toggle(); $('#btn-export').innerHTML = ic('download', 14) + 'Exportar';
    $('#tp-start').innerHTML = ic('start'); $('#tp-prev').innerHTML = ic('prev'); $('#tp-play').innerHTML = ic('play', 18);
    $('#tp-next').innerHTML = ic('next'); $('#tp-end').innerHTML = ic('end'); $('#tp-loop').innerHTML = ic('loop');
    $('#tp-vol-ic').innerHTML = ic('vol'); $('#pv-guides').innerHTML = ic('safe'); $('#pv-guides').title = 'Guias de área segura'; $('#pv-snapshot').innerHTML = ic('camera');
    $('#btn-home').onclick = () => this.goHome();
    $('#btn-undo').onclick = () => this.undo(); $('#btn-redo').onclick = () => this.redo();
    $('#btn-save').onclick = () => this.save(); $('#btn-export').onclick = () => Exporter.open();
    $('#tp-play').onclick = () => this.toggle(); $('#tp-start').onclick = () => this.seek(0); $('#tp-end').onclick = () => this.seek(this.duration);
    $('#tp-prev').onclick = () => this.seek(this.t - 1 / this.fps); $('#tp-next').onclick = () => this.seek(this.t + 1 / this.fps);
    $('#tp-loop').onclick = () => { this.loop = !this.loop; $('#tp-loop').classList.toggle('on', this.loop); };
    $('#tp-vol').oninput = e => { AudioEngine.setVolume(+e.target.value); $('#tp-vol-ic').innerHTML = ic(+e.target.value ? 'vol' : 'mute'); };
    $('#pv-zoom').onchange = () => this.fitPreview(); $('#pv-quality').onchange = () => this.requestRender();
    const em = $('#ep-modo'); if (em) $('[data-m=ossos]', em).onclick = () => RigEdit.openAny();
    $$('#pv-modo button').forEach(b => b.onclick = () => this.setPvModo(b.dataset.v));
    try { this.outside = localStorage.getItem('ed-fora') === '1'; this.showFinal = localStorage.getItem('ed-final') === '1'; } catch { } $('#pv-outside').onclick = () => this.setOutside(!this.outside); this.labelOutside();
    $('#pv-center').onclick = () => this.centerView();
    $('#pv-final').innerHTML = '📺'; $('#pv-final').title = 'Resultado final: quadrinho com o vídeo pronto'; $('#pv-final').onclick = () => { this.showFinal = !this.showFinal; try { localStorage.setItem('ed-final', this.showFinal ? '1' : '0'); } catch { } this.updateFinal(); this.requestRender(); }; this.updateFinal();
    $('#pv-guides').onclick = () => { this.guides = !this.guides; $('#pv-guides').classList.toggle('on', this.guides); this.requestRender(); };
    $('#pv-snapshot').onclick = () => Exporter.snapshot();
    this.autoKey = false; $('#pv-autokey').innerHTML = `${ic('diamond', 12)} Modo animar`; $('#pv-autokey').onclick = () => this.setAutoKey(!this.autoKey);
    $('#proj-name').onclick = () => Actions.projectSettings();
    $('#proj-meta').onclick = () => Actions.projectSettings();
    $('#save-state').onclick = () => this.save();
    $('#proj-meta').title = 'Clique para mudar tamanho, fps e fundo do projeto';
    $('#proj-name').title = 'Clique para mudar nome, tamanho e fps do projeto';
    // larguras dos painéis
    const ed = $('#editor');
    const sideSplit = (id, varName, sign, min, max) => $(id).addEventListener('pointerdown', e => {
      const w0 = parseFloat(getComputedStyle(ed).getPropertyValue(varName)) || 300, el = $(id); el.classList.add('drag');
      dragPointer(e, (ev, dx) => { ed.style.setProperty(varName, clamp(w0 + dx * sign, min, max) + 'px'); this.fitPreview(); Timeline.drawRuler(); }, () => { el.classList.remove('drag'); try { localStorage.setItem('ps' + varName, getComputedStyle(ed).getPropertyValue(varName)); } catch { } Arrumacoes?.changed(); });
    });
    sideSplit('#split-l', '--lw', 1, 200, 640); sideSplit('#split-r', '--rw', -1, 240, 700);
    try { ['--lw', '--rw'].forEach(v => { const x = localStorage.getItem('ps' + v); if (x) ed.style.setProperty(v, x); }); } catch { }
    // botão direito do navegador desligado (só o menu do editor)
    document.addEventListener('contextmenu', e => { if (!e.target.closest('input[type=text],input:not([type]),textarea')) e.preventDefault(); });
    // soltar arquivos em qualquer lugar do editor = importar para a Mídia
    let dragDepth = 0;
    const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
    window.addEventListener('dragenter', e => { if (hasFiles(e) && this.project) { dragDepth++; ed.classList.add('drop-files'); } });
    window.addEventListener('dragleave', e => { if (hasFiles(e)) { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) ed.classList.remove('drop-files'); } });
    window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
    // Ctrl+A vale para onde você clicou por último: Mídia (painel da esquerda) ou linha do tempo
    document.addEventListener('pointerdown', e => { LibUI.focused = !!e.target.closest?.('.panel.left'); }, true);
    window.addEventListener('drop', e => {
      dragDepth = 0; ed.classList.remove('drop-files');
      if (!hasFiles(e)) { // link do YouTube arrastado do navegador → referência de estilo
        const u = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '').trim();
        if (this.project && !e._handled && StyleRefs.platform(u) && /^https?:/.test(u)) { e.preventDefault(); StyleRefs.addLink(u); }
        return;
      }
      e.preventDefault();
      if (!this.project || e.defaultPrevented && e._handled) return;
      if (e._handled) return;
      const files = [...e.dataTransfer.files]; if (files.some(f => f.name.toLowerCase().endsWith('.toon'))) return Home.openToon(files.find(f => f.name.toLowerCase().endsWith('.toon')));
      Actions.importFiles(files);
    });
    // redimensionar linha do tempo
    $('#split-tl').addEventListener('pointerdown', e => {
      const ed = $('#editor'), h0 = $('#timeline').getBoundingClientRect().height; $('#split-tl').classList.add('drag');
      dragPointer(e, (ev, dx, dy) => { const nh = clamp(h0 - dy, 150, innerHeight - 260); ed.style.setProperty('--tlh', nh + 'px'); this.fitPreview(); }, () => { $('#split-tl').classList.remove('drag'); try { localStorage.setItem('ps-tlh', getComputedStyle(ed).getPropertyValue('--tlh')); } catch { } Arrumacoes?.changed(); });
    });
    try { const v = localStorage.getItem('ps-tlh'); if (v) $('#editor').style.setProperty('--tlh', v); } catch { }
    new ResizeObserver(() => this.fitPreview()).observe($('#pv-stage'));
    // soltar arquivos do computador na prévia
    const st = $('#pv-stage');
    st.addEventListener('dragover', e => { e.preventDefault(); st.classList.add('drop'); });
    st.addEventListener('dragleave', () => st.classList.remove('drop'));
    st.addEventListener('drop', e => { e.preventDefault(); e._handled = true; st.classList.remove('drop'); LibUI.handleDropOnPreview(e); });
    window.addEventListener('beforeunload', () => { if (this.project && this.dirty) this.save(true); }); // salva sozinho (sem a janela do navegador)
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.project && this.dirty) this.save(true); });
    this.initMenus(); this.initKeys(); this.initPreview(); if (typeof EdDraw !== 'undefined') EdDraw.mount(); if (typeof Cena !== 'undefined') Cena.init();
    this.tick();
  },
};
