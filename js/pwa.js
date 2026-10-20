/* ===================== pwa.js — usar o site como programa de computador =====================
   No site (https / localhost): dá para INSTALAR (vira um programa com ícone e janela própria).
   Abrindo o index.html direto do computador (file://): use "Abrir como programa.bat" (janela de programa,
   sempre com os arquivos atuais — bom para testar versões novas). */
'use strict';
const PWA = {
  prompt: null,
  get installed() { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true; },
  get web() { return /^https?:$/.test(location.protocol); },
  init() {
    if (this.web && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.prompt = e; });
    addEventListener('appinstalled', () => { this.prompt = null; UI.toast('Instalado! O Estúdio Problems agora abre como programa.', { kind: 'ok' }); });
    if (this.installed) document.documentElement.classList.add('as-app');
    // abrir um .toon com dois cliques (programa instalado)
    if ('launchQueue' in window) launchQueue.setConsumer(async p => { for (const h of p.files || []) { const f = await h.getFile(); if (/\.toon$/i.test(f.name) && typeof Home !== 'undefined') { await Home.openToon(f); break; } } });
  },
  async install() {
    if (this.installed) return UI.toast('Você já está usando como programa ✓', { kind: 'ok' });
    if (this.prompt) { this.prompt.prompt(); const r = await this.prompt.userChoice.catch(() => null); this.prompt = null; if (r?.outcome !== 'accepted') UI.toast('Instalação cancelada', { time: 1500 }); return; }
    const body = this.web
      ? `<p>No <b>Chrome</b> ou <b>Edge</b>: clique no ícone ${ic('download', 12)} <b>Instalar</b> que aparece no fim da barra de endereço.</p><p>Ou: menu <b>⋮</b> → <b>Transmitir, salvar e compartilhar</b> → <b>Instalar página como app…</b> (no Edge: <b>⋯</b> → <b>Aplicativos</b> → <b>Instalar este site como um aplicativo</b>).</p>`
      : `<p>Na pasta do Estúdio Problems, dê dois cliques em <b>Abrir como programa.bat</b> — abre numa janela própria, sem barra do navegador, e sempre com os arquivos atuais (quando você trocar os arquivos por uma versão nova, já abre a nova).</p><p>Para ter o ícone na área de trabalho: dois cliques em <b>Criar atalho na area de trabalho.bat</b>.</p>`;
    UI.modal({ title: 'Usar como programa', icon: 'tv', body, buttons: [{ label: 'Ok', kind: 'primary' }] });
  },
};
PWA.init();
