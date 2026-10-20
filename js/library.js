/* ===================== library.js — animações, efeitos, transições, sons, modelos ===================== */
'use strict';

const TEMPLATES = [
  { id: 'yt1080', name: 'YouTube', sub: '1920×1080 · 16:9 · 30fps', w: 1920, h: 1080, fps: 30 },
  { id: 'yt1080-60', name: 'YouTube 60fps', sub: '1920×1080 · 16:9 · 60fps', w: 1920, h: 1080, fps: 60 },
  { id: 'yt720', name: 'YouTube 720p', sub: '1280×720 · 16:9 · 30fps', w: 1280, h: 720, fps: 30 },
  { id: 'yt4k', name: 'YouTube 4K', sub: '3840×2160 · 16:9 · 30fps', w: 3840, h: 2160, fps: 30 },
  { id: 'shorts', name: 'Shorts / TikTok / Reels', sub: '1080×1920 · 9:16 · 30fps', w: 1080, h: 1920, fps: 30 },
  { id: 'ig11', name: 'Instagram quadrado', sub: '1080×1080 · 1:1 · 30fps', w: 1080, h: 1080, fps: 30 },
  { id: 'ig45', name: 'Instagram retrato', sub: '1080×1350 · 4:5 · 30fps', w: 1080, h: 1350, fps: 30 },
  { id: 'gif', name: 'GIF / Figurinha', sub: '512×512 · 1:1 · 15fps', w: 512, h: 512, fps: 15 },
  { id: 'cine', name: 'Cinema 21:9', sub: '2560×1080 · 21:9 · 24fps', w: 2560, h: 1080, fps: 24 },
];

const FONTS = ['Bangers', 'Luckiest Guy', 'Fredoka', 'Poppins', 'Bebas Neue', 'Montserrat', 'Permanent Marker', 'Press Start 2P', 'Arial', 'Impact', 'Comic Sans MS', 'Georgia', 'Verdana', 'Trebuchet MS', 'Courier New', 'Times New Roman'];

const COLOR_PRESETS = {
  normal: { name: 'Normal', v: { brightness: 100, contrast: 100, saturation: 100, hue: 0, grayscale: 0, sepia: 0, invert: 0, blur: 0, tintAmt: 0 } },
  pb: { name: 'Preto e branco', v: { grayscale: 100 } },
  noir: { name: 'Noir', v: { grayscale: 100, contrast: 160, brightness: 90 } },
  sepia: { name: 'Sépia', v: { sepia: 100 } },
  vintage: { name: 'Vintage', v: { sepia: 45, contrast: 90, saturation: 80, brightness: 105 } },
  quente: { name: 'Quente', v: { tint: '#ff8a2a', tintAmt: 18, saturation: 115 } },
  frio: { name: 'Frio', v: { tint: '#2a8cff', tintAmt: 18, saturation: 95 } },
  vivo: { name: 'Saturado', v: { saturation: 175, contrast: 110 } },
  lavado: { name: 'Dessaturado', v: { saturation: 45 } },
  escuro: { name: 'Escuro', v: { brightness: 60, contrast: 115 } },
  sonho: { name: 'Sonho', v: { brightness: 115, contrast: 85, saturation: 80, blur: 1.5 } },
  inverter: { name: 'Invertido', v: { invert: 100 } },
};
const COLOR_DEFAULT = () => clone(COLOR_PRESETS.normal.v);
const COLOR_PROPS = [
  { k: 'brightness', l: 'Brilho', min: 0, max: 200, def: 100, unit: '%' },
  { k: 'contrast', l: 'Contraste', min: 0, max: 200, def: 100, unit: '%' },
  { k: 'saturation', l: 'Saturação', min: 0, max: 300, def: 100, unit: '%' },
  { k: 'hue', l: 'Matiz', min: -180, max: 180, def: 0, unit: '°' },
  { k: 'grayscale', l: 'Preto e branco', min: 0, max: 100, def: 0, unit: '%' },
  { k: 'sepia', l: 'Sépia', min: 0, max: 100, def: 0, unit: '%' },
  { k: 'invert', l: 'Inverter', min: 0, max: 100, def: 0, unit: '%' },
  { k: 'blur', l: 'Desfoque', min: 0, max: 40, def: 0, step: .5, unit: 'px' },
  { k: 'tintAmt', l: 'Intensidade da cor', min: 0, max: 100, def: 0, unit: '%' },
];

const SHAPES = {
  rect: 'Retângulo', round: 'Arredondado', circle: 'Círculo', triangle: 'Triângulo', star: 'Estrela', hexagon: 'Hexágono',
  arrow: 'Seta', bubble: 'Balão de fala', think: 'Balão de pensamento', heart: 'Coração', burst: 'Explosão (POW)', line: 'Linha',
};

