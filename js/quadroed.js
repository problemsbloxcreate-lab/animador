/* ===================== quadroed.js — ARRUMAR UM QUADRO com o Ateliê DENTRO do Animador =====================
   Dois cliques no personagem no palco (ou botão direito › "Arrumar este quadro aqui") abre o Ateliê num painel ao lado
   (ou numa janela solta que dá para minimizar). Ele mexe SÓ NAQUELE QUADRO da animação:
   • o personagem que entra no painel é a CÓPIA da animação (P.personagens), nunca o da nuvem/arquivo: nada é salvo lá
     (sem rascunho, sem nuvem, sem ao vivo do Ateliê);
   • o quadro vira um "frame parado" de uma animação de teste escondida (`__quadro`), então TUDO que o Ateliê já sabe fazer
     num frame vale aqui: mover/girar/trocar imagem/poses (presets) só nele, apagar só nele (máscara), profundidade só nele;
   • pintar (pincel, balde, ajustes…) não muda a imagem do personagem: cria uma CÓPIA da imagem só para este quadro (`imgDoQuadro`);
   • a cada mudança o painel manda o quadro para o Animador ('quadro-editado'): a chave daquele quadro recebe as poses e as partes
     e a chave seguinte segura como era (só este quadro muda). O Ctrl+Z do Animador volta cada mudança.
   No painel não aparecem a timeline do Ateliê (o Animador tem a dele), as vistas, a aba Animações nem o cabeçalho do Ateliê. */
