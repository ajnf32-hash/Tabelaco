/* Service Worker — Tabelaço
   Estratégia "rede primeiro": SEMPRE tenta a versão online (atualiza na hora),
   usando o cache só como reserva quando estiver offline. É o que faz o placar
   novo aparecer sem o torcedor precisar reinstalar nada.
   Ao ativar, apaga TODO cache antigo (conserta quem instalou a versão velha). */
const CACHE = 'tabelaco-net-v2';

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

/* O app pede os dados com um carimbo de hora na ponta — `dados/serie-a.json?v=
   1754835…` — para o navegador nunca servir placar velho. Isso criava dois
   problemas no cache, os dois consertados aqui guardando tudo pelo endereço
   SEM o carimbo:

   1. offline não funcionava. O carimbo é diferente a cada abertura, então o que
      estava guardado nunca batia com o que estava sendo pedido, e o app dizia
      que não conseguiu carregar os dados mesmo tendo tudo em mãos.
   2. o cache crescia sem parar. Cada abertura gravava uma cópia nova de cada
      campeonato, porque cada carimbo virava um endereço diferente. */
const chave = req => {
  const u = new URL(req.url);
  u.search = '';
  return u.href;
};

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // fontes e escudos de fora seguem direto pela rede

  const isHTML = req.mode === 'navigate'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('.html');

  e.respondWith((async () => {
    try {
      // HTML sempre sem cache do navegador -> garante pegar a versão nova
      const fresh = await fetch(req, isHTML ? { cache: 'no-store' } : {});
      // só guarda resposta boa: 404 ou erro de servidor não viram reserva
      if (fresh && fresh.ok) {
        const copia = fresh.clone();
        caches.open(CACHE).then(c => c.put(chave(req), copia)).catch(() => {});
      }
      return fresh;
    } catch {
      const guardado = await caches.match(chave(req));
      if (guardado) return guardado;
      if (isHTML) {
        const capa = await caches.match(new URL('index.html', location).href);
        if (capa) return capa;
      }
      return Response.error();
    }
  })());
});