/* ================= SONS SINTETIZADOS (pré-prontos) ================= */
const SOUNDS = (() => {
  const SR = 44100;
  const env = (i, n, a, r) => { const t = i / n; return Math.min(1, t / Math.max(a, 1e-4)) * Math.pow(1 - t, r); };
  const noise = () => Math.random() * 2 - 1;
  const mk = (sec, f) => { const n = Math.floor(sec * SR), d = new Float32Array(n); f(d, n); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < n; i++) d[i] = d[i] / m * .85; return d; };
  const lp = (d, a) => { let y = 0; for (let i = 0; i < d.length; i++) { y += a * (d[i] - y); d[i] = y; } return d; };
  const defs = {
    boing: { name: 'Boing (pulo)', sec: .55, f: (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, fr = 180 + 380 * Math.min(1, t / .12) + 60 * Math.sin(t * 60) * Math.exp(-t * 4); ph += 2 * Math.PI * fr / SR; d[i] = Math.sin(ph) * env(i, n, .01, 2); } } },
    boing2: { name: 'Mola', sec: .7, f: (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, fr = 300 + 140 * Math.sin(t * 42); ph += 2 * Math.PI * fr / SR; d[i] = Math.sin(ph) * env(i, n, .005, 1.6); } } },
    pop: { name: 'Pop', sec: .12, f: (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, fr = 380 + 2400 * t / .12; ph += 2 * Math.PI * fr / SR; d[i] = Math.sin(ph) * env(i, n, .02, 3); } } },
    pop2: { name: 'Plop (sumir)', sec: .14, f: (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, fr = 1400 - 1100 * t / .14; ph += 2 * Math.PI * fr / SR; d[i] = Math.sin(ph) * env(i, n, .02, 2.5); } } },
    whoosh: { name: 'Whoosh', sec: .55, f: (d, n) => { let y = 0, y2 = 0; for (let i = 0; i < n; i++) { const t = i / n, a = .02 + .25 * Math.sin(Math.PI * t); y += a * (noise() - y); y2 += a * (y - y2); d[i] = (y - y2 * .6) * Math.sin(Math.PI * t) ** 2; } } },
    swoosh: { name: 'Swoosh curto', sec: .28, f: (d, n) => { let y = 0; for (let i = 0; i < n; i++) { const t = i / n, a = .05 + .4 * t; y += a * (noise() - y); d[i] = y * Math.sin(Math.PI * t); } } },
    static: { name: 'TV chiando', sec: 1.5, loop: true, f: (d, n) => { for (let i = 0; i < n; i++) d[i] = noise() * (.6 + .4 * Math.random()) * (Math.random() < .002 ? 2 : 1); lp(d, .7); } },
    glitch: { name: 'Glitch', sec: .5, f: (d, n) => { let i = 0; while (i < n) { const len = Math.floor(SR * (.01 + Math.random() * .05)), type = Math.random(), fr = 80 + Math.random() * 1600; for (let k = 0; k < len && i < n; k++, i++) { const t = i / SR; d[i] = type < .4 ? Math.sign(Math.sin(2 * Math.PI * fr * t)) * .6 : type < .7 ? Math.round(noise() * 3) / 3 : type < .85 ? 0 : Math.sin(2 * Math.PI * fr * t); } } } },
    thud: { name: 'Baque', sec: .4, f: (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, fr = 110 * Math.exp(-t * 6) + 40; ph += 2 * Math.PI * fr / SR; d[i] = Math.sin(ph) * Math.exp(-t * 9) + noise() * Math.exp(-t * 60) * .4; } } },
    bonk: { name: 'Bonk', sec: .35, f: (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(2 * Math.PI * 820 * t) * .7 + Math.sin(2 * Math.PI * 1310 * t) * .3) * Math.exp(-t * 18) + Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 12) * .6; } } },
    ding: { name: 'Ding', sec: 1.2, f: (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(2 * Math.PI * 1320 * t) + .4 * Math.sin(2 * Math.PI * 2640 * t) + .2 * Math.sin(2 * Math.PI * 3960 * t)) * Math.exp(-t * 4) * Math.min(1, t * 400); } } },
    correct: { name: 'Acertou', sec: .6, f: (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR, fr = t < .15 ? 880 : 1320; d[i] = Math.sin(2 * Math.PI * fr * t) * Math.exp(-((t < .15 ? t : t - .15)) * 7); } } },
    wrong: { name: 'Errou (buzina)', sec: .6, f: (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sign(Math.sin(2 * Math.PI * 150 * t)) * .5 + Math.sign(Math.sin(2 * Math.PI * 156 * t)) * .5) * env(i, n, .02, .4); } lp(d, .35); } },
    rumble: { name: 'Tremor', sec: 1.5, loop: true, f: (d, n) => { let y = 0; for (let i = 0; i < n; i++) { y += .015 * (noise() - y); d[i] = y * (1 + .5 * Math.sin(i / SR * 30)); } } },
    hit: { name: 'Soco', sec: .3, f: (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (90 * Math.exp(-t * 10) + 50) / SR; d[i] = Math.sin(ph) * Math.exp(-t * 14) + noise() * Math.exp(-t * 35) * .7; } } },
    shutter: { name: 'Câmera (flash)', sec: .25, f: (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = noise() * (Math.exp(-t * 90) + (t > .09 ? Math.exp(-(t - .09) * 70) * .8 : 0)); } } },
    sting: { name: 'Susto!', sec: 1.1, f: (d, n) => { const fs = [233, 247, 311, 466, 494]; for (let i = 0; i < n; i++) { const t = i / SR; let s = 0; fs.forEach(f => s += ((t * f) % 1) * 2 - 1); d[i] = s * Math.min(1, t * 80) * Math.exp(-t * 2.5); } lp(d, .4); } },
    fall: { name: 'Queda (assobio)', sec: 1, f: (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / n; ph += 2 * Math.PI * (1500 - 1100 * t) / SR; d[i] = Math.sin(ph) * env(i, n, .05, .3); } } },
    step: { name: 'Passo', sec: .12, f: (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (noise() * .5 + Math.sin(2 * Math.PI * 120 * t)) * Math.exp(-t * 45); } lp(d, .25); } },
    type: { name: 'Tecla', sec: .05, f: (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = noise() * Math.exp(-t * 160) + Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t * 120) * .5; } } },
    tvoff: { name: 'TV desligando', sec: .7, f: (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (2000 * Math.exp(-t * 6) + 60) / SR; d[i] = Math.sin(ph) * Math.exp(-t * 5) * .6 + noise() * Math.exp(-t * 9) * .4; } } },
    crickets: { name: 'Grilos (silêncio)', sec: 2.5, loop: true, f: (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR, cyc = t % .8, on = cyc < .25 && (Math.floor(cyc * 40) % 2 === 0); d[i] = on ? Math.sin(2 * Math.PI * 4400 * t) * .5 : 0; } lp(d, .5); } },
    rimshot: { name: 'Ba-dum-tss', sec: 1.3, f: (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; let s = 0; s += Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 18); if (t > .18) s += Math.sin(2 * Math.PI * 120 * (t - .18)) * Math.exp(-(t - .18) * 14); if (t > .42) s += noise() * Math.exp(-(t - .42) * 4) * .6; d[i] = s; } } },
    explosion: { name: 'Explosão', sec: 1.8, f: (d, n) => { let y = 0; for (let i = 0; i < n; i++) { const t = i / SR; y += (.05 + .3 * Math.exp(-t * 4)) * (noise() - y); d[i] = y * Math.exp(-t * 2.2) * Math.min(1, t * 200); } } },
    magic: { name: 'Mágica (brilho)', sec: 1, f: (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; let s = 0; for (let k = 0; k < 6; k++) { const st = k * .08; if (t > st) s += Math.sin(2 * Math.PI * (1200 + k * 260) * t) * Math.exp(-(t - st) * 8); } d[i] = s; } } },
    slip: { name: 'Escorregar', sec: .5, f: (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / n; ph += 2 * Math.PI * (300 + 1500 * t) / SR; d[i] = Math.sin(ph) * env(i, n, .02, .6); } } },
    heart: { name: 'Batimento', sec: .8, f: (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; const b = (x) => x > 0 ? Math.sin(2 * Math.PI * 55 * x) * Math.exp(-x * 25) : 0; d[i] = b(t) + b(t - .22) * .8; } } },
  };
  const cache = {};
  function data(id) { if (!defs[id]) return null; if (!cache[id]) cache[id] = mk(defs[id].sec, defs[id].f); return cache[id]; }
  const bufCache = new WeakMap();
  function buffer(ctx, id) {
    let m = bufCache.get(ctx); if (!m) bufCache.set(ctx, m = {});
    if (m[id]) return m[id];
    const d = data(id); if (!d) return null;
    const b = ctx.createBuffer(1, d.length, SR); b.copyToChannel(d, 0); return m[id] = b;
  }
  return { defs, data, buffer, SR, list: () => Object.entries(defs).map(([id, v]) => ({ id, name: v.name, sec: v.sec, loop: !!v.loop })) };
})();

