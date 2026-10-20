/* ===================== alinhar.js — transcrição melhor =====================
   • Alinhar com o roteiro: cola o roteiro e cada palavra do roteiro ganha o tempo certo (corrige os erros do Whisper,
     ex.: "torre e fé" → "torre Eiffel", sem perder o segundo de cada palavra)
   • Sem servidor: estima o tempo de cada palavra só pelo som da voz + o roteiro (funciona offline)
   • Ajustar tempos pelo som: encosta o começo/fim de cada palavra no "respiro" mais perto da voz
   • Legendas estilo Shorts: 1 a 3 palavras por vez, entrando com pop, palavras fortes em amarelo */
'use strict';

Object.assign(TEXT_STYLES, {
  shorts: { name: 'Legenda Shorts (pop)', text: 'LEGENDA', font: 'Fredoka', size: 84, color: '#ffffff', stroke: '#24124a', strokeW: 16, shadow: true, bold: true },
  impacto: { name: 'Texto de impacto', text: 'UAU!', font: 'Luckiest Guy', size: 170, color: '#ffe14d', stroke: '#24124a', strokeW: 20, shadow: true },
});

const ScriptAlign = {
  norm(w) { return String(w || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ''); },
  words(text) { return String(text || '').replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ').split(/\s+/).map(w => w.trim()).filter(w => this.norm(w)); },
  syl(w) { const n = this.norm(w); const g = n.match(/[aeiouy]+/g); return Math.max(1, g ? g.length : 1); },
  // envelope de volume (100 por segundo) do áudio
  env(buf) {
    const sr = buf.sampleRate, ch = buf.getChannelData(0), ch2 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch, hop = Math.round(sr / 100), n = Math.floor(ch.length / hop), e = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let k = i * hop; k < (i + 1) * hop; k += 2) { const v = (ch[k] + ch2[k]) / 2; s += v * v; } e[i] = 20 * Math.log10(Math.sqrt(s / (hop / 2)) + 1e-6); }
    const sm = new Float32Array(n); for (let i = 0; i < n; i++) { let a = 0, c = 0; for (let k = -2; k <= 2; k++) if (e[i + k] !== undefined) { a += e[i + k]; c++; } sm[i] = a / c; }
    return sm;
  },
  // distribui as palavras de um trecho [a,b] pelos quadros com voz (pesados pelo volume) e encosta nos vales
  spread(ws, a, b, E) {
    const i0 = Math.max(0, Math.floor(a * 100)), i1 = Math.min(E.length, Math.ceil(b * 100));
    if (i1 - i0 < 2) { const d = (b - a) / ws.length; return ws.map((w, k) => [a + d * k, a + d * (k + 1), w]); }
    const v = []; for (let i = i0; i < i1; i++) v.push(clamp((E[i] + 50) / 25, .05, 1));
    const cum = [0]; v.forEach(x => cum.push(cum[cum.length - 1] + x)); const tot = cum[cum.length - 1];
    const wt = ws.map(w => this.syl(w)), sw = wt.reduce((x, y) => x + y, 0); let acc = 0;
    const at = f => { const target = f * tot; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < target) lo = m + 1; else hi = m; } return a + Math.min(lo, v.length) / 100; };
    const bnd = [a]; wt.forEach(x => { acc += x; bnd.push(at(acc / sw)); }); bnd[bnd.length - 1] = b;
    for (let j = 1; j < bnd.length - 1; j++) { const c = Math.round(bnd[j] * 100); let best = c, bv = Infinity; for (let k = c - 8; k <= c + 8; k++) if (k > i0 && k < i1 && E[k] < bv) { bv = E[k]; best = k; } bnd[j] = best / 100; }
    for (let j = 1; j < bnd.length; j++) if (bnd[j] < bnd[j - 1] + .07) bnd[j] = bnd[j - 1] + .07;
    if (bnd[bnd.length - 1] > b) { const k = (b - a) / (bnd[bnd.length - 1] - a); for (let j = 1; j < bnd.length; j++) bnd[j] = a + (bnd[j] - a) * k; }
    return ws.map((w, k) => [round(bnd[k], 2), round(bnd[k + 1], 2), w]);
  },
  // trechos com voz (pausas maiores que 0,25 s separam frases)
  phrases(E, minSil = .25, thrDb) {
    const sorted = Array.from(E).sort((x, y) => x - y), floor = sorted[Math.floor(sorted.length * .1)] || -60, peak = sorted[Math.floor(sorted.length * .98)] || -10;
    const thr = thrDb ?? Math.max(floor + 8, peak - 30), out = []; let s = -1, q = 0;
    for (let i = 0; i <= E.length; i++) { const on = i < E.length && E[i] > thr; if (on) { if (s < 0) s = i; q = 0; } else if (s >= 0) { q++; if (q >= minSil * 100 || i === E.length) { out.push([s / 100, (i - q + 1) / 100]); s = -1; q = 0; } } }
    return out.filter(([a, b]) => b - a > .12);
  },
  // sem servidor: roteiro + som → palavras com tempo
  estimate(buf, text) {
    const E = this.env(buf), ws = this.words(text), ph = this.phrases(E); if (!ws.length || !ph.length) return [];
    const dur = ph.reduce((a, [x, y]) => a + y - x, 0), syl = ws.map(w => this.syl(w)), tot = syl.reduce((a, b) => a + b, 0);
    // reparte as palavras pelas frases proporcional à duração de cada frase, cortando preferindo pontuação
    const out = []; let wi = 0, accT = 0, accS = 0;
    ph.forEach(([a, b], k) => {
      accT += b - a; const goal = k === ph.length - 1 ? tot : tot * accT / dur; const chunk = [];
      while (wi < ws.length && (accS + syl[wi] / 2 <= goal || !chunk.length)) { chunk.push(ws[wi]); accS += syl[wi]; wi++; if (/[.!?…,]$/.test(ws[wi - 1]) && accS >= goal * .92) break; }
      if (k === ph.length - 1) while (wi < ws.length) { chunk.push(ws[wi]); wi++; }
      if (chunk.length) out.push(...this.spread(chunk, a, b, E));
    });
    return out;
  },
  // alinha as palavras do roteiro com as palavras transcritas (programação dinâmica, igual "diff")
  align(trWords, scWords) {
    const A = trWords.map(w => this.norm(w[2])), B = scWords.map(w => this.norm(w)), n = A.length, m = B.length;
    const sim = (x, y) => { if (x === y) return 2; if (!x || !y) return -1; const L = Math.max(x.length, y.length); let same = 0; for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] === y[i]) same++; return same / L > .5 || x.startsWith(y) || y.startsWith(x) ? 1 : -1; };
    const D = Array.from({ length: n + 1 }, () => new Float32Array(m + 1)), T = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
    for (let i = 1; i <= n; i++) { D[i][0] = -i * .6; T[i][0] = 1; } for (let j = 1; j <= m; j++) { D[0][j] = -j * .6; T[0][j] = 2; }
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) { const d = D[i - 1][j - 1] + sim(A[i - 1], B[j - 1]), u = D[i - 1][j] - .6, l = D[i][j - 1] - .6; if (d >= u && d >= l) { D[i][j] = d; T[i][j] = 0; } else if (u >= l) { D[i][j] = u; T[i][j] = 1; } else { D[i][j] = l; T[i][j] = 2; } }
    const map = new Array(m).fill(null); let i = n, j = m;
    while (i > 0 || j > 0) { const t = T[i][j]; if (i > 0 && j > 0 && t === 0) { map[j - 1] = i - 1; i--; j--; } else if (i > 0 && (j === 0 || t === 1)) i--; else j--; }
    // palavras do roteiro sem par: tempo interpolado entre as vizinhas que têm par
    const out = scWords.map((w, k) => map[k] != null ? [trWords[map[k]][0], trWords[map[k]][1], w] : null);
    for (let k = 0; k < out.length; k++) {
      if (out[k]) continue; let a = k - 1; while (a >= 0 && !out[a]) a--; let b = k + 1; while (b < out.length && !out[b]) b++;
      const t0 = a >= 0 ? out[a][1] : (out[b]?.[0] ?? 0) - .3, t1 = b < out.length ? out[b][0] : t0 + .3 * (b - a), cnt = b - a - 1;
      for (let q = a + 1; q < b; q++) { const s0 = t0 + (t1 - t0) * (q - a - 1) / cnt, s1 = t0 + (t1 - t0) * (q - a) / cnt; out[q] = [round(s0, 2), round(Math.max(s0 + .05, s1), 2), scWords[q]]; }
      k = b - 1;
    }
    return out;
  },
  // palavras → trechos (frases curtas) no formato da transcrição
  toSegs(words) {
    const segs = []; let cur = [];
    const push = () => { if (!cur.length) return; segs.push({ s: cur[0][0], e: cur[cur.length - 1][1], t: cur.map(x => x[2]).join(' '), w: cur }); cur = []; };
    words.forEach((w, i) => { cur.push(w); const nx = words[i + 1]; if (!nx || /[.!?…]$/.test(w[2]) || (nx[0] - w[1] > .35) || cur.length >= 8) push(); });
    push(); return segs;
  },
  // encosta as fronteiras no vale de volume mais perto (±80 ms)
  refine(buf, segs) {
    const E = this.env(buf);
    return segs.map(sg => { if (!sg.w?.length) return sg; const w = sg.w.map(x => [...x]); for (let k = 1; k < w.length; k++) { const c = Math.round(w[k][0] * 100); let best = c, bv = Infinity; for (let q = c - 8; q <= c + 8; q++) if (E[q] !== undefined && E[q] < bv) { bv = E[q]; best = q; } const t = best / 100; if (t > w[k - 1][0] + .06 && t < w[k][1] - .04) { w[k][0] = round(t, 2); w[k - 1][1] = round(t, 2); } } return { ...sg, s: w[0][0], e: w[w.length - 1][1], w }; });
  },
};

