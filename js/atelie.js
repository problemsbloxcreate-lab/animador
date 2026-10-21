/* ===================== atelie.js — Ateliê de personagens (montagem por partes) =====================
   1) PARTES: corpo, cabeça, cabelo, olhos, braços… cada uma com várias IMAGENS para trocar. Cada parte encaixa no pai
      (ex.: olhos → cabeça → corpo): mexeu no pai, as partes de cima vão junto; trocou a imagem, ela continua no lugar certo.
   2) MONTAR (Base): arraste as peças para o lugar; Alt+arrastar muda o PIVÔ (ponto de giro); "Só esta imagem" corrige
      uma imagem que ficou torta sem mexer nas outras.
   3) SESSÕES e PRESETS: "Olhos" → assustado, surpreso, triste, fechado… "Perna direita" → chutando, inclinada…
      "Pose" (corpo todo). Editando um preset, o que você mexe vale só para ele.
   Teclas: setas movem (Shift = 10) · Q/E giram (Shift = 15°) · + / − tamanho · F espelha · [ ] frente/trás · Tab próxima parte
           · H esconde · Delete/Backspace apaga (a parte, as partes marcadas ou a imagem clicada) · Ctrl+Z desfaz · Ctrl+S salva na nuvem.
   RAIZ: a parte principal (def.raiz), destacada em amarelo na hierarquia. Ctrl+clique / Shift+clique marcam várias partes;
   arrastar partes para "Imagens de…" (ou o menu "Mover para imagens de") transforma partes que entraram sem querer em imagens trocáveis. */