/* ================= ANIMAÇÕES (movimento: pulinho, tremer...) ================= */
// fn(p, P, x) -> { dx, dy, sx, sy, rot, op, chars, pivot }
const DIR_OPTS = { left: 'Esquerda', right: 'Direita', up: 'Cima', down: 'Baixo' };
const KEEP = { k: 'keep', l: 'Ficar no lugar final', type: 'bool', def: true };
const ANIMS = {
  jump: {
    name: 'Pulinho', cat: 'Movimento', dur: .45, sound: 'boing', hint: 'Pula e volta. Ajuste altura e quantos pulos.',
    params: [{ k: 'height', l: 'Altura do pulo', min: 0, max: 800, def: 90, unit: 'px' }, { k: 'count', l: 'Quantidade de pulos', min: 1, max: 30, step: 1, def: 1 }, { k: 'squash', l: 'Amassar ao cair', min: 0, max: 1, step: .05, def: .35 }],
    soundTimes: (P, d) => Array.from({ length: Math.round(P.count) }, (_, i) => i * d / Math.round(P.count)),
    fn(p, P) {
      const n = Math.max(1, Math.round(P.count)), q = Math.min(.9999, p * n) % 1;
      const s = q < .15 ? 1 - q / .15 : q > .85 ? (q - .85) / .15 : 0;
      return { dy: -P.height * 4 * q * (1 - q), sy: 1 - P.squash * .45 * s + P.squash * .12 * (1 - s), sx: 1 + P.squash * .35 * s - P.squash * .06 * (1 - s), pivot: 'bottom' };
    }
  },
  walk: {
    name: 'Andar pulando', cat: 'Movimento', dur: 1.6, sound: 'step', hint: 'Anda para o lado dando pulinhos (estilo animação de imagem parada).',
    params: [{ k: 'dist', l: 'Distância', min: -4000, max: 4000, def: 400, unit: 'px' }, { k: 'count', l: 'Passos', min: 1, max: 40, step: 1, def: 6 }, { k: 'height', l: 'Altura dos passos', min: 0, max: 300, def: 25, unit: 'px' }, { k: 'tilt', l: 'Inclinação', min: 0, max: 45, def: 6, unit: '°' }, KEEP],
    soundTimes: (P, d) => Array.from({ length: Math.round(P.count) }, (_, i) => (i + 1) * d / Math.round(P.count) - .02),
    fn(p, P) { const n = Math.max(1, Math.round(P.count)), q = Math.min(.9999, p * n) % 1, i = Math.floor(Math.min(.9999, p) * n); return { dx: P.dist * p, dy: -P.height * 4 * q * (1 - q), rot: (i % 2 ? -1 : 1) * P.tilt * Math.sin(Math.PI * q), pivot: 'bottom' }; },
    final: P => ({ dx: P.dist })
  },
  run: {
    name: 'Correr', cat: 'Movimento', dur: 1, sound: 'swoosh', hint: 'Atravessa rápido com passos curtos e inclinado para frente.',
    params: [{ k: 'dist', l: 'Distância', min: -4000, max: 4000, def: 900, unit: 'px' }, { k: 'count', l: 'Passos', min: 1, max: 60, step: 1, def: 12 }, { k: 'height', l: 'Altura dos passos', min: 0, max: 200, def: 14, unit: 'px' }, { k: 'lean', l: 'Inclinar', min: 0, max: 40, def: 12, unit: '°' }, KEEP],
    fn(p, P) { const n = Math.max(1, Math.round(P.count)), q = Math.min(.9999, p * n) % 1; return { dx: P.dist * Ease.inOut(p), dy: -P.height * 4 * q * (1 - q), rot: Math.sign(P.dist || 1) * P.lean * Math.sin(Math.PI * p), pivot: 'bottom' }; },
    final: P => ({ dx: P.dist })
  },
  shake: {
    name: 'Tremer', cat: 'Movimento', dur: .6, sound: 'rumble', soundDefault: 'off', hint: 'Treme de nervoso/raiva.',
    params: [{ k: 'amp', l: 'Intensidade', min: 0, max: 200, def: 14, unit: 'px' }, { k: 'speed', l: 'Velocidade', min: 1, max: 60, def: 28 }, { k: 'rot', l: 'Girar junto', min: 0, max: 30, def: 2, unit: '°' }],
    fn(p, P, x) { const t = x.t * P.speed, f = Math.sin(Math.PI * p) ** .3; return { dx: (hash(Math.floor(t)) * 2 - 1) * P.amp * f, dy: (hash(Math.floor(t) + 99) * 2 - 1) * P.amp * f * .6, rot: (hash(Math.floor(t) + 7) * 2 - 1) * P.rot * f }; }
  },
  scared: {
    name: 'Tremer de medo', cat: 'Movimento', dur: 1.5, sound: 'rumble', soundDefault: 'off', base: 'shake',
    params: [{ k: 'amp', l: 'Intensidade', min: 0, max: 200, def: 4, unit: 'px' }, { k: 'speed', l: 'Velocidade', min: 1, max: 60, def: 40 }, { k: 'rot', l: 'Girar junto', min: 0, max: 30, def: 1, unit: '°' }]
  },
  wobble: {
    name: 'Balançar', cat: 'Movimento', dur: 1.2, sound: 'boing2', soundDefault: 'off', hint: 'Balança de um lado pro outro.',
    params: [{ k: 'angle', l: 'Ângulo', min: 0, max: 90, def: 12, unit: '°' }, { k: 'count', l: 'Balanços', min: .5, max: 20, step: .5, def: 2 }, { k: 'fade', l: 'Diminuir no fim', type: 'bool', def: true }],
    fn(p, P) { return { rot: P.angle * Math.sin(p * P.count * 2 * Math.PI) * (P.fade ? 1 - p : 1), pivot: 'bottom' }; }
  },
  nodYes: { name: 'Sim (cabeça)', cat: 'Movimento', dur: .7, sound: '', hint: 'Movimento de concordar.', params: [{ k: 'amp', l: 'Intensidade', min: 0, max: 100, def: 14, unit: 'px' }, { k: 'count', l: 'Vezes', min: 1, max: 10, step: 1, def: 2 }], fn(p, P) { return { dy: P.amp * Math.abs(Math.sin(p * P.count * Math.PI)), sy: 1 - .04 * Math.abs(Math.sin(p * P.count * Math.PI)), pivot: 'bottom' }; } },
  nodNo: { name: 'Não (cabeça)', cat: 'Movimento', dur: .8, sound: '', hint: 'Movimento de negar.', params: [{ k: 'amp', l: 'Intensidade', min: 0, max: 100, def: 18, unit: 'px' }, { k: 'count', l: 'Vezes', min: 1, max: 10, step: 1, def: 3 }], fn(p, P) { return { dx: P.amp * Math.sin(p * P.count * 2 * Math.PI) * (1 - p * .5) }; } },
  talk: {
    name: 'Falando', cat: 'Movimento', dur: 2, sound: '', hint: 'Pulinhos curtos e rápidos enquanto o personagem fala.',
    params: [{ k: 'amp', l: 'Intensidade', min: 0, max: .5, step: .01, def: .025 }, { k: 'speed', l: 'Velocidade', min: 1, max: 30, def: 7 }],
    fn(p, P, x) { const w = Math.abs(Math.sin(x.t * P.speed * Math.PI)) * (.6 + .4 * hash(Math.floor(x.t * P.speed))); return { sy: 1 + P.amp * w, sx: 1 - P.amp * .4 * w, pivot: 'bottom' }; }
  },
  float: { name: 'Flutuar', cat: 'Movimento', dur: 3, sound: '', params: [{ k: 'amp', l: 'Altura', min: 0, max: 300, def: 20, unit: 'px' }, { k: 'speed', l: 'Ciclos', min: .5, max: 20, step: .5, def: 1.5 }, { k: 'rot', l: 'Inclinar', min: 0, max: 30, def: 3, unit: '°' }], fn(p, P) { return { dy: -P.amp * Math.sin(p * P.speed * 2 * Math.PI), rot: P.rot * Math.sin(p * P.speed * 2 * Math.PI + 1) }; } },
  pulse: { name: 'Pulsar', cat: 'Escala', dur: .6, sound: 'pop', soundDefault: 'off', params: [{ k: 'amount', l: 'Quanto cresce', min: 0, max: 2, step: .01, def: .15 }, { k: 'count', l: 'Vezes', min: 1, max: 20, step: 1, def: 1 }], fn(p, P) { const v = 1 + P.amount * Math.sin(Math.PI * ((p * P.count) % 1)); return { sx: v, sy: v }; } },
  heartbeat: { name: 'Batimento', cat: 'Escala', dur: 1, sound: 'heart', params: [{ k: 'amount', l: 'Força', min: 0, max: 1, step: .01, def: .12 }, { k: 'count', l: 'Batidas', min: 1, max: 20, step: 1, def: 1 }], fn(p, P) { const q = (p * P.count) % 1, b = x => x > 0 && x < .2 ? Math.sin(Math.PI * x / .2) : 0, v = 1 + P.amount * (b(q) + .7 * b(q - .25)); return { sx: v, sy: v }; } },
  squash: { name: 'Esticar e amassar', cat: 'Escala', dur: .6, sound: 'boing2', params: [{ k: 'amount', l: 'Força', min: 0, max: 1, step: .01, def: .25 }, { k: 'count', l: 'Vezes', min: 1, max: 20, step: 1, def: 1 }], fn(p, P) { const v = Math.sin(p * P.count * 2 * Math.PI) * (1 - p) * P.amount; return { sx: 1 - v, sy: 1 + v, pivot: 'bottom' }; } },
  grow: { name: 'Crescer', cat: 'Escala', dur: .6, sound: 'magic', soundDefault: 'off', params: [{ k: 'to', l: 'Tamanho final', min: 0, max: 5, step: .05, def: 1.5, unit: 'x' }, { k: 'ease', l: 'Movimento', type: 'ease', def: 'back' }, KEEP], fn(p, P) { const v = lerp(1, P.to, Ease[P.ease || 'out'](p)); return { sx: v, sy: v }; }, final: P => ({ sx: P.to, sy: P.to }) },
  zoomPunch: { name: 'Impacto (zoom)', cat: 'Escala', dur: .35, sound: 'bonk', params: [{ k: 'amount', l: 'Força', min: 0, max: 2, step: .01, def: .3 }], fn(p, P) { const v = 1 + P.amount * (p < .3 ? Ease.out(p / .3) : 1 - Ease.inOut((p - .3) / .7)); return { sx: v, sy: v }; } },
  popIn: { name: 'Aparecer (pop)', cat: 'Entrada', dur: .35, sound: 'pop', hold: 'before', params: [{ k: 'ease', l: 'Movimento', type: 'ease', def: 'back' }], fn(p, P) { const v = Math.max(0, Ease[P.ease || 'back'](p)); return { sx: v, sy: v, op: Math.min(1, p * 4) }; } },
  fadeIn: { name: 'Aparecer suave', cat: 'Entrada', dur: .5, sound: '', hold: 'before', params: [], fn(p) { return { op: Ease.inOut(p) }; } },
  slideIn: { name: 'Entrar deslizando', cat: 'Entrada', dur: .5, sound: 'whoosh', hold: 'before', params: [{ k: 'dir', l: 'Vem da', type: 'select', opts: DIR_OPTS, def: 'left' }, { k: 'ease', l: 'Movimento', type: 'ease', def: 'out' }], fn(p, P, x) { const e = 1 - Ease[P.ease || 'out'](p), d = { left: [-x.W, 0], right: [x.W, 0], up: [0, -x.H], down: [0, x.H] }[P.dir]; return { dx: d[0] * e, dy: d[1] * e }; } },
  dropIn: { name: 'Cair quicando', cat: 'Entrada', dur: .8, sound: 'thud', hold: 'before', soundAt: .36, params: [{ k: 'height', l: 'Altura', min: 0, max: 3000, def: 700, unit: 'px' }], fn(p, P) { return { dy: -P.height * (1 - Ease.bounce(p)) }; } },
  typewriter: { name: 'Máquina de escrever', cat: 'Entrada', dur: 1.5, sound: 'type', onlyText: true, hold: 'before', hint: 'Só para textos: letras aparecem uma a uma.', params: [], soundTimes: (P, d, clip) => { const n = Math.min(80, (clip?.text?.text || '').length || 10); return Array.from({ length: n }, (_, i) => i * d / n); }, fn(p) { return { chars: p }; } },
  popOut: { name: 'Sumir (pop)', cat: 'Saída', dur: .3, sound: 'pop2', hold: 'after', params: [], fn(p) { const v = 1 - Ease.backIn(p); return { sx: Math.max(0, v), sy: Math.max(0, v), op: p > .9 ? 0 : 1 }; } },
  fadeOut: { name: 'Sumir suave', cat: 'Saída', dur: .5, sound: '', hold: 'after', params: [], fn(p) { return { op: 1 - Ease.inOut(p) }; } },
  slideOut: { name: 'Sair deslizando', cat: 'Saída', dur: .5, sound: 'whoosh', hold: 'after', params: [{ k: 'dir', l: 'Sai pela', type: 'select', opts: DIR_OPTS, def: 'right' }, { k: 'ease', l: 'Movimento', type: 'ease', def: 'in' }], fn(p, P, x) { const e = Ease[P.ease || 'in'](p), d = { left: [-x.W, 0], right: [x.W, 0], up: [0, -x.H], down: [0, x.H] }[P.dir]; return { dx: d[0] * e, dy: d[1] * e }; } },
  fallOff: { name: 'Cair da tela', cat: 'Saída', dur: 1, sound: 'fall', hold: 'after', params: [{ k: 'spin', l: 'Girar', min: -720, max: 720, def: 120, unit: '°' }], fn(p, P, x) { return { dy: (x.H * 1.4) * p * p, rot: P.spin * p, dx: -40 * Math.sin(p * 3) }; } },
  rise: { name: 'Subir e sumir', cat: 'Saída', dur: 1, sound: 'magic', hold: 'after', params: [], fn(p, P, x) { return { dy: -x.H * 1.2 * Ease.in(p), op: 1 - p * .3 }; } },
  faint: { name: 'Desmaiar', cat: 'Reação', dur: .8, sound: 'thud', soundAt: .7, hold: 'after', params: [{ k: 'dir', l: 'Cai para', type: 'select', opts: { left: 'Esquerda', right: 'Direita' }, def: 'right' }, KEEP], fn(p, P) { return { rot: (P.dir === 'left' ? -90 : 90) * Ease.bounce(p), pivot: 'bottom' }; }, final: P => ({ rot: P.dir === 'left' ? -90 : 90, pivot: 'bottom' }) },
  scare: { name: 'Susto!', cat: 'Reação', dur: .9, sound: 'sting', params: [{ k: 'height', l: 'Altura do pulo', min: 0, max: 800, def: 160, unit: 'px' }, { k: 'amp', l: 'Tremedeira', min: 0, max: 60, def: 10, unit: 'px' }], fn(p, P, x) { const j = p < .35 ? 4 * (p / .35) * (1 - p / .35) : 0, sh = p > .3 ? (hash(Math.floor(x.t * 40)) * 2 - 1) * P.amp * (1 - p) : 0; return { dy: -P.height * j, dx: sh, sx: 1 + .15 * j, sy: 1 + .25 * j, pivot: 'bottom' }; } },
  dizzy: { name: 'Tonto', cat: 'Reação', dur: 2, sound: '', params: [{ k: 'radius', l: 'Raio', min: 0, max: 300, def: 18, unit: 'px' }, { k: 'count', l: 'Voltas', min: .5, max: 20, step: .5, def: 3 }], fn(p, P) { const a = p * P.count * 2 * Math.PI; return { dx: Math.cos(a) * P.radius, dy: Math.sin(a) * P.radius * .4, rot: Math.sin(a) * 8 }; } },
  spin: { name: 'Girar', cat: 'Reação', dur: .6, sound: 'swoosh', params: [{ k: 'turns', l: 'Voltas', min: -20, max: 20, step: .25, def: 1 }, { k: 'ease', l: 'Movimento', type: 'ease', def: 'inOut' }], fn(p, P) { return { rot: 360 * P.turns * Ease[P.ease || 'inOut'](p) }; } },
  flip: { name: 'Virar (espelhar)', cat: 'Reação', dur: .3, sound: 'swoosh', params: [KEEP], fn(p) { return { sx: Math.cos(Math.PI * p) }; }, final: () => ({ sx: -1 }) },
  blink: { name: 'Piscar', cat: 'Reação', dur: .8, sound: '', params: [{ k: 'count', l: 'Vezes', min: 1, max: 30, step: 1, def: 3 }], fn(p, P) { return { op: Math.floor(p * P.count * 2) % 2 ? 0 : 1 }; } },
  path: {
    name: 'Mover por caminho', cat: 'Caminho', dur: 1.5, sound: 'whoosh', soundDefault: 'off', hint: 'Arraste os pontos amarelos na prévia para desenhar por onde ele passa. Clique duas vezes na prévia para adicionar pontos.',
    params: [{ k: 'ease', l: 'Movimento', type: 'ease', def: 'inOut' }, { k: 'smooth', l: 'Curvas suaves', type: 'bool', def: true }, { k: 'orient', l: 'Girar seguindo o caminho', type: 'bool', def: false }, KEEP],
    defaults: { points: [{ x: 0, y: 0 }, { x: 300, y: -150 }, { x: 600, y: 0 }] },
    fn(p, P) { const r = pathPoint(P.points, Ease[P.ease || 'inOut'](p), P.smooth); const o = { dx: r.x, dy: r.y }; if (P.orient) { const r2 = pathPoint(P.points, Math.min(1, Ease[P.ease || 'inOut'](p) + .01), P.smooth); o.rot = Math.atan2(r2.y - r.y, r2.x - r.x) * 180 / Math.PI; } return o; },
    final: P => { const l = P.points[P.points.length - 1] || { x: 0, y: 0 }; return { dx: l.x, dy: l.y }; }
  },
};
function pathPoint(pts, t, smooth) {
  if (!pts || !pts.length) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];
  // distribui pelo comprimento aproximado
  const seg = []; let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y) || .001; seg.push(l); tot += l; }
  let d = clamp(t, 0, 1) * tot, i = 0;
  while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
  const u = clamp(d / seg[i], 0, 1), p1 = pts[i], p2 = pts[i + 1];
  if (!smooth) return { x: lerp(p1.x, p2.x, u), y: lerp(p1.y, p2.y, u) };
  const p0 = pts[i - 1] || p1, p3 = pts[i + 2] || p2, u2 = u * u, u3 = u2 * u;
  const cr = (a, b, c, d) => .5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  return { x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) };
}
// herda função de outra animação
for (const a of Object.values(ANIMS)) if (a.base) { const b = ANIMS[a.base]; a.fn = b.fn; a.hint = a.hint || b.hint; }

