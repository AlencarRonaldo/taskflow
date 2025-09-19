# PRD - Sistema de Colaboração em Projetos

## 1. VISÃO GERAL

### 1.1 Contexto
Implementar funcionalidade de colaboração multi-usuário no SaaS de gerenciamento de projetos, permitindo que proprietários de projetos convidem outros usuários para colaborar com diferentes níveis de acesso.

### 1.2 Objetivos
- Permitir colaboração em tempo real entre múltiplos usuários
- Estabelecer sistema de permissões claro e seguro
- Facilitar onboarding de novos colaboradores
- Manter simplicidade na experiência do usuário

### 1.3 Métricas de Sucesso
- 60% dos projetos com mais de 1 colaborador em 30 dias
- 70% dos convites aceitos em 48 horas
- Tempo médio de convite até aceite < 24 horas
- Zero falhas de segurança relacionadas a permissões

---

## 2. FASE 1 - FUNDAÇÃO (SEMANA 1)

### 2.1 Estrutura de Dados

#### 2.1.1 Tabela project_members
```sql
CREATE TABLE project_members (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role ENUM('owner', 'project_manager', 'team_member', 'viewer') NOT NULL,
    invited_by BIGINT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive') DEFAULT 'active',
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id),
    
    UNIQUE KEY unique_project_user (project_id, user_id),
    KEY idx_project_members_project (project_id),
    KEY idx_project_members_user (user_id)
);
```

#### 2.1.2 Tabela project_invites
```sql
CREATE TABLE project_invites (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    email VARCHAR(255) NOT NULL,
    role ENUM('project_manager', 'team_member', 'viewer') NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    invited_by BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    status ENUM('pending', 'accepted', 'expired', 'cancelled') DEFAULT 'pending',
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id),
    
    KEY idx_project_invites_token (token),
    KEY idx_project_invites_email (email),
    KEY idx_project_invites_project (project_id)
);
```

### 2.2 Sistema de Permissões

#### 2.2.1 Definição de Papéis
- **Owner**: Criador do projeto, controle total
- **Project Manager**: Gerenciar projeto, convidar membros, definir permissões
- **Team Member**: Editar cards, comentar, anexar arquivos
- **Viewer**: Apenas visualizar, sem edição

#### 2.2.2 Matriz de Permissões
```php
// config/permissions.php
return [
    'owner' => [
        'project.delete',
        'project.edit',
        'project.view',
        'members.invite',
        'members.remove',
        'members.change_role',
        'cards.create',
        'cards.edit',
        'cards.delete',
        'comments.create',
        'files.upload'
    ],
    'project_manager' => [
        'project.edit',
        'project.view',
        'members.invite',
        'members.remove',
        'cards.create',
        'cards.edit',
        'cards.delete',
        'comments.create',
        'files.upload'
    ],
    'team_member' => [
        'project.view',
        'cards.create',
        'cards.edit',
        'comments.create',
        'files.upload'
    ],
    'viewer' => [
        'project.view'
    ]
];
```

### 2.3 Middleware e Helpers

#### 2.3.1 Middleware de Autorização
```php
// app/Http/Middleware/CheckProjectPermission.php
class CheckProjectPermission
{
    public function handle($request, Closure $next, $permission)
    {
        $project = $request->route('project');
        $user = auth()->user();
        
        if (!$this->userHasPermission($user, $project, $permission)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        
        return $next($request);
    }
    
    private function userHasPermission($user, $project, $permission)
    {
        $member = ProjectMember::where('project_id', $project->id)
                               ->where('user_id', $user->id)
                               ->where('status', 'active')
                               ->first();
        
        if (!$member) return false;
        
        $permissions = config('permissions.' . $member->role, []);
        return in_array($permission, $permissions);
    }
}
```

#### 2.3.2 Helper de Tokens
```php
// app/Services/InviteTokenService.php
class InviteTokenService
{
    public static function generate()
    {
        return bin2hex(random_bytes(32));
    }
    
    public static function isValid($token)
    {
        return ProjectInvite::where('token', $token)
                          ->where('status', 'pending')
                          ->where('expires_at', '>', now())
                          ->exists();
    }
}
```

