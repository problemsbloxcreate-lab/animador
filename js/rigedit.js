/* ===================== rigedit.js — PNGtuber e boneco com ossos DENTRO do editor =====================
   • Clipe "personagem" (tipo anim): mostra os ossos na prévia — gire as juntas, puxe mão/pé (IK); vira keyframe
     no tempo do cursor. Painel "Personagem": troca reação (cabeça/expressão, olhos, boca, mãos), poses, atuar pela voz.
   • Imagem PNGtuber → "personagem editável": separa boca e olhos (e junta as partes já presas a ela) num boneco,
     para trocar a reação na própria cena. A imagem original não muda; pergunta antes de criar imagens novas.
   • Arquivo → Personagem com ossos: traz um boneco do Estúdio ou monta um (partes + modelo) direto na cena. */
'use strict';

const RigEdit = {
  on: true,
  A(c) { return c?.type === 'anim' ? (c.anim?.P || App.project?.animLib?.[c.anim?.lib]) : null; },
  rig(c) { return this.A(c)?.rigs?.[0] || null; },
  frame(c, t = App.t) { const A = this.A(c); if (!A) return 0; const fps = A.settings.fps, N = Math.max(1, A.frames); let f = Math.floor(((t - c.start) * (c.speed || 1) + (c.offset || 0)) * fps + 1e-6); return c.anim.loop ? ((f % N) + N) % N : clamp(f, 0, N - 1); },
  timeOfFrame(c, f) { const A = this.A(c); return c.start + (f / A.settings.fps - (c.offset || 0)) / (c.speed || 1); },
  // deixa a animação no MESMO fps do vídeo: cada keyframe cai exatamente num quadro do vídeo (sem ficar "entre" quadros)
  syncFps(c, fps = App.fps) {
    const A = this.A(c); if (!A || !fps || A.settings.fps === fps) return false; const k = fps / A.settings.fps, F = f => Math.round(f * k);
    const fix = ks => { if (!Array.isArray(ks)) return ks; const m = new Map(); for (const x of ks) m.set(F(x.f), { ...x, f: F(x.f) }); return [...m.values()].sort((a, b) => a.f - b.f); };
    for (const r of A.rigs || []) for (const id of Object.keys(r.keys || {})) for (const ch of Object.keys(r.keys[id])) r.keys[id][ch] = fix(r.keys[id][ch]);
    for (const ch of Object.keys(A.camera?.keys || {})) A.camera.keys[ch] = fix(A.camera.keys[ch]);
    for (const a of A.audio || []) if (typeof a.start === 'number') a.start = F(a.start);
    A.frames = Math.max(1, Math.ceil((A.frames || 1) * k)); A.settings.fps = fps; this.touch(c); return true;
  },
  touch(c) { const A = this.A(c); if (!A) return; A.rev = (A.rev || 0) + 1; c.anim.rev = (c.anim.rev || 0) + 1; App.requestRender(); },
  // anim (coordenadas do canvas do boneco) → projeto
  base(c, t = App.t) {
    const A = this.A(c), g = Renderer.geom(App.project, c, t), b = g.box;
    return g.m.translate(b.x, b.y).scale(b.w / A.settings.w, b.h / A.settings.h).multiply(AnimRender.camMatrix(A, this.frame(c, t)));
  },
  sel() { const s = App.selected(); return s.length === 1 && s[0].type === 'anim' && this.A(s[0]) && App.t >= s[0].start && App.t < s[0].start + s[0].dur ? s[0] : null; },

  /* ---------- ossos na prévia ---------- */
  // contorno da parte escolhida (onde você está mexendo/desenhando) — mesmo com os ossos desligados
  drawSel(ctx, k, d) {
    const c = this.sel(); if (!c) return; const rig = this.rig(c), n = rig?.nodes.find(x => x.id === this.selNode); if (!n) return;
    const A = this.A(c), f = this.frame(c), W = A.settings.w, H = A.settings.h, M = Rig.pose(rig, f), m = this.base(c).multiply(Rig.stageMatrix(rig, f, W, H)).multiply(M[n.id] || new DOMMatrix());
    const dr = [Rig.drawingAt(rig, n, f), ...n.drawings].find(x => x && x.w > 1) ; if (!dr) return;
    const pts = [[dr.ox, dr.oy], [dr.ox + dr.w, dr.oy], [dr.ox + dr.w, dr.oy + dr.h], [dr.ox, dr.oy + dr.h]].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
    ctx.save(); ctx.setLineDash([6 * d, 4 * d]); ctx.lineWidth = 2 * d; ctx.strokeStyle = '#ffd23d'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x * k, p.y * k) : ctx.moveTo(p.x * k, p.y * k)); ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = '#ffd23d'; ctx.font = `bold ${11 * d}px sans-serif`; ctx.fillText('✏️ ' + n.name, pts[0].x * k + 4 * d, pts[0].y * k - 6 * d); ctx.restore();
  },
  drawOverlay(ctx, k, d) {
    try { this.drawSel(ctx, k, d); } catch { }
    const c = this.sel(); if (!c || !this.on) return; // aparece também tocando
    const A = this.A(c), f = this.frame(c), B = this.base(c);
    for (const rig of A.rigs) {
      const J = Rig.joints(rig, f, A.settings.w, A.settings.h, B);
      ctx.save();
      for (const n of rig.nodes) {
        const j = J[n.id]; if (!j || !Rig.visible(rig, n, f)) continue;
        const kids = Rig.children(rig, n.id).filter(x => J[x.id] && Rig.visible(rig, x, f)), ends = kids.length ? kids.map(x => J[x.id]) : j.tip ? [j.tip] : [];
        const sel = this.selNode === n.id, col = sel ? '#ffd23d' : ['olho', 'boca', 'sobrancelha', 'nariz'].includes(n.role) ? '#7fd1ff' : n.follow ? '#d29bff' : '#ff8c5a';
        for (const e of ends) { const x0 = j.x * k, y0 = j.y * k, x1 = e.x * k, y1 = e.y * k, L = Math.hypot(x1 - x0, y1 - y0); if (L < 4 * d) continue; const w = Math.min(7 * d, L * .13), ux = (x1 - x0) / L, uy = (y1 - y0) / L, mx = x0 + (x1 - x0) * .18, my = y0 + (y1 - y0) * .18;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(mx - uy * w, my + ux * w); ctx.lineTo(x1, y1); ctx.lineTo(mx + uy * w, my - ux * w); ctx.closePath(); ctx.globalAlpha = .28; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = .95; ctx.strokeStyle = col; ctx.lineWidth = 1.3 * d; ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.beginPath(); if (Roles.ikChain(rig, n)) ctx.rect(j.x * k - 5 * d, j.y * k - 5 * d, 10 * d, 10 * d); else ctx.arc(j.x * k, j.y * k, (sel ? 6 : 4.5) * d, 0, 7);
        ctx.fillStyle = sel ? '#ffd23d' : '#15161a'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2 * d; ctx.stroke();
      }
      ctx.restore();
    }
  },
  hitJoint(c, pt) {
    const A = this.A(c), f = this.frame(c), B = this.base(c), tol = 11 / App.pvScale; let best = null, bd = tol;
    for (const rig of A.rigs) { const J = Rig.joints(rig, f, A.settings.w, A.settings.h, B); for (const n of rig.nodes) { const j = J[n.id]; if (!j || !Rig.visible(rig, n, f)) continue; const dd = Math.hypot(j.x - pt.x, j.y - pt.y); if (dd < bd) { bd = dd; best = { rig, n, j }; } } }
    return best;
  },
  down(e, pt) {
    const c = this.sel(); if (!c || !this.on || App.track(c.trackId)?.lock) return false;
    const H = this.hitJoint(c, pt); if (!H) return false;
    const { rig, n } = H; this.selNode = n.id;
    if (!n.parent && !e.altKey) { App.requestRender(); return false; } // raiz: arrastar move o clipe todo (como sempre)
    const A = this.A(c), f = this.frame(c), W = A.settings.w, Hh = A.settings.h;
    const ik = !e.altKey && Roles.ikChain(rig, n), face = ['olho', 'boca', 'sobrancelha', 'nariz'].includes(n.role) || e.shiftKey;
    let moved = false;
    if (ik) {
      dragPointer(e, ev => { const p = App.toProject(ev), q = this.base(c).inverse().transformPoint(new DOMPoint(p.x, p.y)); Rig.solveIK(rig, ik, f, { x: q.x, y: q.y }, W, Hh); moved = true; this.touch(c); },
        () => { if (moved) App.commit(`Moveu ${n.name} (IK)`); });
      return true;
    }
    if (face) {
      const M = Rig.pose(rig, f), S = this.base(c).multiply(Rig.stageMatrix(rig, f, W, Hh)), par = n.parent ? S.multiply(M[n.parent]) : S, inv = par.inverse(), l0 = inv.transformPoint(new DOMPoint(pt.x, pt.y));
      const x0 = Rig.ch(rig, n.id, 'x', f, 0), y0 = Rig.ch(rig, n.id, 'y', f, 0);
      dragPointer(e, ev => { const p = App.toProject(ev), l = inv.transformPoint(new DOMPoint(p.x, p.y)); Rig.setKey(rig, n.id, 'x', f, round(clamp(x0 + l.x - l0.x, -80, 80), 1)); Rig.setKey(rig, n.id, 'y', f, round(clamp(y0 + l.y - l0.y, -80, 80), 1)); moved = true; this.touch(c); },
        () => { if (moved) App.commit(`Moveu ${n.name}`); });
      return true;
    }
    const j = H.j, a0 = Math.atan2(pt.y - j.y, pt.x - j.x), r0 = Rig.ch(rig, n.id, 'r', f, 0), B = this.base(c), flip = (B.a * B.d - B.b * B.c) * Rig.stageAt(rig, f).F < 0 ? -1 : 1;
    dragPointer(e, ev => {
      const p = App.toProject(ev); let v = r0 + AnimMath.norm(AnimMath.deg(Math.atan2(p.y - j.y, p.x - j.x) - a0)) * flip;
      if (ev.shiftKey) v = Math.round(v / 15) * 15; if (n.limit) v = clamp(v, n.limit[0], n.limit[1]);
      Rig.setKey(rig, n.id, 'r', f, round(v, 2)); moved = true; this.touch(c);
    }, () => { if (moved) App.commit(`Girou ${n.name}`); });
    return true;
  },

  /* ---------- painel "Personagem" (organizado: 1 Reação · 2 Animar sozinho · 3 Desenhos · 4 Ossos) ---------- */
  USO: { boca: [['', 'automático'], ['fechada', 'boca fechada'], ['meio', 'boca meio aberta'], ['aberta', 'boca aberta'], ['grande', 'boca bem aberta'], ['nao', 'não usar na fala']], olho: [['', 'automático'], ['aberto', 'olho aberto'], ['meio', 'meio fechado'], ['fechado', 'fechado (piscar)']] },
  thumb(d) { const rt = d?.asset && Assets.get(d.asset); return rt?.url ? `<img src="${rt.url}" alt="">` : '<i class="rg-empty">vazio</i>'; },
  panel(P, body, c) {
    const A = this.A(c), rig = this.rig(c); if (!rig) { body.appendChild(h('<div class="empty">Este clipe não tem boneco.</div>')); return; }
    const f = this.frame(c), wrap = h('<div class="rg"></div>'); body.appendChild(wrap);
    const top = h(`<div class="rg-big">
      <button class="btn primary big" data-a="full" title="Ossos, desenho quadro a quadro e câmera em tela cheia (no mesmo quadro do vídeo)">🦴 Abrir nos ossos (tela cheia)</button>
      <label class="switch"><input type="checkbox" ${this.on ? 'checked' : ''}><i></i>Mostrar ossos na prévia</label></div>`);
    $('[data-a=full]', top).onclick = () => this.openFull(c);
    $('input', top).onchange = e => { this.on = e.target.checked; App.updatePvModo?.(); App.requestRender(); }; wrap.appendChild(top);
    // 1) REAÇÃO neste momento
    const hold = this._hold ?? 1, groups = rig.nodes.filter(n => n.drawings.length > 1).sort((a, b) => this.order(a) - this.order(b));
    const s1 = h(`<div class="rg-sec"><div class="rg-h"><span class="rg-n">1</span> 😀 Reação em <b>${fmtTime(App.t, App.fps, false)}</b></div>
      <div class="rg-hold"><span>Fica por:</span>${[[0, 'até mudar'], [.5, '½ s'], [1, '1 s'], [2, '2 s']].map(([v, l]) => `<button data-h="${v}" class="${v === hold ? 'on' : ''}">${l}</button>`).join('')}</div>
      <small class="rg-note">Clique num desenho para ele aparecer agora no vídeo.</small></div>`);
    $$('[data-h]', s1).forEach(b => b.onclick = () => { this._hold = +b.dataset.h; Props.render(); });
    if (!groups.length) s1.appendChild(h('<small class="rg-note">Este boneco ainda não tem troca de desenho. Use <b>3 · Desenhos</b> abaixo para adicionar (ou "Separar boca e olhos").</small>'));
    for (const n of groups) {
      const cur = Math.round(Rig.ch(rig, n.id, 'd', f, n.d || 0)), row = h(`<div class="rg-grp"><div class="rg-l">${esc(this.label(n))}</div><div class="rg-tiles"></div></div>`);
      n.drawings.forEach((d, i) => { const t = h(`<button class="rg-tile ${i === cur ? 'on' : ''}" title="${esc(this.dname(d, i))}">${this.thumb(d)}<span>${esc(this.dname(d, i))}</span></button>`); t.onclick = () => this.react(c, n, i, this._hold ?? 1); t.ondblclick = () => Cena.editPart(c, n, i); t.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [{ head: this.dname(d, i) }, { label: '😀 Usar agora', action: () => this.react(c, n, i, this._hold ?? 1) }, { label: '✏️ Editar (varinha, correção, camadas…)', action: () => Cena.editPart(c, n, i) }, { label: '🗑 Apagar este desenho', danger: true, disabled: n.drawings.length < 2, action: () => { n.drawings.splice(i, 1); this.touch(c); App.commit('Desenho apagado'); } }]); }; t.title = 'Clique = usar agora · duplo clique = editar · botão direito = opções'; $('.rg-tiles', row).appendChild(t); });
      s1.appendChild(row);
    }
    if (Acting.pupils(rig).length) { const row = h(`<div class="rg-grp"><div class="rg-l">👀 Olhar para</div><div class="chips"></div></div>`); for (const [k, l] of [['centro', '• frente'], ['esq', '← esquerda'], ['dir', 'direita →'], ['cima', '↑ cima'], ['baixo', '↓ baixo']]) { const ch = h(`<span class="chip">${l}</span>`); ch.onclick = () => { Acting.look(rig, f, k, { hold: this._hold ? Math.round(this._hold * A.settings.fps) : 0 }); this.touch(c); App.commit('Olhar: ' + k); }; $('.chips', row).appendChild(ch); } s1.appendChild(row); }
    const poses = Object.keys(rig.poses || {});
    if (poses.length) { const row = h(`<div class="rg-grp"><div class="rg-l">🧍 Pose</div><div class="chips"></div></div>`); poses.forEach(k => { const ch = h(`<span class="chip">${esc(k)}</span>`); ch.onclick = () => { Acting.poseTo(rig, rig.poses[k].data, f + 3, { trans: 4, ant: .15, lag: { tronco: 1, braco: 1, antebraco: 2, mao: 2 } }); this.touch(c); App.commit(`Pose "${k}"`); }; $('.chips', row).appendChild(ch); }); s1.appendChild(row); }
    wrap.appendChild(s1);
    // 2) ANIMAR SOZINHO pela voz
    const s4 = h(`<div class="rg-sec"><div class="rg-h"><span class="rg-n">2</span> 🎤 Animar sozinho (pela voz)</div><div class="rg-acts">
      <button class="btn ai-btn" data-a="all">✨ Tudo (boca, piscar, mexer)</button><button class="btn" data-a="mouth">👄 Só a boca</button><button class="btn" data-a="blink">😉 Só piscar</button><button class="btn" data-a="clear" title="Apaga a animação deste personagem">🗑 Limpar animação</button><button class="btn ai-btn" data-a="fix" title="Acha peças soltas, cortes mal feitos e pivôs errados — mostra antes/depois">🩺 Corrigir erros (IA)</button></div></div>`);
    $('[data-a=fix]', s4).onclick = () => IAFix.run(c);
    $('[data-a=all]', s4).onclick = () => this.act(c, 'all'); $('[data-a=mouth]', s4).onclick = () => this.act(c, 'boca'); $('[data-a=blink]', s4).onclick = () => this.act(c, 'piscar');
    $('[data-a=clear]', s4).onclick = async () => { if (!await UI.confirm({ title: 'Limpar a animação?', msg: 'Todos os keyframes do boneco deste clipe somem (dá para desfazer).', ok: 'Limpar', danger: true })) return; rig.keys = {}; this.touch(c); App.commit('Animação do boneco limpa'); };
    wrap.appendChild(s4);
    // 3) DESENHOS: definir o que cada desenho é, editar/limpar a imagem, adicionar
    const open = this._openD ?? false;
    const s5 = h(`<div class="rg-sec"><div class="rg-h rg-fold"><span class="rg-n">3</span> 🖼️ Desenhos (definir e arrumar) <span class="sp"></span><button class="btn sm" data-a="fold">${open ? 'Fechar ▲' : 'Abrir ▼'}</button></div></div>`);
    $('[data-a=fold]', s5).onclick = () => { this._openD = !open; Props.render(); };
    if (open) {
      for (const n of [...rig.nodes].filter(x => x.drawings.length).sort((a, b) => this.order(a) - this.order(b))) {
        const g = h(`<div class="rg-dgrp"><div class="rg-dh"><b>${esc(n.name)}</b><select data-role title="O que esta parte é (a animação automática usa isso)">${[['boca', '👄 Boca'], ['olho', '👀 Olhos'], ['sobrancelha', 'Sobrancelha'], ['cabeca', '😀 Rosto inteiro / expressão'], ['inteiro', '🧍 Pose do corpo inteiro'], ['tronco', 'Corpo'], ['parte', 'Outra parte']].map(([v, l]) => `<option value="${v}" ${n.role === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="rg-dlist"></div></div>`);
        $('[data-role]', g).onchange = e => { n.role = e.target.value; this.touch(c); App.commit('Parte: ' + n.name); };
        n.drawings.forEach((d, i) => {
          const uso = this.USO[n.role], it = h(`<div class="rg-d">${this.thumb(d)}<div class="rg-dm"><input type="text" value="${esc(d.name || '')}" placeholder="nome" title="Nome do desenho">${uso ? `<select data-u title="Para que serve na animação automática">${uso.map(([v, l]) => `<option value="${v}" ${(d.uso || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}</div>
            <div class="rg-db"><button class="ibtn" data-e title="Editar / limpar a imagem (máscara, varinha mágica, IA…)">✏️</button><button class="ibtn" data-x title="Apagar este desenho">🗑</button></div></div>`);
          $('input', it).onchange = e => { d.name = e.target.value; this.touch(c); App.commit('Nome do desenho'); };
          $('[data-u]', it)?.addEventListener('change', e => { d.uso = e.target.value || undefined; this.touch(c); App.commit('Uso do desenho'); });
          $('[data-e]', it).onclick = () => this.editDrawing(c, n, d);
          $('[data-x]', it).onclick = () => { if (n.drawings.length < 2) return UI.toast('A parte precisa de pelo menos um desenho', { kind: 'warn' }); n.drawings.splice(i, 1); for (const ks of [rig.keys[n.id]?.d]) if (ks) ks.forEach(k => { if (k.v === i) k.v = 0; else if (k.v > i) k.v--; }); this.touch(c); App.commit('Desenho apagado'); };
          $('.rg-dlist', g).appendChild(it);
        });
        const add = h(`<button class="btn sm rg-add">${ic('plus', 12)} Adicionar desenho (imagem)</button>`); add.onclick = () => this.addDrawing(c, n); $('.rg-dlist', g).appendChild(add);
        s5.appendChild(g);
      }
      if (c.png) { const b = h(`<button class="btn sm">${ic('undo', 12)} Voltar a ser imagem simples</button>`); b.onclick = () => this.toImage(c); s5.appendChild(b); }
    }
    wrap.appendChild(s5);
    // 4) OSSO selecionado
    const n = rig.nodes.find(x => x.id === this.selNode) || null;
    const s3 = h(`<div class="rg-sec"><div class="rg-h"><span class="rg-n">4</span> 🦴 Osso <span class="sp"></span><select data-node><option value="">— clique numa junta na prévia —</option>${Rig.ordered(rig).map(([x, lv]) => `<option value="${x.id}" ${x === n ? 'selected' : ''}>${'  '.repeat(lv)}${esc(x.name)}</option>`).join('')}</select></div></div>`);
    $('[data-node]', s3).onchange = e => { this.selNode = e.target.value || null; App.requestRender(); Props.render(); };
    if (n) {
      const r = Rig.ch(rig, n.id, 'r', f, 0), lim = n.limit || [-180, 180];
      const row = h(`<div class="ctl"><span class="ctl-l">Giro</span><div class="ctl-row"><input type="range" min="${lim[0]}" max="${lim[1]}" step=".5" value="${r}"><input type="number" class="nbox" step=".5" value="${round(r, 1)}"><span class="unit">°</span></div></div>`);
      const [rg, nb] = $$('input', row); const set = (v, done) => { Rig.setKey(rig, n.id, 'r', f, clamp(+v, lim[0], lim[1])); this.touch(c); rg.value = nb.value = v; if (done) App.commit('Giro do osso'); };
      rg.oninput = () => set(rg.value); rg.onchange = () => set(rg.value, true); nb.onchange = () => set(nb.value, true);
      s3.appendChild(row);
      for (const [ch, lb] of [['sy', '↕ Esticar (comprido)'], ['sx', '↔ Largura']]) { const v0 = Rig.ch(rig, n.id, ch, f, 1), r2 = h(`<div class="ctl"><span class="ctl-l">${lb}</span><div class="ctl-row"><input type="range" min="20" max="300" step="1" value="${Math.round(v0 * 100)}"><input type="number" class="nbox" value="${Math.round(v0 * 100)}"><span class="unit">%</span></div></div>`), [a, b] = $$('input', r2), st = (v, done) => { Rig.setKey(rig, n.id, ch, f, clamp(+v, 5, 1000) / 100); this.touch(c); a.value = b.value = v; if (done) App.commit(ch === 'sy' ? 'Esticou' : 'Largura'); }; a.oninput = () => st(a.value); a.onchange = () => st(a.value, true); b.onchange = () => st(b.value, true); s3.appendChild(r2); }
      const fl = h(`<label class="switch xs" title="Cabelo, orelha, roupa: balança atrasado em relação ao pai"><input type="checkbox" ${n.follow ? 'checked' : ''}><i></i>Balançar com atraso</label>`); $('input', fl).onchange = e => { n.follow = e.target.checked ? { lag: 4, amt: .7 } : null; this.touch(c); App.commit('Balanço'); }; s3.appendChild(fl);
    }
    wrap.appendChild(s3);
  },
  // editar a imagem de um desenho (ImgEdit) e trocar pelo resultado; separar boca/olhos vira partes novas
  editDrawing(c, n, d) {
    if (!d.asset) return UI.toast('Este desenho está vazio', { kind: 'warn' });
    const rig = this.rig(c);
    ImgEdit.open({ asset: d.asset, name: (d.name || n.name), onLayers: items => this.layersInto(c, n, d, items), onSave: id => { d.asset = id; n._mk = null; this.touch(c); App.commit('Imagem editada'); Props.render(); },
      onSeparate: parts => {
        const iw = Assets.get(d.asset)?.img?.naturalWidth || parts[0]?.W || 1, k = (d.w ?? iw) / iw;
        for (const p of parts) {
          const role = p.kind === 'boca' ? 'boca' : p.kind === 'olhos' ? 'olho' : 'parte';
          let tgt = rig.nodes.find(x => x.parent === n.id && x.role === role && role !== 'parte');
          const dr = { asset: p.asset, name: 'do desenho', ox: d.ox + p.x * k, oy: d.oy + p.y * k, w: p.w * k, h: p.h * k };
          if (!tgt) { tgt = Rig.newNode({ name: p.kind === 'boca' ? 'boca' : p.kind === 'olhos' ? 'olhos' : p.name, role, parent: n.id, px: n.px, py: n.py, z: Math.max(...rig.nodes.map(x => x.z)) + 1 }); tgt.px = n.px; tgt.py = n.py; dr.ox = d.ox + p.x * k; tgt.drawings = [dr]; rig.nodes.push(tgt); }
          else tgt.drawings.push(dr);
        }
        this.touch(c); App.commit('Partes separadas'); Props.render();
      } });
  },
  // camadas do editor de imagem → dentro de uma parte do boneco: base troca a imagem, reações viram desenhos da parte, peças viram ossos filhos
  layersInto(c, n, d, items) {
    const rig = this.rig(c), iw = Assets.get(d.asset)?.img?.naturalWidth || items[0]?.W || 1, k = (d.w ?? iw) / iw, dr = p => ({ asset: p.asset, name: p.name, ox: d.ox + p.x * k, oy: d.oy + p.y * k, w: p.w * k, h: p.h * k });
    const b = items.find(p => p.kind === 'base'); if (b) Object.assign(d, dr(b), { name: d.name });
    for (const p of items.filter(p => p.kind === 'reacao')) n.drawings.push(dr(p));
    let z = Math.max(...rig.nodes.map(x => x.z)) + 1;
    for (const p of items.filter(p => p.kind === 'peca')) { const D = dr(p), cx = n.px + D.ox + D.w / 2, cy = n.py + D.oy + D.h * .15; const nn = Rig.newNode({ name: p.name, role: Roles.of(p.name), parent: n.id, px: cx, py: cy, z: z++ }); nn.drawings = [{ ...D, ox: D.ox - (cx - n.px), oy: D.oy - (cy - n.py) }]; nn.tip = Rig.computeTip(nn); rig.nodes.push(nn); }
    this.touch(c); App.commit('Camadas no personagem', { toast: true }); this._openD = true; Props.render();
  },
  // camadas → personagem novo a partir de um clipe de imagem (mantém lugar e tamanho no vídeo)
  async fromLayers(c, items) {
    const p = App.project, W = items[0].W, H = items[0].H, rig = Rig.newRig({ name: (c.name || 'Personagem').slice(0, 30), w: W, h: H }); rig.ox = W / 2; rig.oy = H; rig.breath = .3;
    const base = items.find(x => x.kind === 'base'), body = Rig.newNode({ name: 'Corpo', role: 'inteiro', px: W / 2, py: H * .6, z: 0 });
    body.drawings = [base ? { asset: base.asset, name: 'normal', ox: base.x - W / 2, oy: base.y - H * .6, w: base.w, h: base.h } : { asset: c.assetId, name: 'normal', ox: -W / 2, oy: -H * .6, w: W, h: H }]; rig.nodes.push(body);
    let z = 1; const reac = items.filter(x => x.kind === 'reacao');
    if (reac.length) { const r = Rig.newNode({ name: 'rosto (reações)', role: 'cabeca', parent: body.id, px: W / 2, py: H * .3, z: z++ }); r.drawings = [{ asset: null, name: 'normal (do desenho)', ox: 0, oy: 0, w: 1, h: 1 }, ...reac.map(x => ({ asset: x.asset, name: x.name, ox: x.x - r.px, oy: x.y - r.py, w: x.w, h: x.h }))]; rig.nodes.push(r); }
    const junto = items.some(x => x.junto); // tudo junto: cada camada é uma camada do personagem, presa no corpo (gira junto, sem osso próprio)
    for (const x of items.filter(x => x.kind === 'peca')) { const cx = junto ? body.px : x.x + x.w / 2, cy = junto ? body.py : x.y + x.h * .15, nn = Rig.newNode({ name: x.name, role: Roles.of(x.name), parent: body.id, px: cx, py: cy, z: z++ }); nn.drawings = [{ asset: x.asset, name: 'normal', ox: x.x - cx, oy: x.y - cy, w: x.w, h: x.h }]; rig.nodes.push(nn); }
    rig.nodes.forEach(n => n.tip = Rig.computeTip(n)); rig.stage = { X: 0, Y: H / 2, S: 1, F: 1, O: 100 };
    const A = { settings: { w: W, h: H, fps: App.fps, bg: '#000000' }, frames: Math.max(1, Math.ceil((c.dur * (c.speed || 1) + (c.offset || 0)) * App.fps) + 2), rigs: [rig], camera: { keys: {} }, rev: 1 };
    c.png = { assetId: c.assetId, boca: c.boca || null, kids: [] }; c.type = 'anim'; c.anim = { P: A, transparent: true }; c.name = (c.name || 'Personagem') + (junto ? ' (camadas juntas)' : ' (camadas)');
    App.select(c.id); Props.tab = 'rig'; this._openD = true; App.commit('Personagem montado com as camadas', { toast: true });
  },
  async addDrawing(c, n) {
    const fl = await pickFiles('image/*'); if (!fl.length) return;
    for (const f of fl) { const rt = await Assets.addBlob(f, f.name, App.project.id, 'image'); App.project.bin.push(rt.meta.id); await new Promise(r => setTimeout(r, 50)); const base = n.drawings.find(x => x.asset) || n.drawings[0]; const im = rt.img || Assets.get(rt.meta.id)?.img; n.drawings.push({ asset: rt.meta.id, name: f.name.replace(/\.[^.]+$/, ''), ox: base?.ox ?? -(im?.naturalWidth || 100) / 2, oy: base?.oy ?? -(im?.naturalHeight || 100) / 2, w: base?.w ?? im?.naturalWidth, h: base?.h ?? im?.naturalHeight }); }
    this.touch(c); App.commit('Desenho adicionado'); Props.render();
  },
  async openFull(c) {
    if (!c) return;
    if (App.playing) App.pause(); await App.save(true);
    const t = App.t >= c.start && App.t < c.start + c.dur ? App.t : c.start, pid = App.project.id, cid = c.id;
    $('#ossos-tela')?.remove();
    const ov = h(`<div class="ossos-tela" id="ossos-tela"><iframe src="animar.html?ed=${encodeURIComponent(pid)}&c=${encodeURIComponent(cid)}&t=${round(t, 3)}&embed=1" title="Ossos"></iframe></div>`);
    document.body.appendChild(ov); $('#ep-modo [data-m=ossos]')?.classList.add('on'); $('#ep-modo [data-m=edicao]')?.classList.remove('on');
    const on = async ev => {
      if (ev.origin !== location.origin || ev.data?.tipo !== 'ossos-voltar') return;
      removeEventListener('message', on);
      const rec = await DB.get('projects', pid); if (rec) await App.open(rec);
      App.seek(ev.data.t ?? t); App.select(cid); Props.tab = 'rig'; Props.render?.();
      ov.remove(); $('#ep-modo [data-m=ossos]')?.classList.remove('on'); $('#ep-modo [data-m=edicao]')?.classList.add('on');
    };
    addEventListener('message', on);
  },
  // botão "Ossos" do topo: abre o personagem selecionado (ou o que está no cursor)
  openAny() {
    const p = App.project; if (!p) return;
    const sel = App.selected().find(x => x.type === 'anim'), atT = p.clips.find(x => x.type === 'anim' && App.t >= x.start && App.t < x.start + x.dur), any = p.clips.find(x => x.type === 'anim');
    const c = sel || atT || any;
    if (c) return this.openFull(c);
    const img = App.selected().find(x => x.type === 'image');
    if (img) return UI.toast('Transformando a imagem em personagem editável…', { time: 1500 }), this.fromImage(img).then(cc => cc && this.openFull(cc));
    UI.toast('Selecione um personagem (ou uma imagem) para abrir nos ossos — ou use "Boneco com ossos" na esquerda.', { kind: 'warn', time: 4200 });
  },
  order(n) { return { cabeca: 0, inteiro: 0, olho: 1, sobrancelha: 2, boca: 3, mao: 4 }[n.role] ?? 5; },
  label(n) { return { cabeca: 'Cabeça / expressão', inteiro: 'Pose', olho: 'Olhos', boca: 'Boca', sobrancelha: 'Sobrancelhas', mao: 'Mão' }[n.role] ? `${{ cabeca: 'Expressão', inteiro: 'Pose', olho: 'Olhos', boca: 'Boca', sobrancelha: 'Sobrancelhas', mao: 'Mão' }[n.role]}${n.side ? ' ' + n.side : ''}` : n.name; },
  dname(d, i) { return String(d.name || 'desenho ' + (i + 1)).replace(/\(do desenho\)/, '').replace(/^P\d+ (parte |osso )?/i, '').trim() || 'normal'; },
  // troca de desenho no tempo do cursor (expressão de cabeça esconde olhos/boca soltos)
  react(c, n, i, dur) {
    if (!n || !n.drawings[i]) return;
    const rig = this.rig(c), f = this.frame(c), A = this.A(c), back = dur ? Math.min(A.frames - 1, f + Math.round(dur * A.settings.fps)) : null;
    const prev = Math.round(Rig.ch(rig, n.id, 'd', back ?? f, n.d || 0));
    if (back !== null) Acting.clearRange(rig, n.id, 'd', f, back);
    Rig.setKey(rig, n.id, 'd', f, i, 'hold'); if (back !== null && back > f) Rig.setKey(rig, n.id, 'd', back, prev === i ? (n.d || 0) : prev, 'hold');
    if (n.role === 'cabeca' || n.role === 'inteiro') for (const k of rig.nodes.filter(x => x.parent === n.id && ['olho', 'boca', 'sobrancelha'].includes(x.role))) { Rig.setKey(rig, k.id, 'v', f, i === (n.d || 0) ? 1 : 0, 'hold'); if (back !== null && back > f) Rig.setKey(rig, k.id, 'v', back, 1, 'hold'); }
    this.touch(c); App.commit(`Reação: ${this.label(n)} → ${this.dname(n.drawings[i], i)}`);
  },
  // projeto temporário com a voz do editor no tempo do boneco
  withVoice(c) {
    const A = this.A(c), fps = A.settings.fps, p = App.project, audio = [];
    for (const ac of p.clips.filter(x => (x.type === 'audio' || x.type === 'video') && !x.muted && x.assetId && !x.duck && x.start < c.start + c.dur && x.start + x.dur > c.start)) {
      if (!Assets.audioBuffer(ac.assetId, Assets.ctx())) continue;
      const nm = (ac.name || Assets.meta(ac.assetId)?.name || '').toLowerCase(); if (/m[uú]sica|music|trilha|efeito|sfx/.test(nm)) continue;
      audio.push({ asset: ac.assetId, start: Math.round(((ac.start - c.start) * (c.speed || 1) + (c.offset || 0)) * fps), offset: ac.offset || 0, vol: ac.volume ?? 100, kind: 'voz' });
    }
    return { ...A, audio };
  },
  act(c, what, o = {}) {
    const rig = this.rig(c), V = this.withVoice(c), f0 = Math.max(0, this.frame(c, c.start)), f1 = this.frame(c, c.start + c.dur - 1e-3);
    if (what !== 'piscar' && !V.audio.length) { UI.toast('Não achei voz debaixo deste clipe (áudio de fala na linha do tempo).', { kind: 'warn', time: 4000 }); if (what === 'boca') return 0; }
    let msg = '';
    if (what === 'boca') { const n = Acting.lipsync(V, rig, Acting.analyze(V), f0, f1); msg = n ? `Boca pela voz (${n} trocas)` : 'Este boneco não tem boca com troca de desenho'; }
    else if (what === 'piscar') { const n = Acting.blinks(V, rig, f0, f1); msg = n ? `${n} piscadas` : 'Este boneco não tem olho fechado'; }
    else { const r = V.audio.length ? Acting.perform(V, rig, { de: f0, ate: f1, intensidade: o.intensidade || 'normal' }) : (Acting.drift(rig, f0, f1), Acting.blinks(V, rig, f0, f1), {}); msg = `Atuação: ${r.acentos ?? 0} ênfase(s), ${r.piscadas ?? 0} piscada(s), ${r.expressoes ?? 0} expressão(ões)${r.bocas ? ', boca pela voz' : ''}`; }
    this.touch(c); if (!o.silent) App.commit(msg, { toast: true }); return 1;
  },

  /* ---------- imagem → personagem editável (boca e olhos separados) ---------- */
  async fromImage(c, o = {}) {
    if (c?.parent && App.clip(c.parent)?.type === 'image') c = App.clip(c.parent); // clicou numa parte (boca/olhos): usa o corpo
    if (!c || c.type !== 'image') return null; const rt = Assets.get(c.assetId); if (!rt?.img) return null;
    const p = App.project, W = rt.img.naturalWidth, H = rt.img.naturalHeight;
    const kids = p.clips.filter(x => x.parent === c.id && x.type === 'image' && Assets.get(x.assetId)?.img);
    if (!o.yes && !await UI.confirm({ title: 'Separar boca e olhos?', icon: 'alert', msg: `Vou criar <b>desenhos novos</b> a partir desta imagem (olhos fechados, bocas) para você trocar a reação.${kids.length ? ` As ${kids.length} parte(s) presas nela (boca, olhos…) entram no boneco.` : ''} A imagem original <b>não muda</b> e dá para voltar a ser imagem simples.`, ok: 'Pode criar' })) return null;
    // 1) onde estão olhos e boca
    let F = null;
    const has = r => kids.some(k => Roles.of(k.name || Assets.meta(k.assetId)?.name) === r);
    { // mesmo com partes prontas, acha olhos e boca para criar desenhos extras (meio fechados, boca meio/grande)
      if (AIClient.ready) { try { F = await this.aiFeatures(rt.img); } catch { } }
      F ||= this.guessFeatures(rt.img);
      if (!o.yes) { F = await this.adjustFeatures(rt.img, F); if (!F) return null; }
    }
    // 2) monta o boneco
    const fps = 24, rig = Rig.newRig({ name: (c.name || 'Personagem').slice(0, 30), w: W, h: H }); rig.ox = W / 2; rig.oy = H; rig.breath = .35;
    const body = Rig.newNode({ name: 'Corpo', role: 'inteiro', px: W / 2, py: H * .6, z: 0 }); body.drawings = [{ asset: c.assetId, name: 'normal', ox: -W / 2, oy: -H * .6, w: W, h: H }]; rig.nodes.push(body);
    if (c.boca?.midia && Assets.get(c.boca.midia)?.img) { body.drawings.push({ asset: c.boca.midia, name: 'falando', ox: -W / 2, oy: -H * .6, w: W, h: H }); body.talk = { 0: 1 }; }
    // partes que já estavam presas (as do sistema antigo de partes)
    let z = 1;
    for (const k of kids) {
      // corpo e parte medidos NO MESMO instante (se o corpo tiver zoom/balanço, a parte não fica gigante nem fora do lugar)
      const tk = Math.min(Math.max(k.start, c.start) + .001, c.start + c.dur - .001), inv = this.imgMap(c, tk).inverse(), g = Renderer.geom(p, k, tk), b = g.box, pts = [[b.x, b.y], [b.x + b.w, b.y + b.h]].map(([x, y]) => inv.transformPoint(g.m.transformPoint(new DOMPoint(x, y))));
      const x0 = Math.min(pts[0].x, pts[1].x), y0 = Math.min(pts[0].y, pts[1].y), w = Math.abs(pts[1].x - pts[0].x), hh = Math.abs(pts[1].y - pts[0].y), nm = k.name || Assets.meta(k.assetId)?.name || 'parte', role = Roles.of(nm);
      const n = Rig.newNode({ name: nm.replace(/\.[^.]+$/, ''), role: role === 'parte' ? 'acessorio' : role, parent: body.id, px: x0 + w / 2, py: y0 + hh / 2, z: z++ });
      const dr = { asset: k.assetId, name: nm.replace(/^P\d+ parte /i, ''), ox: -w / 2, oy: -hh / 2, w, h: hh }, empty = nm2 => ({ asset: null, name: nm2, ox: 0, oy: 0, w: 1, h: 1 });
      const mode = k.vis?.modo;
      if (mode === 'piscar' || (role === 'olho' && /fech|closed/i.test(nm))) { n.role = 'olho'; n.drawings = [empty('abertos (do desenho)'), { ...dr, name: 'fechados' }]; }
      else if (mode === 'calado' || (role === 'boca' && /fech|closed/i.test(nm))) { n.role = 'boca'; n.drawings = [{ ...dr, name: 'fechada' }, empty('aberta (do desenho)')]; }
      else { n.drawings = [{ ...dr }, empty('sem')]; }
      rig.nodes.push(n);
    }
    if (F) await this.buildFace(c, rt.img, rig, body, F, { eyes: true, mouth: true, eyesInto: rig.nodes.find(n => n.role === 'olho'), mouthInto: rig.nodes.find(n => n.role === 'boca') });
    rig.nodes.forEach(n => n.tip = Rig.computeTip(n));
    rig.stage = { X: 0, Y: H / 2, S: 1, F: 1, O: 100 };
    const A = { settings: { w: W, h: H, fps, bg: '#000000' }, frames: Math.max(1, Math.ceil((c.dur * (c.speed || 1) + (c.offset || 0)) * fps) + 2), rigs: [rig], camera: { keys: {} }, rev: 1 };
    // 3) o clipe vira personagem (mantém posição, animações e efeitos)
    c.png = { assetId: c.assetId, boca: c.boca || null, kids: kids.map(k => clone(k)) };
    c.type = 'anim'; c.anim = { P: A, transparent: true }; delete c.boca; c.name = (c.name || 'Personagem') + ' (editável)';
    p.clips = p.clips.filter(x => !kids.includes(x));
    // 4) já anima boca, piscadas e um balanço leve pela voz
    this.act(c, 'all', { silent: true });
    App.select(c.id); Props.tab = 'rig'; App.commit('Personagem editável (boca e olhos separados)', { toast: true });
    return c;
  },
  toImage(c) {
    if (!c?.png) return; const p = App.project;
    c.type = 'image'; c.assetId = c.png.assetId; if (c.png.boca) c.boca = c.png.boca; for (const k of c.png.kids || []) p.clips.push(k);
    delete c.anim; delete c.png; c.name = (c.name || '').replace(/ \(editável\)$/, '');
    App.commit('Voltou a ser imagem simples', { toast: true });
  },
  // pixel da imagem → projeto (para clipe de imagem)
  imgMap(c, t) { const g = Renderer.geom(App.project, c, t ?? Math.max(c.start, Math.min(App.t, c.start + c.dur - 1e-3))), b = g.box, m = Assets.meta(c.assetId); return g.m.translate(b.x, b.y).scale(b.w / (m?.w || 1), b.h / (m?.h || 1)); },
  async aiFeatures(img) {
    const k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    const g = cv.getContext('2d'); g.fillStyle = '#7fbf8f'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
    const j = await AIClient.call([{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: cv.toDataURL('image/jpeg', .85).split(',')[1] } }, { type: 'text', text: 'Personagem de desenho. Responda SÓ um JSON: {"olho_esq":[x0,y0,x1,y1],"olho_dir":[x0,y0,x1,y1],"boca":[x0,y0,x1,y1]} em PORCENTAGEM da imagem (0–100), caixas justas em volta de cada olho (com cílios) e da boca. Se não houver, use null.' }] }], 'Você localiza partes do rosto em desenhos. Só JSON.');
    const t = (j.content || []).map(b => b.text || '').join(''), m = t.match(/\{[\s\S]*\}/); if (!m) return null; const o = JSON.parse(m[0]);
    const px = b => Array.isArray(b) && b.length === 4 ? [b[0] / 100 * img.naturalWidth, b[1] / 100 * img.naturalHeight, b[2] / 100 * img.naturalWidth, b[3] / 100 * img.naturalHeight] : null;
    const F = { eyeL: px(o.olho_esq), eyeR: px(o.olho_dir), mouth: px(o.boca) }; return F.mouth || F.eyeL ? F : null;
  },
  // sem IA: olhos = as duas maiores manchas BRANCAS (esclera) no alto do personagem; boca = mancha escura/rosada abaixo, entre os olhos
  comps(m, w, hh) { const lab = new Int32Array(w * hh), st = new Int32Array(w * hh), out = []; let n = 0;
    for (let i = 0; i < w * hh; i++) { if (!m[i] || lab[i]) continue; n++; let sp = 0, x0 = w, y0 = hh, x1 = 0, y1 = 0, a = 0; st[sp++] = i; lab[i] = n;
      while (sp) { const q = st[--sp], x = q % w, y = (q / w) | 0; a++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; for (const r of [q - 1, q + 1, q - w, q + w]) if (r >= 0 && r < w * hh && m[r] && !lab[r] && Math.abs((r % w) - x) <= 1) { lab[r] = n; st[sp++] = r; } }
      out.push({ id: n, a, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }); }
    return { lab, out }; },
  guessFeatures(img) {
    const W = img.naturalWidth, H = img.naturalHeight, k = Math.min(1, 600 / Math.max(W, H)), w = Math.round(W * k), hh = Math.round(H * k);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, hh); const d = g.getImageData(0, 0, w, hh).data;
    let top = hh, bot = 0, l = w, r = 0, op = 0; for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 100) { op++; if (y < top) top = y; if (y > bot) bot = y; if (x < l) l = x; if (x > r) r = x; }
    const back = box => box.map(v => v / k), lum = i => .3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2];
    const wm = new Uint8Array(w * hh), ylim = top + (bot - top) * .55;
    for (let y = top; y < ylim; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i + 3] > 200 && d[i] > 215 && d[i + 1] > 215 && d[i + 2] > 215) wm[y * w + x] = 1; }
    const C = this.comps(wm, w, hh).out.filter(c => c.a > op * .0006 && (c.x1 - c.x0) < w * .3 && (c.y1 - c.y0) < (bot - top) * .12 && (c.y1 - c.y0) > 2);
    let best = null, bs = 0;
    for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) { const a = C[i], b = C[j], dy = Math.abs(a.cy - b.cy), dx = Math.abs(a.cx - b.cx), sz = Math.max(a.y1 - a.y0, b.y1 - b.y0, 4);
      if (dy > sz * 1.2 || dx < sz * .8 || dx > w * .45) continue; const sc = Math.min(a.a, b.a) * 2 - dy * 3 - (a.cy + b.cy) * .02; if (sc > bs) { bs = sc; best = a.cx < b.cx ? [a, b] : [b, a]; } }
    if (!best && C.length) { // só um olho aberto (piscando): espelha a posição pelo meio do rosto
      const a = [...C].sort((x, y) => y.a - x.a)[0], mid = (l + r) / 2, ww = a.x1 - a.x0, b = { ...a, x0: 2 * mid - a.x1, x1: 2 * mid - a.x0, cx: 2 * mid - a.cx }; if (Math.abs(b.cx - a.cx) > ww) best = a.cx < b.cx ? [a, b] : [b, a]; }
    if (!best) { const ch = bot - top, cx = (l + r) / 2, fy = top + ch * .2, fw = Math.max(20, (r - l) * .42); return { eyeL: back([cx - fw * .5, fy - ch * .02, cx - fw * .1, fy + ch * .04]), eyeR: back([cx + fw * .1, fy - ch * .02, cx + fw * .5, fy + ch * .04]), mouth: back([cx - fw * .15, fy + ch * .08, cx + fw * .15, fy + ch * .11]), guess: true }; }
    const pad = (c, k2) => { const ww = c.x1 - c.x0, h2 = c.y1 - c.y0; return [c.x0 - ww * k2, c.y0 - h2 * k2 * 1.4, c.x1 + ww * k2, c.y1 + h2 * k2 * .8]; };
    const [A, B] = best, ed = B.cx - A.cx, ey = Math.max(A.y1, B.y1), mx0 = A.cx - ed * .15, mx1 = B.cx + ed * .05, my0 = ey + ed * .08, my1 = Math.min(hh - 1, ey + ed * 1.1);
    const mm = new Uint8Array(w * hh);
    const pinkPx = i => d[i] > 150 && d[i] - d[i + 1] > 45 && d[i + 2] < d[i] + 2 && lum(i) < 215, mp = new Uint8Array(w * hh);
    for (let y = Math.round(my0); y < my1; y++) for (let x = Math.round(mx0); x < mx1; x++) { const i = (y * w + x) * 4; if (d[i + 3] < 200) continue; const L = lum(i); if (L < 70) mm[y * w + x] = 1; if (pinkPx(i)) mp[y * w + x] = 1; }
    const Pk = this.comps(mp, w, hh).out.filter(c => c.a > 4).sort((a, b) => Math.hypot(a.cx - (A.cx + B.cx) / 2, a.cy - (ey + ed * .45)) - Math.hypot(b.cx - (A.cx + B.cx) / 2, b.cy - (ey + ed * .45)))[0];
    if (Pk) { const ww = Pk.x1 - Pk.x0, h2 = Pk.y1 - Pk.y0; return { eyeL: back(pad(A, .22)), eyeR: back(pad(B, .22)), mouth: back([Pk.x0 - ww * .5 - 2, Pk.y0 - h2 * .9 - 2, Pk.x1 + ww * .5 + 2, Pk.y1 + h2 * .4 + 2]), guess: false }; }
    // a boca é a mancha (escura/rosada) mais perto do ponto esperado, que não seja comprida demais (contorno do queixo)
    const ex = (A.cx + B.cx) / 2, eY = ey + ed * .45;
    const M = this.comps(mm, w, hh).out.filter(c => c.a > 6 && (c.x1 - c.x0) < ed * .9 && (c.y1 - c.y0) < ed * .6).sort((a, b) => Math.hypot(a.cx - ex, a.cy - eY) / Math.sqrt(a.a) - Math.hypot(b.cx - ex, b.cy - eY) / Math.sqrt(b.a))[0];
    const mouth = M ? [M.x0 - 3, M.y0 - 3, M.x1 + 3, M.y1 + 3] : [A.cx + ed * .3, ey + ed * .35, B.cx - ed * .3, ey + ed * .55];
    return { eyeL: back(pad(A, .22)), eyeR: back(pad(B, .22)), mouth: back(mouth), guess: !M };
  },
  // tela para conferir/ajustar onde estão os olhos e a boca (arrastar as caixas)
  async adjustFeatures(img, F) {
    const W = img.naturalWidth, H = img.naturalHeight, bs = [F.eyeL, F.eyeR, F.mouth].filter(Boolean);
    // mostra só a região do rosto, grande
    let cx0 = Math.min(...bs.map(b => b[0])), cy0 = Math.min(...bs.map(b => b[1])), cx1 = Math.max(...bs.map(b => b[2])), cy1 = Math.max(...bs.map(b => b[3]));
    const mw = Math.max(cx1 - cx0, W * .15) * 1.2, mh = Math.max(cy1 - cy0, H * .08) * 1.5; cx0 = Math.max(0, cx0 - mw); cy0 = Math.max(0, cy0 - mh); cx1 = Math.min(W, cx1 + mw); cy1 = Math.min(H, cy1 + mh);
    const CW = cx1 - cx0, CH = cy1 - cy0, S = Math.min(560 / CH, 620 / CW);
    const body = h(`<div><p style="margin:0 0 8px">${F.guess ? 'Não achei com certeza — ' : ''}Arraste as caixas para cima dos <b>olhos</b> e da <b>boca</b> (canto de baixo muda o tamanho).</p><div class="rg-adj" style="width:${CW * S}px;height:${CH * S}px;overflow:hidden"><img src="${img.src}" style="position:absolute;left:${-cx0 * S}px;top:${-cy0 * S}px;width:${W * S}px;height:${H * S}px;max-width:none"></div></div>`);
    const st = $('.rg-adj', body), boxes = { eyeL: ['olho', '#19d3f0'], eyeR: ['olho', '#19d3f0'], mouth: ['boca', '#ff5fd2'] }, cur = {};
    for (const [key, [lb, col]] of Object.entries(boxes)) {
      let b = F[key] || (key === 'eyeR' && F.eyeL ? [F.eyeL[2] + 10, F.eyeL[1], F.eyeL[2] + 10 + (F.eyeL[2] - F.eyeL[0]), F.eyeL[3]] : [W * .4, H * .2, W * .6, H * .26]); cur[key] = [...b];
      const el = h(`<div class="rg-box" style="border-color:${col}"><b style="background:${col}">${lb}</b><i></i></div>`); st.appendChild(el);
      const put = () => { const q = cur[key]; Object.assign(el.style, { left: (q[0] - cx0) * S + 'px', top: (q[1] - cy0) * S + 'px', width: (q[2] - q[0]) * S + 'px', height: (q[3] - q[1]) * S + 'px' }); }; put();
      el.onpointerdown = e => { e.preventDefault(); const rs = e.target.tagName === 'I', q0 = [...cur[key]]; dragPointer(e, (ev, dx, dy) => { const mx = dx / S, my = dy / S; cur[key] = rs ? [q0[0], q0[1], Math.max(q0[0] + 8, q0[2] + mx), Math.max(q0[1] + 6, q0[3] + my)] : [q0[0] + mx, q0[1] + my, q0[2] + mx, q0[3] + my]; put(); }, () => { }); };
    }
    const ok = await UI.modal({ title: 'Onde estão os olhos e a boca?', icon: 'eye', width: Math.max(420, CW * S + 40), body, cancelValue: false, sticky: true, buttons: [{ label: 'Cancelar', value: false }, { label: 'Separar', kind: 'primary', value: true }] });
    return ok ? { eyeL: cur.eyeL, eyeR: cur.eyeR, mouth: cur.mouth } : null;
  },
  // máscara exata do olho (branco + íris) ou da boca dentro da caixa
  maskIn(sg, W, H, box, kind) {
    const x0 = Math.max(0, Math.floor(box[0])), y0 = Math.max(0, Math.floor(box[1])), x1 = Math.min(W, Math.ceil(box[2])), y1 = Math.min(H, Math.ceil(box[3])), w = x1 - x0, hh = y1 - y0; if (w < 3 || hh < 3) return null;
    const d = sg.getImageData(x0, y0, w, hh).data, m = new Uint8Array(w * hh);
    for (let i = 0; i < w * hh; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3], L = .3 * r + .59 * g + .11 * b; if (a < 150) continue;
      m[i] = kind === 'eye' ? (r > 205 && g > 205 && b > 205 ? 1 : 0) : (L < 75 || (r > 150 && r - g > 45 && b < r + 2) || (r > 225 && g > 225 && b > 225) ? 1 : 0); }
    if (kind === 'mouth') { // semente = rosado (língua) ou dentes no meio da caixa; cresce pelo escuro só até 1,35× a semente
      const seed = new Uint8Array(w * hh); for (let i = 0; i < w * hh; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], L = .3 * r + .59 * g + .11 * b; if (d[i * 4 + 3] > 150 && ((r > 150 && r - g > 45 && b < r + 2 && L < 215) || (r > 225 && g > 225 && b > 225))) seed[i] = 1; }
      const S = this.comps(seed, w, hh).out.filter(c => c.a > 3).sort((a, b) => Math.hypot(a.cx - w / 2, a.cy - hh / 2) - Math.hypot(b.cx - w / 2, b.cy - hh / 2));
      if (S.length) { const s0 = S[0], gw = (s0.x1 - s0.x0) * .4 + 3, gh = (s0.y1 - s0.y0) * .5 + 3, lim = [s0.x0 - gw, s0.y0 - gh, s0.x1 + gw, s0.y1 + gh], C2 = this.comps(seed, w, hh).lab;
        for (let i = 0; i < w * hh; i++) { const x = i % w, y = (i / w) | 0; m[i] = (x >= lim[0] && x <= lim[2] && y >= lim[1] && y <= lim[3] && (m[i] || seed[i])) ? 1 : 0; } } }
    const C = this.comps(m, w, hh); let keep = C.out.filter(c => c.a > w * hh * .02);
    if (kind === 'eye') keep = keep.sort((a, b) => b.a - a.a).slice(0, 1);
    else { const core = keep.filter(c => c.x0 > 0 && c.y0 > 0 && c.x1 < w - 1 && c.y1 < hh - 1).sort((a, b) => Math.hypot(a.cx - w / 2, a.cy - hh / 2) - Math.hypot(b.cx - w / 2, b.cy - hh / 2))[0] || keep.sort((a, b) => b.a - a.a)[0]; keep = core ? keep.filter(c => c === core || (c.x0 >= core.x0 - 2 && c.x1 <= core.x1 + 2 && c.y0 >= core.y0 - 2 && c.y1 <= core.y1 + 2)) : []; }
    if (!keep.length) return null;
    const ids = new Set(keep.map(c => c.id)); let mk = new Uint8Array(w * hh); for (let i = 0; i < w * hh; i++) mk[i] = ids.has(C.lab[i]) ? 1 : 0;
    // fecha buracos (íris dentro do branco) por linhas e colunas e engorda um pouco (cobre o contorno)
    for (let y = 0; y < hh; y++) { let a = -1, b = -1; for (let x = 0; x < w; x++) if (mk[y * w + x]) { if (a < 0) a = x; b = x; } for (let x = a; x >= 0 && x <= b; x++) mk[y * w + x] = 1; }
    for (let x = 0; x < w; x++) { let a = -1, b = -1; for (let y = 0; y < hh; y++) if (mk[y * w + x]) { if (a < 0) a = y; b = y; } for (let y = a; y >= 0 && y <= b; y++) mk[y * w + x] = 1; }
    if (kind === 'eye') { // íris/pupila e contorno encostados no branco também fazem parte do olho
      const dark = i => d[i * 4 + 3] > 150 && .3 * d[i * 4] + .59 * d[i * 4 + 1] + .11 * d[i * 4 + 2] < 120;
      for (let pass = 0; pass < Math.round(w * .18); pass++) { const add = []; for (let i = 0; i < w * hh; i++) { if (mk[i] || !dark(i)) continue; const x = i % w; if ((x > 0 && mk[i - 1]) || (x < w - 1 && mk[i + 1]) || mk[i - w] || mk[i + w]) add.push(i); } if (!add.length) break; add.forEach(i => mk[i] = 1); }
      for (let y = 0; y < hh; y++) { let a = -1, b = -1; for (let x = 0; x < w; x++) if (mk[y * w + x]) { if (a < 0) a = x; b = x; } for (let x = a; x >= 0 && x <= b; x++) mk[y * w + x] = 1; }
    }
    const r = Math.max(2, Math.round(Math.min(w, hh) * (kind === 'eye' ? .05 : .08))); const out = new Uint8Array(w * hh);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { if (!mk[y * w + x]) continue; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < hh && dx * dx + dy * dy <= r * r) out[Y * w + X] = 1; } }
    let bx0 = w, by0 = hh, bx1 = 0, by1 = 0; for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) if (out[y * w + x]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    return { x0, y0, w, h: hh, m: out, bb: [bx0, by0, bx1, by1] };
  },
  // cria os desenhos novos (a imagem original não muda)
  async buildFace(c, img, rig, body, F, o) {
    const W = img.naturalWidth, H = img.naturalHeight, src = document.createElement('canvas'); src.width = W; src.height = H; const sg = src.getContext('2d', { willReadFrequently: true }); sg.drawImage(img, 0, 0);
    // cor da pele: pixels claros e opacos logo em volta da máscara (bochecha/testa)
    const skinNear = (M) => { const d = sg.getImageData(M.x0, M.y0, M.w, M.h).data, pts = [];
      for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) { const i = y * M.w + x; if (M.m[i]) continue; let near = false; for (const [dx, dy] of [[0, 3], [0, -3], [3, 0], [-3, 0], [0, 6], [0, -6]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < M.w && Y < M.h && M.m[Y * M.w + X]) near = true; } if (!near) continue;
        const q = i * 4, L = .3 * d[q] + .59 * d[q + 1] + .11 * d[q + 2]; if (d[q + 3] > 220 && L > 110 && !(d[q] > 225 && d[q + 1] > 225 && d[q + 2] > 225)) pts.push([d[q], d[q + 1], d[q + 2], L]); }
      if (!pts.length) return [235, 200, 200]; pts.sort((a, b) => a[3] - b[3]); const p = pts[Math.floor(pts.length * .6)]; return [p[0], p[1], p[2]]; };
    const inkOf = (M) => { const d = sg.getImageData(M.x0, M.y0, M.w, M.h).data; let best = [30, 20, 36], bl = 1e9; for (let i = 0; i < M.w * M.h; i += 3) { const q = i * 4, L = .3 * d[q] + .59 * d[q + 1] + .11 * d[q + 2]; if (d[q + 3] > 200 && L < bl) { bl = L; best = [d[q], d[q + 1], d[q + 2]]; } } return `rgb(${best})`; };
    const fallback = (box) => { const w = Math.ceil(box[2] - box[0]), hh = Math.ceil(box[3] - box[1]), m = new Uint8Array(w * hh); for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const u = (x - w / 2) / (w / 2), v = (y - hh / 2) / (hh / 2); m[y * w + x] = u * u + v * v <= 1 ? 1 : 0; } return { x0: Math.floor(box[0]), y0: Math.floor(box[1]), w, h: hh, m, bb: [0, 0, w - 1, hh - 1] }; };
    const paint = (g, M, ox, oy, col, rows) => { const im = g.createImageData(M.w, M.h); for (let y = 0; y < M.h; y++) { if (rows && (y < rows[0] || y > rows[1])) continue; for (let x = 0; x < M.w; x++) { const i = y * M.w + x; if (!M.m[i]) continue; im.data[i * 4] = col[0]; im.data[i * 4 + 1] = col[1]; im.data[i * 4 + 2] = col[2]; im.data[i * 4 + 3] = 255; } } const t = document.createElement('canvas'); t.width = M.w; t.height = M.h; t.getContext('2d').putImageData(im, 0, 0); g.save(); g.filter = 'blur(0.6px)'; g.drawImage(t, ox, oy); g.restore(); };
    const save = async (cv, name) => { const blob = await new Promise(r => cv.toBlob(r, 'image/png')); const rt = await Assets.addBlob(blob, `${(c.name || 'personagem').replace(/\.[^.]+$/, '')} — ${name}.png`, App.project.id, 'image'); App.project.bin.push(rt.meta.id); return rt.meta.id; };
    const empty = nm => ({ asset: null, name: nm, ox: 0, oy: 0, w: 1, h: 1 });
    if (o.eyes && F.eyeL) {
      const Ms = [F.eyeL, F.eyeR].filter(Boolean).map(b => this.maskIn(sg, W, H, b, 'eye') || fallback(b));
      const U = [Math.min(...Ms.map(M => M.x0)), Math.min(...Ms.map(M => M.y0)), Math.max(...Ms.map(M => M.x0 + M.w)), Math.max(...Ms.map(M => M.y0 + M.h))];
      const mk = async (half, name) => { const cv = document.createElement('canvas'); cv.width = U[2] - U[0]; cv.height = U[3] - U[1]; const g = cv.getContext('2d');
        for (const M of Ms) { const sk = skinNear(M), ink = inkOf(M), [bx0, by0, bx1, by1] = M.bb, bw = bx1 - bx0, bh = by1 - by0, ox = M.x0 - U[0], oy = M.y0 - U[1], cut = by0 + bh * (half ? .5 : 1.01);
          paint(g, M, ox, oy, sk, [0, Math.round(cut)]);
          g.strokeStyle = ink; g.lineCap = 'round'; g.lineWidth = Math.max(2, bh * .13); g.beginPath(); const ly = oy + (half ? cut : by0 + bh * .62);
          g.moveTo(ox + bx0 + bw * .06, ly - bh * (half ? 0 : .06)); g.quadraticCurveTo(ox + bx0 + bw / 2, ly + bh * (half ? .05 : .16), ox + bx1 - bw * .06, ly - bh * (half ? 0 : .06)); g.stroke(); }
        return { asset: await save(cv, name), name, ox: -(U[2] - U[0]) / 2, oy: -(U[3] - U[1]) / 2, w: cv.width, h: cv.height }; };
      const ex = (U[0] + U[2]) / 2, eyy = (U[1] + U[3]) / 2;
      if (o.eyesInto) { const n = o.eyesInto, d = await mk(true, 'meio fechados'); d.ox += ex - n.px; d.oy += eyy - n.py; n.drawings.splice(1, 0, d); }
      else { const n = Rig.newNode({ name: 'Olhos', role: 'olho', parent: body.id, px: ex, py: eyy, z: 20 });
        n.drawings = [empty('abertos (do desenho)'), await mk(true, 'meio fechados'), await mk(false, 'fechados')]; rig.nodes.push(n); }
    }
    if (o.mouth && F.mouth) {
      const b0 = F.mouth, cxm = (b0[0] + b0[2]) / 2, cym = (b0[1] + b0[3]) / 2, bw0 = b0[2] - b0[0], bh0 = b0[3] - b0[1];
      const M = this.maskIn(sg, W, H, [cxm - bw0 * .7, cym - bh0 * .8, cxm + bw0 * .7, cym + bh0 * .8], 'mouth') || fallback(b0), sk = skinNear(M), ink = inkOf(M);
      const [mx0, my0, mx1, my1] = M.bb, mw = mx1 - mx0 + 1, mh = my1 - my0 + 1, cx = M.x0 + mx0 + mw / 2, cy = M.y0 + my0 + mh / 2;
      // a boca original (só os pixels da máscara)
      const mo = document.createElement('canvas'); mo.width = mw; mo.height = mh; { const g = mo.getContext('2d'), sd = sg.getImageData(M.x0 + mx0, M.y0 + my0, mw, mh); for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) if (!M.m[(y + my0) * M.w + x + mx0]) sd.data[(y * mw + x) * 4 + 3] = 0; g.putImageData(sd, 0, 0); }
      const make = async (sx, sy, name, line) => { const W2 = Math.ceil(mw * Math.max(1, sx)) + 4, H2 = Math.ceil(mh * Math.max(1, sy)) + 4, cv = document.createElement('canvas'); cv.width = W2; cv.height = H2; const g = cv.getContext('2d');
        paint(g, M, W2 / 2 - (mx0 + mw / 2), H2 / 2 - (my0 + mh / 2), sk);
        if (line) { g.strokeStyle = ink; g.lineCap = 'round'; g.lineWidth = Math.max(2, mh * .12); g.beginPath(); g.moveTo(W2 / 2 - mw * .32, H2 / 2 - mh * .02); g.quadraticCurveTo(W2 / 2, H2 / 2 + mh * .14, W2 / 2 + mw * .32, H2 / 2 - mh * .02); g.stroke(); }
        else g.drawImage(mo, W2 / 2 - mw * sx / 2, H2 / 2 - mh * sy / 2, mw * sx, mh * sy);
        return { asset: await save(cv, 'boca ' + name), name, ox: -W2 / 2, oy: -H2 / 2, w: W2, h: H2 }; };
      if (o.mouthInto) { const n = o.mouthInto, add = async (...a) => { const d = await make(...a); d.ox += cx - n.px; d.oy += cy - n.py; return d; };
        const fe = n.drawings.find(d => /fech/i.test(d.name)) || n.drawings[0], ab = n.drawings.find(d => !d.asset) || empty('aberta (do desenho)');
        n.drawings = [fe, await add(.96, .55, 'meio'), ab, await add(1.1, 1.4, 'grande')]; n.d = 0; }
      else { const n = Rig.newNode({ name: 'Boca', role: 'boca', parent: body.id, px: cx, py: cy, z: 21 });
        n.drawings = [await make(1, 1, 'fechada', true), await make(.96, .55, 'meio'), empty('aberta (do desenho)'), await make(1.1, 1.4, 'grande')]; n.d = 0; rig.nodes.push(n); }
    }
  },

  /* ---------- trazer um boneco com ossos para a cena ---------- */
  async addRigModal() {
    const recs = (await DB.all('projects')).filter(p => p.kind === 'anim' && JSON.parse(p.data).rigs?.length).sort((a, b) => b.modified - a.modified);
    const body = h(`<div><button class="lbtn" data-a="montar"><span class="lb-prev">${ic('layers', 18)}</span><span><b>Montar agora (partes + modelo)</b><small>Partes separadas + o desenho inteiro: liga os ossos sozinho</small></span></button>
      ${recs.length ? `<div class="lgroup">Do Estúdio de Animação</div>${recs.map(r => `<button class="lbtn" data-p="${r.id}"><span class="lb-prev" style="${r.thumb ? `background:center/cover url('${r.thumb}')` : ''}">${r.thumb ? '' : ic('film', 16)}</span><span><b>${esc(r.name)}</b><small>${fmtDate(r.modified)}</small></span></button>`).join('')}` : ''}</div>`);
    const v = await UI.modal({ title: 'Personagem com ossos', icon: 'layers', width: 460, body, buttons: [], onOpen: a => { $('[data-a=montar]', body).onclick = () => a.close('montar'); $$('[data-p]', body).forEach(b => b.onclick = () => a.close('p:' + b.dataset.p)); } });
    if (v === 'montar') return this.montarHere();
    if (v && v.startsWith('p:')) return this.importStudio(v.slice(2));
  },
  async importStudio(id) {
    const rec = await DB.get('projects', id); if (!rec) return; const b = UI.busy('Trazendo o personagem…', '<div class="spinner"></div>');
    try {
      let text = rec.data; const recs = await DB.byIndex('assets', 'project', id);
      for (const r of recs) { if (!text.includes(r.id)) continue; const nid = uid('a_'); text = text.split(r.id).join(nid); await DB.put('assets', { ...r, id: nid, projectId: App.project.id }); }
      await Assets.loadProjectAssets(App.project.id);
      const S = JSON.parse(text), A = { settings: S.settings, frames: S.frames, rigs: S.rigs, camera: S.camera || { keys: {} }, rev: 1 };
      this.insert(A, S.name); b.close();
    } catch (e) { b.close(); UI.toast(esc(e.message || e), { kind: 'err' }); }
  },
  async montarHere() {
    const ref = await pickFiles('image/*', false); if (!ref.length) return; UI.toast('Agora escolha as PARTES separadas (pode ser uma folha só).', { time: 3000 });
    const parts = await pickFiles('image/*', true); if (!parts.length) return;
    const b = UI.busy('Montando o boneco…', '<div class="spinner"></div><p style="text-align:center" data-s></p>');
    try {
      const rig = await Montar.build(App.project.id, ref[0], parts, t => { const s = b.body && $('[data-s]', b.body); if (s) s.textContent = t; });
      rig.name = ref[0].name.replace(/\.[^.]+$/, '').slice(0, 30); rig.stage = { X: 0, Y: (rig.oy ?? rig.h) - rig.h / 2, S: 1, F: 1, O: 100 };
      rig.poses.neutra = { data: Object.fromEntries(rig.nodes.map(x => [x.id, { r: 0, d: x.d || 0 }])), tag: 'neutra' };
      this.insert({ settings: { w: rig.w, h: rig.h, fps: App.fps, bg: '#000000' }, frames: Math.round(App.fps * 5), rigs: [rig], camera: { keys: {} }, rev: 1 }, rig.name); b.close();
    } catch (e) { b.close(); UI.modal({ title: 'Não consegui montar', icon: 'alert', kind: 'danger', body: `<p>${esc(e.message || e)}</p>`, buttons: [{ label: 'Ok', kind: 'primary' }] }); }
  },
  insert(A, name) {
    const dur = Math.max(1, Math.min(A.frames / A.settings.fps, 30)), c = App.makeClip('anim', { start: App.frame(App.t), dur: App.frame(dur), name: (name || 'Personagem') + ' (ossos)' });
    c.anim = { P: A, transparent: true }; A.frames = Math.max(A.frames, Math.ceil(dur * A.settings.fps) + 2);
    Actions.place(c); App.select(c.id); Props.tab = 'rig'; App.commit('Personagem com ossos na cena', { toast: true });
  },
  // texto para a IA: bonecos na cena, partes e desenhos
  forPrompt() {
    const out = [];
    for (const c of App.project.clips.filter(x => x.type === 'anim')) { const rig = this.rig(c); if (!rig) continue;
      out.push(`• clipe ${c.id} "${c.name || ''}" ${round(c.start, 2)}s–${round(c.start + c.dur, 2)}s — partes: ${rig.nodes.map(n => `"${n.name}"(${n.role}${n.drawings.length > 1 ? ': ' + n.drawings.map((d, i) => i + '=' + this.dname(d, i)).join('/') : ''})`).join(', ')}${Object.keys(rig.poses || {}).length ? ' · poses: ' + Object.keys(rig.poses).join(', ') : ''}${Acting.pupils(rig).length ? ' · tem PUPILAS (use boneco_olhar)' : ''}`); }
    const imgs = App.project.clips.filter(x => x.type === 'image' && /^(P\d|pose|personagem|png)/i.test(x.name || Assets.meta(x.assetId)?.name || '')).slice(0, 12).map(x => x.id);
    return (out.length ? 'PERSONAGENS EDITÁVEIS / COM OSSOS (use as ações boneco_*):\n' + out.join('\n') : '') + (imgs.length ? `\nImagens de personagem que podem virar "personagem editável": ${imgs.join(', ')}` : '');
  },
  // ações da IA
  aiAction(a, c) {
    const rig = this.rig(c); if (!rig) return false; const A = this.A(c);
    const byName = s => { s = String(s || '').toLowerCase(); return rig.nodes.find(n => n.name.toLowerCase() === s) || rig.nodes.find(n => n.role === s) || rig.nodes.find(n => n.name.toLowerCase().includes(s)); };
    const fAt = t => clamp(Math.round(((+t - c.start) * (c.speed || 1) + (c.offset || 0)) * A.settings.fps), 0, A.frames - 1);
    const t0 = isFinite(+a.inicio) ? +a.inicio : App.t, f = fAt(t0), dur = isFinite(+a.duracao) ? +a.duracao : 0;
    const pick = (n, v) => { if (!n) return; let i = isFinite(+v) ? +v : n.drawings.findIndex(d => this.dname(d, 0).toLowerCase().includes(String(v).toLowerCase())); if (i < 0 || i >= n.drawings.length) return; const save = App.t; App.t = this.timeOfFrame(c, f); this.react(c, n, i, dur); App.t = save; };
    if (a.tipo === 'boneco_reacao') {
      if (a.expressao !== undefined) pick(rig.nodes.find(n => n.role === 'cabeca' && n.drawings.length > 1) || rig.nodes.find(n => n.role === 'inteiro' && n.drawings.length > 1), a.expressao);
      if (a.olhos !== undefined) pick(rig.nodes.find(n => n.role === 'olho' && n.drawings.length > 1), a.olhos);
      if (a.boca !== undefined) pick(rig.nodes.find(n => n.role === 'boca' && n.drawings.length > 1), a.boca);
      if (a.pose && rig.poses?.[a.pose]) Acting.poseTo(rig, rig.poses[a.pose].data, f + 3, { trans: 4, ant: .15, lag: { braco: 1, mao: 2 } });
    } else if (a.tipo === 'boneco_girar') { const n = byName(a.parte); if (!n || !isFinite(+a.graus)) return false; Acting.poseTo(rig, { [n.id]: { r: +a.graus } }, f, { trans: +a.transicao || 5 }); }
    else if (a.tipo === 'boneco_olhar') { if (!Acting.look(rig, f, a.olhar || 'centro', { hold: dur ? Math.round(dur * A.settings.fps) : 0 })) return false; }
    else if (a.tipo === 'boneco_atuar') this.act(c, 'all', { silent: true, intensidade: a.intensidade });
    this.touch(c); return true;
  },
};
if (typeof Props !== 'undefined') Props.tabRig = function (body, c) { RigEdit.panel(this, body, c); };
