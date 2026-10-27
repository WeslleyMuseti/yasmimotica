// ══════════════════════════════════════════════════════════════════
// SERVICE WORKER - SISTEMA YASMIN ÓTICA (CONTINGÊNCIA OFFLINE PWA)
// Permite que o sistema abra, opere e finalize vendas mesmo sem internet!
// ══════════════════════════════════════════════════════════════════

const CACHE_NAME = 'yasmin-otica-offline-v7';

// Recursos visuais estáticos para a casca do app (ícones e logotipos)
const STATIC_ASSETS = [
  '/favicon.svg',
  '/icons.svg',
  '/logo-yasmin.png',
  '/logo-yasmin-transparent.png',
  '/logo-yasmin-white.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Aviso ao cachear assets estáticos no SW:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  if (typeof self.skipWaiting === 'function') {
    self.skipWaiting();
  }
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removendo cache legado:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Não interceptar requisições em ambiente de desenvolvimento local (localhost)
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.port === '5173' ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('node_modules')
  ) {
    return;
  }

  // Não interceptar requisições para o Firebase / Firestore (o SDK possui persistência própria em IndexedDB)
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')
  ) {
    return;
  }

  // Requisições de Navegação (HTML da página)
  // Estratégia: SEMPRE busca da rede primeiro para pegar a versão atualizada com os novos hashes JS
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      }).catch(async () => {
        // Fallback apenas quando REALMENTE estiver sem internet
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request) || await cache.match('/index.html') || await cache.match('/');
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // Arquivos estáticos empacotados (assets .js, .css, imagens, fontes)
  // Estratégia: Cache First com atualização em segundo plano (Stale-While-Revalidate)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Atualiza o cache em segundo plano se tiver internet
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // Se não estiver no cache, busca na rede e salva no cache
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Se falhar e for imagem, tenta fallback de logo
        if (request.destination === 'image') {
          return caches.match('/logo-yasmin.png');
        }
      });
    })
  );
});
