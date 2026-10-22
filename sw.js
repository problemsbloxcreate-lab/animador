// Service worker do "usar como programa".
// Arquivos com carimbo de versão (?_ev=…, o porteiro coloca): nunca mudam, então vêm do cache na hora (sem internet).
// O resto: rede primeiro, deixando o navegador conferir com o servidor se mudou (só baixa o que mudou);
// o cache só é usado se estiver sem internet.
// Não guarda nada de outro site (login do Google, servidor da IA) — só os arquivos do próprio editor.
const CACHE = 'animador-v3';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => { for (const k of await caches.keys()) if (k.startsWith('animador-') && k !== CACHE) await caches.delete(k); await self.clients.claim(); })()));
const guarda = async (r, res) => {
  try { const c = await caches.open(CACHE), u = new URL(r.url);
    if (u.searchParams.has('_ev')) for (const k of await c.keys()) { const ku = new URL(k.url); if (ku.pathname === u.pathname && ku.href !== u.href) await c.delete(k); } // versão velha do mesmo arquivo sai
    await c.put(r, res); } catch { }
};
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  // só os arquivos do próprio Animador (a pasta onde este arquivo está); login, conta e os outros projetos passam direto
  const pasta = new URL('./', self.location.href).pathname;
  if (!u.pathname.startsWith(pasta)) return;
  if (u.searchParams.has('_ev')) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok) { const cp = res.clone(); e.waitUntil(guarda(r, cp)); } return res; })));
    return;
  }
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); e.waitUntil(guarda(r, cp)); } return res; })
    .catch(() => caches.match(r).then(m => m || Response.error())));
});
