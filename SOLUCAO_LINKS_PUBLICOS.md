# 🚨 SOLUÇÃO COMPLETA: Links Públicos para Relatórios

## 📋 RESUMO DO PROBLEMA
O botão de email está funcionando, mas ao tentar enviar email aparece:
> "O link público não pôde ser gerado. Use o botão de download para salvar o arquivo e envie manualmente."

**Causa:** A tabela `public_report_links` NÃO existe no Supabase.

## ✅ ESTRUTURA COMPLETA DO SISTEMA

### 1. **Frontend (React)**
- ✅ `src/services/reportSharing.ts` - Serviço completo de compartilhamento
- ✅ `src/components/reports/ReportShareModal.tsx` - Modal de compartilhamento
- ✅ `src/components/reports/PublicReportView.tsx` - Visualização pública
- ✅ `src/App.tsx` - Rota `/public/report/:token`

### 2. **Backend (Supabase)**
- ❌ Tabela `public_report_links` - **FALTA CRIAR**
- ✅ Edge Function `send-report-email` - Envio de emails
- ✅ Tabela `email_logs` - Logs de envio

### 3. **Tipos TypeScript**
- ✅ `src/integrations/supabase/types.ts` - Tipos atualizados

## 🛠️ INSTRUÇÕES DE APLICAÇÃO

### PASSO 1: Aplicar Migration no Supabase

1. **Acesse o Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/[SEU-PROJECT-ID]/sql/new
   ```

2. **Execute o SQL**
   
   Copie e execute TODO o conteúdo do arquivo:
   ```
   /workspace/supabase/migrations/20251015_apply_public_report_links.sql
   ```

3. **Verifique o Resultado**
   
   A última query deve retornar:
   - `table_exists`: `true`
   - `indices_count`: `4` ou mais
   - `policies_count`: `4` ou mais
   - `functions_count`: `3`
   - `view_exists`: `true`

### PASSO 2: Configurar Variáveis de Ambiente (se necessário)

Verifique se estas variáveis estão configuradas no Supabase:

1. **No Dashboard do Supabase**
   ```
   Settings > Edge Functions > Environment Variables
   ```

2. **Variáveis Necessárias:**
   - `RESEND_API_KEY` - Chave da API do Resend para envio de emails
   - `APP_DOMAIN` - Domínio da aplicação (ex: https://deamanager.com)

### PASSO 3: Testar o Sistema

1. **Gere um novo relatório**
2. **Clique em "Configurar Envio por Email"**
3. **Preencha o email do destinatário**
4. **Clique em "Enviar Email"**

## 🎯 RESULTADO ESPERADO

✅ **Sucesso:**
- Modal de loading aparece
- Link público é gerado
- Email é enviado
- Mensagem de sucesso é exibida

❌ **Se ainda falhar:**
- Verifique os logs do console do navegador
- Procure por:
  - "Generating public link..."
  - "Public link generated successfully"
  - "Error generating public link:"

## 🔍 TROUBLESHOOTING

### Erro: "Failed to create public link"
- Verifique se a tabela foi criada corretamente
- Verifique as políticas RLS
- Verifique se o usuário está autenticado

### Erro: "Serviço de email não configurado"
- Configure `RESEND_API_KEY` no Supabase

### Erro: "Limite de envios atingido"
- Limite de 50 emails por dia por usuário
- Aguarde até o próximo dia

## 📊 ESTRUTURA DA TABELA public_report_links

```sql
CREATE TABLE public_report_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES project_report_history(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);
```

## 🔐 POLÍTICAS RLS

1. **Users can view their own public links** - SELECT próprios links
2. **Users can create public links for their reports** - INSERT próprios relatórios
3. **Users can update their own public links** - UPDATE próprios links
4. **Public can access link data via valid token** - SELECT público com token

## 🚀 FUNÇÕES AUXILIARES

1. **increment_public_link_access** - Incrementa contador de acessos
2. **cleanup_expired_public_links** - Limpa links expirados
3. **get_public_report_access** - Busca relatório por token

## ✨ FLUXO COMPLETO

1. Usuário clica em "Enviar por Email"
2. Frontend chama `reportSharingService.generatePublicLink()`
3. Cria registro em `public_report_links` com token hash
4. Retorna URL pública com token
5. Frontend chama edge function `send-report-email`
6. Edge function envia email com link
7. Destinatário acessa `/public/report/:token`
8. Sistema valida token e mostra relatório

---

**IMPORTANTE:** Após aplicar a migration, o sistema de links públicos estará 100% funcional!