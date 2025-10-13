# Guia de Tratamento de Erros

Este guia documenta os padrões e melhores práticas para tratamento de erros no projeto.

## 📋 Índice

1. [Princípios Fundamentais](#princípios-fundamentais)
2. [Padrões de Código](#padrões-de-código)
3. [Mensagens de Erro](#mensagens-de-erro)
4. [Error Boundaries](#error-boundaries)
5. [Loading States](#loading-states)
6. [Checklist para PRs](#checklist-para-prs)

---

## 🎯 Princípios Fundamentais

### 1. Todo `catch` block DEVE ter logging

**❌ Errado:**
```typescript
try {
  await uploadFile(file);
} catch (error) {
  toast.error('Erro no upload');
}
```

**✅ Correto:**
```typescript
try {
  await uploadFile(file);
} catch (error) {
  console.error('File upload failed:', error, {
    context: 'FileUpload.handleUpload',
    fileName: file.name,
    fileSize: file.size,
    operation: 'file upload'
  });
  toast.error('Erro no upload', 'Verifique sua conexão e tente novamente');
}
```

**Por quê?**
- Facilita debugging em produção
- Logs estruturados ajudam a identificar padrões
- Contexto adicional acelera resolução de bugs

### 2. Operações críticas DEVEM ter retry automático

Use `withRetry` para operações que podem falhar temporariamente:

```typescript
import { withRetry } from '@/services/sync/utils';

try {
  const result = await withRetry(
    () => uploadToStorage(file, { projectId, installationId, id }),
    {
      maxAttempts: 5,
      baseDelay: 500,
      retryCondition: (error) => {
        // Retry em erros de rede ou 5xx
        return error?.message?.includes('fetch') || 
               error?.message?.includes('network') ||
               error?.status >= 500;
      }
    }
  );
} catch (error) {
  console.error('Upload failed after all retry attempts:', error);
  // Mostrar mensagem amigável ao usuário
}
```

**Quando usar retry:**
- ✅ Uploads de arquivos/imagens
- ✅ Operações de sincronização
- ✅ Requisições HTTP que podem ter timeout
- ✅ Operações de banco de dados remoto
- ❌ Erros de validação (não deve tentar novamente)
- ❌ Erros 4xx (problema com a requisição)

### 3. Seções da aplicação DEVEM ter Error Boundaries

Use `LoadingBoundary` para proteger componentes críticos:

```typescript
import { LoadingBoundary } from '@/components/loading-boundary';
import { ProjectErrorFallback } from '@/components/error-fallbacks';

function ProjectPage() {
  return (
    <LoadingBoundary
      isLoading={loading}
      loadingMessage="Carregando projeto..."
      fallback={ProjectErrorFallback}
    >
      <ProjectContent />
    </LoadingBoundary>
  );
}
```

### 4. Usuário SEMPRE deve receber feedback

**Princípio:** Nunca deixe o usuário sem saber o que aconteceu.

```typescript
try {
  await performOperation();
  // ✅ Sucesso - mostrar feedback positivo
  toast.success('Operação concluída com sucesso');
} catch (error) {
  // ✅ Erro - mostrar feedback com ação sugerida
  toast.error(
    'Não foi possível completar a operação',
    'Verifique sua conexão e tente novamente'
  );
}
```

---

## 💻 Padrões de Código

### Template 1: Try-Catch Básico com Logging

```typescript
const handleOperation = async () => {
  try {
    // Operação assíncrona
    const result = await someAsyncOperation();
    
    // Feedback de sucesso
    toast.success('Operação concluída');
    
    return result;
  } catch (error) {
    // 1. Logging estruturado
    console.error('Operation failed:', error, {
      context: 'Component.handleOperation',
      operation: 'description of operation',
      // Adicionar contexto relevante
      userId: user?.id,
      timestamp: Date.now()
    });
    
    // 2. Feedback ao usuário
    toast.error(
      'Título do erro',
      'Descrição amigável com próximo passo'
    );
    
    // 3. Propagar ou retornar valor seguro
    throw error; // ou return null;
  }
};
```

### Template 2: Operação com Retry

```typescript
import { withRetry } from '@/services/sync/utils';

const uploadWithRetry = async (file: File) => {
  try {
    const result = await withRetry(
      () => uploadToStorage(file, metadata),
      {
        maxAttempts: 5,           // Até 5 tentativas
        baseDelay: 500,            // Delay inicial de 500ms
        maxDelay: 8000,            // Delay máximo de 8s
        retryCondition: (error) => {
          console.log(`Upload attempt failed, checking if should retry...`, error);
          // Condições para retry
          return error?.message?.includes('fetch') || 
                 error?.message?.includes('network') ||
                 error?.status >= 500;
        }
      }
    );
    
    return result;
  } catch (error) {
    console.error('Upload failed after all retry attempts:', error, {
      context: 'uploadWithRetry',
      fileName: file.name,
      fileSize: file.size,
      operation: 'file upload with retry'
    });
    
    toast.error(
      'Não foi possível enviar o arquivo',
      'Após várias tentativas. Verifique sua conexão.'
    );
    
    throw error;
  }
};
```

### Template 3: Componente com Error Boundary

```typescript
import { LoadingBoundary } from '@/components/loading-boundary';
import { SectionErrorFallback } from '@/components/error-fallbacks';

export function MyComponent() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchData();
      setData(result);
    } catch (error) {
      console.error('Failed to load data:', error, {
        context: 'MyComponent.loadData',
        operation: 'fetch component data'
      });
      // Error boundary vai capturar
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoadingBoundary
      isLoading={loading}
      loadingMessage="Carregando dados..."
      fallback={SectionErrorFallback}
    >
      <div>{/* Conteúdo */}</div>
    </LoadingBoundary>
  );
}
```

### Template 4: Operação CRUD com Loading State

```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSave = async () => {
  // Prevenir duplo-clique
  if (isSubmitting) return;
  
  setIsSubmitting(true);
  
  try {
    await saveData(formData);
    
    toast.success('Dados salvos com sucesso');
    onSuccess?.();
  } catch (error) {
    console.error('Failed to save data:', error, {
      context: 'Form.handleSave',
      formData: { /* dados relevantes sem informações sensíveis */ },
      operation: 'save form data'
    });
    
    toast.error(
      'Não foi possível salvar',
      'Verifique os dados e tente novamente'
    );
  } finally {
    setIsSubmitting(false);
  }
};

return (
  <Button 
    onClick={handleSave}
    disabled={isSubmitting}
  >
    {isSubmitting && <Spinner size="sm" className="mr-2" />}
    {isSubmitting ? 'Salvando...' : 'Salvar'}
  </Button>
);
```

### Template 5: Blocking Overlay para Operações Críticas

```typescript
import { BlockingOverlay } from '@/components/ui/blocking-overlay';

function ImportComponent() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleImport = async (files: File[]) => {
    setIsImporting(true);
    setProgress({ current: 0, total: files.length });
    
    try {
      for (let i = 0; i < files.length; i++) {
        await processFile(files[i]);
        setProgress({ current: i + 1, total: files.length });
      }
      
      toast.success('Importação concluída');
    } catch (error) {
      console.error('Import failed:', error, {
        context: 'ImportComponent.handleImport',
        fileCount: files.length,
        currentFile: progress.current,
        operation: 'batch file import'
      });
      
      toast.error(
        'Erro na importação',
        'Alguns arquivos podem não ter sido importados'
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      {/* Seu componente */}
      
      <BlockingOverlay 
        isVisible={isImporting}
        message="Importando arquivos..."
        progress={{
          current: progress.current,
          total: progress.total,
          label: 'Arquivos processados'
        }}
      />
    </>
  );
}
```

---

## 📝 Mensagens de Erro

### Princípios para Mensagens Amigáveis

1. **Use linguagem clara e simples**
2. **Evite jargão técnico**
3. **Sempre sugira próximo passo**
4. **Seja específico quando possível**
5. **Mantenha tom amigável e não culpe o usuário**

### ❌ Mensagens RUINS

```typescript
// Muito técnica
"Error 500: Internal Server Error"

// Sem contexto
"Erro"

// Sem ação sugerida
"Falha ao processar requisição"

// Tom acusatório
"Você inseriu dados inválidos"
```

### ✅ Mensagens BOAS

```typescript
// Clara e com solução
toast.error(
  'Não foi possível salvar o projeto',
  'Verifique sua conexão com a internet e tente novamente'
);

// Específica e útil
toast.error(
  'Arquivo muito grande',
  'O arquivo deve ter no máximo 5MB. Tente comprimir ou escolher outro arquivo'
);

// Contextualizada
toast.error(
  'Não foi possível enviar ${fileName}',
  'Após várias tentativas. Verifique sua conexão e tente novamente'
);

// Com próximos passos claros
toast.error(
  'Erro ao gerar relatório',
  'Verifique se o projeto possui dados suficientes e tente novamente'
);
```

### Estrutura Recomendada

```typescript
toast.error(
  'TÍTULO_CURTO_E_CLARO',      // O que aconteceu
  'Descrição e próximo passo'   // Por que e o que fazer
);
```

### Exemplos por Contexto

#### Upload de Arquivos
```typescript
// ✅ Bom
'Não foi possível enviar o arquivo após várias tentativas. Verifique sua conexão.'

// ❌ Ruim
'Upload failed'
```

#### Validação de Formulário
```typescript
// ✅ Bom
'Nome do projeto é obrigatório e deve ter no mínimo 3 caracteres'

// ❌ Ruim
'Dados inválidos'
```

#### Erro de Rede
```typescript
// ✅ Bom
'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.'

// ❌ Ruim
'Network error'
```

#### Erro de Sincronização
```typescript
// ✅ Bom
'Algumas alterações não puderam ser sincronizadas. Tentaremos novamente automaticamente.'

// ❌ Ruim
'Sync failed'
```

---

## 🛡️ Error Boundaries

### Error Boundaries Disponíveis

O projeto possui vários error boundaries especializados em `src/components/error-fallbacks.tsx`:

#### 1. ProjectErrorFallback
Para páginas de projeto:
```typescript
<LoadingBoundary fallback={ProjectErrorFallback}>
  <ProjectContent />
</LoadingBoundary>
```
- Sugere: Voltar ao dashboard ou recarregar
- Contexto: Falha ao carregar dados do projeto

#### 2. UploadErrorFallback
Para componentes de upload:
```typescript
<LoadingBoundary fallback={UploadErrorFallback}>
  <FileUpload />
</LoadingBoundary>
```
- Sugere: Verificar conexão e tamanho dos arquivos
- Contexto: Falha em upload de arquivos

#### 3. ReportErrorFallback
Para geração de relatórios:
```typescript
<LoadingBoundary fallback={ReportErrorFallback}>
  <ReportGenerator />
</LoadingBoundary>
```
- Sugere: Verificar dados do projeto
- Contexto: Falha ao gerar relatório

#### 4. DashboardErrorFallback
Para dashboard principal:
```typescript
<LoadingBoundary fallback={DashboardErrorFallback}>
  <DashboardContent />
</LoadingBoundary>
```
- Sugere: Recarregar página
- Contexto: Falha ao carregar dashboard

#### 5. SectionErrorFallback
Fallback genérico para seções:
```typescript
<LoadingBoundary fallback={SectionErrorFallback}>
  <GenericSection />
</LoadingBoundary>
```
- Sugere: Tentar novamente ou voltar
- Contexto: Falha em seção genérica

### Quando Usar Error Boundaries

**✅ Use em:**
- Páginas principais (Dashboard, ProjectDetail)
- Componentes de upload/download
- Geração de relatórios
- Formulários complexos
- Componentes que fazem requisições HTTP

**❌ Não é necessário em:**
- Componentes puramente visuais (botões, badges)
- Componentes muito simples
- Componentes já dentro de outro boundary

---

## ⏳ Loading States

### Princípios

1. **Todo estado de loading deve ser visível**
2. **Botões devem ser desabilitados durante operações**
3. **Use debounce em buscas e filtros (300ms)**
4. **Operações críticas devem ter overlay bloqueante**

### Loading em Botões

```typescript
<Button 
  onClick={handleSave}
  disabled={isSubmitting}
>
  {isSubmitting && <Spinner size="sm" className="mr-2" />}
  {isSubmitting ? 'Salvando...' : 'Salvar'}
</Button>
```

### Blocking Overlay

Para operações que não devem ser interrompidas:

```typescript
<BlockingOverlay 
  isVisible={isProcessing}
  message="Processando dados..."
  progress={progressData}  // Opcional
/>
```

### Debounce em Buscas

```typescript
import { useDebounce } from '@/hooks/useDebounce';

const [searchTerm, setSearchTerm] = useState('');
const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

const debouncedSearch = useDebounce((value: string) => {
  setDebouncedSearchTerm(value);
}, 300);

<Input
  value={searchTerm}
  onChange={(e) => {
    setSearchTerm(e.target.value);
    debouncedSearch(e.target.value);
  }}
/>

// Usar debouncedSearchTerm nos filtros
const filtered = items.filter(item => 
  item.name.includes(debouncedSearchTerm)
);
```

---

## ✅ Checklist para Pull Requests

Use este checklist ao revisar ou criar PRs:

### Logging

- [ ] Todos os `catch` blocks têm `console.error()` com contexto
- [ ] Logs incluem informações relevantes (IDs, nomes de arquivo, etc.)
- [ ] Logs seguem o padrão: `console.error('Description:', error, { context, operation })`
- [ ] Informações sensíveis NÃO são logadas (senhas, tokens, etc.)

### Retry

- [ ] Operações de rede usam `withRetry`
- [ ] Upload de arquivos tem retry configurado
- [ ] Operações de sincronização usam retry
- [ ] `retryCondition` está configurada corretamente (5xx, network errors)

### Error Boundaries

- [ ] Componentes críticos estão envolvidos com `LoadingBoundary`
- [ ] Fallback apropriado foi escolhido para o contexto
- [ ] `loadingMessage` é descritiva e específica
- [ ] Error boundary não está aninhado desnecessariamente

### Loading States

- [ ] Toda operação assíncrona tem loading state visível
- [ ] Botões são desabilitados durante operações (`disabled={isLoading}`)
- [ ] Spinners aparecem em botões durante processamento
- [ ] Buscas e filtros usam debounce (300ms)
- [ ] Operações críticas têm `BlockingOverlay`

### Mensagens de Erro

- [ ] Mensagens são amigáveis e sem jargão técnico
- [ ] Mensagens sempre sugerem próximo passo
- [ ] Título é curto e descritivo
- [ ] Descrição explica o que fazer
- [ ] Tom é amigável e não acusatório

### Prevenção de Erros

- [ ] Validação de formulários antes de submeter
- [ ] Verificação de tipos/nulos antes de acessar propriedades
- [ ] Tratamento de casos edge (array vazio, null, undefined)
- [ ] Operações não podem ser disparadas duas vezes (duplo-clique)

### Testes (quando aplicável)

- [ ] Testes incluem casos de erro
- [ ] Mock de falhas de rede está coberto
- [ ] Validação de mensagens de erro
- [ ] Comportamento de retry é testado

---

## 📚 Recursos Adicionais

### Arquivos Importantes

- `src/services/sync/utils.ts` - Função `withRetry`
- `src/components/loading-boundary.tsx` - Error Boundary component
- `src/components/error-fallbacks.tsx` - Fallbacks customizados
- `src/components/ui/blocking-overlay.tsx` - Overlay bloqueante
- `src/hooks/useDebounce.ts` - Hook de debounce

### Logs Estruturados

Exemplo de log bem estruturado:

```typescript
console.error('Operation failed:', error, {
  context: 'Component.method',
  operation: 'descriptive operation name',
  userId: user?.id,
  projectId: project?.id,
  fileName: file?.name,
  fileSize: file?.size,
  timestamp: Date.now(),
  // Qualquer contexto adicional relevante
});
```

### Referências

- [Error Handling Best Practices - React](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Exponential Backoff - AWS](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [User-Friendly Error Messages - Nielsen Norman Group](https://www.nngroup.com/articles/error-message-guidelines/)

---

## 🤝 Contribuindo

Ao adicionar novos componentes ou features:

1. **Sempre** adicione try-catch com logging apropriado
2. **Sempre** envolva componentes críticos com LoadingBoundary
3. **Sempre** use retry em operações de rede
4. **Sempre** forneça feedback visual ao usuário
5. **Sempre** escreva mensagens de erro amigáveis

**Lembre-se:** Erros vão acontecer. O importante é como lidamos com eles para garantir a melhor experiência ao usuário.

---

*Última atualização: Outubro 2025*
