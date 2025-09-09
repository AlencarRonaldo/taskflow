const express = require('express');
const verifyToken = require('./auth');
const { apiLimiter, strictLimiter } = require('./apiMiddleware');
const {
  VAPID_PUBLIC_KEY,
  subscribeUser,
  unsubscribeUser,
  sendPushNotification,
  updateNotificationPreferences,
  getUserNotificationPreferences,
  getPushStats,
  NotificationTemplates
} = require('./pushNotifications');

const router = express.Router();

/**
 * @swagger
 * /api/v1/push/vapid-public-key:
 *   get:
 *     tags: [Push Notifications]
 *     summary: Get VAPID public key
 *     description: Retorna a chave pública VAPID necessária para subscrições push
 *     responses:
 *       200:
 *         description: Chave pública VAPID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 publicKey:
 *                   type: string
 *                   description: Chave pública VAPID em base64
 */
router.get('/vapid-public-key', apiLimiter, (req, res) => {
  res.json({
    publicKey: VAPID_PUBLIC_KEY
  });
});

/**
 * @swagger
 * /api/v1/push/subscribe:
 *   post:
 *     tags: [Push Notifications]
 *     summary: Subscribe to push notifications
 *     description: Registra o usuário para receber push notifications
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscription
 *             properties:
 *               subscription:
 *                 type: object
 *                 properties:
 *                   endpoint:
 *                     type: string
 *                     format: uri
 *                   keys:
 *                     type: object
 *                     properties:
 *                       p256dh:
 *                         type: string
 *                       auth:
 *                         type: string
 *     responses:
 *       201:
 *         description: Subscrição criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 id:
 *                   type: integer
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/subscribe', apiLimiter, verifyToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        error: 'Dados de subscrição inválidos',
        code: 400
      });
    }
    
    const userAgent = req.get('User-Agent') || '';
    const result = await subscribeUser(req.userId, subscription, userAgent);
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 500
    });
  }
});

/**
 * @swagger
 * /api/v1/push/unsubscribe:
 *   post:
 *     tags: [Push Notifications]
 *     summary: Unsubscribe from push notifications
 *     description: Remove a subscrição de push notifications do usuário
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               endpoint:
 *                 type: string
 *                 format: uri
 *                 description: Endpoint específico para remover (opcional)
 *     responses:
 *       200:
 *         description: Desinscrição realizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 affected:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/unsubscribe', apiLimiter, verifyToken, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const result = await unsubscribeUser(req.userId, endpoint);
    
    res.json(result);
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 500
    });
  }
});

/**
 * @swagger
 * /api/v1/push/preferences:
 *   get:
 *     tags: [Push Notifications]
 *     summary: Get notification preferences
 *     description: Retorna as preferências de notificação do usuário
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferências de notificação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: integer
 *                 cardCreated:
 *                   type: boolean
 *                 cardUpdated:
 *                   type: boolean
 *                 cardMoved:
 *                   type: boolean
 *                 cardDue:
 *                   type: boolean
 *                 boardShared:
 *                   type: boolean
 *                 mentions:
 *                   type: boolean
 *                 dailyDigest:
 *                   type: boolean
 *                 weeklyReport:
 *                   type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/preferences', apiLimiter, verifyToken, async (req, res) => {
  try {
    const preferences = await getUserNotificationPreferences(req.userId);
    res.json(preferences);
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 500
    });
  }
});

/**
 * @swagger
 * /api/v1/push/preferences:
 *   put:
 *     tags: [Push Notifications]
 *     summary: Update notification preferences
 *     description: Atualiza as preferências de notificação do usuário
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cardCreated:
 *                 type: boolean
 *               cardUpdated:
 *                 type: boolean
 *               cardMoved:
 *                 type: boolean
 *               cardDue:
 *                 type: boolean
 *               boardShared:
 *                 type: boolean
 *               mentions:
 *                 type: boolean
 *               dailyDigest:
 *                 type: boolean
 *               weeklyReport:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preferências atualizadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 affected:
 *                   type: integer
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/preferences', apiLimiter, verifyToken, async (req, res) => {
  try {
    const preferences = req.body;
    const result = await updateNotificationPreferences(req.userId, preferences);
    
    res.json(result);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    
    if (error.message === 'No valid fields to update') {
      return res.status(400).json({
        error: 'Nenhum campo válido para atualizar',
        code: 400
      });
    }
    
    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 500
    });
  }
});

/**
 * @swagger
 * /api/v1/push/test:
 *   post:
 *     tags: [Push Notifications]
 *     summary: Send test notification
 *     description: Envia uma notificação de teste para o usuário
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 default: 'Teste de Notificação'
 *               body:
 *                 type: string
 *                 default: 'Esta é uma notificação de teste do TaskFlow Pro'
 *               tag:
 *                 type: string
 *                 default: 'test'
 *     responses:
 *       200:
 *         description: Notificação de teste enviada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sent:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/test', apiLimiter, verifyToken, async (req, res) => {
  try {
    const { title = 'Teste de Notificação', body = 'Esta é uma notificação de teste do TaskFlow Pro', tag = 'test' } = req.body;
    
    const notification = {
      title,
      body,
      tag,
      data: {
        test: true,
        timestamp: Date.now()
      },
      actions: [
        { action: 'dismiss', title: 'OK' }
      ]
    };
    
    const result = await sendPushNotification(req.userId, notification, { type: null }); // Skip preference check for test
    res.json(result);
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 500
    });
  }
});

/**
 * @swagger
 * /api/v1/push/stats:
 *   get:
 *     tags: [Push Notifications]
 *     summary: Get push notification statistics
 *     description: Retorna estatísticas das push notifications do usuário
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas das push notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalSubscriptions:
 *                   type: integer
 *                 activeSubscriptions:
 *                   type: integer
 *                 inactiveSubscriptions:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/stats', apiLimiter, verifyToken, async (req, res) => {
  try {
    const stats = await getPushStats(req.userId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting push stats:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 500
    });
  }
});

/**
 * @swagger
 * /api/v1/push/send:
 *   post:
 *     tags: [Push Notifications]
 *     summary: Send custom notification (Admin only)
 *     description: Envia uma notificação personalizada para um usuário específico
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetUserId
 *               - notification
 *             properties:
 *               targetUserId:
 *                 type: integer
 *                 description: ID do usuário destinatário
 *               notification:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                   body:
 *                     type: string
 *                   tag:
 *                     type: string
 *                   data:
 *                     type: object
 *                   actions:
 *                     type: array
 *                     items:
 *                       type: object
 *               options:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                   ttl:
 *                     type: integer
 *                   urgency:
 *                     type: string
 *                     enum: [very-low, low, normal, high]
 *     responses:
 *       200:
 *         description: Notificação enviada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sent:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Sem permissão para enviar notificações
 */
