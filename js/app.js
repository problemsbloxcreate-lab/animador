/* ===================== app.js — o editor de animação: estado, desfazer, salvar, palco (canvas infinito + câmera) e atalhos ===================== */
'use strict';
const App = {
  P: null, q: 0, sel: null, tocando: false, onion: false, esqueleto: (() => { try { return !!localStorage.getItem('animador-esqueleto'); } catch { return false; } })(), ferr: 'mover', modoVista: 'mundo', vista: { x: 0, y: 0, z: .4 },
  desfazer: [], refazer: [], ultimo: null, salvoEm: 0,

  /* ---------- abrir / fechar ---------- */
  async abrir(P) {
    if (AoVivo.ad?.ctx === 'animador' && AoVivo.ad.sala !== 'an-' + P.id) await AoVivo.sair();
    if (!P.temFundoPadrao) { P.temFundoPadrao = true; if (!Modelo.todos(P).some(n => n.fundoPadrao)) P.raiz.push(Modelo.fundoPadrao(P.w, P.h, P.fundo)); } // projetos de antes: a folha vira camada
    this.P = P; this.q = 0; this.sel = null; this.desfazer = []; this.refazer = []; this.ultimo = JSON.stringify(P);
    // o endereço guarda a animação aberta (?projeto=<id>): F5 / "Atualizar todos os sites" volta para ela no ANIMADOR
    try { const u = new URL(location.href); if (!u.searchParams.has('atelie') && !u.searchParams.has('embed') && u.searchParams.get('projeto') !== P.id) { u.searchParams.set('projeto', P.id); history.replaceState(null, '', u.pathname + u.search + u.hash); } } catch { }
    Promise.all(Object.values(P.personagens || {}).map(def => Arq.garantir(Modelo.chavesImgs(def)))).then(() => Icone.garanteNoEditor(P)); // personagens sem ícone/cor ganham (a cabeça e a cor que mais aparece)
    Telas.mostra('editor'); $('#proj-nome').textContent = P.nome; this.titulo();
    PaineisEd.liga(); // painéis que mudam de lugar e de tamanho (js/paineis.js)
    this.palco.liga(); this.enquadrar(); Arvore.pinta(); Folha.liga(); Lado.pinta(); Som.prepara(P);
    this.salvoTxt('Salvo neste computador'); this.pintaJunto();
    AtualizaProj.lista = []; AtualizaProj.pinta(); AtualizaProj.confere(true); // botão "Atualizar projeto" só se este projeto estiver atrás da versão atual (js/atualizar.js)
    NuvemAnim.aoAbrir(P); // vai sozinha para a nuvem da equipe e entra no ao vivo (js/nuvemanim.js)
  },
  /* ---------- botão ATELIÊ do topo: pergunta onde abrir ----------
     Simples = o Ateliê DENTRO do Animador (ao lado/janela, js/quadroed.js), arrumando só o personagem neste quadro.
     Completo = o Ateliê inteiro numa aba nova. Sem personagem escolhido, pergunta qual. */
  async abrirAtelie() {
    const P = this.P; if (!P) return; this.pausa();
    const card = (v, ic1, t, d) => `<button class="at-esc" data-v="${v}">${ic1}<span><b>${t}</b><small>${d}</small></span></button>`;
    const body = h(`<div class="at-escolha">${card('simples', ic('monitor', 22), 'No Animador <em>simples</em>', 'O Ateliê abre aqui ao lado e muda só o personagem neste quadro.')}${card('aba', '<span class="ic-ep" data-estudio-icone="at" style="width:26px;height:26px"></span>', 'Em uma nova aba <em>completo · personagem da equipe</em>', 'O Ateliê inteiro com o personagem da nuvem (ou deste computador): vale para todas as animações quando salvar.')}${card('anim', ic('film', 24), 'Em uma nova aba <em>completo · só desta animação</em>', 'O Ateliê inteiro com a cópia que está na timeline desta animação: muda todos os quadros dela, e só dela.')}</div>`);
    const modo = await UI.modal({ title: 'Abrir o Ateliê', icon: 'palette', width: 460, body, buttons: [{ label: 'Cancelar', value: null }],
      onOpen: api => $$('[data-v]', api.body).forEach(b => b.onclick = () => api.close(b.dataset.v)) });
    if (!modo) return;
    let n = this.noSel(); if (n && n.tipo !== 'personagem') n = null; // só o que está SELECIONADO; nada selecionado = pergunta qual
    if (!n) { n = await this.qualPersonagem(modo); if (n === undefined || n === null) return; }
    if (modo === 'simples') { if (n === 'novo') return; return QuadroEd.abrir(n); }
    if (modo === 'anim') { if (n === 'novo') return; return AtelieAnim.abrir(P.id, n.ref); }
    Atelie.abrirAba(n === 'novo' ? null : P.personagens[n.ref]?.id || null);
  },
  // nenhum personagem escolhido: lista os do quadro (e, embaixo, os outros da animação) para escolher; 'novo' = personagem novo (só no completo)
  async qualPersonagem(modo) {
    const P = this.P, aqui = Modelo.noQuadro(P, this.q), outros = Modelo.todos(P).filter(n => n.tipo === 'personagem' && !aqui.includes(n));
    if (!aqui.length && !outros.length && modo !== 'aba') { UI.toast('Nenhum personagem nesta animação. Ponha um personagem primeiro (botão + da Hierarquia).', { kind: 'warn' }); return null; }
    const item = n => { const def = P.personagens[n.ref]; return `<button class="at-pers" data-id="${n.id}">${Icone.html(def, 26)}<span><b>${esc(n.nome)}</b><small>${esc(def?.nome || '')}</small></span></button>`; };
    const body = h(`<div class="at-qual">${aqui.length ? `<div class="at-qt">No quadro ${this.q + 1}</div>${aqui.map(item).join('')}` : ''}
      ${outros.length ? `<div class="at-qt">${modo === 'simples' ? 'Fora deste quadro <small>(vai para o quadro onde aparece)</small>' : 'Na animação'}</div>${outros.map(item).join('')}` : ''}
      ${modo === 'aba' ? `<button class="at-pers novo" data-id="novo">${ic('plus', 18)}<span><b>Personagem novo</b><small>começar do zero</small></span></button>` : ''}</div>`);
    const id = await UI.modal({ title: modo === 'simples' ? 'Qual personagem abrir no Animador?' : 'Qual personagem abrir no Ateliê?', icon: 'layers', width: 420, body, buttons: [{ label: 'Cancelar', value: null }],
      onOpen: api => $$('[data-id]', api.body).forEach(b => b.onclick = () => api.close(b.dataset.id)) });
    if (!id) return null; if (id === 'novo') return 'novo';
    const n = Modelo.achar(P, id)?.no; if (!n) return null;
    if (modo === 'simples' && !Modelo.aparece(P, n, this.q)) this.setQ(n.de || 0); // fora do quadro: vai para onde ele aparece
    this.selecionar(n.id); return n;
  },
  async fechar() { QuadroEd.fechar?.(); this.pausa(); await this.salvarJa(); await NuvemAnim.aoFechar(); if (AoVivo.ad?.ctx === 'animador') await this.sairJunto(false, true); this.P = null; try { const u = new URL(location.href); if (u.searchParams.has('projeto')) { u.searchParams.delete('projeto'); history.replaceState(null, '', u.pathname + u.search + u.hash); } } catch { } Telas.mostra('home'); Home.pinta(); this.titulo(); },
  // TRABALHAR JUNTO: o arquivo vai TEMPORARIAMENTE para a nuvem enquanto as pessoas trabalham (js/aovivo.js)
  async trabalharJunto() {
    if (AoVivo.ativo && AoVivo.ad?.ctx === 'animador') return UI.toast('Já está ao vivo: quem é da equipe entra pela tela inicial, em "Ao vivo agora".');
    if (!AoVivo.ligado()) return UI.modal({ title: 'Trabalhar junto', icon: 'users', width: 440, body: '<div>O tempo real ainda não foi ligado no Estúdio. Quem cuida do Firebase precisa ativar o <b>Realtime Database</b> uma vez (é grátis).</div>', buttons: [{ label: 'Entendi', kind: 'primary', value: true }] });
    const ok = await UI.confirm({ title: 'Trabalhar junto nesta animação?', msg: `Uma cópia de <b>${esc(this.P.nome)}</b> fica <b>temporariamente</b> na nuvem enquanto vocês trabalham. Quem é da equipe entra pela tela inicial (<b>Ao vivo agora</b>) e cada um vê o cursor, o nome e as mudanças dos outros na hora.<br><br>Ao terminar, cada um fica com a cópia com as últimas mudanças, a nuvem é apagada, e a versão de agora fica guardada aqui como <b>(anterior)</b>.`, ok: 'Abrir para a equipe' });
    if (!ok) return; await this.salvarJa();
    const ant = JSON.parse(JSON.stringify(this.P)); ant.id = uid('p'); ant.nome = this.P.nome + ' (anterior)'; ant.anterior = { em: Date.now() }; await DB.put('projetos', ant);
    const fim = Ocupado.inicio({ tipo: 'junto', titulo: 'Abrindo para trabalhar junto', subtitulo: 'Mandando a animação e os arquivos…' }); let entrou = false;
    try { const eu = await AoVivo.quem(); entrou = await AoVivo.entrar(AoVivo.adAnimador(true), { novo: true, avisa: true, meta: { tipo: 'animador', nome: this.P.nome, por: eu.nome, w: this.P.w, h: this.P.h, fim: false } }); } finally { fim(); }
    if (!entrou) { await DB.del('projetos', ant.id).catch(() => { }); return; }
    this.pintaJunto(); UI.toast('Ao vivo! Quem é da equipe entra pela tela inicial, em <b>Ao vivo agora</b>.', { kind: 'ok', time: 7000 });
  },
  // sair (cada um fica com a sua cópia) ou encerrar para todos (quem abriu)
  async sairJunto(encerrar, quieto) {
    if (!(AoVivo.ativo && AoVivo.ad?.ctx === 'animador')) return; if (encerrar && !(await UI.confirm({ title: 'Encerrar para todos?', msg: 'Cada pessoa fica com a cópia com as últimas mudanças no computador dela, e a animação sai da nuvem.', ok: 'Encerrar' }))) return;
    await this.salvarJa(); await AoVivo.sair({ encerrar }); this.pintaJunto(); if (!quieto) UI.toast(encerrar ? 'Encerrado: a animação saiu da nuvem. A cópia com as últimas mudanças ficou salva aqui.' : 'Você saiu. A cópia com as últimas mudanças ficou salva neste computador.', { kind: 'ok', time: 7000 });
  },
  pintaJunto() { const b = $('#b-junto'); if (!b) return; const on = AoVivo.ativo && AoVivo.ad?.ctx === 'animador'; b.hidden = on; b.innerHTML = ic('users', 15); b.classList.add('so-icone'); b.title = 'Trabalhar junto ao vivo: outras pessoas da equipe entram e veem as mudanças na hora'; b.onclick = () => this.trabalharJunto(); AoVivo.pintaBarra(); },
  titulo() { document.title = (this.P ? this.P.nome + ' — ' : '') + 'ANIMADOR · Estúdio Problems'; },

  /* ---------- mudanças, desfazer, salvar ---------- */
  // chame depois de mudar o projeto (o que estava antes vai para o desfazer)
  // COR INTERNA só deste personagem na animação (n.cor): troca o branco do preenchimento; "Usar a do Ateliê" volta para def.corInterna
  async corInterna(n) {
    const def = this.P.personagens[n.ref]; if (!def) return; const antes = n.cor; let cor = (n.cor && n.cor !== 'original' ? n.cor : def.corInterna) || '#ffffff';
    const body = h(`<div><div style="color:var(--tx2);font-size:12.5px;margin-bottom:10px">Troca o <b>branco</b> de dentro de <b>${esc(n.nome || def.nome)}</b> só nesta animação (as linhas continuam iguais).${def.corInterna ? ` No Ateliê ele está com ${def.corInterna}.` : ''}</div>
      <div data-pr style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${Atelie.CORES_PRONTAS.map(c => `<button class="btn sm" data-c="${c}" title="${c}" style="width:28px;height:28px;padding:0;border-radius:50%;background:${c};border:2px solid var(--bd)"></button>`).join('')}</div>
      <div style="display:flex;gap:10px;align-items:center"><input type="color" data-in value="${cor}"><code data-hex>${cor}</code></div></div>`);
    const inp = $('[data-in]', body), hex = $('[data-hex]', body);
    const aplica = c => { cor = c.toLowerCase(); inp.value = cor; hex.textContent = cor; n.cor = /^#ffffff$/i.test(cor) ? 'original' : cor; Render.aoChegarImagem?.(); this.atualiza?.(); };
    inp.oninput = () => aplica(inp.value); $$('[data-c]', body).forEach(b => b.onclick = () => aplica(b.dataset.c));
    const v = await UI.modal({ title: 'Cor interna', icon: 'brush', width: 420, body, buttons: [{ label: 'Cancelar', value: 0 }, { label: 'Usar a do Ateliê', value: 2 }, { label: 'Aplicar', kind: 'primary', value: 1 }] });
    if (v === 2) delete n.cor; else if (v !== 1) { if (antes === undefined) delete n.cor; else n.cor = antes; }
    this.commit('Cor interna do personagem');
  },
  commit(rotulo, o = {}) {
    const agora = JSON.stringify(this.P); if (agora === this.ultimo) return this.atualiza(o);
    if (this.P.anterior) delete this.P.anterior; // mudou de verdade: deixa de ser "o anterior" (virou um arquivo comum)
    this.desfazer.push(this.ultimo); if (this.desfazer.length > 120) this.desfazer.shift(); this.refazer = []; this.ultimo = agora;
    this.P.modificado = Date.now(); this.salvarLogo(); this.atualiza(o);
  },
  undo() { if (!this.desfazer.length) return UI.toast('Nada para desfazer'); this.refazer.push(this.ultimo); this.ultimo = this.desfazer.pop(); this.troca(JSON.parse(this.ultimo)); },
  redo() { if (!this.refazer.length) return; this.desfazer.push(this.ultimo); this.ultimo = this.refazer.pop(); this.troca(JSON.parse(this.ultimo)); },
  troca(P) { const id = this.P.id; this.P = P; this.P.id = id; if (this.sel && !Modelo.achar(P, this.sel) && this.sel !== 'camera') this.sel = null; this.salvarLogo(); this.atualiza(); },
  atualiza(o = {}) { if (!o.semArvore) Arvore.pinta(); Folha.pinta(); if (!o.semLado) Lado.pinta(); this.pinta(); },
  _tSalvar: null,
  salvarLogo() { clearTimeout(this._tSalvar); this.salvoTxt('Salvando…'); this._tSalvar = setTimeout(() => this.salvarJa(), 700); },
  async salvarJa() {
    clearTimeout(this._tSalvar); if (!this.P) return;
    try { this.P.thumb = Render.miniatura(this.P, this.q); await DB.put('projetos', JSON.parse(JSON.stringify(this.P))); this.salvoTxt('Salvo neste computador'); EstudioConta?.espaco?.atualizar?.(); NuvemAnim.agenda(); return true; }
    catch (e) { this.salvoTxt('Não salvou: ' + e.message); return false; }
  },
  salvoTxt(t) { const e = $('#salvo'); if (e) e.textContent = t; },

  /* ---------- quadro atual e reprodução ---------- */
  setQ(q, o = {}) {
    q = clamp(Math.round(q), 0, Modelo.ultimoQuadro(this.P)); if (q === this.q && !o.forca) return;
    this.q = q; Folha.pinta(); if (!this.tocando) Lado.pinta(); else Lado.aoVivo(); this.pinta(); if (o.som && !this.tocando) Som.raspa(q);
  },
  tocar() {
    if (this.tocando) return this.pausa(); if (this.q >= Modelo.ultimoQuadro(this.P)) this.q = 0;
    this.tocando = true; $('#b-tocar').innerHTML = ic('pause', 15); Som.toca(this.q);
    const t0 = performance.now(), q0 = this.q, fps = this.P.fps;
    const passo = () => {
      if (!this.tocando) return;
      let q = q0 + Math.floor((performance.now() - t0) / 1000 * fps);
      if (q > Modelo.ultimoQuadro(this.P)) { if (Folha.loop) { this.pausa(); this.q = 0; return this.tocar(); } this.pausa(); q = Modelo.ultimoQuadro(this.P); }
      if (q !== this.q) { this.q = q; Folha.pinta(); this.pinta(); Lado.aoVivo(); }
      requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  },
  pausa() { if (!this.tocando) return; this.tocando = false; Som.para(); const b = $('#b-tocar'); if (b) b.innerHTML = ic('play', 15); Lado.pinta(); },

  /* ---------- seleção ---------- */
  selecionar(id, o = {}) { this.sel = id; Arvore.pinta(); Folha.pinta(); if (!o.semLado) Lado.pinta(); this.pinta(); },
  noSel() { return this.sel && this.sel !== 'camera' ? Modelo.achar(this.P, this.sel)?.no : null; },
  // matriz do pai do nó (pastas acima) no quadro atual: para mover no espaço certo
  matPai(id) { let m = new DOMMatrix(); for (const a of Modelo.ancestrais(this.P, id)) m = Render.matNo(m, Modelo.transf(a, this.q)); return m; },

  /* ---------- adicionar coisas ---------- */
  ondeColocar() { const s = this.noSel(); if (s?.tipo === 'pasta') return s.filhos; const r = s ? Modelo.achar(this.P, s.id) : null; return r ? r.lista : this.P.raiz; },
  inserir(n, rotulo, o = {}) {
    const lista = this.ondeColocar(), s = this.noSel(), i = s && lista.includes(s) ? lista.indexOf(s) : 0;
    // posição: centro da câmera, no espaço do pai
    const c = Modelo.camera(this.P, this.q), alvo = lista === this.P.raiz ? null : Modelo.todos(this.P).find(x => x.filhos === lista);
    const inv = alvo ? this.matPai(alvo.id).multiply(Render.matNo(new DOMMatrix(), Modelo.transf(alvo, this.q))).inverse() : new DOMMatrix();
    const p = inv.transformPoint(new DOMPoint(o.pos ? o.pos.x : c.x, o.pos ? o.pos.y : c.y)), esc0 = Object.values(n.chaves || {})[0]?.s ?? 1;
    n.de = this.q; n.chaves = { [this.q]: { x: Math.round(p.x), y: Math.round(p.y + (lista === this.P.raiz ? o.dy || 0 : 0)), r: 0, s: esc0, sx: 1, op: 1 } };
    lista.splice(i, 0, n); this.sel = n.id; this.commit(rotulo || 'Adicionar');
  },
  async addPersonagem() {
    const def = await Biblioteca.escolher(); if (!def) return;
    this.P.personagens[def.id] = def; await Arq.garantir(Modelo.chavesImgs(def)); Icone.garanteNoEditor(this.P);
    const b = Modelo.caixaPersonagem(def, Modelo.partesNoEstado(def, {})), s = b.h > 0 ? clamp(this.P.h * .55 / b.h, .1, 4) : 1;
    const n = Modelo.novoNo('personagem', { ref: def.id, nome: def.nome, s: round(s, 2) }); n.chaves[0].s = round(s, 2); n.atuacao = { ...Atuacao.PADRAO }; n.suaveP = true;
    this.inserir(n, 'Personagem ' + def.nome); UI.toast(`<b>${esc(def.nome)}</b> entrou no quadro ${this.q + 1}. Os botões das sessões estão no painel da direita.`, { kind: 'ok' });
  },
  async addImagem() {
    const fs = await pickFiles('image/*', true); for (const f0 of fs) {
      const { blob: f, svg } = await Vetor.blobDeArquivo(f0); // .svg continua VETOR no Animador (desenhado sem perder qualidade no zoom e no MP4)
      const id = await Arq.guardar(f); const bm = await Arq.deBlob(f, id);
      const s = bm ? Math.min(1, this.P.w * .8 / bm.width, this.P.h * .8 / bm.height) : 1;
      const n = Modelo.novoNo('imagem', { arq: id, nome: f0.name.replace(/\.[^.]+$/, '').slice(0, 40), s: round(s, 3) }); n.chaves[0].s = round(s, 3); if (svg) n.vetor = true;
      Arq.img.set(id, bm); this.inserir(n, 'Imagem');
    }
  },
  addForma(forma) {
    const P = this.P, m = Math.round(Math.min(P.w, P.h) * .3), nomes = { ret: 'Retângulo', elipse: 'Círculo', tri: 'Triângulo', estrela: 'Estrela' };
    this.inserir(Modelo.novoNo('forma', { forma, nome: nomes[forma], w: m, h: m, cor: ['#4a90e2', '#f5a623', '#7ed321', '#e94e77'][Object.keys(nomes).indexOf(forma)] }), nomes[forma]);
  },
  menuForma(x, y) { UI.ctx(x, y, [['ret', 'Retângulo', 'square'], ['elipse', 'Círculo', 'circle'], ['tri', 'Triângulo', 'shapes'], ['estrela', 'Estrela', 'star']].map(([f, l, i]) => ({ label: l, icon: i, action: () => this.addForma(f) }))); },
  addTexto() { this.inserir(Modelo.novoNo('texto', { texto: 'Texto' }), 'Texto', { dy: Math.round(this.P.h * .3) }); },
  // cenário: vai para o fundo de tudo e cobre a câmera inteira. Fica só nesta animação (salvar na nuvem é no botão direito)
  async addCenario(blob, nome, extra = {}) {
    const P = this.P, q = this.q, id = await Arq.guardar(blob), bm = await createImageBitmap(blob).catch(() => null); if (bm) Arq.img.set(id, bm);
    const c = Modelo.camera(P, q), z = c.zoom || 1, s = bm ? round(Math.max(P.w / z / bm.width, P.h / z / bm.height) * 1.02, 3) : 1;
    const n = Modelo.novoNo('imagem', { arq: id, nome: (nome || 'Cenário').slice(0, 40), s }); Object.assign(n, extra);
    n.de = q; n.chaves = { [q]: { x: Math.round(c.x), y: Math.round(c.y), r: 0, s, sx: 1, op: 1 } };
    n.cenario = true; const i = P.raiz.findIndex(x => x.cenario || x.fundoPadrao); // fica na frente dos cenários que já existem e atrás do resto
    if (i >= 0) P.raiz.splice(i, 0, n); else P.raiz.push(n); this.sel = n.id; this.commit('Cenário ' + n.nome); return n;
  },
  menuTremulo(n) { // efeito "trêmulo" na camada (ver Render.tremor)
    const poe = m => () => { if (!m) delete n.tremulo; else n.tremulo = { forca: .4, ritmo: 2, ...(n.tremulo || {}), modo: m }; this.commit(m ? 'Trêmulo' : 'Sem trêmulo'); };
    return { label: 'Trêmulo', icon: 'wave', sub: [{ label: 'Tremer', checked: n.tremulo?.modo === 'tremer', action: poe('tremer') }, { label: 'Ondular', checked: n.tremulo?.modo === 'ondular', action: poe('ondular') }, { label: 'Desligado', checked: !n.tremulo, action: poe('') }] };
  },
  /* ---------- camada de efeito: vale para o que está abaixo dela (até a próxima camada de efeito) ---------- */
  nomeEfeito(n) { if (n.nomeAuto !== false) n.nome = n.efeitos.length ? 'Efeito: ' + n.efeitos.map(e => Efeitos.nomeEf(e)).join(' + ') : 'Efeito'; },
  // o: { toda, q (quadro), alvo (camada; null = no topo), faixa: { de, ate } = o tempo de uma camada (arrastado para um clipe na timeline) }
  addEfeito(e, o = {}) {
    const P = this.P, q = o.q ?? this.q, s = o.alvo !== undefined ? o.alvo : this.noSel(), toda = o.toda ?? (Lado.toda ?? true), fx = o.faixa;
    e = { id: uid('ef'), ...e };
    let n = s?.tipo === 'efeito' ? s : null;
    if (n) { // na camada escolhida: clicar de novo no mesmo tira; cor: uma só por camada (troca)
      const igual = x => x.tipo === e.tipo && (e.tipo !== 'tremulo' || x.modo === e.modo) && (e.tipo !== 'cor' || x.visual === e.visual);
      const i = n.efeitos.findIndex(igual);
      if (i >= 0) { n.efeitos.splice(i, 1); this.nomeEfeito(n); return this.commit('Tirar ' + Efeitos.nomeEf(e)); }
      if (e.tipo === 'cor') n.efeitos = n.efeitos.filter(x => x.tipo !== 'cor');
      n.efeitos.push(e);
    } else {
      const curto = { flash: Math.round(P.fps / 3), tremor: Math.round(P.fps * .7), chicote: Math.round(P.fps * .4), zoomcorte: Math.round(P.fps * .4) }[e.tipo];
      const meio = Efeitos.TRANS.includes(e.tipo) ? Math.floor(curto / 2) : 0; // transição: o corte fica no MEIO (no quadro de agora)
      const de = Math.max(0, q - meio), ate = Math.min(P.duracao - 1, de + (curto || P.fps * 2));
      const r = s ? Modelo.achar(P, s.id) : null, lista = r ? r.lista : P.raiz, i = r ? lista.indexOf(s) : 0, abaixo = lista[i];
      if (abaixo?.tipo === 'efeito') { // logo abaixo já tem uma camada de efeito: uma nova aqui não pegaria nada, então entra nela (com o tempo dele)
        n = abaixo; if (fx && !curto) { if (fx.de > (n.de || 0) || (fx.ate != null && fx.ate < Modelo.fimNo(P, n))) { e.de = fx.de; e.ate = fx.ate ?? Modelo.fimNo(P, n); } } else if (!toda || curto) { e.de = de; e.ate = ate; } if (e.tipo === 'cor') n.efeitos = n.efeitos.filter(x => x.tipo !== 'cor'); n.efeitos.push(e);
      } else {
        n = Modelo.novoNo('efeito', { efeitos: [e] });
        if (fx && !curto) { n.de = fx.de; n.ate = fx.ate ?? null; n.chaves = { [fx.de]: n.chaves[0] }; }
        else if (!toda || curto) { n.de = de; n.ate = ate; n.chaves = { [de]: n.chaves[0] }; }
        lista.splice(i, 0, n); // logo acima da escolhida (ou no topo)
      }
    }
    this.nomeEfeito(n); this.sel = n.id; this.commit(Efeitos.nomeEf(e));
  },
  converterEfeitosAntigos() {
    const P = this.P, n = Modelo.novoNo('efeito', { efeitos: [] });
    if (P.efeitos.visual && P.efeitos.visual !== 'normal') n.efeitos.push({ id: uid('ef'), tipo: 'cor', visual: P.efeitos.visual });
    for (const e of P.efeitos.tela || []) n.efeitos.push({ id: uid('ef'), tipo: e.tipo, forca: e.forca, de: e.de, ate: e.ate });
    P.efeitos = { visual: 'normal', tela: [] }; this.nomeEfeito(n); P.raiz.unshift(n); this.sel = n.id; this.commit('Efeitos viram camada');
  },
  // a camada de efeito do topo que vale a animação toda (a IA põe as coisas dela aqui)
  efeitoTopo() { const P = this.P; let n = P.raiz[0]; if (n?.tipo === 'efeito' && !(n.de > 0) && n.ate == null) return n; n = Modelo.novoNo('efeito', { efeitos: [] }); P.raiz.unshift(n); return n; },
  /* ---------- régua e ímã: ao mover, gruda nas bordas/meio da câmera, do Fundo padrão e dos outros (desliga no botão da régua ou com R; Ctrl solta sem grudar) ---------- */
  regua() { if (this._regua == null) { try { this._regua = localStorage.getItem('animador-regua') !== '0'; } catch { this._regua = true; } } return this._regua; },
  trocaRegua() { this._regua = !this.regua(); try { localStorage.setItem('animador-regua', this._regua ? '1' : '0'); } catch { } $('#b-regua')?.classList.toggle('on', this._regua); UI.toast(this._regua ? 'Régua e ímã ligados (Ctrl segura para não grudar)' : 'Régua e ímã desligados'); this.pinta(); },
  caixaMundo(cantos) { const xs = cantos.map(p => p.x), ys = cantos.map(p => p.y); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; },
  imaInicio(n) {
    const P = this.P, q = this.q, cx = Render.caixas(P, q), eu = cx.find(c => c.no === n); if (!eu) return null;
    const meus = new Set(); Modelo.cada([n], x => meus.add(x.id));
    const alvos = cx.filter(c => !meus.has(c.no.id) && c.no.vis !== false).map(c => ({ ...this.caixaMundo(c.cantos), nome: c.no.nome }));
    const c = Modelo.camera(P, q), cw = P.w / (c.zoom || 1) / 2, ch = P.h / (c.zoom || 1) / 2;
    alvos.unshift({ x0: c.x - cw, x1: c.x + cw, y0: c.y - ch, y1: c.y + ch, cx: c.x, cy: c.y, nome: 'Câmera', cam: true });
    return { box: this.caixaMundo(eu.cantos), alvos };
  },
  gruda(ima, w0, w, travado) { const r = Regua.gruda(ima, w0, w, travado, this.vista.z); this.guias = r.guias; return r.p; },
  // desenha as guias do ímã e as réguas (em cima e à esquerda do palco)
  desenhaRegua(ctx, V, W, H, d) {
    const s = this.regua() && this.noSel(), cx = s && Render.caixas(this.P, this.q).find(c => c.no === s);
    Regua.desenha(ctx, V, W, H, d, { guias: this.guias, on: this.regua(), sel: cx ? this.caixaMundo(cx.cantos) : null });
  },
  menuCenario(x, y) {
    UI.ctx(x, y, [
      { label: 'Cenários em camadas (biblioteca)…', icon: 'layers', action: () => CenLib.abrir() },
      { label: 'Prontos e com a IA (estilo da casa)…', icon: 'paisagem', ai: true, action: () => Cenarios.abrir() },
      { label: 'Salvos na nuvem da equipe…', icon: 'cloud', action: () => CenariosNuvem.escolher() },
    ]);
  },
  async salvarNaNuvem(n) {
    if (n?.tipo !== 'imagem' && !n?.cenaEd) return;
    const t = { remove() { } }; // a tela de espera do Ocupado.nuvem mostra o andamento
    try { n.nuvem = await Ocupado.nuvem('Salvando o cenário na nuvem', () => Nuvem.salvarCenario(n), { fimTxt: 'Cenário salvo na nuvem' }); this.commit('Salvar na nuvem', { semArvore: false }); t.remove(); UI.toast(`<b>${esc(n.nome)}</b> está nos cenários da equipe: todo mundo pode usar.`, { kind: 'ok' }); }
    catch (e) { t.remove(); UI.toast('Não salvou: ' + esc(e.message), { kind: 'err' }); }
  },
  // trocar a imagem de uma camada de imagem: fica no mesmo lugar, do mesmo tamanho na tela (as chaves e a animação continuam)
  async trocarImagem(n) {
    if (n?.tipo !== 'imagem') return; const [f0] = await pickFiles('image/*', false); if (!f0) return; const { blob: f, svg } = await Vetor.blobDeArquivo(f0); if (svg) n.vetor = true; else delete n.vetor;
    const velho = Arq.img.get(n.arq), id = await Arq.guardar(f), bm = await Arq.deBlob(f, id); if (!bm) return UI.toast('Não abri essa imagem.', { kind: 'err' }); Arq.img.set(id, bm);
    const k = velho ? Math.min(velho.width / bm.width, velho.height / bm.height) : 1;
    if (Math.abs(k - 1) > .001) for (const c of Object.values(n.chaves || {})) if (c.s != null) c.s = round(c.s * k, 4);
    n.arq = id;
    const r = Modelo.achar(this.P, n.id), pa = r?.pai; // peça de um cenário: o editor de cenário também passa a usar a imagem nova
    if (n.pecaCen && pa?.cenaEd) { const pc = pa.cenaEd.pecas.find(x => x.id === n.pecaCen); if (pc) { const w = bm.width * Math.min(pc.w / bm.width, pc.h / bm.height), hh = bm.height * Math.min(pc.w / bm.width, pc.h / bm.height);
      Object.assign(pc, { tipo: 'img', k: id, x: pc.x + (pc.w - w) / 2, y: pc.y + pc.h - hh, w, h: hh }); delete pc.camadas; delete pc.idx; delete pa.nuvem; } }
    this.commit('Trocar a imagem');
  },
  addPasta() {
    const n = Modelo.novoNo('pasta', { nome: 'Pasta' }); const s = this.noSel();
    if (s && s.tipo !== 'pasta') { const r = Modelo.achar(this.P, s.id); const i = r.lista.indexOf(s); r.lista.splice(i, 1, n); n.filhos.push(s); this.sel = n.id; n.chaves = { [this.q]: { x: 0, y: 0, r: 0, s: 1, sx: 1, op: 1 } }; return this.commit('Nova pasta'); }
    n.chaves = { 0: { x: 0, y: 0, r: 0, s: 1, sx: 1, op: 1 } }; this.P.raiz.unshift(n); this.sel = n.id; this.commit('Nova pasta');
  },
  duplicar() {
    const s = this.noSel(); if (!s) return; const r = Modelo.achar(this.P, s.id), c = clone(s);
    Modelo.cada([c], x => { x.id = uid('n'); }); c.nome = s.nome + ' (cópia)'; r.lista.splice(r.lista.indexOf(s), 0, c); this.sel = c.id; this.commit('Duplicar');
  },
  async apagarSel() {
    const s = this.noSel(); if (!s) return;
    if (s.filhos?.length && !(await UI.confirm({ title: 'Apagar a pasta?', msg: `"<b>${esc(s.nome)}</b>" e tudo dentro dela saem da animação.`, ok: 'Apagar', danger: true }))) return;
    const r = Modelo.achar(this.P, s.id); r.lista.splice(r.lista.indexOf(s), 1); this.sel = null; this.commit('Apagar');
  },
  // chaves do nó selecionado
  chaveAqui() { const s = this.noSel(); if (!s) return UI.toast('Escolha uma camada primeiro'); Modelo.poeTransf(s, this.q, {}); this.commit('Chave no quadro ' + (this.q + 1)); },
  tiraChave() {
    const s = this.sel === 'camera' ? this.P.camera : this.noSel(); if (!s?.chaves?.[this.q]) return UI.toast('Não há chave neste quadro');
    if (Object.keys(s.chaves).length <= 1) return UI.toast('Toda camada precisa de pelo menos uma chave');
    delete s.chaves[this.q]; this.commit('Tirar chave');
  },

  /* ---------- palco: canvas infinito com a câmera ---------- */
  palco: {
    cv: null, ctx: null, dpr: 1, arr: null, espaco: false,
    liga() {
      if (this.cv) return this.tamanho(); this.cv = $('#palco-cv'); this.ctx = this.cv.getContext('2d');
      new ResizeObserver(() => this.tamanho()).observe(this.cv.parentElement); this.tamanho();
      this.cv.addEventListener('pointerdown', e => this.desce(e)); this.cv.addEventListener('wheel', e => this.roda(e), { passive: false });
      this.cv.addEventListener('pointermove', e => { if (e.buttons || !App.esqueleto) return; const sim = !!App.alcaEsqueleto({ x: e.offsetX, y: e.offsetY }); if (sim !== this._sobreRig) { this._sobreRig = sim; this.cv.style.cursor = sim ? 'grab' : ''; } }); // em cima de uma junta do esqueleto
      this.cv.addEventListener('dblclick', e => this.duplo(e)); this.cv.addEventListener('contextmenu', e => { e.preventDefault(); this.menu(e); });
      document.addEventListener('visibilitychange', () => { if (document.hidden || !App.P) return; this.tamanho(); }); // aberto numa aba escondida: ao aparecer, desenha tudo (e enquadra se ainda não tinha tamanho)
      Render.aoChegarImagem = () => { if (App._rafImg) return; App._rafImg = requestAnimationFrame(() => { App._rafImg = 0; App.pinta(); Folha.pinta(); }); }; // várias imagens chegando: redesenha uma vez por quadro
    },
    tamanho() { const r = this.cv.getBoundingClientRect(); this.dpr = devicePixelRatio || 1; this.cv.width = Math.max(2, r.width * this.dpr); this.cv.height = Math.max(2, r.height * this.dpr); if (App._enq && r.width >= 4) return App.enquadrar();
      const v = App.vista, a = this._wh; this._wh = { w: r.width, h: r.height }; // a tela mudou de tamanho (painel do quadro, janela…): o meio continua no meio
      if (v && a && a.w >= 4 && r.width >= 4) { v.x += (r.width - a.w) / 2; v.y += (r.height - a.h) / 2; }
      if (App._enqCorta && r.width >= 4) { App._enqCorta = false; if (!App.cameraCabe()) return App.enquadrar(); } // abriu/fechou o painel do quadro: a câmera cortada = enquadra
      App.pinta(); }, // projeto aberto antes da tela ter tamanho: enquadra agora (antes ficava vazio até mexer)
    // mundo ↔ tela
    vista() { const v = App.vista; return new DOMMatrix().scale(this.dpr).translate(v.x, v.y).scale(v.z); },
    paraMundo(e) { const r = this.cv.getBoundingClientRect(), v = App.vista; return { x: (e.clientX - r.left - v.x) / v.z, y: (e.clientY - r.top - v.y) / v.z }; },
    paraTela(p) { const v = App.vista; return { x: p.x * v.z + v.x, y: p.y * v.z + v.y }; },
    roda(e) {
      e.preventDefault(); const r = this.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, v = App.vista;
      if (e.ctrlKey || !e.shiftKey) { const f = Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015)), z = clamp(v.z * f, .03, 12); v.x = mx - (mx - v.x) * z / v.z; v.y = my - (my - v.y) * z / v.z; v.z = z; }
      else { v.x -= e.deltaX || e.deltaY; }
      App.pinta(); App.zoomTxt();
    },
    // cantos/alças do selecionado na tela
    alcas() {
      const s = App.noSel(); if (!s) return null; const cx = Render.caixas(App.P, App.q).find(c => c.no === s); if (!cx) return null;
      const pts = cx.cantos.map(p => this.paraTela(p)), meioTopo = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const cen = this.paraTela(cx.m.transformPoint(new DOMPoint(0, 0))), dx = meioTopo.x - cen.x, dy = meioTopo.y - cen.y, L = Math.hypot(dx, dy) || 1;
      return { pts, cen, girar: { x: meioTopo.x + dx / L * 28, y: meioTopo.y + dy / L * 28 }, escala: pts[2], cx };
    },
    desce(e) {
      this.cv.setPointerCapture(e.pointerId); const tela = { x: e.offsetX, y: e.offsetY }, P = App.P;
      if (e.button === 1 || e.button === 0 && (this.espaco || App.ferr === 'mao' || e.altKey)) return this.arrastaVista(e);
      if (e.button !== 0) return;
      if (App.ferr === 'camera' || App.sel === 'camera') return this.arrastaCamera(e);
      if (Deformar.ativo && Deformar.desce(e, this.cv, this.dpr)) return; // deformar: arrastar um ponto
      if (PontosEd.ativo && PontosEd.desce(e)) return; // pontos do SVG (js/pontosed.js)
      const ik = App.alcaEsqueleto(tela); if (ik) return this.arrastaRig(e, ik); // esqueleto: IK nas pontas, FK nas juntas
      const al = this.alcas(), perto = (a, b, r = 10) => a && Math.hypot(a.x - b.x, a.y - b.y) < r;
      const s = App.noSel();
      if (al && s && !s.trava && perto(al.girar, tela, 11)) return this.arrastaGiro(e, s, al);
      if (al && s && !s.trava && perto(al.escala, tela, 11)) return this.arrastaEscala(e, s, al);
      const w = this.paraMundo(e), alvo = Render.caixas(P, App.q).find(c => !c.no.trava && dentroPoligono(w, c.cantos));
      if (!alvo) { if (App.sel) App.selecionar(null); return this.arrastaVista(e, true); }
      if (alvo.no.id !== App.sel) App.selecionar(alvo.no.id);
      this.arrastaMover(e, alvo.no);
    },
    fim(e, mov, fim) { const up = ev => { this.cv.removeEventListener('pointermove', mov); this.cv.removeEventListener('pointerup', up); this.cv.removeEventListener('pointercancel', up); fim?.(ev); }; this.cv.addEventListener('pointermove', mov); this.cv.addEventListener('pointerup', up); this.cv.addEventListener('pointercancel', up); },
    arrastaVista(e, soSeMover) {
      const v = App.vista, x0 = e.clientX, y0 = e.clientY, vx = v.x, vy = v.y; $('#palco').classList.add('arrasta');
      this.fim(e, ev => { v.x = vx + ev.clientX - x0; v.y = vy + ev.clientY - y0; App.pinta(); }, () => $('#palco').classList.remove('arrasta'));
    },
    arrastaMover(e, n) {
      const w0 = this.paraMundo(e), t0 = Modelo.transf(n, App.q), inv = App.matPai(n.id).inverse(), a0 = inv.transformPoint(new DOMPoint(w0.x, w0.y)); let mexeu = false;
      const ima = App.imaInicio(n); // bordas e meios para grudar (câmera, Fundo padrão, outros personagens/objetos)
      this.fim(e, ev => { let w = this.paraMundo(ev); if (ev.shiftKey) { if (Math.abs(w.x - w0.x) > Math.abs(w.y - w0.y)) w = { x: w.x, y: w0.y }; else w = { x: w0.x, y: w.y }; }
        if (ima && App.regua() && !ev.ctrlKey) w = App.gruda(ima, w0, w, ev.shiftKey); else App.guias = null;
        const a = inv.transformPoint(new DOMPoint(w.x, w.y)), dx = a.x - a0.x, dy = a.y - a0.y;
        Modelo.poeTransf(n, App.q, { x: round(t0.x + dx, 1), y: round(t0.y + dy, 1) }); mexeu = true; App.pinta(); }, () => { App.guias = null; if (mexeu) App.commit('Mover', { semArvore: true }); else App.pinta(); });
    },
    // arrastar uma junta do esqueleto: ponta de membro = IK (braço e antebraço giram juntos); outra junta = gira a parte de cima dela. Fica na chave do quadro (k.partes)
    arrastaRig(e, { n, al }) {
      const P = App.P, q = App.q; if (n.id !== App.sel) App.selecionar(n.id);
      const est = Modelo.estadoPersonagem(n, q), dv = Modelo.naVista(P.personagens[n.ref], est.vista), ep0 = Modelo.partesNoEstado(dv, est), inv = Rig.matNo(P, n, q).inverse();
      const antes = JSON.stringify(n.chaves?.[q] || null), cad = al.tipo === 'ik' ? al.cad : null; let mexeu = false; App._ikAtivo = al.pid;
      const lado = cad && (() => { const J = Rig.juntas(dv, ep0), S = J[cad.raiz], E = J[cad.meio], W = J[cad.fim]; const c = (E.x - S.x) * (W.y - E.y) - (E.y - S.y) * (W.x - E.x); return Math.sign(c) || (cad.tipo === 'perna' ? -1 : 1); })();
      this.fim(e, ev => {
        const w = this.paraMundo(ev), loc = inv.transformPoint(new DOMPoint(w.x, w.y)), alvo = { x: loc.x, y: loc.y };
        const r = cad ? Rig.ik(dv, ep0, cad, alvo, { dobra: ev.altKey ? -lado : undefined, ponta: 'centro' }) : Rig.giraPara(dv, ep0, al, alvo); if (!r) return;
        const k = Modelo.chave(n, q); k.partes = { ...(k.partes || {}) }; for (const [id, rr] of Object.entries(r)) k.partes[id] = { ...(k.partes[id] || {}), r: ev.shiftKey && !cad ? Math.round(rr / 15) * 15 : rr };
        mexeu = true; App.pinta();
      }, () => { App._ikAtivo = null; if (mexeu && JSON.stringify(n.chaves?.[q] || null) !== antes) App.commit(cad ? 'Mover ' + (dv.partes.find(p => p.id === cad.fim)?.nome || 'membro') + ' (IK)' : 'Girar ' + (dv.partes.find(p => p.id === al.pid)?.nome || 'parte'), { semArvore: true }); else App.pinta(); });
    },
    arrastaGiro(e, n, al) {
      const t0 = Modelo.transf(n, App.q), ang = p => Math.atan2(p.y - al.cen.y, p.x - al.cen.x) * 180 / Math.PI, a0 = ang({ x: e.offsetX, y: e.offsetY });
      this.fim(e, ev => { let r = t0.r + ang({ x: ev.offsetX, y: ev.offsetY }) - a0; if (ev.shiftKey) r = Math.round(r / 15) * 15; Modelo.poeTransf(n, App.q, { r: round(r, 1) }); App.pinta(); }, () => App.commit('Girar', { semArvore: true }));
    },
    arrastaEscala(e, n, al) {
      const t0 = Modelo.transf(n, App.q), d0 = Math.hypot(e.offsetX - al.cen.x, e.offsetY - al.cen.y) || 1;
      this.fim(e, ev => { const d = Math.hypot(ev.offsetX - al.cen.x, ev.offsetY - al.cen.y); Modelo.poeTransf(n, App.q, { s: round(clamp(t0.s * d / d0, .02, 40), 3) }); App.pinta(); }, () => App.commit('Tamanho', { semArvore: true }));
    },
    arrastaCamera(e) {
      const k = Modelo.camera(App.P, App.q), w0 = this.paraMundo(e); App.sel = 'camera';
      this.fim(e, ev => { const w = this.paraMundo(ev); App.P.camera.chaves[App.q] = { ...k, ...(App.P.camera.chaves[App.q] || {}), x: round(k.x + w.x - w0.x, 1), y: round(k.y + w.y - w0.y, 1) }; App.pinta(); },
        () => App.commit('Mover a câmera'));
    },
    duplo(e) { if (PontosEd.ativo) return PontosEd.duplo(e); const w = this.paraMundo(e), alvo = Render.caixas(App.P, App.q).find(c => dentroPoligono(w, c.cantos)); if (alvo?.no.tipo === 'texto') Lado.editarTexto(alvo.no); else if (alvo?.no.tipo === 'personagem') QuadroEd.abrir(alvo.no); }, // dois cliques no personagem: o Ateliê ao lado, só neste quadro
    menu(e) {
      const w = this.paraMundo(e), sob = Render.caixas(App.P, App.q).find(c => dentroPoligono(w, c.cantos))?.no; // botão direito numa camada: ela passa a ser a escolhida
      if (sob && sob.id !== App.sel) App.selecionar(sob.id);
      const s = App.noSel();
      UI.ctx(e.clientX, e.clientY, [
        { label: 'Personagem…', icon: 'plus', action: () => App.addPersonagem() }, { label: 'Imagem…', icon: 'image', action: () => App.addImagem() }, { label: 'Cenários (biblioteca em camadas)…', icon: 'layers', action: () => CenLib.abrir() }, { label: 'Cenário (prontos e IA)…', icon: 'paisagem', ai: true, action: () => Cenarios.abrir() }, { label: 'Cenário da nuvem da equipe…', icon: 'cloud', action: () => CenariosNuvem.escolher() }, { label: 'Texto', icon: 'text', action: () => App.addTexto() }, '-',
        s?.tipo === 'imagem' && { label: 'Trocar a imagem…', icon: 'image', action: () => App.trocarImagem(s) },
        (s?.tipo === 'imagem' || s?.cenaEd) && (s.nuvem ? { label: 'Já está na nuvem da equipe', icon: 'check', disabled: true } : { label: 'Salvar na nuvem', icon: 'cloud', action: () => App.salvarNaNuvem(s) }),
        s?.tipo === 'personagem' && { label: `Arrumar o quadro ${App.q + 1} aqui (Ateliê ao lado)`, icon: 'brush', action: () => QuadroEd.abrir(s) },
        s?.tipo === 'personagem' && { label: `Editar no Ateliê (pose do quadro ${App.q + 1})`, icon: 'edit', action: () => Animacoes.editarNoAtelie(s) },
        s?.tipo === 'personagem' && { label: 'Abrir a cópia desta animação no Ateliê (todos os quadros, só aqui)', icon: 'film', action: () => AtelieAnim.abrir(App.P.id, s.ref) },
        s?.tipo === 'personagem' && { label: 'Abrir no Ateliê como pose nova…', icon: 'plus', action: () => Animacoes.poseNova(s) },
        s?.tipo === 'personagem' && { label: 'Cor interna…', icon: 'brush', action: () => App.corInterna(s) },
        s?.tipo === 'personagem' && { label: (Modelo.transf(s, App.q).sx || 1) < 0 ? 'Desespelhar (voltar para o lado de antes)' : 'Espelhar (virar para o outro lado)', icon: 'transition', action: () => Animacoes.espelhar(s) },
        Deformar.pode(s) && { label: Deformar.ativo ? 'Parar de deformar' : 'Deformar (cantos ou malha)…', icon: 'transition', key: 'T', action: () => Deformar.alterna(s) },
        PontosEd.pode(s) && { label: PontosEd.ativo ? 'Parar de editar os pontos' : 'Editar os pontos do SVG (aqui mesmo)', icon: 'edit', key: 'A', action: () => PontosEd.alterna(s) },
        s && { label: 'Chave neste quadro', icon: 'diamond', key: 'K', action: () => App.chaveAqui() },
        s && { label: 'Duplicar', icon: 'dup', key: 'Ctrl+D', action: () => App.duplicar() },
        s && { label: 'Pôr numa pasta', icon: 'folder', key: 'Ctrl+G', action: () => App.addPasta() },
        s && s.tipo !== 'efeito' && App.menuTremulo(s),
        s && { label: 'Apagar', icon: 'trash', danger: true, key: 'Del', action: () => App.apagarSel() },
        '-', { label: 'Enquadrar a câmera', icon: 'crop', key: 'F', action: () => App.enquadrar() },
        '-', s ? { label: `Citar na IA: ${s.nome} no quadro ${App.q + 1}`, icon: 'sparkles', ai: true, action: () => Assistente.citar({ tipo: 'camada', id: s.id, nome: s.nome, q: App.q }) } : { label: `Citar o quadro ${App.q + 1} na IA`, icon: 'sparkles', ai: true, action: () => Assistente.citar({ tipo: 'quadro', q: App.q }) },
        { label: `Citar o quadro ${App.q + 1} em mensagens…`, icon: 'chat', action: () => Citacao.animacao(App.P, App.q, App.sel) },
      ].filter(Boolean));
    },
  },
  _raf: 0,
  // ESQUELETO (js/rig.js): ossos e juntas dos personagens do quadro; laranja = ponta de membro (arrastar = IK), azul = gira a parte de cima (FK)
  desenhaEsqueleto(ctx, V) {
    const P = this.P, s = this.noSel();
    for (const n of Modelo.noQuadro(P, this.q)) { if (n.trava) continue; const ee = Render.estadoPartes(P, n, this.q); if (!ee) continue;
      ctx.save(); if (s && s !== n) ctx.globalAlpha = .45; Rig.desenha(ctx, ee.dv, ee.ep, V.multiply(Rig.matNo(P, n, this.q)), { ativo: this._ikAtivo }); ctx.restore(); }
  },
  // ponto do esqueleto embaixo do mouse (tela em px css) → { n, al }
  alcaEsqueleto(tela) {
    if (!this.esqueleto || this.tocando || PontosEd.ativo) return null; const P = this.P, v = this.vista, sel = this.noSel(); let melhor = null;
    for (const n of Modelo.noQuadro(P, this.q)) { if (n.trava) continue; const ee = Render.estadoPartes(P, n, this.q); if (!ee) continue; const M = Rig.matNo(P, n, this.q);
      for (const al of Rig.alcas(ee.dv, ee.ep)) { const w = M.transformPoint(new DOMPoint(al.x, al.y)), d = Math.hypot(w.x * v.z + v.x - tela.x, w.y * v.z + v.y - tela.y) - (n === sel ? 3 : 0);
        if (d < (al.tipo === 'ik' ? 14 : al.cabelo ? 8 : 11) && (!melhor || d < melhor.d)) melhor = { n, al, d }; } }
    return melhor;
  },
  pinta() { if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this.desenhaPalco(); }); },
  desenhaPalco() {
    const pc = this.palco, P = this.P; if (!P || !pc.ctx) return;
    const ctx = pc.ctx, W = pc.cv.width, H = pc.cv.height; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#151515'; ctx.fillRect(0, 0, W, H);
    if (this.modoVista === 'camera') { // só o que a câmera vê, com cor, efeitos e legenda (igual ao vídeo)
      const k = Math.min(W / P.w, H / P.h) * .94, w = Math.round(P.w * k), h = Math.round(P.h * k);
      if (!this._fin || this._fin.width !== w || this._fin.height !== h) { this._fin = new OffscreenCanvas(w, h); }
      Render.quadro(this._fin.getContext('2d'), P, this.q, w, h); ctx.drawImage(this._fin, (W - w) / 2, (H - h) / 2); return;
    }
    const V = pc.vista(), c = Modelo.camera(P, this.q), cw = P.w / (c.zoom || 1), ch = P.h / (c.zoom || 1);
    const camM = new DOMMatrix().translate(c.x, c.y).rotate(c.r || 0), cantosCam = [[-cw / 2, -ch / 2], [cw / 2, -ch / 2], [cw / 2, ch / 2], [-cw / 2, ch / 2]].map(([x, y]) => camM.transformPoint(new DOMPoint(x, y)));
    // casca de cebola: quadros vizinhos bem clarinhos
    if (this.onion && !this.tocando) for (const [d, a] of [[-2, .1], [-1, .22], [1, .16]]) { const qq = this.q + d; if (qq < 0 || qq > Modelo.ultimoQuadro(P)) continue; ctx.save(); ctx.filter = d < 0 ? 'sepia(1) hue-rotate(160deg) saturate(3)' : 'sepia(1) hue-rotate(-40deg) saturate(3)'; Render.camadas(ctx, P, qq, V, a); ctx.restore(); }
    ctx.save(); ctx.filter = Efeitos.filtro(P, this.q); Render.camadas(ctx, P, this.q, V, 1, { fundo: true, sombra: pc.dpr }); ctx.restore(); // o fundo (quadriculado/liso) entra como a camada mais de baixo: os efeitos valem nele também
    // fora da câmera fica escurecido
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath(); ctx.rect(0, 0, W, H); const ct = cantosCam.map(p => V.transformPoint(p)); ct.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    ctx.fillStyle = 'rgba(21,21,21,.38)'; ctx.fill('evenodd');
    ctx.strokeStyle = this.sel === 'camera' ? '#9fc3ff' : 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5 * pc.dpr; ctx.beginPath(); ct.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = `${11 * pc.dpr}px Segoe UI`; ctx.fillText(`Câmera · ${P.w}×${P.h}`, ct[0].x + 6 * pc.dpr, ct[0].y - 6 * pc.dpr);
    // LEGENDA na frente de tudo também no modo Cena, no lugar exato do vídeo (dentro do quadro da câmera)
    if (!this.legOculta && (P.legendas || []).length) { ctx.save(); ctx.setTransform(V.multiply(camM).translate(-cw / 2, -ch / 2).scale(1 / (c.zoom || 1))); try { Render.legenda(ctx, P, this.q, P.w, P.h); } catch (e) { console.warn('[legenda]', e); } ctx.restore(); }
    this.desenhaRegua(ctx, V, W, H, pc.dpr); AoVivo.desenha(ctx, V, pc.dpr);
    if (this.esqueleto && !this.tocando && !PontosEd.ativo) this.desenhaEsqueleto(ctx, V);
    if (Deformar.ativo && Deformar.desenhaAlcas(ctx, V, pc.dpr)) return; // deformando: os pontos no lugar das alças
    if (PontosEd.ativo && PontosEd.desenha(ctx)) return; // pontos do SVG por cima de tudo
    // seleção com alças (girar em cima, tamanho no canto)
    const al = this.palco.alcas();
    if (al) {
      const d = pc.dpr, s = this.noSel(); ctx.strokeStyle = s.trava ? '#e8c25a' : '#9fc3ff'; ctx.lineWidth = 1.5 * d; ctx.setLineDash([5 * d, 4 * d]);
      ctx.beginPath(); al.pts.forEach((p, i) => i ? ctx.lineTo(p.x * d, p.y * d) : ctx.moveTo(p.x * d, p.y * d)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      if (!s.trava) {
        const mt = { x: (al.pts[0].x + al.pts[1].x) / 2, y: (al.pts[0].y + al.pts[1].y) / 2 };
        ctx.beginPath(); ctx.moveTo(mt.x * d, mt.y * d); ctx.lineTo(al.girar.x * d, al.girar.y * d); ctx.stroke();
        for (const [p, r] of [[al.girar, 6], [al.escala, 5]]) { ctx.beginPath(); ctx.arc(p.x * d, p.y * d, r * d, 0, Math.PI * 2); ctx.fillStyle = '#1b1b1b'; ctx.fill(); ctx.stroke(); }
      }
      ctx.beginPath(); ctx.arc(al.cen.x * d, al.cen.y * d, 3.5 * d, 0, Math.PI * 2); ctx.fillStyle = '#9fc3ff'; ctx.fill();
    }
  },
  // quadradinhos no espaço do mundo (seguem o zoom e a mão); o tamanho dobra/divide para nunca ficar miúdo demais
  // fundo onde não tem nada (canvas infinito): quadriculado ou cor lisa. É da animação: aparece igual na Cena, na Câmera e no vídeo
  fundoPalco() { return Render.fundoDe(this.P); },
  mudaFundoPalco(m, salvar = true) { Object.assign(this.fundoPalco(), m); if (salvar) this.commit('Fundo', { semArvore: true }); else this.pinta(); },
  quadriculado(ctx, V, W, H) { Render.fundo(ctx, this.P, V, W, H); },
  cameraCabe() { const v = this.vista, r = this.palco.cv?.getBoundingClientRect(); if (!v || !r || !this.P) return true; const c = Modelo.camera(this.P, this.q), hw = this.P.w / c.zoom / 2, hh = this.P.h / c.zoom / 2;
    const x0 = v.x + (c.x - hw) * v.z, x1 = v.x + (c.x + hw) * v.z, y0 = v.y + (c.y - hh) * v.z, y1 = v.y + (c.y + hh) * v.z; return x0 >= -2 && y0 >= -2 && x1 <= r.width + 2 && y1 <= r.height + 2; },
  enquadrar() { const pc = this.palco; if (!pc.cv || !this.P) return; const r = pc.cv.getBoundingClientRect(); if (r.width < 4 || r.height < 4) { this._enq = true; return; } this._enq = false; const c = Modelo.camera(this.P, this.q), z = Math.min(r.width / (this.P.w / c.zoom), r.height / (this.P.h / c.zoom)) * .86;
    this.vista = { z, x: r.width / 2 - c.x * z, y: r.height / 2 - c.y * z }; this.pinta(); this.zoomTxt(); },
  zoomTxt() { const e = $('#zoom-txt'); if (e) e.textContent = Math.round(this.vista.z * 100) + '%'; },
  setFerr(f) { this.ferr = f; $$('[data-ferr]').forEach(b => b.classList.toggle('on', b.dataset.ferr === f)); $('#palco').classList.toggle('pan', f === 'mao'); if (f === 'camera') this.selecionar('camera'); },
  setVista(m) { this.modoVista = m; $$('[data-vista]').forEach(b => b.classList.toggle('on', b.dataset.vista === m)); this.pinta(); },

  // [ e ]: vai para a chave anterior/próxima da camada escolhida (ou de qualquer camada, câmera e começos/fins de áudio e legenda)
  pulaChave(dir) {
    const P = this.P, s = this.noSel(), qs = new Set();
    if (s?.chaves) Object.keys(s.chaves).forEach(k => qs.add(+k)); else if (this.sel === 'camera') Object.keys(P.camera.chaves).forEach(k => qs.add(+k));
    else { Modelo.todos(P).forEach(n => { Object.keys(n.chaves || {}).forEach(k => qs.add(+k)); qs.add(n.de || 0); if (n.ate != null) qs.add(n.ate); }); Object.keys(P.camera.chaves).forEach(k => qs.add(+k)); (P.legendas || []).forEach(g => qs.add(g.de)); (P.audios || []).forEach(a => qs.add(a.de || 0)); }
    const L = [...qs].filter(x => x >= 0 && x < P.duracao).sort((a, b) => a - b), alvo = dir > 0 ? L.find(x => x > this.q) : L.reverse().find(x => x < this.q);
    if (alvo != null) this.setQ(alvo);
  },
  /* ---------- atalhos (como num programa de animação) ---------- */
  teclas(e) {
    if (!this.P || $('#editor').classList.contains('hidden')) return;
    const alvo = e.target, digitando = alvo.closest('input,textarea,select,[contenteditable]') && alvo.type !== 'range' && alvo.type !== 'checkbox';
    if (digitando || $('#modal-root').children.length) return;
    if (PontosEd.ativo && PontosEd.tecla(e)) return;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey, s = this.noSel();
    if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); return e.shiftKey ? this.redo() : this.undo(); }
    if (ctrl && k === 'y') { e.preventDefault(); return this.redo(); }
    if (ctrl && (k === 't' || k === 'T')) { e.preventDefault(); return Deformar.alterna(s); }
    if (ctrl && k === 'd') { e.preventDefault(); return this.duplicar(); }
    if (ctrl && k === 'g') { e.preventDefault(); return this.addPasta(); }
    if (ctrl && k === 's') { e.preventDefault(); this.salvarJa(); return UI.toast('Salvo neste computador', { kind: 'ok' }); }
    if (ctrl) return;
    if (k === ' ') { e.preventDefault(); return this.tocar(); }
    if (k === ',' || k === '<') { e.preventDefault(); return this.setQ(this.q - (e.shiftKey ? 5 : 1), { som: true }); }
    if (k === '.' || k === '>') { e.preventDefault(); return this.setQ(this.q + (e.shiftKey ? 5 : 1), { som: true }); }
    if (k === '[' || k === ']') { e.preventDefault(); return this.pulaChave(k === ']' ? 1 : -1); }
    if (k === 'Home') return this.setQ(0); if (k === 'End') return this.setQ(Modelo.ultimoQuadro(this.P));
    if (k.startsWith('Arrow')) {
      e.preventDefault();
      if (!s || s.trava) { if (k === 'ArrowLeft') this.setQ(this.q - 1, { som: true }); if (k === 'ArrowRight') this.setQ(this.q + 1, { som: true }); return; }
      const p = e.shiftKey ? 10 : 1, t = Modelo.transf(s, this.q), d = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, -p], ArrowDown: [0, p] }[k];
      Modelo.poeTransf(s, this.q, { x: t.x + d[0], y: t.y + d[1] }); clearTimeout(this._tSeta); this.pinta(); this._tSeta = setTimeout(() => this.commit('Mover', { semArvore: true }), 350); return;
    }
    const kk = k.toLowerCase();
    if (kk === 't') return Deformar.alterna(s); // deformar (o Ctrl+T o navegador não deixa)
    if (kk === 'a' && PontosEd.pode(s)) return PontosEd.alterna(s); // pontos do SVG direto no palco
    if (Deformar.ativo && (k === 'Enter' || k === 'Escape')) { e.preventDefault(); return Deformar.sair(); }
    if (kk === 'k') return e.shiftKey ? this.tiraChave() : this.chaveAqui();
    if (kk === 'r') return this.trocaRegua();
    if (kk === 'o') { this.onion = !this.onion; $('#b-onion').classList.toggle('on', this.onion); return this.pinta(); }
    if (kk === 'v') return this.setFerr('mover'); if (kk === 'h') return this.setFerr('mao'); if (kk === 'c') return this.setFerr('camera');
    if (kk === 'f') return this.enquadrar();
    if (k === 'Tab') { e.preventDefault(); return this.setVista(this.modoVista === 'mundo' ? 'camera' : 'mundo'); }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); return this.apagarSel(); }
    if (s && !s.trava && (kk === 'q' || kk === 'e')) { const t = Modelo.transf(s, this.q); Modelo.poeTransf(s, this.q, { r: t.r + (kk === 'q' ? -1 : 1) * (e.shiftKey ? 15 : 2) }); this.pinta(); clearTimeout(this._tSeta); this._tSeta = setTimeout(() => this.commit('Girar', { semArvore: true }), 350); return; }
    if (s && !s.trava && (k === '+' || k === '=' || k === '-')) { const t = Modelo.transf(s, this.q); Modelo.poeTransf(s, this.q, { s: round(clamp(t.s * (k === '-' ? .95 : 1.05), .02, 40), 3) }); this.pinta(); clearTimeout(this._tSeta); this._tSeta = setTimeout(() => this.commit('Tamanho', { semArvore: true }), 350); return; }
  },
};
addEventListener('keydown', e => App.teclas(e));
addEventListener('keydown', e => { if (e.key === ' ' && e.target === document.body) e.preventDefault(); });

