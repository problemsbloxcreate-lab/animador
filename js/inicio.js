/* ===================== inicio.js — liga os botões das barras (ícones e ações) ===================== */
'use strict';
(() => {
  const poe = (id, icone, txt, fn) => { const b = $('#' + id); if (!b) return; b.innerHTML = ic(icone, 15) + (txt ? `<span>${txt}</span>` : ''); if (fn) b.onclick = fn; };
  poe('b-undo', 'undo', '', () => App.undo()); poe('b-redo', 'redo', '', () => App.redo());
  poe('b-onion', 'onion', '', () => { App.onion = !App.onion; $('#b-onion').classList.toggle('on', App.onion); App.pinta(); });
  poe('b-ia', 'sparkles', 'IA', () => IA.abrir(Lado.foco())); poe('b-atelie', 'edit', 'Ateliê', () => Atelie.abrir(Lado.foco() ? App.P.personagens[Lado.foco().ref]?.id : null, { volta: true }));
  poe('b-exportar', 'download', 'Exportar', () => Exportar.abrir());
  poe('h-pers', 'plus', '', () => App.addPersonagem()); poe('h-cen', 'paisagem', '', () => Cenarios.abrir()); poe('h-img', 'image', '', () => App.addImagem()); poe('h-txt', 'text', '', () => App.addTexto()); poe('h-pasta', 'folder', '', () => App.addPasta());
  poe('t-ini', 'start', '', () => App.setQ(0)); poe('t-ant', 'prev', '', () => App.setQ(App.q - 1, { som: true })); poe('b-tocar', 'play', '', () => App.tocar());
  poe('t-prox', 'next', '', () => App.setQ(App.q + 1, { som: true })); poe('t-fim', 'end', '', () => App.setQ(Modelo.ultimoQuadro(App.P)));
  poe('t-loop', 'loop', '', () => { Folha.loop = !Folha.loop; $('#t-loop').classList.toggle('on', Folha.loop); });
  poe('t-chave', 'diamond', 'Chave', () => App.chaveAqui()); poe('t-tira', 'minus', 'Tirar', () => App.tiraChave());
  poe('at-voltar', 'left', 'Voltar'); poe('at-undo', 'undo', ''); poe('at-redo', 'redo', '');
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
})();
