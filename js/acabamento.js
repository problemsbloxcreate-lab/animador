/* ===================== acabamento.js — ACABAMENTO "A2" DA RUA 3D (12/11/2026) =====================
   Reproduz no Estúdio o acabamento que antes era feito fora: a luz de borda do rim() (vetor/pos_acabamento.py) e o look A2 (cadeia do ffmpeg):
   - GradeA2: o visual "Rua 3D (A2)" (Efeitos.VISUAIS id 'a2', campo `grade: 'a2'`). Vale no quadro inteiro (personagens inclusos).
     É a cadeia do ffmpeg com que o vídeo aprovado foi gradeado (correção da coordenação: NÃO é o grade() do pos_acabamento.py):
       colorbalance=rs=-0.03:gs=-0.02:bs=0.05:rh=0.04:gh=0.0:bh=-0.05,eq=contrast=1.06,vignette=angle=PI/5
     reproduzida passo a passo como o ffmpeg faz (conferido contra o ffmpeg 9, estágio por estágio):
       1) colorbalance em RGB float (l = max + min; peso das sombras clamp((.333 - l)*4 + .5)*.7, altas luzes clamp((l + .333 - 1)*4 + .5)*.7), lrintf → 8 bits
       2) o ffmpeg converte para YUV 4:4:4 BT.601 faixa limitada (o eq só aceita YUV)
       3) eq contrast no Y em inteiros (process_c: ((Y*4341) >> 12) - 8)
       4) vignette natural: f = cos(PI/5 * d)^4, d = hypot(trunc(x - w/2), trunc(y - h/2)) / hypot(w/2, h/2); Y*f e (U|V - 127)*f + 127,
          com o DITHER do ffmpeg (LCG 1664525/1013904223 que começa em 0 e continua de quadro em quadro: quadro q começa em q*3*w*h)
       5) volta para RGB BT.601 limitada.
     Roda na placa de vídeo (WebGL2, texelFetch = sem filtro); sem WebGL2 cai no processador (getImageData) com a mesma conta. Onde entra:
     camada de efeito com Cor "Rua 3D (A2)" (Render.aplica) e o visual antigo do projeto (P.efeitos.visual = 'a2', Render.quadro e o modo Cena).
   - LuzBorda: luz de borda por camada (personagem ou imagem), n.luzBorda = { on, dir, cor:[r,g,b], largura, suave, forca, aquece,
     sombraContato }. Igual ao rim(): a camada é desenhada num canvas à parte; borda = alfa - alfa deslocado PARA O SOL; desfoque
     gaussiano igual ao do Pillow (GaussianBlur = 3 passadas de caixa com raio fracionário, ImagingGaussianBlur); vezes o alfa; soma
     em "screen" a cor × força; leve calor geral ([1.03, 1, .95]). Largura e desfoque são em px do VÍDEO final (P.w×P.h): multiplicados
     pela escala vídeo → tela (zoom do palco/câmera não mudam a espessura no vídeo).
     dir = de onde vem a luz, em graus (0 = da direita, 90 = de cima, 135 = cima-esquerda, 180 = da esquerda). O deslocamento é
     largura × (cos, -sen) esticado para a maior componente valer 1 → dir 135 / largura 7 = (dx, dy) = (+7, +7) do pos_acabamento.py.
   Por script: LuzBorda.liga(no, { dir, cor, largura, forca, aquece: true, sombraContato: false }) · LuzBorda.desliga(no)
               Efeitos.usarVisual('a2') (camada de efeito no topo) ou P.efeitos.visual = 'a2' (jeito antigo, também vale). */
