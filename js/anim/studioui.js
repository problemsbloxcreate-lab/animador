/* ===================== anim/studioui.js — painéis, menus, importar, IA, exportar (Estúdio de Animação) ===================== */
'use strict';

const StudioUI = {
  tab: 'chars',
  init() {
    $('#an-home').onclick = () => this.goEditor();
    const em = $('#ep-modo'); if (em) $('[data-m=edicao]', em).onclick = () => this.goEditor();
    $('#an-undo').innerHTML = ic('undo'); $('#an-undo').onclick = () => Studio.undo();
    $('#an-redo').innerHTML = ic('redo'); $('#an-redo').onclick = () => Studio.redo();
    $('#an-ai').innerHTML = ic('sparkles', 14) + 'IA de animação'; $('#an-ai').onclick = () => this.iaModal();
    $('#an-file').innerHTML = ic('package', 14) + 'Salvar .toon'; $('#an-file').onclick = () => this.saveToon();
    $('#an-export').innerHTML = ic('download', 14) + 'Exportar'; $('#an-export').onclick = () => this.exportModal();
    $('#an-name').onclick = async () => { if (!Studio.P) return; const n = await UI.prompt({ title: 'Renomear', label: 'Nome da animação', value: Studio.P.name }); if (n) { Studio.P.name = n; Studio.commit('Renomeado'); } };
    this.menus(); this.modes(); this.tools();
    const pm = $('#an-prev-m'), px = $('#an-prev-x'), pv = $('#an-prev');
    const fillPm = () => { pm.innerHTML = Desenho.previewModes().map(([k, l]) => `<option value="${k}">${l}</option>`).join(''); pm.value = Desenho.prevMode || pm.options[0].value; };
    fillPm(); this.fillPreview = fillPm; pm.onchange = () => { Desenho.prevMode = pm.value; Desenho.drawPreview(); };
    try { if (localStorage.getItem('an-prev-closed') === '1') pv.classList.add('closed'); } catch { }
    px.onclick = () => { pv.classList.toggle('closed'); try { localStorage.setItem('an-prev-closed', pv.classList.contains('closed') ? '1' : '0'); } catch { } Desenho.drawPreview(); };
    const lt = $('#an-ltabs'); lt.innerHTML = '';
    [['chars', 'layers', 'Personagem'], ['poses', 'bookmark', 'Poses'], ['draws', 'image', 'Desenhos'], ['som', 'music', 'Som'], ['cena', 'camera', 'Cena']].forEach(([k, i, l]) => { const b = h(`<button class="ltab" data-t="${k}">${ic(i, 17)}<small>${l}</small></button>`); b.onclick = () => { this.tab = k; this.refreshLeft(); }; lt.appendChild(b); });
    // redimensionar a timeline
    const tl = $('#an-tl'), sp = h('<div class="an-split" title="Arraste para mudar a altura da timeline"></div>'); tl.appendChild(sp);
    sp.addEventListener('pointerdown', e => { const r = $('#anim'), h0 = tl.getBoundingClientRect().height; dragPointer(e, (ev, dx, dy) => { r.style.setProperty('--antl', clamp(h0 - dy, 140, innerHeight - 260) + 'px'); }, () => { try { localStorage.setItem('an-tlh', getComputedStyle(r).getPropertyValue('--antl')); } catch { } }); });
    try { const v = localStorage.getItem('an-tlh'); if (v) $('#anim').style.setProperty('--antl', v); } catch { }
    $('#an-stage').appendChild(h('<div class="an-badge" id="an-badge"></div>'));
    // soltar arquivos
    const st = $('#an-stage'); st.addEventListener('dragover', e => e.preventDefault());
    st.addEventListener('drop', e => { e.preventDefault(); const fs = [...e.dataTransfer.files]; if (!fs.length) return; const toon = fs.find(f => /\.toon$/i.test(f.name)); if (toon) return this.openToon(toon); if (!Studio.P) return; const au = fs.filter(f => Assets.kindOf(f) === 'audio'), im = fs.filter(f => Assets.kindOf(f) === 'image'); if (au.length) this.importAudio('voz', au); if (im.length) this.importChoice(im); });
  },
  menus() {
    const M = {
      Arquivo: () => [
        { label: 'Nova animação…', icon: 'plus', action: () => this.newDialog() },
        { label: 'Abrir animação…', icon: 'folder', action: () => this.startScreen() },
        { label: 'Abrir arquivo .toon…', icon: 'upload', action: () => this.openToon() },
        '-',
        { label: 'Salvar', icon: 'save', key: 'Ctrl+S', action: () => Studio.save() },
        { label: 'Salvar arquivo .toon (leva tudo)', icon: 'package', action: () => this.saveToon() },
        { label: 'Exportar vídeo MP4…', icon: 'download', action: () => this.exportModal() },
        { label: 'Levar para o editor de vídeo', icon: 'film', ai: true, action: () => this.toEditor() },
        '-',
        { label: 'Voltar ao início do editor', icon: 'home', action: () => this.goEditor() },
      ],
      Editar: () => [
        { label: 'Desfazer', icon: 'undo', key: 'Ctrl+Z', action: () => Studio.undo() },
        { label: 'Refazer', icon: 'redo', key: 'Ctrl+Y', action: () => Studio.redo() },
        '-',
        { label: 'Copiar pose', icon: 'copy', key: 'Ctrl+C', action: () => Studio.copyPose() },
        { label: 'Colar pose', icon: 'paste', key: 'Ctrl+V', disabled: !Studio.clip, action: () => Studio.pastePose() },
        { label: 'Keyframe na parte (K)', icon: 'diamond', key: 'K', action: () => Studio.keyHere() },
        { label: 'Keyframe no boneco inteiro', icon: 'diamond', key: 'Shift+K', action: () => Studio.keyAllHere() },
        { label: 'Apagar keyframe(s)', icon: 'trash', key: 'Del', action: () => Studio.deleteKeys() },
        { label: 'Limpar toda a animação do personagem…', icon: 'trash', danger: true, action: () => this.clearAnim() },
      ],
      Personagem: () => [
        { label: 'Montar com partes + modelo inteiro…', icon: 'layers', ai: true, action: () => this.importMontar() },
        { label: 'Ler folha de modelo (model sheet)…', icon: 'grid', ai: true, action: () => this.importFolha() },
        { label: 'PNGtuber (imagens inteiras)…', icon: 'image', action: () => this.importPNG() },
        '-',
        { label: 'Adicionar parte (imagem)…', icon: 'plus', disabled: !Studio.selRig, action: () => this.addPart() },
        { label: 'Duplicar personagem', icon: 'dup', disabled: !Studio.selRig, action: () => this.dupRig() },
        { label: 'Espelhar personagem (virar)', icon: 'flip', disabled: !Studio.selRig, action: () => this.flipRig() },
        { label: 'Apagar personagem', icon: 'trash', danger: true, disabled: !Studio.selRig, action: () => this.delRig() },
      ],
      Animar: () => [
        { label: 'IA de animação…', icon: 'sparkles', ai: true, action: () => this.iaModal() },
        { label: 'Boca pela voz (lip-sync)', icon: 'mic', action: () => this.lipsync() },
        { label: 'Piscadas automáticas', icon: 'eye', action: () => this.blinks() },
        '-',
        { label: 'Inserir 1 quadro aqui', icon: 'plus', action: () => Studio.insertFrames(Studio.f, 1) },
        { label: 'Remover 1 quadro aqui', icon: 'minus', action: () => Studio.insertFrames(Studio.f, -1) },
      ],
      Exibir: () => [
        { label: 'Mostrar ossos', checked: Studio.showBones, key: 'B', action: () => { Studio.showBones = !Studio.showBones; this.tools(); Studio.render(); } },
        { label: 'Papel-cebola (quadros vizinhos)', checked: Studio.onion, key: 'O', action: () => { Studio.onion = !Studio.onion; this.tools(); Studio.render(); } },
        { label: 'Ajustar à tela', icon: 'zoomIn', key: 'F', action: () => Studio.fitView() },
        { label: 'Atalhos do teclado', icon: 'keyboard', key: '?', action: () => this.shortcuts() },
        '-',
        { label: 'Tema e cores…', icon: 'palette', action: () => Tema.open() },
      ],
      Ajuda: () => [{ label: 'Como funciona o estúdio', icon: 'info', action: () => this.help() }, { label: 'Atalhos do teclado', icon: 'keyboard', action: () => this.shortcuts() }],
    };
    const nav = $('#an-menus'); nav.innerHTML = '';
    for (const name of Object.keys(M)) { const b = h(`<button class="menu-btn">${name}</button>`); b.onclick = () => { const r = b.getBoundingClientRect(); UI.ctx(r.left, r.bottom + 4, M[name]()); }; nav.appendChild(b); }
  },
  modes() {
    const el = $('#an-modes'); el.innerHTML = '';
    [['animar', 'play', 'Animar', 'Mexer nos ossos e criar keyframes'], ['montar', 'gear', 'Montar', 'Ajustar o boneco: pivôs, posição das partes, quem é pai de quem (sem animar)']].forEach(([k, i, l, t]) => { const b = h(`<button data-m="${k}" title="${t} (Tab)">${ic(i, 13)}${l}</button>`); b.onclick = () => this.setMode(k); el.appendChild(b); });
    this.paintModes();
  },
  paintModes() { $$('#an-modes button').forEach(b => b.classList.toggle('on', b.dataset.m === Studio.mode)); const bd = $('#an-badge'); if (bd) { bd.className = 'an-badge ' + Studio.mode; bd.textContent = Studio.mode === 'montar' ? 'MONTAR — o boneco aparece parado, sem animação' : ''; bd.style.display = Studio.mode === 'montar' ? '' : 'none'; } },
  setMode(m, keepTool) { Studio.mode = m; if (!keepTool) Studio.tool = m === 'montar' ? 'pivo' : 'auto'; this.paintModes(); this.tools(); Studio.render(); this.refreshProps(); },
  // ferramentas (barra vertical, como no Harmony). Escolher uma ferramenta de montagem troca para Montar e vice-versa.
  TOOLS: [
    ['auto', 'cursor', 'Selecionar / mover inteligente (V)'], ['girar', 'transition', 'Girar no pivô (R)'], ['ik', 'bolt', 'IK — puxar mão/pé (I)'], ['mover', 'move', 'Mover personagem (M)'], ['esticar', 'sliders', 'Esticar parte — arraste ao longo do osso (S) · Shift = largura'], '-',
    ['pivo', 'pivot', 'Pivô — onde a parte gira (P)'], ['parte', 'bone', 'Mover parte (montagem)'], '-',
    ['pincel', 'brush', 'Pincel (D)'], ['lapis', 'pencil', 'Lápis (L)'], ['borracha', 'eraser', 'Borracha (E)'], ['balde', 'bucket', 'Balde de tinta (G)'], ['conta', 'pipette', 'Conta-gotas (Y)'], '-',
    ['camera', 'camera', 'Câmera — mover / zoom (C)'], ['mao', 'jump', 'Mão — arrastar a vista (H)'],
  ],
  setTool(t) {
    if (['pivo', 'parte'].includes(t) && Studio.mode !== 'montar') this.setMode('montar', true);
    else if (!['pivo', 'parte', 'mao'].includes(t) && Studio.mode === 'montar' && !Desenho.isTool(t) && t !== 'camera') this.setMode('animar', true);
    Studio.tool = t; Studio._cursor = null; this.tools(); this.refreshProps(); Studio.render();
  },
  tools() {
    const strip = $('#an-strip');
    if (strip) { strip.innerHTML = ''; for (const T of this.TOOLS) { if (T === '-') { strip.appendChild(h('<i class="st-sep"></i>')); continue; } const [k, icn, tt] = T; const b = h(`<button class="st-b ${Studio.tool === k ? 'on' : ''}" title="${tt}">${ic(icn, 18)}</button>`); b.onclick = () => this.setTool(k); strip.appendChild(b); } }
    const el = $('#an-tools'); if (!el) return; el.innerHTML = '';
    const vt = h(`<div class="an-vtabs">${Studio.ctx ? `<button data-v="video" title="O boneco no mesmo lugar e no mesmo quadro do vídeo do editor (o normal)">${ic('play', 13)} No vídeo</button>` : ''}<button data-v="camera" title="${Studio.ctx ? 'Animar separado: só o boneco, pela câmera dele (opcional)' : 'Vendo pela câmera (o que sai no vídeo)'}">${ic('camera', 13)} ${Studio.ctx ? 'Separado' : 'Câmera'}</button><button data-v="cena" title="Cena inteira, com a moldura da câmera">${ic('frame', 13)} Cena</button></div>`);
    $$('button', vt).forEach(b => { b.classList.toggle('on', b.dataset.v === Studio.viewMode); b.onclick = () => { Studio.viewMode = b.dataset.v; this.tools(); Studio.fitView(); Studio.render(); }; }); el.appendChild(vt);
    if (Studio.viewMode !== 'cena') { const sc = h(`<button class="btn sm pv-tg ${Studio.soCam ? 'on' : ''}" title="${Studio.soCam ? 'Mostrar também o que está fora da câmera' : 'Mostrar só o que a câmera pega'}">${Studio.soCam ? '👁 Ver fora da câmera' : '🎥 Só a câmera'}</button>`); sc.onclick = () => { Studio.soCam = !Studio.soCam; this.tools(); Studio.render(); }; el.appendChild(sc); }
    el.appendChild(h('<span class="vsep"></span>'));
    const tg = (on, i, t, fn, lbl) => { const b = h(`<button class="ibtn ${lbl ? 'wide' : ''} ${on ? 'on' : ''}" title="${t}">${ic(i, 16)}${lbl ? `<span>${lbl}</span>` : ''}</button>`); b.onclick = fn; el.appendChild(b); return b; };
    const draw = Desenho.isTool(Studio.tool);
    if (draw) {
      tg(Desenho.opt.quadro, 'frame', 'Quadro a quadro: desenhar num quadro novo cria um desenho novo ali (N = desenho vazio aqui · Shift+N = copiar o desenho)', () => { Desenho.opt.quadro = !Desenho.opt.quadro; Desenho.save(); this.tools(); }, 'Quadro a quadro');
      const ps = h(`<label class="tl-fld" title="Quantos quadros cada desenho dura (, e . pulam esse tanto)">em <select>${[1, 2, 3, 4].map(v => `<option value="${v}" ${v === Desenho.opt.passo ? 'selected' : ''}>${v}s</option>`).join('')}</select></label>`); $('select', ps).onchange = e => { Desenho.opt.passo = +e.target.value; Desenho.save(); Studio.render(); }; el.appendChild(ps);
      tg(false, 'plus', 'Desenho vazio neste quadro (N)', () => this.drawFrame(false)); tg(false, 'dup', 'Copiar o desenho para este quadro (Shift+N)', () => this.drawFrame(true)); tg(false, 'layers', 'Nova camada de desenho', () => { const T = Desenho.target(true); if (T) { Desenho.newLayer(T.rig); Studio.commit('Camada de desenho'); } });
    } else if (Studio.mode === 'animar') {
      const sw = h(`<label class="switch xs" title="Arrastar uma parte com vários desenhos escolhe o mais parecido com o movimento"><input type="checkbox" ${Studio.smart ? 'checked' : ''}><i></i>Pose inteligente</label>`); $('input', sw).onchange = e => { Studio.smart = e.target.checked; }; el.appendChild(sw);
      tg(Studio.showBones, 'bone', 'Mostrar ossos (B)', () => { Studio.showBones = !Studio.showBones; this.tools(); Studio.render(); });
    }
    el.appendChild(h('<span class="vsep"></span>'));
    tg(Studio.onion, 'onion', 'Papel-cebola: anteriores em vermelho, seguintes em verde (O)', () => { Studio.onion = !Studio.onion; this.tools(); Studio.render(); });
    if (Studio.onion) { const on = h(`<select class="mini-sel" title="Quantos quadros antes/depois">${[1, 2, 3, 4, 5].map(v => `<option ${v === Studio.onionN ? 'selected' : ''}>${v}</option>`).join('')}</select>`); on.onchange = e => { Studio.onionN = +e.target.value; Studio.render(); }; el.appendChild(on); }
    el.appendChild(h('<span class="sp"></span>'));
    tg(false, 'zoomOut', 'Diminuir', () => { const s = $('#an-stage'); Studio.zoomAt(1 / 1.25, s.clientWidth / 2, s.clientHeight / 2); });
    const z = h(`<span class="an-zoom" id="an-zoom" title="Ajustar à tela (F)"></span>`); z.onclick = () => Studio.fitView(); el.appendChild(z);
    tg(false, 'zoomIn', 'Aumentar', () => { const s = $('#an-stage'); Studio.zoomAt(1.25, s.clientWidth / 2, s.clientHeight / 2); });
    this.zoomLabel();
    $('#an-stage').className = 'an-stage t-' + Studio.tool + (Studio.tool === 'mao' ? ' pan' : '') + (draw ? ' drawing' : '');
  },
  drawFrame(copy) { const T = Desenho.target(true); if (!T) return; Desenho.newDrawing(T.rig, T.n, copy); Studio.commit(copy ? 'Desenho copiado para o quadro' : 'Desenho vazio no quadro'); },
  statusBar() { const s = $('#an-status'); if (!s || !Studio.P) return; const T = this.TOOLS.find(t => t[0] === Studio.tool); s.innerHTML = `<span>${ic(T?.[1] || 'cursor', 12)} ${esc((T?.[2] || '').replace(/ \(.*\)$/, ''))}</span><span>${Studio.selNode ? esc(Studio.selNode.name) : Studio.selRig ? esc(Studio.selRig.name) : 'nada selecionado'}</span><span class="sp"></span><span>${Math.round(Studio.view.z * 100)}%</span><span>Quadro ${Studio.f + 1}</span>`; },
  zoomLabel() { const z = $('#an-zoom'); if (z) z.textContent = Math.round(Studio.view.z * 100) + '%'; },
  hint(html) { $('#an-hint').innerHTML = html; },
  hoverHint(H) {
    if (Studio._drag) return; const c = $('#an-canvas'); if (!H) { c.style.cursor = ''; return; }
    c.style.cursor = Studio.mode === 'montar' ? (H.joint ? 'crosshair' : 'move') : H.joint ? 'alias' : 'pointer';
  },
  saveState() { const s = $('#an-save'); if (s) { s.className = 'save-state ' + (Studio.dirty ? 'dirty' : 'ok'); s.textContent = Studio.dirty ? 'não salvo' : 'salvo'; } },
  refresh() { if (!Studio.P) return; $('#an-name').textContent = Studio.P.name; document.title = Studio.P.name + ' — ' + ESTUDIO.titulo; this.saveState(); this.refreshLeft(); this.refreshProps(); AnTL.draw(); },

  /* ---------- painel da esquerda ---------- */
  refreshLeft() {
    $$('#an-ltabs .ltab').forEach(b => b.classList.toggle('on', b.dataset.t === this.tab));
    const el = $('#an-lbody'); if (!el || !Studio.P) return; el.innerHTML = '';
    this['tab_' + this.tab](el);
  },
  big(icon, title, sub, fn, ai) { const b = h(`<button class="an-big ${ai ? 'ai-on' : ''}"><span class="ab-ic">${ic(icon, 18)}</span><span><b>${title}</b><small>${sub}</small></span></button>`); b.onclick = fn; return b; },
  tab_chars(el) {
    el.appendChild(this.big('layers', 'Montar com partes + modelo', 'Mande as partes separadas e o desenho inteiro: a IA encaixa, liga os ossos e acha os pivôs.', () => this.importMontar()));
    el.appendChild(this.big('grid', 'Folha de modelo', 'Turnaround, cabeça em 8 direções, olhos, bocas, mãos… vira partes com troca de desenho.', () => this.importFolha()));
    el.appendChild(this.big('image', 'PNGtuber', 'Imagens inteiras (com ou sem boca/olhos separados). Dá para animar sem separar nada.', () => this.importPNG()));
    const P = Studio.P, s = h(`<div class="an-sec"><h4>Personagens na cena <span class="sp"></span></h4><div class="an-list"></div></div>`), L = $('.an-list', s);
    if (!P.rigs.length) L.appendChild(h(`<div class="an-empty">Nenhum personagem ainda.<br>Use um dos botões acima.</div>`));
    for (const r of P.rigs) {
      const row = h(`<div class="an-row ${r === Studio.selRig ? 'on' : ''}">${ic('layers', 14)}<b>${esc(r.name)}</b><small>${r.nodes.length} parte(s)</small><button class="ibtn xs" title="Opções">${ic('dots', 13)}</button></div>`);
      row.onclick = e => { if (e.target.closest('button')) return; Studio.selectNode(r, null); };
      $('button', row).onclick = e => { Studio.selRig = r; this.rigMenu(e, r); };
      L.appendChild(row);
    }
    el.appendChild(s);
    if (Studio.selRig) {
      const r = Studio.selRig, t = h(`<div class="an-sec"><h4>Partes de ${esc(r.name)} <span class="sp"></span><button class="ibtn xs" title="Adicionar parte (imagem)">${ic('plus', 13)}</button></h4><div class="an-list"></div></div>`);
      $('h4 button', t).onclick = () => this.addPart();
      for (const [n, lv] of Rig.ordered(r)) { const row = h(`<div class="an-row ${n === Studio.selNode ? 'on' : ''}" style="margin-left:${lv * 12}px"><b>${esc(n.name)}</b><small>${n.drawings.length > 1 ? n.drawings.length + ' des.' : ''}${n.follow ? ' ~' : ''}</small></div>`); row.onclick = () => Studio.selectNode(r, n); $('.an-list', t).appendChild(row); }
      el.appendChild(t);
      if (r.quality != null) el.appendChild(h(`<div class="hint">${ic('info', 12)} Encaixe automático: diferença média <b>${r.quality}</b> (quanto menor, melhor). Se alguma parte ficou torta, use o modo <b>Montar</b> (Tab).</div>`));
    }
  },
  rigMenu(e, r) {
    UI.ctx(e.clientX, e.clientY, [
      { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Renomear personagem', label: 'Nome', value: r.name }); if (n) { r.name = n; Studio.commit('Renomeado'); } } },
      { label: 'Duplicar', icon: 'dup', action: () => this.dupRig() },
      { label: 'Espelhar (virar)', icon: 'flip', action: () => this.flipRig() },
      { label: 'Adicionar parte (imagem)…', icon: 'plus', action: () => this.addPart() },
      '-', { label: 'Apagar', icon: 'trash', danger: true, action: () => this.delRig() },
    ]);
  },
  tab_poses(el) {
    const r = Studio.selRig; if (!r) return el.appendChild(h('<div class="an-empty">Selecione um personagem.</div>'));
    el.appendChild(h(`<div class="hint">${ic('info', 12)} Monte a pose mexendo nos ossos e salve. Clique numa pose para aplicar no quadro atual — entra com <b>antecipação</b> e <b>assentamento</b> (estilo TV). A IA usa estas poses para atuar.</div>`));
    const bar = h(`<div class="btn-row"><button class="btn sm primary">${ic('plus', 12)} Salvar pose atual</button><button class="btn sm">${ic('diamond', 12)} Keyframe em tudo</button></div>`);
    bar.children[0].onclick = () => Studio.savePose(); bar.children[1].onclick = () => Studio.keyAllHere(); el.appendChild(bar);
    const names = Object.keys(r.poses); if (!names.length) el.appendChild(h('<div class="an-empty">Nenhuma pose salva ainda.</div>'));
    for (const n of names) {
      const p = r.poses[n], row = h(`<div class="an-pose">${p.thumb ? `<img src="${p.thumb}" width="40" height="40" style="background:#2a2c33;border-radius:6px">` : ''}<b>${esc(n)}</b>${n === 'neutra' ? '<small style="color:var(--tx3)">neutra</small>' : ''}<button class="ibtn xs" title="Opções">${ic('dots', 13)}</button></div>`);
      row.onclick = e => { if (e.target.closest('button')) return; Studio.applyPose(r, n, true); };
      $('button', row).onclick = e => UI.ctx(e.clientX, e.clientY, [
        { label: 'Aplicar seco (sem antecipação)', icon: 'bolt', action: () => Studio.applyPose(r, n, false) },
        { label: 'Atualizar com a pose atual', icon: 'save', action: () => { r.poses[n] = { data: Rig.capture(r, Studio.f), thumb: Studio.poseThumb(r) }; Studio.commit('Pose atualizada'); } },
        { label: 'Marcar como pose neutra (descanso)', icon: 'check', action: () => { r.poses.neutra = { ...r.poses[n], tag: 'neutra' }; if (n !== 'neutra') delete r.poses[n]; Studio.commit('Pose neutra marcada'); } },
        { label: 'Renomear', icon: 'edit', action: async () => { const nn = await UI.prompt({ title: 'Renomear pose', label: 'Nome', value: n }); if (nn && nn !== n) { r.poses[nn] = r.poses[n]; delete r.poses[n]; Studio.commit('Pose renomeada'); } } },
        '-', { label: 'Apagar', icon: 'trash', danger: true, action: () => { delete r.poses[n]; Studio.commit('Pose apagada'); } },
      ]);
      el.appendChild(row);
    }
  },
  tab_draws(el) {
    const r = Studio.selRig, n = Studio.selNode; if (!r || !n) return el.appendChild(h('<div class="an-empty">Clique numa parte do personagem (ou na lista de partes) para ver os desenhos dela.<br><br>Troca de desenho = bocas, olhos, mãos, cabeça virada…</div>'));
    const cur = Math.round(Studio.mode === 'montar' ? n.d || 0 : Rig.ch(r, n.id, 'd', Studio.f, n.d || 0));
    const s = h(`<div class="an-sec"><h4>Desenhos de ${esc(n.name)} <span class="sp"></span><button class="ibtn xs" title="Adicionar desenho (imagem)">${ic('plus', 13)}</button></h4><div class="an-thumbs"></div><p class="inl" style="font-size:11px;color:var(--tx3);margin:8px 0 0">Clique para usar no quadro atual (keyframe) · ↑/↓ troca · botão direito = opções</p></div>`);
    $('h4 button', s).onclick = () => this.addDrawing(n);
    const talkOf = new Set(Object.values(n.talk || {}).map(Number));
    n.drawings.forEach((d, i) => {
      const rt = d.asset && Assets.get(d.asset), th = h(`<div class="an-th ${i === cur ? 'on' : ''} ${talkOf.has(i) ? 'talk' : ''}" title="${esc(d.name || '')}">${rt ? `<img src="${rt.url}">` : '<small style="color:var(--tx3)">vazio</small>'}<span>${i + 1}. ${esc(d.name || '')}</span></div>`);
      th.onclick = () => { Studio.setDrawing(n, i); };
      th.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [
        { label: 'Renomear', icon: 'edit', action: async () => { const nn = await UI.prompt({ title: 'Nome do desenho', label: 'Ex.: aberta, fechada, A, O, 3/4 esq, olhando cima', value: d.name || '' }); if (nn != null) { d.name = nn; Studio.commit('Desenho renomeado'); } } },
        { label: 'Usar como padrão (montagem)', icon: 'check', action: () => { n.d = i; Studio.commit('Desenho padrão'); } },
        { label: 'É a versão "falando" de…', icon: 'mic', sub: n.drawings.map((x, j) => j === i ? null : { label: `${j + 1}. ${x.name || ''}`, action: () => { n.talk ||= {}; n.talk[j] = i; Studio.commit('Versão falando marcada'); } }).filter(Boolean) },
        '-', { label: 'Tirar da parte', icon: 'trash', danger: true, disabled: n.drawings.length < 2, action: () => { n.drawings.splice(i, 1); if (n.talk) { for (const [k, v] of Object.entries(n.talk)) if (+k === i || v === i) delete n.talk[k]; } n.d = clamp(n.d || 0, 0, n.drawings.length - 1); n._mk = null; Studio.commit('Desenho removido'); } },
      ]); };
      $('.an-thumbs', s).appendChild(th);
    });
    el.appendChild(s);
    if (n.drawings.length > 2) el.appendChild(h(`<div class="hint">${ic('sparkles', 12)} <b>Pose inteligente</b> (botão no topo): arraste esta parte no palco e a IA escolhe o desenho mais próximo do movimento${/esq|dir|lado|3\/4/i.test(n.drawings.map(d => d.name).join(' ')) ? ' — pelos nomes das direções (esq/dir/lado/3/4/cima/baixo)' : ' — comparando o formato de cada desenho'}.</div>`));
  },
  tab_som(el) {
    const P = Studio.P;
    const bar = h(`<div class="btn-row"><button class="btn sm primary">${ic('mic', 12)} Voz / fala</button><button class="btn sm">${ic('music', 12)} Música</button><button class="btn sm">${ic('wave', 12)} Efeito</button></div>`);
    bar.children[0].onclick = () => this.importAudio('voz'); bar.children[1].onclick = () => this.importAudio('musica'); bar.children[2].onclick = () => this.importAudio('efeito'); el.appendChild(bar);
    if (!P.audio.length) el.appendChild(h('<div class="an-empty">Coloque a voz para a IA animar a boca, as piscadas e a atuação pela fala.</div>'));
    P.audio.forEach((a, i) => {
      const m = Assets.meta(a.asset), c = h(`<div class="an-sec"><h4>${ic(a.kind === 'musica' ? 'music' : a.kind === 'efeito' ? 'wave' : 'mic', 13)} ${esc(m?.name || 'Áudio')}<span class="sp"></span><button class="ibtn xs" title="Remover">${ic('trash', 12)}</button></h4>
        <div class="an-kv"><span>Começa no quadro</span><input type="number" min="1" value="${a.start + 1}" data-k="start"></div>
        <div class="an-kv"><span>Volume</span><input type="range" min="0" max="150" value="${a.vol ?? 100}" data-k="vol"><small>${a.vol ?? 100}%</small></div>
        <div class="an-kv"><span>Tipo</span><select data-k="kind"><option value="voz">Voz (anima a boca)</option><option value="musica">Música</option><option value="efeito">Efeito</option></select></div>
        <label class="switch xs"><input type="checkbox" data-k="muted" ${a.muted ? 'checked' : ''}><i></i>Mudo</label></div>`);
      $('[data-k=kind]', c).value = a.kind || 'voz';
      $('h4 button', c).onclick = () => { P.audio.splice(i, 1); Studio.commit('Áudio removido'); };
      $('[data-k=start]', c).onchange = e => { a.start = Math.max(0, (+e.target.value || 1) - 1); Studio.commit('Áudio movido'); };
      $('[data-k=vol]', c).oninput = e => { a.vol = +e.target.value; e.target.nextElementSibling.textContent = a.vol + '%'; }; $('[data-k=vol]', c).onchange = () => Studio.commit('Volume');
      $('[data-k=kind]', c).onchange = e => { a.kind = e.target.value; Studio.commit('Tipo do áudio'); };
      $('[data-k=muted]', c).onchange = e => { a.muted = e.target.checked; Studio.commit(a.muted ? 'Mudo' : 'Som ligado'); };
      el.appendChild(c);
    });
    const tools = h(`<div class="an-sec"><h4>Pela voz</h4><div class="btn-row"><button class="btn sm">${ic('mic', 12)} Boca (lip-sync)</button><button class="btn sm">${ic('eye', 12)} Piscadas</button><button class="btn sm ai-on">${ic('sparkles', 12)} Atuar</button></div></div>`);
    const bs = $$('button', tools); bs[0].onclick = () => this.lipsync(); bs[1].onclick = () => this.blinks(); bs[2].onclick = () => this.iaModal(); el.appendChild(tools);
    const rs = h(`<div class="an-sec"><h4>Roteiro (a IA usa para atuar)</h4><textarea rows="6" style="width:100%" placeholder="Cole o texto da fala, com as direções entre [colchetes]…"></textarea></div>`), ta = $('textarea', rs);
    ta.value = P.roteiro || ''; if (P.roteiro) rs.classList.add('ai-on'); ta.onchange = () => { P.roteiro = ta.value; Studio.commit('Roteiro'); }; el.appendChild(rs);
  },
  tab_cena(el) {
    const P = Studio.P, S = P.settings;
    const c = h(`<div class="an-sec"><h4>Cena</h4>
      <div class="an-kv"><span>Cor do fundo</span><input type="color" value="${S.bg}" data-k="bg"></div>
      <div class="an-kv"><span>Imagem de fundo</span><button class="btn sm" data-k="img">${ic('image', 12)} ${P.bgAsset ? 'Trocar' : 'Escolher'}</button>${P.bgAsset ? `<button class="ibtn xs" data-k="noimg" title="Tirar">${ic('x', 12)}</button>` : ''}</div>
      <div class="an-kv"><span>Tamanho</span><input type="number" value="${S.w}" data-k="w"> × <input type="number" value="${S.h}" data-k="h"></div>
      <div class="chips" style="margin:6px 0">${[['Vertical 9:16', 1080, 1920], ['Horizontal 16:9', 1920, 1080], ['Quadrado', 1080, 1080]].map(([l, w, hh]) => `<span class="chip ${S.w === w && S.h === hh ? 'on' : ''}" data-wh="${w}x${hh}">${l}</span>`).join('')}</div></div>`);
    $('[data-k=bg]', c).onchange = e => { S.bg = e.target.value; Studio.commit('Cor do fundo'); };
    $('[data-k=img]', c).onclick = async () => { const f = await pickFiles('image/*', false); if (!f.length) return; const rt = await Assets.importFile(f[0], P.id); P.bgAsset = rt.meta.id; Studio.commit('Fundo'); };
    if ($('[data-k=noimg]', c)) $('[data-k=noimg]', c).onclick = () => { P.bgAsset = null; Studio.commit('Fundo removido'); };
    $('[data-k=w]', c).onchange = e => { S.w = clamp(Math.round(+e.target.value / 2) * 2 || 1920, 64, 4096); Studio.commit('Tamanho'); Studio.fitView(); };
    $('[data-k=h]', c).onchange = e => { S.h = clamp(Math.round(+e.target.value / 2) * 2 || 1080, 64, 4096); Studio.commit('Tamanho'); Studio.fitView(); };
    $$('[data-wh]', c).forEach(ch => ch.onclick = () => { const [w, hh] = ch.dataset.wh.split('x').map(Number); S.w = w; S.h = hh; Studio.commit('Tamanho'); Studio.fitView(); });
    el.appendChild(c);
    const cam = h(`<div class="an-sec"><h4>${ic('camera', 13)} Câmera</h4><p style="margin:0 0 8px;font-size:12px;color:var(--tx2)">Selecione a linha <b>Câmera</b> na timeline para mexer: aproximar devagar na emoção, corte seco no resto (estilo TV).</p><button class="btn sm">Selecionar câmera</button></div>`);
    $('button', cam).onclick = () => Studio.select({ t: 'cam' }); el.appendChild(cam);
  },

  /* ---------- propriedades (direita) ---------- */
  kv(label, val, on, o = {}) {
    const row = h(`<div class="an-kv"><span>${label}</span>${o.range ? `<input type="range" min="${o.min}" max="${o.max}" step="${o.step || 1}" value="${val}">` : ''}<input type="number" step="${o.step || 1}" value="${round(val, 2)}">${o.key !== undefined ? `<button class="ibtn xs kbtn ${o.key ? 'has' : ''}" title="${o.key ? 'Tem keyframe aqui (clique para apagar)' : 'Criar keyframe aqui'}">${ic('diamond', 12)}</button>` : ''}</div>`);
    const ins = $$('input', row); ins.forEach(inp => { inp.oninput = () => { ins.forEach(x => x !== inp && (x.value = inp.value)); on(+inp.value, false); }; inp.onchange = () => on(+inp.value, true); });
    if (o.key !== undefined) $('button', row).onclick = () => o.onKey && o.onKey();
    return row;
  },
  refreshProps() {
    const el = $('#an-props'); if (!el || !Studio.P) return; el.innerHTML = ''; const f = Studio.f;
    const wrap = h('<div class="an-props"></div>'); el.appendChild(wrap);
    if (Desenho.isTool(Studio.tool)) return this.drawProps(wrap);
    if (Studio.tool === 'camera') Studio.selCam = true;
    if (Studio.selCam) {
      const ks = Studio.P.camera.keys, c = Studio.camAt(f), sec = h(`<div class="an-sec"><h4>${ic('camera', 13)} Câmera — quadro ${f + 1}</h4></div>`);
      const ch = (k, l, o) => sec.appendChild(this.kv(l, c[k], (v, done) => { AnimMath.setKey(ks[k] ||= [], f, v, 'ease'); Studio.render(); if (done) Studio.commit('Câmera'); }, { ...o, key: (ks[k] || []).some(x => x.f === f), onKey: () => { const a = ks[k] || [], i = a.findIndex(x => x.f === f); if (i >= 0) a.splice(i, 1); else AnimMath.setKey(ks[k] ||= [], f, c[k]); Studio.commit('Keyframe da câmera'); } }));
      ch('X', 'Ir p/ lado (px)', {}); ch('Y', 'Ir p/ cima/baixo', {}); ch('Z', 'Zoom', { step: .01, range: true, min: .5, max: 3 }); ch('R', 'Girar (°)', { step: .5 });
      wrap.appendChild(sec); return;
    }
    const r = Studio.selRig; if (!r) { wrap.appendChild(h(`<div class="an-empty">${Studio.P.rigs.length ? 'Clique num personagem ou numa parte.' : 'Comece trazendo um personagem (painel da esquerda).'}<br><br><b>Dica:</b> clique nos ossos (losangos) para girar; puxe a mão ou o pé para a IK.</div>`)); return; }
    const n = Studio.selNode;
    if (!n) {
      const s = Rig.stageAt(r, f), has = c => (r.keys['@']?.[c] || []).some(k => k.f === f), sec = h(`<div class="an-sec"><h4>${ic('layers', 13)} ${esc(r.name)} no palco <span class="sp"></span><small>quadro ${f + 1}</small></h4></div>`);
      const ch = (c, l, o = {}) => sec.appendChild(this.kv(l, c === 'S' ? s.S * 100 : s[c], (v, done) => { Rig.setKey(r, '@', c, f, c === 'S' ? v / 100 : v, c === 'F' ? 'hold' : 'ease'); Studio.render(); if (done) Studio.commit('Personagem'); }, { ...o, key: has(c), onKey: () => { if (has(c)) Rig.delKey(r, '@', c, f); else Rig.setKey(r, '@', c, f, s[c]); Studio.commit('Keyframe'); } }));
      ch('X', 'Posição X'); ch('Y', 'Posição Y'); ch('S', 'Tamanho %', { range: true, min: 5, max: 300 }); ch('O', 'Opacidade %', { range: true, min: 0, max: 100 });
      const fl = h(`<div class="btn-row"><button class="btn sm">${ic('flip', 12)} Virar para o outro lado aqui</button></div>`); fl.children[0].onclick = () => { Rig.setKey(r, '@', 'F', f, s.F < 0 ? 1 : -1, 'hold'); Studio.commit('Virou'); }; sec.appendChild(fl);
      if (Acting.pupils(r).length) { const lk = h(`<div class="an-kv"><span>Olhar</span><div class="chips"></div></div>`); for (const k of ['centro', 'esq', 'dir', 'cima', 'baixo']) { const c = h(`<span class="chip">${k}</span>`); c.onclick = () => { Acting.look(r, f, k); Studio.commit('Olhar: ' + k); }; $('.chips', lk).appendChild(c); } sec.appendChild(lk); }
      sec.appendChild(this.kv('Respiração', (r.breath ?? .35) * 100, (v, done) => { r.breath = v / 100; Studio.render(); if (done) Studio.commit('Respiração'); }, { range: true, min: 0, max: 100 }));
      wrap.appendChild(sec);
      wrap.appendChild(h(`<div class="hint">${ic('info', 12)} A respiração é bem sutil de propósito (nada de "tremer"). Use 0 para desligar.</div>`));
      return;
    }
    const montar = Studio.mode === 'montar', has = c => (r.keys[n.id]?.[c] || []).some(k => k.f === f);
    const sec = h(`<div class="an-sec"><h4>${ic('cursor', 13)} ${esc(n.name)} <span class="sp"></span><small>${montar ? 'montagem' : 'quadro ' + (f + 1)}</small></h4></div>`);
    if (!montar) {
      const ch = (c, l, def, o = {}) => sec.appendChild(this.kv(l, Rig.ch(r, n.id, c, f, def), (v, done) => { if (c === 'r' && n.limit) v = clamp(v, n.limit[0], n.limit[1]); Rig.setKey(r, n.id, c, f, v); Studio.render(); if (done) Studio.commit(l); }, { ...o, key: has(c), onKey: () => { if (has(c)) Rig.delKey(r, n.id, c, f); else Rig.setKey(r, n.id, c, f, Rig.ch(r, n.id, c, f, def)); Studio.commit('Keyframe'); } }));
      ch('r', 'Giro (°)', 0, { range: true, min: n.limit ? n.limit[0] : -180, max: n.limit ? n.limit[1] : 180, step: .5 });
      ch('x', 'Deslocar X', 0); ch('y', 'Deslocar Y', 0); ch('sx', 'Esticar X', 1, { step: .01 }); ch('sy', 'Esticar Y', 1, { step: .01 });
      if (n.drawings.length > 1) { const dsel = h(`<div class="an-kv"><span>Desenho</span><select>${n.drawings.map((d, i) => `<option value="${i}">${i + 1}. ${esc(d.name || '')}</option>`).join('')}</select></div>`); $('select', dsel).value = String(Math.round(Rig.ch(r, n.id, 'd', f, n.d || 0))); $('select', dsel).onchange = e => Studio.setDrawing(n, +e.target.value); sec.appendChild(dsel); }
      const vis = h(`<div class="btn-row"><button class="btn sm">${ic(Rig.ch(r, n.id, 'v', f, 1) < .5 ? 'eye' : 'eyeOff', 12)} ${Rig.ch(r, n.id, 'v', f, 1) < .5 ? 'Mostrar a partir daqui' : 'Esconder a partir daqui'}</button></div>`);
      vis.children[0].onclick = () => { Rig.setKey(r, n.id, 'v', f, Rig.ch(r, n.id, 'v', f, 1) < .5 ? 1 : 0, 'hold'); Studio.commit('Visibilidade'); }; sec.appendChild(vis);
      sec.appendChild(h(`<p style="font-size:11px;color:var(--tx3);margin:6px 0 0">Esticar é para squash & stretch em momento cartunesco — no dia a dia, só gire.</p>`));
      wrap.appendChild(sec);
    }
    // montagem (vale para o boneco todo)
    const rs = h(`<div class="an-sec"><h4>${ic('gear', 13)} Montagem da parte</h4>
      <div class="an-kv"><span>Nome</span><input type="text" value="${esc(n.name)}" data-k="name" style="flex:1"></div>
      <div class="an-kv"><span>Papel</span><select data-k="role" style="flex:1">${['parte', 'inteiro', ...ROLES.map(x => x[0])].map(x => `<option>${x}</option>`).join('')}</select></div>
      <div class="an-kv"><span>Lado</span><select data-k="side" style="flex:1"><option value="">—</option><option value="esq">esquerdo</option><option value="dir">direito</option></select></div>
      <div class="an-kv"><span>Presa em</span><select data-k="parent" style="flex:1"><option value="">(raiz — anda no palco)</option>${r.nodes.filter(x => x !== n && !Studio.descendants(r, n).includes(x)).map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>
      <div class="an-kv"><span>Pivô</span><input type="number" value="${round(n.px, 1)}" data-k="px"><input type="number" value="${round(n.py, 1)}" data-k="py"></div>
      <div class="an-kv"><span>Ordem</span><button class="btn sm" data-k="up">${ic('up', 12)} Frente</button><button class="btn sm" data-k="down">${ic('down', 12)} Trás</button></div>
      <div class="an-kv"><span>Limite do giro</span><input type="number" value="${n.limit ? n.limit[0] : -180}" data-k="l0"><input type="number" value="${n.limit ? n.limit[1] : 180}" data-k="l1"></div>
      <label class="switch xs" title="Cabelo, orelha, brinco, roupa: a parte atrasa um pouco em relação ao pai (overlap/follow-through) — movimento orgânico"><input type="checkbox" data-k="follow" ${n.follow ? 'checked' : ''}><i></i>Seguir com atraso (cabelo, roupa)</label>
      <div class="btn-row" style="margin-top:8px"><button class="btn sm danger" data-k="del">${ic('trash', 12)} Apagar parte</button></div></div>`);
    $('[data-k=role]', rs).value = n.role; $('[data-k=side]', rs).value = n.side || ''; $('[data-k=parent]', rs).value = n.parent || '';
    $('[data-k=name]', rs).onchange = e => { n.name = e.target.value || n.name; Studio.commit('Nome da parte'); };
    $('[data-k=role]', rs).onchange = e => { n.role = e.target.value; const def = Roles.def(n.role); if (def) { n.limit = def[3] ? [...def[3]] : null; n.follow = def[4] ? { lag: 3, amt: .5 } : null; } Studio.commit('Papel da parte'); };
    $('[data-k=side]', rs).onchange = e => { n.side = e.target.value; Studio.commit('Lado'); };
    $('[data-k=parent]', rs).onchange = e => { n.parent = e.target.value || null; Studio.commit('Ligação do osso'); };
    const piv = () => { const nx = +$('[data-k=px]', rs).value, ny = +$('[data-k=py]', rs).value, dx = nx - n.px, dy = ny - n.py; n.px = nx; n.py = ny; n.drawings.forEach(d => { d.ox -= dx; d.oy -= dy; }); n.tip = Rig.computeTip(n); Studio.commit('Pivô'); };
    $('[data-k=px]', rs).onchange = piv; $('[data-k=py]', rs).onchange = piv;
    const zs = d => { const ord = [...r.nodes].sort((a, b) => a.z - b.z), i = ord.indexOf(n), j = clamp(i + d, 0, ord.length - 1); ord.splice(i, 1); ord.splice(j, 0, n); ord.forEach((x, k) => x.z = k); Studio.commit(d > 0 ? 'Para frente' : 'Para trás'); };
    $('[data-k=up]', rs).onclick = () => zs(1); $('[data-k=down]', rs).onclick = () => zs(-1);
    const lim = () => { const a = +$('[data-k=l0]', rs).value, b = +$('[data-k=l1]', rs).value; n.limit = a <= -180 && b >= 180 ? null : [Math.min(a, b), Math.max(a, b)]; Studio.commit('Limite do giro'); };
    $('[data-k=l0]', rs).onchange = lim; $('[data-k=l1]', rs).onchange = lim;
    $('[data-k=follow]', rs).onchange = e => { n.follow = e.target.checked ? { lag: 3, amt: .5 } : null; Studio.commit('Seguir com atraso'); };
    $('[data-k=del]', rs).onclick = async () => { if (!await UI.confirm({ title: 'Apagar parte?', msg: `"<b>${esc(n.name)}</b>" sai do boneco. As partes presas nela passam para o pai dela.`, ok: 'Apagar', danger: true })) return; for (const c of Rig.children(r, n.id)) c.parent = n.parent; r.nodes.splice(r.nodes.indexOf(n), 1); delete r.keys[n.id]; Studio.selNode = null; Studio.commit('Parte apagada'); };
    wrap.appendChild(rs);
  },
  // propriedades do pincel + paleta (como "Tool Properties" e "Colour" do Harmony)
  drawProps(wrap) {
    const o = Desenho.opt, t = Studio.tool, P = Studio.P;
    const sec = h(`<div class="an-sec"><h4>${ic(this.TOOLS.find(x => x[0] === t)[1], 13)} ${esc(this.TOOLS.find(x => x[0] === t)[2].replace(/ \(.*\)$/, ''))}</h4></div>`);
    const prevStroke = () => { const c = $('canvas', sec); if (!c) return; const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.strokeStyle = t === 'borracha' ? '#9aa3b5' : o.color; g.globalAlpha = o.opacity / 100; g.lineCap = 'round'; for (let i = 0; i < 40; i++) { const x0 = 12 + i * 6, x1 = x0 + 6, y = q => 32 + Math.sin(q / 38) * 16, w = q => Math.max(1, o.size * (t === 'pincel' && o.pressure ? .35 + .65 * Math.sin(Math.PI * q / 252) : 1) * .6); g.lineWidth = w(x0); g.beginPath(); g.moveTo(x0, y(x0)); g.lineTo(x1, y(x1)); g.stroke(); } };
    if (['pincel', 'lapis', 'borracha'].includes(t)) {
      sec.appendChild(h('<canvas class="br-prev" width="264" height="64"></canvas>'));
      const kv = (l, k, min, max, step = 1) => sec.appendChild(this.kv(l, o[k], (v, done) => { o[k] = v; prevStroke(); if (done) Desenho.save(); }, { range: true, min, max, step }));
      kv('Tamanho', 'size', 1, 120); if (t !== 'borracha') kv('Opacidade %', 'opacity', 5, 100); kv('Suavizar', 'smooth', 0, 95);
      if (t === 'pincel') { const pr = h(`<label class="switch xs" title="Caneta (mesa digitalizadora): mais força = traço mais grosso"><input type="checkbox" ${o.pressure ? 'checked' : ''}><i></i>Pressão da caneta</label>`); $('input', pr).onchange = e => { o.pressure = e.target.checked; Desenho.save(); prevStroke(); }; sec.appendChild(pr); }
      const pre = h('<div class="chips" style="margin-top:8px"></div>'); for (const [nm, sz, sm] of Desenho.PRESETS) { const c = h(`<span class="chip ${o.size === sz ? 'on' : ''}">${nm}</span>`); c.onclick = () => { o.size = sz; o.smooth = sm; Desenho.save(); this.refreshProps(); }; pre.appendChild(c); } sec.appendChild(pre);
      setTimeout(prevStroke, 0);
    }
    if (t === 'balde') { sec.appendChild(this.kv('Tolerância', o.tol, v => { o.tol = v; Desenho.save(); }, { range: true, min: 0, max: 120 })); sec.appendChild(this.kv('Fechar falhas', o.gap, v => { o.gap = Math.round(v); Desenho.save(); }, { range: true, min: 0, max: 6 })); }
    if (t === 'conta') sec.appendChild(h('<p class="an-note">Clique no desenho para pegar a cor.</p>'));
    const T = Studio.selNode; sec.appendChild(h(`<p class="an-note">Desenhando em: <b>${T ? esc(T.name) : 'camada nova (será criada)'}</b>${T ? ` · desenho ${Math.round(Rig.ch(Studio.selRig, T.id, 'd', Studio.f, T.d || 0)) + 1}/${T.drawings.length}` : ''}</p>`));
    wrap.appendChild(sec);
    // cores
    const pal = Desenho.palette(P), cs = h(`<div class="an-sec"><h4>${ic('palette', 13)} Cores <span class="sp"></span><input type="color" value="${o.color}" title="Escolher cor"></h4><div class="pal"></div><div class="btn-row" style="margin-top:8px"><button class="btn sm">${ic('plus', 12)} Guardar cor</button><button class="btn sm" ${Studio.selNode ? '' : 'disabled'}>${ic('pipette', 12)} Cores do personagem</button><button class="btn sm" data-ig ${Studio.selNode ? '' : 'disabled'} title="Pincel com a espessura do contorno e a cor da parte">🎯 Igual à parte</button></div></div>`);
    $('input[type=color]', cs).oninput = e => { o.color = e.target.value; Desenho.save(); paint(); prevStroke(); };
    const paint = () => { const g = $('.pal', cs); g.innerHTML = ''; pal.forEach((c, i) => { const sw = h(`<button class="sw ${c.toLowerCase() === o.color.toLowerCase() ? 'on' : ''}" style="background:${c}" title="${c} · botão direito tira"></button>`); sw.onclick = () => { o.color = c; Desenho.save(); paint(); prevStroke(); $('input[type=color]', cs).value = c; }; sw.oncontextmenu = ev => { ev.preventDefault(); pal.splice(i, 1); Studio.commit('Cor removida'); }; g.appendChild(sw); }); };
    paint();
    const [b1, b2] = $$('.btn-row .btn', cs); b1.onclick = () => { if (!pal.includes(o.color)) { pal.push(o.color); Studio.commit('Cor guardada'); } }; b2.onclick = () => { const cols = Desenho.colorsFrom(Studio.selNode).filter(c => !pal.includes(c)); pal.push(...cols); Studio.commit(`${cols.length} cores do personagem`); };
    $('[data-ig]', cs).onclick = () => { const n = Studio.selNode, rig = Studio.selRig, dr = n && [Rig.drawingAt(rig, n, Studio.f), ...n.drawings].find(d => d?.asset), A = Desenho.analyze(dr); if (!A) return UI.toast('Essa parte não tem desenho', { kind: 'warn' }); const iw = Assets.get(dr.asset).img.naturalWidth, W = Studio.P.settings.w, H = Studio.P.settings.h, M = Rig.pose(rig, Studio.f), B = Studio.baseMatrix().multiply(Rig.stageMatrix(rig, Studio.f, W, H)).multiply(M[n.id]), per = Math.hypot(B.a, B.b) / (devicePixelRatio || 1); o.size = clamp(Math.round(A.line * (dr.w ?? iw) / iw * per), 1, 120); o.color = A.outline; for (const c of A.cols) if (!pal.includes(c)) pal.push(c); Desenho.save(); Studio.commit('Pincel igual à parte'); };
    wrap.appendChild(cs);
  },
  stageMenu(e, H) {
    const r = Studio.selRig, n = Studio.selNode;
    UI.ctx(e.clientX, e.clientY, [
      n && { head: n.name },
      { label: 'Keyframe aqui', icon: 'diamond', key: 'K', disabled: !r, action: () => Studio.keyHere() },
      { label: 'Keyframe no boneco inteiro', icon: 'diamond', key: 'Shift+K', disabled: !r, action: () => Studio.keyAllHere() },
      n && n.drawings.length > 1 && { label: 'Trocar desenho', icon: 'image', sub: n.drawings.map((d, i) => ({ label: `${i + 1}. ${d.name || ''}`, action: () => Studio.setDrawing(n, i) })) },
      n && { label: 'Zerar giro desta parte', icon: 'undo', action: () => { Rig.setKey(r, n.id, 'r', Studio.f, 0); Studio.commit('Giro zerado'); } },
      '-',
      { label: 'Copiar pose', icon: 'copy', disabled: !r, action: () => Studio.copyPose() },
      { label: 'Colar pose', icon: 'paste', disabled: !Studio.clip, action: () => Studio.pastePose() },
      { label: 'Salvar pose…', icon: 'bookmark', disabled: !r, action: () => Studio.savePose() },
      '-',
      { label: Studio.mode === 'montar' ? 'Voltar para Animar' : 'Ir para Montar (ajustar boneco)', icon: 'gear', action: () => this.setMode(Studio.mode === 'montar' ? 'animar' : 'montar') },
    ].filter(Boolean));
  },

  /* ---------- telas e projeto ---------- */
  async startScreen() {
    const recs = (await DB.all('projects')).filter(p => p.kind === 'anim').sort((a, b) => b.modified - a.modified);
    const body = h(`<div><div class="btn-row"><button class="btn primary" data-a="new">${ic('plus', 14)} Nova animação</button><button class="btn" data-a="open">${ic('upload', 14)} Abrir .toon</button><span class="sp"></span><button class="btn ghost" data-a="ed">${ic('film', 14)} Ir para o editor de vídeo</button></div>
      <div class="an-list" style="margin-top:10px;max-height:52vh;overflow:auto">${recs.map(r => `<div class="an-row" data-p="${r.id}">${r.thumb ? `<img src="${r.thumb}" height="40" style="border-radius:5px">` : ic('film', 18)}<b>${esc(r.name)}</b><small>${r.settings ? r.settings.w + '×' + r.settings.h + ' · ' : ''}${fmtDate(r.modified)}</small></div>`).join('') || '<div class="an-empty">Nenhuma animação ainda. Crie a primeira!</div>'}</div></div>`);
    const res = await UI.modal({ title: 'Estúdio de Animação', icon: 'sparkles', width: 620, body, noClose: !Studio.P, buttons: [], onOpen: a => {
      $('[data-a=new]', body).onclick = () => a.close('new'); $('[data-a=open]', body).onclick = () => a.close('open'); $('[data-a=ed]', body).onclick = () => a.close('ed');
      $$('[data-p]', body).forEach(r => r.onclick = () => a.close('p:' + r.dataset.p));
    } });
    if (res === 'new') return this.newDialog(true);
    if (res === 'open') return this.openToon(null, true);
    if (res === 'ed') return this.goEditor();
    if (res && res.startsWith('p:')) { if (Studio.dirty) await Studio.save(true); return Studio.open(await DB.get('projects', res.slice(2))); }
  },
  async newDialog(fromStart) {
    const f = h(`<div class="fgrid"><label class="field full">Nome<input type="text" data-k="name" value="Animação ${new Date().toLocaleDateString('pt-BR')}"></label>
      <label class="field">Formato<select data-k="fmt"><option value="1080x1920">Vertical 9:16 (Shorts)</option><option value="1920x1080">Horizontal 16:9</option><option value="1080x1080">Quadrado</option></select></label>
      <label class="field">Quadros por segundo<select data-k="fps"><option>24</option><option>30</option><option>25</option><option>12</option></select></label>
      <label class="field">Duração (segundos)<input type="number" data-k="sec" value="6" min="1"></label><label class="field">Cor do fundo<input type="color" data-k="bg" value="#9fd3c7" style="width:100%"></label>
      <small class="full" style="color:var(--tx3)">24 quadros/s é o padrão de animação de TV (com boca em "2s").</small></div>`);
    const o = await UI.modal({ title: 'Nova animação', icon: 'plus', body: f, width: 480, enterValue: true, cancelValue: null, buttons: [{ label: 'Cancelar', value: null }, { label: 'Criar', kind: 'primary', collect: () => Object.fromEntries($$('[data-k]', f).map(i => [i.dataset.k, i.value])) }] });
    if (!o) { if (fromStart && !Studio.P) this.startScreen(); return; }
    const [w, hh] = o.fmt.split('x').map(Number);
    if (Studio.P && Studio.dirty) await Studio.save(true);
    const P = Studio.newProject({ name: o.name, w, h: hh, fps: +o.fps, sec: +o.sec || 6, bg: o.bg });
    await DB.put('projects', { id: P.id, kind: 'anim', name: P.name, created: P.created, modified: P.modified, settings: P.settings, dur: P.frames / P.settings.fps, data: JSON.stringify(P) });
    await Studio.open(await DB.get('projects', P.id)); this.tab = 'chars'; this.refreshLeft();
  },
  async goEditor() { if (Studio.dirty) await Studio.save(true);
    if (Studio.embed && parent !== window) { parent.postMessage({ tipo: 'ossos-voltar', t: Studio.ctx ? round(Studio.timeOf(Studio.f), 3) : null }, location.origin); return; }
    location.href = Studio.clipMode ? 'index.html?p=' + encodeURIComponent(Studio.clipMode.edId) + (Studio.ctx ? '&t=' + round(Studio.timeOf(Studio.f), 3) : '') : 'index.html'; },
  // barra do modo clipe: deixa claro que é o boneco de um clipe do editor
  clipBar() {
    this.fillPreview?.(); Desenho.prevMode = 'editor'; const pm = $('#an-prev-m'); if (pm) pm.value = 'editor';
    const a = $('#an-file'), b = $('#an-export'); if (a) a.style.display = 'none'; if (b) { b.innerHTML = ic('check', 14) + 'Voltar à cena'; b.title = 'Salva o personagem e volta para a cena (canvas)'; b.onclick = async () => { await Studio.save(true); this.goEditor(); }; }
    const n = $('#an-name'); if (n) n.title = 'Boneco de um clipe do editor — as mudanças voltam para o vídeo';
  },
  help() {
    UI.modal({ title: 'Como funciona o estúdio', icon: 'info', width: 640, body: `<p><b>1. Traga o personagem</b> (painel da esquerda): partes separadas + o desenho inteiro (a IA encaixa e liga os ossos), uma <b>folha de modelo</b>, ou um <b>PNGtuber</b> (imagens inteiras).</p>
      <p><b>2. Montar</b> (Tab): confira os pivôs (as juntas). Arraste o círculo vermelho para onde a parte gira. Ajuste quem é pai de quem e a ordem.</p>
      <p><b>3. Animar</b>: clique num osso e gire. Puxe a mão ou o pé (quadradinho) e o braço/perna acompanham (IK) — nada estica. Cada mexida vira <b>keyframe</b> no quadro atual.</p>
      <p><b>4. Pela voz</b>: coloque o áudio em <b>Som</b> e use a <b>IA de animação</b>: ela faz a boca, as piscadas e troca de pose nas palavras fortes, com antecipação, passar do ponto e cabelo seguindo — no estilo Disney TV (The Owl House, Amphibia), sem tremedeira.</p>
      <p><b>5.</b> Exporte o MP4, salve o <b>.toon</b> ou leve para o editor de vídeo.</p>
      <div class="an-perm">${ic('alert', 12)} A IA <b>nunca</b> mexe nas suas imagens sem perguntar antes.</div>`, buttons: [{ label: 'Ok', kind: 'primary' }] });
  },
  shortcuts() {
    const L = [['Espaço', 'Tocar / pausar'], [', .  ou ← →', 'Quadro anterior / próximo'], ['[  ]', 'Keyframe anterior / próximo'], ['K', 'Keyframe na parte'], ['Shift+K', 'Keyframe no boneco inteiro'], ['Del', 'Apagar keyframe'], ['↑ ↓', 'Trocar desenho da parte'], ['V R I M H', 'Ferramentas: inteligente, girar, IK, mover, mão'], ['Alt + arrastar', 'Girar sem IK / sem pose inteligente'], ['Shift + arrastar', 'Girar de 15 em 15° · deslocar a parte'], ['Tab', 'Animar ↔ Montar'], ['O', 'Papel-cebola'], ['B', 'Ossos'], ['F', 'Ajustar à tela'], ['Roda do mouse', 'Zoom (Shift = rolar)'], ['Botão do meio', 'Arrastar a vista'], ['Ctrl+Z / Ctrl+Y', 'Desfazer / refazer'], ['Ctrl+C / Ctrl+V', 'Copiar / colar pose'], ['Ctrl+S', 'Salvar']];
    UI.modal({ title: 'Atalhos', icon: 'keyboard', width: 520, body: `<div class="kbd-list">${L.map(([k, d]) => `<span><kbd>${k}</kbd></span><span>${d}</span>`).join('')}</div>`, buttons: [{ label: 'Ok', kind: 'primary' }] });
  },

  /* ---------- personagens ---------- */
  placeRig(rig) {
    const P = Studio.P, W = P.settings.w, H = P.settings.h, n = P.rigs.length;
    rig.stage = { X: n ? (n % 2 ? 1 : -1) * W * .22 : 0, Y: H * .46, S: round(Math.min(1, (H * .82) / (rig.h || H), (W * .9) / (rig.w || W)), 3), F: 1, O: 100 };
    rig.name = rig.name === 'Personagem' && n ? 'Personagem ' + (n + 1) : rig.name;
    P.rigs.push(rig); Studio.selRig = rig; Studio.selNode = null;
    // pose neutra = como veio
    rig.poses.neutra = { data: Object.fromEntries(rig.nodes.map(x => [x.id, { r: 0, d: x.d || 0 }])), tag: 'neutra' };
    Studio.commit('Personagem adicionado'); this.tab = 'chars'; this.refreshLeft();
  },
  importChoice(files) {
    UI.modal({ title: `${files.length} imagem(ns)`, icon: 'image', body: '<p>O que fazer com estas imagens?</p>', cancelValue: null, buttons: [{ label: 'Cancelar', value: null }, { label: 'PNGtuber', value: 'png' }, files.length === 1 && { label: 'Folha de modelo', value: 'folha' }, { label: 'Partes + modelo', kind: 'primary', value: 'montar' }].filter(Boolean) })
      .then(v => { if (v === 'png') this.importPNG(files); if (v === 'folha') this.importFolha(files[0]); if (v === 'montar') this.importMontar(files); });
  },
  async importMontar(pre) {
    if (!Studio.P) return;
    const st = { ref: null, parts: [] }; if (pre) { st.parts = [...pre]; }
    const body = h(`<div><p>1) O <b>desenho inteiro</b> do personagem (de frente, como ele fica montado) — a IA usa como guia.</p><div class="import-zone" data-z="ref">${ic('image', 20)}<b data-l="ref">Escolher o desenho inteiro</b><small>PNG com fundo transparente</small></div>
      <p>2) As <b>partes separadas</b> (cabeça, tronco, braços, mãos, pernas, olhos, bocas…) — arquivos soltos <i>ou uma folha só</i> com todas as partes. Dê nomes às partes (ex.: <i>braço esq</i>, <i>boca aberta</i>): ajuda a IA.</p><div class="import-zone" data-z="parts">${ic('layers', 20)}<b data-l="parts">Escolher as partes</b><small>Várias de uma vez</small></div>
      <div class="an-perm">${ic('info', 12)} A IA só <b>encaixa</b> as partes. Ela não redesenha, não apaga e não recorta nada das suas imagens.</div></div>`);
    const lab = () => { $('[data-l=ref]', body).textContent = st.ref ? '✓ ' + st.ref.name : 'Escolher o desenho inteiro'; $('[data-l=parts]', body).textContent = st.parts.length ? `✓ ${st.parts.length} parte(s)` : 'Escolher as partes'; };
    $('[data-z=ref]', body).onclick = async () => { const f = await pickFiles('image/*', false); if (f.length) { st.ref = f[0]; lab(); } };
    $('[data-z=parts]', body).onclick = async () => { const f = await pickFiles('image/*', true); if (f.length) { st.parts = f; lab(); } };
    if (pre?.length > 1) { // tenta achar o inteiro pelo nome / tamanho
      const big = [...pre].sort((a, b) => b.size - a.size)[0], byName = pre.find(f => /inteir|complet|full|frente|ref|modelo/i.test(f.name)); st.ref = byName || big; st.parts = pre.filter(f => f !== st.ref);
    }
    lab();
    const ok = await UI.modal({ title: 'Montar com partes + modelo', icon: 'layers', width: 560, body, cancelValue: false, buttons: [{ label: 'Cancelar', value: false }, { label: 'Montar o boneco', kind: 'primary', onClick: () => { if (!st.ref || !st.parts.length) { UI.toast('Escolha o desenho inteiro e as partes.', { kind: 'warn' }); return false; } return true; } }] });
    if (!ok) return;
    const b = UI.busy('Montando o boneco…', '<div class="spinner"></div><p style="text-align:center" data-s>Começando…</p>');
    try {
      const rig = await Montar.build(Studio.P.id, st.ref, st.parts, t => { const s = b.body && $('[data-s]', b.body); if (s) s.textContent = t; });
      rig.name = st.ref.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').slice(0, 30) || 'Personagem';
      b.close(); this.placeRig(rig); this.setMode('montar');
      UI.toast(`Boneco montado com ${rig.nodes.length} partes. Confira os pivôs no modo <b>Montar</b> e depois aperte Tab para animar.`, { kind: 'ok', time: 6000 });
    } catch (e) { b.close(); UI.modal({ title: 'Não consegui montar', icon: 'alert', kind: 'danger', body: `<p>${esc(e.message || e)}</p>`, buttons: [{ label: 'Ok', kind: 'primary' }] }); }
  },
  async importPNG(pre) {
    if (!Studio.P) return;
    const st = { poses: pre ? [...pre] : [], talk: [], mouths: [], eyes: [] };
    const body = h(`<div><p><b>Poses / expressões</b> (imagens inteiras do personagem). Arrastar o personagem com a <b>pose inteligente</b> ligada troca para a pose mais parecida com o movimento.</p><div class="import-zone" data-z="poses">${ic('image', 20)}<b data-l="poses"></b><small>Várias de uma vez</small></div>
      <p>Opcional — escolha o que você tiver:</p>
      <div class="grid2"><div class="import-zone" data-z="talk" title="Mesmas poses com a boca aberta (mesmo nome + 'falando' ou 'aberta')">${ic('mic', 18)}<b data-l="talk"></b><small>versões "falando"</small></div>
      <div class="import-zone" data-z="mouths">${ic('mic', 18)}<b data-l="mouths"></b><small>bocas soltas (fechada, aberta…)</small></div>
      <div class="import-zone" data-z="eyes" style="grid-column:1/-1">${ic('eye', 18)}<b data-l="eyes"></b><small>olhos soltos (aberto, fechado…)</small></div></div>
      <div class="an-perm">${ic('info', 12)} Nada é recortado nem alterado nas imagens.</div></div>`);
    const names = { poses: 'Escolher as poses', talk: 'Poses falando', mouths: 'Bocas', eyes: 'Olhos' };
    const lab = () => Object.keys(names).forEach(k => $(`[data-l=${k}]`, body).textContent = st[k].length ? `✓ ${st[k].length} ${names[k].toLowerCase()}` : names[k]);
    Object.keys(names).forEach(k => $(`[data-z=${k}]`, body).onclick = async () => { const f = await pickFiles('image/*', true); if (f.length) { st[k] = f; lab(); } });
    lab();
    const ok = await UI.modal({ title: 'PNGtuber', icon: 'image', width: 560, body, cancelValue: false, buttons: [{ label: 'Cancelar', value: false }, { label: 'Criar personagem', kind: 'primary', onClick: () => { if (!st.poses.length) { UI.toast('Escolha pelo menos uma imagem.', { kind: 'warn' }); return false; } return true; } }] });
    if (!ok) return;
    const b = UI.busy('Criando o PNGtuber…', '<div class="spinner"></div>');
    try {
      const pid = Studio.P.id, add = async f => { const rt = await Assets.addBlob(f, f.name, pid, 'image'); return { asset: rt.meta.id, name: f.name.replace(/\.[^.]+$/, ''), w: rt.img.naturalWidth, h: rt.img.naturalHeight }; };
      // se misturou as "falando" junto com as poses, separa pelo nome
      let poses = st.poses, talk = st.talk; if (!talk.length) { talk = poses.filter(f => /falan|aberta|open|talk|fala\b/i.test(f.name)); if (talk.length && talk.length < poses.length) poses = poses.filter(f => !talk.includes(f)); else talk = []; }
      const P0 = []; for (const f of poses) P0.push(await add(f)); const T0 = []; for (const f of talk) T0.push(await add(f));
      const Hh = Math.max(...P0.map(d => d.h)), Ww = Math.max(...P0.map(d => d.w));
      const rig = Rig.newRig({ name: poses[0].name.replace(/\.[^.]+$/, '').replace(/\b(pose|parad[oa]|frente|neutr[oa])\b/gi, '').trim().slice(0, 30) || 'PNGtuber', w: Ww, h: Hh }); rig.ox = Ww / 2; rig.oy = Hh;
      const body0 = Rig.newNode({ name: 'Corpo', role: 'inteiro', px: Ww / 2, py: Hh * .62 }); rig.nodes.push(body0);
      const put = d => ({ ...d, ox: round(-d.w / 2, 1), oy: round(Hh - body0.py - d.h, 1) });
      body0.drawings = P0.map(put);
      if (T0.length) { body0.talk = {}; for (const t of T0) { const base = Montar.baseName(t.name.replace(/[\s_-]*(falando|aberta|open|talk|fala)\b/i, '')); let j = P0.findIndex(p => Montar.baseName(p.name) === base); if (j < 0) j = P0.findIndex((p, k) => !(k in body0.talk)); if (j < 0) continue; body0.drawings.push(put(t)); body0.talk[j] = body0.drawings.length - 1; } }
      // bocas/olhos soltos: ficam no meio do rosto — você posiciona no modo Montar
      const over = async (files, name, role, y) => { if (!files.length) return; const n = Rig.newNode({ name, role, parent: body0.id, px: Ww / 2, py: Hh * y, z: 2 }); for (const f of files) { const d = await add(f); n.drawings.push({ ...d, ox: round(-d.w / 2, 1), oy: round(-d.h / 2, 1) }); } if (role === 'olho') n.drawings.unshift({ asset: null, name: 'aberto (do desenho)', ox: 0, oy: 0, w: 1, h: 1 }); if (role === 'boca' && !n.drawings.some(d => /abert|open/i.test(d.name))) n.drawings.push({ asset: null, name: 'aberta (do desenho)', ox: 0, oy: 0, w: 1, h: 1 }); rig.nodes.push(n); };
      await over(st.eyes, 'Olhos', 'olho', .2); await over(st.mouths, 'Boca', 'boca', .28);
      rig.nodes.forEach(n => n.tip = Rig.computeTip(n));
      b.close(); this.placeRig(rig);
      if (st.eyes.length || st.mouths.length) { this.setMode('montar'); UI.toast('Arraste a boca e os olhos até o lugar certo no rosto (modo Montar → ferramenta Mover parte).', { kind: 'ok', time: 7000 }); Studio.tool = 'parte'; this.tools(); }
      else UI.toast(`PNGtuber criado com ${P0.length} pose(s)${T0.length ? ` e ${T0.length} versão(ões) falando` : ''}.`, { kind: 'ok' });
    } catch (e) { b.close(); UI.toast(esc(e.message || e), { kind: 'err' }); }
  },
  async importFolha(file) {
    if (!Studio.P) return;
    if (!file) { const f = await pickFiles('image/*', false); if (!f.length) return; file = f[0]; }
    const b = UI.busy('Lendo a folha…', '<div class="spinner"></div><p style="text-align:center">Achando cada desenho e juntando em grupos…</p>');
    let img, P;
    try { img = new Image(); img.src = URL.createObjectURL(file); await img.decode(); P = await Folha.parse(img); } catch (e) { b.close(); return UI.toast('Não consegui ler: ' + esc(e.message || e), { kind: 'err' }); }
    b.close();
    if (!P.groups.length) return UI.toast('Não achei desenhos nessa imagem.', { kind: 'warn' });
    const kk = 1, body = h(`<div><div class="fl-wrap"><div class="fl-img"><img src="${img.src}"></div><div><div class="btn-row"><button class="btn sm ai-on" data-a="ai">${ic('sparkles', 12)} A IA diz o que é cada grupo</button></div><div class="fl-list"></div></div></div>
      <div class="an-perm">${ic('alert', 12)} Para montar, os desenhos marcados serão <b>recortados</b> da folha (cópias — a folha original não muda). Nada é redesenhado.</div></div>`);
    const imgEl = $('.fl-img img', body), boxes = $('.fl-img', body), list = $('.fl-list', body);
    let sel = -1;
    const paint = () => {
      $$('.fl-box', boxes).forEach(x => x.remove()); list.innerHTML = '';
      const k = imgEl.clientWidth / P.W || 1;
      P.groups.forEach((g, i) => {
        const [x0, y0, x1, y1] = g.box, bx = h(`<div class="fl-box ${g.tipo === 'ignorar' ? 'ign' : ''} ${i === sel ? 'on' : ''}" style="left:${x0 * k}px;top:${y0 * k}px;width:${(x1 - x0) * k}px;height:${(y1 - y0) * k}px"><b>${i + 1}</b></div>`);
        bx.onclick = () => { sel = i; paint(); list.children[i]?.scrollIntoView({ block: 'nearest' }); }; boxes.appendChild(bx);
        const row = h(`<div class="fl-g ${i === sel ? 'on' : ''}"><div class="fl-h"><b>${i + 1}</b><select>${Object.entries(FOLHA_TIPOS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div><div class="fl-h" style="margin-top:4px"><input type="text" value="${esc(g.nome)}"><small style="color:var(--tx3)">${g.items.length} des.</small>${i ? `<button class="ibtn xs" data-join title="Juntar com o grupo ${i} (mesma parte, mais desenhos)">${ic('up', 12)}</button>` : ''}</div><div class="fl-mini"></div></div>`);
        $('select', row).value = g.tipo; $('select', row).onchange = e => { g.tipo = e.target.value; paint(); }; $('input', row).onchange = e => g.nome = e.target.value;
        row.onclick = e => { if (e.target.closest('select,input,button')) return; sel = i; paint(); };
        const jb = $('[data-join]', row); if (jb) jb.onclick = () => { const a = P.groups[i - 1]; a.items.push(...g.items); if (g.nomes || a.nomes) a.nomes = [...(a.nomes || a.items.slice(0, a.items.length - g.items.length).map((_, k) => `${a.nome} ${k + 1}`)), ...(g.nomes || g.items.map((_, k) => `${g.nome} ${k + 1}`))]; a.box = [Math.min(a.box[0], g.box[0]), Math.min(a.box[1], g.box[1]), Math.max(a.box[2], g.box[2]), Math.max(a.box[3], g.box[3])]; P.groups.splice(i, 1); sel = i - 1; paint(); };
        for (const it of g.items.slice(0, 10)) { const [a, bb, c, d] = it.box, w = c - a + 1, hh = d - bb + 1, cv = document.createElement('canvas'), s = 34 / hh; cv.width = Math.max(4, Math.round(w * s)); cv.height = 34; cv.getContext('2d').drawImage(img, a, bb, w, hh, 0, 0, cv.width, 34); $('.fl-mini', row).appendChild(cv); }
        list.appendChild(row);
      });
    };
    const ok = await UI.modal({ title: `Folha de modelo — ${P.groups.length} grupos`, icon: 'grid', width: 1060, body, sticky: true, cancelValue: false, onOpen: a => {
      imgEl.onload = paint; if (imgEl.complete) setTimeout(paint, 30);
      $('[data-a=ai]', body).onclick = async e => { const bt = e.currentTarget; bt.disabled = true; bt.innerHTML = '<span class="tl-spin"></span> Olhando a folha…'; try { const n = await Folha.askAI(img, P); UI.toast(`A IA nomeou ${n} grupo(s). Confira antes de montar.`, { kind: 'ok' }); paint(); } catch (er) { UI.toast(esc(er.message || er), { kind: 'warn', time: 6000 }); } bt.disabled = false; bt.innerHTML = ic('sparkles', 12) + ' A IA diz o que é cada grupo'; };
    }, buttons: [{ label: 'Cancelar', value: false }, { label: 'Recortar e montar', kind: 'primary', onClick: () => { if (!P.groups.some(g => g.tipo !== 'ignorar')) { UI.toast('Diga o que é pelo menos um grupo (ou use a IA).', { kind: 'warn' }); return false; } return true; } }] });
    if (!ok) return;
    const go = await UI.confirm({ title: 'Posso recortar?', icon: 'alert', msg: `Vou recortar <b>${P.groups.filter(g => g.tipo !== 'ignorar').reduce((a, g) => a + g.items.length, 0)}</b> desenhos da folha como imagens novas (com fundo transparente). A folha original <b>não muda</b>. Depois você ajusta a montagem no modo Montar.`, ok: 'Pode recortar' });
    if (!go) return;
    const bb = UI.busy('Montando pela folha…', '<div class="spinner"></div><p style="text-align:center" data-s></p>');
    try {
      const rig = await Folha.buildRig(Studio.P.id, P, P.groups, t => { const s = bb.body && $('[data-s]', bb.body); if (s) s.textContent = t; });
      rig.name = file.name.replace(/\.[^.]+$/, '').slice(0, 30);
      bb.close(); this.placeRig(rig); this.setMode('montar');
      UI.toast(rig.nodes.length > 1 ? 'Boneco montado num esqueleto padrão. Encaixe as partes no modo Montar (arraste) e depois anime.' : 'Personagem criado com os desenhos da folha. Ligue a pose inteligente e arraste para trocar.', { kind: 'ok', time: 7000 });
    } catch (e) { bb.close(); UI.toast(esc(e.message || e), { kind: 'err' }); }
  },
  async addPart() {
    const r = Studio.selRig; if (!r) return UI.toast('Selecione um personagem.', { kind: 'warn' });
    const fs = await pickFiles('image/*', true); if (!fs.length) return;
    const par = Studio.selNode || Rig.roots(r)[0];
    for (const f of fs) { const rt = await Assets.addBlob(f, f.name, Studio.P.id, 'image'), w = rt.img.naturalWidth, hh = rt.img.naturalHeight, nm = f.name.replace(/\.[^.]+$/, ''); const n = Rig.newNode({ name: nm, parent: par?.id || null, px: par ? par.px : r.w / 2, py: par ? par.py : r.h / 2, z: (par?.z ?? 0) + .5 }); n.drawings = [{ asset: rt.meta.id, name: nm, ox: -w / 2, oy: -hh / 2, w, h: hh }]; const def = Roles.def(n.role); n.limit = def?.[3] ? [...def[3]] : null; n.tip = Rig.computeTip(n); r.nodes.push(n); }
    [...r.nodes].sort((a, b) => a.z - b.z).forEach((x, i) => x.z = i);
    Studio.commit('Parte adicionada'); this.setMode('montar'); Studio.tool = 'parte'; this.tools(); UI.toast('Arraste a parte nova até o lugar e ajuste o pivô.', { kind: 'ok', time: 4000 });
  },
  async addDrawing(n) {
    const fs = await pickFiles('image/*', true); if (!fs.length) return; const d0 = n.drawings.find(d => d.asset);
    for (const f of fs) { const rt = await Assets.addBlob(f, f.name, Studio.P.id, 'image'), w = rt.img.naturalWidth, hh = rt.img.naturalHeight; const cx = d0 ? d0.ox + d0.w / 2 : 0, cy = d0 ? d0.oy + d0.h / 2 : 0; n.drawings.push({ asset: rt.meta.id, name: f.name.replace(/\.[^.]+$/, ''), ox: round(cx - w / 2, 1), oy: round(cy - hh / 2, 1), w, h: hh }); }
    n._mk = null; Studio.commit('Desenho adicionado');
  },
  dupRig() { const r = Studio.selRig; if (!r) return; let t = JSON.stringify(r); const map = {}; for (const n of r.nodes) map[n.id] = uid('n_'); for (const [a, b] of Object.entries(map)) t = t.split(a).join(b); const c = JSON.parse(t); c.id = uid('r_'); c.name = r.name + ' (cópia)'; c.stage.X += 200; Studio.P.rigs.push(c); Studio.selRig = c; Studio.commit('Personagem duplicado'); },
  flipRig() { const r = Studio.selRig; if (!r) return; Rig.setKey(r, '@', 'F', Studio.f, Rig.stageAt(r, Studio.f).F < 0 ? 1 : -1, 'hold'); Studio.commit('Personagem virado'); },
  async delRig() { const r = Studio.selRig; if (!r || !await UI.confirm({ title: 'Apagar personagem?', msg: `"<b>${esc(r.name)}</b>" e a animação dele saem da cena.`, ok: 'Apagar', danger: true })) return; Studio.P.rigs.splice(Studio.P.rigs.indexOf(r), 1); Studio.selRig = Studio.P.rigs[0] || null; Studio.selNode = null; Studio.commit('Personagem apagado'); },
  async clearAnim() { const r = Studio.selRig; if (!r || !await UI.confirm({ title: 'Limpar a animação?', msg: `Todos os keyframes de "<b>${esc(r.name)}</b>" serão apagados (dá para desfazer).`, ok: 'Limpar', danger: true })) return; r.keys = {}; Studio.commit('Animação limpa'); },

  /* ---------- som ---------- */
  async importAudio(kind, pre) {
    const fs = pre || await pickFiles('audio/*', true); if (!fs.length) return; const P = Studio.P;
    for (const f of fs) { const rt = await Assets.importFile(f, P.id); if (!rt.buffer) { UI.toast('Não consegui ler ' + esc(f.name), { kind: 'err' }); continue; } P.audio.push({ asset: rt.meta.id, start: kind === 'voz' ? Studio.f : 0, offset: 0, vol: kind === 'musica' ? 45 : kind === 'efeito' ? 70 : 100, kind, muted: false }); const need = Math.ceil((Studio.f + rt.buffer.duration * P.settings.fps)); if (kind === 'voz' && need > P.frames) P.frames = need + Math.round(P.settings.fps * .5); }
    this.tab = 'som'; Studio.commit('Áudio adicionado');
  },
  needRig() { const r = Studio.selRig; if (!r) UI.toast('Traga um personagem primeiro.', { kind: 'warn' }); return r; },
  needVoice() { if (!Studio.P.audio.some(a => a.kind !== 'musica' && !a.muted)) { UI.toast('Coloque a voz na aba Som primeiro.', { kind: 'warn' }); return false; } return true; },
  lipsync() { const r = this.needRig(); if (!r || !this.needVoice()) return; const n = Acting.lipsync(Studio.P, r, Acting.analyze(Studio.P)); if (!n) return UI.toast('Este personagem não tem boca com troca de desenho (nem versão "falando").', { kind: 'warn', time: 5000 }); Studio.commit(`Boca pela voz: ${n} trocas (em 2s)`); UI.toast(`Boca animada pela voz (${n} trocas, de 2 em 2 quadros).`, { kind: 'ok' }); },
  blinks() { const r = this.needRig(); if (!r) return; const n = Acting.blinks(Studio.P, r); if (!n) return UI.toast('Este personagem não tem olho com desenho fechado.', { kind: 'warn' }); Studio.commit(`${n} piscadas`); UI.toast(`${n} piscadas, a cada 2–5 s.`, { kind: 'ok' }); },

  /* ---------- IA ---------- */
  async iaModal() {
    const r = this.needRig(); if (!r) return; const P = Studio.P;
    const body = h(`<div><p>A IA anima <b>${esc(r.name)}</b> pela voz no estilo <b>Disney TV</b> (The Owl House, Amphibia): poses fortes trocadas nas palavras de ênfase, antecipação curta, passar do ponto e assentar, cabeça liderando, cabelo seguindo, piscadas nas viradas e boca em 2s. <b>Sem tremedeira.</b></p>
      <div class="fgrid"><label class="field">Intensidade<select data-k="int"><option value="calmo">Calma</option><option value="normal" selected>Normal</option><option value="expressivo">Expressiva (comédia)</option></select></label>
      <label class="field">Trecho<select data-k="tr"><option value="tudo">A animação inteira</option><option value="daqui">Do quadro atual em diante</option></select></label>
      <label class="fcheck"><input type="checkbox" data-k="boca" checked> Boca pela voz</label><label class="fcheck"><input type="checkbox" data-k="pisc" checked> Piscadas</label>
      <label class="field full">Pedido para a IA (opcional)<textarea rows="3" data-k="ped" placeholder="Ex.: ela começa animada, fica preocupada no meio e termina rindo; aponta para a câmera em 'você'"></textarea></label></div>
      ${Object.keys(r.poses).length < 3 ? `<div class="hint">${ic('info', 12)} Dica: salve 3–6 poses (aba Poses) e a IA alterna entre elas. Sem poses, ela usa gestos pequenos e seguros.</div>` : ''}
      ${!P.audio.some(a => a.kind !== 'musica') ? `<div class="an-perm">${ic('alert', 12)} Coloque a voz na aba Som — a IA atua pela fala.</div>` : ''}
      <div class="an-perm">${ic('info', 12)} Se a IA precisar mudar alguma imagem (redesenhar, recortar, espelhar), ela <b>pergunta antes</b>. Nada é alterado sem você aceitar.</div></div>`);
    const v = await UI.modal({ title: 'IA de animação', icon: 'sparkles', width: 600, body, cancelValue: null, buttons: [{ label: 'Cancelar', value: null }, { label: 'Atuação automática (sem internet)', value: 'auto' }, { label: 'Pedir para a IA', kind: 'primary ai-btn', value: 'ai' }] });
    if (!v) return; if (!this.needVoice()) return;
    const o = { intensidade: $('[data-k=int]', body).value, de: $('[data-k=tr]', body).value === 'daqui' ? Studio.f : 0, piscar: $('[data-k=pisc]', body).checked, boca: $('[data-k=boca]', body).checked }, pedido = $('[data-k=ped]', body).value.trim();
    if (v === 'auto') { const res = Acting.perform(P, r, o); Studio.commit('Atuação automática'); UI.toast(`Pronto: ${res.frases} frase(s), ${res.acentos} ênfase(s), ${res.piscadas} piscada(s), ${res.expressoes || 0} expressão(ões)${res.bocas ? ', boca pela voz' : ''}. Ajuste à mão na timeline.`, { kind: 'ok', time: 6000 }); return; }
    const b = UI.busy('A IA está atuando…', '<div class="spinner"></div><p style="text-align:center" data-s>Ouvindo a fala e planejando as poses…</p>');
    try {
      const { plano, A } = await Acting.askAI(P, r, pedido + (o.intensidade !== 'normal' ? `\nIntensidade: ${o.intensidade}.` : ''));
      b.close();
      if (o.boca) Acting.lipsync(P, r, A, o.de, P.frames); if (o.piscar) Acting.blinks(P, r, o.de, P.frames);
      const res = await Acting.applyPlan(P, r, plano, A); Studio.commit('Atuação da IA');
      UI.modal({ title: 'A IA animou', icon: 'check', kind: 'ok', body: `<p>${esc(res.resumo || 'Atuação aplicada.')}</p><p>${res.n} ação(ões) viraram keyframes — dá para ajustar na timeline ou desfazer (Ctrl+Z).</p>`, buttons: [{ label: 'Ok', kind: 'primary' }] });
    } catch (e) { b.close(); UI.modal({ title: 'A IA não respondeu', icon: 'alert', kind: 'warn', body: `<p>${esc(e.message || e)}</p><p>Quer usar a <b>atuação automática</b> (funciona sem internet)?</p>`, cancelValue: false, buttons: [{ label: 'Não', value: false }, { label: 'Usar automática', kind: 'primary', value: true }] }).then(ok => { if (ok) { Acting.perform(P, r, o); Studio.commit('Atuação automática'); } }); }
  },

  /* ---------- arquivos ---------- */
  async saveToon() {
    const P = Studio.P; if (!P) return; await Studio.save(true);
    const b = UI.busy('Salvando .toon…', '<div class="spinner"></div><p style="text-align:center">Juntando desenhos e áudios…</p>');
    try { const blob = await ToonFile.build(P, [], null, { thumb: Studio.thumb() }); b.close(); downloadBlob(blob, safeName(P.name) + '.toon'); UI.toast('Arquivo .toon salvo (abre aqui no estúdio ou pela tela inicial).', { kind: 'ok' }); }
    catch (e) { b.close(); UI.toast(esc(e.message || e), { kind: 'err' }); }
  },
  async openToon(file, fromStart) {
    if (!file) { const f = await pickFiles('.toon', false); if (!f.length) { if (fromStart && !Studio.P) this.startScreen(); return; } file = f[0]; }
    const b = UI.busy('Abrindo…', '<div class="spinner"></div>');
    try {
      const { project, thumb } = await ToonFile.read(file); b.close();
      if (project.kind !== 'anim') { await DB.put('projects', { id: project.id, name: project.name, created: project.created || Date.now(), modified: Date.now(), settings: project.settings, dur: Math.max(0, ...(project.clips || []).map(c => c.start + c.dur)), thumb, data: JSON.stringify(project) }); UI.toast('É um projeto do editor de vídeo — abrindo lá.', { time: 1500 }); setTimeout(() => location.href = 'index.html?p=' + encodeURIComponent(project.id), 600); return; }
      if (Studio.dirty) await Studio.save(true);
      await DB.put('projects', { id: project.id, kind: 'anim', name: project.name, created: project.created || Date.now(), modified: Date.now(), settings: project.settings, dur: project.frames / project.settings.fps, thumb, data: JSON.stringify(project) });
      await Studio.open(await DB.get('projects', project.id)); UI.toast(`"${esc(project.name)}" aberto`, { kind: 'ok' });
    } catch (e) { b.close(); UI.modal({ title: 'Não consegui abrir', icon: 'alert', kind: 'danger', body: `<p>${esc(e.message || e)}</p>`, buttons: [{ label: 'Ok', kind: 'primary' }] }); }
  },
  // cria um projeto do editor com esta animação como um objeto "animação" (continua editável e leva o som)
  async toEditor() {
    const A = Studio.P; if (!A) return; await Studio.save(true);
    const o = await UI.modal({ title: 'Levar para o editor de vídeo', icon: 'film', body: `<p>Cria um projeto no editor com esta animação (como um objeto que dá para mover, cortar, pôr efeitos e legendas) e os áudios.</p><label class="fcheck"><input type="checkbox" data-k="tr"> Fundo transparente (só os personagens — para pôr em cima de outros cenários)</label>`, cancelValue: null, buttons: [{ label: 'Cancelar', value: null }, { label: 'Criar projeto no editor', kind: 'primary', collect: a => ({ tr: $('[data-k=tr]', a.body).checked }) }] });
    if (!o) return;
    const b = UI.busy('Criando projeto…', '<div class="spinner"></div>');
    try {
      const S = A.settings, fps = S.fps, dur = A.frames / fps, E = App.newProject({ name: A.name + ' (vídeo)', w: S.w, h: S.h, fps: fps >= 24 ? (fps === 24 ? 30 : fps) : 30, bg: S.bg });
      // copia as mídias para o projeto novo
      let text = JSON.stringify(A); const recs = await DB.byIndex('assets', 'project', A.id), ids = {};
      for (const r of recs) { const nid = uid('a_'); ids[r.id] = nid; text = text.split(r.id).join(nid); await DB.put('assets', { ...r, id: nid, projectId: E.id }); }
      const A2 = JSON.parse(text), vis = E.tracks.find(t => t.type === 'visual'), aud = E.tracks.filter(t => t.type === 'audio');
      const c = App.makeClip.call({ project: E }, 'anim', { start: 0, dur, name: A.name }); c.trackId = vis.id; c.anim = { P: { settings: A2.settings, frames: A2.frames, rigs: A2.rigs, camera: A2.camera, bgAsset: A2.bgAsset }, transparent: o.tr };
      E.clips.push(c);
      A2.audio.forEach((a, i) => { const m = recs.find(r => ids[r.id] === a.asset); const ac = App.makeClip.call({ project: E }, 'audio', { start: a.start / fps, dur: (m?.dur || 1) - (a.offset || 0), offset: a.offset || 0, assetId: a.asset, name: (m?.name || 'Áudio').replace(/\.[^.]+$/, '') }); ac.trackId = (aud[i % aud.length] || aud[0]).id; ac.volume = a.vol ?? 100; ac.muted = !!a.muted; E.clips.push(ac); });
      E.bin = Object.values(ids);
      await DB.put('projects', { id: E.id, name: E.name, created: E.created, modified: E.modified, settings: E.settings, dur, data: JSON.stringify(E) });
      b.close(); location.href = 'index.html?p=' + encodeURIComponent(E.id);
    } catch (e) { b.close(); UI.toast(esc(e.message || e), { kind: 'err' }); }
  },

  /* ---------- exportar ---------- */
  async exportModal() {
    const P = Studio.P; if (!P) return;
    const o = await UI.modal({ title: 'Exportar vídeo', icon: 'download', body: `<div class="fgrid"><label class="field">Qualidade<select data-k="q"><option value="1">Tamanho total (${P.settings.w}×${P.settings.h})</option><option value=".5">Metade (mais rápido)</option></select></label><label class="field">Trecho<select data-k="tr"><option value="all">Tudo (${fmtTime(P.frames / P.settings.fps, P.settings.fps, false)})</option></select></label></div>`, cancelValue: null, buttons: [{ label: 'Cancelar', value: null }, { label: 'Exportar MP4', kind: 'primary', collect: a => ({ q: +$('[data-k=q]', a.body).value }) }] });
    if (!o) return;
    if (Studio.playing) Studio.stop();
    const pr = Exporter.progressModal ? Exporter.progressModal('Criando o MP4…', false, true) : null;
    try {
      const blob = await AnimExport.mp4(P, { q: o.q, onProgress: (p, msg) => pr?.set(p, msg, 'MP4 · H.264 + AAC'), cancelled: () => pr?.cancelled });
      pr?.close(); if (!blob) return;
      downloadBlob(blob, safeName(P.name) + (blob.type.includes('webm') ? '.webm' : '.mp4')); UI.toast(blob.type.includes('webm') ? 'Este navegador não tem H.264: saiu em WebM.' : 'MP4 pronto!', { kind: 'ok' });
    } catch (e) { pr?.close(); UI.modal({ title: 'Não deu para exportar', icon: 'alert', kind: 'danger', body: `<p>${esc(e.message || e)}</p>`, buttons: [{ label: 'Ok', kind: 'primary' }] }); }
  },
};

