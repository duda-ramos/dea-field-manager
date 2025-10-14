# 📚 Guia Rápido - Sistema de Histórico de Revisões

## O que é o Sistema de Revisões?

O Sistema de Histórico de Revisões permite acompanhar todas as alterações feitas em uma instalação ao longo do tempo. Cada mudança é registrada automaticamente, permitindo visualizar versões anteriores e, se necessário, restaurá-las.

## Como Acessar o Histórico

1. **Abra os detalhes de uma instalação**
   - Clique em qualquer instalação na lista do projeto

2. **Localize o botão de Histórico**
   - Na aba "Informações", procure pelo botão "Histórico de Revisões" 
   - O botão exibe um ícone de relógio ⏰ e mostra o número de revisões disponíveis

3. **Clique para abrir o histórico**
   - Um modal será aberto mostrando a timeline completa de revisões

## Entendendo a Timeline de Revisões

### 📅 Organização
- As revisões são exibidas em ordem cronológica reversa (mais recente primeiro)
- Cada revisão mostra data e hora no formato: `dd/MM/yyyy às HH:mm`

### 🏷️ Tipos de Revisão
Cada revisão possui um badge colorido indicando o tipo de alteração:

- **🔴 Problema de Instalação** (vermelho): Indica que houve algum problema técnico
- **🔵 Revisão de Conteúdo** (azul): Alterações nos dados ou informações
- **🟠 Desaprovado pelo Cliente** (laranja): Cliente solicitou mudanças
- **⚪ Outros** (cinza): Outras alterações gerais
- **🟢 Restaurado** (verde): Versão restaurada de uma revisão anterior

### 📋 Informações Exibidas
Cada item na timeline mostra:
- Número da revisão (ex: "Revisão #3")
- Data e hora da alteração
- Tipo de alteração (badge colorido)
- Preview rápido com informações principais:
  - Tipologia
  - Quantidade
  - Pavimento

## Visualizando Detalhes de uma Revisão

1. **Clique em "Ver Detalhes"** no item desejado
2. Um modal secundário será aberto mostrando:
   - Todas as informações da instalação naquele momento
   - Campos organizados em categorias
   - Valores que estavam preenchidos na época

## Restaurando uma Versão Anterior

### ⚠️ Importante Entender
- Restaurar NÃO apaga o histórico existente
- Uma NOVA revisão é criada com os dados restaurados
- O histórico completo é sempre preservado

### 📝 Passo a Passo

1. **Identifique a versão desejada** na timeline
2. **Clique em "Restaurar"** nessa revisão
3. **Leia o aviso de confirmação** cuidadosamente
4. **Confirme a restauração** clicando em "Restaurar"
5. **Aguarde o processamento** (indicador de carregamento)
6. **Verifique o sucesso** através do toast de confirmação

### ✅ Após a Restauração
- Os dados da instalação voltam ao estado selecionado
- Uma nova revisão tipo "Restaurado" é criada
- O número de revisão é incrementado
- A lista é atualizada automaticamente

## Casos de Uso Comuns

### 🔧 Corrigir Erro de Digitação
1. Identifique quando o erro foi introduzido
2. Encontre a última versão correta
3. Restaure essa versão
4. Faça ajustes adicionais se necessário

### 📊 Comparar Mudanças ao Longo do Tempo
1. Abra o histórico
2. Use "Ver Detalhes" em diferentes revisões
3. Compare as informações entre versões

### 🔄 Desfazer Alterações Recentes
1. Verifique a revisão mais recente sem as alterações indesejadas
2. Restaure para essa versão
3. O sistema criará uma nova revisão com os dados antigos

## Dicas e Boas Práticas

### 💡 Dicas de Uso
- **Sempre verifique** os detalhes antes de restaurar
- **Use descrições claras** ao fazer alterações (campo observações)
- **Documente o motivo** das mudanças importantes

### ⚡ Performance
- O histórico carrega rapidamente mesmo com muitas revisões
- Use o scroll para navegar em listas longas
- Os detalhes são carregados sob demanda

### 📱 Mobile
- Interface totalmente responsiva
- Timeline adaptada para telas pequenas
- Todos os recursos disponíveis em dispositivos móveis

## Perguntas Frequentes

### ❓ Posso deletar uma revisão?
Não. O histórico é permanente para manter a integridade dos dados.

### ❓ Quantas revisões são mantidas?
Todas as revisões são mantidas indefinidamente.

### ❓ A restauração é reversível?
Sim! Como uma nova revisão é criada, você sempre pode restaurar para qualquer versão anterior.

### ❓ O que acontece com as fotos ao restaurar?
As fotos associadas à versão restaurada também são recuperadas.

---

💡 **Precisa de ajuda?** Entre em contato com o suporte técnico.