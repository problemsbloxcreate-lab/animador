/* ===================== anim/desenho.js — desenhar no estúdio (pincel, lápis, borracha, balde, conta-gotas),
   quadro a quadro, papel-cebola colorido, câmera e prévia no vídeo =====================
   Os traços vão para o DESENHO atual da parte selecionada (ou para uma camada "Desenho" nova).
   Cada traço salva uma imagem NOVA (a anterior continua guardada — Ctrl+Z volta). */
'use strict';

const DrawLive = new WeakMap(); // desenho → canvas vivo (enquanto pinta)
const Desenho = {
  TOOLS: ['pincel', 'lapis', 'borracha', 'balde', 'conta'],
  opt: { size: 8, smooth: 45, opacity: 100, pressure: true, color: '#1e1424', tol: 32, gap: 2, quadro: false, passo: 1 },
  load() { try { Object.assign(this.opt, JSON.parse(localStorage.getItem('an-brush') || '{}')); } catch { } },
  save() { try { localStorage.setItem('an-brush', JSON.stringify(this.opt)); } catch { } },
  PRESETS: [['Fino', 3, 30], ['Contorno', 6, 50], ['Médio', 12, 40], ['Grosso', 24, 35], ['Pintar', 48, 20]],
  palette(P) { P.palette ||= ['#1e1424', '#ffffff', '#f1c6a8', '#c98f6b', '#8a5a44', '#e8457a', '#3d8bff', '#2fcf7a', '#ffd23d', '#7b4dff', '#333a44', '#9aa3b5']; return P.palette; },
  isTool(t) { return this.TOOLS.includes(t); },

  /* ---------- qual desenho recebe o traço ---------- */
  target(create = true) {
    const S = Studio, P = S.P; let rig = S.selRig, n = S.selNode;
    if (!rig && !create) return null;
    if (!rig) { rig = Rig.newRig({ name: 'Desenho', w: P.settings.w, h: P.settings.h }); rig.ox = P.settings.w / 2; rig.oy = P.settings.h; rig.stage = { X: 0, Y: P.settings.h / 2, S: 1, F: 1, O: 100 }; rig.breath = 0; P.rigs.push(rig); S.selRig = rig; }
    if (!n) { if (!create) return null; n = this.newLayer(rig); }
    const f = S.f, ks = rig.keys[n.id]?.d || [];
    let di = Math.round(Rig.ch(rig, n.id, 'd', f, n.d || 0));
    // quadro a quadro: se este quadro ainda não tem desenho próprio, cria um vazio aqui
    if (this.opt.quadro && S.mode === 'animar' && !ks.some(k => k.f === f) && (ks.length || n.drawings.some(d => d.asset))) di = this.newDrawing(rig, n, false);
    let dr = n.drawings[di]; if (!dr) { di = this.newDrawing(rig, n, false); dr = n.drawings[di]; }
    return { rig, n, dr, di };
  },
  newLayer(rig, name) {
    const P = Studio.P, par = Rig.roots(rig)[0] || null, n = Rig.newNode({ name: name || 'Desenho ' + (rig.nodes.filter(x => /^Desenho/.test(x.name)).length + 1), role: 'parte', parent: par?.id || null, px: rig.w / 2, py: rig.h / 2, z: Math.max(0, ...rig.nodes.map(x => x.z)) + 1 });
    n.layer = true; n.drawings = []; rig.nodes.push(n); n.drawings.push(this.blank(rig, n)); Studio.selNode = n; return n;
  },
  // desenho vazio cobrindo o personagem inteiro (em coordenadas da parte, na pose de montagem)
  blank(rig, n, name) {
    // cobre o quadro inteiro da câmera (e um pouco em volta), para dar para desenhar em qualquer lugar da cena
    try {
      const S = Studio, P = S.P, W = P.settings.w, H = P.settings.h; Rig.REST = true; const M = Rig.pose(rig, S.f); Rig.REST = false;
      if (M[n.id]) {
        const inv = Rig.stageMatrix(rig, S.f, W, H).multiply(M[n.id]).inverse(), m = .12 * Math.max(W, H);
        const q = [[-m, -m], [W + m, -m], [W + m, H + m], [-m, H + m]].map(([x, y]) => inv.transformPoint(new DOMPoint(x, y)));
        const x0 = Math.min(...q.map(p => p.x)), y0 = Math.min(...q.map(p => p.y)), x1 = Math.max(...q.map(p => p.x)), y1 = Math.max(...q.map(p => p.y));
        if (isFinite(x0) && x1 - x0 > 1) return { asset: null, name: name || 'desenho', ox: round(x0, 1), oy: round(y0, 1), w: round(x1 - x0, 1), h: round(y1 - y0, 1), blank: true };
      }
    } catch { Rig.REST = false; }
    const pad = .25, w = rig.w * (1 + pad * 2), h = rig.h * (1 + pad * 2); return { asset: null, name: name || 'desenho', ox: round(-n.px - rig.w * pad, 1), oy: round(-n.py - rig.h * pad, 1), w: round(w, 1), h: round(h, 1), blank: true }; },
  newDrawing(rig, n, copy) {
    const cur = Rig.drawingAt(rig, n, Studio.f), d = copy && cur?.asset ? { ...cur, name: (cur.name || 'desenho') + ' (cópia)' } : this.blank(rig, n, 'quadro ' + (Studio.f + 1));
    const ks = rig.keys[n.id]?.d; if (!ks?.length && Studio.f > 0) Rig.setKey(rig, n.id, 'd', 0, n.d || 0, 'hold'); // os quadros anteriores continuam com o desenho de antes
    n.drawings.push(d); const i = n.drawings.length - 1; Rig.setKey(rig, n.id, 'd', Studio.f, i, 'hold'); n._mk = null; return i;
  },
  // canvas editável do desenho (tamanho em pixels limitado)
  canvasOf(dr) {
    let cv = DrawLive.get(dr); if (cv) return cv;
    const rt = dr.asset && Assets.get(dr.asset), k = rt?.img ? rt.img.naturalWidth / (dr.w || rt.img.naturalWidth) : Math.min(1.5, 3200 / Math.max(dr.w, dr.h));
    cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(dr.w * k)); cv.height = Math.max(1, Math.round(dr.h * k)); cv._k = k;
    if (rt?.img) cv.getContext('2d').drawImage(rt.img, 0, 0, cv.width, cv.height);
    DrawLive.set(dr, cv); return cv;
  },
  // ponto da tela → pixel do desenho
  mapper(T) {
    const S = Studio, P = S.P, W = P.settings.w, H = P.settings.h, rig = T.rig, n = T.n;
    Rig.REST = S.mode === 'montar'; const M = Rig.pose(rig, S.f), B = S.baseMatrix().multiply(Rig.stageMatrix(rig, S.f, W, H)); Rig.REST = false;
    const inv = B.multiply(M[n.id]).inverse(), cv = this.canvasOf(T.dr), k = cv._k, dr = T.dr;
    const sc = Math.hypot(B.a, B.b) * Math.hypot(M[n.id].a, M[n.id].b); // pixels de tela por unidade do personagem
    return { cv, k, screenPerUnit: sc, map: (sx, sy) => { const q = inv.transformPoint(new DOMPoint(sx, sy)); return { x: (q.x - dr.ox) * k, y: (q.y - dr.oy) * k }; } };
  },

  /* ---------- pintar ---------- */
  down(e, p) {
    const t = Studio.tool; if (t === 'conta') return this.pick(p);
    const T = this.target(true); if (!T) return; Studio.select({ t: 'node', rig: T.rig, n: T.n });
    const Mp = this.mapper(T), cv = Mp.cv, g = cv.getContext('2d'), o = this.opt, d = devicePixelRatio || 1;
    if (t === 'balde') { const q = Mp.map(p.x, p.y); if (this.fill(cv, q.x, q.y, o.color, o.tol, o.gap)) this.finish(T, 'Pintou com o balde'); return; }
    const base = document.createElement('canvas'); base.width = cv.width; base.height = cv.height; base.getContext('2d').drawImage(cv, 0, 0);
    const stroke = document.createElement('canvas'); stroke.width = cv.width; stroke.height = cv.height; const sg = stroke.getContext('2d');
    const px = o.size * d / Math.max(1e-6, Mp.screenPerUnit) * Mp.k; // tamanho do pincel em pixels do desenho (o tamanho é o que você vê na tela)
    sg.lineCap = 'round'; sg.lineJoin = 'round'; sg.strokeStyle = sg.fillStyle = t === 'borracha' ? '#000' : o.color;
    const sm = clamp(o.smooth / 100, 0, .95); let last = null, sp = Mp.map(p.x, p.y), pts = 0;
    const press = ev => (t === 'pincel' && o.pressure && ev.pointerType === 'pen') ? clamp(ev.pressure || .5, .1, 1) : 1;
    const put = (q, w) => { if (!last) { sg.beginPath(); sg.arc(q.x, q.y, w / 2, 0, 7); sg.fill(); last = { ...q, w }; return; } sg.lineWidth = (last.w + w) / 2; sg.beginPath(); sg.moveTo(last.x, last.y); sg.lineTo(q.x, q.y); sg.stroke(); last = { ...q, w }; };
    const compose = () => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'copy'; g.drawImage(base, 0, 0); g.globalCompositeOperation = t === 'borracha' ? 'destination-out' : 'source-over'; g.globalAlpha = t === 'borracha' ? 1 : o.opacity / 100; g.drawImage(stroke, 0, 0); g.restore(); };
    put(sp, px * press(e)); compose(); Studio.render();
    Studio._drag = { t: 'draw' };
    dragPointer(e, ev => { const q0 = Studio.pointer(ev), q = Mp.map(q0.x, q0.y); sp = { x: sp.x + (q.x - sp.x) * (1 - sm), y: sp.y + (q.y - sp.y) * (1 - sm) }; put(sp, px * press(ev)); pts++; compose(); Studio.render(); },
      () => { const q = sp; put(q, px); compose(); Studio._drag = null; this.finish(T, t === 'borracha' ? 'Apagou' : t === 'lapis' ? 'Traço de lápis' : 'Traço de pincel'); });
  },
  async finish(T, label) {
    const cv = DrawLive.get(T.dr); if (!cv) return;
    const blob = await new Promise(r => cv.toBlob(r, 'image/png')); const rt = await Assets.addBlob(blob, `${T.n.name} — ${T.dr.name || 'desenho'}.png`, Studio.P.id, 'image');
    T.dr.asset = rt.meta.id; delete T.dr.blank; T.n._mk = null; Studio.alpha.delete(rt.meta.id); DrawLive.delete(T.dr);
    if (!T.n.tip && !T.n.layer) T.n.tip = Rig.computeTip(T.n);
    Studio.commit(label);
  },
  // balde: preenche a área fechada (fecha falhas pequenas do contorno)
  fill(cv, x, y, col, tol, gap) {
    x = Math.floor(x); y = Math.floor(y); const W = cv.width, H = cv.height; if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const g = cv.getContext('2d', { willReadFrequently: true }), im = g.getImageData(0, 0, W, H), d = im.data, i0 = (y * W + x) * 4, c0 = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
    const same = i => { const a = d[i + 3]; if (c0[3] < 20) return a < 60; return a > 20 && Math.abs(d[i] - c0[0]) + Math.abs(d[i + 1] - c0[1]) + Math.abs(d[i + 2] - c0[2]) <= tol * 3; };
    // barreira = pixels diferentes, engordada "gap" px (fecha buraquinhos do contorno)
    const bar = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) if (!same(i * 4)) bar[i] = 1;
    let B = bar; for (let k = 0; k < gap; k++) { const nb = B.slice(); for (let yy = 1; yy < H - 1; yy++) for (let xx = 1; xx < W - 1; xx++) { const i = yy * W + xx; if (B[i]) { nb[i - 1] = nb[i + 1] = nb[i - W] = nb[i + W] = 1; } } B = nb; }
    if (B[y * W + x]) B[y * W + x] = 0;
    const seen = new Uint8Array(W * H), st = [y * W + x], [r, gg, b] = hexToRgb(col); let n = 0; seen[y * W + x] = 1;
    while (st.length) { const i = st.pop(), xx = i % W; n++; for (const j of [i - 1, i + 1, i - W, i + W]) { if (j < 0 || j >= W * H || seen[j] || B[j]) continue; if ((j === i - 1 && xx === 0) || (j === i + 1 && xx === W - 1)) continue; seen[j] = 1; st.push(j); } if (n > W * H * .9) break; }
    if (n > W * H * .85 && c0[3] < 20) { UI.toast('A área não está fechada — o balde ia pintar tudo. Feche o contorno ou aumente "fechar falhas".', { kind: 'warn', time: 3500 }); return false; }
    // pinta a área e mais "gap" px por baixo do contorno (sem buraco branco entre a cor e a linha)
    let F = seen; for (let k = 0; k < gap + 1; k++) { const nf = F.slice(); for (let i = 0; i < W * H; i++) if (F[i]) { if (i % W) nf[i - 1] = 1; if (i % W < W - 1) nf[i + 1] = 1; if (i >= W) nf[i - W] = 1; if (i < W * H - W) nf[i + W] = 1; } F = nf; }
    for (let i = 0; i < W * H; i++) { if (!F[i]) continue; const q = i * 4; if (!seen[i] && d[q + 3] > 200 && !same(q)) continue; d[q] = r; d[q + 1] = gg; d[q + 2] = b; d[q + 3] = 255; }
    g.putImageData(im, 0, 0); return true;
  },
  pick(p) {
    const cv = $('#an-canvas'), q = cv.getContext('2d').getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data;
    if (q[3] < 10) return; this.opt.color = '#' + [q[0], q[1], q[2]].map(v => v.toString(16).padStart(2, '0')).join(''); this.save(); StudioUI.refreshProps(); UI.toast(`Cor ${this.opt.color}`, { time: 1000 });
  },
  // cores do personagem (as mais usadas no desenho selecionado)
  colorsFrom(n) {
    const dr = n && Rig.drawingAt(Studio.selRig, n, Studio.f), rt = dr?.asset && Assets.get(dr.asset); if (!rt?.img) return [];
    const c = document.createElement('canvas'), k = Math.min(1, 160 / Math.max(rt.img.naturalWidth, rt.img.naturalHeight)); c.width = Math.max(1, rt.img.naturalWidth * k | 0); c.height = Math.max(1, rt.img.naturalHeight * k | 0);
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(rt.img, 0, 0, c.width, c.height); const d = g.getImageData(0, 0, c.width, c.height).data, cnt = new Map();
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 220) continue; const key = [d[i] >> 4, d[i + 1] >> 4, d[i + 2] >> 4].join(','); cnt.set(key, (cnt.get(key) || 0) + 1); }
    return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => '#' + k.split(',').map(v => ((+v << 4) + 8).toString(16).padStart(2, '0')).join(''));
  },

  // traço e cores de um desenho: espessura do contorno (px da imagem) e as cores mais usadas
  analyze(dr) {
    const rt = dr?.asset && Assets.get(dr.asset); if (!rt?.img) return null; const im = rt.img, k = Math.min(1, 700 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, im.naturalWidth * k | 0), hh = Math.max(1, im.naturalHeight * k | 0);
    const c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, w, hh); const d = g.getImageData(0, 0, w, hh).data, runs = [];
    const dark = i => d[i * 4 + 3] > 180 && d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] < 200;
    for (let y = 0; y < hh; y += 2) { let r = 0; for (let x = 0; x < w; x++) { if (dark(y * w + x)) r++; else { if (r) runs.push(r); r = 0; } } }
    for (let x = 0; x < w; x += 2) { let r = 0; for (let y = 0; y < hh; y++) { if (dark(y * w + x)) r++; else { if (r) runs.push(r); r = 0; } } }
    runs.sort((a, b) => a - b); const line = runs.length ? runs[Math.floor(runs.length * .35)] / k : 4;
    const cnt = new Map(); for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 220) continue; const key = [d[i] >> 4, d[i + 1] >> 4, d[i + 2] >> 4].join(','); cnt.set(key, (cnt.get(key) || 0) + 1); }
    const cols = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([kk]) => '#' + kk.split(',').map(v => ((+v << 4) + 8).toString(16).padStart(2, '0')).join(''));
    const outline = cols.find(h => { const [r, gg, b] = hexToRgb(h); return r + gg + b < 200; }) || '#1e1424';
    return { line, cols, outline, fill: cols.find(x => x !== outline) || cols[0] };
  },
  /* ---------- câmera ---------- */
  dragCamera(e) {
    const S = Studio, k = S.P.camera.keys, f = S.f, c0 = S.camAt(f), p0 = S.pointer(e), V = S.viewMatrix().inverse(), a = V.transformPoint(new DOMPoint(p0.x, p0.y)), sceneView = S.viewMode === 'cena';
    S._drag = { t: 'cam' }; let moved = false;
    dragPointer(e, ev => {
      const p = S.pointer(ev), b = V.transformPoint(new DOMPoint(p.x, p.y)), dx = b.x - a.x, dy = b.y - a.y; moved = true;
      if (ev.shiftKey) { const z = clamp(c0.Z * Math.exp(-dy / 400), .2, 8); AnimMath.setKey(k.Z ||= [], f, round(z, 3), 'ease'); }
      else if (ev.altKey) { AnimMath.setKey(k.R ||= [], f, round(c0.R + dx / 8, 1), 'ease'); }
      else { const s = sceneView ? 1 : -1 / c0.Z; AnimMath.setKey(k.X ||= [], f, round(c0.X + dx * s, 1), 'ease'); AnimMath.setKey(k.Y ||= [], f, round(c0.Y + dy * s, 1), 'ease'); }
      StudioUI.hint('<b>Câmera</b>: arraste = mover · Shift = zoom · Alt = girar · cada mexida vira keyframe da câmera'); S.render();
    }, () => { StudioUI.hint(''); S._drag = null; if (moved) S.commit('Câmera'); });
  },
  // moldura da câmera vista de fora (visão "Cena")
  drawCameraFrame(g) {
    const S = Studio, W = S.P.settings.w, H = S.P.settings.h, V = S.viewMatrix(), inv = S.camMatrix(S.f).inverse(), d = devicePixelRatio || 1;
    const pts = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => V.transformPoint(inv.transformPoint(new DOMPoint(x, y))));
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.strokeStyle = '#ff4d6a'; g.lineWidth = 2 * d; g.setLineDash([10 * d, 6 * d]); g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.closePath(); g.stroke();
    g.setLineDash([]); g.fillStyle = '#ff4d6a'; g.font = `bold ${11 * d}px sans-serif`; g.fillText('CÂMERA', pts[0].x + 6 * d, pts[0].y + 16 * d); g.restore();
  },

  /* ---------- papel-cebola colorido (anteriores vermelho, seguintes verde) ---------- */
  onion(g, base, f, W, H, n, ff, col, alpha) {
    const cv = g.canvas, t = this._oc ||= document.createElement('canvas'); if (t.width !== cv.width || t.height !== cv.height) { t.width = cv.width; t.height = cv.height; }
    const tg = t.getContext('2d'); tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, t.width, t.height);
    for (const rig of Studio.P.rigs) Rig.draw(tg, rig, ff, W, H, { base, only: n ? (x => x === n || Studio.descendants(Studio.selRig, n).includes(x)) : null });
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-atop'; tg.fillStyle = col; tg.fillRect(0, 0, t.width, t.height); tg.globalCompositeOperation = 'source-over';
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = alpha; g.drawImage(t, 0, 0); g.restore();
  },

  /* ---------- prévia: no vídeo (clipe do editor) ou num formato ---------- */
  prevMode: null,
  previewModes() { const m = [['shorts', 'Shorts 9:16', 1080, 1920], ['video', 'Vídeo 16:9', 1920, 1080], ['quad', 'Quadrado', 1080, 1080]]; if (Studio.clipMode) m.unshift(['editor', 'No vídeo do editor']); return m; },
  async loadEditor() { const cm = Studio.clipMode; if (!cm || this._ed?.id === cm.edId) return; const rec = await DB.get('projects', cm.edId); if (rec) { this._ed = JSON.parse(rec.data); this._edClip = this._ed.clips.find(c => c.id === cm.clipId); } },
  drawPreview() {
    const cv = $('#an-prev-cv'); if (!cv || !Studio.P || $('#an-prev')?.classList.contains('closed')) return;
    const S = Studio, P = S.P, mode = this.prevMode || (S.clipMode ? 'editor' : 'shorts'), wbox = cv.parentElement.clientWidth - 2;
    if (mode === 'editor') {
      if (!this._ed) { this.loadEditor().then(() => this.drawPreview()); return; }
      const E = this._ed, c = this._edClip; if (!c) return;
      const ar = E.settings.h / E.settings.w, w = Math.min(wbox, 260 / ar); cv.width = Math.round(w * devicePixelRatio); cv.height = Math.round(w * ar * devicePixelRatio); cv.style.width = w + 'px'; cv.style.height = w * ar + 'px';
      const A = { settings: { ...P.settings, bg: '#000000' }, frames: P.frames, rigs: P.rigs, camera: P.camera, rev: (this._rev = (this._rev || 0) + 1) };
      if (c.anim.lib && E.animLib) E.animLib[c.anim.lib] = A; else c.anim.P = A;
      const t = c.start + (S.f / P.settings.fps - (c.offset || 0)) / (c.speed || 1);
      Renderer.prepare(E, t).then(() => { try { Renderer.render(cv, E, t, { q: cv.width / E.settings.w, noSync: true }); } catch (e) { console.warn(e); } });
      $('#an-prev-t').textContent = fmtTime(t, E.settings.fps, false) + ' no vídeo';
      return;
    }
    const [, , FW, FH] = this.previewModes().find(m => m[0] === mode), ar = FH / FW, w = Math.min(wbox, 260 / ar), q = devicePixelRatio;
    cv.width = Math.round(w * q); cv.height = Math.round(w * ar * q); cv.style.width = w + 'px'; cv.style.height = w * ar + 'px';
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
    const k = Math.min(cv.width / P.settings.w, cv.height / P.settings.h), ox = (cv.width - P.settings.w * k) / 2, oy = (cv.height - P.settings.h * k) / 2;
    S.renderFrame(g, S.f, { view: new DOMMatrix().translateSelf(ox, oy).scaleSelf(k, k) });
    if (mode === 'shorts') { g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(cv.width * .86, cv.height * .45, cv.width * .12, cv.height * .38); g.fillRect(cv.width * .04, cv.height * .82, cv.width * .7, cv.height * .12); }
    $('#an-prev-t').textContent = fmtTime(S.f / P.settings.fps, P.settings.fps, false);
  },
};
Desenho.load();
