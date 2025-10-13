# Guia de Tratamento de Erros

Este documento estabelece as práticas e padrões de tratamento de erros do projeto, garantindo uma experiência consistente e resiliente para os usuários.

## 📋 Índice

1. [Princípios](#princípios)
2. [Padrões de Código](#padrões-de-código)
3. [Mensagens de Erro](#mensagens-de-erro)
4. [Checklist para PRs](#checklist-para-prs)

---

## Princípios

### 1. Todo catch block deve ter logging

**Sempre** registre erros capturados para facilitar debugging e monitoramento. Nunca silencie erros sem registrá-los.

```typescript
// ✅ CORRETO
try {
  await operation();
} catch (error) {
  logger.error('Falha ao executar operação', error);
  throw error; // ou trate adequadamente
}

// ❌ INCORRETO
try {
  await operation();
} catch (error) {
  // Erro silencioso - nunca faça isso!
}
```

### 2. Operações críticas devem ter retry

Operações de rede, acesso a banco de dados e chamadas a APIs externas devem implementar lógica de retry com backoff exponencial.

### 3. Seções da aplicação devem ter error boundaries

Cada seção principal deve estar envolvida em um Error Boundary para prevenir que erros isolados quebrem toda a aplicação.

### 4. Usuário sempre deve receber feedback

O usuário deve sempre saber o que aconteceu, seja sucesso ou erro, com mensagens claras e ações sugeridas.

---

## Padrões de Código

### Template de Try-Catch com Logging

Use este padrão para operações síncronas e assíncronas:

```typescript
import { logger } from '@/services/logger';

async function saveData(data: any) {
  try {
    logger.info('Iniciando salvamento de dados');
    const result = await database.save(data);
    logger.info('Dados salvos com sucesso', { id: result.id });
    return result;
  } catch (error) {
    logger.error('Erro ao salvar dados', {
      error,
      data,
      timestamp: new Date().toISOString()
    });
    throw error; // Re-throw para tratamento em nível superior
  }
}
```

### Como usar withRetry

A função `withRetry` implementa retry automático com backoff exponencial. Use para operações que podem falhar temporariamente:

```typescript
import { withRetry } from '@/services/sync/utils';

// Exemplo básico
const result = await withRetry(
  async () => {
    return await fetch('/api/data');
  },
  {
    maxAttempts: 5,      // Padrão: 5
    baseDelay: 500,      // Padrão: 500ms
    maxDelay: 8000       // Padrão: 8000ms
  },
  'Buscar dados da API' // Nome da operação para logs
);

// Exemplo com condição customizada
const data = await withRetry(
  async () => {
    const response = await supabase
      .from('projects')
      .select('*');
    
    if (response.error) throw response.error;
    return response.data;
  },
  {
    maxAttempts: 3,
    retryCondition: (error) => {
      // Retry apenas em erros de rede
      return error?.message?.includes('network');
    }
  },
  'Carregar projetos'
);
```

**Quando usar withRetry:**
- ✅ Chamadas de API externas
- ✅ Operações de banco de dados
- ✅ Upload/download de arquivos
- ✅ Sincronização de dados
- ❌ Validação de formulários
- ❌ Erros de lógica de negócio

### Como usar LoadingBoundary

`LoadingBoundary` combina gerenciamento de loading state com error boundary:

```typescript
import { LoadingBoundary } from '@/components/loading-boundary';

function MyComponent() {
  const [isLoading, setIsLoading] = useState(true);
  
  return (
    <LoadingBoundary
      isLoading={isLoading}
      loadingMessage="Carregando dados..."
      fallback={CustomErrorFallback}
    >
      <YourContent />
    </LoadingBoundary>
  );
}

// Fallback customizado (opcional)
function CustomErrorFallback({ error }: { error?: Error }) {
  return (
    <div className="p-6 text-center">
      <h3>Não foi possível carregar os dados</h3>
      <p>{error?.message}</p>
      <button onClick={() => window.location.reload()}>
        Tentar novamente
      </button>
    </div>
  );
}
```

**Onde usar LoadingBoundary:**
- ✅ Páginas completas (Dashboard, ProjectDetail)
- ✅ Seções com carregamento assíncrono
- ✅ Componentes que fazem chamadas de API
- ✅ Formulários complexos com operações assíncronas

### Como usar ErrorBoundary

Para componentes que precisam apenas de proteção contra erros (sem loading state):

```typescript
import ErrorBoundary from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        {/* Sua aplicação */}
      </Router>
    </ErrorBoundary>
  );
}

// Com fallback customizado
function CriticalSection() {
  return (
    <ErrorBoundary fallback={<CustomFallback />}>
      <ImportantFeature />
    </ErrorBoundary>
  );
}
```

---

## Mensagens de Erro

### Como escrever mensagens amigáveis

#### Princípios:

1. **Use linguagem simples e direta**
2. **Evite jargão técnico**
3. **Sempre sugira um próximo passo**
4. **Seja empático e positivo**

### Exemplos de Boas e Más Mensagens

#### ❌ Mensagens Ruins

```typescript
// Muito técnico
"Error: ECONNREFUSED at Socket.connect (net.js:1141)"

// Sem contexto
"Erro"

// Sem ação sugerida
"Não foi possível completar a operação"

// Tom negativo/culpando usuário
"Você inseriu dados inválidos"
```

#### ✅ Mensagens Boas

```typescript
// Clara e com ação
"Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente."

// Específica e útil
"O arquivo deve ter no máximo 5MB. Por favor, escolha um arquivo menor."

// Empática
"Ops! Algo deu errado ao salvar suas alterações. Vamos tentar novamente?"

// Com próximos passos
"Não foi possível carregar os projetos. Você pode:
• Recarregar a página
• Verificar sua conexão com internet
• Entrar em contato com o suporte"
```

### Template de Mensagens

Use este template para criar mensagens consistentes:

```typescript
interface ErrorMessage {
  title: string;      // O que aconteceu (curto)
  description: string; // Por que aconteceu (opcional)
  action: string;     // O que fazer agora
}

// Exemplo de uso
const networkError: ErrorMessage = {
  title: "Não foi possível conectar",
  description: "Verifique sua conexão com a internet",
  action: "Tentar novamente"
};

const uploadError: ErrorMessage = {
  title: "Erro no upload do arquivo",
  description: "O arquivo é muito grande (máximo: 5MB)",
  action: "Escolher outro arquivo"
};
```

### Exemplos por Categoria

#### Erros de Rede

```typescript
// ❌ Ruim
"Network error"

// ✅ Bom
"Sem conexão com a internet. Suas alterações serão salvas quando você reconectar."
```

#### Erros de Validação

```typescript
// ❌ Ruim
"Invalid input"

// ✅ Bom
"O campo 'E-mail' deve conter um endereço válido, como exemplo@email.com"
```

#### Erros de Permissão

```typescript
// ❌ Ruim
"403 Forbidden"

// ✅ Bom
"Você não tem permissão para realizar esta ação. Entre em contato com o administrador."
```

#### Erros de Dados Não Encontrados

```typescript
// ❌ Ruim
"404 Not Found"

// ✅ Bom
"Projeto não encontrado. Ele pode ter sido removido ou você não tem acesso a ele."
```

---

## Checklist para PRs

Use este checklist ao revisar ou criar pull requests:

### ✅ Logging

- [ ] Todos os `catch` blocks têm `logger.error()` ou `console.error()`
- [ ] Logs incluem contexto suficiente (parâmetros, IDs, timestamps)
- [ ] Informações sensíveis não são logadas (senhas, tokens)
- [ ] Logs usam níveis apropriados (info, warn, error)

### ✅ Retry e Resiliência

- [ ] Operações de rede usam `withRetry`
- [ ] Chamadas ao Supabase têm tratamento de retry quando apropriado
- [ ] Upload de arquivos implementa retry
- [ ] Timeouts estão configurados para operações longas

### ✅ Error Boundaries

- [ ] Novas páginas estão envolvidas em `LoadingBoundary` ou `ErrorBoundary`
- [ ] Componentes críticos têm error boundary dedicado
- [ ] Fallbacks customizados são fornecidos quando necessário
- [ ] Error boundaries não escondem erros em desenvolvimento

### ✅ Loading States

- [ ] Estados de loading são mostrados para operações assíncronas
- [ ] Spinners/skeletons são usados adequadamente
- [ ] Loading states são cancelados em unmount (cleanup)
- [ ] Não há "flash" de conteúdo durante loading

### ✅ Mensagens de Erro

- [ ] Mensagens são em português claro
- [ ] Não há jargão técnico exposto ao usuário
- [ ] Cada erro sugere um próximo passo
- [ ] Mensagens são empáticas e positivas
- [ ] Erros mostram feedback visual (toast, alert, etc.)

### ✅ Tratamento Específico

- [ ] Erros de rede mostram estado offline quando apropriado
- [ ] Erros de autenticação redirecionam para login
- [ ] Erros de permissão mostram mensagem clara
- [ ] Erros de validação destacam campos problemáticos

### ✅ Testes

- [ ] Cenários de erro estão cobertos por testes
- [ ] Error boundaries são testados
- [ ] Retry logic é testado
- [ ] Mensagens de erro são validadas

---

## Exemplos Completos

### Exemplo 1: Upload de Arquivo com Retry e Feedback

```typescript
import { withRetry } from '@/services/sync/utils';
import { logger } from '@/services/logger';
import { toast } from 'sonner';

async function uploadFile(file: File) {
  try {
    logger.info('Iniciando upload', { fileName: file.name, size: file.size });
    
    // Validação
    if (file.size > 5 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 5MB');
      return;
    }
    
    // Upload com retry
    const result = await withRetry(
      async () => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) throw new Error('Upload falhou');
        return response.json();
      },
      {
        maxAttempts: 3,
        baseDelay: 1000
      },
      'Upload de arquivo'
    );
    
    toast.success('Arquivo enviado com sucesso!');
    logger.info('Upload concluído', { fileId: result.id });
    
    return result;
  } catch (error) {
    logger.error('Erro no upload', { error, fileName: file.name });
    toast.error(
      'Não foi possível enviar o arquivo. Verifique sua conexão e tente novamente.'
    );
    throw error;
  }
}
```

### Exemplo 2: Componente com LoadingBoundary e Error Handling

```typescript
import { useState, useEffect } from 'react';
import { LoadingBoundary } from '@/components/loading-boundary';
import { withRetry } from '@/services/sync/utils';
import { logger } from '@/services/logger';

function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      setIsLoading(true);
      
      const data = await withRetry(
        async () => {
          const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (error) throw error;
          return data;
        },
        { maxAttempts: 3 },
        'Carregar projetos'
      );
      
      setProjects(data);
    } catch (error) {
      logger.error('Erro ao carregar projetos', error);
      toast.error('Não foi possível carregar os projetos. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <LoadingBoundary
      isLoading={isLoading}
      loadingMessage="Carregando projetos..."
    >
      <div className="grid gap-4">
        {projects.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </LoadingBoundary>
  );
}
```

### Exemplo 3: Operação Crítica com Múltiplas Camadas de Proteção

```typescript
import { LoadingBoundary } from '@/components/loading-boundary';
import { withRetry } from '@/services/sync/utils';
import { logger } from '@/services/logger';
import { toast } from 'sonner';

function CriticalOperation() {
  async function performCriticalOperation(data: any) {
    const operationId = crypto.randomUUID();
    
    try {
      logger.info('Iniciando operação crítica', { operationId });
      
      // Validação prévia
      if (!data.required_field) {
        toast.error('Campo obrigatório não preenchido');
        return;
      }
      
      // Operação com retry
      const result = await withRetry(
        async () => {
          // Múltiplas etapas
          const step1 = await saveToDatabase(data);
          const step2 = await syncToServer(step1.id);
          const step3 = await updateCache(step2);
          
          return step3;
        },
        {
          maxAttempts: 5,
          baseDelay: 1000,
          maxDelay: 10000,
          retryCondition: (error) => {
            // Não fazer retry em erros de validação
            if (error?.message?.includes('validation')) {
              return false;
            }
            return true;
          }
        },
        'Operação crítica'
      );
      
      logger.info('Operação concluída', { operationId, resultId: result.id });
      toast.success('Operação realizada com sucesso!');
      
      return result;
    } catch (error) {
      logger.error('Falha na operação crítica', {
        error,
        operationId,
        data: sanitizeDataForLog(data)
      });
      
      toast.error(
        'Não foi possível completar a operação. Nossa equipe foi notificada. Por favor, tente novamente mais tarde.'
      );
      
      throw error;
    }
  }
  
  return (
    <LoadingBoundary fallback={CriticalOperationErrorFallback}>
      {/* Componente */}
    </LoadingBoundary>
  );
}
```

---

## Recursos Adicionais

### Ferramentas do Projeto

- **Logger**: `@/services/logger` - Sistema centralizado de logs
- **withRetry**: `@/services/sync/utils` - Retry com backoff exponencial  
- **ErrorBoundary**: `@/components/ErrorBoundary` - Proteção contra erros
- **LoadingBoundary**: `@/components/loading-boundary` - Loading + Error handling
- **Toast**: `sonner` - Notificações para usuário

### Boas Práticas Gerais

1. **Fail Fast**: Valide dados o mais cedo possível
2. **Fail Safe**: Tenha fallbacks para operações críticas
3. **Fail Loud**: Sempre logue erros, nunca os esconda
4. **Fail Gracefully**: Mostre mensagens amigáveis ao usuário

### Quando NÃO usar Retry

- Erros de validação (400)
- Erros de autenticação (401)
- Erros de autorização (403)
- Erros de não encontrado (404)
- Erros de lógica de negócio
- Erros que requerem intervenção do usuário

---

## Contato e Suporte

Para dúvidas sobre tratamento de erros:

1. Consulte este guia primeiro
2. Revise exemplos no código existente
3. Procure por padrões similares no projeto
4. Discuta em code review se ainda tiver dúvidas

**Lembre-se**: Bom tratamento de erros não é apenas sobre prevenir crashes, mas sobre criar uma experiência de usuário confiável e profissional.
