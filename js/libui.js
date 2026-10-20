/* ===================== libui.js — painel da biblioteca (mídia, animações, efeitos, sons, microfone) ===================== */
'use strict';

const LibUI = {
  tab: 'cena', q: '', presets: [], dragKind: null,
  TABS: [['cena', 'Cena', 'layers'], ['media', 'Mídia', 'folder'], ['anim', 'Animações', 'jump'], ['fx', 'Efeitos', 'sparkles'], ['trans', 'Transições', 'transition'], ['text', 'Texto e formas', 'text'], ['sound', 'Sons', 'music'], ['rec', 'Gravar voz', 'mic'], ['saved', 'Salvos', 'bookmark']],
  async init() {
    const tb = $('#lib-tabs'); tb.innerHTML = '';
    this.TABS.forEach(([id, l, icn]) => { const b = h(`<button class="ltab ${this.tab === id ? 'on' : ''}" data-t="${id}" title="${l}">${ic(icn, 17)}<small>${l}</small></button>`); b.onclick = () => this.setTab(id); tb.appendChild(b); });
    $('#lib-search').oninput = e => { this.q = e.target.value.toLowerCase().trim(); this.render(); };
    this.presets = (await DB.all('presets')).sort((a, b) => b.created - a.created);
    this.render();
  },
  setTab(id) { this.tab = id; $$('.ltab').forEach(b => b.classList.toggle('on', b.dataset.t === id)); $('#lib-search').value = ''; this.q = ''; this.render(); },
  match(s) { return !this.q || String(s).toLowerCase().includes(this.q); },
  render() {
    const b = $('#lib-body'); if (!b || !App.project) return;
    const st = b.scrollTop; b.innerHTML = '';
    $('#lib-search').parentElement.style.display = this.tab === 'rec' ? 'none' : '';
    this['tab_' + this.tab](b);
    b.scrollTop = st;
  },
  drag(el, data) {
    el.draggable = true;
    el.addEventListener('dragstart', e => { this.dragKind = data.kind; e.dataTransfer.setData('text/plain', JSON.stringify(data)); e.dataTransfer.effectAllowed = 'copy'; });
    el.addEventListener('dragend', () => { this.dragKind = null; Timeline.showDrop(null); });
  },

  tab_cena(b) { Cena.render(b); },
  /* ---------- Mídia (com pastas) ---------- */
  folder: null, selAssets: new Set(), newAssets: new Set(),
  folders() { return App.project.folders ||= []; },
  // Ctrl+A na Mídia: seleciona tudo o que está aparecendo (dentro da pasta aberta, ou na Mídia principal)
  selectAllVisible() {
    const ids = this.visible || []; if (!ids.length) return UI.toast('Nada para selecionar aqui.', { time: 1500 });
    this.selAssets = new Set(ids); this.render();
    const f = (App.project.folders || []).find(x => x.id === this.folder);
    UI.toast(`${ids.length} mídia(s) selecionada(s)${f ? ` na pasta "${esc(f.name)}"` : ''}`, { time: 1600 });
  },
  folderOf(id) { const f = (App.project.assetFolders || {})[id]; return f && (App.project.folders || []).some(x => x.id === f) ? f : null; },
  moveToFolder(ids, fid) {
    App.project.assetFolders ||= {};
    ids.forEach(id => { if (fid) App.project.assetFolders[id] = fid; else delete App.project.assetFolders[id]; });
    const f = this.folders().find(x => x.id === fid);
    App.commit(`${ids.length} mídia(s) movida(s) para ${f ? '"' + esc(f.name) + '"' : 'Mídia'}`, { toast: true, lib: true });
  },
  async newFolder(withIds) {
    const n = await UI.prompt({ title: 'Nova pasta', label: 'Nome da pasta', value: 'Personagens', ok: 'Criar pasta', icon: 'folder' });
    if (!n) return null;
    const f = { id: uid('f_'), name: n }; this.folders().push(f);
    if (withIds && withIds.length) { App.project.assetFolders ||= {}; withIds.forEach(id => App.project.assetFolders[id] = f.id); }
    App.commit(`Pasta "${esc(n)}" criada`, { toast: true, lib: true });
    return f;
  },
  async deleteFolder(f) {
    const ids = Object.entries(App.project.assetFolders || {}).filter(([, v]) => v === f.id).map(([k]) => k);
    if (!await UI.confirm({ title: 'Excluir pasta?', msg: `A pasta "<b>${esc(f.name)}</b>" será apagada.${ids.length ? `<br>As <b>${ids.length}</b> mídia(s) dentro dela <b>não</b> são apagadas: elas voltam para a Mídia principal.` : ''}`, ok: 'Excluir pasta', danger: true })) return;
    ids.forEach(id => delete App.project.assetFolders[id]);
    App.project.folders = this.folders().filter(x => x !== f); if (this.folder === f.id) this.folder = null;
    App.commit('Pasta excluída', { toast: true, lib: true });
  },
  // abre a Mídia mostrando as mídias novas selecionadas
  reveal(ids) {
    if (!ids.length) return;
    const f = this.folderOf(ids[0]); this.folder = f;
    this.selAssets = new Set(ids); this.newAssets = new Set(ids);
    this.setTab('media');
    setTimeout(() => { const el = $(`.acard[data-asset="${ids[0]}"]`); el && el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 50);
    setTimeout(() => { ids.forEach(id => this.newAssets.delete(id)); $$('.acard.new').forEach(e => e.classList.remove('new')); }, 6000);
  },
  dropTarget(el, fid) {
    el.addEventListener('dragover', e => { if (this.dragKind === 'asset') { e.preventDefault(); el.classList.add('over'); } });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', e => {
      el.classList.remove('over'); if (this.dragKind !== 'asset') return; e.preventDefault(); e.stopPropagation(); e._handled = true;
      let d; try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
      this.moveToFolder(d.ids || [d.id], fid);
    });
  },
  tab_media(b) {
    TeamLib.section(b);
    const z = h(`<div class="import-zone compact" title="Clique, ou arraste arquivos para qualquer lugar do editor">${ic("upload", 15)}<b>Importar</b></div>`);
    z.onclick = () => Actions.importDialog();
    const rb = h(`<button class="import-zone compact rig-add" title="Trazer um boneco com ossos (do Estúdio ou montar com partes + modelo). Ou: botão direito numa imagem → Separar boca e olhos.">${ic("layers", 15)}<b>Boneco com ossos</b></button>`); rb.onclick = () => RigEdit.addRigModal();
    z.ondragover = e => { e.preventDefault(); z.classList.add('over'); }; z.ondragleave = () => z.classList.remove('over');
    z.ondrop = e => { e.preventDefault(); e._handled = true; z.classList.remove('over'); if (e.dataTransfer.files.length) Actions.importFiles([...e.dataTransfer.files]); };
    const zr = h('<div class="imp-row"></div>'); zr.append(z, rb); b.appendChild(zr);
    const folders = this.folders(), cur = folders.find(f => f.id === this.folder) || null; if (!cur) this.folder = null;
    // barra de pastas
    const bar = h(`<div class="folder-bar"><div class="crumb"><span data-root>${ic('folder', 13)} Mídia</span>${cur ? `${ic('right', 12)}<b>${esc(cur.name)}</b>` : ''}</div>${this.selAssets.size ? `<button class="ibtn xs" data-a="clr" title="Limpar seleção">${ic('x', 12)}</button>` : ''}<button class="btn sm" data-a="nf">${ic('plus', 12)} Pasta</button></div>`);
    $('[data-root]', bar).onclick = () => { this.folder = null; this.render(); };
    this.dropTarget($('[data-root]', bar), null);
    $('[data-a=nf]', bar).onclick = () => this.newFolder(this.selAssets.size ? [...this.selAssets] : null);
    if ($('[data-a=clr]', bar)) $('[data-a=clr]', bar).onclick = () => { this.selAssets.clear(); this.render(); };
    b.appendChild(bar);
    const all = Assets.list(App.project.id);
    if (!cur && !this.q) b.appendChild(StyleRefs.section());
    // pastas (só na raiz e sem busca)
    if (!cur && !this.q && folders.length) {
      const g = h('<div class="agrid" style="margin-bottom:10px"></div>');
      folders.forEach(f => {
        const n = all.filter(a => this.folderOf(a.id) === f.id).length;
        const el = h(`<div class="fcard" title="Abrir pasta · arraste mídias para cá"><span class="f-ic">${ic('folder', 18)}</span><b>${esc(f.name)}</b><small>${n}</small></div>`);
        el.onclick = () => { this.folder = f.id; this.render(); };
        el.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [{ head: f.name }, { label: 'Abrir', icon: 'folder', action: () => { this.folder = f.id; this.render(); } }, { label: 'Renomear', icon: 'edit', action: async () => { const nn = await UI.prompt({ title: 'Renomear pasta', label: 'Nome', value: f.name }); if (nn) { f.name = nn; App.commit('Pasta renomeada', { lib: true }); } } }, '-', { label: 'Excluir pasta', icon: 'trash', danger: true, action: () => this.deleteFolder(f) }]); };
        this.dropTarget(el, f.id);
        g.appendChild(el);
      });
      b.appendChild(g);
    }
    const list = all.filter(a => this.match(a.name) && (this.q ? true : this.folderOf(a.id) === (cur ? cur.id : null)));
    this.visible = list.map(a => a.id);
    if (!list.length) { if (cur || !all.length) b.appendChild(h(`<div class="hint">${cur ? 'Pasta vazia — arraste mídias para cá.' : 'Nenhuma mídia ainda — importe ou arraste arquivos para o editor.'}</div>`)); return; }
    const used = new Set(App.project.clips.map(c => c.assetId));
    const groups = { image: 'Imagens', gif: 'GIFs', video: 'Vídeos', audio: 'Áudios' };
    let lastClicked = null; const order = [];
    for (const [k, title] of Object.entries(groups)) {
      const items = list.filter(a => a.kind === k); if (!items.length) continue;
      b.appendChild(h(`<div class="lgroup">${title} (${items.length})</div>`));
      const g = h('<div class="agrid"></div>');
      items.forEach(a => {
        order.push(a.id);
        const rt = Assets.get(a.id);
        const thumb = a.thumb ? `background-image:url('${a.thumb}')` : '';
        const el = h(`<div class="acard ${this.selAssets.has(a.id) ? 'sel' : ''} ${this.newAssets.has(a.id) ? 'new' : ''}" data-asset="${a.id}" title="${esc(a.name)}\nClique: selecionar · 2 cliques ou +: colocar no cursor · arraste para a linha do tempo"><span class="a-add" title="Colocar no cursor">${ic('plus', 13)}</span><div class="athumb" style="${thumb}">${a.kind === 'audio' ? ic('music', 26) : ''}${!a.thumb && a.kind !== 'audio' ? ic(a.kind === 'video' ? 'film' : 'image', 24) : ''}<span class="akind">${ic({ image: 'image', gif: 'gif', video: 'film', audio: 'music' }[a.kind], 11)}</span>${a.dur ? `<span class="adur">${fmtTime(a.dur, 30, false)}</span>` : ''}${rt?.error ? `<span class="adur" style="background:#a12;left:5px;right:auto">erro</span>` : ''}${(() => { const tr = Transcribe.get(a.id); if (!tr) return ''; return `<span class="atr ${tr.status}" data-tr title="${tr.status === 'transcrevendo' ? 'Transcrevendo…' : tr.status === 'erro' ? 'A transcrição deu erro — clique para tentar de novo' : 'Transcrição pronta — clique para ver/editar'}">${tr.status === 'transcrevendo' ? '<span class="spin-dot"></span>' : ic('text', 10)}</span>`; })()}</div><div class="aname">${used.has(a.id) ? '● ' : ''}${esc(a.name)}</div></div>`);
        el.draggable = true;
        const trb = $('[data-tr]', el); if (trb) trb.onclick = e => { e.stopPropagation(); Transcribe.open(a.id); };
        el.addEventListener('dragstart', e => { this.dragKind = 'asset'; const ids = this.selAssets.has(a.id) && this.selAssets.size > 1 ? order.filter(x => this.selAssets.has(x)) : [a.id]; e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'asset', id: a.id, ids })); e.dataTransfer.effectAllowed = 'copyMove'; });
        el.addEventListener('dragend', () => { this.dragKind = null; Timeline.showDrop(null); });
        el.onclick = e => {
          if (e.target.closest('.a-add')) return Actions.addAssetAt(a.id, App.t);
          if (e.shiftKey && this.lastAsset) { const i0 = order.indexOf(this.lastAsset), i1 = order.indexOf(a.id); if (i0 >= 0) { order.slice(Math.min(i0, i1), Math.max(i0, i1) + 1).forEach(id => this.selAssets.add(id)); } }
          else if (e.ctrlKey || e.metaKey) { this.selAssets.has(a.id) ? this.selAssets.delete(a.id) : this.selAssets.add(a.id); }
          else this.selAssets = new Set([a.id]);
          this.lastAsset = a.id; this.render();
        };
        el.ondblclick = () => Actions.addAssetAt(a.id, App.t);
        el.oncontextmenu = e => {
          e.preventDefault(); if (!this.selAssets.has(a.id)) { this.selAssets = new Set([a.id]); this.render(); }
          const ids = [...this.selAssets];
          UI.ctx(e.clientX, e.clientY, [
            { head: ids.length > 1 ? `${ids.length} mídias` : a.name },
            { label: ids.length > 1 ? 'Colocar todas em sequência no cursor' : 'Colocar no cursor', icon: 'plus', action: () => { let t = App.t; ids.forEach(id => { const c = Actions.addAssetAt(id, t, null, true); if (c) t = c.start + c.dur; }); } },
            ids.length === 1 && a.kind === 'video' && { label: (App.project.refs || []).some(r => r.assetId === a.id) ? 'Referência de estilo ✓ (ver ficha)' : 'Usar como referência de estilo', icon: 'sparkles', action: () => { const r = (App.project.refs || []).find(x => x.assetId === a.id); r ? StyleRefs.open(r) : StyleRefs.addVideo(a.id); } },
            ids.length === 1 && a.kind === 'image' && { label: '🖼️ Editar / limpar imagem (máscara, varinha, IA)…', action: () => ImgEdit.open({ asset: a.id, name: a.name, onSave: () => this.render() }) },
            { label: ids.length > 1 ? `Citar na IA (${ids.length})` : 'Citar na IA', icon: 'sparkles', ai: true, action: () => Assistant.cite(ids.map(id => ({ kind: 'midia', id }))) },
            { label: ids.length > 1 ? `Enviar para a equipe (nuvem) (${ids.length})` : 'Enviar para a equipe (nuvem)', icon: 'upload', action: () => TeamLib.uploadAssets(ids) },
            ids.length === 1 && Transcribe.can(a.id) && { label: Transcribe.get(a.id)?.segs?.length ? 'Transcrição (ver / editar)…' : Transcribe.get(a.id)?.status === 'transcrevendo' ? 'Transcrevendo…' : 'Transcrever o áudio', icon: 'text', action: () => Transcribe.open(a.id) },
            (a.kind === 'audio' || a.hasAudio) && ids.length === 1 && { label: 'Ouvir', icon: 'play', action: () => AudioEngine.preview(a.id) },
            (a.kind === 'image' || a.kind === 'gif') && ids.length === 1 && { label: 'Recortar e salvar como imagem nova…', icon: 'crop', action: () => CropEditor.open(null, a) },
            a.kind === 'image' && ids.length === 1 && typeof SpriteSplit !== 'undefined' && { label: 'Separar sprites automaticamente…', icon: 'crop', action: () => SpriteSplit.dialog(a) },
            ids.length === 1 && a.kind !== 'audio' && { label: App.project.cover === a.id ? 'É a capa do projeto ✓ (tirar)' : 'Usar como capa do projeto', icon: 'image', action: () => Actions.setCover(App.project.cover === a.id ? null : a.id) },
            { label: 'Mover para pasta', icon: 'folder', sub: [{ label: 'Mídia (principal)', action: () => this.moveToFolder(ids, null) }, ...this.folders().map(f => ({ label: f.name, action: () => this.moveToFolder(ids, f.id) })), '-', { label: 'Nova pasta…', icon: 'plus', action: () => this.newFolder(ids) }] },
            ids.length === 1 && { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Renomear mídia', label: 'Nome', value: a.name }); if (n) { await Assets.rename(a.id, n); App.onAssetsChanged(); } } },
            '-',
            { label: ids.length > 1 ? `Excluir ${ids.length} mídias` : 'Excluir do projeto', icon: 'trash', danger: true, action: async () => { for (const id of ids) { const m = Assets.meta(id); if (m) await Actions.deleteAsset(m); } } },
          ]);
        };
        g.appendChild(el);
      });
      b.appendChild(g);
    }
  },

  /* ---------- Animações ---------- */
  tab_anim(b) {
    b.appendChild(h(`<div class="hint">Arraste para <b>cima de um clipe</b> (começa onde você soltar) ou selecione clipes e clique. Passe o mouse para ver.</div>`));
    for (const [cat, list] of Object.entries(groupBy(ANIMS))) {
      const items = list.filter(a => this.match(a.name + ' ' + cat)); if (!items.length) continue;
      b.appendChild(h(`<div class="lgroup">${cat}</div>`));
      const g = h('<div class="lgrid"></div>');
      items.forEach(a => {
        const el = h(`<div class="lcard" title="${esc(a.hint || a.name)}"><div class="mini"><div class="mini-scene"><div class="mini-fig"></div></div></div><div class="lname"><span>${a.name}</span>${a.sound ? `<span class="snd-ic">${ic('vol', 11)}</span>` : ''}</div></div>`);
        this.drag(el, { kind: 'anim', id: a.id });
        el.onclick = () => this.applyToSelection('anim', a.id);
        this.miniAnim(el, a); this.sndToggle(el, ANIMS[a.id]);
        g.appendChild(el);
      });
      b.appendChild(g);
    }
  },
  miniAnim(el, def) {
    const fig = $('.mini-fig', el); let raf, t0;
    const step = now => {
      const dur = Math.max(.3, def.dur), cyc = dur + .5, t = ((now - t0) / 1000) % cyc, p = Math.min(1, t / dur);
      const r = def.fn(p, defaultParams(def), { t: Math.min(t, dur), dur, W: 120, H: 70 }) || {};
      const sc = .12; // escala para miniatura
      fig.style.transformOrigin = r.pivot === 'bottom' ? '50% 100%' : '50% 50%';
      fig.style.transform = `translate(${(r.dx || 0) * sc}px,${(r.dy || 0) * sc}px) rotate(${r.rot || 0}deg) scale(${r.sx ?? 1},${r.sy ?? 1})`;
      fig.style.opacity = r.op ?? 1;
      raf = requestAnimationFrame(step);
    };
    el.onmouseenter = () => { t0 = performance.now(); raf = requestAnimationFrame(step); };
    el.onmouseleave = () => { cancelAnimationFrame(raf); fig.style.transform = ''; fig.style.opacity = 1; };
  },

  /* ---------- Efeitos ---------- */
  tab_fx(b) {
    b.appendChild(h(`<div class="hint">Solte em <b>um clipe</b> → afeta só ele. Solte numa <b>faixa de efeitos</b> (roxa) → afeta a tela toda. Selecione vários clipes e clique para aplicar em todos.</div>`));
    const colors = { 'Clássicos': '#ff4d6a', 'Câmera': '#3d8bff', 'Retrô': '#ffb020', 'Imagem': '#19d3f0', 'Cor': '#2fcf7a', 'Personagem': '#d9a8ff' };
    for (const [cat, list] of Object.entries(groupBy(FX))) {
      const items = list.filter(a => this.match(a.name + ' ' + cat)); if (!items.length) continue;
      b.appendChild(h(`<div class="lgroup">${cat}</div>`));
      const g = h('<div class="lgrid"></div>');
      items.forEach(f => {
        const el = h(`<div class="lcard" title="${esc(f.hint || f.name)}"><div class="mini dark"><canvas width="132" height="62" style="width:100%;height:100%"></canvas></div><div class="lname"><span>${f.name}</span>${f.sound ? `<span class="snd-ic">${ic('vol', 11)}</span>` : ''}</div></div>`);
        this.drag(el, { kind: 'fx', id: f.id });
        el.onclick = () => this.applyToSelection('fx', f.id);
        this.miniFx(el, f.id, colors[cat]); this.sndToggle(el, FX[f.id]);
        g.appendChild(el);
      });
      b.appendChild(g);
    }
  },
  miniScene(c, w, h2) {
    const g = c.createLinearGradient(0, 0, 0, h2); g.addColorStop(0, '#5ab7ff'); g.addColorStop(.6, '#9fe0ff'); c.fillStyle = g; c.fillRect(0, 0, w, h2);
    c.fillStyle = '#3fae5a'; c.fillRect(0, h2 * .68, w, h2); c.fillStyle = '#ffe14d'; c.beginPath(); c.arc(w * .82, h2 * .25, 7, 0, 7); c.fill();
    c.fillStyle = '#000'; c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; c.lineTo(w / 2 + Math.cos(a) * 17, h2 * .52 + Math.sin(a) * 17); } c.fill();
    c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; c.lineTo(w / 2 + Math.cos(a) * 14, h2 * .52 + Math.sin(a) * 14); } c.fill();
    c.fillStyle = '#000'; c.fillRect(w / 2 - 6, h2 * .48, 3, 5); c.fillRect(w / 2 + 3, h2 * .48, 3, 5);
  },
  miniFx(el, id, col) {
    const cv = $('canvas', el), c = cv.getContext('2d'); let raf, t0;
    const draw = (t, p) => {
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
      if (t === null) return;
      if (!FX[id].clipOnly) this.miniScene(c, cv.width, cv.height);
      const def = FX[id], x = { t, p, dur: def.dur, q: .25, W: cv.width, H: cv.height, tmp: (n, w, hh) => Renderer.tmp('mini' + n, w, hh), copy: (cv2, k) => Renderer.copy(cv2, 'mini' + (k || 'cp')) };
      if (def.clipOnly) { // personagem sozinho (fundo transparente) para mostrar contorno/sombra/brilho
        const l = Renderer.tmp('minichar', cv.width, cv.height), lc = l.getContext('2d'); lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = 'source-over'; lc.filter = 'none'; lc.clearRect(0, 0, cv.width, cv.height);
        const hx = (r, col) => { lc.fillStyle = col; lc.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; lc.lineTo(cv.width / 2 + Math.cos(a) * r, cv.height * .5 + Math.sin(a) * r); } lc.fill(); };
        hx(20, '#000'); hx(16, '#fff'); lc.fillStyle = '#000'; lc.fillRect(cv.width / 2 - 7, cv.height * .45, 4, 6); lc.fillRect(cv.width / 2 + 3, cv.height * .45, 4, 6);
        try { def.apply(lc, l, defaultParams(def), x); } catch (e) { }
        c.fillStyle = '#3fae5a'; c.fillRect(0, 0, cv.width, cv.height); const g = c.createLinearGradient(0, 0, 0, cv.height); g.addColorStop(0, '#5ab7ff'); g.addColorStop(1, '#9fe0ff'); c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height * .68);
        c.drawImage(l, 0, 0); return;
      }
      try { def.apply(c, cv, defaultParams(def), { ...x, q: .1 }); } catch (e) { }
    };
    draw(.35, .45);
    el.onmouseenter = () => { t0 = performance.now(); const step = now => { const dur = Math.max(.6, FX[id].dur), t = ((now - t0) / 1000) % dur; draw(t, t / dur); raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); };
    el.onmouseleave = () => { cancelAnimationFrame(raf); draw(.35, .45); };
  },

  /* ---------- Transições ---------- */
  tab_trans(b) {
    b.appendChild(h(`<div class="hint">Solte na <b>metade esquerda</b> de um clipe = entrada · <b>metade direita</b> = saída. Ou selecione clipes e clique (entrada).</div>`));
    const g = h('<div class="lgrid"></div>');
    Object.entries(TRANS).filter(([, t]) => this.match(t.name)).forEach(([id, t]) => {
      const el = h(`<div class="lcard" title="${esc(t.name)}"><div class="mini dark"><canvas width="132" height="62" style="width:100%;height:100%"></canvas></div><div class="lname"><span>${t.name}</span>${t.sound ? `<span class="snd-ic">${ic('vol', 11)}</span>` : ''}</div></div>`);
      this.drag(el, { kind: 'trans', id });
      el.onclick = () => this.applyToSelection('trans', id);
      el.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [{ label: 'Usar como entrada nos selecionados', action: () => Actions.setTrans(App.selected(), 'in', id) }, { label: 'Usar como saída nos selecionados', action: () => Actions.setTrans(App.selected(), 'out', id) }, { label: 'Entrada e saída nos selecionados', action: () => { Actions.setTrans(App.selected(), 'in', id, true); Actions.setTrans(App.selected(), 'out', id); } }]); };
      this.miniTrans(el, id); this.sndToggle(el, TRANS[id]);
      g.appendChild(el);
    });
    b.appendChild(g);
  },
  miniTrans(el, id) {
    const cv = $('canvas', el), c = cv.getContext('2d'), src = Renderer.tmp('minisrc' + id, cv.width, cv.height);
    this.miniScene(src.getContext('2d'), cv.width, cv.height);
    let raf, t0;
    const draw = v => {
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
      c.fillStyle = '#2b2140'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#ff4d6a'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('A', cv.width / 2, cv.height / 2);
      const d = TRANS[id], P = defaultParams(d);
      try { d.draw(c, src, (Ease[P.ease || 'inOut'] || Ease.inOut)(v), P, { q: .1, t: v, tmp: (n, w, hh) => Renderer.tmp('mt' + n, w, hh), copy: (x, k) => Renderer.copy(x, 'mt' + (k || 'cp')) }); } catch { }
    };
    draw(.55);
    el.onmouseenter = () => { t0 = performance.now(); const step = now => { const t = ((now - t0) / 1000) % 1.6; draw(clamp(t / 1.1, 0, 1)); raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); };
    el.onmouseleave = () => { cancelAnimationFrame(raf); draw(.55); };
  },

  /* ---------- Texto e formas ---------- */
  tab_text(b) {
    b.appendChild(h(`<div class="lgroup">Textos</div>`));
    Object.entries(TEXT_STYLES).filter(([, s]) => this.match(s.name)).forEach(([id, s]) => {
      const el = h(`<button class="lbtn"><div class="lb-prev" style="font-family:'${s.font}';color:${s.color};-webkit-text-stroke:${Math.min(2, s.strokeW / 5)}px ${s.stroke};${s.bgAmt ? `background:${s.bg}` : ''}">Aa</div><div><b>${s.name}</b><small>${esc(s.font)}</small></div></button>`);
      this.drag(el, { kind: 'text', id }); el.onclick = () => Actions.addNew('text', { style: id }); b.appendChild(el);
    });
    b.appendChild(h(`<div class="lgroup">Formas e balões</div>`));
    const g = h('<div class="lgrid"></div>');
    Object.entries(SHAPES).filter(([, n]) => this.match(n)).forEach(([k, n]) => {
      const el = h(`<div class="lcard" title="${n}"><div class="mini dark"><canvas width="132" height="62" style="width:100%;height:100%"></canvas></div><div class="lname"><span>${n}</span></div></div>`);
      const cv = $('canvas', el), c = cv.getContext('2d'); const sh = { kind: k, fill: k === 'bubble' || k === 'think' ? '#fff' : '#19d3f0', stroke: '#000', strokeW: k === 'bubble' || k === 'think' ? 2 : 0, radius: 8, fillOn: true };
      Renderer.shapePath(c, sh, { x: 66 - 30, y: 31 - (k === 'line' ? 2 : 24), w: 60, h: k === 'line' ? 4 : 48 }); c.fillStyle = sh.fill; c.fill(); if (sh.strokeW) { c.lineWidth = 2; c.stroke(); }
      this.drag(el, { kind: 'shape', id: k }); el.onclick = () => Actions.addNew('shape', { kind: k });
      g.appendChild(el);
    });
    b.appendChild(g);
    b.appendChild(h(`<div class="lgroup">Fundos</div>`));
    const g2 = h('<div class="lgrid"></div>');
    [['#1e88e5', 'Azul'], ['#19d3f0', 'Ciano'], ['#ffffff', 'Branco'], ['#000000', 'Preto'], ['#00b140', 'Chroma verde'], ['#ff4d6a', 'Vermelho']].filter(([, n]) => this.match(n + ' cor fundo')).forEach(([col, n]) => {
      const el = h(`<div class="lcard"><div class="mini" style="background:${col}"></div><div class="lname"><span>${n}</span></div></div>`);
      this.drag(el, { kind: 'color', id: col }); el.onclick = () => Actions.addNew('color', { color: col }); g2.appendChild(el);
    });
    b.appendChild(g2);
    // fundos com padrão que se repete para sempre
    const PRE = [['bolinhas', '#582ed6', '#ffffff', { c3: '#2896f5', alpha: .32, pulse: .6, bolhas: true, vinheta: true, size: 150, speed: 55, nome: 'Bolinhas do Shorts (degradê + pulsando)' }], ['bolinhas', '#7b4dff', '#9b78ff'], ['bolinhasGrade', '#ffd23f', '#ffb000'], ['quadrados', '#19d3f0', '#5fe4f7'], ['xadrez', '#222633', '#2e3445'], ['xadrezToalha', '#ffffff', '#e8203b'], ['listras', '#ff8fb1', '#ffb3c9'], ['diagonais', '#1e88e5', '#42a5f5'], ['grade', '#101522', '#2b3a66'], ['cruzes', '#3ee0b5', '#7af0d0'], ['estrelas', '#1b1f4a', '#ffde26'], ['coracoes', '#ffd6e5', '#ff4f8b'], ['losangos', '#ff7a2a', '#ff9c5c'], ['triangulos', '#00b140', '#22d36a'], ['zigueZague', '#ffe066', '#ff9f1c'], ['ondas', '#0e7490', '#22d3ee'], ['circulos', '#2a1b4a', '#a78bfa'], ['confete', '#ffffff', '#7b4dff'], ['espiral', '#000000', '#ffffff']];
    const list = PRE.filter(([k, , , x]) => this.match((x?.nome || PATTERNS[k]) + ' padrão fundo pattern repete'));
    if (list.length) {
      b.appendChild(h(`<div class="lgroup">Fundos com padrão (se repetem para sempre)</div>`));
      const g3 = h('<div class="lgrid"></div>');
      list.forEach(([k, c1, c2, x]) => {
        const { nome, ...more } = x || {}, pat = { padrao: k, c1, c2, ...more }, el = h(`<div class="lcard" title="Clique ou arraste para a linha do tempo. Depois mude cores, tamanho, velocidade e direção no painel da direita."><div class="mini"><canvas width="132" height="62" style="width:100%;height:100%"></canvas></div><div class="lname"><span>${nome || PATTERNS[k]}</span></div></div>`);
        PatternBG.draw($('canvas', el).getContext('2d'), { ...PatternBG.DEF(), ...pat, size: Math.min(34, pat.size || 34) }, { x: 0, y: 0, w: 132, h: 62 }, 0);
        this.drag(el, { kind: 'pattern', id: k, pat }); el.onclick = () => Actions.addNew('color', { pattern: pat }); g3.appendChild(el);
      });
      b.appendChild(g3);
    }
  },

  /* ---------- Sons ---------- */
  tab_sound(b) {
    const mg = h(`<div class="btn-row" style="margin:0 0 10px"><button class="btn sm primary" data-a="mus">${ic('music', 13)} Gerar música de fundo…</button></div>`);
    $('[data-a=mus]', mg).onclick = () => App.project ? MusicGen.dialog() : UI.toast('Abra um projeto primeiro.', { kind: 'warn' }); b.appendChild(mg);
    SoundLib.section(b);
    b.appendChild(h(`<div class="hint">Sons feitos pelo editor (não precisam de arquivo). Arraste para uma faixa de áudio, ou clique em ▶ para ouvir.</div>`));
    SOUNDS.list().filter(s => this.match(s.name)).forEach(s => {
      const el = h(`<button class="lbtn"><div class="lb-prev" style="background:#1d3a2a;color:#5fd48f" data-p>${ic('play', 16)}</div><div style="flex:1"><b>${s.name}</b><small>${fmtSec(s.sec)}${s.loop ? ' · repete' : ''}</small></div><span class="ibtn xs" data-add title="Colocar no cursor">${ic('plus', 13)}</span></button>`);
      this.drag(el, { kind: 'sound', id: s.id });
      $('[data-p]', el).onclick = e => { e.stopPropagation(); AudioEngine.preview('snd:' + s.id); };
      el.onclick = () => AudioEngine.preview('snd:' + s.id);
      $('[data-add]', el).onclick = e => { e.stopPropagation(); Actions.addAssetAt('snd:' + s.id, App.t); };
      b.appendChild(el);
    });
  },

  /* ---------- Salvos ---------- */
  tab_saved(b) {
    b.appendChild(h(`<div class="hint">Seus efeitos salvos para usar de novo (em qualquer projeto). Para salvar: botão direito num clipe → <b>Salvar efeitos como predefinição</b>. Arraste para um clipe para aplicar.</div>`));
    const list = this.presets.filter(p => this.match(p.name));
    if (!list.length) return b.appendChild(h(`<div class="empty" style="padding:20px">Nada salvo ainda.</div>`));
    const kinds = { style: 'Estilo completo', anim: 'Animação', fx: 'Efeito', trans: 'Transição' };
    list.forEach(p => {
      const parts = [];
      if (p.data.anims?.length) parts.push(...p.data.anims.map(a => ANIMS[a.type]?.name));
      if (p.data.fx?.length) parts.push(...p.data.fx.map(a => FX[a.type]?.name));
      if (p.data.trIn?.type) parts.push('Entrada: ' + TRANS[p.data.trIn.type]?.name);
      if (p.data.trOut?.type) parts.push('Saída: ' + TRANS[p.data.trOut.type]?.name);
      if (p.data.color) parts.push('Cores');
      if (p.data.kf && Object.keys(p.data.kf).length) parts.push('Keyframes');
      const el = h(`<div class="preset"><div class="preset-h">${ic('bookmark', 14)}<b>${esc(p.name)}</b><button class="ibtn xs" title="Mais">${ic('dots', 13)}</button></div><small style="color:var(--tx3)">${kinds[p.kind] || p.kind}</small><div class="chips">${parts.filter(Boolean).map(x => `<span class="chip static">${esc(x)}</span>`).join('')}</div></div>`);
      this.drag(el, { kind: 'preset', id: p.id });
      el.onclick = e => { if (!e.target.closest('button')) this.applyToSelection('preset', p.id); };
      $('button', el).onclick = e => UI.ctx(e.clientX, e.clientY, [
        { label: 'Aplicar nos selecionados', icon: 'check', action: () => this.applyToSelection('preset', p.id) },
        { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Renomear', label: 'Nome', value: p.name }); if (n) { p.name = n; await DB.put('presets', p); this.render(); } } },
        { label: 'Excluir', icon: 'trash', danger: true, action: async () => { if (await UI.confirm({ title: 'Excluir predefinição?', msg: `"<b>${esc(p.name)}</b>" será apagada da sua lista. Clipes que já usam continuam iguais.`, ok: 'Excluir', danger: true })) { await DB.del('presets', p.id); this.presets = this.presets.filter(x => x !== p); this.render(); UI.toast('Predefinição excluída', { kind: 'ok' }); } } },
      ]);
      b.appendChild(el);
    });
  },

  /* ---------- Gravar (microfone) ---------- */
  async tab_rec(b) {
    const s = Mic.settings, on = !!Mic.nodes;
    const audioTracks = App.project.tracks.filter(t => t.type === 'audio');
    const w = h(`<div>
      <div class="lgroup">Microfone</div>
      <label class="field">Dispositivo<div class="ctl-row"><select id="mic-dev" style="flex:1"><option value="">Padrão do sistema</option></select><button class="ibtn" id="mic-refresh" title="Atualizar lista">${ic('loop', 14)}</button></div></label>
      <div class="btn-row" style="margin-top:10px"><button class="btn ${on ? '' : 'primary'}" id="mic-on" style="flex:1">${ic('mic', 14)} ${on ? 'Desligar microfone' : 'Ligar microfone'}</button></div>
      <div style="margin:10px 0 4px;display:flex;align-items:center;gap:8px"><div style="flex:1;height:12px;background:var(--bg0);border:1px solid var(--bd2);border-radius:6px;overflow:hidden;position:relative"><i id="mic-bar" style="position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#2fcf7a,#ffb020 75%,#ff5470)"></i><i id="mic-pk" style="position:absolute;top:0;bottom:0;width:2px;background:#fff;left:0"></i><i id="mic-thr" style="position:absolute;top:-2px;bottom:-2px;width:2px;background:#ff4dd2;left:0;display:none"></i></div><span id="mic-gate" style="font-size:11px;color:var(--tx3);width:56px">—</span></div>
      <div class="lgroup">Limpeza do som</div>
      <div id="mic-sw" style="display:flex;flex-direction:column;gap:8px"></div>
      <div id="mic-sl" style="margin-top:10px"></div>
      <div class="lgroup">Ouvir a si mesmo (retorno)</div>
      <div id="mic-mon"></div>
      <div class="hint">${ic('headphones', 13)} Use <b>fone de ouvido</b> para o retorno, senão o som da caixa volta no microfone (microfonia).</div>
      <div class="lgroup">Gravação</div>
      <label class="field">Gravar na faixa<select id="mic-track">${audioTracks.map(t => `<option value="${t.id}" ${t.id === App.activeTrack ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}<option value="__new">+ Nova faixa de áudio</option></select></label>
      <div id="mic-opt" style="display:flex;flex-direction:column;gap:8px;margin:10px 0"></div>
      <button class="btn" id="mic-rec" style="width:100%;height:44px;font-size:14px;background:#4a1520;border-color:#ff5470;color:#fff" ${on ? '' : 'disabled'}><span style="color:#ff5470">${ic('rec', 16)}</span> Gravar a partir do cursor</button>
      <div id="mic-status" style="text-align:center;margin-top:8px;color:var(--tx2);font-variant-numeric:tabular-nums"></div>
    </div>`);
    b.appendChild(w);
    const fill = async () => {
      const ds = await Mic.devices(), sel = $('#mic-dev'); if (!sel) return;
      sel.innerHTML = '<option value="">Padrão do sistema</option>' + ds.map((d, i) => `<option value="${d.deviceId}" ${d.deviceId === s.deviceId ? 'selected' : ''}>${esc(d.label || 'Microfone ' + (i + 1))}</option>`).join('');
    };
    fill();
    $('#mic-refresh').onclick = fill;
    $('#mic-dev').onchange = async e => { s.deviceId = e.target.value; Mic.saveSettings(); if (Mic.nodes) await this.micToggle(true); };
    $('#mic-on').onclick = () => this.micToggle(!Mic.nodes);
    const reopen = async () => { Mic.saveSettings(); if (Mic.nodes) await this.micToggle(true); };
    const sw = $('#mic-sw');
    sw.appendChild(Props.sw('Redução de ruído (do navegador)', s.noiseSuppression, v => { s.noiseSuppression = v; reopen(); }));
    sw.appendChild(Props.sw('Cancelar eco', s.echoCancellation, v => { s.echoCancellation = v; reopen(); }));
    sw.appendChild(Props.sw('Volume automático', s.autoGainControl, v => { s.autoGainControl = v; reopen(); }));
    const fake = { kf: {}, start: 0 }, sl = $('#mic-sl');
    const mk = (l, k, min, max, unit, step, hint) => { const r = Props.slider(fake, { l, get: () => s[k], set: v => { s[k] = v; Mic.apply(); }, min, max, step, unit, kf: false }); if (hint) r.title = hint; return r; };
    sl.appendChild(mk('Volume do microfone (ganho)', 'gain', 0, 400, '%'));
    sl.appendChild(mk('Portão de ruído (corta som baixo)', 'gate', 0, 100, '%', 1, 'Tudo abaixo desse nível vira silêncio. Aumente até o chiado de fundo sumir quando você não fala.'));
    sl.appendChild(mk('Cortar graves (zumbido)', 'highpass', 10, 400, 'Hz'));
    const mon = $('#mic-mon');
    mon.appendChild(Props.sw('Ouvir meu microfone', s.monitor, v => { s.monitor = v; Mic.apply(); }));
    mon.appendChild(mk('Volume do retorno', 'monitorVol', 0, 150, '%'));
    const opt = $('#mic-opt');
    opt.appendChild(Props.sw('Contagem 3, 2, 1 antes de gravar', s.countdown, v => { s.countdown = v; Mic.saveSettings(); }));
    opt.appendChild(Props.sw('Tocar o vídeo enquanto gravo', s.playWhile, v => { s.playWhile = v; Mic.saveSettings(); }));
    opt.appendChild(mk('Compensar atraso', 'latency', 0, 500, 'ms', 5, 'Se a voz ficar atrasada em relação ao vídeo, aumente aqui.'));
    $('#mic-rec').onclick = () => Mic.recording ? this.stopRec() : this.startRec();
    if (Mic.recording) this.recUI(true);
  },
  async micToggle(on) {
    try {
      if (on) { await Mic.open(); UI.toast('Microfone ligado', { kind: 'ok' }); }
      else { if (Mic.recording) await this.stopRec(); Mic.close(); }
    } catch (e) {
      UI.modal({ title: 'Não consegui ligar o microfone', icon: 'mic', kind: 'danger', body: `<p>${esc(e.message || e)}</p><p>Verifique se você permitiu o microfone no navegador (ícone de cadeado ao lado do endereço) e se nenhum outro programa está usando ele.</p>`, buttons: [{ label: 'Entendi', kind: 'primary' }] });
    }
    if (this.tab === 'rec') this.render();
  },
  meter() {
    const bar = $('#mic-bar'); if (!bar) return;
    const toPct = v => clamp((20 * Math.log10(v + 1e-6) + 60) / 60 * 100, 0, 100);
    bar.style.width = toPct(Mic.level) + '%'; $('#mic-pk').style.left = toPct(Mic.peakHold) + '%';
    const thr = $('#mic-thr'); if (Mic.settings.gate > 0) { thr.style.display = 'block'; thr.style.left = clamp((-80 + Mic.settings.gate * .7 + 60) / 60 * 100, 0, 100) + '%'; } else thr.style.display = 'none';
    $('#mic-gate').textContent = Mic.settings.gate > 0 ? (Mic.gateOpen ? 'aberto' : 'silêncio') : (Mic.level > .95 ? 'ALTO!' : '');
    $('#mic-gate').style.color = Mic.level > .95 ? 'var(--err)' : Mic.gateOpen ? 'var(--ok)' : 'var(--tx3)';
    if (Mic.recording && $('#mic-status')) $('#mic-status').innerHTML = `<b style="color:#ff5470">● Gravando</b> ${fmtTime((performance.now() - Mic.recStart) / 1000, 30, false)}`;
  },
  // atalho R / botão Gravar: liga o microfone se precisar e começa (ou para) a gravação
  async quickRecord() {
    if (Mic.recording) return this.stopRec();
    if (this._starting) return;
    if (!Mic.nodes) { try { await Mic.open(); } catch (e) { return this.micToggle(true); } if (this.tab === 'rec') this.render(); }
    this.startRec();
  },
  pickRecTrack() {
    const sel = $('#mic-track')?.value, p = App.project, t = App.t;
    if (sel === '__new') return Actions.addTrack('audio', undefined, true).id;
    const freeAfter = id => !p.clips.some(c => c.trackId === id && c.start + c.dur > t + 1e-3);
    const pref = sel && App.track(sel) ? sel : (App.track(App.activeTrack)?.type === 'audio' ? App.activeTrack : null);
    if (pref && freeAfter(pref)) return pref;
    const other = p.tracks.find(k => k.type === 'audio' && !k.lock && freeAfter(k.id));
    return other ? other.id : Actions.addTrack('audio', undefined, true).id;
  },
  async startRec() {
    this._starting = true;
    try {
      if (App.playing) App.pause();
      const tk = this.pickRecTrack();
      this.recTrack = tk; this.recAt = App.t;
      if (Mic.settings.countdown) {
        const ov = h(`<div style="position:fixed;inset:0;display:grid;place-items:center;z-index:2000;background:rgba(0,0,0,.45);pointer-events:none"><div style="font-size:140px;font-weight:900;color:#fff;text-shadow:0 6px 30px #000">3</div></div>`);
        document.body.appendChild(ov);
        for (const n of [3, 2, 1]) { ov.firstChild.textContent = n; AudioEngine.preview('snd:type', .6); await sleep(700); }
        ov.remove();
      }
      try { Mic.start(); } catch (e) { return UI.toast(esc(e.message), { kind: 'err' }); }
      App.recording = { trackId: tk, start: this.recAt, peaks: [] };
      App.seek(this.recAt);
      App.play({ silent: !Mic.settings.playWhile, keepPos: true }); // o cursor vermelho anda até você parar
      Timeline.render(); this.recUI(true);
      $('#tl-rec') && ($('#tl-rec').innerHTML = `${ic('stop', 12)} Parar (R)`);
      UI.toast('Gravando… aperte <b>R</b>, <b>Espaço</b> ou <b>Esc</b> para parar', { kind: 'info', time: 3000 });
    } finally { this._starting = false; }
  },
  recUI(on) { const b = $('#mic-rec'); if (b) { b.innerHTML = on ? `${ic('stop', 15)} Parar gravação (R)` : `<span style="color:#ff5470">${ic('rec', 16)}</span> Gravar a partir do cursor (R)`; b.style.background = on ? '#ff5470' : '#4a1520'; } const t = $('#tl-rec'); if (t && !on) t.innerHTML = `<span style="color:#ff5470">${ic('rec', 12)}</span> Gravar`; },
  async stopRec() {
    if (!Mic.recording) return;
    const blob = await Mic.stop(); App.recording = null; if (App.playing) App.pause();
    this.recUI(false); if ($('#mic-status')) $('#mic-status').textContent = '';
    if (!blob || blob.size < 200) { Timeline.render(); return UI.toast('Gravação vazia', { kind: 'warn' }); }
    const n = Assets.list(App.project.id).filter(a => a.name.startsWith('Gravação')).length + 1;
    const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
    const rt = await Assets.addBlob(blob, `Gravação ${n}.${ext}`, App.project.id, 'audio');
    if (rt.error || !rt.meta.dur) { Timeline.render(); return UI.toast('Não consegui ler a gravação: ' + esc(rt.error || ''), { kind: 'err' }); }
    App.project.bin.push(rt.meta.id);
    const lat = (Mic.settings.latency || 0) / 1000;
    const c = App.makeClip('audio', { trackId: this.recTrack, start: this.recAt, dur: Math.max(.1, rt.meta.dur - lat), offset: lat, assetId: rt.meta.id, name: rt.meta.name.replace(/\.[^.]+$/, '') });
    App.project.clips.push(c); Actions.resolveOverlaps([c]);
    App.select(c.id); App.seek(c.start + c.dur);
    App.commit(`Gravação adicionada (${fmtSec(c.dur)})`, { toast: true, all: true });
    Transcribe.auto([rt.meta.id]);
  },

  /* ---------- aplicar ao clicar ---------- */
  applyToSelection(kind, id) {
    const sel = App.selected();
    if (kind === 'anim') { const v = sel.filter(c => !['audio', 'fx'].includes(c.type)); if (!v.length) return UI.toast('Selecione um ou mais clipes (imagem, texto, vídeo…) ou arraste a animação até um clipe.', { kind: 'warn' }); return Actions.addAnim(v, id, null); }
    if (kind === 'fx') {
      const v = sel.filter(c => !['audio', 'fx'].includes(c.type));
      if (!v.length) { if (FX[id].clipOnly) return UI.toast('Esse efeito é para personagens: selecione um clipe.', { kind: 'warn' }); return Actions.addScreenFx(id, App.t); }
      return Actions.addFx(v, id, null);
    }
    if (kind === 'trans') { const v = sel.filter(c => !['audio', 'fx'].includes(c.type)); if (!v.length) return UI.toast('Selecione um clipe para colocar a transição.', { kind: 'warn' }); return Actions.setTrans(v, 'in', id); }
    if (kind === 'preset') { const p = this.presets.find(p => p.id === id); if (!sel.length) return UI.toast('Selecione os clipes onde aplicar.', { kind: 'warn' }); return Actions.applyPreset(p, sel, null); }
  },

  /* ---------- soltar na linha do tempo ---------- */
  async handleDrop(e, { trackId, time, clipId }) {
    const tk = App.track(trackId);
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      const rts = await Actions.importFiles([...e.dataTransfer.files]);
      const over = clipId ? App.clip(clipId) : null;
      if (over && rts.length === 1 && Actions.canSwap(over, rts[0].meta.id)) { const r = await Actions.askReplace(over, rts[0].meta.id); if (r !== 'add') return; }
      let t = time; for (const rt of rts) { const c = Actions.addAssetAt(rt.meta.id, t, trackId, true); if (c) t = c.start + c.dur; }
      return;
    }
    let data; try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
    this.dragKind = null;
    const clip = clipId ? App.clip(clipId) : null;
    if (tk?.lock) return UI.toast('Essa faixa está travada.', { kind: 'warn' });
    switch (data.kind) {
      case 'asset': if (clip && !(data.ids && data.ids.length > 1) && Actions.canSwap(clip, data.id)) { const r = await Actions.askReplace(clip, data.id); if (r !== 'add') return; }
        if (data.ids && data.ids.length > 1) { let t = time, last; for (const id of data.ids) { last = Actions.addAssetAt(id, t, trackId, true); if (last) t = last.start + last.dur; } return; }
      // fall through
      case 'libsound': { const id = await SoundLib.toProject(data.id); return id && Actions.addAssetAt(id, time, trackId); }
      case 'sound': return Actions.addAssetAt(data.kind === 'sound' ? 'snd:' + data.id : data.id, time, trackId);
      case 'text': return Actions.addNew('text', { style: data.id }, time, trackId);
      case 'shape': return Actions.addNew('shape', { kind: data.id }, time, trackId);
      case 'color': return Actions.addNew('color', { color: data.id }, time, trackId);
      case 'pattern': return Actions.addNew('color', { pattern: data.pat || { padrao: data.id } }, time, trackId);
      case 'anim':
        if (!clip || ['audio', 'fx'].includes(clip.type)) return UI.toast('Solte a animação <b>em cima de um clipe</b> de imagem, texto ou vídeo.', { kind: 'warn' });
        App.select(clip.id); return Actions.addAnim(App.sel.size > 1 && App.sel.has(clip.id) ? App.selected() : [clip], data.id, time);
      case 'fx':
        if (clip && clip.type === 'fx') { const d = FX[data.id]; clip.sfx = { ...clip.sfx, type: data.id, params: defaultParams(d), sound: defaultSound(d) }; clip.name = d.name; return App.commit('Efeito trocado para ' + d.name, { toast: true }); }
        if (clip && clip.type !== 'audio') { App.select(clip.id); return Actions.addFx([clip], data.id, time); }
        if (FX[data.id].clipOnly) return UI.toast('Esse efeito é para um personagem/imagem: solte em cima do clipe.', { kind: 'warn' });
        return Actions.addScreenFx(data.id, time, tk?.type === 'fx' ? tk.id : null);
      case 'trans': {
        if (!clip || ['audio', 'fx'].includes(clip.type)) return UI.toast('Solte a transição em cima de um clipe.', { kind: 'warn' });
        const side = time > clip.start + clip.dur / 2 ? 'out' : 'in';
        App.select(clip.id); return Actions.setTrans([clip], side, data.id);
      }
      case 'preset': {
        const p = this.presets.find(p => p.id === data.id); if (!p) return;
        if (!clip) return UI.toast('Solte em cima de um clipe.', { kind: 'warn' });
        App.select(clip.id); return Actions.applyPreset(p, [clip], time);
      }
    }
  },
  async handleDropOnPreview(e) {
    const pt0 = App.toProject(e), under = App.hitTest(pt0.x, pt0.y);
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      const rts = await Actions.importFiles([...e.dataTransfer.files]);
      if (under && rts.length === 1 && Actions.canSwap(under, rts[0].meta.id)) { const r = await Actions.askReplace(under, rts[0].meta.id); if (r !== 'add') return; }
      let t = App.t; for (const rt of rts) { const c = Actions.addAssetAt(rt.meta.id, t, null, true); if (c && rt.meta.kind === 'audio') t = c.start + c.dur; }
      return;
    }
    let data; try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
    if (data.kind === 'asset' && under?.type === 'shape' && await Cena.dropOnShape(under, data.id)) return;
    if (data.kind === 'asset' && under && Actions.canSwap(under, data.id)) { const r = await Actions.askReplace(under, data.id); if (r !== 'add') return; }
    if (['anim', 'fx', 'trans', 'preset'].includes(data.kind)) {
      // aplica no objeto onde soltou (ou na seleção)
      const pt = App.toProject(e), hit = App.hitTest(pt.x, pt.y);
      if (hit) App.select(hit.id);
      return this.applyToSelection(data.kind, data.id);
    }
    return this.handleDrop(e, { trackId: null, time: App.t, clipId: null });
  },
};
