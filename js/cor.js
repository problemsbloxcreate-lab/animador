/* ===================== cor.js — caixa de cor (painel da direita) =====================
   Quadrado de cor (saturação × brilho) + barra de matiz + R G B (barra e número) + #hex + cores recentes.
   Usado no editor de imagem e no modo Desenhar. ColorBox.make(get, set) → elemento; el.sync(hex) atualiza. */
'use strict';
const ColorBox = {
  BASE: ['#000000', '#ffffff', '#7f7f7f', '#ff4d4d', '#ff9f1a', '#ffd23d', '#3ddc84', '#2fd6c4', '#3d8bff', '#8b6bff', '#ff6bcb', '#8a5a3c'],
  recent() { try { return JSON.parse(localStorage.getItem('cores-recentes') || '[]'); } catch { return []; } },
  remember(c) { const r = [c, ...this.recent().filter(x => x !== c)].slice(0, 12); try { localStorage.setItem('cores-recentes', JSON.stringify(r)); } catch { } },
  toHsv([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx]; },
  toRgb(h, s, v) { const f = n => { const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); }; return [f(5), f(3), f(1)]; },
  hex(rgb) { return '#' + rgb.map(x => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join(''); },
  make(get, set) {
    const el = h(`<div class="cbx"><div class="cbx-top"><canvas class="cbx-sv" width="220" height="120"></canvas><canvas class="cbx-h" width="16" height="120"></canvas></div>
      <div class="cbx-rgb">${['R', 'G', 'B'].map((l, i) => `<label><span>${l}</span><input type="range" min="0" max="255" data-c="${i}"><input type="number" min="0" max="255" data-n="${i}"></label>`).join('')}</div>
      <div class="cbx-row"><i class="cbx-now"></i><input class="cbx-hex" maxlength="7" spellcheck="false"><span class="sp"></span></div><div class="cbx-sw"></div></div>`);
    let hsv = this.toHsv(hexToRgb(get() || '#000000')), drag = false;
    const sv = $('.cbx-sv', el), hu = $('.cbx-h', el);
    // a tela do quadrado/matiz tem o tamanho real mostrado (senão a bolinha fica esticada)
    const fit = cv => { const d = devicePixelRatio || 1, w = Math.max(1, Math.round(cv.clientWidth * d)), hh = Math.max(1, Math.round(cv.clientHeight * d)); if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; } return d; };
    const paint = () => {
      const dpr = fit(sv); fit(hu); const g = sv.getContext('2d'), W = sv.width, H = sv.height; g.fillStyle = this.hex(this.toRgb(hsv[0], 1, 1)); g.fillRect(0, 0, W, H);
      let gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const x = hsv[1] * W, y = (1 - hsv[2]) * H; g.lineWidth = 2 * dpr; g.strokeStyle = hsv[2] > .5 ? '#000' : '#fff'; g.beginPath(); g.arc(x, y, 6 * dpr, 0, 7); g.stroke(); g.lineWidth = 1 * dpr; g.strokeStyle = hsv[2] > .5 ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(x, y, 7.5 * dpr, 0, 7); g.stroke();
      const q = hu.getContext('2d'), hg = q.createLinearGradient(0, 0, 0, hu.height); for (let i = 0; i <= 6; i++) hg.addColorStop(i / 6, this.hex(this.toRgb(i * 60, 1, 1))); q.fillStyle = hg; q.fillRect(0, 0, hu.width, hu.height);
      const hy = hsv[0] / 360 * hu.height; q.fillStyle = '#fff'; q.fillRect(0, hy - 1.5 * dpr, hu.width, 3 * dpr); q.lineWidth = dpr; q.strokeStyle = '#000'; q.strokeRect(.5, hy - 2 * dpr, hu.width - 1, 4 * dpr);
    };
    const fill = c => { const rgb = hexToRgb(c); $$('[data-c]', el).forEach((i, j) => i.value = rgb[j]); $$('[data-n]', el).forEach((i, j) => i.value = rgb[j]); $('.cbx-hex', el).value = c; $('.cbx-now', el).style.background = c; };
    const swatches = () => { const w = $('.cbx-sw', el); w.innerHTML = ''; const cur = get(); for (const c of [...this.recent(), ...this.BASE.filter(x => !this.recent().includes(x))].slice(0, 20)) { const b = h(`<button style="background:${c}" title="${c}" class="${c === cur ? 'on' : ''}"></button>`); b.onclick = () => apply(c, true, true); w.appendChild(b); } };
    const apply = (c, fromHex, keep) => { if (fromHex) hsv = this.toHsv(hexToRgb(c)); set(c); fill(c); paint(); if (keep) { this.remember(c); swatches(); } };
    const fromHsv = () => apply(this.hex(this.toRgb(...hsv)));
    const pick = (cv, fn) => cv.addEventListener('pointerdown', e => { e.preventDefault(); const go = ev => { const r = cv.getBoundingClientRect(); fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); fromHsv(); }; go(e); dragPointer(e, go, () => { this.remember(get()); swatches(); }); });
    pick(sv, (x, y) => { hsv[1] = x; hsv[2] = 1 - y; }); pick(hu, (x, y) => { hsv[0] = Math.min(359.9, y * 360); });
    const rgbIn = i => { const v = [0, 1, 2].map(j => clamp(+(i.dataset.c != null ? $(`[data-c="${j}"]`, el) : $(`[data-n="${j}"]`, el)).value || 0, 0, 255)); apply(this.hex(v), true); };
    $$('[data-c],[data-n]', el).forEach(i => { i.oninput = () => rgbIn(i); i.onchange = () => { this.remember(get()); swatches(); }; });
    $('.cbx-hex', el).onchange = e => { let v = e.target.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) apply(v.toLowerCase(), true, true); else e.target.value = get(); };
    el.sync = c => { if (!c || c === $('.cbx-hex', el).value) return; hsv = this.toHsv(hexToRgb(c)); fill(c); paint(); };
    fill(get() || '#000000'); paint(); swatches();
    new ResizeObserver(() => paint()).observe(sv);
    return el;
  },
};
