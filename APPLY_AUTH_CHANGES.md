# Como Aplicar as Mudanças do Sistema de Autenticação

## ⚠️ IMPORTANTE: Leia Antes de Aplicar

Este guia mostra como aplicar com segurança as mudanças do sistema de autenticação e permissões no seu banco de dados.

## 📋 Pré-requisitos

1. ✅ Backup do banco de dados
2. ✅ Acesso ao Supabase Dashboard ou CLI
3. ✅ Usuário admin no banco (será criado automaticamente)

## 🔄 Opção 1: Via Supabase CLI (Recomendado)

### Passo 1: Verificar Conexão

```bash
# Verificar se está conectado ao projeto correto
supabase status

# Se não estiver conectado:
supabase link --project-ref seu-project-ref
```

### Passo 2: Aplicar Migration

```bash
# Aplica todas as migrations pendentes
supabase db push

# Ou aplicar migration específica:
supabase db push supabase/migrations/20251110000001_add_user_roles_and_permissions.sql
```

### Passo 3: Verificar Aplicação

```bash
# Verificar se migration foi aplicada
supabase db remote list

# Deve aparecer:
# ✓ 20251110000001_add_user_roles_and_permissions.sql
```

## 🌐 Opção 2: Via Supabase Dashboard

### Passo 1: Acessar SQL Editor

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá em "SQL Editor" no menu lateral

### Passo 2: Executar Migration

1. Clique em "New query"
2. Abra o arquivo: `supabase/migrations/20251110000001_add_user_roles_and_permissions.sql`
3. Copie todo o conteúdo
4. Cole no SQL Editor
5. Clique em "Run" ou pressione Ctrl+Enter

### Passo 3: Verificar Sucesso

Se você ver mensagem de sucesso, prossiga para validação.

## ✅ Validação da Instalação

### 1. Verificar Tabelas Criadas

Execute no SQL Editor:

```sql
-- Verificar se coluna role foi adicionada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'role';

-- Deve retornar: role | USER-DEFINED
```

```sql
-- Verificar tabela de convites
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'user_invitations';

-- Deve retornar: user_invitations
```

```sql
-- Verificar tabela de logs
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'user_access_logs';

-- Deve retornar: user_access_logs
```

### 2. Verificar Primeiro Admin

```sql
-- Ver todos os usuários e seus roles
SELECT id, display_name, role, created_at 
FROM profiles 
ORDER BY created_at ASC;

-- O primeiro usuário deve ter role = 'admin'
```

### 3. Verificar Funções SQL

```sql
-- Testar função de verificação de role
SELECT user_has_role('SEU-USER-ID'::uuid, 'admin'::user_role);

-- Deve retornar: true (se você for admin)
```

### 4. Verificar RLS

```sql
-- Ver políticas RLS de projects
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'projects';

-- Deve mostrar políticas atualizadas
```

## 🧪 Teste Funcional

### 1. Teste no Frontend

```bash
# Inicie o servidor de desenvolvimento
npm run dev
```

### 2. Acesse a Aplicação

```
http://localhost:3000
```

### 3. Faça Login

Use sua conta existente (que agora deve ser admin)

### 4. Acesse Gerenciamento de Usuários

```
http://localhost:3000/usuarios
```

Se você conseguir acessar esta página, a instalação foi bem-sucedida! ✅

## 🔧 Troubleshooting

### Erro: "relation does not exist"

**Problema**: Tabela não foi criada
**Solução**:
```sql
-- Verifique se a migration foi realmente executada
SELECT * FROM supabase_migrations.schema_migrations 
WHERE version = '20251110000001';

-- Se não aparecer, execute a migration novamente
```

### Erro: "column 'role' does not exist"

**Problema**: Coluna não foi adicionada
**Solução**:
```sql
-- Adicionar coluna manualmente
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'viewer' NOT NULL;
```

### Erro: "type 'user_role' does not exist"

**Problema**: Enum não foi criado
**Solução**:
```sql
-- Criar enum manualmente
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'field_tech', 'viewer');
```

### Nenhum usuário é admin

**Problema**: Script de atribuição de admin não executou
**Solução**:
```sql
-- Pegar seu ID de usuário
SELECT id, email FROM auth.users WHERE email = 'seu-email@exemplo.com';

-- Atribuir role admin
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'SEU-USER-ID';
```

### Frontend não reconhece role

**Problema**: Cache ou rebuild necessário
**Solução**:
```bash
# Limpar cache e reconstruir
rm -rf node_modules/.vite
npm run dev
```

## 🔄 Rollback (Se Necessário)

Se algo der errado e você precisar reverter:

### Via CLI

```bash
# Reverter última migration
supabase db reset
```

### Manual

```sql
-- Remover coluna role
ALTER TABLE profiles DROP COLUMN IF EXISTS role;
ALTER TABLE profiles DROP COLUMN IF EXISTS role_metadata;

-- Remover tabelas
DROP TABLE IF EXISTS user_invitations CASCADE;
DROP TABLE IF EXISTS user_access_logs CASCADE;

-- Remover tipo enum
DROP TYPE IF EXISTS user_role CASCADE;

-- Restaurar políticas RLS antigas
-- (você precisará do backup das políticas)
```

## 📊 Verificação Final

Execute este checklist:

- [ ] Migration aplicada sem erros
- [ ] Coluna `role` existe em `profiles`
- [ ] Tabela `user_invitations` existe
- [ ] Tabela `user_access_logs` existe
- [ ] Primeiro usuário é admin
- [ ] Funções SQL funcionando
- [ ] Políticas RLS atualizadas
- [ ] Frontend reconhece roles
- [ ] Página `/usuarios` acessível para admin
- [ ] Menu lateral mostra seção "Administração"

## 🎉 Sucesso!

Se todos os itens do checklist estão ✅, sua instalação foi bem-sucedida!

## 📚 Próximos Passos

1. Leia o `QUICK_START_AUTH.md` para começar a usar
2. Consulte `AUTH_PERMISSIONS_IMPLEMENTATION.md` para detalhes
3. Crie usuários de teste com diferentes roles
4. Teste as funcionalidades de cada role

## 🆘 Precisa de Ajuda?

Se encontrar problemas:

1. Verifique os logs do Supabase
2. Consulte a documentação completa
3. Revise as políticas RLS
4. Teste com dados de exemplo

## ⚠️ Avisos Importantes

### Em Produção

- ✅ Faça backup antes de aplicar
- ✅ Teste em ambiente de staging primeiro
- ✅ Aplique em horário de baixo tráfego
- ✅ Monitore logs após aplicação
- ✅ Tenha plano de rollback pronto

### Segurança

- 🔐 O primeiro usuário será admin automaticamente
- 🔐 Todos os outros usuários serão viewers por padrão
- 🔐 Altere roles conforme necessário após instalação
- 🔐 Logs de auditoria começam a registrar imediatamente

## 📝 Notas de Versão

**Versão**: 1.0.0
**Data**: 10/11/2025
**Migration**: 20251110000001_add_user_roles_and_permissions.sql
**Compatibilidade**: PostgreSQL 13+, Supabase

## 🔗 Links Úteis

- [Documentação Completa](./AUTH_PERMISSIONS_IMPLEMENTATION.md)
- [Guia Rápido](./QUICK_START_AUTH.md)
- [Resumo da Implementação](./AUTH_IMPLEMENTATION_SUMMARY.md)
- [Supabase Docs](https://supabase.com/docs)
