/* ===================== util.js — utilidades, ícones, pop-ups, zip ===================== */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

function fmtTime(t, fps = 30, withFrames = true) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60), s = Math.floor(t % 60), f = Math.floor((t % 1) * fps + 1e-6);
  const p = n => String(n).padStart(2, '0');
  if (!withFrames) return (m >= 60 ? Math.floor(m / 60) + ':' + p(m % 60) : p(m)) + ':' + p(s);
  return p(m) + ':' + p(s) + ':' + p(f);
}
function fmtSec(t) { return (Math.round(t * 100) / 100).toFixed(2).replace('.', ',') + 's'; }
function fmtBytes(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(0) + ' KB'; if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'; return (b / 1073741824).toFixed(2) + ' GB'; }
function fmtDate(ts) {
  const d = new Date(ts), now = new Date(), diff = (now - d) / 1000;
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return 'há ' + Math.floor(diff / 60) + ' min';
  if (diff < 86400 && d.getDate() === now.getDate()) return 'hoje, ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/* ---------- easing ---------- */
const Ease = {
  linear: t => t,
  in: t => t * t * t,
  out: t => 1 - Math.pow(1 - t, 3),
  inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  backIn: t => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
  bounce: t => { const n1 = 7.5625, d1 = 2.75; if (t < 1 / d1) return n1 * t * t; if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + .75; if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + .9375; return n1 * (t -= 2.625 / d1) * t + .984375; },
  elastic: t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI) / 3) + 1,
  hold: t => t >= 1 ? 1 : 0,
};
const EASE_NAMES = { linear: 'Linear', inOut: 'Suave', out: 'Desacelerar', in: 'Acelerar', back: 'Passar do ponto', backIn: 'Recuar e ir', bounce: 'Quicar', elastic: 'Elástico', hold: 'Pular (sem transição)' };

