/* ===================== desenho-editor.js — desenhar DIRETO no editor (sem abrir os ossos) =====================
   Barra de ferramentas na prévia: pincel, lápis, borracha, balde, conta-gotas, quadro a quadro e papel-cebola.
   Desenha dentro do personagem (clipe com ossos) selecionado — na parte selecionada ou numa camada "Desenho" nova.
   Sem personagem selecionado, cria um clipe "Desenho" do tamanho do vídeo no tempo do cursor.
   Usa o mesmo pincel/balde do estúdio (anim/desenho.js: Desenho.opt, Desenho.fill, DrawLive). */
'use strict';
const EdDraw = {
  tool: null, // null = ferramentas normais do editor
  onion: false, onionN: 2,
  TOOLS: [['pincel', 'brush', 'Pincel (B)'], ['lapis', 'pencil', 'Lápis (P)'], ['borracha', 'eraser', 'Borracha (E)'], ['balde', 'bucket', 'Balde de tinta (G)'], ['conta', 'pipette', 'Conta-gotas (I)']],
  get O() { return Desenho.opt; },

  /* ---------- barra lateral (sempre visível na prévia) ---------- */
  mount() {
    const st = $('#pv-stage'); if (!st || $('#ed-draw')) return;
    try { this.onion = localStorage.getItem('ed-onion') === '1'; } catch { }
    const el = h('<div class="ed-draw" id="ed-draw"></div>'), bar = h('<div class="ed-dbar" id="ed-dbar"></div>');
    st.parentElement.style.position = 'relative'; st.parentElement.appendChild(el); st.parentElement.insertBefore(bar, st);
    this.render(); new ResizeObserver(() => this.place()).observe(st);
  },
  render() {
    const el = $('#ed-draw'); if (!el) return; const O = this.O; this._cbx?.sync(O.color);
    const LB = { pincel: 'Pincel', lapis: 'Lápis', borracha: 'Borracha', balde: 'Balde', conta: 'Pegar cor' };
    el.innerHTML = `<i class="ed-grip" title="Arraste para mover · duplo clique = grudar na esquerda">⋮⋮</i><button class="st-b ${!this.tool ? 'on' : ''}" data-t="" title="Parar de desenhar (voltar a mover)">${ic('cursor', 17)}<small>Mover</small></button><i class="st-sep"></i>`
      + this.TOOLS.map(([k, i, t]) => `<button class="st-b ${this.tool === k ? 'on' : ''}" data-t="${k}" title="${t}">${ic(i, 17)}<small>${LB[k]}</small></button>`).join('')
      + `<i class="st-sep"></i><label class="ed-col" title="Cor do pincel"><input type="color" value="${O.color}"><i style="background:${O.color}"></i><small>Cor</small></label>`
      + `<button class="st-b ${this.onion ? 'on' : ''}" data-k="onion" title="Papel-cebola (O): vermelho = antes, verde = depois">${ic('onion', 17)}<small>Cebola</small></button>`
      + `<button class="st-b ${O.quadro ? 'on' : ''}" data-k="quadro" title="Quadro a quadro: cada quadro ganha um desenho novo">${ic('frame', 17)}<small>Quadros</small></button>`
      + `<i class="st-sep"></i><button class="st-b" data-k="full" title="Editor completo da parte: camadas, seleção, varinha, laço, pincéis, IA (igual Photoshop)">${ic('layers', 17)}<small>Camadas</small></button>`;
    this.grip(el); $$('[data-t]', el).forEach(b => b.onclick = () => this.setTool(b.dataset.t || null));
    $('[data-k=onion]', el).onclick = () => this.toggleOnion(); $('[data-k=full]', el).onclick = () => this.full();
    $('[data-k=quadro]', el).onclick = () => { O.quadro = !O.quadro; Desenho.save(); this.render(); };
    const ci = $('input[type=color]', el); ci.oninput = () => { O.color = ci.value; Desenho.save(); $('.ed-col i', el).style.background = ci.value; this.bar(); };
    this.bar();
  },
  // barra de cima (só com ferramenta de desenho ligada): tamanho, opacidade, passo, quadros
  place() { const el = $('#ed-draw'), st = $('#pv-stage'); if (!el || !st) return; let pos = null; try { pos = JSON.parse(localStorage.getItem('ed-draw-pos') || 'null'); } catch { }
    const top = pos ? clamp(pos.y, st.offsetTop, st.offsetTop + st.clientHeight - 60) : st.offsetTop, left = pos ? clamp(pos.x, 0, st.clientWidth - 50) : 0;
    el.style.top = top + 'px'; el.style.left = left + 'px'; el.style.maxHeight = Math.max(120, st.offsetTop + st.clientHeight - top) + 'px'; el.classList.toggle('docked', !pos); },
  grip(el) { const g = $('.ed-grip', el); if (!g) return; g.onpointerdown = e => { e.preventDefault(); const r = el.getBoundingClientRect(), pr = el.parentElement.getBoundingClientRect(), x0 = r.left - pr.left, y0 = r.top - pr.top; dragPointer(e, (ev, dx, dy) => { const pos = { x: x0 + dx, y: y0 + dy }; try { localStorage.setItem('ed-draw-pos', JSON.stringify(pos)); } catch { } this.place(); }); }; g.ondblclick = () => { try { localStorage.removeItem('ed-draw-pos'); } catch { } this.place(); }; },
  bar() {
    const b = $('#ed-dbar'); if (!b) return; const O = this.O;
    if (!this.tool) { b.classList.remove('on'); b.innerHTML = ''; this.place(); return; }
    const T = this.peek();
    b.classList.add('on');
    b.innerHTML = `${this.tool === 'balde' ? `<label title="Tolerância de cor">Tol. <input type="range" min="0" max="120" value="${O.tol}" data-o="tol"><input type="number" class="ie-num" min="0" max="120" value="${O.tol}" data-o="tol"></label><label title="Fecha buraquinhos do contorno">Fechar falhas <input type="range" min="0" max="8" value="${O.gap}" data-o="gap"><input type="number" class="ie-num" min="0" max="8" value="${O.gap}" data-o="gap"></label>`
      : this.tool === 'conta' ? '<span>Clique numa cor da prévia</span>'
      : `<label>Tamanho <input type="range" min="1" max="120" value="${O.size}" data-o="size"><input type="number" class="ie-num" min="1" max="120" value="${O.size}" data-o="size"></label><label>Opac. <input type="range" min="5" max="100" value="${O.opacity}" data-o="opacity"><input type="number" class="ie-num" min="5" max="100" value="${O.opacity}" data-o="opacity"></label>`}
      <i class="vsep"></i>
      <button class="ibtn" data-a="prev" title="Quadro anterior (,)">${ic('left', 15)}</button><span class="ed-fr">${T ? 'Quadro ' + (T.f + 1) : ''}</span><button class="ibtn" data-a="next" title="Próximo quadro (.)">${ic('right', 15)}</button>
      <label title="Andar de quantos em quantos quadros">em <select data-o="passo">${[1, 2, 3, 4].map(n => `<option value="${n}" ${O.passo == n ? 'selected' : ''}>${n}s</option>`).join('')}</select></label>
      <button class="ibtn" data-a="novo" title="Desenho vazio neste quadro">${ic('plus', 15)}</button><button class="ibtn" data-a="copia" title="Copiar o desenho para este quadro">${ic('dup', 15)}</button><button class="ibtn" data-a="camada" title="Nova camada de desenho">${ic('layers', 15)}</button>
      <i class="vsep"></i><button class="btn sm" data-a="igual" title="Deixa o pincel com a espessura do contorno e as cores da parte escolhida">🎯 Igual à parte</button>${typeof AIClient !== 'undefined' && AIClient.ready ? '<button class="btn sm ai-btn" data-a="igualia" title="A IA olha a parte e escolhe tamanho e cores">🤖 IA escolher</button>' : ''}
      <span class="ed-pal">${(this.pal || []).map(c => `<button class="ed-sw ${c === O.color ? 'on' : ''}" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}</span>
      <span class="ed-tg" title="Onde o desenho vai">${T ? esc(T.c.name || 'Desenho') + ' › ' + esc(T.n?.name || 'camada nova') : 'clipe novo "Desenho"'}</span>`;
    this.place();
    $$('[data-o]', b).forEach(i => i.oninput = i.onchange = () => { const k = i.dataset.o; O[k] = i.type === 'number' ? clamp(+i.value || 0, +i.min, +i.max) : +i.value; Desenho.save(); $$(`[data-o=${k}]`, b).forEach(o => { if (o !== i) o.value = O[k]; }); });
    $('[data-a=igual]', b).onclick = () => this.matchPart(); $('[data-a=igualia]', b)?.addEventListener('click', () => this.matchAI());
    $$('[data-c]', b).forEach(s => s.onclick = () => { O.color = s.dataset.c; Desenho.save(); this.render(); });
    $('[data-a=prev]', b).onclick = () => this.step(-1); $('[data-a=next]', b).onclick = () => this.step(1);
    $('[data-a=novo]', b).onclick = () => this.newDrawing(false); $('[data-a=copia]', b).onclick = () => this.newDrawing(true);
    $('[data-a=camada]', b).onclick = () => { const T = this.target(true); if (!T) return; T.n = this.newLayer(T.c, T.rig); this.touch(T.c); App.commit('Camada de desenho'); this.bar(); };
  },
  // pincel do tamanho do contorno da parte e com as cores dela (paleta junta)
  matchPart() {
    const T = this.peek(); if (!T?.n) return UI.toast('Selecione uma parte do personagem (clique numa junta com 🦴 Ossos ou na aba Personagem)', { kind: 'warn', time: 3500 });
    const dr = [Rig.drawingAt(T.rig, T.n, T.f), ...T.n.drawings].find(d => d?.asset); const A = Desenho.analyze(dr); if (!A) return UI.toast('Essa parte não tem desenho', { kind: 'warn' });
    const Mp = this.mapper({ ...T, dr }), iw = Assets.get(dr.asset).img.naturalWidth, unitsPerImgPx = (dr.w ?? iw) / iw;
    this.O.size = clamp(Math.round(A.line * unitsPerImgPx * Mp.perUnit), 1, 120); this.O.color = A.outline; this.pal = [A.outline, ...A.cols.filter(c => c !== A.outline)].slice(0, 10); Desenho.save(); this.render();
    UI.toast(`Pincel ${this.O.size} px na cor do contorno · cores da parte na barra`, { time: 2500 });
  },
  async matchAI() {
    const T = this.peek(); if (!T?.n) return this.matchPart(); const dr = [Rig.drawingAt(T.rig, T.n, T.f), ...T.n.drawings].find(d => d?.asset), rt = dr && Assets.get(dr.asset); if (!rt?.img) return;
    const c = document.createElement('canvas'), k = Math.min(1, 600 / Math.max(rt.img.naturalWidth, rt.img.naturalHeight)); c.width = rt.img.naturalWidth * k; c.height = rt.img.naturalHeight * k; const g = c.getContext('2d'); g.fillStyle = '#888'; g.fillRect(0, 0, c.width, c.height); g.drawImage(rt.img, 0, 0, c.width, c.height);
    const b = UI.busy('🤖 A IA está olhando a parte…', '<div class="spinner"></div>');
    try { const j = await AIClient.call([{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: c.toDataURL('image/jpeg', .85).split(',')[1] } }, { type: 'text', text: 'Desenho de uma parte de personagem. Para continuar desenhando no mesmo estilo, responda SÓ JSON: {"contorno_px": espessura do contorno em pixels DESTA imagem, "cor_contorno":"#hex", "cores":["#hex",... até 8 cores de preenchimento/sombra usadas]}' }] }], 'Você analisa traço e paleta de desenhos. Só JSON.');
      b.close(); const t = (j.content || []).map(x => x.text || '').join(''), o = JSON.parse(t.match(/\{[\s\S]*\}/)[0]);
      const Mp = this.mapper({ ...T, dr }), unitsPerImgPx = (dr.w ?? rt.img.naturalWidth) / rt.img.naturalWidth;
      this.O.size = clamp(Math.round((+o.contorno_px || 4) / k * unitsPerImgPx * Mp.perUnit), 1, 120); this.O.color = o.cor_contorno || this.O.color; this.pal = [o.cor_contorno, ...(o.cores || [])].filter(Boolean).slice(0, 10); Desenho.save(); this.render(); UI.toast('A IA ajustou o pincel e as cores', { kind: 'ok' });
    } catch (e) { b.close(); this.matchPart(); }
  },
  setTool(t) {
    const was = !!this.tool; this.tool = t; if (t) this.lastTool = t; this.render();
    if (t && !was) this.focusLayers(); else if (was !== !!t) Props.render?.(); if (was !== !!t) App.fitPreview(); App.requestRender(); App.updatePvModo?.();
    const ov = $('#pv-overlay'); if (ov) ov.style.cursor = t ? (t === 'conta' ? 'copy' : 'crosshair') : '';
  },
  toggleOnion() { this.onion = !this.onion; try { localStorage.setItem('ed-onion', this.onion ? '1' : '0'); } catch { } this.render(); App.requestRender(); },
  step(dir) {
    const T = this.peek(), fps = T ? T.A.settings.fps : App.fps;
    const f = Math.floor(App.t * fps + 1e-4) + dir * Math.max(1, this.O.passo | 0); App.seek((Math.max(0, f) + .5) / fps, { snapFrame: false }); this.bar();
  },

  /* ---------- onde vai o traço ---------- */
  // começou a desenhar: o painel da direita mostra as camadas, com a camada escolhida à vista
  focusLayers() {
    if (typeof App === 'undefined' || !App.project) return;
    if (!RigEdit.sel()) { const c = App.project.clips.find(x => x.type === 'anim' && App.t >= x.start && App.t < x.start + x.dur); if (c) App.sel.clear(), App.sel.add(c.id); }
    const T = this.peek(); if (T && !T.n) { const n = T.rig.nodes.find(x => x.drawings.some(d => d.asset) && !x.hidden) || T.rig.nodes[0]; if (n) RigEdit.selNode = n.id; }
    if (typeof Paineis !== 'undefined' && Paineis.st?.right?.dock === 'hide') Paineis.show('right');
    Props.render?.(); App.requestRender?.(); this.bar();
    requestAnimationFrame(() => { const pe = $('#props'); if (pe) pe.scrollTop = 0; $('.ed-ly.on')?.scrollIntoView({ block: 'nearest' }); });
  },
  // abre o editor completo (camadas/seleção/varinha/IA) na parte escolhida — ou desenho novo do zero
  full() { const T = this.peek(); if (T?.n) return Cena.editPart(T.c, T.n); if (T) { const n = T.rig.nodes.find(x => x.drawings.some(d => d.asset)); if (n) { RigEdit.selNode = n.id; return Cena.editPart(T.c, n); } } Cena.drawNew(); },
  // painel da direita no modo Desenhar: as camadas (partes) do personagem, como no Photoshop
  panel() {
    const T = this.peek(), w = h('<div class="sec ed-lp"><div class="sec-h">🗂️ Camadas do desenho</div><div class="ed-lays"></div><div class="ed-lbtn"></div></div>'), L = $('.ed-lays', w), B = $('.ed-lbtn', w);
    if (!T) { L.innerHTML = '<small>Selecione um personagem para ver as camadas dele — ou comece um desenho novo.</small>'; }
    else for (const [n, lv] of Rig.ordered(T.rig)) {
      const di = Math.round(Rig.ch(T.rig, n.id, 'd', T.f, n.d || 0)), d = n.drawings[di] || n.drawings.find(x => x.asset), src = d?.asset && Assets.get(d.asset)?.img?.src;
      const r = h(`<div class="ed-ly ${RigEdit.selNode === n.id ? 'on' : ''}" style="padding-left:${6 + lv * 12}px"><button class="ibtn" data-v title="Mostrar/esconder">${n.hidden ? '🙈' : '👁'}</button>${src ? `<img src="${src}" alt="">` : '<i class="ed-ly-e"></i>'}<span>${esc(n.name)}</span><small>${n.drawings.length > 1 ? n.drawings.length + ' des.' : ''}</small><button class="ibtn" data-e title="Abrir no editor completo (camadas, seleção, varinha…)">✏️</button></div>`);
      r.onclick = e => { if (e.target.closest('button')) return; RigEdit.selNode = n.id; App.requestRender(); this.bar(); Props.render(); };
      r.ondblclick = () => Cena.editPart(T.c, n, di);
      $('[data-v]', r).onclick = () => { n.hidden = !n.hidden; this.touch(T.c); App.commit(n.hidden ? 'Camada escondida' : 'Camada visível'); Props.render(); };
      $('[data-e]', r).onclick = () => Cena.editPart(T.c, n, di);
      L.appendChild(r);
    }
    B.innerHTML = `<button class="btn sm" data-a="nova">➕ Camada nova</button><button class="btn sm primary" data-a="full">🖼️ Editor completo</button><button class="btn sm" data-a="zero">✏️ Desenhar novo do zero</button>`;
    $('[data-a=nova]', B).onclick = () => { const T2 = this.target(true); if (!T2) return; T2.n = this.newLayer(T2.c, T2.rig); RigEdit.selNode = T2.n.id; this.touch(T2.c); App.commit('Camada de desenho'); this.bar(); Props.render(); };
    $('[data-a=full]', B).onclick = () => this.full(); $('[data-a=zero]', B).onclick = () => Cena.drawNew();
    if (typeof ColorBox !== 'undefined') { const cs = h('<div class="sec ed-cp"><div class="sec-h">🎨 Cor do pincel</div></div>'); this._cbx = ColorBox.make(() => this.O.color, c => { this.O.color = c; Desenho.save(); const e = $('#ed-draw'); if (e) { const i = $('input[type=color]', e); if (i) i.value = c; const s = $('.ed-col i', e); if (s) s.style.background = c; } }); cs.appendChild(this._cbx); const f = document.createDocumentFragment(); f.appendChild(w); f.appendChild(cs); return f; }
    return w;
  },
  peek() { const c = RigEdit.sel(); if (!c) return null; const A = RigEdit.A(c), rig = A?.rigs?.[0]; if (!rig) return null; return { c, A, rig, f: RigEdit.frame(c), n: rig.nodes.find(x => x.id === RigEdit.selNode) || null }; },
  target(create) {
    let T = this.peek();
    if (!T) {
      if (!create) return null;
      const c = this.newClip(); T = { c, A: RigEdit.A(c), rig: RigEdit.rig(c), f: RigEdit.frame(c), n: null };
    }
    if (!T.n) T.n = T.rig.nodes.find(x => x.layer) || this.newLayer(T.c, T.rig);
    const { rig, n, f } = T, ks = rig.keys[n.id]?.d || [];
    let di = Math.round(Rig.ch(rig, n.id, 'd', f, n.d || 0));
    if (this.O.quadro && !ks.some(k => k.f === f) && (ks.length || n.drawings.some(d => d.asset))) di = this.addDrawing(T, false);
    if (!n.drawings[di]) di = this.addDrawing(T, false);
    T.dr = n.drawings[di]; T.di = di; return T;
  },
  newClip() {
    const s = App.project.settings, fps = 24, dur = 5, rig = Rig.newRig({ name: 'Desenho', w: s.w, h: s.h });
    rig.ox = s.w / 2; rig.oy = s.h; rig.stage = { X: 0, Y: s.h / 2, S: 1, F: 1, O: 100 }; rig.breath = 0;
    const A = { settings: { w: s.w, h: s.h, fps, bg: '#000000' }, frames: Math.ceil(dur * fps) + 2, rigs: [rig], camera: { keys: {} }, rev: 1 };
    const c = App.makeClip('anim', { start: App.frame(App.t), dur: App.frame(dur), name: 'Desenho' }); c.anim = { P: A, transparent: true };
    Actions.place(c); App.select(c.id); return c;
  },
  newLayer(c, rig) {
    const n = Rig.newNode({ name: 'Desenho ' + (rig.nodes.filter(x => x.layer).length + 1), role: 'parte', parent: Rig.roots(rig)[0]?.id || null, px: rig.w / 2, py: rig.h / 2, z: Math.max(0, ...rig.nodes.map(x => x.z)) + 1 });
    n.layer = true; n.drawings = []; rig.nodes.push(n); RigEdit.selNode = n.id;
    n.drawings.push(this.blank(RigEdit.A(c), rig, n, RigEdit.frame(c))); return n;
  },
  // desenho vazio cobrindo o quadro do clipe inteiro (e um pouco em volta)
  blank(A, rig, n, f, name) {
    const W = A.settings.w, H = A.settings.h; Rig.REST = true; const M = Rig.pose(rig, f); Rig.REST = false;
    const inv = Rig.stageMatrix(rig, f, W, H).multiply(M[n.id]).inverse(), m = .15 * Math.max(W, H);
    const q = [[-m, -m], [W + m, -m], [W + m, H + m], [-m, H + m]].map(([x, y]) => inv.transformPoint(new DOMPoint(x, y)));
    const x0 = Math.min(...q.map(p => p.x)), y0 = Math.min(...q.map(p => p.y)), x1 = Math.max(...q.map(p => p.x)), y1 = Math.max(...q.map(p => p.y));
    return { asset: null, name: name || 'desenho', ox: round(x0, 1), oy: round(y0, 1), w: round(x1 - x0, 1), h: round(y1 - y0, 1), blank: true };
  },
  addDrawing(T, copy) {
    const { rig, n, f } = T, cur = Rig.drawingAt(rig, n, f), d = copy && cur?.asset ? { ...cur, name: (cur.name || 'desenho') + ' (cópia)' } : this.blank(T.A, rig, n, f, 'quadro ' + (f + 1));
    const ks = rig.keys[n.id]?.d; if (!ks?.length && f > 0) Rig.setKey(rig, n.id, 'd', 0, n.d || 0, 'hold');
    n.drawings.push(d); const i = n.drawings.length - 1; Rig.setKey(rig, n.id, 'd', f, i, 'hold'); n._mk = null; return i;
  },
  newDrawing(copy) { const T = this.peek() ? { ...this.peek() } : null; const TT = T && T.n ? T : this.target(true); if (!TT) return; if (!TT.n) return; this.addDrawing(TT, copy); this.touch(TT.c); App.commit(copy ? 'Desenho copiado para o quadro' : 'Desenho vazio no quadro'); this.bar(); },
  touch(c) { RigEdit.touch(c); },

  /* ---------- mapa: tela → pixel do desenho ---------- */
  mapper(T) {
    const W = T.A.settings.w, H = T.A.settings.h, M = Rig.pose(T.rig, T.f), B = RigEdit.base(T.c).multiply(Rig.stageMatrix(T.rig, T.f, W, H)).multiply(M[T.n.id]);
    const inv = B.inverse(), cv = Desenho.canvasOf(T.dr), k = cv._k, dr = T.dr;
    const perUnit = App.pvScale * Math.hypot(B.a, B.b); // pixels de tela por unidade da parte
    return { cv, k, perUnit, map: p => { const q = inv.transformPoint(new DOMPoint(p.x, p.y)); return { x: (q.x - dr.ox) * k, y: (q.y - dr.oy) * k }; } };
  },

  /* ---------- pintar ---------- */
  down(e) {
    if (!this.tool || e.button !== 0 || !App.project) return false;
    e.preventDefault(); e.stopPropagation(); if (App.playing) App.pause();
    const pt = App.toProject(e);
    if (this.tool === 'conta') { this.pick(e); return true; }
    const T = this.target(true); if (!T) return true;
    const Mp = this.mapper(T), cv = Mp.cv, g = cv.getContext('2d'), O = this.O, t = this.tool;
    if (t === 'balde') { const q = Mp.map(pt); if (Desenho.fill(cv, q.x, q.y, O.color, O.tol, O.gap)) this.finish(T, 'Pintou com o balde'); return true; }
    const base = document.createElement('canvas'); base.width = cv.width; base.height = cv.height; base.getContext('2d').drawImage(cv, 0, 0);
    const stroke = document.createElement('canvas'); stroke.width = cv.width; stroke.height = cv.height; const sg = stroke.getContext('2d');
    const px = O.size / Math.max(1e-6, Mp.perUnit) * Mp.k;
    sg.lineCap = 'round'; sg.lineJoin = 'round'; sg.strokeStyle = sg.fillStyle = t === 'borracha' ? '#000' : O.color;
    const sm = clamp(O.smooth / 100, 0, .95); let last = null, sp = Mp.map(pt);
    const press = ev => (t === 'pincel' && O.pressure && ev.pointerType === 'pen') ? clamp(ev.pressure || .5, .1, 1) : 1;
    const put = (q, w) => { if (!last) { sg.beginPath(); sg.arc(q.x, q.y, w / 2, 0, 7); sg.fill(); last = { ...q, w }; return; } sg.lineWidth = (last.w + w) / 2; sg.beginPath(); sg.moveTo(last.x, last.y); sg.lineTo(q.x, q.y); sg.stroke(); last = { ...q, w }; };
    const compose = () => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'copy'; g.drawImage(base, 0, 0); g.globalCompositeOperation = t === 'borracha' ? 'destination-out' : 'source-over'; g.globalAlpha = t === 'borracha' ? 1 : O.opacity / 100; g.drawImage(stroke, 0, 0); g.restore(); this.touch(T.c); };
    put(sp, px * press(e)); compose();
    dragPointer(e, ev => { const q = Mp.map(App.toProject(ev)); sp = { x: sp.x + (q.x - sp.x) * (1 - sm), y: sp.y + (q.y - sp.y) * (1 - sm) }; put(sp, px * press(ev)); compose(); },
      () => { put(sp, px); compose(); this.finish(T, t === 'borracha' ? 'Apagou' : t === 'lapis' ? 'Traço de lápis' : 'Traço de pincel'); });
    return true;
  },
  async finish(T, label) {
    const cv = DrawLive.get(T.dr); if (!cv) return;
    const blob = await new Promise(r => cv.toBlob(r, 'image/png')); const rt = await Assets.addBlob(blob, `${T.n.name} — ${T.dr.name || 'desenho'}.png`, App.project.id, 'image');
    T.dr.asset = rt.meta.id; delete T.dr.blank; T.n._mk = null; DrawLive.delete(T.dr);
    this.touch(T.c); App.commit(label); this.bar();
  },
  pick(e) {
    const cv = $('#pv-canvas'), r = cv.getBoundingClientRect(), x = Math.round((e.clientX - r.left) / r.width * cv.width), y = Math.round((e.clientY - r.top) / r.height * cv.height);
    const q = cv.getContext('2d').getImageData(x, y, 1, 1).data; if (q[3] < 10) return;
    this.O.color = '#' + [q[0], q[1], q[2]].map(v => v.toString(16).padStart(2, '0')).join(''); Desenho.save(); this.render(); UI.toast(`Cor ${this.O.color}`, { time: 1000 });
  },

  /* ---------- papel-cebola na prévia do editor ---------- */
  drawOnion(g, k, d) {
    if (!this.onion || App.playing) return; const T = this.peek(); if (!T) return;
    const { c, A, rig } = T, f = T.f, W = A.settings.w, H = A.settings.h, step = Math.max(1, this.O.passo | 0), only = this.tool && T.n ? T.n : null;
    const same = ff => Rig.drawingAt(rig, only || rig.nodes[0], ff) === Rig.drawingAt(rig, only || rig.nodes[0], f) && (only ? ['r', 'x', 'y', 'sx', 'sy'].every(ch => Rig.ch(rig, only.id, ch, ff, 0) === Rig.ch(rig, only.id, ch, f, 0)) : JSON.stringify(Rig.capture(rig, ff)) === JSON.stringify(Rig.capture(rig, f)));
    const t0 = g.getTransform(), oc = this._oc ||= document.createElement('canvas'); if (oc.width !== g.canvas.width || oc.height !== g.canvas.height) { oc.width = g.canvas.width; oc.height = g.canvas.height; }
    const og = oc.getContext('2d');
    for (let i = this.onionN; i >= 1; i--) for (const [df, col, al] of [[-i * step, '#ff4d6a', .5 / i], [i * step, '#2fcf7a', .42 / i]]) {
      const ff = f + df; if (ff < 0 || ff >= A.frames || same(ff)) continue;
      const tt = RigEdit.timeOfFrame(c, ff), base = t0.multiply(new DOMMatrix().scaleSelf(k, k)).multiply(RigEdit.base(c, tt));
      og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, oc.width, oc.height);
      Rig.draw(og, rig, ff, W, H, { base, only: only ? (x => x === only) : null });
      og.setTransform(1, 0, 0, 1, 0, 0); og.globalCompositeOperation = 'source-atop'; og.fillStyle = col; og.fillRect(0, 0, oc.width, oc.height); og.globalCompositeOperation = 'source-over';
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = al; g.drawImage(oc, 0, 0); g.restore();
    }
  },
};
