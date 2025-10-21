# Cenário de Teste 2 - Uso em Campo Offline

## Objetivo
Validar o funcionamento completo do sistema em modo offline, incluindo sincronização automática de dados quando a conexão é restabelecida.

## Pré-requisitos
- Aplicação instalada e funcionando
- Conta de usuário criada
- Projeto existente com 50+ instalações cadastradas
- Dispositivo com capacidade de desativar conexão (WiFi/dados móveis)

---

## Etapas do Teste

### 1. Preparação (com conexão)

**Objetivo:** Garantir que todos os dados estejam carregados localmente antes de entrar no modo offline.

- [ ] Fazer login no sistema
- [ ] Abrir um projeto existente (com 50+ instalações)
- [ ] Aguardar a sincronização completa dos dados
- [ ] Verificar que todos os dados estão carregados:
  - Lista de instalações completa
  - Detalhes de instalações acessíveis
  - Fotos carregadas (se houver)
  - Sem indicadores de carregamento pendentes

**Resultado esperado:** Todos os dados do projeto carregados e disponíveis localmente.

---

### 2. Simular perda de conexão

**Objetivo:** Colocar o sistema em modo offline para testar funcionalidades sem internet.

**Opção A - Dispositivo móvel:**
- [ ] Desativar WiFi nas configurações do dispositivo
- [ ] Desativar dados móveis nas configurações do dispositivo

**Opção B - Navegador (DevTools):**
- [ ] Abrir DevTools (F12)
- [ ] Ir para aba Network
- [ ] Ativar modo "Offline"

**Resultado esperado:** Badge "Offline" visível na interface do sistema.

---

### 3. Trabalhar offline

**Objetivo:** Realizar operações típicas de trabalho em campo sem conexão com a internet.

#### 3.1 Navegação
- [ ] Navegar entre diferentes instalações
- [ ] Acessar detalhes de instalações
- [ ] Verificar que a navegação é fluida e sem erros

#### 3.2 Marcar instalações como concluídas
- [ ] Selecionar 10 instalações diferentes
- [ ] Marcar cada uma como concluída
- [ ] Verificar que o status é atualizado localmente

#### 3.3 Adicionar observações
- [ ] Selecionar 5 instalações
- [ ] Adicionar observações de campo em cada uma (ex: "Instalação verificada", "Cabo danificado", etc.)
- [ ] Salvar as observações

#### 3.4 Tirar fotos
- [ ] Selecionar 3 instalações diferentes
- [ ] Adicionar 3-5 fotos em cada instalação
- [ ] Verificar que as fotos são armazenadas localmente
- [ ] Total: 9-15 fotos adicionadas

#### 3.5 Editar dados
- [ ] Selecionar 2 instalações
- [ ] Editar informações (ex: endereço, potência, observações, etc.)
- [ ] Salvar as alterações

**Resultado esperado:** Todas as operações executadas com sucesso, sem mensagens de erro.

---

### 4. Verificar indicadores offline

**Objetivo:** Confirmar que o sistema está informando corretamente o status offline e pendências.

- [ ] Badge "Offline" está visível na interface
- [ ] Contador de pendências mostrando **15-20 itens**:
  - 10 instalações concluídas
  - 5 observações adicionadas
  - 9-15 fotos (contadas individualmente ou em lote)
  - 2 edições de dados
- [ ] **Nenhuma mensagem de erro** sendo exibida
- [ ] Interface responsiva e funcional

**Resultado esperado:** Indicadores claros de modo offline e quantidade de alterações pendentes de sincronização.

---

### 5. Tentar gerar relatório offline

**Objetivo:** Verificar o comportamento do sistema ao tentar gerar relatórios sem conexão.

**Opção A - Bloqueio de relatório online:**
- [ ] Abrir modal/tela de relatórios
- [ ] Tentar gerar um relatório
- [ ] Verificar mensagem informando que é necessário estar online
- [ ] Confirmar que o sistema não trava ou gera erros

**Opção B - Relatório com dados locais:**
- [ ] Abrir modal/tela de relatórios
- [ ] Gerar relatório com dados disponíveis localmente
- [ ] Verificar que o relatório é gerado com os dados em cache
- [ ] Verificar indicação de que alguns dados podem estar desatualizados

