/* ===================== cenarios.js — cenários no estilo da casa (RABISCADO imperfeito, como rascunho) =====================
   Um cenário é um JSON de CAMADAS de formas chapadas, sempre em 1920×1080, desenhadas de trás para a frente:
     { nome, total, camadas: [ { o:"Objeto", c:"#cor", l:0|1, h:0-3, v:0|1, f:[formas] } | { degrade:{ de, ate, cor, forca } } ] }
   Formas: ["ret",x0,y0,x1,y1] · ["red",x0,y0,x1,y1,raio] · ["elipse",x0,y0,x1,y1] · ["poli",x,y,x,y,…]
           ["linha",esp,x,y,x,y,…] · ["anel",x0,y0,x1,y1,esp] · ["arco",x0,y0,x1,y1,grau0,grau1,esp]
           ["nuvem",cx,cy,escala] · ["copa",cx,cy,rx,ry,calombos] (copa de árvore/arbusto numa forma só)
   O desenho dá o jeito de rascunho: cantos fora do lugar, lados com barriga e tremidos, contorno da mesma cor mais
   escura riscado lado a lado (passando do canto), às vezes um 2º risco leve, hachuras diagonais e brilho riscado no
   vidro. Os prontos ficam em cenarios/*.json; a IA aprende o estilo com eles (guia em cenarios/ESTILO.md). */
