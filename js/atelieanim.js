/* ATELIÊ: QUAL VERSÃO DO PERSONAGEM ESTÁ ABERTA (e abrir a outra fácil)
   • Personagem da EQUIPE: o da nuvem (ou só neste computador, se ainda não foi). Mudou = vale para todas as animações quando salvar.
   • CÓPIA DE UMA ANIMAÇÃO ("o que está na timeline"): cada animação guarda a cópia dela do personagem (P.personagens).
     Aberta no Ateliê completo (?atelie=<id>&anim=<id da animação>), tudo que mudar vai SÓ para aquela animação:
     a animação aberta em outra aba recebe na hora (BroadcastChannel 'personagem-anim') e a guardada neste computador é atualizada.
     Não vira rascunho, não vai para a nuvem e não entra no ao vivo.
   O selo ao lado do nome (#at-onde) diz qual é e, clicando, lista as outras para abrir (numa aba nova).
   Também: quando o personagem da equipe é salvo, a animação recebe a versão nova SEM perder as imagens feitas só para um quadro
   (painel "Arrumar o quadro": imagens com doQuadro) — `junta`. */
'use strict';
const AtelieAnim = {
  // animações deste computador que têm uma cópia do personagem id
  async usos(id) {
    const L = (await DB.all('projetos').catch(() => [])).filter(p => p?.personagens?.[id]);
    return L.sort((a, b) => (b.modificado || 0) - (a.modificado || 0)).map(p => ({ id: p.id, nome: p.nome, em: p.modificado, def: p.personagens[id], quadros: this.quadros(p, id) }));
  },
  // em quantas camadas/quadros o personagem aparece (para o cartão)
  quadros(P, id) { let n = 0; const anda = l => { for (const x of l || []) { if (x.tipo === 'personagem' && x.ref === id) n++; anda(x.filhos); } }; anda(P.raiz); return n; },
  // abre a cópia da animação no Ateliê completo, numa aba nova
  async abrir(projeto, id) {
    if (App.P?.id === projeto) await App.salvarJa?.(); // a cópia que está na tela é a que abre
    const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('atelie', id); u.searchParams.set('anim', projeto);
    const w = window.open(u.href, '_blank'); if (!w) UI.toast('O navegador bloqueou a aba nova. Libere pop-ups para o Animador e tente de novo.', { kind: 'warn', time: 6000 });
  },
  // abre o personagem da equipe (nuvem/computador) numa aba nova
  abrirEquipe(id) { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('atelie', id); const w = window.open(u.href, '_blank'); if (!w) UI.toast('O navegador bloqueou a aba nova.', { kind: 'warn' }); },
  // na aba nova (?atelie=&anim=): lê a cópia da animação e abre
  async entrar(id, projeto) {
    const P = await DB.get('projetos', projeto).catch(() => null), def = P?.personagens?.[id];
    if (!def) { UI.toast('Esta animação (ou o personagem dentro dela) não está mais neste computador.', { kind: 'err', time: 6000 }); return false; }
    await Atelie.abrir(null, { def: clone(def), daAnim: { projeto, nome: P.nome } }); return !!Atelie.def;
  },
  liga() {
    if (this._ok) return; this._ok = true;
    for (const nm of ['commit', 'undo', 'redo']) { const f = Atelie[nm]; Atelie[nm] = function (...x) { const r = f.apply(this, x); if (Atelie.daAnim) AtelieAnim.agenda(); return r; }; }
  },
  agenda() { clearTimeout(this._t); this._t = setTimeout(() => this.mandar(), 400); },
  // a mudança vai para a animação: a aberta (outra aba) e a guardada neste computador
  async mandar(avisa) {
    clearTimeout(this._t); const A = Atelie.daAnim; if (!A || !Atelie.def) return; const def = JSON.parse(Atelie.ultimo || JSON.stringify(Atelie.def));
    try { def.thumb = Atelie.miniatura(); } catch { }
    try { (Atelie._canal ||= new BroadcastChannel('animador')).postMessage({ tipo: 'personagem-anim', projeto: A.projeto, def }); } catch { }
    try { const P = await DB.get('projetos', A.projeto); if (P?.personagens) { P.personagens[def.id] = def; P.modificado = Date.now(); await DB.put('projetos', P); } A.em = Date.now(); }
    catch (e) { UI.toast('Não consegui guardar na animação: ' + esc(e.message), { kind: 'err' }); }
    Atelie.base0 = Atelie.ultimo; Atelie.pintaEstado?.();
    if (avisa) UI.toast(`Já está na animação <b>${esc(A.nome)}</b> (cada mudança vai sozinha).`, { kind: 'ok', time: 3000 });
  },
  // o personagem da equipe chegou numa animação: troca pela versão nova, mas as imagens feitas SÓ para um quadro continuam
  junta(velho, novo) {
    if (!velho || !novo) return novo; const c = clone(novo);
    // as partes têm o mesmo id em todas as vistas: casa vista com vista e, dentro dela, parte com parte
    const vistas = d => { const m = new Map([[d.vistaAtual || '_', d.partes || []]]); for (const v of d.vistas || []) if (v.id !== d.vistaAtual && v.partes) m.set(v.id, v.partes); return m; };
    const vn = vistas(c);
    for (const [vid, ps] of vistas(velho)) { const alvo = vn.get(vid) || (vn.size === 1 ? [...vn.values()][0] : null); if (!alvo) continue;
      for (const p of ps) { const q = alvo.find(x => x.id === p.id); if (!q) continue;
        for (const i of p.imgs || []) if (i.doQuadro && !q.imgs.some(x => x.id === i.id)) q.imgs.push(clone(i)); } }
    if (velho.apKeys?.length) c.apKeys = [...new Set([...(c.apKeys || []), ...velho.apKeys])];
    return c;
  },
  // ---------- selo ao lado do nome: qual versão está aberta (clique = abrir outra) ----------
  pintaOnde() {
    const nome = $('#at-nome'); if (!nome || !Atelie.def || Atelie.soQuadro) { $('#at-onde')?.remove(); return; }
    let b = $('#at-onde'); if (!b) { b = h('<button class="at-onde" id="at-onde"></button>'); nome.after(b); b.onclick = e => this.menu(e); }
    const A = Atelie.daAnim, [cls, ico, t, dica] = A ? ['anim', 'film', `Cópia da animação · ${A.nome}`, `Você está mudando a CÓPIA de ${Atelie.def.nome} que está na animação "${A.nome}" (a da timeline). Tudo vai só para essa animação, na hora; o personagem da equipe não muda.`]
      : Atelie.naNuvem ? ['nuvem', 'cloud', 'Personagem da equipe · nuvem', 'Este é o personagem da EQUIPE (nuvem): o que mudar vale para todos e para as animações quando for salvo.']
      : ['local', 'monitor', 'Personagem · só neste computador', 'Este é o personagem guardado neste computador (ainda não está na nuvem da equipe).'];
    b.className = 'at-onde ' + cls; b.title = dica + ' · Clique para abrir outra versão.'; b.innerHTML = `${ic(ico, 13)}<span>${esc(t)}</span>${ic('down', 11)}`;
  },
  async menu(e) {
    const def = Atelie.def; if (!def) return; const r = e.currentTarget.getBoundingClientRect(), A = Atelie.daAnim, us = await this.usos(def.id);
    const fmt = t => t ? new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
    UI.ctx(r.left, r.bottom + 4, [
      { head: `${def.nome}: qual versão abrir` },
      { label: 'Personagem da equipe (nuvem / este computador)', icon: A ? 'cloud' : 'check', disabled: !A, action: () => this.abrirEquipe(def.id) },
      { head: us.length ? 'Cópias nas animações (o que está na timeline)' : 'Nenhuma animação deste computador usa ele' },
      ...us.map(u => ({ label: `${u.nome}${u.em ? ' · ' + fmt(u.em) : ''}`, icon: A?.projeto === u.id ? 'check' : 'film', disabled: A?.projeto === u.id, action: () => this.abrir(u.id, def.id) })),
      ...(A ? ['-', { label: 'Guardar esta cópia como personagem novo (só neste computador)', icon: 'dup', action: async () => { const nd = await Arquivos.duplicarPersonagem(JSON.parse(Atelie.ultimo || JSON.stringify(def)), null, `${def.nome} (${A.nome})`); if (nd) UI.toast(`Guardado como <b>${esc(nd.nome || '')}</b> em Só neste computador.`, { kind: 'ok' }); } }] : []),
    ]);
  },
  // ---------- tela inicial › Personagens › Nas animações: as cópias de cada animação, para abrir/organizar ----------
  async pintaLista(box, filtra) {
    const ps = (await DB.all('projetos').catch(() => [])).filter(p => p && !p.anterior && Object.keys(p.personagens || {}).length).sort((a, b) => (b.modificado || 0) - (a.modificado || 0));
    let n = 0; box.innerHTML = '';
    const sec = h(`<section class="bloco-sec anims"><div class="sec">${ic('film', 14)} Nas animações <small class="sec-sub">a cópia de cada personagem que está dentro de cada animação (a da timeline). Mudar aqui vale só para aquela animação.</small></div><div data-g></div></section>`); box.appendChild(sec);
    const g = $('[data-g]', sec);
    if (!ps.length) { g.innerHTML = '<div class="vazio">Nenhuma animação deste computador tem personagens.</div>'; return 0; }
    for (const P of ps) {
      const t = h(`<div class="pasta-t anim-t">${ic('film', 13)} ${esc(P.nome)}<span class="sp"></span><button class="btn sm ghost" title="Abrir a animação">${ic('play', 12)} Abrir a animação</button></div>`), grade = h('<div class="grade"></div>');
      $('button', t).onclick = () => App.abrir(P);
      for (const [id, def] of Object.entries(P.personagens)) { n++;
        const th = def.thumb || def.icone || '', q = this.quadros(P, id);
        const card = h(`<div class="pc anim-c"><div class="th" style="aspect-ratio:1;${th ? `background-image:url('${th}')` : ''}">${th ? '' : ic('layers', 26)}</div><div class="in"><b>${esc(def.nome || 'Personagem')}</b><small>${ic('film', 11)} cópia de ${esc(P.nome)}${q > 1 ? ` · ${q}×` : ''}</small></div><button class="ibtn mn" title="Opções">${ic('dots', 15)}</button></div>`);
        card.onclick = e => { if (!e.target.closest('.mn')) this.abrir(P.id, id); };
        $('.mn', card).onclick = e => { e.stopPropagation(); const b = e.currentTarget.getBoundingClientRect(); UI.ctx(b.right - 220, b.bottom + 4, [
          { label: 'Abrir esta cópia no Ateliê', icon: 'film', action: () => this.abrir(P.id, id) },
          { label: 'Abrir o personagem da equipe', icon: 'cloud', action: () => this.abrirEquipe(id) },
          { label: 'Abrir a animação', icon: 'play', action: () => App.abrir(P) },
          { label: 'Guardar a cópia como personagem novo (só neste computador)', icon: 'dup', action: async () => { await Arquivos.duplicarPersonagem(clone(def), def.thumb || null, `${def.nome} (${P.nome})`); Home.pinta(); } }]); };
        grade.appendChild(card); }
      g.appendChild(t); g.appendChild(grade);
    }
    filtra?.(); return n;
  },
};
