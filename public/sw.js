// KAI - Service Worker for Push Notifications & PWA Caching
// IMPORTANT: cache version bump is required to prevent clients from mixing old/new JS chunks
// (which can cause invalid hook calls like: "Cannot read properties of null (reading 'useRef')").
const CACHE_NAME = 'kai-v2-20260128';
const OFFLINE_URL = '/';

// Assets to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/favicon.svg',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  // Claim all clients immediately
  self.clients.claim();
});

// Fetch event - safe caching strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API requests and external resources
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/supabase/')) return;

  // Never cache Vite/dev module graph or JS/CSS bundles.
  // These must always come from the network to avoid serving mismatched module versions.
  const isDevOrBundledAsset =
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('/.vite/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.mjs') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.map');

  if (isDevOrBundledAsset) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Navigation requests: network-first, fallback to cached offline shell.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the offline shell for future offline navigation
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(OFFLINE_URL, responseToCache));
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        // Cache only safe asset types (icons/images/fonts/json), never JS/CSS.
        const destination = event.request.destination;
        const isCacheableDestination = destination === 'image' || destination === 'font';
        const isCacheablePath =
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.jpg') ||
          url.pathname.endsWith('.jpeg') ||
          url.pathname.endsWith('.webp') ||
          url.pathname.endsWith('.svg') ||
          url.pathname.endsWith('.ico') ||
          url.pathname.endsWith('.woff') ||
          url.pathname.endsWith('.woff2') ||
          url.pathname.endsWith('.ttf') ||
          url.pathname.endsWith('.otf') ||
          url.pathname.endsWith('.json');

        if (isCacheableDestination || isCacheablePath) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Push notification received
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let notificationData = {
    title: 'KAI',
    body: 'Nova notificação',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'kai-notification',
    data: {},
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || payload.message || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        tag: payload.tag || payload.id || notificationData.tag,
        data: payload.data || payload,
        actions: payload.actions || [],
        requireInteraction: payload.requireInteraction || false,
        vibrate: [200, 100, 200],
      };
    } catch (e) {
      console.log('[SW] Push data text:', event.data.text());
      notificationData.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      actions: notificationData.actions,
      requireInteraction: notificationData.requireInteraction,
      vibrate: notificationData.vibrate,
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  event.notification.close();
  
  const notificationData = event.notification.data;
  let targetUrl = '/';
  
  // Build navigation URL based on notification type
  if (notificationData) {
    const entityType = notificationData.entity_type;
    const entityId = notificationData.entity_id;
    const workspaceSlug = notificationData.workspace_slug;
    
    if (entityType === 'planning_item' && entityId) {
      targetUrl = workspaceSlug 
        ? `/${workspaceSlug}?tab=planning&openItem=${entityId}`
        : `/?tab=planning&openItem=${entityId}`;
    } else if (notificationData.url) {
      targetUrl = notificationData.url;
    }
  }
  
  // Handle action clicks
  if (event.action) {
    console.log('[SW] Action clicked:', event.action);
    if (event.action === 'view' && notificationData?.url) {
      targetUrl = notificationData.url;
    }
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  console.log('[SW] Syncing notifications in background...');
  // This would sync any pending notification actions when back online
}

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  }
});
