/* ===================== render.js — desenha um quadro do projeto ===================== */
'use strict';

const TR_DEFAULT = () => ({ x: 0, y: 0, scale: 1, sx: 1, sy: 1, rot: 0, opacity: 100, ax: .5, ay: .5, flipX: false, flipY: false, blend: 'source-over', fit: 'contain' });
const ANIMATABLE = {
  'tr.x': { l: 'Posição X', unit: 'px' }, 'tr.y': { l: 'Posição Y', unit: 'px' }, 'tr.scale': { l: 'Escala', unit: 'x' },
  'tr.sx': { l: 'Largura', unit: 'x' }, 'tr.sy': { l: 'Altura', unit: 'x' }, 'tr.rot': { l: 'Rotação', unit: '°' }, 'tr.opacity': { l: 'Opacidade', unit: '%' },
  'color.brightness': { l: 'Brilho' }, 'color.contrast': { l: 'Contraste' }, 'color.saturation': { l: 'Saturação' }, 'color.hue': { l: 'Matiz' },
  'color.grayscale': { l: 'Preto e branco' }, 'color.sepia': { l: 'Sépia' }, 'color.invert': { l: 'Inverter' }, 'color.blur': { l: 'Desfoque' }, 'color.tintAmt': { l: 'Intensidade da cor' },
  'volume': { l: 'Volume', unit: '%' },
};

function getPath(o, path) { const ps = path.split('.'); let v = o; for (const p of ps) { if (v == null) return undefined; v = v[p]; } return v; }
function setPath(o, path, val) { const ps = path.split('.'); let v = o; for (let i = 0; i < ps.length - 1; i++) { v = v[ps[i]] ??= {}; } v[ps[ps.length - 1]] = val; }

const KF = {
  value(clip, path, lt) {
    const keys = clip.kf && clip.kf[path];
    if (!keys || !keys.length) return getPath(clip, path);
    if (lt <= keys[0].t) return keys[0].v;
    const last = keys[keys.length - 1]; if (lt >= last.t) return last.v;
    let i = 0; while (i < keys.length - 1 && keys[i + 1].t < lt) i++;
    const a = keys[i], b = keys[i + 1], u = (lt - a.t) / Math.max(1e-6, b.t - a.t);
    return lerp(a.v, b.v, (Ease[a.e || 'linear'] || Ease.linear)(u));
  },
  has(clip, path) { return !!(clip.kf && clip.kf[path] && clip.kf[path].length); },
  at(clip, path, lt, tol = 1 / 60) { const k = clip.kf && clip.kf[path]; return k ? k.find(k => Math.abs(k.t - lt) < tol) : null; },
  set(clip, path, lt, v, e) {
    clip.kf ||= {}; const keys = clip.kf[path] ||= [];
    const ex = keys.find(k => Math.abs(k.t - lt) < 1e-3);
    if (ex) { ex.v = v; if (e) ex.e = e; } else keys.push({ t: round(lt, 4), v, e: e || 'inOut' });
    keys.sort((a, b) => a.t - b.t);
  },
  remove(clip, path, lt) { const k = clip.kf && clip.kf[path]; if (!k) return; const i = k.findIndex(k => Math.abs(k.t - lt) < 1e-3); if (i >= 0) k.splice(i, 1); if (!k.length) delete clip.kf[path]; },
  times(clip) { const s = new Set(); for (const ks of Object.values(clip.kf || {})) ks.forEach(k => s.add(round(k.t, 4))); return [...s].sort((a, b) => a - b); },
};

