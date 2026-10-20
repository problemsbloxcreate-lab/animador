/* ===================== animacao.js — mais ferramentas de animação =====================
   • "Preso a" (boneco com partes): braço, cabeça, boca… seguem o corpo (clip.parent)
   • Pivô exato (ponto de giro em %) para girar braço pelo ombro, cabeça pelo pescoço
   • "Mostrar só quando": aparece só quando a voz fala / quando está calado / piscando os olhos (clip.vis)
     → boca automática (patch de boca fechada) e piscada automática (patch de olhos fechados)
   • Animações: andar no lugar, correr no lugar, pulo com antecipação, tremer de raiva, balançar a cabeça falando,
     pêndulo (braço balançando), acenar, entrar com borrão (whip) e "cair do céu"
   • Efeitos: borrão de movimento, nuvem de chuva, linhas de corrida, raios girando, reflexo de vidro (vitrine),
     dinheiro chovendo
   • Transição "chicote (whip)" — borrão rápido que esconde o corte entre cenas
   • Separar sprites automaticamente (folhas de sprites e de cenários)
   Tudo aparece nos menus normais (Animações / Efeitos / Transições / botão direito na mídia) e a IA também usa. */
'use strict';

/* ---------- visibilidade automática (boca / piscada) ---------- */
const VIS_MODES = { fala: 'Só quando a voz está falando (boca aberta)', calado: 'Só quando a voz está calada (boca fechada)', piscar: 'Só quando pisca (olhos fechados)', naoPiscar: 'Só quando NÃO está piscando (olhos abertos)' };
const Vis = {
  // fala: quantiza em 12 quadros por segundo (animação "em 2s"), igual desenho; segura aberto um pouquinho para não tremer
  talking(clip, t) {
    const v = clip.vis || {}, step = 1 / (v.fps || 12), tq = Math.floor(t / step) * step;
    if (typeof AudioAnalysis === 'undefined' || typeof Mouth === 'undefined') return false;
    const list = v.audio ? [App.clip?.(v.audio) || curProjClip(v.audio)].filter(Boolean) : AudioAnalysis.sources();
    for (const ac of list) {
      if (tq < ac.start || tq > ac.start + ac.dur) continue;
      const e = Mouth.env(ac); if (!e) continue;
      const i = Math.floor((tq - e.start) * e.rate), n = Math.max(1, Math.round(e.rate * step));
      let m = 0; for (let k = 0; k < n; k++) m = Math.max(m, e.env[i + k] || 0);
      if (m > e.p90 * (v.limite ?? .3)) return true;
    }
    return false;
  },
  // piscada: a cada ~3 s (varia), 0,12 s fechado; às vezes pisca duas vezes
  blinking(clip, t) {
    const v = clip.vis || {}, per = Math.max(.8, v.cada || 3.2), dur = v.dur || .12, seed = (v.seed ?? 3) * 31;
    const k = Math.floor(t / per);
    for (const kk of [k - 1, k]) {
      const t0 = kk * per + hash(kk + seed) * per * .55;
      if (t >= t0 && t < t0 + dur) return true;
      if (hash(kk * 7 + seed) > .72 && t >= t0 + dur + .1 && t < t0 + dur * 2 + .1) return true;
    }
    return false;
  },
  show(clip, t) {
    const m = clip.vis?.modo; if (!m) return true;
    if (m === 'fala') return this.talking(clip, t);
    if (m === 'calado') return !this.talking(clip, t);
    if (m === 'piscar') return this.blinking(clip, t);
    if (m === 'naoPiscar') return !this.blinking(clip, t);
    return true;
  },
};
function curProjClip(id) { return (typeof App !== 'undefined' && App.project) ? App.project.clips.find(c => c.id === id) : null; }

