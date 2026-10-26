/* ===================== inicio.js — liga os botões das barras (ícones e ações) ===================== */
'use strict';
(() => {
  const poe = (id, icone, txt, fn) => { const b = $('#' + id); if (!b) return; b.innerHTML = ic(icone, 15) + (txt ? `<span>${txt}</span>` : ''); if (fn) b.onclick = fn; };
  poe('b-undo', 'undo', '', () => App.undo()); poe('b-redo', 'redo', '', () => App.redo());
  poe('b-regua', 'ruler', '', () => App.trocaRegua()); $('#b-regua').classList.toggle('on', App.regua());
  poe('b-onion', 'onion', '', () => { App.onion = !App.onion; $('#b-onion').classList.toggle('on', App.onion); App.pinta(); });
  poe('b-ia', 'sparkles', 'IA', () => IA.abrir(Lado.foco())); { const b = $('#b-atelie'); if (b) { b.innerHTML = '<span class="ic-atelie ic-ep" data-estudio-icone="at" aria-label="Ateliê"></span>'; b.classList.add('so-icone'); b.title = 'Ateliê de personagens (abrir no Animador ou numa aba nova)'; b.onclick = () => App.abrirAtelie(); } } // ícone do Ateliê (paleta laranja), pergunta simples × completo
  poe('b-exportar', 'download', 'Exportar', () => Exportar.abrir());
  poe('h-pers', 'plus', '', () => App.addPersonagem()); poe('h-cen', 'paisagem', '', () => { const r = $('#h-cen').getBoundingClientRect(); App.menuCenario(r.left, r.bottom + 4); }); poe('h-img', 'image', '', () => App.addImagem()); poe('h-forma', 'shapes', '', () => { const r = $('#h-forma').getBoundingClientRect(); App.menuForma(r.left, r.bottom + 4); }); poe('h-txt', 'text', '', () => App.addTexto()); poe('h-pasta', 'folder', '', () => App.addPasta());
  poe('t-ini', 'start', '', () => App.setQ(0)); poe('t-ant', 'prev', '', () => App.setQ(App.q - 1, { som: true })); poe('b-tocar', 'play', '', () => App.tocar());
  poe('t-prox', 'next', '', () => App.setQ(App.q + 1, { som: true })); poe('t-fim', 'end', '', () => App.setQ(Modelo.ultimoQuadro(App.P)));
  poe('t-loop', 'loop', '', () => { Folha.loop = !Folha.loop; $('#t-loop').classList.toggle('on', Folha.loop); });
  poe('t-chave', 'diamond', 'Chave', () => App.chaveAqui()); poe('t-tira', 'minus', 'Tirar', () => App.tiraChave());
  poe('at-backup', 'download', '', () => AtelieArq.baixar(Atelie.def));   poe('at-voltar', 'left', 'Voltar'); poe('at-undo', 'undo', ''); poe('at-redo', 'redo', '');
  $$('[data-ferr]').forEach(b => { b.innerHTML = ic({ mover: 'cursor', mao: 'move', camera: 'camera' }[b.dataset.ferr], 15); b.onclick = () => App.setFerr(b.dataset.ferr); });
  $$('[data-vista]').forEach(b => b.onclick = () => App.setVista(b.dataset.vista));
  $$('#lado-abas [data-aba]').forEach(b => b.onclick = () => Lado.aba(b.dataset.aba));
  $('#ed-inicio').onclick = () => App.fechar();
  $('#proj-nome').onclick = async () => { const n = await UI.prompt({ title: 'Nome da animação', value: App.P.nome }); if (n) { App.P.nome = n; $('#proj-nome').textContent = n; App.titulo(); App.commit('Nome'); } };
  $('#z-menos').onclick = () => { const v = App.vista, r = App.palco.cv.getBoundingClientRect(), z = v.z / 1.25; v.x = r.width / 2 - (r.width / 2 - v.x) * z / v.z; v.y = r.height / 2 - (r.height / 2 - v.y) * z / v.z; v.z = z; App.pinta(); App.zoomTxt(); };
  $('#z-mais').onclick = () => { const v = App.vista, r = App.palco.cv.getBoundingClientRect(), z = v.z * 1.25; v.x = r.width / 2 - (r.width / 2 - v.x) * z / v.z; v.y = r.height / 2 - (r.height / 2 - v.y) * z / v.z; v.z = z; App.pinta(); App.zoomTxt(); };
  $('#zoom-txt').onclick = () => App.enquadrar();
  $('#tl-fps').onchange = e => { App.P.fps = clamp(+e.target.value || 24, 1, 60); App.commit('fps'); };
  $('#tl-dur').onchange = e => { App.P.duracao = clamp(Math.round(+e.target.value || 1), 1, 20000); if (App.q > App.P.duracao - 1) App.q = App.P.duracao - 1; App.commit('Duração'); };
  addEventListener('beforeunload', () => { if (App.P) App.salvarJa(); });
  // botão direito: nunca o menu do navegador. Onde a tela não tem menu próprio, aparece um menu do ANIMADOR
  document.addEventListener('contextmenu', e => {
    if (e.defaultPrevented) return; e.preventDefault(); // já abriu um menu do Animador (camada, timeline, peça…)
    const campo = e.target.closest('input:not([type=range]):not([type=checkbox]):not([type=color]),textarea');
    if (campo) { // campos de texto: recortar/copiar/colar do próprio Animador
      const tem = campo.selectionStart !== campo.selectionEnd, txt = () => campo.value.slice(campo.selectionStart, campo.selectionEnd);
      const poe = async t => { campo.focus(); campo.setRangeText(t, campo.selectionStart, campo.selectionEnd, 'end'); campo.dispatchEvent(new Event('input', { bubbles: true })); };
      return UI.ctx(e.clientX, e.clientY, [
        { label: 'Recortar', icon: 'cut', key: 'Ctrl+X', disabled: !tem || campo.readOnly, action: async () => { await navigator.clipboard.writeText(txt()).catch(() => { }); poe(''); } },
        { label: 'Copiar', icon: 'copy', key: 'Ctrl+C', disabled: !tem, action: () => navigator.clipboard.writeText(txt()).catch(() => { }) },
        { label: 'Colar', icon: 'paste', key: 'Ctrl+V', disabled: campo.readOnly, action: async () => { const t = await navigator.clipboard.readText().catch(() => null); if (t != null) poe(t); else UI.toast('Use Ctrl+V para colar aqui'); } },
        '-', { label: 'Selecionar tudo', icon: 'check', key: 'Ctrl+A', action: () => { campo.focus(); campo.select(); } },
      ]);
    }
    const tela = ['home', 'editor', 'atelie'].find(id => !$('#' + id)?.classList.contains('hidden'));
    const itens = tela === 'editor' && App.P ? [
      { head: 'ANIMADOR' },
      { label: 'Desfazer', icon: 'undo', key: 'Ctrl+Z', action: () => App.undo() }, { label: 'Refazer', icon: 'redo', key: 'Ctrl+Y', action: () => App.redo() }, '-',
      { label: 'Pôr um personagem…', icon: 'plus', action: () => App.addPersonagem() }, { label: 'Pôr uma forma…', icon: 'shapes', action: () => App.menuForma(e.clientX, e.clientY) }, { label: 'Pôr um texto', icon: 'text', action: () => App.addTexto() }, '-',
      { label: 'Animar com a IA…', icon: 'sparkles', ai: true, action: () => IA.abrir(Lado.foco()) }, { label: 'Ateliê de personagens…', icon: 'palette', action: () => App.abrirAtelie() },
      { label: 'Exportar…', icon: 'download', action: () => Exportar.abrir() }, { label: 'Baixar .animador', icon: 'file', action: () => Toon.baixar(App.P) }, { label: 'Citar este quadro em mensagens…', icon: 'chat', action: () => Citacao.animacao(App.P, App.q, App.sel) }, '-',
      { label: 'Voltar ao início', icon: 'left', action: () => App.fechar() },
    ] : tela === 'atelie' ? [
      { head: 'ATELIÊ' },
      { label: 'Desfazer', icon: 'undo', key: 'Ctrl+Z', action: () => Atelie.desfazJa(false) }, { label: 'Refazer', icon: 'redo', key: 'Ctrl+Shift+Z', action: () => Atelie.desfazJa(true) }, '-',
      { label: 'Parte nova', icon: 'plus', action: () => Atelie.novaParte() }, { label: 'Pôr imagens…', icon: 'image', action: () => Atelie.addImagens() }, { label: 'Enquadrar', icon: 'crop', action: () => Atelie.enquadrar() }, '-',
      { label: 'Editar a imagem (estilo Photoshop)', icon: 'brush', action: () => Atelie.abrirEditor() }, { label: 'Converter o personagem para SVG (vetor)…', icon: 'nodes', action: () => VetorUI.tudo() }, { label: 'IA do Ateliê…', icon: 'sparkles', ai: true, action: () => Atelie.ia() }, '-',
      { label: 'Citar o personagem inteiro em mensagens…', icon: 'chat', action: () => Citacao.atelie({}) }, { label: 'Baixar backup (.atelieanimador)', icon: 'download', action: () => AtelieArq.baixar(Atelie.def) }, { label: 'Abrir backup (.atelieanimador)…', icon: 'folder', action: () => AtelieArq.escolher() }, { label: 'Citar em mensagens…', icon: 'chat', action: () => Citacao.atelie() }, '-',
      { label: 'Salvar na nuvem', icon: 'upload', key: 'Ctrl+S', action: () => Atelie.salvar() }, { label: 'Voltar', icon: 'left', action: () => Atelie.sair() },
    ] : [
      { head: 'ANIMADOR' },
      { label: 'Animação nova (YouTube)', icon: 'plus', action: () => Home.nova(FORMATOS[0]) }, { label: 'Animação nova (Shorts)', icon: 'plus', action: () => Home.nova(FORMATOS[1]) },
      { label: 'Abrir .animador…', icon: 'folder', action: async () => { const [f] = await pickFiles('.animador,.toon', false); if (f) Home.importar(f); } }, { label: 'Abrir .atelieanimador…', icon: 'layers', action: () => AtelieArq.escolher() }, '-',
      { label: 'Personagem novo', icon: 'layers', action: () => Atelie.abrirAba(null) },
    ];
    UI.ctx(e.clientX, e.clientY, itens);
  });
})();
