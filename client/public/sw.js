/**
 * TaskFlow Pro Service Worker
 * Provides offline functionality, caching, and push notifications
 */

const CACHE_NAME = 'taskflow-pro-v1.2.0';
const CACHE_VERSION = '1.2.0';
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;
const API_CACHE = `${CACHE_NAME}-api`;

// Files to cache immediately (static assets)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Add other critical assets here
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/v1/boards',
  '/api/v1/cards',
  '/api/auth/me',
  '/api/v1/analytics/dashboard'
];

// Network timeout for fetch requests
const NETWORK_TIMEOUT = 5000;

// Maximum cache size limits
const MAX_CACHE_ITEMS = {
  static: 100,
  dynamic: 150,
  api: 200
};

/**
 * Install Event - Cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      
      // Initialize other caches
      caches.open(DYNAMIC_CACHE),
      caches.open(API_CACHE)
    ]).then(() => {
      console.log('[SW] Installation completed');
      return self.skipWaiting();
    }).catch((error) => {
      console.error('[SW] Installation failed:', error);
    })
  );
});

/**
 * Activate Event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('taskflow-pro-') && !cacheName.includes(CACHE_VERSION)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Take control of all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Activation completed');
      
      // Notify clients about the update
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION
          });
        });
      });
    })
  );
});

/**
 * Fetch Event - Handle network requests with caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Determine caching strategy based on request type
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else if (isAPIRequest(request)) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
  } else if (isNavigationRequest(request)) {
    event.respondWith(navigationStrategy(request));
  } else {
    event.respondWith(staleWhileRevalidateStrategy(request, DYNAMIC_CACHE));
  }
});

/**
 * Background Sync Event - Handle offline actions
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(syncOfflineActions());
  } else if (event.tag === 'sync-analytics') {
    event.waitUntil(syncAnalytics());
  }
});

/**
 * Push Event - Handle push notifications
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');
  
  const options = {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: {},
    actions: [
      {
        action: 'view',
        title: 'Ver',
        icon: '/icons/action-view.png'
      },
      {
        action: 'dismiss',
        title: 'Descartar',
        icon: '/icons/action-dismiss.png'
      }
    ]
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      options.title = data.title || 'TaskFlow Pro';
      options.body = data.body || 'Nova notificação';
      options.data = data;
      options.tag = data.tag || 'general';
      options.requireInteraction = data.requireInteraction || false;
    } catch (error) {
      console.error('[SW] Error parsing push data:', error);
      options.title = 'TaskFlow Pro';
      options.body = event.data.text() || 'Nova notificação';
    }
  } else {
    options.title = 'TaskFlow Pro';
    options.body = 'Nova notificação disponível';
  }
  
  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

/**
 * Notification Click Event - Handle notification interactions
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click event');
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  notification.close();
  
  if (action === 'dismiss') {
    return;
  }
  
  // Determine URL to open based on notification data
  let targetUrl = '/';
  if (data.url) {
    targetUrl = data.url;
  } else if (data.boardId) {
    targetUrl = `/boards/${data.boardId}`;
  } else if (data.cardId) {
    targetUrl = `/cards/${data.cardId}`;
  }
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      
      // Open a new window
      return self.clients.openWindow(targetUrl);
    })
  );
});

/**
 * Message Event - Handle messages from clients
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_VERSION });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    case 'CACHE_DATA':
      if (payload) {
        cacheOfflineData(payload);
      }
      break;
      
    case 'SYNC_REQUEST':
      if (payload) {
        queueOfflineAction(payload);
      }
      break;
      
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// =============================================================================
// CACHING STRATEGIES
// =============================================================================

/**
 * Cache First Strategy - Try cache first, fallback to network
 */
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Cache hit:', request.url);
      return cachedResponse;
    }
    
    console.log('[SW] Cache miss, fetching:', request.url);
    const networkResponse = await fetchWithTimeout(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      await limitCacheSize(cacheName, MAX_CACHE_ITEMS.static);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache first strategy failed:', error);
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network First Strategy - Try network first, fallback to cache
 */
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetchWithTimeout(request);
    
    if (networkResponse && networkResponse.status === 200) {
      console.log('[SW] Network success:', request.url);
      const cache = await caches.open(cacheName);
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      await limitCacheSize(cacheName, MAX_CACHE_ITEMS.api);
      return networkResponse;
    }
    
    throw new Error('Network request failed');
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Cache hit (fallback):', request.url);
      return cachedResponse;
    }
    
    console.error('[SW] Network first strategy failed completely:', error);
    return new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      { 
        status: 503, 
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Stale While Revalidate Strategy - Return cache, update in background
 */
async function staleWhileRevalidateStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    // Update cache in background
    const networkPromise = fetchWithTimeout(request).then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
        limitCacheSize(cacheName, MAX_CACHE_ITEMS.dynamic);
      }
      return response;
    }).catch((error) => {
      console.warn('[SW] Background update failed:', error);
    });
    
    // Return cached version immediately if available
    if (cachedResponse) {
      console.log('[SW] Stale cache hit:', request.url);
      return cachedResponse;
    }
    
    // Wait for network if no cache
    return networkPromise;
  } catch (error) {
    console.error('[SW] Stale while revalidate failed:', error);
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Navigation Strategy - Special handling for page navigation
 */
async function navigationStrategy(request) {
  try {
    const networkResponse = await fetchWithTimeout(request);
    return networkResponse;
  } catch (error) {
    console.log('[SW] Navigation offline, serving app shell');
    const cache = await caches.open(STATIC_CACHE);
    const appShell = await cache.match('/index.html');
    return appShell || new Response('Offline', { status: 503 });
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if request is for a static asset
 */
function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/) ||
         url.pathname === '/manifest.json' ||
         url.pathname.startsWith('/icons/');
}

/**
 * Check if request is for an API endpoint
 */
function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/');
}

