/* ===================== som.js — voz e sons: tocar junto, onda na timeline, boca pela voz e legendas pela transcrição ===================== */
'use strict';
const Som = {
  ctx: null, buf: new Map(), fontes: [], _picos: new Map(),
  ac() { return this.ctx || (this.ctx = new AudioContext()); },
  async decod(arq) {
    if (this.buf.has(arq)) return this.buf.get(arq);
    const b = await Arq.pegaBlob(arq); if (!b) return null;
    const ab = await this.ac().decodeAudioData(await b.arrayBuffer()).catch(() => null); if (ab) this.buf.set(arq, ab); return ab;
  },
  async prepara(P) { for (const a of P.audios || []) await this.decod(a.arq); Folha.pinta(); },
  dur(arq) { return this.buf.get(arq)?.duration || 0; },
  // força de cada quadro (0..1), para a onda e para a boca
  picos(arq, fps) {
    const k = arq + '@' + fps; if (this._picos.has(k)) return this._picos.get(k);
    const b = this.buf.get(arq); if (!b) return null;
    const d = b.getChannelData(0), por = b.sampleRate / fps, n = Math.ceil(b.length / por), out = new Float32Array(n); let mx = 1e-6;
    for (let i = 0; i < n; i++) { let s = 0; const a = Math.floor(i * por), z = Math.min(d.length, Math.floor((i + 1) * por)); for (let j = a; j < z; j += 4) s += d[j] * d[j]; out[i] = Math.sqrt(s / Math.max(1, (z - a) / 4)); mx = Math.max(mx, out[i]); }
    for (let i = 0; i < n; i++) out[i] /= mx; this._picos.set(k, out); return out;
  },
  /* ---------- gravar a voz aqui mesmo (microfone): entra como áudio a partir do quadro atual ---------- */
  async gravar() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return UI.toast('Este navegador não grava áudio. Use o Chrome ou o Edge.', { kind: 'err' });
    const P = App.P, q0 = App.q; App.pausa(); let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { return UI.toast('Não deu para usar o microfone. Libere o microfone para este site (cadeado ao lado do endereço).', { kind: 'err', time: 7000 }); }
    const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    const ac = this.ac(); try { await ac.resume(); } catch { } const src = ac.createMediaStreamSource(stream), an = ac.createAnalyser(); an.fftSize = 512; src.connect(an); const buf = new Uint8Array(an.fftSize);
    const body = h(`<div class="grav"><div class="grav-st"><i class="grav-pt"></i><b data-t>Pronto para gravar</b><span class="sp"></span><code data-tempo>0:00</code></div>
      <div class="grav-nivel"><i data-n></i></div>
      <label class="chk"><input type="checkbox" data-tocar checked> Tocar a animação junto (começa no quadro ${q0 + 1}, para falar no tempo certo)</label>
      <div style="color:var(--tx3);font-size:12px;margin-top:6px">A gravação entra na aba Voz a partir do quadro ${q0 + 1}. Depois dá para transcrever para legendas e usar a boca pela voz.</div></div>`);
    let rec = null, pedacos = [], t0 = 0, raf = 0, fim = null;
    const anda = () => { an.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); $('[data-n]', body).style.width = Math.min(100, m / 128 * 160) + '%';
      if (rec) { const s = (performance.now() - t0) / 1000; $('[data-tempo]', body).textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; } raf = requestAnimationFrame(anda); };
    anda();
    const para = () => { cancelAnimationFrame(raf); stream.getTracks().forEach(t => t.stop()); try { src.disconnect(); } catch { } App.pausa(); };
    const r = await UI.modal({ title: 'Gravar áudio', icon: 'mic', width: 480, body, buttons: [
      { label: 'Cancelar', value: null },
      { label: 'Gravar', kind: 'primary', onClick: api => {
        const bt = api.foot.querySelector('.btn.primary');
        if (!rec) { // começa
          pedacos = []; rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : {}); rec.ondataavailable = e => { if (e.data.size) pedacos.push(e.data); };
          fim = new Promise(ok => rec.onstop = ok); rec.start(250); t0 = performance.now(); body.classList.add('gravando'); $('[data-t]', body).textContent = 'Gravando…'; bt.textContent = 'Parar e pôr na animação';
          if ($('[data-tocar]', body).checked) { App.setQ(q0); App.tocar(); }
          return false;
        }
        rec.stop(); return 'ok';
      } }] });
    if (rec && rec.state !== 'inactive') rec.stop();
    if (rec) await fim; para();
    if (r !== 'ok' || !pedacos.length) return;
    const blob = new Blob(pedacos, { type: rec.mimeType || tipo || 'audio/webm' }), id = await Arq.guardar(blob), b = await this.decod(id);
    if (!b) return UI.toast('Não consegui abrir a gravação.', { kind: 'err' });
    const nome = 'Gravação ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    P.audios.push({ id: uid('au'), nome, arq: id, de: q0, vol: 1 });
    const ultimo = q0 + Math.ceil(b.duration * P.fps); if (ultimo > P.duracao) P.duracao = ultimo;
    App.commit('Gravar áudio'); Lado.aba('som'); UI.toast(`<b>${esc(nome)}</b> entrou no quadro ${q0 + 1} (${b.duration.toFixed(1).replace('.', ',')} s).`, { kind: 'ok' });
  },
  async importar() {
    const fs = await pickFiles('audio/*,video/mp4,video/webm', true); if (!fs.length) return;
    for (const f of fs) { const id = await Arq.guardar(f); const b = await this.decod(id); if (!b) { UI.toast(`Não consegui abrir o áudio "${esc(f.name)}"`, { kind: 'err' }); continue; }
      App.P.audios.push({ id: uid('au'), nome: f.name.replace(/\.[^.]+$/, '').slice(0, 50), arq: id, de: App.q, vol: 1 });
      const fim = App.q + Math.ceil(b.duration * App.P.fps); if (fim > App.P.duracao) App.P.duracao = fim; }
    App.commit('Pôr áudio'); Lado.aba('som');
  },
  // volume do áudio no quadro q (volume geral × volume do trecho, se tiver)
  ganho(a, q) { let v = 1; for (const t of a.volTrechos || []) if (q >= t.de && q <= t.ate) v = t.vol; return (a.vol ?? 1) * v; },
  // agenda as trocas de volume dos trechos (q0 = quadro que toca no tempo t0 do contexto)
  agenda(g, a, q0, t0, fps) {
    g.gain.setValueAtTime(this.ganho(a, q0), Math.max(0, t0));
    const bs = [...new Set((a.volTrechos || []).flatMap(t => [t.de, t.ate + 1]))].filter(b => b > q0).sort((x, y) => x - y);
    for (const b of bs) { const t = t0 + (b - q0) / fps; g.gain.setValueAtTime(this.ganho(a, b - 1), Math.max(t0, t - .02)); g.gain.linearRampToValueAtTime(this.ganho(a, b), t); }
  },
  /* ---------- MIXAGEM (como a dos Shorts): cada áudio tem tipo (voz, música, efeito), corte (ini = segundos cortados do começo,
     dur = quanto dura na timeline), fade de entrada/saída (fi/fo em s), repetir (loop, música), mudo/solo; e a MÚSICA abaixa sozinha
     enquanto alguém fala (P.mix = { duck: true, nivel: .45 }). toca (prévia), mistura (exportar) e a onda usam as mesmas contas. ---------- */
  TIPOS: { voz: 'Voz', musica: 'Música', efeito: 'Efeito sonoro' },
  tipo(a) { return a.tipo || (/m[uú]sica|music|trilha|bgm|beat/i.test(a.nome || '') ? 'musica' : 'voz'); },
  ini(a) { return Math.max(0, +a.ini || 0); },
  // quanto o áudio dura na timeline (segundos)
  compr(a, b = this.buf.get(a.arq)) { const nat = Math.max(0, (b?.duration || 0) - this.ini(a)); return a.dur != null ? Math.max(.05, a.loop ? +a.dur : Math.min(+a.dur, nat)) : nat; },
  fimQ(P, a) { return (a.de || 0) + Math.max(1, Math.round(this.compr(a) * P.fps)) - 1; },
  ouve(P, a) { const solo = (P.audios || []).some(x => x.solo); return !a.mudo && (!solo || a.solo); },
  // fade (0..1) no segundo x da timeline
  fade(a, x, tl0, fim) { const fi = +a.fi || 0, fo = +a.fo || 0; return Math.min(fi ? clamp((x - tl0) / fi, 0, 1) : 1, fo ? clamp((fim - x) / fo, 0, 1) : 1); },
  // trechos (segundos da timeline) em que alguém fala: a música abaixa neles
  falas(P) {
    const out = []; for (const a of P.audios || []) { if (this.tipo(a) !== 'voz' || !this.ouve(P, a)) continue; const pk = this.picos(a.arq, P.fps); if (!pk) continue;
      const i0 = Math.round(this.ini(a) * P.fps), n = Math.round(this.compr(a) * P.fps), tl = (a.de || 0) / P.fps; let s = null;
      for (let i = 0; i <= n; i++) { const v = i < n ? pk[i0 + i] || 0 : 0, t = tl + i / P.fps; if (v > .12 && s == null) s = t; else if (v <= .12 && s != null) { out.push([s - .05, t + .05]); s = null; } } }
    out.sort((x, y) => x[0] - y[0]); const m = []; for (const r of out) { const u = m[m.length - 1]; if (u && r[0] - u[1] < .35) u[1] = Math.max(u[1], r[1]); else m.push([...r]); } return m;
  },
  // liga UM áudio no contexto ac a partir do segundo "desde" da timeline (t0 = hora do contexto em que "desde" toca)
  fonte(ac, dest, P, a, b, desde, t0, falas) {
    const fps = P.fps, ini = this.ini(a), tl0 = (a.de || 0) / fps, len = this.compr(a, b), fim = tl0 + len; if (!b || desde >= fim || len <= 0) return null;
    const ja = Math.max(desde, tl0), when = t0 + (ja - desde), T = x => Math.max(when, t0 + (x - desde)), dentro = ja - tl0;
    let off = ini + dentro; if (a.loop) { const L = Math.max(.05, b.duration - ini); off = ini + (dentro % L); } else if (off >= b.duration) return null;
    const src = ac.createBufferSource(), g = ac.createGain(), gf = ac.createGain(), gd = ac.createGain(); src.buffer = b;
    if (a.loop) { src.loop = true; src.loopStart = ini; src.loopEnd = b.duration; }
    src.connect(gf).connect(gd).connect(g).connect(dest);
    this.agenda(g, a, Math.round(ja * fps), when, fps);
    // fades
    gf.gain.setValueAtTime(this.fade(a, ja, tl0, fim), when);
    if (+a.fi && ja < tl0 + +a.fi) gf.gain.linearRampToValueAtTime(this.fade(a, Math.min(fim, tl0 + +a.fi), tl0, fim), T(Math.min(fim, tl0 + +a.fi)));
    if (+a.fo) { const s0 = Math.max(fim - +a.fo, ja); gf.gain.setValueAtTime(this.fade(a, s0, tl0, fim), T(s0)); gf.gain.linearRampToValueAtTime(0, T(fim)); }
    // a música abaixa enquanto alguém fala
    const mx = P.mix || {}, niv = clamp(mx.nivel ?? .45, 0, 1);
    if (this.tipo(a) === 'musica' && mx.duck !== false && falas?.length) {
      let v0 = 1; for (const [s1, e1] of falas) if (ja >= s1 && ja < e1) v0 = niv; gd.gain.setValueAtTime(v0, when);
      for (const [s1, e1] of falas) { if (e1 <= ja || s1 >= fim) continue; if (s1 > ja) { gd.gain.setValueAtTime(1, T(s1)); gd.gain.linearRampToValueAtTime(niv, T(s1) + .12); } gd.gain.setValueAtTime(niv, T(e1)); gd.gain.linearRampToValueAtTime(1, T(e1) + .25); }
    }
    src.start(when, off); src.stop(when + (fim - ja)); return src;
  },
  toca(q) {
    this.para(); const P = App.P, ac = this.ac(); ac.resume(); const t0 = ac.currentTime + .03, desde = q / P.fps, falas = this.falas(P);
    for (const a of P.audios || []) { if (!this.ouve(P, a)) continue; const s = this.fonte(ac, ac.destination, P, a, this.buf.get(a.arq), desde, t0, falas); if (s) this.fontes.push(s); }
  },
  para() { for (const s of this.fontes) { try { s.stop(); } catch { } } this.fontes = []; },
  // ao passar os quadros, toca o pedacinho daquele quadro (bom para acertar a boca)
  raspa(q) {
    const P = App.P, ac = this.ac(); ac.resume();
    for (const a of P.audios || []) { const b = this.buf.get(a.arq); if (!b || !this.ouve(P, a)) continue; const dq = q - (a.de || 0); if (dq < 0 || q > this.fimQ(P, a)) continue;
      let off = this.ini(a) + dq / P.fps; if (a.loop) off = this.ini(a) + (dq / P.fps) % Math.max(.05, b.duration - this.ini(a)); if (off >= b.duration) continue;
      const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = b; g.gain.value = this.ganho(a, q) * .9; src.connect(g).connect(ac.destination); src.start(ac.currentTime, off, 1.2 / P.fps); }
  },
  // mistura tudo (para exportar)
  async mistura(P, sr = 48000) {
    const dur = P.duracao / P.fps, off = new OfflineAudioContext(2, Math.max(1, Math.ceil(dur * sr)), sr);
    for (const a of P.audios || []) await this.decod(a.arq); const falas = this.falas(P);
    for (const a of P.audios || []) { if (!this.ouve(P, a)) continue; this.fonte(off, off.destination, P, a, this.buf.get(a.arq), 0, 0, falas); }
    return off.startRendering();
  },
  // valor da onda no quadro q da timeline (força × volume × fade), para desenhar
  ondaEm(P, a, q) {
    const pk = this.picos(a.arq, P.fps), b = this.buf.get(a.arq); if (!pk || !b) return 0; const dq = q - (a.de || 0); if (dq < 0) return 0;
    let i = Math.round(this.ini(a) * P.fps) + dq; if (a.loop) { const i0 = Math.round(this.ini(a) * P.fps), L = Math.max(1, pk.length - i0); i = i0 + (dq % L); }
    const tl0 = (a.de || 0) / P.fps; return (pk[i] || 0) * this.ganho(a, q) * this.fade(a, q / P.fps, tl0, tl0 + this.compr(a));
  },

  /* ---------- LIMPAR E NIVELAR A VOZ (a cadeia dos Shorts): corta o grave/ronco, tira o zumbido de 60 Hz, tira o "abafado", dá presença,
     comprime, nivela a fala em −18 dBFS e segura os picos em −1 dBFS. Vira um áudio NOVO (o original fica em a.arqOrig para voltar). ---------- */
  async limpar(a) {
    const b = await this.decod(a.arq); if (!b) return UI.toast('O áudio ainda está carregando.', { kind: 'warn' });
    const t = UI.toast('<span class="spin-dot"></span> Limpando e nivelando a voz…', { time: 120000 });
    try {
      const sr = b.sampleRate, ch = Math.min(2, b.numberOfChannels), off = new OfflineAudioContext(ch, b.length, sr), src = off.createBufferSource(); src.buffer = b;
      const f = (tipo, freq, o = {}) => { const x = off.createBiquadFilter(); x.type = tipo; x.frequency.value = freq; if (o.q != null) x.Q.value = o.q; if (o.g != null) x.gain.value = o.g; return x; };
      const cadeia = [f('highpass', 90, { q: .7 }), f('notch', 60, { q: 8 }), f('peaking', 280, { q: 1, g: -2 }), f('peaking', 3200, { q: 1, g: 3 }), f('highshelf', 9000, { g: 1.5 })];
      const cp = off.createDynamicsCompressor(); cp.threshold.value = -26; cp.ratio.value = 3.5; cp.attack.value = .006; cp.release.value = .18; cp.knee.value = 6; cadeia.push(cp);
      let no = src; for (const x of cadeia) { no.connect(x); no = x; } no.connect(off.destination); src.start();
      const r = await off.startRendering(), dados = [...Array(r.numberOfChannels)].map((_, i) => r.getChannelData(i)), N = r.length, jan = Math.round(sr * .02);
      // portão: janelas bem baixas (respiração/ruído) ficam mais baixas; e a média só das partes com fala
      let soma = 0, cont = 0; const env = new Float32Array(Math.ceil(N / jan));
      for (let w = 0; w < env.length; w++) { let s = 0; for (let k = w * jan; k < Math.min(N, (w + 1) * jan); k++) s += dados[0][k] * dados[0][k]; env[w] = Math.sqrt(s / jan); }
      const lim = Math.max(...env) * .08; for (let w = 0; w < env.length; w++) if (env[w] > lim) { soma += env[w] * env[w]; cont++; }
      const rms = Math.sqrt(soma / Math.max(1, cont)), ganho = rms > 1e-6 ? Math.pow(10, -18 / 20) / rms : 1, teto = Math.pow(10, -1 / 20);
      for (const d of dados) { let gg = 1; for (let k = 0; k < N; k++) { const alvo = env[Math.floor(k / jan)] < lim * .5 ? .25 : 1; gg += (alvo - gg) * .002; const v = d[k] * ganho * gg; d[k] = teto * Math.tanh(v / teto); } }
      const id = await Arq.guardar(this.wav(r)); if (!a.arqOrig) a.arqOrig = a.arq; a.arq = id; this._picos.clear(); await this.decod(id);
      t.remove(); App.commit('Limpar a voz'); UI.toast(`Voz "${esc(a.nome)}" limpa e nivelada.`, { kind: 'ok' });
    } catch (e) { t.remove(); UI.toast('Não deu para limpar: ' + esc(e.message || e), { kind: 'err' }); }
  },
  voltarOriginal(a) { if (!a.arqOrig) return; a.arq = a.arqOrig; delete a.arqOrig; this._picos.clear(); this.decod(a.arq).then(() => Folha.pinta()); App.commit('Voz original'); },
  // AudioBuffer → WAV 16 bits
  wav(buf) {
    const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate, ab = new ArrayBuffer(44 + n * ch * 2), v = new DataView(ab), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * ch * 2, true);
    const cs = [...Array(ch)].map((_, i) => buf.getChannelData(i)); let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { v.setInt16(o, Math.max(-1, Math.min(1, cs[c][i])) * 32767, true); o += 2; }
    return new Blob([ab], { type: 'audio/wav' });
  },

  /* ---------- boca pela voz: escolhe a pose da boca em cada quadro pela força da voz ---------- */
  async bocaPelaVoz(n) {
    const P = App.P, def = Modelo.naVista(P.personagens[n.ref], Modelo.estadoPersonagem(n, App.q).vista); if (!P.audios.length) return UI.toast('Ponha um áudio de voz primeiro (aba Voz).', { kind: 'warn' });
    const sess = def.sessoes.find(s => /boca/i.test(s.nome)) || def.sessoes[0]; if (!sess) return UI.toast('Esse personagem não tem sessões. Crie a sessão "Boca" no Ateliê.', { kind: 'warn' });
    const body = h(`<div><label class="field">Sessão da boca<select data-s>${def.sessoes.map(s => `<option value="${s.id}" ${s === sess ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}</select></label>
      <label class="field">Voz<select data-a>${P.audios.map(a => `<option value="${a.id}">${esc(a.nome)}</option>`).join('')}</select></label>
      <div class="field">Da boca fechada até a mais aberta (arraste para mudar a ordem; desmarque o que não serve)<div data-l style="display:grid;gap:4px"></div></div>
      <label class="field">Sensibilidade <input type="range" min=".05" max=".6" step=".01" value=".18" data-sen></label>
      <label class="chk"><input type="checkbox" data-pula checked> Segurar cada boca pelo menos 2 quadros (mais natural)</label></div>`);
    const lista = () => { const s = def.sessoes.find(x => x.id === $('[data-s]', body).value); $('[data-l]', body).innerHTML = s.presets.map(p => `<label class="chk" draggable="true" data-id="${p.id}" style="padding:4px 8px;border:1px solid var(--bd);border-radius:6px;background:var(--bg1)"><input type="checkbox" checked> ${esc(p.nome)}</label>`).join('') || '<small>Essa sessão não tem presets.</small>';
      let arr = null; $$('[data-l] label', body).forEach(l => { l.ondragstart = () => arr = l; l.ondragover = e => { e.preventDefault(); }; l.ondrop = e => { e.preventDefault(); if (arr && arr !== l) l.before(arr); }; }); };
    $('[data-s]', body).onchange = lista; lista();
    const ok = await UI.modal({ title: `Boca pela voz · ${n.nome}`, icon: 'mic', body, buttons: [{ label: 'Cancelar', value: false }, { label: 'Animar a boca', kind: 'primary', value: true }] }); if (!ok) return;
    const s = def.sessoes.find(x => x.id === $('[data-s]', body).value), ordem = $$('[data-l] label', body).filter(l => $('input', l).checked).map(l => l.dataset.id);
    if (ordem.length < 2) return UI.toast('Escolha pelo menos 2 bocas (fechada e aberta).', { kind: 'warn' });
    const a = P.audios.find(x => x.id === $('[data-a]', body).value), pk = this.picos(a.arq, P.fps), sen = +$('[data-sen]', body).value, pula = $('[data-pula]', body).checked;
    if (!pk) return UI.toast('O áudio ainda está carregando, tente de novo.', { kind: 'warn' });
    let ultimo = null, desde = -9; const i0 = Math.round(this.ini(a) * P.fps), nQ = Math.min(pk.length - i0, Math.round(this.compr(a) * P.fps));
    for (let i = i0; i < i0 + nQ; i++) {
      const q = (a.de || 0) + i - i0; if (q < 0 || q >= P.duracao) continue; if (!Modelo.aparece(P, n, q)) continue;
      const v = pk[i] < sen ? 0 : Math.min(ordem.length - 1, 1 + Math.floor((pk[i] - sen) / (1 - sen) * (ordem.length - 1)));
      const id = ordem[v]; if (id === ultimo || (pula && q - desde < 2)) continue;
      const k = Modelo.chave(n, q); k.sessoes = { ...(k.sessoes || {}), [s.id]: id }; ultimo = id; desde = q;
    }
    const fim = (a.de || 0) + nQ; if (fim < P.duracao) { const k = Modelo.chave(n, fim); k.sessoes = { ...(k.sessoes || {}), [s.id]: ordem[0] }; }
    App.commit('Boca pela voz'); UI.toast(`Boca animada pela voz "${esc(a.nome)}".`, { kind: 'ok' });
  },

  /* ---------- legendas pela transcrição (servidor do Estúdio Problems, com o login do Google) ---------- */
  async transcrever() {
    const P = App.P; if (!P.audios.length) return;
    const a = P.audios.length === 1 ? P.audios[0] : await UI.modal({ title: 'Transcrever qual áudio?', icon: 'text', body: `<label class="field">Áudio<select>${P.audios.map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></label>`, buttons: [{ label: 'Cancelar', value: null }, { label: 'Transcrever', kind: 'primary', collect: api => P.audios.find(x => x.id === $('select', api.body).value) }] });
    if (!a) return; const b = await this.decod(a.arq); if (!b) return;
    const t = UI.toast(`<span class="spin-dot"></span> <span data-p>Transcrevendo "${esc(a.nome)}"…</span>`, { time: 900000 });
    try {
      const sr = 16000, off = new OfflineAudioContext(1, Math.ceil(b.duration * sr), sr), src = off.createBufferSource(); src.buffer = b; src.connect(off.destination); src.start(); const mono = (await off.startRendering()).getChannelData(0);
      const pedaco = 60 * sr, segs = [], hd = await Nuvem.hd();
      for (let o = 0; o < mono.length; o += pedaco) {
        const el = t.querySelector('[data-p]'); if (el) el.textContent = `Transcrevendo "${a.nome}"… ${Math.round(o / mono.length * 100)}%`;
        const parte = mono.subarray(o, Math.min(mono.length, o + pedaco));
        const r = await fetch(Nuvem.srv + '/transcrever', { method: 'POST', headers: { 'content-type': 'application/json', ...hd }, body: JSON.stringify({ audio: this.wav64(parte, sr), language: 'pt' }) });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || 'erro ' + r.status);
        const base = o / sr;
        for (const s of j.segments || []) {
          const ws = (s.words || []).filter(w => String(w.w || '').trim());
          if (ws.length) { let cur = []; const fecha = () => { if (!cur.length) return; segs.push({ s: base + cur[0].s, e: base + cur[cur.length - 1].e, t: cur.map(w => w.w.trim()).join(' '), pal: cur.map(w => [w.w.trim(), base + w.s, base + w.e]) }); cur = []; };
            // quebra como nos Shorts: até ~32 letras por legenda, preferindo depois de pontuação (e nunca deixando uma palavra sozinha)
            for (let i = 0; i < ws.length; i++) { const w = ws[i], tam = cur.map(x => x.w.trim()).join(' ').length, pont = cur.length && /[.!?,;:]$/.test(cur[cur.length - 1].w.trim());
              if (cur.length && (tam + w.w.length > 32 || (pont && tam > 14)) && ws.length - i > 1) fecha(); cur.push(w); } fecha(); }
          else if (String(s.text || '').trim()) segs.push({ s: base + s.start, e: base + s.end, t: String(s.text).trim() });
        }
      }
      const fps = P.fps, de0 = a.de || 0, ini = this.ini(a), len = this.compr(a, b), Q = x => de0 + Math.round((x - ini) * fps);
      const novas = segs.filter(s => s.e > ini && s.s < ini + len).map(s => ({ de: Math.max(0, Q(s.s)), ate: Math.max(0, Q(s.e) - 1), texto: s.t, pal: (s.pal || []).filter(w => w[1] > ini && w[1] < ini + len).map(w => [w[0], Q(w[1]), Math.max(Q(w[1]), Q(w[2]) - 1)]) })).filter(g => g.ate >= g.de && g.de < P.duracao);
      P.legendas = (P.legendas || []).filter(g => g.ate < de0 || g.de > de0 + Math.ceil(len * fps)).concat(novas).sort((x, y) => x.de - y.de);
      t.remove(); App.commit('Legendas pela transcrição'); Lado.aba('som'); UI.toast(`${novas.length} legendas criadas pela fala.`, { kind: 'ok' });
    } catch (e) { t.remove(); UI.toast('Não deu para transcrever: ' + esc(e.message || e), { kind: 'err', time: 7000 }); }
  },
  wav64(f32, sr) {
    const n = f32.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, f32[i])) * 32767, true);
    let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s);
  },
};
