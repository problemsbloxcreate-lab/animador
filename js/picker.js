/* ===================== picker.js — escolha visual (blocos com prévia) e recorte de imagem/vídeo ===================== */
'use strict';

/* ---------- bloco com prévia animada ao passar o mouse ---------- */
LibUI.card = function (kind, id, o = {}) {
  const def = kind === 'anim' ? ANIMS[id] : kind === 'fx' ? FX[id] : TRANS[id];
  if (!def) return h(`<div class="lcard"><div class="mini dark"></div><div class="lname"><span>${esc(id)}</span></div></div>`);
  const label = o.label || def.name;
  const mini = kind === 'anim' ? `<div class="mini"><div class="mini-scene"><div class="mini-fig"></div></div></div>` : `<div class="mini dark"><canvas width="132" height="62" style="width:100%;height:100%"></canvas></div>`;
  const el = h(`<div class="lcard ${o.toggle ? 'tog' : ''}" title="${esc(def.hint || def.name)}">${mini}<div class="lname"><span>${esc(label)}</span>${def.sound ? `<span class="snd-ic">${ic('vol', 11)}</span>` : ''}</div>${o.toggle ? `<span class="chk">${ic('check', 12, 3)}</span>` : ''}${o.sub ? `<div class="lsub">${o.sub}</div>` : ''}</div>`);
  if (kind === 'anim') this.miniAnim(el, def); else if (kind === 'fx') this.miniFx(el, id); else this.miniTrans(el, id);
  this.sndToggle(el, def);
  return el;
};
// alto-falante do bloco: clique liga/desliga o som padrão quando esse item for adicionado
LibUI.sndToggle = function (el, def) {
  const s = $('.snd-ic', el); if (!s || !def.sound) return;
  const paint = () => { const on = SoundPrefs.isOn(def); s.innerHTML = ic(on ? 'vol' : 'mute', 12); s.style.color = on ? '' : 'var(--warn)'; s.title = on ? `Com som (${SOUNDS.defs[def.sound]?.name}). Clique para começar sem som` : 'Sem som. Clique para usar o som padrão'; };
  s.classList.add('snd-tg'); paint();
  s.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); const on = SoundPrefs.toggle(def); paint(); if (on) AudioEngine.preview('snd:' + def.sound, .7); UI.toast(`${esc(def.name)}: ${on ? 'com som padrão' : 'sem som'} quando adicionar`, { time: 1600 }); });
  s.addEventListener('pointerdown', e => e.stopPropagation());
};
// bloco simples (ícone) para coisas sem prévia (cores, keyframes…)
LibUI.iconCard = function (icon, label, sub, bg) {
  return h(`<div class="lcard tog" title="${esc(label)}"><div class="mini dark" style="${bg ? `background:${bg}` : ''}"><span class="mini-ic">${ic(icon, 26)}</span></div><div class="lname"><span>${esc(label)}</span></div><span class="chk">${ic('check', 12, 3)}</span>${sub ? `<div class="lsub">${sub}</div>` : ''}</div>`);
};

/* ---------- janela de escolha visual ---------- */
const Picker = {
  open(kind, o = {}) {
    const defs = kind === 'anim' ? ANIMS : kind === 'fx' ? FX : TRANS;
    const title = o.title || { anim: 'Escolher animação', fx: 'Escolher efeito', trans: 'Escolher transição' }[kind];
    const body = h(`<div><div class="psearch" style="padding:0 0 10px;border:0"><input placeholder="Buscar… (passe o mouse nos blocos para ver)" autocomplete="off"></div><div class="pick-body"></div></div>`);
    let resolveSel;
    const p = UI.modal({ title, icon: { anim: 'jump', fx: 'sparkles', trans: 'transition' }[kind], width: 760, body, cancelValue: null, buttons: o.allowNone ? [{ label: o.noneLabel || 'Nenhuma', value: '__none', left: true }, { label: 'Cancelar', value: null }] : [{ label: 'Cancelar', value: null }], onOpen: a => resolveSel = a.close });
    const render = q => {
      const pb = $('.pick-body', body); pb.innerHTML = '';
      const entries = kind === 'trans' ? { 'Transições': Object.entries(TRANS).map(([id, v]) => ({ id, ...v })) } : groupBy(defs);
      for (const [cat, list] of Object.entries(entries)) {
        const items = list.filter(d => (!o.filter || o.filter(d)) && (!q || (d.name + ' ' + cat).toLowerCase().includes(q))); if (!items.length) continue;
        pb.appendChild(h(`<div class="lgroup">${cat}</div>`));
        const g = h('<div class="lgrid pick-grid"></div>');
        items.forEach(d => { const el = LibUI.card(kind, d.id); if (d.id === o.current) el.classList.add('on'); el.onclick = () => resolveSel(d.id); g.appendChild(el); });
        pb.appendChild(g);
      }
      if (!pb.children.length) pb.appendChild(h('<div class="empty" style="padding:20px">Nada encontrado.</div>'));
    };
    const inp = $('input', body); inp.oninput = () => render(inp.value.toLowerCase().trim());
    render('');
    return p;
  },
};

