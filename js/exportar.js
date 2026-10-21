/* ===================== exportar.js — MP4 (H.264 + AAC, padrão do YouTube) e imagem do quadro ===================== */
'use strict';
const Exportar = {
  async abrir() {
    const P = App.P;
    const body = h(`<div><label class="field">Tamanho<select data-q><option value="1">${P.w}×${P.h} (original)</option><option value=".5">${Math.round(P.w / 2)}×${Math.round(P.h / 2)} (metade, mais rápido)</option></select></label>
      <label class="field">Quadros<div class="campo2"><input type="number" data-de value="1" min="1" style="width:70px"> até <input type="number" data-ate value="${P.duracao}" min="1" style="width:70px"> <small style="color:var(--tx3)">${P.fps} quadros por segundo</small></div></label>
      <div class="prog" hidden><div style="height:6px;border-radius:3px;background:var(--bg0);overflow:hidden"><i style="display:block;height:100%;width:0;background:#ddd"></i></div><p style="margin-top:6px" data-t></p></div></div>`);
    await UI.modal({ title: 'Exportar vídeo', icon: 'download', body, buttons: [
      { label: 'Imagem deste quadro', left: true, onClick: () => { this.png(); return false; } },
      { label: 'Fechar', value: null },
      { label: 'Exportar MP4', kind: 'primary', onClick: async api => {
        const bt = api.foot.querySelector('.btn.primary'); bt.disabled = true; $('.prog', body).hidden = false;
        try { await this.mp4({ q: +$('[data-q]', body).value, de: +$('[data-de]', body).value - 1, ate: +$('[data-ate]', body).value - 1, pr: (f, t) => { $('.prog i', body).style.width = (f * 100).toFixed(1) + '%'; $('[data-t]', body).textContent = t; } }); return true; }
        catch (e) { $('[data-t]', body).textContent = 'Não deu: ' + e.message; bt.disabled = false; return false; }
      } }] });
  },
  png() { const P = App.P, c = document.createElement('canvas'); c.width = P.w; c.height = P.h; Render.quadro(c.getContext('2d'), P, App.q, P.w, P.h); c.toBlob(b => downloadBlob(b, `${safeName(P.nome)} - quadro ${App.q + 1}.png`), 'image/png'); },
  folga() { return new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); }); },
  async h264(w, h, fps) {
    if (!window.VideoEncoder) return null; const px = w * h, lv = px <= 414720 ? ['1E', '1F', '28'] : px <= 921600 ? ['1F', '28', '2A'] : px <= 2228224 ? ['28', '2A', '32'] : ['33', '34'];
    for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) for (const L of lv) for (const pf of ['6400', '4D00', '42E0']) {
      const cfg = { codec: 'avc1.' + pf + L, width: w, height: h, bitrate: Math.round(px * fps * .12), framerate: fps, hardwareAcceleration: hw, avc: { format: 'avc' } };
      try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch { } }
    return null;
  },
  async mp4({ q = 1, de = 0, ate, pr }) {
    const P = App.P; App.pausa(); ate = clamp(ate ?? P.duracao - 1, de, P.duracao - 1);
    const W = Math.max(2, Math.round(P.w * q / 2) * 2), H = Math.max(2, Math.round(P.h * q / 2) * 2), fps = P.fps;
    const vcfg = await this.h264(W, H, fps); if (!vcfg) throw new Error('Este navegador não grava MP4. Use o Chrome ou o Edge atualizado.');
    const temSom = (P.audios || []).length > 0; let acfg = null;
    if (temSom && window.AudioEncoder) for (const c of [{ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 }, { codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2, bitrate: 192000 }]) { try { if ((await AudioEncoder.isConfigSupported(c)).supported) { acfg = c; break; } } catch { } }
    const mux = new Mp4Mux({ video: { width: W, height: H, fps }, audio: acfg ? { sampleRate: acfg.sampleRate, channels: 2 } : null });
    const bytes = d => d instanceof Uint8Array ? d : d.buffer ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength).slice() : new Uint8Array(d);
    let erro = null;
    // imagens de todos os personagens prontas antes de começar
    await Arq.garantir([...Object.values(P.personagens).flatMap(d => d.partes.flatMap(p => p.imgs.map(i => i.k))), ...Modelo.todos(P).filter(n => n.tipo === 'imagem').map(n => n.arq)]);
    if (acfg) {
      pr?.(0, 'Misturando o áudio…'); const mix = await Som.mistura(P, acfg.sampleRate), ini = Math.round(de / fps * acfg.sampleRate), fim = Math.min(mix.length, Math.round((ate + 1) / fps * acfg.sampleRate));
      const ae = new AudioEncoder({ output: (ch, meta) => { if (meta?.decoderConfig?.description) mux.setAudioConfig(bytes(meta.decoderConfig.description)); const d = new Uint8Array(ch.byteLength); ch.copyTo(d); mux.addAudio(d, Math.round((ch.duration || 0) * acfg.sampleRate / 1e6) || 1024); }, error: e => erro = e });
      ae.configure(acfg); const Lc = mix.getChannelData(0), Rc = mix.numberOfChannels > 1 ? mix.getChannelData(1) : Lc;
      for (let o = ini; o < fim; o += 4800) { const n = Math.min(4800, fim - o), dt = new Float32Array(n * 2); dt.set(Lc.subarray(o, o + n), 0); dt.set(Rc.subarray(o, o + n), n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: acfg.sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((o - ini) / acfg.sampleRate * 1e6), data: dt }); ae.encode(ad); ad.close(); if (ae.encodeQueueSize > 20) await this.folga(); }
      await ae.flush(); ae.close(); if (erro) throw erro;
    }
    const cv = new OffscreenCanvas(W, H), ctx = cv.getContext('2d'), n = ate - de + 1, gop = fps * 2;
    const ve = new VideoEncoder({ output: (ch, meta) => { if (meta?.decoderConfig?.description) mux.setVideoConfig(bytes(meta.decoderConfig.description)); const d = new Uint8Array(ch.byteLength); ch.copyTo(d); mux.addVideo(d, ch.type === 'key'); }, error: e => erro = e });
    ve.configure(vcfg);
    for (let i = 0; i < n; i++) {
      if (erro) throw erro; Render.quadro(ctx, P, de + i, W, H);
      const vf = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) }); ve.encode(vf, { keyFrame: i % gop === 0 }); vf.close();
      while (ve.encodeQueueSize > 4) await this.folga();
      if (i % 4 === 0) { pr?.((i + 1) / n, `Quadro ${i + 1} de ${n}`); await this.folga(); }
    }
    await ve.flush(); ve.close(); if (erro) throw erro;
    pr?.(1, 'Montando o arquivo…'); downloadBlob(mux.finish(), safeName(P.nome) + '.mp4'); UI.toast('Vídeo exportado!', { kind: 'ok' });
  },
};
