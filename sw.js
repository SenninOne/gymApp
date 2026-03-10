const CACHE_NAME = 'gym-tracker-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/db.js',
  '/js/workouts.js',
  '/js/charts.js',
  '/manifest.json'
];

// Install service worker and cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching app assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  
  self.skipWaiting();
});

// Activate service worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

// Fetch from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and non-navigation requests
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response and update cache in background
        return cachedResponse;
      }
      
      // No cache found, fetch from network
      return fetch(event.request).then((response) => {
        // Don't cache error responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Clone the response and add to cache
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      });
    })
  );
});

// Handle background sync for offline workout logging (if needed in future)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-workouts') {
    event.waitUntil(syncWorkouts());
  }
});

async function syncWorkouts() {
  // Placeholder for future offline sync functionality
  console.log('Syncing workouts...');
}

// Handle push notifications (optional feature for workout reminders)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Time to work out! 💪',
    icon: 'https://via.placeholder.com/192x192.png?text=GYM%20Tracker&bg=16213e&fg=5eead4',
    badge: 'https://via.placeholder.com/72x72.png?text=G&bg=16213e&fg=5eead4',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'close', title: 'Close' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Gym Tracker', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(clients.openWindow('/'));
  } else {
    event.notification.close();
  }
});