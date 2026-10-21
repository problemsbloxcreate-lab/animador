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
    await Promise.all([...ids].map(async id => { try { const d = await this.abrir(id, true); out.push({ id, nome: d.nome, pasta: d.pasta || 'Personagens', thumb: d.thumb, modificado: d.modificado, por: d.por, autor: d.autor, edicoes: d.edicoes }); } catch { } }));
    return out.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt'));
  },
  // definição do personagem (da nuvem; se estiver sem internet, a cópia do navegador)
  async abrir(id, rapido) {
    try { const d = await (await this.pede('/personagens/arquivo?k=' + encodeURIComponent(`personagens/${id}/personagem.json`))).json(); await DB.put('personagens', d); return d; }
    catch (e) { const local = await DB.get('personagens', id); if (local) return local; throw e; }
  },
  async baixar(k) { const b = await (await this.pede('/personagens/arquivo?k=' + encodeURIComponent(k))).blob(); await DB.put('arquivos', b, k); return b; },
  // salva: manda as imagens que ainda não estão na nuvem e depois o personagem.json
  // quem é ADM pode apagar da nuvem; os outros recebem o aviso para pedir a um ADM (o servidor também confere)
  adm: false, // guardado da última vez que perguntou (para o menu já sair certo)
  async souAdm() { try { return (this.adm = !!(await window.EstudioConta?.perfil?.())?.adm); } catch { return false; } },
  async pedeAdm(nome) { if (window.EstudioConta?.nuvem?.pedeAdm) return window.EstudioConta.nuvem.pedeAdm(nome); return UI.modal({ title: 'Só um ADM pode apagar da nuvem', icon: 'cloud', width: 440, body: `<div>Peça para um ADM apagar <b>${esc(nome || 'isso')}</b> da nuvem da equipe (no menu, ADM › Nuvem).</div>`, buttons: [{ label: 'Entendi', kind: 'primary', value: true }] }); },
  avisaEspaco() { try { window.EstudioConta?.nuvem?.atualizar?.(); } catch { } },
  // o que já está na nuvem de cada personagem fica guardado aqui depois da 1ª vez (o "salvar" automático não lista a nuvem toda a cada mudança)
  _ks: new Map(),
  async salvar(def, aoAndar) {
    let existentes = this._ks.get(def.id);
    if (!existentes) { existentes = new Set(); try { const j = await (await this.pede('/personagens')).json(); for (const it of j.itens || []) if (it.k.startsWith(`personagens/${def.id}/`)) existentes.add(it.k); } catch { } this._ks.set(def.id, existentes); }
    // NA NUVEM VAI EM WEBP (bem menor: na arte dos personagens fica ~5x menor que PNG). Neste computador a imagem original fica guardada.
    const troca = await this.paraWebp(def, aoAndar); this.ultimaTroca = troca;
    const imgs = [...def.partes.flatMap(p => p.imgs.map(i => i.k)), def.vis?.fantasma?.k].filter(Boolean), falta = imgs.filter(k => !existentes.has(k));
    let n = 0;
    for (const k of falta) {
      const b = await Arq.pegaBlob(k); if (!b) continue;
      aoAndar?.(`Enviando imagens… ${++n}/${falta.length}`);
      await this.pede('/personagens/arquivo?k=' + encodeURIComponent(k), { method: 'POST', body: b }); existentes.add(k);
    }
    def.modificado = Date.now(); await Autores.marca(def); // quem subiu (fica para sempre) e quem editou
    aoAndar?.('Salvando o personagem…');
    await this.pede('/personagens/arquivo?k=' + encodeURIComponent(`personagens/${def.id}/personagem.json`) + '&nome=' + encodeURIComponent(def.nome || ''), { method: 'POST', body: JSON.stringify(def), headers: { 'content-type': 'application/json' } });
    await DB.put('personagens', JSON.parse(JSON.stringify(def)));
    // imagens que saíram do personagem não ficam ocupando espaço na nuvem
    const usadas = new Set(imgs);
    for (const k of [...existentes]) if (k.startsWith(`personagens/${def.id}/img/`) && !usadas.has(k)) { await this.pede('/personagens/arquivo?k=' + encodeURIComponent(k), { method: 'DELETE' }).catch(() => { }); existentes.delete(k); }
    existentes.add(`personagens/${def.id}/personagem.json`); this.avisaEspaco();
  },
  // converte as imagens PNG/JPG do personagem para WEBP (só se ficar menor) e troca as chaves no def; devolve { chaveVelha: chaveNova }
  async paraWebp(def, aoAndar) {
    const troca = {}, alvos = [...new Set([...def.partes.flatMap(p => p.imgs.map(i => i.k)), def.vis?.fantasma?.k].filter(k => k && /\.(png|jpe?g)$/i.test(k)))]; let n = 0;
    for (const k of alvos) {
      try { let b = await Arq.pegaBlob(k); if (!b) b = await this.baixar(k).catch(() => null); if (!b) continue; aoAndar?.(`Compactando as imagens (webp)… ${++n}/${alvos.length}`);
        const bm = await createImageBitmap(b), c = new OffscreenCanvas(bm.width, bm.height); c.getContext('2d').drawImage(bm, 0, 0);
        const w = await c.convertToBlob({ type: 'image/webp', quality: .92 }); if (w.type !== 'image/webp' || w.size >= b.size * .95) continue; // navegador sem webp, ou não ficou menor
        const nk = k.replace(/\.(png|jpe?g)$/i, '.webp'); await Arq.guardar(w, nk); Arq.img.set(nk, await createImageBitmap(w)); troca[k] = nk;
      } catch { }
    }
    for (const p of def.partes) for (const i of p.imgs) if (troca[i.k]) i.k = troca[i.k];
    if (def.vis?.fantasma?.k && troca[def.vis.fantasma.k]) def.vis.fantasma.k = troca[def.vis.fantasma.k];
    return troca;
  },
  // aplica a troca de chaves num texto JSON do personagem
  remapear(txt, troca) { if (!txt) return txt; for (const [a, b] of Object.entries(troca || {})) txt = txt.split(JSON.stringify(a)).join(JSON.stringify(b)); return txt; },
  async apagar(id) { await this.pede('/personagens/arquivo?k=' + encodeURIComponent(`personagens/${id}/`), { method: 'DELETE' }); await DB.del('personagens', id); this._ks.delete(id); this.avisaEspaco(); },

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
    await DB.put('arquivos', b, k); this.avisaEspaco(); return k;
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
      await Nuvem.souAdm();
      let lista; try { lista = await Nuvem.cenarios(); } catch (e) { body.innerHTML = `<div class="vazio">Não consegui abrir: ${esc(e.message)}</div>`; return; }
      if (!lista.length) { body.innerHTML = '<div class="vazio">Nenhum cenário na nuvem ainda.<br>Ponha um cenário (pronto, da IA ou uma imagem) e use o botão direito › <b>Salvar na nuvem</b>.</div>'; return; }
      body.innerHTML = ''; const g = h('<div class="grade cen-g"></div>'); body.appendChild(g);
      for (const it of lista) {
        const c = h(`<div class="pc"><div class="th" style="aspect-ratio:16/10"><span class="spin-dot"></span></div><div class="in"><b>${esc(it.nome || 'Cenário')}${it.ia ? ' <span class="tag-ia">IA</span>' : ''}</b><small>${it.em ? fmtDate(Date.parse(it.em)) : ''}${it.por ? ` · <span data-quem="${esc(it.por)}"></span>` : ''}</small></div><button class="ibtn mn${Nuvem.adm ? '' : ' so-adm'}" title="${Nuvem.adm ? 'Apagar da nuvem' : 'Só um ADM pode apagar da nuvem'}">${ic(Nuvem.adm ? 'trash' : 'lock', 14)}</button></div>`);
        Nuvem.baixarCenario(it.k).then(b => { const u = URL.createObjectURL(b); urls.push(u); const th = $('.th', c); th.innerHTML = ''; th.style.backgroundImage = `url('${u}')`; }).catch(() => { $('.th', c).innerHTML = ic('alert', 18); });
        c.onclick = async e => {
          if (e.target.closest('.mn')) return; c.style.opacity = .5;
          try { const b = await Nuvem.baixarCenario(it.k); const n = await App.addCenario(b, it.nome || 'Cenário'); n.nuvem = it.k; App.commit('Cenário da nuvem'); $('#modal-root .modal-back [data-x]')?.click(); }
          catch (er) { c.style.opacity = 1; UI.toast(esc(er.message), { kind: 'err' }); }
        };
        $('.mn', c).onclick = async e => { e.stopPropagation(); if (!(await Nuvem.souAdm())) return Nuvem.pedeAdm(it.nome || 'este cenário'); if (!(await UI.confirm({ title: 'Apagar da nuvem da equipe?', msg: `"<b>${esc(it.nome || 'Cenário')}</b>" some para todo mundo. As animações que já usam continuam com a cópia delas.`, ok: 'Apagar', danger: true }))) return;
          try { await Nuvem.apagarCenario(it.k); pinta(); } catch (er) { UI.toast(esc(er.message), { kind: 'err' }); } };
        g.appendChild(c);
      }
    };
    pinta(); await p; urls.forEach(u => setTimeout(() => URL.revokeObjectURL(u), 3000));
  },
};

