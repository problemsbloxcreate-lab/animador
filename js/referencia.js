/* ===================== referencia.js — põe cada peça no lugar onde ela está na REFERÊNCIA =====================
   A referência é a arte inteira do personagem: a parte chamada "Referência" (ou "Ref"/"Modelo") ou o Fantasma (aba Animações).
   Para cada parte, procura a imagem dela dentro da referência (comparando as cores, pixel a pixel, em tamanho pequeno e depois
   maior) e move a parte para lá. A escala vem da grossura do contorno preto (Folhas.espessura) e é conferida na busca.
   As peças NÃO mudam de tamanho: quem muda é a referência (fica do tamanho das peças). Lados (braço esquerdo/direito…)
   não podem cair no mesmo lugar. As filhas procuram perto de onde a mãe ficou. Tudo num Ctrl+Z só. */
'use strict';
const Referencia = {
  nrm: s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(),
  ehRef(p) { return /^(referencia|ref|modelo|base oficial|personagem inteiro)\b/.test(this.nrm(p.nome)); },
  // de onde vem a referência
  acha(def) {
    const est = Modelo.partesNoEstado(def, {}), p = def.partes.find(x => this.ehRef(x));
    if (p) { const img = p.imgs.find(i => i.id === est[p.id]?.img) || p.imgs[0]; if (img) return { tipo: 'parte', parte: p, img, k: img.k }; }
    const f = def.vis?.fantasma; if (f?.k) return { tipo: 'fantasma', f, k: f.k };
    return null;
  },
  tem(def) { return !!this.acha(def); },
  // pixels RGB sobre branco (e a máscara do que é opaco)
  pix(desenha, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; desenha(x);
    const D = x.getImageData(0, 0, W, H).data, rgb = new Uint8ClampedArray(W * H * 3), a = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < W * H; i++, j += 3) { const al = D[i * 4 + 3] / 255; a[i] = D[i * 4 + 3]; for (let q = 0; q < 3; q++) rgb[j + q] = D[i * 4 + q] * al + 255 * (1 - al); }
    return { W, H, rgb, a };
  },
  // a imagem da parte como aparece (giro/espelho/escala do mundo) na escala z; devolve amostras e o centro
  molde(it, bm, z, N) {
    const L = new DOMMatrix([it.m.a, it.m.b, it.m.c, it.m.d, 0, 0]).scale(z), im = it.img, px = im.pivo?.x ?? im.w / 2, py = im.pivo?.y ?? im.h / 2, x0 = -px + (im.ajuste?.x || 0), y0 = -py + (im.ajuste?.y || 0);
    const cs = [[x0, y0], [x0 + im.w, y0], [x0, y0 + im.h], [x0 + im.w, y0 + im.h]].map(([a, b]) => L.transformPoint(new DOMPoint(a, b)));
    const mx = Math.min(...cs.map(p => p.x)), my = Math.min(...cs.map(p => p.y)), W = Math.max(1, Math.ceil(Math.max(...cs.map(p => p.x)) - mx)), H = Math.max(1, Math.ceil(Math.max(...cs.map(p => p.y)) - my));
    if (W < 3 || H < 3 || W * H > 4e6) return null;
    const P = this.pix(x => { x.setTransform(new DOMMatrix().translate(-mx, -my).multiply(L)); x.drawImage(bm, x0, y0, im.w, im.h); }, W, H);
    const idx = []; for (let i = 0; i < W * H; i++) if (P.a[i] > 150) idx.push(i); if (idx.length < 6) return null;
    const passo = Math.max(1, idx.length / N), am = [];
    for (let f = 0; f < idx.length; f += passo) { const i = idx[Math.floor(f)]; am.push(i % W, Math.floor(i / W), P.rgb[i * 3], P.rgb[i * 3 + 1], P.rgb[i * 3 + 2]); }
    const c = L.transformPoint(new DOMPoint(x0 + im.w / 2, y0 + im.h / 2));
    return { W, H, am: Int16Array.from(am), cx: c.x - mx, cy: c.y - my, n: am.length / 5 };
  },
  // custo (média da diferença de cor) do molde com o canto em (ox, oy)
  custo(R, T, ox, oy) {
    const { W, H, rgb } = R, am = T.am; let s = 0;
    for (let k = 0; k < am.length; k += 5) { const x = ox + am[k], y = oy + am[k + 1];
      if (x < 0 || y < 0 || x >= W || y >= H) { s += Math.min(240, 765 - am[k + 2] - am[k + 3] - am[k + 4]); continue; }
      const j = (y * W + x) * 3, d = Math.abs(rgb[j] - am[k + 2]) + Math.abs(rgb[j + 1] - am[k + 3]) + Math.abs(rgb[j + 2] - am[k + 4]); s += d < 240 ? d : 240; } // teto: o que está escondido atrás de outra peça não pesa demais
    return s / T.n;
  },
  // os K melhores lugares (separados) dentro da área
  melhores(R, T, area, K = 4) {
    // area = onde o CENTRO da peça pode cair (perto da mãe); a peça pode sair da área
    const x0 = Math.floor(Math.max(-T.W * .3, (area?.x0 ?? -1e9) - T.cx)), x1 = Math.ceil(Math.min(R.W - T.W * .7, (area?.x1 ?? 1e9) - T.cx)), y0 = Math.floor(Math.max(-T.H * .3, (area?.y0 ?? -1e9) - T.cy)), y1 = Math.ceil(Math.min(R.H - T.H * .7, (area?.y1 ?? 1e9) - T.cy));
    const L = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) L.push([this.custo(R, T, x, y), x, y]);
    if (!L.length) return [];
    L.sort((a, b) => a[0] - b[0]); const out = [], perto = Math.max(2, Math.min(T.W, T.H) * .5);
    for (const c of L) { if (out.every(o => Math.hypot(o[1] - c[1], o[2] - c[2]) > perto)) out.push(c); if (out.length >= K) break; }
    return out;
  },
  // "Braço esquerdo" e "Braço direito" = mesmo grupo (não podem ficar no mesmo lugar). De trás/da frente PODEM se sobrepor, então não contam
  grupoLado(nome) { const n = this.nrm(nome), t = n.replace(/\b(esquerd[oa]s?|direit[oa]s?|left|right|[12])\b/g, '').replace(/\s+/g, ' ').trim(); return t !== n ? t : null; },
  espessura(bm, W, H) { try { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bm, 0, 0, W, H); return Folhas.espessura(x.getImageData(0, 0, W, H).data, W, H) || 0; } catch { return 0; } },
  // dá a vez para a tela sem usar setTimeout: com a aba escondida o navegador estica cada setTimeout para 1 s (e até 1 min depois de 5 min)
  pausa: () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); }),

  // calcula onde cada parte fica (sem mudar nada). Devolve { sigma, achados: [{ parte, u, v, custo }], ruins: [nomes] }
  async calcula(def, ref, aoPasso = () => { }) {
    const bmR = Arq.img.get(ref.k); if (!bmR) throw new Error('a imagem da referência ainda não carregou');
    const est = Modelo.partesNoEstado(def, {}), its = Modelo.montar(def, est).filter(it => it.img && it.parte !== ref.parte && !this.ehRef(it.parte) && Arq.img.get(it.img.k));
    if (!its.length) throw new Error('não tem peças para encaixar');
    const porId = Object.fromEntries(its.map(it => [it.parte.id, it]));
    // escala inicial pela grossura do contorno (px da referência por unidade do desenho)
    const eR = this.espessura(bmR, bmR.width, bmR.height), eP = [];
    for (const it of its) { const bm = Arq.img.get(it.img.k), k = Math.sqrt(Math.abs(it.m.a * it.m.d - it.m.b * it.m.c)) * it.img.w / bm.width, e = bm.width * bm.height < 5e6 ? this.espessura(bm, bm.width, bm.height) : 0; if (e) eP.push(e * k); }
    eP.sort((a, b) => a - b); const sig0 = eR && eP.length ? eR / eP[Math.floor(eP.length / 2)] : null;
    const caixaR = Math.max(bmR.width, bmR.height), c1 = Math.min(1, 150 / caixaR), R1 = this.pix(x => x.drawImage(bmR, 0, 0, Math.round(bmR.width * c1), Math.round(bmR.height * c1)), Math.round(bmR.width * c1), Math.round(bmR.height * c1));
    // sem medida do contorno: escala que faz as peças ocuparem a referência (soma das áreas ~ área opaca)
    let sigC = sig0; if (!sigC) { let opR = 0; for (let i = 0; i < R1.a.length; i++) if (R1.a[i] > 150 || R1.rgb[i * 3] + R1.rgb[i * 3 + 1] + R1.rgb[i * 3 + 2] < 720) opR++; const area = its.reduce((s, it) => s + it.img.w * it.img.h * .55 * Math.abs(it.m.a * it.m.d - it.m.b * it.m.c), 0); sigC = Math.sqrt(opR / (c1 * c1) / Math.max(1, area)); }
    const grade = sig0 ? [.8, .88, .94, 1, 1.06, 1.13, 1.22] : [.55, .65, .75, .85, .93, 1, 1.08, 1.17, 1.3, 1.5, 1.75];
    // 1) escala: a que deixa as peças maiores mais parecidas com a referência
    const grandes = [...its].sort((a, b) => b.img.w * b.img.h - a.img.w * a.img.h).slice(0, 4); let sigma = sigC, melhor = Infinity;
    for (const g of grade) { const s = sigC * g; let tot = 0, n = 0;
      for (const it of grandes) { const T = this.molde(it, Arq.img.get(it.img.k), s * c1, 220); if (!T) continue; const m = this.melhores(R1, T, null, 1)[0]; if (m) { tot += m[0] * Math.sqrt(T.n); n += Math.sqrt(T.n); } }
      const custo = n ? tot / n + 18 * Math.abs(Math.log(g)) : Infinity; if (custo < melhor) { melhor = custo; sigma = s; } aoPasso(`Medindo o tamanho… ${Math.round(sigma * 100) / 100}`); await this.pausa(); }
    // 2) cada parte, das de cima para as filhas (as filhas procuram perto da mãe)
    const ordem = [], vis = new Set(), poe = p => { if (vis.has(p.id)) return; vis.add(p.id); if (p.pai && porId[p.pai]) poe(porId[p.pai].parte); ordem.push(p); };
    for (const it of its) poe(it.parte);
    const c2 = Math.min(1, 600 / caixaR), R2 = this.pix(x => x.drawImage(bmR, 0, 0, Math.round(bmR.width * c2), Math.round(bmR.height * c2)), Math.round(bmR.width * c2), Math.round(bmR.height * c2));
    const achou = {}, cand = {}, ruins = [], duvidas = [];
    const k12 = c2 / c1;
    for (const [i, p] of ordem.entries()) { const it = porId[p.id], bm = Arq.img.get(it.img.k); aoPasso(`Procurando "${p.nome}" na referência… (${i + 1}/${ordem.length})`); await this.pausa();
      // peça pequena (boca, sobrancelha…): procura direto na referência maior
      let T = this.molde(it, bm, sigma * c1, 320), fino = false; if (!T || Math.min(T.W, T.H) < 8) { T = this.molde(it, bm, sigma * c2, 500); fino = true; } if (!T) continue;
      const kk = fino ? k12 : 1, mae = p.pai && achou[p.pai]; let area = null; if (mae) { const mw = mae.w, mh = mae.h; const fx = mw * .35 + T.W / kk * .6, fy = mh * .35 + T.H / kk * .6; area = { x0: (mae.x - fx) * kk, y0: (mae.y - fy) * kk, x1: (mae.x + mw + fx) * kk, y1: (mae.y + mh + fy) * kk }; }
      const RR = fino ? R2 : R1; let L = this.melhores(RR, T, area, 5); if (!L.length && area) L = this.melhores(RR, T, null, 5); if (!L.length) continue;
      cand[p.id] = L.map(c => ({ c: c[0], x: c[1] / kk, y: c[2] / kk, T: { ...T, W: T.W / kk, H: T.H / kk, cx: T.cx / kk, cy: T.cy / kk } }));
      if (L[1] && L[1][0] - L[0][0] < L[0][0] * .06 + 2 && Math.hypot(L[1][1] - L[0][1], L[1][2] - L[0][2]) > Math.max(T.W, T.H)) duvidas.push(p.nome); // dois lugares parecidos demais
      achou[p.id] = { x: L[0][1] / kk, y: L[0][2] / kk, w: T.W / kk, h: T.H / kk }; }
    // lados: o mesmo grupo não fica no mesmo lugar (quem combina melhor escolhe primeiro)
    const grupos = {}; for (const p of ordem) { const g = this.grupoLado(p.nome); if (g && cand[p.id]) (grupos[(p.pai || '') + '|' + g] ||= []).push(p); }
    for (const L of Object.values(grupos)) { if (L.length < 2) continue; L.sort((a, b) => cand[a.id][0].c - cand[b.id][0].c); const usados = [];
      for (const p of L) { const T = cand[p.id][0].T, livre = cand[p.id].find(c => usados.every(u => Math.hypot(u.x + u.cx - (c.x + T.cx), u.y + u.cy - (c.y + T.cy)) > Math.min(T.W, T.H) * .35)) || cand[p.id][0];
        cand[p.id] = [livre, ...cand[p.id].filter(c => c !== livre)]; usados.push({ x: livre.x, y: livre.y, cx: T.cx, cy: T.cy }); } }
    // 3) acerto fino numa referência maior, em volta do lugar achado (busca pelo CENTRO, que não muda com a escala)
    const k = c2 / c1, r = Math.ceil(k * 1.5) + 1, centro0 = {};
    for (const p of ordem) { const C = cand[p.id]?.[0]; if (C) centro0[p.id] = [(C.x + C.T.cx) * k, (C.y + C.T.cy) * k]; }
    const local = (p, s, N, raio) => { const it = porId[p.id], T = this.molde(it, Arq.img.get(it.img.k), s * c2, N); if (!T || !centro0[p.id]) return null; const [cx, cy] = centro0[p.id], bx = Math.round(cx - T.cx), by = Math.round(cy - T.cy); let best = [Infinity, bx, by];
      for (let y = by - raio; y <= by + raio; y++) for (let x = bx - raio; x <= bx + raio; x++) { const v = this.custo(R2, T, x, y); if (v < best[0]) best = [v, x, y]; } return { c: best[0], u: (best[1] + T.cx) / c2, v: (best[2] + T.cy) / c2 }; };
    // a escala exata: um erro de 3% já tira as pernas do lugar. Testa ±6% com as peças maiores
    const grandes2 = ordem.filter(p => centro0[p.id]).sort((a, b) => porId[b.id].img.w * porId[b.id].img.h - porId[a.id].img.w * porId[a.id].img.h).slice(0, 4);
    let sF = sigma, mF = Infinity; aoPasso('Acertando o tamanho…'); await this.pausa();
    for (let g = .94; g <= 1.0601; g += .01) { let t = 0, n = 0; for (const p of grandes2) { const L = local(p, sigma * g, 500, r + 2); if (L) { t += L.c; n++; } } if (n && t / n < mF) { mF = t / n; sF = sigma * g; } }
    sigma = sF; const achados = [];
    for (const p of ordem) { const L = local(p, sigma, 900, r + 2); if (!L) continue;
      if (L.c > 170) { ruins.push(p.nome); continue; } // nada parecido (a peça não está na referência)
      achados.push({ parte: p, u: L.u, v: L.v, custo: L.c }); }
    return { sigma, achados, ruins, duvidas: duvidas.filter(n => !ruins.includes(n)) };
  },

  // no Ateliê: calcula e aplica (a referência fica do tamanho das peças; as peças vão para o lugar)
  async aplicar(A = Atelie, o = {}) {
    const def = A.def, ref = this.acha(def);
    if (!ref) { if (!o.quieto) UI.toast('Ponha a <b>referência</b> primeiro: uma parte chamada <b>Referência</b> com o personagem inteiro (ou o <b>Fantasma</b>, na aba Animações). Depois clique em <b>Pela referência</b>.', { kind: 'warn', time: 9000 }); return null; }
    const fim = o.semTela ? () => { } : Ocupado.inicio({ tipo: 'referencia', titulo: 'Pondo as peças no lugar da referência', est: 8, subtitulo: 'Olhando a referência…' });
    try {
      await Arq.garantir(Modelo.chavesImgs(def));
      // a referência fica solta (se estivesse presa numa parte, iria junto quando a parte mudasse de lugar)
      if (ref.tipo === 'parte' && ref.parte.pai) A.porNoPai(ref.parte.id, null, { semCommit: true });
      const r = await this.calcula(def, ref, t => Ocupado.passo?.(t)), bm = Arq.img.get(ref.k);
      // a referência com o tamanho certo (σ px dela por unidade do desenho), no mesmo centro
      let paraMundo;
      if (ref.tipo === 'parte') { const it = Modelo.montar(def, Modelo.partesNoEstado(def, {})).find(x => x.parte === ref.parte), im = ref.img, kr = Math.sqrt(Math.abs(it.m.a * it.m.d - it.m.b * it.m.c)) || 1;
        const cx = im.w / 2 - (im.pivo?.x ?? im.w / 2) + (im.ajuste?.x || 0), cy = im.h / 2 - (im.pivo?.y ?? im.h / 2) + (im.ajuste?.y || 0);
        im.w = round(bm.width / (r.sigma * kr), 1); im.h = round(bm.height / (r.sigma * kr), 1); im.pivo = { x: im.w / 2, y: im.h / 2 }; im.ajuste = { x: round(cx, 1), y: round(cy, 1) };
        paraMundo = (u, v) => it.m.transformPoint(new DOMPoint(cx + (u / bm.width - .5) * im.w, cy + (v / bm.height - .5) * im.h)); }
      else { const f = ref.f, s0 = f.s ?? 1, mx = f.x + f.w * s0 / 2, my = f.y + f.h * s0 / 2, s = 1 / r.sigma; f.s = round(s, 4); f.x = round(mx - f.w * s / 2, 1); f.y = round(my - f.h * s / 2, 1); f.on = true;
        paraMundo = (u, v) => new DOMPoint(f.x + u * s, f.y + v * s); }
      // move cada parte (mães antes das filhas), em coordenadas da mãe
      for (const a of r.achados) { const est = Modelo.partesNoEstado(def, {}), L = Modelo.montar(def, est), it = L.find(x => x.parte === a.parte); if (!it?.img) continue;
        const im = it.img, c = it.m.transformPoint(new DOMPoint(im.w / 2 - (im.pivo?.x ?? im.w / 2) + (im.ajuste?.x || 0), im.h / 2 - (im.pivo?.y ?? im.h / 2) + (im.ajuste?.y || 0))), alvo = paraMundo(a.u, a.v);
        const mae = a.parte.pai ? L.find(x => x.parte.id === a.parte.pai)?.mp : null, inv = mae ? new DOMMatrix([mae.a, mae.b, mae.c, mae.d, 0, 0]).inverse() : new DOMMatrix(), d = inv.transformPoint(new DOMPoint(alvo.x - c.x, alvo.y - c.y));
        const e = a.parte.encaixe || { x: 0, y: 0 }; a.parte.encaixe = { x: round(e.x + d.x, 1), y: round(e.y + d.y, 1) }; }
      fim(); if (!o.semCommit) { A.commit(); A.enquadrar?.(); }
      if (!o.quieto) UI.toast(`<b>${r.achados.length}</b> peça(s) no lugar da referência.${r.ruins.length ? ` Não achei na referência: ${r.ruins.map(esc).join(', ')} (ficaram onde estavam).` : ''}${r.duvidas.length ? ` Confira: ${r.duvidas.map(esc).join(', ')} (combinam com mais de um lugar).` : ''} Ctrl+Z desfaz.`, { kind: 'ok', time: 8000 });
      return r;
    } catch (e) { fim(); if (!o.quieto) UI.toast('Não deu para encaixar pela referência: ' + esc(e.message), { kind: 'err', time: 7000 }); if (o.quieto) throw e; return null; }
  },
};
