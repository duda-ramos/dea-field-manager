# Cenário de Teste 3 - Colaboração entre Dispositivos

## 📋 Informações Gerais

**Objetivo:** Validar a sincronização em tempo real e colaboração simultânea entre múltiplos dispositivos conectados com o mesmo usuário.

**Tipo de Teste:** Manual / End-to-End / Colaborativo

**Duração Estimada:**
- Teste completo: 15-20 minutos
- Teste rápido: 8-10 minutos

**Pré-requisitos:**
- 2 dispositivos/navegadores diferentes
- Conexão com internet estável em ambos
- Mesma conta de usuário logada em ambos
- Projeto criado com instalações de teste
- Capacidade de simular desconexão de rede

**Dispositivos Recomendados:**
- **Dispositivo A:** Desktop com Chrome
- **Dispositivo B:** Smartphone/Tablet ou segundo navegador (Firefox/Edge)

---

## 🎯 Cenário Completo

### 1️⃣ Setup Inicial - Configuração dos Dois Dispositivos

**Objetivo:** Preparar ambiente de teste com dois dispositivos sincronizados.

#### Passos - Dispositivo A (Desktop):
1. Abrir navegador Chrome
2. Acessar URL do sistema
3. Fazer login com credenciais de teste
4. Abrir ou criar projeto de teste
5. Verificar que há instalações disponíveis (mínimo 15)

#### Passos - Dispositivo B (Mobile/Segundo navegador):
1. Abrir navegador no segundo dispositivo
2. Acessar mesma URL do sistema
3. Fazer login com **mesmas credenciais** do Dispositivo A
4. Navegar até o **mesmo projeto** aberto no Dispositivo A
5. Posicionar ambos dispositivos lado a lado para observação

#### Verificações:
- [ ] Ambos dispositivos mostram mesmos dados iniciais
- [ ] Contadores de instalações idênticos
- [ ] Mesmas fotos exibidas em ambos
- [ ] Status de instalações sincronizados
- [ ] Indicador de presença/conexão visível (se disponível)
- [ ] Avatar ou nome do usuário exibido em ambos

#### Resultado Esperado:
✅ Dois dispositivos conectados simultaneamente ao mesmo projeto, exibindo dados idênticos.

#### ⏱️ Tempo Esperado:
- 2-3 minutos

---

### 2️⃣ Edições Simultâneas - Dispositivo A

**Objetivo:** Validar que alterações feitas no Dispositivo A são sincronizadas para Dispositivo B.

#### Passos no Dispositivo A:

**Ação 2.1 - Criar nova instalação**
1. Clicar em "+ Nova Instalação"
2. Preencher dados:
   - **Cliente:** Teste Sync A
   - **Endereço:** Rua da Sincronização, 123
   - **Cidade:** São Paulo
   - **Status:** Pendente
3. Salvar instalação

**Ação 2.2 - Adicionar 2 fotos**
1. Selecionar a instalação recém-criada
2. Clicar em "Adicionar Fotos"
3. Fazer upload de 2 imagens de teste
4. Aguardar conclusão do upload

**Ação 2.3 - Marcar 1 instalação como concluída**
1. Selecionar qualquer instalação pendente
2. Alterar status para "Concluído"
3. Adicionar observação: "Teste de sincronização - Dispositivo A"
4. Salvar alteração

#### Verificações no Dispositivo A:
- [ ] Nova instalação aparece na lista
- [ ] 2 fotos foram adicionadas com sucesso
- [ ] Status alterado para "Concluído"
- [ ] Observação salva corretamente
- [ ] Contador de instalações atualizado
- [ ] Estatísticas de progresso atualizadas

#### Resultado Esperado:
✅ Todas as 3 ações concluídas com sucesso no Dispositivo A.

#### ⏱️ Tempo Esperado:
- 2 minutos

---

### 3️⃣ Verificar Sincronização no Dispositivo B

**Objetivo:** Confirmar que as alterações do Dispositivo A aparecem automaticamente no Dispositivo B.

