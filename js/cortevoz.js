/* ===================== cortevoz.js — EDITOR DE CORTE DO ÁUDIO (como o dos Shorts / Premiere) =====================
   Abre um áudio da animação numa janela grande com a onda fina do ARQUIVO inteiro: o que fica (as PEÇAS) aparece aceso e o que sai, apagado.
   Arrastar a ponta de uma peça gruda no ponto mais quieto perto (Shift = sem grudar) · clique = cursor · Espaço = tocar/pausar do cursor ·
   Enter = tocar a peça escolhida · I / O = começo / fim da peça no cursor · S = dividir no cursor · Delete = tirar a peça escolhida ·
   rodinha = andar · Ctrl + rodinha = zoom no mouse · \ = ver tudo · Ctrl+Z desfaz aqui dentro. "Tirar silêncios" deixa só as falas.
   Aplicar: cada peça vira um áudio na timeline NO MESMO LUGAR em que estava (o tempo da animação não muda). Avisos: ponta cortando palavra. */
'use strict';
const CorteVoz = {
  // quadro da timeline em que toca o segundo t do arquivo (pelo começo de agora do áudio)
  qDe(P, a, t) { return (a.de || 0) + Math.round((t - Som.ini(a)) * P.fps); },
  // ponto mais quieto perto de t (raio em s), pelos picos finos
  quieto(arq, t, raio = .12) { const f = Som.finos(arq); if (!f) return t; const a = Math.max(0, Math.floor((t - raio) * f.R)), z = Math.min(f.mx.length - 1, Math.ceil((t + raio) * f.R)); let mi = Infinity, bi = Math.round(t * f.R);
    for (let i = a; i <= z; i++) { const v = (f.mx[i - 1] ?? f.mx[i]) + f.mx[i] + (f.mx[i + 1] ?? f.mx[i]), d = Math.abs(i - t * f.R) / (raio * f.R) * f.top * .15; if (v + d < mi) { mi = v + d; bi = i; } } return bi / f.R; },
  // a ponta t corta uma palavra? (barulho alto bem na ponta)
  cortaPalavra(arq, t) { return Som.picoEntre(arq, t - .02, t + .02) > .22; },
  // trechos com fala dentro de [t0, t1] (silêncio de pelo menos 0,35 s separa; sobra 0,08 s em volta)
  falas(arq, t0, t1) {
    const f = Som.finos(arq); if (!f) return [[t0, t1]]; const lim = .06 * f.top, out = []; let s = null, ult = -1;
    for (let i = Math.floor(t0 * f.R); i <= Math.ceil(t1 * f.R) && i < f.mx.length; i++) { const t = i / f.R; if (f.mx[i] > lim) { if (s == null) s = t; ult = t; } else if (s != null && t - ult > .35) { out.push([s, ult]); s = null; } }
    if (s != null) out.push([s, ult]);
    return out.map(([a, b]) => [Math.max(t0, a - .08), Math.min(t1, b + .08)]).filter(([a, b]) => b - a > .06);
  },
  async abrir(a) {
    const P = App.P; if (a.loop) return UI.toast('Este áudio está para repetir (música em loop): corte as pontas direto na timeline.', { kind: 'warn' });
    const b = await Som.decod(a.arq); if (!b) return UI.toast('O áudio ainda está carregando.', { kind: 'warn' }); Som.finos(a.arq);
    const D = b.duration, ini0 = Som.ini(a), fim0 = ini0 + Som.compr(a, b), st = { pecas: [[ini0, fim0]], sel: 0, cur: ini0, v0: 0, v1: D, hist: [] };
    const fit = () => { const m = Math.max(.3, (st.pecas.at(-1)[1] - st.pecas[0][0]) * .08); st.v0 = Math.max(0, st.pecas[0][0] - m); st.v1 = Math.min(D, st.pecas.at(-1)[1] + m); if (st.v1 - st.v0 < .5) st.v1 = Math.min(D, st.v0 + .5); };
    fit();
    // palavras da transcrição (legendas com tempos) que caem neste áudio, em segundos do arquivo
    const pal = []; for (const g of P.legendas || []) for (const w of g.pal || []) { const t = ini0 + (w[1] - (a.de || 0)) / P.fps, t2 = ini0 + (w[2] + 1 - (a.de || 0)) / P.fps; if (t2 > 0 && t < D) pal.push([w[0], t, t2]); }
    const body = h(`<div class="cv">
      <div class="cv-barra"><button class="btn sm" data-toca title="Tocar/pausar do cursor (Espaço)">${ic('play', 13)} Tocar</button><button class="btn sm" data-peca title="Tocar a peça escolhida (Enter)">${ic('play', 13)} Peça</button>
        <span class="sep"></span><button class="btn sm" data-i title="Começo da peça no cursor (I)">I começo</button><button class="btn sm" data-o title="Fim da peça no cursor (O)">O fim</button><button class="btn sm" data-s title="Dividir no cursor (S)">${ic('split', 13)} Dividir</button><button class="btn sm" data-del title="Tirar a peça escolhida (Delete)">${ic('trash', 13)} Tirar</button>
        <span class="sep"></span><button class="btn sm" data-sil title="Deixa só as partes com fala (o tempo da animação não muda)">${ic('wand', 13)} Tirar silêncios</button><button class="btn sm" data-acerta title="Leva todas as pontas para o ponto mais quieto perto">${ic('magnet', 13)} Acertar as pontas</button>
        <span class="sp"></span><button class="ibtn" data-zm title="Afastar">${ic('zoomOut', 14)}</button><button class="ibtn" data-zp title="Aproximar">${ic('zoomIn', 14)}</button><button class="btn sm" data-fit title="Ver tudo (\\)">Ver tudo</button></div>
      <canvas class="cv-onda" width="1720" height="420"></canvas>
      <div class="cv-info"><span data-t></span><span class="sp"></span><span data-av></span></div>
      <small class="cv-dica">Arraste as pontas (grudam no silêncio · Shift solta) · clique = cursor · Espaço toca · I/O começo e fim · S divide · Delete tira · Ctrl + rodinha = zoom · Ctrl+Z desfaz</small></div>`);
    const cv = $('canvas', body), c = cv.getContext('2d'), W = cv.width, H = cv.height, RG = 40, PW = 56, txW = t => (t - st.v0) / (st.v1 - st.v0) * W, deX = x => st.v0 + x / W * (st.v1 - st.v0);
    const guarda = () => { st.hist.push(JSON.stringify(st.pecas)); if (st.hist.length > 60) st.hist.shift(); };
    const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
    let toca = null; // { src, t0, ctx0 }
    const curAgora = () => toca ? toca.t0 + (Som.ac().currentTime - toca.ctx0) : st.cur;
    const pinta = () => {
      const f = Som.finos(a.arq); c.clearRect(0, 0, W, H); c.fillStyle = '#141414'; c.fillRect(0, 0, W, H);
      // régua
      c.fillStyle = '#1d1d1d'; c.fillRect(0, 0, W, RG); const span = st.v1 - st.v0, passo = [.05, .1, .25, .5, 1, 2, 5, 10, 30, 60].find(p => span / p < 14) || 120;
      c.font = '20px ' + (getComputedStyle(document.body).getPropertyValue('--mono') || 'monospace'); c.fillStyle = '#8a8a8a'; c.strokeStyle = '#3a3a3a';
      for (let t = Math.ceil(st.v0 / passo) * passo; t <= st.v1; t += passo) { const x = txW(t); c.fillRect(x, RG - 12, 2, 12); c.fillText(t >= 60 ? fmt(t) : (+t.toFixed(2)) + 's', x + 5, 26); }
      const mid = RG + (H - RG - PW) / 2, mh = (H - RG - PW) / 2 - 8;
      // peças (o que fica)
      st.pecas.forEach(([p0, p1], i) => { const x0 = txW(p0), x1 = txW(p1); c.fillStyle = i === st.sel ? 'rgba(94,224,180,.14)' : 'rgba(94,224,180,.07)'; c.fillRect(x0, RG, x1 - x0, H - RG - PW); });
      // onda
      if (f) for (let x = 0; x < W; x += 2) { const t0 = deX(x), t1 = deX(x + 2), v = Math.sqrt(Som.picoEntre(a.arq, t0, t1)), dentro = st.pecas.some(([p0, p1]) => t0 < p1 && t1 > p0);
        c.fillStyle = dentro ? '#8fe0b4' : '#4a4a4a'; const hh = Math.max(1, v * mh); c.fillRect(x, mid - hh, 2, hh * 2); }
      // pontas das peças
      st.pecas.forEach(([p0, p1], i) => { for (const [t, lado] of [[p0, 1], [p1, -1]]) { const x = txW(t), ruim = this.cortaPalavra(a.arq, t); c.fillStyle = ruim ? '#ff6b6b' : i === st.sel ? '#5ee0ff' : '#cfe'; c.fillRect(x - 2, RG, 4, H - RG - PW);
        c.beginPath(); c.moveTo(x, RG); c.lineTo(x + lado * 16, RG); c.lineTo(x, RG + 16); c.fill(); } });
      // palavras embaixo
      c.fillStyle = '#1b1b1b'; c.fillRect(0, H - PW, W, PW); c.font = '22px Segoe UI'; c.textBaseline = 'middle';
      for (const [w, t0, t1] of pal) { if (t1 < st.v0 || t0 > st.v1) continue; const x0 = txW(t0), x1 = txW(t1); c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(x0, H - PW + 6, Math.max(2, x1 - x0 - 2), PW - 12); c.fillStyle = '#ddd'; c.save(); c.beginPath(); c.rect(x0, H - PW, x1 - x0, PW); c.clip(); c.fillText(w, x0 + 4, H - PW / 2); c.restore(); }
      c.textBaseline = 'alphabetic';
      // cursor
      const xc = txW(curAgora()); c.fillStyle = '#ff5a5a'; c.fillRect(xc - 1.5, 0, 3, H);
      // textos
      const tot = st.pecas.reduce((s2, [p0, p1]) => s2 + p1 - p0, 0);
      $('[data-t]', body).textContent = `Cursor ${fmt(curAgora())} · ${st.pecas.length} peça${st.pecas.length > 1 ? 's' : ''} · fica ${tot.toFixed(2)} s de ${D.toFixed(2)} s`;
      const ruins = st.pecas.flatMap(([p0, p1], i) => [this.cortaPalavra(a.arq, p0) ? `peça ${i + 1}: o começo corta uma palavra` : '', this.cortaPalavra(a.arq, p1) ? `peça ${i + 1}: o fim corta uma palavra` : ''].filter(Boolean));
      const av = $('[data-av]', body); av.textContent = ruins.length ? '⚠ ' + ruins.slice(0, 2).join(' · ') + (ruins.length > 2 ? ` (+${ruins.length - 2})` : '') : ''; av.classList.toggle('cv-ruim', !!ruins.length);
    };
    const anda = () => { if (!toca) return; pinta(); const t = curAgora(); if (t > st.v1) { const w = st.v1 - st.v0; st.v0 = Math.min(D - w, t - w * .1); st.v1 = st.v0 + w; } requestAnimationFrame(anda); };
    const para = () => { if (toca) { try { toca.src.stop(); } catch { } st.cur = curAgora(); toca = null; pinta(); } };
    const tocar = (t0, t1 = D) => { para(); const ac = Som.ac(); ac.resume(); const src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination); src.start(ac.currentTime + .02, t0, Math.max(.02, t1 - t0)); toca = { src, t0, ctx0: ac.currentTime + .02 }; src.onended = () => { if (toca?.src === src) { st.cur = Math.min(t1, curAgora()); toca = null; pinta(); } }; requestAnimationFrame(anda); };
    const pecaEm = t => st.pecas.findIndex(([p0, p1]) => t >= p0 && t <= p1);
    const acoes = {
      toca: () => toca ? para() : tocar(st.cur),
      peca: () => { const p = st.pecas[st.sel]; if (p) tocar(p[0], p[1]); },
      i: () => { const p = st.pecas[st.sel]; if (!p) return; const t = this.quieto(a.arq, st.cur, .06); if (t >= p[1] - .03) return; guarda(); p[0] = Math.max(st.pecas[st.sel - 1]?.[1] ?? 0, t); pinta(); },
      o: () => { const p = st.pecas[st.sel]; if (!p) return; const t = this.quieto(a.arq, st.cur, .06); if (t <= p[0] + .03) return; guarda(); p[1] = Math.min(st.pecas[st.sel + 1]?.[0] ?? D, t); pinta(); },
      s: () => { const i = pecaEm(st.cur); if (i < 0) return UI.toast('Ponha o cursor dentro de uma peça para dividir.', { kind: 'warn' }); const p = st.pecas[i], t = this.quieto(a.arq, st.cur, .08); if (t - p[0] < .05 || p[1] - t < .05) return; guarda(); st.pecas.splice(i, 1, [p[0], t], [t, p[1]]); st.sel = i + 1; pinta(); },
      del: () => { if (st.pecas.length < 2) return UI.toast('Tem que ficar pelo menos uma peça.', { kind: 'warn' }); guarda(); st.pecas.splice(st.sel, 1); st.sel = Math.max(0, Math.min(st.sel, st.pecas.length - 1)); pinta(); },
      sil: () => { const novas = st.pecas.flatMap(([p0, p1]) => this.falas(a.arq, p0, p1)); if (!novas.length) return UI.toast('Não achei fala neste áudio.', { kind: 'warn' }); guarda(); st.pecas = novas; st.sel = 0; pinta(); UI.toast(`${novas.length} pedaço${novas.length > 1 ? 's' : ''} com fala.`, { kind: 'ok' }); },
      acerta: () => { guarda(); st.pecas = st.pecas.map(([p0, p1], i, L) => [Math.max(L[i - 1]?.[1] ?? 0, this.quieto(a.arq, p0, .15)), Math.min(L[i + 1]?.[0] ?? D, this.quieto(a.arq, p1, .15))]).filter(([p0, p1]) => p1 - p0 > .03); pinta(); },
      zp: () => zoom(.6, st.cur), zm: () => zoom(1 / .6, st.cur), fit: () => { fit(); pinta(); },
    };
    const zoom = (k, t) => { const w = clamp((st.v1 - st.v0) * k, .15, D), f = (t - st.v0) / (st.v1 - st.v0); st.v0 = clamp(t - w * f, 0, Math.max(0, D - w)); st.v1 = Math.min(D, st.v0 + w); pinta(); };
    for (const [k, fn] of Object.entries(acoes)) { const bt = $(`[data-${k}]`, body); if (bt) bt.onclick = fn; }
    // mouse: pontas (grudam no silêncio), peça (escolhe), fundo (cursor)
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
    cv.onpointerdown = e => {
      const p = pos(e), t = deX(p.x), tol = 10 * W / cv.getBoundingClientRect().width;
      let ponta = null; st.pecas.forEach(([p0, p1], i) => { if (Math.abs(txW(p0) - p.x) < tol) ponta = { i, k: 0 }; else if (Math.abs(txW(p1) - p.x) < tol) ponta = { i, k: 1 }; });
      cv.setPointerCapture(e.pointerId);
      if (ponta) { guarda(); st.sel = ponta.i; const P0 = st.pecas[ponta.i];
        cv.onpointermove = ev => { let tt = clamp(deX(pos(ev).x), 0, D); if (!ev.shiftKey) tt = this.quieto(a.arq, tt, Math.max(.04, (st.v1 - st.v0) * .015));
          if (ponta.k === 0) P0[0] = clamp(tt, st.pecas[ponta.i - 1]?.[1] ?? 0, P0[1] - .03); else P0[1] = clamp(tt, P0[0] + .03, st.pecas[ponta.i + 1]?.[0] ?? D); pinta(); };
      } else { const i = pecaEm(t); if (i >= 0) st.sel = i; para(); st.cur = clamp(t, 0, D); pinta(); cv.onpointermove = ev => { st.cur = clamp(deX(pos(ev).x), 0, D); pinta(); }; }
      cv.onpointerup = () => { cv.onpointermove = null; };
    };
    cv.onwheel = e => { e.preventDefault(); const t = deX(pos(e).x); if (e.ctrlKey || e.altKey) zoom(e.deltaY < 0 ? .8 : 1.25, t); else { const w = st.v1 - st.v0, d = (e.deltaY || e.deltaX) / 600 * w; st.v0 = clamp(st.v0 + d, 0, Math.max(0, D - w)); st.v1 = st.v0 + w; pinta(); } };
    const tecla = e => {
      if (!body.isConnected) return removeEventListener('keydown', tecla, true); if (e.target.closest?.('input,textarea')) return;
      const k = e.key.toLowerCase(), mapa = { ' ': 'toca', enter: 'peca', i: 'i', o: 'o', s: 's', delete: 'del', backspace: 'del', '\\': 'fit', '+': 'zp', '=': 'zp', '-': 'zm' };
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.stopPropagation(); const v = st.hist.pop(); if (v) { st.pecas = JSON.parse(v); st.sel = Math.min(st.sel, st.pecas.length - 1); pinta(); } return; }
      if (k === 'arrowleft' || k === 'arrowright') { e.preventDefault(); e.stopPropagation(); st.cur = clamp(st.cur + (k === 'arrowleft' ? -1 : 1) * (e.shiftKey ? .5 : .05), 0, D); pinta(); return; }
      if (mapa[k] && !e.ctrlKey) { e.preventDefault(); e.stopPropagation(); acoes[mapa[k]](); }
    };
    addEventListener('keydown', tecla, true); pinta();
    const ok = await UI.modal({ title: `Corte do áudio · ${a.nome}`, icon: 'cut', width: 920, body, buttons: [{ label: 'Cancelar', value: false }, { label: 'Aplicar na timeline', kind: 'primary', value: true }] });
    para(); removeEventListener('keydown', tecla, true); if (!ok) return;
    this.aplicar(P, a, st.pecas, D);
  },
  // cada peça vira um áudio no mesmo lugar da timeline; a 1ª fica no áudio de agora (mantém id, volume, fades de entrada…)
  aplicar(P, a, pecas, D) {
    const ini0 = Som.ini(a), base = { ...a }, novos = [];
    pecas.sort((x, y) => x[0] - y[0]).forEach(([p0, p1], i) => {
      const o = i === 0 ? a : { ...JSON.parse(JSON.stringify(base)), id: uid('au'), nome: `${base.nome} (${i + 1})` };
      o.de = Math.max(0, this.qDe(P, { ...base, ini: ini0 }, p0)); if (p0 > 1e-3) o.ini = round(p0, 3); else delete o.ini;
      if (Math.abs(p1 - D) < .01) delete o.dur; else o.dur = round(p1 - p0, 3);
      if (pecas.length > 1) { if (i > 0) delete o.fi; if (i < pecas.length - 1) delete o.fo; delete o.arqOrig; if (i === 0 && base.arqOrig) o.arqOrig = base.arqOrig; }
      if (i > 0) novos.push(o);
    });
    const i = P.audios.indexOf(a); P.audios.splice(i + 1, 0, ...novos);
    App.commit(pecas.length > 1 ? `Corte do áudio (${pecas.length} peças)` : 'Corte do áudio');
    UI.toast(pecas.length > 1 ? `"${esc(a.nome)}" virou ${pecas.length} peças, cada uma no mesmo lugar da timeline.` : `Corte de "${esc(a.nome)}" aplicado.`, { kind: 'ok' });
  },
  // dividir o áudio no quadro q da timeline (botão direito na linha do áudio)
  dividirEm(a, q) {
    const P = App.P, b = Som.buf.get(a.arq); if (!b || a.loop) return; const ini = Som.ini(a), t = this.quieto(a.arq, ini + (q - (a.de || 0)) / P.fps, .06), fim = ini + Som.compr(a, b);
    if (t - ini < .05 || fim - t < .05) return UI.toast('Ponha o quadro no meio do áudio para dividir.', { kind: 'warn' });
    this.aplicar(P, a, [[ini, t], [t, fim]], b.duration);
  },
};
