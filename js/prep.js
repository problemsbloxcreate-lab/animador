/* ===================== prep.js — PREPARATIVOS dentro do Animador (pedido da dona, 05/11/2026) =====================
   Seção "Preparativos › Prontos para animar" da tela inicial: lista o que a equipe marcou como PRONTO para o Animador no programa
   Preparativos (repo preparativos, README › "CONTRATO NA NUVEM"). Escolher um = o Animador monta a animação sozinho:
   • um áudio por FALA, na ordem do roteiro, com a pausa do protocolo dos Shorts entre elas (Short.pausa);
   • legendas (se o preparativo tiver: legenda.ativa) só com o TEXTO da fala (nunca a nota), na cor do personagem
     (legenda.cores › personagens.json › cores.json); "Nome: texto" só se legenda.mostrarNome;
   • personagens da equipe com o MESMO NOME de quem fala entram na cena (opcional), com a boca pela voz.
   Com várias partes, a pessoa marca QUAIS partes entram (ex.: só 1 e 3) e escolhe juntar numa animação ou uma para cada.
   Depois avisa o Preparativos (acao 'usado') — lá aparece "sendo usado pelo projeto X"; aqui o cartão mostra a animação e "Ir para ela".
   ECONOMIA DA NUVEM: a lista fica 2 min na memória; cada prep.json fica no banco do navegador pela versão (mod) — só baixa de novo
   quando mudou; personagens.json fica 10 min no navegador. Nenhum pedido repetido em intervalo. */
