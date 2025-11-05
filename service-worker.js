const CACHE_NAME = 'bullseye-arena-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  // You might need to add paths to your bundled JS/CSS files here
  // For now, we cache the main page and known external resources
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/',
  'https://aistudiocdn.com/react@^19.2.0/',
  'https://accounts.google.com/gsi/client',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Rubik+Bubbles&family=Assistant:wght@400;700&display=swap',
  'https://actions.google.com/sounds/v1/ui/button_press.ogg',
  'https://actions.google.com/sounds/v1/impacts/sharp_impact.ogg',
  'https://actions.google.com/sounds/v1/cartoon/magic_chime.ogg',
  'https://actions.google.com/sounds/v1/jingles/jingle_win_01.ogg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          (response) => {
            // Check if we received a valid response
            if(!response || response.status !== 200) {
              return response;
            }
            // We don't cache responses from Google's GSI client as they are dynamic
            if (event.request.url.startsWith('https://accounts.google.com/gsi/')) {
                return response;
            }


            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
