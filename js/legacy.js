/* ===================== legacy.js — BOTÃO "LEGACY" nas animações antigas (2.0.x, 12/11/2026, pedido da dona) =====================
   Animação antiga (sem P.rive) mostra "LEGACY" no topo, ao lado do nome. Clicar abre uma pergunta curta: atualizar para a versão nova?
   Antes de mudar qualquer coisa, a versão de agora vira a cópia "<nome> (LEGACY)" NA NUVEM da equipe (decisão da dona: só na nuvem); se a
   cópia não subir, nada muda. O original nunca se perde. A atualização (decisão da dona: "tudo menos personagens"):
   - liga a versão nova (P.rive): modo Vídeo com blocos, movimento suave do jeito novo e trava das juntas em todas as vistas;
   - enxuga as chaves repetidas (numa sequência de chaves iguais ficam só a primeira e a última: a pose segurada continua igual);
   - compacta as trilhas sem mudar quem fica na frente (TLP.compactar).
   Trocar personagem continua só no "Atualizar personagens" (js/atualizar.js). Cópia LEGACY (P.legacyDe) não mostra o botão. Ctrl+Z desfaz. */
'use strict';
const Legacy = {
  liga() {
    if (this._ok || typeof App === 'undefined') return; this._ok = true;
    const ab = App.abrir; App.abrir = async function (...x) { const r = await ab.apply(this, x); try { Legacy.pinta(); } catch (e) { console.warn(e); } return r; };
    const tr = App.troca; if (tr) App.troca = function (...x) { const r = tr.apply(this, x); try { Legacy.pinta(); } catch { } return r; };
  },
  antiga(P = App.P) { return !!P && !P.rive && !P.legacyDe && !P.anterior && !P.soLocal; },
  botao() {
    let b = $('#b-legacy'); if (b) return b; const ref = $('#editor .proj-nome'); if (!ref) return null;
    b = h(`<button class="btn sm b-legacy" id="b-legacy" hidden title="Esta animação foi feita na versão antiga do Animador. Clique para atualizar (a de agora fica guardada como cópia LEGACY na nuvem)">LEGACY</button>`);
    b.onclick = () => this.abrir(); ref.after(b); return b;
  },
  pinta() { const b = this.botao(); if (b) b.hidden = !this.antiga(); },
  async abrir() {
    const P = App.P; if (!this.antiga(P)) return;
    const ok = await UI.modal({ title: 'Atualizar para a versão nova?', width: 440, semMetro: true,
      body: `<div class="lg-txt"><p>A animação passa para o modo Vídeo, com movimento suave, juntas travadas e trilhas compactadas. Os personagens continuam os mesmos.</p>
        <p>Antes, a versão de agora fica guardada na nuvem como <b>${esc(P.nome)} (LEGACY)</b>. O original nunca se perde.</p></div>`,
      buttons: [{ label: 'Agora não', value: false }, { label: 'Atualizar', kind: 'primary', value: true }] });
    if (ok) await this.atualizar();
  },
  // numa sequência de chaves IGUAIS, as do meio não mudam nada: ficam a primeira e a última (a espera continua do mesmo tamanho)
  enxuga(P) { let tirou = 0;
    Modelo.cada(P.raiz, n => { const ch = n.chaves; if (!ch) return; const ks = Object.keys(ch).map(Number).sort((a, b) => a - b); if (ks.length < 3) return;
      const s = ks.map(k => JSON.stringify(ch[k]));
      for (let i = 1; i < ks.length - 1; i++) if (s[i] === s[i - 1] && s[i] === s[i + 1]) { delete ch[ks[i]]; tirou++; } });
    return tirou; },
  async atualizar() {
    const P = App.P; if (!this.antiga(P)) return; await App.salvarJa?.();
    const copia = clone(P); copia.id = uid('p'); delete copia.nuvemEm; delete copia.nuvemMod; delete copia.publicacoes; delete copia.semNuvem; delete copia.soLocal;
    copia.nome = await Arquivos.nomeAnimacao(P.nome + ' (LEGACY)', copia.id); copia.nuvemAuto = true; copia.legacyDe = { id: P.id, em: Date.now() }; copia.modificado = Date.now();
    const roda = async () => { await DB.put('projetos', copia); if (!(await NuvemAnim.salvar(copia, t => Ocupado.anda?.(t)))) throw new Error('a cópia LEGACY não foi para a nuvem'); };
    try { if (typeof Ocupado !== 'undefined' && Ocupado.nuvem) await Ocupado.nuvem('Guardando a cópia LEGACY', roda); else await roda(); }
    catch (e) { await DB.del('projetos', copia.id).catch(() => { }); return UI.toast('Não atualizei nada: ' + esc(e.message || String(e)), { kind: 'err', time: 7000 }); } // sem a cópia na nuvem, nada muda (nem fica cópia pela metade aqui)
    P.rive = 1; const tirou = this.enxuga(P);
    let trilhas = ''; try { const a = TLP.layout(); for (const n of P.raiz) delete n.trilha; for (const x of P.audios || []) delete x.trilha; TLP.congela(); TLP.ordena(); const d = TLP.layout(); trilhas = `trilhas ${a.nV} → ${d.nV}`; } catch (e) { console.warn(e); }
    App.commit('Atualizar para a versão nova'); try { SoVideo.aplica(); } catch { } this.pinta(); await App.salvarJa?.();
    UI.toast(`Atualizada. Cópia <b>${esc(copia.nome)}</b> guardada na nuvem. ${tirou} chaves repetidas a menos${trilhas ? ', ' + trilhas : ''}. Ctrl+Z desfaz.`, { kind: 'ok', time: 8000 });
  },
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Legacy.liga()); else Legacy.liga();
