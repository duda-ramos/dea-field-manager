# Sistema de Autenticação e Permissões

## Visão Geral

Este documento descreve a implementação completa do sistema de autenticação baseado em roles (RBAC - Role-Based Access Control) no DEA Manager.

## Roles de Usuário

O sistema implementa 4 níveis hierárquicos de acesso:

### 1. Admin (Administrador)
- **Acesso Total**: Todas as funcionalidades do sistema
- **Gerenciamento de Usuários**: Criar, editar, excluir usuários e alterar roles
- **Gerenciamento de Convites**: Enviar convites para novos usuários
- **Visualização de Logs**: Acesso a todos os logs de auditoria
- **Gerenciamento Global**: Acesso a projetos de todos os usuários

### 2. Manager (Gerente)
- **Projetos**: Criar, editar, excluir projetos
- **Instalações**: Gerenciamento completo de instalações
- **Contatos**: Gerenciamento completo de contatos
- **Orçamentos**: Gerenciamento completo de orçamentos
- **Relatórios**: Criar e visualizar relatórios
- **Arquivos**: Upload e gerenciamento de arquivos
- **Colaboração**: Pode ser adicionado como colaborador em projetos

### 3. Field Tech (Técnico de Campo)
- **Instalações**: Marcar como instalado e adicionar fotos
- **Campos Editáveis**:
  - `installed` (status de instalação)
  - `installed_at` (data de instalação)
  - `photos` (fotos)
  - `observacoes` (observações)
- **Leitura**: Acesso de leitura a projetos, instalações, contatos, orçamentos
- **Upload de Fotos**: Pode fazer upload de fotos de instalações

### 4. Viewer (Visualizador)
- **Acesso Somente Leitura**: Visualizar projetos, instalações, contatos, relatórios
- **Sem Edição**: Não pode criar, editar ou excluir nenhum recurso

## Arquitetura do Sistema

### 1. Banco de Dados

#### Tabela `profiles`
```sql
ALTER TABLE profiles ADD COLUMN role user_role NOT NULL DEFAULT 'viewer';
ALTER TABLE profiles ADD COLUMN role_metadata JSONB DEFAULT '{}';
```

Campos:
- `id`: UUID (chave primária)
- `display_name`: Nome de exibição
- `avatar_url`: URL do avatar
- `role`: Enum de role do usuário
- `role_metadata`: Metadados adicionais em JSON
- `created_at`, `updated_at`: Timestamps

#### Tabela `user_invitations`
Armazena convites enviados para novos usuários:
- `id`: UUID
- `email`: Email do convidado
- `role`: Role a ser atribuído
- `invited_by`: ID do usuário que convidou
- `invitation_token`: Token único do convite
- `expires_at`: Data de expiração
- `accepted_at`: Data de aceitação (null se pendente)

#### Tabela `user_access_logs`
Log de auditoria de todas as ações:
- `id`: UUID
- `user_id`: ID do usuário
- `action`: Ação realizada
- `resource_type`: Tipo de recurso
- `resource_id`: ID do recurso
- `ip_address`: IP do usuário
- `user_agent`: User agent do navegador
- `metadata`: Dados adicionais em JSON
- `created_at`: Timestamp

#### Tabela `project_collaborators`
Relacionamento many-to-many entre projetos e usuários:
- `id`: UUID
- `project_id`: ID do projeto
- `user_id`: ID do usuário
- `role`: Role no projeto
- `status`: Status do convite (pending, accepted, rejected)
- `invited_by`: Quem convidou
- `invited_at`, `accepted_at`: Timestamps

### 2. Middleware de Permissões

Arquivo: `src/middleware/permissions.ts`

#### Funções Principais

```typescript
// Verificar se usuário tem permissão específica
hasPermission(userRole, resource, action): boolean

// Verificar se usuário tem role mínimo
hasMinimumRole(userRole, minRole): boolean

// Verificar se é admin
isAdmin(userRole): boolean

// Verificar se é manager ou superior
isManager(userRole): boolean

// Verificar se campo pode ser editado
canEditField(userRole, resource, field): boolean

// Obter ações permitidas para um recurso
getAllowedActions(userRole, resource): string[]
```

#### Matriz de Permissões

```typescript
const PERMISSION_MATRIX: Record<UserRole, Record<string, string[]>> = {
  admin: {
    projects: ['create', 'read', 'update', 'delete'],
    installations: ['create', 'read', 'update', 'delete'],
    // ... todos os recursos com todas as ações
  },
  manager: {
    projects: ['create', 'read', 'update', 'delete'],
    installations: ['create', 'read', 'update', 'delete'],
    // ... sem acesso a users e invitations
  },
  field_tech: {
    installations: ['read', 'update'], // apenas campos específicos
    files: ['create', 'read'],
    // ... acesso limitado
  },
  viewer: {
    // ... apenas 'read' em todos os recursos
  }
};
```

