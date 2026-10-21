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
  tracar(ctx, s) {
    const [t, ...v] = s.map((x, i) => i ? +x : x); ctx.beginPath();
    if (t === 'ret') { ctx.rect(v[0], v[1], v[2] - v[0] + 1, v[3] - v[1] + 1); ctx.fill(); }
    else if (t === 'red') { const [a, b, c, d] = v, r = Math.min(v[4] || 0, (c - a) / 2, (d - b) / 2); ctx.moveTo(a + r, b); ctx.arcTo(c, b, c, d, r); ctx.arcTo(c, d, a, d, r); ctx.arcTo(a, d, a, b, r); ctx.arcTo(a, b, c, b, r); ctx.closePath(); ctx.fill(); }
    else if (t === 'elipse') { ctx.ellipse((v[0] + v[2]) / 2, (v[1] + v[3]) / 2, Math.abs(v[2] - v[0]) / 2, Math.abs(v[3] - v[1]) / 2, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (t === 'poli') { for (let i = 0; i + 1 < v.length; i += 2) i ? ctx.lineTo(v[i], v[i + 1]) : ctx.moveTo(v[i], v[i + 1]); ctx.closePath(); ctx.fill(); }
    else if (t === 'linha') { ctx.lineWidth = v[0]; ctx.lineCap = 'butt'; for (let i = 1; i + 1 < v.length; i += 2) i > 1 ? ctx.lineTo(v[i], v[i + 1]) : ctx.moveTo(v[i], v[i + 1]); ctx.stroke(); }
    else if (t === 'anel' || t === 'arco') { // a espessura fica para dentro da caixa
      const e = t === 'anel' ? v[4] : v[6], rx = Math.max(.5, Math.abs(v[2] - v[0]) / 2 - e / 2), ry = Math.max(.5, Math.abs(v[3] - v[1]) / 2 - e / 2);
      const a0 = t === 'anel' ? 0 : v[4] * Math.PI / 180, a1 = t === 'anel' ? Math.PI * 2 : v[5] * Math.PI / 180;
      ctx.lineWidth = e; ctx.ellipse((v[0] + v[2]) / 2, (v[1] + v[3]) / 2, rx, ry, 0, a0, a1); ctx.stroke(); }
  },
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

  /* ---------- desenhar o cenário inteiro (devolve um canvas 1920×1080) ---------- */
  async desenhar(cena, aoProgresso) {
    const W = this.W, H = this.H, n = W * H, { borda, tex } = this.ruidos();
    const R = (this._semente = 99, this.rnd()), img = new Float32Array(n * 3).fill(255);
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
    const camadas = (cena?.camadas || []).slice(0, 400);
    for (let ci = 0; ci < camadas.length; ci++) {
      const L = camadas[ci];
      if (ci % 12 === 11) { aoProgresso?.(ci / camadas.length); await sleep(0); }
      if (L.degrade) { const g = L.degrade, c = this.cor(g.cor), de = +g.de || 0, ate = Math.max(de + 1, +g.ate || H), fo = clamp(+g.forca || .5, 0, 1);
        for (let y = 0; y < H; y++) { const t = clamp((y - de) / (ate - de), 0, 1) * fo; if (!t) continue; for (let x = 0, i = y * W * 3; x < W; x++, i += 3) { img[i] += (c[0] - img[i]) * t; img[i + 1] += (c[1] - img[i + 1]) * t; img[i + 2] += (c[2] - img[i + 2]) * t; } }
        continue; }
      if (!Array.isArray(L.f) || !L.f.length) continue;
      const sig = clamp(+(L.b ?? 4) || 1, .5, 40), tx = clamp(+(L.t ?? 10), 0, 30), c = this.cor(L.c), mg = Math.ceil(sig * 3) + 4, bb = this.caixa(L.f);
      const x0 = clamp(Math.floor(bb.x0) - mg, 0, W), y0 = clamp(Math.floor(bb.y0) - mg, 0, H), x1 = clamp(Math.ceil(bb.x1) + mg + 1, 0, W), y1 = clamp(Math.ceil(bb.y1) + mg + 1, 0, H);
      const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) continue;
      cv.width = w; cv.height = h; ctx.setTransform(1, 0, 0, 1, -x0, -y0); ctx.fillStyle = ctx.strokeStyle = '#fff';
      for (const s of L.f) { try { this.tracar(ctx, s); } catch { } }
      const px = ctx.getImageData(0, 0, w, h).data, m = new Float32Array(w * h);
      for (let i = 0; i < m.length; i++) m[i] = px[i * 4 + 3] / 255;
      this.desfoca(m, w, h, sig);
      const ox = (R() * W) | 0, oy = (R() * H) | 0, ex = (R() * W) | 0, ey = (R() * H) | 0;
      for (let y = 0; y < h; y++) { const gy = y0 + y, ty = ((gy + oy) % H) * W, ey2 = ((gy + ey) % H) * W;
        for (let x = 0; x < w; x++) { const a0 = m[y * w + x]; if (a0 <= .02) continue; const gx = x0 + x;
          const a = clamp((a0 - .5 + borda[ey2 + (gx + ex) % W]) * 16 + .5, 0, 1); if (!a) continue;
          const t = tex[ty + (gx + ox) % W] * tx, i = (gy * W + gx) * 3;
          img[i] += (c[0] + t - img[i]) * a; img[i + 1] += (c[1] + t - img[i + 1]) * a; img[i + 2] += (c[2] + t - img[i + 2]) * a; } }
    }
    // grão fino por cima
    cv.width = W; cv.height = H; ctx.setTransform(1, 0, 0, 1, 0, 0); const out = ctx.createImageData(W, H), d = out.data;
    for (let p = 0, i = 0; p < n; p++, i += 3) { const g = (R() + R() + R() - 1.5) * 10; d[p * 4] = img[i] + g; d[p * 4 + 1] = img[i + 1] + g; d[p * 4 + 2] = img[i + 2] + g; d[p * 4 + 3] = 255; }
    ctx.putImageData(out, 0, 0); aoProgresso?.(1);
    return cv;
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
{"nome":"nome curto","camadas":[ {"c":"#RRGGBB","t":textura,"b":borda,"f":[formas]}, {"degrade":{...}}, ... ]}
- Tela 1920×1080, números inteiros. "t" = granulado da cor (6 a 12; 4-7 em detalhes pequenos; padrão 10 se omitir). "b" = suavidade da borda (padrão 4; 1 para o fundo inteiro; 2-3 em detalhes pequenos; nunca acima de 8, exceto uma sombra suave larga com 30).
- Formas (várias formas da mesma cor podem ir na mesma camada):
  ["ret",x0,y0,x1,y1]  ["red",x0,y0,x1,y1,raio]  ["elipse",x0,y0,x1,y1]  ["poli",x,y,x,y,...]
  ["linha",espessura,x,y,x,y,...]  ["anel",x0,y0,x1,y1,espessura]  ["arco",x0,y0,x1,y1,grau0,grau1,espessura] (180→360 = metade de cima)
- No máximo ~120 camadas. Seja econômico: junte formas da mesma cor numa camada.

EXEMPLOS DO ESTILO (cenários aprovados pelo dono):`,
  async sistema() {
    if (this._sis) return this._sis;
    const ex = await Promise.all(['sala', 'jardim', 'sala-de-aula'].map(id => this.pronto(id).then(j => JSON.stringify(j)).catch(() => '')));
    return (this._sis = this.SIS + '\n' + ex.filter(Boolean).join('\n\n'));
  },
  async pedirIA(pedido, anterior, aoEscrever) {
    const txt = anterior ? `CENÁRIO ATUAL:\n${JSON.stringify(anterior)}\n\nAJUSTE PEDIDO: ${pedido}\nDevolva o cenário inteiro já ajustado, no mesmo estilo.` : `PEDIDO DE CENÁRIO: ${pedido}`;
    const out = await IA.chama(await this.sistema(), txt, aoEscrever), j = IA.json(out);
    if (!Array.isArray(j.camadas) || !j.camadas.length) throw new Error('A IA não devolveu as camadas do cenário.');
    return j;
  },

  /* ---------- janela "Cenário" ---------- */
  async abrir() {
    const body = h(`<div class="cen">
      <div class="cen-sub">Prontos</div><div class="cen-grade"></div>
      <div class="cen-sub">Pedir à IA <span>(mesmo estilo dos prontos)</span></div>
      <textarea rows="2" placeholder="Ex.: um quarto de criança com cama, estante e janela à noite"></textarea>
      <div class="cen-prev" hidden><canvas></canvas><div class="cen-st"></div></div></div>`);
    const prev = $('.cen-prev', body), st = $('.cen-st', body), pc = $('canvas', prev), ta = $('textarea', body);
    let atual = null, cvAtual = null, ocupado = false;
    const mostra = async (cena, rot) => {
      prev.hidden = false; st.textContent = 'Desenhando…'; atual = cena;
      cvAtual = await this.desenhar(cena, p => { st.textContent = 'Desenhando… ' + Math.round(p * 100) + '%'; });
      pc.width = 960; pc.height = 540; const g = pc.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cvAtual, 0, 0, 960, 540); st.textContent = rot || cena.nome || 'Cenário';
      btPor.disabled = false; btAjuste.style.display = '';
    };
    for (const p of this.PRONTOS) {
      const b = h(`<button class="cen-item" title="Usar: ${esc(p.nome)}"><img src="cenarios/miniaturas/${p.id}.jpg" alt=""><span>${esc(p.nome)}</span></button>`);
      b.onclick = async () => { if (ocupado) return; ocupado = true; try { await mostra(await this.pronto(p.id)); } catch (e) { st.textContent = 'Não deu: ' + e.message; } ocupado = false; };
      $('.cen-grade', body).appendChild(b);
    }
    const ia = async ajuste => {
      const txt = ta.value.trim(); if (!txt || ocupado) return; ocupado = true; prev.hidden = false; st.textContent = 'A IA está montando o cenário…';
      try { const j = await this.pedirIA(txt, ajuste ? atual : null, t => { st.textContent = 'A IA está montando o cenário… (' + t.length + ' letras)'; }); await mostra(j, (j.nome || 'Cenário') + ' — feito pela IA. Gostou? "Pôr na cena", ou escreva um ajuste e clique em "Ajustar".'); }
      catch (e) { st.textContent = 'Não deu: ' + e.message; }
      ocupado = false;
    };
    let btPor, btAjuste;
    await UI.modal({ title: 'Cenário', icon: 'paisagem', width: 720, body, onOpen: a => {
      [btAjuste, , btPor] = a.foot.querySelectorAll('.btn'); btPor.disabled = true; btAjuste.style.display = 'none';
    }, buttons: [
      { label: 'Ajustar', left: true, onClick: () => { ia(true); return false; } },
      { label: 'Criar com a IA', icon: 'sparkles', onClick: () => { ia(false); return false; } },
      { label: 'Pôr na cena', kind: 'primary', onClick: async () => { if (!cvAtual || ocupado) return false; await this.porNaCena(cvAtual, atual); return true; } },
    ] });
  },
  async porNaCena(cv, cena) {
    const blob = await new Promise(ok => cv.toBlob(ok, 'image/png')), id = await Arq.guardar(blob), bm = await createImageBitmap(blob);
    const P = App.P, s = round(Math.max(P.w / this.W, P.h / this.H), 3); // cobre o quadro todo (no vertical, corta os lados)
    const n = Modelo.novoNo('imagem', { arq: id, nome: 'Cenário: ' + String(cena?.nome || 'novo').slice(0, 30), s }); n.cena = cena;
    n.de = 0; n.chaves = { 0: { x: Math.round(P.w / 2), y: Math.round(P.h / 2), r: 0, s, sx: 1, op: 1 } };
    Arq.img.set(id, bm); P.raiz.push(n); App.sel = n.id; App.commit('Cenário'); // último da lista = atrás de tudo
    UI.toast(`<b>${esc(cena?.nome || 'Cenário')}</b> entrou no fundo da cena.`, { kind: 'ok' });
  },
};