#### Passos no Dispositivo B:
1. **NÃO** atualizar a página manualmente
2. Observar a interface por até 5 segundos
3. Verificar se as alterações aparecem automaticamente

#### Verificações Críticas:
- [ ] **Nova instalação "Teste Sync A" aparece automaticamente**
  - Verificar nome do cliente
  - Verificar endereço
  - Verificar status
- [ ] **2 fotos sincronizadas são visíveis**
  - Miniaturas carregam corretamente
  - Possível abrir galeria e visualizar
- [ ] **Status da instalação marcada como concluída atualizado**
  - Status visual alterado
  - Observação "Teste de sincronização - Dispositivo A" visível
- [ ] **Contadores atualizados automaticamente**
  - Total de instalações +1
  - Instalações concluídas +1
  - Progresso recalculado

#### Teste de Latência:
- [ ] Tempo até aparecer nova instalação: _____ segundos
- [ ] Tempo até aparecer fotos: _____ segundos  
- [ ] Tempo até atualizar status: _____ segundos

**Meta: < 5 segundos para todas as alterações**

#### Resultado Esperado:
✅ Todas as alterações do Dispositivo A aparecem automaticamente no Dispositivo B em menos de 5 segundos, sem necessidade de refresh manual.

#### ⏱️ Tempo Esperado:
- 1 minuto

#### ❌ Problemas Comuns:
- Alterações não aparecem (verificar conexão WebSocket/realtime)
- Tempo de sincronização > 5 segundos
- Fotos não sincronizam
- Contadores não atualizam

---

### 4️⃣ Edições Simultâneas - Dispositivo B

**Objetivo:** Validar sincronização bidirecional (Dispositivo B → Dispositivo A).

#### Passos no Dispositivo B:

**Ação 4.1 - Editar observação de instalação**
1. Selecionar a instalação "Teste Sync A" (criada pelo Dispositivo A)
2. Clicar em editar
3. Adicionar à observação: " + Editado pelo Dispositivo B"
4. Salvar alteração

**Ação 4.2 - Adicionar foto em outra instalação**
1. Selecionar qualquer instalação diferente
2. Adicionar 1 foto nova
3. Aguardar upload

**Ação 4.3 - Atualizar campo de quantidade**
1. Selecionar uma instalação
2. Editar campo "Quantidade de Painéis" (ou campo numérico disponível)
3. Alterar de valor original para um novo valor (ex: 10 → 15)
4. Salvar

#### Verificações no Dispositivo B:
- [ ] Observação atualizada com sucesso
- [ ] Foto adicionada e visível
- [ ] Campo de quantidade atualizado
- [ ] Alterações salvas sem erros

#### Resultado Esperado:
✅ Todas as 3 edições concluídas com sucesso no Dispositivo B.

#### ⏱️ Tempo Esperado:
- 2 minutos

---

### 5️⃣ Verificar Sincronização no Dispositivo A

**Objetivo:** Confirmar sincronização reversa (B → A) e presença em tempo real.

#### Passos no Dispositivo A:
1. **NÃO** atualizar a página
2. Observar alterações automáticas

#### Verificações Críticas:
- [ ] **Observação atualizada aparece**
  - Texto " + Editado pelo Dispositivo B" visível
  - Sem necessidade de recarregar
- [ ] **Nova foto adicionada pelo Dispositivo B está visível**
  - Miniatura carregada
  - Galeria atualizada
- [ ] **Campo de quantidade atualizado**
  - Novo valor (15) exibido corretamente
  - Sem conflitos ou sobrescrita incorreta

#### Indicador de Presença (se disponível):
- [ ] Avatar ou indicador mostrando "Usuário ativo em outro dispositivo"
- [ ] Timestamp de última edição atualizado
- [ ] Indicação visual de sincronização ativa

#### Teste de Latência:
- [ ] Tempo até atualizar observação: _____ segundos
- [ ] Tempo até aparecer nova foto: _____ segundos
- [ ] Tempo até atualizar quantidade: _____ segundos

**Meta: < 5 segundos para todas as alterações**

#### Resultado Esperado:
✅ Alterações do Dispositivo B aparecem automaticamente no Dispositivo A em tempo real, demonstrando sincronização bidirecional eficaz.