### 3. Context de Autenticação

Arquivo: `src/contexts/AuthContext.ts` e `src/hooks/useAuth.tsx`

#### Interface AuthContext

```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  
  // Propriedades de role
  userRole: UserRole | null;
  isAdmin: boolean;
  isManager: boolean;
  isFieldTech: boolean;
  isViewer: boolean;
  
  // Métodos de autenticação
  signUp: (email, password, displayName?) => Promise<{error}>;
  signIn: (email, password) => Promise<{error}>;
  signOut: () => Promise<{error}>;
  resetPassword: (email) => Promise<{error}>;
  updateProfile: (updates) => Promise<{error}>;
  
  // Métodos de permissão
  hasPermission: (resource, action) => boolean;
  hasMinimumRole: (minRole) => boolean;
}
```

### 4. HOC withPermission

Arquivo: `src/components/auth/withPermission.tsx`

#### Uso do HOC

```tsx
// Proteger componente completo
const AdminPanel = withPermission(Panel, {
  requiredRole: 'admin',
  showDeniedMessage: true,
  deniedMessage: 'Apenas administradores podem acessar'
});

// Exigir role mínimo
const ProjectEditor = withPermission(Editor, {
  minRole: 'manager'
});

// Verificar permissão específica
const DeleteButton = withPermission(Button, {
  resource: 'projects',
  action: 'delete'
});
```

#### PermissionGate Component

```tsx
// Renderização condicional baseada em permissões
<PermissionGate minRole="manager">
  <EditButton />
</PermissionGate>

<PermissionGate resource="projects" action="delete">
  <DeleteButton />
</PermissionGate>
```

#### usePermissions Hook

```tsx
// Hook para verificações inline
const { canEdit, canDelete, isAdmin } = usePermissions('projects');

if (canEdit) {
  // Mostrar botão de editar
}
```

### 5. Componentes Implementados

#### UserManagementPage
Página administrativa para gerenciar usuários:
- Lista todos os usuários do sistema
- Permite alterar roles
- Envia convites para novos usuários
- Exibe estatísticas de usuários
- Gerencia convites pendentes

Rota: `/usuarios`
Acesso: Apenas Admin

#### ProjectCollaborators
Componente para gerenciar colaboradores de um projeto:
- Lista colaboradores do projeto
- Adiciona novos colaboradores
- Altera roles de colaboradores
- Remove colaboradores

Uso:
```tsx
<ProjectCollaborators 
  projectId={project.id} 
  projectOwnerId={project.user_id} 
/>
```

#### AccessLogsViewer
Visualizador de logs de acesso e auditoria:
- Exibe histórico de ações
- Filtragem por ação e recurso
- Pesquisa de logs
- Detalhes de metadados

Uso:
```tsx
<AccessLogsViewer 
  userId={userId}  // opcional, para filtrar por usuário
  title="Logs de Acesso"
  maxHeight="600px"
/>
```

### 6. Serviços

#### UserManagementService
Arquivo: `src/services/userManagement.ts`

Funções:
- `getAllUsers()`: Lista todos os usuários
- `updateUserRole(userId, role)`: Atualiza role de usuário
- `createInvitation(email, role)`: Cria convite
- `getAllInvitations()`: Lista convites
- `cancelInvitation(invitationId)`: Cancela convite
- `acceptInvitation(token)`: Aceita convite
- `getUserAccessLogs(userId?, limit)`: Obtém logs
- `logUserAccess(action, resourceType?, resourceId?, metadata?)`: Registra log
- `getUserStats()`: Estatísticas de usuários

## Políticas de Segurança (RLS)

### Projetos
- Usuários veem apenas seus projetos OU projetos onde são colaboradores
- Managers e admins podem criar projetos
- Owners, managers e admins podem editar
- Apenas owners e admins podem excluir

### Instalações
- Veem instalações dos projetos que têm acesso
- Managers e admins podem criar
- Field techs podem atualizar campos específicos
- Owners, managers e admins podem excluir

### Convites
- Apenas admins podem visualizar e gerenciar convites

### Logs de Acesso
- Usuários veem apenas seus próprios logs
- Admins veem todos os logs

## Fluxo de Convite de Usuário

