# DEA Manager - Robust Sync System

## Arquivos Alterados/Criados

### Novos Arquivos:
1. **`src/services/sync/utils.ts`** - Utilitários para retry, batching, métricas e detecção de rede
2. **`src/services/sync/syncState.ts`** - Gerenciamento de estado global do sync
3. **`src/components/sync-status-bar.tsx`** - Barra de status que aparece quando offline/online

### Arquivos Modificados:
1. **`src/services/sync/sync.ts`** - Sistema de sync completamente reescrito com batching, retry e paginação
2. **`src/components/sync-button.tsx`** - Interface melhorada com indicadores visuais
3. **`src/pages/Dashboard.tsx`** - Integração da barra de status

## Principais Melhorias Implementadas

### 1. **Batch & Paginação**
- **Push**: Processa em lotes de 500 registros por vez
- **Pull**: Pagina com cursor baseado em `updated_at` + `id` para desempate
- **Memória**: Eficiente para grandes volumes de dados
- **Performance**: Reduz carga no servidor e cliente

### 2. **Retry com Exponential Backoff**
- **Delays**: 500ms → 1s → 2s → 4s → 8s (máx 5 tentativas)
- **Condições**: Retry automático para erros 429, 5xx, timeout, network
- **Logging**: Cada tentativa é logada com detalhes
- **Falha**: Após 5 tentativas, mostra erro amigável na UI

### 3. **Detecção de Estado de Rede**
- **Online/Offline**: Monitora `navigator.onLine` + eventos
- **Comportamento**: 
  - Offline: Bloqueia push, permite edições locais (_dirty flags)
  - Online: Mostra CTA "Sincronizar Agora" se há pendências
- **Visual**: Ícones de wifi/sem wifi + status na UI

### 4. **Indicadores Visuais Robustos**
- **Status**: "Pronto" / "Offline" / "Sincronizando..." / "Erro"
- **Contadores**: 
  - Pendentes para push (badge com número)
  - Resultado do sync: "Enviados: X | Recebidos: Y | Removidos: Z"
- **Progresso**: Barra de progresso durante operações batch
- **Timestamps**: Horário da última sincronização

### 5. **Logging Detalhado**
- **Console Groups**: Métricas organizadas por categorias
- **Quantidades**: Por tabela (projects, installations, contacts, etc.)
- **Timing**: Duração total da sincronização
- **Erros**: Lista de falhas com detalhes e timestamps

## Diferenças vs. Versão Anterior

### Arquitetura:
```diff
- Sync linear sem retry
+ Batch processing com retry exponencial

- Sem detecção de rede
+ Monitoramento online/offline em tempo real

- UI básica
+ Interface rica com status, progresso e métricas

- Logs mínimos
+ Sistema completo de logging e métricas
```

### Performance:
```diff
- Carrega todos registros de uma vez
+ Processa em lotes de 500 + paginação

- Falha em qualquer erro
+ Retry automático com backoff

- Sem feedback visual durante operação
+ Progresso em tempo real + contadores
```

## Passo-a-Passo de Teste Manual

### Teste 1: Operações Offline
1. **Desconecte** a internet (Modo avião / WiFi off)
2. **Crie** um novo projeto no dashboard
3. **Edite** um projeto existente
4. **Delete** um projeto
5. **Verifique**: Badge "X pendentes" aparece no botão sync
6. **Confirme**: Botão sync fica desabilitado (cinza)
7. **Verifique**: Alerta "Você está offline" aparece

### Teste 2: Volta ao Online
1. **Reconecte** a internet
2. **Verifique**: Alerta muda para "Você voltou online! X alterações aguardando"
3. **Clique**: "Sincronizar Agora" no alerta
4. **Observe**: 
   - Progresso visual durante sync
   - Toast com contadores: "Enviados: X | Recebidos: Y"
   - Badge "pendentes" desaparece

### Teste 3: Sync Manual com Dados
1. **Crie** 10+ projetos rapidamente
2. **Clique**: Botão "Sincronizar"
3. **Observe**:
   - Status muda para "Sincronizando..."
   - Progresso aparece se necessário
   - Console mostra logs detalhados:
     ```
     📊 Sync Metrics
     ⏱️ Duration: 1250ms
     📤 Pushed
       projects: 10
     📥 Pulled
       projects: 0
     ```

### Teste 4: Simulação de Erro de Rede
1. **Durante sync**: Desconecte rapidamente a internet
2. **Verifique**: Retry automático (visível no console)
3. **Aguarde**: Eventual falha após 5 tentativas
4. **Confirme**: Erro amigável na UI + botão volta ao normal

### Teste 5: Grande Volume (Opcional)
1. **Importe** arquivo Excel com 500+ instalações
2. **Execute** sync
3. **Verifique**: Processamento em lotes (console mostra páginas)
4. **Confirme**: Performance aceitável

## Console Logs Esperados

### Sync Normal:
```
🚀 Starting full sync...
📤 Pushing 5 projects...
📤 Pushing 12 installations...
📥 Pulling 0 projects (page 1)...
📥 Pulling 2 installations (page 1)...
📊 Sync Metrics
⏱️ Duration: 890ms
📤 Pushed
  projects: 5
  installations: 12
📥 Pulled
  installations: 2
✅ Full sync completed successfully
```

### Com Retry:
```
Sync attempt 1 failed, retrying in 500ms: Error: fetch failed
Sync attempt 2 failed, retrying in 1000ms: Error: 429 Too Many Requests
📤 Pushing 3 projects...
```

## Benefícios da Implementação

### Para Usuários:
- ✅ **Trabalho offline** sem perda de dados
- ✅ **Feedback visual** claro do status
- ✅ **Sincronização automática** quando volta online
- ✅ **Performance** melhor com grandes volumes

### Para Desenvolvedores:
- ✅ **Debugging fácil** com logs detalhados
- ✅ **Robustez** contra falhas de rede
- ✅ **Escalabilidade** para grandes datasets
- ✅ **Manutenibilidade** com código modular

### Para Sistema:
- ✅ **Menor carga** no servidor (batching)
- ✅ **Resilência** a picos de tráfego (retry)
- ✅ **Monitoramento** via métricas estruturadas