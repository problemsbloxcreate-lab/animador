/* ===================== cenoficial.js — GERADOR DE CENÁRIOS OFICIAIS (estilo do Planetário) =====================
   Os cenários OFICIAIS são os do estilo "pintado azul com profundidade" (o modelo é o Planetário do Problems, guia em
   cenarios/CAMADAS.md). A IA descreve o cenário em formas simples (JSON, coordenadas da tela 1920×1080) e ESTE arquivo
   desenha cada objeto como uma camada SVG com as mesmas regras do svglib.py: parede em degradê (escuro embaixo à esquerda,
   claro em cima à direita), chão com UM ponto de fuga, sombra borrada, brilho fino na borda do lado da luz, contorno
   #0f1433, primeiro plano desfocado e a MESMA luz ambiente em todas as camadas (feImage + feComposite, como o luz_ambiente).
   O resultado é um pacote 'cenario-camadas' (o mesmo da janela Cenários) marcado { cat: 'oficial', aprovar: true }:
   é um RASCUNHO até o dono aprovar; os que vão para a casa são acabados à mão pelo guia CAMADAS.md.
   Segurança: nada da IA vira SVG direto — só números, cores #hex e caminhos com letras de path são aceitos. */
'use strict';
const CenOficial = {
  W: 1920, H: 1080,
  LIM: { camadas: 36, formas: 70, pontos: 160, coord: 4000, tempo: 180000 },
  CONTORNO: '#0f1433',
  SIS: `Você é o cenarista OFICIAL do Estúdio Problems (série "A Cor Escondida"). Você desenha cenários de fundo para animação 2D no ESTILO DA CASA: "pintado azul com profundidade" — o mesmo do Planetário do Problems (a imagem que vem junto é ele; copie o JEITO, não os objetos).
O estilo:
- Luz pintada: a luz vem de CIMA À DIREITA. Lados e topos virados para a direita/cima são mais claros; lados virados para a esquerda/baixo, mais escuros. Use degradês (duas cores) nas superfícies grandes.
- Profundidade de verdade: chão em perspectiva com UM ponto de fuga (o mesmo de "fundo.fuga"). Móveis e caixas mostram a frente + o lado e o topo fugindo para o ponto de fuga.
- Paleta fria (azuis, índigos, lilás) com poucos acentos quentes. Contorno escuro fino é posto pelo programa.
- Cena LIMPA: poucos objetos, cada um significativo. Respiro na parede. Nada de detalhe miúdo espalhado.
- PROIBIDO (regras do dono): camisetas, luzinhas/varal de luz/pisca-pisca, brilho ou luz de janela. Não escreva textos/letras.
- O poder do Problems é GELO: cristais e objetos de gelo combinam quando o lugar é dele.
- Objetos em primeiro plano (bem perto da câmera, cortados pela borda de baixo) vão com "plano":"frente" (o programa desfoca).
- O vídeo é um SHORT VERTICAL: a câmera mostra só uma faixa do meio (x de ~660 a ~1260) e pode passear para os lados. O que importa fica nessa faixa; os lados completam. Deixe o meio do chão (x 760–1160, y 760–1000) livre para os personagens ficarem de pé.

Responda SÓ com um JSON (sem texto antes ou depois):
{"nome":"nome curto do lugar","tags":["quarto","escola",...],
 "fundo":{"tipo":"interno"|"externo","parede":["#cor escura (embaixo à esquerda)","#cor clara (em cima à direita)"],"chao":["#cor do chão longe","#cor do chão perto"],"horizonte":680,"fuga":[960,560]},
 "camadas":[{"nome":"Estante","plano":"fundo"|"meio"|"frente","formas":[ FORMA, ... ]}, ...]}
"horizonte" = y onde a parede encontra o chão (580–760). "externo" = céu no lugar da parede e chão de terra/grama/calçada.
Cada camada é UM objeto (estante, janela, mesa, cama, quadro, planta, cristal…), de trás para a frente. Máximo 22 camadas, até ~40 formas cada.
FORMA = {"f":FIG,"cor":COR,"sombra":true|false,"luz":true|false,"contorno":0..5,"op":0..1}
  FIG: ["ret",x0,y0,x1,y1]  ["red",x0,y0,x1,y1,raio]  ["elipse",x0,y0,x1,y1]  ["poli",x,y,x,y,...]  ["linha",espessura,x,y,x,y,...]  ["curva","M x y C x y x y x y ... Z"]
  COR: "#rrggbb" | ["#cor de cima","#cor de baixo"] (degradê vertical) | {"h":["#esquerda","#direita"]} (degradê horizontal)
  "sombra": sombra borrada projetada (use nos objetos que encostam na parede/chão). "luz": brilho fino na borda do lado da luz (use nas faces da frente/topo).
  "contorno": grossura do contorno escuro (padrão 3; 0 = sem contorno, para reflexos e manchas de luz).
Coordenadas em pixels da tela 1920×1080 (inteiros), o mesmo sistema para todas as camadas.`,

  /* ---------- pedir à IA ---------- */
  async refImg() {
    if (this._ref !== undefined) return this._ref;
    try { const b = await (await fetch('cenarios/planetario/miniatura.jpg')).blob(); this._ref = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(b); }); }
    catch { this._ref = null; }
    return this._ref;
  },
  // pedido = o que desenhar; o.anterior = JSON do cenário para ajustar; o.figura = data URL do cenário de agora (para a IA ver o que ajustar)
  async pedirIA(pedido, o = {}) {
    pedido = String(pedido || '').slice(0, 900);
    const ref = await this.refImg(), content = [];
    if (ref) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: ref } }, { type: 'text', text: '↑ O PLANETÁRIO DO PROBLEMS: o estilo oficial (copie a luz, as cores, a perspectiva e o respiro; não os objetos).' });
    if (o.figura && /^data:image\/(png|jpeg);base64,/.test(o.figura)) content.push({ type: 'image', source: { type: 'base64', media_type: o.figura.slice(5, o.figura.indexOf(';')), data: o.figura.split(',')[1] } }, { type: 'text', text: '↑ COMO O CENÁRIO ESTÁ AGORA (desenhado pelo programa).' });
    const base = o.anterior ? `CENÁRIO ATUAL (JSON):\n${JSON.stringify(o.anterior)}\n\nAJUSTE PEDIDO: ${pedido}\nDevolva o cenário INTEIRO já ajustado, no mesmo estilo e formato.` : `PEDIDO DE CENÁRIO: ${pedido}${o.contexto ? `\nCONTEXTO DO SHORT: ${String(o.contexto).slice(0, 600)}` : ''}`;
    for (let tent = 0; tent < 2; tent++) {
      const txt = tent ? base + '\n\nIMPORTANTE: a resposta anterior veio quebrada ou vazia. Faça mais simples (no máximo 14 camadas) e responda só o JSON.' : base;
      let limite; const tempo = new Promise((_, no) => { limite = setTimeout(() => no(new Error('A IA demorou demais. Tente de novo ou peça algo mais simples.')), this.LIM.tempo); });
      let out; try { out = await Promise.race([IA.chama(this.SIS, [...content, { type: 'text', text: txt }], o.aoEscrever, { tipo: 'cenario', titulo: o.anterior ? 'Ajustando o cenário oficial' : 'Desenhando o cenário oficial' }), tempo]); } finally { clearTimeout(limite); }
      let j = null; try { j = IA.json(out); } catch { }
      const r = j && this.limpar(j);
      if (r && r.camadas.length) return r;
      if (tent) throw new Error('A IA não conseguiu montar o cenário. Tente descrever com menos coisas.');
    }
  },

  /* ---------- limpar o que veio (só números, #hex e paths) ---------- */
  hex(c) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim().toLowerCase() : null; },
  corDe(c) {
    if (this.hex(c)) return this.hex(c);
    if (Array.isArray(c) && this.hex(c[0]) && this.hex(c[1])) return { v: [this.hex(c[0]), this.hex(c[1])] };
    if (c && Array.isArray(c.h) && this.hex(c.h[0]) && this.hex(c.h[1])) return { h: [this.hex(c.h[0]), this.hex(c.h[1])] };
    if (c && Array.isArray(c.v) && this.hex(c.v[0]) && this.hex(c.v[1])) return { v: [this.hex(c.v[0]), this.hex(c.v[1])] };
    return null;
  },
  n(v) { v = +v; return isFinite(v) ? clamp(Math.round(v * 10) / 10, -this.LIM.coord, this.LIM.coord) : null; },
  fig(F) {
    if (!Array.isArray(F) || typeof F[0] !== 'string') return null;
    const t = F[0], nums = F.slice(1).map(v => this.n(v));
    if (t === 'curva') { const d = String(F[1] || '').slice(0, 6000); return /^[MmLlHhVvCcSsQqTtZz0-9.,\s-]+$/.test(d) && /^\s*M/i.test(d) ? ['curva', d] : null; }
    if (nums.some(v => v == null)) return null;
    if ((t === 'ret' || t === 'elipse') && nums.length >= 4) return [t, ...nums.slice(0, 4)];
    if (t === 'red' && nums.length >= 5) return [t, ...nums.slice(0, 5)];
    if (t === 'poli' && nums.length >= 6) return [t, ...nums.slice(0, this.LIM.pontos * 2 - (nums.length % 2))];
    if (t === 'linha' && nums.length >= 5) { const [e, ...p] = nums; return ['linha', clamp(e, .5, 80), ...p.slice(0, this.LIM.pontos * 2 - (p.length % 2))]; }
    return null;
  },
  limpar(j) {
    const fd = j?.fundo || {}, hz = clamp(this.n(fd.horizonte) ?? 680, 300, 980), fg = Array.isArray(fd.fuga) ? fd.fuga.map(v => this.n(v)) : [];
    const fundo = { tipo: fd.tipo === 'externo' ? 'externo' : 'interno',
      parede: [this.hex(fd.parede?.[0]) || '#27306e', this.hex(fd.parede?.[1]) || '#8fa3e8'],
      chao: [this.hex(fd.chao?.[0]) || '#5a63a8', this.hex(fd.chao?.[1]) || '#252a63'],
      horizonte: hz, fuga: [clamp(fg[0] ?? 960, 200, 1720), clamp(fg[1] ?? hz - 120, 100, hz)] };
    const camadas = [];
    for (const c of (Array.isArray(j?.camadas) ? j.camadas : []).slice(0, this.LIM.camadas)) {
      const formas = [];
      for (const s of (Array.isArray(c?.formas) ? c.formas : []).slice(0, this.LIM.formas)) {
        const f = this.fig(s?.f); if (!f) continue; const cor = this.corDe(s.cor) || (f[0] === 'linha' ? this.CONTORNO : null); if (!cor) continue;
        formas.push({ f, cor, sombra: !!s.sombra, luz: !!s.luz, contorno: s.contorno == null ? (f[0] === 'linha' ? 0 : 3) : clamp(+s.contorno || 0, 0, 6), op: clamp(s.op == null ? 1 : +s.op || 0, 0, 1) });
      }
      if (formas.length) camadas.push({ nome: String(c.nome || 'Objeto').replace(/[<>"&]/g, '').slice(0, 40) || 'Objeto', plano: ['fundo', 'meio', 'frente'].includes(c.plano) ? c.plano : 'meio', formas });
    }
    return { nome: String(j?.nome || 'Cenário oficial').replace(/[<>"&]/g, '').slice(0, 40), tags: (Array.isArray(j?.tags) ? j.tags : []).map(t => String(t).replace(/[<>"&]/g, '').slice(0, 20)).filter(Boolean).slice(0, 6), fundo, camadas };
  },

  /* ---------- desenhar em SVG (porte do svglib.py) ---------- */
  f(v) { return String(Math.round(v * 100) / 100); },
  novoCtx() { return { defs: [], el: [], n: 0, filtros: {}, id(p) { return p + (++this.n); } }; },
  pontos(F) { // pontos da figura (para a caixa e os degradês)
    const t = F[0];
    if (t === 'ret' || t === 'red' || t === 'elipse') return [[F[1], F[2]], [F[3], F[4]]];
    if (t === 'poli') { const p = []; for (let i = 1; i + 1 < F.length; i += 2) p.push([F[i], F[i + 1]]); return p; }
    if (t === 'linha') { const p = [], e = F[1] / 2; for (let i = 2; i + 1 < F.length; i += 2) p.push([F[i] - e, F[i + 1] - e], [F[i] + e, F[i + 1] + e]); return p; }
    if (t === 'curva') { const nums = (F[1].match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number), p = []; for (let i = 0; i + 1 < nums.length; i += 2) p.push([nums[i], nums[i + 1]]); return p; }
    return [];
  },
  caixaDe(pts) { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; },
  d(F) {
    const f = v => this.f(v), t = F[0];
    if (t === 'ret') { const [x0, y0, x1, y1] = [Math.min(F[1], F[3]), Math.min(F[2], F[4]), Math.max(F[1], F[3]), Math.max(F[2], F[4])]; return `M${f(x0)} ${f(y0)}H${f(x1)}V${f(y1)}H${f(x0)}Z`; }
    if (t === 'red') { const [x0, y0, x1, y1] = [Math.min(F[1], F[3]), Math.min(F[2], F[4]), Math.max(F[1], F[3]), Math.max(F[2], F[4])], r = Math.min(Math.abs(F[5]), (x1 - x0) / 2, (y1 - y0) / 2);
      return `M${f(x0 + r)} ${f(y0)}H${f(x1 - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y0 + r)}V${f(y1 - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x1 - r)} ${f(y1)}H${f(x0 + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(y1 - r)}V${f(y0 + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x0 + r)} ${f(y0)}Z`; }
    if (t === 'elipse') { const cx = (F[1] + F[3]) / 2, cy = (F[2] + F[4]) / 2, rx = Math.abs(F[3] - F[1]) / 2, ry = Math.abs(F[4] - F[2]) / 2; return `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`; }
    if (t === 'poli') { let s = ''; for (let i = 1; i + 1 < F.length; i += 2) s += (i === 1 ? 'M' : 'L') + f(F[i]) + ' ' + f(F[i + 1]); return s + 'Z'; }
    if (t === 'linha') { let s = ''; for (let i = 2; i + 1 < F.length; i += 2) s += (i === 2 ? 'M' : 'L') + f(F[i]) + ' ' + f(F[i + 1]); return s; }
    if (t === 'curva') return F[1];
    return '';
  },
  tinta(C, cor, cx) { // cor chapada ou degradê sobre a caixa da forma
    if (typeof cor === 'string') return cor;
    const i = C.id('g'), [x0, y0, x1, y1] = cx, [a, b] = cor.v || cor.h, v = !!cor.v;
    C.defs.push(`<linearGradient id="${i}" gradientUnits="userSpaceOnUse" x1="${this.f(v ? 0 : x0)}" y1="${this.f(v ? y0 : 0)}" x2="${this.f(v ? 0 : Math.max(x1, x0 + 1))}" y2="${this.f(v ? Math.max(y1, y0 + 1) : 0)}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`);
    return `url(#${i})`;
  },
  blur(C, s) { const k = 'b' + s; if (!C.filtros[k]) { const i = C.filtros[k] = C.id('fb'); C.defs.push(`<filter id="${i}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${this.f(s)}"/></filter>`); } return C.filtros[k]; },
  bordaLuz(C, cor = '#dff0ff', forca = .5, dx = -5, dy = 5) { const k = `r${cor}${forca}${dx}${dy}`; if (!C.filtros[k]) { const i = C.filtros[k] = C.id('fr');
    C.defs.push(`<filter id="${i}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feOffset in="SourceAlpha" dx="${dx}" dy="${dy}" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out" result="e"/><feGaussianBlur in="e" stdDeviation="1.4" result="b"/><feFlood flood-color="${cor}" flood-opacity="${this.f(Math.min(1, forca))}"/><feComposite in2="b" operator="in"/></filter>`); } return C.filtros[k]; },
  forma(C, s) {
    const F = s.f, d = this.d(F), cx = this.caixaDe(this.pontos(F)), op = s.op < 1 ? ` opacity="${this.f(s.op)}"` : '';
    if (F[0] === 'linha') { C.el.push(`<path d="${d}" fill="none" stroke="${this.tinta(C, s.cor, cx)}" stroke-width="${this.f(F[1])}" stroke-linecap="round" stroke-linejoin="round"${op}/>`); return; }
    if (s.sombra) C.el.push(`<path d="${d}" fill="#060b2e" opacity=".45" filter="url(#${this.blur(C, 10)})" transform="translate(12 8)"/>`);
    C.el.push(`<path d="${d}" fill="${this.tinta(C, s.cor, cx)}"${op}/>`);
    if (s.luz) C.el.push(`<path d="${d}" fill="#000" filter="url(#${this.bordaLuz(C)})"/>`);
    if (s.contorno) C.el.push(`<path d="${d}" fill="none" stroke="${this.CONTORNO}" stroke-width="${this.f(s.contorno)}" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`);
  },
  // a luz da cena (o mesmo luz_ambiente do svglib, com o desenho já nas coordenadas da tela)
  luzAmbiente(C, [vx, vy, vw, vh]) {
    const W = this.W, H = this.H, f = v => this.f(v), cinza = v => { const c = Math.round(255 * Math.min(1, v)).toString(16).padStart(2, '0'); return '#' + c + c + c; };
    const gx = .34 * .6 / W, gy = -.34 * .5 / H, n = Math.hypot(gx, gy), ux = gx / n, uy = gy / n, cx = vx + vw / 2, cy = vy + vh / 2, D = Math.hypot(vw, vh) / 2 + 2;
    const p1 = [cx - ux * D, cy - uy * D], p2 = [cx + ux * D, cy + uy * D], lz = ([X, Y]) => Math.max(.6, Math.min(1, .62 + .34 * (.6 * X / W + .5 * (1 - Y / H))));
    const st = Array.from({ length: 9 }, (_, i) => i / 8).map(t => `<stop offset="${f(t)}" stop-color="${cinza(1 - .4 * t * t)}"/>`).join('');
    const mini = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(vw)}" height="${f(vh)}" viewBox="${f(vx)} ${f(vy)} ${f(vw)} ${f(vh)}" preserveAspectRatio="none"><defs><linearGradient id="a" gradientUnits="userSpaceOnUse" x1="${f(p1[0])}" y1="${f(p1[1])}" x2="${f(p2[0])}" y2="${f(p2[1])}"><stop offset="0" stop-color="${cinza(lz(p1))}"/><stop offset="1" stop-color="${cinza(lz(p2))}"/></linearGradient><radialGradient id="b" gradientUnits="userSpaceOnUse" cx="1056" cy="486" r="1440" gradientTransform="translate(1056 486) scale(1 0.6375) translate(-1056 -486)">${st}</radialGradient></defs><rect x="${f(vx)}" y="${f(vy)}" width="${f(vw)}" height="${f(vh)}" fill="url(#a)"/><rect x="${f(vx)}" y="${f(vy)}" width="${f(vw)}" height="${f(vh)}" fill="url(#b)" style="mix-blend-mode:multiply"/></svg>`;
    const hx = [0x9f, 0xe8, 0xff], stg = Array.from({ length: 11 }, (_, i) => i / 10).map(t => { const k = .08 * Math.exp(-((t * 2.5) ** 2)); return `<stop offset="${f(t)}" stop-color="#${hx.map(v => Math.round(v * k).toString(16).padStart(2, '0')).join('')}"/>`; }).join('');
    const mini2 = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(vw)}" height="${f(vh)}" viewBox="${f(vx)} ${f(vy)} ${f(vw)} ${f(vh)}" preserveAspectRatio="none"><defs><radialGradient id="c" gradientUnits="userSpaceOnUse" cx="1600" cy="40" r="2250" gradientTransform="translate(1600 40) scale(1 0.5778) translate(-1600 -40)">${stg}</radialGradient></defs><rect x="${f(vx)}" y="${f(vy)}" width="${f(vw)}" height="${f(vh)}" fill="url(#c)"/></svg>`;
    const b64 = s => btoa(unescape(encodeURIComponent(s))), bc = [0x2a, 0x3f, 0xb0].map(v => v / 255), tb = .1;
    const lin = i => [0, 1, 2].map(j => f(2 * (.95 * (i === j) - tb * bc[i] / 3))).join(' ') + ` 0 ${f(tb * bc[i])}`, i = C.id('luz');
    C.defs.push(`<filter id="${i}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="${f(vx)}" y="${f(vy)}" width="${f(vw)}" height="${f(vh)}" color-interpolation-filters="sRGB"><feImage href="data:image/svg+xml;base64,${b64(mini)}" x="${f(vx)}" y="${f(vy)}" width="${f(vw)}" height="${f(vh)}" preserveAspectRatio="none" result="L"/><feImage href="data:image/svg+xml;base64,${b64(mini2)}" x="${f(vx)}" y="${f(vy)}" width="${f(vw)}" height="${f(vh)}" preserveAspectRatio="none" result="G"/><feComposite in="SourceGraphic" in2="L" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="M"/><feComposite in="G" in2="SourceAlpha" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="Gi"/><feComposite in="M" in2="Gi" operator="arithmetic" k1="0" k2=".5" k3=".5" k4="0" result="S"/><feColorMatrix in="S" type="matrix" values="${lin(0)}  ${lin(1)}  ${lin(2)}  0 0 0 1 0"/></filter>`);
    return i;
  },
  // monta o SVG de uma camada: caixa = [x, y, w, h] da tela (vira o viewBox; width/height = w/h)
  svg(C, caixa, blur = 0) {
    const [vx, vy, vw, vh] = caixa; let corpo = C.el.join('');
    if (blur) corpo = `<g filter="url(#${this.blur(C, blur)})">${corpo}</g>`;
    corpo = `<g filter="url(#${this.luzAmbiente(C, caixa)})">${corpo}</g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(vw)}" height="${Math.round(vh)}" viewBox="${this.f(vx)} ${this.f(vy)} ${this.f(vw)} ${this.f(vh)}" data-cenario="oficial"><defs>${C.defs.join('')}</defs>${corpo}</svg>`;
  },
  // parede e chão (ou céu e chão): o programa faz sozinho, com o ponto de fuga e pinceladas leves
  fundoSvg(fd) {
    const C = this.novoCtx(), W = this.W, H = this.H, hz = fd.horizonte, [vx, vy] = fd.fuga, f = v => this.f(v), R = Cenarios.rnd(hz * 7 + vx);
    const gP = C.id('g'), gC = C.id('g'), cl = C.id('c');
    C.defs.push(`<linearGradient id="${gP}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(hz)}" x2="${W}" y2="0"><stop offset="0" stop-color="${fd.parede[0]}"/><stop offset="1" stop-color="${fd.parede[1]}"/></linearGradient>`,
      `<linearGradient id="${gC}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(hz)}" x2="0" y2="${H}"><stop offset="0" stop-color="${fd.chao[0]}"/><stop offset="1" stop-color="${fd.chao[1]}"/></linearGradient>`,
      `<clipPath id="${cl}"><path d="M0 ${f(hz)}H${W}V${H}H0Z"/></clipPath>`);
    C.el.push(`<path d="M-10 -10H${W + 10}V${f(hz + 2)}H-10Z" fill="url(#${gP})"/>`);
    // pinceladas leves na parede (manchas largas e borradas, mais claras do lado da luz)
    const pb = this.blur(C, 38);
    for (let i = 0; i < 9; i++) { const x = R() * W, y = R() * hz * .9, rx = 160 + R() * 320, ry = 50 + R() * 120, claro = x / W + (1 - y / hz) * .5 > .7;
      C.el.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${claro ? '#ffffff' : '#0b1240'}" opacity="${f(.05 + R() * .06)}" filter="url(#${pb})"/>`); }
    C.el.push(`<path d="M-10 ${f(hz)}H${W + 10}V${H + 10}H-10Z" fill="url(#${gC})"/>`);
    // linhas do chão fugindo para o ponto de fuga (tábuas/ladrilhos), bem leves
    let ls = ''; for (let x = -1600; x <= W + 1600; x += 150) ls += `M${f(vx + (x - vx) * (hz - vy) / (H - vy))} ${f(hz)}L${f(x)} ${H}`;
    C.el.push(`<path d="${ls}" fill="none" stroke="${this.CONTORNO}" stroke-width="2" opacity="${fd.tipo === 'externo' ? '.06' : '.13'}" clip-path="url(#${cl})"/>`);
    // luz no chão (lado direito, perto da parede) e sombra no canto de baixo à esquerda
    C.el.push(`<ellipse cx="${f(W * .68)}" cy="${f(hz + (H - hz) * .3)}" rx="${f(W * .4)}" ry="${f((H - hz) * .35)}" fill="#ffffff" opacity=".07" filter="url(#${pb})" clip-path="url(#${cl})"/>`);
    if (fd.tipo === 'interno') C.el.push(`<path d="M0 ${f(hz - 18)}H${W}V${f(hz)}H0Z" fill="${fd.parede[0]}" opacity=".55"/><path d="M0 ${f(hz - 18)}L${W} ${f(hz - 18)}" stroke="#dff0ff" stroke-width="2" opacity=".25"/>`);
    C.el.push(`<path d="M0 ${f(hz)}L${W} ${f(hz)}" fill="none" stroke="${this.CONTORNO}" stroke-width="4" stroke-linecap="round" opacity=".9"/>`);
    return this.svg(C, [0, 0, W, H]);
  },

  /* ---------- JSON → pacote em camadas (imagens guardadas no computador) ---------- */
  async montar(j, o = {}) {
    const camadas = [], guarda = async (svg, nome, id, caixa, extra = {}) => {
      const b = new Blob([svg], { type: 'image/svg+xml' }), k = await Arq.guardar(b, uid('a') + '.svg'), bm = await Arq.deBlob(b, k); if (bm) Arq.img.set(k, bm);
      camadas.push({ id, nome, k, tipo: 'svg', w: Math.round(caixa[2]), h: Math.round(caixa[3]), cx: round(caixa[0] + caixa[2] / 2, 1), cy: round(caixa[1] + caixa[3] / 2, 1), s: 1, r: 0, ...extra });
    };
    await guarda(this.fundoSvg(j.fundo), j.fundo.tipo === 'externo' ? 'Céu e chão' : 'Parede e chão', 'parede-chao', [0, 0, this.W, this.H], { trava: true });
    for (const [i, c] of j.camadas.entries()) {
      const C = this.novoCtx(); for (const s of c.formas) this.forma(C, s);
      const pts = c.formas.flatMap(s => this.pontos(s.f)); if (!pts.length) continue;
      const blur = c.plano === 'frente' ? 3.5 : 0, folga = 30 + (c.formas.some(s => s.sombra) ? 34 : 0) + blur * 3, [x0, y0, x1, y1] = this.caixaDe(pts);
      const cx = [Math.floor(x0 - folga), Math.floor(y0 - folga), Math.ceil(x1 - x0 + folga * 2), Math.ceil(y1 - y0 + folga * 2)];
      if (cx[2] < 4 || cx[3] < 4) continue;
      await guarda(this.svg(C, cx, blur), c.nome + (c.plano === 'frente' ? ' (na frente)' : ''), slugCen(c.nome) + '-' + i, cx);
      o.prog?.(i + 1, j.camadas.length);
    }
    return { formato: 'cenario-camadas', v: 1, id: uid('cen'), nome: j.nome, estilo: 'pintado-azul', cat: 'oficial', aprovar: true, origem: 'meu',
      tags: [...new Set(['oficial', ...j.tags])], cena: { ...CenLib.FX0 }, camadas, fonte: j };
  },
  // tudo junto: pede à IA, desenha e devolve o pacote (ainda não salvo)
  async gerar(pedido, o = {}) {
    const j = await this.pedirIA(pedido, o);
    return this.montar(j, o);
  },
  // ajustar um oficial gerado: a IA vê como ficou e o JSON de antes
  async ajustar(def, pedido) {
    if (!def?.fonte) throw new Error('Só dá para ajustar com a IA os cenários oficiais gerados por ela.');
    const fig = (await CenLib.compoe(def, 960)).toDataURL('image/jpeg', .82);
    const j = await this.pedirIA(pedido, { anterior: def.fonte, figura: fig });
    const novo = await this.montar(j);
    return { ...novo, id: def.id, nome: def.nome, roteiro: def.roteiro, lugar: def.lugar };
  },
};
