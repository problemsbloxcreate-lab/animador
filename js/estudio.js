/* ===================== estudio.js — PONTO DE ENCAIXE com o Estúdio Problems =====================
   Este programa é o módulo "Animação" do ESTÚDIO PROBLEMS. Hoje roda sozinho; quando o Estúdio Problems
   (Shorts / Edição — editor de Minecraft animado) estiver pronto, os módulos se juntam por aqui.
   Tudo que um módulo precisa expor/receber está neste arquivo (veja ESTUDIO-PROBLEMS.md). */
'use strict';
const EstudioModulos = {
  atual: 'animacao',
  // url: null = ainda não conectado (aparece "em breve"). Na unificação, coloque o endereço/rota do módulo.
  lista: {
    animacao: { nome: 'Animação', icone: 'layers', url: 'index.html', pronto: true },
    shorts: { nome: 'Shorts', icone: 'camera', url: null, pronto: false },
    edicao: { nome: 'Edição', icone: 'film', url: null, pronto: false },
  },
  abrir(id) { const m = this.lista[id]; if (!m) return; if (!m.pronto || !m.url) return UI.toast(`${esc(m.nome)}: em breve, quando o Estúdio Problems for unificado.`, { time: 2600 }); if (id !== this.atual) location.href = m.url; },
  // barra de módulos (tela inicial). Fica discreta enquanto só existe um módulo pronto.
  html() { return `<div class="est-mods">${Object.entries(this.lista).map(([id, m]) => `<button data-mod="${id}" class="${id === this.atual ? 'on' : ''} ${m.pronto ? '' : 'soon'}" title="${m.pronto ? m.nome : m.nome + ' — em breve'}">${ic(m.icone, 13)}${m.nome}</button>`).join('')}</div>`; },
  bind(el) { $$('[data-mod]', el).forEach(b => b.onclick = () => this.abrir(b.dataset.mod)); },
  /* ---------- ponte de dados (placeholders para a unificação) ----------
     exportar/importar um clipe "personagem" entre módulos: o formato é o objeto anim { settings, frames, rigs, camera }.
     Ex.: o Shorts poderá mandar uma fala (áudio + duração) e receber o boneco animado de volta. */
  ponte: {
    versao: 1,
    exportarPersonagem(clip) { const A = typeof RigEdit !== 'undefined' ? RigEdit.A(clip) : null; return A ? { tipo: 'estudio-problems/personagem', versao: 1, nome: clip.name, anim: JSON.parse(JSON.stringify(A)) } : null; },
    importarPersonagem(pacote) { if (pacote?.tipo !== 'estudio-problems/personagem' || !pacote.anim || typeof RigEdit === 'undefined') return null; RigEdit.insert(pacote.anim, pacote.nome); return true; },
    // recebe pedidos de outro módulo (postMessage), quando estiverem na mesma janela/iframe — desligado até a unificação
    ligado: false,
    origensPermitidas: [], // ex.: ['https://estudio-problems.problemsbloxcreate.workers.dev']
  },
};
addEventListener('message', e => { const P = EstudioModulos.ponte; if (!P.ligado || !P.origensPermitidas.includes(e.origin)) return; const d = e.data || {}; if (d.acao === 'importarPersonagem') P.importarPersonagem(d.pacote); });
