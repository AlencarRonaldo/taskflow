const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database.js');
const verifyToken = require('./auth');
const { 
  apiLimiter, 
  authLimiter, 
  strictLimiter,
  validationRules,
  handleValidationErrors
} = require('./apiMiddleware');

const JWT_SECRET = "super-secret-key-for-jwt";
const router = express.Router();

// =============================================================================
// AUTHENTICATION ROUTES
// =============================================================================

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login do usuário
 *     description: Autentica um usuário e retorna um token JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Credenciais inválidas
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/auth/login', authLimiter, validationRules.loginUser, handleValidationErrors, (req, res) => {
  const { email, password } = req.body; // Corrigido: usa email em vez de username
  
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => { // Corrigido: busca por email
    if (err) {
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
    
    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password_hash); // Corrigido: usa password_hash
    if (!isValidPassword) {
      return res.status(401).json({ error: "Senha inválida" });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email }, // Corrigido: usa id e email (igual ao userRoutes.js)
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Remove password from response
    const { password_hash: _, ...userResponse } = user; // Corrigido: remove password_hash
    
    res.json({ 
      token,
      user: userResponse,
      expiresIn: '24h'
    });
  });
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Registro de usuário
 *     description: Cria uma nova conta de usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: Usuário ou email já existe
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/auth/register', authLimiter, validationRules.registerUser, handleValidationErrors, async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    // Check if user already exists
    db.get("SELECT id FROM users WHERE username = ? OR email = ?", [username, email], async (err, existingUser) => {
      if (err) {
        return res.status(500).json({ error: "Erro interno do servidor" });
      }
      
      if (existingUser) {
        return res.status(409).json({ error: "Usuário ou email já existe" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const createdAt = new Date().toISOString();
      
      db.run(
        "INSERT INTO users (username, email, password, createdAt) VALUES (?, ?, ?, ?)",
        [username, email, hashedPassword, createdAt],
        function(err) {
          if (err) {
            return res.status(500).json({ error: "Erro ao criar usuário" });
          }
          
          const token = jwt.sign(
            { userId: this.lastID, username },
            JWT_SECRET,
            { expiresIn: '24h' }
          );
          
          res.status(201).json({
            token,
            user: {
              id: this.lastID,
              username,
              email,
              createdAt
            },
            expiresIn: '24h'
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Informações do usuário atual
 *     description: Retorna as informações do usuário autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informações do usuário
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/auth/me', apiLimiter, verifyToken, (req, res) => {
  db.get("SELECT id, username, email, createdAt FROM users WHERE id = ?", [req.userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
    
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    
    res.json(user);
  });
});

// =============================================================================
// BOARDS ROUTES
// =============================================================================

/**
 * @swagger
 * /api/v1/boards:
 *   get:
 *     tags: [Boards]
 *     summary: Lista todos os quadros do usuário
 *     description: Retorna todos os quadros pertencentes ao usuário autenticado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Número de itens por página
 *     responses:
 *       200:
 *         description: Lista de quadros
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 boards:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Board'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/v1/boards', apiLimiter, verifyToken, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  
  // Get total count
  db.get("SELECT COUNT(*) as total FROM boards WHERE userId = ?", [req.userId], (err, countResult) => {
    if (err) {
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
    
    const total = countResult.total;
    const pages = Math.ceil(total / limit);
    
    // Get boards with pagination
    db.all(
      "SELECT * FROM boards WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?",
      [req.userId, limit, offset],
      (err, boards) => {
        if (err) {
          return res.status(500).json({ error: "Erro interno do servidor" });
        }
        
        res.json({
          boards,
          pagination: {
            page,
            limit,
            total,
            pages
          }
        });
      }
    );
  });
});

/**
 * @swagger
 * /api/v1/boards:
 *   post:
 *     tags: [Boards]
 *     summary: Cria um novo quadro
 *     description: Cria um novo quadro para o usuário autenticado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               background:
 *                 type: string
 *                 maxLength: 100
 *               isPublic:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Quadro criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Board'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/v1/boards', apiLimiter, verifyToken, validationRules.createBoard, handleValidationErrors, (req, res) => {
  const { name, description = '', background = '', isPublic = false } = req.body;
  const createdAt = new Date().toISOString();
  
  db.run(
    "INSERT INTO boards (name, description, userId, background, isPublic, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
    [name, description, req.userId, background, isPublic ? 1 : 0, createdAt],
    function(err) {
      if (err) {
        return res.status(500).json({ error: "Erro ao criar quadro" });
      }
      
      const board = {
        id: this.lastID,
        name,
        description,
        userId: req.userId,
        background,
        isPublic: isPublic ? 1 : 0,
        createdAt
      };
      
      res.status(201).json(board);
    }
  );
});

/**
 * @swagger
 * /api/v1/boards/{id}:
 *   get:
 *     tags: [Boards]
 *     summary: Busca um quadro específico
 *     description: Retorna os detalhes de um quadro específico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do quadro
 *     responses:
 *       200:
 *         description: Detalhes do quadro
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Board'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/v1/boards/:id', apiLimiter, verifyToken, (req, res) => {
  const boardId = parseInt(req.params.id);
  
  db.get(
    "SELECT * FROM boards WHERE id = ? AND (userId = ? OR isPublic = 1)",
    [boardId, req.userId],
    (err, board) => {
      if (err) {
        return res.status(500).json({ error: "Erro interno do servidor" });
      }
      
      if (!board) {
        return res.status(404).json({ error: "Quadro não encontrado" });
      }
      
      res.json(board);
    }
  );
});

/**
 * @swagger
 * /api/v1/boards/{id}:
 *   put:
 *     tags: [Boards]
 *     summary: Atualiza um quadro
 *     description: Atualiza as informações de um quadro específico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do quadro
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               background:
 *                 type: string
 *                 maxLength: 100
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Quadro atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Board'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/v1/boards/:id', apiLimiter, verifyToken, validationRules.updateBoard, handleValidationErrors, (req, res) => {
  const boardId = parseInt(req.params.id);
  const updates = req.body;
  
  // First check if board exists and user has permission
  db.get("SELECT * FROM boards WHERE id = ? AND userId = ?", [boardId, req.userId], (err, board) => {
    if (err) {
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
    
    if (!board) {
      return res.status(404).json({ error: "Quadro não encontrado ou sem permissão" });
    }
    
    const updatedAt = new Date().toISOString();
    const fields = [];
    const values = [];
    
    Object.keys(updates).forEach(key => {
      if (['name', 'description', 'background', 'isPublic'].includes(key)) {
        fields.push(`${key} = ?`);
        values.push(key === 'isPublic' ? (updates[key] ? 1 : 0) : updates[key]);
      }
    });
    
    if (fields.length === 0) {
      return res.status(400).json({ error: "Nenhum campo válido para atualizar" });
    }
    
    fields.push('updatedAt = ?');
    values.push(updatedAt, boardId);
    
    db.run(
      `UPDATE boards SET ${fields.join(', ')} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          return res.status(500).json({ error: "Erro ao atualizar quadro" });
        }
        
        // Return updated board
        db.get("SELECT * FROM boards WHERE id = ?", [boardId], (err, updatedBoard) => {
          if (err) {
            return res.status(500).json({ error: "Erro ao buscar quadro atualizado" });
          }
          
          res.json(updatedBoard);
        });
      }
    );
  });
});

/**
 * @swagger
 * /api/v1/boards/{id}:
 *   delete:
 *     tags: [Boards]
 *     summary: Exclui um quadro
 *     description: Remove um quadro e todos os seus dados relacionados
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do quadro
 *     responses:
 *       204:
 *         description: Quadro excluído com sucesso
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/v1/boards/:id', strictLimiter, verifyToken, (req, res) => {
  const boardId = parseInt(req.params.id);
  
  // Check if board exists and user has permission
  db.get("SELECT id FROM boards WHERE id = ? AND userId = ?", [boardId, req.userId], (err, board) => {
    if (err) {
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
    
    if (!board) {
      return res.status(404).json({ error: "Quadro não encontrado ou sem permissão" });
    }
    
    // Delete board and cascade related data
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      // Delete cards in columns of this board
      db.run(`
        DELETE FROM cards 
        WHERE columnId IN (SELECT id FROM columns WHERE boardId = ?)
      `, [boardId]);
      
      // Delete columns
      db.run("DELETE FROM columns WHERE boardId = ?", [boardId]);
      
      // Delete board
      db.run("DELETE FROM boards WHERE id = ?", [boardId], function(err) {
        if (err) {
          db.run("ROLLBACK");
          return res.status(500).json({ error: "Erro ao excluir quadro" });
        }
        
        db.run("COMMIT");
        res.status(204).send();
      });
    });
  });
});

// =============================================================================
// CARDS ROUTES
// =============================================================================

/**
 * @swagger
 * /api/v1/cards:
 *   get:
 *     tags: [Cards]
 *     summary: Lista cards do usuário
 *     description: Retorna cards filtrados por parâmetros
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: boardId
 *         schema:
 *           type: integer
 *         description: Filtrar por ID do quadro
 *       - in: query
 *         name: columnId
 *         schema:
 *           type: integer
 *         description: Filtrar por ID da coluna
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filtrar por prioridade
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Número de itens por página
 *     responses:
 *       200:
 *         description: Lista de cards
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cards:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Card'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/v1/cards', apiLimiter, verifyToken, (req, res) => {
  const { boardId, columnId, priority } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  
  let whereConditions = ["b.userId = ?"];
  let queryParams = [req.userId];
  
  if (boardId) {
    whereConditions.push("c.boardId = ?");
    queryParams.push(parseInt(boardId));
  }
  
  if (columnId) {
    whereConditions.push("cards.columnId = ?");
    queryParams.push(parseInt(columnId));
  }
  
  if (priority) {
    whereConditions.push("cards.priority = ?");
    queryParams.push(priority);
  }
  
  const whereClause = whereConditions.join(" AND ");
  
  // Get total count
  db.get(`
    SELECT COUNT(*) as total 
    FROM cards 
    JOIN columns c ON cards.columnId = c.id 
    JOIN boards b ON c.boardId = b.id 
    WHERE ${whereClause}
  `, queryParams, (err, countResult) => {
    if (err) {
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
    
    const total = countResult.total;
    const pages = Math.ceil(total / limit);
    
    // Get cards with pagination
    queryParams.push(limit, offset);
    db.all(`
      SELECT cards.*, c.name as columnName, b.name as boardName 
      FROM cards 
      JOIN columns c ON cards.columnId = c.id 
      JOIN boards b ON c.boardId = b.id 
      WHERE ${whereClause}
      ORDER BY cards.position ASC, cards.createdAt DESC
      LIMIT ? OFFSET ?
    `, queryParams, (err, cards) => {
      if (err) {
        return res.status(500).json({ error: "Erro interno do servidor" });
      }
      
      // Parse JSON fields
      const formattedCards = cards.map(card => ({
        ...card,
        tags: card.tags ? JSON.parse(card.tags) : [],
        assignees: card.assignees ? JSON.parse(card.assignees) : [],
        attachments: card.attachments ? JSON.parse(card.attachments) : []
      }));
      
      res.json({
        cards: formattedCards,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      });
    });
  });
});

/**
 * @swagger
 * /api/v1/cards:
 *   post:
 *     tags: [Cards]
 *     summary: Cria um novo card
 *     description: Cria um novo card na coluna especificada
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - columnId
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *               columnId:
 *                 type: integer
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               assignees:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       201:
 *         description: Card criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Card'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Coluna não encontrada
 */
router.post('/v1/cards', apiLimiter, verifyToken, validationRules.createCard, handleValidationErrors, (req, res) => {
  const { title, description = '', columnId, priority = 'medium', dueDate, tags = [], assignees = [] } = req.body;
  
  // Check if column exists and user has permission
  db.get(`
    SELECT c.id, c.boardId 
    FROM columns c 
    JOIN boards b ON c.boardId = b.id 
    WHERE c.id = ? AND b.userId = ?
  `, [columnId, req.userId], (err, column) => {
    if (err) {
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
    
    if (!column) {
      return res.status(404).json({ error: "Coluna não encontrada ou sem permissão" });
    }
    
    // Get next position in column
    db.get("SELECT MAX(position) as maxPosition FROM cards WHERE columnId = ?", [columnId], (err, positionResult) => {
      if (err) {
        return res.status(500).json({ error: "Erro interno do servidor" });
      }
      
      const position = (positionResult.maxPosition || 0) + 1;
      const createdAt = new Date().toISOString();
      
      db.run(`
        INSERT INTO cards (title, description, columnId, position, priority, dueDate, tags, assignees, createdAt) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        title, 
        description, 
        columnId, 
        position, 
        priority, 
        dueDate || null, 
        JSON.stringify(tags), 
        JSON.stringify(assignees), 
        createdAt
      ], function(err) {
        if (err) {
          return res.status(500).json({ error: "Erro ao criar card" });
        }
        
        const card = {
          id: this.lastID,
          title,
          description,
          columnId,
          position,
          priority,
          dueDate: dueDate || null,
          tags,
          assignees,
          attachments: [],
          createdAt,
          updatedAt: createdAt
        };
        
        res.status(201).json(card);
      });
    });
  });
});

// Continue with more routes...
// [The file would continue with remaining CRUD operations for cards, columns, analytics, webhooks, etc.]

module.exports = router;