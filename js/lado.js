/* ===================== lado.js — painel da direita =====================
   No quadro: os personagens que aparecem NESTE quadro e os botões das sessões deles (olhos, boca, poses…): clicou, virou chave.
   Propriedades: posição, giro, tamanho, transparência, quando aparece; texto; câmera; o projeto.
   Efeitos: o visual (cor) com 1 clique e efeitos de tela. Voz: áudios, legendas pela transcrição e boca pela voz. */
'use strict';
const Lado = {
  atual: 'props', parteSel: null, // a 1ª aba é Propriedades; No quadro fica por último (menos usada agora)
  aba(a) { this.atual = a; $$('#lado-abas [data-aba]').forEach(b => b.classList.toggle('on', b.dataset.aba === a)); this.pinta(); },
  pinta() {
    if (!App.P) return; const el = $('#lado'); if (!el) return;
    const fn = { quadro: 'quadro', props: 'props', efeitos: 'efeitos', som: 'som' }[this.atual] || 'props'; // a Mídia agora fica na esquerda (Midia.liga)
    const rolagem = el.scrollTop; el.innerHTML = ''; this._vivos = []; this[fn](el); el.scrollTop = rolagem;
  },
  // personagem em foco: o selecionado, ou o 1º do quadro
  foco() { const P = App.P, s = App.noSel(), lista = Modelo.noQuadro(P, App.q); return s?.tipo === 'personagem' && lista.includes(s) ? s : lista.length === 1 ? lista[0] : s?.tipo === 'personagem' ? s : null; },

  midia(el) { Midia.pinta(el); },

  /* ---------- No quadro (aba de menos prioridade: o rig e a animação agora são feitos pelo Claude) ----------
     Personagens do quadro em fichas pequenas; do escolhido: a VISTA (ângulo) em botões, e as partes em seções que abrem/fecham
     (Poses, Animações, Ajustar uma parte, Atuação automática; o que fica aberto é lembrado em localStorage `animador-nq-abertas`). */
  CH_NQ: 'animador-nq-abertas',
  nqAbertas() { if (!this._nq) { try { this._nq = JSON.parse(localStorage.getItem(this.CH_NQ) || 'null'); } catch { } this._nq = this._nq || { poses: true, anims: true }; } return this._nq; },
  secao(id, titulo, extra, corpo, padrao = false) {
    const ab = this.nqAbertas(), d = h(`<details class="nq-sec" data-sec="${id}" ${(ab[id] ?? padrao) ? 'open' : ''}><summary><span class="nq-seta">${ic('right', 11)}</span><b>${titulo}</b>${extra ? `<small>${extra}</small>` : ''}</summary><div class="nq-corpo"></div></details>`);
    $('summary', d).addEventListener('click', () => { ab[id] = !d.open; try { localStorage.setItem(this.CH_NQ, JSON.stringify(ab)); } catch { } }); // só o clique da pessoa conta (o 'toggle' também dispara ao nascer aberto)
    corpo($('.nq-corpo', d)); return d;
  },
  quadro(el) {
    const P = App.P, q = App.q, lista = Modelo.noQuadro(P, q), f = this.foco();
    if (!lista.length) { el.innerHTML = `<div class="vazio">Nenhum personagem aparece no quadro ${q + 1}.<br><br><button class="btn" data-add>${ic('plus', 14)} Pôr um personagem</button></div>`; $('[data-add]', el).onclick = () => App.addPersonagem(); return; }
    const topo = h(`<div class="nq-topo"><span class="nq-q">Quadro <b>${q + 1}</b></span><span class="nq-n">${lista.length} personage${lista.length === 1 ? 'm' : 'ns'}</span></div>`), chips = h('<div class="nq-chips"></div>');
    for (const n of lista) {
      const def = P.personagens[n.ref], c = h(`<button class="nq-chip ${f === n ? 'sel' : ''}" title="${esc(n.nome)} · ${esc(def.nome)}${def._local ? ' · não está na nuvem' : ''}">${Icone.html(def, 18)}<span>${esc(n.nome)}</span>${def._local ? `<span class="so-local">${ic('cloudOff', 11)}</span>` : ''}</button>`);
      c.onclick = () => App.selecionar(n.id); chips.appendChild(c);
    }
    topo.appendChild(chips); el.appendChild(topo);
    if (!f) { el.appendChild(h('<div class="vazio">Clique num personagem para ver as poses e animações dele neste quadro.</div>')); return; }
    const def0 = P.personagens[f.ref], est = Modelo.estadoPersonagem(f, q), aqui = f.chaves[q] || {}, def = Modelo.naVista(def0, est.vista); // def = a vista deste quadro
    const vistaQ = def._vista || def0.vistaAtual || def0.vistas?.[0]?.id || null, nomeV = def0.vistas?.find(v => v.id === vistaQ)?.nome || '';
    // cabeçalho do personagem + VISTA (ângulo) neste quadro: vale até a próxima chave de vista
    const cab = h(`<div class="nq-pers"><div class="nq-cab">${Icone.html(def0, 26)}<div class="nq-nm"><b>${esc(f.nome)}</b><small>${esc(def0.nome)}${def0._local ? ' · não está na nuvem' : ''}</small></div><span class="sp"></span>
      <button class="ibtn" data-boca title="Boca pela voz">${ic('mic', 14)}</button><button class="ibtn ia" data-ia title="Animar com a IA">${ic('sparkles', 14)}</button><button class="ibtn" data-at title="Editar o personagem no Ateliê">${ic('edit', 14)}</button></div></div>`);
    $('[data-boca]', cab).onclick = () => Som.bocaPelaVoz(f); $('[data-ia]', cab).onclick = () => IA.abrir(f); $('[data-at]', cab).onclick = () => Atelie.abrirAba(def0.id);
    if (def0.vistas?.length > 1) { const temChave = 'vista' in aqui, vb = h(`<div class="nq-vistas" title="Vista (ângulo) a partir do quadro ${q + 1}${temChave ? ' · tem chave de vista neste quadro' : ''}"></div>`);
      for (const v of def0.vistas) { const b = h(`<button class="${v.id === vistaQ ? 'on' : ''} ${v.id === vistaQ && temChave ? 'chave' : ''}" title="${esc(v.nome)} a partir do quadro ${q + 1}">${Atelie.icVista(v.tipo, 13)}<span>${esc(v.nome)}</span></button>`);
        b.onclick = () => { const k = Modelo.chave(f, q); k.vista = v.id; App.commit(`Vista ${v.nome} no quadro ${q + 1}`, { semArvore: true }); }; vb.appendChild(b); }
      cab.appendChild(vb); }
    el.appendChild(cab);
    // POSES (sessões: olhos, boca, braços…)
    el.appendChild(this.secao('poses', 'Poses', def.sessoes.length ? `${def.sessoes.length} sessões${nomeV ? ' · ' + esc(nomeV) : ''}` : '', c => {
      if (!def.sessoes.length) return c.appendChild(h(`<div class="nq-vazio">${esc(def.nome)} ainda não tem sessões nesta vista. Crie no <b>Ateliê</b>.</div>`));
      for (const s of def.sessoes) {
        const atual = est.sessoes[s.id] || null, temChave = aqui.sessoes && s.id in aqui.sessoes;
        const box = h(`<div class="nq-sess"><span class="nq-sn" title="${esc(s.nome)}">${esc(s.nome)}${temChave ? ' <i title="tem chave neste quadro">◆</i>' : ''}</span><div class="presets"></div></div>`), pr = $('.presets', box);
        const loc = id => def._local && id && (def._local.todo || def._local.presets?.includes(id));
        const bt = (id, nome) => { const b = h(`<button class="${atual === id ? 'on' : ''} ${atual === id && temChave ? 'chave' : ''} ${loc(id) ? 'loc' : ''} ${id ? '' : 'padrao'}" title="${esc(nome)} no quadro ${q + 1}${loc(id) ? ' · salvo só neste computador (não está na nuvem)' : ''}">${esc(nome)}${loc(id) ? ` <span class="so-local">${ic('cloudOff', 11)}</span>` : ''}</button>`); b.onclick = () => this.escolhe(f, s.id, atual === id && id ? null : id); pr.appendChild(b); };
        bt(null, 'Padrão'); s.presets.forEach(p => bt(p.id, p.nome)); c.appendChild(box);
      }
    }));
    // ANIMAÇÕES de teste (feitas no Ateliê) DESTA vista: viram chaves a partir deste quadro (na janela dá para escolher outra vista)
    const anims = def.animacoes || [], outras = def0.vistas?.length > 1 ? def0.vistas.filter(v => v.id !== vistaQ).map(v => ({ v, l: Modelo.naVista(def0, v.id).animacoes || [] })).filter(x => x.l.length) : [];
    if (anims.length || outras.length) el.appendChild(this.secao('anims', 'Animações', `pôr a partir do quadro ${q + 1}`, c => {
      const fpsP = Modelo.fpsDe(def0); c.appendChild(h(`<div class="ld-fps${fpsP !== P.fps ? ' dif' : ''}" title="As animações deste personagem foram feitas a este fps no Ateliê. Ao pôr, dá para escolher outro.">${ic('clock', 11)} Personagem a <b>${fpsP} fps</b>${fpsP !== P.fps ? ` · projeto a ${P.fps} fps` : ''}</div>`));
      if (anims.length) { const g = h(`<div class="nq-anims">${nomeV ? `<div class="nq-vt">${Atelie.icVista(def0.vistas.find(v => v.id === vistaQ)?.tipo, 12)} ${esc(nomeV)} <small>a vista deste quadro</small></div>` : ''}<div class="presets"></div></div>`);
        for (const a of anims) { const b = h(`<button title="Escreve &quot;${esc(a.nome)}&quot; como chaves a partir deste quadro${nomeV ? ', na vista ' + esc(nomeV) : ''}">${ic('play', 11)} ${esc(a.nome)}</button>`); b.onclick = () => Animacoes.porNoQuadro(f, def, a); $('.presets', g).appendChild(b); }
        c.appendChild(g); }
      else c.appendChild(h(`<div class="nq-vazio">A vista ${esc(nomeV)} não tem animações de teste.</div>`));
      for (const { v, l } of outras) { const g = h(`<div class="nq-anims outra"><div class="nq-vt">${Atelie.icVista(v.tipo, 12)} ${esc(v.nome)} <small>muda a vista para esta</small></div><div class="presets"></div></div>`), dv = Modelo.naVista(def0, v.id);
        for (const a of l) { const b = h(`<button title="Põe &quot;${esc(a.nome)}&quot; e o personagem passa para a vista ${esc(v.nome)} a partir deste quadro">${ic('play', 11)} ${esc(a.nome)}</button>`); b.onclick = () => Animacoes.porNoQuadro(f, dv, a); $('.presets', g).appendChild(b); }
        c.appendChild(g); }
    }));
    // AJUSTAR UMA PARTE só neste quadro (quando uma pose precisa de um retoque)
    const partes = def.partes, ps = this.parteSel && partes.find(p => p.id === this.parteSel) ? this.parteSel : partes[0]?.id;
    if (partes.length) el.appendChild(this.secao('ajuste', 'Ajustar uma parte', aqui.partes && Object.keys(aqui.partes).length ? `${Object.keys(aqui.partes).length} ajustada(s) aqui` : 'neste quadro', box => {
      const estP = Modelo.partesNoEstado(def, est), e = estP[ps] || {}, temAjuste = !!aqui.partes?.[ps];
      box.appendChild(h(`<div class="campo2" style="margin-bottom:6px"><select data-p style="flex:1">${partes.map(p => `<option value="${p.id}" ${p.id === ps ? 'selected' : ''}>${esc(p.nome)}${aqui.partes?.[p.id] ? ' ◆' : ''}</option>`).join('')}</select>
        ${temAjuste ? `<button class="btn sm" data-limpa title="Volta ao que a sessão/pose define">Desfazer ajuste</button>` : ''}</div>`)); const pp = h('<div class="props" style="padding:0"></div>'); box.appendChild(pp);
      const parte = partes.find(p => p.id === ps);
      $('[data-p]', box).onchange = ev => { this.parteSel = ev.target.value; this.pinta(); };
      if ($('[data-limpa]', box)) $('[data-limpa]', box).onclick = () => { delete aqui.partes[ps]; if (!Object.keys(aqui.partes).length) delete aqui.partes; App.commit('Desfazer ajuste'); };
      const muda = (c, v) => { const k = Modelo.chave(f, q); k.partes = k.partes || {}; k.partes[ps] = { ...(k.partes[ps] || {}), [c]: v }; App.pinta(); };
      for (const [c, nome, min, max, passo] of [['x', 'Mover X', -400, 400, 1], ['y', 'Mover Y', -400, 400, 1], ['r', 'Girar', -180, 180, 1], ['s', 'Tamanho', .2, 3, .01]]) pp.appendChild(this.campo(nome, e[c] ?? (c === 's' ? 1 : 0), min, max, passo, v => muda(c, v), () => App.commit('Ajustar ' + parte.nome)));
      if (parte?.imgs.length > 1) { const sel = h(`<label class="campo"><span>Imagem</span><select style="grid-column:span 2">${parte.imgs.map(i => `<option value="${i.id}" ${i.id === e.img ? 'selected' : ''}>${esc(i.nome)}</option>`).join('')}</select></label>`); $('select', sel).onchange = ev => { muda('img', ev.target.value); App.commit('Trocar imagem'); }; pp.appendChild(sel); }
    }));
    // ATUAÇÃO AUTOMÁTICA (js/atuacao.js): o código lê a próxima pose e faz o movimento entre elas (antecipação, mola, respiração, cabelo)
    { const o = Atuacao.opcoes(f), lig = Atuacao.ligada(f);
      el.appendChild(this.secao('atuacao', 'Atuação automática', lig ? 'ligada' : 'desligada', box => {
        box.appendChild(h(`<div><div class="campo2" style="margin-bottom:6px"><span style="color:var(--tx3);font-size:11.5px;flex:1">O código lê a próxima pose e faz o movimento até ela (as chaves não mudam).</span><button class="btn sm ${lig ? 'primary' : ''}" data-on>${lig ? 'Ligada' : 'Desligada'}</button></div>
          <div data-o ${lig ? '' : 'hidden'}><div class="props" style="padding:0" data-f></div><div class="campo2" style="flex-wrap:wrap;gap:4px 12px">
          <label class="chk" title="Antes de trocar de pose a parte recua um pouco; a pose nova chega girando e passa um tico do ponto (mola). O corpo agacha e estica junto."><input type="checkbox" data-k="mola" ${o.mola ? 'checked' : ''}> Antecipação e mola</label>
          <label class="chk" title="O corpo respira e os braços nunca ficam 100% parados numa pose"><input type="checkbox" data-k="resp" ${o.resp ? 'checked' : ''}> Respiração e pose viva</label>
          <label class="chk" title="O cabelo atrasa e balança quando o corpo gira ou o personagem anda, pula ou cai"><input type="checkbox" data-k="cabelo" ${o.cabelo ? 'checked' : ''}> Cabelo solto</label></div></div></div>`));
        $('[data-on]', box).onclick = () => { f.atuacao = { ...o, on: !lig }; App.commit(lig ? 'Atuação automática desligada' : 'Atuação automática ligada', { semArvore: true }); };
        $('[data-f]', box).appendChild(this.campo('Força', o.forca, 0, 2, .05, v => { f.atuacao = { ...Atuacao.opcoes(f), forca: v }; App.pinta(); }, () => App.commit('Força da atuação', { semArvore: true })));
        $$('[data-k]', box).forEach(c => c.onchange = () => { f.atuacao = { ...Atuacao.opcoes(f), [c.dataset.k]: c.checked }; App.commit('Atuação automática', { semArvore: true }); });
      })); }
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
  // câmera enquadra a caixa x (Render.caixas) no plano escolhido: close = cabeça, médio = até a cintura, americano = até o joelho, inteiro, geral = a cena toda
  enquadra(P, q, x, plano) {
    const xs = x.cantos.map(p => p.x), ys = x.cantos.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const c = Modelo.camera(P, q); let cx, cy, zoom;
    if (plano === 'geral') { cx = P.w / 2; cy = P.h / 2; zoom = 1; }
    else { const fr = { close: .32, medio: .58, americano: .8, inteiro: 1 }[plano] ?? 1, bh = (y1 - y0) * fr, bw = (x1 - x0) * (plano === 'inteiro' ? 1 : Math.min(1, fr * 1.4)), folga = plano === 'inteiro' ? 1.18 : 1.1;
      zoom = clamp(Math.min(P.w / (bw * folga), P.h / (bh * folga)), .2, 6); cx = (x0 + x1) / 2; cy = y0 + bh / 2 - (plano === 'inteiro' ? 0 : bh * .04); }
    P.camera.chaves[q] = { ...c, ...(P.camera.chaves[q] || {}), x: round(cx, 1), y: round(cy, 1), zoom: round(zoom, 3) };
    App.commit('Enquadrar: ' + plano);
  },
  /* ---------- Propriedades ----------
     Cabeçalho da camada (nome, tipo, ver/travar, CHAVE neste quadro e pular de chave em chave) e seções que abrem/fecham
     (lembradas junto com as do No quadro): Transformar, Tempo e entrada/saída, o próprio tipo (forma, texto, imagem, personagem),
     Trêmulo; Câmera tem Posição, Movimento e Enquadrar; Projeto e Fundo ficam por último (abertos quando nada está escolhido).
     Campos numéricos: arrastar o nome do campo para os lados muda o valor (Shift = mais rápido, Alt = fino), ou digitar. */
  num(nome, v, o, aoMudar, aoSoltar) {
    const m = o.mult || 1, dec = o.dec ?? 1, mostra = x => String(round(x * m, dec)).replace('.', ',');
    const el = h(`<label class="pr-num" title="${esc(o.dica || 'Arraste o nome para os lados para mudar · Shift = rápido · Alt = fino')}"><span class="pr-num-n">${esc(nome)}</span><input type="text" inputmode="decimal" value="${mostra(v)}">${o.unid ? `<i>${o.unid}</i>` : ''}</label>`);
    const inp = $('input', el), lim = x => clamp(x, o.min ?? -Infinity, o.max ?? Infinity), le = () => { const x = parseFloat(String(inp.value).replace(',', '.')); return isNaN(x) ? null : x / m; };
    inp.onchange = () => { const x = le(); if (x == null) { inp.value = mostra(v); return; } v = lim(x); inp.value = mostra(v); aoMudar(v); aoSoltar?.(); };
    inp.onkeydown = e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); v = lim((le() ?? v) + (e.key === 'ArrowUp' ? 1 : -1) * (o.passo || 1) * (e.shiftKey ? 10 : 1)); inp.value = mostra(v); aoMudar(v); clearTimeout(this._tSol); this._tSol = setTimeout(() => aoSoltar?.(), 400); } if (e.key === 'Enter') inp.blur(); };
    if (o.vivo) (this._vivos ||= []).push(() => { if (document.activeElement === inp || this._arrNum) return; v = o.vivo(); inp.value = mostra(v); });
    const nm = $('.pr-num-n', el); nm.onpointerdown = e => { if (e.button !== 0) return; e.preventDefault(); nm.setPointerCapture(e.pointerId); this._arrNum = true; const x0 = e.clientX, v0 = v; let mexeu = false; document.body.classList.add('arrastando-num');
      const mv = ev => { const dx = ev.clientX - x0; if (!mexeu && Math.abs(dx) < 2) return; mexeu = true; v = lim(v0 + dx * (o.passo || 1) * (ev.shiftKey ? 10 : ev.altKey ? .1 : 1)); inp.value = mostra(v); aoMudar(v); };
      const up = () => { this._arrNum = false; nm.removeEventListener('pointermove', mv); nm.removeEventListener('pointerup', up); nm.removeEventListener('pointercancel', up); document.body.classList.remove('arrastando-num'); if (mexeu) aoSoltar?.(); else inp.focus(); };
      nm.addEventListener('pointermove', mv); nm.addEventListener('pointerup', up); nm.addEventListener('pointercancel', up); };
    return el;
  },
  // barrinha (0–100%) com número, para opacidade e afins
  barra(nome, v, aoMudar, aoSoltar, vivo) {
    const el = h(`<label class="pr-barra"><span>${esc(nome)}</span><input type="range" min="0" max="100" step="1" value="${Math.round(v * 100)}"><b>${Math.round(v * 100)}%</b></label>`), r = $('input', el), b = $('b', el);
    if (vivo) (this._vivos ||= []).push(() => { if (document.activeElement === r) return; const x = Math.round(vivo() * 100); r.value = x; b.textContent = x + '%'; });
    r.oninput = () => { b.textContent = r.value + '%'; aoMudar(+r.value / 100); }; r.onchange = () => aoSoltar?.(); return el;
  },
  // linha de cor: bolinha de cor + código
  cor(nome, v, aoMudar, aoSoltar) {
    const el = h(`<label class="pr-cor"><span>${esc(nome)}</span><input type="color" value="${v}"><code>${esc(v)}</code></label>`), c = $('input', el);
    c.oninput = () => { $('code', el).textContent = c.value; aoMudar(c.value); }; c.onchange = () => aoSoltar?.(); return el;
  },
  cabecalho(icone, titulo, tipo, extra) { return h(`<div class="pr-cab"><span class="pr-ic">${icone}</span><div class="pr-nm">${titulo}<small>${tipo}</small></div>${extra || ''}</div>`); },
  // chave neste quadro: botão de pôr/tirar + pular para a anterior/próxima
  barraChave(temChave, total, ch) {
    const b = h(`<div class="pr-chave ${temChave ? 'on' : ''}"><button class="ibtn" data-ant title="Chave anterior ( [ )">${ic('prev', 13)}</button>
      <button class="pr-k" data-k title="${temChave ? 'Tirar a chave deste quadro (Shift+K)' : 'Pôr uma chave neste quadro (K)'}">${ic('diamond', 13)}<span>${temChave ? 'Chave neste quadro' : 'Sem chave aqui'}</span></button>
      <button class="ibtn" data-prox title="Próxima chave ( ] )">${ic('next', 13)}</button><small>${total} chave${total === 1 ? '' : 's'}</small></div>`);
    $('[data-ant]', b).onclick = () => App.pulaChave(-1); $('[data-prox]', b).onclick = () => App.pulaChave(1);
    $('[data-k]', b).onclick = () => (ch ? !!ch()?.[App.q] : temChave) ? App.tiraChave() : App.chaveAqui();
    if (ch) (this._vivos ||= []).push(() => { const t = !!ch()?.[App.q]; b.classList.toggle('on', t); $('[data-k] span', b).textContent = t ? 'Chave neste quadro' : 'Sem chave aqui'; });
    return b;
  },
  // TOCANDO a timeline: os números das Propriedades andam junto (sem redesenhar o painel; o campo em uso não muda)
  aoVivo() { if (this.atual !== 'props') return; for (const f of this._vivos || []) { try { f(); } catch { } } },
  props(el) {
    const P = App.P, q = App.q, n = App.noSel();
    if (App.sel === 'camera') this.propsCamera(el, P, q);
    else if (n?.tipo === 'efeito') { el.appendChild(this.camadaEfeito(n)); return; }
    else if (n) this.propsCamada(el, P, q, n);
    else el.appendChild(h(`<div class="pr-vazio">${ic('cursor', 20)}<span>Escolha uma camada no palco, na hierarquia ou na timeline para ver as propriedades dela.</span></div>`));
    this.propsProjeto(el, P, !n && App.sel !== 'camera');
  },
  propsCamada(el, P, q, n) {
    const t = Modelo.transf(n, q), muda = (k, v) => { Modelo.poeTransf(n, App.q, { [k]: v }); App.pinta(); }, sol = () => App.commit('Propriedade', { semArvore: true });
    const nomeTipo = { pasta: 'Pasta', personagem: 'Personagem', imagem: n.vetor ? 'Imagem (vetor)' : 'Imagem', texto: 'Texto', forma: 'Forma', efeito: 'Efeito' }[n.tipo] || n.tipo;
    const defP = n.tipo === 'personagem' ? P.personagens[n.ref] : null;
    const cab = this.cabecalho(defP ? Icone.html(defP, 26) : ic(TIPO_IC[n.tipo] || 'layers', 16), `<input class="pr-nome" value="${esc(n.nome)}" title="Nome da camada">`, `${nomeTipo}${defP ? ' · ' + esc(defP.nome) : ''}`,
      `<button class="ibtn ${n.vis === false ? 'off' : ''}" data-vis title="${n.vis === false ? 'Mostrar' : 'Esconder'}">${ic(n.vis === false ? 'eyeOff' : 'eye', 14)}</button><button class="ibtn ${n.trava ? 'on' : ''}" data-tr title="${n.trava ? 'Destravar' : 'Travar (não mexe no palco)'}">${ic(n.trava ? 'lock' : 'unlock', 14)}</button>`);
    $('.pr-nome', cab).onchange = ev => { n.nome = ev.target.value.trim() || n.nome; App.commit('Nome da camada'); };
    $('.pr-nome', cab).onkeydown = ev => { if (ev.key === 'Enter') ev.target.blur(); };
    $('[data-vis]', cab).onclick = () => { n.vis = n.vis === false; App.commit(n.vis ? 'Mostrar' : 'Esconder'); };
    $('[data-tr]', cab).onclick = () => { n.trava = !n.trava; App.commit(n.trava ? 'Travar' : 'Destravar'); };
    const topo = h('<div class="pr-topo"></div>'); topo.append(cab, this.barraChave(!!n.chaves?.[q], Object.keys(n.chaves || {}).length, () => n.chaves)); el.appendChild(topo);
    // TRANSFORMAR
    el.appendChild(this.secao('p-transf', 'Transformar', `quadro ${q + 1}`, c => {
      const g = h('<div class="pr-num-grade"></div>');
      const vv = k => () => Modelo.transf(n, App.q)[k] ?? (k === 'op' || k === 's' ? 1 : 0); // ao vivo: tocando, os números andam junto
      g.append(this.num('X', t.x, { passo: 1, dec: 1, unid: 'px', vivo: vv('x') }, v => muda('x', v), sol), this.num('Y', t.y, { passo: 1, dec: 1, unid: 'px', vivo: vv('y') }, v => muda('y', v), sol),
        this.num('Tamanho', t.s, { passo: .005, min: .01, max: 20, mult: 100, dec: 1, unid: '%', vivo: vv('s') }, v => muda('s', v), sol), this.num('Girar', t.r, { passo: .5, min: -3600, max: 3600, dec: 1, unid: '°', vivo: vv('r') }, v => muda('r', v), sol));
      c.appendChild(g); c.appendChild(this.barra('Opacidade', t.op ?? 1, v => muda('op', v), sol, vv('op')));
      const at = h(`<div class="pr-acoes"><button class="btn sm ${t.sx < 0 ? 'on' : ''}" data-sx title="Espelhar na horizontal">${ic('flip', 13)} Espelhar</button><button class="btn sm" data-cen title="Pôr no meio da câmera">${ic('camera', 13)} No meio</button><button class="btn sm" data-zero title="Giro 0°, tamanho 100%, opacidade 100%">${ic('undo', 13)} Zerar</button></div>`);
      $('[data-sx]', at).onclick = () => { Modelo.poeTransf(n, q, { sx: t.sx < 0 ? 1 : -1 }); App.commit('Espelhar'); };
      $('[data-cen]', at).onclick = () => { const c0 = Modelo.camera(P, q); Modelo.poeTransf(n, q, { x: round(c0.x, 1), y: round(c0.y, 1) }); App.commit('No meio da câmera'); };
      $('[data-zero]', at).onclick = () => { Modelo.poeTransf(n, q, { r: 0, s: 1, op: 1 }); App.commit('Zerar'); };
      c.appendChild(at);
      const mv = h(`<div class="pr-seg" title="Como a camada vai de uma chave para a outra"><span>Movimento</span><div><button data-i="1" class="${n.interp ? 'on' : ''}" title="Anda sozinho entre as chaves">Suave</button><button data-i="0" class="${n.interp ? '' : 'on'}" title="Segura até a próxima chave">Quadro a quadro</button></div></div>`);
      $$('[data-i]', mv).forEach(b => b.onclick = () => { n.interp = b.dataset.i === '1'; App.commit('Movimento'); }); c.appendChild(mv);
    }, true));
    // TEMPO
    const fim = Modelo.fimNo(P, n);
    el.appendChild(this.secao('p-tempo', 'Tempo', `quadros ${(n.de || 0) + 1}–${n.ate == null ? 'fim' : fim + 1}`, c => {
      const tm = h(`<div><div class="pr-tempo"><label><span>Começa</span><input type="number" min="1" value="${(n.de || 0) + 1}" data-de><button class="ibtn" data-dq title="Começar no quadro de agora (${q + 1})">${ic('marker', 13)}</button></label>
        <label><span>Termina</span><input type="number" min="1" value="${n.ate == null ? '' : n.ate + 1}" placeholder="no fim" data-ate><button class="ibtn" data-aq title="Terminar no quadro de agora (${q + 1})">${ic('marker', 13)}</button></label></div>
        <div class="pr-acoes"><button class="btn sm" data-toda title="Do primeiro ao último quadro">${ic('loop', 13)} A animação toda</button></div></div>`);
      $('[data-de]', tm).onchange = ev => { n.de = clamp(+ev.target.value - 1, 0, P.duracao - 1); App.commit('Começo'); };
      $('[data-ate]', tm).onchange = ev => { n.ate = ev.target.value === '' ? null : Math.max(n.de || 0, +ev.target.value - 1); App.commit('Fim'); };
      $('[data-dq]', tm).onclick = () => { n.de = q; if (n.ate != null && n.ate < q) n.ate = q; App.commit('Começo'); };
      $('[data-aq]', tm).onclick = () => { n.ate = Math.max(n.de || 0, q); App.commit('Fim'); };
      $('[data-toda]', tm).onclick = () => { n.de = 0; n.ate = null; App.commit('A animação toda'); };
      c.appendChild(tm);
      const opA = cur => `<option value="">Nenhuma</option>${Object.entries(Modelo.ANIMS).map(([id, nm]) => `<option value="${id}" ${cur === id ? 'selected' : ''}>${nm}</option>`).join('')}`;
      const linhaA = (k, nome, ok) => { const r = h(`<div class="pr-es"><span>${nome}</span><select ${ok ? '' : 'disabled title="Ponha um fim na camada (Termina) para ter saída"'}>${opA(n[k]?.tipo)}</select><input type="number" min="1" max="120" value="${n[k]?.q || Math.round(P.fps * .25)}" title="Quantos quadros dura"><i>quadros</i></div>`);
        const sel = $('select', r), qq = $('input', r), poe = () => { if (!sel.value) delete n[k]; else n[k] = { tipo: sel.value, q: clamp(Math.round(+qq.value || 6), 1, 120) }; App.commit(k === 'entra' ? 'Entrada' : 'Saída'); };
        sel.onchange = poe; qq.onchange = () => n[k] && poe(); return r; };
      c.append(linhaA('entra', 'Entrada', true), linhaA('sai', 'Saída', n.ate != null));
    }, true));
    // DO TIPO
    if (n.tipo === 'forma') el.appendChild(this.secao('p-forma', n.fundoPadrao ? 'Forma · fundo padrão' : 'Forma', '', c => {
      const fs = h(`<div class="pr-icones">${[['ret', 'square', 'Retângulo'], ['elipse', 'circle', 'Círculo'], ['tri', 'shapes', 'Triângulo'], ['estrela', 'star', 'Estrela']].map(([f, i, l]) => `<button data-f="${f}" class="${n.forma === f ? 'on' : ''}" title="${l}">${ic(i, 15)}<span>${l}</span></button>`).join('')}</div>`);
      $$('[data-f]', fs).forEach(b => b.onclick = () => { n.forma = b.dataset.f; App.commit('Forma'); }); c.appendChild(fs);
      const sf = () => App.commit('Forma', { semArvore: true }), g = h('<div class="pr-num-grade"></div>');
      g.append(this.num('Largura', n.w, { passo: 1, min: 2, max: 20000, dec: 0, unid: 'px' }, v => { n.w = v; App.pinta(); }, sf), this.num('Altura', n.h, { passo: 1, min: 2, max: 20000, dec: 0, unid: 'px' }, v => { n.h = v; App.pinta(); }, sf));
      if (n.forma === 'ret') g.append(this.num('Cantos', n.raio || 0, { passo: 1, min: 0, max: 2000, dec: 0, unid: 'px' }, v => { n.raio = v; App.pinta(); }, sf));
      g.append(this.num('Borda', n.bordaL || 0, { passo: .5, min: 0, max: 200, dec: 1, unid: 'px' }, v => { n.bordaL = v; App.pinta(); }, sf)); c.appendChild(g);
      c.append(this.cor('Cor', n.cor, v => { n.cor = v; App.pinta(); }, sf), this.cor('Cor da borda', n.borda, v => { n.borda = v; App.pinta(); }, sf));
      const bt = h(`<button class="btn sm">${ic('camera', 13)} Do tamanho da câmera</button>`); bt.onclick = () => { n.w = P.w; n.h = P.h; Modelo.poeTransf(n, q, { x: P.w / 2, y: P.h / 2, r: 0, s: 1 }); App.commit('Do tamanho da câmera'); }; c.appendChild(bt);
    }, true));
    if (n.tipo === 'texto') el.appendChild(this.secao('p-texto', 'Texto', '', c => {
      const st = () => App.commit('Texto', { semArvore: true });
      const tx = h(`<textarea rows="3" class="pr-txt">${esc(n.texto)}</textarea>`); tx.oninput = () => { n.texto = tx.value; App.pinta(); }; tx.onchange = st; c.appendChild(tx);
      const est = h(`<div class="pr-acoes"><button class="btn sm ${n.negrito ? 'on' : ''}" data-n title="Negrito"><b>N</b> Negrito</button></div>`); $('[data-n]', est).onclick = () => { n.negrito = !n.negrito; st(); }; c.appendChild(est);
      const g = h('<div class="pr-num-grade"></div>'); g.append(this.num('Tamanho', n.tam, { passo: 1, min: 8, max: 1000, dec: 0, unid: 'px' }, v => { n.tam = v; App.pinta(); }, st), this.num('Borda', n.bordaL || 0, { passo: .5, min: 0, max: 100, dec: 1, unid: 'px' }, v => { n.bordaL = v; App.pinta(); }, st)); c.appendChild(g);
      c.append(this.cor('Cor', n.cor, v => { n.cor = v; App.pinta(); }, st), this.cor('Cor da borda', n.borda, v => { n.borda = v; App.pinta(); }, st));
    }, true));
    if (n.tipo === 'imagem') el.appendChild(this.secao('p-img', 'Imagem', '', c => {
      const a = h(`<div class="pr-acoes"><button class="btn sm" data-tr>${ic('image', 13)} Trocar a imagem…</button></div>`); $('[data-tr]', a).onclick = () => App.trocarImagem(n); c.appendChild(a);
    }, true));
    if (defP) el.appendChild(this.secao('p-pers', 'Personagem', '', c => {
      const est = Modelo.estadoPersonagem(n, q), vn = defP.vistas?.length > 1 ? defP.vistas.find(v => v.id === (est.vista || defP.vistas[0].id))?.nome : '';
      c.appendChild(h(`<div class="pr-info">${vn ? `Vista <b>${esc(vn)}</b> neste quadro · ` : ''}${Atuacao.ligada(n) ? 'atuação automática ligada' : 'atuação automática desligada'}</div>`));
      const a = h(`<div class="pr-acoes"><button class="btn sm" data-nq>${ic('layers', 13)} Poses e vista</button><button class="btn sm" data-at><span class="ic-ep" data-estudio-icone="at" style="width:14px;height:14px"></span> Ateliê…</button></div>`);
      $('[data-nq]', a).onclick = () => this.aba('quadro'); $('[data-at]', a).onclick = () => App.abrirAtelie(); c.appendChild(a);
      // RIG (js/rig.js): partes mudam aos poucos entre as chaves de pose (como no Toon Boom) e o esqueleto por cima
      const mv = h(`<div class="pr-seg" title="Como as partes (braço, cabeça…) vão de uma pose para a outra"><span>Partes</span><div><button data-sp="1" class="${n.suaveP ? 'on' : ''}" title="Giram e andam aos poucos até a pose da próxima chave (a troca de desenho acontece na chave)">Suave</button><button data-sp="0" class="${n.suaveP ? '' : 'on'}" title="A pose fica parada até a próxima chave">Quadro a quadro</button></div></div>`);
      $$('[data-sp]', mv).forEach(b => b.onclick = () => { n.suaveP = b.dataset.sp === '1'; App.commit(n.suaveP ? 'Partes suaves' : 'Partes quadro a quadro', { semArvore: true }); }); c.appendChild(mv);
      const cads = Rig.cadeias(Modelo.naVista(defP, est.vista)), esq = h(`<label class="chk" style="margin-top:6px" title="Mostra os ossos e as juntas deste personagem no palco. Arraste a bolinha de uma mão ou pé para dobrar o braço/perna inteiro (IK)."><input type="checkbox" ${App.esqueleto ? 'checked' : ''}> Mostrar o esqueleto${cads.length ? ` <small style="color:var(--tx3)">· ${cads.length} membro${cads.length > 1 ? 's' : ''} com IK</small>` : ''}</label>`);
      $('input', esq).onchange = ev => { App.esqueleto = ev.target.checked; try { localStorage.setItem('animador-esqueleto', App.esqueleto ? '1' : ''); } catch { } App.pinta(); }; c.appendChild(esq);
    }, true));
    { const ef = h(`<button class="pr-ir-ef">${ic('sparkles', 13)}<span>Trêmulo e efeitos desta camada</span><small>${n.tremulo ? (n.tremulo.modo === 'ondular' ? 'ondulando' : 'tremendo') : ''}</small>${ic('right', 12)}</button>`); ef.onclick = () => this.aba('efeitos'); el.appendChild(ef); }
  },
  propsCamera(el, P, q) {
    const muda = (k, v) => { const q2 = App.q; P.camera.chaves[q2] = { ...Modelo.camera(P, q2), ...(P.camera.chaves[q2] || {}), [k]: v }; App.pinta(); }, sol = () => App.commit('Câmera', { semArvore: true }), c = Modelo.camera(P, q);
    const topo = h('<div class="pr-topo"></div>'); topo.append(this.cabecalho(ic('camera', 16), 'Câmera', `${P.w} × ${P.h}`), this.barraChave(!!P.camera.chaves[q], Object.keys(P.camera.chaves).length, () => P.camera.chaves)); el.appendChild(topo);
    el.appendChild(this.secao('c-pos', 'Posição', `quadro ${q + 1}`, b => {
      const g = h('<div class="pr-num-grade"></div>');
      const cv = k => () => Modelo.camera(P, App.q)[k] || 0;
      g.append(this.num('X', c.x, { passo: 1, dec: 1, unid: 'px', vivo: cv('x') }, v => muda('x', v), sol), this.num('Y', c.y, { passo: 1, dec: 1, unid: 'px', vivo: cv('y') }, v => muda('y', v), sol),
        this.num('Zoom', c.zoom, { passo: .005, min: .2, max: 6, mult: 100, dec: 0, unid: '%', vivo: cv('zoom') }, v => muda('zoom', v), sol), this.num('Girar', c.r || 0, { passo: .25, min: -45, max: 45, dec: 1, unid: '°', vivo: cv('r') }, v => muda('r', v), sol));
      b.appendChild(g);
      const a = h(`<div class="pr-acoes"><button class="btn sm" data-cen title="Câmera no meio do vídeo, sem zoom nem giro">${ic('undo', 13)} Centralizar</button></div>`);
      $('[data-cen]', a).onclick = () => { P.camera.chaves[q] = { ...c, ...(P.camera.chaves[q] || {}), x: P.w / 2, y: P.h / 2, zoom: 1, r: 0 }; App.commit('Centralizar a câmera'); }; b.appendChild(a);
    }, true));
    el.appendChild(this.secao('c-mov', 'Movimento', '', b => {
      b.appendChild(this.barra('Tremor', c.tremor || 0, v => muda('tremor', v), () => App.commit('Tremor da câmera', { semArvore: true })));
      b.appendChild(this.barra('Na mão', +P.camera.viva || 0, v => { P.camera.viva = v; App.pinta(); }, () => App.commit('Câmera na mão', { semArvore: true })));
      b.appendChild(h('<div class="pr-info">Curva do movimento: botão direito na chave da câmera na timeline. Para mover, arraste no palco com a ferramenta Câmera (C).</div>'));
    }, true));
    const alvos = Render.caixas(P, q).filter(x => ['personagem', 'imagem', 'texto', 'forma'].includes(x.no.tipo) && !x.no.fundoPadrao);
    if (alvos.length) el.appendChild(this.secao('c-enq', 'Enquadrar', 'cria uma chave aqui', b => {
      const pl = h(`<div class="pr-enq pr-5"><select data-alvo>${alvos.map((x, i) => `<option value="${i}" ${x.no.id === this._camAlvo ? 'selected' : ''}>${esc(x.no.nome)}</option>`).join('')}</select>
        <div class="pr-icones">${[['close', 'Close'], ['medio', 'Médio'], ['americano', 'Americano'], ['inteiro', 'Inteiro'], ['geral', 'Geral']].map(([id, nm]) => `<button data-pl="${id}"><span>${nm}</span></button>`).join('')}</div></div>`);
      $('[data-alvo]', pl).onchange = ev => { this._camAlvo = alvos[+ev.target.value]?.no.id; };
      $$('[data-pl]', pl).forEach(bt => bt.onclick = () => { const x = alvos[+$('[data-alvo]', pl).value]; if (!x) return; this._camAlvo = x.no.id; this.enquadra(P, q, x, bt.dataset.pl); });
      b.appendChild(pl);
    }, true));
  },
  TAMANHOS: [['16:9', 1920, 1080], ['9:16', 1080, 1920], ['1:1', 1080, 1080], ['4:5', 1080, 1350]],
  propsProjeto(el, P, aberto) {
    el.appendChild(this.secao('p-proj', 'Projeto', `${P.w} × ${P.h} · ${P.fps} fps`, c => {
      const nm = h(`<label class="pr-campo"><span>Nome</span><input type="text" value="${esc(P.nome)}"></label>`);
      $('input', nm).onchange = ev => { P.nome = ev.target.value.trim() || P.nome; $('#proj-nome').textContent = P.nome; App.titulo(); App.commit('Nome'); }; c.appendChild(nm);
      const tam = h(`<div class="pr-icones">${this.TAMANHOS.map(([r, w, hh]) => `<button data-r="${r}" class="${P.w === w && P.h === hh ? 'on' : ''}" title="${w} × ${hh}"><i class="pr-ret" style="aspect-ratio:${w}/${hh}"></i><span>${r}</span></button>`).join('')}</div>`);
      $$('[data-r]', tam).forEach(b => b.onclick = () => { const [, w, hh] = this.TAMANHOS.find(x => x[0] === b.dataset.r); P.w = w; P.h = hh; App.commit('Tamanho'); App.enquadrar(); }); c.appendChild(tam);
      const g = h('<div class="pr-num-grade"></div>'), sz = () => { App.commit('Tamanho'); App.enquadrar(); };
      g.append(this.num('Largura', P.w, { passo: 2, min: 64, max: 4096, dec: 0, unid: 'px' }, v => { P.w = Math.round(v); }, sz), this.num('Altura', P.h, { passo: 2, min: 64, max: 4096, dec: 0, unid: 'px' }, v => { P.h = Math.round(v); }, sz),
        this.num('FPS', P.fps, { passo: .1, min: 1, max: 60, dec: 0, dica: 'Quadros por segundo' }, v => { P.fps = Math.round(v); }, () => App.commit('fps')),
        this.num('Duração', P.duracao, { passo: 1, min: 1, max: 20000, dec: 0, unid: 'q', dica: `Quantos quadros a animação tem (${(P.duracao / P.fps).toFixed(1).replace('.', ',')} s)` }, v => { P.duracao = Math.round(v); }, () => { if (App.q > P.duracao - 1) App.q = P.duracao - 1; App.commit('Duração'); }));
      c.appendChild(g);
    }, aberto));
    const fp = App.fundoPalco();
    el.appendChild(this.secao('p-fundo', 'Fundo', fp.modo === 'cor' ? 'cor lisa' : 'quadriculado', c => {
      c.appendChild(h('<div class="pr-info">Onde não tem nada: aparece na câmera, no vídeo e recebe os efeitos.</div>'));
      const m = h(`<div class="pr-seg"><span>Tipo</span><div><button data-m="quadriculado" class="${fp.modo === 'quadriculado' ? 'on' : ''}">Quadriculado</button><button data-m="cor" class="${fp.modo === 'cor' ? 'on' : ''}">Cor lisa</button></div></div>`);
      $$('[data-m]', m).forEach(b => b.onclick = () => { App.mudaFundoPalco({ modo: b.dataset.m }); this.pinta(); }); c.appendChild(m);
      c.appendChild(this.cor('Cor', fp.cor, v => App.mudaFundoPalco({ cor: v }, false), () => App.mudaFundoPalco({})));
      if (fp.modo === 'quadriculado') c.appendChild(this.barra('Intensidade', fp.forca, v => App.mudaFundoPalco({ forca: v }, false), () => App.mudaFundoPalco({})));
      const pad = h(`<div class="pr-acoes"><button class="btn sm">${ic('undo', 13)} Padrão</button></div>`); $('button', pad).onclick = () => { App.mudaFundoPalco({ modo: 'quadriculado', cor: '#cfcfcf', forca: .35 }); this.pinta(); }; c.appendChild(pad);
    }, aberto));
  },
  // Trêmulo: deixa a camada parada "viva" (treme ou ondula sozinha, quadro a quadro), como o efeito do Premiere
  tremulo(n, semCab) {
    const T = n.tremulo, box = h(`<div class="sessao" style="${semCab ? 'border:0;padding:0' : 'margin:6px -10px 0;padding:8px 10px'}">${semCab ? '' : '<h4>Trêmulo <small>a camada parada treme sozinha</small></h4>'}
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
  /* ---------- Efeitos ----------
     Em cima: o que já está ligado — a CAMADA DE EFEITO escolhida (lista dos efeitos com força, tempo e tirar) ou, com uma camada comum
     escolhida, os efeitos SÓ DELA (Trêmulo/Ondular, que antes ficavam nas Propriedades). Embaixo: a BIBLIOTECA em grupos que abrem/fecham
     (Cor, Tela, Movimento, Transições); clicar põe na camada de efeito escolhida ou cria uma acima da camada escolhida. */
  GRUPOS_EF: [
    ['tela', 'Tela', ['vinheta', 'granulado', 'cinema', 'desfoque', 'brilho', 'vhs', 'escurecer', 'clarear']],
    ['mov', 'Movimento', ['tremor', 'tremulo:tremer', 'tremulo:ondular']],
    ['trans', 'Cortes entre cenas', ['chicote', 'zoomcorte', 'flash']],
  ],
  DICAS_EF: { vinheta: 'Escurece as bordas', granulado: 'Grão de filme', cinema: 'Faixas pretas em cima e embaixo', desfoque: 'Imagem borrada', brilho: 'Brilho suave em volta da luz', vhs: 'Fita antiga, linhas e cor separada', escurecer: 'Tudo mais escuro', clarear: 'Tudo mais claro', tremor: 'A tela inteira treme', 'tremulo:tremer': 'Tudo abaixo treme quadro a quadro', 'tremulo:ondular': 'Tudo abaixo ondula', chicote: 'Passa borrando para o lado (o corte fica no meio)', zoomcorte: 'Zoom borrado no corte', flash: 'Clarão branco' },
  // item da biblioteca que dá para ARRASTAR para a timeline (js/folhavideo.js mostra onde cai)
  arrastavel(el, d) { el.draggable = true; el.ondragstart = e => { Folha.arrasto = d; e.dataTransfer.effectAllowed = 'copy'; try { e.dataTransfer.setData('text/plain', d.nome); } catch { } document.body.classList.add('arrastando-ef'); };
    el.ondragend = () => { Folha.arrasto = null; document.body.classList.remove('arrastando-ef'); }; return el; },
  efDef(id) { if (id.startsWith('tremulo:')) { const m = id.split(':')[1]; return { id: 'tremulo', modo: m, nome: m === 'tremer' ? 'Trêmulo' : 'Ondular', ic: 'wave', forca: .4 }; } return Efeitos.TELA.find(e => e.id === id); },
  DICAS_ES: { pop: 'cresce rápido e quica', carimbo: 'cai grande e bate', aparecer: 'fade: vai aparecendo', subir: 'sobe para o lugar', descer: 'desce para o lugar', girar: 'chega girando', esticar: 'estica e volta' },
  ICS_ES: { pop: 'zoomIn', carimbo: 'square', aparecer: 'eye', subir: 'up', descer: 'down', girar: 'redo', esticar: 'move' },
  efeitos(el) {
    const P = App.P, s = App.noSel(), alvo = s?.tipo === 'efeito' ? s : null, toda = this.toda ?? true;
    const tem = (tipo, extra = {}) => alvo?.efeitos.some(e => e.tipo === tipo && Object.entries(extra).every(([k, v]) => e[k] === v));
    // 1) o que está ligado agora
    if (alvo) el.appendChild(this.camadaEfeito(alvo));
    else if (s) {
      const defP = s.tipo === 'personagem' ? P.personagens[s.ref] : null, cab = h('<div class="pr-topo"></div>');
      cab.appendChild(this.cabecalho(defP ? Icone.html(defP, 26) : ic(TIPO_IC[s.tipo] || 'layers', 16), esc(s.nome), 'efeitos só desta camada')); el.appendChild(cab);
      el.appendChild(this.secao('e-trem', 'Trêmulo', s.tremulo ? (s.tremulo.modo === 'ondular' ? 'ondulando' : 'tremendo') : 'a camada parada fica viva', c => c.appendChild(this.tremulo(s, true)), true));
    }
    // 2) para onde vai o que for clicado
    const destino0 = alvo ? `Clique para pôr em <b>${esc(alvo.nome)}</b>.` : `Clique cria uma <b>camada de efeito</b> ${s ? `acima de <b>${esc(s.nome)}</b>` : 'no topo'}: vale para tudo o que está abaixo dela.`;
    const destino = destino0 + ' Ou <b>arraste para a timeline</b>: ela mostra onde vai cair.';
    const ond = h(`<div class="ef-onde"><div class="ef-dica">${ic('info', 13)}<span>${destino}</span></div>${alvo ? '' : `<div class="pr-seg"><span>Duração</span><div><button data-t="1" class="${toda ? 'on' : ''}" title="Do primeiro ao último quadro">Toda a timeline</button><button data-t="0" class="${toda ? '' : 'on'}" title="Começa no quadro de agora e dura um pouco">Daqui, um pouco</button></div></div>`}</div>`);
    $$('[data-t]', ond).forEach(b => b.onclick = () => { this.toda = b.dataset.t === '1'; this.pinta(); }); el.appendChild(ond);
    // 3) biblioteca
    el.appendChild(this.secao('e-cor', 'Cor', 'o visual de tudo abaixo', c => {
      const g = h('<div class="visuais"></div>');
      for (const v of Efeitos.VISUAIS) { if (v.id === 'normal') continue; const b = h(`<button class="visual ${tem('cor', { visual: v.id }) ? 'on' : ''}" title="${esc(v.nome)}"><i style="background:linear-gradient(135deg,${v.cor[0]},${v.cor[1]});filter:${v.f || 'none'}"></i><span>${esc(v.nome)}</span></button>`); b.onclick = () => App.addEfeito({ tipo: 'cor', visual: v.id }); this.arrastavel(b, { k: 'ef', e: { tipo: 'cor', visual: v.id }, nome: 'Cor ' + v.nome }); g.appendChild(b); }
      c.appendChild(g);
    }, true));
    for (const [gid, nome, ids] of this.GRUPOS_EF) el.appendChild(this.secao('e-' + gid, nome, '', c => {
      const g = h('<div class="ef-lib"></div>');
      for (const id of ids) { const ef = this.efDef(id); if (!ef) continue; const on = tem(ef.id, ef.modo ? { modo: ef.modo } : {});
        const b = h(`<button class="ef-it ${on ? 'on' : ''}" title="${esc(this.DICAS_EF[id] || ef.nome)}">${ic(ef.ic, 15)}<span><b>${esc(ef.nome.replace('Transição ', ''))}</b><small>${esc(this.DICAS_EF[id] || '')}</small></span>${on ? ic('check', 13) : ic('plus', 13)}</button>`);
        const eo = { tipo: ef.id, forca: ef.forca, ...(ef.modo ? { modo: ef.modo, ritmo: 2 } : {}) };
        b.onclick = () => App.addEfeito({ ...eo }); this.arrastavel(b, { k: 'ef', e: eo, nome: ef.nome.replace('Transição ', '') }); g.appendChild(b); }
      c.appendChild(g);
    }, gid !== 'trans'));
    // TRANSIÇÕES DE ENTRADA E SAÍDA (de uma camada) e FADES DO SOM
    const camS = s && s.tipo !== 'efeito' ? s : null, audS = (P.audios || []).find(a => a.id === App.sel);
    el.appendChild(this.secao('e-es', 'Entrada e saída', camS ? esc(camS.nome) : 'arraste para uma camada', c => {
      c.appendChild(h(`<div class="pr-info">Arraste para o <b>começo</b> (entrada) ou o <b>fim</b> (saída) de uma camada na timeline${camS ? `, ou clique para pôr em <b>${esc(camS.nome)}</b>` : ''}. A duração muda pela alça branca no canto do clipe.</div>`));
      const g = h('<div class="ef-lib duas"></div>');
      for (const [id, nm] of Object.entries(Modelo.ANIMS)) { const on = camS && (camS.entra?.tipo === id || camS.sai?.tipo === id);
        const b = h(`<button class="ef-it ${on ? 'on' : ''}" title="${esc(this.DICAS_ES[id] || nm)}">${ic(this.ICS_ES[id] || 'transition', 14)}<span><b>${esc(nm)}</b><small>${esc(this.DICAS_ES[id] || '')}</small></span></button>`);
        b.onclick = ev => { if (!camS) return UI.toast('Escolha uma camada ou arraste para a timeline.', { kind: 'warn' }); const poe = k => { if (k === 'sai' && camS.ate == null) camS.ate = Modelo.fimNo(P, camS); camS[k] = { tipo: id, q: camS[k]?.q || Math.round(P.fps * .25) }; App.commit((k === 'entra' ? 'Entrada: ' : 'Saída: ') + nm); };
          const r = b.getBoundingClientRect(); UI.ctx(r.left, r.bottom + 2, [{ head: `${nm} em ${camS.nome}` }, { label: 'Na entrada', icon: 'start', checked: camS.entra?.tipo === id, action: () => poe('entra') }, { label: 'Na saída', icon: 'end', checked: camS.sai?.tipo === id, action: () => poe('sai') }]); };
        this.arrastavel(b, { k: 'anim', tipo: id, nome: nm }); g.appendChild(b); }
      c.appendChild(g);
      // som
      c.appendChild(h(`<div class="ef-sub">${ic('vol', 12)} Som</div>`));
      const gs = h('<div class="ef-lib duas"></div>');
      for (const [k, nm, dc] of [['fi', 'Fade de entrada', 'o som começa baixinho'], ['fo', 'Fade de saída', 'o som termina baixinho']]) { const on = audS && audS[k];
        const b = h(`<button class="ef-it ${on ? 'on' : ''}" title="${dc}">${ic(k === 'fi' ? 'start' : 'end', 14)}<span><b>${nm}</b><small>${dc}</small></span></button>`);
        b.onclick = () => { if (!audS) return UI.toast('Escolha um áudio na timeline (ou arraste o fade para ele).', { kind: 'warn' }); if (audS[k]) delete audS[k]; else audS[k] = .5; App.commit(nm + ' do som'); };
        this.arrastavel(b, { k: 'fade', nome: nm }); gs.appendChild(b); }
      c.appendChild(gs);
    }, true));
    // efeitos antigos do vídeo todo (projetos de antes das camadas de efeito)
    const velhos = P.efeitos.tela || [];
    if (velhos.length || (P.efeitos.visual && P.efeitos.visual !== 'normal')) el.appendChild(this.secao('e-velhos', 'Do vídeo todo (antigos)', '', c => {
      const box = h(`<div><div class="pr-info">${[P.efeitos.visual !== 'normal' && Efeitos.visual(P.efeitos.visual).nome, ...velhos.map(e => Efeitos.nomeEf(e) + ` (${e.de + 1}–${e.ate + 1})`)].filter(Boolean).map(esc).join(' · ')}</div><div class="pr-acoes"><button class="btn sm" data-conv>${ic('layers', 13)} Virar camada de efeito</button><button class="btn sm" data-tira>${ic('trash', 13)} Tirar</button></div></div>`);
      $('[data-conv]', box).onclick = () => App.converterEfeitosAntigos(); $('[data-tira]', box).onclick = () => { P.efeitos = { visual: 'normal', tela: [] }; App.commit('Tirar efeitos antigos'); };
      c.appendChild(box);
    }, true));
  },
  // os efeitos de uma camada de efeito: força, tempo próprio e tirar
  camadaEfeito(n) {
    const P = App.P, fim = Modelo.fimNo(P, n), box = h('<div class="ef-camada"></div>');
    const cab = this.cabecalho(ic('sparkles', 16), `<input class="pr-nome" value="${esc(n.nome)}" title="Nome da camada de efeito">`, `camada de efeito · quadros ${(n.de || 0) + 1}–${n.ate == null ? 'fim' : fim + 1}`,
      `<button class="ibtn ${n.vis === false ? 'off' : ''}" data-vis title="${n.vis === false ? 'Ligar' : 'Desligar'} todos">${ic(n.vis === false ? 'eyeOff' : 'eye', 14)}</button>`);
    $('.pr-nome', cab).onchange = ev => { n.nome = ev.target.value.trim() || n.nome; n.nomeAuto = false; App.commit('Nome da camada'); };
    $('[data-vis]', cab).onclick = () => { n.vis = n.vis === false; App.commit(n.vis ? 'Ligar efeitos' : 'Desligar efeitos'); };
    box.appendChild(cab);
    const tm = h(`<div class="pr-acoes" style="margin:8px 0 0">${n.de || n.ate != null ? `<button class="btn sm" data-toda title="Do primeiro ao último quadro">${ic('loop', 13)} Toda a timeline</button>` : ''}<button class="btn sm" data-sel title="Escolher as camadas abaixo dela na hierarquia">${ic('layers', 13)} Ver na hierarquia</button></div>`);
    if ($('[data-toda]', tm)) $('[data-toda]', tm).onclick = () => { n.de = 0; n.ate = null; n.chaves = { 0: n.chaves?.[Object.keys(n.chaves || {})[0]] || { x: 0, y: 0, r: 0, s: 1, sx: 1, op: 1 } }; App.commit('Na timeline toda'); };
    $('[data-sel]', tm).onclick = () => App.selecionar(n.id); box.appendChild(tm);
    const lista = h('<div class="ef-lista"></div>');
    if (!n.efeitos.length) lista.appendChild(h('<div class="nq-vazio">Sem efeitos: escolha um na biblioteca abaixo.</div>'));
    for (const e of n.efeitos) {
      const def = e.tipo === 'cor' ? null : this.efDef(e.tipo === 'tremulo' ? 'tremulo:' + (e.modo || 'tremer') : e.tipo), vis = e.tipo === 'cor' ? Efeitos.visual(e.visual) : null;
      const lin = h(`<div class="ef-card"><div class="ef-cc">${vis ? `<i class="ef-cor" style="background:linear-gradient(135deg,${vis.cor[0]},${vis.cor[1]})"></i>` : ic(def?.ic || 'sparkles', 14)}<b>${esc(Efeitos.nomeEf(e))}</b>${e.de != null ? `<small>quadros ${e.de + 1}–${(e.ate ?? fim) + 1}</small>` : ''}<button class="ibtn" data-x title="Tirar este efeito">${ic('trash', 13)}</button></div><div data-c></div></div>`);
      const c = $('[data-c]', lin);
      if (e.tipo !== 'cor') c.appendChild(this.barra('Força', e.forca ?? .5, v => { e.forca = Math.max(.02, v); App.pinta(); }, () => App.commit('Força')));
      if (e.tipo === 'tremulo') c.appendChild(this.num('Ritmo', e.ritmo || 2, { passo: .05, min: 1, max: 8, dec: 0, unid: 'q', dica: 'Quantos quadros até mudar (2 = 12 vezes por segundo a 24 fps)' }, v => { e.ritmo = Math.round(v); App.pinta(); }, () => App.commit('Ritmo')));
      if (e.tipo === 'chicote') { const sl = h(`<div class="pr-seg"><span>Vai para</span><div><button data-l="esq" class="${e.lado !== 'dir' ? 'on' : ''}">Esquerda</button><button data-l="dir" class="${e.lado === 'dir' ? 'on' : ''}">Direita</button></div></div>`); $$('[data-l]', sl).forEach(b => b.onclick = () => { e.lado = b.dataset.l; App.commit('Lado do chicote'); }); c.appendChild(sl); }
      if (Efeitos.TRANS.includes(e.tipo)) c.appendChild(h('<div class="pr-info">O corte fica no meio: ponha o fim de uma cena e o começo da outra ali.</div>'));
      if (e.de != null) { const t = h(`<div class="pr-acoes"><button class="btn sm" data-tudo title="Vale o tempo todo da camada">${ic('loop', 13)} Tempo todo da camada</button></div>`); $('[data-tudo]', t).onclick = () => { delete e.de; delete e.ate; App.commit('Tempo todo'); }; c.appendChild(t); }
      $('[data-x]', lin).onclick = () => { n.efeitos = n.efeitos.filter(x => x !== e); App.nomeEfeito(n); App.commit('Tirar ' + Efeitos.nomeEf(e)); };
      lista.appendChild(lin);
    }
    box.appendChild(lista);
    box.appendChild(h('<div class="pr-info" style="margin:8px 0 0">Vale para o que está <b>abaixo</b> desta camada na hierarquia, até a próxima camada de efeito. Arraste a barra na timeline para mudar o tempo.</div>'));
    return box;
  },

  /* ---------- Voz e legendas ----------
     Mesmo visual das Propriedades: topo com Gravar/Pôr áudio/Transcrever e o resumo; MIXAGEM (música abaixa na fala) em seção;
     cada áudio é um CARTÃO que abre/fecha (aberto = o escolhido na timeline, `_audAb` guarda os abertos nesta aba): cabeçalho com
     a cor do tipo, nome editável, M/S, ouvir só ele, ir até lá e tirar; dentro a ONDA do pedaço usado (clicar leva o quadro até lá),
     tipo em botões, tempo (começa/corte/duração/termina), volume 0–200%, fades, repetir, e as ferramentas (corte, limpar, duplicar). */
  COR_AUD: { voz: '#8fe0b4', musica: '#9fb7ff', efeito: '#ffd27a' },
  IC_AUD: { voz: 'mic', musica: 'music', efeito: 'bolt' },
  som(el) {
    const P = App.P, fps = P.fps, tot = P.audios.reduce((m, a) => Math.max(m, Som.buf.get(a.arq) ? (Som.fimQ(P, a) + 1) / fps : 0), 0);
    const top = h(`<div class="pr-topo"><div class="pr-cab"><span class="pr-ic">${ic('music', 16)}</span><div class="pr-nm">Voz e sons<small>${P.audios.length ? `${P.audios.length} áudio${P.audios.length > 1 ? 's' : ''} · até ${Exportar.tc(tot)}` : 'nenhum áudio ainda'}</small></div></div>
      <div class="pr-acoes" style="margin:9px 0 0"><button class="btn sm" data-gravar>${ic('mic', 13)} Gravar</button><button class="btn sm" data-add>${ic('upload', 13)} Pôr áudio</button>${P.audios.length ? `<button class="btn sm ia" data-tr>${ic('text', 13)} Transcrever</button>` : ''}</div></div>`);
    $('[data-add]', top).onclick = () => Som.importar(); $('[data-gravar]', top).onclick = () => Som.gravar(); if ($('[data-tr]', top)) $('[data-tr]', top).onclick = () => Som.transcrever();
    el.appendChild(top);
    if (!P.audios.length) el.appendChild(h(`<div class="pr-vazio">${ic('music', 22)}Grave a voz, ponha uma música ou solte um arquivo de áudio na timeline.</div>`));
    // MIXAGEM do projeto: a música abaixa sozinha enquanto alguém fala (P.mix)
    if (P.audios.some(a => Som.tipo(a) === 'musica')) el.appendChild(this.secao('v-mix', 'Mixagem', (P.mix || {}).duck !== false ? 'música abaixa na fala' : '', c => {
      const mx = P.mix || {}, ck = h(`<label class="chk" style="margin-bottom:8px"><input type="checkbox" ${mx.duck !== false ? 'checked' : ''}> Abaixar a música quando alguém fala</label>`);
      $('input', ck).onchange = ev => { P.mix = { ...(P.mix || {}), duck: ev.target.checked }; App.commit('Música abaixa na fala'); };
      c.append(ck, this.barra('Música na fala', mx.nivel ?? .45, v => { P.mix = { ...(P.mix || {}), nivel: v }; Folha.desenha(); }, () => App.commit('Nível da música na fala')));
      c.appendChild(h('<div class="pr-info">Enquanto uma <b>voz</b> toca, as <b>músicas</b> descem para esse volume e voltam devagar depois.</div>'));
    }, true));
    this._audAb ||= new Set();
    for (const a of P.audios) el.appendChild(this.cartaoAudio(P, a));
    this.legendas(el, P);
  },
  cartaoAudio(P, a) {
    const fps = P.fps, tipo = Som.tipo(a), cor = this.COR_AUD[tipo], b = Som.buf.get(a.arq), len = Som.compr(a), sg = x => String(round(x, 2)).replace('.', ',');
    const sel = App.sel === a.id, ab = sel || this._audAb.has(a.id) || P.audios.length === 1, ouv = this._ouve?.id === a.id;
    const ca = h(`<div class="au-c ${ab ? 'ab' : ''} ${sel ? 'sel' : ''} ${a.mudo || !Som.ouve(P, a) ? 'mudo' : ''}" style="--au:${cor}">
      <div class="au-cab"><button class="au-seta" data-ab title="Abrir/fechar">${ic('right', 11)}</button><span class="au-ic">${ic(this.IC_AUD[tipo], 14)}</span>
        <div class="au-nm"><input class="pr-nome" value="${esc(a.nome)}" title="Nome do áudio"><small>${Som.TIPOS[tipo]} · ${b ? `${Exportar.tc((a.de || 0) / fps)}–${Exportar.tc((Som.fimQ(P, a) + 1) / fps)} · ${sg(len)} s` : 'carregando…'}</small></div>
        <button class="au-t ${a.mudo ? 'on m' : ''}" data-m title="Mudo (não sai no vídeo)">M</button><button class="au-t ${a.solo ? 'on s' : ''}" data-s title="Solo (só os áudios em solo saem)">S</button>
        <button class="ibtn ${ouv ? 'on' : ''}" data-ouv title="${ouv ? 'Parar' : 'Ouvir só este áudio'}">${ic(ouv ? 'pause' : 'play', 13)}</button></div>
      <div class="au-corpo"></div></div>`);
    const nm = $('.pr-nome', ca); nm.onchange = () => { a.nome = nm.value.trim() || a.nome; App.commit('Nome do áudio'); }; nm.onkeydown = e => { if (e.key === 'Enter') nm.blur(); }; nm.onfocus = () => App.selecionar?.(a.id);
    $('[data-ab]', ca).onclick = () => { const v = !ca.classList.contains('ab'); ca.classList.toggle('ab', v); v ? this._audAb.add(a.id) : this._audAb.delete(a.id); };
    $('[data-m]', ca).onclick = () => { a.mudo = !a.mudo; if (!a.mudo) delete a.mudo; App.commit('Mudo'); };
    $('[data-s]', ca).onclick = () => { a.solo = !a.solo; if (!a.solo) delete a.solo; App.commit('Solo'); };
    $('[data-ouv]', ca).onclick = () => this.ouvir(P, a);
    const c = $('.au-corpo', ca);
    if (!a.mudo && !Som.ouve(P, a)) c.appendChild(h(`<div class="pr-info au-aviso">${ic('alert', 12)} Não sai no vídeo: tem outro áudio em <b>Solo</b>.</div>`));
    // a ONDA do pedaço usado (com volume e fades); clicar leva o quadro até lá
    if (b) { const cv = h('<canvas class="au-onda" width="560" height="64" title="Clique para ir até esse ponto"></canvas>'); this.ondaAudio(cv, P, a); c.appendChild(cv);
      cv.onclick = e => { const r = cv.getBoundingClientRect(); App.setQ(clamp((a.de || 0) + Math.round((e.clientX - r.left) / r.width * len * fps), 0, P.duracao - 1)); }; }
    // TIPO
    const tp = h(`<div class="pr-seg"><span>Tipo</span><div>${Object.entries(Som.TIPOS).map(([id, n]) => `<button data-t="${id}" class="${tipo === id ? 'on' : ''}">${ic(this.IC_AUD[id], 12)} ${id === 'efeito' ? 'Efeito' : n}</button>`).join('')}</div></div>`);
    $$('[data-t]', tp).forEach(x => x.onclick = () => { a.tipo = x.dataset.t; App.commit('Tipo do áudio'); }); c.appendChild(tp);
    // TEMPO: começa (quadro), corte (onde começa no arquivo) e duração
    const sol = nome => () => App.commit(nome), g = h('<div class="pr-num-grade" style="margin-top:8px"></div>');
    g.append(this.num('Começa', (a.de || 0) + 1, { passo: 1, min: 1, max: P.duracao, dec: 0, unid: 'q', dica: `Quadro onde o áudio começa na timeline (${Exportar.tc((a.de || 0) / fps)})` }, v => { a.de = Math.round(v) - 1; Folha.desenha(); }, sol('Mover o áudio')),
      this.num('Dura', len, { passo: .05, min: .05, max: a.loop ? 3600 : Math.max(.05, (b?.duration || len) - Som.ini(a)), dec: 2, unid: 's', dica: 'Quanto do áudio toca (arraste as pontas na timeline também)' }, v => { a.dur = round(v, 3); Folha.desenha(); }, sol('Cortar o áudio')),
      this.num('Corte', Som.ini(a), { passo: .05, min: 0, max: Math.max(0, (b?.duration || 1) - .05), dec: 2, unid: 's', dica: 'Pula esse tanto do começo do arquivo (Alt + arrastar no meio do áudio na timeline desliza)' }, v => { if (v > 0) a.ini = round(v, 3); else delete a.ini; Folha.desenha(); }, sol('Cortar o áudio')),
      this.num('Termina', Som.fimQ(P, a) + 1, { passo: 1, min: (a.de || 0) + 1, max: 999999, dec: 0, unid: 'q', dica: 'Quadro onde o áudio termina (muda a duração)' }, v => { a.dur = round(Math.max(1, v - (a.de || 0)) / fps, 3); Folha.desenha(); }, sol('Cortar o áudio')));
    c.appendChild(g);
    const aq = h(`<div class="pr-acoes"><button class="btn sm" data-aq title="O áudio passa a começar no quadro de agora (${App.q + 1})">${ic('marker', 13)} Começar aqui</button><button class="btn sm" data-ir title="Levar o quadro até o começo do áudio">${ic('jump', 13)} Ir até lá</button>${a.dur != null || a.ini ? `<button class="btn sm" data-int title="Volta a tocar o arquivo inteiro">${ic('undo', 13)} Arquivo inteiro</button>` : ''}</div>`);
    $('[data-aq]', aq).onclick = () => { a.de = App.q; App.commit('Mover o áudio'); }; $('[data-ir]', aq).onclick = () => App.setQ(a.de || 0);
    if ($('[data-int]', aq)) $('[data-int]', aq).onclick = () => { delete a.dur; delete a.ini; App.commit('Arquivo inteiro'); };
    c.appendChild(aq);
    // VOLUME (0–200%) e FADES
    c.appendChild(this.volume(a));
    const maxF = Math.max(.1, Math.min(10, len / 2)), gf = h('<div class="pr-num-grade"></div>');
    gf.append(this.num('Entrar', +a.fi || 0, { passo: .05, min: 0, max: maxF, dec: 2, unid: 's', dica: 'Fade de entrada: o som começa baixinho e sobe nesse tempo' }, v => { if (v > 0) a.fi = round(v, 3); else delete a.fi; Folha.desenha(); }, sol('Fade de entrada')),
      this.num('Sair', +a.fo || 0, { passo: .05, min: 0, max: maxF, dec: 2, unid: 's', dica: 'Fade de saída: o som desce até sumir nesse tempo' }, v => { if (v > 0) a.fo = round(v, 3); else delete a.fo; Folha.desenha(); }, sol('Fade de saída')));
    c.appendChild(gf);
    const fr = h(`<div class="pr-acoes au-fades"><span>Fades</span>${[[0, 'Sem'], [.15, 'Curto'], [.5, 'Médio'], [1.5, 'Longo']].map(([v, n]) => `<button class="btn sm ${(+a.fi || 0) === v && (+a.fo || 0) === v ? 'on' : ''}" data-f="${v}">${n}</button>`).join('')}</div>`);
    $$('[data-f]', fr).forEach(x => x.onclick = () => { const v = Math.min(+x.dataset.f, maxF); if (v) { a.fi = v; a.fo = v; } else { delete a.fi; delete a.fo; } App.commit('Fades'); }); c.appendChild(fr);
    const lp = h(`<label class="chk" style="margin:0 0 8px" title="Repete o som até o fim do bloco (bom para música de fundo)"><input type="checkbox" ${a.loop ? 'checked' : ''}> Repetir (loop)${a.loop ? ' · estique o bloco na timeline' : ''}</label>`);
    $('input', lp).onchange = ev => { a.loop = ev.target.checked; if (!a.loop) { delete a.loop; if (a.dur != null && a.dur > Som.compr({ ...a, dur: null })) delete a.dur; } App.commit('Repetir'); }; c.appendChild(lp);
    // VOLUME EM TRECHOS (feito pela IA ou pelo trecho marcado)
    if ((a.volTrechos || []).length) { const vt = h(`<div class="vol-trechos"><div class="vt-cab">Volume em trechos</div></div>`);
      a.volTrechos.slice().sort((x, y) => x.de - y.de).forEach(t => { const r = h(`<div class="campo2 vt-row"><button class="btn sm" data-ir title="Ir até lá">${esc(Trechos.rotulo(t, P))}</button><span class="sp"></span><input type="number" min="0" max="200" step="5" value="${Math.round(t.vol * 100)}" style="width:62px"><span>%</span><button class="ibtn" data-x title="Tirar (volta ao volume geral)">${ic('x', 12)}</button></div>`);
        $('[data-ir]', r).onclick = () => App.setQ(t.de); $('input', r).onchange = ev => { t.vol = clamp(+ev.target.value / 100, 0, 2); App.commit('Volume do trecho'); };
        $('[data-x]', r).onclick = () => { a.volTrechos = a.volTrechos.filter(x => x !== t); App.commit('Volume do trecho'); }; vt.appendChild(r); });
      c.appendChild(vt); }
    // FERRAMENTAS
    const fe = h(`<div class="pr-acoes au-ferr"><button class="btn sm" data-corte title="Janela com a onda grande: cortar, dividir, tirar silêncios (dois cliques no áudio na timeline também abre)">${ic('cut', 13)} Editar o corte…</button>
      ${tipo === 'voz' ? `<button class="btn sm" data-limpa title="Tira ronco e zumbido, deixa a voz mais clara, comprime e nivela o volume (vira um áudio novo; dá para voltar)">${ic('wand', 13)} Limpar e nivelar</button>` : ''}
      ${a.arqOrig ? `<button class="btn sm" data-orig>${ic('undo', 13)} Voltar ao original</button>` : ''}
      <button class="btn sm" data-dup title="Mais uma cópia deste áudio, logo depois dele">${ic('copy', 13)} Duplicar</button><span class="sp"></span><button class="ibtn" data-x title="Tirar o áudio">${ic('trash', 13)}</button></div>`);
    $('[data-corte]', fe).onclick = () => CorteVoz.abrir(a); if ($('[data-limpa]', fe)) $('[data-limpa]', fe).onclick = () => Som.limpar(a); if ($('[data-orig]', fe)) $('[data-orig]', fe).onclick = () => Som.voltarOriginal(a);
    $('[data-dup]', fe).onclick = () => { const n = JSON.parse(JSON.stringify(a)); n.id = uid(); n.nome = a.nome + ' (cópia)'; n.de = Som.fimQ(P, a) + 1; delete n.solo; P.audios.splice(P.audios.indexOf(a) + 1, 0, n); this._audAb.add(n.id); App.commit('Duplicar áudio'); };
    $('[data-x]', fe).onclick = () => { if (this._ouve?.id === a.id) this.ouvir(P, a); P.audios = P.audios.filter(x => x !== a); App.commit('Tirar áudio'); };
    c.appendChild(fe);
    return ca;
  },
  // volume 0–200% (100% = como o arquivo está), com o valor em dB na dica
  volume(a) {
    const v0 = a.vol ?? 1, el = h(`<label class="pr-barra au-vol"><span>Volume</span><input type="range" min="0" max="200" step="1" value="${Math.round(v0 * 100)}"><b>${Math.round(v0 * 100)}%</b></label>`), r = $('input', el), b = $('b', el);
    const db = v => v <= 0 ? 'mudo' : (20 * Math.log10(v) >= 0 ? '+' : '') + (20 * Math.log10(v)).toFixed(1).replace('.', ',') + ' dB', dica = v => el.title = `${Math.round(v * 100)}% · ${db(v)} · dois cliques volta a 100%`; dica(v0);
    r.oninput = () => { const v = +r.value / 100; b.textContent = r.value + '%'; dica(v); a.vol = v; Folha.desenha(); }; r.onchange = () => App.commit('Volume');
    el.ondblclick = () => { a.vol = 1; App.commit('Volume'); }; return el;
  },
  ondaAudio(cv, P, a) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, f = Som.finos(a.arq), b = Som.buf.get(a.arq); if (!f || !b) return;
    const ini = Som.ini(a), len = Som.compr(a), L = Math.max(.05, b.duration - ini), cor = this.COR_AUD[Som.tipo(a)], vol = a.vol ?? 1, fi = +a.fi || 0, fo = +a.fo || 0;
    g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, 0, W, H); g.fillStyle = cor; g.globalAlpha = a.mudo ? .3 : .85;
    for (let x = 0; x < W; x++) { const t0 = x / W * len, t1 = (x + 1) / W * len, m = a => a.loop ? ini + (((a.t) % L) + L) % L : ini + a.t;
      let v = Som.picoEntre(a.arq, m({ loop: a.loop, t: t0 }), m({ loop: a.loop, t: t1 })) * f.top * vol; if (fi && t0 < fi) v *= t0 / fi; if (fo && t0 > len - fo) v *= Math.max(0, (len - t0) / fo);
      const hh = Math.max(1, Math.min(1, v) * (H / 2 - 3)); g.fillRect(x, H / 2 - hh, 1, hh * 2); if (v > 1) { g.fillStyle = '#ff6b6b'; g.fillRect(x, 0, 1, 3); g.fillRect(x, H - 3, 1, 3); g.fillStyle = cor; } }
    g.globalAlpha = 1; const dq = App.q - (a.de || 0); if (dq >= 0 && dq / P.fps <= len) { g.fillStyle = '#ff5a5a'; g.fillRect(Math.round(dq / P.fps / len * W), 0, 2, H); }
  },
  // ouvir SÓ este áudio (do corte, com volume e fades), sem tocar a animação; clicar de novo para
  ouvir(P, a) {
    const ja = this._ouve; if (ja) { try { ja.src.stop(); } catch { } this._ouve = null; if (ja.id === a.id) return this.pinta(); }
    const b = Som.buf.get(a.arq); if (!b) return UI.toast('O áudio ainda está carregando.', { kind: 'warn' });
    const ac = Som.ac(); ac.resume(); const t0 = ac.currentTime + .03, src = Som.fonte(ac, ac.destination, P, { ...a, de: 0, mudo: false }, b, 0, t0, []);
    if (!src) return; this._ouve = { id: a.id, src }; src.onended = () => { if (this._ouve?.src === src) { this._ouve = null; this.pinta(); } }; this.pinta();
  },
  legendas(el, P) {
    const lg = h(`<div><div class="pr-acoes"><button class="btn sm" data-nova title="Legenda nova no quadro de agora">${ic('plus', 13)} Nova legenda</button>${P.legendas.length ? `<button class="btn sm" data-motor title="Blocos de uma linha (até 22 letras / 4 palavras), na cor de quem fala, sem piscar — o mesmo motor do Shorts. As que você mudou ficam.">${ic('text', 13)} Em blocos</button><span class="sp"></span><button class="btn sm" data-lmp>${ic('trash', 13)} Apagar todas</button>` : ''}</div><div class="lg" style="display:grid;gap:4px"></div></div>`);
    const box = $('.lg', lg);
    // estilo das legendas (como nos Shorts): posição, tamanho, cores, caixa alta, palavra falada acesa, pop ao entrar
    const st = P.legEstilo || {}, est = h(`<div class="leg-estilo"><div class="campo2"><span style="color:var(--tx2)">Onde</span><select data-pos><option value="baixo">Embaixo</option><option value="meio" ${st.pos === 'meio' ? 'selected' : ''}>No meio</option><option value="alto" ${st.pos === 'alto' ? 'selected' : ''}>Em cima</option></select>
        <span style="color:var(--tx2)">Cor</span><input type="color" value="${st.cor || '#ffffff'}" data-cor><span style="color:var(--tx2)" title="Escreva *assim* para destacar uma palavra">Destaque</span><input type="color" value="${st.destaque || '#ffd84a'}" data-dest><span style="color:var(--tx2)" title="Cor da palavra que está sendo falada">Fala</span><input type="color" value="${st.fala || '#5ee0ff'}" data-fala></div>
      <div class="campo2"><label class="chk"><input type="checkbox" data-kar ${st.karaoke ? 'checked' : ''}> Palavra falada acesa</label><label class="chk"><input type="checkbox" data-caixa ${st.caixa ? 'checked' : ''}> CAIXA ALTA</label><label class="chk"><input type="checkbox" data-pop ${st.pop !== false ? 'checked' : ''}> Pop ao entrar</label><label class="chk" title="Legendas em blocos: palavra-chave (*assim*) na cor de destaque"><input type="checkbox" data-realce ${st.realce ? 'checked' : ''}> Palavra-chave em destaque</label></div><div class="props" style="padding:0"></div>
      <small style="color:var(--tx3)">Escreva <b>*palavra*</b> para ela aparecer na cor de destaque.</small></div>`);
    const poeE = (k, v, nome) => { P.legEstilo = { ...(P.legEstilo || {}), [k]: v }; App.commit(nome || 'Estilo das legendas'); };
    $('[data-pos]', est).onchange = ev => poeE('pos', ev.target.value); $('[data-cor]', est).onchange = ev => poeE('cor', ev.target.value); $('[data-dest]', est).onchange = ev => poeE('destaque', ev.target.value); $('[data-fala]', est).onchange = ev => poeE('fala', ev.target.value);
    $('[data-kar]', est).onchange = ev => poeE('karaoke', ev.target.checked); $('[data-caixa]', est).onchange = ev => poeE('caixa', ev.target.checked); $('[data-pop]', est).onchange = ev => poeE('pop', ev.target.checked); $('[data-realce]', est).onchange = ev => poeE('realce', ev.target.checked);
    $('.props', est).appendChild(this.campo('Tamanho', st.tam || 1, .5, 2, .05, v => { P.legEstilo = { ...(P.legEstilo || {}), tam: v }; App.pinta(); }, () => App.commit('Tamanho das legendas')));

    P.legendas.forEach((g, i) => {
      const bl = !!g.blocos?.length, r = h(`<div class="campo2" style="flex-wrap:nowrap"><input type="number" value="${g.de + 1}" style="width:54px" title="Começa"><input type="number" value="${g.ate + 1}" style="width:54px" title="Termina"><input type="text" value="${esc(bl ? Short.textoEditavel(g) : g.texto)}" style="flex:1${g.dono ? ';border-color:var(--ac)' : ''}" ${bl ? 'title="/ quebra o bloco · *palavra* = palavra-chave"' : ''}><button class="ibtn" title="Ir até ela">${ic('jump', 13)}</button></div>`);
      const [a, b, t] = $$('input', r); a.onchange = () => { g.de = Math.max(0, +a.value - 1); App.commit('Legenda'); }; b.onchange = () => { g.ate = Math.max(g.de, +b.value - 1); App.commit('Legenda'); }; t.onchange = () => { if (bl) Short.editaLegenda(P, g, t.value); else g.texto = t.value; App.commit('Legenda'); };
      $('button', r).onclick = () => App.setQ(g.de); box.appendChild(r);
    });
    $('[data-nova]', lg).onclick = () => { P.legendas.push({ de: App.q, ate: Math.min(P.duracao - 1, App.q + P.fps * 2), texto: 'Legenda' }); App.commit('Legenda'); };
    if ($('[data-motor]', lg)) $('[data-motor]', lg).onclick = async () => { const n = await Short.refazerLegendas(P); App.commit('Legendas em blocos'); UI.toast(`${n} legenda(s) em blocos.`, { kind: 'ok' }); };
    if ($('[data-lmp]', lg)) $('[data-lmp]', lg).onclick = async () => { if (await UI.confirm({ title: 'Apagar todas as legendas?', ok: 'Apagar', danger: true })) { P.legendas = []; App.commit('Apagar legendas'); } };
    if (!P.legendas.length) box.appendChild(h('<div class="pr-info">Sem legendas. Use <b>Transcrever</b> para criar pela voz, ou <b>Nova legenda</b>.</div>'));
    el.appendChild(this.secao('v-leg', 'Legendas', P.legendas.length ? `${P.legendas.length}` : '', c => c.appendChild(lg), true));
    if (P.legendas.length) el.appendChild(this.secao('v-legest', 'Estilo das legendas', '', c => c.appendChild(est)));
  },
};
