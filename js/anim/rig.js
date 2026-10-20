/* ===================== anim/rig.js — boneco de recorte com ossos (estilo Toon Boom Harmony) =====================
   Um personagem (rig) é uma árvore de PARTES. Cada parte tem um PIVÔ (a junta) e um ou mais DESENHOS (troca de
   desenho: bocas, olhos, mãos). Os ossos ligam o pivô de uma parte ao pivô das filhas.
   Mexer = GIRAR em volta do pivô (os ossos não esticam). Só a raiz anda. Escala só quando você pede (squash/stretch).
   Canais animáveis por parte: r (giro °), x/y (deslocamento, normalmente só na raiz), sx/sy (escala), d (desenho).
   Canais do personagem no palco: X, Y, S (tamanho), F (espelhar: 1/-1), O (opacidade). */
'use strict';

const AnimMath = {
  rad: d => d * Math.PI / 180, deg: r => r * 180 / Math.PI,
  norm(a) { while (a > 180) a -= 360; while (a < -180) a += 360; return a; },
  // interpola canal com keyframes [{f, v, e}] — "e" é a forma de chegar no PRÓXIMO key
  value(keys, f, def) {
    if (!keys || !keys.length) return def;
    if (f <= keys[0].f) return keys[0].v;
    const L = keys[keys.length - 1]; if (f >= L.f) return L.v;
    let i = 0; while (i < keys.length - 2 && keys[i + 1].f <= f) i++;
    const a = keys[i], b = keys[i + 1]; if (typeof a.v !== 'number') return a.v;
    const u = (f - a.f) / Math.max(1e-6, b.f - a.f), e = a.e || 'ease';
    if (e === 'hold') return a.v;
    const fn = AnimEase[e] || AnimEase.ease;
    return a.v + (b.v - a.v) * fn(u, a);
  },
  setKey(keys, f, v, e) { const k = keys.find(k => k.f === f); if (k) { k.v = v; if (e) k.e = e; } else { keys.push({ f, v, e: e || 'ease' }); keys.sort((a, b) => a.f - b.f); } },
};
// curvas de movimento (estilo animação 2D: "slow in / slow out" é o padrão)
const AnimEase = {
  linear: u => u,
  ease: u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2,         // devagar → rápido → devagar
  out: u => 1 - Math.pow(1 - u, 3),                                         // sai rápido, chega devagar (o mais usado em pose-a-pose de TV)
  in: u => u * u * u,                                                        // sai devagar, chega rápido (queda, golpe)
  snap: u => 1 - Math.pow(1 - u, 5),                                         // bem seco no começo
  back: u => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }, // passa um pouco do ponto e volta
};
const EASE_LABEL = { ease: 'Suave (entra e sai devagar)', out: 'Chega devagar', in: 'Sai devagar', snap: 'Seco', back: 'Passa do ponto', linear: 'Linear', hold: 'Segurar (pular sem meio-termo)' };

