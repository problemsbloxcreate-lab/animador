/* ===================== desenho.js — desenha um quadro: camadas, personagens (pelas partes), câmera, cor, efeitos e legendas ===================== */
'use strict';
const Render = {
  aoChegarImagem: null, // a tela redesenha quando uma imagem termina de carregar
  bm(id) { return Arq.bitmap(id, () => Render.aoChegarImagem?.()); },
  // matriz do nó (x, y, giro, escala, espelho) a partir da do pai
  matNo(m, t) { return m.translate(t.x || 0, t.y || 0).rotate(t.r || 0).scale((t.s ?? 1) * (t.sx || 1), t.s ?? 1); },
  // percorre do fundo para a frente: o 1º da lista fica na frente (como na hierarquia)
  cadaVisivel(P, q, fn, m0 = new DOMMatrix(), alfa0 = 1) {
    const vai = (lista, m, alfa) => {
      for (let i = lista.length - 1; i >= 0; i--) {
        const n = lista[i]; if (n.vis === false || !Modelo.aparece(P, n, q)) continue;
        const t = Modelo.transf(n, q), a = alfa * (t.op ?? 1); let mm = this.matNo(m, t); if (n.tremulo) mm = mm.multiply(this.tremor(n, q));
        if (n.filhos) vai(n.filhos, mm, a); else fn(n, mm, a, t);
      }
    };
    vai(P.raiz, m0, alfa0);
  },
  /* ---------- TRÊMULO (como o "turbulento" do Premiere): a camada parada treme/ondula sozinha, quadro a quadro ----------
     n.tremulo = { modo: 'tremer' | 'ondular', forca: 0–1, ritmo: quadros até mudar (2 = "em 12" num vídeo de 24) } */
  sorte(id, k, i) { let h = 2166136261; const s = id + ':' + k + ':' + i; for (let c = 0; c < s.length; c++) { h ^= s.charCodeAt(c); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000 - .5; },
  passo(n, q) { return Math.floor(q / Math.max(1, n.tremulo.ritmo || 2)); },
  tremor(n, q) {
    const T = n.tremulo, f = T.forca ?? .4, k = this.passo(n, q), r = i => this.sorte(n.id, k, i);
    if (T.modo === 'ondular') return new DOMMatrix().rotate(r(3) * f * .8); // o ondular mexe nos pixels (onda); aqui só um tiquinho de giro
    return new DOMMatrix().translate(r(1) * f * 16, r(2) * f * 16).rotate(r(3) * f * 2.4).scale(1 + r(4) * f * .03);
  },
  // imagem em faixas deslocadas por uma onda que muda a cada passo (efeito "ondular")
  ondulado(ctx, n, q, bm, x, y, w, h) {
    const T = n.tremulo, f = T.forca ?? .4, k = this.passo(n, q), fase = this.sorte(n.id, k, 9) * 40, amp = 1.5 + f * 7, freq = .045 + (this.sorte(n.id, k, 8) + .5) * .03;
    const faixa = Math.max(2, Math.round(bm.height / 120)), ky = h / bm.height;
    for (let sy = 0; sy < bm.height; sy += faixa) { const sh = Math.min(faixa * 2, bm.height - sy), /* faixa dobrada: a próxima cobre a emenda (sem risquinhos) */ dx = Math.sin((sy * ky) * freq + fase) * amp + Math.sin((sy * ky) * freq * 2.3 - fase) * amp * .35;
      ctx.drawImage(bm, 0, sy, bm.width, sh, x + dx, y + sy * ky, w, sh * ky); }
  },
  pecasPersonagem(P, n, q, m) {
    const def = P.personagens[n.ref]; if (!def) return [];
    return Modelo.montar(def, Modelo.partesNoEstado(def, Modelo.estadoPersonagem(n, q)), m);
  },
  // desenha as camadas no ctx (que já está com a transformação do "mundo" aplicada em base)
  camadas(ctx, P, q, base, alfa = 1) {
    this.cadaVisivel(P, q, (n, m, a) => {
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a));
      if (n.tipo === 'personagem') {
        for (const it of this.pecasPersonagem(P, n, q, m)) {
          if (!it.img) continue; const bm = this.bm(it.img.k); if (!bm) continue;
          const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2;
          ctx.setTransform(base.multiply(it.m)); const x = -px + (it.img.ajuste?.x || 0), y = -py + (it.img.ajuste?.y || 0);
          if (n.tremulo?.modo === 'ondular') this.ondulado(ctx, n, q, bm, x, y, it.img.w, it.img.h); else ctx.drawImage(bm, x, y, it.img.w, it.img.h);
        }
      } else if (n.tipo === 'imagem') {
        const bm = this.bm(n.arq); if (bm) { ctx.setTransform(base.multiply(m)); if (n.tremulo?.modo === 'ondular') this.ondulado(ctx, n, q, bm, -bm.width / 2, -bm.height / 2, bm.width, bm.height); else ctx.drawImage(bm, -bm.width / 2, -bm.height / 2); }
      } else if (n.tipo === 'texto') {
        ctx.setTransform(base.multiply(m)); this.texto(ctx, n);
      }
      ctx.restore();
    }, new DOMMatrix(), alfa);
  },
  texto(ctx, n) {
    ctx.font = `${n.negrito ? '800 ' : ''}${n.tam || 72}px ${n.fonte || 'Segoe UI'}, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const linhas = String(n.texto || '').split('\n'), lh = (n.tam || 72) * 1.15;
    linhas.forEach((l, i) => { const y = (i - (linhas.length - 1) / 2) * lh;
      if (n.bordaL > 0) { ctx.lineJoin = 'round'; ctx.lineWidth = n.bordaL; ctx.strokeStyle = n.borda || '#fff'; ctx.strokeText(l, 0, y); }
      ctx.fillStyle = n.cor || '#111'; ctx.fillText(l, 0, y); });
  },
  // matriz da câmera: mundo → imagem final de W×H
  matCamera(P, q, W, H) {
    const c = Modelo.camera(P, q), k = W / P.w, tr = Efeitos.tremor(P, q);
    return new DOMMatrix().translate(W / 2 + tr.dx * k, H / 2 + tr.dy * k).scale(k * (c.zoom || 1)).rotate(-(c.r || 0)).translate(-c.x, -c.y);
  },
  // QUADRO FINAL (exportar e prévia da câmera): fundo, camadas, cor, efeitos e legenda
  _tmp: null,
  quadro(ctx, P, q, W, H) {
    if (!this._tmp || this._tmp.width !== W || this._tmp.height !== H) this._tmp = new OffscreenCanvas(W, H);
    const t = this._tmp.getContext('2d');
    t.setTransform(1, 0, 0, 1, 0, 0); t.fillStyle = P.fundo || '#fff'; t.fillRect(0, 0, W, H);
    this.camadas(t, P, q, this.matCamera(P, q, W, H));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = Efeitos.filtro(P, q); ctx.drawImage(this._tmp, 0, 0); ctx.filter = 'none';
    Efeitos.porCima(ctx, P, q, W, H); this.legenda(ctx, P, q, W, H); ctx.restore();
  },
  legenda(ctx, P, q, W, H) {
    const l = (P.legendas || []).find(x => q >= x.de && q <= x.ate); if (!l || !l.texto) return;
    const tam = Math.round(Math.min(W, H) * .062); ctx.save();
    ctx.font = `800 ${tam}px 'Segoe UI', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const y = H - H * (H > W ? .2 : .09); ctx.lineWidth = tam * .2; ctx.strokeStyle = '#000'; ctx.strokeText(l.texto, W / 2, y); ctx.fillStyle = '#fff'; ctx.fillText(l.texto, W / 2, y); ctx.restore();
  },
  // caixa de cada nó visível (no "mundo") para escolher com o mouse; a primeira é a da frente
  caixas(P, q) {
    const out = [];
    this.cadaVisivel(P, q, (n, m) => {
      let b;
      if (n.tipo === 'personagem') { const def = P.personagens[n.ref]; if (!def) return; b = Modelo.caixaPersonagem(def, Modelo.partesNoEstado(def, Modelo.estadoPersonagem(n, q))); }
      else if (n.tipo === 'imagem') { const bm = this.bm(n.arq); const w = bm?.width || 200, h = bm?.height || 200; b = { x: -w / 2, y: -h / 2, w, h }; }
      else if (n.tipo === 'texto') { const c = this._med || (this._med = new OffscreenCanvas(4, 4).getContext('2d')); c.font = `${n.negrito ? '800 ' : ''}${n.tam || 72}px ${n.fonte || 'Segoe UI'}`; const ls = String(n.texto || '').split('\n'); const w = Math.max(...ls.map(l => c.measureText(l).width)) + 10, h = ls.length * (n.tam || 72) * 1.15; b = { x: -w / 2, y: -h / 2, w, h }; }
      if (!b) return;
      const cantos = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
      out.unshift({ no: n, m, cantos, local: b });
    });
    return out;
  },
  // miniatura (para a tela inicial)
  miniatura(P, q = 0, larg = 320) {
    const H = Math.round(larg * P.h / P.w), c = document.createElement('canvas'); c.width = larg; c.height = H;
    this.quadro(c.getContext('2d'), P, q, larg, H); return c.toDataURL('image/jpeg', .72);
  },
};
function dentroPoligono(p, pts) { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) d = !d; } return d; }