### 2.4 Critérios de Aceite Fase 1
- [ ] Tabelas criadas com migrations
- [ ] Sistema de permissões funciona corretamente
- [ ] Middleware bloqueia acessos não autorizados
- [ ] Tokens de convite são gerados de forma segura
- [ ] Testes unitários cobrem permissões básicas

---

## 3. FASE 2 - API CORE (SEMANA 2)

### 3.1 Controllers e Rotas

#### 3.1.1 Rotas da API
```php
// routes/api.php
Route::middleware(['auth:api'])->group(function () {
    Route::prefix('projects/{project}')->group(function () {
        Route::get('members', [ProjectMemberController::class, 'index'])
             ->middleware('project.permission:project.view');
             
        Route::post('invites', [ProjectInviteController::class, 'store'])
             ->middleware('project.permission:members.invite');
             
        Route::put('members/{member}', [ProjectMemberController::class, 'updateRole'])
             ->middleware('project.permission:members.change_role');
             
        Route::delete('members/{member}', [ProjectMemberController::class, 'destroy'])
             ->middleware('project.permission:members.remove');
    });
    
    Route::post('invites/{token}/accept', [ProjectInviteController::class, 'accept']);
});
```

#### 3.1.2 Controller de Membros
```php
// app/Http/Controllers/ProjectMemberController.php
class ProjectMemberController extends Controller
{
    public function index(Project $project)
    {
        $members = $project->members()
                          ->with('user:id,name,email,avatar')
                          ->where('status', 'active')
                          ->get();
        
        return ProjectMemberResource::collection($members);
    }
    
    public function updateRole(Project $project, ProjectMember $member, UpdateRoleRequest $request)
    {
        // Não permitir alterar papel do owner
        if ($member->role === 'owner') {
            return response()->json(['error' => 'Cannot change owner role'], 422);
        }
        
        $member->update(['role' => $request->role]);
        
        return new ProjectMemberResource($member);
    }
    
    public function destroy(Project $project, ProjectMember $member)
    {
        // Não permitir remover owner
        if ($member->role === 'owner') {
            return response()->json(['error' => 'Cannot remove owner'], 422);
        }
        
        $member->delete();
        
        return response()->json(['message' => 'Member removed successfully']);
    }
}
```

#### 3.1.3 Controller de Convites
```php
// app/Http/Controllers/ProjectInviteController.php
class ProjectInviteController extends Controller
{
    public function store(Project $project, StoreInviteRequest $request)
    {
        // Verificar se usuário já é membro
        if ($this->isAlreadyMember($project, $request->email)) {
            return response()->json(['error' => 'User is already a member'], 422);
        }
        
        // Verificar se já existe convite pendente
        if ($this->hasPendingInvite($project, $request->email)) {
            return response()->json(['error' => 'Invite already sent'], 422);
        }
        
        $invite = ProjectInvite::create([
            'project_id' => $project->id,
            'email' => $request->email,
            'role' => $request->role,
            'token' => InviteTokenService::generate(),
            'invited_by' => auth()->id(),
            'expires_at' => now()->addDays(7)
        ]);
        
        // Enviar email
        Mail::to($request->email)->send(new ProjectInviteMail($invite));
        
        return response()->json(['message' => 'Invite sent successfully'], 201);
    }
    
    public function accept($token)
    {
        $invite = ProjectInvite::where('token', $token)
                             ->where('status', 'pending')
                             ->where('expires_at', '>', now())
                             ->firstOrFail();
        
        $user = $this->findOrCreateUser($invite->email);
        
        // Criar membro do projeto
        ProjectMember::create([
            'project_id' => $invite->project_id,
            'user_id' => $user->id,
            'role' => $invite->role,
            'invited_by' => $invite->invited_by
        ]);
        
        // Marcar convite como aceito
        $invite->update(['status' => 'accepted']);
        
        return response()->json(['message' => 'Invite accepted successfully']);
    }
    
    private function isAlreadyMember($project, $email)
    {
        return $project->members()
                      ->whereHas('user', function($query) use ($email) {
                          $query->where('email', $email);
                      })
                      ->where('status', 'active')
                      ->exists();
    }
    
    private function hasPendingInvite($project, $email)
    {
        return ProjectInvite::where('project_id', $project->id)
                          ->where('email', $email)
                          ->where('status', 'pending')
                          ->where('expires_at', '>', now())
                          ->exists();
    }
    
    private function findOrCreateUser($email)
    {
        return User::firstOrCreate(['email' => $email], [
            'name' => explode('@', $email)[0],
            'password' => Hash::make(Str::random(32))
        ]);
    }
}
```

