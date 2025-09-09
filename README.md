# 🎯 Sistema Kanban Organizer

> **Uma aplicação web completa de gerenciamento de tarefas estilo Trello, desenvolvida com React, Node.js e SQLite.**

[![Status](https://img.shields.io/badge/status-MVP%20Funcional-green.svg)](https://github.com/your-org/kanban-organizer)
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3.0-lightblue.svg)](https://sqlite.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)

## 📋 Visão Geral

O **Sistema Kanban Organizer** é uma aplicação web moderna que permite gerenciar projetos e tarefas através de um sistema de quadros (boards) com colunas e cartões, similar ao Trello. A aplicação oferece funcionalidades completas de drag & drop, comentários, autenticação e colaboração em tempo real.

### ✨ Funcionalidades Principais

- 🏠 **Gestão de Boards**: Criar, editar e gerenciar quadros de projeto
- 📋 **Colunas Personalizáveis**: Adicionar, editar e reordenar colunas
- 🎴 **Cartões Interativos**: Criar, editar e mover cartões entre colunas
- 🖱️ **Drag & Drop**: Interface intuitiva de arrastar e soltar
- 💬 **Sistema de Comentários**: Comentários em tempo real nos cartões
- 🔐 **Autenticação Segura**: Login e registro com JWT
- 📱 **Responsivo**: Interface adaptável para mobile e desktop
- ⚡ **Performance**: Otimizado para velocidade e eficiência

## 🚀 Início Rápido

### Pré-requisitos

- **Node.js** 18+ 
- **npm** 8+
- **Git**

### Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/your-org/kanban-organizer.git
cd kanban-organizer
```

2. **Execute o script de configuração**
```bash
chmod +x scripts/setup-dev.sh
./scripts/setup-dev.sh
```

3. **Inicie o ambiente de desenvolvimento**
```bash
./scripts/start-dev.sh
```

4. **Acesse a aplicação**
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8000
- **API**: http://localhost:8000/api

### Credenciais Padrão

- **Email**: user@example.com
- **Senha**: password123

## 🏗️ Arquitetura

### Stack Tecnológica

#### Frontend
- **React 18** - Biblioteca de interface
- **TypeScript** - Tipagem estática
- **React Bootstrap** - Componentes UI
- **@dnd-kit** - Drag & Drop
- **React Router** - Navegação
- **Axios** - Cliente HTTP

#### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **SQLite3** - Banco de dados
- **JWT** - Autenticação
- **bcryptjs** - Hash de senhas
- **CORS** - Cross-origin requests

#### DevOps
- **Docker** - Containerização
- **Nginx** - Proxy reverso
- **GitHub Actions** - CI/CD
- **Prometheus** - Monitoramento
- **Grafana** - Dashboards

### Estrutura do Projeto

```
kanban-organizer/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── pages/          # Páginas da aplicação
│   │   ├── context/        # Context API
│   │   ├── lib/            # Utilitários
│   │   └── types/          # Definições TypeScript
│   ├── public/             # Arquivos estáticos
│   └── package.json
├── server/                 # Backend Node.js
│   ├── routes/             # Rotas da API
│   ├── middleware/         # Middlewares
│   ├── utils/              # Utilitários
│   ├── data/               # Banco de dados
│   └── package.json
├── docs/                   # Documentação técnica
├── scripts/                # Scripts de automação
├── docker-compose.yml      # Orquestração de containers
└── README.md
```

## 📊 Modelo de Dados

### Entidades Principais

```sql
Users (Usuários)
├── id (PK)
├── email (UNIQUE)
├── password_hash
└── timestamps

Boards (Quadros)
├── id (PK)
├── title
├── user_id_creator (FK)
└── timestamps

Columns (Colunas)
├── id (PK)
├── title
├── board_id (FK)
├── order_index
└── timestamps

Cards (Cartões)
├── id (PK)
├── title
├── description
├── column_id (FK)
├── order_index
├── status
└── timestamps

Comments (Comentários)
├── id (PK)
├── content
├── card_id (FK)
├── user_id_author (FK)
└── timestamp
```

## 🔌 API Endpoints

### Autenticação
```http
POST /api/users/register    # Registrar usuário
POST /api/users/login       # Login
```

### Boards
```http
GET    /api/boards          # Listar boards
POST   /api/boards          # Criar board
GET    /api/boards/:id      # Obter board
PUT    /api/boards/:id      # Atualizar board
DELETE /api/boards/:id      # Excluir board
```

### Columns
```http
POST   /api/columns         # Criar coluna
PUT    /api/columns/:id     # Atualizar coluna
DELETE /api/columns/:id     # Excluir coluna
PUT    /api/columns/order   # Reordenar colunas
```

### Cards
```http
POST   /api/cards           # Criar card
PUT    /api/cards/:id       # Atualizar card
DELETE /api/cards/:id       # Excluir card
```

### Comments
```http
POST   /api/cards/:id/comments  # Criar comentário
PUT    /api/comments/:id        # Atualizar comentário
DELETE /api/comments/:id        # Excluir comentário
```

## 🎨 Interface do Usuário

### Dashboard
- Lista de boards do usuário
- Indicador de progresso (badge "Concluído")
- Botão para criar novo board

### Board View
- Colunas lado a lado (layout horizontal)
- Cartões empilhados verticalmente
- Drag & drop entre colunas
- Botões de ação (+ para adicionar, - para excluir)

### Card Modal
- Edição inline de título e descrição
- Sistema de comentários
- Histórico cronológico
- Botão de exclusão

## 🚀 Deploy

### Desenvolvimento
```bash
# Iniciar servidor
cd server && npm start

# Iniciar cliente
cd client && npm run dev
```

### Produção com Docker
```bash
# Build e execução
docker-compose up -d

# Verificar status
docker-compose ps
```

### Variáveis de Ambiente

#### Servidor (.env)
```bash
NODE_ENV=production
PORT=8000
JWT_SECRET=your-secret-key
DATABASE_URL=./data/db.sqlite
REDIS_URL=redis://redis:6379
```

#### Cliente (.env)
```bash
VITE_API_URL=https://api.yourdomain.com/api
VITE_APP_NAME=Kanban Organizer
VITE_APP_VERSION=1.0.0
```

## 🧪 Testes

### Executar Testes
```bash
# Testes do servidor
cd server && npm test

# Testes do cliente
cd client && npm test

# Testes de integração
npm run test:integration
```

### Cobertura de Testes
```bash
# Gerar relatório de cobertura
npm run test:coverage
```

## 📈 Performance

### Métricas Alvo
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3.5s
- **API Response Time**: < 200ms

### Monitoramento
- **Health Check**: `/api/health`
- **Métricas**: `/api/metrics`
- **Logs**: `./server/logs/`

## 🔒 Segurança

### Implementações
- **JWT Authentication** - Tokens seguros
- **Password Hashing** - bcrypt com salt
- **CORS Protection** - Controle de origem
- **Rate Limiting** - Proteção contra spam
- **Input Validation** - Sanitização de dados
- **Security Headers** - Helmet.js

### Boas Práticas
- Validação de entrada em todos os endpoints
- Sanitização de dados do usuário
- Logs de auditoria para ações sensíveis
- Backup automático do banco de dados

## 📚 Documentação

### Documentos Técnicos
- **[Plano de Implementação](IMPLEMENTATION_PLAN.md)** - Roadmap completo
- **[Guia Frontend](docs/FRONTEND_SPECIALIST_GUIDE.md)** - Especialista React
- **[Guia Backend](docs/BACKEND_SPECIALIST_GUIDE.md)** - Especialista Node.js
- **[Guia DevOps](docs/DEVOPS_SPECIALIST_GUIDE.md)** - Especialista Infraestrutura
- **[Documentação Técnica](docs/CONTEXT7_TECHNICAL_DOCUMENTATION.md)** - Context7

### Recursos Externos
- [React Documentation](https://reactjs.org/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [@dnd-kit Documentation](https://dndkit.com/)

## 🤝 Contribuição

### Como Contribuir
1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrões de Código
- **ESLint** - Linting JavaScript/TypeScript
- **Prettier** - Formatação de código
- **Conventional Commits** - Padrão de commits
- **Code Review** - Revisão obrigatória

### Workflow
```
main (production)
├── develop (staging)
│   ├── feature/board-management
│   ├── feature/drag-drop
│   └── feature/comments
└── hotfix/critical-bug
```

## 🐛 Troubleshooting

### Problemas Comuns

#### Drag & Drop Não Funciona
```typescript
// Verificar se SortableContext inclui todos os itens
<SortableContext items={board.columns.map(col => `column-${col.id}`)}>
  {board.columns.map(column => (
    <SortableColumn key={column.id} column={column} />
  ))}
</SortableContext>
```

#### Erro de Autenticação
```javascript
// Verificar formato do token
const token = req.headers['authorization']?.split(' ')[1];
if (!token) return res.status(403).json({ message: 'No token provided' });
```

#### Problema de Banco de Dados
```bash
# Verificar permissões do arquivo
ls -la server/data/db.sqlite

# Recriar banco se necessário
rm server/data/db.sqlite
npm run init-db
```

## 📊 Status do Projeto

### ✅ Implementado (MVP)
- [x] Autenticação (login/registro)
- [x] Gestão de boards
- [x] Gestão de colunas
- [x] Gestão de cartões
- [x] Drag & drop funcional
- [x] Sistema de comentários
- [x] Interface responsiva
- [x] API RESTful completa

### 🚧 Em Desenvolvimento
- [ ] Edição de título de board
- [ ] Exclusão de board
- [ ] Sistema de permissões
- [ ] Labels/etiquetas
- [ ] Checklists
- [ ] Datas de vencimento
- [ ] Anexos de arquivos

### 📋 Planejado
- [ ] Colaboração em tempo real
- [ ] Notificações push
- [ ] Integrações externas
- [ ] Analytics e relatórios
- [ ] Temas personalizados
- [ ] PWA (Progressive Web App)

## 📞 Suporte

### Contato
- **Email**: support@kanban-organizer.com
- **Issues**: [GitHub Issues](https://github.com/your-org/kanban-organizer/issues)
- **Discord**: [Servidor da Comunidade](https://discord.gg/kanban-organizer)

### FAQ
- **Como criar um novo board?** Clique em "Create New Board" no dashboard
- **Como mover cartões?** Arraste o cartão usando o ícone de grip (⋮⋮)
- **Como adicionar comentários?** Clique no cartão e use o campo de comentários
- **Como excluir uma coluna?** Clique no botão "-" no cabeçalho da coluna

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🙏 Agradecimentos

- **React Team** - Pela excelente biblioteca
- **Express.js Team** - Pelo framework robusto
- **@dnd-kit Team** - Pela implementação de drag & drop
- **Bootstrap Team** - Pelos componentes UI
- **SQLite Team** - Pelo banco de dados confiável

---

**Desenvolvido com ❤️ pela equipe Kanban Organizer**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/your-org/kanban-organizer)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/company/kanban-organizer)
[![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/kanban_organizer)

