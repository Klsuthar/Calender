const CACHE_NAME = 'auracal-cache-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Install Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Caching App Shell Assets');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Clearing Old Cache', cache);
                        return caches.delete(cache);
                      }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Interceptor for Offline Cache
self.addEventListener('fetch', (event) => {
    // Bypass Google Apps Script Web App sync operations
    if (event.request.url.includes('script.google.com') || event.request.url.includes('google.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((response) => {
                // If response is invalid or not GET request, do not cache
                if (!response || response.status !== 200 || event.request.method !== 'GET') {
                    return response;
                }

                // Cache dynamic resources like FontAwesome and Google Fonts CDN files on demand
                const url = event.request.url;
                if (url.includes('cdnjs.cloudflare.com') || url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }

                return response;
            }).catch((err) => {
                console.warn('Fetch failed, resource not available offline:', event.request.url, err);
            });
        })
    );
});
