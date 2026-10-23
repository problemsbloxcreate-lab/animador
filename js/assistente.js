/* ===================== assistente.js — ASSISTENTE (IA) do Animador numa janela que fica aberta =====================
   Janela solta (não trava a tela): arrasta pelo topo e muda de tamanho pelo canto (lugar guardado no localStorage
   `animador-ia-painel`). Com ela aberta dá para continuar mexendo e CITAR coisas (botão direito › "Citar na IA" na hierarquia,
   no palco, na timeline e na régua): camadas, quadros, trechos (de…até) e a câmera viram etiquetas que vão junto no pedido.
   Tempos escritos no pedido ("0:15 a 1:12") viram trecho sozinhos (a IA mexe só neles, `Trechos.protege`).
   A CONVERSA fica guardada: neste computador (arquivos["ia-conversa:<id do projeto>"]) e dentro do .animador
   (conversa-ia.json, em `Toon.montar`/`ler`). Fora do P de propósito: o Ctrl+Z não apaga mensagens.
   Enquanto a IA trabalha a tela fica travada (Ocupado) — dá para sair da aba que ela continua e avisa no fim. */
'use strict';
const Assistente = {
  el: null, msgs: [], cits: [], pid: null, foco: null, trabalhando: false,
  chave(id = App.P?.id) { return 'ia-conversa:' + id; },
  async carrega() {
    const id = App.P?.id; if (!id) return; if (this.pid === id) return; this.pid = id; this.cits = [];
    try { this.msgs = (await DB.get('arquivos', this.chave(id)))?.msgs || []; } catch { this.msgs = []; }
    this.pinta();
  },
  async guarda() { const id = this.pid; if (!id) return; try { await DB.put('arquivos', { msgs: this.msgs.slice(-200), em: Date.now() }, this.chave(id)); } catch (e) { console.warn('conversa', e); } },
  // ---------- abrir / fechar ----------
  async abrir(o = {}) {
    if (!App.P) return; this.monta(); await this.carrega();
    if (o.foco !== undefined) this.foco = o.foco || null;
    for (const t of o.trechos || []) this.citar({ tipo: 'trecho', de: t.de, ate: t.ate }, { semAbrir: true });
    for (const c of o.cits || []) this.citar(c, { semAbrir: true });
    if (o.texto) $('textarea', this.el).value = o.texto;
    this.el.hidden = false; this.arruma(); this.pinta(); setTimeout(() => $('textarea', this.el)?.focus(), 30);
  },
  fecha() { if (this.el) this.el.hidden = true; },
  aberto() { return !!this.el && !this.el.hidden; },
  monta() {
    if (this.el) return;
    this.el = h(`<div class="iap" hidden role="dialog" aria-label="Assistente">
      <div class="iap-cab" title="Arraste para mudar de lugar">${ic('sparkles', 15)}<b>Assistente</b><span class="sp"></span>
        <button class="ibtn" data-limpa title="Começar uma conversa nova (apaga o histórico desta animação)">${ic('trash', 14)}</button><button class="ibtn" data-x title="Fechar (a conversa fica guardada)">${ic('x', 15)}</button></div>
      <div class="iap-msgs"></div>
      <div class="iap-pe">
        <div class="iap-cits"></div>
        <textarea rows="2" placeholder="Peça algo… Ex.: o Problems pisca mais devagar de 0:15 a 0:20"></textarea>
        <div class="iap-acoes"><button class="iap-lnk" data-q title="Citar o quadro que está na tela">${ic('marker', 13)} Quadro atual</button><button class="iap-lnk" data-refs title="Vídeos de referência: a IA copia o estilo de animação e edição deles">${ic('film', 13)} Referências</button><span class="sp"></span><button class="btn sm ia" data-env title="Enviar (Enter · Shift+Enter quebra a linha)">${ic('up', 14)}</button></div>
        <div class="iap-refs" hidden></div>
      </div></div>`);
    document.body.appendChild(this.el);
    if (typeof IAUso !== 'undefined') $('.iap-cab .sp', this.el).after(IAUso.selo(true)); // quanto da IA da equipe já foi usado
    const ta = $('textarea', this.el);
    $('[data-x]', this.el).onclick = () => this.fecha();
    $('[data-limpa]', this.el).onclick = async () => { if (!this.msgs.length) return; if (!(await UI.confirm({ title: 'Começar uma conversa nova?', msg: 'O histórico desta animação com a IA é apagado (o que ela já fez na animação continua).' }))) return; this.msgs = []; this.guarda(); this.pinta(); };
    $('[data-env]', this.el).onclick = () => this.enviar();
    $('[data-q]', this.el).onclick = () => this.citar({ tipo: 'quadro', q: App.q });
    $('[data-refs]', this.el).onclick = () => { const r = $('.iap-refs', this.el); r.hidden = !r.hidden; if (!r.hidden && !r.firstChild) r.appendChild(RefsAnim.campo({ modo: 'editor', quadros: 24, lista: () => (App.P.refsAnim ||= []), chave: () => uid('a'), mudou: () => { App.commit('Vídeos de referência', { semArvore: true }); this.pintaRefs(); } })); this.pintaRefs(); };
    ta.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.enviar(); } if (e.key === 'Escape') this.fecha(); });
    let tm; ta.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => this.tempos(), 700); });
    this.ligaArrasto();
    new ResizeObserver(() => { if (!this.el.hidden && !this._arrumando) this.salvaLugar(); }).observe(this.el);
    addEventListener('resize', () => this.aberto() && this.arruma());
  },
  // ---------- lugar e tamanho ----------
  lugar() { try { return JSON.parse(localStorage.getItem('animador-ia-painel') || 'null'); } catch { return null; } },
  salvaLugar() { const r = this.el.getBoundingClientRect(); try { localStorage.setItem('animador-ia-painel', JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) })); } catch { } },
  arruma() {
    const l = this.lugar() || { w: 380, h: 520, x: innerWidth - 400, y: 70 }, w = clamp(l.w || 380, 300, innerWidth - 16), hh = clamp(l.h || 520, 300, innerHeight - 16);
    this._arrumando = true; Object.assign(this.el.style, { width: w + 'px', height: hh + 'px', left: clamp(l.x, 8, innerWidth - w - 8) + 'px', top: clamp(l.y, 8, innerHeight - hh - 8) + 'px' });
    requestAnimationFrame(() => { this._arrumando = false; });
  },
  ligaArrasto() {
    const cab = $('.iap-cab', this.el);
    cab.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button') || this.trabalhando) return; e.preventDefault(); cab.setPointerCapture(e.pointerId);
      const r = this.el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top; this.el.classList.add('movendo');
      const mv = ev => { this.el.style.left = clamp(ev.clientX - dx, 0, innerWidth - r.width) + 'px'; this.el.style.top = clamp(ev.clientY - dy, 0, innerHeight - 40) + 'px'; };
      const up = () => { cab.removeEventListener('pointermove', mv); cab.removeEventListener('pointerup', up); cab.removeEventListener('pointercancel', up); this.el.classList.remove('movendo'); this.salvaLugar(); };
      cab.addEventListener('pointermove', mv); cab.addEventListener('pointerup', up); cab.addEventListener('pointercancel', up);
    });
  },
  // ---------- citações ----------
  rotulo(c, P = App.P) {
    const t = q => Trechos.txt(q, P.fps);
    if (c.tipo === 'trecho') return `${t(c.de)} a ${t(c.ate + 1)}`;
    if (c.tipo === 'quadro') return `Quadro ${c.q + 1} · ${t(c.q)}`;
    if (c.tipo === 'camera') return 'Câmera' + (c.q != null ? ` · quadro ${c.q + 1}` : '');
    if (c.tipo === 'camada') return (Modelo.achar(P, c.id)?.no.nome || c.nome || 'Camada') + (c.q != null ? ` · quadro ${c.q + 1}` : '');
    return c.nome || 'Citação';
  },
  icone(c) { return { trecho: 'cut', quadro: 'marker', camera: 'camera', camada: 'layers' }[c.tipo] || 'bookmark'; },
  igual(a, b) { return a.tipo === b.tipo && a.id === b.id && a.q === b.q && a.de === b.de && a.ate === b.ate; },
  citar(c, o = {}) {
    if (!App.P) return; this.monta(); if (!this.cits.some(x => this.igual(x, c))) this.cits.push(c);
    if (!o.semAbrir) { if (!this.aberto()) return this.abrir(); this.pintaCits(); $('textarea', this.el).focus(); }
  },
  // tempos escritos no pedido viram trecho (os automáticos somem se saírem do texto)
  tempos() {
    const P = App.P, ta = $('textarea', this.el); if (!P || !ta) return; const achados = Trechos.doTexto(ta.value, P); let mudou = false;
    for (let i = this.cits.length - 1; i >= 0; i--) { const c = this.cits[i]; if (c.auto && !achados.some(t => t.de === c.de && t.ate === c.ate)) { this.cits.splice(i, 1); mudou = true; } }
    for (const t of achados) if (!this.cits.some(c => c.tipo === 'trecho' && c.de === t.de && c.ate === t.ate)) { this.cits.push({ tipo: 'trecho', de: t.de, ate: t.ate, auto: true }); mudou = true; }
    if (mudou) this.pintaCits();
  },
  // ---------- desenho ----------
  pinta() { if (!this.el) return; this.pintaMsgs(); this.pintaCits(); this.pintaRefs(); },
  pintaRefs() { const b = this.el && $('[data-refs]', this.el), n = (App.P?.refsAnim || []).length; if (b) b.innerHTML = `${ic('film', 13)} Referências${n ? ` <i>${n}</i>` : ''}`; },
  chip(c, i, solta) {
    const el = h(`<span class="iap-chip ${c.tipo}" title="${c.tipo === 'trecho' ? 'A IA mexe só neste trecho (clique para mudar os tempos)' : 'Clique para ir até lá'}">${ic(this.icone(c), 12)}<span>${esc(this.rotulo(c))}</span>${solta ? '' : `<button data-x title="Tirar">${ic('x', 11)}</button>`}</span>`);
    el.onclick = async e => {
      if (e.target.closest('[data-x]')) { this.cits.splice(i, 1); return this.pintaCits(); }
      if (c.tipo === 'trecho' && !solta) { const v = await UI.prompt({ title: 'Tempos do trecho', label: 'De … a … (minutos:segundos)', value: this.rotulo(c) }); const [t] = v ? Trechos.doTexto(v.replace(/\s*-\s*/, ' a '), App.P) : []; if (t) { Object.assign(c, { de: t.de, ate: t.ate, auto: false }); this.pintaCits(); } return; }
      const q = c.q ?? c.de; if (q != null) { App.pausa?.(); App.setQ(q); } if (c.id && Modelo.achar(App.P, c.id)) App.selecionar(c.id); else if (c.tipo === 'camera') App.selecionar('camera');
    };
    return el;
  },
  pintaCits() { const b = this.el && $('.iap-cits', this.el); if (!b) return; b.innerHTML = ''; this.cits.forEach((c, i) => b.appendChild(this.chip(c, i))); b.hidden = !this.cits.length; },
  pintaMsgs() {
    const b = $('.iap-msgs', this.el); b.innerHTML = '';
    if (!this.msgs.length) b.appendChild(h(`<div class="iap-vazio">${ic('sparkles', 22)}<p>Peça o que quiser nesta animação.</p><small>Com a janela aberta, clique com o botão direito numa camada, num quadro da timeline ou no palco › <b>Citar na IA</b> para mostrar do que está falando.</small></div>`));
    for (const m of this.msgs) {
      const el = h(`<div class="iap-m ${m.de === 'eu' ? 'eu' : 'ia'}${m.erro ? ' erro' : ''}"><div class="iap-t"></div></div>`);
      $('.iap-t', el).textContent = String(m.t).replace(/\n{2,}/g, '\n');
      if (m.cit?.length) { const cs = h('<div class="iap-mc"></div>'); m.cit.forEach((c, i) => cs.appendChild(this.chip(c, i, true))); el.prepend(cs); }
      if (m.em) el.appendChild(h(`<small class="iap-hora">${new Date(m.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>`));
      b.appendChild(el);
    }
    b.scrollTop = b.scrollHeight;
  },
  // ---------- enviar ----------
  conversaAntes() {
    const ult = this.msgs.slice(-8); if (!ult.length) return '';
    return 'CONVERSA ATÉ AGORA (só para entender o pedido; o que já foi feito JÁ ESTÁ na animação, não refaça):\n' + ult.map(m => `${m.de === 'eu' ? 'Pessoa' : 'IA'}: ${String(m.t).slice(0, 500)}`).join('\n') + '\n\n';
  },
  async extras(cits) {
    const P = App.P, linhas = [], imgs = [];
    for (const c of cits) {
      if (c.tipo === 'quadro' || (c.tipo === 'camada' && c.q != null) || (c.tipo === 'camera' && c.q != null)) {
        const larg = P.h > P.w ? 240 : 360, H = Math.round(larg * P.h / P.w), cv = document.createElement('canvas'); cv.width = larg; cv.height = H;
        try { Render.quadro(cv.getContext('2d'), P, c.q, larg, H); const b = RefsAnim.bloco(cv.toDataURL('image/jpeg', .8)); if (b) imgs.push(b, { type: 'text', text: `↑ COMO ESTÁ o quadro ${c.q + 1} (${Trechos.txt(c.q, P.fps)}) citado pela pessoa.` }); } catch { }
      }
      if (c.tipo === 'quadro') linhas.push(`- quadro ${c.q + 1} (${Trechos.txt(c.q, P.fps)})`);
      if (c.tipo === 'camera') linhas.push(`- a câmera${c.q != null ? ` no quadro ${c.q + 1}` : ''}`);
      if (c.tipo === 'camada') { const n = Modelo.achar(P, c.id)?.no; if (n) linhas.push(`- camada "${n.nome}" (${n.tipo}${n.tipo === 'personagem' ? ': ' + (P.personagens[n.ref]?.nome || '') : ''})${c.q != null ? ` no quadro ${c.q + 1}` : ''}, aparece dos quadros ${(n.de || 0) + 1} a ${Modelo.fimNo(P, n) + 1}`); }
    }
    return { texto: linhas.length ? 'A PESSOA CITOU (o pedido fala disto):\n' + linhas.join('\n') + '\n\n' : '', imgs };
  },
  async enviar() {
    if (this.trabalhando || !App.P) return; const ta = $('textarea', this.el), txt = ta.value.trim(); if (!txt) return ta.focus();
    clearTimeout(this._tm); this.tempos();
    const cits = this.cits.map(c => ({ ...c })), trechos = cits.filter(c => c.tipo === 'trecho').map(c => ({ de: c.de, ate: c.ate, nota: '' }));
    const ex = await this.extras(cits), antes = this.conversaAntes();
    this.msgs.push({ de: 'eu', t: txt, cit: cits.map(({ auto, ...c }) => c), em: Date.now() }); ta.value = ''; this.cits = []; this.pinta(); this.guarda();
    this.trabalhando = true; this.el.classList.add('trabalhando');
    const espera = h('<div class="iap-m ia esperando"><div class="iap-t">Pensando…</div></div>'); $('.iap-msgs', this.el).appendChild(espera); $('.iap-msgs', this.el).scrollTop = 1e9;
    let r, erro = false;
    try { r = await IA.executar(txt, this.foco, t => { $('.iap-t', espera).textContent = 'Escrevendo… (' + t.length + ' letras)'; }, { trechos, antes: antes + ex.texto, imgs: ex.imgs }); }
    catch (e) { r = 'Não deu: ' + (e?.message || e); erro = true; }
    finally { this.trabalhando = false; this.el?.classList.remove('trabalhando'); }
    this.msgs.push({ de: 'ia', t: r, em: Date.now(), ...(erro ? { erro: true } : {}) }); this.pinta(); this.guarda();
    if (erro && !txt) ta.value = txt;
  },
};
// projeto trocado: a janela mostra a conversa dele
(() => { const liga = () => { if (typeof App === 'undefined' || !App.abrir || App._assistLigado) return; App._assistLigado = true; const orig = App.abrir.bind(App); App.abrir = async (...a) => { const r = await orig(...a); if (Assistente.el) { Assistente.pid = null; Assistente.carrega(); } return r; }; };
  addEventListener('DOMContentLoaded', liga); setTimeout(liga, 0); })();