/* ---------- papéis das partes (pelo nome) — define pai provável, limites de giro e o que segue com atraso ---------- */
const ROLES = [
  // [papel, regex do nome, pai provável (papéis), limite de giro, segue com atraso?]
  ['quadril', /quadril|cintura|pelvis|hip|bacia|saia|skirt/i, [], null],
  ['tronco', /tronco|torso|corpo|peito|chest|body|camisa|blusa/i, ['quadril'], [-25, 25]],
  ['pescoco', /pesco[cç]o|neck/i, ['tronco'], [-25, 25]],
  ['cabeca', /cabe[cç]a|head|rosto|face/i, ['pescoco', 'tronco'], [-35, 35]],
  ['cabelo', /cabelo|hair|franja|mecha|rabo|trança|tranca|fringe|bang/i, ['cabeca'], [-30, 30], true],
  ['orelha', /orelha|ear\b/i, ['cabeca'], [-25, 25], true],
  ['pupila', /pupila|pupil|[ií]ris|menina do olho/i, ['olho'], null],
  ['olho', /olho|eye/i, ['cabeca'], [-10, 10]],
  ['sobrancelha', /sobrancelha|brow/i, ['cabeca'], [-20, 20]],
  ['boca', /boca|mouth|lábio|labio/i, ['cabeca'], [-15, 15]],
  ['nariz', /nariz|nose/i, ['cabeca'], [-8, 8]],
  ['braco', /bra[cç]o|upper ?arm|ombro|shoulder|\barm\b|manga/i, ['tronco'], [-180, 180]],
  ['antebraco', /antebra[cç]o|fore ?arm|cotovelo|lower ?arm/i, ['braco'], [-165, 165]],
  ['mao', /m[aã]o|hand|dedo|finger|luva/i, ['antebraco', 'braco'], [-80, 80]],
  ['coxa', /coxa|thigh|upper ?leg/i, ['quadril'], [-110, 110]],
  ['perna', /perna|canela|shin|\bleg\b|lower ?leg|joelho/i, ['coxa', 'quadril'], [-150, 150]],
  ['pe', /\bp[eé]\b|p[eé]s\b|foot|feet|sapato|t[eê]nis|bota|shoe/i, ['perna', 'coxa'], [-50, 50]],
  ['acessorio', /colar|brinco|bolsa|chap[eé]u|hat|la[cç]o|cauda|tail|asa|wing/i, ['cabeca', 'tronco'], [-60, 60], true],
];
const Roles = {
  of(name) { const r = ROLES.find(r => r[1].test(name || '')); return r ? r[0] : 'parte'; },
  def(role) { return ROLES.find(r => r[0] === role); },
  side(name) { return /esq|left|\bl\b|_l\b|\(e\)/i.test(name) ? 'esq' : /dir|right|\br\b|_r\b|\(d\)/i.test(name) ? 'dir' : ''; },
  // em cadeia de IK: a ponta (mão, pé) puxa o antebraço e o braço / a perna e a coxa
  ikChain(rig, node) { const ch = [node]; let p = Rig.node(rig, node.parent); const roles = { mao: 2, pe: 2, antebraco: 1, perna: 1 }; let n = roles[node.role] ?? 0; while (p && n-- > 0) { ch.push(p); p = Rig.node(rig, p.parent); } return ch.length > 1 ? ch : null; },
};