/* ---------- blocos de "o que copiar/colar/salvar" ---------- */
Actions.pickBlocks = function (d, defaults = {}) {
  const wrap = h(`<div><div class="lgrid pick-grid" data-blocks></div><small style="color:var(--tx3);display:block;margin-top:6px">Clique nos blocos para escolher o que entra (passe o mouse para ver).</small></div>`), g = $('[data-blocks]', wrap);
  const add = (el, key, on) => { el.dataset.pick = key; el.classList.toggle('on', on); el.onclick = () => el.classList.toggle('on'); g.appendChild(el); };
  (d.anims || []).forEach(a => add(LibUI.card('anim', a.type, { toggle: true, sub: `${fmtSec(a.start)} · ${fmtSec(a.dur)}` }), 'a:' + a.id, defaults.anims !== false));
  (d.fx || []).forEach(f => add(LibUI.card('fx', f.type, { toggle: true, sub: `${fmtSec(f.start)} · ${fmtSec(f.dur)}` }), 'f:' + f.id, defaults.fx !== false));
  if (d.trIn?.type) add(LibUI.card('trans', d.trIn.type, { toggle: true, label: 'Entrada: ' + TRANS[d.trIn.type]?.name }), 'trIn', defaults.trans !== false);
  if (d.trOut?.type) add(LibUI.card('trans', d.trOut.type, { toggle: true, label: 'Saída: ' + TRANS[d.trOut.type]?.name }), 'trOut', defaults.trans !== false);
  if (d.color && Object.entries(COLOR_DEFAULT()).some(([k, v]) => d.color[k] !== v)) { const c = d.color, f = []; if (c.grayscale) f.push(`grayscale(${c.grayscale}%)`); if (c.saturation !== 100) f.push(`saturate(${c.saturation}%)`); if (c.brightness !== 100) f.push(`brightness(${c.brightness}%)`); if (c.sepia) f.push(`sepia(${c.sepia}%)`); if (c.hue) f.push(`hue-rotate(${c.hue}deg)`); const el = LibUI.iconCard('palette', 'Cores e filtros', '', 'linear-gradient(90deg,#ff4d6a,#ffb020,#2fcf7a,#19d3f0,#3d8bff)'); $('.mini', el).style.filter = f.join(' '); add(el, 'color', !!defaults.color); }
  if (d.kf && Object.keys(d.kf).length) add(LibUI.iconCard('diamond', 'Keyframes', `${KF.times({ kf: d.kf }).length} momentos`), 'kf', !!defaults.kf);
  if (d.afx && JSON.stringify(d.afx) !== JSON.stringify(AFX_DEFAULT())) add(LibUI.iconCard('mic', 'Efeitos de som'), 'afx', !!defaults.afx);
  if (!g.children.length) g.appendChild(h('<div class="empty" style="grid-column:1/-1;padding:16px">Esse clipe não tem efeitos.</div>'));
  return wrap;
};
Actions.readBlocks = function (wrap) {
  const on = new Set($$('[data-pick].on', wrap).map(e => e.dataset.pick));
  return { animIds: new Set([...on].filter(k => k.startsWith('a:')).map(k => k.slice(2))), fxIds: new Set([...on].filter(k => k.startsWith('f:')).map(k => k.slice(2))), trIn: on.has('trIn'), trOut: on.has('trOut'), color: on.has('color'), kf: on.has('kf'), afx: on.has('afx'), count: on.size };
};
Actions.filterPack = function (d, sel) {
  return { srcDur: d.srcDur, anims: (d.anims || []).filter(a => sel.animIds.has(a.id)), fx: (d.fx || []).filter(f => sel.fxIds.has(f.id)), trIn: sel.trIn ? d.trIn : null, trOut: sel.trOut ? d.trOut : null, color: sel.color ? d.color : null, kf: sel.kf ? d.kf : null, afx: sel.afx ? d.afx : null };
};

