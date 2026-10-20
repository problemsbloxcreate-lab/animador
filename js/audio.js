/* ===================== audio.js — mixagem, reprodução e microfone ===================== */
'use strict';

const AFX_DEFAULT = () => ({ bass: 0, treble: 0, phone: false, echo: 0, echoTime: .25, dist: 0, noise: 0, pan: 0 });

const AudioEngine = {
  nodes: [], master: null, vol: 1,
  ctx() { return Assets.ctx(); },
  ensureMaster() {
    const ctx = this.ctx();
    if (!this.master) { this.master = ctx.createGain(); this.master.connect(ctx.destination); }
    this.master.gain.value = this.vol;
    return this.master;
  },
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; },

  /* lista tudo o que toca som no projeto */
  items(project) {
    const out = [], tracks = project.tracks, solo = tracks.some(t => t.solo);
    const tkOk = tk => tk && !tk.mute && (!solo || tk.solo);
    const snd = (s, defId) => { if (!s || s.mode === 'off') return null; if (s.mode === 'custom' && s.assetId) return s.assetId; const id = (s.mode === 'default' ? (s.id || defId) : s.id) || defId; return id ? 'snd:' + id : null; };
    for (const cl of project.clips) {
      const tk = tracks.find(t => t.id === cl.trackId); if (!tkOk(tk)) continue;
      const tg = (tk.volume ?? 100) / 100, n0 = out.length;
      if ((cl.type === 'audio' || (cl.type === 'video' && Assets.meta(cl.assetId)?.hasAudio)) && !cl.muted) {
        out.push({ src: cl.assetId, start: cl.start, dur: cl.dur, offset: cl.offset || 0, rate: cl.speed || 1, clip: cl, tg, vol: (cl.volume ?? 100) / 100, loop: cl.loop });
      }
      // sons das animações
      for (const a of cl.anims || []) {
        const def = ANIMS[a.type]; if (!def) continue; const id = snd(a.sound, def.sound); if (!id) continue;
        const times = def.soundTimes ? def.soundTimes(a.params, a.dur, cl) : [(def.soundAt || 0) * a.dur];
        times.forEach(tt => { const s = cl.start + a.start + tt; if (s < cl.start + cl.dur) out.push({ src: id, start: s, dur: 30, offset: 0, rate: 1, tg, vol: (a.sound.vol ?? 80) / 100, oneShot: true }); });
      }
      // sons dos efeitos do clipe
      for (const f of cl.fx || []) {
        if (f.on === false) continue; const def = FX[f.type]; if (!def) continue; const id = snd(f.sound, def.sound); if (!id) continue;
        out.push({ src: id, start: cl.start + f.start, dur: def.soundLoop ? f.dur : 30, offset: 0, rate: 1, tg, vol: (f.sound.vol ?? 80) / 100, loop: !!def.soundLoop, oneShot: !def.soundLoop, fadeOut: def.soundLoop ? .08 : 0 });
      }
      // efeito na faixa de efeitos
      if (cl.type === 'fx' && cl.sfx) {
        const def = FX[cl.sfx.type], id = def && snd(cl.sfx.sound, def.sound);
        if (id) out.push({ src: id, start: cl.start, dur: def.soundLoop ? cl.dur : 30, offset: 0, rate: 1, tg, vol: (cl.sfx.sound.vol ?? 80) / 100, loop: !!def.soundLoop, oneShot: !def.soundLoop, fadeOut: def.soundLoop ? .08 : 0 });
      }
      // transições
      for (const [k, tr] of [['in', cl.trIn], ['out', cl.trOut]]) {
        if (!tr || !tr.type) continue; const def = TRANS[tr.type], id = def && snd(tr.sound, def.sound); if (!id) continue;
        out.push({ src: id, start: k === 'in' ? cl.start : cl.start + cl.dur - tr.dur, dur: 30, offset: 0, rate: 1, tg, vol: (tr.sound?.vol ?? 80) / 100, oneShot: true });
      }
      for (let i = n0; i < out.length; i++) out[i].trackId = tk.id;
    }
    return out;
  },

  /* monta o grafo de áudio a partir de fromT; ctxT0 = tempo do contexto equivalente a fromT */
  // trechos com voz (para abaixar a música): usa a transcrição se tiver; senão o clipe de áudio inteiro
  voiceSpans(project) {
    const out = [];
    for (const cl of project.clips) {
      if (cl.type !== 'audio' || cl.muted || cl.duck || cl.assetId?.startsWith('snd:')) continue;
      const tk = project.tracks.find(t => t.id === cl.trackId); if (!tk || tk.mute) continue;
      const m = Assets.meta(cl.assetId); if (!m || (m.dur || 0) < 2.5) continue; // sons curtos não contam como voz
      const tr = project.transcripts?.[cl.assetId], off = cl.offset || 0, sp = cl.speed || 1;
      if (tr?.segs?.length) { for (const g of tr.segs) { const a = cl.start + (g.s - off) / sp, b = cl.start + (g.e - off) / sp; if (b > cl.start && a < cl.start + cl.dur) out.push([Math.max(cl.start, a), Math.min(cl.start + cl.dur, b)]); } }
      else out.push([cl.start, cl.start + cl.dur]);
    }
    out.sort((x, y) => x[0] - y[0]); const mg = [];
    for (const r of out) { const l = mg[mg.length - 1]; if (l && r[0] <= l[1] + .35) l[1] = Math.max(l[1], r[1]); else mg.push([...r]); }
    return mg;
  },
  duckAt(spans, t, amt) { const R = .25; let k = 0; for (const [a, b] of spans) { if (t < a - R) break; const v = t < a ? 1 - (a - t) / R : t <= b ? 1 : t < b + R * 1.6 ? 1 - (t - b) / (R * 1.6) : 0; if (v > k) k = v; } return 1 - (1 - amt) * clamp(k, 0, 1); },
  schedule(ctx, dest, project, fromT, ctxT0, toT = Infinity, onlyTrack = null) {
    const made = []; let spans = null;
    for (const it of this.items(project)) {
      if (onlyTrack && it.trackId !== onlyTrack) continue;
      const buf = Assets.audioBuffer(it.src, ctx); if (!buf) continue;
      const len = it.oneShot ? buf.duration / it.rate : it.dur;
      const end = Math.min(it.start + len, toT);
      if (end <= fromT || it.start >= toT) continue;
      const skip = Math.max(0, fromT - it.start);
      const when = ctxT0 + Math.max(0, it.start - fromT);
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = it.rate;
      let bufOff = it.offset + skip * it.rate;
      if (it.loop) { src.loop = true; bufOff = bufOff % buf.duration; }
      else if (bufOff >= buf.duration) continue;
      const g = ctx.createGain();
      // volume, keyframes de volume e fades
      const cl = it.clip, total = end - (it.start + skip);
      const fi = cl?.fadeIn || 0, fo = cl?.fadeOut || it.fadeOut || 0;
      const duck = cl?.duck ? clamp(cl.duck / 100, 0, 1) : null; if (duck != null && !spans) spans = this.voiceSpans(project);
      const needCurve = (cl && (KF.has(cl, 'volume') || fi || fo)) || it.fadeOut || duck != null;
      const base = it.vol * it.tg;
      if (needCurve && total > .02) {
        const n = Math.max(2, Math.min(4000, Math.ceil(total * 60))), arr = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const tt = it.start + skip + total * i / (n - 1), lt = tt - it.start;
          let v = cl && KF.has(cl, 'volume') ? (KF.value(cl, 'volume', lt) ?? 100) / 100 * it.tg : base;
          if (fi) v *= clamp(lt / fi, 0, 1);
          if (fo) v *= clamp((it.start + it.dur - tt) / fo, 0, 1);
          if (duck != null) v *= this.duckAt(spans, tt, duck);
          arr[i] = Math.max(0, v);
        }
        try { g.gain.setValueCurveAtTime(arr, when, total); } catch { g.gain.value = base; }
      } else g.gain.value = base;
      let head = src;
      if (cl && cl.afx) head = this.afxChain(ctx, src, cl.afx, made, when, total);
      head.connect(g); g.connect(dest);
      src.start(when, bufOff);
      if (isFinite(total)) src.stop(when + total + .01);
      made.push(src, g);
    }
    return made;
  },
  afxChain(ctx, src, a, made, when, total) {
    let n = src;
    const add = node => { n.connect(node); n = node; made.push(node); };
    if (a.bass) { const f = ctx.createBiquadFilter(); f.type = 'lowshelf'; f.frequency.value = 220; f.gain.value = a.bass; add(f); }
    if (a.treble) { const f = ctx.createBiquadFilter(); f.type = 'highshelf'; f.frequency.value = 3200; f.gain.value = a.treble; add(f); }
    if (a.phone) { const f1 = ctx.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = 500; add(f1); const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 3000; add(f2); }
    if (a.dist) { const ws = ctx.createWaveShaper(), k = a.dist * 4, cur = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cur[i] = (1 + k) * x / (1 + k * Math.abs(x)); } ws.curve = cur; add(ws); }
    if (a.pan) { const p = ctx.createStereoPanner(); p.pan.value = a.pan / 100; add(p); }
    if (a.echo) {
      const mix = ctx.createGain(), d = ctx.createDelay(2), fb = ctx.createGain(), wet = ctx.createGain();
      d.delayTime.value = a.echoTime || .25; fb.gain.value = Math.min(.85, a.echo / 100 * .8); wet.gain.value = a.echo / 100;
      n.connect(mix); n.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(mix); made.push(mix, d, fb, wet); n = mix;
    }
    if (a.noise) {
      const mix = ctx.createGain(); n.connect(mix);
      const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = nb.getChannelData(0); let y = 0; for (let i = 0; i < d.length; i++) { y += .6 * ((Math.random() * 2 - 1) - y); d[i] = y; }
      const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true; const ng = ctx.createGain(); ng.gain.value = a.noise / 100 * .25;
      ns.connect(ng); ng.connect(mix); ns.start(when); if (isFinite(total)) ns.stop(when + total);
      made.push(ns, ng, mix); n = mix;
    }
    return n;
  },
  // faixas que têm algum som (para exportar separado)
  soundTracks(project) { const ids = new Set(this.items(project).map(i => i.trackId)); return project.tracks.filter(t => ids.has(t.id)); },
  async renderStems(project, from, to, onProgress) {
    const files = [], tks = this.soundTracks(project);
    for (let i = 0; i < tks.length; i++) {
      onProgress && onProgress(i / tks.length, tks[i].name);
      const buf = await this.renderMix(project, from, to, 48000, tks[i].id);
      const blob = audioBufferToWav(buf);
      files.push({ name: String(i + 1).padStart(2, '0') + ' - ' + safeName(tks[i].name) + (tks[i].type === 'visual' ? ' (sons do vídeo e efeitos)' : tks[i].type === 'fx' ? ' (sons dos efeitos)' : '') + '.wav', data: new Uint8Array(await blob.arrayBuffer()) });
    }
    return files;
  },
  play(project, fromT) {
    this.stop();
    const ctx = this.ctx(); if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + .06;
    this.nodes = this.schedule(ctx, this.ensureMaster(), project, fromT, t0);
    return t0;
  },
  stop() { for (const n of this.nodes) { try { n.stop && n.stop(); } catch { } try { n.disconnect(); } catch { } } this.nodes = []; },
  // prévia de um som solto (biblioteca)
  preview(id, vol = .8) {
    const ctx = this.ctx(); if (ctx.state === 'suspended') ctx.resume();
    if (this._pv) { try { this._pv.stop(); } catch { } }
    const b = Assets.audioBuffer(id, ctx); if (!b) return;
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(this.ensureMaster()); s.start(); if (b.duration > 4) s.stop(ctx.currentTime + 4);
    this._pv = s;
  },
  // mixagem final (para exportar WAV)
  async renderMix(project, from, to, sr = 48000, onlyTrack = null) {
    const len = Math.max(1, Math.ceil((to - from) * sr));
    const off = new OfflineAudioContext(2, len, sr);
    this.schedule(off, off.destination, project, from, 0, to, onlyTrack);
    return await off.startRendering();
  },
};

