# 🚀 PLANEJAMENTO: SISTEMA MULTI-PROJETO TASKFLOW

## 📋 VISÃO GERAL

Transformar o TaskFlow de um sistema single-tenant (único workspace) para multi-tenant (múltiplos projetos), onde cada usuário pode criar e gerenciar múltiplos projetos isolados, cada um com seus próprios boards, calendários, tarefas e configurações.

## 🎯 OBJETIVOS

1. **Isolamento de Dados**: Cada projeto terá seus próprios dados completamente isolados
2. **Gestão Centralizada**: Dashboard principal para gerenciar todos os projetos
3. **Navegação Intuitiva**: Fácil troca entre projetos
4. **Escalabilidade**: Estrutura preparada para crescimento
5. **Manutenção da Funcionalidade**: Preservar todas as features atuais dentro de cada projeto

## 🏗️ ARQUITETURA PROPOSTA

### Hierarquia de Dados
```
Usuário
  └── Projetos
       └── Boards
            └── Colunas
                 └── Cards
       └── Calendário
            └── Eventos
       └── Configurações
       └── Membros da Equipe
```

## 📊 NOVO SCHEMA DE BANCO DE DADOS

### 1. Tabela de Projetos
```sql
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL,
    slug TEXT UNIQUE,
    logo TEXT,
    color TEXT DEFAULT '#007bff',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users (id)
);
```

### 2. Tabela de Membros do Projeto
```sql
CREATE TABLE project_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member', -- owner, admin, member, viewer
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id),
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(project_id, user_id)
);
```

### 3. Modificações nas Tabelas Existentes
- Adicionar `project_id` em todas as tabelas principais:
  - boards
  - calendar_events
  - automations
  - webhooks
  - activity_log

## 🎨 NOVOS COMPONENTES FRONTEND

### 1. **ProjectsPage.tsx** - Página Principal de Projetos
```typescript
interface Project {
    id: number;
    name: string;
    description: string;
    logo?: string;
    color: string;
    membersCount: number;
    boardsCount: number;
    tasksCount: number;
    lastActivity: Date;
}
```

**Funcionalidades:**
- Grid/Lista de projetos
- Criar novo projeto
- Buscar projetos
- Filtros (ativos, arquivados, favoritos)
- Quick stats de cada projeto

### 2. **ProjectDashboard.tsx** - Dashboard Individual do Projeto
- Overview do projeto específico
- Navegação para boards, calendário, etc
- Estatísticas do projeto
- Atividades recentes

### 3. **ProjectSwitcher.tsx** - Componente de Troca Rápida
- Dropdown no header
- Lista de projetos recentes
- Busca rápida
- Indicador do projeto atual

## 🔄 FLUXO DE NAVEGAÇÃO

### Fluxo Principal:
1. **Login** → **ProjectsPage** (lista de projetos)
2. **Selecionar Projeto** → **ProjectDashboard**
3. **ProjectDashboard** → **Boards/Calendar/etc** (dentro do contexto do projeto)

### URLs Propostas:
```
/projects                    - Lista todos os projetos
/projects/new               - Criar novo projeto
/projects/:projectId        - Dashboard do projeto
/projects/:projectId/boards - Boards do projeto
/projects/:projectId/boards/:boardId - Board específico
/projects/:projectId/calendar - Calendário do projeto
/projects/:projectId/settings - Configurações do projeto
```

## 🛠️ IMPLEMENTAÇÃO - FASES

### FASE 1: Backend Foundation (2-3 dias)
1. ✅ Criar tabelas `projects` e `project_members`
2. ✅ Adicionar `project_id` às tabelas existentes
3. ✅ Criar API endpoints para projetos:
   - GET /api/projects - listar projetos do usuário
   - POST /api/projects - criar projeto
   - GET /api/projects/:id - detalhes do projeto
   - PUT /api/projects/:id - atualizar projeto
   - DELETE /api/projects/:id - deletar projeto
4. ✅ Middleware de validação de acesso ao projeto
5. ✅ Migração de dados existentes para projeto default

### FASE 2: Frontend Base (2-3 dias)
1. ✅ Criar ProjectsPage com listagem
2. ✅ Modal de criação de projeto
3. ✅ Context API para projeto atual
4. ✅ ProjectSwitcher no header
5. ✅ Atualizar rotas com projectId

### FASE 3: Integração (2-3 dias)
1. ✅ Modificar todas as chamadas API para incluir projectId
2. ✅ Atualizar componentes existentes para usar contexto do projeto
3. ✅ Testes de isolamento de dados
4. ✅ Validações de permissão

### FASE 4: Features Avançadas (2-3 dias)
1. ✅ Sistema de convites para projetos
2. ✅ Gestão de membros e permissões
3. ✅ Templates de projeto
4. ✅ Duplicação de projetos
5. ✅ Arquivamento de projetos