/* ===================== Recorte visual ===================== */
const CropEditor = {
  async source(clip, asset) {
    const id = clip ? clip.assetId : asset.id, rt = Assets.get(id); if (!rt) return null;
    if (rt.meta.kind === 'image') return { el: rt.img, w: rt.meta.w, h: rt.meta.h, rt };
    if (rt.meta.kind === 'gif') return { el: Assets.gifFrame(rt, 0), w: rt.meta.w, h: rt.meta.h, rt };
    if (rt.meta.kind === 'video') {
      let v;
      if (clip) { await Renderer.prepare(App.project, clamp(App.t, clip.start, clip.start + clip.dur - .01)); v = VideoPool.get(clip).v; }
      else { v = await Assets.videoEl(rt.url); v.currentTime = Math.min(1, v.duration / 2); await new Promise(r => { v.onseeked = r; setTimeout(r, 1500); }); }
      const cv = document.createElement('canvas'); cv.width = v.videoWidth; cv.height = v.videoHeight; cv.getContext('2d').drawImage(v, 0, 0);
      return { el: cv, w: cv.width, h: cv.height, rt, video: true };
    }
    return null;
  },
  async open(clip, asset) {
    const src = await this.source(clip, asset);
    if (!src) return UI.toast('Só dá para recortar imagens, GIFs e vídeos', { kind: 'warn' });
    const cr = clip ? clone(clip.crop || { l: 0, t: 0, r: 0, b: 0 }) : { l: 0, t: 0, r: 0, b: 0 };
    // seleção em frações 0..1
    let sel = { x: cr.l / 100, y: cr.t / 100, w: 1 - (cr.l + cr.r) / 100, h: 1 - (cr.t + cr.b) / 100 };
    const grid = { on: false, cols: 2, rows: 1 };
    const PS = App.project.settings, pvW = 240, pvH = Math.round(Math.min(300, pvW * PS.h / PS.w)), pvWW = Math.round(pvH * PS.w / PS.h);
    const maxW = Math.min(620, innerWidth - 420), maxH = Math.min(440, innerHeight - 330), k = Math.min(maxW / src.w, maxH / src.h, 4);
    const W = Math.round(src.w * k), H = Math.round(src.h * k);
    const body = h(`<div>
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="flex:1;display:flex;justify-content:center;background:repeating-conic-gradient(#202228 0 25%,#16171b 0 50%) 0 0/16px 16px;border-radius:10px;padding:10px"><canvas data-main width="${W}" height="${H}" style="width:${W}px;height:${H}px;cursor:crosshair;touch-action:none"></canvas></div>
        <div style="width:${pvWW}px;flex:none"><div class="ctl-l" style="margin-bottom:4px">${clip ? 'Como fica no vídeo' : 'Resultado'}</div><canvas data-pv width="${pvWW * 2}" height="${pvH * 2}" style="width:${pvWW}px;height:${pvH}px;border-radius:8px;background:#000;box-shadow:0 0 0 1px var(--bd2)"></canvas>
        <small style="display:block;color:var(--tx3);margin-top:6px;line-height:1.4">${clip ? 'Prévia do quadro atual com o recorte.' : 'Parte recortada sobre fundo preto.'}</small></div>
      </div>
      <div class="btn-row" style="margin-top:10px;align-items:center">
        <span class="chip" data-p="all">Tudo</span><span class="chip" data-p="l">Metade esquerda</span><span class="chip" data-p="r">Metade direita</span><span class="chip" data-p="t">Metade de cima</span><span class="chip" data-p="b">Metade de baixo</span>
        <span class="sp"></span><span data-size style="font-size:12px;color:var(--tx2)"></span>
      </div>
      <div class="btn-row" style="align-items:center;gap:10px">
        <label class="switch"><input type="checkbox" data-g><i></i>Dividir em grade (folha de sprites)</label>
        <span data-gopts style="display:none;align-items:center;gap:6px;font-size:12px;color:var(--tx2)">Colunas <input type="number" data-gc value="2" min="1" max="20" style="width:54px"> Linhas <input type="number" data-gr value="1" min="1" max="20" style="width:54px"> <span>— clique numa parte</span></span>
      </div>
      <div class="hint" style="margin-bottom:0">${ic('crop', 13)} Arraste para desenhar a área. Arraste dentro para mover e nas bolinhas para ajustar. ${src.video ? 'No vídeo, o recorte vale para o vídeo inteiro.' : ''}</div>
    </div>`);
    const cv = $('[data-main]', body), c = cv.getContext('2d'), pv = $('[data-pv]', body), pc = pv.getContext('2d');
    const cropOf = s => ({ l: round(s.x * 100, 3), t: round(s.y * 100, 3), r: round((1 - s.x - s.w) * 100, 3), b: round((1 - s.y - s.h) * 100, 3) });
    const pt = clip ? (App.t >= clip.start && App.t < clip.start + clip.dur ? App.t : clip.start + Math.min(clip.dur / 2, 1)) : 0;
    const drawPreview = () => {
      if (clip) {
        const old = clip.crop; clip.crop = cropOf(sel);
        try { Renderer.render(pv, App.project, pt, { q: pv.width / PS.w, noSync: true }); } catch (e) { console.error('crop preview', e); }
        clip.crop = old;
      } else {
        pc.setTransform(1, 0, 0, 1, 0, 0); pc.fillStyle = '#000'; pc.fillRect(0, 0, pv.width, pv.height);
        const sw = sel.w * src.w, sh = sel.h * src.h, kk = Math.min(pv.width / sw, pv.height / sh) * .9;
        pc.drawImage(src.el, sel.x * src.w, sel.y * src.h, sw, sh, (pv.width - sw * kk) / 2, (pv.height - sh * kk) / 2, sw * kk, sh * kk);
      }
    };
    const draw = () => {
      c.clearRect(0, 0, W, H); c.drawImage(src.el, 0, 0, W, H);
      const x = sel.x * W, y = sel.y * H, w = sel.w * W, hh = sel.h * H;
      c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.rect(0, 0, W, H); c.rect(x, y, w, hh); c.fill('evenodd');
      if (grid.on) { c.strokeStyle = 'rgba(255,211,77,.9)'; c.setLineDash([5, 4]); c.lineWidth = 1; c.beginPath(); for (let i = 1; i < grid.cols; i++) { c.moveTo(i * W / grid.cols + .5, 0); c.lineTo(i * W / grid.cols + .5, H); } for (let j = 1; j < grid.rows; j++) { c.moveTo(0, j * H / grid.rows + .5); c.lineTo(W, j * H / grid.rows + .5); } c.stroke(); c.setLineDash([]); }
      c.strokeStyle = (typeof Tema !== 'undefined' ? Tema.cfg.cor : '#3d8bff'); c.lineWidth = 2; c.strokeRect(x, y, w, hh);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.beginPath(); for (let i = 1; i < 3; i++) { c.moveTo(x + w * i / 3, y); c.lineTo(x + w * i / 3, y + hh); c.moveTo(x, y + hh * i / 3); c.lineTo(x + w, y + hh * i / 3); } c.stroke();
      handles().forEach(([hx, hy]) => { c.fillStyle = '#fff'; c.strokeStyle = (typeof Tema !== 'undefined' ? Tema.cfg.cor : '#3d8bff'); c.lineWidth = 2; c.beginPath(); c.arc(hx, hy, 6, 0, 7); c.fill(); c.stroke(); });
      $('[data-size]', body).textContent = `${Math.round(sel.w * src.w)} × ${Math.round(sel.h * src.h)} px`;
      drawPreview();
    };
    const handles = () => { const x = sel.x * W, y = sel.y * H, w = sel.w * W, hh = sel.h * H; return [[x, y, 'nw'], [x + w / 2, y, 'n'], [x + w, y, 'ne'], [x + w, y + hh / 2, 'e'], [x + w, y + hh, 'se'], [x + w / 2, y + hh, 's'], [x, y + hh, 'sw'], [x, y + hh / 2, 'w']]; };
    const norm = () => { if (sel.w < 0) { sel.x += sel.w; sel.w = -sel.w; } if (sel.h < 0) { sel.y += sel.h; sel.h = -sel.h; } sel.x = clamp(sel.x, 0, 1); sel.y = clamp(sel.y, 0, 1); sel.w = clamp(sel.w, .005, 1 - sel.x); sel.h = clamp(sel.h, .005, 1 - sel.y); };
    cv.onpointerdown = e => {
      const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) / W, py = (e.clientY - r.top) / H;
      if (grid.on) { const ci = clamp(Math.floor(px * grid.cols), 0, grid.cols - 1), ri = clamp(Math.floor(py * grid.rows), 0, grid.rows - 1); sel = { x: ci / grid.cols, y: ri / grid.rows, w: 1 / grid.cols, h: 1 / grid.rows }; draw(); return; }
      const hd = handles().find(([hx, hy]) => Math.hypot(hx - px * W, hy - py * H) < 10);
      const s0 = { ...sel };
      const inside = px > sel.x && px < sel.x + sel.w && py > sel.y && py < sel.y + sel.h && !(sel.w > .97 && sel.h > .97);
      dragPointer(e, (ev, dx, dy) => {
        const fx = dx / W, fy = dy / H;
        if (hd) { const m = hd[2]; sel = { ...s0 }; if (m.includes('w')) { sel.x = s0.x + fx; sel.w = s0.w - fx; } if (m.includes('e')) sel.w = s0.w + fx; if (m.includes('n')) { sel.y = s0.y + fy; sel.h = s0.h - fy; } if (m.includes('s')) sel.h = s0.h + fy; if (ev.shiftKey && (m.length === 2)) { const ar = (s0.w * W) / (s0.h * H); sel.h = sel.w * W / ar / H; } }
        else if (inside) { sel.x = clamp(s0.x + fx, 0, 1 - s0.w); sel.y = clamp(s0.y + fy, 0, 1 - s0.h); }
        else { sel = { x: px, y: py, w: fx, h: fy }; }
        norm(); draw();
      });
    };
    $$('[data-p]', body).forEach(ch => ch.onclick = () => { sel = { all: { x: 0, y: 0, w: 1, h: 1 }, l: { x: 0, y: 0, w: .5, h: 1 }, r: { x: .5, y: 0, w: .5, h: 1 }, t: { x: 0, y: 0, w: 1, h: .5 }, b: { x: 0, y: .5, w: 1, h: .5 } }[ch.dataset.p]; draw(); });
    const gsw = $('[data-g]', body), gopts = $('[data-gopts]', body);
    const upGrid = () => { grid.on = gsw.checked; grid.cols = clamp(+$('[data-gc]', body).value || 1, 1, 20); grid.rows = clamp(+$('[data-gr]', body).value || 1, 1, 20); gopts.style.display = grid.on ? 'inline-flex' : 'none'; if (grid.on) sel = { x: 0, y: 0, w: 1 / grid.cols, h: 1 / grid.rows }; draw(); };
    gsw.onchange = upGrid; $('[data-gc]', body).oninput = upGrid; $('[data-gr]', body).oninput = upGrid;
    draw();
    const buttons = [{ label: 'Cancelar', value: null }];
    if (!src.video) buttons.unshift({ label: 'Salvar na biblioteca como imagem nova', left: true, value: 'asset' });
    if (clip) buttons.push({ label: 'Aplicar recorte', kind: 'primary', value: 'apply' });
    else if (src.video) buttons.push({ label: 'Fechar', value: null });
    const r = await UI.modal({ title: clip ? 'Recortar ' + (clip.name || '') : 'Recortar ' + asset.name, icon: 'crop', width: Math.max(640, W + pvWW + 90), body, enterValue: true, sticky: true, buttons });
    if (!r) return;
    const parts = grid.on && r === 'asset' ? await this.askParts(grid) : null;
    if (r === 'apply') {
      clip.crop = cropOf(sel);
      App.commit('Recorte aplicado: ' + Math.round(sel.w * src.w) + '×' + Math.round(sel.h * src.h) + ' px', { toast: true });
      return;
    }
    if (r === 'asset') {
      const list = parts === 'all' ? Array.from({ length: grid.cols * grid.rows }, (_, i) => ({ x: (i % grid.cols) / grid.cols, y: Math.floor(i / grid.cols) / grid.rows, w: 1 / grid.cols, h: 1 / grid.rows })) : [sel];
      const base = (clip?.name || asset?.name || 'imagem').replace(/\.[^.]+$/, '');
      const made = [];
      for (let i = 0; i < list.length; i++) {
        const s = list[i], o = document.createElement('canvas'); o.width = Math.max(1, Math.round(s.w * src.w)); o.height = Math.max(1, Math.round(s.h * src.h));
        o.getContext('2d').drawImage(src.el, s.x * src.w, s.y * src.h, s.w * src.w, s.h * src.h, 0, 0, o.width, o.height);
        const blob = await new Promise(res => o.toBlob(res, 'image/png'));
        const rt = await Assets.addBlob(blob, `${base} (parte ${list.length > 1 ? i + 1 : 'recortada'}).png`, App.project.id, 'image');
        App.project.bin.push(rt.meta.id); made.push(rt);
      }
      App.commit(`${made.length} imagem(ns) nova(s) na aba Mídia`, { toast: true, all: true });
      LibUI.setTab('media');
    }
  },
  async askParts(grid) {
    return await UI.modal({ title: 'Salvar quais partes?', icon: 'grid', body: `<p>A grade tem <b>${grid.cols * grid.rows}</b> partes.</p>`, buttons: [{ label: 'Só a parte escolhida', value: 'one' }, { label: `Todas as ${grid.cols * grid.rows} partes`, kind: 'primary', value: 'all' }], cancelValue: 'one' });
  },
};
