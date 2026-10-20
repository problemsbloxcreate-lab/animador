/* ===================== actions.js — tudo que muda o projeto ===================== */
'use strict';

const Actions = {
  /* ---------- importar ---------- */
  async importDialog() { const f = await pickFiles('image/*,video/*,audio/*,.gif,.mp4,.webm,.mov,.mp3,.wav,.ogg,.m4a'); if (f.length) this.importFiles(f); },
  async importFiles(files, o = {}) {
    const out = [], bad = [];
    const t = files.length > 1 || files.some(f => f.size > 20e6) ? UI.toast(`Importando ${files.length} arquivo(s)…`, { time: 60000 }) : null;
    for (const f of files) {
      if (!Assets.kindOf(f)) { bad.push(f.name); continue; }
      try {
        const rt = await Assets.importFile(f, App.project.id);
        if (rt.error) { bad.push(f.name + ' (' + rt.error + ')'); await Assets.remove(rt.meta.id); continue; }
        App.project.bin.push(rt.meta.id); out.push(rt);
        const fid = o.folder !== undefined ? o.folder : LibUI.folder;
        if (fid) { App.project.assetFolders ||= {}; App.project.assetFolders[rt.meta.id] = fid; }
      } catch (e) { bad.push(f.name); }
    }
    if (t) t.remove();
    if (bad.length) UI.modal({ title: 'Alguns arquivos não entraram', icon: 'alert', kind: 'warn', body: `<p>Esses arquivos não puderam ser abertos:</p><p>${bad.map(esc).join('<br>')}</p><p>Formatos aceitos: PNG, JPG, WEBP, GIF, SVG, MP4, WEBM, MOV (depende do navegador), MP3, WAV, OGG, M4A.</p>`, buttons: [{ label: 'Ok', kind: 'primary' }] });
    App.updateStorage();
    if (out.length) { App.commit(`${out.length} mídia(s) importada(s) para a Mídia`, { toast: !o.silent, all: true }); if (!o.silent) LibUI.reveal(out.map(r => r.meta.id)); Transcribe.auto(out.map(r => r.meta.id)); }
    return out;
  },

  /* ---------- colocar clipes ---------- */
  free(trackId, start, end, ignore) { return !App.project.clips.some(c => c.trackId === trackId && c !== ignore && c.start < end - 1e-4 && c.start + c.dur > start + 1e-4); },
  place(clip, prefTrack) {
    const p = App.project, ok = tk => tk && compatible(clip, tk) && !tk.lock;
    let tk = ok(App.track(prefTrack)) ? App.track(prefTrack) : ok(App.track(App.activeTrack)) ? App.track(App.activeTrack) : p.tracks.find(ok);
    if (!tk) tk = this.addTrack(clip.type === 'audio' ? 'audio' : clip.type === 'fx' ? 'fx' : 'visual', undefined, true);
    clip.trackId = tk.id;
    if (!this.free(tk.id, clip.start, clip.start + clip.dur, clip)) {
      // procura faixa livre do mesmo tipo (de cima pra baixo a partir da escolhida)
      const same = p.tracks.filter(ok); const alt = same.find(t => this.free(t.id, clip.start, clip.start + clip.dur, clip));
      if (alt) clip.trackId = alt.id;
      else { const i = p.tracks.indexOf(tk); clip.trackId = this.addTrack(tk.type, tk.type === 'audio' ? i + 1 : i, true).id; }
    }
    p.clips.push(clip);
    return clip;
  },
  resolveOverlaps(clips) {
    let moved = 0;
    for (const c of clips) {
      if (this.free(c.trackId, c.start, c.start + c.dur, c)) continue;
      const tk = App.track(c.trackId), same = App.project.tracks.filter(t => t.type === tk.type && !t.lock && compatible(c, t));
      const i = same.indexOf(tk); const order = same.slice().sort((a, b) => Math.abs(same.indexOf(a) - i) - Math.abs(same.indexOf(b) - i));
      const alt = order.find(t => t !== tk && this.free(t.id, c.start, c.start + c.dur, c));
      if (alt) c.trackId = alt.id;
      else { const pi = App.project.tracks.indexOf(tk); c.trackId = this.addTrack(tk.type, tk.type === 'audio' ? pi + 1 : pi, true).id; }
      moved++;
    }
    return moved;
  },
  clipForAsset(assetId, t) {
    const m = Assets.meta(assetId); if (!m) return null;
    const S = App.project.settings;
    const type = m.kind === 'audio' ? 'audio' : m.kind;
    const dur = type === 'image' ? 3 : type === 'gif' ? Math.max(3, m.dur || 1) : (m.dur || 3);
    const c = App.makeClip(type, { start: App.frame(t), dur: App.frame(dur), assetId, name: m.name.replace(/\.[^.]+$/, '') });
    if (type === 'image' || type === 'gif') c.tr.fit = (m.w <= S.w && m.h <= S.h) ? 'none' : 'contain';
    return c;
  },
  addAssetAt(assetId, t, trackId, noCommit) {
    const c = this.clipForAsset(assetId, t); if (!c) return null;
    this.place(c, trackId);
    App.activeTrack = c.trackId; App.sel.clear(); App.sel.add(c.id);
    if (!noCommit) App.commit(`${{ image: 'Imagem', gif: 'GIF', video: 'Vídeo', audio: 'Som' }[c.type]} adicionado(a) em ${fmtTime(c.start, App.fps)}`, { toast: true });
    else App.commit('Mídia adicionada');
    return c;
  },
  // faixa de vídeo mais de baixo livre nesse trecho (fundo fica atrás de tudo); se não tiver, cria uma embaixo
  bottomTrack(start, dur) {
    const p = App.project, vis = p.tracks.filter(t => t.type === 'visual' && !t.lock), last = vis[vis.length - 1];
    if (last && this.free(last.id, start, start + dur)) return last.id;
    const i = last ? p.tracks.indexOf(last) + 1 : p.tracks.length; return this.addTrack('visual', i, true).id;
  },
  addNew(type, opts = {}, t, trackId) {
    const c = App.makeClip(type, { ...opts, start: App.frame(t ?? App.t), dur: type === 'color' ? 5 : 3 });
    if (opts.pattern && !trackId) { c.dur = Math.max(5, App.frame(App.project.clips.reduce((m, x) => Math.max(m, x.start + x.dur), 0) - c.start)); trackId = this.bottomTrack(c.start, c.dur); }
    this.place(c, trackId);
    if (type === 'text') document.fonts.load(`40px "${c.text.font}"`).then(() => App.requestRender());
    App.activeTrack = c.trackId; App.sel.clear(); App.sel.add(c.id); Props.tab = type === 'text' || type === 'shape' || type === 'color' ? 'content' : 'basic';
    App.commit(`${c.name} adicionado`, { toast: !opts.quiet });
    return c;
  },
  addClip(c) { this.place(c, c.trackId); App.sel.clear(); App.sel.add(c.id); App.commit(`${c.name || 'Clipe'} adicionado`, { toast: true }); },

  /* ---------- área de transferência ---------- */
  copy() {
    const s = App.selected(); if (!s.length) return;
    App.clipboard = { clips: clone(s), min: Math.min(...s.map(c => c.start)) };
    UI.toast(`${s.length} clipe(s) copiado(s). Ctrl+V cola no cursor.`, { time: 2200 });
  },
  cut() { if (!App.sel.size) return; this.copy(); this.deleteSel(false, 'recortado(s)'); },
  paste(t = App.t, trackId) {
    const cb = App.clipboard; if (!cb) return UI.toast('Nada copiado ainda', { kind: 'warn' });
    const news = cb.clips.map(c => { const n = clone(c); n.id = uid('c_'); n.start = App.frame(t + (c.start - cb.min)); if (trackId && cb.clips.length === 1 && compatible(n, App.track(trackId))) n.trackId = trackId; if (!App.track(n.trackId)) n.trackId = null; return n; });
    news.forEach(n => { if (!n.trackId) this.place(n); else App.project.clips.push(n); });
    this.resolveOverlaps(news);
    App.select(news.map(n => n.id));
    App.commit(`${news.length} clipe(s) colado(s)`, { toast: true });
  },
  duplicate() {
    const s = App.selected(); if (!s.length) return;
    const span = Math.max(...s.map(c => c.start + c.dur)) - Math.min(...s.map(c => c.start));
    const news = s.map(c => { const n = clone(c); n.id = uid('c_'); n.start = App.frame(c.start + span); App.project.clips.push(n); return n; });
    this.resolveOverlaps(news); App.select(news.map(n => n.id));
    App.commit(`${news.length} clipe(s) duplicado(s)`, { toast: true });
  },
  deleteSel(ripple = App.ripple, word = 'excluído(s)') {
    const s = App.selected(); if (!s.length) return;
    const ids = new Set(s.map(c => c.id));
    App.project.clips = App.project.clips.filter(c => !ids.has(c.id));
    if (ripple) for (const c of [...s].sort((a, b) => b.start - a.start)) App.project.clips.forEach(o => { if (o.trackId === c.trackId && o.start >= c.start + c.dur - 1e-4) o.start = App.frame(o.start - c.dur); });
    App.sel.clear(); App.selFx = null;
    App.commit(`${s.length} clipe(s) ${word}${ripple ? ' (espaço fechado)' : ''}`, { toast: true });
  },
  split() {
    let s = App.selected().filter(c => App.t > c.start && App.t < c.start + c.dur);
    if (!s.length) s = App.project.clips.filter(c => c.trackId === App.activeTrack && App.t > c.start && App.t < c.start + c.dur);
    if (!s.length) return UI.toast('Coloque o cursor vermelho em cima de um clipe para dividir', { kind: 'warn' });
    const news = s.map(c => this.splitCore(c, App.t)).filter(Boolean);
    App.select(news.map(n => n.id));
    App.commit(`${news.length} clipe(s) dividido(s)`, { toast: true });
  },
  splitClip(c, t) { const n = this.splitCore(c, App.frame(t)); if (n) { App.select(n.id); App.commit('Clipe dividido', { toast: true }); } },
  splitCore(c, t) {
    const at = t - c.start; if (at < 1 / App.fps / 2 || at > c.dur - 1 / App.fps / 2) return null;
    const b = clone(c); b.id = uid('c_');
    c.dur = App.frame(at); b.start = App.frame(t); b.dur = App.frame(b.dur - c.dur); b.offset = (c.offset || 0) + at * (c.speed || 1);
    const cut = (list, keepA) => list.filter(i => keepA ? i.start < at : i.start + i.dur > at);
    c.anims = cut(c.anims, true).map(i => ({ ...i, dur: Math.min(i.dur, at - i.start) }));
    c.fx = cut(c.fx, true).map(i => ({ ...i, dur: Math.min(i.dur, at - i.start) }));
    b.anims = cut(b.anims, false).map(i => { const s = i.start - at; return { ...i, id: uid('i_'), start: Math.max(0, s), dur: s < 0 ? i.dur + s : i.dur }; });
    b.fx = cut(b.fx, false).map(i => { const s = i.start - at; return { ...i, id: uid('i_'), start: Math.max(0, s), dur: s < 0 ? i.dur + s : i.dur }; });
    for (const ks of Object.values(b.kf || {})) ks.forEach(k => k.t = round(k.t - at, 4));
    c.trOut = null; b.trIn = null; b.fadeIn = 0; c.fadeOut = 0;
    App.project.clips.push(b);
    return b;
  },
  nudge(d) { const s = App.selected(); s.forEach(c => c.start = App.frame(Math.max(0, c.start + d))); this.resolveOverlaps(s); App.commit('Clipes movidos'); },
  jumpEdit(dir) {
    const pts = [...new Set([0, ...App.project.clips.flatMap(c => [c.start, c.start + c.dur]), ...App.project.markers.map(m => m.t)])].sort((a, b) => a - b);
    const t = dir > 0 ? pts.find(p => p > App.t + 1e-3) : [...pts].reverse().find(p => p < App.t - 1e-3);
    if (t !== undefined) App.seek(t);
  },

  /* ---------- animações e efeitos ---------- */
  instFor(c, def, t) {
    let start = t != null ? t - c.start : (App.t >= c.start && App.t < c.start + c.dur ? App.t - c.start : 0);
    start = clamp(App.frame(start), 0, Math.max(0, c.dur - 1 / App.fps));
    let dur = Math.min(def.dur, c.dur - start);
    if (dur < Math.min(def.dur, c.dur) * .5) { start = Math.max(0, c.dur - def.dur); dur = Math.min(def.dur, c.dur); }
    return { id: uid('i_'), type: null, start, dur: Math.max(1 / App.fps, App.frame(dur)), params: defaultParams(def), sound: defaultSound(def) };
  },
  addAnim(clips, type, t) {
    const def = ANIMS[type]; clips = clips.filter(c => !['audio', 'fx'].includes(c.type) && !(def.onlyText && c.type !== 'text'));
    if (!clips.length) return UI.toast(def.onlyText ? 'Essa animação é só para textos.' : 'Selecione um clipe visual.', { kind: 'warn' });
    let last;
    clips.forEach(c => { const i = this.instFor(c, def, clips.length > 1 && t == null ? c.start + (App.t > c.start && App.t < c.start + c.dur ? App.t - c.start : 0) : t); i.type = type; c.anims.push(i); last = { clipId: c.id, kind: 'anim', id: i.id }; });
    if (clips.length === 1) { App.selFx = last; }
    Props.tab = 'anim';
    App.commit(`${def.name} aplicado${clips.length > 1 ? ` em ${clips.length} clipes` : ''}`, { toast: true });
  },
  addFx(clips, type, t) {
    const def = FX[type]; clips = clips.filter(c => !['audio', 'fx'].includes(c.type));
    if (!clips.length) return;
    let last;
    clips.forEach(c => { const i = this.instFor(c, def, t); i.type = type; i.amount = 100; i.fade = 0; c.fx.push(i); last = { clipId: c.id, kind: 'fx', id: i.id }; });
    if (clips.length === 1) App.selFx = last;
    Props.tab = 'fx';
    App.commit(`Efeito ${def.name} aplicado${clips.length > 1 ? ` em ${clips.length} clipes` : ''}`, { toast: true });
  },
  addScreenFx(type, t, trackId) {
    const c = App.makeClip('fx', { fxType: type, start: App.frame(t) });
    // efeito na tela toda fica sempre numa faixa de efeitos no topo (acima de todos os vídeos)
    const tr = App.project.tracks, firstVis = tr.findIndex(k => k.type === 'visual');
    let tk = trackId ? App.track(trackId) : tr.find((k, i) => k.type === 'fx' && !k.lock && (firstVis < 0 || i < firstVis) && this.free(k.id, c.start, c.start + c.dur));
    if (!tk) tk = this.addTrack('fx', 0, true);
    c.trackId = tk.id; App.project.clips.push(c); this.resolveOverlaps([c]);
    App.select(c.id); Props.tab = 'fxclip';
    App.commit(`${c.name} na tela toda (faixa ${esc(App.track(c.trackId).name)})`, { toast: true });
  },
  removeFxInst(s) {
    const c = App.clip(s.clipId); if (!c) return;
    const list = s.kind === 'anim' ? 'anims' : 'fx', inst = c[list].find(i => i.id === s.id);
    c[list] = c[list].filter(i => i.id !== s.id); App.selFx = null;
    App.commit(`${(s.kind === 'anim' ? ANIMS : FX)[inst?.type]?.name || 'Item'} removido`, { toast: true });
  },
  clearEffects() {
    const s = App.selected(); if (!s.length) return;
    s.forEach(c => { c.anims = []; c.fx = []; c.trIn = null; c.trOut = null; }); App.selFx = null;
    App.commit(`Animações, efeitos e transições removidos de ${s.length} clipe(s)`, { toast: true });
  },
  setTrans(clips, side, type, quiet) {
    clips = clips.filter(c => !['audio', 'fx'].includes(c.type)); if (!clips.length) return;
    const key = side === 'in' ? 'trIn' : 'trOut', def = type && TRANS[type];
    clips.forEach(c => c[key] = def ? { type, dur: Math.min(def.dur, c.dur / 2), params: defaultParams(def), sound: defaultSound(def) } : null);
    Props.tab = 'trans';
    if (!quiet) App.commit(def ? `Transição de ${side === 'in' ? 'entrada' : 'saída'}: ${def.name}${clips.length > 1 ? ` (${clips.length} clipes)` : ''}` : 'Transição removida', { toast: true });
  },
  async transToTrack(c, side) {
    const key = side === 'in' ? 'trIn' : 'trOut', list = App.project.clips.filter(o => o.trackId === c.trackId && o !== c && !['audio', 'fx'].includes(o.type));
    if (!list.length) return UI.toast('Não há outros clipes nesta faixa', { kind: 'warn' });
    if (!await UI.confirm({ title: 'Aplicar em toda a faixa?', msg: `A transição de ${side === 'in' ? 'entrada' : 'saída'} <b>${TRANS[c[key].type].name}</b> vai substituir a dos outros <b>${list.length}</b> clipes da faixa "${esc(App.track(c.trackId).name)}".`, ok: 'Aplicar' })) return;
    list.forEach(o => { o[key] = clone(c[key]); o[key].dur = Math.min(o[key].dur, o.dur / 2); });
    App.commit(`Transição aplicada em ${list.length} clipes`, { toast: true });
  },

  /* ---------- copiar / colar efeitos ---------- */
  pack(c, kind, inst) {
    if (inst) return kind === 'anim' ? { anims: [clone(inst)], fx: [], srcDur: c.dur } : { anims: [], fx: [clone(inst)], srcDur: c.dur };
    const d = { srcDur: c.dur, anims: kind && kind !== 'anim' ? [] : clone(c.anims || []), fx: kind && kind !== 'fx' ? [] : clone(c.fx || []) };
    if (!kind) { d.color = clone(c.color); d.trIn = clone(c.trIn); d.trOut = clone(c.trOut); d.kf = clone(c.kf); d.afx = clone(c.afx); }
    return d;
  },
  copyEffects(c = App.selected()[0], kind, inst) {
    if (!c) return;
    App.fxClipboard = this.pack(c, kind, inst);
    const n = App.fxClipboard.anims.length + App.fxClipboard.fx.length;
    UI.toast(`Efeitos copiados (${n} item${n === 1 ? '' : 's'}${App.fxClipboard.color ? ' + cores e transições' : ''}). Selecione outros clipes e use <b>Colar efeitos</b> (Ctrl+Shift+V).`, { kind: 'ok', time: 4500 });
  },
  effectsForm(d, withTargets, c) {
    const f = h(`<div><div class="fgrid">
      ${withTargets ? `<label class="field full">Aplicar em<select data-k="target"><option value="next1">Próximo clipe desta faixa</option><option value="next3">Próximos 3 clipes</option><option value="next5">Próximos 5 clipes</option><option value="after" selected>Todos os clipes depois deste (na faixa)</option><option value="track">Todos os clipes da faixa</option><option value="custom">Escolher quantidade…</option></select></label><label class="field full hidden" data-n>Quantos clipes<input type="number" value="2" min="1" data-k="n"></label>` : ''}
      <div class="full" data-blk><span class="ctl-l" style="color:var(--tx);font-weight:600;margin-bottom:6px">O que colar</span></div>
      <label class="field full">Tempo<select data-k="timing">
        <option value="same">Igual ao original (mesmo segundo dentro do clipe)</option>
        <option value="prop">Proporcional à duração de cada clipe</option>
        <option value="full">Ocupar o clipe inteiro</option>
        <option value="custom">Personalizado…</option></select></label>
      <label class="field hidden" data-c>Começa em (s)<input type="text" value="0" data-k="cs"></label>
      <label class="field hidden" data-c>Duração (s)<input type="text" value="${fmtNum((d.anims?.[0] || d.fx?.[0])?.dur || .5)}" data-k="cd"></label>
      <label class="field full hidden" data-c>Atraso a cada clipe (s)<input type="text" value="0" data-k="stagger"><small>Ex.: 0,2 = cada clipe começa 0,2s depois do anterior</small></label>
      <label class="field full">Se o clipe já tiver efeitos<select data-k="mode"><option value="add">Adicionar junto</option><option value="replace">Substituir os que já existem</option></select></label>
    </div></div>`);
    $('[data-blk]', f).appendChild(this.pickBlocks(d, { anims: true, fx: true, trans: true }));
    const tm = $('[data-k=timing]', f); tm.onchange = () => $$('[data-c]', f).forEach(x => x.classList.toggle('hidden', tm.value !== 'custom'));
    const tg = $('[data-k=target]', f); if (tg) tg.onchange = () => $('[data-n]', f).classList.toggle('hidden', tg.value !== 'custom');
    return f;
  },
  readForm(f) { const o = {}; $$('[data-k]', f).forEach(i => o[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value); if ($('[data-blocks]', f)) o.blocks = this.readBlocks(f); return o; },
  // aplica os blocos escolhidos (o = resposta do formulário com .blocks)
  applyPicked(targets, d, o) {
    const sel = o.blocks; if (!sel || !sel.count) { UI.toast('Nenhum bloco escolhido', { kind: 'warn' }); return false; }
    const data = this.filterPack(d, sel);
    this.applyEffects(targets, data, { ...o, anims: true, fx: true, trans: true, color: !!data.color, kf: !!data.kf, afx: !!data.afx });
    return true;
  },
  applyEffects(targets, d, o) {
    targets.forEach((c, idx) => {
      if (['audio', 'fx'].includes(c.type)) { if (o.afx && d.afx && c.type === 'audio') c.afx = clone(d.afx); return; }
      const map = i => {
        const n = clone(i); n.id = uid('i_');
        if (o.timing === 'prop' && d.srcDur) { n.start = i.start / d.srcDur * c.dur; n.dur = i.dur / d.srcDur * c.dur; }
        else if (o.timing === 'full') { n.start = 0; n.dur = c.dur; }
        else if (o.timing === 'custom') { n.start = (parseNum(o.cs) || 0) + idx * (parseNum(o.stagger) || 0); n.dur = parseNum(o.cd) || i.dur; }
        if (o.shift) n.start += o.shift;
        n.start = clamp(App.frame(n.start), 0, Math.max(0, c.dur - 1 / App.fps)); n.dur = Math.max(1 / App.fps, Math.min(App.frame(n.dur), c.dur - n.start));
        return n;
      };
      if (o.anims !== false && d.anims?.length) { const add = d.anims.filter(a => !(ANIMS[a.type]?.onlyText && c.type !== 'text')).map(map); c.anims = o.mode === 'replace' ? add : c.anims.concat(add); }
      if (o.fx !== false && d.fx?.length) { const add = d.fx.map(map); c.fx = o.mode === 'replace' ? add : c.fx.concat(add); }
      if (o.color && d.color) { c.color = clone(d.color); for (const k of Object.keys(d.kf || {})) if (k.startsWith('color.')) c.kf[k] = clone(d.kf[k]); }
      if (o.trans) { if (d.trIn) c.trIn = { ...clone(d.trIn), dur: Math.min(d.trIn.dur, c.dur / 2) }; if (d.trOut) c.trOut = { ...clone(d.trOut), dur: Math.min(d.trOut.dur, c.dur / 2) }; }
      if (o.kf && d.kf) { const k = o.timing === 'prop' && d.srcDur ? c.dur / d.srcDur : 1; for (const [p, ks] of Object.entries(d.kf)) c.kf[p] = ks.map(x => ({ ...x, t: round(x.t * k, 4) })); }
      if (o.afx && d.afx) c.afx = clone(d.afx);
    });
  },
  async pasteEffectsDialog() {
    const d = App.fxClipboard; if (!d) return UI.toast('Copie os efeitos de um clipe antes (botão direito → Copiar efeitos)', { kind: 'warn' });
    const targets = App.selected(); if (!targets.length) return UI.toast('Selecione os clipes que vão receber os efeitos', { kind: 'warn' });
    const f = this.effectsForm(d, false);
    const o = await UI.modal({ title: `Colar efeitos em ${targets.length} clipe(s)`, icon: 'sparkles', width: 560, body: f, enterValue: true, buttons: [{ label: 'Cancelar', value: null }, { label: 'Colar', kind: 'primary', collect: () => this.readForm(f) }] });
    if (!o) return;
    if (!this.applyPicked(targets, d, o)) return;
    App.commit(`Efeitos colados em ${targets.length} clipe(s)`, { toast: true });
  },
  async applyToNextDialog(c, kind, inst) {
    const d = this.pack(c, kind, inst);
    const f = this.effectsForm(d, true, c);
    const o = await UI.modal({ title: 'Repetir nos próximos clipes', icon: 'right', width: 560, body: f, enterValue: true, buttons: [{ label: 'Cancelar', value: null }, { label: 'Aplicar', kind: 'primary', collect: () => this.readForm(f) }] });
    if (!o) return;
    const same = App.project.clips.filter(x => x.trackId === c.trackId && x !== c).sort((a, b) => a.start - b.start);
    const after = same.filter(x => x.start >= c.start);
    const n = { next1: 1, next3: 3, next5: 5, custom: Math.max(1, +o.n || 1) }[o.target];
    const targets = o.target === 'track' ? same : o.target === 'after' ? after : after.slice(0, n);
    if (!targets.length) return UI.toast('Não há próximos clipes nesta faixa', { kind: 'warn' });
    if (!this.applyPicked(targets, d, o)) return;
    App.commit(`Efeitos repetidos em ${targets.length} clipe(s)`, { toast: true });
  },

  /* ---------- predefinições salvas ---------- */
  async savePresetFromClip(c = App.selected()[0], kind) {
    if (!c) return;
    const d = this.pack(c, kind);
    const def = d.anims[0] ? ANIMS[d.anims[0].type]?.name : d.fx[0] ? FX[d.fx[0].type]?.name : 'Meu estilo';
    const f = h(`<div class="fgrid"><label class="field full">Nome<input type="text" value="${esc(def + (d.anims.length + d.fx.length > 1 ? ' + ' + (d.anims.length + d.fx.length - 1) : ''))}" data-k="name"></label><div class="full" data-blk><span class="ctl-l" style="color:var(--tx);font-weight:600;margin-bottom:6px">O que salvar</span></div></div>`);
    $('[data-blk]', f).appendChild(this.pickBlocks(d, { anims: true, fx: true, trans: true }));
    const o = await UI.modal({ title: 'Salvar para usar depois', icon: 'bookmark', width: 560, body: f, enterValue: true, buttons: [{ label: 'Cancelar', value: null }, { label: 'Salvar', kind: 'primary', collect: () => this.readForm(f) }] });
    if (!o || !o.name) return;
    if (!o.blocks.count) return UI.toast('Nenhum bloco escolhido', { kind: 'warn' });
    const data = this.filterPack(d, o.blocks);
    await this.storePreset(o.name, kind || 'style', data);
  },
  async savePresetInst(inst, kind) {
    const name = await UI.prompt({ title: 'Salvar para usar depois', label: 'Nome', value: (kind === 'anim' ? ANIMS : FX)[inst.type]?.name + ' (meu)', ok: 'Salvar', icon: 'bookmark' });
    if (!name) return;
    const i = clone(inst); i.start = i.start || 0;
    await this.storePreset(name, kind, { srcDur: (i.start || 0) + (i.dur || 1), anims: kind === 'anim' ? [i] : [], fx: kind === 'fx' ? [i] : [] });
  },
  async storePreset(name, kind, data) {
    const p = { id: uid('ps_'), name, kind, data, created: Date.now() };
    await DB.put('presets', p); LibUI.presets.unshift(p);
    if (LibUI.tab === 'saved') LibUI.render();
    UI.toast(`"${esc(name)}" salvo! Está na aba <b>Salvos</b>.`, { kind: 'ok', action: { label: 'Ver', fn: () => LibUI.setTab('saved') } });
  },
  applyPreset(p, clips, t) {
    if (!p) return;
    const vis = clips.filter(c => !['audio', 'fx'].includes(c.type)); if (!vis.length) return UI.toast('Selecione clipes visuais', { kind: 'warn' });
    vis.forEach(c => {
      const o = { anims: true, fx: true, color: !!p.data.color, trans: true, kf: !!p.data.kf, timing: 'same', mode: 'add' };
      if (t != null) { const min = Math.min(...[...(p.data.anims || []), ...(p.data.fx || [])].map(i => i.start), Infinity); if (isFinite(min)) o.shift = clamp(t - c.start, 0, c.dur) - min; }
      this.applyEffects([c], p.data, o);
    });
    App.commit(`"${esc(p.name)}" aplicado em ${vis.length} clipe(s)`, { toast: true });
  },

  /* ---------- keyframes ---------- */
  keyAll() {
    const c = App.selected()[0]; if (!c || ['audio', 'fx'].includes(c.type)) return UI.toast('Selecione um clipe visual', { kind: 'warn' });
    const lt = clamp(App.t - c.start, 0, c.dur);
    ['tr.x', 'tr.y', 'tr.scale', 'tr.rot'].forEach(p => KF.set(c, p, lt, KF.value(c, p, lt)));
    Props.tab = 'basic';
    App.commit('Keyframe marcado. Agora mova o cursor vermelho e arraste o objeto na prévia — o editor anima sozinho.', { toast: true });
  },
  async quickAnim() {
    const c = App.selected()[0]; if (!c || ['audio', 'fx'].includes(c.type)) return UI.toast('Selecione um clipe visual', { kind: 'warn' });
    const lt = clamp(App.t - c.start, 0, c.dur), S = App.project.settings;
    const cur = p => round(KF.value(c, p, lt), 2);
    const props = { pos: 'Posição (mover de um ponto a outro)', 'tr.scale': 'Escala (tamanho)', 'tr.rot': 'Rotação', 'tr.opacity': 'Opacidade', 'color.brightness': 'Brilho', 'color.saturation': 'Saturação', 'color.grayscale': 'Preto e branco', 'color.blur': 'Desfoque', 'tr.sx': 'Largura', 'tr.sy': 'Altura' };
    const sug = { 'tr.scale': [.5, 1.1], 'tr.rot': [0, 360], 'tr.opacity': [0, 100], 'color.brightness': [100, 30], 'color.saturation': [100, 0], 'color.grayscale': [0, 100], 'color.blur': [20, 0], 'tr.sx': [1, 1.5], 'tr.sy': [1, 1.5] };
    const f = h(`<div><div class="fgrid">
      <label class="field full">O que animar<select data-k="prop">${Object.entries(props).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <div class="full" data-pos style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label class="field">De: X<input type="number" data-k="fx" value="${cur('tr.x') - Math.round(S.w * .6)}"></label><label class="field">De: Y<input type="number" data-k="fy" value="${cur('tr.y')}"></label>
        <label class="field">Para: X<input type="number" data-k="tx" value="${cur('tr.x')}"></label><label class="field">Para: Y<input type="number" data-k="ty" value="${cur('tr.y')}"></label>
        <div class="chips" style="grid-column:1/-1"><span class="chip" data-q="l">Vem da esquerda</span><span class="chip" data-q="r">Vem da direita</span><span class="chip" data-q="t">Vem de cima</span><span class="chip" data-q="b">Vem de baixo</span><span class="chip" data-q="o">Sai para direita</span></div>
      </div>
      <label class="field hidden" data-val>De (valor inicial)<input type="text" data-k="from" value=".5"></label><label class="field hidden" data-val>Para (valor final)<input type="text" data-k="to" value="1,1"></label>
      <label class="field">Começa em (s, no clipe)<input type="text" data-k="start" value="${fmtNum(lt)}"></label>
      <label class="field">Duração (s)<input type="text" data-k="dur" value="${fmtNum(Math.min(1, c.dur - lt) || .5)}"></label>
      <label class="field full">Movimento<select data-k="ease">${Object.entries(EASE_NAMES).map(([k, v]) => `<option value="${k}" ${k === 'out' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="fcheck"><input type="checkbox" data-k="clear" checked> Apagar keyframes antigos dessa propriedade</label>
    </div></div>`);
    const ps = $('[data-k=prop]', f), upd = () => { const pos = ps.value === 'pos'; $('[data-pos]', f).style.display = pos ? 'grid' : 'none'; $$('[data-val]', f).forEach(x => x.classList.toggle('hidden', pos)); if (!pos) { const s = sug[ps.value] || [cur(ps.value), cur(ps.value)]; $('[data-k=from]', f).value = fmtNum(s[0]); $('[data-k=to]', f).value = fmtNum(s[1]); } };
    ps.onchange = upd;
    $$('[data-q]', f).forEach(ch => ch.onclick = () => {
      const x = cur('tr.x'), y = cur('tr.y'), set = (a, b, cc, d) => { $('[data-k=fx]', f).value = a; $('[data-k=fy]', f).value = b; $('[data-k=tx]', f).value = cc; $('[data-k=ty]', f).value = d; };
      ({ l: () => set(-S.w, y, x, y), r: () => set(S.w, y, x, y), t: () => set(x, -S.h, x, y), b: () => set(x, S.h, x, y), o: () => set(x, y, S.w, y) })[ch.dataset.q]();
    });
    const o = await UI.modal({ title: 'Animação rápida De → Para', icon: 'move', body: f, width: 480, enterValue: true, buttons: [{ label: 'Cancelar', value: null }, { label: 'Criar animação', kind: 'primary', collect: () => this.readForm(f) }] });
    if (!o) return;
    const st = clamp(parseNum(o.start) || 0, 0, c.dur), du = Math.max(1 / App.fps, parseNum(o.dur) || .5), en = Math.min(c.dur, st + du);
    const put = (p, a, b) => { if (o.clear) delete c.kf[p]; KF.set(c, p, st, a, o.ease); KF.set(c, p, en, b, o.ease); };
    if (o.prop === 'pos') { put('tr.x', +o.fx, +o.tx); put('tr.y', +o.fy, +o.ty); }
    else put(o.prop, parseNum(o.from), parseNum(o.to));
    App.seek(c.start + st);
    App.commit(`Animação criada: ${props[o.prop].split(' (')[0]} em ${fmtSec(du)}`, { toast: true });
  },

  /* ---------- posição ---------- */
  centerSel() { App.selected().forEach(c => { if (['audio', 'fx'].includes(c.type)) return; App.setProp(c, 'tr.x', 0); App.setProp(c, 'tr.y', 0); }); App.commit('Centralizado', { toast: true }); },
  scaleSel(k, mult) {
    const s = App.selected().filter(c => !['audio', 'fx'].includes(c.type)); if (!s.length) return;
    s.forEach(c => { const cur = KF.value(c, 'tr.scale', App.t - c.start) || 1; App.setProp(c, 'tr.scale', round(mult ? cur * mult : k, 3)); });
    App.commit(mult ? (mult > 1 ? 'Aumentado 10%' : 'Diminuído 10%') : `Tamanho ${Math.round(k * 100)}%`, { toast: true });
  },
  fitSel(mode) { App.selected().forEach(c => { if (['audio', 'fx'].includes(c.type)) return; if (['image', 'gif', 'video'].includes(c.type)) { c.tr.fit = mode; c.tr.scale = 1; c.tr.sx = 1; c.tr.sy = 1; delete c.kf['tr.scale']; } else if (c.type === 'shape' || c.type === 'text' || c.type === 'color') { const g = Renderer.geom(App.project, c, App.t), S = App.project.settings; const k = mode === 'cover' ? Math.max(S.w / g.box.w, S.h / g.box.h) : Math.min(S.w / g.box.w, S.h / g.box.h); c.tr.scale = round(k * (mode === 'contain' ? .9 : 1), 3); } App.setProp(c, 'tr.x', 0); App.setProp(c, 'tr.y', 0); }); App.commit({ cover: 'Preenchendo a tela', contain: 'Ajustado à tela', stretch: 'Esticado na tela', none: 'Tamanho original' }[mode], { toast: true }); },
  setSpeed(clips, s) {
    clips.forEach(c => { if (!['video', 'audio', 'gif'].includes(c.type)) return; const old = c.speed || 1; c.speed = s; const m = Assets.meta(c.assetId); let nd = c.dur * old / s; if (m?.dur && c.type !== 'gif') nd = Math.min(nd, (m.dur - (c.offset || 0)) / s); c.dur = App.frame(nd); });
    this.resolveOverlaps(clips); App.commit(`Velocidade ${s}x`, { toast: true });
  },

  /* ---------- clipes especiais ---------- */
  detachAudio(c) {
    if (!Assets.meta(c.assetId)?.hasAudio) return UI.toast('Esse vídeo não tem áudio', { kind: 'warn' });
    const a = App.makeClip('audio', { start: c.start, dur: c.dur, offset: c.offset, assetId: c.assetId, name: (c.name || 'Vídeo') + ' (áudio)' });
    a.speed = c.speed; a.volume = c.volume;
    this.place(a, App.project.tracks.find(t => t.type === 'audio')?.id);
    c.muted = true; App.sel.clear(); App.sel.add(a.id);
    App.commit(`Áudio separado: agora está na faixa "${esc(App.track(a.trackId).name)}" (o vídeo ficou sem som)`, { toast: true });
  },
  async freezeFrame(c) {
    if (c.type !== 'video') return;
    const e = VideoPool.get(c); if (!e || e.v.readyState < 2) return UI.toast('O vídeo ainda não carregou', { kind: 'warn' });
    await Renderer.prepare(App.project, App.t);
    const cv = document.createElement('canvas'); cv.width = e.v.videoWidth; cv.height = e.v.videoHeight; cv.getContext('2d').drawImage(e.v, 0, 0);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const rt = await Assets.addBlob(blob, (c.name || 'Vídeo') + ' (quadro).png', App.project.id, 'image');
    App.project.bin.push(rt.meta.id);
    const n = this.clipForAsset(rt.meta.id, App.t); n.tr = clone(c.tr); n.tr.fit = c.tr.fit; n.color = clone(c.color); n.crop = clone(c.crop); n.dur = 2;
    const i = App.project.tracks.indexOf(App.track(c.trackId)); n.trackId = this.addTrack('visual', i, true).id;
    App.project.clips.push(n); App.select(n.id);
    App.commit('Quadro congelado (imagem de 2s numa faixa acima)', { toast: true, all: true });
  },
  async replaceMedia(c) {
    const f = await pickFiles(c.type === 'audio' ? 'audio/*' : 'image/*,video/*,.gif', false); if (!f.length) return;
    const rt = (await this.importFiles(f, { silent: true }))[0]; if (!rt) return;
    const k = rt.meta.kind;
    if ((c.type === 'audio') !== (k === 'audio')) return UI.toast('Tipo de arquivo diferente — escolha ' + (c.type === 'audio' ? 'um áudio' : 'uma imagem ou vídeo'), { kind: 'warn' });
    c.assetId = rt.meta.id; c.type = k === 'audio' ? 'audio' : k; c.offset = 0;
    if (rt.meta.dur && (k === 'video' || k === 'audio')) c.dur = Math.min(c.dur, rt.meta.dur);
    App.commit('Mídia trocada', { toast: true, all: true });
  },
  // troca a mídia de um clipe mantendo posição, tamanho e animações
  swapAsset(c, id) {
    const m = Assets.meta(id); if (!m || !c) return false;
    const vis = ['image', 'gif', 'video'];
    if (c.type === 'audio' ? m.kind !== 'audio' : (!vis.includes(c.type) || !vis.includes(m.kind))) return false;
    c.assetId = id; c.type = m.kind === 'audio' ? 'audio' : m.kind; c.offset = 0; c.crop = { l: 0, t: 0, r: 0, b: 0 };
    if ((m.kind === 'video' || m.kind === 'audio') && m.dur) c.dur = Math.min(c.dur, m.dur);
    c.name = m.name.replace(/\.[^.]+$/, '');
    // personagem enquadrado: refaz o enquadramento com a nova pose (mesmo tamanho na tela, corpo continua abaixo da tela)
    if (c.frame && typeof Framing !== 'undefined' && c.type !== 'audio') { const x = c.tr.x; Framing.apply(c, c.frame.mode, c.frame.side); if (c.frame.side === 'meio') c.tr.x = x; }
    return true;
  },
  get replacePref() { try { return localStorage.getItem('ps-replace') || 'ask'; } catch { return 'ask'; } },
  set replacePref(v) { try { localStorage.setItem('ps-replace', v); } catch { } },
  canSwap(c, id) { const m = Assets.meta(id); if (!m || !c) return false; const vis = ['image', 'gif', 'video']; return c.type === 'audio' ? m.kind === 'audio' : vis.includes(c.type) && vis.includes(m.kind); },
  // soltou uma mídia em cima de um clipe: substituir? → 'replaced' | 'add' | 'cancel'
  async askReplace(c, id) {
    if (!this.canSwap(c, id)) return 'add';
    let mode = this.replacePref;
    if (mode === 'ask') {
      const om = Assets.meta(c.assetId), nm = Assets.meta(id);
      const th = m => m?.thumb ? `<div style="width:120px;height:80px;border-radius:8px;background:#000 url('${m.thumb}') center/contain no-repeat;border:1px solid var(--bd2)"></div>` : `<div style="width:120px;height:80px;border-radius:8px;background:var(--bg3);display:grid;place-items:center">${ic(m?.kind === 'audio' ? 'music' : 'image', 26)}</div>`;
      const f = h(`<div><div style="display:flex;align-items:center;gap:12px;justify-content:center;margin-bottom:10px">${th(om)}<span style="font-size:22px">→</span>${th(nm)}</div>
        <p style="text-align:center">Trocar <b>${esc(c.name || om?.name || 'o clipe')}</b> por <b>${esc(nm?.name || '')}</b>?<br><small>Mantém posição, tamanho, tempo, animações e efeitos.</small></p>
        <label class="switch" style="justify-content:center;width:100%"><input type="checkbox" data-nask><i></i>Não perguntar de novo</label></div>`);
      const r = await UI.modal({ title: 'Substituir a mídia?', icon: 'image', body: f, enterValue: true, cancelValue: 'cancel', buttons: [{ label: 'Colocar como clipe novo', value: 'add', left: true, onClick: () => { if ($('[data-nask]', f).checked) this.replacePref = 'add'; } }, { label: 'Cancelar', value: 'cancel' }, { label: 'Substituir', kind: 'primary', value: 'replace', onClick: () => { if ($('[data-nask]', f).checked) this.replacePref = 'replace'; } }] });
      if ($('[data-nask]', f).checked && r !== 'cancel') UI.toast('Combinado! Dá para mudar em <b>Editar → Ao soltar mídia em cima de um clipe</b>.', { time: 4500 });
      mode = r;
    }
    if (mode === 'cancel') return 'cancel';
    if (mode === 'add') return 'add';
    this.swapAsset(c, id);
    App.select(c.id);
    App.commit(`Mídia substituída: ${esc(Assets.meta(id)?.name || '')}`, { toast: true });
    return 'replaced';
  },
  async renameClip(c) { const n = await UI.prompt({ title: 'Renomear clipe', label: 'Nome', value: c.name || '' }); if (n) { c.name = n; App.commit('Clipe renomeado'); } },

  /* ---------- faixas ---------- */
  addTrack(type, index, silent) {
    const p = App.project, n = p.tracks.filter(t => t.type === type).length + 1;
    const name = { visual: 'Vídeo', audio: 'Áudio', fx: 'Efeitos' }[type] + ' ' + n;
    const tk = { id: uid('t_'), type, name, hidden: false, mute: false, lock: false, solo: false, volume: 100, h: type === 'fx' ? 44 : type === 'audio' ? 58 : 64 };
    if (index === undefined) index = type === 'audio' ? p.tracks.length : (type === 'fx' ? 0 : Math.max(0, p.tracks.findIndex(t => t.type === 'visual')));
    p.tracks.splice(clamp(index, 0, p.tracks.length), 0, tk);
    if (!silent) App.commit(`Faixa "${name}" criada`, { toast: true });
    return tk;
  },
  async renameTrack(tk) { const n = await UI.prompt({ title: 'Renomear faixa', label: 'Nome', value: tk.name }); if (n) { tk.name = n; App.commit('Faixa renomeada'); } },
  moveTrack(tk, d) { const a = App.project.tracks, i = a.indexOf(tk), j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; App.commit(`Faixa movida para ${d < 0 ? 'cima (fica na frente)' : 'baixo (fica atrás)'}`, { toast: true }); },
  setVolume(clips, v) { clips = clips.filter(c => c.type === 'audio' || c.type === 'video'); clips.forEach(c => { c.volume = v; delete c.kf.volume; }); App.commit(`Volume ${v}% em ${clips.length} clipe(s)`, { toast: true }); },
  async volumeDialog(clips) {
    clips = clips.filter(c => c.type === 'audio' || c.type === 'video'); if (!clips.length) return;
    const f = h('<div></div>'), fake = { kf: {}, start: 0 }; let v = clips[0].volume ?? 100;
    f.appendChild(Props.slider(fake, { l: clips.length > 1 ? `Volume de ${clips.length} clipes` : 'Volume do clipe', get: () => v, set: x => v = x, min: 0, max: 200, def: 100, unit: '%', kf: false }));
    const ok = await UI.modal({ title: 'Volume', icon: 'vol', body: f, enterValue: true, buttons: [{ label: 'Cancelar', value: false }, { label: 'Aplicar', kind: 'primary', value: true }] });
    if (ok) this.setVolume(clips, Math.round(v));
  },
  // "volume igual ao de": clique em outro áudio na linha do tempo
  pickVolume(targets) {
    targets = targets.filter(c => c.type === 'audio' || c.type === 'video'); if (!targets.length) return UI.toast('Selecione os áudios que vão mudar', { kind: 'warn' });
    const t = UI.toast(`Agora <b>clique no áudio</b> que tem o volume certo (Esc cancela)`, { time: 60000 });
    document.body.classList.add('picking');
    const end = () => { App.pick = null; document.body.classList.remove('picking'); t.remove(); document.removeEventListener('keydown', onEsc, true); };
    const onEsc = e => { if (e.key === 'Escape') { e.stopPropagation(); end(); } };
    document.addEventListener('keydown', onEsc, true);
    App.pick = { onPick: src => {
      if (targets.includes(src)) return UI.toast('Clique em outro áudio (não nos selecionados)', { kind: 'warn' });
      end(); const v = src.volume ?? 100;
      targets.forEach(c => { c.volume = v; if (src.kf?.volume) c.kf.volume = clone(src.kf.volume); else delete c.kf.volume; });
      App.commit(`Volume igual ao de "${esc(src.name || 'áudio')}" (${Math.round(v)}%) em ${targets.length} clipe(s)`, { toast: true });
    } };
  },
  async trackVolume(tk) {
    const f = h(`<div></div>`); const fake = { kf: {}, start: 0 };
    f.appendChild(Props.slider(fake, { l: 'Volume da faixa', get: () => tk.volume ?? 100, set: v => tk.volume = v, min: 0, max: 200, def: 100, unit: '%', kf: false }));
    await UI.modal({ title: 'Volume: ' + tk.name, icon: 'vol', body: f, buttons: [{ label: 'Pronto', kind: 'primary' }] });
    App.commit('Volume da faixa alterado', { toast: true });
  },
  async deleteTrack(tk) {
    const p = App.project, n = p.clips.filter(c => c.trackId === tk.id).length;
    if (p.tracks.length <= 1) return UI.toast('O projeto precisa de pelo menos uma faixa', { kind: 'warn' });
    if (n && !await UI.confirm({ title: 'Excluir faixa?', msg: `A faixa "<b>${esc(tk.name)}</b>" tem <b>${n} clipe(s)</b>, que também serão excluídos.`, ok: 'Excluir faixa e clipes', danger: true })) return;
    p.clips = p.clips.filter(c => c.trackId !== tk.id); p.tracks = p.tracks.filter(t => t !== tk);
    if (App.activeTrack === tk.id) App.activeTrack = p.tracks[0]?.id;
    for (const s of [...App.sel]) if (!App.clip(s)) App.sel.delete(s);
    App.commit(`Faixa "${esc(tk.name)}" excluída`, { toast: true });
  },
  MARKER_COLORS: ['#ffb020', '#ff4d6a', '#2fcf7a', '#19d3f0', '#3d8bff', '#b36bff', '#ff7ad9', '#ffffff'],
  markerForm(m) {
    const f = h(`<div class="fgrid"><label class="field full">Nome do marcador<input type="text" data-k="label" value="${esc(m.label || '')}" placeholder="Ex.: começa a briga, piada, corte…"></label>
      <div class="field full">Cor<div class="mk-colors">${this.MARKER_COLORS.map(c => `<span data-c="${c}" style="background:${c}" class="${(m.color || '#ffb020') === c ? 'on' : ''}"></span>`).join('')}<input type="color" data-k="color" value="${m.color || '#ffb020'}" style="width:40px;height:26px"></div></div>
      <label class="field">Tempo (s)<input type="text" data-k="t" value="${fmtNum(m.t, 2)}"></label></div>`);
    const ci = $('[data-k=color]', f);
    $$('[data-c]', f).forEach(sp => sp.onclick = () => { $$('[data-c]', f).forEach(x => x.classList.remove('on')); sp.classList.add('on'); ci.value = sp.dataset.c; });
    ci.oninput = () => $$('[data-c]', f).forEach(x => x.classList.remove('on'));
    return f;
  },
  async addMarker(t = App.t) {
    const m = { id: uid('m_'), t: App.frame(t), label: '', color: '#ffb020' };
    const f = this.markerForm(m);
    const o = await UI.modal({ title: 'Novo marcador', icon: 'marker', body: f, enterValue: true, buttons: [{ label: 'Cancelar', value: null }, { label: 'Adicionar', kind: 'primary', collect: () => this.readForm(f) }] });
    if (!o) return;
    Object.assign(m, { label: o.label.trim(), color: o.color, t: App.frame(Math.max(0, parseNum(o.t) || m.t)) });
    App.project.markers.push(m);
    App.commit(`Marcador "${esc(m.label || 'sem nome')}" em ${fmtTime(m.t, App.fps)}`, { toast: true });
  },
  async editMarker(m) {
    const f = this.markerForm(m);
    const o = await UI.modal({ title: 'Editar marcador', icon: 'marker', body: f, enterValue: true, buttons: [{ label: 'Excluir', kind: 'danger', value: 'del', left: true }, { label: 'Cancelar', value: null }, { label: 'Salvar', kind: 'primary', collect: () => this.readForm(f) }] });
    if (!o) return;
    if (o === 'del') { App.project.markers = App.project.markers.filter(x => x !== m); return App.commit('Marcador removido', { toast: true }); }
    Object.assign(m, { label: o.label.trim(), color: o.color, t: App.frame(Math.max(0, parseNum(o.t) || m.t)) });
    App.commit('Marcador alterado', { toast: true });
  },
  sortTracks() {
    const tr = App.project.tracks, order = { fx: 0, visual: 1, audio: 2 };
    const sorted = tr.map((t, i) => [t, i]).sort((a, b) => order[a[0].type] - order[b[0].type] || a[1] - b[1]).map(x => x[0]);
    if (sorted.every((t, i) => t === tr[i])) return UI.toast('As faixas já estão organizadas', { kind: 'ok' });
    App.project.tracks = sorted;
    App.commit('Faixas organizadas: efeitos em cima, vídeos no meio, áudios embaixo', { toast: true });
  },
  // fecha um espaço vazio: os clipes depois dele andam para trás (ou voltam ao início)
  closeGap(g, allTracks) {
    if (!g) return; const len = g.end - g.start;
    const tracks = allTracks ? App.project.tracks.map(t => t.id) : [g.trackId];
    if (allTracks) {
      const blocked = App.project.clips.find(c => c.start < g.end - 1e-4 && c.start + c.dur > g.start + 1e-4);
      if (blocked) return UI.toast(`Não dá para fechar em todas: "${esc(blocked.name || 'um clipe')}" está nesse espaço em outra faixa.`, { kind: 'warn', time: 5000 });
    }
    let n = 0;
    App.project.clips.forEach(c => { if (tracks.includes(c.trackId) && c.start >= g.end - 1e-4) { c.start = App.frame(c.start - len); n++; } });
    if (allTracks) App.project.markers.forEach(m => { if (m.t >= g.end - 1e-4) m.t = App.frame(m.t - len); });
    App.selGap = null;
    App.commit(`Espaço de ${fmtSec(len)} fechado${n ? ` · ${n} clipe(s) puxado(s)` : ''}`, { toast: true });
  },

  /* ---------- mídias ---------- */
  async deleteAsset(a) {
    const uses = App.project.clips.filter(c => c.assetId === a.id || c.anims.some(i => i.sound?.assetId === a.id) || c.fx.some(i => i.sound?.assetId === a.id));
    if (!await UI.confirm({ title: 'Excluir mídia?', msg: `"<b>${esc(a.name)}</b>" será removida do projeto.${uses.length ? `<br><br><b>${uses.length} clipe(s)</b> usam essa mídia e também serão afetados (clipes apagados / sons desligados).` : ''}`, ok: 'Excluir', danger: true })) return;
    const ids = new Set(uses.filter(c => c.assetId === a.id).map(c => c.id));
    App.project.clips = App.project.clips.filter(c => !ids.has(c.id));
    App.project.clips.forEach(c => [...c.anims, ...c.fx].forEach(i => { if (i.sound?.assetId === a.id) { i.sound.mode = 'off'; i.sound.assetId = null; } }));
    App.project.bin = App.project.bin.filter(x => x !== a.id);
    await Assets.remove(a.id);
    App.commit('Mídia excluída', { toast: true, all: true });
  },
  async cleanUnused() {
    const used = ToonFile.usedAssetIds({ clips: App.project.clips, bin: [] });
    const un = Assets.list(App.project.id).filter(a => !used.has(a.id));
    if (!un.length) return UI.toast('Todas as mídias estão sendo usadas', { kind: 'ok' });
    const tot = un.reduce((s, a) => s + (a.size || 0), 0);
    if (!await UI.confirm({ title: 'Limpar mídias não usadas?', msg: `<b>${un.length}</b> mídia(s) não estão na linha do tempo (${fmtBytes(tot)}). Elas serão apagadas deste projeto.`, ok: 'Apagar', danger: true })) return;
    for (const a of un) { await Assets.remove(a.id); App.project.bin = App.project.bin.filter(x => x !== a.id); }
    App.commit(`${un.length} mídia(s) apagada(s)`, { toast: true, all: true });
  },

  /* ---------- arquivo .toon ---------- */
  // salva o .toon: escolhe o lugar primeiro, depois mostra o progresso no centro (sem poder mexer) e no fim o resumo
  async saveToon(project = App.project, presets = LibUI.presets, extra) {
    if (!project) return;
    if (App.project === project) { await App.save(true); extra = { thumb: App.lastThumb, lastT: App.t }; }
    const name = safeName(project.name) + ToonFile.EXT;
    let handle = null;
    if (window.showSaveFilePicker) {
      try { handle = await showSaveFilePicker({ suggestedName: name, types: [{ description: 'Projeto Estúdio Problems (.toon)', accept: { 'application/octet-stream': ['.toon'] } }] }); }
      catch (e) { if (e.name === 'AbortError') return; handle = null; }
    }
    const busy = UI.busy('Salvando arquivo .toon…', `<div class="spinner"></div><p style="text-align:center;margin:0">Juntando o projeto e todas as mídias num arquivo só.<br><b data-st>Preparando…</b></p><div class="progress"><i data-pg></i></div><p style="text-align:center;font-size:12px;color:var(--tx3);margin:0">Não feche a página enquanto salva.</p>`);
    try {
      const prog = (p, n, tot) => { const b = busy.body; if (!b) return; $('[data-st]', b).textContent = `Mídia ${Math.round(p * tot) + 1} de ${tot}: ${n}`; $('[data-pg]', b).style.width = p * 100 + '%'; };
      const blob = await ToonFile.build(project, presets, prog, extra || {});
      if (busy.body) { $('[data-st]', busy.body).textContent = 'Gravando o arquivo…'; $('[data-pg]', busy.body).style.width = '100%'; }
      let where = 'na pasta de Downloads do navegador';
      if (handle) { const w = await handle.createWritable(); await w.write(blob); await w.close(); where = 'no lugar que você escolheu'; }
      else downloadBlob(blob, name);
      busy.close();
      const used = ToonFile.usedAssetIds(project), kinds = {};
      (await DB.byIndex('assets', 'project', project.id)).filter(a => used.has(a.id)).forEach(a => kinds[a.kind] = (kinds[a.kind] || 0) + 1);
      const kn = { image: 'imagem(ns)', gif: 'GIF(s)', video: 'vídeo(s)', audio: 'áudio(s)' };
      const parts = Object.entries(kinds).map(([k, n]) => `${n} ${kn[k]}`).join(', ') || 'nenhuma mídia (só textos, formas e sons prontos)';
      await UI.modal({ title: 'Arquivo .toon salvo!', icon: 'check', kind: 'ok', width: 480, body: `${extra?.thumb ? `<img src="${extra.thumb}" style="width:100%;max-height:200px;object-fit:contain;background:#000;border-radius:8px;margin-bottom:10px">` : ''}
        <div class="info-grid" style="margin-bottom:12px"><span>Arquivo</span><b style="word-break:break-all">${esc(handle?.name || name)}</b><span>Tamanho</span><b>${fmtBytes(blob.size)}</b><span>Onde</span><b>${where}</b><span>Projeto</span><b>${esc(project.name)} · ${project.settings.w}×${project.settings.h} · ${project.settings.fps}fps</b><span>Leva junto</span><b>${project.clips.length} clipe(s) · ${parts}${presets?.length ? ` · ${presets.length} efeito(s) salvo(s)` : ''}</b></div>
        <div class="hint" style="margin:0">${ic('package', 13)} O <b>.toon</b> é o projeto completo num arquivo só. Para abrir em outro computador (ou mandar para alguém): tela inicial → <b>Abrir arquivo .toon</b>.</div>`, buttons: [{ label: 'Ok', kind: 'primary' }] });
    } catch (e) { busy.close(); UI.modal({ title: 'Não consegui salvar o .toon', icon: 'alert', kind: 'danger', body: `<p>${esc(e.message || e)}</p>`, buttons: [{ label: 'Ok', kind: 'primary' }] }); }
  },

  setCover(id) {
    App.project.cover = id || null;
    App.commit(id ? `Capa do projeto: ${esc(Assets.meta(id)?.name || '')}` : 'Capa automática (cena do cursor ao salvar)', { toast: true });
    App.save(true);
  },
  /* ---------- configurações do projeto ---------- */
  async projectSettings() {
    const s = App.project.settings;
    const f = h(`<div><div class="chips" style="margin-bottom:12px">${TEMPLATES.map(t => `<span class="chip" data-t="${t.id}">${t.name}</span>`).join('')}</div><div class="fgrid">
      <label class="field full">Nome do projeto<input type="text" data-k="name" value="${esc(App.project.name)}"></label>
      <label class="field">Largura (px)<input type="number" data-k="w" value="${s.w}" min="16" max="7680"></label><label class="field">Altura (px)<input type="number" data-k="h" value="${s.h}" min="16" max="7680"></label>
      <label class="field">Quadros por segundo<select data-k="fps">${[12, 15, 24, 25, 30, 50, 60].map(v => `<option ${v === s.fps ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field">Cor de fundo<input type="color" data-k="bg" value="${s.bg}" style="width:100%"></label>
      <label class="fcheck"><input type="checkbox" data-k="rescale" checked> Ao mudar o tamanho, reposicionar e redimensionar os objetos proporcionalmente</label>
    </div></div>`);
    $$('[data-t]', f).forEach(ch => ch.onclick = () => { const t = TEMPLATES.find(x => x.id === ch.dataset.t); $('[data-k=w]', f).value = t.w; $('[data-k=h]', f).value = t.h; $('[data-k=fps]', f).value = t.fps; });
    const o = await UI.modal({ title: 'Configurações do projeto', icon: 'gear', body: f, width: 500, enterValue: true, buttons: [{ label: 'Cancelar', value: null }, { label: 'Aplicar', kind: 'primary', collect: () => this.readForm(f) }] });
    if (!o) return;
    const nw = clamp(+o.w | 0, 16, 7680), nh = clamp(+o.h | 0, 16, 7680), nf = +o.fps;
    const changes = [];
    if (nw !== s.w || nh !== s.h) changes.push(`Tamanho: <b>${s.w}×${s.h}</b> → <b>${nw}×${nh}</b>${o.rescale ? ' (objetos ajustados proporcionalmente)' : ' (objetos ficam onde estão)'}`);
    if (nf !== s.fps) changes.push(`Quadros por segundo: <b>${s.fps}</b> → <b>${nf}</b> (tempos arredondados para os novos quadros)`);
    if (changes.length && !await UI.confirm({ title: 'Isso vai mudar o projeto', msg: changes.join('<br>') + '<br><br>Você pode desfazer depois com Ctrl+Z.', ok: 'Aplicar mudanças', icon: 'alert' })) return;
    if (o.rescale && (nw !== s.w || nh !== s.h)) {
      const kx = nw / s.w, ky = nh / s.h, k = Math.min(kx, ky);
      App.project.clips.forEach(c => {
        if (!c.tr) return; c.tr.x = Math.round(c.tr.x * kx); c.tr.y = Math.round(c.tr.y * ky);
        if (!['image', 'gif', 'video'].includes(c.type) || c.tr.fit === 'none') c.tr.scale = round(c.tr.scale * k, 3);
        if (c.kf['tr.x']) c.kf['tr.x'].forEach(q => q.v = Math.round(q.v * kx)); if (c.kf['tr.y']) c.kf['tr.y'].forEach(q => q.v = Math.round(q.v * ky));
        if (c.kf['tr.scale'] && (!['image', 'gif', 'video'].includes(c.type) || c.tr.fit === 'none')) c.kf['tr.scale'].forEach(q => q.v = round(q.v * k, 3));
      });
    }
    Object.assign(s, { w: nw, h: nh, fps: nf, bg: o.bg }); App.project.name = o.name || App.project.name;
    if (changes.length) App.project.clips.forEach(c => { c.start = App.frame(c.start); c.dur = Math.max(1 / nf, App.frame(c.dur)); });
    App.fitPreview();
    App.commit('Configurações do projeto atualizadas', { toast: true });
  },
  async saveAsTemplate() {
    const s = App.project.settings;
    const n = await UI.prompt({ title: 'Salvar como modelo', label: `Nome do modelo (${s.w}×${s.h}, ${s.fps}fps)`, value: `Meu modelo ${s.w}×${s.h}`, ok: 'Salvar', icon: 'grid' });
    if (!n) return;
    await DB.put('templates', { id: uid('tp_'), name: n, w: s.w, h: s.h, fps: s.fps, bg: s.bg, created: Date.now() });
    UI.toast('Modelo salvo! Ele aparece na tela inicial.', { kind: 'ok' });
  },

  /* ---------- ajuda ---------- */
  shortcuts() { Keys.open(); },
  howTo() {
    UI.modal({ title: 'Como funciona', icon: 'info', width: 560, body: `
      <p><b>1. Mídia:</b> importe imagens (PNG dos personagens), cenários, vídeos e sons. Arraste para a linha do tempo.</p>
      <p><b>2. Faixas:</b> as de cima ficam na frente. Faixas <b>roxas</b> (Efeitos) mudam tudo que está abaixo delas.</p>
      <p><b>3. Animações:</b> pulinho, tremer, andar, susto… arraste em cima do clipe. A barrinha <b style="color:#ffd34d">amarela</b> no clipe é a animação: arraste para mudar quando acontece, puxe a ponta para mudar a duração.</p>
      <p><b>4. Efeitos:</b> barrinha <b style="color:#d9a8ff">lilás</b>. Glitch, TV chiando etc. Cada um tem som pronto, outro som ou sem som.</p>
      <p><b>5. Repetir:</b> botão direito no clipe → <b>Repetir efeitos nos próximos clipes</b>, ou Copiar efeitos e Colar efeitos (com tempo personalizado).</p>
      <p><b>6. Animar à mão:</b> ◆ ao lado de qualquer valor cria um keyframe. Mude o tempo e o valor: o editor faz o caminho.</p>
      <p><b>7. Salvar:</b> fica salvo neste computador sozinho. <b>Arquivo → Salvar arquivo .toon</b> cria um arquivo único com tudo dentro para mandar para outra pessoa.</p>`, buttons: [{ label: 'Bora!', kind: 'primary' }] });
  },
};
