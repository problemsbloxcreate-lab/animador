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
    await this.pede('/personagens/arquivo?k=' + encodeURIComponent(`personagens/${def.id}/personagem.json`) + '&nome=' + encodeURIComponent(def.nome || ''), { method: 'POST', body: JSON.stringify(def), headers: { 'content-type': 'application/json' } });
    await DB.put('personagens', JSON.parse(JSON.stringify(def)));
    // imagens que saíram do personagem não ficam ocupando espaço na nuvem
    const usadas = new Set(imgs);
    for (const k of existentes) if (k.startsWith(`personagens/${def.id}/img/`) && !usadas.has(k)) await this.pede('/personagens/arquivo?k=' + encodeURIComponent(k), { method: 'DELETE' }).catch(() => { });
  },
  async apagar(id) { await this.pede('/personagens/arquivo?k=' + encodeURIComponent(`personagens/${id}/`), { method: 'DELETE' }); await DB.del('personagens', id); },

  /* ---------- cenários da equipe: só entram aqui quando alguém escolhe "Salvar na nuvem" (botão direito na camada) ---------- */
  async cenarios() { const j = await (await this.pede('/cenarios')).json(); return (j.itens || []).sort((a, b) => String(b.em || '').localeCompare(String(a.em || ''))); },
  async baixarCenario(k) { const b0 = await DB.get('arquivos', k); if (b0) return b0; const b = await (await this.pede('/cenarios/arquivo?k=' + encodeURIComponent(k))).blob(); await DB.put('arquivos', b, k); return b; },
  async salvarCenario(n) {
    let b = await Arq.pegaBlob(n.arq); if (!b) throw new Error('A imagem desta camada não está neste computador.');
    if (b.size > 1.5 * 1048576) { try { const bm = await createImageBitmap(b), c = new OffscreenCanvas(bm.width, bm.height); c.getContext('2d').drawImage(bm, 0, 0); const w = await c.convertToBlob({ type: 'image/webp', quality: .92 }); if (w.size < b.size) b = w; } catch { } } // menor na nuvem
    const ext = { 'image/png': 'png', 'image/webp': 'webp' }[b.type] || 'jpg';
    const slug = String(n.nome || 'cenario').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'cenario';
    const k = `cenarios/${/^[a-z0-9]/.test(slug) ? slug : 'c-' + slug}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    await this.pede(`/cenarios/arquivo?k=${encodeURIComponent(k)}&nome=${encodeURIComponent(n.nome || 'Cenário')}${n.ia ? '&ia=1' : ''}`, { method: 'POST', body: b, headers: { 'content-type': b.type || 'image/jpeg' } });
    await DB.put('arquivos', b, k); return k;
  },
  async apagarCenario(k) { await this.pede('/cenarios/arquivo?k=' + encodeURIComponent(k), { method: 'DELETE' }); },
};

/* ---------- escolher um cenário da nuvem da equipe ---------- */
const CenariosNuvem = {
  async escolher() {
    if (!App.P) return;
    const body = h('<div><div class="vazio"><span class="spin-dot"></span> Carregando os cenários da equipe…</div></div>'), urls = [];
    const p = UI.modal({ title: 'Cenários da equipe', icon: 'cloud', width: 720, body, buttons: [{ label: 'Prontos e com a IA…', kind: 'ia', left: true, onClick: () => { setTimeout(() => Cenarios.abrir(), 50); return true; } }, { label: 'Fechar', value: null }] });
    const pinta = async () => {
      let lista; try { lista = await Nuvem.cenarios(); } catch (e) { body.innerHTML = `<div class="vazio">Não consegui abrir: ${esc(e.message)}</div>`; return; }
      if (!lista.length) { body.innerHTML = '<div class="vazio">Nenhum cenário na nuvem ainda.<br>Ponha um cenário (pronto, da IA ou uma imagem) e use o botão direito › <b>Salvar na nuvem</b>.</div>'; return; }
      body.innerHTML = ''; const g = h('<div class="grade cen-g"></div>'); body.appendChild(g);
      for (const it of lista) {
        const c = h(`<div class="pc"><div class="th" style="aspect-ratio:16/10"><span class="spin-dot"></span></div><div class="in"><b>${esc(it.nome || 'Cenário')}${it.ia ? ' <span class="tag-ia">IA</span>' : ''}</b><small>${it.em ? fmtDate(Date.parse(it.em)) : ''}${it.por ? ` · <span data-quem="${esc(it.por)}"></span>` : ''}</small></div><button class="ibtn mn" title="Apagar da nuvem">${ic('trash', 14)}</button></div>`);
        Nuvem.baixarCenario(it.k).then(b => { const u = URL.createObjectURL(b); urls.push(u); const th = $('.th', c); th.innerHTML = ''; th.style.backgroundImage = `url('${u}')`; }).catch(() => { $('.th', c).innerHTML = ic('alert', 18); });
        c.onclick = async e => {
          if (e.target.closest('.mn')) return; c.style.opacity = .5;
          try { const b = await Nuvem.baixarCenario(it.k); const n = await App.addCenario(b, it.nome || 'Cenário'); n.nuvem = it.k; App.commit('Cenário da nuvem'); $('#modal-root .modal-back [data-x]')?.click(); }
          catch (er) { c.style.opacity = 1; UI.toast(esc(er.message), { kind: 'err' }); }
        };
        $('.mn', c).onclick = async e => { e.stopPropagation(); if (!(await UI.confirm({ title: 'Apagar da nuvem da equipe?', msg: `"<b>${esc(it.nome || 'Cenário')}</b>" some para todo mundo. As animações que já usam continuam com a cópia delas.`, ok: 'Apagar', danger: true }))) return;
          try { await Nuvem.apagarCenario(it.k); pinta(); } catch (er) { UI.toast(esc(er.message), { kind: 'err' }); } };
        g.appendChild(c);
      }
    };
    pinta(); await p; urls.forEach(u => setTimeout(() => URL.revokeObjectURL(u), 3000));
  },
};