'use strict';
const GradeA2 = {
  // os números da cadeia do ffmpeg do vídeo aprovado
  CB: { s: [-.03, -.02, .05], h: [.04, 0, -.05] }, CONTRASTE: 1.06, ANGULO: Math.PI / 5,
  _gl: null, _semGpu: false,
  /* aplica no canvas cv (2D, no lugar). Wv×Hv = tamanho do vídeo (P.w×P.h); inv = matriz px do canvas → px do vídeo (null = o canvas
     é o próprio vídeo, esticado); q = quadro da timeline (posição do dither do vignette). O alfa de cada pixel fica como está. */
  aplica(cv, Wv, Hv, inv, q = 0) {
    const W = cv.width, H = cv.height; if (!W || !H) return;
    inv = inv || new DOMMatrix().scale(Wv / W, Hv / H);
    if (!this._semGpu) { try { if (this.gpu(cv, W, H, Wv, Hv, inv, q)) return; } catch (e) { console.warn('[A2] sem WebGL2, vai pelo processador', e); this._semGpu = true; } }
    this.cpu(cv, W, H, Wv, Hv, inv, q);
  },
  // contraste do eq em inteiros (process_c): pel = ((Y * k) >> 12) + b
  eqK() { const k = Math.trunc(this.CONTRASTE * 4096); return [k, Math.trunc(100 * 511 / 200) - 128 - Math.trunc(k / 32)]; },
  // estado do gerador do dither do vignette (LCG de 32 bits que começa em 0) depois de k passos
  lcg(k) { let a = 1664525, c = 1013904223, r = 0; k = k >>> 0; while (k) { if (k & 1) r = (Math.imul(r, a) + c) >>> 0; c = Math.imul(a + 1, c) >>> 0; a = Math.imul(a, a) >>> 0; k >>>= 1; } return r; },
  // fator do vignette (modo natural, aspecto 1, centro w/2 h/2, dmax = metade da diagonal) no pixel (vx, vy) do vídeo
  fator(vx, vy, Wv, Hv) { const d = Math.hypot(Math.trunc(vx - Wv / 2), Math.trunc(vy - Hv / 2)) / Math.hypot(Wv / 2, Hv / 2); if (d > 1) return 0; const c = Math.cos(this.ANGULO * d); return (c * c) * (c * c); },
  // um pixel pela cadeia inteira (inteiros 0..255 → [r, g, b]); dy/du/dv = dither de cada plano
  pixel(R, G, B, f, dy, du, dv) {
    const F = Math.fround, cl = (x, a, b) => x < a ? a : x > b ? b : x, rgb = [F(R / 255), F(G / 255), F(B / 255)], l = F(Math.max(...rgb) + Math.min(...rgb));
    const sS = F(cl(F(F(F(.333) - l) * 4 + .5), 0, 1) * F(.7)), sH = F(cl(F(F(l + F(.333) - 1) * 4 + .5), 0, 1) * F(.7));
    const c = rgb.map((v, i) => Math.round(cl(F(F(v + F(F(this.CB.s[i]) * sS)) + F(F(this.CB.h[i]) * sH)), 0, 1) * 255)); // lrintf
    let Y = cl(Math.round(16 + (65.481 * c[0] + 128.553 * c[1] + 24.966 * c[2]) / 255), 0, 255), U = cl(Math.round(128 + (-37.797 * c[0] - 74.203 * c[1] + 112 * c[2]) / 255), 0, 255), V = cl(Math.round(128 + (112 * c[0] - 93.786 * c[1] - 18.214 * c[2]) / 255), 0, 255);
    const [k, b] = this.eqK(); Y = cl(((Y * k) >> 12) + b, 0, 255);
    Y = cl(Math.floor(Y * f + dy), 0, 255); U = cl(Math.floor((U - 127) * f + 127 + du), 0, 255); V = cl(Math.floor((V - 127) * f + 127 + dv), 0, 255);
    const y = (Y - 16) * 255 / 219, u = (U - 128) * 255 / 224, v = (V - 128) * 255 / 224;
    return [cl(Math.round(y + 1.402 * v), 0, 255), cl(Math.round(y - .344136 * u - .714136 * v), 0, 255), cl(Math.round(y + 1.772 * u), 0, 255)];
  },
  // a mesma conta no processador (sem WebGL2; também serve para conferir a da placa)
  cpu(cv, W, H, Wv, Hv, inv, q = 0) {
    const g = cv.getContext('2d'), d = g.getImageData(0, 0, W, H), p = d.data, N = Wv * Hv, o = Math.imul(q >>> 0, Math.imul(3, N)) >>> 0;
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i += 4) {
      if (!p[i + 3]) continue;
      const vx = Math.round(inv.a * (x + .5) + inv.c * (y + .5) + inv.e - .5), vy = Math.round(inv.b * (x + .5) + inv.d * (y + .5) + inv.f - .5);
      const ix = (Math.min(Hv - 1, Math.max(0, vy)) * Wv + Math.min(Wv - 1, Math.max(0, vx))) >>> 0, di = pl => (this.lcg(o + pl * N + ix) >>> 8) / 16777216;
      const r = this.pixel(p[i], p[i + 1], p[i + 2], this.fator(vx, vy, Wv, Hv), di(0), di(1), di(2)); p[i] = r[0]; p[i + 1] = r[1]; p[i + 2] = r[2];
    }
    g.putImageData(d, 0, 0);
  },
  FS: `#version 300 es
precision highp float; precision highp int;
uniform sampler2D u_t; uniform vec2 u_tam; uniform vec2 u_vid; uniform vec3 u_i0; uniform vec3 u_i1; uniform uint u_q;
uniform vec3 u_cs; uniform vec3 u_ch; uniform vec2 u_eq; uniform float u_ang;
out vec4 o;
uint lcg(uint k) { uint a = 1664525u, c = 1013904223u, r = 0u; for (int i = 0; i < 32; i++) { if (k == 0u) break; if ((k & 1u) != 0u) r = r * a + c; c = (a + 1u) * c; a = a * a; k >>= 1; } return r; }
float dit(uint k) { return float(lcg(k) >> 8u) / 16777216.; }
float rnd(float x) { return floor(x + .5); }
void main() {
  ivec2 p = ivec2(int(gl_FragCoord.x), int(u_tam.y - gl_FragCoord.y)); /* linha 0 = topo do canvas */
  vec4 t = texelFetch(u_t, p, 0);
  /* 1) colorbalance (float, vf_colorbalance): l = max + min; sombras e altas luzes; lrintf para 8 bits */
  vec3 x = floor(t.rgb * 255. + .5) / 255.;
  float l = max(x.r, max(x.g, x.b)) + min(x.r, min(x.g, x.b));
  float sS = clamp((.333 - l) * 4. + .5, 0., 1.) * .7, sH = clamp((l + .333 - 1.) * 4. + .5, 0., 1.) * .7;
  vec3 c = floor(clamp(x + u_cs * sS + u_ch * sH, 0., 1.) * 255. + .5);
  /* 2) RGB → YUV 4:4:4 (BT.601, faixa limitada, como o swscale escolhe para o eq) */
  float Y = clamp(rnd(16. + (65.481 * c.r + 128.553 * c.g + 24.966 * c.b) / 255.), 0., 255.);
  float U = clamp(rnd(128. + (-37.797 * c.r - 74.203 * c.g + 112. * c.b) / 255.), 0., 255.);
  float V = clamp(rnd(128. + (112. * c.r - 93.786 * c.g - 18.214 * c.b) / 255.), 0., 255.);
  /* 3) eq=contrast (process_c, inteiros) */
  Y = clamp(floor(Y * u_eq.x / 4096.) + u_eq.y, 0., 255.);
  /* 4) vignette (natural; dither = o LCG do ffmpeg, que continua de quadro em quadro: Y, U e V em sequência) */
  vec3 q = vec3(vec2(p) + .5, 1.);
  vec2 v = floor(vec2(dot(u_i0, q), dot(u_i1, q)) - .5 + .5);
  vec2 dd = vec2(trunc(v.x - u_vid.x * .5), trunc(v.y - u_vid.y * .5));
  float dn = length(dd) / length(u_vid * .5), cs = cos(u_ang * dn), f = dn > 1. ? 0. : (cs * cs) * (cs * cs);
  vec2 vc = clamp(v, vec2(0.), u_vid - 1.);
  uint N = uint(u_vid.x) * uint(u_vid.y), ix = uint(vc.y) * uint(u_vid.x) + uint(vc.x), o0 = u_q * 3u * N + ix;
  Y = clamp(floor(Y * f + dit(o0)), 0., 255.);
  U = clamp(floor((U - 127.) * f + 127. + dit(o0 + N)), 0., 255.);
  V = clamp(floor((V - 127.) * f + 127. + dit(o0 + 2u * N)), 0., 255.);
  /* 5) YUV → RGB (BT.601 limitada) */
  float yy = (Y - 16.) * 255. / 219., uu = (U - 128.) * 255. / 224., vv = (V - 128.) * 255. / 224.;
  vec3 r = clamp(floor(vec3(yy + 1.402 * vv, yy - .344136 * uu - .714136 * vv, yy + 1.772 * uu) + .5), 0., 255.);
  o = vec4(r / 255., t.a);
}`,
  gpu(cv, W, H, Wv, Hv, inv, q) {
    let s = this._gl;
    if (!s) {
      const c = new OffscreenCanvas(W, H), gl = c.getContext('webgl2', { premultipliedAlpha: false, alpha: true, antialias: false, preserveDrawingBuffer: true, depth: false, stencil: false });
      if (!gl) { this._semGpu = true; return false; }
      const sh = (t, src) => { const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }')); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, this.FS)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // um triângulo cobre a tela
      const la = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
      const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      gl.useProgram(pr); const u = {}; for (const n of ['u_t', 'u_tam', 'u_vid', 'u_i0', 'u_i1', 'u_q', 'u_cs', 'u_ch', 'u_eq', 'u_ang']) u[n] = gl.getUniformLocation(pr, n);
      gl.uniform1i(u.u_t, 0);
      c.addEventListener('webglcontextlost', e => { e.preventDefault(); this._gl = null; }); // perdeu a placa: refaz na próxima
      s = this._gl = { c, gl, u };
    }
    const { c, gl, u } = s; if (gl.isContextLost()) { this._gl = null; return false; }
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    gl.viewport(0, 0, W, H);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    const [ek, eb] = this.eqK();
    gl.uniform2f(u.u_tam, W, H); gl.uniform2f(u.u_vid, Wv, Hv); gl.uniform3f(u.u_i0, inv.a, inv.c, inv.e); gl.uniform3f(u.u_i1, inv.b, inv.d, inv.f); gl.uniform1ui(u.u_q, Math.max(0, q | 0) >>> 0);
    gl.uniform3fv(u.u_cs, this.CB.s); gl.uniform3fv(u.u_ch, this.CB.h); gl.uniform2f(u.u_eq, ek, eb); gl.uniform1f(u.u_ang, this.ANGULO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const g = cv.getContext('2d'); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'copy'; g.drawImage(c, 0, 0); g.restore();
    return true;
  },
};

