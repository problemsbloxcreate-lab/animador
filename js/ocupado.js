/* ===================== ocupado.js — tela "A IA está trabalhando" (Ateliê e editor) =====================
   Enquanto a IA trabalha, a tela inteira fica bloqueada (nada de mexer no que ela está mudando) e mostra:
   o que está fazendo, o tempo que passou, o tempo aproximado que falta e a porcentagem.
   O tempo aproximado aprende com os pedidos anteriores do mesmo tipo (guardado neste navegador).
   Uso: const fim = Ocupado.inicio({ titulo, tipo, est }); Ocupado.passo('texto'); Ocupado.texto(n letras); fim();
   Pode aninhar: um fluxo grande (ex.: organizar tudo) abre uma vez e as chamadas da IA dentro dele só atualizam. */
'use strict';
const Ocupado = {
  n: 0, el: null, t0: 0, est: 30, letras: 0, letrasEsp: 0, tipo: '', _iv: 0,
  hist() { try { return JSON.parse(localStorage.getItem('animador-ia-tempos') || '{}') || {}; } catch { return {}; } },
  // tempo (s) e tamanho da resposta (letras) que esse tipo costuma levar
  previsao(tipo, est) { const h = this.hist()[tipo]; return { s: h?.s?.length ? h.s.reduce((a, b) => a + b, 0) / h.s.length : est, l: h?.l?.length ? h.l.reduce((a, b) => a + b, 0) / h.l.length : 0 }; },
  aprende(tipo, seg, letras) {
    if (!tipo || seg < 1) return; const H = this.hist(), h = H[tipo] || (H[tipo] = { s: [], l: [] });
    h.s = [...h.s, Math.round(seg)].slice(-6); if (letras > 50) h.l = [...h.l, letras].slice(-6);
    try { localStorage.setItem('animador-ia-tempos', JSON.stringify(H)); } catch { }
  },
  inicio(o = {}) {
    this.n++; if (this.n > 1) { if (o.titulo) this.passo(o.subtitulo || o.titulo); return () => this.fim(); }
    const p = this.previsao(o.tipo || 'ia', o.est || 30);
    Object.assign(this, { t0: performance.now(), est: Math.max(3, p.s), letras: 0, letrasEsp: p.l, tipo: o.tipo || 'ia', pctMin: 0 });
    this.el = h(`<div class="ocupado" role="alertdialog" aria-live="polite"><div class="oc-card">
      <div class="oc-ic">${ic('sparkles', 30)}</div><b class="oc-tit">${esc(o.titulo || 'A IA está trabalhando')}</b>
      <div class="oc-sub" data-sub>${esc(o.subtitulo || 'Pensando…')}</div>
      <div class="oc-barra"><i data-b></i></div>
      <div class="oc-num"><span data-pct>0%</span><span class="sp"></span><span>passou <b data-pas>0:00</b></span><span>falta ~<b data-falta>…</b></span></div>
      <div class="oc-av">Aguarde: enquanto a IA trabalha não dá para mexer (para nada sair do lugar). Não feche esta aba.</div></div></div>`);
    document.body.appendChild(this.el); requestAnimationFrame(() => this.el?.classList.add('on'));
    this._bloq = e => { if (this.n > 0) { e.preventDefault(); e.stopPropagation(); } };
    for (const ev of ['keydown', 'keyup', 'wheel', 'contextmenu']) addEventListener(ev, this._bloq, { capture: true, passive: false });
    clearInterval(this._iv); this._iv = setInterval(() => this.pinta(), 250); this.pinta();
    return () => this.fim();
  },
  passo(txt) { const e = this.el && $('[data-sub]', this.el); if (e) e.textContent = txt; },
  texto(n) { this.letras = n; },
  // força uma porcentagem mínima (ex.: 3 de 5 presets feitos = 60%)
  parte(feito, total) { this.pctMin = Math.max(this.pctMin || 0, Math.min(.97, feito / Math.max(1, total))); },
  fmt(s) { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; },
  pinta() {
    if (!this.el) return; const t = (performance.now() - this.t0) / 1000;
    // pelo tempo (curva que chega perto de 95% no tempo previsto e continua devagar) e pelo tamanho da resposta, o que estiver mais adiantado
    const pT = .95 * (1 - Math.exp(-2.6 * t / this.est)), pL = this.letrasEsp ? Math.min(.97, this.letras / this.letrasEsp) : 0, pct = Math.max(pT, pL, this.pctMin || 0);
    const falta = pct > .02 ? Math.max(1, t / pct - t) : this.est - t;
    $('[data-b]', this.el).style.width = (pct * 100).toFixed(1) + '%'; $('[data-pct]', this.el).textContent = Math.round(pct * 100) + '%';
    $('[data-pas]', this.el).textContent = this.fmt(t); $('[data-falta]', this.el).textContent = t > this.est * 2.2 && pct > .9 ? 'quase lá' : this.fmt(falta);
  },
  fim() {
    this.n = Math.max(0, this.n - 1); if (this.n) return;
    const seg = (performance.now() - this.t0) / 1000; this.aprende(this.tipo, seg, this.letras);
    clearInterval(this._iv); for (const ev of ['keydown', 'keyup', 'wheel', 'contextmenu']) removeEventListener(ev, this._bloq, { capture: true });
    const el = this.el; this.el = null; if (!el) return; $('[data-b]', el).style.width = '100%'; $('[data-pct]', el).textContent = '100%'; el.classList.remove('on'); setTimeout(() => el.remove(), 220);
  },
  // embrulha uma tarefa: Ocupado.com({ titulo }, async () => …)
  async com(o, fn) { const fim = this.inicio(o); try { return await fn(); } finally { fim(); } },
};
