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
  atual: 'animacoes', q: '',
  aba(a) { this.atual = a; this.pinta(); },
  async pinta() {
    const el = $('#home-in'); if (!el) return;
    el.innerHTML = `<div class="home-abas"><div class="home-grupo" title="ANIMADOR"><span class="home-gic" data-estudio-icone="an"></span><button data-a="animacoes" class="${this.atual === 'animacoes' ? 'on' : ''}">${ic('film', 14)}Animações</button><button data-a="ideias" class="${this.atual === 'ideias' ? 'on' : ''}">${ic('bulb', 14)}Ideias</button></div><div class="home-grupo" title="ATELIÊ"><span class="home-gic" data-estudio-icone="at"></span><button data-a="personagens" class="${this.atual === 'personagens' ? 'on' : ''}">${ic('users', 14)}Personagens da equipe</button></div></div><div data-corpo></div>`;
    $$('[data-a]', el).forEach(b => b.onclick = () => this.aba(b.dataset.a));
    const c = $('[data-corpo]', el); this.atual === 'animacoes' ? this.animacoes(c) : this.atual === 'ideias' ? Ideias.pinta(c) : this.personagens(c);
  },
  async animacoes(c) {
    c.innerHTML = `<div class="novos">${FORMATOS.map(f => { const k = 34 / Math.max(f.w, f.h); return `<button class="novo" data-f="${f.id}"><span class="fm"><i style="width:${f.w * k}px;height:${f.h * k}px"></i></span><span><b>${f.nome}</b><small>${f.w}×${f.h} · ${f.fps} fps</small></span></button>`; }).join('')}
      <button class="novo" data-pers><span class="fm">${ic('gear', 24)}</span><span><b>Personalizado</b><small>do seu jeito ou com a IA</small></span></button>
      <button class="novo" data-abrir><span class="fm">${ic('folder', 24)}</span><span><b>Abrir .animador</b><small>arquivo de animação</small></span></button></div>
      <div class="pers-abas an-abas"><div class="seg-pers"><button data-sa="nuvem" data-s="nuvem">${ic('cloud', 14)} Na nuvem da equipe <small data-cn>…</small></button><button data-sa="local" data-s="local">${ic('save', 14)} Só neste computador <small data-cl>…</small></button></div>
        <span class="sp"></span><button class="btn sm" data-atual-a title="Atualizar a lista (busca de novo na nuvem da equipe)">${ic('loop', 13)} Atualizar</button><button class="btn sm" data-pnova-a title="Pasta nova nesta aba">${ic('folder', 13)} Pasta nova</button><input type="search" placeholder="Buscar" value="${esc(this.q)}"></div><div data-g></div>`;
    $$('[data-f]', c).forEach(b => b.onclick = () => this.nova(FORMATOS.find(f => f.id === b.dataset.f)));
    $('[data-pers]', c).onclick = () => this.personalizada();
    $('[data-abrir]', c).onclick = async () => { const [f] = await pickFiles('.animador,.toon', false); if (f) this.importar(f); };
    const busca = $('input[type=search]', c); busca.oninput = () => { this.q = busca.value; this.grade(c); };
    if (!this.subAnim) { try { this.subAnim = localStorage.getItem('animador-anim-aba') || 'nuvem'; } catch { this.subAnim = 'nuvem'; } }
    const pintaAba = () => $$('[data-sa]', c).forEach(b => b.classList.toggle('on', b.dataset.sa === this.subAnim));
    $$('[data-sa]', c).forEach(b => b.onclick = () => { this.subAnim = b.dataset.sa; try { localStorage.setItem('animador-anim-aba', this.subAnim); } catch { } pintaAba(); this.grade(c); }); pintaAba();
    $('[data-pnova-a]', c).onclick = async () => { try { if (await PastasBib.nova(this.subAnim === 'nuvem' ? 'animn' : 'anim')) this.grade(c); } catch (e) { UI.toast(esc(e.message), { kind: 'err' }); } };
    $('[data-atual-a]', c).onclick = async e => { const b = e.currentTarget; b.disabled = true; try { await NuvemAnim.lista(true).catch(() => { }); await this.grade(c); UI.toast('Lista atualizada.', { kind: 'ok', time: 1800 }); } finally { b.disabled = false; } };
    this.grade(c);
    // AO VIVO AGORA: animações abertas para trabalhar junto
    // AO VIVO: quem está mexendo aparece NO CARTÃO da animação (fotos + "ao vivo"). Só as salas antigas do "Trabalhar junto"
    // (cópia temporária, sem cartão) ficam numa faixa própria, embaixo de tudo e só na aba da nuvem
    this._offLista?.(); const av = h('<section class="aovivo-agora" hidden><div class="sec">' + ic('users', 14) + ' Salas ao vivo <small class="sec-sub">cópias abertas pelo "Trabalhar junto"</small></div><div class="av-salas"></div></section>'); $('[data-g]', c).after(av);
    this._offLista = AoVivo.ouvirLista(L => { if (!av.isConnected) return this._offLista?.(); this._salas = L; this.pintaAoVivo(c, av); });
  },
  // fotos de quem está em cada sala (nos cartões) e a faixa das salas sem cartão
  async pintaAoVivo(c, av) {
    const L = this._salas || [], g = $('.av-salas', av); let t = null; try { t = await AoVivo.transporte(); } catch { }
    const soltas = [], vivos = new Set(); for (const s of L) { const id = s.sala.slice(3), card = $(`.pc[data-anid="${CSS.escape(id)}"]`, c);
      let gente = []; try { gente = Object.values((await t?.genteDe?.(s.sala)) || {}).filter(Boolean); } catch { }
      if (gente.length) vivos.add(id);
      if (card) { $('.an-vivo', card)?.remove(); card.classList.toggle('an-ao-vivo', !!gente.length); if (gente.length) card.appendChild(h(`<span class="an-vivo" title="Ao vivo agora: ${esc(gente.map(x => x.nome || 'Alguém').join(', '))}"><i></i>ao vivo ${AoVivo.fotinhas(gente, 3)}</span>`)); }
      else if (!s.auto && gente.length) soltas.push([s, gente]); }
    g.innerHTML = ''; for (const [s, gente] of soltas) { const b = h(`<button class="av-sala"><b>${esc(s.nome || 'Animação')}</b><small>aberta por ${esc(s.por || 'alguém')}</small><span class="av-fotos">${AoVivo.fotinhas(gente, 4)}</span><span class="btn sm">Entrar</span></button>`); b.onclick = () => this.entrarJunto(s); g.appendChild(b); }
    av.hidden = !soltas.length || this.subAnim === 'local';
    // quem está ao vivo vai para o TOPO da lista (e da pasta dele): mudou quem está = monta a grade de novo
    const ant = [...(this._vivos || [])].sort().join(), ag = [...vivos].sort().join(); this._vivos = vivos; if (ant !== ag && c.isConnected) this.grade(c);
  },
  async entrarJunto(s) {
    const fim = Ocupado.inicio({ tipo: 'junto', titulo: `Entrando em "${s.nome || 'Animação'}"`, subtitulo: 'Baixando a animação e os arquivos…' }); let r;
    try { r = await AoVivo.baixarSala(s.sala); } catch (e) { fim(); return UI.toast('Não deu para entrar: ' + esc(e.message), { kind: 'err' }); }
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
    const cN = $('[data-cn]', c), cL = $('[data-cl]', c); if (cN) cN.textContent = todosT.filter(naN).length; if (cL) cL.textContent = todosT.filter(p => !naN(p)).length;
    const naNuvemAba = this.subAnim !== 'local', escP = naNuvemAba ? 'animn' : 'anim';
    const todos = todosT.filter(p => naN(p) === naNuvemAba).sort((a, b) => (this._vivos?.has(b.id) ? 1 : 0) - (this._vivos?.has(a.id) ? 1 : 0) || b.modificado - a.modificado), q = this.q.trim().toLowerCase(), L = todos.filter(p => !q || p.nome.toLowerCase().includes(q));
    // em PASTAS (só neste computador, arquivos["pastas-anim"]; js/pastasbib.js): abrir/fechar, arrastar entre pastas, criar/renomear/apagar.
    // Buscando: tudo junto numa grade só (sem pastas)
    if (!L.length) { g.innerHTML = `<div class="vazio">${todos.length ? 'Nada com esse nome.' : naNuvemAba ? 'Nenhuma animação na nuvem da equipe ainda. As animações novas vão para cá sozinhas.' : 'Nenhuma animação só neste computador.'}</div>`; return; }
    let todasP = [];
    const cartao = p => {
      if (p._nuvem) return this.cartaoNuvem(p, c, () => q ? null : todasP);
      const card = h(`<div class="pc"><div class="th" style="${p.thumb ? `background-image:url('${p.thumb}')` : ''}">${p.thumb ? '' : ic('film', 26)}</div><div class="in"><b>${esc(p.nome)}</b><small>${fmtDate(p.modificado)} · ${p.duracao} quadros · ${p.w}×${p.h}</small></div><button class="ibtn mn" title="Opções">${ic('dots', 15)}</button><span class="tam" hidden></span>${p.anterior ? '<span class="anterior" title="A versão de ANTES do trabalho em conjunto. Vira um arquivo comum quando você mudar algo nela.">anterior</span>' : ''}</div>`);
      card.dataset.anid = p.id; Arquivos.poe($('.tam', card), Arquivos.tamProjeto(p));
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
    if (q) { g.innerHTML = ''; const gr = h('<div class="grade"></div>'); for (const p of L) gr.appendChild(cartao(p)); g.appendChild(gr); const av = $('.aovivo-agora', c); if (av && this._salas) this.pintaAoVivo(c, av); return; }
    try { ({ todas: todasP } = await PastasBib.monta(g, { esc: escP, min: 220, itens: L, cartao, aoMudar: () => this.grade(c) })); }
    catch { g.innerHTML = ''; const gr = h('<div class="grade"></div>'); for (const p of L) gr.appendChild(cartao(p)); g.appendChild(gr); }
    const av = $('.aovivo-agora', c); if (av && this._salas) this.pintaAoVivo(c, av);
  },
  // cartão de uma animação que só está na NUVEM DA EQUIPE (este computador ainda não tem): abrir baixa e entra no ao vivo
  cartaoNuvem(p, c, todas) {
    const x = p._nuvem, card = h(`<div class="pc an-so-nuvem"><div class="th">${ic('film', 26)}<span class="an-nv" title="Na nuvem da equipe">${ic('cloud', 12)}</span></div><div class="in"><b>${esc(p.nome)}</b><small>${p.modificado ? fmtDate(p.modificado) + ' · ' : ''}na nuvem da equipe</small></div><button class="ibtn mn" title="Opções">${ic('dots', 15)}</button><span class="tam" hidden></span></div>`);
    card.dataset.anid = x.id; if (x.tam) { const t = $('.tam', card); t.hidden = false; t.textContent = Arquivos.fmt ? Arquivos.fmt(x.tam) : Math.round(x.tam / 1048576 * 10) / 10 + ' MB'; }
    (async () => { try { const r = await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(NuvemAnim.pasta(x.id) + 'thumb.jpg')); const u = URL.createObjectURL(await r.blob()); const th = $('.th', card); th.style.backgroundImage = `url('${u}')`; th.firstChild?.remove?.(); } catch { } })();
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
  /* ---------- tela personalizada: tamanho, quadros por segundo, duração e fundo (à mão ou pedindo à IA) ---------- */
  TAMANHOS: [['1920×1080 (YouTube)', 1920, 1080], ['1080×1920 (Shorts/TikTok)', 1080, 1920], ['1080×1080 (quadrado)', 1080, 1080], ['1080×1350 (Instagram 4:5)', 1080, 1350], ['2560×1440 (2K)', 2560, 1440], ['3840×2160 (4K)', 3840, 2160], ['1280×720 (HD)', 1280, 720], ['2048×858 (cinema 2.39)', 2048, 858]],
  SIS_TELA: `Você configura uma animação 2D nova a partir do pedido em português. Responda SÓ um JSON:
{"nome":"nome curto","w":1920,"h":1080,"fps":24,"segundos":4,"fundo":{"modo":"quadriculado|cor","cor":"#rrggbb","forca":0.35},"folha":"#rrggbb","semFolha":false,"explica":"uma frase"}
Regras: w e h entre 64 e 4096 (pares); fps entre 1 e 60 (desenho animado costuma usar 12 ou 24); segundos entre 1 e 600. "folha" é a cor da folha do tamanho da câmera (Fundo padrão); semFolha=true se a pessoa não quiser folha. Se o pedido não falar de algo, use o comum (1920×1080, 24 fps, 4 s, fundo quadriculado #cfcfcf, folha #ffffff).`,
  async personalizada() {
    const o = { nome: 'Animação ' + new Date().toLocaleDateString('pt-BR'), w: 1920, h: 1080, fps: 24, segundos: 4, palco: { modo: 'quadriculado', cor: '#cfcfcf', forca: .35 }, folha: '#ffffff', semFolha: false };
    const body = h(`<div class="tela-p"><div data-pag="ajustes"></div>
      <div class="tela-ia"><label class="field">${ic('sparkles', 13)} Mais com a IA <small style="color:var(--tx3)">(opcional · vale junto com os ajustes ao criar)</small><textarea rows="3" placeholder="Ex.: deixa em 12 fps com cara de desenho antigo, fundo escuro, uma vinheta leve e um título &quot;Episódio 1&quot; no começo"></textarea></label><div class="ia-res" hidden></div></div></div>`);
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
    let pedido = '';
    const ok = await UI.modal({ title: 'Tela personalizada', icon: 'gear', width: 580, body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Criar', kind: 'primary', onClick: async api => {
      pedido = $('textarea', body).value.trim(); if (!pedido) return true;
      // 1) a IA ajusta a tela em cima do que a pessoa escolheu (só muda o que o pedido falar)
      const res = $('.ia-res', body), bt = api.foot.querySelector('.btn.primary'); bt.disabled = true; res.hidden = false; res.textContent = 'A IA está ajustando a tela…';
      try {
        const j = IA.json(await IA.chama(this.SIS_TELA + '\nVocê recebe o que a pessoa já escolheu (ATUAL): mantenha tudo igual e só mude o que o PEDIDO falar.', `ATUAL: ${JSON.stringify(o)}\nPEDIDO: ${pedido}`)), par = v => Math.round(clamp(+v || 0, 64, 4096) / 2) * 2;
        if (j.nome) o.nome = String(j.nome).slice(0, 60); if (j.w) o.w = par(j.w); if (j.h) o.h = par(j.h); if (j.fps) o.fps = clamp(Math.round(+j.fps), 1, 60); if (j.segundos) o.segundos = clamp(+j.segundos, 1, 600);
        if (j.fundo) o.palco = { modo: j.fundo.modo === 'cor' ? 'cor' : 'quadriculado', cor: /^#[0-9a-f]{6}$/i.test(j.fundo.cor || '') ? j.fundo.cor : o.palco.cor, forca: Number.isFinite(+j.fundo.forca) ? clamp(+j.fundo.forca, 0, 1) : o.palco.forca };
        if (/^#[0-9a-f]{6}$/i.test(j.folha || '')) o.folha = j.folha; if (typeof j.semFolha === 'boolean') o.semFolha = j.semFolha;
      } catch (e) { res.textContent = 'A IA não respondeu (' + e.message + '). Crio com os ajustes, e o resto você pede depois no botão IA.'; await new Promise(r => setTimeout(r, 1800)); pedido = ''; }
      return true;
    } }] });
    if (!ok) return;
    await this.nova({ w: o.w, h: o.h, fps: o.fps }, { nome: o.nome, duracao: Math.max(1, Math.round(o.segundos * o.fps)), palco: o.palco, folha: o.folha, semFolha: o.semFolha });
    // 2) o resto do pedido (efeitos, cenário, textos…) a IA faz já dentro da animação nova
    if (pedido && App.P) { const t = UI.toast('<span class="spin-dot"></span> <span data-p>A IA está personalizando a animação…</span>', { time: 600000 });
      try { const r = await IA.executar(pedido, null, txt => { const e = t.querySelector('[data-p]'); if (e) e.textContent = 'A IA está personalizando… ' + txt.slice(-80); }, { conferir: false }); t.remove(); UI.toast(esc(r).replace(/\n+/g, '<br>'), { kind: 'ok', time: 8000 }); }
      catch (e) { t.remove(); UI.toast('A IA não terminou: ' + esc(e.message), { kind: 'err' }); } }
  },
  async apagar(p) { if (!(await UI.confirm({ title: 'Apagar a animação?', msg: `"<b>${esc(p.nome)}</b>" sai deste computador. Baixe o .animador antes se quiser guardar.`, ok: 'Apagar', danger: true }))) return; await DB.del('projetos', p.id); this.pinta(); EstudioConta?.espaco?.atualizar?.(); },
  async nova(f, o = {}) { const P = Modelo.novoProjeto({ w: f.w, h: f.h, fps: f.fps, duracao: o.duracao || f.fps * 4, nome: o.nome || 'Animação ' + new Date().toLocaleDateString('pt-BR'), fundo: o.folha }); P.nome = await Arquivos.nomeAnimacao(P.nome, P.id);
    if (o.palco) P.palco = o.palco; if (o.semFolha) P.raiz = P.raiz.filter(n => !n.fundoPadrao); P.temFundoPadrao = true; try { P.autor = { ...(await Autores.eu()), em: Date.now() }; } catch { } await DB.put('projetos', P); App.abrir(P); },
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
    c.innerHTML = `<div class="novos"><button class="novo" data-novo><span class="fm">${ic('plus', 24)}</span><span><b>Personagem novo</b><small>montar pelas partes</small></span></button>
      <button class="novo" data-backup><span class="fm">${ic('folder', 24)}</span><span><b>Abrir .atelieanimador</b><small>backup de um personagem</small></span></button></div>
      <div class="pers-abas"><div class="seg-pers"><button data-s="nuvem">${ic('cloud', 14)} Na nuvem da equipe <small data-cn>…</small></button><button data-s="local">${ic('save', 14)} Só neste computador <small data-cl>0</small></button><button data-s="anims" title="A cópia de cada personagem dentro de cada animação (a da timeline)">${ic('film', 14)} Nas animações <small data-ca>…</small></button></div>
        <span class="sp"></span><input type="search" data-busca placeholder="Buscar personagem" value="${esc(this.qp || '')}"></div>
      <div data-anims hidden></div>
      <div data-local hidden><section class="bloco-sec local"><div class="vazio">Nenhum personagem só neste computador: tudo já está na nuvem da equipe.</div></section></div>
      <section class="bloco-sec" data-nuvem><div class="sec">${ic('cloud', 14)} Na nuvem da equipe <small class="sec-sub">a equipe toda vê e usa</small><span class="sp"></span><button class="btn sm" data-pnova-n title="Pasta nova na nuvem da equipe (todos veem)">${ic('folder', 13)} Pasta nova</button><button class="btn sm" data-atu>${ic('redo', 13)} Atualizar</button></div><div data-res-aviso></div><div data-l><div class="vazio"><span class="spin-dot"></span> Carregando…</div></div></section>`;
    Nuvem.avisoReserva($('[data-res-aviso]', c));
    $('[data-novo]', c).onclick = () => Atelie.abrirAba(null); $('[data-backup]', c).onclick = () => AtelieArq.escolher(); $('[data-atu]', c).onclick = () => { Nuvem.lista(true).catch(() => { }); this.pinta(); };
    const l = $('[data-l]', c);
    // as duas listas ficam em abas separadas (com quantos tem em cada): muitos personagens numa não empurram a outra
    const sub = s => { this.subPers = s; try { localStorage.setItem('animador-pers-aba', s); } catch { } $$('[data-s]', c).forEach(b => b.classList.toggle('on', b.dataset.s === s)); $('[data-nuvem]', c).hidden = s !== 'nuvem'; $('[data-local]', c).hidden = s !== 'local'; $('[data-anims]', c).hidden = s !== 'anims'; };
    if (!this.subPers) { try { this.subPers = localStorage.getItem('animador-pers-aba') || 'nuvem'; } catch { this.subPers = 'nuvem'; } }
    $$('[data-s]', c).forEach(b => b.onclick = () => sub(b.dataset.s)); sub(this.subPers);
    const filtra = () => { const q = (this.qp || '').trim().toLowerCase(); $$('.pc', c).forEach(card => { const n = $('.in b', card)?.textContent.toLowerCase() || ''; card.hidden = !!q && !n.includes(q); });
      $$('.grade', c).forEach(g => { const t = g.previousElementSibling; if (t?.classList.contains('pasta-t')) t.hidden = g.children.length && [...g.children].every(x => x.hidden); }); };
    $('[data-busca]', c).oninput = ev => { this.qp = ev.target.value; filtra(); };
    // rascunhos: mudanças guardadas só neste computador (ainda não foram para a nuvem)
    // rascunhos: mudanças guardadas só neste computador (ainda não foram para a nuvem), em PASTAS (js/pastasbib.js)
    const pintaLocal = () => Atelie.rascunhos().then(async rs => { const box = $('[data-local]', c); $('[data-cl]', c).textContent = rs.length;
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
      ({ todas } = await PastasBib.monta($('[data-pb]', sec), { esc: 'local', itens, cartao, aoMudar: pintaLocal }));
      $('[data-pnova]', sec).onclick = async () => { if (await PastasBib.nova('local')) pintaLocal(); };
      $('[data-apaga-todos]', sec).onclick = async () => { if (!(await UI.confirm({ title: `Apagar os ${rs.length} personagens só deste computador?`, msg: 'Somem os personagens locais e as mudanças que ainda não foram para a nuvem. Os que estão na nuvem continuam lá. <b>Não dá para desfazer.</b>', ok: 'Apagar todos', danger: true }))) return;
        for (const r of rs) await Atelie.apagarRascunho(r.def.id, true); UI.toast(`${rs.length} apagado(s) deste computador.`, { kind: 'ok' }); this.pinta(); };
      box.innerHTML = ''; box.appendChild(sec); filtra(); });
    pintaLocal();
    AtelieAnim.pintaLista($('[data-anims]', c), () => filtra()).then(n => { const e = $('[data-ca]', c); if (e) e.textContent = n; });
    try {
      const lista = await Nuvem.lista(); $('[data-cn]', c).textContent = lista.length;
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
      const pintaNuvem = async () => { try { ({ todas: todasN } = await PastasBib.monta(l, { esc: 'nuvem', itens: lista, cartao: cartaoN, aoMudar: pintaNuvem })); if (Nuvem.parcial && Nuvem.copiasPc?.length) this.copiasLocais(l, Nuvem.copiasPc, true); filtra(); } catch (e) { UI.toast(esc(e.message), { kind: 'err' }); } };
      await pintaNuvem(); $('[data-pnova-n]', c).onclick = async () => { try { if (await PastasBib.nova('nuvem')) pintaNuvem(); } catch (e) { UI.toast(esc(e.message), { kind: 'err' }); } };
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
  if (at && daAnim) { Atelie.emAba = true; if (!(await AtelieAnim.entrar(at, daAnim))) { history.replaceState(null, '', location.pathname); Atelie.emAba = false; Home.pinta(); } } // a CÓPIA de uma animação (o que está na timeline)
  else if (at) { Atelie.emAba = true; await Atelie.abrir(at === 'novo' ? null : at, naPose ? { reserva: await Animacoes.reservaDaPose(at) } : {}); if (naPose && Atelie.def) await Animacoes.entrarNaPose(at); if (!Atelie.def) { if (at === 'novo') window.close(); history.replaceState(null, '', location.pathname); Atelie.emAba = false; Home.pinta(); } }
    if (at && Atelie.def) { const rc = await Citacao.receber(); if (rc?.parte) Citacao.irAtelie(rc.parte); }
  else { // F5 / "Atualizar todos os sites" com uma animação aberta (?projeto=<id>): volta direto para ela
    const pid = new URLSearchParams(location.search).get('projeto'), P = pid ? await DB.get('projetos', pid).catch(() => null) : null;
    if (P) { await App.abrir(P); await Citacao.receber(); }
    else { if (pid) history.replaceState(null, '', location.pathname); Home.pinta(); await Citacao.receber(); } } // aberto por uma citação das Mensagens: abre o arquivo no ponto citado
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
    if (App.P?.personagens?.[d.def.id]) { App.P.personagens[d.def.id] = AtelieAnim.junta(App.P.personagens[d.def.id], d.def); /* imagens feitas só para um quadro continuam */ await Arq.garantir(Modelo.chavesImgs(d.def)); App.commit('Personagem atualizado', { livre: true }); UI.toast(`<b>${esc(d.def.nome)}</b> atualizado nesta animação.`, { kind: 'ok' }); }
    else if (!App.P && Home.atual === 'personagens' && !Atelie.emAba) Home.pinta();
  }; } catch { }
  // círculo de espaço (padrão de todos os projetos): as animações deste computador, com "Baixar .animador"
  window.EstudioConta?.espaco.registrar({ programa: 'Animador', async listar() {
    if (App.P) await App.salvarJa();
    const ps = await DB.all('projetos');
    return ps.sort((a, b) => b.modificado - a.modificado).map(p => ({ nome: p.nome, bytes: JSON.stringify(p).length, data: p.modificado, thumb: p.thumb, info: `${p.duracao} quadros`, rotuloBaixar: 'Baixar .animador', baixar: () => Toon.baixar(p), apagar: async () => { await DB.del('projetos', p.id); Home.pinta(); }, })).concat((await Atelie.rascunhos()).map(r => ({ nome: r.def.nome + ' (rascunho do Ateliê)', bytes: JSON.stringify(r.def).length, data: r.em, thumb: r.thumb, info: 'só neste computador', rotuloBaixar: 'Baixar .atelieanimador', baixar: () => AtelieArq.baixar(r.def), apagar: async () => { await Atelie.apagarRascunho(r.def.id); Home.pinta(); } })));
  } });
});
