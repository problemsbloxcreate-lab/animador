/* ===================== imgedit.js — editor de imagem (estilo Photoshop, simples) =====================
   Para PNGtuber e desenhos: seleção (varinha mágica, laço, retângulo, elipse, pincel de máscara), pintar, apagar,
   limpar o rosto (deixar liso), achar boca/olhos (automático ou com a IA) e separar em pastas.
   Abrir: ImgEdit.open({ asset, name, onSave(newAssetId), onSeparate(parts) }).
   A IA SEMPRE pergunta antes de mudar a imagem (regra do projeto). */
'use strict';
const ImgEdit = {
  TOOLS: [
    ['mao', '✋', 'Andar e zoom', 'Arraste para andar · rodinha = zoom (H ou Espaço)'],
    ['mover', '✥', 'Mover camada', 'Arraste a camada escolhida (V) · setas = 1 px · Ctrl+T = girar/tamanho'],
    '-',
    ['varinha', '🪄', 'Varinha mágica', 'Clique numa cor: seleciona a área parecida · Shift = somar · Alt = tirar'],
    ['laco', '➰', 'Laço', 'Desenhe em volta do que quer selecionar'],
    ['ret', '⬛', 'Retângulo', 'Arraste para selecionar um retângulo'],
    ['elipse', '⚪', 'Círculo', 'Arraste para selecionar um círculo/oval'],
    ['mascara', '🎭', 'Pincel de máscara', 'Pinte para SOMAR à seleção · Alt = tirar'],
    '-',
    ['pincel', '🖌️', 'Pincel', 'Pinta com a cor escolhida'],
    ['borracha', '🧽', 'Borracha', 'Apaga (deixa transparente)'],
    ['balde', '🪣', 'Balde', 'Pinta a área parecida com a cor escolhida'],
    ['conta', '💧', 'Pegar cor', 'Clique para pegar uma cor da imagem'],
  ],
  st: null,
  ICO: {
    mao: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V13c0 4-2.5 7-6 7-2.5 0-4-1.2-5.2-3.2L4 13.8a1.4 1.4 0 0 1 2.3-1.6L8 14"/>',
    mover: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
    varinha: '<path d="M4 20 15 9M14 4v3M19 9h-3M17.5 5.5l-2 2M9 5.5l1.2 1.2M18.5 14.5l-1.2-1.2"/><path d="m15 9 1.5 1.5" stroke-width="3"/>',
    laco: '<path d="M12 5c4.4 0 8 2 8 4.5S16.4 14 12 14s-8-2-8-4.5S7.6 5 12 5z" stroke-dasharray="3 2.2"/><path d="M8 13.5c-1 1.5-.5 3.5 1.5 4 1.4.4 2.5-.5 2.2-1.8-.3-1.2-2-1.4-2.7-.4"/>',
    ret: '<rect x="4" y="5" width="16" height="14" rx="1" stroke-dasharray="3 2.2"/>',
    elipse: '<ellipse cx="12" cy="12" rx="8.5" ry="7" stroke-dasharray="3 2.2"/>',
    mascara: '<rect x="3.5" y="5" width="17" height="14" rx="2" stroke-dasharray="3 2.2"/><circle cx="12" cy="12" r="3.6" fill="currentColor" fill-opacity=".35"/>',
    pincel: '<path d="M14.5 4.5 19.5 9.5 11 18l-5-5z"/><path d="M6 13c-2 .5-3 2-3 4.5 0 1 .2 1.8.5 2.5 1.5-.2 4.5-.7 5.5-3"/>',
    borracha: '<path d="m7 17 10-10 3 3-8.5 8.5H8z"/><path d="M5 20h14M12.5 11.5l3 3"/>',
    balde: '<path d="m6 11 6-6 7 7-6 6c-1 1-2.6 1-3.6 0L6 14.6c-1-1-1-2.6 0-3.6z"/><path d="M6 12h13M20 15c.8 1.2 1.2 2 1.2 2.6a1.2 1.2 0 0 1-2.4 0c0-.6.4-1.4 1.2-2.6z" fill="currentColor"/>',
    conta: '<path d="m14 5 5 5M15.5 3.5l5 5-2 2-5-5zM13 7 5 15v4h4l8-8"/>',
  },
  icon(k, s = 20) { return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${this.ICO[k] || ''}</svg>`; },
  BRUSHES: [['redondo', 'Redondo'], ['macio', 'Macio'], ['lapis', 'Lápis (duro)'], ['marcador', 'Marcador'], ['spray', 'Spray'], ['tinta', 'Tinta (pressão)']],

  /* ---------- abrir ---------- */
  async open(o) {
    const rt = o.blank ? null : Assets.get(o.asset); if (!o.blank && !rt?.img) return UI.toast('Imagem não carregada', { kind: 'err' });
    const W = o.blank ? o.blank.w : rt.img.naturalWidth, H = o.blank ? o.blank.h : rt.img.naturalHeight, base = this.mkLayer(o.blank ? 'Fundo' : 'Original', W, H, rt?.img);
    if (o.blank?.white) { base.g.fillStyle = '#fff'; base.g.fillRect(0, 0, W, H); }
    this.st = { o, W, H, layers: [base], cur: 0, cv: base.cv, g: base.g, sel: new Uint8Array(W * H), tool: 'varinha', mode: 'novo', tol: 32, contig: true, size: 24, color: '#ffffff', brush: 'redondo', opa: 100, hard: 70, spacing: 15, sens: 60, hist: [], redo: [], view: { z: 1, x: 0, y: 0 }, parts: [], curPart: -1 };
    this.push();
    const root = h(`<div class="ie-back"><div class="ie">
      <div class="ie-top"><b class="ie-title">🖼️ Editar imagem: ${esc(o.name || 'imagem')}</b><span class="sp"></span>
        <button class="btn" data-a="undo" title="Desfazer (Ctrl+Z)">↶ Desfazer</button><button class="btn" data-a="redo" title="Refazer (Ctrl+Y)">↷ Refazer</button>
        <button class="btn" data-a="size" title="Aumentar ou diminuir a tela (tamanho da imagem) ou cortar na seleção">📐 Tamanho da tela</button><button class="btn" data-a="cancel">Cancelar</button><button class="btn primary" data-a="save">✔ Salvar</button></div>
      <div class="ie-body">
        <nav class="ie-tools"></nav>
        <div class="ie-mid"><div class="ie-opts"></div><div class="ie-stage"><canvas class="ie-cv"></canvas></div><div class="ie-hint"></div></div>
        <aside class="ie-side"></aside>
      </div></div></div>`);
    document.body.appendChild(root); this.root = root;
    $('[data-a=cancel]', root).onclick = () => this.close();
    $('[data-a=save]', root).onclick = () => this.save();
    $('[data-a=undo]', root).onclick = () => this.undo(); $('[data-a=redo]', root).onclick = () => this.redoA();
    this.onKey = e => this.key(e); this.onKeyUp = e => { if (e.code === 'Space') this._space = false; };
    addEventListener('keyup', this.onKeyUp, true);
    addEventListener('keydown', this.onKey, true);
    if (o.blank) { const L = this.mkLayer('Camada 1', W, H); this.st.layers.push(L); this.setCur(1, true); this.st.tool = 'pincel'; this.st.color = '#222222'; this.push(); }
    $('[data-a=size]', root).onclick = () => this.canvasSize();
    this.tools(); this.opts(); this.side(); this.initStage(); this.fit();
    clearInterval(this._antsT); this._antsT = setInterval(() => { if (!this.root) return clearInterval(this._antsT); if (this._ants) { this._antOff = ((this._antOff || 0) + 1) % 8; this.draw(); } }, 110);
  },
  close() { clearInterval(this._antsT); document.querySelectorAll('.ctx').forEach(m => m.remove()); removeEventListener('keydown', this.onKey, true); removeEventListener('keyup', this.onKeyUp, true); this.root?.remove(); this.root = null; this.st = null; },
  async save(asNew) {
    const S = this.st; if (S.tf) this.applyTf(); const blob = await new Promise(r => this.flat().toBlob(r, 'image/png'));
    const rt = await Assets.addBlob(blob, (S.o.name || 'imagem').replace(/\.png$/i, '') + ' (editada).png', App.project?.id || Studio?.P?.id, 'image');
    if (App.project) { App.project.bin ||= []; App.project.bin.push(rt.meta.id); }
    const cb = S.o.onSave; this.close(); cb && await cb(rt.meta.id); UI.toast('Imagem salva', { kind: 'ok', time: 1400 });
  },

  /* ---------- histórico ---------- */
  // cada passo guarda só as camadas que mudaram (as outras reaproveitam a cópia anterior)
  push() {
    const S = this.st, prev = S.hist[S.hist.length - 1], snap = L => { const c = document.createElement('canvas'); c.width = S.W; c.height = S.H; c.getContext('2d').drawImage(L.cv, 0, 0); return c; };
    S.hist.push({ W: S.W, H: S.H, cur: S.cur, sel: S.sel.slice(), layers: S.layers.map(L => { const old = prev?.layers.find(x => x.id === L.id); const ss = !L.dirty && old && old.snap.width === S.W && old.snap.height === S.H ? old.snap : snap(L); L.dirty = false; return { id: L.id, name: L.name, vis: L.vis, kind: L.kind, snap: ss }; }) });
    if (S.hist.length > 25) S.hist.shift(); S.redo = [];
  },
  restoreH(h0) {
    const S = this.st; if (h0.W) { S.W = h0.W; S.H = h0.H; } S.layers = h0.layers.map(x => { const L = this.mkLayer(x.name, S.W, S.H, x.snap); L.id = x.id; L.vis = x.vis; L.kind = x.kind; return L; });
    this.setCur(Math.min(h0.cur, S.layers.length - 1), true); S.sel = h0.sel.slice(); this.selChanged(); this.layersUI();
  },
  undo() { const S = this.st; if (S.tf) return this.cancelTf(); if (S.hist.length < 2) return; S.redo.push(S.hist.pop()); this.restoreH(S.hist[S.hist.length - 1]); },
  redoA() { const S = this.st; const h0 = S.redo.pop(); if (!h0) return; S.hist.push(h0); this.restoreH(h0); },
  commit() { if (this.st.layers[this.st.cur]) this.st.layers[this.st.cur].dirty = true; this.push(); this.selChanged(); this.layersUI(); },

  /* ---------- interface ---------- */
  tools() {
    const S = this.st, el = $('.ie-tools', this.root); el.innerHTML = '';
    for (const T of this.TOOLS) { if (T === '-') { el.appendChild(h('<i class="ie-sep"></i>')); continue; } const [k, e, n, t] = T; const b = h(`<button class="ie-tb ${S.tool === k ? 'on' : ''}" title="${n}: ${t}"><span>${this.icon(k)}</span><small>${n}</small></button>`); b.onclick = () => { S.tool = k; this.tools(); this.opts(); }; el.appendChild(b); }
  },
  opts() {
    const S = this.st, el = $('.ie-opts', this.root), T = this.TOOLS.find(x => x[0] === S.tool);
    const selTool = ['varinha', 'laco', 'ret', 'elipse', 'mascara'].includes(S.tool), paint = ['pincel', 'balde', 'mascara', 'borracha'].includes(S.tool);
    el.innerHTML = `<b class="ie-tn">${this.icon(S.tool, 16)} ${T[2]}</b>
      ${selTool ? `<div class="ie-seg" title="O que fazer com a seleção">${[['novo', 'Nova'], ['somar', '+ Somar'], ['tirar', '− Tirar']].map(([k, l]) => `<button data-m="${k}" class="${S.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
      ${['varinha', 'balde'].includes(S.tool) ? `<label>Tolerância <input type="range" min="0" max="160" value="${S.tol}" data-o="tol"><input type="number" class="ie-num" min="0" max="160" value="${S.tol}" data-o="tol"></label><label class="switch xs"><input type="checkbox" ${S.contig ? 'checked' : ''} data-o="contig"><i></i>Só a área encostada</label>` : ''}
      ${['pincel', 'borracha', 'mascara'].includes(S.tool) ? `<label>Tamanho <input type="range" min="1" max="200" value="${S.size}" data-o="size"><input type="number" class="ie-num" min="1" max="200" value="${S.size}" data-o="size"></label>` : ''}
      ${['pincel', 'borracha'].includes(S.tool) ? `<label>Pincel <select data-o="brush">${this.BRUSHES.map(([k, l]) => `<option value="${k}" ${S.brush === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label title="Força da tinta">Opac. <input type="range" min="5" max="100" value="${S.opa}" data-o="opa"><input type="number" class="ie-num" min="5" max="100" value="${S.opa}" data-o="opa"></label>
        <label title="Borda dura ou macia">Dureza <input type="range" min="0" max="100" value="${S.hard}" data-o="hard"><input type="number" class="ie-num" min="0" max="100" value="${S.hard}" data-o="hard"></label>
        <label title="Distância entre as pinceladas">Espaço <input type="range" min="2" max="100" value="${S.spacing}" data-o="spacing"><input type="number" class="ie-num" min="2" max="100" value="${S.spacing}" data-o="spacing"></label>
        <label title="Sensibilidade da caneta (pressão)">Pressão <input type="range" min="0" max="100" value="${S.sens}" data-o="sens"><input type="number" class="ie-num" min="0" max="100" value="${S.sens}" data-o="sens"></label>` : ''}
      <span class="ie-rgb" title="Cor">${['r', 'g', 'b'].map((c, i) => `<label>${c.toUpperCase()}<input type="number" min="0" max="255" value="${hexToRgb(S.color)[i]}" data-rgb="${i}"></label>`).join('')}<input type="color" value="${S.color}" data-o="color"><input type="text" value="${S.color}" data-hex maxlength="7"></span>
      <span class="sp"></span><small>${esc(T[3])}</small>`;
    $$('[data-m]', el).forEach(b => b.onclick = () => { S.mode = b.dataset.m; this.opts(); });
    this._cbx?.sync(S.color);
    const setCol = c => { S.color = c; this._cbx?.sync(c); $$('[data-rgb]', el).forEach((n, j) => n.value = hexToRgb(c)[j]); $('[data-o=color]', el).value = c; $('[data-hex]', el).value = c; };
    $$('[data-rgb]', el).forEach(n => n.oninput = () => { const v = $$('[data-rgb]', el).map(x => clamp(+x.value || 0, 0, 255)); setCol('#' + v.map(x => x.toString(16).padStart(2, '0')).join('')); });
    $('[data-hex]', el).onchange = e => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) setCol(e.target.value.toLowerCase()); };
    $$('[data-o]', el).forEach(i => i.oninput = i.onchange = () => { const k = i.dataset.o; S[k] = i.type === 'checkbox' ? i.checked : i.type === 'color' || i.tagName === 'SELECT' ? i.value : +i.value; if (k === 'color') setCol(i.value); if (k === 'brush') { const P = { redondo: [70, 15], macio: [0, 12], lapis: [100, 8], marcador: [90, 10], spray: [40, 30], tinta: [80, 10] }[i.value]; [S.hard, S.spacing] = P; this.opts(); return; } if (i.type === 'number') { S[k] = clamp(+i.value || 0, +i.min, +i.max); } $$(`[data-o=${k}]`, el).forEach(o => { if (o !== i && o.type !== 'checkbox') o.value = S[k]; }); this.draw(); });
  },
  side() {
    const S = this.st, el = $('.ie-side', this.root), has = S.sel.some(v => v > 0), AI = typeof AIClient !== 'undefined' && AIClient.ready;
    el.innerHTML = `
      <div class="ie-box ie-navb"><h4>🔭 Ver a imagem toda <small>${S.W}×${S.H} · ${Math.round(S.view.z * 100)}%</small></h4><canvas class="ie-nav" width="232" height="150" title="Clique ou arraste para andar pela imagem"></canvas></div>
      <div class="ie-box ie-colb"><h4>🎨 Cor</h4></div>
      <div class="ie-box"><h4>✂️ Seleção</h4><div class="ie-grid">
        <button class="btn" data-a="all">Selecionar tudo</button><button class="btn" data-a="none" ${has ? '' : 'disabled'}>Tirar seleção</button>
        <button class="btn" data-a="inv">Inverter</button><button class="btn" data-a="grow" ${has ? '' : 'disabled'}>Aumentar 3px</button>
        <button class="btn" data-a="fill" ${has ? '' : 'disabled'}>🎨 Pintar com a cor</button><button class="btn" data-a="erase" ${has ? '' : 'disabled'}>🧽 Apagar</button>
        <button class="btn wide" data-a="copy" ${has ? '' : 'disabled'}>📄 Virar desenho novo (pasta)</button></div></div>
      <div class="ie-box ie-lay"><h4>🗂️ Camadas <small>(${S.layers.length})</small></h4><div class="ie-layers"></div>
        <div class="ie-grid"><button class="btn" data-a="lnew" title="Camada vazia">➕ Camada nova</button><button class="btn" data-a="lcopy" title="Ctrl+J: a seleção vira uma camada (copia)">📄 Seleção → camada</button>
        <button class="btn" data-a="lcut" title="Ctrl+Shift+J: a seleção sai e vira uma camada">✂️ Recortar → camada</button><button class="btn" data-a="ltf" title="Ctrl+T: mover, girar e mudar o tamanho da camada">🔄 Transformar</button>
        <button class="btn ai-btn wide" data-ai="partes" ${AI ? '' : 'disabled'}>🤖 IA: separar tudo em camadas</button>
        <button class="btn primary wide" data-a="luse" title="Cada camada vira reação (troca de rosto) ou peça do corpo (osso separado)">🦴 Usar as camadas no personagem…</button></div></div>
      <div class="ie-box"><h4>⚡ Automático</h4><div class="ie-grid">
        <button class="btn" data-a="face">😶 Achar o rosto</button><button class="btn" data-a="clean">🧼 Limpar o rosto</button>
        <button class="btn" data-a="mouth">👄 Achar a boca</button><button class="btn" data-a="eyes">👀 Achar os olhos</button>
        <button class="btn wide" data-a="split">📂 Separar boca e olhos em pastas</button>
        <button class="btn wide" data-a="bg">🧹 Tirar o fundo (cor da borda)</button></div></div>
      <div class="ie-box ai"><h4>🤖 Com a IA ${AI ? '' : '<small>(precisa da IA ligada)</small>'}</h4><div class="ie-grid">
        <button class="btn ai-btn" data-ai="rosto" ${AI ? '' : 'disabled'}>😶 IA: achar o rosto</button><button class="btn ai-btn" data-ai="boca" ${AI ? '' : 'disabled'}>👄 IA: achar a boca</button>
        <button class="btn ai-btn" data-ai="olhos" ${AI ? '' : 'disabled'}>👀 IA: achar os olhos</button><button class="btn ai-btn" data-ai="limpar" ${AI ? '' : 'disabled'}>🧼 IA: limpar o rosto</button></div>
        <div class="ie-ask"><input type="text" placeholder="Ex.: selecione o cabelo" ${AI ? '' : 'disabled'}><button class="btn ai-btn" data-ai="livre" ${AI ? '' : 'disabled'}>Pedir</button></div>
        <small>A IA marca a seleção e <b>pergunta antes</b> de mudar a imagem.</small></div>`;
    const A = (k, f) => { const b = $(`[data-a=${k}]`, el); if (b) b.onclick = f; };
    A('all', () => this.selAll()); A('none', () => this.selNone()); A('inv', () => { S.sel = S.sel.map(v => 255 - v); this.commit(); }); A('grow', () => { this.grow(3); this.commit(); });
    A('fill', () => this.fillSel(S.color)); A('erase', () => this.eraseSel()); A('copy', () => this.copySel());
    A('face', () => { const m = this.faceMask(); if (!m) return UI.toast('Não achei um rosto claro', { kind: 'warn' }); this.setSel(m); });
    A('clean', () => this.cleanFace());
    A('mouth', () => { const m = this.partMask('boca'); if (!m) return UI.toast('Não achei a boca', { kind: 'warn' }); this.setSel(m); });
    A('eyes', () => { const m = this.partMask('olhos'); if (!m) return UI.toast('Não achei os olhos', { kind: 'warn' }); this.setSel(m); });
    A('split', () => this.splitParts()); A('bg', () => this.removeBg());
    A('lnew', () => this.newLayer()); A('lcopy', () => this.selToLayer(false)); A('lcut', () => this.selToLayer(true)); A('ltf', () => this.startTf()); A('luse', () => this.useLayers());
    const nv = $('.ie-nav', el); nv.onpointerdown = e => { const go = ev => { const r = nv.getBoundingClientRect(), k = this._navK, st = $('.ie-stage', this.root); if (!k) return; const ix = (ev.clientX - r.left - k.ox) / k.k, iy = (ev.clientY - r.top - k.oy) / k.k; S.view.x = st.clientWidth / 2 - ix * S.view.z; S.view.y = st.clientHeight / 2 - iy * S.view.z; this.draw(); }; go(e); dragPointer(e, go); };
    if (typeof ColorBox !== 'undefined') { this._cbx = ColorBox.make(() => S.color, c => { S.color = c; const o = $('.ie-opts', this.root); if (o) { $$('[data-rgb]', o).forEach((n, j) => n.value = hexToRgb(c)[j]); const ci = $('[data-o=color]', o); if (ci) ci.value = c; const hx = $('[data-hex]', o); if (hx) hx.value = c; } }); $('.ie-colb', el).appendChild(this._cbx); }
    this.layersUI(); this.nav();
    $$('[data-ai]', el).forEach(b => b.onclick = () => this.ai(b.dataset.ai, $('.ie-ask input', el).value.trim()));
  },
  // miniatura no canto (navegador): imagem toda + retângulo do que aparece na tela
  nav() {
    const S = this.st, nv = this.root && $('.ie-nav', this.root); if (!nv || !S) return; const g = nv.getContext('2d'), k = Math.min(nv.width / S.W, nv.height / S.H), ox = (nv.width - S.W * k) / 2, oy = (nv.height - S.H * k) / 2; this._navK = { k, ox, oy };
    g.clearRect(0, 0, nv.width, nv.height); g.fillStyle = '#d8d8d8'; g.fillRect(ox, oy, S.W * k, S.H * k); for (const L of S.layers) if (L.vis) g.drawImage(L.cv, ox, oy, S.W * k, S.H * k);
    const st = $('.ie-stage', this.root), v = S.view; g.strokeStyle = '#ff4d6a'; g.lineWidth = 2; g.strokeRect(ox + (-v.x / v.z) * k, oy + (-v.y / v.z) * k, st.clientWidth / v.z * k, st.clientHeight / v.z * k);
    const hz = $('.ie-navb small', this.root); if (hz) hz.textContent = `${S.W}×${S.H} · ${Math.round(v.z * 100)}%`;
  },
  // 📐 tamanho da tela: aumentar/diminuir (com âncora) ou cortar na seleção
  async canvasSize() {
    const S = this.st; if (S.tf) this.applyTf(); const has = S.sel.some(v => v > 127);
    const body = h(`<div class="ie-csz"><div class="ie-csz-r"><label>Largura <input type="number" min="16" max="8000" value="${S.W}" data-w></label><label>Altura <input type="number" min="16" max="8000" value="${S.H}" data-h></label><label class="ck"><input type="checkbox" data-lock checked> manter proporção</label></div>
      <div class="ie-csz-r"><span>Onde fica o desenho:</span><div class="ie-anc">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<button data-an="${i}" class="${i === 4 ? 'on' : ''}"></button>`).join('')}</div>
      <div class="ie-grid"><button class="btn sm" data-p="2">Dobro</button><button class="btn sm" data-p=".5">Metade</button><button class="btn sm" data-p="pad">+20% de espaço</button>${has ? '<button class="btn sm" data-p="crop">✂️ Cortar na seleção</button>' : ''}</div></div>
      <small>Aumentar dá mais espaço para desenhar. Diminuir corta as beiradas. (Dá para desfazer com Ctrl+Z.)</small></div>`);
    let an = 4, crop = false; const iw = $('[data-w]', body), ih = $('[data-h]', body), lk = $('[data-lock]', body);
    iw.oninput = () => { if (lk.checked) ih.value = Math.round(+iw.value * S.H / S.W); crop = false; }; ih.oninput = () => { if (lk.checked) iw.value = Math.round(+ih.value * S.W / S.H); crop = false; };
    $$('[data-an]', body).forEach(b => b.onclick = () => { an = +b.dataset.an; $$('[data-an]', body).forEach(x => x.classList.toggle('on', x === b)); });
    $$('[data-p]', body).forEach(b => b.onclick = () => { const p = b.dataset.p; crop = p === 'crop'; if (p === 'pad') { iw.value = Math.round(S.W * 1.2); ih.value = Math.round(S.H * 1.2); } else if (!crop) { iw.value = Math.round(S.W * +p); ih.value = Math.round(S.H * +p); } else { const bb = this.selBox(); iw.value = bb.w; ih.value = bb.h; } });
    const ok = await UI.modal({ title: '📐 Tamanho da tela', icon: 'image', width: 460, body, buttons: [{ label: 'Cancelar', value: false }, { label: 'Aplicar', kind: 'primary', value: true }] }); if (!ok) return;
    if (crop) { const b = this.selBox(); return this.resizeCanvas(b.w, b.h, -b.x, -b.y); }
    const nw = clamp(Math.round(+iw.value) || S.W, 16, 8000), nh = clamp(Math.round(+ih.value) || S.H, 16, 8000), ax = an % 3 / 2, ay = Math.floor(an / 3) / 2;
    this.resizeCanvas(nw, nh, Math.round((nw - S.W) * ax), Math.round((nh - S.H) * ay));
  },
  selBox() { const S = this.st; let x0 = S.W, y0 = S.H, x1 = -1, y1 = -1; for (let i = 0; i < S.sel.length; i++) if (S.sel[i] > 127) { const x = i % S.W, y = (i / S.W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; },
  resizeCanvas(nw, nh, dx, dy) {
    const S = this.st; for (const L of S.layers) { const c = document.createElement('canvas'); c.width = nw; c.height = nh; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(L.cv, dx, dy); L.cv = c; L.g = g; L.dirty = true; }
    S.W = nw; S.H = nh; S.sel = new Uint8Array(nw * nh); this.setCur(S.cur, true); this._dc = null; this.push(); this.selChanged(); this.layersUI(); this.fit(); UI.toast(`Tela agora: ${nw}×${nh}`, { kind: 'ok', time: 1500 });
  },
  hint(t) { const e = $('.ie-hint', this.root); if (e) e.innerHTML = t || ''; },

  /* ---------- palco: zoom/andar e desenho ---------- */
  initStage() {
    const st = $('.ie-stage', this.root), cv = $('.ie-cv', this.root);
    new ResizeObserver(() => this.draw()).observe(st);
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, v = this.st.view, z = clamp(v.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), .05, 40); v.x = mx - (mx - v.x) * z / v.z; v.y = my - (my - v.y) * z / v.z; v.z = z; this.draw(); }, { passive: false });
    cv.addEventListener('pointerdown', e => this.down(e));
    cv.addEventListener('contextmenu', e => { e.preventDefault(); this.menu(e); });
    cv.addEventListener('pointermove', e => { const p = this.pt(e); this._cur = p; if (['pincel', 'borracha', 'mascara'].includes(this.st.tool)) this.draw(); });
  },
  fit() { const st = $('.ie-stage', this.root), S = this.st, z = Math.min((st.clientWidth - 40) / S.W, (st.clientHeight - 40) / S.H); S.view = { z, x: (st.clientWidth - S.W * z) / 2, y: (st.clientHeight - S.H * z) / 2 }; this.draw(); },
  pt(e) { const r = $('.ie-cv', this.root).getBoundingClientRect(), v = this.st.view; return { x: (e.clientX - r.left - v.x) / v.z, y: (e.clientY - r.top - v.y) / v.z }; },
  selChanged() { this._ov = null; this.draw(); this.side(); },
  overlay() {
    if (this._ov) return this._ov; const S = this.st, W = S.W, H = S.H, o = document.createElement('canvas'); o.width = W; o.height = H; const g = o.getContext('2d'), im = g.createImageData(W, H), d = im.data, s = S.sel;
    // dentro: azul bem leve · borda: "formigas andando" (linha tracejada que anda, igual no Photoshop)
    const on = i => s[i] > 127, P = new Path2D(); let any = false;
    for (let y = 0; y < H; y++) { let ht = -1, hb = -1; for (let x = 0; x <= W; x++) { const i = y * W + x, a = x < W && on(i);
        if (a) { const q = i * 4; d[q] = 40; d[q + 1] = 160; d[q + 2] = 255; d[q + 3] = s[i] * .18; any = true; }
        const top = a && (y === 0 || !on(i - W)), bot = a && (y === H - 1 || !on(i + W));
        if (top && ht < 0) ht = x; if (!top && ht >= 0) { P.moveTo(ht, y); P.lineTo(x, y); ht = -1; }
        if (bot && hb < 0) hb = x; if (!bot && hb >= 0) { P.moveTo(hb, y + 1); P.lineTo(x, y + 1); hb = -1; } } }
    for (let x = 0; x < W; x++) { let vl = -1, vr = -1; for (let y = 0; y <= H; y++) { const i = y * W + x, a = y < H && on(i);
        const l = a && (x === 0 || !on(i - 1)), r = a && (x === W - 1 || !on(i + 1));
        if (l && vl < 0) vl = y; if (!l && vl >= 0) { P.moveTo(x, vl); P.lineTo(x, y); vl = -1; }
        if (r && vr < 0) vr = y; if (!r && vr >= 0) { P.moveTo(x + 1, vr); P.lineTo(x + 1, y); vr = -1; } } }
    g.putImageData(im, 0, 0); this._ants = any ? P : null; return (this._ov = o);
  },
  draw() {
    const S = this.st; if (!S) return; const st = $('.ie-stage', this.root), cv = $('.ie-cv', this.root), d = devicePixelRatio || 1, W = st.clientWidth, H = st.clientHeight;
    if (cv.width !== W * d || cv.height !== H * d) { cv.width = W * d; cv.height = H * d; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    const g = cv.getContext('2d'), v = S.view; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H);
    // quadriculado = transparente
    g.save(); g.translate(v.x, v.y); g.scale(v.z, v.z); g.fillStyle = this.chk(g); g.fillRect(0, 0, S.W, S.H); g.imageSmoothingEnabled = v.z < 2; S.layers.forEach((L, i) => { if (!L.vis) return; if (i === S.cur && (S.tf || S.mv)) { g.save(); const t = S.tf || { ...S.mv, s: 1, r: 0, cx: 0, cy: 0 }; g.translate(t.cx + t.x, t.cy + t.y); g.rotate(t.r * Math.PI / 180); g.scale(t.s, t.s); g.translate(-t.cx, -t.cy); g.drawImage(L.cv, 0, 0); g.restore(); } else g.drawImage(L.cv, 0, 0); }); g.drawImage(this.overlay(), 0, 0);
    if (this._ants) { g.lineWidth = 1.2 / v.z; g.setLineDash([4 / v.z, 4 / v.z]); g.strokeStyle = '#000'; g.lineDashOffset = -(this._antOff || 0) / v.z; g.stroke(this._ants); g.strokeStyle = '#fff'; g.lineDashOffset = -((this._antOff || 0) + 4) / v.z; g.stroke(this._ants); g.setLineDash([]); g.lineDashOffset = 0; }
    if (S.tf) this.drawTf(g, v);
    if (this._lasso?.length) { g.strokeStyle = '#fff'; g.lineWidth = 2 / v.z; g.setLineDash([6 / v.z, 4 / v.z]); g.beginPath(); this._lasso.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); g.setLineDash([]); }
    if (this._box) { const b = this._box; g.strokeStyle = '#fff'; g.lineWidth = 2 / v.z; g.setLineDash([6 / v.z, 4 / v.z]); g.beginPath(); if (b.el) g.ellipse((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, Math.abs(b.x1 - b.x0) / 2, Math.abs(b.y1 - b.y0) / 2, 0, 0, 7); else g.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); g.stroke(); g.setLineDash([]); }
    if (!this._navT) this._navT = requestAnimationFrame(() => { this._navT = null; this.nav(); }); // miniatura acompanha na hora (1x por quadro)
    if (this._cur && ['pincel', 'borracha', 'mascara'].includes(S.tool)) { g.strokeStyle = '#fff'; g.lineWidth = 1.5 / v.z; g.beginPath(); g.arc(this._cur.x, this._cur.y, S.size / 2, 0, 7); g.stroke(); }
    g.restore();
  },
  chk(g) { if (this._chk) return this._chk; const t = document.createElement('canvas'); t.width = t.height = 20; const c = t.getContext('2d'); c.fillStyle = '#d8d8dc'; c.fillRect(0, 0, 20, 20); c.fillStyle = '#b8b8be'; c.fillRect(0, 0, 10, 10); c.fillRect(10, 10, 10, 10); return (this._chk = g.createPattern(t, 'repeat')); },
  down(e) {
    const S = this.st, p = this.pt(e), t = S.tool, mode = e.shiftKey ? 'somar' : e.altKey ? 'tirar' : S.mode;
    if (e.button === 1 || t === 'mao' || e.button === 0 && this._space) { const v = S.view, x0 = v.x, y0 = v.y; dragPointer(e, (ev, dx, dy) => { v.x = x0 + dx; v.y = y0 + dy; this.draw(); }); return; }
    if (e.button !== 0) return;
    if (S.tf) return this.tfDown(e, p);
    if (t === 'mover') { S.mv = { x: 0, y: 0 }; dragPointer(e, ev => { const q = this.pt(ev); S.mv = { x: Math.round(q.x - p.x), y: Math.round(q.y - p.y) }; this.draw(); }, () => { const m = S.mv; S.mv = null; if (m.x || m.y) this.shiftLayer(m.x, m.y); else this.draw(); }); return; }
    const inside = p.x >= 0 && p.y >= 0 && p.x < S.W && p.y < S.H;
    if (t === 'varinha') { if (!inside) return; this.applySel(this.wand(p.x | 0, p.y | 0, S.tol, S.contig), mode); return; }
    if (t === 'balde') { if (!inside) return; const m = this.wand(p.x | 0, p.y | 0, S.tol, S.contig); if (S.sel.some(v => v)) for (let i = 0; i < m.length; i++) m[i] = Math.min(m[i], S.sel[i]); this.paintMask(m, S.color); this.commit(); return; }
    if (t === 'conta') { if (!inside) return; const q = S.g.getImageData(p.x | 0, p.y | 0, 1, 1).data; S.color = '#' + [q[0], q[1], q[2]].map(v => v.toString(16).padStart(2, '0')).join(''); this.opts(); return; }
    if (t === 'laco') { this._lasso = [p]; dragPointer(e, ev => { this._lasso.push(this.pt(ev)); this.draw(); }, () => { const L = this._lasso; this._lasso = null; if (L.length > 2) this.applySel(this.polyMask(L), mode); else this.draw(); }); return; }
    if (t === 'ret' || t === 'elipse') { this._box = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, el: t === 'elipse' }; dragPointer(e, ev => { const q = this.pt(ev); this._box.x1 = q.x; this._box.y1 = q.y; this.draw(); }, () => { const b = this._box; this._box = null; if (Math.abs(b.x1 - b.x0) > 2) this.applySel(this.shapeMask(b), mode); else this.draw(); }); return; }
    if (t === 'mascara' || t === 'pincel' || t === 'borracha') {
      const sub = t === 'mascara' && (e.altKey || S.mode === 'tirar'), g = S.g, selOnly = t !== 'mascara' && S.sel.some(v => v);
      const dab = (a, b) => {
        if (t === 'mascara') { this.stampSel(a, b, S.size / 2, sub ? 0 : 255); this._ov = null; }
        else { this.stroke(g, a, b, t === 'borracha', this._pr ?? 1); if (selOnly) this.clipToSel(); }
        this.draw();
      };
      if (selOnly) this._pre = S.g.getImageData(0, 0, S.W, S.H);
      const pr = ev => ev.pointerType === 'pen' ? 1 - S.sens / 100 + S.sens / 100 * clamp(ev.pressure || .5, .05, 1) : 1;
      this._pr = pr(e); this._carry = 0; let last = p; dab(p, p); dragPointer(e, ev => { this._pr = pr(ev); const q = this.pt(ev); dab(last, q); last = q; }, () => { this._pre = null; this.commit(); });
    }
  },
  // carimbos ao longo do traço: redondo, macio, lápis, marcador, spray, tinta (a pressão muda tamanho e força)
  dabCanvas(r, hard, kind) { const key = [r | 0, hard, kind].join(':'); this._dc ||= new Map(); let c = this._dc.get(key); if (c) return c; const s = Math.max(2, Math.ceil(r * 2) + 2); c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'), m = s / 2;
    if (kind === 'marcador') { g.fillStyle = '#000'; g.translate(m, m); g.rotate(-.6); g.fillRect(-r, -r * .35, r * 2, r * .7); }
    else if (kind.startsWith('spray')) { g.fillStyle = '#000'; for (let i = 0; i < Math.max(8, r * 1.5); i++) { const a = Math.random() * 7, d = Math.sqrt(Math.random()) * r; g.fillRect(m + Math.cos(a) * d, m + Math.sin(a) * d, 1.2, 1.2); } return c; }
    else if (kind === 'lapis') { g.fillStyle = '#000'; g.beginPath(); g.arc(m, m, r, 0, 7); g.fill(); }
    else { const gr = g.createRadialGradient(m, m, 0, m, m, r), h0 = kind === 'macio' ? 0 : hard / 100; gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(Math.min(.99, h0), 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
    this._dc.set(key, c); if (this._dc.size > 400) this._dc.clear(); return c; },
  stroke(g, a, b, erase, pr) {
    const S = this.st, kind = erase ? 'redondo' : S.brush, rr = Math.max(.5, S.size / 2 * (kind === 'tinta' ? pr : 1)), op = S.opa / 100 * (kind === 'tinta' ? 1 : pr), step = Math.max(.5, rr * 2 * S.spacing / 100), L = Math.hypot(b.x - a.x, b.y - a.y);
    const tint = this._tint ||= document.createElement('canvas'), tg = tint.getContext('2d'), mk = dc => { if (tint.width !== dc.width) tint.width = tint.height = dc.width; tg.globalCompositeOperation = 'copy'; tg.drawImage(dc, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = S.color; tg.fillRect(0, 0, tint.width, tint.height); };
    mk(this.dabCanvas(rr, S.hard, kind));
    g.save(); g.globalCompositeOperation = erase ? 'destination-out' : 'source-over'; g.globalAlpha = op; let d = this._carry || 0;
    for (; d <= L; d += step) { const x = a.x + (b.x - a.x) * (L ? d / L : 0), y = a.y + (b.y - a.y) * (L ? d / L : 0); if (kind === 'spray') mk(this.dabCanvas(rr, S.hard, 'spray' + (Math.random() * 8 | 0))); g.drawImage(tint, x - tint.width / 2, y - tint.height / 2); if (!L) break; }
    this._carry = L ? d - L : 0; g.restore();
  },
  // pincel/borracha só dentro da seleção
  clipToSel() { const S = this.st, pre = this._pre; if (!pre) return; const cur = S.g.getImageData(0, 0, S.W, S.H), a = cur.data, b = pre.data, s = S.sel; for (let i = 0; i < s.length; i++) { const k = s[i] / 255; if (k >= 1) continue; const q = i * 4; for (let c = 0; c < 4; c++) a[q + c] = b[q + c] + (a[q + c] - b[q + c]) * k; } S.g.putImageData(cur, 0, 0); },
  stampSel(a, b, r, v) { const S = this.st, W = S.W, H = S.H, n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (r / 3))); for (let k = 0; k <= n; k++) { const cx = a.x + (b.x - a.x) * k / n, cy = a.y + (b.y - a.y) * k / n; for (let y = Math.max(0, cy - r | 0); y <= Math.min(H - 1, cy + r); y++) for (let x = Math.max(0, cx - r | 0); x <= Math.min(W - 1, cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) S.sel[y * W + x] = v; } },

  /* ---------- máscaras ---------- */
  applySel(m, mode) { const S = this.st, s = S.sel; if (mode === 'novo') S.sel = m; else if (mode === 'somar') for (let i = 0; i < s.length; i++) s[i] = Math.max(s[i], m[i]); else for (let i = 0; i < s.length; i++) s[i] = Math.min(s[i], 255 - m[i]); this.commit(); },
  setSel(m) { this.st.sel = m; this.commit(); },
  selAll() { this.st.sel = new Uint8Array(this.st.W * this.st.H).fill(255); this.commit(); },
  selNone() { this.st.sel = new Uint8Array(this.st.W * this.st.H); this.commit(); },
  data() { const S = this.st; return S.g.getImageData(0, 0, S.W, S.H).data; },
  wand(x, y, tol, contig) {
    const S = this.st, W = S.W, H = S.H, d = this.data(), i0 = (y * W + x) * 4, c0 = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]], m = new Uint8Array(W * H);
    const near = i => { const q = i * 4; if (c0[3] < 30) return d[q + 3] < 30 + tol; return d[q + 3] > 20 && Math.abs(d[q] - c0[0]) + Math.abs(d[q + 1] - c0[1]) + Math.abs(d[q + 2] - c0[2]) + Math.abs(d[q + 3] - c0[3]) * .5 <= tol * 3; };
    if (!contig) { for (let i = 0; i < W * H; i++) if (near(i)) m[i] = 255; return m; }
    const st = [y * W + x]; m[y * W + x] = 255;
    while (st.length) { const i = st.pop(), xx = i % W; for (const j of [xx > 0 ? i - 1 : -1, xx < W - 1 ? i + 1 : -1, i - W, i + W]) { if (j < 0 || j >= W * H || m[j]) continue; if (near(j)) { m[j] = 255; st.push(j); } } }
    return m;
  },
  polyMask(L) { const S = this.st, c = document.createElement('canvas'); c.width = S.W; c.height = S.H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); L.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.fill(); return this.fromCanvas(c); },
  shapeMask(b) { const S = this.st, c = document.createElement('canvas'); c.width = S.W; c.height = S.H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); if (b.el) g.ellipse((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, Math.abs(b.x1 - b.x0) / 2, Math.abs(b.y1 - b.y0) / 2, 0, 0, 7); else g.rect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0)); g.fill(); return this.fromCanvas(c); },
  fromCanvas(c) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, m = new Uint8Array(c.width * c.height); for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3]; return m; },
  grow(r) { const S = this.st, W = S.W, H = S.H; for (let k = 0; k < r; k++) { const s = S.sel, n = s.slice(); for (let i = 0; i < W * H; i++) if (s[i]) { const x = i % W; if (x) n[i - 1] = Math.max(n[i - 1], s[i]); if (x < W - 1) n[i + 1] = Math.max(n[i + 1], s[i]); if (i >= W) n[i - W] = Math.max(n[i - W], s[i]); if (i < W * H - W) n[i + W] = Math.max(n[i + W], s[i]); } S.sel = n; } },
  paintMask(m, col) { const S = this.st, im = S.g.getImageData(0, 0, S.W, S.H), d = im.data, [r, g, b] = hexToRgb(col); for (let i = 0; i < m.length; i++) { const k = m[i] / 255; if (!k) continue; const q = i * 4; d[q] += (r - d[q]) * k; d[q + 1] += (g - d[q + 1]) * k; d[q + 2] += (b - d[q + 2]) * k; d[q + 3] += (255 - d[q + 3]) * k; } S.g.putImageData(im, 0, 0); },
  fillSel(col) { this.paintMask(this.st.sel, col); this.commit(); },
  eraseSel() { const S = this.st; if (!S.sel.some(v => v)) return; const im = S.g.getImageData(0, 0, S.W, S.H), d = im.data; for (let i = 0; i < S.sel.length; i++) if (S.sel[i]) d[i * 4 + 3] *= 1 - S.sel[i] / 255; S.g.putImageData(im, 0, 0); this.commit(); },

  /* ---------- automático: rosto, boca, olhos ---------- */
  // componentes conectados (4 vizinhos) de uma máscara booleana
  comps(m, W, H) { const lab = new Int32Array(W * H), out = []; let n = 0; const st = [];
    for (let i = 0; i < W * H; i++) { if (!m[i] || lab[i]) continue; n++; let a = 0, x0 = W, y0 = H, x1 = 0, y1 = 0; st.push(i); lab[i] = n;
      while (st.length) { const q = st.pop(), x = q % W, y = (q / W) | 0; a++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; for (const r of [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, q - W, q + W]) if (r >= 0 && r < W * H && m[r] && !lab[r]) { lab[r] = n; st.push(r); } }
      out.push({ id: n, a, x0, y0, x1, y1 }); }
    return { lab, out }; },
  fillHoles(m, W, H) { const out = new Uint8Array(W * H), seen = new Uint8Array(W * H), st = []; for (let x = 0; x < W; x++) { st.push(x, (H - 1) * W + x); } for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
    while (st.length) { const i = st.pop(); if (seen[i] || m[i]) continue; seen[i] = 1; const x = i % W; if (x > 0) st.push(i - 1); if (x < W - 1) st.push(i + 1); if (i >= W) st.push(i - W); if (i < W * H - W) st.push(i + W); }
    for (let i = 0; i < W * H; i++) out[i] = seen[i] ? 0 : 255; return out; },
  // rosto = maior área clara (máscara branca ou pele) na metade de cima, com os buracos (olhos/boca) preenchidos
  faceMask() {
    const S = this.st, W = S.W, H = S.H, d = this.data(), light = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { const q = i * 4; if (d[q + 3] < 200) continue; const r = d[q], g = d[q + 1], b = d[q + 2], mn = Math.min(r, g, b), mx = Math.max(r, g, b); if ((mn > 205) || (r > 190 && g > 140 && b > 110 && r > b + 25 && mx - mn < 110)) light[i] = 1; }
    const { lab, out } = this.comps(light, W, H); let best = null, bs = 0;
    for (const c of out) { if (c.a < W * H * .01) continue; const cy = (c.y0 + c.y1) / 2 / H, s = c.a * (cy < .6 ? 1 : .3); if (s > bs) { bs = s; best = c; } }
    if (!best) return null; const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) if (lab[i] === best.id) m[i] = 1;
    const f = this.fillHoles(m, W, H); this._face = { m: f, box: best, col: this.median(d, m) }; return f;
  },
  median(d, m) { const r = [], g = [], b = []; for (let i = 0; i < m.length; i += 7) if (m[i]) { r.push(d[i * 4]); g.push(d[i * 4 + 1]); b.push(d[i * 4 + 2]); } const md = a => a.sort((x, y) => x - y)[a.length >> 1] || 255; return '#' + [md(r), md(g), md(b)].map(v => v.toString(16).padStart(2, '0')).join(''); },
  erode(m, W, H, r) { let s = m; for (let k = 0; k < r; k++) { const n = s.slice(); for (let i = 0; i < W * H; i++) if (s[i]) { const x = i % W; if (!x || x === W - 1 || i < W || i >= W * H - W || !s[i - 1] || !s[i + 1] || !s[i - W] || !s[i + W]) n[i] = 0; } s = n; } return s; },
  // partes dentro do rosto: tudo que não é a cor do rosto
  partMask(kind) {
    const S = this.st, W = S.W, H = S.H; const f = this.faceMask(); if (!f) return null; const F = this._face, d = this.data(), [fr, fg, fb] = hexToRgb(F.col);
    const inner = this.erode(f, W, H, Math.max(3, Math.round(Math.min(W, H) * .008))), feat = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (inner[i]) { const q = i * 4; if (Math.abs(d[q] - fr) + Math.abs(d[q + 1] - fg) + Math.abs(d[q + 2] - fb) > 90) feat[i] = 1; }
    const { lab, out } = this.comps(feat, W, H), b = F.box, fy = y => (y - b.y0) / Math.max(1, b.y1 - b.y0);
    const big = out.filter(c => c.a > W * H * .0004);
    let pick = [];
    if (kind === 'boca') { const cand = big.filter(c => fy((c.y0 + c.y1) / 2) > .45).sort((a, c) => c.a - a.a); if (cand[0]) pick = [cand[0]]; }
    else { const cand = big.filter(c => fy((c.y0 + c.y1) / 2) < .62 && fy((c.y0 + c.y1) / 2) > .12).sort((a, c) => c.a - a.a); pick = cand.slice(0, 2); }
    if (!pick.length) return null; const ids = new Set(pick.map(c => c.id)), m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) if (ids.has(lab[i])) m[i] = 255;
    const sv = S.sel; S.sel = m; this.grow(3); const r = S.sel; S.sel = sv; return r;
  },
  // deixa o rosto liso: pinta tudo dentro do rosto (menos a borda) com a cor do rosto
  cleanFace(ask = false) {
    const S = this.st, W = S.W, H = S.H, f = this.faceMask(); if (!f) return UI.toast('Não achei um rosto claro — selecione o rosto com a varinha e use "Pintar com a cor".', { kind: 'warn', time: 4000 });
    const inner = this.erode(f, W, H, Math.max(4, Math.round(Math.min(W, H) * .01))); const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) if (inner[i]) m[i] = 255;
    this.paintMask(m, this._face.col); S.sel = new Uint8Array(W * H); this.commit(); UI.toast('Rosto limpo (Ctrl+Z desfaz)', { kind: 'ok', time: 1800 });
  },
  removeBg() { const S = this.st, W = S.W, H = S.H, d = this.data(); let best = null; for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) { const q = (y * W + x) * 4; if (d[q + 3] > 200) { best = [x, y]; break; } } if (!best) return UI.toast('O fundo já é transparente', { time: 1500 }); const m = this.wand(best[0], best[1], 24, true); S.sel = m; this.eraseSel(); },
  // recorte da seleção → imagem nova (cortada) + posição
  cut(m) { const S = this.st, W = S.W, H = S.H; let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let i = 0; i < W * H; i++) if (m[i]) { const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } if (x1 < 0) return null;
    const w = x1 - x0 + 1, hh = y1 - y0 + 1, c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d'), src = S.g.getImageData(x0, y0, w, hh), dd = src.data;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y0 + y) * W + x0 + x, q = (y * w + x) * 4; dd[q + 3] = dd[q + 3] * m[i] / 255; } g.putImageData(src, 0, 0); return { c, x: x0, y: y0, w, h: hh }; },
  async toAsset(cut, name, folder) {
    const blob = await new Promise(r => cut.c.toBlob(r, 'image/png')), P = App.project, rt = await Assets.addBlob(blob, name + '.png', P?.id || Studio?.P?.id, 'image');
    if (P) { P.bin ||= []; P.bin.push(rt.meta.id); if (folder) { P.folders ||= []; P.assetFolders ||= {}; let f = P.folders.find(x => x.name === folder); if (!f) { f = { id: uid('f_'), name: folder }; P.folders.push(f); } P.assetFolders[rt.meta.id] = f.id; } }
    return rt.meta.id;
  },
  async copySel() { const S = this.st, c = this.cut(S.sel); if (!c) return; const nm = await UI.prompt({ title: 'Virar desenho novo', label: 'Nome (vai para a pasta "Recortes")', value: 'recorte' }); if (!nm) return; const id = await this.toAsset(c, nm, 'Recortes'); S.o.onSeparate?.([{ kind: 'recorte', asset: id, name: nm, x: c.x, y: c.y, w: c.w, h: c.h, W: S.W, H: S.H }]); App.project && LibUI.render?.(); UI.toast(`"${esc(nm)}" salvo na pasta Recortes`, { kind: 'ok' }); },
  async splitParts() {
    const S = this.st, base = (S.o.name || 'personagem').replace(/\.png$/i, ''), parts = [];
    for (const [k, folder] of [['boca', 'Bocas'], ['olhos', 'Olhos']]) { const m = this.partMask(k); if (!m) continue; const c = this.cut(m); if (!c) continue; const id = await this.toAsset(c, `${base} — ${k}`, folder); parts.push({ kind: k, asset: id, name: `${base} — ${k}`, x: c.x, y: c.y, w: c.w, h: c.h, W: S.W, H: S.H }); }
    if (!parts.length) return UI.toast('Não achei boca nem olhos', { kind: 'warn' });
    App.project && LibUI.render?.();
    const clean = await UI.confirm({ title: 'Separado!', msg: `Salvei ${parts.map(p => '<b>' + p.kind + '</b>').join(' e ')} nas pastas <b>Bocas</b>/<b>Olhos</b>. Quer deixar o rosto desta imagem liso (sem olhos e boca), para usar como base?`, ok: 'Limpar o rosto', cancel: 'Deixar como está' });
    if (clean) this.cleanFace(); S.o.onSeparate?.(parts);
  },

  CORES: ['#ff4d6a', '#3d8bff', '#2fcf7a', '#ffb020', '#b36bff', '#19d3f0', '#ff7ad9', '#a8e07a', '#ff9f6b', '#7aa8ff'],
  addPart(name, mask) { this.setCur(0, true); this.selToLayer(false, name, mask); },
  partsOverlay() {
    if (this._pov) return this._pov; const S = this.st, W = S.W, H = S.H, o = document.createElement('canvas'); o.width = W; o.height = H; if (!S.parts.length) return (this._pov = o);
    const g = o.getContext('2d'), im = g.createImageData(W, H), d = im.data; S.parts.forEach((p, k) => { if (k === S.curPart) return; const [r, gg, b] = hexToRgb(p.cor); for (let i = 0; i < W * H; i++) if (p.mask[i] > 127) { const q = i * 4; d[q] = r; d[q + 1] = gg; d[q + 2] = b; d[q + 3] = 70; } });
    g.putImageData(im, 0, 0); return (this._pov = o);
  },
  async exportParts() {
    const S = this.st, base = (S.o.name || 'personagem').replace(/\.png$/i, ''), out = [];
    for (const p of S.parts) { const c = this.cut(p.mask); if (!c) continue; const id = await this.toAsset(c, `${base} — ${p.name}`, 'Partes — ' + base); out.push({ kind: /boca/i.test(p.name) ? 'boca' : /olho/i.test(p.name) ? 'olhos' : 'parte', asset: id, name: p.name, x: c.x, y: c.y, w: c.w, h: c.h, W: S.W, H: S.H }); }
    App.project && LibUI.render?.(); UI.toast(`${out.length} parte(s) salvas na pasta "Partes — ${esc(base)}"`, { kind: 'ok', time: 3000 }); S.o.onSeparate?.(out);
  },
  // IA separa o personagem inteiro em partes (com barra de % e tempo que falta); depois você retoca
  async aiParts() {
    const S = this.st, k = Math.min(1, 900 / Math.max(S.W, S.H)), c = document.createElement('canvas'); c.width = Math.round(S.W * k); c.height = Math.round(S.H * k); const g = c.getContext('2d'); g.fillStyle = '#7f8f9f'; g.fillRect(0, 0, c.width, c.height); g.drawImage(S.cv, 0, 0, c.width, c.height);
    const b = UI.busy('🤖 A IA está separando as partes', `<div class="ie-prog"><div class="ie-bar"><i style="width:2%"></i></div><p class="ie-pt">Olhando a imagem… <b>0%</b></p><button class="btn sm" data-stop>Parar</button></div>`);
    const t0 = performance.now(), EXP = 5200; let got = 0;
    const upd = (p, msg) => { const el = b.body; if (!el) return; const pct = Math.max(2, Math.min(99, Math.round(p * 100))), el2 = (performance.now() - t0) / 1000, rest = p > .04 ? Math.max(1, Math.round(el2 * (1 - p) / p)) : null; $('.ie-bar i', el).style.width = pct + '%'; $('.ie-pt', el).innerHTML = `${msg} <b>${pct}%</b>${rest ? ` · falta uns <b>${rest} s</b>` : ''}`; };
    const tick = setInterval(() => upd(Math.min(.95, Math.max(got / EXP, (performance.now() - t0) / 60000)), got ? 'Desenhando os contornos…' : 'Olhando a imagem…'), 400);
    setTimeout(() => { const s = b.body && $('[data-stop]', b.body); if (s) s.onclick = () => { try { AIClient.ctrl?.abort('parou'); } catch { } }; }, 60);
    try {
      const j = await AIClient.call([{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: c.toDataURL('image/jpeg', .85).split(',')[1] } }, { type: 'text', text: 'Separe este personagem de desenho em PARTES para animar com ossos (estilo Toon Boom): cabelo (frente e trás se der), rosto, orelhas, olhos, boca, pescoço, tronco/roupa, braço e antebraço de cada lado, mãos, pernas, pés, acessórios e efeitos (!, ?, gotas). Só as partes que aparecem. Responda SÓ um JSON: {"partes":[{"nome":"cabelo","poligono":[[x,y],...]}]} com 12 a 40 pontos por polígono, bem justo no contorno, em PORCENTAGEM da imagem (0–100).' }] }], 'Você recorta personagens de desenho em partes para rig. Responda só JSON.', txt => { got = (txt || '').length || got + 40; });
      clearInterval(tick); upd(.99, 'Montando as seleções…');
      const t = (j.content || []).map(x => x.text || '').join(''), mm = t.match(/\{[\s\S]*\}/); if (!mm) throw new Error('a IA não respondeu as partes');
      const o = JSON.parse(mm[0]), d = this.data(); let n = 0;
      for (const p of o.partes || []) { const cv2 = document.createElement('canvas'); cv2.width = S.W; cv2.height = S.H; const g2 = cv2.getContext('2d'); g2.fillStyle = '#fff'; g2.beginPath(); (p.poligono || []).forEach(([x, y], i) => i ? g2.lineTo(x / 100 * S.W, y / 100 * S.H) : g2.moveTo(x / 100 * S.W, y / 100 * S.H)); g2.closePath(); g2.fill(); const m = this.fromCanvas(cv2); for (let i = 0; i < m.length; i++) if (d[i * 4 + 3] < 20) m[i] = 0; if (m.some(v => v)) { this.addPart(p.nome || 'parte', m); n++; } }
      b.close(); if (!n) throw new Error('a IA não achou partes');
      this.setCur(0); this.side(); UI.toast(`A IA separou ${n} camada(s). Clique numa camada para retocar (borracha, varinha, Ctrl+T) e depois "Usar as camadas no personagem".`, { time: 6000 });
    } catch (e) { clearInterval(tick); b.close(); UI.toast('IA: ' + esc(e.message || e), { kind: 'err', time: 4000 }); }
  },
  /* ---------- camadas ---------- */
  mkLayer(name, W, H, src) { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true }); if (src) g.drawImage(src, 0, 0); return { id: uid('l_'), name, vis: true, kind: '', cv, g, dirty: true }; },
  setCur(i, quiet) { const S = this.st; S.cur = clamp(i, 0, S.layers.length - 1); S.cv = S.layers[S.cur].cv; S.g = S.layers[S.cur].g; if (!quiet) { this.layersUI(); this.draw(); } },
  flat() { const S = this.st, c = document.createElement('canvas'); c.width = S.W; c.height = S.H; const g = c.getContext('2d'); for (const L of S.layers) if (L.vis) g.drawImage(L.cv, 0, 0); return c; },
  newLayer(name, at) { const S = this.st, L = this.mkLayer(name || 'Camada ' + S.layers.length, S.W, S.H); S.layers.splice(at ?? S.cur + 1, 0, L); this.setCur(S.layers.indexOf(L), true); this.commit(); return L; },
  selToLayer(cut, name, mask) {
    const S = this.st, m = mask || S.sel; if (!m.some(v => v)) { const L = this.mkLayer((S.layers[S.cur].name) + ' cópia', S.W, S.H, S.cv); S.layers.splice(S.cur + 1, 0, L); this.setCur(S.cur + 1, true); this.commit(); return; }
    const src = S.layers[S.cur], im = src.g.getImageData(0, 0, S.W, S.H), d = im.data, L = this.mkLayer(name || (cut ? 'Recorte ' : 'Camada ') + S.layers.length, S.W, S.H), o = L.g.createImageData(S.W, S.H), od = o.data;
    for (let i = 0; i < m.length; i++) { if (!m[i]) continue; const q = i * 4, k = m[i] / 255; od[q] = d[q]; od[q + 1] = d[q + 1]; od[q + 2] = d[q + 2]; od[q + 3] = d[q + 3] * k; if (cut) d[q + 3] *= 1 - k; }
    L.g.putImageData(o, 0, 0); if (cut) { src.g.putImageData(im, 0, 0); src.dirty = true; }
    S.layers.splice(S.cur + 1, 0, L); this.setCur(S.cur + 1, true); if (!mask) S.sel = new Uint8Array(S.W * S.H); this.commit(); return L;
  },
  shiftLayer(dx, dy) { const S = this.st, L = S.layers[S.cur], c = document.createElement('canvas'); c.width = S.W; c.height = S.H; c.getContext('2d').drawImage(L.cv, 0, 0); L.g.clearRect(0, 0, S.W, S.H); L.g.drawImage(c, dx, dy); this.commit(); },
  layersUI() {
    const S = this.st, el = this.root && $('.ie-layers', this.root); if (!el) return; el.innerHTML = '';
    const KIND = { '': '', reacao: '😀', peca: '🦴', base: '🧍', nao: '🚫' };
    [...S.layers].map((L, i) => [L, i]).reverse().forEach(([L, i]) => {
      const r = h(`<div class="ie-ly ${i === S.cur ? 'on' : ''}"><button class="ibtn" data-v title="Mostrar/esconder">${L.vis ? '👁' : '🙈'}</button><canvas width="40" height="40"></canvas><input value="${esc(L.name)}"><button class="ie-k" data-k title="O que esta camada vai ser no personagem (clique para trocar): ${({ '': 'ainda não definido', reacao: 'Reação/rosto', peca: 'Peça do corpo', base: 'Base', nao: 'Não usar' })[L.kind || '']}">${KIND[L.kind || ''] || '❔'}</button><button class="ibtn" data-u title="Subir">▲</button><button class="ibtn" data-d title="Descer">▼</button><button class="ibtn" data-x title="Apagar camada">✕</button></div>`);
      const t = $('canvas', r).getContext('2d'), k = Math.min(40 / S.W, 40 / S.H); t.drawImage(L.cv, (40 - S.W * k) / 2, (40 - S.H * k) / 2, S.W * k, S.H * k);
      r.onclick = e => { if (e.target.closest('button,input')) return; this.setCur(i); };
      r.oncontextmenu = e => { e.preventDefault(); this.setCur(i); const K = k => () => { L.kind = k; this.layersUI(); };
        UI.ctx(e.clientX, e.clientY, [{ head: 'Camada: ' + L.name }, { label: '🧍 Definir como Base (corpo de fundo)', action: K('base') }, { label: '😀 Definir como Reação/rosto', action: K('reacao') }, { label: '🦴 Definir como Peça do corpo (osso)', action: K('peca') }, { label: '🚫 Não usar no personagem', action: K('nao') }, '-',
          { label: '🦴 Adicionar na hierarquia (montar personagem)…', action: () => this.useLayers() }, '-',
          { label: '📄 Duplicar camada', action: () => { const D = this.mkLayer(L.name + ' cópia', S.W, S.H, L.cv); D.kind = L.kind; S.layers.splice(i + 1, 0, D); this.setCur(i + 1, true); this.commit(); } },
          { label: '⬇️ Juntar com a de baixo (Ctrl+E)', disabled: i < 1, action: () => this.mergeDown() }, { label: '🔄 Transformar (Ctrl+T)', action: () => this.startTf() },
          { label: '✕ Apagar camada', disabled: S.layers.length < 2, action: () => { S.layers.splice(i, 1); this.setCur(Math.min(S.cur, S.layers.length - 1), true); this.commit(); } }]); };
      $('input', r).onfocus = () => { if (S.cur !== i) this.setCur(i); }; $('input', r).onchange = e => { L.name = e.target.value; };
      $('[data-k]', r).onclick = () => { const o = ['', 'base', 'reacao', 'peca', 'nao']; L.kind = o[(o.indexOf(L.kind || '') + 1) % o.length]; this.layersUI(); };
      $('[data-v]', r).onclick = () => { L.vis = !L.vis; this.layersUI(); this.draw(); };
      $('[data-u]', r).onclick = () => { if (i >= S.layers.length - 1) return; S.layers.splice(i, 1); S.layers.splice(i + 1, 0, L); this.setCur(i + 1, true); this.commit(); };
      $('[data-d]', r).onclick = () => { if (i <= 0) return; S.layers.splice(i, 1); S.layers.splice(i - 1, 0, L); this.setCur(i - 1, true); this.commit(); };
      $('[data-x]', r).onclick = () => { if (S.layers.length < 2) return UI.toast('Precisa de pelo menos uma camada', { kind: 'warn' }); S.layers.splice(i, 1); this.setCur(Math.min(S.cur, S.layers.length - 1), true); this.commit(); };
      el.appendChild(r);
    });
  },
  mergeDown() { const S = this.st; if (S.cur < 1) return; const a = S.layers[S.cur], b = S.layers[S.cur - 1]; b.g.drawImage(a.cv, 0, 0); b.dirty = true; S.layers.splice(S.cur, 1); this.setCur(S.cur - 1, true); this.commit(); },
  /* ---------- Ctrl+T: transformação livre (mover, girar, tamanho) ---------- */
  bbox(L) { const S = this.st, d = L.g.getImageData(0, 0, S.W, S.H).data; let x0 = S.W, y0 = S.H, x1 = -1, y1 = -1; for (let i = 0; i < S.W * S.H; i++) if (d[i * 4 + 3] > 8) { const x = i % S.W, y = (i / S.W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 }; },
  startTf() { const S = this.st, b = this.bbox(S.layers[S.cur]); if (!b) return UI.toast('Camada vazia', { kind: 'warn' }); S.tf = { b, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, x: 0, y: 0, s: 1, r: 0 }; this.hint('🔄 <b>Transformar</b>: arraste dentro = mover · cantos = tamanho · fora = girar (Shift = de 15°) · <b>Enter</b> aplica · <b>Esc</b> cancela'); this.draw(); },
  cancelTf() { this.st.tf = null; this.hint(''); this.draw(); },
  applyTf() { const S = this.st, t = S.tf; if (!t) return; S.tf = null; const L = S.layers[S.cur], c = document.createElement('canvas'); c.width = S.W; c.height = S.H; c.getContext('2d').drawImage(L.cv, 0, 0); L.g.clearRect(0, 0, S.W, S.H); L.g.save(); L.g.translate(t.cx + t.x, t.cy + t.y); L.g.rotate(t.r * Math.PI / 180); L.g.scale(t.s, t.s); L.g.translate(-t.cx, -t.cy); L.g.drawImage(c, 0, 0); L.g.restore(); this.hint(''); this.commit(); },
  tfCorners() { const t = this.st.tf, b = t.b, a = t.r * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a); return [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(([x, y]) => { const dx = (x - t.cx) * t.s, dy = (y - t.cy) * t.s; return { x: t.cx + t.x + dx * cs - dy * sn, y: t.cy + t.y + dx * sn + dy * cs }; }); },
  drawTf(g, v) { const P4 = this.tfCorners(); g.strokeStyle = '#fff'; g.lineWidth = 1.5 / v.z; g.setLineDash([]); g.beginPath(); P4.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.stroke(); g.fillStyle = '#fff'; g.strokeStyle = '#3d8bff'; for (const p of P4) { g.beginPath(); g.rect(p.x - 5 / v.z, p.y - 5 / v.z, 10 / v.z, 10 / v.z); g.fill(); g.stroke(); } },
  tfDown(e, p) {
    const S = this.st, t = S.tf, t0 = { ...t }, P4 = this.tfCorners(), z = S.view.z, ctr = { x: t.cx + t.x, y: t.cy + t.y };
    const onCorner = P4.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 10 / z);
    const inside = (() => { let c = false; for (let i = 0, j = 3; i < 4; j = i++) { const a = P4[i], b = P4[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; })();
    const mode = onCorner ? 'scale' : inside ? 'move' : 'rotate', d0 = Math.hypot(p.x - ctr.x, p.y - ctr.y), a0 = Math.atan2(p.y - ctr.y, p.x - ctr.x);
    dragPointer(e, ev => { const q = this.pt(ev);
      if (mode === 'move') { t.x = t0.x + q.x - p.x; t.y = t0.y + q.y - p.y; }
      else if (mode === 'scale') t.s = clamp(t0.s * Math.hypot(q.x - ctr.x, q.y - ctr.y) / Math.max(1, d0), .05, 20);
      else { let r = t0.r + (Math.atan2(q.y - ctr.y, q.x - ctr.x) - a0) * 180 / Math.PI; if (ev.shiftKey) r = Math.round(r / 15) * 15; t.r = r; }
      this.draw(); });
  },
  /* ---------- atalhos (iguais aos do Photoshop) ---------- */
  key(e) {
    if (e.target.closest('input,textarea,select') || $('#modal-root').children.length) return; const S = this.st; if (!S) return;
    const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey, stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (S.tf) { if (k === 'enter') { stop(); return this.applyTf(); } if (k === 'escape') { stop(); return this.cancelTf(); } }
    if (e.code === 'Space') { this._space = true; stop(); return; }
    if (c && k === 'z') { stop(); return e.shiftKey ? this.redoA() : this.undo(); }
    if (c && k === 'y') { stop(); return this.redoA(); }
    if (c && k === 'a') { stop(); return this.selAll(); }
    if (c && k === 'd') { stop(); return this.selNone(); }
    if (c && e.shiftKey && k === 'i') { stop(); S.sel = S.sel.map(v => 255 - v); return this.commit(); }
    if (c && k === 't') { stop(); return this.startTf(); }
    if (c && k === 'j') { stop(); return this.selToLayer(e.shiftKey); }
    if (c && k === 'e') { stop(); return this.mergeDown(); }
    if (c && e.shiftKey && k === 'n') { stop(); return this.newLayer(); }
    if (c && k === '0') { stop(); return this.fit(); }
    if (c && k === 's') { stop(); return this.save(); }
    if (c) return;
    if (k === 'delete' || k === 'backspace') { stop(); return this.eraseSel(); }
    if (k === 'escape') { stop(); return S.sel.some(v => v) ? this.selNone() : this.close(); }
    if (k === '[' || k === ']') { stop(); S.size = clamp(S.size + (k === ']' ? 4 : -4), 1, 300); this.opts(); return this.draw(); }
    if (k.startsWith('arrow') && S.tool === 'mover') { stop(); const n = e.shiftKey ? 10 : 1; return this.shiftLayer(k === 'arrowleft' ? -n : k === 'arrowright' ? n : 0, k === 'arrowup' ? -n : k === 'arrowdown' ? n : 0); }
    const map = { v: 'mover', w: 'varinha', l: 'laco', m: 'ret', b: 'pincel', e: 'borracha', g: 'balde', i: 'conta', h: 'mao', q: 'mascara' };
    if (map[k]) { stop(); S.tool = map[k]; this.tools(); this.opts(); }
  },
  /* ---------- camadas → personagem (reação/rosto ou peça do corpo) ---------- */
  async useLayers() {
    const S = this.st; if (S.tf) this.applyTf();
    const guess = (L, i) => L.kind || (i === 0 ? 'base' : /boca|olho|rosto|express|rea[cç]/i.test(L.name) ? 'reacao' : 'peca');
    const body = h(`<div class="ie-use"><p>Diga o que cada camada é. <b>Reação/rosto</b> = troca de desenho (bocas, olhos, expressões). <b>Peça do corpo</b> = osso separado que se mexe (braço, cabelo, cabeça…). <b>Base</b> = o corpo de fundo.</p>
      ${S.layers.map((L, i) => `<div class="ie-ur"><canvas width="44" height="44"></canvas><b>${esc(L.name)}</b><div class="ie-seg">${[['base', '🧍 Base'], ['reacao', '😀 Reação/rosto'], ['peca', '🦴 Peça do corpo'], ['nao', '🚫 Não usar']].map(([v, l]) => `<button data-i="${i}" data-k="${v}" class="${guess(L, i) === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`).join('')}</div>`);
    S.layers.forEach((L, i) => { const t = $$('canvas', body)[i].getContext('2d'), k = Math.min(44 / S.W, 44 / S.H); t.drawImage(L.cv, (44 - S.W * k) / 2, (44 - S.H * k) / 2, S.W * k, S.H * k); L.kind = guess(L, i); });
    $$('[data-k]', body).forEach(b => b.onclick = () => { const L = S.layers[+b.dataset.i]; L.kind = b.dataset.k; $$(`[data-i="${b.dataset.i}"]`, body).forEach(x => x.classList.toggle('on', x === b)); });
    const ok = await UI.modal({ title: '🦴 Usar as camadas no personagem', icon: 'layers', width: 640, body, buttons: [{ label: 'Cancelar', value: false }, { label: '📚 Tudo junto (em camadas)', value: 'junto' }, { label: '🦴 Separar em partes (ossos)', kind: 'primary', value: 'separar' }] }); if (!ok) return;
    const base = (S.o.name || 'personagem').replace(/\.png$/i, ''), items = [];
    for (const L of S.layers) { if (L.kind === 'nao') continue; const m = new Uint8Array(S.W * S.H), d = L.g.getImageData(0, 0, S.W, S.H).data; for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] ? 255 : 0; const keep = S.cv; S.cv = L.cv; S.g = L.g; const c = this.cut(m); S.cv = keep; S.g = S.layers[S.cur].g; if (!c) continue; const id = await this.toAsset(c, `${base} — ${L.name}`, (L.kind === 'reacao' ? 'Reações — ' : L.kind === 'peca' ? 'Peças — ' : 'Base — ') + base); items.push({ junto: ok === 'junto', kind: L.kind, asset: id, name: L.name, x: c.x, y: c.y, w: c.w, h: c.h, W: S.W, H: S.H }); }
    App.project && LibUI.render?.();
    let flatId = null; if (S.o.blank) { const fb = await new Promise(r => this.flat().toBlob(r, 'image/png')), rt = await Assets.addBlob(fb, base + '.png', App.project?.id, 'image'); flatId = rt.meta.id; App.project?.bin?.push(flatId); }
    const cb = S.o.onLayers; if (cb) { this.close(); await cb(items, flatId); } else UI.toast(`${items.length} camada(s) salvas nas pastas (Reações, Peças, Base)`, { kind: 'ok', time: 3500 });
  },
  /* ---------- IA ---------- */
  async ai(what, free) {
    const S = this.st; if (!(typeof AIClient !== 'undefined' && AIClient.ready)) return UI.toast('A IA não está ligada', { kind: 'warn' });
    if (what === 'partes') return this.aiParts();
    const ask = { rosto: 'o rosto inteiro (máscara/pele do rosto, sem cabelo)', boca: 'a boca', olhos: 'os dois olhos (com sobrancelhas, se encostadas)', limpar: 'tudo que está DENTRO do rosto e não é a pele lisa (olhos, boca, sobrancelhas, marcas, lágrimas, suor)', livre: free }[what];
    if (!ask) return UI.toast('Escreva o que a IA deve selecionar', { kind: 'warn' });
    const k = Math.min(1, 900 / Math.max(S.W, S.H)), c = document.createElement('canvas'); c.width = Math.round(S.W * k); c.height = Math.round(S.H * k); const g = c.getContext('2d'); g.fillStyle = '#7f8f9f'; g.fillRect(0, 0, c.width, c.height); g.drawImage(S.cv, 0, 0, c.width, c.height);
    const b = UI.busy('A IA está olhando a imagem…', '<div class="spinner"></div>');
    try {
      const j = await AIClient.call([{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: c.toDataURL('image/jpeg', .85).split(',')[1] } }, { type: 'text', text: `Selecione ${ask}. Responda SÓ um JSON: {"poligonos":[[[x,y],[x,y],...]], "explica":"curto"} com 1 ou mais polígonos (8 a 40 pontos cada) contornando bem justo o que foi pedido, em PORCENTAGEM da imagem (0–100).` }] }], 'Você é um assistente de recorte de imagens de desenho animado. Responda só JSON.');
      const t = (j.content || []).map(x => x.text || '').join(''), mm = t.match(/\{[\s\S]*\}/); if (!mm) throw new Error('a IA não respondeu um recorte');
      const o = JSON.parse(mm[0]), cv2 = document.createElement('canvas'); cv2.width = S.W; cv2.height = S.H; const g2 = cv2.getContext('2d'); g2.fillStyle = '#fff';
      for (const pl of o.poligonos || []) { g2.beginPath(); pl.forEach(([x, y], i) => i ? g2.lineTo(x / 100 * S.W, y / 100 * S.H) : g2.moveTo(x / 100 * S.W, y / 100 * S.H)); g2.closePath(); g2.fill(); }
      let m = this.fromCanvas(cv2); const d = this.data(); for (let i = 0; i < m.length; i++) if (d[i * 4 + 3] < 20) m[i] = 0; // só onde há desenho
      if (!m.some(v => v)) throw new Error('a IA não marcou nada');
      this.setSel(m); b.close();
      if (what === 'limpar') { const F = this.faceMask(), col = this._face?.col || '#ffffff'; if (await UI.confirm({ title: 'Limpar o rosto?', msg: `A IA marcou o que vai sair (área azul). Pinto com a cor do rosto (<span style="display:inline-block;width:12px;height:12px;background:${col};border:1px solid #999;vertical-align:middle"></span>)?`, ok: 'Pode limpar', cancel: 'Não' })) { this.paintMask(this.st.sel, col); this.st.sel = new Uint8Array(S.W * S.H); this.commit(); } }
      else UI.toast((o.explica ? esc(o.explica) + ' · ' : '') + 'Seleção pronta: use Pintar, Apagar ou Virar desenho novo.', { time: 3500 });
    } catch (e) { b.close(); UI.toast('IA: ' + esc(e.message || e), { kind: 'err', time: 4000 }); }
  },

  /* ---------- botão direito ---------- */
  menu(e) {
    const S = this.st, has = S.sel.some(v => v);
    UI.ctx(e.clientX, e.clientY, [
      { head: 'Imagem' },
      { label: '🪄 Varinha aqui', action: () => { const p = this.pt(e); this.applySel(this.wand(p.x | 0, p.y | 0, S.tol, S.contig), 'novo'); } },
      { label: '😶 Achar o rosto', action: () => { const m = this.faceMask(); if (m) this.setSel(m); } },
      { label: '🧼 Limpar o rosto', action: () => this.cleanFace() },
      { label: '👄 Achar a boca', action: () => { const m = this.partMask('boca'); if (m) this.setSel(m); } },
      { label: '👀 Achar os olhos', action: () => { const m = this.partMask('olhos'); if (m) this.setSel(m); } },
      { label: '📂 Separar boca e olhos em pastas', action: () => this.splitParts() },
      { label: '📄 Seleção vira camada (Ctrl+J)', disabled: !has, action: () => this.selToLayer(false) },
      { label: '✂️ Recortar para camada (Ctrl+Shift+J)', disabled: !has, action: () => this.selToLayer(true) },
      { label: '🔄 Transformar camada (Ctrl+T)', action: () => this.startTf() },
      { label: '🤖 IA: separar tudo em camadas', disabled: !(typeof AIClient !== 'undefined' && AIClient.ready), action: () => this.aiParts() },
      '-',
      { label: '🎨 Pintar seleção com a cor', disabled: !has, action: () => this.fillSel(S.color) },
      { label: '⬜ Pintar seleção de branco', disabled: !has, action: () => this.fillSel('#ffffff') },
      { label: '🧽 Apagar seleção', disabled: !has, action: () => this.eraseSel() },
      { label: '📄 Seleção vira desenho novo', disabled: !has, action: () => this.copySel() },
      { label: 'Inverter seleção', action: () => { S.sel = S.sel.map(v => 255 - v); this.commit(); } },
      { label: 'Tirar seleção', disabled: !has, action: () => this.selNone() },
      '-',
      { label: '🤖 IA: limpar o rosto', disabled: !(typeof AIClient !== 'undefined' && AIClient.ready), action: () => this.ai('limpar') },
      { label: '🤖 IA: achar a boca', disabled: !(typeof AIClient !== 'undefined' && AIClient.ready), action: () => this.ai('boca') },
      { label: 'Ajustar à tela', action: () => this.fit() },
    ]);
  },
};
