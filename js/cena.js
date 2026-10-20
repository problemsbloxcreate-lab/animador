/* ===================== cena.js — o programa é de ANIMAÇÃO; a edição é o extra =====================
   Modos (chave no topo):
     🎨 Animação (padrão): canvas infinito + moldura da câmera, linha do tempo de animação, painel "Cena" (hierarquia).
     📺 Cena final: o que o público vê (só a câmera) + linha do tempo de edição (o "editor antigo").
     🔍 Só o personagem: abre o personagem selecionado sozinho (rig e precisão) — tela cheia.
   Painel "Cena": câmera, personagens, objetos e fundos (de cima p/ baixo = da frente p/ trás), grupos (prender juntos),
   mostrar/esconder, subir/descer, tamanho. Botão ✨ da IA na seleção. */
'use strict';
const Cena = {
  mode: (() => { try { return localStorage.getItem('ep-modo') || 'anim'; } catch { return 'anim'; } })(),
  multi: new Set(),
  init() {
    const em = $('#ep-modo'); if (!em) return;
    em.innerHTML = `<button data-m="anim" title="Animar: canvas infinito com a câmera (o principal)">🎨 Animação</button><button data-m="final" title="O que o público vai ver + linha do tempo de edição">📺 Cena final</button>`;
    $$('button', em).forEach(b => b.onclick = () => b.dataset.m === 'rig' ? RigEdit.openAny() : this.setMode(b.dataset.m));
    this.aiBtn();
  },
  setMode(m, quiet) {
    this.mode = m; try { localStorage.setItem('ep-modo', m); } catch { }
    $$('#ep-modo button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    document.body.classList.toggle('modo-anim', m === 'anim'); document.body.classList.toggle('modo-final', m === 'final');
    if (!App.project) return;
    if (!!App.outside !== (m === 'anim')) App.setOutside(m === 'anim');
    if (typeof EdAnimTL !== 'undefined') EdAnimTL.set(m === 'anim');
    if (m === 'final' && App.camTool) App.setPvModo('mover');
    if (m === 'anim' && LibUI.tab !== 'cena' && !quiet) LibUI.setTab('cena');
    App.requestRender();
  },
  // abrir uma coisa específica na animação (vindo da cena final)
  focus(c) { if (!c) return; App.select(c.id); if (App.t < c.start || App.t >= c.start + c.dur) App.seek(c.start); this.setMode('anim'); },

  /* ---------- painel "Cena" (hierarquia) ---------- */
  KIND: c => c.type === 'shape' && c.shape?.livre ? (c.shape.grupo ? ['📎', 'Grupo'] : ['❔', 'Item livre']) : c.type === 'anim' ? ['🧍', 'Personagem'] : c.type === 'image' || c.type === 'gif' ? ['🖼️', 'Imagem'] : c.type === 'video' ? ['🎞️', 'Vídeo'] : c.type === 'text' ? ['🔤', 'Texto'] : c.type === 'shape' ? (c.shape?.fillAsset ? ['🖼️', 'Forma com imagem'] : ['⬛', 'Forma']) : c.type === 'color' ? ['🎨', 'Fundo'] : ['•', c.type],
  render(b) {
    const P = App.project, vis = P.tracks.filter(t => t.type === 'visual'), sel = new Set(App.sel), t = App.t;
    const top = h(`<div class="cn-top">
      <div class="cn-add"><button class="btn sm" data-a="char" title="Personagem com ossos">🧍 Personagem</button><button class="btn sm" data-a="rect" title="Retângulo (fundo ou espaço para imagem)">⬛ Retângulo</button><button class="btn sm" data-a="circle">⚪ Círculo</button><button class="btn sm" data-a="tri">🔺 Triângulo</button><button class="btn sm" data-a="text">🔤 Texto</button><button class="btn sm" data-a="img">🖼️ Imagem</button></div>
      <div class="cn-tools"><button class="btn sm" data-a="group" title="Prender os selecionados juntos (movem juntos)" ${sel.size > 1 ? '' : 'disabled'}>📎 Prender juntos</button><button class="btn sm" data-a="ungroup" title="Soltar do grupo" ${[...sel].some(id => App.clip(id)?.parent) ? '' : 'disabled'}>✂️ Soltar</button><button class="btn sm" data-a="free" title="Item livre: um espaço vazio que você define depois o que é">➕ Item livre</button><button class="btn sm" data-a="draw" title="Desenhar um personagem ou objeto novo, com camadas">✏️ Desenhar novo</button></div></div>`);
    b.appendChild(top);
    $('[data-a=char]', top).onclick = () => RigEdit.addRigModal();
    $('[data-a=rect]', top).onclick = () => this.addShape('rect'); $('[data-a=circle]', top).onclick = () => this.addShape('circle'); $('[data-a=tri]', top).onclick = () => this.addShape('triangle');
    $('[data-a=text]', top).onclick = () => Actions.addNew('text', { style: 'title' });
    $('[data-a=img]', top).onclick = () => Actions.importDialog();
    $('[data-a=group]', top).onclick = () => this.group([...sel]); $('[data-a=ungroup]', top).onclick = () => { for (const id of sel) { const c = App.clip(id); if (c) delete c.parent; } App.commit('Soltou do grupo'); };
    $('[data-a=free]', top).onclick = () => this.addFree(); $('[data-a=draw]', top).onclick = () => this.drawNew();
    const list = h('<div class="cn-list"></div>'); b.appendChild(list);
    // câmera
    const cam = h(`<div class="cn-row cn-cam ${App.camTool || (App.camSel && !sel.size) ? 'on' : ''}" title="Clique = configurar a câmera · duplo clique = mexer nela na prévia"><span class="cn-i">🎥</span><b>Câmera</b><small class="cn-sz">${P.settings.w}×${P.settings.h}</small><span class="sp"></span><small>${Object.keys(P.camera?.keys || {}).length ? 'animada' : 'parada'}</small></div>`);
    cam.onclick = () => { App.sel.clear(); App.camSel = true; App.refresh(); }; cam.ondblclick = () => App.setPvModo('camera'); list.appendChild(cam);
    const kids = id => P.clips.filter(k => k.parent === id && !['audio', 'fx'].includes(k.type));
    const row = (c, lv) => {
      const [ico, kind] = this.KIND(c), act = t >= c.start && t < c.start + c.dur, on = sel.has(c.id), rigC = c.type === 'anim' && RigEdit.rig(c), hasK = kids(c.id).length || rigC?.nodes?.length, shut = this.closed.has(c.id);
      const r = h(`<div class="cn-row ${on ? 'on' : ''} ${act ? '' : 'off'}" style="padding-left:${2 + lv * 14}px" draggable="true" title="${esc(kind)} · ${fmtTime(c.start, App.fps, false)}–${fmtTime(c.start + c.dur, App.fps, false)} · arraste para mudar de lugar (no meio = prender)">
        <button class="cn-tw" data-tw title="${shut ? 'Abrir' : 'Fechar'}" ${hasK ? '' : 'style="visibility:hidden"'}>${shut ? '▸' : '▾'}</button><button class="cn-eye" data-v title="Mostrar/esconder">${c.hidden ? '🙈' : '👁'}</button><span class="cn-i">${ico}</span><span class="cn-n">${esc(c.name || kind)}</span><span class="sp"></span>
        ${c.type === 'anim' ? '<button class="cn-b" data-an title="Animar este personagem">🎨</button>' : ''}</div>`);
      $('[data-tw]', r).onclick = () => { if (shut) this.closed.delete(c.id); else this.closed.add(c.id); this.saveClosed(); LibUI.render(); };
      r.onclick = e => { if (e.target.closest('button')) return; if (e.ctrlKey || e.metaKey || e.shiftKey) App.toggleSel(c.id); else { App.select(c.id); if (!act) App.seek(c.start); } };
      r.ondblclick = async () => { const nm = await UI.prompt({ title: 'Nome do item', label: 'Nome', value: c.name || '' }); if (nm != null && nm !== c.name) { c.name = nm; App.commit('Nome'); } };
      $('[data-v]', r).onclick = () => { c.hidden = !c.hidden; App.commit(c.hidden ? 'Escondeu' : 'Mostrou'); };
      $('[data-an]', r)?.addEventListener('click', () => this.focus(c));
      r.oncontextmenu = e => { e.preventDefault(); if (!sel.has(c.id)) App.select(c.id); Timeline.clipMenu(e, c); };
      // arrastar uma linha para cima de outra = prender nela
      r.ondragstart = e => { e.dataTransfer.setData('text/cena', c.id); };
      const zone = e => { const b = r.getBoundingClientRect(), y = (e.clientY - b.top) / b.height; return y < .3 ? 'top' : y > .7 ? 'bot' : 'mid'; };
      r.ondragover = e => { if (e.dataTransfer.types.includes('text/cena')) { e.preventDefault(); const z = zone(e); r.classList.toggle('drop', z === 'mid'); r.classList.toggle('drop-top', z === 'top'); r.classList.toggle('drop-bot', z === 'bot'); } };
      r.ondragleave = () => r.classList.remove('drop', 'drop-top', 'drop-bot');
      r.ondrop = e => { e.preventDefault(); const z = zone(e); r.classList.remove('drop', 'drop-top', 'drop-bot'); const id = e.dataTransfer.getData('text/cena'); if (z !== 'mid' && id && id !== c.id) return this.placeNear(App.clip(id), c, z === 'top' ? -1 : 1); if (id && id !== c.id) { const k = App.clip(id); let p = c; while (p) { if (p.id === id) return UI.toast('Não dá para prender no próprio filho', { kind: 'warn' }); p = p.parent && App.clip(p.parent); } k.parent = c.id; App.commit(`Prendeu em ${c.name || 'item'}`); } };
      list.appendChild(r);
      // personagem: as camadas (partes) dele aparecem dentro, para escolher onde mexer/desenhar
      if (shut) return;
      if (c.type === 'anim') { const rig = RigEdit.rig(c); if (rig) for (const [n, l2] of Rig.ordered(rig)) {
        let hidden = false; for (let p = Rig.node(rig, n.parent); p; p = Rig.node(rig, p.parent)) if (this.closed.has(c.id + ':' + p.id)) hidden = true; if (hidden) continue;
        const hasP = rig.nodes.some(x => x.parent === n.id), pshut = this.closed.has(c.id + ':' + n.id);
        const pr = h(`<div class="cn-row cn-part ${RigEdit.selNode === n.id && on ? 'on' : ''}" style="padding-left:${16 + (lv + l2) * 14}px" draggable="true"><button class="cn-tw" data-tw ${hasP ? '' : 'style="visibility:hidden"'}>${pshut ? '▸' : '▾'}</button><button class="cn-eye" data-v title="Mostrar/esconder a parte">${n.hidden ? '🙈' : '👁'}</button><span class="cn-i">${n.drawings.length > 1 ? '🔁' : '🦴'}</span><span class="cn-n">${esc(n.name)}</span><span class="sp"></span><small>${n.drawings.length > 1 ? n.drawings.length + ' des.' : ''}</small></div>`);
        pr.onclick = e => { if (e.target.closest('button')) return; if (!sel.has(c.id)) App.select(c.id); RigEdit.selNode = n.id; App.requestRender(); Props.tab = 'rig'; Props.render(); LibUI.render(); };
        pr.ondblclick = () => this.editPart(c, n);
        pr.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [{ head: n.name }, { label: '✏️ Editar o desenho (varinha, correção, camadas…)', action: () => this.editPart(c, n) }, ...n.drawings.map((d, i) => ({ label: '✏️ Editar: ' + RigEdit.dname(d, i), action: () => this.editPart(c, n, i) })), '-', { label: n.hidden ? '👁 Mostrar' : '🙈 Esconder', action: () => { n.hidden = !n.hidden; RigEdit.touch(c); App.commit('Parte'); } }]); };
        $('[data-v]', pr).onclick = () => { n.hidden = !n.hidden; RigEdit.touch(c); App.commit(n.hidden ? 'Parte escondida' : 'Parte visível'); };
        $('[data-tw]', pr).onclick = () => { const k = c.id + ':' + n.id; if (pshut) this.closed.delete(k); else this.closed.add(k); this.saveClosed(); LibUI.render(); };
        // arrastar parte em cima/embaixo de outra parte (mesmo "pai") = muda a ordem (frente/trás)
        pr.ondragstart = e => { e.stopPropagation(); e.dataTransfer.setData('text/parte', c.id + ':' + n.id); };
        pr.ondragover = e => { if (e.dataTransfer.types.includes('text/parte')) { e.preventDefault(); const b = pr.getBoundingClientRect(), top = e.clientY < b.top + b.height / 2; pr.classList.toggle('drop-top', top); pr.classList.toggle('drop-bot', !top); } };
        pr.ondragleave = () => pr.classList.remove('drop-top', 'drop-bot');
        pr.ondrop = e => { e.preventDefault(); const top = pr.classList.contains('drop-top'); pr.classList.remove('drop-top', 'drop-bot'); const [cid, nid] = (e.dataTransfer.getData('text/parte') || '').split(':'); if (cid !== c.id || nid === n.id) return; const m = Rig.node(rig, nid); if (!m) return; if (m.parent !== n.parent) return UI.toast('Só dá para trocar a ordem entre partes do mesmo lugar (mesmo "pai")', { kind: 'warn' });
          const sib = Rig.children(rig, n.parent).filter(x => x !== m).sort((a, b) => b.z - a.z), i = sib.indexOf(n); sib.splice(top ? i : i + 1, 0, m); sib.forEach((x, j) => x.z = sib.length - j); RigEdit.touch(c); App.commit('Ordem das partes'); };
        list.appendChild(pr);
      } }
      for (const k of kids(c.id)) row(k, lv + 1);
    };
    // ordem: faixas de cima (frente) para baixo; dentro da faixa pelo tempo
    for (const tk of vis) for (const c of P.clips.filter(x => x.trackId === tk.id && !x.parent).sort((a, z) => a.start - z.start)) row(c, 0);
    if (!P.clips.some(c => vis.some(t => t.id === c.trackId))) list.appendChild(h('<div class="empty">A cena está vazia: adicione um personagem, uma forma ou uma imagem acima.</div>'));
    const bgr = h(`<div class="cn-row cn-bg"><span class="cn-i">⬜</span><b>Fundo da câmera</b><span class="sp"></span><i class="cn-sw" style="background:${P.settings.bg || '#ffffff'}"></i></div>`); bgr.onclick = () => this.bgColor(); list.appendChild(bgr);
  },
  bgColor() { const i = document.createElement('input'); i.type = 'color'; i.value = App.project.settings.bg || '#ffffff'; i.oninput = () => { App.project.settings.bg = i.value; App.requestRender(); }; i.onchange = () => App.commit('Cor do fundo'); i.click(); },
  // ITEM LIVRE: um espaço vazio na cena (aparece tracejado só na prévia); depois você diz o que ele é
  // ✏️ desenhar do zero com camadas → salvar como imagem ou montar personagem (cada camada = base/reação/peça)
  async drawNew() {
    const S = App.project.settings, body = h(`<div class="ie-csz"><p>Desenhe com camadas (uma para o corpo, outra para cada braço, bocas, olhos…). Depois, com o <b>botão direito na camada</b>, diga o que ela é e use <b>🦴 Usar as camadas no personagem</b>.</p><div class="ie-grid"><button class="btn" data-s="1000x1000">Quadrado 1000×1000</button><button class="btn" data-s="800x1200">Em pé 800×1200</button><button class="btn" data-s="${S.w}x${S.h}">Tamanho do vídeo ${S.w}×${S.h}</button><button class="btn" data-s="512x512">Pequeno 512×512</button></div><label class="ck"><input type="checkbox" data-wh> fundo branco (desmarcado = transparente)</label></div>`);
    let pick = '1000x1000'; $$('[data-s]', body).forEach(b => b.onclick = () => { pick = b.dataset.s; $$('[data-s]', body).forEach(x => x.classList.toggle('primary', x === b)); }); $('[data-s]', body).classList.add('primary');
    const ok = await UI.modal({ title: '✏️ Desenhar novo', icon: 'image', width: 520, body, buttons: [{ label: 'Cancelar', value: false }, { label: 'Começar a desenhar', kind: 'primary', value: true }] }); if (!ok) return;
    const [w, hh] = pick.split('x').map(Number), white = $('[data-wh]', body).checked;
    const mk = (id, name) => { Actions.addNew('shape', { kind: 'rect', quiet: true }); const c = App.selected()[0]; if (!c) return null; c.dur = 5; delete c.shape; c.type = 'image'; c.assetId = id; c.name = name; return c; };
    ImgEdit.open({ blank: { w, h: hh, white }, name: 'Desenho novo',
      onSave: id => { mk(id, 'Desenho novo'); App.commit('Desenho novo na cena', { toast: true }); this.render?.(); },
      onLayers: async (items, flat) => { const c = mk(flat, 'Personagem novo'); if (c) await RigEdit.fromLayers(c, items); } });
  },
  addFree() { Actions.addNew('shape', { kind: 'rect' }); const c = App.selected()[0]; if (!c) return; c.dur = 5; c.shape.livre = true; c.shape.fillOn = false; c.shape.strokeW = 0; c.shape.w = 500; c.shape.h = 500; c.name = 'Item livre'; App.commit('Item livre na cena'); },
  freePanel(c) {
    const w = h(`<div class="sec fr-p"><div class="sec-h">❔ O que é este item?</div><div class="fr-g">
      <button class="btn sm" data-k="rect">⬛ Retângulo</button><button class="btn sm" data-k="circle">⚪ Círculo</button><button class="btn sm" data-k="triangle">🔺 Triângulo</button>
      <button class="btn sm" data-k="img">🖼️ Imagem</button><button class="btn sm" data-k="char">🧍 Personagem</button><button class="btn sm" data-k="text">🔤 Texto</button>
      <button class="btn sm" data-k="group">📎 Grupo (prende coisas)</button></div><small>Fica invisível no vídeo até você escolher. Arraste outros itens para dentro dele no painel Cena para prender.</small></div>`);
    const shape = k => { c.shape.livre = false; c.shape.kind = k; c.shape.fillOn = true; c.shape.fill = '#cfe9ff'; c.name = { rect: 'Retângulo', circle: 'Círculo', triangle: 'Triângulo' }[k]; App.commit('Item virou ' + c.name); };
    for (const k of ['rect', 'circle', 'triangle']) $(`[data-k=${k}]`, w).onclick = () => shape(k);
    const img = async (asChar) => { const f = await pickFiles('image/*', false); if (!f[0]) return; const rt = await Assets.addBlob(f[0], f[0].name, App.project.id, 'image'); App.project.bin.push(rt.meta.id); await new Promise(r => setTimeout(r, 300)); delete c.shape; c.type = 'image'; c.assetId = rt.meta.id; c.name = f[0].name.replace(/\.[^.]+$/, ''); App.commit('Item virou imagem'); if (asChar) await RigEdit.fromImage(c); };
    $('[data-k=img]', w).onclick = () => img(false); $('[data-k=char]', w).onclick = () => img(true);
    $('[data-k=text]', w).onclick = () => { const st = TEXT_STYLES.title; delete c.shape; c.type = 'text'; c.text = { text: 'Texto', font: st.font, size: st.size, color: st.color, stroke: st.stroke, strokeW: st.strokeW, shadow: st.shadow, bold: !!st.bold, italic: false, align: 'center', lineH: 1.1 }; c.name = 'Texto'; App.commit('Item virou texto'); };
    $('[data-k=group]', w).onclick = () => { c.name = 'Grupo'; c.shape.grupo = true; App.commit('Item virou grupo'); };
    return w;
  },
  // abre o editor de imagem (varinha, correção, camadas…) num desenho de uma parte do personagem
  editPart(c, n, di) { const d = n.drawings[di ?? Math.round(Rig.ch(RigEdit.rig(c), n.id, 'd', RigEdit.frame(c), n.d || 0))] || n.drawings.find(x => x.asset); if (!d?.asset) return UI.toast('Esse desenho está vazio — desenhe nele com ✏️ Desenhar', { kind: 'warn', time: 3000 }); RigEdit.editDrawing(c, n, d); },
  addShape(kind) { Actions.addNew('shape', { kind }); const c = App.selected()[0]; if (!c) return; c.dur = 5; c.shape.fill = kind === 'rect' ? '#cfe9ff' : kind === 'circle' ? '#ffd6e7' : '#fff1b8'; c.shape.strokeW = 0; c.name = { rect: 'Retângulo', circle: 'Círculo', triangle: 'Triângulo' }[kind]; App.commit(c.name + ' na cena'); },
  group(ids) {
    const cs = ids.map(id => App.clip(id)).filter(Boolean); if (cs.length < 2) return;
    const head = cs.find(c => c.type === 'shape' || c.type === 'color') || cs[0];
    for (const c of cs) if (c !== head) c.parent = head.id;
    App.commit(`Prendeu ${cs.length - 1} item(ns) em "${head.name || 'item'}"`, { toast: true });
  },
  closed: (() => { try { return new Set(JSON.parse(localStorage.getItem('cn-closed') || '[]')); } catch { return new Set(); } })(),
  saveClosed() { try { localStorage.setItem('cn-closed', JSON.stringify([...this.closed].slice(-300))); } catch { } },
  // arrastou um item para cima (frente) ou para baixo (trás) de outro
  placeNear(k, c, dir) {
    if (!k || !c) return; const P = App.project, vis = P.tracks.filter(t => t.type === 'visual'), i = vis.findIndex(t => t.id === c.trackId), tgt = vis[i + dir];
    k.parent = c.parent || null;
    if (k.trackId === c.trackId && !tgt) { /* nada */ }
    if (tgt && tgt.id !== k.trackId && Actions.free(tgt.id, k.start, k.start + k.dur, k)) k.trackId = tgt.id;
    else if (!(tgt && tgt.id === k.trackId)) { const ti = P.tracks.indexOf(P.tracks.find(t => t.id === c.trackId)); const nt = Actions.addTrack('visual', dir < 0 ? ti : ti + 1, true); k.trackId = nt.id; }
    App.commit(`${k.name || 'Item'} ${dir < 0 ? 'na frente de' : 'atrás de'} ${c.name || 'item'}`);
  },
  moveLayer(c, dir) {
    const P = App.project, vis = P.tracks.filter(t => t.type === 'visual'), i = vis.findIndex(t => t.id === c.trackId), tgt = vis[i + dir];
    if (tgt && Actions.free(tgt.id, c.start, c.start + c.dur, c)) c.trackId = tgt.id;
    else { const ti = P.tracks.indexOf(P.tracks.find(t => t.id === c.trackId)); const nt = Actions.addTrack('visual', dir < 0 ? ti : ti + 1, true); c.trackId = nt.id; }
    for (const k of P.clips.filter(x => x.parent === c.id)) { /* filhos ficam onde estão (prendem pelo movimento) */ }
    App.commit(dir < 0 ? 'Para a frente' : 'Para trás');
  },

  /* ---------- imagem dentro de forma (máscara) ---------- */
  async dropOnShape(shape, assetId) {
    const m = Assets.meta(assetId); if (!m || !['image', 'gif'].includes(m.kind)) return false;
    const r = await UI.modal({ title: 'Imagem na forma', icon: 'image', body: `<p>Soltou <b>${esc(m.name)}</b> em cima de <b>${esc(shape.name || 'forma')}</b>.</p>`, buttons: [{ label: '➕ Por cima', value: 'add' }, { label: '🔁 Substituir a forma', value: 'swap' }, { label: '📥 Colocar dentro', kind: 'primary', value: 'in' }] });
    if (!r || r === 'add') return r === 'add' ? false : true;
    if (r === 'in') { shape.shape.fillAsset = assetId; shape.shape.fillFit = shape.shape.fillFit || 'cover'; App.commit('Imagem dentro da forma'); }
    else { shape.type = 'image'; shape.assetId = assetId; delete shape.shape; App.commit('Forma trocada pela imagem'); }
    return true;
  },

  /* ---------- ✨ IA na seleção ---------- */
  aiBtn() {
    if ($('#cn-ai')) return;
    const b = h(`<div class="cn-ai" id="cn-ai"><button class="cn-ai-o" title="Pedir para a IA mexer no que está selecionado">${ic('sparkles', 15)}</button>
      <div class="cn-ai-box"><div class="cn-ai-h"><span class="cn-ai-lg">${ic('sparkles', 13)}</span><b>Assistente</b><span class="cn-ai-chip"></span><span class="sp"></span><button class="cn-ai-x" title="Fechar (Esc)">✕</button></div>
        <div class="cn-ai-sug"></div>
        <div class="cn-ai-in"><textarea rows="2" placeholder="O que fazer com isto? (ex.: deixa mais perto da câmera)"></textarea><button class="cn-ai-go" title="Enviar (Enter)">›</button></div>
        <small class="cn-ai-f">Enter envia · Shift+Enter pula linha</small></div></div>`);
    $('#pv-stage').parentElement.appendChild(b);
    const ta = $('textarea', b), close = () => b.classList.remove('open');
    const go = () => { const v = ta.value.trim(); if (!v) return ta.focus(); this.askAI(v); ta.value = ''; close(); };
    $('.cn-ai-o', b).onclick = () => {
      if (b.classList.toggle('open')) {
        const s = App.selected(), c = s[0]; $('.cn-ai-chip', b).textContent = s.length > 1 ? `${s.length} itens` : '@' + (c?.name || 'item');
        const sg = $('.cn-ai-sug', b); sg.innerHTML = ''; for (const t of this.aiSug(s)) { const x = h(`<button>${esc(t)}</button>`); x.onclick = () => { ta.value = t; go(); }; sg.appendChild(x); }
        const pr = b.parentElement.getBoundingClientRect(), r = b.getBoundingClientRect(); b.classList.toggle('flip', r.left - pr.left + 380 > pr.width); ta.focus();
      }
    };
    $('.cn-ai-go', b).onclick = go; $('.cn-ai-x', b).onclick = close;
    ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } if (e.key === 'Escape') close(); };
    addEventListener('pointerdown', e => { if (b.classList.contains('open') && !b.contains(e.target)) close(); }, true);
  },
  // sugestões tiradas do próprio item (o que ele TEM: reações, poses, partes, olhos, texto…), não uma lista fixa
  aiSug(s) {
    const c = s[0], out = [], add = t => { if (t && !out.includes(t) && out.length < 6) out.push(t); }; if (!c) return out;
    if (s.length > 1) { add('Alinhar todos'); add('Aparecerem um depois do outro'); add('Prender juntos'); return out; }
    const t = App.t, inCam = (() => { try { const g = Renderer.geom(App.project, c, t), p = g.m.transformPoint(new DOMPoint(g.box.x + g.box.w / 2, g.box.y + g.box.h / 2)), S = App.project.settings; return p.x > 0 && p.y > 0 && p.x < S.w && p.y < S.h; } catch { return true; } })();
    if (!inCam) add('Trazer para dentro da câmera');
    if (c.type === 'anim') {
      const rig = RigEdit.rig(c), f = RigEdit.frame(c), n = rig?.nodes.find(x => x.id === RigEdit.selNode);
      const nm = x => x.name.replace(/\s*\(.*\)\s*/, '').trim() || x.name;
      if (rig && n) { const cur = Math.round(Rig.ch(rig, n.id, 'd', f, n.d || 0)); let k = 0; n.drawings.forEach((d, i) => { if (i !== cur && d.asset && k++ < 3) add(`${nm(n)}: "${RigEdit.dname(d, i)}"`); }); add(`Mexer ${nm(n)} devagar`); }
      if (rig) {
        for (const nd of rig.nodes) if (nd.drawings.length > 1 && nd !== n) { const cur = Math.round(Rig.ch(rig, nd.id, 'd', f, nd.d || 0)); let k = 0; nd.drawings.forEach((d, i) => { if (i !== cur && d.asset && k < 2 && !/falando|fechad|aberta|piscan/i.test(d.name || '')) { k++; add(`${nm(nd)}: "${RigEdit.dname(d, i)}"`); } }); }
        Object.keys(rig.poses || {}).slice(0, 2).forEach(p => add(`Pose "${p}"`));
        const arm = rig.nodes.find(x => /mao|braco|antebraco/.test(x.role || '') || /m[aã]o|bra[cç]o/i.test(x.name)); if (arm) add(`Acenar com ${nm(arm)}`);
        if (typeof Acting !== 'undefined' && Acting.pupils(rig).length) add('Olhar para a câmera');
        if (rig.nodes.some(x => /boca|mouth/i.test(x.name) || x.talk)) add('Falar com a voz');
        if (!Object.keys(rig.keys || {}).length) add('Animar sozinho (respirar, piscar)');
        if (typeof IAFix !== 'undefined') add('Corrigir o personagem');
      }
    } else if (c.type === 'image' || c.type === 'gif') {
      const im = Assets.get(c.assetId)?.img; let opaque = false; try { const k = document.createElement('canvas'); k.width = k.height = 4; const g = k.getContext('2d'); g.drawImage(im, 0, 0, 4, 4); const d = g.getImageData(0, 0, 4, 4).data; opaque = d[3] > 250 && d[15] > 250 && d[51] > 250 && d[63] > 250; } catch { }
      if (opaque) add('Tirar o fundo'); add('Virar personagem com ossos'); add(c.kf && Object.keys(c.kf).length ? 'Deixar o movimento mais suave' : 'Entrar na tela deslizando');
    } else if (c.type === 'text') { const tx = (c.text?.text || '').slice(0, 18); add(`Aparecer "${tx}" letra por letra`); add('Deixar o texto maior'); add('Trocar a cor do texto'); }
    else if (c.type === 'shape') { add(c.shape?.fillAsset ? 'Trocar a imagem de dentro' : 'Colocar uma imagem dentro'); add('Trocar a cor'); }
    else if (c.type === 'video') { add('Limpar o ruído do áudio'); add('Cortar a parte parada'); }
    const g = (() => { try { return Renderer.geom(App.project, c, t).box; } catch { return null; } })(); if (g && g.w * g.h < App.project.settings.w * App.project.settings.h * .02) add('Deixar maior');
    if (out.length < 3) add('Aparecer devagar');
    return out;
  },
  placeAI() {
    const b = $('#cn-ai'); if (!b || !App.project) return; const s = App.selected().filter(c => !['audio', 'fx'].includes(c.type) && App.t >= c.start && App.t < c.start + c.dur);
    if (!s.length || App.playing) { b.style.display = 'none'; return; }
    const ov = $('#pv-overlay'), r = ov.getBoundingClientRect(), pr = b.parentElement.getBoundingClientRect(); let xm = -1e9, ym = 1e9;
    const toScr = p => { const o = App.outside && App.iv ? App.iv : { x: 0, y: 0 }, cm = !App.outside && App.camM(); const q = cm ? cm.transformPoint(p) : p; return { x: o.x + q.x * App.pvScale, y: o.y + q.y * App.pvScale }; };
    for (const c of s) { const g = Renderer.geom(App.project, c, App.t), bx = g.box; for (const [x, y] of [[bx.x, bx.y], [bx.x + bx.w, bx.y]]) { const q = toScr(g.m.transformPoint(new DOMPoint(x, y))); if (q.x > xm) xm = q.x; if (q.y < ym) ym = q.y; } }
    b.style.display = 'block'; b.style.left = clamp(r.left - pr.left + xm + 8, 4, pr.width - 40) + 'px'; b.style.top = clamp(r.top - pr.top + ym - 34, 4, pr.height - 40) + 'px';
  },
  askAI(text) {
    const s = App.selected(); const items = s.map(c => ({ kind: 'clipe', id: c.id }));
    const rig = s.find(c => c.type === 'anim'), node = rig && RigEdit.selNode && RigEdit.rig(rig)?.nodes.find(n => n.id === RigEdit.selNode);
    Assistant.toggle(true); Assistant.insertChips(items);
    const e = Assistant.ed(); if (e) { e.focus(); document.execCommand('insertText', false, (node ? `(parte "${node.name}") ` : '') + (text || '')); }
    if (text) setTimeout(() => Assistant.send?.(), 60);
  },
};