### 3.2 Requests de Validação

#### 3.2.1 Validação de Convite
```php
// app/Http/Requests/StoreInviteRequest.php
class StoreInviteRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }
    
    public function rules()
    {
        return [
            'email' => 'required|email|max:255',
            'role' => 'required|in:project_manager,team_member,viewer'
        ];
    }
    
    public function messages()
    {
        return [
            'email.required' => 'Email is required',
            'email.email' => 'Please enter a valid email address',
            'role.required' => 'Role is required',
            'role.in' => 'Invalid role selected'
        ];
    }
}
```

### 3.3 Resources da API

#### 3.3.1 Resource de Membro
```php
// app/Http/Resources/ProjectMemberResource.php
class ProjectMemberResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'role' => $this->role,
            'joined_at' => $this->joined_at->format('Y-m-d H:i:s'),
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
                'avatar' => $this->user->avatar_url
            ],
            'invited_by' => [
                'name' => $this->inviter->name
            ]
        ];
    }
}
```

### 3.4 Sistema de Email

#### 3.4.1 Mailable de Convite
```php
// app/Mail/ProjectInviteMail.php
class ProjectInviteMail extends Mailable
{
    public $invite;
    
    public function __construct(ProjectInvite $invite)
    {
        $this->invite = $invite;
    }
    
    public function build()
    {
        $acceptUrl = config('app.frontend_url') . '/accept-invite/' . $this->invite->token;
        
        return $this->subject('Convite para colaborar no projeto')
                   ->view('emails.project-invite')
                   ->with([
                       'projectName' => $this->invite->project->name,
                       'inviterName' => $this->invite->inviter->name,
                       'role' => $this->invite->role,
                       'acceptUrl' => $acceptUrl,
                       'expiresAt' => $this->invite->expires_at->format('d/m/Y')
                   ]);
    }
}
```

#### 3.4.2 Template de Email
```html
<!-- resources/views/emails/project-invite.blade.php -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Convite para Projeto</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
        <h1 style="color: #333; margin-bottom: 20px;">Você foi convidado para colaborar!</h1>
        
        <p>Olá!</p>
        
        <p><strong>{{ $inviterName }}</strong> convidou você para colaborar no projeto 
        <strong>{{ $projectName }}</strong> como <strong>{{ ucfirst(str_replace('_', ' ', $role)) }}</strong>.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{ $acceptUrl }}" 
               style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Aceitar Convite
            </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
            Este convite expira em {{ $expiresAt }}. Se você não deseja participar deste projeto, 
            pode ignorar este email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        
        <p style="color: #999; font-size: 12px;">
            Se você está tendo problemas com o botão acima, copie e cole este link no seu navegador:<br>
            {{ $acceptUrl }}
        </p>
    </div>
</body>
</html>
```

### 3.5 Critérios de Aceite Fase 2
- [ ] Todas as rotas da API funcionam corretamente
- [ ] Validações impedem dados inválidos
- [ ] Emails de convite são enviados
- [ ] Convites podem ser aceitos via token
- [ ] Usuários inexistentes são criados automaticamente
- [ ] Não é possível convidar usuários já membros
- [ ] Convites expiram após 7 dias
- [ ] Testes de integração cobrem todos os endpoints

---

## 4. FASE 3 - INTERFACE FRONTEND (SEMANAS 3-4)

### 4.1 Componentes Vue.js

