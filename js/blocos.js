/* ===================== blocos.js — ANIMAÇÕES EM BLOCOS (pedido da dona, 10/11/2026) =====================
   Só em ANIMAÇÃO NOVA (P.rive). Animação antiga não tem n.blocos e passa direto por tudo daqui, sem mudar nada.
   Cada animação do personagem (Andar, Acenar, Falar…) vira UM BLOCO na trilha do personagem, na timeline do modo Vídeo
   (a do Premiere, js/premiere.js), em vez de dezenas de chaves:
     n.blocos = [{ id, anim, nome, vista, q, reps, fpp, o, pas }]
       q = quadro em que começa · reps = repetições (pode ser quebrada) · fpp = quadros por passo · o = passo em que o ciclo começa
       pas = passagem suave ao ENTRAR (quadros), só quando encosta no bloco de antes · vista = vista em que o bloco põe o personagem
   O bloco NÃO grava chaves. Na hora de desenhar, Modelo.estadoPersonagem e Rig.tween enxergam as "chaves do bloco"
   (calculadas na memória, iguais às que o Animacoes.escreve gravaria) POR BAIXO das chaves de verdade: a chave de verdade ganha.
   Na timeline: V mexe/apara (voltas inteiras; Alt = passo a passo), R (alongamento de taxa) muda a velocidade, C corta sem pulo,
   a caixa roxa no corte é a passagem suave, dois cliques abrem o quadro a quadro (modo Animação) no começo do bloco. */