/* ---------- quem subiu / quem editou cada personagem da nuvem ----------
   def.autor = quem subiu primeiro (nunca muda) · def.edicoes = a última vez que cada pessoa salvou (as 12 mais recentes).
   No cartão aparece a foto e o nome no canto; passando o mouse, um balão mostra quando subiu e quem mexeu, com as datas. */
const Autores = {
  _eu: null,
  async eu() {
    if (this._eu) return this._eu;
    const p = await TurmaAuth.perfil().catch(() => ({})), email = p.email || TurmaAuth.email || '';
    return (this._eu = { nome: p.nome || String(email).split('@')[0] || 'Alguém', foto: await this.miniFoto(p.foto), id: await this.idDe(email) });
  },
  // o e-mail nunca vai para o personagem/arquivo: só um código tirado dele (o mesmo e-mail dá sempre o mesmo código)
  async idDe(email) {
    email = String(email || '').trim().toLowerCase(); if (!email) return 'anon';
    try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('estudio-problems:' + email)); return 'u' + [...new Uint8Array(b)].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join(''); }
    catch { let h2 = 0; for (const c of email) h2 = (h2 * 31 + c.charCodeAt(0)) | 0; return 'u' + (h2 >>> 0).toString(16); }
  },
  // troca qualquer e-mail que tenha ficado guardado (versão de antes) pelo código
  async limpa(o) {
    if (!o) return o; for (const x of [o.autor, ...(o.edicoes || [])]) if (x && /@/.test(x.id || '')) x.id = await this.idDe(x.id);
    if (o.autor && o.edicoes) { const vistos = new Set(); o.edicoes = o.edicoes.sort((a, b) => b.em - a.em).filter(x => !vistos.has(x.id) && vistos.add(x.id)).sort((a, b) => a.em - b.em); }
    return o;
  },
  // foto pequena (a "Minha conta" pode guardar a foto inteira; aqui basta 64 px para não pesar o personagem)
  async miniFoto(f) {
    if (!f) return null; if (!/^data:/.test(f) && f.length < 1000) return f;
    try { const im = new Image(); im.src = f; await im.decode(); const S = 64, c = document.createElement('canvas'); c.width = c.height = S; const k = Math.max(S / im.naturalWidth, S / im.naturalHeight), w = im.naturalWidth * k, hh = im.naturalHeight * k;
      c.getContext('2d').drawImage(im, (S - w) / 2, (S - hh) / 2, w, hh); return c.toDataURL('image/jpeg', .82); } catch { return null; }
  },
  async marca(def) {
    await this.limpa(def); const eu = await this.eu(), agora = Date.now();
    if (!def.autor) def.autor = { ...eu, em: agora };
    def.edicoes = [...(def.edicoes || []).filter(x => x.id !== eu.id), { ...eu, em: agora }].slice(-12);
  },
  // quem mexeu, sem contar quem subiu (mais recente primeiro)
  editores(d) { return (d.edicoes || []).filter(x => x.id !== d.autor?.id).sort((a, b) => b.em - a.em); },
  av(p, cls = '') { const ini = esc(String(p?.nome || '?').trim().charAt(0).toUpperCase() || '?'); return p?.foto ? `<img class="aut-av ${cls}" src="${esc(p.foto)}" alt="" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=&quot;aut-av ${cls}&quot;>${ini}</span>'">` : `<span class="aut-av ${cls}">${ini}</span>`; },
  // selo do canto do cartão: a foto e o nome de quem subiu; se outra pessoa editou, a foto dela por cima e "editado por"
  // nome e foto de AGORA da pessoa (o que ela pôs na "Minha conta"), pelo código guardado no arquivo; se não achar, fica o que foi guardado
  _vivos: new Map(),
  vivo(p) {
    if (!p?.id || !/^u[0-9a-f]{16}$/.test(p.id)) return Promise.resolve(p);
    if (!this._vivos.has(p.id)) this._vivos.set(p.id, fetch('/pessoa?u=' + encodeURIComponent(p.id), { credentials: 'same-origin', cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null));
    return this._vivos.get(p.id).then(j => j?.nome ? { ...p, nome: j.nome, foto: j.foto || p.foto } : p);
  },
  async aoVivo(d) { const autor = await this.vivo(d.autor), edicoes = await Promise.all((d.edicoes || []).map(x => this.vivo(x))); return { ...d, autor, edicoes }; },
  selo(d0) {
    if (!d0?.autor) return null; let d = d0, eds = this.editores(d), ult = eds[0];
    const el = h(`<div class="autores" title=""></div>`);
    const pinta = () => { eds = this.editores(d); ult = eds[0]; el.innerHTML = `${this.av(d.autor)}${ult ? this.av(ult, 'sob') : ''}<span class="aut-nm">${esc(d.autor.nome)}${ult ? `<small> · editado por ${esc(ult.nome)}${eds.length > 1 ? ` +${eds.length - 1}` : ''}</small>` : ''}</span>`; };
    pinta(); this.aoVivo(d0).then(x => { d = x; pinta(); }); // troca pelo nome e foto de agora assim que chegar
    let pop = null; const fecha = () => { pop?.remove(); pop = null; };
    el.onmouseenter = () => { fecha();
      pop = h(`<div class="aut-pop"><div class="aut-l">${this.av(d.autor)}<div><b>${esc(d.autor.nome)}</b><small>subiu para a nuvem · ${fmtDate(d.autor.em)}</small></div></div>
        ${eds.length ? `<div class="aut-t">Editado por</div>${eds.map(x => `<div class="aut-l">${this.av(x)}<div><b>${esc(x.nome)}</b><small>última edição · ${fmtDate(x.em)}</small></div></div>`).join('')}` : '<div class="aut-t">Ninguém mais editou</div>'}
        ${d.modificado ? `<div class="aut-t">Salvo pela última vez ${fmtDate(d.modificado)}</div>` : ''}</div>`);
      document.body.appendChild(pop); const r = el.getBoundingClientRect(), pr = pop.getBoundingClientRect();
      pop.style.left = Math.max(6, Math.min(r.left, innerWidth - pr.width - 6)) + 'px'; pop.style.top = (r.bottom + pr.height + 6 > innerHeight ? r.top - pr.height - 6 : r.bottom + 6) + 'px'; };
    el.onmouseleave = fecha; el.addEventListener('click', fecha);
    return el;
  },
};