#### ⏱️ Tempo Esperado:
- 1 minuto

---

### 6️⃣ Teste de Conflito Intencional

**Objetivo:** Validar resolução de conflitos quando mesmo campo é editado offline em ambos dispositivos.

#### Preparação:

**Passo 6.1 - Desconectar Dispositivo B**
1. No Dispositivo B, ativar modo avião OU
2. Desabilitar WiFi/dados móveis OU
3. Usar Dev Tools → Network → Offline
4. Verificar indicador de "Offline" na interface (se disponível)

#### Cenário de Conflito:

**Passo 6.2 - Editar no Dispositivo A (Online)**
1. Selecionar instalação de teste (ex: ID 5)
2. Editar campo "Observações"
3. Adicionar texto: "Editado ONLINE pelo Dispositivo A às [hora]"
4. Salvar
5. Verificar que salvou com sucesso

**Passo 6.3 - Editar no Dispositivo B (Offline)**
1. No Dispositivo B (ainda offline), selecionar **MESMA instalação** (ID 5)
2. Editar **MESMO campo** "Observações"
3. Adicionar texto: "Editado OFFLINE pelo Dispositivo B às [hora]"
4. Tentar salvar
5. Verificar comportamento offline:
   - [ ] Sistema salva localmente
   - [ ] Indicador de "Pendente de sincronização" aparece
   - [ ] Dados mantidos em cache/local storage

**Passo 6.4 - Reconectar Dispositivo B**
1. Reativar conexão de rede no Dispositivo B
2. Aguardar reconexão automática (< 5 segundos)
3. Observar processo de sincronização

#### Verificações de Resolução de Conflito:

**Estratégia Esperada (escolher uma):**

**Opção A: Last Write Wins (Última escrita vence)**
- [ ] Edição do Dispositivo B sobrescreve a do Dispositivo A
- [ ] Ambos dispositivos mostram mesmo conteúdo final
- [ ] Sem perda de dados críticos

**Opção B: Merge Inteligente**
- [ ] Sistema combina ambas observações
- [ ] Formato: "[Texto A] | [Texto B]" ou similar
- [ ] Timestamp de cada edição preservado

**Opção C: Notificação de Conflito**
- [ ] Interface alerta sobre conflito detectado
- [ ] Usuário pode escolher qual versão manter
- [ ] Opção de mesclar manualmente

#### Verificações Críticas:
- [ ] **Nenhum dado é perdido silenciosamente**
- [ ] **Sistema não trava ou gera erro fatal**
- [ ] **Estado final é consistente em ambos dispositivos**
- [ ] **Indicadores visuais de sincronização corretos**
- [ ] **Histórico de alterações preservado (se disponível)**

#### Verificar em Ambos Dispositivos:
1. Recarregar ambas páginas (hard refresh)
2. Verificar que dados são idênticos
3. Verificar que não há loops de sincronização
4. Verificar logs/console para erros

#### Resultado Esperado:
✅ Conflito resolvido automaticamente ou com intervenção clara do usuário. Dados não são perdidos. Estado final consistente em todos os dispositivos.

#### ⏱️ Tempo Esperado:
- 3-4 minutos

#### ❌ Problemas Críticos:
- Perda de dados de uma das edições
- Loop infinito de sincronização
- Interface trava após reconexão
- Dados inconsistentes entre dispositivos

---

### 7️⃣ Operações em Lote

**Objetivo:** Validar performance e sincronização de alterações em massa.

#### Preparação:
- Garantir que há pelo menos 10 instalações pendentes

#### Passos no Dispositivo A:

**Ação 7.1 - Seleção em lote**
1. Usar checkbox ou Ctrl+Click para selecionar 10 instalações
2. Verificar que todas estão selecionadas visualmente
3. Verificar contador "10 selecionadas"

**Ação 7.2 - Marcar todas como concluídas**
1. Clicar em "Marcar como Concluído" (ação em lote)
2. Confirmar ação (se houver modal de confirmação)
3. Aguardar processamento

