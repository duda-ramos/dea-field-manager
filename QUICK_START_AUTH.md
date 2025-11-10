# Guia Rápido - Sistema de Autenticação e Permissões

## 🚀 Início Rápido (5 minutos)

### 1. Aplicar Migration no Banco de Dados

```bash
# Conecte-se ao seu projeto Supabase
supabase db push

# Ou aplique manualmente via Dashboard do Supabase:
# 1. Acesse SQL Editor
# 2. Cole o conteúdo de supabase/migrations/20251110000001_add_user_roles_and_permissions.sql
# 3. Execute
```

### 2. Verificar Primeiro Admin

Após aplicar a migration, o primeiro usuário (mais antigo) será automaticamente promovido a **admin**.

Para verificar:
1. Faça login com sua conta
2. Acesse: `http://localhost:3000/usuarios` (ou sua URL de produção)
3. Se você vir a página de Gerenciamento de Usuários, você é admin! ✅

### 3. Criar Outros Usuários

Como admin, você pode:

1. **Convidar novos usuários**:
   - Vá em `/usuarios`
   - Clique em "Convidar Usuário"
   - Digite o email e selecione o role
   - Clique em "Enviar Convite"

2. **Alterar role de usuários existentes**:
   - Na página de usuários, use o dropdown de role
   - Selecione o novo role
   - Mudança é aplicada imediatamente

## 📝 Roles Disponíveis

### Admin (Administrador)
```
✓ Tudo o que Manager pode
✓ Gerenciar usuários
✓ Alterar roles
✓ Visualizar todos os logs
```

### Manager (Gerente)
```
✓ Criar/editar/excluir projetos
✓ Gerenciar instalações
✓ Adicionar colaboradores
✓ Gerar relatórios
```

### Field Tech (Técnico de Campo)
```
✓ Marcar instalações como concluídas
✓ Adicionar fotos
✓ Visualizar projetos
✗ Não pode editar projetos
```

### Viewer (Visualizador)
```
✓ Visualizar tudo
✗ Não pode editar nada
```

## 💡 Exemplos de Uso

### Proteger uma Página Completa

```tsx
import { withPermission } from '@/components/auth/withPermission';

function AdminPanel() {
  return <div>Painel Admin</div>;
}

// Só admins podem acessar
export default withPermission(AdminPanel, {
  requiredRole: 'admin'
});
```

### Renderização Condicional

```tsx
import { PermissionGate } from '@/components/auth/withPermission';

function MyComponent() {
  return (
    <div>
      <PermissionGate minRole="manager">
        <button>Editar Projeto</button>
      </PermissionGate>
      
      <PermissionGate resource="projects" action="delete">
        <button>Excluir Projeto</button>
      </PermissionGate>
    </div>
  );
}
```

### Verificação em Código

```tsx
import { useAuthContext } from '@/hooks/useAuthContext';

function MyComponent() {
  const auth = useAuthContext();
  
  const handleEdit = () => {
    if (!auth.hasPermission('projects', 'update')) {
      alert('Você não tem permissão');
      return;
    }
    // ... código de edição
  };
  
  return (
    <button 
      onClick={handleEdit}
      disabled={!auth.hasPermission('projects', 'update')}
    >
      Editar
    </button>
  );
}
```

### Hook usePermissions

```tsx
import { usePermissions } from '@/components/auth/withPermission';

function ProjectCard() {
  const { canEdit, canDelete, isAdmin } = usePermissions('projects');
  
  return (
    <div>
      {canEdit && <button>Editar</button>}
      {canDelete && <button>Excluir</button>}
      {isAdmin && <button>Configurações Avançadas</button>}
    </div>
  );
}
```

## 🔍 Testando o Sistema

### Teste 1: Como Admin
1. Login com conta admin
2. Acesse `/usuarios`
3. Crie um novo usuário com role "manager"
4. Veja as estatísticas de usuários

### Teste 2: Como Manager
1. Login com conta manager
2. Crie um projeto
3. Adicione instalações
4. Tente acessar `/usuarios` (deve ser negado)

### Teste 3: Como Field Tech
1. Login com conta field tech
2. Abra um projeto
3. Marque uma instalação como instalada
4. Adicione uma foto
5. Tente editar nome do projeto (deve estar desabilitado)

### Teste 4: Como Viewer
1. Login com conta viewer
2. Navegue pelos projetos
3. Note que todos os botões estão desabilitados
4. Tente criar projeto (não deve ter botão)

## 🛠️ Integrando no Seu Código

### 1. Em Componentes de Formulário