/* ================= EFEITOS (imagem ou tela toda) ================= */
// apply(c, cv, P, x) — c: contexto da camada, x: { t, p, q (escala de qualidade), W, H, tmp(n) }
const FX = {
  tv: {
    name: 'TV chiando', cat: 'Clássicos', dur: 1, sound: 'static', soundLoop: true, hint: 'Chiado de TV fora do ar. Use "Mistura" para ver a imagem por trás.',
    params: [{ k: 'mix', l: 'Mistura com a imagem', min: 0, max: 100, def: 85, unit: '%' }, { k: 'grain', l: 'Tamanho do chiado', min: 1, max: 12, step: 1, def: 2 }, { k: 'lines', l: 'Faixas rolando', type: 'bool', def: true }, { k: 'color', l: 'Colorido', type: 'bool', def: false }],
    apply(c, cv, P, x) {
      const g = Math.max(1, P.grain * x.q * 1.5), nw = Math.ceil(cv.width / g), nh = Math.ceil(cv.height / g);
      const n = x.tmp('tvn', nw, nh), nc = n.getContext('2d'), id = nc.createImageData(nw, nh), d = id.data;
      for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; if (P.color) { d[i] = Math.random() * 255; d[i + 1] = Math.random() * 255; d[i + 2] = Math.random() * 255; } else d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      nc.putImageData(id, 0, 0);
      c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = P.mix / 100; c.imageSmoothingEnabled = false;
      c.drawImage(n, 0, 0, cv.width, cv.height);
      if (P.lines) { const y = ((x.t * .6) % 1) * cv.height * 1.3 - cv.height * .15; c.globalAlpha = .25; c.fillStyle = '#fff'; c.fillRect(0, y, cv.width, cv.height * .08); c.globalAlpha = .15; c.fillStyle = '#000'; c.fillRect(0, y + cv.height * .3, cv.width, cv.height * .05); }
      c.restore();
    }
  },
  glitch: {
    name: 'Glitch', cat: 'Clássicos', dur: .6, sound: 'glitch', hint: 'Imagem quebrando em faixas com cores separadas.',
    params: [{ k: 'amount', l: 'Intensidade', min: 0, max: 100, def: 50, unit: '%' }, { k: 'slices', l: 'Faixas', min: 1, max: 40, step: 1, def: 12 }, { k: 'rgb', l: 'Separar cores', min: 0, max: 80, def: 14, unit: 'px' }, { k: 'speed', l: 'Velocidade', min: 1, max: 60, def: 18 }],
    apply(c, cv, P, x) {
      const W = cv.width, H = cv.height, a = P.amount / 100, fr = Math.floor(x.t * P.speed), r = seeded(fr * 7919 + 13);
      const src = x.copy(cv);
      if (P.rgb > 0) rgbSplit(c, src, P.rgb * x.q * (0.4 + r() * 1.2) * a, x);
      else { c.clearRect(0, 0, W, H); c.drawImage(src, 0, 0); }
      const snap = x.copy(cv, 'gl2');
      const n = Math.max(1, Math.round(P.slices * (0.3 + r())));
      for (let i = 0; i < n; i++) {
        if (r() > a * 1.2) continue;
        const y = r() * H, hh = (2 + r() * 50) * x.q * (1 + a), off = (r() * 2 - 1) * W * .12 * a;
        c.clearRect(0, y, W, hh); c.drawImage(snap, 0, y, W, hh, off, y, W, hh);
      }
      if (r() < a * .4) { c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = .15; c.fillStyle = r() < .5 ? '#0ff' : '#f0f'; c.fillRect(0, r() * H, W, (5 + r() * 40) * x.q); c.restore(); }
    }
  },
  shakeCam: {
    name: 'Tremor de câmera', cat: 'Câmera', dur: .8, sound: 'rumble', soundLoop: true, hint: 'A tela toda treme (bom em uma faixa de efeitos).',
    params: [{ k: 'amp', l: 'Intensidade', min: 0, max: 200, def: 22, unit: 'px' }, { k: 'speed', l: 'Velocidade', min: 1, max: 60, def: 25 }, { k: 'rot', l: 'Girar', min: 0, max: 10, step: .1, def: 1, unit: '°' }, { k: 'fill', l: 'Ampliar para não mostrar bordas', type: 'bool', def: true }],
    apply(c, cv, P, x) {
      const fr = Math.floor(x.t * P.speed), k = Math.sin(Math.PI * x.p) ** .4;
      const dx = (hash(fr) * 2 - 1) * P.amp * x.q * k, dy = (hash(fr + 31) * 2 - 1) * P.amp * x.q * k, rr = (hash(fr + 77) * 2 - 1) * P.rot * k * Math.PI / 180;
      const s = P.fill ? 1 + (P.amp * 2.4 * k) / (x.W) + Math.abs(rr) * .6 : 1;
      transformLayer(c, cv, x, dx, dy, s, rr);
    }
  },
  zoom: {
    name: 'Zoom', cat: 'Câmera', dur: 1.5, sound: '', hint: 'Aproxima ou afasta. Escolha o ponto (centro) do zoom.',
    params: [{ k: 'from', l: 'Começa em', min: .1, max: 6, step: .01, def: 1, unit: 'x' }, { k: 'to', l: 'Termina em', min: .1, max: 6, step: .01, def: 1.4, unit: 'x' }, { k: 'cx', l: 'Centro X', min: 0, max: 100, def: 50, unit: '%' }, { k: 'cy', l: 'Centro Y', min: 0, max: 100, def: 50, unit: '%' }, { k: 'ease', l: 'Movimento', type: 'ease', def: 'inOut' }],
    apply(c, cv, P, x) {
      const s = lerp(P.from, P.to, Ease[P.ease || 'inOut'](x.p)), px = cv.width * P.cx / 100, py = cv.height * P.cy / 100;
      const src = x.copy(cv); c.clearRect(0, 0, cv.width, cv.height); c.save(); c.translate(px, py); c.scale(s, s); c.translate(-px, -py); c.drawImage(src, 0, 0); c.restore();
    }
  },
  punch: {
    name: 'Zoom de impacto', cat: 'Câmera', dur: .4, sound: 'hit', hint: 'Zoom rápido que volta — ótimo pra piadas.',
    params: [{ k: 'amount', l: 'Força', min: 0, max: 3, step: .01, def: .35 }, { k: 'cx', l: 'Centro X', min: 0, max: 100, def: 50, unit: '%' }, { k: 'cy', l: 'Centro Y', min: 0, max: 100, def: 45, unit: '%' }],
    apply(c, cv, P, x) { const p = x.p, s = 1 + P.amount * (p < .25 ? Ease.out(p / .25) : 1 - Ease.inOut((p - .25) / .75)); const px = cv.width * P.cx / 100, py = cv.height * P.cy / 100; const src = x.copy(cv); c.clearRect(0, 0, cv.width, cv.height); c.save(); c.translate(px, py); c.scale(s, s); c.translate(-px, -py); c.drawImage(src, 0, 0); c.restore(); }
  },
  vhs: {
    name: 'VHS', cat: 'Retrô', dur: 2, sound: '', hint: 'Fita antiga: linhas, cores borradas e ruído.',
    params: [{ k: 'amount', l: 'Intensidade', min: 0, max: 100, def: 60, unit: '%' }, { k: 'date', l: 'Mostrar "PLAY ▶"', type: 'bool', def: true }],
    apply(c, cv, P, x) {
      const a = P.amount / 100, W = cv.width, H = cv.height, src = x.copy(cv);
      rgbSplit(c, src, 6 * x.q * a + 1, x);
      c.save(); c.globalCompositeOperation = 'source-atop';
      c.globalAlpha = .18 * a; c.fillStyle = '#000'; const lh = Math.max(2, 3 * x.q); for (let y = 0; y < H; y += lh * 2) c.fillRect(0, y, W, lh);
      const y0 = ((x.t * .3) % 1) * H; c.globalAlpha = .12 * a; c.fillStyle = '#fff'; c.fillRect(0, y0, W, 18 * x.q);
      c.globalAlpha = .12 * a; for (let i = 0; i < 30; i++) { c.fillStyle = Math.random() < .5 ? '#fff' : '#000'; c.fillRect(Math.random() * W, Math.random() * H, Math.random() * 60 * x.q, 1.5 * x.q); }
      c.restore();
      if (P.date) { c.save(); c.font = `bold ${Math.round(H * .055)}px "Press Start 2P", monospace`; c.fillStyle = '#fff'; c.shadowColor = '#000'; c.shadowBlur = 4 * x.q; c.fillText('PLAY ▶', W * .05, H * .12); c.restore(); }
    }
  },
  blur: { name: 'Desfoque', cat: 'Imagem', dur: 1, sound: '', params: [{ k: 'amount', l: 'Desfoque', min: 0, max: 60, step: .5, def: 10, unit: 'px' }, { k: 'anim', l: 'Animar', type: 'select', opts: { none: 'Fixo', in: 'Aumentar', out: 'Diminuir', both: 'Aumentar e diminuir' }, def: 'none' }], apply(c, cv, P, x) { const k = animK(P.anim, x.p); filterLayer(c, cv, x, `blur(${P.amount * k * x.q}px)`); } },
  pixelate: { name: 'Pixelado', cat: 'Imagem', dur: 1, sound: '', params: [{ k: 'size', l: 'Tamanho do pixel', min: 2, max: 120, def: 20, unit: 'px' }, { k: 'anim', l: 'Animar', type: 'select', opts: { none: 'Fixo', in: 'Aumentar', out: 'Diminuir', both: 'Aumentar e diminuir' }, def: 'none' }], apply(c, cv, P, x) { const s = Math.max(1, P.size * animK(P.anim, x.p) * x.q); if (s <= 1) return; pixelateLayer(c, cv, x, s); } },
  bw: { name: 'Preto e branco', cat: 'Cor', dur: 2, sound: '', params: [{ k: 'amount', l: 'Quantidade', min: 0, max: 100, def: 100, unit: '%' }, { k: 'contrast', l: 'Contraste', min: 0, max: 300, def: 115, unit: '%' }], apply(c, cv, P, x) { filterLayer(c, cv, x, `grayscale(${P.amount}%) contrast(${P.contrast}%)`); } },
  colorFx: { name: 'Ajuste de cor', cat: 'Cor', dur: 2, sound: '', hint: 'Mude brilho, contraste, saturação e matiz só nesse trecho.', params: [{ k: 'brightness', l: 'Brilho', min: 0, max: 300, def: 100, unit: '%' }, { k: 'contrast', l: 'Contraste', min: 0, max: 300, def: 100, unit: '%' }, { k: 'saturation', l: 'Saturação', min: 0, max: 400, def: 160, unit: '%' }, { k: 'hue', l: 'Matiz', min: -180, max: 180, def: 0, unit: '°' }, { k: 'sepia', l: 'Sépia', min: 0, max: 100, def: 0, unit: '%' }], apply(c, cv, P, x) { filterLayer(c, cv, x, `brightness(${P.brightness}%) contrast(${P.contrast}%) saturate(${P.saturation}%) hue-rotate(${P.hue}deg) sepia(${P.sepia}%)`); } },
  invert: { name: 'Inverter cores', cat: 'Cor', dur: .5, sound: '', params: [{ k: 'amount', l: 'Quantidade', min: 0, max: 100, def: 100, unit: '%' }], apply(c, cv, P, x) { filterLayer(c, cv, x, `invert(${P.amount}%)`); } },
  tint: { name: 'Tingir', cat: 'Cor', dur: 2, sound: '', params: [{ k: 'color', l: 'Cor', type: 'color', def: '#ff2a4a' }, { k: 'amount', l: 'Quantidade', min: 0, max: 100, def: 35, unit: '%' }, { k: 'mode', l: 'Modo', type: 'select', opts: { 'source-atop': 'Cobrir', multiply: 'Multiplicar', screen: 'Clarear', overlay: 'Sobrepor', color: 'Colorir' }, def: 'source-atop' }], apply(c, cv, P) { overlayFill(c, cv, P.color, P.amount / 100, P.mode); } },
  rgb: { name: 'Aberração cromática', cat: 'Imagem', dur: 1, sound: '', params: [{ k: 'amount', l: 'Separação', min: 0, max: 100, def: 12, unit: 'px' }, { k: 'pulse', l: 'Pulsar', type: 'bool', def: false }], apply(c, cv, P, x) { const k = P.pulse ? .5 + .5 * Math.sin(x.t * 12) : 1; rgbSplit(c, x.copy(cv), P.amount * x.q * k, x); } },
  wave: { name: 'Ondulação', cat: 'Imagem', dur: 2, sound: '', params: [{ k: 'amp', l: 'Força', min: 0, max: 200, def: 18, unit: 'px' }, { k: 'freq', l: 'Ondas', min: .5, max: 40, step: .5, def: 4 }, { k: 'speed', l: 'Velocidade', min: 0, max: 20, step: .1, def: 3 }], apply(c, cv, P, x) { const src = x.copy(cv), W = cv.width, H = cv.height, st = Math.max(2, Math.round(3 * x.q)); c.clearRect(0, 0, W, H); for (let y = 0; y < H; y += st) { const o = Math.sin(y / H * P.freq * 2 * Math.PI + x.t * P.speed) * P.amp * x.q; c.drawImage(src, 0, y, W, st, o, y, W, st); } } },
  mirror: { name: 'Espelhar', cat: 'Imagem', dur: 2, sound: '', params: [{ k: 'mode', l: 'Modo', type: 'select', opts: { h: 'Virar horizontal', v: 'Virar vertical', half: 'Metade espelhada', quad: 'Caleidoscópio' }, def: 'h' }], apply(c, cv, P, x) { const W = cv.width, H = cv.height, src = x.copy(cv); c.clearRect(0, 0, W, H); c.save(); if (P.mode === 'h') { c.translate(W, 0); c.scale(-1, 1); c.drawImage(src, 0, 0); } else if (P.mode === 'v') { c.translate(0, H); c.scale(1, -1); c.drawImage(src, 0, 0); } else if (P.mode === 'half') { c.drawImage(src, 0, 0, W / 2, H, 0, 0, W / 2, H); c.translate(W, 0); c.scale(-1, 1); c.drawImage(src, 0, 0, W / 2, H, 0, 0, W / 2, H); } else { for (let i = 0; i < 4; i++) { c.save(); c.translate(i % 2 ? W : 0, i > 1 ? H : 0); c.scale(i % 2 ? -1 : 1, i > 1 ? -1 : 1); c.drawImage(src, 0, 0, W / 2, H / 2, 0, 0, W / 2, H / 2); c.restore(); } } c.restore(); } },
  vignette: { name: 'Vinheta', cat: 'Imagem', dur: 2, sound: '', params: [{ k: 'amount', l: 'Força', min: 0, max: 100, def: 60, unit: '%' }, { k: 'size', l: 'Tamanho', min: 0, max: 100, def: 45, unit: '%' }, { k: 'color', l: 'Cor', type: 'color', def: '#000000' }], apply(c, cv, P) { const W = cv.width, H = cv.height, r = Math.hypot(W, H) / 2, g = c.createRadialGradient(W / 2, H / 2, r * P.size / 100 * .9, W / 2, H / 2, r); const [R, G, B] = hexToRgb(P.color); g.addColorStop(0, `rgba(${R},${G},${B},0)`); g.addColorStop(1, `rgba(${R},${G},${B},${P.amount / 100})`); c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore(); } },
  flash: { name: 'Flash', cat: 'Clássicos', dur: .4, sound: 'shutter', params: [{ k: 'color', l: 'Cor', type: 'color', def: '#ffffff' }, { k: 'peak', l: 'Pico', min: 0, max: 100, def: 15, unit: '% do tempo' }], apply(c, cv, P, x) { const pk = Math.max(.01, P.peak / 100), a = x.p < pk ? x.p / pk : 1 - (x.p - pk) / (1 - pk); overlayFill(c, cv, P.color, a, 'source-atop'); } },
  blackout: { name: 'Piscar a tela', cat: 'Clássicos', dur: .6, sound: '', params: [{ k: 'color', l: 'Cor', type: 'color', def: '#000000' }, { k: 'count', l: 'Vezes', min: 1, max: 30, step: 1, def: 3 }], apply(c, cv, P, x) { if (Math.floor(x.p * P.count * 2) % 2 === 0) overlayFill(c, cv, P.color, 1, 'source-atop'); } },
  damage: { name: 'Dano (tela vermelha)', cat: 'Clássicos', dur: .6, sound: 'hit', params: [{ k: 'amount', l: 'Força', min: 0, max: 100, def: 70, unit: '%' }], apply(c, cv, P, x) { const a = P.amount / 100 * (1 - x.p); FX.shakeCam.apply(c, cv, { amp: 18 * a, speed: 30, rot: .5, fill: true }, x); const W = cv.width, H = cv.height, g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .25, W / 2, H / 2, Math.hypot(W, H) / 2); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,0,0,${.75 * a})`); c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalAlpha = .18 * a; c.fillStyle = '#f00'; c.fillRect(0, 0, W, H); c.restore(); } },
  dream: { name: 'Sonho / Lembrança', cat: 'Retrô', dur: 2, sound: 'magic', soundDefault: 'off', params: [{ k: 'amount', l: 'Força', min: 0, max: 100, def: 70, unit: '%' }], apply(c, cv, P, x) { const a = P.amount / 100, src = x.copy(cv); filterLayer(c, cv, x, `sepia(${40 * a}%) saturate(${100 - 30 * a}%) brightness(${100 + 10 * a}%)`); c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = .45 * a; c.filter = `blur(${14 * x.q}px)`; c.drawImage(src, 0, 0); c.restore(); FX.vignette.apply(c, cv, { amount: 55 * a, size: 40, color: '#ffffff' }, x); } },
  grain: { name: 'Granulado', cat: 'Retrô', dur: 2, sound: '', params: [{ k: 'amount', l: 'Força', min: 0, max: 100, def: 25, unit: '%' }], apply(c, cv, P, x) { FX.tv.apply(c, cv, { mix: P.amount * .6, grain: 1, lines: false }, x); } },
  scanlines: { name: 'Linhas de TV', cat: 'Retrô', dur: 2, sound: '', params: [{ k: 'amount', l: 'Força', min: 0, max: 100, def: 35, unit: '%' }, { k: 'size', l: 'Espessura', min: 1, max: 20, def: 3, unit: 'px' }], apply(c, cv, P, x) { const lh = Math.max(1, P.size * x.q); c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = P.amount / 100; c.fillStyle = '#000'; for (let y = 0; y < cv.height; y += lh * 2) c.fillRect(0, y, cv.width, lh); c.restore(); } },
  letterbox: { name: 'Barras de cinema', cat: 'Câmera', dur: 3, sound: '', params: [{ k: 'size', l: 'Tamanho', min: 0, max: 45, def: 12, unit: '%' }, { k: 'animate', l: 'Entrar e sair animado', type: 'bool', def: true }, { k: 'color', l: 'Cor', type: 'color', def: '#000000' }], apply(c, cv, P, x) { let k = 1; if (P.animate) { const r = Math.min(.5, .4 / Math.max(.4, x.dur)); k = x.p < r ? Ease.out(x.p / r) : x.p > 1 - r ? Ease.out((1 - x.p) / r) : 1; } const hh = cv.height * P.size / 100 * k; c.save(); c.fillStyle = P.color; c.fillRect(0, 0, cv.width, hh); c.fillRect(0, cv.height - hh, cv.width, hh); c.restore(); } },
  spotlight: { name: 'Holofote', cat: 'Câmera', dur: 2, sound: '', params: [{ k: 'cx', l: 'Posição X', min: 0, max: 100, def: 50, unit: '%' }, { k: 'cy', l: 'Posição Y', min: 0, max: 100, def: 50, unit: '%' }, { k: 'radius', l: 'Tamanho', min: 1, max: 100, def: 25, unit: '%' }, { k: 'dark', l: 'Escuridão', min: 0, max: 100, def: 85, unit: '%' }], apply(c, cv, P) { const W = cv.width, H = cv.height, r = Math.max(W, H) * P.radius / 100, x0 = W * P.cx / 100, y0 = H * P.cy / 100, g = c.createRadialGradient(x0, y0, r * .8, x0, y0, r * 1.15); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${P.dark / 100})`); c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore(); } },
  speedLines: { name: 'Linhas de velocidade', cat: 'Clássicos', dur: 1, sound: 'whoosh', soundDefault: 'off', hint: 'Linhas de anime em volta da tela.', params: [{ k: 'count', l: 'Quantidade', min: 5, max: 200, def: 70 }, { k: 'color', l: 'Cor', type: 'color', def: '#ffffff' }, { k: 'inner', l: 'Espaço no meio', min: 0, max: 90, def: 40, unit: '%' }, { k: 'speed', l: 'Velocidade', min: 1, max: 60, def: 20 }], apply(c, cv, P, x) { const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2, r = seeded(Math.floor(x.t * P.speed) + 3); c.save(); c.fillStyle = P.color; for (let i = 0; i < P.count; i++) { const a = r() * Math.PI * 2, w = (.004 + r() * .012), r0 = R * (P.inner / 100 + r() * .15); c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a - w) * R * 1.1, cy + Math.sin(a - w) * R * 1.1); c.lineTo(cx + Math.cos(a + w) * R * 1.1, cy + Math.sin(a + w) * R * 1.1); c.fill(); } c.restore(); } },
  outline: { name: 'Contorno', cat: 'Personagem', dur: 3, sound: '', clipOnly: true, hint: 'Borda em volta do personagem. Fica perfeito em PNG sem fundo (em imagem com fundo, a borda aparece em volta do retângulo).', params: [{ k: 'color', l: 'Cor', type: 'color', def: '#ffffff' }, { k: 'width', l: 'Espessura', min: 1, max: 80, def: 16, unit: 'px' }], apply(c, cv, P, x) { const src = x.copy(cv), sil = x.tmp('sil', cv.width, cv.height), sc = sil.getContext('2d'); sc.clearRect(0, 0, cv.width, cv.height); sc.drawImage(src, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = P.color; sc.fillRect(0, 0, cv.width, cv.height); sc.globalCompositeOperation = 'source-over'; const w = Math.max(1, P.width * x.q * (x.objScale || 1)), n = Math.max(12, Math.min(36, Math.round(w * 2))); c.clearRect(0, 0, cv.width, cv.height); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; c.drawImage(sil, Math.cos(a) * w, Math.sin(a) * w); } c.drawImage(src, 0, 0); } },
  glow: { name: 'Brilho em volta', cat: 'Personagem', dur: 3, sound: '', clipOnly: true, hint: 'Aura brilhando em volta do personagem (melhor em PNG sem fundo).', params: [{ k: 'color', l: 'Cor', type: 'color', def: '#19d3f0' }, { k: 'size', l: 'Tamanho', min: 1, max: 150, def: 45, unit: 'px' }, { k: 'strength', l: 'Força', min: 1, max: 8, step: 1, def: 4 }, { k: 'pulse', l: 'Pulsar', type: 'bool', def: false }], apply(c, cv, P, x) { const src = x.copy(cv), k = P.pulse ? .6 + .4 * Math.sin(x.t * 6) : 1, sil = x.tmp('gsil', cv.width, cv.height), sc = sil.getContext('2d'); sc.globalCompositeOperation = 'copy'; sc.drawImage(src, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = P.color; sc.fillRect(0, 0, cv.width, cv.height); sc.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, cv.width, cv.height); c.save(); c.shadowColor = P.color; c.shadowBlur = Math.max(1, P.size * x.q * (x.objScale || 1) * k); for (let i = 0; i < (P.strength || 4); i++) c.drawImage(sil, 0, 0); c.restore(); c.drawImage(src, 0, 0); } },
  shadow: { name: 'Sombra', cat: 'Personagem', dur: 3, sound: '', clipOnly: true, params: [{ k: 'color', l: 'Cor', type: 'color', def: '#000000' }, { k: 'opacity', l: 'Opacidade', min: 0, max: 100, def: 70, unit: '%' }, { k: 'dx', l: 'Distância X', min: -300, max: 300, def: 25, unit: 'px' }, { k: 'dy', l: 'Distância Y', min: -300, max: 300, def: 30, unit: 'px' }, { k: 'blur', l: 'Suavidade', min: 0, max: 100, def: 18, unit: 'px' }], apply(c, cv, P, x) { const src = x.copy(cv), m = x.q * (x.objScale || 1), sil = x.tmp('ssil', cv.width, cv.height), sc = sil.getContext('2d'); sc.globalCompositeOperation = 'copy'; sc.drawImage(src, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = P.color; sc.fillRect(0, 0, cv.width, cv.height); sc.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, cv.width, cv.height); c.save(); c.globalAlpha = P.opacity / 100; c.filter = P.blur > 0 ? `blur(${P.blur * m}px)` : 'none'; c.drawImage(sil, P.dx * m, P.dy * m); c.restore(); c.drawImage(src, 0, 0); } },
};
function animK(mode, p) { return mode === 'in' ? Ease.inOut(p) : mode === 'out' ? 1 - Ease.inOut(p) : mode === 'both' ? Math.sin(Math.PI * p) : 1; }
function filterLayer(c, cv, x, f) { const src = x.copy(cv); c.clearRect(0, 0, cv.width, cv.height); c.save(); c.filter = f; c.drawImage(src, 0, 0); c.restore(); }
function overlayFill(c, cv, color, a, mode) { if (a <= 0) return; const tmp = mode !== 'source-atop'; c.save(); c.globalAlpha = clamp(a, 0, 1); c.globalCompositeOperation = mode || 'source-atop'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height); c.restore(); if (tmp) { /* recorta pelo alfa original */ } }
function transformLayer(c, cv, x, dx, dy, s, r) { const src = x.copy(cv), W = cv.width, H = cv.height; c.clearRect(0, 0, W, H); c.save(); c.translate(W / 2 + dx, H / 2 + dy); c.rotate(r); c.scale(s, s); c.drawImage(src, -W / 2, -H / 2); c.restore(); }
function pixelateLayer(c, cv, x, s) { const W = cv.width, H = cv.height, sw = Math.max(1, Math.ceil(W / s)), sh = Math.max(1, Math.ceil(H / s)), t = x.tmp('pix', sw, sh), tc = t.getContext('2d'); tc.clearRect(0, 0, sw, sh); tc.imageSmoothingEnabled = true; tc.drawImage(cv, 0, 0, sw, sh); c.clearRect(0, 0, W, H); c.save(); c.imageSmoothingEnabled = false; c.drawImage(t, 0, 0, sw, sh, 0, 0, W, H); c.restore(); }
function rgbSplit(c, src, amt, x) {
  const W = src.width, H = src.height;
  const chan = (col, key) => { const t = x.tmp('rgb' + key, W, H), tc = t.getContext('2d'); tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, W, H); tc.drawImage(src, 0, 0); tc.globalCompositeOperation = 'multiply'; tc.fillStyle = col; tc.fillRect(0, 0, W, H); tc.globalCompositeOperation = 'destination-in'; tc.drawImage(src, 0, 0); tc.globalCompositeOperation = 'source-over'; return t; };
  const r = chan('#f00', 'r'), g = chan('#0f0', 'g'), b = chan('#00f', 'b');
  c.clearRect(0, 0, W, H); c.save(); c.globalCompositeOperation = 'lighter';
  c.drawImage(r, -amt, 0); c.drawImage(g, 0, 0); c.drawImage(b, amt, 0); c.restore();
}

