# PRD Adaptado - Sistema de Colaboração em Projetos (Node.js/React)

## 1. VISÃO GERAL

### 1.1 Contexto
Este documento descreve a adaptação e implementação da funcionalidade de colaboração multi-usuário no SaaS de gerenciamento de projetos existente, que utiliza uma stack Node.js/Express no backend e React no frontend.

### 1.2 Objetivos
- Permitir que proprietários de projetos convidem outros usuários para colaborar com diferentes níveis de acesso.
- Garantir a integração com a arquitetura e tecnologias atuais do projeto.
- Manter a simplicidade e a consistência da experiência do usuário.
- Implementar um período de teste de 14 dias para novos usuários, com gerenciamento de acesso pós-teste.

### 1.3 Métricas de Sucesso
- 50% dos projetos com mais de 1 colaborador em 30 dias.
- 80% dos convites aceitos em 48 horas.
- Zero falhas de segurança relacionadas a permissões.
- Taxa de conversão de teste para pago de X%. (Definir X posteriormente)
- Y% de usuários ativos durante o período de teste. (Definir Y posteriormente)

---

## 2. FASE 1 - FUNDAÇÃO BACKEND (SEMANA 1)

**Responsável:** Agente Especialista em Backend

### 2.1 Estrutura de Dados
**Tarefa:** O **Agente de Banco de Dados** irá estender o schema do SQLite existente (`server/database.js`).

**Tabela `users` (Ajustada):**
Adicionar as colunas `trial_ends_at` (DATETIME) e `is_trial_active` (BOOLEAN, DEFAULT 1) à tabela `users`.
```sql
ALTER TABLE users ADD COLUMN trial_ends_at DATETIME;
ALTER TABLE users ADD COLUMN is_trial_active BOOLEAN DEFAULT 1;
```

**Tabela `project_members` (Ajustada):**
```sql
CREATE TABLE IF NOT EXISTS project_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'team_member', -- Simplificado para 'owner', 'project_manager', 'team_member', 'viewer'
    invited_by INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active', -- 'active', 'inactive'
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id),
    UNIQUE(project_id, user_id)
);
```

**Tabela `project_invites` (Nova):**
```sql
CREATE TABLE IF NOT EXISTS project_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    invited_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'cancelled'
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users (id)
);
```

### 2.2 Sistema de Permissões
**Tarefa:** O **Agente de Backend** irá implementar a lógica de permissões.

**Arquivo de Configuração de Permissões (Novo):** `server/permissions.js`
```javascript
const permissions = {
    owner: [ 'project:delete', 'project:edit', 'members:invite', 'members:remove', 'members:change_role', /* ...todas as outras */ ],
    project_manager: [ 'project:edit', 'members:invite', 'members:remove', /* ... */ ],
    team_member: [ 'cards:create', 'cards:edit', 'comments:create' ],
    viewer: [ 'project:view' ]
};

module.exports = permissions;
```

### 2.3 Middleware de Autorização
**Tarefa:** O **Agente de Backend** irá criar um novo middleware de autorização.

**Novo Middleware:** `server/middleware/checkProjectPermission.js`
```javascript
const { get } = require('../database');
const permissions = require('../permissions');

const checkProjectPermission = (permission) => async (req, res, next) => {
    const projectId = req.params.projectId; // ou de onde vier o ID do projeto
    const userId = req.user.id;

    // Verificar status do trial
    const user = await get('SELECT is_trial_active, trial_ends_at FROM users WHERE id = ?', [userId]);
    if (!user || !user.is_trial_active || (user.trial_ends_at && new Date(user.trial_ends_at) < new Date())) {
        return res.status(403).json({ error: 'Período de teste expirado ou acesso restrito. Por favor, assine para continuar.' });
    }

    const member = await get('SELECT role FROM project_members WHERE project_id = ? AND user_id = ? AND status = \'active\'', [projectId, userId]);

    if (!member || !permissions[member.role]?.includes(permission)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    next();
};

module.exports = checkProjectPermission;
```

### 2.4 Lógica de Registro de Usuário (Ajustada)
**Tarefa:** O **Agente de Backend** irá ajustar a lógica de registro de usuário para incluir o período de teste.

