# ⚙️ GUIA DO ESPECIALISTA BACKEND

## 📋 RESPONSABILIDADES

### **Core Responsibilities**
- Implementar APIs RESTful robustas
- Gerenciar banco de dados e migrations
- Implementar autenticação e autorização
- Garantir segurança e performance

---

## 🛠️ TECNOLOGIAS PRINCIPAIS

### **Node.js Ecosystem**
```javascript
// Dependências principais
"express": "^4.18.2",
"cors": "^2.8.5",
"helmet": "^6.0.1",
"express-rate-limit": "^6.7.0",
"express-validator": "^6.14.3"
```

### **Database & ORM**
```javascript
// Banco de dados
"sqlite3": "^5.1.6",
"better-sqlite3": "^8.7.0",
"knex": "^2.4.2"
```

### **Authentication & Security**
```javascript
// Segurança
"jsonwebtoken": "^9.0.0",
"bcryptjs": "^2.4.3",
"express-session": "^1.17.3",
"express-mongo-sanitize": "^2.2.0"
```

---

## 🎯 TAREFAS ESPECÍFICAS

### **1. Correções de API**

#### **Problema Atual: Endpoints Duplicados**
```javascript
// ❌ Problema: Endpoints duplicados após module.exports
module.exports = router;

// Update comment content
router.put('/comments/:id', verifyToken, async (req, res) => {
  // Duplicado!
});
```

#### **Solução Implementada**
```javascript
// ✅ Solução: Endpoints organizados antes do module.exports
// Create a new comment
router.post('/cards/:id/comments', verifyToken, async (req, res) => {
  try {
    const cardId = req.params.id;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const card = await get('SELECT ca.id FROM cards ca JOIN columns co ON ca.column_id = co.id JOIN boards b ON co.board_id = b.id WHERE ca.id = ? AND b.user_id_creator = ?', [cardId, userId]);
    if (!card) {
      return res.status(404).json({ error: 'Card not found or not authorized' });
    }

    const result = await run('INSERT INTO comments (content, card_id, user_id_author) VALUES (?, ?, ?)', [content, cardId, userId]);
    res.status(201).json({ message: 'success', data: { id: result.id, content, card_id: cardId, user_id_author: userId } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

### **2. Validação de Dados Robusta**

#### **Middleware de Validação**
```javascript
const { body, validationResult } = require('express-validator');

// Validação para criação de board
const validateBoard = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters')
    .escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }
    next();
  }
];

// Uso no endpoint
router.post('/boards', verifyToken, validateBoard, async (req, res) => {
  // Endpoint logic
});
```

#### **Validação para Cards**
```javascript
const validateCard = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('column_id')
    .isInt({ min: 1 })
    .withMessage('Column ID must be a positive integer')
];

router.post('/cards', verifyToken, validateCard, async (req, res) => {
  // Endpoint logic
});
```

### **3. Tratamento de Erros Padronizado**

#### **Error Handler Middleware**
```javascript
// errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Erro de validação
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.details
    });
  }

  // Erro de banco de dados
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({
      error: 'Database Constraint Error',
      message: 'Resource already exists or violates constraints'
    });
  }

  // Erro de autenticação
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid token'
    });
  }

  // Erro genérico
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};

module.exports = errorHandler;
```

#### **Uso no App Principal**
```javascript
// index.js
const errorHandler = require('./middleware/errorHandler');

// Middleware de erro deve ser o último
app.use(errorHandler);
```

### **4. Rate Limiting**

#### **Configuração de Rate Limiting**
```javascript
const rateLimit = require('express-rate-limit');

// Rate limiting para autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas por IP
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again in 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting geral
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: {
    error: 'Too many requests',
    message: 'Please try again later'
  }
});

// Aplicar rate limiting
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api', generalLimiter);
```

### **5. Logging Estruturado**

#### **Configuração de Logging**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'kanban-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

#### **Middleware de Logging**
```javascript
const logger = require('./utils/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
};

module.exports = requestLogger;
```

---

## 🗄️ DATABASE MANAGEMENT

### **1. Migrations**

#### **Sistema de Migrations**
```javascript
// migrations/001_create_tables.js
const { run } = require('../database');

async function up() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      user_id_creator INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id_creator) REFERENCES users (id)
    )
  `);

  // Adicionar índices para performance
  await run('CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id_creator)');
  await run('CREATE INDEX IF NOT EXISTS idx_columns_board_id ON columns(board_id)');
  await run('CREATE INDEX IF NOT EXISTS idx_cards_column_id ON cards(column_id)');
  await run('CREATE INDEX IF NOT EXISTS idx_comments_card_id ON comments(card_id)');
}

async function down() {
  await run('DROP TABLE IF EXISTS comments');
  await run('DROP TABLE IF EXISTS cards');
  await run('DROP TABLE IF EXISTS columns');
  await run('DROP TABLE IF EXISTS boards');
  await run('DROP TABLE IF EXISTS users');
}

module.exports = { up, down };
```

