/* ===================== arvore.js — hierarquia: camadas e pastas (arrastar para ordenar ou pôr dentro), mostrar/travar, renomear ===================== */
'use strict';
const TIPO_IC = { pasta: 'folder', personagem: 'layers', imagem: 'image', texto: 'text', efeito: 'sparkles', forma: 'shapes', video: 'film' };
const Arvore = {
  arrastando: null,
  pinta() {
    const P = App.P, el = $('#arvore'); if (!P || !el) return;
    const linhas = Modelo.linhas(P);
    el.innerHTML = linhas.length ? '' : '<div class="vazio">Nada na cena ainda.<br>Use <b>+</b> aqui em cima para pôr um personagem, imagem ou texto.</div>';
    for (const { no: n, nivel } of linhas) {
      const fora = !Modelo.aparece(P, n, App.q), defP = n.tipo === 'personagem' ? P.personagens[n.ref] : null, corP = defP && Icone.cor(defP);
      const r = h(`<div class="no ${App.sel === n.id ? 'sel' : ''} ${fora ? 'fora' : ''} ${n.tipo === 'efeito' ? 'efeito' : ''} ${n.filhos && n.corPasta ? 'com-cor' : ''} ${corP ? 'pers-cor' : ''}" draggable="true" data-id="${n.id}" style="padding-left:${6 + nivel * 14}px;${corP ? `--cp:${corP};` : ''}${n.filhos && n.corPasta ? `--pc:${n.corPasta}` : ''}" title="${fora ? 'Não aparece neste quadro' : ''}">
        <button class="ab" data-ab>${n.filhos ? ic(n.aberto === false ? 'right' : 'down', 12) : ''}</button>
        <span class="ti">${defP ? Icone.html(defP, 18) : ic(TIPO_IC[n.tipo] || 'file', 14)}</span><span class="nm">${esc(n.nome)}${defP?.soProjeto ? `<i class="so-proj" title="Este personagem tem mudanças só deste projeto (o personagem do Ateliê não mudou). Botão direito › Abrir a cópia desta animação no Ateliê para ver.">só neste projeto</i>` : ''}${defP ? Vetor.selo(Vetor.tiposDef(defP), { soSvg: true, curto: true }) : n.tipo === 'imagem' && (n.vetor || Arq.img.get(n.arq) instanceof HTMLImageElement) ? Vetor.selo(['SVG']) : ''}</span>
        <button class="ibtn ${n.vis === false ? 'off' : ''}" data-vis title="Mostrar/esconder">${ic(n.vis === false ? 'eyeOff' : 'eye', 14)}</button>
        <button class="ibtn ${n.trava ? '' : 'off'}" data-trava title="Travar (não mexe sem querer)">${ic(n.trava ? 'lock' : 'unlock', 13)}</button></div>`);
      r.onclick = e => { if (e.target.closest('[data-vis],[data-trava],[data-ab]')) return; App.selecionar(n.id); };
      r.ondblclick = e => { if (!e.target.closest('button')) this.renomear(n, r); };
      $('[data-ab]', r).onclick = () => { if (!n.filhos) return; n.aberto = n.aberto === false; App.atualiza({ semLado: true }); };
      $('[data-vis]', r).onclick = () => { n.vis = n.vis === false; App.commit(n.vis ? 'Mostrar' : 'Esconder'); };
      $('[data-trava]', r).onclick = () => { n.trava = !n.trava; App.commit(n.trava ? 'Travar' : 'Destravar'); };
      r.oncontextmenu = e => { e.preventDefault(); App.selecionar(n.id); this.menu(e, n); };
      // arrastar: em cima/embaixo de uma camada = muda a ordem; no meio de uma pasta = entra nela
      r.ondragstart = e => { this.arrastando = n.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', n.id); };
      r.ondragend = () => { this.arrastando = null; $$('.no', el).forEach(x => x.classList.remove('drop-antes', 'drop-depois', 'drop-dentro')); };
      r.ondragover = e => { if (!this.arrastando || this.arrastando === n.id) return; e.preventDefault(); const z = this.zona(e, r, n); $$('.no', el).forEach(x => x.classList.remove('drop-antes', 'drop-depois', 'drop-dentro')); r.classList.add('drop-' + z); };
      r.ondrop = e => { e.preventDefault(); const z = this.zona(e, r, n); this.mover(this.arrastando, n.id, z); };
      el.appendChild(r);
    }
  },
  zona(e, r, n) { const b = r.getBoundingClientRect(), y = (e.clientY - b.top) / b.height; return n.filhos && y > .28 && y < .72 ? 'dentro' : y < .5 ? 'antes' : 'depois'; },
  mover(id, alvoId, zona) {
    const P = App.P; if (!id || id === alvoId) return;
    if (Modelo.ancestrais(P, alvoId).some(a => a.id === id)) return UI.toast('Uma pasta não pode entrar nela mesma');
    const a = Modelo.achar(P, id), b = Modelo.achar(P, alvoId); if (!a || !b) return;
    // mantém o lugar na tela: converte a posição para o espaço do novo pai
    const mAntes = App.matPai(id).multiply(Render.matNo(new DOMMatrix(), Modelo.transf(a.no, App.q)));
    a.lista.splice(a.lista.indexOf(a.no), 1);
    if (zona === 'dentro') { b.no.filhos.unshift(a.no); b.no.aberto = true; }
    else { const L = Modelo.achar(P, alvoId).lista, i = L.indexOf(b.no); L.splice(zona === 'antes' ? i : i + 1, 0, a.no); }
    const novoPai = App.matPai(id), loc = novoPai.inverse().multiply(mAntes), t = Modelo.transf(a.no, App.q);
    if (Math.abs(loc.e - t.x) > .5 || Math.abs(loc.f - t.y) > .5) for (const k of Object.keys(a.no.chaves || {})) { const c = a.no.chaves[k]; if (c.x != null) { c.x = round(c.x + loc.e - t.x, 1); c.y = round(c.y + loc.f - t.y, 1); } }
    App.commit(zona === 'dentro' ? 'Pôr na pasta' : 'Mudar a ordem');
  },
  renomear(n, r) {
    const nm = $('.nm', r); nm.innerHTML = `<input type="text" value="${esc(n.nome)}">`; const i = $('input', nm); i.focus(); i.select();
    const fim = ok => { if (ok && i.value.trim()) { n.nome = i.value.trim().slice(0, 60); App.commit('Renomear'); } else this.pinta(); };
    i.onkeydown = e => { if (e.key === 'Enter') fim(true); if (e.key === 'Escape') fim(false); e.stopPropagation(); };
    i.onblur = () => fim(true);
  },
  menu(e, n) {
    UI.ctx(e.clientX, e.clientY, [
      n.tipo === 'personagem' && { label: `Arrumar o quadro ${App.q + 1} aqui (Ateliê ao lado)`, icon: 'brush', action: () => QuadroEd.abrir(n) },
      n.tipo === 'personagem' && { label: `Editar no Ateliê (pose do quadro ${App.q + 1})`, icon: 'edit', action: () => Animacoes.editarNoAtelie(n) },
      n.tipo === 'personagem' && { label: 'Abrir a cópia desta animação no Ateliê (todos os quadros, só aqui)', icon: 'film', action: () => AtelieAnim.abrir(App.P.id, n.ref) },
      n.tipo === 'personagem' && { label: 'Abrir no Ateliê como pose nova…', icon: 'plus', action: () => Animacoes.poseNova(n) },
      n.tipo === 'personagem' && { label: (Modelo.transf(n, App.q).sx || 1) < 0 ? 'Desespelhar (voltar para o lado de antes)' : 'Espelhar (virar para o outro lado)', icon: 'transition', action: () => Animacoes.espelhar(n) }, n.tipo === 'personagem' && '-',
      { label: 'Citar na IA', icon: 'sparkles', ai: true, action: () => Assistente.citar({ tipo: 'camada', id: n.id, nome: n.nome }) },
      Deformar.pode(n) && { label: 'Deformar (cantos ou malha)…', icon: 'transition', key: 'T', action: () => { App.selecionar(n.id); Deformar.entrar(n); } },
      { label: 'Renomear', icon: 'edit', action: () => this.renomear(n, $(`.no[data-id="${n.id}"]`)) },
      { label: 'Duplicar', icon: 'dup', key: 'Ctrl+D', action: () => App.duplicar() },
      { label: 'Pôr numa pasta nova', icon: 'folder', key: 'Ctrl+G', action: () => App.addPasta() },
      { label: 'Organizar tudo em pastas (Cenário, Personagens, Inserts…)', icon: 'layers', action: () => App.organizarPastas() },
      n.filhos && menuCor(n.corPasta, c => { if (c) n.corPasta = c; else delete n.corPasta; App.commit('Cor da pasta'); }),
      n.tipo !== 'efeito' && App.menuTremulo(n),
      n.tipo === 'efeito' && { label: 'Na timeline toda', icon: 'film', action: () => { n.de = 0; n.ate = null; App.commit('Na timeline toda'); } },
      (n.cenario || n.cenLib || Modelo.achar(App.P, n.id)?.pai?.cenario) && (n.tipo === 'pasta' || Modelo.achar(App.P, n.id)?.pai?.cenario) && { label: 'Cenário: padrão e keyframes…', icon: 'layers', action: () => CenLib.abrir({ no: n.tipo === 'pasta' ? n.id : Modelo.achar(App.P, n.id).pai.id }) },
      (n.cenario || n.cena || n.cenaEd || n.pecaCen || Modelo.achar(App.P, n.id)?.pai?.cenario) && !n.cenLib && !Modelo.achar(App.P, n.id)?.pai?.cenLib && { label: 'Editar cenário…', icon: 'paisagem', ai: true, action: () => Cenarios.editarNo(n) },
      n.tipo === 'imagem' && { label: 'Trocar a imagem…', icon: 'image', action: () => App.trocarImagem(n) },
      n.tipo === 'imagem' && '-',
      (n.tipo === 'imagem' || n.cenaEd) && (n.nuvem ? { label: 'Já está na nuvem da equipe', icon: 'check', disabled: true } : { label: 'Salvar na nuvem', icon: 'cloud', action: () => App.salvarNaNuvem(n) }),
      n.filhos && { label: 'Tirar tudo da pasta', icon: 'layers', action: () => { const r = Modelo.achar(App.P, n.id); r.lista.splice(r.lista.indexOf(n), 1, ...n.filhos); App.sel = null; App.commit('Desfazer a pasta'); } },
      '-',
      { label: 'Começar neste quadro', icon: 'start', action: () => { n.de = App.q; if (n.ate != null && n.ate < n.de) n.ate = n.de; App.commit('Começo'); } },
      { label: 'Terminar neste quadro', icon: 'end', action: () => { n.ate = Math.max(n.de || 0, App.q); App.commit('Fim'); } },
      { label: 'Ir até o fim da animação', icon: 'right', action: () => { n.ate = null; App.commit('Até o fim'); } },
      '-', { label: 'Apagar', icon: 'trash', danger: true, key: 'Del', action: () => App.apagarSel() },
    ].filter(Boolean));
  },
};

/* ===================== ORGANIZAR EM PASTAS (pedido da dona, 26/11/2026: "a hierarquia está completamente bagunçada") =====================
   Organizar.pastas(P) junta as camadas do NÍVEL DE CIMA em pastas por papel: "Cenário", "Personagens", "Inserts", "Letreiros", "Efeitos".
   REGRA DE OURO: nada muda na tela. Duas camadas que aparecem ao mesmo tempo continuam na mesma ordem (quem cobre quem); se juntar uma
   camada à pasta do papel dela mudaria isso (ex.: um insert ATRÁS de um personagem), ela vai para outra pasta do mesmo papel
   ("Inserts (atrás)" / "Inserts (frente)"). Prova: em cada quadro, a ordem de desenho das camadas visíveis é a mesma de antes.
   Ficam ONDE ESTÃO (soltas no nível de cima): camadas de efeito (a cor/vinheta A2 do topo vale para tudo o que está embaixo dela na
   mesma lista; dentro de pasta só valeria para a pasta), o "Fundo padrão", os cenários das ferramentas de cenário (pasta "Cenário: …",
   cenário 3D, cenário em vídeo: a troca de cenário, o "Tirar da animação" e a timeline procuram por eles no nível de cima) e as pastas
   feitas por alguém (o que está dentro delas não mexe). As pastas de papel são marcadas com `n.pastaPapel` e não mexem em nada
   (posição 0, escala 1, sem cor): rodar de novo junta o que entrou depois. Não renomeia camada nenhuma. Quem chama faz o App.commit
   (um passo só do Ctrl+Z). Teste em node: a ordem de desenho de cada quadro antes e depois (ver o relatório do ramo f1-pastas-auto). */
const Organizar = {
  NOMES: { cenario: 'Cenário', personagens: 'Personagens', inserts: 'Inserts', letreiros: 'Letreiros', efeitos: 'Efeitos' },
  RX_CEN: /^\s*(cen[áa]rio|fundo|c[ée]u|ch[ãa]o|parede)\b/i,
  RX_EF: /(efeito|explos|flash|brilho|fa[íi]sca|fuma[çc]a|impacto|onomatop|poeira|suor|l[áa]grima|\bpow\b|\bboom\b|\bbam\b|\bzap\b|sfx|choque)/i,
  // o papel de uma camada do nível de cima (null = fica onde está)
  papel(n) {
    if (!n || n.tipo === 'efeito' || n.fundoPadrao || n.cenario || n.cenLib || n.tipo === 'cena3d') return null;
    if (n.filhos) return null; // pasta feita por alguém (ou pelas ferramentas): fica, com o que tem dentro
    if (n.tipo === 'personagem') return 'personagens';
    if (n.tipo === 'texto') return 'letreiros';
    if (n.tipo === 'video') return n.frente ? 'efeitos' : null;
    const nm = String(n.nome || '');
    if (this.RX_CEN.test(nm)) return 'cenario';
    if (n.tipo === 'forma' || this.RX_EF.test(nm)) return 'efeitos';
    if (n.tipo === 'imagem') return 'inserts';
    return null;
  },
  // pasta de papel que dá para desmanchar sem mudar a tela (aparece sempre, não move, não esconde, sem cor, sem efeito dentro)
  neutra(f) {
    if (!f?.pastaPapel || !Array.isArray(f.filhos) || f.vis === false || (f.de || 0) > 0 || f.ate != null) return false;
    if (f.recorte || f.tremulo || f.gruda || f.ancora3d || f.entra || f.sai || f.luzBorda) return false;
    const um = { x: 0, y: 0, r: 0, s: 1, sx: 1, op: 1 };
    for (const c of Object.values(f.chaves || {})) for (const [k, v] of Object.entries(c || {})) { if (k === 'ir' || k === 'curva') continue; if (!(k in um) || +v !== um[k]) return false; }
    return !f.filhos.some(x => x.tipo === 'efeito');
  },
  // quadros em que a camada existe [de, fim]
  faixa(P, n) { return [n.de || 0, Modelo.fimNo(P, n)]; },
  // as camadas soltas do nível de cima + as de dentro das pastas de papel (onde o ritmo e os gestos procuram os personagens)
  topo(P) { const out = []; for (const n of P?.raiz || []) { if (n.pastaPapel && n.filhos) out.push(...n.filhos); else out.push(n); } return out; },
  ids(lista) { const f = n => n.filhos ? [n.id, n.nome, n.filhos.map(f)] : n.id; return JSON.stringify(lista.map(f)); },
  pastas(P) {
    if (!P || !Array.isArray(P.raiz)) return { mudou: false, pastas: [], fora: [] };
    const antes = this.ids(P.raiz);
    // 1) desmancha as pastas de papel neutras (guardando-as pelo nome para reaproveitar: id, aberta/fechada, cadeado, cor)
    const velhas = new Map(), itens = [];
    for (const n of P.raiz) { if (this.neutra(n)) { velhas.set(n.nome, n); itens.push(...n.filhos); } else itens.push(n); }
    // 2) refaz a ordem da frente para trás. Única regra: se A está na frente de B e os dois aparecem juntos em algum quadro, A continua
    //    na frente de B (quem não aparece junto pode trocar de lugar: nunca estão na tela ao mesmo tempo). A cada passo, pega a camada
    //    mais da frente que já pode sair e, se ela tem papel, leva junto todas as do mesmo papel que já podem sair (uma pasta só);
    //    quando uma do mesmo papel ainda tem que ficar atrás de outra coisa, ela vai para outra pasta ("Inserts (atrás)").
    const fx = itens.map(n => this.faixa(P, n)), pap = itens.map(n => this.papel(n)), N = itens.length;
    const falta = new Array(N).fill(0), depois = itens.map(() => []); // falta[j] = quantos da frente de j (que aparecem junto) ainda não saíram
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (fx[i][0] <= fx[j][1] && fx[j][0] <= fx[i][1]) { falta[j]++; depois[i].push(j); }
    const saiu = new Array(N).fill(false), sai = j => { saiu[j] = true; for (const k of depois[j]) falta[k]--; }, pode = j => !saiu[j] && !falta[j];
    const blocos = []; let resta = N;
    while (resta) {
      const i0 = saiu.findIndex((s, j) => pode(j)); // sempre existe: o mais da frente que ainda não saiu não tem ninguém pendente na frente dele
      if (!pap[i0]) { sai(i0); resta--; blocos.push({ papel: null, itens: [itens[i0]] }); continue; }
      const b = { papel: pap[i0], itens: [] }; let achou = true;
      while (achou) { achou = false; for (let j = 0; j < N; j++) if (pap[j] === b.papel && pode(j)) { sai(j); resta--; b.itens.push(itens[j]); achou = true; } }
      blocos.push(b);
    }
    // 3) nomes: papel com uma pasta só = "Inserts"; com mais = a maior fica "Inserts" e as outras "Inserts (frente)" / "Inserts (atrás)"
    const usados = new Set(itens.filter(n => n.filhos).map(n => n.nome));
    for (const p of Object.keys(this.NOMES)) {
      const bs = blocos.filter(b => b.papel === p); if (!bs.length) continue;
      const base = this.NOMES[p], mor = bs.reduce((a, b) => b.itens.length > a.itens.length ? b : a), iM = blocos.indexOf(mor); let nf = 0, na = 0;
      for (const b of bs) {
        let nm = b === mor ? base : blocos.indexOf(b) < iM ? `${base} (frente${++nf > 1 ? ' ' + nf : ''})` : `${base} (atrás${++na > 1 ? ' ' + na : ''})`;
        let k = 2; const nm0 = nm; while (usados.has(nm)) nm = `${nm0} ${k++}`; usados.add(nm); b.nome = nm;
      }
    }
    // 4) monta a lista nova do nível de cima
    const raiz = [], pastas = [], fora = [];
    for (const b of blocos) {
      if (!b.papel) { raiz.push(b.itens[0]); fora.push(b.itens[0]); continue; }
      let f = velhas.get(b.nome); if (f) velhas.delete(b.nome); else { f = Modelo.novoNo('pasta', { nome: b.nome }); f.aberto = b.itens.length <= 6; }
      f.pastaPapel = b.papel; f.de = 0; f.ate = null; f.vis = true; f.chaves = { 0: { x: 0, y: 0, r: 0, s: 1, sx: 1, op: 1 } };
      for (const n of b.itens) delete n.trilha; // dentro de pasta a trilha da timeline não vale (vale a da pasta)
      f.filhos = b.itens; raiz.push(f); pastas.push(f);
    }
    P.raiz.splice(0, P.raiz.length, ...raiz);
    const mudou = this.ids(P.raiz) !== antes;
    // 5) TIMELINE (modo Vídeo, js/premiere.js): lá "trilha mais alta = na frente" e a lista é reordenada pela trilha. Se o projeto já
    //    tem trilhas, elas são refeitas pela ordem do palco (como o "Compactar trilhas"): quem está na frente continua na frente.
    if (mudou && P.raiz.some(n => +n.trilha)) this.trilhas(P);
    return { mudou, pastas: pastas.map(f => ({ nome: f.nome, n: f.filhos.length })), fora: fora.map(n => n.nome || n.tipo) };
  },
  // trilhas da timeline pela ordem do palco (de trás para a frente: cada um fica acima de quem está atrás dele no mesmo tempo)
  trilhas(P) {
    const pl = [], oc = {};
    for (let i = P.raiz.length - 1; i >= 0; i--) {
      const n = P.raiz[i], de = n.de || 0, fim = Modelo.fimNo(P, n); let t = 1;
      for (const c of pl) if (c.de <= fim && c.fim >= de) t = Math.max(t, c.t + 1);
      while ((oc[t] || []).some(([a, b]) => a <= fim && b >= de)) t++;
      (oc[t] ||= []).push([de, fim]); pl.push({ de, fim, t }); n.trilha = t;
    }
  },
  // tira as pastas de papel que ficaram vazias (ex.: o ritmo automático tirou os letreiros)
  limpaVazias(P) { if (!P?.raiz) return; for (let i = P.raiz.length - 1; i >= 0; i--) { const n = P.raiz[i]; if (n.pastaPapel && n.filhos && !n.filhos.length) P.raiz.splice(i, 1); } },
};
if (typeof module !== 'undefined') module.exports = { Arvore, Organizar };