#### Verificações no Dispositivo A:
- [ ] Ação em lote processa em < 3 segundos
- [ ] Todas as 10 instalações têm status "Concluído"
- [ ] Estatísticas atualizadas:
  - Concluídas: +10
  - Pendentes: -10
  - Progresso: recalculado
- [ ] Interface responsiva durante processamento
- [ ] Indicador de progresso visível (loading/spinner)

#### Verificações no Dispositivo B:

**Sincronização em Lote:**
1. Observar Dispositivo B (sem refresh manual)
2. Cronometrar tempo até sincronização completa

- [ ] **Todas as 10 instalações atualizadas automaticamente**
- [ ] **Tempo de sincronização: _____ segundos**
  - Meta ideal: < 5 segundos
  - Meta aceitável: < 10 segundos
- [ ] **Estatísticas atualizadas em tempo real**
- [ ] **Gráficos/indicadores recalculados**
- [ ] **Filtros continuam funcionando corretamente**
- [ ] **Performance da interface mantida (sem lag)**

#### Teste de Stress (Opcional):
1. Repetir com 20, 30, 50 instalações
2. Verificar limites de performance
3. Documentar qualquer degradação

#### Resultado Esperado:
✅ Operação em lote de 10 instalações sincroniza para outro dispositivo em menos de 5 segundos. Interface permanece responsiva. Dados consistentes.

#### ⏱️ Tempo Esperado:
- 2-3 minutos

---

## ✅ Critérios de Sucesso

### Sincronização em Tempo Real
- [ ] Latência média de sincronização < 5 segundos
- [ ] 100% das alterações sincronizadas com sucesso
- [ ] Sincronização bidirecional funcional (A↔B)
- [ ] Operações em lote sincronizam corretamente

### Resolução de Conflitos
- [ ] Conflitos detectados e tratados adequadamente
- [ ] Zero perda de dados em cenários de conflito
- [ ] Estado final consistente entre dispositivos
- [ ] Usuário informado sobre conflitos (se aplicável)

### Presença e Colaboração
- [ ] Indicadores de presença funcionais (se disponível)
- [ ] Múltiplos dispositivos simultâneos suportados
- [ ] Performance não degrada com colaboração ativa

### Confiabilidade
- [ ] Reconexão automática após offline funcional
- [ ] Dados offline sincronizam ao reconectar
- [ ] Zero erros de console críticos
- [ ] Sistema não trava em nenhum cenário

---

## 📊 Métricas de Avaliação

| Critério | Meta | Resultado | Status |
|----------|------|-----------|--------|
| Latência de sincronização (média) | < 5s | _____ s | ☐ |
| Taxa de sucesso de sincronização | 100% | _____ % | ☐ |
| Operações em lote (10 itens) | < 5s | _____ s | ☐ |
| Resolução de conflitos | Automática | _____ | ☐ |
| Reconexão após offline | < 5s | _____ s | ☐ |
| Perda de dados | 0 | _____ | ☐ |

### Latências Detalhadas

| Tipo de Operação | Dispositivo A → B | Dispositivo B → A |
|------------------|-------------------|-------------------|
| Nova instalação | _____ s | _____ s |
| Edição de campo | _____ s | _____ s |
| Upload de foto | _____ s | _____ s |
| Mudança de status | _____ s | _____ s |
| Lote (10 itens) | _____ s | _____ s |

---

## 🐛 Registro de Problemas

### Problema 1
- **Passo:** _____
- **Dispositivo:** ☐ A ☐ B ☐ Ambos
- **Descrição:** _____
- **Severidade:** ☐ Crítico ☐ Alto ☐ Médio ☐ Baixo
- **Tipo:** ☐ Sincronização ☐ Conflito ☐ Performance ☐ UI/UX
- **Screenshot:** _____
- **Console Errors:** _____
- **Reproduzível:** ☐ Sim ☐ Não

