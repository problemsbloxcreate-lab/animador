/* ===================== aovivo.js — TRABALHAR JUNTO AO VIVO (Ateliê e Animador) =====================
   Tempo real pelo Firebase Realtime Database (o mesmo projeto do login; endereço em TURMA_CONFIG.aoVivoUrl).
   • Quem está junto: cursor com a cor e o nome de cada um no palco + o que está fazendo; bolinhas no topo.
   • Mudanças: cada mudança vira uma lista de alterações por caminho (Difs.ops: listas com "id" são endereçadas pelo id),
     mandada para a sala e aplicada por todos NA MESMA ORDEM (chaves do Firebase). As minhas ainda não confirmadas (pendentes)
     ficam por cima até voltarem. Imagens/áudios novos sobem para a sala junto (arq/). Ctrl+Z desfaz só as MINHAS mudanças.
   • Ateliê: personagem da nuvem → entra sozinho na sala "at-<id>".
   • Animador: o arquivo não fica na nuvem; "Trabalhar junto" põe uma cópia TEMPORÁRIA na sala "an-<id>" (estado + arquivos).
     Quem abriu guarda a versão de antes como "(anterior)" (P.anterior). Ao sair, cada um fica com a cópia com as últimas
     mudanças; quando o último sai (ou quem abriu encerra), a sala é apagada da nuvem.
   Caminhos: aovivo/salas/<sala>/{snap, ops, gente, arq, meta} e aovivo/lista/<sala>. Transporte de teste: AoVivo.usaTransporte(AoVivoLocal). */
