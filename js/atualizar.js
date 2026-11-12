/* ===================== atualizar.js — ATUALIZAR O PROJETO para a versão atual =====================
   Ao abrir uma animação (e ao voltar para a aba, no máximo de 2 em 2 min) confere se ela está atrás da versão atual. O botão
   "Atualizar projeto" no topo (#b-atualizar) SÓ APARECE quando há algo para atualizar; clicar mostra a lista (marcável) do que muda.
   Antes de aplicar guarda uma cópia "(antes da atualização)" só neste computador; tudo vira UM passo do Ctrl+Z.
   O que confere (cada item: { id, titulo, desc, aplica }):
   - efeitos do jeito antigo (P.efeitos.visual/tela, de antes das camadas de efeito) → viram uma camada de efeito;
   - personagens com versão MAIS NOVA na nuvem da equipe (salva no Ateliê depois da cópia que está no projeto) → trazidos de novo
     (`AtelieAnim.junta`: as imagens feitas só para um quadro continuam; as chaves continuam porque os ids são os mesmos);
   - projeto sem a marca da versão (`P.versao`) — só marca, não muda nada. Novos itens: acrescente em `itens()`. */
'use strict';
const AtualizaProj = {
  VERSAO: 3,
  /* REFORMA RIVE DO ATELIÊ (10/11/2026, pedido da dona): os projetos que já existiam continuam COMO ESTAVAM até alguém atualizar.
     UM BOTÃO SÓ no topo, "Atualizar personagens" (#b-atualizar), com o ícone do Ateliê e o número, abre o PAINEL METRO pela direita
     (igual às janelas da nuvem) com as atualizações separadas por tipo (`grupo` de cada item):
       • 'legacy'  = personagem de ANTES da reforma com versão nova do Ateliê (estilo Rive): explica o estilo novo; marcado = troca, e antes
                     cria sozinha uma CÓPIA LEGACY DA ANIMAÇÃO ("<nome> (LEGACY)", na nuvem quando a animação está nela; se a cópia
                     não subir, nada é trocado);
       • 'nova'    = versão mais nova do Ateliê, do jeito de sempre (marcada);
       • 'proprio' = a cópia tem mudanças SÓ DESTE PROJETO (`soProjeto`): desmarcada, avisa que perde essas mudanças;
       • 'projeto' = coisas do formato do projeto (efeitos do jeito antigo).
     Sem item 'legacy' marcado, a cópia de antes continua sendo a "(antes da atualização)" só neste computador. Tudo vira UM passo do Ctrl+Z. */
  REFORMA_RIVE: 1794339000000,
  GRUPOS: [
    ['legacy', 'Estilo novo do Ateliê (Rive)', 'Estes personagens foram refeitos na reforma do Ateliê: rig preso ao corpo, juntas com tampa e movimento suave entre as poses. As poses desta animação podem mudar de jeito. Antes de trocar, uma <b>cópia LEGACY desta animação</b> é criada sozinha, com tudo como está agora.'],
    ['nova', 'Versão nova no Ateliê', 'Alguém salvou estes personagens no Ateliê depois da cópia que está aqui. As poses e chaves da animação continuam.'],
    ['proprio', 'Mudados só nesta animação', 'Esta animação tem mudanças só dela nestes personagens. Atualizar troca pela versão do Ateliê geral e essas mudanças saem.'],
    ['projeto', 'Projeto', 'O Animador mudou desde que este projeto foi feito.'],
  ],
  lista: [], _em: 0,
  async itens(P) {
    const out = [];
    if ((P.efeitos?.tela || []).length || (P.efeitos?.visual && P.efeitos.visual !== 'normal'))
      out.push({ id: 'efeitos', grupo: 'projeto', titulo: 'Efeitos do jeito antigo', desc: 'Os efeitos do vídeo todo viram uma camada de efeito (dá para mexer no tempo, ver onde vale e arrastar na timeline).', aplica: () => this.efeitosAntigos(P) });
    // personagens com versão nova na nuvem
    let L = []; try { L = await Nuvem.lista(); } catch { }
    for (const def of Object.values(P.personagens || {})) {
      if (!def?.id || def._local) continue; const it = L.find(x => x.id === def.id); if (!it?.modificado || !def.modificado) continue;
      if (it.modificado <= def.modificado + 1000) continue;
      const grupo = def.soProjeto ? 'proprio' : it.modificado >= this.REFORMA_RIVE && def.modificado < this.REFORMA_RIVE ? 'legacy' : 'nova';
      out.push({ id: 'pers:' + def.id, grupo, def, titulo: def.nome, desmarcado: grupo === 'proprio', desc: `Salvo no Ateliê ${fmtDate(it.modificado)}`, aplica: () => this.personagem(P, def.id) });
    }
    return out;
  },
  efeitosAntigos(P) {
    const n = Modelo.novoNo('efeito', { efeitos: [] });
    if (P.efeitos.visual && P.efeitos.visual !== 'normal') n.efeitos.push({ id: uid('ef'), tipo: 'cor', visual: P.efeitos.visual });
    for (const e of P.efeitos.tela || []) n.efeitos.push({ id: uid('ef'), tipo: e.tipo, forca: e.forca, de: e.de, ate: e.ate });
    P.efeitos = { visual: 'normal', tela: [] }; App.nomeEfeito(n); P.raiz.unshift(n);
  },
  async personagem(P, id) {
    const novo = await Nuvem.abrir(id, false, undefined, true); if (!novo) throw new Error('não abriu da nuvem');
    await Arq.garantir(Modelo.chavesImgs(novo)); P.personagens[id] = AtelieAnim.junta(P.personagens[id], novo); Icone.garanteNoEditor?.(P);
  },
  // ---------- conferir e mostrar o botão ----------
  async confere(forca) {
    const P = App.P; if (!P || (!forca && Date.now() - this._em < 120000)) return this.pinta(); this._em = Date.now();
    const id = P.id; let L = []; try { L = await this.itens(P); } catch { }
    if (App.P?.id !== id) return; this.lista = L; this.pinta();
  },
  pinta() {
    const b = this.botao(); if (!b) return; const L = App.P ? this.lista : [], n = L.length, leg = L.some(x => x.grupo === 'legacy'); b.hidden = !n; b.classList.toggle('tem-legacy', leg);
    const so = L.every(x => x.grupo === 'projeto'), rot = so ? 'Atualizar projeto' : 'Atualizar personagens';
    if (b._rot !== rot + n) { b._rot = rot + n; b.innerHTML = `<span class="b-at-logo" data-estudio-icone="at"></span><span>${rot}</span><i>${n}</i>`; }
    b.title = `${leg ? 'Há personagens no estilo novo do Ateliê (Rive). ' : ''}Esta animação continua como está até você atualizar: ${L.map(x => x.titulo).join(', ')}. Clique para ver.`;
  },
  botao() { let b = $('#b-atualizar'); if (!b) { const ref = $('.an-nuvem-bt'); if (!ref) return null; b = h('<button class="btn sm b-atualizar" id="b-atualizar" hidden></button>'); b.onclick = () => this.abrir(); ref.after(b); /* junto do Salvo: é coisa do projeto */ } return b; },
  async abrir() {
    await this.confere(true); const L = this.lista, P = App.P; if (!P || !L.length) return UI.toast('A animação já está com tudo atualizado.', { kind: 'ok' });
    const item = x => { const th = x.def?.icone || x.def?.thumb || ''; return `<label class="atz-it atz-${x.grupo}"><input type="checkbox" data-id="${esc(x.id)}" ${x.desmarcado ? '' : 'checked'}>${x.def ? `<span class="atz-th" style="${th ? `background-image:url('${esc(th)}')` : ''}"></span>` : ''}<span><b>${esc(x.titulo)}</b><small>${esc(x.desc)}</small></span></label>`; };
    const body = h(`<div class="atz atz-metro"><div class="pr-info">Esta animação continua como está até você atualizar. Marque o que trazer.</div>
      ${this.GRUPOS.map(([g, t, txt]) => { const it = L.filter(x => x.grupo === g); return it.length ? `<section class="atz-g atz-g-${g}"><h4>${esc(t)}</h4><p>${txt}</p>${it.map(item).join('')}</section>` : ''; }).join('')}
      <div class="atz-fim" data-fim></div></div>`);
    const fim = () => { const leg = $$('.atz-legacy input', body).some(c => c.checked); $('[data-fim]', body).innerHTML = leg ? `Antes de trocar: cópia <b>"${esc(P.nome)} (LEGACY)"</b>${NuvemAnim.vai(P) ? ' na nuvem da equipe' : ' neste computador'}.` : 'Antes de atualizar: cópia <b>(antes da atualização)</b> só neste computador. O Ctrl+Z também volta.'; };
    body.addEventListener('change', fim); fim();
    const ids = await UI.modal({ title: 'Atualizar personagens', icon: 'download', width: 560, semMetro: true, body, buttons: [{ label: 'Agora não', value: null }, { label: 'Atualizar', kind: 'primary', collect: x => $$('[data-id]', x.body).filter(c => c.checked).map(c => c.dataset.id) }] });
    if (!ids?.length) return;
    const escolhidos = L.filter(x => ids.includes(x.id)), comLegacy = escolhidos.some(x => x.grupo === 'legacy');
    await App.salvarJa?.(); const copia = clone(P); copia.id = uid('p'); delete copia.nuvemEm; delete copia.nuvemMod; copia.modificado = Date.now();
    if (comLegacy) { copia.nome = await Arquivos.nomeAnimacao(P.nome + ' (LEGACY)', copia.id); delete copia.soLocal; if (NuvemAnim.vai(P)) copia.nuvemAuto = true; copia.legacyDe = { id: P.id, em: Date.now() }; }
    else { copia.nome = P.nome + ' (antes da atualização)'; copia.soLocal = true; }
    const feitos = [], erros = [];
    const roda = async () => {
      await DB.put('projetos', copia);
      if (comLegacy && NuvemAnim.vai(copia) && !(await NuvemAnim.salvar(copia, t => Ocupado.anda?.(t)))) throw new Error('a cópia LEGACY não foi para a nuvem');
      for (const it of escolhidos) { try { await it.aplica(); feitos.push(it.titulo); } catch { erros.push(it.titulo); } } };
    try { if (typeof Ocupado !== 'undefined' && Ocupado.nuvem) await Ocupado.nuvem(comLegacy ? 'Cópia LEGACY e atualização' : 'Atualizando a animação', roda); else await roda(); }
    catch (e) { return UI.toast('Não atualizei nada: ' + esc(e.message), { kind: 'err', time: 7000 }); }
    P.versao = this.VERSAO; if (comLegacy) P.rive = 1; App.commit('Atualizar personagens'); await App.salvarJa?.();
    UI.toast(`${comLegacy ? `Cópia <b>${esc(copia.nome)}</b> criada. ` : ''}${feitos.length ? 'Atualizado: ' + feitos.map(esc).join(', ') + '.' : ''}${erros.length ? ` Não deu: ${erros.map(esc).join(', ')} (tente de novo).` : ''}`, { kind: erros.length ? 'warn' : 'ok', time: 7000 });
    this.confere(true);
  },
};
addEventListener('focus', () => { if (App.P) AtualizaProj.confere(); });
