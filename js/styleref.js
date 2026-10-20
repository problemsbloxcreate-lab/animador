/* ===================== styleref.js — vídeos de referência para copiar o estilo =====================
   Um vídeo da Mídia (ou link do YouTube) vira uma "referência de estilo": o editor tira quadros e mede o ritmo
   (cortes, movimento, voz); a IA olha tudo e escreve uma FICHA DE ESTILO (editável), que vai junto em todo pedido. */
'use strict';

const StyleRefs = {
  frames: new Map(), // quadros em memória (não ficam salvos no projeto)
  list() { const p = App.project; if (!p) return []; return (p.refs ||= []); },
  active() { return this.list().filter(r => r.ativa && r.ficha); },
  ytId(url) { const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/); return m ? m[1] : null; },
  // links de vídeo: YouTube, TikTok e Instagram
  LINK_RE: /https?:\/\/(?:www\.|m\.|vm\.|vt\.)?(?:youtube\.com|youtu\.be|tiktok\.com|instagram\.com|instagr\.am)\/[^\s"'<>]+/gi,
  platform(url) { const u = String(url || ''); if (this.ytId(u)) return 'youtube'; if (/tiktok\.com\/.*\/(video|photo)\/|(vm|vt)\.tiktok\.com\/|tiktok\.com\/t\//i.test(u)) return 'tiktok'; if (/(instagram\.com|instagr\.am)\/(reel|reels|p|tv)\//i.test(u)) return 'instagram'; return null; },
  findLinks(text) { return [...new Set([...String(text || '').matchAll(this.LINK_RE)].map(m => m[0].replace(/[),.!?]+$/, '')))].filter(u => this.platform(u)); },
  findRef(url) { const pf = this.platform(url); if (pf === 'youtube') return this.list().find(r => r.ytId === this.ytId(url)); const k = this.normUrl(url); return this.list().find(r => r.url && this.normUrl(r.url) === k); },
  normUrl(u) { return String(u || '').replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/^https?:\/\/(www\.|m\.)?/i, '').toLowerCase(); },
  PF: { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' },
  async addLink(url, quiet) {
    const pf = this.platform(url);
    if (pf === 'youtube') return this.addYouTube(url, quiet);
    if (pf === 'tiktok') {
      let r = this.findRef(url); if (r) return r;
      r = { id: uid('r_'), kind: 'tiktok', url, title: 'Vídeo do TikTok', ativa: true, status: 'novo', thumb: null, notas: '' };
      this.list().push(r); this.save('Link do TikTok adicionado como referência'); await this.analyze(r); return r;
    }
    if (pf === 'instagram') {
      let r = this.findRef(url); if (r) return r;
      r = { id: uid('r_'), kind: 'instagram', url, title: 'Vídeo do Instagram', ativa: false, status: 'erro', erro: 'O Instagram não deixa abrir os vídeos de fora. Baixe o vídeo (se tiver permissão) e coloque na Mídia → botão direito → Usar como referência de estilo.', thumb: null, notas: '' };
      this.list().push(r); this.save('Link do Instagram adicionado');
      if (!quiet) UI.toast(r.erro, { kind: 'warn', time: 8000 });
      return r;
    }
    return null;
  },
  findYt(text) { return [...String(text || '').matchAll(/https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/[^\s"'<>]+/g)].map(m => m[0]).filter(u => this.ytId(u)); },
  save(msg) { App.commit(msg || 'Referência de estilo atualizada', { noRefresh: true }); LibUI.render(); },

  /* ---------- adicionar ---------- */
  async addVideo(assetId) {
    const m = Assets.meta(assetId); if (!m || m.kind !== 'video') return UI.toast('Escolha um vídeo da Mídia.', { kind: 'warn' });
    let r = this.list().find(x => x.assetId === assetId);
    if (!r) { r = { id: uid('r_'), kind: 'video', assetId, title: m.name.replace(/\.[^.]+$/, ''), ativa: true, status: 'novo', thumb: m.thumb || null, notas: '' }; this.list().push(r); this.save('Vídeo virou referência de estilo'); }
    LibUI.tab = 'media'; LibUI.render();
    return this.analyze(r);
  },
  async addYouTube(url, quiet) {
    const id = this.ytId(url); if (!id) { UI.toast('Esse link não parece do YouTube.', { kind: 'warn' }); return null; }
    let r = this.list().find(x => x.ytId === id);
    if (r) { if (!quiet) UI.toast('Esse vídeo já está nas referências.', { time: 2000 }); return r; }
    r = { id: uid('r_'), kind: 'youtube', ytId: id, url: 'https://www.youtube.com/watch?v=' + id, title: 'Vídeo do YouTube', ativa: true, status: 'novo', thumb: null, notas: '' };
    this.list().push(r); this.save('Link do YouTube adicionado como referência');
    await this.analyze(r);
    return r;
  },
  async promptLink() {
    const f = h(`<div><p style="margin-top:0">Cole o link de um vídeo (YouTube, TikTok ou Instagram) com o estilo de edição/animação que você quer copiar.</p>
      <label class="field">Link<input type="text" data-u placeholder="https://www.youtube.com/watch?v=...  ·  https://www.tiktok.com/@.../video/..."></label>
      <div class="hint" style="margin-top:10px">${ic('info', 12)} Pelo link a IA só consegue ver um pouco: no <b>YouTube</b> o título, a capa e 3 imagens; no <b>TikTok</b> o título e a capa; o <b>Instagram</b> não deixa abrir. Para copiar o estilo de verdade (ritmo dos cortes, zooms, tremidas, textos), coloque o <b>arquivo do vídeo</b> na Mídia (seu, ou que você tenha permissão de usar) → botão direito → <b>Usar como referência de estilo</b>.</div></div>`);
    const o = await UI.modal({ title: 'Referência por link', icon: 'film', width: 540, body: f, enterValue: true, buttons: [{ label: 'Cancelar', value: null }, { label: 'Adicionar', kind: 'primary', collect: () => $('[data-u]', f).value.trim() }] });
    if (!o) return;
    if (!this.platform(o)) return UI.toast('Esse link não parece do YouTube, TikTok ou Instagram.', { kind: 'warn' });
    return this.addLink(o);
  },
  remove(r) { App.project.refs = this.list().filter(x => x !== r); this.frames.delete(r.id); this.save('Referência removida'); },

  /* ---------- análise ---------- */
  seek(v, t) { return new Promise(res => { let done = false; const ok = () => { if (!done) { done = true; v.removeEventListener('seeked', ok); res(); } }; v.addEventListener('seeked', ok); v.currentTime = t; setTimeout(ok, 2500); }); },
  async videoData(r, prog) {
    const rt = Assets.get(r.assetId); if (!rt) throw new Error('O arquivo do vídeo não está carregado.');
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = rt.url; v.playsInline = true;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('Não consegui abrir esse vídeo neste navegador.')); setTimeout(res, 8000); });
    const dur = isFinite(v.duration) ? v.duration : (rt.meta.dur || 0); if (!dur) throw new Error('Não consegui ler a duração do vídeo.');
    const N = Math.min(900, Math.max(40, Math.round(dur / .25))), step = dur / N;
    const sw = 48, sh = Math.max(8, Math.round(48 * (v.videoHeight || 9) / (v.videoWidth || 16)));
    const cv = document.createElement('canvas'); cv.width = sw; cv.height = sh; const g = cv.getContext('2d', { willReadFrequently: true });
    const diffs = []; let prev = null;
    for (let i = 0; i < N; i++) {
      const t = Math.min(dur - .05, i * step); await this.seek(v, t);
      g.drawImage(v, 0, 0, sw, sh); const d = g.getImageData(0, 0, sw, sh).data, lum = new Float32Array(sw * sh);
      for (let k = 0; k < lum.length; k++) lum[k] = d[k * 4] * .3 + d[k * 4 + 1] * .59 + d[k * 4 + 2] * .11;
      if (prev) { let s = 0; for (let k = 0; k < lum.length; k++) s += Math.abs(lum[k] - prev[k]); diffs.push({ t, d: s / lum.length }); }
      prev = lum; if (i % 10 === 0) prog?.(i / N * .7, `Medindo o ritmo… ${Math.round(i / N * 100)}%`);
    }
    // cortes: saltos bem maiores que o normal
    const sorted = diffs.map(x => x.d).sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)] || 1;
    const thr = Math.max(22, med * 4.5), cuts = [];
    for (let i = 0; i < diffs.length; i++) { const x = diffs[i]; if (x.d > thr && (!cuts.length || x.t - cuts[cuts.length - 1] > .35)) cuts.push(round(x.t, 2)); }
    const shots = [0, ...cuts, dur].map((t, i, a) => i ? a[i] - a[i - 1] : null).filter(x => x !== null);
    // movimento por segundo (sem contar os cortes)
    const motion = []; for (let s = 0; s < Math.ceil(dur); s++) { const xs = diffs.filter(x => x.t >= s && x.t < s + 1 && x.d <= thr).map(x => x.d); motion.push(xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0); }
    // quadros-chave: começo de cada plano + alguns no meio
    let times = [Math.min(.2, dur / 2), ...cuts.map(t => Math.min(dur - .05, t + .12))];
    const MAX = 24;
    if (times.length > MAX) times = Array.from({ length: MAX }, (_, i) => times[Math.round(i * (times.length - 1) / (MAX - 1))]);
    for (let k = 1; times.length < Math.min(MAX, 10); k++) { const t = dur * k / 11; if (!times.some(x => Math.abs(x - t) < dur / 22)) times.push(t); if (k > 10) break; }
    times = [...new Set(times.map(t => round(t, 2)))].sort((a, b) => a - b);
    const W = 512, H = Math.round(W * (v.videoHeight || 9) / (v.videoWidth || 16)), fc = document.createElement('canvas'); fc.width = W; fc.height = H; const fg = fc.getContext('2d');
    const frames = [];
    for (let i = 0; i < times.length; i++) { await this.seek(v, times[i]); fg.drawImage(v, 0, 0, W, H); frames.push({ t: times[i], data: fc.toDataURL('image/jpeg', .72).split(',')[1] }); prog?.(.7 + i / times.length * .2, `Tirando quadros… ${i + 1}/${times.length}`); }
    if (!r.thumb && frames[0]) { fg.drawImage(v, 0, 0, W, H); const tc = document.createElement('canvas'); tc.width = 160; tc.height = Math.round(160 * H / W); tc.getContext('2d').drawImage(fc, 0, 0, tc.width, tc.height); r.thumb = tc.toDataURL('image/jpeg', .7); }
    v.removeAttribute('src'); v.load();
    // voz
    let voz = '';
    if (rt.meta.hasAudio) { try { const a = AudioAnalysis.analyze({ id: 'ref_' + r.id, assetId: r.assetId, offset: 0, dur, speed: 1, start: 0 }); if (a) { const fala = a.speech.reduce((s, [x, y]) => s + (y - x), 0); voz = `Áudio: ${a.speech.length} trechos de fala/som (${Math.round(fala / dur * 100)}% do tempo com som), ${a.peaks.length} batidas/picos, ${a.loud.length} momentos bem altos (gritos)${a.loud.length ? ' em ' + a.loud.slice(0, 15).map(g => g[0] + 's').join(', ') : ''}.`; } } catch { } }
    const avg = shots.length ? shots.reduce((a, b) => a + b, 0) / shots.length : dur;
    const dados = `Duração ${round(dur, 1)}s · ${cuts.length} cortes (≈${round(cuts.length / dur * 60, 1)} por minuto) · plano médio ${round(avg, 2)}s (menor ${round(Math.min(...shots), 2)}s, maior ${round(Math.max(...shots), 2)}s).
Cortes em: ${cuts.slice(0, 80).join(', ') || 'nenhum'}.
Movimento na tela por segundo (0 = parado, 10+ = muito movimento/tremida/zoom): ${motion.slice(0, 180).join(' ')}.
${voz}`;
    return { dados, frames };
  },
  async ytData(r, prog) {
    const srv = AIClient.server; if (!srv) throw new Error('Para ler links do YouTube, a IA do Estúdio Problems precisa estar ligada (servidor na Cloudflare).');
    const hd = await AIClient.authHeader();
    prog?.(.1, 'Lendo o link…');
    let info = {}; try { const q = await fetch(`${srv}/yt/info?id=${r.ytId}`, { headers: hd }); if (q.ok) info = await q.json(); else if (q.status === 404) throw new Error('rota'); } catch (e) { if (e.message === 'rota') throw new Error('O servidor da IA ainda é a versão antiga. Cole o worker.js novo na Cloudflare para ler links do YouTube.'); }
    if (info.error) throw new Error('Não achei esse vídeo no YouTube (ele é público?).');
    r.title = info.title || r.title; r.autor = info.author_name || '';
    const frames = [], names = [['maxresdefault', 'capa'], ['hq1', '≈25% do vídeo'], ['hq2', '≈50% do vídeo'], ['hq3', '≈75% do vídeo']];
    for (let i = 0; i < names.length; i++) {
      prog?.(.2 + i * .15, 'Pegando as imagens do vídeo…');
      try {
        let q = await fetch(`${srv}/yt/img?id=${r.ytId}&f=${names[i][0]}`, { headers: hd });
        if (!q.ok && i === 0) q = await fetch(`${srv}/yt/img?id=${r.ytId}&f=hqdefault`, { headers: hd });
        if (!q.ok) continue;
        const bmp = await createImageBitmap(await q.blob()), c = document.createElement('canvas'); c.width = Math.min(640, bmp.width); c.height = Math.round(c.width * bmp.height / bmp.width); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        frames.push({ t: names[i][1], data: c.toDataURL('image/jpeg', .75).split(',')[1] });
        if (!r.thumb) { const tc = document.createElement('canvas'); tc.width = 160; tc.height = Math.round(160 * c.height / c.width); tc.getContext('2d').drawImage(c, 0, 0, tc.width, tc.height); r.thumb = tc.toDataURL('image/jpeg', .7); }
      } catch { }
    }
    return { dados: `Link do YouTube: "${r.title}"${r.autor ? ' do canal ' + r.autor : ''}. ATENÇÃO: só temos a capa e 3 imagens automáticas (≈25%, 50% e 75% do vídeo); não temos o ritmo dos cortes nem o áudio. Deduza o estilo visual pelo que dá para ver e pelo que você souber desse tipo de canal, e deixe claro o que é palpite.`, frames };
  },
  async ttData(r, prog) {
    const srv = AIClient.server; if (!srv) throw new Error('Para ler links do TikTok, a IA do Estúdio Problems precisa estar ligada (servidor na Cloudflare).');
    const hd = await AIClient.authHeader(); prog?.(.1, 'Lendo o link do TikTok…');
    const q = await fetch(`${srv}/tt/info?url=${encodeURIComponent(r.url)}`, { headers: hd });
    if (q.status === 404) throw new Error('O servidor da IA ainda é a versão antiga. Cole o worker.js novo na Cloudflare para ler links do TikTok.');
    const info = await q.json().catch(() => ({})); if (info.error || !q.ok) throw new Error('Não achei esse vídeo no TikTok (ele é público?).');
    r.title = info.title || r.title; r.autor = info.author_name || '';
    const frames = [];
    if (info.thumbnail_url) {
      try { const im = await fetch(`${srv}/tt/img?u=${encodeURIComponent(info.thumbnail_url)}`, { headers: hd }); if (im.ok) { const bmp = await createImageBitmap(await im.blob()), c = document.createElement('canvas'); c.width = Math.min(540, bmp.width); c.height = Math.round(c.width * bmp.height / bmp.width); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); frames.push({ t: 'capa', data: c.toDataURL('image/jpeg', .75).split(',')[1] }); const tc = document.createElement('canvas'); tc.width = 160; tc.height = Math.round(160 * c.height / c.width); tc.getContext('2d').drawImage(c, 0, 0, tc.width, tc.height); r.thumb = tc.toDataURL('image/jpeg', .7); } } catch { }
    }
    return { dados: `Link do TikTok: "${r.title}"${r.autor ? ' de @' + r.autor : ''}. ATENÇÃO: só temos o título/descrição e a capa do vídeo; não dá para ver os cortes nem ouvir. Deduza o estilo pelo que dá (e pelo jeito comum de vídeos curtos verticais) e deixe claro o que é palpite.`, frames };
  },
  systemStyle() {
    return `Você é especialista em edição de vídeos do YouTube no estilo Brubs / Mundo Torajo (personagens em imagem parada que pulam, tremem, falam; zooms de impacto; cortes rápidos).
Você vai receber dados medidos e quadros (com o tempo de cada um) de um VÍDEO DE REFERÊNCIA. Escreva uma FICHA DE ESTILO em português, curta e prática, que outra IA vai seguir para editar no editor "Estúdio Problems — Animação".
Use estas seções com tópicos curtos e números concretos:
1. Ritmo e cortes (duração média dos planos, quando corta: a cada fala, a cada piada…)
2. Câmera (zoom de impacto: escala e duração; tremidas; movimentos lentos)
3. Personagens (tamanho na tela, posição, como entram/saem, como "falam", reações exageradas)
4. Textos e legendas (estilo, cor, contorno, posição, quando aparecem)
5. Efeitos e transições (quais, com que frequência)
6. Som (se der para deduzir: efeitos sonoros nas reações, música)
7. REGRAS PARA REPRODUZIR NO ESTÚDIO PROBLEMS — 6 a 12 regras diretas usando os nomes disponíveis:
   animações: ${Object.keys(ANIMS).join(', ')}
   efeitos: ${Object.keys(FX).join(', ')}
   transições: ${Object.keys(TRANS).join(', ')}
   estilos de texto: ${Object.keys(TEXT_STYLES).join(', ')}
Seja específico (ex.: "zoom punch 1.0→1.25 em 0.15s a cada grito"). No máximo ~380 palavras. Só texto, sem JSON.`;
  },
  async analyze(r) {
    if (r.status === 'analisando') return;
    r.status = 'analisando'; r.erro = ''; LibUI.render();
    const pr = UI.toast(`<span class="spin-dot"></span> <span data-p>Analisando "${esc(r.title)}"…</span>`, { time: 600000 });
    const prog = (x, msg) => { const el = pr?.querySelector?.('[data-p]'); if (el) el.textContent = `${msg} (${esc(r.title)})`; };
    try {
      if (r.kind === 'instagram') throw new Error(r.erro || 'O Instagram não deixa abrir os vídeos de fora.');
      const { dados, frames } = r.kind === 'youtube' ? await this.ytData(r, prog) : r.kind === 'tiktok' ? await this.ttData(r, prog) : await this.videoData(r, prog);
      this.frames.set(r.id, frames); r.dados = dados;
      if (AIClient.ready) {
        prog(.92, 'A IA está escrevendo a ficha de estilo…');
        const content = [{ type: 'text', text: `VÍDEO DE REFERÊNCIA: "${r.title}"\nDADOS MEDIDOS:\n${dados}${r.notas ? '\nOBSERVAÇÕES DO USUÁRIO: ' + r.notas : ''}\nQUADROS:` }];
        for (const f of frames) content.push({ type: 'text', text: typeof f.t === 'number' ? `Quadro em ${f.t}s:` : `Imagem (${f.t}):` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.data } });
        content.push({ type: 'text', text: 'Escreva a FICHA DE ESTILO.' });
        const j = await AIClient.call([{ role: 'user', content }], this.systemStyle());
        r.ficha = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      } else r.ficha = `(Sem IA ligada — só os dados medidos)\n${dados}`;
      r.status = 'pronta';
      UI.toast(`Ficha de estilo pronta: <b>${esc(r.title)}</b>. A IA vai seguir esse estilo nas próximas edições.`, { kind: 'ok', time: 5000, action: { label: 'Ver ficha', fn: () => this.open(r) } });
      Notify.send('Referência de estilo pronta', r.title);
    } catch (e) { r.status = 'erro'; r.erro = e.message || String(e); UI.toast('Não deu para analisar a referência: ' + esc(r.erro), { kind: 'err', time: 7000 }); }
    pr?.remove?.();
    this.save('Referência de estilo analisada');
  },
  /* ---------- ver / editar ---------- */
  async open(r) {
    const fr = this.frames.get(r.id) || [];
    const f = h(`<div>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">${r.thumb ? `<img src="${r.thumb}" style="width:120px;border-radius:8px">` : ''}<div><b>${esc(r.title)}</b><br><small>${r.kind === 'youtube' ? `Link do YouTube${r.autor ? ' · ' + esc(r.autor) : ''} — só capa e 3 imagens` : r.kind === 'tiktok' ? `Link do TikTok${r.autor ? ' · @' + esc(r.autor) : ''} — só a capa` : r.kind === 'instagram' ? 'Link do Instagram — não dá para abrir' : 'Vídeo da Mídia'}${r.status === 'erro' ? ` · <span style="color:var(--err)">${esc(r.erro)}</span>` : ''}</small><br><label class="switch" style="margin-top:6px"><input type="checkbox" data-on ${r.ativa ? 'checked' : ''}><i></i>Usar nas edições da IA</label></div></div>
      ${fr.length ? `<div class="ref-strip">${fr.slice(0, 24).map(x => `<div><img src="data:image/jpeg;base64,${x.data}"><small>${typeof x.t === 'number' ? fmtSec(x.t) : esc(x.t)}</small></div>`).join('')}</div>` : ''}
      <label class="field" style="margin-top:10px">Ficha de estilo (o que a IA entendeu — pode editar)<textarea data-f rows="12" style="font-size:12.5px">${esc(r.ficha || '')}</textarea></label>
      <label class="field" style="margin-top:8px">Suas observações (opcional)<textarea data-n rows="2" placeholder="ex.: quero os zooms iguais, mas sem a música">${esc(r.notas || '')}</textarea></label>
      ${r.dados ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;color:var(--tx3)">Dados medidos</summary><pre style="white-space:pre-wrap;font-size:11px;color:var(--tx3)">${esc(r.dados)}</pre></details>` : ''}
    </div>`);
    const o = await UI.modal({ title: 'Referência de estilo', icon: 'film', width: 720, body: f, buttons: [{ label: 'Remover', left: true, value: 'del' }, { label: 'Analisar de novo', value: 'again', left: true }, { label: 'Fechar', value: null }, { label: 'Salvar', kind: 'primary', collect: () => ({ ficha: $('[data-f]', f).value, notas: $('[data-n]', f).value, ativa: $('[data-on]', f).checked }) }] });
    if (o === 'del') { if (await UI.confirm({ title: 'Remover referência', msg: `Remover a referência <b>${esc(r.title)}</b>? (o vídeo continua na Mídia)`, ok: 'Remover', danger: true })) this.remove(r); return; }
    if (o === 'again') { r.notas = $('[data-n]', f).value; return this.analyze(r); }
    if (o && typeof o === 'object') { Object.assign(r, o); this.save('Ficha de estilo salva'); UI.toast('Ficha salva', { kind: 'ok' }); }
  },
  // o que vai para a IA em cada pedido
  forPrompt() {
    const a = this.active(); if (!a.length) return '';
    return 'REFERÊNCIAS DE ESTILO (o usuário quer este estilo de edição/animação — siga as fichas, adaptando ao projeto):\n' + a.map(r => `### "${r.title}"${this.PF[r.kind] ? ` (link do ${this.PF[r.kind]})` : ''}\n${String(r.ficha).slice(0, 4000)}${r.notas ? '\nObservações do usuário: ' + r.notas : ''}`).join('\n\n');
  },
  /* ---------- seção na aba Mídia ---------- */
  section() {
    const refs = this.list();
    const s = h(`<div class="ref-sec"><div class="lgroup" style="display:flex;align-items:center;gap:6px">Referências de estilo (${refs.length})<span class="sp" style="flex:1"></span><button class="ibtn xs" data-a="yt" title="Adicionar link do YouTube ou TikTok">${ic('plus', 12)} Link</button></div></div>`);
    $('[data-a=yt]', s).onclick = () => this.promptLink();
    if (!refs.length) s.title = 'Para a IA copiar um estilo de edição: botão direito num vídeo da Mídia → Usar como referência de estilo, ou cole um link do YouTube (no + ou na conversa com a IA).';
    const g = h('<div class="ref-list"></div>');
    for (const r of refs) {
      const st = { analisando: '<span class="spin-dot"></span> analisando…', pronta: r.ativa ? `${ic('check', 10)} em uso` : 'desligada', erro: 'erro', novo: '…' }[r.status] || '';
      const el = h(`<div class="ref-card ${r.ativa ? 'on' : ''}" title="Clique para ver/editar a ficha de estilo"><i style="${r.thumb ? `background-image:url('${r.thumb}')` : ''}">${r.thumb ? '' : ic('film', 16)}</i><div><b>${esc(r.title)}</b><small class="${r.status}">${this.PF[r.kind] ? this.PF[r.kind] + ' · ' : ''}${st}</small></div></div>`);
      el.onclick = () => this.open(r);
      el.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); UI.ctx(e.clientX, e.clientY, [{ head: r.title }, { label: 'Ver / editar a ficha', icon: 'edit', action: () => this.open(r) }, { label: r.ativa ? 'Não usar nas edições' : 'Usar nas edições', icon: 'check', action: () => { r.ativa = !r.ativa; this.save(); } }, { label: 'Analisar de novo', icon: 'sparkles', action: () => this.analyze(r) }, r.url && { label: `Abrir no ${this.PF[r.kind] || 'site'}`, icon: 'film', action: () => window.open(r.url, '_blank', 'noopener') }, '-', { label: 'Remover', icon: 'trash', danger: true, action: () => this.remove(r) }].filter(Boolean)); };
      g.appendChild(el);
    }
    s.appendChild(g);
    return s;
  },
};