router.post('/send', strictLimiter, verifyToken, async (req, res) => {
  try {
    const { targetUserId, notification, options = {} } = req.body;
    
    // In a real application, you would check if the user has admin privileges
    // For now, users can only send notifications to themselves
    if (targetUserId !== req.userId) {
      return res.status(403).json({
        error: 'Sem permissão para enviar notificações para outros usuários',
        code: 403
      });
    }
    
    if (!notification || !notification.title || !notification.body) {
      return res.status(400).json({
        error: 'Dados de notificação inválidos',
        code: 400
      });
    }
    
    const result = await sendPushNotification(targetUserId, notification, options);
    res.json(result);
  } catch (error) {
    console.error('Error sending custom notification:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 500
    });
  }
});

/**
 * Helper function to trigger notification based on system events
 */
const triggerSystemNotification = async (userId, eventType, eventData) => {
  try {
    let notification;
    let options = { type: eventType };
    
    switch (eventType) {
      case 'cardCreated':
        notification = NotificationTemplates.cardCreated(
          eventData.cardTitle,
          eventData.boardName
        );
        notification.data = {
          cardId: eventData.cardId,
          boardId: eventData.boardId,
          url: `/boards/${eventData.boardId}`
        };
        break;
        
      case 'cardUpdated':
        notification = NotificationTemplates.cardUpdated(
          eventData.cardTitle,
          eventData.updatedBy
        );
        notification.data = {
          cardId: eventData.cardId,
          boardId: eventData.boardId,
          url: `/boards/${eventData.boardId}`
        };
        break;
        
      case 'cardMoved':
        notification = NotificationTemplates.cardMoved(
          eventData.cardTitle,
          eventData.fromColumn,
          eventData.toColumn
        );
        notification.data = {
          cardId: eventData.cardId,
          boardId: eventData.boardId,
          url: `/boards/${eventData.boardId}`
        };
        break;
        
      case 'cardDue':
        notification = NotificationTemplates.cardDue(
          eventData.cardTitle,
          eventData.dueDate
        );
        notification.data = {
          cardId: eventData.cardId,
          boardId: eventData.boardId,
          url: `/boards/${eventData.boardId}`
        };
        options.urgency = 'high';
        break;
        
      case 'boardShared':
        notification = NotificationTemplates.boardShared(
          eventData.boardName,
          eventData.sharedBy
        );
        notification.data = {
          boardId: eventData.boardId,
          url: `/boards/${eventData.boardId}`
        };
        break;
        
      case 'mention':
        notification = NotificationTemplates.mention(
          eventData.mentionedIn,
          eventData.mentionedBy
        );
        notification.data = {
          cardId: eventData.cardId,
          boardId: eventData.boardId,
          url: `/boards/${eventData.boardId}`
        };
        options.urgency = 'high';
        break;
        
      default:
        console.warn('Unknown notification event type:', eventType);
        return { success: false, reason: 'unknown_event_type' };
    }
    
    return await sendPushNotification(userId, notification, options);
  } catch (error) {
    console.error('Error triggering system notification:', error);
    return { success: false, error: error.message };
  }
};

// Export the trigger function for use in other parts of the application
router.triggerSystemNotification = triggerSystemNotification;

module.exports = router;