1. **Admin cria convite**:
   - Entra na página de Gerenciamento de Usuários
   - Clica em "Convidar Usuário"
   - Preenche email e seleciona role
   - Sistema gera token único e salva no banco

2. **Envio do convite**:
   - Email é enviado com link único (TODO: implementar email)
   - Link contém token de convite
   - Convite expira em 7 dias

3. **Usuário aceita convite**:
   - Clica no link do email
   - É redirecionado para página de registro
   - Token é validado e role é aplicado
   - Convite é marcado como aceito

## Integração com Componentes Existentes

### Verificando Permissões em Componentes

```tsx
import { useAuthContext } from '@/hooks/useAuthContext';
import { PermissionGate } from '@/components/auth/withPermission';

function MyComponent() {
  const auth = useAuthContext();

  return (
    <div>
      {/* Verificação simples */}
      {auth.isAdmin && <AdminButton />}
      
      {/* Com PermissionGate */}
      <PermissionGate minRole="manager">
        <EditForm />
      </PermissionGate>
      
      {/* Verificação de permissão específica */}
      <Button 
        disabled={!auth.hasPermission('projects', 'delete')}
        onClick={handleDelete}
      >
        Excluir
      </Button>
    </div>
  );
}
```

### Desabilitando Campos por Role

```tsx
import { getFieldDisabledState } from '@/middleware/permissions';

function InstallationForm() {
  const auth = useAuthContext();
  const isFieldDisabled = (field: string) => 
    getFieldDisabledState(auth.userRole, 'installations', 'update', field);

  return (
    <form>
      <input 
        name="descricao"
        disabled={isFieldDisabled('descricao')}
      />
      <input 
        name="installed"
        disabled={isFieldDisabled('installed')}
      />
      <input 
        name="photos"
        disabled={isFieldDisabled('photos')}
      />
    </form>
  );
}
```

## Logs de Auditoria

### Registrando Ações

```typescript
import { logUserAccess } from '@/services/userManagement';

// Em qualquer função
async function deleteProject(projectId: string) {
  await logUserAccess(
    'delete_project',
    'projects',
    projectId,
    { project_name: project.name }
  );
  
  // ... código de exclusão
}
```

### Ações Comuns Logadas

- `login`, `logout`
- `create_project`, `update_project`, `delete_project`
- `create_installation`, `update_installation`
- `view_contact`, `export_contact`
- `generate_report`, `share_report`
- `update_user_role`, `invite_user`

## Configuração Inicial

### Primeiro Usuário

Quando a migration é aplicada, o primeiro usuário (mais antigo) é automaticamente promovido a admin. Todos os outros usuários existentes recebem role "viewer".

```sql
-- Na migration
DO $$
DECLARE
  v_first_user UUID;
BEGIN
  SELECT id INTO v_first_user
  FROM public.profiles
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF v_first_user IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'admin'
    WHERE id = v_first_user;
  END IF;
END $$;
```

## Testando o Sistema

### Como Admin
1. Faça login com a conta de admin (primeiro usuário)
2. Acesse `/usuarios` no menu lateral
3. Veja lista de todos os usuários
4. Altere roles de outros usuários
5. Envie convites para novos usuários
6. Visualize logs de acesso

### Como Manager
1. Faça login com conta de manager
2. Crie/edite projetos
3. Adicione/remova instalações
4. Não deve ter acesso a `/usuarios`

### Como Field Tech
1. Faça login com conta de field tech
2. Visualize projetos
3. Marque instalações como concluídas
4. Adicione fotos
5. Não pode editar outros campos

### Como Viewer
1. Faça login com conta de viewer
2. Visualize projetos e instalações
3. Todos os botões de edição devem estar desabilitados
4. Não pode criar novos recursos

## Migrações do Banco de Dados

Arquivo: `supabase/migrations/20251110000001_add_user_roles_and_permissions.sql`

Esta migration adiciona:
- Enum `user_role`
- Coluna `role` em `profiles`
- Tabela `user_invitations`
- Tabela `user_access_logs`
- Funções SQL para verificação de roles
- Atualização das políticas RLS
- Índices para otimização

## Próximos Passos (Opcional)

1. **Email de Convites**: Implementar envio real de emails
2. **2FA**: Adicionar autenticação de dois fatores
3. **Permissões Granulares**: Permissões customizáveis por projeto
4. **API Keys**: Sistema de API keys para integrações
5. **Rate Limiting**: Limitar requisições por usuário
6. **Session Management**: Gerenciamento avançado de sessões

## Referências

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [RBAC Pattern](https://en.wikipedia.org/wiki/Role-based_access_control)
