# 🔮 Comportamento Esperado dos Testes Manuais

Baseado na análise do código, este documento prediz o comportamento esperado e **prováveis problemas** que você encontrará ao executar os testes manuais.

---

## 🧪 Teste 1: Criar Projeto Offline

### ✅ O Que DEVE Funcionar

#### Passo 1-2: Desconectar e Criar Projeto
```typescript
// Browser A desconecta
// Evento 'offline' dispara em:
// 1. onlineMonitor.handleOffline() (onlineMonitor.ts:82)
// 2. syncStateManager (syncState.ts:100)
// 3. autoSyncManager (autoSync.ts:39)
```

**Comportamento Esperado**:
- ✅ Toast aparece: "Sem Conexão - Trabalhando offline. Suas alterações serão sincronizadas quando a conexão for restaurada."
- ✅ syncStateManager.isOnline = false
- ✅ Status muda para 'offline'

**Ao criar projeto**:
```typescript
// StorageManagerDexie.upsertProject() (linha 180)
// Como está offline:
withDates._dirty = 1;  // Marca como dirty
await db.projects.put(withDates);  // Salva localmente
syncQueue.push({ type: 'project', data: withDates });  // Adiciona à fila
```

- ✅ Projeto é salvo no IndexedDB
- ✅ Marca _dirty = 1
- ✅ Adiciona à syncQueue
- ✅ Mensagem de sucesso aparece

#### Passo 3: Badge "Pendente"
```typescript
// syncStateManager.updatePendingCount() (syncState.ts:103)
const [projects, ...] = await Promise.all([
  db.projects.where('_dirty').equals(1).count(),  // Conta = 1
  ...
]);
const total = projects + ... // = 1
this.updateState({ pendingPush: total }); // Badge atualiza
```

**Comportamento Esperado**:
- ✅ Badge mostra "1 pendente"
- ✅ syncStateManager.pendingPush = 1

### ⚠️ PROBLEMAS PROVÁVEIS

#### Problema #1: Badge Pode Não Atualizar Imediatamente
**Causa**: `updatePendingCount()` não é chamado automaticamente ao marcar _dirty
```typescript
// StorageManagerDexie.upsertProject() (linha 255-259)
withDates._dirty = 1;
await db.projects.put(withDates);
// ❌ NÃO chama syncStateManager.refreshPendingCount()
```

**Resultado**: Badge continua mostrando "0 pendente" até próximo sync ou refresh

**Como Verificar**: 
```javascript
// Console do browser
syncStateManager.getState().pendingPush  // Pode mostrar 0
await syncStateManager.refreshPendingCount()  // Força atualização
syncStateManager.getState().pendingPush  // Agora mostra 1
```

#### Problema #2: Evento 'offline' Dispara 3x
**Causa**: Listeners duplicados (identificado na análise)
```typescript
// 3 serviços escutam o mesmo evento:
onlineMonitor.handleOffline()     // onlineMonitor.ts:82
syncStateManager (offline handler) // syncState.ts:100  
autoSyncManager (offline handler)  // autoSync.ts:39
```

**Resultado**: 
- 3 toasts de "Sem Conexão" aparecem
- Console mostra 3 logs de "🔴 Conexão perdida"

---

## 🧪 Teste 1 (Continuação): Reconexão

### ✅ O Que DEVE Funcionar

#### Passo 4: Reconectar Internet
```typescript
// Evento 'online' dispara em:
// 1. onlineMonitor.handleOnline() → processSyncQueue() + fullSync()
// 2. autoSyncManager.handleOnlineStatusChange() → fullSync()
```

**Sequência Esperada**:
1. Toast: "Conexão Restaurada - Sincronizando 1 alteração pendente..."
2. `processSyncQueue()` executa (StorageManagerDexie.ts:160)
3. `fullSync()` executa (sync.ts:573)
4. Toast: "Sincronização Concluída"

### 🔴 PROBLEMAS PROVÁVEIS

#### Problema #3: fullSync Executa 2x Simultaneamente
**Causa**: onlineMonitor E autoSync ambos chamam fullSync
```typescript
// onlineMonitor.ts:60
await fullSync();  // Chamada 1

// autoSync.ts:94 (handleOnlineStatusChange)
await fullSync();  // Chamada 2 - DUPLICADO!
```

**Resultado**:
- 2x requisições para Supabase
- Possível rate limit (429)
- Tempo de sync 2x maior que necessário
- Console mostra requests duplicados

**Como Verificar**:
```javascript
// Network tab → Filter by "projects"
// Você verá 2 requisições POST/PATCH quase simultâneas
```

