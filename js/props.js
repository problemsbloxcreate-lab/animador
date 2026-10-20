/* ===================== props.js — painel de propriedades ===================== */
'use strict';

const Props = {
  tab: 'basic', el: null,
  init() { this.el = $('#props'); },
  liveUpdate: (() => { let pend = false; return () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; Props.render(); }); }; })(),
  refreshKeys: debounce(() => Props.render(), 60),

  render() {
    const el = this.el; if (!el || !App.project) return;
    const ae = document.activeElement; if (ae && el.contains(ae) && (ae.tagName === 'TEXTAREA' || (ae.tagName === 'INPUT' && ae.type === 'text'))) return; // não atrapalha quem está digitando
    const scroll = el.scrollTop;
    el.innerHTML = '';
    const sel = App.selected();
    if (typeof EdDraw !== 'undefined' && EdDraw.tool) el.appendChild(EdDraw.panel());
    if (!sel.length && (App.camSel || App.camTool) && typeof EdCam !== 'undefined') el.appendChild(EdCam.panel());
    else if (!sel.length) el.appendChild(this.projectPanel());
    else if (sel.length > 1) el.appendChild(this.multiPanel(sel));
    else { if (sel[0].type === 'shape' && sel[0].shape?.livre && !sel[0].shape.grupo && typeof Cena !== 'undefined') el.appendChild(Cena.freePanel(sel[0])); el.appendChild(this.clipPanel(sel[0])); }
    el.scrollTop = scroll;
    // rola até o efeito/animação escolhido (ex.: clicou no efeito 3 → mostra o 3)
    const sid = App.selFx?.id;
    if (sid && sid !== this._lastSelFx) {
      const card = $(`[data-inst="${sid}"]`, el);
      if (card) { const top = card.offsetTop - 110; el.scrollTop = Math.max(0, top); card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 900); }
    }
    this._lastSelFx = sid || null;
  },

  /* ---------- nada selecionado ---------- */
  projectPanel() {
    const p = App.project, s = p.settings, w = h(`<div><div class="pp-head"><div class="pp-type">${ic('film', 15)}</div><b class="pp-name">Projeto</b><button class="btn sm" data-a="set">${ic('gear', 13)}Configurar</button></div><div class="pp-body"></div></div>`);
    const b = $('.pp-body', w);
    b.innerHTML = `
      <div class="sec"><div class="sec-h">Informações</div><div class="info-grid">
        <span>Nome</span><b>${esc(p.name)}</b><span>Tamanho</span><b>${s.w} × ${s.h}</b><span>Quadros/s</span><b>${s.fps} fps</b>
        <span>Duração</span><b>${fmtTime(App.duration, s.fps)}</b><span>Clipes</span><b>${p.clips.length}</b><span>Mídias</span><b>${Assets.list(p.id).length}</b></div></div>
      <div class="sec"><div class="sec-h">Capa do projeto (tela inicial)</div><div data-cover></div></div>
      <div class="sec"><div class="sec-h">Fundo</div><div class="ctl-row"><input type="color" value="${s.bg}" data-a="bg"><span class="unit">Cor de fundo da tela</span></div></div>
      <div class="sec"><div class="sec-h">Como usar</div>
        <div class="hint">${ic('info', 13)} <b>Arraste</b> imagens, vídeos e sons da aba <b>Mídia</b> para a linha do tempo.</div>
        <div class="hint"><b>Animações</b> (pulinho, tremer, andar…): arraste em cima de um clipe. A barrinha amarela no clipe mostra quando ela acontece — arraste para mudar.</div>
        <div class="hint"><b>Efeitos</b> (glitch, TV chiando…): solte em cima de um clipe para afetar só ele, ou numa <b>faixa de efeitos</b> para afetar a tela toda.</div>
        <div class="hint"><b>Copiar efeitos:</b> botão direito no clipe → <b>Copiar efeitos</b>, selecione outros clipes → <b>Colar efeitos</b> (dá para ajustar o tempo).</div>
        <div class="hint"><b>Animar qualquer coisa:</b> selecione o clipe, clique no ◆ ao lado de um valor, mude o tempo e mude o valor. Ou use <b>Clipe → Animação rápida De → Para</b>.</div>
      </div>`;
    $('[data-a=set]', w).onclick = () => Actions.projectSettings();
    const cv = $('[data-cover]', w), cm = p.cover && Assets.meta(p.cover);
    cv.innerHTML = `<div style="display:flex;gap:10px;align-items:center"><img src="${App.makeThumb() || ''}" style="width:120px;aspect-ratio:${p.settings.w}/${p.settings.h};object-fit:cover;background:#000;border-radius:6px;border:1px solid var(--bd2)"><div style="flex:1;font-size:12px;color:var(--tx2)">${cm ? `Mídia: <b style="color:var(--tx)">${esc(cm.name)}</b>` : 'Automática: a cena onde o <b style="color:var(--ph)">cursor vermelho</b> está quando você salva.'}<div class="btn-row"><select data-cv style="max-width:100%"><option value="">Automática (cursor)</option>${Assets.list(p.id).filter(a => a.kind !== 'audio').map(a => `<option value="${a.id}" ${p.cover === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div></div></div>`;
    $('[data-cv]', cv).onchange = e => Actions.setCover(e.target.value || null);
    $('[data-a=bg]', w).onchange = e => { p.settings.bg = e.target.value; App.commit('Cor de fundo alterada', { toast: true }); };
    $('[data-a=bg]', w).oninput = e => { p.settings.bg = e.target.value; App.requestRender(); };
    return w;
  },

  /* ---------- vários selecionados ---------- */
  multiPanel(sel) {
    const w = h(`<div><div class="pp-head"><div class="pp-type">${ic('layers', 15)}</div><b class="pp-name">${sel.length} clipes selecionados</b></div><div class="pp-body"></div></div>`), b = $('.pp-body', w);
    const vis = sel.filter(c => !['audio', 'fx'].includes(c.type));
    const sec = (t) => { const s = h(`<div class="sec"><div class="sec-h">${t}</div></div>`); b.appendChild(s); return s; };
    const s1 = sec('Aplicar em todos');
    const animSel = h(`<button class="btn add-btn">${ic('plus', 14)} Animação em todos…</button>`);
    animSel.onclick = async () => { const id = await Picker.open('anim'); if (id) Actions.addAnim(vis, id, null); };
    const fxSel = h(`<button class="btn add-btn">${ic('plus', 14)} Efeito em todos…</button>`);
    fxSel.onclick = async () => { const id = await Picker.open('fx'); if (id) Actions.addFx(sel.filter(c => c.type !== 'audio' && c.type !== 'fx'), id, null); };
    s1.append(animSel, fxSel);
    const r = h(`<div class="btn-row"><button class="btn sm" data-a="paste" ${App.fxClipboard ? '' : 'disabled'}>${ic('sparkles', 13)}Colar efeitos</button><button class="btn sm" data-a="clear">${ic('x', 13)}Remover efeitos</button><button class="btn sm danger" data-a="del">${ic('trash', 13)}Excluir</button></div>`);
    $('[data-a=paste]', r).onclick = () => Actions.pasteEffectsDialog(); $('[data-a=clear]', r).onclick = () => Actions.clearEffects(); $('[data-a=del]', r).onclick = () => Actions.deleteSel();
    s1.appendChild(r);
    const s2 = sec('Tempo');
    s2.appendChild(h(`<div class="hint">Defina a mesma duração para todos, ou <b>escalone</b>: cada clipe começa um pouco depois do anterior (ótimo para personagens aparecendo um de cada vez).</div>`));
    const g = h(`<div class="grid2"><label class="field">Duração (s)<input type="text" value="${fmtNum(sel[0].dur)}" data-k="dur"></label><label class="field">Intervalo (s)<input type="text" value="0,5" data-k="gap"></label></div>`);
    s2.appendChild(g);
    const r2 = h(`<div class="btn-row"><button class="btn sm" data-a="dur">Aplicar duração</button><button class="btn sm" data-a="stag">Escalonar</button><button class="btn sm" data-a="seq">Colocar em sequência</button></div>`);
    $('[data-a=dur]', r2).onclick = () => { const d = parseNum($('[data-k=dur]', g).value); if (d > 0) { sel.forEach(c => c.dur = App.frame(d)); Actions.resolveOverlaps(sel); App.commit(`Duração de ${sel.length} clipes alterada`, { toast: true }); } };
    $('[data-a=stag]', r2).onclick = () => { const gap = parseNum($('[data-k=gap]', g).value) || 0; const s = [...sel].sort((a, b) => a.start - b.start), t0 = s[0].start; s.forEach((c, i) => c.start = App.frame(t0 + i * gap)); Actions.resolveOverlaps(s); App.commit('Clipes escalonados', { toast: true }); };
    $('[data-a=seq]', r2).onclick = () => { const s = [...sel].sort((a, b) => a.start - b.start); let t = s[0].start; s.forEach(c => { c.start = App.frame(t); t += c.dur; }); App.commit('Clipes colocados em sequência', { toast: true }); };
    s2.appendChild(r2);
    if (vis.length) {
      const s3 = sec('Posição');
      const r3 = h(`<div class="btn-row"><button class="btn sm" data-a="c">Centralizar</button><button class="btn sm" data-a="fit">Ajustar à tela</button><button class="btn sm" data-a="cov">Preencher tela</button></div>`);
      $('[data-a=c]', r3).onclick = () => Actions.centerSel(); $('[data-a=fit]', r3).onclick = () => Actions.fitSel('contain'); $('[data-a=cov]', r3).onclick = () => Actions.fitSel('cover');
      s3.appendChild(r3);
    }
    return w;
  },

  /* ---------- um clipe ---------- */
  clipPanel(c) {
    const typeName = { image: 'Imagem', gif: 'GIF', video: 'Vídeo', audio: 'Áudio', text: 'Texto', shape: 'Forma', color: 'Cor sólida', fx: 'Efeito na tela' }[c.type];
    const w = h(`<div><div class="pp-head"><div class="pp-type c-${c.type === 'gif' ? 'image' : c.type}">${ic({ image: 'image', gif: 'gif', video: 'film', audio: 'music', text: 'text', shape: 'shapes', color: 'palette', fx: 'sparkles' }[c.type], 15)}</div>
      <input class="pp-name" type="text" value="${esc(c.name || Assets.meta(c.assetId)?.name || typeName)}" title="Nome do clipe">
      <button class="ibtn" data-a="menu" title="Mais opções">${ic('dots')}</button></div>
      <div class="pp-timing"></div><div class="pp-tabs"></div><div class="pp-body"></div></div>`);
    $('.pp-name', w).onchange = e => { c.name = e.target.value; App.commit('Clipe renomeado'); };
    if (c.type === 'video' && Assets.meta(c.assetId)?.hasAudio && !c.muted) { const db = h(`<button class="btn sm" title="Separar o áudio do vídeo numa faixa de áudio">${ic('music', 13)} Separar áudio</button>`); db.onclick = () => Actions.detachAudio(c); $('[data-a=menu]', w).before(db); }
    $('[data-a=menu]', w).onclick = e => Timeline.clipMenu(e, c);
    // tempo
    const tm = $('.pp-timing', w);
    tm.appendChild(this.timeField('Início', c.start, v => { c.start = App.frame(Math.max(0, v)); Actions.resolveOverlaps([c]); App.commit('Início alterado'); }));
    tm.appendChild(this.timeField('Duração', c.dur, v => { c.dur = App.frame(Math.max(1 / App.fps, v)); Actions.resolveOverlaps([c]); App.commit('Duração alterada'); }));
    tm.appendChild(this.timeField('Fim', c.start + c.dur, v => { c.dur = App.frame(Math.max(1 / App.fps, v - c.start)); Actions.resolveOverlaps([c]); App.commit('Duração alterada'); }));
    // abas
    const tabs = [];
    if (c.type === 'fx') tabs.push(['fxclip', 'Efeito', 'sparkles']);
    else if (c.type === 'audio') tabs.push(['audio', 'Áudio', 'vol'], ['tr', 'Transcrição', 'text', Transcribe.get(c.assetId)?.segs?.length ? '✓' : 0], ['afx', 'Efeitos de voz', 'mic']);
    else {
      if (c.type === 'anim') tabs.push(['rig', 'Personagem', 'layers']);
      tabs.push(['basic', 'Posição', 'move']);
      if (['text', 'shape', 'color', 'image', 'gif', 'video'].includes(c.type)) tabs.push(['content', { text: 'Texto', shape: 'Forma', color: 'Cor' }[c.type] || 'Mídia', { text: 'text', shape: 'shapes', color: 'palette' }[c.type] || 'image']);
      tabs.push(['anim', 'Animações', 'jump', c.anims.length], ['fx', 'Efeitos', 'sparkles', c.fx.length], ['color', 'Cores', 'palette'], ['trans', 'Transições', 'transition', (c.trIn?.type ? 1 : 0) + (c.trOut?.type ? 1 : 0)]);
      if (c.type === 'video') tabs.push(['audio', 'Áudio', 'vol']);
      if (c.type === 'video' && Assets.meta(c.assetId)?.hasAudio) tabs.push(['tr', 'Transcrição', 'text', Transcribe.get(c.assetId)?.segs?.length ? '✓' : 0]);
      tabs.push(['keys', 'Keyframes', 'diamond', KF.times(c).length]);
    }
    if (!tabs.find(t => t[0] === this.tab)) this.tab = tabs[0][0];
    const tb = $('.pp-tabs', w);
    tabs.forEach(([id, l, icn, n]) => { const b = h(`<button class="pp-tab ${this.tab === id ? 'on' : ''}">${ic(icn, 13)}${l}${n ? `<i>${n}</i>` : ''}</button>`); b.onclick = () => { this.tab = id; this.render(); }; tb.appendChild(b); });
    const body = $('.pp-body', w);
    const fn = { basic: 'tabBasic', content: 'tabContent', anim: 'tabAnim', fx: 'tabFx', color: 'tabColor', trans: 'tabTrans', audio: 'tabAudio', tr: 'tabTr', afx: 'tabAfx', keys: 'tabKeys', fxclip: 'tabFxClip', rig: 'tabRig' }[this.tab];
    this[fn](body, c);
    return w;
  },
  sec(body, title, extra = '') { const s = h(`<div class="sec"><div class="sec-h">${title}${extra}</div></div>`); body.appendChild(s); return s; },

  /* ---------- controles ---------- */
  timeField(label, v, set) {
    const f = h(`<label class="field">${label}<input type="text" value="${fmtNum(v, 2)}" title="Em segundos (ex.: 1,5)"></label>`);
    const i = $('input', f); i.onchange = () => { const n = parseNum(i.value); if (!isNaN(n)) set(n); else i.value = fmtNum(v, 2); };
    return f;
  },
  // slider de propriedade (com keyframe opcional)
  slider(c, o) {
    const lt = App.t - c.start, path = o.path, animatable = path && ANIMATABLE[path] && o.kf !== false;
    const get = () => o.get ? o.get() : (path ? KF.value(c, path, lt) : 0);
    let v = get(); if (v === undefined || v === null) v = o.def ?? 0;
    const disp = o.mul ? v * o.mul : v;
    const has = animatable && KF.has(c, path), at = has && KF.at(c, path, lt);
    const row = h(`<div class="ctl"><span class="ctl-l">${o.l}</span><div class="ctl-row">
      ${animatable ? `<button class="kfb ${has ? 'has' : ''} ${at ? 'at' : ''}" title="${at ? 'Remover keyframe neste momento' : has ? 'Adicionar keyframe neste momento' : 'Animar: cria um keyframe neste momento. Depois mude o tempo e o valor.'}">${ic('diamond', 12)}</button>` : ''}
      <input type="range" min="${o.min}" max="${o.max}" step="${o.step || 1}" value="${disp}">
      <input type="number" class="nbox" step="${o.step || 1}" value="${round(disp, o.step && o.step < 1 ? 3 : 1)}"><span class="unit">${o.unit || ''}</span></div></div>`);
    const rng = $('input[type=range]', row), num = $('.nbox', row);
    const set = (val, final) => {
      val = +val; if (isNaN(val)) return;
      const real = o.mul ? val / o.mul : val;
      if (o.set) o.set(real); else App.setProp(c, path, real);
      rng.value = val; num.value = round(val, 3);
      App.requestRender();
      if (final) App.commit((o.l || 'Valor') + ' alterado', { noRefresh: true }); else App.commitSoon((o.l || 'Valor') + ' alterado');
      if (o.after) o.after();
    };
    rng.oninput = () => set(rng.value); rng.onchange = () => { set(rng.value, true); if (has) Timeline.render(); };
    num.onchange = () => set(num.value, true);
    rng.ondblclick = () => { if (o.def !== undefined) set(o.mul ? o.def * o.mul : o.def, true); };
    rng.title = 'Clique duas vezes para voltar ao padrão';
    if (animatable) $('.kfb', row).onclick = () => {
      if (at) KF.remove(c, path, lt); else KF.set(c, path, clamp(lt, 0, c.dur), get());
      App.commit(at ? 'Keyframe removido' : 'Keyframe adicionado', { toast: !has, kind: 'ok' });
    };
    return row;
  },
  sw(label, val, set) { const s = h(`<label class="switch"><input type="checkbox" ${val ? 'checked' : ''}><i></i>${label}</label>`); $('input', s).onchange = e => set(e.target.checked); return s; },
  select(label, opts, val, set) { const f = h(`<label class="field">${label}<select>${Object.entries(opts).map(([k, v]) => `<option value="${k}" ${k == val ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`); $('select', f).onchange = e => set(e.target.value); return f; },
  color(label, val, set, live) { const f = h(`<div class="ctl"><span class="ctl-l">${label}</span><div class="ctl-row"><input type="color" value="${val}"><input type="text" value="${val}" style="width:90px;height:26px"></div></div>`); const [cp, tx] = $$('input', f); cp.oninput = () => { tx.value = cp.value; live && live(cp.value); }; cp.onchange = () => set(cp.value); tx.onchange = () => { if (/^#[0-9a-f]{3,8}$/i.test(tx.value)) { cp.value = tx.value; set(tx.value); } }; return f; },

  /* ---------- Posição/Transformação ---------- */
  tabBasic(body, c) {
    const S = App.project.settings;
    const s1 = this.sec(body, 'Posição e tamanho', `<span class="sp"></span><button class="btn sm ghost" data-a="quick" title="Faz o objeto ir de um valor para outro">${ic('move', 12)} De → Para</button>`);
    $('[data-a=quick]', s1).onclick = () => Actions.quickAnim();
    s1.appendChild(this.slider(c, { l: 'Posição X (horizontal)', path: 'tr.x', min: -S.w, max: S.w, def: 0, unit: 'px' }));
    s1.appendChild(this.slider(c, { l: 'Posição Y (vertical)', path: 'tr.y', min: -S.h, max: S.h, def: 0, unit: 'px' }));
    s1.appendChild(this.slider(c, { l: 'Escala (tamanho)', path: 'tr.scale', min: 0, max: 4, step: .01, def: 1, unit: 'x' }));
    s1.appendChild(this.slider(c, { l: 'Rotação', path: 'tr.rot', min: -360, max: 360, step: .5, def: 0, unit: '°' }));
    s1.appendChild(this.slider(c, { l: 'Opacidade', path: 'tr.opacity', min: 0, max: 100, def: 100, unit: '%' }));
    const r = h(`<div class="btn-row"><button class="btn sm" data-a="c">Centralizar</button><button class="btn sm" data-a="fit">Ajustar</button><button class="btn sm" data-a="cov">Preencher</button><button class="btn sm" data-a="fx">${ic('flip', 12)} Espelhar</button><button class="btn sm" data-a="fy">Virar ↕</button></div>`);
    $('[data-a=c]', r).onclick = () => Actions.centerSel(); $('[data-a=fit]', r).onclick = () => Actions.fitSel('contain'); $('[data-a=cov]', r).onclick = () => Actions.fitSel('cover');
    $('[data-a=fx]', r).onclick = () => { c.tr.flipX = !c.tr.flipX; App.commit('Espelhado', { toast: true }); }; $('[data-a=fy]', r).onclick = () => { c.tr.flipY = !c.tr.flipY; App.commit('Virado', { toast: true }); };
    s1.appendChild(r);
    const s2 = this.sec(body, 'Esticar');
    s2.appendChild(this.slider(c, { l: 'Largura', path: 'tr.sx', min: 0, max: 4, step: .01, def: 1, unit: 'x' }));
    s2.appendChild(this.slider(c, { l: 'Altura', path: 'tr.sy', min: 0, max: 4, step: .01, def: 1, unit: 'x' }));
    if (['image', 'gif', 'video'].includes(c.type)) {
      const s3 = this.sec(body, 'Recortar (crop)');
      const cb = h(`<button class="btn add-btn" style="border-style:solid">${ic('crop', 14)} Recortar visualmente… <span style="color:var(--tx3);margin-left:auto;font-size:11px">escolher só uma parte</span></button>`);
      cb.onclick = () => CropEditor.open(c); s3.appendChild(cb);
      [['l', 'Esquerda'], ['r', 'Direita'], ['t', 'Topo'], ['b', 'Baixo']].forEach(([k, l]) => s3.appendChild(this.slider(c, { l, get: () => c.crop[k], set: v => c.crop[k] = clamp(v, 0, 99), min: 0, max: 95, def: 0, unit: '%' })));
      const g = h('<div class="grid2"></div>');
      g.appendChild(this.select('Encaixe na tela', { contain: 'Ajustar (inteiro)', cover: 'Preencher (corta)', stretch: 'Esticar', none: 'Tamanho original' }, c.tr.fit, v => { c.tr.fit = v; App.commit('Encaixe alterado'); }));
      s3.appendChild(g);
    }
    const s4 = this.sec(body, 'Avançado');
    const g2 = h('<div class="grid2"></div>');
    g2.appendChild(this.select('Mistura', { 'source-over': 'Normal', multiply: 'Multiplicar', screen: 'Clarear (tela)', overlay: 'Sobrepor', lighter: 'Somar luz', darken: 'Escurecer', lighten: 'Clarear', difference: 'Diferença', 'color-dodge': 'Subexposição', hue: 'Matiz', color: 'Cor', luminosity: 'Luminosidade' }, c.tr.blend, v => { c.tr.blend = v; App.commit('Mistura alterada'); }));
    g2.appendChild(this.select('Ponto de giro', { 'c': 'Centro', 'b': 'Embaixo (pés)', 't': 'Em cima', 'l': 'Esquerda', 'r': 'Direita' }, c.tr.ay > .9 ? 'b' : c.tr.ay < .1 ? 't' : c.tr.ax < .1 ? 'l' : c.tr.ax > .9 ? 'r' : 'c', v => { const g = Renderer.geom(App.project, c, App.t); const a = { c: [.5, .5], b: [.5, 1], t: [.5, 0], l: [0, .5], r: [1, .5] }[v]; const dx = (a[0] - c.tr.ax) * g.box.w * c.tr.scale * c.tr.sx, dy = (a[1] - c.tr.ay) * g.box.h * c.tr.scale * c.tr.sy; c.tr.ax = a[0]; c.tr.ay = a[1]; c.tr.x += Math.round(dx); c.tr.y += Math.round(dy); App.commit('Ponto de giro alterado'); }));
    s4.appendChild(g2);
    if (['video', 'gif'].includes(c.type)) s4.appendChild(this.slider(c, { l: 'Velocidade', get: () => c.speed || 1, set: v => { c.speed = clamp(v, .1, 8); }, min: .1, max: 4, step: .05, def: 1, unit: 'x', kf: false, after: () => App.commitSoon('Velocidade') }));
  },

  /* ---------- Conteúdo ---------- */
  tabContent(body, c) {
    if (c.type === 'text') {
      const t = c.text, s = this.sec(body, 'Texto');
      const ta = h(`<textarea rows="3" style="width:100%;font-size:14px">${esc(t.text)}</textarea>`);
      ta.oninput = () => { t.text = ta.value; App.requestRender(); App.commitSoon('Texto alterado'); };
      ta.onblur = () => Timeline.render();
      s.appendChild(ta);
      const chips = h(`<div class="chips" style="margin-top:8px">${Object.entries(TEXT_STYLES).map(([k, v]) => `<span class="chip" data-s="${k}">${v.name}</span>`).join('')}</div>`);
      $$('[data-s]', chips).forEach(ch => ch.onclick = () => { const st = TEXT_STYLES[ch.dataset.s]; Object.assign(t, { font: st.font, size: st.size, color: st.color, stroke: st.stroke, strokeW: st.strokeW, shadow: st.shadow, bold: !!st.bold, bg: st.bg || '#000000', bgAmt: st.bgAmt || 0 }); App.commit('Estilo de texto: ' + st.name, { toast: true }); });
      s.appendChild(h('<span class="ctl-l" style="margin-top:8px">Estilos prontos</span>')); s.appendChild(chips);
      const s2 = this.sec(body, 'Fonte');
      const g = h('<div class="grid2"></div>');
      g.appendChild(this.select('Fonte', Object.fromEntries(FONTS.map(f => [f, f])), t.font, v => { t.font = v; document.fonts.load(`40px "${v}"`).then(() => App.requestRender()); App.commit('Fonte alterada'); }));
      g.appendChild(this.select('Alinhamento', { left: 'Esquerda', center: 'Centro', right: 'Direita' }, t.align, v => { t.align = v; App.commit('Alinhamento'); }));
      s2.appendChild(g);
      s2.appendChild(this.slider(c, { l: 'Tamanho', get: () => t.size, set: v => t.size = Math.max(4, v), min: 8, max: 500, def: 100, unit: 'px' }));
      s2.appendChild(this.slider(c, { l: 'Espaço entre linhas', get: () => t.lineH, set: v => t.lineH = v, min: .6, max: 3, step: .05, def: 1.15 }));
      s2.appendChild(this.slider(c, { l: 'Espaço entre letras', get: () => t.spacing || 0, set: v => t.spacing = v, min: -20, max: 60, def: 0, unit: 'px' }));
      const r = h('<div class="btn-row"></div>'); r.appendChild(this.sw('Negrito', t.bold, v => { t.bold = v; App.commit('Negrito'); })); r.appendChild(this.sw('Itálico', t.italic, v => { t.italic = v; App.commit('Itálico'); })); r.appendChild(this.sw('Sombra', t.shadow, v => { t.shadow = v; App.commit('Sombra'); }));
      s2.appendChild(r);
      const s3 = this.sec(body, 'Cores');
      s3.appendChild(this.color('Cor do texto', t.color, v => { t.color = v; App.commit('Cor do texto'); }, v => { t.color = v; App.requestRender(); }));
      s3.appendChild(this.color('Cor do contorno', t.stroke, v => { t.stroke = v; App.commit('Cor do contorno'); }, v => { t.stroke = v; App.requestRender(); }));
      s3.appendChild(this.slider(c, { l: 'Espessura do contorno', get: () => t.strokeW, set: v => t.strokeW = v, min: 0, max: 60, def: 0, unit: 'px' }));
      s3.appendChild(this.color('Cor da caixa de fundo', t.bg || '#000000', v => { t.bg = v; App.commit('Fundo do texto'); }, v => { t.bg = v; App.requestRender(); }));
      s3.appendChild(this.slider(c, { l: 'Caixa de fundo', get: () => t.bgAmt || 0, set: v => t.bgAmt = v, min: 0, max: 100, def: 0, unit: '%' }));
    } else if (c.type === 'shape') {
      const sh = c.shape, s = this.sec(body, 'Forma');
      const chips = h(`<div class="chips">${Object.entries(SHAPES).map(([k, v]) => `<span class="chip ${sh.kind === k ? 'on' : ''}" data-k="${k}">${v}</span>`).join('')}</div>`);
      $$('[data-k]', chips).forEach(ch => ch.onclick = () => { sh.kind = ch.dataset.k; c.name = SHAPES[sh.kind]; App.commit('Forma: ' + SHAPES[sh.kind]); });
      s.appendChild(chips);
      s.appendChild(this.slider(c, { l: 'Largura', get: () => sh.w, set: v => sh.w = Math.max(1, v), min: 1, max: App.project.settings.w * 1.5, def: 400, unit: 'px' }));
      s.appendChild(this.slider(c, { l: 'Altura', get: () => sh.h, set: v => sh.h = Math.max(1, v), min: 1, max: App.project.settings.h * 1.5, def: 400, unit: 'px' }));
      if (sh.kind === 'round') s.appendChild(this.slider(c, { l: 'Arredondamento', get: () => sh.radius, set: v => sh.radius = v, min: 0, max: 500, def: 40, unit: 'px' }));
      const s2 = this.sec(body, 'Cores');
      s2.appendChild(this.sw('Preencher', sh.fillOn !== false, v => { sh.fillOn = v; App.commit('Preenchimento'); }));
      s2.appendChild(this.color('Cor de preenchimento', sh.fill, v => { sh.fill = v; App.commit('Cor da forma'); }, v => { sh.fill = v; App.requestRender(); }));
      s2.appendChild(this.color('Cor da borda', sh.stroke, v => { sh.stroke = v; App.commit('Cor da borda'); }, v => { sh.stroke = v; App.requestRender(); }));
      s2.appendChild(this.slider(c, { l: 'Espessura da borda', get: () => sh.strokeW, set: v => sh.strokeW = v, min: 0, max: 80, def: 0, unit: 'px' }));
    } else if (c.type === 'color') {
      const f = c.colorFill, s = this.sec(body, 'Cor / degradê / padrão');
      s.appendChild(this.select('Tipo', { solid: 'Cor única', gradient: 'Degradê', pattern: 'Padrão que se repete (bolinhas, xadrez…)' }, f.mode, v => { if (v === 'pattern') { const d = PatternBG.DEF(); for (const k in d) if (f[k] === undefined || k === 'mode') f[k] = d[k]; } f.mode = v; App.commit('Tipo de cor'); }));
      if (f.mode === 'pattern') {
        const pick = h(`<div class="pat-pick">${Object.entries(PATTERNS).map(([k, n]) => `<button class="${f.padrao === k ? 'on' : ''}" data-p="${k}" title="${n}"><canvas width="56" height="56"></canvas></button>`).join('')}</div>`);
        $$('[data-p]', pick).forEach(bt => { PatternBG.draw($('canvas', bt).getContext('2d'), { ...f, padrao: bt.dataset.p, size: 28, rot: 0 }, { x: 0, y: 0, w: 56, h: 56 }, 0); bt.onclick = () => { f.padrao = bt.dataset.p; c.name = 'Fundo: ' + PATTERNS[f.padrao]; App.commit('Padrão: ' + PATTERNS[f.padrao]); }; });
        s.appendChild(h(`<div class="ctl-l" style="margin:4px 0">Padrão: <b>${PATTERNS[f.padrao] || ''}</b></div>`)); s.appendChild(pick);
        s.appendChild(this.color('Cor do fundo', f.c1, v => { f.c1 = v; App.commit('Cor alterada'); }, v => { f.c1 = v; App.requestRender(); }));
        s.appendChild(this.color('Cor do desenho', f.c2, v => { f.c2 = v; App.commit('Cor alterada'); }, v => { f.c2 = v; App.requestRender(); }));
        const ex = h(`<div style="display:flex;flex-direction:column;gap:6px;margin:6px 0"><label class="switch"><input type="checkbox" data-g ${f.c3 ? 'checked' : ''}><i></i>Fundo em degradê</label><label class="switch"><input type="checkbox" data-bo ${f.bolhas ? 'checked' : ''}><i></i>Bolhas grandes subindo</label><label class="switch"><input type="checkbox" data-vi ${f.vinheta ? 'checked' : ''}><i></i>Vinheta (bordas mais escuras)</label></div>`);
        $('[data-g]', ex).onchange = e => { if (e.target.checked) f.c3 = '#2896f5'; else delete f.c3; App.commit('Degradê do fundo'); };
        $('[data-bo]', ex).onchange = e => { f.bolhas = e.target.checked; App.commit('Bolhas'); }; $('[data-vi]', ex).onchange = e => { f.vinheta = e.target.checked; App.commit('Vinheta'); };
        s.appendChild(ex);
        if (f.c3) s.appendChild(this.color('Cor de baixo (degradê)', f.c3, v => { f.c3 = v; App.commit('Cor alterada'); }, v => { f.c3 = v; App.requestRender(); }));
        s.appendChild(this.slider(c, { l: 'Transparência do desenho', get: () => Math.round((f.alpha ?? 1) * 100), set: v => f.alpha = v / 100, min: 5, max: 100, def: 100, unit: '%' }));
        if (/^bolinhas/.test(f.padrao)) s.appendChild(this.slider(c, { l: 'Pulsar as bolinhas', get: () => f.pulse || 0, set: v => f.pulse = v, min: 0, max: 1, step: .05, def: 0 }));
        s.appendChild(this.slider(c, { l: 'Tamanho do padrão', get: () => f.size, set: v => f.size = v, min: 16, max: 600, def: 120, unit: 'px' }));
        s.appendChild(this.slider(c, { l: 'Tamanho do desenho', get: () => f.scale2, set: v => f.scale2 = v, min: .05, max: .5, step: .01, def: .22 }));
        s.appendChild(this.slider(c, { l: 'Velocidade (0 = parado)', get: () => f.speed, set: v => f.speed = v, min: 0, max: 600, def: 40, unit: 'px/s' }));
        s.appendChild(this.slider(c, { l: 'Direção do movimento', get: () => f.dir, set: v => f.dir = v, min: 0, max: 360, def: 135, unit: '°' }));
        s.appendChild(this.slider(c, { l: 'Girar o padrão', get: () => f.rot, set: v => f.rot = v, min: -180, max: 180, def: 0, unit: '°' }));
        return;
      }
      s.appendChild(this.color('Cor 1', f.c1, v => { f.c1 = v; App.commit('Cor alterada'); }, v => { f.c1 = v; App.requestRender(); }));
      if (f.mode === 'gradient') {
        s.appendChild(this.color('Cor 2', f.c2, v => { f.c2 = v; App.commit('Cor alterada'); }, v => { f.c2 = v; App.requestRender(); }));
        s.appendChild(this.slider(c, { l: 'Ângulo', get: () => f.angle, set: v => f.angle = v, min: 0, max: 360, def: 90, unit: '°' }));
      }
    } else {
      const m = Assets.meta(c.assetId), s = this.sec(body, 'Mídia');
      if (!m) { s.appendChild(h(`<div class="hint" style="border-color:#6b2a37">${ic('alert', 13)} A mídia deste clipe não foi encontrada. Use <b>Trocar mídia</b> para escolher outra.</div>`)); }
      else s.appendChild(h(`<div class="info-grid"><span>Arquivo</span><b style="word-break:break-all">${esc(m.name)}</b><span>Tamanho</span><b>${m.w || '?'} × ${m.h || '?'}</b>${m.dur ? `<span>Duração</span><b>${fmtSec(m.dur)}</b>` : ''}<span>Peso</span><b>${fmtBytes(m.size || 0)}</b>${c.type === 'video' ? `<span>Áudio</span><b>${m.hasAudio ? 'sim' : 'não'}</b>` : ''}</div>`));
      if (c.type === 'image') {
        const bd = c.badge, row = h(`<div style="margin:6px 0"><label class="switch"><input type="checkbox" ${bd?.on ? 'checked' : ''}><i></i>Moldura em círculo (selo)</label></div>`);
        $('input', row).onchange = e => { if (e.target.checked) c.badge = Badge.DEF(); else delete c.badge; App.commit('Moldura'); }; s.appendChild(row);
        if (bd?.on) { s.appendChild(this.color('Cor de dentro', bd.cor, v => { bd.cor = v; App.commit('Cor da moldura'); }, v => { bd.cor = v; App.requestRender(); })); s.appendChild(this.color('Cor da borda', bd.borda, v => { bd.borda = v; App.commit('Cor da moldura'); }, v => { bd.borda = v; App.requestRender(); })); s.appendChild(this.slider(c, { l: 'Espessura da borda', get: () => bd.esp, set: v => bd.esp = v, min: 0, max: 20, step: .5, def: 5, unit: '%' })); }
      }
      const r = h(`<div class="btn-row"><button class="btn sm" data-a="crop">${ic('crop', 13)}Recortar…</button><button class="btn sm" data-a="rep">${ic('upload', 13)}Trocar mídia…</button>${c.type === 'video' ? `<button class="btn sm" data-a="frz">Congelar quadro</button>` : ''}</div>`);
      $('[data-a=rep]', r).onclick = () => Actions.replaceMedia(c); $('[data-a=crop]', r).onclick = () => CropEditor.open(c);
      if ($('[data-a=frz]', r)) $('[data-a=frz]', r).onclick = () => Actions.freezeFrame(c);
      s.appendChild(r);
      if (c.type === 'video' || c.type === 'gif') this.sec(body, 'Início do trecho').appendChild(this.slider(c, { l: 'Começar o vídeo a partir de', get: () => c.offset || 0, set: v => c.offset = Math.max(0, v), min: 0, max: m?.dur || 60, step: .01, def: 0, unit: 's', kf: false }));
      if (c.type === 'gif') this.sec(body, 'GIF').appendChild(h(`<div class="hint">${m?.animated ? 'GIF animado: repete sozinho enquanto o clipe durar.' : 'Este GIF tem um quadro só (ou o navegador não conseguiu ler a animação — use o Chrome ou Edge).'}</div>`));
    }
  },

  /* ---------- Animações / Efeitos (lista) ---------- */
  tabAnim(body, c) { this.instList(body, c, 'anim'); },
  tabFx(body, c) { this.instList(body, c, 'fx'); },
  instList(body, c, kind) {
    const defs = kind === 'anim' ? ANIMS : FX, list = kind === 'anim' ? c.anims : c.fx;
    const top = this.sec(body, kind === 'anim' ? 'Animações deste clipe' : 'Efeitos deste clipe');
    const add = h(`<button class="btn add-btn">${ic('plus', 14)} ${kind === 'anim' ? 'Adicionar animação…' : 'Adicionar efeito…'}</button>`);
    add.onclick = async () => { const id = await Picker.open(kind, { filter: d => !(d.onlyText && c.type !== 'text') }); if (id) kind === 'anim' ? Actions.addAnim([c], id, App.t) : Actions.addFx([c], id, App.t); };
    top.appendChild(add);
    if (!list.length) top.appendChild(h(`<div class="hint">${kind === 'anim' ? 'Nenhuma animação. Escolha acima ou <b>arraste da biblioteca</b> (aba Animações) para cima do clipe. Ela começa onde está o cursor vermelho.' : 'Nenhum efeito. Escolha acima ou arraste da aba Efeitos. Para afetar a <b>tela toda</b>, solte o efeito numa faixa de efeitos.'}</div>`));
    else {
      const r = h(`<div class="btn-row"><button class="btn sm" data-a="next">${ic('right', 12)} Repetir nos próximos clipes…</button><button class="btn sm" data-a="save">${ic('bookmark', 12)} Salvar</button><button class="btn sm" data-a="copy">${ic('copy', 12)} Copiar</button></div>`);
      $('[data-a=next]', r).onclick = () => Actions.applyToNextDialog(c, kind); $('[data-a=save]', r).onclick = () => Actions.savePresetFromClip(c, kind); $('[data-a=copy]', r).onclick = () => Actions.copyEffects(c, kind);
      top.appendChild(r);
    }
    list.forEach(inst => body.appendChild(this.instCard(c, inst, kind)));
  },
  instCard(c, inst, kind) {
    const def = (kind === 'anim' ? ANIMS : FX)[inst.type], seld = App.selFx?.id === inst.id;
    const card = h(`<div class="icard ${seld ? 'sel' : ''}" data-inst="${inst.id}"><div class="icard-h"><span class="dot" style="background:${kind === 'anim' ? '#ffd34d' : '#d9a8ff'}"></span><b>${esc(def?.name || inst.type)}</b>
      ${kind === 'fx' ? `<button class="ibtn xs" data-a="on" title="${inst.on === false ? 'Ligar' : 'Desligar'}">${ic(inst.on === false ? 'eyeOff' : 'eye', 13)}</button>` : ''}
      ${def?.sound || inst.sound?.mode !== 'off' ? `<button class="ibtn xs ${inst.sound?.mode === 'off' ? 'off' : ''}" data-a="snd" title="${inst.sound?.mode === 'off' ? 'Sem som — clique para usar o som padrão' : 'Com som — clique para deixar sem som'}">${ic(inst.sound?.mode === 'off' ? 'mute' : 'vol', 13)}</button>` : ''}
      <button class="ibtn xs" data-a="go" title="Ver na prévia (toca junto o que começa no mesmo momento)">${ic('play', 11)}</button>
      <button class="ibtn xs" data-a="dup" title="Duplicar">${ic('dup', 13)}</button><button class="ibtn xs" data-a="more" title="Mais">${ic('dots', 13)}</button><button class="ibtn xs" data-a="del" title="Remover">${ic('trash', 13)}</button></div></div>`);
    card.onclick = e => { if (App.selFx?.id !== inst.id && !e.target.closest('input,select,button,label')) { App.selFx = { clipId: c.id, kind, id: inst.id }; App.refresh(); } };
    if (def?.hint) card.appendChild(h(`<div class="hint" style="margin:0 0 8px">${def.hint}</div>`));
    const g = h('<div class="grid2"></div>');
    g.appendChild(this.timeField('Começa em (s)', inst.start, v => { inst.start = clamp(App.frame(v), 0, c.dur); App.commit('Início alterado'); }));
    g.appendChild(this.timeField('Duração (s)', inst.dur, v => { inst.dur = Math.max(1 / App.fps, App.frame(v)); App.commit('Duração alterada'); }));
    card.appendChild(g);
    this.paramControls(card, c, def, inst.params);
    if (kind === 'fx') {
      card.appendChild(this.slider(c, { l: 'Intensidade geral', get: () => inst.amount ?? 100, set: v => inst.amount = v, min: 0, max: 100, def: 100, unit: '%', kf: false }));
      card.appendChild(this.slider(c, { l: 'Entrar/sair suave', get: () => inst.fade || 0, set: v => inst.fade = v, min: 0, max: 3, step: .05, def: 0, unit: 's', kf: false }));
    }
    card.appendChild(this.soundBox(inst, def));
    $('[data-a=del]', card).onclick = () => Actions.removeFxInst({ clipId: c.id, kind, id: inst.id });
    if ($('[data-a=snd]', card)) $('[data-a=snd]', card).onclick = () => this.toggleSound(inst, def);
    $('[data-a=dup]', card).onclick = () => { const n = clone(inst); n.id = uid('i_'); n.start = Math.min(c.dur - 1 / App.fps, inst.start + inst.dur); (kind === 'anim' ? c.anims : c.fx).push(n); App.commit('Duplicado', { toast: true }); };
    $('[data-a=go]', card).onclick = () => {
      // toca junto tudo que começa no mesmo momento (animação + efeito)
      const all = [...c.anims, ...c.fx].filter(i => Math.abs(i.start - inst.start) < 1.5 / App.fps || (i.start < inst.start + inst.dur && i.start + i.dur > inst.start));
      const end = Math.max(...all.map(i => i.start + i.dur));
      if (App.playing) App.pause();
      App.seek(c.start + inst.start); App.play({ stopAt: Math.min(c.start + c.dur, c.start + end + .15), keepPos: true });
    };
    $('[data-a=more]', card).onclick = e => UI.ctx(e.clientX, e.clientY, [
      { label: 'Repetir nos próximos clipes…', icon: 'right', action: () => Actions.applyToNextDialog(c, kind, inst) },
      { label: 'Salvar como predefinição…', icon: 'bookmark', action: () => Actions.savePresetInst(inst, kind) },
      { label: 'Copiar só este', icon: 'copy', action: () => Actions.copyEffects(c, kind, inst) },
      { label: 'Começar no cursor', icon: 'clock', action: () => { inst.start = clamp(App.frame(App.t - c.start), 0, c.dur); App.commit('Movido para o cursor'); } },
      { label: 'Ocupar o clipe inteiro', action: () => { inst.start = 0; inst.dur = c.dur; App.commit('Ocupando o clipe inteiro'); } },
      { label: 'Voltar valores padrão', action: () => { inst.params = defaultParams(def); App.commit('Valores padrão'); } },
    ]);
    if ($('[data-a=on]', card)) $('[data-a=on]', card).onclick = () => { inst.on = inst.on === false; App.commit(inst.on === false ? 'Efeito desligado' : 'Efeito ligado', { toast: true }); };
    return card;
  },
  paramControls(box, c, def, P, onChange) {
    for (const p of def?.params || []) {
      if (p.type === 'bool') { const s = this.sw(p.l, P[p.k], v => { P[p.k] = v; App.commit(p.l); onChange && onChange(); }); s.style.margin = '4px 0 8px'; box.appendChild(s); }
      else if (p.type === 'select') box.appendChild(Object.assign(this.select(p.l, p.opts, P[p.k], v => { P[p.k] = v; App.commit(p.l); onChange && onChange(); }), { style: 'margin-bottom:8px' }));
      else if (p.type === 'ease') box.appendChild(Object.assign(this.select(p.l, EASE_NAMES, P[p.k], v => { P[p.k] = v; App.commit(p.l); onChange && onChange(); }), { style: 'margin-bottom:8px' }));
      else if (p.type === 'color') box.appendChild(this.color(p.l, P[p.k], v => { P[p.k] = v; App.commit(p.l); }, v => { P[p.k] = v; App.requestRender(); }));
      else box.appendChild(this.slider(c, { l: p.l, get: () => P[p.k], set: v => P[p.k] = v, min: p.min, max: p.max, step: p.step, def: p.def, unit: p.unit, kf: false, after: onChange }));
    }
    if (P.points) {
      const r = h(`<div class="hint">${ic('move', 13)} <b>${P.points.length} pontos.</b> Selecione esta animação e arraste os pontos na prévia. Clique 2x na prévia para adicionar ponto; botão direito num ponto para remover.<div class="btn-row"><button class="btn sm" data-a="r">Recomeçar caminho</button><button class="btn sm" data-a="sel">Editar na prévia</button></div></div>`);
      $('[data-a=r]', r).onclick = () => { P.points = clone(ANIMS.path.defaults.points); App.commit('Caminho recomeçado'); };
      $('[data-a=sel]', r).onclick = () => { const inst = c.anims.find(a => a.params === P); if (inst) { App.selFx = { clipId: c.id, kind: 'anim', id: inst.id }; App.seek(c.start + inst.start); App.refresh(); } };
      box.appendChild(r);
    }
  },
  toggleSound(inst, def) {
    inst.sound ||= defaultSound(def); const s = inst.sound;
    if (s.mode === 'off') { if (s.lastMode === 'custom' && s.assetId) s.mode = 'custom'; else { s.mode = 'default'; s.id = s.lastId || def?.sound || s.id; } if (!s.id && s.mode === 'default') { s.mode = 'off'; return UI.toast('Este item não tem som padrão — escolha um som na lista', { kind: 'warn' }); } }
    else { s.lastMode = s.mode; s.lastId = s.id; s.mode = 'off'; }
    App.commit(s.mode === 'off' ? 'Sem som' : 'Som ligado', { toast: true });
    if (s.mode !== 'off') AudioEngine.preview(s.mode === 'custom' ? s.assetId : 'snd:' + s.id, (s.vol ?? 80) / 100);
  },
  // escolha do som: padrão / outro pré-pronto / da biblioteca / sem som
  soundBox(inst, def) {
    inst.sound ||= defaultSound(def);
    const s = inst.sound, assets = Assets.list(App.project.id).filter(a => a.kind === 'audio' || (a.kind === 'video' && a.hasAudio));
    const opts = [`<option value="off" ${s.mode === 'off' ? 'selected' : ''}>Sem som</option>`];
    if (def?.sound) opts.push(`<option value="default:${def.sound}" ${s.mode === 'default' && (!s.id || s.id === def.sound) ? 'selected' : ''}>Som padrão: ${SOUNDS.defs[def.sound]?.name}</option>`);
    opts.push(`<optgroup label="Sons pré-prontos">${SOUNDS.list().map(x => `<option value="snd:${x.id}" ${s.mode === 'default' && s.id === x.id && x.id !== def?.sound ? 'selected' : ''}>${x.name}</option>`).join('')}</optgroup>`);
    if (assets.length) opts.push(`<optgroup label="Meus sons (biblioteca)">${assets.map(a => `<option value="a:${a.id}" ${s.mode === 'custom' && s.assetId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</optgroup>`);
    const box = h(`<div class="snd"><div class="snd-row"><button class="ibtn xs ${s.mode === 'off' ? 'off' : ''}" data-a="tg" title="${s.mode === 'off' ? 'Clique para usar o som padrão' : 'Clique para deixar sem som'}">${ic(s.mode === 'off' ? 'mute' : 'vol', 14)}</button><select>${opts.join('')}</select><button class="ibtn xs" data-a="pv" title="Ouvir">${ic('play', 11)}</button><button class="ibtn xs" data-a="up" title="Usar um som do computador">${ic('upload', 12)}</button></div></div>`);
    const sel = $('select', box);
    $('[data-a=tg]', box).onclick = () => this.toggleSound(inst, def);
    sel.onchange = () => {
      const v = sel.value;
      if (v === 'off') s.mode = 'off';
      else if (v.startsWith('default:')) { s.mode = 'default'; s.id = def.sound; }
      else if (v.startsWith('snd:')) { s.mode = 'default'; s.id = v.slice(4); }
      else if (v.startsWith('a:')) { s.mode = 'custom'; s.assetId = v.slice(2); }
      App.commit('Som alterado'); if (s.mode !== 'off') AudioEngine.preview(s.mode === 'custom' ? s.assetId : 'snd:' + (s.id || def.sound), (s.vol ?? 80) / 100);
    };
    $('[data-a=pv]', box).onclick = () => { if (s.mode === 'off') return; AudioEngine.preview(s.mode === 'custom' ? s.assetId : 'snd:' + (s.id || def.sound), (s.vol ?? 80) / 100); };
    $('[data-a=up]', box).onclick = async () => { const f = await pickFiles('audio/*,video/*', false); if (!f.length) return; const rt = await Actions.importFiles(f, { silent: true }); if (rt[0]) { s.mode = 'custom'; s.assetId = rt[0].meta.id; App.commit('Som personalizado escolhido', { toast: true }); } };
    if (s.mode !== 'off') {
      const fake = { kf: {}, start: 0 };
      box.appendChild(this.slider(fake, { l: 'Volume do som', get: () => s.vol ?? 80, set: v => s.vol = v, min: 0, max: 150, def: 80, unit: '%', kf: false }));
    }
    return box;
  },

  /* ---------- Cores ---------- */
  tabColor(body, c) {
    const s = this.sec(body, 'Filtros prontos');
    const chips = h(`<div class="chips">${Object.entries(COLOR_PRESETS).map(([k, v]) => `<span class="chip" data-k="${k}">${v.name}</span>`).join('')}</div>`);
    $$('[data-k]', chips).forEach(ch => ch.onclick = () => { const tint = c.color.tint; c.color = { ...COLOR_DEFAULT(), tint, ...COLOR_PRESETS[ch.dataset.k].v }; for (const k of Object.keys(c.kf)) if (k.startsWith('color.')) delete c.kf[k]; App.commit('Filtro: ' + COLOR_PRESETS[ch.dataset.k].name, { toast: true }); });
    s.appendChild(chips);
    const s2 = this.sec(body, 'Ajustes', `<span class="sp"></span><button class="btn sm ghost" data-a="reset">Zerar</button>`);
    $('[data-a=reset]', s2).onclick = () => { c.color = { ...COLOR_DEFAULT(), tint: c.color.tint }; for (const k of Object.keys(c.kf)) if (k.startsWith('color.')) delete c.kf[k]; App.commit('Cores zeradas', { toast: true }); };
    COLOR_PROPS.forEach(p => { if (p.k === 'tintAmt') return; s2.appendChild(this.slider(c, { l: p.l, path: 'color.' + p.k, min: p.min, max: p.max, step: p.step, def: p.def, unit: p.unit })); });
    const s3 = this.sec(body, 'Colorir');
    s3.appendChild(this.color('Cor', c.color.tint || '#ff8a2a', v => { c.color.tint = v; App.commit('Cor de colorir'); }, v => { c.color.tint = v; App.requestRender(); }));
    s3.appendChild(this.slider(c, { l: 'Intensidade da cor', path: 'color.tintAmt', min: 0, max: 100, def: 0, unit: '%' }));
  },

  /* ---------- Transições ---------- */
  tabTrans(body, c) {
    for (const [side, label] of [['in', 'Entrada (quando aparece)'], ['out', 'Saída (quando some)']]) {
      const key = side === 'in' ? 'trIn' : 'trOut', tr = c[key], s = this.sec(body, label);
      const pick = async () => { const id = await Picker.open('trans', { current: tr?.type, allowNone: true, noneLabel: 'Nenhuma (corte seco)', title: 'Transição de ' + (side === 'in' ? 'entrada' : 'saída') }); if (id) Actions.setTrans([c], side, id === '__none' ? null : id); };
      if (tr?.type) {
        const cb = h(`<div class="cur-block"><div class="cb-btns"><button class="btn sm" data-a="ch">${ic('transition', 13)} Trocar…</button><button class="btn sm" data-a="rm">${ic('x', 13)} Remover</button></div></div>`);
        const card = LibUI.card('trans', tr.type); card.onclick = pick; cb.prepend(card);
        $('[data-a=ch]', cb).onclick = pick; $('[data-a=rm]', cb).onclick = () => Actions.setTrans([c], side, null);
        s.appendChild(cb);
      } else { const b = h(`<button class="btn add-btn">${ic('plus', 14)} Escolher transição…</button>`); b.onclick = pick; s.appendChild(b); }
      if (tr?.type) {
        const def = TRANS[tr.type], box = h('<div class="tr-block"></div>');
        box.appendChild(this.slider(c, { l: 'Duração', get: () => tr.dur, set: v => tr.dur = clamp(v, .05, c.dur), min: .05, max: Math.min(5, c.dur), step: .05, def: def.dur, unit: 's', kf: false, after: () => Timeline.render() }));
        this.paramControls(box, c, def, tr.params);
        box.appendChild(this.soundBox(tr, def));
        const r = h(`<div class="btn-row"><button class="btn sm" data-a="all">Usar em todos os clipes desta faixa</button><button class="btn sm" data-a="see">Ver</button></div>`);
        $('[data-a=all]', r).onclick = () => Actions.transToTrack(c, side);
        $('[data-a=see]', r).onclick = () => { App.seek(side === 'in' ? Math.max(0, c.start - .3) : c.start + c.dur - tr.dur - .3); App.play(); setTimeout(() => App.pause(), (tr.dur + .8) * 1000); };
        box.appendChild(r);
        s.appendChild(box);
      }
    }
    body.appendChild(h(`<div class="hint">Dica: para uma transição entre dois clipes na mesma faixa, deixe um colado no outro e coloque a transição de <b>entrada</b> no segundo.</div>`));
  },

  /* ---------- Áudio ---------- */
  tabAudio(body, c) {
    const s = this.sec(body, 'Volume');
    s.appendChild(this.slider(c, { l: 'Volume', path: 'volume', min: 0, max: 200, def: 100, unit: '%' }));
    s.appendChild(this.slider(c, { l: 'Aumentar no começo (fade in)', get: () => c.fadeIn || 0, set: v => c.fadeIn = v, min: 0, max: Math.min(10, c.dur), step: .05, def: 0, unit: 's', kf: false }));
    s.appendChild(this.slider(c, { l: 'Abaixar no final (fade out)', get: () => c.fadeOut || 0, set: v => c.fadeOut = v, min: 0, max: Math.min(10, c.dur), step: .05, def: 0, unit: 's', kf: false }));
    const rv = h(`<div class="btn-row"><button class="btn sm" data-a="pv">${ic('cursor', 12)} Volume igual ao de…</button>${[50, 100, 150].map(v => `<span class="chip" data-v="${v}">${v}%</span>`).join('')}</div>`);
    $('[data-a=pv]', rv).onclick = () => Actions.pickVolume(App.selected().length > 1 ? App.selected() : [c]);
    $$('[data-v]', rv).forEach(x => x.onclick = () => Actions.setVolume([c], +x.dataset.v));
    s.appendChild(rv);
    const r = h('<div class="btn-row"></div>');
    r.appendChild(this.sw('Silenciar este clipe', c.muted, v => { c.muted = v; App.commit(v ? 'Clipe silenciado' : 'Som ativado', { toast: true }); }));
    if (c.type === 'audio') r.appendChild(this.sw('Repetir (loop)', c.loop, v => { c.loop = v; App.commit('Loop'); }));
    s.appendChild(r);
    if (c.type === 'audio') {
      const s2 = this.sec(body, 'Velocidade e trecho');
      s2.appendChild(this.slider(c, { l: 'Velocidade (muda o tom)', get: () => c.speed || 1, set: v => c.speed = clamp(v, .25, 4), min: .25, max: 3, step: .05, def: 1, unit: 'x', kf: false }));
      s2.appendChild(this.slider(c, { l: 'Começar o som a partir de', get: () => c.offset || 0, set: v => c.offset = Math.max(0, v), min: 0, max: Assets.meta(c.assetId)?.dur || 10, step: .01, def: 0, unit: 's', kf: false }));
    } else if (c.type === 'video') {
      body.appendChild(h(`<div class="hint">Quer editar o som separado? Botão direito no clipe → <b>Separar o áudio do vídeo</b>.</div>`));
      const s3 = this.sec(body, 'Efeitos de voz'); this.afxControls(s3, c);
    }
  },
  // transcrição do áudio do clipe (tempos já na linha do tempo)
  tabTr(body, c) {
    const id = c.assetId, tr = Transcribe.get(id), s = this.sec(body, 'Transcrição do áudio');
    const sp = c.speed || 1, o = c.offset || 0, T = x => c.start + (x - o) / sp;
    if (!tr || (!tr.segs?.length && tr.status !== 'transcrevendo')) {
      s.appendChild(h(`<p class="hint" style="margin:0 0 8px">${tr?.status === 'erro' ? `${ic('alert', 12)} A transcrição deu erro: ${esc(tr.erro || '')}` : 'Este áudio ainda não foi transcrito. A transcrição ajuda a IA a saber o que é falado e quando.'}</p>`));
      const b = h(`<button class="btn sm primary">${ic('text', 12)} ${tr?.status === 'erro' ? 'Tentar de novo' : 'Transcrever agora'}</button>`); b.onclick = () => { Transcribe.run(id); setTimeout(() => this.render(), 50); }; s.appendChild(b); return;
    }
    if (tr.status === 'transcrevendo') s.appendChild(h(`<p class="hint" style="margin:0 0 8px"><span class="spin-dot"></span> Transcrevendo… pode continuar editando.</p>`));
    const segs = (tr.segs || []).filter(x => x.e > o && x.s < o + c.dur * sp);
    const box = h(`<div class="tr-side">${segs.length ? segs.map(x => `<div class="tr-li" data-t="${Math.max(c.start, T(x.s))}" title="Clique para ir até essa fala"><span>${fmtSec(Math.max(c.start, T(x.s)))}</span>${esc(x.t)}</div>`).join('') : '<div class="hint">Nenhuma fala neste pedaço do áudio.</div>'}</div>`);
    $$('.tr-li', box).forEach(el => el.onclick = () => App.seek(+el.dataset.t));
    s.appendChild(box);
    const r = h(`<div class="btn-row"><button class="btn sm primary" data-a="ed">${ic('edit', 12)} Ver / editar transcrição</button><button class="btn sm" data-a="re">${ic('mic', 12)} Transcrever de novo</button></div>`);
    $('[data-a=ed]', r).onclick = () => Transcribe.open(id); $('[data-a=re]', r).onclick = () => Transcribe.run(id);
    s.appendChild(r);
    if (tr.editada) s.appendChild(h(`<small style="color:var(--tx3)">${ic('check', 10)} Corrigida por você</small>`));
  },
  tabAfx(body, c) { const s = this.sec(body, 'Efeitos no som'); this.afxControls(s, c); },
  afxControls(s, c) {
    const a = c.afx ||= AFX_DEFAULT(); const fake = { kf: {}, start: 0 };
    s.appendChild(this.slider(fake, { l: 'Graves', get: () => a.bass, set: v => a.bass = v, min: -20, max: 20, def: 0, unit: 'dB', kf: false }));
    s.appendChild(this.slider(fake, { l: 'Agudos', get: () => a.treble, set: v => a.treble = v, min: -20, max: 20, def: 0, unit: 'dB', kf: false }));
    s.appendChild(this.slider(fake, { l: 'Eco', get: () => a.echo, set: v => a.echo = v, min: 0, max: 100, def: 0, unit: '%', kf: false }));
    if (a.echo) s.appendChild(this.slider(fake, { l: 'Tempo do eco', get: () => a.echoTime, set: v => a.echoTime = v, min: .05, max: 1.5, step: .01, def: .25, unit: 's', kf: false }));
    s.appendChild(this.slider(fake, { l: 'Distorção', get: () => a.dist, set: v => a.dist = v, min: 0, max: 100, def: 0, unit: '%', kf: false }));
    s.appendChild(this.slider(fake, { l: 'Adicionar chiado (ruído)', get: () => a.noise, set: v => a.noise = v, min: 0, max: 100, def: 0, unit: '%', kf: false }));
    s.appendChild(this.slider(fake, { l: 'Esquerda ↔ Direita', get: () => a.pan, set: v => a.pan = v, min: -100, max: 100, def: 0, kf: false }));
    const r = h('<div class="btn-row"></div>'); r.appendChild(this.sw('Voz de telefone / rádio', a.phone, v => { a.phone = v; App.commit('Efeito de telefone'); })); s.appendChild(r);
    const ch = h(`<div class="chips" style="margin-top:6px"><span class="chip" data-p="0">Normal</span><span class="chip" data-p="1">Rádio</span><span class="chip" data-p="2">Caverna</span><span class="chip" data-p="3">Alto-falante estourado</span><span class="chip" data-p="4">TV velha</span></div>`);
    $$('[data-p]', ch).forEach(x => x.onclick = () => { const pr = [AFX_DEFAULT(), { ...AFX_DEFAULT(), phone: true, dist: 15 }, { ...AFX_DEFAULT(), echo: 55, echoTime: .32, bass: 4 }, { ...AFX_DEFAULT(), dist: 70, bass: 6 }, { ...AFX_DEFAULT(), phone: true, noise: 35, treble: -4 }][+x.dataset.p]; c.afx = pr; App.commit('Efeito de som aplicado', { toast: true }); });
    s.appendChild(ch);
  },

  /* ---------- Keyframes ---------- */
  kfView: 'visual',
  tabKeys(body, c) {
    const paths = Object.keys(c.kf || {}).filter(k => c.kf[k].length);
    const top = this.sec(body, 'Keyframes (animação manual)');
    top.appendChild(h(`<div class="hint">Jeito mais rápido: ligue o <b>Modo animar</b> (tecla A), mova o cursor vermelho e mexa no objeto na prévia — cada mudança vira um keyframe.<br>Aqui embaixo dá para <b>arrastar os ◆</b> (para os lados = tempo, para cima/baixo = valor). Clique 2x na linha para criar um ◆.</div>`));
    const r = h(`<div class="btn-row"><button class="btn sm ${App.autoKey ? 'on' : ''}" data-a="ak" style="${App.autoKey ? 'border-color:#ff4d6a;background:rgba(255,77,106,.18)' : ''}">${ic('diamond', 12)} ${App.autoKey ? 'Modo animar: ligado' : 'Ligar modo animar'}</button><button class="btn sm primary" data-a="q">${ic('move', 12)} De → Para</button><button class="btn sm" data-a="k">${ic('diamond', 12)} Marcar posição/tamanho/giro</button></div>`);
    $('[data-a=ak]', r).onclick = () => { App.setAutoKey(!App.autoKey); this.render(); };
    $('[data-a=q]', r).onclick = () => Actions.quickAnim(); $('[data-a=k]', r).onclick = () => Actions.keyAll();
    top.appendChild(r);
    if (!paths.length) return;
    const times = KF.times(c);
    const rn = h(`<div class="btn-row" style="align-items:center"><button class="btn sm" data-a="prev">${ic('left', 12)} Anterior</button><button class="btn sm" data-a="next">Próximo ${ic('right', 12)}</button><span class="sp"></span><div class="seg"><button class="ibtn ${this.kfView === 'visual' ? 'on' : ''}" data-v="visual" title="Editar arrastando">${ic('wave', 13)}</button><button class="ibtn ${this.kfView === 'num' ? 'on' : ''}" data-v="num" title="Editar pelos números">${ic('sliders', 13)}</button></div><button class="btn sm danger" data-a="clr" title="Apagar todos">${ic('trash', 12)}</button></div>`);
    $('[data-a=prev]', rn).onclick = () => { const lt = App.t - c.start, t = [...times].reverse().find(t => t < lt - 1e-3); if (t !== undefined) App.seek(c.start + t); };
    $('[data-a=next]', rn).onclick = () => { const lt = App.t - c.start, t = times.find(t => t > lt + 1e-3); if (t !== undefined) App.seek(c.start + t); };
    $$('[data-v]', rn).forEach(b => b.onclick = () => { this.kfView = b.dataset.v; this.render(); });
    $('[data-a=clr]', rn).onclick = async () => { if (await UI.confirm({ title: 'Apagar keyframes?', msg: `Todos os <b>${times.length}</b> keyframes deste clipe serão apagados. A animação manual some (as animações prontas continuam).`, ok: 'Apagar', danger: true })) { c.kf = {}; App.commit('Keyframes apagados', { toast: true }); } };
    top.appendChild(rn);
    for (const p of paths) {
      const s = this.sec(body, ANIMATABLE[p]?.l || p, `<span class="sp"></span><button class="ibtn xs" title="Apagar todos desta propriedade">${ic('trash', 12)}</button>`);
      $('.ibtn', s).onclick = () => { delete c.kf[p]; App.commit('Keyframes apagados', { toast: true }); };
      if (this.kfView === 'visual') { s.appendChild(this.kfEditor(c, p)); continue; }
      c.kf[p].forEach((k, i) => {
        const row = h(`<div class="ctl-row" style="margin-bottom:6px"><button class="ibtn xs" title="Ir para este keyframe">${ic('diamond', 11)}</button>
          <input type="text" value="${fmtNum(k.t, 2)}" style="width:58px" title="Tempo (s, dentro do clipe)"><input type="number" value="${round(k.v, 3)}" style="width:72px" title="Valor">
          <select style="flex:1" title="Como chega no próximo">${Object.entries(EASE_NAMES).map(([e, n]) => `<option value="${e}" ${k.e === e ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <button class="ibtn xs" data-a="x" title="Remover">${ic('x', 12)}</button></div>`);
        const [go] = $$('button', row), [ti, vi] = $$('input', row);
        go.onclick = () => App.seek(c.start + k.t);
        ti.onchange = () => { const n = parseNum(ti.value); if (!isNaN(n)) { k.t = clamp(n, 0, c.dur); c.kf[p].sort((a, b) => a.t - b.t); App.commit('Keyframe movido'); } };
        vi.onchange = () => { k.v = +vi.value; App.commit('Keyframe alterado'); };
        $('select', row).onchange = e => { k.e = e.target.value; App.commit('Movimento do keyframe'); };
        $('[data-a=x]', row).onclick = () => { c.kf[p].splice(i, 1); if (!c.kf[p].length) delete c.kf[p]; App.commit('Keyframe removido'); };
        s.appendChild(row);
      });
    }
  },
  // editor visual: curva do valor no tempo, com ◆ arrastáveis
  kfEditor(c, p) {
    const wrap = h(`<div><canvas class="kfe"></canvas><div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--tx3);margin-top:3px"><span>0s</span><span data-info></span><span>${fmtSec(c.dur)}</span></div></div>`);
    const cv = $('canvas', wrap), d = devicePixelRatio || 1, W = Math.max(200, (this.el.clientWidth || 320) - 26), H = 96;
    cv.width = W * d; cv.height = H * d; cv.style.height = H + 'px';
    const g = cv.getContext('2d'); g.scale(d, d);
    const pad = 10, keys = () => c.kf[p] || [];
    let range = null;
    const calcRange = () => { const vs = keys().map(k => k.v); for (let i = 0; i <= 40; i++) vs.push(KF.value(c, p, c.dur * i / 40)); let lo = Math.min(...vs), hi = Math.max(...vs); if (hi - lo < 1e-6) { lo -= 1; hi += 1; } const m = (hi - lo) * .15; return [lo - m, hi + m]; };
    const X = t => pad + t / c.dur * (W - pad * 2), T = x => clamp((x - pad) / (W - pad * 2) * c.dur, 0, c.dur);
    const Y = v => H - pad - (v - range[0]) / (range[1] - range[0]) * (H - pad * 2), V = y => range[0] + (H - pad - y) / (H - pad * 2) * (range[1] - range[0]);
    const info = $('[data-info]', wrap), unit = ANIMATABLE[p]?.unit || '';
    const draw = (hot) => {
      range ||= calcRange();
      g.clearRect(0, 0, W, H);
      g.strokeStyle = '#23262d'; g.lineWidth = 1; for (let i = 1; i < 4; i++) { const y = pad + (H - pad * 2) * i / 4; g.beginPath(); g.moveTo(pad, y); g.lineTo(W - pad, y); g.stroke(); }
      g.fillStyle = '#6c707a'; g.font = '10px system-ui'; g.fillText(round(range[1], 2), pad + 2, pad + 9); g.fillText(round(range[0], 2), pad + 2, H - pad - 2);
      const lt = App.t - c.start; if (lt >= 0 && lt <= c.dur) { g.strokeStyle = '#ff4d6a'; g.beginPath(); g.moveTo(X(lt), 0); g.lineTo(X(lt), H); g.stroke(); }
      g.strokeStyle = '#ffb020'; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i <= 160; i++) { const t = c.dur * i / 160, x = X(t), y = Y(KF.value(c, p, t)); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      keys().forEach(k => { const x = X(k.t), y = Y(k.v), r = k === hot ? 7 : 5.5; g.fillStyle = k === hot ? '#fff' : '#ffb020'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill(); g.stroke(); });
      if (hot) info.textContent = `${fmtSec(hot.t)} · ${round(hot.v, 2)}${unit}`; else info.textContent = `${keys().length} keyframe(s)`;
    };
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const near = q => keys().find(k => Math.hypot(X(k.t) - q.x, Y(k.v) - q.y) < 9);
    cv.onpointermove = e => { if (e.buttons) return; const k = near(pos(e)); cv.style.cursor = k ? 'grab' : 'crosshair'; draw(k); };
    cv.onpointerleave = () => draw();
    cv.onpointerdown = e => {
      if (e.button !== 0) return;
      const q = pos(e), k = near(q);
      if (!k) { App.seek(c.start + T(q.x)); draw(); return; }
      const t0 = k.t, v0 = k.v, isInt = !String(p).startsWith('tr.scale') && !['tr.sx', 'tr.sy'].includes(p); let moved = false;
      dragPointer(e, (ev, dx, dy) => {
        moved = true;
        if (!ev.shiftKey) k.t = round(App.frame(clamp(T(X(t0) + dx), 0, c.dur)), 4);
        if (!ev.altKey) { const nv = V(Y(v0) + dy); k.v = isInt ? round(nv, 1) : round(nv, 3); }
        keys().sort((a, b) => a.t - b.t); draw(k); App.requestRender();
      }, () => { if (moved) { range = null; App.commit('Keyframe ajustado'); } else App.seek(c.start + k.t); });
    };
    cv.ondblclick = e => { const q = pos(e), t = T(q.x); KF.set(c, p, App.frame(t), round(KF.value(c, p, t), 3)); range = null; App.commit('Keyframe adicionado', { toast: true }); };
    cv.oncontextmenu = e => {
      e.preventDefault(); const k = near(pos(e)); if (!k) return;
      UI.ctx(e.clientX, e.clientY, [
        { head: `${fmtSec(k.t)} · ${round(k.v, 2)}${unit}` },
        { label: 'Como chega no próximo', icon: 'wave', sub: Object.entries(EASE_NAMES).map(([x, n]) => ({ label: n, checked: k.e === x, action: () => { k.e = x; App.commit('Movimento: ' + n); } })) },
        { label: 'Digitar valor…', icon: 'edit', action: async () => { const v = await UI.prompt({ title: 'Valor do keyframe', label: (ANIMATABLE[p]?.l || p) + ' em ' + fmtSec(k.t), value: String(round(k.v, 3)).replace('.', ',') }); if (v !== null && !isNaN(parseNum(v))) { k.v = parseNum(v); App.commit('Keyframe alterado'); } } },
        { label: 'Excluir', icon: 'trash', danger: true, action: () => { KF.remove(c, p, k.t); App.commit('Keyframe removido'); } },
      ]);
    };
    requestAnimationFrame(() => draw());
    return wrap;
  },

  /* ---------- clipe de efeito (faixa de efeitos) ---------- */
  tabFxClip(body, c) {
    const f = c.sfx, def = FX[f.type];
    const s = this.sec(body, 'Efeito');
    const pick = async () => { const id = await Picker.open('fx', { current: f.type, filter: d => !d.clipOnly }); if (!id || id === f.type) return; const d = FX[id]; f.type = id; f.params = defaultParams(d); f.sound = defaultSound(d); c.name = d.name; App.commit('Efeito trocado para ' + d.name, { toast: true }); };
    const cb = h(`<div class="cur-block"><div class="cb-btns"><button class="btn sm" data-a="ch">${ic('sparkles', 13)} Trocar efeito…</button></div></div>`);
    const card = LibUI.card('fx', f.type); card.onclick = pick; cb.prepend(card); $('[data-a=ch]', cb).onclick = pick;
    s.appendChild(cb);
    if (def?.hint) s.appendChild(h(`<div class="hint">${def.hint}</div>`));
    s.appendChild(this.select('Afeta', { below: 'A tela toda (tudo que está abaixo desta faixa)', next: 'Só a faixa logo abaixo' }, f.target, v => { f.target = v; App.commit('Alvo do efeito alterado', { toast: true }); }));
    const s2 = this.sec(body, 'Ajustes');
    this.paramControls(s2, c, def, f.params);
    s2.appendChild(this.slider(c, { l: 'Intensidade geral', get: () => f.amount ?? 100, set: v => f.amount = v, min: 0, max: 100, def: 100, unit: '%', kf: false }));
    s2.appendChild(this.slider(c, { l: 'Entrar/sair suave', get: () => f.fade || 0, set: v => f.fade = v, min: 0, max: 3, step: .05, def: 0, unit: 's', kf: false }));
    const s3 = this.sec(body, 'Som'); s3.appendChild(this.soundBox(f, def));
    const r = h(`<div class="btn-row"><button class="btn sm" data-a="save">${ic('bookmark', 12)} Salvar como predefinição</button></div>`);
    $('[data-a=save]', r).onclick = () => Actions.savePresetInst({ type: f.type, params: f.params, sound: f.sound, dur: c.dur, amount: f.amount, fade: f.fade }, 'fx');
    s3.appendChild(r);
  },
};
function parseNum(s) { return parseFloat(String(s).replace(',', '.')); }
function fmtNum(v, d = 2) { return String(round(v, d)).replace('.', ','); }