/* ---------- exportação (MP4 H.264 + AAC; sem H.264 → WebM em tempo real) ---------- */
const AnimExport = {
  async mixAudio(P, sr = 48000) {
    const fps = P.settings.fps, dur = P.frames / fps, ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(dur * sr)), sr);
    for (const a of P.audio || []) { if (a.muted) continue; const buf = Assets.audioBuffer(a.asset, ctx); if (!buf) continue; const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; g.gain.value = (a.vol ?? 100) / 100; s.connect(g).connect(ctx.destination); s.start(a.start / fps, a.offset || 0); }
    return ctx.startRendering();
  },
  async mp4(P, o = {}) {
    const q = o.q || 1, W = Math.max(2, Math.round(P.settings.w * q / 2) * 2), H = Math.max(2, Math.round(P.settings.h * q / 2) * 2), fps = P.settings.fps, N = P.frames;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const hasSound = (P.audio || []).some(a => !a.muted);
    const vcfg = await Exporter.pickH264(W, H, fps, Math.round(W * H * fps * .12)), acfg = hasSound ? await Exporter.pickAAC(48000) : null;
    if (!vcfg || (hasSound && !acfg)) return this.webm(P, cv, o);
    const mux = new Mp4Mux({ video: { width: W, height: H, fps }, audio: acfg ? { sampleRate: acfg.sampleRate, channels: 2 } : null });
    const bytes = d => d instanceof Uint8Array ? d : new Uint8Array(d);
    let err = null;
    if (acfg) {
      o.onProgress?.(0, 'Misturando o áudio…');
      const buf = await this.mixAudio(P, acfg.sampleRate);
      const ae = new AudioEncoder({ output: (ch, meta) => { if (meta?.decoderConfig?.description) mux.setAudioConfig(bytes(meta.decoderConfig.description)); const d = new Uint8Array(ch.byteLength); ch.copyTo(d); mux.addAudio(d, Math.round((ch.duration || 0) * acfg.sampleRate / 1e6) || 1024); }, error: e => err = e });
      ae.configure(acfg); const L = buf.getChannelData(0), R = buf.getChannelData(1), step = 4800;
      for (let i = 0; i < buf.length; i += step) { const n = Math.min(step, buf.length - i), data = new Float32Array(n * 2); data.set(L.subarray(i, i + n), 0); data.set(R.subarray(i, i + n), n); const ad = new AudioData({ format: 'f32-planar', sampleRate: acfg.sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / acfg.sampleRate * 1e6), data }); ae.encode(ad); ad.close(); if (ae.encodeQueueSize > 20) await Exporter.yieldNow(); }
      await ae.flush(); ae.close(); if (err) throw err;
    }
    for (const cfg of vcfg) {
      err = null; mux.v = []; mux.vKeys = []; mux.avcC = null;
      const ve = new VideoEncoder({ output: (ch, meta) => { if (meta?.decoderConfig?.description) mux.setVideoConfig(bytes(meta.decoderConfig.description)); const d = new Uint8Array(ch.byteLength); ch.copyTo(d); mux.addVideo(d, ch.type === 'key'); }, error: e => err = e });
      try {
        ve.configure(cfg);
        for (let f = 0; f < N; f++) {
          if (o.cancelled?.()) { ve.close(); return null; }
          AnimRender.frame(g, P, f, { q });
          const vf = new VideoFrame(cv, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) }); ve.encode(vf, { keyFrame: f % (fps * 2) === 0 }); vf.close();
          while (ve.encodeQueueSize > 4) { await Exporter.yieldNow(); if (err) throw err; }
          if (f % 4 === 0) o.onProgress?.((f + 1) / N, `Quadro <b>${f + 1}</b> de ${N}`);
        }
        await ve.flush(); ve.close(); if (err) throw err;
        return mux.finish();
      } catch (e) { try { ve.close(); } catch { } if (cfg === vcfg[vcfg.length - 1]) throw e; }
    }
  },
  async webm(P, cv, o) {
    const fps = P.settings.fps, N = P.frames, g = cv.getContext('2d'), stream = cv.captureStream(0), track = stream.getVideoTracks()[0];
    const ctx = Assets.ctx(), dest = ctx.createMediaStreamDestination(); const buf = (P.audio || []).some(a => !a.muted) ? await this.mixAudio(P, ctx.sampleRate) : null;
    if (buf) dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm', videoBitsPerSecond: 8e6 }), chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(r => rec.onstop = r); rec.start(500);
    let src; if (buf) { src = ctx.createBufferSource(); src.buffer = buf; src.connect(dest); src.start(); }
    const t0 = performance.now();
    for (let f = 0; f < N; f++) { if (o.cancelled?.()) break; AnimRender.frame(g, P, f, { q: cv.width / P.settings.w }); track.requestFrame?.(); o.onProgress?.((f + 1) / N, `Gravando quadro ${f + 1} de ${N} (tempo real)`); const wait = t0 + (f + 1) * 1000 / fps - performance.now(); if (wait > 0) await sleep(wait); }
    rec.stop(); try { src?.stop(); } catch { } await done;
    return new Blob(chunks, { type: 'video/webm' });
  },
};
