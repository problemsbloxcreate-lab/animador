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
  aoVivoUrl: 'https://estudio-problems-login-default-rtdb.firebaseio.com',
  firebase: {
    apiKey: '__FIREBASE_API_KEY__',
    authDomain: 'estudio-problems-login.firebaseapp.com',
    projectId: 'estudio-problems-login',
    storageBucket: 'estudio-problems-login.firebasestorage.app',
    messagingSenderId: '105930517340',
    appId: '1:105930517340:web:665cfdcffdcd8283e8af99',
  },
};
