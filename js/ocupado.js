/* ===================== ocupado.js — tela "A IA está trabalhando" (Ateliê e editor) =====================
   Enquanto a IA trabalha, a tela inteira fica bloqueada (nada de mexer no que ela está mudando) e mostra:
   o que está fazendo, o tempo que passou e uma barra andando. SEM previsão de tempo nem porcentagem inventada:
   o tempo da IA varia demais (fila do servidor, tamanho da resposta) e o chute travava/errava (decisão do dono).
   Só quando dá para contar de verdade (Ocupado.parte(3, 5) = 3 de 5 presets) a barra mostra o andamento real.
   Uso: const fim = Ocupado.inicio({ titulo, tipo, est }); Ocupado.passo('texto'); Ocupado.texto(n letras); fim();
   Pode aninhar: um fluxo grande (ex.: organizar tudo) abre uma vez e as chamadas da IA dentro dele só atualizam. */
'use strict';
const Ocupado = {
  n: 0, el: null, t0: 0, letras: 0, tipo: '', feito: null, _iv: 0,
  inicio(o = {}) {
    this.n++; if (this.n > 1) { if (o.titulo) this.passo(o.subtitulo || o.titulo); return () => this.fim(); }
    Object.assign(this, { t0: performance.now(), letras: 0, tipo: o.tipo || 'ia', feito: null, titulo: o.titulo || 'A IA está trabalhando', tituloAba: document.title, abaTxt: o.aba || (o.tipo && o.tipo !== 'ia' ? o.titulo : 'IA trabalhando'), fimTxt: o.fimTxt || null });
    // aba escondida: a IA continua. A trava pede ao Chrome para não congelar a aba enquanto isso; no fim, avisa (notificação) se a aba não estiver à vista
    try { navigator.locks?.request('animador-ia-' + Math.random(), () => new Promise(r => { this._solta = r; })).catch(() => { }); } catch { }
    this.el = h(`<div class="ocupado${(o.tipo || 'ia') === 'ia' ? '' : ' sem-ia'}" role="alertdialog" aria-live="polite"><div class="oc-card">
      <div class="oc-ic">${ic(o.icone || 'sparkles', 30)}</div><b class="oc-tit">${esc(o.titulo || 'A IA está trabalhando')}</b>
      <div class="oc-sub" data-sub>${esc(o.subtitulo || 'Pensando…')}</div>
      <div class="oc-barra rodando" data-barra><i data-b></i></div>
      <div class="oc-num"><span data-conta></span><span class="sp"></span><span>passou <b data-pas>0:00</b></span></div>
      <div class="oc-av">${esc(o.aviso || 'Aguarde: enquanto a IA trabalha não dá para mexer (para nada sair do lugar). Não feche esta aba.')}</div></div></div>`);
    document.body.appendChild(this.el); requestAnimationFrame(() => this.el?.classList.add('on'));
    this._bloq = e => { if (this.n > 0) { e.preventDefault(); e.stopPropagation(); } };
    for (const ev of ['keydown', 'keyup', 'wheel', 'contextmenu']) addEventListener(ev, this._bloq, { capture: true, passive: false });
    clearInterval(this._iv); this._iv = setInterval(() => this.pinta(), 250); this.pinta();
    return () => this.fim();
  },
  passo(txt) { const e = this.el && $('[data-sub]', this.el); if (e) e.textContent = txt; },
  texto(n) { this.letras = n; },
  // andamento de verdade, quando dá para contar (ex.: 3 de 5 presets feitos)
  parte(feito, total) { this.feito = { feito, total: Math.max(1, total) }; },
  fmt(s) { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; },
  pinta() {
    if (!this.el) return; const t = (performance.now() - this.t0) / 1000, F = this.feito, br = $('[data-barra]', this.el);
    br.classList.toggle('rodando', !F); $('[data-b]', this.el).style.width = F ? (Math.min(1, F.feito / F.total) * 100).toFixed(1) + '%' : '';
    $('[data-conta]', this.el).textContent = F ? `${F.feito} de ${F.total}` : ''; $('[data-pas]', this.el).textContent = this.fmt(t);
    if (document.hidden) document.title = `${this.abaTxt || 'IA trabalhando'} ${this.fmt(t)} · ${this.tituloAba}`; else if (document.title !== this.tituloAba) document.title = this.tituloAba;
  },
  fim() {
    this.n = Math.max(0, this.n - 1); if (this.n) return;
    try { this._solta?.(); } catch { } this._solta = null; if (this.tituloAba) document.title = this.tituloAba;
    if (document.hidden) try { if (this.tipo === 'ia') Notify.send('A IA terminou', this.titulo.replace(/^A IA está /, '').replace(/^\w/, c => c.toUpperCase())); else Notify.send(this.fimTxt || 'Pronto', this.titulo); } catch { }
    clearInterval(this._iv); for (const ev of ['keydown', 'keyup', 'wheel', 'contextmenu']) removeEventListener(ev, this._bloq, { capture: true });
    const el = this.el; this.el = null; if (!el) return; $('[data-barra]', el).classList.remove('rodando'); $('[data-b]', el).style.width = '100%'; el.classList.remove('on'); setTimeout(() => el.remove(), 220);
  },
  // NUVEM: salvar/apagar/enviar trava a tela (nada muda pela metade) e continua com a aba escondida ou minimizada.
  // aoAndar(txt) do Nuvem.salvar vira o texto da tela; "3/40" vira o andamento de verdade.
  nuvem(titulo, fn, o = {}) { return this.com({ tipo: 'nuvem', icone: o.icone || 'cloud', titulo, subtitulo: o.subtitulo || 'Conectando à nuvem…', aba: o.aba || titulo, fimTxt: o.fimTxt || 'Pronto na nuvem',
      aviso: o.aviso || 'Aguarde: enquanto isso não dá para mexer (para nada ficar pela metade). Pode ir para outra aba ou minimizar: continua sozinho. Só não feche esta aba.' }, fn); },
  anda(txt) { this.passo(txt); const m = /(\d+)\s*\/\s*(\d+)/.exec(txt || ''); if (m) this.parte(+m[1], +m[2]); else this.feito = null; },
  // sem travar a tela (envio automático): só pede ao navegador para não congelar a aba enquanto fn roda
  async mantem(fn) { let solta; try { navigator.locks?.request('animador-nuvem-' + Math.random(), () => new Promise(r => { solta = r; })).catch(() => { }); } catch { } try { return await fn(); } finally { try { solta?.(); } catch { } } },
  // embrulha uma tarefa: Ocupado.com({ titulo }, async () => …)
  async com(o, fn) { const fim = this.inicio(o); try { return await fn(); } finally { fim(); } },
};
