// A static name for your cache
const CACHE_NAME = 'step-counter-v5'; 

// List of files to cache during installation
const FILES_TO_CACHE = [
  './', 
  './index.html',
  './manifest.json',
  './icon-192.png',  
  './icon-512.png',
  './output.css',
];

// 1. Install event: Caches the essential app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching application shell');
        return cache.addAll(FILES_TO_CACHE);
      })
  );
});

// 2. Activate event: Cleans up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  // Takes control of the clients immediately after activation
  self.clients.claim(); 
});

// 3. Fetch event: Serves content from cache first, then falls back to network
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate' || FILES_TO_CACHE.some(url => event.request.url.includes(url))) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Return the cached response if available, otherwise fetch from the network
        return cachedResponse || fetch(event.request);
      })
    );
  }
});