/* trocar de tela (início, editor, ateliê) */
const Telas = { mostra(id) { for (const t of ['home', 'editor', 'atelie']) $('#' + t).classList.toggle('hidden', t !== id); this.marca(id); if (id === 'editor' && typeof Midia !== 'undefined') Midia.liga(); },
  // ATELIÊ: ícone próprio na aba (paleta laranja) e título em caixa alta; fora dele volta o do ANIMADOR
  marca(id) { if (window.EstudioIcones) window.EstudioIcones.usar(id === 'atelie' ? 'at' : 'an'); else { const l = document.querySelector('link[rel="icon"]'); if (l) { const novo = id === 'atelie' ? 'icones/atelie.svg' : 'icones/simbolo.svg'; if (!l.href.endsWith(novo)) l.href = novo; } } // ícone da aba = ícone novo do programa (An / At)
    if (id === 'atelie') document.title = (typeof Atelie !== 'undefined' && Atelie.def?.nome ? Atelie.def.nome + ' — ' : '') + 'ATELIÊ · Estúdio Problems'; else if (typeof App !== 'undefined' && App.titulo) App.titulo(); } };
// F5 / fechar a aba com uma mudança ainda esperando os 700 ms do salvar: salva já (a animação reabre no mesmo ponto pelo ?projeto=)
addEventListener('pagehide', () => { if (App.P && App._tSalvar) App.salvarJa(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && App.P && App._tSalvar) App.salvarJa(); });
