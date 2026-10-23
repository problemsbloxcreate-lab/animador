/* ===================== atelie.js — Ateliê de personagens (montagem por partes) =====================
   1) PARTES: corpo, cabeça, cabelo, olhos, braços… cada uma com várias IMAGENS para trocar. Cada parte encaixa no pai
      (ex.: olhos → cabeça → corpo): mexeu no pai, as partes de cima vão junto; trocou a imagem, ela continua no lugar certo.
   2) MONTAR (Base): arraste as peças para o lugar; Alt+arrastar muda o PIVÔ (ponto de giro); "Só esta imagem" corrige
      uma imagem que ficou torta sem mexer nas outras.
   3) SESSÕES e PRESETS: "Olhos" → assustado, surpreso, triste, fechado… "Perna direita" → chutando, inclinada…
      "Pose" (corpo todo). Editando um preset, o que você mexe vale só para ele.
   Teclas: setas movem (Shift = 10) · Q/E giram (Shift = 15°) · + / − tamanho · F espelha · [ ] frente/trás · Tab próxima parte
           · H esconde · Delete/Backspace apaga (a parte, as partes marcadas ou a imagem clicada) · Ctrl+Z desfaz · Ctrl+S guarda neste computador (a nuvem: botão da nuvem).
   RAIZ: a parte principal (def.raiz), destacada em amarelo na hierarquia. Ctrl+clique / Shift+clique marcam várias partes;
   arrastar partes para "Imagens de…" (ou o menu "Mover para imagens de") transforma partes que entraram sem querer em imagens trocáveis. */