/* ---------- arrumação da tela (mover painéis de lugar) + textos longos com "…" ---------- */
const Layout = {
  KEYS: ['swap', 'tltop'],
  load() { for (const k of this.KEYS) { let on = false; try { on = localStorage.getItem('lay-' + k) === '1'; } catch { } document.body.classList.toggle('lay-' + k, on); } },
  toggle(k) { if (k === 'swap' && typeof Paineis !== 'undefined') return Paineis.swap(); const on = !document.body.classList.contains('lay-' + k); document.body.classList.toggle('lay-' + k, on); try { localStorage.setItem('lay-' + k, on ? '1' : '0'); } catch { } if (typeof Arrumacoes !== 'undefined') Arrumacoes.changed(); App.fitPreview?.(); EdDraw?.place?.(); },
  reset() { if (typeof Arrumacoes !== 'undefined') { try { localStorage.removeItem('arrumacoes'); } catch { } Paineis.reset(); Arrumacoes.use('padrao'); } for (const k of this.KEYS) { document.body.classList.remove('lay-' + k); try { localStorage.removeItem('lay-' + k); } catch { } } try { localStorage.removeItem('ed-draw-pos'); } catch { } App.fitPreview?.(); EdDraw?.place?.(); },
};
Layout.load();
// passou o mouse num texto cortado com "…": mostra o texto todo
addEventListener('mouseover', e => { const el = e.target; if (!(el instanceof HTMLElement) || el.title || el.children.length > 2) return; if (el.scrollWidth > el.clientWidth + 1 && el.textContent.trim()) el.title = el.textContent.trim(); }, true);
