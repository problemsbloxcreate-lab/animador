/* ===================== anim/studio.js — Estúdio de Animação (estilo Toon Boom Harmony) =====================
   Núcleo: projeto, palco (zoom/pan/câmera), ossos clicáveis, ferramentas, keyframes, desfazer, tocar com som, salvar.
   Painéis, menus, importação e exportação ficam em anim/studioui.js.
   SEGURANÇA: o estúdio só abre depois do login com Google confirmado pelo servidor (TurmaAuth.gate). Não remova — veja SEGURANCA.md. */
'use strict';

const FACE_ROLES = ['olho', 'boca', 'sobrancelha', 'nariz'];
const Studio = {
  P: null, f: 0, playing: false, selRig: null, selNode: null, selCam: false,
  onion: false, onionN: 2, clip: null, mode: 'animar', tool: 'auto', viewMode: 'camera', _cursor: null, smart: true, showBones: true,
  embed: new URLSearchParams(location.search).get('embed') === '1',
  view: { z: 1, x: 0, y: 0, fit: true }, hist: [], hi: -1, dirty: false, ready: false,

  /* ---------- projeto ---------- */
  newProject(o = {}) {
    const fps = +o.fps || 24;
    return { id: uid('p_'), kind: 'anim', name: o.name || 'Minha animação', created: Date.now(), modified: Date.now(), version: 1,
      settings: { w: +o.w || 1920, h: +o.h || 1080, fps, bg: o.bg || '#9fd3c7' }, frames: Math.round(fps * (o.sec || 6)),
      audio: [], rigs: [], camera: { keys: {} }, bgAsset: null, roteiro: '', pedidosImagem: [] };
  },
  fix(P) {
    P.kind = 'anim'; P.settings ||= { w: 1920, h: 1080, fps: 24, bg: '#9fd3c7' }; P.frames ||= P.settings.fps * 6; P.audio ||= []; P.rigs ||= []; P.camera ||= { keys: {} }; P.camera.keys ||= {};
    for (const r of P.rigs) { r.keys ||= {}; r.poses ||= {}; r.stage ||= { X: 0, Y: 0, S: 1, F: 1, O: 100 }; for (const n of r.nodes) { n.drawings ||= []; n.side ??= Roles.side(n.name); } }
    return P;
  },
  // MODO CLIPE: edita o boneco de um clipe do editor (mesmo projeto, mesmas mídias) e salva de volta nele
  async openClip(edId, clipId) {
    const rec = await DB.get('projects', edId); if (!rec) return UI.toast('Projeto do editor não encontrado', { kind: 'err' });
    const E = JSON.parse(rec.data), c = E.clips.find(x => x.id === clipId); if (!c || c.type !== 'anim') return UI.toast('Esse clipe não tem boneco', { kind: 'err' });
    const A = c.anim.P || E.animLib?.[c.anim.lib]; if (!A) return;
    const fps = A.settings.fps, audio = [];
    for (const ac of E.clips.filter(x => (x.type === 'audio' || x.type === 'video') && !x.muted && x.assetId && !String(x.assetId).startsWith('snd:') && !x.duck && !/efeito|sfx|m[uú]sica/i.test(E.tracks.find(t => t.id === x.trackId)?.name || '') && x.start < c.start + c.dur && x.start + x.dur > c.start))
      audio.push({ asset: ac.assetId, start: Math.round(((ac.start - c.start) * (c.speed || 1) + (c.offset || 0)) * fps), offset: ac.offset || 0, vol: ac.volume ?? 100, kind: /m[uú]sica|music/i.test(ac.name || '') ? 'musica' : 'voz', muted: false });
    const P = this.fix({ id: E.id, kind: 'anim', name: (c.name || 'Personagem') + ' — ossos', created: E.created, modified: Date.now(), settings: { ...A.settings, bg: A.settings.bg && A.settings.bg !== '#000000' ? A.settings.bg : '#9fd3c7' }, frames: A.frames, audio, rigs: A.rigs, camera: A.camera || { keys: {} }, bgAsset: null, roteiro: E.script || '' });
    this.clipMode = { edId, clipId }; this.ctx = { E, c }; this.viewMode = 'video';
    await this.open({ data: JSON.stringify(P) });
    const t0 = parseFloat(new URLSearchParams(location.search).get('t'));
    if (isFinite(t0)) { this.f = clamp(Math.floor(((t0 - c.start) * (c.speed || 1) + (c.offset || 0)) * fps + 1e-6), 0, Math.max(0, P.frames - 1)); this.fitView(); this.render(); StudioUI.refresh(); } history.replaceState(null, '', `animar.html?ed=${encodeURIComponent(edId)}&c=${encodeURIComponent(clipId)}`);
    StudioUI.clipBar(); StudioUI.tools(); this.fitView();
  },
  /* ---------- NO VÍDEO: o boneco no MESMO lugar e tamanho do vídeo do editor, com o resto do vídeo atrás ---------- */
  inVideo() { return !!(this.ctx && this.viewMode === 'video'); },
  timeOf(f) { const c = this.ctx.c; return c.start + (f / this.P.settings.fps - (c.offset || 0)) / (c.speed || 1); },
  clipM(f) { // espaço do boneco → espaço do vídeo do editor (posição, tamanho, giro e animações do clipe)
    const { E, c } = this.ctx, t = clamp(this.timeOf(f), c.start, c.start + c.dur - 1e-3), g = Renderer.geom(E, c, t), b = g.box;
    return g.m.translate(b.x, b.y).scale(b.w / this.P.settings.w, b.h / this.P.settings.h);
  },
  frameSize() { return this.inVideo() ? this.ctx.E.settings : this.P.settings; },
  // fundo: o vídeo do editor nesse instante, sem o próprio boneco e sem efeitos de câmera (eles aparecem na Prévia)
  bgFrame(f) {
    const B = this._bg ||= { cv: document.createElement('canvas'), f: null, busy: false };
    if (B.f !== f && !B.busy) {
      const { E, c } = this.ctx, E2 = { ...E, clips: E.clips.filter(x => x.id !== c.id && x.parent !== c.id), tracks: E.tracks.map(t => t.type === 'fx' ? { ...t, hidden: true } : t) }, t = this.timeOf(f);
      const q = clamp(this.view.z * (devicePixelRatio || 1), .2, 1);
      B.busy = true;
      Renderer.prepare(E2, t).then(() => { try { Renderer.render(B.cv, E2, t, { q: Math.min(1, q), noSync: true }); B.f = f; } catch (e) { console.warn(e); } }).finally(() => { B.busy = false; this.render(); });
    }
    return B.f === null ? null : B.cv;
  },
  async open(rec) {
    const P = this.fix(typeof rec.data === 'string' ? JSON.parse(rec.data) : rec);
    Assets.unloadAll();
    const b = UI.busy('Abrindo…', '<div class="spinner"></div><p style="text-align:center">Carregando desenhos e áudios…</p>');
    try { await Assets.loadProjectAssets(P.id); } finally { b.close(); }
    this.P = P; this.f = 0; this.selRig = P.rigs[0] || null; this.selNode = null; this.selCam = false;
    this.hist = [this.snap()]; this.hi = 0; this.dirty = false; this.view.fit = true;
    for (const r of P.rigs) for (const n of r.nodes) if (!n.tip) n.tip = Rig.computeTip(n);
    try { localStorage.setItem('an-last', P.id); } catch { }
    if (!this.clipMode) history.replaceState(null, '', 'animar.html?p=' + encodeURIComponent(P.id));
    StudioUI.refresh(); this.fitView(); this.render();
  },
  async save(quiet) {
    const P = this.P; if (!P) return; P.modified = Date.now();
    if (this.clipMode) { // salva dentro do clipe do projeto do editor
      const rec = await DB.get('projects', this.clipMode.edId); if (!rec) return; const E = JSON.parse(rec.data), c = E.clips.find(x => x.id === this.clipMode.clipId); if (!c) return UI.toast('O clipe não existe mais no editor', { kind: 'err' });
      const A = { settings: { ...P.settings, bg: '#000000' }, frames: P.frames, rigs: P.rigs, camera: P.camera, rev: Date.now() };
      if (c.anim.P) c.anim.P = A; else if (E.animLib?.[c.anim.lib]) E.animLib[c.anim.lib] = A; c.anim.rev = (c.anim.rev || 0) + 1;
      E.modified = Date.now(); rec.data = JSON.stringify(E); rec.modified = E.modified; await DB.put('projects', rec);
      this.dirty = false; StudioUI.saveState(); if (!quiet) UI.toast('Salvo no projeto do editor', { kind: 'ok', time: 1400 }); return;
    }
    let thumb = null; try { thumb = this.thumb(); } catch { }
    await DB.put('projects', { id: P.id, kind: 'anim', name: P.name, created: P.created, modified: P.modified, settings: P.settings, dur: P.frames / P.settings.fps, thumb, data: JSON.stringify(P) });
    this.dirty = false; StudioUI.saveState(); if (!quiet) UI.toast('Salvo', { kind: 'ok', time: 1200 });
  },
  saveSoon: debounce(() => Studio.save(true), 1500),
  thumb() { const c = document.createElement('canvas'), k = 240 / Math.max(this.P.settings.w, this.P.settings.h); c.width = Math.round(this.P.settings.w * k); c.height = Math.round(this.P.settings.h * k); this.renderFrame(c.getContext('2d'), this.f, { q: k }); return c.toDataURL('image/jpeg', .7); },

  /* ---------- desfazer ---------- */
  snap() { return JSON.stringify(this.P); },
  commit(label) {
    if (!this.P) return; const s = this.snap(); if (this.hist[this.hi] === s) { this.render(); StudioUI.refresh(); return; }
    this.hist = this.hist.slice(0, this.hi + 1); this.hist.push(s); if (this.hist.length > 120) this.hist.shift(); this.hi = this.hist.length - 1;
    this.lastLabel = label; this.dirty = true; StudioUI.saveState(); this.saveSoon();
    StudioUI.refresh(); this.render();
  },
  restore() {
    const sr = this.selRig?.id, sn = this.selNode?.id; this.P = this.fix(JSON.parse(this.hist[this.hi]));
    this.selRig = this.P.rigs.find(r => r.id === sr) || this.P.rigs[0] || null; this.selNode = this.selRig?.nodes.find(n => n.id === sn) || null;
    this.dirty = true; this.saveSoon(); StudioUI.refresh(); this.render();
  },
  undo() { if (this.hi <= 0) return UI.toast('Nada para desfazer', { kind: 'warn', time: 1200 }); this.hi--; this.restore(); UI.toast('Desfeito', { time: 1000 }); },
  redo() { if (this.hi >= this.hist.length - 1) return UI.toast('Nada para refazer', { kind: 'warn', time: 1200 }); this.hi++; this.restore(); UI.toast('Refeito', { time: 1000 }); },

  /* ---------- tempo ---------- */
  seek(f) { this.f = clamp(Math.round(f), 0, Math.max(0, this.P.frames - 1)); if (this.playing) this.startAudio(); this.render(); StudioUI.refreshProps(); },
  togglePlay() { this.playing ? this.stop() : this.play(); },
  play() {
    if (!this.P) return; if (this.f >= this.P.frames - 1) this.f = 0;
    this.playing = true; this.startAudio();
    const loop = () => {
      if (!this.playing) return;
      const ctx = Assets.ctx(), f = this._f0 + (ctx.currentTime - this._t0) * this.P.settings.fps;
      if (f >= this.P.frames) { this.f = 0; this.startAudio(); } else this.f = Math.floor(f);
      this.render(); requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop); AnTL.draw();
  },
  stop() { this.playing = false; this.stopAudio(); this.render(); StudioUI.refreshProps(); },
  startAudio() {
    this.stopAudio(); const ctx = Assets.ctx(); try { ctx.resume(); } catch { }
    this._t0 = ctx.currentTime + .03; this._f0 = this.f; this._src = [];
    const fps = this.P.settings.fps, t = this.f / fps;
    for (const a of this.P.audio) {
      if (a.muted) continue; const buf = Assets.audioBuffer(a.asset, ctx); if (!buf) continue;
      const st = a.start / fps, off = (a.offset || 0) + Math.max(0, t - st), when = this._t0 + Math.max(0, st - t); if (off >= buf.duration) continue;
      const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; g.gain.value = (a.vol ?? 100) / 100; s.connect(g).connect(ctx.destination); s.start(when, off); this._src.push(s);
    }
  },
  stopAudio() { for (const s of this._src || []) try { s.stop(); } catch { } this._src = []; },
  jumpKey(dir) {
    const fs = this.selNode ? Rig.keyFrames(this.selRig, this.selNode.id) : this.selRig ? Rig.allKeyFrames(this.selRig) : [];
    const t = dir > 0 ? fs.find(x => x > this.f) : [...fs].reverse().find(x => x < this.f); if (t !== undefined) this.seek(t);
  },

  /* ---------- seleção ---------- */
  select(row) {
    if (!row) { this.selNode = null; this.selCam = false; }
    else if (row.t === 'node') { this.selRig = row.rig; this.selNode = row.n; this.selCam = false; }
    else if (row.t === 'stage') { this.selRig = row.rig; this.selNode = null; this.selCam = false; }
    else if (row.t === 'cam') { this.selCam = true; this.selNode = null; }
    this.render(); StudioUI.refreshProps(); StudioUI.refreshLeft();
  },
  selectNode(rig, n) { this.select(n ? { t: 'node', rig, n } : rig ? { t: 'stage', rig } : null); },

  /* ---------- keyframes ---------- */
  chanTarget() { return this.selCam ? { keys: this.P.camera.keys, chans: ['X', 'Y', 'Z', 'R'], def: { X: 0, Y: 0, Z: 1, R: 0 } } : this.selNode ? { rig: this.selRig, id: this.selNode.id, chans: ['r', 'x', 'y', 'sx', 'sy', 'd'] } : this.selRig ? { rig: this.selRig, id: '@', chans: ['X', 'Y', 'S', 'F', 'O'] } : null; },
  keyHere() {
    const T = this.chanTarget(); if (!T) return UI.toast('Selecione uma parte, um personagem ou a câmera.', { kind: 'warn' });
    const f = this.f;
    if (this.selCam) { for (const c of T.chans) AnimMath.setKey(T.keys[c] ||= [], f, this.camAt(f)[c], 'ease'); }
    else if (T.id === '@') { const s = Rig.stageAt(T.rig, f); for (const c of T.chans) Rig.setKey(T.rig, '@', c, f, s[c], c === 'F' ? 'hold' : 'ease'); }
    else { const n = this.selNode; Rig.setKey(T.rig, n.id, 'r', f, round(Rig.ch(T.rig, n.id, 'r', f, 0), 2)); if (n.drawings.length > 1) Rig.setKey(T.rig, n.id, 'd', f, Math.round(Rig.ch(T.rig, n.id, 'd', f, n.d || 0)), 'hold'); }
    this.commit('Keyframe criado');
  },
  keyAllHere() { const rig = this.selRig; if (!rig) return; Rig.applyPose(rig, Rig.capture(rig, this.f), this.f); this.commit('Pose inteira marcada (keyframe em todas as partes)'); },
  deleteKeys() {
    const sel = [...AnTL.selKeys]; let n = 0;
    const del = (chs, f) => { if (!chs) return; for (const [c, ks] of Object.entries(chs)) { const i = ks.findIndex(k => k.f === f); if (i >= 0) { ks.splice(i, 1); n++; } if (!ks.length) delete chs[c]; } };
    if (sel.length) for (const k of sel) { const i = k.lastIndexOf(':'); del(AnTL.channelsFor(k.slice(0, i)), +k.slice(i + 1)); }
    else { const T = this.chanTarget(); if (!T) return; del(this.selCam ? this.P.camera.keys : T.rig.keys[T.id], this.f); }
    AnTL.selKeys.clear(); if (n) this.commit('Keyframe(s) apagado(s)'); else UI.toast('Não há keyframe aqui.', { kind: 'warn', time: 1400 });
  },
  setEase(e) {
    const sel = AnTL.selKeys.size ? [...AnTL.selKeys] : (() => { const T = this.chanTarget(); return T ? [(this.selCam ? 'cam' : T.id === '@' ? '@' + T.rig.id : T.id) + ':' + this.f] : []; })();
    let n = 0;
    for (const k of sel) { const i = k.lastIndexOf(':'), chs = AnTL.channelsFor(k.slice(0, i)), f = +k.slice(i + 1); for (const [c, ks] of Object.entries(chs || {})) { if (c === 'd' || c === 'v' || c === 'm') continue; const kk = ks.find(x => x.f === f) || [...ks].reverse().find(x => x.f < f); if (kk) { kk.e = e; n++; } } }
    if (n) this.commit('Curva: ' + EASE_LABEL[e]);
  },
  copyPose() { const rig = this.selRig; if (!rig) return; this.clip = { rig: rig.id, data: Rig.capture(rig, this.f, this.selNode ? [this.selNode.id, ...this.descendants(rig, this.selNode).map(n => n.id)] : null) }; UI.toast(this.selNode ? `Pose de "${esc(this.selNode.name)}" copiada` : 'Pose copiada', { time: 1200 }); },
  pastePose() { const rig = this.selRig; if (!rig || !this.clip) return; Rig.applyPose(rig, this.clip.data, this.f); this.commit('Pose colada'); },
  async savePose() {
    const rig = this.selRig; if (!rig) return; const n = await UI.prompt({ title: 'Salvar pose na biblioteca', label: 'Nome da pose (ex.: explicando, braços abertos, triste)', value: 'pose ' + (Object.keys(rig.poses).length + 1) }); if (!n) return;
    rig.poses[n] = { data: Rig.capture(rig, this.f), thumb: this.poseThumb(rig) }; this.commit(`Pose "${n}" salva`);
  },
  poseThumb(rig) { const c = document.createElement('canvas'); c.width = 90; c.height = 90; const g = c.getContext('2d'), W = this.P.settings.w, H = this.P.settings.h, st = Rig.stageAt(rig, this.f); const s = 80 / (rig.h * st.S || 1); const base = new DOMMatrix().translateSelf(45, 86).scaleSelf(s, s).translateSelf(-(W / 2 + st.X), -(H / 2 + st.Y)); Rig.draw(g, rig, this.f, W, H, { base }); return c.toDataURL('image/png'); },
  applyPose(rig, name, smooth = true) { const p = rig.poses[name]; if (!p) return; if (smooth) { Acting.poseTo(rig, p.data, this.f, { trans: 5, ant: .15, lag: { tronco: 1, braco: 1, antebraco: 2, mao: 2 } }); } else Rig.applyPose(rig, p.data, this.f); this.commit(`Pose "${name}"`); },
  insertFrames(at, n) {
    const shift = chs => { for (const ks of Object.values(chs || {})) { if (n < 0) for (let i = ks.length - 1; i >= 0; i--) if (ks[i].f === at) ks.splice(i, 1); for (const k of ks) if (k.f > at || (n > 0 && k.f === at)) k.f += n; } };
    for (const r of this.P.rigs) for (const id of Object.keys(r.keys)) shift(r.keys[id]);
    shift(this.P.camera.keys); this.P.frames = Math.max(1, this.P.frames + n); this.commit(n > 0 ? 'Quadro inserido' : 'Quadro removido');
  },
  descendants(rig, n) { const out = []; const walk = id => Rig.children(rig, id).forEach(c => { out.push(c); walk(c.id); }); walk(n.id); return out; },

  /* ---------- câmera ---------- */
  camAt(f) { const k = this.P.camera.keys; return { X: AnimMath.value(k.X, f, 0), Y: AnimMath.value(k.Y, f, 0), Z: AnimMath.value(k.Z, f, 1), R: AnimMath.value(k.R, f, 0) }; },
  camMatrix(f) { const W = this.P.settings.w, H = this.P.settings.h, c = this.camAt(f); return new DOMMatrix().translateSelf(W / 2, H / 2).scaleSelf(c.Z, c.Z).rotateSelf(c.R).translateSelf(-W / 2 - c.X, -H / 2 - c.Y); },

  /* ---------- desenhar ---------- */
  renderFrame(g, f, o = {}) {
    const P = this.P, W = P.settings.w, H = P.settings.h, q = o.q || 1;
    const cam = ff => { const m = o.noCam ? new DOMMatrix() : this.camMatrix(ff); return o.pre ? o.pre(ff).multiply(m) : m; };
    const base = (o.view || new DOMMatrix().scaleSelf(q, q)).multiply(cam(f));
    g.save(); g.setTransform(o.view || new DOMMatrix().scaleSelf(q, q));
    if (!o.transparent) { g.fillStyle = P.settings.bg || '#000'; g.fillRect(0, 0, W, H); }
    g.restore();
    if (P.bgAsset && !o.transparent) { const rt = Assets.get(P.bgAsset); if (rt?.img) { g.save(); g.setTransform(base); const iw = rt.img.naturalWidth, ih = rt.img.naturalHeight, s = Math.max(W / iw, H / ih); g.drawImage(rt.img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s); g.restore(); } }
    const onion = (after) => {
      if (!o.onion) return;
      // papel-cebola: anteriores em vermelho, seguintes em verde. Desenhando: só a parte selecionada, no passo do quadro a quadro,
      // e só quando o quadro vizinho é diferente (senão o boneco inteiro ficaria colorido)
      const drawing = typeof Desenho !== 'undefined' && Desenho.isTool(this.tool), step = drawing ? Math.max(1, Desenho.opt.passo | 0) : 1, only = drawing ? this.selNode : null, rig = this.selRig; if (after !== drawing) return;
      const same = ff => only && rig && Rig.drawingAt(rig, only, ff) === Rig.drawingAt(rig, only, f) && ['r', 'x', 'y', 'sx', 'sy'].every(c => Rig.ch(rig, only.id, c, ff, 0) === Rig.ch(rig, only.id, c, f, 0));
      for (let k = this.onionN; k >= 1; k--) for (const [df, col, al] of [[-k * step, '#ff4d6a', (drawing ? .55 : .3) / k], [k * step, '#2fcf7a', (drawing ? .45 : .25) / k]]) { const ff = f + df; if (ff < 0 || ff >= P.frames || same(ff)) continue; Desenho.onion(g, (o.view || new DOMMatrix()).multiply(cam(ff)), f, W, H, only, ff, col, al); }
    };
    onion(false);
    for (const rig of P.rigs) Rig.draw(g, rig, f, W, H, { base });
    onion(true);
    g.setTransform(1, 0, 0, 1, 0, 0);
  },
  // matriz da tela: projeto → pixels do canvas do palco
  viewMatrix() { const d = devicePixelRatio || 1, v = this.view; return new DOMMatrix().scaleSelf(d, d).translateSelf(v.x, v.y).scaleSelf(v.z, v.z); },
  fitView() {
    const st = $('#an-stage'); if (!st || !this.P) return; const W = st.clientWidth, H = st.clientHeight, P = this.frameSize();
    const z = Math.max(.02, Math.min((W - 50) / P.w, (H - 50) / P.h)); this.view = { z, x: (W - P.w * z) / 2, y: (H - P.h * z) / 2, fit: true }; StudioUI.zoomLabel(); this.render();
  },
  zoomAt(k, cx, cy) { const v = this.view, z = clamp(v.z * k, .02, 16); v.x = cx - (cx - v.x) * (z / v.z); v.y = cy - (cy - v.y) * (z / v.z); v.z = z; v.fit = false; StudioUI.zoomLabel(); this.render(); },
  render() { if (this._raf) return; this._raf = requestAnimationFrame(() => { this._raf = 0; this.draw(); }); },
  draw() {
    const cv = $('#an-canvas'), st = $('#an-stage'); if (!cv || !this.P) return;
    const d = devicePixelRatio || 1, W = st.clientWidth, H = st.clientHeight;
    if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); if (this.view.fit) { this.fitView(); return; } }
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    const V = this.viewMatrix(), P = this.frameSize(), vid = this.inVideo();
    g.save(); g.setTransform(V); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 30; g.fillStyle = '#000'; g.fillRect(0, 0, P.w, P.h); g.restore();
    Rig.REST = this.mode === 'montar';
    const cena = this.viewMode === 'cena';
    if (vid) { const bg = this.bgFrame(this.f); g.save(); g.setTransform(V); if (bg) g.drawImage(bg, 0, 0, P.w, P.h); else { g.fillStyle = this.ctx.E.settings.bg || '#000'; g.fillRect(0, 0, P.w, P.h); } g.restore(); }
    this.renderFrame(g, this.f, { view: V, noCam: cena, transparent: vid, pre: vid ? ff => this.clipM(ff) : null, onion: this.onion && !this.playing && this.mode === 'animar' });
    if (cena) Desenho.drawCameraFrame(g);
    else { // fora do quadro da câmera: escurece (como o "camera frame" do Harmony)
      g.save(); g.setTransform(V); g.fillStyle = this.soCam ? getComputedStyle($('#an-stage')).backgroundColor : document.documentElement.dataset.tema === 'escuro' ? 'rgba(8,9,12,.55)' : 'rgba(0,0,0,.22)'; g.beginPath(); g.rect(-1e5, -1e5, 2e5, 2e5); g.rect(0, 0, P.w, P.h); g.fill('evenodd'); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1 / this.view.z; g.strokeRect(0, 0, P.w, P.h); g.restore();
    }
    if (!this.playing) this.drawOverlay(g, V);
    Rig.REST = false;
    // cursor do pincel (círculo do tamanho real)
    if (this._cursor && Desenho.isTool(this.tool) && this.tool !== 'balde' && this.tool !== 'conta') { const c = this._cursor, r = Math.max(1, Desenho.opt.size * d / 2); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.lineWidth = 1 * d; g.strokeStyle = 'rgba(0,0,0,.7)'; g.beginPath(); g.arc(c.x, c.y, r + d, 0, 7); g.stroke(); g.strokeStyle = this.tool === 'borracha' ? '#fff' : Desenho.opt.color; g.beginPath(); g.arc(c.x, c.y, r, 0, 7); g.stroke(); g.restore(); }
    AnTL.draw(); StudioUI.statusBar?.();
    if (!this.playing || (this._pv = (this._pv || 0) + 1) % 4 === 0) Desenho.drawPreview();
  },
  baseMatrix(f = this.f) { return this.viewMode === 'cena' ? this.viewMatrix() : this.inVideo() ? this.viewMatrix().multiply(this.clipM(f)).multiply(this.camMatrix(f)) : this.viewMatrix().multiply(this.camMatrix(f)); },
  drawOverlay(g, V) {
    const P = this.P, W = P.settings.w, H = P.settings.h, d = devicePixelRatio || 1, base = this.baseMatrix();
    for (const rig of P.rigs) {
      const selR = rig === this.selRig; if (!this.showBones && !selR) continue;
      const J = Rig.joints(rig, this.f, W, H, base), M = Rig.pose(rig, this.f), S = base.multiply(Rig.stageMatrix(rig, this.f, W, H));
      // contorno da parte selecionada
      if (selR && this.selNode && J[this.selNode.id]) {
        const n = this.selNode, dr = Rig.drawingAt(rig, n, this.f), rt = dr?.asset && Assets.get(dr.asset);
        if (rt?.img) { const m = S.multiply(M[n.id]), w = dr.w ?? rt.img.naturalWidth, hh = dr.h ?? rt.img.naturalHeight, bb = this.alphaOf(dr.asset)?.bb || [0, 0, 1, 1], X0 = dr.ox + bb[0] * w, Y0 = dr.oy + bb[1] * hh, X1 = dr.ox + bb[2] * w, Y1 = dr.oy + bb[3] * hh; const pts = [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]].map(([x, y]) => m.transformPoint(new DOMPoint(x, y))); g.save(); g.setLineDash([5 * d, 4 * d]); g.strokeStyle = '#ffd23d'; g.lineWidth = 1.2 * d; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.stroke(); g.restore(); }
      }
      if (!this.showBones) continue;
      g.save();
      for (const n of rig.nodes) {
        const j = J[n.id]; if (!j || !Rig.visible(rig, n, this.f)) continue;
        const kids = Rig.children(rig, n.id).filter(c => J[c.id]);
        const ends = kids.length ? kids.map(c => J[c.id]) : j.tip && !n.layer ? [j.tip] : [];
        const sel = selR && this.selNode === n, col = sel ? '#ffd23d' : FACE_ROLES.includes(n.role) ? 'rgba(127,209,255,.85)' : n.follow ? 'rgba(210,155,255,.85)' : selR ? 'rgba(255,140,90,.9)' : 'rgba(255,140,90,.4)';
        for (const e of ends) { // osso: losango afinando (como no Harmony)
          const dx = e.x - j.x, dy = e.y - j.y, L = Math.hypot(dx, dy); if (L < 3 * d) continue; const w = Math.min(9 * d, L * .14), ux = dx / L, uy = dy / L, mx = j.x + dx * .18, my = j.y + dy * .18;
          g.beginPath(); g.moveTo(j.x, j.y); g.lineTo(mx - uy * w, my + ux * w); g.lineTo(e.x, e.y); g.lineTo(mx + uy * w, my - ux * w); g.closePath(); g.fillStyle = col.replace(/[\d.]+\)$/, m => (parseFloat(m) * .35) + ')').replace('#ffd23d', 'rgba(255,210,61,.35)'); g.fill(); g.strokeStyle = col; g.lineWidth = 1.2 * d; g.stroke();
        }
        g.beginPath(); const ik = Roles.ikChain(rig, n);
        if (ik) g.rect(j.x - 5 * d, j.y - 5 * d, 10 * d, 10 * d); else g.arc(j.x, j.y, (sel ? 6 : 4.5) * d, 0, Math.PI * 2);
        g.fillStyle = sel ? '#ffd23d' : '#15161a'; g.fill(); g.strokeStyle = col; g.lineWidth = 2 * d; g.stroke();
      }
      // pivô em modo montar
      if (this.mode === 'montar' && selR && this.selNode && J[this.selNode.id]) { const j = J[this.selNode.id]; g.strokeStyle = '#ff4d6a'; g.lineWidth = 2 * d; g.beginPath(); g.arc(j.x, j.y, 10 * d, 0, Math.PI * 2); g.moveTo(j.x - 16 * d, j.y); g.lineTo(j.x + 16 * d, j.y); g.moveTo(j.x, j.y - 16 * d); g.lineTo(j.x, j.y + 16 * d); g.stroke(); }
      g.restore();
    }
    // alvo da IK / pose inteligente
    if (this._drag?.target) { const t = this._drag.target; g.save(); g.strokeStyle = '#19d3f0'; g.lineWidth = 2 * d; g.beginPath(); g.arc(t.x, t.y, 9 * d, 0, Math.PI * 2); g.stroke(); g.restore(); }
  },

  /* ---------- clicar nas partes ---------- */
  alpha: new Map(),
  alphaOf(asset) {
    if (this.alpha.has(asset)) return this.alpha.get(asset);
    const rt = Assets.get(asset); if (!rt?.img) return null;
    const W = rt.img.naturalWidth, H = rt.img.naturalHeight, k = Math.min(1, 512 / Math.max(W, H)), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(rt.img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h); let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let i = 0; i < w * h; i++) { a[i] = d[i * 4 + 3]; if (a[i] > 40) { const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    const o = { w, h, k, a, W, H, bb: x1 < 0 ? [0, 0, 1, 1] : [x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h] }; this.alpha.set(asset, o); return o;
  },
  hitDrawing(rig, n, sx, sy, M, S) {
    const dr = Rig.drawingAt(rig, n, this.f); if (!dr?.asset) return false; const A = this.alphaOf(dr.asset); if (!A) return false;
    const m = S.multiply(M[n.id]).inverse(), p = m.transformPoint(new DOMPoint(sx, sy)); const w = dr.w ?? A.W, hh = dr.h ?? A.H;
    const u = (p.x - dr.ox) / w, v = (p.y - dr.oy) / hh; if (u < 0 || v < 0 || u >= 1 || v >= 1) return false;
    return A.a[Math.floor(v * A.h) * A.w + Math.floor(u * A.w)] > 60;
  },
  hit(sx, sy) {
    const P = this.P, W = P.settings.w, H = P.settings.h, d = devicePixelRatio || 1, base = this.baseMatrix();
    Rig.REST = this.mode === 'montar';
    try {
      const rigs = this.selRig ? [this.selRig, ...P.rigs.filter(r => r !== this.selRig)] : [...P.rigs];
      if (this.showBones) for (const rig of rigs) { const J = Rig.joints(rig, this.f, W, H, base); let best = null, bd = 10 * d; for (const n of rig.nodes) { const j = J[n.id]; if (!j || !Rig.visible(rig, n, this.f)) continue; const dd = Math.hypot(j.x - sx, j.y - sy); if (dd < bd) { bd = dd; best = n; } } if (best) return { rig, n: best, joint: true }; }
      for (const rig of [...P.rigs].reverse()) {
        const M = Rig.pose(rig, this.f), S = base.multiply(Rig.stageMatrix(rig, this.f, W, H));
        for (const n of [...rig.nodes].sort((a, b) => b.z - a.z)) { if (!M[n.id] || !Rig.visible(rig, n, this.f)) continue; if (this.hitDrawing(rig, n, sx, sy, M, S)) return { rig, n }; }
      }
      return null;
    } finally { Rig.REST = false; }
  },
  toProject(sx, sy) { return this.baseMatrix().inverse().transformPoint(new DOMPoint(sx, sy)); },  // tela → espaço do palco (antes da câmera)

  /* ---------- arrastar no palco ---------- */
  pointer(e) {
    const cv = $('#an-canvas'), b = cv.getBoundingClientRect(), d = devicePixelRatio || 1;
    return { x: (e.clientX - b.left) * d, y: (e.clientY - b.top) * d, cx: e.clientX - b.left, cy: e.clientY - b.top };
  },
  initStage() {
    const cv = $('#an-canvas'), st = $('#an-stage');
    new ResizeObserver(() => { if (this.view.fit) this.fitView(); else this.render(); }).observe(st);
    cv.addEventListener('wheel', e => { e.preventDefault(); const p = this.pointer(e); if (e.shiftKey) { this.view.x -= e.deltaY || e.deltaX; this.view.fit = false; this.render(); } else this.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.cx, p.cy); }, { passive: false });
    cv.addEventListener('contextmenu', e => { e.preventDefault(); const p = this.pointer(e), H = this.P && this.hit(p.x, p.y); if (H) this.selectNode(H.rig, H.n); StudioUI.stageMenu(e, H); });
    cv.addEventListener('pointerdown', e => this.down(e));
    cv.addEventListener('pointermove', e => { if (!this.P) return; const p = this.pointer(e); if (Desenho.isTool(this.tool)) { this._cursor = p; this.render(); return; } if (this._drag) return; const H = this.hit(p.x, p.y); StudioUI.hoverHint(H); });
    cv.addEventListener('pointerleave', () => { if (this._cursor) { this._cursor = null; this.render(); } });
    cv.addEventListener('dblclick', e => { if (!this.P) return; const p = this.pointer(e), H = this.hit(p.x, p.y); if (H && this.mode === 'animar') { this.selectNode(H.rig, H.n); this.keyHere(); } });
  },
  down(e) {
    if (!this.P) return; if (this.playing) this.stop();
    const p = this.pointer(e), cv = $('#an-canvas');
    if (e.button === 1 || e.button === 0 && this.tool === 'mao') { // arrastar a vista
      e.preventDefault(); const x0 = this.view.x, y0 = this.view.y; $('#an-stage').classList.add('panning');
      dragPointer(e, (ev, dx, dy) => { this.view.x = x0 + dx; this.view.y = y0 + dy; this.view.fit = false; this.render(); }, () => $('#an-stage').classList.remove('panning')); return;
    }
    if (e.button !== 0) return;
    if (Desenho.isTool(this.tool)) { e.preventDefault(); cv.setPointerCapture?.(e.pointerId); return Desenho.down(e, p); }
    if (this.tool === 'camera') { e.preventDefault(); this.selCam = true; return Desenho.dragCamera(e); }
    const H = this.hit(p.x, p.y);
    if (!H) { if (this.tool === 'mover' && this.selRig) return this.dragStage(e, this.selRig); this.select(null); return; }
    this.selectNode(H.rig, H.n);
    const rig = H.rig, n = H.n;
    if (this.mode === 'montar') return this.dragRigging(e, rig, n, H.joint);
    let act = this.tool;
    if (act === 'auto') {
      const multi = n.drawings.filter(x => x.asset).length > 1 && !['boca', 'olho', 'sobrancelha'].includes(n.role);
      if (this.smart && multi && !e.altKey) act = 'smart';
      else if (Roles.ikChain(rig, n) && !e.altKey) act = 'ik';
      else if (!n.parent) act = 'mover';
      else if (FACE_ROLES.includes(n.role) || e.shiftKey) act = 'desloca';
      else act = 'girar';
    }
    if (act === 'ik' && !Roles.ikChain(rig, n)) act = 'girar';
    cv.setPointerCapture?.(e.pointerId);
    ({ esticar: () => this.dragStretch(e, rig, n), girar: () => this.dragRotate(e, rig, n), ik: () => this.dragIK(e, rig, n), mover: () => this.dragStage(e, rig), desloca: () => this.dragOffset(e, rig, n), smart: () => this.dragSmart(e, rig, n) })[act]?.();
  },
  endDrag(label) { this._drag = null; this.commit(label); },
  jointOf(rig, n) { const W = this.P.settings.w, H = this.P.settings.h; return Rig.joints(rig, this.f, W, H, this.baseMatrix())[n.id]; },
  dragRotate(e, rig, n) {
    const j = this.jointOf(rig, n); if (!j) return; const p0 = this.pointer(e), a0 = Math.atan2(p0.y - j.y, p0.x - j.x), r0 = Rig.ch(rig, n.id, 'r', this.f, 0), flip = Rig.stageAt(rig, this.f).F < 0 ? -1 : 1;
    this._drag = { t: 'girar' }; let moved = false;
    dragPointer(e, ev => {
      const p = this.pointer(ev); let dd = AnimMath.deg(Math.atan2(p.y - j.y, p.x - j.x) - a0); dd = AnimMath.norm(dd);
      let v = r0 + dd * flip; if (ev.shiftKey) v = Math.round(v / 15) * 15; if (n.limit) v = clamp(v, n.limit[0], n.limit[1]);
      Rig.setKey(rig, n.id, 'r', this.f, round(v, 2)); moved = true; StudioUI.hint(`<b>${esc(n.name)}</b> girando: ${round(v, 1)}°${n.limit ? ` (limite ${n.limit[0]}…${n.limit[1]}°)` : ''} · Shift = de 15 em 15°`); this.render();
    }, () => { StudioUI.hint(''); if (moved) this.endDrag(`Girou ${n.name}`); else this._drag = null; });
  },
  // ESTICAR: puxar ao longo do osso estica (sy); com Shift muda a largura (sx). Bom para cobrir buracos entre as partes.
  dragStretch(e, rig, n) {
    const j = this.jointOf(rig, n); if (!j) return; const p0 = this.pointer(e), sx0 = Rig.ch(rig, n.id, 'sx', this.f, 1), sy0 = Rig.ch(rig, n.id, 'sy', this.f, 1), d0 = Math.max(8, Math.hypot(p0.x - j.x, p0.y - j.y));
    this._drag = { t: 'esticar' }; let moved = false;
    dragPointer(e, ev => { const p = this.pointer(ev), k = clamp(Math.hypot(p.x - j.x, p.y - j.y) / d0, .2, 4);
      if (ev.shiftKey) Rig.setKey(rig, n.id, 'sx', this.f, round(sx0 * k, 3)); else Rig.setKey(rig, n.id, 'sy', this.f, round(sy0 * k, 3));
      moved = true; StudioUI.hint(`<b>Esticar</b> ${esc(n.name)}: comprimento ${Math.round(Rig.ch(rig, n.id, 'sy', this.f, 1) * 100)}% · largura ${Math.round(Rig.ch(rig, n.id, 'sx', this.f, 1) * 100)}% · Shift = largura`); this.render(); },
      () => { StudioUI.hint(''); if (moved) this.endDrag(`Esticou ${n.name}`); else this._drag = null; });
  },
  dragIK(e, rig, n) {
    const chain = Roles.ikChain(rig, n), W = this.P.settings.w, H = this.P.settings.h; this._drag = { t: 'ik' }; let moved = false;
    dragPointer(e, ev => {
      const p = this.pointer(ev), t = this.toProject(p.x, p.y); Rig.solveIK(rig, chain, this.f, { x: t.x, y: t.y }, W, H); moved = true;
      this._drag.target = { x: p.x, y: p.y }; StudioUI.hint(`<b>IK</b>: ${chain.map(c => esc(c.name)).join(' ← ')} — os ossos giram nas juntas, nada estica · Alt = girar só esta parte`); this.render();
    }, () => { StudioUI.hint(''); if (moved) this.endDrag(`Moveu ${n.name} (IK)`); else this._drag = null; this.render(); });
  },
  dragStage(e, rig) {
    const s0 = Rig.stageAt(rig, this.f), p0 = this.pointer(e), q0 = this.toProject(p0.x, p0.y); this._drag = { t: 'stage' }; let moved = false;
    dragPointer(e, ev => { const p = this.pointer(ev), q = this.toProject(p.x, p.y); let X = s0.X + q.x - q0.x, Y = s0.Y + q.y - q0.y; if (ev.shiftKey) { if (Math.abs(q.x - q0.x) > Math.abs(q.y - q0.y)) Y = s0.Y; else X = s0.X; } Rig.setKey(rig, '@', 'X', this.f, round(X, 1)); Rig.setKey(rig, '@', 'Y', this.f, round(Y, 1)); moved = true; this.render(); },
      () => { if (moved) this.endDrag(`Moveu ${rig.name}`); else this._drag = null; });
  },
  dragOffset(e, rig, n) {
    const W = this.P.settings.w, H = this.P.settings.h, M = Rig.pose(rig, this.f), S = this.baseMatrix().multiply(Rig.stageMatrix(rig, this.f, W, H));
    const par = n.parent ? S.multiply(M[n.parent]) : S, inv = par.inverse(), p0 = this.pointer(e), l0 = inv.transformPoint(new DOMPoint(p0.x, p0.y));
    const x0 = Rig.ch(rig, n.id, 'x', this.f, 0), y0 = Rig.ch(rig, n.id, 'y', this.f, 0), lim = FACE_ROLES.includes(n.role) ? 60 : 400; this._drag = { t: 'off' }; let moved = false;
    dragPointer(e, ev => { const p = this.pointer(ev), l = inv.transformPoint(new DOMPoint(p.x, p.y)); Rig.setKey(rig, n.id, 'x', this.f, round(clamp(x0 + l.x - l0.x, -lim, lim), 1)); Rig.setKey(rig, n.id, 'y', this.f, round(clamp(y0 + l.y - l0.y, -lim, lim), 1)); moved = true; this.render(); },
      () => { if (moved) this.endDrag(`Deslocou ${n.name}`); else this._drag = null; });
  },

  /* ---------- POSE INTELIGENTE: ao arrastar, escolhe o desenho mais parecido com o movimento ---------- */
  DIRS: { esq: /esq|left|\(e\)/i, dir: /dir|right|\(d\)/i, lado: /lado|perfil|side|profile/i, tq: /3\/4|tr[eê]s ?quartos|3-4|34|quarter/i, costas: /costas|back|tr[aá]s/i, frente: /frente|front|frontal/i, cima: /cima|up\b|alto/i, baixo: /baixo|down\b/i },
  masksOf(n) {
    // máscaras de todos os desenhos alinhados no espaço da parte (grade 40×40 cobrindo todos)
    const key = n.drawings.map(d => d.asset + d.ox + ',' + d.oy).join('|'); if (n._mk?.key === key) return n._mk;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const ds = n.drawings.map(d => { const A = d.asset && this.alphaOf(d.asset); if (!A) return null; const w = d.w ?? A.W, h = d.h ?? A.H; x0 = Math.min(x0, d.ox); y0 = Math.min(y0, d.oy); x1 = Math.max(x1, d.ox + w); y1 = Math.max(y1, d.oy + h); return { d, A, w, h }; });
    const G = 40, gw = (x1 - x0) / G, gh = (y1 - y0) / G;
    const masks = ds.map(o => { if (!o) return null; const m = new Float32Array(G * G); for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) { const px = x0 + (gx + .5) * gw, py = y0 + (gy + .5) * gh, u = (px - o.d.ox) / o.w, v = (py - o.d.oy) / o.h; if (u >= 0 && v >= 0 && u < 1 && v < 1) m[gy * G + gx] = o.A.a[Math.floor(v * o.A.h) * o.A.w + Math.floor(u * o.A.w)] > 60 ? 1 : 0; } return m; });
    return (n._mk = { key, masks, x0, y0, gw, gh, G });
  },
  smartPick(rig, n, a, b, cur) {
    // a, b = ponto onde pegou / ponto atual (no espaço da parte)
    const names = n.drawings.map(d => d.name || ''), dirNamed = names.filter(s => Object.values(this.DIRS).some(r => r.test(s))).length >= Math.min(3, names.length);
    const dx = b.x - a.x, dy = b.y - a.y, size = Math.max(1, (n._mk?.gw || 10) * 40);
    if (dirNamed) {
      const nx = dx / (size * .45), ny = dy / (size * .45);
      if (Math.hypot(nx, ny) < .22) return cur;
      const want = { esq: nx < -.22, dir: nx > .22, lado: Math.abs(nx) > .8, tq: Math.abs(nx) > .22 && Math.abs(nx) <= .8, cima: ny < -.4, baixo: ny > .4, frente: Math.abs(nx) <= .22 && Math.abs(ny) <= .4 };
      let best = cur, bs = -1;
      names.forEach((s, i) => { if (!n.drawings[i].asset) return; let sc = 0; for (const [k, r] of Object.entries(this.DIRS)) { const has = r.test(s); if (has && want[k]) sc += k === 'esq' || k === 'dir' ? 3 : 2; else if (has && !want[k]) sc -= 2; else if (!has && want[k] && (k === 'esq' || k === 'dir')) sc -= 1; } if (this.DIRS.costas.test(s)) sc -= 3; if (sc > bs) { bs = sc; best = i; } });
      return bs > 0 ? best : cur;
    }
    const K = this.masksOf(n), G = K.G, cell = p => [clamp(Math.floor((p.x - K.x0) / K.gw), 0, G - 1), clamp(Math.floor((p.y - K.y0) / K.gh), 0, G - 1)];
    const dens = (m, p, r = 3) => { const [cx, cy] = cell(p); let s = 0, c = 0; for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) { if (x < 0 || y < 0 || x >= G || y >= G) continue; s += m[y * G + x]; c++; } return c ? s / c : 0; };
    const iou = (m1, m2) => { let i = 0, u = 0; for (let k = 0; k < m1.length; k++) { i += m1[k] * m2[k]; u += Math.max(m1[k], m2[k]); } return u ? i / u : 0; };
    const far = Math.hypot(dx, dy) > K.gw * 4, mc = K.masks[cur];
    let best = cur, bs = -1e9;
    K.masks.forEach((m, i) => { if (!m) return; const s = dens(m, b) - (far ? .55 * dens(m, a) : 0) + (mc ? .3 * iou(m, mc) : 0) + (i === cur ? .06 : 0); if (s > bs) { bs = s; best = i; } });
    return best;
  },
  dragSmart(e, rig, n) {
    const W = this.P.settings.w, H = this.P.settings.h, M = Rig.pose(rig, this.f), S = this.baseMatrix().multiply(Rig.stageMatrix(rig, this.f, W, H)), inv = S.multiply(M[n.id]).inverse();
    const p0 = this.pointer(e), a = inv.transformPoint(new DOMPoint(p0.x, p0.y)), d0 = Math.round(Rig.ch(rig, n.id, 'd', this.f, n.d || 0)); this.masksOf(n);
    this._drag = { t: 'smart' }; let last = d0;
    dragPointer(e, ev => {
      const p = this.pointer(ev), b = inv.transformPoint(new DOMPoint(p.x, p.y)), k = this.smartPick(rig, n, a, b, d0);
      this._drag.target = { x: p.x, y: p.y };
      if (k !== last) { Rig.setKey(rig, n.id, 'd', this.f, k, 'hold'); last = k; }
      StudioUI.hint(`<b>Pose inteligente</b>: ${esc(n.drawings[last]?.name || 'desenho ' + (last + 1))} · solte para marcar · Alt = mover sem trocar desenho (ou desligue no topo)`); this.render();
    }, () => { StudioUI.hint(''); this._drag = null; if (last !== d0) this.commit(`Pose inteligente: ${n.drawings[last]?.name || last + 1}`); else this.render(); });
  },

  /* ---------- MONTAR: pivô e posição das partes ---------- */
  dragRigging(e, rig, n, onJoint) {
    const W = this.P.settings.w, H = this.P.settings.h; Rig.REST = true; const S = this.baseMatrix().multiply(Rig.stageMatrix(rig, this.f, W, H)); Rig.REST = false;
    const inv = S.inverse(), p0 = this.pointer(e), q0 = inv.transformPoint(new DOMPoint(p0.x, p0.y));
    const pivot = this.tool === 'pivo' || (this.tool !== 'parte' && onJoint);
    const kids = this.descendants(rig, n), st0 = { px: n.px, py: n.py, dr: n.drawings.map(d => [d.ox, d.oy]), kids: kids.map(k => [k.px, k.py]) };
    this._drag = { t: 'rig' }; let moved = false;
    dragPointer(e, ev => {
      const p = this.pointer(ev), q = inv.transformPoint(new DOMPoint(p.x, p.y)); let dx = q.x - q0.x, dy = q.y - q0.y;
      if (pivot) { n.px = round(st0.px + dx, 1); n.py = round(st0.py + dy, 1); n.drawings.forEach((d, i) => { d.ox = round(st0.dr[i][0] - dx, 1); d.oy = round(st0.dr[i][1] - dy, 1); }); StudioUI.hint(`<b>Pivô</b> de ${esc(n.name)}: é a junta onde a parte gira (ombro, cotovelo, pescoço…)`); }
      else { n.px = round(st0.px + dx, 1); n.py = round(st0.py + dy, 1); kids.forEach((k, i) => { k.px = round(st0.kids[i][0] + dx, 1); k.py = round(st0.kids[i][1] + dy, 1); }); StudioUI.hint(`<b>Movendo</b> ${esc(n.name)}${kids.length ? ' e as partes presas nela' : ''}`); }
      n._mk = null; moved = true; this.render();
    }, () => { StudioUI.hint(''); if (moved) { n.tip = Rig.computeTip(n); this.endDrag(pivot ? `Pivô de ${n.name}` : `Moveu ${n.name}`); } else this._drag = null; });
  },

  /* ---------- trocar desenho da parte selecionada ---------- */
  cycleDrawing(dir) {
    const rig = this.selRig, n = this.selNode; if (!rig || !n || n.drawings.length < 2) return;
    const cur = Math.round(Rig.ch(rig, n.id, 'd', this.f, n.d || 0)), k = (cur + dir + n.drawings.length) % n.drawings.length;
    if (this.mode === 'montar') n.d = k; else Rig.setKey(rig, n.id, 'd', this.f, k, 'hold');
    this.commit(`Desenho: ${n.drawings[k].name || k + 1}`);
  },
  setDrawing(n, k) { const rig = this.selRig; if (this.mode === 'montar') n.d = k; else Rig.setKey(rig, n.id, 'd', this.f, k, 'hold'); this.commit(`Desenho: ${n.drawings[k]?.name || k + 1}`); },

  /* ---------- teclado ---------- */
  initKeys() {
    addEventListener('keydown', e => {
      if (e.target.closest('input,textarea,select,[contenteditable]') || $('#modal-root').children.length) return;
      const k = e.key, ctrl = e.ctrlKey || e.metaKey;
      if (k === ' ') { e.preventDefault(); if (!e.repeat) this.togglePlay(); return; }
      if (ctrl && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); return; }
      if (ctrl && k.toLowerCase() === 'y') { e.preventDefault(); this.redo(); return; }
      if (ctrl && k.toLowerCase() === 's') { e.preventDefault(); this.save(); return; }
      if (ctrl && k.toLowerCase() === 'c') { this.copyPose(); return; }
      if (ctrl && k.toLowerCase() === 'v') { this.pastePose(); return; }
      if (ctrl) return;
      const draw = Desenho.isTool(this.tool), step = draw ? Math.max(1, Desenho.opt.passo | 0) : 1;
      const map = { ',': () => this.seek(this.f - step), '.': () => this.seek(this.f + step), ArrowLeft: () => this.seek(this.f - 1), ArrowRight: () => this.seek(this.f + 1), Home: () => this.seek(0), End: () => this.seek(this.P.frames - 1), '[': () => this.jumpKey(-1), ']': () => this.jumpKey(1),
        k: () => this.keyHere(), K: () => this.keyAllHere(), Delete: () => this.deleteKeys(), Backspace: () => this.deleteKeys(), ArrowUp: () => this.cycleDrawing(-1), ArrowDown: () => this.cycleDrawing(1),
        o: () => { this.onion = !this.onion; StudioUI.tools(); this.render(); }, b: () => { this.showBones = !this.showBones; StudioUI.tools(); this.render(); }, f: () => this.fitView(),
        v: () => StudioUI.setTool('auto'), r: () => StudioUI.setTool('girar'), m: () => StudioUI.setTool('mover'), s: () => StudioUI.setTool('esticar'), i: () => StudioUI.setTool('ik'), h: () => StudioUI.setTool('mao'), p: () => StudioUI.setTool(this.mode === 'montar' ? 'pivo' : 'auto'),
        d: () => StudioUI.setTool('pincel'), l: () => StudioUI.setTool('lapis'), e: () => StudioUI.setTool('borracha'), g: () => StudioUI.setTool('balde'), y: () => StudioUI.setTool('conta'), c: () => StudioUI.setTool('camera'),
        n: () => StudioUI.drawFrame(false), N: () => StudioUI.drawFrame(true),
        Escape: () => this.select(null), Tab: () => StudioUI.setMode(this.mode === 'animar' ? 'montar' : 'animar'), '?': () => StudioUI.shortcuts() };
      const fn = map[k] || map[k.toLowerCase?.()]; if (fn && this.P) { e.preventDefault(); fn(); }
    });
  },

  async boot() {
    // SEGURANÇA: login com Google conferido no servidor antes de abrir (não remova).
    const email = await TurmaAuth.gate(); if (!email || !TurmaAuth.passed) return;
    await DB.open(); StudioUI.init(); this.initStage(); this.initKeys(); AnTL.mount($('#an-tl'));
    addEventListener('beforeunload', () => { if (this.dirty) this.save(true); }); document.addEventListener('visibilitychange', () => { if (document.hidden && this.dirty) this.save(true); });
    const id = new URLSearchParams(location.search).get('p');
    const rec = id && await DB.get('projects', id);
    if (rec && rec.kind === 'anim') await this.open(rec);
    else if (new URLSearchParams(location.search).get('ed')) await this.openClip(new URLSearchParams(location.search).get('ed'), new URLSearchParams(location.search).get('c'));
    else if (new URLSearchParams(location.search).get('novo')) { history.replaceState(null, '', 'animar.html'); StudioUI.newDialog(true); }
    else StudioUI.startScreen();
    this.ready = true;
  },
};
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => Studio.boot()); else Studio.boot();
