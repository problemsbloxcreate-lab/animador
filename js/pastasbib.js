/* ===================== pastasbib.js — PASTAS na biblioteca de personagens (tela inicial › Personagens) =====================
   Duas bibliotecas, cada uma com as suas pastas:
   • NA NUVEM: `personagens/pastas.json` na nuvem da equipe = { pastas: [nomes na ordem, inclusive vazias], de: { idDoPersonagem: pasta } }.
     Toda a equipe cria, renomeia, apaga e move. Fica FORA do personagem.json de propósito: quem estiver com o personagem aberto no
     Ateliê não desfaz a mudança de pasta ao salvar. Sem entrada em `de` = a pasta do próprio personagem (`def.pasta`, antigo).
     Cada mudança relê o arquivo antes de gravar (duas pessoas mexendo ao mesmo tempo não se apagam).
   • NESTE COMPUTADOR: o mesmo formato em arquivos["pastas-local"] (banco do navegador).
   Apagar uma pasta NUNCA apaga personagens: eles vão para a pasta escolhida. Fechar/abrir pasta é de cada pessoa (localStorage).
   Arrastar um cartão para outra pasta (no título ou na grade dela) move; o menu do cartão também tem "Mover para a pasta…". */
'use strict';
const PastasBib = {
  PADRAO: { nuvem: 'Personagens', local: 'Sem pasta' },
  CHAVE_NUVEM: 'personagens/pastas.json',
  vazio() { return { pastas: [], de: {} }; },
  limpo(o) { o = o && typeof o === 'object' ? o : {}; return { pastas: Array.isArray(o.pastas) ? [...new Set(o.pastas.map(x => String(x || '').trim()).filter(Boolean))] : [], de: o.de && typeof o.de === 'object' ? { ...o.de } : {} }; },
  // ---------- ler / gravar ----------
  async le(esc) {
    if (esc === 'local') { try { return this.limpo(await DB.get('arquivos', 'pastas-local')); } catch { return this.vazio(); } }
    try { const r = await fetch(Nuvem.srv + '/personagens/arquivo?k=' + encodeURIComponent(this.CHAVE_NUVEM), { headers: await Nuvem.hd(), cache: 'no-store' }); if (r.status === 404) return (this._nuvem = this.vazio()); if (!r.ok) throw new Error('A nuvem respondeu ' + r.status); return (this._nuvem = this.limpo(await r.json())); }
    catch (e) { if (this._nuvem) return this._nuvem; throw e; }
  },
  // muda(o) mexe no objeto (já relido agora); devolve o objeto gravado
  async grava(esc, muda) {
    const o = await this.le(esc); muda(o); const L = this.limpo(o);
    if (esc === 'local') { await DB.put('arquivos', L, 'pastas-local'); return L; }
    await Nuvem.pede('/personagens/arquivo?k=' + encodeURIComponent(this.CHAVE_NUVEM), { method: 'POST', body: JSON.stringify(L), headers: { 'content-type': 'application/json' } });
    this._nuvem = L; return L;
  },
  pastaDe(o, it, esc) { return o.de[it.id] || (esc === 'nuvem' ? it.pasta : '') || this.PADRAO[esc]; },
  // todas as pastas na ordem: as guardadas (inclusive vazias) e depois as que só aparecem nos itens; a padrão primeiro se não estiver na lista
  ordem(o, itens, esc) { const usadas = itens.map(it => this.pastaDe(o, it, esc)), L = [...o.pastas]; for (const p of usadas) if (!L.includes(p)) L.push(p); const P = this.PADRAO[esc]; if (!o.pastas.includes(P) && (usadas.includes(P) || !L.length)) { const i = L.indexOf(P); if (i >= 0) L.splice(i, 1); L.unshift(P); } return [...new Set(L)]; }, // a padrão vem primeiro (se ninguém pôs ela em outro lugar)
  // ---------- fechar / abrir (de cada pessoa) ----------
  fechadas() { try { return new Set(JSON.parse(localStorage.getItem('animador-pastas-fechadas') || '[]')); } catch { return new Set(); } },
  fechada(esc, p) { return this.fechadas().has(esc + ':' + p); },
  alterna(esc, p) { const s = this.fechadas(), k = esc + ':' + p; s.has(k) ? s.delete(k) : s.add(k); try { localStorage.setItem('animador-pastas-fechadas', JSON.stringify([...s])); } catch { } return s.has(k); },
  // ---------- ações ----------
  async mover(esc, ids, pasta) { if (!ids.length || !pasta) return; await this.grava(esc, o => { if (!o.pastas.includes(pasta)) o.pastas.push(pasta); for (const id of ids) o.de[id] = pasta; }); },
  async nova(esc, mover = []) {
    const nome = (await UI.prompt({ title: 'Pasta nova', label: 'Nome da pasta', placeholder: 'Ex.: Heróis, Vilões, Figurantes', ok: 'Criar', icon: 'folder' }))?.trim(); if (!nome) return null;
    await this.grava(esc, o => { if (!o.pastas.includes(nome)) o.pastas.push(nome); for (const id of mover) o.de[id] = nome; }); return nome;
  },
  async renomear(esc, de, itens) {
    const para = (await UI.prompt({ title: 'Renomear a pasta', label: 'Nome novo', value: de, ok: 'Renomear', icon: 'edit' }))?.trim(); if (!para || para === de) return false;
    await this.grava(esc, o => { const i = o.pastas.indexOf(de); if (i >= 0) o.pastas[i] = para; else o.pastas.push(para); o.pastas = [...new Set(o.pastas)]; for (const it of itens) if (this.pastaDe(o, it, esc) === de) o.de[it.id] = para; });
    const s = this.fechadas(); if (s.has(esc + ':' + de)) { this.alterna(esc, de); this.alterna(esc, para); } return true;
  },
  // apagar a pasta: os personagens dela vão para outra (nada se perde)
  async apagar(esc, pasta, itens, todas) {
    const dentro = itens.filter(it => this.pastaDe(this._o || this.vazio(), it, esc) === pasta), outras = todas.filter(p => p !== pasta), padrao = this.PADRAO[esc];
    const destinos = [...new Set([padrao, ...outras])].filter(p => p !== pasta);
    let para = destinos[0] || padrao;
    if (dentro.length) {
      const r = await UI.modal({ title: `Apagar a pasta "${esc2(pasta)}"?`, icon: 'folder', width: 440, body: `<div>Os <b>${dentro.length}</b> personagem${dentro.length === 1 ? '' : 's'} dela não são apagados: vão para a pasta escolhida.</div><label class="field" style="margin-top:12px">Mandar para<select data-p>${destinos.map(p => `<option>${esc2(p)}</option>`).join('')}${destinos.includes(padrao) ? '' : `<option>${esc2(padrao)}</option>`}</select></label>`,
        buttons: [{ label: 'Cancelar', value: null }, { label: 'Apagar a pasta', kind: 'danger', collect: a => $('[data-p]', a.body).value }] });
      if (!r) return false; para = r;
    } else if (!(await UI.confirm({ title: `Apagar a pasta "${esc2(pasta)}"?`, msg: 'Ela está vazia.', ok: 'Apagar', danger: true }))) return false;
    await this.grava(esc, o => { o.pastas = o.pastas.filter(p => p !== pasta); for (const it of itens) if (this.pastaDe(o, it, esc) === pasta) o.de[it.id] = para; if (dentro.length && !o.pastas.includes(para)) o.pastas.push(para); });
    return true;
  },
  // ---------- desenhar: título da pasta (abre/fecha) + grade de cartões; arrastar cartões entre pastas ----------
  // o = { esc, itens, cartao(it) → elemento, aoMudar() } ; devolve o fragmento
  async monta(box, o) {
    const esc = o.esc, dados = this._o = await this.le(esc).catch(() => this.vazio()), todas = this.ordem(dados, o.itens, esc);
    box.innerHTML = '';
    for (const pa of todas) {
      const itens = o.itens.filter(it => this.pastaDe(dados, it, esc) === pa), fech = this.fechada(esc, pa), cor = CoresPasta.get((esc === 'nuvem' ? 'bib:' : 'loc:') + pa);
      const t = h(`<div class="pasta-t pb-t ${fech ? 'fechada' : ''} ${cor ? 'com-cor' : ''}" style="${cor ? `--pc:${cor}` : ''}" data-pasta="${esc2(pa)}" title="Clique: abrir/fechar · arraste personagens para cá · botão direito: opções"><span class="pb-seta">${ic('down', 12)}</span>${ic('folder', 13)} <span class="pb-nome">${esc2(pa)}</span><small>${itens.length}</small><span class="sp"></span><button class="ibtn pb-mn" title="Opções da pasta">${ic('dots', 13)}</button></div>`);
      const g = h(`<div class="grade pb-g" data-pasta="${esc2(pa)}" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))" ${fech ? 'hidden' : ''}></div>`);
      for (const it of itens) { const c = o.cartao(it); c.draggable = true; c.dataset.pbId = it.id; c.ondragstart = ev => { ev.dataTransfer.setData('text/pers-id', it.id); ev.dataTransfer.effectAllowed = 'move'; c.classList.add('pb-indo'); }; c.ondragend = () => c.classList.remove('pb-indo'); g.appendChild(c); }
      if (!itens.length) g.appendChild(h(`<div class="pb-vazia">Pasta vazia: arraste personagens para cá</div>`));
      t.onclick = e => { if (e.target.closest('.pb-mn')) return; const f = this.alterna(esc, pa); t.classList.toggle('fechada', f); g.hidden = f; };
      const menu = (x, y) => UI.ctx(x, y, [{ head: pa }, { label: 'Renomear…', icon: 'edit', action: async () => { try { if (await this.renomear(esc, pa, o.itens)) o.aoMudar(); } catch (e) { UI.toast(esc2(e.message), { kind: 'err' }); } } },
        { label: 'Pasta nova…', icon: 'folder', action: async () => { try { if (await this.nova(esc)) o.aoMudar(); } catch (e) { UI.toast(esc2(e.message), { kind: 'err' }); } } },
        menuCor(cor, c => { CoresPasta.set((esc === 'nuvem' ? 'bib:' : 'loc:') + pa, c); o.aoMudar(); }),
        '-', { label: 'Apagar a pasta (os personagens ficam)', icon: 'trash', danger: true, action: async () => { try { if (await this.apagar(esc, pa, o.itens, todas)) o.aoMudar(); } catch (e) { UI.toast(esc2(e.message), { kind: 'err' }); } } }]);
      $('.pb-mn', t).onclick = e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); menu(r.right - 200, r.bottom + 4); };
      t.oncontextmenu = e => { e.preventDefault(); menu(e.clientX, e.clientY); };
      for (const alvo of [t, g]) {
        alvo.ondragover = ev => { if (!ev.dataTransfer.types.includes('text/pers-id')) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; t.classList.add('pb-alvo'); g.classList.add('pb-alvo'); };
        alvo.ondragleave = ev => { if (alvo.contains(ev.relatedTarget)) return; t.classList.remove('pb-alvo'); g.classList.remove('pb-alvo'); };
        alvo.ondrop = async ev => { const id = ev.dataTransfer.getData('text/pers-id'); t.classList.remove('pb-alvo'); g.classList.remove('pb-alvo'); if (!id) return; ev.preventDefault(); const it = o.itens.find(x => x.id === id); if (!it || this.pastaDe(dados, it, esc) === pa) return;
          const card = box.querySelector(`[data-pb-id="${CSS.escape(id)}"]`); if (card) { $('.pb-vazia', g)?.remove(); g.appendChild(card); } // aparece na hora; a gravação vem depois
          try { await this.mover(esc, [id], pa); UI.toast(`<b>${esc2(it.nome)}</b> foi para <b>${esc2(pa)}</b>.`, { time: 2200 }); } catch (e) { UI.toast('Não consegui mover: ' + esc2(e.message), { kind: 'err' }); } o.aoMudar(); };
      }
      box.appendChild(t); box.appendChild(g);
    }
    return { dados, todas };
  },
  // itens do menu do cartão: Mover para a pasta › (todas + Pasta nova…)
  menuMover(esc, it, todas, aoMudar) {
    const atual = this.pastaDe(this._o || this.vazio(), it, esc);
    return { label: 'Mover para a pasta', icon: 'folder', sub: [...todas.map(p => ({ label: p, icon: p === atual ? 'check' : 'folder', disabled: p === atual, action: async () => { try { await this.mover(esc, [it.id], p); aoMudar(); } catch (e) { UI.toast(esc2(e.message), { kind: 'err' }); } } })),
      '-', { label: 'Pasta nova…', icon: 'plus', action: async () => { try { if (await this.nova(esc, [it.id])) aoMudar(); } catch (e) { UI.toast(esc2(e.message), { kind: 'err' }); } } }] };
  },
};
const esc2 = s => esc(String(s ?? ''));
