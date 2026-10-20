/* ===================== extras.js — ferramentas da edição "Shorts do Problems" =====================
   Tudo o que foi usado na edição feita fora do editor e que faltava aqui:
   • Limpar voz: tira as pausas, filtra grave, comprime e normaliza (e ajusta o resto da linha do tempo)
   • Gerar música de fundo (sintetizada aqui mesmo, sem direitos autorais) já abaixando com a voz
   • Balançar com a voz (o personagem "respira" no volume da fala)
   • Estrelinhas (explosão de estrelas), entrada girando (rollIn), sons riser e brilho
   • Moldura em círculo (selo) para quem é citado — ex.: Problems no círculo ciano
   • Baixar a transcrição em .srt / .txt */
'use strict';

/* ---------- sons novos ---------- */
(() => {
  const SR = SOUNDS.SR, D = SOUNDS.defs;
  D.riser = { name: 'Subida (riser)', sec: .55, f: (d, n) => { let y = 0, y2 = 0; for (let i = 0; i < n; i++) { const t = i / n, x = Math.random() * 2 - 1; y += .9 * (x - y); y2 = x - y; d[i] = y2 * t * t * (1 - Math.max(0, t - .92) / .08); } } };
  D.sparkle = { name: 'Brilho (estrelinhas)', sec: .75, f: (d, n) => { [1568, 2093, 2637, 3136, 4186].forEach((fr, k) => { const s = Math.floor(k * .045 * SR); for (let i = s; i < n; i++) { const t = (i - s) / SR; d[i] += (Math.sin(2 * Math.PI * fr * t) + .3 * Math.sin(2 * Math.PI * fr * 2.01 * t)) * Math.exp(-t * 9) * .3; } }); } };
  D.thump = { name: 'Impacto grave', sec: .35, f: (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, fr = 120 * Math.exp(-t * 12) + 45; ph += 2 * Math.PI * fr / SR; d[i] = Math.tanh(2 * Math.sin(ph) * Math.exp(-t * 11)); } } };
})();

(() => {
  const SR = SOUNDS.SR, D = SOUNDS.defs;
  D.beep = { name: 'Beep (censura)', sec: .5, f: (d, n) => { for (let i = 0; i < n; i++) d[i] = Math.sin(2 * Math.PI * 1000 * i / SR) * Math.min(1, i / 200, (n - i) / 200); } };
  D.gasp = { name: 'Gasp (susto)', sec: .45, f: (d, n) => { let y = 0; for (let i = 0; i < n; i++) { const t = i / n, x = Math.random() * 2 - 1; y += .25 * (x - y); d[i] = y * Math.sin(Math.PI * Math.min(1, t * 1.6)) * (1 - t) * (1 + .5 * Math.sin(2 * Math.PI * 300 * i / SR)); } } };
  D.rewind = { name: 'Rebobinar', sec: .6, f: (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / n, fr = 1800 - 1500 * t + 200 * Math.sin(t * 90); ph += 2 * Math.PI * fr / SR; d[i] = (Math.sign(Math.sin(ph)) * .4 + (Math.random() * 2 - 1) * .2) * Math.min(1, t * 10, (1 - t) * 6); } } };
})();