**Resultado esperado:** Sistema informa claramente as limitações ou gera relatório com dados locais, sem crashes.

---

### 6. Reconectar

**Objetivo:** Restabelecer conexão e verificar sincronização automática.

**Opção A - Dispositivo móvel:**
- [ ] Reativar WiFi nas configurações
- [ ] Ou reativar dados móveis

**Opção B - Navegador (DevTools):**
- [ ] Desativar modo "Offline" no DevTools

**Após reconectar:**
- [ ] Aguardar sincronização automática (não deve exigir ação do usuário)
- [ ] Verificar toast/notificação "Sincronização em andamento"
- [ ] Aguardar toast/notificação "Sincronização concluída"
- [ ] Verificar que o contador de pendências **zerou**
- [ ] Badge "Offline" desapareceu ou mudou para "Online"

**Resultado esperado:** 
- Sincronização automática em até **30-60 segundos** para 20 alterações + 15 fotos
- Todos os indicadores de pendências zerados
- Sistema confirmando sucesso da sincronização

---

### 7. Validar dados sincronizados

**Objetivo:** Confirmar que todas as alterações foram sincronizadas corretamente com o servidor.

#### 7.1 Verificação em outro dispositivo/navegador
- [ ] Abrir o mesmo projeto em outro dispositivo ou navegador
- [ ] Fazer login com a mesma conta
- [ ] Verificar que todas as 10 instalações marcadas como concluídas aparecem com status correto
- [ ] Verificar que as 5 observações adicionadas estão presentes
- [ ] Verificar que as 2 instalações editadas mostram os dados atualizados

#### 7.2 Verificação de fotos
- [ ] Abrir as 3 instalações onde fotos foram adicionadas
- [ ] Verificar que todas as 9-15 fotos foram enviadas
- [ ] Verificar que as fotos são exibidas corretamente
- [ ] Verificar que as fotos têm boa qualidade (sem corrupção)

#### 7.3 Verificação de timestamps
- [ ] Verificar que as datas/horários das alterações estão corretos
- [ ] Timestamps devem refletir o momento em que foram feitas (durante o período offline)
- [ ] Não devem mostrar o horário da sincronização

**Resultado esperado:** 
- **100% das alterações sincronizadas corretamente**
- Nenhuma perda de dados
- Fotos íntegras e visíveis
- Timestamps preservados corretamente

---

## Critérios de Sucesso

### ✅ Funcionalidade Offline
- [ ] Sistema funciona 100% offline para operações de campo
- [ ] Todas as operações (navegação, edição, fotos, marcação) funcionam sem conexão
- [ ] Interface clara sobre status offline

### ✅ Sincronização
- [ ] Sincronização automática ao reconectar
- [ ] Tempo máximo de sincronização: **30-60 segundos** para 20 alterações + 15 fotos
- [ ] 100% de integridade dos dados sincronizados

### ✅ Experiência do Usuário
- [ ] Nenhuma mensagem de erro durante uso offline
- [ ] Indicadores claros de pendências
- [ ] Feedback claro durante sincronização
- [ ] Sem perda de trabalho realizado offline

---

## Troubleshooting

### Problema: Sincronização não inicia automaticamente
**Solução:** 
- Verificar se a conexão foi realmente restabelecida
- Recarregar a página
- Verificar console do navegador para erros

### Problema: Algumas fotos não sincronizaram
**Solução:**
- Verificar tamanho das fotos (podem ter excedido limite)
- Verificar logs de erro
- Tentar resincronizar manualmente se disponível

### Problema: Contador de pendências não zerou
**Solução:**
- Aguardar mais tempo (conexão lenta pode demorar mais)
- Verificar se há erros de autenticação
- Verificar console para erros específicos

---

## Notas Adicionais

- Este teste simula um dia típico de trabalho em campo
- Recomenda-se executar em diferentes condições de rede (3G, 4G, WiFi)
- Teste com volumes maiores de fotos (20-30) para validar limites
- Documentar qualquer comportamento inesperado para análise

---

## Registro de Execução

**Data do teste:** _______________  
**Testador:** _______________  
**Dispositivo/Navegador:** _______________  
**Resultado:** [ ] Passou [ ] Falhou  
**Observações:** 

_______________________________________________________________________________

_______________________________________________________________________________

_______________________________________________________________________________
