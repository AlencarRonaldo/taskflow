const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');

// Rate limiting configuration
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100, message = 'Muitas requisições. Tente novamente mais tarde.') => {
  return rateLimit({
    windowMs, // 15 minutos por padrão
    max, // 100 requests por padrão
    message: {
      error: message,
      code: 429,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true, // Retorna rate limit info nos headers `RateLimit-*`
    legacyHeaders: false, // Desabilita headers `X-RateLimit-*`
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        code: 429,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    },
    skip: (req) => {
      // Pula rate limiting para requisições de health check
      return req.path === '/health' || req.path === '/api/health';
    }
  });
};

// Rate limiters específicos
const generalLimiter = createRateLimiter(15 * 60 * 1000, 100); // 100 req/15min
const authLimiter = createRateLimiter(15 * 60 * 1000, 20, 'Muitas tentativas de autenticação. Tente novamente em 15 minutos.'); // 20 req/15min para auth
const apiLimiter = createRateLimiter(1 * 60 * 1000, 100); // 100 req/min para API
const strictLimiter = createRateLimiter(5 * 60 * 1000, 10, 'Limite de requisições para operações críticas excedido.'); // 10 req/5min para operações críticas

// Security middleware
const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
});

// Logging middleware
const loggingMiddleware = morgan('combined', {
  skip: (req) => {
    // Pula logging para requisições de health check e assets estáticos
    return req.path === '/health' || 
           req.path === '/api/health' || 
           req.path.startsWith('/static/') ||
           req.path.startsWith('/assets/');
  }
});

