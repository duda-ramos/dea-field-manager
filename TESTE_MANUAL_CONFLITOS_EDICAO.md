# Testes de Integração Manual - Conflitos de Edição

## 📋 Objetivo
Validar funcionamento completo do sistema de detecção e resolução de conflitos de edição simultânea em cenário real.

## 🔧 Pré-requisitos
- Aplicação rodando localmente (`npm run dev`)
- Duas abas/janelas do navegador abertas
- Ferramentas de desenvolvedor (DevTools) acessíveis
- Mesmo usuário logado em ambas as abas

---

## 📌 Cenário 1: Conflito Básico

### Setup Inicial
1. Abrir aplicação em duas abas/janelas do navegador
2. Login com mesmo usuário em ambas as abas
3. Navegar para a página de instalações em ambas

### Passos de Execução

#### 1. Criar Conflito
- [ ] **Aba 1:** Selecionar uma instalação específica (ex: "Instalação X")
- [ ] **Aba 1:** Editar campo "Descrição" = "Versão Local"
- [ ] **Aba 1:** Abrir DevTools (F12) → Network → Definir como "Offline"
- [ ] **Aba 2:** Editar a MESMA instalação X
- [ ] **Aba 2:** Editar campo "Descrição" = "Versão Remota"
- [ ] **Aba 2:** Clicar em "Salvar" (deve salvar com sucesso no servidor)

#### 2. Detectar Conflito
- [ ] **Aba 1:** Voltar online (DevTools → Network → "Online")
- [ ] **Aba 1:** Clicar no botão "Sincronizar" no header

### Validações Esperadas

#### Interface de Notificação
- [ ] **Toast aparece:** "1 edição simultânea detectada"
- [ ] **Badge no header:** Mostra "1 conflito pendente" com ícone de alerta (⚠️)
- [ ] **Toast interativo:** Tem botão "Resolver" clicável
- [ ] **Duração do toast:** Permanece visível por 10 segundos

#### Modal de Conflito
- [ ] **Ao clicar no toast OU badge:** Modal de conflito abre
- [ ] **Título do modal:** "Edição Simultânea Detectada"
- [ ] **Descrição:** Explica que o registro foi editado por outro usuário
- [ ] **Identificação:** Mostra nome da instalação corretamente

#### Comparação de Versões
- [ ] **Card Esquerdo - Sua Versão:**
  - Badge "Local" (azul)
  - Campo Descrição: "Versão Local"
  - Data/hora da edição local
  - Botão "Manter Minha Versão" (primário)

- [ ] **Card Direito - Versão Remota:**
  - Badge "Remoto" (verde)
  - Campo Descrição: "Versão Remota"
  - Data/hora da edição remota
  - Botão "Usar Versão Remota" (secundário)

- [ ] **Opção de adiar:** Botão "Decidir Mais Tarde" centralizado abaixo

#### Resolução - Manter Versão Local
- [ ] Clicar em "Manter Minha Versão"
- [ ] **Toast de confirmação:** "Sua versão foi mantida e enviada ao servidor"
- [ ] Modal fecha automaticamente
- [ ] Badge de conflito desaparece
- [ ] Dados na tela mostram "Versão Local"

#### Verificação Cross-Tab
- [ ] **Aba 2:** Clicar em "Sincronizar"
- [ ] **Aba 2:** Dados atualizam para "Versão Local"
- [ ] **Aba 2:** Nenhum conflito é detectado

### ✅ Resultado Esperado
Versão local foi forçada com sucesso e está sincronizada em ambas as abas.

---

## 📌 Cenário 2: Usar Versão Remota

### Setup
Repetir passos 1-6 do Cenário 1 com valores diferentes:
- **Aba 1:** Descrição = "Minha Alteração"
- **Aba 2:** Descrição = "Alteração do Servidor"

### Validações Específicas

#### Resolução - Usar Versão Remota
- [ ] Modal abre com ambas as versões
- [ ] Clicar em "Usar Versão Remota"
- [ ] **Toast de confirmação:** "Versão remota foi aplicada"
- [ ] Modal fecha automaticamente
- [ ] Badge de conflito desaparece
- [ ] **Aba 1:** Dados mostram "Alteração do Servidor"
- [ ] **Aba 1:** Campo descrição foi atualizado localmente

### ✅ Resultado Esperado
Versão local foi descartada e versão remota foi aplicada corretamente.

---

## 📌 Cenário 3: Decidir Mais Tarde

### Passos
1. Criar conflito como no Cenário 1
2. Quando modal abrir, clicar em "Decidir Mais Tarde"

### Validações de Persistência

#### Estado Imediato
- [ ] Modal fecha
- [ ] Badge PERMANECE visível: "1 conflito pendente"
- [ ] Toast pode ser fechado (X) mas badge continua
- [ ] Aplicação continua funcionando normalmente

#### Persistência após Reload
- [ ] Recarregar página (F5)
- [ ] Badge AINDA mostra: "1 conflito pendente"
- [ ] Clicar no badge reabre o modal
- [ ] Mesmo conflito é exibido com dados corretos
- [ ] Todas as opções continuam disponíveis