### FASE 5: Polish & UX (1-2 dias)
1. ✅ Onboarding para novo projeto
2. ✅ Tour guiado
3. ✅ Atalhos de teclado
4. ✅ Notificações
5. ✅ Dashboard analytics

## 📝 MUDANÇAS NECESSÁRIAS NO CÓDIGO ATUAL

### Backend (server/)
1. **database.js**: Adicionar novas tabelas
2. **auth.js**: Incluir validação de projeto no middleware
3. **boardRoutes.js**: Filtrar por projectId
4. **calendarRoutes.js**: Filtrar por projectId
5. **Novo arquivo**: projectRoutes.js

### Frontend (client/src/)
1. **App.tsx**: Adicionar novas rotas de projeto
2. **context/**: Criar ProjectContext.tsx
3. **pages/**: Adicionar ProjectsPage.tsx, ProjectDashboard.tsx
4. **components/**: Adicionar ProjectSwitcher.tsx, ProjectCard.tsx
5. **lib/api.ts**: Adicionar funções para projetos

## 🎯 TEMPLATE DE PROJETO INICIAL

Quando um novo projeto for criado, automaticamente criar:
1. **3 Boards padrão**:
   - "Tarefas Gerais"
   - "Sprint Atual"
   - "Backlog"

2. **Colunas padrão em cada board**:
   - "A Fazer"
   - "Em Progresso"
   - "Em Revisão"
   - "Concluído"

3. **Cards de exemplo**:
   - Card de boas-vindas com instruções
   - Card de exemplo em cada coluna

4. **Configurações padrão**:
   - Notificações ativadas
   - Tema claro
   - Idioma português

## 🚀 BENEFÍCIOS DA IMPLEMENTAÇÃO

1. **Organização**: Separação clara entre diferentes projetos/clientes
2. **Colaboração**: Múltiplos usuários por projeto
3. **Escalabilidade**: Suporte para crescimento
4. **Profissionalismo**: Feature enterprise-ready
5. **Monetização**: Base para planos pagos por projeto

## 📈 MÉTRICAS DE SUCESSO

- Tempo de criação de projeto < 10 segundos
- Troca entre projetos < 2 segundos
- Zero vazamento de dados entre projetos
- 100% das features funcionando em contexto de projeto
- Interface intuitiva sem necessidade de tutorial

## 🔒 CONSIDERAÇÕES DE SEGURANÇA

1. **Isolamento de dados**: Queries sempre filtradas por project_id
2. **Validação de acesso**: Middleware verificando membership
3. **Rate limiting**: Limite de projetos por usuário
4. **Auditoria**: Log de todas ações em projetos
5. **Soft delete**: Projetos deletados mantidos por 30 dias

## 💡 PRÓXIMOS PASSOS

1. **Aprovação do planejamento**
2. **Criar branch feature/multi-project**
3. **Iniciar Fase 1 (Backend)**
4. **Testes unitários e integração**
5. **Deploy em staging**
6. **Testes com usuários**
7. **Deploy em produção**

## 🎨 MOCKUP DA INTERFACE

### Página de Projetos:
```
┌─────────────────────────────────────────┐
│  TaskFlow   [+] Novo Projeto   [User]   │
├─────────────────────────────────────────┤
│                                         │
│  Meus Projetos (5)          [Buscar]   │
│                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ Projeto A│ │ Projeto B│ │ Projeto C││
│  │ 12 boards│ │ 8 boards │ │ 15 boards││
│  │ 5 membros│ │ 3 membros│ │ 7 membros││
│  └──────────┘ └──────────┘ └──────────┘│
│                                         │
│  ┌──────────┐ ┌──────────┐             │
│  │ Projeto D│ │ Projeto E│             │
│  │ 3 boards │ │ 20 boards│             │
│  │ 2 membros│ │ 10 membros             │
│  └──────────┘ └──────────┘             │
└─────────────────────────────────────────┘
```

### Dashboard do Projeto:
```
┌─────────────────────────────────────────┐
│  TaskFlow > Projeto A    [Trocar] [User]│
├─────────────────────────────────────────┤
│                                         │
│  [Boards] [Calendário] [Timeline] [...]│
│                                         │
│  Visão Geral do Projeto A              │
│  ┌────────────────────────────────────┐│
│  │ • 45 tarefas ativas                ││
│  │ • 3 vencendo hoje                  ││
│  │ • 5 membros online                 ││
│  └────────────────────────────────────┘│
│                                         │
│  Boards Recentes:                      │
│  [Sprint 23] [Backlog] [Bugs]          │
│                                         │
└─────────────────────────────────────────┘
```

---

**Tempo Estimado Total**: 10-15 dias
**Complexidade**: Alta
**Impacto**: Transformacional

Este planejamento transforma o TaskFlow em uma solução enterprise-ready com suporte completo para múltiplos projetos isolados.