'use strict';
const SESSOES_PRONTAS = [
  { nome: 'Olhos', acha: /olho|eye|pupila|cílio|cilio/i, presets: ['normal', 'assustado', 'surpreso', 'triste', 'fechado', 'bravo'] },
  { nome: 'Sobrancelhas', acha: /sobrancelha|brow/i, presets: ['normal', 'brava', 'triste', 'levantada'] },
  { nome: 'Boca', acha: /boca|mouth|lábio|labio|dente/i, presets: ['fechada', 'meio aberta', 'aberta', 'sorriso', 'triste'] },
  { nome: 'Braço direito', acha: /bra[cç]o.*(dir|d\b)|m[aã]o.*(dir|d\b)|antebra[cç]o.*(dir|d\b)/i, presets: ['parado', 'acenando', 'apontando'] },
  { nome: 'Braço esquerdo', acha: /bra[cç]o.*(esq|e\b)|m[aã]o.*(esq|e\b)|antebra[cç]o.*(esq|e\b)/i, presets: ['parado', 'na cintura'] },
  { nome: 'Perna direita', acha: /perna.*(dir|d\b)|p[eé].*(dir|d\b)|coxa.*(dir|d\b)/i, presets: ['parada', 'chutando', 'inclinada'] },
  { nome: 'Perna esquerda', acha: /perna.*(esq|e\b)|p[eé].*(esq|e\b)|coxa.*(esq|e\b)/i, presets: ['parada', 'passo'] },
  { nome: 'Pose', acha: /.*/, presets: ['em pé', 'pulando', 'sentado'] },
];
const Atelie = {
  def: null, sel: null, edit: null, vista: { x: 0, y: 0, z: 1 }, pilha: [], refazer: [], ultimo: null, volta: false, aba: 'peca', modoMover: 'preset', sujo: false, base0: null, multi: new Set(), focoImg: null, teste: null,
  // o Ateliê abre numa aba nova do navegador (Voltar fecha a aba); se o navegador bloquear, abre aqui mesmo
  abrirAba(id) {
    if (this.emAba) return this.abrir(id);
    const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('atelie', id || 'novo');
    const w = window.open(u.href, '_blank'); if (!w) return this.abrir(id, { volta: !!App.P });
  },
  async abrir(id, o = {}) {
    this.volta = !!o.volta; let def;
    let doRascunho = false, novo = null, soLocal = false;
    if (o.def) def = o.def; // veio de um arquivo .atelieanimador
    else if (id) { const t = UI.toast('<span class="spin-dot"></span> Abrindo o personagem…', { time: 60000 }), r = await DB.get('arquivos', this.chaveRascunho(id)).catch(() => null); this._rascNuvem = !!r?.nuvem;
      try { def = await Nuvem.abrir(id); this._temNuvem = true; } catch (e) { this._temNuvem = false; if (!r?.def && !o.reserva) { t.remove(); return UI.toast('Não abriu: ' + esc(e.message), { kind: 'err' }); } } t.remove();
      if (!def && !r?.def && o.reserva) { def = o.reserva; doRascunho = true; } // só existe na animação (ex.: veio de um .animador): usa a cópia de lá
      if (r?.def && !def) { def = r.def; doRascunho = true; } // ainda não foi para a nuvem: só existe o rascunho deste computador
      else if (r?.def && JSON.stringify(r.def) !== JSON.stringify(def)) {
        const usa = await UI.modal({ title: 'Tem um rascunho neste computador', icon: 'save', width: 460, body: `<div>As mudanças de <b>${esc(r.def.nome)}</b> feitas neste computador (guardadas ${fmtDate(r.em)}) <b>ainda não foram para a nuvem</b>.<br><br>A versão da nuvem é de ${def.modificado ? fmtDate(def.modificado) : 'antes'}.<div class="rasc-esc"><div class="rasc-op nuvem">${ic('cloud', 15)}<span><b>Seguir na nuvem</b>: abre a versão da equipe (e o ao vivo, com quem estiver junto). O rascunho é descartado.</span></div><div class="rasc-op">${ic('monitor', 15)}<span><b>Continuar o rascunho</b>: abre a versão deste computador, sem o ao vivo. Vai para a nuvem quando você clicar em Salvar na nuvem.</span></div></div></div>`,
          buttons: [{ label: 'Continuar o rascunho', icon: 'monitor', kind: 'rasc-local', value: 'rascunho' }, { label: 'Seguir na nuvem', icon: 'cloud', kind: 'nuvem-dest', value: 'nuvem' }] }); // em destaque: seguir na nuvem (com quem estiver junto)
        if (usa === 'rascunho') { this.base0Nuvem = JSON.stringify(def); def = r.def; doRascunho = true; soLocal = true; } // continuar o rascunho = a versão LOCAL (não entra no ao vivo; "Salvar na nuvem" manda depois) else if (usa === 'nuvem') await this.apagarRascunho(id); else return;
      } }
    else { novo = await this.assistenteNovo(); if (!novo) return; def = Modelo.novoPersonagem(novo.nome); Modelo.garanteVistas(def); Object.assign(def.vistas[0], { tipo: novo.vtipo || 'frente', nome: (novo.vtipo === 'outra' && novo.vnome) || Modelo.nomeTipo(novo.vtipo || 'frente') }); }
    // NA NUVEM: depois da 1ª vez em "Salvar na nuvem", toda mudança vai sozinha para a nuvem. Antes disso o personagem é LOCAL (só neste computador).
    this.naNuvem = !soLocal && !o.def && !!id && !!def && !(doRascunho && !this._temNuvem && !this._rascNuvem); this._temNuvem = this._rascNuvem = false; this.erroNuvem = null; clearTimeout(this._tn);
    this.def = def; this.sel = (def.raiz && def.partes.some(p => p.id === def.raiz) ? def.raiz : def.partes[0]?.id) || null; this.multi = new Set(); this.focoImg = null; this.edit = null; this.pilha = []; this.refazer = []; this.ultimo = JSON.stringify(def); this.baseNuvem = this._temNuvem && !o.def ? (doRascunho ? this.base0Nuvem || null : this.ultimo) : null; this.base0 = o.def || !id ? this.ultimo : this.base0Nuvem || this.ultimo; this.base0Nuvem = null; this.modoMover = 'preset'; this.sujo = !id || !!o.def || doRascunho; this.rascunhoEm = doRascunho ? Date.now() : null; this.salvandoLocal = false; window.Falas?.parar(); Falas.aberto = null; this.teste = null; this.edImg = null; Animacoes.passoSel = null; Pintura.selecao = null; clearInterval(this._roda); Animacoes.parar(true); Animacoes.sel = null; Animacoes.passo = null;
    Modelo.garanteVistas(def); await Arq.garantir(Modelo.chavesImgs(def)); await Arq.usarOriginais(Modelo.chavesImgs(def)); // edita sempre a partir da original
    Telas.mostra('atelie'); this.liga(); this.pinta(); this.enquadrar(); if (o.def) this.rascunho();
    if (this.naNuvem && this.sujo) this.agendaNuvem(); // mudanças guardadas aqui que ainda não foram: vão agora
    if (novo?.fs.length) await this.montarNovo(novo); document.title = def.nome + ' — Ateliê · ANIMADOR · Estúdio Problems';
    Nuvem.souAdm?.(); // ADM: só eles apagam vistas (o menu já sai certo)
    AoVivo.entrarAtelie().catch(() => { }); // personagem da nuvem: quem mais estiver nele aparece (cursor, nome, mudanças)
  },
  // tela do personagem novo (qualquer personagem): nome, as imagens (camadas do desenho ou peças soltas) e, se quiser, a IA organiza tudo
  async assistenteNovo() {
    let fs = [], raiz = null; // raiz: { parte: nome da pasta } ou { arquivo: File solto }
    const body = h(`<div class="novo-p"><div class="campo2" style="gap:10px;align-items:flex-end"><label class="field" style="flex:2">Nome do personagem<input type="text" data-n placeholder="Nome do personagem"></label>
      <label class="field" style="flex:1" title="De que ângulo são estas imagens. Depois dá para pôr as outras vistas (frente, lado, costas…)">Vista<select data-vt>${this.opcoesVista('frente')}</select></label></div>
      <div class="field">Imagens <small>(opcional) — as peças do personagem em PNG com fundo transparente. O melhor: as camadas do desenho exportadas no mesmo tamanho (já encaixam sozinhas).</small></div>
      <div class="np-drop" data-d tabindex="0">${ic('upload', 22)}<b>Arraste as imagens ou PASTAS aqui</b><small>ou clique para escolher imagens ou uma pasta · arrastando pastas, cada pasta vira uma parte (ex.: "perna_frente" → Perna frente)</small></div><div class="np-lista" data-l></div>
      <label class="chk np-ia"><input type="checkbox" data-ia checked> ${ic('sparkles', 13)} A IA organiza tudo (partes, raiz, encaixes, pontos de giro, profundidade, sessões, presets e animações de teste)</label>
      <textarea rows="2" data-p placeholder="Opcional: dicas para a IA. Ex.: &quot;as bocas são para falar&quot;, &quot;o corpo é a raiz&quot;"></textarea></div>`);
    this.ligaVistaSel($('[data-vt]', body)); // "Adicionar…" = vista com nome à vontade
    const lista = $('[data-l]', body), drop = $('[data-d]', body), ia = $('[data-ia]', body), urls = [];
    const pintaL = () => { urls.forEach(u => URL.revokeObjectURL(u)); urls.length = 0; lista.innerHTML = '';
      // agrupado por pasta: "Pasta X" (a parte que vai virar) e embaixo as imagens dela; depois um separador e a próxima.
      // Antes de criar (e antes da IA): botão direito marca a RAIZ e muda imagens de pasta (ou arraste a imagem para outra pasta)
      const grupos = new Map(); fs.forEach((f, i) => { const g = f._parte || ''; if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push([f, i]); });
      if (raiz && !(raiz.parte ? grupos.has(raiz.parte) : fs.includes(raiz.arquivo))) raiz = null;
      // em cima: a REFERÊNCIA, depois a RAIZ (a pasta dela, ou as soltas com a imagem raiz na frente); depois o resto
      const ehGR = g => grupos.get(g)?.some(([f]) => f._ref), ehGZ = g => !!raiz && (raiz.parte ? raiz.parte === g : g === (raiz.arquivo._parte || '')),
        ordem = [...grupos.keys()].sort((a, b) => ehGR(b) - ehGR(a) || ehGZ(b) - ehGZ(a) || (a === '') - (b === '') || a.localeCompare(b, 'pt', { numeric: true }));
      for (const L of grupos.values()) L.sort((x, y) => (y[0]._ref ? 1 : 0) - (x[0]._ref ? 1 : 0) || (raiz?.arquivo === y[0]) - (raiz?.arquivo === x[0]) || x[1] - y[1]);
      const ehRaiz = (g, f) => !!raiz && (f ? raiz.arquivo === f : raiz.parte === g);
      const paraPasta = (lista, g) => { for (const f of lista) { if (f._ref) Pastas.virarRef(f, false); if (g) f._parte = g; else delete f._parte; delete f._pasta; } const L = new Set(lista); fs = [...fs.filter(f => !L.has(f)), ...lista]; pintaL(); }; // vai para o fim da pasta (não vira a imagem padrão dela)
      const destinos = (lista, deG) => [...ordem.filter(g => g !== deG && !ehGR(g)).map(g => ({ label: g || 'Imagens soltas (cada uma vira uma parte)', icon: g ? 'folder' : 'image', action: () => paraPasta(lista, g) })),
        { label: 'Pasta nova…', icon: 'plus', action: async () => { const n = (await UI.prompt({ title: 'Pasta nova', label: 'Nome da parte (ex.: Cabeça)' }))?.trim(); if (n) paraPasta(lista, Pastas.limpa(n)); } }];
      const solta = (el, g) => { el.ondragover = e => { if (e.dataTransfer.types.includes('text/np-img')) { e.preventDefault(); e.stopPropagation(); el.classList.add('drop-dentro'); } }; el.ondragleave = () => el.classList.remove('drop-dentro');
        el.ondrop = e => { const i = e.dataTransfer.getData('text/np-img'); if (i === '') return; e.preventDefault(); e.stopPropagation(); el.classList.remove('drop-dentro'); const f = fs[+i]; if (f && (f._parte || '') !== g) paraPasta([f], g); }; };
      for (const g of ordem) { const itens = grupos.get(g), gRef = ehGR(g), rz = g && !gRef && ehRaiz(g);
        if (ordem.length > 1 || g) { const cab = h(`<div class="np-grupo ${rz ? 'raiz' : ''} ${gRef ? 'ref' : ''}">${ic(gRef ? 'eye' : rz ? 'star' : g ? 'folder' : 'image', 13)}<b>${g ? esc(g) : 'Imagens soltas'}</b>${rz ? '<i class="np-raiz">RAIZ</i>' : ''}<small>${gRef ? 'o personagem inteiro: põe as peças no lugar e depois fica invisível' : g ? `vira a parte "${esc(g)}" · ${itens.length} imagem(ns)` : 'cada uma vira uma parte'}</small><button class="ibtn" title="Tirar ${g ? 'a pasta inteira' : 'as soltas'}">${ic('x', 11)}</button></div>`);
          $('button', cab).onclick = () => { const tira = new Set(itens.map(([f]) => f)); fs = fs.filter(f => !tira.has(f)); pintaL(); };
          cab.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [{ head: g || 'Imagens soltas' },
            gRef && { label: 'Não é a referência', icon: 'x', action: () => { itens.forEach(([f]) => Pastas.virarRef(f, false)); pintaL(); } },
            g && !gRef && { label: rz ? 'Não é mais a raiz' : 'Esta é a raiz (a parte principal)', icon: 'star', checked: rz, action: () => { raiz = rz ? null : { parte: g }; pintaL(); } },
            g && { label: 'Renomear', icon: 'edit', action: async () => { const n = (await UI.prompt({ title: 'Nome da parte', value: g }))?.trim(); if (n && n !== g) { const nn = Pastas.limpa(n); if (raiz?.parte === g) raiz = { parte: nn }; paraPasta(itens.map(([f]) => f), nn); } } },
            { label: 'Mover todas para', icon: 'move', sub: destinos(itens.map(([f]) => f), g) },
            '-', { label: g ? 'Tirar a pasta inteira' : 'Tirar as soltas', icon: 'trash', danger: true, action: () => { const tira = new Set(itens.map(([f]) => f)); fs = fs.filter(f => !tira.has(f)); pintaL(); } }].filter(Boolean)); };
          solta(cab, g); lista.appendChild(cab); }
        for (const [f, i] of itens) { const u = URL.createObjectURL(f), fr = !g && ehRaiz('', f); urls.push(u); const c = h(`<div class="np-im ${fr ? 'raiz' : ''}" draggable="true" title="${esc((f._pasta ? f._pasta + ' › ' : '') + f.name)}\nBotão direito: raiz, mudar de pasta · arraste para outra pasta"><img src="${u}" alt="">${fr ? '<i class="np-raiz">RAIZ</i>' : ''}<span>${f._pasta ? `<b>${esc(f._pasta)}</b> ` : ''}${esc(f.name.replace(/\.[^.]+$/, ''))}</span><button class="ibtn" title="Tirar">${ic('x', 11)}</button></div>`); $('button', c).onclick = () => { fs.splice(i, 1); pintaL(); };
          c.ondragstart = e => e.dataTransfer.setData('text/np-img', String(i)); solta(c, g);
          c.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [{ head: f.name.replace(/\.[^.]+$/, '') },
            { label: f._ref ? 'Não é a referência' : 'Esta é a referência (o personagem inteiro)', icon: 'eye', checked: !!f._ref, action: () => { if (!f._ref) fs.forEach(x => x._ref && Pastas.virarRef(x, false)); Pastas.virarRef(f, !f._ref); pintaL(); } },
            f._ref ? null : g ? { label: ehRaiz(g) ? 'A pasta dela já é a raiz' : `A pasta "${g}" é a raiz`, icon: 'star', checked: ehRaiz(g), action: () => { raiz = ehRaiz(g) ? null : { parte: g }; pintaL(); } }
              : { label: fr ? 'Não é mais a raiz' : 'Esta imagem é a raiz (a parte principal)', icon: 'star', checked: fr, action: () => { raiz = fr ? null : { arquivo: f }; pintaL(); } },
            { label: 'Mudar para a pasta', icon: 'folder', sub: destinos([f], g) },
            '-', { label: 'Tirar', icon: 'trash', danger: true, action: () => { fs.splice(i, 1); pintaL(); } }].filter(Boolean)); };
          lista.appendChild(c); } }
      drop.classList.toggle('tem', !!fs.length); const nP = new Set(fs.map(f => f._parte).filter(Boolean)).size; $('b', drop).textContent = fs.length ? `${fs.length} imagem(ns)${nP ? ` em ${nP} parte(s) pelas pastas` : ''} — arraste mais se quiser` : 'Arraste as imagens ou PASTAS aqui';
      $('.np-ia', body).hidden = $('[data-p]', body).hidden = !fs.length; };
    const poe = l => { const novos = [...l].filter(f => /^image\//.test(f.type) || /\.(png|webp|gif|jpe?g|svg)$/i.test(f.name)); for (const f of novos) if (Pastas.ehRefNome(f._parte) || Pastas.ehRefNome(f._pasta) || Pastas.ehRefNome(f.name.replace(/\.[^.]+$/, ''))) Pastas.virarRef(f, true); fs = fs.concat(novos); pintaL(); };
    drop.onclick = async ev => { const l = await Pastas.escolherDe(ev, () => pickFiles('image/png,image/webp,image/gif,image/jpeg,' + VETOR, true)); if (l) poe(l); };
    drop.ondragover = e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); drop.classList.add('drop-dentro'); } }; drop.ondragleave = () => drop.classList.remove('drop-dentro');
    drop.ondrop = e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('drop-dentro'); Pastas.deDrop(e.dataTransfer).then(poe); };
    pintaL(); setTimeout(() => $('[data-n]', body).focus(), 60);
    const pega = a => { const n = $('[data-n]', a.body).value.trim(); if (!n) { $('[data-n]', a.body).focus(); UI.toast('Dê um nome ao personagem'); return false; } return n; };
    const r = await UI.modal({ title: 'Personagem novo', icon: 'layers', width: 560, body, buttons: [
      { label: 'Cancelar', value: null, left: true },
      { label: 'Pular (só o nome)', onClick: a => { const n = pega(a); return n ? { nome: n, fs: [], ia: false, vtipo: $('[data-vt]', a.body).value, vnome: $('[data-vt]', a.body).dataset.nome } : false; } },
      { label: 'Criar', kind: 'primary', onClick: a => { const n = pega(a); return n ? { nome: n, fs, raiz, ia: ia.checked && !!fs.length, pedido: $('[data-p]', a.body).value.trim(), vtipo: $('[data-vt]', a.body).value, vnome: $('[data-vt]', a.body).dataset.nome } : false; } }] });
    urls.forEach(u => setTimeout(() => URL.revokeObjectURL(u), 2000)); return r;
  },
  // a parte que a pessoa marcou como raiz na tela do personagem novo (pasta → a parte dela; imagem solta → a parte com o nome dela)
  raizDoNovo(novo) {
    const r = novo.raiz; if (!r) return null; const nome = r.parte || r.arquivo?.name.replace(/\.[^.]+$/, '').slice(0, 40); if (!nome) return null;
    const p = this.def.partes.find(x => Pastas.nrm(x.nome) === Pastas.nrm(nome)) || (r.arquivo && this.def.partes.find(x => Pastas.nrm(x.nome).startsWith(Pastas.nrm(nome)))); if (!p) return null;
    if (this.def.raiz !== p.id) { if (p.pai) this.porNoPai(p.id, null, { semCommit: true }); this.def.raiz = p.id; this.sel = p.id; this.commit(); } return p;
  },
  async montarNovo(novo) {
    // com a IA: a tela fica bloqueada do começo ao fim (pôr as imagens, aparar e organizar)
    let fim = () => { };
    try {
      // folhas de peças / fundo / tamanho: pergunta ANTES (e antes da IA começar)
      const refs = novo.fs.filter(f => f._ref), pr = await this.prepararFolhas(novo.fs.filter(f => !f._ref), false); if (!pr) return; pr.fs = [...refs, ...pr.fs]; // a referência não passa pela separação de folhas e fica atrás de tudo
      if (pr.separou.length) novo.pedido = [novo.pedido, 'Algumas imagens vieram de folhas separadas automaticamente: ' + pr.separou.map(f => `"${f.nome} 1..${f.n}" (${f.modo === 'versoes' ? 'versões da mesma peça, cada uma aparada e no centro: junte as do mesmo tipo numa parte só; numa folha de duas fileiras, a de baixo costuma ser o lado de trás' : 'corpo desmontado: cada peça está no lugar em que estava na folha'})`).join('; ')].filter(Boolean).join('\n');
      const nomesP = [...new Set(pr.fs.map(f => f._parte).filter(Boolean))]; if (nomesP.length) novo.pedido = [novo.pedido, `As imagens vieram em PASTAS e cada pasta já é UMA parte (${nomesP.map(n => `"${n}"`).join(', ')}). Mantenha essas partes com esses nomes (pode só arrumar acento/maiúscula), NÃO junte partes diferentes e NÃO separe as imagens de uma pasta.`].filter(Boolean).join('\n');
      if (novo.ia) fim = Ocupado.inicio({ tipo: 'novo', titulo: `A IA está montando "${novo.nome}"`, est: 75, subtitulo: 'Pondo as imagens…' });
      await this.addImagens(pr.fs, true, null, { semFolhas: true, montado: pr.montado }); // cada imagem vira uma parte (camadas do mesmo tamanho já ficam no lugar)
      const t = novo.ia ? { remove() { } } : UI.toast('<span class="spin-dot"></span> Aparando as sobras transparentes…', { time: 120000 }); if (novo.ia) Ocupado.passo('Aparando as sobras transparentes…');
      try { await Pintura.apararLista(this.def.partes.flatMap(p => p.imgs)); } catch { } t.remove(); this.commit(); this.enquadrar();
      const rzP = this.raizDoNovo(novo); if (rzP) novo.pedido = [novo.pedido, `A RAIZ é "${rzP.nome}" (escolhida pela pessoa): não mude.`].filter(Boolean).join('\n');
      if (novo.ia) await this.iaOrganizar('organizar', novo.pedido || '');
      // com referência: põe as peças no lugar dela (a IA já fez isso ao organizar) e deixa a referência invisível
      const rfP = refs.length && this.def.partes.find(p => Referencia.ehRef(p));
      if (rfP) { if (!novo.ia) { try { await Referencia.aplicar(this, { quieto: true, ia: false }); } catch { } } const rf = this.def.partes.find(p => Referencia.ehRef(p)); if (rf) { rf.base.vis = false; this.commit(); } }
      if (rzP && this.def.partes.includes(rzP) && this.def.raiz !== rzP.id) { if (rzP.pai) this.porNoPai(rzP.id, null, { semCommit: true }); this.def.raiz = rzP.id; this.sel = rzP.id; this.commit(); } // a escolha da pessoa vale mais que a da IA
    } finally { fim(); }
  },
  async sair() {
    if (AoVivo.ad?.ctx === 'atelie') await AoVivo.sair();
    // nada se perde ao sair: guarda já neste computador e, se o personagem é da nuvem, manda o que falta
    await this.guardarLocalJa();
    if (this.naNuvem && this.sujo) { const t = UI.toast('<span class="spin-dot"></span> Mandando as últimas mudanças para a nuvem…', { time: 60000 }); await this.sincronizar(true); t.remove();
      if (this.sujo && !(await UI.confirm({ title: 'Não foi para a nuvem', msg: 'As últimas mudanças ficaram guardadas <b>só neste computador</b> (' + esc(this.erroNuvem || 'sem conexão') + '). Ao abrir de novo aqui, elas vão para a nuvem.', ok: 'Sair mesmo assim', danger: true }))) return; }
    if (this.emAba) { this.sujo = false; window.close(); setTimeout(() => { if (!window.closed) { history.replaceState(null, '', location.pathname); this.emAba = false; Telas.mostra('home'); Home.aba('personagens'); } }, 300); return; }
    if (this.volta && App.P) { Telas.mostra('editor'); App.titulo(); App.atualiza(); } else { Telas.mostra('home'); Home.aba('personagens'); }
  },
  commit(o = {}) { const s = JSON.stringify(this.def); if (s !== this.ultimo) { this.pilha.push(this.ultimo); if (this.pilha.length > 120) this.pilha.shift(); this.refazer = []; this.ultimo = s; this.sujo = true; this.rascunho(); } if (!o.soDesenho) this.pinta(); else this.desenha(); },
  // Ctrl+Z logo depois de riscar: o traço ainda está sendo gravado (imagem grande demora). Espera ele entrar no histórico e SÓ DEPOIS desfaz —
  // antes o Ctrl+Z desfazia a mudança de antes e o traço chegava depois (parecia que "voltava o risco" e não saía mais). Um de cada vez.
  desfazJa(refaz) { const vez = (this._filaZ || Promise.resolve()).then(async () => { if (Pintura._gravando) await Pintura._gravando; await new Promise(r => setTimeout(r, 0)); refaz ? this.redo() : this.undo(); }).catch(() => { }); this._filaZ = vez; return vez; },
  undo() { if (!this.pilha.length) return; this.refazer.push(this.ultimo); this.ultimo = this.pilha.pop(); this.def = this.naMinhaVista(JSON.parse(this.ultimo)); this.ultimo = JSON.stringify(this.def); this.sujo = true; this.rascunho(); this.pinta(); },
  redo() { if (!this.refazer.length) return; this.pilha.push(this.ultimo); this.ultimo = this.refazer.pop(); this.def = this.naMinhaVista(JSON.parse(this.ultimo)); this.ultimo = JSON.stringify(this.def); this.sujo = true; this.rascunho(); this.pinta(); },
  // Ctrl+Z não troca a vista que está na tela (trocar de vista não é mudança): a de agora continua ativa se ainda existir
  naMinhaVista(d) { const v = this.def?.vistaAtual; if (v && d.vistaAtual !== v && d.vistas?.some(x => x.id === v)) Modelo.ativaVista(d, v); return d; },

  /* ---------- RASCUNHO: toda mudança fica guardada NESTE navegador (se cair a energia, nada se perde). Só "Salvar na nuvem" manda para a equipe.
     Guardado em arquivos["rascunho:<id do personagem>"] = { def, em, thumb }. As imagens novas já ficam no navegador (Arq). ---------- */
  chaveRascunho(id = this.def?.id) { return 'rascunho:' + id; },
  rascunho() {
    if (!this.def) return; this.salvandoLocal = true; this.pintaEstado(); clearTimeout(this._tr);
    this._tr = setTimeout(async () => { try { const def = JSON.parse(this.ultimo || JSON.stringify(this.def)); let thumb = null; try { thumb = this.miniatura(); } catch { }
      await DB.put('arquivos', { tipo: 'rascunho-atelie', def, em: Date.now(), thumb, nuvem: !!this.naNuvem }, this.chaveRascunho(def.id)); this.rascunhoEm = Date.now(); } catch (e) { UI.toast('Não consegui guardar no navegador: ' + esc(e.message), { kind: 'err' }); }
      this.salvandoLocal = false; this.pintaEstado(); window.EstudioConta?.espaco?.atualizar?.(); if (this.naNuvem) this.agendaNuvem(); }, 500);
  },
  // guarda já (sem esperar) neste computador
  async guardarLocalJa() {
    if (!this.def || (!this.sujo && !this.salvandoLocal)) return; clearTimeout(this._tr);
    try { const def = JSON.parse(this.ultimo || JSON.stringify(this.def)); let thumb = null; try { thumb = this.miniatura(); } catch { }
      await DB.put('arquivos', { tipo: 'rascunho-atelie', def, em: Date.now(), thumb, nuvem: !!this.naNuvem }, this.chaveRascunho(def.id)); this.rascunhoEm = Date.now(); return true; }
    catch (e) { UI.toast('Não consegui guardar no navegador: ' + esc(e.message), { kind: 'err' }); return false; }
    finally { this.salvandoLocal = false; this.pintaEstado(); window.EstudioConta?.espaco?.atualizar?.(); }
  },
  /* ---------- ENVIO AUTOMÁTICO para a nuvem (só personagens que já foram para a nuvem uma vez) ---------- */
  agendaNuvem() { clearTimeout(this._tn); this._tn = setTimeout(() => this.sincronizar(), 4000); this.pintaEstado(); },
  async sincronizar(agora) {
    clearTimeout(this._tn); if (!this.naNuvem || !this.def) return;
    if (this.enviando) { this.denovo = true; if (agora) await this.enviando; return; }
    const snap = this.ultimo || JSON.stringify(this.def), def = JSON.parse(snap); if (!def.partes.length) return;
    this.erroNuvem = null; this.pintaEstado();
    this.enviando = (async () => {
      try { try { def.thumb = this.miniatura(); } catch { }
        if (def.iaPlano?.resumo) { try { const c = IA.correcoes(def.iaPlano.resumo, IA.resumo(def)); def.iaCorrecoes = [...new Set([...(def.iaCorrecoes || []), ...c])].slice(-40); } catch { } }
        await Icone.prepara(def); await Nuvem.salvar(def); this.aplicaTroca(Nuvem.ultimaTroca); const snapR = Nuvem.remapear(snap, Nuvem.ultimaTroca);
        if ((this.ultimo || JSON.stringify(this.def)) === snapR) { this.sujo = false; await DB.del('arquivos', this.chaveRascunho(def.id)).catch(() => { }); this.rascunhoEm = null; }
        if (this.def?.id === def.id) { this.def.modificado = def.modificado; this.def.autor = def.autor; this.def.edicoes = def.edicoes; this.def.thumb = def.thumb; }
        this.baseNuvem = snapR; if (this.base0 === snapR || !this.sujo) this.base0 = snapR; this.avisaAnimador(def, false); this.pinta();
      } catch (e) { this.erroNuvem = e.message || 'sem conexão'; }
    })();
    await this.enviando; this.enviando = null; this.pintaEstado(); $('#at-salvar') && this.pintaBotaoNuvem();
    if (this.denovo) { this.denovo = false; if (this.sujo) return this.sincronizar(agora); }
  },
  // depois de ir para a nuvem em webp: as chaves das imagens mudam também aqui (sem virar uma mudança nova)
  aplicaTroca(troca) {
    if (!troca || !Object.keys(troca).length || !this.def) return; const R = t => Nuvem.remapear(t, troca);
    for (const p of Modelo.todasPartes(this.def)) for (const i of p.imgs) if (troca[i.k]) i.k = troca[i.k]; if (this.def.vis?.fantasma?.k && troca[this.def.vis.fantasma.k]) this.def.vis.fantasma.k = troca[this.def.vis.fantasma.k];
    this.ultimo = R(this.ultimo); this.base0 = R(this.base0); this.baseNuvem = R(this.baseNuvem); this.pilha = this.pilha.map(R); this.refazer = this.refazer.map(R); this._corImg?.clear?.();
  },
  // manda o personagem para a animação aberta (nesta aba ou em outra). local = salvo só neste computador: leva a lista do que não está na nuvem
  avisaAnimador(def, local) {
    const c = clone(def); delete c._local;
    if (local) { const L = this.local(); c._local = { em: Date.now(), todo: !!L.todo, presets: [...L.presets], partes: [...L.partes] }; }
    Icone.prepara(c).then(() => { // ícone (cabeça) e cor automáticos vão prontos para a hierarquia do editor
      if (App.P?.personagens?.[c.id] && !this.emAba) { App.P.personagens[c.id] = clone(c); App.commit('Personagem atualizado'); }
      try { (this._canal ||= new BroadcastChannel('animador')).postMessage({ tipo: 'personagem', def: c }); } catch { } });
  },
  // Ctrl+S: guarda neste computador (NÃO manda para a nuvem; só o botão da nuvem manda — ou sozinho, se ele já está lá)
  async salvarLocal() {
    if (!this.def) return; const ok = await this.guardarLocalJa(); if (ok === false) return;
    this.base0 = this.ultimo; this.pinta(); this.avisaAnimador(JSON.parse(this.ultimo), !this.naNuvem); // salvo aqui: sai o laranja e a animação aberta recebe já
    if (this.naNuvem) { UI.toast(`<b>${esc(this.def.nome)}</b> guardado neste computador e indo para a nuvem.`, { kind: 'ok' }); this.sincronizar(); }
    else UI.toast(`<b>${esc(this.def.nome)}</b> guardado <b>neste computador</b>. Para a equipe ver, clique na nuvem (Salvar na nuvem).`, { kind: 'ok', time: 5000 });
    await this.avisoLocais();
  },
  // aviso de quantos personagens do Ateliê estão só neste computador (aparece sempre que salva)
  async avisoLocais() {
    const rs = (await this.rascunhos()).filter(r => !r.nuvem && !(this.naNuvem && r.def.id === this.def?.id)); if (!rs.length) return;
    const atualLocal = !this.naNuvem && rs.some(r => r.def.id === this.def?.id), n = rs.length;
    const body = h(`<div><div>${n === 1 ? 'Este personagem do Ateliê' : `Estes ${n} personagens do Ateliê`} ainda <b>não ${n === 1 ? 'está' : 'estão'} na nuvem</b>: ${n === 1 ? 'fica' : 'ficam'} só neste computador. A equipe não vê, e se este navegador for limpo ${n === 1 ? 'ele some' : 'eles somem'}.</div>
      <div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(96px,1fr));margin-top:12px">${rs.slice(0, 24).map(r => `<div class="pc"><div class="th" style="aspect-ratio:1;${r.thumb ? `background-image:url('${r.thumb}')` : ''}">${r.thumb ? '' : ic('layers', 20)}</div><div class="in"><b>${esc(r.def.nome)}</b></div></div>`).join('')}</div>
      <div style="margin-top:10px;color:var(--tx3);font-size:12.5px">Para mandar um deles: abra no Ateliê e clique em <b>Salvar na nuvem</b> (o botão com a nuvem). Depois disso, toda mudança vai sozinha.</div></div>`);
    const r = await UI.modal({ title: `${n} ${n === 1 ? 'personagem não está' : 'personagens não estão'} na nuvem`, icon: 'cloud', width: 520, body,
      buttons: [...(atualLocal ? [{ label: 'Salvar este na nuvem', kind: 'primary', value: 'nuvem' }] : []), { label: 'Ok', value: null, ...(atualLocal ? {} : { kind: 'primary' }) }] });
    if (r === 'nuvem') this.salvar({ semAviso: true });
  },
  pintaBotaoNuvem() {
    const b = $('#at-salvar'); if (!b) return;
    const txt = !this.naNuvem ? 'Salvar na nuvem' : this.enviando ? 'Enviando…' : this.sujo ? 'Enviar agora' : 'Salvo na nuvem'; // salvo: o selo do lado some e o botão já diz
    b.innerHTML = `${ic('cloud', 15)} ${txt}`; b.classList.toggle('primary', !this.naNuvem || !!this.sujo); b.classList.toggle('salvo-nuvem', !!this.naNuvem && !this.sujo && !this.enviando);
    b.title = this.naNuvem ? 'Este personagem está na nuvem da equipe: as mudanças vão sozinhas (clique para mandar agora).' : 'Salvar na nuvem da equipe (Ctrl+S guarda só neste computador)';
  },
  async apagarRascunho(id = this.def?.id) { clearTimeout(this._tr); this.salvandoLocal = false; this.rascunhoEm = null; try { await DB.del('arquivos', this.chaveRascunho(id)); } catch { } },
  async rascunhos() { try { const ks = (await DB.keys('arquivos')).filter(k => String(k).startsWith('rascunho:')); return (await Promise.all(ks.map(k => DB.get('arquivos', k)))).filter(r => r?.def).sort((a, b) => b.em - a.em); } catch { return []; } },
  // selo ao lado do Salvar: salvo na nuvem / só neste computador
  pintaEstado() {
    const el = $('#at-estado'); if (!el || !this.def) return; const hora = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const [cls, ico, txt, dica] = this.naNuvem ? (
        this.enviando ? ['nuvem', 'cloud', 'Enviando para a nuvem…', 'As mudanças estão indo para a nuvem da equipe.']
      : this.erroNuvem && this.sujo ? ['local', 'alert', 'Não foi para a nuvem', 'Ficou guardado neste computador. Tenta de novo sozinho na próxima mudança, ou clique em "Enviar agora". (' + this.erroNuvem + ')']
      : this.sujo ? ['nuvem', 'cloud', 'Mudanças indo para a nuvem…', 'Este personagem está na nuvem: as mudanças vão sozinhas em poucos segundos.']
      : ['nuvem', 'cloud', 'Salvo na nuvem', 'Esta versão é a que está na nuvem da equipe; as próximas mudanças vão sozinhas.'])
      : this.salvandoLocal ? ['local', 'save', 'Guardando no computador…', 'Guardando neste navegador para não perder nada.']
      : ['local', 'save', 'Só neste computador' + (this.rascunhoEm ? ' · ' + hora(this.rascunhoEm) : ''), 'Personagem LOCAL: guardado neste navegador (Ctrl+S), a equipe ainda não vê. Clique na nuvem (Salvar na nuvem) para mandar; depois disso as mudanças vão sozinhas.'];
    el.className = 'at-estado ' + cls; el.title = dica; el.innerHTML = `${ic(ico, 13)}<span>${esc(txt)}</span>`;
    el.hidden = !!this.naNuvem && !this.enviando && !this.sujo; this.pintaBotaoNuvem(); // salvo na nuvem: só o botão mostra (economiza espaço)
  },

  /* ---------- estado que está na tela (base ou preset em edição) ---------- */
  parte(id = this.sel) { return this.def.partes.find(p => p.id === id) || null; },
  // partes marcadas: a escolhida + as do Ctrl/Shift+clique
  selecionadas() { return [...new Set([this.sel, ...this.multi])].map(id => this.parte(id)).filter(Boolean); },
  escolhe(id) { this.sel = id; this.multi.clear(); this.focoImg = null; },
  sessao() { return this.edit ? this.def.sessoes.find(s => s.id === this.edit.s) : null; },
  preset() { const s = this.sessao(); return s ? s.presets.find(p => p.id === this.edit.p) : null; },
  estado() {
    if (this.edit && !this.editPasso && !Animacoes.mexivel) return Modelo.partesNoEstado(this.def, { sessoes: { [this.edit.s]: this.edit.p } }); // arrumando um preset (mesmo com o painel aberto)
    if (this.teste && Animacoes.mexivel) return Modelo.partesNoEstado(this.def, Animacoes.frameAtual()); // pausado / pose do editor: o quadro inteiro (as edições caem no passo ou preset certo)
    return Modelo.partesNoEstado(this.def, this.teste ? this.teste : this.edit ? { sessoes: { [this.edit.s]: this.edit.p } } : {});
  },
  // muda um campo da parte no modo atual (base ou o preset em edição)
  mudar(pid, vals) {
    const p = this.parte(pid); if (!p) return; if (!this.editPasso && Animacoes.passoAtual()) Animacoes.alvoPausa(pid); // passo parado: vale só nele
    const ps = this.editPasso && Animacoes.passoEditado(); if (ps) { for (const q of [ps, ...Animacoes.outrosEscolhidos(ps)]) { q.p = q.p || {}; q.p[pid] = { ...(q.p[pid] || {}), ...vals }; } return; } // passo de uma animação de teste (pausada); com vários frames escolhidos, vale em todos
    const pr = this.preset();
    if (pr) { const s = this.sessao(); if (s.partes?.length && !s.partes.includes(pid)) { s.partes.push(pid); } pr.estado[pid] = { ...(pr.estado[pid] || {}), ...vals }; }
    else Object.assign(p.base, vals);
  },
  // "Mover todos": o botão de cima liga para TODAS as partes (modoMover = 'todos'); o botão direito numa parte liga só para ela (todosSo)
  todosSo: new Set(),
  modoDe(pid) { return pid && this.todosSo.has(pid) ? 'todos' : this.modoMover; },
  get moverTodos() { return this.modoDe(this.sel) === 'todos'; },
  matParte(pid, est = this.estado()) { const it = Modelo.montar(this.def, est).find(x => x.parte.id === pid); return it ? it.mp || it.m : new DOMMatrix(); },
  matPai(pid, est = this.estado()) { const p = this.parte(pid); return p?.pai ? this.matParte(p.pai, est) : new DOMMatrix(); },

  /* ---------- tela ---------- */
  liga() {
    if (this._ligado) return; this._ligado = true;
    this.cv = $('#at-cv'); this.ctx = this.cv.getContext('2d'); new ResizeObserver(() => this.tamanho()).observe(this.cv.parentElement); this.tamanho();
    this.cv.addEventListener('pointerdown', e => { const a = document.activeElement; if (a && a !== document.body && a.matches?.('select,button,input:not([type=text]):not([type=number]):not([type=search])')) a.blur(); this.desce(e); }); // clicar no palco tira o foco do que estava escolhido (os atalhos voltam a valer) this.cv.addEventListener('contextmenu', e => { e.preventDefault(); if (!this._panMexeu) { if (this.teste && Animacoes.rodando && this.acha(this.mundo(e))) Animacoes.pausar(true); this.menuPalco(e); } this._panMexeu = false; }); // botão direito sem arrastar (também com o Testar aberto; tocando, pausa naquele passo): menu da peça
    this.cv.addEventListener('wheel', e => this.roda(e), { passive: false }); // rodinha do mouse: zoom no ponto do mouse
    $('#at-voltar').onclick = () => this.sair(); $('#at-voltar').hidden = true; { const br = $('#atelie header .brand'); if (br) { br.style.cursor = 'pointer'; br.title = 'Sair do Ateliê (volta ao início)'; br.onclick = () => this.sair(); } } // sem o botão Voltar no topo (decisão do dono): o nome ATELIÊ leva de volta $('#at-salvar').onclick = () => this.naNuvem ? this.sincronizar(true) : this.salvar(); $('#at-undo').onclick = () => this.undo(); $('#at-redo').onclick = () => this.redo();
    $('#at-nome').onchange = e => { this.def.nome = e.target.value.trim() || this.def.nome; this.commit(); };
    $('#at-pasta').onchange = e => { this.def.pasta = e.target.value.trim() || 'Personagens'; this.commit(); if (this.naNuvem) PastasBib.mover('nuvem', [this.def.id], this.def.pasta).catch(() => { }); }; // a pasta da biblioteca da equipe também (personagens/pastas.json)
    $('#at-add-parte').onclick = () => this.novaParte(); $('#at-add-img').onclick = () => this.addImagens(); $('#at-add-pasta').onclick = () => { const p = this.parte(); if (p) this.novaPastaImg(p); else UI.toast('Escolha uma parte primeiro'); };
    // soltar imagens no palco do ateliê: entram na parte escolhida (sem parte escolhida, cada uma vira uma parte)
    const cvA = $('#at-cv'); cvA.ondragover = ev => { if (ev.dataTransfer.types.includes('Files')) ev.preventDefault(); }; cvA.ondrop = ev => { if (ev.dataTransfer.files?.length) { ev.preventDefault(); Pastas.deDrop(ev.dataTransfer).then(l => this.soltouNoPalco(l)); } }; // pastas viram partes; editando uma imagem, pergunta se vai DENTRO dela (camada)
    $$('#at-abas [data-aba]').forEach(b => b.onclick = () => { this.aba = b.dataset.aba; this.pinta(); });
    $('#at-base').onclick = () => { this.edit = null; this.pinta(); };
    $('#at-mover').onchange = e => this.setModo(e.target.value);
    $('#at-enq').onclick = () => this.enquadrar(); $('#at-regua').onclick = () => this.trocaRegua(); this.pintaRegua(); this.cv.addEventListener('pointerup', () => { if (this.guias) { this.guias = null; this.desenha(); } }); $('#at-ref').onclick = () => Referencia.aplicar(this); $('#at-ref').innerHTML = ic('magnet', 15); $('#at-enq').innerHTML = ic('frame', 15); $('#at-ed-ok').onclick = () => this.fecharEditor(); $('#at-ed-ok').innerHTML = `${ic('check', 13)} Salvar`; $('#at-ed-ok').title = 'Guarda o que mudou nesta imagem e volta ao Ateliê (Esc)'; $('#at-ed-ok').classList.add('ed-salvar'); { const bv = h(`<button class="btn sm ed-voltar" id="at-ed-voltar" hidden title="Fecha o editor SEM guardar o que mudou nesta imagem desde que abriu">${ic('x', 13)} Voltar</button>`); $('#at-ed-ok').before(bv); bv.onclick = () => this.voltarEditor(); } this.cv.addEventListener('dblclick', e => { if (this.edImg || Pintura.ferr !== 'mover') return; const it = this.acha(this.mundo(e)); if (it?.img) this.abrirEditor(it.parte, it.img); }); /* dois cliques numa peça: edita a imagem dela */
    $('#at-ia').innerHTML = `${ic('sparkles', 15)}<span>IA</span>`; $('#at-ia').onclick = () => this.ia();
    addEventListener('keydown', e => this.teclas(e));
    Pintura.liga(); Divisores.liga(); Paineis.liga(); // bordas dos painéis e da timeline: arrastar muda o tamanho
  },
  tamanho() { const r = this.cv.getBoundingClientRect(), d = devicePixelRatio || 1; this.cv.width = Math.max(2, r.width * d); this.cv.height = Math.max(2, r.height * d); this.desenha(); },
  enquadrar() {
    if (!this.cv) return; const r = this.cv.getBoundingClientRect(), itE = this.edImg && this.itemEditor(), b = itE ? (c => ({ x: c.x0, y: c.y0, w: c.x1 - c.x0, h: c.y1 - c.y0 }))(this.caixaItem(itE)) : Modelo.caixaPersonagem(this.def, this.estado()), W = Math.max(200, r.width); // a timeline embaixo não cobre o personagem; no editor de imagem, enquadra só a imagem
    const topo = itE ? 120 : 0, Hl = Math.max(150, r.height - topo), z = Math.min(W / (b.w + 200), Hl / (b.h + 200), 2.5); // no editor, a barra de opções da ferramenta fica em cima
    this.vista = { z, x: W / 2 - (b.x + b.w / 2) * z, y: topo + Hl / 2 - (b.y + b.h / 2) * z }; this.desenha();
  },
  V() { const d = devicePixelRatio || 1, v = this.vista; return new DOMMatrix().scale(d).translate(v.x, v.y).scale(v.z); },
  mundo(e) { const r = this.cv.getBoundingClientRect(), v = this.vista; return { x: (e.clientX - r.left - v.x) / v.z, y: (e.clientY - r.top - v.y) / v.z }; },
  desenha() {
    if (!this.ctx || !this.def) return; const ctx = this.ctx, W = this.cv.width, H = this.cv.height, d = devicePixelRatio || 1, V = this.V();
    ctx.setTransform(1, 0, 0, 1, 0, 0); const fundo = Animacoes.corFundo();
    if (fundo === 'cenario') { const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#9fd3f0'); gr.addColorStop(.62, '#9fd3f0'); gr.addColorStop(.62, '#8cc56b'); gr.addColorStop(1, '#8cc56b'); ctx.fillStyle = gr; } else ctx.fillStyle = fundo || '#151515';
    ctx.fillRect(0, 0, W, H);
    // grade xadrez (fundo transparente)
    ctx.save(); ctx.setTransform(V); const g = 50; ctx.fillStyle = '#1b1b1b'; const a = this.mundoTela(0, 0), b2 = this.mundoTela(W / d, H / d);
    if (!fundo) for (let x = Math.floor(a.x / g) * g; x < b2.x; x += g) for (let y = Math.floor(a.y / g) * g; y < b2.y; y += g) if (((x + y) / g) % 2 === 0) ctx.fillRect(x, y, g, g);
    ctx.strokeStyle = fundo ? 'rgba(0,0,0,.1)' : '#2c2c2c'; ctx.lineWidth = 1 / this.vista.z; ctx.beginPath(); ctx.moveTo(-5000, 0); ctx.lineTo(5000, 0); ctx.moveTo(0, -5000); ctx.lineTo(0, 5000); ctx.stroke(); ctx.restore();
    if (this.edImg) { const it = this.itemEditor(); // EDITOR DE IMAGEM: só a imagem que está sendo editada (com o apagado do keyframe, se houver)
      // "Mostrar o resto": as outras partes em volta, meio apagadas, na profundidade/frame de agora (o estado da tela); a editada no lugar dela
      const resto = this.mostraResto && it ? Modelo.montar(this.def, this.estado()) : null, desenhaOutra = o => { if (!o.img || o.parte.id === it.parte.id) return; const b = Arq.comAp(Arq.bitmap(o.img.k, () => this.desenha()), o, () => this.desenha()); if (!b) return; const ox = o.img.pivo?.x ?? o.img.w / 2, oy = o.img.pivo?.y ?? o.img.h / 2; ctx.save(); ctx.setTransform(V.multiply(o.m)); ctx.globalAlpha = (this.opResto ?? 45) / 100; ctx.drawImage(b, -ox + (o.img.ajuste?.x || 0), -oy + (o.img.ajuste?.y || 0), o.img.w, o.img.h); ctx.restore(); };
      const zEd = resto ? (resto.find(o => o.parte.id === it.parte.id)?.z ?? 0) : 0; if (resto) for (const o of resto) if (o.z <= zEd && o.parte.id !== it.parte.id) desenhaOutra(o);
      if (it) { const bm = Arq.comAp(Arq.bitmap(it.img.k, () => this.desenha()), it, () => this.desenha()); if (bm) { const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2; ctx.save(); ctx.setTransform(V.multiply(it.m)); ctx.drawImage(bm, -px + (it.img.ajuste?.x || 0), -py + (it.img.ajuste?.y || 0), it.img.w, it.img.h);
        ctx.strokeStyle = 'rgba(120,170,255,.55)'; ctx.lineWidth = 1 / this.vista.z; ctx.setLineDash([4 / this.vista.z, 3 / this.vista.z]); ctx.strokeRect(-px + (it.img.ajuste?.x || 0), -py + (it.img.ajuste?.y || 0), it.img.w, it.img.h); ctx.restore(); } }
      if (resto) for (const o of resto) if (o.z > zEd) desenhaOutra(o); // as da frente por cima
      Pintura.desenhaCursor(ctx); AoVivo.desenha(ctx, V, d); return; }
    const est = this.estado(), itens = Modelo.montar(this.def, est), roxo = this.partesTodas();
    for (const it of itens) { if (!it.img) continue; const bm = Arq.comAp(Arq.bitmap(it.img.k, () => this.desenha()), it, () => this.desenha()); if (!bm) continue; /* comAp: o que foi apagado só neste keyframe */ const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2;
      ctx.save(); ctx.setTransform(V.multiply(it.m)); ctx.globalAlpha = this.sel && it.parte.id !== this.sel && this.destacar ? .45 : 1; ctx.drawImage(bm, -px + (it.img.ajuste?.x || 0), -py + (it.img.ajuste?.y || 0), it.img.w, it.img.h);
      if (roxo.has(it.parte.id)) ctx.drawImage(this.tingido(bm, it.img.k + (it.ap?.k || '')), -px + (it.img.ajuste?.x || 0), -py + (it.img.ajuste?.y || 0), it.img.w, it.img.h); // MOVER TODOS: roxo meio transparente em tudo que vai junto
      ctx.restore(); }
    ctx.save(); ctx.setTransform(V); Animacoes.desenhaFantasma(ctx); ctx.restore();
    // parte escolhida: só a caixa tracejada (numa cor que contrasta com a peça) e uma cruzinha discreta no centro.
    // O pivô (ponto de giro) só aparece segurando Alt (Alt+arrastar muda o pivô); a alça com seta circular (ou Ctrl+arrastar) gira a peça.
    const it = itens.find(x => x.parte.id === this.sel); this._giro = null; // a caixa aparece até com a animação tocando (acompanha a peça)
    if (it?.img) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); const T = V.multiply(it.m), px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2, ax = it.img.ajuste?.x || 0, ay = it.img.ajuste?.y || 0;
      const c = [[0, 0], [it.img.w, 0], [it.img.w, it.img.h], [0, it.img.h]].map(([x, y]) => T.transformPoint(new DOMPoint(x - px + ax, y - py + ay))), cor = this.corContraste(it.img);
      const caixa = () => { ctx.beginPath(); c.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); };
      ctx.lineWidth = 3 * d; ctx.strokeStyle = 'rgba(0,0,0,.35)'; caixa(); ctx.stroke(); // sombra fina para aparecer em qualquer fundo
      ctx.lineWidth = 1.6 * d; ctx.strokeStyle = cor; ctx.setLineDash([6 * d, 4 * d]); caixa(); ctx.stroke(); ctx.setLineDash([]);
      const cx = (c[0].x + c[2].x) / 2, cy = (c[0].y + c[2].y) / 2, r = 7 * d; ctx.globalAlpha = .45; ctx.strokeStyle = cor; ctx.lineWidth = 1.4 * d;
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke(); ctx.globalAlpha = 1;
      // alça de girar: ícone de seta circular, meio transparente, na mesma cor que contrasta com a peça
      { const mt = { x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2 }, piv = T.transformPoint(new DOMPoint(0, 0)), ux = mt.x - cx, uy = mt.y - cy, L = Math.hypot(ux, uy) || 1, gx = mt.x + ux / L * 26 * d, gy = mt.y + uy / L * 26 * d, R = 8 * d;
        this._giro = { x: gx, y: gy, piv };
        ctx.globalAlpha = .82; ctx.beginPath(); ctx.arc(gx, gy, 12 * d, 0, 7); ctx.fillStyle = 'rgba(20,20,20,.5)'; ctx.fill(); ctx.lineWidth = 1 * d; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.stroke();
        ctx.save(); const k = 14 * d / 24; ctx.translate(gx - 12 * k, gy - 12 * k); ctx.scale(k, k); ctx.strokeStyle = cor; ctx.lineWidth = 2.4; ctx.lineCap = ctx.lineJoin = 'round';
        ctx.stroke(new Path2D('M21 12a9 9 0 1 1-2.64-6.36L21 8')); ctx.stroke(new Path2D('M21 3v5h-5')); ctx.restore(); ctx.globalAlpha = 1; }
      if (this.alt) { const piv = T.transformPoint(new DOMPoint(0, 0)); ctx.globalAlpha = .8; ctx.beginPath(); ctx.arc(piv.x, piv.y, 5 * d, 0, 7); ctx.fillStyle = '#ff6b6b'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * d; ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.restore();
    }
    Pintura.desenhaCursor(ctx);
    // régua (em cima e à esquerda) e as guias de onde a peça grudou
    const itS = itens.find(x => x.parte.id === this.sel && x.img);
    Regua.desenha(ctx, V, W, H, d, { guias: this.guias, on: this.regua(), sel: itS ? this.caixaItem(itS) : null });
    AoVivo.desenha(ctx, V, d); // quem está junto: cursor com cor e nome
  },
  /* ---------- régua e ímã (como no editor): R liga/desliga; arrastando, a peça gruda nas bordas e no meio das outras e no centro (0,0); Ctrl segura para não grudar ---------- */
  regua() { if (this._regua == null) { try { this._regua = localStorage.getItem('animador-atelie-regua') !== '0'; } catch { this._regua = true; } } return this._regua; },
  trocaRegua() { this._regua = !this.regua(); try { localStorage.setItem('animador-atelie-regua', this._regua ? '1' : '0'); } catch { } this.pintaRegua(); UI.toast(this._regua ? 'Régua e ímã ligados (Ctrl segura para não grudar)' : 'Régua e ímã desligados'); this.desenha(); },
  pintaRegua() { const b = $('#at-regua'); if (b) { b.innerHTML = ic('ruler', 14); b.classList.toggle('on', this.regua()); } $('.at-palco')?.classList.toggle('com-regua', this.regua()); if (typeof Ima !== 'undefined') Ima.arruma(); },
  caixaItem(it) { const im = it.img, px = im.pivo?.x ?? im.w / 2, py = im.pivo?.y ?? im.h / 2, ax = im.ajuste?.x || 0, ay = im.ajuste?.y || 0; return Regua.caixa([[0, 0], [im.w, 0], [0, im.h], [im.w, im.h]].map(([x, y]) => it.m.transformPoint(new DOMPoint(x - px + ax, y - py + ay)))); },
  imaInicio(it) {
    if (!it?.img) return null; const fora = new Set([it.parte.id]); let mudou = true; while (mudou) { mudou = false; for (const q of this.def.partes) if (q.pai && fora.has(q.pai) && !fora.has(q.id)) { fora.add(q.id); mudou = true; } } // ela e as presas nela (vão junto)
    const alvos = Modelo.montar(this.def, this.estado()).filter(x => x.img && !fora.has(x.parte.id)).map(x => this.caixaItem(x));
    alvos.unshift({ x0: 0, x1: 0, y0: 0, y1: 0, cx: 0, cy: 0, cam: true }); // o centro do personagem (as linhas do 0)
    return { box: this.caixaItem(it), alvos };
  },
  imaPonto(ev, ima, w0) { const w = this.mundo(ev); if (!ima || ev.ctrlKey || ev.metaKey) { this.guias = null; return w; } const r = Regua.gruda(ima, w0, w, false, this.vista.z); this.guias = r.guias; return r.p; },
  // partes roxas: as que estão em "Mover todos" (a escolhida, se for para todas; ou as que ligaram só para elas)
  partesTodas() {
    const out = new Set(); if (!this.def) return out; // só a própria parte fica roxa (as presas nela vão junto, mas sem roxo)
    for (const id of this.todosSo) if (this.parte(id)) out.add(id);
    if (this.modoMover === 'todos') for (const id of [this.sel, ...this.multi]) if (id) out.add(id);
    return out;
  },
  _tinta: new Map(),
  tingido(bm, k) { // a mesma imagem toda roxa, meio transparente (só onde a peça tem tinta)
    let c = this._tinta.get(k); if (c && c._bm === bm) return c; const S = Math.min(1, 1024 / Math.max(bm.width, bm.height));
    c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bm.width * S)); c.height = Math.max(1, Math.round(bm.height * S)); const x = c.getContext('2d');
    x.drawImage(bm, 0, 0, c.width, c.height); x.globalCompositeOperation = 'source-in'; x.fillStyle = 'rgba(192,139,255,.42)'; x.fillRect(0, 0, c.width, c.height); c._bm = bm; this._tinta.set(k, c); return c;
  },
  _corImg: new Map(),
  corContraste(img) {
    const k = img.k; if (this._corImg.has(k)) return this._corImg.get(k); const bm = Arq.img.get(k); if (!bm) return '#3d8bff';
    const S = 32, c = new OffscreenCanvas(S, S).getContext('2d', { willReadFrequently: true }); c.drawImage(bm, 0, 0, S, S); const D = c.getImageData(0, 0, S, S).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < D.length; i += 4) if (D[i + 3] > 120) { r += D[i]; g += D[i + 1]; b += D[i + 2]; n++; } if (n) { r /= n; g /= n; b /= n; }
    const cand = [[47, 123, 255], [255, 47, 160], [22, 192, 96], [155, 92, 255], [0, 200, 255], [255, 138, 31]];
    const dist = q => Math.hypot((q[0] - r) * .9, (q[1] - g) * 1.2, (q[2] - b) * .8), best = cand.reduce((a, q) => dist(q) > dist(a) ? q : a);
    const cor = `rgb(${best.join(',')})`; this._corImg.set(k, cor); return cor;
  },
  mundoTela(x, y) { const v = this.vista; return { x: (x - v.x) / v.z, y: (y - v.y) / v.z }; },
  roda(e) { e.preventDefault(); const r = this.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, v = this.vista, z = clamp(v.z * Math.exp(-e.deltaY * .0015), .05, 20); v.x = mx - (mx - v.x) * z / v.z; v.y = my - (my - v.y) * z / v.z; v.z = z; this.desenha(); },
  // qual peça está embaixo do mouse (a da frente)
  acha(w) {
    const itens = Modelo.montar(this.def, this.estado()).filter(i => i.img).reverse();
    for (const it of itens) { const loc = it.m.inverse().transformPoint(new DOMPoint(w.x, w.y)), px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2, x = loc.x + px - (it.img.ajuste?.x || 0), y = loc.y + py - (it.img.ajuste?.y || 0);
      if (x >= 0 && y >= 0 && x <= it.img.w && y <= it.img.h) { const bm = Arq.comAp(Arq.img.get(it.img.k), it); if (!bm || this.opaco(bm, x * bm.width / it.img.w, y * bm.height / it.img.h)) return it; } }
    return null;
  },
  _alfa: new Map(),
  opaco(bm, x, y) { let c = this._alfa.get(bm); if (!c) { c = new OffscreenCanvas(bm.width, bm.height).getContext('2d', { willReadFrequently: true }); c.drawImage(bm, 0, 0); this._alfa.set(bm, c); } return c.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] > 20; },
  desce(e) {
    try { this.cv.setPointerCapture(e.pointerId); } catch { } const d = devicePixelRatio || 1;
    const fim = (mov, up) => { const m = ev => mov(ev), u = ev => { this.cv.removeEventListener('pointermove', m); this.cv.removeEventListener('pointerup', u); up?.(ev); }; this.cv.addEventListener('pointermove', m); this.cv.addEventListener('pointerup', u); };
    if (this.espaco) this._espUsou = true;
    if (e.button === 1 || e.button === 2 || this.espaco) { const v = this.vista, x0 = e.clientX, y0 = e.clientY, vx = v.x, vy = v.y; let mexeu = false;
      this._panMexeu = false; return fim(ev => { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 3) mexeu = this._panMexeu = true; v.x = vx + ev.clientX - x0; v.y = vy + ev.clientY - y0; this.desenha(); }); }
    // animação TOCANDO: clicar numa peça escolhe (sem parar); arrastar a peça ou pintar pausa sozinho naquele passo e segue como pausado
    if (this.teste && Animacoes.rodando && e.button === 0) {
      if (Pintura.ferr !== 'mover') { Animacoes.pausar(true); return Pintura.desce(e); }
      const it0 = this.acha(this.mundo(e)), v = this.vista, x0 = e.clientX, y0 = e.clientY, vx = v.x, vy = v.y;
      if (!it0) return fim(ev => { v.x = vx + ev.clientX - x0; v.y = vy + ev.clientY - y0; this.desenha(); }); // no vazio: move a tela
      if (it0.parte.id !== this.sel || this.multi.size) { this.escolhe(it0.parte.id); this.pinta(); }
      const mv = ev => { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 4) return; tira(); Animacoes.pausar(true); this.desce(e); }, tira = () => { this.cv.removeEventListener('pointermove', mv); this.cv.removeEventListener('pointerup', tira); };
      this.cv.addEventListener('pointermove', mv); this.cv.addEventListener('pointerup', tira); return;
    }
    if (e.button === 0 && Pintura.ferr !== 'mover') return Pintura.desce(e); // pincel, borracha, balde, conta-gotas
    if (this.edImg) { const v = this.vista, x0 = e.clientX, y0 = e.clientY, vx = v.x, vy = v.y; return fim(ev => { v.x = vx + ev.clientX - x0; v.y = vy + ev.clientY - y0; this.desenha(); }); } // editor de imagem: a mão só move a tela
    // girar: Ctrl+arrastar na peça escolhida (gira em volta do pivô)
    let pegaGiro = this._giro && Math.hypot(e.offsetX * d - this._giro.x, e.offsetY * d - this._giro.y) < 14 * d; // a alça de girar
    if (!pegaGiro && (e.ctrlKey || e.metaKey) && this.parte() && !this.teste) { const p = this.parte(), piv = this.V().multiply(this.matParte(p.id)).transformPoint(new DOMPoint(0, 0)); this._giro = { piv }; pegaGiro = true; }
    if (pegaGiro) {
      const g = this._giro; this._giro = null; const p = this.parte(), e0 = this.estado()[p.id], ang = ev => Math.atan2(ev.offsetY * d - g.piv.y, ev.offsetX * d - g.piv.x) * 180 / Math.PI, a0 = ang(e);
      return fim(ev => { let r = (e0.r || 0) + ang(ev) - a0; if (ev.shiftKey) r = Math.round(r / 15) * 15; this.mudar(p.id, { r: round(r, 1) }); this.desenha(); }, () => this.commit());
    }
    const w = this.mundo(e), it = this.acha(w);
    if (!it) { const v = this.vista, x0 = e.clientX, y0 = e.clientY, vx = v.x, vy = v.y; let mexeu = false; return fim(ev => { mexeu = true; v.x = vx + ev.clientX - x0; v.y = vy + ev.clientY - y0; this.desenha(); }, () => { if (!mexeu) { this.escolhe(null); this.pinta(); } }); }
    if (it.parte.id !== this.sel || this.multi.size || this.focoImg || this.teste) { this.escolhe(it.parte.id); if (this.teste) Animacoes.alvoPausa(it.parte.id); this.pinta(); }
    const p = it.parte, est = this.estado(), w0 = w, ima = this.regua() && !e.ctrlKey ? this.imaInicio(it) : null; // régua ligada: gruda nas outras peças e no centro
    if (e.altKey && it.img) { // pivô: muda o ponto de giro sem tirar a peça do lugar
      const img = it.img, inv = it.m.inverse(), l0 = inv.transformPoint(new DOMPoint(w0.x, w0.y)), piv0 = { ...(img.pivo || { x: img.w / 2, y: img.h / 2 }) }, enc0 = { ...p.encaixe }, filhos = this.def.partes.filter(f => f.pai === p.id).map(f => [f, { ...f.encaixe }]);
      return fim(ev => { const w2 = this.mundo(ev), l = inv.transformPoint(new DOMPoint(w2.x, w2.y)), dx = l.x - l0.x, dy = l.y - l0.y;
        img.pivo = { x: round(piv0.x + dx, 1), y: round(piv0.y + dy, 1) };
        const lin = it.m.multiply(new DOMMatrix().translate(0, 0)), pai = this.matPai(p.id, est).inverse(), a = pai.multiply(lin);
        const mv = new DOMPoint(dx, dy, 0, 0), dp = new DOMMatrix([a.a, a.b, a.c, a.d, 0, 0]).transformPoint(mv); // deslocamento no espaço do pai
        p.encaixe = { x: round(enc0.x + dp.x, 1), y: round(enc0.y + dp.y, 1) }; for (const [f, e0] of filhos) f.encaixe = { x: round(e0.x - dx, 1), y: round(e0.y - dy, 1) };
        this.desenha(); }, () => this.commit());
    }
    if (this.modoDe(p.id) === 'preset' && it.img) { // PADRÃO: esta imagem SÓ neste preset (ou só na base)
      const img = it.img, inv = (it.mp || it.m).inverse(), l0 = inv.transformPoint(new DOMPoint(w0.x, w0.y)), d0 = { ...(est[p.id]?.d?.[img.id] || { x: 0, y: 0 }) };
      return fim(ev => { const w2 = this.imaPonto(ev, ima, w0), l = inv.transformPoint(new DOMPoint(w2.x, w2.y)); let dx = l.x - l0.x, dy = l.y - l0.y; if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        this.poeD(p, img, { x: round(d0.x + dx, 1), y: round(d0.y + dy, 1) }); this.desenha(); }, () => this.commit());
    }
    if (this.modoDe(p.id) === 'imagem' && it.img) { // a mesma imagem em TODOS os presets (e na base)
      const img = it.img, inv = it.m.inverse(), l0 = inv.transformPoint(new DOMPoint(w0.x, w0.y)), aj0 = { ...(img.ajuste || { x: 0, y: 0 }) };
      return fim(ev => { const w2 = this.imaPonto(ev, ima, w0), l = inv.transformPoint(new DOMPoint(w2.x, w2.y)); let dx = l.x - l0.x, dy = l.y - l0.y; if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        img.ajuste = { x: round(aj0.x + dx, 1), y: round(aj0.y + dy, 1) }; this.desenha(); }, () => this.commit());
    }
    // MOVER TODOS: a parte inteira. Na Base muda o encaixe (onde ela fica no pai); num preset muda só o preset
    const inv = this.matPai(p.id, est).inverse(), a0 = inv.transformPoint(new DOMPoint(w0.x, w0.y)), e0 = { ...est[p.id] }, enc0 = { ...p.encaixe };
    fim(ev => { const w2 = this.imaPonto(ev, ima, w0), a = inv.transformPoint(new DOMPoint(w2.x, w2.y)); let dx = a.x - a0.x, dy = a.y - a0.y; if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      if (this.edit || this.editPasso) this.mudar(p.id, { x: round((e0.x || 0) + dx, 1), y: round((e0.y || 0) + dy, 1) }); else p.encaixe = { x: round(enc0.x + dx, 1), y: round(enc0.y + dy, 1) }; this.desenha(); }, () => this.commit());
  },
  teclas(e) {
    if ($('#atelie').classList.contains('hidden') || $('#modal-root').children.length) return;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey, p = this.parte();
    // um <select> (animação da timeline, tipo de pincel…) ou botão com foco não pode engolir os atalhos (Ctrl+Z não desfazia depois de escolher a animação)
    const campo = e.target.closest?.('input,textarea,select,[contenteditable]'), soEscolha = campo && (campo.tagName === 'SELECT' || ['range', 'checkbox', 'radio', 'button', 'color'].includes(campo.type));
    if (campo && !(soEscolha && (ctrl || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Home', 'End', 'PageUp', 'PageDown'].includes(k)))) return;
    if (soEscolha && e.type === 'keydown') campo.blur();
    if (k === ' ') { if (!e.repeat && !this.espaco) { this._espT = Date.now(); this._espUsou = false; } this.espaco = e.type === 'keydown'; e.preventDefault(); return; } // segurar = mover a tela; um toque = play/pause (no keyup)
    if (e.type === 'keydown' && (k === 'r' || k === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest?.('input,textarea,select,[contenteditable]')) { e.preventDefault(); return this.trocaRegua(); }
    if (ctrl && (k.toLowerCase() === 'z' || k.toLowerCase() === 'y')) { e.preventDefault(); if (e.repeat) return; return this.desfazJa(e.shiftKey || k.toLowerCase() === 'y'); }
    if (ctrl && k.toLowerCase() === 's') { e.preventDefault(); return this.salvarLocal(); } // Ctrl+S = guardar neste computador
    if (ctrl) { Pintura.teclaCtrl(e); return; }
    if (this.edImg) { // EDITOR DE IMAGEM: só as teclas de pintar; Esc sai (ou desmarca a seleção primeiro)
      if (k === 'Escape') { e.preventDefault(); return Pintura.selecao ? Pintura.desmarcar() : this.fecharEditor(); }
      if (e.type === 'keydown' && k === 'T' && e.shiftKey && !e.altKey) return Ajustes.tecla(e);
      if (e.type === 'keydown' && Pintura.tecla(e)) return;
      if ((k === 'Delete' || k === 'Backspace') && Pintura.temSelecao()) { e.preventDefault(); return Pintura.mexeDentro('apagar'); }
      return; }
    if (!e.repeat && k.toLowerCase() === 'p' && !e.shiftKey && !e.altKey && Animacoes.achar(Animacoes.sel)) { e.preventDefault(); return Linha.tocaPausa(); } // P: toca/pausa a animação da timeline
    if ((k === ',' || k === '.') && Animacoes.achar(Animacoes.sel)) { e.preventDefault(); return Linha.anda(k === '.' ? 1 : -1); }
    if (this.teste && k === 'Escape') { e.preventDefault(); return Linha.parar(); } // Esc: para a animação e volta à pose padrão
    if (this.teste && Animacoes.rodando) return; // tocando: as teclas de mexer esperam pausar (P)
    if (e.type === 'keydown' && k === 'T' && e.shiftKey && !ctrl && !e.altKey) return Ajustes.tecla(e); // Shift+T: transformar
    if (e.type === 'keydown' && Pintura.tecla(e)) return;
    if ((k === 'Delete' || k === 'Backspace') && Pintura.temSelecao()) { e.preventDefault(); return Pintura.mexeDentro('apagar'); } // área selecionada na imagem
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); return this.apagarSelecao(); }
    if (k === 'Escape' && Pintura.selecao) { e.preventDefault(); return Pintura.desmarcar(); }
    if (k === 'Escape' && (this.multi.size || this.focoImg)) { this.multi.clear(); this.focoImg = null; return this.pinta(); }
    if (k === 'Tab') { e.preventDefault(); const ps = this.def.partes; if (!ps.length) return; const i = ps.findIndex(x => x.id === this.sel); this.multi.clear(); this.focoImg = null; this.sel = ps[(i + (e.shiftKey ? -1 : 1) + ps.length) % ps.length].id; return this.pinta(); }
    if (!p) return; const est = this.estado()[p.id], passo = e.shiftKey ? 10 : 1, kk = k.toLowerCase();
    const leva = () => { clearTimeout(this._t); this.desenha(); this._t = setTimeout(() => this.commit(), 300); };
    if (k.startsWith('Arrow')) { e.preventDefault(); const dd = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[k];
      const im = p.imgs.find(i => i.id === est.img);
      if (this.modoDe(p.id) === 'preset' && im) { const d0 = est.d?.[im.id] || { x: 0, y: 0 }; this.poeD(p, im, { x: round(d0.x + dd[0], 1), y: round(d0.y + dd[1], 1) }); } // só neste preset
      else if (this.modoDe(p.id) === 'imagem' && im) im.ajuste = { x: round((im.ajuste?.x || 0) + dd[0], 1), y: round((im.ajuste?.y || 0) + dd[1], 1) }; // a mesma imagem em todos
      else if (this.edit || this.editPasso) this.mudar(p.id, { x: (est.x || 0) + dd[0], y: (est.y || 0) + dd[1] }); else p.encaixe = { x: p.encaixe.x + dd[0], y: p.encaixe.y + dd[1] }; return leva(); }
    if (kk === 'q' || kk === 'e') { this.mudar(p.id, { r: round((est.r || 0) + (kk === 'q' ? -1 : 1) * (e.shiftKey ? 15 : 2), 1) }); return leva(); }
    if (k === '+' || k === '=' || k === '-') { this.mudar(p.id, { s: round(clamp((est.s ?? 1) * (k === '-' ? .96 : 1.04), .05, 10), 3) }); return leva(); }
    if (kk === 'f') { this.mudar(p.id, { sx: (est.sx || 1) * -1 }); return leva(); }
    if (kk === 'h') { this.mudar(p.id, { vis: est.vis === false }); return leva(); }
    if (k === '[' || k === ']') return this.passoCamada(p, k === ']' ? 1 : -1);
  },

  /* ---------- painéis ---------- */
  pinta() {
    if (!this.def) return; $('#at-nome').value = this.def.nome; $('#at-pasta').value = (this.naNuvem && PastasBib._nuvem?.de?.[this.def.id]) || this.def.pasta || 'Personagens';
    this.pintaBotaoNuvem(); this.pintaEstado();
    const au = $('#at-autores'); if (au && au._de !== this.def.autor?.em + '/' + (this.def.edicoes || []).length) { au._de = this.def.autor?.em + '/' + (this.def.edicoes || []).length; au.innerHTML = ''; const sl = Autores.selo(this.def); if (sl) au.appendChild(sl); }
    const pr = this.preset(), s = this.sessao(), st = Animacoes.passoAtual(), ed = this.edImg && this.itemEditor();
    $('#atelie').classList.toggle('ed-img', !!ed); // EDITOR DE IMAGEM: some o que não é da imagem (lista de partes, timeline, botões de mexer nas peças)
    // o que está sendo mexido agora, numa frase só
    $('#at-modo').innerHTML = ed ? `${ic('brush', 13)} Editando <b>${esc(ed.img.nome)}</b> <small>${esc(ed.parte.nome)}</small>` : Animacoes.poseFixa ? `Pose do quadro ${Animacoes.poseFixa.quadro + 1} · arrumando <b>${esc(Animacoes.textoAlvo())}</b>`
      : st ? `${ic('film', 13)} Frame <b>${st.pi + 1}</b> de <b>${esc(st.a.nome)}</b>` : Animacoes.tocando && !Animacoes.pausado ? `${ic('play', 12)} Tocando <b>${esc(Animacoes.achar(Animacoes.tocando)?.nome || '')}</b>` : pr ? `Editando a pose <b>${esc(s.nome)} › ${esc(pr.nome)}</b>` : `Pose <b>padrão</b>`;
    $('#at-base').hidden = !pr || !!ed; $('#at-ed-ok').hidden = !ed; if ($('#at-ed-voltar')) $('#at-ed-voltar').hidden = !ed;
    let cr = $('#at-ed-resto'); if (!cr) { cr = h(`<label class="chk at-ed-resto" id="at-ed-resto" title="Mostra as outras partes em volta (meio apagadas), na profundidade e no frame que estão agora — só para ver; a pintura continua só nesta imagem"><input type="checkbox"> Mostrar o resto<input type="range" min="10" max="100" step="5" data-op title="Opacidade do resto"><output data-opv></output></label>`); $('#at-ed-ok').after(cr); $('input', cr).onchange = ev => { this.mostraResto = ev.target.checked; try { localStorage.setItem('animador-ed-resto', this.mostraResto ? '1' : ''); } catch { } this.pinta(); }; try { this.mostraResto = !!localStorage.getItem('animador-ed-resto'); this.opResto = +(localStorage.getItem('animador-ed-resto-op') || 45); } catch { this.opResto = 45; }
      $('[data-op]', cr).oninput = ev => { this.opResto = +ev.target.value; $('[data-opv]', cr).textContent = this.opResto + '%'; try { localStorage.setItem('animador-ed-resto-op', this.opResto); } catch { } this.desenha(); }; }
    cr.hidden = !ed; $('input', cr).checked = !!this.mostraResto; $('[data-op]', cr).value = this.opResto ?? 45; $('[data-op]', cr).hidden = $('[data-opv]', cr).hidden = !this.mostraResto; $('[data-opv]', cr).textContent = (this.opResto ?? 45) + '%'; $('#at-mover').value = this.modoMover;
    for (const x of ['#at-mover', '#at-regua', '#at-ref']) { const e = $(x); if (e) e.hidden = !!ed; }
    Pintura.pintaBarra(); Linha.pinta();
    let bp = $('#at-abas [data-aba="pintar"]'); if (!bp && $('#at-abas')) { bp = h(`<button data-aba="pintar" title="Camadas, cores e opções de pintar da parte escolhida">${ic('layers', 12)} Camadas</button>`); $('#at-abas').appendChild(bp); bp.onclick = () => { this.aba = 'pintar'; this.pinta(); }; }
    if (bp) bp.hidden = Pintura.ferr === 'mover' && this.aba !== 'pintar';
    this.pintaIcone(); this.pintaVistas(); this.pintaPartes(); this.pintaImgs(); $$('#at-abas [data-aba]').forEach(b => b.classList.toggle('on', b.dataset.aba === this.aba));
    const lado = $('#at-lado'), rol = lado.scrollTop; lado.innerHTML = ''; if (this.aba === 'pintar' && !$('#at-abas [data-aba="pintar"]')) this.aba = 'peca';
    if (ed) this.pintaEditor(lado); else this.aba === 'pintar' ? this.pintaPintar(lado) : this.aba === 'peca' ? this.pintaPeca(lado) : this.aba === 'animacoes' ? Animacoes.pinta(lado) : this.pintaSessoes(lado); lado.scrollTop = rol; this.desenha();
  },
  /* ---------- EDITOR DE IMAGEM (duplo clique na imagem, ou escolher uma ferramenta de pintar): estilo Photoshop, só a imagem na tela,
     ferramentas na barra da esquerda e, na direita, camadas, ajustes e cores. Concluir (ou Esc) volta ao Ateliê. ---------- */
  abrirEditor(p, img) {
    if (!this.edImg) this._edAntes = JSON.stringify(this.def); // para o Voltar (sair sem guardar)
    p = p || this.parte(); if (!p) { UI.toast('Escolha uma parte (ou dê dois cliques numa imagem).'); return false; }
    img = img || p.imgs.find(i => i.id === this.estado()[p.id]?.img) || p.imgs[0]; if (!img) { UI.toast('Esta parte ainda não tem imagem.'); return false; }
    this.edImg = { pid: p.id, iid: img.id }; this.sel = p.id; this.multi.clear(); this.focoImg = { p: p.id, img: img.id };
    if (Pintura.ferr === 'mover') Pintura.ferr = 'pincel'; Pintura.usa(Pintura.ferr); this.enquadrar(); return true;
  },
  // VOLTAR no editor: desfaz tudo o que mudou desde que abriu (como uma mudança só: Ctrl+Z traz de volta) e fecha
  async voltarEditor() {
    const antes = this._edAntes; if (antes && antes !== JSON.stringify(this.def)) { if (!(await UI.confirm({ title: 'Sair sem guardar?', msg: 'O que você mudou nesta imagem desde que abriu o editor vai ser desfeito (Ctrl+Z traz de volta).', ok: 'Sair sem guardar', danger: true }))) return; this.def = JSON.parse(antes); this.commit(); }
    this.fecharEditor();
  },
  fecharEditor() { this.edImg = null; Pintura.selecao = null; Pintura.ferr = 'mover'; if (this.cv) this.cv.style.cursor = ''; this.pinta(); this.enquadrar(); },
  // a peça do editor: a parte com A IMAGEM ESCOLHIDA (mesmo que a pose na tela mostre outra), no lugar da parte
  itemEditor() {
    const e = this.edImg; if (!e) return null; const p = this.parte(e.pid), img = p?.imgs.find(i => i.id === e.iid); if (!img) { this.edImg = null; return null; }
    const it = Modelo.montar(this.def, this.estado()).find(x => x.parte.id === p.id); if (!it) { const m = new DOMMatrix(); return { parte: p, img, ap: null, m, mp: m }; }
    return it.img?.id === img.id ? it : { ...it, img, ap: null, m: it.mp || it.m };
  },
  // ferramenta de pintar no palco (fora do editor): a aba Camadas aparece e vai para ela; Mover volta para a aba de antes
  abaPintar(on) { if (on) { if (this.aba !== 'pintar') this._abaAntes = this.aba; this.aba = 'pintar'; } else if (this.aba === 'pintar') this.aba = this._abaAntes && this._abaAntes !== 'pintar' ? this._abaAntes : 'peca'; },
  pintaPintar(el) {
    const p = this.parte(), img = p && p.imgs.find(i => i.id === this.estado()[p.id]?.img);
    el.appendChild(h(`<div class="ed-cab"><div class="ed-t"><small>Pintando no palco</small><b>${p ? `${esc(img?.nome || '—')} <small>(${esc(p.nome)})</small>` : 'Escolha uma parte'}</b></div>${img ? `<button class="btn sm" data-ab title="Abrir só esta imagem, como no Photoshop">${ic('brush', 12)} Abrir no editor</button>` : ''}</div>`));
    const ab = $('[data-ab]', el); if (ab) ab.onclick = () => { if (this.abrirEditor(p, img)) this.pinta(); };
    Pintura.pintaAba(el);
  },
  pintaEditor(el) {
    const it = this.itemEditor(); if (!it) return; const p = it.parte, cab = h(`<div class="ed-cab"><div class="ed-t"><small>Imagem de "${esc(p.nome)}"</small>
      <select data-img title="Trocar a imagem que está editando">${p.imgs.map(i => `<option value="${i.id}" ${i.id === it.img.id ? 'selected' : ''}>${esc(i.nome)}</option>`).join('')}</select></div>
</div>`);
    $('[data-img]', cab).onchange = ev => { this.edImg = { pid: p.id, iid: ev.target.value }; Pintura.selecao = null; this.pinta(); this.enquadrar(); };     const q = Quadro.ctx(p.id); if (q) cab.appendChild(h(`<div class="ed-aviso">${ic('film', 12)} Você está no <b>${esc(Quadro.nome(q))}</b>: a borracha apaga <b>só nele</b>. O pincel muda a imagem em tudo.</div>`));
    el.appendChild(cab); Pintura.pintaAba(el);
  },
  pintaPartes() { // na árvore: a referência sempre em cima, depois a raiz
    const el = $('#at-partes'), ps = this.def.partes; el.innerHTML = '';
    if (!ps.length) { el.innerHTML = '<div class="vazio">Comece criando as partes: corpo, cabeça, cabelo, olhos, braços, pernas…<br>(ou solte as imagens aqui: cada imagem vira uma parte)</div>'; }
    // a ORDEM da lista É a profundidade (z): em cima = ATRÁS, embaixo = NA FRENTE (a referência fica fixa no topo). Quem encaixa em quem aparece em cinza ("em Corpo").
    // Com um passo parado na timeline, a ordem mostrada (e mudada) é a daquele passo.
    // KEYFRAME: parado num passo da timeline (ou na pose de um quadro do editor) = aviso em cima dizendo qual, e as partes com profundidade/posição só deste keyframe ficam marcadas
    const kc = Quadro.ctx(), kp = kc ? (kc.tipo === 'editor' ? Animacoes.poseFixa?.partes : this.teste?.partes) || {} : null;
    if (kc) el.appendChild(h(`<div class="kf-aviso">${ic('film', 13)}<span>No <b>${esc(Quadro.nome(kc))}</b>${Animacoes.multi?.size > 1 ? ` <b>e mais ${Animacoes.multi.size - 1} frame(s) escolhidos</b>` : ''}: profundidade e posição mudadas aqui valem só ${Animacoes.multi?.size > 1 ? 'neles' : 'nele'} <i class="kf-t z">profundidade</i><i class="kf-t pos">posição</i></span></div>`));
    const raiz = this.def.raiz, est = this.estado(), ordem = this._ordem = [], roxas = this.partesTodas(), lista = this.listaArvore();
    const vai = () => { for (const p of lista) { ordem.push(p.id); const nivel = (() => { let n = 0, q = p; while (q?.pai && n < 6) { q = this.parte(q.pai); if (!q) break; n++; } return n; })(), nomePai = p.pai && this.parte(p.pai)?.nome;
    
      const ehRaiz = p.id === raiz, marc = p.id !== this.sel && this.multi.has(p.id), mk = this.marcas().partes.has(p.id);
      const r = h(`<div class="no ${p.id === this.sel ? 'sel' : ''} ${marc ? 'multi' : ''} ${ehRaiz ? 'raiz' : ''} ${Referencia.ehRef(p) ? 'ref' : ''} ${roxas.has(p.id) ? 'todos' : ''}" data-pid="${p.id}" data-niv="${Math.min(nivel, 4)}" style="padding-left:${8 + nivel * 14}px" draggable="true" title="${ehRaiz ? 'RAIZ — a parte principal do personagem · ' : ''}Segure e arraste: em cima/embaixo de outra muda a profundidade (em cima = atrás, embaixo = na frente) · no meio vira filha · no vazio fica sem pai · para &quot;Imagens de…&quot; vira imagem · Ctrl/Shift+clique marcam várias"><span class="pega" aria-hidden="true">${ic('grip', 12)}</span><span class="ti">${ic(ehRaiz ? 'star' : p.imgs.length ? 'image' : 'shapes', 13)}</span><span class="nm">${esc(p.nome)} <small style="color:var(--tx3)">${p.imgs.length}</small>${nomePai ? `<small class="no-pai" title="Encaixa em ${esc(nomePai)}">em ${esc(nomePai)}</small>` : ''}</span>${mk ? '<i class="ponto-mod" title="Mudou e ainda não foi salvo"></i>' : this.local().partes.has(p.id) ? `<span class="so-local" title="Salvo só neste computador: ainda não está na nuvem">${ic('cloudOff', 12)}</span>` : ''}${ehRaiz ? '<span class="tag-raiz">raiz</span>' : ''}
        <button class="ibtn ${est[p.id]?.vis === false ? 'off' : ''}" title="Mostrar/esconder (H)">${ic(est[p.id]?.vis === false ? 'eyeOff' : 'eye', 13)}</button></div>`);
      const kv = kp?.[p.id]; if (kv) { const z = kv.z != null && kv.z !== 0, pos = !!(kv.x || kv.y || kv.r || (kv.d && Object.keys(kv.d).length)); if (z || pos) { r.classList.add('kf-mud'); if (z) r.classList.add('kf-z'); const tg = h(`<span class="kf-tags">${z ? '<i class="kf-t z" title="Profundidade diferente só neste keyframe">prof.</i>' : ''}${pos ? '<i class="kf-t pos" title="Posição/giro diferente só neste keyframe">pos.</i>' : ''}</span>`); const olho = r.querySelector(':scope > .ibtn:last-child'); olho ? olho.before(tg) : r.appendChild(tg); } }
      r.onclick = ev => { if (ev.target.closest('.ibtn')) { this.mudar(p.id, { vis: est[p.id]?.vis === false }); return this.commit(); } this.clicaParte(ev, p.id); };
      r.ondblclick = async () => { const n = await UI.prompt({ title: 'Nome da parte', value: p.nome }); if (n) { p.nome = n; this.commit(); } };
      r.oncontextmenu = ev => { ev.preventDefault(); if (p.id !== this.sel && !this.multi.has(p.id)) this.escolhe(p.id); this.focoImg = null; this.pinta(); this.menuParte(ev, p); };
      // ARRASTAR NA LISTA: em cima de outra = atrás dela, embaixo = na frente dela (muda a ORDEM) e fica irmã dela; no meio = vira FILHA dela;
      // solta no vazio da lista (ou longe, fora dela) = fica SEM PAI. Substitui a antiga aba Profundidade.
      r.ondragstart = ev => { ev.dataTransfer.setData('text/parte', p.id); ev.dataTransfer.effectAllowed = 'move'; this._arrasto = this.multi.has(p.id) ? this.selecionadas().map(x => x.id) : [p.id]; r.classList.add('arrastando'); el.classList.add('arrastando-parte'); };
      r.ondragend = ev => { r.classList.remove('arrastando'); el.classList.remove('arrastando-parte'); $$('.no.drop-dentro,.no.drop-antes,.no.drop-depois', el).forEach(x => x.classList.remove('drop-dentro', 'drop-antes', 'drop-depois')); if (ev.dataTransfer.dropEffect !== 'none') return; const b = el.getBoundingClientRect(); if (ev.clientX < b.left - 40 || ev.clientX > b.right + 40 || ev.clientY < b.top - 40 || ev.clientY > b.bottom + 40) this.soltarSemPai(p.id); };
      const zona = ev => { const b = r.getBoundingClientRect(), y = (ev.clientY - b.top) / b.height; return y < .28 ? 'antes' : y > .72 ? 'depois' : 'dentro'; };
      r.ondragover = ev => { const t = ev.dataTransfer.types; if (!(t.includes('text/parte') || t.includes('Files'))) return; ev.preventDefault(); ev.stopPropagation(); const z = t.includes('Files') ? 'dentro' : zona(ev); r.classList.toggle('drop-dentro', z === 'dentro'); r.classList.toggle('drop-antes', z === 'antes'); r.classList.toggle('drop-depois', z === 'depois'); };
      r.ondragleave = () => r.classList.remove('drop-dentro', 'drop-antes', 'drop-depois');
      r.ondrop = ev => { ev.preventDefault(); ev.stopPropagation(); const z = zona(ev); r.classList.remove('drop-dentro', 'drop-antes', 'drop-depois');
        if (ev.dataTransfer.files?.length) { this.sel = p.id; return Pastas.deDrop(ev.dataTransfer).then(l => this.addImagens(Pastas.paraParte(l), false)); } // arquivo em cima da parte: vira imagem dela (pasta solta aqui = pasta de imagens dela)
        const id = ev.dataTransfer.getData('text/parte'); if (!id || id === p.id) return; if (z === 'dentro') this.porNoPai(id, p.id); else this.moverParte(id, p, z); };
      el.appendChild(r); } };
    vai();
    el.ondragover = ev => { if (ev.dataTransfer.types.includes('Files') || ev.dataTransfer.types.includes('text/parte')) ev.preventDefault(); };
    el.ondrop = ev => { const id = ev.dataTransfer.getData('text/parte'); if (id) { ev.preventDefault(); return this.soltarSemPai(id); } if (ev.dataTransfer.files?.length) { ev.preventDefault(); Pastas.deDrop(ev.dataTransfer).then(l => this.addImagens(l, true)); } }; // cada imagem uma parte; cada pasta uma parte
  },
  // muda a PROFUNDIDADE: põe a parte logo na frente (antes) ou atrás (depois) de "alvo" — quem encaixa em quem não muda.
  // Com um passo parado na timeline, vale só naquele passo (keyframe)
  // ordem da lista: a referência em cima; depois cada pai SEMPRE em cima das suas filhas (a raiz no topo), e entre irmãs a da frente primeiro
  // ordem da lista = a PROFUNDIDADE de trás para a frente: em cima = ATRÁS, embaixo = NA FRENTE (a referência fixa no topo). O pai fica na
  // profundidade dele (o corpo no meio: o que está acima dele fica atrás do corpo, o que está abaixo fica na frente); as filhas ficam recuadas com a linha.
  listaArvore() { const ps = this.def.partes; return [...ps.filter(p => Referencia.ehRef(p)), ...this.ordemCamadas().filter(p => !Referencia.ehRef(p))]; },
  moverParte(id, alvo, onde) {
    const q = this.parte(id); if (!q || q === alvo || Referencia.ehRef(alvo)) return;
    // a lista mostra de trás para a frente: soltar EM CIMA de outra = atrás dela, EMBAIXO = na frente dela (L aqui vai da frente para trás)
    const L = this.ordemCamadas().reverse().filter(x => x !== q && !Referencia.ehRef(x)); let i = L.indexOf(alvo); if (i < 0) i = 0; L.splice(onde === 'antes' ? i + 1 : i, 0, q); this.reordenar(L);
  },
  soltarSemPai(id) { const q = this.parte(id); if (!q || !q.pai) return; this.porNoPai(id, null); UI.toast(`<b>${esc(q.nome)}</b> ficou solta (sem pai). Ctrl+Z desfaz.`, { time: 3000 }); },
  // CAMADAS: a ordem real de desenho (de cima = na frente), igual às camadas do Photoshop.
  // Mexer aqui só muda o Z; quem encaixa em quem (a hierarquia) continua igual.
  ordemCamadas() { const est = this.estado(); return this.def.partes.map((p, i) => ({ p, i, z: (p.z || 0) + (est[p.id]?.z || 0) })).sort((a, b) => a.z - b.z || a.i - b.i).map(x => x.p); },
  passoCamada(p, d) { if (Referencia.ehRef(p)) return; const L = this.ordemCamadas().reverse().filter(x => !Referencia.ehRef(x)), i = L.indexOf(p), j = i - d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; this.reordenar(L); },
  reordenar(frenteParaTras, todos = false) { // reescreve os Z da base: 0 = mais atrás
    // num keyframe (passo pausado ou pose do editor): pergunta se a profundidade muda só nele ou em todos (js/quadro.js)
    const kq = !todos && Quadro.ctx(); if (kq?.tipo === 'passo') return Quadro.reordenar(kq, frenteParaTras.filter(p => !Referencia.ehRef(p))); // passo da timeline: a profundidade é deste keyframe
    if (kq) { frenteParaTras = frenteParaTras.filter(p => !Referencia.ehRef(p)); Quadro.escolheZ(kq).then(v => { if (v === 'quadro') Quadro.reordenar(kq, frenteParaTras); else if (v === 'todos') this.reordenar(frenteParaTras, true); }); return; }
    const n = frenteParaTras.length, pr = this.preset(), est = pr ? pr.estado : null;
    frenteParaTras.forEach((p, i) => { p.z = (n - 1 - i) - (est?.[p.id]?.z || 0); });
    // a referência fica sempre atrás de tudo (ela é o guia, não uma peça)
    for (const r of this.def.partes) if (Referencia.ehRef(r) && !frenteParaTras.includes(r)) r.z = -1 - (est?.[r.id]?.z || 0);
    this.commit();
  },
  todosSoParte(pid) { // liga/desliga "Mover todos" só nesta parte (o botão de cima continua valendo para as outras)
    if (this.todosSo.has(pid)) this.todosSo.delete(pid); else this.todosSo.add(pid); this.pinta();
    UI.toast(this.todosSo.has(pid) ? `<b>Mover todos</b> só em <b>${esc(this.parte(pid)?.nome || '')}</b>: arrastar move a parte inteira (fica roxa). As outras partes continuam como estão.` : `<b>${esc(this.parte(pid)?.nome || '')}</b> voltou a mover só a imagem.`, { time: 4500 });
  },
  setModo(m) { this.modoMover = m; this.todosSo.clear(); this.pinta();   },
  // posição desta imagem SÓ no preset que está na tela (ou só na base)
  poeD(p, img, v, onde = this.preset()) {
    if (arguments.length < 4 && !this.editPasso && Animacoes.passoAtual()) { Animacoes.alvoPausa(p.id); if (this.editPasso) onde = null; }
    if (arguments.length < 4 && this.editPasso) { const ps0 = Animacoes.passoEditado(); if (ps0) { for (const ps of [ps0, ...Animacoes.outrosEscolhidos(ps0)]) { ps.p = ps.p || {}; const e = ps.p[p.id] = ps.p[p.id] || {}, d = { ...(e.d || {}) }; if (!v || (!v.x && !v.y)) delete d[img.id]; else d[img.id] = { x: v.x, y: v.y }; e.d = d; if (!Object.keys(d).length) delete e.d; } return; } }
    const st = onde ? (onde.estado[p.id] || {}) : p.base, d = { ...(st.d || {}) };
    if (!v || (!v.x && !v.y)) delete d[img.id]; else d[img.id] = { x: v.x, y: v.y };
    if (onde) { const s = this.sessao(); if (s?.partes?.length && !s.partes.includes(p.id)) s.partes.push(p.id); onde.estado[p.id] = { ...(onde.estado[p.id] || {}), d }; if (!Object.keys(d).length) delete onde.estado[p.id].d; }
    else { p.base.d = d; if (!Object.keys(d).length) delete p.base.d; }
  },
  // onde a imagem aparece: a base e cada preset que mostra esta imagem nesta parte
  ondeAparece(p, img) {
    const L = []; if (p.base.img === img.id) L.push({ nome: 'base', pr: null });
    for (const s of this.def.sessoes) for (const pr of s.presets) { const e = pr.estado?.[p.id]; if (!e) continue; if ((e.img || p.base.img) === img.id) L.push({ nome: `${s.nome} › ${pr.nome}`, pr }); }
    return L;
  },
  aplicarPosicaoEmTodos(p, img) {
    const v = this.estado()[p.id]?.d?.[img.id] || { x: 0, y: 0 }, L = this.ondeAparece(p, img).filter(o => o.pr !== this.preset());
    for (const o of L) this.poeD(p, img, v, o.pr); this.commit();
    UI.toast(L.length ? `Posição de "${esc(img.nome)}" aplicada em ${L.length} lugar(es): ${esc(L.map(o => o.nome).slice(0, 4).join(', '))}${L.length > 4 ? '…' : ''}.` : 'Esta imagem não aparece em outros presets.', { kind: L.length ? 'ok' : 'warn', time: 6000 });
  },
  // botão direito numa peça do palco
  menuPalco(e) {
    const it = this.acha(this.mundo(e)); if (!it) return; if (it.parte.id !== this.sel) { this.escolhe(it.parte.id); this.pinta(); }
    const p = it.parte, n = p.imgs.length;
    UI.ctx(e.clientX, e.clientY, [
      { head: `${p.nome}${it.img ? ' › ' + it.img.nome : ''}` },
      { label: 'Citar o personagem inteiro…', icon: 'chat', action: () => Citacao.atelie({}) }, '-',
      { label: `Mover só ${this.edit ? 'neste preset' : 'na base'}`, checked: this.modoMover === 'preset', action: () => this.setModo('preset') },
      { label: 'Mover a mesma imagem em todos os presets', checked: this.modoMover === 'imagem', action: () => this.setModo('imagem') },
      it.img && '-', it.img && { label: 'Aplicar esta posição aos presets com a mesma imagem', icon: 'copy', action: () => this.aplicarPosicaoEmTodos(p, it.img) },
      it.img && this.estado()[p.id]?.d?.[it.img.id] && { label: `Voltar ao lugar (${this.edit ? 'neste preset' : 'na base'})`, icon: 'undo', action: () => { this.poeD(p, it.img, null); this.commit(); } },
      it.img && (it.img.ajuste?.x || it.img.ajuste?.y) && { label: 'Tirar o ajuste da imagem em todos os presets', icon: 'undo', action: () => { it.img.ajuste = { x: 0, y: 0 }; this.commit(); } },
      '-', { head: `Parte "${p.nome}"` }, ...this.menuParte(e, p, { so: true }), // as mesmas opções do botão direito na hierarquia
    ].filter(Boolean).filter((x, i, L) => x !== '-' || (i && L[i - 1] !== '-' && i < L.length - 1)));
  },
  /* ---------- o que mudou desde a última vez na nuvem (fica colorido até "Salvar na nuvem") ---------- */
  // laranja: mudou e ainda não foi salvo (nem no computador nem na nuvem)
  marcas() { if (this._mk?.de === this.ultimo && this._mk?.base === this.base0) return this._mk; return (this._mk = this.marcasContra(this.base0)); },
  // nuvem cortada: salvo neste computador mas diferente da nuvem (ou o personagem nem está na nuvem: todo = true)
  local() { if (this._ml?.de === this.ultimo && this._ml?.base === this.baseNuvem) return this._ml; const m = this.baseNuvem ? this.marcasContra(this.baseNuvem) : { partes: new Set(this.def.partes.map(p => p.id)), imgs: new Set(), presets: new Set(this.def.sessoes.flatMap(s => s.presets.map(p => p.id))) }; m.todo = !this.baseNuvem; m.de = this.ultimo; m.base = this.baseNuvem; return (this._ml = m); },
  marcasContra(base) {
    const out = { partes: new Set(), imgs: new Set(), presets: new Set(), de: this.ultimo, base };
    const B0 = base ? JSON.parse(base) : null; if (!B0 || !this.def) return out;
    // compara com a MESMA vista na versão de antes (vista nova = tudo novo)
    const vAt = this.def.vistaAtual, B = !vAt || !B0.vistas || B0.vistaAtual === vAt || !B0.vistaAtual ? B0 : B0.vistas.some(v => v.id === vAt && v.partes) ? Modelo.naVista(B0, vAt) : { partes: [], sessoes: [] };
    const bp = Object.fromEntries(B.partes.map(p => [p.id, p])), bi = {}, bpr = {};
    for (const p of B.partes) for (const i of p.imgs) bi[i.id] = JSON.stringify([i.k, i.pivo, i.ajuste, i.w, i.h, i.z || 0]);
    for (const s of B.sessoes) for (const pr of s.presets) bpr[pr.id] = JSON.stringify(pr.estado || {});
    const toda = new Set(); // partes que mexeram por inteiro (encaixe, pai, base…): todas as imagens e presets dela contam
    for (const p of this.def.partes) { const b = bp[p.id];
      const semD = x => { const { d, ...r } = x || {}; return r; };
      if (!b || JSON.stringify([p.pai, p.encaixe, semD(p.base), p.z || 0]) !== JSON.stringify([b.pai, b.encaixe, semD(b.base), b.z || 0])) { out.partes.add(p.id); toda.add(p.id); }
      else for (const iid of new Set([...Object.keys(p.base.d || {}), ...Object.keys(b.base.d || {})])) if (JSON.stringify(p.base.d?.[iid]) !== JSON.stringify(b.base.d?.[iid])) { out.imgs.add(iid); out.partes.add(p.id); } // só a posição na base
      for (const i of p.imgs) if (toda.has(p.id) || bi[i.id] !== JSON.stringify([i.k, i.pivo, i.ajuste, i.w, i.h, i.z || 0])) { out.imgs.add(i.id); out.partes.add(p.id); } }
    for (const s of this.def.sessoes) for (const pr of s.presets) { const usa = Object.entries(pr.estado || {});
      if (bpr[pr.id] !== JSON.stringify(pr.estado || {}) || usa.some(([pid, e]) => toda.has(pid) || (e.img && out.imgs.has(e.img) && this.imgMudouFora(pid, e.img, B)))) out.presets.add(pr.id); }
    return out;
  },
  // a imagem mudou por ela mesma (ajuste, pixels, pivô) — não só a posição dela na base
  imgMudouFora(pid, iid, B) { const p = this.parte(pid), i = p?.imgs.find(x => x.id === iid), b = B.partes.find(x => x.id === pid)?.imgs.find(x => x.id === iid); return !b || JSON.stringify([i?.k, i?.pivo, i?.ajuste, i?.w, i?.h, i?.z || 0]) !== JSON.stringify([b.k, b.pivo, b.ajuste, b.w, b.h, b.z || 0]); },
  // presets que mexem na parte (para pintar de roxo no "mover todos")
  presetsDaParte(pid) { const L = new Set(); for (const s of this.def.sessoes) for (const pr of s.presets) if (pr.estado?.[pid] || (s.partes || []).includes(pid)) L.add(pr.id); return L; },
  menuParte(e, p, o = {}) { // o.so: só devolve os itens (o menu do palco junta com os dele)
    const sel = this.selecionadas(), varias = sel.length > 1 && sel.includes(p), lista = varias ? sel : [p], ids = lista.map(x => x.id);
    const destinos = this.def.partes.filter(x => !ids.includes(x.id));
    const ehRaiz = p.id === this.def.raiz;
    const itens = [
      varias && { head: `${lista.length} PARTES MARCADAS` },
      !varias && { label: ehRaiz ? 'Deixar de ser a raiz' : 'Marcar como raiz (principal)', icon: 'star', action: () => this.marcarRaiz(p) },
      !varias && { label: 'Citar esta parte em mensagens…', icon: 'chat', action: () => Citacao.atelie({ sel: p.id }) },
      !varias && { label: 'Mover todos só nesta parte (a parte inteira e os presets)', icon: 'layers', checked: this.todosSo.has(p.id), action: () => { this.escolhe(p.id); this.todosSoParte(p.id); } }, !varias && { label: 'Mover todos em todas as partes', icon: 'layers', checked: this.modoMover === 'todos', action: () => this.setModo(this.modoMover === 'todos' ? 'preset' : 'todos') },
      { label: varias ? `Mover as ${lista.length} para imagens de` : 'Mover para imagens de', icon: 'image', disabled: !destinos.length, sub: destinos.map(d => ({ label: d.nome, icon: d.id === this.def.raiz ? 'star' : null, action: () => this.virarImagens(lista, d) })) },
      '-',
      !varias && { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome da parte', value: p.nome }); if (n) { p.nome = n; this.commit(); } } },
      !varias && { label: 'Parte nova encaixada nesta', icon: 'plus', action: () => this.novaParte(p.id) },
      !varias && { label: 'Duplicar (ex.: braço esquerdo → direito)', icon: 'dup', action: () => this.duplicarParte(p) },
      !varias && p.imgs.length > 1 && { label: 'Todas as imagens na mesma posição', icon: 'move', sub: [
        { head: `igual a "${(p.imgs.find(i => i.id === this.estado()[p.id]?.img) || p.imgs[0]).nome}" (a que aparece)` },
        { label: 'Pelo centro', action: () => this.alinharImagens(p, 'centro') }, { label: 'Por baixo (pés no mesmo chão)', action: () => this.alinharImagens(p, 'baixo') }, { label: 'Por cima', action: () => this.alinharImagens(p, 'cima') }] },
      !varias && p.pai && { label: 'Soltar do pai', icon: 'layers', action: () => this.porNoPai(p.id, null) },
      !varias && '-', !varias && { label: 'Para a frente', icon: 'down', key: ']', action: () => this.passoCamada(p, 1) }, !varias && { label: 'Para trás', icon: 'up', key: '[', action: () => this.passoCamada(p, -1) },
      '-', { label: varias ? `Apagar as ${lista.length} partes` : 'Apagar a parte', icon: 'trash', key: 'Delete', danger: true, action: () => this.apagarPartes(lista) },
    ].filter(Boolean); if (o.so) return itens; UI.ctx(e.clientX, e.clientY, itens);
  },
  // pôr a parte dentro de outra mantendo o lugar na tela
  // todas as imagens da parte no mesmo lugar da que aparece agora (pelo centro, por baixo ou por cima) e sem os ajustes de "só neste preset" delas
  alinharImagens(p, como = 'centro', modelo = null) {
    const est = this.estado(), ref = modelo || p.imgs.find(i => i.id === est[p.id]?.img) || p.imgs[0]; if (!ref) return;
    const ox = im => -(im.pivo?.x ?? im.w / 2) + (im.ajuste?.x || 0), oy = im => -(im.pivo?.y ?? im.h / 2) + (im.ajuste?.y || 0); // canto de cima da imagem, no espaço da parte
    const cx = ox(ref) + ref.w / 2, alvoY = como === 'baixo' ? oy(ref) + ref.h : como === 'cima' ? oy(ref) : oy(ref) + ref.h / 2;
    let n = 0;
    for (const im of p.imgs) { if (im === ref) continue; const px = im.pivo?.x ?? im.w / 2, py = im.pivo?.y ?? im.h / 2;
      const y0 = como === 'baixo' ? alvoY - im.h : como === 'cima' ? alvoY : alvoY - im.h / 2;
      im.ajuste = { x: round(cx - im.w / 2 + px, 1), y: round(y0 + py, 1) }; n++; }
    // ajustes por imagem nos presets, na base e nos passos das animações de teste tirariam do lugar de novo
    const ids = new Set(p.imgs.map(i => i.id)), limpa = e => { if (e?.d) { for (const k of Object.keys(e.d)) if (ids.has(k)) delete e.d[k]; if (!Object.keys(e.d).length) delete e.d; } };
    limpa(p.base); for (const se of this.def.sessoes) for (const pr of se.presets) limpa(pr.estado?.[p.id]); for (const a of this.def.animacoes || []) for (const t of a.trilhas || []) for (const ps of t) limpa(ps.p?.[p.id]);
    this.commit(); UI.toast(`${n} imagem(ns) de <b>${esc(p.nome)}</b> no mesmo lugar de "${esc(ref.nome)}" (${como === 'baixo' ? 'por baixo' : como === 'cima' ? 'por cima' : 'pelo centro'}). Ctrl+Z desfaz.`, { kind: 'ok' });
  },
  porNoPai(id, paiId, o = {}) {
    const p = this.parte(id); if (!p) return; let a = paiId; while (a) { if (a === id) return UI.toast('Uma parte não pode encaixar nela mesma'); a = this.parte(a)?.pai; }
    if (paiId && this.def.raiz === id) { delete this.def.raiz; if (!o.semCommit) UI.toast(`"${esc(p.nome)}" encaixou em outra parte e deixou de ser a raiz.`); }
    const est = this.estado(), mundo = this.matParte(id, est).transformPoint(new DOMPoint(0, 0)); p.pai = paiId;
    const est2 = this.estado(), inv = this.matPai(id, est2).inverse(), l = inv.transformPoint(mundo), e = est2[id] || {};
    const sem = new DOMMatrix().translate(e.x || 0, e.y || 0); p.encaixe = { x: round(l.x - sem.e, 1), y: round(l.y - sem.f, 1) }; if (!o.semCommit) this.commit();
  },
  // muda o ponto de giro/encaixe da parte para (x,y) da imagem que aparece, sem tirar nada do lugar (todas as imagens e as partes filhas acompanham)
  pivoEm(p, x, y, est = this.estado()) {
    const it = Modelo.montar(this.def, est).find(i => i.parte.id === p.id), img = it?.img; if (!img) return;
    const pv = img.pivo || { x: img.w / 2, y: img.h / 2 }, dx = x - pv.x, dy = y - pv.y; if (Math.abs(dx) + Math.abs(dy) < .5) return;
    const a = this.matPai(p.id, est).inverse().multiply(it.m), dp = new DOMMatrix([a.a, a.b, a.c, a.d, 0, 0]).transformPoint(new DOMPoint(dx, dy, 0, 0));
    for (const i of p.imgs) { const q = i.pivo || { x: i.w / 2, y: i.h / 2 }; i.pivo = { x: round(q.x + dx, 2), y: round(q.y + dy, 2) }; }
    p.encaixe = { x: round(p.encaixe.x + dp.x, 1), y: round(p.encaixe.y + dp.y, 1) };
    for (const f of this.def.partes.filter(f => f.pai === p.id)) f.encaixe = { x: round(f.encaixe.x - dx, 1), y: round(f.encaixe.y - dy, 1) };
  },
  // clique na lista de partes: normal escolhe; Ctrl marca/desmarca mais uma; Shift marca o trecho até a escolhida
  clicaParte(ev, id) {
    this.focoImg = null;
    if ((ev.ctrlKey || ev.metaKey) && this.sel && id !== this.sel) { this.multi.has(id) ? this.multi.delete(id) : this.multi.add(id); return this.pinta(); }
    if (ev.shiftKey && this.sel && id !== this.sel) { const o = this._ordem || [], a = o.indexOf(this.sel), b = o.indexOf(id); if (a >= 0 && b >= 0) { for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (o[i] !== this.sel) this.multi.add(o[i]); return this.pinta(); } }
    this.escolhe(id); this.pinta();
  },
  // RAIZ: a parte principal (normalmente o corpo). Fica no topo da hierarquia, sem pai, destacada em amarelo.
  marcarRaiz(p) {
    if (this.def.raiz === p.id) { delete this.def.raiz; this.commit(); return UI.toast(`"${esc(p.nome)}" não é mais a raiz.`); }
    if (p.pai) this.porNoPai(p.id, null, { semCommit: true });
    this.def.raiz = p.id; this.commit(); UI.toast(`<b>${esc(p.nome)}</b> agora é a raiz (a parte principal).`, { kind: 'ok' });
  },
  // Delete / Backspace: o mesmo que clicar em apagar (a imagem clicada em "Imagens de…", ou as partes marcadas)
  apagarSelecao() {
    const f = this.focoImg, p = f && this.parte(f.p), img = p?.imgs.find(i => i.id === f.img);
    if (img) return this.tirarImg(p, img);
    const lista = this.selecionadas(); if (!lista.length) return UI.toast('Escolha uma parte (ou clique numa imagem) para apagar');
    this.apagarPartes(lista);
  },
  async apagarPartes(lista) {
    if (lista.length === 1) return this.apagarParte(lista[0]);
    if (!(await UI.confirm({ title: `Apagar ${lista.length} partes?`, msg: lista.map(p => esc(p.nome)).join(', ') + '. As partes encaixadas nelas passam para o pai delas.', ok: 'Apagar', danger: true }))) return;
    this.tirarPartes(lista); this.sel = this.def.raiz || this.def.partes[0]?.id || null; this.multi.clear(); this.focoImg = null; this.commit();
  },
  // tira as partes do personagem (sem confirmar nem salvar): filhos vão para o avô que fica; sessões e presets esquecem delas
  tirarPartes(lista) {
    const ids = new Set(lista.map(p => p.id)), fica = id => { while (id && ids.has(id)) id = this.parte(id)?.pai || null; return id || null; };
    for (const f of this.def.partes.filter(x => !ids.has(x.id) && ids.has(x.pai))) this.porNoPai(f.id, fica(f.pai), { semCommit: true });
    this.def.partes = this.def.partes.filter(x => !ids.has(x.id)); if (ids.has(this.def.raiz)) delete this.def.raiz;
    for (const s of this.def.sessoes) { s.partes = (s.partes || []).filter(x => !ids.has(x)); for (const pr of s.presets) for (const id of ids) delete pr.estado[id]; }
  },
  // partes que entraram sem querer viram IMAGENS (trocáveis) de outra parte. Ex.: 3 partes "olho aberto/fechado/bravo" → imagens de "Olhos".
  // Parte com 1 imagem: a imagem leva o nome da parte. Com várias: vão juntas numa pasta com o nome da parte.
  virarImagens(lista, alvo, pasta = null, o = {}) {
    lista = lista.filter(p => p && p.id !== alvo.id); if (!lista.length) return;
    const vazias = lista.filter(p => !p.imgs.length), comImg = lista.filter(p => p.imgs.length); let n = 0;
    for (const p of comImg) {
      const varias = p.imgs.length > 1;
      const est = this.estado(), mS = this.matParte(p.id, est), mA = this.matParte(alvo.id, est).inverse();
      for (const img of p.imgs) { const c = { ...img, id: uid('i') }; if (!varias) c.nome = p.nome;
        // a imagem continua no MESMO lugar na tela: o pivô dela é refeito no espaço da parte de destino
        const pv = img.pivo || { x: img.w / 2, y: img.h / 2 }, aj = img.ajuste || { x: 0, y: 0 }, tl = mA.transformPoint(mS.transformPoint(new DOMPoint(aj.x - pv.x, aj.y - pv.y)));
        if (isFinite(tl.x) && isFinite(tl.y)) c.pivo = { x: round(aj.x - tl.x, 2), y: round(aj.y - tl.y, 2) }; const pa = pasta || (varias ? p.nome : null); if (pa) c.pasta = pa; else delete c.pasta; alvo.imgs.push(c); n++; }
      if (varias && !pasta) { alvo.pastas = alvo.pastas || []; if (!alvo.pastas.includes(p.nome)) alvo.pastas.push(p.nome); }
    }
    if (pasta) { alvo.pastas = alvo.pastas || []; if (!alvo.pastas.includes(pasta)) alvo.pastas.push(pasta); }
    if (!alvo.base.img && alvo.imgs.length) alvo.base.img = alvo.imgs[0].id;
    this.tirarPartes(comImg); if (o.semCommit) return; this.escolhe(alvo.id); this.commit();
    UI.toast(n ? `${comImg.length > 1 ? comImg.length + ' partes viraram' : '"' + esc(comImg[0].nome) + '" virou'} ${n} imagem(ns) de <b>${esc(alvo.nome)}</b>. Clique numa imagem para trocar; dois cliques renomeiam (o editor troca pelo nome).${vazias.length ? ' Partes sem imagem ficaram como estavam.' : ''}` : 'Essas partes não têm imagens para mover.', { kind: n ? 'ok' : 'warn', time: 7000 });
  },
  novaParte(pai = null) { const p = Modelo.novaParte('Parte ' + (this.def.partes.length + 1), pai ?? (this.parte()?.id || null)); p.z = this.def.partes.length; this.def.partes.push(p); this.sel = p.id; this.commit(); setTimeout(() => this.addImagens(null, false), 50); },
  duplicarParte(p) {
    const mapa = {}, copia = (q, novoPai) => { const c = clone(q); c.id = uid('pt'); mapa[q.id] = c.id; c.pai = novoPai; c.nome = q.nome.replace(/esquerd[oa]/i, m => /a$/.test(m) ? 'direita' : 'direito').replace(/direit[oa]/i, m => /a$/.test(m) ? 'esquerda' : 'esquerdo'); if (c.nome === q.nome) c.nome += ' (cópia)';
      c.imgs = c.imgs.map(i => ({ ...i })); c.base.sx = -(c.base.sx || 1); c.encaixe = { x: q === p ? -q.encaixe.x : q.encaixe.x, y: q.encaixe.y }; this.def.partes.push(c);
      for (const f of this.def.partes.filter(x => x.pai === q.id && !Object.values(mapa).includes(x.id))) copia(f, c.id); return c; };
    const c = copia(p, p.pai); this.sel = c.id; this.commit(); UI.toast('Parte duplicada e espelhada. Arraste para o lugar.', { kind: 'ok' });
  },
  async apagarParte(p) {
    const filhos = this.def.partes.filter(x => x.pai === p.id);
    if (!(await UI.confirm({ title: `Apagar "${esc(p.nome)}"?`, msg: filhos.length ? `As ${filhos.length} parte(s) encaixadas nela passam para o pai dela.` : 'As imagens dela saem do personagem.', ok: 'Apagar', danger: true }))) return;
    this.tirarPartes([p]); this.sel = this.def.raiz || this.def.partes[0]?.id || null; this.multi.clear(); this.focoImg = null; this.commit();
  },
  // imagens: viram variações da parte escolhida (ou, soltas na lista de partes, uma parte nova cada)
  // imagens soltas no palco: na aba Pintar (editando uma imagem) pergunta se elas entram DENTRO da imagem, como camadas
  async soltouNoPalco(l) {
    const a = this.edImg && Pintura.alvo(); if (!l?.length) return;
    if (a && !l.some(f => f._parte)) {
      const r = await UI.modal({ title: 'Onde pôr a imagem?', icon: 'layers', width: 440, body: `<div>Você está editando <b>${esc(a.img.nome)}</b> (${esc(a.p.nome)}).<br><br><b>Dentro desta imagem</b>: ${l.length > 1 ? 'cada uma vira uma camada' : 'vira uma camada'} dela (a imagem passa a ter camadas, como no Photoshop).<br><b>Como imagem nova</b>: ${l.length > 1 ? 'viram imagens' : 'vira mais uma imagem'} da parte, como antes.</div>`,
        buttons: [{ label: 'Cancelar', value: null, left: true }, { label: 'Como imagem nova', value: 'nova' }, { label: 'Dentro desta imagem', kind: 'primary', value: 'dentro' }] });
      if (!r) return; if (r === 'dentro') { if (!Camadas.tem(a.img)) await Camadas.virar(a.img); for (const f of l) await Camadas.deArquivo(a.img, f); return UI.toast(`${l.length} camada(s) nova(s) em <b>${esc(a.img.nome)}</b>. Use <b>Mover camada (K)</b> para pôr no lugar.`, { kind: 'ok' }); }
    }
    return this.addImagens(l, !this.parte());
  },
  // a parte de uma pasta: a que já tem esse nome (soltar a pasta de novo junta nela) ou uma nova
  parteDaPasta(nome) {
    const n = Pastas.nrm(nome); let p = this.def.partes.find(x => Pastas.nrm(x.nome) === n);
    if (!p) { p = Modelo.novaParte(String(nome).slice(0, 40), null); p.z = this.def.partes.length; this.def.partes.push(p); } return p;
  },
  async addImagens(fs, cadaUmaParte, pasta = null, o = {}) {
    fs = fs ? await semVetor(fs) : await pickFiles('image/png,image/webp,image/gif,image/jpeg,' + VETOR, true); fs = (fs || []).filter(f => /^image\//.test(f.type) || /\.(png|webp|gif|jpe?g|svg)$/i.test(f.name)); if (!fs.length) return;
    let montado = o.montado || new Set(); const novasMontado = [];
    if (!o.semFolhas) { const pr = await this.prepararFolhas(fs, !cadaUmaParte && !!this.parte()?.imgs.length); if (!pr) return; fs = pr.fs; montado = pr.montado; } // folha de peças, fundo e tamanho: pergunta antes
    let p = this.parte();
    for (const f of fs) {
      const bm = await createImageBitmap(f).catch(() => null); if (!bm) { UI.toast(`"${esc(f.name)}" não é uma imagem que dá para usar`, { kind: 'err' }); continue; }
      let blob = f; if (bm.width > 2048 || bm.height > 2048 || f.size > 3 * 1048576) { const k = Math.min(1, 2048 / Math.max(bm.width, bm.height)), c = new OffscreenCanvas(Math.round(bm.width * k), Math.round(bm.height * k)); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); blob = await c.convertToBlob({ type: 'image/png' }); }
      const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : blob.type === 'image/gif' ? 'gif' : 'png', iid = uid('im').toLowerCase().replace(/[^a-z0-9]/g, '');
      const k = `personagens/${this.def.id}/img/${iid}.${ext}`; await Arq.guardar(blob, k); Arq.img.set(k, await createImageBitmap(blob));
      const nome = f.name.replace(/\.[^.]+$/, '').slice(0, 40);
      let alvo; if (f._parte) alvo = this.parteDaPasta(f._parte); // veio de uma pasta: a parte é a pasta
      else { if (cadaUmaParte || !p) { p = Modelo.novaParte(nome, null); p.z = this.def.partes.length; this.def.partes.push(p); } alvo = p; }
      const img = { id: uid('i'), nome, k, w: bm.width > 2048 || bm.height > 2048 ? Math.round(bm.width * Math.min(1, 2048 / Math.max(bm.width, bm.height))) : bm.width, h: bm.width > 2048 || bm.height > 2048 ? Math.round(bm.height * Math.min(1, 2048 / Math.max(bm.width, bm.height))) : bm.height };
      img.pivo = { x: img.w / 2, y: img.h / 2 }; img.ajuste = { x: 0, y: 0 }; const pz = f._pasta || (pasta && !cadaUmaParte ? pasta : null); if (pz) { img.pasta = pz; alvo.pastas = [...new Set([...(alvo.pastas || []), pz])]; }
      alvo.imgs.push(img); if (montado.has(f)) novasMontado.push(img);
      if (!alvo.base.img) alvo.base.img = img.id; else if (!cadaUmaParte && !f._parte) this.mudar(alvo.id, { img: img.id });
      if (cadaUmaParte) p = null;
    }
    if (novasMontado.length) try { await Pintura.apararLista(novasMontado); } catch { } // peças do "corpo desmontado": apara sem tirar do lugar
    if (!this.sel) this.sel = this.def.partes[0]?.id; this.commit(); this.enquadrar();
  },
  // pergunta sobre folhas de peças, fundo e tamanho (js/folhas.js). A referência de tamanho é a imagem da parte
  // onde as imagens vão entrar (versões) ou a peça principal do personagem; sem nada ainda, a maior imagem do lote.
  async prepararFolhas(fs, paraParte) {
    let ref = null;
    try {
      const p = this.parte(), daParte = q => q.imgs.find(i => i.id === this.estado()[q.id]?.img) || q.imgs.find(i => i.id === q.base.img) || q.imgs[0];
      let alvo = paraParte && p && daParte(p) ? { p, i: daParte(p) } : null;
      if (!alvo) { const r = this.def.partes.find(q => q.id === this.def.raiz && q.imgs.length); if (r) alvo = { p: r, i: daParte(r) };
        else alvo = this.def.partes.filter(q => q.imgs.length).map(q => ({ p: q, i: daParte(q) })).sort((x, y) => y.i.w * y.i.h - x.i.w * x.i.h)[0] || null; }
      if (alvo) { await Arq.garantir([alvo.i.k]); ref = Folhas.refDaImagem(alvo.i, `${alvo.p.nome} › ${alvo.i.nome}`); }
    } catch { }
    return Folhas.preparar(fs, { paraParte, ref });
  },
  // imagens da parte escolhida, em pastas (ex.: "olhos", "bocas"). Arrastar arquivos aqui põe nesta parte; numa pasta, dentro dela.
  pintaImgs() {
    const el = $('#at-imgs'), p = this.parte(); $('#at-imgs-t').textContent = p ? `Imagens de "${p.nome}"` : 'Imagens'; $('#at-imgs-t').title = p ? 'Arraste partes da lista de cima para cá: elas viram imagens trocáveis desta parte' : ''; el.innerHTML = '';
    if (!p) { el.innerHTML = '<div class="vazio" style="grid-column:1/-1">Escolha uma parte.</div>'; return; }
    p.pastas = [...new Set([...(p.pastas || []), ...p.imgs.map(i => i.pasta).filter(Boolean)])];
    const atual = this.estado()[p.id]?.img, fechadas = this.pastasFechadas || (this.pastasFechadas = new Set());
    const solta = (alvo, pasta) => { // soltar arquivos do computador ou uma imagem arrastada daqui
      alvo.ondragover = ev => { const t = ev.dataTransfer.types; if (t.includes('Files') || t.includes('text/img') || t.includes('text/parte')) { ev.preventDefault(); ev.stopPropagation(); alvo.classList.add('drop-dentro'); } };
      alvo.ondragleave = ev => { if (!alvo.contains(ev.relatedTarget)) alvo.classList.remove('drop-dentro'); };
      alvo.ondrop = ev => { ev.preventDefault(); ev.stopPropagation(); alvo.classList.remove('drop-dentro');
        if (ev.dataTransfer.files?.length) return Pastas.deDrop(ev.dataTransfer).then(l => this.addImagens(Pastas.paraParte(l), false, pasta));
        const pid = ev.dataTransfer.getData('text/parte'); if (pid) { const ids = this._arrasto?.includes(pid) ? this._arrasto : [pid]; this._arrasto = null; return this.virarImagens(ids.map(i => this.parte(i)), p, pasta); } // parte arrastada da lista: vira imagem desta parte
        const img = p.imgs.find(i => i.id === ev.dataTransfer.getData('text/img')); if (img && (img.pasta || null) !== pasta) { if (pasta) img.pasta = pasta; else delete img.pasta; this.commit(); } };
    };
    const card = img => {
      const bm = Arq.bitmap(img.k, () => this.pintaImgs()), c = h(`<div data-iid="${img.id}" class="im ${img.id === atual ? 'on' : ''} ${this.focoImg?.img === img.id ? 'foco' : ''} ${this.marcas().imgs.has(img.id) ? 'mod' : ''} ${this.moverTodos ? 'todos' : this.modoMover === 'imagem' && img.id === atual ? 'mesma' : ''}" draggable="true" title="${esc(img.nome)} — clique para usar${this.edit ? ' neste preset' : ' na base'} · arraste para uma pasta"><span>${esc(img.nome)}</span>${Camadas.tem(img) ? `<i class="im-cam" title="Imagem com ${img.camadas.length} camada${img.camadas.length > 1 ? 's' : ''} (Pintar e cores › Camadas)">${ic('layers', 11)}${img.camadas.length}</i>` : ''}<button class="ibtn x" title="Tirar a imagem">${ic('x', 12)}</button></div>`);
      if (bm) { const cv = document.createElement('canvas'); cv.width = 96; cv.height = 96; const k = Math.min(96 / bm.width, 96 / bm.height); cv.getContext('2d').drawImage(bm, (96 - bm.width * k) / 2, (96 - bm.height * k) / 2, bm.width * k, bm.height * k); c.style.backgroundImage = `url(${cv.toDataURL()})`; }
      c.onclick = ev => { if (ev.target.closest('.x')) return; this.focoImg = { p: p.id, img: img.id };
        // parado num passo da animação: trocar a imagem NÃO muda a animação (ela só guarda poses) — só escolhe a imagem
        if (Animacoes.passoAtual()) { Animacoes.alvoPausa(p.id); this.mudar(p.id, { img: img.id }); this.commit(); if (!this._avisouImg) { this._avisouImg = true; UI.toast('Imagem trocada <b>só neste frame</b>.', { time: 3500 }); } return; } // passo parado: a imagem muda só nele (keyframe)
        if (this.edImg) { this.edImg = { pid: p.id, iid: img.id }; return this.pinta(); }
        this.mudar(p.id, { img: img.id }); this.commit(); this.pintaImgs(); };
      c.ondblclick = ev => { if (ev.target.closest('.x')) return; this.abrirEditor(p, img); }; // EDITOR DE IMAGEM (estilo Photoshop)
      c.ondragstart = ev => { ev.dataTransfer.setData('text/img', img.id); ev.dataTransfer.effectAllowed = 'move'; };
      c.oncontextmenu = ev => { ev.preventDefault(); UI.ctx(ev.clientX, ev.clientY, [
        { label: 'Editar a imagem…', icon: 'brush', action: () => this.abrirEditor(p, img) },
        { label: 'Usar esta imagem', icon: 'check', action: () => { this.mudar(p.id, { img: img.id }); this.commit(); } },
        { label: 'Renomear', icon: 'edit', action: () => this.renomearImg(img) },
        Camadas.tem(img) ? { label: 'Juntar as camadas (imagem só)', icon: 'layers', action: () => Camadas.achatarTudo(img) } : { label: 'Editar com camadas', icon: 'layers', action: async () => { this.mudar(p.id, { img: img.id }); await Camadas.virar(img); this.aba = 'pintar'; this.pinta(); } },
        (() => { const vis = p.imgs.find(i => i.id === this.estado()[p.id]?.img); return vis && vis !== img ? { label: `Pôr como camada em "${vis.nome}"`, icon: 'layers', action: async () => { if (!Camadas.tem(vis)) await Camadas.virar(vis); await Camadas.deImagem(vis, img); } } : null; })(),
        p.imgs.length > 1 && { label: 'Todas as outras no mesmo lugar desta', icon: 'move', sub: [{ label: 'Pelo centro', action: () => this.alinharImagens(p, 'centro', img) }, { label: 'Por baixo (pés no mesmo chão)', action: () => this.alinharImagens(p, 'baixo', img) }, { label: 'Por cima', action: () => this.alinharImagens(p, 'cima', img) }] },
        { label: 'Mover para a pasta', icon: 'folder', sub: [{ label: '(sem pasta)', checked: !img.pasta, action: () => { delete img.pasta; this.commit(); } }, ...p.pastas.map(n => ({ label: n, checked: img.pasta === n, action: () => { img.pasta = n; this.commit(); } })), '-', { label: 'Pasta nova…', icon: 'plus', action: async () => { const n = await this.novaPastaImg(p); if (n) { img.pasta = n; this.commit(); } } }] },
        '-', { label: 'Tirar a imagem', icon: 'trash', key: 'Delete', danger: true, action: () => this.tirarImg(p, img) },
      ]); };
      $('.x', c).onclick = () => this.tirarImg(p, img);
      return c;
    };
    for (const nome of p.pastas) {
      const dentro = p.imgs.filter(i => i.pasta === nome), aberta = !fechadas.has(p.id + '/' + nome);
      const corP = p.pastaCores?.[nome];
      const cab = h(`<div class="pasta-img ${aberta ? 'aberta' : ''} ${corP ? 'com-cor' : ''}" data-pasta="${esc(nome)}" style="${corP ? `--pc:${corP}` : ''}" title="Clique para abrir/fechar · solte imagens aqui · botão direito: opções">${ic(aberta ? 'down' : 'right', 12)}${ic('folder', 14)}<b>${esc(nome)}</b><small>${dentro.length}</small><span class="sp"></span><button class="ibtn" data-add title="Pôr imagens nesta pasta">${ic('plus', 13)}</button></div>`);
      cab.onclick = ev => { if (ev.target.closest('[data-add]')) return; const k = p.id + '/' + nome; fechadas.has(k) ? fechadas.delete(k) : fechadas.add(k); this.pintaImgs(); };
      $('[data-add]', cab).onclick = () => this.addImagens(null, false, nome);
      cab.oncontextmenu = ev => { ev.preventDefault(); UI.ctx(ev.clientX, ev.clientY, [
        { label: 'Pôr imagens nesta pasta…', icon: 'plus', action: () => this.addImagens(null, false, nome) },
        menuCor(corP, c => { p.pastaCores = p.pastaCores || {}; if (c) p.pastaCores[nome] = c; else delete p.pastaCores[nome]; this.commit(); }),
        { label: 'Renomear a pasta', icon: 'edit', action: async () => { const n = (await UI.prompt({ title: 'Nome da pasta', value: nome }))?.trim(); if (!n || n === nome) return; if (p.pastas.includes(n)) return UI.toast('Já existe uma pasta com esse nome'); p.pastas = p.pastas.map(x => x === nome ? n : x); dentro.forEach(i => i.pasta = n); this.commit(); } },
        '-', { label: 'Desfazer a pasta (as imagens ficam)', icon: 'trash', action: () => { p.pastas = p.pastas.filter(x => x !== nome); dentro.forEach(i => delete i.pasta); this.commit(); } },
      ]); };
      solta(cab, nome); el.appendChild(cab);
      if (aberta) { for (const img of dentro) el.appendChild(card(img)); if (!dentro.length) el.appendChild(h('<div class="vazio pasta-vazia">Pasta vazia: arraste imagens para cá.</div>')); }
    }
    const soltas = p.imgs.filter(i => !i.pasta);
    if (p.pastas.length && soltas.length) el.appendChild(h(`<div class="pasta-img solta">${ic('image', 14)}<b>Sem pasta</b><small>${soltas.length}</small></div>`));
    for (const img of soltas) el.appendChild(card(img));
    const add = h(`<div class="im add" title="Pôr imagens nesta parte (ou arraste os arquivos para cá)">${ic('plus', 18)}</div>`); add.onclick = () => this.addImagens(); el.appendChild(add);
    solta(el, null);
  },
  async novaPastaImg(p) {
    const n = (await UI.prompt({ title: 'Pasta nova', label: 'Ex.: olhos, bocas, mãos, roupas', value: '' }))?.trim().slice(0, 30); if (!n) return null;
    p.pastas = p.pastas || []; if (!p.pastas.includes(n)) p.pastas.push(n); this.commit(); return n;
  },
  async renomearImg(img) { const n = await UI.prompt({ title: 'Nome da imagem', label: 'Ex.: aberto, fechado, chutando', value: img.nome }); if (n) { img.nome = n; this.commit(); } },
  async tirarImg(p, img) {
    if (!(await UI.confirm({ title: `Tirar a imagem "${esc(img.nome)}"?`, ok: 'Tirar', danger: true }))) return;
    if (this.focoImg?.img === img.id) this.focoImg = null; p.imgs = p.imgs.filter(i => i !== img); if (p.base.img === img.id) p.base.img = p.imgs[0]?.id || null;
    for (const s of this.def.sessoes) for (const pr of s.presets) if (pr.estado[p.id]?.img === img.id) delete pr.estado[p.id].img; this.commit();
  },
  pintaPeca(el) {
    // PEÇA, enxuta: o principal à vista (pai, giro, tamanho, espelhar, aparece); os números finos ficam fechados em "Ajuste fino"
    const p = this.parte(); if (!p) { el.appendChild(h('<div class="vazio">Escolha uma parte na lista ou clique numa peça.</div>')); return; }
    const est = this.estado()[p.id] || {}, img = p.imgs.find(i => i.id === est.img), onde = Animacoes.passoAtual() ? Animacoes.textoAlvo() : this.edit ? this.preset().nome : 'padrão', ehRaiz = p.id === this.def.raiz;
    const box = h(`<div class="props peca-c"><div class="pc-t"><b>${esc(p.nome)}</b><small>${esc(onde)}</small><span class="sp"></span><button class="ibtn ${ehRaiz ? 'on' : ''}" data-raiz title="${ehRaiz ? 'É a raiz (a parte principal)' : 'Marcar como raiz (a parte principal)'}">${ic('star', 14)}</button></div>
      <label class="field">Encaixa em<select data-pai><option value="">(nenhuma)</option>${this.def.partes.filter(x => x.id !== p.id).map(x => `<option value="${x.id}" ${x.id === p.pai ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label></div>`);
    $('[data-pai]', box).onchange = ev => this.porNoPai(p.id, ev.target.value || null); $('[data-raiz]', box).onclick = () => this.marcarRaiz(p);
    const mexe = (c, v) => { this.mudar(p.id, { [c]: v }); this.desenha(); }, sol = () => this.commit(), noPasso = !!Animacoes.passoAtual();
    box.appendChild(Lado.campo('Girar', est.r || 0, -180, 180, .5, v => mexe('r', v), sol)); box.appendChild(Lado.campo('Tamanho', est.s ?? 1, .05, 4, .01, v => mexe('s', v), sol));
    const o = h(`<div class="campo2"><label class="chk"><input type="checkbox" data-sx ${est.sx < 0 ? 'checked' : ''}> Espelhar</label><label class="chk"><input type="checkbox" data-v ${est.vis !== false ? 'checked' : ''}> Aparece</label></div>`);
    $('[data-sx]', o).onchange = ev => { this.mudar(p.id, { sx: ev.target.checked ? -1 : 1 }); this.commit(); }; $('[data-v]', o).onchange = ev => { this.mudar(p.id, { vis: ev.target.checked }); this.commit(); }; box.appendChild(o);
    if (this.edit && !noPasso && this.preset().estado[p.id]) { const lb = h(`<button class="btn sm">${ic('undo', 13)} Igual à padrão nesta pose</button>`); lb.onclick = () => { delete this.preset().estado[p.id]; this.commit(); }; box.appendChild(lb); }
    const fino = h(`<details class="ab-sec"><summary>Ajuste fino</summary></details>`);
    if (this.edit || noPasso) { fino.appendChild(Lado.campo('Mover X', est.x || 0, -500, 500, 1, v => mexe('x', v), sol)); fino.appendChild(Lado.campo('Mover Y', est.y || 0, -500, 500, 1, v => mexe('y', v), sol)); }
    else { fino.appendChild(Lado.campo('Encaixe X', p.encaixe.x, -1500, 1500, 1, v => { p.encaixe.x = v; this.desenha(); }, sol)); fino.appendChild(Lado.campo('Encaixe Y', p.encaixe.y, -1500, 1500, 1, v => { p.encaixe.y = v; this.desenha(); }, sol)); }
    if (img) { fino.appendChild(Lado.campo('Pivô X', img.pivo.x, 0, img.w, 1, v => { img.pivo.x = v; this.desenha(); }, sol)); fino.appendChild(Lado.campo('Pivô Y', img.pivo.y, 0, img.h, 1, v => { img.pivo.y = v; this.desenha(); }, sol));
      fino.appendChild(Lado.campo('Só a imagem X', img.ajuste.x, -300, 300, 1, v => { img.ajuste.x = v; this.desenha(); }, sol)); fino.appendChild(Lado.campo('Só a imagem Y', img.ajuste.y, -300, 300, 1, v => { img.ajuste.y = v; this.desenha(); }, sol)); }
    fino.open = !!this._finoAberto; fino.ontoggle = () => { this._finoAberto = fino.open; }; box.appendChild(fino);
    el.appendChild(box);
  },
  pintaSessoes(el) {
    const def = this.def, box = h(`<div class="sessoes-at"><div class="campo2"><button class="btn sm" data-nova>${ic('plus', 13)} Sessão</button><button class="btn sm" data-prontas>${ic('layers', 13)} Sessões prontas</button></div></div>`);
    $('[data-nova]', box).onclick = () => this.novaSessao(); $('[data-prontas]', box).onclick = () => this.sessoesProntas();
    // PASSO DA TIMELINE: clicar numa pose faz este passo usar ela (a animação só guarda poses). Fora disso: clicar numa pose abre ela para arrumar
    const st = Animacoes.passoAtual(), T = this.teste || { sessoes: {} };
    if (st) box.appendChild(h(`<div class="ps-aviso passo">${ic('film', 13)}<span>Frame <b>${st.pi + 1}</b>: clique nas poses dele</span></div>`));
    if (!def.sessoes.length) box.appendChild(h('<div class="vazio">Sessões são grupos de presets: <b>Olhos</b> (assustado, surpreso, triste, fechado…), <b>Boca</b>, <b>Perna direita</b> (chutando, inclinada…), <b>Pose</b> (corpo todo).<br><br>Na animação, cada sessão vira uma fila de botões: clicou, virou chave naquele quadro.</div>'));
    for (const s of def.sessoes) {
      const aberta = this.edit?.s === s.id, nomesPartes = (s.partes || []).map(id => this.parte(id)?.nome).filter(Boolean);
      const daSel = !!this.sel && (s.partes || []).includes(this.sel); // a parte escolhida no palco está nesta sessão: leve destaque (para achar onde trocar/pôr presets dela)
      const c = h(`<div class="sess ${aberta ? 'aberta' : ''}${daSel ? ' da-sel' : ''}"${daSel ? ` title="${esc(this.parte(this.sel)?.nome || '')} está nesta sessão"` : ''}><div class="cab"><b>${esc(s.nome)}</b>${daSel ? `<span class="sess-tag">${ic('cursor', 10)} ${esc(this.parte(this.sel)?.nome || '')}</span>` : ''}<small title="Partes que esta sessão mexe">${nomesPartes.length ? esc(nomesPartes.slice(0, 3).join(', ')) + (nomesPartes.length > 3 ? '…' : '') : 'todas as partes'}</small>
        <button class="ibtn ia" data-ia title="Criar um preset com a IA">${ic('sparkles', 13)}</button><button class="ibtn" data-m title="Mais">${ic('dots', 13)}</button></div><div class="lista presets"></div></div>`);
      const l = $('.lista', c);
      // "Padrão" = a base: clicar nele (ou de novo no preset marcado) volta a montar a pose padrão
      const noPasso = st ? (T.sessoes?.[s.id] || null) : undefined;
      const bP = h(`<button class="padrao ${st ? (!noPasso ? 'on' : '') : !aberta ? 'on' : ''}" title="${st ? 'Este frame sem pose desta sessão (fica a pose padrão)' : 'Pose padrão (a base): clique para ver e mudar a pose padrão'}">${ic('home', 11)} Padrão</button>`);
      bP.onclick = () => { if (st) return Animacoes.usarPose(s, null); this.edit = null; this.editPasso = null; this.pinta(); }; l.appendChild(bP);
      const mk = this.marcas(), pS = this.parte(), imS = pS && pS.imgs.find(i => i.id === this.estado()[pS.id]?.img), daParte = this.moverTodos && this.sel ? this.presetsDaParte(this.sel) : this.modoMover === 'imagem' && imS ? new Set(this.ondeAparece(pS, imS).map(o => o.pr?.id).filter(Boolean)) : null;
      for (const pr of s.presets) { const b = h(`<button data-prid="${pr.id}" class="${aberta && this.edit.p === pr.id ? 'on' : ''} ${mk.presets.has(pr.id) ? 'mod' : this.local().presets.has(pr.id) ? 'loc' : ''} ${daParte?.has(pr.id) ? (this.moverTodos ? 'todos' : 'mesma') : ''}" title="Clique para editar · botão direito: opções${mk.presets.has(pr.id) ? ' · mudou desde a última vez na nuvem' : ''}">${esc(pr.nome)}</button>`);
        ordenavel(b, 'preset-' + s.id, pr.id, (id, antes) => { const i = s.presets.findIndex(x => x.id === id), j = s.presets.indexOf(pr); if (i >= 0) { moveNaLista(s.presets, i, j, antes); this.commit(); } }, true); // arrastar muda a ordem
        if (st) b.classList.toggle('on', noPasso === pr.id);
        b.onclick = ev => { if (ev.detail > 1) return; /* o 2º clique do duplo não conta */ if (st) return Animacoes.usarPose(s, pr); this.edit = aberta && this.edit.p === pr.id ? null : { s: s.id, p: pr.id }; this.pinta(); }; // no passo: usa a pose nele · fora: abre para arrumar (de novo desmarca)
        b.ondblclick = () => { Linha.parar?.(); this.trocarImagemPreset(s, pr); }; // dois cliques: sai do frame e troca a imagem DESTE preset
        b.oncontextmenu = ev => { ev.preventDefault(); this.menuPreset(ev, s, pr); }; this.previaPreset(b, s, pr); l.appendChild(b); }
      const add = h(`<button title="Preset novo com o que está na tela">+ preset</button>`); add.onclick = () => this.novoPreset(s); l.appendChild(add);
      $('[data-ia]', c).onclick = () => this.presetIA(s); $('[data-m]', c).onclick = ev => this.menuSessao(ev, s);
      ordenavel($('.cab', c), 'sessao', s.id, (id, antes) => { const L = this.def.sessoes, i2 = L.findIndex(x => x.id === id), j2 = L.indexOf(s); if (i2 >= 0) { moveNaLista(L, i2, j2, antes); this.commit(); } }); // arrastar a sessão muda a ordem
      box.appendChild(c);
    }
    el.appendChild(box); if (this.sel !== this._selPoses) { this._selPoses = this.sel; const ds = $('.sess.da-sel', box); if (ds) requestAnimationFrame(() => ds.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); } /* escolheu outra parte: a sessão dela aparece */
  },
  // passar o mouse num preset: janelinha em cima do mouse com o desenho daquela pose (zoom nas partes da sessão)
  // janelinha em cima do mouse com um desenho (gera = função que devolve o canvas, rotulo = texto de baixo)
  previaHover(b, gera, rotulo) {
    let to = null; const fecha = () => { clearTimeout(to); this._prevPr?.remove(); this._prevPr = null; };
    b.addEventListener('mouseenter', ev => { fecha(); let mx = ev.clientX, my = ev.clientY; b.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; if (this._prevPr) this.posPrevia(this._prevPr, mx, my); });
      to = setTimeout(async () => { const cv = await gera().catch(() => null); if (!cv || !b.isConnected || !b.matches(':hover') || document.body.classList.contains('arrastando')) return;
        const pop = this._prevPr = h(`<div class="prev-pr"><div class="prev-pr-im"></div><small>${rotulo}</small></div>`); $('.prev-pr-im', pop).appendChild(cv); document.body.appendChild(pop); this.posPrevia(pop, mx, my); }, 220); });
    b.addEventListener('mouseleave', fecha); b.addEventListener('mousedown', fecha); b.addEventListener('dragstart', fecha);
  },
  previaPreset(b, s, pr) { this.previaHover(b, () => this.desenhoPreset(s, pr), `${esc(s.nome)} › <b>${esc(pr.nome)}</b>`); },
  posPrevia(pop, x, y) { const r = pop.getBoundingClientRect(); pop.style.left = clamp(x - r.width / 2, 6, innerWidth - r.width - 6) + 'px'; pop.style.top = (y - r.height - 14 < 50 ? y + 18 : y - r.height - 14) + 'px'; },
  async desenhoPreset(s, pr) { return this.desenhoEstado({ sessoes: { [s.id]: pr.id } }, s.partes?.length ? s.partes : null, true); },
  // desenho do personagem com estas escolhas ({ sessoes, partes }); destaque = ids das partes que ficam claras (o resto escurece); zoom = só em volta delas
  async desenhoEstado(escolhas, destaque, zoom) {
    const def = this.def, chave = JSON.stringify([def.vistaAtual, escolhas, destaque, zoom, this.ultimo?.length]); this._prevCache ||= new Map();
    const copia = o => { const c = document.createElement('canvas'); c.width = o.width; c.height = o.height; c.getContext('2d').drawImage(o, 0, 0); return c; };
    if (this._prevCache.has(chave)) return copia(this._prevCache.get(chave));
    await Arq.garantir(Modelo.chavesImgs(def)).catch(() => { });
    const est = Modelo.partesNoEstado(def, escolhas), itens = Modelo.montar(def, est).filter(it => it.img && Arq.img.get(it.img.k));
    const ids = destaque?.length ? new Set([...destaque, ...def.partes.filter(p => destaque.includes(p.pai)).map(p => p.id)]) : null;
    const caixa = so => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const it of itens) { if (so && !so.has(it.parte.id)) continue; const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2;
      for (const [a, c] of [[0, 0], [it.img.w, 0], [0, it.img.h], [it.img.w, it.img.h]]) { const q = it.m.transformPoint(new DOMPoint(a - px + (it.img.ajuste?.x || 0), c - py + (it.img.ajuste?.y || 0))); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); } }
      return x1 > x0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null; };
    const tudo = caixa(null); if (!tudo) return null;
    let b = zoom && ids ? caixa(ids) : null;
    if (b) { const m = Math.max(b.w, b.h) * .45 + 20, cx = b.x + b.w / 2, cy = b.y + b.h / 2, l = Math.max(b.w, b.h) + m * 2; b = { x: cx - l / 2, y: cy - l / 2, w: l, h: l }; } else b = tudo;
    const L = 190, k = Math.min(L / b.w, L / b.h), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(b.w * k)); cv.height = Math.max(1, Math.round(b.h * k));
    const x = cv.getContext('2d'), base = new DOMMatrix().scale(k).translate(-b.x, -b.y); x.imageSmoothingQuality = 'high';
    const poe = (ctx, it) => { ctx.setTransform(base.multiply(it.m)); ctx.drawImage(Arq.img.get(it.img.k), -(it.img.pivo?.x ?? it.img.w / 2) + (it.img.ajuste?.x || 0), -(it.img.pivo?.y ?? it.img.h / 2) + (it.img.ajuste?.y || 0), it.img.w, it.img.h); };
    for (const it of itens) poe(x, it);
    // DESTAQUE: o resto do personagem fica escuro e as partes indicadas aparecem claras (só o que está à vista delas: o que fica na frente continua tapando)
    if (ids) {
      const hl = document.createElement('canvas'); hl.width = cv.width; hl.height = cv.height; const y = hl.getContext('2d'); y.imageSmoothingQuality = 'high';
      for (const it of itens) { y.globalCompositeOperation = ids.has(it.parte.id) ? 'source-over' : 'destination-out'; poe(y, it); }
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(0,0,0,.62)'; x.fillRect(0, 0, cv.width, cv.height); x.globalCompositeOperation = 'source-over'; x.drawImage(hl, 0, 0);
    }
    if (this._prevCache.size > 60) this._prevCache.clear(); this._prevCache.set(chave, cv); return copia(cv);
  },
  async novaSessao(nome) {
    // escolher as partes: cartões com a miniatura de cada parte (passar o mouse aumenta), marcador redondo e "todas" quando nenhuma marcada
    const def = this.def, est = this.estado(), body = h(`<div class="ns"><label class="field">Nome da sessão<input type="text" value="${esc(nome || '')}" placeholder="Ex.: Olhos, Boca, Perna direita, Pose"></label>
      <div class="field">Partes que ela mexe <small data-res></small></div><div class="ns-grade">${def.partes.filter(p => !Referencia.ehRef(p)).map(p => `<label class="ns-p${p.id === this.sel ? ' on' : ''}" title="${esc(p.nome)}"><input type="checkbox" value="${p.id}" ${p.id === this.sel ? 'checked' : ''}><span class="ns-mini"><canvas width="96" height="96" data-p="${p.id}"></canvas></span><span class="ns-nome">${esc(p.nome)}</span><i class="ns-chk">${ic('check', 12)}</i></label>`).join('')}</div>
      <div class="ns-acoes"><button class="btn sm" type="button" data-todas>Marcar todas</button><button class="btn sm" type="button" data-nenhuma>Limpar</button></div></div>`);
    const res = () => { const n = $$('input[type=checkbox]:checked', body).length; $('[data-res]', body).textContent = n ? `${n} marcada${n === 1 ? '' : 's'}` : 'nenhuma marcada = todas (poses do corpo todo)'; $$('.ns-p', body).forEach(l => l.classList.toggle('on', $('input', l).checked)); };
    $$('input[type=checkbox]', body).forEach(i => i.onchange = res); $('[data-todas]', body).onclick = () => { $$('input[type=checkbox]', body).forEach(i => i.checked = true); res(); }; $('[data-nenhuma]', body).onclick = () => { $$('input[type=checkbox]', body).forEach(i => i.checked = false); res(); }; res();
    // miniatura: a imagem que a parte mostra agora (ou a 1ª dela)
    for (const cv of $$('canvas[data-p]', body)) { const p = this.parte(cv.dataset.p), e = est[p?.id] || {}, img = p?.imgs.find(x => x.id === e.img) || p?.imgs[0]; if (!img) continue;
      const pinta = bm => { if (!bm) return; const x = cv.getContext('2d'), k = Math.min(88 / bm.width, 88 / bm.height); x.clearRect(0, 0, 96, 96); x.drawImage(bm, (96 - bm.width * k) / 2, (96 - bm.height * k) / 2, bm.width * k, bm.height * k); };
      pinta(Arq.bitmap(img.k, () => pinta(Arq.img.get(img.k)))); }
    const r = await UI.modal({ title: 'Sessão nova', icon: 'layers', width: 560, body, enterValue: true, buttons: [{ label: 'Cancelar', value: null }, { label: 'Criar', kind: 'primary', collect: a => ({ nome: $('input[type=text]', a.body).value.trim(), partes: $$('input[type=checkbox]:checked', a.body).map(i => i.value) }) }] });
    if (!r?.nome) return; const s = { id: uid('s'), nome: r.nome, partes: r.partes, presets: [] }; def.sessoes.push(s); this.aba = 'sessoes'; this.commit(); this.novoPreset(s, 'normal');
  },
  // SESSÕES PRONTAS: antes de criar, mostra o que vai ser feito (sessões novas, as que já existem e ficam como estão, e as que vão mexer nas mesmas partes de uma que já existe)
  async sessoesProntas() {
    const def = this.def, plano = [], existem = [];
    for (const sp of SESSOES_PRONTAS) {
      const ja = def.sessoes.find(s => s.nome.toLowerCase() === sp.nome.toLowerCase()); if (ja) { existem.push(ja.nome); continue; }
      const partes = sp.nome === 'Pose' ? [] : def.partes.filter(p => sp.acha.test(p.nome)).map(p => p.id); if (sp.nome !== 'Pose' && !partes.length) continue;
      const choca = def.sessoes.filter(s => s.partes?.length && partes.some(id => s.partes.includes(id))).map(s => s.nome);
      plano.push({ sp, partes, choca });
    }
    if (!plano.length) return UI.toast(existem.length ? `As sessões prontas que dá para fazer com estas partes já existem (${esc(existem.join(', '))}).` : 'Dê nomes às partes (ex.: "Olho direito", "Boca", "Perna direita") para eu achar as sessões.', { kind: 'warn', time: 6000 });
    const nomes = ids => ids.map(id => this.parte(id)?.nome).filter(Boolean), body = h(`<div class="sp-pronta">
      <div style="color:var(--tx2);font-size:12.5px;margin-bottom:8px">Pelos nomes das partes, dá para criar estas sessões, cada uma com presets <b>vazios</b> para você montar. Nada que já existe é apagado ou mudado.</div>
      ${plano.map((x, i) => `<label class="chk sp-l"><input type="checkbox" data-i="${i}" checked><span><b>${esc(x.sp.nome)}</b> <small>${x.partes.length ? 'mexe em ' + esc(nomes(x.partes).join(', ')) : 'o corpo todo'} · ${x.sp.presets.length} presets: ${esc(x.sp.presets.slice(0, 6).join(', '))}${x.sp.presets.length > 6 ? '…' : ''}</small>${x.choca.length ? `<em class="sp-av">${ic('alert', 12)} mexe nas mesmas partes de <b>${esc(x.choca.join(', '))}</b>: num quadro que use as duas, vale a que vier depois na lista</em>` : ''}</span></label>`).join('')}
      ${existem.length ? `<div class="sp-ja">${ic('check', 12)} Já existem e ficam como estão: ${esc(existem.join(', '))}</div>` : ''}</div>`);
    const r = await UI.modal({ title: 'Criar sessões prontas?', icon: 'layers', width: 520, body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Criar as marcadas', kind: 'primary', collect: a => $$('input[data-i]:checked', a.body).map(c => +c.dataset.i) }] });
    if (!r?.length) return;
    for (const i of r) { const x = plano[i]; def.sessoes.push({ id: uid('s'), nome: x.sp.nome, partes: x.partes, presets: x.sp.presets.map(nm => ({ id: uid('pr'), nome: nm, estado: {} })) }); }
    this.aba = 'sessoes'; this.commit(); UI.toast(`${r.length} sess${r.length === 1 ? 'ão criada' : 'ões criadas'} com presets vazios: clique em cada preset e monte. Ctrl+Z desfaz.`, { kind: 'ok', time: 6000 });
  },
  // preset novo = como as partes da sessão estão agora na tela
  async novoPreset(s, nome) {
    nome = nome || await UI.prompt({ title: `Preset novo em "${s.nome}"`, label: 'Nome (ex.: assustado, chutando)', ok: 'Criar' }); if (!nome) return;
    const est = this.estado(), partes = s.partes?.length ? s.partes : this.def.partes.map(p => p.id), estado = {};
    for (const pid of partes) { const p = this.parte(pid); if (!p) continue; const e = est[pid], b = p.base, d = {}; for (const c of ['img', 'x', 'y', 'r', 's', 'sx', 'vis']) if (e[c] !== b[c] && e[c] !== undefined) d[c] = e[c]; if (Object.keys(d).length) estado[pid] = d; }
    const pr = { id: uid('pr'), nome, estado }; s.presets.push(pr);
    // o preset novo fica separado do frame: para a animação de teste, sai do frame e já escolhe a parte da sessão (ex.: Boca)
    this.sairDoFrame(); this.edit = { s: s.id, p: pr.id }; this.aba = 'sessoes';
    const foco = this.parteDaSessao(s); if (foco) this.escolhe(foco.id);
    this.commit();
    UI.toast(`Preset <b>${esc(nome)}</b> criado${foco ? ` com a parte <b>${esc(foco.nome)}</b> escolhida` : ''}. O que você mexer agora vale só para ele. Dois cliques no preset trocam a imagem dele.`, { kind: 'ok', time: 5000 });
  },
  // sai de qualquer frame/animação de teste (parada ou tocando): o que mexer depois vale para o preset ou a base
  sairDoFrame() { try { Animacoes.parar(true); } catch { } Animacoes.poseFixa = null; this.editPasso = null; this.teste = null; },
  // a parte "responsável" da sessão: a que tem o mesmo nome (sessão Boca → parte Boca); senão a 1ª da sessão
  parteDaSessao(s) {
    const n = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(), ns = n(s.nome);
    const ps = (s.partes || []).map(id => this.parte(id)).filter(Boolean);
    return ps.find(p => n(p.nome) === ns) || ps.find(p => n(p.nome).includes(ns) || ns.includes(n(p.nome))) || ps[0] || null;
  },
  // dois cliques no preset: escolher a imagem de cada parte só NESTE preset (fora de qualquer frame, para não confundir)
  trocarImagemPreset(s, pr) {
    this.sairDoFrame(); this.edit = { s: s.id, p: pr.id }; this.aba = 'sessoes';
    const foco = this.parteDaSessao(s), ids = s.partes?.length ? s.partes : Object.keys(pr.estado || {});
    const ps = ids.map(id => this.parte(id)).filter(p => p && p.imgs.length).sort((a, b) => (b === foco) - (a === foco));
    if (foco) this.escolhe(foco.id); this.pinta();
    if (!ps.length) return UI.toast('Esta sessão ainda não tem partes com imagens.', { kind: 'warn' });
    const body = h(`<div class="pr-imgs"><div class="pr-imgs-nota">Vale só para o preset <b>${esc(s.nome)} › ${esc(pr.nome)}</b> (os frames das animações não mudam).</div></div>`);
    const pinta = () => {
      $$('.pr-imgs-p', body).forEach(x => x.remove()); const est = this.estado();
      for (const p of ps) {
        const sec = h(`<div class="pr-imgs-p"><div class="pr-imgs-t">${esc(p.nome)}${p === foco ? ' <small>(desta sessão)</small>' : ''}</div><div class="pr-imgs-g"></div></div>`), g = $('.pr-imgs-g', sec);
        for (const img of p.imgs) {
          const c = h(`<button type="button" class="pr-imgs-i ${est[p.id]?.img === img.id ? 'on' : ''}" title="${esc(img.nome || '')}"><span></span><small>${esc(img.nome || '')}</small></button>`);
          const desenha = () => { const bm = Arq.bitmap(img.k, desenha); if (!bm) return; const cv = document.createElement('canvas'); cv.width = cv.height = 72; const k = Math.min(72 / bm.width, 72 / bm.height); cv.getContext('2d').drawImage(bm, (72 - bm.width * k) / 2, (72 - bm.height * k) / 2, bm.width * k, bm.height * k); $('span', c).style.backgroundImage = `url(${cv.toDataURL()})`; };
          desenha();
          c.onclick = () => { this.edit = { s: s.id, p: pr.id }; this.mudar(p.id, { img: img.id }); this.commit(); pinta(); };
          g.appendChild(c);
        }
        body.appendChild(sec);
      }
    };
    pinta();
    UI.modal({ title: `Imagem do preset "${pr.nome}"`, icon: 'image', width: 520, body, buttons: [{ label: 'Pronto', kind: 'primary', value: true }] });
  },
  async presetIA(s) {
    const pedido = await UI.prompt({ title: `Preset com a IA em "${s.nome}"`, label: 'Descreva (ex.: "olhos de susto, bem abertos", "chutando para a frente")', ok: 'Criar', icon: 'sparkles', ia: true }); if (!pedido) return;
    const t = UI.toast('<span class="spin-dot"></span> A IA está montando o preset…', { time: 120000 });
    try { const pr = await IA.criarPreset(this.def, s, pedido); t.remove(); s.presets.push(pr); this.edit = { s: s.id, p: pr.id }; this.commit(); UI.toast(`Preset "${esc(pr.nome)}" criado. Confira e ajuste se precisar.`, { kind: 'ok' }); }
    catch (e) { t.remove(); UI.toast('A IA não conseguiu: ' + esc(e.message), { kind: 'err' }); }
  },
  menuSessao(e, s) {
    UI.ctx(e.clientX, e.clientY, [
      { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome da sessão', value: s.nome }); if (n) { s.nome = n; this.commit(); } } },
      { label: 'Escolher as partes', icon: 'layers', action: async () => { const body = h(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${this.def.partes.map(p => `<label class="chk"><input type="checkbox" value="${p.id}" ${(s.partes || []).includes(p.id) ? 'checked' : ''}> ${esc(p.nome)}</label>`).join('')}</div>`);
        const r = await UI.modal({ title: `Partes de "${s.nome}"`, body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Pronto', kind: 'primary', collect: a => $$('input:checked', a.body).map(i => i.value) }] }); if (r) { s.partes = r; this.commit(); } } },
      '-', { label: 'Apagar a sessão', icon: 'trash', danger: true, action: async () => { if (await UI.confirm({ title: `Apagar "${esc(s.nome)}" e os presets dela?`, ok: 'Apagar', danger: true })) { this.def.sessoes = this.def.sessoes.filter(x => x !== s); if (this.edit?.s === s.id) this.edit = null; this.commit(); } } },
    ]);
  },
  /* ---------- VISTAS (ângulos): frente, três-quartos, lado, costas… cada uma com as próprias partes, poses e animações ---------- */
  icVista(t, tam = 16) { // cabecinha virando: o nariz mostra para onde o personagem olha
    const x = { frente: 12, 'tres-quartos': 15.5, lado: 19, 'tres-quartos-costas': 8.5, costas: null, cima: 12, outra: 12 }[t] ?? 12;
    return `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"${t === 'costas' || t === 'tres-quartos-costas' ? ' stroke-dasharray="3 2.5"' : ''}/>${t === 'cima' ? '<circle cx="12" cy="12" r="3"/>' : x == null ? '' : `<path d="M${x} 10v4"/>${t === 'frente' ? '<path d="M8.5 9.5h.01M15.5 9.5h.01"/>' : ''}`}${t === 'outra' ? '<path d="M12 7v.01"/>' : ''}</svg>`;
  },
  pintaVistas() {
    const el = $('#at-vistas'); if (!el || !this.def) return; Modelo.garanteVistas(this.def); const V = this.def.vistas;
    el.innerHTML = `<div class="av-cab" title="A 1ª vista é a principal: é a que aparece no editor quando o quadro não escolhe outra. Arraste para mudar a ordem.">${ic('eye', 13)}<b>Vistas</b><small>a 1ª é a principal</small><span class="sp"></span><button class="btn sm" data-nova title="Vista nova (frente, lado, costas…)">${ic('plus', 12)} Vista</button></div><div class="av-lista"></div>`;
    const l = $('.av-lista', el);
    for (const v of V) { const on = v.id === this.def.vistaAtual, np = on ? this.def.partes.length : (v.partes || []).length;
      const pri = v === V[0] && V.length > 1, b = h(`<button class="av ${on ? 'on' : ''} ${pri ? 'pri' : ''}" title="${esc(v.nome)} (${esc(Modelo.nomeTipo(v.tipo))}) · ${np} parte(s)${pri ? ' · PRINCIPAL' : ''}${on ? '' : ' · clique para trocar'} · arraste para mudar a ordem · botão direito: opções">${pri ? `<i class="av-pri" title="Principal">${ic('star', 10)}</i>` : ''}${this.icVista(v.tipo)}<span>${esc(v.nome)}</span><small>${np}</small></button>`);
      const gv = AoVivo.naVista?.(v.id) || []; // ao vivo: quem (dos outros) está nesta vista — borda na cor da pessoa + a foto pequena (nome ao passar o mouse)
      if (gv.length) { b.classList.add('com-gente'); b.style.setProperty('--c', gv[0].cor || '#19d3f0'); b.title = gv.map(g => g.nome || 'Alguém').join(', ') + ' está nesta vista · ' + b.title;
        b.appendChild(h(`<span class="av-gv">${gv.slice(0, 3).map(g => `<i style="--c:${esc(g.cor || '#888')}" class="${g.afk ? 'afk' : ''}" title="${esc(g.nome || 'Alguém')}">${g.foto ? `<img src="${esc(g.foto)}" alt="" referrerpolicy="no-referrer">` : esc((g.nome || '?')[0])}</i>`).join('')}${gv.length > 3 ? `<i>+${gv.length - 3}</i>` : ''}</span>`)); }
      b.onclick = () => this.trocaVista(v.id); b.oncontextmenu = ev => { ev.preventDefault(); this.menuVista(ev, v); };
      ordenavel(b, 'vista', v.id, (id, antes) => { const i = V.findIndex(x => x.id === id), j = V.indexOf(v); if (i >= 0) { moveNaLista(V, i, j, antes); this.commit(); } }, true);
      l.appendChild(b); }
    $('[data-nova]', el).onclick = () => this.novaVista();
  },
  // trocar de vista: na hora (nada espera a rede antes de aparecer), a câmera fica onde está (só muda arrastando) e, ao vivo, a troca é SÓ minha
  // (as outras pessoas continuam na vista delas; js/aovivo.js guarda o personagem sempre com a mesma vista ativa e cada um põe a sua por cima)
  trocaVista(id) {
    if (!this.def || id === this.def.vistaAtual || !this.def.vistas?.some(v => v.id === id)) return; Animacoes.parar(true); window.Falas?.parar(); Pintura.selecao = null;
    Modelo.ativaVista(this.def, id); this.edit = null; this.editPasso = null; Animacoes.sel = null; Animacoes.passo = null; Animacoes.poseFixa = null; Animacoes.multi?.clear?.(); if (this.teste) this.teste = { sessoes: {}, partes: {} };
    this.sel = (this.def.raiz && this.def.partes.some(p => p.id === this.def.raiz) ? this.def.raiz : this.def.partes[0]?.id) || null; this.multi.clear(); this.focoImg = null;
    this.ultimo = JSON.stringify(this.def); this.pinta(); AoVivo.minhaVista?.(id); // trocar de vista não é uma mudança do personagem (não entra no Ctrl+Z nem vai para os outros)
    Arq.garantir(Modelo.chavesImgs(this.def)).then(() => this.desenha()).catch(() => { }); // o que ainda não estava aqui chega e aparece
  },
  menuVista(e, v) {
    const V = this.def.vistas, on = v.id === this.def.vistaAtual;
    UI.ctx(e.clientX, e.clientY, [
      { head: v.nome },
      V[0] !== v && { label: 'Tornar a principal (1ª)', icon: 'star', action: () => { this.def.vistas = [v, ...V.filter(x => x !== v)]; this.commit(); UI.toast(`<b>${esc(v.nome)}</b> agora é a vista principal.`, { time: 3000 }); } },
      V.length > 1 && { label: 'Mudar a ordem', icon: 'move', sub: [{ label: 'Para a esquerda', icon: 'left', disabled: V[0] === v, action: () => { const i = V.indexOf(v); moveNaLista(V, i, i - 1, true); this.commit(); } }, { label: 'Para a direita', icon: 'right', disabled: V[V.length - 1] === v, action: () => { const i = V.indexOf(v); moveNaLista(V, i, i + 1, false); this.commit(); } }] },
      !on && { label: 'Abrir esta vista', icon: 'eye', action: () => this.trocaVista(v.id) },
      { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome da vista', label: 'Ex.: Lado direito, Frente (bravo), Costas', value: v.nome }); if (n) { v.nome = n.slice(0, 30); this.commit(); } } },
      { label: 'Tipo', icon: 'eye', sub: Modelo.TIPOS_VISTA.map(([t, n]) => t === 'outra' ? { label: 'Adicionar…', checked: v.tipo === t, action: async () => { const nn = await this.nomeVista(v.tipo === 'outra' ? v.nome : ''); if (!nn) return; v.nome = nn; v.tipo = 'outra'; this.commit(); } } : { label: n, checked: v.tipo === t, action: () => { if (v.nome === Modelo.nomeTipo(v.tipo)) v.nome = n; v.tipo = t; this.commit(); } }) },
      '-', { label: 'Duplicar (copiar para uma vista nova)', icon: 'dup', action: () => this.criaVista({ nome: v.nome + ' (cópia)', tipo: v.tipo, de: v.id, como: 'copia' }) },
      { label: 'Espelhar (criar o outro lado)', icon: 'transition', action: () => this.criaVista({ nome: v.tipo === 'lado' ? 'Lado (espelhado)' : v.nome + ' (espelhado)', tipo: v.tipo, de: v.id, como: 'espelho' }) },
      on && { label: 'Usar os mesmos nomes das outras vistas (alinhar)', icon: 'layers', action: () => { const n = Modelo.alinhaIds(this.def); this.commit(); UI.toast(n ? `${n} item(ns) agora batem com as outras vistas: no editor, trocar de vista mantém as poses escolhidas.` : 'Nada para alinhar (nenhum nome igual ao das outras vistas).', { kind: n ? 'ok' : 'warn', time: 6000 }); } },
      { label: 'Citar esta vista em mensagens…', icon: 'chat', action: () => Citacao.atelie({ vista: v.id }) },
      { label: 'Salvar esta vista como .vistasatelie', icon: 'download', action: () => VistaArq.exportar(v.id) },
      '-', !Nuvem.adm ? { label: 'Apagar a vista (só ADM)', icon: 'lock', disabled: V.length < 2, action: () => UI.toast('Só um ADM pode apagar uma vista. Peça para um ADM da equipe.', { kind: 'warn', time: 5000 }) } : { label: 'Apagar a vista', icon: 'trash', danger: true, disabled: V.length < 2, action: async () => {
        if (!(await Nuvem.souAdm())) return UI.toast('Só um ADM pode apagar uma vista.', { kind: 'warn' }); // só os ADMs apagam vistas
        if (!(await UI.confirm({ title: `Apagar a vista "${esc(v.nome)}"?`, msg: 'As partes, poses e animações de teste desta vista saem do personagem. Ctrl+Z desfaz.', ok: 'Apagar', danger: true }))) return;
        if (on) { const outra = V.find(x => x !== v); await this.trocaVista(outra.id); } this.def.vistas = this.def.vistas.filter(x => x !== v); this.commit(); } },
    ].filter(Boolean));
  },
  // cria uma vista: vazia (com imagens novas), cópia ou espelho de outra
  async criaVista(o) {
    Modelo.garanteVistas(this.def); const id = uid('vi'), v = { id, nome: o.nome || Modelo.nomeTipo(o.tipo), tipo: o.tipo || 'outra' };
    if (o.como === 'copia' || o.como === 'espelho') { const fonte = o.de === this.def.vistaAtual || !o.de ? Object.fromEntries(Modelo.CAMPOS_VISTA.map(c => [c, this.def[c]])) : this.def.vistas.find(x => x.id === o.de);
      const c = clone(Object.fromEntries(Modelo.CAMPOS_VISTA.map(k => [k, fonte?.[k]]))); Object.assign(v, o.como === 'espelho' ? Modelo.espelhar(c) : c); } // mesmos ids: no editor, as poses continuam ao virar
    else Object.assign(v, { partes: [], sessoes: [], animacoes: [] });
    this.def.vistas.push(v); await this.trocaVista(id);
    if (o.fs?.length) await this.montarNovo({ nome: `${this.def.nome} · ${v.nome}`, fs: o.fs, ia: !!o.ia, pedido: o.pedido || '', vista: true });
    UI.toast(`Vista <b>${esc(v.nome)}</b> criada.${o.como === 'espelho' ? ' É o espelho da outra: arrume o que precisar (ex.: a franja do lado certo).' : ''}`, { kind: 'ok', time: 5000 });
  },
  async novaVista() {
    let fs = []; const usados = new Set(this.def.vistas.map(v => v.tipo)), tipo0 = (Modelo.TIPOS_VISTA.find(([t]) => !usados.has(t)) || ['outra'])[0];
    const body = h(`<div class="novo-p"><div class="campo2" style="gap:10px"><label class="field" style="flex:1">Tipo<select data-t>${this.opcoesVista(tipo0)}</select></label><label class="field" style="flex:1">Nome<input type="text" data-n value="${esc(Modelo.nomeTipo(tipo0))}"></label></div>
      <div class="field">Começar com</div><div class="nv-como">
        <label class="chk"><input type="radio" name="como" value="imagens" checked> As imagens desta vista (desenho novo)</label>
        <label class="chk"><input type="radio" name="como" value="copia"> Uma cópia da vista atual (<b>${esc(this.vistaDe()?.nome || '')}</b>)</label>
        <label class="chk"><input type="radio" name="como" value="espelho"> O espelho da vista atual (bom para o outro lado)</label>
        <label class="chk"><input type="radio" name="como" value="vazia"> Vazia</label></div>
      <div data-img><div class="np-drop" data-d>${ic('upload', 22)}<b>Arraste as imagens desta vista aqui</b><small>ou clique para escolher · o melhor: as camadas do desenho, todas no mesmo tamanho</small></div><div class="np-lista" data-l></div>
      <label class="chk np-ia"><input type="checkbox" data-ia checked> ${ic('sparkles', 13)} A IA organiza esta vista (e usa os mesmos nomes das outras vistas)</label></div></div>`);
    const nm = $('[data-n]', body), tp = $('[data-t]', body); let mexeuNome = false; nm.oninput = () => mexeuNome = true; this.ligaVistaSel(tp, n => { if (n) { nm.value = n; mexeuNome = false; } else if (!mexeuNome || nm.value === tp.dataset.ultimo) nm.value = Modelo.nomeTipo(tp.value); tp.dataset.ultimo = nm.value; });
    const lista = $('[data-l]', body), drop = $('[data-d]', body), urls = [];
    const pintaL = () => { urls.forEach(u => URL.revokeObjectURL(u)); urls.length = 0; lista.innerHTML = ''; fs.forEach((f, i) => { const u = URL.createObjectURL(f); urls.push(u); const c = h(`<div class="np-im"><img src="${u}" alt=""><span>${esc(f.name.replace(/\.[^.]+$/, ''))}</span><button class="ibtn">${ic('x', 11)}</button></div>`); $('button', c).onclick = () => { fs.splice(i, 1); pintaL(); }; lista.appendChild(c); }); $('b', drop).textContent = fs.length ? `${fs.length} imagem(ns) — arraste mais se quiser` : 'Arraste as imagens desta vista aqui'; };
    const poe = L => { fs = fs.concat([...L].filter(f => /^image\//.test(f.type) || /\.(png|webp|gif|jpe?g|svg)$/i.test(f.name))); pintaL(); };
    drop.onclick = async ev => { const L = await Pastas.escolherDe(ev, () => pickFiles('image/png,image/webp,image/gif,image/jpeg,' + VETOR, true)); if (L) poe(L); };
    drop.ondragover = e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); drop.classList.add('drop-dentro'); } }; drop.ondragleave = () => drop.classList.remove('drop-dentro');
    drop.ondrop = e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('drop-dentro'); Pastas.deDrop(e.dataTransfer).then(poe); };
    $$('input[name=como]', body).forEach(r => r.onchange = () => { $('[data-img]', body).hidden = $('input[name=como]:checked', body).value !== 'imagens'; });
    const r = await UI.modal({ title: 'Vista nova', icon: 'eye', width: 560, body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Criar', kind: 'primary', collect: () => ({ tipo: tp.value, nome: nm.value.trim() || Modelo.nomeTipo(tp.value), como: $('input[name=como]:checked', body).value, ia: $('[data-ia]', body).checked }) }] });
    urls.forEach(u => setTimeout(() => URL.revokeObjectURL(u), 2000)); if (!r) return;
    await this.criaVista({ ...r, de: this.def.vistaAtual, fs: r.como === 'imagens' ? fs : [], ia: r.ia && r.como === 'imagens' && fs.length > 0 });
  },
  vistaDe() { return Modelo.vistaDe(this.def); },
  // opções do tipo de vista: no lugar de "Outra", "Adicionar…" pede um nome à vontade (o tipo fica 'outra')
  opcoesVista(sel) { return Modelo.TIPOS_VISTA.map(([t, n]) => `<option value="${t}" ${t === sel ? 'selected' : ''}>${t === 'outra' ? 'Adicionar…' : n}</option>`).join(''); },
  async nomeVista(atual = '') { return (await UI.prompt({ title: 'Vista nova', label: 'Nome da vista (ex.: Costas sem chapéu, Sentada)', value: atual }))?.trim().slice(0, 40) || ''; },
  ligaVistaSel(sel, aoNome) {
    let antes = sel.value; const op = $('option[value="outra"]', sel);
    sel.onchange = async () => {
      if (sel.value !== 'outra') { antes = sel.value; delete sel.dataset.nome; op.textContent = 'Adicionar…'; aoNome?.(null); return; }
      const n = await this.nomeVista(sel.dataset.nome || ''); if (!n) { sel.value = antes; return; }
      sel.dataset.nome = n; op.textContent = n; antes = 'outra'; aoNome?.(n);
    };
  },
  /* ---------- ÍCONE e COR do personagem (hierarquia e timeline do editor) ---------- */
  pintaIcone() {
    const b = $('#at-icone'); if (!b || !this.def) return; const def = this.def, auto = (def.iconeModo || 'auto') === 'auto', cAuto = (def.corModo || 'auto') === 'auto';
    const deIc = def.id + ':' + (def.vistas?.[0]?.id || ''); // UM ícone para o personagem todo (feito da vista principal): trocar de vista não muda nem apaga a foto
    if ((auto || cAuto) && this._icAuto?.de !== deIc) { const ant = this._icAuto?.de?.startsWith(def.id + ':') ? this._icAuto : null, m = this._icAuto = { de: deIc, img: ant?.img, cor: ant?.cor }; Icone.cabeca(def).then(i => { m.img = i; if (this._icAuto === m) this.pintaIcone(); }).catch(() => { }); Icone.corAuto(def).then(c => { m.cor = c; if (this._icAuto === m) this.pintaIcone(); }).catch(() => { }); }
    const img = def.iconeModo === 'nenhum' ? null : auto ? this._icAuto?.img : def.icone, cor = cAuto ? this._icAuto?.cor : def.cor;
    b.style.setProperty('--cp', cor || '#888'); b.innerHTML = img ? `<img src="${img}" alt="">` : ic('layers', 16); b.onclick = () => this.configIcone();
  },
  async configIcone() {
    const def = this.def; let modo = def.iconeModo || 'auto', corModo = def.corModo || 'auto', cor = def.cor || '#8fb3ff';
    // as duas fontes do ícone: o personagem desenhado (corte automático na cabeça) e a imagem própria (guardada para poder mudar o zoom depois)
    const autoF = await Icone.fonteAuto(def).catch(() => null), corAuto = await Icone.corAuto(def).catch(() => '#8fb3ff'); if (corModo === 'auto') cor = corAuto;
    let propF = def.iconeFonte ? await Icone.aCanvas(def.iconeFonte).catch(() => null) : null; if (!propF && def.iconeModo === 'proprio' && def.icone) propF = await Icone.aCanvas(def.icone).catch(() => null);
    const fonte = () => modo === 'auto' ? autoF?.cv : modo === 'proprio' ? propF : null, padrao = () => modo === 'auto' ? autoF?.corte : propF ? Icone.cortePadrao(propF) : null;
    const cortes = { auto: def.iconeCorte?.modo === 'auto' ? { ...def.iconeCorte } : autoF?.corte && { ...autoF.corte }, proprio: def.iconeCorte?.modo === 'proprio' ? { ...def.iconeCorte } : propF && Icone.cortePadrao(propF) };
    // igual ao "Ajustar a foto" do menu: área grande (fora do círculo escurece), arrastar posiciona, zoom no ponto do mouse/pinça, duplo clique aproxima, girar, espelhar, recomeçar
    const lupa = m => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M8 11h6${m ? 'M11 8v6' : ''}M20 20l-4-4"/></svg>`;
    const body = h(`<div class="ico-cfg"><div class="ico-corte"><div class="ico-palco"><canvas data-cv width="600" height="600" tabindex="0" aria-label="Ajuste do ícone"></canvas><div class="ico-nada" data-nada>Sem ícone: aparece o ícone comum de camadas</div></div>
        <div class="previas"><span><canvas class="pv" data-pv width="160" height="160"></canvas><small>grande</small></span><div class="ico-ex"><small>Na hierarquia do editor</small><div class="ico-linha" data-l></div><small>Na timeline</small><div class="ico-linha tl" data-t></div></div></div></div>
      <div class="ctl" data-ctl><span class="hint">Arraste para posicionar · rodinha do mouse ou dois dedos para zoom no ponto · duplo clique aproxima · setas movem</span>
        <span class="rng"><button class="btn sm ico" data-z="-" title="Afastar">${lupa(false)}</button><input type="range" min="-1.6" max="2.3" step=".01" data-zr aria-label="Zoom"><button class="btn sm ico" data-z="+" title="Aproximar">${lupa(true)}</button><output data-zo>100%</output></span>
        <span class="rng"><button class="btn sm ico" data-g="-90" title="Girar 90° para a esquerda">${ic('undo', 14)}</button><input type="range" min="-180" max="180" step="1" value="0" data-rr aria-label="Girar"><button class="btn sm ico" data-g="90" title="Girar 90° para a direita">${ic('redo', 14)}</button><output data-ro>0°</output></span>
        <div class="gira"><button class="btn sm" data-fx>${ic('flip', 13)} Espelhar</button><button class="btn sm" data-zpad>${ic('undo', 13)} Recomeçar</button></div></div>
      <div class="field" style="margin-top:12px">Ícone</div><div class="seg ico-seg" data-mi><button data-v="auto">Cabeça (automático)</button><button data-v="proprio">Imagem própria…</button><button data-v="nenhum">Sem ícone</button></div>
      <div class="field" style="margin-top:12px">Cor</div><div class="campo2"><div class="seg ico-seg" data-mc><button data-v="auto">Automática</button><button data-v="propria">Escolher</button></div><input type="color" data-c value="${cor}"><code data-hex>${cor}</code></div>
      <div style="color:var(--tx3);font-size:11.5px;margin-top:10px">A automática é a cor que mais aparece no personagem, ajustada para ficar fácil de ver no fundo escuro. O nome que aparece é sempre o nome do personagem/camada.</div></div>`);
    const cvE = $('[data-cv]', body), g = cvE.getContext('2d'), S = 600, RAIO = S * .42, zr = $('[data-zr]', body), rr = $('[data-rr]', body), pv = $('[data-pv]', body);
    // zoom 100% = o corte padrão (a cabeça, ou a imagem inteira); a barra é logarítmica (30% a 1000%)
    const lado0 = () => (padrao() || {}).lado || 1, zoomDe = c => lado0() / c.lado;
    const cor_ = () => corModo === 'auto' ? corAuto : Icone.legivel(cor);
    let iconeAgora = null, _raf = 0;
    const desenhaE = () => { const F = fonte(), c = cortes[modo]; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#101114'; g.fillRect(0, 0, S, S); if (!F || !c) return;
      const W = F.width, H = F.height, k = 2 * RAIO / (c.lado * W); g.translate(S / 2, S / 2); g.rotate((c.r || 0) * Math.PI / 180); g.scale(k * (c.fx || 1), k); g.translate(-c.cx * W, -c.cy * H); g.imageSmoothingQuality = 'high'; g.drawImage(F, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.rect(0, 0, S, S); g.arc(S / 2, S / 2, RAIO, 0, Math.PI * 2, true); g.fill('evenodd'); // fora do círculo escurece
      g.strokeStyle = cor_(); g.lineWidth = 4; g.beginPath(); g.arc(S / 2, S / 2, RAIO, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.5; g.beginPath(); for (const t of [-1, 1]) { g.moveTo(S / 2 + t * RAIO / 3, S / 2 - RAIO); g.lineTo(S / 2 + t * RAIO / 3, S / 2 + RAIO); g.moveTo(S / 2 - RAIO, S / 2 + t * RAIO / 3); g.lineTo(S / 2 + RAIO, S / 2 + t * RAIO / 3); } g.stroke(); };
    const pinta = (soCorte) => { cancelAnimationFrame(_raf); _raf = requestAnimationFrame(async () => {
      const F = fonte(), c = cortes[modo], cr = cor_(); desenhaE();
      $('[data-ctl]', body).hidden = !F; cvE.hidden = !F; $('[data-nada]', body).hidden = !!F;
      const px = pv.getContext('2d'); px.clearRect(0, 0, 160, 160); if (F && c) { Icone.pintaCorte(px, 160, F, c, '#1d1d1d'); px.globalCompositeOperation = 'destination-in'; px.beginPath(); px.arc(80, 80, 80, 0, 7); px.fill(); px.globalCompositeOperation = 'source-over'; }
      pv.style.boxShadow = `0 0 0 3px ${cr}`;
      if (F && c) { const z = zoomDe(c); zr.value = Math.log(z); $('[data-zo]', body).textContent = Math.round(z * 100) + '%'; rr.value = Math.round(c.r || 0); $('[data-ro]', body).textContent = Math.round(c.r || 0) + '°'; }
      iconeAgora = F && c ? await Icone.recorta(F, c) : null; const d = { iconeModo: modo, icone: iconeAgora, cor: cr };
      $('[data-l]', body).innerHTML = `<span class="no pers-cor" style="--cp:${cr}"><span class="ti">${Icone.html(d, 18)}</span><span class="nm">${esc(def.nome)}</span></span>`;
      $('[data-t]', body).innerHTML = `<span class="reg pers-cor" style="--cp:${cr}">${Icone.html(d, 15)}<span class="nm">${esc(def.nome)}</span></span><i style="background:${cr}88"></i>`;
      if (soCorte) return;
      $$('[data-mi] button', body).forEach(b => b.classList.toggle('on', b.dataset.v === modo)); $$('[data-mc] button', body).forEach(b => b.classList.toggle('on', b.dataset.v === corModo));
      $('[data-c]', body).value = cr; $('[data-hex]', body).textContent = cr; }); };
    // ponto da tela (em px da área, a partir do centro) → mexe no corte
    const ponto = (x, y) => { const b = cvE.getBoundingClientRect(), e = S / b.width; return [(x - b.left) * e - S / 2, (y - b.top) * e - S / 2]; };
    const naFonte = (c, dx, dy) => { const F = fonte(), k = 2 * RAIO / (c.lado * F.width), a = -(c.r || 0) * Math.PI / 180, x = (dx * Math.cos(a) - dy * Math.sin(a)) / k * (c.fx || 1), y = (dx * Math.sin(a) + dy * Math.cos(a)) / k; return [x / F.width, y / F.height]; };
    const move = (dx, dy) => { const c = cortes[modo]; if (!c || !fonte()) return; const [u, v] = naFonte(c, dx, dy); c.cx -= u; c.cy -= v; pinta(true); };
    const zoomEm = (z, px = 0, py = 0) => { const c = cortes[modo]; if (!c || !fonte()) return; z = clamp(z, Math.exp(-1.6), Math.exp(2.3)); const [u0, v0] = naFonte(c, px, py), antes = { ...c }; c.lado = lado0() / z; const [u1, v1] = naFonte(c, px, py); c.cx = antes.cx + u0 - u1; c.cy = antes.cy + v0 - v1; pinta(true); }; // o ponto embaixo do mouse fica parado
    zr.oninput = () => zoomEm(Math.exp(+zr.value));
    $$('[data-z]', body).forEach(b => b.onclick = () => { const c = cortes[modo]; if (c) zoomEm(zoomDe(c) * (b.dataset.z === '+' ? 1.25 : .8)); });
    rr.oninput = () => { const c = cortes[modo]; if (c) { c.r = +rr.value; pinta(true); } };
    $$('[data-g]', body).forEach(b => b.onclick = () => { const c = cortes[modo]; if (c) { c.r = (((c.r || 0) + +b.dataset.g + 540) % 360) - 180; pinta(true); } });
    $('[data-fx]', body).onclick = () => { const c = cortes[modo]; if (c) { c.fx = -(c.fx || 1); pinta(true); } };
    $('[data-zpad]', body).onclick = () => { const p = padrao(); if (p) { cortes[modo] = { ...p }; pinta(true); } };
    cvE.onwheel = e => { const c = cortes[modo]; if (!c) return; e.preventDefault(); e.stopPropagation(); const [px, py] = ponto(e.clientX, e.clientY); zoomEm(zoomDe(c) * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0018)), px, py); };
    cvE.ondblclick = e => { const c = cortes[modo]; if (!c) return; const [px, py] = ponto(e.clientX, e.clientY); zoomEm(zoomDe(c) * 1.6, px, py); };
    const toques = new Map(); let ini = null;
    cvE.onpointerdown = e => { cvE.setPointerCapture(e.pointerId); toques.set(e.pointerId, [e.clientX, e.clientY]); cvE.classList.add('arrastando');
      if (toques.size === 2 && cortes[modo]) { const [a, b] = [...toques.values()]; ini = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zoomDe(cortes[modo]) }; } };
    cvE.onpointermove = e => { const ant = toques.get(e.pointerId); if (!ant) return; toques.set(e.pointerId, [e.clientX, e.clientY]);
      if (toques.size === 2 && ini) { const [a, b] = [...toques.values()], [px, py] = ponto((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return zoomEm(ini.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / ini.d, px, py); } // pinça no celular
      const b = cvE.getBoundingClientRect(), k = S / b.width; move((e.clientX - ant[0]) * k, (e.clientY - ant[1]) * k); };
    cvE.onpointerup = cvE.onpointercancel = e => { toques.delete(e.pointerId); if (toques.size < 2) ini = null; if (!toques.size) cvE.classList.remove('arrastando'); };
    cvE.onkeydown = e => { const p = e.shiftKey ? 30 : 8, m = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, -p], ArrowDown: [0, p] }[e.key], c = cortes[modo];
      if (m) { e.preventDefault(); e.stopPropagation(); move(m[0], m[1]); } else if (c && (e.key === '+' || e.key === '=')) zoomEm(zoomDe(c) * 1.15); else if (c && e.key === '-') zoomEm(zoomDe(c) / 1.15); };
    $$('[data-mi] button', body).forEach(b => b.onclick = async () => { if (b.dataset.v === 'proprio') { const fs = await pickFiles('image/*', false); const f = fs?.[0]; if (!f) return; propF = await Icone.fonteDeArquivo(f); cortes.proprio = Icone.cortePadrao(propF); } modo = b.dataset.v; pinta(); });
    $$('[data-mc] button', body).forEach(b => b.onclick = () => { corModo = b.dataset.v; pinta(); });
    $('[data-c]', body).oninput = ev => { corModo = 'propria'; cor = ev.target.value; pinta(); };
    pinta();
    const ok = await UI.modal({ title: 'Ícone e cor do personagem', icon: 'image', width: 640, body, buttons: [{ label: 'Cancelar', value: false }, { label: 'Aplicar', kind: 'primary', value: true }] }); if (!ok) return;
    def.iconeModo = modo; const c = cortes[modo];
    if (modo === 'auto' && autoF) { const p = autoF.corte, igual = c && Math.abs(c.cx - p.cx) + Math.abs(c.cy - p.cy) + Math.abs(c.lado - p.lado) < .002 && !c.r && (c.fx || 1) === 1; if (igual || !c) delete def.iconeCorte; else def.iconeCorte = { modo, ...c }; def.icone = await Icone.recorta(autoF.cv, c || p); }
    else if (modo === 'proprio' && propF) { def.iconeFonte = propF.toDataURL('image/webp', .9); def.iconeCorte = { modo, ...(c || Icone.cortePadrao(propF)) }; def.icone = await Icone.recorta(propF, def.iconeCorte); }
    else if (modo === 'nenhum') delete def.icone;
    if (modo !== 'proprio') delete def.iconeFonte;
    def.corModo = corModo; if (corModo === 'propria') def.cor = Icone.legivel(cor);
    this._icAuto = null; this.commit(); UI.toast('Ícone e cor guardados. Vão para o editor quando o personagem for salvo (Ctrl+S ou nuvem).', { kind: 'ok' });
  },
  // a pose padrão (base) passa a ser igual a este preset (nas partes que ele mexe)
  virarPadrao(s, pr) {
    let n = 0; for (const [pid, e] of Object.entries(pr.estado || {})) { const p = this.parte(pid); if (!p) continue; const { d, ...resto } = e; Object.assign(p.base, resto); if (d) p.base.d = { ...(p.base.d || {}), ...d }; n++; }
    this.edit = null; this.commit(); UI.toast(n ? `A pose padrão agora é igual a <b>${esc(s.nome)} › ${esc(pr.nome)}</b> (${n} parte(s)). Ctrl+Z desfaz.` : 'Esse preset está vazio: nada mudou.', { kind: n ? 'ok' : 'warn' });
  },
  menuPreset(e, s, pr) {
    UI.ctx(e.clientX, e.clientY, [
      { label: 'Mudar a imagem…', icon: 'image', key: '2 cliques', action: () => { Linha.parar?.(); this.trocarImagemPreset(s, pr); } }, // o mesmo que dois cliques no preset
      '-',
      { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome do preset', value: pr.nome }); if (n) { pr.nome = n; this.commit(); } } },
      { label: 'Duplicar', icon: 'dup', action: () => { const c = clone(pr); c.id = uid('pr'); c.nome += ' 2'; s.presets.splice(s.presets.indexOf(pr) + 1, 0, c); this.edit = { s: s.id, p: c.id }; this.commit(); } },
      { label: 'Voltar à base (limpar)', icon: 'undo', action: () => { pr.estado = {}; this.commit(); } },
      { label: 'Usar como pose padrão (a base fica assim)', icon: 'home', action: () => this.virarPadrao(s, pr) },
      { label: 'Exportar como .presetatelie', icon: 'download', action: () => PresetArq.exportar(s, pr) },
      (this.def.vistas || []).length > 1 && { label: 'Enviar para a vista…', icon: 'eye', sub: this.def.vistas.filter(v => v.id !== this.def.vistaAtual).map(v => ({ label: v.nome, action: () => PresetArq.enviar(s, pr, v.id) })) },
      '-', { label: 'Apagar', icon: 'trash', danger: true, action: () => { s.presets = s.presets.filter(x => x !== pr); if (this.edit?.p === pr.id) this.edit = null; this.commit(); } },
    ].filter(Boolean));
  },

  /* ---------- (o antigo painel TESTAR saiu: a timeline embaixo do palco — js/linha.js — e a aba Poses fazem o papel dele) ---------- */
  testar(on) { Animacoes.parar(true); Animacoes.passoSel = null; Animacoes.poseFixa = null; this.editPasso = null; if (!on) this.edit = null; this.teste = on ? { sessoes: {}, partes: {} } : null; this.pinta(); },
  pintaTesteLeve() { Linha.leve(); },
  // problemas de um preset: vazio, parte que não existe mais, imagem que não existe mais
  problemas(pr) {
    const out = []; if (!Object.keys(pr.estado || {}).length) out.push('está vazio (não muda nada)');
    for (const [pid, e] of Object.entries(pr.estado || {})) { const p = this.parte(pid); if (!p) { out.push('usa uma parte que foi apagada'); continue; } if (e.img && !p.imgs.some(i => i.id === e.img)) out.push(`a imagem de "${p.nome}" foi tirada`); }
    return [...new Set(out)];
  },
  arrumar(s, pr) { Animacoes.parar(true); Animacoes.poseFixa = null; this.editPasso = null; this.teste = null; this.edit = { s: s.id, p: pr.id }; this.aba = 'sessoes'; const p1 = Object.keys(pr.estado || {}).find(id => this.parte(id)); if (p1) this.escolhe(p1); this.pinta(); UI.toast(`Arrumando <b>${esc(s.nome)} › ${esc(pr.nome)}</b>. O que você mexer vale só para este preset.`, { kind: 'ok' }); },

  /* ---------- IA no Ateliê: cria um preset novo numa sessão, ou preenche de uma vez os presets que estão vazios ---------- */
  async ia(modoIni, pedidoIni) {
    const def = this.def; if (!def.partes.length) return UI.toast('Ponha as partes do personagem antes de usar a IA.', { kind: 'warn' });
    const atual = this.edit?.s || def.sessoes[0]?.id || '';
    const body = h(`<div><label class="field">O que a IA deve fazer<select data-modo>
        <option value="organizar">Organizar tudo automaticamente (partes, raiz, encaixes, profundidade, sessões, presets e animações de teste)</option>
        <option value="animacoes">Criar animações de teste (andar, falar, piscar…)</option>
        <option value="preset">Criar um preset numa sessão</option><option value="vazios">Preencher os presets vazios de uma sessão</option></select></label>
      <label class="field" data-so-s>Sessão<select data-s>${def.sessoes.map(s => `<option value="${s.id}" ${s.id === atual ? 'selected' : ''}>${esc(s.nome)} (${s.presets.length})</option>`).join('')}<option value="__nova">+ Sessão nova…</option></select></label>
      <label class="field">Pedido <small data-dica></small><textarea rows="3" data-p></textarea></label>
      <div data-aviso style="color:var(--tx3);font-size:11.5px"></div></div>`);
    const modo = $('[data-modo]', body), troca = () => { const m = modo.value; $('[data-so-s]', body).hidden = !['preset', 'vazios'].includes(m);
      $('[data-p]', body).placeholder = { organizar: 'Opcional. Ex.: "a raiz é o corpo", "as bocas são para falar"', animacoes: 'Opcional. Ex.: "andar, falar e acenar feliz"', preset: 'Ex.: olhos de susto, bem abertos · chutando para a frente', vazios: 'Opcional' }[m];
      $('[data-aviso]', body).innerHTML = m === 'organizar' ? 'A IA vê as peças e monta tudo de uma vez. Depois você só ajusta à mão o que precisar (um <b>Ctrl+Z</b> desfaz tudo).' : ''; };
    modo.value = modoIni || (def.sessoes.length || def.animacoes?.length ? 'preset' : 'organizar'); modo.onchange = troca; troca(); if (pedidoIni) { const ta = $('[data-p]', body); ta.value = pedidoIni; setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 60); }
    const r = await UI.modal({ title: 'IA do Ateliê', icon: 'sparkles', kind: 'ia', width: 520, body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Fazer', kind: 'primary ia', icon: 'sparkles', collect: a => ({ modo: modo.value, s: $('[data-s]', a.body).value, pedido: $('[data-p]', a.body).value.trim() }) }] });
    if (!r) return;
    if (r.modo === 'organizar' || r.modo === 'animacoes') return this.iaOrganizar(r.modo, r.pedido);
    let s = def.sessoes.find(x => x.id === r.s);
    if (r.s === '__nova' || !s) { const nome = await UI.prompt({ title: 'Sessão nova', label: 'Nome (ex.: Olhos, Boca, Pose)', ok: 'Criar' }); if (!nome) return; s = { id: uid('s'), nome, partes: [], presets: [] }; def.sessoes.push(s); this.commit(); }
    const fila = r.modo === 'vazios' ? s.presets.filter(p => !Object.keys(p.estado || {}).length).map(p => ({ pr: p, pedido: p.nome + (r.pedido ? ' — ' + r.pedido : '') })) : r.pedido ? [{ pr: null, pedido: r.pedido }] : [];
    if (!fila.length) return UI.toast(r.modo === 'vazios' ? 'Essa sessão não tem presets vazios.' : 'Escreva o que a IA deve criar.', { kind: 'warn' });
    const fimO = Ocupado.inicio({ tipo: 'preset', titulo: fila.length > 1 ? `A IA está criando ${fila.length} presets` : 'A IA está criando o preset', est: 20 * fila.length }), t = { remove: fimO, querySelector: () => null }; let feitos = 0, ultimo = null;
    try {
      for (const it of fila) { Ocupado.passo(`Montando "${it.pedido}"… (${feitos + 1}/${fila.length})`); Ocupado.parte(feitos, fila.length);
        const novo = await IA.criarPreset(this.def, s, it.pedido); if (it.pr) { it.pr.estado = novo.estado; ultimo = it.pr; } else { s.presets.push(novo); ultimo = novo; } feitos++; this.commit({ soDesenho: true }); }
      t.remove(); this.aba = 'sessoes'; this.teste = { sessoes: { [s.id]: ultimo.id }, partes: {} }; this.edit = null; this.pinta();
      UI.toast(`${feitos} preset(s) feitos pela IA em <b>${esc(s.nome)}</b>. Está no modo <b>Testar</b>: clique nos botões para conferir e em Arrumar se precisar.`, { kind: 'ok', time: 7000 });
    } catch (e) { t.remove(); this.pinta(); UI.toast(`A IA parou${feitos ? ` depois de ${feitos}` : ''}: ` + esc(e.message), { kind: 'err' }); }
  },
  async iaOrganizar(modo, pedido) {
    const t = { remove() { } }, fim = Ocupado.inicio({ tipo: modo === 'animacoes' ? 'anims' : 'organizar', titulo: modo === 'animacoes' ? 'A IA está criando as animações de teste' : 'A IA está organizando o personagem', est: 60, subtitulo: 'Olhando as peças…' });
    try {
      await Arq.garantir(Modelo.chavesImgs(this.def)); Ocupado.passo('Mandando as miniaturas e os exemplos da equipe…');
      const plano = await IA.organizar(this.def, modo, pedido, txt => Ocupado.passo(`Organizando… (${Math.round(txt.length / 100) / 10} mil letras)`));
      Ocupado.passo('Aplicando o plano…'); fim(); const feito = this.aplicarPlano(plano, modo), alinhou = (this.def.vistas || []).length > 1 ? Modelo.alinhaIds(this.def) : 0, avisos = (plano.avisos || []).filter(Boolean).slice(0, 5);
      if (alinhou) { feito.push(`${alinhou} nome(s) iguais aos das outras vistas`); this.commit(); }
      if (modo !== 'animacoes' && Referencia.tem(this.def)) { try { const r = await Referencia.aplicar(this, { quieto: true }); if (r) feito.push(`${r.achados.length} peça(s) no lugar da referência${r.duvidas.length ? ` (confira: ${r.duvidas.map(esc).join(", ")})` : ""}`); } catch (e) { feito.push('não deu para seguir a referência (' + esc(e.message) + ')'); } }
      this.aba = (this.def.animacoes || []).length ? 'animacoes' : 'sessoes'; Animacoes.sel = this.def.animacoes?.[0]?.id || null; this.teste = null; this.pinta();
      UI.toast(`<b>Pronto.</b> ${feito.join(' · ') || 'A IA achou que já estava tudo certo.'}<br>Confira na <b>timeline</b> (embaixo do palco) e na aba <b>Poses</b>; ajuste à mão o que precisar (Ctrl+Z desfaz tudo).`, { kind: 'ok', time: 12000 });
      if (avisos.length) UI.modal({ title: 'A IA deixou uns avisos', icon: 'info', width: 460, body: `<div>${avisos.map(a => `<p style="margin:0 0 8px">• ${esc(String(a))}</p>`).join('')}<div style="color:var(--tx3);font-size:12px">Dá para separar peças com <b>Seleção</b>/<b>Laço</b> › <b>Recortar → parte nova</b> na aba Pintar, e depois pedir para a IA organizar de novo.</div></div>`, buttons: [{ label: 'Entendi', kind: 'primary', value: true }] });
    } catch (e) { fim(); UI.toast('A IA não conseguiu organizar: ' + esc(e.message), { kind: 'err', time: 7000 }); }
  },
  // aplica o plano da IA (nomes → ids). Tudo num commit só.
  aplicarPlano(pl, modo) {
    const def = this.def, feito = [], nome = n => IA.acha(def.partes, n), img = (p, n) => p && n ? IA.acha(p.imgs, n) : null;
    if (modo !== 'animacoes') {
      let n = 0; for (const j of pl.juntar || []) { const alvo = nome(j.em), ps = (j.partes || []).map(nome).filter(p => p && p !== alvo); if (alvo && ps.length) { this.virarImagens(ps, alvo, null, { semCommit: true }); n += ps.length; } } if (n) feito.push(`${n} parte(s) viraram imagens`);
      n = 0; for (const [de, para] of Object.entries(pl.renomear_partes || {})) { const p = nome(de); if (p && para) { p.nome = String(para).slice(0, 40); n++; } }
      for (const r of pl.renomear_imagens || []) { const p = nome(r.parte), i = img(p, r.de); if (i && r.para) { i.nome = String(r.para).slice(0, 40); n++; } } if (n) feito.push(`${n} nome(s) arrumados`);
      const rz0 = nome(pl.raiz), rz = rz0 && !Referencia.ehRef(rz0) ? rz0 : null; if (rz) { if (rz.pai) this.porNoPai(rz.id, null, { semCommit: true }); def.raiz = rz.id; feito.push(`raiz: ${rz.nome}`); }
      n = 0; for (const [fi, pa] of Object.entries(pl.pais || {})) { const f = nome(fi), p = pa ? nome(pa) : null; if (f && !Referencia.ehRef(f) && !(p && Referencia.ehRef(p)) && f !== rz && (p?.id || null) !== (f.pai || null) && (!pa || p)) { let a = p?.id, ciclo = false; while (a) { if (a === f.id) { ciclo = true; break; } a = this.parte(a)?.pai; } if (!ciclo) { this.porNoPai(f.id, p?.id || null, { semCommit: true }); n++; } } } if (n) feito.push(`${n} encaixe(s)`);
      n = 0; for (const [pn, v] of Object.entries(pl.pivos || {})) { const p = nome(pn), est = this.estado(), im = p && p.imgs.find(i => i.id === est[p.id]?.img); if (!im || !v || !isFinite(+v.x) || !isFinite(+v.y)) continue; this.pivoEm(p, clamp(+v.x, -.2, 1.2) * im.w, clamp(+v.y, -.2, 1.2) * im.h, est); n++; } if (n) feito.push(`${n} ponto(s) de giro`);
      if (Array.isArray(pl.camadas) && pl.camadas.length) { const L = pl.camadas.map(nome).filter(Boolean), resto = def.partes.filter(p => !L.includes(p)); const ordem = [...new Set([...resto, ...L])]; ordem.forEach((p, i) => p.z = i); feito.push('camadas'); }
      n = 0; for (const s0 of pl.sessoes || []) {
        let s = def.sessoes.find(x => x.nome.toLowerCase() === String(s0.nome || '').toLowerCase()); if (!s) { s = { id: uid('s'), nome: String(s0.nome || 'Sessão').slice(0, 30), partes: [], presets: [] }; def.sessoes.push(s); }
        const ps = (s0.partes || []).map(nome).filter(Boolean).map(p => p.id); if (ps.length) s.partes = [...new Set([...(s.partes || []), ...ps])];
        for (const pr0 of s0.presets || []) { const estado = {}; for (const [pn, e0] of Object.entries(pr0.estado || {})) { const p = nome(pn); if (!p) continue; const e = typeof e0 === 'string' ? { img: e0 } : e0 || {}, v = {}, im = img(p, e.img); if (im) v.img = im.id; for (const c of ['x', 'y', 'r', 's']) if (e[c] != null && isFinite(+e[c])) v[c] = +e[c]; if (Object.keys(v).length) estado[p.id] = v; }
          let pr = s.presets.find(x => x.nome.toLowerCase() === String(pr0.nome || '').toLowerCase()); if (pr && Object.keys(pr.estado || {}).length) continue;
          if (!pr) { pr = { id: uid('pr'), nome: String(pr0.nome || 'preset').slice(0, 40), estado: {} }; s.presets.push(pr); } pr.estado = estado; n++; } }
      if (n) feito.push(`${n} preset(s)`);
    }
    let n = 0; for (const a0 of pl.animacoes || []) {
      const trilhas = (a0.trilhas || []).map(t => (t || []).map(p0 => { const p = { s: {}, p: {} }; for (const [pn, v0] of Object.entries(p0 || {})) { const pt = nome(pn); if (!pt) continue; const v = typeof v0 === 'string' ? { img: v0 } : v0 || {}, im = img(pt, v.img); const num = c => v[c] != null && isFinite(+v[c]); if (!im && !num('r') && !num('x') && !num('y')) continue; p.p[pt.id] = { ...(im ? { img: im.id } : {}), ...(num('r') ? { r: +v.r } : {}), ...(num('x') ? { x: +v.x } : {}), ...(num('y') ? { y: +v.y } : {}) }; } return p; }).filter(p => Object.keys(p.p).length)).filter(t => t.length);
      if (!trilhas.length) continue; const L = def.animacoes ||= [], velha = L.find(x => x.nome.toLowerCase() === String(a0.nome || '').toLowerCase());
      const a = { id: velha?.id || uid('an'), nome: String(a0.nome || 'Animação').slice(0, 40), vel: clamp(+a0.vel || 250, 60, 2000), trilhas };
      if (velha) L[L.indexOf(velha)] = a; else L.push(a); n++;
    }
    if (n) feito.push(`${n} animação(ões) de teste`);
    def.iaPlano = { em: Date.now(), resumo: IA.resumo(def) }; // para aprender: ao salvar na nuvem, compara com o que a equipe ajustou
    this.sel = def.raiz || this.sel; this.multi.clear(); this.commit(); return feito;
  },

  /* ---------- salvar na nuvem da equipe ---------- */
  async salvar(o = {}) {
    const def = this.def; if (!def.partes.length) return UI.toast('Ponha pelo menos uma parte antes de salvar.', { kind: 'warn' });
    if (this.naNuvem) return this.sincronizar(true);
    def.thumb = this.miniatura();
    // aprendizado: o que a equipe corrigiu depois da IA organizar vai junto (a IA lê isso nos próximos personagens)
    if (def.iaPlano?.resumo) { try { const c = IA.correcoes(def.iaPlano.resumo, IA.resumo(def)); def.iaCorrecoes = [...new Set([...(def.iaCorrecoes || []), ...c])].slice(-40); } catch { } }
    const t = UI.toast('<span class="spin-dot"></span> <span data-p>Salvando na nuvem…</span>', { time: 600000 });
    try { await Icone.prepara(def); await Nuvem.salvar(def, txt => { const e = t.querySelector('[data-p]'); if (e) e.textContent = txt; }); t.remove(); this.aplicaTroca(Nuvem.ultimaTroca); await this.apagarRascunho(def.id); this.sujo = false; this.ultimo = JSON.stringify(def); this.base0 = this.baseNuvem = this.ultimo; this.pinta();
      this.avisaAnimador(def, false); // a animação aberta (aqui ou na outra aba) atualiza o personagem e tira o "não está na nuvem"
      this.naNuvem = true; this.pintaBotaoNuvem(); this.pintaEstado(); AoVivo.entrarAtelie().catch(() => { });
      UI.toast(`<b>${esc(def.nome)}</b> salvo na nuvem da equipe (pasta "${esc(def.pasta)}"). Agora as mudanças vão sozinhas para a nuvem.`, { kind: 'ok', time: 5000 });
      if (!o.semAviso) await this.avisoLocais(); }
    catch (e) { t.remove(); UI.toast('Não salvou: ' + esc(e.message), { kind: 'err', time: 7000 }); }
  },
  miniatura() {
    const est = Modelo.partesNoEstado(this.def, {}), b = Modelo.caixaPersonagem(this.def, est), S = 160, k = Math.min(S / b.w, S / b.h) * .92, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), base = new DOMMatrix().translate(S / 2, S / 2).scale(k).translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
    for (const it of Modelo.montar(this.def, est)) { if (!it.img) continue; const bm = Arq.img.get(it.img.k); if (!bm) continue; x.setTransform(base.multiply(it.m)); x.drawImage(bm, -(it.img.pivo?.x ?? it.img.w / 2) + (it.img.ajuste?.x || 0), -(it.img.pivo?.y ?? it.img.h / 2) + (it.img.ajuste?.y || 0), it.img.w, it.img.h); }
    const w = c.toDataURL('image/webp', .85); return w.startsWith('data:image/webp') ? w : c.toDataURL('image/png'); // miniatura menor
  },
};
addEventListener('keyup', e => { if (e.key === ' ') { const toque = Atelie.espaco && !Atelie._espUsou && Date.now() - (Atelie._espT || 0) < 450; Atelie.espaco = false;
    // ESPAÇO: um toque (sem arrastar a tela) toca/pausa a animação da timeline, como o P
    if (toque && !$('#atelie').classList.contains('hidden') && !$('#modal-root').children.length && !e.target.closest?.('input,textarea,select,[contenteditable]') && !Atelie.edImg && Animacoes.achar(Animacoes.sel)) { e.preventDefault(); Linha.tocaPausa(); } } if (e.key === 'Alt' && Atelie.alt) { Atelie.alt = false; Atelie.desenha(); } });
addEventListener('keydown', e => { if (e.key === 'Alt' && !Atelie.alt && !$('#atelie').classList.contains('hidden')) { Atelie.alt = true; Atelie.desenha(); } });
addEventListener('blur', () => { if (Atelie.alt) { Atelie.alt = false; Atelie.desenha(); } });

/* ---------- escolher um personagem da biblioteca da equipe ---------- */
const Biblioteca = {
  async escolher() {
    const body = h('<div><div class="vazio"><span class="spin-dot"></span> Carregando a biblioteca da equipe…</div></div>');
    let escolhido = null;
    const p = UI.modal({ title: 'Pôr um personagem', icon: 'layers', width: 640, body, buttons: [{ label: 'Criar personagem novo', left: true, onClick: () => { setTimeout(() => Atelie.abrirAba(null), 50); return true; } }, { label: 'Cancelar', value: null }] });
    try {
      const [lista, locais] = await Promise.all([Nuvem.lista().catch(e => { if (!navigator.onLine) return []; throw e; }), Atelie.rascunhos().then(rs => rs.filter(r => !r.nuvem))]);
      body.innerHTML = '';
      // personagens LOCAIS (só neste computador): dá para usar na animação; a equipe não vê até ele ir para a nuvem
      if (locais.length) { body.appendChild(h(`<div class="sec">${ic('save', 14)} Só neste computador <small style="color:var(--tx3);font-weight:400;margin-left:6px">a equipe não vê</small></div>`)); const g = h('<div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))"></div>');
        for (const r of locais) { const c = h(`<div class="pc rasc" data-prev-rasc="${esc(r.def.id)}"><div class="th" style="aspect-ratio:1;${r.thumb ? `background-image:url('${r.thumb}')` : ''}"></div><div class="in"><b>${esc(r.def.nome)}</b></div><span class="tag-local">${ic('save', 11)} só aqui</span></div>`);
          c.onclick = async () => { c.style.opacity = .5; escolhido = clone(r.def); await Arq.garantir(Modelo.chavesImgs(r.def)).catch(() => { }); $('#modal-root .modal-back [data-x]')?.click(); }; g.appendChild(c); }
        body.appendChild(g); if (lista.length) body.appendChild(h(`<div class="sec">${ic('cloud', 14)} Na nuvem da equipe</div>`)); }
      if (!lista.length && !locais.length) body.innerHTML = '<div class="vazio">Nenhum personagem ainda. Crie o primeiro no Ateliê.</div>';
      else if (lista.length) { const pastas = [...new Set(lista.map(x => x.pasta))];
        for (const pa of pastas) { body.appendChild(Home.tituloPasta(pa)); const g = h('<div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))"></div>');
          for (const it of lista.filter(x => x.pasta === pa)) { const c = h(`<div class="pc" data-prev-id="${esc(it.id)}"><div class="th" style="aspect-ratio:1;${it.thumb ? `background-image:url('${it.thumb}')` : ''}"></div><div class="in"><b>${esc(it.nome)}</b></div></div>`);
            const selo = Autores.selo(it); if (selo) c.appendChild(selo);
            c.onclick = async () => { c.style.opacity = .5; try { escolhido = await Nuvem.abrir(it.id); } catch (e) { UI.toast(esc(e.message), { kind: 'err' }); } $('#modal-root .modal-back [data-x]')?.click(); }; g.appendChild(c); }
          body.appendChild(g); } }
    } catch (e) { body.innerHTML = `<div class="vazio">Não consegui abrir a biblioteca: ${esc(e.message)}</div>`; }
    await p; return escolhido;
  },
};
