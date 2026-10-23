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
  async putArq(sala, k, b64) { const n = Math.ceil(b64.length / 4e6), o = { n }; for (let i = 0; i < n; i++) o['c' + i] = b64.slice(i * 4e6, (i + 1) * 4e6); await this.com(this.r(`salas/${sala}/arq/${this.chaveArq(k)}`).set(o), 90000); }, // com prazo: um envio travado não pode parar a fila (as mudanças deixavam de ir)
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
    return (this.eu = { id: (base + '-' + aba).replace(/[.#$\[\]\/]/g, ''), conta: String(base).replace(/[.#$\[\]\/]/g, ''), nome: p?.nome || 'Alguém', foto: await Autores.miniFoto(p?.foto).catch(() => null), cor: this.CORES[h % this.CORES.length] }); // foto própria (/conta/foto) só abre para a própria pessoa: vai pequena dentro (64 px)
  },
  // ---------- entrar numa sala ----------
  // ad (adaptador): { ctx:'atelie'|'animador', sala, get(), set(doc), chaves(doc), redesenha(), nome }
  async entrar(ad, o = {}) {
    if (this.ativo) await this.sair(); if (!this.ligado()) return false;
    let t; try { t = await this.transporte(); } catch (e) { if (o.avisa) UI.toast('Trabalhar junto: ' + esc(e.message), { kind: 'warn', time: 7000 }); return false; }
    this.t = t; this.ad = ad; this.sala = ad.sala; this.gente = {}; this.feitos = {}; this.pend = []; this.log = []; this.minhas = []; this.refazerL = []; this.subidas = new Set(); this._fila = Promise.resolve();
    const eu = await this.quem();
    try { return await this._entra(t, ad, eu, o); } catch (e) {
      if (!o._de2 && /permission.denied/i.test(String(e?.code || '') + String(e?.message || ''))) { for (const f of (t.offs || []).splice(0)) try { f(); } catch { } const m = await this.liberar(); if (m === 'ok') return this.entrar(ad, { ...o, _de2: true }); e = new Error(m); }
      for (const f of (t.offs || []).splice(0)) try { f(); } catch { }
      this.ativo = false; this.erro = this.motivo(e); console.warn('ao vivo', e);
      if (o.avisa) UI.toast('Trabalhar junto: ' + esc(this.erro), { kind: 'warn', time: 9000 }); return false;
    }
  },
  // pede ao servidor para liberar esta conta no tempo real agora; devolve 'ok' ou o motivo
  async liberar() {
    try { const r = await fetch(TURMA_CONFIG.iaServidor + '/quem?aovivo=1', { headers: { authorization: 'Bearer ' + await TurmaAuth.token(true) }, cache: 'no-store' }); const j = await r.json().catch(() => ({}));
      if (!('aovivo' in j)) return 'o servidor turma-ia ainda está com a versão antiga (falta publicar o worker.js novo)'; return j.aovivo; } catch { return 'não consegui falar com o servidor'; }
  },
  // erro do Firebase em palavras
  motivo(e) { const m = String(e?.code || '') + ' ' + String(e?.message || e || ''); if (/permission.denied/i.test(m)) return 'sua conta ainda não foi liberada no tempo real (o servidor libera quem passou no login; recarregue a página daqui a pouco)'; return e?.message || 'o tempo real não respondeu'; },
  async _entra(t, ad, eu, o) {
    const st = await t.estado(this.sala);
    // Ateliê sem ninguém na sala: sobra de quem fechou de repente; a verdade é o personagem da nuvem, então começa do zero
    if (ad.ctx === 'atelie' && st.snap && !Object.keys(st.gente || {}).length) { try { await t.apagar(this.sala); } catch { } st.snap = null; }
    if (st.snap && !o.novo) { this.base = st.snap.j; this.ate = st.snap.ate || ''; }
    else { this.base = JSON.stringify(ad.get()); this.ate = ''; await t.setSnap(this.sala, { j: this.base, ate: '', t: Date.now() }); await this.subirArqs(ad.chaves(ad.get()), true); st.ops = []; }
    this.log = (st.ops || []).map(op => ({ k: op.k, ops: JSON.parse(op.j || '[]') }));
    this.confirmado = JSON.stringify(Difs.aplica(JSON.parse(this.base), this.log.flatMap(x => x.ops)));
    if (ad.canon) { const c = JSON.stringify(ad.canon(JSON.parse(this.confirmado))); if (c !== this.confirmado) { this.confirmado = this.base = c; this.log = []; } } // sala de antes com outra vista ativa: passa para a forma de sempre
    if (st.snap && !o.novo) { const d = JSON.parse(this.confirmado); await this.garanteArqs(ad.chaves(d)); ad.set(d); }
    this.local = JSON.stringify(ad.get()); this.ativo = true; this.desde = Date.now();
    t.ouvirOps(this.sala, this.log.length ? this.log[this.log.length - 1].k : this.ate, op => this.recebe(op));
    t.ouvirGente(this.sala, g => { this.gente = g; this.pintaBarra(); this.ad?.gente?.(); this.ad?.redesenha(); this.pintaMarcas(); });
    t.ouvirMeta?.(this.sala, m => this.meta(m));
    await t.presenca(this.sala, eu.id, { nome: eu.nome, foto: eu.foto, cor: eu.cor, onde: ad.ctx, fazendo: '', afk: false, conta: eu.conta, vista: ad.vista?.() || '', u: Date.now() }, true); this._afk = false; this._mexeu = Date.now();
    if (o.meta) await t.setMeta(this.sala, o.meta);
    this.liga(); this.pintaBarra(); clearInterval(this._iv); this._iv = setInterval(() => this.talvezSnap(), 20000);
    return true;
  },
  async sair(o = {}) {
    if (!this.ativo) return; this.ativo = false; clearInterval(this._iv); const t = this.t, sala = this.sala, eu = this.eu;
    try { await this._fila; } catch { } try { if (o.encerrar) await t.setMeta(sala, { fim: true }); await t.sair(sala, eu.id); if (o.encerrar) await t.apagar(sala); } catch { }
    this.gente = {}; this.ad?.redesenha(); this.ad = null; this.sala = null; this.pintaBarra(); this.pintaMarcas(); this._focoJ = null;
  },
  meta(m) { if (m?.troca) this.recebeTroca(m.troca); if (m?.fim && this.ativo && this.ad?.ctx === 'animador' && !this._saindo) { this._saindo = true; this.ad.salvar?.(); this.sair().then(() => { this._saindo = false; UI.toast('O trabalho em conjunto terminou. A cópia com as últimas mudanças ficou salva neste computador.', { kind: 'ok', time: 9000 }); }); } },
  // ---------- TROCAR O PERSONAGEM PELO ARQUIVO (.atelieanimador) com gente junto ----------
  // quem soltou o arquivo decide; os outros veem o aviso, a tela de espera, e cada um guarda a cópia de antes no próprio computador
  avisaTroca(o) { if (!this.ativo || this.ad?.ctx !== 'atelie') return; try { return this.t.setMeta(this.sala, { troca: { ...o, por: this.eu.id, nome: this.eu.nome, t: Date.now() } }); } catch { } },
  // depois de uma troca grande (arquivo inteiro): quem trocou grava o estado INTEIRO como foto da sala e os outros recarregam dela.
  // Assim ninguém fica com uma versão diferente se o "antes" de alguém já estava diferente (era o que deixava quem soltou com a tela vazia).
  async fixaSala() {
    if (!this.ativo) return false; for (let n = 0; this.pend.length && n < 150; n++) await new Promise(r => setTimeout(r, 100)); // as minhas mudanças voltaram confirmadas
    const ate = this.log.length ? this.log[this.log.length - 1].k : this.ate; this.local = JSON.stringify(this.ad.get());
    try { await this.t.setSnap(this.sala, { j: this.local, ate: ate || '', t: Date.now() }); this.base = this.confirmado = this.local; this.ate = ate || ''; this.log = []; this._n = 0; return true; } catch (e) { console.warn('ao vivo', e); return false; }
  },
  async ressinc() {
    if (!this.ativo) return; const st = await this.t.estado(this.sala); if (!st.snap) return;
    this.base = st.snap.j; this.ate = st.snap.ate || ''; this.log = (st.ops || []).map(op => ({ k: op.k, ops: JSON.parse(op.j || '[]') })).filter(x => !this.ate || x.k > this.ate);
    let c = Difs.aplica(JSON.parse(this.base), this.log.flatMap(x => x.ops)); if (this.ad.canon) c = this.ad.canon(c); this.confirmado = JSON.stringify(c);
    const novo = Difs.aplica(JSON.parse(this.confirmado), this.pend.flatMap(x => x.ops)); await this.garanteArqs(this.ad.chaves(novo));
    this._aplicando = true; try { this.ad.set(novo); this.local = JSON.stringify(this.ad.get()); } finally { this._aplicando = false; }
  },
  async recebeTroca(x) {
    if (!x || !this.ativo || x.por === this.eu?.id || x.t === this._trocaT) return; this._trocaT = x.t;
    if (['pergunta', 'trocando'].includes(x.estado) && Math.abs(Date.now() - x.t) > 120000) return; // sobra antiga na sala
    const quem = esc((x.nome || 'Alguém').split(' ')[0]), nome = esc(Atelie.def?.nome || 'o personagem'); this._trocaEl?.remove(); this._trocaEl = null;
    if (x.estado === 'pergunta') {
      this._trocaEl = h(`<div class="troca-av"><div class="troca-card"><div class="troca-ic">${ic('layers', 22)}</div><b>${quem} soltou um arquivo</b><div>${quem} está decidindo se troca <b>${nome}</b> pelo arquivo <b>${esc(x.arquivo || '')}</b>${x.resumo ? ` (${esc(x.resumo)})` : ''}.</div><small>Só ${quem} decide. Se trocar, a versão de agora também fica guardada neste computador ("${nome} (anterior)").</small></div></div>`);
      document.body.appendChild(this._trocaEl); return;
    }
    if (x.estado === 'trocando') {
      this._trocaFim?.(); this._trocaFim = Ocupado.inicio({ tipo: 'arquivo', icone: 'layers', titulo: `${x.nome ? (x.nome || '').split(' ')[0] : 'Alguém'} está substituindo ${Atelie.def?.nome || 'o personagem'}`, subtitulo: x.backup === false ? 'Esperando a versão nova…' : 'Guardando a cópia de antes neste computador…', aviso: 'Aguarde: a versão nova vem do arquivo que a outra pessoa soltou. Não feche esta aba.' });
      clearTimeout(this._trocaTo); this._trocaTo = setTimeout(() => { this._trocaFim?.(); this._trocaFim = null; }, 180000);
      this._trocaCopia = x.backup !== false; const d = Atelie.def; this._backup = x.backup === false ? Promise.resolve() : Arquivos.duplicarPersonagem(JSON.parse(JSON.stringify(d)), d.thumb, `${d.nome} (anterior)`).catch(() => null); // quem soltou escolheu "cópia como rascunho": cada um guarda a sua (as mudanças de fora esperam ela ficar pronta); "vistas (antigo)" = sem cópia
      try { await this._backup; } catch { } Ocupado.passo('Esperando a versão nova chegar…');
      return;
    }
    if (x.estado === 'feito' && this._trocaFim) { Ocupado.passo('Pondo a versão nova…'); await Promise.race([this._fila.catch(() => { }), new Promise(r => setTimeout(r, 90000))]); }
    if (x.estado === 'feito' && x.snap) { try { await this.ressinc(); } catch (e) { console.warn('ao vivo', e); } } // pega a versão inteira de quem trocou (igualzinha) // fica na espera até a versão nova estar na tela
    this._trocaFim?.(); this._trocaFim = null; clearTimeout(this._trocaTo);
    if (x.estado === 'feito') UI.toast(`<b>${quem}</b> trocou <b>${nome}</b> pelo arquivo <b>${esc(x.arquivo || '')}</b>. ${this._trocaCopia === false ? 'As vistas de antes ficaram nele com <b>(antigo)</b> no nome.' : `A versão de antes ficou em <b>${nome} (anterior)</b>, neste computador.`}`, { kind: 'ok', time: 9000 });
    else if (x.estado === 'cancelado') UI.toast(`<b>${quem}</b> não trocou o personagem pelo arquivo.`, { time: 3500 });
  },
  // ---------- mudanças ----------
  // chamado depois de cada commit local (Atelie.commit / App.commit)
  mudouLocal(rotulo) {
    if (!this.ativo || this._aplicando) return; const ad = this.ad, agora = JSON.stringify(ad.get()); if (agora === this.local) return;
    const antes = JSON.parse(this.local), depois = JSON.parse(agora), ops = Difs.ops(antes, depois); this.local = agora; if (!ops.length) return;
    if (!this._desfazendo) { this.minhas.push({ ops, inv: Difs.ops(depois, antes) }); if (this.minhas.length > 100) this.minhas.shift(); this.refazerL = []; }
    const chaves = ad.chaves(depois), fazendo = rotulo || this.rotuloDe(ops);
    this._fila = this._fila.then(async () => { await this.subirArqs(chaves); const k = this.t.enviar(this.sala, { por: this.eu.id, nome: this.eu.nome, r: fazendo || '', j: JSON.stringify(ops) }); this.pend.push({ k, ops }); }).catch(e => console.warn('ao vivo', e));
    this.anota(this.eu?.id, this.eu?.nome, fazendo); this.diz(fazendo);
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
    this._fila = this._fila.then(async () => { await this.garanteArqs(this.ad.chaves(novo), this._trocaFim ? Infinity : 4000); try { await this._backup; } catch { } await this.livre(); if (!this.ativo) return; this._aplicando = true; try { this.ad.set(novo); this.local = JSON.stringify(this.ad.get()); } finally { this._aplicando = false; } }).catch(e => console.warn('ao vivo', e)); // um erro não pode travar a fila (as próximas mudanças pararam de chegar)
    if (op.por !== this.eu.id && op.r) { this.atividade(op.nome, op.r); this.anota(op.por, op.nome, op.r); }
    this._contaSnap();
  },
  // no meio de um arrasto/traço (ou com a IA trabalhando) a mudança de fora espera: senão o traço iria para um objeto que já foi trocado
  async livre() { let n = 0; while (((this._gesto && Date.now() - (this._gestoT || 0) < 20000) || (typeof Ocupado !== 'undefined' && Ocupado.n > (this._trocaFim ? 1 : 0) && n < 500)) && n++ < 1500) /* arrasto “preso” (soltou fora da janela) não segura as mudanças para sempre */ await new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => setTimeout(r, 40); c.port2.postMessage(0); }); },
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
  // várias de uma vez (6 ao mesmo tempo): mandar/baixar um personagem inteiro fica bem mais rápido
  async emLote(lista, fn, n = 6) { let i = 0; await Promise.all(Array.from({ length: Math.min(n, lista.length) }, async () => { while (i < lista.length) { const x = lista[i++]; try { await fn(x); } catch (e) { console.warn('ao vivo', e); } } })); },
  async subirArqs(chaves, todas) {
    const novas = [...new Set(chaves)].filter(k => k && !this.subidas.has(k)); let n = 0; novas.forEach(k => this.subidas.add(k));
    await this.emLote(novas, async k => { const b = await Arq.pegaBlob(k).catch(() => null); if (!b) return; if (!todas && /^personagens\//.test(k) && this.ad?.ctx === 'atelie' && this._naNuvem?.has(k)) return; await this.t.putArq(this.sala, k, await this.b64(b)); n++; if (novas.length > 3 && typeof Ocupado !== 'undefined' && Ocupado.n) Ocupado.parte(n, novas.length); });
    return n;
  },
  // as imagens que faltam neste computador: baixa (6 de cada vez). RÁPIDO: o que já se sabe que está aqui não é conferido de novo (antes
  // cada mudança relia TODAS as imagens do personagem no banco, uma por uma, e as mudanças de fora iam se acumulando atrasadas);
  // o que não deu para baixar não é tentado de novo em cada mudança (só depois de 1 min); cada download tem prazo.
  async garanteArqs(chaves, espera = Infinity) {
    const tem = this._tem || (this._tem = new Set()), falhou = this._falhou || (this._falhou = new Map()), agora = Date.now(), faltam = [];
    for (const k of [...new Set(chaves)].filter(Boolean)) { if (tem.has(k)) continue; this.subidas.add(k); if (Arq.img.get(k) || await Arq.pegaBlob(k).catch(() => null)) { tem.add(k); continue; } if (agora - (falhou.get(k) || 0) > 60000) faltam.push(k); }
    if (!faltam.length) return;
    let feitas = 0; const conta = () => { if (faltam.length > 3 && this._trocaFim) { Ocupado.passo('Baixando as imagens da versão nova…'); Ocupado.parte(feitas, faltam.length); } };
    const prazo = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
    conta(); const tudo = this.emLote(faltam, async k => {
      let b = null; try { const s = await prazo(this.t.getArq(this.sala, k), 30000); if (s) b = this.doB64(s); } catch { } if (!b && /^personagens\//.test(k)) b = await prazo(Nuvem.baixar(k).catch(() => null), 30000);
      if (b) { await Arq.guardar(b, k); if (/^image\//.test(b.type) || /\.(png|webp|jpe?g|gif)$/i.test(k)) Arq.img.set(k, await createImageBitmap(b).catch(() => null)); tem.add(k); falhou.delete(k); this.ad?.redesenha?.(); } else falhou.set(k, Date.now()); feitas++; conta(); });
    await (espera === Infinity ? tudo : Promise.race([tudo, new Promise(r => setTimeout(r, espera))])); // mudança de fora: espera as imagens no máximo uns segundos; o resto chega e aparece depois
  },
  // ---------- cursores e quem está junto ----------
  // os outros: UMA entrada por conta (a mesma pessoa em duas abas ou uma sobra de quando recarregou = a que mexeu por último), e a minha própria conta em outra aba não aparece
  outros() {
    const por = new Map();
    for (const [id, g] of Object.entries(this.gente)) { if (id === this.eu?.id || !g || g.onde !== this.ad?.ctx) continue; const c = g.conta || id.replace(/-[a-z0-9]{6}$/, ''); if (c === this.eu?.conta) continue;
      const v = por.get(c), t = g.afk ? -1 : (g.u || g.t || 0); if (!v || t > v._t) por.set(c, { id, ...g, _t: t }); }
    return [...por.values()];
  },
  cursor(x, y, extra = {}) { return; /* sem cursor na tela (decisão do dono): o lugar de cada um vai no "foco" */ if (!this.ativo) return; const t = performance.now(); this._curX = extra; this._cur = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, ui: null, ...extra }; if (t - (this._curT || 0) < 70) { clearTimeout(this._curTo); this._curTo = setTimeout(() => this.cursor(this._cur.x, this._cur.y, this._curX), 80); this._curX = extra; return; } this._curT = t; this.t.presenca(this.sala, this.eu.id, { ...this._cur, u: Date.now() }); },
  // cursores dos outros: numa camada por cima de TUDO (painéis, janelas), na posição do palco
  // QUEM ESTÁ MEXENDO ONDE (jeito do Figma/Canva): no palco, a parte de cada um ganha contorno fino na cor dela + a fotinho no canto;
  // nas listas (partes, poses, frames, imagens, camadas) a fotinho aparece no item. Sem cursor na tela (não suja a visão).
  // Muita gente no mesmo lugar: no máximo 2 fotos + "+N" (passar o mouse mostra os nomes).
  desenha(ctx, V) {
    const lay = this._lay || (this._lay = document.body.appendChild(h('<div class="av-cursores" aria-hidden="true"></div>')));
    const cv = ctx?.canvas; if (!this.ativo) { lay.innerHTML = ''; return; }
    if (cv && this.ad && cv !== (this.ad.ctx === 'atelie' ? Atelie.cv : App.palco?.cv)) return; // o palco do outro programa (escondido) não mexe
    const r = cv?.getBoundingClientRect?.(), k = r && cv.width ? r.width / cv.width : 0; if (!k || !(r.width > 0)) return;
    const minhaV = this.ad?.vista?.(), grupos = new Map();
    for (const g of this.outros()) { const alvo = this.ad?.ctx === 'atelie' ? g.foco?.parte : g.foco?.no; if (!alvo || (minhaV && g.vista && g.vista !== minhaV)) continue; (grupos.get(alvo) || grupos.set(alvo, []).get(alvo)).push(g); }
    const vivos = new Set();
    for (const [alvo, gs] of grupos) {
      const polis = this.contorno(alvo); if (!polis.length) continue;
      gs.sort((a, b) => (a.afk - b.afk) || ((b.u || 0) - (a.u || 0))); const cor = gs[0].cor || '#19d3f0';
      // contorno fino na cor de quem mexeu por último (desenhado no próprio palco, por cima de tudo)
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.lineWidth = Math.max(1.5, 2 / k); ctx.strokeStyle = cor; ctx.globalAlpha = gs.every(x => x.afk) ? .35 : .95; ctx.setLineDash([]);
      let mx = Infinity, my = Infinity, Mx = -Infinity;
      for (const pts of polis) { ctx.beginPath(); pts.forEach((w, i) => { const q = V.transformPoint(new DOMPoint(w.x, w.y)); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); if (q.y < my || (q.y === my && q.x < mx)) { my = q.y; mx = q.x; } Mx = Math.max(Mx, q.x); }); ctx.closePath(); ctx.stroke(); }
      ctx.restore();
      // fotinhas no canto de cima do contorno (dentro do palco)
      const x = clamp(r.left + mx * k, r.left + 2, r.right - 60), y = clamp(r.top + my * k - 24, r.top + 2, r.bottom - 26), id = 'p:' + alvo; vivos.add(id);
      let el = lay.querySelector(`[data-id="${CSS.escape(id)}"]`); if (!el) { el = h(`<div class="av-selp" data-id="${esc(id)}"></div>`); lay.appendChild(el); }
      const html = this.fotinhas(gs, 2); if (el._h !== html) { el._h = html; el.innerHTML = html; }
      el.style.setProperty('--c', cor); el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`; el.title = gs.map(g => (g.nome || 'Alguém') + (g.fazendo ? ' · ' + g.fazendo : '')).join('\n');
    }
    for (const el of [...lay.children]) if (!vivos.has(el.dataset.id)) el.remove();
  },
  // onde fica a parte (Ateliê) ou a camada (Animador) no palco: polígonos em coordenadas do mundo
  contorno(alvo) {
    try {
      if (this.ad?.ctx === 'atelie') {
        if (!Atelie.def) return [];
        return Modelo.montar(Atelie.def, Atelie.estado()).filter(it => it.img && it.parte.id === alvo).map(it => {
          const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2, x0 = -px + (it.img.ajuste?.x || 0), y0 = -py + (it.img.ajuste?.y || 0), x1 = x0 + it.img.w, y1 = y0 + it.img.h;
          return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => it.m.transformPoint(new DOMPoint(x, y))); });
      }
      if (!App.P) return []; const c = Render.caixas(App.P, App.q).find(c => c.no?.id === alvo); return c?.cantos ? [c.cantos.map(p => ({ x: p.x ?? p[0], y: p.y ?? p[1] }))] : [];
    } catch { return []; }
  },
  // fotinhas de quem está num lugar: no máximo n + "+N"
  fotinhas(gs, n) {
    const f = g => `<span class="av-mini${g.afk ? ' afk' : ''}" style="--c:${esc(g.cor || '#888')}">${g.foto ? `<img src="${esc(g.foto)}" alt="" referrerpolicy="no-referrer">` : esc((g.nome || '?')[0].toUpperCase())}</span>`;
    return gs.slice(0, n).map(f).join('') + (gs.length > n ? `<span class="av-mini av-mais">+${gs.length - n}</span>` : '');
  },
  // o que EU estou usando agora (vai na presença; os outros mostram a minha fotinha nesses lugares)
  focoAgora() {
    if (this.ad?.ctx === 'atelie') { const A = typeof Animacoes !== 'undefined' ? Animacoes : null, an = A?.passoSel && (A.tocando || A.sel);
      return { parte: Atelie.sel || null, preset: Atelie.edit?.p || null, img: Atelie.edImg?.iid || Atelie.focoImg?.img || null, passo: an ? `${an}:${A.passoSel.t}:${A.passoSel.i}` : null }; }
    if (this.ad?.ctx === 'animador') return { no: App.sel || null, q: App.q ?? null };
    return null;
  },
  // fotinhas nas listas: põe/atualiza em cada item que alguém está usando
  pintaMarcas() {
    if (this._pintandoMk) return; this._pintandoMk = true;
    try {
      const outros = this.ativo ? this.outros().filter(g => g.foco && !(this.ad?.vista?.() && g.vista && g.vista !== this.ad.vista())) : [], por = new Map();
      const add = (sel, g) => { if (!sel) return; (por.get(sel) || por.set(sel, []).get(sel)).push(g); };
      const anAqui = typeof Animacoes !== 'undefined' ? (Animacoes.tocando || Animacoes.sel) : null;
      for (const g of outros) { const f = g.foco;
        if (this.ad?.ctx === 'atelie') { if (f.parte) add(`#atelie .no[data-pid="${CSS.escape(f.parte)}"]`, g); if (f.preset) add(`[data-prid="${CSS.escape(f.preset)}"]`, g); if (f.img) add(`.im[data-iid="${CSS.escape(f.img)}"]`, g);
          if (f.passo) { const [an, t, i] = String(f.passo).split(':'); if (an === anAqui) add(`.tl-c[data-t="${CSS.escape(t)}"][data-i="${CSS.escape(i)}"]`, g); } }
        else if (f.no) add(`#editor .no[data-id="${CSS.escape(f.no)}"]`, g); }
      const vistos = new Set();
      for (const [sel, gs] of por) for (const el of document.querySelectorAll(sel)) {
        vistos.add(el); el.classList.add('av-mk-host'); let mk = el.querySelector(':scope > .av-mk'); if (!mk) { mk = document.createElement('span'); mk.className = 'av-mk'; el.appendChild(mk); }
        gs.sort((a, b) => (a.afk - b.afk) || ((b.u || 0) - (a.u || 0))); const html = this.fotinhas(gs, 2); if (mk._h !== html) { mk._h = html; mk.innerHTML = html; }
        mk.title = gs.map(g => g.nome || 'Alguém').join(', ') + (gs.length > 1 ? ' estão aqui' : ' está aqui'); el.style.setProperty('--avc', gs[0].cor || '#19d3f0');
      }
      for (const el of document.querySelectorAll('.av-mk-host')) if (!vistos.has(el)) { el.classList.remove('av-mk-host'); el.querySelector(':scope > .av-mk')?.remove(); el.style.removeProperty('--avc'); }
    } finally { this._mkObs?.takeRecords(); this._pintandoMk = false; }
  },
  claro(hex) { const v = parseInt(hex.slice(1), 16); return ((v >> 16 & 255) * .3 + (v >> 8 & 255) * .59 + (v & 255) * .11) > 150; },
  atividade(nome, r) { const k = nome + r, t = Date.now(); if (this._ult?.k === k && t - this._ult.t < 4000) return; this._ult = { k, t }; UI.toast(`<b>${esc((nome || 'Alguém').split(' ')[0])}</b> ${esc(r)}`, { time: 2200 }); },
  ausente(v) { this._afk = v; if (this.ativo) try { this.t.presenca(this.sala, this.eu.id, { afk: v }); } catch { } },
  // o que cada um fez nesta sessão (para a lista ao passar o mouse no "ao vivo")
  anota(id, nome, r) {
    if (!id || !r) return; id = this.contaDe(id); const f = (this.feitos ||= {})[id] ||= { nome, L: [] }; // por CONTA: duas abas da mesma pessoa somam f.nome = nome || f.nome;
    const u = f.L[0]; if (u && u.r === r && Date.now() - u.t < 20000) { u.t = Date.now(); u.n = (u.n || 1) + 1; } else f.L.unshift({ r, t: Date.now() }); f.L.length = Math.min(f.L.length, 300);
    if (this._pop?.isConnected) this.pintaPop();
  },
  contaDe(id) { return id === this.eu?.id ? this.eu.conta || id : this.gente?.[id]?.conta || String(id).replace(/-[a-z0-9]{6}$/, ''); },
  quando(t) { const s = Math.round((Date.now() - t) / 1000); return s < 10 ? 'agora' : s < 60 ? `há ${s} s` : s < 3600 ? `há ${Math.round(s / 60)} min` : `há ${Math.round(s / 3600)} h`; },
  // lista de quem está junto; max = quantas mudanças de cada um (a janelinha mostra poucas, o clique abre todas)
  htmlPessoas(max) {
    const eu = this.eu, pessoas = [{ id: eu?.id, conta: eu?.conta, nome: eu?.nome, foto: eu?.foto, cor: eu?.cor, eu: true, fazendo: '' }, ...this.outros()], cDe = p => p.conta || this.contaDe(p.id);
    for (const [c, f] of Object.entries(this.feitos || {})) if (!pessoas.some(p => cDe(p) === c)) pessoas.push({ id: c, conta: c, nome: f.nome, saiu: true });
    return pessoas.map(p => { const L = this.feitos?.[cDe(p)]?.L || [], f = L.slice(0, max), mais = L.length - f.length;
      return `<div class="avp-p"><div class="aut-l"><span class="avp-av${p.afk || p.saiu ? ' afk' : ''}" style="--c:${p.cor || '#888'}">${p.foto ? `<img src="${esc(p.foto)}" alt="" referrerpolicy="no-referrer">` : esc((p.nome || '?')[0])}</span><div><b>${esc(p.nome || 'Alguém')}${p.eu ? ' <small>(você)</small>' : ''}</b><small>${p.saiu ? 'saiu' : p.afk ? 'ausente' : p.fazendo ? 'agora: ' + esc(p.fazendo) : 'na sala'}</small></div></div>`
        + (f.length ? `<ul class="avp-l">${f.map(x => `<li><span>${esc(x.r)}${x.n > 1 ? ` <small>×${x.n}</small>` : ''}</span><small>${this.quando(x.t)}</small></li>`).join('')}${mais > 0 ? `<li class="avp-mais"><span>+ ${mais} mudança${mais > 1 ? 's' : ''}</span></li>` : ''}</ul>` : '<div class="avp-nada">nenhuma mudança ainda</div>') + '</div>'; }).join('');
  },
  pintaPop() { const pop = this._pop; if (!pop) return; pop.innerHTML = `<div class="aut-t" style="border:0;margin:0">Trabalhando junto agora</div>${this.htmlPessoas(3)}<div class="avp-dica">${ic('chat', 11)} Clique para ver todas as mudanças de cada um</div>`; },
  historico() {
    this._pop?.remove(); this._pop = null; const body = h(`<div class="avp-hist avp-comp"></div>`), abertos = new Set();
    // compacto: uma linha por pessoa (foto, nome, quantas mudanças e a última); clicar abre as mudanças dela (com rolagem própria)
    const pinta = () => {
      const eu = this.eu, pessoas = [{ id: eu?.id, conta: eu?.conta, nome: eu?.nome, foto: eu?.foto, cor: eu?.cor, eu: true }, ...this.outros()], cDe = p => p.conta || this.contaDe(p.id);
      for (const [c, f] of Object.entries(this.feitos || {})) if (!pessoas.some(p => cDe(p) === c)) pessoas.push({ id: c, conta: c, nome: f.nome, saiu: true });
      const tot = L => L.reduce((a, x) => a + (x.n || 1), 0);
      body.innerHTML = `<div class="avc-cab">${pessoas.length} pessoa${pessoas.length > 1 ? 's' : ''} · clique numa pessoa para ver o que ela mudou</div>` + pessoas.map((p, i) => { const L = this.feitos?.[cDe(p)]?.L || [], n = tot(L), u = L[0], ab = abertos.has(cDe(p));
        return `<div class="avc-p${ab ? ' aberto' : ''}" data-i="${i}"><button type="button" class="avc-l" ${L.length ? '' : 'disabled'}><span class="avp-av${p.afk || p.saiu ? ' afk' : ''}" style="--c:${p.cor || '#888'}">${p.foto ? `<img src="${esc(p.foto)}" alt="" referrerpolicy="no-referrer">` : esc((p.nome || '?')[0])}</span>
          <span class="avc-tx"><b>${esc(p.nome || 'Alguém')}${p.eu ? ' <small>(você)</small>' : ''}</b><small>${p.saiu ? 'saiu' : p.afk ? 'ausente' : p.fazendo ? 'agora: ' + esc(p.fazendo) : 'na sala'}${u ? ` · última: ${esc(u.r)} ${this.quando(u.t)}` : ''}</small></span>
          <span class="avc-n${n ? '' : ' zero'}">${n || '0'}</span>${L.length ? `<span class="avc-seta">${ic('down', 12)}</span>` : ''}</button>
          ${ab ? `<ul class="avp-l avc-lista">${L.map(x => `<li><span>${esc(x.r)}${x.n > 1 ? ` <small>×${x.n}</small>` : ''}</span><small>${this.quando(x.t)}</small></li>`).join('')}</ul>` : ''}</div>`; }).join('');
      body.querySelectorAll('.avc-p').forEach(el => el.querySelector('.avc-l').onclick = () => { const p = pessoas[+el.dataset.i], c = cDe(p); abertos.has(c) ? abertos.delete(c) : abertos.add(c); const st = body.scrollTop; pinta(); body.scrollTop = st; });
    };
    pinta(); const iv = setInterval(() => body.isConnected ? pinta() : clearInterval(iv), 5000);
    UI.modal({ title: 'Quem está junto e o que cada um mudou', icon: 'users', width: 480, body, buttons: [{ label: 'Fechar', kind: 'primary', value: true }] });
  },

  ligaPop(el) {
    if (el._pop) return; el._pop = true;
    el.addEventListener('mouseenter', () => { this._pop?.remove(); const pop = this._pop = h('<div class="aut-pop avp-pop"></div>'); document.body.appendChild(pop); this.pintaPop();
      const r = el.getBoundingClientRect(), pr = pop.getBoundingClientRect(); pop.style.left = Math.max(6, Math.min(r.left, innerWidth - pr.width - 6)) + 'px'; pop.style.top = r.bottom + 6 + 'px';
      clearInterval(this._popIv); this._popIv = setInterval(() => this._pop?.isConnected ? this.pintaPop() : clearInterval(this._popIv), 5000); });
    el.addEventListener('mouseleave', () => { this._pop?.remove(); this._pop = null; clearInterval(this._popIv); });
    el.addEventListener('click', ev => { if (ev.target.closest('button')) return; this.historico(); }); el.style.cursor = 'pointer';
  },
  pintaBarra() {
    for (const el of $$('[data-aovivo]')) { const outros = this.ativo && this.ad && el.dataset.aovivo === this.ad.ctx ? this.outros() : [];
      el.hidden = !(this.ativo && this.ad && el.dataset.aovivo === this.ad.ctx); if (el.dataset.aovivo === 'atelie') { const au = document.getElementById('at-autores'); if (au) au.hidden = !el.hidden; } // ao vivo: some o "editado por…" (mais espaço)
      if (el.hidden) { el.innerHTML = ''; continue; }
      // 2+ pessoas: a foto de TODOS (eu primeiro, depois quem está ativo, ausentes no fim); cabem 3 ou 4 conforme a tela, o resto vira "+N" (clicar abre a lista toda)
      const todos = outros.length ? [{ ...this.eu, eu: true }, ...[...outros].sort((a, b) => (a.afk ? 1 : 0) - (b.afk ? 1 : 0))] : [], max = innerWidth < 1250 ? 3 : 4, cabe = Math.min(max, todos.length), mais = todos.length - cabe;
      const foto = (g, i) => `<span class="av-p${g.afk ? ' afk' : ''}${g.eu ? ' eu' : ''}" style="--c:${g.cor || '#888'};z-index:${g.afk ? 0 : 20 - i}" title="${esc(g.nome || 'Alguém')}${g.eu ? ' (você)' : ''}${g.fazendo ? ' · ' + esc(g.fazendo) : ''}${g.afk ? ' · ausente' : ''}">${g.foto ? `<img src="${esc(g.foto)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode('${esc((g.nome || '?')[0]).replace(/'/g, '')}'))">` : esc((g.nome || '?')[0])}</span>`;
      el.innerHTML = `<span class="av-ao" title="Trabalhando junto ao vivo">${ic('users', 13)} ${outros.length ? 'ao vivo' : 'só você'}</span>` + todos.slice(0, cabe).map(foto).join('') + (mais > 0 ? `<span class="av-p av-mais" style="z-index:0" title="Mais ${mais}: ${esc(todos.slice(cabe).map(g => g.nome || 'Alguém').join(', '))} · clique para ver todos">+${mais}</span>` : '')
        + (this.ad.ctx === 'animador' ? `<button class="btn sm" data-sair>Sair</button>${this.ad.dono ? '<button class="btn sm" data-fim>Encerrar</button>' : ''}` : '');
      this.ligaPop(el); if ($('[data-sair]', el)) $('[data-sair]', el).onclick = () => App.sairJunto(false); if ($('[data-fim]', el)) $('[data-fim]', el).onclick = () => App.sairJunto(true); }
  },
  // ---------- ganchos (uma vez): commit, desfazer, cursor e desenho ----------
  liga() {
    if (this._ligado) return; this._ligado = true;
    // AUSENTE: 1 minuto sem mexer (ou ~35 s com a aba escondida ou o navegador sem foco) = os outros deixam de ver o meu cursor e a minha foto fica meio transparente
    const ativou = () => { this._mexeu = Date.now(); if (!document.hidden) this._fora = 0; if (this._afk) this.ausente(false); }; // mexer o mouse em cima da página = está vendo (mesmo sem foco)
    for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) addEventListener(ev, ativou, { passive: true, capture: true });
    // aba escondida ou janela sem foco (outro programa na frente): depois de ~35 s fica ausente; voltar = ativo na hora
    const fora = () => { if (!this._fora) this._fora = Date.now(); }, volta = () => { this._fora = 0; ativou(); };
    document.addEventListener('visibilitychange', () => document.hidden ? fora() : (document.hasFocus() ? volta() : fora()));
    addEventListener('blur', fora); addEventListener('focus', volta);
    setInterval(() => { if (!this.ativo || this._afk) return; const ag = Date.now(); if ((this._fora && ag - this._fora > 35000) || ag - (this._mexeu || this.desde || 0) > 60000) this.ausente(true); }, 5000);
    const envolve = (obj, nome, depois) => { const f = obj[nome]; obj[nome] = function (...a) { const r = f.apply(this, a); depois.call(this, a); return r; }; };
    envolve(Atelie, 'commit', () => { if (AoVivo.ad?.ctx === 'atelie') AoVivo.mudouLocal(); });
    envolve(App, 'commit', a => { if (AoVivo.ad?.ctx === 'animador') AoVivo.mudouLocal(typeof a[0] === 'string' ? a[0].toLowerCase() : ''); });
    for (const [obj, ctx] of [[Atelie, 'atelie'], [App, 'animador']]) for (const [n, f] of [['undo', 'desfazer'], ['redo', 'refazer']]) { const orig = obj[n]; obj[n] = function (...a) { if (AoVivo.ativo && AoVivo.ad?.ctx === ctx) return AoVivo[f](); return orig.apply(this, a); }; }
    const ligaPalcos = () => {
      for (const [c, ctx, mundo] of [[Atelie.cv, 'atelie', e => Atelie.mundo(e)], [App.palco?.cv, 'animador', e => App.palco.paraMundo(e)]]) { if (!c || c._aovivo) continue; c._aovivo = true;
        c.addEventListener('pointermove', e => { if (this.ativo && this.ad?.ctx === ctx) { const w = mundo(e); this.cursor(w.x, w.y, { ui: null }); } });
        c.addEventListener('pointerdown', () => { this._gesto = true; this._gestoT = Date.now(); }, true); }
    };
    addEventListener('pointermove', e => {
      if (!this.ativo || e.target === Atelie.cv || e.target === App.palco?.cv) return;
      const a = e.target.closest?.('[id]'); if (!a || a === document.body || a === document.documentElement || a.closest('.av-cursores')) return;
      const r = a.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return;
      this.cursor(this._cur?.x ?? 0, this._cur?.y ?? 0, { ui: a.id, rx: Math.round((e.clientX - r.left) / r.width * 1000) / 1000, ry: Math.round((e.clientY - r.top) / r.height * 1000) / 1000 });
    }, { passive: true, capture: true });
    setInterval(() => { if (!this.ativo || !this.ad) return; const f = this.focoAgora(), j = JSON.stringify(f); if (j === this._focoJ) return; this._focoJ = j; try { this.t.presenca(this.sala, this.eu.id, { foco: f, u: Date.now() }); } catch { } }, 400);
    this._mkObs = new MutationObserver(() => { if (this._pintandoMk || !this.ativo) return; cancelAnimationFrame(this._mkRaf); this._mkRaf = requestAnimationFrame(() => this.pintaMarcas()); });
    this._mkObs.observe(document.body, { childList: true, subtree: true });
    addEventListener('pointerup', () => { this._gesto = false; }, true); addEventListener('pointercancel', () => { this._gesto = false; }, true);
    ligaPalcos(); setInterval(ligaPalcos, 1500); addEventListener('resize', () => { clearTimeout(this._rz); this._rz = setTimeout(() => this.ativo && this.pintaBarra(), 150); }); // cabem 3 ou 4 fotos conforme a tela
    addEventListener('pagehide', () => { if (this.ativo) try { this.t.sair(this.sala, this.eu.id); } catch { } });
  },
  // ---------- adaptadores ----------
  // VISTA DE CADA UM: na sala o personagem fica sempre com a MESMA vista ativa (a de menor id, não muda quando a ordem muda) e cada pessoa põe
  // a sua por cima ao receber. Assim trocar de vista não vira mudança para os outros (antes trocava as partes de todo mundo e misturava as vistas).
  canonVista(d) { if (!d?.vistas?.length) return d; const id = d.vistas.map(v => v.id).sort()[0]; if (d.vistaAtual !== id) Modelo.ativaVista(d, id); return d; },
  adAtelie() {
    const def = Atelie.def; return { ctx: 'atelie', sala: 'at-' + def.id, nome: def.nome,
      get: () => this.canonVista(JSON.parse(JSON.stringify(Atelie.def))), canon: d => this.canonVista(d),
      set: d => { const v = Atelie.def?.vistaAtual; Modelo.garanteVistas(d); if (v && d.vistaAtual !== v && d.vistas.some(x => x.id === v)) Modelo.ativaVista(d, v);
        if (Atelie.sel && !d.partes.some(p => p.id === Atelie.sel)) Atelie.sel = null; Atelie.def = d; Atelie.ultimo = JSON.stringify(d); Atelie.sujo = true; Atelie.rascunho(); Atelie.pinta(); },
      vista: () => Atelie.def?.vistaAtual || '', gente: () => Atelie.pintaVistas?.(),
      chaves: d => [...new Set((JSON.stringify(d).match(/personagens\/[a-z0-9-]+\/(?:img|aud)\/[^"\\]+/g) || []))], redesenha: () => Atelie.desenha() };
  },
  // troquei de vista: os outros ficam sabendo (o meu cursor só aparece para quem está na mesma vista; a vista ganha a minha foto pequena)
  minhaVista(id) { if (!this.ativo || this.ad?.ctx !== 'atelie') return; try { this.t.presenca(this.sala, this.eu.id, { vista: id || '', u: Date.now() }); } catch { } Atelie.desenha?.(); },
  // quem (dos outros) está em cada vista
  naVista(id) { return this.ativo && this.ad?.ctx === 'atelie' ? this.outros().filter(g => g.vista === id) : []; },
  adAnimador(dono) {
    const P = App.P; return { ctx: 'animador', sala: 'an-' + P.id, nome: P.nome, dono,
      get: () => App.P, set: d => { App.troca(d); App.ultimo = JSON.stringify(App.P); }, chaves: d => Toon.ids(d), redesenha: () => App.pinta(), salvar: () => App.salvarJa?.() };
  },
  // Ateliê: personagem da nuvem → entra sozinho
  // logo depois do login o servidor ainda pode estar liberando a conta no tempo real: tenta de novo algumas vezes e, se não der, avisa o motivo
  async entrarAtelie(n = 0) {
    if (!this.ligado() || !Atelie.def || !Atelie.naNuvem || (this.ativo && this.ad?.ctx === 'animador')) return; if (this.ativo && this.sala === 'at-' + Atelie.def.id) return;
    const id = Atelie.def.id; if (await this.entrar(this.adAtelie(), { meta: { tipo: 'atelie', nome: Atelie.def.nome } })) return;
    if (/liberada/.test(this.erro || '')) { const m = await this.liberar(); if (m === 'ok') { if (Atelie.def?.id === id && await this.entrar(this.adAtelie(), { meta: { tipo: 'atelie', nome: Atelie.def.nome } })) return; } else { this.erro = m; n = 4; } }
    if (n < 4) { clearTimeout(this._tenta); this._tenta = setTimeout(() => { if (Atelie.def?.id === id) this.entrarAtelie(n + 1).catch(() => { }); }, 5000); return; }
    UI.toast('Trabalhar junto ao vivo: ' + esc(this.erro || 'não consegui entrar'), { kind: 'warn', time: 10000 });
  },
  async baixarSala(sala) {
    const t = await this.transporte(), st = await t.estado(sala); if (!st.snap) return null;
    const d = Difs.aplica(JSON.parse(st.snap.j), (st.ops || []).flatMap(op => JSON.parse(op.j || '[]'))); const ant = { t: this.t, sala: this.sala, subidas: this.subidas };
    this.t = t; this.sala = sala; this.subidas = new Set(); try { await this.garanteArqs(Toon.ids(d)); } finally { Object.assign(this, ant.sala ? ant : { t: ant.t, sala: null, subidas: ant.subidas }); }
    return { P: d, meta: st.meta };
  },
  // lista das salas do Animador abertas agora (para "Entrar")
  ouvirLista(cb) { if (!this.ligado()) return () => { }; let off = () => { }; this.transporte().then(t => { off = t.ouvirLista(l => cb(Object.entries(l).map(([sala, m]) => ({ sala, ...m })).filter(x => x.tipo === 'animador' && !x.fim))); }).catch(() => cb([])); return () => off(); },
};
