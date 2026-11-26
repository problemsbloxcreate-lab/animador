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
        const t = Modelo.transfVis(n, q), a = alfa * (t.op ?? 1); let mm = this.matNo(m, t); if (n.tremulo) mm = mm.multiply(this.tremor(n, q)); if (n.gruda && typeof Controles !== 'undefined') { const gd = Controles.deltaGruda(P, n, q); if (gd) mm = gd.multiply(mm); } if (n.ancora3d && typeof Cena3D !== 'undefined') { const a3 = Cena3D.ajuste(P, n, q); if (a3) mm = a3.multiply(mm); } /* GRUDADA numa parte de um personagem (controles) */
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
  // estado de cada parte do personagem no quadro q, como aparece na tela (vista, poses, partes suaves e atuação)
  estadoPartes(P, n, q) {
    const def = P.personagens[n.ref]; if (!def) return null;
    const est = Modelo.estadoPersonagem(n, q), dv = Modelo.naVista(def, est.vista); // a vista escolhida neste quadro (frente, lado…)
    let ep = Modelo.partesNoEstado(dv, est);
    if (n.suaveP && typeof Rig !== 'undefined') { try { ep = Rig.tween(P, n, q, dv, ep); } catch (e) { console.warn('[Rig]', e); } } // partes mudam aos poucos até a próxima chave (js/rig.js)
    if (P.rive && typeof Rig !== 'undefined') { try { ep = Rig.trava(dv, ep, { vistas: true }); } catch (e) { console.warn('[Rig trava]', e); } } // TRAVA DAS JUNTAS em todo quadro de animação nova, em todas as vistas (as antigas ficam como eram)
    if (typeof Atuacao !== 'undefined' && Atuacao.ligada(n)) { try { ep = Atuacao.aplica(P, n, q, dv, ep); } catch (e) { console.warn('[Atuação]', e); } } // atuação automática (js/atuacao.js)
    if (typeof Vida !== 'undefined' && Vida.ligada(P, n)) { try { ep = Vida.aplica(P, n, q, dv, ep, est); } catch (e) { console.warn('[Vida]', e); } } // VIDA automática: respirar e piscar (js/vida.js, 23/11/2026)
    let ctl = null; if (def.controles && typeof Controles !== 'undefined') { const r = Controles.aplica(P, n, q, def, dv, est, ep); ep = r.ep; ctl = r.pecas; } // CONTROLES do personagem (js/controles.js): bolsa, cor do cabelo… só na animação
    return { def, dv, ep, est, ctl };
  },
  pecasPersonagem(P, n, q, m) {
    const ee = this.estadoPartes(P, n, q); if (!ee) return []; const { def, dv, ep, ctl } = ee;
    const cor = n.cor === 'original' ? null : n.cor || dv.corInterna; // cor interna: a deste personagem na animação, ou a do Ateliê
    const L = Modelo.montar(cor === dv.corInterna ? dv : { ...dv, corInterna: cor }, ep, m);
    if (ctl) for (const it of L) { const c = ctl[it.parte.id]; if (c) { if (c.op != null) it.op = c.op; if (c.troca) it.troca = c.troca; } } // opacidade e troca de cor por peça (controles)
    return L;
  },
  // desenha as camadas no ctx (que já está com a transformação do "mundo" aplicada em base)
  // o.fundo: desenha o fundo do canvas (quadriculado/liso) como a camada mais de baixo da raiz (assim as camadas de efeito valem nele)
  camadas(ctx, P, q, base, alfa = 1, o = {}) {
    const sv = this._semVideo; this._semVideo = !!o.semVideo; // casca de cebola: sem o cenário em vídeo (js/cenvideo.js)
    try { this._camadas(ctx, P, q, base, alfa, o); } finally { this._semVideo = sv; }
  },
  _camadas(ctx, P, q, base, alfa, o) {
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
  // RECORTE DA PASTA (n.recorte = {x, y, w, h} em px do vídeo, preso na tela: a câmera não move a janela, só o que está dentro).
  // Usado na tela dividida do Short (metade de cima / de baixo, Short.LAYOUTS) e em janelas/telas de celular.
  recorte(n) { const r = n.recorte; return r && r.w > 0 && r.h > 0 ? r : null; },
  // matriz do nó na tela (sem a base): posição/giro/escala, trêmulo e grudada numa parte (controles). t = Modelo.transfVis(n, q)
  matVis(P, n, q, m, t = Modelo.transfVis(n, q)) {
    let mm = this.matNo(m, t); if (n.tremulo) mm = mm.multiply(this.tremor(n, q)); if (n.gruda && typeof Controles !== 'undefined') { const gd = Controles.deltaGruda(P, n, q); if (gd) mm = gd.multiply(mm); } if (n.ancora3d && typeof Cena3D !== 'undefined') { const a3 = Cena3D.ajuste(P, n, q); if (a3) mm = a3.multiply(mm); } /* GRUDADA numa parte de um personagem (controles) */
    return mm;
  },
  // desenha um nó (pasta: os filhos). Devolve true se desenhou algo
  umNo(ctx, P, q, base, n, m, alfa, fr, nivel) {
    if (!this.vivo(P, n, q) || n.tipo === 'efeito') return false;
    if (n.luzBorda?.on && this._luzEm !== n && (n.tipo === 'personagem' || n.tipo === 'imagem') && typeof LuzBorda !== 'undefined') return LuzBorda.desenha(ctx, P, q, base, n, m, alfa, fr, nivel); // LUZ DE BORDA (js/acabamento.js): desenha à parte e acende a borda
    const t = Modelo.transfVis(n, q), a = alfa * (t.op ?? 1), mm = this.matVis(P, n, q, m, t);
    const fx = n.chaves && Modelo.filtroFx(Modelo.fxNo(n, q)), fxPai = this._fx || ''; // cor e luz (chave.fx): a da pasta vale para tudo dentro
    if (n.tipo === 'video') { // CENÁRIO EM VÍDEO (js/cenvideo.js): preso à câmera, cobre o quadro da câmera inteiro (fr), sem pan/zoom/giro
      if (this._semVideo || typeof CenarioVideo === 'undefined') return false;
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a)); const filtro = ((fx || '') + ' ' + fxPai).trim(); if (filtro) ctx.filter = filtro;
      try { return CenarioVideo.desenha(ctx, P, n, q, fr); } finally { ctx.restore(); } }
    if (n.filhos) { const rc = this.recorte(n); if (rc) { ctx.save(); ctx.setTransform(fr); ctx.beginPath(); ctx.rect(rc.x, rc.y, rc.w, rc.h); ctx.clip(); } // RECORTE DA PASTA: só aparece o que está dentro do retângulo (px do vídeo, fixo na tela)
      this._fx = (fxPai + ' ' + (fx || '')).trim(); try { this.lista(ctx, P, q, base, n.filhos, mm, a, fr, nivel + 1); } finally { this._fx = fxPai; if (rc) ctx.restore(); } return true; }
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a)); const filtro = ((fx || '') + ' ' + fxPai).trim(); if (filtro) ctx.filter = filtro;
    const df = n.chaves && Deformar.em(n, q); if (df && Deformar.desenha(ctx, P, q, base, n, mm, df)) { ctx.restore(); return true; } // deformada (js/deformar.js)
    if (n.tipo === 'personagem') {
      for (const it of this.pecasPersonagem(P, n, q, mm)) {
        if (!it.img) continue; const bm = Arq.comAp(this.bm(it.img.k), it, () => Render.aoChegarImagem?.()); if (!bm) continue; ctx.globalAlpha = Math.max(0, Math.min(1, a * (it.op ?? 1)));
        const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2;
        ctx.setTransform(base.multiply(it.m)); const x = -px + (it.img.ajuste?.x || 0), y = -py + (it.img.ajuste?.y || 0);
        if (n.tremulo?.modo === 'ondular') this.ondulado(ctx, n, q, this.nitido(bm, it.img.w, it.img.h, base.multiply(it.m)), x, y, it.img.w, it.img.h); else ctx.drawImage(bm, x, y, it.img.w, it.img.h);
      }
    } else if (n.tipo === 'cena3d') { // CENÁRIO 3D (js/cena3d.js): renderizado no tamanho da tela (nítido) e posto como imagem
      const M = base.multiply(mm), k = Math.hypot(M.a, M.b) || 1, w = n.w || P.w, hh = n.h || P.h, cv = typeof Cena3D !== 'undefined' ? Cena3D.quadro(P, n, q, w * k, hh * k) : null;
      if (cv) { ctx.setTransform(M); ctx.drawImage(cv, -w / 2, -hh / 2, w, hh); }
    } else if (n.tipo === 'imagem') {
      // IMAGEM ANIMADA (GIF/sequência): o quadro do tempo (GifCache, no fim deste arquivo)
      const bm = n.anim ? GifCache.bitmap(P, n, q, () => Render.aoChegarImagem?.()) : this.bm(n.arq); if (bm) { ctx.setTransform(base.multiply(mm)); if (n.tremulo?.modo === 'ondular') this.ondulado(ctx, n, q, this.nitido(bm, bm.width, bm.height, base.multiply(mm)), -bm.width / 2, -bm.height / 2, bm.width, bm.height); else ctx.drawImage(bm, -bm.width / 2, -bm.height / 2); }
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
    const eA2 = typeof GradeA2 !== 'undefined' && lista.find(e => e.tipo === 'cor' && Efeitos.grade(e.visual) === 'a2'); if (eA2) { let inv = null; try { inv = fr.inverse(); } catch { } GradeA2.aplica(pos, P.w, P.h, inv, q, { vinheta: eA2.vinheta !== false }); } // RUA 3D (A2): a cadeia do ffmpeg, px do canvas → px do vídeo
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
    if (Efeitos.grade(P.efeitos?.visual) === 'a2' && typeof GradeA2 !== 'undefined') GradeA2.aplica(this._tmp, P.w, P.h, null, q, { vinheta: P.efeitos?.vinheta !== false }); // visual antigo do projeto = Rua 3D (A2)
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
  /* legenda em BLOCOS (motor do Shorts, /estudio-edicao.js): 1 linha por vez, o bloco cuja 1ª palavra já foi falada; tamanho igual na
     legenda toda (cabe em 88% da largura); tudo na cor de quem fala, nome de personagem na cor dele; sem piscar nem pular (regra do dono).
     Palavra-chave na cor de destaque só com P.legEstilo.realce. */
  legBlocos(ctx, P, q, W, H, l) {
    const st = P.legEstilo || {}, B = l.blocos, t = (q - l.de) / P.fps; let bi = 0; for (let i = 0; i < B.length; i++) if (B[i][0] && t >= B[i][0][1] - .001) bi = i;
    const bl = B[bi]; if (!bl?.length) return; const caixa = !!st.caixa, tx = w => caixa ? String(w).toUpperCase() : String(w), fonte = n => `800 ${n}px 'Segoe UI', sans-serif`;
    let tam = Math.round(Math.min(W, H) * .062 * (st.tam || 1)); ctx.save(); ctx.font = fonte(tam); ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.textAlign = 'left';
    const maxW = W * .88, larg = b => ctx.measureText(tx(b.map(p => p[0]).join(' '))).width, wmax = Math.max(...B.map(larg)); if (wmax > maxW) { tam = Math.max(8, Math.floor(tam * maxW / wmax)); ctx.font = fonte(tam); }
    const esp = ctx.measureText(' ').width, ws = bl.map(p => ctx.measureText(tx(p[0])).width), tw = ws.reduce((a, b) => a + b, 0) + esp * (bl.length - 1);
    const y = { alto: H * .18, meio: H * .5, baixo: H - H * (H > W ? .2 : .09) }[st.pos || 'baixo'], cor = l.cor || st.cor || '#fff'; let x = (W - tw) / 2;
    bl.forEach((p, i) => { const m = String(p[3] || ''); /* sem contorno (dona, 26/11) */
      ctx.fillStyle = m.startsWith('q:') ? (l.qcor?.[m.slice(2)] || cor) : m === 'd' && st.realce ? (st.destaque || '#ffd84a') : cor; ctx.fillText(tx(p[0]), x, y); x += ws[i] + esp; });
    ctx.restore();
  },
  legenda(ctx, P, q, W, H) {
    const l = (P.legendas || []).find(x => q >= x.de && q <= x.ate); if (!l || !l.texto) return;
    if (P.legEstilo?.prep) return this.legPrep(ctx, P, W, H, l);
    if (l.blocos?.length) return this.legBlocos(ctx, P, q, W, H, l);
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
        /* sem contorno (dona, 26/11) */
        ctx.fillStyle = falando ? (l.cor || st.fala || '#5ee0ff') : p.dest ? (st.destaque || '#ffd84a') : (st.cor || '#fff'); ctx.fillText(tx(p.w), xx, yy); xx += larg[i] + esp; } });
    ctx.restore();
  },
  // LEGENDA NO ESTILO DO PREPARATIVOS (prep.legenda.estilo; README do repo preparativos): medidas em fração da ALTURA do vídeo,
  // x/y = CENTRO do bloco de texto e largura = caixa máxima (fração da largura); igual à prévia de lá (contorno por fora, sombra, fundo por linha)
  legPrep(ctx, P, W, H, l) {
    const e = P.legEstilo.prep, f = /^[A-Za-z0-9 ]{1,40}$/.test(e.fonte || '') ? e.fonte : 'Rubik'; if (typeof Prep !== 'undefined') Prep.fonte(f);
    const tam = Math.max(4, (+e.tamanho || .045) * H), maxW = (+e.largura || .86) * W, al = ['left', 'right'].includes(e.alinhar) ? e.alinhar : 'center';
    const txt = e.maiusculas ? String(l.texto).toLocaleUpperCase('pt-BR') : String(l.texto), rgba = (c, a) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || '#000000'), n = parseInt(m ? m[1] : '000000', 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a ?? 1})`; };
    ctx.save(); ctx.font = `${+e.peso || 800} ${tam}px '${f}', 'Segoe UI', sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = al; ctx.lineJoin = 'round';
    const linhas = []; let cur = ''; for (const w of txt.split(/\s+/).filter(Boolean)) { const t = cur ? cur + ' ' + w : w; if (cur && ctx.measureText(t).width > maxW) { linhas.push(cur); cur = w; } else cur = t; } if (cur) linhas.push(cur);
    const lh = tam * 1.2, cx = (e.x ?? .5) * W, cy = (e.y ?? .82) * H, x0 = al === 'left' ? cx - maxW / 2 : al === 'right' ? cx + maxW / 2 : cx, topo = cy - linhas.length * lh / 2;
    linhas.forEach((s, i) => { const y = topo + lh * (i + .5), lw = ctx.measureText(s).width;
      if (e.fundo?.ativo) { const px = .012 * H, py = .006 * H, bx = al === 'left' ? x0 : al === 'right' ? x0 - lw : x0 - lw / 2; ctx.fillStyle = rgba(e.fundo.cor, e.fundo.opacidade ?? .5); ctx.fillRect(bx - px, y - lh / 2 - py, lw + px * 2, lh + py * 2); }
      ctx.save(); if (e.sombra?.ativa) { const sh = e.sombra; ctx.shadowColor = rgba(sh.cor, sh.opacidade ?? .8); ctx.shadowBlur = (sh.desfoque ?? .006) * H; ctx.shadowOffsetX = (sh.x || 0) * H; ctx.shadowOffsetY = (sh.y ?? .003) * H; }
      if (e.contorno?.ativo) { ctx.lineWidth = (e.contorno.largura ?? .004) * H; ctx.strokeStyle = e.contorno.cor || '#000000'; ctx.strokeText(s, x0, y); ctx.shadowColor = 'transparent'; }
      ctx.fillStyle = l.cor || '#ffffff'; ctx.fillText(s, x0, y); ctx.restore(); });
    ctx.restore();
  },
  // caixa de cada nó visível (no "mundo") para escolher com o mouse; a primeira é a da frente
  caixas(P, q) {
    const out = [];
    this.cadaVisivel(P, q, (n, m) => {
      let b;
      if (n.tipo === 'personagem') { const def = P.personagens[n.ref]; if (!def) return; const est = Modelo.estadoPersonagem(n, q), dv = Modelo.naVista(def, est.vista); b = Modelo.caixaPersonagem(dv, Modelo.partesNoEstado(dv, est)); }
      else if (n.tipo === 'imagem') { const bm = this.bm(n.arq); const w = bm?.width || 200, h = bm?.height || 200; b = { x: -w / 2, y: -h / 2, w, h }; }
      else if (n.tipo === 'cena3d') { const w = n.w || P.w, h = n.h || P.h; b = { x: -w / 2, y: -h / 2, w, h }; }
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
/* ===================== IMAGEM ANIMADA (GIF e sequência de imagens) como UMA camada (pedido da dona, 26/11/2026) =====================
   Nó { tipo: 'imagem', arq, anim: { quadros: N, atrasos: [ms…], fps?, loop: true, quadrosArq?: [chaves…] } }.
   - GIF (ou WebP/PNG animado): n.arq = o arquivo ORIGINAL inteiro (guardado pelo Arq como qualquer imagem, vai junto no .animador e na
     nuvem). Ao desenhar, o arquivo é aberto UMA vez com o ImageDecoder do navegador (Chrome) e cada quadro vira um ImageBitmap guardado
     aqui (um cache por arquivo). Sem ImageDecoder (ou se não abrir): aparece o 1º quadro, como uma imagem comum (nunca quebra).
   - Sequência (por script): anim.quadrosArq = chaves de imagens já guardadas (Arq), uma por quadro, trocando no ritmo de anim.fps;
     n.arq = a 1ª (para o tamanho e para quem só conhece imagem comum).
   - Qual quadro: pelo tempo desde n.de, (q − de) / fps do projeto, seguindo os atrasos do próprio GIF (ou anim.fps, se tiver), em laço.
   - Exportar: `await GifCache.prepara(P)` antes do laço de quadros (todos os quadros prontos: nenhum sai em branco).
   Por script: `GifCache.sequencia([chaves], { fps: 12, nome })` ou `await GifCache.deArquivos([blobs], { fps, nome })` devolvem o nó
   (não põem na cena: o script coloca onde quiser, ex.: P.raiz.unshift(n)). */
const GifCache = {
  mapa: new Map(), // arquivo → { quadros: [ImageBitmap], atrasos: [ms], ok, pronto: Promise<boolean>, falhou }
  MAX_QUADROS: 1000,
  // atraso de 0 a 10 ms num GIF = o navegador mostra a 100 ms (é o que todo mundo vê na internet)
  atrasoReal(ms) { return ms > 10 ? ms : 100; },
  // QUAL QUADRO da imagem animada aparece no quadro q da timeline (puro, sem navegador: o teste roda no node)
  // a = n.anim, de = n.de, fpsP = fps do projeto, atrasos = os do arquivo aberto (senão os guardados em a.atrasos)
  indice(a, q, de, fpsP, atrasos) {
    if (!a) return 0; fpsP = fpsP || 24; const ats = atrasos?.length ? atrasos : a.atrasos, N = a.quadrosArq?.length || ats?.length || a.quadros || 1;
    if (N <= 1) return 0; const dq = Math.max(0, q - (de || 0)), laco = a.loop !== false;
    if (a.fps > 0 || !ats?.length) { const f = Math.floor(dq * (a.fps > 0 ? a.fps : fpsP) / fpsP + 1e-6); return laco ? f % N : Math.min(f, N - 1); } // ritmo fixo (sequência, ou GIF com fps escolhido)
    const t = dq * 1000 / fpsP + 1e-6, tot = ats.reduce((s, x) => s + this.atrasoReal(x), 0); // os atrasos do GIF, um por quadro
    let tt = laco ? t % tot : t; if (!laco && tt >= tot) return N - 1;
    let f = 0; for (; f < N - 1; f++) { tt -= this.atrasoReal(ats[f]); if (tt < 0) break; }
    return f;
  },
  // tipo pelo começo do arquivo (vindo de um .animador ou da nuvem, o arquivo chega sem tipo)
  async tipo(b) {
    if (b.type && b.type !== 'application/octet-stream') return b.type;
    try { const u = new Uint8Array(await b.slice(0, 16).arrayBuffer()), s = String.fromCharCode(...u);
      if (s.startsWith('GIF8')) return 'image/gif'; if (s.startsWith('RIFF') && s.slice(8, 12) === 'WEBP') return 'image/webp'; if (u[0] === 0x89 && s.slice(1, 4) === 'PNG') return 'image/png'; } catch { }
    return 'image/gif';
  },
  // abre o arquivo e devolve { quadros: [ImageBitmap], atrasos: [ms], w, h } (null sem ImageDecoder ou se não abrir)
  async decodifica(blob) {
    if (!blob || typeof ImageDecoder === 'undefined') return null; let dec = null;
    try {
      const type = await this.tipo(blob); if (ImageDecoder.isTypeSupported && !(await ImageDecoder.isTypeSupported(type))) return null;
      dec = new ImageDecoder({ data: await blob.arrayBuffer(), type }); await dec.tracks.ready; await dec.completed.catch(() => { });
      const N = Math.min(this.MAX_QUADROS, dec.tracks.selectedTrack?.frameCount || 1); if (N >= this.MAX_QUADROS) console.warn('[imagem animada] muitos quadros: fiquei com os primeiros', N);
      const quadros = [], atrasos = [];
      for (let i = 0; i < N; i++) { const { image } = await dec.decode({ frameIndex: i }); try { quadros.push(await createImageBitmap(image)); atrasos.push(Math.round((image.duration || 0) / 1000)); } finally { image.close(); } }
      return quadros.length ? { quadros, atrasos, w: quadros[0].width, h: quadros[0].height } : null;
    } catch (e) { console.warn('[imagem animada] não abriu', e); return null; } finally { try { dec?.close(); } catch { } }
  },
  // o cache do arquivo (começa a abrir na 1ª vez; avisa aoChegar quando ficar pronto)
  carrega(arq, aoChegar) {
    let e = this.mapa.get(arq); if (e) { if (aoChegar && !e.ok && !e.falhou) e.pronto.then(ok => ok && aoChegar()); return e; }
    e = { quadros: null, atrasos: null, ok: false }; this.mapa.set(arq, e);
    e.pronto = (async () => { const b = await Arq.pegaBlob(arq).catch(() => null); if (!b) { this.mapa.delete(arq); return false; } // ainda não chegou (nuvem/ao vivo): tenta de novo no próximo desenho
      const d = await this.decodifica(b); if (!d) { e.falhou = true; return false; } Object.assign(e, d, { ok: true }); return true; })();
    if (aoChegar) e.pronto.then(ok => ok && aoChegar()); return e;
  },
  // a imagem do quadro q (o Render desenha como uma imagem comum: x, y, escala, giro, opacidade e efeitos valem)
  bitmap(P, n, q, aoChegar) {
    const a = n.anim; if (!a) return Arq.bitmap(n.arq, aoChegar);
    if (a.quadrosArq?.length) return Arq.bitmap(a.quadrosArq[this.indice(a, q, n.de, P.fps)] || n.arq, aoChegar) || Arq.bitmap(n.arq, aoChegar); // sequência: cada quadro é uma imagem guardada (enquanto chega, a 1ª)
    const e = this.carrega(n.arq, aoChegar); if (!e.ok) return Arq.bitmap(n.arq, aoChegar); // abrindo (ou sem ImageDecoder): o 1º quadro
    return e.quadros[this.indice(a, q, n.de, P.fps, e.atrasos)] || e.quadros[0];
  },
  nos(P) { return Modelo.todos(P).filter(n => n.tipo === 'imagem' && n.anim); },
  // as imagens das sequências (para ir no .animador, subir para a nuvem e esperar antes de desenhar)
  arqs(P) { return this.nos(P).flatMap(n => n.anim.quadrosArq || []); },
  // EXPORTAR: todos os quadros de todas as imagens animadas prontos antes de começar
  async prepara(P) {
    const L = this.nos(P); if (!L.length) return;
    await Promise.all([Arq.garantir(this.arqs(P)), ...L.filter(n => !n.anim.quadrosArq?.length && n.arq).map(n => this.carrega(n.arq).pronto.catch(() => false))]);
  },
  // IMPORTAR: se o arquivo tem mais de um quadro, a camada vira animada (n.anim) e o cache já fica pronto. Devolve true se é animada
  async marca(n, blob, arq = n.arq) {
    delete n.anim; if (!blob || n.vetor) return false;
    const t = await this.tipo(blob); if (!/^image\/(gif|webp|png|apng)$/.test(t)) return false;
    const d = await this.decodifica(blob); if (!d || d.quadros.length < 2) { d?.quadros.forEach(b => b.close?.()); return false; }
    n.anim = { quadros: d.quadros.length, atrasos: d.atrasos, loop: true }; this.solta(arq); this.mapa.set(arq, { ...d, ok: true, pronto: Promise.resolve(true) }); return true;
  },
  // SEQUÊNCIA por script: um nó só a partir de imagens já guardadas (Arq.guardar), em vez de uma camada por quadro
  sequencia(chaves, o = {}) {
    const L = (chaves || []).filter(Boolean); if (!L.length) throw new Error('sequência sem imagens');
    const n = Modelo.novoNo('imagem', { arq: L[0], nome: String(o.nome || 'Sequência').slice(0, 40), ...(o.s != null ? { s: o.s } : {}) }); if (o.s != null && n.chaves?.[0]) n.chaves[0].s = o.s;
    n.anim = { fps: o.fps || 12, quadros: L.length, quadrosArq: L, loop: o.loop !== false }; return n;
  },
  async deArquivos(blobs, o = {}) { const ks = []; for (const b of blobs || []) ks.push(await Arq.guardar(b)); return this.sequencia(ks, o); },
  // tira da memória (ex.: trocou o arquivo da camada)
  solta(arq) { const e = this.mapa.get(arq); if (!e) return; this.mapa.delete(arq); e.quadros?.forEach(b => { try { b.close?.(); } catch { } }); },
};
function dentroPoligono(p, pts) { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) d = !d; } return d; }