#### Persistência em Nova Sessão
- [ ] Fechar a aba completamente
- [ ] Abrir nova aba e navegar para aplicação
- [ ] Badge aparece após login: "1 conflito pendente"
- [ ] Conflito persiste até ser resolvido

### ✅ Resultado Esperado
Conflito permanece pendente indefinidamente até ser explicitamente resolvido.

---

## 📌 Cenário 4: Múltiplos Conflitos

### Setup
1. Criar conflitos em 3 instalações diferentes (A, B, C)
2. Usar o processo offline/online do Cenário 1 para cada uma

### Passos de Execução

#### Criar Múltiplos Conflitos
- [ ] **Instalação A:** 
  - Aba 1: Nome = "A Local"
  - Aba 2: Nome = "A Remoto"
- [ ] **Instalação B:**
  - Aba 1: Nome = "B Local"
  - Aba 2: Nome = "B Remoto"
- [ ] **Instalação C:**
  - Aba 1: Nome = "C Local"
  - Aba 2: Nome = "C Remoto"
- [ ] **Aba 1:** Voltar online e sincronizar

### Validações de Fila

#### Notificação Inicial
- [ ] Badge mostra: "3 conflitos pendentes"
- [ ] Toast: "3 edições simultâneas detectadas"

#### Processamento em Ordem
- [ ] Abrir modal → mostra conflito da Instalação A
- [ ] Resolver Instalação A (qualquer opção)
- [ ] Modal automaticamente mostra Instalação B
- [ ] Badge atualiza para: "2 conflitos pendentes"
- [ ] Resolver Instalação B
- [ ] Modal automaticamente mostra Instalação C
- [ ] Badge atualiza para: "1 conflito pendente"
- [ ] Resolver Instalação C
- [ ] Modal fecha automaticamente
- [ ] Badge desaparece completamente

#### Decisão Parcial
- [ ] Criar 3 conflitos novamente
- [ ] Resolver primeiro conflito
- [ ] "Decidir Mais Tarde" no segundo
- [ ] Badge deve mostrar: "2 conflitos pendentes"
- [ ] Reabrir modal: mostra terceiro conflito (pula o adiado)

### ✅ Resultado Esperado
Sistema processa fila de conflitos em ordem, permitindo resolução individual ou adiamento.

---

## 📌 Cenário 5: Conflito Durante Sincronização Automática

### Setup
1. Verificar que sincronização automática está ativa
2. Configurar intervalo curto para teste (ex: 30 segundos)

### Passos
- [ ] **Aba 1:** Editar instalação sem salvar
- [ ] **Aba 2:** Editar mesma instalação e salvar
- [ ] **Aba 1:** Aguardar sincronização automática disparar

### Validações
- [ ] Conflito é detectado automaticamente
- [ ] Notificações aparecem sem interação manual
- [ ] Resolução funciona normalmente
- [ ] Sincronização automática continua após resolução

---

## 📌 Cenário 6: Conflito com Campos Múltiplos

### Setup
Editar múltiplos campos na mesma instalação em ambas as abas

### Validações
- [ ] Modal mostra TODOS os campos alterados
- [ ] Comparação lado a lado está clara
- [ ] Resolução aplica TODOS os campos da versão escolhida
- [ ] Nenhum campo fica com valor "misto"

---

## 🐛 Casos de Erro

### Teste 1: Falha de Rede Durante Resolução
- [ ] Criar conflito
- [ ] Desconectar internet
- [ ] Tentar resolver
- [ ] Verificar mensagem de erro apropriada
- [ ] Conflito permanece pendente

### Teste 2: Logout com Conflitos Pendentes
- [ ] Criar conflitos
- [ ] Fazer logout
- [ ] Login novamente
- [ ] Conflitos devem reaparecer

### Teste 3: Múltiplas Abas Resolvendo Mesmo Conflito
- [ ] Abrir 3 abas com mesmo usuário
- [ ] Criar conflito visível em todas
- [ ] Resolver em uma aba
- [ ] Outras abas devem atualizar automaticamente

---

## 📊 Métricas de Sucesso

### Performance
- [ ] Detecção de conflito < 2 segundos após sincronização
- [ ] Modal abre instantaneamente ao clicar
- [ ] Resolução processa < 1 segundo

### Usabilidade
- [ ] Todas as mensagens são claras e em português
- [ ] Ações disponíveis são óbvias
- [ ] Não há perda de dados em nenhum cenário
- [ ] Sistema permanece responsivo durante conflitos

### Confiabilidade
- [ ] Conflitos nunca são perdidos
- [ ] Resoluções sempre são aplicadas
- [ ] Estado é consistente entre abas
- [ ] Persistência funciona após reload/logout

---

## 🎯 Checklist Final

- [ ] Todos os cenários passaram sem erros
- [ ] Interface está intuitiva e responsiva
- [ ] Mensagens são claras e helpful
- [ ] Não há regressões em funcionalidades existentes
- [ ] Performance está adequada
- [ ] Edge cases foram testados

## 📝 Observações
_Espaço para anotar bugs encontrados, sugestões de melhoria ou comportamentos inesperados durante os testes._

---

**Data do Teste:** ___/___/___  
**Testador:** _________________  
**Versão:** _________________