/* ---------- animações novas ---------- */
Object.assign(ANIMS, {
  walkInPlace: {
    name: 'Andando (no lugar)', cat: 'Movimento', dur: 2, sound: '', hint: 'Passinhos sem sair do lugar (ótimo com o cenário passando atrás).',
    params: [{ k: 'steps', l: 'Passos por segundo', min: .5, max: 8, step: .1, def: 2.6 }, { k: 'height', l: 'Altura', min: 0, max: 80, def: 14, unit: 'px' }, { k: 'tilt', l: 'Gingado', min: 0, max: 15, step: .5, def: 3, unit: '°' }],
    fn(p, P, x) { const ph = x.t * P.steps, up = Math.abs(Math.sin(ph * Math.PI)); return { dy: -P.height * up, rot: P.tilt * Math.sin(ph * Math.PI), sy: 1 - .03 * (1 - up), sx: 1 + .02 * (1 - up), pivot: 'bottom' }; }
  },
  runInPlace: {
    name: 'Correndo (no lugar)', cat: 'Movimento', dur: 1.5, sound: '', hint: 'Corre sem sair do lugar, inclinado para frente — use com linhas de corrida e o fundo passando.',
    params: [{ k: 'steps', l: 'Passos por segundo', min: 1, max: 14, step: .5, def: 7 }, { k: 'height', l: 'Altura', min: 0, max: 80, def: 22, unit: 'px' }, { k: 'lean', l: 'Inclinar', min: -30, max: 30, def: 9, unit: '°' }],
    fn(p, P, x) { const ph = x.t * P.steps, up = Math.abs(Math.sin(ph * Math.PI)); return { dy: -P.height * up, rot: P.lean + 2 * Math.sin(ph * Math.PI * 2), sy: 1 - .05 * (1 - up), sx: 1 + .04 * (1 - up), pivot: 'bottom' }; }
  },
  hopJoy: {
    name: 'Pulo com antecipação', cat: 'Movimento', dur: .7, sound: 'boing', soundDefault: 'off', hint: 'Agacha (antecipação), pula esticando e cai amassando — pulo de alegria/ideia.',
    params: [{ k: 'height', l: 'Altura', min: 0, max: 400, def: 120, unit: 'px' }, { k: 'squash', l: 'Amassar', min: 0, max: .4, step: .01, def: .16 }],
    fn(p, P) {
      let dy = 0, sx = 1, sy = 1;
      if (p < .18) { const u = Ease.out(p / .18); sy = 1 - P.squash * u; sx = 1 + P.squash * .7 * u; }
      else if (p < .78) { const u = (p - .18) / .6, h = 4 * u * (1 - u); dy = -P.height * h; sy = 1 + P.squash * .6 * (1 - u * 1.5); sx = 1 - P.squash * .3 * (1 - u * 1.5); }
      else { const u = (p - .78) / .22, k = Math.sin(u * Math.PI); sy = 1 - P.squash * .8 * k; sx = 1 + P.squash * .5 * k; }
      return { dy, sx, sy, pivot: 'bottom' };
    }
  },
  angryShake: {
    name: 'Tremer de raiva', cat: 'Movimento', dur: 1, sound: '', hint: 'Treme rápido e "estufa" — grito, raiva, exigência.',
    params: [{ k: 'amp', l: 'Intensidade', min: 0, max: 60, def: 10, unit: 'px' }, { k: 'grow', l: 'Estufar', min: 0, max: .3, step: .01, def: .06 }],
    fn(p, P, x) { const f = Math.floor(x.t * 40), k = Math.min(1, p * 6); return { dx: (hash(f) * 2 - 1) * P.amp * k, dy: (hash(f + 50) * 2 - 1) * P.amp * .6 * k, rot: (hash(f + 9) * 2 - 1) * 1.5 * k, sx: 1 + P.grow * k, sy: 1 + P.grow * k }; }
  },
  headTalk: {
    name: 'Balançar falando', cat: 'Movimento', dur: 3, sound: '', hint: 'Inclina de um lado pro outro devagar enquanto fala (bom na cabeça ou no corpo todo).',
    params: [{ k: 'angle', l: 'Ângulo', min: 0, max: 20, step: .5, def: 3.5, unit: '°' }, { k: 'speed', l: 'Velocidade', min: .2, max: 4, step: .1, def: 1.3 }],
    fn(p, P, x) { return { rot: P.angle * Math.sin(x.t * P.speed * Math.PI * 2) * Math.min(1, x.t * 4), dy: -4 * Math.abs(Math.sin(x.t * P.speed * Math.PI * 2)) }; }
  },
  pendulum: {
    name: 'Pêndulo (braço balançando)', cat: 'Movimento', dur: 2, sound: '', hint: 'Gira para lá e para cá em volta do pivô — braço, rabo, placa pendurada. Ajuste o pivô (ombro) na aba Posição → Boneco.',
    params: [{ k: 'angle', l: 'Ângulo', min: 0, max: 90, def: 12, unit: '°' }, { k: 'speed', l: 'Vezes por segundo', min: .2, max: 8, step: .1, def: 1.4 }, { k: 'base', l: 'Ângulo base', min: -180, max: 180, def: 0, unit: '°' }],
    fn(p, P, x) { return { rot: P.base + P.angle * Math.sin(x.t * P.speed * Math.PI * 2) }; }
  },
  wave: {
    name: 'Acenar / apontar', cat: 'Movimento', dur: 1.2, sound: '', hint: 'Levanta (gira no pivô) até o ângulo, balança e segura — braço apontando ou dando tchau.',
    params: [{ k: 'angle', l: 'Ângulo final', min: -180, max: 180, def: -60, unit: '°' }, { k: 'wiggle', l: 'Balançar', min: 0, max: 30, def: 6, unit: '°' }, { k: 'back', l: 'Voltar no fim', type: 'bool', def: true }],
    fn(p, P, x) {
      const inT = Math.min(1, x.t / .14), outK = P.back ? (p > .82 ? 1 - Ease.inOut((p - .82) / .18) : 1) : 1;
      const r = P.angle * Ease.back(inT) * outK + (inT >= 1 ? P.wiggle * Math.sin((x.t - .14) * 14) * Math.exp(-(x.t - .14) * 2.5) * outK : 0);
      return { rot: r };
    }
  },
  whipIn: {
    name: 'Entrar com borrão (whip)', cat: 'Entrada', dur: .22, sound: 'swoosh', hold: 'before', hint: 'Entra muito rápido de lado com borrão e para seco (4–8 quadros).',
    params: [{ k: 'dir', l: 'Vem da', type: 'select', opts: { left: 'Esquerda', right: 'Direita', up: 'Cima', down: 'Baixo' }, def: 'right' }, { k: 'dist', l: 'Distância', min: 0, max: 3000, def: 900, unit: 'px' }],
    fn(p, P) { const v = 1 - Ease.out(p), o = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[P.dir] || [1, 0]; return { dx: o[0] * P.dist * v, dy: o[1] * P.dist * v, sx: 1 + (o[0] ? .25 * v : 0), sy: 1 + (o[1] ? .25 * v : 0), op: Math.min(1, p * 5) }; }
  },
  dropSky: {
    name: 'Cair do céu', cat: 'Entrada', dur: .5, sound: 'thud', soundDefault: 'off', hold: 'before', hint: 'Cai de cima, amassa no chão e volta (objetos, placas, a etiqueta de preço…).',
    params: [{ k: 'dist', l: 'Altura', min: 0, max: 3000, def: 1400, unit: 'px' }],
    fn(p, P) { if (p < .55) { const u = Ease.in(p / .55); return { dy: -P.dist * (1 - u), sy: 1 + .15 * u, sx: 1 - .08 * u, pivot: 'bottom' }; } const u = (p - .55) / .45, k = Math.sin(u * Math.PI) * (1 - u * .4); return { sy: 1 - .22 * k, sx: 1 + .18 * k, pivot: 'bottom' }; }
  },
});