const LuzBorda = {
  PADRAO: { dir: 135, cor: [255, 238, 180], largura: 7, suave: 1.6, forca: .85, aquece: true, sombraContato: false },
  AQUECE: [1.03, 1, .95],
  pode(n) { return !!n && (n.tipo === 'personagem' || n.tipo === 'imagem'); },
  cor(c) { if (Array.isArray(c)) return c.slice(0, 3).map(v => clamp(Math.round(+v || 0), 0, 255)); const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); if (!m) return this.PADRAO.cor.slice(); const x = parseInt(m[1], 16); return [x >> 16, (x >> 8) & 255, x & 255]; },
  hex(c) { return '#' + this.cor(c).map(v => v.toString(16).padStart(2, '0')).join(''); },
  // grava no nó (vai no projeto) e salva
  liga(no, o = {}) {
    if (!this.pode(no)) throw new Error('A luz de borda vale em camada de personagem ou de imagem.');
    const L = { ...this.PADRAO, ...(no.luzBorda || {}), ...o, on: true }; L.cor = this.cor(L.cor);
    for (const k of ['dir', 'largura', 'suave', 'forca']) L[k] = Number.isFinite(+L[k]) ? +L[k] : this.PADRAO[k];
    L.aquece = L.aquece !== false; L.sombraContato = !!L.sombraContato; no.luzBorda = L; this.salva('Luz de borda'); return L;
  },
  desliga(no) { if (no?.luzBorda) { no.luzBorda.on = false; this.salva('Sem luz de borda'); } }, // os números ficam guardados para ligar de novo
  salva(msg) { if (typeof App !== 'undefined' && App.P) App.commit(msg, { semArvore: true }); },
  // deslocamento para o sol (px do vídeo): dir 135 / largura 7 = (-7, -7) → a borda acende onde o pixel 7 px acima-à-esquerda é vazio
  desloc(L) { const a = (L.dir ?? 135) * Math.PI / 180, c = Math.cos(a), s = -Math.sin(a), m = Math.max(Math.abs(c), Math.abs(s)) || 1, r = x => Math.round(x * 1e6) / 1e6; return { x: r(c / m) * (L.largura ?? 7), y: r(s / m) * (L.largura ?? 7) }; },

  _tela(W, H) { let c = this._cv; if (!c) { c = this._cv = document.createElement('canvas'); c.width = W; c.height = H; this._cx = c.getContext('2d', { willReadFrequently: true }); } if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } return c; },
  /* chamado pelo Render.umNo no lugar do desenho normal da camada (n.luzBorda.on): desenha a camada à parte, acende a borda e passa
     para o ctx. Devolve true se desenhou algo. */
  desenha(ctx, P, q, base, n, m, alfa, fr, nivel) {
    const W = ctx.canvas.width, H = ctx.canvas.height, t = this._tela(W, H), tc = this._cx;
    tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, W, H); tc.globalAlpha = 1; tc.filter = 'none'; tc.globalCompositeOperation = 'source-over';
    let ok; Render._luzEm = n; try { ok = Render.umNo(tc, P, q, base, n, m, alfa, fr, nivel); } finally { Render._luzEm = null; }
    if (!ok) return false;
    const L = n.luzBorda, k = Math.hypot(fr.a, fr.b) || 1, bb = this.processa(tc, W, H, L, k);
    if (!bb) return true; // nada visível
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    if (L.sombraContato) this.sombra(ctx, bb, k);
    ctx.drawImage(t, bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0, bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0); ctx.restore();
    return true;
  },
  // sombra de contato: elipse escura e suave embaixo do pé (a linha mais de baixo com tinta)
  sombra(ctx, bb, k) {
    const cx = bb.pe, cy = bb.yt1, rx = Math.max(6 * k, Math.min((bb.xt1 - bb.xt0) * .42, 160 * k)), ry = Math.max(3 * k, rx * .16);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(0,0,0,.38)'); g.addColorStop(.55, 'rgba(0,0,0,.2)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  },
  /* a conta do rim() nos pixels (só na caixa onde há tinta + a margem do deslocamento e do desfoque). Devolve a caixa mexida. */
  processa(g, W, H, L, k) {
    const d = g.getImageData(0, 0, W, H), p = d.data, u32 = new Uint32Array(p.buffer);
    let xt0 = W, yt0 = H, xt1 = -1, yt1 = -1; // caixa da tinta
    for (let y = 0; y < H; y++) { const o = y * W; let a = -1, b = -1; for (let x = 0; x < W; x++) if (u32[o + x] >>> 24) { a = x; break; } if (a < 0) continue; for (let x = W - 1; x >= a; x--) if (u32[o + x] >>> 24) { b = x; break; } if (a < xt0) xt0 = a; if (b > xt1) xt1 = b; if (y < yt0) yt0 = y; yt1 = y; }
    if (xt1 < 0) return null;
    // onde fica o pé: meio da tinta nas últimas linhas
    let pe = 0, np = 0; for (let y = Math.max(yt0, yt1 - Math.max(2, Math.round((yt1 - yt0) * .03))); y <= yt1; y++) for (let x = xt0; x <= xt1; x++) if (u32[y * W + x] >>> 24) { pe += x; np++; }
    const ds = this.desloc(L), sx = ds.x * k, sy = ds.y * k, sig = (L.suave ?? 1.6) * k, mg = Math.ceil(Math.hypot(sx, sy) + sig * 3 + 3);
    const x0 = Math.max(0, xt0 - mg), y0 = Math.max(0, yt0 - mg), x1 = Math.min(W, xt1 + 1 + mg), y1 = Math.min(H, yt1 + 1 + mg), w = x1 - x0, h = y1 - y0, N = w * h;
    const al = new Float32Array(N); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) al[y * w + x] = p[((y + y0) * W + x + x0) * 4 + 3] / 255;
    // alfa do pixel que fica na direção do sol (fora da caixa = vazio); deslocamento fracionário = bilinear
    const amostra = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, at = (a, b) => a < 0 || b < 0 || a >= w || b >= h ? 0 : al[b * w + a];
      if (!fx && !fy) return at(xi, yi); return at(xi, yi) * (1 - fx) * (1 - fy) + at(xi + 1, yi) * fx * (1 - fy) + at(xi, yi + 1) * (1 - fx) * fy + at(xi + 1, yi + 1) * fx * fy; };
    const f = Math.fround, b8 = new Uint8Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, a = al[i]; if (!a) continue; const des = amostra(x + sx, y + sy); b8[i] = Math.floor(f(f(Math.min(1, Math.max(0, f(a - des)))) * a) * 255); }
    this.desfoca(b8, w, h, sig);
    const c = this.cor(L.cor), fo = L.forca ?? .85, aq = L.aquece !== false ? this.AQUECE : [1, 1, 1], cf = [c[0] / 255 * fo, c[1] / 255 * fo, c[2] / 255 * fo];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, a = al[i]; if (!a) continue; const bo = f(f(b8[i] / 255) * a), j = ((y + y0) * W + x + x0) * 4;
      for (let ch = 0; ch < 3; ch++) { const v = f(f(1 - f(f(1 - f(p[j + ch] / 255)) * f(1 - f(cf[ch] * bo)))) * aq[ch]); p[j + ch] = Math.floor(f(Math.min(1, Math.max(0, v))) * 255); }
    }
    g.putImageData(d, 0, 0, x0, y0, w, h);
    return { x0, y0, x1, y1, xt0, yt0, xt1, yt1: yt1 + 1, pe: np ? pe / np + .5 : (xt0 + xt1 + 1) / 2 };
  },
  /* GaussianBlur do Pillow (BoxBlur.c): 3 passadas de caixa com raio fracionário na horizontal e depois 3 na vertical, cada uma
     arredondando para 8 bits; borda = repete o pixel da ponta. a: Uint8Array w×h, no lugar. */
  raioPil(r, passes = 3) {
    const f = Math.fround, s2 = f(f(r * r) / passes), L = f(Math.sqrt(f(f(12 * s2) + 1))), l = Math.floor(f((L - 1) / 2));
    let a = f(f(2 * l + 1) * f(f(l * (l + 1)) - f(3 * s2))); a = f(a / f(6 * f(s2 - f((l + 1) * (l + 1))))); return f(l + a);
  },
  desfoca(a, w, h, raio) {
    if (!(raio > 0)) return a; const g = this.raioPil(raio), R = Math.floor(g), ww = Math.floor(Math.fround(16777216 / Math.fround(Math.fround(g * 2) + 1))), fw = Math.floor((16777216 - (R * 2 + 1) * ww) / 2);
    const lin = new Uint8Array(Math.max(w, h));
    const linha = (o, st, n) => {
      for (let i = 0; i < n; i++) lin[i] = a[o + i * st]; const last = n - 1, cl = i => i < 0 ? 0 : i > last ? last : i;
      let acc = 0; for (let j = -R - 1; j <= R - 1; j++) acc += lin[cl(j)]; // janela do x = -1
      for (let x = 0; x < n; x++) { acc += lin[cl(x + R)] - lin[cl(x - R - 1)]; a[o + x * st] = Math.floor((acc * ww + (lin[cl(x - R - 1)] + lin[cl(x + R + 1)]) * fw + 8388608) / 16777216); }
    };
    for (let ps = 0; ps < 3; ps++) for (let y = 0; y < h; y++) linha(y * w, 1, w);
    for (let ps = 0; ps < 3; ps++) for (let x = 0; x < w; x++) linha(x, w, h);
    return a;
  },
};
