/* ===================== linha.js — ateliê: a TIMELINE pequena embaixo do palco =====================
   Guia das animações de teste (no lugar do antigo painel Testar): escolhe a animação, toca/pausa, anda passo a passo,
   e mostra os passos de cada trilha como quadradinhos. Clicar num passo para nele: aí clicar numa POSE (aba Poses)
   faz ESTE passo usar aquela pose. Trocar a imagem de uma parte não muda a animação (a animação só guarda poses).
   Botão direito num passo: as opções de sempre (duplicar, mover, apagar…). Arrastar um passo muda a ordem. */
'use strict';
const Linha = {
  // tempo de cada frame: os prontos + o personalizado (se for outro) + "Personalizado…"
  opcoesVel(v) { const seg = ms => (Math.round(ms) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' s', L = VELOCIDADES.map(x => x[0]);
    return (L.includes(v) || !v ? '' : `<option value="${v}" selected>${seg(v)} · personalizado</option>`) + VELOCIDADES.map(([x, t]) => `<option value="${x}" ${v === x ? 'selected' : ''}>${t}</option>`).join('') + '<option value="outro">Personalizado…</option>'; },
  // aceita "0,15", "0.15 s", "150 ms", "12 fps"; devolve ms (20 ms a 10 s) ou null
  async pedeVel(v) {
    const r = await UI.prompt({ title: 'Tempo de cada frame', label: 'Em segundos (ex.: 0,15), em ms (ex.: 150 ms) ou em quadros por segundo (ex.: 12 fps)', value: String((v || 80) / 1000).replace('.', ','), ok: 'Usar', icon: 'clock' });
    if (r == null) return null; const s = String(r).trim().toLowerCase().replace(',', '.'), n = parseFloat(s); if (!(n > 0)) { UI.toast('Não entendi esse tempo', { kind: 'warn' }); return null; }
    const ms = /fps/.test(s) ? 1000 / n : /ms/.test(s) ? n : n > 20 ? n : n * 1000; return Math.round(clamp(ms, 20, 10000)); },
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
      ${a ? `<select data-vel title="Cada frame dura (Personalizado… = o tempo que quiser)">${Linha.opcoesVel(+a.vel)}</select>` : ''}
      <span class="tl-info">${st ? `Frame <b>${st.pi + 1}</b>` : ''}</span><span class="sp"></span>
      ${a ? `<button class="btn sm" data-passo title="Frame novo depois do escolhido (começa igual a ele)">${ic('plus', 12)} Frame</button><button class="ibtn" data-trilha title="Trilha nova: anda junto com as outras (ex.: boca falando enquanto as pernas andam)">${ic('layers', 14)}</button>` : ''}</div>`);
    $('[data-a]', cab).onchange = ev => { A.multi?.clear(); A.parar(true); A.passoSel = null; A.sel = ev.target.value || null; Atelie.teste = null; Atelie.pinta(); };
    $('[data-nova]', cab).onclick = () => A.nova();
    if (a) {
      $('[data-play]', cab).onclick = () => this.tocaPausa();
      $('[data-ant]', cab).onclick = () => this.anda(-1); $('[data-prox]', cab).onclick = () => this.anda(1);
      $('[data-stop]', cab).onclick = () => this.parar();
      $('[data-vel]', cab).onchange = async ev => { let v = ev.target.value;
        if (v === 'outro') { v = await Linha.pedeVel(+a.vel); if (!v) { ev.target.innerHTML = Linha.opcoesVel(+a.vel); return; } }
        a.vel = +v; Atelie.commit({ soDesenho: true }); if (rodando) A.tocar(a, A.i); else Linha.pinta?.(); };
      $('[data-passo]', cab).onclick = () => this.novoPasso(a); $('[data-trilha]', cab).onclick = () => { a.trilhas.push([{ s: {}, p: {} }]); Atelie.commit(); A.irPara(a, a.trilhas.length - 1, 0); };
    }
    el.appendChild(cab);
    const g = h('<div class="tl-grade"></div>'); el.appendChild(g);
    if (!a) { g.appendChild(h('<div class="tl-vazio">Sem animação: crie no <b>+</b></div>')); return; }
    // como a timeline do Animador: régua com o número dos frames e uma linha por TRILHA (nome = o que ela mexe, cor própria).
    // Cada frame mostra a miniatura do que ele põe na tela; trilha mais curta RECOMEÇA (frames apagadinhos com ↻) até o fim da mais comprida.
    const max = A.ciclo(a), CORES = ['#19d3f0', '#ffb020', '#7bd88f', '#c08bff', '#ff5f8f', '#4fa3ff'], tok = this._tok = {}, minis = [];
    g.appendChild(h(`<div class="tl-linha tl-regua"><div class="tl-t"><small>${a.trilhas.length > 1 ? `${a.trilhas.length} trilhas tocam juntas` : 'frames'}</small></div><div class="tl-cel">${Array.from({ length: max }, (_, i) => `<span class="tl-n" data-col="${i}">${i + 1}</span>`).join('')}</div></div>`));
    a.trilhas.forEach((t, ti) => {
      const nomes = [...new Set(t.flatMap(p => A.partesDoPasso(p)))].map(id => Atelie.parte(id)?.nome).filter(Boolean), cor = CORES[ti % CORES.length];
      const mexe = nomes.length ? nomes.slice(0, 2).join(', ') + (nomes.length > 2 ? ` +${nomes.length - 2}` : '') : 'ainda não mexe em nada';
      const row = h(`<div class="tl-linha" style="--cor:${cor}"><div class="tl-t" title="${esc(a.nomesTrilhas?.[ti] || `Trilha ${ti + 1}`)}: ${esc(nomes.join(', ') || 'nada')} · ${t.length} frame(s)${t.length && t.length < max ? ` (recomeça a cada ${t.length})` : ''} · dois cliques: renomear · botão direito: opções"><b><i></i>${esc(a.nomesTrilhas?.[ti] || `Trilha ${ti + 1}`)}</b><small>${esc(mexe)}</small></div><div class="tl-cel"></div></div>`), cel = $('.tl-cel', row);
      const renomear = async () => { const n = (await UI.prompt({ title: 'Nome da trilha', label: 'Ex.: Braço, Rosto, Pernas', value: a.nomesTrilhas?.[ti] || '' }))?.trim(); if (n == null) return; a.nomesTrilhas = Array.from({ length: a.trilhas.length }, (_, k) => a.nomesTrilhas?.[k] || ''); a.nomesTrilhas[ti] = n.slice(0, 30); Atelie.commit(); };
      $('.tl-t', row).ondblclick = renomear;
      $('.tl-t', row).oncontextmenu = ev => { ev.preventDefault(); UI.ctx(ev.clientX, ev.clientY, [{ head: `Trilha ${ti + 1}` }, { label: 'Renomear (dois cliques)', icon: 'edit', action: renomear }, '-', { label: 'Subir', icon: 'up', disabled: !ti, action: () => { const N = Array.from({ length: a.trilhas.length }, (_, k) => a.nomesTrilhas?.[k] || ''); moveNaLista(a.trilhas, ti, ti - 1, true); moveNaLista(N, ti, ti - 1, true); a.nomesTrilhas = N; A.passoSel = null; Atelie.commit(); } }, { label: 'Descer', icon: 'down', disabled: ti >= a.trilhas.length - 1, action: () => { const N = Array.from({ length: a.trilhas.length }, (_, k) => a.nomesTrilhas?.[k] || ''); moveNaLista(a.trilhas, ti, ti + 1, false); moveNaLista(N, ti, ti + 1, false); a.nomesTrilhas = N; A.passoSel = null; Atelie.commit(); } }, '-', { label: 'Apagar a trilha', icon: 'trash', danger: true, disabled: a.trilhas.length < 2, action: () => { a.trilhas.splice(ti, 1); if (a.nomesTrilhas) a.nomesTrilhas.splice(ti, 1); A.passoSel = null; Atelie.commit(); } }]); };
      const escolhas = p => ({ sessoes: { ...(p.s || {}) }, partes: JSON.parse(JSON.stringify(p.p || {})) });
      t.forEach((p, pi) => {
        const b = h(`<div class="tl-c" data-t="${ti}" data-i="${pi}" data-col="${pi}" role="button" tabindex="0" title="${esc(A.detalhe(p))}\n\nClique: parar neste frame · arrastar: muda a ordem · botão direito: opções"><span class="tl-pega" aria-hidden="true">${ic('grip', 11)}</span><canvas class="tl-mini" width="88" height="64"></canvas><span class="tl-nf"><b>${pi + 1}</b><small>${esc(A.rotulo(p))}</small></span></div>`);
        b.onclick = ev => { // Shift = escolhe do frame atual até este (na mesma trilha) · Ctrl = põe/tira este · clique sozinho = só ele
          const M = A.multi || (A.multi = new Set()), st = A.passoAtual();
          if ((ev.shiftKey || ev.ctrlKey || ev.metaKey) && st && st.a.id === a.id) { if (!M.size) M.add(`${st.ti}:${st.pi}`);
            if (ev.shiftKey && st.ti === ti) { const [i0, i1] = [Math.min(st.pi, pi), Math.max(st.pi, pi)]; for (let k = i0; k <= i1; k++) M.add(`${ti}:${k}`); } else { const c = `${ti}:${pi}`; M.has(c) ? M.delete(c) : M.add(c); }
            if (M.size < 2) M.clear(); this.leve(); Atelie.pintaPartes?.(); return; }
          M.clear(); A.irPara(a, ti, pi); }; b.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); A.irPara(a, ti, pi); } }; // espaço = play/pause (Atelie)
        b.oncontextmenu = ev => { ev.preventDefault(); A.menuPasso(ev, a, ti, pi); };
        Atelie.previaHover(b, () => Atelie.desenhoEstado(escolhas(p), A.partesDoPasso(p), false), `${esc(a.nome)} › <b>frame ${pi + 1}</b>${a.trilhas.length > 1 ? ` <small>(trilha ${ti + 1})</small>` : ''}`); // passar o mouse: o desenho deste frame (o que ele mexe em destaque)
        ordenavel(b, 'passo-' + a.id, [ti, pi], ([t0, p0], antes) => { const de = a.trilhas[t0]; if (!de?.[p0]) return; if (t0 === ti) moveNaLista(t, p0, pi, antes); else { const [x] = de.splice(p0, 1); t.splice(antes ? pi : pi + 1, 0, x); } A.passoSel = null; Atelie.commit(); }, true);
        minis.push([$('canvas', b), p]); cel.appendChild(b); });
      // trilha mais curta: os frames dela de novo (apagadinhos) até o fim da mais comprida — é o que toca ali
      if (t.length) for (let col = t.length; col < max; col++) { const pi = col % t.length, p = t[pi];
        const f = h(`<div class="tl-c fantasma ${pi === 0 ? 'volta' : ''}" data-t="${ti}" data-i="${pi}" data-col="${col}" title="A trilha ${ti + 1} recomeçou: aqui toca o frame ${pi + 1} dela de novo (clique para ir nele)">${pi === 0 ? `<span class="tl-volta">${ic('redo', 10)}</span>` : ''}<canvas class="tl-mini" width="88" height="64"></canvas><span class="tl-nf"><b>${pi + 1}</b></span></div>`);
        f.onclick = () => A.irPara(a, ti, pi, col); /* fica NESTA coluna (antes pulava para a 1ª volta e parecia que não clicava); mexer aqui muda o frame dela */ minis.push([$('canvas', f), p]); cel.appendChild(f); }
      if (!t.length) cel.appendChild(h('<span class="tl-vazio">trilha vazia: + Frame</span>'));
      g.appendChild(row);
    });
    // miniaturas uma de cada vez (sem travar a tela); se a timeline for refeita no meio, para
    (async () => { for (const [cv, p] of minis) { if (this._tok !== tok) return; try { const src = await Atelie.desenhoEstado({ sessoes: { ...(p.s || {}) }, partes: JSON.parse(JSON.stringify(p.p || {})) }, A.partesDoPasso(p), true); if (!src || this._tok !== tok) continue;
      const x = cv.getContext('2d'), k = Math.min(cv.width / src.width, cv.height / src.height); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(src, (cv.width - src.width * k) / 2, (cv.height - src.height * k) / 2, src.width * k, src.height * k); } catch { } } })();
    this.leve(); this.altura();
  },
  // o palco termina em cima da timeline (o personagem não fica escondido atrás dela)
  altura() { const el = $('#at-tl'), pal = $('.at-palco'); if (!el || !pal) return; const hgt = el.hidden ? 0 : el.offsetHeight; if (pal._tl === hgt) return; pal._tl = hgt; const primeira = pal._tl0 === undefined; pal._tl0 = hgt; pal.style.setProperty('--tl', hgt + 'px'); Atelie.tamanho?.(); if (primeira) Atelie.enquadrar?.(); },
  // só acende o passo que está na tela (tocando, chamado a cada passo, sem recriar nada)
  leve() {
    const el = $('#at-tl'), A = Animacoes, a = A.achar(A.sel); if (!el || !a) return; const toca = A.tocando === a.id, st = A.passoAtual();
    const max = A.ciclo(a), col = toca ? ((((A.pausado ? A.i : A.i - 1) % max) + max) % max) : -1; // a coluna que está na tela (o "cursor" da timeline)
    for (const c of $$('.tl-c', el)) { const i = +c.dataset.i; c.classList.toggle('agora', +c.dataset.col === col); c.classList.toggle('sel', !!st && st.ti === +c.dataset.t && st.pi === i && (!c.classList.contains('fantasma') || +c.dataset.col === col)); }
    for (const n of $$('.tl-n', el)) n.classList.toggle('agora', +n.dataset.col === col);
    const M = A.multi?.size > 1 ? A.multi : null; for (const c of $$('.tl-c:not(.fantasma)', el)) c.classList.toggle('multi', !!M && M.has(`${c.dataset.t}:${c.dataset.i}`));
    const inf = $('.tl-info', el); if (inf && st) inf.innerHTML = `Frame <b>${st.pi + 1}</b>${M ? ` · <b>${M.size}</b> frames escolhidos: o que mexer vale para todos` : ''}`;
  },
  tocaPausa() { const A = Animacoes, a = A.achar(A.sel); if (!a) return; if (A.tocando === a.id) { if (A.pausado) A.continuar(); else { A.pausar(true); A.passoSel = { t: A.passoSel?.t ?? 0, i: A.i }; Atelie.pinta(); } } else { A.passoSel = null; A.tocar(a); } },
  anda(d) { const A = Animacoes, a = A.achar(A.sel); if (!a) return; const ti = A.passoSel?.t ?? 0, n = a.trilhas[ti]?.length || 1, i0 = A.tocando === a.id ? A.i : -d; A.irPara(a, ti, ((i0 + d) % n + n) % n); },
  parar() { const A = Animacoes; A.multi?.clear(); A.parar(true); A.passoSel = null; A.poseFixa = null; Atelie.teste = null; Atelie.editPasso = null; Atelie.pinta(); },
  novoPasso(a) {
    const A = Animacoes, st = A.passoAtual(), ti = st?.ti ?? A.passoSel?.t ?? 0, t = a.trilhas[ti] || (a.trilhas[ti] = []);
    const base = st ? clone(st.p) : t.length ? clone(t[t.length - 1]) : { s: {}, p: {} }, pos = st ? st.pi + 1 : t.length;
    t.splice(pos, 0, base); Atelie.commit(); A.irPara(a, ti, pos);
  },
};
