const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');
const db = require('./database.js');
const verifyToken = require('./auth');
const { apiLimiter, strictLimiter, validationRules, handleValidationErrors } = require('./apiMiddleware');

const router = express.Router();

// Webhook event types
const WEBHOOK_EVENTS = [
  'board.created', 'board.updated', 'board.deleted',
  'card.created', 'card.updated', 'card.deleted', 'card.moved',
  'column.created', 'column.updated', 'column.deleted',
  'user.login', 'user.register'
];

/**
 * Initialize webhooks table
 */
const initWebhooksTable = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      secret TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      lastTriggered TEXT,
      deliveryCount INTEGER DEFAULT 0,
      failureCount INTEGER DEFAULT 0,
      FOREIGN KEY (userId) REFERENCES users (id)
    )
  `);
};

// Initialize on module load
initWebhooksTable();

/**
 * @swagger
 * /api/v1/webhooks:
 *   get:
 *     tags: [Webhooks]
 *     summary: Lista webhooks do usuário
 *     description: Retorna todos os webhooks configurados pelo usuário
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de webhooks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 webhooks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Webhook'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', apiLimiter, verifyToken, (req, res) => {
  db.all(
    "SELECT id, url, events, active, createdAt, updatedAt, lastTriggered, deliveryCount, failureCount FROM webhooks WHERE userId = ? ORDER BY createdAt DESC",
    [req.userId],
    (err, webhooks) => {
      if (err) {
        return res.status(500).json({ error: "Erro interno do servidor" });
      }
      
      const formattedWebhooks = webhooks.map(webhook => ({
        ...webhook,
        events: JSON.parse(webhook.events),
        active: Boolean(webhook.active)
      }));
      
      res.json({
        webhooks: formattedWebhooks,
        availableEvents: WEBHOOK_EVENTS
      });
    }
  );
});

/**
 * @swagger
 * /api/v1/webhooks:
 *   post:
 *     tags: [Webhooks]
 *     summary: Cria um novo webhook
 *     description: Registra um novo webhook para receber notificações de eventos
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - events
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: URL do endpoint que receberá os webhooks
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lista de eventos para monitorar
 *                 example: ["card.created", "card.updated"]
 *               active:
 *                 type: boolean
 *                 default: true
 *                 description: Se o webhook está ativo
 *               secret:
 *                 type: string
 *                 description: Chave secreta para validação (opcional)
 *     responses:
 *       201:
 *         description: Webhook criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Webhook'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', apiLimiter, verifyToken, validationRules.createWebhook, handleValidationErrors, (req, res) => {
  const { url, events, active = true, secret } = req.body;
  
  // Validate events
  const invalidEvents = events.filter(event => !WEBHOOK_EVENTS.includes(event));
  if (invalidEvents.length > 0) {
    return res.status(400).json({ 
      error: "Eventos inválidos", 
      details: { invalidEvents, availableEvents: WEBHOOK_EVENTS }
    });
  }
  
  const createdAt = new Date().toISOString();
  const webhookSecret = secret || crypto.randomBytes(32).toString('hex');
  
  db.run(
    "INSERT INTO webhooks (userId, url, events, active, secret, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
    [req.userId, url, JSON.stringify(events), active ? 1 : 0, webhookSecret, createdAt],
    function(err) {
      if (err) {
        return res.status(500).json({ error: "Erro ao criar webhook" });
      }
      
      const webhook = {
        id: this.lastID,
        url,
        events,
        active,
        secret: webhookSecret,
        createdAt,
        deliveryCount: 0,
        failureCount: 0
      };
      
      res.status(201).json(webhook);
    }
  );
});

/**
 * @swagger
 * /api/v1/webhooks/{id}:
 *   put:
 *     tags: [Webhooks]
 *     summary: Atualiza um webhook
 *     description: Atualiza as configurações de um webhook existente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do webhook
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *               active:
 *                 type: boolean
 *               secret:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Webhook'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:id', apiLimiter, verifyToken, (req, res) => {
  const webhookId = parseInt(req.params.id);
  const updates = req.body;
  
  // Check if webhook exists and user has permission
  db.get("SELECT * FROM webhooks WHERE id = ? AND userId = ?", [webhookId, req.userId], (err, webhook) => {
    if (err) {
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
    
    if (!webhook) {
      return res.status(404).json({ error: "Webhook não encontrado" });
    }
    
    // Validate events if provided
    if (updates.events) {
      const invalidEvents = updates.events.filter(event => !WEBHOOK_EVENTS.includes(event));
      if (invalidEvents.length > 0) {
        return res.status(400).json({ 
          error: "Eventos inválidos", 
          details: { invalidEvents, availableEvents: WEBHOOK_EVENTS }
        });
      }
    }
    
    const updatedAt = new Date().toISOString();
    const fields = [];
    const values = [];
    
    Object.keys(updates).forEach(key => {
      if (['url', 'secret'].includes(key)) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      } else if (key === 'events') {
        fields.push('events = ?');
        values.push(JSON.stringify(updates[key]));
      } else if (key === 'active') {
        fields.push('active = ?');
        values.push(updates[key] ? 1 : 0);
      }
    });
    
    if (fields.length === 0) {
      return res.status(400).json({ error: "Nenhum campo válido para atualizar" });
    }
    
    fields.push('updatedAt = ?');
    values.push(updatedAt, webhookId);
    
    db.run(
      `UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          return res.status(500).json({ error: "Erro ao atualizar webhook" });
        }
        
        // Return updated webhook
        db.get("SELECT id, url, events, active, createdAt, updatedAt, lastTriggered, deliveryCount, failureCount FROM webhooks WHERE id = ?", [webhookId], (err, updatedWebhook) => {
          if (err) {
            return res.status(500).json({ error: "Erro ao buscar webhook atualizado" });
          }
          
          res.json({
            ...updatedWebhook,
            events: JSON.parse(updatedWebhook.events),
            active: Boolean(updatedWebhook.active)
          });
        });
      }
    );
  });
});