'use strict';
const Cenarios = {
  W: 1920, H: 1080,
  PRONTOS: [
    { id: 'quintal', nome: 'Quintal' }, { id: 'quarto', nome: 'Quarto' }, { id: 'sala-de-aula', nome: 'Sala de aula' },
    { id: 'praca', nome: 'Praça' }, { id: 'cozinha', nome: 'Cozinha' },
  ],
  _json: {},
  async pronto(id) {
    if (!this._json[id]) { const r = await fetch('cenarios/' + id + '.json'); if (!r.ok) throw new Error('Não achei o cenário "' + id + '".'); this._json[id] = await r.json(); }
    return this._json[id];
  },
  // aleatório com semente: a mesma camada treme sempre igual (o cenário inteiro e as peças batem certinho)
  rnd(semente) { let s = (semente >>> 0) || 7; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; },
  cor(hex) { const m = String(hex || '').match(/^#?([0-9a-f]{6})$/i); const v = m ? parseInt(m[1], 16) : 0xcccccc; return [v >> 16 & 255, v >> 8 & 255, v & 255]; },
  rgb(c, a = 1) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; },
  escuro(c) { const l = (.3 * c[0] + .59 * c[1] + .11 * c[2]) / 255, k = l > .75 ? .55 : l > .45 ? .62 : .7; return c.map(v => v * k); },
  claro(c, k) { return c.map(v => v + (255 - v) * k); },

  /* ---------- formas → pontos ---------- */
  pontos(s) {
    const t = s[0], v = s.slice(1).map(Number), W = this.W, H = this.H, P = [];
    if (t === 'ret') { let [x0, y0, x1, y1] = v; // encostou na borda: passa dela, para o tremido não deixar fresta
      if (x0 <= 2) x0 = -30; if (y0 <= 2) y0 = -30; if (x1 >= W - 2) x1 = W + 30; if (y1 >= H - 2) y1 = H + 30;
      return { P: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], fech: true, esp: 0 }; }
    if (t === 'red') { const [x0, y0, x1, y1] = v, r = Math.max(0, Math.min(v[4] || 0, (x1 - x0) / 2, (y1 - y0) / 2));
      for (const [cx, cy, a0] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]]) for (let k = 0; k < 7; k++) { const a = (a0 + 15 * k) * Math.PI / 180; P.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      return { P, fech: true, esp: 0 }; }
    if (t === 'elipse') { const cx = (v[0] + v[2]) / 2, cy = (v[1] + v[3]) / 2, rx = Math.abs(v[2] - v[0]) / 2, ry = Math.abs(v[3] - v[1]) / 2, n = Math.max(16, (rx + ry) / 6 | 0);
      for (let k = 0; k < n; k++) P.push([cx + rx * Math.cos(2 * Math.PI * k / n), cy + ry * Math.sin(2 * Math.PI * k / n)]); return { P, fech: true, esp: 0 }; }
    if (t === 'poli') { for (let i = 0; i + 1 < v.length; i += 2) P.push([v[i], v[i + 1]]); return { P, fech: true, esp: 0 }; }
    if (t === 'linha') { for (let i = 1; i + 1 < v.length; i += 2) P.push([v[i], v[i + 1]]); return { P, fech: false, esp: v[0] }; }
    if (t === 'anel' || t === 'arco') { const e = t === 'anel' ? v[4] : v[6], [a0, a1] = t === 'anel' ? [0, 360] : [v[4], v[5]];
      const cx = (v[0] + v[2]) / 2, cy = (v[1] + v[3]) / 2, rx = Math.abs(v[2] - v[0]) / 2 - e / 2, ry = Math.abs(v[3] - v[1]) / 2 - e / 2, n = Math.max(12, Math.abs(a1 - a0) / 6 | 0);
      for (let k = 0; k <= n; k++) { const a = (a0 + (a1 - a0) * k / n) * Math.PI / 180; P.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return { P, fech: false, esp: e }; }
    if (t === 'nuvem') { const [cx, cy, e] = v, bumps = [[-80 * e, cy + 4 * e, 50 * e], [-10 * e, cy - 30 * e, 64 * e], [68 * e, cy - 2 * e, 50 * e]], base = cy + 38 * e, x0 = cx - 130 * e, x1 = cx + 128 * e;
      for (let k = 0; k <= 60; k++) { const x = x0 + (x1 - x0) * k / 60; let y = base; for (const [bx, by, r] of bumps) { const dx = x - (cx + bx); if (Math.abs(dx) < r * 1.08) y = Math.min(y, by - Math.sqrt(Math.max(0, (r * 1.08) ** 2 - dx * dx)) * .85); } P.push([x, y]); }
      for (let k = 1; k < 8; k++) { const t2 = k / 8; P.push([x1 - (x1 - x0) * t2, base + 5 * e * Math.sin(Math.PI * t2)]); } return { P, fech: true, esp: 0 }; }
    if (t === 'copa') { const [cx, cy, rx, ry] = v, n = clamp(Math.round(v[4] || 8), 3, 16), m = n * 8;
      for (let k = 0; k < m; k++) { const a = 2 * Math.PI * k / m, o = 1 + .07 * Math.abs(Math.sin(a * n / 2)) ** .6 - .035; P.push([cx + rx * o * Math.cos(a), cy + ry * o * Math.sin(a)]); } return { P, fech: true, esp: 0 }; }
    return { P, fech: true, esp: 0 };
  },
  caixa(f) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const s of f) { const { P, esp } = this.pontos(s), m = (esp || 0) / 2 + 3; for (const [x, y] of P) { x0 = Math.min(x0, x - m); y0 = Math.min(y0, y - m); x1 = Math.max(x1, x + m); y1 = Math.max(y1, y + m); } }
    return { x0, y0, x1, y1 };
  },
  // caminho simples (sem tremido): usado pelos rabiscos da prévia
  caminho(ctx, s) {
    const { P, fech, esp } = this.pontos(s); ctx.beginPath(); P.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (s[0] === 'anel' || !fech) return esp || 1; ctx.closePath(); return 0;
  },
  tracar(ctx, s) { const e = this.caminho(ctx, s); if (e) { ctx.lineWidth = e; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); } else ctx.fill(); },

  /* ---------- o jeito de rascunho ---------- */
  cantos(R, P, st) { // mexe cada canto um pouco; curvas ganham uma deformação suave (sem pontas)
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]), tam = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
    st.k = clamp(tam / 90, .2, 1);
    if (P.length <= 12) { const a = Math.min(9, 1.5 + tam * .018) * st.k; return P.map(([x, y]) => [x + (R() - .5) * 2 * a, y + (R() - .5) * 2 * a]); }
    const cx = xs.reduce((a, b) => a + b, 0) / P.length, cy = ys.reduce((a, b) => a + b, 0) / P.length, a = Math.min(7, 1 + tam * .02) * st.k, f1 = R() * 6, f2 = R() * 6, n = P.length;
    return P.map(([x, y], i) => { const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) || 1, d = a * (Math.sin(2 * Math.PI * i / n * 2 + f1) * .7 + Math.sin(2 * Math.PI * i / n * 3 + f2) * .3); return [x + dx / r * d, y + dy / r * d]; });
  },
  curva(R, st, A, B, bojo, onda = 1.3, passo = 14) { // um lado à mão: barriga suave + tremidinha
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, nx = -(B[1] - A[1]) / L, ny = (B[0] - A[0]) / L, n = Math.max(2, L / passo | 0), f = R() * 9, out = [];
    for (let k = 0; k <= n; k++) { const t = k / n, d = bojo * Math.sin(Math.PI * t) + onda * st.k * (Math.sin(f + t * L / 23) * .7 + Math.sin(f * 2 + t * L / 9) * .3); out.push([A[0] + (B[0] - A[0]) * t + nx * d, A[1] + (B[1] - A[1]) * t + ny * d]); }
    return out;
  },
  bojo(R, st, L) { return clamp((R() - .5) * 2 * (1.2 + L * .012), -7, 7) * st.k; },
  risco(ctx, Q, cor, larg) { if (Q.length < 2) return; ctx.beginPath(); Q.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.strokeStyle = cor; ctx.lineWidth = larg; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); },
  contornoMao(ctx, R, st, P, cor, larg) { // cada lado é um risco próprio, passando um pouco do canto
    const seq = P.map((a, i) => [a, P[(i + 1) % P.length]]);
    if (P.length <= 12) for (const [A, B] of seq) {
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, ux = (B[0] - A[0]) / L, uy = (B[1] - A[1]) / L, e0 = R() * Math.min(10, L * .08), e1 = R() * Math.min(14, L * .1);
      const A2 = [A[0] - ux * e0 + (R() - .5) * 3, A[1] - uy * e0 + (R() - .5) * 3], B2 = [B[0] + ux * e1, B[1] + uy * e1];
      this.risco(ctx, this.curva(R, st, A2, B2, this.bojo(R, st, L)), cor, larg * (.8 + R() * .45));
    } else { let Q = []; for (const [A, B] of seq) Q = Q.concat(this.curva(R, st, A, B, 0, .6, 10).slice(0, -1)); Q = Q.concat(Q.slice(0, Math.max(2, Q.length / 14 | 0))); this.risco(ctx, Q, cor, larg); }
  },
  camada(ctx, L, idx, semente, rg, opac) {
    const R = this.rnd(semente * 7919 + idx * 104729 + 1), st = { k: 1 };
    if (L.degrade) { const g = L.degrade, c = this.cor(g.cor), de = +g.de || 0, ate = Math.max(de + 1, +g.ate || this.H), fo = clamp(+g.forca || .5, 0, 1);
      const gr = ctx.createLinearGradient(0, de, 0, ate); gr.addColorStop(0, this.rgb(c, 0)); gr.addColorStop(1, this.rgb(c, fo));
      ctx.save(); if (!opac) ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = gr; ctx.fillRect(rg.x, Math.max(de, rg.y), rg.w, rg.y + rg.h - Math.max(de, rg.y)); ctx.restore(); return; }
    if (!Array.isArray(L.f)) return;
    const c = this.cor(L.c), oc = this.escuro(c), cs = this.rgb(c), ocs = this.rgb(oc), contorno = L.l !== 0, hach = L.h, vidro = !!L.v;
    for (const s of L.f) {
      let { P, fech, esp } = this.pontos(s); if (P.length < 2) continue;
      if (s[0] === 'anel') fech = false;
      if (!fech) { // traço grosso: contorno escuro por baixo e a cor por cima
        st.k = 1; let Q = []; for (let i = 0; i + 1 < P.length; i++) { const A = P[i], B = P[i + 1]; Q = Q.concat(this.curva(R, st, A, B, this.bojo(R, st, Math.hypot(B[0] - A[0], B[1] - A[1])) * .4, 1.4).slice(0, -1)); } Q.push(P[P.length - 1]);
        if (contorno) this.risco(ctx, Q, ocs, esp + 5); this.risco(ctx, Q, cs, esp); continue; }
      if (s[0] === 'ret' && P[0][0] < 0 && P[0][1] < 0 && P[2][0] > this.W && P[2][1] > this.H) { ctx.fillStyle = cs; ctx.fillRect(rg.x, rg.y, rg.w, rg.h); continue; }
      P = this.cantos(R, P, st);
      const poucos = P.length <= 12; let Q = [];
      for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length]; Q = Q.concat(this.curva(R, st, A, B, poucos ? this.bojo(R, st, Math.hypot(B[0] - A[0], B[1] - A[1])) * .8 : 0, poucos ? 1.6 : .5).slice(0, -1)); }
      const path = new Path2D(); Q.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y)); path.closePath();
      ctx.fillStyle = cs; ctx.fill(path);
      const xs = P.map(p => p[0]), ys = P.map(p => p[1]), mx = Math.min(...xs), my = Math.min(...ys), bw = Math.max(...xs) - mx, bh = Math.max(...ys) - my, area = bw * bh;
      const nh = hach != null ? clamp(+hach || 0, 0, 3) : (area > 40000 && bw < 1500 ? 1 : 0);
      if (nh && area > 4000) { // hachuras diagonais soltas
        ctx.save(); ctx.clip(path); const qtd = Math.min(10, area / 60000 * nh * 3 | 0) + nh;
        for (let i = 0; i < qtd; i++) { const x = mx + R() * bw, y = my + R() * bh, Lh = 25 + R() * 45, nn = 1 + (R() * 3 | 0);
          for (let k = 0; k < nn; k++) { const ox = k * 9 + R() * 3; ctx.beginPath(); ctx.moveTo(x + ox, y + Lh * .5); ctx.lineTo(x + ox + Lh * .7, y - Lh * .5); ctx.strokeStyle = this.rgb(oc, .18); ctx.lineWidth = 2; ctx.stroke(); } }
        ctx.restore(); }
      if (vidro) for (let k = 0; k < 2; k++) { const [a, b2] = k ? [.33, .62] : [.18, .55];
        this.risco(ctx, this.curva(R, st, [mx + bw * (a + .18), my + bh * .15 + k * bh * .12], [mx + bw * a, my + bh * b2 + k * bh * .08], 1.5, .6), this.rgb(this.claro(c, .55)), 3.2 - k * .6); }
      if (contorno) { const larg = area > 3000 ? 3.8 : 2.6; this.contornoMao(ctx, R, st, P, ocs, larg);
        if (area > 2500 && R() < .55) this.contornoMao(ctx, R, st, P.map(([x, y]) => [x + (R() - .5) * 4, y + (R() - .5) * 4]), this.rgb(oc, .32), 1.3); }
    }
  },
  /* ---------- PEÇAS: cada objeto do cenário ("o" marca o começo de um objeto; as camadas seguintes são dele) ---------- */
  pecas(cena) {
    const out = [], por = {}; let atual = null;
    (cena?.camadas || []).forEach((L, i) => {
      let nome = L.o ? String(L.o).trim().slice(0, 30) : atual;
      if (!nome) nome = i === 0 ? 'Fundo' : 'Peça ' + (out.length + 1);
      atual = nome;
      if (!por[nome]) out.push(por[nome] = { nome, camadas: [], idx: [], primeira: i });
      por[nome].camadas.push(L); por[nome].idx.push(i);
    });
    return out;
  },
  // pinta camadas num pedaço da tela; idx = número de cada camada no cenário (a semente do tremido)
  async compor(camadas, idx, rg, opac, prog, semente = 11) {
    const cv = document.createElement('canvas'); cv.width = rg.w; cv.height = rg.h;
    const ctx = cv.getContext('2d'); ctx.translate(-rg.x, -rg.y);
    if (opac) { ctx.fillStyle = '#fff'; ctx.fillRect(rg.x, rg.y, rg.w, rg.h); }
    for (let i = 0; i < camadas.length; i++) {
      if (i % 15 === 14) { prog?.(i / camadas.length); await sleep(0); }
      try { this.camada(ctx, camadas[i], idx[i], semente, rg, opac); } catch (e) { console.warn('camada do cenário', e); }
    }
    prog?.(1); return cv;
  },
  // cenário inteiro (canvas 1920×1080)
  async desenhar(cena, aoProgresso) {
    const cs = (cena?.camadas || []).slice(0, 400);
    return this.compor(cs, cs.map((_, i) => i), { x: 0, y: 0, w: this.W, h: this.H }, true, aoProgresso);
  },
  // cada peça numa imagem própria, recortada, com a posição dela no cenário
  async desenharPecas(cena, aoProgresso) {
    const ps = this.pecas({ camadas: (cena?.camadas || []).slice(0, 400) }), out = [];
    for (let k = 0; k < ps.length; k++) {
      const p = ps[k], bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const L of p.camadas) { if (L.degrade || !L.f?.length) continue; const b = this.caixa(L.f); bb.x0 = Math.min(bb.x0, b.x0 - 22); bb.y0 = Math.min(bb.y0, b.y0 - 22); bb.x1 = Math.max(bb.x1, b.x1 + 22); bb.y1 = Math.max(bb.y1, b.y1 + 22); }
      const x = clamp(Math.floor(bb.x0), 0, this.W), y = clamp(Math.floor(bb.y0), 0, this.H), w = clamp(Math.ceil(bb.x1), 0, this.W) - x, h = clamp(Math.ceil(bb.y1), 0, this.H) - y;
      if (w <= 0 || h <= 0) continue;
      const cv = await this.compor(p.camadas, p.idx, { x, y, w, h }, false, f => aoProgresso?.((k + f) / ps.length));
      out.push({ nome: p.nome, cv, x, y, w, h, primeira: p.primeira, camadas: p.camadas, idx: p.idx });
    }
    aoProgresso?.(1);
    return out;
  },
  blob(cv) { return new Promise((ok, no) => cv.toBlob(b => b ? ok(b) : no(new Error('Não consegui gerar a imagem (memória do navegador?).')), 'image/png')); },

  /* ---------- rabiscos: a IA "desenhando" na prévia enquanto as camadas chegam ---------- */
  rabiscador(pc) {
    const k = pc.width / this.W, g = pc.getContext('2d'), arte = document.createElement('canvas'); arte.width = pc.width; arte.height = pc.height;
    const ag = arte.getContext('2d'), fila = []; let cur = null, ini = 0, parado = false, raf = 0, aoFim = null;
    ag.fillStyle = '#F4EFE6'; ag.fillRect(0, 0, arte.width, arte.height);
    const escuro = hex => { const [r, gg, b] = this.cor(hex); return `rgb(${r * .45 | 0},${gg * .45 | 0},${b * .45 | 0})`; };
    const lapis = (x, y) => { g.save(); g.translate(x, y); g.rotate(-.7); g.fillStyle = '#F4D35E'; g.fillRect(2, -4, 34, 8); g.fillStyle = '#E8B4A0'; g.fillRect(36, -4, 7, 8);
      g.fillStyle = '#E9D2B0'; g.beginPath(); g.moveTo(2, -4); g.lineTo(-8, 0); g.lineTo(2, 4); g.fill(); g.fillStyle = '#333'; g.beginPath(); g.moveTo(-4, -1.6); g.lineTo(-8, 0); g.lineTo(-4, 1.6); g.fill(); g.restore(); };
    const camada = (ctx, L, fase) => { // fase 0..1: 0-.6 risca o contorno, .6-1 pinta
      if (L.degrade) { const d = L.degrade, gr = ctx.createLinearGradient(0, (+d.de || 0) * k, 0, (+d.ate || this.H) * k); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, d.cor);
        ctx.save(); ctx.globalAlpha = clamp(+d.forca || .5, 0, 1) * clamp(fase, 0, 1); ctx.fillStyle = gr; ctx.fillRect(0, (+d.de || 0) * k, pc.width, pc.height); ctx.restore(); return null; }
      const bb = this.caixa(L.f), per = 2 * ((bb.x1 - bb.x0) + (bb.y1 - bb.y0)) * k * 1.3 + 10, ris = clamp(fase / .6, 0, 1), pin = clamp((fase - .6) / .4, 0, 1);
      ctx.save(); ctx.scale(k, k);
      if (pin > 0) { ctx.globalAlpha = pin; ctx.fillStyle = ctx.strokeStyle = L.c; for (const s of L.f) { try { this.tracar(ctx, s); } catch { } } ctx.globalAlpha = 1; }
      if (pin < 1) { ctx.strokeStyle = escuro(L.c); ctx.lineWidth = 1.6 / k; ctx.lineCap = 'round'; ctx.globalAlpha = 1 - pin * .9;
        for (const [dx, dy] of [[0, 0], [1.4, -1]]) { ctx.save(); ctx.translate(dx / k, dy / k); ctx.setLineDash([per / k, per / k]); ctx.lineDashOffset = per / k * (1 - ris);
          for (const s of L.f) { try { const e = this.caminho(ctx, s); if (e) { ctx.save(); ctx.lineWidth = Math.max(1.6 / k, e * .25); ctx.stroke(); ctx.restore(); } else ctx.stroke(); } catch { } } ctx.restore(); } }
      ctx.restore();
      const t = ris, w = bb.x1 - bb.x0, h = bb.y1 - bb.y0, d = t * 2 * (w + h); // lápis andando pela borda
      const px = d < w ? bb.x0 + d : d < w + h ? bb.x1 : d < 2 * w + h ? bb.x1 - (d - w - h) : bb.x0, py = d < w ? bb.y0 : d < w + h ? bb.y0 + (d - w) : d < 2 * w + h ? bb.y1 : bb.y1 - (d - 2 * w - h);
      return { x: clamp(px * k, 0, pc.width), y: clamp(py * k, 0, pc.height) };
    };
    const quadro = now => {
      if (parado) return; raf = requestAnimationFrame(quadro);
      if (!cur && fila.length) { cur = fila.shift(); ini = now; }
      g.drawImage(arte, 0, 0);
      if (!cur) { if (aoFim) { const f = aoFim; aoFim = null; f(); } return; }
      const dur = fila.length > 30 ? 60 : fila.length > 10 ? 140 : 380, f = clamp((now - ini) / dur, 0, 1);
      const pos = camada(g, cur, f); if (pos && f < .6) lapis(pos.x, pos.y);
      if (f >= 1) { camada(ag, cur, 1); cur = null; }
    };
    raf = requestAnimationFrame(quadro);
    return {
      add: ls => fila.push(...ls),
      pendentes: () => fila.length + (cur ? 1 : 0),
      terminar: () => new Promise(ok => { if (!fila.length && !cur) ok(); else aoFim = ok; }),
      parar: () => { parado = true; cancelAnimationFrame(raf); },
    };
  },

  /* ---------- IA: aprende o estilo com os cenários prontos ---------- */
  SIS: `Você é o cenarista do ANIMADOR do Estúdio Problems. Você desenha CENÁRIOS SIMPLES de fundo para animação 2D, sempre no MESMO estilo da casa, descrevendo o cenário como camadas de formas num JSON. O Animador desenha e dá sozinho o jeito de RASCUNHO (cantos tortinhos, lados tremidos, contorno riscado à mão, hachuras), então você só escreve formas simples e limpas.

O ESTILO DA CASA (siga sempre):
- Desenho chapado com cara de rascunho feito à mão: formas geométricas simples, cores chapadas pastéis um pouco apagadas, contorno da MESMA cor do objeto só que mais escura (o Animador faz). Nada de sombra realista, nada de perspectiva: vista de frente, como cenário de teatro.
- Paleta da casa (use estas antes de inventar):
  parede #E9DFD0 / #E4DCCF / sala de aula #EDE4CC · piso de madeira #D8B98A com riscos #C7A577 · piso creme #F2E5D2 com faixas #E6D3BC · rodapé #CDBFA8
  céu #A6D2F0 + {"degrade":{"de":200,"ate":620,"cor":"#C9E4F7","forca":0.6}} · nuvem #F8F8F3 · morros #9ACD86 · grama #7EC05F (riscos #6EB253) · chão de praça #E6D6BE
  vidro #A6D2F0 (com "v":1), moldura #8A8580 · madeira #9C6B43 / escura #8A5C38 / clara #A97650 / cerca #C99560 / risco de porta #74492C · puxador #E8D9B8
  folhagem #5EA65A / #57A055 / clara #6DB868 · arbusto #4E9A4D · tronco #8A5A38 · metal #8A8F95 / #5E646B / pedra #BFC4C8
  destaques: vermelho #D35A4C / telhado #C8574A · rosa #F29BB8 · amarelo #F4D35E · azul #7FB3D8 / #6A9BC3 · creme #F2D9A6 · menta #CFE3D8
- NUVEM é SEMPRE ["nuvem",cx,cy,escala] (escala 0.5 a 1). COPA de árvore e ARBUSTO são SEMPRE ["copa",cx,cy,rx,ry,calombos] — uma forma só. NUNCA monte nuvem, copa ou arbusto com bolas/elipses sobrepostas (fica feio). Árvore = tronco ("poli" afinando para cima, cor #8A5A38, "h":0) + "copa" + uma "copa" menor mais clara no alto com "l":0 + alguns risquinhos de folha ("linha" curta, "l":0).
- NÃO desenhe flores pequenas espalhadas no chão (ficam feias).
- Detalhes simples dão a graça: risco mais escuro dividindo portas, puxadores redondinhos, vidro com "v":1, riscos horizontais no piso (várias "linha" curtas, "l":0), cortinas, quadros.
- Composição para animação: chão livre embaixo (de y≈780 a 1080) para os personagens andarem; centro sem poluição; móveis encostados na parede, lado a lado; 3 a 7 objetos principais.
- Ordem: de TRÁS para a FRENTE. Comece pelo fundo inteiro: {"o":"Fundo","c":"#E9DFD0","f":[["ret",0,0,1920,1080]],"l":0}.

FORMATO (responda SÓ o JSON, sem texto fora dele):
{"nome":"nome curto","total":N,"camadas":[ {"o":"Fundo","c":"#RRGGBB","f":[formas]}, {"c":"#RRGGBB","l":0,"h":0,"v":1,"f":[...]}, {"degrade":{...}}, ... ]}
- "total" = quantas camadas você vai escrever (escreva logo no começo; serve para mostrar o tempo que falta).
- "o" = nome do OBJETO (Fundo, Céu, Janela, Cama, Árvore…). Ponha "o" só na PRIMEIRA camada de cada objeto; as seguintes são desse objeto até aparecer outro "o". Escreva cada objeto inteiro de uma vez, porque cada objeto vira uma peça separada. Parede, piso, rodapé e riscos do piso = "Fundo"; céu = "Céu"; grama/rua = "Grama"/"Chão".
- "l":0 = sem contorno (use no fundo inteiro, no céu, no chão e nos riscos finos). "h" = hachuras diagonais 0 a 3 (padrão: automático nas áreas grandes; use "h":0 em peças pequenas e detalhes). "v":1 = vidro com brilho riscado.
- Tela 1920×1080, números inteiros. Formas (várias formas da mesma cor podem ir na mesma camada):
  ["ret",x0,y0,x1,y1]  ["red",x0,y0,x1,y1,raio]  ["elipse",x0,y0,x1,y1]  ["poli",x,y,x,y,...]
  ["linha",espessura,x,y,x,y,...]  ["anel",x0,y0,x1,y1,espessura]  ["arco",x0,y0,x1,y1,grau0,grau1,espessura] (180→360 = metade de cima)
  ["nuvem",cx,cy,escala]  ["copa",cx,cy,rx,ry,calombos]
- No máximo ~120 camadas. Seja econômico: junte formas da mesma cor numa camada.

EXEMPLOS DO ESTILO (cenários aprovados pelo dono):`,
  async sistema() {
    if (this._sis) return this._sis;
    const ex = await Promise.all(['quarto', 'quintal', 'sala-de-aula'].map(id => this.pronto(id).then(j => JSON.stringify(j)).catch(() => '')));
    const sis = this.SIS + '\n' + ex.filter(Boolean).join('\n\n');
    if (ex.every(Boolean)) this._sis = sis; // só guarda se os exemplos vieram todos (sem internet, tenta de novo na próxima)
    return sis;
  },

  /* ---------- segurança: o que vem da IA passa por aqui antes de desenhar ---------- */
  LIM: { camadas: 160, formas: 40, pontos: 80, coord: 3000, tempo: 150000 },
  // lê o JSON; se veio cortado no meio (resposta longa demais), aproveita as camadas que chegaram inteiras
  lerJSON(txt) {
    txt = String(txt || '');
    try { return { j: IA.json(txt), cortado: false }; } catch { }
    return { j: this.lerParcial(txt, true), cortado: true };
  },
  // camadas que já chegaram inteiras (serve para a resposta cortada e para desenhar enquanto a IA escreve)
  lerParcial(txt, exigir) {
    txt = String(txt || ''); const i = txt.indexOf('"camadas"'), ini = i < 0 ? -1 : txt.indexOf('[', i);
    if (ini < 0) { if (exigir) throw new Error('A IA não devolveu um cenário que dê para ler.'); return { camadas: [] }; }
    const camadas = []; let prof = 0, dentro = false, esc = false, comeco = -1;
    for (let k = ini + 1; k < txt.length; k++) {
      const ch = txt[k];
      if (dentro) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') dentro = false; continue; }
      if (ch === '"') { dentro = true; continue; }
      if (ch === '{' || ch === '[') { if (prof === 0) comeco = k; prof++; }
      else if (ch === '}' || ch === ']') { prof--; if (prof === 0 && comeco >= 0) { try { camadas.push(JSON.parse(txt.slice(comeco, k + 1))); } catch { } comeco = -1; } if (prof < 0) break; }
    }
    const nome = (txt.match(/"nome"\s*:\s*"([^"]{0,60})"/) || [])[1], total = +(txt.match(/"total"\s*:\s*(\d+)/) || [])[1] || 0;
    return { nome, total, camadas };
  },
  num(v, lim) { v = +v; return isFinite(v) ? clamp(Math.round(v * 10) / 10, -lim, lim) : null; },
  // confere cada camada e cada forma: tira o que não presta, limita números, garante o fundo
  limpar(j, semFundo) {
    const L = this.LIM, TIPOS = { ret: 4, red: 5, elipse: 4, poli: 6, linha: 5, anel: 5, arco: 7, nuvem: 3, copa: 5 }, out = []; let tirou = 0;
    const obj = (c, n) => { if (c.o != null && String(c.o).trim()) n.o = String(c.o).replace(/[<>"]/g, '').trim().slice(0, 30); return n; };
    const corOk = c => /^#?[0-9a-f]{6}$/i.test(String(c || '').trim()) ? '#' + String(c).trim().replace('#', '').toUpperCase() : null;
    for (const c of (Array.isArray(j?.camadas) ? j.camadas : []).slice(0, L.camadas)) {
      if (!c || typeof c !== 'object') { tirou++; continue; }
      if (c.degrade) { const g = c.degrade, cor = corOk(g.cor); if (!cor) { tirou++; continue; }
        out.push(obj(c, { degrade: { de: clamp(this.num(g.de, 2000) ?? 200, 0, this.H), ate: clamp(this.num(g.ate, 2000) ?? 600, 1, this.H), cor, forca: clamp(+g.forca || .5, 0, 1) } })); continue; }
      const cor = corOk(c.c); if (!cor || !Array.isArray(c.f)) { tirou++; continue; }
      const f = [];
      for (const s of c.f.slice(0, L.formas)) {
        if (!Array.isArray(s) || !(s[0] in TIPOS)) { tirou++; continue; }
        const v = s.slice(1, 1 + (s[0] === 'poli' || s[0] === 'linha' ? L.pontos * 2 + 1 : TIPOS[s[0]])).map(x => this.num(x, L.coord));
        if (v.some(x => x === null) || v.length < TIPOS[s[0]] - 1 || (s[0] === 'nuvem' && v.length < 3)) { tirou++; continue; }
        if (s[0] === 'nuvem') v[2] = clamp(v[2], .2, 4);
        if (s[0] === 'copa') { v[2] = clamp(Math.abs(v[2]), 5, 1500); v[3] = clamp(Math.abs(v[3]), 5, 1500); if (v[4] != null) v[4] = clamp(Math.round(v[4]), 3, 16); }
        if (s[0] === 'poli' && v.length % 2) v.pop();
        if (s[0] === 'linha' && !(v.length % 2)) v.pop();
        if (s[0] === 'linha' || s[0] === 'anel' || s[0] === 'arco') { const ie = s[0] === 'linha' ? 0 : v.length - 1; v[ie] = clamp(v[ie], 1, 200); }
        f.push([s[0], ...v]);
      }
      if (!f.length) { tirou++; continue; }
      const n = { c: cor, f }; if (c.l === 0 || c.l === '0' || c.l === false) n.l = 0; if (c.h != null && isFinite(+c.h)) n.h = clamp(Math.round(+c.h), 0, 3); if (c.v) n.v = 1;
      out.push(obj(c, n));
    }
    if (semFundo) return { cena: { camadas: out }, tirou, uteis: out.length };
    // sem um fundo cobrindo a tela inteira, sairiam buracos brancos: põe a parede da casa atrás
    const cobre = c => c.f?.some(s => s[0] === 'ret' && s[1] <= 0 && s[2] <= 0 && s[3] >= this.W - 1 && s[4] >= this.H - 1);
    if (!out.length || !cobre(out.find(c => !c.degrade) || {})) out.unshift({ o: 'Fundo', c: '#E9DFD0', l: 0, f: [['ret', 0, 0, this.W, this.H]] });
    return { cena: { nome: String(j?.nome || 'Cenário').replace(/[<>]/g, '').slice(0, 40), camadas: out }, tirou, uteis: out.length };
  },
  async pedirIA(pedido, anterior, aoEscrever, aoTentar) {
    pedido = String(pedido).slice(0, 600);
    const base = anterior ? `CENÁRIO ATUAL:\n${JSON.stringify(anterior)}\n\nAJUSTE PEDIDO: ${pedido}\nDevolva o cenário inteiro já ajustado, no mesmo estilo.` : `PEDIDO DE CENÁRIO: ${pedido}`;
    const sis = await this.sistema();
    for (let tent = 0; tent < 2; tent++) {
      if (tent) aoTentar?.();
      const txt = tent ? base + '\n\nIMPORTANTE: a resposta anterior veio grande demais ou quebrada. Faça mais simples: no máximo 60 camadas, junte formas da mesma cor, só o JSON.' : base;
      let limite; const tempo = new Promise((_, no) => { limite = setTimeout(() => no(new Error('A IA demorou demais para responder. Tente de novo ou peça algo mais simples.')), this.LIM.tempo); });
      let out; try { out = await Promise.race([IA.chama(sis, txt, aoEscrever), tempo]); } finally { clearTimeout(limite); }
      let lido; try { lido = this.lerJSON(out); } catch (e) { if (tent) throw e; continue; }
      const r = this.limpar(lido.j);
      if (r.uteis >= 4 && !(lido.cortado && tent === 0 && r.uteis < 12)) return { ...r, cortado: lido.cortado };
      if (tent) { if (r.uteis >= 2) return { ...r, cortado: lido.cortado }; throw new Error('A IA não conseguiu montar o cenário. Tente descrever com menos coisas.'); }
    }
  },
  guardaUltimo(cena) { this.ultimo = cena; try { localStorage.setItem('animador-cenario-ultimo-v2', JSON.stringify(cena)); } catch { } },
  pegaUltimo() { if (this.ultimo) return this.ultimo; try { const j = JSON.parse(localStorage.getItem('animador-cenario-ultimo-v2') || 'null'); return j?.camadas ? (this.ultimo = { ...this.limpar(j).cena, ia: true }) : null; } catch { return null; } },

  /* ---------- janela "Cenário": prontos, IA e o EDITOR de peças (js/cenaedit.js) ----------
     o = { estado, sel, area, no } — estado/sel/area vêm de "Editar cenário" (no = o que já está na cena) ou de uma citação */
  async abrir(o = {}) {
    if (!App?.P) return UI.toast('Abra uma animação primeiro.', { kind: 'err' });
    const editando = o.no || null;
    const body = h(`<div class="cen">
      ${editando ? `<button class="btn sm" data-prontos>${ic('paisagem', 13)} Trocar por um pronto…</button>` : ''}<div class="cen-sub" ${editando ? 'hidden' : ''}>Prontos</div><div class="cen-grade" ${editando ? 'hidden' : ''}></div>
      <div class="cen-sub">Pedir à IA <span>(mesmo estilo dos prontos; com uma peça ou área escolhida, muda só ela)</span></div>
      <textarea rows="2" maxlength="600" placeholder="Ex.: um quarto de criança com cama, estante e janela à noite"></textarea>
      <div class="cen-prev" hidden><div class="ce-barra"></div><canvas width="960" height="540"></canvas><div class="cen-barra" hidden><i></i></div><div class="cen-st"></div>
        <div class="cen-pecas" hidden><div class="cen-sub">Peças <span>(a da frente em cima · clique para escolher · botão direito: mais)</span></div><div class="cen-lista"></div>
          <div class="cen-op"><small class="ce-dica">Na cena o cenário entra como uma PASTA com uma camada por peça (dá para mexer depois, à mão ou pela IA).</small><button class="btn sm" data-todas>${ic('download', 13)} Todas as peças para a Mídia</button></div></div></div></div>`);
    const prev = $('.cen-prev', body), st = $('.cen-st', body), pc = $('canvas', prev), ta = $('textarea', body), barra = $('.cen-barra', body), boxPecas = $('.cen-pecas', body);
    let ocupado = false, btPor, btAjuste, btCriar, rab = null, vez = 0;
    const slug = t => String(t || 'cenario').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cenario';
    const usa = async fn => { if (ocupado) return; trava(true); try { await fn(); } catch (e) { prev.hidden = false; progresso(null); st.textContent = 'Não deu: ' + (e?.message || e); console.warn('cenário', e); } trava(false); };
    const ed = CenaEd.criar({ pc, raiz: body, barra: $('.ce-barra', body), lista: $('.cen-lista', body), ocupado: () => ocupado,
      aoMudar: () => { st.textContent = (ed.est?.nome || 'Cenário') + ' — mexido à mão. Ctrl+Z desfaz.'; },
      aoEscolher: () => rotAjuste(),
      ia: (p, area) => { if (!ta.value.trim()) { ta.placeholder = p ? `Diga o que mudar em "${p.nome}" (ex.: deixa vermelha, maior, com flores)` : 'Diga o que mudar nesta área'; ta.focus(); st.textContent = 'Escreva no campo de cima o que mudar e clique em "' + btAjuste.textContent.trim() + '".'; return; } ajustar(p, area); },
      citar: (p, area) => Citacao.cenario(ed.est, p, area),
      midia: p => usa(async () => { await Midia.guardar(await this.blob(p.cv), `${ed.est?.nome || 'Cenário'} · ${p.nome}`, { x: p.x, y: p.y }); UI.toast(`<b>${esc(p.nome)}</b> foi para a Mídia.`, { kind: 'ok' }); }),
      baixar: p => usa(async () => downloadBlob(await this.blob(p.cv), `${slug(ed.est?.nome)}-${slug(p.nome)}.png`)) });
    this._ed = ed; // (a janela aberta agora; ajuda a conferir)
    const trava = sim => { ocupado = sim; [btPor, btAjuste, btCriar].forEach(b => b && (b.disabled = sim || (b === btPor && !ed.est))); $$('.cen-item', body).forEach(b => b.disabled = sim); ta.disabled = sim; $('[data-todas]', body).disabled = sim; body.classList.toggle('ce-ocupado', sim); };
    const progresso = f => { barra.hidden = f == null; if (f != null) $('i', barra).style.width = Math.round(clamp(f, 0, 1) * 100) + '%'; };
    const rotAjuste = () => { if (!btAjuste) return; const p = ed.est?.pecas.find(x => x.id === ed.sel); btAjuste.style.display = ed.est ? '' : 'none';
      btAjuste.textContent = p ? `Ajustar só: ${p.nome}` : ed.area ? 'Ajustar só a área' : 'Ajustar tudo'; };
    // mostra o estado no editor (com uma troca suave quando vem dos rabiscos)
    const mostra = async (est, rot, suave) => {
      prev.hidden = false; const minha = ++vez;
      if (suave) { const cv = this.compoe(est, pc.width), g = pc.getContext('2d'); for (let i = 1; i <= 12 && minha === vez; i++) { g.globalAlpha = i / 12; g.drawImage(cv, 0, 0); await sleep(30); } g.globalAlpha = 1; }
      if (minha !== vez) return;
      ed.usa(est, o.sel, o.area); o.sel = o.area = null; pc.scrollIntoView({ block: 'nearest' }); pc.focus({ preventScroll: true }); progresso(null); boxPecas.hidden = false; st.textContent = rot || est.nome || 'Cenário'; rotAjuste(); trava(ocupado);
    };
    const doCena = async (cena, rot, suave) => { st.textContent = 'Separando as peças…'; prev.hidden = false; progresso(0); await mostra(await this.estadoDe(cena, f => progresso(f)), rot, suave); };
    const grade = $('.cen-grade', body), ult = this.pegaUltimo();
    const item = (nome, mini, fn) => { const b = h(`<button class="cen-item" title="Usar: ${esc(nome)}">${mini ? `<img src="${mini}" alt="">` : '<i></i>'}<span>${esc(nome)}</span></button>`);
      const im = $('img', b); if (im) im.onerror = () => im.replaceWith(h('<i></i>')); b.onclick = () => usa(fn); grade.appendChild(b); };
    for (const p of this.PRONTOS) item(p.nome, `cenarios/miniaturas/${p.id}.jpg`, async () => { rab?.parar(); await doCena(await this.pronto(p.id)); });
    if (ult) item('Último da IA: ' + (ult.nome || 'cenário'), null, async () => { rab?.parar(); await doCena(ult, (ult.nome || 'Cenário') + ' — o último que a IA fez.'); });

    // IA do cenário inteiro (criar, ajustar tudo ou só uma área): os rabiscos aparecem conforme as camadas chegam
    const ia = (ajuste, area) => usa(async () => {
      const txt = ta.value.trim(); if (!txt) { st.textContent = 'Escreva o que quer no campo acima.'; prev.hidden = false; return; }
      if (ajuste && !ed.est) return;
      prev.hidden = false; rab?.parar(); rab = this.rabiscador(pc); ++vez;
      const t0 = performance.now(); let vistas = 0, t1 = 0, total = 0, ultimaLeitura = 0, eta = null;
      const relogio = setInterval(() => {
        const seg = Math.round((performance.now() - t0) / 1000);
        if (!vistas) { st.textContent = `A IA está planejando o cenário… ${seg} s`; progresso(Math.min(.08, seg / 400)); return; }
        const tot = Math.max(total || 45, vistas + 1), porCamada = (performance.now() - t1) / Math.max(1, vistas);
        const falta = Math.max(1, Math.round(((tot - vistas) * porCamada + rab.pendentes() * 140) / 1000 + 4));
        eta = eta == null ? falta : Math.round(eta * .7 + falta * .3);
        st.textContent = `A IA está desenhando… ${vistas} de ~${tot} peças · faltam ~${eta} s`; progresso(.08 + .82 * vistas / tot);
      }, 500);
      const aoEscrever = t => {
        const agora = performance.now(); if (agora - ultimaLeitura < 250) return; ultimaLeitura = agora;
        const r = this.lerParcial(t); if (r.total) total = r.total;
        if (r.camadas.length > vistas) { if (!vistas) t1 = agora; rab.add(this.limpar({ camadas: r.camadas.slice(vistas) }, true).cena.camadas); vistas = r.camadas.length; }
      };
      const recomeca = () => { rab.parar(); rab = this.rabiscador(pc); vistas = 0; total = 0; eta = null; };
      try {
        let r, est;
        if (ajuste) { r = await this.pedirTudo(ed.est, txt, area, aoEscrever, recomeca); est = r.estado; }
        else r = await this.pedirIA(txt, null, aoEscrever, recomeca);
        if (r.cena.camadas.length > vistas) rab.add(r.cena.camadas.slice(vistas)); vistas = total = r.cena.camadas.length;
        clearInterval(relogio); st.textContent = 'Terminando os rabiscos…'; progresso(.92);
        await Promise.race([rab.terminar(), sleep(6000)]); rab.parar();
        r.cena.ia = true; this.guardaUltimo(r.cena);
        if (!est) { st.textContent = 'Separando as peças…'; est = await this.estadoDe(r.cena); }
        est.ia = true;
        const obs = [r.cortado && 'a resposta veio incompleta e aproveitei o que chegou', r.tirou && `ignorei ${r.tirou} peça(s) com erro`].filter(Boolean).join('; ');
        await mostra(est, (est.nome || 'Cenário') + ` — feito pela IA em ${Math.round((performance.now() - t0) / 1000)} s` + (obs ? ` (${obs})` : '') + '. Mexa nas peças à vontade; "Pôr na cena" quando gostar.', true);
      } finally { clearInterval(relogio); rab?.parar(); }
    });
    // IA só numa peça (a peça é redesenhada no lugar; o resto não muda)
    const ajustar = (p, area) => {
      if (!p) return ia(true, area || ed.area);
      usa(async () => {
        const txt = ta.value.trim(); st.textContent = `A IA está redesenhando "${p.nome}"…`; progresso(.3);
        const nova = await this.pedirPeca(ed.est, p, txt);
        ed.guarda(); const i = ed.est.pecas.findIndex(x => x.id === p.id); if (i >= 0) ed.est.pecas[i] = nova; ed.est.ia = true;
        progresso(null); ed.pinta(); st.textContent = `"${p.nome}" foi refeita pela IA. Ctrl+Z volta como era.`;
      });
    };
    if ($('[data-prontos]', body)) $('[data-prontos]', body).onclick = e => { e.currentTarget.remove(); $$('.cen-sub[hidden], .cen-grade[hidden]', body).forEach(x => x.hidden = false); };
    $('[data-todas]', body).onclick = () => usa(async () => { for (const p of ed.est?.pecas || []) await Midia.guardar(await this.blob(p.cv), `${ed.est?.nome || 'Cenário'} · ${p.nome}`, { x: p.x, y: p.y }); UI.toast(`${ed.est.pecas.length} peça(s) foram para a Mídia.`, { kind: 'ok' }); });
    if (o.estado) setTimeout(() => mostra(o.estado, editando ? `${o.estado.nome || 'Cenário'} — editando o que está na cena.` : o.estado.nome), 0);
    await UI.modal({ title: editando ? 'Editar cenário' : 'Cenário', icon: 'paisagem', width: 820, body, sticky: true, onOpen: a => {
      [btAjuste, btCriar, btPor] = a.foot.querySelectorAll('.btn'); btPor.disabled = !o.estado; btAjuste.style.display = 'none'; rotAjuste(); if (o.estado) setTimeout(() => pc.focus({ preventScroll: true }), 120); // editando: as setas já mexem na peça
    }, buttons: [
      { label: 'Ajustar tudo', kind: 'ia', left: true, onClick: () => { const p = ed.est?.pecas.find(x => x.id === ed.sel); p ? ajustar(p) : ia(true, ed.area); return false; } },
      { label: 'Criar com a IA', icon: 'sparkles', kind: 'ia', onClick: () => { ia(false); return false; } },
      { label: editando ? 'Atualizar na cena' : 'Pôr na cena', kind: 'primary', onClick: async () => { if (!ed.est?.pecas.length || ocupado) return false; let ok = false;
        await usa(async () => { if (editando) await this.atualizar(editando, ed.est); else await this.porEmCamadas(ed.est); ok = true; }); return ok; } },
    ] });
    rab?.parar();
  },
  async porNaCena(cv, cena, est) {
    if (!App.P) throw new Error('Nenhuma animação aberta.');
    const n = await App.addCenario(await this.blob(cv), 'Cenário: ' + String(cena?.nome || 'novo').slice(0, 30), { cena, ...(est ? { cenaEd: await this.serial(est) } : {}), ...(cena?.ia ? { ia: true } : {}) });
    UI.toast(`<b>${esc(cena?.nome || 'Cenário')}</b> entrou no fundo da cena (só nesta animação). Para mudar: botão direito › <b>Editar cenário</b>. Para a equipe usar: <b>Salvar na nuvem</b>.`, { kind: 'ok', time: 6000 });
    return n;
  },
  // as peças viram camadas de imagem (a da frente primeiro na pasta); cada uma lembra de que peça veio (pecaCen)
  async nosDasPecas(est, q, velhos = []) {
    const out = [], porPeca = new Map(velhos.map(n => [n.pecaCen, n]));
    for (const p of [...est.pecas].reverse()) {
      if (p.oculta) continue;
      const blob = await this.blob(p.cv), id = p.tipo === 'img' && p.k ? p.k : await Arq.guardar(blob); if (!Arq.img.get(id)) Arq.img.set(id, await createImageBitmap(blob));
      const s = round(p.w / p.cv.width, 4), cx = p.x + p.w / 2, cy = p.y + p.h / 2, v = porPeca.get(p.id);
      if (v) { // a camada que já existia (com as chaves de animação): troca a imagem e leva as chaves junto com a peça
        const k0 = Modelo.quadrosChave(v)[0], b = v.chaves[k0] || {}, dx = cx - (b.x ?? cx), dy = cy - (b.y ?? cy), ks = s / (b.s || s);
        for (const c of Object.values(v.chaves)) { if (c.x != null) c.x += dx; if (c.y != null) c.y += dy; if (c.s != null) c.s = round(c.s * ks, 4); }
        v.arq = id; v.nome = p.nome; out.push(v); continue; }
      const n = Modelo.novoNo('imagem', { arq: id, nome: p.nome }); n.de = q; n.pecaCen = p.id; n.chaves = { [q]: { x: cx, y: cy, r: 0, s, sx: 1, op: 1 } }; out.push(n);
    }
    return out;
  },
  // uma pasta com uma camada de imagem por peça, cada uma no lugar dela (a pasta cobre a câmera, como o cenário inteiro)
  async porEmCamadas(est, o = {}) {
    const P = App.P, q = App.q; if (!P) throw new Error('Nenhuma animação aberta.');
    const c = Modelo.camera(P, q), z = c.zoom || 1, s = round(Math.max(P.w / z / this.W, P.h / z / this.H) * 1.02, 3);
    const pasta = Modelo.novoNo('pasta', { nome: 'Cenário: ' + String(est.nome || 'novo').slice(0, 30) });
    pasta.de = q; pasta.aberto = false; pasta.cenario = true; pasta.cena = this.cenaDe(est); pasta.cenaEd = await this.serial(est); if (est.ia) pasta.ia = true;
    pasta.chaves = { [q]: { x: Math.round(c.x - this.W / 2 * s), y: Math.round(c.y - this.H / 2 * s), r: 0, s, sx: 1, op: 1 } };
    pasta.filhos.push(...await this.nosDasPecas(est, q));
    const i = P.raiz.findIndex(x => x.cenario || x.fundoPadrao); // na frente dos cenários (e do Fundo padrão) e atrás do resto
    if (i >= 0) P.raiz.splice(i, 0, pasta); else P.raiz.push(pasta); App.sel = pasta.id; if (o.semAviso) return pasta; App.commit('Cenário em camadas');
    UI.toast(`<b>${esc(est.nome || 'Cenário')}</b> entrou no fundo da cena com ${pasta.filhos.length} peças separadas. Para mudar: botão direito › <b>Editar cenário</b>.`, { kind: 'ok', time: 6000 });
    return pasta;
  },
  // "Editar cenário": o que já está na cena (pasta de peças, imagem do cenário inteiro ou uma peça dentro da pasta)
  async editarNo(n) {
    const P = App.P; let no = n, sel = null;
    const r = Modelo.achar(P, n.id); if ((n.pecaCen || !(n.cena || n.cenaEd)) && (r?.pai?.cenaEd || r?.pai?.cena)) { no = r.pai; sel = n.pecaCen || n.nome; } // uma peça dentro da pasta do cenário
    let est;
    if (no.cenaEd) est = await this.deSerial(no.cenaEd);
    else if (no.cena?.camadas) est = await this.estadoDe(no.cena);
    else if (no.tipo === 'imagem') { const b = await Arq.pegaBlob(no.arq).catch(() => null); if (!b) return UI.toast('Não achei a imagem deste cenário neste computador.', { kind: 'err' });
      est = await this.estadoDaImagem(b, no.nome); }
    else return UI.toast('Este cenário não tem as peças guardadas para editar.', { kind: 'warn' });
    return this.abrir({ estado: est, sel, no });
  },
  // uma imagem inteira (cenário da nuvem) → estado com uma peça só, travada
  async estadoDaImagem(blob, nome) {
    const cv = await CenaEd.canvasDe(blob), k = Math.min(this.W / cv.width, this.H / cv.height), w = cv.width * k, hh = cv.height * k;
    return { nome: String(nome || 'Cenário').replace(/^Cenário: /, ''), pecas: [{ id: uid('pc'), nome: 'Cenário', tipo: 'img', cv, x: (this.W - w) / 2, y: (this.H - hh) / 2, w, h: hh, trava: true }] };
  },
  // "Atualizar na cena": troca as peças do que já estava (mesmo lugar no tempo e na hierarquia; chaves das peças vão junto)
  async atualizar(no, est) {
    const P = App.P; if (!Modelo.achar(P, no.id)) throw new Error('Esse cenário não está mais na animação.');
    no.cena = this.cenaDe(est); no.cenaEd = await this.serial(est); if (est.ia) no.ia = true; delete no.nuvem;
    if (no.tipo === 'pasta') no.filhos = await this.nosDasPecas(est, no.de || 0, no.filhos.filter(f => f.pecaCen));
    else { // cenário antigo numa imagem só: vira PASTA com uma camada por peça (no mesmo lugar e no mesmo tempo)
      const r = Modelo.achar(P, no.id), bm = Arq.img.get(no.arq), bw = bm?.width || this.W, bh = bm?.height || this.H, kk = Math.min(bw / this.W, bh / this.H) || 1;
      const pasta = Modelo.novoNo('pasta', { nome: no.nome }); Object.assign(pasta, { de: no.de, ate: no.ate, aberto: false, cenario: true, cena: no.cena, cenaEd: no.cenaEd, interp: no.interp, ...(no.ia ? { ia: true } : {}) });
      pasta.chaves = Object.fromEntries(Object.entries(no.chaves || {}).map(([q, c]) => { const s0 = (c.s ?? 1) * kk, o = { ...c }; if (c.s != null) o.s = round(s0, 4); if (c.x != null) o.x = Math.round(c.x - this.W / 2 * s0); if (c.y != null) o.y = Math.round(c.y - this.H / 2 * s0); return [q, o]; }));
      pasta.filhos.push(...await this.nosDasPecas(est, no.de || 0)); r.lista.splice(r.lista.indexOf(no), 1, pasta); no = pasta; }
    App.sel = no.id; App.commit('Editar cenário'); UI.toast(`<b>${esc(est.nome || 'Cenário')}</b> foi atualizado na cena.`, { kind: 'ok' });
  },
};
