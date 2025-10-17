# Teste 5 - Validação de Event Listeners após HMR

## 🎯 Objetivo
Validar que os event listeners do `autoSyncManager` são corretamente removidos durante HMR (Hot Module Replacement) e não se acumulam após múltiplos reloads.

## ✅ Correções Implementadas

### 1. Refatoração em `src/services/sync/autoSync.ts`

#### Antes (Problema):
```typescript
private setupEventListeners() {
  // Inline arrow functions - não podem ser removidas
  document.addEventListener('visibilitychange', () => {
    this.isVisible = !document.hidden;
    // ...
  });
  
  window.addEventListener('pagehide', (event) => {
    // ...
  });
}

cleanup() {
  // ❌ Não remove event listeners!
  if (this.debounceTimer) {
    clearTimeout(this.debounceTimer);
  }
  if (this.periodicTimer) {
    clearInterval(this.periodicTimer);
  }
}
```

#### Depois (Solução):
```typescript
class AutoSyncManager {
  // Propriedades para armazenar referências
  private visibilityChangeHandler: (() => void) | null = null;
  private pageHideHandler: ((event: PageTransitionEvent) => void) | null = null;

  private setupEventListeners() {
    // Criar e armazenar referências bound
    this.visibilityChangeHandler = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);

    this.pageHideHandler = this.handlePageHide.bind(this);
    window.addEventListener('pagehide', this.pageHideHandler);
  }

  // Métodos da classe
  private handleVisibilityChange() {
    this.isVisible = !document.hidden;
    // ...
  }

  private handlePageHide(event: PageTransitionEvent) {
    // ...
  }

  cleanup() {
    // ✅ Remove listeners usando referências armazenadas
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
    if (this.pageHideHandler) {
      window.removeEventListener('pagehide', this.pageHideHandler);
      this.pageHideHandler = null;
    }
    // ... limpeza de timers
  }
}
```

### 2. Integração de Cleanup em `src/hooks/useAuth.tsx`

```typescript
useEffect(() => {
  // ... setup code ...

  return () => {
    subscription.unsubscribe();
    
    // Cleanup auto-sync on unmount or HMR
    if (_autoSyncInitialized) {
      logger.debug('[useAuth] Cleaning up auto-sync');
      autoSyncManager.cleanup();
      _autoSyncInitialized = false;
      _autoSyncInitializing = false;
    }
  };
}, []);
```

## 🧪 Como Testar

### Método 1: Console do Navegador (Recomendado)

1. **Abra o DevTools** (F12) e vá para a aba Console

2. **Copie e cole o conteúdo de `test-listener-cleanup.js`** no console

3. **Execute o teste**:
   ```javascript
   testListeners.runTest()
   ```

4. **Anote os valores iniciais**

5. **Dispare HMR**:
   - Edite e salve `src/services/sync/autoSync.ts` (adicione um comentário)
   - Aguarde o HMR completar

6. **Compare os valores**:
   ```javascript
   testListeners.compare()
   ```

### Método 2: Comandos Manuais

```javascript
// 1. Contar listeners atuais
getEventListeners(document).visibilitychange?.length || 0
getEventListeners(window).pagehide?.length || 0

// 2. Disparar HMR (salvar arquivo)

// 3. Contar novamente e comparar
getEventListeners(document).visibilitychange?.length || 0
getEventListeners(window).pagehide?.length || 0
```

### Método 3: Interface Visual

1. **Abra no navegador**: `test-hmr-listeners.html`

2. **Clique em "Contar Listeners"** para baseline

3. **Dispare HMR** salvando um arquivo

4. **Clique em "Contar Listeners"** novamente

5. **Verifique o resultado** na interface

## ✅ Critérios de Sucesso

### ✅ PASSOU
- Número de listeners `visibilitychange` permanece constante
- Número de listeners `pagehide` permanece constante
- Após múltiplos HMRs, os valores não aumentam

### ❌ FALHOU
- Listeners aumentam a cada HMR
- Exemplo: 1 → 2 → 3 listeners após cada reload

## 📊 Resultados Esperados

### Antes da Correção:
```
Inicial:  visibilitychange: 1, pagehide: 1
HMR #1:   visibilitychange: 2, pagehide: 2  ❌
HMR #2:   visibilitychange: 3, pagehide: 3  ❌
HMR #3:   visibilitychange: 4, pagehide: 4  ❌
```

### Depois da Correção:
```
Inicial:  visibilitychange: 1, pagehide: 1
HMR #1:   visibilitychange: 1, pagehide: 1  ✅
HMR #2:   visibilitychange: 1, pagehide: 1  ✅
HMR #3:   visibilitychange: 1, pagehide: 1  ✅
```

## 🔍 Validação Adicional

### Teste de Cleanup Manual
```javascript
// No console
autoSyncManager.cleanup()

// Verificar que listeners foram removidos
getEventListeners(document).visibilitychange?.length || 0  // Deve ser 0
getEventListeners(window).pagehide?.length || 0            // Deve ser 0
```

### Teste de Re-inicialização
```javascript
// Limpar
autoSyncManager.cleanup()

// Re-inicializar
await autoSyncManager.initialize()

// Verificar que há exatamente 1 de cada
getEventListeners(document).visibilitychange?.length || 0  // Deve ser 1
getEventListeners(window).pagehide?.length || 0            // Deve ser 1
```

## 📝 Checklist de Validação

- [ ] Listeners não aumentam após HMR
- [ ] `cleanup()` remove todos os listeners
- [ ] Re-inicialização funciona corretamente
- [ ] Comportamento funcional mantido (visibility/pagehide funcionam)
- [ ] Sem memory leaks (verificar com DevTools Memory Profiler)

## 🐛 Debugging

Se o teste falhar:

1. **Verificar se o cleanup está sendo chamado**:
   ```javascript
   // Adicione log temporário
   console.log('[DEBUG] Cleanup called');
   ```

2. **Verificar referências armazenadas**:
   ```javascript
   console.log(autoSyncManager.visibilityChangeHandler);
   console.log(autoSyncManager.pageHideHandler);
   ```

3. **Verificar se HMR está preservando o singleton**:
   - O singleton pode ser recriado em HMR
   - Verificar se há múltiplas instâncias

## 🎉 Conclusão

Com estas correções:
- ✅ Event listeners são propriamente gerenciados
- ✅ Cleanup funciona corretamente
- ✅ HMR não causa acúmulo de listeners
- ✅ Sem memory leaks
- ✅ Comportamento funcional preservado
