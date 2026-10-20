/* ===================== db.js — banco local (IndexedDB), mídias e arquivo .toon ===================== */
'use strict';

const DB = (() => {
  let db;
  const STORES = ['projects', 'assets', 'presets', 'templates', 'kv'];
  function open() {
    if (db) return Promise.resolve(db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('turma-studios', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('assets')) { const s = d.createObjectStore('assets', { keyPath: 'id' }); s.createIndex('project', 'projectId'); }
        if (!d.objectStoreNames.contains('presets')) d.createObjectStore('presets', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('templates')) d.createObjectStore('templates', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      };
      r.onsuccess = () => { db = r.result; res(db); };
      r.onerror = () => rej(r.error);
    });
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function tx(store, mode = 'readonly') { await open(); return db.transaction(store, mode).objectStore(store); }
  return {
    open,
    get: async (s, k) => req((await tx(s)).get(k)),
    all: async s => req((await tx(s)).getAll()),
    put: async (s, v, k) => req((await tx(s, 'readwrite')).put(v, k)),
    del: async (s, k) => req((await tx(s, 'readwrite')).delete(k)),
    byIndex: async (s, idx, v) => req((await tx(s)).index(idx).getAll(v)),
    keysByIndex: async (s, idx, v) => req((await tx(s)).index(idx).getAllKeys(v)),
    async usage() { try { const e = await navigator.storage.estimate(); return e; } catch { return null; } },
  };
})();
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { }

