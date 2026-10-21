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
  firebase: {
    apiKey: 'AIzaSyAi04-Bbe-1yUG6xi9S2Ef26nImJUi6q60',
    authDomain: 'problems-estudios.firebaseapp.com',
    projectId: 'problems-estudios',
    storageBucket: 'problems-estudios.firebasestorage.app',
    messagingSenderId: '987944796866',
    appId: '1:987944796866:web:15f571c0ad18b12c91f15b',
  },
};
