/* ===================== export.js — exportar MP4/WebM, GIF, WAV, PNG ===================== */
'use strict';

const Exporter = {
  // codecs H.264 com o "nível" certo para o tamanho do vídeo (nível baixo não aceita 1080p/4K)
  mp4List(w = 1920, h = 1080) {
    const px = w * h, lv = px <= 414720 ? ['1E', '1F', '28'] : px <= 921600 ? ['1F', '28', '2A'] : px <= 2228224 ? ['28', '2A', '32', '33'] : ['33', '34'];
    const l = [];
    lv.forEach(L => ['6400', '4D00', '42E0'].forEach(P => l.push(`video/mp4;codecs=avc1.${P}${L},mp4a.40.2`)));
    l.push('video/mp4;codecs=avc1,mp4a', 'video/mp4;codecs=avc1', 'video/mp4');
    return window.MediaRecorder ? l.filter(t => MediaRecorder.isTypeSupported(t)) : [];
  },
  webmList() { const l = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']; return window.MediaRecorder ? l.filter(t => MediaRecorder.isTypeSupported(t)) : []; },
  mp4Type() { return this.mp4List()[0] || null; },
  webmType() { return this.webmList()[0] || null; },
  // traduz os erros do navegador
  ptError(e) {
    const m = String(e?.message || e || ''), n = e?.name || '';
    if (/encoder configuration is not supported|not supported by the encoder/i.test(m)) return { title: 'O navegador não conseguiu gravar nesse formato', msg: 'O "gravador de vídeo" do seu navegador não aceita essa combinação de <b>formato (MP4/H.264)</b> com esse <b>tamanho de vídeo</b> e qualidade. Não é problema do seu projeto — é uma limitação do navegador/placa de vídeo.', fixes: ['webm', 'mp4low', 'half'] };
    if (/arquivo vazio|não gerou/i.test(m)) return { title: 'O vídeo saiu vazio', msg: 'O navegador terminou a gravação mas não entregou nenhum quadro. Isso acontece quando a aba fica em segundo plano ou o formato não é bem suportado.', fixes: ['webm', 'half'] };
    if (/NotSupported/i.test(n) || /not supported/i.test(m)) return { title: 'Formato não suportado', msg: 'Seu navegador não grava vídeo nesse formato.', fixes: ['webm', 'gif'] };
    if (/memory|out of memory|allocation/i.test(m)) return { title: 'Faltou memória', msg: 'O vídeo é grande demais para o navegador gravar agora. Feche outras abas ou exporte menor.', fixes: ['half', 'quarter', 'webm'] };
    return { title: 'A exportação falhou', msg: 'Aconteceu um erro inesperado durante a exportação.', fixes: ['webm', 'half'] };
  },
  async fail(e, fmt, opt) {
    const info = this.ptError(e), S = App.project.settings;
    const FIX = {
      webm: { label: 'Exportar em WebM', sub: 'Último recurso: outro formato (o YouTube também aceita).', run: () => this.run('webm', opt) },
      mp4low: { label: 'Tentar MP4 em 720p', sub: `Grava ${Math.round(S.w * Math.min(opt.q, 720 / Math.min(S.w, S.h)))}×${Math.round(S.h * Math.min(opt.q, 720 / Math.min(S.w, S.h)))}, que quase todo computador aceita em MP4.`, run: () => this.run('mp4', { ...opt, q: Math.min(opt.q, 720 / Math.min(S.w, S.h)) }) },
      half: { label: 'Exportar com metade do tamanho', sub: `${Math.round(S.w * opt.q / 2)}×${Math.round(S.h * opt.q / 2)} — mais leve para o computador.`, run: () => this.run(fmt, { ...opt, q: opt.q / 2 }) },
      quarter: { label: 'Exportar com 1/4 do tamanho', sub: `${Math.round(S.w * opt.q / 4)}×${Math.round(S.h * opt.q / 4)}`, run: () => this.run(fmt, { ...opt, q: opt.q / 4 }) },
      gif: { label: 'Exportar como GIF', sub: 'Sem som, mas sempre funciona.', run: () => this.run('gif', { ...opt, q: Math.min(opt.q, .5), fps: Math.min(opt.fps, 15) }) },
    };
    FIX.mp4rt = { label: 'Tentar MP4 pelo outro método', sub: 'Grava em tempo real com o gravador do navegador (um vídeo de 1 min leva ~1 min).', run: () => this.run('mp4', { ...opt, realtime: true }) };
    FIX.mp4wc = { label: 'Tentar MP4 quadro a quadro', sub: 'Monta o vídeo quadro a quadro (H.264 + AAC).', run: () => this.run('mp4', { ...opt, realtime: false }) };
    let order = info.fixes;
    if (fmt === 'mp4') order = [opt.realtime ? 'mp4wc' : 'mp4rt', 'mp4low', 'half', 'webm'];
    const fixes = order.filter(k => FIX[k] && !(k === 'webm' && fmt === 'webm') && !(k === 'mp4low' && (fmt !== 'mp4' || Math.min(S.w, S.h) * opt.q <= 720)));
    const body = h(`<div><p>${info.msg}</p><div class="lgroup" style="margin-top:4px">Como resolver — clique numa opção</div><div class="fix-list"></div>
      <details style="margin-top:10px;font-size:11.5px;color:var(--tx3)"><summary style="cursor:pointer">Detalhe técnico (em inglês, do navegador)</summary><code style="display:block;margin-top:6px;white-space:pre-wrap">${esc((e?.name ? e.name + ': ' : '') + (e?.message || e))}</code></details></div>`);
    let api;
    fixes.forEach((k, i) => { const f = FIX[k]; const b = h(`<button class="fix-btn ${i === 0 ? 'rec' : ''}"><div><b>${f.label}${i === 0 ? ' <span class="chip static">recomendado</span>' : ''}</b><small>${f.sub}</small></div>${ic('right', 16)}</button>`); b.onclick = () => { api.close(); f.run(); }; $('.fix-list', body).appendChild(b); });
    UI.modal({ title: info.title, icon: 'alert', kind: 'danger', width: 520, body, onOpen: a => api = a, buttons: [{ label: 'Fechar', value: null }] });
  },

  async open() {
    if (!App.project) return;
    if (App.playing) App.pause();
    const p = App.project, s = p.settings, dur = App.duration;
    if (dur <= 0) return UI.toast('A linha do tempo está vazia', { kind: 'warn' });
    const mp4 = this.mp4Type(), webm = this.webmType();
    const f = h(`<div><div class="fgrid">
      <label class="field full">Formato<select data-k="fmt">
        <option value="mp4">Vídeo MP4 — H.264 + AAC (padrão do YouTube, recomendado)</option>
        <option value="webm" ${webm ? '' : 'disabled'}>Vídeo WebM</option>
        <option value="gif">GIF animado (sem som)</option>
        <option value="wav">Só o áudio (WAV)</option>
        <option value="png">Imagem do quadro atual (PNG)</option>
      </select></label>
      <label class="field" data-v>Resolução<select data-k="scale"><option value="1">${s.w}×${s.h} (100%)</option><option value="0.75">${Math.round(s.w * .75)}×${Math.round(s.h * .75)} (75%)</option><option value="0.5">${Math.round(s.w / 2)}×${Math.round(s.h / 2)} (50%)</option><option value="0.25">${Math.round(s.w / 4)}×${Math.round(s.h / 4)} (25%)</option></select></label>
      <label class="field" data-v>Quadros/s<select data-k="fps">${[s.fps, 60, 30, 24, 15, 12, 10].filter((v, i, a) => a.indexOf(v) === i).map(v => `<option value="${v}">${v}${v === s.fps ? ' (do projeto)' : ''}</option>`).join('')}</select></label>
      <label class="field full" data-r>Trecho<select data-k="range"><option value="all">Projeto inteiro (${fmtTime(dur, s.fps)})</option><option value="cursor">Do cursor até o fim</option>${p.markers.length >= 2 ? '<option value="markers">Entre o 1º e o 2º marcador</option>' : ''}<option value="custom">Personalizado…</option></select></label>
      <label class="field hidden" data-c>De (s)<input type="text" data-k="from" value="0"></label><label class="field hidden" data-c>Até (s)<input type="text" data-k="to" value="${fmtNum(dur)}"></label>
      <label class="field full" data-au>Faixas de áudio<select data-k="audio"><option value="mix">Todas juntas (um arquivo só)</option><option value="stems">Separadas — um WAV por faixa (.zip, para DaVinci/Premiere)</option><option value="both">As duas coisas</option></select><small data-austems></small></label>
      <label class="field full" data-q>Qualidade<select data-k="bitrate"><option value="20">Máxima (arquivo grande)</option><option value="12" selected>Alta</option><option value="6">Média</option><option value="3">Leve</option></select></label>
      <div class="hint full" data-hv>${ic('info', 13)} O MP4 é montado <b>quadro a quadro</b> no formato que o YouTube recomenda (H.264 + AAC). Pode demorar um pouco em vídeos longos — não feche a página.</div>
      <div class="hint full hidden" data-hg>${ic('info', 13)} GIFs ficam pesados: use 50% ou menos e 10–15 quadros/s. Máximo recomendado: 20 segundos.</div>
    </div></div>`);
    const fmt = $('[data-k=fmt]', f); fmt.value = 'mp4';
    const upd = () => {
      const v = fmt.value, video = v === 'mp4' || v === 'webm';
      $$('[data-v]', f).forEach(x => x.classList.toggle('hidden', v === 'wav' || v === 'png'));
      $('[data-r]', f).classList.toggle('hidden', v === 'png'); $('[data-q]', f).classList.toggle('hidden', !video);
      $('[data-hv]', f).classList.toggle('hidden', !video); $('[data-hg]', f).classList.toggle('hidden', v !== 'gif');
      $('[data-au]', f).classList.toggle('hidden', !(video || v === 'wav'));
      const sel = $('[data-k=audio]', f); sel.options[0].textContent = video ? 'Só dentro do vídeo (todas juntas)' : 'Todas juntas (um arquivo só)'; sel.options[1].textContent = video ? 'Vídeo + um WAV separado por faixa (.zip)' : 'Separadas — um WAV por faixa (.zip, para DaVinci/Premiere)'; sel.options[2].style.display = video ? 'none' : ''; if (video && sel.value === 'both') sel.value = 'mix';
      if (v === 'gif') { $('[data-k=scale]', f).value = s.w > 1000 ? '0.25' : '0.5'; $('[data-k=fps]', f).value = [...$('[data-k=fps]', f).options].some(o => o.value === '15') ? '15' : $('[data-k=fps]', f).value; }
    };
    fmt.onchange = upd; upd();
    $('[data-k=range]', f).onchange = e => $$('[data-c]', f).forEach(x => x.classList.toggle('hidden', e.target.value !== 'custom'));
    const o = await UI.modal({ title: 'Exportar', icon: 'download', body: f, width: 500, enterValue: true, buttons: [{ label: 'Cancelar', value: null }, { label: 'Exportar', kind: 'primary', icon: 'download', collect: () => Actions.readForm(f) }] });
    if (!o) return;
    let from = 0, to = dur;
    if (o.range === 'cursor') from = Math.min(App.t, dur - .05);
    if (o.range === 'markers') { const m = [...p.markers].sort((a, b) => a.t - b.t); from = m[0].t; to = m[1].t; }
    if (o.range === 'custom') { from = clamp(parseNum(o.from) || 0, 0, dur); to = clamp(parseNum(o.to) || dur, from + .05, dur); }
    const opt = { from, to, q: +o.scale || 1, fps: +o.fps || s.fps, bitrate: (+o.bitrate || 12) * 1e6, audio: o.audio || 'mix' };
    return this.run(o.fmt, opt);
  },
  async run(fmt, opt) {
    Notify.ask();
    try {
      if (fmt === 'png') return this.snapshot();
      if (fmt === 'wav') { if (opt.audio !== 'stems') await this.wav(opt); if (opt.audio !== 'mix') await this.stems(opt); return; }
      if (fmt === 'gif') return await this.gif(opt);
      if (fmt === 'mp4' && !opt.realtime) {
        const ok = await this.mp4Encode(opt);
        if (ok) { if (opt.audio === 'stems' && !this.lastCancelled) await this.stems(opt); return; }
      }
      const S = App.project.settings, w = Math.round(S.w * opt.q / 2) * 2, hh = Math.round(S.h * opt.q / 2) * 2;
      const list = fmt === 'mp4' ? this.mp4List(w, hh) : this.webmList();
      if (!list.length) throw Object.assign(new Error('MediaRecorder: format not supported'), { name: 'NotSupportedError' });
      let last = null;
      for (const mime of list) { // tenta cada codec; se o navegador recusar logo no começo, passa para o próximo sozinho
        try { await this.video(mime, fmt, opt); last = null; break; }
        catch (e) { last = e; if (!e.early) break; console.warn('codec recusado, tentando outro:', mime, e.message); }
      }
      if (last) throw last;
      if (opt.audio === 'stems' && !this.lastCancelled) await this.stems(opt);
    } catch (e) { console.error(e); this.fail(e, fmt, opt); }
  },
  fileName(ext) { return safeName(App.project.name) + '.' + ext; },

  progressModal(title, realtime, background) {
    let cancel = false, api;
    UI.modal({ title, icon: 'download', noClose: true, width: realtime || background ? 520 : undefined, body: `${background ? `<div class="hint" style="margin:0 0 12px;border-color:var(--ok)">${ic('check', 13)} <b>Pode minimizar ou usar outra aba</b> — a exportação continua sozinha e eu aviso com uma notificação quando terminar (o progresso aparece no título da aba). Só não feche esta página.</div>` : ''}${realtime ? `<div class="big-warn">${ic('alert', 26)}<div><b>NÃO troque de aba, não minimize e não feche esta janela</b><span>O vídeo é gravado em tempo real. Se sair daqui, o vídeo fica travado. Espere terminar.</span></div></div>` : ''}<p data-msg>Preparando…</p><div class="progress"><i></i></div><p data-sub style="font-size:12px;color:var(--tx3)"></p>`, buttons: [{ label: 'Cancelar', onClick: () => { cancel = true; return false; } }], onOpen: a => api = a });
    return { set(p, msg, sub) { TabTitle.set(clamp(p, 0, 1), title.replace('…', '')); if (!api) return; $('.progress i', api.body).style.width = clamp(p, 0, 1) * 100 + '%'; if (msg) $('[data-msg]', api.body).innerHTML = msg; if (sub !== undefined) $('[data-sub]', api.body).innerHTML = sub; }, get cancelled() { return cancel; }, close() { TabTitle.clear(); api && api.close(); } };
  },
  async done(blob, name, kind) {
    const url = URL.createObjectURL(blob);
    TabTitle.clear(); Notify.send('Exportação pronta!', `${name} · ${fmtBytes(blob.size)} — clique para baixar.`);
    const note = arguments[3] || '';
    const prev = (kind === 'video' && note ? `<div class="hint" style="border-color:var(--warn)">${note}</div>` : '') + (kind === 'video' ? `<video class="export-prev" src="${url}" controls></video>` : kind === 'gif' || kind === 'png' ? `<img class="export-prev" src="${url}">` : kind === 'zip' ? `<div class="hint">${ic('package', 14)} ${note}</div>` : `<audio src="${url}" controls style="width:100%"></audio>`);
    const r = await UI.modal({ title: 'Pronto!', icon: 'check', kind: 'ok', width: 520, body: `${prev}<p style="margin-top:10px"><b>${esc(name)}</b> · ${fmtBytes(blob.size)}</p>`, buttons: [{ label: 'Fechar', value: false }, { label: 'Baixar arquivo', kind: 'primary', icon: 'download', value: true }] });
    if (r) downloadBlob(blob, name);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },

  /* ---------- MP4 do jeito do YouTube: H.264 + AAC, quadro a quadro (WebCodecs) ---------- */
  yieldNow() { return new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); }); },
  async pickH264(w, h, fps, bitrate) {
    if (!window.VideoEncoder) return null;
    const px = w * h, lv = px <= 414720 ? ['1E', '1F', '28'] : px <= 921600 ? ['1F', '28', '2A'] : px <= 2228224 ? ['28', '2A', '32'] : ['33', '34'];
    const codecs = [], found = []; lv.forEach(L => ['6400', '4D00', '42E0', '4200'].forEach(P => codecs.push('avc1.' + P + L)));
    for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) for (const codec of codecs) {
      const cfg = { codec, width: w, height: h, bitrate, framerate: fps, hardwareAcceleration: hw, avc: { format: 'avc' }, latencyMode: 'quality' };
      try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) { found.push(cfg); break; } } catch { }
    }
    return found.length ? found : null;
  },
  async pickAAC(sr) {
    if (!window.AudioEncoder) return null;
    for (const cfg of [{ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: 2, bitrate: 192000 }, { codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2, bitrate: 192000 }]) {
      try { const r = await AudioEncoder.isConfigSupported(cfg); if (r.supported) return cfg; } catch { }
    }
    return null;
  },
  async mp4Encode({ from, to, q, fps, bitrate }) {
    const p = App.project, S = p.settings;
    const W = Math.max(2, Math.round(S.w * q / 2) * 2), H = Math.max(2, Math.round(S.h * q / 2) * 2);
    const vcfg = await this.pickH264(W, H, fps, bitrate);
    if (!vcfg) return false; // navegador sem H.264 no WebCodecs → usa o outro método
    const hasSound = AudioEngine.items(p).some(it => it.start < to && it.start + (it.oneShot ? 5 : it.dur) > from);
    const acfg = hasSound ? await this.pickAAC(48000) : null;
    if (hasSound && !acfg) return false;
    if (App.playing) App.pause();
    const pr = this.progressModal('Criando o MP4…', false, true);
    const toYield = () => this.yieldNow();
    const mux = new Mp4Mux({ video: { width: W, height: H, fps }, audio: acfg ? { sampleRate: acfg.sampleRate, channels: 2 } : null });
    let err = null; const t0 = performance.now();
    const asBytes = d => d instanceof Uint8Array ? d : d.buffer ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength).slice() : new Uint8Array(d);
    try {
      // 1) áudio: mistura tudo e codifica em AAC
      if (acfg) {
        pr.set(0, 'Misturando o áudio…', 'Formato: MP4 · vídeo H.264 · áudio AAC (o padrão do YouTube)');
        const buf = await AudioEngine.renderMix(p, from, to, acfg.sampleRate);
        const ae = new AudioEncoder({ output: (ch, meta) => { if (meta?.decoderConfig?.description) mux.setAudioConfig(asBytes(meta.decoderConfig.description)); const d = new Uint8Array(ch.byteLength); ch.copyTo(d); mux.addAudio(d, Math.round((ch.duration || 0) * acfg.sampleRate / 1e6) || 1024); }, error: e => err = e });
        ae.configure(acfg);
        const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, step = 4800;
        for (let o = 0; o < buf.length; o += step) {
          const n = Math.min(step, buf.length - o), data = new Float32Array(n * 2); data.set(L.subarray(o, o + n), 0); data.set(R.subarray(o, o + n), n);
          const ad = new AudioData({ format: 'f32-planar', sampleRate: acfg.sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(o / acfg.sampleRate * 1e6), data });
          ae.encode(ad); ad.close();
          if (ae.encodeQueueSize > 20) await toYield();
        }
        await ae.flush(); ae.close();
        if (err) throw err;
      }
      // 2) vídeo: desenha cada quadro e codifica em H.264 (se o codificador recusar no começo, tenta o próximo sozinho)
      const cv = document.createElement('canvas'), qq = W / S.w, n = Math.max(1, Math.round((to - from) * fps)), gop = Math.max(1, Math.round(fps * 2));
      let done = false;
      for (let ci = 0; ci < vcfg.length && !done; ci++) {
        const cfg = vcfg[ci]; err = null; mux.v = []; mux.vKeys = []; mux.avcC = null;
        let ve;
        try {
          ve = new VideoEncoder({ output: (ch, meta) => { if (meta?.decoderConfig?.description) mux.setVideoConfig(asBytes(meta.decoderConfig.description)); const d = new Uint8Array(ch.byteLength); ch.copyTo(d); mux.addVideo(d, ch.type === 'key'); }, error: e => err = e });
          ve.configure(cfg);
          for (let i = 0; i < n; i++) {
            if (pr.cancelled) { try { ve.close(); } catch { } pr.close(); App.requestRender(); UI.toast('Exportação cancelada', { kind: 'warn' }); this.lastCancelled = true; return true; }
            if (err) throw err;
            const t = from + i / fps;
            await Renderer.prepare(p, t);
            Renderer.render(cv, p, t, { q: qq, noSync: true });
            let src = cv; if (cv.width !== W || cv.height !== H) { src = document.createElement('canvas'); src.width = W; src.height = H; src.getContext('2d').drawImage(cv, 0, 0, W, H); }
            const vf = new VideoFrame(src, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
            ve.encode(vf, { keyFrame: i % gop === 0 }); vf.close();
            while (ve.encodeQueueSize > 4) { await toYield(); if (err) throw err; }
            if (i % 3 === 0) {
              const el = (performance.now() - t0) / 1000, eta = i > 10 ? el / (i + 1) * (n - i - 1) : null;
              pr.set((i + 1) / n, `Quadro <b>${i + 1}</b> de ${n} · ${fmtTime(t - from, fps)}`, `MP4 · H.264 + AAC (padrão do YouTube) · ${W}×${H}${eta !== null ? ` · falta ~${eta < 60 ? Math.ceil(eta) + 's' : Math.ceil(eta / 60) + ' min'}` : ''}`);
              await toYield();
            }
          }
          await ve.flush(); if (err) throw err; ve.close(); done = true;
        } catch (e) {
          try { ve && ve.state !== 'closed' && ve.close(); } catch { }
          const early = mux.v.length < fps; console.warn('H.264', cfg.codec, cfg.hardwareAcceleration, e);
          if (!early || ci === vcfg.length - 1) throw e;
          pr.set(0, 'Tentando outro codificador de vídeo…');
        }
      }
      if (!mux.v.length) throw new Error('O codificador não devolveu nenhum quadro (arquivo vazio).');
      pr.set(1, 'Montando o arquivo MP4…');
      const blob = mux.finish();
      pr.close(); App.requestRender();
      this.lastCancelled = false;
      await this.done(blob, this.fileName('mp4'), 'video', '');
      return true;
    } catch (e) { pr.close(); App.requestRender(); throw e; }
  },

  /* ---------- vídeo em tempo real ---------- */
  async video(mime, ext, { from, to, q, fps, bitrate }) {
    const p = App.project, cv = document.createElement('canvas');
    cv.width = Math.round(p.settings.w * q / 2) * 2; cv.height = Math.round(p.settings.h * q / 2) * 2;
    const pr = this.progressModal('Gravando vídeo…', true);
    if (App.playing) App.pause();
    let hiddenTime = 0, hidAt = null;
    const onVis = () => { if (document.hidden) hidAt = performance.now(); else if (hidAt) { hiddenTime += performance.now() - hidAt; hidAt = null; } };
    document.addEventListener('visibilitychange', onVis);
    let nodes = [], rec = null;
    try {
      pr.set(0, 'Carregando os vídeos do projeto…');
      await Renderer.prepare(p, from);
      const qq = cv.width / p.settings.w;
      Renderer.render(cv, p, from, { q: qq, noSync: true });
      const stream = cv.captureStream(fps);
      const ctx = Assets.ctx();
      if (ctx.state !== 'running') { try { await Promise.race([ctx.resume(), sleep(600)]); } catch { } }
      const dest = ctx.createMediaStreamDestination();
      // fonte silenciosa: sem ela, quando não há som nenhum, o gravador fica esperando o áudio e o vídeo sai vazio
      let keep = null;
      if (ctx.state === 'running') { keep = ctx.createConstantSource(); keep.offset.value = 0; keep.connect(dest); keep.start(); const at = dest.stream.getAudioTracks()[0]; if (at) stream.addTrack(at); }
      const chunks = []; let recErr = null;
      try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: 192000 }); }
      catch (e) { e.early = true; throw e; }
      rec.ondataavailable = e => e.data && e.data.size && chunks.push(e.data);
      rec.onerror = e => { recErr = e.error || new Error('MediaRecorder error'); };
      const stopped = new Promise(r => rec.onstop = r);
      // relógio: tempo real da tela (o áudio é agendado junto)
      const lead = .3, wall0 = performance.now() + lead * 1000;
      if (ctx.state === 'running') nodes = AudioEngine.schedule(ctx, dest, p, from, ctx.currentTime + lead, to);
      if (keep) nodes.push(keep);
      await sleep(Math.max(0, wall0 - performance.now() - 15));
      rec.start(250);
      let cancelled = false, frames = 0;
      await new Promise(resolve => {
        const step = () => {
          if (pr.cancelled || recErr) { cancelled = pr.cancelled; return resolve(); }
          const t = from + Math.max(0, (performance.now() - wall0) / 1000);
          Renderer.render(cv, p, Math.min(t, to - 1e-3), { q: qq, playing: performance.now() >= wall0, fps });
          if (cv.captureStream && stream.getVideoTracks()[0]?.requestFrame) { try { stream.getVideoTracks()[0].requestFrame(); } catch { } }
          frames++;
          pr.set((t - from) / (to - from), `Gravando… <b>${fmtTime(Math.max(0, t - from), fps)}</b> de ${fmtTime(to - from, fps)}`);
          if (t >= to) return resolve();
          setTimeout(step, Math.max(4, 1000 / fps / 2));
        };
        step();
      });
      await sleep(150);
      rec.stop(); await Promise.race([stopped, sleep(4000)]);
      this.lastCancelled = cancelled;
      if (cancelled) return UI.toast('Exportação cancelada', { kind: 'warn' });
      if (recErr) { const er = recErr instanceof Error ? recErr : new Error(String(recErr.message || recErr)); er.early = frames < fps * 1.5 && !chunks.length; throw er; }
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      if (blob.size < 2000) throw new Error(`O navegador não gerou o vídeo (${frames} quadros desenhados, arquivo vazio). Tente WebM, uma resolução menor (50%) ou atualize o Chrome/Edge.`);
      pr.close();
      await this.done(blob, this.fileName(ext), 'video', hiddenTime > 300 ? `${ic('alert', 13)} Você saiu da aba durante a gravação — partes do vídeo podem ter ficado travadas. Se notar, exporte de novo sem trocar de aba.` : '');
    } finally {
      document.removeEventListener('visibilitychange', onVis);
      nodes.forEach(n => { try { n.stop && n.stop(); } catch { } try { n.disconnect(); } catch { } });
      if (rec && rec.state !== 'inactive') try { rec.stop(); } catch { }
      VideoPool.pauseAll(); pr.close(); App.requestRender();
    }
  },

  /* ---------- áudio WAV ---------- */
  async stems({ from, to }) {
    const tks = AudioEngine.soundTracks(App.project);
    if (!tks.length) return UI.toast('Nenhuma faixa tem som', { kind: 'warn' });
    const pr = this.progressModal('Separando as faixas de áudio…');
    try {
      const files = await AudioEngine.renderStems(App.project, from, to, (p, n) => pr.set(p, `Faixa: <b>${esc(n)}</b>`, `${tks.length} faixa(s) com som`));
      pr.close();
      const zip = Zip.create(files);
      await this.done(zip, safeName(App.project.name) + ' - faixas de audio.zip', 'zip', `${files.length} arquivos WAV: ${files.map(f => esc(f.name)).join(', ')}`);
    } catch (e) { pr.close(); throw e; }
  },
  async wav({ from, to }) {
    const b = UI.busy('Gerando áudio…', '<div class="spinner"></div><p style="text-align:center">Misturando todas as faixas…</p>');
    try { const buf = await AudioEngine.renderMix(App.project, from, to); b.close(); await this.done(audioBufferToWav(buf), this.fileName('wav'), 'audio'); }
    catch (e) { b.close(); throw e; }
  },

  /* ---------- PNG ---------- */
  async snapshot() {
    const p = App.project, cv = document.createElement('canvas');
    await Renderer.prepare(p, App.t);
    Renderer.render(cv, p, App.t, { q: 1, noSync: true });
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    App.requestRender();
    await this.done(blob, safeName(p.name) + '_' + fmtTime(App.t, p.settings.fps).replace(/:/g, '-') + '.png', 'png');
  },

  /* ---------- GIF (quadro a quadro) ---------- */
  async gif({ from, to, q, fps }) {
    const p = App.project, cv = document.createElement('canvas');
    const W = Math.max(2, Math.round(p.settings.w * q)), H = Math.max(2, Math.round(p.settings.h * q));
    const n = Math.max(1, Math.round((to - from) * fps));
    if (n > 600 && !await UI.confirm({ title: 'GIF muito longo', msg: `Serão <b>${n} quadros</b>. Isso pode demorar e gerar um arquivo bem pesado. Continuar?`, ok: 'Continuar' })) return;
    const pr = this.progressModal('Criando GIF…');
    const enc = new GifEncoder(W, H);
    const delay = Math.round(100 / fps);
    for (let i = 0; i < n; i++) {
      if (pr.cancelled) { pr.close(); App.requestRender(); return UI.toast('Exportação cancelada', { kind: 'warn' }); }
      const t = from + i / fps;
      await Renderer.prepare(p, t);
      Renderer.render(cv, p, t, { q: W / p.settings.w, noSync: true });
      const id = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
      enc.addFrame(id.data, delay);
      pr.set((i + 1) / n, `Quadro ${i + 1} de ${n}`);
      if (i % 2 === 0) await this.yieldNow();
    }
    const blob = enc.finish(); pr.close(); App.requestRender();
    await this.done(blob, this.fileName('gif'), 'gif');
  },
};