'use strict';
const Difs = {
  tipo(x) { return Array.isArray(x) ? 'arr' : x && typeof x === 'object' ? 'obj' : 'val'; },
  ehLista(a) { return Array.isArray(a) && a.every(x => x && typeof x === 'object' && !Array.isArray(x) && typeof x.id === 'string') && new Set(a.map(x => x.id)).size === a.length; },
  // alterações de a para b: [{ p: caminho, v?: valor (sem v = apaga) } | { p, ordem: [ids] }]
  ops(a, b, p = [], out = []) {
    if (a === b) return out; const ta = this.tipo(a), tb = this.tipo(b);
    if (ta === 'obj' && tb === 'obj') {
      for (const k of Object.keys(a)) if (!(k in b) || b[k] === undefined) { if (a[k] !== undefined) out.push({ p: [...p, k] }); }
      for (const k of Object.keys(b)) { if (b[k] === undefined) continue; if (!(k in a) || a[k] === undefined) out.push({ p: [...p, k], v: b[k] }); else this.ops(a[k], b[k], [...p, k], out); }
      return out;
    }
    if (ta === 'arr' && tb === 'arr' && (a.length || b.length) && this.ehLista(a) && this.ehLista(b) && (a.length && b.length)) {
      const ia = new Map(a.map(x => [x.id, x])), ib = new Map(b.map(x => [x.id, x]));
      for (const x of a) if (!ib.has(x.id)) out.push({ p: [...p, '#' + x.id] });
      b.forEach((x, i) => { if (!ia.has(x.id)) out.push({ p: [...p, '#' + x.id], v: x, i }); else this.ops(ia.get(x.id), x, [...p, '#' + x.id], out); });
      const restoA = a.filter(x => ib.has(x.id)).map(x => x.id), restoB = b.filter(x => ia.has(x.id)).map(x => x.id);
      if (restoA.join('\u0001') !== restoB.join('\u0001')) out.push({ p, ordem: b.map(x => x.id) });
      return out;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(b === undefined ? { p } : { p, v: b });
    return out;
  },
  // acha o lugar do caminho; cria objetos que faltam (só para chaves comuns)
  _vai(doc, seg, criar) { if (seg.startsWith('#')) { const id = seg.slice(1); return Array.isArray(doc) ? doc.find(x => x?.id === id) : undefined; } if (doc[seg] === undefined && criar) doc[seg] = {}; return doc[seg]; },
  aplica(doc, ops) {
    for (const op of ops || []) {
      const p = op.p || []; if (!p.length) { if ('v' in op) doc = JSON.parse(JSON.stringify(op.v)); continue; }
      let pai = doc; for (const s of p.slice(0, -1)) { if (pai == null) break; pai = this._vai(pai, s, 'v' in op); } if (pai == null) continue;
      const ult = p[p.length - 1];
      if (op.ordem) { const alvo = this._vai(pai, ult, false); if (Array.isArray(alvo)) { const pos = new Map(op.ordem.map((id, i) => [id, i])); alvo.sort((x, y) => (pos.has(x.id) ? pos.get(x.id) : 1e9) - (pos.has(y.id) ? pos.get(y.id) : 1e9)); } continue; }
      const v = 'v' in op ? JSON.parse(JSON.stringify(op.v)) : undefined;
      if (ult.startsWith('#')) { if (!Array.isArray(pai)) continue; const id = ult.slice(1), i = pai.findIndex(x => x?.id === id);
        if (v === undefined) { if (i >= 0) pai.splice(i, 1); } else if (i >= 0) pai[i] = v; else pai.splice(Math.min(op.i ?? pai.length, pai.length), 0, v); }
      else if (v === undefined) { if (Array.isArray(pai)) pai.splice(+ult, 1); else delete pai[ult]; } else pai[ult] = v;
    }
    return doc;
  },
};

/* ---------- transporte: Firebase Realtime Database ---------- */
const AoVivoFirebase = {
  db: null, offs: [],
  async abre() {
    if (this.db) return this; if (!TURMA_CONFIG.aoVivoUrl) throw new Error('o tempo real ainda não foi ligado');
    await TurmaAuth.gate(); if (!window.firebase?.database) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = TurmaAuth.SDK + 'firebase-database-compat.js'; s.onload = ok; s.onerror = () => no(new Error('não carregou o tempo real')); document.head.appendChild(s); });
    this.db = firebase.app().database(TURMA_CONFIG.aoVivoUrl); return this;
  },
  r(p) { return this.db.ref('aovivo/' + p); },
  agora() { return firebase.database.ServerValue.TIMESTAMP; },
  com(prom, ms = 9000) { return Promise.race([prom, new Promise((_, no) => setTimeout(() => no(new Error('o tempo real não respondeu (veja se o Realtime Database está ligado)')), ms))]); },
  async estado(sala) {
    const s = (await this.com(this.r(`salas/${sala}/snap`).once('value'))).val(), q = this.r(`salas/${sala}/ops`).orderByKey(), o = (await this.com((s?.ate ? q.startAt(s.ate) : q).once('value'))).val() || {};
    return { snap: s, gente: (await this.r(`salas/${sala}/gente`).once('value')).val() || {}, meta: (await this.r(`salas/${sala}/meta`).once('value')).val(), ops: Object.keys(o).sort().filter(k => k !== s?.ate).map(k => ({ k, ...o[k] })) };
  },
  setSnap(sala, s) { return this.r(`salas/${sala}/snap`).set(s); },
  setMeta(sala, m) { return Promise.all([this.r(`salas/${sala}/meta`).update(m), this.r(`lista/${sala}`).update({ ...m, em: this.agora() })]); },
  ouvirMeta(sala, cb) { const r = this.r(`salas/${sala}/meta`); r.on('value', s => cb(s.val() || {})); this.offs.push(() => r.off()); },
  ouvirOps(sala, depois, cb) { let q = this.r(`salas/${sala}/ops`).orderByKey(); if (depois) q = q.startAt(depois); q.on('child_added', s => { if (s.key !== depois) cb({ k: s.key, ...s.val() }); }); this.offs.push(() => q.off()); },
  enviar(sala, op) { const ref = this.r(`salas/${sala}/ops`).push(); ref.set({ ...op, t: this.agora() }); return ref.key; },
  presenca(sala, id, d, primeira) { const g = this.r(`salas/${sala}/gente/${id}`); if (primeira) { g.onDisconnect().remove(); return g.set({ ...d, t: this.agora() }); } return g.update(d); },
  ouvirGente(sala, cb) { const r = this.r(`salas/${sala}/gente`); r.on('value', s => cb(s.val() || {})); this.offs.push(() => r.off()); },
  chaveArq: k => k.replace(/[.#$\[\]\/%]/g, c => '%' + c.charCodeAt(0).toString(16)),
  async putArq(sala, k, b64) { const n = Math.ceil(b64.length / 4e6), o = { n }; for (let i = 0; i < n; i++) o['c' + i] = b64.slice(i * 4e6, (i + 1) * 4e6); await this.r(`salas/${sala}/arq/${this.chaveArq(k)}`).set(o); },
  async getArq(sala, k) { const o = (await this.com(this.r(`salas/${sala}/arq/${this.chaveArq(k)}`).once('value'), 30000)).val(); if (!o) return null; let s = ''; for (let i = 0; i < o.n; i++) s += o['c' + i] || ''; return s; },
  async sair(sala, id) { for (const f of this.offs.splice(0)) try { f(); } catch { } try { await this.r(`salas/${sala}/gente/${id}`).remove(); const g = (await this.r(`salas/${sala}/gente`).once('value')).val(); if (!g) await this.apagar(sala); } catch { } },
  async apagar(sala) { await this.r(`salas/${sala}`).remove(); await this.r(`lista/${sala}`).remove(); },
  ouvirLista(cb) { const r = this.r('lista'); r.on('value', s => cb(s.val() || {}), () => cb({})); return () => r.off(); },
};

/* ---------- o motor ---------- */
const AoVivo = {
  CORES: ['#ff5f8f', '#19d3f0', '#ffb020', '#7bd88f', '#c08bff', '#ff7a45', '#4fa3ff', '#f2e35b'],
  t: null, ad: null, sala: null, eu: null, gente: {}, ativo: false,
  ligado() { return !!(this._transp || TURMA_CONFIG.aoVivoUrl); },
  usaTransporte(t) { this._transp = t; },
  async transporte() { return (this._transp || AoVivoFirebase).abre(); },
  async quem() {
    if (this.eu) return this.eu; let aba; try { aba = sessionStorage.getItem('animador-aovivo-aba') || (sessionStorage.setItem('animador-aovivo-aba', aba = Math.random().toString(36).slice(2, 8)), aba); } catch { aba = Math.random().toString(36).slice(2, 8); }
    const p = await TurmaAuth.perfil?.().catch(() => null), base = TurmaAuth.fb?.currentUser?.uid || (await Autores.eu().catch(() => null))?.codigo || 'pessoa', h = [...base].reduce((s, c) => s * 31 + c.charCodeAt(0) >>> 0, 7);
    return (this.eu = { id: (base + '-' + aba).replace(/[.#$\[\]\/]/g, ''), nome: p?.nome || 'Alguém', foto: p?.foto || null, cor: this.CORES[h % this.CORES.length] });
  },
  // ---------- entrar numa sala ----------
  // ad (adaptador): { ctx:'atelie'|'animador', sala, get(), set(doc), chaves(doc), redesenha(), nome }
  async entrar(ad, o = {}) {
    if (this.ativo) await this.sair(); if (!this.ligado()) return false;
    let t; try { t = await this.transporte(); } catch (e) { if (o.avisa) UI.toast('Trabalhar junto: ' + esc(e.message), { kind: 'warn', time: 7000 }); return false; }
    this.t = t; this.ad = ad; this.sala = ad.sala; this.gente = {}; this.pend = []; this.log = []; this.minhas = []; this.refazerL = []; this.subidas = new Set(); this._fila = Promise.resolve();
    const eu = await this.quem();
    let st; try { st = await t.estado(this.sala); } catch (e) { if (o.avisa) UI.toast('Trabalhar junto: ' + esc(e.message), { kind: 'warn', time: 7000 }); return false; }
    // Ateliê sem ninguém na sala: sobra de quem fechou de repente; a verdade é o personagem da nuvem, então começa do zero
    if (ad.ctx === 'atelie' && st.snap && !Object.keys(st.gente || {}).length) { try { await t.apagar(this.sala); } catch { } st.snap = null; }
    if (st.snap && !o.novo) { this.base = st.snap.j; this.ate = st.snap.ate || ''; }
    else { this.base = JSON.stringify(ad.get()); this.ate = ''; await t.setSnap(this.sala, { j: this.base, ate: '', t: Date.now() }); await this.subirArqs(ad.chaves(ad.get()), true); st.ops = []; }
    this.log = (st.ops || []).map(op => ({ k: op.k, ops: JSON.parse(op.j || '[]') }));
    this.confirmado = JSON.stringify(Difs.aplica(JSON.parse(this.base), this.log.flatMap(x => x.ops)));
    if (st.snap && !o.novo) { const d = JSON.parse(this.confirmado); await this.garanteArqs(ad.chaves(d)); ad.set(d); }
    this.local = JSON.stringify(ad.get()); this.ativo = true; this.desde = Date.now();
    t.ouvirOps(this.sala, this.log.length ? this.log[this.log.length - 1].k : this.ate, op => this.recebe(op));
    t.ouvirGente(this.sala, g => { this.gente = g; this.pintaBarra(); this.ad?.redesenha(); });
    t.ouvirMeta?.(this.sala, m => this.meta(m));
    await t.presenca(this.sala, eu.id, { nome: eu.nome, foto: eu.foto, cor: eu.cor, onde: ad.ctx, fazendo: '' }, true);
    if (o.meta) await t.setMeta(this.sala, o.meta);
    this.liga(); this.pintaBarra(); clearInterval(this._iv); this._iv = setInterval(() => this.talvezSnap(), 20000);
    return true;
  },
  async sair(o = {}) {
    if (!this.ativo) return; this.ativo = false; clearInterval(this._iv); const t = this.t, sala = this.sala, eu = this.eu;
    try { await this._fila; } catch { } try { if (o.encerrar) await t.setMeta(sala, { fim: true }); await t.sair(sala, eu.id); if (o.encerrar) await t.apagar(sala); } catch { }
    this.gente = {}; this.ad?.redesenha(); this.ad = null; this.sala = null; this.pintaBarra();
  },
  meta(m) { if (m?.fim && this.ativo && this.ad?.ctx === 'animador' && !this._saindo) { this._saindo = true; this.ad.salvar?.(); this.sair().then(() => { this._saindo = false; UI.toast('O trabalho em conjunto terminou. A cópia com as últimas mudanças ficou salva neste computador.', { kind: 'ok', time: 9000 }); }); } },
  // ---------- mudanças ----------
  // chamado depois de cada commit local (Atelie.commit / App.commit)
  mudouLocal(rotulo) {
    if (!this.ativo || this._aplicando) return; const ad = this.ad, agora = JSON.stringify(ad.get()); if (agora === this.local) return;
    const antes = JSON.parse(this.local), depois = JSON.parse(agora), ops = Difs.ops(antes, depois); this.local = agora; if (!ops.length) return;
    if (!this._desfazendo) { this.minhas.push({ ops, inv: Difs.ops(depois, antes) }); if (this.minhas.length > 100) this.minhas.shift(); this.refazerL = []; }
    const chaves = ad.chaves(depois), fazendo = rotulo || this.rotuloDe(ops);
    this._fila = this._fila.then(async () => { await this.subirArqs(chaves); const k = this.t.enviar(this.sala, { por: this.eu.id, nome: this.eu.nome, r: fazendo || '', j: JSON.stringify(ops) }); this.pend.push({ k, ops }); }).catch(e => console.warn('ao vivo', e));
    this.diz(fazendo);
  },
  rotuloDe(ops) {
    const d = this.ad?.get(), op = ops[0]; if (!op) return ''; const nome = id => { const x = JSON.stringify(d || {}).match(new RegExp('"id":"' + id.replace(/[^a-z0-9-]/gi, '') + '"[^{}]*?"nome":"([^"]{1,40})"')); return x ? x[1] : ''; };
    const ids = op.p.filter(s => s.startsWith('#')).map(s => nome(s.slice(1))).filter(Boolean); const campo = op.p.filter(s => !s.startsWith('#') && isNaN(+s)).slice(-1)[0] || '';
    const pal = { encaixe: 'mexendo', k: 'pintando', camadas: 'nas camadas', img: 'trocando imagem', nome: 'renomeando', presets: 'nos presets', sessoes: 'nas sessões', trilhas: 'na animação', chaves: 'animando', pivo: 'mudando o pivô', ajuste: 'mexendo', base: 'mexendo', partes: 'nas partes' }[campo] || 'editando';
    return pal + (ids.length ? ' ' + ids[ids.length - 1] : '');
  },
  diz(fazendo) { if (!this.ativo || !fazendo) return; clearTimeout(this._dz); this.t.presenca(this.sala, this.eu.id, { fazendo }); this._dz = setTimeout(() => this.ativo && this.t.presenca(this.sala, this.eu.id, { fazendo: '' }), 4000); },
  recebe(op) {
    if (!this.ativo) return; const ops = JSON.parse(op.j || '[]'), i = this.pend.findIndex(x => x.k === op.k);
    if (i >= 0) this.pend.splice(i, 1); // a minha voltou: agora está confirmada (já estava aplicada aqui)
    const ultima = this.log.length ? this.log[this.log.length - 1].k : '';
    this.log.push({ k: op.k, ops });
    if (op.k < ultima) { this.log.sort((a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : 0); this.confirmado = JSON.stringify(Difs.aplica(JSON.parse(this.base), this.log.flatMap(x => x.ops))); } // chegou fora de ordem: refaz tudo na ordem certa
    else this.confirmado = JSON.stringify(Difs.aplica(JSON.parse(this.confirmado), ops));
    if (i >= 0 && op.k >= ultima) return this._contaSnap();
    // de outra pessoa: o que está confirmado + as minhas que ainda não voltaram
    const novo = Difs.aplica(JSON.parse(this.confirmado), this.pend.flatMap(x => x.ops));
    this._fila = this._fila.then(async () => { await this.garanteArqs(this.ad.chaves(novo)); await this.livre(); if (!this.ativo) return; this._aplicando = true; try { this.ad.set(novo); this.local = JSON.stringify(this.ad.get()); } finally { this._aplicando = false; } });
    if (op.por !== this.eu.id && op.r) this.atividade(op.nome, op.r);
    this._contaSnap();
  },
  // no meio de um arrasto/traço (ou com a IA trabalhando) a mudança de fora espera: senão o traço iria para um objeto que já foi trocado
  async livre() { let n = 0; while ((this._gesto || (window.Ocupado && Ocupado.n > 0)) && n++ < 1200) await new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => setTimeout(r, 40); c.port2.postMessage(0); }); },
  _contaSnap() { this._n = (this._n || 0) + 1; if (this._n >= 30) this.talvezSnap(); },
  // quem entrou primeiro (que ainda está) guarda o estado de tempos em tempos: quem chega depois carrega rápido
  async talvezSnap() {
    if (!this.ativo || !this.log.length || !this._n) return; const ids = Object.entries(this.gente).sort((a, b) => (a[1].t || 0) - (b[1].t || 0)).map(x => x[0]); if (ids[0] && ids[0] !== this.eu.id) return;
    this._n = 0; const ate = this.log[this.log.length - 1].k; try { await this.t.setSnap(this.sala, { j: this.confirmado, ate, t: Date.now() }); this.base = this.confirmado; this.log = []; } catch { }
  },
  // Ctrl+Z / Ctrl+Y juntos: só as MINHAS mudanças
  desfazer() { const m = this.minhas.pop(); if (!m) return UI.toast('Nada seu para desfazer'); this.refazerL.push(m); this._troca(m.inv, 'desfez'); },
  refazer() { const m = this.refazerL.pop(); if (!m) return; this.minhas.push(m); this._troca(m.ops, 'refez'); },
  _troca(ops, r) { const d = Difs.aplica(JSON.parse(this.local), ops); this._aplicando = true; try { this.ad.set(d); } finally { this._aplicando = false; } this._desfazendo = true; try { this.mudouLocal(r); } finally { this._desfazendo = false; } },
  // ---------- arquivos (imagens, áudios) ----------
  async b64(blob) { const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192)); return (blob.type || 'application/octet-stream') + '|' + btoa(s); },
  doB64(s) { const i = s.indexOf('|'), tipo = s.slice(0, i), bin = atob(s.slice(i + 1)), u8 = new Uint8Array(bin.length); for (let j = 0; j < bin.length; j++) u8[j] = bin.charCodeAt(j); return new Blob([u8], { type: tipo }); },
  async subirArqs(chaves, todas) {
    const novas = [...new Set(chaves)].filter(k => k && !this.subidas.has(k)); let n = 0;
    for (const k of novas) { this.subidas.add(k); const b = await Arq.pegaBlob(k).catch(() => null); if (!b) continue; if (!todas && /^personagens\//.test(k) && this.ad?.ctx === 'atelie' && this._naNuvem?.has(k)) continue; try { await this.t.putArq(this.sala, k, await this.b64(b)); n++; } catch (e) { console.warn('arq', k, e); } }
    return n;
  },
  async garanteArqs(chaves) {
    for (const k of [...new Set(chaves)].filter(Boolean)) { this.subidas.add(k); if (await Arq.pegaBlob(k).catch(() => null)) continue;
      let b = null; try { const s = await this.t.getArq(this.sala, k); if (s) b = this.doB64(s); } catch { } if (!b && /^personagens\//.test(k)) b = await Nuvem.baixar(k).catch(() => null);
      if (b) { await Arq.guardar(b, k); if (/^image\//.test(b.type) || /\.(png|webp|jpe?g|gif)$/i.test(k)) Arq.img.set(k, await createImageBitmap(b).catch(() => null)); } }
  },
  // ---------- cursores e quem está junto ----------
  outros() { return Object.entries(this.gente).filter(([id, g]) => id !== this.eu?.id && g && g.onde === this.ad?.ctx).map(([id, g]) => ({ id, ...g })); },
  cursor(x, y, extra = {}) { if (!this.ativo) return; const t = performance.now(); this._cur = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, ...extra }; if (t - (this._curT || 0) < 70) { clearTimeout(this._curTo); this._curTo = setTimeout(() => this.cursor(this._cur.x, this._cur.y, extra), 80); return; } this._curT = t; this.t.presenca(this.sala, this.eu.id, this._cur); },
  desenha(ctx, V, d = devicePixelRatio || 1) {
    if (!this.ativo) return;
    for (const g of this.outros()) { if (g.x == null) continue; const q = V.transformPoint(new DOMPoint(g.x, g.y)), c = g.cor || '#19d3f0';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(q.x, q.y); ctx.scale(d, d);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.lineTo(4.5, 13); ctx.lineTo(8, 20); ctx.lineTo(10.5, 19); ctx.lineTo(7.2, 12.3); ctx.lineTo(13, 12); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      const txt = (g.nome || 'Alguém').split(' ')[0] + (g.fazendo ? ' · ' + g.fazendo : ''); ctx.font = '600 11.5px Segoe UI, sans-serif'; const w = ctx.measureText(txt).width + 12;
      ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(12, 18, w, 19, 9) : ctx.rect(12, 18, w, 19); ctx.fill(); ctx.fillStyle = this.claro(c) ? '#111' : '#fff'; ctx.fillText(txt, 18, 31.5); ctx.restore(); }
  },
  claro(hex) { const v = parseInt(hex.slice(1), 16); return ((v >> 16 & 255) * .3 + (v >> 8 & 255) * .59 + (v & 255) * .11) > 150; },
  atividade(nome, r) { const k = nome + r, t = Date.now(); if (this._ult?.k === k && t - this._ult.t < 4000) return; this._ult = { k, t }; UI.toast(`<b>${esc((nome || 'Alguém').split(' ')[0])}</b> ${esc(r)}`, { time: 2200 }); },
  pintaBarra() {
    for (const el of $$('[data-aovivo]')) { const outros = this.ativo && this.ad && el.dataset.aovivo === this.ad.ctx ? this.outros() : [];
      el.hidden = !(this.ativo && this.ad && el.dataset.aovivo === this.ad.ctx); if (el.hidden) { el.innerHTML = ''; continue; }
      el.innerHTML = `<span class="av-ao" title="Trabalhando junto ao vivo">${ic('users', 13)} ${outros.length ? 'ao vivo' : 'só você'}</span>` + outros.map(g => `<span class="av-p" style="--c:${g.cor}" title="${esc(g.nome)}${g.fazendo ? ' · ' + esc(g.fazendo) : ''}">${g.foto ? `<img src="${esc(g.foto)}" alt="" referrerpolicy="no-referrer">` : esc((g.nome || '?')[0])}</span>`).join('')
        + (this.ad.ctx === 'animador' ? `<button class="btn sm" data-sair>Sair</button>${this.ad.dono ? '<button class="btn sm" data-fim>Encerrar</button>' : ''}` : '');
      if ($('[data-sair]', el)) $('[data-sair]', el).onclick = () => App.sairJunto(false); if ($('[data-fim]', el)) $('[data-fim]', el).onclick = () => App.sairJunto(true); }
  },
  // ---------- ganchos (uma vez): commit, desfazer, cursor e desenho ----------
  liga() {
    if (this._ligado) return; this._ligado = true;
    const envolve = (obj, nome, depois) => { const f = obj[nome]; obj[nome] = function (...a) { const r = f.apply(this, a); depois.call(this, a); return r; }; };
    envolve(Atelie, 'commit', () => { if (AoVivo.ad?.ctx === 'atelie') AoVivo.mudouLocal(); });
    envolve(App, 'commit', a => { if (AoVivo.ad?.ctx === 'animador') AoVivo.mudouLocal(typeof a[0] === 'string' ? a[0].toLowerCase() : ''); });
    for (const [obj, ctx] of [[Atelie, 'atelie'], [App, 'animador']]) for (const [n, f] of [['undo', 'desfazer'], ['redo', 'refazer']]) { const orig = obj[n]; obj[n] = function (...a) { if (AoVivo.ativo && AoVivo.ad?.ctx === ctx) return AoVivo[f](); return orig.apply(this, a); }; }
    const ligaPalcos = () => {
      for (const [c, ctx, mundo] of [[Atelie.cv, 'atelie', e => Atelie.mundo(e)], [App.palco?.cv, 'animador', e => App.palco.paraMundo(e)]]) { if (!c || c._aovivo) continue; c._aovivo = true;
        c.addEventListener('pointermove', e => { if (this.ativo && this.ad?.ctx === ctx) { const w = mundo(e); this.cursor(w.x, w.y); } });
        c.addEventListener('pointerdown', () => { this._gesto = true; }, true); }
    };
    addEventListener('pointerup', () => { this._gesto = false; }, true); addEventListener('pointercancel', () => { this._gesto = false; }, true);
    ligaPalcos(); setInterval(ligaPalcos, 1500);
    addEventListener('pagehide', () => { if (this.ativo) try { this.t.sair(this.sala, this.eu.id); } catch { } });
  },
  // ---------- adaptadores ----------
  adAtelie() {
    const def = Atelie.def; return { ctx: 'atelie', sala: 'at-' + def.id, nome: def.nome,
      get: () => Atelie.def, set: d => { Atelie.def = d; Atelie.ultimo = JSON.stringify(d); Atelie.sujo = true; Atelie.rascunho(); Atelie.pinta(); },
      chaves: d => [...new Set((JSON.stringify(d).match(/personagens\/[a-z0-9-]+\/(?:img|aud)\/[^"\\]+/g) || []))], redesenha: () => Atelie.desenha() };
  },
  adAnimador(dono) {
    const P = App.P; return { ctx: 'animador', sala: 'an-' + P.id, nome: P.nome, dono,
      get: () => App.P, set: d => { App.troca(d); App.ultimo = JSON.stringify(App.P); }, chaves: d => Toon.ids(d), redesenha: () => App.pinta(), salvar: () => App.salvarJa?.() };
  },
  // Ateliê: personagem da nuvem → entra sozinho
  async entrarAtelie() { if (!this.ligado() || !Atelie.def || !Atelie.naNuvem || (this.ativo && this.ad?.ctx === 'animador')) return; if (this.ativo && this.sala === 'at-' + Atelie.def.id) return; await this.entrar(this.adAtelie(), { meta: { tipo: 'atelie', nome: Atelie.def.nome } }); },
  async baixarSala(sala) {
    const t = await this.transporte(), st = await t.estado(sala); if (!st.snap) return null;
    const d = Difs.aplica(JSON.parse(st.snap.j), (st.ops || []).flatMap(op => JSON.parse(op.j || '[]'))); const ant = { t: this.t, sala: this.sala, subidas: this.subidas };
    this.t = t; this.sala = sala; this.subidas = new Set(); try { await this.garanteArqs(Toon.ids(d)); } finally { Object.assign(this, ant.sala ? ant : { t: ant.t, sala: null, subidas: ant.subidas }); }
    return { P: d, meta: st.meta };
  },
  // lista das salas do Animador abertas agora (para "Entrar")
  ouvirLista(cb) { if (!this.ligado()) return () => { }; let off = () => { }; this.transporte().then(t => { off = t.ouvirLista(l => cb(Object.entries(l).map(([sala, m]) => ({ sala, ...m })).filter(x => x.tipo === 'animador' && !x.fim))); }).catch(() => cb([])); return () => off(); },
};
