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
    if (PreviaLeve.ativa) { const s = PreviaLeve.escala(1 / (Math.hypot(inv.a, inv.b) || 1)); if (s < 1) return this.reduzido(cv, W, H, Wv, Hv, inv, q, s); // PRÉVIA LEVE (só no palco tocando)
      if (!this._semGpu) { try { if (this.gpu(cv, W, H, Wv, Hv, inv, q, { w: W, h: H })) return; } catch (e) { console.warn('[A2] sem WebGL2, vai pelo processador', e); this._semGpu = true; } } } // já pequeno: só troca o dither caro pelo barato
    if (!this._semGpu) { try { if (this.gpu(cv, W, H, Wv, Hv, inv, q)) return; } catch (e) { console.warn('[A2] sem WebGL2, vai pelo processador', e); this._semGpu = true; } }
    this.cpu(cv, W, H, Wv, Hv, inv, q);
  },
  /* PRÉVIA LEVE: a mesma conta num tamanho reduzido (s = fração), devolvida esticada no cv. inv passa a ser px do reduzido → px do
     vídeo (a vinheta continua no lugar certo). Na placa: lê o cv inteiro com filtro linear direto no tamanho reduzido; dither barato
     (o LCG do dither do ffmpeg custa caro: aqui um ruído barato do mesmo tamanho). Só no palco tocando (nunca no export). */
  reduzido(cv, W, H, Wv, Hv, inv, q, s) {
    const w = Math.max(1, Math.round(W * s)), h = Math.max(1, Math.round(H * s)), iv = inv.multiply(new DOMMatrix().scale(W / w, H / h));
    if (!this._semGpu) { try { if (this.gpu(cv, W, H, Wv, Hv, iv, q, { w, h })) return; } catch (e) { console.warn('[A2] sem WebGL2, vai pelo processador', e); this._semGpu = true; } }
    let c = this._red; if (!c) c = this._red = new OffscreenCanvas(w, h); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'copy'; g.imageSmoothingEnabled = true; g.drawImage(cv, 0, 0, W, H, 0, 0, w, h); g.globalCompositeOperation = 'source-over';
    this.cpu(c, w, h, Wv, Hv, iv, q);
    const x = cv.getContext('2d'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.filter = 'none'; x.globalCompositeOperation = 'copy'; x.imageSmoothingEnabled = true; x.drawImage(c, 0, 0, w, h, 0, 0, W, H); x.restore();
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
uniform vec3 u_cs; uniform vec3 u_ch; uniform vec2 u_eq; uniform float u_ang; uniform bool u_red;
out vec4 o;
uint lcg(uint k) { uint a = 1664525u, c = 1013904223u, r = 0u; for (int i = 0; i < 32; i++) { if (k == 0u) break; if ((k & 1u) != 0u) r = r * a + c; c = (a + 1u) * c; a = a * a; k >>= 1; } return r; }
float dit(uint k) { if (u_red) { uint h = k * 2654435761u; h ^= h >> 15u; return float(h >> 8u) / 16777216.; } return float(lcg(k) >> 8u) / 16777216.; } /* prévia leve: um ruído barato no lugar do LCG (sem faixas na vinheta) */
float rnd(float x) { return floor(x + .5); }
void main() {
  ivec2 p = ivec2(int(gl_FragCoord.x), int(u_tam.y - gl_FragCoord.y)); /* linha 0 = topo do canvas */
  vec4 t = u_red ? texture(u_t, (vec2(p) + .5) / u_tam) : texelFetch(u_t, p, 0); /* prévia leve: o cv inteiro lido no tamanho reduzido */
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
  // red = { w, h }: prévia leve (a saída tem w×h e volta esticada para o cv; inv = px do reduzido → px do vídeo)
  gpu(cv, W, H, Wv, Hv, inv, q, red = null) {
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
      gl.useProgram(pr); const u = {}; for (const n of ['u_t', 'u_tam', 'u_vid', 'u_i0', 'u_i1', 'u_q', 'u_cs', 'u_ch', 'u_eq', 'u_ang', 'u_red']) u[n] = gl.getUniformLocation(pr, n);
      gl.uniform1i(u.u_t, 0);
      c.addEventListener('webglcontextlost', e => { e.preventDefault(); this._gl = null; }); // perdeu a placa: refaz na próxima
      s = this._gl = { c, gl, u };
    }
    const { c, gl, u } = s; if (gl.isContextLost()) { this._gl = null; return false; }
    const ow = red ? red.w : W, oh = red ? red.h : H, fl = red ? gl.LINEAR : gl.NEAREST;
    if (c.width !== ow || c.height !== oh) { c.width = ow; c.height = oh; }
    gl.viewport(0, 0, ow, oh); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, fl); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, fl);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    const [ek, eb] = this.eqK();
    gl.uniform2f(u.u_tam, ow, oh); gl.uniform1i(u.u_red, red ? 1 : 0); gl.uniform2f(u.u_vid, Wv, Hv); gl.uniform3f(u.u_i0, inv.a, inv.c, inv.e); gl.uniform3f(u.u_i1, inv.b, inv.d, inv.f); gl.uniform1ui(u.u_q, Math.max(0, q | 0) >>> 0);
    gl.uniform3fv(u.u_cs, this.CB.s); gl.uniform3fv(u.u_ch, this.CB.h); gl.uniform2f(u.u_eq, ek, eb); gl.uniform1f(u.u_ang, this.ANGULO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const g = cv.getContext('2d'); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'copy'; if (red) { g.imageSmoothingEnabled = true; g.drawImage(c, 0, 0, ow, oh, 0, 0, W, H); } else g.drawImage(c, 0, 0); g.restore();
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
     para o ctx. Devolve true se desenhou algo.
     PRÉVIA LEVE (só no palco tocando, PreviaLeve.ativa): a camada é desenhada e processada num canvas reduzido (escala s; largura,
     desfoque e sombra seguem o k reduzido, então ficam proporcionais) e o resultado é desenhado esticado.
     CACHE (só no palco, PreviaLeve.palco): se a chave do desenho (bitmaps, matrizes na tela, opacidade, filtro, números da luz, tamanho)
     for igual à do último desenho desta camada, reaproveita o resultado sem refazer a conta. O export nunca passa por aqui. */
  _cache: new Map(), // id do nó → { ch, ok, cv, bb, sx, sy }
  desenha(ctx, P, q, base, n, m, alfa, fr, nivel) {
    const W = ctx.canvas.width, H = ctx.canvas.height, L = n.luzBorda, k0 = Math.hypot(fr.a, fr.b) || 1;
    const s = PreviaLeve.escala(k0), info = PreviaLeve.palco ? this.chave(P, q, base, n, m, alfa, W, H, s) : null, ch = info?.ch;
    if (ch) { const c = this._cache.get(n.id); if (c && c.ch === ch) { if (c.cv) this.passa(ctx, c.cv, 0, 0, c.bb, c.sx, c.sy, L, k0); return c.ok; } }
    const Ws = s < 1 ? Math.max(1, Math.round(W * s)) : W, Hs = s < 1 ? Math.max(1, Math.round(H * s)) : H, sx = Ws / W, sy = Hs / H;
    const S = s < 1 ? new DOMMatrix().scale(sx, sy) : null, f2 = S ? S.multiply(fr) : fr, k = S ? Math.hypot(f2.a, f2.b) || 1 : k0;
    /* prévia leve: só a caixa da camada (+ a margem do deslocamento e do desfoque), cortada na borda da tela, sem ler a tela inteira.
       R em px do canvas reduzido. Parado fica na tela inteira (desenhar deslocado muda o liso de alguns pixels; parado = igual a antes).
       Sem caixa (filtro de cor/luz etc.): a tela inteira, como no export. */
    let R = { x: 0, y: 0, w: Ws, h: Hs };
    if (info?.box && PreviaLeve.ativa) { const b = info.box, ds = this.desloc(L), mg = Math.ceil(Math.hypot(ds.x * k, ds.y * k) + (L.suave ?? 1.6) * k * 3 + 3) + 3;
      const x0 = Math.max(0, Math.floor(b.x0 * sx) - mg), y0 = Math.max(0, Math.floor(b.y0 * sy) - mg), x1 = Math.min(Ws, Math.ceil(b.x1 * sx) + mg), y1 = Math.min(Hs, Math.ceil(b.y1 * sy) + mg);
      if (x1 <= x0 || y1 <= y0) { this.guarda(n, { ch, ok: true }); return true; } // fora da tela
      R = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
    const t = this._tela(R.w, R.h), tc = this._cx;
    tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, R.w, R.h); tc.globalAlpha = 1; tc.filter = 'none'; tc.globalCompositeOperation = 'source-over';
    let T = S; if (R.x || R.y) T = new DOMMatrix().translate(-R.x, -R.y).multiply(S || new DOMMatrix());
    const b2 = T ? T.multiply(base) : base, f3 = T ? T.multiply(fr) : fr;
    let ok; Render._luzEm = n; try { ok = Render.umNo(tc, P, q, b2, n, m, alfa, f3, nivel); } finally { Render._luzEm = null; }
    if (!ok) { if (ch) this.guarda(n, { ch, ok: false }); return false; }
    const bl = this.processa(tc, R.w, R.h, L, k);
    if (!bl) { if (ch) this.guarda(n, { ch, ok: true }); return true; } // nada visível
    const bb = R.x || R.y ? { x0: bl.x0 + R.x, y0: bl.y0 + R.y, x1: bl.x1 + R.x, y1: bl.y1 + R.y, xt0: bl.xt0 + R.x, yt0: bl.yt0 + R.y, xt1: bl.xt1 + R.x, yt1: bl.yt1 + R.y, pe: bl.pe + R.x } : bl;
    if (ch) { // guarda só a caixa mexida
      const w = bl.x1 - bl.x0, h = bl.y1 - bl.y0, c = this._cache.get(n.id)?.cv || document.createElement('canvas'); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } else c.getContext('2d').clearRect(0, 0, w, h);
      c.getContext('2d').drawImage(t, bl.x0, bl.y0, w, h, 0, 0, w, h); this.guarda(n, { ch, ok: true, cv: c, bb, sx, sy });
    }
    this.passa(ctx, t, bl.x0, bl.y0, bb, sx, sy, L, k0);
    return true;
  },
  // passa a caixa processada (que começa em ox, oy no canvas src) para o ctx; sx/sy = escala da prévia leve (1 = tamanho cheio)
  passa(ctx, src, ox, oy, bb, sx, sy, L, k0) {
    const w = bb.x1 - bb.x0, h = bb.y1 - bb.y0;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    if (sx === 1 && sy === 1) { if (L.sombraContato) this.sombra(ctx, bb, k0); ctx.drawImage(src, ox, oy, w, h, bb.x0, bb.y0, w, h); }
    else { if (L.sombraContato) this.sombra(ctx, { pe: bb.pe / sx, yt1: bb.yt1 / sy, xt0: bb.xt0 / sx, xt1: bb.xt1 / sx }, k0); ctx.drawImage(src, ox, oy, w, h, bb.x0 / sx, bb.y0 / sy, w / sx, h / sy); }
    ctx.restore();
  },
  guarda(n, c) { this._cache.set(n.id, c); if (this._cache.size > 64) this._cache.delete(this._cache.keys().next().value); },
  // id de cada bitmap (a prévia do pincel troca o bitmap da mesma chave: id novo = cache novo)
  _ids: new WeakMap(), _prox: 1,
  idBm(b) { if (!b) return 'x'; let i = this._ids.get(b); if (!i) { i = this._prox++; this._ids.set(b, i); } return i + ':' + b.width + 'x' + b.height; },
  mat(M) { return M.a + ',' + M.b + ',' + M.c + ',' + M.d + ',' + M.e + ',' + M.f; },
  /* chave barata do que a camada desenha neste quadro (sem olhar pixels) + a caixa dela na tela (px do canvas cheio). null = não
     guardar (trêmulo, deformar: mudam com o quadro). box null = sem caixa (filtro de cor/luz pode espalhar a tinta: tela inteira). */
  chave(P, q, base, n, m, alfa, W, H, s) {
    if (n.tremulo || (n.chaves && typeof Deformar !== 'undefined' && Deformar.em(n, q))) return null;
    const t = Modelo.transfVis(n, q), a = alfa * (t.op ?? 1), mm = Render.matVis(P, n, q, m, t), fx = (n.chaves && Modelo.filtroFx(Modelo.fxNo(n, q))) || '';
    const o = [n.id, W, H, s, a, fx, Render._fx || '', JSON.stringify(n.luzBorda)], aoChegar = () => Render.aoChegarImagem?.();
    const bx = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }, poe = (M, x, y, w, h) => { for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { const p = M.transformPoint(new DOMPoint(px, py)); if (p.x < bx.x0) bx.x0 = p.x; if (p.x > bx.x1) bx.x1 = p.x; if (p.y < bx.y0) bx.y0 = p.y; if (p.y > bx.y1) bx.y1 = p.y; } };
    if (n.tipo === 'personagem') {
      for (const it of Render.pecasPersonagem(P, n, q, mm)) { if (!it.img) continue; const im = it.img, M = base.multiply(it.m), px = im.pivo?.x ?? im.w / 2, py = im.pivo?.y ?? im.h / 2;
        o.push(this.idBm(Arq.comAp(Render.bm(im.k), it, aoChegar)), this.mat(M), it.op ?? 1, im.w, im.h, im.pivo?.x, im.pivo?.y, im.ajuste?.x, im.ajuste?.y);
        poe(M, -px + (im.ajuste?.x || 0), -py + (im.ajuste?.y || 0), im.w, im.h); }
    } else { const bm = Render.bm(n.arq), M = base.multiply(mm); o.push(this.idBm(bm), this.mat(M)); if (bm) poe(M, -bm.width / 2, -bm.height / 2, bm.width, bm.height); }
    const box = !fx && !Render._fx && isFinite(bx.x0) ? { x0: bx.x0 - 2, y0: bx.y0 - 2, x1: bx.x1 + 2, y1: bx.y1 + 2 } : null; // +2: o liso da borda
    return { ch: o.join('|'), box };
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

/* PRÉVIA LEVE (12/11/2026): durante o PLAY do palco, GradeA2 e LuzBorda são calculados em resolução reduzida (FRACAO do vídeo:
   metade = o quadro da câmera com ~960×540 px) e desenhados esticados, para não travar. Parado/scrub e o EXPORT ficam em resolução
   cheia, iguais a antes: `ativa` só é ligada pelo App.desenhaPalco enquanto toca (o export nunca passa por ele). `palco` liga o cache
   da luz de borda (LuzBorda.chave). Botão "Prévia leve" na barra da timeline (#t-leve), guardado no localStorage 'animador-previa-leve'. */
const PreviaLeve = {
  CHAVE: 'animador-previa-leve', FRACAO: .5,
  on: (() => { try { return localStorage.getItem('animador-previa-leve') !== '0'; } catch { return true; } })(),
  palco: false, ativa: false,
  // escala do cálculo para uma camada cujo vídeo aparece com k px de tela por px do vídeo (1 = cheia; perto de 1 não vale a pena)
  escala(k) { if (!this.ativa) return 1; const s = this.FRACAO / (k || 1); return s >= .85 ? 1 : s; },
  /* palco no modo Cena com o visual antigo A2 do projeto (P.efeitos.visual): como o A2 vale no quadro inteiro, desenhar tudo na
     resolução cheia só para reduzir depois é trabalho jogado fora. Tocando, desenha o palco inteiro já reduzido (V escalado), passa o
     A2 e estica no ctx. Devolve false quando não se aplica (o App desenha do jeito normal). */
  palcoA2(ctx, P, q, V, dpr = 1) {
    if (!this.ativa || typeof GradeA2 === 'undefined' || Efeitos.grade(P.efeitos?.visual) !== 'a2') return false;
    let fr; try { fr = V.multiply(Render.matCamera(P, q, P.w, P.h).inverse()); } catch { return false; }
    const s = this.escala(Math.hypot(fr.a, fr.b) || 1); if (s >= 1) return false;
    const W = ctx.canvas.width, H = ctx.canvas.height, w = Math.max(1, Math.round(W * s)), h = Math.max(1, Math.round(H * s)), Vs = new DOMMatrix().scale(w / W, h / H).multiply(V);
    let c = this._cv; if (!c) c = this._cv = new OffscreenCanvas(w, h); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'source-over'; g.fillStyle = '#151515'; g.fillRect(0, 0, w, h);
    g.save(); g.filter = Efeitos.filtro(P, q); Render.camadas(g, P, q, Vs, 1, { fundo: true, sombra: dpr * w / W }); g.restore();
    let inv = null; try { inv = Vs.multiply(Render.matCamera(P, q, P.w, P.h).inverse()).inverse(); } catch { } if (inv) GradeA2.aplica(c, P.w, P.h, inv, q);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'copy'; ctx.imageSmoothingEnabled = true; ctx.drawImage(c, 0, 0, w, h, 0, 0, W, H); ctx.restore();
    return true;
  },
  troca(v = !this.on) { this.on = !!v; try { localStorage.setItem(this.CHAVE, this.on ? '1' : '0'); } catch { } this.pintaBotao(); if (typeof App !== 'undefined' && App.P) App.pinta(); },
  pintaBotao() { const b = typeof document !== 'undefined' && document.getElementById('t-leve'); if (b) { b.classList.toggle('on', this.on); b.setAttribute('aria-pressed', this.on ? 'true' : 'false'); } },
};