/* ---------- Codificador de GIF (paleta por quadro + LZW) ---------- */
class GifEncoder {
  constructor(w, h) { this.w = w; this.h = h; this.out = []; this.head(); }
  bytes(...b) { this.out.push(...b); }
  u16(v) { this.out.push(v & 255, (v >> 8) & 255); }
  head() {
    for (const c of 'GIF89a') this.out.push(c.charCodeAt(0));
    this.u16(this.w); this.u16(this.h); this.bytes(0x70, 0, 0); // sem paleta global
    this.bytes(0x21, 0xFF, 11); for (const c of 'NETSCAPE2.0') this.out.push(c.charCodeAt(0)); this.bytes(3, 1, 0, 0, 0); // repetir sempre
  }
  palette(px) {
    const hist = new Uint32Array(4096);
    for (let i = 0; i < px.length; i += 4) hist[((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4)]++;
    const bins = []; for (let i = 0; i < 4096; i++) if (hist[i]) bins.push(i);
    bins.sort((a, b) => hist[b] - hist[a]);
    const pal = bins.slice(0, 256).map(b => [((b >> 8) & 15) * 17, ((b >> 4) & 15) * 17, (b & 15) * 17]);
    while (pal.length < 256) pal.push([0, 0, 0]);
    // mapa: bin -> índice mais próximo
    const map = new Uint8Array(4096), n = Math.min(256, bins.length || 1);
    for (const b of bins) {
      const r = ((b >> 8) & 15) * 17, g = ((b >> 4) & 15) * 17, bl = (b & 15) * 17; let best = 0, bd = Infinity;
      for (let j = 0; j < n; j++) { const d = (pal[j][0] - r) ** 2 + (pal[j][1] - g) ** 2 + (pal[j][2] - bl) ** 2; if (d < bd) { bd = d; best = j; if (!d) break; } }
      map[b] = best;
    }
    return { pal, map };
  }
  addFrame(px, delay) {
    const { pal, map } = this.palette(px), N = this.w * this.h, idx = new Uint8Array(N);
    // pontilhado ordenado leve para suavizar degradês
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let i = 0, p = 0; i < N; i++, p += 4) {
      const x = i % this.w, y = (i / this.w) | 0, d = (bayer[(y & 3) * 4 + (x & 3)] - 7.5) * 1.1;
      const r = clamp(px[p] + d, 0, 255), g = clamp(px[p + 1] + d, 0, 255), b = clamp(px[p + 2] + d, 0, 255);
      idx[i] = map[((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)];
    }
    this.bytes(0x21, 0xF9, 4, 0x04, delay & 255, (delay >> 8) & 255, 0, 0);
    this.bytes(0x2C); this.u16(0); this.u16(0); this.u16(this.w); this.u16(this.h); this.bytes(0x87);
    for (const c of pal) this.bytes(c[0], c[1], c[2]);
    this.lzw(idx, 8);
  }
  lzw(idx, minCode) {
    this.bytes(minCode);
    const clear = 1 << minCode, eoi = clear + 1; let size = minCode + 1, next = eoi + 1;
    let dict = new Map(), buf = 0, nb = 0; const block = [];
    const emit = code => { buf |= code << nb; nb += size; while (nb >= 8) { block.push(buf & 255); buf >>= 8; nb -= 8; if (block.length === 255) { this.out.push(255, ...block); block.length = 0; } } };
    emit(clear);
    let cur = idx[0];
    for (let i = 1; i < idx.length; i++) {
      const k = idx[i], key = cur * 256 + k, f = dict.get(key);
      if (f !== undefined) { cur = f; continue; }
      emit(cur);
      if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; }
      else { emit(clear); dict = new Map(); size = minCode + 1; next = eoi + 1; }
      cur = k;
    }
    emit(cur); if (next >= (1 << size) && size < 12) size++; emit(eoi);
    if (nb > 0) block.push(buf & 255);
    for (let i = 0; i < block.length; i += 255) { const s = block.slice(i, i + 255); this.out.push(s.length, ...s); }
    this.out.push(0);
  }
  finish() { this.out.push(0x3B); return new Blob([new Uint8Array(this.out)], { type: 'image/gif' }); }
}
