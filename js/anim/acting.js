/* ===================== anim/acting.js — atuação automática (estilo Disney TV: The Owl House / Amphibia) =====================
   O que deixa a animação de recorte com cara de TV (e não "robótica" nem "tremendo"):
   • POSE A POSE: poucas poses fortes, trocadas nas palavras de ênfase; entre elas, HOLD vivo (moving hold: 1–2° de deriva)
   • ANTECIPAÇÃO curta (2–3 quadros para o lado contrário) antes de cada mudança grande e um leve PASSAR DO PONTO no fim
   • A CABEÇA lidera, o tronco vem 2 quadros depois com menos amplitude (overlap); cabelo/brinco seguem com atraso (follow)
   • PISCADA a cada 2–5 s e sempre junto de uma virada de cabeça; boca em "2s" (12 por segundo), fechando no silêncio
   • NADA de pulinho/tremor constante — só em grito/susto/alegria, e por pouco tempo
   Tudo vira keyframe normal: dá para ajustar à mão depois na timeline. */
'use strict';

const ACTING_GUIDE = `GUIA DE ANIMAÇÃO DE RECORTE (Toon Boom Harmony, estilo Disney TV — The Owl House, Amphibia):
POSE A POSE: pense em POSES-CHAVE fortes (silhueta clara, linha de ação), uma por ideia/frase; troque de pose na sílaba tônica da palavra de ênfase. Entre poses: a curva "out" (sai rápido, chega devagar) em 4–7 quadros; ações rápidas em 2–4 quadros.
HOLD VIVO: cada pose fica 0,4–2 s parada mas viva (moving hold: deriva de 1–2° na cabeça/tronco, uma piscada, a respiração). Nunca tudo se mexendo ao mesmo tempo.
ANTECIPAÇÃO: antes de mudança grande, 2–3 quadros indo um pouco para o lado contrário (10–25% do movimento). FINAL: passa 5–10% do ponto e assenta em 2–3 quadros.
OVERLAP / FOLLOW-THROUGH: a cabeça lidera; o tronco segue 2 quadros depois com 40% do giro; braços 1–3 quadros depois; cabelo, orelhas, roupa e acessórios atrasam 2–4 quadros (use "seguir com atraso" nessas partes).
CABEÇA: incline/acene para pontuar a fala (3–8°), mude o ângulo da cabeça a cada pensamento novo; os olhos chegam 1–2 quadros antes da cabeça.
EXPRESSÕES: se a cabeça tiver desenhos de expressão (feliz, triste, surpresa, brava, piscando…), use-os como "TAKE": troque no começo da reação, segure ~1 s e volte para a cabeça que fala (onde a boca e os olhos animam). Varie: uma expressão por ideia/emoção.
BOCA VIVA: use todos os desenhos de boca (fechada, meio, aberta, grande) pelo volume; vogal forte = grande; nunca a mesma boca parada por mais de 0,5 s enquanto fala.
OLHOS EM CAMADAS: contorno/pálpebra, branco do olho e PUPILA separada; a pupila mexe dentro do branco (recortada por ele) — olhe para quem fala, para o objeto citado; os olhos chegam 1–2 quadros antes da cabeça.
SOBREPOSIÇÃO NAS JUNTAS (regra do Harmony): cada peça continua por baixo da vizinha (pescoço entra por baixo da cabeça, ombro/cotovelo/joelho com a ponta redonda escondida), assim girar não abre buraco. Logos/estampas e bolsos são peças PRESAS na roupa (seguem o tronco). Mãos: poses diferentes são troca de desenho, não esticar.
CABELO: mechas e cabelo de trás com "seguir com atraso" — balançam depois da cabeça (2–4 quadros), nunca grudados.
PISCADA: a cada 2–5 s, sempre numa virada de cabeça ou troca de pose; 1–2 quadros fechado (3–5 no total). Evite piscar no meio de palavra forte.
BOCA (lip-sync): em 2s (12 por segundo); feche no M/B/P e no silêncio; abra mais na vogal tônica; antecipe a boca 1 quadro antes do som. Não "bata a boca" a cada quadro.
SOBRANCELHAS carregam a emoção (sobem na pergunta/surpresa, descem na raiva/foco); ASSIMETRIA: lado esquerdo e direito nunca idênticos (evite "twinning").
GESTOS: poucos e com motivo (um gesto por ideia); as mãos descansam entre gestos; o gesto chega 2–4 quadros ANTES da palavra que ele ilustra.
COMÉDIA (Owl House/Amphibia): "take" rápido — antecipação de 2 quadros, golpe de 3–4, HOLD longo da reação; squash/stretch só em momento cartunesco.
CÂMERA: quase parada; push-in lento na emoção; corte seco em vez de câmera passeando.
PROIBIDO: pulinho/tremor constante, balançar sem motivo, todas as partes girando juntas, poses simétricas, movimento linear (sem curva), hold "morto" (completamente parado por mais de 2 s).
MEXER NAS IMAGENS: você NUNCA altera, redesenha, apaga ou recorta imagens sem PERGUNTAR antes. Para isso use {"tipo":"pedir_permissao","descricao":"..."} e espere.`;