const Rig = {
  node(rig, id) { return id ? rig.nodes.find(n => n.id === id) : null; },
  children(rig, id) { return rig.nodes.filter(n => n.parent === id); },
  roots(rig) { return rig.nodes.filter(n => !n.parent); },
  depth(rig, n) { let d = 0, p = n; while (p?.parent && d < 30) { p = this.node(rig, p.parent); d++; } return d; },
  ordered(rig) { const out = [], walk = (id, lv) => this.children(rig, id).sort((a, b) => b.z - a.z).forEach(n => { out.push([n, lv]); walk(n.id, lv + 1); }); walk(null, 0); return out; },
  newNode(o) { return { id: o.id || uid('n_'), name: o.name || 'Parte', role: o.role || Roles.of(o.name), parent: o.parent || null, px: o.px || 0, py: o.py || 0, z: o.z ?? 0, drawings: o.drawings || [], d: o.d || 0, limit: o.limit ?? null, follow: o.follow ?? null, hidden: false, ik: o.ik ?? null, side: o.side ?? Roles.side(o.name), talk: o.talk ?? null }; },
  newRig(o = {}) { return { id: uid('r_'), name: o.name || 'Personagem', ref: o.ref || null, nodes: [], keys: {}, poses: {}, stage: { X: 0, Y: 0, S: 1, F: 1, O: 100 }, breath: .35, w: o.w || 1000, h: o.h || 1000 }; },

  /* ---------- valor dos canais num quadro ---------- */
  REST: false, // modo montagem: mostra o boneco parado (sem keyframes)
  ch(rig, nid, c, f, def) { if (this.REST) return def; return AnimMath.value(rig.keys[nid]?.[c], f, def); },
  stageAt(rig, f) { const s = rig.stage; return { X: this.ch(rig, '@', 'X', f, s.X), Y: this.ch(rig, '@', 'Y', f, s.Y), S: this.ch(rig, '@', 'S', f, s.S), F: this.ch(rig, '@', 'F', f, s.F), O: this.ch(rig, '@', 'O', f, s.O ?? 100) }; },
  // giro acumulado (para o atraso dos cabelos/acessórios)
  worldAngle(rig, n, f) { let a = 0, p = n, k = 0; while (p && k++ < 30) { a += this.ch(rig, p.id, 'r', f, 0); p = this.node(rig, p.parent); } return a; },
  localRot(rig, n, f) {
    let r = this.ch(rig, n.id, 'r', f, 0);
    if (n.follow && n.parent) {
      // overlap / follow-through: a parte "atrasa" em relação ao pai (cabelo, brinco, orelha) — movimento orgânico
      const par = this.node(rig, n.parent), lag = Math.max(1, Math.round(n.follow.lag || 3)), amt = n.follow.amt ?? .6;
      const now = this.worldAngle(rig, par, f); let past = 0; for (let k = 1; k <= lag; k++) past += this.worldAngle(rig, par, f - k);
      r += clamp((past / lag - now) * amt, -25, 25);
    }
    if (n.limit) r = clamp(r, n.limit[0], n.limit[1]);
    return r;
  },
  // matriz de cada parte no espaço do personagem (antes do palco)
  pose(rig, f) {
    const M = {}, list = [];
    const walk = (parent, pm) => {
      for (const n of this.children(rig, parent)) {
        const p = this.node(rig, parent), m = new DOMMatrix(pm);
        m.translateSelf(n.px - (p ? p.px : 0), n.py - (p ? p.py : 0));
        m.translateSelf(this.ch(rig, n.id, 'x', f, 0), this.ch(rig, n.id, 'y', f, 0));
        m.rotateSelf(this.localRot(rig, n, f));
        const sx = this.ch(rig, n.id, 'sx', f, 1), sy = this.ch(rig, n.id, 'sy', f, 1); if (sx !== 1 || sy !== 1) m.scaleSelf(sx, sy);
        if (!parent && rig.breath && !this.REST) { const b = Math.sin(f / 30 * Math.PI * 2 * .32) * .006 * rig.breath; m.scaleSelf(1 - b * .4, 1 + b); }
        M[n.id] = m; list.push(n); walk(n.id, m);
      }
    };
    walk(null, new DOMMatrix());
    return M;
  },
  stageMatrix(rig, f, W, H) {
    const s = this.stageAt(rig, f), m = new DOMMatrix();
    m.translateSelf(W / 2 + s.X, H / 2 + s.Y); m.scaleSelf(s.S * (s.F < 0 ? -1 : 1), s.S);
    m.translateSelf(-(rig.ox ?? rig.w / 2), -(rig.oy ?? rig.h)); // origem do personagem = pés no meio (ox, oy)
    return m;
  },
  drawingAt(rig, n, f) {
    const d = Math.round(this.ch(rig, n.id, 'd', f, n.d || 0)); let dr = n.drawings[clamp(d, 0, n.drawings.length - 1)] || null;
    // PNGtuber / desenho inteiro que fala: canal "m" (1 = boca aberta) troca para a versão "falando" do mesmo desenho
    if (dr && n.talk && this.ch(rig, n.id, 'm', f, 0) >= .5) { const alt = n.talk[d]; if (alt != null && n.drawings[alt]) dr = n.drawings[alt]; }
    return dr;
  },
  // canal "v" (visível 1/0, sem meio-termo) — esconde a parte e as filhas (ex.: troca o boneco montado por um desenho de pose inteira)
  visible(rig, n, f) { let p = n, k = 0; while (p && k++ < 30) { if (p.hidden || this.ch(rig, p.id, 'v', f, 1) < .5) return false; p = this.node(rig, p.parent); } return true; },
  /* ---------- desenha o personagem ---------- */
  draw(ctx, rig, f, W, H, o = {}) {
    const S0 = this.stageMatrix(rig, f, W, H), S = o.base ? o.base.multiply(S0) : S0, M = this.pose(rig, f), st = this.stageAt(rig, f);
    const order = [...rig.nodes].sort((a, b) => a.z - b.z);
    ctx.save(); const A0 = ctx.globalAlpha * clamp(st.O / 100, 0, 1); ctx.globalAlpha = A0; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    for (const n of order) {
      if (!M[n.id] || !this.visible(rig, n, f)) continue;
      const dr = this.drawingAt(rig, n, f), live = dr && typeof DrawLive !== 'undefined' ? DrawLive.get(dr) : null; if (!dr || (!dr.asset && !live)) continue; // desenho vazio = nada (ex.: olho aberto que já está no rosto)
      const im = live || Assets.get(dr.asset)?.img; if (!im) continue;
      if (o.only && !o.only(n)) continue;
      const m = S.multiply(M[n.id]); const q = o.q || 1;
      ctx.globalAlpha = o.tint ? A0 * (o.alpha ?? .35) : A0;
      // recorte: a pupila só aparece dentro do branco do olho (olho em camadas, como no Harmony)
      const mk = n.clip && this.node(rig, n.clip), mdr = mk && M[mk.id] && this.drawingAt(rig, mk, f), mim = mdr?.asset && Assets.get(mdr.asset)?.img;
      if (mim) {
        const t = this._ct ||= document.createElement('canvas'); if (t.width !== ctx.canvas.width || t.height !== ctx.canvas.height) { t.width = ctx.canvas.width; t.height = ctx.canvas.height; }
        const g = t.getContext('2d'), mm = S.multiply(M[mk.id]); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, t.width, t.height); g.globalCompositeOperation = 'source-over';
        g.setTransform(mm.a * q, mm.b * q, mm.c * q, mm.d * q, mm.e * q, mm.f * q); g.drawImage(mim, mdr.ox, mdr.oy, mdr.w ?? mim.naturalWidth, mdr.h ?? mim.naturalHeight);
        g.globalCompositeOperation = 'source-in'; g.setTransform(m.a * q, m.b * q, m.c * q, m.d * q, m.e * q, m.f * q); g.drawImage(im, dr.ox, dr.oy, dr.w ?? im.naturalWidth ?? im.width, dr.h ?? im.naturalHeight ?? im.height); g.globalCompositeOperation = 'source-over';
        const keep = ctx.getTransform(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(t, 0, 0); ctx.setTransform(keep); continue;
      }
      ctx.setTransform(m.a * q, m.b * q, m.c * q, m.d * q, m.e * q, m.f * q);
      ctx.drawImage(im, dr.ox, dr.oy, dr.w ?? im.naturalWidth ?? im.width, dr.h ?? im.naturalHeight ?? im.height);
    }
    ctx.restore();
    return { S, M };
  },
  // pontos do esqueleto no palco (para desenhar ossos e clicar)
  joints(rig, f, W, H, base) {
    const S0 = this.stageMatrix(rig, f, W, H), S = base ? base.multiply(S0) : S0, M = this.pose(rig, f), out = {};
    for (const n of rig.nodes) { const m = M[n.id]; if (!m) continue; const w = S.multiply(m); const p = w.transformPoint(new DOMPoint(0, 0)); const t = n.tip ? w.transformPoint(new DOMPoint(n.tip[0], n.tip[1])) : null; out[n.id] = { x: p.x, y: p.y, tip: t && { x: t.x, y: t.y }, m: w }; }
    return out;
  },

  /* ---------- IK (cinemática inversa): arrasta a mão/pé e o braço/perna acompanham, sem esticar ---------- */
  solveIK(rig, chain, f, target, W, H, iters = 30) {
    // chain[0] = ponta (mão/pé): o PIVÔ dela (pulso/tornozelo) vai até o alvo; giram as juntas de cima (antebraço, braço…)
    const eff = chain[0], joints = chain.slice(1), flip = this.stageAt(rig, f).F < 0 ? -1 : 1;
    for (let it = 0; it < iters; it++) {
      for (const node of joints) {
        const J = this.joints(rig, f, W, H), jn = J[node.id], E = J[eff.id]; if (!jn || !E) return;
        const d = AnimMath.norm(AnimMath.deg(Math.atan2(target.y - jn.y, target.x - jn.x) - Math.atan2(E.y - jn.y, E.x - jn.x)));
        let nv = this.ch(rig, node.id, 'r', f, 0) + d * flip * .85;
        if (node.limit) nv = clamp(nv, node.limit[0], node.limit[1]);
        this.setKey(rig, node.id, 'r', f, round(nv, 2));
      }
      const J = this.joints(rig, f, W, H), E = J[eff.id]; if (Math.hypot(E.x - target.x, E.y - target.y) < 1) break;
    }
  },
  setKey(rig, nid, c, f, v, e) { rig.keys[nid] ||= {}; const ks = rig.keys[nid][c] ||= []; AnimMath.setKey(ks, f, v, e); },
  delKey(rig, nid, c, f) { const ks = rig.keys[nid]?.[c]; if (!ks) return; const i = ks.findIndex(k => k.f === f); if (i >= 0) ks.splice(i, 1); if (!ks.length) delete rig.keys[nid][c]; },
  keyFrames(rig, nid) { const s = new Set(); for (const ks of Object.values(rig.keys[nid] || {})) ks.forEach(k => s.add(k.f)); return [...s].sort((a, b) => a - b); },
  allKeyFrames(rig) { const s = new Set(); for (const id of Object.keys(rig.keys)) this.keyFrames(rig, id).forEach(f => s.add(f)); return [...s].sort((a, b) => a - b); },

  /* ---------- poses (biblioteca): guarda giros/desenhos de todas as partes ---------- */
  capture(rig, f, ids) { const p = {}; for (const n of rig.nodes) { if (ids && !ids.includes(n.id)) continue; p[n.id] = { r: round(this.ch(rig, n.id, 'r', f, 0), 2), d: Math.round(this.ch(rig, n.id, 'd', f, n.d || 0)) }; const x = this.ch(rig, n.id, 'x', f, 0), y = this.ch(rig, n.id, 'y', f, 0); if (x || y) Object.assign(p[n.id], { x: round(x, 1), y: round(y, 1) }); } return p; },
  applyPose(rig, pose, f, e = 'ease', o = {}) {
    for (const [id, v] of Object.entries(pose)) {
      const n = this.node(rig, id); if (!n) continue;
      if (o.only && !o.only(n)) continue;
      if (v.r !== undefined && !o.noRot) this.setKey(rig, id, 'r', f, v.r, e);
      if (v.d !== undefined && !o.noDraw && n.drawings.length > 1) this.setKey(rig, id, 'd', f, v.d, 'hold');
      if (v.x !== undefined) { this.setKey(rig, id, 'x', f, v.x, e); this.setKey(rig, id, 'y', f, v.y || 0, e); }
    }
  },
  // pontinha do desenho (ponto mais longe do pivô) — usada na IK e para desenhar o osso das pontas
  computeTip(n) {
    const dr = n.drawings.find(d => d.asset); const rt = dr && Assets.get(dr.asset); if (!rt?.img) return null;
    const W = rt.img.naturalWidth, H = rt.img.naturalHeight, k = Math.min(1, 96 / Math.max(W, H)), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(rt.img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data; let best = null, bd = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 80) { const px = dr.ox + x / k, py = dr.oy + y / k, dd = px * px + py * py; if (dd > bd) { bd = dd; best = [round(px, 1), round(py, 1)]; } }
    return best;
  },
};

