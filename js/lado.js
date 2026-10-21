/* ===================== lado.js — painel da direita =====================
   No quadro: os personagens que aparecem NESTE quadro e os botões das sessões deles (olhos, boca, poses…): clicou, virou chave.
   Propriedades: posição, giro, tamanho, transparência, quando aparece; texto; câmera; o projeto.
   Efeitos: o visual (cor) com 1 clique e efeitos de tela. Voz: áudios, legendas pela transcrição e boca pela voz. */
'use strict';
const Lado = {
  atual: 'quadro', parteSel: null,
  aba(a) { this.atual = a; $$('#lado-abas [data-aba]').forEach(b => b.classList.toggle('on', b.dataset.aba === a)); this.pinta(); },
  pinta() {
    if (!App.P) return; const el = $('#lado'); if (!el) return;
    const fn = { quadro: 'quadro', props: 'props', efeitos: 'efeitos', som: 'som' }[this.atual];
    const rolagem = el.scrollTop; el.innerHTML = ''; this[fn](el); el.scrollTop = rolagem;
  },
  // personagem em foco: o selecionado, ou o 1º do quadro
  foco() { const P = App.P, s = App.noSel(), lista = Modelo.noQuadro(P, App.q); return s?.tipo === 'personagem' && lista.includes(s) ? s : lista.length === 1 ? lista[0] : s?.tipo === 'personagem' ? s : null; },

  /* ---------- No quadro ---------- */
  quadro(el) {
    const P = App.P, q = App.q, lista = Modelo.noQuadro(P, q), f = this.foco();
    if (!lista.length) { el.innerHTML = `<div class="vazio">Nenhum personagem aparece no quadro ${q + 1}.<br><br><button class="btn" data-add>${ic('plus', 14)} Pôr um personagem</button></div>`; $('[data-add]', el).onclick = () => App.addPersonagem(); return; }
    const cards = h('<div class="cards"></div>');
    for (const n of lista) {
      const def = P.personagens[n.ref], c = h(`<div class="card-p ${f === n ? 'sel' : ''}"><div class="th" style="${def.thumb ? `background-image:url('${def.thumb}')` : ''}"></div><div><b>${esc(n.nome)}</b><small>${esc(def.nome)} · ${def.sessoes.length} sessões</small></div></div>`);
      c.onclick = () => App.selecionar(n.id); cards.appendChild(c);
    }
    el.appendChild(cards);
    if (!f) { el.appendChild(h('<div class="vazio">Clique num personagem para ver os botões dele.</div>')); return; }
    const def = P.personagens[f.ref], est = Modelo.estadoPersonagem(f, q), aqui = f.chaves[q] || {};
    if (!def.sessoes.length) el.appendChild(h(`<div class="vazio">${esc(def.nome)} ainda não tem sessões (olhos, boca, poses…).<br>Crie no <b>Ateliê de personagens</b>.</div>`));
    for (const s of def.sessoes) {
      const atual = est.sessoes[s.id] || null, temChave = aqui.sessoes && s.id in aqui.sessoes;
      const box = h(`<div class="sessao"><h4>${esc(s.nome)} <small>${s.presets.length}</small></h4><div class="presets"></div></div>`), pr = $('.presets', box);
      const bt = (id, nome) => { const b = h(`<button class="${atual === id ? 'on' : ''} ${atual === id && temChave ? 'chave' : ''}" title="${esc(nome)} no quadro ${q + 1}">${esc(nome)}</button>`); b.onclick = () => this.escolhe(f, s.id, id); pr.appendChild(b); };
      bt(null, 'Padrão'); s.presets.forEach(p => bt(p.id, p.nome)); el.appendChild(box);
    }
    // ajustar uma parte só neste trecho (quando uma pose precisa de um retoque)
    const partes = def.partes, ps = this.parteSel && partes.find(p => p.id === this.parteSel) ? this.parteSel : partes[0]?.id;
    if (partes.length) {
      const estP = Modelo.partesNoEstado(def, est), e = estP[ps] || {}, temAjuste = !!aqui.partes?.[ps];
      const box = h(`<div class="sessao"><h4>Ajustar uma parte <small>neste quadro</small></h4>
        <div class="campo2" style="margin-bottom:6px"><select data-p style="flex:1">${partes.map(p => `<option value="${p.id}" ${p.id === ps ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
        ${temAjuste ? `<button class="btn sm" data-limpa title="Volta ao que a sessão/pose define">Desfazer ajuste</button>` : ''}</div><div class="props" style="padding:0"></div></div>`);
      const pp = $('.props', box), parte = partes.find(p => p.id === ps);
      $('[data-p]', box).onchange = ev => { this.parteSel = ev.target.value; this.pinta(); };
      if ($('[data-limpa]', box)) $('[data-limpa]', box).onclick = () => { delete aqui.partes[ps]; if (!Object.keys(aqui.partes).length) delete aqui.partes; App.commit('Desfazer ajuste'); };
      const muda = (c, v) => { const k = Modelo.chave(f, q); k.partes = k.partes || {}; k.partes[ps] = { ...(k.partes[ps] || {}), [c]: v }; App.pinta(); };
      for (const [c, nome, min, max, passo] of [['x', 'Mover X', -400, 400, 1], ['y', 'Mover Y', -400, 400, 1], ['r', 'Girar', -180, 180, 1], ['s', 'Tamanho', .2, 3, .01]]) pp.appendChild(this.campo(nome, e[c] ?? (c === 's' ? 1 : 0), min, max, passo, v => muda(c, v), () => App.commit('Ajustar ' + parte.nome)));
      if (parte?.imgs.length > 1) { const sel = h(`<label class="campo"><span>Imagem</span><select style="grid-column:span 2">${parte.imgs.map(i => `<option value="${i.id}" ${i.id === e.img ? 'selected' : ''}>${esc(i.nome)}</option>`).join('')}</select></label>`); $('select', sel).onchange = ev => { muda('img', ev.target.value); App.commit('Trocar imagem'); }; pp.appendChild(sel); }
      el.appendChild(box);
    }
    const ac = h(`<div class="sessao"><div class="campo2"><button class="btn sm" data-boca>${ic('mic', 13)} Boca pela voz</button><button class="btn sm" data-ia>${ic('sparkles', 13)} Animar com a IA</button><button class="btn sm" data-at>${ic('edit', 13)} Editar personagem</button></div></div>`);
    $('[data-boca]', ac).onclick = () => Som.bocaPelaVoz(f); $('[data-ia]', ac).onclick = () => IA.abrir(f); $('[data-at]', ac).onclick = () => Atelie.abrir(def.id, { volta: true });
    el.appendChild(ac);
  },
  escolhe(n, sessao, preset) {
    const k = Modelo.chave(n, App.q); k.sessoes = { ...(k.sessoes || {}), [sessao]: preset };
    App.commit('Pose no quadro ' + (App.q + 1), { semArvore: true });
  },

  /* ---------- Propriedades ---------- */
  campo(nome, v, min, max, passo, aoMudar, aoSoltar) {
    const r = h(`<label class="campo"><span>${esc(nome)}</span><input type="range" min="${min}" max="${max}" step="${passo}" value="${v}"><input type="number" step="${passo}" value="${round(v, 3)}"></label>`);
    const [rg, nb] = $$('input', r); rg.oninput = () => { nb.value = rg.value; aoMudar(+rg.value); }; rg.onchange = () => aoSoltar?.();
    nb.onchange = () => { rg.value = nb.value; aoMudar(+nb.value); aoSoltar?.(); }; return r;
  },
  props(el) {
    const P = App.P, q = App.q, n = App.noSel(), box = h('<div class="props"></div>'); el.appendChild(box);
    if (App.sel === 'camera') {
      box.appendChild(h(`<div class="titulo-p">Câmera no quadro ${q + 1}</div>`));
      const c = Modelo.camera(P, q), muda = (k, v) => { P.camera.chaves[q] = { ...c, ...(P.camera.chaves[q] || {}), [k]: v }; App.pinta(); };
      box.appendChild(this.campo('X', c.x, -P.w, P.w * 2, 1, v => muda('x', v), () => App.commit('Câmera')));
      box.appendChild(this.campo('Y', c.y, -P.h, P.h * 2, 1, v => muda('y', v), () => App.commit('Câmera')));
      box.appendChild(this.campo('Zoom', c.zoom, .2, 6, .01, v => muda('zoom', v), () => App.commit('Zoom da câmera')));
      box.appendChild(this.campo('Girar', c.r, -45, 45, .5, v => muda('r', v), () => App.commit('Câmera')));
      box.appendChild(h('<div class="dica" style="position:static">Arraste no palco com a ferramenta Câmera (C) para mover. Cada mudança vira chave neste quadro.</div>'));
    } else if (n) {
      const t = Modelo.transf(n, q), muda = (k, v) => { Modelo.poeTransf(n, q, { [k]: v }); App.pinta(); }, sol = () => App.commit('Propriedade', { semArvore: true });
      box.appendChild(h(`<div class="titulo-p">${esc(n.nome)} · quadro ${q + 1}${n.chaves[q] ? ' ◆' : ''}</div>`));
      box.appendChild(this.campo('X', t.x, -P.w, P.w * 2, 1, v => muda('x', v), sol)); box.appendChild(this.campo('Y', t.y, -P.h, P.h * 2, 1, v => muda('y', v), sol));
      box.appendChild(this.campo('Girar', t.r, -360, 360, .5, v => muda('r', v), sol)); box.appendChild(this.campo('Tamanho', t.s, .02, 5, .01, v => muda('s', v), sol));
      box.appendChild(this.campo('Opacidade', t.op, 0, 1, .01, v => muda('op', v), sol));
      const o = h(`<div class="campo2"><label class="chk"><input type="checkbox" data-sx ${t.sx < 0 ? 'checked' : ''}> Espelhar</label><label class="chk" title="Liga: o movimento anda sozinho entre as chaves. Desliga: segura até a próxima chave (quadro a quadro)."><input type="checkbox" data-it ${n.interp ? 'checked' : ''}> Intercalar movimento</label></div>`);
      $('[data-sx]', o).onchange = ev => { Modelo.poeTransf(n, q, { sx: ev.target.checked ? -1 : 1 }); App.commit('Espelhar'); };
      $('[data-it]', o).onchange = ev => { n.interp = ev.target.checked; App.commit('Movimento'); }; box.appendChild(o);
      const tm = h(`<div class="campo2"><span style="color:var(--tx2)">Aparece do quadro</span><input type="number" min="1" value="${(n.de || 0) + 1}" data-de style="width:60px"><span style="color:var(--tx2)">até</span><input type="number" min="1" value="${n.ate == null ? '' : n.ate + 1}" placeholder="fim" data-ate style="width:60px"></div>`);
      $('[data-de]', tm).onchange = ev => { n.de = clamp(+ev.target.value - 1, 0, P.duracao - 1); App.commit('Começo'); }; $('[data-ate]', tm).onchange = ev => { n.ate = ev.target.value === '' ? null : Math.max(n.de || 0, +ev.target.value - 1); App.commit('Fim'); };
      box.appendChild(tm);
      if (n.tipo === 'texto') {
        box.appendChild(h('<div class="titulo-p">Texto</div>'));
        const tx = h(`<textarea rows="3" style="width:100%">${esc(n.texto)}</textarea>`); tx.oninput = () => { n.texto = tx.value; App.pinta(); }; tx.onchange = () => App.commit('Texto'); box.appendChild(tx);
        const ct = h(`<div class="campo2"><input type="color" value="${n.cor}" data-c title="Cor"><input type="color" value="${n.borda}" data-b title="Cor da borda"><input type="number" value="${n.tam}" min="8" max="600" data-t style="width:64px" title="Tamanho"><input type="number" value="${n.bordaL}" min="0" max="60" data-bl style="width:52px" title="Grossura da borda"><label class="chk"><input type="checkbox" data-n ${n.negrito ? 'checked' : ''}> Negrito</label></div>`);
        $('[data-c]', ct).oninput = ev => { n.cor = ev.target.value; App.pinta(); }; $('[data-b]', ct).oninput = ev => { n.borda = ev.target.value; App.pinta(); };
        $('[data-t]', ct).onchange = ev => { n.tam = +ev.target.value; App.commit('Texto'); }; $('[data-bl]', ct).onchange = ev => { n.bordaL = +ev.target.value; App.commit('Texto'); };
        $('[data-n]', ct).onchange = ev => { n.negrito = ev.target.checked; App.commit('Texto'); };
        ct.addEventListener('change', () => App.commit('Texto')); box.appendChild(ct);
      }
    } else box.appendChild(h('<div class="vazio">Escolha uma camada no palco, na hierarquia ou na timeline.</div>'));
    // projeto
    const pj = h(`<div class="props" style="border-top:1px solid var(--bd)"><div class="titulo-p">Projeto</div>
      <label class="field">Nome<input type="text" value="${esc(P.nome)}" data-nm></label>
      <div class="campo2"><span style="color:var(--tx2)">Tamanho</span><input type="number" value="${P.w}" data-w style="width:70px"> × <input type="number" value="${P.h}" data-h style="width:70px"></div>
      <div class="campo2"><span style="color:var(--tx2)">Fundo</span><input type="color" value="${P.fundo}" data-f></div></div>`);
    $('[data-nm]', pj).onchange = ev => { P.nome = ev.target.value.trim() || P.nome; $('#proj-nome').textContent = P.nome; App.titulo(); App.commit('Nome'); };
    $('[data-w]', pj).onchange = ev => { P.w = clamp(+ev.target.value, 64, 4096); App.commit('Tamanho'); App.enquadrar(); }; $('[data-h]', pj).onchange = ev => { P.h = clamp(+ev.target.value, 64, 4096); App.commit('Tamanho'); App.enquadrar(); };
    $('[data-f]', pj).oninput = ev => { P.fundo = ev.target.value; App.pinta(); }; $('[data-f]', pj).onchange = () => App.commit('Fundo');
    el.appendChild(pj);
  },
  editarTexto(n) { App.selecionar(n.id); this.aba('props'); setTimeout(() => $('#lado textarea')?.focus(), 30); },

  /* ---------- Efeitos (1 clique) ---------- */
  efeitos(el) {
    const P = App.P, q = App.q;
    el.appendChild(h('<div class="p-cab" style="border:0"><h3>Visual (cor do vídeo todo)</h3></div>'));
    const g = h('<div class="visuais"></div>');
    for (const v of Efeitos.VISUAIS) { const b = h(`<div class="visual ${P.efeitos.visual === v.id ? 'on' : ''}" title="${esc(v.nome)}"><i style="background:linear-gradient(135deg,${v.cor[0]},${v.cor[1]});filter:${v.f || 'none'}"></i>${esc(v.nome)}</div>`); b.onclick = () => { P.efeitos.visual = v.id; App.commit('Visual ' + v.nome); }; g.appendChild(b); }
    el.appendChild(g);
    el.appendChild(h(`<div class="p-cab" style="border:0"><h3>Efeitos de tela</h3><span class="sp"></span><small style="color:var(--tx3)">a partir do quadro ${q + 1}</small></div>`));
    const t = h('<div class="efeitos-t"></div>');
    for (const ef of Efeitos.TELA) {
      const ativo = Efeitos.ativos(P, q).find(e => e.tipo === ef.id);
      const b = h(`<div class="ef ${ativo ? 'on' : ''}" title="${ativo ? 'Ligado neste quadro (clique para tirar)' : 'Clique para ligar a partir deste quadro'}">${ic(ef.ic, 14)}${esc(ef.nome)}</div>`);
      b.onclick = () => {
        if (ativo) { P.efeitos.tela = P.efeitos.tela.filter(e => e !== ativo); return App.commit('Tirar ' + ef.nome); }
        const dur = ef.id === 'flash' ? Math.round(P.fps / 3) : ef.id === 'tremor' ? Math.round(P.fps * .7) : P.fps * 2;
        const novo = { id: uid('ef'), tipo: ef.id, de: q, ate: Math.min(P.duracao - 1, q + dur), forca: ef.forca }; P.efeitos.tela.push(novo); App.sel = novo.id; App.commit(ef.nome);
      };
      t.appendChild(b);
    }
    el.appendChild(t);
    const lista = P.efeitos.tela; if (!lista.length) return;
    el.appendChild(h('<div class="p-cab" style="border:0"><h3>Ligados</h3></div>'));
    for (const e of lista) {
      const nm = Efeitos.TELA.find(t => t.id === e.tipo)?.nome || e.tipo, box = h(`<div class="sessao" style="${App.sel === e.id ? 'background:var(--bg2)' : ''}"><h4>${esc(nm)} <small>quadros ${e.de + 1}–${e.ate + 1}</small><span class="sp"></span><button class="ibtn" data-x title="Tirar">${ic('trash', 13)}</button></h4><div class="props" style="padding:0"></div></div>`);
      $('.props', box).appendChild(this.campo('Força', e.forca, 0, 1, .01, v => { e.forca = v; App.pinta(); }, () => App.commit('Força')));
      const tm = h(`<div class="campo2"><span style="color:var(--tx2)">De</span><input type="number" value="${e.de + 1}" data-de style="width:58px"><span style="color:var(--tx2)">até</span><input type="number" value="${e.ate + 1}" data-ate style="width:58px"></div>`);
      $('[data-de]', tm).onchange = ev => { e.de = clamp(+ev.target.value - 1, 0, e.ate); App.commit('Efeito'); }; $('[data-ate]', tm).onchange = ev => { e.ate = clamp(+ev.target.value - 1, e.de, P.duracao - 1); App.commit('Efeito'); };
      $('.props', box).appendChild(tm); $('[data-x]', box).onclick = () => { P.efeitos.tela = P.efeitos.tela.filter(x => x !== e); App.commit('Tirar efeito'); };
      el.appendChild(box);
    }
  },

  /* ---------- Voz e legendas ---------- */
  som(el) {
    const P = App.P;
    const top = h(`<div class="sessao"><h4>Voz e sons</h4><div class="campo2"><button class="btn sm" data-add>${ic('upload', 13)} Pôr áudio</button>${P.audios.length ? `<button class="btn sm" data-tr>${ic('text', 13)} Transcrever para legendas</button>` : ''}</div></div>`);
    $('[data-add]', top).onclick = () => Som.importar(); if ($('[data-tr]', top)) $('[data-tr]', top).onclick = () => Som.transcrever();
    el.appendChild(top);
    for (const a of P.audios) {
      const b = h(`<div class="sessao" style="${App.sel === a.id ? 'background:var(--bg2)' : ''}"><h4>${ic('mic', 12)} ${esc(a.nome)}<span class="sp"></span><button class="ibtn" data-x title="Tirar">${ic('trash', 13)}</button></h4>
        <div class="campo2" style="margin-bottom:4px"><span style="color:var(--tx2)">Começa no quadro</span><input type="number" min="1" value="${(a.de || 0) + 1}" style="width:64px" data-de></div><div class="props" style="padding:0"></div></div>`);
      $('.props', b).appendChild(this.campo('Volume', a.vol ?? 1, 0, 2, .01, v => { a.vol = v; Folha.desenha(); }, () => App.commit('Volume')));
      $('[data-de]', b).onchange = ev => { a.de = Math.max(0, +ev.target.value - 1); App.commit('Áudio'); };
      $('[data-x]', b).onclick = () => { P.audios = P.audios.filter(x => x !== a); App.commit('Tirar áudio'); };
      el.appendChild(b);
    }
    const lg = h(`<div class="sessao"><h4>Legendas <small>${P.legendas.length}</small><span class="sp"></span>${P.legendas.length ? `<button class="btn sm" data-lmp>Apagar todas</button>` : ''}<button class="btn sm" data-nova>+ Nova</button></h4><div class="lg" style="display:grid;gap:4px"></div></div>`);
    const box = $('.lg', lg);
    P.legendas.forEach((g, i) => {
      const r = h(`<div class="campo2" style="flex-wrap:nowrap"><input type="number" value="${g.de + 1}" style="width:54px" title="Começa"><input type="number" value="${g.ate + 1}" style="width:54px" title="Termina"><input type="text" value="${esc(g.texto)}" style="flex:1"><button class="ibtn" title="Ir até ela">${ic('jump', 13)}</button></div>`);
      const [a, b, t] = $$('input', r); a.onchange = () => { g.de = Math.max(0, +a.value - 1); App.commit('Legenda'); }; b.onchange = () => { g.ate = Math.max(g.de, +b.value - 1); App.commit('Legenda'); }; t.onchange = () => { g.texto = t.value; App.commit('Legenda'); };
      $('button', r).onclick = () => App.setQ(g.de); box.appendChild(r);
    });
    $('[data-nova]', lg).onclick = () => { P.legendas.push({ de: App.q, ate: Math.min(P.duracao - 1, App.q + P.fps * 2), texto: 'Legenda' }); App.commit('Legenda'); };
    if ($('[data-lmp]', lg)) $('[data-lmp]', lg).onclick = async () => { if (await UI.confirm({ title: 'Apagar todas as legendas?', ok: 'Apagar', danger: true })) { P.legendas = []; App.commit('Apagar legendas'); } };
    el.appendChild(lg);
  },
};
