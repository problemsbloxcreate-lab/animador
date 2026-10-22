/* ===================== divisores.js — ateliê: AUMENTAR/DIMINUIR os painéis arrastando as bordas =====================
   Lista de partes (esquerda), painel da direita e a timeline (em cima dela). Fica guardado neste computador
   (localStorage `animador-atelie-tamanhos`). Dois cliques na borda volta ao tamanho padrão. */
'use strict';
const Divisores = {
  PADRAO: { esq: 270, dir: 320, tl: 0 }, // tl 0 = a timeline do tamanho do que tem dentro
  t: null,
  le() { if (this.t) return this.t; try { this.t = { ...this.PADRAO, ...JSON.parse(localStorage.getItem('animador-atelie-tamanhos') || '{}') }; } catch { this.t = { ...this.PADRAO }; } return this.t; },
  grava() { try { localStorage.setItem('animador-atelie-tamanhos', JSON.stringify(this.t)); } catch { } },
  aplica() {
    const t = this.le(), at = $('#atelie'); if (!at) return;
    at.style.setProperty('--at-esq', t.esq + 'px'); at.style.setProperty('--at-dir', t.dir + 'px');
    const tl = $('#at-tl'); if (tl) tl.style.height = t.tl ? t.tl + 'px' : '';
  },
  liga() {
    if (this._ok) return; this._ok = true; this.aplica();
    const esq = $('#atelie .at > aside:first-child'), dir = $('#atelie .at > aside:last-child'), tl = $('#at-tl');
    const poe = (pai, cls, titulo, mexe, zera) => { const d = h(`<div class="at-div ${cls}" title="${titulo} · dois cliques: tamanho padrão"></div>`); pai.appendChild(d);
      d.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); d.setPointerCapture(e.pointerId); d.classList.add('on'); document.body.classList.add('arrastando-div');
        const x0 = e.clientX, y0 = e.clientY, ini = { ...this.le() };
        const mov = ev => { mexe(ev.clientX - x0, ev.clientY - y0, ini); this.aplica(); Atelie.tamanho?.(); Linha.altura?.(); };
        const up = () => { d.removeEventListener('pointermove', mov); d.removeEventListener('pointerup', up); d.classList.remove('on'); document.body.classList.remove('arrastando-div'); this.grava(); Atelie.enquadrar?.(); };
        d.addEventListener('pointermove', mov); d.addEventListener('pointerup', up); });
      d.addEventListener('dblclick', () => { zera(); this.aplica(); this.grava(); Atelie.tamanho?.(); Linha.altura?.(); Atelie.enquadrar?.(); }); };
    if (esq) poe(esq, 'v dir', 'Arraste para aumentar/diminuir a lista de partes', (dx, dy, i) => { this.t.esq = clamp(Math.round(i.esq + dx), 190, 520); }, () => { this.t.esq = this.PADRAO.esq; });
    if (dir) poe(dir, 'v esq', 'Arraste para aumentar/diminuir o painel', (dx, dy, i) => { this.t.dir = clamp(Math.round(i.dir - dx), 260, 620); }, () => { this.t.dir = this.PADRAO.dir; });
    if (tl) poe(tl, 'h', 'Arraste para aumentar/diminuir a timeline', (dx, dy, i) => { const pal = $('.at-palco')?.getBoundingClientRect().height || 800, base = i.tl || tl.offsetHeight; this.t.tl = clamp(Math.round(base - dy), 70, Math.round(pal * .6)); }, () => { this.t.tl = 0; });
  },
};
