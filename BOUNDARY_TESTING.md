# Guia de Testes de Error Boundaries

Este documento descreve como testar os Error Boundaries implementados na aplicação.

## 🎯 Objetivo

Garantir que todas as seções críticas da aplicação estejam protegidas com Error Boundaries e que os usuários vejam mensagens de erro apropriadas quando algo falha.

## 📋 Seções Protegidas

### 1. Dashboard
- **Boundary**: `LoadingBoundary`
- **Fallback**: `DashboardErrorFallback`
- **Localização**: `src/pages/Dashboard.tsx`
- **Testa**: Carregamento de projetos, stats, calendário

### 2. Projeto - Info Section
- **Boundary**: `LoadingBoundary`
- **Fallback**: `ProjectErrorFallback`
- **Localização**: `src/pages/ProjectDetailNew.tsx` (renderInfoSection)
- **Testa**: Carregamento de dados do projeto

### 3. Projeto - Seção de Peças
- **Boundary**: `LoadingBoundary`
- **Fallback**: `UploadErrorFallback`
- **Localização**: `src/pages/ProjectDetailNew.tsx` (renderPecasSection)
- **Testa**: Importação de Excel, listagem de instalações

### 4. Projeto - Seção de Relatórios
- **Boundary**: `LoadingBoundary`
- **Fallback**: `ReportErrorFallback`
- **Localização**: `src/pages/ProjectDetailNew.tsx` (renderRelatoriosSection)
- **Testa**: Geração de relatórios PDF/Excel

### 5. Projeto - Upload de Imagens
- **Boundary**: `LoadingBoundary`
- **Fallback**: `UploadErrorFallback`
- **Localização**: `src/pages/ProjectDetailNew.tsx` (renderArquivosSection)
- **Testa**: Upload e gerenciamento de imagens

### 6. Projeto - Upload de Arquivos
- **Boundary**: `LoadingBoundary`
- **Fallback**: `UploadErrorFallback`
- **Localização**: `src/pages/ProjectDetailNew.tsx` (renderArquivosSection)
- **Testa**: Upload de PDFs e documentos

### 7. App Principal
- **Boundary**: `ErrorBoundary`
- **Fallback**: UI padrão de erro
- **Localização**: `src/App.tsx`
- **Testa**: Erros globais da aplicação

## 🧪 Como Testar

### Método 1: Componente de Teste (Recomendado)

1. Acesse `/debug` no navegador
2. Role até "Teste de Error Boundaries"
3. Clique nos botões de teste para disparar erros
4. Verifique se o fallback apropriado aparece
5. Teste os botões de recuperação

### Método 2: Teste Manual

#### Dashboard
```typescript
// Em Dashboard.tsx, force um erro no loadProjects:
const loadProjects = async () => {
  throw new Error('Erro de teste no Dashboard');
  // ... código original
};
```

#### Upload de Arquivo
```typescript
// Em ProjectDetailNew.tsx, force um erro no handleFileUpload:
const handleFileUpload = async (event) => {
  throw new Error('Erro de teste no upload');
  // ... código original
};
```

#### Geração de Relatório
```typescript
// No ReportCustomizationModal, force um erro:
const handleGenerate = async () => {
  throw new Error('Erro de teste no relatório');
  // ... código original
};
```

### Método 3: Teste de Rede

1. Abra DevTools → Network
2. Configure "Offline" mode
3. Tente carregar projetos, fazer uploads, etc.
4. Verifique se os boundaries capturam erros de rede

## ✅ Checklist de Testes

- [ ] Dashboard carrega sem erros
- [ ] Dashboard mostra fallback quando há erro
- [ ] Botão "Recarregar Dashboard" funciona
- [ ] Seção Info do projeto mostra fallback em erro
- [ ] Botão "Voltar ao Dashboard" funciona
- [ ] Importação de Excel mostra fallback em erro
- [ ] Upload de imagens mostra fallback em erro
- [ ] Mensagens sugerem ações de recuperação
- [ ] Geração de relatório mostra fallback em erro
- [ ] Fallbacks têm botões de ação claros
- [ ] Erro não quebra toda a aplicação
- [ ] Outras seções continuam funcionando

## 🎨 Fallbacks Disponíveis

### ProjectErrorFallback
- Botão: "Tentar novamente"
- Botão: "Voltar ao Dashboard"
- Sugere voltar ao dashboard se persistir

### UploadErrorFallback
- Botão: "Tentar novamente"
- Lista possíveis causas do erro
- Sugere verificar conexão

### ReportErrorFallback
- Botão: "Tentar novamente"
- Recomenda verificar dados do projeto
- Sugere simplificar relatório

### GalleryErrorFallback
- Botão: "Recarregar galeria"
- Lista problemas comuns
- Sugere verificar conexão

### BulkOperationErrorFallback
- Botão: "Tentar novamente"
- Sugere reduzir itens selecionados
- Verifica permissões

### DashboardErrorFallback
- Botão: "Recarregar Dashboard"
- Botão: "Recarregar Página"
- Link para suporte

## 🔍 Validação

Para cada seção testada, verifique:

1. **Captura do erro**: O erro é capturado pelo boundary?
2. **UI de fallback**: A mensagem de erro é exibida?
3. **Clareza**: A mensagem é clara e útil?
4. **Ações**: Há botões de ação disponíveis?
5. **Recuperação**: Os botões funcionam corretamente?
6. **Isolamento**: Apenas a seção afetada quebra?
7. **Logging**: O erro é logado no errorMonitoring?

## 🐛 Problemas Conhecidos

Se encontrar problemas durante os testes, documente aqui:

- [ ] Nenhum problema encontrado até o momento

## 📝 Notas

- Todos os boundaries integram com `errorMonitoring` para captura de erros
- Fallbacks customizados fornecem contexto específico para cada tipo de erro
- LoadingBoundary suporta estado de loading e fallback de erro
- ErrorBoundary global captura erros não tratados por boundaries específicas

## 🚀 Próximos Passos

- [ ] Adicionar testes automatizados para boundaries
- [ ] Implementar retry automático para erros de rede
- [ ] Adicionar telemetria de erros
- [ ] Criar dashboard de monitoramento de erros
