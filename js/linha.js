/* ===================== linha.js — ateliê: a TIMELINE pequena embaixo do palco =====================
   Guia das animações de teste (no lugar do antigo painel Testar): escolhe a animação, toca/pausa, anda passo a passo,
   e mostra os passos de cada trilha como quadradinhos. Clicar num passo para nele: aí clicar numa POSE (aba Poses)
   faz ESTE passo usar aquela pose. Trocar a imagem de uma parte não muda a animação (a animação só guarda poses).
   Botão direito num passo: as opções de sempre (duplicar, mover, apagar…). Arrastar um passo muda a ordem. */
'use strict';
const Linha = {
  pinta() {
    const el = $('#at-tl'); if (!el || !Atelie.def) return; const A = Animacoes; el.hidden = !!Atelie.edImg; if (el.hidden) return this.altura();
    const L = A.lista(); if (A.sel && !A.achar(A.sel)) A.sel = null; if (!A.sel && L.length) A.sel = L[0].id;
    const a = A.achar(A.sel), toca = !!a && A.tocando === a.id, rodando = toca && !A.pausado, st = A.passoAtual();
    const div = $('.at-div', el); el.innerHTML = ''; if (div) el.appendChild(div); // a borda de mudar o tamanho fica
    const cab = h(`<div class="tl-cab">${ic('film', 14)}
      <select data-a title="Animação de teste">${L.length ? L.map(x => `<option value="${x.id}" ${a && x.id === a.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('') : '<option value="">Nenhuma animação</option>'}</select>
      <button class="ibtn" data-nova title="Animação nova">${ic('plus', 14)}</button><i class="tl-sep"></i>
      <button class="ibtn" data-ant title="Frame anterior ( , )" ${a ? '' : 'disabled'}>${ic('left', 14)}</button>
      <button class="ibtn tl-play ${rodando ? 'on' : ''}" data-play title="${rodando ? 'Pausar' : 'Tocar'} (P)" ${a ? '' : 'disabled'}>${ic(rodando ? 'pause' : 'play', 15)}</button>
      <button class="ibtn tl-stop" data-stop title="Parar e voltar à pose padrão (Esc)" ${toca ? '' : 'disabled'}>${ic('stop', 13)}</button>
      <button class="ibtn" data-prox title="Próximo frame ( . )" ${a ? '' : 'disabled'}>${ic('right', 14)}</button>
      ${a ? `<select data-vel title="Cada frame dura">${VELOCIDADES.map(([v, t]) => `<option value="${v}" ${+a.vel === v ? 'selected' : ''}>${t}</option>`).join('')}</select>` : ''}
      <span class="tl-info">${st ? `Frame <b>${st.pi + 1}</b>` : ''}</span><span class="sp"></span>
      ${a ? `<button class="btn sm" data-passo title="Frame novo depois do escolhido (começa igual a ele)">${ic('plus', 12)} Frame</button><button class="ibtn" data-trilha title="Trilha nova: anda junto com as outras (ex.: boca falando enquanto as pernas andam)">${ic('layers', 14)}</button>` : ''}</div>`);
    $('[data-a]', cab).onchange = ev => { A.parar(true); A.passoSel = null; A.sel = ev.target.value || null; Atelie.teste = null; Atelie.pinta(); };
    $('[data-nova]', cab).onclick = () => A.nova();
    if (a) {
      $('[data-play]', cab).onclick = () => this.tocaPausa();
      $('[data-ant]', cab).onclick = () => this.anda(-1); $('[data-prox]', cab).onclick = () => this.anda(1);
      $('[data-stop]', cab).onclick = () => this.parar();
      $('[data-vel]', cab).onchange = ev => { a.vel = +ev.target.value; Atelie.commit({ soDesenho: true }); if (rodando) A.tocar(a, A.i); };
      $('[data-passo]', cab).onclick = () => this.novoPasso(a); $('[data-trilha]', cab).onclick = () => { a.trilhas.push([{ s: {}, p: {} }]); Atelie.commit(); A.irPara(a, a.trilhas.length - 1, 0); };
    }
    el.appendChild(cab);
    const g = h('<div class="tl-grade"></div>'); el.appendChild(g);
    if (!a) { g.appendChild(h('<div class="tl-vazio">Sem animação: crie no <b>+</b></div>')); return; }
    a.trilhas.forEach((t, ti) => {
      const row = h(`<div class="tl-linha"><span class="tl-t" title="Trilha ${ti + 1}: botão direito para opções">${a.trilhas.length > 1 ? 'T' + (ti + 1) : ''}</span><div class="tl-cel"></div></div>`), cel = $('.tl-cel', row);
      $('.tl-t', row).oncontextmenu = ev => { ev.preventDefault(); UI.ctx(ev.clientX, ev.clientY, [{ head: `Trilha ${ti + 1}` }, { label: 'Subir', icon: 'up', disabled: !ti, action: () => { moveNaLista(a.trilhas, ti, ti - 1, true); A.passoSel = null; Atelie.commit(); } }, { label: 'Descer', icon: 'down', disabled: ti >= a.trilhas.length - 1, action: () => { moveNaLista(a.trilhas, ti, ti + 1, false); A.passoSel = null; Atelie.commit(); } }, '-', { label: 'Apagar a trilha', icon: 'trash', danger: true, disabled: a.trilhas.length < 2, action: () => { a.trilhas.splice(ti, 1); A.passoSel = null; Atelie.commit(); } }]); };
      t.forEach((p, pi) => {
        const b = h(`<div class="tl-c" data-t="${ti}" data-i="${pi}" role="button" tabindex="0" title="${esc(A.detalhe(p))}\n\nClique: parar neste frame · arrastar: muda a ordem · botão direito: opções"><span class="tl-pega" aria-hidden="true">${ic('grip', 11)}</span><b>${pi + 1}</b><small>${esc(A.rotulo(p))}</small></div>`);
        b.onclick = () => A.irPara(a, ti, pi); b.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); A.irPara(a, ti, pi); } }; // espaço = play/pause (Atelie)
        b.oncontextmenu = ev => { ev.preventDefault(); A.menuPasso(ev, a, ti, pi); };
        Atelie.previaHover(b, () => Atelie.desenhoEstado({ sessoes: { ...(p.s || {}) }, partes: JSON.parse(JSON.stringify(p.p || {})) }, A.partesDoPasso(p), false), `${esc(a.nome)} › <b>frame ${pi + 1}</b>${a.trilhas.length > 1 ? ` <small>(trilha ${ti + 1})</small>` : ''}`); // passar o mouse: o desenho deste passo (o que ele mexe em destaque)
        ordenavel(b, 'passo-' + a.id, [ti, pi], ([t0, p0], antes) => { const de = a.trilhas[t0]; if (!de?.[p0]) return; if (t0 === ti) moveNaLista(t, p0, pi, antes); else { const [x] = de.splice(p0, 1); t.splice(antes ? pi : pi + 1, 0, x); } A.passoSel = null; Atelie.commit(); }, true);
        cel.appendChild(b); });
      if (!t.length) cel.appendChild(h('<span class="tl-vazio">trilha vazia: + Frame</span>'));
      g.appendChild(row);
    });
    this.leve(); this.altura();
  },
  // o palco termina em cima da timeline (o personagem não fica escondido atrás dela)
  altura() { const el = $('#at-tl'), pal = $('.at-palco'); if (!el || !pal) return; const hgt = el.hidden ? 0 : el.offsetHeight; if (pal._tl === hgt) return; pal._tl = hgt; const primeira = pal._tl0 === undefined; pal._tl0 = hgt; pal.style.setProperty('--tl', hgt + 'px'); Atelie.tamanho?.(); if (primeira) Atelie.enquadrar?.(); },
  // só acende o passo que está na tela (tocando, chamado a cada passo, sem recriar nada)
  leve() {
    const el = $('#at-tl'), A = Animacoes, a = A.achar(A.sel); if (!el || !a) return; const toca = A.tocando === a.id, st = A.passoAtual();
    for (const c of $$('.tl-c', el)) { const t = a.trilhas[+c.dataset.t] || [], n = t.length, i = +c.dataset.i, agora = toca && n && (((A.rodando ? A.i - 1 : A.i) % n) + n) % n === i;
      c.classList.toggle('agora', !!agora); c.classList.toggle('sel', !!st && st.ti === +c.dataset.t && st.pi === i); }
  },
  tocaPausa() { const A = Animacoes, a = A.achar(A.sel); if (!a) return; if (A.tocando === a.id) { if (A.pausado) A.continuar(); else { A.pausar(true); A.passoSel = { t: A.passoSel?.t ?? 0, i: A.i }; Atelie.pinta(); } } else { A.passoSel = null; A.tocar(a); } },
  anda(d) { const A = Animacoes, a = A.achar(A.sel); if (!a) return; const ti = A.passoSel?.t ?? 0, n = a.trilhas[ti]?.length || 1, i0 = A.tocando === a.id ? A.i : -d; A.irPara(a, ti, ((i0 + d) % n + n) % n); },
  parar() { const A = Animacoes; A.parar(true); A.passoSel = null; A.poseFixa = null; Atelie.teste = null; Atelie.editPasso = null; Atelie.pinta(); },
  novoPasso(a) {
    const A = Animacoes, st = A.passoAtual(), ti = st?.ti ?? A.passoSel?.t ?? 0, t = a.trilhas[ti] || (a.trilhas[ti] = []);
    const base = st ? clone(st.p) : t.length ? clone(t[t.length - 1]) : { s: {}, p: {} }, pos = st ? st.pi + 1 : t.length;
    t.splice(pos, 0, base); Atelie.commit(); A.irPara(a, ti, pos);
  },
};
