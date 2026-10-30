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
  lista: [], _em: 0,
  async itens(P) {
    const out = [];
    if ((P.efeitos?.tela || []).length || (P.efeitos?.visual && P.efeitos.visual !== 'normal'))
      out.push({ id: 'efeitos', titulo: 'Efeitos do jeito antigo', desc: 'Os efeitos do vídeo todo viram uma camada de efeito (dá para mexer no tempo, ver onde vale e arrastar na timeline).', aplica: () => this.efeitosAntigos(P) });
    // personagens com versão nova na nuvem
    let L = []; try { L = await Nuvem.lista(); } catch { }
    for (const def of Object.values(P.personagens || {})) {
      if (!def?.id || def._local) continue; const it = L.find(x => x.id === def.id); if (!it?.modificado || !def.modificado) continue;
      if (it.modificado > def.modificado + 1000) out.push({ id: 'pers:' + def.id, titulo: `Personagem ${def.nome}`, desc: `Tem uma versão mais nova na nuvem da equipe (salva ${fmtDate(it.modificado)}). As poses e chaves da animação continuam.`, aplica: () => this.personagem(P, def.id) });
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
    const b = this.botao(); if (!b) return; const n = App.P ? this.lista.length : 0; b.hidden = !n;
    b.innerHTML = `${ic('download', 14)}<span>Atualizar projeto</span><i>${n}</i>`; b.title = `Este projeto está atrás da versão atual: ${this.lista.map(x => x.titulo).join(', ')}. Clique para ver e atualizar.`;
  },
  botao() { let b = $('#b-atualizar'); if (!b) { const ref = $('#b-junto'); if (!ref) return null; b = h('<button class="btn sm b-atualizar" id="b-atualizar" hidden></button>'); b.onclick = () => this.abrir(); ref.before(b); } return b; },
  async abrir() {
    await this.confere(true); const L = this.lista; if (!L.length) return UI.toast('O projeto já está na versão atual.', { kind: 'ok' });
    const body = h(`<div class="atz"><div class="pr-info">O Animador mudou desde que este projeto foi feito. Marque o que atualizar. Antes, uma cópia <b>(antes da atualização)</b> fica guardada neste computador, e o Ctrl+Z também volta.</div>
      ${L.map(x => `<label class="atz-it"><input type="checkbox" data-id="${esc(x.id)}" checked><span><b>${esc(x.titulo)}</b><small>${esc(x.desc)}</small></span></label>`).join('')}</div>`);
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
