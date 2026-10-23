/* ===================== vetor.js — PNG → SVG fiel (e o modelo do SVG do Ateliê) =====================
   CONVERTER: desenho chapado de contorno preto vira vetor com DUAS camadas separadas:
     • "Cor": cada área fechada pelo traço com UMA cor (o degradê/ruído do PNG some), indo por baixo da linha até o meio dela
       (apagar a linha mostra a cor, não um buraco; nunca sobra fresta branca entre a cor e o traço);
     • "Linha": o traço, com a borda de meio-pixel (a grossura bate com o PNG).
     Antes: limpa o recorte (fresta branca de fundo presa entre partes vira transparente com borda lisa; fiapo solto do traço sai).
   MODELO: { W, H, off:{x,y} (recorte), cam:[{ id, nome, papel:'cor'|'linha', vis, op, tr (matriz), clip, b (desfoque),
     f:[formas {d, c, o, r (evenodd), b, cl (corte)}], m:[apagados {d, o, r, b}] }] } ⇄ SVG (data-animador="vetor").
   A imagem SVG é desenhada como <img> de SVG: o navegador pinta o vetor no tamanho da tela (zoom sem perder qualidade). */
'use strict';
const Vetor = {
    // PNG → modelo vetorial com DUAS camadas: "Cor" (as áreas, que vão por baixo da linha até o meio dela) e "Linha" (o traço)
  dePixels(D0, W, H, o = {}) {
    const D = new Uint8ClampedArray(D0); if (o.limpa !== false) { const z = this.limpa(D, W, H, o); if (z) o = { ...o, zona: z, zW: W }; }
    const N = W * H, A = new Uint8Array(N); for (let i = 0; i < N; i++) A[i] = D[i * 4 + 3];
    const rgb = i => [D[i * 4], D[i * 4 + 1], D[i * 4 + 2]], L = i => .299 * D[i * 4] + .587 * D[i * 4 + 1] + .114 * D[i * 4 + 2];
    // ---- 1) o TRAÇO: a cor dos pixels bem escuros ----
    let s = [0, 0, 0], n = 0; for (let i = 0; i < N; i++) if (A[i] > 250 && L(i) < 45) { s[0] += D[i * 4]; s[1] += D[i * 4 + 1]; s[2] += D[i * 4 + 2]; n++; }
    const tinta = n ? s.map(v => v / n) : [17, 17, 17], tL = this.L(tinta);
    // ---- 2) REGIÕES: pedaços ligados de cor (o traço separa; mudança forte de cor também), cada uma com UMA cor ----
    const claro = new Uint8Array(N); for (let i = 0; i < N; i++) claro[i] = A[i] > 128 && L(i) > tL + (o.limiar ?? 70) ? 1 : 0; // claramente não é traço
    const reg = new Int32Array(N).fill(-1), regs = [], tol = o.tol ?? 34, pilha = [];
    for (let s0 = 0; s0 < N; s0++) { if (!claro[s0] || reg[s0] >= 0) continue; const id = regs.length, px = []; reg[s0] = id; pilha.push(s0);
      while (pilha.length) { const i = pilha.pop(), x = i % W; px.push(i);
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) { if (j < 0 || j >= N || reg[j] >= 0 || !claro[j]) continue;
          if (Math.abs(D[j * 4] - D[i * 4]) + Math.abs(D[j * 4 + 1] - D[i * 4 + 1]) + Math.abs(D[j * 4 + 2] - D[i * 4 + 2]) > tol) continue;
          if (Math.abs(D[j * 4] - D[s0 * 4]) + Math.abs(D[j * 4 + 1] - D[s0 * 4 + 1]) + Math.abs(D[j * 4 + 2] - D[s0 * 4 + 2]) > (o.tolSemente ?? 70)) continue; // não escorre aos poucos para outra cor (blush na pele)
          reg[j] = id; pilha.push(j); } }
      regs.push({ px }); }
    // cor de cada região = mediana dos pixels dela (só os do miolo: longe do traço)
    const med = L0 => { const r = L0.map(i => D[i * 4]).sort((a, b) => a - b), g = L0.map(i => D[i * 4 + 1]).sort((a, b) => a - b), b = L0.map(i => D[i * 4 + 2]).sort((a, b) => a - b), m = L0.length >> 1; return [r[m], g[m], b[m]]; };
    for (const [id, R] of regs.entries()) { const miolo = R.px.filter(i => { const x = i % W; return x > 0 && x < W - 1 && reg[i - 1] === id && reg[i + 1] === id && reg[i - W] === id && reg[i + W] === id; });
      // região FINA (só borda, sem miolo: o anel cinza entre o branco e o traço) não é cor de verdade: some e vira mistura
      if (miolo.length < Math.max(3, R.px.length * .12)) { for (const i of R.px) { reg[i] = -1; claro[i] = 0; } R.px = null; R.n = 0; continue; }
      R.c = med(miolo); R.n = R.px.length; }
    // regiões minúsculas (pó da mistura entre duas cores) somem: os pixels delas vão para a vizinha maior
    const min = o.min ?? 14;
    for (let it = 0; it < 3; it++) for (const [id, R] of regs.entries()) { if (!R.px || !R.n || R.n >= min) continue; const viz = new Map();
      for (const i of R.px) { const x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) { if (j < 0 || j >= N) continue; const v = reg[j]; if (v >= 0 && v !== id && regs[v].px && regs[v].n >= min) viz.set(v, (viz.get(v) || 0) + 1); } }
      if (!viz.size) continue; let b = -1, bn = -1; for (const [v, c] of viz) if (c > bn) { bn = c; b = v; } for (const i of R.px) reg[i] = b; regs[b].px.push(...R.px); regs[b].n += R.n; R.px = null; R.n = 0; }
    // regiões ENCOSTADAS (sem traço no meio) de cor parecida são a mesma área com degradê do PNG: juntam (senão vira mancha)
    { const pai = regs.map((_, i) => i), raiz = i => { while (pai[i] !== i) i = pai[i] = pai[pai[i]]; return i; }, enc = new Map();
      for (let i = 0; i < N; i++) { const a = reg[i]; if (a < 0) continue; const x = i % W; for (const j of [x < W - 1 ? i + 1 : -1, i + W < N ? i + W : -1]) { if (j < 0) continue; const b = reg[j]; if (b < 0 || b === a) continue; const k = a < b ? a + ',' + b : b + ',' + a; enc.set(k, (enc.get(k) || 0) + 1); } }
      for (const [k, c] of enc) { if (c < 3) continue; const [a, b] = k.split(',').map(Number); if (!regs[a].px || !regs[b].px) continue; if (this.dist(regs[a].c, regs[b].c) < (o.juntaVizinha ?? 38)) pai[raiz(a)] = raiz(b); }
      for (const [id, R] of regs.entries()) { if (!R.px) continue; const r = raiz(id); if (r === id) continue; const Q = regs[r]; if (!Q.px) continue; const t = Q.n + R.n; Q.c = Q.c.map((v, k) => (v * Q.n + R.c[k] * R.n) / t); Q.n = t; Q.px.push(...R.px); for (const i of R.px) reg[i] = r; R.px = null; R.n = 0; } }
    // FIAPOS de região: a parte fina (≤ 4 px) de uma área, que escorreu pela borda do traço até outra (a pele contornando o
    // triângulo da manga): sai da região e vira pixel de borda, que depois pega a cor que melhor explica ele
    { const rr = o.fiapoReg ?? 2, M = new Uint8Array(N), E = new Int32Array(N).fill(-1);
      for (let i = 0; i < N; i++) M[i] = reg[i] >= 0 ? 1 : 0;
      // erosão por região (vizinho de outra região conta como borda)
      let cur = Int32Array.from(reg); for (let k = 0; k < rr; k++) { const nx = new Int32Array(N).fill(-1); for (let i = 0; i < N; i++) { const r = cur[i]; if (r < 0) continue; const x = i % W; if (x > 0 && x < W - 1 && i >= W && i + W < N && cur[i - 1] === r && cur[i + 1] === r && cur[i - W] === r && cur[i + W] === r && cur[i - W - 1] === r && cur[i - W + 1] === r && cur[i + W - 1] === r && cur[i + W + 1] === r) nx[i] = r; } cur = nx; }
      // dilatação de volta, só dentro da própria região
      for (let k = 0; k < rr; k++) { const nx = Int32Array.from(cur); for (let i = 0; i < N; i++) { const r = cur[i]; if (r < 0) continue; const x = i % W; for (const j of [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1]) if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1 && reg[j] === r) nx[j] = r; } cur = nx; }
      const nucleo = new Int32Array(regs.length); for (let i = 0; i < N; i++) if (cur[i] >= 0) nucleo[cur[i]]++;
      const vis = new Uint8Array(N); // cada pedaço fino: só sai se for pequeno perto do miolo da área (a argola inteira fina fica)
      for (let s0 = 0; s0 < N; s0++) { const r = reg[s0]; if (r < 0 || cur[s0] === r || vis[s0]) continue; const px = [s0], st = [s0]; vis[s0] = 1;
        while (st.length) { const i = st.pop(), x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < N && !vis[j] && reg[j] === r && cur[j] !== r) { vis[j] = 1; px.push(j); st.push(j); } }
        if (px.length * 4 >= nucleo[r]) continue;
        let outra = false; for (const i of px) { const x0 = i % W, y0 = (i / W) | 0; for (let yy = Math.max(0, y0 - 3); yy <= Math.min(H - 1, y0 + 3) && !outra; yy++) for (let xx = Math.max(0, x0 - 3); xx <= Math.min(W - 1, x0 + 3); xx++) { const q = yy * W + xx; if (reg[q] >= 0 && reg[q] !== r && regs[reg[q]].n >= min) { outra = true; break; } } if (outra) break; }
        if (outra) for (const i of px) { reg[i] = -1; claro[i] = 0; } } } // só quando encosta noutra cor (o fiapo que escorreu); fino sozinho fica
    // ---- 3) PALETA: regiões de cor quase igual viram a mesma cor (o cabelo inteiro igual em todo lugar) ----
    const vivas = regs.map((R, id) => ({ R, id })).filter(x => x.R.px && x.R.n).sort((a, b) => b.R.n - a.R.n), pal = [], corDe = new Int32Array(regs.length).fill(-1);
    for (const { R, id } of vivas) { let j = pal.findIndex(q => this.dist(q.c, R.c) < (o.junta ?? 22)); if (j < 0) { j = pal.length; pal.push({ c: [...R.c], n: 0 }); } const q = pal[j], t = q.n + R.n; q.c = q.c.map((v, k) => (v * q.n + R.c[k] * R.n) / t); q.n = t; corDe[id] = j; }
    // ---- 4) os pixels do meio (borda do traço, misturados): vão para a região vizinha mais parecida, e ganham a COBERTURA (0..1) ----
    // cobertura = quanto do pixel é cor (e não traço): projeção na reta traço→cor
    const lab = new Int32Array(N).fill(-1), cob = new Float32Array(N);
    for (let i = 0; i < N; i++) if (reg[i] >= 0) { lab[i] = corDe[reg[i]]; cob[i] = 1; }
    // espalha as regiões para dentro do traço (até 6 px), para cada pixel de borda saber de que cor é a área do lado
    let frente = []; for (let i = 0; i < N; i++) if (lab[i] >= 0) frente.push(i);
    for (let passo = 0; passo < (o.alcance ?? 6) && frente.length; passo++) { const nova = [];
      for (const i of frente) { const x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) { if (j < 0 || j >= N || lab[j] >= 0 || A[j] < 8) continue; lab[j] = lab[i]; nova.push(j);
        const c = pal[lab[j]].c, v = [c[0] - tinta[0], c[1] - tinta[1], c[2] - tinta[2]], vv = v[0] * v[0] + v[1] * v[1] + v[2] * v[2] || 1, p = rgb(j);
        cob[j] = Math.max(0, Math.min(1, ((p[0] - tinta[0]) * v[0] + (p[1] - tinta[1]) * v[1] + (p[2] - tinta[2]) * v[2]) / vv)); } }
      frente = nova; }
    // pixels de BORDA que ficaram com a cor errada (a ponta fina de uma faixa some como região e a vizinha a invade
    // pelo traço): cada um fica com a cor da paleta que melhor explica a mistura traço↔cor dele
    { const erro = (p, c) => { const v = [c[0] - tinta[0], c[1] - tinta[1], c[2] - tinta[2]], vv = v[0] * v[0] + v[1] * v[1] + v[2] * v[2] || 1;
        const t = Math.max(0, Math.min(1, ((p[0] - tinta[0]) * v[0] + (p[1] - tinta[1]) * v[1] + (p[2] - tinta[2]) * v[2]) / vv));
        const e = [tinta[0] + t * v[0] - p[0], tinta[1] + t * v[1] - p[1], tinta[2] + t * v[2] - p[2]]; return [e[0] * e[0] + e[1] * e[1] + e[2] * e[2], t]; };
      for (let i = 0; i < N; i++) { if (reg[i] >= 0 || lab[i] < 0 || A[i] < 128 || cob[i] < .2) continue; const x0 = i % W, y0 = (i / W) | 0; let junto = false; // encostado na própria área (até 2 px): a cor dela vale, sem trocar
        for (let yy = Math.max(0, y0 - 2); yy <= Math.min(H - 1, y0 + 2) && !junto; yy++) for (let xx = Math.max(0, x0 - 2); xx <= Math.min(W - 1, x0 + 2); xx++) { const q = yy * W + xx; if (reg[q] >= 0 && corDe[reg[q]] === lab[i]) { junto = true; break; } }
        if (junto) continue; const p = rgb(i); let [be, bt] = erro(p, pal[lab[i]].c), bj = lab[i]; be *= .8;
        const perto = new Set(); { const x0 = i % W, y0 = (i / W) | 0; for (let yy = Math.max(0, y0 - 6); yy <= Math.min(H - 1, y0 + 6); yy++) for (let xx = Math.max(0, x0 - 6); xx <= Math.min(W - 1, x0 + 6); xx++) { const q = yy * W + xx; if (reg[q] >= 0) perto.add(corDe[reg[q]]); } }
        for (const j of perto) { if (j === bj || j < 0) continue; const [e, t] = erro(p, pal[j].c); if (e < be) { be = e; bt = t; bj = j; } }
        if (bj !== lab[i]) { lab[i] = bj; cob[i] = bt; } } }
    // ÁREA FECHADA = UMA COR: dentro de cada área entre traços, cores quase iguais (ruído/degradê do PNG numa argola fina)
    // viram a cor que mais aparece ali (blush e outras cores bem diferentes ficam)
    { const fe = new Int32Array(N).fill(-1); let nc = 0; const ok = i => lab[i] >= 0 && cob[i] >= .5;
      for (let s0 = 0; s0 < N; s0++) { if (!ok(s0) || fe[s0] >= 0) continue; const px = [s0], st = [s0]; fe[s0] = nc;
        while (st.length) { const i = st.pop(), x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < N && fe[j] < 0 && ok(j)) { fe[j] = nc; px.push(j); st.push(j); } }
        const cnt = new Map(); for (const i of px) cnt.set(lab[i], (cnt.get(lab[i]) || 0) + 1);
        if (cnt.size > 1) { const ord = [...cnt].sort((a, b) => b[1] - a[1]), troca = new Map();
          for (const [j, c] of ord.slice(1)) { const M = ord.find(([k, ck]) => ck > c && this.dist(pal[k].c, pal[j].c) < (o.juntaArea ?? 45)); if (M) troca.set(j, M[0]); }
          if (troca.size) { const dent = new Set(px); for (const i of px) { const t = troca.get(lab[i]); if (t !== undefined) lab[i] = t; }
            // a borda (pixels de mistura em volta) acompanha
            for (const i of px) { const x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < N && !dent.has(j) && lab[j] >= 0) { const t = troca.get(lab[j]); if (t !== undefined) lab[j] = t; } } } }
        nc++; } }

    // ---- 5) CAMADAS: Cor (embaixo) e Linha (em cima), separadas ----
    // cada pixel opaco ganha a cor da área mais perto (por baixo do traço também): apagar a linha mostra a cor, não um buraco
    const tudo = Int32Array.from(lab); { let fr = []; for (let i = 0; i < N; i++) if (tudo[i] >= 0) fr.push(i);
      while (fr.length) { const nv = []; for (const i of fr) { const x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) { if (j < 0 || j >= N || tudo[j] >= 0 || A[j] < 8) continue; tudo[j] = tudo[i]; nv.push(j); } } fr = nv; } }
    const hex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
    // a LINHA: onde o pixel é mais traço que cor (cobertura < meio), com a borda de meio-pixel
    const g = new Float32Array(N); for (let i = 0; i < N; i++) g[i] = A[i] / 255 * (lab[i] >= 0 ? 1 - cob[i] : 1);
    const cores = [], ordem = pal.map((p, j) => j).sort((a, b) => pal[b].n - pal[a].n), naFrente = new Uint8Array(pal.length).fill(1);
    for (const c of ordem) { // cada cor cobre também as áreas das que vêm depois (nunca fica fresta entre duas cores)
      const f = new Float32Array(N); for (let i = 0; i < N; i++) { const l = tudo[i]; if (l >= 0 && naFrente[l]) f[i] = A[i] / 255; }
      const d = this.caminho(this.contornos(f, W, H, .62), { ...o, zonaSo: true }); if (d) cores.push({ d, c: hex(pal[c].c), r: 1 });
      naFrente[c] = 0; }
    const dl = this.caminho(this.contornos(g, W, H, .5), o);
    const cam = [{ id: 'cor', nome: 'Cor', papel: 'cor', f: cores, m: [] }, { id: 'linha', nome: 'Linha', papel: 'linha', f: dl ? [{ d: dl, c: hex(tinta), r: 1 }] : [], m: [] }];
    return { W, H, off: { x: 0, y: 0 }, cam, cores: [hex(tinta), ...pal.map(p => hex(p.c))] };
  },
  // LIMPEZA do recorte (antes de tudo): fresta branca de fundo que ficou presa entre partes (entre o braço e o corpo)
  // vira transparente, e a borda dela vira traço limpo; pontinha solta de traço para fora da silhueta sai
  limpa(D, W, H, o = {}) {
    const N = W * H, A = i => D[i * 4 + 3], viz4 = (i, f) => { const x = i % W; if (x > 0) f(i - 1); if (x < W - 1) f(i + 1); if (i >= W) f(i - W); if (i + W < N) f(i + W); };
    const Lp = i => .299 * D[i * 4] + .587 * D[i * 4 + 1] + .114 * D[i * 4 + 2];
    let s = [0, 0, 0], n = 0; for (let i = 0; i < N; i++) if (A(i) > 250 && Lp(i) < 45) { s[0] += D[i * 4]; s[1] += D[i * 4 + 1]; s[2] += D[i * 4 + 2]; n++; }
    const tinta = n ? s.map(v => v / n) : [17, 17, 17], tL = this.L(tinta);
    // 1) frestas brancas: pedaço branco (sem cor) FINO e comprido, ou fino e encostado no transparente
    const br = new Uint8Array(N); for (let i = 0; i < N; i++) { const r = D[i * 4], g = D[i * 4 + 1], b = D[i * 4 + 2], mn = Math.min(r, g, b); br[i] = A(i) > 100 && mn > 205 && Math.max(r, g, b) - mn < 30 ? 1 : 0; }
    // grossura (distância até a borda do pedaço, chanfro 2 passadas)
    const ds = new Float32Array(N); for (let i = 0; i < N; i++) ds[i] = br[i] ? 1e9 : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!br[i]) continue; let v = ds[i]; if (x > 0) v = Math.min(v, ds[i - 1] + 1); else v = 1; if (y > 0) v = Math.min(v, ds[i - W] + 1); else v = 1; ds[i] = v; }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!br[i]) continue; let v = ds[i]; if (x < W - 1) v = Math.min(v, ds[i + 1] + 1); else v = 1; if (y < H - 1) v = Math.min(v, ds[i + W] + 1); else v = 1; ds[i] = v; }
    const vis = new Uint8Array(N), tira = new Uint8Array(N);
    for (let s0 = 0; s0 < N; s0++) { if (!br[s0] || vis[s0]) continue; const px = [s0], pilha = [s0]; vis[s0] = 1; let dm = 0, toca = false;
      while (pilha.length) { const i = pilha.pop(); dm = Math.max(dm, ds[i]); viz4(i, j => { if (A(j) < 40) toca = true; if (br[j] && !vis[j]) { vis[j] = 1; px.push(j); pilha.push(j); } }); }
      if ((dm <= 4 && px.length / (dm * dm) > 10) || (toca && dm <= 3)) for (const i of px) tira[i] = 1; }
    // 2) pontinhas soltas: o que some ao "abrir" a silhuta (raio 2) e forma um fiapo de verdade
    const M = new Uint8Array(N); for (let i = 0; i < N; i++) M[i] = A(i) >= 128 && !tira[i] ? 1 : 0;
    const erode = (S, r) => { let a = S; for (let k = 0; k < r; k++) { const b = new Uint8Array(N); for (let i = 0; i < N; i++) { if (!a[i]) continue; const x = i % W; b[i] = x > 0 && x < W - 1 && i >= W && i + W < N && a[i - 1] && a[i + 1] && a[i - W] && a[i + W] && a[i - W - 1] && a[i - W + 1] && a[i + W - 1] && a[i + W + 1] ? 1 : 0; } a = b; } return a; };
    const dilata = (S, r) => { let a = S; for (let k = 0; k < r; k++) { const b = new Uint8Array(a); for (let i = 0; i < N; i++) { if (!a[i]) continue; const x = i % W; for (const j of [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1]) if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1) b[j] = 1; } a = b; } return a; };
    const r = o.fiapo ?? 4, ab = dilata(erode(M, r), r), sob = new Uint8Array(N); for (let i = 0; i < N; i++) sob[i] = M[i] && !ab[i] ? 1 : 0;
    const vs = new Uint8Array(N); for (let s0 = 0; s0 < N; s0++) { if (!sob[s0] || vs[s0]) continue; const px = [s0], pilha = [s0]; vs[s0] = 1;
      while (pilha.length) { const i = pilha.pop(); viz4(i, j => { if (sob[j] && !vs[j]) { vs[j] = 1; px.push(j); pilha.push(j); } }); }
      let enc = 0; for (const i of px) { let t = false; viz4(i, j => { if (ab[j]) t = true; }); if (t) enc++; } // presa por uma base estreita = fiapo (canto arredondado não)
      if (px.length >= (o.fiapoMin ?? 15) && px.length / Math.max(1, enc) >= 4) for (const i of px) tira[i] = 2; }
    // aplica: some, e a borda clara/meio-transparente em volta vira traço com a transparência certa
    for (let i = 0; i < N; i++) { if (tira[i] === 4) { D[i * 4] = tinta[0]; D[i * 4 + 1] = tinta[1]; D[i * 4 + 2] = tinta[2]; D[i * 4 + 3] = 255; } else if (tira[i]) D[i * 4 + 3] = 0; }
    for (let pass = 0; pass < (o.passosFresta ?? 12); pass++) for (let i = 0; i < N; i++) { if (tira[i] || !A(i)) continue; let perto = false, tr = false; viz4(i, j => { if (tira[j]) perto = true; if (tira[j] && tira[j] < 4) tr = true; }); if (!perto) continue;
      const r = D[i * 4], g = D[i * 4 + 1], b = D[i * 4 + 2], mn = Math.min(r, g, b), L = Lp(i); if (L < tL + 40) continue; // já é traço
      if (!(mn > 120 && Math.max(r, g, b) - mn < 45) && A(i) > 230) continue; // pele/roupa de verdade fica
      const t = tr ? Math.max(0, Math.min(1, (255 - L) / (255 - tL))) * A(i) / 255 : 1; tira[i] = tr ? 3 : 5; D[i * 4] = tinta[0]; D[i * 4 + 1] = tinta[1]; D[i * 4 + 2] = tinta[2]; D[i * 4 + 3] = Math.round(255 * t); }
    // ZONA LISA: em volta da fresta o PNG tem degraus (o recorte); ali o contorno é alisado com mais força (sem encolher)
    let tem = false; let z = new Uint8Array(N); for (let i = 0; i < N; i++) if (tira[i] === 1 || tira[i] === 3) { z[i] = 1; tem = true; }
    if (!tem) return null; for (let k = 0; k < (o.zonaR ?? 12); k++) { const b = new Uint8Array(z); for (let i = 0; i < N; i++) if (z[i]) viz4(i, j => { b[j] = 1; }); z = b; }
    return z;
  },
  L(c) { return .299 * c[0] + .587 * c[1] + .114 * c[2]; },
  dist(a, b) { return Math.sqrt(this.dist2(a, b)); }, dist2(a, b) { const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; },
  perto(C, p) { let b = 0, bd = Infinity; for (let i = 0; i < C.length; i++) { const d = this.dist2(C[i], p); if (d < bd) { bd = d; b = i; } } return b; },
  blur(f, W, H, s) { if (!s) return f; const r = Math.ceil(s * 2.5), k = []; let t = 0; for (let i = -r; i <= r; i++) { const v = Math.exp(-i * i / (2 * s * s)); k.push(v); t += v; } for (let i = 0; i < k.length; i++) k[i] /= t;
    const a = new Float32Array(W * H), b = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let i = -r; i <= r; i++) { const xx = Math.min(W - 1, Math.max(0, x + i)); v += f[y * W + xx] * k[i + r]; } a[y * W + x] = v; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let i = -r; i <= r; i++) { const yy = Math.min(H - 1, Math.max(0, y + i)); v += a[yy * W + x] * k[i + r]; } b[y * W + x] = v; }
    return b; },
  // marching squares: laços fechados (coordenadas em pixel, centro do pixel = x+.5)
  contornos(f, W, H, th) {
    const g = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : f[y * W + x];
    const segs = new Map(), add = (a, b) => { segs.set(a.k, { a, b }); };
    const P = (x, y, k) => ({ x, y, k });
    for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) {
      const v0 = g(x, y), v1 = g(x + 1, y), v2 = g(x + 1, y + 1), v3 = g(x, y + 1);
      const c = (v0 > th ? 8 : 0) | (v1 > th ? 4 : 0) | (v2 > th ? 2 : 0) | (v3 > th ? 1 : 0); if (c === 0 || c === 15) continue;
      const it = (a, b) => (th - a) / (b - a);
      const T = P(x + it(v0, v1) + .5, y + .5, `h${x},${y}`), R = P(x + 1.5, y + it(v1, v2) + .5, `v${x + 1},${y}`), B = P(x + it(v3, v2) + .5, y + 1.5, `h${x},${y + 1}`), L = P(x + .5, y + it(v0, v3) + .5, `v${x},${y}`);
      const m = (v0 + v1 + v2 + v3) / 4 > th;
      switch (c) { // orientado: dentro à direita
        case 1: add(B, L); break; case 2: add(R, B); break; case 3: add(R, L); break; case 4: add(T, R); break;
        case 5: if (m) { add(T, L); add(B, R); } else { add(T, R); add(B, L); } break;
        case 6: add(T, B); break; case 7: add(T, L); break; case 8: add(L, T); break; case 9: add(B, T); break;
        case 10: if (m) { add(L, B); add(R, T); } else { add(L, T); add(R, B); } break;
        case 11: add(R, T); break; case 12: add(L, R); break; case 13: add(B, R); break; case 14: add(L, B); break; }
    }
    const laços = [];
    while (segs.size) { const [k0, s0] = segs.entries().next().value; segs.delete(k0); const L = [s0.a]; let cur = s0.b;
      while (cur.k !== s0.a.k) { L.push(cur); const nx = segs.get(cur.k); if (!nx) break; segs.delete(cur.k); cur = nx.b; }
      if (L.length > 2) laços.push(L); }
    return laços;
  },
  // AJUSTE DE CURVAS (Schneider): um laço de pontos vira poucas Béziers dentro do erro pedido; quinas (> ~55°) ficam quinas
  ajustaLaço(L, erro, f) {
    const n = L.length; if (n < 4) return ''; let ar = 0; for (let i = 0; i < n; i++) { const p = L[i], q = L[(i + 1) % n]; ar += p.x * q.y - q.x * p.y; } if (Math.abs(ar) / 2 < .6) return '';
    const P = i => L[((i % n) + n) % n], sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }), nor = v => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
    const k = Math.max(2, Math.min(5, Math.floor(n / 8))), ang = i => { const u = sub(P(i), P(i - k)), v = sub(P(i + k), P(i)); const c = (u.x * v.x + u.y * v.y) / ((Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)) || 1); return Math.acos(Math.max(-1, Math.min(1, c))); };
    const A = L.map((_, i) => ang(i)), qu = []; for (let i = 0; i < n; i++) if (A[i] > .96) { let mx = true; for (let j = -k; j <= k; j++) if (j && A[((i + j) % n + n) % n] > A[i]) { mx = false; break; } if (mx && !qu.some(q => Math.abs(q - i) <= k)) qu.push(i); }
    let cortes = qu.slice(); const quina = new Set(qu);
    if (cortes.length < 2) { const i0 = cortes[0] ?? 0; let far = i0, fd = -1; for (let i = 0; i < n; i++) { const v = Math.hypot(L[i].x - L[i0].x, L[i].y - L[i0].y); if (v > fd) { fd = v; far = i; } } cortes = [...new Set([i0, far])].sort((a, b) => a - b); if (cortes.length < 2) return ''; }
    const tan = (i, lado) => quina.has(i) ? nor(lado > 0 ? sub(P(i + Math.min(3, k)), P(i)) : sub(P(i - Math.min(3, k)), P(i))) : (lado > 0 ? nor(sub(P(i + 1), P(i - 1))) : nor(sub(P(i - 1), P(i + 1))));
    const bez = []; for (let c = 0; c < cortes.length; c++) { const i0 = cortes[c], i1 = cortes[(c + 1) % cortes.length], m = ((i1 - i0) % n + n) % n || n, seg = []; for (let j = 0; j <= m; j++) seg.push(P(i0 + j)); bez.push(...this.fitCubic(seg, tan(i0, 1), tan(i1, -1), erro * erro)); }
    let d = `M${f(bez[0][0].x)} ${f(bez[0][0].y)}`; for (const b of bez) d += `C${f(b[1].x)} ${f(b[1].y)} ${f(b[2].x)} ${f(b[2].y)} ${f(b[3].x)} ${f(b[3].y)}`; return d + 'Z';
  },
  fitCubic(P, t1, t2, err, prof = 0) {
    const n = P.length, add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y }), sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }), mul = (a, s) => ({ x: a.x * s, y: a.y * s }), dot = (a, b) => a.x * b.x + a.y * b.y, dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    if (n === 2 || prof > 40) { const d = dist(P[0], P[n - 1]) / 3; return [[P[0], add(P[0], mul(t1, d)), add(P[n - 1], mul(t2, d)), P[n - 1]]]; }
    const ev = (b, t) => { const u = 1 - t; return { x: u * u * u * b[0].x + 3 * u * u * t * b[1].x + 3 * u * t * t * b[2].x + t * t * t * b[3].x, y: u * u * u * b[0].y + 3 * u * u * t * b[1].y + 3 * u * t * t * b[2].y + t * t * t * b[3].y }; };
    const gera = u => { let C00 = 0, C01 = 0, C11 = 0, X0 = 0, X1 = 0; const p0 = P[0], p3 = P[n - 1];
      for (let i = 0; i < n; i++) { const t = u[i], s = 1 - t, b0 = s * s * s, b1 = 3 * s * s * t, b2 = 3 * s * t * t, b3 = t * t * t, A1 = mul(t1, b1), A2 = mul(t2, b2); C00 += dot(A1, A1); C01 += dot(A1, A2); C11 += dot(A2, A2);
        const tmp = sub(P[i], add(add(mul(p0, b0 + b1), mul(p3, b2 + b3)), { x: 0, y: 0 })); X0 += dot(A1, tmp); X1 += dot(A2, tmp); }
      const det = C00 * C11 - C01 * C01, al = det ? (X0 * C11 - X1 * C01) / det : 0, ar = det ? (C00 * X1 - C01 * X0) / det : 0, seg = dist(p0, p3), e = 1e-6 * seg;
      if (al < e || ar < e || al > seg * 3 || ar > seg * 3) { const d = seg / 3; return [p0, add(p0, mul(t1, d)), add(p3, mul(t2, d)), p3]; } return [p0, add(p0, mul(t1, al)), add(p3, mul(t2, ar)), p3]; };
    const erroMax = (b, u) => { let me = 0, sp = n >> 1; for (let i = 1; i < n - 1; i++) { const q = ev(b, u[i]), d = (q.x - P[i].x) ** 2 + (q.y - P[i].y) ** 2; if (d >= me) { me = d; sp = i; } } return [me, sp]; };
    const newton = (b, p, t) => { const s = 1 - t, q = ev(b, t), q1 = { x: 3 * (s * s * (b[1].x - b[0].x) + 2 * s * t * (b[2].x - b[1].x) + t * t * (b[3].x - b[2].x)), y: 3 * (s * s * (b[1].y - b[0].y) + 2 * s * t * (b[2].y - b[1].y) + t * t * (b[3].y - b[2].y)) },
      q2 = { x: 6 * (s * (b[2].x - 2 * b[1].x + b[0].x) + t * (b[3].x - 2 * b[2].x + b[1].x)), y: 6 * (s * (b[2].y - 2 * b[1].y + b[0].y) + t * (b[3].y - 2 * b[2].y + b[1].y)) }, num = (q.x - p.x) * q1.x + (q.y - p.y) * q1.y, den = q1.x * q1.x + q1.y * q1.y + (q.x - p.x) * q2.x + (q.y - p.y) * q2.y; return den ? Math.max(0, Math.min(1, t - num / den)) : t; };
    let u = [0]; for (let i = 1; i < n; i++) u.push(u[i - 1] + dist(P[i], P[i - 1])); const tot = u[n - 1] || 1; u = u.map(v => v / tot);
    let b = gera(u), [me, sp] = erroMax(b, u); if (me < err) return [b];
    if (me < err * 9) for (let it = 0; it < 12; it++) { u = u.map((t, i) => newton(b, P[i], t)); b = gera(u); [me, sp] = erroMax(b, u); if (me < err) return [b]; }
    sp = Math.max(1, Math.min(n - 2, sp)); const tc = (() => { const v = sub(P[sp - 1], P[sp + 1]), l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; })();
    return [...this.fitCubic(P.slice(0, sp + 1), t1, tc, err, prof + 1), ...this.fitCubic(P.slice(sp), { x: -tc.x, y: -tc.y }, t2, err, prof + 1)];
  },
  rdp(P, eps) { if (P.length < 3) return P; const a = P[0], b = P[P.length - 1]; let mi = -1, md = 0; const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    for (let i = 1; i < P.length - 1; i++) { const d = Math.abs((P[i].x - a.x) * dy - (P[i].y - a.y) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md <= eps) return [a, b]; return [...this.rdp(P.slice(0, mi + 1), eps).slice(0, -1), ...this.rdp(P.slice(mi), eps)]; },
  caminho(laços, o = {}) {
    const eps = o.eps ?? .35, f = v => (Math.round(v * 100) / 100).toString(); let d = '';
    for (let L0 of laços) { if (L0.length < 4) continue;
      // laço fechado: corta no ponto mais longe do primeiro para o rdp não engolir
      // suaviza os pontos (média com os vizinhos, poucas vezes): tira a escadinha sem comer as pontas finas
      let Ls = L0; for (let r = 0; r < (o.alisa ?? 3); r++) { const m = Ls.length; Ls = Ls.map((p, i) => { const a = Ls[(i - 1 + m) % m], b = Ls[(i + 1) % m]; return { x: p.x * .5 + (a.x + b.x) * .25, y: p.y * .5 + (a.y + b.y) * .25 }; }); }
      L0 = Ls;
      // na zona lisa (em volta de fresta tirada): Taubin (alisa forte sem encolher) só nos pontos de lá
      if (o.zona) { const Z = o.zona, zW = o.zW, m = L0.length, mv = L0.map(p => Z[Math.floor(p.y) * zW + Math.floor(p.x)] ? 1 : 0);
        if (mv.some(Boolean)) { let Q = L0; for (let r = 0; r < (o.lisoZona ?? 250); r++) for (const lam of (o.zonaSo || mv.every(Boolean) ? [.5, -.53] : [.5])) { Q = Q.map((p, i) => { if (!mv[i]) return p; const a = Q[(i - 1 + m) % m], b = Q[(i + 1) % m]; return { x: p.x + lam * ((a.x + b.x) / 2 - p.x), y: p.y + lam * ((a.y + b.y) / 2 - p.y) }; }); } L0 = Q; } }
      if (o.mapa) L0 = L0.map(o.mapa); // pixels da imagem → espaço da camada
      if (o.ajuste !== false) { const dd = this.ajustaLaço(L0, o.erro ?? eps * 1.3, f); if (dd) d += dd; continue; } // curvas ajustadas (poucos pontos, fáceis de mexer)
      let far = 0, fd = -1; for (let i = 0; i < L0.length; i++) { const v = Math.hypot(L0[i].x - L0[0].x, L0[i].y - L0[0].y); if (v > fd) { fd = v; far = i; } }
      const A = this.rdp(L0.slice(0, far + 1), eps), B = this.rdp([...L0.slice(far), L0[0]], eps), P = [...A.slice(0, -1), ...B.slice(0, -1)]; const n = P.length; if (n < 3) continue;
      // área minúscula: pula
      let ar = 0; for (let i = 0; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; ar += p.x * q.y - q.x * p.y; } if (Math.abs(ar) / 2 < .6) continue;
      d += `M${f(P[0].x)} ${f(P[0].y)}`;
      // Catmull-Rom (tensão 1/6) → Bézier cúbica; canto agudo (> ~70°) fica reto para não arredondar demais
      for (let i = 0; i < n; i++) { const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
        const ang = (a, b, c) => { const u = [b.x - a.x, b.y - a.y], v = [c.x - b.x, c.y - b.y]; return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / ((Math.hypot(...u) * Math.hypot(...v)) || 1)))); };
        const k1 = ang(p0, p1, p2) > 1.2 ? 0 : 1 / 6, k2 = ang(p1, p2, p3) > 1.2 ? 0 : 1 / 6;
        const c1 = { x: p1.x + (p2.x - p0.x) * k1, y: p1.y + (p2.y - p0.y) * k1 }, c2 = { x: p2.x - (p3.x - p1.x) * k2, y: p2.y - (p3.y - p1.y) * k2 };
        d += `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`; }
      d += 'Z'; }
    return d;
  },

  /* ---------- tipo do arquivo (selos PNG / SVG / JPG) ---------- */
  eh(k) { return /\.svg$/i.test(typeof k === 'string' ? k : k?.k || ''); },
  tipo(k) { const e = (/\.([a-z0-9]+)$/i.exec(k || '') || [])[1]?.toLowerCase() || ''; return e === 'jpeg' ? 'JPG' : e ? e.toUpperCase() : ''; },
  tipos(ks) { const o = ['SVG', 'PNG', 'JPG', 'WEBP', 'GIF']; return [...new Set(ks.map(k => this.tipo(k)).filter(Boolean))].sort((a, b) => o.indexOf(a) - o.indexOf(b)); },
  // tipos das imagens de um personagem (só as imagens das partes: máscaras de keyframe e camadas não contam)
  tiposDef(def) { try { return this.tipos(Modelo.todasPartes(def).flatMap(p => (p.imgs || []).map(i => i.k))); } catch { return []; } },
  // selo: SVG roxo, PNG/JPG discreto, os dois juntos = "misto"
  selo(tipos, o = {}) {
    if (!tipos?.length) return ''; const svg = tipos.includes('SVG'), mix = svg && tipos.length > 1, so = o.soSvg && !svg;
    if (so) return ''; const txt = mix ? (o.curto ? 'MISTO' : tipos.join(' · ')) : tipos[0];
    return `<span class="selo-tipo ${mix ? 'misto' : svg ? 'svg' : 'px'}" title="${mix ? 'Tem imagens SVG (vetor) e ' + tipos.filter(t => t !== 'SVG').join('/') : svg ? 'SVG: vetor, não perde qualidade no zoom' : tipos.join(', ') + ': imagem de pixels'}">${esc(txt)}</span>`;
  },

  /* ---------- abrir, ler e gravar ---------- */
  _txt: new Map(), _mod: new Map(),
  // a imagem pronta para desenhar: <img> do SVG (o navegador desenha o vetor no tamanho em que for pintado: sem perder qualidade)
  imagem(blob) { return new Promise(ok => { const u = URL.createObjectURL(blob.type === 'image/svg+xml' ? blob : new Blob([blob], { type: 'image/svg+xml' })), im = new Image(); im.decoding = 'sync'; im.onload = () => ok(im); im.onerror = () => { URL.revokeObjectURL(u); ok(null); }; im.src = u; }); },
  async texto(k) {
    if (this._txt.has(k)) return this._txt.get(k);
    let b = await Arq.pegaBlob(k); if (!b && /^personagens\//.test(k)) b = await Nuvem.baixar(k).catch(() => null); if (!b) throw new Error('O SVG desta imagem não está neste computador.');
    const t = await b.text(); this._txt.set(k, t); return t;
  },
  // o modelo (camadas, formas, apagados) de uma imagem SVG — sempre uma CÓPIA (mexer nela não muda a guardada)
  async modelo(k) { if (!this._mod.has(k)) this._mod.set(k, this.ler(await this.texto(k))); return clone(this._mod.get(k)); },
  num: v => +(+v).toFixed(3),
  ler(txt) {
    const doc = new DOMParser().parseFromString(txt, 'image/svg+xml'), r = doc.documentElement; if (!r || r.nodeName !== 'svg') throw new Error('SVG inválido');
    const vb = (r.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number), W = vb[2] || +r.getAttribute('width') || 100, H = vb[3] || +r.getAttribute('height') || 100;
    if (r.getAttribute('data-animador') !== 'vetor') { // SVG de fora: fica inteiro por baixo, e as camadas de cima recebem o que for desenhado
      [...r.querySelectorAll('script,foreignObject')].forEach(e => e.remove()); const raw = [...r.childNodes].map(n => new XMLSerializer().serializeToString(n)).join('');
      return { W, H, off: { x: 0, y: 0 }, raw, cam: [{ id: 'cor', nome: 'Cor', papel: 'cor', f: [], m: [] }, { id: 'linha', nome: 'Linha', papel: 'linha', f: [], m: [] }] };
    }
    const byId = id => r.querySelector(`[id="${id}"]`), url = v => (/url\(#([^)]+)\)/.exec(v || '') || [])[1], blurDe = el => { const f = url(el.getAttribute('filter')); return f ? +f.slice(1).replace('_', '.') || 0 : 0; };
    const forma = (p, cl) => { const o = { d: p.getAttribute('d') || '' }, sw = p.getAttribute('stroke-width'), tr = sw && p.getAttribute('fill') === 'none'; if (tr) o.s = +sw; const c = p.getAttribute(tr ? 'stroke' : 'fill'); if (c && c !== '#000') o.c = c; const op = p.getAttribute(tr ? 'stroke-opacity' : 'fill-opacity'); if (op != null && +op < 1) o.o = +op;
      if (p.getAttribute('fill-rule') === 'evenodd') o.r = 1; const b = blurDe(p); if (b) o.b = b; if (cl) o.cl = cl; return o; };
    const lista = (g, mascara) => [...g.children].flatMap(el => { if (el.nodeName === 'path') return [forma(el)]; if (el.nodeName === 'g' && el.hasAttribute('data-cl')) { const cp = byId(url(el.getAttribute('clip-path')))?.querySelector('path'); return [...el.querySelectorAll(':scope > path')].map(p => forma(p, cp?.getAttribute('d'))); } return []; }).map(o => { if (mascara) delete o.c; return o; });
    const raiz = r.querySelector(':scope > g'), t = /translate\(\s*([-\d.e]+)[\s,]+([-\d.e]+)\s*\)/.exec(raiz?.getAttribute('transform') || ''), off = { x: t ? -+t[1] : 0, y: t ? -+t[2] : 0 };
    const rawEl = raiz?.querySelector(':scope > g[data-raw]'), raw = rawEl ? [...rawEl.childNodes].map(n => new XMLSerializer().serializeToString(n)).join('') : '';
    const cam = [...(raiz || r).querySelectorAll(':scope > g[data-cam]')].map(g => { const i = g.querySelector(':scope > g') || g, mt = /matrix\(([^)]+)\)/.exec(i.getAttribute('transform') || ''), mk = byId(url(i.getAttribute('mask'))), cp = byId(url(g.getAttribute('clip-path')));
      const c = { id: g.getAttribute('data-cam'), nome: g.getAttribute('data-nome') || 'Camada', papel: g.getAttribute('data-papel') || 'cor', f: lista(i), m: mk ? lista(mk, true).filter(x => x.d && !/^M-5e4/.test(x.d)) : [] };
      if (g.getAttribute('display') === 'none') c.vis = false; const op = g.getAttribute('opacity'); if (op != null && +op < 1) c.op = +op; if (mt) c.tr = mt[1].split(/[\s,]+/).map(Number); if (cp) c.clip = cp.querySelector('path')?.getAttribute('d'); const b = blurDe(i); if (b) c.b = b; return c; });
    return { W, H, off, cam, ...(raw ? { raw } : {}) };
  },
  svg(m) {
    const defs = [], blurs = new Set(), X = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), bid = b => 'b' + String(+(+b).toFixed(1)).replace('.', '_');
    let ncl = 0; const fb = b => { if (!b) return ''; blurs.add(+(+b).toFixed(1)); return ` filter="url(#${bid(b)})"`; };
    const caminho = (p, mascara) => { const cor = mascara ? '#000' : X(p.c || '#000'), op = p.o != null && p.o < 1 ? +p.o.toFixed(3) : null;
      const el = p.s ? `<path d="${p.d}" fill="none" stroke="${cor}" stroke-width="${+(+p.s).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${op != null ? ` stroke-opacity="${op}"` : ''}${fb(p.b)}/>` // traço de grossura igual: linha do SVG (juntas redondas perfeitas)
        : `<path d="${p.d}" fill="${cor}"${op != null ? ` fill-opacity="${op}"` : ''}${p.r ? ' fill-rule="evenodd"' : ''}${fb(p.b)}/>`;
      if (!p.cl) return el; const id = 'e' + (++ncl); defs.push(`<clipPath id="${id}"><path d="${p.cl}" clip-rule="evenodd"/></clipPath>`); return `<g data-cl="1" clip-path="url(#${id})">${el}</g>`; };
    const G = 50000, corpo = m.cam.map(c => { const id = X(c.id);
      if (c.m?.length) defs.push(`<mask id="m-${id}" maskUnits="userSpaceOnUse" x="-${G}" y="-${G}" width="${2 * G}" height="${2 * G}"><path d="M-5e4 -5e4H5e4V5e4H-5e4Z" fill="#fff"/>${c.m.map(p => caminho(p, true)).join('')}</mask>`);
      if (c.clip) defs.push(`<clipPath id="c-${id}"><path d="${c.clip}" clip-rule="evenodd"/></clipPath>`);
      return `<g data-cam="${id}" data-nome="${X(c.nome || 'Camada')}" data-papel="${X(c.papel || 'cor')}"${c.vis === false ? ' display="none"' : ''}${c.op != null && c.op < 1 ? ` opacity="${+c.op.toFixed(3)}"` : ''}${c.clip ? ` clip-path="url(#c-${id})"` : ''}><g${c.tr ? ` transform="matrix(${c.tr.map(v => +(+v).toFixed(5)).join(' ')})"` : ''}${c.m?.length ? ` mask="url(#m-${id})"` : ''}${fb(c.b)}>${(c.f || []).map(p => caminho(p)).join('')}</g></g>`; }).join('');
    for (const b of blurs) defs.push(`<filter id="${bid(b)}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${b}"/></filter>`);
    const o = m.off || { x: 0, y: 0 };
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.W} ${m.H}" width="${m.W}" height="${m.H}" data-animador="vetor"><defs>${defs.join('')}</defs><g transform="translate(${-o.x} ${-o.y})">${m.raw ? `<g data-raw="1">${m.raw}</g>` : ''}${corpo}</g></svg>`;
  },
  chave(ext = 'svg') { return `personagens/${Atelie.def.id}/img/${uid('im').toLowerCase().replace(/[^a-z0-9]/g, '')}.${ext}`; },
  // grava o modelo como uma imagem NOVA (chave nova: o Ctrl+Z do Ateliê volta a de antes)
  async gravar(img, m, k = this.chave()) {
    const t = this.svg(m), b = new Blob([t], { type: 'image/svg+xml' }); await Arq.guardar(b, k); this._txt.set(k, t); this._mod.set(k, clone(m));
    const im = await this.imagem(b); if (!im) throw new Error('O SVG novo não abriu.'); Arq.img.set(k, im); if (img) img.k = k; return k;
  },
  // desenha o modelo num canvas (só as camadas pedidas), no tamanho da imagem × escala
  async raster(m, o = {}) {
    const s = o.escala || 1, mm = o.so ? { ...m, raw: o.comRaw ? m.raw : '', cam: m.cam.map(c => ({ ...c, vis: o.so(c) && c.vis !== false ? undefined : false })) } : m;
    const im = await this.imagem(new Blob([this.svg(mm)], { type: 'image/svg+xml' })), cv = new OffscreenCanvas(Math.max(1, Math.round(m.W * s)), Math.max(1, Math.round(m.H * s)));
    if (im) cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); return cv;
  },

  /* ---------- geometria ---------- */
  // pixels da imagem → espaço de dentro de uma camada (deslocamento do recorte + transformação da camada)
  mapa(m, c) { const o = m.off || { x: 0, y: 0 }; if (!c?.tr) return p => ({ x: p.x + o.x, y: p.y + o.y }); const inv = new DOMMatrix(c.tr).inverse(); return p => { const q = inv.transformPoint(new DOMPoint(p.x + o.x, p.y + o.y)); return { x: q.x, y: q.y }; }; },
  deCamada(m, c) { const o = m.off || { x: 0, y: 0 }, M = c?.tr ? new DOMMatrix(c.tr) : null; return p => { const q = M ? M.transformPoint(new DOMPoint(p.x, p.y)) : p; return { x: q.x - o.x, y: q.y - o.y }; }; },
  // contorno de uma máscara (canvas: alfa = dentro), em pixels da imagem; s = escala do canvas
  laçosDe(cv, s = 1, lim = .5) {
    const W = cv.width, H = cv.height, D = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data, f = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) f[i] = D[i * 4 + 3] / 255; return this.contornos(f, W, H, lim).map(L => L.map(p => ({ x: p.x / s, y: p.y / s })));
  },
  dDe(laços, o = {}) { return this.caminho(laços, { alisa: 3, eps: .4, ...o }); },
  // contorno de um TRAÇO (pincel/borracha): pontos { x, y, w } (w = grossura) → um laço fechado com pontas redondas
  laçoDoTraco(pts) {
    const P = []; for (const p of pts) { const u = P[P.length - 1]; if (!u || Math.hypot(p.x - u.x, p.y - u.y) > Math.max(.3, Math.min(u.w, p.w) * .08)) P.push({ ...p }); else u.w = Math.max(u.w, p.w); }
    const circ = (c, r, a0, a1, n) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }); } return o; };
    if (P.length < 2) { const c = P[0] || pts[0], r = Math.max(.4, c.w / 2); return circ(c, r, 0, Math.PI * 2, 24).slice(0, -1); }
    const E = [], D = [], n = P.length;
    for (let i = 0; i < n; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; const r = Math.max(.3, P[i].w / 2);
      E.push({ x: P[i].x - ty * r, y: P[i].y + tx * r }); D.push({ x: P[i].x + ty * r, y: P[i].y - tx * r }); }
    const ang = (p, q) => Math.atan2(q.y - p.y, q.x - p.x), r0 = Math.max(.3, P[0].w / 2), r1 = Math.max(.3, P[n - 1].w / 2);
    const fim = circ(P[n - 1], r1, ang(P[n - 1], E[n - 1]), ang(P[n - 1], E[n - 1]) - Math.PI, 10).slice(1, -1), ini = circ(P[0], r0, ang(P[0], D[0]), ang(P[0], D[0]) - Math.PI, 10).slice(1, -1);
    return [...E, ...fim, ...D.reverse(), ...ini];
  },
  // quanto um mapa estica (grossura da linha no espaço da camada)
  escalaDe(mp) { const a = mp({ x: 0, y: 0 }), b = mp({ x: 1, y: 0 }), c = mp({ x: 0, y: 1 }); return Math.sqrt(Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))) || 1; },
  // pontos do traço → caminho ABERTO com curvas ajustadas (um clique = um ponto)
  dAberto(P0) {
    const f = v => String(Math.round(v * 100) / 100), P = []; for (const p of P0) { const u = P[P.length - 1]; if (!u || Math.hypot(p.x - u.x, p.y - u.y) > .4) P.push({ x: p.x, y: p.y }); }
    if (P.length < 2) { const p = P[0] || P0[0]; return `M${f(p.x)} ${f(p.y)}l.01 0`; }
    const nor = v => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; }, n = P.length, t1 = nor({ x: P[Math.min(2, n - 1)].x - P[0].x, y: P[Math.min(2, n - 1)].y - P[0].y }), t2 = nor({ x: P[Math.max(0, n - 3)].x - P[n - 1].x, y: P[Math.max(0, n - 3)].y - P[n - 1].y });
    const bz = this.fitCubic(P, t1, t2, .3 * .3); return `M${f(P[0].x)} ${f(P[0].y)}` + bz.map(b => `C${f(b[1].x)} ${f(b[1].y)} ${f(b[2].x)} ${f(b[2].y)} ${f(b[3].x)} ${f(b[3].y)}`).join('');
  },
  // traço com pressão: pontos bem juntinhos (de pouco em pouco) e quinas arredondadas, para o contorno não afinar nas viradas
  lisoTraco(pts) {
    const R = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[i + 1]; R.push(a); if (!b) break; const L = Math.hypot(b.x - a.x, b.y - a.y), passo = Math.max(.5, Math.min(a.w, b.w) / 5), n = Math.floor(L / passo); for (let k = 1; k < n; k++) { const t = k / n; R.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t }); } }
    let Q = R; for (let it = 0; it < 4; it++) Q = Q.map((p, i) => i === 0 || i === Q.length - 1 ? p : { x: (Q[i - 1].x + 2 * p.x + Q[i + 1].x) / 4, y: (Q[i - 1].y + 2 * p.y + Q[i + 1].y) / 4, w: p.w }); return Q;
  },
  // um laço → caminho com curvas (sem alisar demais: o traço já vem suave)
  dDoLaço(L, o = {}) { return this.caminho([L], { alisa: 0, eps: .2, ...o }); },
  ativa(m, img) { return m.cam.find(c => c.id === img?.vCam) || m.cam.find(c => c.papel === 'linha') || m.cam[m.cam.length - 1]; },
  camCor(m, img) { const a = this.ativa(m, img); return a?.papel === 'cor' ? a : m.cam.find(c => c.papel === 'cor') || a; },

  /* ---------- ferramentas no SVG (chamadas pela Pintura / Recorte / Ajustes quando a imagem é SVG) ---------- */
  // a seleção (máscara do Recorte) vira um contorno vetorial, no espaço da camada
  selD(mask, m, c) { if (!mask) return null; return this.dDe(this.laçosDe(mask), { mapa: this.mapa(m, c), alisa: 0, eps: .3 }) || null; },
  // pincel e borracha: pts = [{ x, y, w }] em pixels da imagem
  async traco(a, pts, o) {
    const img = a.img, m = await this.modelo(img.k), c = this.ativa(m, img); if (!c) return false;
    const mm = Math.max(...pts.map(p => p.w)) || 1, mn = Math.min(...pts.map(p => p.w)), b = o.dureza < .9 ? +Math.max(.3, (1 - o.dureza) * mm * .35).toFixed(1) : 0, igual = mm - mn < mm * .03;
    // grossura igual (mouse, ou sem pressão no tamanho): vira LINHA do SVG com pontas e juntas redondas; com pressão: o contorno do traço
    const mapaI = p => p, forma = mp => { if (igual) { const k = this.escalaDe(mp); return { d: this.dAberto(pts.map(mp)), s: +(mm * k).toFixed(2) }; } return { d: this.dDoLaço(this.laçoDoTraco(this.lisoTraco(pts)), { mapa: mp }) }; };
    if (o.apaga && a.quadro) { const fq = forma(mapaI); return this.apagaQuadro(a, fq.d, o.opac, b, fq.s); } // num keyframe: o apagado vale só nele
    const fm = forma(this.mapa(m, c)); if (!fm.d) return false;
    const cl = this.selD(o.mask, m, c), f = { ...fm, ...(o.opac < 1 ? { o: o.opac } : {}), ...(b ? { b } : {}), ...(cl ? { cl } : {}) };
    if (o.apaga) c.m.push(f); else c.f.push({ ...f, c: o.cor });
    await this.gravar(img, m); return true;
  },
  // área entre as LINHAS no ponto (canvas na escala s): é a área que o balde pinta (e a borracha mágica apaga)
  async area(a, pt, m) {
    const s = clamp(1400 / Math.max(m.W, m.H), 1, 3), W = Math.round(m.W * s), H = Math.round(m.H * s), x0 = Math.floor(pt.x * s), y0 = Math.floor(pt.y * s); if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return null;
    const lin = (await this.raster(m, { escala: s, so: c => c.papel === 'linha' })).getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const tud = (await this.raster(m, { escala: s })).getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const N = W * H, bar = new Uint8Array(N), den = new Uint8Array(N); for (let i = 0; i < N; i++) { bar[i] = lin[i * 4 + 3] > 110 ? 1 : 0; den[i] = tud[i * 4 + 3] > 12 ? 1 : 0; }
    const i0 = y0 * W + x0; if (bar[i0]) return { linha: true };
    const dentro = den[i0], reg = new Uint8Array(N), st = [i0]; reg[i0] = 1; let borda = false, n = 0;
    while (st.length) { const i = st.pop(), x = i % W; n++; if (x === 0 || x === W - 1 || i < W || i >= N - W) borda = true;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < N && !reg[j] && !bar[j] && (!dentro || den[j])) { reg[j] = 1; st.push(j); } }
    if (!dentro && borda) return { aberta: true };
    // a cor entra por baixo da linha (até o meio dela, ~3 px): sem fresta entre a cor e o traço
    let fr = []; for (let i = 0; i < N; i++) if (reg[i]) fr.push(i);
    for (let k = 0; k < Math.round(3 * s); k++) { const nv = []; for (const i of fr) { const x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < N && !reg[j] && bar[j]) { reg[j] = 1; nv.push(j); } } fr = nv; }
    const cv = new OffscreenCanvas(W, H), x = cv.getContext('2d'), id = x.createImageData(W, H); for (let i = 0; i < N; i++) if (reg[i]) id.data[i * 4 + 3] = 255; x.putImageData(id, 0, 0);
    return { cv, s, n };
  },
  async balde(a, pt, cor, mask) {
    const img = a.img, m = await this.modelo(img.k), ar = await this.area(a, pt, m);
    if (!ar || ar.aberta) { UI.toast('Essa área não está fechada pelas linhas: o balde do vetor só pinta áreas fechadas.', { kind: 'warn' }); return false; }
    if (ar.linha) { UI.toast('Isso é a linha: o balde pinta a cor das áreas. Para mudar a cor da linha, use Trocar cores ou escolha a camada Linha e pinte com o pincel.', { kind: 'warn', time: 5000 }); return false; }
    const c = this.camCor(m, img), d = this.dDe(this.laçosDe(ar.cv, ar.s), { mapa: this.mapa(m, c) }); if (!d) return false;
    const cl = this.selD(mask, m, c); c.f.push({ d, c: cor, r: 1, ...(cl ? { cl } : {}) }); await this.gravar(img, m); return true;
  },
  async magica(a, pt, mask) {
    const img = a.img, m = await this.modelo(img.k), c = this.ativa(m, img), ar = await this.area(a, pt, m);
    if (!ar || ar.aberta || ar.linha) { UI.toast(ar?.linha ? 'Isso é a linha: escolha a camada Linha e use a borracha para apagar a linha.' : 'Clique numa área fechada pelas linhas.', { kind: 'warn' }); return false; }
    if (a.quadro) return this.apagaQuadro(a, this.dDe(this.laçosDe(ar.cv, ar.s)), 1, 0);
    const d = this.dDe(this.laçosDe(ar.cv, ar.s), { mapa: this.mapa(m, c) }); if (!d) return false;
    const cl = this.selD(mask, m, c); c.m.push({ d, r: 1, ...(cl ? { cl } : {}) }); await this.gravar(img, m); return true;
  },
  // seleção: apagar (só na camada escolhida) ou manter só ela
  async naSelecao(a, mask, modo) {
    const img = a.img, m = await this.modelo(img.k), c = this.ativa(m, img);
    if (modo === 'apagar' && a.quadro) return this.apagaQuadro(a, this.dDe(this.laçosDe(mask), { alisa: 0, eps: .3 }), 1, 0);
    const d = this.selD(mask, m, c); if (!d) return false;
    if (modo === 'apagar') c.m.push({ d, r: 1 }); else if (modo === 'cortar') { for (const k of m.cam) k.m.push({ d: this.selD(mask, m, k), r: 1 }); } else for (const k of m.cam) { const mp = this.mapa(m, k), fora = this.dDe(this.laçosDe(mask), { mapa: mp, alisa: 0, eps: .3 }), q = [{ x: -1, y: -1 }, { x: m.W + 1, y: -1 }, { x: m.W + 1, y: m.H + 1 }, { x: -1, y: m.H + 1 }].map(mp); k.m.push({ d: `M${q.map(p => `${round(p.x)} ${round(p.y)}`).join('L')}Z` + fora, r: 1 }); }
    await this.gravar(img, m); return true;
  },
  // pedaço da seleção como SVG novo (copiar/recortar para parte nova): mesmas camadas, cortadas pela seleção e no tamanho do pedaço
  async pedaco(a, mask) {
    const bb = Pintura.bbox(mask); if (!bb) return null; const m = await this.modelo(a.img.k), sel = this.dDe(this.laçosDe(mask), { alisa: 0, eps: .3 });
    const n = clone(m), o = n.off || { x: 0, y: 0 }; for (const c of n.cam) { c.clip = this.dDe(this.laçosDe(mask), { mapa: p => ({ x: p.x + o.x, y: p.y + o.y }), alisa: 0, eps: .3 }); } // o clip fica no espaço de dentro (antes da camada)
    n.off = { x: o.x + bb.x, y: o.y + bb.y }; n.W = bb.w; n.H = bb.h; return { m: n, bb, sel };
  },
  // corta a sobra transparente (a imagem fica do tamanho do desenho, no mesmo lugar)
  async aparar(img) {
    const m = await this.modelo(img.k), cv = await this.raster(m), bb = Pintura.bbox(cv); if (!bb || (bb.w >= m.W && bb.h >= m.H)) return null;
    const o = m.off || { x: 0, y: 0 }; m.off = { x: o.x + bb.x, y: o.y + bb.y }; m.W = bb.w; m.H = bb.h; return { m, bb };
  },
  // muda as cores de todas as formas (trocar cores, ajustes de cor): fn(hex) → hex
  async recolorir(img, fn, so) {
    const m = await this.modelo(img.k); let mudou = false;
    for (const c of m.cam) { if (so && !so(c)) continue; for (const f of c.f) { const n = fn(f.c || '#000000'); if (n && n.toLowerCase() !== (f.c || '#000000').toLowerCase()) { f.c = n; mudou = true; } } }
    if (mudou) await this.gravar(img, m); return mudou;
  },
  // a mesma conta do Ajustes (filtro do canvas) aplicada à COR de cada forma: o resultado bate com a prévia
  filtroCor(filtro) { const cv = new OffscreenCanvas(1, 1), x = cv.getContext('2d', { willReadFrequently: true }), cache = new Map();
    return hex => { if (cache.has(hex)) return cache.get(hex); const t = new OffscreenCanvas(1, 1), tx = t.getContext('2d'); tx.fillStyle = hex; tx.fillRect(0, 0, 1, 1); x.clearRect(0, 0, 1, 1); x.filter = filtro; x.drawImage(t, 0, 0); x.filter = 'none'; const d = x.getImageData(0, 0, 1, 1).data, r = hexDe(d[0], d[1], d[2]); cache.set(hex, r); return r; }; },
  // Ajustes de cor / Transformar na camada escolhida (as do vetor; nitidez não existe em vetor)
  async ajustar(a, info) {
    const img = a.img, m = await this.modelo(img.k), c = this.ativa(m, img);
    if (info.v) { const v = info.v, f = []; if (v.brilho) f.push(`brightness(${100 + v.brilho}%)`); if (v.contraste) f.push(`contrast(${100 + v.contraste}%)`); if (v.sat) f.push(`saturate(${100 + v.sat}%)`); if (v.matiz) f.push(`hue-rotate(${v.matiz}deg)`); if (v.pb) f.push('grayscale(100%)'); if (v.sepia) f.push('sepia(100%)'); if (v.inverter) f.push('invert(100%)');
      const fn = f.length ? this.filtroCor(f.join(' ')) : null; if (fn) for (const p of c.f) p.c = fn(p.c || '#000000'); if (v.desfoque) c.b = +((c.b || 0) + v.desfoque / 2).toFixed(1);
      if (v.nitidez && !v.desfoque && !fn) { UI.toast('Nitidez não existe no vetor (ele já é nítido em qualquer zoom).', { kind: 'warn' }); return false; } }
    if (info.t) { const t = info.t, bb = info.bb || { x: 0, y: 0, w: m.W, h: m.H }, o = m.off || { x: 0, y: 0 }, cx = bb.x + bb.w / 2 + o.x, cy = bb.y + bb.h / 2 + o.y; // centro no espaço de dentro
      const T = new DOMMatrix().translate(cx + (t.dx || 0), cy + (t.dy || 0)).rotate(t.r || 0).scale(t.s / 100 * (t.fx ? -1 : 1), t.s / 100 * (t.fy ? -1 : 1)).translate(-cx, -cy).multiply(c.tr ? new DOMMatrix(c.tr) : new DOMMatrix());
      c.tr = [T.a, T.b, T.c, T.d, T.e, T.f]; if (Math.abs(T.a - 1) + Math.abs(T.b) + Math.abs(T.c) + Math.abs(T.d - 1) + Math.abs(T.e) + Math.abs(T.f) < 1e-6) delete c.tr; }
    await this.gravar(img, m); return true;
  },
  // mover a camada (ferramenta Mover camada)
  async moverCamada(a, dx, dy) { return this.ajustar(a, { t: { s: 100, r: 0, dx, dy } }); },
  // trocar cores (aba Pintar e cores): mesma regra do PNG, mas na cor de cada forma
  async trocaCores(img, trocas, lim) {
    return this.recolorir(img, hex => { const D = rgbDe(hex); let best = null, bd = lim; for (const t of trocas) { const dd = Math.abs(D[0] - t.de[0]) + Math.abs(D[1] - t.de[1]) + Math.abs(D[2] - t.de[2]); if (dd < bd) { bd = dd; best = t; } }
      if (!best) return hex; const f = 1 - (bd / lim) ** 2; return hexDe(...[0, 1, 2].map(j => clamp(Math.round(D[j] + (best.para[j] - best.de[j]) * f), 0, 255))); });
  },

  /* ---------- APAGAR SÓ NUM KEYFRAME (vetor): a máscara do frame também é SVG (formas pretas = apagado), em pixels da imagem ---------- */
  async apagaQuadro(a, d, op = 1, b = 0, sw = 0) {
    if (!d) return false; const img = a.img, ant = a.ap?.k && this.eh(a.ap.k) ? this.ler(await this.texto(a.ap.k)) : null, m = ant || { W: a.bm.width, H: a.bm.height, off: { x: 0, y: 0 }, cam: [{ id: 'ap', nome: 'Apagado', papel: 'cor', f: [], m: [] }] };
    m.cam[0].f.push({ d, c: '#000000', ...(sw ? { s: sw } : {}), ...(op < 1 ? { o: op } : {}), ...(b ? { b } : {}) });
    const k = this.chave(); await this.gravar(null, m, k);
    const ap = { [img.id]: { k, x: 0, y: 0 } }; Quadro.poe(a.quadro, a.p.id, { ap }); if (a.quadro.tipo === 'editor') Quadro.avisaEditor({ [a.p.id]: { ap } }, k);
    if (!Quadro._avisou) { Quadro._avisou = true; UI.toast(`Apagado só no <b>${esc(Quadro.nome(a.quadro))}</b>. Fora de um keyframe, a borracha apaga em tudo.`, { kind: 'ok', time: 6000 }); }
    return true;
  },
  // a imagem SVG com o apagado do keyframe (continua vetor: sem perder qualidade no zoom)
  _ap: new Map(), _apFaz: new Set(),
  comAp(bm, it, aoChegar) {
    const ch = it.img.k + '|' + it.ap.k; if (this._ap.has(ch)) return this._ap.get(ch);
    if (!this._apFaz.has(ch)) { this._apFaz.add(ch); (async () => { try {
      const t = await this.texto(it.img.k), mk = this.ler(await this.texto(it.ap.k)), a0 = t.indexOf('>', t.indexOf('<svg')) + 1, a1 = t.lastIndexOf('</svg>');
      const corpo = mk.cam[0].f.map(p => `<path d="${p.d}" ${p.s ? `fill="none" stroke="#000" stroke-width="${p.s}" stroke-linecap="round" stroke-linejoin="round"` : 'fill="#000"'}${p.o < 1 ? ` ${p.s ? 'stroke' : 'fill'}-opacity="${p.o}"` : ''}${p.b ? ` filter="url(#apb${String(p.b).replace('.', '_')})"` : ''}/>`).join(''), fs = [...new Set(mk.cam[0].f.filter(p => p.b).map(p => p.b))].map(b => `<filter id="apb${String(b).replace('.', '_')}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${b}"/></filter>`).join('');
      const novo = t.slice(0, a0) + `<defs>${fs}<mask id="ap-q" maskUnits="userSpaceOnUse" x="-5e4" y="-5e4" width="1e5" height="1e5"><path d="M-5e4 -5e4H5e4V5e4H-5e4Z" fill="#fff"/>${corpo}</mask></defs><g mask="url(#ap-q)">` + t.slice(a0, a1) + '</g></svg>';
      const im = await this.imagem(new Blob([novo], { type: 'image/svg+xml' })); if (im) { this._ap.set(ch, im); if (this._ap.size > 120) this._ap.delete(this._ap.keys().next().value); }
    } catch (e) { console.warn(e); } finally { this._apFaz.delete(ch); } aoChegar?.(); })(); }
    return bm;
  },

  /* ---------- prévia do traço (camadas de baixo, a escolhida e as de cima em canvases separados) ---------- */
  _sep: new Map(),
  separadas(img) {
    const ch = img.k + '|' + (img.vCam || ''); if (this._sep.has(ch)) return this._sep.get(ch);
    const p = (async () => { const m = await this.modelo(img.k), c = this.ativa(m, img), i = m.cam.indexOf(c);
      return { abaixo: await this.raster(m, { so: k => m.cam.indexOf(k) < i, comRaw: true }), ativa: await this.raster({ ...m, raw: '' }, { so: k => k === c }), acima: await this.raster(m, { so: k => m.cam.indexOf(k) > i }) }; })();
    this._sep.set(ch, p); if (this._sep.size > 8) this._sep.delete(this._sep.keys().next().value); p.then(v => p.v = v); return p;
  },

  /* ---------- converter ---------- */
  async pixelsDe(k) { const b = await Arq.pegaBlob(k) || (/^personagens\//.test(k) ? await Nuvem.baixar(k).catch(() => null) : null); if (!b) throw new Error('A imagem não está neste computador.'); const bm = await createImageBitmap(b), c = new OffscreenCanvas(bm.width, bm.height).getContext('2d', { willReadFrequently: true }); c.drawImage(bm, 0, 0); return { D: c.getImageData(0, 0, bm.width, bm.height).data, W: bm.width, H: bm.height }; },
  async converteImg(img, o = {}) {
    const k0 = img.k, { D, W, H } = await this.pixelsDe(k0), m = this.dePixels(D, W, H, { limpa: o.limpa !== false }); delete m.cores;
    await this.gravar(img, m); img.dePng = k0; if (img.camadas) { delete img.camadas; delete img.camAtiva; } delete img.vCam; return m;
  },
  // SVG → PNG (do tamanho da imagem). Se ninguém mexeu desde a conversão, volta o PNG original (sem perda nenhuma)
  async paraPng(img) {
    const m = await this.modelo(img.k), cv = await this.raster(m), b = await cv.convertToBlob({ type: 'image/png' }), k = this.chave('png');
    await Arq.guardar(b, k); Arq.img.set(k, await createImageBitmap(b)); img.k = k; delete img.vCam; return k;
  },
};
