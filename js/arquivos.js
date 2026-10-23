/* ===================== arquivos.js — tamanho de cada arquivo (KB/MB) e cópias locais =====================
   Tamanho de uma animação = o projeto + as imagens/áudios dela guardados neste computador.
   Tamanho de um personagem = o personagem.json + as imagens (na nuvem vem da lista; local, das imagens daqui).
   "Anterior": depois de trabalhar junto ao vivo, a versão de antes fica marcada (P.anterior) até alguém mudar nela. */
'use strict';
const Arquivos = {
  fmt(b) { if (!isFinite(b) || b <= 0) return ''; if (b < 1048576) { const k = b / 1024; return (k < 10 ? k.toFixed(1) : Math.round(k)) + ' KB'; } const m = b / 1048576; return (m < 10 ? m.toFixed(1) : Math.round(m)) + ' MB'; },
  _cache: new Map(),
  async somaBlobs(ids) { let t = 0; for (const id of ids) { try { const b = await Arq.pegaBlob(id); if (b) t += b.size; } catch { } } return t; },
  async tamProjeto(P) {
    const ch = 'p:' + P.id + ':' + P.modificado; if (this._cache.has(ch)) return this._cache.get(ch);
    const v = (async () => new Blob([JSON.stringify({ ...P, thumb: undefined })]).size + await this.somaBlobs(Toon.ids(P)))(); this._cache.set(ch, v); return v;
  },
  async tamDef(def, em) {
    const ch = 'd:' + def.id + ':' + (em || def.modificado || ''); if (this._cache.has(ch)) return this._cache.get(ch);
    const v = (async () => new Blob([JSON.stringify(def)]).size + await this.somaBlobs(Modelo.chavesImgs(def)))(); this._cache.set(ch, v); return v;
  },
  // escreve o tamanho num elemento quando ficar pronto
  poe(el, prom) { Promise.resolve(prom).then(b => { const t = this.fmt(b); if (t && el.isConnected !== false) { el.textContent = t; el.hidden = false; } }).catch(() => { }); },
  // personagem duplicado só neste computador: id novo, imagens copiadas com as chaves novas
  // NOME REPETIDO: o mais novo ganha " (1)", " (2)"… (o menor número livre). Ignora o próprio id e o " (n)" do fim para achar a base
  nomeUnico(nome, nomes) {
    nome = String(nome || '').trim() || 'Sem nome'; const L = new Set([...nomes].map(n => String(n || '').trim().toLowerCase())); if (!L.has(nome.toLowerCase())) return nome;
    const base = nome.replace(/\s*\(\d+\)$/, ''); for (let i = 1; i < 9999; i++) { const c = `${base} (${i})`; if (!L.has(c.toLowerCase())) return c; } return nome;
  },
  // nomes já usados por PERSONAGENS (nuvem da equipe + rascunhos deste computador) e por ANIMAÇÕES (deste computador), tirando o próprio id
  async nomesPersonagens(semId) { const [L, rs] = await Promise.all([Nuvem.lista().catch(() => []), Atelie.rascunhos().catch(() => [])]); return [...L.filter(x => x.id !== semId).map(x => x.nome), ...rs.filter(r => r.def?.id !== semId).map(r => r.def?.nome)]; },
  async nomesAnimacoes(semId) { return (await DB.all('projetos').catch(() => [])).filter(p => p.id !== semId).map(p => p.nome); },
  async nomePersonagem(nome, semId) { return this.nomeUnico(nome, await this.nomesPersonagens(semId)); },
  async nomeAnimacao(nome, semId) { return this.nomeUnico(nome, await this.nomesAnimacoes(semId)); },
  async duplicarPersonagem(def0, thumb, nome, extra) {
    const novo = uid('c').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20), velho = def0.id;
    let txt = JSON.stringify(def0); txt = txt.split(`personagens/${velho}/`).join(`personagens/${novo}/`); const def = JSON.parse(txt);
    def.id = novo; def.nome = await this.nomePersonagem(nome || (def0.nome || 'Personagem') + ' (cópia)', novo); delete def._mod; def.modificado = Date.now(); if (extra) Object.assign(def, extra);
    const t = UI.toast('<span class="spin-dot"></span> Copiando as imagens…', { time: 120000 });
    try { for (const k of Modelo.chavesImgs(def0)) { let b = await Arq.pegaBlob(k); if (!b) b = await Nuvem.baixar(k).catch(() => null); if (b) await Arq.guardar(b, k.split(`personagens/${velho}/`).join(`personagens/${novo}/`)); }
      await DB.put('arquivos', { tipo: 'rascunho-atelie', def, em: Date.now(), thumb: thumb || def0.thumb || null, nuvem: false }, 'rascunho:' + novo); }
    finally { t.remove(); }
    UI.toast(`<b>${esc(def.nome)}</b> criado só neste computador (em "Só neste computador").`, { kind: 'ok' }); return def;
  },
};
