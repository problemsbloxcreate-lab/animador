/* ===================== desenho.js — desenha um quadro: camadas, personagens (pelas partes), câmera, cor, efeitos e legendas ===================== */
'use strict';
const Render = {
  aoChegarImagem: null, // a tela redesenha quando uma imagem termina de carregar
  bm(id) { return Arq.bitmap(id, () => Render.aoChegarImagem?.()); },
  // matriz do nó (x, y, giro, escala, espelho) a partir da do pai
  matNo(m, t) { return m.translate(t.x || 0, t.y || 0).rotate(t.r || 0).scale((t.s ?? 1) * (t.sx || 1), t.s ?? 1); },
  // percorre do fundo para a frente: o 1º da lista fica na frente (como na hierarquia)
  cadaVisivel(P, q, fn, m0 = new DOMMatrix(), alfa0 = 1) {
    const vai = (lista, m, alfa) => {
      for (let i = lista.length - 1; i >= 0; i--) {
        const n = lista[i]; if (n.vis === false || !Modelo.aparece(P, n, q)) continue;
        const t = Modelo.transfVis(n, q), a = alfa * (t.op ?? 1); let mm = this.matNo(m, t); if (n.tremulo) mm = mm.multiply(this.tremor(n, q));
        if (n.filhos) vai(n.filhos, mm, a); else fn(n, mm, a, t);
      }
    };
    vai(P.raiz, m0, alfa0);
  },
  /* ---------- TRÊMULO (como o "turbulento" do Premiere): a camada parada treme/ondula sozinha, quadro a quadro ----------
     n.tremulo = { modo: 'tremer' | 'ondular', forca: 0–1, ritmo: quadros até mudar (2 = "em 12" num vídeo de 24) } */
  sorte(id, k, i) { let h = 2166136261; const s = id + ':' + k + ':' + i; for (let c = 0; c < s.length; c++) { h ^= s.charCodeAt(c); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000 - .5; },
  passo(n, q) { return Math.floor(q / Math.max(1, n.tremulo.ritmo || 2)); },
  tremor(n, q) {
    const T = n.tremulo, f = T.forca ?? .4, k = this.passo(n, q), r = i => this.sorte(n.id, k, i);
    if (T.modo === 'ondular') return new DOMMatrix().rotate(r(3) * f * .8); // o ondular mexe nos pixels (onda); aqui só um tiquinho de giro
    return new DOMMatrix().translate(r(1) * f * 16, r(2) * f * 16).rotate(r(3) * f * 2.4).scale(1 + r(4) * f * .03);
  },
  // imagem em faixas deslocadas por uma onda que muda a cada passo (efeito "ondular")
  // caixa (no espaço da camada) de um texto ou forma, com a borda
  caixaNo(ctx, n) {
    const bl = (n.bordaL || 0) + 2;
    if (n.tipo === 'forma') return { w: (n.w || 100) + bl * 2, h: (n.h || 100) + bl * 2 };
    ctx.save(); ctx.font = `${n.negrito ? '800 ' : ''}${n.tam || 72}px ${n.fonte || 'Segoe UI'}, sans-serif`; const L = String(n.texto || '').split('\n'), w = Math.max(1, ...L.map(l => ctx.measureText(l).width)); ctx.restore();
    return { w: w + bl * 2 + (n.tam || 72) * .2, h: L.length * (n.tam || 72) * 1.15 + bl * 2 + (n.tam || 72) * .2 };
  },
  // canvas reaproveitado (um por nome) para desenhos de passagem
  tela(nome, w, h) { const c = (this._telas ||= {})[nome] ||= document.createElement('canvas'); w = Math.min(4096, Math.max(1, w)); h = Math.min(4096, Math.max(1, h)); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; },
  // SVG (vetor) no ondular: as faixas são recortadas do desenho já no tamanho da tela, então continua nítido no zoom e no MP4
  nitido(bm, w, h, M) {
    if (!(bm instanceof HTMLImageElement)) return bm; const k = Math.min(4, Math.max(.25, Math.hypot(M.a, M.b))), W = Math.ceil(w * k), H = Math.ceil(h * k);
    const ch = (this._nit ||= new Map()), id = bm.src + '|' + W + 'x' + H; if (ch.has(id)) return ch.get(id);
    const c = document.createElement('canvas'); c.width = Math.min(4096, W); c.height = Math.min(4096, H); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    if (ch.size > 40) ch.delete(ch.keys().next().value); ch.set(id, c); return c;
  },
  ondulado(ctx, n, q, bm, x, y, w, h) {
    const T = n.tremulo, f = T.forca ?? .4, k = this.passo(n, q), fase = this.sorte(n.id, k, 9) * 40, amp = 1.5 + f * 7, freq = .045 + (this.sorte(n.id, k, 8) + .5) * .03;
    const faixa = Math.max(2, Math.round(bm.height / 120)), ky = h / bm.height;
    for (let sy = 0; sy < bm.height; sy += faixa) { const sh = Math.min(faixa * 2, bm.height - sy), /* faixa dobrada: a próxima cobre a emenda (sem risquinhos) */ dx = Math.sin((sy * ky) * freq + fase) * amp + Math.sin((sy * ky) * freq * 2.3 - fase) * amp * .35;
      ctx.drawImage(bm, 0, sy, bm.width, sh, x + dx, y + sy * ky, w, sh * ky); }
  },
  pecasPersonagem(P, n, q, m) {
    const def = P.personagens[n.ref]; if (!def) return [];
    const est = Modelo.estadoPersonagem(n, q), dv = Modelo.naVista(def, est.vista); // a vista escolhida neste quadro (frente, lado…)
    let ep = Modelo.partesNoEstado(dv, est);
    if (typeof Atuacao !== 'undefined' && Atuacao.ligada(n)) { try { ep = Atuacao.aplica(P, n, q, dv, ep); } catch (e) { console.warn('[Atuação]', e); } } // atuação automática (js/atuacao.js)
    return Modelo.montar(dv, ep, m);
  },
  // desenha as camadas no ctx (que já está com a transformação do "mundo" aplicada em base)
  // o.fundo: desenha o fundo do canvas (quadriculado/liso) como a camada mais de baixo da raiz (assim as camadas de efeito valem nele)
  camadas(ctx, P, q, base, alfa = 1, o = {}) {
    let fr; try { fr = base.multiply(this.matCamera(P, q, P.w, P.h).inverse()); } catch { fr = base; } // quadro da câmera (px do vídeo) → tela
    this.lista(ctx, P, q, base, P.raiz, new DOMMatrix(), alfa, fr, 0, o.fundo ? c => { this.fundo(c, P, base, c.canvas.width, c.canvas.height); if (o.sombra) this.sombraFundo(c, P, q, base, o.sombra); } : null);
  },
  sombraFundo(ctx, P, q, V, d) { // sombrinha embaixo do Fundo padrão (só no palco)
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 18 * d;
    for (const n of P.raiz) if (n.fundoPadrao && this.vivo(P, n, q)) { const t = Modelo.transf(n, q); ctx.setTransform(this.matNo(V, t)); ctx.fillStyle = n.cor; ctx.fillRect(-n.w / 2, -n.h / 2, n.w, n.h); }
    ctx.restore();
  },
  vivo(P, n, q) { return n.vis !== false && Modelo.aparece(P, n, q); },
  // uma lista (raiz ou pasta), do fundo para a frente. Camadas de efeito dividem a lista em trechos:
  // cada trecho é desenhado à parte e recebe SÓ o efeito logo acima dele (o de cima não soma com o de baixo).
  lista(ctx, P, q, base, lista, m, alfa, fr, nivel, fundo) {
    const efs = n => n.tipo === 'efeito' && this.vivo(P, n, q) && (n.efeitos || []).some(e => Efeitos.ativoEf(e, q));
    if (!lista.some(efs)) { fundo?.(ctx); for (let i = lista.length - 1; i >= 0; i--) this.umNo(ctx, P, q, base, lista[i], m, alfa, fr, nivel); return; }
    const seg = this.buf(nivel, ctx.canvas), sc = seg.getContext('2d'); let sujo = false;
    const limpa = () => { sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, seg.width, seg.height); sujo = false; };
    limpa(); if (fundo) { fundo(sc); sujo = true; }
    for (let i = lista.length - 1; i >= 0; i--) {
      const n = lista[i];
      if (n.tipo === 'efeito') { if (efs(n) && sujo) { this.aplica(ctx, seg, n, P, q, fr, nivel); limpa(); } continue; }
      if (this.umNo(sc, P, q, base, n, m, alfa, fr, nivel)) sujo = true;
    }
    if (sujo) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(seg, 0, 0); ctx.restore(); }
  },
  _bufs: [],
  buf(nivel, cv) { let b = this._bufs[nivel]; if (!b || b.width !== cv.width || b.height !== cv.height) b = this._bufs[nivel] = new OffscreenCanvas(cv.width, cv.height); return b; },
  // desenha um nó (pasta: os filhos). Devolve true se desenhou algo
  umNo(ctx, P, q, base, n, m, alfa, fr, nivel) {
    if (!this.vivo(P, n, q) || n.tipo === 'efeito') return false;
    const t = Modelo.transfVis(n, q), a = alfa * (t.op ?? 1); let mm = this.matNo(m, t); if (n.tremulo) mm = mm.multiply(this.tremor(n, q));
    const fx = n.chaves && Modelo.filtroFx(Modelo.fxNo(n, q)), fxPai = this._fx || ''; // cor e luz (chave.fx): a da pasta vale para tudo dentro
    if (n.filhos) { this._fx = (fxPai + ' ' + (fx || '')).trim(); try { this.lista(ctx, P, q, base, n.filhos, mm, a, fr, nivel + 1); } finally { this._fx = fxPai; } return true; }
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a)); const filtro = ((fx || '') + ' ' + fxPai).trim(); if (filtro) ctx.filter = filtro;
    const df = n.chaves && Deformar.em(n, q); if (df && Deformar.desenha(ctx, P, q, base, n, mm, df)) { ctx.restore(); return true; } // deformada (js/deformar.js)
    if (n.tipo === 'personagem') {
      for (const it of this.pecasPersonagem(P, n, q, mm)) {
        if (!it.img) continue; const bm = Arq.comAp(this.bm(it.img.k), it, () => Render.aoChegarImagem?.()); if (!bm) continue;
        const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2;
        ctx.setTransform(base.multiply(it.m)); const x = -px + (it.img.ajuste?.x || 0), y = -py + (it.img.ajuste?.y || 0);
        if (n.tremulo?.modo === 'ondular') this.ondulado(ctx, n, q, this.nitido(bm, it.img.w, it.img.h, base.multiply(it.m)), x, y, it.img.w, it.img.h); else ctx.drawImage(bm, x, y, it.img.w, it.img.h);
      }
    } else if (n.tipo === 'imagem') {
      const bm = this.bm(n.arq); if (bm) { ctx.setTransform(base.multiply(mm)); if (n.tremulo?.modo === 'ondular') this.ondulado(ctx, n, q, this.nitido(bm, bm.width, bm.height, base.multiply(mm)), -bm.width / 2, -bm.height / 2, bm.width, bm.height); else ctx.drawImage(bm, -bm.width / 2, -bm.height / 2); }
    } else if (n.tipo === 'texto' || n.tipo === 'forma') {
      ctx.setTransform(base.multiply(mm));
      if (n.tremulo?.modo === 'ondular') { // ONDULAR também em texto e forma: desenha num canvas à parte (no tamanho da tela, nítido) e passa pela onda
        const b = this.caixaNo(ctx, n), M = base.multiply(mm), k = Math.min(4, Math.max(.25, Math.hypot(M.a, M.b))), c = this.tela('ond', Math.ceil(b.w * k) + 4, Math.ceil(b.h * k) + 4), cx = c.getContext('2d');
        cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, c.width, c.height); cx.setTransform(k, 0, 0, k, c.width / 2, c.height / 2); n.tipo === 'texto' ? this.texto(cx, n) : this.forma(cx, n);
        this.ondulado(ctx, n, q, c, -c.width / 2 / k, -c.height / 2 / k, c.width / k, c.height / k);
      } else n.tipo === 'texto' ? this.texto(ctx, n) : this.forma(ctx, n);
    }
    ctx.restore(); return true;
  },
  // passa o trecho (seg) para o ctx com os efeitos da camada n: por cima (tinta, vinheta…), filtro de cor, tremor/trêmulo
  aplica(ctx, seg, n, P, q, fr, nivel = 0) {
    const lista = n.efeitos.filter(e => Efeitos.ativoEf(e, q)), k = Math.hypot(fr.a, fr.b) || 1, de = n.de || 0, ate = Modelo.fimNo(P, n);
    const tela = e => ['cinema', 'flash'].includes(e.tipo); // cobrem o quadro (por cima de tudo o que já está desenhado)
    // 1) cor/desfoque no trecho  2) tinta, vinheta, granulado, VHS só onde o trecho tem desenho
    const pos = this.buf('p' + nivel, seg), pc = pos.getContext('2d'); pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(0, 0, pos.width, pos.height);
    const f = Efeitos.filtroDe(lista, k); pc.filter = f || 'none'; pc.drawImage(seg, 0, 0); pc.filter = 'none';
    pc.save(); pc.setTransform(fr); for (const e of lista) if (!tela(e)) Efeitos.umPorCima(pc, e, q, P.w, P.h, e.de ?? de, e.ate ?? ate, true); pc.restore();
    // 3) tremor / trêmulo: o trecho inteiro mexe
    let mt = new DOMMatrix(), ond = null; const c = fr.transformPoint(new DOMPoint(P.w / 2, P.h / 2));
    for (const e of lista) {
      if (e.tipo === 'tremor') { const am = e.forca * 26 * k; mt = mt.translate((hash(q * 1.7 + 3) - .5) * 2 * am, (hash(q * 2.3 + 9) - .5) * 2 * am); }
      if (e.tipo === 'tremulo') { const fo = e.forca ?? .4, kk = Math.floor(q / Math.max(1, e.ritmo || 2)), r = i => this.sorte(n.id, kk, i);
        if (e.modo === 'ondular') ond = { f: fo, kk }; else mt = mt.translate(c.x, c.y).translate(r(1) * fo * 16 * k, r(2) * fo * 16 * k).rotate(r(3) * fo * 2.4).scale(1 + r(4) * fo * .03).translate(-c.x, -c.y); }
    }
    ctx.save(); ctx.setTransform(mt); ctx.globalAlpha = 1;
    if (ond) { // faixas deslocadas por uma onda (como o "turbulento")
      const fase = this.sorte(n.id, ond.kk, 9) * 40, amp = (1.5 + ond.f * 7) * k, freq = (.045 + (this.sorte(n.id, ond.kk, 8) + .5) * .03) / k, fx = Math.max(2, Math.round(3 * k));
      for (let y = 0; y < pos.height; y += fx) { const sh = Math.min(fx * 2, pos.height - y), dx = Math.sin(y * freq + fase) * amp + Math.sin(y * freq * 2.3 - fase) * amp * .35; ctx.drawImage(pos, 0, y, pos.width, sh, dx, y, pos.width, sh); }
    } else { const tr = Efeitos.transicao(lista, q, de, ate, pos.width, pos.height, c.x, c.y); // transição chicote / zoom: cópias borradas
      if (tr) { for (const x of tr) { ctx.setTransform(mt.multiply(x.m)); ctx.globalAlpha = x.a; ctx.drawImage(pos, 0, 0); } ctx.globalAlpha = 1; ctx.setTransform(mt); } else ctx.drawImage(pos, 0, 0); }
    // 4) faixas de cinema e flash: por cima, no quadro da câmera
    ctx.setTransform(fr); for (const e of lista) if (tela(e)) Efeitos.umPorCima(ctx, e, q, P.w, P.h, e.de ?? de, e.ate ?? ate, false);
    ctx.restore();
  },
  forma(ctx, n) {
    const w = n.w || 100, h = n.h || 100; ctx.beginPath();
    if (n.forma === 'elipse') ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (n.forma === 'tri') { ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.closePath(); }
    else if (n.forma === 'estrela') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .42 : 1; ctx.lineTo(Math.cos(a) * w / 2 * r, Math.sin(a) * h / 2 * r); } ctx.closePath(); }
    else if (n.raio > 0) ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(n.raio, w / 2, h / 2)); else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = n.cor || '#fff'; ctx.fill(); if (n.bordaL > 0) { ctx.lineJoin = 'round'; ctx.lineWidth = n.bordaL; ctx.strokeStyle = n.borda || '#111'; ctx.stroke(); }
  },
  texto(ctx, n) {
    ctx.font = `${n.negrito ? '800 ' : ''}${n.tam || 72}px ${n.fonte || 'Segoe UI'}, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const linhas = String(n.texto || '').split('\n'), lh = (n.tam || 72) * 1.15;
    linhas.forEach((l, i) => { const y = (i - (linhas.length - 1) / 2) * lh;
      if (n.bordaL > 0) { ctx.lineJoin = 'round'; ctx.lineWidth = n.bordaL; ctx.strokeStyle = n.borda || '#fff'; ctx.strokeText(l, 0, y); }
      ctx.fillStyle = n.cor || '#111'; ctx.fillText(l, 0, y); });
  },
  // matriz da câmera: mundo → imagem final de W×H
  matCamera(P, q, W, H) {
    const c = Modelo.camera(P, q), k = W / P.w, tr = Efeitos.tremor(P, q), mv = this.camMexe(P, q, c);
    return new DOMMatrix().translate(W / 2 + (tr.dx + mv.dx) * k, H / 2 + (tr.dy + mv.dy) * k).scale(k * (c.zoom || 1) * mv.z).rotate(-(c.r || 0) - mv.r).translate(-c.x, -c.y);
  },
  // câmera "na mão" (P.camera.viva 0..1: respira devagar, como nos Shorts) + TREMOR da chave da câmera (0..1, vai mudando entre as chaves)
  camMexe(P, q, c) {
    const t = q / (P.fps || 24), v = +P.camera?.viva || 0, tm = +c.tremor || 0; let dx = 0, dy = 0, r = 0, z = 1;
    if (v) { dx += (Math.sin(t * 1.3) * 4 + Math.sin(t * 2.9 + 1.7) * 1.6) * v; dy += (Math.sin(t * 1.1 + .6) * 3 + Math.sin(t * 3.7 + 2.2) * 1.2) * v; r += Math.sin(t * .9 + .3) * .35 * v; z += Math.sin(t * .7) * .006 * v; }
    if (tm) { const ru = i => { const a = Math.floor(i), f = i - a, s = f * f * (3 - 2 * f); return (hash(a) * (1 - s) + hash(a + 1) * s) - .5; }, u = q * .55;
      dx += ru(u + 11) * 2 * 30 * tm; dy += ru(u + 47) * 2 * 30 * tm; r += ru(u + 91) * 2 * 1.6 * tm; }
    z += tm * .08 + v * .02; // um pouquinho mais perto: o tremor não mostra a borda do vídeo
    return { dx, dy, r, z };
  },
  // fundo onde não tem nada: guardado na animação (P.palco). Os quadradinhos têm tamanho fixo no mundo, então a Câmera mostra igual à Cena
  fundoDe(P) {
    if (!P.palco) { let o = {}; try { o = JSON.parse(localStorage.getItem('animador-palco') || '{}'); } catch { } // quem já tinha escolhido no navegador
      P.palco = { modo: o.modo === 'cor' ? 'cor' : 'quadriculado', cor: /^#[0-9a-f]{6}$/i.test(o.cor || '') ? o.cor : '#cfcfcf', forca: Number.isFinite(o.forca) ? o.forca : .35 }; }
    return P.palco;
  },
  fundo(ctx, P, V, W, H) {
    const o = this.fundoDe(P); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = o.cor; ctx.fillRect(0, 0, W, H);
    if (o.modo === 'cor' || !o.forca) return ctx.restore();
    const z = Math.hypot(V.a, V.b) || 1; let t = 40; while (t * z < 6) t *= 2;
    const inv = V.inverse(), cs = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => inv.transformPoint(new DOMPoint(x, y)));
    const x0 = Math.floor(Math.min(...cs.map(p => p.x)) / t) - 1, x1 = Math.ceil(Math.max(...cs.map(p => p.x)) / t) + 1, y0 = Math.floor(Math.min(...cs.map(p => p.y)) / t) - 1, y1 = Math.ceil(Math.max(...cs.map(p => p.y)) / t) + 1;
    const lum = parseInt(o.cor.slice(1, 3), 16) * .3 + parseInt(o.cor.slice(3, 5), 16) * .59 + parseInt(o.cor.slice(5, 7), 16) * .11;
    ctx.setTransform(V); ctx.fillStyle = lum > 140 ? `rgba(0,0,0,${o.forca * .22})` : `rgba(255,255,255,${o.forca * .16})`; ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0 + ((x0 + y) & 1); x <= x1; x += 2) ctx.rect(x * t, y * t, t + .02 / z, t + .02 / z);
    ctx.fill(); ctx.restore();
  },
  // QUADRO FINAL (exportar e prévia da câmera): fundo, camadas, cor, efeitos e legenda
  _tmp: null,
  quadro(ctx, P, q, W, H, o = {}) { // o.semLegenda: exportar sem as legendas
    if (!this._tmp || this._tmp.width !== W || this._tmp.height !== H) this._tmp = new OffscreenCanvas(W, H);
    const t = this._tmp.getContext('2d');
    t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, W, H);
    this.camadas(t, P, q, this.matCamera(P, q, W, H), 1, { fundo: true }); // o mesmo fundo da Cena (quadriculado ou cor lisa), visto pela câmera
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = Efeitos.filtro(P, q); ctx.drawImage(this._tmp, 0, 0); ctx.filter = 'none';
    Efeitos.porCima(ctx, P, q, W, H); if (!o.semLegenda) this.legenda(ctx, P, q, W, H); ctx.restore();
  },
  /* ---------- LEGENDAS no estilo dos Shorts: quebra em linhas curtas, tamanho fixo na legenda toda, *palavra* = destaque (cor),
     palavra que está sendo FALADA acesa (pelos tempos da transcrição, g.pal = [[palavra, q0, q1]], ou estimados pelas sílabas),
     pop ao entrar. Estilo do projeto: P.legEstilo = { pos: 'baixo'|'meio'|'alto', tam, cor, destaque, caixa, karaoke, pop } ---------- */
  legPalavras(l) {
    const out = []; let dest = false;
    for (const pedaco of String(l.texto || '').split(/\s+/).filter(Boolean)) { const ab = pedaco.startsWith('*'), fe = pedaco.endsWith('*') && pedaco.length > 1; if (ab) dest = true; out.push({ w: pedaco.replace(/\*/g, ''), dest }); if (fe || (ab && fe)) dest = false; }
    return out.filter(x => x.w);
  },
  // quando cada palavra é falada: os tempos da transcrição (se o texto ainda bate) ou uma estimativa pelas sílabas (pausa depois de pontuação)
  legTempos(l, ps) {
    const norm = x => String(x).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (l.pal?.length === ps.length && l.pal.every((w, i) => norm(w[0]) === norm(ps[i].w))) return l.pal.map(w => [w[1], w[2]]);
    const pesos = ps.map(p => Math.max(1, (p.w.match(/[aeiouáéíóúâêôãõày]+/gi) || []).length) + (/[.,!?;:]$/.test(p.w) ? 1.2 : 0)), tot = pesos.reduce((a, b) => a + b, 0), n = l.ate - l.de + 1;
    let acc = 0; return pesos.map(w => { const a = l.de + Math.floor(acc / tot * n); acc += w; return [a, Math.max(a, l.de + Math.floor(acc / tot * n) - 1)]; });
  },
  legenda(ctx, P, q, W, H) {
    const l = (P.legendas || []).find(x => q >= x.de && q <= x.ate); if (!l || !l.texto) return;
    const st = P.legEstilo || {}, ps = this.legPalavras(l); if (!ps.length) return;
    const tam = Math.round(Math.min(W, H) * .062 * (st.tam || 1)), maxW = W * .86, caixa = !!st.caixa, tx = w => caixa ? w.toUpperCase() : w;
    ctx.save(); ctx.font = `800 ${tam}px 'Segoe UI', sans-serif`; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.textAlign = 'left';
    const esp = ctx.measureText(' ').width, larg = ps.map(p => ctx.measureText(tx(p.w)).width), linhas = [[]]; let x = 0;
    ps.forEach((p, i) => { const L = linhas[linhas.length - 1]; if (L.length && x + esp + larg[i] > maxW) { linhas.push([]); x = 0; } linhas[linhas.length - 1].push(i); x += (x ? esp : 0) + larg[i]; });
    // última linha com uma palavra só: puxa uma da linha de cima (fica mais bonito, como nos Shorts)
    if (linhas.length > 1 && linhas[linhas.length - 1].length === 1 && linhas[linhas.length - 2].length > 2) linhas[linhas.length - 1].unshift(linhas[linhas.length - 2].pop());
    const tempos = st.karaoke ? this.legTempos(l, ps) : null, lh = tam * 1.18, base = { alto: H * .18, meio: H * .5, baixo: H - H * (H > W ? .2 : .09) }[st.pos || 'baixo'];
    const pop = st.pop !== false ? Math.min(1, (q - l.de + 1) / 3) : 1, k = pop < 1 ? .9 + .1 * Ease.back(pop) : 1, y0 = base - (linhas.length - 1) * lh;
    ctx.translate(W / 2, base - (linhas.length - 1) * lh / 2); ctx.scale(k, k); ctx.translate(-W / 2, -(base - (linhas.length - 1) * lh / 2));
    linhas.forEach((L, li) => { const tw = L.reduce((s2, i) => s2 + larg[i], 0) + esp * (L.length - 1); let xx = (W - tw) / 2; const yy = y0 + li * lh;
      for (const i of L) { const p = ps[i], falando = tempos && q >= tempos[i][0] && q <= tempos[i][1];
        ctx.lineWidth = tam * .2; ctx.strokeStyle = '#000'; ctx.strokeText(tx(p.w), xx, yy);
        ctx.fillStyle = falando ? (st.fala || '#5ee0ff') : p.dest ? (st.destaque || '#ffd84a') : (st.cor || '#fff'); ctx.fillText(tx(p.w), xx, yy); xx += larg[i] + esp; } });
    ctx.restore();
  },
  // caixa de cada nó visível (no "mundo") para escolher com o mouse; a primeira é a da frente
  caixas(P, q) {
    const out = [];
    this.cadaVisivel(P, q, (n, m) => {
      let b;
      if (n.tipo === 'personagem') { const def = P.personagens[n.ref]; if (!def) return; const est = Modelo.estadoPersonagem(n, q), dv = Modelo.naVista(def, est.vista); b = Modelo.caixaPersonagem(dv, Modelo.partesNoEstado(dv, est)); }
      else if (n.tipo === 'imagem') { const bm = this.bm(n.arq); const w = bm?.width || 200, h = bm?.height || 200; b = { x: -w / 2, y: -h / 2, w, h }; }
      else if (n.tipo === 'forma') b = { x: -(n.w || 100) / 2, y: -(n.h || 100) / 2, w: n.w || 100, h: n.h || 100 };
      else if (n.tipo === 'texto') { const c = this._med || (this._med = new OffscreenCanvas(4, 4).getContext('2d')); c.font = `${n.negrito ? '800 ' : ''}${n.tam || 72}px ${n.fonte || 'Segoe UI'}`; const ls = String(n.texto || '').split('\n'); const w = Math.max(...ls.map(l => c.measureText(l).width)) + 10, h = ls.length * (n.tam || 72) * 1.15; b = { x: -w / 2, y: -h / 2, w, h }; }
      if (!b) return;
      const cantos = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
      out.unshift({ no: n, m, cantos, local: b });
    });
    return out;
  },
  // miniatura (para a tela inicial)
  miniatura(P, q = 0, larg = 320) {
    const H = Math.round(larg * P.h / P.w), c = document.createElement('canvas'); c.width = larg; c.height = H;
    this.quadro(c.getContext('2d'), P, q, larg, H); return c.toDataURL('image/jpeg', .72);
  },
};
function dentroPoligono(p, pts) { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) d = !d; } return d; }