#### 4.1.1 Página de Gerenciamento de Membros
```vue
<!-- resources/js/pages/ProjectMembers.vue -->
<template>
    <div class="project-members">
        <div class="header">
            <h2>Membros do Projeto</h2>
            <button 
                v-if="canInviteMembers" 
                @click="showInviteModal = true"
                class="btn btn-primary">
                Convidar Membro
            </button>
        </div>
        
        <div class="members-list">
            <MemberCard 
                v-for="member in members" 
                :key="member.id"
                :member="member"
                :can-manage="canManageMembers"
                @role-changed="handleRoleChange"
                @member-removed="handleMemberRemove"
            />
        </div>
        
        <InviteModal 
            v-if="showInviteModal"
            :project-id="projectId"
            @close="showInviteModal = false"
            @invite-sent="handleInviteSent"
        />
    </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useProjectStore } from '@/stores/project'
import MemberCard from '@/components/MemberCard.vue'
import InviteModal from '@/components/InviteModal.vue'

export default {
    name: 'ProjectMembers',
    components: { MemberCard, InviteModal },
    props: {
        projectId: {
            type: [String, Number],
            required: true
        }
    },
    setup(props) {
        const projectStore = useProjectStore()
        const members = ref([])
        const loading = ref(false)
        const showInviteModal = ref(false)
        
        const currentUserRole = computed(() => projectStore.currentUserRole)
        const canInviteMembers = computed(() => 
            ['owner', 'project_manager'].includes(currentUserRole.value)
        )
        const canManageMembers = computed(() => 
            ['owner', 'project_manager'].includes(currentUserRole.value)
        )
        
        const loadMembers = async () => {
            loading.value = true
            try {
                const response = await projectStore.getProjectMembers(props.projectId)
                members.value = response.data
            } catch (error) {
                console.error('Error loading members:', error)
            } finally {
                loading.value = false
            }
        }
        
        const handleRoleChange = async (memberId, newRole) => {
            try {
                await projectStore.updateMemberRole(props.projectId, memberId, newRole)
                await loadMembers() // Reload members
            } catch (error) {
                console.error('Error updating role:', error)
            }
        }
        
        const handleMemberRemove = async (memberId) => {
            if (!confirm('Tem certeza que deseja remover este membro?')) return
            
            try {
                await projectStore.removeMember(props.projectId, memberId)
                await loadMembers() // Reload members
            } catch (error) {
                console.error('Error removing member:', error)
            }
        }
        
        const handleInviteSent = () => {
            showInviteModal.value = false
            // Optionally show success message
        }
        
        onMounted(() => {
            loadMembers()
        })
        
        return {
            members,
            loading,
            showInviteModal,
            canInviteMembers,
            canManageMembers,
            handleRoleChange,
            handleMemberRemove,
            handleInviteSent
        }
    }
}
</script>
```

#### 4.1.2 Componente de Card do Membro
```vue
<!-- resources/js/components/MemberCard.vue -->
<template>
    <div class="member-card">
        <div class="member-info">
            <img 
                :src="member.user.avatar || '/default-avatar.png'" 
                :alt="member.user.name"
                class="member-avatar"
            >
            <div class="member-details">
                <h4>{{ member.user.name }}</h4>
                <p>{{ member.user.email }}</p>
                <small>Entrou em {{ formatDate(member.joined_at) }}</small>
            </div>
        </div>
        
        <div class="member-actions">
            <select 
                v-if="canManage && member.role !== 'owner'"
                :value="member.role"
                @change="$emit('role-changed', member.id, $event.target.value)"
                class="role-select">
                <option value="project_manager">Gerente</option>
                <option value="team_member">Membro</option>
                <option value="viewer">Visualizador</option>
            </select>
            
            <span v-else class="role-badge" :class="member.role">
                {{ getRoleLabel(member.role) }}
            </span>
            
            <button 
                v-if="canManage && member.role !== 'owner'"
                @click="$emit('member-removed', member.id)"
                class="btn btn-danger btn-sm">
                Remover
            </button>
        </div>
    </div>
</template>

<script>
export default {
    name: 'MemberCard',
    props: {
        member: {
            type: Object,
            required: true
        },
        canManage: {
            type: Boolean,
            default: false
        }
    },
    emits: ['role-changed', 'member-removed'],
    methods: {
        formatDate(date) {
            return new Date(date).toLocaleDateString('pt-BR')
        },
        getRoleLabel(role) {
            const labels = {
                owner: 'Proprietário',
                project_manager: 'Gerente',
                team_member: 'Membro',
                viewer: 'Visualizador'
            }
            return labels[role] || role
        }
    }
}
</script>
```