function audioBufferToWav(buf) {
  const ch = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length, bytes = 44 + n * ch * 2;
  const ab = new ArrayBuffer(bytes), dv = new DataView(ab); let p = 0;
  const w = s => { for (const c of s) dv.setUint8(p++, c.charCodeAt(0)); };
  w('RIFF'); dv.setUint32(p, bytes - 8, true); p += 4; w('WAVE'); w('fmt '); dv.setUint32(p, 16, true); p += 4; dv.setUint16(p, 1, true); p += 2; dv.setUint16(p, ch, true); p += 2;
  dv.setUint32(p, sr, true); p += 4; dv.setUint32(p, sr * ch * 2, true); p += 4; dv.setUint16(p, ch * 2, true); p += 2; dv.setUint16(p, 16, true); p += 2; w('data'); dv.setUint32(p, n * ch * 2, true); p += 4;
  const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = clamp(data[c][i], -1, 1); dv.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true); p += 2; }
  return new Blob([ab], { type: 'audio/wav' });
}

/* ===================== Microfone ===================== */
const Mic = {
  stream: null, nodes: null, recorder: null, chunks: [], level: 0, peakHold: 0,
  settings: { deviceId: '', noiseSuppression: true, echoCancellation: true, autoGainControl: false, gain: 100, gate: 0, highpass: 80, monitor: false, monitorVol: 80, latency: 0, countdown: true, playWhile: true, newTrack: false },
  loadSettings() { try { Object.assign(this.settings, JSON.parse(localStorage.getItem('ps-mic') || '{}')); } catch { } },
  saveSettings() { try { localStorage.setItem('ps-mic', JSON.stringify(this.settings)); } catch { } },
  async devices() {
    try { const d = await navigator.mediaDevices.enumerateDevices(); return d.filter(x => x.kind === 'audioinput'); } catch { return []; }
  },
  async open() {
    this.close();
    const s = this.settings;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador não permite usar o microfone aqui. Abra o editor pelo Chrome usando http://localhost ou pelo site (https).');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: s.deviceId ? { exact: s.deviceId } : undefined, noiseSuppression: s.noiseSuppression, echoCancellation: s.echoCancellation, autoGainControl: s.autoGainControl, channelCount: 1 } });
    const ctx = Assets.ctx(); if (ctx.state === 'suspended') await ctx.resume();
    const src = ctx.createMediaStreamSource(this.stream);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = s.highpass || 10;
    const gate = ctx.createGain(); const gain = ctx.createGain(); gain.gain.value = s.gain / 100;
    const an = ctx.createAnalyser(); an.fftSize = 1024;
    const pre = ctx.createAnalyser(); pre.fftSize = 1024;
    const rec = ctx.createMediaStreamDestination();
    const mon = ctx.createGain(); mon.gain.value = s.monitor ? s.monitorVol / 100 : 0;
    src.connect(hp); hp.connect(pre); hp.connect(gate); gate.connect(gain); gain.connect(an); gain.connect(rec); gain.connect(mon); mon.connect(ctx.destination);
    this.nodes = { src, hp, gate, gain, an, pre, rec, mon };
    this.loop();
    return true;
  },
  apply() {
    const s = this.settings, n = this.nodes; if (!n) return;
    n.hp.frequency.value = s.highpass || 10; n.gain.gain.value = s.gain / 100;
    n.mon.gain.setTargetAtTime(s.monitor ? s.monitorVol / 100 : 0, Assets.ctx().currentTime, .02);
    this.saveSettings();
  },
  loop() {
    if (!this.nodes) return;
    const n = this.nodes, a = new Float32Array(n.pre.fftSize), b = new Float32Array(n.an.fftSize);
    n.pre.getFloatTimeDomainData(a); n.an.getFloatTimeDomainData(b);
    let rmsIn = 0; for (const v of a) rmsIn += v * v; rmsIn = Math.sqrt(rmsIn / a.length);
    let pk = 0; for (const v of b) pk = Math.max(pk, Math.abs(v));
    this.level = pk; this.peakHold = Math.max(pk, this.peakHold * .96);
    // noise gate: abaixo do limite, silencia
    const db = 20 * Math.log10(rmsIn + 1e-9), thr = -80 + this.settings.gate * .7; // gate 0..100 -> -80..-10 dB
    const open = this.settings.gate <= 0 || db > thr;
    n.gate.gain.setTargetAtTime(open ? 1 : 0, Assets.ctx().currentTime, open ? .005 : .08);
    this.inDb = db; this.gateOpen = open;
    this.raf = requestAnimationFrame(() => this.loop());
  },
  start() {
    if (!this.nodes) throw new Error('Microfone não está ligado.');
    this.chunks = [];
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    const mime = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    this.recorder = new MediaRecorder(this.nodes.rec.stream, mime ? { mimeType: mime, audioBitsPerSecond: 192000 } : undefined);
    this.recorder.ondataavailable = e => e.data.size && this.chunks.push(e.data);
    this.recorder.start(250);
    this.recStart = performance.now();
  },
  stop() {
    return new Promise(res => {
      if (!this.recorder || this.recorder.state === 'inactive') return res(null);
      this.recorder.onstop = () => res(new Blob(this.chunks, { type: this.recorder.mimeType || 'audio/webm' }));
      this.recorder.stop();
    });
  },
  get recording() { return this.recorder && this.recorder.state === 'recording'; },
  close() {
    cancelAnimationFrame(this.raf);
    if (this.nodes) { Object.values(this.nodes).forEach(n => { try { n.disconnect(); } catch { } }); this.nodes = null; }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    this.level = 0;
  },
};
Mic.loadSettings();
