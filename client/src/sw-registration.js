/**
 * Service Worker Registration and Management
 * Handles PWA functionality, offline support, and push notifications
 */

class ServiceWorkerManager {
  constructor() {
    this.swRegistration = null;
    this.swVersion = null;
    this.updateAvailable = false;
    this.callbacks = {
      onUpdate: [],
      onOffline: [],
      onOnline: [],
      onSync: []
    };
    
    this.init();
  }
  
  /**
   * Initialize Service Worker
   */
  async init() {
    if ('serviceWorker' in navigator) {
      try {
        console.log('[SWM] Registering Service Worker...');
        
        // Register service worker
        this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none'
        });
        
        console.log('[SWM] Service Worker registered successfully');
        
        // Listen for updates
        this.swRegistration.addEventListener('updatefound', () => {
          this.handleUpdateFound();
        });
        
        // Listen for controller changes
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[SWM] Controller changed, reloading page');
          window.location.reload();
        });
        
        // Listen for messages from SW
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleMessage(event.data);
        });
        
        // Check for updates periodically
        this.startUpdateChecker();
        
        // Get current SW version
        await this.getCurrentVersion();
        
        // Setup push notifications if supported
        if ('PushManager' in window) {
          this.setupPushNotifications();
        }
        
      } catch (error) {
        console.error('[SWM] Service Worker registration failed:', error);
      }
    } else {
      console.warn('[SWM] Service Workers not supported');
    }
    
    // Setup network status listeners
    this.setupNetworkListeners();
  }
  
  /**
   * Handle Service Worker update
   */
  handleUpdateFound() {
    const newWorker = this.swRegistration.installing;
    
    if (newWorker) {
      console.log('[SWM] New Service Worker found');
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[SWM] New Service Worker installed');
          this.updateAvailable = true;
          this.notifyCallbacks('onUpdate', { newWorker });
        }
      });
    }
  }
  
  /**
   * Handle messages from Service Worker
   */
  handleMessage(data) {
    const { type, ...payload } = data;
    
    switch (type) {
      case 'SW_UPDATED':
        console.log('[SWM] Service Worker updated to version:', payload.version);
        this.swVersion = payload.version;
        break;
        
      case 'SYNC_COMPLETE':
        console.log('[SWM] Background sync completed');
        this.notifyCallbacks('onSync', payload);
        break;
        
      case 'CACHE_UPDATED':
        console.log('[SWM] Cache updated');
        break;
        
      default:
        console.log('[SWM] Unknown message from SW:', type, payload);
    }
  }
  
  /**
   * Setup network status listeners
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('[SWM] Network online');
      this.notifyCallbacks('onOnline');
      this.triggerBackgroundSync();
    });
    
    window.addEventListener('offline', () => {
      console.log('[SWM] Network offline');
      this.notifyCallbacks('onOffline');
    });
  }
  
  /**
   * Start periodic update checker
   */
  startUpdateChecker() {
    // Check for updates every 15 minutes
    setInterval(() => {
      if (this.swRegistration) {
        this.swRegistration.update();
      }
    }, 15 * 60 * 1000);
  }
  
  /**
   * Get current Service Worker version
   */
  async getCurrentVersion() {
    if (this.swRegistration && this.swRegistration.active) {
      try {
        const version = await this.postMessage({ type: 'GET_VERSION' });
        this.swVersion = version?.version;
        console.log('[SWM] Current SW version:', this.swVersion);
      } catch (error) {
        console.warn('[SWM] Could not get SW version:', error);
      }
    }
  }
  
  /**
   * Post message to Service Worker
   */
  postMessage(message) {
    return new Promise((resolve, reject) => {
      if (!this.swRegistration || !this.swRegistration.active) {
        reject(new Error('Service Worker not available'));
        return;
      }
      
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };
      
      messageChannel.port1.onerror = (error) => {
        reject(error);
      };
      
      this.swRegistration.active.postMessage(message, [messageChannel.port2]);
    });
  }
  
  /**
   * Skip waiting for new Service Worker
   */
  async skipWaiting() {
    if (this.swRegistration && this.swRegistration.waiting) {
      await this.postMessage({ type: 'SKIP_WAITING' });
    }
  }
  
  /**
   * Clear all caches
   */
  async clearCache() {
    try {
      await this.postMessage({ type: 'CLEAR_CACHE' });
      console.log('[SWM] All caches cleared');
      return true;
    } catch (error) {
      console.error('[SWM] Error clearing cache:', error);
      return false;
    }
  }
  
  /**
   * Cache data for offline use
   */
  async cacheData(data) {
    try {
      await this.postMessage({ 
        type: 'CACHE_DATA', 
        payload: data 
      });
      console.log('[SWM] Data cached for offline use');
      return true;
    } catch (error) {
      console.error('[SWM] Error caching data:', error);
      return false;
    }
  }
  
  /**
   * Queue action for background sync
   */
  async queueSyncAction(action) {
    try {
      await this.postMessage({ 
        type: 'SYNC_REQUEST', 
        payload: action 
      });
      console.log('[SWM] Action queued for sync:', action.type);
      return true;
    } catch (error) {
      console.error('[SWM] Error queuing sync action:', error);
      return false;
    }
  }
  
  /**
   * Trigger background sync
   */
  async triggerBackgroundSync() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        await this.swRegistration.sync.register('sync-offline-actions');
        console.log('[SWM] Background sync registered');
        return true;
      } catch (error) {
        console.error('[SWM] Background sync registration failed:', error);
        return false;
      }
    }
    return false;
  }
  
  /**
   * Setup push notifications
   */
  async setupPushNotifications() {
    try {
      console.log('[SWM] Setting up push notifications...');
      
      // Check if notifications are supported
      if (!('Notification' in window)) {
        console.warn('[SWM] Notifications not supported');
        return false;
      }
      
      // Check current permission
      if (Notification.permission === 'granted') {
        console.log('[SWM] Notification permission already granted');
        return true;
      } else if (Notification.permission === 'denied') {
        console.warn('[SWM] Notification permission denied');
        return false;
      }
      
      // Permission is 'default', don't request automatically
      console.log('[SWM] Notification permission not yet granted');
      return false;
      
    } catch (error) {
      console.error('[SWM] Error setting up push notifications:', error);
      return false;
    }
  }
  
  /**
   * Request notification permission
   */
  async requestNotificationPermission() {
    try {
      if (!('Notification' in window)) {
        throw new Error('Notifications not supported');
      }
      
      const permission = await Notification.requestPermission();
      console.log('[SWM] Notification permission:', permission);
      
      if (permission === 'granted') {
        // Setup push subscription
        return await this.subscribeToPush();
      }
      
      return { success: false, reason: 'permission_denied' };
    } catch (error) {
      console.error('[SWM] Error requesting notification permission:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Subscribe to push notifications
   */
  async subscribeToPush() {
    try {
      if (!this.swRegistration || !('PushManager' in window)) {
        throw new Error('Push notifications not supported');
      }
      
      // Get VAPID public key from server
      const response = await fetch('/api/v1/push/vapid-public-key');
      const { publicKey } = await response.json();
      
      // Subscribe to push
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey)
      });
      
      console.log('[SWM] Push subscription created');
      
      // Send subscription to server
      const subscribeResponse = await fetch('/api/v1/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ subscription })
      });
      
      const result = await subscribeResponse.json();
      
      if (result.success) {
        console.log('[SWM] Successfully subscribed to push notifications');
        return { success: true, subscription };
      } else {
        throw new Error(result.message || 'Failed to subscribe');
      }
      
    } catch (error) {
      console.error('[SWM] Error subscribing to push:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPush() {
    try {
      if (!this.swRegistration) {
        throw new Error('Service Worker not registered');
      }
      
      const subscription = await this.swRegistration.pushManager.getSubscription();
      
      if (subscription) {
        // Unsubscribe locally
        await subscription.unsubscribe();
        
        // Notify server
        await fetch('/api/v1/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        
        console.log('[SWM] Unsubscribed from push notifications');
        return { success: true };
      }
      
      return { success: true, message: 'No active subscription' };
      
    } catch (error) {
      console.error('[SWM] Error unsubscribing from push:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Send test notification
   */
  async sendTestNotification() {
    try {
      const response = await fetch('/api/v1/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      console.log('[SWM] Test notification result:', result);
      return result;
      
    } catch (error) {
      console.error('[SWM] Error sending test notification:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Convert VAPID public key
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\\-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }
  
  /**
   * Add event listener
   */
  addEventListener(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }
  
  /**
   * Remove event listener
   */
  removeEventListener(event, callback) {
    if (this.callbacks[event]) {
      const index = this.callbacks[event].indexOf(callback);
      if (index > -1) {
        this.callbacks[event].splice(index, 1);
      }
    }
  }
  
  /**
   * Notify callbacks
   */
  notifyCallbacks(event, data = {}) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[SWM] Error in ${event} callback:`, error);
        }
      });
    }
  }
  
  /**
   * Get network status
   */
  isOnline() {
    return navigator.onLine;
  }
  
  /**
   * Get update status
   */
  hasUpdate() {
    return this.updateAvailable;
  }
  
  /**
   * Get current version
   */
  getVersion() {
    return this.swVersion;
  }
  
  /**
   * Get registration
   */
  getRegistration() {
    return this.swRegistration;
  }
}

// Create global instance
const swManager = new ServiceWorkerManager();

// Export for use in other modules
export default swManager;