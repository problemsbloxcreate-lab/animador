/* ===================== ligado.js — PERSONAGEM LIGADO AO ATELIÊ nas animações novas (2.2, 12/11/2026, regra da dona) =====================
   "a ideia para os novos projetos são de manter o atelie sempre atualizado pra n ter mudanças só num projeto e vai no proximo e tem que
   refazer do zero". Na animação nova (P.rive) o personagem vale SEMPRE pela versão do Ateliê: ao abrir, se o Ateliê tem versão mais nova,
   troca sozinho (AtualizaProj.personagem → AtelieAnim.junta, que mantém as imagens feitas só para um quadro). A cópia em P.personagens
   continua guardada só para abrir sem internet e exportar; quem manda é o Ateliê.
   - Fica de fora: def.soProjeto (mudado só neste projeto, js/atelieanim.js) e def.fixo = { mod, em } (versão fixada só neste projeto).
   - Antes de trocar, confere se cada vista, sessão e pose que as chaves usam existe na versão nova. Se faltar algo, NÃO troca sozinho:
     avisa e oferece fixar a versão de agora neste projeto (ou usar a nova mesmo assim).
   - A tela da nuvem só aparece quando baixa de verdade. Animação antiga (sem P.rive, LEGACY) não muda: segue com o "Atualizar personagens".
   - Tudo vira um passo do Ctrl+Z. */
'use strict';
const Ligado = {
  liga() {
    if (this._ok || typeof App === 'undefined') return; this._ok = true;
    const ab = App.abrir; App.abrir = async function (...x) { const r = await ab.apply(this, x); Ligado.confere(App.P).catch(e => console.warn('[Ligado]', e)); return r; };
  },
  ligado(def) { return !!def?.id && !def._local && !def.soProjeto && !def.fixo; },
  // o que as chaves desta animação usam deste personagem: vistas e { sessão: pose } por vista
  usados(P, id) { const U = []; Modelo.cada(P.raiz, n => { if (n.tipo !== 'personagem' || n.ref !== id || !n.chaves) return; let vista = null;
      for (const k of Modelo.quadrosChave(n)) { const c = n.chaves[k]; if (c.vista !== undefined) vista = c.vista; if (c.vista) U.push({ vista: c.vista }); for (const [s, p] of Object.entries(c.sessoes || {})) if (p) U.push({ vista, s, p }); } });
    return U; },
  // o que falta na versão nova (nomes para o aviso)
  faltam(P, id, novo) { const out = new Set(), temVista = v => !v || v === novo.vistaAtual || (novo.vistas || []).some(x => x.id === v) || !(novo.vistas || []).length;
    for (const u of this.usados(P, id)) {
      if (!temVista(u.vista)) { out.add('vista ' + ((P.personagens[id]?.vistas || []).find(x => x.id === u.vista)?.nome || u.vista)); continue; }
      if (!u.s) continue; const dv = Modelo.naVista(novo, u.vista), s = (dv.sessoes || []).find(x => x.id === u.s);
      if (!s || !(s.presets || []).some(x => x.id === u.p)) { const dv0 = Modelo.naVista(P.personagens[id], u.vista), s0 = (dv0.sessoes || []).find(x => x.id === u.s), p0 = s0?.presets?.find(x => x.id === u.p); out.add(`${s0?.nome || 'sessão'} › ${p0?.nome || 'pose'}`); } }
    return [...out]; },
  async confere(P) {
    if (!P?.rive || this._rodando) return; const defs = Object.values(P.personagens || {}).filter(d => this.ligado(d)); if (!defs.length) return;
    let L = []; try { L = await Nuvem.lista(); } catch { return; } // sem nuvem agora: abre com a cópia guardada, sem avisar
    const velhos = defs.filter(d => { const it = L.find(x => x.id === d.id); return it?.modificado && d.modificado && it.modificado > d.modificado + 1000; }); if (!velhos.length || App.P !== P) return;
    this._rodando = true; const trocados = [], fixados = []; let tela = false;
    try {
      for (const d of velhos) {
        if (App.P !== P) return;
        if (!tela && typeof NuvemTela !== 'undefined' && !NuvemTela.el) { NuvemTela.inicio(d.nome, 'at', { titulo: 'Atualizando os personagens do Ateliê', vidro: true, indef: true }); tela = true; }
        let novo; try { novo = await Nuvem.abrir(d.id, false, undefined, true); } catch { continue; } if (!novo) continue;
        const falta = this.faltam(P, d.id, novo);
        if (falta.length) { if (tela) { NuvemTela.fim(true); tela = false; }
          const r = await UI.modal({ title: `${d.nome} mudou no Ateliê`, width: 460, semMetro: true,
            body: `<div class="lg-txt"><p>A versão nova do Ateliê não tem o que esta animação usa: <b>${falta.slice(0, 6).map(esc).join(', ')}${falta.length > 6 ? '…' : ''}</b>.</p><p>Você pode fixar a versão de agora só nesta animação (as outras continuam recebendo as correções) ou usar a nova mesmo assim.</p></div>`,
            buttons: [{ label: 'Usar a nova', value: 'nova' }, { label: 'Fixar neste projeto', kind: 'primary', value: 'fixar' }] });
          if (r !== 'nova') { P.personagens[d.id].fixo = { mod: d.modificado, em: Date.now() }; fixados.push(d.nome); continue; } }
        await Arq.garantir(Modelo.chavesImgs(novo)); if (App.P !== P) return; P.personagens[d.id] = AtelieAnim.junta(P.personagens[d.id], novo); Icone.garanteNoEditor?.(P); trocados.push(d.nome); // o mesmo que o Atualizar personagens, sem baixar duas vezes
      }
    } finally { if (tela) NuvemTela.fim(true); this._rodando = false; }
    if (App.P !== P || (!trocados.length && !fixados.length)) return;
    App.commit(trocados.length ? 'Personagens do Ateliê atualizados' : 'Versão do personagem fixada'); await App.salvarJa?.(); try { AtualizaProj.confere(true); } catch { }
    UI.toast(`${trocados.length ? `Atualizado do Ateliê: <b>${trocados.map(esc).join(', ')}</b>. ` : ''}${fixados.length ? `Fixado neste projeto: <b>${fixados.map(esc).join(', ')}</b>. ` : ''}Ctrl+Z desfaz.`, { kind: 'ok', time: 6000 });
  },
  // desfixar (menu do Atualizar personagens / código): volta a seguir o Ateliê
  desfixa(id) { const d = App.P?.personagens?.[id]; if (!d?.fixo) return; delete d.fixo; App.commit('Personagem volta a seguir o Ateliê'); this.confere(App.P); },
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Ligado.liga()); else Ligado.liga();