/* ---------- Mídias carregadas na memória ---------- */
const Assets = {
  map: new Map(),       // id -> runtime { meta, blob, url, img, frames, buffer, peaks, thumbs }
  audioCtx: null,
  ctx() { if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return this.audioCtx; },
  kindOf(file) {
    const t = file.type || '', n = (file.name || '').toLowerCase();
    if (t === 'image/gif' || n.endsWith('.gif')) return 'gif';
    if (t.startsWith('image/') || /\.(png|jpe?g|webp|bmp|svg|avif)$/.test(n)) return 'image';
    if (t.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv|ogv)$/.test(n)) return 'video';
    if (t.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba)$/.test(n)) return 'audio';
    return null;
  },
  get(id) { return this.map.get(id); },
  meta(id) { if (id && id.startsWith('snd:')) { const s = SOUNDS.defs[id.slice(4)]; return s ? { id, kind: 'audio', name: s.name, dur: s.sec, builtin: true } : null; } return this.map.get(id)?.meta; },
  async importFile(file, projectId) {
    const kind = this.kindOf(file);
    if (!kind) throw new Error(`Formato não suportado: ${file.name}`);
    const meta = { id: uid('a_'), projectId, name: file.name, kind, mime: file.type || '', size: file.size, created: Date.now() };
    const rt = await this.load(meta, file);
    await DB.put('assets', { ...meta, blob: file });
    return rt;
  },
  async addBlob(blob, name, projectId, kind) {
    const meta = { id: uid('a_'), projectId, name, kind: kind || this.kindOf({ type: blob.type, name }), mime: blob.type, size: blob.size, created: Date.now() };
    const rt = await this.load(meta, blob);
    await DB.put('assets', { ...meta, blob });
    return rt;
  },
  async load(meta, blob) {
    const rt = { meta, blob, url: URL.createObjectURL(blob) };
    this.map.set(meta.id, rt);
    try {
      if (meta.kind === 'image') {
        const img = new Image(); img.decoding = 'async'; img.src = rt.url; await img.decode();
        rt.img = img; meta.w = img.naturalWidth || 512; meta.h = img.naturalHeight || 512; meta.thumb = rt.url;
      } else if (meta.kind === 'gif') {
        await this.loadGif(rt);
      } else if (meta.kind === 'video') {
        const v = await this.videoEl(rt.url);
        meta.w = v.videoWidth; meta.h = v.videoHeight; meta.dur = v.duration;
        rt.probe = v;
        try { rt.buffer = await this.decode(blob); meta.hasAudio = !!rt.buffer; rt.peaks = this.peaks(rt.buffer, Math.min(200000, Math.max(2000, Math.ceil(rt.buffer.duration * 200)))); } catch { meta.hasAudio = false; }
        this.makeThumbs(rt);
      } else if (meta.kind === 'audio') {
        rt.buffer = await this.decode(blob); meta.dur = rt.buffer.duration; rt.peaks = this.peaks(rt.buffer, Math.min(200000, Math.max(2000, Math.ceil(rt.buffer.duration * 200))));
      }
    } catch (e) { console.warn('Falha ao carregar mídia', meta.name, e); rt.error = String(e.message || e); }
    return rt;
  },
  async loadGif(rt) {
    const { meta, blob } = rt;
    if ('ImageDecoder' in window) {
      try {
        const dec = new ImageDecoder({ data: await blob.arrayBuffer(), type: 'image/gif' });
        await dec.tracks.ready; const n = dec.tracks.selectedTrack.frameCount; rt.frames = []; let t = 0;
        for (let i = 0; i < n; i++) {
          const { image } = await dec.decode({ frameIndex: i });
          const d = (image.duration || 100000) / 1e6; const bmp = await createImageBitmap(image);
          rt.frames.push({ bmp, t, d: Math.max(.02, d) }); t += Math.max(.02, d); image.close();
        }
        meta.w = rt.frames[0].bmp.width; meta.h = rt.frames[0].bmp.height; meta.dur = t; meta.animated = n > 1;
      } catch (e) { console.warn('GIF via ImageDecoder falhou', e); rt.frames = null; }
    }
    const img = new Image(); img.src = rt.url; await img.decode().catch(() => { }); rt.img = img;
    meta.w = meta.w || img.naturalWidth; meta.h = meta.h || img.naturalHeight; meta.thumb = rt.url;
    if (!rt.frames) meta.animated = false;
  },
  gifFrame(rt, t) {
    if (!rt.frames || !rt.frames.length) return rt.img;
    const tt = ((t % rt.meta.dur) + rt.meta.dur) % rt.meta.dur;
    let lo = 0, hi = rt.frames.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (rt.frames[m].t <= tt) lo = m; else hi = m - 1; }
    return rt.frames[lo].bmp;
  },
  videoEl(url) {
    return new Promise((res, rej) => {
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous'; v.src = url;
      v.onloadeddata = () => res(v); v.onerror = () => rej(new Error('Não foi possível abrir esse vídeo (formato/codec não suportado pelo navegador).'));
    });
  },
  async decode(blob) {
    const ab = await blob.arrayBuffer();
    return await new Promise((res, rej) => this.ctx().decodeAudioData(ab, res, rej));
  },
  peaks(buf, n = 2000) {
    if (!buf) return null;
    const ch = buf.getChannelData(0), step = Math.max(1, Math.floor(ch.length / n)), out = new Float32Array(Math.ceil(ch.length / step));
    for (let i = 0, j = 0; i < ch.length; i += step, j++) { let m = 0; for (let k = i; k < i + step && k < ch.length; k += 4) { const v = Math.abs(ch[k]); if (v > m) m = v; } out[j] = m; }
    return out;
  },
  async makeThumbs(rt) {
    const v = await this.videoEl(rt.url).catch(() => null); if (!v) return;
    const n = 10, hh = 54, ww = Math.round(hh * (v.videoWidth / v.videoHeight || 16 / 9));
    const cv = document.createElement('canvas'); cv.width = ww * n; cv.height = hh; const c = cv.getContext('2d');
    for (let i = 0; i < n; i++) {
      v.currentTime = Math.min(v.duration - .05, (i + .5) / n * v.duration);
      await new Promise(r => { v.onseeked = r; setTimeout(r, 1500); });
      c.drawImage(v, i * ww, 0, ww, hh);
      if (i === 1) rt.meta.thumb = (() => { const t = document.createElement('canvas'); t.width = ww * 2; t.height = hh * 2; t.getContext('2d').drawImage(v, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', .7); })();
    }
    rt.strip = cv.toDataURL('image/jpeg', .6); rt.stripW = ww; rt.stripN = n;
    v.removeAttribute('src'); v.load();
    if (typeof App !== 'undefined' && App.onAssetsChanged) App.onAssetsChanged(true);
  },
  async loadProjectAssets(projectId) {
    const recs = await DB.byIndex('assets', 'project', projectId);
    await Promise.all(recs.map(r => { const { blob, ...meta } = r; return this.map.has(r.id) ? null : this.load(meta, blob); }));
    return recs.length;
  },
  unloadAll() {
    for (const rt of this.map.values()) { try { URL.revokeObjectURL(rt.url); rt.frames && rt.frames.forEach(f => f.bmp.close && f.bmp.close()); } catch { } }
    this.map.clear(); VideoPool.clear();
  },
  list(projectId) { return [...this.map.values()].filter(r => r.meta.projectId === projectId).map(r => r.meta).sort((a, b) => b.created - a.created); },
  async remove(id) { const rt = this.map.get(id); if (rt) { URL.revokeObjectURL(rt.url); this.map.delete(id); } await DB.del('assets', id); },
  async rename(id, name) { const rt = this.map.get(id); if (!rt) return; rt.meta.name = name; const r = await DB.get('assets', id); if (r) { r.name = name; await DB.put('assets', r); } },
  audioBuffer(id, ctx) {
    if (id && id.startsWith('snd:')) return SOUNDS.buffer(ctx, id.slice(4));
    const rt = this.map.get(id); if (!rt || !rt.buffer) return null;
    if (ctx === this.audioCtx || !ctx) return rt.buffer;
    // copia para outro contexto (OfflineAudioContext) — AudioBuffer é compatível entre contextos
    return rt.buffer;
  },
};

/* ---------- Elementos de vídeo por clipe ---------- */
const VideoPool = {
  map: new Map(),
  get(clip) {
    let e = this.map.get(clip.id);
    const rt = Assets.get(clip.assetId); if (!rt) return null;
    if (!e || e.assetId !== clip.assetId) {
      if (e) { e.v.pause(); e.v.removeAttribute('src'); }
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = rt.url;
      e = { v, assetId: clip.assetId, ready: false, want: -1 }; v.onloadeddata = () => { e.ready = true; if (typeof App !== 'undefined') App.requestRender(); };
      v.onseeked = () => { if (typeof App !== 'undefined' && !App.playing) App.requestRender(); };
      this.map.set(clip.id, e);
    }
    return e;
  },
  clear() { for (const e of this.map.values()) { e.v.pause(); e.v.removeAttribute('src'); e.v.load(); } this.map.clear(); },
  pauseAll() { for (const e of this.map.values()) e.v.pause(); },
  prune(ids) { for (const [k, e] of this.map) if (!ids.has(k)) { e.v.pause(); e.v.removeAttribute('src'); this.map.delete(k); } },
};

/* ---------- Arquivo .toon (projeto + todas as mídias num arquivo só) ---------- */
const ToonFile = {
  EXT: '.toon',
  async build(project, presets = [], onProgress, extra = {}) {
    const enc = new TextEncoder();
    const used = this.usedAssetIds(project);
    const recs = (await DB.byIndex('assets', 'project', project.id)).filter(r => used.has(r.id));
    const files = [];
    const manifest = [];
    let ri = 0;
    for (const r of recs) {
      onProgress && onProgress(ri++ / Math.max(1, recs.length), r.name, recs.length);
      const { blob, thumb, ...meta } = r;
      const data = new Uint8Array(await blob.arrayBuffer());
      const path = 'midia/' + r.id;
      manifest.push({ ...meta, path, mime: blob.type || meta.mime });
      files.push({ name: path, data });
    }
    const usedPresets = presets.filter(p => JSON.stringify(project).includes(p.id) || true);
    const head = { app: 'Estúdio Problems — Animação', format: 'toon', version: 1, kind: project.kind || 'video', saved: Date.now(), lastT: extra.lastT || 0 };
    files.unshift(
      { name: 'toon.json', data: enc.encode(JSON.stringify(head)) },
      { name: 'projeto.json', data: enc.encode(JSON.stringify(project)) },
      { name: 'midias.json', data: enc.encode(JSON.stringify(manifest)) },
      { name: 'efeitos-salvos.json', data: enc.encode(JSON.stringify(usedPresets)) },
    );
    if (extra.thumb) files.push({ name: 'capa.txt', data: enc.encode(extra.thumb) });
    return Zip.create(files);
  },
  usedAssetIds(project) {
    const s = new Set();
    const walk = o => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if ((k === 'assetId') && typeof v === 'string' && !v.startsWith('snd:')) s.add(v); else walk(v); } };
    walk(project.clips); walk(project.bin || []);
    // estúdio de animação: desenhos e áudios ("asset") — também dentro de objetos "animação" do editor
    const walkA = o => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if ((k === 'asset' || k === 'bgAsset' || k === 'ref') && typeof v === 'string' && v.startsWith('a_')) s.add(v); else walkA(v); } };
    walkA(project.rigs); walkA(project.audio); if (project.bgAsset) s.add(project.bgAsset); walkA((project.clips || []).filter(c => c.anim).map(c => c.anim)); walkA(project.animLib);
    (project.bin || []).forEach(id => s.add(id));
    return s;
  },
  async read(file) {
    const files = Zip.read(await file.arrayBuffer()), dec = new TextDecoder();
    const json = n => { const d = files.get(n); if (!d) throw new Error('Arquivo .toon incompleto (faltando ' + n + ').'); return JSON.parse(dec.decode(d)); };
    const head = json('toon.json'); if (head.format !== 'toon') throw new Error('Esse arquivo não é um projeto do Estúdio Problems.');
    let projectText = dec.decode(files.get('projeto.json'));
    const manifest = json('midias.json');
    const presets = files.has('efeitos-salvos.json') ? json('efeitos-salvos.json') : [];
    const oldP = JSON.parse(projectText);
    const newPid = uid('p_');
    const remap = {};
    manifest.forEach(m => remap[m.id] = uid('a_'));
    for (const [o, n] of Object.entries(remap)) projectText = projectText.split(o).join(n);
    const project = JSON.parse(projectText);
    project.id = newPid; project.modified = Date.now();
    for (const m of manifest) {
      const data = files.get(m.path); if (!data) continue;
      const blob = new Blob([data], { type: m.mime || '' });
      const { path, ...meta } = m;
      await DB.put('assets', { ...meta, id: remap[m.id], projectId: newPid, blob });
    }
    const thumb = files.has('capa.txt') ? dec.decode(files.get('capa.txt')) : null;
    return { project, presets, oldName: oldP.name, thumb: thumb && thumb.startsWith('data:image/') ? thumb : null, lastT: head.lastT || 0 };
  },
};
