/* ===================== home.js — tela inicial (projetos e modelos) ===================== */
'use strict';

const Home = {
  q: '',
  async render() {
    const el = $('#home');
    const [projects, tpls, usage] = await Promise.all([DB.all('projects'), DB.all('templates'), this.usedBytes()]);
    projects.sort((a, b) => b.modified - a.modified);
    const shape = t => { const r = t.w / t.h, mw = 44, mh = 34; let w = mw, hh = mw / r; if (hh > mh) { hh = mh; w = mh * r; } return `<i style="width:${w}px;height:${hh}px"></i>`; };
    const quick = ['shorts', 'yt1080', 'ig11'].map(id => TEMPLATES.find(t => t.id === id)).filter(Boolean);
    const list = projects.filter(p => !this.q || p.name.toLowerCase().includes(this.q));
    const me = TurmaAuth.email || '', ini = (me[0] || '?').toUpperCase();
    el.innerHTML = `<div class="home">
      <div class="home-head"><div class="brand"><span class="logo logo-ep"><img src="icones/icone-192.png" alt=""></span><span><b>ANIMADOR</b> <i class="brand-mod">Estúdio Problems</i></span></div><span class="sp"></span>
        <label class="home-q">${ic('search', 14)}<input type="text" placeholder="Buscar projeto" data-a="q" value="${esc(this.q)}"></label>
        <button class="ibtn" data-a="tema" title="Tema e cores">${ic('palette', 16)}</button>
        <button class="btn ghost" data-a="open" title="Abrir um arquivo .toon (vídeo ou animação)">${ic('folder', 15)} Abrir .toon</button>
        <span data-estudio-conta></span></div>
      <div class="home-new">
        ${quick.map(t => `<button class="hn" data-t="${t.id}"><span class="hn-shape">${shape(t)}</span><span><b>${esc(t.name.split(' / ')[0])}</b><small>${t.w}×${t.h}</small></span></button>`).join('')}
        <button class="hn hn-more" data-a="more"><span class="hn-shape">${ic('plus', 18)}</span><span><b>Outro formato</b><small>${TEMPLATES.length + tpls.length} modelos</small></span></button>
      </div>
      <div class="home-sec">Projetos <small>${projects.length || ''}</small></div>
      <div class="proj-grid">${list.map(p => `<div class="pcard" data-p="${p.id}"><div class="pthumb" style="${p.thumb ? `background-image:url('${p.thumb}')` : ''}">${p.thumb ? '' : ic(p.kind === 'anim' ? 'layers' : 'film', 26)}</div>${p.kind === 'anim' ? `<span class="pkind" title="Animação com ossos">${ic('layers', 11)}</span>` : ''}
        <button class="ibtn pmenu" data-m="${p.id}" title="Opções">${ic('dots')}</button>
        <div class="pinfo"><b>${esc(p.name)}</b><small>${fmtDate(p.modified)}${p.dur ? ' · ' + fmtTime(p.dur || 0, 30, false) : ''}</small></div></div>`).join('') || `<div class="home-empty">${projects.length ? 'Nenhum projeto com esse nome.' : `Nenhum projeto ainda — escolha um formato acima ou arraste um <b>.toon</b> aqui.`}</div>`}</div>
    </div>`;
    // [Menu] [foto] vêm do componente padrão de todos os projetos (/estudio-conta.js); os itens do Animador estão em ESTUDIO_CONTA (index.html)
    $('[data-a=more]', el).onclick = () => this.formatsModal(tpls);
    $('[data-a=open]', el).onclick = () => this.openToon();
    $('[data-a=tema]', el).onclick = () => Tema.open();
    const qi = $('[data-a=q]', el); qi.oninput = debounce(() => { this.q = qi.value.toLowerCase(); this.render().then(() => { const n = $('[data-a=q]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); }, 200);
    $$('[data-t]', el).forEach(t => t.onclick = () => this.newProjectModal(TEMPLATES.find(x => x.id === t.dataset.t)));
    $$('[data-p]', el).forEach(c => c.onclick = e => { if (e.target.closest('[data-m]')) return; this.openProject(c.dataset.p); });
    $$('[data-m]', el).forEach(b => b.onclick = e => { e.stopPropagation(); const p = projects.find(x => x.id === b.dataset.m); UI.ctx(e.clientX, e.clientY, [
      { label: 'Abrir', icon: 'folder', action: () => this.openProject(p.id) },
      { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Renomear projeto', label: 'Nome', value: p.name }); if (n) { const d = JSON.parse(p.data); d.name = n; p.name = n; p.data = JSON.stringify(d); await DB.put('projects', p); this.render(); } } },
      { label: 'Duplicar', icon: 'dup', action: () => this.duplicate(p) },
      { label: 'Salvar arquivo .toon', icon: 'package', action: () => this.exportToon(p) },
      '-',
      { label: 'Excluir', icon: 'trash', danger: true, action: () => this.remove(p) },
    ]); });
    el.ondragover = e => e.preventDefault();
    el.ondrop = e => { e.preventDefault(); const f = [...e.dataTransfer.files].find(f => f.name.toLowerCase().endsWith('.toon')); if (f) this.openToon(f); };
  },
  // todos os formatos (modelos prontos + os seus + personalizado)
  async formatsModal(tpls) {
    const shape = t => { const r = t.w / t.h, mw = 64, mh = 44; let w = mw, hh = mw / r; if (hh > mh) { hh = mh; w = mh * r; } return `<i style="width:${w}px;height:${hh}px"></i>`; };
    const body = h(`<div class="fmt-grid">${TEMPLATES.map(t => `<button class="fmt" data-t="${t.id}"><span class="hn-shape">${shape(t)}</span><b>${esc(t.name)}</b><small>${t.sub}</small></button>`).join('')}
      ${tpls.map(t => `<button class="fmt" data-ct="${t.id}"><span class="ibtn xs fmt-del" data-del="${t.id}" title="Excluir modelo">${ic('x', 12)}</span><span class="hn-shape">${shape(t)}</span><b>${esc(t.name)}</b><small>${t.w}×${t.h} · ${t.fps}fps · seu</small></button>`).join('')}
      <button class="fmt" data-a="custom"><span class="hn-shape">${ic('plus', 18)}</span><b>Personalizado</b><small>tamanho e fps</small></button></div>`);
    const v = await UI.modal({ title: 'Novo projeto', icon: 'plus', width: 700, body, buttons: [], onOpen: a => {
      $$('[data-t]', body).forEach(b => b.onclick = () => a.close({ t: TEMPLATES.find(x => x.id === b.dataset.t) }));
      $$('[data-ct]', body).forEach(b => b.onclick = async e => { if (e.target.closest('[data-del]')) { const t = tpls.find(x => x.id === b.dataset.ct); if (await UI.confirm({ title: 'Excluir modelo?', msg: `O modelo "<b>${esc(t.name)}</b>" será apagado. Projetos feitos com ele não mudam.`, ok: 'Excluir', danger: true })) { await DB.del('templates', t.id); b.remove(); } return; } a.close({ t: tpls.find(x => x.id === b.dataset.ct) }); });
      $('[data-a=custom]', body).onclick = () => a.close({ t: null });
    } });
    if (v) this.newProjectModal(v.t || undefined);
  },
  async openProject(id) {
    const rec = await DB.get('projects', id); if (!rec) return UI.toast('Projeto não encontrado', { kind: 'err' });
    if (rec.kind === 'anim') { location.href = 'animar.html?p=' + encodeURIComponent(id); return; }
    await App.open(rec);
  },
  async newProjectModal(tpl) {
    tpl = tpl || TEMPLATES[0];
    const f = h(`<div><div class="chips" style="margin-bottom:12px">${TEMPLATES.map(t => `<span class="chip ${t.id === tpl.id ? 'on' : ''}" data-t="${t.id}">${t.name}</span>`).join('')}</div><div class="fgrid">
      <label class="field full">Nome do projeto<input type="text" data-k="name" value="Meu vídeo ${new Date().toLocaleDateString('pt-BR')}"></label>
      <label class="field">Largura (px)<input type="number" data-k="w" value="${tpl.w}"></label><label class="field">Altura (px)<input type="number" data-k="h" value="${tpl.h}"></label>
      <label class="field">Quadros por segundo<select data-k="fps">${[12, 15, 24, 25, 30, 50, 60].map(v => `<option ${v === tpl.fps ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field">Cor de fundo<input type="color" data-k="bg" value="${tpl.bg || '#000000'}" style="width:100%"></label>
      <small class="full" style="color:var(--tx3)">Dá para mudar tudo isso depois em Projeto → Configurações.</small>
    </div></div>`);
    $$('[data-t]', f).forEach(ch => ch.onclick = () => { const t = TEMPLATES.find(x => x.id === ch.dataset.t); $$('[data-t]', f).forEach(x => x.classList.toggle('on', x === ch)); $('[data-k=w]', f).value = t.w; $('[data-k=h]', f).value = t.h; $('[data-k=fps]', f).value = t.fps; });
    const o = await UI.modal({ title: 'Novo projeto', icon: 'plus', body: f, width: 520, enterValue: true, buttons: [{ label: 'Cancelar', value: null }, { label: 'Criar projeto', kind: 'primary', collect: () => Actions.readForm(f) }] });
    if (!o) return;
    if (App.project) await App.goHome();
    const p = App.newProject({ name: o.name, w: clamp(+o.w | 0, 16, 7680), h: clamp(+o.h | 0, 16, 7680), fps: +o.fps, bg: o.bg });
    await DB.put('projects', { id: p.id, name: p.name, created: p.created, modified: p.modified, settings: p.settings, dur: 0, data: JSON.stringify(p) });
    await App.open(p);
    Assistant.wizard();
  },
  async openToon(file) {
    if (!file) { const f = await pickFiles('.toon', false); if (!f.length) return; file = f[0]; }
    const b = UI.busy('Abrindo projeto…', `<div class="spinner"></div><p style="text-align:center">Lendo <b>${esc(file.name)}</b> e copiando as mídias para este computador…</p>`);
    try {
      const { project, presets, thumb, lastT } = await ToonFile.read(file);
      if (project.kind === 'anim') { // .toon do Estúdio de Animação → abre lá
        await DB.put('projects', { id: project.id, kind: 'anim', name: project.name, created: project.created || Date.now(), modified: Date.now(), settings: project.settings, dur: project.frames / project.settings.fps, thumb, data: JSON.stringify(project) });
        b.close(); location.href = 'animar.html?p=' + encodeURIComponent(project.id); return;
      }
      const existing = new Set((await DB.all('presets')).map(p => p.id));
      let np = 0; for (const p of presets || []) if (!existing.has(p.id)) { await DB.put('presets', p); np++; }
      const dur = Math.max(0, ...project.clips.map(c => c.start + c.dur));
      const rec = { id: project.id, name: project.name, created: project.created || Date.now(), modified: Date.now(), settings: project.settings, dur, thumb, lastT, data: JSON.stringify(project) };
      await DB.put('projects', rec);
      b.close();
      if (App.project) await App.goHome();
      await App.open(rec);
      UI.toast(`Projeto "<b>${esc(project.name)}</b>" aberto${np ? ` · ${np} efeito(s) salvo(s) adicionados à aba Salvos` : ''}`, { kind: 'ok', time: 5000 });
    } catch (e) { b.close(); UI.modal({ title: 'Não consegui abrir', icon: 'alert', kind: 'danger', body: `<p>${esc(e.message || e)}</p>`, buttons: [{ label: 'Ok', kind: 'primary' }] }); }
  },
  async duplicate(rec) {
    const p = JSON.parse(rec.data), newId = uid('p_'); let text = JSON.stringify(p);
    const assets = await DB.byIndex('assets', 'project', p.id);
    for (const a of assets) { const nid = uid('a_'); text = text.split(a.id).join(nid); await DB.put('assets', { ...a, id: nid, projectId: newId }); }
    const np = JSON.parse(text); np.id = newId; np.name = p.name + ' (cópia)'; np.created = np.modified = Date.now();
    await DB.put('projects', { ...rec, id: newId, name: np.name, created: np.created, modified: np.modified, data: JSON.stringify(np) });
    UI.toast('Projeto duplicado', { kind: 'ok' }); this.render();
  },
  async exportToon(rec) { await Actions.saveToon(JSON.parse(rec.data), await DB.all('presets'), { thumb: rec.thumb, lastT: rec.lastT }); },
  /* ---------- espaço usado no navegador ---------- */
  async usedBytes() {
    const [est, assets, projects] = await Promise.all([DB.usage(), DB.all('assets'), DB.all('projects')]);
    const sum = assets.reduce((s, a) => s + (a.size || a.blob?.size || 0), 0) + projects.reduce((s, p) => s + (p.data?.length || 0) + (p.thumb?.length || 0), 0);
    return { usage: Math.max(sum, est?.usage || 0), quota: est?.quota || 0 };
  },
  async storageModal() {
    if (App.project && App.dirty) await App.save(true);
    const [projects, assets, presets, tpls, usage] = await Promise.all([DB.all('projects'), DB.all('assets'), DB.all('presets'), DB.all('templates'), this.usedBytes()]);
    const sz = a => a.size || a.blob?.size || 0;
    const size = {}; assets.forEach(a => size[a.projectId] = (size[a.projectId] || 0) + sz(a));
    projects.sort((a, b) => (size[b.id] || 0) - (size[a.id] || 0));
    // por tipo
    const kinds = { image: ['Imagens', 0, 0, '#2a8a86'], gif: ['GIFs', 0, 0, '#c27a2c'], video: ['Vídeos', 0, 0, '#3f6fd6'], audio: ['Áudios e gravações', 0, 0, '#2c9a5a'] };
    assets.forEach(a => { const k = kinds[a.kind] || kinds.image; k[1] += sz(a); k[2]++; });
    const projBytes = projects.reduce((s, p) => s + (p.data?.length || 0) + (p.thumb?.length || 0), 0);
    // mídias que não estão em nenhum clipe (nem são capa)
    const usedIds = new Set(), projOf = {};
    projects.forEach(p => { try { const d = (App.project && App.project.id === p.id) ? App.project : JSON.parse(p.data); projOf[p.id] = d; ToonFile.usedAssetIds({ clips: d.clips, bin: [] }).forEach(id => usedIds.add(id)); if (d.cover) usedIds.add(d.cover); } catch { } });
    const LIB = a => String(a.projectId || '').startsWith('__lib');
    const orphan = assets.filter(a => !LIB(a) && !projects.some(p => p.id === a.projectId));
    const unused = assets.filter(a => !LIB(a) && !usedIds.has(a.id) && !orphan.includes(a));
    const used = usage.usage, quota = usage.quota, pct = quota ? used / quota * 100 : 0;
    const total = Object.values(kinds).reduce((s, k) => s + k[1], 0) + projBytes || 1;
    const bar = Object.values(kinds).map(k => k[1] ? `<i style="width:${k[1] / total * 100}%;background:${k[3]}" title="${k[0]}: ${fmtBytes(k[1])}"></i>` : '').join('') + (projBytes ? `<i style="width:${projBytes / total * 100}%;background:#8c4fd6" title="Projetos e capas: ${fmtBytes(projBytes)}"></i>` : '');
    const body = h(`<div>
      <div style="display:flex;gap:16px;align-items:center">
        <svg width="92" height="92" viewBox="0 0 36 36" style="flex:none"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--bg4)" stroke-width="4"/><circle cx="18" cy="18" r="15" fill="none" stroke="${pct > 85 ? 'var(--err)' : pct > 60 ? 'var(--warn)' : 'var(--cy)'}" stroke-width="4" stroke-linecap="round" pathLength="100" stroke-dasharray="${Math.max(pct > 0 ? 1.5 : 0, Math.min(100, pct)).toFixed(1)} 100" transform="rotate(-90 18 18)"/><text x="18" y="20.5" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor">${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%</text></svg>
        <div style="flex:1"><b style="font-size:22px;color:var(--tx);display:block">${fmtBytes(used)} usados</b>
          <span style="font-size:12.5px">${quota ? `de ${fmtBytes(quota)} que o navegador libera · <b style="color:var(--ok)">${fmtBytes(Math.max(0, quota - used))} livres</b>` : 'O navegador não informou o limite.'}</span>
          <div class="stack-bar">${bar}</div>
          <div class="stack-leg">${Object.values(kinds).filter(k => k[2]).map(k => `<span><i style="background:${k[3]}"></i>${k[0]}: ${fmtBytes(k[1])} (${k[2]})</span>`).join('')}${projBytes ? `<span><i style="background:#8c4fd6"></i>Projetos: ${fmtBytes(projBytes)}</span>` : ''}</div></div>
      </div>
      <p style="font-size:12px;margin:12px 0 0">Tudo do editor fica <b>dentro do navegador</b> deste computador. Se ficar pesado, salve os projetos importantes como <b>.toon</b> e limpe.</p>
      <div class="lgroup">Limpeza rápida</div>
      <div class="clean-list">
        <div class="clean-row"><div><b>Mídias que não estão em nenhum clipe</b><small>${unused.length} arquivo(s) importados mas não usados na linha do tempo · ${fmtBytes(unused.reduce((s, a) => s + sz(a), 0))}</small></div><button class="btn sm" data-c="unused" ${unused.length ? '' : 'disabled'}>Limpar</button></div>
        ${orphan.length ? `<div class="clean-row"><div><b>Restos de projetos apagados</b><small>${orphan.length} arquivo(s) sem projeto · ${fmtBytes(orphan.reduce((s, a) => s + sz(a), 0))}</small></div><button class="btn sm" data-c="orphan">Limpar</button></div>` : ''}
        <div class="clean-row"><div><b>Efeitos salvos</b><small>${presets.length} predefinição(ões) da aba Salvos</small></div><button class="btn sm" data-c="presets" ${presets.length ? '' : 'disabled'}>Apagar</button></div>
        <div class="clean-row"><div><b>Modelos personalizados</b><small>${tpls.length} modelo(s) da tela inicial</small></div><button class="btn sm" data-c="tpls" ${tpls.length ? '' : 'disabled'}>Apagar</button></div>
      </div>
      <div class="lgroup">Projetos (${projects.length}) — do maior para o menor</div>
      <div data-list style="max-height:30vh;overflow:auto;display:flex;flex-direction:column;gap:6px"></div>
    </div>`);
    const list = $('[data-list]', body);
    if (!projects.length) list.appendChild(h('<div class="empty" style="padding:16px">Nenhum projeto salvo.</div>'));
    projects.forEach(p => {
      const d = projOf[p.id], nAs = assets.filter(a => a.projectId === p.id).length, open = App.project && App.project.id === p.id;
      const row = h(`<div class="clean-row">${p.thumb ? `<img src="${p.thumb}" style="width:54px;height:32px;object-fit:cover;border-radius:4px;background:#000;flex:none">` : ''}<div style="flex:1;min-width:0"><b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}${open ? ' <span class="chip static" style="font-size:10px;padding:0 6px">aberto</span>' : ''}</b><small>${fmtBytes((size[p.id] || 0) + (p.data?.length || 0))} · ${nAs} mídia(s) · ${d?.clips?.length || 0} clipe(s) · ${fmtDate(p.modified)}</small></div><button class="btn sm" data-t title="Salvar este projeto como .toon">${ic('package', 12)} .toon</button><button class="ibtn xs" data-d title="Excluir este projeto" ${open ? 'disabled' : ''}>${ic('trash', 13)}</button></div>`);
      $('[data-t]', row).onclick = () => this.exportToon(p);
      $('[data-d]', row).onclick = async () => { await this.remove(p); refresh(); };
      list.appendChild(row);
    });
    let api;
    const refresh = () => { api && api.close(); App.updateStorage && App.updateStorage(); setTimeout(() => this.storageModal(), 200); };
    const clean = async (kind) => {
      const cfg = {
        unused: [`Apagar ${unused.length} mídia(s) que não estão em nenhum clipe?`, 'Elas somem da aba Mídia dos projetos. Clipes e capas não são afetados.', unused],
        orphan: [`Apagar ${orphan.length} arquivo(s) sem projeto?`, 'São restos de projetos que já foram excluídos.', orphan],
        presets: [`Apagar ${presets.length} efeito(s) salvo(s)?`, 'Clipes que já usam esses efeitos continuam iguais.', null],
        tpls: [`Apagar ${tpls.length} modelo(s) personalizado(s)?`, 'Projetos feitos com eles não mudam.', null],
      }[kind];
      if (!await UI.confirm({ title: cfg[0], msg: cfg[1], ok: 'Apagar', danger: true })) return;
      if (cfg[2]) {
        for (const a of cfg[2]) {
          await DB.del('assets', a.id);
          if (App.project && a.projectId === App.project.id) { const rt = Assets.get(a.id); if (rt) { URL.revokeObjectURL(rt.url); Assets.map.delete(a.id); } App.project.bin = App.project.bin.filter(x => x !== a.id); if (App.project.assetFolders) delete App.project.assetFolders[a.id]; }
        }
        if (App.project) { App.commit('Mídias não usadas apagadas', { all: true }); await App.save(true); }
      }
      if (kind === 'presets') { for (const x of presets) await DB.del('presets', x.id); LibUI.presets = []; if (App.project) LibUI.render(); }
      if (kind === 'tpls') for (const x of tpls) await DB.del('templates', x.id);
      UI.toast('Limpeza feita', { kind: 'ok' }); refresh();
    };
    $$('[data-c]', body).forEach(b => b.onclick = () => clean(b.dataset.c));
    UI.modal({ title: 'Espaço usado no navegador', icon: 'package', width: 600, body, onOpen: a => api = a, buttons: [
      { label: 'Limpar tudo…', kind: 'danger', icon: 'trash', left: true, onClick: async a => { a.close(); await this.clearAll(projects, presets); return false; } },
      { label: 'Salvar todos como .toon', icon: 'package', onClick: async () => { for (const p of projects) await this.exportToon(p); return false; } },
      { label: 'Fechar', kind: 'primary' },
    ] });
  },
  async clearAll(projects, presets) {
    const ok1 = await UI.modal({ title: 'Limpar tudo do navegador?', icon: 'alert', kind: 'danger', width: 500, body: `<p>Isso apaga <b>todos os ${projects.length} projetos</b> e todas as mídias guardadas neste navegador.</p><p><b>Antes de limpar</b>, salve como <b>.toon</b> os projetos que você quer guardar — depois é só abrir o .toon de novo.</p>`, cancelValue: false, buttons: [
      { label: 'Salvar todos como .toon antes', icon: 'package', left: true, onClick: async () => { for (const p of projects) await this.exportToon(p); return false; } },
      { label: 'Cancelar', value: false }, { label: 'Continuar', kind: 'danger', value: true }] });
    if (!ok1) return;
    const f = h(`<div><p>Última confirmação: <b>não dá para desfazer</b>. Projetos que não foram salvos como .toon serão perdidos.</p><label class="switch" style="margin-top:6px"><input type="checkbox" data-keep checked><i></i>Manter meus efeitos salvos e modelos (${presets.length} efeito(s))</label></div>`);
    const ok2 = await UI.modal({ title: 'Tem certeza mesmo?', icon: 'trash', kind: 'danger', body: f, cancelValue: null, buttons: [{ label: 'Não, voltar', value: null }, { label: 'Sim, apagar tudo', kind: 'danger', collect: () => ({ keep: $('[data-keep]', f).checked }) }] });
    if (!ok2) return;
    const b = UI.busy('Limpando…', '<div class="spinner"></div><p style="text-align:center">Apagando projetos e mídias do navegador…</p>');
    try {
      if (App.project) await App.goHome(true);
      for (const a of await DB.all('assets')) await DB.del('assets', a.id);
      for (const p of await DB.all('projects')) await DB.del('projects', p.id);
      if (!ok2.keep) { for (const p of await DB.all('presets')) await DB.del('presets', p.id); for (const t of await DB.all('templates')) await DB.del('templates', t.id); LibUI.presets = []; }
      localStorage.removeItem('ps-last');
    } finally { b.close(); }
    const u = await this.usedBytes();
    UI.modal({ title: 'Pronto, tudo limpo', icon: 'check', kind: 'ok', body: `<p>O navegador agora usa <b>${fmtBytes(u.usage)}</b> com o editor.</p>`, buttons: [{ label: 'Ok', kind: 'primary' }] });
    if (App.project) App.updateStorage(); else this.render();
  },
  async remove(rec) {
    if (!await UI.confirm({ title: 'Excluir projeto?', msg: `"<b>${esc(rec.name)}</b>" e todas as mídias dele serão apagados <b>deste computador</b>. Isso não dá para desfazer.<br><br>Dica: antes, salve um arquivo .toon se quiser guardar uma cópia.`, ok: 'Excluir para sempre', danger: true })) return;
    const ids = await DB.keysByIndex('assets', 'project', rec.id);
    for (const id of ids) await DB.del('assets', id);
    await DB.del('projects', rec.id);
    UI.toast('Projeto excluído', { kind: 'ok' }); this.render();
  },
};

// SEGURANÇA: o editor só inicia depois do login com Google confirmado pelo servidor (TurmaAuth.gate). Não remova — veja SEGURANCA.md.
async function turmaBoot() {
  const email = await TurmaAuth.gate(); if (!email || !TurmaAuth.passed) return;
  App.init();
  await DB.open();
  Home.render();
  // aberto pelo Estúdio de Animação ("Levar para o editor") ou por link: index.html?p=ID
  const pid = new URLSearchParams(location.search).get('p');
  const t0 = parseFloat(new URLSearchParams(location.search).get('t'));
  if (pid) { history.replaceState(null, '', 'index.html'); Promise.resolve(Home.openProject(pid)).then(() => { if (isFinite(t0)) App.seek(t0); }); }
  // fontes usadas nos textos
  FONTS.slice(0, 8).forEach(f => document.fonts.load(`40px "${f}"`).catch(() => { }));
}
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', turmaBoot); else turmaBoot();
