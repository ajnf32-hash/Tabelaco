/* Service Worker — Tabelaço
   Estratégia "rede primeiro": SEMPRE tenta a versão online (atualiza na hora),
   usando o cache só como reserva quando estiver offline. É o que faz o placar
   novo aparecer sem o torcedor precisar reinstalar nada.
   Ao ativar, apaga TODO cache antigo (conserta quem instalou a versão velha). */
const CACHE = 'tabelaco-net-v1';

self.addEventListener('install', () => {
  // assume o controle imediatamente, sem esperar abas antigas fecharem
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k))); // limpa caches antigos
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // bandeiras (flagcdn) seguem direto pela rede

  const isHTML = req.mode === 'navigate'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('index.html');

  e.respondWith((async () => {
    try {
      // HTML sempre sem cache do navegador -> garante pegar a versão nova
      const fresh = await fetch(req, isHTML ? { cache: 'no-store' } : {});
      const copy = fresh.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return fresh;
    } catch {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (isHTML) return caches.match('./index.html');
      return Response.error();
    }
  })());
});
