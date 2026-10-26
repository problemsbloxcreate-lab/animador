/* ===================== exportar.js — MP4 (H.264 + AAC, padrão do YouTube) e imagem do quadro ===================== */
'use strict';
const Exportar = {
  /* ---------- JANELA DE EXPORTAR: nome do arquivo (ou o do projeto), o que exportar (vídeo MP4, imagem do quadro, só o som, .animador),
     tamanho, qualidade, trecho (tudo / marcado na régua / quadros), som e legendas, com a duração em min:seg e o tamanho estimado.
     Enquanto exporta a janela NÃO fecha (Esc, clique fora e o X ficam travados; dá para cancelar) e mostra quadro X de N, tempo passado e o que falta. ---------- */
  tc(seg) { seg = Math.max(0, seg); const m = Math.floor(seg / 60), s = Math.floor(seg % 60), cs = Math.floor((seg % 1) * 10); return `${m}:${String(s).padStart(2, '0')}${cs ? ',' + cs : ''}`; },
  dur(seg) { seg = Math.round(seg); if (seg < 60) return `${seg} s`; const m = Math.floor(seg / 60), s = seg % 60; return m < 60 ? `${m} min${s ? ` ${s} s` : ''}` : `${Math.floor(m / 60)} h ${m % 60} min`; },
  QUAL: { normal: { nome: 'Normal', k: .08 }, alta: { nome: 'Alta', k: .12 }, max: { nome: 'Máxima', k: .2 } },
  async abrir() {
    const P = App.P, cfg = { nomeProj: true, nome: P.nome, tipo: 'mp4', q: 1, qual: 'alta', trecho: Folha.trecho ? 'marcado' : 'tudo', de: 0, ate: P.duracao - 1, som: true, leg: true, ...(P.exportar || {}) };
    if (cfg.nomeProj) cfg.nome = P.nome; const temSom = (P.audios || []).length > 0, temLeg = (P.legendas || []).length > 0;
    const TIPOS = [['mp4', 'film', 'Vídeo MP4', 'com imagem e som'], ['png', 'image', 'Imagem', 'só o quadro de agora (PNG)'], ['wav', 'music', 'Só o som', 'a mistura em WAV'], ['animador', 'file', 'Arquivo .animador', 'para abrir aqui de novo']];
    const body = h(`<div class="exp">
      <div class="rv-banner" data-rv hidden></div>
      <div class="exp-sec"><label class="exp-l">Nome do arquivo</label>
        <div class="exp-nome"><input type="text" data-nome maxlength="80" value="${esc(cfg.nome)}"><span class="exp-ext" data-ext>.mp4</span></div>
        <label class="chk"><input type="checkbox" data-np ${cfg.nomeProj ? 'checked' : ''}> Usar o nome do projeto</label></div>
      <div class="exp-sec"><label class="exp-l">O que exportar</label><div class="exp-tipos">${TIPOS.map(([id, icn, nm, d]) => `<button class="exp-tipo" data-tipo="${id}">${ic(icn, 18)}<b>${nm}</b><small>${d}</small></button>`).join('')}</div></div>
      <div class="exp-sec" data-so="mp4"><div class="exp-grade">
        <label class="exp-c"><span class="exp-l">Tamanho</span><select data-q>${[[1, 'Original'], [.75, '75%'], [.5, 'Metade (mais rápido)'], [.25, 'Um quarto (rascunho)']].map(([v, n]) => `<option value="${v}" ${+cfg.q === v ? 'selected' : ''}>${n} · ${Math.round(P.w * v / 2) * 2}×${Math.round(P.h * v / 2) * 2}</option>`).join('')}</select></label>
        <label class="exp-c"><span class="exp-l">Qualidade</span><select data-qual>${Object.entries(this.QUAL).map(([id, x]) => `<option value="${id}" ${cfg.qual === id ? 'selected' : ''}>${x.nome}</option>`).join('')}</select></label></div></div>
      <div class="exp-sec" data-so="mp4 wav"><label class="exp-l">Trecho</label>
        <div class="exp-seg"><button data-tr="tudo">Tudo</button><button data-tr="marcado" ${Folha.trecho ? '' : 'disabled title="Marque um trecho na régua da timeline (Shift + arrastar)"'}>Marcado na régua</button><button data-tr="quadros">Escolher os quadros</button></div>
        <div class="exp-quadros" data-qd><span>do quadro</span><input type="number" data-de min="1" max="${P.duracao}"><span>até</span><input type="number" data-ate min="1" max="${P.duracao}"></div></div>
      <div class="exp-sec exp-ops" data-so="mp4"><label class="chk"><input type="checkbox" data-som ${cfg.som && temSom ? 'checked' : ''} ${temSom ? '' : 'disabled'}> Com som${temSom ? '' : ' (não tem áudio)'}</label><label class="chk"><input type="checkbox" data-leg ${cfg.leg ? 'checked' : ''} ${temLeg ? '' : 'disabled'}> Com legendas${temLeg ? '' : ' (não tem)'}</label></div>
      <div class="exp-resumo" data-res></div>
      <div class="exp-prog" hidden><div class="exp-barra"><i></i></div><div class="exp-pt"><b data-pp>0%</b><span data-pt></span><span class="sp"></span><span data-pr></span></div></div>
      <div class="exp-fim" hidden></div></div>`);
    const $b = s => $(s, body), nm = $b('[data-nome]'), lim = () => { const [de, ate] = this.limites(P, cfg); return { de, ate, n: ate - de + 1 }; };
    const pinta = () => {
      $$('[data-tipo]', body).forEach(b => b.classList.toggle('on', b.dataset.tipo === cfg.tipo)); $$('[data-tr]', body).forEach(b => b.classList.toggle('on', b.dataset.tr === cfg.trecho));
      $$('[data-so]', body).forEach(s => s.hidden = !s.dataset.so.split(' ').includes(cfg.tipo)); $b('[data-qd]').hidden = cfg.trecho !== 'quadros';
      $b('[data-ext]').textContent = { mp4: '.mp4', png: `.png`, wav: '.wav', animador: '.animador' }[cfg.tipo]; nm.disabled = cfg.nomeProj; if (cfg.nomeProj) nm.value = P.nome;
      const L = lim(), seg = L.n / P.fps, W = Math.round(P.w * cfg.q / 2) * 2, H = Math.round(P.h * cfg.q / 2) * 2;
      $b('[data-de]').value = L.de + 1; $b('[data-ate]').value = L.ate + 1;
      const mb = cfg.tipo === 'mp4' ? (W * H * P.fps * this.QUAL[cfg.qual].k * seg / 8 + (cfg.som && temSom ? 192000 / 8 * seg : 0)) / 1048576 : cfg.tipo === 'wav' ? seg * 48000 * 4 / 1048576 : 0;
      $b('[data-res]').innerHTML = cfg.tipo === 'png' ? `${ic('image', 14)} Quadro ${App.q + 1} (${this.tc(App.q / P.fps)}) · ${P.w}×${P.h}`
        : cfg.tipo === 'animador' ? `${ic('file', 14)} O projeto inteiro com personagens, imagens e sons, para abrir no Animador`
        : `${ic('clock', 14)} <b>${this.dur(seg)}</b> <span>(${this.tc(L.de / P.fps)} → ${this.tc((L.ate + 1) / P.fps)} · ${L.n} quadros a ${P.fps} fps)</span>${cfg.tipo === 'mp4' ? ` · ${W}×${H}` : ''}${mb ? ` · cerca de ${mb < 10 ? mb.toFixed(1).replace('.', ',') : Math.round(mb)} MB` : ''}`;
      P.exportar = { ...cfg, nome: cfg.nomeProj ? undefined : cfg.nome };
    };
    nm.oninput = () => { cfg.nome = nm.value; }; $b('[data-np]').onchange = e => { cfg.nomeProj = e.target.checked; if (!cfg.nomeProj) cfg.nome = nm.value || P.nome; pinta(); if (!cfg.nomeProj) nm.focus(); };
    $$('[data-tipo]', body).forEach(b => b.onclick = () => { cfg.tipo = b.dataset.tipo; pinta(); botao(); });
    $$('[data-tr]', body).forEach(b => b.onclick = () => { cfg.trecho = b.dataset.tr; if (b.dataset.tr === 'quadros') { const L = lim(); cfg.de = L.de; cfg.ate = L.ate; } pinta(); });
    $b('[data-de]').onchange = e => { cfg.trecho = 'quadros'; cfg.de = clamp(+e.target.value - 1, 0, P.duracao - 1); if (cfg.ate < cfg.de) cfg.ate = cfg.de; pinta(); };
    $b('[data-ate]').onchange = e => { cfg.trecho = 'quadros'; cfg.ate = clamp(+e.target.value - 1, 0, P.duracao - 1); if (cfg.ate < cfg.de) cfg.de = cfg.ate; pinta(); };
    $b('[data-q]').onchange = e => { cfg.q = +e.target.value; pinta(); }; $b('[data-qual]').onchange = e => { cfg.qual = e.target.value; pinta(); };
    $b('[data-som]').onchange = e => { cfg.som = e.target.checked; pinta(); }; $b('[data-leg]').onchange = e => { cfg.leg = e.target.checked; };
    // REVISOR: antes de exportar, mostra quantas coisas achou
    Revisor.conta(P).then(r => { const el = $b('[data-rv]'); if (!el || !(r.erro + r.aviso + r.dica)) return; el.hidden = false; el.className = 'rv-banner ' + (r.erro ? 'rv-erro' : r.aviso ? 'rv-aviso' : 'rv-dica');
      el.innerHTML = `${ic(r.erro + r.aviso ? 'alert' : 'info', 15)}<span>O revisor achou ${[r.erro && `${r.erro} erro${r.erro > 1 ? 's' : ''}`, r.aviso && `${r.aviso} aviso${r.aviso > 1 ? 's' : ''}`, r.dica && `${r.dica} dica${r.dica > 1 ? 's' : ''}`].filter(Boolean).join(', ')} antes de exportar.</span><button class="btn sm">Revisar</button>`;
      $('button', el).onclick = () => Revisor.abrir(); }).catch(() => { });
    let api = null; const o = { title: 'Exportar', icon: 'download', width: 560, sticky: true, body, onOpen: a => { api = a; botao(); }, buttons: [
      { label: 'Fechar', value: null },
      { label: 'Exportar', kind: 'primary', onClick: () => this.rodar(P, cfg, body, api, o) }] };
    const botao = () => { const b = api?.foot.querySelector('.btn.primary'); if (b) b.innerHTML = `${ic('download', 14)} ${{ mp4: 'Exportar o vídeo', png: 'Salvar a imagem', wav: 'Exportar o som', animador: 'Baixar o .animador' }[cfg.tipo]}`; };
    pinta(); await UI.modal(o); this._cancela = null;
  },
  limites(P, cfg) { const ult = P.duracao - 1; if (cfg.trecho === 'marcado' && Folha.trecho) return [Folha.trecho.de, Math.min(ult, Folha.trecho.ate)]; if (cfg.trecho === 'quadros') return [clamp(cfg.de, 0, ult), clamp(cfg.ate, cfg.de, ult)]; return [0, ult]; },
  nomeArq(P, cfg, ext) { return safeName((cfg.nomeProj ? P.nome : (cfg.nome || '').trim()) || P.nome || 'Animação') + ext; },
  // exporta travando a janela (não fecha até acabar; Cancelar para no meio)
  async rodar(P, cfg, body, api, o) {
    const ext = { mp4: '.mp4', png: '.png', wav: '.wav', animador: '.animador' }[cfg.tipo], nome = this.nomeArq(P, cfg, ext);
    if (cfg.tipo === 'png') { await this.png(nome); return true; }
    if (cfg.tipo === 'animador') { const b = await Toon.montar(P); downloadBlob(b, nome); UI.toast(`<b>${esc(nome)}</b> baixado.`, { kind: 'ok' }); return true; }
    const [de, ate] = this.limites(P, cfg), foot = api.foot, prog = $('.exp-prog', body), t0 = performance.now(); let cancelou = false;
    // TRAVA: sem Esc, sem clique fora, sem X; os botões viram "Cancelar"
    o.noClose = true; api.el.classList.add('exportando'); $$('.exp-sec, .exp-tipos', body).forEach(s => s.classList.add('travado')); prog.hidden = false; $('.exp-fim', body).hidden = true;
    const btns = [...foot.querySelectorAll('.btn')]; btns.forEach(b => b.hidden = true);
    const cancel = h(`<button class="btn danger">${ic('x', 14)} Cancelar a exportação</button>`); cancel.onclick = () => { cancelou = true; cancel.disabled = true; cancel.textContent = 'Cancelando…'; }; foot.appendChild(cancel);
    const sair = e => { e.preventDefault(); e.returnValue = ''; }; addEventListener('beforeunload', sair);
    const pr = (f, txt) => { const s = (performance.now() - t0) / 1000; $('.exp-barra i', body).style.width = (f * 100).toFixed(1) + '%'; $('[data-pp]', body).textContent = Math.floor(f * 100) + '%'; $('[data-pt]', body).textContent = txt || '';
      $('[data-pr]', body).textContent = `${this.dur(s)} passado${f > .03 && f < 1 ? ` · falta cerca de ${this.dur(s / f - s)}` : ''}`; if (cancelou) throw new Error('cancelado'); };
    const solta = () => { o.noClose = false; api.el.classList.remove('exportando'); $$('.travado', body).forEach(s => s.classList.remove('travado')); cancel.remove(); btns.forEach(b => b.hidden = false); removeEventListener('beforeunload', sair); };
    try {
      const blob = cfg.tipo === 'wav' ? await this.wav(P, de, ate, pr) : await this.mp4({ q: cfg.q, de, ate, qual: cfg.qual, som: cfg.som, semLegenda: !cfg.leg, pr });
      downloadBlob(blob, nome); const seg = (ate - de + 1) / P.fps, mb = blob.size / 1048576;
      solta(); prog.hidden = true; const fim = $('.exp-fim', body); fim.hidden = false;
      fim.innerHTML = `${ic('check', 18)}<div><b>${esc(nome)}</b><small>${this.dur(seg)} de vídeo · ${mb < 10 ? mb.toFixed(1).replace('.', ',') : Math.round(mb)} MB · pronto em ${this.dur((performance.now() - t0) / 1000)}</small></div><button class="btn sm">${ic('download', 13)} Baixar de novo</button>`;
      $('button', fim).onclick = () => downloadBlob(blob, nome); UI.toast(`<b>${esc(nome)}</b> exportado!`, { kind: 'ok' });
    } catch (e) { solta(); if (cancelou || e.message === 'cancelado') { prog.hidden = true; UI.toast('Exportação cancelada.'); } else $('[data-pt]', body).textContent = 'Não deu: ' + e.message; }
    return false; // a janela fica aberta (mostra o resultado)
  },
  // só o som (WAV) do trecho
  async wav(P, de, ate, pr) { pr?.(.1, 'Misturando o som…'); const mix = await Som.mistura(P, 48000), a = Math.round(de / P.fps * 48000), z = Math.min(mix.length, Math.round((ate + 1) / P.fps * 48000));
    const ac = new OfflineAudioContext(2, Math.max(1, z - a), 48000), b = ac.createBuffer(2, Math.max(1, z - a), 48000); for (let c = 0; c < 2; c++) b.getChannelData(c).set(mix.getChannelData(Math.min(c, mix.numberOfChannels - 1)).subarray(a, z)); pr?.(1, 'Pronto'); return Som.wav(b); },
  png(nome) { const P = App.P, c = document.createElement('canvas'); c.width = P.w; c.height = P.h; Render.quadro(c.getContext('2d'), P, App.q, P.w, P.h); return new Promise(ok => c.toBlob(b => { downloadBlob(b, nome || `${safeName(P.nome)} - quadro ${App.q + 1}.png`); ok(); }, 'image/png')); },
  folga() { return new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); }); },
  async h264(w, h, fps, k = .12) {
    if (!window.VideoEncoder) return null; const px = w * h, lv = px <= 414720 ? ['1E', '1F', '28'] : px <= 921600 ? ['1F', '28', '2A'] : px <= 2228224 ? ['28', '2A', '32'] : ['33', '34'];
    for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) for (const L of lv) for (const pf of ['6400', '4D00', '42E0']) {
      const cfg = { codec: 'avc1.' + pf + L, width: w, height: h, bitrate: Math.round(px * fps * k), framerate: fps, hardwareAcceleration: hw, avc: { format: 'avc' } };
      try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch { } }
    return null;
  },
  async mp4({ q = 1, de = 0, ate, pr, qual = 'alta', som = true, semLegenda = false }) {
    const P = App.P; App.pausa(); ate = clamp(ate ?? P.duracao - 1, de, P.duracao - 1);
    const W = Math.max(2, Math.round(P.w * q / 2) * 2), H = Math.max(2, Math.round(P.h * q / 2) * 2), fps = P.fps;
    const vcfg = await this.h264(W, H, fps, (this.QUAL[qual] || this.QUAL.alta).k); if (!vcfg) throw new Error('Este navegador não grava MP4. Use o Chrome ou o Edge atualizado.');
    const temSom = som && (P.audios || []).length > 0; let acfg = null;
    if (temSom && window.AudioEncoder) for (const c of [{ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 }, { codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2, bitrate: 192000 }]) { try { if ((await AudioEncoder.isConfigSupported(c)).supported) { acfg = c; break; } } catch { } }
    const mux = new Mp4Mux({ video: { width: W, height: H, fps }, audio: acfg ? { sampleRate: acfg.sampleRate, channels: 2 } : null });
    const bytes = d => d instanceof Uint8Array ? d : d.buffer ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength).slice() : new Uint8Array(d);
    let erro = null;
    // imagens de todos os personagens prontas antes de começar
    await Arq.garantir([...Object.values(P.personagens).flatMap(d => Modelo.chavesImgs(d)), ...Modelo.todos(P).filter(n => n.tipo === 'imagem').map(n => n.arq)]);
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
      if (erro) throw erro; Render.quadro(ctx, P, de + i, W, H, { semLegenda });
      const vf = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) }); ve.encode(vf, { keyFrame: i % gop === 0 }); vf.close();
      while (ve.encodeQueueSize > 4) await this.folga();
      if (i % 4 === 0) { pr?.((i + 1) / n * .98, `Quadro ${i + 1} de ${n} · ${this.tc((de + i) / fps)} de ${this.tc((ate + 1) / fps)}`); await this.folga(); }
    }
    await ve.flush(); ve.close(); if (erro) throw erro;
    pr?.(.99, 'Montando o arquivo…'); const blob = mux.finish(); pr?.(1, 'Pronto'); return blob;
  },
};