/* ---------- efeitos novos ---------- */
Object.assign(FX, {
  motionBlur: {
    name: 'Borrão de movimento', cat: 'Imagem', dur: .25, sound: '', hint: 'Rastro na direção do movimento (sem desfocar tudo) — use só nos quadros rápidos, nunca no "hold".',
    params: [{ k: 'angle', l: 'Direção', min: 0, max: 360, def: 0, unit: '°' }, { k: 'amount', l: 'Tamanho do rastro', min: 0, max: 400, def: 90, unit: 'px' }, { k: 'anim', l: 'Animar', type: 'select', opts: { none: 'Fixo', in: 'Aumentar', out: 'Diminuir', both: 'Aumentar e diminuir' }, def: 'out' }],
    apply(c, cv, P, x) {
      const k = animK(P.anim, x.p), L = P.amount * k * x.q; if (L < 1) return;
      const src = x.copy(cv), a = P.angle * Math.PI / 180, n = Math.min(14, Math.max(4, Math.round(L / 10))), dx = Math.cos(a) * L, dy = Math.sin(a) * L;
      c.clearRect(0, 0, cv.width, cv.height);
      for (let i = 0; i < n; i++) { const u = i / (n - 1) - .5; c.globalAlpha = 1 / n * 1.6; c.drawImage(src, dx * u, dy * u); }
      c.globalAlpha = .45; c.drawImage(src, 0, 0); c.globalAlpha = 1;
    }
  },
  chuva: {
    name: 'Nuvem de chuva', cat: 'Personagem', dur: 2, sound: '', clipOnly: true, hint: 'Nuvenzinha cinza chovendo em cima do personagem (tristeza, vergonha, "deu ruim").',
    params: [{ k: 'size', l: 'Tamanho', min: 40, max: 800, def: 260, unit: 'px' }, { k: 'drops', l: 'Gotas', min: 4, max: 60, step: 1, def: 18 }, { k: 'speed', l: 'Velocidade', min: .2, max: 4, step: .1, def: 1.4 }, { k: 'color', l: 'Cor da nuvem', type: 'color', def: '#8c93a8' }, { k: 'up', l: 'Altura', min: -1, max: 1, step: .01, def: .02 }],
    apply(c, cv, P, x) {
      const b = x.bounds || { x: cv.width * .3, y: cv.height * .3, w: cv.width * .4, h: cv.height * .4 }, q = x.q || 1, S = P.size * q;
      const pop = x.t < .2 ? Ease.back(x.t / .2) : 1, cx = b.x + b.w / 2, cy = b.y + b.h * (P.up ?? .02) - S * .1;
      c.save(); c.globalCompositeOperation = 'source-over';
      // gotas (atrás da nuvem)
      c.strokeStyle = '#7fc8ff'; c.lineCap = 'round'; c.lineWidth = Math.max(2, S * .025);
      const fall = Math.max(S * 1.2, b.h * .55);
      for (let i = 0; i < P.drops; i++) { const ph = (x.t * P.speed + hash(i + 3)) % 1, px = cx + (hash(i + 11) - .5) * S * .9, py = cy + S * .15 + ph * fall; c.globalAlpha = (1 - ph) * .9 * pop; c.beginPath(); c.moveTo(px, py); c.lineTo(px - S * .02, py + S * .1); c.stroke(); }
      c.globalAlpha = 1; c.translate(cx, cy + Math.sin(x.t * 3) * S * .02); c.scale(pop, pop);
      c.fillStyle = P.color; c.strokeStyle = '#3a3f52'; c.lineWidth = S * .03;
      const blobs = [[-.3, .02, .2], [-.1, -.08, .26], [.15, -.04, .23], [.33, .04, .17], [0, .08, .22]];
      c.beginPath(); blobs.forEach(([bx, by, r]) => { c.moveTo(bx * S + r * S, by * S); c.arc(bx * S, by * S, r * S, 0, 7); }); c.fill();
      c.globalCompositeOperation = 'destination-over'; c.stroke(); c.globalCompositeOperation = 'source-over';
      c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(-.12 * S, -.14 * S, .1 * S, 0, 7); c.fill();
      c.restore();
    }
  },
  speedStreaks: {
    name: 'Linhas de corrida', cat: 'Clássicos', dur: 1, sound: '', hint: 'Riscos atravessando a tela na horizontal (correndo, passando rápido, destaque).',
    params: [{ k: 'count', l: 'Quantidade', min: 3, max: 80, step: 1, def: 18 }, { k: 'color', l: 'Cor', type: 'color', def: '#ffffff' }, { k: 'dir', l: 'Para', type: 'select', opts: { left: 'Esquerda', right: 'Direita' }, def: 'left' }, { k: 'speed', l: 'Velocidade', min: .5, max: 10, step: .1, def: 3.5 }, { k: 'opacity', l: 'Opacidade', min: 0, max: 100, def: 70, unit: '%' }, { k: 'thick', l: 'Espessura', min: 1, max: 30, def: 6, unit: 'px' }],
    apply(c, cv, P, x) {
      const W = cv.width, H = cv.height, sg = P.dir === 'right' ? 1 : -1, q = x.q || 1;
      c.save(); c.globalCompositeOperation = 'source-over'; c.strokeStyle = P.color; c.lineCap = 'round';
      for (let i = 0; i < P.count; i++) {
        const y = hash(i + 1) * H, len = (.15 + hash(i + 7) * .35) * W, ph = (x.t * P.speed * (.6 + hash(i + 3) * .8) + hash(i + 9)) % 1;
        const x0 = sg > 0 ? -len + ph * (W + len * 2) : W + len - ph * (W + len * 2);
        c.globalAlpha = P.opacity / 100 * (.5 + .5 * hash(i + 5)); c.lineWidth = Math.max(1, P.thick * q * (.5 + hash(i + 13)));
        c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 - sg * len, y); c.stroke();
      }
      c.restore();
    }
  },
  raios: {
    name: 'Raios girando (fundo)', cat: 'Clássicos', dur: 2, sound: '', hint: 'Raios de "conquista" saindo do centro, girando devagar (estilo cartum). Bom atrás do personagem.',
    params: [{ k: 'count', l: 'Raios', min: 4, max: 48, step: 1, def: 18 }, { k: 'color', l: 'Cor', type: 'color', def: '#fff3a6' }, { k: 'opacity', l: 'Opacidade', min: 0, max: 100, def: 45, unit: '%' }, { k: 'speed', l: 'Giro', min: -60, max: 60, def: 12, unit: '°/s' }, { k: 'cx', l: 'Centro X', min: 0, max: 100, def: 50, unit: '%' }, { k: 'cy', l: 'Centro Y', min: 0, max: 100, def: 45, unit: '%' }],
    apply(c, cv, P, x) {
      const W = cv.width, H = cv.height, cx = W * P.cx / 100, cy = H * P.cy / 100, R = Math.hypot(W, H), n = P.count, rot = (x.t * P.speed) * Math.PI / 180, pop = Math.min(1, x.t / .15);
      c.save(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = P.opacity / 100 * pop; c.fillStyle = P.color; c.beginPath();
      for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2, w = Math.PI / n * .55; c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a - w) * R, cy + Math.sin(a - w) * R); c.lineTo(cx + Math.cos(a + w) * R, cy + Math.sin(a + w) * R); c.closePath(); }
      c.fill(); c.restore();
    }
  },
  vidro: {
    name: 'Reflexo de vidro (vitrine)', cat: 'Imagem', dur: 2, sound: '', hint: 'Faixas de reflexo + leve azulado, como se a gente olhasse por uma vitrine/janela.',
    params: [{ k: 'amount', l: 'Força', min: 0, max: 100, def: 55, unit: '%' }, { k: 'move', l: 'Reflexo andando', min: 0, max: 200, def: 30, unit: 'px/s' }, { k: 'frame', l: 'Moldura', min: 0, max: 120, def: 0, unit: 'px' }],
    apply(c, cv, P, x) {
      const W = cv.width, H = cv.height, a = P.amount / 100, q = x.q || 1, off = x.t * P.move * q;
      c.save(); c.globalCompositeOperation = 'source-over';
      c.fillStyle = `rgba(170,215,255,${.12 * a})`; c.fillRect(0, 0, W, H);
      c.translate(W / 2, H / 2); c.rotate(-.42); c.fillStyle = '#ffffff';
      [[-.55, .09, .32], [-.38, .035, .22], [.12, .12, .2], [.32, .04, .14]].forEach(([px, w, al]) => { c.globalAlpha = al * a; c.fillRect((px * W) + off - W * .05, -H, w * W, H * 2); });
      c.restore();
      if (P.frame > 0) { const f = P.frame * q; c.save(); c.fillStyle = '#232046'; c.fillRect(0, 0, W, f); c.fillRect(0, H - f, W, f); c.fillRect(0, 0, f, H); c.fillRect(W - f, 0, f, H); c.restore(); }
    }
  },
  dinheiroChuva: {
    name: 'Chuva de dinheiro', cat: 'Clássicos', dur: 1.5, sound: '', hint: 'Notas e moedas caindo pela tela (desenhadas aqui mesmo).',
    params: [{ k: 'count', l: 'Quantidade', min: 4, max: 80, step: 1, def: 26 }, { k: 'speed', l: 'Velocidade', min: .2, max: 3, step: .1, def: 1 }, { k: 'size', l: 'Tamanho', min: 20, max: 300, def: 110, unit: 'px' }],
    apply(c, cv, P, x) {
      const W = cv.width, H = cv.height, q = x.q || 1;
      c.save(); c.globalCompositeOperation = 'source-over';
      for (let i = 0; i < P.count; i++) {
        const ph = (x.t * P.speed * (.7 + hash(i + 2) * .6) + hash(i + 8) * .6), y = -P.size * q * 2 + ph * (H + P.size * q * 4), px = hash(i + 4) * W + Math.sin(x.t * 2 + i) * 30 * q;
        if (y > H + P.size * q) continue;
        const s = P.size * q * (.6 + hash(i + 6) * .6), r = x.t * (2 + hash(i) * 4) + i;
        c.save(); c.translate(px, y); c.rotate(Math.sin(r) * .7); c.scale(1, .55 + .45 * Math.abs(Math.cos(r * 1.3)));
        if (i % 3 === 0) { c.fillStyle = '#ffd23d'; c.strokeStyle = '#a8740b'; c.lineWidth = s * .07; c.beginPath(); c.arc(0, 0, s * .28, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#fff3a8'; c.font = `900 ${s * .3}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 0, 1); }
        else { c.fillStyle = '#3fbf6b'; c.strokeStyle = '#1d6b38'; c.lineWidth = s * .05; c.fillRect(-s * .5, -s * .25, s, s * .5); c.strokeRect(-s * .5, -s * .25, s, s * .5); c.fillStyle = '#bff2cf'; c.beginPath(); c.arc(0, 0, s * .14, 0, 7); c.fill(); c.fillStyle = '#1d6b38'; c.font = `900 ${s * .2}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 0, 1); }
        c.restore();
      }
      c.restore();
    }
  },
});

/* ---------- transição chicote ---------- */
TRANS.whip = {
  name: 'Chicote (whip)', dur: .2, sound: 'swoosh', params: [{ k: 'dir', l: 'Direção', type: 'select', opts: { left: 'Para a esquerda', right: 'Para a direita', up: 'Para cima', down: 'Para baixo' }, def: 'left' }],
  draw(d, s, v, P, x) {
    const W = s.width, H = s.height, e = 1 - v, o = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[P.dir || 'left'];
    // a cena chega deslizando muito rápido, com rastro (borrão) que some no fim
    const L = e * (o[0] ? W : H) * .35, n = e > .02 ? 8 : 1, bx = -o[0] * W * e * .6, by = -o[1] * H * e * .6;
    const a0 = d.globalAlpha;
    for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) - .5 : 0; d.globalAlpha = a0 * (n > 1 ? 1.7 / n : 1) * Math.min(1, v * 3); d.drawImage(s, bx + o[0] * L * u, by + o[1] * L * u); }
    d.globalAlpha = a0;
  },
};

/* ---------- separar sprites automaticamente ----------
   Acha cada desenho pelo transparente (ou pela cor do fundo), junta enfeites pequenos (?, !, estrelinhas, lágrimas)
   no desenho mais perto e separa desenhos encostados pelo "vale" (onde quase não tem tinta). */
const SpriteSplit = {
  async analyze(img, o = {}) {
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H).data, on = new Uint8Array(W * H);
    let transparent = 0; for (let i = 3; i < d.length; i += 4 * 97) if (d[i] < 20) transparent++;
    const useAlpha = transparent > (d.length / 4 / 97) * .05;
    const bg = [d[0], d[1], d[2]], tol = o.tol ?? 40;
    for (let i = 0; i < W * H; i++) { const k = i * 4; on[i] = useAlpha ? (d[k + 3] > 20 ? 1 : 0) : (Math.abs(d[k] - bg[0]) + Math.abs(d[k + 1] - bg[1]) + Math.abs(d[k + 2] - bg[2]) > tol ? 1 : 0); }
    // rótulos (8 vizinhos, com 1 px de folga)
    const lab = new Int32Array(W * H), comps = []; let n = 0; const st = new Int32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (!on[i] || lab[i]) continue; n++; let sp = 0; st[sp++] = i; lab[i] = n; let x0 = W, y0 = H, x1 = 0, y1 = 0, area = 0;
      while (sp) { const p = st[--sp], x = p % W, y = (p / W) | 0; area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = yy * W + xx; if (on[q] && !lab[q]) { lab[q] = n; st[sp++] = q; } } }
      comps.push({ ids: [n], area, box: [x0, y0, x1, y1] });
    }
    const big = Math.max(...comps.map(c => c.area), 1), attach = o.juntar === false ? 0 : (o.attach ?? .08);
    let mains = comps.filter(c => c.area >= big * attach), smalls = comps.filter(c => c.area < big * attach && c.area > 30);
    const dist = (a, b) => { const dx = Math.max(0, a[0] - b[2], b[0] - a[2]), dy = Math.max(0, a[1] - b[3], b[1] - a[3]); return Math.hypot(dx, dy); };
    for (const s of smalls) { const best = mains.reduce((m, c) => dist(c.box, s.box) < dist(m.box, s.box) ? c : m, mains[0]); if (best && dist(best.box, s.box) <= (o.near ?? Math.max(W, H) * .07)) { best.ids.push(...s.ids); best.box = [Math.min(best.box[0], s.box[0]), Math.min(best.box[1], s.box[1]), Math.max(best.box[2], s.box[2]), Math.max(best.box[3], s.box[3])]; } else if (s.area > 300) mains.push(s); }
    // vales: separa desenhos encostados lado a lado / um em cima do outro
    const split = (c) => {
      const [x0, y0, x1, y1] = c.box, w = x1 - x0 + 1, h = y1 - y0 + 1, ids = new Set(c.ids), colc = new Float32Array(w), rowc = new Float32Array(h);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (ids.has(lab[y * W + x])) { colc[x - x0]++; rowc[y - y0]++; }
      const cuts = (cov, L) => { const mx = Math.max(...cov), lim = Math.max(2, mx * .05), out = []; let i = 60; while (i < L - 60) { if (cov[i] <= lim) { let j = i; while (j < L - 60 && cov[j] <= lim) j++; let l = 0, r = 0; for (let k = Math.max(0, i - 40); k < i; k++) l = Math.max(l, cov[k]); for (let k = j; k < Math.min(L, j + 40); k++) r = Math.max(r, cov[k]); if (l >= mx * .4 && r >= mx * .4) out.push((i + j) >> 1); i = j + 60; } else i++; } return out; };
      const cx = [0, ...cuts(colc, w), w], cy = [0, ...cuts(rowc, h), h], out = [];
      for (let a = 0; a < cy.length - 1; a++) for (let b = 0; b < cx.length - 1; b++) out.push({ ids: c.ids, box: [x0 + cx[b], y0 + cy[a], x0 + cx[b + 1] - 1, y0 + cy[a + 1] - 1] });
      return out;
    };
    let parts = mains.flatMap(split);
    // muito alto (duas poses empilhadas e encostadas): corta na linha das outras fileiras
    if (attach > 0 && parts.length > 2) {
      const hs = parts.map(p => p.box[3] - p.box[1]).sort((a, b) => a - b), med = hs[hs.length >> 1];
      for (const e of [...parts]) { const [x0, y0, x1, y1] = e.box; if (y1 - y0 <= med * 1.6) continue; const others = parts.filter(p => p !== e && p.box[1] > y0 + med * .5 && p.box[1] < y1 - med * .5); if (!others.length) continue; const yc = Math.min(...others.map(p => p.box[1])) + 3; parts.splice(parts.indexOf(e), 1, { ids: e.ids, box: [x0, y0, x1, yc - 1] }, { ids: e.ids, box: [x0, yc, x1, y1] }); }
    }
    // aperta a caixa no desenho de verdade
    parts = parts.map(p => { const ids = new Set(p.ids); let [x0, y0, x1, y1] = p.box, a = W, b = H, c2 = 0, d2 = 0, cnt = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (ids.has(lab[y * W + x])) { cnt++; if (x < a) a = x; if (x > c2) c2 = x; if (y < b) b = y; if (y > d2) d2 = y; } return cnt > 200 ? { ids: p.ids, box: [a, b, c2, d2] } : null; }).filter(Boolean);
    const rowH = Math.max(1, (parts.map(p => p.box[3] - p.box[1]).sort((a, b) => a - b)[parts.length >> 1] || 1) * .5);
    parts.sort((a, b) => Math.round((a.box[1] + a.box[3]) / 2 / rowH) - Math.round((b.box[1] + b.box[3]) / 2 / rowH) || a.box[0] - b.box[0]);
    return { W, H, lab, parts, useAlpha, d, cv };
  },
  async run(asset, o = {}) {
    const rt = Assets.get(asset.id); if (!rt?.img) return UI.toast('Só funciona com imagens.', { kind: 'warn' });
    const t = UI.toast('<span class="spin-dot"></span> Separando os sprites…', { time: 120000 });
    await new Promise(r => setTimeout(r, 30));
    try {
      const A = await this.analyze(rt.img, o), pad = 4, base = asset.name.replace(/\.[^.]+$/, '');
      if (!A.parts.length) { t.remove(); return UI.toast('Não achei desenhos separados nessa imagem.', { kind: 'warn' }); }
      const fname = o.pasta || base + ' (sprites)'; App.project.folders ||= []; App.project.assetFolders ||= {};
      let fo = App.project.folders.find(f => f.name === fname); if (!fo) { fo = { id: uid('f_'), name: fname }; App.project.folders.push(fo); }
      const folder = fo.id;
      const made = [];
      for (let i = 0; i < A.parts.length; i++) {
        const p = A.parts[i], ids = new Set(p.ids), x0 = Math.max(0, p.box[0] - pad), y0 = Math.max(0, p.box[1] - pad), x1 = Math.min(A.W - 1, p.box[2] + pad), y1 = Math.min(A.H - 1, p.box[3] + pad), w = x1 - x0 + 1, h = y1 - y0 + 1;
        const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = (y0 + y) * A.W + (x0 + x), k = q * 4, j = (y * w + x) * 4; const keep = ids.has(A.lab[q]) || (A.lab[q] === 0 && A.useAlpha && A.d[k + 3] > 0 && near(A, q, ids)); if (!keep) continue; im.data[j] = A.d[k]; im.data[j + 1] = A.d[k + 1]; im.data[j + 2] = A.d[k + 2]; im.data[j + 3] = A.useAlpha ? A.d[k + 3] : 255; }
        g.putImageData(im, 0, 0);
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        const nm = (o.nomes?.[i] || `${base} ${String(i + 1).padStart(2, '0')}`) + '.png';
        const r2 = await Assets.addBlob(blob, nm, App.project.id, 'image'); made.push(r2.meta.id);
        if (folder && App.project.assetFolders) App.project.assetFolders[r2.meta.id] = folder;
      }
      t.remove(); App.commit(`${made.length} sprite(s) separados de "${asset.name}"`, { toast: true }); App.onAssetsChanged?.();
      return made;
    } catch (e) { t.remove(); UI.toast('Não deu para separar: ' + (e.message || e), { kind: 'err' }); return []; }
    function near(A, q, ids) { const W = A.W, x = q % W, y = (q / W) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < A.H && ids.has(A.lab[yy * W + xx])) return true; } return false; }
  },
  async dialog(asset) {
    const f = h(`<div class="fgrid"><p class="full" style="margin:0">Corta cada desenho da folha numa imagem separada (sem fundo), numa pasta nova. Enfeites pequenos perto do desenho (?, !, lágrimas, estrelinhas) vão junto com ele.</p>
      <label class="field full">Nome da pasta<input data-k="pasta" value="${esc(asset.name.replace(/\.[^.]+$/, ''))} (sprites)"></label>
      <label class="switch full"><input type="checkbox" data-k="juntar" checked><i></i>Juntar enfeites pequenos no desenho mais perto (desligue em folhas de cenário/objetos)</label></div>`);
    const o = await UI.modal({ title: 'Separar sprites automaticamente', icon: 'crop', width: 480, body: f, buttons: [{ label: 'Cancelar', value: null }, { label: 'Separar', kind: 'primary', collect: () => Actions.readForm(f) }] });
    if (o) this.run(asset, { pasta: o.pasta, juntar: o.juntar !== false && o.juntar !== 'false' });
  },
};

/* ---------- painel "Boneco" (aba Posição) ---------- */
const RigUI = {
  section(Pr, body, c) {
    if (!['image', 'gif', 'video', 'text', 'shape'].includes(c.type)) return;
    const s = Pr.sec(body, 'Boneco (partes que se mexem juntas)');
    s.appendChild(h(`<div class="hint">Recorte o personagem em partes (corpo, braço, boca, olhos) e prenda cada parte no corpo: tudo que o corpo fizer, a parte faz junto. Gire a parte pelo <b>pivô</b> (ex.: ombro).</div>`));
    const others = App.project.clips.filter(x => x.id !== c.id && ['image', 'gif', 'video', 'shape', 'text'].includes(x.type) && x.start < c.start + c.dur && x.start + x.dur > c.start && !isAncestor(x, c));
    const opts = { '': '— solto —' }; others.forEach(x => opts[x.id] = (x.name || Assets.meta(x.assetId)?.name || x.type).slice(0, 34));
    const g = h('<div class="grid2"></div>');
    g.appendChild(Pr.select('Preso a', opts, c.parent || '', v => { if (v) c.parent = v; else delete c.parent; App.commit(v ? 'Parte presa' : 'Parte solta'); }));
    g.appendChild(Pr.select('Mostrar só quando', { '': 'Sempre', ...VIS_MODES }, c.vis?.modo || '', v => { if (v) c.vis = { ...(c.vis || {}), modo: v }; else delete c.vis; App.commit('Visibilidade automática'); }));
    s.appendChild(g);
    s.appendChild(Pr.slider(c, { l: 'Pivô X (giro)', get: () => (c.tr.ax ?? .5) * 100, set: v => c.tr.ax = clamp(v / 100, -1, 2), min: -50, max: 150, def: 50, unit: '%', kf: false }));
    s.appendChild(Pr.slider(c, { l: 'Pivô Y (giro)', get: () => (c.tr.ay ?? .5) * 100, set: v => c.tr.ay = clamp(v / 100, -1, 2), min: -50, max: 150, def: 50, unit: '%', kf: false }));
    if (c.vis?.modo === 'piscar' || c.vis?.modo === 'naoPiscar') s.appendChild(Pr.slider(c, { l: 'Pisca a cada', get: () => c.vis.cada || 3.2, set: v => c.vis.cada = clamp(v, .8, 20), min: .8, max: 10, step: .1, def: 3.2, unit: 's', kf: false }));
    if (c.vis?.modo === 'fala' || c.vis?.modo === 'calado') s.appendChild(Pr.slider(c, { l: 'Sensibilidade da boca', get: () => c.vis.limite ?? .3, set: v => c.vis.limite = clamp(v, .05, 1), min: .05, max: 1, step: .01, def: .3, kf: false }));
  },
};
function isAncestor(a, c) { let p = a, k = 0; while (p && p.parent && k++ < 8) { if (p.parent === c.id) return true; p = curProjClip(p.parent); } return false; }

(() => {
  // aba Posição ganha a seção "Boneco"
  if (typeof Props !== 'undefined' && Props.tabBasic) { const tb = Props.tabBasic; Props.tabBasic = function (body, c) { tb.call(this, body, c); try { RigUI.section(this, body, c); } catch (e) { console.warn(e); } }; }
})();
