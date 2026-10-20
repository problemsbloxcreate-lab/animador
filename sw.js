// Service worker do "usar como programa". REDE PRIMEIRO: sempre pega a versão mais nova dos arquivos
// (assim cada atualização aparece na hora); o cache só é usado se estiver sem internet.
// Não guarda nada de outro site (login do Google, servidor da IA) — só os arquivos do próprio editor.
const CACHE = 'animador-v2';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  // só os arquivos do próprio Animador (a pasta onde este arquivo está); login, conta e os outros projetos passam direto
  const pasta = new URL('./', self.location.href).pathname;
  if (!u.pathname.startsWith(pasta)) return;
  e.respondWith((r.mode === 'navigate' ? fetch(r) : fetch(r, { cache: 'no-store' })).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)).catch(() => { }); } return res; })
    .catch(() => caches.match(r).then(m => m || Response.error())));
});
