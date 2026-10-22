// O "usar como programa" foi tirado do Animador. Quem ainda tiver o service worker antigo recebe este,
// que apaga os arquivos que ele tinha guardado e se desliga sozinho (o Animador passa a abrir direto pelo site).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('animador-')) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => { });
})()));
