/* ===================== pintura.js — ateliê: pintar, apagar, balde, conta-gotas, cores base e trocar cores (à mão ou pela IA) =====================
   Tudo mexe nos PIXELS da imagem da parte escolhida. Cada mudança vira uma imagem nova (chave nova), então o Ctrl+Z do ateliê
   volta a imagem de antes e a nuvem só recebe as imagens novas quando alguém clica em "Salvar na nuvem". */
'use strict';
const Pintura = {
  ferr: 'mover', cor: '#222222', tam: 14, tol: 48, escopo: 'imagem', selCores: [], paletaEscopo: 'tudo', mouse: null,
  FERR: [['mover', 'Mover', 'move', 'V'], ['pincel', 'Pincel', 'brush', 'B'], ['borracha', 'Borracha', 'eraser', 'N'], ['balde', 'Balde', 'bucket', 'G'], ['conta', 'Conta-gotas', 'pipette', 'I']],
  liga() {
    if (this._ligado) return; this._ligado = true; const cv = Atelie.cv;
    cv.addEventListener('pointermove', e => { if (this.ferr === 'mover') { if (this.mouse) { this.mouse = null; Atelie.desenha(); } return; } this.mouse = { x: e.offsetX, y: e.offsetY }; Atelie.desenha(); });
    cv.addEventListener('pointerleave', () => { this.mouse = null; Atelie.desenha(); });
  },
  usa(f) { this.ferr = f; Atelie.cv.style.cursor = f === 'mover' ? '' : f === 'conta' ? 'copy' : 'crosshair'; Atelie.pinta(); },
  tecla(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false; const k = e.key.toLowerCase(), f = this.FERR.find(x => x[3].toLowerCase() === k);
    if (f) { this.usa(f[0]); return true; }
    if (this.ferr !== 'mover' && (k === '[' || k === ']')) { this.tam = clamp(Math.round(this.tam * (k === ']' ? 1.25 : .8)), 1, 300); Atelie.pinta(); return true; }
    return false;
  },
  // a imagem que está aparecendo na parte escolhida e o jeito de ir do mundo para os pixels dela
  alvo() {
    const p = Atelie.parte(); if (!p) return null; const it = Modelo.montar(Atelie.def, Atelie.estado()).find(x => x.parte.id === p.id); if (!it?.img) return null;
    const bm = Arq.img.get(it.img.k); if (!bm) return null;
    const img = it.img, px = img.pivo?.x ?? img.w / 2, py = img.pivo?.y ?? img.h / 2, inv = it.m.inverse(), kx = bm.width / img.w, ky = bm.height / img.h;
    return { p, img, bm, para: w => { const l = inv.transformPoint(new DOMPoint(w.x, w.y)); return { x: (l.x + px - (img.ajuste?.x || 0)) * kx, y: (l.y + py - (img.ajuste?.y || 0)) * ky }; }, k: (kx + ky) / 2, escala: Math.hypot(it.m.a, it.m.b) };
  },
  // círculo do pincel no palco
  desenhaCursor(ctx) {
    if (!this.mouse || !['pincel', 'borracha'].includes(this.ferr)) return; const a = this.alvo(), d = devicePixelRatio || 1;
    const r = Math.max(1.5, this.tam / 2 / (a?.k || 1) * (a?.escala || 1) * Atelie.vista.z * d);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath(); ctx.arc(this.mouse.x * d, this.mouse.y * d, r, 0, 7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * d; ctx.stroke();
    ctx.beginPath(); ctx.arc(this.mouse.x * d, this.mouse.y * d, r + 1.5 * d, 0, 7); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1 * d; ctx.stroke(); ctx.restore();
  },
  // grava o canvas como imagem nova da parte (chave nova: o desfazer volta a antiga)
  async gravar(img, cv) {
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
    const { cv, c } = this.tela(a.bm), orig = a.bm, k0 = a.img.k;
    if (this.ferr === 'balde') { this.balde(c, cv.width, cv.height, Math.floor(pt.x), Math.floor(pt.y), this.cor, this.tol); await this.gravar(a.img, cv); Atelie.commit(); return; }
    // pincel / borracha: traço contínuo
    c.lineCap = c.lineJoin = 'round'; c.lineWidth = this.tam; c.strokeStyle = c.fillStyle = this.cor; c.globalCompositeOperation = this.ferr === 'borracha' ? 'destination-out' : 'source-over';
    let ult = pt; c.beginPath(); c.arc(pt.x, pt.y, this.tam / 2, 0, 7); c.fill(); Arq.img.set(k0, cv); Atelie.desenha();
    Atelie.cv.setPointerCapture(e.pointerId);
    const mov = ev => { const p2 = a.para(Atelie.mundo(ev)); c.beginPath(); c.moveTo(ult.x, ult.y); c.lineTo(p2.x, p2.y); c.stroke(); ult = p2; Atelie.desenha(); };
    const up = async () => { Atelie.cv.removeEventListener('pointermove', mov); Atelie.cv.removeEventListener('pointerup', up); Arq.img.set(k0, orig); await this.gravar(a.img, cv); Atelie.commit(); };
    Atelie.cv.addEventListener('pointermove', mov); Atelie.cv.addEventListener('pointerup', up);
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
      await Arq.garantir([img.k]); const bm = Arq.img.get(img.k); if (!bm) continue; const { cv, c } = this.tela(bm), d = c.getImageData(0, 0, cv.width, cv.height), D = d.data; let mudou = false;
      for (let i = 0; i < D.length; i += 4) { if (!D[i + 3]) continue; let best = null, bd = lim;
        for (const t of trocas) { const dd = Math.abs(D[i] - t.de[0]) + Math.abs(D[i + 1] - t.de[1]) + Math.abs(D[i + 2] - t.de[2]); if (dd < bd) { bd = dd; best = t; } }
        if (!best) continue; const f = 1 - (bd / lim) ** 2; for (let j = 0; j < 3; j++) D[i + j] = clamp(Math.round(D[i + j] + (best.para[j] - best.de[j]) * f), 0, 255); mudou = true; }
      if (mudou) { c.putImageData(d, 0, 0); await this.gravar(img, cv); n++; }
    }
    if (n) Atelie.commit(); return n;
  },
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

  /* ---------- aba "Pintar" do ateliê ---------- */
  async pintaAba(el) {
    const ferr = h(`<div class="pt-ferr">${this.FERR.map(([f, n, i, k]) => `<button class="${this.ferr === f ? 'on' : ''}" data-f="${f}" title="${n} (${k})">${ic(i, 16)}<small>${n}</small></button>`).join('')}</div>`);
    $$('[data-f]', ferr).forEach(b => b.onclick = () => this.usa(b.dataset.f)); el.appendChild(ferr);
    const box = h(`<div class="props"><div class="campo2"><span style="color:var(--tx2)">Cor</span><input type="color" value="${this.cor}" data-cor><code style="color:var(--tx3)">${this.cor}</code></div></div>`);
    $('[data-cor]', box).oninput = ev => { this.cor = ev.target.value; $('code', box).textContent = this.cor; };
    box.appendChild(Lado.campo('Tamanho', this.tam, 1, 300, 1, v => { this.tam = Math.round(v); Atelie.desenha(); }));
    box.appendChild(Lado.campo('Tolerância', this.tol, 0, 160, 1, v => { this.tol = Math.round(v); }));
    box.appendChild(h(`<div style="color:var(--tx3);font-size:11.5px">Pinta na imagem que está aparecendo na parte escolhida. <b>[ ]</b> muda o tamanho do pincel. Tolerância vale para o balde e para trocar cores. Ctrl+Z desfaz.</div>`));
    el.appendChild(box);
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
