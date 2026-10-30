/* ===================== plano.js — ANIMAR PELO CLAUDE (o Claude de fora, pelo navegador) =====================
   Quando a equipe pede para o Claude (fora do site) fazer um rig e animar, ele abre o Animador no navegador da pessoa
   e usa este objeto pelo console (javascript_tool). É o MESMO caminho da IA do Animador (IA.aplicar), então tudo cai
   como chaves normais (Ctrl+Z volta) e qualquer melhoria aqui vale para os dois:
     Plano.contexto()                 → o que a IA recebe (camadas, personagens, membros/ossos, pontas no quadro…)
     Plano.aplicar([...acoes])        → aplica ações no formato do SIS_CENA (pose, parte, alcancar, mover, camera, animacao…)
     await Plano.folha('Lumi')        → mostra a FOLHA DO PERSONAGEM (cada preset desenhado) por cima da tela para tirar print
     await Plano.quadros(1, 48, 12)   → mostra os quadros desenhados (folha de contato) por cima da tela; Plano.fecha() tira
     Plano.membros('Lumi', [{ nome, raiz, meio, fim }]) → marca membros à mão (nomes das partes) quando a busca automática erra
     Plano.notas('Lumi')              → NOTAS DO CLAUDE do personagem (guia + registro do que já foi feito; js/notasclaude.js)
   Nada aqui mexe no personagem da equipe: só na animação aberta (a cópia dela). */
'use strict';
const Plano = {
  // o contexto leva as NOTAS DO CLAUDE de cada personagem (js/notasclaude.js): leia antes de mexer no personagem
  contexto() { const c = IA.contexto(App.P), n = {}; for (const d of Object.values(App.P?.personagens || {})) { const x = NotasClaude.de(d); if (x.guia || x.registro.length) n[d.nome || d.id] = x; } return Object.keys(n).length ? { ...c, notas_claude: n } : c; },
  notas(nome) { return NotasClaude.texto(this.def(nome)); },
  aplicar(acoes) { if (!App.P) throw new Error('Abra uma animação primeiro.'); return IA.aplicar(Array.isArray(acoes) ? acoes : acoes?.acoes || []); },
  def(nome) { const L = Object.values(App.P?.personagens || {}); return IA.acha(L, nome) || L[0] || null; },
  async folha(nome, vista) { const def = this.def(nome); if (!def) throw new Error('Personagem não achado'); const f = await Rig.folha(def, vista && IA.acha(def.vistas || [], vista)?.id); this.mostra(f.url); return { w: f.w, h: f.h, vista: f.vista }; },
  async quadros(de = 1, ate = App.P.duracao, n = 12, larg) {
    const P = App.P, a = clamp(Math.round(de) - 1, 0, P.duracao - 1), b = clamp(Math.round(ate) - 1, a, P.duracao - 1), N = clamp(n, 1, 24), L = larg || (P.h > P.w ? 170 : 260), H = Math.round(L * P.h / P.w), ims = [], rot = [];
    await Arq.garantir(Object.values(P.personagens).flatMap(d => Modelo.chavesImgs(d))).catch(() => { });
    for (let j = 0; j < N; j++) { const q = Math.round(a + (b - a) * (N === 1 ? 0 : j / (N - 1))), c = document.createElement('canvas'); c.width = L; c.height = H; Render.quadro(c.getContext('2d'), P, q, L, H); ims.push(c); rot.push(`q${q + 1} · ${Trechos.txt(q, P.fps)}`); }
    const url = await RefsAnim.b64(await RefsAnim.folha(ims, Math.min(4, N), L, rot)); this.mostra(url); return { quadros: rot };
  },
  membros(nome, lista) {
    const def = this.def(nome); if (!def) throw new Error('Personagem não achado'); const parte = n => IA.acha(def.partes, n)?.id;
    def.membros = (lista || []).map(m => ({ nome: m.nome || m.fim, raiz: parte(m.raiz), meio: parte(m.meio), fim: parte(m.fim) })).filter(m => m.raiz && m.meio && m.fim);
    App.commit('Membros do rig'); return Rig.cadeias(def).map(c => c.nome);
  },
  mostra(url) { this.fecha(); const im = document.body.appendChild(document.createElement('img')); im.id = 'plano-ver'; im.src = url; im.title = 'Clique para fechar';
    Object.assign(im.style, { position: 'fixed', inset: '0', margin: 'auto', maxWidth: '98vw', maxHeight: '96vh', zIndex: 99999, background: '#fff', boxShadow: '0 0 0 100vmax rgba(0,0,0,.6)', cursor: 'pointer' }); im.onclick = () => this.fecha(); },
  fecha() { document.getElementById('plano-ver')?.remove(); },
};