/* "modo sério": sombra/escuro para a tensão falsa (tire na hora da piada) */
FX.modoSerio = {
  name: 'Modo sério (tensão)', cat: 'Clássicos', dur: 2, sound: '', hint: 'Escurece a tela e as bordas (clima sério/dramático). Na piada, termine o efeito: a cor limpa volta e vende o contraste.',
  params: [{ k: 'amount', l: 'Força', min: 0, max: 100, def: 65, unit: '%' }],
  apply(c, cv, P, x) {
    const a = P.amount / 100, W = cv.width, H = cv.height, inn = Math.min(1, (x.t ?? 1) / .15);
    c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = `rgba(70,60,110,${.55 * a * inn})`; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
    const g = c.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .25, W / 2, H / 2, Math.hypot(W, H) * .6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(5,0,20,${.75 * a * inn})`); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
  },
};

/* ---------- animações ---------- */
Object.assign(ANIMS, {
  voiceBounce: {
    name: 'Balançar com a voz', cat: 'Movimento', dur: 5, sound: '', hint: 'O personagem estica e balança no volume da fala (segue o áudio de voz).',
    params: [{ k: 'amount', l: 'Força', min: 0, max: .15, step: .005, def: .014 }, { k: 'sway', l: 'Balanço', min: 0, max: 6, step: .1, def: .9, unit: '°' }],
    fn(p, P, x) {
      const c = x.clip; let v = 0;
      if (c && typeof AudioAnalysis !== 'undefined') {
        const t = c.start + (x.t ?? 0) + (x.anim?.start ?? (c.anims || []).find(a => a.type === 'voiceBounce')?.start ?? 0);
        for (const ac of AudioAnalysis.sources()) {
          if (t < ac.start || t > ac.start + ac.dur) continue;
          const e = Mouth.env(ac); if (!e) continue; const i = Math.floor((t - e.start) * e.rate);
          v = Math.max(v, Math.min(1.2, ((e.env[i] || 0) + (e.env[i - 1] || 0) * .5 + (e.env[i + 1] || 0) * .5) / 2 / (e.p90 || 1)));
        }
      }
      const tt = x.t ?? 0;
      return { sy: 1 + P.amount * v + .005 * Math.sin(tt * 2.2), sx: 1 - P.amount * .55 * v, rot: P.sway * Math.sin(tt * 1.3), dy: -4 * v * (P.amount / .014), pivot: 'bottom' };
    }
  },
  rollIn: {
    name: 'Entrar girando', cat: 'Entrada', dur: .45, sound: 'boing', hold: 'before', hint: 'Entra rolando do lado, com mola no fim (ótimo para selo/moldura).',
    params: [{ k: 'dir', l: 'Vem da', type: 'select', opts: { right: 'Direita', left: 'Esquerda' }, def: 'right' }],
    fn(p, P, x) { const k = Ease.back(Math.min(1, p)), sg = P.dir === 'left' ? -1 : 1; return { dx: sg * (1 - k) * x.W * .4, rot: sg * (1 - k) * 200, sx: .1 + .9 * k, sy: .1 + .9 * k, op: Math.min(1, p * 4) }; }
  },
});

/* ---------- estrelinhas (explosão de estrelas em volta do personagem) ---------- */
FX.estrelinhas = {
  name: 'Estrelinhas (explosão)', cat: 'Personagem', dur: .7, sound: 'sparkle', clipOnly: true, hint: 'Estrelas saem voando do personagem — use em momentos importantes (quem é citado, conquista, piada).',
  params: [{ k: 'n', l: 'Quantidade', min: 4, max: 30, def: 12 }, { k: 'size', l: 'Tamanho', min: 6, max: 80, def: 26, unit: 'px' }, { k: 'color', l: 'Cor', type: 'color', def: '#fff58c' }],
  apply(c, cv, P, x) {
    const b = x.bounds || { x: cv.width * .3, y: cv.height * .3, w: cv.width * .4, h: cv.height * .4 }, q = x.q || 1, u = x.p ?? 0, cx = b.x + b.w / 2, cy = b.y + b.h * .45;
    const R = Math.max(b.w, b.h) * .75, n = Math.round(P.n);
    c.save(); c.fillStyle = P.color; c.globalAlpha = Math.max(0, 1 - u);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + hash(i) * .6, sp = .6 + hash(i + 9) * .5, dist = R * sp * (1 - Math.exp(-u * 5)), r = P.size * q * (1 - u) * (.7 + hash(i + 3) * .6);
      const px = cx + Math.cos(a) * dist, py = cy + Math.sin(a) * dist * .8, rot = u * 8 + a;
      c.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * .42 : r, aa = rot + k * Math.PI / 5; c.lineTo(px + Math.cos(aa) * rr, py + Math.sin(aa) * rr); } c.closePath(); c.fill();
    }
    c.restore();
  },
};

/* ---------- moldura em círculo (selo) ---------- */
const Badge = {
  DEF: () => ({ on: true, cor: '#40e0f0', borda: '#ffffff', esp: 5, sombra: true }),
  // desenha a imagem dentro de um círculo com borda; b = caixa do clipe
  draw(c, el, s, b, bd) {
    const D = Math.min(b.w, b.h), cx = b.x + b.w / 2, cy = b.h > b.w ? b.y + D / 2 : b.y + b.h / 2, R = D / 2, ring = D * (bd.esp ?? 5) / 100;
    c.save();
    if (bd.sombra !== false) { c.save(); c.shadowColor = 'rgba(20,10,60,.45)'; c.shadowBlur = D * .05; c.shadowOffsetY = D * .03; c.beginPath(); c.arc(cx, cy, R + ring, 0, 7); c.fillStyle = bd.borda || '#fff'; c.fill(); c.restore(); }
    c.beginPath(); c.arc(cx, cy, R + ring, 0, 7); c.fillStyle = bd.borda || '#fff'; c.fill();
    c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fillStyle = bd.cor || '#40e0f0'; c.fill();
    c.clip();
    try { c.drawImage(el, s.sx, s.sy, s.sw, s.sh, b.x, b.y + (b.h > b.w ? D * .1 : 0), b.w, b.h); } catch { }
    c.restore();
  },
};

/* ---------- limpar voz: tira pausas + filtro + compressor + normaliza ---------- */
const VoiceClean = {
  // trechos com voz no buffer (em segundos do buffer)
  speech(buf, a, b, o = {}) {
    const sr = buf.sampleRate, ch = buf.getChannelData(0), ch2 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch, win = Math.round(sr * .01);
    const i0 = Math.floor(a * sr), i1 = Math.min(ch.length, Math.floor(b * sr)), rms = [];
    for (let i = i0; i < i1; i += win) { let s = 0, n = 0; for (let k = i; k < Math.min(i1, i + win); k += 2) { const v = (ch[k] + ch2[k]) / 2; s += v * v; n++; } rms.push(Math.sqrt(s / Math.max(1, n))); }
    const peak = Math.max(...rms, 1e-6), thr = peak * Math.pow(10, (o.db ?? -30) / 20), minSil = Math.round((o.minSil ?? .15) / .01), pad = o.pad ?? .05;
    const keep = []; let s = -1, quiet = 0;
    for (let i = 0; i <= rms.length; i++) {
      const on = i < rms.length && rms[i] > thr;
      if (on) { if (s < 0) s = i; quiet = 0; } else if (s >= 0) { quiet++; if (quiet >= minSil || i === rms.length) { keep.push([s * .01, (i - quiet + 1) * .01]); s = -1; quiet = 0; } }
    }
    const m = []; for (const [x, y] of keep) { const A = Math.max(0, a + x - pad), B = Math.min(b, a + y + pad); const l = m[m.length - 1]; if (l && A <= l[1]) l[1] = Math.max(l[1], B); else m.push([A, B]); }
    return m.filter(([x, y]) => y - x > .06);
  },
  async process(clip, o = {}) {
    const buf = Assets.audioBuffer(clip.assetId, Assets.ctx()); if (!buf) throw new Error('O áudio ainda não carregou.');
    const sp = clip.speed || 1, a = clip.offset || 0, b = Math.min(buf.duration, a + clip.dur * sp);
    const segs = o.cortar === false ? [[a, b]] : this.speech(buf, a, b, o);
    if (!segs.length) throw new Error('Não achei voz nesse áudio.');
    const sr = buf.sampleRate, nch = Math.min(2, buf.numberOfChannels), fade = Math.round(sr * .015);
    const total = segs.reduce((s, [x, y]) => s + Math.round((y - x) * sr), 0);
    const off = new OfflineAudioContext(nch, total + sr * .05 | 0, sr), cut = off.createBuffer(nch, total, sr);
    for (let c = 0; c < nch; c++) { const src = buf.getChannelData(c), dst = cut.getChannelData(c); let p = 0; for (const [x, y] of segs) { const i0 = Math.round(x * sr), n = Math.round((y - x) * sr); for (let i = 0; i < n; i++) { let g = 1; if (i < fade) g = i / fade; else if (i > n - fade) g = (n - i) / fade; dst[p + i] = (src[i0 + i] || 0) * g; } p += n; } }
    const s = off.createBufferSource(); s.buffer = cut;
    const hp = off.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 80;
    const cp = off.createDynamicsCompressor(); cp.threshold.value = -24; cp.ratio.value = 3; cp.attack.value = .005; cp.release.value = .08; cp.knee.value = 6;
    s.connect(hp); hp.connect(cp); cp.connect(off.destination); s.start();
    const out = await off.startRendering();
    // normaliza: fala média ≈ -16 dBFS, pico ≤ -1,5 dB
    let pk = 0, ss = 0, cnt = 0; for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; if (v > .01) { ss += v * v; cnt++; } } }
    const rms = Math.sqrt(ss / Math.max(1, cnt)), g = Math.min(Math.pow(10, -16 / 20) / Math.max(rms, 1e-5), Math.pow(10, -1.5 / 20) / Math.max(pk, 1e-5));
    for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= g; }
    return { out, segs, before: b - a, after: total / sr };
  },
  // aplica no clipe: novo áudio "(limpo)", e empurra o resto da linha do tempo para acompanhar os cortes
  async apply(clip, o = {}) {
    const m = Assets.meta(clip.assetId), { out, segs, before, after } = await this.process(clip, o);
    const name = (m?.name || 'Voz').replace(/\.[^.]+$/, '') + (o.cortar === false ? ' (voz melhorada).wav' : ' (sem pausas).wav');
    const rt = await Assets.addBlob(audioBufferToWav(out), name, App.project.id, 'audio');
    const sp = clip.speed || 1, a0 = clip.offset || 0, st = clip.start, oldEnd = clip.start + clip.dur;
    // mapa de tempo: tempo antigo da linha do tempo → tempo novo
    const map = t => { if (t <= st) return t; if (t >= oldEnd) return t - (before - after) / sp; let acc = 0; const src = a0 + (t - st) * sp; for (const [x, y] of segs) { if (src < x) return st + acc / sp; if (src <= y) return st + (acc + src - x) / sp; acc += y - x; } return st + acc / sp; };
    if (o.cortar !== false) for (const c of App.project.clips) { if (c === clip) continue; if (c.start >= st - 1e-3) { const ns = map(c.start), ne = map(c.start + c.dur); c.start = App.frame(ns); if (c.start + c.dur > ne && ['image', 'gif', 'text', 'shape', 'color', 'fx'].includes(c.type) && ne - ns > .1) c.dur = App.frame(ne - ns); } }
    if (o.cortar !== false) (App.project.markers || []).forEach(mk => { if (mk.t >= st) mk.t = App.frame(map(mk.t)); });
    clip.assetId = rt.meta.id; clip.offset = 0; clip.speed = 1; clip.dur = App.frame(after); clip.name = name.replace(/\.wav$/, '');
    if (clip.afx) clip.afx = { ...clip.afx };
    try { Transcribe.run(rt.meta.id, true); } catch { }
    return { id: rt.meta.id, before, after, pausas: Math.max(0, segs.length - 1) };
  },
  async dialog(clip) {
    const o = await UI.modal({ title: 'Limpar voz', icon: 'mic', width: 460, body: h(`<div><p style="margin-top:0">Deixa a fala mais dinâmica, como nos Shorts: <b>tira as pausas</b>, tira o grave/ruído de fundo, iguala o volume (compressor) e <b>normaliza</b>. O resto da linha do tempo anda junto com os cortes. Cria um áudio novo — o original continua na Mídia.</p>
      <label class="switch"><input type="checkbox" data-c checked><i></i>Tirar as pausas</label>
      <label class="field" style="margin-top:8px">Sensibilidade das pausas<select data-db><option value="-35">Só pausas bem silenciosas</option><option value="-30" selected>Normal</option><option value="-24">Corta mais (fala rápida)</option></select></label></div>`), buttons: [{ label: 'Cancelar', value: null }, { label: 'Limpar voz', kind: 'primary', collect: b => ({ cortar: $('[data-c]', b).checked, db: +$('[data-db]', b).value }) }] });
    if (!o) return;
    const busy = UI.toast('<span class="spin-dot"></span> Limpando a voz…', { time: 120000 });
    try { const r = await this.apply(clip, o); busy.remove(); App.commit('Voz limpa', { all: true }); UI.toast(`Voz limpa: ${fmtSec(r.before)} → ${fmtSec(r.after)}${r.pausas ? ` (${r.pausas} pausa(s) cortada(s))` : ''}. Transcrevendo de novo…`, { kind: 'ok', time: 4000 }); }
    catch (e) { busy.remove(); UI.toast(esc(e.message || e), { kind: 'err' }); }
  },
};

/* ---------- música de fundo gerada (sem direitos autorais) ---------- */
const MusicGen = {
  ESTILOS: { animada: 'Animada (pop alegre)', engracada: 'Engraçada (cartoon)', calma: 'Calma (fofa)', suspense: 'Suspense', acao: 'Ação / épica' },
  async make(o = {}) {
    const est = this.ESTILOS[o.estilo] ? o.estilo : 'animada', SR = 44100, dur = Math.max(4, Math.min(600, +o.duracao || 30));
    const bpm = +o.bpm || { animada: 128, engracada: 140, calma: 92, suspense: 84, acao: 150 }[est], beat = 60 / bpm;
    const P = { animada: [[261.6, [523.3, 659.3, 784, 659.3]], [196, [493.9, 587.3, 784, 587.3]], [220, [523.3, 659.3, 880, 659.3]], [174.6, [523.3, 698.5, 880, 698.5]]],
      engracada: [[261.6, [523.3, 659.3, 784, 1046.5]], [174.6, [440, 523.3, 698.5, 880]], [196, [493.9, 587.3, 784, 987.8]], [261.6, [659.3, 784, 1046.5, 784]]],
      calma: [[174.6, [440, 523.3, 659.3, 523.3]], [220, [440, 523.3, 659.3, 523.3]], [146.8, [440, 587.3, 698.5, 587.3]], [196, [493.9, 587.3, 784, 587.3]]],
      suspense: [[110, [220, 261.6, 329.6, 261.6]], [103.8, [207.7, 261.6, 311.1, 261.6]], [110, [220, 261.6, 329.6, 349.2]], [98, [196, 233.1, 293.7, 233.1]]],
      acao: [[110, [440, 523.3, 659.3, 523.3]], [87.3, [349.2, 440, 523.3, 440]], [130.8, [392, 523.3, 659.3, 523.3]], [98, [392, 493.9, 587.3, 493.9]]] }[est];
    const N = Math.ceil(dur * SR), L = new Float32Array(N), R = new Float32Array(N), rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647 * 2 - 1; })();
    const add = (sig, at, pan = 0) => { const s = Math.floor(at * SR); for (let i = 0; i < sig.length && s + i < N; i++) { L[s + i] += sig[i] * (1 - pan) ; R[s + i] += sig[i] * (1 + pan); } };
    const tone = (sec, fn) => { const n = Math.floor(sec * SR), d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = fn(i / SR, i); return d; };
    const pluck = (f, g = .16) => tone(.3, t => [1, 2, 3, 4].reduce((s, h) => s + Math.sin(2 * Math.PI * f * h * t) / h, 0) * Math.exp(-t * 14) * g);
    const pad = (f, sec) => tone(sec, t => (Math.sin(2 * Math.PI * f * t) + .5 * Math.sin(2 * Math.PI * f * 1.5 * t) + .3 * Math.sin(2 * Math.PI * f * 2.003 * t)) * Math.min(1, t * 2) * Math.min(1, (sec - t) * 2) * .07);
    let lp = 0; const bass = (f, sec) => tone(sec, t => { const w = Math.sin(2 * Math.PI * f * t) + .35 * Math.sign(Math.sin(2 * Math.PI * f * t)); lp += .08 * (w - lp); return lp * Math.min(1, t * 60) * Math.exp(-t * 3) * .3; });
    const kick = () => { let ph = 0; return tone(.25, t => { ph += 2 * Math.PI * (140 * Math.exp(-t * 25) + 48) / SR; return Math.sin(ph) * Math.exp(-t * 14) * .55; }); };
    let hpY = 0, hpX = 0; const hat = (open) => tone(open ? .12 : .04, t => { const x = rnd(); const y = x - hpX + .9 * hpY; hpX = x; hpY = y; return y * Math.exp(-t * (open ? 25 : 90)) * .1; });
    const clap = () => tone(.18, t => rnd() * Math.exp(-t * 22) * .22);
    const drums = est !== 'calma', four = est === 'animada' || est === 'acao' || est === 'engracada';
    for (let b = 0, t0 = 0; t0 < dur; b++, t0 = b * beat) {
      const [root, arp] = P[Math.floor(b / 4) % 4];
      if (b % 4 === 0) { add(bass(root / 2, beat * 3.8), t0); if (est === 'calma' || est === 'suspense') add(pad(root, beat * 4), t0); }
      if (drums && (four || b % 2 === 0)) add(kick(), t0);
      if (drums && b % 2 === 1 && est !== 'suspense') add(clap(), t0, .1);
      if (drums) { add(hat(), t0 + beat / 2, -.2); if (est !== 'suspense') add(hat(b % 4 === 3), t0 + beat * .75, .2); }
      const notes = est === 'suspense' ? 1 : est === 'calma' ? 1 : 2;
      for (let k = 0; k < notes; k++) add(pluck(arp[(b * notes + k) % 4] * (est === 'engracada' && k ? 1.0 : 1), est === 'suspense' ? .1 : .16), t0 + k * beat / notes, k ? .3 : -.3);
    }
    let m = 0; for (let i = 0; i < N; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i]));
    const fo = Math.floor(.8 * SR); for (let i = 0; i < N; i++) { const g = (i > N - fo ? (N - i) / fo : 1) * Math.min(1, i / (SR * .05)) * .85 / (m || 1); L[i] *= g; R[i] *= g; }
    const ab = new AudioBuffer({ length: N, numberOfChannels: 2, sampleRate: SR }); ab.copyToChannel(L, 0); ab.copyToChannel(R, 1);
    return Assets.addBlob(audioBufferToWav(ab), `Música ${this.ESTILOS[est].split(' ')[0]} ${bpm}bpm (gerada).wav`, App.project.id, 'audio');
  },
  // cria e coloca na linha do tempo, abaixando com a voz
  async add(o = {}) {
    const p = App.project, end = p.clips.reduce((m, c) => Math.max(m, c.start + c.dur), 0);
    const st = +o.inicio || 0, dur = +o.duracao || Math.max(8, end - st);
    const rt = await this.make({ ...o, duracao: dur });
    p.folders ||= []; let fo = p.folders.find(x => x.name === 'Músicas'); if (!fo) { fo = { id: uid('f_'), name: 'Músicas' }; p.folders.push(fo); } (p.assetFolders ||= {})[rt.meta.id] = fo.id;
    const c = App.makeClip('audio', { start: App.frame(st), dur: App.frame(Math.min(dur, rt.meta.dur || dur)), assetId: rt.meta.id, name: rt.meta.name.replace(/\.wav$/, '') });
    c.volume = Math.round(+o.volume || 18); c.duck = +o.abaixar || 30; c.fadeOut = .8;
    const aud = p.tracks.filter(t => t.type === 'audio' && Actions.free(t.id, c.start, c.start + c.dur));
    Actions.place(c, aud[aud.length - 1]?.id || Actions.addTrack('audio', undefined, true).id);
    return c;
  },
  async dialog() {
    const o = await UI.modal({ title: 'Gerar música de fundo', icon: 'music', width: 460, body: h(`<div><p style="margin-top:0">Cria uma música instrumental aqui mesmo (sem direitos autorais), do tamanho do vídeo, já <b>baixinha e abaixando quando alguém fala</b>.</p>
      <div class="fgrid"><label class="field">Estilo<select data-e>${Object.entries(this.ESTILOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="field">Velocidade (BPM)<input type="number" data-b placeholder="automático" min="60" max="190"></label>
      <label class="field">Volume<input type="number" data-v value="18" min="1" max="100"></label>
      <label class="field">Duração (s)<input type="number" data-d placeholder="o vídeo todo" min="4" max="600"></label></div></div>`), buttons: [{ label: 'Cancelar', value: null }, { label: 'Gerar', kind: 'primary', collect: b => ({ estilo: $('[data-e]', b).value, bpm: +$('[data-b]', b).value || 0, volume: +$('[data-v]', b).value || 18, duracao: +$('[data-d]', b).value || 0 }) }] });
    if (!o) return;
    const busy = UI.toast('<span class="spin-dot"></span> Compondo a música…', { time: 60000 });
    try { await this.add(o); busy.remove(); App.commit('Música de fundo gerada', { toast: true, all: true }); } catch (e) { busy.remove(); UI.toast(esc(e.message || e), { kind: 'err' }); }
  },
};

/* ---------- transcrição → .srt / .txt ---------- */
const TranscriptExport = {
  ts(t, sep = ',') { const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(Math.floor(s)).padStart(2, '0')}${sep}${String(Math.round((s % 1) * 1000)).padStart(3, '0')}`; },
  srt(segs) { return segs.map((g, i) => `${i + 1}\n${this.ts(g.s)} --> ${this.ts(g.e)}\n${g.t.trim()}\n`).join('\n'); },
  txt(segs, name) { return `TRANSCRIÇÃO — ${name}\n\n` + segs.map(g => `[${g.s.toFixed(2)}s – ${g.e.toFixed(2)}s]  ${g.t.trim()}`).join('\n') + '\n'; },
  download(id, kind) { const tr = Transcribe.get(id), m = Assets.meta(id); if (!tr?.segs?.length) return UI.toast('Esse áudio ainda não tem transcrição.', { kind: 'warn' }); const base = (m?.name || 'audio').replace(/\.[^.]+$/, ''); downloadBlob(new Blob([kind === 'srt' ? this.srt(tr.segs) : this.txt(tr.segs, m?.name || '')], { type: 'text/plain;charset=utf-8' }), `${base} - transcrição.${kind}`); },
};
