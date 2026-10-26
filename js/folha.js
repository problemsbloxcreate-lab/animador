/* ===================== folha.js — timeline quadro a quadro (estilo folha de exposição): camadas, câmera, efeitos, legendas e voz =====================
   Cada coluna é UM quadro. Barra = de quando até quando a camada aparece. ◆ = chave (posição/pose naquele quadro).
   Clique: vai para o quadro · arrastar a régua: passa os quadros · arrastar ◆: muda a chave de quadro (Alt = copia)
   · arrastar a ponta da barra: muda quando começa/termina · duplo clique: chave nova · botão direito: mais opções
   · Shift + arrastar na régua: marca um TRECHO (Folha.trecho) para pedir à IA mudar só ali (botão direito na régua). */
'use strict';
const Folha = {
  CW: 16, RH: 24, REG: 22, loop: true, copia: null, cv: null, trecho: null,
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
    this.ligaBordaNomes();
    this.pinta();
  },
  // largura da coluna dos NOMES: arrastar a borda entre os nomes e os quadros (dois cliques = padrão)
  CH_NOMES: 'animador-tl-nomes',
  ligaBordaNomes() {
    const corpo = this.nomes.parentElement, b = h('<div class="tl-nomes-borda" title="Arraste para aumentar/diminuir os nomes das camadas · dois cliques: tamanho padrão"></div>'); corpo.appendChild(b);
    const poe = w => { if (w) corpo.style.setProperty('--tln', w + 'px'); else corpo.style.removeProperty('--tln'); }; let w0 = 0; try { w0 = +localStorage.getItem(this.CH_NOMES) || 0; } catch { } poe(w0);
    b.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); document.body.classList.add('arrastando-div');
      const x0 = e.clientX, ini = this.nomes.offsetWidth; let w = ini;
      const mov = ev => { w = clamp(Math.round(ini + ev.clientX - x0), 110, Math.max(140, corpo.offsetWidth - 120)); poe(w); };
      const up = () => { b.removeEventListener('pointermove', mov); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up); b.classList.remove('on'); document.body.classList.remove('arrastando-div'); try { localStorage.setItem(this.CH_NOMES, String(w)); } catch { } PaineisEd.pintaBotao?.(); };
      b.addEventListener('pointermove', mov); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); });
    b.addEventListener('dblclick', () => { try { localStorage.removeItem(this.CH_NOMES); } catch { } poe(0); PaineisEd.pintaBotao?.(); });
    this._poeNomes = poe;
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
    (P.audios || []).forEach(a => out.push({ tipo: 'audio', a, nome: a.nome, h: 40 })); // áudio: linha mais alta (a onda aparece de verdade)
    let y = 0; for (const l of out) { l.h ||= this.RH; l.y = y; y += l.h; } this._altura = y;
    return out;
  },
  pinta() {
    if (!this.cv || !App.P) return; const P = App.P, L = this._L = this.linhas();
    // nomes à esquerda
    this.nomes.innerHTML = '<div class="regua"></div>' + L.map((l, i) => {
      const sel = (l.tipo === 'no' && App.sel === l.no.id) || (l.tipo === 'camera' && App.sel === 'camera') || (l.tipo === 'efeito' && App.sel === l.ef.id) || (l.tipo === 'audio' && App.sel === l.a.id);
      const icn = l.tipo === 'no' ? TIPO_IC[l.no.tipo] : { camera: 'camera', efeito: 'sparkles', legenda: 'text', audio: 'mic' }[l.tipo];
      const defP = l.tipo === 'no' && l.no.tipo === 'personagem' ? P.personagens[l.no.ref] : null, corP = defP && Icone.cor(defP);
      const ab = l.tipo === 'no' && l.no.filhos ? `<button class="ab" data-ab title="Abrir/fechar a pasta">${ic(l.no.aberto === false ? 'right' : 'down', 11)}</button>` : '';
      return `<div class="reg ${sel ? 'sel' : ''} ${l.no?.tipo === 'efeito' || l.pai ? 'efeito' : ''} ${l.no?.filhos && l.no.corPasta ? 'com-cor' : ''} ${corP ? 'pers-cor' : ''}" data-i="${i}" ${l.tipo === 'no' ? 'draggable="true"' : ''} style="padding-left:${6 + (l.nivel || 0) * 12}px;${l.h !== this.RH ? `height:${l.h}px;` : ''}${l.no?.filhos && l.no.corPasta ? `--pc:${l.no.corPasta};` : ''}${corP ? `--cp:${corP};` : ''}">${ab}${defP ? Icone.html(defP, 15) : ic(icn, 13)}<span class="nm">${esc(l.nome)}</span>${l.tipo === 'audio' ? `<button class="ms ${l.a.mudo ? 'on' : ''}" data-mudo title="Mudo">M</button><button class="ms solo ${l.a.solo ? 'on' : ''}" data-solo title="Solo: só ele toca">S</button>` : ''}</div>`;
    }).join('') + '<div class="tl-fim" aria-hidden="true"></div>'; // espaço no fim do mesmo tamanho da sobra da grade (30 px + barra de rolagem): sem ele, rolando até o fim os nomes paravam antes e ficavam linhas fora do lugar
    // cabeçalho: pasta nova (com a camada escolhida dentro, se tiver uma)
    const cab = $('.regua', this.nomes); cab.innerHTML = `<span>Camadas</span><span class="sp"></span><button class="ibtn" data-pasta title="Pasta nova (com a camada escolhida dentro) · Ctrl+G">${ic('folder', 13)}</button>`;
    $('[data-pasta]', cab).onclick = () => App.addPasta();
    $$('.reg', this.nomes).forEach(r => {
      const l = L[+r.dataset.i]; r.onclick = e => { if (e.target.closest('[data-ab],[data-mudo],[data-solo]')) return; this.selLinha(l); };
      if (l.tipo === 'audio') { $('[data-mudo]', r).onclick = () => { l.a.mudo = !l.a.mudo; if (App.tocando) Som.toca(App.q); App.commit(l.a.mudo ? 'Mudo' : 'Som de volta'); };
        $('[data-solo]', r).onclick = () => { l.a.solo = !l.a.solo; if (App.tocando) Som.toca(App.q); App.commit('Solo'); }; }
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
    const tq = P.duracao, W = tq * this.CW + 200, H = this.REG + this._altura + 30;
    this.espaco.style.width = W + 'px'; this.espaco.style.height = H + 'px';
    const r = this.grade.getBoundingClientRect(), d = devicePixelRatio || 1;
    this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px'; this.cv.width = Math.max(2, r.width * d); this.cv.height = Math.max(2, r.height * d);
    const fim = $('.tl-fim', this.nomes); if (fim) fim.style.height = (30 + Math.max(0, this.grade.offsetHeight - this.grade.clientHeight)) + 'px';
    this.nomes.scrollTop = this.grade.scrollTop;
    this.barra(); this.desenha();
    // a cabeça de leitura sempre visível
    // (só quando o quadro mudou: clicar numa linha com a cabeça fora da vista não pula a timeline no meio do arrasto)
    const x = App.q * this.CW; if (this._qVisto !== App.q && (x < this.grade.scrollLeft || x > this.grade.scrollLeft + r.width - 40)) this.grade.scrollLeft = Math.max(0, x - r.width / 3); this._qVisto = App.q;
  },
  selLinha(l) { if (!l) return; if (l.tipo === 'no') App.selecionar(l.no.id); else if (l.tipo === 'camera') App.selecionar('camera'); else if (l.tipo === 'efeito') { App.selecionar(l.pai ? l.pai.id : l.ef.id); Lado.aba('efeitos'); } else if (l.tipo === 'audio') { App.selecionar(l.a.id); Lado.aba('som'); } else if (l.tipo === 'legenda') Lado.aba('som'); },
  barra() {
    const P = App.P, tc = q => { const t = Math.floor(q / P.fps), qq = q % P.fps; return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}:${String(qq).padStart(2, '0')}`; };
    $('#tl-q').innerHTML = `<b>${App.q + 1}</b> / ${P.duracao} · <span title="minutos:segundos:quadros (o vídeo todo tem ${tc(P.duracao)})">${tc(App.q)}</span>`;
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
      const y = REG + l.y - sy, lh = l.h; if (y > H || y + lh < REG) return;
      const sel = (l.tipo === 'no' && App.sel === l.no.id) || (l.tipo === 'camera' && App.sel === 'camera') || (l.tipo === 'efeito' && App.sel === l.ef.id) || (l.tipo === 'audio' && App.sel === l.a.id);
      if (sel) { c.fillStyle = 'rgba(140,170,210,.12)'; c.fillRect(0, y, W, lh); }
      c.fillStyle = '#2a2a2a'; c.fillRect(0, y + lh - 1, W, 1);
      if (l.tipo === 'no') this.linhaNo(c, P, l.no, y, sx, sel);
      else if (l.tipo === 'camera') this.chaves(c, P.camera.chaves, y, sx, '#9fc3ff');
      else if (l.tipo === 'efeito') this.bloco(c, l.ef.de, l.ef.ate ?? (l.pai ? Modelo.fimNo(P, l.pai) : l.ef.de), y, sx, sel ? '#9a7ad8' : '#6d5a94', l.nome);
      else if (l.tipo === 'legenda') (P.legendas || []).forEach(g => this.bloco(c, g.de, g.ate, y, sx, '#4f6a58', String(g.texto || '').replace(/\*/g, '')));
      else if (l.tipo === 'audio') this.onda(c, P, l.a, y, sx, sel, lh);
    });
    // trecho marcado (Shift + arrastar na régua)
    const tr = this.trecho; if (tr) { const x0 = tr.de * CW - sx, w = (tr.ate - tr.de + 1) * CW; c.fillStyle = 'rgba(25,211,240,.09)'; c.fillRect(x0, REG, w, H); c.fillStyle = 'rgba(25,211,240,.55)'; c.fillRect(x0, REG, 1, H); c.fillRect(x0 + w - 1, REG, 1, H); }
    // régua
    c.fillStyle = '#2b2b2b'; c.fillRect(0, 0, W, REG); c.fillStyle = '#3a3a3a'; c.fillRect(0, REG - 1, W, 1);
    c.font = '10.5px ' + getComputedStyle(document.body).getPropertyValue('--mono'); c.textBaseline = 'middle';
    const passo = CW >= 14 ? 5 : CW >= 9 ? 10 : 20;
    for (let q = q0; q <= q1; q++) { const x = q * CW - sx; if ((q + 1) % passo === 0 || q === 0) { c.fillStyle = '#8f8f8f'; c.fillText(String(q + 1), x + 2, REG / 2); c.fillStyle = '#4a4a4a'; c.fillRect(Math.round(x) + .5, REG - 6, 1, 6); } if (q % P.fps === 0 && q) { c.fillStyle = '#6a6a6a'; c.fillRect(Math.round(x), 0, 1, REG); } }
    if (tr) { const x0 = tr.de * CW - sx, w = (tr.ate - tr.de + 1) * CW; c.fillStyle = '#19d3f0'; c.fillRect(x0, REG - 5, w, 4); }
    // cabeça de leitura
    const px = App.q * CW - sx; c.fillStyle = 'rgba(255,107,107,.16)'; c.fillRect(px, REG, CW, H); c.fillStyle = '#ff6b6b'; c.fillRect(px + CW / 2 - .5, REG, 1.5, H);
    c.fillStyle = '#ff6b6b'; c.beginPath(); c.roundRect(px - 2, 2, CW + 4, REG - 5, 4); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(String(App.q + 1), px + CW / 2, REG / 2 - 1); c.textAlign = 'start';
  },
  linhaNo(c, P, n, y, sx, sel) {
    if (n.tipo === 'efeito') return this.linhaEfeito(c, P, n, y, sx, sel);
    if (n.tipo === 'pasta') return this.linhaPasta(c, P, n, y, sx, sel);
    const de = n.de || 0, ate = Modelo.fimNo(P, n), CW = this.CW, cor = n.tipo === 'pasta' ? (n.corPasta ? n.corPasta + '99' : '#4b4b4b') : n.tipo === 'personagem' ? (Icone.cor(P.personagens[n.ref]) ? Icone.cor(P.personagens[n.ref]) + '88' : '#56657a') : n.tipo === 'texto' ? '#6b6150' : '#4f6562';
    c.fillStyle = n.vis === false ? '#333' : cor; c.globalAlpha = sel ? 1 : .85; c.beginPath(); c.roundRect(de * CW - sx + 1, y + 4, (ate - de + 1) * CW - 2, this.RH - 9, 4); c.fill(); c.globalAlpha = 1;
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(de * CW - sx + 1, y + 4, 3, this.RH - 9); c.fillRect((ate + 1) * CW - sx - 4, y + 4, 3, this.RH - 9);
    this.chaves(c, n.chaves, y, sx, '#f0f0f0', k => n.chaves[k].sessoes || n.chaves[k].partes);
  },
  // PASTA: a linha é da PASTA, não de um conteúdo — faixa listrada (tipo "em obras", só a parte escura) na cor da pasta.
  // Aberta: cada camada dentro dela tem a própria linha embaixo. Fechada: as chaves de dentro aparecem apagadinhas na faixa.
  linhaPasta(c, P, n, y, sx, sel) {
    const de = n.de || 0, ate = Modelo.fimNo(P, n), CW = this.CW, cor = n.corPasta || '#9a9a9a', x = de * CW - sx + 1, w = (ate - de + 1) * CW - 2, top = y + 4, hh = this.RH - 9;
    c.save(); c.globalAlpha = n.vis === false ? .35 : sel ? 1 : .9; c.beginPath(); c.roundRect(x, top, w, hh, 4); c.clip();
    c.fillStyle = cor + '40'; c.fillRect(x, top, w, hh);
    const pat = this.listras(c, cor); pat.setTransform?.(new DOMMatrix().translate(-sx, 0)); c.fillStyle = pat; c.fillRect(x, top, w, hh);
    c.restore();
    c.strokeStyle = sel ? cor : cor + '99'; c.lineWidth = 1; c.beginPath(); c.roundRect(x + .5, top + .5, w - 1, hh - 1, 4); c.stroke();
    if (n.aberto === false) { const ks = new Set(), junta = l => { for (const f of l || []) { Object.keys(f.chaves || {}).forEach(k => ks.add(+k)); junta(f.filhos); } }; junta(n.filhos);
      c.globalAlpha = .45; this.chaves(c, Object.fromEntries([...ks].map(k => [k, {}])), y, sx, cor); c.globalAlpha = 1; }
    this.chaves(c, n.chaves, y, sx, '#f0f0f0');
  },
  listras(c, cor) { // padrão de listras diagonais escuras na cor da pasta (um por cor)
    this._pat = this._pat || {}; if (this._pat[cor]) return this._pat[cor];
    const t = document.createElement('canvas'), L = 14; t.width = t.height = L; const g = t.getContext('2d');
    g.strokeStyle = 'rgba(0,0,0,.42)'; g.lineWidth = L / 2.6; g.beginPath(); for (const o of [-L, 0, L]) { g.moveTo(o, L); g.lineTo(o + L, 0); } g.stroke();
    g.strokeStyle = cor + '55'; g.lineWidth = 1; g.beginPath(); for (const o of [-L, 0, L]) { g.moveTo(o + L / 2, L); g.lineTo(o + L * 1.5, 0); } g.stroke();
    return (this._pat[cor] = c.createPattern(t, 'repeat'));
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
      const x = k * CW - sx + CW / 2, r = Math.min(5.5, CW / 2 - 1), ir = ch[k]?.ir; c.beginPath();
      // o desenho da chave diz como o movimento CHEGA nela: ◆ suave · ■ linear · ▮ corte seco · ● curva própria · ▲/▼ acelerando/freando
      if (ir === 'linear') c.rect(x - r * .8, yy - r * .8, r * 1.6, r * 1.6);
      else if (ir === 'corte') c.rect(x - r * .45, yy - r, r * .9, r * 2);
      else if (ir === 'livre') c.arc(x, yy, r * .85, 0, Math.PI * 2);
      else if (ir === 'entrada') { c.moveTo(x - r, yy + r * .8); c.lineTo(x + r, yy); c.lineTo(x - r, yy - r * .8); }
      else if (ir === 'saida') { c.moveTo(x + r, yy + r * .8); c.lineTo(x - r, yy); c.lineTo(x + r, yy - r * .8); }
      else { c.moveTo(x, yy - r); c.lineTo(x + r, yy); c.lineTo(x, yy + r); c.lineTo(x - r, yy); }
      c.closePath();
      const pose = ehPose?.(k); c.fillStyle = pose ? '#ffd36b' : cor; c.fill(); c.strokeStyle = /^(sobra|quicar|elastico)$/.test(ir || '') ? '#19d3f0' : '#111'; c.lineWidth = 1; c.stroke();
    }
  },
  bloco(c, de, ate, y, sx, cor, txt) {
    const CW = this.CW, x = de * CW - sx + 1, w = (ate - de + 1) * CW - 2; c.fillStyle = cor; c.beginPath(); c.roundRect(x, y + 4, w, this.RH - 9, 4); c.fill();
    if (txt && w > 30) { c.save(); c.beginPath(); c.rect(x, y, w, this.RH); c.clip(); c.fillStyle = '#eaeaea'; c.font = '11px Segoe UI'; c.fillText(txt, x + 5, y + this.RH / 2); c.restore(); }
  },
  // ONDA do áudio: contínua (pico por pixel, espelhada e suave), na cor do tipo; fades escurecem as pontas; nome em cima
  onda(c, P, a, y, sx, sel, lh = this.RH) {
    const CW = this.CW, fps = P.fps, de = a.de || 0, b = Som.buf.get(a.arq), fimQ = b ? Som.fimQ(P, a) : de + Math.round((Som.dur(a.arq) || 1) * fps) - 1, ouve = Som.ouve(P, a), tipo = Som.tipo(a);
    const pal = { voz: ['#2f4d40', '#3c6352', '#8fe0b4'], musica: ['#2e3a57', '#3b4b72', '#9fb7ff'], efeito: ['#4d4128', '#665634', '#ffd27a'] }[tipo], x0 = de * CW - sx, w = (fimQ - de + 1) * CW, top = y + 2, hh = lh - 5, mid = top + hh / 2 + (lh > 30 ? 4 : 0), m0 = lh > 30 ? hh / 2 - 5 : hh / 2 - 1.5;
    c.save(); c.globalAlpha = ouve ? 1 : .35; c.fillStyle = sel ? pal[1] : pal[0]; c.beginPath(); c.roundRect(x0, top, w, hh, 5); c.fill(); c.clip();
    const W = this.cv.width / (devicePixelRatio || 1), xa = Math.max(x0, 0), xz = Math.min(x0 + w, W), f = b && Som.finos(a.arq);
    if (f && xz > xa) {
      const ini = Som.ini(a), tl0 = de / fps, fim = tl0 + Som.compr(a, b), L = Math.max(.05, b.duration - ini), m = m0, pts = [];
      for (let x = xa; x <= xz; x += 1.5) { const t = (x + sx) / CW / fps, t2 = (x + 1.5 + sx) / CW / fps; let u0 = t - tl0, u1 = t2 - tl0; if (a.loop) { u0 = u0 % L; u1 = u0 + (t2 - t); }
        const v = Som.picoEntre(a.arq, ini + u0, ini + u1) * Som.ganho(a, Math.floor(t * fps)) * Som.fade(a, t, tl0, fim); pts.push([x, Math.min(1, Math.sqrt(v)) * m]); } // raiz: a parte baixa da fala aparece
      const g = c.createLinearGradient(0, top, 0, top + hh); g.addColorStop(0, pal[2]); g.addColorStop(.5, pal[2] + 'ee'); g.addColorStop(1, pal[2]);
      c.fillStyle = g; c.beginPath(); c.moveTo(pts[0][0], mid); for (const [x, v] of pts) c.lineTo(x, mid - Math.max(.6, v)); for (let i = pts.length - 1; i >= 0; i--) c.lineTo(pts[i][0], mid + Math.max(.6, pts[i][1])); c.closePath(); c.fill();
    } else { c.fillStyle = pal[2] + '55'; c.fillRect(x0, mid - .5, w, 1); }
    // fades: sombra nas pontas
    const fi = (+a.fi || 0) * fps * CW, fo = (+a.fo || 0) * fps * CW; c.fillStyle = 'rgba(0,0,0,.38)';
    if (fi) { c.beginPath(); c.moveTo(x0, top); c.lineTo(x0 + fi, top); c.lineTo(x0, top + hh); c.fill(); }
    if (fo) { c.beginPath(); c.moveTo(x0 + w, top); c.lineTo(x0 + w - fo, top); c.lineTo(x0 + w, top + hh); c.fill(); }
    if (w > 60) { c.font = '600 10px Segoe UI'; c.fillStyle = 'rgba(255,255,255,.85)'; c.shadowColor = '#000'; c.shadowBlur = 3; c.fillText((a.loop ? '↻ ' : '') + (a.nome || ''), Math.max(x0, 0) + 6, top + 9); c.shadowBlur = 0; }
    c.restore(); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x0, top + 3, 2, hh - 6); c.fillRect(x0 + w - 2, top + 3, 2, hh - 6);
    if (sel) { c.strokeStyle = pal[2]; c.lineWidth = 1; c.beginPath(); c.roundRect(x0 + .5, top + .5, w - 1, hh - 1, 5); c.stroke(); }
  },
  /* ---------- mouse ---------- */
  ponto(e) { const r = this.cv.getBoundingClientRect(), x = e.clientX - r.left + this.grade.scrollLeft, y = e.clientY - r.top; return { q: Math.floor(x / this.CW), x, y, i: y < this.REG ? -1 : this.linhaEm(y - this.REG + this.grade.scrollTop) }; },
  linhaEm(yy) { const L = this._L || []; for (let i = 0; i < L.length; i++) if (yy >= L[i].y && yy < L[i].y + L[i].h) return i; return L.length + Math.floor((yy - (this._altura || 0)) / this.RH); },
  desce(e) {
    const p = this.ponto(e), P = App.P, L = this._L; this.cv.setPointerCapture(e.pointerId);
    const mov = f => { const m = ev => f(this.ponto(ev), ev); const up = ev => { this.cv.removeEventListener('pointermove', m); this.cv.removeEventListener('pointerup', up); this.fimArr?.(ev); this.fimArr = null; }; this.cv.addEventListener('pointermove', m); this.cv.addEventListener('pointerup', up); };
    if (p.i < 0 && e.shiftKey) { // marcar um trecho
      const ult = Modelo.ultimoQuadro(P), q0 = clamp(p.q, 0, ult); App.pausa(); this.trecho = { de: q0, ate: q0 }; this.desenha();
      return mov(pp => { const q1 = clamp(pp.q, 0, ult); this.trecho = { de: Math.min(q0, q1), ate: Math.max(q0, q1) }; this.desenha(); });
    }
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
    if (l.tipo === 'audio' && Som.buf.get(l.a.arq)) { // ÁUDIO: pontas = cortar o começo/fim (como nos Shorts); Alt no meio = deslizar o som dentro do bloco
      const a = l.a, b = Som.buf.get(a.arq), de0 = a.de || 0, fim0 = Som.fimQ(P, a), ini0 = Som.ini(a), dur0 = a.dur, q0 = p.q, fps = P.fps;
      const ponta = perto(de0, 'ini') ? 'de' : perto(fim0, 'fim') ? 'ate' : e.altKey ? 'desliza' : null;
      if (ponta) {
        mov(pp => { const dq = pp.q - q0;
          if (ponta === 'de') { const d = clamp(dq, -Math.min(de0, Math.floor(ini0 * fps)), fim0 - de0); a.de = de0 + d; a.ini = round(Math.max(0, ini0 + d / fps), 3); if (dur0 != null) a.dur = round(Math.max(.05, dur0 - d / fps), 3); if (!a.ini) delete a.ini; }
          else if (ponta === 'ate') { const nq = Math.max(de0, fim0 + dq), nat = b.duration - ini0; a.dur = round(Math.max(1 / fps, a.loop ? (nq - de0 + 1) / fps : Math.min(nat, (nq - de0 + 1) / fps)), 3); if (!a.loop && Math.abs(a.dur - nat) < .5 / fps) delete a.dur; }
          else { const len = Som.compr(a, b); a.ini = round(clamp(ini0 - dq / fps, 0, Math.max(0, b.duration - len)), 3); }
          this.desenha(); });
        this.fimArr = () => App.commit(ponta === 'desliza' ? 'Deslizar o som' : 'Cortar o áudio'); return;
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
    if (l.tipo === 'audio') CorteVoz.abrir(l.a); // dois cliques no áudio = editor de corte
  },
  // como o movimento CHEGA na chave q (vale da chave de antes até ela); curva própria abre o editor de velocidade
  async poeIr(l, ch, q, id) {
    const k = ch[q]; if (!k) return;
    if (id === 'livre') { const v = await this.editaCurva(k.vel || [.42, 0, .58, 1]); if (!v) return; k.vel = v; }
    if (id === 'suave') { delete k.ir; delete k.vel; } else { k.ir = id; if (id !== 'livre') delete k.vel; }
    if (l.tipo === 'no' && id !== 'corte' && !l.no.interp) l.no.interp = true; // escolher uma curva liga o "intercalar entre as chaves"
    App.commit('Curva da chave');
  },
  // editor da curva de velocidade (cubic-bezier com 2 alças), com prévia de uma bolinha indo e voltando
  async editaCurva(v0) {
    const v = v0.slice(), S = 240, M = 30, body = h(`<div class="curva-ed"><canvas width="${S + M * 2}" height="${S + M * 2}"></canvas>
      <div class="curva-pre"><i></i></div><div class="campo2 curva-prontas">${[['Suave', [.42, 0, .58, 1]], ['Rápido no começo', [.1, .7, .3, 1]], ['Lento no começo', [.7, 0, .9, .3]], ['Estilingue', [.6, -.4, .3, 1.4]], ['Chicote', [.9, 0, .1, 1]]].map(([n, c]) => `<button class="btn sm" data-c="${c}">${n}</button>`).join('')}</div>
      <small style="color:var(--tx3)">Arraste as duas bolinhas. Em cima = já chegou; inclinado = rápido, deitado = devagar.</small></div>`);
    const cv = $('canvas', body), c = cv.getContext('2d'), P2 = (x, y) => [M + x * S, M + (1 - y) * S];
    const pinta = () => { c.clearRect(0, 0, cv.width, cv.height); c.strokeStyle = '#333'; c.lineWidth = 1; c.strokeRect(M, M, S, S);
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(M + i * S / 4, M); c.lineTo(M + i * S / 4, M + S); c.moveTo(M, M + i * S / 4); c.lineTo(M + S, M + i * S / 4); c.stroke(); }
      const [a, b] = [P2(0, 0), P2(1, 1)], [h1, h2] = [P2(v[0], v[1]), P2(v[2], v[3])];
      c.strokeStyle = '#777'; c.beginPath(); c.moveTo(...a); c.lineTo(...h1); c.moveTo(...b); c.lineTo(...h2); c.stroke();
      c.strokeStyle = '#19d3f0'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(...a); c.bezierCurveTo(...h1, ...h2, ...b); c.stroke();
      for (const hh of [h1, h2]) { c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(...hh, 7, 0, Math.PI * 2); c.fill(); } };
    let arr = -1; cv.onpointerdown = e => { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height;
      const d = [P2(v[0], v[1]), P2(v[2], v[3])].map(([hx, hy]) => Math.hypot(hx - x, hy - y)); arr = d[0] < d[1] ? 0 : 1; cv.setPointerCapture(e.pointerId); cv.onpointermove(e); };
    cv.onpointermove = e => { if (arr < 0) return; const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) * cv.width / r.width - M) / S, y = 1 - ((e.clientY - r.top) * cv.height / r.height - M) / S;
      v[arr * 2] = round(clamp(x, 0, 1), 3); v[arr * 2 + 1] = round(clamp(y, -.6, 1.6), 3); pinta(); };
    cv.onpointerup = () => { arr = -1; };
    $$('[data-c]', body).forEach(b => b.onclick = () => { b.dataset.c.split(',').map(Number).forEach((x, i) => v[i] = x); pinta(); });
    let t0 = performance.now(), raf = 0; const bola = $('.curva-pre i', body), anda = now => { const t = ((now - t0) / 1100) % 2, u = t < 1 ? t : 2 - t; bola.style.left = (Ease.bez(...v)(u) * 100) + '%'; raf = requestAnimationFrame(anda); };
    pinta(); raf = requestAnimationFrame(anda);
    const ok = await UI.modal({ title: 'Curva própria do movimento', icon: 'transition', width: 360, body, buttons: [{ label: 'Cancelar', value: false }, { label: 'Usar esta curva', kind: 'primary', value: true }] });
    cancelAnimationFrame(raf); return ok ? v : null;
  },
  menu(e) {
    const p = this.ponto(e), l = this._L[p.i];
    if (l?.tipo === 'audio') { const a = l.a, q = clamp(p.q, 0, Modelo.ultimoQuadro(App.P)); App.setQ(q); App.selecionar(a.id);
      return UI.ctx(e.clientX, e.clientY, [{ head: `${a.nome} · quadro ${q + 1}` },
        { label: 'Editar o corte…', icon: 'cut', key: 'dois cliques', action: () => CorteVoz.abrir(a) },
        !a.loop && q > (a.de || 0) && q < Som.fimQ(App.P, a) && { label: 'Dividir aqui', icon: 'split', action: () => CorteVoz.dividirEm(a, q) },
        { label: 'Tirar silêncios…', icon: 'wand', action: () => CorteVoz.abrir(a) },
        '-', { label: a.mudo ? 'Tirar o mudo' : 'Mudo', icon: a.mudo ? 'vol' : 'mute', action: () => { a.mudo = !a.mudo; App.commit('Mudo'); } },
        { label: 'Limpar e nivelar a voz', icon: 'wand', action: () => Som.limpar(a) },
        { label: 'Tirar o áudio', icon: 'trash', danger: true, action: () => { App.P.audios = App.P.audios.filter(x => x !== a); App.commit('Tirar áudio'); } }].filter(Boolean)); }
    if (!l || (l.tipo !== 'no' && l.tipo !== 'camera')) { // régua dos quadros ou linha sem chaves: dá para citar o quadro
      if (!App.P || !Number.isFinite(p.q)) return; const q = clamp(p.q, 0, Modelo.ultimoQuadro(App.P)); App.setQ(q);
      const tr = this.trecho && q >= this.trecho.de && q <= this.trecho.ate ? this.trecho : null, P = App.P;
      return UI.ctx(e.clientX, e.clientY, [
        tr ? { head: `Trecho ${Trechos.rotulo(tr, P)} (quadros ${tr.de + 1} a ${tr.ate + 1})` } : { head: `Quadro ${q + 1}` },
        tr && { label: 'Citar este trecho na IA (ela muda só ele)', icon: 'sparkles', ai: true, action: () => Assistente.citar({ tipo: 'trecho', de: tr.de, ate: tr.ate }) },
        tr && { label: 'Tirar a marcação do trecho', icon: 'x', action: () => { this.trecho = null; this.desenha(); } },
        !tr && { label: `Citar o quadro ${q + 1} na IA`, icon: 'sparkles', ai: true, action: () => Assistente.citar({ tipo: 'quadro', q }) },
        !tr && { label: 'Citar um trecho daqui na IA (2 s)', icon: 'cut', action: () => { const t = Trechos.novo(P, q / P.fps, q / P.fps + 2); Assistente.citar({ tipo: 'trecho', de: t.de, ate: t.ate }); } },
        !tr && { label: 'Marcar um trecho: Shift + arrastar na régua', icon: 'cut', disabled: true },
        '-', { label: `Citar o quadro ${q + 1} em mensagens…`, icon: 'chat', action: () => Citacao.animacao(App.P, q, App.sel) },
        { label: 'Revisar a animação (antes de exportar)…', icon: 'check', action: () => Revisor.abrir() }].filter(Boolean));
    }
    App.setQ(p.q);
    const ch = l.tipo === 'no' ? l.no.chaves : App.P.camera.chaves, tem = !!ch[p.q];
    if (l.tipo === 'no') App.selecionar(l.no.id); else App.selecionar('camera');
    UI.ctx(e.clientX, e.clientY, [
      { head: `Quadro ${p.q + 1} · ${l.nome}` },
      { label: tem ? 'Atualizar a chave' : 'Chave aqui', icon: 'diamond', key: 'K', action: () => l.tipo === 'no' ? App.chaveAqui() : (ch[p.q] = { ...Modelo.camera(App.P, p.q) }, App.commit('Chave da câmera')) },
      tem && { label: 'Copiar chave', icon: 'copy', action: () => { this.copia = clone(ch[p.q]); UI.toast('Chave copiada'); } },
      this.copia && { label: 'Colar chave', icon: 'paste', action: () => { ch[p.q] = clone(this.copia); App.commit('Colar chave'); } },
      tem && { label: 'Como o movimento chega aqui', icon: 'transition', sub: Object.entries(Ease.IR).map(([id, nome]) => ({ label: nome, icon: (ch[p.q].ir || 'suave') === id ? 'check' : null, action: () => this.poeIr(l, ch, p.q, id) })) },
      tem && { label: 'Tirar a chave', icon: 'trash', danger: true, key: 'Shift+K', action: () => App.tiraChave() },
      l.tipo === 'no' && '-',
      l.tipo === 'no' && { label: 'Começar aqui', icon: 'start', action: () => { l.no.de = p.q; App.commit('Começo'); } },
      l.tipo === 'no' && { label: 'Terminar aqui', icon: 'end', action: () => { l.no.ate = Math.max(l.no.de || 0, p.q); App.commit('Fim'); } },
      l.tipo === 'no' && { label: l.no.interp ? 'Movimento: segurar até a próxima chave' : 'Movimento: intercalar entre as chaves', icon: 'transition', action: () => { l.no.interp = !l.no.interp; App.commit('Movimento'); } },
      '-', { label: `Citar na IA: ${l.nome} no quadro ${p.q + 1}`, icon: 'sparkles', ai: true, action: () => Assistente.citar(l.tipo === 'no' ? { tipo: 'camada', id: l.no.id, nome: l.no.nome, q: p.q } : { tipo: 'camera', q: p.q }) },
      { label: `Citar o quadro ${p.q + 1} em mensagens…`, icon: 'chat', action: () => Citacao.animacao(App.P, p.q, l.tipo === 'no' ? l.no.id : 'camera') },
    ].filter(Boolean));
  },
};
