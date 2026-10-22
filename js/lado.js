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
    const fn = { quadro: 'quadro', props: 'props', efeitos: 'efeitos', som: 'som', midia: 'midia' }[this.atual] || 'quadro';
    const rolagem = el.scrollTop; el.innerHTML = ''; this[fn](el); el.scrollTop = rolagem;
  },
  // personagem em foco: o selecionado, ou o 1º do quadro
  foco() { const P = App.P, s = App.noSel(), lista = Modelo.noQuadro(P, App.q); return s?.tipo === 'personagem' && lista.includes(s) ? s : lista.length === 1 ? lista[0] : s?.tipo === 'personagem' ? s : null; },

  midia(el) { Midia.pinta(el); },

  /* ---------- No quadro ---------- */
  quadro(el) {
    const P = App.P, q = App.q, lista = Modelo.noQuadro(P, q), f = this.foco();
    if (!lista.length) { el.innerHTML = `<div class="vazio">Nenhum personagem aparece no quadro ${q + 1}.<br><br><button class="btn" data-add>${ic('plus', 14)} Pôr um personagem</button></div>`; $('[data-add]', el).onclick = () => App.addPersonagem(); return; }
    const cards = h('<div class="cards"></div>');
    for (const n of lista) {
      const def = P.personagens[n.ref], c = h(`<div class="card-p ${f === n ? 'sel' : ''}"><div class="th" style="${def.thumb ? `background-image:url('${def.thumb}')` : ''}"></div><div><b>${esc(n.nome)}${def._local ? ` <span class="so-local" title="${def._local.todo ? 'Este personagem ainda não está na nuvem: só neste computador' : 'Tem mudanças salvas só neste computador (ainda não na nuvem)'}">${ic('cloudOff', 13)}</span>` : ''}</b><small>${esc(def.nome)} · ${def.sessoes.length} sessões${def._local ? ' · não está na nuvem' : ''}</small></div></div>`);
      c.onclick = () => App.selecionar(n.id); cards.appendChild(c);
    }
    el.appendChild(cards);
    if (!f) { el.appendChild(h('<div class="vazio">Clique num personagem para ver os botões dele.</div>')); return; }
    const def = P.personagens[f.ref], est = Modelo.estadoPersonagem(f, q), aqui = f.chaves[q] || {};
    if (!def.sessoes.length) el.appendChild(h(`<div class="vazio">${esc(def.nome)} ainda não tem sessões (olhos, boca, poses…).<br>Crie no <b>Ateliê de personagens</b>.</div>`));
    for (const s of def.sessoes) {
      const atual = est.sessoes[s.id] || null, temChave = aqui.sessoes && s.id in aqui.sessoes;
      const box = h(`<div class="sessao"><h4>${esc(s.nome)} <small>${s.presets.length}</small></h4><div class="presets"></div></div>`), pr = $('.presets', box);
      const loc = id => def._local && id && (def._local.todo || def._local.presets?.includes(id));
      const bt = (id, nome) => { const b = h(`<button class="${atual === id ? 'on' : ''} ${atual === id && temChave ? 'chave' : ''} ${loc(id) ? 'loc' : ''}" title="${esc(nome)} no quadro ${q + 1}${loc(id) ? ' · salvo só neste computador (não está na nuvem)' : ''}">${esc(nome)}${loc(id) ? ` <span class="so-local">${ic('cloudOff', 11)}</span>` : ''}</button>`); b.onclick = () => this.escolhe(f, s.id, atual === id && id ? null : id); pr.appendChild(b); };
      bt(null, 'Padrão'); s.presets.forEach(p => bt(p.id, p.nome)); el.appendChild(box);
    }
    // animações de teste do personagem (feitas no Ateliê): viram chaves a partir deste quadro
    if (def.animacoes?.length) { const box = h(`<div class="sessao"><h4>Animações <small>pôr a partir do quadro ${q + 1}</small></h4><div class="presets"></div></div>`), pr = $('.presets', box);
      for (const a of def.animacoes) { const b = h(`<button title="Escreve &quot;${esc(a.nome)}&quot; como chaves a partir deste quadro">${ic('play', 11)} ${esc(a.nome)}</button>`); b.onclick = () => Animacoes.porNoQuadro(f, def, a); pr.appendChild(b); }
      el.appendChild(box); }
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
    const ac = h(`<div class="sessao"><div class="campo2"><button class="btn sm" data-boca>${ic('mic', 13)} Boca pela voz</button><button class="btn sm ia" data-ia>${ic('sparkles', 13)} Animar com a IA</button><button class="btn sm" data-at>${ic('edit', 13)} Editar personagem</button></div></div>`);
    $('[data-boca]', ac).onclick = () => Som.bocaPelaVoz(f); $('[data-ia]', ac).onclick = () => IA.abrir(f); $('[data-at]', ac).onclick = () => Atelie.abrirAba(def.id);
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
    } else if (n?.tipo === 'efeito') { box.remove(); el.appendChild(this.camadaEfeito(n)); return;
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
      box.appendChild(this.tremulo(n));
      if (n.tipo === 'forma') {
        box.appendChild(h(`<div class="titulo-p">Forma${n.fundoPadrao ? ' · fundo padrão' : ''}</div>`));
        const fs = h(`<div class="presets">${[['ret', 'Retângulo'], ['elipse', 'Círculo'], ['tri', 'Triângulo'], ['estrela', 'Estrela']].map(([f, l]) => `<button data-f="${f}" class="${n.forma === f ? 'on' : ''}">${l}</button>`).join('')}</div>`);
        $$('[data-f]', fs).forEach(b => b.onclick = () => { n.forma = b.dataset.f; App.commit('Forma'); }); box.appendChild(fs);
        const sf = () => App.commit('Forma', { semArvore: true });
        box.appendChild(this.campo('Largura', n.w, 2, Math.max(4000, n.w), 1, v => { n.w = v; App.pinta(); }, sf));
        box.appendChild(this.campo('Altura', n.h, 2, Math.max(4000, n.h), 1, v => { n.h = v; App.pinta(); }, sf));
        if (n.forma === 'ret') box.appendChild(this.campo('Cantos', n.raio || 0, 0, 400, 1, v => { n.raio = v; App.pinta(); }, sf));
        const ct = h(`<div class="campo2"><span style="color:var(--tx2)">Cor</span><input type="color" value="${n.cor}" data-c><span style="color:var(--tx2)">Borda</span><input type="color" value="${n.borda}" data-b><input type="number" value="${n.bordaL}" min="0" max="80" data-bl style="width:52px" title="Grossura da borda"></div>`);
        $('[data-c]', ct).oninput = ev => { n.cor = ev.target.value; App.pinta(); }; $('[data-b]', ct).oninput = ev => { n.borda = ev.target.value; App.pinta(); };
        $('[data-bl]', ct).onchange = ev => { n.bordaL = clamp(+ev.target.value, 0, 80); App.commit('Borda'); }; ct.addEventListener('change', sf); box.appendChild(ct);
        if (n.fundoPadrao) { const bt = h(`<button class="btn sm">${ic('camera', 13)} Do tamanho da câmera</button>`); bt.onclick = () => { n.w = App.P.w; n.h = App.P.h; Modelo.poeTransf(n, App.q, { x: App.P.w / 2, y: App.P.h / 2, r: 0, s: 1 }); App.commit('Fundo do tamanho da câmera'); }; box.appendChild(bt); }
      }
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
      <div class="campo2"><span style="color:var(--tx2)">Tamanho</span><input type="number" value="${P.w}" data-w style="width:70px"> × <input type="number" value="${P.h}" data-h style="width:70px"></div></div>`);
    $('[data-nm]', pj).onchange = ev => { P.nome = ev.target.value.trim() || P.nome; $('#proj-nome').textContent = P.nome; App.titulo(); App.commit('Nome'); };
    $('[data-w]', pj).onchange = ev => { P.w = clamp(+ev.target.value, 64, 4096); App.commit('Tamanho'); App.enquadrar(); }; $('[data-h]', pj).onchange = ev => { P.h = clamp(+ev.target.value, 64, 4096); App.commit('Tamanho'); App.enquadrar(); };
    el.appendChild(pj);
    // fundo onde não tem nada (canvas infinito): quadriculado ou cor lisa. Aparece na Cena, na Câmera e no vídeo
    const fp = App.fundoPalco(), pa = h(`<div class="props" style="border-top:1px solid var(--bd)"><div class="titulo-p">Fundo <small style="color:var(--tx3);text-transform:none;letter-spacing:0">onde não tem nada · aparece na câmera, no vídeo e recebe os efeitos</small></div>
      <div class="presets"><button data-m="quadriculado" class="${fp.modo === 'quadriculado' ? 'on' : ''}">Quadriculado</button><button data-m="cor" class="${fp.modo === 'cor' ? 'on' : ''}">Cor lisa</button></div>
      <div class="campo2"><span style="color:var(--tx2)">Cor</span><input type="color" value="${fp.cor}" data-c><span class="sp"></span><button class="btn sm" data-pad title="Cinza claro padrão">Padrão</button></div><div data-f></div></div>`);
    $$('[data-m]', pa).forEach(b => b.onclick = () => { App.mudaFundoPalco({ modo: b.dataset.m }); this.pinta(); });
    $('[data-c]', pa).oninput = ev => App.mudaFundoPalco({ cor: ev.target.value }, false); $('[data-c]', pa).onchange = () => App.mudaFundoPalco({});
    $('[data-pad]', pa).onclick = () => { App.mudaFundoPalco({ modo: 'quadriculado', cor: '#cfcfcf', forca: .35 }); this.pinta(); };
    if (fp.modo === 'quadriculado') $('[data-f]', pa).appendChild(this.campo('Intensidade', fp.forca, 0, 1, .01, v => App.mudaFundoPalco({ forca: v }, false), () => App.mudaFundoPalco({})));
    el.appendChild(pa);
  },
  // Trêmulo: deixa a camada parada "viva" (treme ou ondula sozinha, quadro a quadro), como o efeito do Premiere
  tremulo(n) {
    const T = n.tremulo, box = h(`<div class="sessao" style="margin:6px -10px 0;padding:8px 10px"><h4>Trêmulo <small>a camada parada treme sozinha</small></h4>
      <div class="presets">${[['', 'Desligado'], ['tremer', 'Tremer'], ['ondular', 'Ondular']].map(([m, nm]) => `<button data-m="${m}" class="${(T?.modo || '') === m ? 'on' : ''}">${nm}</button>`).join('')}</div><div data-c></div></div>`);
    $$('[data-m]', box).forEach(b => b.onclick = () => { const m = b.dataset.m; if (!m) delete n.tremulo; else n.tremulo = { forca: .4, ritmo: 2, ...(n.tremulo || {}), modo: m }; App.commit(m ? 'Trêmulo' : 'Sem trêmulo', { semArvore: true }); });
    if (T) { const c = $('[data-c]', box);
      c.appendChild(this.campo('Força', T.forca ?? .4, .05, 1, .01, v => { T.forca = v; App.pinta(); }, () => App.commit('Força do trêmulo', { semArvore: true })));
      c.appendChild(this.campo('Ritmo', T.ritmo || 2, 1, 8, 1, v => { T.ritmo = Math.round(v); App.pinta(); }, () => App.commit('Ritmo do trêmulo', { semArvore: true })));
      c.appendChild(h(`<div style="color:var(--tx3);font-size:11.5px">Ritmo = quantos quadros até mudar (2 = 12 vezes por segundo num vídeo de 24). Toque o vídeo para ver.</div>`)); }
    return box;
  },
  editarTexto(n) { App.selecionar(n.id); this.aba('props'); setTimeout(() => $('#lado textarea')?.focus(), 30); },

  /* ---------- Efeitos (1 clique) ---------- */
  /* ---------- Efeitos: tudo vira CAMADA DE EFEITO (vale para o que está abaixo dela na hierarquia, até a próxima camada de efeito) ---------- */
  efeitos(el) {
    const P = App.P, q = App.q, s = App.noSel(), alvo = s?.tipo === 'efeito' ? s : null, toda = this.toda ?? true;
    const dica = alvo ? `Clique para pôr na camada <b>${esc(alvo.nome)}</b>.` : `Clique: cria uma <b>camada de efeito</b> ${s ? `acima de <b>${esc(s.nome)}</b>` : 'no topo'} — vale para tudo o que está abaixo dela (até a próxima camada de efeito).`;
    const top = h(`<div class="ef-topo"><div class="ef-dica">${dica}</div><label class="chk" title="Desligado: começa neste quadro e dura um pouco"><input type="checkbox" data-toda ${toda ? 'checked' : ''}> Na timeline toda</label></div>`);
    $('[data-toda]', top).onchange = ev => { this.toda = ev.target.checked; };
    el.appendChild(top);
    const tem = (tipo, extra = {}) => alvo?.efeitos.some(e => e.tipo === tipo && Object.entries(extra).every(([k, v]) => e[k] === v));
    el.appendChild(h('<div class="p-cab" style="border:0"><h3>Cor</h3></div>'));
    const g = h('<div class="visuais"></div>');
    for (const v of Efeitos.VISUAIS) { if (v.id === 'normal') continue; const b = h(`<div class="visual ${tem('cor', { visual: v.id }) ? 'on' : ''}" title="${esc(v.nome)}"><i style="background:linear-gradient(135deg,${v.cor[0]},${v.cor[1]});filter:${v.f || 'none'}"></i>${esc(v.nome)}</div>`); b.onclick = () => App.addEfeito({ tipo: 'cor', visual: v.id }); g.appendChild(b); }
    el.appendChild(g);
    el.appendChild(h('<div class="p-cab" style="border:0"><h3>Efeitos de tela</h3></div>'));
    const t = h('<div class="efeitos-t"></div>');
    for (const ef of [...Efeitos.TELA, { id: 'tremulo', modo: 'tremer', nome: 'Trêmulo', ic: 'wave', forca: .4 }, { id: 'tremulo', modo: 'ondular', nome: 'Ondular', ic: 'wave', forca: .4 }]) {
      const b = h(`<div class="ef ${tem(ef.id, ef.modo ? { modo: ef.modo } : {}) ? 'on' : ''}">${ic(ef.ic, 14)}${esc(ef.nome)}</div>`);
      b.onclick = () => App.addEfeito({ tipo: ef.id, forca: ef.forca, ...(ef.modo ? { modo: ef.modo, ritmo: 2 } : {}) }); t.appendChild(b);
    }
    el.appendChild(t);
    if (alvo) el.appendChild(this.camadaEfeito(alvo));
    else if (s && s.tipo !== 'efeito') { el.appendChild(h(`<div class="p-cab" style="border:0"><h3>Só na camada "${esc(s.nome)}"</h3></div>`)); el.appendChild(this.tremulo(s)); }
    // efeitos antigos do vídeo todo (projetos de antes das camadas de efeito)
    const velhos = P.efeitos.tela || [];
    if (velhos.length || (P.efeitos.visual && P.efeitos.visual !== 'normal')) {
      el.appendChild(h('<div class="p-cab" style="border:0"><h3>Do vídeo todo (antigos)</h3></div>'));
      const box = h(`<div class="sessao"><div style="color:var(--tx2);font-size:12px;margin-bottom:6px">${[P.efeitos.visual !== 'normal' && Efeitos.visual(P.efeitos.visual).nome, ...velhos.map(e => Efeitos.nomeEf(e) + ` (${e.de + 1}–${e.ate + 1})`)].filter(Boolean).map(esc).join(' · ')}</div><button class="btn sm" data-conv>${ic('layers', 13)} Virar camada de efeito</button> <button class="btn sm" data-tira>${ic('trash', 13)} Tirar</button></div>`);
      $('[data-conv]', box).onclick = () => App.converterEfeitosAntigos(); $('[data-tira]', box).onclick = () => { P.efeitos = { visual: 'normal', tela: [] }; App.commit('Tirar efeitos antigos'); };
      el.appendChild(box);
    }
  },
  // os efeitos de uma camada de efeito: força, tempo próprio e tirar
  camadaEfeito(n) {
    const P = App.P, box = h(`<div class="sessao ef-camada"><h4>${ic('sparkles', 13)} ${esc(n.nome)} <small>quadros ${(n.de || 0) + 1}–${Modelo.fimNo(P, n) + 1}</small><span class="sp"></span><button class="btn sm" data-toda title="Do primeiro ao último quadro">Na timeline toda</button></h4></div>`);
    $('[data-toda]', box).onclick = () => { n.de = 0; n.ate = null; n.chaves = { 0: n.chaves?.[Object.keys(n.chaves || {})[0]] || { x: 0, y: 0, r: 0, s: 1, sx: 1, op: 1 } }; App.commit('Na timeline toda'); };
    if (!n.efeitos.length) box.appendChild(h('<div class="vazio">Sem efeitos: clique em um aí em cima.</div>'));
    for (const e of n.efeitos) {
      const lin = h(`<div class="ef-item"><div class="campo2"><b style="flex:1">${esc(Efeitos.nomeEf(e))}</b>${e.de != null ? `<small style="color:var(--tx3)">quadros ${e.de + 1}–${(e.ate ?? Modelo.fimNo(P, n)) + 1}</small><button class="btn sm" data-tudo title="Vale o tempo todo da camada">Tempo todo</button>` : ''}<button class="ibtn" data-x title="Tirar">${ic('trash', 13)}</button></div><div class="props" style="padding:0"></div></div>`);
      const pp = $('.props', lin);
      if (e.tipo !== 'cor') pp.appendChild(this.campo('Força', e.forca ?? .5, .02, 1, .01, v => { e.forca = v; App.pinta(); }, () => App.commit('Força')));
      if (e.tipo === 'tremulo') pp.appendChild(this.campo('Ritmo', e.ritmo || 2, 1, 8, 1, v => { e.ritmo = Math.round(v); App.pinta(); }, () => App.commit('Ritmo')));
      $('[data-x]', lin).onclick = () => { n.efeitos = n.efeitos.filter(x => x !== e); App.nomeEfeito(n); App.commit('Tirar ' + Efeitos.nomeEf(e)); };
      if ($('[data-tudo]', lin)) $('[data-tudo]', lin).onclick = () => { delete e.de; delete e.ate; App.commit('Tempo todo'); };
      box.appendChild(lin);
    }
    box.appendChild(h('<div style="color:var(--tx3);font-size:11.5px;margin-top:6px">Vale para o que está <b>abaixo</b> desta camada na hierarquia, até a próxima camada de efeito (o que está abaixo dela só obedece a ela). Arraste a barra na timeline para mudar o tempo.</div>'));
    return box;
  },

  /* ---------- Voz e legendas ---------- */
  som(el) {
    const P = App.P;
    const top = h(`<div class="sessao"><h4>Voz e sons</h4><div class="campo2"><button class="btn sm" data-gravar>${ic('mic', 13)} Gravar</button><button class="btn sm" data-add>${ic('upload', 13)} Pôr áudio</button>${P.audios.length ? `<button class="btn sm ia" data-tr>${ic('text', 13)} Transcrever para legendas</button>` : ''}</div></div>`);
    $('[data-add]', top).onclick = () => Som.importar(); $('[data-gravar]', top).onclick = () => Som.gravar(); if ($('[data-tr]', top)) $('[data-tr]', top).onclick = () => Som.transcrever();
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
