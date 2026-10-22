/* ===================== folhas.js — ateliê: FOLHAS DE PEÇAS e TAMANHO das peças =====================
   Quando entram imagens no Ateliê (personagem novo, soltar na lista de partes ou numa parte), antes de pôr:
   • FOLHA (spritesheet, ex.: do ChatGPT): acha as peças soltas na imagem e oferece separar cada uma.
     "Versões" = cada peça vira uma imagem própria, aparada (olhos, bocas, poses de braço).
     "Corpo desmontado" = cada peça fica no lugar em que estava na folha (cabeça em cima, pernas embaixo…).
     Pergunta se pode tirar a folha inteira depois de separar.
   • FUNDO: imagem sem transparência (fundo branco ou o xadrez "falso" desenhado) — oferece tirar o fundo.
   • TAMANHO: cada folha do ChatGPT vem numa escala diferente. Mede a grossura do contorno preto e compara com
     a referência (a imagem da parte onde vai entrar, a peça principal do personagem, ou a maior imagem do lote);
     se não bate, oferece ajustar, mostrando ANTES e DEPOIS ao lado da referência.
   Nada é feito sem a pessoa confirmar. Funciona igual com "A IA organiza tudo" ligado (a pergunta vem antes da IA). */
'use strict';
const Folhas = {
  MAX: 2048, // mesmo limite do addImagens

  /* ---------- análise de uma imagem ---------- */
  async analisa(file) {
    const bm = await createImageBitmap(file).catch(() => null); if (!bm) return null;
    const k = Math.min(1, this.MAX / Math.max(bm.width, bm.height)), W = Math.max(1, Math.round(bm.width * k)), H = Math.max(1, Math.round(bm.height * k));
    const cv = new OffscreenCanvas(W, H), c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(bm, 0, 0, W, H);
    const im = c.getImageData(0, 0, W, H), D = im.data, N = W * H;
    let transp = 0; for (let p = 0; p < N; p++) if (D[p * 4 + 3] < 16) transp++;
    const a = { file, nome: file.name.replace(/\.[^.]+$/, '').slice(0, 34), W, H, fundo: null };
    if (transp / N < 0.03) a.fundo = this.tiraFundo(D, W, H); // sem transparência: procura um fundo liso (ou xadrez falso) encostado na borda
    a.cv = cv; a.limpo = a.fundo ? new ImageData(new Uint8ClampedArray(D), W, H) : null; // D já sem o fundo (se achou)
    if (a.fundo) { a.cvOrig = new OffscreenCanvas(W, H); a.cvOrig.getContext('2d').drawImage(cv, 0, 0); c.putImageData(im, 0, 0); } // cv mostra a versão sem fundo; cvOrig guarda a original
    a.esp = this.espessura(D, W, H);
    this.rotula(a, D);
    return a;
  },

  // fundo: até 2 cores que dominam a borda; apaga o que encosta na borda com essas cores (balde a partir das bordas)
  tiraFundo(D, W, H) {
    const cont = new Map(), soma = new Map(); let nb = 0;
    const conta = p => { const i = p * 4, kk = (D[i] >> 4) << 8 | (D[i + 1] >> 4) << 4 | (D[i + 2] >> 4); cont.set(kk, (cont.get(kk) || 0) + 1); const s = soma.get(kk) || [0, 0, 0]; s[0] += D[i]; s[1] += D[i + 1]; s[2] += D[i + 2]; soma.set(kk, s); nb++; };
    for (let x = 0; x < W; x++) { conta(x); conta((H - 1) * W + x); } for (let y = 1; y < H - 1; y++) { conta(y * W); conta(y * W + W - 1); }
    const top = [...cont.entries()].sort((p, q) => q[1] - p[1]).slice(0, 2); if (!top.length) return null;
    const cores = []; let cob = 0;
    for (const [kk, n] of top) { if (n / nb < 0.12 && cores.length) break; const s = soma.get(kk); cores.push([s[0] / n, s[1] / n, s[2] / n]); cob += n; }
    if (cob / nb < 0.7) return null; // a borda não é lisa: não é fundo, é desenho
    const tol = 60, perto = i => cores.some(cc => Math.abs(D[i] - cc[0]) + Math.abs(D[i + 1] - cc[1]) + Math.abs(D[i + 2] - cc[2]) <= tol);
    const fundo = new Uint8Array(W * H), pilha = [];
    const semente = p => { if (!fundo[p] && perto(p * 4)) { fundo[p] = 1; pilha.push(p); } };
    for (let x = 0; x < W; x++) { semente(x); semente((H - 1) * W + x); } for (let y = 0; y < H; y++) { semente(y * W); semente(y * W + W - 1); }
    while (pilha.length) { const p = pilha.pop(), x = p % W;
      if (x > 0) semente(p - 1); if (x < W - 1) semente(p + 1); if (p >= W) semente(p - W); if (p < W * (H - 1)) semente(p + W); }
    let n = 0; for (let p = 0; p < W * H; p++) if (fundo[p]) n++; if (n / (W * H) < 0.05) return null;
    // borda da peça encostada no fundo: tira a "auréola" da cor do fundo (desmistura a cor) — só com fundo de uma cor
    const um = cores.length === 1 ? cores[0] : null;
    for (let p = 0; p < W * H; p++) {
      if (fundo[p]) { D[p * 4 + 3] = 0; continue; }
      if (!um) continue; const x = p % W;
      const borda = (x > 0 && fundo[p - 1]) || (x < W - 1 && fundo[p + 1]) || (p >= W && fundo[p - W]) || (p < W * (H - 1) && fundo[p + W]); if (!borda) continue;
      const i = p * 4; let al = 0; for (let ch = 0; ch < 3; ch++) al = Math.max(al, Math.abs(D[i + ch] - um[ch]) / Math.max(um[ch], 255 - um[ch], 1));
      al = Math.min(1, Math.max(0, al)); if (al < 0.04) { D[i + 3] = 0; continue; }
      for (let ch = 0; ch < 3; ch++) D[i + ch] = Math.round(um[ch] + (D[i + ch] - um[ch]) / al); D[i + 3] = Math.round(D[i + 3] * al);
    }
    const claro = um && um[0] + um[1] + um[2] > 600;
    return { tipo: cores.length > 1 ? 'xadrez' : claro ? 'branco' : 'liso', cor: cores[0] };
  },

  // grossura do contorno preto: a medida que mais aparece entre os trechos escuros (linhas e colunas)
  espessura(D, W, H) {
    const hist = new Uint32Array(61); let tot = 0;
    const escuro = i => D[i + 3] > 128 && D[i] + D[i + 1] + D[i + 2] < 200;
    for (let y = 0; y < H; y++) { let r = 0; for (let x = 0; x <= W; x++) { if (x < W && escuro((y * W + x) * 4)) r++; else { if (r >= 2 && r <= 60) { hist[r]++; tot++; } r = 0; } } }
    for (let x = 0; x < W; x++) { let r = 0; for (let y = 0; y <= H; y++) { if (y < H && escuro((y * W + x) * 4)) r++; else { if (r >= 2 && r <= 60) { hist[r]++; tot++; } r = 0; } } }
    if (tot < 300) return null; let m = 2; for (let i = 2; i <= 60; i++) if (hist[i] > hist[m]) m = i;
    // média ponderada em volta do pico (mais estável que só o pico)
    let s = 0, n = 0; for (let i = Math.max(2, m - 2); i <= Math.min(60, m + 2); i++) { s += i * hist[i]; n += hist[i]; } return n ? s / n : m;
  },

  // pedaços ligados (8 vizinhos) do que não é transparente
  rotula(a, D) {
    const { W, H } = a, N = W * H, lab = new Int32Array(N), comps = [], pilha = [];
    for (let p0 = 0; p0 < N; p0++) {
      if (lab[p0] || D[p0 * 4 + 3] < 24) continue; const id = comps.length + 1, cp = { id, p0, x0: W, y0: H, x1: -1, y1: -1, n: 0 }; lab[p0] = id; pilha.push(p0);
      while (pilha.length) { const p = pilha.pop(), x = p % W, y = (p - x) / W; cp.n++; if (x < cp.x0) cp.x0 = x; if (x > cp.x1) cp.x1 = x; if (y < cp.y0) cp.y0 = y; if (y > cp.y1) cp.y1 = y;
        for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue; const q = yy * W + xx; if (!lab[q] && D[q * 4 + 3] >= 24) { lab[q] = id; pilha.push(q); } } } }
      comps.push(cp); if (comps.length > 4000) break; // pó demais: não é folha (foto, textura)
    }
    a.lab = lab; a.comps = comps;
    const t = a.esp || Math.max(W, H) * 0.006; a.gapPadrao = Math.max(5, Math.round(t * 1.5)); a.gapMax = Math.max(40, Math.round(t * 12));
  },

  // junta os pedaços próximos: "engorda" o desenho em gap/2 px para cada lado; o que encostar vira uma peça só
  // (medido pelos pixels de verdade, não pelas caixas: um braço dobrado que entra na caixa do vizinho não junta)
  agrupa(a, gap) {
    const { W, H } = a, N = W * H, min = Math.max(6, N * 0.00003), cs = a.comps; if (cs.length > 4000) return [];
    if (a._g && a._g.gap === gap) return a._g.res;
    const r = Math.max(0, Math.ceil(gap / 2)), m = new Uint8Array(N), lab = a.lab; for (let p = 0; p < N; p++) if (lab[p]) m[p] = 1;
    let d = m;
    if (r > 0) { const t = new Uint8Array(N); // máximo numa janela (2r+1): primeiro nas linhas, depois nas colunas
      for (let y = 0; y < H; y++) { const o = y * W; let c = 0; for (let x = 0; x < Math.min(r, W); x++) c += m[o + x]; for (let x = 0; x < W; x++) { if (x + r < W) c += m[o + x + r]; if (x - r - 1 >= 0) c -= m[o + x - r - 1]; t[o + x] = c > 0 ? 1 : 0; } }
      d = new Uint8Array(N); for (let x = 0; x < W; x++) { let c = 0; for (let y = 0; y < Math.min(r, H); y++) c += t[y * W + x]; for (let y = 0; y < H; y++) { if (y + r < H) c += t[(y + r) * W + x]; if (y - r - 1 >= 0) c -= t[(y - r - 1) * W + x]; d[y * W + x] = c > 0 ? 1 : 0; } } }
    const dl = new Int32Array(N), pilha = []; let nl = 0;
    for (const cp of cs) { if (dl[cp.p0]) continue; const id = ++nl; dl[cp.p0] = id; pilha.push(cp.p0);
      while (pilha.length) { const p = pilha.pop(), x = p % W; const v = q => { if (d[q] && !dl[q]) { dl[q] = id; pilha.push(q); } }; if (x > 0) v(p - 1); if (x < W - 1) v(p + 1); if (p >= W) v(p - W); if (p < N - W) v(p + W); } }
    const g = new Map();
    for (const c of cs) { const k = dl[c.p0]; let G = g.get(k); if (!G) g.set(k, G = { ids: new Set(), x0: W, y0: H, x1: -1, y1: -1, n: 0 });
      G.ids.add(c.id); G.x0 = Math.min(G.x0, c.x0); G.y0 = Math.min(G.y0, c.y0); G.x1 = Math.max(G.x1, c.x1); G.y1 = Math.max(G.y1, c.y1); G.n += c.n; }
    const L = [...g.values()].filter(G => G.n >= min);
    // ordem de leitura: fileiras de cima para baixo, da esquerda para a direita
    L.sort((p, q) => p.y0 - q.y0); const fil = [];
    for (const G of L) { const f = fil.find(f => { const t = Math.min(G.y1, f.y1) - Math.max(G.y0, f.y0); return t > 0.4 * Math.min(G.y1 - G.y0, f.y1 - f.y0); }); if (f) { f.g.push(G); f.y0 = Math.min(f.y0, G.y0); f.y1 = Math.max(f.y1, G.y1); } else fil.push({ y0: G.y0, y1: G.y1, g: [G] }); }
    fil.sort((p, q) => p.y0 - q.y0); const out = []; fil.forEach((f, li) => f.g.sort((p, q) => p.x0 - q.x0).forEach(G => { G.fila = li; out.push(G); }));
    out.filas = fil.map(f => f.g.length); a._g = { gap, res: out }; return out;
  },
  // fileiras parecidas (todas com 2+ peças, quase a mesma quantidade) e peças de tamanho parecido = folha de versões; senão = corpo desmontado
  modoPadrao(gs, paraParte) {
    if (paraParte) return 'versoes'; const f = gs.filas || []; if (!f.length) return 'versoes';
    // nenhuma peça bem maior que a do meio (num corpo desmontado a cabeça ou o tronco são bem maiores que o resto)
    const ar = gs.map(G => (G.x1 - G.x0 + 1) * (G.y1 - G.y0 + 1)).sort((x, y) => x - y), parecidas = ar[ar.length - 1] / Math.max(1, ar[Math.floor(ar.length / 2)]) <= 2;
    if (f.length === 1) return f[0] >= 3 && parecidas ? 'versoes' : 'montado';
    return parecidas && f.every(n => n >= 2) && Math.max(...f) - Math.min(...f) <= 1 ? 'versoes' : 'montado';
  },
  // folha de PARES (olhos): com a distância padrão sai um olho por peça; procura a distância em que cada peça vira exatamente
  // duas lado a lado, de tamanho parecido, e que continua igual por um tempo (para não juntar fileiras inteiras)
  pares(a) {
    const g0 = this.agrupa(a, a.gapPadrao), n0 = g0.length; if (n0 < 4 || n0 % 2) return null;
    const passo = Math.max(2, Math.round((a.esp || 6) / 2)); let ini = null, run = 0;
    for (let g = a.gapPadrao + passo; g <= a.gapMax; g += passo) { const n = this.agrupa(a, g).length;
      if (n === n0 / 2) { if (ini == null) ini = g; if (++run >= 3) break; } else { if (n < n0 / 2) break; ini = null; run = 0; } }
    if (run < 3) return null; const gs = this.agrupa(a, ini);
    for (const G of gs) { const f = g0.filter(o => [...o.ids].every(id => G.ids.has(id))); if (f.length !== 2) return null;
      const [p, q] = f, ap = (p.x1 - p.x0 + 1) * (p.y1 - p.y0 + 1), aq = (q.x1 - q.x0 + 1) * (q.y1 - q.y0 + 1);
      if (Math.max(ap, aq) / Math.max(1, Math.min(ap, aq)) > 2.5) return null;
      if (Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0) < 0.3 * Math.min(p.y1 - p.y0, q.y1 - q.y0)) return null; }
    return ini;
  },
  // recorta uma peça (com 2 px a mais em volta para não perder a borda suave)
  peca(a, G, montado) {
    const { W, H } = a, src = a.limpo || a.cv.getContext('2d').getImageData(0, 0, W, H), S = src.data, pad = 2;
    const x0 = Math.max(0, G.x0 - pad), y0 = Math.max(0, G.y0 - pad), x1 = Math.min(W - 1, G.x1 + pad), y1 = Math.min(H - 1, G.y1 + pad), w = x1 - x0 + 1, hh = y1 - y0 + 1;
    const out = new ImageData(w, hh), O = out.data, lab = a.lab;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = y * W + x; let dentro = G.ids.has(lab[p]);
      if (!dentro && S[p * 4 + 3] > 0 && !lab[p]) for (let dy = -2; dy <= 2 && !dentro; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && G.ids.has(lab[yy * W + xx])) { dentro = true; break; } }
      if (!dentro) continue; const i = p * 4, o = ((y - y0) * w + (x - x0)) * 4; O[o] = S[i]; O[o + 1] = S[i + 1]; O[o + 2] = S[i + 2]; O[o + 3] = S[i + 3];
    }
    const cv = new OffscreenCanvas(montado ? W : w, montado ? H : hh); cv.getContext('2d').putImageData(out, montado ? x0 : 0, montado ? y0 : 0); return cv;
  },
  escala(cv, s) {
    if (Math.abs(s - 1) < 0.005) return cv; const o = new OffscreenCanvas(Math.max(1, Math.round(cv.width * s)), Math.max(1, Math.round(cv.height * s))), x = o.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(cv, 0, 0, o.width, o.height); return o;
  },
  async arquivo(cv, nome) { const b = await cv.convertToBlob({ type: 'image/png' }); return new File([b], nome.slice(0, 40) + '.png', { type: 'image/png' }); },

  // a maior peça de uma análise (para mostrar no antes/depois)
  maior(a) { const gs = this.agrupa(a, a.gap ?? a.gapPadrao); let G = gs[0]; for (const g of gs) if (g.n > (G?.n || 0)) G = g; return G ? this.peca(a, G, false) : a.cv; },

  /* ---------- a pergunta (um pop-up só para todas as imagens) ----------
     ctx: { paraParte: true se as imagens vão virar versões de uma parte, ref: { esp, cv, nome } da referência }
     Devolve { fs, separou:[nomes], montado:Set(File) } ou null se a pessoa cancelou. */
  async preparar(fs, ctx = {}) {
    if (!fs?.length || typeof OffscreenCanvas === 'undefined') return { fs, separou: [], montado: new Set() };
    const t = UI.toast('<span class="spin-dot"></span> Olhando as imagens…', { time: 60000 }); let as;
    try { as = (await Promise.all(fs.map(f => /\.gif$/i.test(f.name) || f.type === 'image/gif' ? null : this.analisa(f).catch(() => null)))); } finally { t.remove(); }
    // referência de tamanho: a de fora (parte/personagem) ou a imagem do lote com a maior peça
    let ref = ctx.ref && ctx.ref.esp ? ctx.ref : null;
    if (!ref) { let melhor = null, mn = 0; for (const a of as) { if (!a?.esp) continue; const gs = this.agrupa(a, a.gapPadrao), n = Math.max(0, ...gs.map(g => (g.x1 - g.x0) * (g.y1 - g.y0))); if (n > mn) { mn = n; melhor = a; } }
      if (melhor) ref = { esp: melhor.esp, nome: melhor.nome, a: melhor }; }
    const itens = [];
    as.forEach((a, i) => { if (!a) return; a.gap = a.gapPadrao; const gs = this.agrupa(a, a.gap), folha = gs.length >= 2 && gs.length <= 80;
      const s = ref && a.esp && ref.a !== a ? ref.esp / a.esp : 1, tam = Math.abs(s - 1) >= 0.1 && s > 0.2 && s < 5;
      if (!folha && !a.fundo && !tam) return;
      const modo = this.modoPadrao(gs, ctx.paraParte), gp = folha && modo === 'versoes' ? this.pares(a) : null; if (gp) a.gap = gp;
      itens.push({ a, i, folha, separar: folha, modo, pares: !!gp, tirarFolha: true, fundo: !!a.fundo, tam, ajustar: tam, s: tam ? Math.round(s * 100) / 100 : 1, n: this.agrupa(a, a.gap).length }); });
    if (!itens.length) return { fs, separou: [], montado: new Set() };

    const body = h(`<div class="fl-lista"><p class="fl-intro">${itens.length > 1 ? 'Estas imagens precisam' : 'Esta imagem precisa'} de um ajuste antes de entrar. Confira e escolha o que fazer — nada muda sem você aplicar.</p></div>`);
    for (const it of itens) body.appendChild(this.cartao(it, ref));
    const r = await UI.modal({ title: 'Antes de pôr as imagens', icon: 'layers', width: 720, body, cancelValue: 'cancelar', sticky: true, noFocus: true,
      buttons: [{ label: 'Cancelar', value: 'cancelar', left: true }, { label: 'Pôr como estão', value: 'igual' }, { label: 'Aplicar', kind: 'primary', value: 'aplicar' }] });
    if (r === 'cancelar' || r == null) return null; if (r === 'igual') return { fs, separou: [], montado: new Set() };

    const t2 = UI.toast('<span class="spin-dot"></span> Separando e ajustando as peças…', { time: 120000 }); const out = [], separou = [], montado = new Set();
    try {
      const porI = new Map(itens.map(it => [it.i, it]));
      for (let i = 0; i < fs.length; i++) {
        const n0 = out.length, it = porI.get(i); if (!it) { out.push(fs[i]); continue; }
        const a = it.a, s = it.ajustar ? it.s : 1;
        if (it.folha && it.separar) {
          const gs = this.agrupa(a, a.gap), dig = String(gs.length).length;
          if (!it.tirarFolha) out.push(await this.arquivo(this.escala(this.inteira(a, it.fundo), s), a.nome));
          for (let j = 0; j < gs.length; j++) { const f = await this.arquivo(this.escala(this.peca(a, gs[j], it.modo === 'montado'), s), `${a.nome} ${String(j + 1).padStart(dig, '0')}`); if (it.modo === 'montado') montado.add(f); out.push(f); }
          separou.push({ nome: a.nome, n: gs.length, modo: it.modo });
        } else if (it.fundo || (it.ajustar && s !== 1)) out.push(await this.arquivo(this.escala(this.inteira(a, it.fundo), s), a.nome));
        else out.push(fs[i]);
        for (let q = n0; q < out.length; q++) Pastas.herda(out[q], fs[i]); // veio de uma pasta: as peças ficam na parte dela
      }
    } finally { t2.remove(); }
    return { fs: out, separou, montado };
  },
  // a imagem inteira, com ou sem o fundo
  inteira(a, semFundo) {
    const cv = new OffscreenCanvas(a.W, a.H), c = cv.getContext('2d');
    if (semFundo && a.limpo) c.putImageData(a.limpo, 0, 0); else c.drawImage(a.cvOrig || a.cv, 0, 0); return cv;
  },

  // um cartão por imagem: prévia com as peças numeradas + opções
  cartao(it, ref) {
    const a = it.a, fundoTxt = { branco: 'fundo branco', xadrez: 'xadrez desenhado no fundo (transparência falsa)', liso: 'fundo de uma cor' }[a.fundo?.tipo] || '';
    const el = h(`<div class="fl-card">
      <div class="fl-prev"><canvas data-prev></canvas></div>
      <div class="fl-op">
        <div class="fl-nome" title="${esc(a.file.name)}">${esc(a.nome)}</div>
        <div class="fl-tags">${it.folha ? `<span>${ic('layers', 11)} folha com <b data-n>${it.n}</b> peças</span>` : ''}${it.pares ? `<span>${ic('copy', 11)} pares juntados (um par de olhos = uma peça)</span>` : ''}${a.fundo ? `<span>${ic('image', 11)} ${fundoTxt}</span>` : ''}${it.tam ? `<span>${ic('crop', 11)} tamanho diferente</span>` : ''}</div>
        ${it.folha ? `<label class="chk"><input type="checkbox" data-sep ${it.separar ? 'checked' : ''}> Separar as peças</label>
        <div class="fl-sub" data-subsep>
          <label class="fl-range">Juntar pedaços próximos <input type="range" data-gap min="0" max="${a.gapMax}" value="${a.gap}"><output data-gapv></output></label>
          <div class="fl-dica">Puxe para a direita se um olho do par, um cílio ou um detalhe virou peça separada; para a esquerda se duas peças ficaram juntas.</div>
          <label class="chk"><input type="radio" name="m${it.i}" value="versoes" ${it.modo === 'versoes' ? 'checked' : ''}> <span><b>Versões</b> — cada peça vira uma imagem própria (olhos, bocas, poses de braço…)</span></label>
          <label class="chk"><input type="radio" name="m${it.i}" value="montado" ${it.modo === 'montado' ? 'checked' : ''}> <span><b>Corpo desmontado</b> — cada peça fica no lugar em que está na folha</span></label>
          <label class="chk"><input type="checkbox" data-tira ${it.tirarFolha ? 'checked' : ''}> Tirar a folha inteira depois de separar <small>(desmarcado, ela também entra)</small></label>
        </div>` : ''}
        ${a.fundo ? `<label class="chk"><input type="checkbox" data-fundo checked> Tirar o fundo</label>` : ''}
        ${it.tam ? `<label class="chk"><input type="checkbox" data-aj ${it.ajustar ? 'checked' : ''}> Ajustar o tamanho para combinar com <b>${esc(ref?.nome || 'a referência')}</b></label>
        <div class="fl-sub" data-subaj>
          <label class="fl-range">Tamanho <input type="range" data-s min="25" max="250" value="${Math.round(it.s * 100)}"><output data-sv></output></label>
          <div class="fl-ad"><canvas data-ad></canvas></div>
          <div class="fl-dica">Medido pela grossura do contorno preto. Compare as linhas: no “depois” elas devem ficar da mesma grossura da referência.</div>
        </div>` : ''}
      </div></div>`);
    const prev = $('[data-prev]', el), ad = $('[data-ad]', el);
    const desenhaPrev = () => {
      const gs = it.folha ? this.agrupa(a, a.gap) : [], k = Math.min(280 / a.W, 260 / a.H), w = Math.round(a.W * k), hh = Math.round(a.H * k);
      prev.width = w * 2; prev.height = hh * 2; prev.style.width = w + 'px'; prev.style.height = hh + 'px'; const c = prev.getContext('2d'); c.scale(2, 2);
      c.drawImage(it.fundo || !a.fundo ? a.cv : (a.cvOrig || a.cv), 0, 0, w, hh);
      if (it.folha && it.separar) { c.lineWidth = 1.2; c.font = 'bold 10px system-ui,sans-serif';
        gs.forEach((G, j) => { const x = G.x0 * k - 1, y = G.y0 * k - 1, gw = (G.x1 - G.x0) * k + 2, gh = (G.y1 - G.y0) * k + 2; c.strokeStyle = '#4ea1ff'; c.setLineDash([3, 2]); c.strokeRect(x, y, gw, gh); c.setLineDash([]);
          const tx = String(j + 1), tw = c.measureText(tx).width + 6; c.fillStyle = '#4ea1ff'; c.fillRect(x, y, tw, 13); c.fillStyle = '#fff'; c.fillText(tx, x + 3, y + 10); }); }
      const nb = $('[data-n]', el); if (nb) nb.textContent = gs.length; const gv = $('[data-gapv]', el); if (gv) gv.textContent = a.gap + ' px';
    };
    // antes e depois lado a lado com a referência, todos na mesma escala de tela
    const desenhaAD = () => { if (!ad) return; const s = it.s, rcv = ref?.cv || (ref?.a ? this.maior(ref.a) : null), p = this.maior(a), lado = [];
      if (rcv) lado.push({ cv: rcv, s: ref.k || 1, t: 'Referência' }); lado.push({ cv: p, s: 1, t: 'Antes' }, { cv: p, s, t: 'Depois' });
      const altMax = Math.max(...lado.map(l => l.cv.height * l.s)), gap = 14, larg = Math.max(200, (ad.parentElement?.clientWidth || 340) - 8) - gap * (lado.length + 1), k = Math.min(150 / altMax, 1, larg / lado.reduce((t, l) => t + l.cv.width * l.s, 0)); let wt = gap; lado.forEach(l => wt += Math.max(60, l.cv.width * l.s * k) + gap);
      const hh = Math.round(altMax * k) + 22; ad.width = wt * 2; ad.height = hh * 2; ad.style.width = wt + 'px'; ad.style.height = hh + 'px';
      const c = ad.getContext('2d'); c.scale(2, 2); c.font = '11px system-ui,sans-serif'; c.textAlign = 'center'; let x = gap;
      for (const l of lado) { const w = l.cv.width * l.s * k, h2 = l.cv.height * l.s * k, cw = Math.max(60, w); c.drawImage(l.cv, x + (cw - w) / 2, altMax * k - h2, w, h2);
        c.fillStyle = l.t === 'Depois' ? '#7fd17f' : '#aaa'; c.fillText(l.t, x + cw / 2, altMax * k + 15); x += cw + gap; }
      const sv = $('[data-sv]', el); if (sv) sv.textContent = Math.round(s * 100) + '%'; };
    const liga = (sel, fn) => { const e = $(sel, el); if (e) e.oninput = e.onchange = () => { fn(e); desenhaPrev(); }; };
    liga('[data-sep]', e => { it.separar = e.checked; $('[data-subsep]', el).hidden = !e.checked; });
    liga('[data-gap]', e => { a.gap = +e.value; });
    liga('[data-tira]', e => { it.tirarFolha = e.checked; });
    $$(`input[name="m${it.i}"]`, el).forEach(e => e.onchange = () => { if (e.checked) it.modo = e.value; });
    liga('[data-fundo]', e => { it.fundo = e.checked; });
    liga('[data-aj]', e => { it.ajustar = e.checked; $('[data-subaj]', el).hidden = !e.checked; });
    const sR = $('[data-s]', el); if (sR) sR.oninput = () => { it.s = +sR.value / 100; desenhaAD(); };
    requestAnimationFrame(() => { desenhaPrev(); desenhaAD(); }); return el;
  },

  // referência de tamanho a partir de uma imagem que já está no personagem
  refDaImagem(img, nome) {
    const bm = img && Arq.img.get(img.k); if (!bm) return null;
    const cv = new OffscreenCanvas(bm.width, bm.height), c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(bm, 0, 0);
    const e = this.espessura(c.getImageData(0, 0, bm.width, bm.height).data, bm.width, bm.height); if (!e) return null;
    const k = img.w / bm.width; return { esp: e * k, cv, k, nome };
  },
};
