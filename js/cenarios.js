/* ===================== cenarios.js — cenários no estilo da casa (feltro/giz pastel) =====================
   Um cenário é um JSON de CAMADAS de formas chapadas, sempre em 1920×1080, desenhadas de trás para a frente:
     { nome, camadas: [ { c:"#cor", t:textura, b:borda, f:[formas] } | { degrade:{ de, ate, cor, forca } } ] }
   Formas: ["ret",x0,y0,x1,y1] · ["red",x0,y0,x1,y1,raio] · ["elipse",x0,y0,x1,y1] · ["poli",x,y,x,y,…]
           ["linha",esp,x,y,x,y,…] · ["anel",x0,y0,x1,y1,esp] · ["arco",x0,y0,x1,y1,grau0,grau1,esp]
   O desenho dá o acabamento: borda felpuda (como feltro/papel rasgado), granulado dentro de cada cor e um grão fino
   por cima, tudo nítido (sem desfoque). Os cenários prontos ficam em cenarios/*.json; a IA aprende o estilo com eles
   (guia completo em cenarios/ESTILO.md). */
'use strict';
const Cenarios = {
  W: 1920, H: 1080,
  PRONTOS: [
    { id: 'sala', nome: 'Sala de estar' }, { id: 'cozinha', nome: 'Cozinha' }, { id: 'jardim', nome: 'Jardim' },
    { id: 'sala-de-aula', nome: 'Sala de aula' }, { id: 'escola', nome: 'Frente da escola' }, { id: 'cidade', nome: 'Cidade pequena' },
  ],
  _json: {},
  async pronto(id) {
    if (!this._json[id]) { const r = await fetch('cenarios/' + id + '.json'); if (!r.ok) throw new Error('Não achei o cenário "' + id + '".'); this._json[id] = await r.json(); }
    return this._json[id];
  },

  /* ---------- ruído (gerado uma vez) ---------- */
  _rnd: null,
  rnd() { // aleatório com semente, para o mesmo cenário sair sempre igual
    let s = this._semente >>> 0 || 7;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  },
  campo(escala, R) { // ruído de valor suavizado, centrado em 0 (de -0.5 a 0.5)
    const W = this.W, H = this.H, out = new Float32Array(W * H);
    if (escala <= 1) { for (let i = 0; i < out.length; i++) out[i] = R() - .5; return out; }
    const gw = Math.ceil(W / escala) + 2, gh = Math.ceil(H / escala) + 2, g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = R() - .5;
    const sm = t => t * t * (3 - 2 * t);
    for (let y = 0; y < H; y++) { const fy = y / escala, iy = fy | 0, ty = sm(fy - iy);
      for (let x = 0; x < W; x++) { const fx = x / escala, ix = fx | 0, tx = sm(fx - ix), a = iy * gw + ix;
        const v0 = g[a] + (g[a + 1] - g[a]) * tx, v1 = g[a + gw] + (g[a + gw + 1] - g[a + gw]) * tx; out[y * W + x] = v0 + (v1 - v0) * ty; } }
    return out;
  },
  ruidos() {
    if (this._ruidos) return this._ruidos;
    this._semente = 7; const R = this.rnd(), n = this.W * this.H;
    const a3 = this.campo(3, R), a1 = this.campo(1, R), b40 = this.campo(40, R), b6 = this.campo(6, R), b1 = this.campo(1, R);
    const borda = new Float32Array(n), tex = new Float32Array(n);
    for (let i = 0; i < n; i++) { borda[i] = (a3[i] * .55 + a1[i] * .35) * .35; tex[i] = b40[i] * .6 + b6[i] * .5 + b1[i]; }
    return (this._ruidos = { borda, tex });
  },

  /* ---------- formas → máscara (só na caixa da camada) ---------- */
  caixa(f) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const p = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const s of f) { const [t, ...v] = s;
      if (t === 'poli') for (let i = 0; i + 1 < v.length; i += 2) p(v[i], v[i + 1]);
      else if (t === 'linha') for (let i = 1; i + 1 < v.length; i += 2) { p(v[i] - v[0], v[i + 1] - v[0]); p(v[i] + v[0], v[i + 1] + v[0]); }
      else { p(v[0], v[1]); p(v[2], v[3]); } }
    return { x0, y0, x1, y1 };
  },
  // monta o caminho da forma; devolve a espessura se for traço (linha/anel/arco) ou 0 se for preenchimento
  caminho(ctx, s) {
    const [t, ...v] = s.map((x, i) => i ? +x : x); ctx.beginPath();
    if (t === 'ret') ctx.rect(v[0], v[1], v[2] - v[0] + 1, v[3] - v[1] + 1);
    else if (t === 'red') { const [a, b, c, d] = v, r = Math.max(0, Math.min(v[4] || 0, (c - a) / 2, (d - b) / 2)); ctx.moveTo(a + r, b); ctx.arcTo(c, b, c, d, r); ctx.arcTo(c, d, a, d, r); ctx.arcTo(a, d, a, b, r); ctx.arcTo(a, b, c, b, r); ctx.closePath(); }
    else if (t === 'elipse') ctx.ellipse((v[0] + v[2]) / 2, (v[1] + v[3]) / 2, Math.abs(v[2] - v[0]) / 2, Math.abs(v[3] - v[1]) / 2, 0, 0, Math.PI * 2);
    else if (t === 'poli') { for (let i = 0; i + 1 < v.length; i += 2) i ? ctx.lineTo(v[i], v[i + 1]) : ctx.moveTo(v[i], v[i + 1]); ctx.closePath(); }
    else if (t === 'linha') { for (let i = 1; i + 1 < v.length; i += 2) i > 1 ? ctx.lineTo(v[i], v[i + 1]) : ctx.moveTo(v[i], v[i + 1]); return v[0]; }
    else if (t === 'anel' || t === 'arco') { // a espessura fica para dentro da caixa
      const e = t === 'anel' ? v[4] : v[6], rx = Math.max(.5, Math.abs(v[2] - v[0]) / 2 - e / 2), ry = Math.max(.5, Math.abs(v[3] - v[1]) / 2 - e / 2);
      ctx.ellipse((v[0] + v[2]) / 2, (v[1] + v[3]) / 2, rx, ry, 0, t === 'anel' ? 0 : v[4] * Math.PI / 180, t === 'anel' ? Math.PI * 2 : v[5] * Math.PI / 180); return e; }
    return 0;
  },
  tracar(ctx, s) { const e = this.caminho(ctx, s); if (e) { ctx.lineWidth = e; ctx.lineCap = 'butt'; ctx.stroke(); } else ctx.fill(); },
  desfoca(m, w, h, sigma) { // 3 passadas de caixa ≈ gaussiano
    const r = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2 + .25)), tmp = new Float32Array(m.length), d = 2 * r + 1;
    for (let p = 0; p < 3; p++) {
      for (let y = 0; y < h; y++) { const o = y * w; let s = 0; for (let x = -r; x <= r; x++) s += m[o + clamp(x, 0, w - 1)];
        for (let x = 0; x < w; x++) { tmp[o + x] = s / d; s += m[o + Math.min(x + r + 1, w - 1)] - m[o + Math.max(x - r, 0)]; } }
      for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[clamp(y, 0, h - 1) * w + x];
        for (let y = 0; y < h; y++) { m[y * w + x] = s / d; s += tmp[Math.min(y + r + 1, h - 1) * w + x] - tmp[Math.max(y - r, 0) * w + x]; } }
    }
  },
  cor(hex) { const m = String(hex || '').match(/^#?([0-9a-f]{6})$/i); const v = m ? parseInt(m[1], 16) : 0xcccccc; return [v >> 16 & 255, v >> 8 & 255, v & 255]; },

  /* ---------- PEÇAS: cada objeto do cenário ("o" marca o começo de um objeto; as camadas seguintes são dele) ---------- */
  pecas(cena) {
    const out = [], por = {}; let atual = null;
    (cena?.camadas || []).forEach((L, i) => {
      let nome = L.o ? String(L.o).trim().slice(0, 30) : atual;
      if (!nome) nome = i === 0 ? 'Fundo' : 'Peça ' + (out.length + 1);
      atual = nome;
      if (!por[nome]) out.push(por[nome] = { nome, camadas: [], primeira: i });
      por[nome].camadas.push(L);
    });
    return out;
  },

  /* ---------- pinta camadas num pedaço da tela (cor pré-multiplicada + transparência) ---------- */
  async compor(camadas, rg, opac, prog) {
    const W = this.W, H = this.H, { borda, tex } = this.ruidos(), rw = rg.w, rh = rg.h;
    const img = new Float32Array(rw * rh * 3), A = new Float32Array(rw * rh);
    if (opac) { img.fill(255); A.fill(1); }
    const R = this.rnd(), cv = this._cv || (this._cv = document.createElement('canvas')), ctx = cv.getContext('2d', { willReadFrequently: true });
    for (let ci = 0; ci < camadas.length; ci++) {
      const L = camadas[ci];
      if (ci % 10 === 9) { prog?.(ci / camadas.length); await sleep(0); }
      if (L.degrade) { const g = L.degrade, c = this.cor(g.cor), de = +g.de || 0, ate = Math.max(de + 1, +g.ate || H), fo = clamp(+g.forca || .5, 0, 1);
        for (let y = 0; y < rh; y++) { const t = clamp((rg.y + y - de) / (ate - de), 0, 1) * fo; if (!t) continue;
          for (let x = 0, p = y * rw; x < rw; x++, p++) { const a = A[p] * t, i = p * 3; if (!a) continue; img[i] += (c[0] * A[p] - img[i]) * t; img[i + 1] += (c[1] * A[p] - img[i + 1]) * t; img[i + 2] += (c[2] * A[p] - img[i + 2]) * t; } }
        continue; }
      if (!Array.isArray(L.f) || !L.f.length) continue;
      const sig = clamp(+(L.b ?? 4) || 1, .5, 40), tx = clamp(+(L.t ?? 10), 0, 30), c = this.cor(L.c), mg = Math.ceil(sig * 3) + 4, bb = this.caixa(L.f);
      const x0 = clamp(Math.floor(bb.x0) - mg, rg.x, rg.x + rw), y0 = clamp(Math.floor(bb.y0) - mg, rg.y, rg.y + rh), x1 = clamp(Math.ceil(bb.x1) + mg + 1, rg.x, rg.x + rw), y1 = clamp(Math.ceil(bb.y1) + mg + 1, rg.y, rg.y + rh);
      const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) { R(); R(); R(); R(); continue; }
      cv.width = w; cv.height = h; ctx.setTransform(1, 0, 0, 1, -x0, -y0); ctx.fillStyle = ctx.strokeStyle = '#fff';
      for (const s of L.f) { try { this.tracar(ctx, s); } catch { } }
      const px = ctx.getImageData(0, 0, w, h).data, m = new Float32Array(w * h);
      for (let i = 0; i < m.length; i++) m[i] = px[i * 4 + 3] / 255;
      this.desfoca(m, w, h, sig);
      const ox = (R() * W) | 0, oy = (R() * H) | 0, ex = (R() * W) | 0, ey = (R() * H) | 0;
      for (let y = 0; y < h; y++) { const gy = y0 + y, ty = ((gy + oy) % H) * W, ey2 = ((gy + ey) % H) * W;
        for (let x = 0; x < w; x++) { const a0 = m[y * w + x]; if (a0 <= .02) continue; const gx = x0 + x;
          const a = clamp((a0 - .5 + borda[ey2 + (gx + ex) % W]) * 16 + .5, 0, 1); if (!a) continue;
          const t = tex[ty + (gx + ox) % W] * tx, p = (gy - rg.y) * rw + (gx - rg.x), i = p * 3;
          img[i] += (c[0] + t - img[i]) * a; img[i + 1] += (c[1] + t - img[i + 1]) * a; img[i + 2] += (c[2] + t - img[i + 2]) * a; A[p] += (1 - A[p]) * a; } }
    }
    // grão fino por cima e vira canvas
    const out = document.createElement('canvas'); out.width = rw; out.height = rh;
    const oc = out.getContext('2d'), id = oc.createImageData(rw, rh), d = id.data;
    for (let p = 0, i = 0; p < rw * rh; p++, i += 3) { const a = A[p]; if (a <= .004) continue; const g = (R() + R() + R() - 1.5) * 10, k = 1 / a;
      d[p * 4] = img[i] * k + g; d[p * 4 + 1] = img[i + 1] * k + g; d[p * 4 + 2] = img[i + 2] * k + g; d[p * 4 + 3] = a * 255; }
    oc.putImageData(id, 0, 0); prog?.(1);
    return out;
  },
  // cenário inteiro (canvas 1920×1080)
  async desenhar(cena, aoProgresso) {
    this.ruidos(); this._semente = 99;
    return this.compor((cena?.camadas || []).slice(0, 400), { x: 0, y: 0, w: this.W, h: this.H }, true, aoProgresso);
  },
  // cada peça numa imagem própria, recortada, com a posição dela no cenário
  async desenharPecas(cena, aoProgresso) {
    const ps = this.pecas(cena), out = []; this.ruidos();
    for (let k = 0; k < ps.length; k++) {
      const p = ps[k], bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const L of p.camadas) { if (L.degrade || !L.f?.length) continue; const b = this.caixa(L.f), mg = Math.ceil(clamp(+(L.b ?? 4) || 1, .5, 40) * 3) + 4;
        bb.x0 = Math.min(bb.x0, b.x0 - mg); bb.y0 = Math.min(bb.y0, b.y0 - mg); bb.x1 = Math.max(bb.x1, b.x1 + mg); bb.y1 = Math.max(bb.y1, b.y1 + mg); }
      const x = clamp(Math.floor(bb.x0), 0, this.W), y = clamp(Math.floor(bb.y0), 0, this.H), w = clamp(Math.ceil(bb.x1), 0, this.W) - x, h = clamp(Math.ceil(bb.y1), 0, this.H) - y;
      if (w <= 0 || h <= 0) continue;
      this._semente = 1000 + k;
      const cv = await this.compor(p.camadas, { x, y, w, h }, false, f => aoProgresso?.((k + f) / ps.length));
      out.push({ nome: p.nome, cv, x, y, w, h, primeira: p.primeira });
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
  SIS: `Você é o cenarista do ANIMADOR do Estúdio Problems. Você desenha CENÁRIOS SIMPLES de fundo para animação 2D, sempre no MESMO estilo da casa, descrevendo o cenário como camadas de formas num JSON (o Animador desenha e dá o acabamento sozinho).

O ESTILO DA CASA (siga sempre):
- Ilustração chapada estilo feltro/giz pastel: formas geométricas simples (retângulos, retângulos arredondados, elipses, polígonos), SEM CONTORNO, SEM sombra realista, SEM perspectiva — vista frontal, como cenário de teatro. O acabamento felpudo e o granulado o Animador põe sozinho.
- Cores chapadas pastéis, um pouco apagadas. Paleta da casa (use estas antes de inventar):
  parede #E4DCCF (sombra de canto #DCD3C5) · piso creme #F2E5D2, faixas do piso #E6D3BC, rodapé #CFC4B4 · piso de madeira #D8B98A/#C7A577
  céu #A6D2F0 + {"degrade":{"de":200,"ate":600,"cor":"#C2E1F6","forca":0.6}} · nuvem #F8F8F3 · sol #F8DC7A · morros #9ACD86 · grama #7EC05F (faixas #6EB253)
  vidro #A6D2F0, reflexo do vidro #C6E4F8 (triângulo no canto), moldura #8A8580 ou #9A948C
  madeira #9C6B43 / escura #7B5233 / clara #A97650 / risco de porta #74492C · puxador #E8D9B8
  folhagem #57A055 / #4E9A4D / clara #68B464 · sofá #5EA65A · tronco #7B5233
  metal #A8ADB2 / #8A8F95 / #9AA0A6 · escuro (tela, forno) #3E4853 / #0F2B3F / #2D333A
  destaques: vermelho #D35A4C / telhado #C8574A · rosa #F29BB8 · amarelo #F4D35E · azul-claro #CFE0E4 · menta #CFE3D8 · creme de prédio #EFE7D8
- Detalhes pequenos dão a graça: risco mais escuro dividindo portas, puxadores redondinhos, reflexo diagonal no vidro, faixas horizontais no piso, flores de 4 pétalas, costura no sofá.
- Composição para animação: chão/faixa livre embaixo (de y≈760 a 1080) para os personagens andarem; o centro não pode ficar poluído; móveis encostados na parede, lado a lado; 3 a 6 elementos principais, nada minúsculo demais.
- Ordem: de TRÁS para a FRENTE (fundo inteiro primeiro: {"c":"#E4DCCF","f":[["ret",0,0,1920,1080]],"t":9,"b":1}).

FORMATO (responda SÓ o JSON, sem texto fora dele):
{"nome":"nome curto","total":N,"camadas":[ {"o":"Fundo","c":"#RRGGBB","t":textura,"b":borda,"f":[formas]}, {"degrade":{...}}, ... ]}
- "total" = quantas camadas você vai escrever (escreva logo no começo; serve para mostrar o tempo que falta).
- "o" = nome do OBJETO (Fundo, Janela, Sofá, TV, Árvore…). Ponha "o" só na PRIMEIRA camada de cada objeto; as camadas seguintes são desse objeto até aparecer outro "o". Escreva cada objeto inteiro de uma vez (todas as camadas dele juntas), porque cada objeto vira uma peça separada que dá para mover ou usar sozinha. Parede, piso, rodapé e faixas do piso = "Fundo"; céu = "Céu"; chão de grama/rua = "Chão".
- Tela 1920×1080, números inteiros. "t" = granulado da cor (6 a 12; 4-7 em detalhes pequenos; padrão 10 se omitir). "b" = suavidade da borda (padrão 4; 1 para o fundo inteiro; 2-3 em detalhes pequenos; nunca acima de 8, exceto uma sombra suave larga com 30).
- Formas (várias formas da mesma cor podem ir na mesma camada):
  ["ret",x0,y0,x1,y1]  ["red",x0,y0,x1,y1,raio]  ["elipse",x0,y0,x1,y1]  ["poli",x,y,x,y,...]
  ["linha",espessura,x,y,x,y,...]  ["anel",x0,y0,x1,y1,espessura]  ["arco",x0,y0,x1,y1,grau0,grau1,espessura] (180→360 = metade de cima)
- No máximo ~120 camadas. Seja econômico: junte formas da mesma cor numa camada.

EXEMPLOS DO ESTILO (cenários aprovados pelo dono):`,
  async sistema() {
    if (this._sis) return this._sis;
    const ex = await Promise.all(['sala', 'jardim', 'sala-de-aula'].map(id => this.pronto(id).then(j => JSON.stringify(j)).catch(() => '')));
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
    const L = this.LIM, TIPOS = { ret: 4, red: 5, elipse: 4, poli: 6, linha: 5, anel: 5, arco: 7 }, out = []; let tirou = 0;
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
        if (v.some(x => x === null) || v.length < TIPOS[s[0]] - 1) { tirou++; continue; }
        if (s[0] === 'poli' && v.length % 2) v.pop();
        if (s[0] === 'linha' && !(v.length % 2)) v.pop();
        if (s[0] === 'linha' || s[0] === 'anel' || s[0] === 'arco') { const ie = s[0] === 'linha' ? 0 : v.length - 1; v[ie] = clamp(v[ie], 1, 200); }
        f.push([s[0], ...v]);
      }
      if (!f.length) { tirou++; continue; }
      const n = { c: cor, f }; if (c.t != null && isFinite(+c.t)) n.t = clamp(+c.t, 0, 20); if (c.b != null && isFinite(+c.b)) n.b = clamp(+c.b, .5, 40);
      out.push(obj(c, n));
    }
    if (semFundo) return { cena: { camadas: out }, tirou, uteis: out.length };
    // sem um fundo cobrindo a tela inteira, sairiam buracos brancos: põe a parede da casa atrás
    const cobre = c => c.f?.some(s => s[0] === 'ret' && s[1] <= 0 && s[2] <= 0 && s[3] >= this.W - 1 && s[4] >= this.H - 1);
    if (!out.length || !cobre(out.find(c => !c.degrade) || {})) out.unshift({ o: 'Fundo', c: '#E4DCCF', t: 9, b: 1, f: [['ret', 0, 0, this.W, this.H]] });
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
  guardaUltimo(cena) { this.ultimo = cena; try { localStorage.setItem('animador-cenario-ultimo', JSON.stringify(cena)); } catch { } },
  pegaUltimo() { if (this.ultimo) return this.ultimo; try { const j = JSON.parse(localStorage.getItem('animador-cenario-ultimo') || 'null'); return j?.camadas ? (this.ultimo = { ...this.limpar(j).cena, ia: true }) : null; } catch { return null; } },

  /* ---------- janela "Cenário" ---------- */
  async abrir() {
    if (!App?.P) return UI.toast('Abra uma animação primeiro.', { kind: 'err' });
    const body = h(`<div class="cen">
      <div class="cen-sub">Prontos</div><div class="cen-grade"></div>
      <div class="cen-sub">Pedir à IA <span>(mesmo estilo dos prontos)</span></div>
      <textarea rows="2" maxlength="600" placeholder="Ex.: um quarto de criança com cama, estante e janela à noite"></textarea>
      <div class="cen-prev" hidden><canvas width="960" height="540"></canvas><div class="cen-barra" hidden><i></i></div><div class="cen-st"></div>
        <div class="cen-pecas" hidden><div class="cen-sub">Peças <span>(cada objeto separado: mande para a Mídia ou baixe)</span></div><div class="cen-lista"></div>
          <div class="cen-op"><label class="ck"><input type="checkbox" data-sep checked> Pôr na cena em camadas separadas (uma por peça)</label><button class="btn sm" data-todas>${ic('download', 13)} Todas as peças para a Mídia</button></div></div></div></div>`);
    const prev = $('.cen-prev', body), st = $('.cen-st', body), pc = $('canvas', prev), ta = $('textarea', body), barra = $('.cen-barra', body), lista = $('.cen-lista', body), boxPecas = $('.cen-pecas', body);
    let atual = null, cvAtual = null, pecas = null, ocupado = false, btPor, btAjuste, btCriar, rab = null, vez = 0;
    const trava = sim => { ocupado = sim; [btPor, btAjuste, btCriar].forEach(b => b && (b.disabled = sim || (b === btPor && !cvAtual))); $$('.cen-item', body).forEach(b => b.disabled = sim); ta.disabled = sim; $('[data-todas]', body).disabled = sim; };
    const progresso = f => { barra.hidden = f == null; if (f != null) $('i', barra).style.width = Math.round(clamp(f, 0, 1) * 100) + '%'; };
    const pintaPrevia = (cv, alfa = 1) => { const g = pc.getContext('2d'); g.save(); g.globalAlpha = alfa; g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, pc.width, pc.height); g.restore(); };
    const mostraPecas = () => {
      lista.innerHTML = ''; boxPecas.hidden = !pecas?.length;
      for (const p of pecas || []) {
        const it = h(`<div class="cen-peca" title="${esc(p.nome)} — ${p.w}×${p.h}"><canvas></canvas><span>${esc(p.nome)}</span><button class="ibtn" data-m title="Mandar para a Mídia">${ic('upload', 13)}</button><button class="ibtn" data-b title="Baixar PNG">${ic('download', 13)}</button></div>`);
        const c = $('canvas', it), r = Math.min(64 / p.w, 40 / p.h); c.width = Math.max(1, p.w * r); c.height = Math.max(1, p.h * r); c.getContext('2d').drawImage(p.cv, 0, 0, c.width, c.height);
        $('[data-m]', it).onclick = () => usa(async () => { await Midia.guardar(await this.blob(p.cv), `${atual?.nome || 'Cenário'} · ${p.nome}`, { x: p.x, y: p.y }); UI.toast(`<b>${esc(p.nome)}</b> foi para a Mídia.`, { kind: 'ok' }); });
        $('[data-b]', it).onclick = () => usa(async () => downloadBlob(await this.blob(p.cv), `${slug(atual?.nome)}-${slug(p.nome)}.png`));
        lista.appendChild(it);
      }
    };
    const slug = t => String(t || 'cenario').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cenario';
    // desenha o acabamento final (o cenário inteiro e cada peça); se veio dos rabiscos, troca suave
    const mostra = async (cena, rot, suave) => {
      prev.hidden = false; boxPecas.hidden = true; const minha = ++vez;
      st.textContent = 'Dando o acabamento…'; progresso(0);
      const cv = await this.desenhar(cena, f => progresso(f * .5));
      const ps = await this.desenharPecas(cena, f => progresso(.5 + f * .5));
      if (minha !== vez) return;
      atual = cena; cvAtual = cv; pecas = ps;
      if (suave) for (let i = 1; i <= 12; i++) { pintaPrevia(cv, i / 12); await sleep(30); } else pintaPrevia(cv);
      progresso(null); st.textContent = rot || cena.nome || 'Cenário'; btAjuste.style.display = ''; mostraPecas();
    };
    const usa = async fn => { if (ocupado) return; trava(true); try { await fn(); } catch (e) { prev.hidden = false; progresso(null); st.textContent = 'Não deu: ' + (e?.message || e); console.warn('cenário', e); } trava(false); };
    const grade = $('.cen-grade', body), ult = this.pegaUltimo();
    const item = (nome, mini, fn) => { const b = h(`<button class="cen-item" title="Usar: ${esc(nome)}">${mini ? `<img src="${mini}" alt="">` : '<i></i>'}<span>${esc(nome)}</span></button>`);
      const im = $('img', b); if (im) im.onerror = () => im.replaceWith(h('<i></i>')); b.onclick = () => usa(fn); grade.appendChild(b); };
    for (const p of this.PRONTOS) item(p.nome, `cenarios/miniaturas/${p.id}.jpg`, async () => { rab?.parar(); await mostra(await this.pronto(p.id)); });
    if (ult) item('Último da IA: ' + (ult.nome || 'cenário'), null, async () => { rab?.parar(); await mostra(ult, (ult.nome || 'Cenário') + ' — o último que a IA fez.'); });

    // IA: os rabiscos aparecem conforme as camadas chegam, com o tempo que falta
    const ia = ajuste => usa(async () => {
      const txt = ta.value.trim(); if (!txt) { st.textContent = 'Escreva o que quer no campo acima.'; prev.hidden = false; return; }
      if (ajuste && !atual) return;
      prev.hidden = false; boxPecas.hidden = true; rab?.parar(); rab = this.rabiscador(pc); ++vez;
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
        const r = await this.pedirIA(txt, ajuste ? atual : null, aoEscrever, recomeca);
        // o que ainda não tinha aparecido (ou tudo, se o servidor não manda aos pouquinhos) entra nos rabiscos agora
        if (r.cena.camadas.length > vistas) rab.add(r.cena.camadas.slice(vistas)); vistas = total = r.cena.camadas.length;
        clearInterval(relogio); st.textContent = 'Terminando os rabiscos…'; progresso(.92);
        await Promise.race([rab.terminar(), sleep(6000)]); rab.parar();
        r.cena.ia = true; this.guardaUltimo(r.cena);
        const obs = [r.cortado && 'a resposta veio incompleta e aproveitei o que chegou', r.tirou && `ignorei ${r.tirou} peça(s) com erro`].filter(Boolean).join('; ');
        await mostra(r.cena, (r.cena.nome || 'Cenário') + ` — feito pela IA em ${Math.round((performance.now() - t0) / 1000)} s` + (obs ? ` (${obs})` : '') + '. Gostou? "Pôr na cena", ou escreva um ajuste e clique em "Ajustar".', true);
      } finally { clearInterval(relogio); }
    });
    $('[data-todas]', body).onclick = () => usa(async () => { for (const p of pecas || []) await Midia.guardar(await this.blob(p.cv), `${atual?.nome || 'Cenário'} · ${p.nome}`, { x: p.x, y: p.y }); UI.toast(`${pecas.length} peça(s) foram para a Mídia.`, { kind: 'ok' }); });
    await UI.modal({ title: 'Cenário', icon: 'paisagem', width: 760, body, sticky: true, onOpen: a => {
      [btAjuste, btCriar, btPor] = a.foot.querySelectorAll('.btn'); btPor.disabled = true; btAjuste.style.display = 'none';
    }, buttons: [
      { label: 'Ajustar', kind: 'ia', left: true, onClick: () => { ia(true); return false; } },
      { label: 'Criar com a IA', icon: 'sparkles', kind: 'ia', onClick: () => { ia(false); return false; } },
      { label: 'Pôr na cena', kind: 'primary', onClick: async () => { if (!cvAtual || ocupado) return false; let ok = false; const sep = $('[data-sep]', body).checked;
        await usa(async () => { await (sep && pecas?.length > 1 ? this.porEmCamadas(pecas, atual) : this.porNaCena(cvAtual, atual)); ok = true; }); return ok; } },
    ] });
    rab?.parar();
  },
  async porNaCena(cv, cena) {
    if (!App.P) throw new Error('Nenhuma animação aberta.');
    const n = await App.addCenario(await this.blob(cv), 'Cenário: ' + String(cena?.nome || 'novo').slice(0, 30), { cena, ...(cena?.ia ? { ia: true } : {}) });
    UI.toast(`<b>${esc(cena?.nome || 'Cenário')}</b> entrou no fundo da cena (só nesta animação). Para a equipe usar: botão direito nele › <b>Salvar na nuvem</b>.`, { kind: 'ok', time: 6000 });
    return n;
  },
  // uma pasta com uma camada de imagem por peça, cada uma no lugar dela (a pasta cobre a câmera, como o cenário inteiro)
  async porEmCamadas(pecas, cena) {
    const P = App.P, q = App.q; if (!P) throw new Error('Nenhuma animação aberta.');
    const c = Modelo.camera(P, q), z = c.zoom || 1, s = round(Math.max(P.w / z / this.W, P.h / z / this.H) * 1.02, 3);
    const pasta = Modelo.novoNo('pasta', { nome: 'Cenário: ' + String(cena?.nome || 'novo').slice(0, 30) });
    pasta.de = q; pasta.aberto = false; pasta.cenario = true; pasta.cena = cena;
    pasta.chaves = { [q]: { x: Math.round(c.x - this.W / 2 * s), y: Math.round(c.y - this.H / 2 * s), r: 0, s, sx: 1, op: 1 } };
    for (const p of [...pecas].sort((a, b) => b.primeira - a.primeira)) { // a peça desenhada por último fica na frente
      const blob = await this.blob(p.cv), id = await Arq.guardar(blob); Arq.img.set(id, await createImageBitmap(blob));
      const n = Modelo.novoNo('imagem', { arq: id, nome: p.nome }); n.de = q; n.chaves = { [q]: { x: p.x + p.w / 2, y: p.y + p.h / 2, r: 0, s: 1, sx: 1, op: 1 } };
      pasta.filhos.push(n);
    }
    const i = P.raiz.findIndex(x => x.cenario || x.fundoPadrao); // na frente dos cenários (e do Fundo padrão) e atrás do resto
    if (i >= 0) P.raiz.splice(i, 0, pasta); else P.raiz.push(pasta); App.sel = pasta.id; App.commit('Cenário em camadas');
    UI.toast(`<b>${esc(cena?.nome || 'Cenário')}</b> entrou no fundo da cena com ${pecas.length} peças separadas na pasta. Cada peça dá para salvar na nuvem pelo botão direito.`, { kind: 'ok', time: 6000 });
  },
};
