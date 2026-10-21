/* ===================== folha.js — timeline quadro a quadro (estilo folha de exposição): camadas, câmera, efeitos, legendas e voz =====================
   Cada coluna é UM quadro. Barra = de quando até quando a camada aparece. ◆ = chave (posição/pose naquele quadro).
   Clique: vai para o quadro · arrastar a régua: passa os quadros · arrastar ◆: muda a chave de quadro (Alt = copia)
   · arrastar a ponta da barra: muda quando começa/termina · duplo clique: chave nova · botão direito: mais opções. */
'use strict';
const Folha = {
  CW: 16, RH: 24, REG: 22, loop: true, copia: null, cv: null,
  liga() {
    if (this.cv) return this.pinta();
    this.cv = $('#tl-cv'); this.grade = $('#tl-grade'); this.nomes = $('#tl-nomes'); this.espaco = $('#tl-espaco');
    this.grade.addEventListener('scroll', () => { this.nomes.scrollTop = this.grade.scrollTop; this.desenha(); });
    this.nomes.addEventListener('wheel', e => { this.grade.scrollTop += e.deltaY; e.preventDefault(); }, { passive: false });
    new ResizeObserver(() => this.pinta()).observe(this.grade);
    this.cv.addEventListener('pointerdown', e => this.desce(e)); this.cv.addEventListener('dblclick', e => this.duplo(e));
    this.cv.addEventListener('contextmenu', e => { e.preventDefault(); this.menu(e); });
    this.cv.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); this.zoom(this.CW * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); } }, { passive: false });
    $('#tl-zoom').oninput = e => this.zoom(+e.target.value);
    this.pinta();
  },
  zoom(cw) { const q = App.q, x = q * this.CW - this.grade.scrollLeft; this.CW = clamp(Math.round(cw), 6, 48); $('#tl-zoom').value = this.CW; this.pinta(); this.grade.scrollLeft = Math.max(0, q * this.CW - x); },
  // linhas da folha: camadas (como na hierarquia), câmera, efeitos, legendas e áudios
  linhas() {
    const P = App.P, out = [];
    for (const l of Modelo.linhas(P)) { out.push({ tipo: 'no', no: l.no, nivel: l.nivel, nome: l.no.nome });
      if (l.no.tipo === 'efeito') for (const e of l.no.efeitos || []) if (e.de != null) out.push({ tipo: 'efeito', ef: e, pai: l.no, nivel: l.nivel + 1, nome: Efeitos.nomeEf(e) }); } // efeito com tempo próprio dentro da camada
    out.push({ tipo: 'camera', nome: 'Câmera' });
    (P.efeitos.tela || []).forEach(ef => out.push({ tipo: 'efeito', ef, nome: (Efeitos.TELA.find(t => t.id === ef.tipo)?.nome || ef.tipo) }));
    if ((P.legendas || []).length) out.push({ tipo: 'legenda', nome: 'Legendas' });
    (P.audios || []).forEach(a => out.push({ tipo: 'audio', a, nome: a.nome }));
    return out;
  },
  pinta() {
    if (!this.cv || !App.P) return; const P = App.P, L = this._L = this.linhas();
    // nomes à esquerda
    this.nomes.innerHTML = '<div class="regua"></div>' + L.map((l, i) => {
      const sel = (l.tipo === 'no' && App.sel === l.no.id) || (l.tipo === 'camera' && App.sel === 'camera') || (l.tipo === 'efeito' && App.sel === l.ef.id) || (l.tipo === 'audio' && App.sel === l.a.id);
      const icn = l.tipo === 'no' ? TIPO_IC[l.no.tipo] : { camera: 'camera', efeito: 'sparkles', legenda: 'text', audio: 'mic' }[l.tipo];
      const ab = l.tipo === 'no' && l.no.filhos ? `<button class="ab" data-ab title="Abrir/fechar a pasta">${ic(l.no.aberto === false ? 'right' : 'down', 11)}</button>` : '';
      return `<div class="reg ${sel ? 'sel' : ''} ${l.no?.tipo === 'efeito' || l.pai ? 'efeito' : ''} ${l.no?.filhos && l.no.corPasta ? 'com-cor' : ''}" data-i="${i}" ${l.tipo === 'no' ? 'draggable="true"' : ''} style="padding-left:${6 + (l.nivel || 0) * 12}px;${l.no?.filhos && l.no.corPasta ? `--pc:${l.no.corPasta}` : ''}">${ab}${ic(icn, 13)}<span class="nm">${esc(l.nome)}</span></div>`;
    }).join('');
    // cabeçalho: pasta nova (com a camada escolhida dentro, se tiver uma)
    const cab = $('.regua', this.nomes); cab.innerHTML = `<span>Camadas</span><span class="sp"></span><button class="ibtn" data-pasta title="Pasta nova (com a camada escolhida dentro) · Ctrl+G">${ic('folder', 13)}</button>`;
    $('[data-pasta]', cab).onclick = () => App.addPasta();
    $$('.reg', this.nomes).forEach(r => {
      const l = L[+r.dataset.i]; r.onclick = e => { if (e.target.closest('[data-ab]')) return; this.selLinha(l); };
      if (l.tipo !== 'no') return; const n = l.no;
      if ($('[data-ab]', r)) $('[data-ab]', r).onclick = () => { n.aberto = n.aberto === false; App.atualiza({ semLado: true }); };
      r.oncontextmenu = e => { e.preventDefault(); App.selecionar(n.id); Arvore.menu(e, n); };
      r.ondblclick = e => { if (!e.target.closest('button')) Arvore.renomear(n, r); };
      // arrastar como na hierarquia: em cima/embaixo muda a ordem; no meio de uma pasta entra nela
      r.ondragstart = e => { Arvore.arrastando = n.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', n.id); };
      r.ondragend = () => { Arvore.arrastando = null; $$('.reg', this.nomes).forEach(x => x.classList.remove('drop-antes', 'drop-depois', 'drop-dentro')); };
      r.ondragover = e => { if (!Arvore.arrastando || Arvore.arrastando === n.id) return; e.preventDefault(); const z = Arvore.zona(e, r, n); $$('.reg', this.nomes).forEach(x => x.classList.remove('drop-antes', 'drop-depois', 'drop-dentro')); r.classList.add('drop-' + z); };
      r.ondrop = e => { e.preventDefault(); const z = Arvore.zona(e, r, n); Arvore.mover(Arvore.arrastando, n.id, z); };
    });
    const tq = P.duracao, W = tq * this.CW + 200, H = this.REG + L.length * this.RH + 30;
    this.espaco.style.width = W + 'px'; this.espaco.style.height = H + 'px';
    const r = this.grade.getBoundingClientRect(), d = devicePixelRatio || 1;
    this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px'; this.cv.width = Math.max(2, r.width * d); this.cv.height = Math.max(2, r.height * d);
    this.barra(); this.desenha();
    // a cabeça de leitura sempre visível
    const x = App.q * this.CW; if (x < this.grade.scrollLeft || x > this.grade.scrollLeft + r.width - 40) this.grade.scrollLeft = Math.max(0, x - r.width / 3);
  },
  selLinha(l) { if (!l) return; if (l.tipo === 'no') App.selecionar(l.no.id); else if (l.tipo === 'camera') App.selecionar('camera'); else if (l.tipo === 'efeito') { App.selecionar(l.pai ? l.pai.id : l.ef.id); Lado.aba('efeitos'); } else if (l.tipo === 'audio') { App.selecionar(l.a.id); Lado.aba('som'); } else if (l.tipo === 'legenda') Lado.aba('som'); },
  barra() {
    const P = App.P, s = (App.q / P.fps).toFixed(2).replace('.', ',');
    $('#tl-q').innerHTML = `<b>${App.q + 1}</b> / ${P.duracao} · ${s}s`;
    $('#tl-fps').value = P.fps; $('#tl-dur').value = P.duracao;
  },
  desenha() {
    const P = App.P, L = this._L; if (!P || !L) return;
    const c = this.cv.getContext('2d'), d = devicePixelRatio || 1, W = this.cv.width / d, H = this.cv.height / d, sx = this.grade.scrollLeft, sy = this.grade.scrollTop, CW = this.CW, RH = this.RH, REG = this.REG;
    c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = '#1f1f1f'; c.fillRect(0, 0, W, H);
    const q0 = Math.max(0, Math.floor(sx / CW)), q1 = Math.min(P.duracao - 1, Math.ceil((sx + W) / CW));
    // fundo: faixas de 1 segundo e linhas dos quadros
    for (let q = q0; q <= q1; q++) { const x = q * CW - sx; if (Math.floor(q / P.fps) % 2) { c.fillStyle = '#232323'; c.fillRect(x, REG, CW, H); } }
    c.strokeStyle = '#2b2b2b'; c.lineWidth = 1; c.beginPath(); for (let q = q0; q <= q1 + 1; q++) { const x = Math.round(q * CW - sx) + .5; c.moveTo(x, REG); c.lineTo(x, H); } c.stroke();
    // linhas
    L.forEach((l, i) => {
      const y = REG + i * RH - sy; if (y > H || y + RH < REG) return;
      const sel = (l.tipo === 'no' && App.sel === l.no.id) || (l.tipo === 'camera' && App.sel === 'camera') || (l.tipo === 'efeito' && App.sel === l.ef.id) || (l.tipo === 'audio' && App.sel === l.a.id);
      if (sel) { c.fillStyle = 'rgba(140,170,210,.12)'; c.fillRect(0, y, W, RH); }
      c.fillStyle = '#2a2a2a'; c.fillRect(0, y + RH - 1, W, 1);
      if (l.tipo === 'no') this.linhaNo(c, P, l.no, y, sx, sel);
      else if (l.tipo === 'camera') this.chaves(c, P.camera.chaves, y, sx, '#9fc3ff');
      else if (l.tipo === 'efeito') this.bloco(c, l.ef.de, l.ef.ate ?? (l.pai ? Modelo.fimNo(P, l.pai) : l.ef.de), y, sx, sel ? '#9a7ad8' : '#6d5a94', l.nome);
      else if (l.tipo === 'legenda') (P.legendas || []).forEach(g => this.bloco(c, g.de, g.ate, y, sx, '#4f6a58', g.texto));
      else if (l.tipo === 'audio') this.onda(c, P, l.a, y, sx, sel);
    });
    // régua
    c.fillStyle = '#2b2b2b'; c.fillRect(0, 0, W, REG); c.fillStyle = '#3a3a3a'; c.fillRect(0, REG - 1, W, 1);
    c.font = '10.5px ' + getComputedStyle(document.body).getPropertyValue('--mono'); c.textBaseline = 'middle';
    const passo = CW >= 14 ? 5 : CW >= 9 ? 10 : 20;
    for (let q = q0; q <= q1; q++) { const x = q * CW - sx; if ((q + 1) % passo === 0 || q === 0) { c.fillStyle = '#8f8f8f'; c.fillText(String(q + 1), x + 2, REG / 2); c.fillStyle = '#4a4a4a'; c.fillRect(Math.round(x) + .5, REG - 6, 1, 6); } if (q % P.fps === 0 && q) { c.fillStyle = '#6a6a6a'; c.fillRect(Math.round(x), 0, 1, REG); } }
    // cabeça de leitura
    const px = App.q * CW - sx; c.fillStyle = 'rgba(255,107,107,.16)'; c.fillRect(px, REG, CW, H); c.fillStyle = '#ff6b6b'; c.fillRect(px + CW / 2 - .5, REG, 1.5, H);
    c.fillStyle = '#ff6b6b'; c.beginPath(); c.roundRect(px - 2, 2, CW + 4, REG - 5, 4); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(String(App.q + 1), px + CW / 2, REG / 2 - 1); c.textAlign = 'start';
  },
  linhaNo(c, P, n, y, sx, sel) {
    if (n.tipo === 'efeito') return this.linhaEfeito(c, P, n, y, sx, sel);
    const de = n.de || 0, ate = Modelo.fimNo(P, n), CW = this.CW, cor = n.tipo === 'pasta' ? (n.corPasta ? n.corPasta + '99' : '#4b4b4b') : n.tipo === 'personagem' ? '#56657a' : n.tipo === 'texto' ? '#6b6150' : '#4f6562';
    c.fillStyle = n.vis === false ? '#333' : cor; c.globalAlpha = sel ? 1 : .85; c.beginPath(); c.roundRect(de * CW - sx + 1, y + 4, (ate - de + 1) * CW - 2, this.RH - 9, 4); c.fill(); c.globalAlpha = 1;
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(de * CW - sx + 1, y + 4, 3, this.RH - 9); c.fillRect((ate + 1) * CW - sx - 4, y + 4, 3, this.RH - 9);
    this.chaves(c, n.chaves, y, sx, '#f0f0f0', k => n.chaves[k].sessoes || n.chaves[k].partes);
  },
  // camada de efeito em destaque: barra em gradiente com o nome dos efeitos
  linhaEfeito(c, P, n, y, sx, sel) {
    const de = n.de || 0, ate = Modelo.fimNo(P, n), CW = this.CW, x = de * CW - sx + 1, w = (ate - de + 1) * CW - 2, g = c.createLinearGradient(x, 0, x + Math.max(60, w), 0);
    g.addColorStop(0, sel ? '#8f6bff' : '#6a4fc4'); g.addColorStop(1, sel ? '#19c8e6' : '#1b8aa8');
    c.globalAlpha = n.vis === false ? .3 : 1; c.fillStyle = g; c.beginPath(); c.roundRect(x, y + 3, w, this.RH - 7, 5); c.fill();
    if (sel) { c.strokeStyle = '#bff6ff'; c.lineWidth = 1; c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(x, y + 3, 3, this.RH - 7); c.fillRect(x + w - 3, y + 3, 3, this.RH - 7);
    if (w > 40) { c.save(); c.beginPath(); c.rect(x, y, w, this.RH); c.clip(); c.fillStyle = '#fff'; c.font = '600 11px Segoe UI'; c.fillText('✦ ' + (n.efeitos || []).map(e => Efeitos.nomeEf(e)).join(' + '), x + 7, y + this.RH / 2); c.restore(); }
    c.globalAlpha = 1;
  },
  chaves(c, ch, y, sx, cor, ehPose) {
    const CW = this.CW, yy = y + this.RH / 2 - .5;
    for (const k of Object.keys(ch || {}).map(Number)) {
      const x = k * CW - sx + CW / 2, r = Math.min(5.5, CW / 2 - 1); c.beginPath(); c.moveTo(x, yy - r); c.lineTo(x + r, yy); c.lineTo(x, yy + r); c.lineTo(x - r, yy); c.closePath();
      const pose = ehPose?.(k); c.fillStyle = pose ? '#ffd36b' : cor; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 1; c.stroke();
    }
  },
  bloco(c, de, ate, y, sx, cor, txt) {
    const CW = this.CW, x = de * CW - sx + 1, w = (ate - de + 1) * CW - 2; c.fillStyle = cor; c.beginPath(); c.roundRect(x, y + 4, w, this.RH - 9, 4); c.fill();
    if (txt && w > 30) { c.save(); c.beginPath(); c.rect(x, y, w, this.RH); c.clip(); c.fillStyle = '#eaeaea'; c.font = '11px Segoe UI'; c.fillText(txt, x + 5, y + this.RH / 2); c.restore(); }
  },
  onda(c, P, a, y, sx, sel) {
    const pk = Som.picos(a.arq, P.fps), CW = this.CW, de = a.de || 0; c.fillStyle = sel ? '#6c8a7a' : '#4c6658';
    const n = pk ? pk.length : Math.round((Som.dur(a.arq) || 1) * P.fps); c.fillRect(de * CW - sx, y + 3, n * CW, this.RH - 7);
    if (!pk) return; c.fillStyle = '#d4f2e0'; const m = this.RH / 2 - 4;
    for (let i = 0; i < pk.length; i++) { const x = (de + i) * CW - sx; if (x < -CW || x > this.cv.width) continue; const v = Math.max(1, pk[i] * m * (a.vol ?? 1)); c.fillRect(x + 1, y + this.RH / 2 - v, Math.max(1, CW - 2), v * 2); }
  },
  /* ---------- mouse ---------- */
  ponto(e) { const r = this.cv.getBoundingClientRect(), x = e.clientX - r.left + this.grade.scrollLeft, y = e.clientY - r.top; return { q: Math.floor(x / this.CW), x, y, i: y < this.REG ? -1 : Math.floor((y - this.REG + this.grade.scrollTop) / this.RH) }; },
  desce(e) {
    const p = this.ponto(e), P = App.P, L = this._L; this.cv.setPointerCapture(e.pointerId);
    const mov = f => { const m = ev => f(this.ponto(ev), ev); const up = ev => { this.cv.removeEventListener('pointermove', m); this.cv.removeEventListener('pointerup', up); this.fimArr?.(ev); this.fimArr = null; }; this.cv.addEventListener('pointermove', m); this.cv.addEventListener('pointerup', up); };
    if (p.i < 0) { App.pausa(); App.setQ(p.q, { som: true }); return mov(pp => App.setQ(pp.q, { som: true })); }
    const l = L[p.i]; if (!l) return; this.selLinha(l);
    const perto = (q, borda) => Math.abs(p.x - (borda === 'fim' ? (q + 1) * this.CW : q * this.CW)) < 6;
    if (l.tipo === 'no' || l.tipo === 'camera') {
      const ch = l.tipo === 'no' ? l.no.chaves : P.camera.chaves, k = Object.keys(ch).map(Number).find(k => k === p.q);
      if (k != null && !(l.no?.trava) && l.no?.tipo !== 'efeito') { // arrastar a chave
        let atual = k; const dados = clone(ch[k]), copia = e.altKey; App.setQ(k);
        mov(pp => { const nq = clamp(pp.q, 0, P.duracao - 1); if (nq === atual || (ch[nq] && nq !== k)) return; if (!copia || atual !== k) delete ch[atual]; ch[nq] = clone(dados); atual = nq; App.setQ(nq); App.pinta(); });
        this.fimArr = () => { if (atual !== k || copia) App.commit(copia ? 'Copiar chave' : 'Mover chave'); }; return;
      }
      if (l.tipo === 'no' && !l.no.trava && (perto(l.no.de || 0, 'ini') || perto(Modelo.fimNo(P, l.no), 'fim'))) { // pontas da barra
        const n = l.no, ponta = perto(n.de || 0, 'ini') ? 'de' : 'ate';
        mov(pp => { const nq = clamp(pp.q, 0, P.duracao - 1); if (ponta === 'de') n.de = Math.min(nq, Modelo.fimNo(P, n)); else n.ate = nq >= P.duracao - 1 ? null : Math.max(nq, n.de || 0); this.pinta(); App.pinta(); Arvore.pinta(); });
        this.fimArr = () => App.commit(ponta === 'de' ? 'Começo da camada' : 'Fim da camada'); return;
      }
      if (l.tipo === 'no' && l.no.tipo === 'efeito' && !l.no.trava && p.q >= (l.no.de || 0) && p.q <= Modelo.fimNo(P, l.no)) { // arrastar a camada de efeito inteira no tempo
        const n = l.no, de0 = n.de || 0, ate0 = n.ate, q0 = p.q, ch0 = clone(n.chaves);
        mov(pp => { const dq = clamp(pp.q - q0, -de0, P.duracao - 1 - (ate0 ?? de0)); n.de = de0 + dq; if (ate0 != null) n.ate = ate0 + dq; n.chaves = Object.fromEntries(Object.entries(ch0).map(([k, v]) => [+k + dq, v])); this.desenha(); App.pinta(); });
        this.fimArr = () => { if ((n.de || 0) !== de0) App.commit('Mexer no tempo'); }; return;
      }
    }
    if (l.tipo === 'efeito' || l.tipo === 'audio') { // mover o bloco (ou só a ponta, nos efeitos)
      const o = l.tipo === 'efeito' ? l.ef : l.a, q0 = p.q;
      const ponta = l.tipo === 'efeito' ? (perto(o.de, 'ini') ? 'de' : perto(o.ate, 'fim') ? 'ate' : null) : null, de0 = o.de, ate0 = o.ate;
      if (l.tipo === 'audio' || ponta || (p.q >= o.de && p.q <= o.ate)) {
        mov(pp => { const dq = pp.q - q0; if (ponta === 'de') o.de = clamp(de0 + dq, 0, o.ate); else if (ponta === 'ate') o.ate = clamp(ate0 + dq, o.de, P.duracao - 1); else { o.de = Math.max(0, de0 + dq); if (ate0 != null) o.ate = o.de + (ate0 - de0); } this.desenha(); App.pinta(); });
        this.fimArr = () => App.commit('Mexer no tempo'); return;
      }
    }
    App.pausa(); App.setQ(p.q, { som: true }); mov(pp => App.setQ(pp.q, { som: true }));
  },
  duplo(e) {
    const p = this.ponto(e), l = this._L[p.i]; if (!l) return; App.setQ(p.q);
    if (l.tipo === 'no') { App.selecionar(l.no.id); App.chaveAqui(); }
    if (l.tipo === 'camera') { App.P.camera.chaves[p.q] = { ...Modelo.camera(App.P, p.q) }; App.commit('Chave da câmera'); }
  },
  menu(e) {
    const p = this.ponto(e), l = this._L[p.i]; if (!l || (l.tipo !== 'no' && l.tipo !== 'camera')) return; App.setQ(p.q);
    const ch = l.tipo === 'no' ? l.no.chaves : App.P.camera.chaves, tem = !!ch[p.q];
    if (l.tipo === 'no') App.selecionar(l.no.id); else App.selecionar('camera');
    UI.ctx(e.clientX, e.clientY, [
      { head: `Quadro ${p.q + 1} · ${l.nome}` },
      { label: tem ? 'Atualizar a chave' : 'Chave aqui', icon: 'diamond', key: 'K', action: () => l.tipo === 'no' ? App.chaveAqui() : (ch[p.q] = { ...Modelo.camera(App.P, p.q) }, App.commit('Chave da câmera')) },
      tem && { label: 'Copiar chave', icon: 'copy', action: () => { this.copia = clone(ch[p.q]); UI.toast('Chave copiada'); } },
      this.copia && { label: 'Colar chave', icon: 'paste', action: () => { ch[p.q] = clone(this.copia); App.commit('Colar chave'); } },
      tem && { label: 'Tirar a chave', icon: 'trash', danger: true, key: 'Shift+K', action: () => App.tiraChave() },
      l.tipo === 'no' && '-',
      l.tipo === 'no' && { label: 'Começar aqui', icon: 'start', action: () => { l.no.de = p.q; App.commit('Começo'); } },
      l.tipo === 'no' && { label: 'Terminar aqui', icon: 'end', action: () => { l.no.ate = Math.max(l.no.de || 0, p.q); App.commit('Fim'); } },
      l.tipo === 'no' && { label: l.no.interp ? 'Movimento: segurar até a próxima chave' : 'Movimento: intercalar entre as chaves', icon: 'transition', action: () => { l.no.interp = !l.no.interp; App.commit('Movimento'); } },
    ].filter(Boolean));
  },
};
