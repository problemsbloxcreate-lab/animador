/* ===================== deformar.js — DEFORMAR (como o Ctrl+T do Photoshop) num quadro ou em vários =====================
   Camada escolhida (personagem, imagem, texto, forma) › tecla T ou botão direito › "Deformar…" (o Ctrl+T do navegador abre aba nova e não dá para usar):
     CANTOS = mexe cada um dos 4 cantos à vontade (distorcer) · MALHA = 16 pontos (4×4) para curvar (warp).
   Fica na CHAVE do quadro: chave.df = { g: 2|4, b: {x,y,w,h} (caixa de antes, no espaço da camada), p: [[dx,dy]…] (quanto cada ponto saiu do lugar) }.
   chave.df = null → sem deformação a partir dali. Entre chaves a deformação SEGURA (troca na hora); com n.dfSuave ela vai mudando aos poucos.
   Vale para: "Só este quadro" (chave aqui + a de antes no quadro seguinte), "Daqui em diante" (só a chave aqui) ou
   "O trecho marcado" (Shift + arrastar na régua: chaves no começo e no fim + a de antes depois do trecho).
   Desenho: a camada é desenhada numa imagem à parte e esticada numa malha de triângulos (Render.umNo → Deformar.desenha). */
'use strict';
const Deformar = {
  ativo: null, // { id, modo: 'quadro'|'daqui'|'trecho' }
  // ---------- contas ----------
  resto(b, g) { const out = []; for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) out.push([b.x + b.w * i / (g - 1), b.y + b.h * j / (g - 1)]); return out; },
  pontos(df) { const r = this.resto(df.b, df.g); return r.map(([x, y], i) => [x + (df.p[i]?.[0] || 0), y + (df.p[i]?.[1] || 0)]); },
  // onde o ponto (x, y) da camada vai parar
  F(df, C, x, y) {
    const u = (x - df.b.x) / (df.b.w || 1), v = (y - df.b.y) / (df.b.h || 1);
    if (df.g === 2) { const [a, b, c, d] = C, w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v; return [a[0] * w00 + b[0] * w10 + c[0] * w01 + d[0] * w11, a[1] * w00 + b[1] * w10 + c[1] * w01 + d[1] * w11]; }
    const B = t => [(1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3], bu = B(u), bv = B(v); let X = 0, Y = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const w = bu[i] * bv[j], p = C[j * 4 + i]; X += p[0] * w; Y += p[1] * w; }
    return [X, Y];
  },
  vazio(df) { return !df || !df.p?.some(p => Math.abs(p[0]) > .01 || Math.abs(p[1]) > .01); },
  paraG(df, g) { // cantos → malha (ou malha → cantos)
    if (!df || df.g === g) return df; const C = this.pontos(df);
    if (g === 4) return { g: 4, b: { ...df.b }, p: this.resto(df.b, 4).map(([x, y]) => { const [X, Y] = this.F(df, C, x, y); return [round(X - x, 2), round(Y - y, 2)]; }) };
    const r = this.resto(df.b, 2), idx = [0, 3, 12, 15]; return { g: 2, b: { ...df.b }, p: idx.map((k, i) => [round(C[k][0] - r[i][0], 2), round(C[k][1] - r[i][1], 2)]) };
  },
  // a deformação da camada no quadro q (ou null)
  em(n, q) {
    const ks = Modelo.quadrosChave(n).filter(k => n.chaves[k].df !== undefined); let a = null, b = null;
    for (const k of ks) { if (k <= q) a = k; else { b = k; break; } }
    if (a == null) return null; const da = n.chaves[a].df;
    if (!n.dfSuave || b == null) return this.vazio(da) ? null : da;
    const db = n.chaves[b].df; if (this.vazio(da) && this.vazio(db)) return null;
    const ref = db || da, A = this.paraG(da || { g: ref.g, b: ref.b, p: ref.p.map(() => [0, 0]) }, ref.g), Bd = this.paraG(db || { g: ref.g, b: ref.b, p: ref.p.map(() => [0, 0]) }, ref.g);
    const t = Ease.inOut((q - a) / (b - a)), L = (x, y) => x + (y - x) * t;
    return { g: ref.g, b: { x: L(A.b.x, Bd.b.x), y: L(A.b.y, Bd.b.y), w: L(A.b.w, Bd.b.w), h: L(A.b.h, Bd.b.h) }, p: A.p.map((p, i) => [L(p[0], Bd.p[i][0]), L(p[1], Bd.p[i][1])]) };
  },
  // caixa da camada no espaço dela (como em Render.caixas)
  caixa(P, n, q) {
    if (n.tipo === 'personagem') { const def = P.personagens[n.ref]; if (!def) return null; const est = Modelo.estadoPersonagem(n, q), dv = Modelo.naVista(def, est.vista); return Modelo.caixaPersonagem(dv, Modelo.partesNoEstado(dv, est)); }
    if (n.tipo === 'imagem') { const bm = Render.bm(n.arq); const w = bm?.width || 200, h = bm?.height || 200; return { x: -w / 2, y: -h / 2, w, h }; }
    if (n.tipo === 'forma') return { x: -(n.w || 100) / 2, y: -(n.h || 100) / 2, w: n.w || 100, h: n.h || 100 };
    if (n.tipo === 'texto') return Render.caixas(P, q).find(c => c.no === n)?.local || null;
    return null;
  },
  // ---------- desenhar deformado ----------
  _off: null,
  desenha(ctx, P, q, base, n, mm, df) {
    const b0 = this.caixa(P, n, q); if (!b0) return false;
    const C = this.pontos(df), x0 = Math.min(b0.x, df.b.x) - 4, y0 = Math.min(b0.y, df.b.y) - 4, x1 = Math.max(b0.x + b0.w, df.b.x + df.b.w) + 4, y1 = Math.max(b0.y + b0.h, df.b.y + df.b.h) + 4, R = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    const M = base.multiply(mm), ks = Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)) || 1, k = clamp(ks, .05, 2048 / Math.max(R.w, R.h));
    const W = Math.max(1, Math.ceil(R.w * k)), H = Math.max(1, Math.ceil(R.h * k));
    if (!this._off || this._off.width < W || this._off.height < H) this._off = new OffscreenCanvas(Math.max(W, this._off?.width || 0), Math.max(H, this._off?.height || 0));
    const off = this._off, g = off.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W + 2, H + 2);
    const S = new DOMMatrix().scale(k).translate(-R.x, -R.y);
    // a camada sem deformação, no espaço dela
    if (n.tipo === 'personagem') { for (const it of Render.pecasPersonagem(P, n, q, new DOMMatrix())) { if (!it.img) continue; const bm = Arq.comAp(Render.bm(it.img.k), it, () => Render.aoChegarImagem?.()); if (!bm) continue;
      const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2; g.setTransform(S.multiply(it.m)); g.drawImage(bm, -px + (it.img.ajuste?.x || 0), -py + (it.img.ajuste?.y || 0), it.img.w, it.img.h); } }
    else if (n.tipo === 'imagem') { const bm = Render.bm(n.arq); if (!bm) return true; g.setTransform(S); g.drawImage(bm, -bm.width / 2, -bm.height / 2); }
    else if (n.tipo === 'texto') { g.setTransform(S); Render.texto(g, n); }
    else if (n.tipo === 'forma') { g.setTransform(S); Render.forma(g, n); }
    this.malha(ctx, off, W, H, R, k, df, C, M, ks);
    return true;
  },
  // malha de triângulos: cada pedacinho de `off` (a região R do espaço da camada, k px por unidade) vai para o lugar deformado; M = espaço da camada → ctx
  malha(ctx, off, W, H, R, k, df, C, M, ks = 1) {
    const N = df.g === 2 ? 10 : 16, eps = 1.2 / ks; // um tiquinho de sobra no recorte = sem risquinhos entre os triângulos
    const vs = []; for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const sx = R.x + R.w * i / N, sy = R.y + R.h * j / N; vs.push({ s: [(sx - R.x) * k, (sy - R.y) * k], d: this.F(df, C, sx, sy) }); }
    const tri = (A, B, Cc) => {
      const [u0, v0] = A.s, [u1, v1] = B.s, [u2, v2] = Cc.s, [X0, Y0] = A.d, [X1, Y1] = B.d, [X2, Y2] = Cc.d;
      const det = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0); if (Math.abs(det) < 1e-9) return;
      const a = ((X1 - X0) * (v2 - v0) - (X2 - X0) * (v1 - v0)) / det, c = ((X2 - X0) * (u1 - u0) - (X1 - X0) * (u2 - u0)) / det,
        bb = ((Y1 - Y0) * (v2 - v0) - (Y2 - Y0) * (v1 - v0)) / det, d = ((Y2 - Y0) * (u1 - u0) - (Y1 - Y0) * (u2 - u0)) / det;
      const e = X0 - a * u0 - c * v0, f = Y0 - bb * u0 - d * v0, cx = (X0 + X1 + X2) / 3, cy = (Y0 + Y1 + Y2) / 3, ex = (x, y) => { const L = Math.hypot(x - cx, y - cy) || 1; return [x + (x - cx) / L * eps, y + (y - cy) / L * eps]; };
      ctx.save(); ctx.setTransform(M); ctx.beginPath(); [ex(X0, Y0), ex(X1, Y1), ex(X2, Y2)].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip();
      ctx.setTransform(M.multiply(new DOMMatrix([a, bb, c, d, e, f])));
      const sx = Math.max(0, Math.floor(Math.min(u0, u1, u2)) - 1), sy = Math.max(0, Math.floor(Math.min(v0, v1, v2)) - 1), sw = Math.min(W, Math.ceil(Math.max(u0, u1, u2)) + 1) - sx, sh = Math.min(H, Math.ceil(Math.max(v0, v1, v2)) + 1) - sy;
      if (sw > 0 && sh > 0) ctx.drawImage(off, sx, sy, sw, sh, sx, sy, sw, sh); ctx.restore();
    };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const p00 = vs[j * (N + 1) + i], p10 = vs[j * (N + 1) + i + 1], p01 = vs[(j + 1) * (N + 1) + i], p11 = vs[(j + 1) * (N + 1) + i + 1]; tri(p00, p10, p11); tri(p00, p11, p01); }
  },
  // uma imagem inteira deformada (Ateliê › editor de imagem): mesma conta, em pixels da imagem
  // pad = { L, T, R, B }: a imagem cresce para caber o que saiu da borda (o desenho fica no mesmo lugar)
  imagem(src, df, pad) {
    const W = src.width, H = src.height, P = pad || { L: 0, T: 0, R: 0, B: 0 }, out = new OffscreenCanvas(W + P.L + P.R, H + P.T + P.B), g = out.getContext('2d'); g.imageSmoothingQuality = 'high';
    this.malha(g, src, W, H, { x: 0, y: 0, w: W, h: H }, 1, df, this.pontos(df), new DOMMatrix().translate(P.L, P.T), 1); return out;
  },
  // quanto o desenho deformado passa das bordas da imagem (px)
  sobra(df, W, H) {
    const C = this.pontos(df), b = df.b, pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([b.x + b.w * t, b.y], [b.x + b.w * t, b.y + b.h], [b.x, b.y + b.h * t], [b.x + b.w, b.y + b.h * t]); }
    let x0 = 0, y0 = 0, x1 = W, y1 = H; for (const [x, y] of pts) { const [X, Y] = this.F(df, C, x, y); x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y); }
    const r = v => Math.max(0, Math.ceil(v) + 2); return { L: x0 < 0 ? r(-x0) : 0, T: y0 < 0 ? r(-y0) : 0, R: x1 > W ? r(x1 - W) : 0, B: y1 > H ? r(y1 - H) : 0 };
  },

  /* ---------- editar no palco ---------- */
  pode(n) { return n && ['personagem', 'imagem', 'texto', 'forma'].includes(n.tipo); },
  alterna(n) { if (this.ativo) return this.sair(); this.entrar(n); },
  entrar(n) {
    if (!this.pode(n)) return UI.toast('Escolha um personagem, imagem, texto ou forma para deformar.', { kind: 'warn' });
    if (n.trava) return UI.toast('Esta camada está travada (cadeado na hierarquia).', { kind: 'warn' });
    const tr = Folha.trecho, noTr = tr && App.q >= tr.de && App.q <= tr.ate;
    this.ativo = { id: n.id, modo: noTr ? 'trecho' : 'quadro', g: this.em(n, App.q)?.g || 2 }; App.selecionar(n.id); this.barra(); App.pinta();
  },
  sair() { this.ativo = null; $('#df-barra')?.remove(); App.pinta?.(); },
  no() { const a = this.ativo; const n = a && Modelo.achar(App.P, a.id)?.no; if (a && (!n || App.sel !== a.id)) { this.sair(); return null; } return n; },
  // os quadros que a mudança atinge e as chaves de antes que seguram o resto
  alvo(n) {
    const q = App.q, P = App.P, ult = Modelo.ultimoQuadro(P), m = this.ativo.modo, tr = Folha.trecho;
    if (m === 'trecho' && tr) return { em: [tr.de, tr.ate], volta: tr.ate + 1 <= ult ? tr.ate + 1 : null, antes: tr.de - 1 >= 0 ? tr.de - 1 : null };
    if (m === 'daqui') return { em: [q], volta: null, antes: null };
    return { em: [q], volta: q + 1 <= ult ? q + 1 : null, antes: q - 1 >= 0 ? q - 1 : null };
  },
  // escreve df nos quadros do alvo (guarda antes o que segura os vizinhos)
  aplicaDf(n, df) {
    const al = this.alvo(n), velho = q => { const d = this.em(n, q); return d ? JSON.parse(JSON.stringify(d)) : null; };
    const segura = []; if (al.volta != null && n.chaves?.[al.volta]?.df === undefined) segura.push([al.volta, velho(al.volta)]);
    if (n.dfSuave && al.antes != null && n.chaves?.[al.antes]?.df === undefined) segura.push([al.antes, velho(al.antes)]);
    for (const q of [...new Set(al.em)]) Modelo.chave(n, q).df = df ? JSON.parse(JSON.stringify(df)) : null;
    for (const [q, d] of segura) Modelo.chave(n, q).df = d;
  },
  barra() {
    $('#df-barra')?.remove(); const n = this.no(); if (!n) return; const a = this.ativo, tr = Folha.trecho, P = App.P;
    const el = h(`<div id="df-barra" class="df-barra"><span class="df-t">${ic('transition', 14)} Deformar <b>${esc(n.nome)}</b></span>
      <span class="df-seg"><button data-g="2" class="${a.g === 2 ? 'on' : ''}" title="Mexer os 4 cantos à vontade">Cantos</button><button data-g="4" class="${a.g === 4 ? 'on' : ''}" title="16 pontos para curvar">Malha</button></span>
      <label class="df-l">Vale para <select data-modo><option value="quadro">Só este quadro (${App.q + 1})</option><option value="daqui">Daqui em diante</option>${tr ? `<option value="trecho">O trecho marcado (${esc(Trechos.rotulo(tr, P))})</option>` : ''}</select></label>
      <label class="df-l" title="Entre duas chaves de deformação, ir mudando aos poucos (senão troca na hora)"><input type="checkbox" data-suave ${n.dfSuave ? 'checked' : ''}> Suave</label>
      <button class="btn sm" data-tira title="Volta ao normal nos quadros escolhidos">Tirar</button><button class="btn sm primary" data-ok title="Enter ou T">Pronto</button></div>`);
    $('#palco').appendChild(el); $('[data-modo]', el).value = a.modo;
    $('[data-modo]', el).onchange = e => { a.modo = e.target.value; };
    $('[data-suave]', el).onchange = e => { n.dfSuave = e.target.checked || undefined; App.commit('Deformação suave', { semArvore: true }); };
    for (const b of $$('[data-g]', el)) b.onclick = () => { a.g = +b.dataset.g; const d = this.em(n, App.q); if (d && d.g !== a.g) { this.aplicaDf(n, this.paraG(d, a.g)); App.commit('Deformar: ' + (a.g === 4 ? 'malha' : 'cantos'), { semArvore: true }); } this.barra(); App.pinta(); };
    $('[data-tira]', el).onclick = () => { this.aplicaDf(n, null); App.commit('Tirar a deformação', { semArvore: true }); App.pinta(); };
    $('[data-ok]', el).onclick = () => this.sair();
  },
  // matriz da camada no mundo (com pais, trêmulo…)
  matMundo(n) { return Render.caixas(App.P, App.q).find(c => c.no === n)?.m || null; },
  dfAtual(n) { const d = this.em(n, App.q); if (d) return this.paraG(JSON.parse(JSON.stringify(d)), this.ativo.g); const b = this.caixa(App.P, n, App.q); return b && { g: this.ativo.g, b: { x: round(b.x, 2), y: round(b.y, 2), w: round(b.w, 2), h: round(b.h, 2) }, p: this.resto(b, this.ativo.g).map(() => [0, 0]) }; },
  // alças na tela (pontos de controle)
  desenhaAlcas(ctx, V, dpr) {
    const n = this.no(); if (!n) return false; const m = this.matMundo(n); if (!m) return true;
    const df = this.dfAtual(n); if (!df) return true; const T = V.multiply(m), C = this.pontos(df), tp = ([x, y]) => { const p = T.transformPoint(new DOMPoint(x, y)); return [p.x, p.y]; };
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 1.2 * dpr;
    // contorno e linhas da malha seguindo a curva
    const linha = pts => { ctx.beginPath(); pts.forEach((p, i) => { const [x, y] = tp(this.F(df, C, p[0], p[1])); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
    const b = df.b, L = 24, div = df.g === 4 ? [0, 1 / 3, 2 / 3, 1] : [0, 1];
    for (const t of div) { linha(Array.from({ length: L + 1 }, (_, i) => [b.x + b.w * i / L, b.y + b.h * t])); linha(Array.from({ length: L + 1 }, (_, i) => [b.x + b.w * t, b.y + b.h * i / L])); }
    if (df.g === 4) { ctx.setLineDash([3 * dpr, 3 * dpr]); ctx.strokeStyle = 'rgba(255,211,107,.45)'; for (let j = 0; j < 4; j++) { ctx.beginPath(); for (let i = 0; i < 4; i++) { const [x, y] = tp(C[j * 4 + i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); } ctx.setLineDash([]); }
    ctx.fillStyle = '#1b1b1b'; ctx.strokeStyle = '#ffd36b';
    C.forEach((p, i) => { const [x, y] = tp(p), s = (df.g === 2 || [0, 3, 12, 15].includes(i) ? 5 : 4) * dpr; ctx.fillRect(x - s, y - s, s * 2, s * 2); ctx.strokeRect(x - s, y - s, s * 2, s * 2); });
    ctx.restore(); return true;
  },
  // arrastar um ponto (devolve true se pegou)
  desce(e, cv, dpr) {
    const n = this.no(); if (!n) return false; const m = this.matMundo(n), df = m && this.dfAtual(n); if (!df) return false;
    const V = App.palco.vista(), T = V.multiply(m), C = this.pontos(df), x = e.offsetX * dpr, y = e.offsetY * dpr;
    let best = -1, bd = 12 * dpr; C.forEach((p, i) => { const q = T.transformPoint(new DOMPoint(p[0], p[1])), d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = i; } });
    if (best < 0) return false;
    const inv = T.inverse(), r = this.resto(df.b, df.g)[best], p0 = [...df.p[best]], c0 = inv.transformPoint(new DOMPoint(x, y)); let mexeu = false;
    App.palco.fim(e, ev => {
      const w = inv.transformPoint(new DOMPoint(ev.offsetX * dpr, ev.offsetY * dpr)), d = { ...df, p: df.p.map(p => [...p]) };
      d.p[best] = [round(p0[0] + w.x - c0.x, 2), round(p0[1] + w.y - c0.y, 2)]; this.aplicaDf(n, d); mexeu = true; App.pinta();
    }, () => { if (mexeu) App.commit('Deformar', { semArvore: true }); });
    return true;
  },
};
