/* ===================== nuvemanim.js — ANIMAÇÕES NA NUVEM DA EQUIPE (decisão do dono, 28/10/2026) =====================
   Antes as animações (os Shorts) ficavam SÓ no navegador onde foram feitas: outro perfil do Chrome, outro computador ou
   "limpar os dados" = sumiam. Agora cada animação vai sozinha para a nuvem da equipe (servidor turma-ia, rotas /animacoes):
   - animacoes/<id>/animacao.json = o projeto (camadas, chaves, legendas, cópias dos personagens) + o mapa das mídias
   - animacoes/arq/<sha-256> = cada imagem/áudio, UMA vez só (a mesma voz salva 100 vezes ou usada em 10 animações = 1 gravação)
   - imagens de personagem que já estão na nuvem da equipe (personagens/…) não sobem de novo
   ECONOMIA (limite grátis da Cloudflare: 1000 gravações/dia): manda 90 s depois da última mudança e ao esconder a aba,
   só se mudou algo desde o último envio (assinatura). A tela inicial mostra as da nuvem em "Na nuvem da equipe". */
'use strict';
const NuvemAnim = {
  ESPERA: 90e3,
  _t: null, _feitos: null, _pers: null, _enviando: null,
  idOk: id => /^[a-z0-9][a-z0-9-]{1,40}$/.test(String(id || '')),
  async hash(b) { const d = await crypto.subtle.digest('SHA-256', await b.arrayBuffer()); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); },
  sig(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; },
  async feitos() { if (!this._feitos) { let r = null; try { r = await DB.get('arquivos', 'nuvem-anim-hashes'); } catch { } this._feitos = new Set(r?.hs || []); } return this._feitos; },
  async guardaFeitos() { try { await DB.put('arquivos', { tipo: 'nuvem-anim', hs: [...this._feitos].slice(-20000) }, 'nuvem-anim-hashes'); } catch { } },
  // imagens que já estão na biblioteca de personagens da equipe (1 listagem a cada 10 min no máximo)
  async naBiblioteca() {
    if (this._pers && Date.now() - this._pers.at < 600e3) return this._pers.s;
    const s = new Set(); try { const j = await (await Nuvem.pede('/personagens')).json(); for (const it of j.itens || []) s.add(it.k); } catch { }
    this._pers = { s, at: Date.now() }; return s;
  },
  agenda() { if (!App.P || !this.idOk(App.P.id)) return; clearTimeout(this._t); this._t = setTimeout(() => this.manda(App.P), this.ESPERA); },
  agora() { if (this._t) { clearTimeout(this._t); this._t = null; if (App.P) return this.manda(App.P); } },
  async manda(P, o = {}) {
    if (this._enviando) { await this._enviando.catch(() => { }); }
    this._enviando = Ocupado.mantem(() => this.salvar(P, o)).catch(e => { this.estado = 'erro'; this.erro = e.message; App.pintaNuvemAnim?.(); if (o.lanca) throw e; });
    return this._enviando;
  },
  // manda a animação para a nuvem. Devolve true se gravou, false se já estava igual
  async salvar(P, o = {}) {
    if (!this.idOk(P.id)) throw new Error('o código desta animação não é aceito pela nuvem (duplique e salve a cópia).');
    const ant = await DB.get('arquivos', 'nuvem-anim:' + P.id).catch(() => null);
    const feitos = await this.feitos(), bib = await this.naBiblioteca(), arqs = {};
    this.estado = 'enviando'; App.pintaNuvemAnim?.();
    let n = 0; const ids = Toon.ids(P);
    for (const id of ids) {
      if (/^personagens\//.test(id) && bib.has(id)) continue;          // já está na biblioteca da equipe
      const b = await Arq.pegaBlob(id); if (!b) continue;
      const h = (ant?.tam?.[id] === b.size && ant?.arqs?.[id]) || await this.hash(b);
      if (!feitos.has(h)) {
        o.aoAndar?.(`Enviando imagens e áudios… ${++n}`);
        await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent('animacoes/arq/' + h), { method: 'POST', body: b, headers: { 'content-type': b.type || 'application/octet-stream' } });
        feitos.add(h);
      }
      arqs[id] = h;
    }
    if (n) await this.guardaFeitos();
    const corpo = JSON.stringify({ v: 1, P: { ...P, thumb: undefined }, arqs }), s = this.sig(corpo);
    let gravou = false;
    if (ant?.sig !== s) {
      o.aoAndar?.('Salvando a animação…');
      const qs = new URLSearchParams({ k: `animacoes/${P.id}/animacao.json`, nome: P.nome || '', w: P.w, h: P.h, dur: P.duracao });
      await Nuvem.pede('/animacoes/arquivo?' + qs, { method: 'POST', body: corpo, headers: { 'content-type': 'application/json' } }); gravou = true;
    }
    let sigT = ant?.sigT;
    if (P.thumb && this.sig(P.thumb) !== ant?.sigT) { try { const b = await (await fetch(P.thumb)).blob(); await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(`animacoes/${P.id}/miniatura.jpg`), { method: 'POST', body: b, headers: { 'content-type': 'image/jpeg' } }); sigT = this.sig(P.thumb); } catch { } }
    const tam = {}; for (const id of Object.keys(arqs)) { const b = await Arq.pegaBlob(id); if (b) tam[id] = b.size; }
    await DB.put('arquivos', { tipo: 'nuvem-anim', sig: s, sigT, arqs, tam, em: Date.now() }, 'nuvem-anim:' + P.id).catch(() => { });
    this.estado = 'ok'; this.em = Date.now(); this._lista = null; App.pintaNuvemAnim?.();
    return gravou;
  },
  async lista(novo) {
    if (!novo && this._lista && Date.now() - this._lista.at < 120e3) return this._lista.l;
    const j = await (await Nuvem.pede('/animacoes')).json(); const l = (j.itens || []).sort((a, b) => (b.mod || 0) - (a.mod || 0));
    this._lista = { l, at: Date.now() }; return l;
  },
  // baixa da nuvem (com as mídias que faltam neste navegador) e guarda no navegador; devolve o projeto
  async baixar(id, aoAndar) {
    const j = await (await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(`animacoes/${id}/animacao.json`))).json();
    const P = j.P, arqs = j.arqs || {}, falta = [];
    for (const [k, h] of Object.entries(arqs)) if (!(await Arq.pegaBlob(k))) falta.push([k, h]);
    let n = 0; for (const [k, h] of falta) { aoAndar?.(`Baixando imagens e áudios… ${++n}/${falta.length}`); const b = await (await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent('animacoes/arq/' + h))).blob(); await Arq.guardar(b, k); }
    (await this.feitos()); for (const h of Object.values(arqs)) this._feitos.add(h); await this.guardaFeitos();
    try { const r = await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(`animacoes/${id}/miniatura.jpg`)); const b = await r.blob(); P.thumb = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }); } catch { }
    const tam = {}; for (const k of Object.keys(arqs)) { const b = await Arq.pegaBlob(k); if (b) tam[k] = b.size; }
    await DB.put('projetos', JSON.parse(JSON.stringify(P)));
    await DB.put('arquivos', { tipo: 'nuvem-anim', sig: this.sig(JSON.stringify({ v: 1, P: { ...P, thumb: undefined }, arqs })), arqs, tam, em: Date.now() }, 'nuvem-anim:' + P.id).catch(() => { });
    return P;
  },
  async abrir(it) {
    const local = await DB.get('projetos', it.id).catch(() => null);
    if (local && (local.modificado || 0) > (it.mod || 0) + 5e3) {
      const q = await UI.modal({ title: 'Esta animação também está neste computador', icon: 'cloud', width: 460, body: `<div>A cópia deste computador de <b>${esc(it.nome || local.nome)}</b> é <b>mais nova</b> que a da nuvem.</div>`, buttons: [{ label: 'Abrir a deste computador', kind: 'primary', value: 'local' }, { label: 'Abrir a da nuvem', value: 'nuvem' }] });
      if (q === 'local') return App.abrir(local); if (q !== 'nuvem') return;
    }
    let P; await Ocupado.nuvem(`Abrindo "${it.nome || 'animação'}" da nuvem`, async () => { P = await this.baixar(it.id, t => Ocupado.anda(t)); });
    if (P) App.abrir(P);
  },
  // manda TODAS as animações deste navegador (as que ainda não estão lá ou mudaram)
  async mandarTodas() {
    const ps = (await DB.all('projetos')).filter(p => this.idOk(p.id)); let ok = 0, err = [];
    await Ocupado.nuvem('Mandando as animações deste computador para a nuvem', async () => {
      for (let i = 0; i < ps.length; i++) { Ocupado.anda(`Animação ${i + 1}/${ps.length}: ${ps[i].nome}`); try { await this.salvar(ps[i]); ok++; } catch (e) { err.push(ps[i].nome + ': ' + e.message); if (/limite|cheio/i.test(e.message)) break; } }
    });
    UI.toast(err.length ? `${ok} na nuvem; ${err.length} não foram: ${esc(err[0])}` : `Pronto: ${ok} animações estão na nuvem da equipe.`, { kind: err.length ? 'warn' : 'ok', time: 8000 });
  },
};
addEventListener('pagehide', () => { NuvemAnim.agora(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) NuvemAnim.agora(); });