'use strict';
const SESSOES_PRONTAS = [
  { nome: 'Olhos', acha: /olho|eye|pupila|cílio|cilio/i, presets: ['normal', 'assustado', 'surpreso', 'triste', 'fechado', 'bravo'] },
  { nome: 'Sobrancelhas', acha: /sobrancelha|brow/i, presets: ['normal', 'brava', 'triste', 'levantada'] },
  { nome: 'Boca', acha: /boca|mouth|lábio|labio|dente/i, presets: ['fechada', 'meio aberta', 'aberta', 'sorriso', 'triste'] },
  { nome: 'Braço direito', acha: /bra[cç]o.*(dir|d\b)|m[aã]o.*(dir|d\b)|antebra[cç]o.*(dir|d\b)/i, presets: ['parado', 'acenando', 'apontando'] },
  { nome: 'Braço esquerdo', acha: /bra[cç]o.*(esq|e\b)|m[aã]o.*(esq|e\b)|antebra[cç]o.*(esq|e\b)/i, presets: ['parado', 'na cintura'] },
  { nome: 'Perna direita', acha: /perna.*(dir|d\b)|p[eé].*(dir|d\b)|coxa.*(dir|d\b)/i, presets: ['parada', 'chutando', 'inclinada'] },
  { nome: 'Perna esquerda', acha: /perna.*(esq|e\b)|p[eé].*(esq|e\b)|coxa.*(esq|e\b)/i, presets: ['parada', 'passo'] },
  { nome: 'Pose', acha: /.*/, presets: ['em pé', 'pulando', 'sentado'] },
];
const Atelie = {
  def: null, sel: null, edit: null, vista: { x: 0, y: 0, z: 1 }, pilha: [], refazer: [], ultimo: null, volta: false, aba: 'peca', soImagem: false, sujo: false, multi: new Set(), focoImg: null,
  // o Ateliê abre numa aba nova do navegador (Voltar fecha a aba); se o navegador bloquear, abre aqui mesmo
  abrirAba(id) {
    if (this.emAba) return this.abrir(id);
    const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('atelie', id || 'novo');
    const w = window.open(u.href, '_blank'); if (!w) return this.abrir(id, { volta: !!App.P });
  },
  async abrir(id, o = {}) {
    this.volta = !!o.volta; let def;
    if (id) { const t = UI.toast('<span class="spin-dot"></span> Abrindo o personagem…', { time: 60000 }); try { def = await Nuvem.abrir(id); } catch (e) { t.remove(); return UI.toast('Não abriu: ' + esc(e.message), { kind: 'err' }); } t.remove(); }
    else { const nome = await UI.prompt({ title: 'Personagem novo', label: 'Nome do personagem', value: '', ok: 'Criar' }); if (!nome) return; def = Modelo.novoPersonagem(nome); }
    this.def = def; this.sel = (def.raiz && def.partes.some(p => p.id === def.raiz) ? def.raiz : def.partes[0]?.id) || null; this.multi = new Set(); this.focoImg = null; this.edit = null; this.pilha = []; this.refazer = []; this.ultimo = JSON.stringify(def); this.sujo = !id;
    await Arq.garantir(def.partes.flatMap(p => p.imgs.map(i => i.k)));
    Telas.mostra('atelie'); this.liga(); this.pinta(); this.enquadrar(); document.title = def.nome + ' — Ateliê · ANIMADOR · Estúdio Problems';
  },
  async sair() {
    if (this.sujo && !(await UI.confirm({ title: 'Sair sem salvar na nuvem?', msg: 'As mudanças deste personagem ainda não foram salvas na nuvem da equipe.', ok: 'Sair sem salvar', danger: true }))) return;
    if (this.emAba) { this.sujo = false; window.close(); setTimeout(() => { if (!window.closed) { history.replaceState(null, '', location.pathname); this.emAba = false; Telas.mostra('home'); Home.aba('personagens'); } }, 300); return; }
    if (this.volta && App.P) { Telas.mostra('editor'); App.titulo(); App.atualiza(); } else { Telas.mostra('home'); Home.aba('personagens'); }
  },
  commit(o = {}) { const s = JSON.stringify(this.def); if (s !== this.ultimo) { this.pilha.push(this.ultimo); if (this.pilha.length > 120) this.pilha.shift(); this.refazer = []; this.ultimo = s; this.sujo = true; } if (!o.soDesenho) this.pinta(); else this.desenha(); },
  undo() { if (!this.pilha.length) return; this.refazer.push(this.ultimo); this.ultimo = this.pilha.pop(); this.def = JSON.parse(this.ultimo); this.sujo = true; this.pinta(); },
  redo() { if (!this.refazer.length) return; this.pilha.push(this.ultimo); this.ultimo = this.refazer.pop(); this.def = JSON.parse(this.ultimo); this.pinta(); },

  /* ---------- estado que está na tela (base ou preset em edição) ---------- */
  parte(id = this.sel) { return this.def.partes.find(p => p.id === id) || null; },
  // partes marcadas: a escolhida + as do Ctrl/Shift+clique
  selecionadas() { return [...new Set([this.sel, ...this.multi])].map(id => this.parte(id)).filter(Boolean); },
  escolhe(id) { this.sel = id; this.multi.clear(); this.focoImg = null; },
  sessao() { return this.edit ? this.def.sessoes.find(s => s.id === this.edit.s) : null; },
  preset() { const s = this.sessao(); return s ? s.presets.find(p => p.id === this.edit.p) : null; },
  estado() { return Modelo.partesNoEstado(this.def, this.edit ? { sessoes: { [this.edit.s]: this.edit.p } } : {}); },
  // muda um campo da parte no modo atual (base ou o preset em edição)
  mudar(pid, vals) {
    const p = this.parte(pid); if (!p) return;
    const pr = this.preset();
    if (pr) { const s = this.sessao(); if (s.partes?.length && !s.partes.includes(pid)) { s.partes.push(pid); } pr.estado[pid] = { ...(pr.estado[pid] || {}), ...vals }; }
    else Object.assign(p.base, vals);
  },
  matParte(pid, est = this.estado()) { const it = Modelo.montar(this.def, est).find(x => x.parte.id === pid); return it ? it.m : new DOMMatrix(); },
  matPai(pid, est = this.estado()) { const p = this.parte(pid); return p?.pai ? this.matParte(p.pai, est) : new DOMMatrix(); },

  /* ---------- tela ---------- */
  liga() {
    if (this._ligado) return; this._ligado = true;
    this.cv = $('#at-cv'); this.ctx = this.cv.getContext('2d'); new ResizeObserver(() => this.tamanho()).observe(this.cv.parentElement); this.tamanho();
    this.cv.addEventListener('pointerdown', e => this.desce(e)); this.cv.addEventListener('wheel', e => this.roda(e), { passive: false });
    $('#at-voltar').onclick = () => this.sair(); $('#at-salvar').onclick = () => this.salvar(); $('#at-undo').onclick = () => this.undo(); $('#at-redo').onclick = () => this.redo();
    $('#at-nome').onchange = e => { this.def.nome = e.target.value.trim() || this.def.nome; this.commit(); };
    $('#at-pasta').onchange = e => { this.def.pasta = e.target.value.trim() || 'Personagens'; this.commit(); };
    $('#at-add-parte').onclick = () => this.novaParte(); $$('#at-vista-partes [data-v]').forEach(b => b.onclick = () => { this.vistaPartes = b.dataset.v; this.pintaPartes(); }); $('#at-add-img').onclick = () => this.addImagens(); $('#at-add-pasta').onclick = () => { const p = this.parte(); if (p) this.novaPastaImg(p); else UI.toast('Escolha uma parte primeiro'); };
    // soltar imagens no palco do ateliê: entram na parte escolhida (sem parte escolhida, cada uma vira uma parte)
    const cvA = $('#at-cv'); cvA.ondragover = ev => { if (ev.dataTransfer.types.includes('Files')) ev.preventDefault(); }; cvA.ondrop = ev => { if (ev.dataTransfer.files?.length) { ev.preventDefault(); this.addImagens([...ev.dataTransfer.files], !this.parte()); } };
    $$('#at-abas [data-aba]').forEach(b => b.onclick = () => { this.aba = b.dataset.aba; this.pinta(); });
    $('#at-base').onclick = () => { this.edit = null; this.pinta(); };
    $('#at-so-img').onclick = () => { this.soImagem = !this.soImagem; this.pinta(); };
    $('#at-enq').onclick = () => this.enquadrar();
    addEventListener('keydown', e => this.teclas(e));
    Pintura.liga();
  },
  tamanho() { const r = this.cv.getBoundingClientRect(), d = devicePixelRatio || 1; this.cv.width = Math.max(2, r.width * d); this.cv.height = Math.max(2, r.height * d); this.desenha(); },
  enquadrar() {
    if (!this.cv) return; const r = this.cv.getBoundingClientRect(), b = Modelo.caixaPersonagem(this.def, this.estado()); const z = Math.min(r.width / (b.w + 200), r.height / (b.h + 200), 2.5);
    this.vista = { z, x: r.width / 2 - (b.x + b.w / 2) * z, y: r.height / 2 - (b.y + b.h / 2) * z }; this.desenha();
  },
  V() { const d = devicePixelRatio || 1, v = this.vista; return new DOMMatrix().scale(d).translate(v.x, v.y).scale(v.z); },
  mundo(e) { const r = this.cv.getBoundingClientRect(), v = this.vista; return { x: (e.clientX - r.left - v.x) / v.z, y: (e.clientY - r.top - v.y) / v.z }; },
  desenha() {
    if (!this.ctx || !this.def) return; const ctx = this.ctx, W = this.cv.width, H = this.cv.height, d = devicePixelRatio || 1, V = this.V();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#151515'; ctx.fillRect(0, 0, W, H);
    // grade xadrez (fundo transparente)
    ctx.save(); ctx.setTransform(V); const g = 50; ctx.fillStyle = '#1b1b1b'; const a = this.mundoTela(0, 0), b2 = this.mundoTela(W / d, H / d);
    for (let x = Math.floor(a.x / g) * g; x < b2.x; x += g) for (let y = Math.floor(a.y / g) * g; y < b2.y; y += g) if (((x + y) / g) % 2 === 0) ctx.fillRect(x, y, g, g);
    ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 1 / this.vista.z; ctx.beginPath(); ctx.moveTo(-5000, 0); ctx.lineTo(5000, 0); ctx.moveTo(0, -5000); ctx.lineTo(0, 5000); ctx.stroke(); ctx.restore();
    const est = this.estado(), itens = Modelo.montar(this.def, est);
    for (const it of itens) { if (!it.img) continue; const bm = Arq.bitmap(it.img.k, () => this.desenha()); if (!bm) continue; const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2;
      ctx.save(); ctx.setTransform(V.multiply(it.m)); ctx.globalAlpha = this.sel && it.parte.id !== this.sel && this.destacar ? .45 : 1; ctx.drawImage(bm, -px + (it.img.ajuste?.x || 0), -py + (it.img.ajuste?.y || 0), it.img.w, it.img.h); ctx.restore(); }
    // parte escolhida: caixa, pivô (ponto de giro) e a ligação com o pai
    const it = itens.find(x => x.parte.id === this.sel);
    if (it) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); const T = V.multiply(it.m), piv = T.transformPoint(new DOMPoint(0, 0));
      if (it.img) { const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2, ax = it.img.ajuste?.x || 0, ay = it.img.ajuste?.y || 0;
        const c = [[0, 0], [it.img.w, 0], [it.img.w, it.img.h], [0, it.img.h]].map(([x, y]) => T.transformPoint(new DOMPoint(x - px + ax, y - py + ay)));
        ctx.strokeStyle = this.soImagem ? '#ffd36b' : this.edit ? '#ffb86b' : '#9fc3ff'; ctx.lineWidth = 1.5 * d; ctx.setLineDash([5 * d, 4 * d]); ctx.beginPath(); c.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
        const mt = { x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2 }, dx = mt.x - piv.x, dy = mt.y - piv.y, L = Math.hypot(dx, dy) || 1; this._giro = { x: mt.x + dx / L * 26 * d, y: mt.y + dy / L * 26 * d, piv };
        ctx.beginPath(); ctx.moveTo(mt.x, mt.y); ctx.lineTo(this._giro.x, this._giro.y); ctx.stroke(); ctx.beginPath(); ctx.arc(this._giro.x, this._giro.y, 6 * d, 0, 7); ctx.fillStyle = '#1b1b1b'; ctx.fill(); ctx.stroke(); }
      if (it.parte.pai) { const pp = V.multiply(this.matParte(it.parte.pai, est)).transformPoint(new DOMPoint(0, 0)); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([3 * d, 3 * d]); ctx.beginPath(); ctx.moveTo(pp.x, pp.y); ctx.lineTo(piv.x, piv.y); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(pp.x, pp.y, 3 * d, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill(); }
      ctx.beginPath(); ctx.arc(piv.x, piv.y, 5 * d, 0, 7); ctx.fillStyle = '#ff6b6b'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * d; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(piv.x - 9 * d, piv.y); ctx.lineTo(piv.x + 9 * d, piv.y); ctx.moveTo(piv.x, piv.y - 9 * d); ctx.lineTo(piv.x, piv.y + 9 * d); ctx.stroke(); ctx.restore();
    } else this._giro = null;
    Pintura.desenhaCursor(ctx);
  },
  mundoTela(x, y) { const v = this.vista; return { x: (x - v.x) / v.z, y: (y - v.y) / v.z }; },
  roda(e) { e.preventDefault(); const r = this.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, v = this.vista, z = clamp(v.z * Math.exp(-e.deltaY * .0015), .05, 20); v.x = mx - (mx - v.x) * z / v.z; v.y = my - (my - v.y) * z / v.z; v.z = z; this.desenha(); },
  // qual peça está embaixo do mouse (a da frente)
  acha(w) {
    const itens = Modelo.montar(this.def, this.estado()).filter(i => i.img).reverse();
    for (const it of itens) { const loc = it.m.inverse().transformPoint(new DOMPoint(w.x, w.y)), px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2, x = loc.x + px - (it.img.ajuste?.x || 0), y = loc.y + py - (it.img.ajuste?.y || 0);
      if (x >= 0 && y >= 0 && x <= it.img.w && y <= it.img.h) { const bm = Arq.img.get(it.img.k); if (!bm || this.opaco(bm, x * bm.width / it.img.w, y * bm.height / it.img.h)) return it; } }
    return null;
  },
  _alfa: new Map(),
  opaco(bm, x, y) { let c = this._alfa.get(bm); if (!c) { c = new OffscreenCanvas(bm.width, bm.height).getContext('2d', { willReadFrequently: true }); c.drawImage(bm, 0, 0); this._alfa.set(bm, c); } return c.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] > 20; },
  desce(e) {
    this.cv.setPointerCapture(e.pointerId); const d = devicePixelRatio || 1;
    const fim = (mov, up) => { const m = ev => mov(ev), u = ev => { this.cv.removeEventListener('pointermove', m); this.cv.removeEventListener('pointerup', u); up?.(ev); }; this.cv.addEventListener('pointermove', m); this.cv.addEventListener('pointerup', u); };
    if (e.button === 1 || e.button === 2 || this.espaco) { const v = this.vista, x0 = e.clientX, y0 = e.clientY, vx = v.x, vy = v.y; return fim(ev => { v.x = vx + ev.clientX - x0; v.y = vy + ev.clientY - y0; this.desenha(); }); }
    if (e.button === 0 && Pintura.ferr !== 'mover') return Pintura.desce(e); // pincel, borracha, balde, conta-gotas
    // girar pela alça
    if (this._giro && Math.hypot(e.offsetX * d - this._giro.x, e.offsetY * d - this._giro.y) < 12 * d) {
      const p = this.parte(), e0 = this.estado()[p.id], ang = ev => Math.atan2(ev.offsetY * d - this._giro.piv.y, ev.offsetX * d - this._giro.piv.x) * 180 / Math.PI, a0 = ang(e);
      return fim(ev => { let r = (e0.r || 0) + ang(ev) - a0; if (ev.shiftKey) r = Math.round(r / 15) * 15; this.mudar(p.id, { r: round(r, 1) }); this.desenha(); }, () => this.commit());
    }
    const w = this.mundo(e), it = this.acha(w);
    if (!it) { const v = this.vista, x0 = e.clientX, y0 = e.clientY, vx = v.x, vy = v.y; let mexeu = false; return fim(ev => { mexeu = true; v.x = vx + ev.clientX - x0; v.y = vy + ev.clientY - y0; this.desenha(); }, () => { if (!mexeu) { this.escolhe(null); this.pinta(); } }); }
    if (it.parte.id !== this.sel || this.multi.size || this.focoImg) { this.escolhe(it.parte.id); this.pinta(); }
    const p = it.parte, est = this.estado(), w0 = w;
    if (e.altKey && it.img) { // pivô: muda o ponto de giro sem tirar a peça do lugar
      const img = it.img, inv = it.m.inverse(), l0 = inv.transformPoint(new DOMPoint(w0.x, w0.y)), piv0 = { ...(img.pivo || { x: img.w / 2, y: img.h / 2 }) }, enc0 = { ...p.encaixe }, filhos = this.def.partes.filter(f => f.pai === p.id).map(f => [f, { ...f.encaixe }]);
      return fim(ev => { const w2 = this.mundo(ev), l = inv.transformPoint(new DOMPoint(w2.x, w2.y)), dx = l.x - l0.x, dy = l.y - l0.y;
        img.pivo = { x: round(piv0.x + dx, 1), y: round(piv0.y + dy, 1) };
        const lin = it.m.multiply(new DOMMatrix().translate(0, 0)), pai = this.matPai(p.id, est).inverse(), a = pai.multiply(lin);
        const mv = new DOMPoint(dx, dy, 0, 0), dp = new DOMMatrix([a.a, a.b, a.c, a.d, 0, 0]).transformPoint(mv); // deslocamento no espaço do pai
        p.encaixe = { x: round(enc0.x + dp.x, 1), y: round(enc0.y + dp.y, 1) }; for (const [f, e0] of filhos) f.encaixe = { x: round(e0.x - dx, 1), y: round(e0.y - dy, 1) };
        this.desenha(); }, () => this.commit());
    }
    if (this.soImagem && it.img) { // só esta imagem
      const img = it.img, inv = it.m.inverse(), l0 = inv.transformPoint(new DOMPoint(w0.x, w0.y)), aj0 = { ...(img.ajuste || { x: 0, y: 0 }) };
      return fim(ev => { const w2 = this.mundo(ev), l = inv.transformPoint(new DOMPoint(w2.x, w2.y)); img.ajuste = { x: round(aj0.x + l.x - l0.x, 1), y: round(aj0.y + l.y - l0.y, 1) }; this.desenha(); }, () => this.commit());
    }
    // mover a peça: na Base muda o encaixe (onde ela fica no pai); num preset muda só o preset
    const inv = this.matPai(p.id, est).inverse(), a0 = inv.transformPoint(new DOMPoint(w0.x, w0.y)), e0 = { ...est[p.id] }, enc0 = { ...p.encaixe };
    fim(ev => { const w2 = this.mundo(ev), a = inv.transformPoint(new DOMPoint(w2.x, w2.y)); let dx = a.x - a0.x, dy = a.y - a0.y; if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      if (this.edit) this.mudar(p.id, { x: round((e0.x || 0) + dx, 1), y: round((e0.y || 0) + dy, 1) }); else p.encaixe = { x: round(enc0.x + dx, 1), y: round(enc0.y + dy, 1) }; this.desenha(); }, () => this.commit());
  },
  teclas(e) {
    if ($('#atelie').classList.contains('hidden') || $('#modal-root').children.length) return;
    if (e.target.closest?.('input,textarea,select') && e.target.type !== 'range') return;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey, p = this.parte();
    if (k === ' ') { this.espaco = e.type === 'keydown'; e.preventDefault(); return; }
    if (ctrl && k.toLowerCase() === 'z') { e.preventDefault(); return e.shiftKey ? this.redo() : this.undo(); }
    if (ctrl && k.toLowerCase() === 's') { e.preventDefault(); return this.salvar(); }
    if (ctrl) return;
    if (e.type === 'keydown' && Pintura.tecla(e)) return;
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); return this.apagarSelecao(); }
    if (k === 'Escape' && (this.multi.size || this.focoImg)) { this.multi.clear(); this.focoImg = null; return this.pinta(); }
    if (k === 'Tab') { e.preventDefault(); const ps = this.def.partes; if (!ps.length) return; const i = ps.findIndex(x => x.id === this.sel); this.multi.clear(); this.focoImg = null; this.sel = ps[(i + (e.shiftKey ? -1 : 1) + ps.length) % ps.length].id; return this.pinta(); }
    if (!p) return; const est = this.estado()[p.id], passo = e.shiftKey ? 10 : 1, kk = k.toLowerCase();
    const leva = () => { clearTimeout(this._t); this.desenha(); this._t = setTimeout(() => this.commit(), 300); };
    if (k.startsWith('Arrow')) { e.preventDefault(); const dd = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[k];
      if (this.edit) this.mudar(p.id, { x: (est.x || 0) + dd[0], y: (est.y || 0) + dd[1] }); else p.encaixe = { x: p.encaixe.x + dd[0], y: p.encaixe.y + dd[1] }; return leva(); }
    if (kk === 'q' || kk === 'e') { this.mudar(p.id, { r: round((est.r || 0) + (kk === 'q' ? -1 : 1) * (e.shiftKey ? 15 : 2), 1) }); return leva(); }
    if (k === '+' || k === '=' || k === '-') { this.mudar(p.id, { s: round(clamp((est.s ?? 1) * (k === '-' ? .96 : 1.04), .05, 10), 3) }); return leva(); }
    if (kk === 'f') { this.mudar(p.id, { sx: (est.sx || 1) * -1 }); return leva(); }
    if (kk === 'h') { this.mudar(p.id, { vis: est.vis === false }); return leva(); }
    if (k === '[' || k === ']') return this.passoCamada(p, k === ']' ? 1 : -1);
  },

  /* ---------- painéis ---------- */
  pinta() {
    if (!this.def) return; $('#at-nome').value = this.def.nome; $('#at-pasta').value = this.def.pasta || 'Personagens';
    $('#at-salvar').innerHTML = `${ic('upload', 14)} ${this.sujo ? 'Salvar na nuvem' : 'Salvo'}`;
    const au = $('#at-autores'); if (au && au._de !== this.def.autor?.em + '/' + (this.def.edicoes || []).length) { au._de = this.def.autor?.em + '/' + (this.def.edicoes || []).length; au.innerHTML = ''; const sl = Autores.selo(this.def); if (sl) au.appendChild(sl); }
    const pr = this.preset(), s = this.sessao();
    $('#at-modo').innerHTML = pr ? `Editando <b>${esc(s.nome)} › ${esc(pr.nome)}</b>` : 'Montando a <b>base</b>';
    $('#at-base').hidden = !pr; $('#at-so-img').classList.toggle('on', this.soImagem);
    this.pintaPartes(); this.pintaImgs(); $$('#at-abas [data-aba]').forEach(b => b.classList.toggle('on', b.dataset.aba === this.aba));
    const lado = $('#at-lado'); lado.innerHTML = ''; this.aba === 'peca' ? this.pintaPeca(lado) : this.aba === 'pintar' ? Pintura.pintaAba(lado) : this.pintaSessoes(lado); this.desenha();
  },
  pintaPartes() {
    const el = $('#at-partes'), ps = this.def.partes; el.innerHTML = '';
    $$('#at-vista-partes [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === (this.vistaPartes || 'arvore')));
    if (this.vistaPartes === 'camadas' && ps.length) return this.pintaCamadas(el);
    if (!ps.length) { el.innerHTML = '<div class="vazio">Comece criando as partes: corpo, cabeça, cabelo, olhos, braços, pernas…<br>(ou solte as imagens aqui: cada imagem vira uma parte)</div>'; }
    const raiz = this.def.raiz, filhos = id => ps.filter(p => (p.pai || null) === id).sort((a, b) => (b.id === raiz) - (a.id === raiz) || (b.z || 0) - (a.z || 0)), est = this.estado(), ordem = this._ordem = [];
    const vai = (pai, nivel) => { for (const p of filhos(pai)) { ordem.push(p.id);
      const ehRaiz = p.id === raiz, marc = p.id !== this.sel && this.multi.has(p.id);
      const r = h(`<div class="no ${p.id === this.sel ? 'sel' : ''} ${marc ? 'multi' : ''} ${ehRaiz ? 'raiz' : ''}" style="padding-left:${8 + nivel * 14}px" draggable="true" title="${ehRaiz ? 'RAIZ — a parte principal do personagem · ' : ''}Ctrl+clique ou Shift+clique marcam várias · arraste para &quot;Imagens de…&quot; para virar imagem"><span class="ti">${ic(ehRaiz ? 'star' : p.imgs.length ? 'image' : 'shapes', 13)}</span><span class="nm">${esc(p.nome)} <small style="color:var(--tx3)">${p.imgs.length}</small></span>${ehRaiz ? '<span class="tag-raiz">raiz</span>' : ''}
        <button class="ibtn ${est[p.id]?.vis === false ? 'off' : ''}" title="Mostrar/esconder (H)">${ic(est[p.id]?.vis === false ? 'eyeOff' : 'eye', 13)}</button></div>`);
      r.onclick = ev => { if (ev.target.closest('.ibtn')) { this.mudar(p.id, { vis: est[p.id]?.vis === false }); return this.commit(); } this.clicaParte(ev, p.id); };
      r.ondblclick = async () => { const n = await UI.prompt({ title: 'Nome da parte', value: p.nome }); if (n) { p.nome = n; this.commit(); } };
      r.oncontextmenu = ev => { ev.preventDefault(); if (p.id !== this.sel && !this.multi.has(p.id)) this.escolhe(p.id); this.focoImg = null; this.pinta(); this.menuParte(ev, p); };
      r.ondragstart = ev => { ev.dataTransfer.setData('text/parte', p.id); this._arrasto = this.multi.has(p.id) ? this.selecionadas().map(x => x.id) : [p.id]; };
      r.ondragover = ev => { const t = ev.dataTransfer.types; if (t.includes('text/parte') || t.includes('Files')) { ev.preventDefault(); ev.stopPropagation(); r.classList.add('drop-dentro'); } };
      r.ondragleave = () => r.classList.remove('drop-dentro');
      r.ondrop = ev => { ev.preventDefault(); ev.stopPropagation(); r.classList.remove('drop-dentro');
        if (ev.dataTransfer.files?.length) { this.sel = p.id; return this.addImagens([...ev.dataTransfer.files], false); } // arquivo em cima da parte: vira imagem dela
        const id = ev.dataTransfer.getData('text/parte'); if (id && id !== p.id) this.porNoPai(id, p.id); };
      el.appendChild(r); vai(p.id, nivel + 1); } };
    vai(null, 0);
    el.ondragover = ev => { if (ev.dataTransfer.types.includes('Files')) ev.preventDefault(); };
    el.ondrop = ev => { if (ev.dataTransfer.files?.length) { ev.preventDefault(); this.addImagens([...ev.dataTransfer.files], true); } };
  },
  // CAMADAS: a ordem real de desenho (de cima = na frente), igual às camadas do Photoshop.
  // Mexer aqui só muda o Z; quem encaixa em quem (a hierarquia) continua igual.
  ordemCamadas() { const est = this.estado(); return this.def.partes.map((p, i) => ({ p, i, z: (p.z || 0) + (est[p.id]?.z || 0) })).sort((a, b) => a.z - b.z || a.i - b.i).map(x => x.p); },
  passoCamada(p, d) { const L = this.ordemCamadas().reverse(), i = L.indexOf(p), j = i - d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; this.reordenar(L); },
  reordenar(frenteParaTras) { // reescreve os Z da base: 0 = mais atrás
    const n = frenteParaTras.length, pr = this.preset(), est = pr ? pr.estado : null;
    frenteParaTras.forEach((p, i) => { p.z = (n - 1 - i) - (est?.[p.id]?.z || 0); });
    this.commit();
  },
  pintaCamadas(el) {
    const est = this.estado(), lista = this.ordemCamadas().reverse(), nomeDe = id => this.parte(id)?.nome;
    el.appendChild(h(`<div class="cam-dica">De cima para baixo: quem fica <b>na frente</b>. Arraste para mudar a ordem (o encaixe não muda).${this.preset() ? ' Vale para a base e para todos os presets.' : ''}</div>`));
    lista.forEach((p, i) => {
      const e = est[p.id] || {}, img = p.imgs.find(x => x.id === e.img), bm = img ? Arq.bitmap(img.k, () => this.pintaPartes()) : null;
      const r = h(`<div class="cam ${p.id === this.sel ? 'sel' : ''} ${p.id === this.def.raiz ? 'raiz' : ''}" draggable="true"><span class="grip">${ic('dots', 12)}</span><canvas width="52" height="52"></canvas>
        <span class="nm"><b>${esc(p.nome)}</b><small>${p.id === this.def.raiz ? 'RAIZ (principal)' : p.pai ? 'encaixa em ' + esc(nomeDe(p.pai) || '?') : 'solta (sem pai)'}</small></span><span class="zz" title="Z (maior = mais na frente)">${(p.z || 0) + (e.z || 0)}</span>
        <button class="ibtn" data-up title="Para a frente ( ] )" ${i ? '' : 'disabled'}>${ic('up', 12)}</button><button class="ibtn" data-dn title="Para trás ( [ )" ${i < lista.length - 1 ? '' : 'disabled'}>${ic('down', 12)}</button>
        <button class="ibtn ${e.vis === false ? 'off' : ''}" data-vis title="Mostrar/esconder (H)">${ic(e.vis === false ? 'eyeOff' : 'eye', 12)}</button></div>`);
      if (bm) { const c = $('canvas', r), x = c.getContext('2d'), k = Math.min(52 / bm.width, 52 / bm.height); x.drawImage(bm, (52 - bm.width * k) / 2, (52 - bm.height * k) / 2, bm.width * k, bm.height * k); }
      const move = d => { const L = lista.slice(), j = i + d; [L[i], L[j]] = [L[j], L[i]]; this.reordenar(L); };
      r.onclick = ev => { if (ev.target.closest('button')) return; this.escolhe(p.id); this.pinta(); };
      r.oncontextmenu = ev => { ev.preventDefault(); this.escolhe(p.id); this.pinta(); this.menuParte(ev, p); };
      $('[data-up]', r).onclick = () => move(-1); $('[data-dn]', r).onclick = () => move(1);
      $('[data-vis]', r).onclick = () => { this.mudar(p.id, { vis: e.vis === false }); this.commit(); };
      r.ondragstart = ev => ev.dataTransfer.setData('text/camada', p.id);
      r.ondragover = ev => { if (!ev.dataTransfer.types.includes('text/camada')) return; ev.preventDefault(); const b = r.getBoundingClientRect(), cima = ev.clientY < b.top + b.height / 2; r.classList.toggle('drop-antes', cima); r.classList.toggle('drop-depois', !cima); };
      r.ondragleave = () => r.classList.remove('drop-antes', 'drop-depois');
      r.ondrop = ev => { ev.preventDefault(); const cima = r.classList.contains('drop-antes'); r.classList.remove('drop-antes', 'drop-depois');
        const q = this.parte(ev.dataTransfer.getData('text/camada')); if (!q || q === p) return; const L = lista.filter(x => x !== q); L.splice(L.indexOf(p) + (cima ? 0 : 1), 0, q); this.reordenar(L); };
      el.appendChild(r);
    });
  },
  menuParte(e, p) {
    const sel = this.selecionadas(), varias = sel.length > 1 && sel.includes(p), lista = varias ? sel : [p], ids = lista.map(x => x.id);
    const destinos = this.def.partes.filter(x => !ids.includes(x.id));
    const ehRaiz = p.id === this.def.raiz;
    UI.ctx(e.clientX, e.clientY, [
      varias && { head: `${lista.length} PARTES MARCADAS` },
      !varias && { label: ehRaiz ? 'Deixar de ser a raiz' : 'Marcar como raiz (principal)', icon: 'star', action: () => this.marcarRaiz(p) },
      { label: varias ? `Mover as ${lista.length} para imagens de` : 'Mover para imagens de', icon: 'image', disabled: !destinos.length, sub: destinos.map(d => ({ label: d.nome, icon: d.id === this.def.raiz ? 'star' : null, action: () => this.virarImagens(lista, d) })) },
      '-',
      !varias && { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome da parte', value: p.nome }); if (n) { p.nome = n; this.commit(); } } },
      !varias && { label: 'Parte nova encaixada nesta', icon: 'plus', action: () => this.novaParte(p.id) },
      !varias && { label: 'Duplicar (ex.: braço esquerdo → direito)', icon: 'dup', action: () => this.duplicarParte(p) },
      !varias && p.pai && { label: 'Soltar do pai', icon: 'layers', action: () => this.porNoPai(p.id, null) },
      !varias && '-', !varias && { label: 'Para a frente', icon: 'up', key: ']', action: () => this.passoCamada(p, 1) }, !varias && { label: 'Para trás', icon: 'down', key: '[', action: () => this.passoCamada(p, -1) }, !varias && { label: 'Ver as camadas', icon: 'layers', action: () => { this.vistaPartes = 'camadas'; this.pintaPartes(); } },
      '-', { label: varias ? `Apagar as ${lista.length} partes` : 'Apagar a parte', icon: 'trash', key: 'Delete', danger: true, action: () => this.apagarPartes(lista) },
    ].filter(Boolean));
  },
  // pôr a parte dentro de outra mantendo o lugar na tela
  porNoPai(id, paiId, o = {}) {
    const p = this.parte(id); if (!p) return; let a = paiId; while (a) { if (a === id) return UI.toast('Uma parte não pode encaixar nela mesma'); a = this.parte(a)?.pai; }
    if (paiId && this.def.raiz === id) { delete this.def.raiz; if (!o.semCommit) UI.toast(`"${esc(p.nome)}" encaixou em outra parte e deixou de ser a raiz.`); }
    const est = this.estado(), mundo = this.matParte(id, est).transformPoint(new DOMPoint(0, 0)); p.pai = paiId;
    const est2 = this.estado(), inv = this.matPai(id, est2).inverse(), l = inv.transformPoint(mundo), e = est2[id] || {};
    const sem = new DOMMatrix().translate(e.x || 0, e.y || 0); p.encaixe = { x: round(l.x - sem.e, 1), y: round(l.y - sem.f, 1) }; if (!o.semCommit) this.commit();
  },
  // clique na lista de partes: normal escolhe; Ctrl marca/desmarca mais uma; Shift marca o trecho até a escolhida
  clicaParte(ev, id) {
    this.focoImg = null;
    if ((ev.ctrlKey || ev.metaKey) && this.sel && id !== this.sel) { this.multi.has(id) ? this.multi.delete(id) : this.multi.add(id); return this.pinta(); }
    if (ev.shiftKey && this.sel && id !== this.sel) { const o = this._ordem || [], a = o.indexOf(this.sel), b = o.indexOf(id); if (a >= 0 && b >= 0) { for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (o[i] !== this.sel) this.multi.add(o[i]); return this.pinta(); } }
    this.escolhe(id); this.pinta();
  },
  // RAIZ: a parte principal (normalmente o corpo). Fica no topo da hierarquia, sem pai, destacada em amarelo.
  marcarRaiz(p) {
    if (this.def.raiz === p.id) { delete this.def.raiz; this.commit(); return UI.toast(`"${esc(p.nome)}" não é mais a raiz.`); }
    if (p.pai) this.porNoPai(p.id, null, { semCommit: true });
    this.def.raiz = p.id; this.commit(); UI.toast(`<b>${esc(p.nome)}</b> agora é a raiz (a parte principal).`, { kind: 'ok' });
  },
  // Delete / Backspace: o mesmo que clicar em apagar (a imagem clicada em "Imagens de…", ou as partes marcadas)
  apagarSelecao() {
    const f = this.focoImg, p = f && this.parte(f.p), img = p?.imgs.find(i => i.id === f.img);
    if (img) return this.tirarImg(p, img);
    const lista = this.selecionadas(); if (!lista.length) return UI.toast('Escolha uma parte (ou clique numa imagem) para apagar');
    this.apagarPartes(lista);
  },
  async apagarPartes(lista) {
    if (lista.length === 1) return this.apagarParte(lista[0]);
    if (!(await UI.confirm({ title: `Apagar ${lista.length} partes?`, msg: lista.map(p => esc(p.nome)).join(', ') + '. As partes encaixadas nelas passam para o pai delas.', ok: 'Apagar', danger: true }))) return;
    this.tirarPartes(lista); this.sel = this.def.raiz || this.def.partes[0]?.id || null; this.multi.clear(); this.focoImg = null; this.commit();
  },
  // tira as partes do personagem (sem confirmar nem salvar): filhos vão para o avô que fica; sessões e presets esquecem delas
  tirarPartes(lista) {
    const ids = new Set(lista.map(p => p.id)), fica = id => { while (id && ids.has(id)) id = this.parte(id)?.pai || null; return id || null; };
    for (const f of this.def.partes.filter(x => !ids.has(x.id) && ids.has(x.pai))) this.porNoPai(f.id, fica(f.pai), { semCommit: true });
    this.def.partes = this.def.partes.filter(x => !ids.has(x.id)); if (ids.has(this.def.raiz)) delete this.def.raiz;
    for (const s of this.def.sessoes) { s.partes = (s.partes || []).filter(x => !ids.has(x)); for (const pr of s.presets) for (const id of ids) delete pr.estado[id]; }
  },
  // partes que entraram sem querer viram IMAGENS (trocáveis) de outra parte. Ex.: 3 partes "olho aberto/fechado/bravo" → imagens de "Olhos".
  // Parte com 1 imagem: a imagem leva o nome da parte. Com várias: vão juntas numa pasta com o nome da parte.
  virarImagens(lista, alvo, pasta = null) {
    lista = lista.filter(p => p && p.id !== alvo.id); if (!lista.length) return;
    const vazias = lista.filter(p => !p.imgs.length), comImg = lista.filter(p => p.imgs.length); let n = 0;
    for (const p of comImg) {
      const varias = p.imgs.length > 1;
      for (const img of p.imgs) { const c = { ...img, id: uid('i') }; if (!varias) c.nome = p.nome; const pa = pasta || (varias ? p.nome : null); if (pa) c.pasta = pa; else delete c.pasta; alvo.imgs.push(c); n++; }
      if (varias && !pasta) { alvo.pastas = alvo.pastas || []; if (!alvo.pastas.includes(p.nome)) alvo.pastas.push(p.nome); }
    }
    if (pasta) { alvo.pastas = alvo.pastas || []; if (!alvo.pastas.includes(pasta)) alvo.pastas.push(pasta); }
    if (!alvo.base.img && alvo.imgs.length) alvo.base.img = alvo.imgs[0].id;
    this.tirarPartes(comImg); this.escolhe(alvo.id); this.commit();
    UI.toast(n ? `${comImg.length > 1 ? comImg.length + ' partes viraram' : '"' + esc(comImg[0].nome) + '" virou'} ${n} imagem(ns) de <b>${esc(alvo.nome)}</b>. Clique numa imagem para trocar; dois cliques renomeiam (o editor troca pelo nome).${vazias.length ? ' Partes sem imagem ficaram como estavam.' : ''}` : 'Essas partes não têm imagens para mover.', { kind: n ? 'ok' : 'warn', time: 7000 });
  },
  novaParte(pai = null) { const p = Modelo.novaParte('Parte ' + (this.def.partes.length + 1), pai ?? (this.parte()?.id || null)); p.z = this.def.partes.length; this.def.partes.push(p); this.sel = p.id; this.commit(); setTimeout(() => this.addImagens(null, false), 50); },
  duplicarParte(p) {
    const mapa = {}, copia = (q, novoPai) => { const c = clone(q); c.id = uid('pt'); mapa[q.id] = c.id; c.pai = novoPai; c.nome = q.nome.replace(/esquerd[oa]/i, m => /a$/.test(m) ? 'direita' : 'direito').replace(/direit[oa]/i, m => /a$/.test(m) ? 'esquerda' : 'esquerdo'); if (c.nome === q.nome) c.nome += ' (cópia)';
      c.imgs = c.imgs.map(i => ({ ...i })); c.base.sx = -(c.base.sx || 1); c.encaixe = { x: q === p ? -q.encaixe.x : q.encaixe.x, y: q.encaixe.y }; this.def.partes.push(c);
      for (const f of this.def.partes.filter(x => x.pai === q.id && !Object.values(mapa).includes(x.id))) copia(f, c.id); return c; };
    const c = copia(p, p.pai); this.sel = c.id; this.commit(); UI.toast('Parte duplicada e espelhada. Arraste para o lugar.', { kind: 'ok' });
  },
  async apagarParte(p) {
    const filhos = this.def.partes.filter(x => x.pai === p.id);
    if (!(await UI.confirm({ title: `Apagar "${esc(p.nome)}"?`, msg: filhos.length ? `As ${filhos.length} parte(s) encaixadas nela passam para o pai dela.` : 'As imagens dela saem do personagem.', ok: 'Apagar', danger: true }))) return;
    this.tirarPartes([p]); this.sel = this.def.raiz || this.def.partes[0]?.id || null; this.multi.clear(); this.focoImg = null; this.commit();
  },
  // imagens: viram variações da parte escolhida (ou, soltas na lista de partes, uma parte nova cada)
  async addImagens(fs, cadaUmaParte, pasta = null) {
    fs = fs || await pickFiles('image/png,image/webp,image/gif,image/jpeg', true); fs = (fs || []).filter(f => /^image\//.test(f.type) || /\.(png|webp|gif|jpe?g)$/i.test(f.name)); if (!fs.length) return;
    let p = this.parte();
    for (const f of fs) {
      const bm = await createImageBitmap(f).catch(() => null); if (!bm) { UI.toast(`"${esc(f.name)}" não é uma imagem que dá para usar`, { kind: 'err' }); continue; }
      let blob = f; if (bm.width > 2048 || bm.height > 2048 || f.size > 3 * 1048576) { const k = Math.min(1, 2048 / Math.max(bm.width, bm.height)), c = new OffscreenCanvas(Math.round(bm.width * k), Math.round(bm.height * k)); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); blob = await c.convertToBlob({ type: 'image/png' }); }
      const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : blob.type === 'image/gif' ? 'gif' : 'png', iid = uid('im').toLowerCase().replace(/[^a-z0-9]/g, '');
      const k = `personagens/${this.def.id}/img/${iid}.${ext}`; await Arq.guardar(blob, k); Arq.img.set(k, await createImageBitmap(blob));
      const nome = f.name.replace(/\.[^.]+$/, '').slice(0, 40);
      if (cadaUmaParte || !p) { p = Modelo.novaParte(nome, null); p.z = this.def.partes.length; this.def.partes.push(p); }
      const img = { id: uid('i'), nome, k, w: bm.width > 2048 || bm.height > 2048 ? Math.round(bm.width * Math.min(1, 2048 / Math.max(bm.width, bm.height))) : bm.width, h: bm.width > 2048 || bm.height > 2048 ? Math.round(bm.height * Math.min(1, 2048 / Math.max(bm.width, bm.height))) : bm.height };
      img.pivo = { x: img.w / 2, y: img.h / 2 }; img.ajuste = { x: 0, y: 0 }; if (pasta && !cadaUmaParte) img.pasta = pasta; p.imgs.push(img);
      if (!p.base.img) p.base.img = img.id; else if (!cadaUmaParte) this.mudar(p.id, { img: img.id });
      if (cadaUmaParte) p = null;
    }
    if (!this.sel) this.sel = this.def.partes[0]?.id; this.commit(); this.enquadrar();
  },
  // imagens da parte escolhida, em pastas (ex.: "olhos", "bocas"). Arrastar arquivos aqui põe nesta parte; numa pasta, dentro dela.
  pintaImgs() {
    const el = $('#at-imgs'), p = this.parte(); $('#at-imgs-t').textContent = p ? `Imagens de "${p.nome}"` : 'Imagens'; $('#at-imgs-t').title = p ? 'Arraste partes da lista de cima para cá: elas viram imagens trocáveis desta parte' : ''; el.innerHTML = '';
    if (!p) { el.innerHTML = '<div class="vazio" style="grid-column:1/-1">Escolha uma parte.</div>'; return; }
    p.pastas = [...new Set([...(p.pastas || []), ...p.imgs.map(i => i.pasta).filter(Boolean)])];
    const atual = this.estado()[p.id]?.img, fechadas = this.pastasFechadas || (this.pastasFechadas = new Set());
    const solta = (alvo, pasta) => { // soltar arquivos do computador ou uma imagem arrastada daqui
      alvo.ondragover = ev => { const t = ev.dataTransfer.types; if (t.includes('Files') || t.includes('text/img') || t.includes('text/parte')) { ev.preventDefault(); ev.stopPropagation(); alvo.classList.add('drop-dentro'); } };
      alvo.ondragleave = ev => { if (!alvo.contains(ev.relatedTarget)) alvo.classList.remove('drop-dentro'); };
      alvo.ondrop = ev => { ev.preventDefault(); ev.stopPropagation(); alvo.classList.remove('drop-dentro');
        if (ev.dataTransfer.files?.length) return this.addImagens([...ev.dataTransfer.files], false, pasta);
        const pid = ev.dataTransfer.getData('text/parte'); if (pid) { const ids = this._arrasto?.includes(pid) ? this._arrasto : [pid]; this._arrasto = null; return this.virarImagens(ids.map(i => this.parte(i)), p, pasta); } // parte arrastada da lista: vira imagem desta parte
        const img = p.imgs.find(i => i.id === ev.dataTransfer.getData('text/img')); if (img && (img.pasta || null) !== pasta) { if (pasta) img.pasta = pasta; else delete img.pasta; this.commit(); } };
    };
    const card = img => {
      const bm = Arq.bitmap(img.k, () => this.pintaImgs()), c = h(`<div class="im ${img.id === atual ? 'on' : ''} ${this.focoImg?.img === img.id ? 'foco' : ''}" draggable="true" title="${esc(img.nome)} — clique para usar${this.edit ? ' neste preset' : ' na base'} · arraste para uma pasta"><span>${esc(img.nome)}</span><button class="ibtn x" title="Tirar a imagem">${ic('x', 12)}</button></div>`);
      if (bm) { const cv = document.createElement('canvas'); cv.width = 96; cv.height = 96; const k = Math.min(96 / bm.width, 96 / bm.height); cv.getContext('2d').drawImage(bm, (96 - bm.width * k) / 2, (96 - bm.height * k) / 2, bm.width * k, bm.height * k); c.style.backgroundImage = `url(${cv.toDataURL()})`; }
      c.onclick = ev => { if (ev.target.closest('.x')) return; this.focoImg = { p: p.id, img: img.id }; this.mudar(p.id, { img: img.id }); this.commit(); this.pintaImgs(); };
      c.ondblclick = () => this.renomearImg(img);
      c.ondragstart = ev => { ev.dataTransfer.setData('text/img', img.id); ev.dataTransfer.effectAllowed = 'move'; };
      c.oncontextmenu = ev => { ev.preventDefault(); UI.ctx(ev.clientX, ev.clientY, [
        { label: 'Usar esta imagem', icon: 'check', action: () => { this.mudar(p.id, { img: img.id }); this.commit(); } },
        { label: 'Renomear', icon: 'edit', action: () => this.renomearImg(img) },
        { label: 'Mover para a pasta', icon: 'folder', sub: [{ label: '(sem pasta)', checked: !img.pasta, action: () => { delete img.pasta; this.commit(); } }, ...p.pastas.map(n => ({ label: n, checked: img.pasta === n, action: () => { img.pasta = n; this.commit(); } })), '-', { label: 'Pasta nova…', icon: 'plus', action: async () => { const n = await this.novaPastaImg(p); if (n) { img.pasta = n; this.commit(); } } }] },
        '-', { label: 'Tirar a imagem', icon: 'trash', key: 'Delete', danger: true, action: () => this.tirarImg(p, img) },
      ]); };
      $('.x', c).onclick = () => this.tirarImg(p, img);
      return c;
    };
    for (const nome of p.pastas) {
      const dentro = p.imgs.filter(i => i.pasta === nome), aberta = !fechadas.has(p.id + '/' + nome);
      const corP = p.pastaCores?.[nome];
      const cab = h(`<div class="pasta-img ${aberta ? 'aberta' : ''} ${corP ? 'com-cor' : ''}" style="${corP ? `--pc:${corP}` : ''}" title="Clique para abrir/fechar · solte imagens aqui · botão direito: opções">${ic(aberta ? 'down' : 'right', 12)}${ic('folder', 14)}<b>${esc(nome)}</b><small>${dentro.length}</small><span class="sp"></span><button class="ibtn" data-add title="Pôr imagens nesta pasta">${ic('plus', 13)}</button></div>`);
      cab.onclick = ev => { if (ev.target.closest('[data-add]')) return; const k = p.id + '/' + nome; fechadas.has(k) ? fechadas.delete(k) : fechadas.add(k); this.pintaImgs(); };
      $('[data-add]', cab).onclick = () => this.addImagens(null, false, nome);
      cab.oncontextmenu = ev => { ev.preventDefault(); UI.ctx(ev.clientX, ev.clientY, [
        { label: 'Pôr imagens nesta pasta…', icon: 'plus', action: () => this.addImagens(null, false, nome) },
        menuCor(corP, c => { p.pastaCores = p.pastaCores || {}; if (c) p.pastaCores[nome] = c; else delete p.pastaCores[nome]; this.commit(); }),
        { label: 'Renomear a pasta', icon: 'edit', action: async () => { const n = (await UI.prompt({ title: 'Nome da pasta', value: nome }))?.trim(); if (!n || n === nome) return; if (p.pastas.includes(n)) return UI.toast('Já existe uma pasta com esse nome'); p.pastas = p.pastas.map(x => x === nome ? n : x); dentro.forEach(i => i.pasta = n); this.commit(); } },
        '-', { label: 'Desfazer a pasta (as imagens ficam)', icon: 'trash', action: () => { p.pastas = p.pastas.filter(x => x !== nome); dentro.forEach(i => delete i.pasta); this.commit(); } },
      ]); };
      solta(cab, nome); el.appendChild(cab);
      if (aberta) { for (const img of dentro) el.appendChild(card(img)); if (!dentro.length) el.appendChild(h('<div class="vazio pasta-vazia">Pasta vazia: arraste imagens para cá.</div>')); }
    }
    const soltas = p.imgs.filter(i => !i.pasta);
    if (p.pastas.length && soltas.length) el.appendChild(h(`<div class="pasta-img solta">${ic('image', 14)}<b>Sem pasta</b><small>${soltas.length}</small></div>`));
    for (const img of soltas) el.appendChild(card(img));
    const add = h(`<div class="im add" title="Pôr imagens nesta parte (ou arraste os arquivos para cá)">${ic('plus', 18)}</div>`); add.onclick = () => this.addImagens(); el.appendChild(add);
    solta(el, null);
  },
  async novaPastaImg(p) {
    const n = (await UI.prompt({ title: 'Pasta nova', label: 'Ex.: olhos, bocas, mãos, roupas', value: '' }))?.trim().slice(0, 30); if (!n) return null;
    p.pastas = p.pastas || []; if (!p.pastas.includes(n)) p.pastas.push(n); this.commit(); return n;
  },
  async renomearImg(img) { const n = await UI.prompt({ title: 'Nome da imagem', label: 'Ex.: aberto, fechado, chutando', value: img.nome }); if (n) { img.nome = n; this.commit(); } },
  async tirarImg(p, img) {
    if (!(await UI.confirm({ title: `Tirar a imagem "${esc(img.nome)}"?`, ok: 'Tirar', danger: true }))) return;
    if (this.focoImg?.img === img.id) this.focoImg = null; p.imgs = p.imgs.filter(i => i !== img); if (p.base.img === img.id) p.base.img = p.imgs[0]?.id || null;
    for (const s of this.def.sessoes) for (const pr of s.presets) if (pr.estado[p.id]?.img === img.id) delete pr.estado[p.id].img; this.commit();
  },
  pintaPeca(el) {
    const p = this.parte(); if (!p) { el.appendChild(h('<div class="vazio">Escolha uma parte na lista ou clique numa peça.</div>')); return; }
    const est = this.estado()[p.id] || {}, img = p.imgs.find(i => i.id === est.img);
    const box = h(`<div class="props"><div class="titulo-p">${esc(p.nome)} · ${this.edit ? esc(this.preset().nome) : 'base'}</div>
      <button class="btn sm raiz-bt ${p.id === this.def.raiz ? 'on' : ''}" data-raiz title="A raiz é a parte principal do personagem (normalmente o corpo): fica no topo e destacada na hierarquia">${ic('star', 13)} ${p.id === this.def.raiz ? 'É a raiz (principal)' : 'Marcar como raiz'}</button>
      <label class="field">Encaixa em<select data-pai><option value="">(nada — solta no topo)</option>${this.def.partes.filter(x => x.id !== p.id).map(x => `<option value="${x.id}" ${x.id === p.pai ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label></div>`);
    $('[data-pai]', box).onchange = ev => this.porNoPai(p.id, ev.target.value || null); $('[data-raiz]', box).onclick = () => this.marcarRaiz(p);
    const mexe = (c, v) => { this.mudar(p.id, { [c]: v }); this.desenha(); }, sol = () => this.commit();
    if (this.edit) { box.appendChild(Lado.campo('Mover X', est.x || 0, -500, 500, 1, v => mexe('x', v), sol)); box.appendChild(Lado.campo('Mover Y', est.y || 0, -500, 500, 1, v => mexe('y', v), sol)); }
    else { box.appendChild(Lado.campo('Encaixe X', p.encaixe.x, -1500, 1500, 1, v => { p.encaixe.x = v; this.desenha(); }, sol)); box.appendChild(Lado.campo('Encaixe Y', p.encaixe.y, -1500, 1500, 1, v => { p.encaixe.y = v; this.desenha(); }, sol)); }
    box.appendChild(Lado.campo('Girar', est.r || 0, -180, 180, .5, v => mexe('r', v), sol)); box.appendChild(Lado.campo('Tamanho', est.s ?? 1, .05, 4, .01, v => mexe('s', v), sol));
    const o = h(`<div class="campo2"><label class="chk"><input type="checkbox" data-sx ${est.sx < 0 ? 'checked' : ''}> Espelhar (F)</label><label class="chk"><input type="checkbox" data-v ${est.vis !== false ? 'checked' : ''}> Aparece (H)</label>
      <span class="sp"></span><span style="color:var(--tx2)">Camada</span><input type="number" value="${p.z || 0}" data-z style="width:54px" title="Maior = mais na frente ( [ e ] )"></div>`);
    $('[data-sx]', o).onchange = ev => { this.mudar(p.id, { sx: ev.target.checked ? -1 : 1 }); this.commit(); }; $('[data-v]', o).onchange = ev => { this.mudar(p.id, { vis: ev.target.checked }); this.commit(); };
    $('[data-z]', o).onchange = ev => { p.z = +ev.target.value; this.commit(); }; box.appendChild(o);
    if (this.edit && this.preset().estado[p.id]) { const lb = h(`<button class="btn sm">${ic('undo', 13)} Esta parte igual à base neste preset</button>`); lb.onclick = () => { delete this.preset().estado[p.id]; this.commit(); }; box.appendChild(lb); }
    if (img) {
      box.appendChild(h(`<div class="titulo-p">Imagem "${esc(img.nome)}"</div>`));
      box.appendChild(Lado.campo('Pivô X', img.pivo.x, 0, img.w, 1, v => { img.pivo.x = v; this.desenha(); }, sol)); box.appendChild(Lado.campo('Pivô Y', img.pivo.y, 0, img.h, 1, v => { img.pivo.y = v; this.desenha(); }, sol));
      box.appendChild(Lado.campo('Só ela X', img.ajuste.x, -300, 300, 1, v => { img.ajuste.x = v; this.desenha(); }, sol)); box.appendChild(Lado.campo('Só ela Y', img.ajuste.y, -300, 300, 1, v => { img.ajuste.y = v; this.desenha(); }, sol));
      box.appendChild(h('<div style="color:var(--tx3);font-size:11.5px">Pivô = ponto de giro (Alt + arrastar na peça). "Só ela" corrige esta imagem sem mexer nas outras imagens da parte (botão <b>Só esta imagem</b> + arrastar).</div>'));
    }
    el.appendChild(box);
  },
  pintaSessoes(el) {
    const def = this.def, box = h(`<div class="sessoes-at"><div class="campo2"><button class="btn sm" data-nova>${ic('plus', 13)} Sessão</button><button class="btn sm" data-prontas>${ic('layers', 13)} Sessões prontas</button></div></div>`);
    $('[data-nova]', box).onclick = () => this.novaSessao(); $('[data-prontas]', box).onclick = () => this.sessoesProntas();
    if (!def.sessoes.length) box.appendChild(h('<div class="vazio">Sessões são grupos de presets: <b>Olhos</b> (assustado, surpreso, triste, fechado…), <b>Boca</b>, <b>Perna direita</b> (chutando, inclinada…), <b>Pose</b> (corpo todo).<br><br>Na animação, cada sessão vira uma fila de botões: clicou, virou chave naquele quadro.</div>'));
    for (const s of def.sessoes) {
      const aberta = this.edit?.s === s.id, nomesPartes = (s.partes || []).map(id => this.parte(id)?.nome).filter(Boolean);
      const c = h(`<div class="sess ${aberta ? 'aberta' : ''}"><div class="cab"><b>${esc(s.nome)}</b><small title="Partes que esta sessão mexe">${nomesPartes.length ? esc(nomesPartes.slice(0, 3).join(', ')) + (nomesPartes.length > 3 ? '…' : '') : 'todas as partes'}</small>
        <button class="ibtn ia" data-ia title="Criar um preset com a IA">${ic('sparkles', 13)}</button><button class="ibtn" data-m title="Mais">${ic('dots', 13)}</button></div><div class="lista presets"></div></div>`);
      const l = $('.lista', c);
      for (const pr of s.presets) { const b = h(`<button class="${aberta && this.edit.p === pr.id ? 'on' : ''}" title="Clique para editar · botão direito: opções">${esc(pr.nome)}</button>`);
        b.onclick = () => { this.edit = { s: s.id, p: pr.id }; this.pinta(); }; b.oncontextmenu = ev => { ev.preventDefault(); this.menuPreset(ev, s, pr); }; l.appendChild(b); }
      const add = h(`<button title="Preset novo com o que está na tela">+ preset</button>`); add.onclick = () => this.novoPreset(s); l.appendChild(add);
      $('[data-ia]', c).onclick = () => this.presetIA(s); $('[data-m]', c).onclick = ev => this.menuSessao(ev, s);
      box.appendChild(c);
    }
    el.appendChild(box);
  },
  async novaSessao(nome) {
    const def = this.def, body = h(`<div><label class="field">Nome da sessão<input type="text" value="${esc(nome || '')}" placeholder="Ex.: Olhos, Boca, Perna direita, Pose"></label>
      <div class="field">Partes que ela mexe <small>(nenhuma marcada = todas, para poses do corpo todo)</small><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${def.partes.map(p => `<label class="chk"><input type="checkbox" value="${p.id}" ${p.id === this.sel ? 'checked' : ''}> ${esc(p.nome)}</label>`).join('')}</div></div></div>`);
    const r = await UI.modal({ title: 'Sessão nova', icon: 'layers', body, enterValue: true, buttons: [{ label: 'Cancelar', value: null }, { label: 'Criar', kind: 'primary', collect: a => ({ nome: $('input[type=text]', a.body).value.trim(), partes: $$('input[type=checkbox]:checked', a.body).map(i => i.value) }) }] });
    if (!r?.nome) return; const s = { id: uid('s'), nome: r.nome, partes: r.partes, presets: [] }; def.sessoes.push(s); this.aba = 'sessoes'; this.commit(); this.novoPreset(s, 'normal');
  },
  sessoesProntas() {
    const def = this.def; let n = 0;
    for (const sp of SESSOES_PRONTAS) {
      if (def.sessoes.some(s => s.nome.toLowerCase() === sp.nome.toLowerCase())) continue;
      const partes = sp.nome === 'Pose' ? [] : def.partes.filter(p => sp.acha.test(p.nome)).map(p => p.id); if (sp.nome !== 'Pose' && !partes.length) continue;
      const s = { id: uid('s'), nome: sp.nome, partes, presets: sp.presets.map(nm => ({ id: uid('pr'), nome: nm, estado: {} })) }; def.sessoes.push(s); n++;
    }
    this.aba = 'sessoes'; this.commit(); UI.toast(n ? `${n} sessões criadas pelos nomes das partes, com presets vazios: clique em cada preset e monte.` : 'Dê nomes às partes (ex.: "Olho direito", "Boca", "Perna direita") para eu achar as sessões.', { kind: n ? 'ok' : 'warn', time: 6000 });
  },
  // preset novo = como as partes da sessão estão agora na tela
  async novoPreset(s, nome) {
    nome = nome || await UI.prompt({ title: `Preset novo em "${s.nome}"`, label: 'Nome (ex.: assustado, chutando)', ok: 'Criar' }); if (!nome) return;
    const est = this.estado(), partes = s.partes?.length ? s.partes : this.def.partes.map(p => p.id), estado = {};
    for (const pid of partes) { const p = this.parte(pid); if (!p) continue; const e = est[pid], b = p.base, d = {}; for (const c of ['img', 'x', 'y', 'r', 's', 'sx', 'vis']) if (e[c] !== b[c] && e[c] !== undefined) d[c] = e[c]; if (Object.keys(d).length) estado[pid] = d; }
    const pr = { id: uid('pr'), nome, estado }; s.presets.push(pr); this.edit = { s: s.id, p: pr.id }; this.aba = 'sessoes'; this.commit();
  },
  async presetIA(s) {
    const pedido = await UI.prompt({ title: `Preset com a IA em "${s.nome}"`, label: 'Descreva (ex.: "olhos de susto, bem abertos", "chutando para a frente")', ok: 'Criar', icon: 'sparkles', ia: true }); if (!pedido) return;
    const t = UI.toast('<span class="spin-dot"></span> A IA está montando o preset…', { time: 120000 });
    try { const pr = await IA.criarPreset(this.def, s, pedido); t.remove(); s.presets.push(pr); this.edit = { s: s.id, p: pr.id }; this.commit(); UI.toast(`Preset "${esc(pr.nome)}" criado. Confira e ajuste se precisar.`, { kind: 'ok' }); }
    catch (e) { t.remove(); UI.toast('A IA não conseguiu: ' + esc(e.message), { kind: 'err' }); }
  },
  menuSessao(e, s) {
    UI.ctx(e.clientX, e.clientY, [
      { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome da sessão', value: s.nome }); if (n) { s.nome = n; this.commit(); } } },
      { label: 'Escolher as partes', icon: 'layers', action: async () => { const body = h(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${this.def.partes.map(p => `<label class="chk"><input type="checkbox" value="${p.id}" ${(s.partes || []).includes(p.id) ? 'checked' : ''}> ${esc(p.nome)}</label>`).join('')}</div>`);
        const r = await UI.modal({ title: `Partes de "${s.nome}"`, body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Pronto', kind: 'primary', collect: a => $$('input:checked', a.body).map(i => i.value) }] }); if (r) { s.partes = r; this.commit(); } } },
      '-', { label: 'Apagar a sessão', icon: 'trash', danger: true, action: async () => { if (await UI.confirm({ title: `Apagar "${esc(s.nome)}" e os presets dela?`, ok: 'Apagar', danger: true })) { this.def.sessoes = this.def.sessoes.filter(x => x !== s); if (this.edit?.s === s.id) this.edit = null; this.commit(); } } },
    ]);
  },
  menuPreset(e, s, pr) {
    UI.ctx(e.clientX, e.clientY, [
      { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome do preset', value: pr.nome }); if (n) { pr.nome = n; this.commit(); } } },
      { label: 'Duplicar', icon: 'dup', action: () => { const c = clone(pr); c.id = uid('pr'); c.nome += ' 2'; s.presets.splice(s.presets.indexOf(pr) + 1, 0, c); this.edit = { s: s.id, p: c.id }; this.commit(); } },
      { label: 'Voltar à base (limpar)', icon: 'undo', action: () => { pr.estado = {}; this.commit(); } },
      '-', { label: 'Apagar', icon: 'trash', danger: true, action: () => { s.presets = s.presets.filter(x => x !== pr); if (this.edit?.p === pr.id) this.edit = null; this.commit(); } },
    ]);
  },

  /* ---------- salvar na nuvem da equipe ---------- */
  async salvar() {
    const def = this.def; if (!def.partes.length) return UI.toast('Ponha pelo menos uma parte antes de salvar.', { kind: 'warn' });
    def.thumb = this.miniatura(); const t = UI.toast('<span class="spin-dot"></span> <span data-p>Salvando na nuvem…</span>', { time: 600000 });
    try { await Nuvem.salvar(def, txt => { const e = t.querySelector('[data-p]'); if (e) e.textContent = txt; }); t.remove(); this.sujo = false; this.ultimo = JSON.stringify(def); this.pinta();
      if (App.P?.personagens?.[def.id]) { App.P.personagens[def.id] = clone(def); App.commit('Personagem atualizado'); }
      try { new BroadcastChannel('animador').postMessage({ tipo: 'personagem', def: JSON.parse(JSON.stringify(def)) }); } catch { } // avisa as outras abas (a animação aberta atualiza o personagem)
      UI.toast(`<b>${esc(def.nome)}</b> salvo na nuvem da equipe (pasta "${esc(def.pasta)}").`, { kind: 'ok' }); }
    catch (e) { t.remove(); UI.toast('Não salvou: ' + esc(e.message), { kind: 'err', time: 7000 }); }
  },
  miniatura() {
    const est = Modelo.partesNoEstado(this.def, {}), b = Modelo.caixaPersonagem(this.def, est), S = 160, k = Math.min(S / b.w, S / b.h) * .92, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), base = new DOMMatrix().translate(S / 2, S / 2).scale(k).translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
    for (const it of Modelo.montar(this.def, est)) { if (!it.img) continue; const bm = Arq.img.get(it.img.k); if (!bm) continue; x.setTransform(base.multiply(it.m)); x.drawImage(bm, -(it.img.pivo?.x ?? it.img.w / 2) + (it.img.ajuste?.x || 0), -(it.img.pivo?.y ?? it.img.h / 2) + (it.img.ajuste?.y || 0), it.img.w, it.img.h); }
    return c.toDataURL('image/png');
  },
};
addEventListener('keyup', e => { if (e.key === ' ') Atelie.espaco = false; });

/* ---------- escolher um personagem da biblioteca da equipe ---------- */
const Biblioteca = {
  async escolher() {
    const body = h('<div><div class="vazio"><span class="spin-dot"></span> Carregando a biblioteca da equipe…</div></div>');
    let escolhido = null;
    const p = UI.modal({ title: 'Pôr um personagem', icon: 'layers', width: 640, body, buttons: [{ label: 'Criar personagem novo', left: true, onClick: () => { setTimeout(() => Atelie.abrirAba(null), 50); return true; } }, { label: 'Cancelar', value: null }] });
    try {
      const lista = await Nuvem.lista(); if (!lista.length) body.innerHTML = '<div class="vazio">Nenhum personagem na biblioteca ainda. Crie o primeiro no Ateliê.</div>';
      else { body.innerHTML = ''; const pastas = [...new Set(lista.map(x => x.pasta))];
        for (const pa of pastas) { body.appendChild(Home.tituloPasta(pa)); const g = h('<div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))"></div>');
          for (const it of lista.filter(x => x.pasta === pa)) { const c = h(`<div class="pc"><div class="th" style="aspect-ratio:1;${it.thumb ? `background-image:url('${it.thumb}')` : ''}"></div><div class="in"><b>${esc(it.nome)}</b></div></div>`);
            const selo = Autores.selo(it); if (selo) c.appendChild(selo);
            c.onclick = async () => { c.style.opacity = .5; try { escolhido = await Nuvem.abrir(it.id); } catch (e) { UI.toast(esc(e.message), { kind: 'err' }); } $('#modal-root .modal-back [data-x]')?.click(); }; g.appendChild(c); }
          body.appendChild(g); } }
    } catch (e) { body.innerHTML = `<div class="vazio">Não consegui abrir a biblioteca: ${esc(e.message)}</div>`; }
    await p; return escolhido;
  },
};
