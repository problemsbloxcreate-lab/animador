/* ===================== limpar-audio.js — limpar ruído de áudio já gravado =====================
   Tira chiado/ruído de fundo (subtração espectral com o "perfil" do ruído medido nos trechos mais quietos),
   corta graves de vento/zumbido (passa-altas 80 Hz) e um portão suave nos silêncios. O original fica guardado. */
'use strict';
const LimparAudio = {
  fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < len / 2; j++) { const ur = re[i + j], ui = im[i + j], vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr; re[i + j] = ur + vr; im[i + j] = ui + vi; re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } } },
  channel(x, sr, forca) {
    const N = 2048, hop = N / 4, win = new Float32Array(N).map((_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / N)), frames = Math.max(1, Math.floor((x.length - N) / hop) + 1);
    // energia por quadro → quadros mais quietos = perfil do ruído
    const en = new Float32Array(frames); for (let f = 0; f < frames; f++) { let s = 0; for (let i = 0; i < N; i += 4) { const v = x[f * hop + i] || 0; s += v * v; } en[f] = s; }
    const order = [...en.keys()].sort((a, b) => en[a] - en[b]), quiet = order.slice(0, Math.max(3, frames * .1 | 0));
    const noise = new Float32Array(N / 2 + 1), re = new Float32Array(N), im = new Float32Array(N);
    for (const f of quiet) { for (let i = 0; i < N; i++) { re[i] = (x[f * hop + i] || 0) * win[i]; im[i] = 0; } this.fft(re, im); for (let k = 0; k <= N / 2; k++) noise[k] += Math.hypot(re[k], im[k]) / quiet.length; }
    const out = new Float32Array(x.length), norm = new Float32Array(x.length), a = 1 + 1.5 * forca, floor = .06 * (1 - forca) + .015;
    for (let f = 0; f < frames; f++) {
      for (let i = 0; i < N; i++) { re[i] = (x[f * hop + i] || 0) * win[i]; im[i] = 0; } this.fft(re, im);
      for (let k = 0; k <= N / 2; k++) { const mag = Math.hypot(re[k], im[k]), g = mag > 1e-9 ? Math.max(floor, (mag - a * noise[k]) / mag) : 0; re[k] *= g; im[k] *= g; if (k && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; } }
      for (let i = 0; i < N; i++) im[i] = -im[i]; this.fft(re, im); // inversa (conjugado)
      for (let i = 0; i < N; i++) { const j = f * hop + i; if (j >= x.length) break; out[j] += re[i] / N * win[i]; norm[j] += win[i] * win[i]; }
    }
    for (let i = 0; i < x.length; i++) out[i] = norm[i] > 1e-3 ? out[i] / norm[i] : 0;
    // passa-altas 80 Hz
    const rc = 1 / (2 * Math.PI * 80), dt = 1 / sr, al = rc / (rc + dt); let py = 0, px = 0; for (let i = 0; i < out.length; i++) { const y = al * (py + out[i] - px); px = out[i]; out[i] = py = y; }
    return out;
  },
  async clean(assetId, forca = .6) {
    const ctx = Assets.ctx(), buf = Assets.audioBuffer(assetId, ctx); if (!buf) throw new Error('áudio não carregado');
    const nb = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) { nb.copyToChannel(this.channel(buf.getChannelData(ch), buf.sampleRate, forca), ch); await new Promise(r => setTimeout(r, 0)); }
    const name = (Assets.meta(assetId)?.name || 'voz').replace(/\.[^.]+$/, '') + ' (sem ruído).wav', rt = await Assets.addBlob(audioBufferToWav(nb), name, App.project.id, 'audio'); App.project.bin.push(rt.meta.id); return rt.meta.id;
  },
  // pergunta a força e aplica no clipe (o original continua na mídia)
  async onClip(c) {
    const f = await UI.modal({ title: '🧹 Limpar ruído do áudio', icon: 'mic', body: '<p>Tira chiado e barulho de fundo da gravação. O áudio original continua guardado na Mídia (dá para desfazer).</p>', buttons: [{ label: 'Cancelar', value: null }, { label: 'Leve', value: .35 }, { label: 'Médio', kind: 'primary', value: .6 }, { label: 'Forte', value: .9 }] }); if (f == null) return;
    const b = UI.busy('🧹 Limpando o áudio…', '<div class="spinner"></div>');
    try { const id = await this.clean(c.assetId, f); c.assetId = id; if (c.type === 'video') { /* vídeo: separa o áudio limpo */ } App.commit('Áudio sem ruído', { toast: true }); }
    catch (e) { UI.toast('Não deu para limpar: ' + esc(e.message || e), { kind: 'err' }); } finally { b.close(); }
  },
};

/* ===================== atualizar projetos/.toon antigos para a versão nova ===================== */
const Upgrade = {
  VER: 4, // 4 = animação no mesmo fps do vídeo (keyframes nos quadros certos)
  need(p) { return (p.versaoEstudio || 1) < this.VER; },
  run(p = App.project, quiet) {
    const ch = [];
    if (!p.camera?.keys) { p.camera = { keys: {} }; ch.push('câmera animável'); }
    if (!p.settings.bg || p.settings.bg === '#000000') { p.settings.bg = '#ffffff'; ch.push('fundo da câmera branco (padrão novo)'); }
    for (const c of p.clips) {
      if (c.type === 'anim' && typeof RigEdit !== 'undefined' && RigEdit.syncFps(c, p.settings.fps)) ch.push('animação nos quadros do vídeo');
      if (c.type === 'anim') { const A = c.anim?.P || p.animLib?.[c.anim?.lib]; if (A) { A.camera ||= { keys: {} }; for (const r of A.rigs || []) for (const n of r.nodes) { n.drawings ||= []; if (n.tip == null && typeof Rig !== 'undefined') n.tip = Rig.computeTip(n); } } }
      if (c.type === 'shape' && c.shape && c.shape.fillAsset === undefined) c.shape.fillAsset = null;
    }
    if (!p.formato) { p.formato = p.settings.h > p.settings.w ? 'shorts' : 'video'; ch.push('formato ' + p.formato); }
    p.versaoEstudio = this.VER;
    if (!quiet) { App.commit('Projeto atualizado para a versão nova', { toast: true }); App.requestRender(); }
    return ch;
  },
  // projeto de antes desta versão: janela no meio pedindo para atualizar (o que muda aparece na lista)
  async offer() {
    const p = App.project; if (!p || !this.need(p) || this._asked === p.id) return; this._asked = p.id;
    for (let i = 0; i < 40 && document.querySelector('.modal-back'); i++) await new Promise(r => setTimeout(r, 250));
    let ch = []; try { const q = JSON.parse(JSON.stringify(p)); const keep = App.project; App.project = q; try { ch = this.run(q, true); } finally { App.project = keep; } } catch { }
    const ok = await UI.modal({ title: '🔄 Projeto de uma versão antiga', icon: 'info', width: 460,
      body: `<p>Este projeto foi feito numa versão anterior do Estúdio. Quer atualizar agora? Nada do seu trabalho é apagado.</p>${ch.length ? `<ul class="upg-l">${ch.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}<small>Dá para desfazer com Ctrl+Z.</small>`,
      buttons: [{ label: 'Agora não', value: false }, { label: '🔄 Atualizar o projeto', kind: 'primary', value: true }] });
    if (ok) { const done = this.run(); UI.toast('Projeto atualizado' + (done.length ? ': ' + done.join(', ') : ''), { kind: 'ok', time: 3000 }); }
  },
};