#### Problema #4: Toast de Pendências Pode Estar Errado
**Causa**: pendingCount lido pode estar desatualizado
```typescript
// onlineMonitor.ts:47
const pendingCount = syncStateManager.getState().pendingPush;
// Pode retornar 0 se updatePendingCount() não foi chamado
```

**Resultado**: 
- Toast diz "Conexão Restaurada" (sem mencionar pendências)
- Mas projeto é sincronizado mesmo assim

#### Problema #5: Sync Pode Falhar sem Retry
**Causa**: processSyncQueue não tem retry
```typescript
// StorageManagerDexie.ts:160
export async function processSyncQueue() {
  for (const item of itemsToSync) {
    await syncToServerImmediate(item.type, item.data);
    // ❌ Se falhar aqui, item não volta pra fila
  }
}
```

**Resultado**:
- Se Supabase está lento/instável, sync falha
- Item some da fila
- Badge vai para "0" mas projeto não foi sincronizado
- ❌ **PERDA DE DADOS**

#### Problema #6: Tempo de Sync > 30 Segundos
**Causa**: Múltiplas operações sem batching otimizado
```typescript
// Sequência:
1. processSyncQueue() → syncToServerImmediate() → withRetry (5 tentativas)
2. fullSync() → syncPush() → pushEntityType() → withRetry novamente
3. fullSync() → syncPull() → pullEntityType() 
```

**Resultado**: Pode levar 30-60 segundos se rede estiver lenta

---

## 🧪 Teste 1 (Continuação): Verificação no Browser B

### ✅ O Que DEVE Funcionar

#### Passo 6-7: Browser B Sincronizar
```typescript
// Browser B: Click em "Sincronizar"
// Dispara syncPull() (sync.ts:520)
await pullEntityType('projects', lastPulledAt);
// Query Supabase:
.from('projects')
.select('*')
.eq('user_id', user.id)
.gt('updated_at', lastPulledDate)
```

**Comportamento Esperado**:
- ✅ Browser B baixa projeto "Teste Offline"
- ✅ Projeto aparece na lista
- ✅ Dados estão corretos

### ⚠️ PROBLEMAS PROVÁVEIS

#### Problema #7: Projeto Pode Não Aparecer
**Causa 1**: lastPulledAt muito recente
```typescript
// Se Browser B fez pull há < 1 segundo
// E projeto foi criado com timestamp < lastPulledAt
// Query .gt('updated_at', lastPulledDate) não retorna o projeto
```

**Causa 2**: Timezone inconsistente
```typescript
// Browser A salva: new Date().toISOString() // UTC
// Browser B compara com: lastPulledAt (timestamp local)
// Pode ter discrepância de horas
```

**Como Verificar**:
```javascript
// Browser B console
import('./services/sync/localFlags').then(m => m.getLastPulledAt())
// Se retornar timestamp > hora de criação do projeto, explica o bug
```

#### Problema #8: Dados Transformados Incorretamente
**Causa**: Bug na transformação projects
```typescript
// sync.ts:259-265 (transformRecordForSupabase)
case 'projects':
  return {
    ...base,
    owner_name: record.owner,  // Pode ser undefined
    suppliers: record.suppliers || [],
    installation_time_estimate_days: record.installation_time_estimate_days
  };
```

**Resultado**: Campos podem vir como null/undefined no Browser B

---

## 🧪 Teste 2: Editar Projeto Offline

### ✅ O Que DEVE Funcionar

Similar ao Teste 1, mas com edição em vez de criação.

### 🔴 PROBLEMAS PROVÁVEIS

#### Problema #9: Edição Cria Registro Duplicado
**Causa**: ID local vs ID remoto
```typescript
// Browser A edita offline
// ID pode ser temporário: "project_1234567890"
// Ao sincronizar, Supabase gera novo UUID
// Browser A fica com 2 registros: temporário + real
```

**Resultado**: Projeto aparece duplicado na lista

#### Problema #10: Conflito Não Detectado
**Cenário**:
1. Browser B edita mesmo projeto online (antes do Browser A reconectar)
2. Browser A reconecta e faz push da edição offline
3. Sistema deveria detectar conflito mas...

```typescript
// sync.ts:190-213 (pullEntityType)
if (localRecord && localRecord._dirty === 1 && recordType) {
  const conflictInfo = checkForRemoteEdits(...);
  // ✅ Detecta conflito no PULL
}

// MAS no PUSH:
// pushEntityType() (sync.ts:109)
await supabase.from(remote as any).upsert(normalizedRecord);
// ❌ Upsert SOBRESCREVE sem verificar conflito!
```

