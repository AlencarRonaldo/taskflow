/**
 * Offline Manager
 * Handles offline data storage, synchronization, and queue management using IndexedDB
 */

class OfflineManager {
  constructor() {
    this.dbName = 'taskflow-offline';
    this.dbVersion = 1;
    this.db = null;
    this.isOnline = navigator.onLine;
    this.syncQueue = [];
    this.syncInProgress = false;
    
    this.init();
  }
  
  /**
   * Initialize IndexedDB and setup event listeners
   */
  async init() {
    try {
      await this.openDatabase();
      this.setupNetworkListeners();
      this.setupPeriodicSync();
      
      // Process any pending sync queue on startup
      if (this.isOnline) {
        this.processSyncQueue();
      }
      
      console.log('[OfflineManager] Initialized successfully');
    } catch (error) {
      console.error('[OfflineManager] Initialization failed:', error);
    }
  }
  
  /**
   * Open IndexedDB database
   */
  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };
      
      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('[OfflineManager] Database opened successfully');
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        this.createObjectStores(db);
      };
    });
  }
  
  /**
   * Create IndexedDB object stores
   */
  createObjectStores(db) {
    // Store for cached API responses
    if (!db.objectStoreNames.contains('apiCache')) {
      const apiCacheStore = db.createObjectStore('apiCache', { keyPath: 'url' });
      apiCacheStore.createIndex('timestamp', 'timestamp', { unique: false });
      apiCacheStore.createIndex('method', 'method', { unique: false });
    }
    
    // Store for offline actions queue
    if (!db.objectStoreNames.contains('syncQueue')) {
      const syncQueueStore = db.createObjectStore('syncQueue', { 
        keyPath: 'id',
        autoIncrement: true 
      });
      syncQueueStore.createIndex('timestamp', 'timestamp', { unique: false });
      syncQueueStore.createIndex('type', 'type', { unique: false });
      syncQueueStore.createIndex('status', 'status', { unique: false });
    }
    
    // Store for offline boards data
    if (!db.objectStoreNames.contains('boards')) {
      const boardsStore = db.createObjectStore('boards', { keyPath: 'id' });
      boardsStore.createIndex('userId', 'userId', { unique: false });
      boardsStore.createIndex('lastModified', 'lastModified', { unique: false });
    }
    
    // Store for offline cards data
    if (!db.objectStoreNames.contains('cards')) {
      const cardsStore = db.createObjectStore('cards', { keyPath: 'id' });
      cardsStore.createIndex('boardId', 'boardId', { unique: false });
      cardsStore.createIndex('columnId', 'columnId', { unique: false });
      cardsStore.createIndex('lastModified', 'lastModified', { unique: false });
    }
    
    // Store for offline columns data
    if (!db.objectStoreNames.contains('columns')) {
      const columnsStore = db.createObjectStore('columns', { keyPath: 'id' });
      columnsStore.createIndex('boardId', 'boardId', { unique: false });
      columnsStore.createIndex('lastModified', 'lastModified', { unique: false });
    }
    
    // Store for user preferences and settings
    if (!db.objectStoreNames.contains('settings')) {
      const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
    }
    
    console.log('[OfflineManager] Object stores created');
  }
  
  /**
   * Setup network event listeners
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('[OfflineManager] Network online');
      this.isOnline = true;
      this.processSyncQueue();
    });
    
    window.addEventListener('offline', () => {
      console.log('[OfflineManager] Network offline');
      this.isOnline = false;
    });
  }
  
  /**
   * Setup periodic sync (every 5 minutes when online)
   */
  setupPeriodicSync() {
    setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.processSyncQueue();
      }
    }, 5 * 60 * 1000); // 5 minutes
  }
  
  // =============================================================================
  // DATA STORAGE METHODS
  // =============================================================================
  
  /**
   * Store board data offline
   */
  async storeBoard(board) {
    try {
      const transaction = this.db.transaction(['boards'], 'readwrite');
      const store = transaction.objectStore('boards');
      
      const boardData = {
        ...board,
        lastModified: new Date().toISOString(),
        offline: true
      };
      
      await new Promise((resolve, reject) => {
        const request = store.put(boardData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      console.log('[OfflineManager] Board stored offline:', board.id);
      return true;
    } catch (error) {
      console.error('[OfflineManager] Error storing board:', error);
      return false;
    }
  }
  
  /**
   * Get board data from offline storage
   */
  async getBoard(boardId) {
    try {
      const transaction = this.db.transaction(['boards'], 'readonly');
      const store = transaction.objectStore('boards');
      
      return new Promise((resolve, reject) => {
        const request = store.get(boardId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[OfflineManager] Error getting board:', error);
      return null;
    }
  }
  
  /**
   * Store card data offline
   */
  async storeCard(card) {
    try {
      const transaction = this.db.transaction(['cards'], 'readwrite');
      const store = transaction.objectStore('cards');
      
      const cardData = {
        ...card,
        lastModified: new Date().toISOString(),
        offline: true
      };
      
      await new Promise((resolve, reject) => {
        const request = store.put(cardData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      console.log('[OfflineManager] Card stored offline:', card.id);
      return true;
    } catch (error) {
      console.error('[OfflineManager] Error storing card:', error);
      return false;
    }
  }
  
  /**
   * Get cards for a board from offline storage
   */
  async getBoardCards(boardId) {
    try {
      const transaction = this.db.transaction(['cards'], 'readonly');
      const store = transaction.objectStore('cards');
      const index = store.index('boardId');
      
      return new Promise((resolve, reject) => {
        const request = index.getAll(boardId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[OfflineManager] Error getting board cards:', error);
      return [];
    }
  }
  
  /**
   * Store column data offline
   */
  async storeColumn(column) {
    try {
      const transaction = this.db.transaction(['columns'], 'readwrite');
      const store = transaction.objectStore('columns');
      
      const columnData = {
        ...column,
        lastModified: new Date().toISOString(),
        offline: true
      };
      
      await new Promise((resolve, reject) => {
        const request = store.put(columnData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      console.log('[OfflineManager] Column stored offline:', column.id);
      return true;
    } catch (error) {
      console.error('[OfflineManager] Error storing column:', error);
      return false;
    }
  }
  
  /**
   * Get columns for a board from offline storage
   */
  async getBoardColumns(boardId) {
    try {
      const transaction = this.db.transaction(['columns'], 'readonly');
      const store = transaction.objectStore('columns');
      const index = store.index('boardId');
      
      return new Promise((resolve, reject) => {
        const request = index.getAll(boardId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[OfflineManager] Error getting board columns:', error);
      return [];
    }
  }
  
  /**
   * Cache API response
   */
  async cacheApiResponse(url, method, data, ttl = 3600000) { // 1 hour TTL
    try {
      const transaction = this.db.transaction(['apiCache'], 'readwrite');
      const store = transaction.objectStore('apiCache');
      
      const cacheData = {
        url: `${method}:${url}`,
        method,
        data,
        timestamp: Date.now(),
        expires: Date.now() + ttl
      };
      
      await new Promise((resolve, reject) => {
        const request = store.put(cacheData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      console.log('[OfflineManager] API response cached:', url);
      return true;
    } catch (error) {
      console.error('[OfflineManager] Error caching API response:', error);
      return false;
    }
  }
  
  /**
   * Get cached API response
   */
  async getCachedApiResponse(url, method) {
    try {
      const transaction = this.db.transaction(['apiCache'], 'readonly');
      const store = transaction.objectStore('apiCache');
      
      return new Promise((resolve, reject) => {
        const request = store.get(`${method}:${url}`);
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.expires > Date.now()) {
            resolve(result.data);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[OfflineManager] Error getting cached API response:', error);
      return null;
    }
  }
  
  // =============================================================================
  // SYNC QUEUE METHODS
  // =============================================================================
  
  /**
   * Add action to sync queue
   */
  async addToSyncQueue(action) {
    try {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      
      const queueItem = {
        ...action,
        timestamp: Date.now(),
        status: 'pending',
        attempts: 0,
        maxAttempts: action.maxAttempts || 3
      };
      
      await new Promise((resolve, reject) => {
        const request = store.add(queueItem);
        request.onsuccess = () => {
          console.log('[OfflineManager] Action added to sync queue:', action.type);
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      });
      
      // Try to process immediately if online
      if (this.isOnline) {
        this.processSyncQueue();
      }
      
      return true;
    } catch (error) {
      console.error('[OfflineManager] Error adding to sync queue:', error);
      return false;
    }
  }
  
  /**
   * Process sync queue
   */
  async processSyncQueue() {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }
    
    this.syncInProgress = true;
    console.log('[OfflineManager] Processing sync queue...');
    
    try {
      const transaction = this.db.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const index = store.index('status');
      
      const pendingItems = await new Promise((resolve, reject) => {
        const request = index.getAll('pending');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      console.log(`[OfflineManager] Found ${pendingItems.length} pending sync items`);
      
      for (const item of pendingItems) {
        await this.processSyncItem(item);
      }
      
    } catch (error) {
      console.error('[OfflineManager] Error processing sync queue:', error);
    } finally {
      this.syncInProgress = false;
    }
  }
  
  /**
   * Process individual sync item
   */
  async processSyncItem(item) {
    try {
      console.log(`[OfflineManager] Processing sync item:`, item.type);
      
      let success = false;
      
      switch (item.type) {
        case 'CREATE_BOARD':
          success = await this.syncCreateBoard(item);
          break;
        case 'UPDATE_BOARD':
          success = await this.syncUpdateBoard(item);
          break;
        case 'DELETE_BOARD':
          success = await this.syncDeleteBoard(item);
          break;
        case 'CREATE_CARD':
          success = await this.syncCreateCard(item);
          break;
        case 'UPDATE_CARD':
          success = await this.syncUpdateCard(item);
          break;
        case 'DELETE_CARD':
          success = await this.syncDeleteCard(item);
          break;
        case 'MOVE_CARD':
          success = await this.syncMoveCard(item);
          break;
        default:
          console.warn('[OfflineManager] Unknown sync item type:', item.type);
          success = true; // Remove unknown types
      }
      
      if (success) {
        await this.markSyncItemComplete(item.id);
      } else {
        await this.markSyncItemFailed(item.id);
      }
      
    } catch (error) {
      console.error('[OfflineManager] Error processing sync item:', error);
      await this.markSyncItemFailed(item.id);
    }
  }
  
  /**
   * Sync create board action
   */
  async syncCreateBoard(item) {
    try {
      const response = await fetch('/api/v1/boards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(item.data)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[OfflineManager] Board created successfully:', result.id);
        return true;
      } else {
        console.error('[OfflineManager] Failed to create board:', response.status);
        return false;
      }
    } catch (error) {
      console.error('[OfflineManager] Error syncing create board:', error);
      return false;
    }
  }
  
  /**
   * Sync update board action
   */
  async syncUpdateBoard(item) {
    try {
      const response = await fetch(`/api/v1/boards/${item.boardId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(item.data)
      });
      
      if (response.ok) {
        console.log('[OfflineManager] Board updated successfully:', item.boardId);
        return true;
      } else {
        console.error('[OfflineManager] Failed to update board:', response.status);
        return false;
      }
    } catch (error) {
      console.error('[OfflineManager] Error syncing update board:', error);
      return false;
    }
  }
  
  /**
   * Sync create card action
   */
  async syncCreateCard(item) {
    try {
      const response = await fetch('/api/v1/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(item.data)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[OfflineManager] Card created successfully:', result.id);
        return true;
      } else {
        console.error('[OfflineManager] Failed to create card:', response.status);
        return false;
      }
    } catch (error) {
      console.error('[OfflineManager] Error syncing create card:', error);
      return false;
    }
  }
  
  /**
   * Mark sync item as complete
   */
  async markSyncItemComplete(itemId) {
    try {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      
      await new Promise((resolve, reject) => {
        const deleteRequest = store.delete(itemId);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
      
      console.log('[OfflineManager] Sync item completed:', itemId);
    } catch (error) {
      console.error('[OfflineManager] Error marking sync item complete:', error);
    }
  }
  
  /**
   * Mark sync item as failed
   */
  async markSyncItemFailed(itemId) {
    try {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      
      // Get current item
      const item = await new Promise((resolve, reject) => {
        const request = store.get(itemId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      if (item) {
        item.attempts = (item.attempts || 0) + 1;
        
        if (item.attempts >= item.maxAttempts) {
          item.status = 'failed';
          console.log('[OfflineManager] Sync item failed permanently:', itemId);
        } else {
          item.status = 'pending';
          console.log(`[OfflineManager] Sync item failed, attempt ${item.attempts}/${item.maxAttempts}:`, itemId);
        }
        
        await new Promise((resolve, reject) => {
          const request = store.put(item);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
      
    } catch (error) {
      console.error('[OfflineManager] Error marking sync item failed:', error);
    }
  }
  
  // =============================================================================
  // UTILITY METHODS
  // =============================================================================
  
  /**
   * Clear old cached data
   */
  async clearOldCache(maxAge = 86400000) { // 24 hours
    try {
      const cutoff = Date.now() - maxAge;
      const transaction = this.db.transaction(['apiCache'], 'readwrite');
      const store = transaction.objectStore('apiCache');
      const index = store.index('timestamp');
      
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      console.log('[OfflineManager] Old cache data cleared');
      return true;
    } catch (error) {
      console.error('[OfflineManager] Error clearing old cache:', error);
      return false;
    }
  }
  
  /**
   * Get sync queue status
   */
  async getSyncQueueStatus() {
    try {
      const transaction = this.db.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      
      const all = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      const pending = all.filter(item => item.status === 'pending').length;
      const failed = all.filter(item => item.status === 'failed').length;
      
      return {
        total: all.length,
        pending,
        failed,
        isProcessing: this.syncInProgress
      };
    } catch (error) {
      console.error('[OfflineManager] Error getting sync queue status:', error);
      return { total: 0, pending: 0, failed: 0, isProcessing: false };
    }
  }
  
  /**
   * Clear all offline data
   */
  async clearAllData() {
    try {
      const stores = ['apiCache', 'syncQueue', 'boards', 'cards', 'columns'];
      const transaction = this.db.transaction(stores, 'readwrite');
      
      for (const storeName of stores) {
        const store = transaction.objectStore(storeName);
        await new Promise((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
      
      console.log('[OfflineManager] All offline data cleared');
      return true;
    } catch (error) {
      console.error('[OfflineManager] Error clearing all data:', error);
      return false;
    }
  }
  
  /**
   * Check if we're currently offline
   */
  isOffline() {
    return !this.isOnline;
  }
  
  /**
   * Get database instance
   */
  getDatabase() {
    return this.db;
  }
}

// Create global instance
const offlineManager = new OfflineManager();

// Export for use in other modules
export default offlineManager;