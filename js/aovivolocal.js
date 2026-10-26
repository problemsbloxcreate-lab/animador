/* ===================== aovivolocal.js — transporte de TESTE do "trabalhar junto" (entre abas do mesmo navegador) =====================
   Mesmo jeito do AoVivoFirebase, mas por BroadcastChannel + localStorage. Só é usado quando alguém chama
   AoVivo.usaTransporte(AoVivoLocal) (testes automáticos). Não tem nada a ver com o login. */
'use strict';
const AoVivoLocal = {
  bc: null, cbs: [], gente: {}, n: 0,
  async abre() { if (!this.bc) { this.bc = new BroadcastChannel('animador-aovivo-teste'); this.bc.onmessage = e => this.chega(e.data); } return this; },
  k(p) { return 'aovivo-teste:' + p; }, le(p) { try { return JSON.parse(localStorage.getItem(this.k(p)) || 'null'); } catch { return null; } }, grava(p, v) { localStorage.setItem(this.k(p), JSON.stringify(v)); },
  manda(m) { this.bc.postMessage(m); setTimeout(() => this.chega(m, true), 0); },
  chega(m) { for (const c of this.cbs) if (c.sala === m.sala || c.tipo === 'lista') c.cb(m); },
  async estado(sala) { const snap = this.le(`${sala}/snap`), ops = (this.le(`${sala}/ops`) || []).filter(o => !snap?.ate || o.k > snap.ate); return { snap, gente: this.le(`${sala}/gente`) || {}, meta: this.le(`${sala}/meta`), ops }; },
  async setSnap(sala, s) { this.grava(`${sala}/snap`, s); },
  async setMeta(sala, m) { this.grava(`${sala}/meta`, { ...(this.le(`${sala}/meta`) || {}), ...m }); const l = this.le('lista') || {}; l[sala] = { ...(l[sala] || {}), ...m }; this.grava('lista', l); this.manda({ tipo: 'meta', sala, m: this.le(`${sala}/meta`) }); this.manda({ tipo: 'lista' }); },
  ouvirMeta(sala, cb) { this.cbs.push({ sala, cb: m => { if (m.tipo === 'meta') cb(m.m || {}); } }); },
  ouvirOps(sala, depois, cb) { this.cbs.push({ sala, cb: m => { if (m.tipo === 'op' && (!depois || m.op.k > depois)) cb(m.op); } }); },
  enviar(sala, op) { const k = Date.now().toString(36).padStart(9, '0') + (this.n++).toString(36).padStart(4, '0') + Math.random().toString(36).slice(2, 6), o = { k, ...op }; const l = this.le(`${sala}/ops`) || []; l.push(o); this.grava(`${sala}/ops`, l); this.manda({ tipo: 'op', sala, op: o }); return k; },
  async presenca(sala, id, d, primeira) { this.gente[sala] = this.gente[sala] || {}; const g = this.gente[sala][id] = { ...(this.gente[sala][id] || {}), ...d, ...(primeira ? { t: Date.now() } : {}) }; if (primeira) { const G = this.le(`${sala}/gente`) || {}; G[id] = g; this.grava(`${sala}/gente`, G); } this.manda({ tipo: 'gente', sala, id, g }); if (primeira) this.manda({ tipo: 'quem', sala }); },
  ouvirGente(sala, cb) { this.gente[sala] = this.gente[sala] || {}; this.cbs.push({ sala, cb: m => { const G = this.gente[sala];
    if (m.tipo === 'gente') { G[m.id] = m.g; cb({ ...G }); } else if (m.tipo === 'sai') { delete G[m.id]; cb({ ...G }); }
    else if (m.tipo === 'quem' && AoVivo.ativo && AoVivo.sala === sala) this.bc.postMessage({ tipo: 'gente', sala, id: AoVivo.eu.id, g: G[AoVivo.eu.id] }); } }); },
  async podaOps(sala, ks) { const l = (this.le(`${sala}/ops`) || []).filter(o => !ks.includes(o.k)); this.grava(`${sala}/ops`, l); }, async genteDe(sala) { const G = this.le(`${sala}/gente`) || {}; return Object.keys(G).length ? G : null; },
  async putArq(sala, k, b64) { this.grava(`${sala}/arq/${k}`, b64); }, async getArq(sala, k) { return this.le(`${sala}/arq/${k}`); },
  async sair(sala, id) { this.cbs = this.cbs.filter(c => c.tipo === 'lista'); this.manda({ tipo: 'sai', sala, id }); delete this.gente[sala]?.[id]; const G = this.le(`${sala}/gente`) || {}; delete G[id]; this.grava(`${sala}/gente`, G); if (!Object.keys(G).length) await this.apagar(sala); },
  async apagar(sala) { for (const k of Object.keys(localStorage)) if (k.startsWith(this.k(sala + '/'))) localStorage.removeItem(k); const l = this.le('lista') || {}; delete l[sala]; this.grava('lista', l); this.manda({ tipo: 'lista' }); },
  ouvirLista(cb) { const f = { tipo: 'lista', cb: m => { if (m.tipo === 'lista') cb(this.le('lista') || {}); } }; this.cbs.push(f); cb(this.le('lista') || {}); return () => { this.cbs = this.cbs.filter(x => x !== f); }; },
};
