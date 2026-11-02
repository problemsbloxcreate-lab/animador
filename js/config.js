/* ===================== config.js — endereços do Estúdio Problems (dados públicos por natureza) ===================== */
'use strict';
// nome do programa
const ESTUDIO = { nome: 'Estúdio Problems', modulo: 'ANIMADOR', get titulo() { return this.modulo + ' · ' + this.nome; } };
const TURMA_CONFIG = {
  iaServidor: 'https://turma-ia.problemsraiz.workers.dev',
  // menu do Estúdio Problems (onde se entra com o Google)
  menuUrl: '/',
  // login com Google (Firebase)
  equipeLimiteGB: 1,
  // trabalhar junto ao vivo (Firebase Realtime Database do mesmo projeto do login). Vazio = desligado
  aoVivoUrl: 'https://estudio-problems-fbe08-default-rtdb.firebaseio.com',
  firebase: {
    apiKey: '__FIREBASE_API_KEY__',
    authDomain: 'estudio-problems-fbe08.firebaseapp.com',
    projectId: 'estudio-problems-fbe08',
    storageBucket: 'estudio-problems-fbe08.firebasestorage.app',
    messagingSenderId: '833185766272',
    appId: '1:833185766272:web:4127fcf45287c5a559ff65',
  },
};
