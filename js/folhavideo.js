/* ===================== folhavideo.js — TIMELINE em modo VÍDEO + transições/fades + arrastar efeitos para a timeline =====================
   Dois modos (botões "Animação | Vídeo" na barra da timeline, localStorage `animador-tl-modo`):
   - Animação: a timeline de sempre (uma linha por camada, pastas abertas, chaves).
   - Vídeo: como um editor de vídeo — trilha de EFEITOS (camadas de efeito como clipes roxos), trilha de VÍDEO (as camadas do topo
     como clipes; pasta = um clipe só), Câmera, Legendas e SOM. Arrastar o meio de um clipe muda ele de lugar no tempo (com as chaves
     e o que está dentro); as pontas mudam começo/fim.
   TRANSIÇÕES E FADES: `n.entra`/`n.sai` (Modelo.ANIMS) desenhados como cunhas nas pontas do clipe; a ALÇA no canto de cima (quadradinho)
   arrasta a duração — puxar de uma camada sem entrada cria um "Aparecer" (fade). No som, as alças mudam `a.fi`/`a.fo` (segundos).
   ARRASTAR DA BIBLIOTECA (aba Efeitos): efeito, cor, entrada/saída ou fade de som soltos na timeline. Enquanto arrasta, o alvo fica
   aceso com um rótulo do que vai acontecer (`Folha.drop`): efeito num clipe = camada de efeito acima dele, no tempo do clipe; numa
   camada de efeito = entra nela; no vazio = no topo; entrada/saída = metade da esquerda/direita do clipe; fade = no áudio.
   ONDE O EFEITO VALE: no modo Vídeo cada clipe tem uma faixa roxa em cima onde uma camada de efeito pega nele; com uma camada de efeito
   escolhida, tudo o que ela pega fica tingido de roxo (nos dois modos). */
