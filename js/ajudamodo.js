/* ===================== ajudamodo.js — MODO AJUDA do Ateliê (botão "?") =====================
   Ligado: o botão fica aceso, o cursor vira interrogação e a tela fica PAUSADA (nada muda: cliques, arrastos e atalhos não
   fazem nada). Clicar em qualquer coisa (ferramenta, opção, botão, item da lista, opção de um menu do botão direito) mostra
   uma janelinha explicando o que é e o que faz, com o ícone e, quando ajuda, um desenho de exemplo. O botão direito continua
   abrindo os menus normalmente (aí clicar numa opção explica em vez de fazer). Esc ou o "?" de novo desliga.
   Otimizado: só UM ouvinte por tipo de evento (na fase de captura, sai na hora se estiver desligado) e UMA janelinha reaproveitada. */
'use strict';
const AjudaModo = {
  on: false,
  // desenhos de exemplo (pequenos, em SVG: nada para baixar)
  _ex(corpo) { return `<svg viewBox="0 0 120 64" width="120" height="64" fill="none" stroke-linecap="round" stroke-linejoin="round">${corpo}</svg>`; },
  EX: {
    pincel: () => AjudaModo._ex('<path d="M10 46 C30 10 50 56 70 26 S100 20 110 38" stroke="#5aa9e8" stroke-width="7"/><path d="M10 46 C30 10 50 56 70 26" stroke="#fff" stroke-width="1" opacity=".35"/>'),
    borracha: () => AjudaModo._ex('<path d="M10 40 H110" stroke="#5aa9e8" stroke-width="12"/><rect x="48" y="28" width="26" height="24" fill="#101010"/><rect x="48" y="28" width="26" height="24" stroke="#e8c25a" stroke-dasharray="3 3"/>'),
    balde: () => AjudaModo._ex('<path d="M20 12 H100 V52 H20Z" stroke="#ddd" stroke-width="3"/><path d="M22 14 H98 V50 H22Z" fill="#f0883e" opacity=".85"/><path d="M60 32 l6 -6" stroke="#fff" stroke-width="2"/>'),
    conta: () => AjudaModo._ex('<rect x="10" y="12" width="40" height="40" rx="6" fill="#e5534b"/><path d="M58 32 H74" stroke="#888" stroke-width="2" stroke-dasharray="3 3"/><circle cx="96" cy="32" r="16" fill="#e5534b" stroke="#fff" stroke-width="2"/>'),
    ret: () => AjudaModo._ex('<circle cx="40" cy="34" r="18" fill="#f0883e"/><rect x="58" y="14" width="50" height="38" fill="#5aa9e8" opacity=".7"/><rect x="30" y="10" width="54" height="44" stroke="#fff" stroke-dasharray="4 3"/>'),
    laco: () => AjudaModo._ex('<circle cx="40" cy="34" r="18" fill="#f0883e"/><rect x="62" y="16" width="44" height="34" fill="#5aa9e8" opacity=".7"/><path d="M20 30 C18 8 60 6 62 22 C66 40 50 58 30 52 C18 48 22 40 20 30Z" stroke="#fff" stroke-dasharray="4 3"/>'),
    varinha: () => AjudaModo._ex('<path d="M14 10 H106 V54 H14Z" stroke="#ddd" stroke-width="3"/><path d="M16 12 H60 V52 H16Z" fill="#7bd88f"/><path d="M60 12 H104 V52 H60Z" fill="#5aa9e8"/><path d="M16 12 H60 V52 H16Z" stroke="#fff" stroke-dasharray="4 3"/>'),
    magica: () => AjudaModo._ex('<path d="M14 10 H106 V54 H14Z" stroke="#ddd" stroke-width="3"/><path d="M60 12 H104 V52 H60Z" fill="#5aa9e8"/><path d="M16 12 H60 V52 H16Z" fill="#101010" stroke="#e8c25a" stroke-dasharray="3 3"/>'),
    mover: () => AjudaModo._ex('<rect x="38" y="16" width="44" height="32" rx="4" stroke="#888" stroke-dasharray="4 3"/><path d="M60 8 V56 M36 32 H84 M60 8 l-5 5 M60 8 l5 5 M60 56 l-5 -5 M60 56 l5 -5 M36 32 l5 -5 M36 32 l5 5 M84 32 l-5 -5 M84 32 l-5 5" stroke="#5aa9e8" stroke-width="2.5"/>'),
    camada: () => AjudaModo._ex('<rect x="22" y="18" width="46" height="34" rx="4" fill="#3a3a3a" stroke="#666"/><rect x="50" y="10" width="46" height="34" rx="4" fill="#5aa9e8" opacity=".85"/><path d="M76 50 l10 0 M86 50 l-4 -4 M86 50 l-4 4" stroke="#fff" stroke-width="2"/>'),
    pontos: () => AjudaModo._ex('<path d="M12 50 C30 6 80 6 108 46" stroke="#a78bfa" stroke-width="3"/><path d="M12 50 L30 12 M108 46 L84 10" stroke="#888"/><circle cx="12" cy="50" r="4" fill="#fff"/><circle cx="108" cy="46" r="4" fill="#fff"/><circle cx="30" cy="12" r="3" fill="#a78bfa"/><circle cx="84" cy="10" r="3" fill="#a78bfa"/>'),
    camadas: () => AjudaModo._ex('<path d="M60 10 104 26 60 42 16 26Z" fill="#2a3a4a" stroke="#5aa9e8"/><path d="M16 34 60 50 104 34" stroke="#5aa9e8"/><path d="M16 42 60 58 104 42" stroke="#5aa9e8" opacity=".6"/>'),
    resto: () => AjudaModo._ex('<circle cx="60" cy="18" r="10" fill="#f0c27a" opacity=".35"/><rect x="48" y="28" width="24" height="26" rx="4" fill="#5aa9e8"/><path d="M48 32 L34 48 M72 32 L86 48" stroke="#f0c27a" stroke-width="6" opacity=".35"/>'),
  },
  // explicações: pela ferramenta (data-f), pelo id do botão, pela aba, ou pelo texto (regex) do botão/menu
  FERR: {
    mover: ['Mão (mover)', 'Arrastar na tela move a VISTA (não mexe no desenho). No palco, arrastar uma peça muda a posição dela. A rodinha dá zoom.', 'V'],
    pincel: ['Pincel', 'Pinta com a cor escolhida na camada ativa. Tamanho, opacidade, dureza e fluxo ficam na barra de cima. Com mesa digitalizadora a pressão da caneta muda a grossura. Shift+clique faz uma linha reta.', 'B'],
    borracha: ['Borracha', 'Apaga na camada ativa. Num frame parado da timeline ela pergunta se apaga na imagem toda ou só naquele frame.', 'N'],
    balde: ['Balde', 'Pinta de uma vez a área fechada onde você clicar (para nas linhas). Com camadas, pode olhar o desenho de todas as camadas para achar a área.', 'G'],
    conta: ['Conta-gotas', 'Clique numa cor do desenho para pegar ela como a cor do pincel. Com Shift ela também entra na seleção de cores.', 'I'],
    camada: ['Mover camada', 'Arrasta só a camada ativa (o resto da imagem fica parado).', 'K'],
    ret: ['Seleção retangular', 'Arraste para marcar um retângulo. Depois dá para apagar, recortar ou copiar para uma parte nova. Shift soma, Alt tira.', 'M'],
    laco: ['Laço', 'Desenhe em volta do que quer marcar, à mão livre. Shift soma, Alt tira.', 'L'],
    varinha: ['Varinha', 'Marca de uma vez toda a área da mesma cor (ou a área fechada pelas linhas) onde você clicar.', 'W'],
    magica: ['Borracha mágica', 'Apaga de uma vez toda a área da mesma cor onde você clicar (bom para tirar fundo).', 'Y'],
    pontos: ['Pontos do vetor', 'Só em imagens SVG: clique numa forma para ver os pontos; arraste pontos e alças para mudar a curva. Alt quebra a alça, Delete tira o ponto, dois cliques na borda põe um ponto novo.', 'A'],
  },
  ID: {
    'at-ed-ok': ['Salvar', 'Guarda o que você mudou nesta imagem e volta ao Ateliê. O mesmo que apertar Esc.', 'check'],
    'at-ed-voltar': ['Voltar', 'Fecha o editor SEM guardar: desfaz tudo o que mudou desde que abriu (pergunta antes; o Ctrl+Z traz de volta).', 'x'],
    'at-ed-resto': ['Mostrar o resto', 'Desenha as outras partes do personagem em volta, meio apagadas, para você pintar vendo onde a imagem fica. A barrinha muda a opacidade. É só para ver: não dá para pintar nelas.', 'eye', 'resto'],
    'at-enq': ['Enquadrar', 'Põe o personagem (ou a imagem, no editor) inteiro no meio da tela, no tamanho certo.', 'frame'],
    'at-regua': ['Régua e ímã', 'Liga a régua e faz a peça grudar nas bordas e no meio das outras e no centro enquanto arrasta. Ctrl segura para não grudar. Atalho R.', 'ruler'],
    'at-ref': ['Pela referência', 'Põe cada peça no lugar certo comparando com a parte "Referência" (ou o Fantasma).', 'magnet'],
    'at-mover': ['O que arrastar muda', 'Só nesta pose: a posição vale só na pose/preset de agora. Imagem em todas: muda o ajuste da imagem em todo lugar que ela aparece. Parte inteira: muda a base da parte.', 'cursor'],
    'at-base': ['Voltar à padrão', 'Sai da pose (preset) que está editando e volta para a pose padrão do personagem.', 'home'],
    'at-salvar': ['Salvar na nuvem', 'Manda o personagem para a nuvem da equipe (todos passam a ver esta versão). Ele também vai sozinho 1 minuto depois da última mudança.', 'save'],
    'at-undo': ['Desfazer', 'Volta a última mudança (Ctrl+Z).', 'undo'],
    'at-redo': ['Refazer', 'Refaz o que foi desfeito (Ctrl+Y).', 'redo'],
    'at-ia': ['IA', 'Pede para a IA organizar ou mudar o personagem (partes, poses, animações de teste…).', 'sparkles'],
    'at-add-img': ['+ Imagens', 'Põe imagens (PNG com fundo transparente ou SVG) nesta parte. Também dá para arrastar os arquivos para a lista.', 'image'],
    'at-add-pasta': ['+ Pasta', 'Cria uma pasta para organizar as imagens desta parte (ex.: olhos, bocas).', 'folder'],
    'at-layout-padrao': ['Design padrão', 'Volta os painéis, os tamanhos e a barra de ferramentas para o lugar de sempre.', 'undo'],
    'at-nome': ['Nome do personagem', 'O nome que aparece na biblioteca e no Animador.', 'edit'],
    'at-pasta': ['Pasta', 'Em qual pasta da biblioteca o personagem fica.', 'folder'],
    'at-ferr': ['Barra de ferramentas', 'As ferramentas de pintar e selecionar. Arraste pela alça de pontinhos para mudar de lugar (ela gruda nas bordas); dois cliques na alça voltam ao lugar padrão.', 'grip'],
  },
  ABA: {
    peca: ['Aba Peça', 'Posição, giro, tamanho, pivô e as opções da parte escolhida.', 'sliders'],
    sessoes: ['Aba Poses', 'As sessões (olhos, boca, braços…) e as poses (presets) de cada uma. Clicar numa pose mostra ela; com um frame parado, o frame passa a usar a pose.', 'bookmark'],
    animacoes: ['Aba Animações', 'As animações de teste do personagem (trilhas e passos), o fundo do palco e o fantasma.', 'film'],
    pintar: ['Aba Camadas', 'Camadas, ajustes, seleção e cores da imagem que está pintando.', 'layers', 'camadas'],
  },
  // pelo texto (botões, menus, opções da barra de cima, títulos)
  TXT: [
    [/^tamanho/i, 'Tamanho', 'A grossura do pincel/borracha em pixels. Atalhos [ e ].', 'brush'],
    [/^opacidade/i, 'Opacidade', 'O quanto a tinta (ou a camada) cobre o que está embaixo: 100% cobre tudo, menos fica transparente.', 'eye'],
    [/^dureza/i, 'Dureza', 'A borda do pincel: 100% = borda firme; menos = borda macia, esfumada.', 'brush'],
    [/^fluxo/i, 'Fluxo', 'Quanta tinta sai a cada passada: menos fluxo vai escurecendo aos poucos quando passa de novo.', 'brush'],
    [/mais op/i, 'Mais opções', 'Mostra as outras opções do pincel: espaçamento, suavização, formato, presets…', 'sliders'],
    [/mesa|caneta/i, 'Mesa digitalizadora', 'Mostra se a caneta da mesa foi reconhecida (pressão muda a grossura; a ponta de trás apaga).', 'pencil'],
    [/toler/i, 'Tolerância', 'O quanto uma cor pode ser diferente e ainda contar como a mesma área (balde, varinha, borracha mágica).', 'wand'],
    [/todas as camadas/i, 'Usar todas as camadas', 'A área é achada olhando o desenho de todas as camadas visíveis, mas só a camada escolhida muda.', 'layers'],
    [/^\+?\s*camada$/i, '+ Camada', 'Cria uma camada vazia por cima da escolhida.', 'plus', 'camadas'],
    [/^imagem…|^imagem\.\.\./i, 'Imagem…', 'Põe um arquivo do computador como uma camada nova.', 'upload'],
    [/do personagem/i, 'Do personagem', 'Põe outra imagem deste personagem como camada (passe o mouse no menu para ver cada uma grande).', 'image'],
    [/selecionar tudo/i, 'Selecionar tudo', 'Marca a imagem inteira.', 'marquee'],
    [/aparar todas/i, 'Aparar todas da parte', 'Corta a sobra transparente em volta de todas as imagens desta parte (o desenho fica no mesmo lugar).', 'crop'],
    [/^aparar/i, 'Aparar', 'Corta a sobra transparente em volta da imagem (o desenho fica no mesmo lugar).', 'crop'],
    [/cores base/i, 'Cores base', 'As cores que mais aparecem no personagem. Clique numa para pintar com ela; Shift+clique junta mais cores na seleção para trocar.', 'palette'],
    [/trocar cores/i, 'Trocar cores', 'Troca as cores escolhidas por outras em todas as imagens (à mão ou pedindo para a IA).', 'palette'],
    [/^cor\b/i, 'Cor', 'A cor do pincel e do balde.', 'palette'],
    [/editar a imagem/i, 'Editar a imagem…', 'Abre esta imagem sozinha no editor (modo Photoshop) para pintar.', 'brush'],
    [/converter para svg/i, 'Converter para SVG', 'Transforma a imagem em vetor (linhas e cores separadas, sem perder qualidade no zoom). O PNG de antes fica guardado.', 'nodes'],
    [/converter para png/i, 'Converter para PNG', 'Volta a imagem para PNG (pixels).', 'image'],
    [/mover só a imagem/i, 'Mover só esta imagem em tudo', 'Liga um modo em que arrastar muda o ajuste DESTA imagem em todo lugar que ela aparece (ela fica vermelha).', 'cursor'],
    [/mesma posição/i, 'Todas as imagens na mesma posição', 'Acerta todas as imagens da parte pela que aparece agora (centro, embaixo ou em cima).', 'frame'],
    [/renomear/i, 'Renomear', 'Muda o nome.', 'edit'],
    [/duplicar/i, 'Duplicar', 'Faz uma cópia logo abaixo.', 'dup'],
    [/apagar|excluir|remover/i, 'Apagar', 'Tira isso (o Ctrl+Z traz de volta).', 'trash'],
    [/espelhar/i, 'Espelhar', 'Vira o desenho como num espelho.', 'flip'],
    [/exportar/i, 'Exportar', 'Salva isso num arquivo para levar para outro personagem ou computador.', 'download'],
    [/citar/i, 'Citar', 'Põe isso como referência numa mensagem (para alguém da equipe ou para a IA saber do que você fala).', 'chat'],
    [/pedir para a ia/i, 'Pedir para a IA', 'Abre a IA já com o pedido sobre isso.', 'sparkles'],
  ],
  // ---------- ligar / desligar ----------
  troca(v = !this.on) {
    this.on = v; document.body.classList.toggle('ajuda-on', v); $('#at-ajuda')?.classList.toggle('on', v);
    if (!v) { this.fecha(); return; }
    this.mostra({ t: 'Modo ajuda ligado', ic: 'info', txt: 'Clique em qualquer coisa (ferramentas, botões, opções, itens das listas, opções do botão direito) para ver o que é e o que faz. A tela fica pausada: nada muda enquanto a ajuda está ligada. Esc ou o "?" desliga.',
      extra: '<b>Atalhos do Ateliê</b><br>Arrastar: posiciona · Alt+arrastar: muda o pivô · Ctrl+arrastar: gira · setas, Q/E girar, +/− tamanho, F espelhar, [ ] frente/trás, Tab próxima parte, H esconder · espaço ou botão do meio: mover a tela · dois cliques numa peça/imagem: editar a imagem · P toca/pausa, , e . andam um frame' }, $('#at-ajuda'));
  },
  liga() {
    if (this._ok) return; this._ok = true;
    const b = $('#at-ajuda'); if (b) { b.title = 'Modo ajuda: clique em qualquer coisa para saber o que é e o que faz'; b.innerHTML = '?'; b.onclick = () => this.troca(); }
    const dentro = el => el && (el.closest('#atelie') || el.closest('#ctx-root') || el.closest('.dock-soltos') || el.closest('#at-ferr') || el.closest('.ferr-op'));
    const bloqueia = e => {
      if (!this.on) return; const t = e.target;
      if (t.closest?.('.ajm')) return; // a própria janelinha
      if (t.closest?.('#at-ajuda')) { if (e.type === 'click') { e.preventDefault(); e.stopImmediatePropagation(); this.troca(false); } else if (e.type !== 'contextmenu') { e.stopImmediatePropagation(); } return; }
      if (!dentro(t) || t.closest('.modal, .ui-modal, dialog')) return; // janelas de pergunta e o resto do site funcionam normal
      if (e.type === 'contextmenu') return; // botão direito abre os menus normalmente
      if ((e.type === 'pointerdown' || e.type === 'mousedown') && e.button === 2) { if (!t.closest('#at-cv')) return; } // no palco o menu sai pelo contextmenu
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.type === 'click' && e.button === 0) this.explica(t, e);
    };
    for (const ev of ['pointerdown', 'mousedown', 'click', 'dblclick', 'dragstart', 'pointerup', 'mouseup', 'auxclick', 'change', 'input']) addEventListener(ev, bloqueia, true);
    // teclado parado (nada de atalhos que mudam o desenho); Esc desliga
    addEventListener('keydown', e => { if (!this.on) return; if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); return this.troca(false); } if (e.target.closest?.('input, textarea, [contenteditable]') && !e.target.closest('#atelie')) return; if (['F5', 'F12'].includes(e.key) || ((e.ctrlKey || e.metaKey) && /^[rl]$/i.test(e.key))) return; e.preventDefault(); e.stopImmediatePropagation(); }, true);
    addEventListener('resize', () => this.fecha());
  },
  // ---------- o que foi clicado ----------
  achar(t) {
    const ctxI = t.closest('.ctx-item'); if (ctxI) { const it = ctxI._it || {}; const l = it.label || $('.ctx-label', ctxI)?.textContent || ''; const x = this.porTexto(l); return { t: l, ic: it.icon || x?.ic, txt: it.dica || x?.txt || 'Opção deste menu: clique nela com a ajuda desligada para fazer isso.', el: ctxI, ex: x?.ex }; }
    const f = t.closest('#at-ferr [data-f]'); if (f) { const d = this.FERR[f.dataset.f]; if (d) return { t: d[0], txt: d[1], key: d[2], ic: Pintura.FERR.find(x => x[0] === f.dataset.f)?.[2], ex: f.dataset.f, el: f }; }
    if (t.closest('#at-cv')) { const ed = Atelie.edImg, fe = this.FERR[Pintura.ferr]; return { t: ed ? 'Tela de pintura' : 'Palco', ic: ed ? 'brush' : 'monitor', txt: ed ? `Aqui fica só a imagem que está editando. A ferramenta de agora é <b>${esc(fe?.[0] || Pintura.ferr)}</b>: ${fe?.[1] || ''}` : 'O personagem montado. Clique numa peça para escolher a parte, arraste para mover, dois cliques para editar a imagem dela. Rodinha = zoom, espaço/botão do meio = mover a tela.', ex: ed ? Pintura.ferr : null, el: null };}
    for (let el = t; el && el !== document.body; el = el.parentElement) {
      if (el.id && this.ID[el.id]) { const d = this.ID[el.id]; return { t: d[0], txt: d[1], ic: d[2], ex: d[3], el }; }
      if (el.dataset?.aba && this.ABA[el.dataset.aba]) { const d = this.ABA[el.dataset.aba]; return { t: d[0], txt: d[1], ic: d[2], ex: d[3], el }; }
      if (el.matches?.('.no[data-pid]')) { const p = Atelie.parte(el.dataset.pid); return { t: `Parte: ${p?.nome || ''}`, ic: 'bone', txt: 'Uma parte do personagem. Clique para escolher; arraste em cima/embaixo de outra para mudar quem fica na frente (em cima = atrás), no meio para virar filha dela. O olho esconde. No modo Photoshop, dois cliques passam a editar a imagem dela.', el, img: this.imgDe(p) }; }
      if (el.matches?.('.im[data-iid]')) { const p = Atelie.parte(), im = p?.imgs.find(i => i.id === el.dataset.iid); return { t: `Imagem: ${im?.nome || ''}`, ic: 'image', txt: 'Uma das imagens desta parte. Clique para usar ela; dois cliques para editar (modo Photoshop); arraste para uma pasta. O selo no canto diz se é PNG ou SVG.', el, img: im?.k }; }
      if (el.matches?.('.cam, [data-cam], .vcam')) return { t: 'Camada', ic: 'layers', txt: 'Uma camada da imagem. Clique para escolher em qual camada pinta; o olho esconde; arraste para mudar a ordem; botão direito tem mais opções.', el, ex: 'camadas' };
      if (el.matches?.('.sess, [data-prid]')) return { t: el.matches('[data-prid]') ? 'Pose (preset)' : 'Sessão', ic: 'bookmark', txt: 'As sessões juntam partes (olhos, boca…) e cada uma tem poses (presets). Clicar numa pose mostra ela; com um frame parado na timeline, o frame passa a usar a pose.', el };
      if (el.matches?.('.tl-c')) return { t: 'Frame da animação de teste', ic: 'film', txt: 'Clique para parar neste frame: o que mexer nas peças vale só nele. Shift/Ctrl+clique escolhe vários. Arraste pela alça para mudar a ordem.', el };
      if (el.matches?.('.dock-pega, .dock-jbar')) return { t: 'Mudar o painel de lugar', ic: 'grip', txt: 'Arraste para levar o painel para outra coluna, para baixo do palco ou soltar como janela. Perto de uma borda ele gruda.', el };
      if (el.matches?.('.av, [data-vista]')) return { t: 'Vista', ic: 'camera', txt: 'Um ângulo do personagem (frente, três-quartos, lado, costas…). Clique para trocar; arraste para mudar a ordem (a primeira é a principal).', el };
      const tx = this.textoDe(el); if (tx) { const x = this.porTexto(tx); if (x) return { ...x, el }; }
      if (el.title && el.title.length > 3) return { t: this.textoDe(el) || el.title.split(/[·:(]/)[0].trim(), ic: this.icDe(el), txt: esc(el.title), el };
      if (el.matches?.('button, label, select, input')) { const tx2 = this.textoDe(el); if (tx2) return { t: tx2, ic: this.icDe(el), txt: 'Um controle do Ateliê.', el }; }
    }
    return { t: 'Ateliê', ic: 'info', txt: 'Esta área não tem uma explicação própria. Clique num botão, numa ferramenta ou numa opção para ver o que ela faz.', el: null };
  },
  textoDe(el) { const s = (el.matches?.('label') ? [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ') : el.textContent || '').replace(/\s+/g, ' ').trim(); return s.length && s.length < 50 ? s : ''; },
  porTexto(s) { s = String(s || '').trim(); for (const [re, t, txt, ic, ex] of this.TXT) if (re.test(s)) return { t, txt, ic, ex }; return null; },
  icDe(el) { return null; }, // o ícone vem copiado do próprio botão (veja mostra)
  imgDe(p) { const it = p && Modelo.montar(Atelie.def, Atelie.estado()).find(x => x.parte.id === p.id); return it?.img?.k || p?.imgs?.[0]?.k; },
  explica(t, e) { const x = this.achar(t); this.mostra(x, x.el || null, e); if (x.el) { $$('.ajm-alvo').forEach(a => a.classList.remove('ajm-alvo')); x.el.classList.add('ajm-alvo'); } },
  // ---------- a janelinha (uma só, reaproveitada) ----------
  mostra(x, el, e) {
    let p = this._p; if (!p) { p = this._p = h('<div class="ajm" role="dialog"></div>'); document.body.appendChild(p); }
    const svg = el && !x.ic ? el.querySelector('svg')?.outerHTML : '';
    const ex = x.ex && this.EX[x.ex] ? this.EX[x.ex]() : '';
    p.innerHTML = `<div class="ajm-cab"><span class="ajm-ic">${x.ic ? ic(x.ic, 18) : svg || ic('info', 18)}</span><b>${esc(x.t || '')}</b>${x.key ? `<kbd>${esc(x.key)}</kbd>` : ''}<button class="ibtn ajm-x" title="Fechar">${ic('x', 13)}</button></div>
      <div class="ajm-txt">${x.txt || ''}</div>${ex ? `<div class="ajm-ex">${ex}</div>` : ''}${x.img ? '<canvas class="ajm-img" width="200" height="110"></canvas>' : ''}${x.extra ? `<div class="ajm-extra">${x.extra}</div>` : ''}
      <div class="ajm-pe">Modo ajuda · a tela está pausada · <a href="#" class="ajm-sair">sair (Esc)</a></div>`;
    $('.ajm-x', p).onclick = () => this.fecha(); $('.ajm-sair', p).onclick = ev => { ev.preventDefault(); this.troca(false); };
    if (x.img) { const cv = $('.ajm-img', p), pinta = () => { const b = Arq.img.get(x.img); if (!b || !cv.isConnected) return; const c = cv.getContext('2d'), k = Math.min(cv.width / b.width, cv.height / b.height, 2); c.clearRect(0, 0, cv.width, cv.height); c.drawImage(b, (cv.width - b.width * k) / 2, (cv.height - b.height * k) / 2, b.width * k, b.height * k); }; if (Arq.img.get(x.img)) pinta(); else Arq.bitmap(x.img, pinta); }
    p.hidden = false; const r = p.getBoundingClientRect(), W = r.width, H = r.height;
    let L, T; const a = el?.getBoundingClientRect?.();
    if (a && a.width) { L = a.right + 10; T = a.top; if (L + W > innerWidth - 8) L = a.left - W - 10; if (L < 8) { L = clamp(a.left, 8, innerWidth - W - 8); T = a.bottom + 8; } }
    else { L = (e?.clientX ?? innerWidth / 2) + 14; T = (e?.clientY ?? innerHeight / 3) + 14; if (L + W > innerWidth - 8) L = (e?.clientX ?? innerWidth) - W - 14; }
    p.style.left = clamp(L, 8, innerWidth - W - 8) + 'px'; p.style.top = clamp(T, 8, innerHeight - H - 8) + 'px';
  },
  fecha() { if (this._p) this._p.hidden = true; $$('.ajm-alvo').forEach(a => a.classList.remove('ajm-alvo')); },
};

{ const vai = () => AjudaModo.liga(); document.readyState === 'loading' ? addEventListener('DOMContentLoaded', vai) : vai(); }
