/* ===================== recorte.js — ateliê: seleção e recorte tipo Photoshop (na imagem que está aparecendo na parte escolhida) =====================
   Ferramentas: Seleção retangular (M), Laço (L), Varinha mágica (W) e Borracha mágica (Y). Shift soma à seleção, Alt tira.
   Com algo selecionado: Delete apaga · Ctrl+J copia para uma PARTE NOVA · Ctrl+Shift+J recorta para uma parte nova
   · Ctrl+Shift+I inverte · Ctrl+D desmarca · Ctrl+A seleciona tudo. "Aparar" corta as sobras transparentes sem tirar a peça do lugar.
   A seleção é uma máscara do tamanho da imagem (branco = selecionado); pincel e borracha só mexem dentro dela. */
'use strict';
Object.assign(Pintura, {
  selecao: null, _prev: null,
  // máscara da seleção, se ela for desta imagem
  mascara(a = this.alvo()) { const s = this.selecao; return a && s && s.pid === a.p.id && s.iid === a.img.id && s.w === a.bm.width && s.h === a.bm.height ? s.mask : null; },
  temSelecao() { return !!this.mascara(); },
  novaMascara(w, h) { return new OffscreenCanvas(w, h); },
  // pixels parecidos com o do ponto (encostados nele; com "todos", na imagem toda)
  areaParecida(c, W, H, x, y, tol, todos) {
    if (x < 0 || y < 0 || x >= W || y >= H) return null; const D = c.getImageData(0, 0, W, H).data, i0 = (y * W + x) * 4, al = [D[i0], D[i0 + 1], D[i0 + 2], D[i0 + 3]];
    const perto = i => (al[3] < 20 && D[i + 3] < 20) || Math.abs(D[i] - al[0]) + Math.abs(D[i + 1] - al[1]) + Math.abs(D[i + 2] - al[2]) + Math.abs(D[i + 3] - al[3]) <= tol * 2;
    const m = new OffscreenCanvas(W, H), mc = m.getContext('2d'), out = mc.createImageData(W, H), O = out.data;
    if (todos) { for (let p = 0; p < W * H; p++) if (perto(p * 4)) O[p * 4 + 3] = 255; }
    else { const visto = new Uint8Array(W * H), pilha = [x + y * W];
      while (pilha.length) { const p = pilha.pop(); if (visto[p]) continue; visto[p] = 1; if (!perto(p * 4)) continue; O[p * 4 + 3] = 255;
        const px = p % W; if (px > 0) pilha.push(p - 1); if (px < W - 1) pilha.push(p + 1); if (p >= W) pilha.push(p - W); if (p < W * (H - 1)) pilha.push(p + W); } }
    for (let p = 0; p < W * H; p++) if (O[p * 4 + 3]) O[p * 4] = O[p * 4 + 1] = O[p * 4 + 2] = 255;
    mc.putImageData(out, 0, 0); return m;
  },
  // depois de mexer na imagem toda, devolve o que estava fora da seleção
  soNaSelecao(c, antes, mask) {
    const W = antes.width, H = antes.height, dentro = new OffscreenCanvas(W, H), x = dentro.getContext('2d'); x.drawImage(c.canvas, 0, 0); x.globalCompositeOperation = 'destination-in'; x.drawImage(mask, 0, 0);
    c.globalCompositeOperation = 'copy'; c.drawImage(antes, 0, 0); c.globalCompositeOperation = 'destination-out'; c.drawImage(mask, 0, 0); c.globalCompositeOperation = 'source-over'; c.drawImage(dentro, 0, 0);
  },
  // junta a máscara nova com a que já existe (nova / somar / tirar)
  combina(a, m, modo, contorno) {
    const s0 = this.mascara(a);
    if (modo === 'nova' || !s0) { this.selecao = { pid: a.p.id, iid: a.img.id, w: a.bm.width, h: a.bm.height, mask: m, contorno: modo === 'tira' ? null : contorno || null }; if (modo === 'tira') { this.selecao = null; } }
    else { const x = s0.getContext('2d'); x.globalCompositeOperation = modo === 'tira' ? 'destination-out' : 'source-over'; x.drawImage(m, 0, 0); x.globalCompositeOperation = 'source-over'; this.selecao.contorno = null; }
    if (this.selecao && !this.bbox(this.selecao.mask)) this.selecao = null; this.tinge(); Atelie.pinta();
  },
  tinge() { const s = this.selecao; if (!s) return; const o = new OffscreenCanvas(s.w, s.h), x = o.getContext('2d'); x.drawImage(s.mask, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = 'rgba(70,150,255,.38)'; x.fillRect(0, 0, s.w, s.h); s.over = o; },
  poligono(W, H, pts) { const m = new OffscreenCanvas(W, H), x = m.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)); x.closePath(); x.fill(); return m; },
  desceSelecao(e, a, pt) {
    const modo = e.altKey ? 'tira' : e.shiftKey ? 'soma' : 'nova', W = a.bm.width, H = a.bm.height;
    if (this.ferr === 'varinha') { const { c } = this.tela(a.bm), m = this.areaParecida(c, W, H, Math.floor(pt.x), Math.floor(pt.y), this.tol, false); if (m) this.combina(a, m, modo); return; }
    Atelie.cv.setPointerCapture(e.pointerId); const pts = [pt]; this._prev = { a, pts, ret: this.ferr === 'ret' };
    const mov = ev => { const p2 = a.para(Atelie.mundo(ev)); if (this.ferr === 'ret') pts[1] = p2; else pts.push(p2); Atelie.desenha(); };
    const up = () => { Atelie.cv.removeEventListener('pointermove', mov); Atelie.cv.removeEventListener('pointerup', up); this._prev = null;
      let poly = pts; if (this.ferr === 'ret') { const b = pts[1] || pts[0]; poly = [pts[0], { x: b.x, y: pts[0].y }, b, { x: pts[0].x, y: b.y }]; }
      const area = Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
      if (area < 4) { if (modo === 'nova') this.desmarcar(); else Atelie.desenha(); return; } // clique sem arrastar: desmarca
      this.combina(a, this.poligono(W, H, poly), modo, poly); };
    Atelie.cv.addEventListener('pointermove', mov); Atelie.cv.addEventListener('pointerup', up);
  },
  desenhaSelecao(ctx) {
    const a = (this.selecao || this._prev) ? this.alvo() : null; if (!a) return; const T = Atelie.V().multiply(a.mImg), d = devicePixelRatio || 1;
    const linha = pts => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); const P = pts.map(p => T.transformPoint(new DOMPoint(p.x, p.y))); ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
      ctx.lineWidth = 1.2 * d; ctx.strokeStyle = '#000'; ctx.stroke(); ctx.setLineDash([5 * d, 4 * d]); ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore(); };
    const m = this.mascara(a); if (m && this.selecao.over) { ctx.save(); ctx.setTransform(T); ctx.drawImage(this.selecao.over, 0, 0); ctx.restore(); if (this.selecao.contorno) linha(this.selecao.contorno); }
    const pv = this._prev; if (pv && pv.pts.length > 1) linha(pv.ret ? [pv.pts[0], { x: pv.pts[1].x, y: pv.pts[0].y }, pv.pts[1], { x: pv.pts[0].x, y: pv.pts[1].y }] : pv.pts);
  },
  bbox(cv) { const W = cv.width, H = cv.height, D = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (D[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; },

  /* ---------- ações ---------- */
  desmarcar() { this.selecao = null; this._prev = null; Atelie.pinta(); },
  tudo() { const a = this.alvo(); if (!a) return UI.toast('Escolha uma parte com imagem'); const m = new OffscreenCanvas(a.bm.width, a.bm.height), x = m.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, m.width, m.height); this.combina(a, m, 'nova', [{ x: 0, y: 0 }, { x: m.width, y: 0 }, { x: m.width, y: m.height }, { x: 0, y: m.height }]); },
  inverter() { const a = this.alvo(), m0 = this.mascara(a); if (!m0) return; const m = new OffscreenCanvas(m0.width, m0.height), x = m.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, m.width, m.height); x.globalCompositeOperation = 'destination-out'; x.drawImage(m0, 0, 0); this.combina(a, m, 'nova'); },
  async mexeDentro(modo) { // 'apagar' a seleção ou 'manter' só ela
    const a = this.alvo(), m = this.mascara(a); if (!m) return UI.toast('Selecione uma área primeiro (M, L ou W)');
    const { cv, c } = this.tela(a.bm); c.globalCompositeOperation = modo === 'apagar' ? 'destination-out' : 'destination-in'; c.drawImage(m, 0, 0); await this.gravar(a.img, cv); Atelie.commit();
  },
  pedaco(a, m) { const { cv, c } = this.tela(a.bm); c.globalCompositeOperation = 'destination-in'; c.drawImage(m, 0, 0); const bb = this.bbox(cv); if (!bb) return null; const o = new OffscreenCanvas(bb.w, bb.h); o.getContext('2d').drawImage(cv, -bb.x, -bb.y); return { cv: o, bb }; },
  async guardarImg(cv) { const blob = await cv.convertToBlob({ type: 'image/png' }), k = `personagens/${Atelie.def.id}/img/${uid('im').toLowerCase().replace(/[^a-z0-9]/g, '')}.png`; await Arq.guardar(blob, k); Arq.img.set(k, await createImageBitmap(blob)); return k; },
  // a imagem do pedaço, no MESMO lugar (o pivô acompanha o corte)
  imgDoPedaco(a, pc, nome) { const kx = a.bm.width / a.img.w, ky = a.bm.height / a.img.h, pv = a.img.pivo || { x: a.img.w / 2, y: a.img.h / 2 };
    return { id: uid('i'), nome, w: round(pc.bb.w / kx, 2), h: round(pc.bb.h / ky, 2), pivo: { x: round(pv.x - pc.bb.x / kx, 2), y: round(pv.y - pc.bb.y / ky, 2) }, ajuste: { ...(a.img.ajuste || { x: 0, y: 0 }) } }; },
  // copiar/recortar a seleção para uma PARTE NOVA, encaixada no mesmo pai e no mesmo lugar (bom para separar braço, cabelo, olho…)
  async paraParte(cortar) {
    const a = this.alvo(), m = this.mascara(a); if (!m) return UI.toast('Selecione uma área primeiro (M, L ou W)');
    const pc = this.pedaco(a, m); if (!pc) return UI.toast('A seleção está vazia (só transparência)', { kind: 'warn' });
    const nome = await UI.prompt({ title: cortar ? 'Recortar para uma parte nova' : 'Copiar para uma parte nova', label: 'Nome da parte (ex.: Mão direita, Franja, Olho esquerdo)', value: a.p.nome + (cortar ? ' (recorte)' : ' (cópia)'), ok: cortar ? 'Recortar' : 'Copiar' }); if (!nome) return;
    const img = this.imgDoPedaco(a, pc, nome); img.k = await this.guardarImg(pc.cv);
    if (cortar) { const { cv, c } = this.tela(a.bm); c.globalCompositeOperation = 'destination-out'; c.drawImage(m, 0, 0); await this.gravar(a.img, cv); }
    // a parte nova encaixa NA original, no ponto zero: fica exatamente no mesmo lugar e acompanha a original quando ela mexe
    const p = a.p, q = Modelo.novaParte(nome, p.id); q.base.img = img.id; q.imgs = [img];
    const L = Atelie.ordemCamadas().reverse(); Atelie.def.partes.push(q); L.splice(L.indexOf(p), 0, q); // logo na frente da original
    this.selecao = null; Atelie.escolhe(q.id); Atelie.reordenar(L);
    UI.toast(`<b>${esc(nome)}</b> virou uma parte nova, no mesmo lugar e encaixada em "${esc(p.nome)}"${cortar ? ' (e saiu da original)' : ''}. Alt+arrastar muda o pivô dela.`, { kind: 'ok', time: 6000 });
  },
  // copiar a seleção como IMAGEM NOVA desta mesma parte (ex.: uma variação da boca)
  async paraImagem() {
    const a = this.alvo(), m = this.mascara(a); if (!m) return UI.toast('Selecione uma área primeiro (M, L ou W)');
    const pc = this.pedaco(a, m); if (!pc) return UI.toast('A seleção está vazia', { kind: 'warn' });
    const nome = await UI.prompt({ title: 'Imagem nova desta parte', label: 'Nome da imagem', value: a.img.nome + ' (pedaço)', ok: 'Criar' }); if (!nome) return;
    const img = this.imgDoPedaco(a, pc, nome); img.k = await this.guardarImg(pc.cv); if (a.img.pasta) img.pasta = a.img.pasta; a.p.imgs.push(img);
    this.selecao = null; Atelie.mudar(a.p.id, { img: img.id }); Atelie.commit();
  },
  // corta as bordas transparentes sem tirar a peça do lugar
  // corta as bordas transparentes sem tirar a peça do lugar
  async apararLista(lista) {
    let n = 0; await Arq.garantir(lista.map(i => i.k));
    for (const img of lista) { if (Camadas.tem(img)) continue; /* com camadas: não apara (as camadas têm o tamanho da imagem) */ const bm = Arq.img.get(img.k); if (!bm) continue; const { cv } = this.tela(bm), bb = this.bbox(cv); if (!bb || (bb.w === bm.width && bb.h === bm.height)) continue;
      const o = new OffscreenCanvas(bb.w, bb.h); o.getContext('2d').drawImage(cv, -bb.x, -bb.y); const kx = bm.width / img.w, ky = bm.height / img.h, pv = img.pivo || { x: img.w / 2, y: img.h / 2 };
      img.k = await this.guardarImg(o); img.pivo = { x: round(pv.x - bb.x / kx, 2), y: round(pv.y - bb.y / ky, 2) }; img.w = round(bb.w / kx, 2); img.h = round(bb.h / ky, 2); n++; }
    return n;
  },
  async aparar(todas) {
    const a = this.alvo(); if (!a) return UI.toast('Escolha uma parte com imagem'); const n = await this.apararLista(todas ? a.p.imgs : [a.img]);
    this.selecao = null; if (n) Atelie.commit(); UI.toast(n ? `${n} imagem(ns) aparada(s). A peça continua no mesmo lugar.` : 'Não tinha sobra transparente para aparar.', { kind: n ? 'ok' : 'warn' });
  },
  // teclas com Ctrl (chamado pelo Atelie.teclas)
  teclaCtrl(e) {
    const k = e.key.toLowerCase(); if (Atelie.teste && Animacoes.rodando) return false;
    if (window.Ajustes && Ajustes.tecla(e)) return true; // Ctrl+U, Ctrl+Shift+U, Ctrl+I
    if (k === 'd') { e.preventDefault(); this.desmarcar(); return true; }
    if (k === 'a') { e.preventDefault(); this.tudo(); return true; }
    if (k === 'i' && e.shiftKey) { e.preventDefault(); this.inverter(); return true; }
    if (k === 'j' && this.temSelecao()) { e.preventDefault(); this.paraParte(e.shiftKey); return true; }
    return false;
  },
  pintaSelecao() {
    const tem = this.temSelecao(), box = h(`<div class="sessao"><h4>Seleção e recorte</h4>
      <div class="pt-acoes">${tem ? `
        <button class="btn sm" data-a="apagar" title="Delete">${ic('trash', 12)} Apagar</button><button class="btn sm" data-a="manter">${ic('crop', 12)} Manter só ela</button>
        <button class="btn sm" data-a="cortarParte" title="Ctrl+Shift+J">${ic('scissors', 12)} Recortar → parte nova</button><button class="btn sm" data-a="copiarParte" title="Ctrl+J">${ic('copy', 12)} Copiar → parte nova</button>
        <button class="btn sm" data-a="imagem">${ic('image', 12)} Copiar → imagem desta parte</button><button class="btn sm" data-a="inverter" title="Ctrl+Shift+I">Inverter</button><button class="btn sm" data-a="desmarcar" title="Ctrl+D / Esc">Desmarcar</button>`
        : `<button class="btn sm" data-a="tudo" title="Ctrl+A">Selecionar tudo</button>`}
        <button class="btn sm" data-a="aparar" title="Corta as sobras transparentes desta imagem">${ic('crop', 12)} Aparar</button><button class="btn sm" data-a="apararTodas">Aparar todas da parte</button></div>
      <div style="color:var(--tx3);font-size:11.5px;margin-top:6px">${tem ? 'Pincel e borracha só mexem dentro da seleção.' : 'Use <b>Seleção (M)</b>, <b>Laço (L)</b> ou <b>Varinha (W)</b> na peça. Shift soma, Alt tira.'} Recortar para parte nova separa um pedaço (braço, franja, olho) e deixa no mesmo lugar.</div></div>`);
    const acoes = { apagar: () => this.mexeDentro('apagar'), manter: () => this.mexeDentro('manter'), cortarParte: () => this.paraParte(true), copiarParte: () => this.paraParte(false), imagem: () => this.paraImagem(), inverter: () => this.inverter(), desmarcar: () => this.desmarcar(), tudo: () => this.tudo(), aparar: () => this.aparar(false), apararTodas: () => this.aparar(true) };
    $$('[data-a]', box).forEach(b => b.onclick = () => acoes[b.dataset.a]());
    return box;
  },
});
