// LibreShop Service Worker - Enhanced PWA Support
const CACHE_NAME = 'libreshop-v1.0.0';
const STATIC_CACHE = 'libreshop-static-v1';
const DYNAMIC_CACHE = 'libreshop-dynamic-v1';

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

// API routes that should not be cached
const API_ROUTES = [
  '/api/v1/',
  '/rest/v1/',
  '/functions/v1/',
  '/auth/v1/'
];

// Install Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch(err => {
        console.log('Cache installation failed:', err);
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old caches
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Helper function to determine if request is API
const isApiRequest = (url) => {
  return API_ROUTES.some(route => url.includes(route));
};

// Helper function to determine if request should be cached
const shouldCache = (request) => {
  const url = new URL(request.url);
  
  // Don't cache API requests
  if (isApiRequest(url.pathname)) {
    return false;
  }
  
  // Don't cache POST/PUT/DELETE requests
  if (request.method !== 'GET') {
    return false;
  }
  
  // Cache static assets and same-origin requests
  if (url.origin === self.location.origin) {
    return true;
  }
  
  return false;
};

// Fetch Event - Enhanced Strategy
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip cross-origin requests and API calls
  if (!shouldCache(request)) {
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // Strategy: Stale While Revalidate for cached content
        if (cachedResponse) {
          // Serve cached content immediately, then update in background
          fetchAndCache(request);
          return cachedResponse;
        }
        
        // Network First for dynamic content
        return fetch(request)
          .then(response => {
            // Cache successful responses
            if (response.ok && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(DYNAMIC_CACHE).then(cache => {
                cache.put(request, responseToCache);
              });
            }
            return response;
          })
          .catch(() => {
            // Fallback to cache if network fails
            return caches.match(request);
          });
      })
      .catch(() => {
        // Final fallback for critical resources
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

// Background fetch and cache
const fetchAndCache = (request) => {
  fetch(request)
    .then(response => {
      if (response.ok) {
        const responseToCache = response.clone();
        caches.open(DYNAMIC_CACHE).then(cache => {
          cache.put(request, responseToCache);
        });
      }
    })
    .catch(err => {
      console.log('Background fetch failed:', err);
    });
};

// Handle messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Handle cache updates
  if (event.data && event.data.type === 'UPDATE_CACHE') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then(cache => {
        return cache.add(event.data.url);
      })
    );
  }
});

// Handle background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle offline actions here
      console.log('Background sync triggered')
    );
  }
});

// Handle push notifications (future enhancement)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/favicon.ico',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

console.log('Service Worker loaded successfully');