/* ================= TRANSIÇÕES (entrada/saída de cada clipe) ================= */
// draw(dst, src, v, P, x) — v: 0 = invisível, 1 = totalmente visível
const TRANS = {
  fade: { name: 'Fade (dissolver)', dur: .5, sound: '', params: [], draw(d, s, v) { d.globalAlpha *= v; d.drawImage(s, 0, 0); } },
  fadeBlack: { name: 'Fade pelo preto', dur: .8, sound: '', params: [{ k: 'color', l: 'Cor', type: 'color', def: '#000000' }], draw(d, s, v, P, x) { const W = s.width, H = s.height, a = d.globalAlpha; if (v < .5) { d.globalAlpha = a * v * 2; d.fillStyle = P.color || '#000'; d.fillRect(0, 0, W, H); } else { d.drawImage(s, 0, 0); d.globalAlpha = a * (1 - v) * 2; d.fillStyle = P.color || '#000'; d.fillRect(0, 0, W, H); } d.globalAlpha = a; } },
  fadeWhite: { name: 'Fade pelo branco', dur: .8, sound: '', params: [], draw(d, s, v, P, x) { TRANS.fadeBlack.draw(d, s, v, { color: '#ffffff' }, x); } },
  flashT: { name: 'Flash', dur: .4, sound: 'shutter', params: [], draw(d, s, v) { d.drawImage(s, 0, 0); const a = d.globalAlpha; d.globalAlpha = a * (1 - v); d.fillStyle = '#fff'; d.fillRect(0, 0, s.width, s.height); d.globalAlpha = a; } },
  slide: { name: 'Deslizar', dur: .5, sound: 'whoosh', params: [{ k: 'dir', l: 'Direção', type: 'select', opts: DIR_OPTS, def: 'left' }, { k: 'ease', l: 'Movimento', type: 'ease', def: 'out' }], draw(d, s, v, P) { const e = 1 - v, W = s.width, H = s.height, o = { left: [-W, 0], right: [W, 0], up: [0, -H], down: [0, H] }[P.dir || 'left']; d.drawImage(s, o[0] * e, o[1] * e); } },
  zoomIn: { name: 'Zoom (aproximar)', dur: .5, sound: 'swoosh', params: [{ k: 'ease', l: 'Movimento', type: 'ease', def: 'back' }], draw(d, s, v) { const W = s.width, H = s.height; d.save(); d.globalAlpha *= Math.min(1, v * 2); d.translate(W / 2, H / 2); d.scale(Math.max(.001, v), Math.max(.001, v)); d.drawImage(s, -W / 2, -H / 2); d.restore(); } },
  zoomOut: { name: 'Zoom (afastar)', dur: .5, sound: 'swoosh', params: [{ k: 'ease', l: 'Movimento', type: 'ease', def: 'out' }], draw(d, s, v) { const W = s.width, H = s.height, k = 1 + (1 - v) * 2; d.save(); d.globalAlpha *= v; d.translate(W / 2, H / 2); d.scale(k, k); d.drawImage(s, -W / 2, -H / 2); d.restore(); } },
  spin: { name: 'Girar', dur: .6, sound: 'whoosh', params: [{ k: 'ease', l: 'Movimento', type: 'ease', def: 'out' }], draw(d, s, v) { const W = s.width, H = s.height; d.save(); d.globalAlpha *= Math.min(1, v * 1.5); d.translate(W / 2, H / 2); d.rotate((1 - v) * Math.PI * 2); d.scale(Math.max(.001, v), Math.max(.001, v)); d.drawImage(s, -W / 2, -H / 2); d.restore(); } },
  wipe: { name: 'Cortina (wipe)', dur: .5, sound: '', params: [{ k: 'dir', l: 'Direção', type: 'select', opts: DIR_OPTS, def: 'right' }, { k: 'ease', l: 'Movimento', type: 'ease', def: 'inOut' }], draw(d, s, v, P) { const W = s.width, H = s.height; d.save(); d.beginPath(); const r = { right: [0, 0, W * v, H], left: [W * (1 - v), 0, W * v, H], down: [0, 0, W, H * v], up: [0, H * (1 - v), W, H * v] }[P.dir || 'right']; d.rect(...r); d.clip(); d.drawImage(s, 0, 0); d.restore(); } },
  colorWipe: { name: 'Cortina colorida', dur: .7, sound: 'whoosh', params: [{ k: 'color', l: 'Cor', type: 'color', def: '#19d3f0' }, { k: 'dir', l: 'Direção', type: 'select', opts: { right: 'Para direita', left: 'Para esquerda' }, def: 'right' }], draw(d, s, v, P) { const W = s.width, H = s.height, L = P.dir === 'left'; if (v >= .5) d.drawImage(s, 0, 0); d.save(); d.fillStyle = P.color; const k = v < .5 ? Ease.inOut(v * 2) : Ease.inOut((v - .5) * 2); let x0, w; if (v < .5) { w = W * k; x0 = L ? W - w : 0; } else { w = W * (1 - k); x0 = L ? 0 : W - w; } d.fillRect(x0, 0, w, H); d.restore(); } },
  circle: { name: 'Círculo', dur: .6, sound: '', params: [{ k: 'ease', l: 'Movimento', type: 'ease', def: 'inOut' }], draw(d, s, v) { const W = s.width, H = s.height; d.save(); d.beginPath(); d.arc(W / 2, H / 2, Math.hypot(W, H) / 2 * v, 0, Math.PI * 2); d.clip(); d.drawImage(s, 0, 0); d.restore(); } },
  diamond: { name: 'Losango', dur: .6, sound: '', params: [{ k: 'ease', l: 'Movimento', type: 'ease', def: 'inOut' }], draw(d, s, v) { const W = s.width, H = s.height, r = (W + H) / 2 * v * 1.05; d.save(); d.beginPath(); d.moveTo(W / 2, H / 2 - r); d.lineTo(W / 2 + r, H / 2); d.lineTo(W / 2, H / 2 + r); d.lineTo(W / 2 - r, H / 2); d.closePath(); d.clip(); d.drawImage(s, 0, 0); d.restore(); } },
  blinds: { name: 'Persiana', dur: .6, sound: '', params: [{ k: 'count', l: 'Faixas', min: 2, max: 40, step: 1, def: 10 }, { k: 'ease', l: 'Movimento', type: 'ease', def: 'inOut' }], draw(d, s, v, P) { const W = s.width, H = s.height, n = P.count || 10, bw = W / n; d.save(); d.beginPath(); for (let i = 0; i < n; i++) d.rect(i * bw, 0, bw * v + .5, H); d.clip(); d.drawImage(s, 0, 0); d.restore(); } },
  doors: { name: 'Portas', dur: .6, sound: '', params: [{ k: 'ease', l: 'Movimento', type: 'ease', def: 'inOut' }], draw(d, s, v) { const W = s.width, H = s.height; d.save(); d.beginPath(); d.rect(W / 2 * (1 - v), 0, W * v, H); d.clip(); d.drawImage(s, 0, 0); d.restore(); } },
  clock: { name: 'Relógio', dur: .7, sound: '', params: [{ k: 'ease', l: 'Movimento', type: 'ease', def: 'linear' }], draw(d, s, v) { const W = s.width, H = s.height; d.save(); d.beginPath(); d.moveTo(W / 2, H / 2); d.arc(W / 2, H / 2, Math.hypot(W, H), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v); d.closePath(); d.clip(); d.drawImage(s, 0, 0); d.restore(); } },
  pixelT: { name: 'Pixelar', dur: .6, sound: '', params: [], draw(d, s, v, P, x) { const k = Math.max(1, (1 - v) * 70 * x.q); const t = x.tmp('tpix', s.width, s.height), tc = t.getContext('2d'); tc.clearRect(0, 0, t.width, t.height); tc.drawImage(s, 0, 0); if (k > 1.2) pixelateLayer(tc, t, x, k); d.save(); d.globalAlpha *= Math.min(1, v * 1.6); d.drawImage(t, 0, 0); d.restore(); } },
  blurT: { name: 'Desfocar', dur: .6, sound: '', params: [], draw(d, s, v, P, x) { d.save(); d.globalAlpha *= v; d.filter = `blur(${(1 - v) * 30 * x.q}px)`; d.drawImage(s, 0, 0); d.restore(); } },
  glitchT: { name: 'Glitch', dur: .5, sound: 'glitch', params: [], draw(d, s, v, P, x) { if (v >= 1) return d.drawImage(s, 0, 0); const r = seeded(Math.floor(x.t * 30) + 5), W = s.width, H = s.height, a = 1 - v; if (r() > v * 1.1) return; for (let y = 0; y < H;) { const hh = (8 + r() * 60) * x.q, off = (r() * 2 - 1) * W * .25 * a; d.drawImage(s, 0, y, W, hh, off, y, W, hh); y += hh; } } },
  tvOff: { name: 'TV desligando', dur: .6, sound: 'tvoff', params: [], draw(d, s, v) { const W = s.width, H = s.height; d.save(); d.translate(W / 2, H / 2); if (v > .4) { const k = (v - .4) / .6; d.scale(1, Math.max(.005, k)); d.drawImage(s, -W / 2, -H / 2); d.globalAlpha *= (1 - k) * .8; d.fillStyle = '#fff'; d.fillRect(-W / 2, -H / 2, W, H); } else { const k = v / .4; d.fillStyle = '#fff'; d.fillRect(-W / 2 * k, -2, W * k, 4); d.beginPath(); d.arc(0, 0, 6, 0, Math.PI * 2); d.fill(); } d.restore(); } },
  bounceT: { name: 'Quicar', dur: .7, sound: 'boing', params: [{ k: 'dir', l: 'Vem de', type: 'select', opts: { up: 'Cima', down: 'Baixo' }, def: 'up' }], draw(d, s, v, P) { const H = s.height, e = 1 - Ease.bounce(v); d.drawImage(s, 0, (P.dir === 'down' ? H : -H) * e); } },
};