**Ajuste em `server/userRoutes.js` (ou módulo de registro):**
Ao criar um novo usuário, definir `trial_ends_at` para 14 dias a partir da data atual e `is_trial_active` como `TRUE`.
```javascript
// Exemplo de ajuste na rota /register
const trialEndsAt = new Date();
trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 dias de teste

const result = await run('INSERT INTO users (name, email, password_hash, trial_ends_at, is_trial_active) VALUES (?, ?, ?, ?, ?)', [name, email, hashedPassword, trialEndsAt.toISOString(), 1]);
```

### 2.5 Critérios de Aceite Fase 1
- [ ] Tabelas criadas e integradas no `database.js` (incluindo colunas de trial em `users`).
- [ ] Middleware de permissão bloqueia acessos não autorizados e usuários com trial expirado.
- [ ] Lógica de registro de usuário define corretamente o início e fim do período de teste.
- [ ] Testes unitários para a lógica de permissões e de trial.

---

## 3. FASE 2 - API CORE (SEMANA 2)

**Responsável:** Agente Especialista em Backend

### 3.1 Rotas da API
**Tarefa:** O **Agente de Backend** irá adicionar novas rotas em `server/projectRoutes.js` e, se necessário, novas rotas para gerenciamento de trial.

```javascript
// server/projectRoutes.js
const checkProjectPermission = require('../middleware/checkProjectPermission');

// ... outras rotas

// Rotas de Membros
router.get('/:projectId/members', checkProjectPermission('project:view'), projectController.getMembers);
router.put('/:projectId/members/:memberId', checkProjectPermission('members:change_role'), projectController.updateMemberRole);
router.delete('/:projectId/members/:memberId', checkProjectPermission('members:remove'), projectController.removeMember);

// Rotas de Convites
router.post('/:projectId/invites', checkProjectPermission('members:invite'), projectController.inviteMember);
router.post('/invites/:token/accept', projectController.acceptInvite);

// Nova rota para verificar status do trial (opcional, pode ser integrada em /users/me)
router.get('/users/me/trial-status', verifyToken, async (req, res) => {
    const user = await get('SELECT trial_ends_at, is_trial_active FROM users WHERE id = ?', [req.user.id]);
    res.json({ trial_ends_at: user.trial_ends_at, is_trial_active: user.is_trial_active });
});
```

### 3.2 Lógica de Negócio (Controllers)
**Tarefa:** O **Agente de Backend** irá implementar a lógica nos controllers.

- **`projectController.inviteMember`**: Gera um token, salva o convite no banco e envia um email (usando Nodemailer + um serviço como SendGrid).
- **`projectController.acceptInvite`**: Valida o token, cria um novo usuário se não existir, adiciona o usuário à tabela `project_members` e atualiza o status do convite.

### 3.3 Serviço de Email
**Tarefa:** O **Agente de Backend** irá configurar um serviço de email.

- **Configuração:** Criar um novo módulo `server/services/emailService.js` que usa Nodemailer para enviar o email de convite.

### 3.4 Gerenciamento do Período de Teste (Backend)
**Tarefa:** O **Agente de Backend** irá implementar um mecanismo para gerenciar o status do período de teste.

- **Job Diário (Cron Job):** Implementar um script ou função que seja executada diariamente (ex: via `node-cron` ou um serviço externo) para verificar usuários cujo `trial_ends_at` já passou e atualizar `is_trial_active` para `FALSE`.
```javascript
// Exemplo de pseudo-código para o cron job
// const cron = require('node-cron');
// cron.schedule('0 0 * * *', async () => { // Executa todo dia à meia-noite
//     await run('UPDATE users SET is_trial_active = 0 WHERE trial_ends_at < datetime(\'now\') AND is_trial_active = 1');
//     console.log('Trial statuses updated.');
// });
```

### 3.5 Critérios de Aceite Fase 2
- [ ] Endpoints da API para membros e convites funcionam conforme o esperado.
- [ ] Validações de dados de entrada estão implementadas.
- [ ] Emails de convite são enviados com sucesso.
- [ ] Convites podem ser aceitos, adicionando o usuário ao projeto.
- [ ] O cron job de gerenciamento de trial atualiza corretamente o status dos usuários.