'use strict';
Object.assign(Folha, {
  CH_MODO: 'animador-tl-modo',
  modo: (() => { try { return localStorage.getItem('animador-tl-modo') === 'video' ? 'video' : 'anim'; } catch { return 'anim'; } })(),
  setModo(m) { this.modo = m === 'video' ? 'video' : 'anim'; try { localStorage.setItem(this.CH_MODO, this.modo); } catch { } this.pintaModo(); this.pinta(); Short.pinta(); },
  pintaModo() { $$('#tl-modo [data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === this.modo)); $('#editor .tl')?.classList.toggle('modo-video', this.modo === 'video'); },
  ligaVideo() {
    if (this._video) return; this._video = true;
    const bar = $('#editor .tl-barra'), ref = $('#tl-q');
    if (bar && ref && !$('#tl-modo')) { const sw = h(`<div class="tl-modo" id="tl-modo" title="Animação: uma linha por camada, com as chaves · Vídeo: trilhas de efeitos, vídeo e som, como num editor de vídeo"><button data-m="anim">${ic('diamond', 12)}<span>Animação</span></button><button data-m="video">${ic('film', 12)}<span>Vídeo</span></button></div>`);
      $$('[data-m]', sw).forEach(b => b.onclick = () => this.setModo(b.dataset.m)); ref.after(sw); }
    Short.liga();
    this.pintaModo();
    // soltar coisas da biblioteca de efeitos
    const g = this.grade;
    g.addEventListener('dragover', e => { const d = this.arrasto; if (!d) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; this.drop = this.alvoDrop(this.ponto(e), d); this.desenha(); this.rotuloDrop(e); });
    g.addEventListener('dragleave', e => { if (g.contains(e.relatedTarget)) return; this.drop = null; this.desenha(); this.rotuloDrop(); });
    g.addEventListener('drop', e => { const d = this.arrasto; if (!d) return; e.preventDefault(); const a = this.alvoDrop(this.ponto(e), d); this.drop = null; this.rotuloDrop(); this.aplicaDrop(a, d); });
    this.cv.addEventListener('pointermove', e => { if (e.buttons) return; const p = this.ponto(e), l = this._L?.[p.i], id = l?.tipo === 'no' ? l.no.id : l?.tipo === 'audio' ? l.a.id : null;
      if (id !== this._sobre) { this._sobre = id; this.desenha(); }
      let cur = ''; if (l && p.i >= 0) { const P = App.P, CW = this.CW, yr = p.y - (this.REG + l.y - this.grade.scrollTop);
        if (l.tipo === 'no' && l.no.tipo !== 'efeito') { const n = l.no, de = n.de || 0, fim = Modelo.fimNo(P, n), tam = fim - de + 1, xa = (de + (n.entra ? Math.min(n.entra.q, tam) : 0)) * CW, xb = (fim + 1 - (n.sai ? Math.min(n.sai.q, tam) : 0)) * CW;
          if (yr <= 11 && (Math.abs(p.x - xa) < 7 || Math.abs(p.x - xb) < 7)) cur = 'ew-resize'; else if (Math.abs(p.x - de * CW) < 6 || Math.abs(p.x - (fim + 1) * CW) < 6) cur = 'col-resize'; else if (l.video && p.q >= de && p.q <= fim) cur = 'grab'; }
        else if (l.tipo === 'audio' && yr <= 11) { const a = l.a, de = a.de || 0, fim = Som.fimQ?.(P, a) ?? de; if (Math.abs(p.x - (de + (+a.fi || 0) * P.fps) * CW) < 7 || Math.abs(p.x - (fim + 1 - (+a.fo || 0) * P.fps) * CW) < 7) cur = 'ew-resize'; } }
      this.cv.style.cursor = cur; });
    this.cv.addEventListener('pointerleave', () => { if (this._sobre) { this._sobre = null; this.desenha(); } });
    addEventListener('dragend', () => { this.arrasto = null; if (this.drop) { this.drop = null; this.desenha(); } this.rotuloDrop(); });
  },
  // ---------- linhas do modo Vídeo ----------
  linhasVideo() {
    Short.pinta(); // barra de etapas do Short (só em projeto vertical)
    const P = App.P, out = [], efs = []; Modelo.cada(P.raiz, n => { if (n.tipo === 'efeito') efs.push(n); });
    out.push({ tipo: 'sec', nome: 'Efeitos e transições', h: 20, ic: 'sparkles' });
    for (const n of efs) out.push({ tipo: 'no', no: n, nome: n.nome, video: true, h: 28 });
    (P.efeitos.tela || []).forEach(ef => out.push({ tipo: 'efeito', ef, nome: (Efeitos.TELA.find(t => t.id === ef.tipo)?.nome || ef.tipo) }));
    if (!efs.length && !(P.efeitos.tela || []).length) out.push({ tipo: 'vazio', nome: 'Arraste um efeito da aba Efeitos para cá', h: 26 });
    out.push({ tipo: 'sec', nome: 'Vídeo', h: 20, ic: 'film' });
    for (const n of P.raiz) if (n.tipo !== 'efeito') out.push({ tipo: 'no', no: n, nome: n.nome, video: true, h: 32 });
    out.push({ tipo: 'camera', nome: 'Câmera' });
    if ((P.legendas || []).length) out.push({ tipo: 'legenda', nome: 'Legendas' });
    out.push({ tipo: 'sec', nome: 'Som', h: 20, ic: 'vol' });
    (P.audios || []).forEach(a => out.push({ tipo: 'audio', a, nome: a.nome, h: 40 }));
    if (!(P.audios || []).length) out.push({ tipo: 'vazio', nome: 'Grave ou ponha um áudio na aba Voz', h: 26 });
    return out;
  },
  // ---------- o que uma camada de efeito pega (os de baixo dela na mesma lista, até a próxima camada de efeito, com o que tem dentro) ----------
  alcance(ef) {
    const P = App.P, r = Modelo.achar(P, ef.id); if (!r) return new Set(); const L = r.lista || P.raiz, i = L.indexOf(ef), out = new Set();
    for (let k = i + 1; k < L.length; k++) { const n = L[k]; if (n.tipo === 'efeito') break; out.add(n.id); Modelo.cada(n.filhos || [], f => { out.add(f.id); }); }
    return out;
  },
  // camadas de efeito que pegam numa camada do topo (a mais perto em cima dela)
  efeitoDe(n) { const L = App.P.raiz, i = L.indexOf(n); for (let k = i - 1; k >= 0; k--) if (L[k].tipo === 'efeito') return L[k]; return null; },
  // ---------- desenho ----------
  linhaSec(c, l, y, W) { c.fillStyle = '#262626'; c.fillRect(0, y, W, l.h); c.fillStyle = '#333'; c.fillRect(0, y + l.h - 1, W, 1); },
  linhaVazio(c, l, y, sx, W) { c.save(); c.setLineDash([4, 4]); c.strokeStyle = '#444'; c.strokeRect(8.5, y + 4.5, Math.min(W - 17, App.P.duracao * this.CW - sx - 9), l.h - 9); c.restore();
    c.fillStyle = '#6a6a6a'; c.font = '11px Segoe UI'; c.textBaseline = 'middle'; c.fillText(l.nome, 16, y + l.h / 2); },
  corClipe(P, n) { return n.tipo === 'pasta' ? (n.corPasta || '#8a8a8a') : n.tipo === 'personagem' ? (Icone.cor(P.personagens[n.ref]) || '#6f86a8') : n.tipo === 'texto' ? '#b49a6a' : n.tipo === 'imagem' ? '#5e9c8f' : n.fundoPadrao ? '#7d7d7d' : '#6aa39a'; },
  clipe(c, P, l, y, sx, sel) {
    const n = l.no, CW = this.CW, de = n.de || 0, fim = Modelo.fimNo(P, n), x = de * CW - sx, w = (fim - de + 1) * CW, top = y + 3, hh = l.h - 6, cor = this.corClipe(P, n);
    if (n.tipo === 'efeito') return this.clipeEfeito(c, P, n, x, w, top, hh, sel, sx);
    c.save(); c.globalAlpha = n.vis === false ? .35 : 1;
    c.beginPath(); c.roundRect(x + 1, top, w - 2, hh, 6); c.fillStyle = cor + (sel ? '66' : '40'); c.fill(); c.clip();
    if (n.tipo === 'pasta') { const pat = this.listras(c, cor); pat.setTransform?.(new DOMMatrix().translate(-sx, 0)); c.fillStyle = pat; c.fillRect(x, top, w, hh); }
    c.fillStyle = cor; c.fillRect(x + 1, top, w - 2, 3); // filete da cor do tipo
    // ONDE UMA CAMADA DE EFEITO PEGA: faixa roxa em cima (no tempo em que as duas existem)
    const ef = this.efeitoDe(n); if (ef && ef.vis !== false && ef.efeitos?.length) { const a = Math.max(de, ef.de || 0), b = Math.min(fim, Modelo.fimNo(P, ef)); if (b >= a) { c.fillStyle = '#a98bff'; c.fillRect(a * CW - sx, top, (b - a + 1) * CW, 3); } }
    // entrada / saída (cunhas)
    for (const k of ['entra', 'sai']) { const t = n[k]; if (!t) continue; const qq = Math.min(t.q, fim - de + 1), xx = k === 'entra' ? x + 1 : x + w - 1 - qq * CW, ww = qq * CW;
      const g = c.createLinearGradient(xx, 0, xx + ww, 0), cl = 'rgba(255,255,255,.28)'; g.addColorStop(k === 'entra' ? 0 : 1, cl); g.addColorStop(k === 'entra' ? 1 : 0, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); if (k === 'entra') { c.moveTo(xx, top + hh); c.lineTo(xx + ww, top); c.lineTo(xx + ww, top + hh); } else { c.moveTo(xx, top); c.lineTo(xx + ww, top + hh); c.lineTo(xx, top + hh); } c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.beginPath(); if (k === 'entra') { c.moveTo(xx, top + hh); c.lineTo(xx + ww, top); } else { c.moveTo(xx, top); c.lineTo(xx + ww, top + hh); } c.stroke();
      if (ww > 42) { c.fillStyle = 'rgba(255,255,255,.9)'; c.font = '600 9.5px Segoe UI'; c.textBaseline = 'alphabetic'; c.fillText(Modelo.ANIMS[t.tipo] || t.tipo, k === 'entra' ? xx + 4 : xx + ww - 4 - c.measureText(Modelo.ANIMS[t.tipo] || t.tipo).width, top + hh - 4); } }
    // nome
    c.fillStyle = '#fff'; c.font = '600 11px Segoe UI'; c.textBaseline = 'middle'; c.shadowColor = '#000'; c.shadowBlur = 3;
    const nfil = n.filhos ? Modelo.todos({ raiz: n.filhos }).length : 0; c.fillText(n.nome + (nfil ? `  ·  ${nfil} camada${nfil === 1 ? '' : 's'}` : ''), Math.max(x + 8 + (n.entra ? Math.min(n.entra.q, fim - de + 1) * CW : 0), 8), top + hh / 2 - 1); // o nome começa depois da cunha da entrada c.shadowBlur = 0;
    // chaves (pequenas, embaixo)
    c.fillStyle = 'rgba(255,255,255,.75)'; for (const k of Object.keys(n.chaves || {}).map(Number)) { if (k < de || k > fim) continue; const kx = k * CW - sx + CW / 2; c.beginPath(); c.moveTo(kx, top + hh - 7); c.lineTo(kx + 3, top + hh - 4); c.lineTo(kx, top + hh - 1); c.lineTo(kx - 3, top + hh - 4); c.fill(); }
    c.restore();
    // pontas e alças dos fades
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x + 1, top + 4, 2, hh - 8); c.fillRect(x + w - 3, top + 4, 2, hh - 8);
    if (sel || this._sobre === n.id) this.alcas(c, x + 1 + (n.entra ? Math.min(n.entra.q, fim - de + 1) * CW : 0), x + w - 1 - (n.sai ? Math.min(n.sai.q, fim - de + 1) * CW : 0), top);
    if (sel) { c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.beginPath(); c.roundRect(x + 1.5, top + .5, w - 3, hh - 1, 6); c.stroke(); }
  },
  alcas(c, xa, xb, top) { for (const x of [xa, xb]) { c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 1; c.beginPath(); c.rect(x - 4, top - 1, 8, 8); c.fill(); c.stroke(); } },
  clipeEfeito(c, P, n, x, w, top, hh, sel, sx) {
    const g = c.createLinearGradient(x, 0, x + Math.max(80, w), 0); g.addColorStop(0, sel ? '#8f6bff' : '#6a4fc4'); g.addColorStop(1, sel ? '#19c8e6' : '#1b8aa8');
    c.save(); c.globalAlpha = n.vis === false ? .3 : 1; c.fillStyle = g; c.beginPath(); c.roundRect(x + 1, top, w - 2, hh, 6); c.fill(); c.clip();
    // efeitos com tempo próprio dentro da camada: blocos claros
    for (const e of n.efeitos || []) if (e.de != null) { c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(e.de * this.CW - sx, top + hh - 6, ((e.ate ?? e.de) - e.de + 1) * this.CW, 4); }
    c.fillStyle = '#fff'; c.font = '600 11px Segoe UI'; c.textBaseline = 'middle'; c.fillText('✦ ' + ((n.efeitos || []).map(e => Efeitos.nomeEf(e)).join(' + ') || 'sem efeitos'), Math.max(x, 0) + 8, top + hh / 2); c.restore();
    c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(x + 1, top + 4, 2, hh - 8); c.fillRect(x + w - 3, top + 4, 2, hh - 8);
    if (sel) { c.strokeStyle = '#d9ccff'; c.lineWidth = 1.2; c.beginPath(); c.roundRect(x + 1.5, top + .5, w - 3, hh - 1, 6); c.stroke(); }
  },
  // alças de fade do áudio (desenhadas por cima da onda)
  alcasAudio(c, P, a, y, sx) { const CW = this.CW, de = a.de || 0, fim = Som.fimQ ? Som.fimQ(P, a) : de; const x0 = de * CW - sx, x1 = (fim + 1) * CW - sx;
    this.alcas(c, x0 + (+a.fi || 0) * P.fps * CW + 1, x1 - (+a.fo || 0) * P.fps * CW - 1, y + 2); },
  // por cima de tudo: o alcance da camada de efeito escolhida e o alvo de um arrasto
  sobreposicoes(c, P, L, sx, sy, W) {
    const REG = this.REG, CW = this.CW, s = App.noSel();
    if (s?.tipo === 'efeito') { const al = this.alcance(s), a0 = s.de || 0, a1 = Modelo.fimNo(P, s);
      for (const l of L) { if (l.tipo !== 'no' || !al.has(l.no.id)) continue; const y = REG + l.y - sy, de = Math.max(a0, l.no.de || 0), fim = Math.min(a1, Modelo.fimNo(P, l.no)); if (fim < de) continue;
        c.fillStyle = 'rgba(169,139,255,.16)'; c.fillRect(de * CW - sx, y + 1, (fim - de + 1) * CW, l.h - 2); c.fillStyle = 'rgba(169,139,255,.7)'; c.fillRect(de * CW - sx, y + 1, (fim - de + 1) * CW, 1.5); } }
    const d = this.drop; if (d?.i != null) { const l = L[d.i]; if (l) { const y = REG + l.y - sy; c.fillStyle = d.ok ? 'rgba(90,169,232,.22)' : 'rgba(255,107,107,.15)'; c.strokeStyle = d.ok ? '#5aa9e8' : '#ff8a8a'; c.lineWidth = 2;
      const x0 = d.de * CW - sx, w = (d.ate - d.de + 1) * CW; c.beginPath(); c.roundRect(x0 + 1, y + 2, Math.max(4, w - 2), l.h - 4, 5); c.fill(); c.stroke(); } }
  },
  rotuloDrop(e) {
    let el = $('#tl-drop-rot'); if (!this.drop || !e) { el?.remove(); return; }
    if (!el) { el = h('<div id="tl-drop-rot" class="tl-drop-rot"></div>'); document.body.appendChild(el); }
    el.classList.toggle('nao', !this.drop.ok); el.innerHTML = this.drop.rot; el.style.left = e.clientX + 14 + 'px'; el.style.top = e.clientY + 14 + 'px';
  },
  // ---------- arrastar da biblioteca ----------
  // d: { k: 'ef', e: {tipo,...}, nome } | { k: 'anim', tipo, nome } | { k: 'fade', nome }
  alvoDrop(p, d) {
    const P = App.P, L = this._L, l = p.i >= 0 ? L[p.i] : null, q = clamp(p.q, 0, P.duracao - 1), nm = `<b>${esc(d.nome)}</b>`;
    const curto = d.k === 'ef' && { flash: 1, tremor: 1, chicote: 1, zoomcorte: 1 }[d.e.tipo];
    const anim = d.k === 'anim' || d.k === 'fade', ehClipe = l?.tipo === 'no' && l.no.tipo !== 'efeito';
    if (anim && ehClipe) { const n = l.no, de = n.de || 0, fim = Modelo.fimNo(P, n), lado = q <= (de + fim) / 2 ? 'entra' : 'sai', tq = n[lado]?.q || Math.max(2, Math.round(P.fps * .25)), qq = Math.min(tq, fim - de + 1);
      return { ok: true, i: p.i, de: lado === 'entra' ? de : fim - qq + 1, ate: lado === 'entra' ? de + qq - 1 : fim, acao: 'anim', n, lado, rot: `${nm} na ${lado === 'entra' ? 'ENTRADA' : 'SAÍDA'} de <b>${esc(n.nome)}</b>` }; }
    if (anim && l?.tipo === 'audio') { const a = l.a, de = a.de || 0, fim = Som.fimQ(P, a), lado = q <= (de + fim) / 2 ? 'fi' : 'fo', qq = Math.round(.5 * P.fps);
      return { ok: true, i: p.i, de: lado === 'fi' ? de : Math.max(de, fim - qq + 1), ate: lado === 'fi' ? Math.min(fim, de + qq - 1) : fim, acao: 'fade', a, lado, rot: `Fade de ${lado === 'fi' ? 'ENTRADA' : 'SAÍDA'} do som <b>${esc(a.nome)}</b>` }; }
    if (anim) return { ok: false, i: p.i >= 0 ? p.i : null, de: q, ate: q, rot: d.k === 'fade' ? 'Solte em cima de um áudio ou de uma camada' : 'Solte no começo ou no fim de uma camada' };
    // efeito / cor
    if (l?.tipo === 'no' && l.no.tipo === 'efeito') { const n = l.no; return { ok: true, i: p.i, de: n.de || 0, ate: Modelo.fimNo(P, n), acao: 'ef-camada', n, q, rot: `${nm} na camada de efeito <b>${esc(n.nome)}</b>` }; }
    if (ehClipe) { const n = l.no, de = n.de || 0, fim = Modelo.fimNo(P, n), cq = curto ? this.faixaCurta(d.e.tipo, q) : null;
      return { ok: true, i: p.i, de: cq ? cq.de : de, ate: cq ? cq.ate : fim, acao: 'ef-clipe', n, q, rot: curto ? `${nm} no quadro ${q + 1} (em <b>${esc(n.nome)}</b> e no que está abaixo)` : `${nm} em <b>${esc(n.nome)}</b> e no que está abaixo dela · quadros ${de + 1}–${fim + 1}` }; }
    const cq = curto ? this.faixaCurta(d.e.tipo, q) : { de: 0, ate: P.duracao - 1 };
    return { ok: true, i: p.i >= 0 ? p.i : null, de: cq.de, ate: cq.ate, acao: 'ef-topo', q, rot: curto ? `${nm} no quadro ${q + 1}, em tudo` : `${nm} em tudo, a animação toda` };
  },
  faixaCurta(tipo, q) { const P = App.P, curto = { flash: Math.round(P.fps / 3), tremor: Math.round(P.fps * .7), chicote: Math.round(P.fps * .4), zoomcorte: Math.round(P.fps * .4) }[tipo], meio = Efeitos.TRANS.includes(tipo) ? Math.floor(curto / 2) : 0, de = Math.max(0, q - meio); return { de, ate: Math.min(P.duracao - 1, de + curto) }; },
  aplicaDrop(a, d) {
    if (!a?.ok) { if (a?.rot) UI.toast(a.rot.replace(/<[^>]+>/g, ''), { kind: 'warn' }); return; }
    const P = App.P;
    if (a.acao === 'anim') { const n = a.n, tipo = d.k === 'fade' ? 'aparecer' : d.tipo; if (a.lado === 'sai' && n.ate == null) n.ate = Modelo.fimNo(P, n);
      n[a.lado] = { tipo, q: n[a.lado]?.q || Math.max(2, Math.round(P.fps * .25)) }; App.sel = n.id; return App.commit(`${a.lado === 'entra' ? 'Entrada' : 'Saída'}: ${Modelo.ANIMS[tipo] || tipo}`); }
    if (a.acao === 'fade') { a.a[a.lado] = .5; App.sel = a.a.id; return App.commit(a.lado === 'fi' ? 'Fade de entrada do som' : 'Fade de saída do som'); }
    const e = { ...d.e };
    if (a.acao === 'ef-camada') { App.sel = a.n.id; return App.addEfeito(e, { alvo: a.n, q: a.q, toda: true }); }
    if (a.acao === 'ef-clipe') { const n = a.n; return App.addEfeito(e, { alvo: n, q: a.q, toda: true, faixa: { de: n.de || 0, ate: n.ate ?? null } }); }
    return App.addEfeito(e, { alvo: null, q: a.q, toda: true });
  },
  // ---------- mouse no modo Vídeo (clipes) e alças de fade (camadas e som) ----------
  // devolve true se cuidou do clique
  desceVideo(e, p, l, mov, perto) {
    const P = App.P, CW = this.CW, sy = this.grade.scrollTop, yr = p.y - (this.REG + l.y - sy);
    if (l.tipo === 'audio') { // alças de fade do som (quadradinhos no canto de cima)
      const a = l.a; if (!Som.buf?.get(a.arq) || yr > 11) return false; const de = a.de || 0, fim = Som.fimQ(P, a), xa = (de + (+a.fi || 0) * P.fps) * CW, xb = (fim + 1 - (+a.fo || 0) * P.fps) * CW;
      const lado = Math.abs(p.x - xa) < 7 ? 'fi' : Math.abs(p.x - xb) < 7 ? 'fo' : null; if (!lado) return false;
      mov(pp => { const fr = lado === 'fi' ? pp.x / CW - de : fim + 1 - pp.x / CW, s = round(clamp(fr / P.fps, 0, (fim - de + 1) / P.fps / 2), 2); if (s < .04) delete a[lado]; else a[lado] = s; this.desenha(); });
      this.fimArr = () => App.commit(lado === 'fi' ? 'Fade de entrada do som' : 'Fade de saída do som'); return true; }
    if (l.tipo !== 'no' || l.no.tipo === 'efeito' || l.no.trava) return false;
    const n = l.no, de = n.de || 0, fim = Modelo.fimNo(P, n), tam = fim - de + 1;
    // alças de entrada/saída (canto de cima)
    if (yr <= 11) { const xa = (de + (n.entra ? Math.min(n.entra.q, tam) : 0)) * CW + 1, xb = (fim + 1 - (n.sai ? Math.min(n.sai.q, tam) : 0)) * CW - 1, lado = Math.abs(p.x - xa) < 7 ? 'entra' : Math.abs(p.x - xb) < 7 ? 'sai' : null;
      if (lado) { const t0 = n[lado] ? { ...n[lado] } : null, ate0 = n.ate;
        mov(pp => { const qq = lado === 'entra' ? Math.round(pp.x / CW - de) : Math.round(fim + 1 - pp.x / CW), v = clamp(qq, 0, Math.min(120, tam));
          if (v < 1) delete n[lado]; else { if (lado === 'sai' && n.ate == null) n.ate = fim; n[lado] = { tipo: n[lado]?.tipo || t0?.tipo || 'aparecer', q: v }; } this.desenha(); App.pinta(); });
        this.fimArr = () => { if (!n.sai && ate0 == null && n.ate === fim && lado === 'sai') n.ate = null; App.commit(lado === 'entra' ? 'Entrada da camada' : 'Saída da camada'); }; return true; } }
    if (!l.video) return false;
    if (perto(de, 'ini') || perto(fim, 'fim')) return false; // pontas: o de sempre (começo/fim)
    // MEIO DO CLIPE: mover no tempo (a camada, as chaves e tudo o que está dentro)
    if (p.q < de || p.q > fim) return false;
    const todos = [n, ...Modelo.todos({ raiz: n.filhos || [] })], foto = todos.map(x => ({ x, de: x.de || 0, ate: x.ate, ch: clone(x.chaves || {}), en: x.entra, sa: x.sai })), q0 = p.q;
    const ateMax = Math.max(...foto.map(f => f.ate ?? f.de)); let dq = 0, mexeu = false;
    mov(pp => { const nd = clamp(pp.q - q0, -Math.min(...foto.map(f => f.de)), P.duracao - 1 - ateMax); if (nd === dq) return; dq = nd; mexeu = true;
      for (const f of foto) { f.x.de = f.de + dq; if (f.ate != null) f.x.ate = f.ate + dq; f.x.chaves = Object.fromEntries(Object.entries(f.ch).map(([k, v]) => [+k + dq, v])); }
      this.desenha(); App.pinta(); });
    this.fimArr = () => { if (mexeu && dq) App.commit('Mover no tempo'); else { App.pausa(); App.setQ(p.q, { som: true }); } }; return true;
  },
});
