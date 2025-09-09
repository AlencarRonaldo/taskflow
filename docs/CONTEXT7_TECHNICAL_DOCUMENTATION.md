# 📚 CONTEXT7 - DOCUMENTAÇÃO TÉCNICA COMPLETA

## 🎯 VISÃO GERAL DO PROJETO

### **Sistema Kanban Organizer**
- **Tipo**: Aplicação Web Full-Stack
- **Arquitetura**: Monolito Modular (Frontend + Backend + Database)
- **Padrão**: MVC + RESTful API
- **Deployment**: Containerizado (Docker)

---

## 🏗️ ARQUITETURA DO SISTEMA

### **Diagrama de Arquitetura**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (SQLite)      │
│                 │    │                 │    │                 │
│ • Components    │    │ • API Routes    │    │ • Tables        │
│ • State Mgmt    │    │ • Middleware    │    │ • Relations     │
│ • UI/UX         │    │ • Auth          │    │ • Indexes       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx         │    │   Redis         │    │   File System   │
│   (Proxy)       │    │   (Cache)       │    │   (Storage)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Fluxo de Dados**
```
User Request → Nginx → API → Database
     ↓           ↓      ↓        ↓
User Response ← Nginx ← API ← Database
```

---

## 🗄️ MODELO DE DADOS

### **Entidades Principais**
```sql
-- Users (Usuários)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Boards (Quadros)
CREATE TABLE boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    user_id_creator INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id_creator) REFERENCES users (id)
);

-- Columns (Colunas/Listas)
CREATE TABLE columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    board_id INTEGER NOT NULL,
    order_index INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards (id)
);

-- Cards (Cartões/Tarefas)
CREATE TABLE cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    column_id INTEGER NOT NULL,
    order_index INTEGER NOT NULL,
    status TEXT DEFAULT 'todo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (column_id) REFERENCES columns (id)
);

-- Comments (Comentários)
CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    card_id INTEGER NOT NULL,
    user_id_author INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES cards (id),
    FOREIGN KEY (user_id_author) REFERENCES users (id)
);
```

### **Relacionamentos**
```
Users (1) ──→ (N) Boards
Boards (1) ──→ (N) Columns
Columns (1) ──→ (N) Cards
Cards (1) ──→ (N) Comments
Users (1) ──→ (N) Comments
```

### **Índices para Performance**
```sql
CREATE INDEX idx_boards_user_id ON boards(user_id_creator);
CREATE INDEX idx_columns_board_id ON columns(board_id);
CREATE INDEX idx_cards_column_id ON cards(column_id);
CREATE INDEX idx_comments_card_id ON comments(card_id);
CREATE INDEX idx_cards_status ON cards(status);
CREATE INDEX idx_comments_timestamp ON comments(timestamp);
```

---

## 🔌 API ENDPOINTS

### **Autenticação**
```http
POST /api/users/register
POST /api/users/login
```

### **Boards**
```http
GET    /api/boards              # Listar boards do usuário
POST   /api/boards              # Criar novo board
GET    /api/boards/:id          # Obter board específico
PUT    /api/boards/:id          # Atualizar board
DELETE /api/boards/:id          # Excluir board
```

### **Columns**
```http
POST   /api/columns             # Criar nova coluna
PUT    /api/columns/:id         # Atualizar coluna
DELETE /api/columns/:id         # Excluir coluna
PUT    /api/columns/order       # Reordenar colunas
```

### **Cards**
```http
POST   /api/cards               # Criar novo card
PUT    /api/cards/:id           # Atualizar card
DELETE /api/cards/:id           # Excluir card
```

### **Comments**
```http
POST   /api/cards/:id/comments  # Criar comentário
PUT    /api/comments/:id        # Atualizar comentário
DELETE /api/comments/:id        # Excluir comentário
```

---

## 🎨 FRONTEND ARCHITECTURE