```tsx
import { getFieldDisabledState } from '@/middleware/permissions';
import { useAuthContext } from '@/hooks/useAuthContext';

function InstallationForm({ installation, onSave }) {
  const auth = useAuthContext();
  
  const isFieldDisabled = (field: string) => 
    getFieldDisabledState(
      auth.userRole, 
      'installations', 
      'update', 
      field
    );
  
  return (
    <form>
      <input 
        name="descricao"
        value={installation.descricao}
        disabled={isFieldDisabled('descricao')}
      />
      <input 
        name="installed"
        type="checkbox"
        checked={installation.installed}
        disabled={isFieldDisabled('installed')}
      />
    </form>
  );
}
```

### 2. Em Botões de Ação

```tsx
import { useAuthContext } from '@/hooks/useAuthContext';

function ProjectActions({ project }) {
  const auth = useAuthContext();
  
  return (
    <div className="flex gap-2">
      {auth.hasPermission('projects', 'update') && (
        <button onClick={handleEdit}>Editar</button>
      )}
      
      {auth.hasPermission('projects', 'delete') && (
        <button onClick={handleDelete}>Excluir</button>
      )}
      
      {auth.isAdmin && (
        <button onClick={handleAdvanced}>Config Avançada</button>
      )}
    </div>
  );
}
```

### 3. Registrando Logs de Auditoria

```tsx
import { logUserAccess } from '@/services/userManagement';

async function deleteProject(projectId: string) {
  // Registrar log antes de excluir
  await logUserAccess(
    'delete_project',
    'projects',
    projectId,
    { project_name: project.name }
  );
  
  // Executar exclusão
  await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);
}
```

## 📱 Adicionar Colaboradores a Projetos

```tsx
import { ProjectCollaborators } from '@/components/project/ProjectCollaborators';

function ProjectDetailPage({ project }) {
  return (
    <div>
      <h1>{project.name}</h1>
      
      {/* Adicionar componente de colaboradores */}
      <ProjectCollaborators 
        projectId={project.id}
        projectOwnerId={project.user_id}
      />
    </div>
  );
}
```

## 📊 Visualizar Logs de Acesso

```tsx
import { AccessLogsViewer } from '@/components/audit/AccessLogsViewer';

function AuditPage() {
  return (
    <div>
      <h1>Auditoria</h1>
      
      {/* Todos os logs (admin only) */}
      <AccessLogsViewer />
      
      {/* Logs de um usuário específico */}
      <AccessLogsViewer 
        userId="uuid-do-usuario"
        title="Logs deste Usuário"
      />
    </div>
  );
}
```

## 🔐 Segurança

### Níveis de Proteção Implementados

1. **Banco de Dados (RLS)**
   - Políticas impedem acesso não autorizado
   - Validação no nível do PostgreSQL

2. **Backend (Functions SQL)**
   - Funções verificam permissões
   - Impossível burlar via API

3. **Frontend (React)**
   - UI desabilita ações não permitidas
   - Melhora UX e previne erros

### Verificação em Cascata

```
Usuário tenta ação
    ↓
Frontend verifica (UI)
    ↓ (se permitido)
Backend verifica (API)
    ↓ (se permitido)
Banco verifica (RLS)
    ↓ (se permitido)
Ação executada ✓
```

## 🆘 Troubleshooting

### Migration não aplica
```bash
# Verificar erros
supabase db push --debug

# Aplicar manualmente via SQL Editor no Dashboard
```

### Primeiro usuário não é admin
```sql
-- Execute no SQL Editor:
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'SEU-USER-ID';
```

### Usuário não consegue ver projetos
```sql
-- Verificar RLS:
SELECT * FROM projects WHERE user_id = 'USER-ID';

-- Se vazio, problema no RLS. Reaplique migration.
```

### Convites não funcionam
- Verifique se função `get_user_by_email` existe
- Verifique permissões RLS da tabela `user_invitations`

## 📞 Suporte

Para mais detalhes, consulte:
- `AUTH_PERMISSIONS_IMPLEMENTATION.md` - Documentação completa
- `AUTH_IMPLEMENTATION_SUMMARY.md` - Resumo da implementação

## ✅ Checklist de Deploy

Antes de fazer deploy em produção:

- [ ] Migration aplicada no banco de produção
- [ ] Primeiro usuário verificado como admin
- [ ] Testado todos os 4 roles
- [ ] Verificado RLS funcionando
- [ ] Logs de auditoria registrando ações
- [ ] Interface de usuários acessível para admin
- [ ] Documentação revisada

## 🎉 Pronto!

Seu sistema de autenticação e permissões está configurado e pronto para uso!

Para qualquer dúvida, consulte a documentação completa em `AUTH_PERMISSIONS_IMPLEMENTATION.md`.
