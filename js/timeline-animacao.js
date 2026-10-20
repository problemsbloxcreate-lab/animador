/* ===================== timeline-animacao.js — linha do tempo "Animação" no editor =====================
   Botão "Edição | Animação" em cima da linha do tempo. Em Animação mostra, no MESMO tempo do vídeo:
   a câmera e cada parte (osso) do personagem selecionado, com os keyframes (losangos) e as trocas de desenho.
   Clique = ir para o tempo · arrastar losango = mover keyframe · Delete = apagar · botão direito = opções. */
'use strict';
const EdAnimTL = {
  on: false, rh: 26, left: 190, sel: null, scrollY: 0, flash: (() => { try { return localStorage.getItem('tl-flash') !== '0'; } catch { return true; } })(), cell: 14, ver: (() => { try { return localStorage.getItem('tl-ver') || 'tudo'; } catch { return 'tudo'; } })(),
  mount() {
    const tb = $('#timeline .tl-toolbar'); if (!tb || $('#tl-modo')) return;
    const sw = h('<div class="pv-modo tl-modo" id="tl-modo"><button data-v="edicao" class="on" title="Clipes e faixas do vídeo">🎬 Edição</button><button data-v="animacao" title="Câmera e ossos do personagem, quadro a quadro">🦴 Animação</button></div>');
    tb.prepend(sw); $$('button', sw).forEach(b => b.onclick = () => this.set(b.dataset.v === 'animacao'));
    const fm = h(`<div class="pv-modo tl-flash" id="tl-flash" title="Jeito de ver a linha do tempo da animação"><button data-f="1" title="Quadro a quadro, igual Adobe Flash/Animate">▦ Quadros</button><button data-f="0" title="Tempo contínuo (segundos)">⏱ Tempo</button></div>`);
    const vm = h(`<div class="pv-modo tl-ver" id="tl-ver" title="O que mostrar na linha do tempo da animação"><button data-w="tudo" title="Todas as partes do personagem selecionado">👤 Tudo</button><button data-w="parte" title="Só a parte (osso) selecionada">🦴 Só a parte</button><button data-w="video" title="Todos os personagens e clipes do vídeo inteiro">🎬 Vídeo todo</button></div>`);
    sw.after(vm); $$('button', vm).forEach(b => b.onclick = () => { this.ver = b.dataset.w; try { localStorage.setItem('tl-ver', this.ver); } catch { } this.scrollY = 0; this.ui(); this.draw(); });
    sw.after(fm); $$('button', fm).forEach(b => b.onclick = () => { this.flash = b.dataset.f === '1'; try { localStorage.setItem('tl-flash', this.flash ? '1' : '0'); } catch { } this.ui(); this.draw(); }); this.ui();
    const box = h('<div class="tl-anim" id="tl-anim"><canvas></canvas><div class="tla-sx"><div></div></div><div class="tla-sy"><div></div></div></div>'); $('#tl-scroll').after(box);
    // barras de rolagem (iguais às do editor)
    const sx = $('.tla-sx', box), sy = $('.tla-sy', box);
    // barra própria (pequena e sempre visível): arrastar a alça = rolar · clicar no trilho = pular
    const bar = (el, horiz) => el.addEventListener('pointerdown', e => { e.preventDefault(); const th = el.firstChild, S = this._sb?.[horiz ? 'x' : 'y']; if (!S) return; const r = el.getBoundingClientRect(), len = horiz ? r.width : r.height, pos = (horiz ? e.clientX - r.left : e.clientY - r.top);
      const set = v => { v = clamp(v, 0, S.max); if (horiz) { if (this.flash) this.fsx = v; else this.tsx = v; } else this.scrollY = v; this.draw(); };
      const tr = th.getBoundingClientRect(), on = horiz ? e.clientX >= tr.left && e.clientX <= tr.right : e.clientY >= tr.top && e.clientY <= tr.bottom;
      if (!on) set(S.v + Math.sign(pos - (horiz ? tr.left - r.left : tr.top - r.top)) * S.view * .9);
      const v0 = horiz ? (this.flash ? this.fsx : this.tsx) || 0 : this.scrollY, k = (S.max + S.view) / len; th.classList.add('drag');
      dragPointer(e, (ev, dx, dy) => set(v0 + (horiz ? dx : dy) * k), () => th.classList.remove('drag')); });
    bar(sx, true); bar(sy, false);
    const cv = $('canvas', box);
    new ResizeObserver(() => this.draw()).observe(box);
    cv.addEventListener('pointerdown', e => this.down(e));
    cv.addEventListener('wheel', e => { e.preventDefault(); if (e.ctrlKey) { if (this.flash) this.cell = clamp(this.cell * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 6, 40); else Timeline.pps = clamp(Timeline.pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 5, 2000); } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { const dx = e.deltaX || e.deltaY; if (this.flash) this.fsx = Math.max(0, (this.fsx || 0) + dx); else this.tsx = Math.max(0, (this.tsx || 0) + dx); } else this.scrollY = Math.max(0, this.scrollY + e.deltaY * .5); this.draw(); }, { passive: false });
    cv.addEventListener('contextmenu', e => { e.preventDefault(); this.menu(e); });
    cv.addEventListener('dblclick', e => { const H = this.hit(e); if (H.row?.t === 'sum') { App.select(H.row.c.id); this.ver = 'tudo'; this.ui(); return this.draw(); } if (H.row?.t === 'node') { const r = e.target.getBoundingClientRect(), t = this.tOf(e.clientX - r.left), f = Math.max(0, Math.floor(((t - H.row.c.start) * (H.row.c.speed || 1) + (H.row.c.offset || 0)) * RigEdit.A(H.row.c).settings.fps)); Cena.editPart(H.row.c, H.row.n, Math.round(Rig.ch(H.row.rig, H.row.n.id, 'd', f, H.row.n.d || 0))); } });
    addEventListener('keydown', e => { if (!this.on || !this.sel || e.target.closest('input,textarea,select')) return; if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); this.del(this.sel); } }, true);
    const tick = () => { if (this.on) this.draw(); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  },
  ui() { $$('#tl-flash button').forEach(b => b.classList.toggle('on', (b.dataset.f === '1') === this.flash)); $$('#tl-ver button').forEach(b => b.classList.toggle('on', b.dataset.w === this.ver)); },
  fps() { if (this.ver === 'video') return App.fps; const c = App.selected().find(x => x.type === 'anim'); return c ? RigEdit.A(c).settings.fps / (c.speed || 1) : App.fps; },
  pps() { return this.flash ? this.cell * this.fps() : Timeline.pps; },
  set(on) {
    this.on = on; $$('#tl-modo button').forEach(b => b.classList.toggle('on', (b.dataset.v === 'animacao') === on));
    $('#timeline').classList.toggle('anim-mode', on); this.draw();
    if (on && !RigEdit.sel()) { const c = App.project.clips.find(x => x.type === 'anim' && App.t >= x.start && App.t < x.start + x.dur) || App.project.clips.find(x => x.type === 'anim'); if (c) App.select(c.id); }
  },
  // linhas: câmera + partes do personagem selecionado
  rows() {
    let ch = false; if (typeof Upgrade === 'undefined' || !Upgrade.need(App.project)) for (const c of App.project.clips) if (c.type === 'anim' && RigEdit.syncFps(c)) ch = true; if (ch) App.commit('Animação acertada nos quadros do vídeo');
    const out = [{ t: 'cam', name: '🎥 Câmera', keys: () => { const s = new Set(); for (const ks of Object.values(App.project.camera?.keys || {})) for (const k of ks) s.add(k.f); return [...s]; } }];
    if (this.ver === 'video') { // vídeo todo: cada personagem numa linha (todos os keyframes dele) + os outros clipes
      for (const c of [...App.project.clips].filter(c => !['fx'].includes(c.type)).sort((a, b) => a.start - b.start)) { const rig = c.type === 'anim' && RigEdit.rig(c); out.push(rig ? { t: 'sum', c, rig, name: '👤 ' + (c.name || 'Personagem') } : { t: 'clip', c, name: (Cena.KIND?.(c)?.[0] || '•') + ' ' + (c.name || c.type) }); }
      return out;
    }
    const c = App.selected().find(x => x.type === 'anim') || null, rig = c && RigEdit.rig(c);
    if (c && rig) {
      out.push({ t: 'head', name: '👤 ' + (c.name || 'Personagem'), c });
      let list = Rig.ordered(rig);
      if (this.ver === 'parte' && rig.nodes.some(n => n.id === RigEdit.selNode)) { const keep = new Set([RigEdit.selNode]); let grow = true; while (grow) { grow = false; for (const n of rig.nodes) if (n.parent && keep.has(n.parent) && !keep.has(n.id)) { keep.add(n.id); grow = true; } } list = list.filter(([n]) => keep.has(n.id)); }
      for (const [n, lv] of list) out.push({ t: 'node', c, rig, n, lv, name: n.name });
    }
    return out;
  },
  sx() { return this.flash ? (this.fsx || 0) : (this.tsx || 0); },
  x(t) { return this.left + t * this.pps() - this.sx(); },
  tOf(x) { return (x - this.left + this.sx()) / this.pps(); },
  fit(g, s, w) { if (g.measureText(s).width <= w) return s; while (s.length > 1 && g.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; },
  keysOf(r) { if (r.t === 'cam') return r.keys().map(t => [t, t]); if (r.t === 'node') return this.nodeKeys(r); if (r.t === 'sum') { const s = new Map(); for (const n of r.rig.nodes) for (const [f, t] of this.nodeKeys({ ...r, n })) if (!s.has(f)) s.set(f, t); return [...s.entries()]; } return []; },
  nodeKeys(r) { const chs = r.rig.keys[r.n.id] || {}, s = new Map(); for (const [ch, ks] of Object.entries(chs)) for (const k of ks) { const t = RigEdit.timeOfFrame(r.c, k.f); if (!s.has(k.f)) s.set(k.f, t); } return [...s.entries()]; },
  draw() {
    const box = $('#tl-anim'); if (!box || !this.on || !App.project) return; const cv = $('canvas', box), d = devicePixelRatio || 1, W = box.clientWidth - 12, H = box.clientHeight - 12;
    if (cv.width !== W * d || cv.height !== H * d) { cv.width = W * d; cv.height = H * d; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    const g = cv.getContext('2d'), cs = getComputedStyle(document.documentElement), col = k => cs.getPropertyValue(k).trim();
    g.setTransform(d, 0, 0, d, 0, 0); g.fillStyle = col('--bg0'); g.fillRect(0, 0, W, H);
    const rows = this.rows(), rh = this.rh, top = 24, ac = col('--ac') || '#3d8bff';
    { // tamanho e posição das barras de rolagem
      const end = Math.max(App.project.clips.reduce((m, c) => Math.max(m, c.start + c.dur), 0), App.t) + 3, sx = $('.tla-sx', box), sy = $('.tla-sy', box);
      this.scrollY = clamp(this.scrollY, 0, Math.max(0, rows.length * rh + top - H + 10));
      if (this.flash) this.fsx = clamp(this.fsx || 0, 0, Math.max(0, end * this.pps() - (W - this.left))); else this.tsx = clamp(this.tsx || 0, 0, Math.max(0, end * this.pps() - (W - this.left)));
      const vw = W - this.left, vh = H - top, cwid = end * this.pps() + 40, chei = rows.length * rh + 10; sx.style.left = this.left + 'px'; sy.style.top = top + 'px';
      this._sb = { x: { v: this.sx(), view: vw, max: Math.max(0, cwid - vw) }, y: { v: this.scrollY, view: vh, max: Math.max(0, chei - vh) } };
      const put = (el, S, horiz) => { const len = horiz ? el.clientWidth : el.clientHeight, tot = S.max + S.view, sz = Math.max(28, len * S.view / tot), p = S.max ? (len - sz) * S.v / S.max : 0; el.classList.toggle('idle', !S.max); el.firstChild.style[horiz ? 'width' : 'height'] = sz + 'px'; el.firstChild.style[horiz ? 'left' : 'top'] = p + 'px'; };
      put(sx, this._sb.x, true); put(sy, this._sb.y, false);
    }
    this._rows = rows;
    // régua
    g.fillStyle = col('--bg1'); g.fillRect(0, 0, W, top); g.font = '10px sans-serif'; g.fillStyle = col('--tx3');
    const FPS = this.fps(), cw = this.cell;
    if (this.flash) { // régua de quadros (1, 5, 10…) como no Flash
      const f0 = Math.max(0, Math.floor(this.sx() / cw)), every = cw >= 14 ? 5 : cw >= 8 ? 10 : 20;
      for (let f = f0; this.left + f * cw - this.sx() < W; f++) { const x = this.left + f * cw - this.sx(), sec = f % Math.round(FPS) === 0;
        if (sec) { g.fillStyle = col('--tx'); g.fillRect(x, 0, 1, top); g.font = 'bold 10px sans-serif'; g.fillText(f / Math.round(FPS) + 's', x + 3, 10); g.font = '10px sans-serif'; }
        else if ((f + 1) % every === 0) { g.fillStyle = col('--tx3'); g.fillText(String(f + 1), x + 2, 21); g.fillRect(x, 16, 1, 8); }
        else { g.fillStyle = col('--bd2'); g.fillRect(x, 20, 1, 4); } }
      const cur = Math.floor(App.t * FPS + 1e-4); g.fillStyle = 'rgba(255,77,106,.35)'; g.fillRect(this.left + cur * cw - this.sx(), 0, cw, top);
    } else {
      const pps = this.pps(), steps = [1 / App.fps, .05, .1, .25, .5, 1, 2, 5, 10, 30, 60], step = steps.find(v => v * pps >= 64) || 60, sub = step / (step >= 1 ? 4 : 5);
      const lab = t => step < 1 ? (t < 60 ? (Math.round(t * 100) / 100).toFixed(step < .1 ? 2 : step < 1 ? (step % .25 === 0 && step < .5 ? 2 : 1) : 0).replace('.', ',') + ' s' : fmtTime(t, App.fps, false)) : (t >= 60 ? Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0') : Math.round(t) + ' s');
      for (let t = Math.floor(this.tOf(this.left) / sub) * sub; this.x(t) < W; t += sub) { const x = this.x(t); if (x < this.left) continue; const major = Math.abs(t / step - Math.round(t / step)) < 1e-6; g.fillStyle = major ? col('--tx2') : col('--bd2'); g.fillRect(x, major ? 12 : 19, 1, major ? 12 : 5); if (major) g.fillText(lab(Math.max(0, t)), x + 3, 10); }
    }
    // linhas
    rows.forEach((r, i) => {
      const y = top + i * rh - this.scrollY; if (y + rh < top || y > H) return;
      const isSel = r.t === 'node' && RigEdit.selNode === r.n.id;
      g.fillStyle = isSel ? `rgba(${col('--ac-rgb') || '61,139,255'},.16)` : i % 2 ? col('--bg1') : col('--bg0'); g.fillRect(0, y, W, rh);
      if (this.flash) { // células de quadro: cinza = segura o anterior, bolinha preta = keyframe
        const f0 = Math.max(0, Math.floor(this.sx() / cw)), keysF = this.keysOf(r).map(([, t]) => Math.floor(t * FPS + 1e-4)).sort((a, b) => a - b), endF = r.c ? Math.round((r.c.start + r.c.dur) * FPS) : keysF.length ? keysF[keysF.length - 1] : -1;
        for (let f = f0; this.left + f * cw - this.sx() < W; f++) { const x = this.left + f * cw - this.sx(); if (r.t === 'head') continue;
          const held = keysF.length && f >= keysF[0] && f < Math.max(endF, keysF[keysF.length - 1] + 1);
          g.fillStyle = held ? (isSel ? '#c9d6ee' : '#d4d4d8') : ((f + 1) % 5 === 0 ? col('--bg2') : col('--bg1')); g.fillRect(x, y + 1, cw - 1, rh - 2);
          if (r.t === 'clip' || r.t === 'sum') { const inC = f >= Math.floor(r.c.start * FPS) && f < Math.ceil((r.c.start + r.c.dur) * FPS); if (inC && r.t === 'clip') { g.fillStyle = 'rgba(61,139,255,.35)'; g.fillRect(x, y + 1, cw - 1, rh - 2); } }
          if (keysF.includes(f)) { g.fillStyle = r.t === 'cam' ? '#ff4d6a' : '#16161a'; g.beginPath(); g.arc(x + cw / 2, y + rh - 8, Math.min(4, cw / 3), 0, 7); g.fill(); }
        }
      }
      g.fillStyle = col('--bg2'); g.fillRect(0, y, this.left, rh);
      g.fillStyle = r.t === 'head' ? col('--tx') : col('--tx2'); g.font = (r.t === 'head' || r.t === 'cam' ? 'bold ' : '') + '12px sans-serif';
      g.fillText(this.fit(g, (r.lv ? '  '.repeat(r.lv) : '') + r.name, this.left - 16), 10, y + rh / 2 + 4);
      // trocas de desenho (barras coloridas com o nome)
      if (r.t === 'node' && r.n.drawings.length > 1) {
        const ks = r.rig.keys[r.n.id]?.d || []; ks.forEach((k, j) => { const t0 = RigEdit.timeOfFrame(r.c, k.f), t1 = j + 1 < ks.length ? RigEdit.timeOfFrame(r.c, ks[j + 1].f) : r.c.start + r.c.dur, x0 = Math.max(this.left, this.x(t0)), x1 = this.x(t1); if (x1 <= this.left) return;
          g.fillStyle = `hsla(${(k.v * 67) % 360},55%,45%,.55)`; g.fillRect(x0, y + 4, Math.max(1, x1 - x0 - 1), rh - 8); g.fillStyle = '#fff'; g.font = '10px sans-serif'; g.save(); g.beginPath(); g.rect(x0, y, Math.max(0, x1 - x0 - 2), rh); g.clip(); g.fillText(RigEdit.dname(r.n.drawings[k.v] || {}, k.v), x0 + 12, y + rh / 2 + 3); g.restore(); });
      }
      // vídeo todo: barra do clipe
      if (!this.flash && (r.t === 'clip' || r.t === 'sum')) { const xa = Math.max(this.left, this.x(r.c.start)), xb = this.x(r.c.start + r.c.dur); if (xb > xa) { g.fillStyle = r.t === 'sum' ? 'rgba(61,200,140,.28)' : 'rgba(61,139,255,.28)'; g.fillRect(xa, y + 3, xb - xa, rh - 6); } }
      // keyframes
      const keys = this.keysOf(r);
      for (const [id, t] of this.flash ? keys.filter(([id]) => this.sel && this.sel.row === i && this.sel.id === id) : keys) { const x = this.flash ? this.x(Math.floor(t * FPS + 1e-4) / FPS) + cw / 2 : this.x(t); if (x < this.left - 6 || x > W + 6) continue; const sel = this.sel && this.sel.row === i && this.sel.id === id;
        g.save(); g.translate(x, y + rh / 2); g.rotate(Math.PI / 4); g.fillStyle = sel ? '#ffd23d' : r.t === 'cam' ? '#ff4d6a' : ac; g.fillRect(-4.5, -4.5, 9, 9); g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeRect(-4.5, -4.5, 9, 9); g.restore(); }
    });
    if (!this.flash) { const fp = this.pps() / App.fps, every = fp >= 5 ? 1 : fp >= 2 ? 5 : fp >= .5 ? App.fps : 0;
      if (every) { g.fillStyle = 'rgba(150,150,160,.16)'; const f0 = Math.floor(this.tOf(this.left) * App.fps / every) * every; for (let f = Math.max(0, f0); ; f += every) { const x = this.x(f / App.fps); if (x > W) break; if (x >= this.left) g.fillRect(x, top, 1, H - top); } }
    }
    g.fillStyle = 'rgba(150,150,160,.22)'; rows.forEach((r, i) => { const y = top + (i + 1) * rh - this.scrollY; if (y > top && y < H) g.fillRect(0, y - 1, W, 1); });
    // área de fora do clipe
    const c = this.ver !== 'video' && rows[1]?.c; if (c) { g.fillStyle = 'rgba(0,0,0,.35)'; const xa = this.x(c.start), xb = this.x(c.start + c.dur); if (xa > this.left) g.fillRect(this.left, top + rh, xa - this.left, H); if (xb < W) g.fillRect(Math.max(this.left, xb), top + rh, W, H); }
    if (rows.length === 1 && this.ver !== 'video') { g.fillStyle = col('--tx3'); g.font = '13px sans-serif'; g.fillText('Selecione um personagem com ossos no vídeo para ver as partes aqui.', this.left + 14, top + rh * 2.2); }
    // cursor (azul quando está em cima de um keyframe)
    const curF = Math.floor(App.t * FPS + 1e-4), onKey = rows.some(r => this.keysOf(r).map(([, t]) => t).some(t => this.flash ? Math.floor(t * FPS + 1e-4) === curF : Math.abs(t - App.t) < .5 / App.fps));
    const xc = this.flash ? this.x(curF / FPS) + cw / 2 : this.x(App.t); if (xc >= this.left) { g.fillStyle = onKey ? '#3d8bff' : '#ff4d6a'; g.fillRect(xc - 1, 0, 2, H); if (onKey) { g.beginPath(); g.moveTo(xc - 6, 0); g.lineTo(xc + 6, 0); g.lineTo(xc, 8); g.fill(); } }
  },
  hit(e) {
    const r = e.target.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, i = Math.floor((my - 24 + this.scrollY) / this.rh), row = this._rows?.[i];
    let key = null; if (row && mx > this.left) { const keys = row.t === 'cam' || row.t === 'node' ? this.keysOf(row) : []; for (const [id, t] of keys) { const xx = this.flash ? this.x(Math.floor(t * this.fps() + 1e-4) / this.fps()) + this.cell / 2 : this.x(t); if (Math.abs(xx - mx) < (this.flash ? this.cell / 2 : 7)) { key = { row: i, id, t }; break; } } }
    return { mx, my, i, row, key };
  },
  down(e) {
    const H = this.hit(e);
    if ((H.row?.t === 'sum' || H.row?.t === 'clip') && H.my >= 24) { App.select(H.row.c.id); if (H.mx <= this.left) return; }
    if (H.my < 24 || (H.mx > this.left && !H.key)) { // régua ou área vazia: anda o cursor (arrastando)
      if (H.row?.t === 'node') { RigEdit.selNode = H.row.n.id; Props.render(); }
      const go = ev => { const r = e.target.getBoundingClientRect(), t = Math.max(0, this.tOf(ev.clientX - r.left)); if (this.flash) App.seek((Math.floor(t * this.fps() + 1e-4) + .5) / this.fps(), { snapFrame: false }); else App.seek(t); }; go(e); dragPointer(e, ev => go(ev)); this.sel = null; return;
    }
    if (H.mx <= this.left) { if (H.row?.t === 'node') { RigEdit.selNode = H.row.n.id; App.requestRender(); Props.render(); } return; }
    // losango: seleciona e arrasta
    this.sel = H.key; const row = H.row; if (this.flash) App.seek((Math.floor(H.key.t * this.fps() + 1e-4) + .5) / this.fps(), { snapFrame: false }); else App.seek(H.key.t);
    let moved = false, last = H.key.t;
    dragPointer(e, ev => { const r = e.target.getBoundingClientRect(), tr = Math.max(0, this.tOf(ev.clientX - r.left)), t = this.flash ? Math.floor(tr * this.fps() + 1e-4) / this.fps() : App.frame(tr); if (Math.abs(t - last) < 1e-4) return; this.moveKey(row, this.sel, row.t === 'cam' ? App.frame(t) : t); last = t; moved = true; if (this.flash) App.seek(t + .5 / this.fps(), { snapFrame: false }); else App.seek(t); },
      () => { if (moved) App.commit('Keyframe movido'); });
  },
  moveKey(row, sel, t) {
    if (row.t === 'cam') { for (const ks of Object.values(App.project.camera.keys)) { const k = ks.find(k => Math.abs(k.f - sel.id) < 1e-4); if (k && !ks.some(o => o !== k && Math.abs(o.f - t) < 1e-4)) k.f = t; ks.sort((a, b) => a.f - b.f); } sel.id = t; }
    else { const A = RigEdit.A(row.c), f = Math.floor(1e-4 + ((t - row.c.start) * (row.c.speed || 1) + (row.c.offset || 0)) * A.settings.fps); if (f < 0) return; for (const ks of Object.values(row.rig.keys[row.n.id] || {})) { const k = ks.find(k => k.f === sel.id); if (k && !ks.some(o => o !== k && o.f === f)) k.f = f; ks.sort((a, b) => a.f - b.f); } sel.id = f; RigEdit.touch(row.c); }
    sel.t = t; App.requestRender();
  },
  del(sel) {
    const row = this._rows?.[sel.row]; if (!row) return;
    if (row.t === 'cam') { const k = App.project.camera.keys; for (const ch of Object.keys(k)) { k[ch] = k[ch].filter(x => Math.abs(x.f - sel.id) > 1e-4); if (!k[ch].length) delete k[ch]; } }
    else { const chs = row.rig.keys[row.n.id] || {}; for (const ch of Object.keys(chs)) { chs[ch] = chs[ch].filter(x => x.f !== sel.id); if (!chs[ch].length) delete chs[ch]; } RigEdit.touch(row.c); }
    this.sel = null; App.commit('Keyframe apagado'); this.draw();
  },
  menu(e) {
    const H = this.hit(e); if (!H.row) return; const items = [];
    if (H.key) { this.sel = H.key; items.push({ label: 'Apagar este keyframe', icon: 'trash', danger: true, action: () => this.del(H.key) }); }
    if (H.row.t === 'node') {
      const n = H.row.n; RigEdit.selNode = n.id; items.push({ head: n.name });
      items.push({ label: '✏️ Editar este desenho (varinha, correção, camadas…)', action: () => { const r = e.target.getBoundingClientRect(), t = this.tOf(e.clientX - r.left), f = Math.max(0, Math.floor(((t - H.row.c.start) * (H.row.c.speed || 1) + (H.row.c.offset || 0)) * RigEdit.A(H.row.c).settings.fps)); Cena.editPart(H.row.c, n, Math.round(Rig.ch(H.row.rig, n.id, 'd', f, n.d || 0))); } });
      if (n.drawings.length > 1) n.drawings.forEach((d, i) => items.push({ label: 'Trocar para: ' + RigEdit.dname(d, i), action: () => RigEdit.react(H.row.c, n, i, 0) }));
      items.push({ label: 'Marcar keyframe aqui', icon: 'diamond', action: () => { const f = RigEdit.frame(H.row.c); Rig.setKey(H.row.rig, n.id, 'r', f, Rig.ch(H.row.rig, n.id, 'r', f, 0)); RigEdit.touch(H.row.c); App.commit('Keyframe'); } });
    }
    if (H.row.t === 'cam') items.push({ label: 'Marcar câmera aqui', icon: 'diamond', action: () => { EdCam.setAll(EdCam.at()); App.commit('Keyframe da câmera'); } }, { label: 'Zoom de impacto aqui', action: () => EdCam.preset('punch') }, { label: 'Tremer aqui', action: () => EdCam.preset('shake') });
    if (items.length) UI.ctx(e.clientX, e.clientY, items);
  },
};
