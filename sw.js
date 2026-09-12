/**
 * Service Worker for Basketball Scoreboard PWA
 * Implements Cache-First strategy with fallback to Network
 */

const CACHE_NAME = 'scoreboard-v1';
const CACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

const EXTERNAL_CACHE_URLS = [
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

/**
 * Install Event - Cache all static assets and external libraries
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install event triggered');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell files');
      
      // Cache local app files
      cache.addAll(CACHE_URLS).catch((err) => {
        console.warn('[Service Worker] Failed to cache some app shell files:', err);
      });

      // Cache external CDN libraries
      console.log('[Service Worker] Caching external libraries from CDN');
      return Promise.allSettled(
        EXTERNAL_CACHE_URLS.map((url) => {
          return fetch(url)
            .then((response) => {
              if (!response.ok) {
                throw new Error(`Failed to fetch ${url}: ${response.status}`);
              }
              return cache.put(url, response);
            })
            .catch((err) => {
              console.warn(`[Service Worker] Failed to cache ${url}:`, err);
              // Don't fail the install if CDN resources aren't available
              // The app will still work with Cache-First + Network fallback
            });
        })
      );
    })
    .then(() => {
      console.log('[Service Worker] Cache populated successfully');
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
    .catch((err) => {
      console.error('[Service Worker] Install failed:', err);
    })
  );
});

/**
 * Activate Event - Clean up old cache versions
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate event triggered');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old cache versions (keep only CACHE_NAME)
          if (cacheName !== CACHE_NAME) {
            console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[Service Worker] Old caches cleaned up');
      // Claim all clients immediately
      return self.clients.claim();
    })
    .catch((err) => {
      console.error('[Service Worker] Activation failed:', err);
    })
  );
});

/**
 * Fetch Event - Cache-First strategy with Network fallback
 * Serves cached content first, falls back to network if not cached
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extension requests
  if (request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log(`[Service Worker] Cache hit: ${request.url}`);
          return cachedResponse;
        }

        // Not in cache, try network
        console.log(`[Service Worker] Cache miss, fetching from network: ${request.url}`);
        return fetch(request)
          .then((networkResponse) => {
            // Check if response is valid
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
              return networkResponse;
            }

            // Clone the response before caching
            const responseClone = networkResponse.clone();

            // Cache the new response
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
              console.log(`[Service Worker] Cached new resource: ${request.url}`);
            });

            return networkResponse;
          })
          .catch((err) => {
            console.error(`[Service Worker] Network request failed for ${request.url}:`, err);
            
            // Return a basic offline response if available
            // You can customize this based on resource type
            if (request.destination === 'image') {
              return caches.match('./images/offline-placeholder.png')
                .catch(() => new Response('Image unavailable', { status: 404 }));
            }

            return new Response(
              'Service Unavailable - Offline',
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain'
                })
              }
            );
          });
      })
      .catch((err) => {
        console.error(`[Service Worker] Cache match error for ${request.url}:`, err);
        return new Response('Service Unavailable', { status: 503 });
      })
  );
});

/**
 * Message Event - Handle messages from the app
 */
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
