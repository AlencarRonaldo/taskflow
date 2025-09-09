const webpush = require('web-push');
const db = require('./database.js');

// VAPID keys configuration
// In production, these should be environment variables
const VAPID_PUBLIC_KEY = 'BIn0bUbc3vk9-iZDfWlDk5Z17kQaHH9vGEfOVYYzN__IqDOfKIxMVZN75KMVrkfNBnF0Qh3UjWx_umUKXHbmrko';
const VAPID_PRIVATE_KEY = 'U138Ldbgtbckc0B8R564JetcQCJoT_RsVnuxRSSvRN4';
const VAPID_EMAIL = 'mailto:support@taskflowpro.com';

// Configure web-push
webpush.setVapidDetails(
  VAPID_EMAIL,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/**
 * Initialize push subscriptions table
 */
const initPushSubscriptionsTable = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      p256dhKey TEXT NOT NULL,
      authKey TEXT NOT NULL,
      userAgent TEXT,
      active INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      lastUsed TEXT,
      UNIQUE(userId, endpoint),
      FOREIGN KEY (userId) REFERENCES users (id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating push_subscriptions table:', err);
    } else {
      console.log('Push subscriptions table ready');
    }
  });
};

/**
 * Initialize notification preferences table
 */
const initNotificationPreferencesTable = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL UNIQUE,
      cardCreated INTEGER DEFAULT 1,
      cardUpdated INTEGER DEFAULT 1,
      cardMoved INTEGER DEFAULT 1,
      cardDue INTEGER DEFAULT 1,
      boardShared INTEGER DEFAULT 1,
      mentions INTEGER DEFAULT 1,
      dailyDigest INTEGER DEFAULT 0,
      weeklyReport INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      FOREIGN KEY (userId) REFERENCES users (id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating notification_preferences table:', err);
    } else {
      console.log('Notification preferences table ready');
    }
  });
};

// Initialize tables on module load
initPushSubscriptionsTable();
initNotificationPreferencesTable();

/**
 * Subscribe user to push notifications
 */
const subscribeUser = (userId, subscription, userAgent = '') => {
  return new Promise((resolve, reject) => {
    const { endpoint, keys } = subscription;
    const createdAt = new Date().toISOString();
    
    if (!keys || !keys.p256dh || !keys.auth) {
      return reject(new Error('Invalid subscription keys'));
    }
    
    db.run(`
      INSERT OR REPLACE INTO push_subscriptions 
      (userId, endpoint, p256dhKey, authKey, userAgent, active, createdAt, lastUsed)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `, [
      userId,
      endpoint,
      keys.p256dh,
      keys.auth,
      userAgent,
      createdAt,
      createdAt
    ], function(err) {
      if (err) {
        console.error('Error subscribing user to push notifications:', err);
        reject(err);
      } else {
        console.log(`User ${userId} subscribed to push notifications`);
        
        // Initialize notification preferences if they don't exist
        initUserNotificationPreferences(userId).then(() => {
          resolve({
            id: this.lastID,
            success: true,
            message: 'Successfully subscribed to push notifications'
          });
        }).catch((prefErr) => {
          console.warn('Error initializing notification preferences:', prefErr);
          resolve({
            id: this.lastID,
            success: true,
            message: 'Subscribed to push notifications with default preferences'
          });
        });
      }
    });
  });
};

/**
 * Unsubscribe user from push notifications
 */
const unsubscribeUser = (userId, endpoint = null) => {
  return new Promise((resolve, reject) => {
    let query, params;
    
    if (endpoint) {
      query = 'UPDATE push_subscriptions SET active = 0 WHERE userId = ? AND endpoint = ?';
      params = [userId, endpoint];
    } else {
      query = 'UPDATE push_subscriptions SET active = 0 WHERE userId = ?';
      params = [userId];
    }
    
    db.run(query, params, function(err) {
      if (err) {
        console.error('Error unsubscribing user from push notifications:', err);
        reject(err);
      } else {
        console.log(`User ${userId} unsubscribed from push notifications`);
        resolve({
          success: true,
          message: 'Successfully unsubscribed from push notifications',
          affected: this.changes
        });
      }
    });
  });
};

/**
 * Initialize notification preferences for a user
 */
const initUserNotificationPreferences = (userId) => {
  return new Promise((resolve, reject) => {
    const createdAt = new Date().toISOString();
    
    db.run(`
      INSERT OR IGNORE INTO notification_preferences 
      (userId, createdAt) VALUES (?, ?)
    `, [userId, createdAt], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes > 0 ? 'created' : 'exists');
      }
    });
  });
};

/**
 * Update user notification preferences
 */
