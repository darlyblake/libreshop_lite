// LibreShop Service Worker - Auto-Update System
// BUILD_VERSION is injected at deploy time by scripts/inject-build-id.js
// Each new commit generates a unique version, forcing cache invalidation for all users
const BUILD_VERSION = '20260518-d833322';
const CACHE_NAME = `libreshop-${BUILD_VERSION}`;
const STATIC_CACHE = `libreshop-static-${BUILD_VERSION}`;
const DYNAMIC_CACHE = `libreshop-dynamic-${BUILD_VERSION}`;

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png'
];

// API routes that should never be cached
const API_ROUTES = [
  '/api/v1/',
  '/rest/v1/',
  '/functions/v1/',
  '/auth/v1/'
];

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log(`[SW] Installing version ${BUILD_VERSION}...`);
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          const response = await fetch(asset, { cache: 'no-store' });
          if (response && response.ok) {
            await cache.put(asset, response.clone());
          }
        } catch (err) {
          console.warn(`[SW] Skipping asset: ${asset}`, err);
        }
      }
      console.log(`[SW] Install complete — version ${BUILD_VERSION}`);
      // Activate immediately without waiting for old tabs to close
      return self.skipWaiting();
    })
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log(`[SW] Activating version ${BUILD_VERSION}...`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== CACHE_NAME)
          .map(name => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log(`[SW] Activated version ${BUILD_VERSION} — now controlling all clients`);
      // Tell all open tabs about the update so React can show the update banner
      return self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    }).then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_UPDATED',
          version: BUILD_VERSION,
        });
      });
      return self.clients.claim();
    })
  );
});

// ─── Fetch Strategy ────────────────────────────────────────────────────────────
const isApiRequest = (url) => API_ROUTES.some(route => url.includes(route));

const shouldCache = (request) => {
  const url = new URL(request.url);
  if (isApiRequest(url.pathname)) return false;
  if (request.method !== 'GET') return false;
  if (url.origin === self.location.origin) return true;
  return false;
};

self.addEventListener('fetch', event => {
  if (!shouldCache(event.request)) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Stale-while-revalidate: serve cache instantly, refresh in background
      if (cachedResponse) {
        // Refresh the cache in background
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // No cache — go to network
      return fetch(event.request).then(response => {
        if (response.ok && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ─── Messages from React app ───────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (!event.data) return;

  // React asks the SW to apply the update immediately
  if (event.data.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING received — activating now');
    self.skipWaiting();
  }

  // React asks the current SW version
  if (event.data.type === 'GET_VERSION') {
    event.source?.postMessage({
      type: 'SW_VERSION',
      version: BUILD_VERSION,
    });
  }
});

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/favicon.ico',
      vibrate: [100, 50, 100],
    })
  );
});

console.log(`[SW] Loaded — version ${BUILD_VERSION}`);
