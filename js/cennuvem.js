/* ===================== cennuvem.js — CENÁRIOS EM CAMADAS NA NUVEM DA EQUIPE =====================
   Pedido da dona (13/11/2026): "o cenário pode ser salvo na nuvem para todos acessarem".
   Decisões (grill-me, 13/11/2026): vai SOZINHO ao salvar · toda a equipe edita, apagar da nuvem só ADM ·
   os antigos só deste computador: pergunta UMA vez quais mandar.
   Nuvem (turma-ia /cenlib): cenlib/<id>/cenario.json = o item inteiro da biblioteca ({ id, nome, tags, cat, roteiro, aprovar,
   em, mini, def }) + cenlib/<id>/arq/<arquivo> = imagens das camadas que não são do site. Ao subir, as camadas passam a usar a
   chave "cenlib/<id>/arq/<arquivo>" no Arq (Arq.bitmap baixa daqui se faltar no computador).
   A lista local (arquivos["cenlib-meus"], CenLib.meus) continua sendo a cópia deste computador. Cada item ganha:
     _mod = versão da nuvem em que este computador se baseia (vai como base= ao salvar; 409 = outra pessoa salvou antes)
     _sig = assinatura do conteúdo que está na nuvem (o conteúdo mudou → manda de novo) · soLocal = a pessoa escolheu deixar só aqui
   Nada de rede dentro de "mexe" (lê a lista, muda e grava na hora), para não pisar no que a janela Cenários grava junto. */