'use strict';
const Blocos = {
  PAS: 8,
  sel: null, // { no, b } = id da camada e do bloco escolhidos na timeline
  _v: new WeakMap(), _no: new WeakMap(),
  nm(x) { return String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); },
  ativo(n) { return !!(n && !n._virt && n.tipo === 'personagem' && n.blocos?.length); },
  ordena(n) { (n.blocos ||= []).sort((a, b) => a.q - b.q); return n.blocos; },
  // a animação de teste do bloco (na vista dele; se não tiver, em qualquer vista)
  anim(P, n, b) {
    const def0 = P?.personagens?.[n.ref]; if (!def0) return null;
    const acha = d => (d?.animacoes || []).find(x => x.id === b.anim) || (d?.animacoes || []).find(x => this.nm(x.nome) === this.nm(b.nome));
    let a = acha(Modelo.naVista(def0, b.vista)); if (a) return a;
    for (const v of def0.vistas || []) { a = acha(Modelo.naVista(def0, v.id)); if (a) return a; }
    return acha(def0) || null;
  },
  maior(a) { const t = (a?.trilhas || []).filter(t => t.length); return t.length ? Math.max(...t.map(t => t.length)) : 1; },
  passos(P, n, b) { return Math.max(1, Math.round((+b.reps || 1) * this.maior(this.anim(P, n, b)))); },
  fim(P, n, b) { return b.q + this.passos(P, n, b) * b.fpp; }, // quadro da chave "volta ao normal" (o último quadro do bloco é fim - 1)
  encosta(P, n, a, b) { return !!(a && b && b.q - this.fim(P, n, a) < Math.max(1, a.fpp)); }, // um buraco menor que um passo (sobra do corte por passos) conta como encostado

  /* ---------- as chaves do bloco (só na memória) ---------- */
  virtuais(P, n) {
    const def0 = P.personagens[n.ref], sig = JSON.stringify(n.blocos) + '|' + n.ref + '|' + (def0?.modificado || 0) + '|' + (def0?._vista || '');
    const c = this._v.get(n); if (c && c.sig === sig) return c.V;
    const V = {}, L = [...n.blocos].sort((a, b) => a.q - b.q); let mexeAntes = null;
    L.forEach((b, i) => {
      const a = this.anim(P, n, b), trilhas = (a?.trilhas || []).filter(t => t.length); if (!trilhas.length) { mexeAntes = null; return; }
      const N = this.passos(P, n, b), f = this.fim(P, n, b), ant = L[i - 1], prox = L[i + 1];
      const pIni = this.encosta(P, n, ant, b) ? (+b.pas || 0) / 2 : 0, pFim = this.encosta(P, n, b, prox) ? (+prox.pas || 0) / 2 : 0;
      const mexe = new Set(); for (const t of trilhas) for (const p of t) Object.keys(p.p || {}).forEach(x => mexe.add(x));
      let qs = []; for (let i2 = 0; i2 < N; i2++) qs.push(i2);
      const fica = qs.filter(i2 => { const q = b.q + i2 * b.fpp; return q >= b.q + pIni && q <= f - pFim; }); // a passagem tira as chaves perto do corte
      qs = fica.length ? fica : [Math.floor(N / 2)];
      qs.forEach((i2, j) => {
        const q = b.q + i2 * b.fpp, s = (+b.o || 0) + i2, k = { sessoes: {}, partes: {} };
        for (const t of trilhas) { const p = t[s % t.length]; Object.assign(k.sessoes, p.s || {}); for (const [pid, e] of Object.entries(p.p || {})) k.partes[pid] = { ...(e.img ? { img: e.img } : {}), r: e.r || 0, x: e.x || 0, y: e.y || 0, ...(e.d ? { d: e.d } : {}), ...(e.ap ? { ap: e.ap } : {}), ...(e.z != null ? { z: e.z } : {}) }; }
        if (!Object.keys(k.sessoes).length) delete k.sessoes; if (!Object.keys(k.partes).length) delete k.partes;
        if (j === 0 && b.vista) k.vista = b.vista;
        if (j === 0 && pIni >= 0 && mexeAntes && this.encosta(P, n, ant, b)) for (const pid of mexeAntes) if (!mexe.has(pid)) (k.partes ||= {})[pid] = null; // o que só o bloco de antes mexia volta ao normal na passagem
        V[q] = k;
      });
      mexeAntes = mexe;
      if (!this.encosta(P, n, b, prox) && mexe.size) { const kf = V[f] || (V[f] = {}); kf.partes = { ...(kf.partes || {}) }; for (const pid of mexe) kf.partes[pid] = null; } // no fim, as partes voltam ao normal (como o escreve)
    });
    this._v.set(n, { sig, V }); return V;
  },
  junta(v, r) { if (!v) return r; if (!r) return v; const o = { ...v, ...r }; if (v.partes && r.partes) o.partes = { ...v.partes, ...r.partes }; if (v.sessoes && r.sessoes) o.sessoes = { ...v.sessoes, ...r.sessoes }; return o; },
  // a camada vista "com as chaves do bloco por baixo" (só para ler; quem grava continua gravando na camada de verdade)
  no(P, n) {
    let c = this._no.get(n); const V = this.virtuais(P, n);
    if (!c) { c = { V };
      const ch = new Proxy({}, {
        get: (_, k) => typeof k === 'symbol' ? undefined : this.junta(c.V[k], n.chaves?.[k]),
        has: (_, k) => k in c.V || !!(n.chaves && k in n.chaves),
        ownKeys: () => [...new Set([...Object.keys(n.chaves || {}), ...Object.keys(c.V)])],
        getOwnPropertyDescriptor: (_, k) => (k in c.V || (n.chaves && k in n.chaves)) ? { value: undefined, enumerable: true, configurable: true, writable: true } : undefined,
        set: () => true });
      c.node = new Proxy(n, { get: (t, k) => k === 'chaves' ? ch : k === '_virt' ? true : t[k] });
      this._no.set(n, c); }
    c.V = V; return c.node;
  },
  liga() {
    if (this._ok || typeof Modelo === 'undefined' || typeof Rig === 'undefined') return; this._ok = true;
    const ep0 = Modelo.estadoPersonagem; Modelo.estadoPersonagem = function (n, q) { return Blocos.ativo(n) && App.P?.personagens?.[n.ref] ? ep0.call(this, Blocos.no(App.P, n), q) : ep0.call(this, n, q); };
    const tw0 = Rig.tween; Rig.tween = function (P, n, q, dv, ep) { return Blocos.ativo(n) && P?.personagens?.[n.ref] ? tw0.call(this, P, Blocos.no(P, n), q, dv, ep) : tw0.call(this, P, n, q, dv, ep); };
    this.ligaTL(); this.ligaFolha(); this.ligaIA();
  },

  /* ---------- mexer nos blocos ---------- */
  cor(b) { const R = (typeof TLP !== 'undefined' && TLP.ROT) || [['#7d8fe0']]; let h = 0; for (const ch of String(b.nome || b.anim)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return R[h % R.length][0]; },
  achaNo(id) { return App.P && Modelo.todos(App.P).find(x => x.id === id) || null; },
  escolhido() { const s = this.sel, n = s && this.achaNo(s.no), b = n?.blocos?.find(x => x.id === s.b); return b ? { n, b } : null; },
  // pôr uma animação como bloco (o "Pôr na animação" e a ação animacao da IA, via Animacoes.escreve)
  poe(n, a, q0, fpp, reps, o = {}) {
    const P = App.P, vista = o.vista !== undefined ? o.vista : Modelo.estadoPersonagem(n, q0).vista || null;
    const b = { id: uid('bl'), anim: a.id, nome: a.nome, vista, q: Math.max(0, Math.round(q0)), reps: +reps > 0 ? +reps : 1, fpp: clamp(Math.round(+fpp || 1), 1, 48), o: 0, pas: this.PAS };
    b.reps = this.passos(P, { ...n, blocos: [b] }, b) / this.maior(a); // passos inteiros
    this.sobrescreve(P, n, b); (n.blocos ||= []).push(b); this.ordena(n); if (n.suaveP == null) n.suaveP = true;
    const f = this.fim(P, n, b); if (P.duracao < f + 1) P.duracao = f + 1; return f;
  },
  // o bloco novo vai POR CIMA (como o Premiere ao soltar um clipe): o de baixo é cortado e o pedaço coberto some
  sobrescreve(P, n, b) {
    const ini = b.q, f = this.fim(P, n, b), novos = []; n.blocos ||= [];
    for (const o of [...(n.blocos || [])]) { const of = this.fim(P, n, o); if (of <= ini || o.q >= f) continue;
      const mai = this.maior(this.anim(P, n, o)), N = this.passos(P, n, o);
      if (of > f) { const k = Math.ceil((f - o.q) / o.fpp); if (k < N) novos.push({ ...o, id: uid('bl'), q: o.q + k * o.fpp, o: ((+o.o || 0) + k) % mai, reps: (N - k) / mai, pas: 0 }); }
      const k0 = Math.floor((ini - o.q) / o.fpp); if (k0 >= 1) o.reps = k0 / mai; else n.blocos.splice(n.blocos.indexOf(o), 1); }
    n.blocos.push(...novos);
  },
  apaga(n, b) { n.blocos = n.blocos.filter(x => x !== b); if (!n.blocos.length) delete n.blocos; if (this.sel?.b === b.id) this.sel = null; App.commit('Apagar bloco'); },
  duplica(n, b) { const P = App.P, c = { ...b, id: uid('bl'), q: this.fim(P, n, b) }; this.empurra(P, n, c); n.blocos.push(c); this.ordena(n); const f = this.fim(P, n, c); if (P.duracao < f + 1) P.duracao = f + 1; this.sel = { no: n.id, b: c.id }; App.commit('Duplicar bloco'); },
  // o que vem depois anda para a frente até caber (duplicar)
  empurra(P, n, c) { let fimC = this.fim(P, n, c); for (const o of this.ordena(n)) { if (o === c || o.q < c.q) continue; if (o.q < fimC) { o.q = fimC; } fimC = Math.max(fimC, this.fim(P, n, o)); } },
  // TRANSFORMAR EM CHAVES: o bloco vira as chaves de antes (para mexer quadro a quadro); a chave de verdade que já existia ganha
  emChaves(n, b) {
    const P = App.P, V = this.virtuais(P, n), f = this.fim(P, n, b); n.chaves ||= {};
    for (const [k, v] of Object.entries(V)) { const q = +k; if (q < b.q || q > f) continue; n.chaves[q] = this.junta(v, n.chaves[q]); }
    n.blocos = n.blocos.filter(x => x !== b); if (!n.blocos.length) delete n.blocos; this.sel = null; App.commit('Transformar o bloco em chaves');
  },
  async controles(n, b) {
    const P = App.P, a = this.anim(P, n, b), mai = this.maior(a);
    const body = h(`<div><label class="field">Repetições<input type="number" min="0.1" max="200" step="0.25" value="${round(b.reps, 2)}" data-r></label>
      <label class="field">Velocidade (quadros por passo; menos = mais rápido)<input type="number" min="1" max="48" value="${b.fpp}" data-f></label>
      <label class="field">Passagem suave ao entrar (quadros; só quando encosta no bloco de antes)<input type="number" min="0" max="48" value="${b.pas ?? this.PAS}" data-p></label>
      <div style="color:var(--tx3);font-size:12px">${esc(a?.nome || b.nome)}: ${mai} passo${mai === 1 ? '' : 's'} por volta.</div></div>`);
    const r = await UI.modal({ title: `Bloco "${b.nome}"`, icon: 'film', metro: true, body, buttons: [{ label: 'Cancelar', value: null }, { label: 'OK', kind: 'primary', collect: x => ({ r: +$('[data-r]', x.body).value, f: +$('[data-f]', x.body).value, p: +$('[data-p]', x.body).value }) }] });
    if (!r) return; b.fpp = clamp(Math.round(r.f || b.fpp), 1, 48); b.reps = Math.max(1, Math.round(clamp(r.r || b.reps, .01, 200) * mai)) / mai; b.pas = clamp(Math.round(r.p || 0), 0, 48);
    this.empurra(P, n, b); const f = this.fim(P, n, b); if (P.duracao < f + 1) P.duracao = f + 1; App.commit('Controles do bloco');
  },

  /* ---------- timeline do modo Vídeo (js/premiere.js) ---------- */
  // onde os blocos ficam dentro do clipe do personagem (embaixo da faixa do nome)
  area(r) { const top = TLP.RG + r.y - TLP.sy + 1, hh = r.h - 3, faixa = hh >= 26 ? 14 : 0; return { y0: top + faixa, y1: top + hh, top }; },
  pega(p) {
    const cl = p.clip; if (!cl || cl.k !== 'n' || !this.ativo(cl.n) || !p.row) return null; const P = App.P, n = cl.n, A = this.area(p.row); if (p.y < A.y0 || p.y > A.y1) return null;
    const L = this.ordena(n);
    for (let i = 0; i < L.length; i++) { const b = L[i], prox = L[i + 1]; if (!this.encosta(P, n, b, prox) || !prox.pas) continue; const xc = TLP.q2x(prox.q), w = Math.max(6, prox.pas * TLP.pxq) / 2; if (Math.abs(p.x - xc) <= w && Math.abs(p.x - xc) > 4) return { n, b: prox, zona: 'pas', A }; }
    for (const b of L) { const x0 = TLP.q2x(b.q), x1 = TLP.q2x(this.fim(P, n, b)); if (p.x < x0 - 3 || p.x > x1 + 3) continue; const bd = Math.min(7, (x1 - x0) / 4);
      return { n, b, A, zona: p.x - x0 < bd ? 'ini' : x1 - p.x < bd ? 'fim' : 'meio' }; }
    return null;
  },
  desenhaTL(c, cl, y, h, W) {
    const P = App.P, n = cl.n, top = y + 1, hh = h - 3, faixa = hh >= 26 ? 14 : 0, y0 = top + faixa, bh = hh - faixa, cx0 = TLP.q2x(cl.de), cx1 = TLP.q2x(cl.fim + 1), L = this.ordena(n); if (bh < 6) return;
    c.save(); c.beginPath(); c.rect(cx0, y0, cx1 - cx0, bh); c.clip(); c.font = '10px Segoe UI'; c.textBaseline = 'top';
    for (const b of L) {
      const x0 = TLP.q2x(b.q), x1 = TLP.q2x(this.fim(P, n, b)), w = x1 - x0; if (x1 < 0 || x0 > W) continue; const cor = this.cor(b), [r0, g0, b0] = hexToRgb(cor), sel = this.sel?.b === b.id;
      const mix = (k, t) => `rgb(${Math.round(r0 + (k - r0) * t)},${Math.round(g0 + (k - g0) * t)},${Math.round(b0 + (k - b0) * t)})`;
      c.fillStyle = sel ? mix(255, .25) : mix(0, .12); c.fillRect(x0, y0, w, bh);
      const mai = this.maior(this.anim(P, n, b)), passo = b.fpp * TLP.pxq; c.fillStyle = 'rgba(0,0,0,.28)'; // onde cada volta termina
      if (passo * mai > 5) for (let s = mai - ((+b.o || 0) % mai); s < this.passos(P, n, b); s += mai) c.fillRect(Math.round(x0 + s * passo), y0 + 2, 1, bh - 2);
      const i = L.indexOf(b), xt = x0 + 4 + (this.encosta(P, n, L[i - 1], b) && b.pas ? Math.max(4, b.pas * TLP.pxq) / 2 : 0); // o nome começa depois da caixa da passagem
      if (x1 - xt > 18) { c.fillStyle = sel ? '#000' : '#0b0b0b'; c.fillText(b.nome || '', xt, y0 + 2); }
      if (w > 60 && bh >= 18) { const t = `× ${String(round(b.reps, 2)).replace('.', ',')}`; c.fillText(t, x1 - 4 - c.measureText(t).width, y0 + 2); }
      c.strokeStyle = sel ? '#fff' : 'rgba(0,0,0,.55)'; c.lineWidth = 1; c.strokeRect(Math.round(x0) + .5, y0 + .5, Math.max(1, Math.round(w) - 1), bh - 1);
    }
    // passagem suave no corte: caixa roxa com a diagonal, como a "Dissolução cruzada"
    for (let i = 0; i < L.length - 1; i++) { const a = L[i], b = L[i + 1]; if (!this.encosta(P, n, a, b) || !b.pas) continue; const tw = Math.max(4, b.pas * TLP.pxq), tx = TLP.q2x(b.q) - tw / 2;
      c.fillStyle = 'rgba(140,125,200,.9)'; c.fillRect(tx, y0, tw, bh); c.strokeStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.moveTo(tx, y0 + bh); c.lineTo(tx + tw, y0); c.stroke(); c.strokeRect(tx + .5, y0 + .5, tw - 1, bh - 1);
      if (tw > 80 && bh >= 14) { c.fillStyle = '#111'; c.fillText('Passagem suave', tx + 4, y0 + 2); } }
    // chaves de ajuste (as de verdade) por cima
    if (!TLP.pref.semChaves) { c.fillStyle = 'rgba(255,255,255,.85)'; const yk = y0 + bh - 4; for (const k of Object.keys(n.chaves || {}).map(Number)) { if (k < cl.de || k > cl.fim) continue; const kx = TLP.q2x(k + .5); c.beginPath(); c.moveTo(kx, yk - 3); c.lineTo(kx + 3, yk); c.lineTo(kx, yk + 3); c.lineTo(kx - 3, yk); c.fill(); } }
    c.restore();
  },
  ligaTL() {
    if (typeof TLP === 'undefined') return; const T = TLP, B = this;
    const al0 = T.alt; T.alt = function (k) { const a = al0.call(this, k); return !this.pref.alt?.[k] && App.P?.rive && k[0] === 'v' && this.L?.v?.some(c => 'v' + c.tr === k && B.ativo(c.n)) ? Math.max(a, 60) : a; }; // trilha com blocos já nasce mais alta
    const bl0 = T.bloco; T.bloco = function (c, cl, x0, x1, y, h, W) { bl0.apply(this, arguments); if (cl.k === 'n' && B.ativo(cl.n)) try { B.desenhaTL(c, cl, y, h, W); } catch (e) { console.warn('[Blocos]', e); } };
    const botao = () => { if (!T.el || $('[data-f="taxa"]', T.el)) return; const f = $('.pr-ferr', T.el), bt = h(`<button class="pr-f pr-f-taxa" data-f="taxa" title="Ferramenta Alongamento de taxa (R): puxar a ponta de um bloco de animação muda a velocidade, não as repetições">${ic('clock', 15)}</button>`); bt.onclick = () => T.setFerr('taxa'); f?.appendChild(bt); };
    const li0 = T.liga; T.liga = function (...x) { const r = li0.apply(this, x); if (r) botao(); return r; }; botao();
    const cu0 = T.cursor; T.cursor = function (e) { if (this.ferr === 'sel' || this.ferr === 'taxa' || this.ferr === 'navalha') { const p = this.ponto(e), z = !p.regua && B.pega(p); if (z) { this.cv.style.cursor = this.ferr === 'navalha' ? 'crosshair' : z.zona === 'pas' || z.zona === 'ini' || z.zona === 'fim' ? (this.ferr === 'taxa' && z.zona !== 'pas' ? 'col-resize' : 'ew-resize') : 'grab'; return; } if (this.ferr === 'taxa') { this.cv.style.cursor = ''; return; } } return cu0.call(this, e); };
    const de0 = T.desce; T.desce = function (e) {
      if (!App.P) return de0.call(this, e); const p = this.ponto(e), z = (e.button === 0 || e.button === 2) && !p.regua && ['sel', 'taxa', 'navalha', 'ondula'].includes(this.ferr) && B.pega(p);
      if (!z) { if (B.sel && e.button === 0) { B.sel = null; } return de0.call(this, e); }
      if (this.travada(p.clip)) return UI.toast(`A trilha ${p.clip.lado.toUpperCase()}${p.clip.tr} está bloqueada (cadeado no cabeçalho)`);
      this.foco = true; this.pintaFoco(); B.sel = { no: z.n.id, b: z.b.id }; if (!this.sel.has(p.clip.id)) this.escolhe([p.clip.id]); else this.desenha();
      if (e.button !== 0) return;
      return B.arrasta(e, p, z);
    };
    const du0 = T.duplo; T.duplo = function (e) { const p = this.ponto(e), z = !p.regua && B.pega(p); if (!z || z.zona === 'pas') return du0.call(this, e);
      App.setQ(z.b.q); Folha.setModo('anim'); App.selecionar(z.n.id); UI.toast(`Dentro do bloco "${esc(z.b.nome)}": o que mudar aqui vira chave de ajuste por cima do bloco. "Voltar ao vídeo" sai.`, { time: 5000 }); };
    const me0 = T.menu; T.menu = function (e) { const p = this.ponto(e), z = !p.regua && B.pega(p); if (!z) return me0.call(this, e); const { n, b } = z;
      UI.ctx(e.clientX, e.clientY, [{ head: `${b.nome} · ${this.tc(b.q)}` },
        { label: 'Controles do bloco…', icon: 'edit', action: () => B.controles(n, b) },
        { label: 'Duplicar logo depois', icon: 'copy', action: () => B.duplica(n, b) },
        { label: 'Abrir quadro a quadro', icon: 'film', action: () => { App.setQ(b.q); Folha.setModo('anim'); App.selecionar(n.id); } },
        { label: 'Transformar em chaves', icon: 'split', action: () => B.emChaves(n, b) },
        { label: 'Apagar', icon: 'trash', key: 'Delete', action: () => B.apaga(n, b) }]); };
    const te0 = T.tecla; T.tecla = function (e) {
      if (e.type === 'keydown' && Folha.modo === 'video' && this.el && App.P && this.foco && !e.target.closest?.('input,textarea,select,[contenteditable]') && !$('#modal-root')?.children.length && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const s = B.escolhido(); if (s && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); e.stopImmediatePropagation(); return B.apaga(s.n, s.b); }
        if (App.P.rive && e.key.toLowerCase() === 'r' && !e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); return this.setFerr('taxa'); } }
      return te0.call(this, e); };
  },
  // arrastar um bloco: mover (V), aparar (V nas pontas), velocidade (R nas pontas), cortar (C) ou a passagem
  arrasta(e, p, z) {
    const P = App.P, T = TLP, n = z.n, b = z.b, b0 = { ...b }, x0 = p.x, mai = this.maior(this.anim(P, n, b)), N0 = this.passos(P, n, b), f0 = this.fim(P, n, b0);
    const viz = () => { const L = this.ordena(n), i = L.indexOf(b); return { ant: L[i - 1], prox: L[i + 1] }; };
    const pinta = () => { T.desenha(); App.pinta(); }, fim = () => { T.encaixe = null; if (JSON.stringify(b) !== JSON.stringify(b0)) { const f = this.fim(P, n, b); if (P.duracao < f + 1) P.duracao = f + 1; App.commit('Bloco de animação'); } else T.desenha(); };
    if (T.ferr === 'navalha') { // LÂMINA: corta num passo; o segundo pedaço continua o ciclo de onde o primeiro parou (sem pulo)
      const k = Math.round((p.q - b.q) / b.fpp); if (k < 1 || k >= N0) return; const c = { ...b, id: uid('bl'), q: b.q + k * b.fpp, o: ((+b.o || 0) + k) % mai, reps: (N0 - k) / mai, pas: 0 };
      b.reps = k / mai; n.blocos.push(c); this.ordena(n); this.sel = { no: n.id, b: c.id }; return App.commit('Cortar bloco'); }
    if (z.zona === 'pas') { const p0 = +b.pas || 0; return T.arrastar(e, pp => { b.pas = clamp(Math.round(p0 + (pp.x - x0) / T.pxq * 2), 2, 48); pinta(); }, fim); }
    const dq = pp => Math.round((pp.x - x0) / T.pxq);
    if ((z.zona === 'ini' || z.zona === 'fim') && T.ferr === 'taxa') { // ALONGAMENTO DE TAXA: as repetições ficam, a velocidade muda
      return T.arrastar(e, pp => { const { ant, prox } = viz(), alvo = z.zona === 'fim' ? (f0 - b0.q) + dq(pp) : (f0 - b0.q) - dq(pp); b.fpp = clamp(Math.round(alvo / N0), 1, 48);
        if (z.zona === 'ini') { b.q = f0 - N0 * b.fpp; if (ant && b.q < this.fim(P, n, ant)) { b.fpp = Math.max(1, Math.floor((f0 - this.fim(P, n, ant)) / N0)); b.q = f0 - N0 * b.fpp; } if (b.q < 0) { b.fpp = Math.max(1, Math.floor(f0 / N0)); b.q = f0 - N0 * b.fpp; } }
        else if (prox && this.fim(P, n, b) > prox.q) b.fpp = Math.max(1, Math.floor((prox.q - b.q) / N0));
        pinta(); }, fim); }
    if (z.zona === 'fim') return T.arrastar(e, (pp, ev) => { const { prox } = viz(); let N = Math.max(1, Math.round((f0 - b0.q + dq(pp)) / b.fpp)); if (!ev.altKey) N = Math.max(mai, Math.round(N / mai) * mai);
      if (prox) { const lim = Math.floor((prox.q - b.q) / b.fpp); if (N > lim) N = Math.max(1, ev.altKey ? lim : Math.floor(lim / mai) * mai || lim); }
      b.reps = N / mai; pinta(); }, fim);
    if (z.zona === 'ini') return T.arrastar(e, (pp, ev) => { const { ant } = viz(); let N = Math.max(1, Math.round((f0 - b0.q - dq(pp)) / b.fpp)); if (!ev.altKey) N = Math.max(mai, Math.round(N / mai) * mai);
      const lim = Math.floor((f0 - (ant ? this.fim(P, n, ant) : 0)) / b.fpp); if (N > lim) N = Math.max(1, ev.altKey ? lim : Math.floor(lim / mai) * mai || lim);
      b.reps = N / mai; b.q = f0 - N * b.fpp; b.o = (((+b0.o || 0) - (N - N0)) % mai + mai) % mai; pinta(); }, fim); // o que já estava na tela fica no mesmo lugar
    // mover: encaixa nas pontas dos vizinhos e na agulha; não passa por cima de outro bloco
    const dur = f0 - b0.q, tol = 8 / T.pxq;
    return T.arrastar(e, pp => { let q = Math.max(0, b0.q + dq(pp)); T.encaixe = null;
      const pts = [App.q]; for (const o of n.blocos) if (o !== b) pts.push(o.q, this.fim(P, n, o));
      if (T.ima) { let best = null; for (const s of pts) for (const d of [s - q, s - (q + dur)]) if (Math.abs(d) < tol && (best == null || Math.abs(d) < Math.abs(best))) best = d; if (best != null) { q += best; T.encaixe = pts.includes(q) ? q : q + dur; } }
      const bate = q => n.blocos.find(o => o !== b && q < this.fim(P, n, o) && q + dur > o.q);
      const o = bate(q); if (o) { const enc = q < b.q ? this.fim(P, n, o) : o.q - dur; if (enc >= 0 && !bate(enc)) { q = enc; T.encaixe = q < b.q ? q : q + dur; } else q = null; } // bateu no vizinho: encosta nele
      if (q != null && q >= 0) b.q = q; pinta(); }, fim);
  },

  /* ---------- modo Animação (dentro do bloco): uma faixa fina embaixo da linha do personagem mostra onde está cada bloco ---------- */
  ligaFolha() {
    if (typeof Folha === 'undefined' || !Folha.linhaNo) return; const B = this, l0 = Folha.linhaNo;
    Folha.linhaNo = function (c, P, n, y, sx, sel) { const r = l0.apply(this, arguments); if (B.ativo(n)) try { const CW = this.CW;
      for (const b of B.ordena(n)) { const x0 = b.q * CW - sx, x1 = B.fim(P, n, b) * CW - sx; c.fillStyle = B.cor(b); c.fillRect(x0 + 1, y + this.RH - 6, Math.max(1, x1 - x0 - 2), 3); } } catch { } return r; };
  },

  /* ---------- IA e Plano ---------- */
  lista(P, n) { return this.ordena(n).map(b => ({ bloco: b.id, animacao: b.nome, de: b.q + 1, ate: this.fim(P, n, b), repeticoes: round(b.reps, 2), quadros_por_passo: b.fpp, passagem: b.pas ?? 0, vista: b.vista ? (P.personagens[n.ref]?.vistas || []).find(v => v.id === b.vista)?.nome : undefined })); },
  ligaIA() {
    if (typeof IA === 'undefined') return; const B = this;
    const cx0 = IA.contexto; IA.contexto = function (P) { const c = cx0.call(this, P); if (!P?.rive) return c; const nos = Modelo.todos(P);
      (c.camadas || []).forEach((cm, i) => { const n = nos[i]; if (n?.tipo === 'personagem' && n.blocos?.length) cm.blocos = B.lista(P, n); });
      c.blocos_de_animacao = 'Esta animação é NOVA: a ação "animacao" põe um BLOCO (não escreve chaves). Para mudar um bloco que já existe use a ação "bloco". As chaves de verdade ficam por cima dos blocos.'; return c; };
    const ap0 = IA.aplicar; IA.aplicar = function (acoes, foto) { const L = Array.isArray(acoes) ? acoes : []; const meus = L.filter(a => a?.tipo === 'bloco'); let n = ap0.call(this, L.filter(a => a?.tipo !== 'bloco'), foto); if (meus.length) { const m = B.daIA(meus); if (m) App.commit('IA: ' + m + ' blocos'); n += m; } return n; };
  },
  // {"tipo":"bloco","camada","bloco":"id ou nome da animação","perto":N, "quadro":N,"ate":N,"repeticoes":N,"quadros_por_passo":N,"passagem":N,"cortar_em":N,"apagar":true,"em_chaves":true}
  daIA(acoes) {
    const P = App.P; if (!P?.rive) return 0; let n = 0; const q1 = v => Math.max(0, Math.round(+v || 1) - 1);
    for (const a of acoes) { try {
      const no = IA.acha(Modelo.todos(P).filter(x => x.tipo === 'personagem'), a.camada); if (!no?.blocos?.length) continue;
      const cands = no.blocos.filter(b => b.id === a.bloco || this.nm(b.nome) === this.nm(a.bloco) || this.nm(b.nome) === this.nm(a.animacao)); if (!cands.length) continue;
      const perto = a.perto != null ? q1(a.perto) : null, b = perto == null ? cands[0] : cands.reduce((m, x) => Math.abs(x.q - perto) < Math.abs(m.q - perto) ? x : m);
      const mai = this.maior(this.anim(P, no, b));
      if (a.apagar) { no.blocos = no.blocos.filter(x => x !== b); if (!no.blocos.length) delete no.blocos; n++; continue; }
      if (a.em_chaves) { const V = this.virtuais(P, no), f = this.fim(P, no, b); no.chaves ||= {}; for (const [k, v] of Object.entries(V)) if (+k >= b.q && +k <= f) no.chaves[k] = this.junta(v, no.chaves[k]); no.blocos = no.blocos.filter(x => x !== b); if (!no.blocos.length) delete no.blocos; n++; continue; }
      if (a.cortar_em != null) { const N = this.passos(P, no, b), k = Math.round((q1(a.cortar_em) - b.q) / b.fpp); if (k >= 1 && k < N) { no.blocos.push({ ...b, id: uid('bl'), q: b.q + k * b.fpp, o: ((+b.o || 0) + k) % mai, reps: (N - k) / mai, pas: 0 }); b.reps = k / mai; n++; } continue; }
      if (+a.quadros_por_passo > 0) b.fpp = clamp(Math.round(+a.quadros_por_passo), 1, 48);
      if (a.quadro != null) b.q = q1(a.quadro);
      if (+a.ate > 0) b.reps = Math.max(1, Math.round((q1(a.ate) + 1 - b.q) / b.fpp)) / mai; else if (+a.repeticoes > 0) b.reps = Math.max(1, Math.round(+a.repeticoes * mai)) / mai;
      if (a.passagem != null) b.pas = clamp(Math.round(+a.passagem || 0), 0, 48);
      no.blocos = no.blocos.filter(x => x !== b); this.sobrescreve(P, no, b); no.blocos.push(b); this.ordena(no);
      const f = this.fim(P, no, b); if (P.duracao < f + 1) P.duracao = f + 1; n++;
    } catch (e) { console.warn('bloco da IA', a, e); } }
    return n;
  },
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Blocos.liga()); else Blocos.liga();
