/* ===================== deformimg.js — DEFORMAR no Ateliê (editor de imagem e palco), junto do pincel =====================
   Ferramenta "Deformar" (T) da barra: pontos amarelos em volta do desenho da camada ativa (ou só do que está selecionado).
   Cantos = 4 pontos (distorcer) · Malha = 16 pontos (curvar). Prévia ao vivo; Enter ou "Aplicar" grava os pixels
   (imagem nova = o Ctrl+Z volta), Esc ou "Cancelar" volta como era. Usa a mesma conta do Deformar do Animador (Deformar.imagem). */
'use strict';
(() => {
  Pintura.FERR.push(['deformar', 'Deformar', 'transition', 'T']);
  const D = Pintura.dfi = {
    st: null, // { a, src, base, df, k0 }
    // começa (ou pega o que já está começado) para a imagem/camada que está na tela
    prepara() {
      if (!Pintura.alvo()) return null; // sem imagem: nada (sem aviso a cada desenho)
      const a = Ajustes.alvo(); if (!a) return null; const chave = a.img.k + '|' + (a.cam?.id || '');
      if (this.st && this.st.chave === chave) return this.st;
      this.cancela(true);
      const src = a.mask ? Ajustes.recortado(a) : a.bm, bb = Ajustes.caixa(src) || { x: 0, y: 0, w: a.bm.width, h: a.bm.height };
      const base = a.mask ? (() => { const b = new OffscreenCanvas(a.bm.width, a.bm.height), x = b.getContext('2d'); x.drawImage(a.bm, 0, 0); x.globalCompositeOperation = 'destination-out'; x.drawImage(a.mask, 0, 0); return b; })() : null;
      const g = this.g || 2, im = a.img, geo = { w: im.w, h: im.h, pivo: im.pivo ? { ...im.pivo } : undefined, ajuste: im.ajuste ? { ...im.ajuste } : undefined };
      return (this.st = { chave, a, src, base, k0: a.img.k, geo, crescer: !a.cam && !a.mask && !a.quadro, df: { g, b: { x: bb.x, y: bb.y, w: bb.w, h: bb.h }, p: Deformar.resto(bb, g).map(() => [0, 0]) } });
    },
    mexeu() { return this.st && !Deformar.vazio(this.st.df); },
    // sem camadas e sem seleção a imagem CRESCE para caber o que saiu da borda (o desenho fica no lugar: o pivô anda junto)
    resultado() {
      const s = this.st, W = s.src.width, H = s.src.height, pad = s.crescer ? Deformar.sobra(s.df, W, H) : null, w = Deformar.imagem(s.src, s.df, pad);
      if (s.crescer) this.geometria(s, pad);
      if (!s.base) return w; const out = new OffscreenCanvas(w.width, w.height), x = out.getContext('2d'); x.drawImage(s.base, 0, 0); x.drawImage(w, 0, 0); return out;
    },
    geometria(s, pad) {
      const im = s.a.img, g = s.geo, kX = s.src.width / g.w, kY = s.src.height / g.h, px = g.pivo?.x ?? g.w / 2, py = g.pivo?.y ?? g.h / 2;
      if (!pad || !(pad.L + pad.T + pad.R + pad.B)) { im.w = g.w; im.h = g.h; if (g.pivo) im.pivo = { ...g.pivo }; else delete im.pivo; return; }
      im.w = g.w + (pad.L + pad.R) / kX; im.h = g.h + (pad.T + pad.B) / kY; im.pivo = { x: px + pad.L / kX, y: py + pad.T / kY };
    },
    volta(s) { const im = s.a.img, g = s.geo; im.w = g.w; im.h = g.h; if (g.pivo) im.pivo = { ...g.pivo }; else delete im.pivo; if (g.ajuste) im.ajuste = { ...g.ajuste }; Ajustes.volta(s.a); },
    previa() { cancelAnimationFrame(this._raf); this._raf = requestAnimationFrame(() => { if (this.st) Ajustes.mostra(this.st.a, this.resultado()); }); },
    async aplica() {
      const s = this.st; if (!s) return; cancelAnimationFrame(this._raf); this.st = null;
      if (Deformar.vazio(s.df)) { this.volta(s); return Pintura.pintaBarra(); }
      this.st = s; const cv = this.resultado(); this.st = null;
      await Ajustes.grava(s.a, cv); UI.toast('Deformado (Ctrl+Z desfaz).', { kind: 'ok' }); Pintura.pintaBarra();
    },
    cancela(quieto) { const s = this.st; if (!s) return; cancelAnimationFrame(this._raf); this.st = null; this.volta(s); if (!quieto) { Pintura.pintaBarra(); Atelie.desenha(); } },
    trocaG(g) { this.g = g; const s = this.st; if (s && s.df.g !== g) { s.df = Deformar.paraG(s.df, g); this.previa(); } Pintura.pintaBarra(); Atelie.desenha(); },
    // pontos de controle em pixels da tela (device)
    pontosTela() { const s = this.prepara(); if (!s) return null; const T = Atelie.V().multiply(s.a.mImg); return { s, T, C: Deformar.pontos(s.df).map(([x, y]) => { const q = T.transformPoint(new DOMPoint(x, y)); return [q.x, q.y]; }) }; },
    desenha(ctx) {
      const r = this.pontosTela(); if (!r) return; const { s, T } = r, d = devicePixelRatio || 1, df = s.df, C = Deformar.pontos(df), b = df.b;
      const tp = ([x, y]) => { const q = T.transformPoint(new DOMPoint(x, y)); return [q.x, q.y]; };
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 1.2 * d;
      const linha = pts => { ctx.beginPath(); pts.forEach((p, i) => { const [x, y] = tp(Deformar.F(df, C, p[0], p[1])); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }, L = 24;
      for (const t of df.g === 4 ? [0, 1 / 3, 2 / 3, 1] : [0, 1]) { linha(Array.from({ length: L + 1 }, (_, i) => [b.x + b.w * i / L, b.y + b.h * t])); linha(Array.from({ length: L + 1 }, (_, i) => [b.x + b.w * t, b.y + b.h * i / L])); }
      ctx.fillStyle = '#1b1b1b'; r.C.forEach(([x, y], i) => { const z = (df.g === 2 || [0, 3, 12, 15].includes(i) ? 5 : 4) * d; ctx.fillRect(x - z, y - z, z * 2, z * 2); ctx.strokeRect(x - z, y - z, z * 2, z * 2); });
      ctx.restore();
    },
    desce(e) {
      const r = this.pontosTela(); if (!r) return; const d = devicePixelRatio || 1, x = e.offsetX * d, y = e.offsetY * d; let best = -1, bd = 12 * d;
      r.C.forEach(([px, py], i) => { const dd = Math.hypot(px - x, py - y); if (dd < bd) { bd = dd; best = i; } });
      const cv = Atelie.cv; try { cv.setPointerCapture(e.pointerId); } catch { }
      const inv = r.T.inverse(), c0 = inv.transformPoint(new DOMPoint(x, y)), s = r.s;
      let mov;
      if (best >= 0) { const p0 = [...s.df.p[best]]; mov = ev => { const w = inv.transformPoint(new DOMPoint(ev.offsetX * d, ev.offsetY * d)); s.df.p[best] = [p0[0] + w.x - c0.x, p0[1] + w.y - c0.y]; this.previa(); Atelie.desenha(); }; }
      else { const p0 = s.df.p.map(p => [...p]); mov = ev => { const w = inv.transformPoint(new DOMPoint(ev.offsetX * d, ev.offsetY * d)), dx = w.x - c0.x, dy = w.y - c0.y; s.df.p = p0.map(p => [p[0] + dx, p[1] + dy]); this.previa(); Atelie.desenha(); }; } // fora dos pontos: arrasta tudo
      const up = () => { for (const [t, f] of [['pointermove', mov], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up]]) cv.removeEventListener(t, f); Pintura.pintaBarra(); };
      for (const [t, f] of [['pointermove', mov], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up]]) cv.addEventListener(t, f);
    },
  };
  // ferramenta: clicar no palco/editor mexe nos pontos
  const desce0 = Pintura.desce; Pintura.desce = function (e) { if (this.ferr === 'deformar') return D.desce(e); return desce0.call(this, e); };
  // trocar de ferramenta com uma deformação pela metade: aplica (como no Photoshop, que pergunta; aqui guarda para não perder)
  const usa0 = Pintura.usa; Pintura.usa = function (f) { if (this.ferr === 'deformar' && f !== 'deformar' && D.mexeu()) D.aplica(); else if (this.ferr === 'deformar' && f !== 'deformar') D.cancela(true); return usa0.call(this, f); };
  // T = deformar; Shift+T continua sendo o Transformar (Ajustes); Enter aplica, Esc cancela
  const tecla0 = Pintura.tecla; Pintura.tecla = function (e) {
    if (this.ferr === 'deformar' && !e.ctrlKey && !e.metaKey) { if (e.key === 'Enter') { e.preventDefault(); D.aplica(); return true; } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (D.mexeu()) { D.cancela(); return true; } } }
    if (e.shiftKey && e.key.toLowerCase() === 't') return false; return tecla0.call(this, e);
  };
  // sair do editor com uma deformação pela metade: aplica antes (o Salvar do editor = guardar)
  const fecha0 = Atelie.fecharEditor; if (fecha0) Atelie.fecharEditor = async function (...a) { if (D.mexeu()) await D.aplica(); else D.cancela(true); return fecha0.apply(this, a); };
  const cursor0 = Pintura.desenhaCursor; Pintura.desenhaCursor = function (ctx) { cursor0.call(this, ctx); if (this.ferr === 'deformar') D.desenha(ctx); };
  // botão na barra (depois do conta-gotas) e as opções em cima
  const barra0 = Pintura.pintaBarra; Pintura.pintaBarra = function () {
    barra0.call(this); const el = $('#at-ferr'); if (!el || el.hidden) return;
    if (!$('[data-f="deformar"]', el)) { const ref = $('[data-f="conta"]', el); const b = h(`<button class="${this.ferr === 'deformar' ? 'on' : ''}" data-f="deformar" title="Deformar: cantos ou malha (T)">${ic('transition', 17)}</button>`); b.onclick = () => this.usa('deformar'); (ref || el.lastElementChild).after(b); }
    if (this.ferr !== 'deformar') return;
    let op = $('#at-ferr-op'); if (!op) { op = h('<div id="at-ferr-op" class="ferr-op"></div>'); el.after(op); }
    const g = D.st?.df.g || D.g || 2, a = D.st?.a || Pintura.alvo();
    op.innerHTML = `<b>Deformar</b><span class="df-seg"><button data-g="2" class="${g === 2 ? 'on' : ''}" title="Mexer os 4 cantos à vontade">Cantos</button><button data-g="4" class="${g === 4 ? 'on' : ''}" title="16 pontos para curvar">Malha</button></span>
      <small style="color:var(--tx3)">${a ? (a.cam ? 'camada ' + esc(a.cam.nome) : esc(a.img?.nome || 'imagem')) + (Pintura.mascara?.(a) ? ' · só a seleção' : '') : 'escolha uma imagem'}</small>
      <button class="btn sm" data-x title="Esc" ${D.mexeu() ? '' : 'disabled'}>Cancelar</button><button class="btn sm primary" data-ok title="Enter" ${D.mexeu() ? '' : 'disabled'}>Aplicar</button>`;
    $$('[data-g]', op).forEach(b => b.onclick = () => D.trocaG(+b.dataset.g)); $('[data-x]', op).onclick = () => D.cancela(); $('[data-ok]', op).onclick = () => D.aplica();
  };
})();