'use strict';
const CenNuvem = {
  P: 'cenlib/',
  sig(m) { return JSON.stringify([m.nome, m.tags || [], m.cat || '', m.roteiro || null, !!m.aprovar, m.mini || null, m.def]); },
  pendente(m) { return !m.soLocal && this.sig(m) !== m._sig; },
  nomeArq(k) { const ext = (String(k).match(/\.(png|webp|gif|jpe?g|svg)$/i)?.[1] || 'png').toLowerCase(), base = String(k).replace(/\.[^.\/]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[^A-Za-z0-9]+/, '').slice(-60) || 'img'; return base + '.' + ext; },
  doSite(k) { return /^cenarios\//.test(k || ''); },
  async mexe(fn) { const l = await CenLib.meus(); const r = await fn(l); await DB.put('arquivos', l, 'cenlib-meus'); return r; },
  troca(m, it) { for (const c of Object.keys(m)) delete m[c]; Object.assign(m, it); m._sig = this.sig(m); return m; },

  /* ---------- ler ---------- */
  async lista() { return (await (await Nuvem.pede('/cenlib')).json()).itens || []; },
  async baixarItem(id) { const r = await Nuvem.pede('/cenlib/arquivo?k=' + encodeURIComponent(this.P + id + '/cenario.json')); const it = await r.json(); it._mod = +(r.headers.get('x-mod') || 0); return it; },
  async baixar(k) { const b = await (await Nuvem.pede('/cenlib/arquivo?k=' + encodeURIComponent(k))).blob(); await DB.put('arquivos', b, k).catch(() => { }); return b; },

  // traz para este computador o que mudou na nuvem (sem pisar no que foi mexido aqui e ainda não subiu: esse vai dar conflito ao enviar)
  _sinc: null, erro: null,
  sincroniza() { return this._sinc ||= this._sincJa().finally(() => { this._sinc = null; }); },
  async _sincJa() {
    let nuvem; try { nuvem = await this.lista(); } catch (e) { this.erro = e.message; return { ok: false, erro: e.message }; }
    this.erro = null; const aqui = new Map((await CenLib.meus()).map(m => [m.id, m])), novos = [];
    for (const x of nuvem) { const m = aqui.get(x.id); if (m && (m._mod === x.mod || (m._mod && this.pendente(m)))) continue;
      try { novos.push(await this.baixarItem(x.id)); } catch (e) { console.warn('cenário da nuvem', x.id, e); } }
    const ids = new Set(nuvem.map(x => x.id)); let mudou = 0;
    await this.mexe(l => {
      for (const it of novos) { const m = l.find(y => y.id === it.id); if (m && m._mod && this.pendente(m)) continue; if (m) this.troca(m, it); else { it._sig = this.sig(it); l.push(it); } mudou++; }
      // apagado da nuvem por um ADM: some daqui também (se não foi mexido aqui sem enviar; aí fica como só deste computador)
      for (let i = l.length - 1; i >= 0; i--) { const m = l[i]; if (!m._mod || ids.has(m.id)) continue; if (this.pendente(m)) { delete m._mod; delete m._sig; } else { l.splice(i, 1); } mudou++; }
      l.sort((a, b) => (b.em || 0) - (a.em || 0));
    });
    if (mudou) this.aoMudar?.();
    return { ok: true, mudou, nuvem: nuvem.length };
  },

  /* ---------- salvar ---------- */
  // sobe as imagens que faltam e o cenario.json (base = m._mod). Devolve o item como ficou na nuvem (não mexe em m)
  async enviaItem(m, o = {}) {
    const id = m.id, def = clone(m.def), feitas = {};
    for (const c of def.camadas || []) { const k = c.k; if (!k || this.doSite(k) || k.startsWith(this.P + id + '/arq/')) continue;
      if (!feitas[k]) { const b = await Arq.pegaBlob(k); if (!b) throw new Error(`a imagem da camada "${c.nome || ''}" não está neste computador`);
        const nk = this.P + id + '/arq/' + this.nomeArq(k);
        if (!(await DB.get('arquivos', nk).catch(() => null))) await Nuvem.pede('/cenlib/arquivo?k=' + encodeURIComponent(nk), { method: 'POST', body: b, headers: { 'content-type': b.type || 'application/octet-stream' } }); // já subiu antes (só fica guardada com esse nome depois de subir)
        await Arq.guardar(b, nk); const bm = Arq.img.get(k); if (bm) Arq.img.set(nk, bm); feitas[k] = nk; }
      c.k = feitas[k]; }
    const it = { id, nome: m.nome, tags: m.tags || [], cat: m.cat || '', em: Date.now(), mini: m.mini || null, def, ...(m.roteiro ? { roteiro: m.roteiro } : {}), ...(m.aprovar ? { aprovar: true } : {}) };
    const r = await Nuvem.pede(`/cenlib/arquivo?k=${encodeURIComponent(this.P + id + '/cenario.json')}&base=${m._mod || 0}&nome=${encodeURIComponent(m.nome || 'Cenário')}${o.forcar ? '&forcar=1' : ''}`, { method: 'POST', body: JSON.stringify(it), headers: { 'content-type': 'application/json' } });
    it._mod = +(await r.json()).mod || Date.now(); return it;
  },
  // depois de subir: se ninguém mexeu no item enquanto subia, ele vira o da nuvem; se mexeram, só a base anda (e sobe de novo)
  async aplica(id, s0, it, velho = 0) {
    const B = CenLib._base; if (B.has(id) && B.get(id) === velho) B.set(id, it._mod); // a janela que salvou passa a se basear na versão que acabou de subir
    await this.mexe(l => { const m = l.find(y => y.id === id); if (!m) return; if (this.sig(m) === s0) this.troca(m, it); else { m._mod = it._mod; m._sig = this.sig(it); this._denovo = true; } });
  },
  // manda tudo que está pendente (a janela Cenários chama depois de cada gravação). Conflito: pergunta o que fazer.
  _fila: null, _denovo: false,
  agenda() { if (this._fila) { this._denovo = true; return this._fila; } return this._fila = this._envia().finally(() => { this._fila = null; if (this._denovo) { this._denovo = false; this.agenda(); } }); },
  async _envia() {
    const pend = (await CenLib.meus()).filter(x => this.pendente(x)); let n = 0, falhou = null;
    for (const m of pend) { const s0 = this.sig(m);
      try { await this.aplica(m.id, s0, await this.enviaItem(m), m._mod || 0); n++; }
      catch (e) {
        if (!(e.status === 409 && e.dados?.type === 'conflito')) { falhou = e; continue; }
        const r = await this.conflito(m, e.dados);
        try {
          if (r === 'minha') { await this.aplica(m.id, s0, await this.enviaItem(m, { forcar: true }), CenLib._base.get(m.id) ?? (m._mod || 0)); n++; }
          else if (r === 'nova' || r === 'copia') { const nova = await this.baixarItem(m.id);
            await this.mexe(l => { const x = l.find(y => y.id === m.id); if (!x) return;
              if (r === 'copia') { const c = clone(x); c.id = uid('cen'); c.nome = (x.nome + ' (minha versão)').slice(0, 40); c.def.id = c.id; c.def.nome = c.nome; c.em = Date.now(); delete c._mod; delete c._sig; l.unshift(c); this._denovo = true; }
              this.troca(x, nova); }); }
          else { await this.mexe(l => { const x = l.find(y => y.id === m.id); if (x) x.soLocal = true; }); } // fechou sem escolher: fica só aqui até salvar de novo
        } catch (e2) { falhou = e2; }
      }
    }
    if (falhou) UI.toast(`Não consegui salvar um cenário na nuvem: ${esc(falhou.message)}. Ele continua neste computador e vai de novo no próximo salvar.`, { kind: 'err', time: 7000 });
    else if (n) UI.toast(n === 1 ? 'Cenário salvo na nuvem da equipe.' : `${n} cenários salvos na nuvem da equipe.`, { kind: 'ok' });
    if (n || falhou || pend.length) this.aoMudar?.();
    return n;
  },
  async conflito(m, d) {
    let quem = ''; try { const p = d?.por ? await Autores.vivo({ id: d.por }) : null; quem = p?.nome ? ` por <b>${esc(p.nome)}</b>` : ''; } catch { }
    return UI.modal({ title: 'Outra pessoa mudou este cenário', icon: 'cloud', width: 480,
      body: `<div>O cenário "<b>${esc(m.nome)}</b>" foi salvo na nuvem${quem}${d?.mod ? ' em ' + fmtDate(d.mod) : ''}, depois da versão que você abriu.<br><br>O que fazer com a sua versão?</div>`,
      buttons: [{ label: 'Guardar a minha como cópia', value: 'copia', left: true }, { label: 'Abrir a versão nova', value: 'nova' }, { label: 'Salvar a minha por cima', value: 'minha', kind: 'primary' }] });
  },

  /* ---------- apagar (só ADM) ---------- */
  async apagar(m) {
    if (!(await Nuvem.souAdm())) { await Nuvem.pedeAdm(m.nome || 'este cenário'); return false; }
    if (!(await UI.confirm({ title: 'Apagar da nuvem da equipe?', msg: `"<b>${esc(m.nome)}</b>" some para todo mundo. As animações que já usam continuam com ele.`, ok: 'Apagar', danger: true }))) return false;
    await Nuvem.pede('/cenlib/arquivo?k=' + encodeURIComponent(this.P + m.id + '/'), { method: 'DELETE' });
    await this.mexe(l => { const i = l.findIndex(x => x.id === m.id); if (i >= 0) l.splice(i, 1); }); UI.toast('Apagado da nuvem da equipe.', { kind: 'ok' }); return true;
  },

  /* ---------- os antigos só deste computador: perguntar UMA vez ---------- */
  async perguntaAntigos() {
    try { if (localStorage.getItem('cenlib-nuvem-perguntou') === '1') return false; } catch { }
    const so = (await CenLib.meus()).filter(m => !m._mod && !m.soLocal && this.pendente(m));
    if (!so.length) { try { localStorage.setItem('cenlib-nuvem-perguntou', '1'); } catch { } return false; }
    const body = h(`<div><div style="margin-bottom:10px">Agora os cenários salvos vão para a <b>nuvem da equipe</b>: todo mundo abre o mesmo cenário em qualquer computador.<br>Você tem <b>${so.length}</b> cenário(s) só neste computador. Marque os que devem ir para a nuvem:</div>
      <div style="max-height:320px;overflow:auto;display:grid;gap:6px">${so.map(m => `<label style="display:flex;gap:10px;align-items:center;cursor:pointer"><input type="checkbox" checked data-id="${esc(m.id)}">${m.mini ? `<img src="${m.mini}" alt="" style="width:72px;border-radius:6px">` : ''}<span><b>${esc(m.nome)}</b><br><small>${fmtDate(m.em)}</small></span></label>`).join('')}</div></div>`);
    const r = await UI.modal({ title: 'Mandar cenários para a nuvem?', icon: 'cloud', width: 520, body, buttons: [{ label: 'Depois', value: null, left: true }, { label: 'Deixar só aqui', value: 'nao' }, { label: 'Mandar os marcados', value: 'sim', kind: 'primary' }] });
    if (r == null) return false; // "Depois": pergunta de novo na próxima vez
    const marcados = new Set(r === 'sim' ? [...body.querySelectorAll('input:checked')].map(i => i.dataset.id) : []);
    await this.mexe(l => { for (const m of l) if (!m._mod && !marcados.has(m.id) && so.some(x => x.id === m.id)) m.soLocal = true; });
    try { localStorage.setItem('cenlib-nuvem-perguntou', '1'); } catch { }
    if (marcados.size) await this.agenda(); return true;
  },
};
