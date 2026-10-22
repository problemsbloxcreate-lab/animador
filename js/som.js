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
  toca(q) {
    this.para(); const P = App.P, ac = this.ac(); ac.resume(); const t0 = ac.currentTime + .03;
    for (const a of P.audios || []) {
      const b = this.buf.get(a.arq); if (!b) continue; const off = (q - (a.de || 0)) / P.fps; if (off >= b.duration) continue;
      const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = b; this.agenda(g, a, q, t0, P.fps); src.connect(g).connect(ac.destination);
      if (off >= 0) src.start(t0, off); else src.start(t0 - off, 0); this.fontes.push(src);
    }
  },
  para() { for (const s of this.fontes) { try { s.stop(); } catch { } } this.fontes = []; },
  // ao passar os quadros, toca o pedacinho daquele quadro (bom para acertar a boca)
  raspa(q) {
    const P = App.P, ac = this.ac(); ac.resume();
    for (const a of P.audios || []) { const b = this.buf.get(a.arq); if (!b) continue; const off = (q - (a.de || 0)) / P.fps; if (off < 0 || off >= b.duration) continue;
      const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = b; g.gain.value = this.ganho(a, q) * .9; src.connect(g).connect(ac.destination); src.start(ac.currentTime, off, 1.2 / P.fps); }
  },
  // mistura tudo (para exportar)
  async mistura(P, sr = 48000) {
    const dur = P.duracao / P.fps, off = new OfflineAudioContext(2, Math.max(1, Math.ceil(dur * sr)), sr);
    for (const a of P.audios || []) { const b = await this.decod(a.arq); if (!b) continue; const src = off.createBufferSource(), g = off.createGain(); src.buffer = b; const t = (a.de || 0) / P.fps; this.agenda(g, a, a.de || 0, t, P.fps); src.connect(g).connect(off.destination); src.start(t); }
    return off.startRendering();
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
    let ultimo = null, desde = -9;
    for (let i = 0; i < pk.length; i++) {
      const q = (a.de || 0) + i; if (q < 0 || q >= P.duracao) continue; if (!Modelo.aparece(P, n, q)) continue;
      const v = pk[i] < sen ? 0 : Math.min(ordem.length - 1, 1 + Math.floor((pk[i] - sen) / (1 - sen) * (ordem.length - 1)));
      const id = ordem[v]; if (id === ultimo || (pula && q - desde < 2)) continue;
      const k = Modelo.chave(n, q); k.sessoes = { ...(k.sessoes || {}), [s.id]: id }; ultimo = id; desde = q;
    }
    const fim = (a.de || 0) + pk.length; if (fim < P.duracao) { const k = Modelo.chave(n, fim); k.sessoes = { ...(k.sessoes || {}), [s.id]: ordem[0] }; }
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
          if (ws.length) { let cur = []; const fecha = () => { if (!cur.length) return; segs.push({ s: base + cur[0].s, e: base + cur[cur.length - 1].e, t: cur.map(w => w.w.trim()).join(' ') }); cur = []; };
            for (const w of ws) { if (cur.length && cur.map(x => x.w).join(' ').length + w.w.length > 30) fecha(); cur.push(w); } fecha(); }
          else if (String(s.text || '').trim()) segs.push({ s: base + s.start, e: base + s.end, t: String(s.text).trim() });
        }
      }
      const fps = P.fps, de0 = a.de || 0;
      const novas = segs.map(s => ({ de: Math.max(0, de0 + Math.round(s.s * fps)), ate: Math.max(0, de0 + Math.round(s.e * fps) - 1), texto: s.t })).filter(g => g.ate >= g.de && g.de < P.duracao);
      P.legendas = (P.legendas || []).filter(g => g.ate < de0 || g.de > de0 + Math.ceil(b.duration * fps)).concat(novas).sort((x, y) => x.de - y.de);
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