/* ---------- ícones (traço estilo Lucide) ---------- */
const ICONS = {
  brush: '<path d="M9.06 11.9 18 3a2.1 2.1 0 0 1 3 3l-8.9 8.94"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>',
  pencil: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/><path d="m15 5 4 4"/>',
  eraser: '<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L11 21z"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  bucket: '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4z"/>',
  pipette: '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3z"/>',
  bone: '<path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5z"/>',
  pivot: '<circle cx="12" cy="12" r="3"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  onion: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  fora: '<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M3 7V4a1 1 0 0 1 1-1h3M17 3h3a1 1 0 0 1 1 1v3M21 17v3a1 1 0 0 1-1 1h-3M7 21H4a1 1 0 0 1-1-1v-3"/>',
  frame: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
  start: '<path d="M6 5v14"/><path d="M19 5 9 12l10 7z" fill="currentColor"/>',
  end: '<path d="M18 5v14"/><path d="m5 5 10 7-10 7z" fill="currentColor"/>',
  prev: '<path d="m15 6-6 6 6 6"/>',
  next: '<path d="m9 6 6 6-6 6"/>',
  loop: '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  vol: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  paste: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2.5"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  shapes: '<path d="M8.3 10a.7.7 0 0 1-.6-1.1l3.7-6a.7.7 0 0 1 1.2 0l3.7 6a.7.7 0 0 1-.6 1.1z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
  wand: '<path d="m15 4 5 5L9 20l-5-5z"/><path d="M14 5l5 5"/><path d="M5 3v4M3 5h4M19 15v4M17 17h4"/>',
  transition: '<rect x="2" y="5" width="9" height="14" rx="1.5"/><rect x="13" y="5" width="9" height="14" rx="1.5" stroke-dasharray="2 2"/><path d="m9 12 6 0M13 9.5 15.5 12 13 14.5"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  gear: '<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.6a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.6a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  dots: '<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>',
  magnet: '<path d="m6 15-4-4 6.8-6.8a5.7 5.7 0 0 1 8 8L10 19l-4-4 6.8-6.8a.1.1 0 0 0-.1-.1z"/><path d="m5 8 4 4M12 15l4 4"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>',
  cursor: '<path d="m4 4 7 17 2.5-7.5L21 11z"/>',
  diamond: '<path d="M12 2 22 12 12 22 2 12z"/>',
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1" fill="currentColor"/><circle cx="8.5" cy="7.5" r="1" fill="currentColor"/><circle cx="6.5" cy="12.5" r="1" fill="currentColor"/><path d="M12 2a10 10 0 0 0 0 20c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2a5.6 5.6 0 0 0 5.4-5.6C22 6 17.5 2 12 2z"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  move: '<path d="m5 9-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
  wave: '<path d="M2 12h2M6 8v8M10 4v16M14 7v10M18 10v4M22 12h0"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  rec: '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  package: '<path d="m7.5 4.3 9 5.2M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  safe: '<rect x="2" y="4" width="20" height="16" rx="2"/><rect x="6" y="7" width="12" height="10" rx="1" stroke-dasharray="2 2"/>',
  jump: '<path d="M4 20h16"/><path d="M12 16V4M8 8l4-4 4 4"/>',
  split: '<path d="M12 3v18"/><rect x="2" y="7" width="7" height="10" rx="1.5"/><rect x="15" y="7" width="7" height="10" rx="1.5"/>',
  marker: '<path d="M6 3h12v13l-6 5-6-5z"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M8 16h8M10 13h4"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  dup: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/><path d="M15 12v6M12 15h6"/>',
  ripple: '<path d="M3 12h6M15 12h6M9 8l-3 4 3 4M15 8l3 4-3 4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  tv: '<rect x="2" y="7" width="20" height="15" rx="2"/><path d="m17 2-5 5-5-5"/>',
  flip: '<path d="M12 3v18"/><path d="M8 7 3 12l5 5zM16 7l5 5-5 5z"/>',
  gif: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M9 10H7.5A1.5 1.5 0 0 0 6 11.5v1A1.5 1.5 0 0 0 7.5 14H9v-2H8M12 10v4M15 14v-4h3M15 12h2"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
};
function ic(name, size = 16, sw = 2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.info}</svg>`;
}

/* ---------- Pop-ups do editor (sem alert/confirm do navegador) ---------- */
const UI = {
  modal(o) {
    return new Promise(resolve => {
      const root = $('#modal-root');
      const back = h(`<div class="modal-back"><div class="modal" style="${o.width ? 'width:' + o.width + 'px' : ''}">
        <div class="modal-head">${o.icon ? `<div class="modal-icon ${o.kind || ''}">${ic(o.icon, 18)}</div>` : ''}<h3>${esc(o.title || '')}</h3>
        ${o.noClose ? '' : `<button class="ibtn" data-x title="Fechar (Esc)">${ic('x')}</button>`}</div>
        <div class="modal-body"></div><div class="modal-foot"></div></div></div>`);
      const body = $('.modal-body', back), foot = $('.modal-foot', back);
      if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
      let done = false;
      const close = v => {
        if (done) return; done = true;
        document.removeEventListener('keydown', onKey, true);
        back.classList.add('out'); setTimeout(() => back.remove(), 150);
        resolve(v);
      };
      const api = { el: back, body, close, foot };
      (o.buttons || [{ label: 'OK', kind: 'primary', value: true }]).forEach(b => {
        const btn = h(`<button class="btn ${b.kind || ''}">${b.icon ? ic(b.icon, 14) : ''}${esc(b.label)}</button>`);
        if (b.left) btn.style.marginRight = 'auto';
        btn.onclick = async () => {
          if (b.onClick) { const r = await b.onClick(api); if (r === false) return; if (r !== undefined && r !== true) return close(r); }
          close(b.value !== undefined ? b.value : (b.collect ? b.collect(api) : b.label));
        };
        foot.appendChild(btn);
      });
      if (!o.buttons || !o.buttons.length) foot.remove();
      const onKey = e => {
        if (e.key === 'Escape' && !o.noClose) { e.stopPropagation(); e.preventDefault(); close(o.cancelValue ?? null); }
        if (e.key === 'Enter' && o.enterValue !== undefined && !(e.target.tagName === 'TEXTAREA')) {
          e.preventDefault(); e.stopPropagation();
          const def = foot.querySelector('.btn.primary'); if (def) def.click();
        }
      };
      document.addEventListener('keydown', onKey, true);
      const xb = $('[data-x]', back); if (xb) xb.onclick = () => close(o.cancelValue ?? null);
      back.addEventListener('mousedown', e => { if (e.target === back && !o.noClose && !o.sticky) close(o.cancelValue ?? null); });
      root.appendChild(back);
      if (o.onOpen) o.onOpen(api);
      setTimeout(() => { const f = $('input:not([type=checkbox]):not([type=range]):not([type=color]),textarea', body); if (f && !o.noFocus) { f.focus(); f.select && f.select(); } }, 30);
    });
  },
  confirm({ title = 'Tem certeza?', msg = '', ok = 'Confirmar', cancel = 'Cancelar', danger = false, icon, kind }) {
    return UI.modal({
      title, icon: icon || (danger ? 'alert' : 'info'), kind: kind || (danger ? 'danger' : 'warn'), body: `<p>${msg}</p>`, enterValue: true, cancelValue: false,
      buttons: [{ label: cancel, value: false }, { label: ok, kind: danger ? 'danger' : 'primary', value: true }]
    });
  },
  prompt({ title, label = '', value = '', ok = 'OK', icon = 'edit', placeholder = '', multiline = false }) {
    return UI.modal({
      title, icon, enterValue: !multiline, cancelValue: null, width: multiline ? 640 : undefined,
      body: multiline ? `<label class="field">${esc(label)}<textarea rows="16" style="width:100%;font-size:12.5px" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>` : `<label class="field">${esc(label)}<input type="text" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`,
      buttons: [{ label: 'Cancelar', value: null }, { label: ok, kind: 'primary', collect: a => $(multiline ? 'textarea' : 'input', a.body).value.trim() || null }]
    });
  },
  toast(msg, o = {}) {
    const root = $('#toast-root');
    const kind = o.kind || 'info';
    const icn = { ok: 'check', warn: 'alert', err: 'alert', info: 'info' }[kind];
    const t = h(`<div class="toast ${kind}"><span class="toast-ic">${ic(icn, 16)}</span><div class="toast-msg">${msg}</div>
      ${o.undo ? `<button class="toast-undo">Desfazer</button>` : ''}${o.action ? `<button class="toast-undo" data-a>${esc(o.action.label)}</button>` : ''}<button class="toast-x">${ic('x', 14)}</button></div>`);
    const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 250); };
    if (o.undo) $('.toast-undo', t).onclick = () => { o.undo(); kill(); };
    if (o.action) $('[data-a]', t).onclick = () => { o.action.fn(); kill(); };
    $('.toast-x', t).onclick = kill;
    root.appendChild(t);
    while (root.children.length > 3) root.firstChild.remove();
    setTimeout(kill, o.time || (o.undo ? 6000 : 3500));
    return t;
  },
  ctx(x, y, items) {
    UI.closeCtx();
    const root = $('#ctx-root');
    const build = (list, px, py, parent) => {
      const m = h('<div class="ctx"></div>');
      list.forEach(it => {
        if (!it) return;
        if (it === '-') return m.appendChild(h('<div class="ctx-sep"></div>'));
        if (it.head) return m.appendChild(h(`<div class="ctx-head">${esc(it.head)}</div>`));
        const el = h(`<div class="ctx-item ${it.disabled ? 'dis' : ''} ${it.danger ? 'danger' : ''} ${it.ai ? 'ai' : ''} ${it.used ? 'used' : ''}"><span class="ctx-ic">${it.icon ? ic(it.icon, 14) : (it.checked ? ic('check', 14) : '')}</span><span class="ctx-label">${esc(it.label)}</span>${it.key ? `<span class="ctx-key">${esc(it.key)}</span>` : ''}${it.sub ? ic('right', 13) : ''}</div>`);
        if (it.sub) {
          el.onmouseenter = () => {
            $$('.ctx', root).forEach(c => { if (+c.dataset.lv > +m.dataset.lv) c.remove(); });
            $$('.ctx-item.open', m).forEach(e => e.classList.remove('open'));
            el.classList.add('open');
            const r = el.getBoundingClientRect();
            const sm = build(it.sub, r.right + 2, r.top - 5, m); sm.dataset.lv = +m.dataset.lv + 1;
          };
        } else {
          el.onmouseenter = () => { $$('.ctx', root).forEach(c => { if (+c.dataset.lv > +m.dataset.lv) c.remove(); }); $$('.ctx-item.open', m).forEach(e => e.classList.remove('open')); };
          el.onclick = () => { UI.closeCtx(); it.action && it.action(); };
        }
        m.appendChild(el);
      });
      m.dataset.lv = parent ? 1 : 0;
      root.appendChild(m);
      const r = m.getBoundingClientRect();
      if (px + r.width > innerWidth - 6) px = parent ? parent.getBoundingClientRect().left - r.width - 2 : innerWidth - r.width - 6;
      if (py + r.height > innerHeight - 6) py = Math.max(6, innerHeight - r.height - 6);
      m.style.left = px + 'px'; m.style.top = py + 'px';
      return m;
    };
    build(items, x, y);
    setTimeout(() => {
      const off = e => { if (!e.target.closest('.ctx')) { UI.closeCtx(); } };
      UI._ctxOff = off;
      document.addEventListener('mousedown', off, true);
    }, 0);
  },
  busy(title, html) {
    let api = null, pending = false;
    UI.modal({ title, icon: 'clock', noClose: true, body: html, buttons: [], onOpen: a => { api = a; if (pending) a.close(); } });
    return { close: () => api ? api.close() : (pending = true), set: s => api && (api.body.innerHTML = s), get body() { return api && api.body; } };
  },
  closeCtx() {
    $('#ctx-root').innerHTML = '';
    if (UI._ctxOff) { document.removeEventListener('mousedown', UI._ctxOff, true); UI._ctxOff = null; }
  },
};

/* ---------- arrastar com o mouse ---------- */
function dragPointer(e, onMove, onUp) {
  const sx = e.clientX, sy = e.clientY;
  document.body.classList.add('dragging');
  const mv = ev => onMove(ev, ev.clientX - sx, ev.clientY - sy);
  const up = ev => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
    document.body.classList.remove('dragging');
    onUp && onUp(ev, ev.clientX - sx, ev.clientY - sy);
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}

/* ---------- ZIP (sem compressão) para o arquivo .pstudio ---------- */
const Zip = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[i] = c >>> 0; }
  const crc32 = d => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = table[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const enc = new TextEncoder();
  function create(files) {
    const parts = [], central = []; let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = f.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((a, b) => a + (b.byteLength ?? b.length), 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
  }
  function read(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder(), out = new Map();
    let e = buf.byteLength - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Arquivo inválido (não é um projeto do Estúdio Problems).');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Arquivo corrompido.');
      const method = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      if (method !== 0) throw new Error('Arquivo compactado com outro programa. Abra o .pstudio original, sem recompactar.');
      const lnl = dv.getUint16(lo + 26, true), lxl = dv.getUint16(lo + 28, true), ds = lo + 30 + lnl + lxl;
      out.set(name, u8.subarray(ds, ds + csz));
      p += 46 + nl + xl + cl;
    }
    return out;
  }
  return { create, read, crc32 };
})();

function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
function pickFiles(accept, multiple = true) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple;
    i.onchange = () => res(Array.from(i.files || [])); i.click();
  });
}
function safeName(s) { return String(s || 'projeto').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'projeto'; }
function hexToRgb(hx) { hx = (hx || '#000').replace('#', ''); if (hx.length === 3) hx = hx.split('').map(c => c + c).join(''); const n = parseInt(hx, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function seeded(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }

/* ---------- avisos do sistema (notificação) e progresso no título da aba ---------- */
const Notify = {
  get on() { return 'Notification' in window && Notification.permission === 'granted'; },
  // pop-up ao abrir o editor (só se as notificações ainda não estiverem ativadas)
  async offer(force) {
    if (!('Notification' in window)) { if (force) UI.toast('Este navegador não tem notificações.', { kind: 'warn' }); return; }
    if (Notification.permission === 'granted') { if (force) UI.toast('As notificações já estão ativadas ✓', { kind: 'ok' }); return; }
    if (!force) { try { if (localStorage.getItem('ps-notif-never') === '1' || sessionStorage.getItem('ps-notif-asked')) return; sessionStorage.setItem('ps-notif-asked', '1'); } catch { } }
    for (let i = 0; i < 600 && document.querySelector('.modal-back'); i++) await new Promise(r => setTimeout(r, 500)); // espera outras janelas fecharem
    const denied = Notification.permission === 'denied';
    const f = h(`<div><div style="display:flex;gap:14px;align-items:center"><div style="font-size:34px">🔔</div><p style="margin:0">Ative as notificações para eu te avisar quando <b>a IA terminar uma edição</b> ou quando <b>um vídeo terminar de exportar</b> — mesmo se você estiver em outra aba ou com o navegador minimizado.</p></div>
      ${denied ? `<div class="hint" style="margin-top:12px">${ic('info', 12)} As notificações estão <b>bloqueadas</b> neste site. Para liberar: clique no cadeado ao lado do endereço → Notificações → Permitir, e recarregue a página.</div>` : ''}
      <label class="switch" style="margin-top:12px"><input type="checkbox" data-never><i></i>Não perguntar de novo</label></div>`);
    const r = await UI.modal({ title: 'Ativar notificações?', icon: 'info', width: 480, body: f, cancelValue: 'later', buttons: [{ label: 'Depois', value: 'later', onClick: () => { if ($('[data-never]', f).checked) try { localStorage.setItem('ps-notif-never', '1'); } catch { } } }, ...(denied ? [] : [{ label: 'Ativar notificações', kind: 'primary', value: 'on' }])] });
    if (r !== 'on') { if ($('[data-never]', f).checked) try { localStorage.setItem('ps-notif-never', '1'); } catch { } return; }
    try { const p = await Notification.requestPermission(); UI.toast(p === 'granted' ? 'Notificações ativadas ✓' : 'As notificações não foram permitidas.', { kind: p === 'granted' ? 'ok' : 'warn' }); } catch { }
  },
  async ask() { try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch { } },
  send(title, body) {
    try { if (typeof AudioEngine !== 'undefined') AudioEngine.preview('snd:correct', .6); } catch { }
    try {
      if ('Notification' in window && Notification.permission === 'granted' && (document.hidden || !document.hasFocus())) {
        const n = new Notification(title, { body, icon: document.querySelector('link[rel=icon]')?.href, tag: 'turma-studios' });
        n.onclick = () => { window.focus(); n.close(); };
      }
    } catch { }
  },
};
const TabTitle = {
  base() { return ESTUDIO.titulo + (typeof App !== 'undefined' && App.project ? ' | ' + App.project.name : ''); },
  set(pct, label) { document.title = `${pct != null ? Math.round(pct * 100) + '% ' : '⏳ '}${label} — ${this.base()}`; },
  clear() { document.title = this.base(); },
};