### Problema 2
- **Passo:** _____
- **Dispositivo:** ☐ A ☐ B ☐ Ambos
- **Descrição:** _____
- **Severidade:** ☐ Crítico ☐ Alto ☐ Médio ☐ Baixo
- **Tipo:** ☐ Sincronização ☐ Conflito ☐ Performance ☐ UI/UX
- **Screenshot:** _____
- **Console Errors:** _____
- **Reproduzível:** ☐ Sim ☐ Não

---

## 🔍 Checklist de Validação Técnica

### WebSocket / Realtime Connection
- [ ] Conexão estabelecida em ambos dispositivos
- [ ] Reconexão automática funcional
- [ ] Heartbeat/ping mantém conexão ativa
- [ ] Não há loops de reconexão infinita

### Sincronização de Dados
- [ ] Operações CRUD sincronizam corretamente
- [ ] Upload de arquivos sincroniza (fotos)
- [ ] Deleções propagam para outros dispositivos
- [ ] Atualizações parciais (patches) funcionam

### Performance
- [ ] Sem memory leaks durante sincronização longa
- [ ] Network payload otimizado (delta sync se possível)
- [ ] Interface não congela durante sync
- [ ] Rate limiting implementado (se aplicável)

### Segurança
- [ ] Apenas usuário autenticado vê suas alterações
- [ ] Tokens de sessão válidos em ambos dispositivos
- [ ] Não há vazamento de dados entre usuários

---

## 📝 Observações Adicionais

### Pontos Positivos
- _____
- _____
- _____

### Pontos de Melhoria
- _____
- _____
- _____

### Sugestões de Otimização
- _____
- _____
- _____

### Comportamentos Inesperados
- _____
- _____
- _____

---

## 💡 Cenários Extras (Avançado)

### Teste 8: Três Dispositivos Simultâneos
- Adicionar um terceiro dispositivo
- Verificar sincronização A → B → C
- Validar performance com 3+ clientes

### Teste 9: Mudança de Rede
- Trocar de WiFi para dados móveis durante edição
- Verificar reconexão e sincronização

### Teste 10: Baixa Conectividade
- Simular conexão 3G lenta
- Verificar comportamento e feedback ao usuário

### Teste 11: Sessões Longas
- Manter dispositivos conectados por 30+ minutos
- Realizar edições esporádicas
- Verificar estabilidade da conexão

---

## ✍️ Assinatura do Teste

**Testador:** _____________________  
**Data:** ___/___/______  
**Versão do Sistema:** _____  
**Dispositivo A:** _____ (ex: Chrome 120, Windows 11)  
**Dispositivo B:** _____ (ex: Safari 17, iOS 17)  
**Qualidade da Rede:** ☐ Excelente ☐ Boa ☐ Regular ☐ Ruim  
**Status Final:** ☐ Aprovado ☐ Aprovado com ressalvas ☐ Reprovado

---

## 📎 Anexos

- [ ] Screenshots de ambos dispositivos lado a lado
- [ ] Vídeo demonstrando sincronização em tempo real
- [ ] Logs de console de ambos dispositivos
- [ ] Gravação de Network Tab (WebSocket frames)
- [ ] Relatório de performance (tempos de sincronização)
- [ ] Casos de conflito documentados

---

## 🚨 Troubleshooting

### Sincronização não funciona
1. Verificar console para erros de WebSocket
2. Confirmar que ambos dispositivos estão online
3. Verificar se usuário está autenticado em ambos
4. Limpar cache e relogar
5. Verificar configuração do Supabase Realtime

### Conflitos causam perda de dados
1. Verificar logs de merge/conflict resolution
2. Testar com dados menos críticos
3. Documentar exatamente os passos que causaram perda
4. Reportar como bug crítico

### Performance ruim em lote
1. Verificar tamanho do payload de sincronização
2. Considerar implementar debouncing
3. Avaliar se batch updates estão otimizados
4. Verificar índices no banco de dados

---

## 📚 Referências

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- Documento: `docs/SYNC_SYSTEM.md`
- Documento: `AUTO_SYNC_IMPLEMENTATION.md`
- Documento: `CONFLICT_RESOLUTION_GUIDE.md`

---

**Última atualização:** 2025-10-21  
**Versão do documento:** 1.0