**Resultado**: Last-write-wins, edição do Browser B é perdida

---

## 🧪 Teste 2 (Continuação): Aguardar 30 Segundos

### ⚠️ PROBLEMA CRÍTICO

#### Problema #11: Sync NÃO Ocorre aos 30s
**Causa**: Periodic sync está desabilitado por padrão
```typescript
// preferences.ts:10-16
const DEFAULT_PREFERENCES: SyncPreferences = {
  autoPullOnStart: true,
  autoPushOnExit: true,
  periodicPullEnabled: false,  // ❌ DESABILITADO
  periodicPullInterval: 5,     // 5 minutos, não 30s
  realtimeEnabled: false
};
```

**Comportamento Real**:
- Após reconectar, sync automático dispara IMEDIATAMENTE
- NÃO há outro sync aos 30 segundos
- Próximo sync só ocorre se:
  - Usuário clicar manualmente
  - Periodic sync estiver habilitado (a cada 5 min por padrão)
  - Página for recarregada

**Como Testar Corretamente**:
```javascript
// Browser A console - Habilitar periodic sync
localStorage.setItem('sync_preferences', JSON.stringify({
  autoPullOnStart: true,
  autoPushOnExit: true,
  periodicPullEnabled: true,
  periodicPullInterval: 0.5  // 30 segundos = 0.5 minutos
}));
// Recarregar página
```

---

## 📊 Resumo de Problemas Esperados

### 🔴 Críticos (Vão Ocorrer)
1. **fullSync executa 2x** ao reconectar (duplicação)
2. **processSyncQueue sem retry** → perda de dados se falhar
3. **Conflitos no push não detectados** → last-write-wins
4. **Toasts duplicados** ao desconectar/reconectar (3x cada)

### 🟡 Prováveis (50% chance)
5. **Badge não atualiza** até próximo sync
6. **pendingCount incorreto** no toast de reconexão
7. **Projeto não aparece** no Browser B (lastPulledAt)
8. **Tempo de sync > 30s** em rede lenta

### 🟢 Possíveis (20% chance)
9. **Duplicação de projeto** com IDs temporários
10. **Dados transformados incorretamente** (campos null)
11. **Sync não ocorre aos 30s** (periodic desabilitado)

---

## 🎯 Checklist de Verificação Pós-Teste

Após executar os testes, verifique:

### Console Logs
```javascript
// Buscar por estes logs
"🟢 Conexão restaurada"  // Quantas vezes? (esperado: 1, provável: 3)
"🔴 Conexão perdida"      // Quantas vezes? (esperado: 1, provável: 3)
"❌ Erro ao sincronizar" // Ocorreu?
"📤 Pushing"              // Quantas vezes? (esperado: 1, provável: 2)
```

### Network Tab
```javascript
// Filtrar por "projects"
POST /rest/v1/projects    // Quantas vezes? (esperado: 1)
GET /rest/v1/projects     // Durante pull
// Se vir 2+ POST simultâneos = bug confirmado
```

### IndexedDB
```javascript
// Application tab → IndexedDB → dea-field-manager-v2 → projects
// Verificar:
// - _dirty: 0 após sync (esperado)
// - _dirty: 1 antes de sync (esperado)
// - Registros duplicados? (não esperado)
```

### Toasts
```javascript
// Contar quantos toasts apareceram
// Esperado:
// - 1x "Sem Conexão"
// - 1x "Conexão Restaurada"  
// - 1x "Sincronização Concluída"
// Total: 3 toasts

// Provável:
// - 3x "Sem Conexão"
// - 3x "Conexão Restaurada"
// - 2x "Sincronização Concluída"
// Total: 8 toasts (!!!)
```

---

## 🔧 Scripts de Debug para Console

Execute estes comandos no console do browser durante os testes:

```javascript
// Ver estado completo do sync
syncStateManager.getState()

// Ver pending count real
await db.projects.where('_dirty').equals(1).count()

// Ver último pull timestamp
import('./services/sync/localFlags').then(m => m.getLastPulledAt())

// Forçar refresh do badge
await syncStateManager.refreshPendingCount()

// Ver fila de sync
// (não é exportado, mas pode ver no código)

// Ver todos os projetos locais
await db.projects.toArray()

// Ver listeners de 'online'
getEventListeners(window).online.length
// Se retornar > 1, tem listeners duplicados
```

---

**Documento criado por análise estática do código**
**Para execução real, um testador humano deve seguir o MANUAL_TEST_CHECKLIST.md**