### **Estrutura de Componentes**
```
src/
├── components/
│   ├── PrivateRoute.tsx        # Rota protegida
│   ├── CustomButton.tsx        # Botão reutilizável
│   ├── CustomModal.tsx         # Modal reutilizável
│   └── DragDropProvider.tsx    # Provider de drag & drop
├── pages/
│   ├── Login.tsx               # Página de login
│   ├── Register.tsx            # Página de registro
│   ├── Dashboard.tsx           # Dashboard principal
│   └── BoardPage.tsx           # Página do board
├── context/
│   └── AuthContext.tsx         # Context de autenticação
├── lib/
│   └── api.ts                  # Cliente API
└── types/
    └── index.ts                # Definições de tipos
```

### **State Management**
```typescript
// AuthContext - Gerenciamento de autenticação
interface AuthContextType {
  token: string | null;
  user: { id: number; email: string } | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

// Board State - Estado do board
interface BoardState {
  board: IBoard | null;
  loading: boolean;
  error: string | null;
  selectedCard: ICard | null;
  showModal: boolean;
}
```

### **Drag & Drop Implementation**
```typescript
// DndContext Configuration
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  <SortableContext 
    items={board.columns.map(col => `column-${col.id}`)}
    strategy={horizontalListSortingStrategy}
  >
    {board.columns.map(column => (
      <SortableColumn key={column.id} column={column} />
    ))}
  </SortableContext>
</DndContext>
```

---

## ⚙️ BACKEND ARCHITECTURE

### **Estrutura de Arquivos**
```
server/
├── index.js                    # Servidor principal
├── database.js                 # Configuração do banco
├── auth.js                     # Middleware de autenticação
├── userRoutes.js               # Rotas de usuário
├── boardRoutes.js              # Rotas de board/columns/cards
├── middleware/
│   ├── errorHandler.js         # Tratamento de erros
│   ├── validation.js           # Validação de dados
│   └── rateLimiter.js          # Rate limiting
├── utils/
│   ├── logger.js               # Sistema de logging
│   └── migrate.js               # Sistema de migrations
└── config/
    └── index.js                # Configurações
```

### **Middleware Stack**
```javascript
// Ordem dos middlewares
app.use(helmet());                    // Segurança
app.use(cors(corsOptions));           // CORS
app.use(express.json());              // Parse JSON
app.use(rateLimiter);                 // Rate limiting
app.use(requestLogger);               // Logging
app.use('/api/users', userRoutes);   // Rotas públicas
app.use('/api', verifyToken, boardRoutes); // Rotas protegidas
app.use(errorHandler);                // Tratamento de erros
```

### **Authentication Flow**
```
1. User Login → POST /api/users/login
2. Server validates credentials
3. Server generates JWT token
4. Client stores token in localStorage
5. Client sends token in Authorization header
6. Server validates token on protected routes
```

---

## 🔒 SEGURANÇA

### **Autenticação JWT**
```javascript
// Token Generation
const token = jwt.sign(
  { id: user.id, email: user.email },
  JWT_SECRET,
  { expiresIn: '1h' }
);

// Token Verification
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).json({ message: 'No token provided' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });
    req.user = decoded;
    next();
  });
};
```

### **Password Hashing**
```javascript
// Hash password
const hashedPassword = await bcrypt.hash(password, 8);

// Verify password
const isMatch = await bcrypt.compare(password, user.password_hash);
```

### **Security Headers**
```javascript
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

## 🚀 DEPLOYMENT

### **Docker Configuration**
```dockerfile
# Multi-stage build
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS server
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY server/ ./server/
EXPOSE 8000
CMD ["npm", "start"]
```

### **Environment Variables**
```bash
# Development
NODE_ENV=development
PORT=8000
JWT_SECRET=dev-secret-key
DATABASE_URL=./db.sqlite

