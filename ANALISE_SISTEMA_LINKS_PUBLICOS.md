# Análise do Sistema de Links Públicos - DEA Manager

## Data da Análise: 15/10/2025

## 1. Estado Atual da Implementação

### 1.1 Componentes Existentes

#### ReportShareModal.tsx
- **Localização**: `src/components/reports/ReportShareModal.tsx`
- **Funcionalidades Implementadas**:
  - Modal de compartilhamento de relatórios
  - Métodos de compartilhamento: Download, Email, WhatsApp e Copiar Link
  - Salva histórico de relatórios localmente (IndexedDB)
  - Upload para Supabase Storage (bucket 'reports')
  - Calcula estatísticas do relatório no momento da geração
  
- **Limitações Identificadas**:
  - Função "Copiar Link" está apenas simulada (mockada)
  - Não gera links públicos reais
  - Sem sistema de tokens de acesso
  - Sem expiração de links

#### Tabela project_report_history (Banco de Dados)
- **Localização**: `supabase/migrations/20251010000000_create_project_report_history.sql`
- **Estrutura**:
  ```sql
  - id: UUID
  - project_id: UUID (referência para projects)
  - interlocutor: TEXT ('cliente' ou 'fornecedor')
  - format: TEXT ('pdf' ou 'xlsx')
  - generated_by: UUID (usuário que gerou)
  - generated_at: TIMESTAMP
  - file_url: TEXT
  - file_name: TEXT
  - sections_included: JSONB
  - stats: JSONB
  - user_id: UUID
  ```
- **Políticas RLS**: Usuários só podem ver/criar/deletar seus próprios relatórios
- **Storage Bucket**: Configurado com políticas de segurança

### 1.2 Arquivos/Serviços Ausentes
- ❌ **src/services/reportSharing.ts**: Arquivo não existe
- ❌ **Componente de visualização pública**: Não existe página/componente para visualizar relatórios publicamente
- ❌ **Sistema de tokens**: Não há implementação de tokens de acesso para links públicos
- ❌ **Sistema de expiração**: Não há mecanismo de expiração de links

## 2. Gaps Identificados

### 2.1 Sistema de Links Públicos
**Gap**: Não existe implementação real de links públicos
- O modal tem um botão "Copiar Link" mas apenas simula a funcionalidade
- Não há geração de tokens únicos para acesso público
- Não há rotas públicas para visualização de relatórios

### 2.2 Sistema de Expiração de Links
**Gap**: Não há controle de expiração de links compartilhados
- A tabela `project_report_history` não tem campo para expiração
- Não há lógica para validar se um link ainda é válido
- URLs assinadas do Supabase Storage expiram em 15 minutos (muito curto para compartilhamento)

### 2.3 Tokens de Acesso Seguro
**Gap**: Não existe sistema de tokens para links públicos
- Sem geração de tokens únicos para cada compartilhamento
- Sem tabela para armazenar tokens e suas permissões
- Sem validação de tokens nas requisições

### 2.4 Página de Visualização Pública Responsiva
**Gap**: Não existe página pública para visualizar relatórios
- Todas as rotas atuais requerem autenticação
- Não há componente de visualização pública de relatórios
- Não há layout responsivo específico para visualização pública

## 3. Melhorias Necessárias

### 3.1 Implementar Sistema de Links Públicos
1. **Criar serviço `reportSharing.ts`**:
   ```typescript
   - generatePublicLink(reportId: string, expiresIn?: number): Promise<PublicLink>
   - validatePublicToken(token: string): Promise<boolean>
   - revokePublicLink(linkId: string): Promise<void>
   ```

2. **Criar tabela `public_report_links`**:
   ```sql
   - id: UUID
   - report_id: UUID (referência para project_report_history)
   - token: TEXT (único, hash do token real)
   - expires_at: TIMESTAMP
   - access_count: INTEGER
   - max_access_count: INTEGER (opcional)
   - created_by: UUID
   - created_at: TIMESTAMP
   - is_active: BOOLEAN
   ```

### 3.2 Implementar Sistema de Expiração
1. **Adicionar lógica de expiração**:
   - Campo `expires_at` na tabela de links públicos
   - Validação automática na consulta
   - Opções de expiração: 1 hora, 24 horas, 7 dias, 30 dias, personalizado
   - Cleanup automático de links expirados

### 3.3 Implementar Tokens de Acesso Seguro
1. **Sistema de tokens**:
   - Gerar tokens únicos usando crypto.randomUUID()
   - Armazenar hash do token no banco (não o token em si)
   - Validação server-side do token
   - Rate limiting por token

### 3.4 Criar Página de Visualização Pública
1. **Nova rota pública**:
   ```tsx
   <Route path="/public/report/:token" element={<PublicReportView />} />
   ```

2. **Componente `PublicReportView`**:
   - Layout responsivo sem navegação autenticada
   - Validação do token antes de exibir conteúdo
   - Visualização read-only do relatório
   - Opção de download se permitido
   - Marca d'água ou indicação de compartilhamento público

### 3.5 Atualizar ReportShareModal
1. **Implementar funcionalidade real de "Copiar Link"**:
   - Chamar API para gerar link público
   - Configurar tempo de expiração
   - Copiar link real para clipboard
   - Mostrar informações do link (expiração, etc.)

## 4. Plano de Implementação Sugerido

### Fase 1: Backend (Prioridade Alta)
1. Criar migração para tabela `public_report_links`
2. Implementar serviço `reportSharing.ts`
3. Criar edge function para validação de tokens
4. Implementar políticas de segurança

### Fase 2: Frontend - Visualização Pública (Prioridade Alta)
1. Criar componente `PublicReportView`
2. Adicionar rota pública
3. Implementar layout responsivo
4. Adicionar validação de token

### Fase 3: Integração (Prioridade Média)
1. Atualizar `ReportShareModal` para usar novo sistema
2. Adicionar configurações de expiração
3. Implementar gestão de links (listar, revogar)
4. Adicionar analytics de acesso

### Fase 4: Melhorias (Prioridade Baixa)
1. Sistema de permissões granular (visualizar vs. baixar)
2. Proteção por senha adicional
3. Limite de acessos por link
4. Notificações de acesso

## 5. Considerações de Segurança

1. **Tokens**: Usar hashes seguros (SHA-256) para armazenar tokens
2. **Rate Limiting**: Implementar limite de tentativas por IP
3. **Validação**: Sempre validar server-side
4. **Logs**: Registrar todos os acessos para auditoria
5. **CORS**: Configurar adequadamente para permitir embed em outros sites

## 6. Estimativa de Esforço

- **Backend**: 3-4 dias
- **Frontend**: 2-3 dias
- **Testes e Ajustes**: 1-2 dias
- **Total**: ~1 semana de desenvolvimento

## Conclusão

O sistema atual tem uma base sólida com armazenamento de relatórios e modal de compartilhamento, mas falta a implementação real de links públicos. A principal necessidade é criar todo o fluxo de geração, validação e visualização pública de relatórios com controle de acesso e expiração.