'use strict';
const Prep = {
  _lista: null, _listaEm: 0,
  pode() { return window.EstudioPerm?.programa?.('preparativos') ?? true; },
  // ---------- dados ----------
  lista(novo) {
    if (!novo && this._lista && Date.now() - this._listaEm < 120000) return this._lista;
    this._listaEm = Date.now();
    return (this._lista = (async () => { const j = await (await Nuvem.pede('/preparativos')).json(); return (j.itens || []).filter(x => x && x.status === 'pronto' && x.destino === 'animador').sort((a, b) => (b.mod || 0) - (a.mod || 0)); })()
      .catch(e => { this._lista = null; throw e; }));
  },
  async prep(it, novo) { // prep.json pela versão: o do banco do navegador serve se o mod é o mesmo da lista
    const k = 'prep-json:' + it.id, g = await DB.get('arquivos', k).catch(() => null);
    if (!novo && g?.j && it.mod && g.mod === it.mod) return g.j;
    const r = await Nuvem.pede('/preparativos/arquivo?k=' + encodeURIComponent(`preparativos/${it.id}/prep.json`)), j = await r.json(), mod = +(r.headers.get('x-mod') || j.mod || it.mod || 0);
    try { await DB.put('arquivos', { mod: it.mod || mod, j }, k); } catch { } return j;
  },
  async pers() { // personagens da equipe no Preparativos (cor/foto por nome em minúsculas)
    try { const g = JSON.parse(localStorage.getItem('animador-prep-pers') || 'null'); if (g && Date.now() - g.em < 600000) return g.p; } catch { }
    let p = {}; try { p = await (await Nuvem.pede('/preparativos/arquivo?k=' + encodeURIComponent('preparativos/personagens.json'))).json() || {}; } catch { }
    try { const c = await (await Nuvem.pede('/preparativos/arquivo?k=' + encodeURIComponent('preparativos/cores.json'))).json() || {}; for (const [k, v] of Object.entries(c)) if (!p[k]?.cor) p[k] = { ...(p[k] || {}), cor: v }; } catch { } // cores.json (antigo)
    try { localStorage.setItem('animador-prep-pers', JSON.stringify({ em: Date.now(), p })); } catch { } return p || {};
  },
  // MESMA regra do Preparativos (js/app.js de lá: corDe/corPadrao): nome sem diferença de maiúscula; sem cor salva, sai do nome (Problems = ciano)
  chave(n) { return String(n || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR'); },
  CORES: ['#19f0f0', '#ffb04a', '#ff6b93', '#a796ff', '#4fe08f', '#ffd36b', '#7fd1ff', '#ff8f6b'],
  corPadrao(nome) { const k = this.chave(nome); if (k === 'problems') return '#19f0f0'; let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return this.CORES[1 + h % (this.CORES.length - 1)]; },
  cor(prep, pers, nome) { const k = this.chave(nome); return prep?.legenda?.cores?.[k] || pers?.[k]?.cor || this.corPadrao(nome); },
  // nomes sem repetir (PROBLEMS e problems = o mesmo; fica o 1º jeito escrito)
  unicos(L) { const m = new Map(); for (const n of L) { const k = this.chave(n); if (k && !m.has(k)) m.set(k, String(n).trim()); } return [...m.values()]; },
  dur(s) { s = Math.round(+s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; },
  // ---------- seção da tela inicial ----------
  async pinta(c) {
    const S = Home.secaoAtual();
    c.innerHTML = `${Home.cabecalho(S, `<button class="btn sm" data-atu title="Buscar de novo no Preparativos">${ic('loop', 13)} Atualizar</button><a class="btn sm" href="/preparativos/" target="_blank" rel="noopener" title="Abrir o programa Preparativos numa aba nova"><span class="hm-gic hm-gic-sm" data-estudio-icone="pr"></span> Abrir o Preparativos</a>`, '')}
      <div class="pp-lista" data-l><div class="vazio"><span class="spin-dot"></span> Buscando o que está pronto no Preparativos…</div></div>
      <p class="pp-nota">Os roteiros em rascunho ou gravando ficam no programa Preparativos. Aqui só aparece o que já está pronto para o Animador.</p>`;
    try { window.EstudioIcones?.pinta?.(c); } catch { }
    $('[data-atu]', c).onclick = () => { this._lista = null; this.pinta(c); };
    const l = $('[data-l]', c);
    let L; try { L = await this.lista(); } catch (e) { l.innerHTML = `<div class="vazio">Não consegui falar com o Preparativos agora: ${esc(e.message)}</div>`; return; }
    Home.poeN('prep', L.length);
    if (!L.length) { l.innerHTML = '<div class="vazio">Nada pronto para o Animador ainda. No programa Preparativos, escolha <b>Animador</b> como destino e marque o roteiro como <b>Pronto</b>.</div>'; return; }
    // tudo pronto ANTES de aparecer (sem cartões pipocando): prep.json de cada um (do banco do navegador quando não mudou) e as cores
    const [pers, preps, locais] = await Promise.all([this.pers(), Promise.all(L.map(it => this.prep(it).catch(() => null))), DB.all('projetos').catch(() => [])]);
    let naNuvem = []; try { if (NuvemAnim._lista) naNuvem = await NuvemAnim._lista; } catch { }
    const nomeDe = id => locais.find(p => p.id === id)?.nome || naNuvem.find(x => x.id === id)?.nome || null;
    const frag = document.createDocumentFragment();
    L.forEach((it, i) => frag.appendChild(this.cartao(it, preps[i], pers, nomeDe, locais)));
    l.replaceChildren(frag);
  },
  cartao(it, P, pers, nomeDe, locais) {
    const partes = P?.partes || [], falas = partes.flatMap(p => p.falas || []), seg = falas.reduce((s, f) => s + (+f.duracao || 0), 0);
    const nomes = this.unicos(it.pers?.length ? it.pers : falas.map(f => f.personagem)).slice(0, 8);
    const usos = (P?.usadoPor || []).filter(u => u.programa === 'animador').sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
    const ult = usos[0], nomeUlt = ult ? nomeDe(ult.projeto) : null;
    const info = [`${partes.length || it.partes || 1} ${(partes.length || it.partes || 1) === 1 ? 'parte' : 'partes'}`, `${it.n ?? falas.length} falas, ${it.g ?? falas.filter(f => f.audio).length} gravadas`, seg ? this.dur(seg) + ' de áudio' : '', P?.legenda?.ativa === false ? 'sem legendas' : 'com legendas'].filter(Boolean).join(' · ');
    const card = h(`<div class="pp-card"><div class="pp-in">
        <div class="pp-t"><b>${esc(it.nome || P?.nome || 'Roteiro')}</b><span class="pp-ok">pronto</span></div>
        <span class="pp-info">${esc(info)}</span>
        <div class="pp-pers">${nomes.map(n => `<span><i style="background:${esc(this.cor(P, pers, n))}"></i>${esc(n)}</span>`).join('')}</div>
        <span class="pp-uso ${ult ? 'usado' : ''}">${ult ? `Sendo usado pela animação <b>${esc(nomeUlt || 'que não está neste computador')}</b>${usos.length > 1 ? ` (e mais ${usos.length - 1})` : ''} · ${esc(fmtDate(Date.parse(ult.quando) || 0))}` : 'Ainda não foi usado em nenhuma animação.'}</span>
      </div><div class="pp-bts">${ult ? `<button class="btn" data-ir>${ic('film', 14)} Ir para a animação</button>` : ''}<button class="btn primary" data-montar>${ic('plus', 14)} ${ult ? 'Montar outra' : 'Montar animação'}</button></div></div>`);
    if (!P) { $('[data-montar]', card).disabled = true; $('.pp-uso', card).textContent = 'Não consegui abrir este roteiro agora.'; }
    $('[data-montar]', card).onclick = () => this.montar(it, P);
    if (ult) $('[data-ir]', card).onclick = async () => {
      const local = locais.find(p => p.id === ult.projeto);
      if (local) return NuvemAnim.abrir(local.id, local);
      NuvemTela.inicio(nomeUlt || it.nome, 'an'); let ok = false;
      try { await NuvemAnim.abrir(ult.projeto, null, { tela: true }); ok = true; } catch (e) { UI.toast('Não abriu a animação: ' + esc(e.message), { kind: 'err', time: 7000 }); } finally { NuvemTela.fim(ok); }
    };
    return card;
  },
  // ---------- montar ----------
  async montar(it, P0) {
    // a versão de agora (a da lista pode ter mudado desde que a tela foi pintada)
    let P; try { await this.lista(); P = await this.prep(it); } catch { P = P0; } if (!P) return;
    const partes = (P.partes || []).filter(p => (p.falas || []).length);
    if (!partes.length) return UI.toast('Este roteiro não tem falas.', { kind: 'warn' });
    let escolha = null;
    const body = h(`<div class="pp-dlg">
      <label class="field">Formato<select data-fmt>${FORMATOS.map(f => `<option value="${f.id}">${esc(f.nome)} · ${f.w}×${f.h}</option>`).join('')}</select></label>
      ${partes.length > 1 ? `<div class="pp-partes"><small>Marque as partes que entram:</small>${partes.map((p, i) => { const fs = p.falas || [], sg = fs.reduce((s, f) => s + (+f.duracao || 0), 0); return `<label class="chk"><input type="checkbox" data-p="${i}" checked> ${esc(p.capitulo ? p.capitulo + ' · ' : '')}${esc(p.nome || 'Parte ' + (i + 1))} <span>· ${fs.length} falas${sg ? ' · ' + this.dur(sg) : ''}</span></label>`; }).join('')}</div>` : ''}
      <label class="chk"><input type="checkbox" data-pers checked> Pôr na cena os personagens do Ateliê (os escolhidos no Preparativos ou, sem escolha, os da equipe com o mesmo nome), com a boca pela voz</label>
      ${partes.flatMap(p => p.falas).some(f => !f.audio) ? '<div class="pp-aviso">Algumas falas ainda não têm áudio: entram só com a legenda, no tempo de leitura.</div>' : ''}
      <div class="pp-dlg-bts"></div></div>`);
    const bts = $('.pp-dlg-bts', body), marcadas = () => $$('[data-p]', body).filter(x => x.checked).map(x => partes[+x.dataset.p]);
    const fecha = v => { escolha = v; body.closest('.modal-back')?.querySelector('[data-x]')?.click(); };
    const pintaBts = () => {
      if (partes.length === 1) { bts.innerHTML = `<button class="btn primary" data-um>Montar a animação</button>`; $('[data-um]', bts).onclick = () => fecha({ grupos: [partes] }); return; }
      const m = marcadas(), n = m.length;
      bts.innerHTML = `<button class="btn" data-juntar ${n ? '' : 'disabled'}>Juntar ${n === 1 ? 'a parte' : `as ${n}`} numa animação</button><button class="btn primary" data-cada ${n > 1 ? '' : 'disabled'}>Uma animação para cada (${n})</button>`;
      $('[data-juntar]', bts).onclick = () => fecha({ grupos: [m] }); $('[data-cada]', bts).onclick = () => fecha({ grupos: m.map(p => [p]), cada: true });
    };
    $$('[data-p]', body).forEach(x => x.onchange = pintaBts); pintaBts();
    await UI.modal({ title: partes.length > 1 ? `"${P.nome || it.nome}" tem ${partes.length} partes` : `Montar "${P.nome || it.nome}"`, iconHtml: '<span class="hm-gic" data-estudio-icone="pr"></span>', width: 560, body, buttons: [] });
    if (!escolha) return;
    escolha.fmt = FORMATOS.find(f => f.id === $('[data-fmt]', body).value) || FORMATOS[0]; escolha.comPers = $('[data-pers]', body).checked;
    return this.monta(it, P, escolha);
  },
  async monta(it, prep, o) {
    const nomeBase = prep.nome || it.nome || 'Roteiro', grupos = o.grupos, todas = grupos.flat(), falas = todas.flatMap(p => p.falas), comAud = falas.filter(f => f.audio);
    NuvemTela.inicio(nomeBase, 'pr', { titulo: 'Montando pelo Preparativos' }); let ok = false, primeiro = null; const feitos = [];
    try {
      // 1) áudios: baixa cada um uma vez só (guardado no banco do navegador pela chave da nuvem; regravação = chave nova)
      const aud = {}; let i = 0;
      for (const f of comAud) {
        NuvemTela.passo(.05 + .55 * i / Math.max(1, comAud.length), `Baixando o áudio ${++i} de ${comAud.length}…`);
        const k = 'prep/' + f.audio; let b = await Arq.pegaBlob(k).catch(() => null);
        if (!b) { b = await (await Nuvem.pede('/preparativos/arquivo?k=' + encodeURIComponent(f.audio))).blob(); await Arq.guardar(b, k); }
        aud[f.id] = { k, buf: await Som.decod(k).catch(() => null) };
      }
      // 2) cores e personagens da equipe com o mesmo nome
      NuvemTela.passo(.62, 'Pegando as cores e os personagens…');
      const pers = await this.pers(), quem = this.unicos(falas.map(f => f.personagem)), nomeDe = n => quem.find(q => this.chave(q) === this.chave(n)) || String(n || '').trim();
      for (const f of falas) f._quem = nomeDe(f.personagem);
      const qcor = Object.fromEntries(quem.map(n => [n, this.cor(prep, pers, n)])); await Short.carregaGosto().catch(() => { });
      // QUEM REPRESENTA CADA PERSONAGEM: o que foi escolhido no Preparativos (prep.animador.pers[chave do nome] = { id, nome } do
      // personagem do Ateliê na nuvem; null = nenhum); sem escolha = o PADRÃO do personagem (personagens.json[chave].atelie = { id, nome } | null);
      // sem padrão = personagem da equipe com o MESMO NOME
      const defs = {}, mapa = prep.animador?.pers || {}; if (o.comPers) { let L = null; const lista = async () => L || (L = await Nuvem.lista().catch(() => []));
        for (const n of quem) { const k = this.chave(n), m = k in mapa ? mapa[k] : pers?.[k]?.atelie; /* escolha do roteiro › padrão do personagem (aba Personagens do Preparativos) › mesmo nome */ if (m === null || (m && !m.id)) continue;
          const id = m?.id || (await lista()).find(y => this.chave(y.nome) === this.chave(n))?.id; if (!id) continue;
          try { const d = clone(await Nuvem.abrir(id)); defs[n] = d; await Arq.garantir(Modelo.chavesImgs(d)).catch(() => { }); } catch (e) { console.warn('personagem do Ateliê', n, e); } } }
      // 3) uma animação por grupo de partes
      for (const [gi, grupo] of grupos.entries()) {
        NuvemTela.passo(.75 + .2 * gi / grupos.length, grupos.length > 1 ? `Montando a animação ${gi + 1} de ${grupos.length}…` : 'Montando a animação…');
        const nome = grupos.length > 1 || grupo.length < (prep.partes || []).length ? `${nomeBase} — ${grupo.map(p => p.nome).join(' + ')}` : nomeBase;
        const P = this.projeto(prep, grupo, o.fmt, nome, aud, qcor, defs); P.nome = await Arquivos.nomeAnimacao(P.nome, P.id);
        try { P.autor = { ...(await Autores.eu()), em: Date.now() }; } catch { }
        await DB.put('projetos', JSON.parse(JSON.stringify(P))); feitos.push(P); if (!primeiro) primeiro = P;
      }
      // 4) avisa o Preparativos ("sendo usado pelo projeto X")
      NuvemTela.passo(.96, 'Avisando o Preparativos…');
      for (const P of feitos) try { await Nuvem.pede('/preparativos/acao', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao: 'usado', id: prep.id || it.id, programa: 'animador', projeto: P.id }) }); } catch (e) { console.warn('preparativos usado', e); }
      this._lista = null;
      // várias: ficam juntas numa pasta com o nome do roteiro (nuvem da equipe)
      if (feitos.length > 1) try { await PastasBib.grava('animn', d => { if (!d.pastas.includes(nomeBase)) d.pastas.push(nomeBase); for (const P of feitos) d.de[P.id] = nomeBase; }); } catch { }
      // 5) abre a primeira (a tela de carregando só sai com a cena pronta) e mexe a boca pela voz
      await App.abrir(primeiro); await App.esperaImagens?.(primeiro); this.bocas(); ok = true;
    } catch (e) { UI.toast('Não deu para montar: ' + esc(e.message || e), { kind: 'err', time: 9000 }); }
    finally { await NuvemTela.fim(ok); }
    if (ok) {
      UI.toast(feitos.length > 1 ? `${feitos.length} animações criadas (pasta <b>${esc(nomeBase)}</b>). Esta é a primeira.` : `Animação montada pelo Preparativos: ${falas.length} falas.`, { kind: 'ok', time: 6000 });
      for (const P of feitos.slice(1)) NuvemAnim.enviar?.(P).catch?.(() => { }); // as outras também vão para a nuvem da equipe
    }
  },
  // o projeto: falas uma depois da outra (a pausa do protocolo dos Shorts), um áudio por fala, legendas na cor de quem fala
  projeto(prep, grupo, fmt, nome, aud, qcor, defs) {
    const fps = fmt.fps, P = Modelo.novoProjeto({ w: fmt.w, h: fmt.h, fps, duracao: fps * 4, nome }); P.temFundoPadrao = true;
    P.prep = { id: prep.id, nome: prep.nome, partes: grupo.map(p => p.id), mod: prep.mod || null };
    const falas = grupo.flatMap(p => p.falas), leg = prep.legenda || {}, comLeg = leg.ativa !== false, nomes = Object.keys(qcor);
    const trilha = {}; let nt = 0; const tr = n => (trilha[n] ||= ++nt);
    let q = Math.round(fps * .1); const pos = [];
    falas.forEach((f, i) => {
      const a = aud[f.id], d = a?.buf?.duration || +f.duracao || Math.max(1.2, String(f.texto || '').length * .07), nq = Math.max(1, Math.ceil(d * fps)), quem = f._quem || String(f.personagem || '').trim();
      if (a) P.audios.push({ id: uid('au'), nome: `${i + 1}. ${quem || 'Fala'}`, arq: a.k, de: q, vol: 1, tipo: 'voz', trilha: tr(quem), _quem: quem, prep: { fala: f.id } });
      if (comLeg && f.texto) P.legendas.push(Short.legenda(P, { texto: (leg.mostrarNome && quem ? quem + ': ' : '') + f.texto, de: q, ate: q + nq - 1, cor: qcor[quem], quem, nomes, qcor }));
      pos.push({ quem, de: q, ate: q + nq - 1 });
      const nx = falas[i + 1]; q += nq + (nx ? Math.round(Short.pausa({ personagem: quem, texto: f.texto, acao: f.nota }, { personagem: nx._quem || nx.personagem, texto: nx.texto }) * fps) : 0);
    });
    P.duracao = q + Math.round(fps * .5);
    if (comLeg) P.legEstilo = { pos: 'baixo', blocos: true, karaoke: false, pop: false };
    // personagens da equipe: cada um do começo ao fim, espalhados na largura (os de quem fala na ordem em que aparecem)
    const ord = [...new Set(pos.map(x => x.quem))].filter(n => defs[n]), W = P.w, H = P.h;
    ord.forEach((n, i) => { const def = defs[n]; P.personagens[def.id] = def;
      const b = Modelo.caixaPersonagem(def, Modelo.partesNoEstado(def, {})), s = b.h > 0 ? clamp(H * (H > W ? .42 : .6) / b.h, .05, 4) : 1;
      const no = Modelo.novoNo('personagem', { ref: def.id, nome: def.nome, s: round(s, 3) }); no.atuacao = { ...Atuacao.PADRAO }; no.interp = true; no.suaveP = true; no._prepQuem = n;
      no.chaves = { 0: { x: Math.round(W * (i + 1) / (ord.length + 1)), y: Math.round(H * (H > W ? .86 : .93) - (b.y + b.h) * s), /* os pés perto do chão do quadro */ r: 0, s: round(s, 3), sx: i >= ord.length / 2 && ord.length > 1 ? -1 : 1, op: 1 } };
      P.raiz.unshift(no); }); // o 1º de P.raiz fica NA FRENTE (o fundo padrão fica atrás)
    return P;
  },
  // boca pela voz de cada fala, no personagem de quem fala (na animação aberta)
  bocas() {
    const P = App.P; if (!P?.prep) return; let nb = 0;
    for (const n of P.raiz.filter(x => x._prepQuem)) for (const a of P.audios.filter(y => y._quem === n._prepQuem)) { try { if (Som.bocaAuto(P, n, a)) nb++; } catch { } }
    if (nb) App.commit('Boca pela voz (' + nb + ')');
  },
};