# Production
NODE_ENV=production
PORT=8000
JWT_SECRET=your-production-secret
DATABASE_URL=./data/db.sqlite
REDIS_URL=redis://redis:6379
```

### **CI/CD Pipeline**
```yaml
# GitHub Actions
name: CI/CD
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: echo "Deploying..."
```

---

## 📊 MONITORING

### **Health Check Endpoint**
```javascript
app.get('/api/health', async (req, res) => {
  try {
    await db.get('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

### **Performance Metrics**
```javascript
// Request timing
const start = Date.now();
res.on('finish', () => {
  const duration = Date.now() - start;
  logger.info('Request completed', {
    method: req.method,
    url: req.url,
    duration: `${duration}ms`,
    status: res.statusCode
  });
});
```

---

## 🧪 TESTING

### **Unit Tests**
```javascript
// Backend tests
describe('Board Routes', () => {
  it('should create a new board', async () => {
    const response = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test Board' });
    
    expect(response.status).toBe(201);
    expect(response.body.data.title).toBe('Test Board');
  });
});
```

```typescript
// Frontend tests
describe('BoardPage', () => {
  it('renders board title', () => {
    render(<BoardPage />);
    expect(screen.getByText('Test Board')).toBeInTheDocument();
  });
});
```

### **Integration Tests**
```javascript
// API integration tests
describe('Board API Integration', () => {
  it('should create board with default columns', async () => {
    const boardResponse = await createBoard('Test Board');
    const boardId = boardResponse.data.id;
    
    const board = await getBoard(boardId);
    expect(board.columns).toHaveLength(3);
    expect(board.columns[0].title).toBe('A Fazer');
  });
});
```

---

## 🔧 DEVELOPMENT WORKFLOW

### **Git Workflow**
```
main (production)
├── develop (staging)
│   ├── feature/board-management
│   ├── feature/drag-drop
│   └── feature/comments
└── hotfix/critical-bug
```

### **Code Standards**
```javascript
// ESLint configuration
{
  "extends": ["eslint:recommended", "@typescript-eslint/recommended"],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error",
    "prefer-const": "error"
  }
}
```

### **Commit Convention**
```
feat: add drag and drop functionality
fix: resolve authentication token issue
docs: update API documentation
test: add unit tests for board routes
```

---

## 📈 PERFORMANCE OPTIMIZATION

### **Frontend Optimization**
```typescript
// Lazy loading
const BoardPage = lazy(() => import('./pages/BoardPage'));

// Memoization
const SortableCard = React.memo(({ card, onCardClick }) => {
  // Component logic
});

// Code splitting
const routes = [
  { path: '/', component: lazy(() => import('./pages/Dashboard')) },
  { path: '/boards/:id', component: lazy(() => import('./pages/BoardPage')) }
];
```

### **Backend Optimization**
```javascript
// Database indexing
CREATE INDEX idx_cards_column_id ON cards(column_id);
CREATE INDEX idx_comments_card_id ON comments(card_id);

// Query optimization
const getBoardWithDetails = async (boardId) => {
  const query = `
    SELECT b.*, c.*, card.*, comment.*
    FROM boards b
    LEFT JOIN columns c ON b.id = c.board_id
    LEFT JOIN cards card ON c.id = card.column_id
    LEFT JOIN comments comment ON card.id = comment.card_id
    WHERE b.id = ?
    ORDER BY c.order_index, card.order_index
  `;
  return await all(query, [boardId]);
};
```

---

## 🚨 TROUBLESHOOTING

### **Common Issues**

#### **Drag & Drop Not Working**
```typescript
// Check if SortableContext includes all items
<SortableContext items={board.columns.map(col => `column-${col.id}`)}>
  {board.columns.map(column => (
    <SortableColumn key={column.id} column={column} />
  ))}
</SortableContext>
```

#### **Authentication Issues**
```javascript
// Check token format
const token = req.headers['authorization']?.split(' ')[1];
if (!token) return res.status(403).json({ message: 'No token provided' });
```

#### **Database Connection Issues**
```javascript
// Check database file permissions
const db = new sqlite3.Database('./db.sqlite', (err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  }
});
```

---

## 📚 RECURSOS ADICIONAIS

### **Documentação Externa**
- [React Documentation](https://reactjs.org/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [@dnd-kit Documentation](https://dndkit.com/)

### **Ferramentas de Desenvolvimento**
- **Frontend**: React DevTools, Redux DevTools
- **Backend**: Postman, Insomnia
- **Database**: DB Browser for SQLite
- **Monitoring**: Prometheus, Grafana

### **Boas Práticas**
- **Code Review**: Sempre revisar código antes de merge
- **Testing**: Manter cobertura de testes > 80%
- **Documentation**: Documentar APIs e componentes
- **Security**: Validar inputs e sanitizar dados
- **Performance**: Monitorar métricas e otimizar queries

---

**Última Atualização**: [Data atual]
**Versão**: 1.0.0
**Mantenedor**: Equipe de Desenvolvimento