Object.assign(Transcribe, {
  // aplica o roteiro na transcrição (ou estima sem servidor)
  async withScript(id, text) {
    const buf = Assets.audioBuffer(id, Assets.ctx()); if (!buf) throw new Error('O áudio ainda não carregou.');
    const tr = this.get(id), sc = ScriptAlign.words(text); if (!sc.length) throw new Error('O roteiro está vazio.');
    const trw = (tr?.segs || []).flatMap(sg => sg.w?.length ? sg.w : (() => { const ws = sg.t.split(/\s+/).filter(Boolean), d = (sg.e - sg.s) / Math.max(1, ws.length); return ws.map((w, k) => [round(sg.s + d * k, 2), round(sg.s + d * (k + 1), 2), w]); })());
    let words, how;
    if (trw.length >= 3) { words = ScriptAlign.align(trw, sc); how = 'alinhado com a transcrição'; }
    else { words = ScriptAlign.estimate(buf, text); how = 'estimado pelo som da voz (sem servidor)'; }
    const segs = ScriptAlign.refine(buf, ScriptAlign.toSegs(words));
    this.map()[id] = { status: 'pronta', segs, lang: 'pt', quando: Date.now(), roteiro: true };
    App.commit('Transcrição alinhada com o roteiro', { noRefresh: true });
    return { n: words.length, how };
  },
  async scriptDialog(id) {
    const f = h(`<div class="fgrid"><p class="full" style="margin:0">Cole o roteiro (o que foi falado). Cada palavra do roteiro ganha o segundo exato em que foi falada — os erros da transcrição somem. <b>Funciona até sem o servidor</b>: aí o tempo é calculado pelo som da voz. Textos entre [colchetes] são ignorados (indicações de cena).</p>
      <label class="field full">Roteiro<textarea rows="9" data-k="txt" style="width:100%">${esc(App.project.roteiro || '')}</textarea></label></div>`);
    const o = await UI.modal({ title: 'Alinhar com o roteiro', icon: 'text', width: 620, body: f, buttons: [{ label: 'Cancelar', value: null }, { label: 'Alinhar', kind: 'primary', collect: () => Actions.readForm(f) }] });
    if (!o?.txt) return;
    try { const r = await this.withScript(id, o.txt); UI.toast(`Pronto: ${r.n} palavras com tempo (${r.how}).`, { kind: 'ok', time: 5000, action: { label: 'Ver', fn: () => this.open(id) } }); LibUI.render(); }
    catch (e) { UI.toast(e.message || String(e), { kind: 'err' }); }
  },
  refineTimes(id) {
    const buf = Assets.audioBuffer(id, Assets.ctx()), tr = this.get(id); if (!buf || !tr?.segs?.length) return 0;
    tr.segs = ScriptAlign.refine(buf, tr.segs); App.commit('Tempos das palavras ajustados pelo som', { noRefresh: true, toast: true }); return tr.segs.length;
  },
});

