/* ===================== pngtuber.js — LUGAR RESERVADO para personagens PNGtuber (pedido da dona, 11/11/2026) =====================
   AINDA NÃO FUNCIONA: é só a estrutura e o lugar na interface, para uso futuro.
   PNGtuber = personagem de imagens inteiras que trocam conforme a voz e a emoção (estilo Mundo Torajo e Turma da Batatinha), em vez
   do rig de recorte "Rive" (Braço › Antebraço › Mão…). Cada EXPRESSÃO tem poucas imagens inteiras:
     • boca fechada / boca aberta (fala: abre quando a voz passa do limite),
     • com os olhos abertos e piscando (pisca sozinho de tempos em tempos),
   e o personagem dá um QUIQUE (sobe e desce) quando começa a falar.
   Onde aparece hoje: na tela "Personagem novo" do Ateliê, a escolha "PNGtuber" fica desligada com o selo "em breve" (Atelie.assistenteNovo).
   Formato combinado para o futuro (def.tipo = 'pngtuber'; o resto do def segue o do Ateliê, para a nuvem, as pastas e o .atelieanimador
   funcionarem igual):
     def.pngtuber = {
       expressoes: [{ id, nome, imgs: { fechada, aberta, piscaFechada, piscaAberta } }],  // ids de imagens em def.arqs (mesmo formato do Ateliê)
       padrao: idDaExpressao,
       fala: { limite: 0.08, segura: 90 },            // volume (0–1) que abre a boca e quanto tempo (ms) ela segura aberta
       pisca: { cada: [2500, 6000], dura: 120 },       // intervalo sorteado entre piscadas e a duração (ms)
       quique: { altura: 18, dura: 160 },              // em unidades do personagem
     }
   Nada aqui é chamado ainda: nenhum personagem existente muda. */
'use strict';
const PNGtuber = {
  PRONTO: false, // quando virar true, a escolha "PNGtuber" do Personagem novo é ligada
  EXPRESSOES: ['Neutra', 'Feliz', 'Brava', 'Triste', 'Surpresa'],
  // esqueleto do def de um PNGtuber novo (só a estrutura; usado quando o modo existir)
  novo(nome = 'PNGtuber novo') {
    const exp = this.EXPRESSOES.map(n => ({ id: 'ex-' + n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), nome: n, imgs: { fechada: null, aberta: null, piscaFechada: null, piscaAberta: null } }));
    return { tipo: 'pngtuber', nome, pngtuber: { expressoes: exp, padrao: exp[0].id, fala: { limite: 0.08, segura: 90 }, pisca: { cada: [2500, 6000], dura: 120 }, quique: { altura: 18, dura: 160 } } };
  },
  eh(def) { return def?.tipo === 'pngtuber'; },
};
