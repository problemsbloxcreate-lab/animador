/* ===================== nuvem.js — biblioteca de personagens da equipe (nuvem do Estúdio Problems, com o login do Google) =====================
   Cada personagem é uma pasta "personagens/<id>/" com personagem.json + imagens. Toda a equipe vê e usa a mesma biblioteca,
   e o navegador guarda uma cópia para abrir rápido (e sem internet). */
'use strict';
const Nuvem = {
  get srv() { return (typeof TURMA_CONFIG !== 'undefined' && TURMA_CONFIG.iaServidor || '').replace(/\/+$/, ''); },
  async hd() { try { const t = await TurmaAuth.token(); return t ? { authorization: 'Bearer ' + t } : {}; } catch { return {}; } },
  async pede(caminho, o = {}) {
    const r = await fetch(this.srv + caminho, { ...o, headers: { ...(await this.hd()), ...(o.headers || {}) } });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error?.message || 'A nuvem respondeu ' + r.status); }
    return r;
  },
  // lista os personagens da equipe: [{ id, nome, pasta, thumb, por, em }]
  async lista() {
    const j = await (await this.pede('/personagens')).json(), ids = new Set();
    for (const it of j.itens || []) { const m = it.k.match(/^personagens\/([^/]+)\/personagem\.json$/); if (m) ids.add(m[1]); }
    const out = [];
    await Promise.all([...ids].map(async id => { try { const d = await this.abrir(id, true); out.push({ id, nome: d.nome, pasta: d.pasta || 'Personagens', thumb: d.thumb, modificado: d.modificado, por: d.por }); } catch { } }));
    return out.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt'));
  },
  // definição do personagem (da nuvem; se estiver sem internet, a cópia do navegador)
  async abrir(id, rapido) {
    try { const d = await (await this.pede('/personagens/arquivo?k=' + encodeURIComponent(`personagens/${id}/personagem.json`))).json(); await DB.put('personagens', d); return d; }
    catch (e) { const local = await DB.get('personagens', id); if (local) return local; throw e; }
  },
  async baixar(k) { const b = await (await this.pede('/personagens/arquivo?k=' + encodeURIComponent(k))).blob(); await DB.put('arquivos', b, k); return b; },
  // salva: manda as imagens que ainda não estão na nuvem e depois o personagem.json
  async salvar(def, aoAndar) {
    const existentes = new Set(); try { const j = await (await this.pede('/personagens')).json(); for (const it of j.itens || []) existentes.add(it.k); } catch { }
    const imgs = def.partes.flatMap(p => p.imgs.map(i => i.k)).filter(Boolean), falta = imgs.filter(k => !existentes.has(k));
    let n = 0;
    for (const k of falta) {
      const b = await Arq.pegaBlob(k); if (!b) continue;
      aoAndar?.(`Enviando imagens… ${++n}/${falta.length}`);
      await this.pede('/personagens/arquivo?k=' + encodeURIComponent(k), { method: 'POST', body: b });
    }
    def.modificado = Date.now();
    aoAndar?.('Salvando o personagem…');
    await this.pede('/personagens/arquivo?k=' + encodeURIComponent(`personagens/${def.id}/personagem.json`), { method: 'POST', body: JSON.stringify(def), headers: { 'content-type': 'application/json' } });
    await DB.put('personagens', JSON.parse(JSON.stringify(def)));
    // imagens que saíram do personagem não ficam ocupando espaço na nuvem
    const usadas = new Set(imgs);
    for (const k of existentes) if (k.startsWith(`personagens/${def.id}/img/`) && !usadas.has(k)) await this.pede('/personagens/arquivo?k=' + encodeURIComponent(k), { method: 'DELETE' }).catch(() => { });
  },
  async apagar(id) { await this.pede('/personagens/arquivo?k=' + encodeURIComponent(`personagens/${id}/`), { method: 'DELETE' }); await DB.del('personagens', id); },
};
