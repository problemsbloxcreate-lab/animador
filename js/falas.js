/* ===================== falas.js — Ateliê: áudios de teste para conferir a animação de fala =====================
   Pôr um áudio ou gravar pelo microfone, transcrever (servidor do Estúdio Problems) e editar cada fala (início, fim e texto).
   "Testar a fala" toca o áudio e mexe a boca do personagem pelo som e pelas letras da transcrição, junto (se quiser) com uma
   animação de teste (ex.: Explicando). Os áudios ficam SÓ no Ateliê, neste personagem: vão no .atelieanimador e na nuvem,
   mas não entram nas animações do editor (lá a voz é posta na aba Voz).
   def.audios = [{ id, nome, k, dur, falas:[{ de, ate, t }] (segundos), boca:{ s: sessaoId } | { p: parteId } }] */
'use strict';
const Falas = {
  buf: new Map(), tocando: null, _src: null, _raf: 0, aberto: null, anim: '',
  get def() { return Atelie.def; },
  lista() { const d = this.def; return d ? (d.audios ||= []) : []; },
  achar(id) { return this.lista().find(a => a.id === id) || null; },
  tempo(s) { s = Math.max(0, +s || 0); const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`.replace('.', ','); },
  // "0:01", "1:02,5", "12" ou "12,5" → segundos
  leTempo(txt) { const t = String(txt || '').trim().replace(',', '.'); if (!t) return null; const p = t.split(':').map(Number); if (p.some(x => !isFinite(x))) return null; return p.length === 1 ? p[0] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2]; },
  aviso() { return 'Os áudios de teste ficam <b>só no Ateliê</b>, neste personagem: vão junto no <b>.atelieanimador</b> e na <b>nuvem</b>, mas <b>não entram nas animações do Animador</b> (lá a voz vai na aba Voz).'; },

  /* ---------- pôr / gravar ---------- */
  async por() { const fs = await pickFiles('audio/*,.mp3,.wav,.ogg,.m4a,.webm', true); for (const f of fs || []) await this.add(f, f.name.replace(/\.[^.]+$/, '').slice(0, 40)); },
  async add(blob, nome) {
    const ext = /mp4|m4a/.test(blob.type) ? 'm4a' : /mpeg|mp3/.test(blob.type) ? 'mp3' : /wav/.test(blob.type) ? 'wav' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
    const k = `personagens/${this.def.id}/aud/${uid('au').toLowerCase().replace(/[^a-z0-9]/g, '')}.${ext}`; await Arq.guardar(blob, k);
    const b = await this.buffer(k); if (!b) { UI.toast('Não consegui abrir esse áudio.', { kind: 'err' }); return null; }
    const a = { id: uid('au'), nome: nome || 'Áudio', k, dur: round(b.duration, 2), falas: [] }; this.lista().push(a); this.aberto = a.id; Atelie.aba = 'animacoes'; Atelie.commit();
    const tr = await UI.modal({ title: 'Áudio de teste', icon: 'mic', width: 460, body: `<div><p style="margin:0 0 10px">${this.aviso()}</p><p style="margin:0;color:var(--tx2)">Quer transcrever agora? Dá para editar cada fala (início, fim e texto) depois.</p></div>`,
      buttons: [{ label: 'Depois', value: false }, { label: 'Transcrever', kind: 'primary ia', icon: 'sparkles', value: true }] });
    if (tr) await this.transcrever(a); return a;
  },
  async gravar() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return UI.toast('Este navegador não grava áudio. Use o Chrome ou o Edge.', { kind: 'err' });
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { return UI.toast('Não deu para usar o microfone. Libere o microfone para este site (cadeado ao lado do endereço).', { kind: 'err', time: 7000 }); }
    const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    const ac = Som.ac(); try { await ac.resume(); } catch { } const src = ac.createMediaStreamSource(stream), an = ac.createAnalyser(); an.fftSize = 512; src.connect(an); const bf = new Uint8Array(an.fftSize);
    const body = h(`<div class="grav"><div class="grav-st"><i class="grav-pt"></i><b data-t>Pronto para gravar</b><span class="sp"></span><code data-tempo>0:00</code></div><div class="grav-nivel"><i data-n></i></div>
      <div style="color:var(--tx3);font-size:12px;margin-top:8px">${this.aviso()}</div></div>`);
    let rec = null, ped = [], t0 = 0, raf = 0, fim = null;
    const anda = () => { an.getByteTimeDomainData(bf); let m = 0; for (const v of bf) m = Math.max(m, Math.abs(v - 128)); $('[data-n]', body).style.width = Math.min(100, m / 128 * 160) + '%';
      if (rec) { const s = (performance.now() - t0) / 1000; $('[data-tempo]', body).textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; } raf = requestAnimationFrame(anda); };
    anda();
    const r = await UI.modal({ title: 'Gravar áudio de teste', icon: 'mic', width: 480, body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Gravar', kind: 'primary', onClick: api => {
      if (!rec) { ped = []; rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : {}); rec.ondataavailable = e => { if (e.data.size) ped.push(e.data); }; fim = new Promise(ok => rec.onstop = ok); rec.start(250); t0 = performance.now(); body.classList.add('gravando'); $('[data-t]', body).textContent = 'Gravando…'; api.foot.querySelector('.btn.primary').textContent = 'Parar e guardar'; return false; }
      rec.stop(); return 'ok'; } }] });
    if (rec && rec.state !== 'inactive') rec.stop(); if (rec) await fim; cancelAnimationFrame(raf); stream.getTracks().forEach(t => t.stop()); try { src.disconnect(); } catch { }
    if (r !== 'ok' || !ped.length) return;
    await this.add(new Blob(ped, { type: rec.mimeType || tipo || 'audio/webm' }), 'Gravação ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  },
  async buffer(k) {
    if (this.buf.has(k)) return this.buf.get(k);
    let b = await Arq.pegaBlob(k); if (!b && /^personagens\//.test(k)) b = await Nuvem.baixar(k).catch(() => null); if (!b) return null;
    const ab = await Som.ac().decodeAudioData(await b.arrayBuffer()).catch(() => null); if (ab) this.buf.set(k, ab); return ab;
  },
  // força do som em cada 1/60 s (0..1)
  picos(b) { if (b._pk) return b._pk; const d = b.getChannelData(0), por = b.sampleRate / 60, n = Math.ceil(b.length / por), o = new Float32Array(n); let mx = 1e-6;
    for (let i = 0; i < n; i++) { let s = 0; const a = Math.floor(i * por), z = Math.min(d.length, Math.floor((i + 1) * por)); for (let j = a; j < z; j += 4) s += d[j] * d[j]; o[i] = Math.sqrt(s / Math.max(1, (z - a) / 4)); mx = Math.max(mx, o[i]); }
    for (let i = 0; i < n; i++) o[i] /= mx; return (b._pk = o); },

  /* ---------- transcrever (com a tela de "trabalhando") ---------- */
  async transcrever(a) {
    const b = await this.buffer(a.k); if (!b) return UI.toast('O áudio ainda não carregou.', { kind: 'warn' });
    const fim = Ocupado.inicio({ tipo: 'transcrever', titulo: `Transcrevendo "${a.nome}"`, est: Math.max(8, b.duration * .5), subtitulo: 'Preparando o áudio…' });
    try {
      const sr = 16000, off = new OfflineAudioContext(1, Math.ceil(b.duration * sr), sr), src = off.createBufferSource(); src.buffer = b; src.connect(off.destination); src.start(); const mono = (await off.startRendering()).getChannelData(0);
      const ped = 60 * sr, segs = [], hd = await Nuvem.hd();
      for (let o = 0; o < mono.length; o += ped) {
        Ocupado.passo(`Ouvindo a fala… ${Math.round(o / mono.length * 100)}%`); Ocupado.parte(o, mono.length);
        const r = await fetch(Nuvem.srv + '/transcrever', { method: 'POST', headers: { 'content-type': 'application/json', ...hd }, body: JSON.stringify({ audio: Som.wav64(mono.subarray(o, Math.min(mono.length, o + ped)), sr), language: 'pt' }) });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || 'erro ' + r.status); const base = o / sr;
        for (const s of j.segments || []) { const ws = (s.words || []).filter(w => String(w.w || '').trim());
          if (ws.length) { let cur = []; const fecha = () => { if (!cur.length) return; segs.push({ de: round(base + cur[0].s, 2), ate: round(base + cur[cur.length - 1].e, 2), t: cur.map(w => w.w.trim()).join(' ') }); cur = []; };
            for (const w of ws) { if (cur.length && cur.map(x => x.w).join(' ').length + w.w.length > 40) fecha(); cur.push(w); } fecha(); }
          else if (String(s.text || '').trim()) segs.push({ de: round(base + s.start, 2), ate: round(base + s.end, 2), t: String(s.text).trim() }); }
      }
      fim(); a.falas = segs; this.aberto = a.id; Atelie.aba = 'animacoes'; Atelie.commit(); UI.toast(`${segs.length} fala(s) em "${esc(a.nome)}". Confira e arrume o início, o fim e o texto se precisar.`, { kind: 'ok', time: 6000 });
    } catch (e) { fim(); UI.toast('Não deu para transcrever: ' + esc(e.message || e), { kind: 'err', time: 7000 }); }
  },

  /* ---------- testar a fala: toca o áudio e mexe a boca ---------- */
  nrm: s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(),
  // onde fica a boca: sessão "Boca" (presets) ou parte "Boca" (imagens)
  alvoBoca(a) {
    const d = this.def, s = d.sessoes.find(x => x.id === a?.boca?.s) || d.sessoes.find(x => /boca|mouth|labio/i.test(this.nrm(x.nome)));
    if (s?.presets.length) return { s, itens: s.presets.map(p => ({ id: p.id, nome: p.nome })) };
    const p = d.partes.find(x => x.id === a?.boca?.p) || d.partes.find(x => /boca|mouth/i.test(this.nrm(x.nome)) && x.imgs.length > 1);
    return p ? { p, itens: p.imgs.map(i => ({ id: i.id, nome: i.nome })) } : null;
  },
  // cada boca pelo nome: A, E (e I), O, U, M (M/B/P, fechada), F (F/V)
  mapaBocas(alvo) {
    const m = {}, acha = re => alvo.itens.find(x => re.test(this.nrm(x.nome)))?.id;
    m.A = acha(/^a\b|^a$|aberta|^ah\b/); m.E = acha(/^e\b|^e$|^i\b|^i$/) || m.A; m.O = acha(/^o\b|^o$|surpres/) || m.A; m.U = acha(/^u\b|^u$/) || m.O;
    m.M = acha(/m\s*\/?\s*b|^m\b|^m$|fechad/); m.F = acha(/f\s*\/?\s*v|^f\b|^f$/) || m.E;
    m.fechada = m.M || acha(/sorriso|normal|padr|neutr/) || null; // null = a pose padrão
    if (!m.A) { const L = alvo.itens; m.A = L[L.length - 1]?.id; m.E = m.E || L[Math.floor(L.length / 2)]?.id; m.O = m.O || m.A; m.U = m.U || m.O; m.F = m.F || m.E; } // nomes desconhecidos: da fechada à mais aberta pela ordem
    return m;
  },
  letra(c) { c = this.nrm(c); return /[a]/.test(c) ? 'A' : /[ei]/.test(c) ? 'E' : /[o]/.test(c) ? 'O' : /[u]/.test(c) ? 'U' : /[mbp]/.test(c) ? 'M' : /[fv]/.test(c) ? 'F' : null; },
  bocaEm(a, b, t, m, ult) {
    const pk = this.picos(b), amp = pk[Math.min(pk.length - 1, Math.floor(t * 60))] || 0;
    if (amp < .1) return m.fechada;
    const f = (a.falas || []).find(x => t >= x.de && t <= x.ate);
    if (f) { const L = [...this.nrm(f.t).replace(/[^a-z]/g, '')]; if (L.length) { const k = L[Math.min(L.length - 1, Math.floor((t - f.de) / Math.max(.05, f.ate - f.de) * L.length))], q = this.letra(k); if (q) return m[q] || m.A; return ult ?? (amp > .5 ? m.A : m.E); } }
    return amp > .6 ? m.A : amp > .35 ? m.O : amp > .18 ? m.E : m.fechada;
  },
  async testar(a) {
    if (this.tocando === a.id) return this.parar();
    this.parar(); const b = await this.buffer(a.k); if (!b) return UI.toast('O áudio ainda não carregou.', { kind: 'warn' });
    const alvo = this.alvoBoca(a); if (!alvo) UI.toast('Não achei a boca: crie uma sessão "Boca" (ou uma parte "Boca" com as imagens das bocas). Vou tocar só o som.', { kind: 'warn', time: 6000 });
    const m = alvo ? this.mapaBocas(alvo) : null, anim = this.anim ? Animacoes.achar(this.anim) : null, ac = Som.ac(); try { await ac.resume(); } catch { }
    Animacoes.parar(true); Atelie.edit = null; Atelie.editPasso = null; if (!Atelie.teste) Atelie.teste = { sessoes: {}, partes: {} };
    const base = clone(Atelie.teste || { sessoes: {}, partes: {} }), src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination); const t0 = ac.currentTime + .05; src.start(t0);
    this._src = src; this.tocando = a.id; this._base = base; let ult = null, desde = -1;
    src.onended = () => { if (this.tocando === a.id) this.parar(); };
    const leg = this.legenda();
    const anda = () => {
      if (this.tocando !== a.id) return; const t = ac.currentTime - t0; if (t > b.duration + .1) return this.parar();
      const F = anim ? Animacoes.frame(anim, Math.floor(Math.max(0, t) * 1000 / (+anim.vel || 250))) : clone(base);
      if (m) { let id = this.bocaEm(a, b, Math.max(0, t), m, ult); if (id !== ult && t - desde < .066) id = ult; else if (id !== ult) { ult = id; desde = t; } // segura cada boca pelo menos 2 quadros
        if (alvo.s) { if (id) F.sessoes[alvo.s.id] = id; else delete F.sessoes[alvo.s.id]; } else if (id) F.partes[alvo.p.id] = { ...(F.partes[alvo.p.id] || {}), img: id }; }
      Atelie.teste = F; Atelie.desenha();
      const f = (a.falas || []).find(x => t >= x.de && t <= x.ate); leg.textContent = f ? f.t : ''; leg.hidden = !f;
      $$(`[data-prog="${a.id}"]`).forEach(e => e.style.width = Math.min(100, t / b.duration * 100) + '%');
      $$(`[data-fala-de="${a.id}"]`).forEach(e => e.classList.toggle('on', +e.dataset.i === (a.falas || []).indexOf(f)));
      this._raf = requestAnimationFrame(anda);
    };
    Atelie.pinta(); anda();
  },
  legenda() { let e = $('#at-legenda'); if (!e) { e = h('<div id="at-legenda" class="at-legenda" hidden></div>'); $('.at-palco').appendChild(e); } return e; },
  parar() {
    cancelAnimationFrame(this._raf); try { this._src?.stop(); } catch { } this._src = null; const tinha = this.tocando; this.tocando = null;
    const l = $('#at-legenda'); if (l) l.hidden = true; if (tinha) { Atelie.teste = this._base || { sessoes: {}, partes: {} }; Atelie.pinta(); }
  },
  // ouvir só um trecho (para conferir o tempo de uma fala)
  async ouvir(a, de, ate) { this.parar(); const b = await this.buffer(a.k); if (!b) return; const ac = Som.ac(); try { await ac.resume(); } catch { } const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0, Math.max(0, de), Math.max(.05, ate - de)); this._src = s; },

  /* ---------- telas ---------- */
  // na aba Animações
  pinta(el) {
    const L = this.lista(), box = h(`<div class="falas-at"><div class="tt-sec fl-sec">${ic('mic', 13)} Áudios de teste (fala)<span class="sp"></span><button class="btn sm" data-por>${ic('upload', 12)} Pôr</button><button class="btn sm" data-grav>${ic('mic', 12)} Gravar</button></div>
      <div class="fl-aviso">${ic('info', 13)}<span>${this.aviso()}</span></div><div data-l></div></div>`), l = $('[data-l]', box);
    $('[data-por]', box).onclick = () => this.por(); $('[data-grav]', box).onclick = () => this.gravar();
    if (!L.length) l.appendChild(h('<div class="vazio" style="padding:10px">Ponha ou grave uma fala para testar a boca do personagem com o som.</div>'));
    if (L.length && (this.def.animacoes || []).length) { const s = h(`<label class="fl-junto">Junto com a animação <select><option value="">(nenhuma: só a boca)</option>${this.def.animacoes.map(x => `<option value="${x.id}" ${this.anim === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>`); $('select', s).onchange = ev => { this.anim = ev.target.value; }; l.appendChild(s); }
    for (const a of L) {
      const ab = this.aberto === a.id, toca = this.tocando === a.id, alvo = this.alvoBoca(a);
      const c = h(`<div class="fl ${ab ? 'aberta' : ''} ${toca ? 'toca' : ''}"><div class="fl-cab"><button class="ibtn" data-t title="${toca ? 'Parar' : 'Testar a fala (som + boca)'}">${ic(toca ? 'square' : 'play', 13)}</button><b>${esc(a.nome)}</b><small>${this.tempo(a.dur)} · ${(a.falas || []).length} fala(s)</small><span class="sp"></span>
        <button class="ibtn ia" data-tr title="Transcrever (a IA ouve e escreve as falas)">${ic('sparkles', 13)}</button><button class="ibtn" data-m title="Mais">${ic('dots', 13)}</button></div><div class="fl-barra"><i data-prog="${a.id}"></i></div></div>`);
      $('[data-t]', c).onclick = () => this.testar(a); $('[data-tr]', c).onclick = () => this.transcrever(a);
      $('.fl-cab', c).onclick = ev => { if (ev.target.closest('button')) return; this.aberto = ab ? null : a.id; Atelie.pinta(); };
      $('[data-m]', c).onclick = ev => this.menu(ev, a); c.oncontextmenu = ev => { ev.preventDefault(); this.menu(ev, a); };
      if (ab) {
        const bx = h(`<div class="fl-corpo"><label class="fl-junto">Boca <select data-boca><option value="">(achar sozinho${alvo ? ': ' + esc(alvo.s?.nome || alvo.p?.nome) : ''})</option>${this.def.sessoes.map(s => `<option value="s:${s.id}" ${a.boca?.s === s.id ? 'selected' : ''}>sessão ${esc(s.nome)}</option>`).join('')}${this.def.partes.filter(p => p.imgs.length > 1).map(p => `<option value="p:${p.id}" ${a.boca?.p === p.id ? 'selected' : ''}>parte ${esc(p.nome)}</option>`).join('')}</select></label>
          <div class="fl-falas"></div><div class="campo2"><button class="btn sm" data-add>${ic('plus', 12)} Fala</button><span class="dica-a">Tempo: 0:01 ou 0:01,5 · o texto ajuda a boca (A, E, O, U, M, F…)</span></div></div>`), fl = $('.fl-falas', bx);
        $('[data-boca]', bx).onchange = ev => { const v = ev.target.value; a.boca = v ? (v[0] === 's' ? { s: v.slice(2) } : { p: v.slice(2) }) : undefined; if (!a.boca) delete a.boca; Atelie.commit(); };
        (a.falas || []).forEach((f, i) => {
          const r = h(`<div class="fl-f" data-fala-de="${a.id}" data-i="${i}"><input class="fl-tm" value="${this.tempo(f.de)}" data-c="de" title="Início"><span>–</span><input class="fl-tm" value="${this.tempo(f.ate)}" data-c="ate" title="Fim"><input class="fl-tx" value="${esc(f.t)}" data-c="t" placeholder="O que é falado"><button class="ibtn" data-o title="Ouvir este trecho">${ic('vol', 12)}</button><button class="ibtn" data-x title="Tirar a fala">${ic('x', 12)}</button></div>`);
          $$('input', r).forEach(inp => inp.onchange = () => { const c = inp.dataset.c; if (c === 't') f.t = inp.value; else { const v = this.leTempo(inp.value); if (v == null) { inp.value = this.tempo(f[c]); return UI.toast('Use o tempo assim: 0:01 ou 0:01,5', { kind: 'warn' }); } f[c] = round(clamp(v, 0, a.dur || v), 2); if (f.ate < f.de) [f.de, f.ate] = [f.ate, f.de]; a.falas.sort((x, y) => x.de - y.de); } Atelie.commit(); });
          $('[data-o]', r).onclick = () => this.ouvir(a, f.de, f.ate); $('[data-x]', r).onclick = () => { a.falas.splice(i, 1); Atelie.commit(); };
          fl.appendChild(r); });
        if (!(a.falas || []).length) fl.appendChild(h('<div class="tt-nada" style="padding:4px 0">Sem falas: transcreva com a IA ou ponha à mão.</div>'));
        $('[data-add]', bx).onclick = () => { const ult = (a.falas || []).at(-1), de = ult ? Math.min(a.dur, ult.ate + .1) : 0; (a.falas ||= []).push({ de: round(de, 2), ate: round(Math.min(a.dur, de + 1.5), 2), t: '' }); Atelie.commit(); };
        c.appendChild(bx);
      }
      l.appendChild(c);
    }
    el.appendChild(box);
  },
  // no painel Testar (dentro de Animações de teste)
  mini() {
    const L = this.lista(), box = h('<div class="tt-falas"></div>'); if (!L.length) return box;
    box.appendChild(h(`<div class="tt-sub">${ic('mic', 11)} Testar fala com áudio</div>`));
    for (const a of L) { const toca = this.tocando === a.id, r = h(`<div class="tt-a ${toca ? 'on' : ''}"><button class="ibtn" title="${toca ? 'Parar' : 'Tocar com a boca'}">${ic(toca ? 'square' : 'vol', 13)}</button><span>${esc(a.nome)}</span><small>${this.tempo(a.dur)}</small></div>`); $('button', r).onclick = () => this.testar(a); box.appendChild(r); }
    return box;
  },
  menu(ev, a) {
    UI.ctx(ev.clientX, ev.clientY, [
      { label: this.tocando === a.id ? 'Parar' : 'Testar a fala', icon: 'play', action: () => this.testar(a) },
      { label: 'Transcrever de novo', icon: 'sparkles', ai: true, action: () => this.transcrever(a) },
      { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome do áudio', value: a.nome }); if (n) { a.nome = n; Atelie.commit(); } } },
      { label: 'Baixar o áudio', icon: 'download', action: async () => { const b = await Arq.pegaBlob(a.k) || await Nuvem.baixar(a.k).catch(() => null); if (b) downloadBlob(b, safeName(a.nome) + '.' + (a.k.split('.').pop() || 'webm')); } },
      '-', { label: 'Tirar o áudio', icon: 'trash', danger: true, action: async () => { if (!(await UI.confirm({ title: `Tirar "${esc(a.nome)}"?`, msg: 'O áudio e as falas saem deste personagem.', ok: 'Tirar', danger: true }))) return; if (this.tocando === a.id) this.parar(); this.def.audios = this.lista().filter(x => x !== a); Atelie.commit(); } },
    ]);
  },
};
window.Falas = Falas;