const Acting = {
  // envelope da voz (100 por segundo) somando os áudios do projeto
  voiceEnv(P, from = 0, to = Infinity) {
    const fps = P.settings.fps, N = Math.ceil((P.frames / fps) * 100), env = new Float32Array(N);
    for (const a of P.audio || []) {
      if (a.muted || a.kind === 'musica') continue;
      const buf = Assets.audioBuffer(a.asset, Assets.ctx()); if (!buf) continue;
      const ch = buf.getChannelData(0), sr = buf.sampleRate, st = a.start / fps;
      for (let i = 0; i < N; i++) { const t = i / 100 - st + (a.offset || 0); if (t < 0 || t * sr >= ch.length) continue; let s = 0; const i0 = Math.floor(t * sr), n = Math.floor(sr / 100); for (let k = 0; k < n; k += 2) { const v = ch[i0 + k] || 0; s += v * v; } env[i] = Math.max(env[i], Math.sqrt(s / (n / 2)) * (a.vol ?? 100) / 100); }
    }
    return env;
  },
  analyze(P) {
    const env = this.voiceEnv(P), fps = P.settings.fps, db = Array.from(env, v => 20 * Math.log10(v + 1e-6));
    const sorted = [...db].sort((a, b) => a - b), floor = sorted[Math.floor(sorted.length * .15)] ?? -60, peak = sorted[Math.floor(sorted.length * .98)] ?? -10, thr = Math.max(floor + 8, peak - 28);
    const phrases = []; let s = -1, q = 0;
    for (let i = 0; i <= db.length; i++) { const on = i < db.length && db[i] > thr; if (on) { if (s < 0) s = i; q = 0; } else if (s >= 0) { q++; if (q >= 22 || i === db.length) { phrases.push([s, i - q + 1]); s = -1; q = 0; } } }
    const ph = phrases.filter(([a, b]) => b - a > 15).map(([a, b]) => ({ f0: Math.round(a / 100 * fps), f1: Math.round(b / 100 * fps) }));
    // ênfases: picos de volume (sílabas fortes) dentro das frases
    const acc = [];
    for (const p of ph) {
      const i0 = Math.round(p.f0 / fps * 100), i1 = Math.round(p.f1 / fps * 100), loc = [];
      for (let i = i0 + 3; i < i1 - 3; i++) if (db[i] > db[i - 3] + 4 && db[i] >= db[i - 1] && db[i] >= db[i + 1] && db[i] > peak - 9) loc.push([i, db[i]]);
      loc.sort((a, b) => b[1] - a[1]); const keep = [];
      for (const [i, v] of loc) if (keep.every(k => Math.abs(k[0] - i) > 45)) keep.push([i, v]);
      keep.slice(0, Math.max(1, Math.round((i1 - i0) / 120))).forEach(([i, v]) => acc.push({ f: Math.round(i / 100 * fps), forca: clamp((v - (peak - 12)) / 12, 0, 1) }));
    }
    acc.sort((a, b) => a.f - b.f);
    return { env, db, thr, peak, phrases: ph, accents: acc, fps };
  },
  find(rig, role, side) { return rig.nodes.filter(n => n.role === role && (!side || n.side === side)); },
  // ordem das bocas: da mais fechada para a mais aberta (pelo nome; senão pela altura do desenho)
  mouthOrder(node) {
    const U = { fechada: 0, meio: 1, aberta: 2, grande: 3 };
    const score = d => { if (d.uso && U[d.uso] !== undefined) return U[d.uso]; const n = (d.name || '').toLowerCase(); if (/fech|closed|\bx\b|mbp|\bm\b|neutr/.test(n)) return 0; if (/meio|half|\bb\b|\bc\b|\be\b|\bi\b|sorri|smile/.test(n)) return 1; if (/grande|grito|bem abert|wide|\bo\b/.test(n)) return 3; if (/abert|open|\ba\b|\bd\b/.test(n)) return 2; return null; };
    const idx = node.drawings.map((d, i) => ({ i, s: score(d), h: d.h || 0 })).filter(x => node.drawings[x.i].uso !== 'nao');
    if (idx.every(x => x.s === null)) idx.sort((a, b) => a.h - b.h); else idx.sort((a, b) => (a.s ?? 1) - (b.s ?? 1) || a.h - b.h);
    return idx.map(x => x.i);
  },
  closedEye(node) { const u = node.drawings.findIndex(d => d.uso === 'fechado'); if (u >= 0) return u; const nm = d => (d.name || '').toLowerCase(); let i = node.drawings.findIndex(d => /^(fechad|closed)/.test(nm(d))); if (i < 0) i = node.drawings.findIndex(d => /fech|closed|pisc|blink/.test(nm(d)) && !/meio|half/.test(nm(d))); if (i >= 0) return i; if (node.drawings.length < 2) return -1; let b = 0; node.drawings.forEach((d, k) => { if ((d.h || 1e9) < (node.drawings[b].h || 1e9)) b = k; }); return b; },
  clearRange(rig, nid, c, f0, f1) { const ks = rig.keys[nid]?.[c]; if (!ks) return; rig.keys[nid][c] = ks.filter(k => k.f < f0 || k.f > f1); },

  /* ---------- boca pela voz ---------- */
  lipsync(P, rig, A, f0 = 0, f1 = P.frames) {
    const mouths = this.find(rig, 'boca').filter(n => n.drawings.length > 1);
    let n = 0;
    // PNGtuber: desenho inteiro com versão "falando" (canal m) — usado quando não há boca separada
    if (!mouths.length) for (const t of rig.nodes.filter(x => x.talk && Object.keys(x.talk).length)) {
      this.clearRange(rig, t.id, 'm', f0, f1); let last = -1;
      for (let f = f0; f <= f1; f += 2) { const i = Math.round((f + 1) / A.fps * 100), v = Math.max(A.db[i] ?? -99, A.db[i + 2] ?? -99), m = v < A.thr ? 0 : 1; if (m !== last) { Rig.setKey(rig, t.id, 'm', f, m, 'hold'); last = m; n++; } }
    }
    if (!mouths.length) return n;
    for (const m of mouths) {
      const ord = this.mouthOrder(m), levels = ord.length; this.clearRange(rig, m.id, 'd', f0, f1);
      let last = -1;
      for (let f = f0; f <= f1; f += 2) {
        const i = Math.round((f + 1) / A.fps * 100), v = Math.max(A.db[i] ?? -99, A.db[i + 2] ?? -99); // 1 quadro antes do som
        let lv = v < A.thr ? 0 : Math.min(levels - 1, 1 + Math.floor(((v - A.thr) / Math.max(4, A.peak - A.thr)) * (levels - 1)));
        if (levels === 2) lv = v < A.thr ? 0 : 1;
        const d = ord[lv]; if (d !== last) { Rig.setKey(rig, m.id, 'd', f, d, 'hold'); last = d; n++; }
      }
    }
    return n;
  },
  /* ---------- piscadas ---------- */
  blinks(P, rig, f0 = 0, f1 = P.frames, extra = []) {
    const eyes = this.find(rig, 'olho').filter(n => this.closedEye(n) >= 0); if (!eyes.length) return 0;
    const fps = P.settings.fps; let n = 0;
    for (const e of eyes) this.clearRange(rig, e.id, 'd', f0, f1);
    const times = []; let f = f0 + Math.round(fps * (1.2 + Math.random() * 1.2));
    while (f < f1 - 4) { times.push(f); f += Math.round(fps * (2.2 + hash(f) * 2.6)); }
    for (const x of extra) if (x > f0 && x < f1 - 4 && times.every(t => Math.abs(t - x) > fps * .8)) times.push(x);
    times.sort((a, b) => a - b);
    for (const t of times) for (const e of eyes) { const c = this.closedEye(e), o = e.d || 0; Rig.setKey(rig, e.id, 'd', t, c, 'hold'); Rig.setKey(rig, e.id, 'd', t + (hash(t) > .5 ? 2 : 3), o, 'hold'); n++; }
    return times.length;
  },
  /* ---------- troca de pose com antecipação + passar do ponto + hold vivo ---------- */
  poseTo(rig, target, F, o = {}) {
    // target = { nodeId: { r, d } } ; F = quadro em que a pose nova "chega"
    const T = o.trans ?? 6, ant = o.ant ?? .18, A0 = Math.max(0, F - T - 3);
    for (const [id, v] of Object.entries(target)) {
      const n = Rig.node(rig, id); if (!n || v.r === undefined) continue;
      const lag = o.lag?.[n.role] ?? 0, cur = Rig.ch(rig, id, 'r', A0 + lag, 0), d = v.r - cur;
      if (Math.abs(d) < .3) continue;
      this.clearRange(rig, id, 'r', A0 + lag + 1, F + lag + 3);
      Rig.setKey(rig, id, 'r', A0 + lag, round(cur, 2), 'ease');
      if (Math.abs(d) > 4 && ant > 0) Rig.setKey(rig, id, 'r', A0 + lag + 3, round(cur - d * ant, 2), 'out');
      Rig.setKey(rig, id, 'r', F + lag, round(v.r + d * (o.over ?? .07), 2), 'ease');
      Rig.setKey(rig, id, 'r', F + lag + 3, round(v.r, 2), 'ease');
    }
    for (const [id, v] of Object.entries(target)) { const n = Rig.node(rig, id); if (n && v.d !== undefined && n.drawings.length > 1 && !['boca', 'olho'].includes(n.role)) Rig.setKey(rig, id, 'd', Math.max(0, F - 2), v.d, 'hold'); }
  },
  // HOLD VIVO (moving hold): entre as poses, derivas lentas e pequenas (1–2°) na cabeça, tronco e braços — nunca tremor
  drift(rig, f0, f1, o = {}) {
    const k = o.k ?? 1, step = o.step ?? 30, roles = { cabeca: 1.6, tronco: .6, braco: 2.2, antebraco: 1.4, mao: 2.5, cabelo: 1.2, inteiro: .9 };
    let n = 0;
    for (const nd of rig.nodes) {
      const amp = (roles[nd.role] || 0) * k; if (!amp) continue;
      const ks = rig.keys[nd.id]?.r || [];
      for (let f = f0 + step; f < f1 - 6; f += step + Math.round(hash(f + nd.id.length) * 10)) {
        if (ks.some(x => Math.abs(x.f - f) < 9)) continue;
        const cur = Rig.ch(rig, nd.id, 'r', f, 0), d = (hash(f * 1.37 + nd.id.charCodeAt(2)) - .5) * 2 * amp;
        Rig.setKey(rig, nd.id, 'r', f, round(cur + d, 2), 'ease'); n++;
      }
    }
    return n;
  },
  // EXPRESSÕES (take): se a cabeça tem desenhos de expressão, troca nas ênfases fortes por ~1 s e volta para a cabeça que fala
  EXPR_RE: /feliz|rindo|ri\b|alegr|surpres|triste|brav|raiva|pisc|preocup|medo|assust|desconf|t[eé]dio|suspir/i,
  expressions(P, rig, A, f0 = 0, f1 = P.frames) {
    const head = this.find(rig, 'cabeca')[0]; if (!head) return 0;
    const ex = head.drawings.map((d, i) => this.EXPR_RE.test(d.name || '') ? i : -1).filter(i => i > 0); if (!ex.length) return 0;
    const kids = rig.nodes.filter(n => n.parent === head.id && ['olho', 'boca', 'sobrancelha'].includes(n.role));
    const fps = A.fps; let last = -1e9, n = 0, k = 0;
    for (const a of A.accents.filter(a => a.forca > .45 && a.f >= f0 && a.f < f1 - fps)) {
      if (a.f - last < fps * 2.6) continue;
      const F = Math.max(f0, a.f - 2), B = Math.min(f1 - 1, F + Math.round(fps * 1.1)), d = ex[(k++ * 7 + Math.round(a.f)) % ex.length];
      Rig.setKey(rig, head.id, 'd', F, d, 'hold'); Rig.setKey(rig, head.id, 'd', B, head.d || 0, 'hold');
      for (const c of kids) { Rig.setKey(rig, c.id, 'v', F, 0, 'hold'); Rig.setKey(rig, c.id, 'v', B, 1, 'hold'); }
      last = F; n++;
    }
    return n;
  },
  /* ---------- OLHAR (pupila em camada, recortada pelo branco do olho) ---------- */
  LOOK: { centro: [0, 0], esq: [-1, 0], dir: [1, 0], cima: [0, -1], baixo: [0, 1], 'cima-esq': [-.75, -.7], 'cima-dir': [.75, -.7], 'baixo-esq': [-.75, .7], 'baixo-dir': [.75, .7] },
  pupils(rig) { return rig.nodes.filter(n => n.role === 'pupila'); },
  look(rig, f, dir, o = {}) {
    const v = Array.isArray(dir) ? dir : this.LOOK[dir] || this.LOOK.centro; let n = 0;
    for (const p of this.pupils(rig)) {
      const eye = Rig.node(rig, p.parent), ed = eye && eye.drawings.find(d => d.asset), r = ed ? Math.min(ed.w, ed.h) * .24 : 10, T = o.trans ?? 3;
      const x0 = Rig.ch(rig, p.id, 'x', f - T, 0), y0 = Rig.ch(rig, p.id, 'y', f - T, 0);
      Rig.setKey(rig, p.id, 'x', Math.max(0, f - T), round(x0, 1), 'out'); Rig.setKey(rig, p.id, 'y', Math.max(0, f - T), round(y0, 1), 'out');
      Rig.setKey(rig, p.id, 'x', f, round(v[0] * r, 1), 'ease'); Rig.setKey(rig, p.id, 'y', f, round(v[1] * r * .8, 1), 'ease');
      if (o.hold) { Rig.setKey(rig, p.id, 'x', f + o.hold, round(v[0] * r, 1), 'out'); Rig.setKey(rig, p.id, 'y', f + o.hold, round(v[1] * r * .8, 1), 'out'); Rig.setKey(rig, p.id, 'x', f + o.hold + T, 0, 'ease'); Rig.setKey(rig, p.id, 'y', f + o.hold + T, 0, 'ease'); }
      n++;
    }
    return n;
  },
  // olhos vivos: de vez em quando olham para o lado e voltam (e chegam antes da cabeça)
  glances(P, rig, f0, f1) {
    if (!this.pupils(rig).length) return 0; const fps = P.settings.fps, dirs = ['esq', 'dir', 'cima-esq', 'baixo', 'cima-dir', 'baixo-esq']; let n = 0;
    for (let f = f0 + Math.round(fps * 1.6); f < f1 - fps; f += Math.round(fps * (2.4 + hash(f) * 2.4))) { this.look(rig, f, dirs[n % dirs.length], { trans: 2, hold: Math.round(fps * (.5 + hash(f + 3) * .6)) }); n++; }
    return n;
  },
  // pequeno aceno/inclinação de cabeça numa ênfase (e o tronco acompanha um pouco depois)
  accent(rig, F, amt, dir) {
    const head = this.find(rig, 'cabeca')[0], torso = this.find(rig, 'tronco')[0] || this.find(rig, 'quadril')[0];
    if (head) { const cur = Rig.ch(rig, head.id, 'r', F - 3, 0); Rig.setKey(rig, head.id, 'r', F - 3, round(cur, 2), 'out'); Rig.setKey(rig, head.id, 'r', F, round(cur + dir * amt, 2), 'ease'); Rig.setKey(rig, head.id, 'r', F + 7, round(cur + dir * amt * .45, 2), 'ease'); }
    if (torso) { const cur = Rig.ch(rig, torso.id, 'r', F - 1, 0); Rig.setKey(rig, torso.id, 'r', F - 1, round(cur, 2), 'out'); Rig.setKey(rig, torso.id, 'r', F + 2, round(cur + dir * amt * .3, 2), 'ease'); Rig.setKey(rig, torso.id, 'r', F + 9, round(cur + dir * amt * .15, 2), 'ease'); }
  },
  // poses automáticas (quando você ainda não salvou poses): pequenas, seguras, sem deformar
  autoPoses(rig, k = 1) {
    const g = (role, side) => this.find(rig, role, side)[0], P = [], add = (o) => { const p = {}; for (const [n, r] of o) if (n) p[n.id] = { r: round(r * k, 1) }; P.push(p); };
    const hd = g('cabeca'), tr = g('tronco') || g('quadril'), bd = g('braco', 'dir') || this.find(rig, 'braco')[0], be = g('braco', 'esq') || this.find(rig, 'braco')[1], ad = g('antebraco', 'dir') || this.find(rig, 'antebraco')[0], ae = g('antebraco', 'esq') || this.find(rig, 'antebraco')[1];
    add([[hd, -5], [tr, -1.5], [bd, -14], [ad, -18], [be, 4]]);   // explicando (um braço)
    add([[hd, 6], [tr, 2], [bd, 3], [be, 12], [ae, 15]]);          // explicando (outro braço)
    add([[hd, -3], [tr, -1], [bd, -6], [be, 6], [ad, -6], [ae, 6]]); // abre os braços de leve
    add([[hd, 4], [tr, 1], [bd, 2], [be, -2]]);                    // descansa
    return P;
  },
  // ATUAÇÃO COMPLETA pela voz: troca de pose por frase, acentos, piscadas, boca
  perform(P, rig, o = {}) {
    const A = this.analyze(P), k = { calmo: .6, normal: 1, expressivo: 1.5 }[o.intensidade || 'normal'] || 1;
    const f0 = o.de ?? 0, f1 = o.ate ?? P.frames, poses = Object.values(rig.poses || {}).filter(p => !p.tag || p.tag !== 'neutra').map(p => p.data);
    const lib = poses.length >= 2 ? poses : this.autoPoses(rig, k);
    const neutral = rig.poses?.neutra?.data || Object.fromEntries(rig.nodes.map(n => [n.id, { r: 0 }]));
    const turns = [];
    let pi = 0, lastF = -99;
    for (const ph of A.phrases) {
      if (ph.f0 < f0 || ph.f0 > f1) continue;
      if (ph.f0 - lastF < P.settings.fps * .9) continue; // não troca de pose rápido demais
      const pose = lib[pi++ % lib.length]; this.poseTo(rig, pose, Math.max(f0 + 2, ph.f0 + 2), { trans: 6, ant: .2 * k, lag: { tronco: 2, quadril: 2, braco: 1, antebraco: 2, mao: 3 } });
      turns.push(Math.max(0, ph.f0 - 4)); lastF = ph.f0;
      // volta para perto do neutro no fim de frase longa (descansa)
      if (ph.f1 - ph.f0 > P.settings.fps * 3.5) this.poseTo(rig, neutral, ph.f1 + 4, { trans: 7, ant: .1 });
    }
    let dir = 1;
    for (const a of A.accents) { if (a.f < f0 || a.f > f1) continue; this.accent(rig, a.f, (2.5 + a.forca * 4) * k, dir); dir = -dir; }
    // PNGtuber (desenho inteiro com várias poses): troca de pose por frase, com um "pulo" de assentamento curto
    for (const nd of rig.nodes.filter(x => x.role === 'inteiro' && x.drawings.filter(d => d.asset).length > 1)) {
      const talkIdx = new Set(Object.values(nd.talk || {}).map(Number)), opts = nd.drawings.map((d, i) => i).filter(i => nd.drawings[i].asset && !talkIdx.has(i));
      let j = 0, lf = -1e9;
      for (const ph of A.phrases) { if (ph.f0 < f0 || ph.f0 > f1 || ph.f0 - lf < P.settings.fps * 1.2) continue; const d = opts[(j++) % opts.length]; Rig.setKey(rig, nd.id, 'd', Math.max(0, ph.f0 - 1), d, 'hold');
        const sy0 = Rig.ch(rig, nd.id, 'sy', ph.f0, 1); Rig.setKey(rig, nd.id, 'sy', Math.max(0, ph.f0 - 1), sy0 * .97, 'out'); Rig.setKey(rig, nd.id, 'sy', ph.f0 + 3, sy0 * 1.015, 'ease'); Rig.setKey(rig, nd.id, 'sy', ph.f0 + 7, sy0, 'ease'); lf = ph.f0; }
    }
    this.drift(rig, f0, f1, { k: k * .8 });
    this.glances(P, rig, f0, f1);
    const ne = this.expressions(P, rig, A, f0, f1);
    const nb = o.piscar === false ? 0 : this.blinks(P, rig, f0, f1, turns);
    const nl = o.boca === false ? 0 : this.lipsync(P, rig, A, f0, f1);
    return { frases: A.phrases.length, acentos: A.accents.length, piscadas: nb, bocas: nl, expressoes: ne };
  },

  /* ---------- IA (Claude) planeja a atuação; o motor acima executa com antecipação/overlap ---------- */
  describe(P, rig, A) {
    const fps = P.settings.fps;
    const parts = Rig.ordered(rig).map(([n, lv]) => `${'  '.repeat(lv)}- "${n.name}" (papel ${n.role}${n.side ? ', lado ' + n.side : ''}; desenhos: ${n.drawings.map((d, i) => i + '=' + (d.name || 'desenho ' + (i + 1))).join(', ')}${n.limit ? `; giro ${n.limit[0]}..${n.limit[1]}°` : ''})`).join('\n');
    const poses = Object.keys(rig.poses || {}).join(', ') || '(nenhuma salva — use "girar" nas partes)';
    const ph = A.phrases.map(p => `[${p.f0}–${p.f1}]`).join(' '), ac = A.accents.map(a => `${a.f}(${round(a.forca, 1)})`).join(' ');
    return `PROJETO: ${P.settings.w}×${P.settings.h}, ${fps} quadros/s, ${P.frames} quadros.\nPERSONAGEM "${rig.name}" — partes (árvore de ossos):\n${parts}\nPOSES SALVAS: ${poses}\nFALA (quadros): frases ${ph || 'nenhuma'}\nÊNFASES (quadro(força 0–1)): ${ac || 'nenhuma'}\n${P.roteiro ? 'ROTEIRO: ' + P.roteiro.slice(0, 3000) : ''}`;
  },
  async askAI(P, rig, pedido, onText) {
    if (!AIClient.ready) throw new Error('A IA do Estúdio Problems não está ligada neste editor (falta o servidor na Cloudflare). Use "Atuação automática", que funciona sem internet.');
    const A = this.analyze(P);
    const sys = `Você é um ANIMADOR de recorte experiente (Toon Boom Harmony) da equipe de séries Disney TV como The Owl House e Amphibia. Você recebe um personagem montado em partes com ossos e a fala, e devolve um PLANO DE ATUAÇÃO em linhas JSON (uma ação por linha, nada antes nem depois):
{"resumo":"o que você vai fazer, em 1–2 frases"}
{"tipo":"pose","quadro":Q,"pose":"NOME_DA_POSE_SALVA","transicao":4-8}
{"tipo":"girar","quadro":Q,"parte":"NOME DA PARTE","graus":G,"transicao":4-8}   (giro absoluto da parte em relação ao pai; respeite os limites)
{"tipo":"acento","quadro":Q,"forca":0.2-1}   (aceno/inclinação de cabeça na sílaba forte)
{"tipo":"desenho","quadro":Q,"parte":"NOME","desenho":N}   (troca de desenho: mão, olho, sobrancelha…)
{"tipo":"piscar","quadro":Q}
{"tipo":"boca","de":Q,"ate":Q}   (lip-sync automático pela voz nesse trecho)
{"tipo":"mover","quadro":Q,"x":px,"y":px,"transicao":Q}   (o personagem anda no palco — use pouco)
{"tipo":"pedir_permissao","descricao":"..."}   (OBRIGATÓRIO antes de qualquer mudança em imagem: redesenhar, recortar, apagar, espelhar desenho)
{"fim":true}
O motor coloca sozinho a antecipação, o passar do ponto, o atraso do tronco/braços e o cabelo seguindo. Você decide O QUE e QUANDO (o "acting").
${ACTING_GUIDE}`;
    const msgs = [{ role: 'user', content: [{ type: 'text', text: this.describe(P, rig, A) + '\n\nPEDIDO: ' + (pedido || 'Anime a fala inteira com atuação natural de TV.') }] }];
    const j = await AIClient.call(msgs, sys, onText);
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('{')).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    return { plano: lines, A };
  },
  async applyPlan(P, rig, plan, A) {
    const byName = n => rig.nodes.find(x => x.name.toLowerCase() === String(n || '').toLowerCase()) || rig.nodes.find(x => x.name.toLowerCase().includes(String(n || '').toLowerCase()));
    let n = 0, resumo = '';
    const perm = plan.filter(a => a.tipo === 'pedir_permissao');
    if (perm.length) {
      const ok = await UI.confirm({ title: 'A IA quer mexer nas imagens', icon: 'alert', msg: `<p>Antes de continuar, a IA pediu permissão para:</p><ul>${perm.map(a => `<li>${esc(a.descricao || '')}</li>`).join('')}</ul><p>Nada foi alterado nas imagens. Se aceitar, ela só <b>anota o pedido</b> para você fazer (ou mandar as imagens novas); a animação continua com as imagens atuais.</p>`, ok: 'Entendi' });
      if (ok) P.pedidosImagem = [...(P.pedidosImagem || []), ...perm.map(a => a.descricao)];
    }
    for (const a of plan) {
      if (a.resumo) { resumo = a.resumo; continue; }
      const Q = Math.max(0, Math.round(+a.quadro || 0));
      switch (a.tipo) {
        case 'pose': { const p = rig.poses?.[a.pose]; if (p) { this.poseTo(rig, p.data, Q, { trans: +a.transicao || 6, lag: { tronco: 2, braco: 1, antebraco: 2, mao: 3 } }); n++; } break; }
        case 'girar': { const nd = byName(a.parte); if (nd && isFinite(+a.graus)) { this.poseTo(rig, { [nd.id]: { r: +a.graus } }, Q, { trans: +a.transicao || 6 }); n++; } break; }
        case 'acento': this.accent(rig, Q, 2.5 + clamp(+a.forca || .5, 0, 1) * 4, n % 2 ? 1 : -1); n++; break;
        case 'desenho': { const nd = byName(a.parte); if (nd && nd.drawings.length > 1) { Rig.setKey(rig, nd.id, 'd', Q, clamp(Math.round(+a.desenho || 0), 0, nd.drawings.length - 1), 'hold'); n++; } break; }
        case 'piscar': for (const e of this.find(rig, 'olho')) { const c = this.closedEye(e); if (c >= 0) { Rig.setKey(rig, e.id, 'd', Q, c, 'hold'); Rig.setKey(rig, e.id, 'd', Q + 2, e.d || 0, 'hold'); } } n++; break;
        case 'boca': n += this.lipsync(P, rig, A, Math.max(0, +a.de || 0), Math.min(P.frames, +a.ate || P.frames)) ? 1 : 0; break;
        case 'mover': { const T = +a.transicao || 12, cx = Rig.ch(rig, '@', 'X', Q - T, rig.stage.X), cy = Rig.ch(rig, '@', 'Y', Q - T, rig.stage.Y); Rig.setKey(rig, '@', 'X', Q - T, cx, 'ease'); Rig.setKey(rig, '@', 'Y', Q - T, cy, 'ease'); Rig.setKey(rig, '@', 'X', Q, +a.x || cx, 'out'); Rig.setKey(rig, '@', 'Y', Q, +a.y || cy, 'out'); n++; break; }
      }
    }
    return { n, resumo };
  },
};
