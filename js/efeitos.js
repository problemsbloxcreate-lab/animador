/* ===================== efeitos.js — correção de cor e efeitos de tela com 1 clique =====================
   VISUAIS: o "look" do vídeo inteiro (um por projeto). EFEITOS DE TELA: ligados em um trecho de quadros (de → até). */
'use strict';
const Efeitos = {
  VISUAIS: [
    { id: 'normal', nome: 'Normal', f: '' , cor: ['#7aa0c8', '#e9c27a'] },
    { id: 'vivo', nome: 'Vivo', f: 'saturate(1.45) contrast(1.08)', cor: ['#3f8dff', '#ffb02e'] },
    { id: 'quente', nome: 'Quente', f: 'sepia(.22) saturate(1.25) hue-rotate(-8deg) brightness(1.04)', cor: ['#c98a4a', '#ffd38a'] },
    { id: 'frio', nome: 'Frio', f: 'saturate(1.05) hue-rotate(12deg) brightness(1.02) contrast(1.04)', tinta: 'rgba(60,120,255,.10)', cor: ['#4a78c9', '#9fd0ff'] },
    { id: 'noite', nome: 'Noite', f: 'brightness(.62) saturate(.8) contrast(1.12)', tinta: 'rgba(20,40,120,.28)', cor: ['#1d2a55', '#3c4f8a'] },
    { id: 'por-do-sol', nome: 'Pôr do sol', f: 'saturate(1.3) contrast(1.05)', tinta: 'rgba(255,120,40,.16)', cor: ['#ff7a3d', '#ffcf6b'] },
    { id: 'vintage', nome: 'Vintage', f: 'sepia(.5) contrast(.92) brightness(1.05) saturate(.85)', cor: ['#a08060', '#e8d2a8'] },
    { id: 'pb', nome: 'Preto e branco', f: 'grayscale(1) contrast(1.15)', cor: ['#444', '#ddd'] },
    { id: 'sonho', nome: 'Sonho', f: 'saturate(1.2) brightness(1.08) contrast(.9) blur(.4px)', tinta: 'rgba(255,170,230,.12)', cor: ['#d59ae6', '#ffd6f0'] },
    { id: 'terror', nome: 'Terror', f: 'saturate(.55) contrast(1.35) brightness(.78)', tinta: 'rgba(90,0,0,.18)', cor: ['#3a0d0d', '#7a2a2a'] },
    { id: 'desbotado', nome: 'Desbotado', f: 'saturate(.65) contrast(.88) brightness(1.08)', cor: ['#8a95a3', '#d6d2c4'] },
    { id: 'neon', nome: 'Neon', f: 'saturate(1.8) contrast(1.2) hue-rotate(-12deg)', tinta: 'rgba(170,0,255,.10)', cor: ['#9b2cff', '#22e6ff'] },
  ],
  TELA: [
    { id: 'vinheta', nome: 'Vinheta', ic: 'crop', forca: .6 },
    { id: 'granulado', nome: 'Granulado', ic: 'grid', forca: .35 },
    { id: 'cinema', nome: 'Faixas de cinema', ic: 'film', forca: .12 },
    { id: 'flash', nome: 'Flash branco', ic: 'bolt', forca: 1 },
    { id: 'tremor', nome: 'Tremer a tela', ic: 'wave', forca: .5 },
    { id: 'desfoque', nome: 'Desfoque', ic: 'eyeOff', forca: .4 },
    { id: 'brilho', nome: 'Brilho suave', ic: 'sparkles', forca: .45 },
    { id: 'vhs', nome: 'VHS', ic: 'tv', forca: .5 },
    { id: 'escurecer', nome: 'Escurecer', ic: 'eye', forca: .6 },
    { id: 'clarear', nome: 'Clarear', ic: 'star', forca: .5 },
    { id: 'chicote', nome: 'Transição chicote', ic: 'transition', forca: .7 },
    { id: 'zoomcorte', nome: 'Transição com zoom', ic: 'zoomIn', forca: .6 },
  ],
  // TRANSIÇÕES (como as dos Shorts): o corte fica no meio do efeito; a imagem sai borrada e a de depois entra
  TRANS: ['chicote', 'zoomcorte'],
  // matrizes da transição no quadro q (m = matriz de cada cópia, a = opacidade); null = sem transição
  transicao(lista, q, de, ate, W, H, cx, cy) {
    const e = lista.find(x => this.TRANS.includes(x.tipo)); if (!e) return null;
    const a0 = e.de ?? de, a1 = e.ate ?? ate, p = clamp((q - a0 + .5) / Math.max(1, a1 - a0 + 1), 0, 1), f = e.forca ?? .6, pico = Math.sin(Math.PI * p), out = [];
    if (e.tipo === 'chicote') {
      const lado = e.lado === 'dir' ? 1 : -1, ofs = W * .55 * f * (p < .5 ? -Ease.in(p * 2) : 1 - Ease.out((p - .5) * 2)) * lado, borrao = W * .09 * f * pico;
      for (let i = 0; i < 7; i++) out.push({ m: new DOMMatrix().translate(ofs + borrao * (i / 6 - .5), 0), a: i === 3 ? 1 : .22 });
    } else {
      const z = 1 + .55 * f * pico, bo = .05 * f * pico;
      for (let i = 0; i < 6; i++) { const s = z * (1 - bo * i / 5); out.push({ m: new DOMMatrix().translate(cx, cy).scale(s).translate(-cx, -cy), a: i ? .2 : 1 }); }
    }
    return out;
  },
  visual(id) { return this.VISUAIS.find(v => v.id === id) || this.VISUAIS[0]; },
  ativos(P, q) { return (P.efeitos?.tela || []).filter(e => q >= e.de && q <= e.ate); },
  // filtro do quadro (visual + desfoque/brilho)
  filtro(P, q) {
    let f = this.visual(P.efeitos?.visual).f || '';
    for (const e of this.ativos(P, q)) {
      if (e.tipo === 'desfoque') f += ` blur(${(e.forca * 8).toFixed(1)}px)`;
      if (e.tipo === 'brilho') f += ` brightness(${(1 + e.forca * .25).toFixed(2)}) saturate(${(1 + e.forca * .3).toFixed(2)})`;
      if (e.tipo === 'escurecer') f += ` brightness(${(1 - e.forca * .7).toFixed(2)})`;
      if (e.tipo === 'clarear') f += ` brightness(${(1 + e.forca * .6).toFixed(2)})`;
    }
    return f.trim() || 'none';
  },
  // deslocamento da câmera (tremor)
  tremor(P, q) {
    let dx = 0, dy = 0;
    for (const e of this.ativos(P, q)) if (e.tipo === 'tremor') { const a = e.forca * 26; dx += (hash(q * 1.7 + 3) - .5) * 2 * a; dy += (hash(q * 2.3 + 9) - .5) * 2 * a; }
    return { dx, dy };
  },
  // por cima da imagem pronta (tinta do visual, vinheta, granulado, faixas, flash, VHS)
  porCima(ctx, P, q, W, H) {
    const v = this.visual(P.efeitos?.visual);
    if (v.tinta) { ctx.save(); ctx.fillStyle = v.tinta; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    for (const e of this.ativos(P, q)) this.umPorCima(ctx, e, q, W, H, e.de, e.ate);
  },
  umPorCima(ctx, e, q, W, H, de, ate, soNoConteudo) {
      ctx.save(); if (soNoConteudo && !['cinema', 'flash'].includes(e.tipo)) ctx.globalCompositeOperation = 'source-atop';
      if (e.tipo === 'cor') { const v = this.visual(e.visual); if (v.tinta) { ctx.fillStyle = v.tinta; if (soNoConteudo) ctx.fillRect(-1e5, -1e5, 2e5, 2e5); else ctx.fillRect(0, 0, W, H); } } // a cor vale em tudo (também fora da câmera, no canvas)
      if (e.tipo === 'vinheta') { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .32, W / 2, H / 2, Math.hypot(W, H) * .58); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${e.forca})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      if (e.tipo === 'granulado') { const n = this.ruido(q); ctx.globalAlpha = e.forca * .55; if (!soNoConteudo) ctx.globalCompositeOperation = 'overlay'; const pat = ctx.createPattern(n, 'repeat'); ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); }
      if (e.tipo === 'cinema') { const b = H * e.forca; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, b); ctx.fillRect(0, H - b, W, b); }
      if (e.tipo === 'flash') { const dur = Math.max(1, ate - de), t = (q - de) / dur; ctx.fillStyle = `rgba(255,255,255,${(e.forca * (1 - t)).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
      if (e.tipo === 'vhs') { ctx.globalAlpha = e.forca * .35; ctx.fillStyle = '#000'; for (let y = q % 4; y < H; y += 4) ctx.fillRect(0, y, W, 1); ctx.globalAlpha = e.forca * .18; ctx.fillStyle = '#ff2a6d'; ctx.fillRect(0, (q * 13) % H, W, H * .03); }
      ctx.restore();
  },

  /* ---------- CAMADA DE EFEITO (na hierarquia e na timeline): vale para o que está ABAIXO dela, até a próxima camada de efeito.
     O que está abaixo de outra camada de efeito só obedece a ela (não somam). n.efeitos = [{ tipo, forca, visual?, modo?, ritmo?, de?, ate? }] */
  nomeEf(e) { return e.tipo === 'cor' ? this.visual(e.visual).nome : e.tipo === 'tremulo' ? (e.modo === 'ondular' ? 'Ondular' : 'Trêmulo') : (this.TELA.find(t => t.id === e.tipo)?.nome || e.tipo); },
  ativoEf(e, q) { return (e.de == null || q >= e.de) && (e.ate == null || q <= e.ate); },
  filtroDe(lista, k = 1) {
    let f = '';
    for (const e of lista) {
      if (e.tipo === 'cor') f += ' ' + (this.visual(e.visual).f || '').replace(/blur\(([\d.]+)px\)/, (m, v) => `blur(${(v * k).toFixed(2)}px)`);
      if (e.tipo === 'desfoque') f += ` blur(${(e.forca * 8 * k).toFixed(1)}px)`;
      if (e.tipo === 'brilho') f += ` brightness(${(1 + e.forca * .25).toFixed(2)}) saturate(${(1 + e.forca * .3).toFixed(2)})`;
      if (e.tipo === 'escurecer') f += ` brightness(${(1 - e.forca * .7).toFixed(2)})`;
      if (e.tipo === 'clarear') f += ` brightness(${(1 + e.forca * .6).toFixed(2)})`;
    }
    return f.trim();
  },
  _ruido: [],
  ruido(q) { const i = q % 6; if (!this._ruido[i]) { const c = new OffscreenCanvas(160, 160), x = c.getContext('2d'), d = x.createImageData(160, 160); for (let k = 0; k < d.data.length; k += 4) { const v = Math.random() * 255; d.data[k] = d.data[k + 1] = d.data[k + 2] = v; d.data[k + 3] = 255; } x.putImageData(d, 0, 0); this._ruido[i] = c; } return this._ruido[i]; },
};