#### 4.1.3 Modal de Convite
```vue
<!-- resources/js/components/InviteModal.vue -->
<template>
    <div class="modal-overlay" @click="$emit('close')">
        <div class="modal-content" @click.stop>
            <div class="modal-header">
                <h3>Convidar Membro</h3>
                <button @click="$emit('close')" class="btn-close">&times;</button>
            </div>
            
            <form @submit.prevent="sendInvite">
                <div class="form-group">
                    <label for="email">Email</label>
                    <input 
                        id="email"
                        v-model="form.email"
                        type="email" 
                        required
                        class="form-control"
                        placeholder="usuario@exemplo.com"
                    >
                    <div v-if="errors.email" class="error-message">
                        {{ errors.email[0] }}
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="role">Papel no Projeto</label>
                    <select id="role" v-model="form.role" class="form-control" required>
                        <option value="team_member">Membro da Equipe</option>
                        <option value="project_manager">Gerente do Projeto</option>
                        <option value="viewer">Visualizador</option>
                    </select>
                    
                    <div class="role-description">
                        <small>{{ getRoleDescription(form.role) }}</small>
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button type="button" @click="$emit('close')" class="btn btn-secondary">
                        Cancelar
                    </button>
                    <button type="submit" :disabled="loading" class="btn btn-primary">
                        {{ loading ? 'Enviando...' : 'Enviar Convite' }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { useProjectStore } from '@/stores/project'

export default {
    name: 'InviteModal',
    props: {
        projectId: {
            type: [String, Number],
            required: true
        }
    },
    emits: ['close', 'invite-sent'],
    setup(props, { emit }) {
        const projectStore = useProjectStore()
        const loading = ref(false)
        const errors = ref({})
        
        const form = reactive({
            email: '',
            role: 'team_member'
        })
        
        const sendInvite = async () => {
            loading.value = true
            errors.value = {}
            
            try {
                await projectStore.sendInvite(props.projectId, {
                    email: form.email,
                    role: form.role
                })
                
                emit('invite-sent')
                // Show success message
                alert('Convite enviado com sucesso!')
                
            } catch (error) {
                if (error.response?.status === 422) {
                    errors.value = error.response.data.errors || {}
                } else {
                    alert('Erro ao enviar convite. Tente novamente.')
                }
            } finally {
                loading.value = false
            }
        }
        
        const getRoleDescription = (role) => {
            const descriptions = {
                project_manager: 'Pode gerenciar o projeto e convidar novos membros',
                team_member: 'Pode editar cards, comentar e anexar arquivos',
                viewer: 'Pode apenas visualizar o projeto'
            }
            return descriptions[role] || ''
        }
        
        return {
            form,
            loading,
            errors,
            sendInvite,
            getRoleDescription
        }
    }
}
</script>
```

### 4.2 Store Pinia

#### 4.2.1 Project Store
```javascript
// resources/js/stores/project.js
import { defineStore } from 'pinia'
import api from '@/api'

export const useProjectStore = defineStore('project', {
    state: () => ({
        currentProject: null,
        currentUserRole: null,
        members: []
    }),
    
    actions: {
        async getProjectMembers(projectId) {
            try {
                const response = await api.get(`/projects/${projectId}/members`)
                this.members = response.data.data
                return response.data
            } catch (error) {
                throw error
            }
        },
        
        async sendInvite(projectId, inviteData) {
            try {
                const response = await api.post(`/projects/${projectId}/invites`, inviteData)
                return response.data
            } catch (error) {
                throw error
            }
        },
        
        async updateMemberRole(projectId, memberId, newRole) {
            try {
                const response = await api.put(`/projects/${projectId}/members/${memberId}`, {
                    role: newRole
                })
                return response.data
            } catch (error) {
                throw error
            }
        },
        
        async removeMember(projectId, memberId) {
            try {
                const response = await api.delete(`/projects/${projectId}/members/${memberId}`)
                return response.data
            } catch (error) {
                throw error
            }
        },
        
        async acceptInvite(token) {
            try {
                const response = await api.post(`/invites/${token}/accept`)
                return response.data
            } catch (error) {
                throw error
            }
        }
    }
})
```

