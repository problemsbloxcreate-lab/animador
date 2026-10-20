/* ===================== config.js — configurações do Estúdio Problems =====================
   Quando o editor for para o GitHub, coloque aqui o endereço do "servidor do Estúdio Problems"
   (veja servidor-ia/LEIA-ME.md). Assim todos os colegas já usam a IA sem precisar de chave.
   NUNCA coloque a chave da API (sk-ant-...) neste arquivo nem em nenhum outro do site! */
'use strict';
// Nome do programa (é parte do ESTÚDIO PROBLEMS — ver ESTUDIO-PROBLEMS.md para a unificação futura)
const ESTUDIO = { nome: 'Estúdio Problems', modulo: 'ANIMADOR', get titulo() { return this.modulo + ' · ' + this.nome; } };
const TURMA_CONFIG = {
  iaServidor: 'https://turma-ia.problemsraiz.workers.dev',
  // MENU do Estúdio Problems — é lá que se entra com o Google. Sem login, este projeto manda para o menu e, depois de
  // entrar, o menu traz a pessoa de volta. O menu e este projeto precisam estar no MESMO domínio (ex.: menu em /,
  // este projeto em /animar/) para o login valer aqui.
  menuUrl: '/',
  // Firebase do editor (só login com Google). Estes dados são PÚBLICOS por natureza (todo site com Firebase mostra isso);
  // quem decide quais e-mails entram é o servidor do Estúdio Problems (EMAILS_PERMITIDOS na Cloudflare), não este arquivo.
  // espaço da mídia da equipe (nuvem grátis da Cloudflare: 1 GB) — o servidor informa o valor real
  equipeLimiteGB: 1,
  firebase: {
    apiKey: 'AIzaSyAi04-Bbe-1yUG6xi9S2Ef26nImJUi6q60',
    authDomain: 'problems-estudios.firebaseapp.com',
    projectId: 'problems-estudios',
    storageBucket: 'problems-estudios.firebasestorage.app',
    messagingSenderId: '987944796866',
    appId: '1:987944796866:web:15f571c0ad18b12c91f15b',
  },
};
