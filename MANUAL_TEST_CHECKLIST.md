# 📋 Checklist de Testes Manuais - Sistema de Sincronização

## ⚙️ Setup Inicial

### Preparação
- [ ] Abrir Chrome/Edge como **Browser A**
- [ ] Abrir Firefox/Safari como **Browser B**  
- [ ] Fazer login com mesma conta em ambos
- [ ] Abrir DevTools em ambos (F12)
- [ ] Abrir aba Console para ver logs
- [ ] Abrir aba Network para monitorar requests

### Verificação Inicial
- [ ] Browser A: Confirmar que está online (badge sem "pendente")
- [ ] Browser B: Confirmar que está online
- [ ] Ambos: Sincronizar manualmente uma vez para garantir estado limpo

---

## 🧪 Teste 1: Criar Projeto Offline

### Objetivo
Verificar se projeto criado offline sincroniza corretamente ao reconectar.

### Passos Detalhados

#### Passo 1.1: Desconectar Browser A
- [ ] Browser A: Abrir DevTools → Network tab
- [ ] Browser A: Marcar checkbox "Offline" (ou "Slow 3G" para simular)
- [ ] Browser A: Verificar que aparece toast/badge "Sem Conexão"
- [ ] **Registrar**: Toast apareceu? (✅/❌)
- [ ] **Registrar**: Mensagem do toast: _______________

#### Passo 1.2: Criar Projeto Offline
- [ ] Browser A: Navegar para /projetos
- [ ] Browser A: Clicar em "Novo Projeto"
- [ ] Browser A: Preencher:
  - Nome: "Teste Offline"
  - Cliente: "Cliente Teste"
  - Cidade: "São Paulo"
- [ ] Browser A: Clicar em "Salvar"
- [ ] **Registrar**: Projeto foi salvo? (✅/❌)
- [ ] **Registrar**: Apareceu mensagem de sucesso? (✅/❌)
- [ ] **Registrar**: Mensagem de sucesso: _______________

#### Passo 1.3: Verificar Badge "Pendente"
- [ ] Browser A: Olhar botão de sincronização no header
- [ ] **Registrar**: Badge mostra "1 pendente"? (✅/❌)
- [ ] **Registrar**: Badge atual: _______________
- [ ] Browser A: Abrir Console e executar:
```javascript
syncStateManager.getState().pendingPush
```
- [ ] **Registrar**: Valor no estado: _______________

#### Passo 1.4: Reconectar Internet
- [ ] Browser A: DevTools → Network → Desmarcar "Offline"
- [ ] **Iniciar cronômetro**
- [ ] **Registrar**: Toast de reconexão apareceu? (✅/❌)
- [ ] **Registrar**: Mensagem do toast: _______________
- [ ] **Registrar**: Toast menciona "1 alteração pendente"? (✅/❌)

#### Passo 1.5: Aguardar Sync Automático
- [ ] Aguardar até 60 segundos
- [ ] **Registrar**: Toast de "Sincronização Concluída" apareceu? (✅/❌)
- [ ] **Parar cronômetro**
- [ ] **Registrar**: Tempo de sincronização: _____ segundos
- [ ] **Registrar**: Badge voltou a "0 pendente"? (✅/❌)
- [ ] Browser A: Abrir Network tab e filtrar por "projects"
- [ ] **Registrar**: Viu POST/PATCH para /projects? (✅/❌)
- [ ] **Registrar**: Status da requisição: _______________

#### Passo 1.6: Verificar no Browser B
- [ ] Browser B: Clicar no botão "Sincronizar" no header
- [ ] **Registrar**: Sync iniciou? (✅/❌)
- [ ] Browser B: Aguardar conclusão
- [ ] Browser B: Navegar para /projetos
- [ ] Browser B: Procurar projeto "Teste Offline"
- [ ] **Registrar**: Projeto "Teste Offline" apareceu? (✅/❌)
- [ ] **Registrar**: Dados do projeto estão corretos? (✅/❌)
  - Nome: "Teste Offline"
  - Cliente: "Cliente Teste"
  - Cidade: "São Paulo"

### 📊 Resultado do Teste 1
- [ ] ✅ PASSOU - Todos os passos funcionaram
- [ ] ⚠️ PASSOU COM RESSALVAS - Funcionou mas com problemas menores
- [ ] ❌ FALHOU - Não funcionou como esperado

### 🐛 Problemas Encontrados no Teste 1
```
1. [Descrever problema aqui]
   - Passo onde ocorreu: _____
   - Comportamento esperado: _____
   - Comportamento observado: _____
   - Gravidade: CRÍTICO/ALTO/MÉDIO/BAIXO

2. [Descrever problema aqui]
   ...
```

---

## 🧪 Teste 2: Editar Projeto Offline

### Objetivo
Verificar se edições offline sincronizam corretamente, incluindo detecção de conflitos.

