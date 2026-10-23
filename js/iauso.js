/* ===================== iauso.js — quanto da IA da equipe já foi usado (% do limite de gasto) =====================
   Um círculo com a % aparece: nos botões da IA, no topo de toda janela da IA e na tela "A IA está trabalhando".
   O número vem do servidor da IA (/uso): é o gasto da equipe toda dividido pelo limite. Atualiza depois de cada pedido. */
'use strict';
const IAUso = {
  dados: null, quando: 0, _p: null,
  async pega(forca) {
    if (!forca && this.dados && Date.now() - this.quando < 30000) return this.dados;
    if (this._p) return this._p;
    this._p = (async () => {
      try { const r = await fetch(Nuvem.srv + '/uso', { headers: await Nuvem.hd(), cache: 'no-store' }); const j = await r.json(); if (r.ok && Number.isFinite(+j.pct)) { this.dados = j; this.quando = Date.now(); } } catch { }
      this._p = null; this.pinta(); return this.dados;
    })();
    return this._p;
  },
  cor(p) { return p >= .9 ? '#ff6b6b' : p >= .7 ? '#ffcf4a' : '#19d3f0'; },
  anel(p, s = 18) {
    const r = s / 2 - 2.5, L = 2 * Math.PI * r, v = clamp(p || 0, 0, 1);
    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" aria-hidden="true"><circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".22" stroke-width="3"/>
      <circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="${this.cor(v)}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${(L * v).toFixed(2)} ${L.toFixed(2)}" transform="rotate(-90 ${s / 2} ${s / 2})"/></svg>`;
  },
  dica() {
    const d = this.dados; if (!d) return 'Uso da IA da equipe: carregando…';
    const $$ = v => 'US$ ' + (+v).toFixed(2).replace('.', ',');
    return `IA da equipe: ${(d.pct * 100).toFixed(1).replace('.', ',')}% do limite já usado (${$$(d.usd)} de ${$$(d.limite)}${d.periodo === 'mes' ? ' neste mês' : ''})${d.n ? ` · ${d.n} pedidos` : ''}`;
  },
  // o selo: <span class="ia-uso"> com o círculo e a % (texto = mostrar a %; sem texto = só o círculo)
  selo(texto = true, s = 18) { const el = h(`<span class="ia-uso ${texto ? '' : 'so-anel'}" data-ia-uso data-s="${s}" data-txt="${texto ? 1 : ''}"></span>`); this.pintaUm(el); this.pega(); return el; },
  pintaUm(el) {
    const d = this.dados, p = d ? d.pct : 0, s = +el.dataset.s || 18;
    el.innerHTML = this.anel(p, s) + (el.dataset.txt ? `<b>${d ? Math.round(p * 100) + '%' : '…'}</b><small>${el.dataset.txt === '2' ? 'do limite da IA da equipe já usado' : 'usado'}</small>` : '');
    el.title = this.dica(); el.classList.toggle('alto', p >= .9);
  },
  pinta() { document.querySelectorAll('[data-ia-uso]').forEach(el => this.pintaUm(el)); },
  // põe o selo sozinho: janelas da IA (cabeçalho) e a tela "A IA está trabalhando"
  liga() {
    const poe = n => {
      if (!(n instanceof Element)) return;
      for (const m of [n, ...n.querySelectorAll('.modal')]) if (m.classList?.contains('modal') && m.querySelector('.modal-icon.ia') && !m.querySelector('[data-ia-uso]')) {
        const hd = m.querySelector('.modal-head'), x = hd?.querySelector('[data-x]'); const s = this.selo(true); if (x) hd.insertBefore(s, x); else hd?.appendChild(s);
      }
      for (const o of [n, ...n.querySelectorAll('.ocupado')]) if (o.classList?.contains('ocupado') && !o.classList.contains('sem-ia') && !o.querySelector('[data-ia-uso]')) {
        const c = o.querySelector('.oc-card'); if (!c) continue; const s = this.selo(true, 22); s.dataset.txt = '2'; s.classList.add('oc'); this.pintaUm(s); c.appendChild(s); this.pega(true);
      }
    };
    new MutationObserver(ms => { for (const m of ms) m.addedNodes.forEach(poe); }).observe(document.body, { childList: true, subtree: true });
    // círculo pequeno nos botões da IA do topo (editor e Ateliê)
    for (const id of ['b-ia', 'at-ia']) { const b = document.getElementById(id); if (b && !b.querySelector('[data-ia-uso]')) b.appendChild(this.selo(false, 16)); }
    // depois de cada pedido à IA, o número muda (o servidor conta logo depois de responder)
    if (window.IA?.chama && !IA._usoLigado) { IA._usoLigado = true; const orig = IA.chama.bind(IA); IA.chama = async (...a) => { try { return await orig(...a); } finally { setTimeout(() => this.pega(true), 2500); } }; }
  },
};
addEventListener('DOMContentLoaded', () => setTimeout(() => IAUso.liga(), 0));
