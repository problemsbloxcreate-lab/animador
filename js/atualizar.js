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
  /* REFORMA RIVE DO ATELIÊ (10/11/2026, pedido da dona): os projetos que já existiam continuam COMO ESTAVAM. Personagem com versão salva
     no Ateliê depois da reforma, num projeto com a cópia de antes, NÃO entra no "Atualizar projeto": aparece o botão azul
     "Personagens LEGACY" (#b-legacy). Clicar avisa que vai substituir pela versão nova do Ateliê e, antes, cria sozinho uma CÓPIA LEGACY
     DA ANIMAÇÃO ("<nome> (LEGACY)", na nuvem da equipe quando a animação está nela), com tudo como estava. Cópia com mudanças só
     do projeto (`soProjeto`) continua no "Atualizar projeto", desmarcada. */
  REFORMA_RIVE: 1794339000000,
  lista: [], legacy: [], _em: 0,
  async itens(P) {
    const out = [];
    if ((P.efeitos?.tela || []).length || (P.efeitos?.visual && P.efeitos.visual !== 'normal'))
      out.push({ id: 'efeitos', titulo: 'Efeitos do jeito antigo', desc: 'Os efeitos do vídeo todo viram uma camada de efeito (dá para mexer no tempo, ver onde vale e arrastar na timeline).', aplica: () => this.efeitosAntigos(P) });
    // personagens com versão nova na nuvem
    let L = []; try { L = await Nuvem.lista(); } catch { }
    for (const def of Object.values(P.personagens || {})) {
      if (!def?.id || def._local) continue; const it = L.find(x => x.id === def.id); if (!it?.modificado || !def.modificado) continue;
      if (it.modificado > def.modificado + 1000) { const rive = it.modificado >= this.REFORMA_RIVE && def.modificado < this.REFORMA_RIVE;
        if (rive && !def.soProjeto) { (out.legacy ||= []).push({ id: def.id, nome: def.nome, em: it.modificado }); continue; } // vai para o botão "Personagens LEGACY"
        out.push({ id: 'pers:' + def.id, titulo: `Personagem ${def.nome}`, desmarcado: !!def.soProjeto, desc: def.soProjeto ? `Este projeto tem mudanças só dele nesse personagem: atualizar troca pela versão do Ateliê geral (salva ${fmtDate(it.modificado)}).` : `Tem uma versão mais nova na nuvem da equipe (salva ${fmtDate(it.modificado)}). As poses e chaves da animação continuam.`, aplica: () => this.personagem(P, def.id) }); }
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
    if (App.P?.id !== id) return; this.lista = L; this.legacy = L.legacy || []; this.pinta();
  },
  pinta() {
    const bl = this.botaoLegacy(); if (bl) { const nl = App.P ? this.legacy.length : 0; bl.hidden = !nl; bl.innerHTML = `${ic('layers', 14)}<span>Personagens LEGACY</span><i>${nl}</i>`; bl.title = `Esta animação usa personagens de antes da reforma do Ateliê: ${this.legacy.map(x => x.nome).join(', ')}. Ela continua igual. Clique para trocar pelos do Ateliê novo (antes, uma cópia LEGACY da animação é criada).`; }
    const b = this.botao(); if (!b) return; const n = App.P ? this.lista.length : 0; b.hidden = !n;
    b.innerHTML = `${ic('download', 14)}<span>Atualizar projeto</span><i>${n}</i>`; b.title = `Este projeto está atrás da versão atual: ${this.lista.map(x => x.titulo).join(', ')}. Clique para ver e atualizar.`;
  },
  botaoLegacy() { let b = $('#b-legacy'); if (!b) { const ref = $('.an-nuvem-bt'); if (!ref) return null; b = h('<button class="btn sm b-legacy" id="b-legacy" hidden></button>'); b.onclick = () => this.trocarLegacy(); ref.after(b); } return b; },
  // trocar os personagens LEGACY pelos do Ateliê novo: avisa, cria a cópia LEGACY da animação e só então substitui
  async trocarLegacy() {
    await this.confere(true); const L = this.legacy, P = App.P; if (!P || !L.length) return UI.toast('Esta animação já usa os personagens do Ateliê novo.', { kind: 'ok' });
    const body = h(`<div class="atz"><div class="pr-info">Esta animação usa personagens de <b>antes da reforma do Ateliê</b> (LEGACY). Ela continua igual enquanto você não trocar.<br><br>Ao trocar, os marcados viram a <b>versão nova do Ateliê</b>, e as poses podem mudar de jeito. Antes, uma <b>cópia LEGACY desta animação</b> ("${esc(P.nome)} (LEGACY)") é criada sozinha, com tudo como está agora.</div>
      ${L.map(x => `<label class="atz-it"><input type="checkbox" data-id="${esc(x.id)}" checked><span><b>${esc(x.nome)}</b><small>Versão nova do Ateliê salva ${esc(fmtDate(x.em))}</small></span></label>`).join('')}</div>`);
    const ids = await UI.modal({ title: 'Trocar pelos personagens do Ateliê novo?', icon: 'layers', width: 500, body, buttons: [{ label: 'Agora não', value: null }, { label: 'Criar a cópia e substituir', kind: 'primary', collect: x => $$('[data-id]', x.body).filter(c => c.checked).map(c => c.dataset.id) }] });
    if (!ids?.length) return;
    await App.salvarJa?.(); const copia = clone(P); copia.id = uid('p'); copia.nome = await Arquivos.nomeAnimacao(P.nome + ' (LEGACY)', copia.id); delete copia.nuvemEm; delete copia.nuvemMod; delete copia.soLocal;
    if (NuvemAnim.vai(P)) copia.nuvemAuto = true; copia.legacyDe = { id: P.id, em: Date.now() }; copia.modificado = Date.now();
    const feitos = [], erros = [];
    const roda = async () => {
      await DB.put('projetos', copia); if (NuvemAnim.vai(copia) && !(await NuvemAnim.salvar(copia, t => Ocupado.anda?.(t)))) throw new Error('a cópia LEGACY não foi para a nuvem');
      for (const id of ids) { try { await this.personagem(P, id); feitos.push(P.personagens[id]?.nome || id); } catch { erros.push(L.find(x => x.id === id)?.nome || id); } } };
    try { if (typeof Ocupado !== 'undefined' && Ocupado.nuvem) await Ocupado.nuvem('Cópia LEGACY e troca dos personagens', roda); else await roda(); }
    catch (e) { return UI.toast('Não troquei nada: ' + esc(e.message), { kind: 'err', time: 7000 }); }
    App.commit('Trocar pelos personagens do Ateliê novo'); await App.salvarJa?.(); this.confere(true);
    UI.toast(`Cópia <b>${esc(copia.nome)}</b> criada. ${feitos.length ? 'Agora com o Ateliê novo: ' + feitos.map(esc).join(', ') + '.' : ''}${erros.length ? ` Não deu: ${erros.map(esc).join(', ')}.` : ''}`, { kind: erros.length ? 'warn' : 'ok', time: 8000 });
  },
  botao() { let b = $('#b-atualizar'); if (!b) { const ref = $('.an-nuvem-bt'); if (!ref) return null; b = h('<button class="btn sm b-atualizar" id="b-atualizar" hidden></button>'); b.onclick = () => this.abrir(); ref.after(b); /* junto do Salvo: é coisa do projeto */ } return b; },
  async abrir() {
    await this.confere(true); const L = this.lista; if (!L.length) return UI.toast('O projeto já está na versão atual.', { kind: 'ok' });
    const body = h(`<div class="atz"><div class="pr-info">O Animador mudou desde que este projeto foi feito. Marque o que atualizar. Antes, uma cópia <b>(antes da atualização)</b> fica guardada neste computador, e o Ctrl+Z também volta.</div>
      ${L.map(x => `<label class="atz-it"><input type="checkbox" data-id="${esc(x.id)}" ${x.desmarcado ? '' : 'checked'}><span><b>${esc(x.titulo)}</b><small>${esc(x.desc)}</small></span></label>`).join('')}</div>`);
    const ids = await UI.modal({ title: 'Atualizar o projeto', icon: 'download', width: 480, body, buttons: [{ label: 'Agora não', value: null }, { label: 'Atualizar', kind: 'primary', collect: x => $$('[data-id]', x.body).filter(c => c.checked).map(c => c.dataset.id) }] });
    if (!ids?.length) return;
    const P = App.P, copia = clone(P); copia.id = uid('p'); copia.nome = P.nome + ' (antes da atualização)'; copia.soLocal = true; delete copia.nuvemEm; delete copia.nuvemMod; copia.modificado = Date.now(); try { await DB.put('projetos', copia); } catch { }
    const feitos = [], erros = [];
    const roda = async () => { for (const it of L.filter(x => ids.includes(x.id))) { try { await it.aplica(); feitos.push(it.titulo); } catch { erros.push(it.titulo); } } };
    if (typeof Ocupado !== 'undefined' && Ocupado.nuvem) await Ocupado.nuvem('Atualizando o projeto', roda); else await roda();
    P.versao = this.VERSAO; App.commit('Atualizar o projeto'); await App.salvarJa?.();
    UI.toast(`${feitos.length ? 'Atualizado: ' + feitos.map(esc).join(', ') + '.' : ''}${erros.length ? ` Não deu: ${erros.map(esc).join(', ')} (tente de novo).` : ''}`, { kind: erros.length ? 'warn' : 'ok' });
    this.confere(true);
  },
};
addEventListener('focus', () => { if (App.P) AtualizaProj.confere(); });
