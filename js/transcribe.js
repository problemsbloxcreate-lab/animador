/* ===================== transcribe.js — transcrição automática dos áudios =====================
   Ao gravar ou importar um áudio, ele é transcrito (Whisper, pelo servidor do Estúdio Problems na Cloudflare).
   A transcrição fica salva no projeto, dá para editar, e vai junto para a IA do editor. */
'use strict';

const Transcribe = {
  running: new Set(),
  map() { const p = App.project; return p ? (p.transcripts ||= {}) : {}; },
  get(id) { return this.map()[id] || null; },
  can(id) { const m = Assets.meta(id); return !!m && (m.kind === 'audio' || (m.kind === 'video' && m.hasAudio)); },
  auto(ids) { if (!AIClient.server) return; for (const id of ids) { const m = Assets.meta(id); if (m?.kind === 'audio' && !this.get(id)) this.run(id, true); } },

  // 16 kHz mono, em pedaços de ~25 s cortados nos silêncios
  async chunks(id) {
    const buf = Assets.audioBuffer(id, Assets.ctx()); if (!buf) throw new Error('O áudio ainda não carregou.');
    const sr = 16000, len = Math.ceil(buf.duration * sr);
    const off = new OfflineAudioContext(1, len, sr), src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
    const mono = (await off.startRendering()).getChannelData(0);
    const out = [], MAX = 25 * sr, SEARCH = 4 * sr, win = Math.round(sr * .05);
    let pos = 0;
    while (pos < mono.length) {
      let end = Math.min(mono.length, pos + MAX);
      if (end < mono.length) { // procura o trecho mais quieto nos últimos 4 s
        let best = end, bestE = Infinity;
        for (let i = end - SEARCH; i < end - win; i += win) { let e = 0; for (let k = i; k < i + win; k++) e += mono[k] * mono[k]; if (e < bestE) { bestE = e; best = i + (win >> 1); } }
        end = best;
      }
      let peak = 0; for (let k = pos; k < end; k += 64) peak = Math.max(peak, Math.abs(mono[k]));
      if (peak > .004) out.push({ start: pos / sr, data: mono.subarray(pos, end) });
      pos = end;
    }
    return out;
  },
  wavB64(f32, sr = 16000) {
    const n = f32.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, f32[i])) * 0x7fff, true);
    const u8 = new Uint8Array(b); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  },
  prom: {},
  run(id, quiet) { if (this.prom[id]) return this.prom[id]; const pr = this._run(id, quiet).finally(() => { delete this.prom[id]; }); this.prom[id] = pr; return pr; },
  // garante transcrição dos áudios (usado antes de mandar um pedido para a IA)
  async ensure(ids, onStart) {
    const need = [...new Set(ids)].filter(id => this.can(id) && !this.get(id)?.segs?.length);
    if (!need.length || !AIClient.server) return 0;
    onStart?.(need.length);
    await Promise.all(need.map(id => this.run(id, true)));
    return need.length;
  },
  async _run(id, quiet) {
    if (this.running.has(id)) return;
    const m = Assets.meta(id); if (!m) return;
    if (!AIClient.server) { if (!quiet) UI.toast('A transcrição usa o servidor da IA do Estúdio Problems (Cloudflare), que ainda não está ligado.', { kind: 'warn', time: 5000 }); return; }
    this.running.add(id); const map = this.map(); const prev = map[id];
    map[id] = { status: 'transcrevendo', segs: prev?.segs || [], lang: 'pt' }; LibUI.render(); try { Props.render(); } catch { }
    const t = UI.toast(`<span class="spin-dot"></span> <span data-p>Transcrevendo "${esc(m.name)}"…</span>`, { time: 900000 });
    try {
      const parts = await this.chunks(id), segs = [], hd = await AIClient.authHeader();
      for (let i = 0; i < parts.length; i++) {
        const el = t.querySelector('[data-p]'); if (el) el.textContent = `Transcrevendo "${m.name}"… ${i + 1}/${parts.length}`;
        const prompt = segs.slice(-3).map(s => s.t).join(' ').slice(-200);
        let r, j = {};
        for (let k = 0; k < 3; k++) {
          r = await fetch(AIClient.server + '/transcrever', { method: 'POST', headers: { 'content-type': 'application/json', ...hd }, body: JSON.stringify({ audio: this.wavB64(parts[i].data), language: 'pt', prompt }) });
          j = await r.json().catch(() => ({}));
          if (r.ok || ![429, 500, 502, 503].includes(r.status)) break;
          await new Promise(res => setTimeout(res, 3000 * (k + 1)));
        }
        if (!r.ok) {
          if (r.status === 404) throw new Error('O servidor da IA ainda é a versão antiga. Cole o worker.js novo na Cloudflare.');
          if (j?.error?.type === 'sem_ia') throw new Error('Falta ligar a transcrição na Cloudflare: turma-ia → Bindings → Add binding → Workers AI → nome AI.');
          throw new Error(j?.error?.message || 'erro ' + r.status);
        }
        const base = parts[i].start, dur = parts[i].data.length / 16000;
        if (Array.isArray(j.segments) && j.segments.length) for (const s of j.segments) {
          const tx = String(s.text || '').trim(); if (!tx) continue;
          const w = (s.words || []).map(x => [round(base + (+x.s || 0), 2), round(base + Math.min(dur, +x.e || 0), 2), String(x.w || '').trim()]).filter(x => x[2]);
          segs.push({ s: round(base + (+s.start || 0), 2), e: round(base + Math.min(dur, +s.end || dur), 2), t: tx, ...(w.length ? { w } : {}) });
        }
        else if (j.text && j.text.trim()) segs.push({ s: round(base, 2), e: round(base + dur, 2), t: j.text.trim() });
      }
      map[id] = { status: 'pronta', segs: this.fine(segs), lang: 'pt', quando: Date.now() };
      App.commit(`Transcrição pronta: ${esc(m.name)}`, { noRefresh: true });
      if (!this._finishing) setTimeout(() => this.applyAuto(id), 50);
      UI.toast(`Transcrição pronta: <b>${esc(m.name)}</b> (${map[id].segs.length} trecho(s), com o segundo de cada fala).`, { kind: 'ok', time: 5000, action: { label: 'Ver / editar', fn: () => this.open(id) } });
      Notify.send('Transcrição pronta', m.name);
    } catch (e) {
      map[id] = { status: 'erro', erro: e.message || String(e), segs: prev?.segs || [] };
      UI.toast(`Não deu para transcrever "${esc(m.name)}": ${esc(e.message || e)}`, { kind: 'err', time: 8000, action: { label: 'Tentar de novo', fn: () => this.run(id) } });
    }
    t.remove(); this.running.delete(id); LibUI.render(); try { Props.render(); } catch { }
  },

  // quebra em frases curtas com o segundo exato de cada uma (pelas palavras): bom para legendar, cortar e reagir
  fine(segs) {
    const out = [];
    for (const sg of segs) {
      if (!sg.w?.length || sg.w.length <= 7) { out.push(sg); continue; }
      let cur = [];
      const push = () => { if (!cur.length) return; out.push({ s: cur[0][0], e: cur[cur.length - 1][1], t: cur.map(x => x[2]).join(' ').replace(/\s+([,.!?;:])/g, '$1'), w: cur }); cur = []; };
      for (let i = 0; i < sg.w.length; i++) {
        const w = sg.w[i], nx = sg.w[i + 1];
        cur.push(w);
        const pause = nx ? nx[0] - w[1] : 0, punct = /[.!?…]$/.test(w[2]), comma = /[,;:]$/.test(w[2]);
        if (!nx || punct || (comma && cur.length >= 3) || pause > .35 || cur.length >= 8) push();
      }
      push();
    }
    return out;
  },
  /* ---------- ver e editar ---------- */
  async open(id) {
    const m = Assets.meta(id); if (!m) return;
    const tr = this.get(id);
    if (!tr || (!tr.segs?.length && tr.status !== 'transcrevendo')) {
      if (!AIClient.server || tr?.status === 'erro') {
        const r = await UI.modal({ title: 'Transcrição', icon: 'text', width: 480, body: h(`<p style="margin:0">${tr?.status === 'erro' ? `A última tentativa deu erro: ${esc(tr.erro)}<br><br>` : ''}Sem o servidor dá para <b>usar o roteiro</b>: cole o texto e o editor acha o segundo de cada palavra pelo som da voz.</p>`), buttons: [{ label: 'Cancelar', value: null }, ...(AIClient.server ? [{ label: 'Tentar de novo', value: 'again' }] : []), { label: 'Usar o roteiro…', kind: 'primary', value: 'script' }] });
        if (r === 'script') return this.scriptDialog(id); if (r === 'again') this.run(id); return;
      }
      const ok = await UI.confirm({ title: 'Transcrição', msg: tr?.status === 'erro' ? `A última tentativa deu erro: ${esc(tr.erro)}<br>Tentar de novo?` : `Transcrever <b>${esc(m.name)}</b> agora?`, ok: 'Transcrever' });
      if (ok) this.run(id); return;
    }
    let segs = (tr.segs || []).map(s => ({ ...s }));
    const f = h(`<div><p style="margin-top:0;font-size:12.5px;color:var(--tx3)">Edite como se fosse legenda: corrija o texto, ajuste o começo/fim (em segundos), <b>✂ divide</b> no ponto do cursor, <b>⤓ junta</b> com o de baixo. A IA usa estas falas e tempos para editar e animar.</p>
      <div class="btn-row" style="margin:0 0 8px"><button class="btn sm" data-a="all">${ic('play', 12)} Tocar tudo</button><button class="btn sm" data-a="stop">${ic('stop', 12)} Parar</button><span class="sp"></span><small data-info style="color:var(--tx3)"></small></div>
      <div class="tr-list" data-l></div>
      <div class="btn-row" style="margin-top:8px"><button class="btn sm" data-a="add">${ic('plus', 12)} Adicionar trecho</button><button class="btn sm" data-a="re">${ic('mic', 12)} Transcrever de novo</button><button class="btn sm" data-a="rot" title="Cola o roteiro: cada palavra do roteiro ganha o tempo certo (corrige os erros)">${ic('text', 12)} Alinhar com o roteiro…</button><button class="btn sm" data-a="fino" title="Encosta o começo/fim de cada palavra no respiro da voz">${ic('vol', 12)} Ajustar tempos pelo som</button><span class="sp"></span><button class="btn sm" data-a="srt" title="Arquivo de legenda (.srt)">${ic('download', 12)} .srt</button><button class="btn sm" data-a="txt" title="Texto com os tempos">${ic('download', 12)} .txt</button></div></div>`);
    $('[data-a=srt]', f).onclick = () => TranscriptExport.download(id, 'srt'); $('[data-a=txt]', f).onclick = () => TranscriptExport.download(id, 'txt');
    const L = $('[data-l]', f), MAXC = 84;
    const paint = (focus) => {
      L.innerHTML = '';
      segs.forEach((s, i) => {
        const row = h(`<div class="tr-row" data-i="${i}"><button class="ibtn xs" data-p title="Ouvir este trecho">${ic('play', 12)}</button><input type="number" step="0.05" min="0" data-s value="${s.s}" title="Começa (segundo em que a fala começa)"><input type="number" step="0.05" min="0" data-e value="${s.e}" title="Termina (segundo em que a fala termina)"><div class="tr-txt"><textarea rows="1" data-t>${esc(s.t)}</textarea><small data-c></small></div><div class="tr-act"><button class="ibtn xs" data-sp title="Dividir no ponto do cursor (✂)">${ic('scissors', 12)}</button><button class="ibtn xs" data-j title="Juntar com o trecho de baixo" ${i === segs.length - 1 ? 'disabled' : ''}>${ic('down', 12)}</button><button class="ibtn xs" data-x title="Apagar trecho">${ic('trash', 12)}</button></div></div>`);
        $('[data-s]', row).oninput = e => s.s = +e.target.value; $('[data-e]', row).oninput = e => s.e = +e.target.value;
        const ta = $('[data-t]', row), cnt = $('[data-c]', row);
        ta.oninput = () => { s.t = ta.value; ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; cnt.textContent = s.t.length > MAXC ? `${s.t.length} letras — longo para uma legenda (✂ para dividir)` : ''; };
        setTimeout(() => ta.oninput(), 0);
        ta.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); split(i, ta.selectionStart); } };
        $('[data-sp]', row).onclick = () => split(i, ta.selectionStart || Math.floor(s.t.length / 2));
        $('[data-j]', row).onclick = () => { const n = segs[i + 1]; if (!n) return; s.t = (s.t + ' ' + n.t).trim(); s.e = n.e; segs.splice(i + 1, 1); paint(i); };
        $('[data-x]', row).onclick = () => { segs.splice(i, 1); paint(); };
        $('[data-p]', row).onclick = () => { this.play(id, s.s, s.e); hl(i); };
        L.appendChild(row);
        if (focus === i) setTimeout(() => ta.focus(), 0);
      });
      if (!segs.length) L.innerHTML = `<div class="hint">Nenhuma fala.</div>`;
      $('[data-info]', f).textContent = `${segs.length} trecho(s) · ${segs.reduce((a, x) => a + x.t.split(/\s+/).filter(Boolean).length, 0)} palavras`;
    };
    // divide o trecho no ponto do cursor (o tempo é repartido pelo tamanho do texto)
    const split = (i, at) => {
      const s = segs[i], t = s.t; if (!t || t.length < 2) return;
      let k = Math.max(1, Math.min(t.length - 1, at || Math.floor(t.length / 2)));
      const sp = t.lastIndexOf(' ', k), sp2 = t.indexOf(' ', k); if (sp > 0 && k - sp < 12) k = sp; else if (sp2 > 0 && sp2 - k < 12) k = sp2;
      const a = t.slice(0, k).trim(), b = t.slice(k).trim(); if (!a || !b) return;
      let mid = round(s.s + (s.e - s.s) * (a.length / (a.length + b.length)), 2), wa, wb;
      if (s.w?.length) { const na = a.split(/\s+/).filter(Boolean).length; if (na > 0 && na < s.w.length) { wa = s.w.slice(0, na); wb = s.w.slice(na); mid = wb[0][0]; } }
      segs.splice(i, 1, { s: s.s, e: wa ? wa[wa.length - 1][1] : mid, t: a, ...(wa ? { w: wa } : {}) }, { s: mid, e: s.e, t: b, ...(wb ? { w: wb } : {}) }); paint(i + 1);
    };
    const hl = i => { $$('.tr-row', L).forEach(r => r.classList.toggle('on', +r.dataset.i === i)); $(`.tr-row[data-i="${i}"]`, L)?.scrollIntoView({ block: 'nearest' }); };
    let raf = 0;
    $('[data-a=all]', f).onclick = () => {
      const t0 = Math.max(0, (segs[0]?.s || 0) - .2); this.play(id, t0, (Assets.meta(id)?.dur || 600)); const ctx = Assets.ctx(), c0 = ctx.currentTime;
      cancelAnimationFrame(raf); const loop = () => { if (!this._src) return; const t = t0 + ctx.currentTime - c0; const i = segs.findIndex(x => t >= x.s && t < x.e); hl(i); raf = requestAnimationFrame(loop); }; loop();
    };
    $('[data-a=stop]', f).onclick = () => { this.stopPlay(); hl(-1); };
    paint();
    $('[data-a=add]', f).onclick = () => { const l = segs[segs.length - 1]; segs.push({ s: l ? l.e : 0, e: (l ? l.e : 0) + 2, t: '' }); paint(segs.length - 1); L.scrollTop = L.scrollHeight; };
    $('[data-a=rot]', f).onclick = () => { after = 'rot'; $('.modal-foot .btn.primary')?.click(); };
    $('[data-a=fino]', f).onclick = () => { after = 'fino'; $('.modal-foot .btn.primary')?.click(); };
    let after = null; $('[data-a=re]', f).onclick = () => { after = 'again'; $('.modal-foot .btn.primary')?.click(); };
    const o = await UI.modal({ title: `Transcrição — ${m.name}`, icon: 'text', width: 760, body: f, buttons: [
      { label: 'Copiar texto', left: true, onClick: () => { navigator.clipboard?.writeText(segs.map(s => s.t).join('\n')); UI.toast('Texto copiado', { kind: 'ok' }); return false; } },
      { label: 'Colocar como legendas na tela…', left: true, onClick: () => { after = 'subs'; return true; }, collect: () => true },
      { label: 'Cancelar', value: null }, { label: 'Salvar', kind: 'primary', collect: () => true }] });
    this.stopPlay(); cancelAnimationFrame(raf);
    if (!o) return;
    segs = segs.filter(s => s.t.trim()).map(s => { const t = s.t.trim(), keep = s.w && s.w.map(x => x[2]).join(' ').replace(/\s+([,.!?;:])/g, '$1') === t && s.w[0][0] === s.s; return { s: round(Math.max(0, s.s), 2), e: round(Math.max(s.s + .05, s.e), 2), t, ...(keep ? { w: s.w } : {}) }; }).sort((a, b) => a.s - b.s);
    this.map()[id] = { ...tr, status: 'pronta', segs, editada: true };
    App.commit('Transcrição editada', { noRefresh: true, toast: !after }); LibUI.render(); try { Props.render(); } catch { }
    if (after === 'again') this.run(id);
    if (after === 'subs') this.subtitlesDialog(id);
    if (after === 'rot') this.scriptDialog(id);
    if (after === 'fino') { this.refineTimes(id); this.open(id); }
  },
  /* ---------- ações automáticas quando a transcrição fica pronta ----------
     p.autoTr[assetId] = { legendas: {estilo, max, y}, gatilhos: [{ palavras: [...], midia, dur, escala, x, y, anim, som, faixa }], feito }
     (ex.: toda vez que falar "Problems", aparece a imagem do Problems com um pop) */
  norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ''); },
  wordHits(id, palavras) {
    const tr = this.get(id), keys = palavras.map(w => this.norm(w)).filter(Boolean), hits = [];
    for (const sg of tr?.segs || []) {
      const words = sg.w?.length ? sg.w : (() => { const ws = sg.t.split(/\s+/).filter(Boolean), tot = ws.reduce((a, x) => a + x.length + 1, 0) || 1; let acc = 0; return ws.map(x => { const a = sg.s + (sg.e - sg.s) * acc / tot; acc += x.length + 1; return [a, sg.s + (sg.e - sg.s) * acc / tot, x]; }); })();
      for (const w of words) { const n = this.norm(w[2]); if (keys.some(k => n.startsWith(k) || (k.length > 5 && n.includes(k)))) hits.push({ s: w[0], e: w[1], t: w[2] }); }
    }
    return hits;
  },
  pendingAuto() { const p = App.project; return Object.entries(p?.autoTr || {}).filter(([id, c]) => !c.feito && Assets.meta(id)).map(([id]) => id); },
  onOpen() { if (this.pendingAuto().length) this.finishAuto(); },
  // termina a edição: transcreve (se precisar), coloca legendas e reações — com uma janela mostrando o andamento
  async finishAuto() {
    if (this._finishing) return; this._finishing = true; try { return await this._finishAuto(); } finally { this._finishing = false; }
  },
  async _finishAuto() {
    const ids = this.pendingAuto(); if (!ids.length) return UI.toast('Não tem nada pendente para terminar.', { time: 2500 });
    const box = h(`<div><p style="margin-top:0">Para terminar a edição, vou <b>transcrever o áudio</b> (com o segundo de cada palavra) e depois colocar as <b>legendas</b> e as <b>reações</b> nos momentos certos.</p><div class="fin-steps" data-s></div></div>`);
    const S = $('[data-s]', box), step = (txt, st) => { const el = h(`<div class="fin-step ${st}">${st === 'run' ? '<span class="spin-dot"></span>' : st === 'ok' ? ic('check', 13) : ic('alert', 13)}<span>${txt}</span></div>`); S.appendChild(el); return el; };
    let closeFn; const done = new Promise(r => closeFn = r);
    UI.modal({ title: 'Terminando a edição', icon: 'text', width: 520, body: box, sticky: true, buttons: [{ label: 'Fechar', value: null }] }).then(() => closeFn());
    if (!AIClient.server) { step('A IA do Estúdio Problems não está ligada neste editor (falta o endereço do servidor em js/config.js).', 'err'); return; }
    for (const id of ids) {
      const m = Assets.meta(id);
      if (!this.get(id)?.segs?.length) {
        const st = step(`Transcrevendo "${esc(m.name)}"…`, 'run');
        await this.run(id, true);
        const tr = this.get(id);
        if (!tr?.segs?.length) {
          st.remove();
          const why = tr?.erro || 'a transcrição não voltou nada';
          step(`Não deu para transcrever: ${esc(why)}`, 'err');
          step(/Workers AI|binding|AI\b|sem_ia|antiga|404/i.test(why) ? 'Na Cloudflare: cole o worker.js novo (Edit Code → Deploy) e adicione em Bindings → Workers AI com o nome <b>AI</b>. Depois clique em Projeto → <b>Terminar edição pela transcrição</b>.' : 'Confira a internet e o servidor da IA, e tente de novo em Projeto → <b>Terminar edição pela transcrição</b>.', 'err');
          continue;
        }
        st.remove(); step(`Transcrição pronta: ${tr.segs.length} trecho(s)`, 'ok');
      }
      const r = this.applyAuto(id, true);
      if (r) { step(`${r.leg} legenda(s) na tela`, 'ok'); step(r.gat ? `${r.gat} aparição(ões) quando a palavra foi falada${r.apont ? ' (com o personagem apontando)' : ''}` : `A palavra-gatilho não apareceu na transcrição (${esc(r.palavras)}). Se ela foi escrita diferente, corrija na aba Transcrição e clique em Projeto → Terminar edição pela transcrição.`, r.gat ? 'ok' : 'err'); }
    }
    step('Pronto! Dá para desfazer tudo isso com Ctrl+Z.', 'ok');
    return done;
  },
  applyAuto(id, quiet) {
    const p = App.project, cfg = p?.autoTr?.[id]; if (!cfg || cfg.feito || !this.get(id)?.segs?.length) return null;
    let nApont = 0;
    const clips = p.clips.filter(c => c.assetId === id && !c.muted && (c.type === 'audio' || c.type === 'video'));
    if (!clips.length) return null;
    let nGat = 0, nLeg = 0;
    for (const g of cfg.gatilhos || []) {
      if (!Assets.meta(g.midia)) continue;
      let tk = p.tracks.find(t => t.type === 'visual' && t.name === (g.faixa || 'Reações'));
      if (!tk) { tk = Actions.addTrack('visual', Math.max(0, p.tracks.findIndex(t => t.type === 'visual')), true); tk.name = g.faixa || 'Reações'; }
      let lastEnd = -1;
      for (const c of clips) {
        const sp = c.speed || 1, off = c.offset || 0;
        for (const hit of this.wordHits(id, g.palavras || [])) {
          if (hit.s < off || hit.s > off + c.dur * sp) continue;
          const T = App.frame(Math.max(0, c.start + (hit.s - off) / sp - .08));
          if (T < lastEnd) continue;
          const dur = g.dur || 3, nc = App.makeClip(Assets.meta(g.midia).kind, { start: T, dur, assetId: g.midia, name: Assets.meta(g.midia).name.replace(/\.[^.]+$/, '') });
          nc.trackId = tk.id; Object.assign(nc.tr, { x: g.x ?? 0, y: g.y ?? 0, scale: g.escala ?? .7 }); if (g.encaixe) nc.tr.fit = g.encaixe;
          const add = (type, st, du, params) => { const def = ANIMS[type]; if (def) nc.anims.push({ id: uid('i_'), type, start: st, dur: du ?? def.dur, params: { ...defaultParams(def), ...(params || {}) }, sound: { ...defaultSound(def), mode: 'off' } }); };
          const tin = g.entrada ?? .5, tout = g.saida ?? .45;
          add(g.anim || 'popIn', 0, tin); add('float', tin, Math.max(.2, dur - tin - tout), { amp: 10 }); add('popOut', Math.max(tin + .1, dur - tout), tout);
          // o personagem principal aponta para quem apareceu
          if (g.apontar) {
            const ap = g.apontar, tk2 = p.tracks.find(t => t.name === (ap.faixa || 'Personagem'));
            for (const pc of p.clips.filter(x => x.trackId === tk2?.id && x.start < T + dur && x.start + x.dur > T)) {
              let mid = pc; if (T > pc.start + .05) mid = Actions.splitCore(pc, T) || pc;
              if (mid.start + mid.dur > T + dur + .05) Actions.splitCore(mid, T + dur);
              if (ap.midia && Assets.meta(ap.midia)) Actions.swapAsset(mid, ap.midia);
              if (ap.x !== undefined) mid.tr.x = ap.x; if (ap.flip !== undefined) mid.tr.flipX = !!ap.flip;
              mid.kf = {}; mid.anims = mid.anims.filter(a => a.type === 'talk');
              const dj = ANIMS.jump; mid.anims.push({ id: uid('i_'), type: 'jump', start: 0, dur: .4, params: { ...defaultParams(dj), height: 40, count: 1 }, sound: { ...defaultSound(dj), mode: 'off' } });
              nApont++;
            }
          }
          p.clips.push(nc); lastEnd = T + dur; nGat++;
          if (g.som && SOUNDS.defs[g.som]) { const sc = App.makeClip('audio', { start: T, dur: SOUNDS.defs[g.som].sec, assetId: 'snd:' + g.som, name: SOUNDS.defs[g.som].name }); sc.volume = g.volume || 80; Actions.place(sc); }
        }
      }
    }
    if (cfg.legendas) nLeg = this.toSubtitles(id, { ...cfg.legendas, silent: true });
    cfg.feito = true;
    App.commit(`Edição terminada pela transcrição: ${nGat} reação(ões) e ${nLeg} legenda(s)`, { toast: !quiet, all: true });
    if (!quiet) UI.toast(`Pronto! Com a transcrição coloquei <b>${nGat}</b> aparição(ões) por palavra e <b>${nLeg}</b> legenda(s). Confira na linha do tempo.`, { kind: 'ok', time: 7000 });
    return { gat: nGat, leg: nLeg, apont: nApont, palavras: (cfg.gatilhos || []).flatMap(g => g.palavras || []).slice(0, 3).join(', ') };
  },
  /* ---------- transcrição → legendas (textos na tela) ---------- */
  chunks2(text, s, e, max, words, T) {
    if (words?.length) { // tempos exatos de cada palavra
      const out = []; let cur = [];
      const push = () => { if (cur.length) out.push({ s: T(cur[0][0]), e: T(cur[cur.length - 1][1]), t: cur.map(x => x[2]).join(' ').replace(/\s+([,.!?;:])/g, '$1') }); cur = []; };
      for (const w of words) { const len = cur.map(x => x[2]).join(' ').length; if (cur.length && len + 1 + w[2].length > max) push(); cur.push(w); }
      push(); return out;
    }
    const ws = text.split(/\s+/).filter(Boolean), out = []; let cur = '';
    for (const w of ws) { if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    if (cur) out.push(cur);
    const total = out.reduce((a, x) => a + x.length, 0) || 1; let t = s;
    return out.map(x => { const d = (e - s) * x.length / total, r = { s: t, e: t + d, t: x }; t += d; return r; });
  },
  toSubtitles(id, o = {}) {
    const p = App.project, tr = this.get(id); if (!tr?.segs?.length) return 0;
    const clips = p.clips.filter(c => c.assetId === id && (c.type === 'audio' || c.type === 'video') && !c.muted && (!o.clipe || c.id === o.clipe));
    if (!clips.length) { if (!o.silent) UI.toast('Coloque esse áudio na linha do tempo antes de fazer as legendas.', { kind: 'warn' }); return 0; }
    const style = TEXT_STYLES[o.estilo] ? o.estilo : 'subtitle', max = clamp(+o.max || 42, 12, 120);
    let tk = p.tracks.find(t => t.type === 'visual' && t.name === 'Legendas');
    if (!tk) { tk = Actions.addTrack('visual', Math.max(0, p.tracks.findIndex(t => t.type === 'visual')), true); tk.name = 'Legendas'; }
    const items = [];
    for (const c of clips) {
      const sp = c.speed || 1, off = c.offset || 0, T = x => c.start + (x - off) / sp;
      for (const sg of tr.segs) { if (sg.e <= off || sg.s >= off + c.dur * sp) continue; const a = Math.max(c.start, T(sg.s)), b = Math.min(c.start + c.dur, T(sg.e)); if (b - a < .05) continue; items.push(...this.chunks2(sg.t, a, b, max, sg.w, T)); }
    }
    items.sort((a, b) => a.s - b.s);
    const lo = Math.min(...items.map(x => x.s)), hi = Math.max(...items.map(x => x.e));
    if (o.substituir !== false) p.clips = p.clips.filter(c => !(c.trackId === tk.id && c.type === 'text' && c.start < hi && c.start + c.dur > lo));
    let n = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i], nx = items[i + 1], start = App.frame(it.s), end = Math.min(it.e + .15, nx ? nx.s : it.e + .15);
      const nc = App.makeClip('text', { style, start, dur: Math.max(1 / App.fps, App.frame(end) - start) }); nc.text.text = it.t; nc.name = it.t.slice(0, 24); nc.trackId = tk.id;
      if (o.y !== undefined && isFinite(+o.y)) nc.tr.y = +o.y; if (o.cor) nc.text.color = o.cor; if (o.tamanho) nc.text.size = +o.tamanho;
      p.clips.push(nc); n++;
    }
    if (!o.silent) { App.commit(`${n} legenda(s) criadas a partir da transcrição`, { toast: true, all: true }); App.seek(lo); }
    return n;
  },
  async subtitlesDialog(id) {
    const f = h(`<div class="fgrid"><label class="field">Estilo do texto<select data-k="estilo">${Object.entries(TEXT_STYLES).map(([k, v]) => `<option value="${k}" ${k === (App.project.settings.h > App.project.settings.w ? 'shorts' : 'subtitle') ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
      <label class="field">Máximo de letras por legenda<input type="number" min="12" max="120" data-k="max" value="42"></label>
      <p class="hint full" style="margin:0">Cria uma faixa <b>Legendas</b> com um texto para cada fala, nos tempos certos. Depois dá para editar cada texto normalmente — ou pedir para a IA estilizar.</p></div>`);
    const o = await UI.modal({ title: 'Colocar como legendas na tela', icon: 'text', width: 460, body: f, enterValue: true, buttons: [{ label: 'Cancelar', value: null }, { label: 'Criar legendas', kind: 'primary', collect: () => Actions.readForm(f) }] });
    if (o) this.toSubtitles(id, o);
  },
  play(id, s, e) {
    this.stopPlay();
    const buf = Assets.audioBuffer(id, Assets.ctx()); if (!buf) return;
    const ctx = Assets.ctx(), src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start(0, Math.max(0, s), Math.max(.1, e - s)); this._src = src;
  },
  stopPlay() { try { this._src?.stop(); } catch { } this._src = null; },

  /* ---------- para a IA ---------- */
  forPrompt() {
    const p = App.project, map = this.map(); if (!p) return '';
    const lines = [], usedIds = new Set();
    for (const c of p.clips) {
      if (!c.assetId || !map[c.assetId]?.segs?.length || c.muted || !(c.type === 'audio' || c.type === 'video')) continue;
      usedIds.add(c.assetId);
      const sp = c.speed || 1, o = c.offset || 0, segs = map[c.assetId].segs.filter(s => s.e > o && s.s < o + c.dur * sp);
      if (!segs.length) continue;
      lines.push(`Falas do clipe ${c.id} ("${c.name || ''}") — tempos JÁ na linha do tempo:\n` + segs.map(s => `  [${round(c.start + Math.max(0, s.s - o) / sp, 2)}–${round(c.start + Math.min(c.dur * sp, s.e - o) / sp, 2)}] ${s.t}`).join('\n'));
    }
    for (const [id, tr] of Object.entries(map)) {
      if (usedIds.has(id) || !tr.segs?.length || !Assets.meta(id)) continue;
      lines.push(`Falas da mídia ${id} ("${Assets.meta(id).name}", ainda fora da linha do tempo; tempos dentro do áudio):\n` + tr.segs.slice(0, 200).map(s => `  [${s.s}–${s.e}] ${s.t}`).join('\n'));
    }
    return lines.length ? 'TRANSCRIÇÃO DOS ÁUDIOS (o que é falado e quando — use para sincronizar falas, reações e legendas):\n' + lines.join('\n').slice(0, 20000) : '';
  },
};