const Renderer = (() => {
  const tmps = {};
  function tmp(name, w, h) {
    let c = tmps[name];
    if (!c) c = tmps[name] = document.createElement('canvas');
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }
  const layers = [];
  function layer(i, w, h) { const c = tmp('layer' + i, w, h); const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, w, h); return c; }
  function copy(cv, key = 'cp') { const c = tmp(key, cv.width, cv.height), x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'copy'; x.globalAlpha = 1; x.filter = 'none'; x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'source-over'; return c; }

  /* ---------- fonte (imagem/vídeo/gif) ---------- */
  // objeto "animação" (vindo do Estúdio de Animação): desenha o quadro do boneco num canvas próprio
  const animCv = new Map();
  function animSource(clip, lt) {
    const A = clip.anim?.P || curProject?.animLib?.[clip.anim?.lib]; if (!A || typeof AnimRender === 'undefined') return null;
    const W = A.settings.w, H = A.settings.h; let e = animCv.get(clip.id); if (!e) { e = { cv: document.createElement('canvas'), f: -1, sig: '' }; animCv.set(clip.id, e); }
    if (e.cv.width !== W || e.cv.height !== H) { e.cv.width = W; e.cv.height = H; e.f = -1; }
    const fps = A.settings.fps, N = Math.max(1, A.frames); let f = Math.floor((lt * (clip.speed || 1) + (clip.offset || 0)) * fps + 1e-6); f = clip.anim.loop ? ((f % N) + N) % N : clamp(f, 0, N - 1);
    const sig = (clip.anim.rev || 0) + ':' + (A.rev || 0);
    if (e.f !== f || e.sig !== sig) { const g = e.cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); AnimRender.frame(g, A, f, { transparent: !!clip.anim.transparent }); e.f = f; e.sig = sig; }
    return { el: e.cv, w: W, h: H };
  }
  function srcSize(c) { const A = c.type === 'anim' && (c.anim?.P || curProject?.animLib?.[c.anim?.lib]); if (A) return { w: A.settings.w, h: A.settings.h }; if (['image', 'gif', 'video'].includes(c.type)) { const m = Assets.meta(c.assetId); return { w: m?.w || 400, h: m?.h || 300 }; } return null; }
  function sourceOf(clip, lt, opt) {
    if (clip.type === 'anim') return animSource(clip, lt);
    const rt = clip.assetId ? Assets.get(clip.assetId) : null;
    if (clip.type === 'image') { if (!rt || !rt.img) return null; if (clip.boca && typeof Mouth !== 'undefined' && Mouth.open(clip, lt)) { const alt = Assets.get(clip.boca.midia); if (alt?.img) return { el: alt.img, w: rt.meta.w, h: rt.meta.h, iw: alt.meta.w, ih: alt.meta.h }; } return { el: rt.img, w: rt.meta.w, h: rt.meta.h }; }
    if (clip.type === 'gif') { if (!rt) return null; const t = (clip.offset || 0) + lt * (clip.speed || 1); return { el: Assets.gifFrame(rt, t), w: rt.meta.w, h: rt.meta.h }; }
    if (clip.type === 'video') {
      if (!rt) return null;
      const e = VideoPool.get(clip); if (!e) return null;
      const v = e.v, st = (clip.offset || 0) + lt * (clip.speed || 1);
      if (!opt.noSync) syncVideo(e, st, clip, opt);
      opt.usedVideos && opt.usedVideos.add(clip.id);
      return { el: v.readyState >= 2 ? v : null, w: rt.meta.w || v.videoWidth || 16, h: rt.meta.h || v.videoHeight || 9, loading: v.readyState < 2 };
    }
    return null;
  }
  function syncVideo(e, st, clip, opt) {
    const v = e.v, fps = opt.fps || 30;
    st = clamp(st, 0, Math.max(0, (v.duration || 1e9) - .03));
    if (opt.playing) {
      v.playbackRate = clamp(clip.speed || 1, .0625, 16);
      if (v.paused) { if (Math.abs(v.currentTime - st) > .05) v.currentTime = st; v.play().catch(() => { }); }
      else if (Math.abs(v.currentTime - st) > .3) v.currentTime = st;
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - st) > .5 / fps && !v.seeking) v.currentTime = st;
    }
  }

  /* ---------- geometria do objeto ---------- */
  function contentSize(clip, P, src) {
    if (clip.type === 'text') return textSize(clip, P);
    if (clip.type === 'shape') return { w: clip.shape.w, h: clip.shape.h };
    if (clip.type === 'color') return { w: P.W, h: P.H };
    if (!src) src = srcSize(clip) || (() => { const m = Assets.meta(clip.assetId); return { w: m?.w || 400, h: m?.h || 300 }; })();
    const cr = clip.crop || { l: 0, t: 0, r: 0, b: 0 };
    const fit = clip.tr.fit || 'contain', sw = Math.max(1, (src.w || 1) * (1 - (cr.l + cr.r) / 100)), sh = Math.max(1, (src.h || 1) * (1 - (cr.t + cr.b) / 100));
    if (fit === 'none') return { w: sw, h: sh };
    if (fit === 'stretch') return { w: P.W, h: P.H };
    const k = fit === 'cover' ? Math.max(P.W / sw, P.H / sh) : Math.min(P.W / sw, P.H / sh);
    return { w: sw * k, h: sh * k };
  }

  function animState(clip, lt, P) {
    const o = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, op: 1, chars: 1, pivot: 'center' };
    for (const a of clip.anims || []) {
      const def = ANIMS[a.type]; if (!def) continue;
      const x = { t: lt - a.start, dur: a.dur, W: P.W, H: P.H, clip, anim: a };
      let r = null;
      if (lt < a.start) { if (def.hold === 'before' && !(a.since != null && lt < a.since)) r = def.fn(0, a.params, { ...x, t: 0 }); } // since/until: a animação só vale naquele trecho
      else if (lt > a.start + a.dur) {
        if (a.until != null && lt > a.until) { }
        else if (def.hold === 'after') r = def.fn(1, a.params, { ...x, t: a.dur });
        else if (a.params.keep && def.final) r = def.final(a.params);
      } else r = def.fn(clamp((lt - a.start) / a.dur, 0, 1), a.params, x);
      if (!r) continue;
      if (r.dx) o.dx += r.dx; if (r.dy) o.dy += r.dy;
      if (r.sx !== undefined) o.sx *= r.sx; if (r.sy !== undefined) o.sy *= r.sy;
      if (r.rot) o.rot += r.rot; if (r.op !== undefined) o.op *= r.op;
      if (r.chars !== undefined) o.chars = Math.min(o.chars, r.chars);
      if (r.pivot === 'bottom') o.pivot = 'bottom';
      if (a.pv) o._pv = a.pv; // ponto de giro próprio desta animação (trecho de um personagem juntado)
    }
    if (o._pv) o.pv = o.pivot === 'bottom' ? o._pv.b : o._pv.c;
    return o;
  }

  function state(clip, lt, P, src) {
    const v = p => KF.value(clip, p, lt);
    const tr = {
      x: v('tr.x'), y: v('tr.y'), scale: v('tr.scale'), sx: v('tr.sx') ?? 1, sy: v('tr.sy') ?? 1, rot: v('tr.rot'), opacity: v('tr.opacity'),
      ax: clip.tr.ax ?? .5, ay: clip.tr.ay ?? .5, flipX: clip.tr.flipX, flipY: clip.tr.flipY,
    };
    const an = animState(clip, lt, P);
    const size = contentSize(clip, P, src);
    return { tr, an, size, lt };
  }
  // matriz do objeto (unidades do projeto) + caixa local
  function matrix(st, P) {
    const { tr, an, size } = st;
    const m = new DOMMatrix();
    m.translateSelf(P.W / 2 + tr.x + an.dx, P.H / 2 + tr.y + an.dy);
    m.rotateSelf(tr.rot || 0);
    m.scaleSelf(tr.scale * tr.sx * (tr.flipX ? -1 : 1), tr.scale * tr.sy * (tr.flipY ? -1 : 1));
    if (an.pv) { m.translateSelf(an.pv.x, an.pv.y); m.rotateSelf(an.rot); m.scaleSelf(an.sx, an.sy); m.translateSelf(-an.pv.x, -an.pv.y); }
    else { const py = an.pivot === 'bottom' ? size.h * (1 - tr.ay) : 0;
    m.translateSelf(0, py); m.rotateSelf(an.rot); m.scaleSelf(an.sx, an.sy); m.translateSelf(0, -py); }
    return { m, box: { x: -size.w * tr.ax, y: -size.h * tr.ay, w: size.w, h: size.h } };
  }

  /* ---------- "preso a" (pai): o clipe segue o movimento de outro clipe (boneco com partes) ----------
     O filho é montado em cima do pai na posição de descanso do pai (valores sem keyframes/animações).
     Depois, tudo o que o pai fizer (andar, girar, pular, balançar com a voz) o filho faz junto. */
  let curProject = null;
  function restMatrix(pc, P) {
    const fake = { ...pc, kf: {}, anims: [] };
    const src = srcSize(pc);
    return matrix(state(fake, 0, P, src), P).m;
  }
  function parentWorld(clip, t, P, depth = 0) {
    if (!clip.parent || !curProject || depth > 6) return null;
    const pc = curProject.clips.find(c => c.id === clip.parent); if (!pc || pc === clip) return null;
    const lt = clamp(t - pc.start, 0, pc.dur);
    const src = srcSize(pc);
    let pm = matrix(state(pc, lt, P, src), P).m;
    const gp = parentWorld(pc, t, P, depth + 1); if (gp) pm = gp.multiply(pm);
    return pm.multiply(restMatrix(pc, P).inverse());
  }
  function worldMatrix(clip, st, P, t) {
    const r = matrix(st, P);
    const pw = clip.parent ? parentWorld(clip, t, P) : null;
    if (pw) r.m = pw.multiply(r.m);
    return r;
  }

  function colorFilter(clip, lt) {
    const v = p => KF.value(clip, 'color.' + p, lt) ?? COLOR_PRESETS.normal.v[p];
    const f = [];
    const b = v('brightness'), c = v('contrast'), s = v('saturation'), hu = v('hue'), g = v('grayscale'), se = v('sepia'), iv = v('invert'), bl = v('blur');
    if (b !== 100) f.push(`brightness(${b}%)`); if (c !== 100) f.push(`contrast(${c}%)`); if (s !== 100) f.push(`saturate(${s}%)`);
    if (hu) f.push(`hue-rotate(${hu}deg)`); if (g) f.push(`grayscale(${g}%)`); if (se) f.push(`sepia(${se}%)`); if (iv) f.push(`invert(${iv}%)`);
    return { filter: f.join(' ') || 'none', blur: bl || 0, tint: clip.color?.tint, tintAmt: v('tintAmt') || 0 };
  }

  /* ---------- texto ---------- */
  function fontStr(t, scale = 1) { return `${t.italic ? 'italic ' : ''}${t.bold ? '700 ' : '400 '}${t.size * scale}px "${t.font}", sans-serif`; }
  const measureCv = document.createElement('canvas').getContext('2d');
  function textLines(t) { return String(t.text ?? '').split('\n'); }
  function textSize(clip) {
    const t = clip.text; measureCv.font = fontStr(t);
    const lines = textLines(t), lh = t.size * (t.lineH || 1.15);
    let w = 0; lines.forEach(l => w = Math.max(w, measureCv.measureText(l).width + (t.spacing || 0) * l.length));
    const pad = t.bg && t.bgAmt > 0 ? t.size * .35 : 0;
    return { w: Math.max(10, w + pad * 2 + (t.strokeW || 0)), h: Math.max(10, lines.length * lh + pad * 2 * .7 + (t.strokeW || 0)) };
  }
  function drawText(c, clip, box, chars) {
    const t = clip.text, lines = textLines(t), lh = t.size * (t.lineH || 1.15);
    let total = lines.reduce((a, l) => a + l.length, 0), show = Math.round(total * clamp(chars, 0, 1));
    if (t.bg && t.bgAmt > 0) { const [R, G, B] = hexToRgb(t.bg); c.fillStyle = `rgba(${R},${G},${B},${t.bgAmt / 100})`; roundRect(c, box.x, box.y, box.w, box.h, t.size * .25); c.fill(); }
    c.font = fontStr(t); c.textBaseline = 'middle'; c.lineJoin = 'round'; c.miterLimit = 2;
    if ('letterSpacing' in c) c.letterSpacing = (t.spacing || 0) + 'px';
    const align = t.align || 'center'; c.textAlign = align;
    const ax = align === 'left' ? box.x + (box.w - textSize(clip).w) / 2 + (t.strokeW || 0) / 2 + (t.bg && t.bgAmt ? t.size * .35 : 0) : align === 'right' ? box.x + box.w - (t.strokeW || 0) / 2 - (t.bg && t.bgAmt ? t.size * .35 : 0) : box.x + box.w / 2;
    const y0 = box.y + box.h / 2 - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => {
      let s = l; if (show < l.length) s = l.slice(0, Math.max(0, show)); show -= l.length;
      if (!s) return;
      const y = y0 + i * lh;
      if (t.shadow) { c.save(); c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = t.size * .12; c.shadowOffsetY = t.size * .06; c.fillStyle = t.color; c.fillText(s, ax, y); c.restore(); }
      if (t.strokeW > 0) { c.strokeStyle = t.stroke; c.lineWidth = t.strokeW; c.strokeText(s, ax, y); }
      c.fillStyle = t.color; c.fillText(s, ax, y);
    });
    if ('letterSpacing' in c) c.letterSpacing = '0px';
  }
  function roundRect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  /* ---------- formas ---------- */
  function shapePath(c, s, b) {
    const { x, y, w, h } = b, cx = x + w / 2, cy = y + h / 2;
    c.beginPath();
    switch (s.kind) {
      case 'rect': c.rect(x, y, w, h); break;
      case 'round': roundRect(c, x, y, w, h, s.radius ?? Math.min(w, h) * .2); break;
      case 'circle': c.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); break;
      case 'triangle': c.moveTo(cx, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath(); break;
      case 'hexagon': for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; c.lineTo(cx + Math.cos(a) * w / 2, cy + Math.sin(a) * h / 2); } c.closePath(); break;
      case 'star': for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i - Math.PI / 2, r = i % 2 ? .45 : 1; c.lineTo(cx + Math.cos(a) * w / 2 * r, cy + Math.sin(a) * h / 2 * r); } c.closePath(); break;
      case 'burst': for (let i = 0; i < 24; i++) { const a = Math.PI / 12 * i - Math.PI / 2, r = i % 2 ? .62 + .1 * hash(i) : 1; c.lineTo(cx + Math.cos(a) * w / 2 * r, cy + Math.sin(a) * h / 2 * r); } c.closePath(); break;
      case 'arrow': c.moveTo(x, y + h * .32); c.lineTo(x + w * .62, y + h * .32); c.lineTo(x + w * .62, y); c.lineTo(x + w, cy); c.lineTo(x + w * .62, y + h); c.lineTo(x + w * .62, y + h * .68); c.lineTo(x, y + h * .68); c.closePath(); break;
      case 'heart': c.moveTo(cx, y + h * .3); c.bezierCurveTo(cx, y, x, y, x, y + h * .3); c.bezierCurveTo(x, y + h * .6, cx, y + h * .8, cx, y + h); c.bezierCurveTo(cx, y + h * .8, x + w, y + h * .6, x + w, y + h * .3); c.bezierCurveTo(x + w, y, cx, y, cx, y + h * .3); c.closePath(); break;
      case 'bubble': { const bh = h * .78, r = Math.min(w, bh) * .25; roundRect(c, x, y, w, bh, r); c.moveTo(x + w * .22, y + bh - 1); c.lineTo(x + w * .12, y + h); c.lineTo(x + w * .4, y + bh - 1); c.closePath(); break; }
      case 'think': { const bh = h * .75; c.ellipse(cx, y + bh / 2, w / 2, bh / 2, 0, 0, Math.PI * 2); c.moveTo(x + w * .2 + h * .06, y + h * .86); c.arc(x + w * .2, y + h * .86, h * .06, 0, Math.PI * 2); c.moveTo(x + w * .1 + h * .035, y + h * .97); c.arc(x + w * .1, y + h * .965, h * .035, 0, Math.PI * 2); break; }
      case 'line': c.rect(x, cy - Math.max(1, s.strokeW || 6) / 2, w, Math.max(1, s.strokeW || 6)); break;
      default: c.rect(x, y, w, h);
    }
  }
  function drawShape(c, s, b) {
    shapePath(c, s, b);
    const fim = s.fillAsset && typeof Assets !== 'undefined' && Assets.get(s.fillAsset)?.img;
    if (fim) { // imagem DENTRO da forma (a forma é a máscara; mover a forma move a imagem)
      c.save(); c.clip(); if (s.fillOn !== false && s.fill) { c.fillStyle = s.fill; c.fillRect(b.x, b.y, b.w, b.h); }
      const iw = fim.naturalWidth, ih = fim.naturalHeight, k = (s.fillFit === 'contain' ? Math.min : Math.max)(b.w / iw, b.h / ih) * (s.fillZoom || 1);
      c.drawImage(fim, b.x + (b.w - iw * k) / 2 + (s.fillX || 0), b.y + (b.h - ih * k) / 2 + (s.fillY || 0), iw * k, ih * k); c.restore(); shapePath(c, s, b);
    } else if (s.fillOn !== false) { c.fillStyle = s.fill; c.fill(); }
    if (s.strokeW > 0 && s.kind !== 'line') { c.lineJoin = 'round'; c.strokeStyle = s.stroke; c.lineWidth = s.strokeW; c.stroke(); }
  }

  /* ---------- desenha o conteúdo de um clipe (já com transformação) ---------- */
  function drawContent(c, clip, st, src, P) {
    const b = matrix(st, P).box;
    if (clip.type === 'text') return drawText(c, clip, b, st.an.chars);
    if (clip.type === 'shape') { if (clip.shape?.livre) return; return drawShape(c, clip.shape, b); }
    if (clip.type === 'color') {
      const col = clip.colorFill || { c1: '#000', mode: 'solid' };
      if (col.mode === 'pattern' && typeof PatternBG !== 'undefined') return PatternBG.draw(c, col, b, Math.max(0, (st.lt ?? 0)));
      if (col.mode === 'gradient') { const a = (col.angle || 0) * Math.PI / 180, r = Math.hypot(b.w, b.h) / 2, cx = b.x + b.w / 2, cy = b.y + b.h / 2; const g = c.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.addColorStop(0, col.c1); g.addColorStop(1, col.c2 || '#fff'); c.fillStyle = g; }
      else c.fillStyle = col.c1;
      c.fillRect(b.x, b.y, b.w, b.h); return;
    }
    if (!src) return;
    if (!src.el) { c.fillStyle = '#1b1d22'; c.fillRect(b.x, b.y, b.w, b.h); return; }
    const cr = clip.crop || { l: 0, t: 0, r: 0, b: 0 };
    const IW = src.iw || src.w, IH = src.ih || src.h, sx = IW * cr.l / 100, sy = IH * cr.t / 100, sw = IW * (1 - (cr.l + cr.r) / 100), sh = IH * (1 - (cr.t + cr.b) / 100);
    if (sw <= 0 || sh <= 0) return;
    if (clip.badge?.on && typeof Badge !== 'undefined') return Badge.draw(c, src.el, { sx, sy, sw, sh }, b, clip.badge);
    try { c.drawImage(src.el, sx, sy, sw, sh, b.x, b.y, b.w, b.h); } catch { }
    // corpo "continua" para baixo da tela: estica a última linha do recorte (não aparece o corte vazio quando pula/troca de pose)
    if (clip.extend && cr.b > 0) { const rows = Math.max(1, Math.min(3, sh * .004)), ext = Math.max(P.H, P.W) * .9; try { c.drawImage(src.el, sx, sy + sh - rows, sw, rows, b.x, b.y + b.h - .5, b.w, ext); } catch { } }
  }

  /* ---------- um clipe visual ---------- */
  function drawClip(dst, clip, t, P, opt, depth = 0) {
    const lt = t - clip.start;
    if (clip.vis && typeof Vis !== 'undefined' && !Vis.show(clip, t)) return;
    const src = (clip.type === 'image' || clip.type === 'gif' || clip.type === 'video' || clip.type === 'anim') ? sourceOf(clip, lt, opt) : null;
    const st = state(clip, lt, P, src);
    const op = clamp(st.tr.opacity / 100 * st.an.op, 0, 1);
    if (op <= 0.001) return;
    const col = colorFilter(clip, lt);
    const q = opt.q, W = dst.canvas.width, H = dst.canvas.height;
    let filt = col.filter; if (col.blur) filt = (filt === 'none' ? '' : filt + ' ') + `blur(${col.blur * q}px)`;

    const fxActive = (clip.fx || []).filter(f => f.on !== false && lt >= f.start && lt <= f.start + f.dur && FX[f.type]);
    let trans = null;
    if (clip.trIn && clip.trIn.type && lt < clip.trIn.dur && TRANS[clip.trIn.type]) trans = { tr: clip.trIn, v: (Ease[clip.trIn.params?.ease || 'inOut'] || Ease.inOut)(clamp(lt / clip.trIn.dur, 0, 1)) };
    else if (clip.trOut && clip.trOut.type && lt > clip.dur - clip.trOut.dur && TRANS[clip.trOut.type]) trans = { tr: clip.trOut, v: (Ease[clip.trOut.params?.ease || 'inOut'] || Ease.inOut)(clamp((clip.dur - lt) / clip.trOut.dur, 0, 1)) };
    const needLayer = fxActive.length || trans || (col.tint && col.tintAmt > 0);

    const { m: m0, box } = worldMatrix(clip, st, P, t), m = opt.cam ? opt.cam.multiply(m0) : m0;
    let bounds = null;
    if (fxActive.length) { const pts = [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h]].map(([a, b]) => m.transformPoint(new DOMPoint(a, b))); const vp = opt.view ? pts.map(p => opt.view.transformPoint(p)) : pts.map(p => ({ x: (p.x + (opt.pad || 0)) * q, y: (p.y + (opt.pad || 0)) * q })); const xs = vp.map(p => p.x), ys = vp.map(p => p.y); bounds = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; if (clip.crop) { const cb = clip.crop; /* o recorte já está no box */ } }
    const target = needLayer ? layer(depth, W, H).getContext('2d') : dst;
    target.save();
    target.imageSmoothingEnabled = true; target.imageSmoothingQuality = 'high';
    const pd = opt.pad || 0; if (opt.view) target.setTransform(opt.view.multiply(m)); else target.setTransform(m.a * q, m.b * q, m.c * q, m.d * q, (m.e + pd) * q, (m.f + pd) * q);
    if (!needLayer) { target.globalAlpha = op; target.globalCompositeOperation = clip.tr.blend || 'source-over'; }
    if (filt !== 'none' && filt) target.filter = filt;
    drawContent(target, clip, st, src, P);
    target.restore();
    if (!needLayer) return;

    const lc = target.canvas;
    if (col.tint && col.tintAmt > 0) { target.save(); target.setTransform(1, 0, 0, 1, 0, 0); target.globalCompositeOperation = 'source-atop'; target.globalAlpha = col.tintAmt / 100; target.fillStyle = col.tint; target.fillRect(0, 0, W, H); target.restore(); }
    applyFxList(target, lc, fxActive.map(f => ({ inst: f, lt: lt - f.start })), P, opt, t, bounds);
    dst.save(); dst.setTransform(1, 0, 0, 1, 0, 0); dst.globalAlpha = op; dst.globalCompositeOperation = clip.tr.blend || 'source-over';
    if (trans) TRANS[trans.tr.type].draw(dst, lc, clamp(trans.v, 0, 1), trans.tr.params || {}, { q, t, tmp, copy, W: P.W, H: P.H });
    else dst.drawImage(lc, 0, 0);
    dst.restore();
  }

  function applyFxList(c, cv, list, P, opt, t, bounds) {
    for (const { inst, lt } of list) {
      const def = FX[inst.type]; if (!def) continue;
      const p = clamp(lt / Math.max(.001, inst.dur), 0, 1);
      let k = (inst.amount ?? 100) / 100;
      const fade = inst.fade || 0;
      if (fade > 0) k *= Math.min(1, lt / fade, (inst.dur - lt) / fade);
      k = clamp(k, 0, 1); if (k <= 0) continue;
      const orig = k < 1 ? copy(cv, 'fxorig') : null;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      try { def.apply(c, cv, inst.params || {}, { t: lt, p, dur: inst.dur, q: opt.q, W: cv.width, H: cv.height, tmp, copy, bounds }); } catch (e) { console.warn('efeito', inst.type, e); }
      c.restore();
      if (orig) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1 - k; c.drawImage(orig, 0, 0); c.restore(); }
    }
  }

  let _chk = null, _chkD = null;
  function checkerPat(c, dark) { const key = dark ? '_chkD' : '_chk'; let p = dark ? _chkD : _chk; if (p) return p; const t = document.createElement('canvas'); t.width = t.height = 32; const g = t.getContext('2d'); g.fillStyle = dark ? '#2e2e32' : '#5c5c62'; g.fillRect(0, 0, 32, 32); g.fillStyle = dark ? '#36363b' : '#6b6b72'; g.fillRect(0, 0, 16, 16); g.fillRect(16, 16, 16, 16); p = c.createPattern(t, 'repeat'); if (dark) _chkD = p; else _chk = p; return p; }
  /* ---------- câmera do projeto (posição, zoom e giro com keyframes, como no Harmony) ---------- */
  function camAt(project, t) { const k = project.camera?.keys; if (!k || typeof AnimMath === 'undefined') return { X: 0, Y: 0, Z: 1, R: 0 }; return { X: AnimMath.value(k.X, t, 0), Y: AnimMath.value(k.Y, t, 0), Z: AnimMath.value(k.Z, t, 1), R: AnimMath.value(k.R, t, 0) }; }
  function camMatrix(project, t) {
    const c = camAt(project, t); if (!c.X && !c.Y && c.Z === 1 && !c.R) return null;
    const W = project.settings.w, H = project.settings.h; return new DOMMatrix().translateSelf(W / 2, H / 2).scaleSelf(c.Z, c.Z).rotateSelf(c.R).translateSelf(-W / 2 - c.X, -H / 2 - c.Y);
  }
  /* ---------- quadro completo ---------- */
  function render(canvas, project, t, opt = {}) {
    const P = { W: project.settings.w, H: project.settings.h }; curProject = project;
    const q = opt.q || 1, pad = opt.pad || 0, W = opt.view ? opt.viewW : Math.max(1, Math.round((P.W + 2 * pad) * q)), H = opt.view ? opt.viewH : Math.max(1, Math.round((P.H + 2 * pad) * q)); // view = espaço infinito (só na prévia do editor)
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const c = canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    const chk = opt.checker && project.settings.bg === 'transparent'; // fora da câmera = cinza quadriculado; dentro = cor do fundo (branco padrão)
    const fillBg = (w, h) => { if (chk) { c.fillStyle = checkerPat(c); c.fillRect(0, 0, w, h); } else { c.fillStyle = project.settings.bg || '#ffffff'; c.fillRect(0, 0, w, h); } };
    if (opt.view) { c.fillStyle = checkerPat(c, true); c.fillRect(0, 0, W, H); c.save(); c.setTransform(opt.view); fillBg(P.W, P.H); c.restore(); }
    else fillBg(W, H);
    opt = { ...opt, q, fps: project.settings.fps, cam: opt.noCam ? null : camMatrix(project, t) };
    const tracks = project.tracks;
    const solo = tracks.some(tk => tk.solo && tk.type !== 'audio');
    let pending = null; // camada de uma faixa aguardando efeito "só a faixa abaixo"
    for (let i = tracks.length - 1; i >= 0; i--) {
      const tk = tracks[i];
      if (tk.type === 'audio' || tk.hidden || (solo && !tk.solo && tk.type !== 'fx') || (opt.noFx && tk.type === 'fx')) continue;
      const clips = project.clips.filter(cl => cl.trackId === tk.id);
      if (tk.type === 'visual') {
        // essa faixa precisa de camada separada? (efeito acima com alvo "só a faixa abaixo")
        const above = tracks[i - 1];
        const needSep = above && above.type === 'fx' && !above.hidden && project.clips.some(cl => cl.trackId === above.id && cl.sfx && cl.sfx.target === 'next' && t >= cl.start && t < cl.start + cl.dur);
        const dst = needSep ? (() => { const l = layer(9, W, H); return l.getContext('2d'); })() : c;
        const act = clips.filter(cl => !cl.hidden && t >= cl.start && t < cl.start + cl.dur).sort((a, b) => a.start - b.start);
        for (const cl of act) {
          if (cl.trIn && cl.trIn.type && t - cl.start < cl.trIn.dur) {
            const prev = clips.find(o => o !== cl && Math.abs(o.start + o.dur - cl.start) < 1.5 / project.settings.fps);
            if (prev && !act.includes(prev)) drawClip(dst, prev, prev.start + prev.dur - 1e-3, P, opt, 1);
          }
          drawClip(dst, cl, t, P, opt, 0);
        }
        if (needSep) pending = dst;
      } else if (tk.type === 'fx') {
        const act = clips.filter(cl => t >= cl.start && t < cl.start + cl.dur && cl.sfx);
        for (const cl of act) {
          const inst = { ...cl.sfx, start: 0, dur: cl.dur };
          if (cl.sfx.target === 'next') { if (pending) applyFxList(pending, pending.canvas, [{ inst, lt: t - cl.start }], P, opt, t); }
          else applyFxList(c, canvas, [{ inst, lt: t - cl.start }], P, opt, t);
        }
        if (pending) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(pending.canvas, 0, 0); c.restore(); pending = null; }
      }
      if (pending && tk.type !== 'visual') { c.drawImage(pending.canvas, 0, 0); pending = null; }
    }
    if (pending) { c.drawImage(pending.canvas, 0, 0); }
  }

  // espera os vídeos chegarem no quadro certo (exportação quadro a quadro)
  async function prepare(project, t) {
    const waits = [];
    for (const cl of project.clips) {
      if (cl.type !== 'video' || t < cl.start || t >= cl.start + cl.dur) continue;
      const tk = project.tracks.find(k => k.id === cl.trackId); if (!tk || tk.hidden) continue;
      const e = VideoPool.get(cl); if (!e) continue;
      const v = e.v; v.pause();
      if (v.readyState < 1) await new Promise(r => { v.addEventListener('loadeddata', r, { once: true }); setTimeout(r, 4000); });
      const st = clamp((cl.offset || 0) + (t - cl.start) * (cl.speed || 1), 0, Math.max(0, v.duration - .03));
      if (Math.abs(v.currentTime - st) > 1e-3 || v.readyState < 2) {
        waits.push(new Promise(r => { const done = () => { v.removeEventListener('seeked', done); r(); }; v.addEventListener('seeked', done); v.currentTime = st; setTimeout(done, 3000); }));
      }
    }
    await Promise.all(waits);
  }

  function geom(project, clip, t) {
    const P = { W: project.settings.w, H: project.settings.h }, lt = t - clip.start;
    let src = null;
    if (['image', 'gif', 'video', 'anim'].includes(clip.type)) src = srcSize(clip);
    const st = state(clip, lt, P, src); curProject = project;
    return { ...worldMatrix(clip, st, P, t), st };
  }

  return { render, camAt, camMatrix, prepare, geom, state, tmp, copy, textSize, shapePath, drawContent, contentSize, worldMatrix, restMatrix, matrix };
})();
