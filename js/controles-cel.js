/* ===================== controles-cel.js — preenchimento dos sliders do Celeste (12/11/2026) =====================
   O CSS (css/blender.css) pinta o trilho com a cor de destaque até --pct. Aqui só se calcula --pct de cada input[type=range]:
   ao mexer, quando aparecem sliders novos e a cada meio segundo (valor mudado por código não dispara evento). Nada mais. */
'use strict';
(() => {
  const pct = el => { const a = +el.min || 0, b = el.max === '' ? 100 : +el.max, v = +el.value; const p = b > a ? (v - a) / (b - a) * 100 : 0; const s = Math.max(0, Math.min(100, p)).toFixed(1) + '%'; if (el._pct !== s) { el._pct = s; el.style.setProperty('--pct', s); } };
  const varre = () => { for (const el of document.querySelectorAll('input[type=range]')) pct(el); };
  document.addEventListener('input', e => { if (e.target?.type === 'range') pct(e.target); }, true);
  let fila = 0; const agenda = () => { if (!fila) fila = requestAnimationFrame(() => { fila = 0; varre(); }); };
  const liga = () => { varre(); new MutationObserver(agenda).observe(document.body, { childList: true, subtree: true }); setInterval(varre, 500); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', liga); else liga();
})();