const updateNotificationPreferences = (userId, preferences) => {
  return new Promise((resolve, reject) => {
    const updatedAt = new Date().toISOString();
    const fields = [];
    const values = [];
    
    const allowedFields = [
      'cardCreated', 'cardUpdated', 'cardMoved', 'cardDue',
      'boardShared', 'mentions', 'dailyDigest', 'weeklyReport'
    ];
    
    Object.keys(preferences).forEach(key => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(preferences[key] ? 1 : 0);
      }
    });
    
    if (fields.length === 0) {
      return reject(new Error('No valid fields to update'));
    }
    
    fields.push('updatedAt = ?');
    values.push(updatedAt, userId);
    
    db.run(`
      UPDATE notification_preferences 
      SET ${fields.join(', ')} 
      WHERE userId = ?
    `, values, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({
          success: true,
          message: 'Notification preferences updated',
          affected: this.changes
        });
      }
    });
  });
};

/**
 * Get user notification preferences
 */
const getUserNotificationPreferences = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM notification_preferences 
      WHERE userId = ?
    `, [userId], (err, preferences) => {
      if (err) {
        reject(err);
      } else if (!preferences) {
        // Return default preferences
        resolve({
          userId,
          cardCreated: 1,
          cardUpdated: 1,
          cardMoved: 1,
          cardDue: 1,
          boardShared: 1,
          mentions: 1,
          dailyDigest: 0,
          weeklyReport: 0
        });
      } else {
        resolve({
          ...preferences,
          cardCreated: Boolean(preferences.cardCreated),
          cardUpdated: Boolean(preferences.cardUpdated),
          cardMoved: Boolean(preferences.cardMoved),
          cardDue: Boolean(preferences.cardDue),
          boardShared: Boolean(preferences.boardShared),
          mentions: Boolean(preferences.mentions),
          dailyDigest: Boolean(preferences.dailyDigest),
          weeklyReport: Boolean(preferences.weeklyReport)
        });
      }
    });
  });
};

/**
 * Send push notification to user
 */
const sendPushNotification = async (userId, notification, options = {}) => {
  try {
    // Get user's notification preferences
    const preferences = await getUserNotificationPreferences(userId);
    
    // Check if user has enabled this type of notification
    if (options.type && preferences[options.type] === false) {
      console.log(`User ${userId} has disabled ${options.type} notifications`);
      return { success: false, reason: 'disabled' };
    }
    
    // Get user's active subscriptions
    const subscriptions = await new Promise((resolve, reject) => {
      db.all(`
        SELECT endpoint, p256dhKey, authKey FROM push_subscriptions 
        WHERE userId = ? AND active = 1
      `, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (subscriptions.length === 0) {
      console.log(`No active push subscriptions for user ${userId}`);
      return { success: false, reason: 'no_subscriptions' };
    }
    
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/icons/icon-192x192.png',
      badge: notification.badge || '/icons/icon-96x96.png',
      tag: notification.tag || 'general',
      data: notification.data || {},
      actions: notification.actions || [],
      requireInteraction: notification.requireInteraction || false,
      timestamp: Date.now(),
      ...notification
    });
    
    const pushOptions = {
      vapidDetails: {
        subject: VAPID_EMAIL,
        publicKey: VAPID_PUBLIC_KEY,
        privateKey: VAPID_PRIVATE_KEY
      },
      TTL: options.ttl || 24 * 60 * 60, // 24 hours
      urgency: options.urgency || 'normal',
      headers: options.headers || {}
    };
    
    const results = [];
    
    // Send to all subscriptions
    for (const sub of subscriptions) {
      try {
        const subscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dhKey,
            auth: sub.authKey
          }
        };
        
        const result = await webpush.sendNotification(subscription, payload, pushOptions);
        results.push({ 
          endpoint: sub.endpoint, 
          success: true, 
          status: result.statusCode 
        });
        
        // Update last used timestamp
        db.run(`
          UPDATE push_subscriptions 
          SET lastUsed = ? 
          WHERE userId = ? AND endpoint = ?
        `, [new Date().toISOString(), userId, sub.endpoint]);
        
      } catch (error) {
        console.error('Error sending push notification:', error);
        results.push({ 
          endpoint: sub.endpoint, 
          success: false, 
          error: error.message 
        });
        
        // Handle expired subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          db.run(`
            UPDATE push_subscriptions 
            SET active = 0 
            WHERE userId = ? AND endpoint = ?
          `, [userId, sub.endpoint]);
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`Sent push notification to ${successCount}/${results.length} subscriptions for user ${userId}`);
    
    return {
      success: successCount > 0,
      results,
      sent: successCount,
      total: results.length
    };
    
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send bulk push notifications to multiple users
 */
const sendBulkPushNotification = async (userIds, notification, options = {}) => {
  const results = [];
  
  for (const userId of userIds) {
    try {
      const result = await sendPushNotification(userId, notification, options);
      results.push({ userId, ...result });
    } catch (error) {
      results.push({ 
        userId, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`Bulk notification: ${successCount}/${results.length} users notified`);
  
  return {
    success: successCount > 0,
    results,
    sent: successCount,
    total: results.length
  };
};

/**
 * Clean up expired subscriptions
 */
const cleanupExpiredSubscriptions = () => {
  return new Promise((resolve, reject) => {
    // Remove subscriptions not used in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    db.run(`
      DELETE FROM push_subscriptions 
      WHERE active = 0 OR lastUsed < ?
    `, [thirtyDaysAgo], function(err) {
      if (err) {
        reject(err);
      } else {
        console.log(`Cleaned up ${this.changes} expired push subscriptions`);
        resolve(this.changes);
      }
    });
  });
};

/**
 * Get push notification statistics
 */
const getPushStats = (userId = null) => {
  return new Promise((resolve, reject) => {
    let query, params;
    
    if (userId) {
      query = `
        SELECT 
          COUNT(*) as totalSubscriptions,
          COUNT(CASE WHEN active = 1 THEN 1 END) as activeSubscriptions,
          COUNT(CASE WHEN active = 0 THEN 1 END) as inactiveSubscriptions
        FROM push_subscriptions 
        WHERE userId = ?
      `;
      params = [userId];
    } else {
      query = `
        SELECT 
          COUNT(DISTINCT userId) as totalUsers,
          COUNT(*) as totalSubscriptions,
          COUNT(CASE WHEN active = 1 THEN 1 END) as activeSubscriptions,
          COUNT(CASE WHEN active = 0 THEN 1 END) as inactiveSubscriptions
        FROM push_subscriptions
      `;
      params = [];
    }
    
    db.get(query, params, (err, stats) => {
      if (err) {
        reject(err);
      } else {
        resolve(stats);
      }
    });
  });
};

// Notification templates
const NotificationTemplates = {
  cardCreated: (cardTitle, boardName) => ({
    title: 'Novo card criado',
    body: `"${cardTitle}" foi criado no quadro "${boardName}"`,
    tag: 'card-created',
    actions: [
      { action: 'view', title: 'Ver Card' },
      { action: 'dismiss', title: 'Dispensar' }
    ]
  }),
  
  cardUpdated: (cardTitle, updatedBy) => ({
    title: 'Card atualizado',
    body: `"${cardTitle}" foi atualizado por ${updatedBy}`,
    tag: 'card-updated',
    actions: [
      { action: 'view', title: 'Ver Mudanças' },
      { action: 'dismiss', title: 'Dispensar' }
    ]
  }),
  
  cardMoved: (cardTitle, fromColumn, toColumn) => ({
    title: 'Card movido',
    body: `"${cardTitle}" foi movido de "${fromColumn}" para "${toColumn}"`,
    tag: 'card-moved',
    actions: [
      { action: 'view', title: 'Ver Card' },
      { action: 'dismiss', title: 'Dispensar' }
    ]
  }),
  
  cardDue: (cardTitle, dueDate) => ({
    title: 'Card vencendo',
    body: `"${cardTitle}" vence em ${dueDate}`,
    tag: 'card-due',
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'Ver Card' },
      { action: 'snooze', title: 'Lembrar Depois' },
      { action: 'dismiss', title: 'Dispensar' }
    ]
  }),
  
  boardShared: (boardName, sharedBy) => ({
    title: 'Quadro compartilhado',
    body: `${sharedBy} compartilhou o quadro "${boardName}" com você`,
    tag: 'board-shared',
    actions: [
      { action: 'view', title: 'Ver Quadro' },
      { action: 'dismiss', title: 'Dispensar' }
    ]
  }),
  
  mention: (mentionedIn, mentionedBy) => ({
    title: 'Você foi mencionado',
    body: `${mentionedBy} mencionou você em "${mentionedIn}"`,
    tag: 'mention',
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'Ver' },
      { action: 'dismiss', title: 'Dispensar' }
    ]
  })
};

module.exports = {
  // VAPID configuration
  VAPID_PUBLIC_KEY,
  
  // Core functions
  subscribeUser,
  unsubscribeUser,
  sendPushNotification,
  sendBulkPushNotification,
  
  // Preferences
  initUserNotificationPreferences,
  updateNotificationPreferences,
  getUserNotificationPreferences,
  
  // Maintenance
  cleanupExpiredSubscriptions,
  getPushStats,
  
  // Templates
  NotificationTemplates
};