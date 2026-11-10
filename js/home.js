/* ===================== home.js — tela inicial: animações deste computador e a biblioteca de personagens da equipe ===================== */
'use strict';
const FORMATOS = [
  { id: 'yt', nome: 'YouTube', w: 1920, h: 1080, fps: 24 }, { id: 'shorts', nome: 'Shorts / TikTok', w: 1080, h: 1920, fps: 24 },
  { id: 'quad', nome: 'Quadrado', w: 1080, h: 1080, fps: 24 }, { id: 'yt12', nome: 'Animação em 12 fps', w: 1920, h: 1080, fps: 12 },
];
const Home = {
  // a nuvem (e a reserva) não deixaram listar: a parte da nuvem fica vazia e, separadas, as CÓPIAS LOCAIS (borda vermelha).
  // Abrir uma delas cria uma cópia só neste computador (vai para "Só neste computador"): nunca mexe no personagem da nuvem.
  copiasLocais(l, defs, parcial) {
    const html = `<div class="copias-pc"><div class="copias-pc-t">${ic('monitor', 14)}<b>Cópias guardadas neste computador</b><small>não são a nuvem: podem estar desatualizadas, e o que você mudar fica só aqui</small></div><div class="grade" data-cpc></div></div>`;
    if (parcial) { // a lista veio só com o que foi salvo na reserva: o resto aparece aqui embaixo, separado
      $('.copias-pc-parcial', l)?.remove(); const box = h(`<div class="copias-pc-parcial"><div class="vazio" style="padding:10px 0 4px">Acima estão os personagens salvos na <b>nuvem reserva</b> hoje. A lista completa da nuvem volta às 21h; até lá, os outros aparecem só como cópia deste computador.</div>${html}</div>`); l.appendChild(box); l = box; }
    else l.innerHTML = `<div class="vazio">A lista da nuvem não carregou agora (nem pela nuvem reserva). Os personagens da nuvem voltam a aparecer aqui quando ela voltar.</div>${html}`;
    const g = $('[data-cpc]', l);
    for (const d of defs.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt'))) {
      const card = h(`<div class="pc pc-local" title="Cópia deste computador — não é a versão da nuvem"><div class="th" style="${d.thumb ? `background-image:url('${d.thumb}')` : ''}">${d.thumb ? '' : ic('layers', 20)}<span class="pc-local-selo">cópia local</span></div><div class="in"><b>${esc(d.nome)}</b><small>${d.modificado ? fmtDate(d.modificado) : ''}</small></div></div>`);
      card.onclick = async () => {
        if (!(await UI.confirm({ title: 'Abrir uma cópia local?', msg: `A nuvem não carregou, então esta é a cópia de <b>${esc(d.nome)}</b> que estava neste computador (pode estar desatualizada).<br><br>Vou criar <b>${esc(d.nome)} (cópia local)</b> em "Só neste computador": o que você mudar fica só aqui e o personagem da nuvem não muda.`, ok: 'Criar a cópia local' }))) return;
        const nd = await Arquivos.duplicarPersonagem(d, d.thumb, (d.nome || 'Personagem') + ' (cópia local)', { copiaLocal: true }); if (nd) Atelie.abrirAba(nd.id);
      };
      g.appendChild(card);
    }
  },
  /* ---------- TELA INICIAL NOVA (pedido da dona, 05/11/2026; prévia aprovada): barra da esquerda com as SEÇÕES e quantos tem em
     cada uma (Animações · Preparativos · Personagens/Ateliê), cada seção com título e uma frase do que é, pastas em cartões
     (js/pastasbib.js, montaCartoes). As abas Animações/Ideias/Personagens saíram (as Ideias foram para o programa Preparativos). */
  SECOES: [
    { id: 'anim-nuvem', grupo: 'anim', sub2: 'nuvem', nome: 'Da equipe', sub: 'na nuvem', titulo: 'Animações da equipe', desc: 'Ficam na nuvem: toda a equipe vê e abre. As animações novas vêm para cá sozinhas.' },
    { id: 'anim-local', grupo: 'anim', sub2: 'local', nome: 'Só neste computador', sub: 'ninguém mais vê', titulo: 'Animações só deste computador', desc: 'Não estão na nuvem: só quem usa este computador vê. Para a equipe ver, abra o menu do cartão › Enviar para a nuvem.' },
    { id: 'prep', grupo: 'prep', sub2: '', nome: 'Prontos para animar', sub: 'roteiros com áudios', titulo: 'Preparativos prontos para animar', desc: 'Roteiros que a equipe marcou como prontos para o Animador no programa Preparativos. Escolha um e o Animador monta a animação: os áudios na ordem, um por fala, com as legendas nas cores de cada personagem.' },
    { id: 'pers-nuvem', grupo: 'pers', sub2: 'nuvem', nome: 'Da equipe', sub: 'na nuvem', titulo: 'Personagens da equipe', desc: 'Ficam na nuvem: são os que aparecem em "Pôr personagem" dentro de qualquer animação. Clique num para abrir no Ateliê.' },
    { id: 'pers-local', grupo: 'pers', sub2: 'local', nome: 'Só neste computador', sub: 'rascunhos', titulo: 'Personagens só deste computador', desc: 'Personagens novos e mudanças que ainda não foram para a nuvem (a equipe ainda não vê).' },
    { id: 'pers-anims', grupo: 'pers', sub2: 'anims', nome: 'Cópias nas animações', sub: 'mudados dentro de uma', titulo: 'Personagens dentro das animações', desc: 'A cópia de cada personagem que está dentro de cada animação deste computador. Mudar aqui vale só para aquela animação.' },
  ],
  secao: null, q: '',
  // compatível com o jeito antigo (Home.atual = 'animacoes' | 'personagens'; 'ideias' agora cai nas animações)
  get atual() { const s = this.secao || ''; return s.startsWith('pers') ? 'personagens' : s === 'prep' ? 'prep' : 'animacoes'; },
  set atual(a) { this.secao = a === 'personagens' ? 'pers-' + (this.subPers || 'nuvem') : (a === 'prep' || a === 'preparativos') ? 'prep' : 'anim-' + (this.subAnim || 'nuvem'); },
  aba(a) { this.atual = a; this.pinta(); },
  secoes() {
    const pode = k => window.EstudioPerm?.pode?.(k) ?? true, prog = k => window.EstudioPerm?.programa?.(k) ?? true;
    return this.SECOES.filter(s => (s.grupo !== 'pers' || pode('animador.atelie')) && (s.grupo !== 'prep' || prog('preparativos')));
  },
  secaoAtual() { return this.SECOES.find(s => s.id === this.secao) || this.SECOES[0]; },
  // quantos tem em cada seção: guardado neste navegador (aparece na hora) e trocado quando a lista de verdade chega
  nGuardados() { try { return JSON.parse(localStorage.getItem('animador-home-n') || '{}') || {}; } catch { return {}; } },
  poeN(id, n) { if (n == null || isNaN(n)) return; const o = this.nGuardados(); if (o[id] !== n) { o[id] = n; try { localStorage.setItem('animador-home-n', JSON.stringify(o)); } catch { } }
    const e = $(`#home-in [data-n="${id}"]`); if (e) e.textContent = n; },
  // conta só com o que já está no navegador ou já foi buscado há pouco (não pede listas novas à nuvem só para contar)
  async contar() {
    const locais = await DB.all('projetos').catch(() => []);
    this.poeN('pers-anims', locais.filter(p => p && !p.anterior).reduce((s, p) => s + Object.keys(p.personagens || {}).length, 0));
    Atelie.rascunhos().then(rs => this.poeN('pers-local', rs.length)).catch(() => { });
    if (NuvemAnim._lista && Date.now() - (NuvemAnim._listaEm || 0) < 60000) NuvemAnim._lista.then(nv => { const ids = new Set(nv.map(x => x.id)); this.poeN('anim-nuvem', ids.size); this.poeN('anim-local', locais.filter(p => !ids.has(p.id)).length); }).catch(() => { });
    if (Nuvem._lista && Date.now() - (Nuvem._listaEm || 0) < 120000) Nuvem._lista.then(l => this.poeN('pers-nuvem', l.length)).catch(() => { });
    if (this.secoes().some(s => s.id === 'prep') && typeof Prep !== 'undefined') Prep.lista().then(L => this.poeN('prep', L.length)).catch(() => { });
  },
  cabecalho(S, botoes = '', ph = 'Buscar em todas as pastas', val = '') {
    return `<div class="hm-cab"><div class="hm-tit"><h1>${esc(S.titulo)}</h1><p>${esc(S.desc)}</p></div><div class="hm-acoes">${ph ? `<label class="hm-busca">${ic('search', 14)}<input type="search" data-busca placeholder="${esc(ph)}" value="${esc(val || '')}" aria-label="${esc(ph)}"></label>` : ''}${botoes}</div></div>`;
  },
  async pinta() {
    const el = $('#home-in'); if (!el) return;
    if (!this._permOuvindo) { this._permOuvindo = 1; const re = () => { if (!$('#home')?.classList.contains('hidden')) this.pinta(); }; try { window.EstudioPerm?.pronto?.then?.(re); } catch { } addEventListener('estudio-perm', re); }
    if (!this.secao) { try { this.secao = localStorage.getItem('animador-home-secao') || ''; } catch { } }
    const vis = this.secoes(); if (!vis.some(s => s.id === this.secao)) this.secao = vis[0]?.id || 'anim-nuvem';
    const S = this.secaoAtual(); if (S.grupo === 'anim') this.subAnim = S.sub2; if (S.grupo === 'pers') this.subPers = S.sub2;
    const n0 = this.nGuardados(), G = [['anim', 'an', 'ANIMAÇÕES'], ['prep', 'pr', 'PREPARATIVOS'], ['pers', 'at', 'PERSONAGENS · ATELIÊ']];
    el.innerHTML = `<nav class="hm-nav" aria-label="Seções do Animador"><button class="hm-nova" data-nova>${ic('plus', 15)} Nova animação</button>
      ${G.map(([g, icn, tit]) => { const its = vis.filter(s => s.grupo === g); if (!its.length) return ''; return `<div class="hm-g hm-g-${g}"><span class="hm-gic" data-estudio-icone="${icn}"></span>${tit}</div>` + its.map(s => `<button class="hm-it${s.id === this.secao ? ' on' : ''}" data-sec="${s.id}"><span><b>${esc(s.nome)}</b><small>${esc(s.sub)}</small></span><em class="${s.id === 'prep' ? 'hm-n-prep' : ''}" data-n="${s.id}">${n0[s.id] ?? ''}</em></button>`).join(''); }).join('')}
      <span class="hm-esp"></span><button class="hm-abrir" data-abrir>${ic('folder', 14)} Abrir arquivo .animador</button></nav>
      <main class="hm-main"><div class="hm-in" data-corpo></div></main>`;
    try { window.EstudioIcones?.pinta?.(el); } catch { }
    $$('[data-sec]', el).forEach(b => b.onclick = () => { const s = this.SECOES.find(x => x.id === b.dataset.sec); // clicar na seção volta para o começo dela (fecha a pasta aberta)
      const escs = { 'anim-nuvem': 'animn', 'anim-local': 'anim', 'pers-nuvem': 'nuvem', 'pers-local': 'local' }; if (escs[s.id]) PastasBib.abre(escs[s.id], null);
      this.secao = s.id; try { localStorage.setItem('animador-home-secao', s.id); } catch { } this.pinta(); });
    $('[data-nova]', el).onclick = () => this.novaEscolha();
    $('[data-abrir]', el).onclick = async () => { const [f] = await pickFiles('.animador,.toon', false); if (f) this.importar(f); };
    const c = $('[data-corpo]', el); this.contar();
    if (S.grupo === 'anim') this.animacoes(c); else if (S.grupo === 'prep') Prep.pinta(c); else this.personagens(c);
  },
  // NOVA ANIMAÇÃO: escolher o formato (os botões que ficavam no topo da tela inicial). o.pasta: já entra nessa pasta
  async novaEscolha(o = {}) {
    let qual = null;
    const body = h(`<div class="novos hm-novos">${FORMATOS.map(f => { const k = 34 / Math.max(f.w, f.h); return `<button class="novo" data-f="${f.id}"><span class="fm"><i style="width:${f.w * k}px;height:${f.h * k}px"></i></span><span><b>${f.nome}</b><small>${f.w}×${f.h} · ${f.fps} fps</small></span></button>`; }).join('')}
      <button class="novo" data-f="pers"><span class="fm">${ic('gear', 24)}</span><span><b>Personalizado</b><small>tamanho, fps e fundo do seu jeito</small></span></button></div>`);
    $$('[data-f]', body).forEach(b => b.onclick = () => { qual = b.dataset.f; body.closest('.modal-back')?.querySelector('[data-x]')?.click(); });
    await UI.modal({ title: o.pasta ? `Nova animação em "${o.pasta}"` : 'Nova animação', icon: 'plus', width: 620, body, buttons: [] });
    if (!qual) return;
    const depois = async P => { if (o.pasta && o.esc && P) try { await PastasBib.mover(o.esc, [P.id], o.pasta); } catch { } };
    if (qual === 'pers') return this.personalizada(depois);
    const P = await this.nova(FORMATOS.find(f => f.id === qual)); await depois(P);
  },
  async animacoes(c) {
    const S = this.secaoAtual();
    c.innerHTML = `${this.cabecalho(S, `<button class="btn sm" data-atual-a title="Atualizar a lista (busca de novo na nuvem da equipe)">${ic('loop', 13)} Atualizar</button><button class="btn sm" data-pnova-a title="Pasta nova nesta seção">${ic('folder', 13)} Pasta nova</button><button class="btn sm primary" data-nova-a>${ic('plus', 13)} Nova animação</button>`, 'Buscar em todas as pastas', this.q)}<div data-cont></div><div data-g><div class="vazio hm-carregando"><span class="spin-dot"></span> Carregando as animações…</div></div>`;
    $('[data-nova-a]', c).onclick = () => this.novaEscolha();
    const busca = $('[data-busca]', c); busca.oninput = () => { this.q = busca.value; this.grade(c); };
    $('[data-pnova-a]', c).onclick = async () => { try { if (await PastasBib.nova(this.subAnim === 'nuvem' ? 'animn' : 'anim')) this.grade(c); } catch (e) { UI.toast(esc(e.message), { kind: 'err' }); } };
    $('[data-atual-a]', c).onclick = async e => { const b = e.currentTarget; b.disabled = true; try { PastasBib.esquece('animn'); await NuvemAnim.lista(true).catch(() => { }); await this.grade(c); UI.toast('Lista atualizada.', { kind: 'ok', time: 1800 }); } finally { b.disabled = false; } };
    this.grade(c);
    // AO VIVO AGORA: animações abertas para trabalhar junto
    // AO VIVO: quem está mexendo aparece NO CARTÃO da animação (fotos + "ao vivo"). Só as salas antigas do "Trabalhar junto"
    // (cópia temporária, sem cartão) ficam numa faixa própria, embaixo de tudo e só na aba da nuvem
    this._offLista?.(); const av = h('<section class="aovivo-agora" hidden><div class="sec">' + ic('users', 14) + ' Salas ao vivo <small class="sec-sub">cópias abertas pelo "Trabalhar junto"</small></div><div class="av-salas"></div></section>'); $('[data-g]', c).after(av);
    this._offLista = AoVivo.ouvirLista(L => { if (!av.isConnected) return this._offLista?.(); this._salas = L; this.pintaAoVivo(c, av); });
  },
  seloVivo(card, gente) { $('.an-vivo', card)?.remove(); card.classList.toggle('an-ao-vivo', !!gente.length); if (gente.length) ($('.th', card) || card).appendChild(h(`<span class="an-vivo" title="Ao vivo agora: ${esc(gente.map(x => x.nome || 'Alguém').join(', '))}"><i></i><span class="an-vivo-tx">ao vivo</span><span class="an-vivo-fotos">${AoVivo.fotinhas([...gente].sort((a, b) => (a.afk ? 1 : 0) - (b.afk ? 1 : 0)), gente.length <= 3 ? 3 : 2)}</span></span>`)); },
  // fotos de quem está em cada sala (nos cartões) e a faixa das salas sem cartão
  async pintaAoVivo(c, av) {
    const L = this._salas || [], g = $('.av-salas', av); let t = null; try { t = await AoVivo.transporte(); } catch { }
    const soltas = [], vivos = new Set(); for (const s of L) { const id = s.sala.slice(3), card = $(`.pc[data-anid="${CSS.escape(id)}"]`, c);
      let gente = []; try { gente = Object.values((await t?.genteDe?.(s.sala)) || {}).filter(g => g && g.nome); } catch { }
      // o "ao vivo" só aparece nas animações que estão NA NUVEM (as só deste computador não têm sala)
      const nv = card?.dataset.nv; if (gente.length && (nv || !card)) vivos.add(id);
      if (card) $$(`.pc[data-anid="${CSS.escape(id)}"]`, c).forEach(k => this.seloVivo(k, nv ? gente : []));
      else if (!s.auto && gente.length) soltas.push([s, gente]); }
    g.innerHTML = ''; for (const [s, gente] of soltas) { const b = h(`<button class="av-sala"><b>${esc(s.nome || 'Animação')}</b><small>aberta por ${esc(s.por || 'alguém')}</small><span class="av-fotos">${AoVivo.fotinhas(gente, 4)}</span><span class="btn sm">Entrar</span></button>`); b.onclick = () => this.entrarJunto(s); g.appendChild(b); }
    av.hidden = !soltas.length || this.subAnim === 'local';
    // quem está ao vivo vai para o TOPO da lista (e da pasta dele): mudou quem está = monta a grade de novo
    const ant = [...(this._vivos || [])].sort().join(), ag = [...vivos].sort().join(); this._vivos = vivos; if (ant !== ag && c.isConnected) this.grade(c);
  },
  async entrarJunto(s) {
    // tela "Carregando da nuvem" (decisão do dono, 04/11/2026) no lugar da janelinha antiga; aberta aqui = fecha aqui
    const minha = !NuvemTela.el; if (minha) NuvemTela.inicio(s.nome || 'Animação'); else NuvemTela.nome(s.nome);
    const fim = () => { if (minha) NuvemTela.fim(); }; let r; NuvemTela.passo(.15, 'Entrando na sala ao vivo…');
    try { r = await AoVivo.baixarSala(s.sala); NuvemTela.passo(.7, 'Abrindo a animação…'); } catch (e) { fim(); return UI.toast('Não deu para entrar: ' + esc(e.message), { kind: 'err' }); }
    if (!r) { fim(); return UI.toast('Essa sala já terminou.', { kind: 'warn' }); }
    try { const P = r.P; P.modificado = Date.now(); await DB.put('projetos', JSON.parse(JSON.stringify(P))); await App.abrir(P); await AoVivo.entrar(AoVivo.adAnimador(false), { avisa: true }); App.pintaJunto(); } finally { fim(); }
    UI.toast('Você entrou! Ao sair, a cópia com as últimas mudanças fica salva neste computador.', { kind: 'ok', time: 6000 });
  },
  async grade(c) {
    const g = $('[data-g]', c), locais = await DB.all('projetos');
    // ANIMAÇÕES DA NUVEM DA EQUIPE (js/nuvemanim.js): as que este computador ainda não tem aparecem junto, com o selo da nuvem
    let naNuvem = []; try { naNuvem = await NuvemAnim.lista(); } catch { } const temAqui = new Set(locais.map(p => p.id)), idsNuvem = new Set(naNuvem.map(x => x.id));
    const soNuvem = naNuvem.filter(x => !temAqui.has(x.id)).map(x => ({ id: x.id, nome: x.nome || 'Animação', modificado: x.mod || Date.parse(x.em || 0) || 0, _nuvem: x }));
    // DUAS ABAS: na nuvem (as da equipe: as que este computador tem e as que só estão lá) × só neste computador
    const naN = p => !!(p._nuvem || idsNuvem.has(p.id)), todosT = [...locais, ...soNuvem];
    const cN = $('[data-cn]', c), cL = $('[data-cl]', c); if (cN) cN.textContent = todosT.filter(naN).length; if (cL) cL.textContent = todosT.filter(p => !naN(p)).length; this.poeN('anim-nuvem', todosT.filter(naN).length); this.poeN('anim-local', todosT.filter(p => !naN(p)).length);
    const naNuvemAba = this.subAnim !== 'local', escP = naNuvemAba ? 'animn' : 'anim';
    const todos = todosT.filter(p => naN(p) === naNuvemAba).sort((a, b) => (this._vivos?.has(b.id) ? 1 : 0) - (this._vivos?.has(a.id) ? 1 : 0) || b.modificado - a.modificado), q = this.q.trim().toLowerCase(), L = todos.filter(p => !q || p.nome.toLowerCase().includes(q));
    // em PASTAS (só neste computador, arquivos["pastas-anim"]; js/pastasbib.js): abrir/fechar, arrastar entre pastas, criar/renomear/apagar.
    // Buscando: tudo junto numa grade só (sem pastas)
    if (!L.length) { g.innerHTML = `<div class="vazio">${todos.length ? 'Nada com esse nome.' : naNuvemAba ? 'Nenhuma animação na nuvem da equipe ainda. As animações novas vão para cá sozinhas.' : 'Nenhuma animação só neste computador.'}</div>`; return; }
    let todasP = [];
    const cartao = p => {
      if (p._nuvem) return this.cartaoNuvem(p, c, () => q ? null : todasP);
      const card = h(`<div class="pc"><div class="th" style="${p.thumb ? `background-image:url('${p.thumb}')` : ''}">${p.thumb ? '' : ic('film', 26)}</div><div class="in"><b>${esc(p.nome)}</b><small>${fmtDate(p.modificado)} · ${p.duracao} quadros · ${p.w}×${p.h}</small></div><button class="ibtn mn" title="Opções">${ic('dots', 15)}</button><span class="tam" hidden></span>${p.anterior ? '<span class="anterior" title="A versão de ANTES do trabalho em conjunto. Vira um arquivo comum quando você mudar algo nela.">anterior</span>' : ''}</div>`);
      card.dataset.anid = p.id; if (idsNuvem.has(p.id)) card.dataset.nv = 1; Arquivos.poe($('.tam', card), Arquivos.tamProjeto(p));
      if (idsNuvem.has(p.id)) { const s1 = h(`<span class="an-nv" title="Na nuvem da equipe: toda a equipe vê e abre">${ic('cloud', 12)}</span>`); $('.th', card).appendChild(s1); }
      { const it = naNuvem.find(x => x.id === p.id), d = it ? NuvemAnim.quemDe(it) || p : p; const selo = d?.autor ? Autores.selo(d, { local: !idsNuvem.has(p.id) }) : null; if (selo) card.appendChild(selo); } // quem criou / editou, igual ao Ateliê
      card.onclick = e => { if (!e.target.closest('.mn')) NuvemAnim.abrir(p.id, p); };
      $('.mn', card).onclick = e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); UI.ctx(r.right - 200, r.bottom + 4, [
        { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome da animação', value: p.nome }); if (n) { p.nome = await Arquivos.nomeAnimacao(n, p.id); await DB.put('projetos', p); this.pinta(); } } },
        { label: 'Duplicar', icon: 'dup', action: async () => { const c2 = clone(p); c2.id = uid('p'); delete c2.nuvemEm; delete c2.nuvemMod; if (p.nuvemAuto || p.nuvemEm) c2.nuvemAuto = true; c2.nome = await Arquivos.nomeAnimacao(p.nome, c2.id); c2.modificado = Date.now(); await DB.put('projetos', c2); this.pinta(); } },
        { label: 'Baixar .animador', icon: 'download', action: () => Toon.baixar(p) },
        p.anterior && { label: 'Apagar este anterior', icon: 'trash', danger: true, action: () => this.apagar(p) },
        idsNuvem.has(p.id) ? { label: 'Remover da nuvem', icon: 'cloud', action: () => this.removerDaNuvem(p, c) }
          : !p.anterior && { label: 'Enviar para a nuvem', icon: 'cloud', action: async () => { try { await NuvemAnim.enviar(p); UI.toast('Enviada para a nuvem da equipe.', { kind: 'ok' }); this.grade(c); } catch (e) { UI.toast('Não enviou: ' + esc(e.message), { kind: 'err' }); } } },
        { label: 'Citar em mensagens…', icon: 'chat', action: () => Citacao.animacao(p, 0) },
        !q && PastasBib.menuMover(escP, p, todasP, () => this.grade(c)),
        '-', { label: 'Apagar', icon: 'trash', danger: true, action: () => this.apagar(p) },
      ].filter(Boolean)); };
      return card;
    };
    if (q) { $('[data-cont]', c)?.replaceChildren(); g.innerHTML = ''; const gr = h('<div class="grade"></div>'); for (const p of L) gr.appendChild(cartao(p)); g.appendChild(gr); const av = $('.aovivo-agora', c); if (av && this._salas) this.pintaAoVivo(c, av); return; }
    // CONTINUAR DE ONDE PAROU: as 4 mais novas desta seção, em cima das pastas (só no começo da seção, sem busca)
    const cont = $('[data-cont]', c); if (cont) { cont.innerHTML = ''; if (!PastasBib.aberta(escP) && L.length > 4) { const sec = h(`<section class="pb-sec hm-cont"><h3 class="pb-h">Continuar de onde parou</h3><div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))"></div></section>`); for (const p of L.slice(0, Math.max(4, L.filter(p => this._vivos?.has(p.id)).length))) $('.grade', sec).appendChild(cartao(p)); cont.appendChild(sec); } }
    const S = this.secaoAtual(), novaAqui = pa => { const b = h(`<button class="btn sm primary">${ic('plus', 13)} Nova animação aqui</button>`); b.onclick = () => this.novaEscolha({ pasta: pa, esc: escP }); return b; };
    try { ({ todas: todasP } = await PastasBib.monta(g, { esc: escP, min: 220, itens: L, cartao, aoMudar: () => this.grade(c), cartoes: true, titulo: S.titulo, miniatura: p => p.thumb || this._thumbU?.get(p.id), data: p => p.modificado, acoesPasta: novaAqui })); }
    catch { g.innerHTML = ''; const gr = h('<div class="grade"></div>'); for (const p of L) gr.appendChild(cartao(p)); g.appendChild(gr); }
    const av = $('.aovivo-agora', c); if (av && this._salas) this.pintaAoVivo(c, av);
  },
  // cartão de uma animação que só está na NUVEM DA EQUIPE (este computador ainda não tem): abrir baixa e entra no ao vivo
  cartaoNuvem(p, c, todas) {
    const x = p._nuvem, card = h(`<div class="pc an-so-nuvem"><div class="th">${ic('film', 26)}<span class="an-nv" title="Na nuvem da equipe">${ic('cloud', 12)}</span></div><div class="in"><b>${esc(p.nome)}</b><small>${p.modificado ? fmtDate(p.modificado) + ' · ' : ''}na nuvem da equipe</small></div><button class="ibtn mn" title="Opções">${ic('dots', 15)}</button><span class="tam" hidden></span></div>`);
    card.dataset.anid = x.id; card.dataset.nv = 1; if (x.tam) { const t = $('.tam', card); t.hidden = false; t.textContent = Arquivos.fmt ? Arquivos.fmt(x.tam) : Math.round(x.tam / 1048576 * 10) / 10 + ' MB'; }
    (async () => { try { const tk = x.id + '@' + (x.mod || x.em || ''), M = (this._thumbN ||= new Map()), MK = (this._thumbK ||= new Map()); // guarda a PROMESSA: a lista é desenhada várias vezes ao abrir e cada uma pedia de novo antes da 1ª resposta chegar
      if (MK.get(x.id) !== tk) { MK.set(x.id, tk); M.set(x.id, Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(NuvemAnim.pasta(x.id) + 'thumb.jpg')).then(r => r.blob()).then(b => URL.createObjectURL(b)).catch(e => { MK.delete(x.id); throw e; })); }
      const u = await M.get(x.id);
      (this._thumbU ||= new Map()).set(x.id, u); const th = $('.th', card); th.style.backgroundImage = `url('${u}')`; th.firstChild?.remove?.(); } catch { } })();
    { const d = NuvemAnim.quemDe(x); const selo = d ? Autores.selo(d) : null; if (selo) card.appendChild(selo); } // quem criou / editou
    card.onclick = e => { if (!e.target.closest('.mn')) NuvemAnim.abrir(x.id, null); };
    $('.mn', card).onclick = e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); UI.ctx(r.right - 220, r.bottom + 4, [
      { label: 'Abrir', icon: 'film', action: () => NuvemAnim.abrir(x.id, null) },
      todas?.() && PastasBib.menuMover('animn', p, todas(), () => this.grade(c)),
      '-', { label: 'Remover da nuvem', icon: 'cloud', danger: true, action: () => this.removerDaNuvem(p, c) },
    ].filter(Boolean)); };
    return card;
  },
  // REMOVER DA NUVEM: sai da nuvem para toda a equipe e não volta sozinha (só pelo "Enviar para a nuvem"); quem tem cópia continua com ela
  async removerDaNuvem(p, c) {
    if (!(await UI.confirm({ title: `Remover "${esc(p.nome)}" da nuvem?`, msg: 'Ela sai da nuvem da equipe e <b>não volta sozinha</b>. A cópia deste computador continua em <b>Só neste computador</b> (se você tiver). Para pôr de volta: botão de opções › <b>Enviar para a nuvem</b>.', ok: 'Remover da nuvem', danger: true }))) return;
    try { await NuvemAnim.remover(p.id); UI.toast('Removida da nuvem. Ela não volta sozinha.', { kind: 'ok', time: 6000 }); this.grade(c); }
    catch (e) { UI.toast('Não removeu: ' + esc(e.message), { kind: 'err', time: 8000 }); }
  },
  /* ---------- tela personalizada: tamanho, quadros por segundo, duração e fundo ---------- */
  TAMANHOS: [['1920×1080 (YouTube)', 1920, 1080], ['1080×1920 (Shorts/TikTok)', 1080, 1920], ['1080×1080 (quadrado)', 1080, 1080], ['1080×1350 (Instagram 4:5)', 1080, 1350], ['2560×1440 (2K)', 2560, 1440], ['3840×2160 (4K)', 3840, 2160], ['1280×720 (HD)', 1280, 720], ['2048×858 (cinema 2.39)', 2048, 858]],
  SIS_TELA: `Você configura uma animação 2D nova a partir do pedido em português. Responda SÓ um JSON:
{"nome":"nome curto","w":1920,"h":1080,"fps":24,"segundos":4,"fundo":{"modo":"quadriculado|cor","cor":"#rrggbb","forca":0.35},"folha":"#rrggbb","semFolha":false,"explica":"uma frase"}
Regras: w e h entre 64 e 4096 (pares); fps entre 1 e 60 (desenho animado costuma usar 12 ou 24); segundos entre 1 e 600. "folha" é a cor da folha do tamanho da câmera (Fundo padrão); semFolha=true se a pessoa não quiser folha. Se o pedido não falar de algo, use o comum (1920×1080, 24 fps, 4 s, fundo quadriculado #cfcfcf, folha #ffffff).`,
  async personalizada(depois) {
    const o = { nome: 'Animação ' + new Date().toLocaleDateString('pt-BR'), w: 1920, h: 1080, fps: 24, segundos: 4, palco: { modo: 'quadriculado', cor: '#cfcfcf', forca: .35 }, folha: '#ffffff', semFolha: false };
    const body = h(`<div class="tela-p"><div data-pag="ajustes"></div>
      </div>`);
    const pag = $('[data-pag=ajustes]', body), prev = () => { const k = 120 / Math.max(o.w, o.h); return `<i style="width:${Math.round(o.w * k)}px;height:${Math.round(o.h * k)}px;background:${o.semFolha ? 'transparent' : o.folha}"></i>`; };
    // a prévia mostra o fundo escolhido (quadriculado na cor/intensidade, ou cor lisa), igual ao palco
    const fundoPrev = () => { const pc = o.palco, c = pc.cor; if (pc.modo === 'cor') return `background:${c}`;
      const [r, g, b] = rgbDe(c), claro = r * .3 + g * .59 + b * .11 > 140, a = claro ? pc.forca * .22 : pc.forca * .16, x = claro ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
      return `background:repeating-conic-gradient(${x} 0 25%,transparent 0 50%) 0 0/16px 16px,${c}`; };
    const pinta = () => {
      pag.innerHTML = `<div class="tela-prev" data-prev style="${fundoPrev()}">${prev()}</div>
        <label class="field">Nome<input type="text" data-k="nome" value="${esc(o.nome)}"></label>
        <label class="field">Tamanho pronto<select data-tam><option value="">Escolher…</option>${this.TAMANHOS.map(([n, w, hh], i) => `<option value="${i}" ${w === o.w && hh === o.h ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <div class="campo2"><span style="color:var(--tx2)">Largura</span><input type="number" data-k="w" value="${o.w}" min="64" max="4096" style="width:80px"><span style="color:var(--tx2)">Altura</span><input type="number" data-k="h" value="${o.h}" min="64" max="4096" style="width:80px"><button class="btn sm" data-girar title="Trocar largura e altura">${ic('redo', 13)} Girar</button></div>
        <div class="campo2"><span style="color:var(--tx2)">Quadros por segundo</span><select data-k="fps">${[8, 10, 12, 15, 24, 25, 30, 48, 50, 60].map(f => `<option ${f === o.fps ? 'selected' : ''}>${f}</option>`).join('')}</select><span style="color:var(--tx2)">Duração</span><input type="number" data-k="segundos" value="${o.segundos}" min="1" max="600" style="width:64px"><span style="color:var(--tx3)">s = ${Math.round(o.segundos * o.fps)} quadros</span></div>
        <div class="campo2"><span style="color:var(--tx2)">Fundo</span><div class="presets" style="display:inline-flex"><button data-m="quadriculado" class="${o.palco.modo === 'quadriculado' ? 'on' : ''}">Quadriculado</button><button data-m="cor" class="${o.palco.modo === 'cor' ? 'on' : ''}">Cor lisa</button></div><input type="color" data-pc value="${o.palco.cor}"></div>
        <div class="campo2"><label class="chk"><input type="checkbox" data-folha ${o.semFolha ? '' : 'checked'}> Folha do tamanho da câmera</label><input type="color" data-fc value="${o.folha}" ${o.semFolha ? 'disabled' : ''}></div>`;
      $$('[data-k]', pag).forEach(i => i.onchange = () => { const k = i.dataset.k; o[k] = k === 'nome' ? i.value.trim() || o.nome : clamp(+i.value || 1, k === 'fps' ? 1 : k === 'segundos' ? 1 : 64, k === 'fps' ? 60 : k === 'segundos' ? 600 : 4096); if (k === 'w' || k === 'h') o[k] = Math.round(o[k] / 2) * 2; pinta(); });
      $('[data-tam]', pag).onchange = ev => { const t = this.TAMANHOS[+ev.target.value]; if (t) { o.w = t[1]; o.h = t[2]; pinta(); } };
      $('[data-girar]', pag).onclick = () => { [o.w, o.h] = [o.h, o.w]; pinta(); };
      $$('[data-m]', pag).forEach(b => b.onclick = () => { o.palco.modo = b.dataset.m; pinta(); });
      $('[data-pc]', pag).oninput = ev => { o.palco.cor = ev.target.value; $('[data-prev]', pag).style.cssText = fundoPrev(); }; $('[data-fc]', pag).oninput = ev => { o.folha = ev.target.value; $('[data-prev]', pag).innerHTML = prev(); };
      $('[data-folha]', pag).onchange = ev => { o.semFolha = !ev.target.checked; pinta(); };
    };
    pinta();
    const ok = await UI.modal({ title: 'Tela personalizada', icon: 'gear', width: 580, body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Criar', kind: 'primary', value: true }] });
    if (!ok) return;
    const P = await this.nova({ w: o.w, h: o.h, fps: o.fps }, { nome: o.nome, duracao: Math.max(1, Math.round(o.segundos * o.fps)), palco: o.palco, folha: o.folha, semFolha: o.semFolha });
    await depois?.(P);
  },
  async apagar(p) { if (!(await UI.confirm({ title: 'Apagar a animação?', msg: `"<b>${esc(p.nome)}</b>" sai deste computador. Baixe o .animador antes se quiser guardar.`, ok: 'Apagar', danger: true }))) return; await DB.del('projetos', p.id); this.pinta(); EstudioConta?.espaco?.atualizar?.(); },
  async nova(f, o = {}) { const P = Modelo.novoProjeto({ w: f.w, h: f.h, fps: f.fps, duracao: o.duracao || f.fps * 4, nome: o.nome || 'Animação ' + new Date().toLocaleDateString('pt-BR'), fundo: o.folha }); P.nome = await Arquivos.nomeAnimacao(P.nome, P.id);
    if (o.palco) P.palco = o.palco; if (o.semFolha) P.raiz = P.raiz.filter(n => !n.fundoPadrao); P.temFundoPadrao = true; try { P.autor = { ...(await Autores.eu()), em: Date.now() }; } catch { } await DB.put('projetos', P); App.abrir(P); return P; },
  // abrir um .animador; se for um personagem do Ateliê (.atelieanimador), abre no Ateliê e avisa
  async importar(f) {
    if ((await AtelieArq.tipo(f)) === 'atelie') return AtelieArq.abrir(f, { errado: true });
    try { const { P, info } = await Toon.ler(f); P.nome = await Arquivos.nomeAnimacao(P.nome, P.id); await DB.put('projetos', P); await App.abrir(P); fichaAnimacao(P, info); } catch (e) { UI.toast('Não abriu: ' + esc(e.message), { kind: 'err' }); }
  },
  // título de pasta da biblioteca: botão direito muda a cor (guardada neste navegador)
  tituloPasta(pa) {
    const cor = CoresPasta.get('bib:' + pa), t = h(`<div class="pasta-t ${cor ? 'com-cor' : ''}" style="${cor ? `--pc:${cor}` : ''}" title="Botão direito: cor da pasta">${ic('folder', 13)} ${esc(pa)}</div>`);
    t.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [menuCor(cor, c => { CoresPasta.set('bib:' + pa, c); t.classList.toggle('com-cor', !!c); t.style.setProperty('--pc', c || ''); })]); };
    return t;
  },
  async personagens(c) {
    Nuvem.souAdm(); // o menu de cada personagem já sai certo (apagar da nuvem: só ADM)
    const S = this.secaoAtual(), sub0 = S.sub2 || 'nuvem';
    c.innerHTML = `${this.cabecalho(S, `<button class="btn sm" data-backup title="Abrir o backup de um personagem">${ic('folder', 13)} Abrir .atelieanimador</button><button class="btn sm" data-pnova-n title="Pasta nova na nuvem da equipe (todos veem)" ${sub0 === 'nuvem' ? '' : 'hidden'}>${ic('folder', 13)} Pasta nova</button><button class="btn sm" data-atu ${sub0 === 'nuvem' ? '' : 'hidden'}>${ic('loop', 13)} Atualizar</button><button class="btn sm primary" data-novo>${ic('plus', 13)} Personagem novo</button>`, 'Buscar personagem', this.qp)}
      <div data-anims hidden></div>
      <div data-local hidden><section class="bloco-sec local"><div class="vazio">Nenhum personagem só neste computador: tudo já está na nuvem da equipe.</div></section></div>
      <section class="bloco-sec hm-sem-cab" data-nuvem><div data-res-aviso></div><div data-l><div class="vazio"><span class="spin-dot"></span> Carregando…</div></div></section>`;
    Nuvem.avisoReserva($('[data-res-aviso]', c));
    $('[data-novo]', c).onclick = () => Atelie.abrirAba(null); $('[data-backup]', c).onclick = () => AtelieArq.escolher(); $('[data-atu]', c).onclick = () => { PastasBib.esquece('nuvem'); Nuvem.lista(true).catch(() => { }); this.pinta(); };
    const l = $('[data-l]', c);
    // as duas listas ficam em abas separadas (com quantos tem em cada): muitos personagens numa não empurram a outra
    const sub = s => { this.subPers = s; try { localStorage.setItem('animador-pers-aba', s); } catch { } $$('[data-s]', c).forEach(b => b.classList.toggle('on', b.dataset.s === s)); $('[data-nuvem]', c).hidden = s !== 'nuvem'; $('[data-local]', c).hidden = s !== 'local'; $('[data-anims]', c).hidden = s !== 'anims'; };
    sub(sub0);
    const filtra = () => { const q = (this.qp || '').trim().toLowerCase(); $$('.pc', c).forEach(card => { const n = $('.in b', card)?.textContent.toLowerCase() || ''; card.hidden = !!q && !n.includes(q); });
      $$('.grade', c).forEach(g => { const t = g.previousElementSibling; if (t?.classList.contains('pasta-t')) t.hidden = g.children.length && [...g.children].every(x => x.hidden); }); };
    // buscando: tudo numa grade só (sem pastas); parou de buscar: volta às pastas
    $('[data-busca]', c).oninput = ev => { const antes = !!(this.qp || '').trim(); this.qp = ev.target.value; if (antes !== !!this.qp.trim()) { this._pl?.(); this._pn?.(); } else filtra(); };
    // rascunhos: mudanças guardadas só neste computador (ainda não foram para a nuvem)
    // rascunhos: mudanças guardadas só neste computador (ainda não foram para a nuvem), em PASTAS (js/pastasbib.js)
    const pintaLocal = () => Atelie.rascunhos().then(async rs => { const box = $('[data-local]', c); this.poeN('pers-local', rs.length);
      if (!rs.length) { box.innerHTML = '<section class="bloco-sec local"><div class="vazio">Nenhum personagem só neste computador: tudo já está na nuvem da equipe.</div></section>'; return; }
      const sec = h(`<section class="bloco-sec local"><div class="sec">${ic('save', 14)} Só neste computador <small class="sec-sub">personagens locais e mudanças que ainda não foram para a nuvem (a equipe não vê)</small><span class="sp"></span><button class="btn sm" data-pnova>${ic('folder', 13)} Pasta nova</button><button class="btn sm danger-l" data-apaga-todos>${ic('trash', 13)} Apagar todos</button></div><div data-pb></div></section>`);
      const itens = rs.map(r => ({ id: r.def.id, nome: r.def.nome, r })); let todas = [];
      const cartao = it => { const r = it.r; const card = h(`<div class="pc rasc" data-prev-rasc="${esc(r.def.id)}"><div class="th" style="aspect-ratio:1;${r.thumb ? `background-image:url('${r.thumb}')` : ''}">${r.thumb ? '' : ic('layers', 26)}</div><div class="in"><b>${esc(r.def.nome)}</b><small>guardado ${fmtDate(r.em)} ${Vetor.selo(Vetor.tiposDef(r.def))}</small></div><span class="tag-local">${ic('save', 11)} ${r.nuvem ? 'falta enviar' : 'só aqui'}</span><button class="ibtn mn">${ic('dots', 15)}</button><span class="tam" hidden></span></div>`);
        Arquivos.poe($('.tam', card), Arquivos.tamDef(r.def, r.em));
        card.onclick = e => { if (!e.target.closest('.mn')) Atelie.abrirAba(r.def.id); };
        $('.mn', card).onclick = e => { e.stopPropagation(); const b = e.currentTarget.getBoundingClientRect(); UI.ctx(b.right - 200, b.bottom + 4, [PastasBib.menuMover('local', it, todas, pintaLocal), '-', 
          { label: 'Continuar no Ateliê', icon: 'edit', action: () => Atelie.abrirAba(r.def.id) }, { label: 'Baixar .atelieanimador', icon: 'download', action: () => AtelieArq.baixar(r.def) },
          { label: 'Duplicar (cópia só neste computador)', icon: 'dup', action: async () => { await Arquivos.duplicarPersonagem(r.def, r.thumb); this.pinta(); } },
          { label: 'Citar em mensagens…', icon: 'chat', action: () => Citacao.personagem(r.def, { thumb: r.thumb }) },
          '-', r.nuvem ? { label: 'Descartar o rascunho', icon: 'trash', danger: true, action: async () => { if (await UI.confirm({ title: `Descartar o rascunho de "${esc(r.def.nome)}"?`, msg: 'As mudanças que não foram para a nuvem somem deste computador. O personagem da nuvem continua lá.', ok: 'Descartar', danger: true })) { await Atelie.apagarRascunho(r.def.id, true); this.pinta(); } } }
            : { label: 'Apagar deste computador', icon: 'trash', danger: true, action: async () => { if (await UI.confirm({ title: `Apagar "${esc(r.def.nome)}"?`, msg: 'Ele só existe neste computador e some daqui (se estiver aberto em outra aba, ela fecha o personagem). <b>Não dá para desfazer.</b>', ok: 'Apagar', danger: true })) { await Atelie.apagarRascunho(r.def.id, true); this.pinta(); } } }]); };
        return card; };
      ({ todas } = await PastasBib.monta($('[data-pb]', sec), { esc: 'local', itens, cartao, aoMudar: pintaLocal, cartoes: true, get plano() { return !!(Home.qp || '').trim(); }, titulo: S.titulo, nomes: true, miniatura: it => it.r.thumb, data: it => it.r.em }));
      $('[data-pnova]', sec).onclick = async () => { if (await PastasBib.nova('local')) pintaLocal(); };
      $('[data-apaga-todos]', sec).onclick = async () => { if (!(await UI.confirm({ title: `Apagar os ${rs.length} personagens só deste computador?`, msg: 'Somem os personagens locais e as mudanças que ainda não foram para a nuvem. Os que estão na nuvem continuam lá. <b>Não dá para desfazer.</b>', ok: 'Apagar todos', danger: true }))) return;
        for (const r of rs) await Atelie.apagarRascunho(r.def.id, true); UI.toast(`${rs.length} apagado(s) deste computador.`, { kind: 'ok' }); this.pinta(); };
      box.innerHTML = ''; box.appendChild(sec); filtra(); });
    pintaLocal(); this._pl = pintaLocal;
    if (sub0 === 'anims') AtelieAnim.pintaLista($('[data-anims]', c), () => filtra()).then(n => this.poeN('pers-anims', n));
    try {
      if (sub0 !== 'nuvem') return; const lista = await Nuvem.lista(); this.poeN('pers-nuvem', lista.length);
      if (Nuvem.semLista) { this.copiasLocais(l, Nuvem.copiasPc); return; }
      if (!lista.length) { l.innerHTML = '<div class="vazio">Ninguém criou personagens ainda. Clique em <b>Personagem novo</b>.</div>'; return; }
      // em PASTAS da equipe (personagens/pastas.json; js/pastasbib.js): abrir/fechar, arrastar entre pastas, criar/renomear/apagar
      let todasN = [];
      const cartaoN = it => {
          const card = h(`<div class="pc${it.naRes ? ' pc-res' : ''}" data-prev-id="${esc(it.id)}"${it.naRes ? ' title="Mudado hoje e guardado na nuvem reserva: às 21h volta sozinho para a nuvem principal"' : ''}><div class="th" style="aspect-ratio:1;${it.thumb ? `background-image:url('${it.thumb}')` : ''}">${it.thumb ? '' : ic('layers', 26)}</div><div class="in"><b>${esc(it.nome)}</b><small>${it.modificado ? fmtDate(it.modificado) : ''} ${Vetor.selo(it.tipos)}</small></div><button class="ibtn mn">${ic('dots', 15)}</button>${it.tam ? `<span class="tam">${Arquivos.fmt(it.tam)}</span>` : ''}</div>`);
          card.onclick = e => { if (!e.target.closest('.mn')) Atelie.abrirAba(it.id); };
          const selo = Autores.selo(it); if (selo) card.appendChild(selo);
          $('.mn', card).onclick = e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); UI.ctx(r.right - 200, r.bottom + 4, [PastasBib.menuMover('nuvem', it, todasN, pintaNuvem), '-', 
            { label: 'Abrir no Ateliê', icon: 'edit', action: () => Atelie.abrirAba(it.id) },
            { label: 'Citar em mensagens…', icon: 'chat', action: () => Citacao.personagem({ id: it.id, nome: it.nome, thumb: it.thumb, partes: [] }, { nuvem: true }) },
            { label: 'Duplicar (cópia só neste computador)', icon: 'dup', action: async () => { try { await Arquivos.duplicarPersonagem(await Nuvem.abrir(it.id), it.thumb); this.pinta(); } catch (er) { UI.toast(esc(er.message), { kind: 'err' }); } } },
            { label: 'Baixar .atelieanimador (backup)', icon: 'download', action: async () => { try { AtelieArq.baixar(await Nuvem.abrir(it.id)); } catch (er) { UI.toast(esc(er.message), { kind: 'err' }); } } },
            '-', !Nuvem.adm ? { label: 'Apagar da nuvem (só ADM)', icon: 'lock', action: () => Nuvem.pedeAdm(it.nome) } : { label: 'Apagar da nuvem', icon: 'trash', danger: true, action: async () => { if (!(await Nuvem.souAdm())) return Nuvem.pedeAdm(it.nome); if (await UI.confirm({ title: `Apagar "${esc(it.nome)}" da nuvem da equipe?`, msg: 'Some para todo mundo. Animações que já usam ele continuam com a cópia delas.', ok: 'Apagar', danger: true })) { await Nuvem.apagar(it.id).catch(er => UI.toast(esc(er.message), { kind: 'err' })); this.pinta(); } } },
          ]); };
          return card; };
      let pintaNuvem = async () => { try { lista.sort((a, b) => (this._vivosAt?.has(b.id) ? 1 : 0) - (this._vivosAt?.has(a.id) ? 1 : 0)); ({ todas: todasN } = await PastasBib.monta(l, { esc: 'nuvem', itens: lista, cartao: cartaoN, aoMudar: () => pintaNuvem(), cartoes: true, get plano() { return !!(Home.qp || '').trim(); }, titulo: S.titulo, nomes: true, min: 150, miniatura: it => it.thumb, data: it => it.modificado })); if (Nuvem.parcial && Nuvem.copiasPc?.length) this.copiasLocais(l, Nuvem.copiasPc, true); filtra(); } catch (e) { UI.toast(esc(e.message), { kind: 'err' }); } };
      // AO VIVO no Ateliê: personagem com gente mexendo agora (sala at-<id>) ganha o selo e vai para o topo da pasta
      const marcaVivos = async () => { const t = await AoVivo.transporte().catch(() => null), vivos = new Set();
        for (const s of this._salasAt || []) { const id = s.sala.slice(3); let gente = []; try { gente = Object.values((await t?.genteDe?.(s.sala)) || {}).filter(g => g && g.nome); } catch { }
          if (gente.length) vivos.add(id); const card = $(`.pc[data-prev-id="${CSS.escape(id)}"]`, l); if (card) this.seloVivo(card, gente); }
        const ant = [...(this._vivosAt || [])].sort().join(); this._vivosAt = vivos; if (ant !== [...vivos].sort().join() && l.isConnected) { await pn0(); marcaVivos(); } };
      const pn0 = pintaNuvem; pintaNuvem = async () => { await pn0(); if (this._salasAt) marcaVivos(); };
      this._offAt?.(); this._offAt = AoVivo.ouvirLista(L => { if (!l.isConnected) return this._offAt?.(); this._salasAt = L; marcaVivos(); }, 'atelie');
      this._pn = async () => { await pintaNuvem(); filtra(); }; await pintaNuvem(); $('[data-pnova-n]', c).onclick = async () => { try { if (await PastasBib.nova('nuvem')) pintaNuvem(); } catch (e) { UI.toast(esc(e.message), { kind: 'err' }); } };
      filtra();
    } catch (e) { l.innerHTML = `<div class="vazio">Não consegui abrir a biblioteca: ${esc(e.message)}</div>`; }
  },
};

/* ---------- arquivo .animador (antes se chamava .toon; os dois abrem): a animação com tudo dentro (personagens, imagens e áudios) ---------- */
const Toon = {
  ids(P) { return [...new Set([...Modelo.todos(P).filter(n => n.tipo === 'imagem').map(n => n.arq), ...(P.audios || []).flatMap(a => [a.arq, a.arqOrig]), ...(P.refsAnim || []).map(r => r.k), ...Object.values(P.personagens || {}).flatMap(d => Modelo.chavesImgs(d))].filter(Boolean))]; },
  // o .animador inteiro como Blob (para baixar ou mandar por mensagem)
  async montar(P) {
    // quem criou / editou vai junto (foto e nome, nunca o e-mail)
    try { await Autores.marca(P); if (App.P === P) App.salvarJa?.(); else await DB.put('projetos', JSON.parse(JSON.stringify(P))); } catch { }
    const eu = await Autores.eu().catch(() => null);
    const t = UI.toast('<span class="spin-dot"></span> Montando o .animador…', { time: 120000 }), enc = new TextEncoder(), files = [{ name: 'projeto.json', data: enc.encode(JSON.stringify({ ...P, thumb: undefined })) }, { name: 'info.json', data: enc.encode(JSON.stringify({ tipo: 'animador', v: 1, por: eu, em: Date.now() })) }];
    try { const cv = await DB.get('arquivos', 'ia-conversa:' + P.id); if (cv?.msgs?.length) files.push({ name: 'conversa-ia.json', data: enc.encode(JSON.stringify(cv)) }); } catch { } // conversa com o Assistente
    for (const id of this.ids(P)) { let b = await Arq.pegaBlob(id); if (!b && /^personagens\//.test(id)) b = await Nuvem.baixar(id).catch(() => null); if (b) files.push({ name: 'arq/' + encodeURIComponent(id), data: new Uint8Array(await b.arrayBuffer()) }); }
    t.remove(); return Zip.create(files);
  },
  async baixar(P) { downloadBlob(await this.montar(P), safeName(P.nome) + '.animador'); },
  async ler(f) {
    const m = Zip.read(await f.arrayBuffer()), pj = m.get('projeto.json'); if (!pj) throw new Error(m.get('personagem.json') ? 'Isto é um personagem do Ateliê (.atelieanimador), não uma animação.' : 'Não é um arquivo .animador.');
    let P = JSON.parse(new TextDecoder().decode(pj)); if (P.v !== 2) throw new Error('Este arquivo é do Animador antigo.');
    // imagem com o mesmo nome de uma que já está neste computador e OUTRO desenho ganha chave nova (não estraga a do personagem da equipe)
    const troca = {}; for (const [nome, d] of m) if (nome.startsWith('arq/')) { const k = decodeURIComponent(nome.slice(4)), b = new Blob([d]), k2 = await AtelieArq.chaveLivre(k, b); if (k2 !== k) troca[k] = k2; await Arq.guardar(b, k2); Arq.img.delete?.(k2); }
    if (Object.keys(troca).length) P = AtelieArq.trocaChaves(P, troca);
    try { const cv = m.get('conversa-ia.json'); if (cv && P.id) { const j = JSON.parse(new TextDecoder().decode(cv)), ja = await DB.get('arquivos', 'ia-conversa:' + P.id).catch(() => null); if (!(ja?.msgs?.length > (j.msgs?.length || 0))) await DB.put('arquivos', j, 'ia-conversa:' + P.id); } } catch { }
    let info = null; try { info = JSON.parse(new TextDecoder().decode(m.get('info.json'))); } catch { }
    P.id = uid('p'); P.modificado = Date.now(); delete P.nuvemEm; delete P.nuvemMod; delete P.soLocal; P.nuvemAuto = true; delete P.persAuto; await Autores.limpa(P); return { P, info };
  },
};

/* ---------- começar (só depois do login do Google conferido no servidor) ---------- */
// o "usar como programa" foi tirado: desliga o service worker antigo (se ainda estiver) e apaga o que ele guardou
try { navigator.serviceWorker?.getRegistrations?.().then(rs => rs.forEach(r => { if (new URL(r.scope).pathname.startsWith(location.pathname.replace(/[^/]*$/, ''))) r.unregister(); })).catch(() => { });
  self.caches?.keys?.().then(ks => ks.filter(k => k.startsWith('animador-')).forEach(k => caches.delete(k))).catch(() => { }); } catch { }
addEventListener('DOMContentLoaded', async () => {
  const email = await TurmaAuth.gate(); if (!email || !TurmaAuth.passed) return;
  Versao.liga(); // versão nova publicada = trava e pede para atualizar
  if (EMBED === 'quadro') return QuadroEd.iniciaEmbutido(); // painel "Arrumar este quadro" dentro do Animador: só o Ateliê, sem tela inicial
  // ainda na tela de carregamento: a biblioteca da equipe, quem fez cada projeto (nome e foto de agora) e as miniaturas,
  // para nada "pipocar" depois na tela inicial, no Ateliê ou nas fichas
  window.EstudioProgresso?.tarefa((async () => {
    const [L, ps, rs] = await Promise.all([Nuvem.lista().catch(() => []), DB.all('projetos').catch(() => []), Atelie.rascunhos().catch(() => [])]);
    const gente = [...L.flatMap(it => [it.autor, ...(it.edicoes || [])]), ...ps.flatMap(p => [p.autor, ...(p.edicoes || [])]), ...rs.flatMap(r => [r.def?.autor, ...(r.def?.edicoes || [])])].filter(Boolean);
    const pre = window.EstudioConta?.preImg || (() => null);
    await Promise.all([Autores.preCarregar(gente), ...L.map(it => pre(it.thumb)), ...ps.slice(0, 40).map(p => pre(p.thumb)), ...rs.map(r => pre(r.thumb))]);
  })(), 'Carregando a biblioteca e quem fez cada projeto');
  // "Sair da conta" (botão da conta): salva a animação aberta antes de sair
  (window.ESTUDIO_AO_SAIR ||= []).push(() => App.salvarJa());
  $('#home-brand').onclick = () => App.P ? App.fechar() : Home.pinta();
  // aba do Ateliê (aberta pelo botão Ateliê): abre direto o personagem; Voltar fecha a aba
  const at = new URLSearchParams(location.search).get('atelie');
  const naPose = new URLSearchParams(location.search).get('pose') === '1';
  const daAnim = new URLSearchParams(location.search).get('anim'); AtelieAnim.liga();
  if (at && daAnim) { Atelie.emAba = true; const okA = await AtelieAnim.entrar(at, daAnim); if (okA && naPose) await Animacoes.entrarNaPose(at); if (!okA) { history.replaceState(null, '', location.pathname); Atelie.emAba = false; Home.pinta(); } } // a CÓPIA de uma animação (o que está na timeline)
  else if (at) { Atelie.emAba = true; const abA = (async () => Atelie.abrir(at === 'novo' ? null : at, naPose ? { reserva: await Animacoes.reservaDaPose(at) } : {}))(); window.EstudioProgresso?.tarefa(abA, 'Abrindo o personagem e as imagens', 40000); await abA; /* a tela do programa só sai com o personagem pronto (05/11/2026) */ if (naPose && Atelie.def) await Animacoes.entrarNaPose(at); if (!Atelie.def) { if (at === 'novo') window.close(); history.replaceState(null, '', location.pathname); Atelie.emAba = false; Home.pinta(); } }
    if (at && Atelie.def) { const rc = await Citacao.receber(); if (rc?.parte) Citacao.irAtelie(rc.parte); }
  else { // F5 / "Atualizar todos os sites" com uma animação aberta (?projeto=<id>): volta direto para ela
    const pid = new URLSearchParams(location.search).get('projeto'), P = pid ? await DB.get('projetos', pid).catch(() => null) : null;
    if (P) { const abP = App.abrir(P).then(() => App.esperaImagens(P)); window.EstudioProgresso?.tarefa(abP, 'Abrindo a animação e as imagens da cena', 40000); await abP; await Citacao.receber(); } // a tela do programa só sai com a cena pronta (05/11/2026)
    else { if (pid) history.replaceState(null, '', location.pathname);
      // atalhos do cartão ANIMAR no menu: ?aba=personagens (Ateliê) / ?aba=ideias, ?abrir=cenarios (biblioteca de Cenários)
      const qs = new URLSearchParams(location.search), aba = qs.get('aba'), abrir = qs.get('abrir');
      // RECENTES NA NUVEM do menu (04/11/2026): ?nuvem=<id> abre direto aquela animação da nuvem (o mesmo que clicar no cartão dela aqui)
      const nv = qs.get('nuvem');
      if (nv && /^[A-Za-z0-9_-]{2,40}$/.test(nv)) { history.replaceState(null, '', location.pathname); Home.atual = 'animacoes'; Home.pinta();
        const local = await DB.get('projetos', nv).catch(() => null); NuvemTela.inicio(local?.nome || ''); let ok = false; // logo -> "Carregando da nuvem" com a % (some no fim ou no erro)
        try { await NuvemAnim.abrir(nv, local || null, { tela: true }); ok = true; } catch (e) { console.warn('abrir da nuvem', e); } finally { NuvemTela.fim(ok); }
        // aberto pelo PUBLICAÇÕES num quadro para gerar o vídeo ali (&exportar=publicacoes&item=<id do não publicado>, 10/11/2026)
        const itPub = qs.get('item'); if (qs.get('exportar') === 'publicacoes' && /^[A-Za-z0-9_-]{6,20}$/.test(itPub || '')) Exportar.paraPublicacoes(itPub, ok); }
      else {
      if (['animacoes', 'ideias', 'personagens', 'preparativos'].includes(aba)) Home.atual = aba;
      if (aba || abrir) history.replaceState(null, '', location.pathname);
      Home.pinta(); if (abrir === 'cenarios') try { CenLib.abrir({ escolher: { contexto: 'menu' } }); } catch { } // sem animação aberta: a biblioteca abre no modo de olhar/escolher
      await Citacao.receber(); } } } // aberto por uma citação das Mensagens: abre o arquivo no ponto citado
  // personagem salvo em outra aba (o Ateliê): a animação aberta aqui pega a versão nova
  try { new BroadcastChannel('animador').onmessage = async ev => {
    const d = ev.data;
    if (d?.tipo === 'apagou-local' && d.id) { // apagado na tela inicial de outra aba: esta aba para de guardar o rascunho dele (senão ele "voltava")
      if (Atelie.def?.id === d.id) { Atelie._apagado = d.id; clearTimeout(Atelie._tr); clearTimeout(Atelie._tn); await UI.modal({ title: 'Este personagem foi apagado', icon: 'trash', width: 420, body: `<div><b>${esc(Atelie.def.nome || 'Ele')}</b> foi apagado deste computador em outra aba. Esta aba volta para a tela inicial.</div>`, buttons: [{ label: 'Entendi', kind: 'primary', value: true }] }); location.replace(location.pathname); }
      else if (!Atelie.def && typeof Home !== 'undefined') Home.pinta();
      return; }
    if (d?.tipo === 'pose-pronta' && d.def && App.P?.id === d.projeto && App.P.personagens?.[d.def.id]) { // "Abrir no Ateliê como pose nova": o quadro passa a usar
      App.P.personagens[d.def.id] = d.def; await Arq.garantir(Modelo.chavesImgs(d.def)); const r = Modelo.achar(App.P, d.no), n = r?.no;
      if (n) { const k = Modelo.chave(n, d.quadro); if (d.vista) k.vista = d.vista; if (d.preset) k.sessoes = { ...(k.sessoes || {}), [d.sessao]: d.preset }; if (d.tiraEspelho) Modelo.poeTransf(n, d.quadro, { sx: Math.abs(Modelo.transf(n, d.quadro).sx || 1) }); if (d.tiraAjustes?.length) { k.partes = { ...(k.partes || {}) }; for (const pid of d.tiraAjustes) k.partes[pid] = null; } }
      App.commit('Pose nova do Ateliê', { livre: true }); UI.toast(`O quadro ${d.quadro + 1} agora usa a ${d.vista ? 'vista' : 'pose'} nova de <b>${esc(d.def.nome)}</b>.`, { kind: 'ok' }); return; }
    if (d?.tipo === 'quadro-partes' && App.P?.id === d.projeto) { // o que foi mudado SÓ NESTE KEYFRAME no Ateliê (apagado, profundidade): vai para a chave do quadro
      const n = Modelo.achar(App.P, d.no)?.no; if (!n) return; const def = App.P.personagens?.[d.personagem];
      if (d.apKey) { if (def) def.apKeys = [...new Set([...(def.apKeys || []), d.apKey])]; await Arq.garantir([d.apKey]); }
      const qs = Modelo.quadrosChave(n), prox = qs.find(q => q > d.quadro), antes = prox != null ? Modelo.estadoPersonagem(n, prox).partes : null, k = Modelo.chave(n, d.quadro); k.partes = { ...(k.partes || {}) };
      for (const [pid, v] of Object.entries(d.partes || {})) { const e = { ...(k.partes[pid] || {}) }; if (v.ap) e.ap = { ...(e.ap || {}), ...v.ap }; if ('z' in v) e.z = v.z; k.partes[pid] = e;
        // só neste keyframe: na próxima chave volta a ser como era
        if (prox != null) { const k2 = n.chaves[prox]; k2.partes = { ...(k2.partes || {}) }; const e2 = { ...(k2.partes[pid] || {}) };
          if (v.ap && e2.ap === undefined) e2.ap = antes?.[pid]?.ap ?? null; if ('z' in v && e2.z === undefined) e2.z = antes?.[pid]?.z ?? null; k2.partes[pid] = e2; } }
      App.commit('Mudança só neste keyframe (Ateliê)', { livre: true }); return; }
    if (d?.tipo === 'personagem-anim' && d.def && App.P?.id === d.projeto) { // a cópia DESTA animação foi mudada no Ateliê (outra aba): vale só aqui
      App.P.personagens[d.def.id] = d.def; await Arq.garantir(Modelo.chavesImgs(d.def)); App.commit('Personagem desta animação (Ateliê)', { livre: true }); return; }
    if (d?.tipo !== 'personagem' || !d.def) return;
    const velhoP = App.P?.personagens?.[d.def.id];
    if (velhoP && !velhoP.soProjeto && (velhoP.modificado || 0) < AtualizaProj.REFORMA_RIVE && (d.def.modificado || 0) >= AtualizaProj.REFORMA_RIVE) { AtualizaProj.confere(true); UI.toast(`<b>${esc(d.def.nome)}</b> foi salvo no Ateliê novo. Esta animação continua com a versão de antes (LEGACY): use "Atualizar personagens", no topo, se quiser trocar.`, { time: 7000 }); } // reforma Rive: projeto antigo não muda sozinho
    else if (App.P?.personagens?.[d.def.id]?.soProjeto) { UI.toast(`<b>${esc(d.def.nome)}</b> foi salvo no Ateliê geral, mas este projeto tem mudanças só dele nesse personagem: ficou como estava (use "Atualizar projeto" se quiser trocar).`, { kind: 'warn', time: 7000 }); }
    else if (App.P?.personagens?.[d.def.id]) { App.P.personagens[d.def.id] = AtelieAnim.junta(App.P.personagens[d.def.id], d.def); /* imagens feitas só para um quadro continuam */ await Arq.garantir(Modelo.chavesImgs(d.def)); App.commit('Personagem atualizado', { livre: true }); UI.toast(`<b>${esc(d.def.nome)}</b> atualizado nesta animação.`, { kind: 'ok' }); }
    else if (!App.P && Home.atual === 'personagens' && !Atelie.emAba) Home.pinta();
  }; } catch { }
  // círculo de espaço (padrão de todos os projetos): as animações deste computador, com "Baixar .animador"
  window.EstudioConta?.espaco.registrar({ programa: 'Animador', async listar() {
    if (App.P) await App.salvarJa();
    const ps = await DB.all('projetos');
    return ps.sort((a, b) => b.modificado - a.modificado).map(p => ({ nome: p.nome, bytes: JSON.stringify(p).length, data: p.modificado, thumb: p.thumb, info: `${p.duracao} quadros`, rotuloBaixar: 'Baixar .animador', baixar: () => Toon.baixar(p), apagar: async () => { await DB.del('projetos', p.id); Home.pinta(); }, })).concat((await Atelie.rascunhos()).map(r => ({ nome: r.def.nome + ' (rascunho do Ateliê)', bytes: JSON.stringify(r.def).length, data: r.em, thumb: r.thumb, info: 'só neste computador', rotuloBaixar: 'Baixar .atelieanimador', baixar: () => AtelieArq.baixar(r.def), apagar: async () => { await Atelie.apagarRascunho(r.def.id); Home.pinta(); } })));
  } });
});
