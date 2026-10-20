/* ===================== camera-editor.js — câmera do vídeo no editor (posição, zoom, giro + keyframes) =====================
   Modo "🎥 Câmera" da prévia: arrastar = mover · Shift+arrastar ou rodinha = zoom · Alt+arrastar = girar.
   Cada mudança vira keyframe no tempo do cursor (project.camera.keys, tempo em segundos). Aparece no resultado final e na exportação. */
'use strict';
const EdCam = {
  keys() { const p = App.project; p.camera ||= { keys: {} }; p.camera.keys ||= {}; return p.camera.keys; },
  at(t = App.t) { return Renderer.camAt(App.project, t); },
  set(ch, v, t = App.t) { const k = this.keys(); AnimMath.setKey(k[ch] ||= [], round(App.frame(t), 3), round(v, 3), 'ease'); },
  setAll(c, t = App.t) { for (const ch of ['X', 'Y', 'Z', 'R']) this.set(ch, c[ch], t); },
  times() { const s = new Set(); for (const ks of Object.values(this.keys())) for (const k of ks) s.add(k.f); return [...s].sort((a, b) => a - b); },
  hasKey(t = App.t) { return this.times().some(x => Math.abs(x - App.frame(t)) < 1e-3); },
  touched() { App.requestRender(); Props.render(); },

  /* ---------- barra da câmera (aparece no modo Câmera) ---------- */
  bar() { const b = $('#ed-cbar'); if (b) { b.classList.remove('on'); b.innerHTML = ''; } Props.render(); },
  // configurações da câmera (painel da direita)
  panel() {
    const c = this.at(), key = this.hasKey(), n = this.times().length, w = h(`<div class="cam-p">
      <div class="pp-head"><div class="pp-type">🎥</div><b class="pp-name">Câmera</b><span class="sp"></span><small>${n ? n + ' keyframe(s)' : 'parada'}</small></div>
      <div class="sec"><div class="sec-h">Posição e zoom (em ${fmtTime(App.t, App.fps, false)})</div>
        <div class="cam-g"><label>↔ Lado<input type="number" step="10" value="${round(c.X, 1)}" data-c="X"></label><label>↕ Cima/baixo<input type="number" step="10" value="${round(c.Y, 1)}" data-c="Y"></label>
        <label>🔍 Zoom %<input type="number" step="5" value="${Math.round(c.Z * 100)}" data-c="Z"></label><label>⟳ Girar °<input type="number" step="1" value="${round(c.R, 1)}" data-c="R"></label></div>
        <input type="range" min="20" max="400" value="${Math.round(c.Z * 100)}" data-zr style="width:100%">
        <small class="cam-n">Na prévia (modo 🎥 Câmera): arrastar = mover · Shift = zoom · Alt = girar · rodinha = zoom</small></div>
      <div class="sec"><div class="sec-h">Keyframes</div><div class="cam-k">
        <button class="ibtn" data-a="prev" title="Keyframe anterior">${ic('left', 15)}</button><button class="btn sm ${key ? 'on' : ''}" data-a="key">${ic('diamond', 12)} ${key ? 'Marcado aqui' : 'Marcar aqui'}</button><button class="ibtn" data-a="next" title="Próximo keyframe">${ic('right', 15)}</button>
        ${key ? `<button class="ibtn" data-a="del" title="Apagar este keyframe">${ic('trash', 14)}</button>` : ''}</div></div>
      <div class="sec"><div class="sec-h">Animações prontas</div><div class="cam-pr">
        <button class="btn sm" data-a="punch">💥 Zoom de impacto</button><button class="btn sm" data-a="slow">🔍 Aproximar devagar</button><button class="btn sm" data-a="shake">〰 Tremer</button><button class="btn sm" data-a="reset">↺ Zerar câmera</button></div></div></div>`);
    $$('[data-c]', w).forEach(i => i.onchange = () => { const v = +i.value; this.set(i.dataset.c, i.dataset.c === 'Z' ? v / 100 : v); App.commit('Câmera'); this.touched(); });
    $('[data-zr]', w).oninput = e => { this.set('Z', e.target.value / 100); App.requestRender(); }; $('[data-zr]', w).onchange = () => { App.commit('Zoom da câmera'); this.touched(); };
    $('[data-a=key]', w).onclick = () => { this.setAll(this.at()); App.commit('Keyframe da câmera'); this.touched(); };
    $('[data-a=prev]', w).onclick = () => { const t = [...this.times()].reverse().find(x => x < App.frame(App.t) - 1e-3); if (t !== undefined) App.seek(t); Props.render(); };
    $('[data-a=next]', w).onclick = () => { const t = this.times().find(x => x > App.frame(App.t) + 1e-3); if (t !== undefined) App.seek(t); Props.render(); };
    $('[data-a=del]', w)?.addEventListener('click', () => { const t = App.frame(App.t), k = this.keys(); for (const ch of Object.keys(k)) { k[ch] = k[ch].filter(x => Math.abs(x.f - t) > 1e-3); if (!k[ch].length) delete k[ch]; } App.commit('Keyframe da câmera apagado'); this.touched(); });
    $('[data-a=reset]', w).onclick = () => { App.project.camera = { keys: {} }; App.commit('Câmera zerada'); this.touched(); };
    for (const k of ['punch', 'slow', 'shake']) $(`[data-a=${k}]`, w).onclick = () => this.preset(k);
    return w;
  },
  // prontos (também usados pela IA)
  preset(kind, t0 = App.t, o = {}) {
    const c0 = this.at(t0), f = 1 / App.fps;
    if (kind === 'punch') { this.setAll(c0, t0); this.setAll({ ...c0, Z: c0.Z * (o.zoom || 1.35) }, t0 + 4 * f); this.setAll({ ...c0, Z: c0.Z * (o.zoom || 1.35) }, t0 + (o.dur || .8)); this.setAll(c0, t0 + (o.dur || .8) + 8 * f); }
    else if (kind === 'slow') { this.setAll(c0, t0); this.setAll({ ...c0, Z: c0.Z * (o.zoom || 1.2) }, t0 + (o.dur || 3)); }
    else if (kind === 'shake') { this.setAll(c0, t0); const n = Math.round((o.dur || .5) * App.fps / 2); for (let i = 1; i <= n; i++) this.setAll({ ...c0, X: c0.X + (i % 2 ? 1 : -1) * (o.forca || 18) * (1 - i / (n + 1)), Y: c0.Y + (i % 3 - 1) * (o.forca || 18) * .5 }, t0 + i * 2 * f); this.setAll(c0, t0 + (n + 1) * 2 * f); }
    App.commit({ punch: 'Zoom de impacto', slow: 'Aproximar devagar', shake: 'Tremida da câmera' }[kind]); this.touched();
  },

  /* ---------- arrastar na prévia ---------- */
  down(e) {
    if (e.button !== 0) return false; e.preventDefault();
    const c0 = this.at(), r = $('#pv-overlay').getBoundingClientRect(), sx = e.clientX, sy = e.clientY, out = !!App.outside;
    let moved = false;
    dragPointer(e, ev => {
      const dx = (ev.clientX - sx) / App.pvScale, dy = (ev.clientY - sy) / App.pvScale; moved = true;
      const sdx = ev.clientX - sx, sdy = ev.clientY - sy;
      if (ev.shiftKey) this.set('Z', clamp(c0.Z * Math.exp(-sdy / 220), .2, 8));
      else if (ev.altKey) this.set('R', c0.R + sdx / 3);
      else if (out) { this.set('X', c0.X + dx); this.set('Y', c0.Y + dy); } // vendo de fora: a moldura vai junto com o mouse
      else { this.set('X', c0.X - dx / c0.Z); this.set('Y', c0.Y - dy / c0.Z); } // vendo pela câmera: arrasta a cena
      App.requestRender();
    }, () => { if (moved) { App.commit('Câmera'); this.touched(); } });
    return true;
  },
  wheel(e) { if (!App.camTool) return false; e.preventDefault(); const c = this.at(); this.set('Z', clamp(c.Z * (e.deltaY < 0 ? 1.06 : 1 / 1.06), .2, 8)); App.requestRender(); clearTimeout(this._wt); this._wt = setTimeout(() => { App.commit('Zoom da câmera'); Props.render(); }, 400); return true; },
};