/* legendas estilo Shorts: poucas palavras por vez, pop, palavras fortes (em MAIÚSCULAS ou com !) em amarelo */
(() => {
  const base = Transcribe.toSubtitles.bind(Transcribe);
  Transcribe.toSubtitles = function (id, o = {}) {
    if (o.estilo !== 'shorts') return base(id, o);
    const n = base(id, { ...o, max: o.max || 16, silent: true });
    const tk = App.project.tracks.find(t => t.type === 'visual' && t.name === 'Legendas');
    if (tk) for (const c of App.project.clips.filter(c => c.trackId === tk.id && c.type === 'text')) {
      const t = c.text.text; if (o.y === undefined) c.tr.y = Math.round(App.project.settings.h * .16);
      if (/[A-ZÁÉÍÓÚÃÕÂÊÔÇ]{3,}/.test(t) || /!$/.test(t)) { c.text.color = '#ffe14d'; c.text.size = Math.round(c.text.size * 1.18); }
      const def = ANIMS.popIn; if (def && !c.anims.some(a => a.type === 'popIn')) c.anims.push({ id: uid('i_'), type: 'popIn', start: 0, dur: Math.min(.16, c.dur / 2), params: defaultParams(def), sound: { ...defaultSound(def), mode: 'off' } });
    }
    if (!o.silent) { App.commit(`${n} legenda(s) estilo Shorts`, { toast: true, all: true }); }
    return n;
  };
})();