### 4.3 Estilos CSS

#### 4.3.1 Estilos dos Componentes
```scss
// resources/scss/components/members.scss
.project-members {
    padding: 20px;
    
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        
        h2 {
            margin: 0;
            color: #333;
        }
    }
    
    .members-list {
        display: grid;
        gap: 15px;
    }
}

.member-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    background: white;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    
    .member-info {
        display: flex;
        align-items: center;
        gap: 15px;
        
        .member-avatar {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            object-fit: cover;
        }
        
        .member-details {
            h4 {
                margin: 0 0 5px 0;
                color: #333;
            }
            
            p {
                margin: 0 0 5px 0;
                color: #666;
                font-size: 14px;
            }
            
            small {
                color: #999;
                font-size: 12px;
            }
        }
    }
    
    .member-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        
        .role-select {
            padding: 5px 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .role-badge {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            
            &.owner {
                background: #fff3cd;
                color: #856404;
            }
            
            &.project_manager {
                background: #d4edda;
                color: #155724;
            }
            
            &.team_member {
                background: #d1ecf1;
                color: #0c5460;
            }
            
            &.viewer {
                background: #f8d7da;
                color: #721c24;
            }
        }
    }
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    
    .modal-content {
        background: white;
        padding: 0;
        border-radius: 8px;
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        overflow-y: auto;
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #e1e5e9;
            
            h3 {
                margin: 0;
                color: #333;
            }
            
            .btn-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #999;
                
                &:hover {
                    color: #333;
                }
            }
        }
        
        form {
            padding: 20px;
            
            .form-group {
                margin-bottom: 20px;
                
                label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 500;
                    color: #333;
                }
                
                .form-control {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                    
                    &:focus {
                        outline: none;
                        border-color: #007bff;
                        box-shadow: 0 0 0 3px rgba(0,123,255,0.1);
                    }
                }
                
                .role-description {
                    margin-top: 5px;
                    
                    small {
                        color: #666;
                        font-style: italic;
                    }
                }
                
                .error-message {
                    color: #dc3545;
                    font-size: 12px;
                    margin-top: 5px;
                }
            }
            
            .modal-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                padding-top: 20px;
                border-top: 1px solid #e1e5e9;
            }
        }
    }
}

// Botões base
.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    display: inline-block;
    transition: all 0.2s;
    
    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    &.btn-primary {
        background: #007bff;
        color: white;
        
        &:hover:not(:disabled) {
            background: #0056b3;
        }
    }
    
    &.btn-secondary {
        background: #6c757d;
        color: white;
        
        &:hover:not(:disabled) {
            background: #545b62;
        }
    }
    
    &.btn-danger {
        background: #dc3545;
        color: white;
        
        &:hover:not(:disabled) {
            background: #c82333;
        }
    }
    
    &.btn-sm {
        padding: 5px 10px;
        font-size: 12px;
    }
}
```

### 4.4 Página de Aceite de Convite

