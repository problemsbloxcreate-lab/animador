/* ===================== linha.js — ateliê: a TIMELINE pequena embaixo do palco =====================
   Guia das animações de teste (no lugar do antigo painel Testar): escolhe a animação, toca/pausa, anda passo a passo,
   e mostra os passos de cada trilha como quadradinhos. Clicar num passo para nele: aí clicar numa POSE (aba Poses)
   faz ESTE passo usar aquela pose. Trocar a imagem de uma parte não muda a animação (a animação só guarda poses).
   Botão direito num passo: as opções de sempre (duplicar, mover, apagar…). Arrastar um passo muda a ordem. */
'use strict';
const Linha = {
  // FPS do personagem: os comuns + o atual (se for outro) + "Outro…"
  FPS: [12, 15, 24, 25, 30, 48, 60],
  opcoesFps(f) { return (this.FPS.includes(f) ? '' : `<option value="${f}" selected>${f} fps</option>`) + this.FPS.map(x => `<option value="${x}" ${x === f ? 'selected' : ''}>${x} fps${x === Modelo.FPS_PADRAO ? ' (padrão)' : ''}</option>`).join('') + '<option value="outro">Outro…</option>'; },
  async pedeFps(f) { const r = await UI.prompt({ title: 'FPS do personagem', label: 'Quadros por segundo (1 a 120). O padrão do Animador é 24.', value: String(f || 24), ok: 'Usar', icon: 'clock' }); const n = Math.round(parseFloat(String(r ?? '').replace(',', '.'))); if (!(n >= 1 && n <= 120)) { if (r != null) UI.toast('Use de 1 a 120 fps', { kind: 'warn' }); return null; } return n; },
  seg(a) { return ((+a.vel || 0) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' s'; },
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
      ${a ? `<span class="tl-vel" title="Cada frame fica na tela este nº de QUADROS, no fps do personagem (${Modelo.fpsDe(Atelie.def)} fps): ${Linha.seg(a)} — o Animador usa igual"><input type="number" data-q min="1" max="240" step="1" value="${+a.q || 1}"><small>${(+a.q || 1) === 1 ? 'quadro' : 'quadros'}</small><select data-fps title="FPS do personagem (vale para todas as animações dele)">${Linha.opcoesFps(Modelo.fpsDe(Atelie.def))}</select></span>` : ''}
      <span class="tl-info">${st ? `Frame <b>${st.pi + 1}</b>` : ''}</span><span class="sp"></span>
      ${a ? `<span class="tl-vistas" title="Jeito de ver a timeline"><button class="ibtn ${this.vista() === 'mini' ? 'on' : ''}" data-vis="mini" title="Miniaturas: cada frame com o desenho dele">${ic('grid', 13)}</button><button class="ibtn ${this.vista() === 'linhas' ? 'on' : ''}" data-vis="linhas" title="Linhas (como a timeline do Animador): régua em quadros e cada frame como uma barra">${ic('film', 13)}</button></span><button class="btn sm" data-passo title="Frame novo depois do escolhido (começa igual a ele)">${ic('plus', 12)} Frame</button><button class="ibtn" data-trilha title="Trilha nova: anda junto com as outras (ex.: boca falando enquanto as pernas andam)">${ic('layers', 14)}</button>` : ''}</div>`);
    $('[data-a]', cab).onchange = ev => { A.multi?.clear(); A.parar(true); A.passoSel = null; A.sel = ev.target.value || null; Atelie.teste = null; Atelie.pinta(); };
    $('[data-nova]', cab).onclick = () => A.nova();
    $$('[data-vis]', cab).forEach(b => b.onclick = () => { try { localStorage.setItem('animador-tl-vista', b.dataset.vis); } catch { } this.pinta(); });
    if (a) {
      $('[data-play]', cab).onclick = () => this.tocaPausa();
      $('[data-ant]', cab).onclick = () => this.anda(-1); $('[data-prox]', cab).onclick = () => this.anda(1);
      $('[data-stop]', cab).onclick = () => this.parar();
      // tempo do frame em QUADROS (inteiro) no FPS DO PERSONAGEM — o mesmo que o Animador usa, sem arredondar
      const vq = $('[data-q]', cab), vf = $('[data-fps]', cab);
      vq.onchange = () => { const q = Math.round(+vq.value); if (!(q >= 1 && q <= 240)) { vq.value = +a.q || 1; return UI.toast('Use de 1 a 240 quadros', { kind: 'warn' }); } a.q = q; Modelo.sincAnims(Atelie.def); Atelie.commit({ soDesenho: true }); if (rodando) A.tocar(a, A.i); else this.pinta(); };
      vq.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); vq.blur(); } ev.stopPropagation(); };
      vf.onchange = async () => { let f = vf.value; if (f === 'outro') { f = await Linha.pedeFps(Modelo.fpsDe(Atelie.def)); if (!f) return this.pinta(); }
        Modelo.trocaFps(Atelie.def, +f); Atelie.commit(); UI.toast(`Personagem a <b>${Modelo.fpsDe(Atelie.def)} fps</b>: cada frame manteve o tempo (os quadros foram recalculados).`, { time: 3500 }); if (rodando) A.tocar(a, A.i); else this.pinta(); };
      $('[data-passo]', cab).onclick = () => this.novoPasso(a); $('[data-trilha]', cab).onclick = () => { a.trilhas.push([{ s: {}, p: {} }]); Atelie.commit(); A.irPara(a, a.trilhas.length - 1, 0); };
    }
    el.appendChild(cab);
    const g = h('<div class="tl-grade"></div>'); el.appendChild(g);
    // clicar no VAZIO da timeline (fora dos frames, nomes e botões) = Esc: tira a escolha de vários frames e volta à pose padrão
    el.onclick = ev => { if (ev.target.closest('.tl-c, .tl-t, .tl-n, .tl-cab, button, select, input, label, .tl-vazio, .dock-pega')) return; if (Atelie.teste || A.multi?.size) { A.multi?.clear?.(); this.parar(); } };
    if (!a) { g.appendChild(h('<div class="tl-vazio">Sem animação: crie no <b>+</b></div>')); return; }
    // como a timeline do Animador: régua com o número dos frames e uma linha por TRILHA (nome = o que ela mexe, cor própria).
    // Cada frame mostra a miniatura do que ele põe na tela; trilha mais curta RECOMEÇA (frames apagadinhos com ↻) até o fim da mais comprida.
    const linhas = this.vista() === 'linhas'; g.classList.toggle('linhas', linhas);
    const max = A.ciclo(a), q = Math.max(1, +a.q || 1), larg = Math.max(300, (el.clientWidth || 800) - 190), pxq = linhas ? clamp(larg / (max * q), 4, 60) : 0, wb = Math.max(22, Math.round(q * pxq)), CORES = ['#19d3f0', '#ffb020', '#7bd88f', '#c08bff', '#ff5f8f', '#4fa3ff'], tok = this._tok = {}, minis = [];
    if (linhas) { const fps = Modelo.fpsDe(Atelie.def), passoN = wb >= 40 ? 1 : wb >= 18 ? 2 : 5; g.appendChild(h(`<div class="tl-linha tl-regua"><div class="tl-t"><small>${max * q} quadros · ${((max * q) / fps).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s</small></div><div class="tl-cel">${Array.from({ length: max }, (_, i) => `<span class="tl-n" data-col="${i}" style="width:${wb}px">${i % passoN ? '' : i * q + 1}</span>`).join('')}</div></div>`)); }
    else g.appendChild(h(`<div class="tl-linha tl-regua"><div class="tl-t"><small>${a.trilhas.length > 1 ? `${a.trilhas.length} trilhas tocam juntas` : 'frames'}</small></div><div class="tl-cel">${Array.from({ length: max }, (_, i) => `<span class="tl-n" data-col="${i}">${i + 1}</span>`).join('')}</div></div>`));
    a.trilhas.forEach((t, ti) => {
      const nomes = [...new Set(t.flatMap(p => A.partesDoPasso(p)))].map(id => Atelie.parte(id)?.nome).filter(Boolean), cor = CORES[ti % CORES.length];
      const mexe = nomes.length ? nomes.slice(0, 2).join(', ') + (nomes.length > 2 ? ` +${nomes.length - 2}` : '') : 'ainda não mexe em nada';
      const row = h(`<div class="tl-linha" style="--cor:${cor}"><div class="tl-t" title="${esc(a.nomesTrilhas?.[ti] || `Trilha ${ti + 1}`)}: ${esc(nomes.join(', ') || 'nada')} · ${t.length} frame(s)${t.length && t.length < max ? ` (recomeça a cada ${t.length})` : ''} · dois cliques: renomear · botão direito: opções"><b><i></i>${esc(a.nomesTrilhas?.[ti] || `Trilha ${ti + 1}`)}</b><small>${esc(mexe)}</small></div><div class="tl-cel"></div></div>`), cel = $('.tl-cel', row);
      const renomear = async () => { const n = (await UI.prompt({ title: 'Nome da trilha', label: 'Ex.: Braço, Rosto, Pernas', value: a.nomesTrilhas?.[ti] || '' }))?.trim(); if (n == null) return; a.nomesTrilhas = Array.from({ length: a.trilhas.length }, (_, k) => a.nomesTrilhas?.[k] || ''); a.nomesTrilhas[ti] = n.slice(0, 30); Atelie.commit(); };
      $('.tl-t', row).ondblclick = renomear;
      $('.tl-t', row).oncontextmenu = ev => { ev.preventDefault(); UI.ctx(ev.clientX, ev.clientY, [{ head: `Trilha ${ti + 1}` }, { label: 'Renomear (dois cliques)', icon: 'edit', action: renomear }, { label: 'Colar no fim da trilha', icon: 'paste', disabled: !this._clip, action: () => this.colar(a, ti, t.length - 1) }, '-', { label: 'Subir', icon: 'up', disabled: !ti, action: () => { const N = Array.from({ length: a.trilhas.length }, (_, k) => a.nomesTrilhas?.[k] || ''); moveNaLista(a.trilhas, ti, ti - 1, true); moveNaLista(N, ti, ti - 1, true); a.nomesTrilhas = N; A.passoSel = null; Atelie.commit(); } }, { label: 'Descer', icon: 'down', disabled: ti >= a.trilhas.length - 1, action: () => { const N = Array.from({ length: a.trilhas.length }, (_, k) => a.nomesTrilhas?.[k] || ''); moveNaLista(a.trilhas, ti, ti + 1, false); moveNaLista(N, ti, ti + 1, false); a.nomesTrilhas = N; A.passoSel = null; Atelie.commit(); } }, '-', { label: 'Apagar a trilha', icon: 'trash', danger: true, disabled: a.trilhas.length < 2, action: () => { a.trilhas.splice(ti, 1); if (a.nomesTrilhas) a.nomesTrilhas.splice(ti, 1); A.passoSel = null; Atelie.commit(); } }]); };
      const escolhas = p => ({ sessoes: { ...(p.s || {}) }, partes: JSON.parse(JSON.stringify(p.p || {})) });
      t.forEach((p, pi) => {
        const solta = Object.values(p.p || {}).some(e => e && e.img), dica = `${esc(A.detalhe(p))}\n\nClique: parar neste frame · Ctrl+C / Ctrl+V: copiar e colar · arrastar: muda a ordem · botão direito: opções`;
        const b = linhas ? h(`<div class="tl-c tl-b" data-t="${ti}" data-i="${pi}" data-col="${pi}" role="button" tabindex="0" style="width:${wb}px" title="${dica}"><i class="tl-k"></i>${solta ? `<span class="tl-solta" title="Este frame usa IMAGEM solta (não um preset)">${ic('image', 9)}</span>` : ''}<span class="tl-bt"><b>${pi + 1}</b>${wb >= 56 ? `<small>${esc(A.rotulo(p))}</small>` : ''}</span></div>`)
          : h(`<div class="tl-c" data-t="${ti}" data-i="${pi}" data-col="${pi}" role="button" tabindex="0" title="${dica}"><span class="tl-pega" aria-hidden="true">${ic('grip', 11)}</span>${solta ? `<span class="tl-solta" title="Este frame usa IMAGEM solta (não um preset)">${ic('image', 10)}</span>` : ''}<canvas class="tl-mini" width="88" height="64"></canvas><span class="tl-nf"><b>${pi + 1}</b><small>${esc(A.rotulo(p))}</small></span></div>`);
        b.onclick = ev => { // Shift = escolhe do frame atual até este (na mesma trilha) · Ctrl = põe/tira este · clique sozinho = só ele
          const M = A.multi || (A.multi = new Set()), st = A.passoAtual();
          if ((ev.shiftKey || ev.ctrlKey || ev.metaKey) && st && st.a.id === a.id) { if (!M.size) M.add(`${st.ti}:${st.pi}`);
            if (ev.shiftKey && st.ti === ti) { const [i0, i1] = [Math.min(st.pi, pi), Math.max(st.pi, pi)]; for (let k = i0; k <= i1; k++) M.add(`${ti}:${k}`); } else { const c = `${ti}:${pi}`; M.has(c) ? M.delete(c) : M.add(c); }
            if (M.size < 2) M.clear(); this.leve(); Atelie.pintaPartes?.(); return; }
          M.clear(); A.irPara(a, ti, pi); }; b.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); A.irPara(a, ti, pi); } }; // espaço = play/pause (Atelie)
        b.oncontextmenu = ev => { ev.preventDefault(); A.menuPasso(ev, a, ti, pi); };
        Atelie.previaHover(b, () => Atelie.desenhoEstado(escolhas(p), A.partesDoPasso(p), false), `${esc(a.nome)} › <b>frame ${pi + 1}</b>${a.trilhas.length > 1 ? ` <small>(trilha ${ti + 1})</small>` : ''}`); // passar o mouse: o desenho deste frame (o que ele mexe em destaque)
        ordenavel(b, 'passo-' + a.id, [ti, pi], ([t0, p0], antes) => { const de = a.trilhas[t0]; if (!de?.[p0]) return; if (t0 === ti) moveNaLista(t, p0, pi, antes); else { const [x] = de.splice(p0, 1); t.splice(antes ? pi : pi + 1, 0, x); } A.passoSel = null; Atelie.commit(); }, true);
        if (!linhas) minis.push([$('canvas', b), p]); cel.appendChild(b); });
      // trilha mais curta: SEM cópias automáticas na tela (confundia). Só um aviso no fim de que ela recomeça ao tocar; para repetir de verdade, copie e cole os frames (Ctrl+C / Ctrl+V)
      if (t.length && t.length < max) cel.appendChild(h(`<span class="tl-repete" title="Esta trilha tem ${t.length} frame(s) e a mais comprida tem ${max}: ao tocar, ela recomeça daqui. Para ficar do tamanho das outras, copie e cole os frames (Ctrl+C / Ctrl+V).">${ic('redo', 10)} recomeça</span>`));
      if (!t.length) cel.appendChild(h('<span class="tl-vazio">trilha vazia: + Frame</span>'));
      g.appendChild(row);
    });
    // miniaturas uma de cada vez (sem travar a tela); se a timeline for refeita no meio, para
    (async () => { for (const [cv, p] of minis) { if (this._tok !== tok) return; try { const src = await Atelie.desenhoEstado({ sessoes: { ...(p.s || {}) }, partes: JSON.parse(JSON.stringify(p.p || {})) }, A.partesDoPasso(p), true); if (!src || this._tok !== tok) continue;
      const x = cv.getContext('2d'), k = Math.min(cv.width / src.width, cv.height / src.height); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(src, (cv.width - src.width * k) / 2, (cv.height - src.height * k) / 2, src.width * k, src.height * k); } catch { } } })();
    this.leve(); this.altura();
  },
  vista() { try { return localStorage.getItem('animador-tl-vista') === 'linhas' ? 'linhas' : 'mini'; } catch { return 'mini'; } },
  // COPIAR E COLAR FRAMES (Ctrl+C / Ctrl+V com um frame parado, ou pelo botão direito): copia o escolhido (ou os vários escolhidos)
  copiar(a, ti, pi) {
    const A = Animacoes; a = a || A.achar(A.sel); if (!a) return false; const st = A.passoAtual();
    const M = A.multi?.size > 1 ? [...A.multi].map(c => c.split(':').map(Number)).sort((x, y) => x[0] - y[0] || x[1] - y[1]) : ti != null ? [[ti, pi]] : st ? [[st.ti, st.pi]] : [];
    const fr = M.map(([t, i]) => a.trilhas[t]?.[i]).filter(Boolean); if (!fr.length) return false;
    this._clip = { fr: clone(fr), de: Atelie.def.id }; UI.toast(fr.length > 1 ? `${fr.length} frames copiados (Ctrl+V cola depois do frame escolhido)` : 'Frame copiado (Ctrl+V cola depois do frame escolhido)', { time: 1800 }); return true;
  },
  // colar: depois do frame escolhido (ou no fim da trilha); noLugar = troca o frame escolhido pelos copiados
  colar(a, ti, pi, noLugar) {
    const A = Animacoes, c = this._clip; a = a || A.achar(A.sel); if (!a || !c?.fr?.length) { if (!c) UI.toast('Nada copiado ainda: escolha um frame e aperte Ctrl+C.', { time: 2200 }); return false; }
    if (c.de !== Atelie.def.id) UI.toast('Os frames vieram de outro personagem: as poses que não existem aqui ficam de fora.', { kind: 'warn', time: 3000 });
    const st = A.passoAtual(); ti = ti ?? st?.ti ?? A.passoSel?.t ?? 0; const t = a.trilhas[ti] || (a.trilhas[ti] = []); pi = pi ?? (st && st.ti === ti ? st.pi : t.length - 1);
    const novos = clone(c.fr), pos = noLugar && t[pi] ? pi : pi + 1; t.splice(pos, noLugar && t[pi] ? 1 : 0, ...novos);
    A.multi?.clear(); Atelie.commit(); A.irPara(a, ti, Math.min(pos, t.length - 1)); return true;
  },
  // o palco termina em cima da timeline (o personagem não fica escondido atrás dela)
  altura() { const el = $('#at-tl'), pal = $('.at-palco'); if (!el || !pal) return; const hgt = el.hidden ? 0 : el.offsetHeight; if (pal._tl === hgt) return; pal._tl = hgt; const primeira = pal._tl0 === undefined; pal._tl0 = hgt; pal.style.setProperty('--tl', hgt + 'px'); Atelie.tamanho?.(); if (primeira) Atelie.enquadrar?.(); },
  // só acende o passo que está na tela (tocando, chamado a cada passo, sem recriar nada)
  leve() {
    const el = $('#at-tl'), A = Animacoes, a = A.achar(A.sel); if (!el || !a) return; const toca = A.tocando === a.id, st = A.passoAtual();
    const max = A.ciclo(a), col = toca ? ((((A.pausado ? A.i : A.i - 1) % max) + max) % max) : -1; // a coluna que está na tela (o "cursor" da timeline)
    for (const c of $$('.tl-c', el)) { const i = +c.dataset.i; c.classList.toggle('agora', +c.dataset.col === col); c.classList.toggle('sel', !!st && st.ti === +c.dataset.t && st.pi === i); }
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
