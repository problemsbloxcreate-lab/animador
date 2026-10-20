/* ===================== timeline.js — linha do tempo ===================== */
'use strict';

const Timeline = {
  pps: 90, el: null, scroll: null,
  init() {
    const el = this.el = $('#timeline');
    el.innerHTML = `
      <div class="tl-toolbar">
        <div class="seg"><button class="ibtn" data-tool="select" title="Selecionar e mover (V)">${ic('cursor', 15)}</button><button class="ibtn" data-tool="razor" title="Lâmina: clique num clipe para cortar (C)">${ic('scissors', 15)}</button></div>
        <button class="ibtn" id="tl-snap" title="Grudar nas bordas e no cursor (N)">${ic('magnet', 15)}</button>
        <button class="ibtn" id="tl-ripple" title="Modo cascata: ao excluir, os clipes seguintes andam para fechar o espaço">${ic('ripple', 15)}</button>
        <div class="vsep"></div>
        <button class="btn sm" id="tl-sort" title="Organizar: efeitos em cima, vídeos no meio, áudios embaixo (igual DaVinci)">${ic('layers', 13)} Organizar faixas</button>
        <button class="btn sm" id="tl-heights" title="Deixar as faixas mais altas ou mais baixas (H)">${ic('sliders', 13)} Altura</button>
        <div class="vsep"></div>
        <button class="ibtn" id="tl-split" title="Dividir no cursor (S)">${ic('split', 15)}</button>
        <button class="ibtn" id="tl-del" title="Excluir selecionados (Del)">${ic('trash', 15)}</button>
        <button class="ibtn" id="tl-key" title="Keyframe de posição/escala/rotação no cursor (K)">${ic('diamond', 15)}</button>
        <button class="ibtn" id="tl-marker" title="Adicionar marcador (M)">${ic('marker', 15)}</button>
        <button class="btn sm" id="tl-detach" title="Separar o áudio do vídeo selecionado">${ic('music', 13)} Separar áudio</button>
        <button class="btn sm" id="tl-rec" title="Gravar voz a partir do cursor (R)"><span style="color:#ff5470">${ic('rec', 12)}</span> Gravar</button>
        <div class="sp"></div>
        <span class="tl-time" id="tl-time">00:00:00</span>
        <button class="ibtn" id="tl-zout" title="Diminuir zoom (-)">${ic('zoomOut', 15)}</button>
        <input type="range" class="tl-zoom" id="tl-zoom" min="0" max="1000" title="Zoom da linha do tempo (Ctrl + rodinha)">
        <button class="ibtn" id="tl-zin" title="Aumentar zoom (+)">${ic('zoomIn', 15)}</button>
        <button class="btn sm" id="tl-fit" title="Ver o projeto inteiro (F)">Ajustar</button>
      </div>
      <div class="tl-scroll" id="tl-scroll"><div class="tl-inner" id="tl-inner"></div></div>
      <div class="tl-zbar" id="tl-zbar" title="Arraste a barra para andar · puxe as pontas para dar zoom"><div class="tl-zthumb" id="tl-zthumb"><i class="zh" data-z="l" title="Puxe para dar zoom">${ic('left', 10, 3)}</i><span></span><i class="zh" data-z="r" title="Puxe para dar zoom">${ic('right', 10, 3)}</i></div></div>`;
    this.scroll = $('#tl-scroll');
    $$('[data-tool]', el).forEach(b => b.onclick = () => this.setTool(b.dataset.tool));
    $('#tl-snap').onclick = () => this.toggleSnap();
    $('#tl-ripple').onclick = () => { App.ripple = !App.ripple; $('#tl-ripple').classList.toggle('on', App.ripple); UI.toast(App.ripple ? 'Modo cascata ligado: excluir fecha o espaço' : 'Modo cascata desligado', { time: 2000 }); };
    $('#tl-sort').onclick = () => Actions.sortTracks();
    $('#tl-heights').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); UI.ctx(r.left, r.bottom + 4, [{ head: 'Altura de todas as faixas' }, ...[['Pequena', 40], ['Média', 64], ['Grande', 100], ['Bem grande', 150], ['Enorme', 220]].map(([l, v]) => ({ label: l, action: () => this.setAllHeights(v) })), '-', { label: 'Dica: puxe a borda de baixo do nome da faixa para mudar só ela' }]); };
    $('#tl-detach').onclick = () => { const v = App.selected().filter(c => c.type === 'video'); if (!v.length) return UI.toast('Selecione um clipe de vídeo para separar o áudio', { kind: 'warn' }); v.forEach(c => Actions.detachAudio(c)); };
    $('#tl-rec').onclick = () => LibUI.quickRecord();
    $('#tl-split').onclick = () => Actions.split(); $('#tl-del').onclick = () => Actions.deleteSel();
    $('#tl-key').onclick = () => Actions.keyAll(); $('#tl-marker').onclick = () => Actions.addMarker();
    try { const w = +localStorage.getItem('ps-hw'); if (w) this.hwv = w; } catch { }
    el.style.setProperty('--hw', this.hw() + 'px');
    $('#tl-zin').onclick = () => this.zoomBy(1.3); $('#tl-zout').onclick = () => this.zoomBy(1 / 1.3); $('#tl-fit').onclick = () => this.fit();
    $('#tl-zoom').oninput = e => this.setZoom(this.sliderToPps(+e.target.value));
    this.scroll.addEventListener('scroll', () => { this.drawRuler(); this.wavesSoon(); this.updateZbar(); });
    this.initZbar();
    this.scroll.addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.setZoom(this.pps * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX);
      } else if (e.shiftKey) { e.preventDefault(); this.scroll.scrollLeft += e.deltaY; }
    }, { passive: false });
    new ResizeObserver(() => this.drawRuler()).observe(this.scroll);
    this.setTool(App.tool); $('#tl-snap').classList.toggle('on', App.snap); $('#tl-ripple').classList.toggle('on', App.ripple);
    try { const z = +localStorage.getItem('ps-pps'); if (z) this.pps = z; } catch { }
    $('#tl-zoom').value = this.ppsToSlider(this.pps);
  },
  hwv: 200,
  hw() { return this.hwv; },
  sliderToPps(v) { return 4 * Math.pow(400, v / 1000); },
  ppsToSlider(p) { return Math.log(p / 4) / Math.log(400) * 1000; },
  // zoom mantendo o cursor vermelho (e o que está embaixo dele) no mesmo lugar da tela
  setZoom(p, mouseX) {
    p = clamp(p, 4, 1600);
    const sc = this.scroll, viewW = sc.clientWidth - this.hw();
    let anchorT, anchorX;
    const phX = App.t * this.pps - sc.scrollLeft;
    if (phX >= 0 && phX <= viewW) { anchorT = App.t; anchorX = phX; }
    else if (mouseX !== undefined) { const r = sc.getBoundingClientRect(); anchorX = mouseX - r.left - this.hw(); anchorT = (sc.scrollLeft + anchorX) / this.pps; }
    else { anchorX = viewW / 2; anchorT = (sc.scrollLeft + anchorX) / this.pps; }
    this.pps = p; $('#tl-zoom').value = this.ppsToSlider(p);
    this.render();
    sc.scrollLeft = Math.max(0, anchorT * p - anchorX);
    this.drawRuler(); this.drawWaves();
    try { localStorage.setItem('ps-pps', p); } catch { }
  },
  zoomBy(f) { this.setZoom(this.pps * f); },
  fit() { const d = Math.max(App.duration, 5); this.pps = clamp((this.scroll.clientWidth - this.hw() - 40) / d, 4, 1600); $('#tl-zoom').value = this.ppsToSlider(this.pps); this.render(); this.scroll.scrollLeft = 0; this.drawRuler(); this.drawWaves(); },
  RAZOR: `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round"><g><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/></g><g stroke="#fff" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/></g></svg>')}") 12 12`,
  setTool(t) {
    App.tool = t; $$('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    if (this.scroll) { this.scroll.classList.toggle('razor', t === 'razor'); this.scroll.style.setProperty('--razor', this.RAZOR); }
    if (t !== 'razor') this.showCut(null);
  },
  showCut(t) { const d = $('#tl-cut'); if (!d) return; if (t === null) { d.style.display = 'none'; return; } d.style.display = 'block'; d.style.left = this.tx(t) + 'px'; },
  setAllHeights(v) { App.project.tracks.forEach(t => t.h = t.type === 'fx' ? Math.max(36, Math.round(v * .7)) : v); App.commit('Altura das faixas alterada'); },
  cycleHeights() { const hs = [40, 64, 100, 150, 220], cur = Math.max(...App.project.tracks.filter(t => t.type !== 'fx').map(t => t.h), 40), i = hs.findIndex(x => x > cur); this.setAllHeights(hs[i < 0 ? 0 : i]); UI.toast('Altura das faixas: ' + hs[i < 0 ? 0 : i] + 'px (H para trocar)', { time: 1500 }); },
  toggleSnap() { App.snap = !App.snap; $('#tl-snap').classList.toggle('on', App.snap); UI.toast(App.snap ? 'Grudar ligado' : 'Grudar desligado', { time: 1500 }); },
  tx(t) { return this.hw() + t * this.pps; },

  /* ---------- desenho ---------- */
  render() {
    if (!this.el || !App.project) return;
    const p = App.project, inner = $('#tl-inner'), dur = Math.max(App.duration + 30, (this.scroll.clientWidth - this.hw()) / this.pps + 5);
    const W = Math.ceil(this.hw() + dur * this.pps);
    const st = this.scroll.scrollTop, sl = this.scroll.scrollLeft;
    let html = `<div class="tl-ruler-row" style="width:${W}px"><div class="tl-corner">${p.tracks.length} faixas · ${p.clips.length} clipes<div class="hw-rs" title="Arraste para mudar a largura dos nomes"></div></div><div class="tl-ruler-wrap"><canvas class="tl-ruler" id="tl-ruler" height="28"></canvas></div></div>`;
    html += `<div class="tl-addrow" style="width:${W}px"><div class="tl-thead"><button class="btn" data-add="visual" title="Nova faixa de vídeo/imagem (fica acima dos vídeos)">${ic('plus', 12)} Vídeo</button><button class="btn" data-add="fx" title="Nova faixa de efeitos para a tela toda (fica no topo)">${ic('plus', 12)} Efeitos</button></div><div class="tl-lane"></div></div>`;
    for (const tk of p.tracks) {
      const t = { visual: ['film', 't-visual'], audio: ['music', 't-audio'], fx: ['sparkles', 't-fx'] }[tk.type];
      const btns = [];
      if (tk.type !== 'audio') btns.push(`<button class="ibtn xs ${tk.hidden ? 'off' : ''}" data-tb="hidden" title="${tk.hidden ? 'Mostrar faixa' : 'Esconder faixa'}">${ic(tk.hidden ? 'eyeOff' : 'eye', 13)}</button>`);
      if (tk.type !== 'fx') btns.push(`<button class="ibtn xs ${tk.mute ? 'off' : ''}" data-tb="mute" title="${tk.mute ? 'Ativar som' : 'Silenciar faixa'}">${ic(tk.mute ? 'mute' : 'vol', 13)}</button>`);
      btns.push(`<button class="ibtn xs ${tk.solo ? 'on' : ''}" data-tb="solo" title="Solo: só esta faixa">${'<b style="font-size:10px">S</b>'}</button>`);
      btns.push(`<button class="ibtn xs ${tk.lock ? 'off' : ''}" data-tb="lock" title="${tk.lock ? 'Destravar' : 'Travar (impede edição)'}">${ic(tk.lock ? 'lock' : 'unlock', 13)}</button>`);
      html += `<div class="tl-row ${t[1]} ${tk.id === App.activeTrack ? 'active' : ''} ${tk.hidden ? 'hidden' : ''} ${tk.lock ? 'locked' : ''}" data-track="${tk.id}" style="height:${tk.h}px;width:${W}px">
        <div class="tl-thead" title="Arraste para mudar a ordem · clique duas vezes para renomear · botão direito para mais opções"><span class="th-ic">${ic(t[0], 14)}</span><span class="th-name">${esc(tk.name)}</span><div class="th-btns">${btns.join('')}</div><div class="th-rs" title="Arraste para mudar a altura"></div></div>
        <div class="tl-lane" data-lane="${tk.id}">${p.clips.filter(c => c.trackId === tk.id).map(c => this.clipHTML(c, tk)).join('')}${this.gapHTML(tk)}${this.recHTML(tk)}</div></div>`;
    }
    html += `<div class="tl-addrow" style="width:${W}px"><div class="tl-thead"><button class="btn" data-add="audio" title="Nova faixa de áudio (fica embaixo)">${ic('plus', 12)} Áudio</button></div><div class="tl-lane"></div></div>`;
    html += `<div class="tl-playhead" id="tl-ph"></div><div class="tl-dropline" id="tl-drop"></div><div class="tl-cut" id="tl-cut"></div>`;
    inner.style.width = W + 'px';
    inner.innerHTML = html;
    this.scroll.scrollTop = st; this.scroll.scrollLeft = sl;
    this.drawWaves(); this.bind(); this.drawRuler(); this.updatePlayhead(); this.updateZbar();
  },
  clipHTML(c, tk) {
    const x = c.start * this.pps, w = Math.max(3, c.dur * this.pps), sel = App.sel.has(c.id);
    const icn = { image: 'image', gif: 'gif', video: 'film', audio: 'music', text: 'text', shape: 'shapes', color: 'palette', fx: 'sparkles', anim: 'layers' }[c.type];
    const meta = c.assetId ? Assets.meta(c.assetId) : null;
    const name = c.name || meta?.name || c.type;
    let bg = '';
    if ((c.type === 'image' || c.type === 'gif') && meta?.thumb) bg = `style="background-image:url('${meta.thumb}')"`;
    if (c.type === 'video') { const rt = Assets.get(c.assetId); if (rt?.strip) { const hh = tk.h - 23, sw = rt.stripW * hh / 54; bg = `style="background-image:url('${rt.strip}');background-size:${sw * rt.stripN}px ${hh}px;background-repeat:repeat-x"`; } }
    const badges = [];
    if (c.anims?.length) badges.push(`<span class="cl-badge" title="Animações">${ic('jump', 10)} ${c.anims.length}</span>`);
    if (c.fx?.length) badges.push(`<span class="cl-badge" title="Efeitos">${ic('sparkles', 10)} ${c.fx.length}</span>`);
    if (c.speed && c.speed !== 1) badges.push(`<span class="cl-badge">${c.speed}x</span>`);
    if (c.muted) badges.push(`<span class="cl-badge">${ic('mute', 10)}</span>`);
    if (meta === undefined && c.assetId && !c.assetId.startsWith('snd:')) badges.push(`<span class="cl-badge" style="background:#a12">mídia faltando</span>`);
    const bars = [];
    (c.anims || []).forEach(a => bars.push(this.barHTML(c, a, 'anim')));
    (c.fx || []).forEach(f => bars.push(this.barHTML(c, f, 'fx')));
    const tri = c.trIn?.type ? `<div class="tr-in" data-tr="in" style="width:${Math.min(w / 2, c.trIn.dur * this.pps)}px" title="Transição de entrada: ${TRANS[c.trIn.type]?.name}"></div>` : '';
    const tro = c.trOut?.type ? `<div class="tr-out" data-tr="out" style="width:${Math.min(w / 2, c.trOut.dur * this.pps)}px" title="Transição de saída: ${TRANS[c.trOut.type]?.name}"></div>` : '';
    const kfs = KF.times(c).filter(t => t >= 0 && t <= c.dur).map(t => `<div class="kfd" data-kt="${t}" style="left:${t * this.pps}px" title="Keyframe em ${fmtSec(t)} · arraste para mudar o tempo · botão direito: opções"></div>`).join('');
    let sub = '';
    if (c.type === 'text') sub = esc((c.text.text || '').split('\n')[0].slice(0, 60));
    if (c.type === 'fx') sub = c.sfx?.target === 'next' ? 'só na faixa abaixo' : 'tela toda abaixo';
    const hasSnd = c.type === 'audio' || (c.type === 'video' && meta?.hasAudio && !c.muted);
    const wave = hasSnd || (c.type === 'video' && meta?.hasAudio) ? `<canvas class="clip-wave" data-wave="${c.id}"></canvas>` : '';
    const vol = c.volume ?? 100, volLine = hasSnd && !KF.has(c, 'volume') ? `<div class="vol-line" data-vol style="top:calc(17px + (100% - 21px) * ${(1 - vol / 200).toFixed(4)})" title="Volume ${Math.round(vol)}% · arraste para cima/baixo"><b>${Math.round(vol)}%</b></div>` : '';
    return `<div class="clip c-${c.type === 'gif' ? 'image' : c.type} ${sel ? 'sel' : ''}" data-clip="${c.id}" style="left:${x}px;width:${w}px" title="${esc(name)} · ${fmtSec(c.dur)}">
      ${bg ? `<div class="clip-thumbs" ${bg}></div>` : ''}${wave}
      <div class="clip-label">${ic(icn, 11)}<span class="cl-name">${esc(name)}</span>${badges.join('')}</div>
      ${sub ? `<div class="clip-sub">${sub}</div>` : ''}${tri}${tro}${kfs}
      ${volLine}<div class="fxbars">${bars.join('')}</div>
      <div class="h-l" data-h="l"></div><div class="h-r" data-h="r"></div></div>`;
  },
  gapHTML(tk) {
    const g = App.selGap; if (!g || g.trackId !== tk.id) return '';
    const w = (g.end - g.start) * this.pps;
    return `<div class="tl-gap" style="left:${g.start * this.pps}px;width:${w}px">${w > 90 ? `espaço vazio · ${fmtSec(g.end - g.start)} · Del fecha` : ''}</div>`;
  },
  recHTML(tk) {
    const r = App.recording; if (!r || r.trackId !== tk.id) return '';
    return `<div class="clip c-audio rec" id="rec-live" style="left:${r.start * this.pps}px;width:${Math.max(3, (App.t - r.start) * this.pps)}px"><canvas class="clip-wave" id="rec-wave"></canvas><div class="clip-label">${ic('mic', 11)}<span class="cl-name">Gravando…</span></div></div>`;
  },
  // atualiza o clipe de gravação crescendo e a onda do som
  updateRec() {
    const r = App.recording; if (!r) return;
    let el = $('#rec-live');
    const W = this.hw() + (App.t + 10) * this.pps;
    if (!el || W > $('#tl-inner').offsetWidth) { this.render(); el = $('#rec-live'); if (!el) return; }
    const w = Math.max(3, (App.t - r.start) * this.pps); el.style.width = w + 'px';
    r.peaks.push([App.t - r.start, Mic.level]);
    const cv = $('#rec-wave'); const hh = el.clientHeight - 17;
    if (cv.width !== Math.min(8000, Math.ceil(w)) || cv.height !== hh) { cv.width = Math.min(8000, Math.ceil(w)); cv.height = Math.max(4, hh); }
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = 'rgba(255,200,210,.85)'; const mid = cv.height / 2, k = cv.width / w;
    for (const [t, v] of r.peaks) { const x = t * this.pps * k, a = Math.min(1, v * 1.3) * mid * .95; g.fillRect(x, mid - a, Math.max(1, this.pps / 30 * k), a * 2 || 1); }
  },
  barHTML(c, inst, kind) {
    const def = kind === 'anim' ? ANIMS[inst.type] : FX[inst.type];
    const s = App.selFx && App.selFx.id === inst.id;
    return `<div class="fxbar k-${kind} ${s ? 'sel' : ''}" data-bar="${inst.id}" data-kind="${kind}" style="left:${inst.start * this.pps}px;width:${Math.max(5, inst.dur * this.pps)}px" title="${esc(def?.name || inst.type)} — arraste para mover, puxe a ponta para mudar a duração"><div class="fb-r"></div></div>`;
  },
  /* ---------- barra de rolagem com zoom nas pontas ---------- */
  updateZbar() {
    const bar = $('#tl-zbar'), th = $('#tl-zthumb'); if (!bar || !this.scroll) return;
    const sc = this.scroll, total = Math.max(1, $('#tl-inner').offsetWidth - this.hw()), view = sc.clientWidth - this.hw(), bw = bar.clientWidth - this.hw() - 12;
    bar.style.paddingLeft = this.hw() + 'px';
    const w = Math.max(44, Math.min(bw, view / total * bw)), x = Math.min(bw - w, sc.scrollLeft / total * bw);
    th.style.left = (this.hw() + 6 + x) + 'px'; th.style.width = w + 'px';
    $('span', th).textContent = w > 140 ? `${fmtTime(sc.scrollLeft / this.pps, App.fps, false)} – ${fmtTime((sc.scrollLeft + view) / this.pps, App.fps, false)}` : '';
  },
  initZbar() {
    const bar = $('#tl-zbar'), th = $('#tl-zthumb');
    bar.onpointerdown = e => {
      if (e.button !== 0) return;
      const sc = this.scroll, view = sc.clientWidth - this.hw(), bw = bar.clientWidth - this.hw() - 12;
      const D = ($('#tl-inner').offsetWidth - this.hw()) / this.pps; // segundos da área toda
      const z = e.target.closest('[data-z]')?.dataset.z;
      const t0 = sc.scrollLeft / this.pps, t1 = (sc.scrollLeft + view) / this.pps, w0 = th.offsetWidth;
      if (!e.target.closest('#tl-zthumb')) { // clique fora da barra: pula para lá
        const r = bar.getBoundingClientRect(), fx = (e.clientX - r.left - this.hw() - 6) / bw;
        sc.scrollLeft = Math.max(0, fx * D * this.pps - view / 2); return;
      }
      bar.classList.add('drag', z ? 'zooming' : 'moving');
      const s0 = sc.scrollLeft;
      dragPointer(e, (ev, dx) => {
        if (!z) { sc.scrollLeft = Math.max(0, s0 + dx / bw * D * this.pps); return; }
        const nw = clamp(w0 + (z === 'r' ? dx : -dx), 30, bw), secs = clamp(nw / bw * D, .2, 3600);
        const np = clamp(view / secs, 4, 1600);
        this.pps = np; $('#tl-zoom').value = this.ppsToSlider(np); this.render();
        sc.scrollLeft = Math.max(0, (z === 'r' ? t0 : t1 - view / np) * np);
        this.drawRuler(); this.drawWaves(); this.updateZbar();
      }, () => { bar.classList.remove('drag', 'zooming', 'moving'); try { localStorage.setItem('ps-pps', this.pps); } catch { } });
    };
    new ResizeObserver(() => this.updateZbar()).observe(bar);
  },
  wavesSoon() { if (this._wv) return; this._wv = requestAnimationFrame(() => { this._wv = null; this.drawWaves(); }); },
  // desenha a onda só no trecho visível do clipe (fica certinho em qualquer zoom)
  drawWaves() {
    const sc = this.scroll; if (!sc) return;
    const v0 = sc.scrollLeft, v1 = sc.scrollLeft + sc.clientWidth - this.hw();
    $$('[data-wave]', this.el).forEach(cv => {
      const c = App.clip(cv.dataset.wave); if (!c) return;
      let peaks = null, bdur = 1;
      if (c.assetId?.startsWith('snd:')) { const d = SOUNDS.data(c.assetId.slice(4)); if (d) { cv._pk ||= Assets.peaks({ getChannelData: () => d, duration: d.length / SOUNDS.SR }, 600); peaks = cv._pk; bdur = d.length / SOUNDS.SR; } }
      else { const rt = Assets.get(c.assetId); if (rt?.peaks) { peaks = rt.peaks; bdur = rt.buffer.duration; } }
      if (!peaks) return;
      const x0 = c.start * this.pps, x1 = x0 + c.dur * this.pps;
      const a = Math.max(x0, v0 - 50), b = Math.min(x1, v1 + 50);
      if (b <= a) { cv.style.display = 'none'; return; }
      cv.style.display = 'block'; cv.style.left = (a - x0) + 'px'; cv.style.width = (b - a) + 'px';
      const w = Math.ceil(b - a), hh = cv.parentElement.clientHeight - 17;
      cv.width = w; cv.height = Math.max(4, hh);
      const g = cv.getContext('2d'); g.fillStyle = c.type === 'video' ? 'rgba(255,255,255,.35)' : 'rgba(210,255,225,.6)';
      const vol = (c.volume ?? 100) / 100, mid = cv.height / 2;
      for (let x = 0; x < w; x++) {
        let t = (c.offset || 0) + ((a - x0 + x) / this.pps) * (c.speed || 1);
        if (c.loop) t = t % bdur;
        const i = Math.floor(t / bdur * peaks.length); if (i >= peaks.length) break;
        const v = Math.min(1, peaks[i] * vol) * mid * .95; g.fillRect(x, mid - v, 1, v * 2 || 1);
      }
    });
  },
  drawRuler() {
    const cv = $('#tl-ruler'); if (!cv || !App.project) return;
    const w = Math.max(10, this.scroll.clientWidth - this.hw()); cv.width = w * (devicePixelRatio || 1); cv.height = 28 * (devicePixelRatio || 1); cv.style.width = w + 'px'; cv.style.height = '28px';
    const g = cv.getContext('2d'), d = devicePixelRatio || 1; g.scale(d, d);
    const sl = this.scroll.scrollLeft, t0 = sl / this.pps, t1 = (sl + w) / this.pps, fps = App.fps;
    const steps = [1 / fps, 2 / fps, 5 / fps, .5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    let major = steps.find(s => s * this.pps >= 80) || 600; const minor = major / (major >= 1 ? 5 : 2);
    g.fillStyle = '#1e2025'; g.fillRect(0, 0, w, 28);
    // trecho de duração
    g.fillStyle = `rgba(${typeof Tema !== 'undefined' ? Tema.rgb(Tema.cfg.cor) : '61,139,255'},.12)`; g.fillRect(-sl, 0, App.duration * this.pps, 28);
    g.strokeStyle = '#4a4f59'; g.fillStyle = '#8b909a'; g.font = '10.5px system-ui, sans-serif'; g.lineWidth = 1;
    g.beginPath();
    for (let t = Math.floor(t0 / minor) * minor; t <= t1 + minor; t += minor) { const x = Math.round(t * this.pps - sl) + .5; g.moveTo(x, 28); g.lineTo(x, 22); }
    g.stroke(); g.strokeStyle = '#6c707a'; g.beginPath();
    for (let t = Math.floor(t0 / major) * major; t <= t1 + major; t += major) {
      const x = Math.round(t * this.pps - sl) + .5; g.moveTo(x, 28); g.lineTo(x, 12);
      const lbl = major < 1 ? fmtTime(t, fps) : fmtTime(t, fps, false); g.fillText(lbl, x + 4, 11);
    }
    g.stroke();
    for (const m of App.project.markers) { const x = m.t * this.pps - sl; if (x < -10 || x > w + 10) continue; g.fillStyle = m.color || '#ffb020'; g.beginPath(); g.moveTo(x - 5, 14); g.lineTo(x + 5, 14); g.lineTo(x + 5, 22); g.lineTo(x, 27); g.lineTo(x - 5, 22); g.fill(); if (m.label) { g.fillStyle = '#ffd47a'; g.fillText(m.label, x + 7, 22); } }
    const px = App.t * this.pps - sl; g.fillStyle = '#ff4d6a'; g.beginPath(); g.moveTo(px - 6, 16); g.lineTo(px + 6, 16); g.lineTo(px + 6, 21); g.lineTo(px, 28); g.lineTo(px - 6, 21); g.fill();
  },
  updatePlayhead(follow) {
    const ph = $('#tl-ph'); if (!ph) return;
    const x = this.tx(App.t); ph.style.left = x + 'px';
    if (follow) { const sc = this.scroll, vis0 = sc.scrollLeft + this.hw(), vis1 = sc.scrollLeft + sc.clientWidth - 30; if (x > vis1 || x < vis0) sc.scrollLeft = x - this.hw() - 40; }
    this.drawRuler();
  },
  updateTime() { const e = $('#tl-time'); if (e) e.textContent = fmtTime(App.t, App.fps); },

  /* ---------- tempo a partir do mouse ---------- */
  timeAt(clientX) { const r = $('#tl-inner').getBoundingClientRect(); return Math.max(0, (clientX - r.left - this.hw()) / this.pps); },
  snapPoints(exclude = new Set()) {
    const pts = [0, App.t];
    for (const c of App.project.clips) { if (exclude.has(c.id)) continue; pts.push(c.start, c.start + c.dur); }
    App.project.markers.forEach(m => pts.push(m.t));
    return pts;
  },
  snapT(t, pts, alt) {
    if (!App.snap || alt) return { t, hit: null };
    const th = 8 / this.pps; let best = null, bd = th;
    for (const p of pts) { const d = Math.abs(p - t); if (d < bd) { bd = d; best = p; } }
    return best !== null ? { t: best, hit: best } : { t, hit: null };
  },
  showDrop(t) { const d = $('#tl-drop'); if (!d) return; if (t === null) { d.style.display = 'none'; return; } d.style.display = 'block'; d.style.left = this.tx(t) + 'px'; },

  /* ---------- eventos ---------- */
  bind() {
    const inner = $('#tl-inner');
    // régua: arrastar o cursor
    const ruler = $('#tl-ruler');
    ruler.onpointerdown = e => {
      if (App.playing) App.pause();
      const go = ev => { const r = this.timeAt(ev.clientX); const s = this.snapT(r, [0, ...App.project.markers.map(m => m.t), ...App.project.clips.flatMap(c => [c.start, c.start + c.dur])], ev.altKey); App.seek(s.t); };
      go(e); dragPointer(e, go);
    };
    ruler.ondblclick = e => { const t = this.timeAt(e.clientX), m = App.project.markers.find(m => Math.abs(m.t - t) * this.pps < 8); if (m) Actions.editMarker(m); };
    ruler.oncontextmenu = e => {
      e.preventDefault(); const t = this.timeAt(e.clientX), m = App.project.markers.find(m => Math.abs(m.t - t) * this.pps < 8);
      UI.ctx(e.clientX, e.clientY, m ? [
        { head: m.label || 'Marcador' },
        { label: 'Editar nome e cor…', icon: 'edit', action: () => Actions.editMarker(m) },
        { label: 'Ir para o marcador', action: () => App.seek(m.t) },
        { label: 'Citar na IA', icon: 'sparkles', ai: true, action: () => Assistant.cite([{ kind: 'marcador', id: m.id }]) },
        { label: 'Remover marcador', icon: 'trash', danger: true, action: () => { App.project.markers = App.project.markers.filter(x => x !== m); App.commit('Marcador removido', { toast: true }); } },
      ] : [{ label: 'Adicionar marcador aqui…', icon: 'marker', action: () => Actions.addMarker(t) }]);
    };
    // largura da coluna de nomes
    const hr = $('.hw-rs', inner);
    if (hr) hr.onpointerdown = e => { e.stopPropagation(); const w0 = this.hwv; dragPointer(e, (ev, dx) => { this.hwv = clamp(w0 + dx, 130, 420); this.el.style.setProperty('--hw', this.hwv + 'px'); this.render(); }, () => { try { localStorage.setItem('ps-hw', this.hwv); } catch { } }); };
    // botões de nova faixa (em cima: vídeo/efeitos · embaixo: áudio)
    $$('[data-add]', inner).forEach(b => b.onclick = () => {
      const tp = b.dataset.add, tr = App.project.tracks;
      if (tp === 'audio') Actions.addTrack('audio', tr.length);
      else if (tp === 'fx') Actions.addTrack('fx', 0);
      else { const i = tr.findIndex(t => t.type === 'visual'); Actions.addTrack('visual', i < 0 ? tr.length : i); }
    });
    // cabeçalhos: clicar, renomear, arrastar para reordenar, puxar a borda para a altura
    $$('.tl-row[data-track] > .tl-thead', inner).forEach(th => {
      const tk = App.track(th.parentElement.dataset.track);
      th.ondblclick = e => { if (!e.target.closest('[data-tb]') && !e.target.closest('.th-rs')) Actions.renameTrack(tk); };
      th.oncontextmenu = e => { e.preventDefault(); this.trackMenu(e, tk); };
      th.onpointerdown = e => {
        if (e.button !== 0 || e.target.closest('[data-tb]')) return;
        if (e.target.closest('.th-rs')) { const h0 = tk.h, row = th.parentElement; dragPointer(e, (ev, dx, dy) => { tk.h = clamp(Math.round(h0 + dy), 28, 400); row.style.height = tk.h + 'px'; }, () => { App.commit('Altura da faixa alterada'); }); return; }
        this.dragTrack(e, tk, th.parentElement);
      };
      $$('[data-tb]', th).forEach(b => b.onclick = () => {
        const k = b.dataset.tb; tk[k] = !tk[k];
        const msg = { hidden: tk.hidden ? 'escondida' : 'visível', mute: tk.mute ? 'silenciada' : 'com som', lock: tk.lock ? 'travada' : 'destravada', solo: tk.solo ? 'em solo' : 'fora do solo' }[k];
        App.commit(`Faixa "${esc(tk.name)}" ${msg}`, { toast: true });
        if (App.playing && (k === 'mute' || k === 'solo')) App.seek(App.t);
      });
    });
    // faixas vazias: clique seleciona o espaço vazio, arrastar = seleção por retângulo
    $$('.tl-lane[data-lane]', inner).forEach(lane => {
      lane.onpointerdown = e => {
        if (e.target !== lane || e.button !== 0) return;
        App.activeTrack = lane.dataset.lane;
        if (App.playing) App.pause();
        this.marquee(e, lane);
      };
      lane.oncontextmenu = e => {
        if (e.target !== lane) return; e.preventDefault();
        const t = this.timeAt(e.clientX), g = this.gapAt(lane.dataset.lane, t);
        if (g) { App.selGap = g; App.sel.clear(); App.selFx = null; App.refresh(); }
        this.laneMenu(e, App.track(lane.dataset.lane), t, g);
      };
      lane.onpointermove = e => { if (App.tool !== 'razor') return; const t = this.timeAt(e.clientX); this.showCut(this.snapT(t, [App.t], e.altKey).t); };
      lane.onpointerleave = () => this.showCut(null);
      lane.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; this.dragOver(e, lane); };
      lane.ondragleave = e => { if (!lane.contains(e.relatedTarget)) { this.showDrop(null); $$('.clip.drop-target').forEach(x => x.classList.remove('drop-target')); } };
      lane.ondrop = e => { e.preventDefault(); e._handled = true; this.showDrop(null); $$('.clip.drop-target').forEach(x => x.classList.remove('drop-target')); const tgt = e.target.closest('.clip'); LibUI.handleDrop(e, { trackId: lane.dataset.lane, time: this.dropTime(e), clipId: tgt?.dataset.clip }); };
    });
    // clipes
    $$('.clip[data-clip]', inner).forEach(el => {
      const c = App.clip(el.dataset.clip);
      el.onpointerdown = e => {
        if (e.button !== 0) return;
        const tk = App.track(c.trackId);
        if (App.playing) App.pause();
        App.selGap = null;
        // lâmina: corta onde clicar (em cima da imagem, da onda, das barrinhas…)
        if (App.tool === 'razor') { if (tk.lock) return UI.toast('Essa faixa está travada.', { kind: 'warn' }); const t = this.timeAt(e.clientX), s = this.snapT(t, [App.t], e.altKey); return Actions.splitClip(c, s.t); }
        if (App.pick) { e.stopPropagation(); return App.pick.onPick(c); }
        if (e.target.closest('[data-vol]') && !tk.lock) return this.dragVol(e, c, el);
        const kd = e.target.closest('.kfd');
        if (kd && !tk.lock) return this.dragKey(e, c, +kd.dataset.kt);
        const bar = e.target.closest('[data-bar]');
        if (bar) return this.dragBar(e, c, bar);
        if (e.target.closest('[data-tr]')) { App.select(c.id); Props.tab = 'trans'; Props.render(); return; }
        if (tk.lock) { App.select(c.id); return UI.toast('Essa faixa está travada. Clique no cadeado para destravar.', { kind: 'warn' }); }
        const hd = e.target.dataset.h;
        if (e.shiftKey || e.ctrlKey || e.metaKey) { App.toggleSel(c.id); return; }
        if (!App.sel.has(c.id)) { App.selFx = null; App.select(c.id); }
        if (hd) return this.dragTrim(e, c, hd);
        this.dragClip(e, c);
      };
      el.onpointermove = e => { if (App.tool !== 'razor') return; const t = this.timeAt(e.clientX); this.showCut(this.snapT(t, [App.t], e.altKey).t); };
      el.ondblclick = () => { App.select(c.id); App.seek(Math.max(App.t, c.start)); if (c.type === 'anim' && typeof Cena !== 'undefined') Cena.focus(c); };
      el.oncontextmenu = e => {
        e.preventDefault(); if (!App.sel.has(c.id)) App.select(c.id);
        const kd = e.target.closest('.kfd');
        if (kd) return this.keyMenu(e, c, +kd.dataset.kt);
        this.clipMenu(e, c);
      };
    });
  },
  dragVol(e, c, el) {
    const line = $('[data-vol]', el), r = el.getBoundingClientRect(), top = r.top + 17, hh = r.height - 21; let moved = false;
    App.sel.clear(); App.sel.add(c.id);
    dragPointer(e, ev => {
      moved = true; let v = clamp((1 - (ev.clientY - top) / hh) * 200, 0, 200);
      if (Math.abs(v - 100) < 4 && !ev.altKey) v = 100; // gruda nos 100%
      c.volume = Math.round(v); line.style.top = `calc(17px + (100% - 21px) * ${(1 - c.volume / 200).toFixed(4)})`; $('b', line).textContent = c.volume + '%';
    }, () => { if (moved) { App.commit(`Volume: ${c.volume}%`); if (App.playing) App.seek(App.t); } });
  },
  keysAt(c, t) { const out = []; for (const [p, ks] of Object.entries(c.kf || {})) ks.forEach(k => { if (Math.abs(k.t - t) < 1e-3) out.push([p, k]); }); return out; },
  dragKey(e, c, t0) {
    const keys = this.keysAt(c, t0); let moved = false; App.sel.clear(); App.sel.add(c.id);
    const pts = [0, c.dur, App.t - c.start, ...KF.times(c).filter(t => Math.abs(t - t0) > 1e-3)];
    dragPointer(e, (ev, dx) => {
      if (!moved && Math.abs(dx) < 3) return; moved = true;
      const nt = clamp(App.frame(this.snapT(t0 + dx / this.pps, pts, ev.altKey).t), 0, c.dur);
      keys.forEach(([, k]) => k.t = round(nt, 4)); Object.values(c.kf).forEach(ks => ks.sort((a, b) => a.t - b.t));
      const d = e.target; d.style.left = nt * this.pps + 'px'; App.requestRender();
    }, () => {
      if (moved) App.commit('Keyframe movido no tempo');
      else { Props.tab = 'keys'; App.seek(c.start + t0); App.refresh(); }
    });
  },
  keyMenu(e, c, t) {
    const keys = this.keysAt(c, t);
    UI.ctx(e.clientX, e.clientY, [
      { head: `Keyframe em ${fmtSec(t)} · ${keys.map(([p]) => ANIMATABLE[p]?.l || p).join(', ')}` },
      { label: 'Ir para este keyframe', icon: 'diamond', action: () => App.seek(c.start + t) },
      { label: 'Editar keyframes…', icon: 'sliders', action: () => { Props.tab = 'keys'; App.select(c.id); App.seek(c.start + t); } },
      { label: 'Como chega no próximo', icon: 'wave', sub: Object.entries(EASE_NAMES).map(([k, n]) => ({ label: n, checked: keys.every(([, x]) => x.e === k), action: () => { keys.forEach(([, x]) => x.e = k); App.commit('Movimento do keyframe: ' + n, { toast: true }); } })) },
      { label: 'Duplicar no cursor', icon: 'dup', action: () => { const lt = clamp(App.t - c.start, 0, c.dur); keys.forEach(([p, k]) => KF.set(c, p, lt, k.v, k.e)); App.commit('Keyframe duplicado no cursor', { toast: true }); } },
      '-',
      { label: 'Excluir este keyframe', icon: 'trash', danger: true, action: () => { keys.forEach(([p]) => KF.remove(c, p, t)); App.commit('Keyframe excluído', { toast: true }); } },
    ]);
  },
  gapAt(trackId, t) {
    const cl = App.project.clips.filter(c => c.trackId === trackId);
    if (cl.some(c => t >= c.start && t < c.start + c.dur)) return null;
    const prev = Math.max(0, ...cl.filter(c => c.start + c.dur <= t + 1e-4).map(c => c.start + c.dur));
    const nexts = cl.filter(c => c.start >= t - 1e-4).map(c => c.start);
    if (!nexts.length) return null;
    const next = Math.min(...nexts);
    return next - prev > 1e-3 ? { trackId, start: prev, end: next } : null;
  },
  // arrastar faixa: a faixa anda junto com o mouse e as outras abrem espaço
  dragTrack(e, tk, row) {
    const inner = $('#tl-inner'); let moved = false, ghost = null;
    const icon = { visual: 'film', audio: 'music', fx: 'sparkles' }[tk.type];
    dragPointer(e, (ev, dx, dy) => {
      if (!moved && Math.abs(dy) < 5) return;
      if (!moved) { moved = true; row.classList.add('dragging-track'); document.body.classList.add('track-moving'); ghost = h(`<div class="track-ghost">${ic(icon, 13)}<span></span></div>`); document.body.appendChild(ghost); }
      const others = $$('.tl-row[data-track]', inner).filter(r => r !== row);
      let before = null;
      for (const r of others) { const rr = r.getBoundingClientRect(); if (ev.clientY < rr.top + rr.height / 2) { before = r; break; } }
      const last = others[others.length - 1];
      if (before) { if (row.nextElementSibling !== before) inner.insertBefore(row, before); }
      else if (last && last.nextElementSibling !== row) last.after(row);
      const order = $$('.tl-row[data-track]', inner), i = order.indexOf(row);
      const up = order[i - 1] ? App.track(order[i - 1].dataset.track).name : null, down = order[i + 1] ? App.track(order[i + 1].dataset.track).name : null;
      $('span', ghost).innerHTML = `Movendo <b>${esc(tk.name)}</b> · posição ${i + 1} de ${order.length}<br><small>${up ? '↑ abaixo de ' + esc(up) : '↑ no topo'} · ${down ? '↓ acima de ' + esc(down) : '↓ no fim'}</small>`;
      ghost.style.left = ev.clientX + 16 + 'px'; ghost.style.top = ev.clientY + 12 + 'px';
    }, () => {
      row.classList.remove('dragging-track'); document.body.classList.remove('track-moving'); ghost && ghost.remove();
      if (!moved) { App.activeTrack = tk.id; this.render(); return; }
      const ids = $$('.tl-row[data-track]', inner).map(r => r.dataset.track), a = App.project.tracks;
      if (ids.every((id, i) => a[i] && a[i].id === id)) return this.render();
      App.project.tracks = ids.map(id => App.track(id));
      const i = ids.indexOf(tk.id);
      App.commit(`Faixa "${esc(tk.name)}" movida para a posição ${i + 1}${tk.type !== 'audio' ? (i === 0 ? ' (fica na frente de tudo)' : '') : ''}`, { toast: true });
    });
  },
  dropTime(e) { const t = this.timeAt(e.clientX); return App.frame(this.snapT(t, this.snapPoints(), e.altKey).t); },
  dragOver(e, lane) {
    const t = this.dropTime(e); this.showDrop(t);
    $$('.clip.drop-target').forEach(x => x.classList.remove('drop-target'));
    const tgt = e.target.closest('.clip'); const kind = LibUI.dragKind;
    if (tgt && kind && ['anim', 'fx', 'trans', 'preset', 'asset'].includes(kind)) tgt.classList.add('drop-target');
    if (tgt && !kind && [...(e.dataTransfer.types || [])].includes('Files')) tgt.classList.add('drop-target');
  },
  marquee(e, lane) {
    const inner = $('#tl-inner'), r0 = inner.getBoundingClientRect(), x0 = e.clientX - r0.left, y0 = e.clientY - r0.top;
    const box = h('<div style="position:absolute;border:1px solid var(--ac);background:var(--acs);z-index:30;pointer-events:none"></div>');
    inner.appendChild(box); let moved = false;
    const add = e.shiftKey ? new Set(App.sel) : new Set();
    dragPointer(e, ev => {
      const r = inner.getBoundingClientRect(), x1 = ev.clientX - r.left, y1 = ev.clientY - r.top;
      if (Math.abs(x1 - x0) + Math.abs(y1 - y0) > 4) moved = true;
      Object.assign(box.style, { left: Math.min(x0, x1) + 'px', top: Math.min(y0, y1) + 'px', width: Math.abs(x1 - x0) + 'px', height: Math.abs(y1 - y0) + 'px' });
      const br = box.getBoundingClientRect(), s = new Set(add);
      $$('.clip', inner).forEach(c => { const cr = c.getBoundingClientRect(); const hit = cr.left < br.right && cr.right > br.left && cr.top < br.bottom && cr.bottom > br.top; c.classList.toggle('sel', hit || add.has(c.dataset.clip)); if (hit) s.add(c.dataset.clip); });
      this._mq = s;
    }, (ev) => {
      box.remove();
      if (!moved) {
        const t = this.timeAt(ev.clientX), g = this.gapAt(lane.dataset.lane, t);
        App.seek(t); if (!ev.shiftKey) { App.sel.clear(); App.selFx = null; }
        App.selGap = g; App.refresh(); return;
      }
      App.selGap = null;
      App.select([...(this._mq || [])]);
    });
  },
  dragClip(e, c) {
    const clips = App.selected().filter(x => !App.track(x.trackId).lock);
    const ids = new Set(clips.map(x => x.id)), pts = this.snapPoints(ids);
    const orig = clips.map(x => ({ c: x, start: x.start, trackId: x.trackId }));
    const rows = $$('.tl-row'), startRow = c.trackId;
    let moved = false, alt = e.altKey, copies = null;
    const minStart = Math.min(...orig.map(o => o.start));
    dragPointer(e, (ev, dx) => {
      if (!moved && Math.abs(dx) < 3 && Math.abs(ev.clientY - e.clientY) < 3) return;
      if (!moved && alt) { // Alt + arrastar = duplicar
        copies = clips.map(x => { const n = clone(x); n.id = uid('c_'); App.project.clips.push(n); return n; });
      }
      moved = true;
      let d = dx / this.pps;
      // grudar: borda esquerda ou direita do clipe principal
      const o0 = orig.find(o => o.c === c);
      const s1 = this.snapT(o0.start + d, pts, ev.altKey && !alt), s2 = this.snapT(o0.start + c.dur + d, pts, ev.altKey && !alt);
      if (s1.hit !== null) d = s1.t - o0.start; else if (s2.hit !== null) d = s2.t - o0.start - c.dur;
      d = Math.max(d, -minStart);
      // trocar de faixa
      const row = rows.find(r => { const rr = r.getBoundingClientRect(); return ev.clientY >= rr.top && ev.clientY < rr.bottom; });
      const targetTk = row ? App.track(row.dataset.track) : null;
      orig.forEach(o => {
        o.c.start = App.frame(o.start + d);
        if (clips.length === 1 && targetTk && compatible(o.c, targetTk) && !targetTk.lock) o.c.trackId = targetTk.id;
        const el = $(`[data-clip="${o.c.id}"]`);
        if (el) { el.style.left = o.c.start * this.pps + 'px'; if (el.parentElement.dataset.lane !== o.c.trackId) $(`[data-lane="${o.c.trackId}"]`).appendChild(el); }
      });
      this.showDrop(s1.hit ?? s2.hit ?? null);
      App.requestRender();
    }, () => {
      this.showDrop(null);
      if (!moved) return;
      const moves = Actions.resolveOverlaps(clips);
      const msg = (copies ? 'Clipe duplicado' : clips.length > 1 ? `${clips.length} clipes movidos` : 'Clipe movido') + (moves ? ` · ${moves} foi para outra faixa por falta de espaço` : '');
      App.commit(msg, { toast: !!copies || !!moves, kind: moves ? 'warn' : 'ok' });
    });
  },
  dragTrim(e, c, side) {
    const o = { start: c.start, dur: c.dur, offset: c.offset || 0 }, pts = this.snapPoints(new Set([c.id]));
    const meta = c.assetId ? Assets.meta(c.assetId) : null;
    const srcDur = (c.type === 'video' || c.type === 'audio') && meta?.dur && !c.loop ? meta.dur : Infinity;
    const minD = 1 / App.fps, sp = c.speed || 1;
    const el = $(`[data-clip="${c.id}"]`);
    dragPointer(e, (ev, dx) => {
      const d = dx / this.pps;
      if (side === 'r') {
        let end = this.snapT(o.start + o.dur + d, pts, ev.altKey).t;
        let nd = clamp(end - o.start, minD, (srcDur - o.offset) / sp);
        c.dur = App.frame(nd);
      } else {
        let st = this.snapT(o.start + d, pts, ev.altKey).t;
        let delta = st - o.start;
        delta = Math.max(delta, -o.start, -o.offset / sp);
        delta = Math.min(delta, o.dur - minD);
        if (!isFinite(srcDur) && c.type !== 'video' && c.type !== 'audio') delta = Math.max(-o.start, Math.min(delta, o.dur - minD));
        c.start = App.frame(o.start + delta); c.dur = App.frame(o.dur - (c.start - o.start)); c.offset = Math.max(0, o.offset + (c.start - o.start) * sp);
      }
      el.style.left = c.start * this.pps + 'px'; el.style.width = c.dur * this.pps + 'px';
      App.requestRender();
    }, () => {
      if (side === 'l') { // mantém animações e keyframes no mesmo momento da tela
        const sh = c.start - o.start;
        if (sh) { (c.anims || []).forEach(a => a.start = Math.max(0, a.start - sh)); (c.fx || []).forEach(f => f.start = Math.max(0, f.start - sh)); for (const ks of Object.values(c.kf || {})) ks.forEach(k => k.t -= sh); }
      }
      Actions.resolveOverlaps([c]);
      App.commit('Duração do clipe alterada');
    });
  },
  dragBar(e, c, bar) {
    const kind = bar.dataset.kind, list = kind === 'anim' ? c.anims : c.fx, inst = list.find(x => x.id === bar.dataset.bar);
    App.sel.clear(); App.sel.add(c.id); App.selFx = { clipId: c.id, kind, id: inst.id }; Props.tab = kind === 'anim' ? 'anim' : 'fx';
    const o = { start: inst.start, dur: inst.dur }, resize = e.target.classList.contains('fb-r');
    const pts = [0, c.dur, App.t - c.start, ...(c.anims || []).concat(c.fx || []).filter(x => x !== inst).flatMap(x => [x.start, x.start + x.dur])];
    let moved = false;
    $$('.fxbar.sel').forEach(b => b.classList.remove('sel')); bar.classList.add('sel');
    Props.render();
    dragPointer(e, (ev, dx) => {
      moved = true; const d = dx / this.pps;
      if (resize) inst.dur = Math.max(1 / App.fps, App.frame(this.snapT(o.start + o.dur + d, pts, ev.altKey).t - o.start));
      else { let s = this.snapT(o.start + d, pts, ev.altKey).t; const s2 = this.snapT(o.start + d + o.dur, pts, ev.altKey); if (s2.hit !== null && Math.abs(s - (o.start + d)) < 1e-6) s = s2.t - o.dur; inst.start = clamp(App.frame(s), 0, Math.max(0, c.dur - 1 / App.fps)); }
      bar.style.left = inst.start * this.pps + 'px'; bar.style.width = Math.max(5, inst.dur * this.pps) + 'px';
      App.requestRender();
    }, () => { if (moved) App.commit((kind === 'anim' ? 'Animação' : 'Efeito') + ' ajustado'); else App.refresh(); });
  },

  /* ---------- menus de contexto ---------- */
  clipMenu(e, c) {
    const multi = App.sel.size > 1, visual = !['audio', 'fx'].includes(c.type);
    const animSub = Object.entries(groupBy(ANIMS)).map(([cat, list]) => ({ label: cat, sub: list.map(a => ({ label: a.name, action: () => Actions.addAnim(App.selected(), a.id, App.t) })) }));
    const fxSub = Object.entries(groupBy(FX)).map(([cat, list]) => ({ label: cat, sub: list.map(f => ({ label: f.name, action: () => Actions.addFx(App.selected(), f.id, App.t) })) }));
    const trSub = side => Object.entries(TRANS).map(([id, t]) => ({ label: t.name, action: () => Actions.setTrans(App.selected(), side, id) })).concat(['-', { label: 'Remover transição', action: () => Actions.setTrans(App.selected(), side, null) }]);
    UI.ctx(e.clientX, e.clientY, [
      { head: multi ? `${App.sel.size} clipes selecionados` : (c.name || c.type) },
      { label: 'Dividir no cursor', icon: 'scissors', key: 'S', action: () => Actions.split() },
      ...(c.type === 'image' && !multi ? [{ label: '🖼️ Editar / limpar imagem (camadas, máscara, varinha, IA)…', action: () => ImgEdit.open({ asset: c.assetId, name: c.name, onSave: id => { c.assetId = id; App.commit('Imagem editada'); }, onLayers: items => RigEdit.fromLayers(c, items) }) }, { label: '😶 Personagem editável (separar boca e olhos)', action: () => RigEdit.fromImage(c) }] : []),
      ...(c.type === 'anim' && !multi ? [{ label: '🎨 Animar isto (canvas)', action: () => Cena.focus(c) }, { label: '🔍 Só o personagem (rig)', action: () => RigEdit.openFull(c) }, { label: '🩺 IA: corrigir erros do personagem', ai: true, action: () => IAFix.run(c) }] : []),
      ...(c.type === 'audio' && !multi ? [{ label: '🧹 Limpar ruído do áudio…', action: () => LimparAudio.onClip(c) }] : []),
      ...(c.type === 'video' && !multi ? [{ label: '🧹 Limpar ruído (separe o áudio primeiro)', disabled: true }] : []),
      { label: 'Copiar', icon: 'copy', key: 'Ctrl+C', action: () => Actions.copy() },
      { label: 'Recortar', key: 'Ctrl+X', action: () => Actions.cut() },
      { label: 'Duplicar', icon: 'dup', key: 'Ctrl+D', action: () => Actions.duplicate() },
      '-',
      visual && { label: 'Adicionar animação', icon: 'jump', sub: animSub },
      c.type !== 'audio' && { label: 'Adicionar efeito', icon: 'sparkles', sub: fxSub },
      visual && { label: 'Transição de entrada', icon: 'transition', sub: trSub('in') },
      visual && { label: 'Transição de saída', icon: 'transition', sub: trSub('out') },
      '-',
      { label: 'Copiar efeitos', icon: 'wand', key: 'Ctrl+Shift+C', disabled: multi, action: () => Actions.copyEffects() },
      { label: 'Colar efeitos…', icon: 'sparkles', key: 'Ctrl+Shift+V', disabled: !App.fxClipboard, action: () => Actions.pasteEffectsDialog() },
      { label: 'Repetir efeitos nos próximos clipes…', icon: 'right', disabled: multi || !((c.anims || []).length || (c.fx || []).length), action: () => Actions.applyToNextDialog(c) },
      { label: 'Salvar efeitos como predefinição…', icon: 'bookmark', disabled: multi, action: () => Actions.savePresetFromClip(c) },
      '-',
      visual && { label: 'Tamanho na tela', icon: 'zoomIn', sub: [
        { label: 'Ajustar à tela (inteiro)', action: () => Actions.fitSel('contain') },
        { label: 'Preencher a tela (corta as bordas)', action: () => Actions.fitSel('cover') },
        ['image', 'gif', 'video'].includes(c.type) && { label: 'Esticar na tela', action: () => Actions.fitSel('stretch') },
        ['image', 'gif', 'video'].includes(c.type) && { label: 'Tamanho original', action: () => Actions.fitSel('none') },
        '-',
        ...[.25, .5, .75, 1, 1.5, 2].map(k => ({ label: Math.round(k * 100) + '%', checked: Math.abs((c.tr.scale || 1) - k) < 1e-3, action: () => Actions.scaleSel(k) })),
        '-',
        { label: 'Aumentar 10%', icon: 'zoomIn', action: () => Actions.scaleSel(null, 1.1) },
        { label: 'Diminuir 10%', icon: 'zoomOut', action: () => Actions.scaleSel(null, 1 / 1.1) },
        { label: 'Centralizar', action: () => Actions.centerSel() },
      ] },
      (c.type === 'audio' || (c.type === 'video' && Assets.meta(c.assetId)?.hasAudio)) && { label: 'Volume', icon: 'vol', sub: [
        { label: 'Ajustar volume…', icon: 'sliders', action: () => Actions.volumeDialog(App.selected()) },
        { label: 'Volume igual ao de… (clique no outro áudio)', icon: 'cursor', action: () => Actions.pickVolume(App.selected()) },
        '-', ...[0, 25, 50, 75, 100, 125, 150, 200].map(v => ({ label: v + '%', checked: (c.volume ?? 100) === v, action: () => Actions.setVolume(App.selected(), v) })),
      ] },
      ['video', 'audio', 'gif'].includes(c.type) && { label: 'Velocidade', icon: 'clock', sub: [.25, .5, .75, 1, 1.25, 1.5, 2, 3, 4].map(s => ({ label: s + 'x', checked: (c.speed || 1) === s, action: () => Actions.setSpeed(App.selected(), s) })) },
      ['image', 'gif', 'video'].includes(c.type) && { label: 'Recortar (escolher uma parte)…', icon: 'crop', disabled: multi, action: () => CropEditor.open(c) },
      c.type === 'video' && { label: 'Separar o áudio do vídeo', icon: 'music', disabled: !Assets.meta(c.assetId)?.hasAudio || c.muted, action: () => Actions.detachAudio(c) },
      c.type === 'audio' && { label: 'Limpar voz (tirar pausas + normalizar)…', icon: 'mic', disabled: multi, action: () => VoiceClean.dialog(c) },
      c.type === 'image' && { label: c.badge?.on ? 'Moldura em círculo ✓ (tirar)' : 'Moldura em círculo (selo)', icon: 'image', action: () => { const sel = App.selected().length ? App.selected() : [c], on = !sel.some(x => x.badge?.on); sel.filter(x => x.type === 'image').forEach(x => { if (on) x.badge = Badge.DEF(); else delete x.badge; }); App.commit(on ? 'Moldura em círculo' : 'Sem moldura', { toast: true }); } },
      c.type === 'audio' && { label: c.duck ? `Abaixar quando tiver voz ✓ (${c.duck}%) — desligar` : 'Abaixar quando tiver voz (música de fundo)', icon: 'vol', action: () => { const sel = App.selected().length ? App.selected() : [c], on = !sel.some(x => x.duck); sel.filter(x => x.type === 'audio').forEach(x => { if (on) x.duck = 30; else delete x.duck; }); App.commit(on ? 'Música abaixa com a voz' : 'Sem abaixar com a voz', { toast: true }); } },
      c.type === 'image' && { label: c.boca ? 'Boca falando ✓ (mudar)…' : 'Boca falando (trocar imagem com a voz)…', icon: 'mic', disabled: multi, action: () => Mouth.dialog(c) },
      c.type === 'image' && { label: 'Separar boca e olhos (personagem editável)…', icon: 'layers', ai: true, disabled: multi, action: () => RigEdit.fromImage(c) },
      c.type === 'anim' && { label: 'Personagem: animar pela voz', icon: 'sparkles', ai: true, disabled: multi, action: () => RigEdit.act(c, 'all') },
      c.type === 'anim' && c.png && { label: 'Voltar a ser imagem simples', icon: 'undo', disabled: multi, action: () => RigEdit.toImage(c) },
      ['image', 'gif', 'video'].includes(c.type) && { label: 'Enquadrar personagem', icon: 'crop', sub: Framing.menu(App.selected().length > 1 ? App.selected() : [c]) },
      visual && { label: 'Congelar quadro aqui (virar imagem)', icon: 'image', disabled: c.type !== 'video', action: () => Actions.freezeFrame(c) },
      (c.type === 'audio' || (c.type === 'video' && Assets.meta(c.assetId)?.hasAudio)) && { label: Transcribe.get(c.assetId)?.segs?.length ? 'Transcrição (ver / editar)…' : 'Transcrever o áudio', icon: 'text', disabled: multi, action: () => Transcribe.open(c.assetId) },
      { label: 'Renomear', icon: 'edit', disabled: multi, action: () => Actions.renameClip(c) },
      { label: multi ? `Citar na IA (${App.selected().length})` : 'Citar na IA', icon: 'sparkles', ai: true, action: () => Assistant.cite(App.selected().map(x => ({ kind: 'clipe', id: x.id }))) },
      '-',
      { label: 'Excluir', icon: 'trash', key: 'Del', danger: true, action: () => Actions.deleteSel(false) },
      { label: 'Excluir e fechar o espaço', key: 'Shift+Del', danger: true, action: () => Actions.deleteSel(true) },
    ]);
  },
  trackMenu(e, tk) {
    const i = App.project.tracks.indexOf(tk);
    UI.ctx(e.clientX, e.clientY, [
      { head: tk.name },
      { label: 'Citar na IA', icon: 'sparkles', ai: true, action: () => Assistant.cite([{ kind: 'faixa', id: tk.id }]) },
      { label: 'Renomear', icon: 'edit', action: () => Actions.renameTrack(tk) },
      { label: 'Mover para cima', icon: 'up', disabled: i === 0, action: () => Actions.moveTrack(tk, -1) },
      { label: 'Mover para baixo', icon: 'down', disabled: i === App.project.tracks.length - 1, action: () => Actions.moveTrack(tk, 1) },
      { label: 'Altura', sub: [['Pequena', 40], ['Média', 64], ['Grande', 96], ['Enorme', 140]].map(([l, v]) => ({ label: l, checked: tk.h === v, action: () => { tk.h = v; App.commit('Altura da faixa'); } })) },
      tk.type !== 'fx' && { label: 'Volume da faixa…', icon: 'vol', action: () => Actions.trackVolume(tk) },
      tk.type !== 'fx' && { label: 'Volume da faixa igual ao de', icon: 'vol', sub: App.project.tracks.filter(t => t !== tk && t.type !== 'fx').map(t => ({ label: `${t.name} (${t.volume ?? 100}%)`, action: () => { tk.volume = t.volume ?? 100; App.commit(`Volume da faixa "${esc(tk.name)}" igual ao de "${esc(t.name)}" (${tk.volume}%)`, { toast: true }); } })) },
      { label: 'Selecionar todos os clipes da faixa', action: () => App.select(App.project.clips.filter(c => c.trackId === tk.id).map(c => c.id)) },
      '-',
      { label: 'Nova faixa de vídeo', icon: 'film', action: () => Actions.addTrack('visual', i) },
      { label: 'Nova faixa de áudio', icon: 'music', action: () => Actions.addTrack('audio', i + 1) },
      { label: 'Nova faixa de efeitos', icon: 'sparkles', action: () => Actions.addTrack('fx', i) },
      '-',
      { label: 'Excluir faixa', icon: 'trash', danger: true, action: () => Actions.deleteTrack(tk) },
    ]);
  },
  laneMenu(e, tk, t, gap) {
    t = App.frame(t);
    const items = [{ head: `${tk.name} · ${fmtTime(t, App.fps)}` }];
    if (gap) items.push({ label: `Fechar este espaço (${fmtSec(gap.end - gap.start)})`, icon: 'ripple', key: 'Del', action: () => Actions.closeGap(gap) }, { label: 'Fechar este espaço em todas as faixas', action: () => Actions.closeGap(gap, true) }, '-');
    items.push({ label: 'Colar aqui', icon: 'paste', disabled: !App.clipboard, action: () => Actions.paste(gap ? gap.start : t, tk.id) });
    if (tk.type === 'visual') items.push('-',
      { label: 'Adicionar texto aqui', icon: 'text', action: () => Actions.addClip(App.makeClip('text', { trackId: tk.id, start: t, dur: 3 })) },
      { label: 'Adicionar cor sólida aqui', icon: 'palette', action: () => Actions.addClip(App.makeClip('color', { trackId: tk.id, start: t, dur: 5 })) },
      { label: 'Adicionar forma', icon: 'shapes', sub: Object.entries(SHAPES).map(([k, n]) => ({ label: n, action: () => Actions.addClip(App.makeClip('shape', { trackId: tk.id, start: t, kind: k })) })) });
    if (tk.type === 'fx') items.push('-', ...Object.entries(groupBy(FX)).map(([cat, list]) => ({ label: cat, sub: list.filter(f => !f.clipOnly).map(f => ({ label: f.name, action: () => Actions.addClip(App.makeClip('fx', { trackId: tk.id, start: t, fxType: f.id })) })) })));
    if (tk.type === 'audio') items.push('-', { label: 'Gravar com o microfone aqui', icon: 'mic', action: () => { App.seek(t); App.activeTrack = tk.id; LibUI.setTab('rec'); } });
    items.push('-', { label: 'Adicionar marcador aqui…', icon: 'marker', action: () => Actions.addMarker(t) });
    UI.ctx(e.clientX, e.clientY, items);
  },
};
function compatible(clip, tk) { if (tk.type === 'audio') return clip.type === 'audio'; if (tk.type === 'fx') return clip.type === 'fx'; return !['audio', 'fx'].includes(clip.type); }
