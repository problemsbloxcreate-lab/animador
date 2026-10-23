/* ===================== pintura.js — ateliê: pintar, apagar, balde, conta-gotas, cores base e trocar cores (à mão ou pela IA) =====================
   Tudo mexe nos PIXELS da imagem da parte escolhida. Cada mudança vira uma imagem nova (chave nova), então o Ctrl+Z do ateliê
   volta a imagem de antes e a nuvem só recebe as imagens novas quando alguém clica em "Salvar na nuvem". */
'use strict';
const Pintura = {
  ferr: 'mover', cor: '#222222', tam: 14, tol: 48, opac: 1, escopo: 'imagem', selCores: [], paletaEscopo: 'tudo', mouse: null,
  FERR: [['mover', 'Mover', 'move', 'V'], ['pincel', 'Pincel', 'brush', 'B'], ['borracha', 'Borracha', 'eraser', 'N'], ['balde', 'Balde', 'bucket', 'G'], ['conta', 'Conta-gotas', 'pipette', 'I'],
    ['camada', 'Mover camada', 'layers', 'K'], ['ret', 'Seleção', 'marquee', 'M'], ['laco', 'Laço', 'lasso', 'L'], ['varinha', 'Varinha', 'wand', 'W'], ['magica', 'Borr. mágica', 'magicEraser', 'Y']],
  liga() {
    if (this._ligado) return; this._ligado = true; const cv = Atelie.cv;
    cv.addEventListener('pointermove', e => { if (this.ferr === 'mover') { if (this.mouse) { this.mouse = null; Atelie.desenha(); } return; } this.mouse = { x: e.offsetX, y: e.offsetY }; Atelie.desenha(); });
    cv.addEventListener('pointerleave', () => { this.mouse = null; Atelie.desenha(); });
  },
  usa(f) { this.ferr = f; if (!Atelie.edImg) Atelie.abaPintar?.(f !== 'mover'); // no palco: ferramenta de pintar abre a aba Camadas à direita (uma vez a cada clique); Mover volta para a aba de antes
    Atelie.cv.style.cursor = f === 'mover' ? '' : f === 'conta' ? 'copy' : 'crosshair'; Atelie.pinta(); },
  tecla(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false; const k = e.key.toLowerCase(), f = this.FERR.find(x => x[3].toLowerCase() === k);
    if (f) { this.usa(f[0]); return true; }
    if (this.ferr !== 'mover' && (k === '[' || k === ']')) { this.tam = clamp(Math.round(this.tam * (k === ']' ? 1.25 : .8)), 1, 300); Atelie.pinta(); return true; }
    return false;
  },
  // a imagem que está aparecendo na parte escolhida e o jeito de ir do mundo para os pixels dela
  alvo() {
    const p = Atelie.edImg ? Atelie.parte(Atelie.edImg.pid) : Atelie.parte(); if (!p) return null; const it = Atelie.edImg ? Atelie.itemEditor() : Modelo.montar(Atelie.def, Atelie.estado()).find(x => x.parte.id === p.id); if (!it?.img) return null; // editor de imagem: a imagem escolhida nele
    const cam = Camadas.tem(it.img) ? Camadas.ativa(it.img) : null, orig = Arq.img.get(it.img.k), bm = cam ? Arq.img.get(cam.k) : orig; if (!bm) return null;
    const img = it.img, px = img.pivo?.x ?? img.w / 2, py = img.pivo?.y ?? img.h / 2, inv = it.m.inverse(), kx = bm.width / img.w, ky = bm.height / img.h;
    const ajx = img.ajuste?.x || 0, ajy = img.ajuste?.y || 0;
    return { p, img, bm, it, cam, orig, quadro: Quadro.ctx(p.id), ap: it.ap, vivo: cam ? cv => Arq.img.set(img.k, Camadas.compoe(img, { [cam.id]: cv })) : null, de: q => it.m.transformPoint(new DOMPoint(q.x / kx - px + ajx, q.y / ky - py + ajy)), mImg: it.m.translate(-px + ajx, -py + ajy).scale(1 / kx, 1 / ky), para: w => { const l = inv.transformPoint(new DOMPoint(w.x, w.y)); return { x: (l.x + px - (img.ajuste?.x || 0)) * kx, y: (l.y + py - (img.ajuste?.y || 0)) * ky }; }, k: (kx + ky) / 2, escala: Math.hypot(it.m.a, it.m.b) };
  },
  // círculo do pincel no palco
  desenhaCursor(ctx) {
    this.desenhaSelecao(ctx);
    if (!this.mouse || !['pincel', 'borracha'].includes(this.ferr)) return; const a = this.alvo(), d = devicePixelRatio || 1;
    const r = Math.max(1.5, this.tam / 2 / (a?.k || 1) * (a?.escala || 1) * Atelie.vista.z * d);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath(); ctx.arc(this.mouse.x * d, this.mouse.y * d, r, 0, 7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * d; ctx.stroke();
    ctx.beginPath(); ctx.arc(this.mouse.x * d, this.mouse.y * d, r + 1.5 * d, 0, 7); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1 * d; ctx.stroke(); ctx.restore();
  },
  // grava o canvas como imagem nova da parte (chave nova: o desfazer volta a antiga)
  async gravar(img, cv) {
    if (Camadas.tem(img)) { const c = Camadas.ativa(img); c.k = await Camadas.guarda(cv); return Camadas.achata(img); } // pinta na camada ativa e refaz a imagem final
    const blob = await cv.convertToBlob({ type: 'image/png' }), iid = uid('im').toLowerCase().replace(/[^a-z0-9]/g, ''), k = `personagens/${Atelie.def.id}/img/${iid}.png`;
    await Arq.guardar(blob, k); Arq.img.set(k, await createImageBitmap(blob)); img.k = k; return k;
  },
  tela(bm) { const cv = new OffscreenCanvas(bm.width, bm.height), c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(bm, 0, 0); return { cv, c }; },
  async desce(e) {
    const a = this.alvo(); if (!a) { UI.toast('Escolha uma parte com imagem para pintar'); return; }
    const w = Atelie.mundo(e), pt = a.para(w);
    if (this.ferr === 'conta') { // pega a cor do que está na tela
      const d = devicePixelRatio || 1, px = Atelie.ctx.getImageData(Math.round(e.offsetX * d), Math.round(e.offsetY * d), 1, 1).data, hex = hexDe(px[0], px[1], px[2]);
      this.cor = hex; if (e.shiftKey) this.marca(hex, true); Atelie.pinta(); return;
    }
    if (['ret', 'laco', 'varinha'].includes(this.ferr)) return this.desceSelecao(e, a, pt);
    if (this.ferr === 'camada') { // MOVER CAMADA: arrasta os pixels da camada ativa
      if (!a.cam) return UI.toast('Esta imagem não tem camadas: botão direito na imagem › Editar com camadas (ou Pintar e cores › Camadas).', { kind: 'warn' });
      const cv0 = Atelie.cv; try { cv0.setPointerCapture(e.pointerId); } catch { } let ult = pt, d = { x: 0, y: 0 };
      const mov = ev => { if (acabou) return; const q = a.para(Atelie.mundo(ev)); d = { x: q.x - pt.x, y: q.y - pt.y }; if (ev.shiftKey) { if (Math.abs(d.x) > Math.abs(d.y)) d.y = 0; else d.x = 0; } a.vivo(Camadas.deslocado(a.bm, d.x, d.y)); Atelie.desenha(); };
      let acabou = false; const k0 = a.img.k; // igual ao pincel: a imagem de antes volta a ser a original (senão o Ctrl+Z mostra a camada movida)
      const up = async () => { if (acabou) return; acabou = true; for (const [t, f] of [['pointermove', mov], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up]]) cv0.removeEventListener(t, f);
        Arq.img.set(k0, a.orig); if (Math.abs(d.x) + Math.abs(d.y) < .5) return Atelie.desenha(); try { await this.gravar(a.img, Camadas.deslocado(a.bm, d.x, d.y)); } finally { Arq.img.set(k0, a.orig); } Atelie.commit(); };
      cv0.addEventListener('pointermove', mov); cv0.addEventListener('pointerup', up); cv0.addEventListener('pointercancel', up); cv0.addEventListener('lostpointercapture', up); return; }
    const aq = this.ferr === 'magica' && a.quadro ? Quadro.alvoApagar(a) : a; // borracha mágica num keyframe: apaga só nele
    const { cv, c } = this.tela(aq.bm), orig = aq.bm, k0 = a.img.k, mask = this.mascara(a);
    if (this.ferr === 'balde' || this.ferr === 'magica') { // balde pinta a área parecida; borracha mágica apaga a área parecida
      const antes = mask ? this.tela(aq.bm) : null;
      if (this.ferr === 'balde') this.balde(c, cv.width, cv.height, Math.floor(pt.x), Math.floor(pt.y), this.cor, this.tol);
      else { const m = this.areaParecida(c, cv.width, cv.height, Math.floor(pt.x), Math.floor(pt.y), this.tol, e.shiftKey); if (!m) return; c.globalCompositeOperation = 'destination-out'; c.drawImage(m, 0, 0); c.globalCompositeOperation = 'source-over'; }
      if (mask) this.soNaSelecao(c, antes.cv, mask); if (aq !== a) { if (await Quadro.gravaApagado(a, aq.bm, cv)) Atelie.commit(); return; } await this.gravar(a.img, cv); Atelie.commit(); return; }
    return this.traco(e, a, pt, mask); // pincel / borracha (pinceis.js: pressão da caneta, dureza, fluxo, suavização…)
  },
  balde(c, W, H, x, y, hex, tol) {
    if (x < 0 || y < 0 || x >= W || y >= H) return; const d = c.getImageData(0, 0, W, H), D = d.data, i0 = (y * W + x) * 4, alvo = [D[i0], D[i0 + 1], D[i0 + 2], D[i0 + 3]], [r, g, b] = rgbDe(hex);
    const perto = i => Math.abs(D[i] - alvo[0]) + Math.abs(D[i + 1] - alvo[1]) + Math.abs(D[i + 2] - alvo[2]) + Math.abs(D[i + 3] - alvo[3]) <= tol * 2;
    const visto = new Uint8Array(W * H), pilha = [x + y * W];
    while (pilha.length) { const p = pilha.pop(); if (visto[p]) continue; visto[p] = 1; const i = p * 4; if (!perto(i)) continue; D[i] = r; D[i + 1] = g; D[i + 2] = b; D[i + 3] = 255;
      const px = p % W; if (px > 0) pilha.push(p - 1); if (px < W - 1) pilha.push(p + 1); if (p >= W) pilha.push(p - W); if (p < W * (H - 1)) pilha.push(p + W); }
    c.putImageData(d, 0, 0);
  },

  /* ---------- cores base: as cores que mais aparecem (na imagem escolhida ou no personagem todo) ---------- */
  imagens(escopo) {
    const def = Atelie.def, p = Atelie.parte(), atual = p && p.imgs.find(i => i.id === Atelie.estado()[p.id]?.img);
    if (escopo === 'imagem') return atual ? [[p, atual]] : [];
    if (escopo === 'parte') return p ? p.imgs.map(i => [p, i]) : [];
    return def.partes.flatMap(pp => pp.imgs.map(i => [pp, i]));
  },
  async paleta(escopo = this.paletaEscopo) {
    const cont = new Map();
    for (const [, img] of this.imagens(escopo)) {
      await Arq.garantir([img.k]); const bm = Arq.img.get(img.k); if (!bm) continue; const k = Math.min(1, 160 / Math.max(bm.width, bm.height)), w = Math.max(1, Math.round(bm.width * k)), h = Math.max(1, Math.round(bm.height * k));
      const c = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true }); c.imageSmoothingEnabled = false; c.drawImage(bm, 0, 0, w, h); const D = c.getImageData(0, 0, w, h).data;
      for (let i = 0; i < D.length; i += 4) { if (D[i + 3] < 160) continue; const key = (D[i] >> 4) << 8 | (D[i + 1] >> 4) << 4 | (D[i + 2] >> 4); const v = cont.get(key) || [0, 0, 0, 0]; v[0] += D[i]; v[1] += D[i + 1]; v[2] += D[i + 2]; v[3]++; cont.set(key, v); }
    }
    let L = [...cont.values()].map(v => ({ r: v[0] / v[3], g: v[1] / v[3], b: v[2] / v[3], n: v[3] })).sort((a, b) => b.n - a.n), out = [];
    for (const c of L) { const j = out.find(o => Math.abs(o.r - c.r) + Math.abs(o.g - c.g) + Math.abs(o.b - c.b) < 54); if (j) j.n += c.n; else out.push({ ...c }); if (out.length >= 40) break; }
    const tot = out.reduce((s, c) => s + c.n, 0) || 1;
    return out.sort((a, b) => b.n - a.n).slice(0, 18).map(c => ({ hex: hexDe(c.r, c.g, c.b), pct: c.n / tot }));
  },
  marca(hex, somar) { const i = this.selCores.indexOf(hex); if (somar) { if (i >= 0) this.selCores.splice(i, 1); else this.selCores.push(hex); } else this.selCores = i >= 0 && this.selCores.length === 1 ? [] : [hex]; },

  /* ---------- trocar cores (mantém a sombra/luz de cada pixel: só desloca a cor) ---------- */
  async trocar(trocas, escopo = this.escopo, tol = this.tol) {
    trocas = trocas.filter(t => /^#[0-9a-f]{6}$/i.test(t.de) && /^#[0-9a-f]{6}$/i.test(t.para)).map(t => ({ de: rgbDe(t.de), para: rgbDe(t.para) })); if (!trocas.length) return 0;
    let n = 0; const lim = tol * 1.7;
    for (const [, img] of this.imagens(escopo)) {
      if (Camadas.tem(img)) { let algum = false; for (const cam of img.camadas) { await Arq.garantir([cam.k]); const b = Arq.img.get(cam.k); if (!b) continue; const t = this.tela(b), dd = t.c.getImageData(0, 0, t.cv.width, t.cv.height); if (this.trocaPixels(dd.data, trocas, lim)) { t.c.putImageData(dd, 0, 0); cam.k = await Camadas.guarda(t.cv); algum = true; } } if (algum) { await Camadas.achata(img); n++; } continue; } // com camadas: troca em cada uma
      await Arq.garantir([img.k]); const bm = Arq.img.get(img.k); if (!bm) continue; const { cv, c } = this.tela(bm), d = c.getImageData(0, 0, cv.width, cv.height), D = d.data; let mudou = false;
      for (let i = 0; i < D.length; i += 4) { if (!D[i + 3]) continue; let best = null, bd = lim;
        for (const t of trocas) { const dd = Math.abs(D[i] - t.de[0]) + Math.abs(D[i + 1] - t.de[1]) + Math.abs(D[i + 2] - t.de[2]); if (dd < bd) { bd = dd; best = t; } }
        if (!best) continue; const f = 1 - (bd / lim) ** 2; for (let j = 0; j < 3; j++) D[i + j] = clamp(Math.round(D[i + j] + (best.para[j] - best.de[j]) * f), 0, 255); mudou = true; }
      if (mudou) { c.putImageData(d, 0, 0); await this.gravar(img, cv); n++; }
    }
    if (n) Atelie.commit(); return n;
  },
  trocaPixels(D, trocas, lim) { let mudou = false;
    for (let i = 0; i < D.length; i += 4) { if (!D[i + 3]) continue; let best = null, bd = lim;
      for (const t of trocas) { const dd = Math.abs(D[i] - t.de[0]) + Math.abs(D[i + 1] - t.de[1]) + Math.abs(D[i + 2] - t.de[2]); if (dd < bd) { bd = dd; best = t; } }
      if (!best) continue; const f = 1 - (bd / lim) ** 2; for (let j = 0; j < 3; j++) D[i + j] = clamp(Math.round(D[i + j] + (best.para[j] - best.de[j]) * f), 0, 255); mudou = true; }
    return mudou; },
  SIS_IA: `Você ajusta as CORES de um personagem 2D feito de imagens. Recebe a paleta (cores que mais aparecem, com a porcentagem), as cores que a pessoa selecionou e o pedido.
Responda SÓ um JSON: {"trocas":[{"de":"#rrggbb","para":"#rrggbb"}],"explica":"uma frase em português"}.
"de" tem que ser uma cor da paleta ou das selecionadas. Troque só o que o pedido pede (se pedir para a cor selecionada ficar parecida com as outras selecionadas, troque só ela, no mesmo tom/saturação/brilho das outras). Mantenha contornos escuros e o branco dos olhos, a não ser que peçam. Máximo 18 trocas.`,
  async ia(pedido, escopo) {
    const pal = await this.paleta(escopo === 'imagem' ? 'imagem' : escopo === 'parte' ? 'parte' : 'tudo');
    const txt = await IA.chama(this.SIS_IA, `PALETA: ${JSON.stringify(pal.map(c => ({ cor: c.hex, pct: Math.round(c.pct * 100) })))}\nSELECIONADAS: ${JSON.stringify(this.selCores)}\nPEDIDO: ${pedido}`);
    const j = IA.json(txt), ok = new Set([...pal.map(c => c.hex), ...this.selCores]);
    const trocas = (j.trocas || []).filter(t => ok.has(String(t.de).toLowerCase()) || ok.has(String(t.de))).slice(0, 18);
    const n = await this.trocar(trocas, escopo, Math.max(this.tol, 40)); return { n, trocas, explica: j.explica || '' };
  },

  // lugar da barra: { lado: esq|dir|cima|baixo, f: posição ao longo da borda (0..1) }, guardado neste computador
  lugar() { if (!this._lugar) { try { this._lugar = JSON.parse(localStorage.getItem('animador-ferr-lugar') || 'null'); } catch { } this._lugar ||= { lado: 'esq', f: .5 }; } return this._lugar; },
  lugarBarra(el) {
    const L = this.lugar(); el.classList.remove('lado-esq', 'lado-dir', 'lado-cima', 'lado-baixo'); el.classList.add('lado-' + L.lado);
    if (L.lado === 'esq' || L.lado === 'dir') { el.style.left = L.lado === 'esq' ? '' : 'auto'; el.style.top = L.lado === 'esq' && L.f === .5 ? '' : `calc(${Math.round(L.f * 100)}%)`; }
    else { el.style.top = ''; el.style.left = `${Math.round(L.f * 100)}%`; }
  },
  alcaBarra(el, pega) {
    if (!pega) return; pega.onpointerdown = e => {
      if (e.button !== 0) return; e.preventDefault(); pega.setPointerCapture(e.pointerId); el.classList.add('arrastando'); const pal = el.parentElement.getBoundingClientRect();
      const mov = ev => { const x = (ev.clientX - pal.left) / pal.width, y = (ev.clientY - pal.top) / pal.height, d = { esq: x, dir: 1 - x, cima: y, baixo: 1 - y }, lado = Object.entries(d).sort((a, b) => a[1] - b[1])[0][0];
        this._lugar = { lado, f: clamp(lado === 'esq' || lado === 'dir' ? y : x, .12, .88) }; this.lugarBarra(el); };
      const up = () => { pega.onpointermove = null; pega.onpointerup = null; el.classList.remove('arrastando'); try { localStorage.setItem('animador-ferr-lugar', JSON.stringify(this._lugar)); } catch { } };
      pega.onpointermove = mov; pega.onpointerup = up; pega.onpointercancel = up; };
  },
  /* ---------- barra de ferramentas no canto esquerdo do palco (como no Photoshop) ---------- */
  pintaBarra() {
    const el = $('#at-ferr'); if (!el) return; el.hidden = !Atelie.def; if (el.hidden) { $('#at-ferr-op')?.remove(); return; } // a barra aparece no palco e no editor de imagem
    const grupo = (ids) => this.FERR.filter(f => ids.includes(f[0])).map(([f, n, i, k]) => `<button class="${this.ferr === f ? 'on' : ''}" data-f="${f}" title="${f === 'mover' ? 'Mão: arrastar move a tela' : n} (${k})">${ic(i, 17)}</button>`).join('');
    el.innerHTML = `<span class="fb-pega" title="Arraste para mudar a barra de lugar (gruda numa das bordas)">${ic('grip', 11)}</span>${grupo(['mover'])}<i></i>${grupo(['ret', 'laco', 'varinha'])}<i></i>${grupo(['pincel', 'borracha', 'magica', 'balde', 'conta'])}<i></i>
      <label class="fb-cor" title="Cor (${this.cor})" style="--c:${this.cor}"><input type="color" value="${this.cor}"></label>`;
    $$('[data-f]', el).forEach(b => b.onclick = () => this.usa(b.dataset.f));
    this.lugarBarra(el); this.alcaBarra(el, $('.fb-pega', el));
    $('input', el).oninput = ev => { this.cor = ev.target.value; $('.fb-cor', el).style.setProperty('--c', this.cor); }; $('input', el).onchange = () => Atelie.pinta();
    // opções da ferramenta (tamanho, opacidade, tolerância) do lado da barra
    let op = $('#at-ferr-op'); const precisa = ['pincel', 'borracha', 'balde', 'varinha', 'magica'].includes(this.ferr);
    if (!precisa) { op?.remove(); return; }
    if (!op) { op = h('<div id="at-ferr-op" class="ferr-op"></div>'); el.after(op); }
    if (['pincel', 'borracha'].includes(this.ferr)) { op.innerHTML = `<b>${this.ferr === 'borracha' ? 'Borracha' : 'Pincel'}</b>`; op.appendChild(this.controles(true)); return; }
    const nome = this.FERR.find(f => f[0] === this.ferr)?.[1] || '', campos = ['pincel', 'borracha'].includes(this.ferr) ? [['tam', 'Tamanho', 1, 300, 1], ['opac', 'Opacidade', .05, 1, .01]] : [['tol', 'Tolerância', 0, 160, 1]];
    op.innerHTML = `<b>${esc(nome)}</b>` + campos.map(([c, n, a, b, p]) => `<label title="${n}">${n}<input type="range" min="${a}" max="${b}" step="${p}" value="${this[c]}" data-c="${c}"><output>${c === 'opac' ? Math.round(this[c] * 100) + '%' : Math.round(this[c])}</output></label>`).join('');
    $$('input', op).forEach(i => i.oninput = () => { const c = i.dataset.c; this[c] = c === 'opac' ? +i.value : Math.round(+i.value); i.nextElementSibling.textContent = c === 'opac' ? Math.round(this[c] * 100) + '%' : this[c]; Atelie.desenha(); });
  },

  /* ---------- aba "Pintar" do ateliê ---------- */
  async pintaAba(el) {
    Camadas.painel(el); if (window.Ajustes) Ajustes.botoes(el);
    const box = h(`<div class="props"><div class="campo2"><span style="color:var(--tx2)">Cor</span><input type="color" value="${this.cor}" data-cor><code style="color:var(--tx3)">${this.cor}</code></div></div>`);
    $('[data-cor]', box).oninput = ev => { this.cor = ev.target.value; $('code', box).textContent = this.cor; };
    // tamanho, opacidade e tolerância ficam na barra de opções em cima do palco (como no Photoshop), não repetidos aqui
    box.appendChild(h(`<div style="color:var(--tx3);font-size:11.5px">Ferramentas na barra da esquerda; as opções delas aparecem em cima. <b>[ ]</b> tamanho do pincel · <b>Shift</b>+clique linha reta · mesa digitalizadora: pressão e a ponta de trás da caneta apaga · Ctrl+Z desfaz.</div>`));
    el.appendChild(box); el.appendChild(this.pintaSelecao());
    // cores base
    const pb = h(`<div class="sessao"><h4>Cores base <span class="sp"></span><select data-esc title="De onde tirar as cores"><option value="tudo">personagem todo</option><option value="parte">esta parte</option><option value="imagem">esta imagem</option></select></h4><div class="pt-pal"><span class="spin-dot"></span></div>
      <div style="color:var(--tx3);font-size:11.5px;margin-top:6px">Clique: pinta com ela e seleciona · Shift+clique: junta mais cores na seleção · conta-gotas + Shift também seleciona.</div></div>`);
    $('[data-esc]', pb).value = this.paletaEscopo; $('[data-esc]', pb).onchange = ev => { this.paletaEscopo = ev.target.value; Atelie.pinta(); };
    el.appendChild(pb);
    const pal = await this.paleta(), g = $('.pt-pal', pb); g.innerHTML = pal.length ? '' : '<div class="vazio">Sem imagens ainda.</div>';
    for (const c of pal) { const s = h(`<button class="pt-cor ${this.selCores.includes(c.hex) ? 'on' : ''}" style="background:${c.hex}" title="${c.hex} · ${Math.round(c.pct * 100)}%"></button>`); s.onclick = ev => { this.cor = c.hex; this.marca(c.hex, ev.shiftKey || ev.ctrlKey); Atelie.pinta(); }; g.appendChild(s); }
    // trocar cores
    const sel = this.selCores, tr = h(`<div class="sessao"><h4>Trocar cores</h4>
      <div class="pt-selec">${sel.length ? sel.map(x => `<i style="background:${x}" title="${x}"></i>`).join('') + `<button class="btn sm" data-limpa>Limpar</button>` : '<span style="color:var(--tx3);font-size:12px">Selecione cores na paleta (ou com o conta-gotas + Shift).</span>'}</div>
      <div class="campo2"><span style="color:var(--tx2)">Onde</span><select data-onde><option value="imagem">esta imagem</option><option value="parte">todas as imagens da parte</option><option value="tudo">todas as partes</option></select></div>
      <div class="campo2"><span style="color:var(--tx2)">Por</span><input type="color" value="${this.cor}" data-para><button class="btn sm" data-trocar ${sel.length ? '' : 'disabled'}>Trocar a(s) selecionada(s)</button></div>
      <label class="field" style="margin-top:8px">Pedir à IA<textarea rows="2" placeholder="Ex.: deixa a cor selecionada parecida com as outras selecionadas · deixa o personagem todo em tons de outono"></textarea></label>
      <div class="campo2"><button class="btn sm ia" data-ia>${ic('sparkles', 13)} Ajustar as cores com a IA</button></div><div class="ia-res" hidden></div></div>`);
    $('[data-onde]', tr).value = this.escopo; $('[data-onde]', tr).onchange = ev => { this.escopo = ev.target.value; };
    if ($('[data-limpa]', tr)) $('[data-limpa]', tr).onclick = () => { this.selCores = []; Atelie.pinta(); };
    $('[data-trocar]', tr).onclick = async () => { const para = $('[data-para]', tr).value, n = await this.trocar(sel.map(de => ({ de, para }))); UI.toast(n ? `Cor trocada em ${n} imagem(ns).` : 'Nenhum pixel parecido (aumente a tolerância).', { kind: n ? 'ok' : 'warn' }); };
    $('[data-ia]', tr).onclick = async () => {
      const ped = $('textarea', tr).value.trim(), res = $('.ia-res', tr), bt = $('[data-ia]', tr); if (!ped) return $('textarea', tr).focus();
      bt.disabled = true; res.hidden = false; res.textContent = 'A IA está escolhendo as cores…';
      try { const r = await this.ia(ped, this.escopo); res.textContent = `${r.explica || 'Pronto.'} (${r.trocas.length} troca(s) em ${r.n} imagem(ns); Ctrl+Z desfaz)`; } catch (e) { res.textContent = 'Não deu: ' + e.message; }
      bt.disabled = false;
    };
    el.appendChild(tr);
  },
};
function hexDe(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function rgbDe(hex) { const v = parseInt(String(hex).slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
