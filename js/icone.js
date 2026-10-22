/* ===================== icone.js — ícone e cor de cada personagem (aparecem na hierarquia e na timeline do editor) =====================
   def.iconeModo: 'auto' (padrão: a cabeça do personagem, recortada sozinha) | 'proprio' (imagem escolhida) | 'nenhum' (ícone comum)
   def.icone: a imagem do ícone (data URL pequena, 96 px) · def.corModo: 'auto' (padrão: a cor que mais aparece, ajustada para
   ficar boa de ver no fundo escuro) | 'propria' · def.cor: '#rrggbb'. O nome mostrado é sempre o nome da camada/arquivo. */
'use strict';
const Icone = {
  // desenha a vista principal na pose padrão num canvas (escala k) e devolve { cv, b }
  render(def, alvo = 360) {
    const d = Modelo.naVista(def), est = Modelo.partesNoEstado(d, {}), b = Modelo.caixaPersonagem(d, est); if (!b.w || !b.h) return null;
    const k = Math.min(alvo / b.w, alvo / b.h), W = Math.max(1, Math.ceil(b.w * k)), H = Math.max(1, Math.ceil(b.h * k)), cv = document.createElement('canvas'), x = (cv.width = W, cv.height = H, cv.getContext('2d', { willReadFrequently: true })); // canvas comum: ler os pixels de OffscreenCanvas quebrava a aba em alguns navegadores
    const base = new DOMMatrix().scale(k).translate(-b.x, -b.y); let algum = false;
    for (const it of Modelo.montar(d, est)) { if (!it.img) continue; const bm = Arq.img.get(it.img.k); if (!bm) continue; algum = true; x.setTransform(base.multiply(it.m)); x.drawImage(bm, -(it.img.pivo?.x ?? it.img.w / 2) + (it.img.ajuste?.x || 0), -(it.img.pivo?.y ?? it.img.h / 2) + (it.img.ajuste?.y || 0), it.img.w, it.img.h); }
    return algum ? { cv, x, d, est, k, b, base } : null;
  },
  // a cabeça: a parte "Cabeça/Rosto" (e o que encaixa nela); sem ela, o pedaço de cima do personagem.
  // Com def.iconeCorte (zoom/posição escolhidos na configuração) usa esse corte.
  async cabeca(def, S = 96) {
    const F = await this.fonteAuto(def); if (!F) return null;
    const c = def.iconeCorte?.modo === 'auto' ? def.iconeCorte : F.corte; return this.recorta(F.cv, c, S);
  },
  // o personagem desenhado (pose padrão) e o corte padrão da cabeça, em frações da imagem ({cx, cy, lado}: centro e lado do quadrado)
  async fonteAuto(def) {
    await Arq.garantir(Modelo.chavesImgs(Modelo.naVista(def)));
    const R = this.render(def, 640); if (!R) return null; const { cv, x, d, est, base } = R, W = cv.width, H = cv.height, nrm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    let box = null; const cab = d.partes.find(p => /cabe[cç]a|cabeca|head|rosto|face|cara\b/.test(nrm(p.nome)));
    if (cab) { const filhos = id => d.partes.filter(p => p.pai === id).flatMap(p => [p.id, ...filhos(p.id)]), ids = new Set([cab.id, ...filhos(cab.id)]); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const it of Modelo.montar(d, est)) { if (!it.img || !ids.has(it.parte.id)) continue; const M = base.multiply(it.m), px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2;
        for (const [a, c] of [[0, 0], [it.img.w, 0], [0, it.img.h], [it.img.w, it.img.h]]) { const q = M.transformPoint(new DOMPoint(a - px + (it.img.ajuste?.x || 0), c - py + (it.img.ajuste?.y || 0))); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); } }
      if (x1 > x0) box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
    if (!box) { // pedaço de cima: onde ficam os pixels nos primeiros ~40% da altura
      const faixa = Math.max(4, Math.round(Math.min(H, W * 1.1) * .42)), D = x.getImageData(0, 0, W, Math.min(H, faixa)).data; let a = W, z = -1;
      for (let yy = 0; yy < Math.min(H, faixa); yy += 2) for (let xx = 0; xx < W; xx += 2) if (D[(yy * W + xx) * 4 + 3] > 40) { if (xx < a) a = xx; if (xx > z) z = xx; }
      box = z > a ? { x: a, y: 0, w: z - a, h: Math.min(H, faixa) } : { x: 0, y: 0, w: W, h: Math.min(H, W) }; }
    return { cv, corte: { cx: (box.x + box.w / 2) / W, cy: (box.y + box.h / 2) / H, lado: Math.max(box.w, box.h) * 1.08 / W } };
  },
  // corte padrão de uma imagem própria: o quadrado do meio
  cortePadrao(cv) { const l = Math.min(cv.width, cv.height); return { cx: .5, cy: .5, lado: l / cv.width }; },
  // recorta o quadrado {cx, cy, lado} (frações) da imagem e devolve o ícone S×S
  recorta(cv, c, S = 96) {
    const W = cv.width, H = cv.height, lado = c.lado * W, o = document.createElement('canvas'); o.width = o.height = S;
    o.getContext('2d').drawImage(cv, c.cx * W - lado / 2, c.cy * H - lado / 2, lado, lado, 0, 0, S, S); return this.dataUrl(o);
  },
  // imagem escolhida pela pessoa (guardada até 512 px, para poder mudar o zoom depois)
  async fonteDeArquivo(f) { const bm = await createImageBitmap(f), k = Math.min(1, 512 / Math.max(bm.width, bm.height)), c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); return c; },
  aCanvas(url) { return new Promise((ok, erro) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext('2d').drawImage(i, 0, 0); ok(c); }; i.onerror = erro; i.src = url; }); },
  async dataUrl(cv) { if (cv.toDataURL) { const w = cv.toDataURL('image/webp', .9); return w.startsWith('data:image/webp') ? w : cv.toDataURL('image/png'); } const b = await cv.convertToBlob({ type: 'image/webp', quality: .9 }).catch(() => null) || await cv.convertToBlob({ type: 'image/png' }); return await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); }); },
  async deArquivo(f, S = 96) { const c = await this.fonteDeArquivo(f); return this.recorta(c, this.cortePadrao(c), S); },
  // cor que mais aparece (sem contorno preto e sem branco), ajustada para aparecer bem no fundo escuro
  async corAuto(def) {
    await Arq.garantir(Modelo.chavesImgs(Modelo.naVista(def))); const R = this.render(def, 160); if (!R) return '#8fb3ff';
    const D = R.x.getImageData(0, 0, R.cv.width, R.cv.height).data, cont = new Map();
    for (let i = 0; i < D.length; i += 8) { if (D[i + 3] < 200) continue; const [hh, ss, ll] = this.hsl(D[i], D[i + 1], D[i + 2]); if (ll < .18 || ll > .93 || ss < .18) continue; const key = Math.round(hh * 24) % 24; const v = cont.get(key) || [0, 0, 0, 0]; v[0] += hh; v[1] += ss; v[2] += ll; v[3]++; cont.set(key, v); }
    if (!cont.size) return '#9aa7b8'; const [hh, ss] = [...cont.values()].sort((a, b) => b[3] - a[3])[0].map((x, _, v) => x / v[3]);
    return this.hex(...this.rgb(hh, Math.max(.5, Math.min(.85, ss)), .66)); // claro e saturado o bastante no fundo escuro
  },
  // ajusta uma cor escolhida para ficar legível no fundo escuro
  legivel(hex) { const v = parseInt(String(hex).slice(1), 16), [hh, ss, ll] = this.hsl(v >> 16 & 255, v >> 8 & 255, v & 255); return this.hex(...this.rgb(hh, ss, Math.max(.55, Math.min(.85, ll)))); },
  hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h / 6, s, l]; },
  rgb(h, s, l) { const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255); }; return [f(0), f(8), f(4)]; },
  hex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join(''); },
  // completa o que é automático (antes de mandar para a nuvem / para a animação, ou no editor quando falta)
  async prepara(def) {
    if (!def) return def;
    if ((def.iconeModo || 'auto') === 'auto') { try { const i = await this.cabeca(def); if (i) def.icone = i; } catch { } }
    if ((def.corModo || 'auto') === 'auto') { try { def.cor = await this.corAuto(def); } catch { } }
    return def;
  },
  // para a hierarquia/timeline: <img> do ícone (ou o ícone comum) e a cor
  html(def, tam = 16) { return def && def.iconeModo !== 'nenhum' && def.icone ? `<img class="ico-p" src="${def.icone}" alt="" style="width:${tam}px;height:${tam}px;${def.cor ? `border-color:${def.cor}` : ''}">` : ic('layers', tam - 2); },
  cor(def) { return def?.cor || null; },
  // editor: personagens antigos sem ícone/cor ganham na hora (uma vez)
  _feitos: new Set(),
  async garanteNoEditor(P) {
    for (const def of Object.values(P?.personagens || {})) { if (this._feitos.has(def.id) || (def.icone || def.iconeModo === 'nenhum') && def.cor) continue; this._feitos.add(def.id);
      await this.prepara(def); Arvore.pinta?.(); Folha.pinta?.(); }
  },
};
