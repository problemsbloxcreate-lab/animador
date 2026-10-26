/* ===================== arvore.js — hierarquia: camadas e pastas (arrastar para ordenar ou pôr dentro), mostrar/travar, renomear ===================== */
'use strict';
const TIPO_IC = { pasta: 'folder', personagem: 'layers', imagem: 'image', texto: 'text', efeito: 'sparkles', forma: 'shapes' };
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
        <span class="ti">${defP ? Icone.html(defP, 18) : ic(TIPO_IC[n.tipo] || 'file', 14)}</span><span class="nm">${esc(n.nome)}${defP ? Vetor.selo(Vetor.tiposDef(defP), { soSvg: true, curto: true }) : n.tipo === 'imagem' && (n.vetor || Arq.img.get(n.arq) instanceof HTMLImageElement) ? Vetor.selo(['SVG']) : ''}</span>
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
      n.filhos && menuCor(n.corPasta, c => { if (c) n.corPasta = c; else delete n.corPasta; App.commit('Cor da pasta'); }),
      n.tipo !== 'efeito' && App.menuTremulo(n),
      n.tipo === 'efeito' && { label: 'Na timeline toda', icon: 'film', action: () => { n.de = 0; n.ate = null; App.commit('Na timeline toda'); } },
      (n.cenario || n.cena || n.cenaEd || n.pecaCen || Modelo.achar(App.P, n.id)?.pai?.cenario) && { label: 'Editar cenário…', icon: 'paisagem', ai: true, action: () => Cenarios.editarNo(n) },
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