/* ================= CATEGORIAS ================= */
function groupBy(obj, key = 'cat') { const g = {}; for (const [id, v] of Object.entries(obj)) (g[v[key] || 'Outros'] ||= []).push({ id, ...v }); return g; }
function defaultParams(def) { const P = {}; (def.params || []).forEach(p => P[p.k] = clone(p.def)); if (def.defaults) Object.assign(P, clone(def.defaults)); return P; }
// preferência "começar sem som" de cada animação/efeito/transição (clicando no alto-falante do bloco)
const SoundPrefs = {
  map: (() => { try { return JSON.parse(localStorage.getItem('ps-sndprefs') || '{}'); } catch { return {}; } })(),
  isOn(def) { const v = this.map[def._key]; return v === undefined ? false : v; }, // por padrão sem som; o alto-falante do bloco liga
  toggle(def) { this.map[def._key] = !this.isOn(def); try { localStorage.setItem('ps-sndprefs', JSON.stringify(this.map)); } catch { } return this.map[def._key]; },
};
function defaultSound(def) { return { mode: def.sound && SoundPrefs.isOn(def) ? 'default' : 'off', id: def.sound || '', assetId: null, vol: 80 }; }
for (const [k, v] of Object.entries(ANIMS)) v._key = 'a:' + k;
for (const [k, v] of Object.entries(FX)) v._key = 'f:' + k;
for (const [k, v] of Object.entries(TRANS)) v._key = 't:' + k;