#### **Migration Runner**
```javascript
// utils/migrate.js
const { run, get } = require('../database');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  // Criar tabela de migrations se não existir
  await run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Buscar migrations executadas
  const executedMigrations = await get('SELECT name FROM migrations');
  const executedNames = executedMigrations.map(m => m.name);

  // Buscar arquivos de migration
  const migrationFiles = fs.readdirSync('./migrations')
    .filter(file => file.endsWith('.js'))
    .sort();

  for (const file of migrationFiles) {
    if (!executedNames.includes(file)) {
      console.log(`Running migration: ${file}`);
      const migration = require(`../migrations/${file}`);
      await migration.up();
      await run('INSERT INTO migrations (name) VALUES (?)', [file]);
      console.log(`Migration ${file} completed`);
    }
  }
}

module.exports = { runMigrations };
```

### **2. Database Optimization**

#### **Query Optimization**
```javascript
// Otimizar queries com joins
const getBoardWithDetails = async (boardId, userId) => {
  const query = `
    SELECT 
      b.id, b.title, b.created_at,
      c.id as column_id, c.title as column_title, c.order_index,
      card.id as card_id, card.title as card_title, 
      card.description, card.order_index as card_order, card.status,
      comment.id as comment_id, comment.content, comment.timestamp
    FROM boards b
    LEFT JOIN columns c ON b.id = c.board_id
    LEFT JOIN cards card ON c.id = card.column_id
    LEFT JOIN comments comment ON card.id = comment.card_id
    WHERE b.id = ? AND b.user_id_creator = ?
    ORDER BY c.order_index, card.order_index, comment.timestamp
  `;
  
  return await all(query, [boardId, userId]);
};
```

#### **Connection Pooling**
```javascript
// database.js otimizado
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
    this.connectionPool = [];
    this.maxConnections = 10;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(
        path.join(__dirname, 'db.sqlite'),
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Connected to SQLite database');
            this.initializeDatabase();
            resolve();
          }
        }
      );
    });
  }

  async initializeDatabase() {
    // Executar migrations
    const { runMigrations } = require('./utils/migrate');
    await runMigrations();
  }

  // Métodos otimizados
  async run(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  async all(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

module.exports = new Database();
```

---

## 🔐 SECURITY IMPLEMENTATION

### **1. Input Sanitization**

#### **Sanitização de Dados**
```javascript
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');

// Middleware de sanitização
app.use(mongoSanitize());

// Função de sanitização customizada
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return xss(input.trim());
  }
  return input;
};

// Aplicar em todos os inputs
const sanitizeRequestBody = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  next();
};

const sanitizeObject = (obj) => {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeInput(value);
  }
  return sanitized;
};
```

### **2. CORS Configuration**

#### **Configuração Segura de CORS**
```javascript
const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sem origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://yourdomain.com'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### **3. Helmet Security**

#### **Configuração de Segurança**
```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## 📊 MONITORING & LOGGING

### **1. Health Check Endpoint**

#### **Endpoint de Saúde**
```javascript
// health.js
const healthCheck = async (req, res) => {
  try {
    // Verificar conexão com banco
    await db.get('SELECT 1');
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = { healthCheck };
```

### **2. Performance Monitoring**

#### **Middleware de Performance**
```javascript
const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log queries lentas
    if (duration > 1000) {
      logger.warn('Slow query detected', {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Métricas de performance
    if (req.url.includes('/api/')) {
      logger.info('API Performance', {
        endpoint: req.url,
        method: req.method,
        duration: `${duration}ms`,
        status: res.statusCode
      });
    }
  });
  
  next();
};

app.use(performanceMonitor);
```

---

## 🚀 DEPLOYMENT

### **1. Environment Configuration**

#### **Configuração de Ambiente**
```javascript
// config/index.js
const config = {
  development: {
    port: process.env.PORT || 8000,
    database: {
      filename: './db.sqlite'
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'dev-secret-key',
      expiresIn: '24h'
    },
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:5173']
    }
  },
  production: {
    port: process.env.PORT || 8000,
    database: {
      filename: process.env.DATABASE_URL || './db.sqlite'
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: '1h'
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || []
    }
  }
};

module.exports = config[process.env.NODE_ENV || 'development'];
```

### **2. Docker Configuration**

#### **Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 8000

CMD ["npm", "start"]
```

#### **Docker Compose**
```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_URL=./db.sqlite
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api
    restart: unless-stopped
```

---

## 📈 PERFORMANCE TARGETS

### **Métricas de Performance**
- **Response Time**: < 200ms para 95% das requests
- **Throughput**: > 1000 requests/minuto
- **Memory Usage**: < 512MB
- **CPU Usage**: < 70%

### **Monitoring Tools**
```javascript
// Métricas customizadas
const metrics = {
  requestCount: 0,
  errorCount: 0,
  averageResponseTime: 0,
  startTime: Date.now()
};

const updateMetrics = (req, res, duration) => {
  metrics.requestCount++;
  if (res.statusCode >= 400) metrics.errorCount++;
  
  metrics.averageResponseTime = 
    (metrics.averageResponseTime + duration) / 2;
};

// Endpoint de métricas
app.get('/api/metrics', (req, res) => {
  res.json({
    ...metrics,
    uptime: Date.now() - metrics.startTime,
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  });
});
```

---

**Responsável**: Backend Specialist
**Última Atualização**: [Data atual]
**Próxima Revisão**: [Data + 1 semana]