/**
 * Check if request is for navigation
 */
function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

/**
 * Fetch with timeout
 */
function fetchWithTimeout(request, timeout = NETWORK_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Network timeout'));
    }, timeout);
    
    fetch(request).then((response) => {
      clearTimeout(timeoutId);
      resolve(response);
    }).catch((error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

/**
 * Limit cache size by removing oldest entries
 */
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    const keysToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
    console.log(`[SW] Cleaned ${keysToDelete.length} items from ${cacheName}`);
  }
}

/**
 * Clear all caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames
      .filter(name => name.startsWith('taskflow-pro-'))
      .map(name => caches.delete(name))
  );
}

/**
 * Cache offline data for later sync
 */
async function cacheOfflineData(data) {
  try {
    const cache = await caches.open('taskflow-offline-data');
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put(`offline-data-${Date.now()}`, response);
    console.log('[SW] Cached offline data');
  } catch (error) {
    console.error('[SW] Error caching offline data:', error);
  }
}

/**
 * Queue offline action for background sync
 */
async function queueOfflineAction(action) {
  try {
    // In a real implementation, you would store this in IndexedDB
    // For now, we'll just register for background sync
    await self.registration.sync.register('sync-offline-actions');
    console.log('[SW] Queued offline action for sync');
  } catch (error) {
    console.error('[SW] Error queuing offline action:', error);
  }
}

/**
 * Sync offline actions when back online
 */
async function syncOfflineActions() {
  try {
    console.log('[SW] Syncing offline actions...');
    // Implementation would retrieve queued actions from IndexedDB
    // and replay them against the API
    
    // Notify clients about sync completion
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('[SW] Error syncing offline actions:', error);
  }
}

/**
 * Sync analytics data
 */
async function syncAnalytics() {
  try {
    console.log('[SW] Syncing analytics data...');
    // Implementation would sync any cached analytics events
  } catch (error) {
    console.error('[SW] Error syncing analytics:', error);
  }
}

console.log('[SW] Service Worker script loaded', CACHE_VERSION);