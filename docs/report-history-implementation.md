# Implementação do Histórico de Relatórios com Supabase

## Visão Geral

Este documento descreve a implementação do sistema de histórico de relatórios que integra Supabase Storage e Database para armazenar e gerenciar relatórios de projetos.

## Arquitetura

### 1. Banco de Dados

**Tabela: `project_report_history`**

Armazena metadados dos relatórios gerados:

- `id` - UUID PRIMARY KEY (gerado automaticamente)
- `project_id` - Referência ao projeto
- `interlocutor` - 'cliente' ou 'fornecedor'
- `format` - 'pdf' ou 'xlsx'
- `generated_by` - UUID do usuário que gerou
- `generated_at` - Timestamp de geração
- `file_url` - URL pública do arquivo no Storage
- `file_name` - Nome do arquivo
- `sections_included` - JSONB com seções incluídas no relatório
- `stats` - JSONB com estatísticas do momento da geração
- `user_id` - UUID do usuário (para RLS)

**Índices:**
- `idx_report_history_project` - Para buscar por projeto
- `idx_report_history_user` - Para buscar por usuário
- `idx_report_history_generated_at` - Para ordenação por data

### 2. Storage

**Bucket: `reports`**

Configurações:
- **Público:** Não (acesso controlado por RLS)
- **Tamanho máximo:** 10MB por arquivo
- **Tipos permitidos:** PDF e XLSX
- **Estrutura de pastas:** `{user_id}/{project_id}/{filename}`

**RLS Policies:**
- Usuários autenticados podem fazer upload em suas próprias pastas
- Usuários só podem visualizar seus próprios arquivos
- Usuários podem deletar seus próprios arquivos

### 3. Componentes React

#### ReportShareModal
- Gerencia o processo de compartilhamento de relatórios
- Faz upload do arquivo para o Supabase Storage
- Calcula estatísticas do relatório
- Salva metadados no banco de dados
- Mantém compatibilidade com armazenamento local

#### ReportHistory
- Exibe histórico de relatórios (Supabase + Local Storage)
- Permite download de relatórios
- Permite visualização direta no navegador (apenas Supabase)
- Permite exclusão de relatórios

## Fluxo de Geração de Relatórios

1. **Usuário gera relatório** através do `ReportCustomizationModal`
2. **PDF/XLSX é gerado** usando `reports-new.ts`
3. **ReportShareModal é aberto** com o blob do relatório
4. **Salvamento automático:**
   - Salva no localStorage (compatibilidade)
   - Faz upload para Supabase Storage
   - Calcula estatísticas (pendências, concluídas, etc.)
   - Salva metadados no banco de dados
5. **Usuário pode compartilhar** via download, email ou WhatsApp

## Validação e Testes

### Pré-requisitos

1. **Migration executada com sucesso:**
   ```bash
   # Verificar se a tabela foi criada
   SELECT * FROM project_report_history LIMIT 1;
   
   # Verificar se o bucket foi criado
   SELECT * FROM storage.buckets WHERE id = 'reports';
   ```

2. **Usuário autenticado no sistema**

### Casos de Teste

#### Teste 1: Geração de Relatório PDF
1. Acesse um projeto
2. Vá para a aba "Relatórios"
3. Clique em "Gerar Relatório"
4. Configure as opções e escolha formato PDF
5. Gere o relatório
6. **Verificar:**
   - Console mostra logs de sucesso (✅)
   - Relatório aparece no histórico com badge "☁️ Cloud"
   - Arquivo pode ser baixado
   - Arquivo pode ser aberto no navegador (botão ExternalLink)

#### Teste 2: Geração de Relatório XLSX
1. Repita o Teste 1 com formato XLSX
2. **Verificar:**
   - Mesmo comportamento do PDF
   - Arquivo XLSX é válido e pode ser aberto no Excel

#### Teste 3: Histórico de Relatórios
1. Gere 2-3 relatórios diferentes
2. Acesse a aba "Relatórios"
3. **Verificar:**
   - Todos os relatórios aparecem
   - Badge "☁️ Cloud" para relatórios do Supabase
   - Informações corretas (data, interlocutor, tamanho)
   - Estatísticas corretas (se disponíveis)

#### Teste 4: Download de Relatório
1. No histórico, clique no botão Download
2. **Verificar:**
   - Arquivo é baixado corretamente
   - Nome do arquivo está correto
   - Conteúdo está íntegro

#### Teste 5: Visualização no Navegador
1. No histórico, clique no botão ExternalLink (apenas para relatórios Supabase)
2. **Verificar:**
   - Nova aba abre com o relatório
   - PDF renderiza corretamente
   - XLSX pode ser baixado

#### Teste 6: Exclusão de Relatório
1. No histórico, clique no botão Trash
2. Confirme a exclusão
3. **Verificar:**
   - Relatório é removido do histórico
   - Arquivo é deletado do Storage
   - Registro é removido do banco de dados

#### Teste 7: RLS (Row Level Security)
1. Faça login com usuário A
2. Gere um relatório
3. Faça logout e login com usuário B
4. **Verificar:**
   - Usuário B não vê relatórios do usuário A
   - Usuário B não consegue acessar URLs de arquivos do usuário A

### Verificação de Logs

Durante os testes, monitore o console do navegador para os seguintes logs:

**Sucesso:**
```
✅ Report saved to local storage successfully
✅ Report uploaded to Supabase Storage: [URL]
✅ Report statistics calculated: {...}
✅ Report saved to Supabase database successfully
```

**Erros comuns e soluções:**

```
❌ Error uploading to Supabase Storage
```
- Verificar se o bucket 'reports' existe
- Verificar policies do Storage
- Verificar se o usuário está autenticado

```
❌ Error saving report to Supabase database
```
- Verificar se a migration foi executada
- Verificar se a tabela existe
- Verificar RLS policies

## Troubleshooting

### Bucket não encontrado
Se você receber erro "Bucket not found":
1. Execute a migration novamente
2. Ou crie o bucket manualmente no Supabase Dashboard

### Erro de permissão (RLS)
Se você receber erro de permissão:
1. Verifique se o usuário está autenticado
2. Verifique as policies da tabela e do storage
3. Use o SQL Editor para testar:
   ```sql
   SELECT * FROM project_report_history WHERE user_id = auth.uid();
   ```

### Arquivo não carrega
Se o arquivo não carregar no navegador:
1. Verifique se a URL está correta
2. Verifique se o arquivo existe no Storage
3. Tente fazer download em vez de visualizar

## Melhorias Futuras

1. **Compressão de arquivos** - Reduzir tamanho dos PDFs/XLSX
2. **Cleanup automático** - Deletar relatórios antigos (>30 dias)
3. **Compartilhamento por link** - Gerar links temporários com expiração
4. **Estatísticas avançadas** - Dashboard de uso de relatórios
5. **Notificações** - Avisar quando relatório está pronto (para relatórios grandes)
6. **Versionamento** - Manter histórico de versões do mesmo relatório

## Notas Importantes

1. **Compatibilidade:** O sistema mantém armazenamento local para compatibilidade com versões antigas
2. **Error Handling:** Todos os erros são tratados gracefully - se Supabase falhar, o relatório ainda é salvo localmente
3. **Performance:** Upload é feito em background - não bloqueia o download local
4. **Segurança:** RLS garante que usuários só acessem seus próprios relatórios
5. **Limite de tamanho:** 10MB por arquivo (configurável na migration)