---

## 4. FASE 3 - INTERFACE FRONTEND (SEMANAS 3-4)

**Responsável:** Agente Especialista em Frontend

### 4.1 Componentes React
**Tarefa:** O **Agente de Frontend** irá criar novos componentes React.

- **`pages/ProjectMembers.tsx`**: Página para listar e gerenciar membros do projeto.
- **`components/MemberCard.tsx`**: Componente para exibir as informações de um membro e permitir ações (mudar papel, remover).
- **`components/InviteModal.tsx`**: Modal para convidar novos membros por email.
- **`components/TrialStatusDisplay.tsx` (Novo):** Componente para exibir o status do período de teste (dias restantes, mensagem de expiração).

### 4.2 Gerenciamento de Estado
**Tarefa:** O **Agente de Frontend** irá gerenciar o estado relacionado aos membros e ao trial.

- **`context/ProjectMembersContext.tsx`**: Criar um novo contexto para buscar e gerenciar a lista de membros do projeto, similar ao `AuthContext`.
- **`AuthContext.tsx` (Ajustado):** O `AuthContext` deve ser capaz de armazenar e expor o status do trial do usuário logado.

### 4.3 Integração com API
**Tarefa:** O **Agente de Frontend** irá integrar os componentes com a API.

- Usar o `api` de `lib/api.ts` para fazer chamadas aos novos endpoints de membros e convites.
- Chamar o endpoint de `trial-status` para exibir o status do trial.

### 4.4 Página de Aceite de Convite
**Tarefa:** O **Agente de Frontend** irá criar a página para aceitar convites.

- **`pages/AcceptInvite.tsx`**: Uma nova página que recebe o token da URL, chama a API para aceitar o convite e redireciona o usuário para o projeto.

### 4.5 Restrições de UI Pós-Trial
**Tarefa:** O **Agente de Frontend** irá implementar restrições na interface após o período de teste.

- Desabilitar ou ocultar funcionalidades de criação/edição de projetos/cards/convites para usuários com trial expirado.
- Exibir mensagens claras sobre a expiração do trial e a necessidade de assinatura.

### 4.6 Critérios de Aceite Fase 3
- [ ] Interface de gerenciamento de membros é funcional e consistente com o design atual.
- [ ] Convites podem ser enviados através da interface.
- [ ] A página de aceite de convite funciona corretamente.
- [ ] O estado da aplicação é atualizado corretamente após as ações do usuário.
- [ ] O status do período de teste é exibido corretamente na interface.
- [ ] Funcionalidades são restritas para usuários com trial expirado.
- [ ] Mensagens de expiração de trial são claras e visíveis.

---

## 5. TESTES E VALIDAÇÃO (SEMANA 4)

**Responsáveis:** Agentes de Backend e Frontend

### 5.1 Testes de Backend
**Tarefa:** O **Agente de Testes de Backend** irá criar testes de integração.

- Testar a lógica de permissões para garantir que usuários só possam executar ações permitidas.
- Testar os endpoints da API para convites e gerenciamento de membros.
- Testar a lógica de expiração do trial e restrição de acesso.

### 5.2 Testes de Frontend
**Tarefa:** O **Agente de Testes de Frontend** irá criar testes de componentes.

- Testar os componentes `MemberCard`, `InviteModal` e `TrialStatusDisplay` para garantir que eles renderizam corretamente e emitem os eventos esperados.
- Testar o fluxo de convite e aceite do ponto de vista do usuário.
- Testar a exibição do status do trial e as restrições de UI.

---

## 6. CRONOGRAMA FINAL

| Semana | Fase | Responsável |
|--------|------|-------------|
| 1 | Fundação - Backend | Agente de Backend |
| 2 | API Core - Backend | Agente de Backend |
| 3 | Interface - Frontend | Agente de Frontend |
| 4 | Testes e Polish | Agentes de Backend e Frontend |

**Prazo Total Estimado: 4 semanas**