### Passos Detalhados

#### Passo 2.1: Desconectar e Editar
- [ ] Browser A: DevTools → Network → Marcar "Offline"
- [ ] Browser A: Navegar para projeto "Teste Offline"
- [ ] Browser A: Clicar em "Editar"
- [ ] Browser A: Alterar nome para "Teste Offline - Editado"
- [ ] Browser A: Clicar em "Salvar"
- [ ] **Registrar**: Salvou com sucesso? (✅/❌)
- [ ] **Registrar**: Badge mostra "1 pendente"? (✅/❌)

#### Passo 2.2: Reconectar Internet
- [ ] Browser A: DevTools → Network → Desmarcar "Offline"
- [ ] **Iniciar cronômetro**
- [ ] **Registrar**: Toast de reconexão apareceu? (✅/❌)
- [ ] **Registrar**: Tempo até aparecer toast de conclusão: _____ segundos

#### Passo 2.3: Aguardar 30 Segundos
- [ ] Aguardar exatos 30 segundos
- [ ] **Registrar**: Sync ocorreu automaticamente? (✅/❌)
- [ ] **Registrar**: Badge está em "0 pendente"? (✅/❌)

#### Passo 2.4: Verificar no Browser B
- [ ] Browser B: Clicar em "Sincronizar"
- [ ] Browser B: Aguardar conclusão
- [ ] Browser B: Navegar para projeto "Teste Offline - Editado"
- [ ] **Registrar**: Nome foi atualizado para "Teste Offline - Editado"? (✅/❌)
- [ ] **Registrar**: Outros dados permaneceram iguais? (✅/❌)

### 📊 Resultado do Teste 2
- [ ] ✅ PASSOU
- [ ] ⚠️ PASSOU COM RESSALVAS
- [ ] ❌ FALHOU

### 🐛 Problemas Encontrados no Teste 2
```
[Mesmo formato do Teste 1]
```

---

## 🧪 Teste 3: Conflito de Edição (Teste Bônus)

### Objetivo
Verificar se sistema detecta e resolve conflitos quando ambos os browsers editam offline.

### Passos

#### Passo 3.1: Setup de Conflito
- [ ] Browser A: Desconectar (Offline)
- [ ] Browser B: Desconectar (Offline)
- [ ] Browser A: Editar projeto para "Versão A"
- [ ] Browser B: Editar MESMO projeto para "Versão B"

#### Passo 3.2: Reconectar Browser A Primeiro
- [ ] Browser A: Reconectar
- [ ] Browser A: Aguardar sync
- [ ] **Registrar**: Sincronizou sem problemas? (✅/❌)

#### Passo 3.3: Reconectar Browser B
- [ ] Browser B: Reconectar
- [ ] Browser B: Aguardar sync
- [ ] **CRÍTICO**: Observar se aparece modal/toast de conflito
- [ ] **Registrar**: Conflito foi detectado? (✅/❌)
- [ ] **Registrar**: Sistema ofereceu opções de resolução? (✅/❌)
- [ ] **Registrar**: Opções oferecidas: _______________

### 📊 Resultado do Teste 3
- [ ] ✅ PASSOU - Conflito detectado e resolvido
- [ ] ⚠️ PASSOU COM RESSALVAS - Detectou mas resolução confusa
- [ ] ❌ FALHOU - Não detectou ou dados foram perdidos

### 🐛 Problemas Encontrados no Teste 3
```
[Mesmo formato]
```

---

## 🧪 Teste 4: Verificação de Logs (Diagnóstico)

### Objetivo
Verificar se sistema está logando corretamente para debugging.

### Passos

#### Passo 4.1: Verificar Console Logs
- [ ] Browser A: Abrir Console
- [ ] Browser A: Desconectar → Criar projeto → Reconectar
- [ ] **Registrar**: Viu logs estruturados? (✅/❌)
- [ ] **Registrar**: Logs usam logger ou console? _______________
- [ ] **Registrar**: Exemplo de log encontrado:
```
[Cole aqui um exemplo de log do console]
```

#### Passo 4.2: Verificar Estado do Sync
- [ ] Browser A: Console → Executar:
```javascript
syncStateManager.getState()
```
- [ ] **Registrar**: Estado retornado:
```json
[Cole JSON do estado aqui]
```

#### Passo 4.3: Verificar Pending Count
- [ ] Browser A: Console → Executar:
```javascript
await db.projects.where('_dirty').equals(1).toArray()
```
- [ ] **Registrar**: Quantos registros dirty? _______________
- [ ] **Registrar**: IDs dos registros dirty: _______________

---

## 📊 Resumo dos Resultados

### Testes Executados
- [ ] Teste 1: Criar Projeto Offline - ✅/⚠️/❌
- [ ] Teste 2: Editar Projeto Offline - ✅/⚠️/❌
- [ ] Teste 3: Conflito de Edição - ✅/⚠️/❌
- [ ] Teste 4: Verificação de Logs - ✅/⚠️/❌