// API versioning middleware - Versão corrigida e otimizada
const apiVersioning = (req, res, next) => {
  // SOLUÇÃO PERMANENTE: Sistema de versionamento inteligente
  
  // 1. ROTAS COMPLETAMENTE EXCLUÍDAS (nunca versionadas)
  const completelyExcludedRoutes = [
    '/health',            // Health check raiz
    '/api/health',        // Health check API
    '/api-docs',          // Documentação OpenAPI
    '/favicon.ico',       // Favicon
    '/static/',           // Arquivos estáticos
    '/assets/',           // Assets
    '/public/'            // Público
  ];
  
  // 2. ROTAS JÁ VERSIONADAS (não precisa modificar)
  const alreadyVersionedPattern = /^\/api\/v\d+\//;
  
  // 3. ROTAS ESPECÍFICAS DO SISTEMA (mantém como estão)
  const systemRoutes = [
    '/api/calendar',
    '/api/boards', 
    '/api/cards',
    '/api/columns',
    '/api/labels',
    '/api/comments',
    '/api/attachments',
    '/api/checklists',
    '/api/checklist-items',
    '/api/users',
    '/api/timeline',
    '/api/grid',
    '/api/search',
    '/api/automations',
    '/api/notifications',
    '/api/reports'
  ];
  
  // Verifica exclusão completa
  const isCompletelyExcluded = completelyExcludedRoutes.some(route => req.path.startsWith(route));
  
  // Verifica se já está versionado
  const isAlreadyVersioned = alreadyVersionedPattern.test(req.path);
  
  // Verifica se é rota do sistema
  const isSystemRoute = systemRoutes.some(route => req.path.startsWith(route));
  
  // DEBUG: Log detalhado apenas em desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔍 API Versioning Analysis:', {
      path: req.path,
      method: req.method,
      originalUrl: req.originalUrl,
      isCompletelyExcluded,
      isAlreadyVersioned,
      isSystemRoute
    });
  }
  
  // LÓGICA DE DECISÃO:
  if (isCompletelyExcluded) {
    // Rotas excluídas: passa direto sem modificar
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ EXCLUDED: ${req.path} - Passando sem versionamento`);
    }
  } else if (isAlreadyVersioned) {
    // Já versionado: passa direto
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ ALREADY VERSIONED: ${req.path} - Mantendo como está`);
    }
  } else if (isSystemRoute) {
    // Rotas do sistema: mantém como estão (não versiona automaticamente)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ SYSTEM ROUTE: ${req.path} - Mantendo rota original`);
    }
  } else if (req.path.startsWith('/api/') && !req.path.startsWith('/api/v')) {
    // Outras rotas API: aplica versionamento v1
    const originalUrl = req.url;
    req.url = req.url.replace('/api/', '/api/v1/');
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔄 VERSIONING APPLIED: ${originalUrl} → ${req.url}`);
    }
  }
  
  // Adiciona headers de versão para TODAS as rotas API (exceto excluídas completamente)
  if (req.path.startsWith('/api/') && !isCompletelyExcluded) {
    res.set('API-Version', '1.0.0');
    res.set('API-Supported-Versions', '1.0.0');
    res.set('API-Docs', '/api-docs');
  }
  
  next();
};

// Error handling middleware
const errorHandler = (error, req, res, next) => {
  console.error('API Error:', error);
  
  // Rate limit error
  if (error.status === 429) {
    return res.status(429).json({
      error: 'Muitas requisições',
      code: 429,
      retryAfter: error.retryAfter
    });
  }
  
  // Validation error
  if (error.name === 'ValidationError' || error.type === 'validation') {
    return res.status(400).json({
      error: 'Dados inválidos',
      code: 400,
      details: error.details || error.message
    });
  }
  
  // JWT error
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token inválido',
      code: 401
    });
  }
  
  // Token expired
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expirado',
      code: 401
    });
  }
  
  // Database error
  if (error.code && error.code.startsWith('SQLITE_')) {
    return res.status(500).json({
      error: 'Erro interno do servidor',
      code: 500
    });
  }
  
  // Generic error
  res.status(error.status || 500).json({
    error: error.message || 'Erro interno do servidor',
    code: error.status || 500
  });
};

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      code: 400,
      details: errors.array()
    });
  }
  next();
};

// Common validation rules
const validationRules = {
  // User validation
  registerUser: [
    body('username')
      .isLength({ min: 3, max: 30 })
      .withMessage('Username deve ter entre 3 e 30 caracteres')
      .isAlphanumeric()
      .withMessage('Username deve conter apenas letras e números'),
    body('email')
      .isEmail()
      .withMessage('Email inválido')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Senha deve ter pelo menos 6 caracteres')
  ],
  
  loginUser: [
    body('email')
      .isEmail()
      .withMessage('Email válido é obrigatório')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Senha é obrigatória')
  ],
  
  // Board validation
  createBoard: [
    body('name')
      .isLength({ min: 1, max: 100 })
      .withMessage('Nome do quadro deve ter entre 1 e 100 caracteres')
      .trim(),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Descrição deve ter no máximo 500 caracteres')
      .trim(),
    body('background')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Background deve ter no máximo 100 caracteres'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic deve ser boolean')
  ],
  
  updateBoard: [
    body('name')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Nome do quadro deve ter entre 1 e 100 caracteres')
      .trim(),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Descrição deve ter no máximo 500 caracteres')
      .trim(),
    body('background')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Background deve ter no máximo 100 caracteres'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic deve ser boolean')
  ],
  
  // Card validation
  createCard: [
    body('title')
      .isLength({ min: 1, max: 200 })
      .withMessage('Título deve ter entre 1 e 200 caracteres')
      .trim(),
    body('description')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Descrição deve ter no máximo 2000 caracteres')
      .trim(),
    body('columnId')
      .isInt({ min: 1 })
      .withMessage('Column ID deve ser um inteiro válido'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Prioridade deve ser: low, medium, high ou urgent'),
    body('dueDate')
      .optional()
      .isISO8601()
      .withMessage('Data de vencimento deve ser uma data válida'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags deve ser um array'),
    body('assignees')
      .optional()
      .isArray()
      .withMessage('Assignees deve ser um array')
  ],
  
  updateCard: [
    body('title')
      .optional()
      .isLength({ min: 1, max: 200 })
      .withMessage('Título deve ter entre 1 e 200 caracteres')
      .trim(),
    body('description')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Descrição deve ter no máximo 2000 caracteres')
      .trim(),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Prioridade deve ser: low, medium, high ou urgent'),
    body('dueDate')
      .optional()
      .isISO8601()
      .withMessage('Data de vencimento deve ser uma data válida'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags deve ser um array'),
    body('assignees')
      .optional()
      .isArray()
      .withMessage('Assignees deve ser um array')
  ],
  
  // Column validation
  createColumn: [
    body('name')
      .isLength({ min: 1, max: 50 })
      .withMessage('Nome da coluna deve ter entre 1 e 50 caracteres')
      .trim(),
    body('boardId')
      .isInt({ min: 1 })
      .withMessage('Board ID deve ser um inteiro válido'),
    body('position')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Posição deve ser um inteiro não negativo'),
    body('color')
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage('Cor deve ser um código hexadecimal válido')
  ],
  
  updateColumn: [
    body('name')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Nome da coluna deve ter entre 1 e 50 caracteres')
      .trim(),
    body('position')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Posição deve ser um inteiro não negativo'),
    body('color')
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage('Cor deve ser um código hexadecimal válido')
  ],
  
  // Webhook validation
  createWebhook: [
    body('url')
      .isURL()
      .withMessage('URL deve ser uma URL válida'),
    body('events')
      .isArray({ min: 1 })
      .withMessage('Events deve ser um array com pelo menos um evento'),
    body('active')
      .optional()
      .isBoolean()
      .withMessage('Active deve ser boolean')
  ]
};

// Health check middleware
const healthCheck = (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime()
  });
};

module.exports = {
  // Rate limiters
  generalLimiter,
  authLimiter,
  apiLimiter,
  strictLimiter,
  
  // Security & Logging
  securityMiddleware,
  loggingMiddleware,
  
  // API features
  apiVersioning,
  errorHandler,
  
  // Validation
  validationRules,
  handleValidationErrors,
  
  // Utilities
  healthCheck
};