'use strict';
const EMBED = new URLSearchParams(location.search).get('embed');
if (EMBED === 'quadro' && parent !== window) try { parent.postMessage({ tipo: 'quadro-prog', p: 20, t: 'Ateliê carregado, conferindo a conta…' }, location.origin); } catch { } // os arquivos do Ateliê já chegaram
const QuadroEd = {
  /* ================= no ANIMADOR ================= */
  CH: 'animador-quadro-ed',
  cfg() { if (!this._cfg) { try { this._cfg = JSON.parse(localStorage.getItem(this.CH) || 'null'); } catch { } this._cfg = { modo: 'lado', w: 460, x: 0, y: 0, W: 480, H: 620, min: false, ...(this._cfg || {}) }; } return this._cfg; },
  grava() { try { localStorage.setItem(this.CH, JSON.stringify(this._cfg)); } catch { } },
  // abre (ou passa para) o quadro q do personagem n
  async abrir(n, q = App.q) {
    const P = App.P, def = P?.personagens?.[n?.ref]; if (!def) return; App.pausa?.();
    const est = Modelo.estadoPersonagem(n, q), partes = {}; for (const [k, v] of Object.entries(est.partes || {})) if (v) partes[k] = v;
    await DB.put('arquivos', { def: clone(def), sessoes: est.sessoes || {}, partes, vista: est.vista || def.vistas?.[0]?.id || null, quadro: q, projeto: P.id, no: n.id, anim: P.nome, em: Date.now() }, 'quadro-abrir');
    this.atual = { no: n.id, quadro: q, nome: def.nome, projeto: P.id }; this.mostra();
    if (this.ifr && this.pronto) { this.el.classList.add('trocando'); this.carregando(true, 30, 'Lendo o quadro…'); this.ifr.contentWindow.postMessage({ tipo: 'abre-quadro' }, location.origin); }
    else if (!this.ifr) this.criaFrame();
  },
  criaFrame() {
    const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('embed', 'quadro');
    this.pronto = false; this.ifr = h(`<iframe title="Ateliê: arrumar este quadro" allow="clipboard-read; clipboard-write"></iframe>`); this.ifr.src = u.href;
    $('.qed-corpo', this.el).prepend(this.ifr); this.carregando(true, 0, 'Carregando o Ateliê…');
  },
  // TELA DE CARREGAMENTO com % de VERDADE: cada etapa que já terminou (página do Ateliê, login, personagem, cada imagem, montar o quadro)
  carregando(on, p = 0, t = '') { const el = this.el; if (!el) return; el.classList.toggle('carregando', !!on); if (!on) el.classList.remove('trocando'); this._p = on ? p : 100; this.pintaProg(t); },
  progresso(p, t) { if (!this.el?.classList.contains('carregando')) return; this._p = Math.max(this._p || 0, Math.min(100, Math.round(p))); this.pintaProg(t); },
  pintaProg(t) { const c = $('.qed-carr', this.el); if (!c) return; $('.qed-pct', c).textContent = (this._p || 0) + '%'; $('.qed-pbar i', c).style.width = (this._p || 0) + '%'; if (t) $('.qed-ptxt', c).textContent = t; },
  ouve() {
    if (this._ouve) return; this._ouve = true;
    addEventListener('message', e => { if (e.origin !== location.origin || !e.data?.tipo) return; const d = e.data;
      if (d.tipo === 'quadro-pronto') { this.pronto = true; if (this.atual) this.ifr?.contentWindow?.postMessage({ tipo: 'abre-quadro' }, location.origin); }
      else if (d.tipo === 'quadro-prog') this.progresso(d.p, d.t);
      else if (d.tipo === 'quadro-aberto') { this.progresso(100, 'Pronto'); setTimeout(() => this.carregando(false), 150); }
      else if (d.tipo === 'quadro-editado') this.recebe(d).catch(err => console.warn('quadro', err)); });
  },
  // o painel (ao lado da tela ou janela solta; minimiza)
  mostra() {
    this.ouve(); this.ligaAnimador(); const c = this.cfg();
    if (!this.el) {
      this.el = h(`<div class="qed"><div class="qed-bar" title="Arraste para mover (encaixado: arrastar solta como janela) · dois cliques: minimizar"><span class="qed-pega">${ic('grip', 13)}</span><span class="qed-ic">${ic('brush', 14)}</span><span class="qed-t"></span><span class="sp"></span>
        <button class="ibtn qed-atelie" data-completo title="Abrir o Ateliê completo numa aba nova"><span class="ic-ep" data-estudio-icone="at" style="width:16px;height:16px"></span></button><span class="qed-sep"></span><button class="ibtn" data-undo title="Desfazer no quadro (Ctrl+Z)">${ic('undo', 14)}</button><button class="ibtn" data-redo title="Refazer no quadro">${ic('redo', 14)}</button>
        <button class="ibtn" data-aqui title="Passar para o quadro que está na tela agora">${ic('jump', 14)}</button>
        <button class="ibtn" data-modo></button><button class="ibtn" data-min></button><button class="ibtn" data-x title="Fechar (o que já mudou fica no quadro)">${ic('x', 14)}</button></div>
        <div class="qed-corpo"><div class="qed-carr"><div class="qed-pbox"><div class="qed-ptit">${ic('brush', 16)} Abrindo o Ateliê neste quadro</div><b class="qed-pct">0%</b><div class="qed-pbar"><i></i></div><small class="qed-ptxt">Carregando o Ateliê…</small></div></div><div class="qed-tampa"></div></div><div class="qed-borda" title="Arraste para mudar a largura"></div>${['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(d => `<div class="qed-rz" data-rz="${d}"></div>`).join('')}</div>`);
      document.body.appendChild(this.el);
      const B = s => $(s, this.el), manda = tipo => this.ifr?.contentWindow?.postMessage({ tipo }, location.origin);
      B('[data-undo]').onclick = () => manda('desfazer'); B('[data-redo]').onclick = () => manda('refazer');
      B('[data-aqui]').onclick = () => { const n = this.atual && Modelo.achar(App.P, this.atual.no)?.no; if (n) this.abrir(n, App.q); };
      B('[data-modo]').onclick = () => { c.modo = c.modo === 'lado' ? 'solto' : 'lado'; c.min = false; this.grava(); this.arruma(); };
      B('[data-min]').onclick = () => { c.min = !c.min; this.grava(); this.arruma(); this.segue(); };
      B('[data-x]').onclick = () => this.fechar();
      B('[data-completo]').onclick = () => this.completo();
      B('.qed-bar').ondblclick = e => { if (e.target.closest('button')) return; c.min = !c.min; this.grava(); this.arruma(); this.segue(); };
      this.arrasta(); this.borda(); this.tamanhos(); new ResizeObserver(() => { if (c.modo === 'solto' && !c.min && this.el.offsetWidth) { c.W = this.el.offsetWidth; c.H = this.el.offsetHeight; this.grava(); } }).observe(this.el);
    }
    c.min = false; this.el.hidden = false; this.arruma();
  },
  titulo() { const a = this.atual; if (a && $('#qed-aviso')) this.pintaTrava(); if (a && this.el) $('.qed-t', this.el).innerHTML = `Quadro <b>${a.quadro + 1}</b> · ${esc(a.nome || '')} <small>só neste quadro</small>`; },
  arruma() {
    const c = this.cfg(), el = this.el; if (!el) return; this.titulo();
    el.classList.toggle('lado', c.modo === 'lado'); el.classList.toggle('solto', c.modo === 'solto'); el.classList.toggle('min', !!c.min);
    $('[data-modo]', el).innerHTML = ic(c.modo === 'lado' ? 'copy' : 'right', 14); $('[data-modo]', el).title = c.modo === 'lado' ? 'Soltar como janela' : 'Encaixar do lado direito';
    $('[data-min]', el).innerHTML = ic(c.min ? 'up' : 'minus', 14); $('[data-min]', el).title = c.min ? 'Abrir de novo' : 'Minimizar';
    const top = Math.round($('#editor header')?.getBoundingClientRect().bottom || 46);
    if (c.modo === 'lado') { const w = clamp(c.w || 460, 340, Math.max(360, innerWidth * .7)); Object.assign(el.style, { top: c.min ? '' : '0px', left: '', right: '0', bottom: c.min ? '' : '0', width: c.min ? '' : w + 'px', height: '' });
      document.body.style.setProperty('--qed-w', (c.min ? 0 : w) + 'px'); }
    else { const W = clamp(c.W || 480, 320, innerWidth - 16), H = clamp(c.H || 620, 260, innerHeight - 16), x = clamp(c.x || innerWidth - W - 24, 8, innerWidth - 120), y = clamp(c.y || top + 16, 8, innerHeight - 40);
      Object.assign(el.style, { left: x + 'px', top: y + 'px', right: '', bottom: '', width: c.min ? '' : W + 'px', height: c.min ? '' : H + 'px' }); document.body.style.setProperty('--qed-w', '0px'); }
    document.body.classList.toggle('qed-lado', !el.hidden && c.modo === 'lado' && !c.min);
    this.pintaTrava();
    if (typeof App !== 'undefined') App._enqCorta = true; // o palco do Animador se ajusta: a câmera cortada volta a caber
    dispatchEvent(new Event('resize')); // a tela do Animador muda de tamanho
  },
  arrasta() {
    const bar = $('.qed-bar', this.el), c = this.cfg();
    bar.onpointerdown = e => { if (e.button !== 0 || e.target.closest('button')) return; e.preventDefault(); bar.setPointerCapture(e.pointerId); this.el.classList.add('mexendo');
      let r = this.el.getBoundingClientRect(), gx = e.clientX - r.left, gy = e.clientY - r.top; const x0 = e.clientX, y0 = e.clientY;
      bar.onpointermove = ev => {
        if (c.modo === 'lado') { // encaixado: puxar a barra solta o painel como janela, embaixo do mouse
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 12) return;
          const W = c.min ? this.el.offsetWidth : clamp(c.W || 480, 320, innerWidth - 16); c.modo = 'solto'; gx = Math.min(gx, W - 60); gy = 18; c.x = ev.clientX - gx; c.y = ev.clientY - gy; this.arruma(); this.el.classList.add('mexendo'); }
        // ímã: cantos e bordas da tela e bordas de outras janelas soltas (Ima.encaixa)
        const wj = this.el.offsetWidth, hj = this.el.offsetHeight, g = ev.shiftKey ? { x: ev.clientX - gx, y: ev.clientY - gy } : Ima.encaixa(this.el, ev.clientX - gx, ev.clientY - gy, wj, hj);
        c.x = Math.round(g.x); c.y = Math.round(g.y); this.el.classList.toggle('grudando', !!g.grudou); this.el.style.left = clamp(c.x, 0, innerWidth - 80) + 'px'; this.el.style.top = clamp(c.y, 0, innerHeight - 30) + 'px'; };
      bar.onpointerup = bar.onpointercancel = ev => { bar.onpointermove = bar.onpointerup = bar.onpointercancel = null; this.el.classList.remove('mexendo', 'grudando');
        // solto na beira direita (no meio da altura): encaixa de novo; nos CANTOS fica solta, grudada no canto
        if (c.modo === 'solto' && !c.min && ev.type === 'pointerup' && ev.clientX >= innerWidth - 24 && ev.clientY > 110 && ev.clientY < innerHeight - 110) { c.modo = 'lado'; this.arruma(); }
        this.grava(); }; };
  },
  borda() {
    const b = $('.qed-borda', this.el), c = this.cfg();
    b.onpointerdown = e => { if (c.modo !== 'lado') return; e.preventDefault(); b.setPointerCapture(e.pointerId); this.el.classList.add('mexendo');
      b.onpointermove = ev => { c.w = clamp(Math.round(innerWidth - ev.clientX), 340, innerWidth * .7); this.el.style.width = c.w + 'px'; document.body.style.setProperty('--qed-w', c.w + 'px'); };
      b.onpointerup = b.onpointercancel = () => { b.onpointermove = b.onpointerup = b.onpointercancel = null; this.el.classList.remove('mexendo'); this.grava(); dispatchEvent(new Event('resize')); }; };
  },
  /* ANIMADOR SÓ PARA NAVEGAR enquanto o painel está aberto (e não minimizado): a TIMELINE do Animador é o navegador do Ateliê —
     andar nela (clicar na régua, setas, , e .) leva o painel para aquele quadro; tocar não leva (só ao parar). Mudar algo no
     Animador volta como era (só o painel muda); Ctrl+Z/Ctrl+Y do Animador desfazem no painel. Minimizar ou fechar libera. */
  trava() { return !!(this.atual && this.el && !this.el.hidden && !this.cfg().min); },
  ligaAnimador() {
    if (this._lig || typeof App === 'undefined') return; this._lig = true;
    const sq = App.setQ.bind(App); App.setQ = (q, o) => { const r = sq(q, o); this.segue(); return r; };
    const pa = App.pausa.bind(App); App.pausa = (...x) => { const r = pa(...x); this.segue(); return r; };
    const cm = App.commit.bind(App); App.commit = (rot, o = {}) => (this.trava() && !o.livre) ? this.recusa() : cm(rot, o);
    const un = App.undo.bind(App); App.undo = () => this.trava() ? this.manda('desfazer') : un();
    const re = App.redo.bind(App); App.redo = () => this.trava() ? this.manda('refazer') : re();
    // no palco: arrastar para mexer fica parado (mão, espaço, botão do meio e rodinha continuam; dois cliques troca o personagem do painel)
    $('#palco-cv')?.addEventListener('pointerdown', e => { if (!this.trava() || e.button !== 0 || App.palco.espaco || App.ferr === 'mao' || e.altKey) return; e.stopImmediatePropagation(); e.preventDefault(); }, true);
  },
  manda(tipo) { this.ifr?.contentWindow?.postMessage({ tipo }, location.origin); },
  recusa() {
    if (JSON.stringify(App.P) !== App.ultimo) App.troca(JSON.parse(App.ultimo)); // o que mudou no Animador volta como era
    if (Date.now() - (this._avisoT || 0) > 4000) { this._avisoT = Date.now(); UI.toast('Com o Ateliê aberto ao lado, o Animador fica <b>só para navegar</b> (timeline, tocar, zoom). Mude pelo Ateliê, ou minimize/feche ele para mexer aqui.', { kind: 'warn', time: 5000 }); }
  },
  // o painel acompanha o quadro da timeline do Animador (parado; tocando, vai quando parar)
  segue() {
    clearTimeout(this._seg); if (!this.trava() || App.tocando || App.q === this.atual.quadro) return;
    this._seg = setTimeout(() => { if (!this.trava() || App.tocando || App.q === this.atual.quadro) return; const n = Modelo.achar(App.P, this.atual.no)?.no; if (n) this.abrir(n, App.q); }, 160);
  },
  pintaTrava() {
    const on = this.trava(); document.body.classList.toggle('qed-trava', on); let b = $('#qed-aviso');
    if (!on) { b?.remove(); return; }
    if (!b) { b = h(`<div id="qed-aviso" class="qed-aviso">${ic('eye', 13)}<span></span><button class="btn sm" title="Minimiza o Ateliê e libera o Animador">Liberar o Animador</button></div>`); $('#palco')?.appendChild(b); $('button', b).onclick = () => { this.cfg().min = true; this.grava(); this.arruma(); }; }
    $('span', b).innerHTML = `Só navegando: o Ateliê ao lado muda o <b>quadro ${this.atual.quadro + 1}</b>. Ande na timeline para trocar de quadro.`;
  },
  // janela solta: muda de tamanho por qualquer borda ou canto (o iframe fica tampado enquanto arrasta)
  tamanhos() {
    const c = this.cfg();
    for (const z of $$('.qed-rz', this.el)) z.onpointerdown = e => { if (c.modo !== 'solto' || c.min || e.button !== 0) return; e.preventDefault(); z.setPointerCapture(e.pointerId); this.el.classList.add('mexendo');
      const d = z.dataset.rz, r = this.el.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, MW = 320, MH = 240;
      z.onpointermove = ev => { const dx = ev.clientX - x0, dy = ev.clientY - y0; let { left: x, top: y, width: W, height: H } = r;
        const im = (lado, v) => ev.shiftKey ? v : Ima.encaixaBorda(this.el, lado, v); // a borda que muda também gruda (Shift solta)
        if (d.includes('e')) W = clamp(im('dir', r.right + dx) - r.left, MW, innerWidth - r.left);
        if (d.includes('s')) H = clamp(im('baixo', r.bottom + dy) - r.top, MH, innerHeight - r.top);
        if (d.includes('w')) { W = clamp(r.right - im('esq', r.left + dx), MW, r.right); x = r.right - W; }
        if (d.includes('n')) { H = clamp(r.bottom - im('cima', r.top + dy), MH, r.bottom); y = r.bottom - H; }
        c.x = Math.round(x); c.y = Math.round(y); c.W = Math.round(W); c.H = Math.round(H); Object.assign(this.el.style, { left: c.x + 'px', top: c.y + 'px', width: c.W + 'px', height: c.H + 'px' }); };
      z.onpointerup = z.onpointercancel = () => { z.onpointermove = z.onpointerup = z.onpointercancel = null; this.el.classList.remove('mexendo'); this.grava(); }; };
  },
  // o ícone do Ateliê na barra: pergunta e abre o Ateliê COMPLETO numa aba nova, no personagem, parado na pose deste quadro
  async completo() {
    const a = this.atual, n = a && Modelo.achar(App.P, a.no)?.no, def = n && App.P?.personagens?.[n.ref]; if (!def) return;
    const ok = await UI.confirm({ title: 'Abrir o Ateliê completo?', msg: `<b>${esc(def.nome)}</b> abre numa <b>aba nova</b> com o Ateliê inteiro (timeline, vistas, animações de teste…), parado na pose do quadro ${a.quadro + 1}.<br><br>O que você mudar lá vale para o <b>personagem</b> (todos os quadros e animações quando for salvo); este painel continua mudando só o quadro ${a.quadro + 1}.`, ok: 'Abrir numa aba nova' });
    if (!ok) return; const q0 = App.q; App.q = a.quadro; try { await Animacoes.editarNoAtelie(n); } finally { App.q = q0; }
  },
  fechar() { clearTimeout(this._seg); if (this.el) this.el.hidden = true; setTimeout(() => this.pintaTrava()); document.body.classList.remove('qed-lado'); document.body.style.setProperty('--qed-w', '0px'); this.atual = null; if (typeof App !== 'undefined') App._enqCorta = true; dispatchEvent(new Event('resize')); },
  // o painel mandou o quadro: a chave daquele quadro recebe; a seguinte segura como era (só este quadro muda)
  async recebe(d) {
    const P = App.P; if (!P || P.id !== d.projeto) return; const n = Modelo.achar(P, d.no)?.no; if (!n) return;
    if (d.def && P.personagens?.[d.personagem]) { P.personagens[d.personagem] = d.def; await Arq.garantir(Modelo.chavesImgs(d.def)); }
    // a chave seguinte segura como era; sem chave depois, o quadro seguinte ganha uma (senão a mudança seguia até o fim)
    const qs = Modelo.quadrosChave(n), prox0 = qs.find(q => q > d.quadro), prox = prox0 ?? (d.quadro + 1 < (P.duracao || Infinity) ? d.quadro + 1 : null), antes = prox != null ? Modelo.estadoPersonagem(n, prox) : null;
    if (prox != null) Modelo.chave(n, prox); const k = Modelo.chave(n, d.quadro);
    k.sessoes = { ...(d.sessoes || {}) }; k.partes = clone(d.partes || {});
    if (prox != null) { const k2 = n.chaves[prox]; k2.sessoes = { ...(k2.sessoes || {}) }; k2.partes = { ...(k2.partes || {}) };
      for (const sid of Object.keys(k.sessoes)) if (!(sid in k2.sessoes)) k2.sessoes[sid] = antes?.sessoes?.[sid] ?? null;
      for (const pid of Object.keys(k.partes)) if (!(pid in k2.partes)) k2.partes[pid] = antes?.partes?.[pid] ? clone(antes.partes[pid]) : null; }
    App.commit(`Quadro ${d.quadro + 1} (Ateliê)`, { livre: true });
  },

  /* ================= DENTRO DO PAINEL (iframe ?embed=quadro) ================= */
  async iniciaEmbutido() {
    document.body.classList.add('embed-quadro');
    // o painel tem o lugar dos painéis e da barra de ferramentas DELE (não mexe no Ateliê de sempre)
    Paineis.CHAVE = 'animador-atelie-layout-quadro'; Paineis.CH_ALT = 'animador-atelie-alturas-quadro';
    { const ch = Pintura.chLugar.bind(Pintura); Pintura.chLugar = () => ch() + '-quadro'; }
    { const lug = Pintura.lugar.bind(Pintura); Pintura.lugar = () => lug() || { x: 0, y: 0, preso: { alvo: 'palco', lado: 'baixo', off: 8, esticar: false } }; } // espaço pequeno: a barra de ferramentas nasce deitada embaixo da tela
    { const ap = Paineis.aplica.bind(Paineis); Paineis.aplica = () => { ap(); this.arrumaLugares(); }; } // painéis mudados de lugar: as colunas de baixo se dividem o espaço todo
    for (const nm of ['commit', 'undo', 'redo']) { const f = Atelie[nm]; Atelie[nm] = function (...x) { if (nm === 'commit') QuadroEd.protege(); const r = f.apply(this, x); QuadroEd.foto(); QuadroEd.agenda(); return r; }; }
    addEventListener('message', e => { if (e.origin !== location.origin) return; const t = e.data?.tipo;
      if (t === 'abre-quadro') this.abreQuadro(); else if (t === 'desfazer') Atelie.desfazJa(false); else if (t === 'refazer') Atelie.desfazJa(true); });
    this.prog(30, 'Conta conferida'); parent.postMessage({ tipo: 'quadro-pronto' }, location.origin);
  },
  // embaixo da tela do painel: uma coluna para cada lugar que tem algo à vista, dividindo a largura toda (sem buraco vazio)
  arrumaLugares() {
    const at = $('#atelie .at'); if (!at) return; const fora = ['vistas', 'linha'], st = Paineis.st || { cols: [] }; let n = 0, larg = [];
    for (const lado of ['esq', 'dir']) { const area = Paineis.area?.[lado]; if (!area) continue; let tem = false;
      for (const col of $$(':scope > .dock-col', area)) { const c = st.cols.find(x => x.id === col.dataset.col), vazio = !c || c.p.every(i => fora.includes(i)); col.classList.toggle('qe-fora', vazio); if (!vazio) tem = true; }
      area.classList.toggle('qe-fora', !tem); if (tem) { n++; larg.push(lado === 'dir' ? 'minmax(0,1.15fr)' : 'minmax(0,1fr)'); } }
    at.style.setProperty('--qe-cols', n ? larg.join(' ') : 'minmax(0,1fr)'); at.classList.toggle('qe-sem-baixo', !n);
  },
  prog(p, t) { try { parent.postMessage({ tipo: 'quadro-prog', p, t }, location.origin); } catch { } },
  async abreQuadro() {
    this.prog(33, 'Lendo o quadro…'); const r = await DB.get('arquivos', 'quadro-abrir').catch(() => null); if (!r?.def) return;
    if (Atelie.soQuadro) await this.mandar(); // o quadro de antes já foi
    // RÁPIDO (andando na timeline do Animador): mesmo personagem, sem mudança e mesma vista = só troca o quadro, sem reabrir o Ateliê
    { const S = Atelie.soQuadro, a0 = (Atelie.def?.animacoes || []).find(x => x.id === '__quadro'), rj = JSON.stringify(r.def);
      if (S && a0 && Atelie.def.id === r.def.id && (r.vista || null) === (S.vistaQ || null) && rj === this.fonteJ) {
        Object.assign(S, { projeto: r.projeto, no: r.no, quadro: r.quadro, copias: {} }); a0.nome = `Quadro ${r.quadro + 1}`;
        a0.trilhas = [[{ s: { ...(r.sessoes || {}) }, p: clone(r.partes || {}) }]];
        const ks = Modelo.chavesImgs(r.def).filter(k => !Arq.img.get(k)); if (ks.length) await Arq.garantir(ks).catch(() => { });
        Animacoes.irPara(a0, 0, 0); Atelie.pilha = []; Atelie.refazer = []; Atelie.ultimo = JSON.stringify(Atelie.def); this.foto(); Atelie.pinta();
        parent.postMessage({ tipo: 'quadro-aberto' }, location.origin); return; } }
    this.fonteJ = JSON.stringify(r.def);
    const def = clone(r.def); Modelo.garanteVistas(def); if (r.vista && def.vistas?.some(v => v.id === r.vista) && def.vistaAtual !== r.vista) Modelo.ativaVista(def, r.vista);
    const a = { id: '__quadro', nome: `Quadro ${r.quadro + 1}`, trilhas: [[{ s: { ...(r.sessoes || {}) }, p: clone(r.partes || {}) }]], q: 1 };
    def.animacoes = [...(def.animacoes || []).filter(x => x.id !== '__quadro'), a];
    Atelie.soQuadro = { projeto: r.projeto, no: r.no, quadro: r.quadro, vista0: r.def.vistaAtual || null, vistaQ: r.vista || null, copias: {}, defJ: null };
    Animacoes.parar?.(true); Animacoes.poseFixa = null; Atelie.fecharEditor?.(); Atelie.aba = Atelie.aba === 'animacoes' ? 'peca' : Atelie.aba;
    // as imagens, uma a uma (6 de cada vez), contando de verdade
    const ks = Modelo.chavesImgs(def).filter(k => !Arq.img.get(k)); let feitas = 0; this.prog(38, ks.length ? `Imagens 0 de ${ks.length}` : 'Montando o quadro…');
    { let i = 0; await Promise.all(Array.from({ length: Math.min(6, ks.length) }, async () => { while (i < ks.length) { const k = ks[i++]; try { await Arq.garantir([k]); } catch { } feitas++; this.prog(38 + 52 * feitas / ks.length, `Imagens ${feitas} de ${ks.length}`); } })); }
    this.prog(93, 'Montando o quadro…');
    await Atelie.abrir(null, { def }); this.defJ0 = JSON.stringify(this.semQuadro(Atelie.def)); this.foto();
    Animacoes.irPara(a, 0, 0); Atelie.pilha = []; Atelie.refazer = []; Atelie.ultimo = JSON.stringify(Atelie.def); Atelie.enquadrar();
    parent.postMessage({ tipo: 'quadro-aberto' }, location.origin);
  },
  passo() { return (Atelie.def?.animacoes || []).find(x => x.id === '__quadro')?.trilhas?.[0]?.[0] || null; },
  semQuadro(def) { const o = clone(def); o.animacoes = (o.animacoes || []).filter(x => x.id !== '__quadro'); const v0 = Atelie.soQuadro?.vista0; if (v0 && o.vistaAtual !== v0 && o.vistas?.some(v => v.id === v0)) Modelo.ativaVista(o, v0); return o; },
  agenda() { if (!Atelie.soQuadro) return; clearTimeout(this._t); this._t = setTimeout(() => this.mandar(), 120); },
  async mandar() {
    clearTimeout(this._t); const S = Atelie.soQuadro, ps = this.passo(); if (!S || !ps) return;
    // Animacoes.irPara recria o frame a partir do passo: o que estiver na tela é o que vai
    const out = this.semQuadro(Atelie.def), aps = Object.values(ps.p || {}).flatMap(e => Object.values(e?.ap || {}).map(v => v?.k)).filter(Boolean);
    if (aps.length) out.apKeys = [...new Set([...(out.apKeys || []), ...aps])]; // as máscaras deste quadro vão com o personagem da animação
    const dj = JSON.stringify(out), msg = { tipo: 'quadro-editado', projeto: S.projeto, no: S.no, quadro: S.quadro, personagem: Atelie.def.id, sessoes: clone(ps.s || {}), partes: clone(ps.p || {}) };
    if (dj !== (S.defJ || this.defJ0)) { msg.def = out; S.defJ = dj; this.fonteJ = dj; } // o Animador guarda exatamente isto: o próximo quadro abre rápido // o personagem da animação só vai junto quando mudou (imagem copiada para o quadro, máscara…)
    parent.postMessage(msg, location.origin);
  },
  // CAMADAS no painel (ver/esconder, opacidade, ordem, juntar, + camada…) mexem direto na imagem: antes de cada commit, a imagem do
  // personagem que mudou volta como era e a mudança vai para a CÓPIA só deste quadro (a mesma de pintar). Escolher a camada ativa não conta.
  assina(img) { return JSON.stringify([img.k, img.camadas || null, img.vCam || null]); },
  foto() { if (!Atelie.soQuadro || !Atelie.def) return; const m = new Map(); for (const p of Atelie.def.partes || []) for (const i of p.imgs || []) if (!i.doQuadro) m.set(i.id, { a: this.assina(i), v: clone({ k: i.k, camadas: i.camadas, camAtiva: i.camAtiva }) }); this._fotos = m; },
  protege() {
    const S = Atelie.soQuadro, m = this._fotos; if (!S || !m) return;
    for (const p of Atelie.def.partes || []) for (const img of [...(p.imgs || [])]) {
      const f = img.doQuadro ? null : m.get(img.id); if (!f || this.assina(img) === f.a) continue;
      const novo = { k: img.k, camadas: clone(img.camadas), camAtiva: img.camAtiva }, ja = S.copias[img.id] && p.imgs.find(i => i.id === S.copias[img.id]);
      const c = ja || this.imgDoQuadro(img); Object.assign(c, novo); if (!novo.camadas) delete c.camadas;
      img.k = f.v.k; if (f.v.camadas) img.camadas = clone(f.v.camadas); else delete img.camadas; if (f.v.camAtiva) img.camAtiva = f.v.camAtiva; else delete img.camAtiva;
    }
  },
  // pintar no painel: a imagem do personagem não muda — o quadro ganha uma CÓPIA dela (com a mesma posição) e a pintura vai nela
  imgDoQuadro(img) {
    const S = Atelie.soQuadro, def = Atelie.def; if (!S || !img || img.doQuadro) return img;
    const ja = S.copias[img.id] && Pintura.atual({ id: S.copias[img.id] }); if (ja && ja.id !== img.id) return ja;
    const p = def.partes.find(x => x.imgs.some(i => i.id === img.id)); if (!p) return img;
    const c = { ...clone(img), id: uid('i'), nome: `${img.nome} (quadro ${S.quadro + 1})`, doQuadro: true }; p.imgs.push(c); S.copias[img.id] = c.id;
    const ps = this.passo(); if (ps) { const est = Atelie.estado()[p.id] || {}, e = { ...((ps.p ||= {})[p.id] || {}), img: c.id };
      const dd = est.d?.[img.id]; if (dd) e.d = { ...(e.d || {}), [c.id]: dd }; if (e.ap?.[img.id]) e.ap = { ...e.ap, [c.id]: e.ap[img.id] };
      ps.p[p.id] = e; if (Atelie.teste) { Atelie.teste.partes = Atelie.teste.partes || {}; Atelie.teste.partes[p.id] = clone(e); } }
    return c;
  },
};