### Estatísticas
- **Total de passos**: _____
- **Passos bem-sucedidos**: _____
- **Passos com problemas**: _____
- **Taxa de sucesso**: _____%

### Problemas Críticos Encontrados
1. _______________
2. _______________
3. _______________

### Problemas Menores Encontrados
1. _______________
2. _______________
3. _______________

### Recomendações
1. _______________
2. _______________
3. _______________

---

## 🔍 Checklist de Observação - O Que Procurar

### Durante Desconexão
- [ ] Toast "Sem Conexão" aparece imediatamente
- [ ] Badge muda para mostrar modo offline
- [ ] Operações continuam funcionando localmente
- [ ] Mensagens de sucesso são apropriadas ("Salvo localmente")

### Durante Reconexão
- [ ] Toast "Conexão Restaurada" aparece
- [ ] Badge mostra contagem de pendências CORRETA
- [ ] Sync automático inicia em até 5 segundos
- [ ] Progress indicator é visível durante sync
- [ ] Toast de conclusão aparece
- [ ] Badge volta a zero após sync

### Logs no Console
- [ ] Sem erros vermelhos inesperados
- [ ] Logs estruturados com contexto
- [ ] Timestamps corretos
- [ ] IDs de registros visíveis

### Network Tab
- [ ] Requests bem-sucedidas (200/201/204)
- [ ] Sem 429 (rate limit)
- [ ] Sem 401 (auth)
- [ ] Sem 500 (server error)
- [ ] Payload das requests faz sentido

### IndexedDB (Application Tab)
- [ ] Registros _dirty são marcados corretamente
- [ ] Registros _dirty são limpos após sync
- [ ] Dados persistem após F5

---

## 🎯 Casos de Borda a Testar (Opcional)

### Teste 5: Desconexão Durante Sync
1. Iniciar sync manualmente
2. Desconectar internet DURANTE o sync
3. Observar comportamento

**Esperado**: Sync falha graciosamente, retry automático ao reconectar

### Teste 6: Múltiplas Reconexões Rápidas
1. Criar projeto offline
2. Reconectar por 2 segundos
3. Desconectar por 2 segundos
4. Repetir 5x

**Esperado**: Sistema não trava, debounce funciona

### Teste 7: Grande Volume de Dados
1. Criar 50 projetos offline
2. Reconectar

**Esperado**: Batching funciona, não estoura memória

---

## 📝 Template de Relatório de Bug

```markdown
### Bug #X: [Título Curto]

**Gravidade**: CRÍTICO / ALTO / MÉDIO / BAIXO

**Teste**: [Número do teste onde foi encontrado]

**Descrição**:
[Descrever o problema em 2-3 frases]

**Passos para Reproduzir**:
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]

**Comportamento Esperado**:
[O que deveria acontecer]

**Comportamento Observado**:
[O que realmente aconteceu]

**Evidências**:
- Screenshot: [link ou anexo]
- Console log: [colar aqui]
- Network request: [colar aqui]
- Estado do sync: [colar JSON]

**Impacto**:
[Como isso afeta o usuário final]

**Arquivos Relacionados**:
- src/services/sync/onlineMonitor.ts
- [outros arquivos relevantes]

**Possível Causa**:
[Sua hipótese sobre a causa, se tiver]
```

---

## ✅ Critérios de Aceitação

Para considerar o sistema de sincronização **PRONTO PARA PRODUÇÃO**, todos os seguintes devem ser verdade:

### Funcionalidade Core
- [ ] Criar projeto offline funciona 100% das vezes
- [ ] Editar projeto offline funciona 100% das vezes
- [ ] Sync automático ao reconectar funciona
- [ ] Badge de pendências é sempre preciso
- [ ] Dados nunca são perdidos

### User Experience
- [ ] Toasts aparecem no momento certo
- [ ] Mensagens são claras e úteis
- [ ] Tempo de sync < 10 segundos para operações normais
- [ ] UI não trava durante sync
- [ ] Feedback visual em todas as operações

### Confiabilidade
- [ ] Sem erros no console em operações normais
- [ ] Conflitos são detectados e resolvidos
- [ ] System se recupera de erros automaticamente
- [ ] Funciona em Chrome, Firefox, Safari, Edge

### Performance
- [ ] Sync de 1 projeto < 2 segundos
- [ ] Sync de 10 projetos < 10 segundos
- [ ] Sync de 100 projetos < 60 segundos
- [ ] Sem memory leaks após 10 syncs
- [ ] Badge atualiza em < 1 segundo

---

**Data do Teste**: _______________
**Testador**: _______________
**Versão do App**: _______________
**Ambiente**: Produção / Staging / Local