const TEXT_STYLES = {
  title: { name: 'Título', text: 'TÍTULO', font: 'Bangers', size: 140, color: '#ffffff', stroke: '#000000', strokeW: 10, shadow: true, bold: false },
  youtube: { name: 'Estilo YouTube', text: 'OLHA ISSO!', font: 'Luckiest Guy', size: 120, color: '#ffe03a', stroke: '#000000', strokeW: 12, shadow: true },
  meme: { name: 'Meme', text: 'QUANDO VOCÊ...', font: 'Impact', size: 96, color: '#ffffff', stroke: '#000000', strokeW: 8, shadow: false },
  subtitle: { name: 'Legenda', text: 'Escreva a legenda aqui', font: 'Poppins', size: 54, color: '#ffffff', stroke: '#000000', strokeW: 0, shadow: false, bg: '#000000', bgAmt: 65, bold: true },
  clean: { name: 'Simples', text: 'Texto', font: 'Montserrat', size: 80, color: '#ffffff', stroke: '#000000', strokeW: 0, shadow: true },
  pixel: { name: 'Pixel / Game', text: 'GAME OVER', font: 'Press Start 2P', size: 70, color: '#ff4d6a', stroke: '#000000', strokeW: 6, shadow: false },
  hand: { name: 'Escrito à mão', text: 'Uau...', font: 'Permanent Marker', size: 90, color: '#ffffff', stroke: '#000000', strokeW: 4, shadow: true },
};
