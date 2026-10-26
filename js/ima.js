/* ===================== ima.js — Ateliê: coisas SOLTAS que GRUDAM em outras (e andam juntas) =====================
   A barra de ferramentas e as janelas soltas nascem soltas (movem para qualquer lugar). Soltando perto da borda de outra
   janela (ou de uma coluna, ou da borda de dentro do palco) ela GRUDA ali: preso = { alvo, lado, off, esticar }.
   alvo: 'jan:<id>' (janela solta) | 'col:<id>' (coluna) | 'palco' (por dentro); lado: esq|dir|cima|baixo; off: distância ao
   longo da borda; esticar = cobrir a altura (ou a largura) toda de onde grudou. Mover/aumentar a janela de baixo leva junto
   tudo que está grudado nela (e o que está grudado nisso). Botão direito na alça/barra: tamanho padrão, cobrir, soltar. */
'use strict';
const Ima = {
  DIST: 22,
  comRegua(p) { return p.classList.contains('com-regua') && !$('#atelie')?.classList.contains('ed-img'); }, // no editor de imagem a régua não aparece
  rectDe(alvo) {
    if (alvo === 'palco') { const p = $('#atelie .at-palco'); if (!p) return null; const r = p.getBoundingClientRect(), tl = parseFloat(getComputedStyle(p).getPropertyValue('--tl')) || 0; const R = this.comRegua(p) ? 18 : 0; /* régua ligada: gruda do lado dela (a régua fica à vista, a barra não cobre) */ return r.width ? { left: r.left + R, top: r.top + R, right: r.right, bottom: r.bottom - tl, width: r.width - R, height: r.height - tl - R } : null; }
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
    // régua ligada: o que cairia em cima da régua do palco (faixa de 18 px na esquerda e em cima) vai para o lado dela
    const pal = $('#atelie .at-palco'); if (pal && this.comRegua(pal) && preso.alvo !== 'palco') { const p = pal.getBoundingClientRect(), R = 18;
      if (o.x >= p.left - 2 && o.x < p.left + R && o.y < p.bottom && o.y + o.h > p.top) { o.x = p.left + R; }
      if (o.y >= p.top - 2 && o.y < p.top + R && o.x < p.right && o.x + o.w > p.left) { if (preso.esticar && (preso.lado === 'esq' || preso.lado === 'dir')) o.h -= p.top + R - o.y; o.y = p.top + R; } }
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
  // ÍMÃ das JANELAS SOLTAS que não são painel (janela do Ateliê no Animador, assistente da IA…): perto da borda/canto da TELA ou da
  // borda de outra janela solta, ela encosta (lado a lado ou alinhada). eu = o elemento que está mexendo (fica de fora dos alvos).
  POPUPS: '.qed.solto, .iap:not([hidden]), .dock-janela',
  encaixa(eu, x, y, w, h, D = 18) {
    const W = innerWidth, H = innerHeight, outros = $$(this.POPUPS).filter(e => e !== eu && !eu.contains(e) && e.offsetWidth).map(e => e.getBoundingClientRect());
    const sobV = r => y < r.bottom + D && y + h > r.top - D, sobH = r => x < r.right + D && x + w > r.left - D;
    let bx = null, by = null; const tenta = (v, alvo, eixo) => { const d = Math.abs(v - alvo); if (d > D) return; const c = eixo === 'x' ? bx : by; if (!c || d < c.d) { if (eixo === 'x') bx = { d, dx: alvo - v }; else by = { d, dy: alvo - v }; } };
    tenta(x, 0, 'x'); tenta(x + w, W, 'x'); tenta(y, 0, 'y'); tenta(y + h, H, 'y');
    for (const r of outros) {
      if (sobV(r)) { tenta(x, r.right, 'x'); tenta(x + w, r.left, 'x'); tenta(x, r.left, 'x'); tenta(x + w, r.right, 'x'); }
      if (sobH(r)) { tenta(y, r.bottom, 'y'); tenta(y + h, r.top, 'y'); tenta(y, r.top, 'y'); tenta(y + h, r.bottom, 'y'); }
    }
    return { x: Math.round(x + (bx?.dx || 0)), y: Math.round(y + (by?.dy || 0)), grudou: !!(bx || by) };
  },
  // mesma coisa para a BORDA que está mudando de tamanho (e = esquerda|direita|cima|baixo; v = posição da borda)
  encaixaBorda(eu, lado, v, D = 18) {
    const vert = lado === 'esq' || lado === 'dir', alvos = [vert ? 0 : 0, vert ? innerWidth : innerHeight];
    for (const e of $$(this.POPUPS)) { if (e === eu || eu.contains(e) || !e.offsetWidth) continue; const r = e.getBoundingClientRect(); alvos.push(...(vert ? [r.left, r.right] : [r.top, r.bottom])); }
    let m = null; for (const a of alvos) { const d = Math.abs(a - v); if (d <= D && (!m || d < m.d)) m = { d, a }; } return m ? Math.round(m.a) : v;
  },
  // quem está grudado (direta ou indiretamente) numa janela: não pode virar alvo dela (senão anda em círculo)
  presos(alvo, todos) { const out = new Set(); let mud = true; while (mud) { mud = false; for (const [id, p] of todos) if (p && !out.has(id) && (p.alvo === alvo || out.has(p.alvo))) { out.add(id); mud = true; } } return out; },
  // tudo que está grudado em algo: põe no lugar (depois de mover/aumentar uma janela, mudar o layout, a tela…)
  arruma() {
    if (this._arr) return; this._arr = true; requestAnimationFrame(() => { this._arr = false;
      for (let k = 0; k < 3; k++) { if (typeof Paineis !== 'undefined') Paineis.posPresos?.(); if (typeof PaineisEd !== 'undefined') PaineisEd.posPresos?.(); if (typeof Pintura !== 'undefined') Pintura.posBarra?.(); } this.ajustaEd(); }); // 3 voltas: presos em presos (const não fica em window)
  },
  // EDITOR DE IMAGEM com janelas soltas por cima da tela: a barra do título e as opções da ferramenta andam para o lado delas (não ficam escondidas)
  ajustaEd() {
    const pal = $('#atelie .at-palco'); if (!pal) return; let esq = 0, dir = 0;
    if ($('#atelie')?.classList.contains('ed-img')) { const p = pal.getBoundingClientRect(), op = $('#at-ferr-op')?.getBoundingClientRect(), baixo = op?.height ? op.bottom : p.top + 80;
      for (const j of $$('.dock-janela')) { const r = j.getBoundingClientRect(); if (!r.width || r.top >= baixo || r.bottom <= p.top || r.right <= p.left || r.left >= p.right) continue;
        if (r.left - p.left < p.right - r.right) esq = Math.max(esq, r.right - p.left); else dir = Math.max(dir, p.right - r.left); }
      if (esq + dir > p.width - 260) esq = dir = 0; } // não sobra lugar: fica como é (a janela cobre)
    const e = Math.round(esq) + 'px', d = Math.round(dir) + 'px'; if (pal.style.getPropertyValue('--ed-esq') !== e) pal.style.setProperty('--ed-esq', e); if (pal.style.getPropertyValue('--ed-dir') !== d) pal.style.setProperty('--ed-dir', d);
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