/**
 * @swagger
 * /api/v1/webhooks/{id}:
 *   delete:
 *     tags: [Webhooks]
 *     summary: Exclui um webhook
 *     description: Remove um webhook existente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do webhook
 *     responses:
 *       204:
 *         description: Webhook excluído com sucesso
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', strictLimiter, verifyToken, (req, res) => {
  const webhookId = parseInt(req.params.id);
  
  // Check if webhook exists and user has permission
  db.get("SELECT id FROM webhooks WHERE id = ? AND userId = ?", [webhookId, req.userId], (err, webhook) => {
    if (err) {
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
    
    if (!webhook) {
      return res.status(404).json({ error: "Webhook não encontrado" });
    }
    
    db.run("DELETE FROM webhooks WHERE id = ?", [webhookId], function(err) {
      if (err) {
        return res.status(500).json({ error: "Erro ao excluir webhook" });
      }
      
      res.status(204).send();
    });
  });
});

/**
 * @swagger
 * /api/v1/webhooks/{id}/test:
 *   post:
 *     tags: [Webhooks]
 *     summary: Testa um webhook
 *     description: Envia um evento de teste para verificar se o webhook está funcionando
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do webhook
 *     responses:
 *       200:
 *         description: Teste enviado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 response:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/:id/test', apiLimiter, verifyToken, async (req, res) => {
  const webhookId = parseInt(req.params.id);
  
  try {
    // Get webhook
    const webhook = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM webhooks WHERE id = ? AND userId = ?", [webhookId, req.userId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    if (!webhook) {
      return res.status(404).json({ error: "Webhook não encontrado" });
    }
    
    // Create test payload
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'Este é um teste do seu webhook',
        webhookId: webhook.id,
        userId: req.userId
      }
    };
    
    // Generate signature
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(testPayload))
      .digest('hex');
    
    // Send webhook
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': 'webhook.test',
        'User-Agent': 'TaskFlow-Webhook/1.0'
      },
      body: JSON.stringify(testPayload),
      timeout: 10000 // 10 seconds timeout
    });
    
    const responseText = await response.text();
    
    res.json({
      success: response.ok,
      message: response.ok ? 'Webhook teste enviado com sucesso' : 'Webhook teste falhou',
      response: {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      }
    });
    
  } catch (error) {
    console.error('Webhook test error:', error);
    res.json({
      success: false,
      message: 'Erro ao testar webhook',
      error: error.message
    });
  }
});

// =============================================================================
// WEBHOOK DELIVERY FUNCTIONS
// =============================================================================

/**
 * Triggers a webhook for a specific event
 */
const triggerWebhook = async (userId, eventType, eventData) => {
  try {
    // Get all active webhooks for the user that listen to this event
    const webhooks = await new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM webhooks WHERE userId = ? AND active = 1",
        [userId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });
    
    const relevantWebhooks = webhooks.filter(webhook => {
      const events = JSON.parse(webhook.events);
      return events.includes(eventType);
    });
    
    // Send webhook to each relevant endpoint
    for (const webhook of relevantWebhooks) {
      await sendWebhook(webhook, eventType, eventData);
    }
    
  } catch (error) {
    console.error('Error triggering webhook:', error);
  }
};

/**
 * Sends a webhook payload to a specific endpoint
 */
const sendWebhook = async (webhook, eventType, eventData) => {
  try {
    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: eventData,
      webhookId: webhook.id
    };
    
    // Generate signature
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    // Send HTTP request
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': eventType,
        'User-Agent': 'TaskFlow-Webhook/1.0'
      },
      body: JSON.stringify(payload),
      timeout: 10000 // 10 seconds timeout
    });
    
    const now = new Date().toISOString();
    
    if (response.ok) {
      // Update successful delivery
      db.run(
        "UPDATE webhooks SET lastTriggered = ?, deliveryCount = deliveryCount + 1 WHERE id = ?",
        [now, webhook.id]
      );
    } else {
      // Update failure count
      db.run(
        "UPDATE webhooks SET failureCount = failureCount + 1 WHERE id = ?",
        [webhook.id]
      );
      
      // Disable webhook after too many failures
      if (webhook.failureCount >= 10) {
        db.run(
          "UPDATE webhooks SET active = 0 WHERE id = ?",
          [webhook.id]
        );
      }
    }
    
  } catch (error) {
    console.error('Error sending webhook:', error);
    
    // Update failure count
    db.run(
      "UPDATE webhooks SET failureCount = failureCount + 1 WHERE id = ?",
      [webhook.id]
    );
  }
};

// Export webhook functions for use in other parts of the app
router.triggerWebhook = triggerWebhook;
router.sendWebhook = sendWebhook;
router.WEBHOOK_EVENTS = WEBHOOK_EVENTS;

module.exports = router;