#### 4.4.1 Componente de Aceite
```vue
<!-- resources/js/pages/AcceptInvite.vue -->
<template>
    <div class="accept-invite-page">
        <div class="invite-card">
            <div v-if="loading" class="loading">
                <p>Carregando convite...</p>
            </div>
            
            <div v-else-if="error" class="error">
                <h2>Erro no Convite</h2>
                <p>{{ error }}</p>
                <router-link to="/login" class="btn btn-primary">
                    Fazer Login
                </router-link>
            </div>
            
            <div v-else-if="success" class="success">
                <h2>Convite Aceito!</h2>
                <p>Você agora faz parte do projeto <strong>{{ projectName }}</strong>.</p>
                <router-link :to="`/projects/${projectId}`" class="btn btn-primary">
                    Acessar Projeto
                </router-link>
            </div>
            
            <div v-else class="invite-details">
                <h2>Convite para Colaborar</h2>
                <p>Você foi convidado para participar do projeto:</p>
                <div class="project-info">
                    <h3>{{ projectName }}</h3>
                    <p>Como: <strong>{{ roleLabel }}</strong></p>
                    <p>Por: {{ inviterName }}</p>
                </div>
                
                <div class="actions">
                    <button 
                        @click="acceptInvite" 
                        :disabled="accepting"
                        class="btn btn-primary">
                        {{ accepting ? 'Aceitando...' : 'Aceitar Convite' }}
                    </button>
                    
                    <button @click="declineInvite" class="btn btn-secondary">
                        Recusar
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/project'

export default {
    name: 'AcceptInvite',
    setup() {
        const route = useRoute()
        const router = useRouter()
        const projectStore = useProjectStore()
        
        const loading = ref(true)
        const accepting = ref(false)
        const error = ref(null)
        const success = ref(false)
        
        const inviteData = ref({})
        const projectName = ref('')
        const projectId = ref(null)
        const roleLabel = ref('')
        const inviterName = ref('')
        
        const token = route.params.token
        
        const loadInviteData = async () => {
            try {
                // Fazer request para obter dados do convite
                const response = await api.get(`/invites/${token}`)
                const data = response.data
                
                inviteData.value = data
                projectName.value = data.project.name
                projectId.value = data.project.id
                roleLabel.value = getRoleLabel(data.role)
                inviterName.value = data.inviter.name
                
            } catch (err) {
                if (err.response?.status === 404) {
                    error.value = 'Convite não encontrado ou expirado.'
                } else {
                    error.value = 'Erro ao carregar convite.'
                }
            } finally {
                loading.value = false
            }
        }
        
        const acceptInvite = async () => {
            accepting.value = true
            
            try {
                await projectStore.acceptInvite(token)
                success.value = true
            } catch (err) {
                error.value = 'Erro ao aceitar convite. Tente novamente.'
            } finally {
                accepting.value = false
            }
        }
        
        const declineInvite = () => {
            router.push('/login')
        }
        
        const getRoleLabel = (role) => {
            const labels = {
                project_manager: 'Gerente do Projeto',
                team_member: 'Membro da Equipe',
                viewer: 'Visualizador'
            }
            return labels[role] || role
        }
        
        onMounted(() => {
            loadInviteData()
        })
        
        return {
            loading,
            accepting,
            error,
            success,
            projectName,
            projectId,
            roleLabel,
            inviterName,
            acceptInvite,
            declineInvite
        }
    }
}
</script>
```

### 4.5 Critérios de Aceite Fase 3
- [ ] Interface de membros lista todos os colaboradores
- [ ] Modal de convite funciona corretamente
- [ ] Roles podem ser alterados pelos gerentes
- [ ] Membros podem ser removidos (exceto owner)
- [ ] Página de aceite de convite funciona
- [ ] Validações impedem ações não autorizadas
- [ ] Interface é responsiva em mobile
- [ ] Loading states funcionam corretamente
- [ ] Mensagens de erro são claras e úteis

---

## 5. TESTES E VALIDAÇÃO

### 5.1 Testes Backend