/* ---------- desenhar um quadro inteiro de um projeto de animação (usado no estúdio, na exportação e no editor) ---------- */
const AnimRender = {
  camAt(P, f) { const k = P.camera?.keys || {}; return { X: AnimMath.value(k.X, f, 0), Y: AnimMath.value(k.Y, f, 0), Z: AnimMath.value(k.Z, f, 1), R: AnimMath.value(k.R, f, 0) }; },
  camMatrix(P, f) { const W = P.settings.w, H = P.settings.h, c = this.camAt(P, f); return new DOMMatrix().translateSelf(W / 2, H / 2).scaleSelf(c.Z, c.Z).rotateSelf(c.R).translateSelf(-W / 2 - c.X, -H / 2 - c.Y); },
  frame(g, P, f, o = {}) {
    const W = P.settings.w, H = P.settings.h, q = o.q || 1, V = new DOMMatrix().scaleSelf(q, q), base = V.multiply(this.camMatrix(P, f));
    g.save(); g.setTransform(V);
    if (!o.transparent) { g.fillStyle = P.settings.bg || '#000'; g.fillRect(0, 0, W, H); }
    if (P.bgAsset && !o.transparent) { const rt = Assets.get(P.bgAsset); if (rt?.img) { g.setTransform(base); const iw = rt.img.naturalWidth, ih = rt.img.naturalHeight, s = Math.max(W / iw, H / ih); g.drawImage(rt.img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s); } }
    g.restore();
    for (const rig of P.rigs || []) Rig.draw(g, rig, f, W, H, { base });
    g.setTransform(1, 0, 0, 1, 0, 0);
  },
};