/* ---------- ficha de quem fez (aparece ao abrir um .animador ou .atelieanimador): foto, nome e datas, nunca o e-mail ---------- */
Autores.ficha = function (o) {
  const L = (p, txt) => `<div class="aut-l">${this.av(p)}<div><b>${esc(p.nome || 'Alguém')}</b><small>${txt}</small></div></div>`;
  const eds = o.autor ? this.editores(o) : (o.edicoes || []).slice().sort((a, b) => b.em - a.em);
  return h(`<div class="ficha">
    <div class="ficha-top">${o.thumb ? `<div class="ficha-th" style="background-image:url('${o.thumb}')"></div>` : `<div class="ficha-th">${ic(o.ico || 'layers', 26)}</div>`}<div><small>${esc(o.tipo || '')}</small><b>${esc(o.nome || '')}</b>${o.resumo ? `<small>${o.resumo}</small>` : ''}</div></div>
    ${o.aviso ? `<div class="ficha-aviso">${ic('alert', 16)}<div>${o.aviso}</div></div>` : ''}
    <div class="aut-pop ficha-pop">
      ${o.autor ? `<div class="aut-t" style="border:0;margin:0">Criado por</div>${L(o.autor, (o.verboAutor || 'criou') + ' · ' + fmtDate(o.autor.em))}` : '<div class="aut-t" style="border:0;margin:0">Quem criou não ficou registrado (arquivo de antes desta versão)</div>'}
      ${eds.length ? `<div class="aut-t">Editado por</div>${eds.map(x => L(x, 'última edição · ' + fmtDate(x.em))).join('')}` : ''}
      ${o.pacote?.por ? `<div class="aut-t">Arquivo feito por</div>${L(o.pacote.por, 'baixou este arquivo · ' + fmtDate(o.pacote.em))}` : ''}
    </div></div>`);
};
