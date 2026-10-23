/* ===================== ima.js — Ateliê: coisas SOLTAS que GRUDAM em outras (e andam juntas) =====================
   A barra de ferramentas e as janelas soltas nascem soltas (movem para qualquer lugar). Soltando perto da borda de outra
   janela (ou de uma coluna, ou da borda de dentro do palco) ela GRUDA ali: preso = { alvo, lado, off, esticar }.
   alvo: 'jan:<id>' (janela solta) | 'col:<id>' (coluna) | 'palco' (por dentro); lado: esq|dir|cima|baixo; off: distância ao
   longo da borda; esticar = cobrir a altura (ou a largura) toda de onde grudou. Mover/aumentar a janela de baixo leva junto
   tudo que está grudado nela (e o que está grudado nisso). Botão direito na alça/barra: tamanho padrão, cobrir, soltar. */
'use strict';
const Ima = {
  DIST: 22,
  rectDe(alvo) {
    if (alvo === 'palco') { const p = $('#atelie .at-palco'); if (!p) return null; const r = p.getBoundingClientRect(), tl = parseFloat(getComputedStyle(p).getPropertyValue('--tl')) || 0; return r.width ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom - tl, width: r.width, height: r.height - tl } : null; }
    const [t, id] = String(alvo).split(':'), el = t === 'jan' ? $(`.dock-janela[data-jan="${id}"]`) : t === 'col' ? $(`.dock-col[data-col="${id}"]`) : null;
    if (!el || !el.offsetWidth) return null; return el.getBoundingClientRect();
  },
  // onde fica uma coisa de tamanho (w, h) grudada assim (em px da tela); esticar devolve também w ou h
  pos(preso, w, h) {
    const r = this.rectDe(preso.alvo); if (!r) return null; const dentro = preso.alvo === 'palco', o = { w, h };
    const vert = preso.lado === 'esq' || preso.lado === 'dir';
    if (preso.esticar) { if (vert) { o.h = r.height; o.y = r.top; } else { o.w = r.width; o.x = r.left; } }
    if (vert) { o.x = preso.lado === 'esq' ? (dentro ? r.left : r.left - o.w) : (dentro ? r.right - o.w : r.right); if (!preso.esticar) o.y = clamp(r.top + preso.off, r.top - o.h + 20, r.bottom - 20); }
    else { o.y = preso.lado === 'cima' ? (dentro ? r.top : r.top - o.h) : (dentro ? r.bottom - o.h : r.bottom); if (!preso.esticar) o.x = clamp(r.left + preso.off, r.left - o.w + 20, r.right - 20); }
    return o;
  },
  // procurando onde grudar: a coisa (caixa b) perto da borda de algum alvo; sem = null
  acha(b, excluir = new Set()) {
    const alvos = [{ id: 'palco', dentro: true }, ...$$('.dock-col').map(c => ({ id: 'col:' + c.dataset.col })), ...$$('.dock-janela').map(j => ({ id: 'jan:' + j.dataset.jan }))].filter(a => !excluir.has(a.id));
    let melhor = null; const D = this.DIST;
    for (const a of alvos) {
      const r = this.rectDe(a.id); if (!r) continue; const sobV = b.top < r.bottom && b.bottom > r.top, sobH = b.left < r.right && b.right > r.left, c = [];
      if (a.dentro) { if (sobV) { c.push(['esq', Math.abs(b.left - r.left)], ['dir', Math.abs(b.right - r.right)]); } if (sobH) { c.push(['cima', Math.abs(b.top - r.top)], ['baixo', Math.abs(b.bottom - r.bottom)]); } }
      else { if (sobV) { c.push(['dir', Math.abs(b.left - r.right)], ['esq', Math.abs(b.right - r.left)]); } if (sobH) { c.push(['baixo', Math.abs(b.top - r.bottom)], ['cima', Math.abs(b.bottom - r.top)]); } }
      for (const [lado, d] of c) if (d < D && (!melhor || d < melhor.d)) melhor = { alvo: a.id, lado, d, off: lado === 'esq' || lado === 'dir' ? b.top - r.top : b.left - r.left };
    }
    return melhor ? { alvo: melhor.alvo, lado: melhor.lado, off: Math.round(melhor.off), esticar: false } : null;
  },
  // quem está grudado (direta ou indiretamente) numa janela: não pode virar alvo dela (senão anda em círculo)
  presos(alvo, todos) { const out = new Set(); let mud = true; while (mud) { mud = false; for (const [id, p] of todos) if (p && !out.has(id) && (p.alvo === alvo || out.has(p.alvo))) { out.add(id); mud = true; } } return out; },
  // tudo que está grudado em algo: põe no lugar (depois de mover/aumentar uma janela, mudar o layout, a tela…)
  arruma() {
    if (this._arr) return; this._arr = true; requestAnimationFrame(() => { this._arr = false;
      for (let k = 0; k < 3; k++) { if (typeof Paineis !== 'undefined') Paineis.posPresos?.(); if (typeof Pintura !== 'undefined') Pintura.posBarra?.(); } }); // 3 voltas: presos em presos (const não fica em window)
  },
  menu(e, preso, muda) {
    e.preventDefault(); const vert = preso && (preso.lado === 'esq' || preso.lado === 'dir');
    UI.ctx(e.clientX, e.clientY, [{ head: preso ? 'Grudada' : 'Solta' }, ...(preso ? [
      { label: 'Tamanho padrão', icon: 'check', checked: !preso.esticar, action: () => muda({ ...preso, esticar: false }) },
      { label: vert ? 'Cobrir a altura toda de onde está grudada' : 'Cobrir a largura toda de onde está grudada', icon: vert ? 'down' : 'right', checked: !!preso.esticar, action: () => muda({ ...preso, esticar: true }) },
      '-', { label: 'Soltar (descolar)', icon: 'x', action: () => muda(null) }] : [{ label: 'Arraste até a borda de outra janela, de uma coluna ou do palco para grudar', disabled: true }])]);
  },
};
addEventListener('resize', () => Ima.arruma());