#### 5.1.1 Testes de Permissões
```php
// tests/Feature/ProjectPermissionsTest.php
class ProjectPermissionsTest extends TestCase
{
    use RefreshDatabase;
    
    public function test_owner_can_invite_members()
    {
        $user = User::factory()->create();
        $project = Project::factory()->create(['user_id' => $user->id]);
        
        $response = $this->actingAs($user)
            ->postJson("/api/projects/{$project->id}/invites", [
                'email' => 'test@example.com',
                'role' => 'team_member'
            ]);
        
        $response->assertStatus(201);
        $this->assertDatabaseHas('project_invites', [
            'project_id' => $project->id,
            'email' => 'test@example.com',
            'role' => 'team_member'
        ]);
    }
    
    public function test_team_member_cannot_invite_members()
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $project = Project::factory()->create(['user_id' => $owner->id]);
        
        ProjectMember::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => 'team_member',
            'invited_by' => $owner->id
        ]);
        
        $response = $this->actingAs($member)
            ->postJson("/api/projects/{$project->id}/invites", [
                'email' => 'test@example.com',
                'role' => 'team_member'
            ]);
        
        $response->assertStatus(403);
    }
    
    public function test_cannot_invite_existing_member()
    {
        $owner = User::factory()->create();
        $existingUser = User::factory()->create();
        $project = Project::factory()->create(['user_id' => $owner->id]);
        
        ProjectMember::create([
            'project_id' => $project->id,
            'user_id' => $existingUser->id,
            'role' => 'team_member',
            'invited_by' => $owner->id
        ]);
        
        $response = $this->actingAs($owner)
            ->postJson("/api/projects/{$project->id}/invites", [
                'email' => $existingUser->email,
                'role' => 'team_member'
            ]);
        
        $response->assertStatus(422);
        $response->assertJson(['error' => 'User is already a member']);
    }
}
```

### 5.2 Testes Frontend

#### 5.2.1 Testes de Componentes
```javascript
// tests/components/MemberCard.test.js
import { mount } from '@vue/test-utils'
import MemberCard from '@/components/MemberCard.vue'

describe('MemberCard', () => {
    const mockMember = {
        id: 1,
        role: 'team_member',
        joined_at: '2023-01-01T00:00:00Z',
        user: {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            avatar: null
        }
    }
    
    it('displays member information correctly', () => {
        const wrapper = mount(MemberCard, {
            props: { member: mockMember }
        })
        
        expect(wrapper.text()).toContain('John Doe')
        expect(wrapper.text()).toContain('john@example.com')
    })
    
    it('shows role selector when can manage', () => {
        const wrapper = mount(MemberCard, {
            props: { 
                member: mockMember,
                canManage: true 
            }
        })
        
        expect(wrapper.find('select.role-select').exists()).toBe(true)
    })
    
    it('emits role-changed when role is updated', async () => {
        const wrapper = mount(MemberCard, {
            props: { 
                member: mockMember,
                canManage: true 
            }
        })
        
        const select = wrapper.find('select.role-select')
        await select.setValue('project_manager')
        
        expect(wrapper.emitted('role-changed')).toEqual([
            [1, 'project_manager']
        ])
    })
})
```

---

## 6. DEPLOY E MONITORAMENTO

### 6.1 Checklist de Deploy

#### 6.1.1 Backend
- [ ] Migrations executadas em produção
- [ ] Configuração de email funcionando
- [ ] Rate limiting configurado
- [ ] Logs configurados corretamente
- [ ] Backup de banco funcionando

#### 6.1.2 Frontend
- [ ] Build de produção otimizado
- [ ] Assets servidos via CDN
- [ ] Service Worker configurado
- [ ] Error boundary implementado
- [ ] Analytics configurado

### 6.2 Monitoramento

#### 6.2.1 Métricas de Negócio
- Taxa de convites enviados
- Taxa de convites aceitos
- Tempo médio de aceite
- Número de colaboradores por projeto
- Projetos com múltiplos colaboradores

#### 6.2.2 Métricas Técnicas
- Tempo de resposta das APIs
- Taxa de erro 500
- Deliverabilidade de emails
- Performance do frontend
- Uso de recursos do servidor

---

## 7. CRONOGRAMA FINAL

| Semana | Fase | Responsável | Status |
|--------|------|-------------|--------|
| 1 | Fundação - Backend | Dev Backend | ⏳ |
| 2 | API Core - Backend | Dev Backend | ⏳ |
| 3 | Interface - Frontend | Dev Frontend | ⏳ |
| 4 | Polish + Testes | Dev Full | ⏳ |

**Prazo Total: 4 semanas**
**Esforço Estimado: 140 horas**

Este PRD detalha todas as etapas necessárias para implementar o sistema de colaboração sem erros, com critérios de aceite claros e testes abrangentes.