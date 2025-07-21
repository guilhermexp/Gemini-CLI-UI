// Service Worker for Gemini CLI UI PWA
const CACHE_NAME = 'gemini-ui-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event
self.addEventListener('fetch', event => {
  // Skip caching for development resources and common dev files
  if (event.request.url.includes('/@vite') || 
      event.request.url.includes('/@react-refresh') ||
      event.request.url.includes('/node_modules') ||
      event.request.url.includes('hot-update') ||
      event.request.url.includes('client') ||
      event.request.url.includes('src/') ||
      event.request.url.includes('.jsx') ||
      event.request.url.includes('.tsx') ||
      event.request.url.includes('.js.map') ||
      event.request.url.includes('favicon') ||
      event.request.url.includes('icons/')) {
    return;
  }

  // Only handle same-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
          return response;
        }
        
        // Clone the request for fetching
        const fetchRequest = event.request.clone();
        
        // Otherwise fetch from network with proper error handling
        return fetch(fetchRequest)
          .then(response => {
            // Check if response is valid
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone response for caching
            const responseToCache = response.clone();
            
            // Cache successful responses
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            // Return a fallback response for navigation requests
            if (event.request.mode === 'navigate' || event.request.destination === 'document') {
              return caches.match('/index.html').then(cachedResponse => {
                return cachedResponse || new Response('App offline', { 
                  status: 200, 
                  headers: { 'Content-Type': 'text/html' } 
                });
              });
            }
            
            // For other requests, return a generic response or null
            return new Response('Resource not available', { 
              status: 404, 
              statusText: 'Not Found' 
            });
          });
      })
      .catch(error => {
        // Final fallback for cache errors
        if (event.request.destination === 'document' || event.request.mode === 'navigate') {
          return new Response('App offline', { 
            status: 200, 
            headers: { 'Content-Type': 'text/html' } 
          });
        }
        return new Response('Service unavailable', { 
          status: 503, 
          statusText: 'Service Unavailable' 
        });
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});