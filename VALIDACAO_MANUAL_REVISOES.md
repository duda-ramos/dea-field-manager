# Validação Manual Completa do Sistema de Revisões

## 📋 Visão Geral

Este documento descreve o processo completo de validação manual do sistema de revisões, incluindo todos os cenários de teste, critérios de aceitação e pontos de verificação.

## 🎯 Objetivo

Executar testes manuais completos do sistema de revisões para garantir funcionamento correto de todas as funcionalidades implementadas.

## 🔧 Preparação do Ambiente de Teste

### Pré-requisitos
1. Aplicação rodando localmente (`npm run dev`)
2. Banco de dados Supabase configurado
3. Projeto com instalações existentes
4. Credenciais de acesso válidas

### Dados de Teste Necessários
- [ ] Instalação com múltiplas revisões (mínimo 3)
- [ ] Instalação recém-criada (apenas 1 revisão)
- [ ] Instalação com diferentes tipos de alterações
- [ ] Instalação com fotos anexadas

## ✅ Checklist de Testes Detalhado

### 📱 Teste 1: Visualização do Histórico de Revisões

#### Passos:
1. Fazer login na aplicação
2. Navegar para um projeto com instalações
3. Abrir o modal de detalhes de uma instalação com múltiplas revisões
4. Navegar para a aba "Informações"
5. Localizar e clicar no botão "Histórico de Revisões"

#### Validações:
- [ ] **Botão de Histórico**
  - [ ] Visível na aba "Informações"
  - [ ] Mostra contador com número correto de revisões (ex: "Histórico de Revisões (3)")
  - [ ] Ícone de relógio (Clock) exibido corretamente
  - [ ] Estilo: botão outline com hover state

- [ ] **Modal de Histórico**
  - [ ] Abre corretamente ao clicar no botão
  - [ ] Título: "Histórico de Revisões - [CÓDIGO]"
  - [ ] Subtítulo mostra descrição da instalação
  - [ ] Botão X para fechar no canto superior direito
  - [ ] Área scrollable para conteúdo extenso

- [ ] **Timeline de Revisões**
  - [ ] Linha vertical conectando todas as revisões
  - [ ] Pontos (dots) na timeline para cada revisão
  - [ ] Ordem cronológica reversa (mais recente primeiro)
  - [ ] Cards de revisão com sombra e hover effect

- [ ] **Informações de Cada Revisão**
  - [ ] Número da revisão (Revisão 1, 2, 3...)
  - [ ] Badge de tipo com cor apropriada:
    - Verde: "Criado"
    - Amarelo: "Editado"
    - Roxo: "Restaurado"
    - Vermelho: "Problema de Instalação"
    - Azul: "Revisão de Conteúdo"
    - Laranja: "Desaprovado pelo Cliente"
    - Cinza: "Outros"
  - [ ] Data/hora formatada: "dd/MM/yyyy às HH:mm"
  - [ ] Descrição do motivo (se houver)
  - [ ] Preview rápido com Tipologia, Quantidade e Pavimento

### 🔍 Teste 2: Visualização de Detalhes de Revisão

#### Passos:
1. No modal de histórico aberto
2. Identificar uma revisão específica
3. Clicar no botão "Ver Detalhes" (ícone de olho)
4. Observar a expansão inline do conteúdo

#### Validações:
- [ ] **Botão de Detalhes**
  - [ ] Texto muda de "Ver Detalhes" para "Ocultar" quando expandido
  - [ ] Ícone muda de Eye para ChevronUp
  - [ ] Transição suave na expansão/colapso

- [ ] **Área de Detalhes Expandida**
  - [ ] Background com cor de destaque (muted/30)
  - [ ] Borda arredondada e padding adequado
  - [ ] Badge indicando tipo de visualização:
    - "Primeira Versão" (verde) se for a primeira
    - "Comparação de Versões" (azul) se houver anterior

- [ ] **Renderização do VersionDiffView**
  - [ ] Componente carregado corretamente
  - [ ] Layout responsivo aplicado
  - [ ] Botão "Restaurar Esta Versão" visível (exceto se for versão atual)

### 🔄 Teste 3: Comparação de Campos entre Versões

#### Passos:
1. Expandir detalhes de uma revisão que não seja a primeira
2. Observar a comparação lado a lado (desktop) ou empilhada (mobile)
3. Identificar campos que foram alterados

#### Validações:
- [ ] **Layout de Comparação**
  - [ ] Desktop: duas colunas lado a lado
  - [ ] Mobile: versões empilhadas verticalmente
  - [ ] Headers: "Versão Anterior" e "Esta Versão"

- [ ] **Campos Exibidos**
  - [ ] Tipologia
  - [ ] Código
  - [ ] Descrição
  - [ ] Quantidade
  - [ ] Pavimento
  - [ ] Diretriz Altura (cm)
  - [ ] Diretriz Distância Batente (cm)
  - [ ] Status (Instalado/Pendente)
  - [ ] Observações
  - [ ] Comentários para Fornecedor
  - [ ] Número de Fotos

- [ ] **Destaque de Alterações**
  - [ ] Campos alterados com borda amarela
  - [ ] Background amarelo claro nos campos modificados
  - [ ] Badge "Alterado" ao lado do label do campo
  - [ ] Campos não alterados sem destaque especial

- [ ] **Valores dos Campos**
  - [ ] Campos vazios mostram "—"
  - [ ] Valores numéricos formatados corretamente
  - [ ] Status mostra "Instalado" ou "Pendente"
  - [ ] Contagem de fotos exibe número correto

- [ ] **Resumo de Alterações**
  - [ ] Texto indicando número de campos alterados
  - [ ] Ex: "3 campo(s) alterado(s)" ou "Nenhuma alteração detectada"

### 🔙 Teste 4: Restauração de Versão Anterior

#### Passos:
1. Expandir detalhes de uma revisão anterior
2. Clicar no botão "Restaurar Esta Versão"
3. Ler o dialog de confirmação
4. Clicar em "Restaurar"
5. Aguardar o processo completar

#### Validações:
- [ ] **Botão de Restauração**
  - [ ] Habilitado apenas para versões anteriores
  - [ ] Desabilitado se for a versão atual
  - [ ] Texto informativo acima do botão

- [ ] **Dialog de Confirmação (AlertDialog)**
  - [ ] Título: "Restaurar Versão?"
  - [ ] Descrição clara: "Os dados da instalação voltarão para esta versão. Uma nova revisão será criada no histórico."
  - [ ] Botões: "Cancelar" e "Restaurar"
  - [ ] Overlay escuro no fundo

- [ ] **Processo de Restauração**
  - [ ] Botão muda para "Restaurando..." durante o processo
  - [ ] Botões desabilitados durante processamento
  - [ ] Loading state visível

- [ ] **Após Restauração**
  - [ ] Toast de sucesso aparece
  - [ ] Modal de histórico fecha automaticamente
  - [ ] Dados da instalação atualizados no modal principal
  - [ ] Campos refletem valores da versão restaurada

- [ ] **Nova Revisão Criada**
  - [ ] Reabrir histórico mostra nova revisão no topo
  - [ ] Tipo: "Restaurado" com badge roxo
  - [ ] Número da revisão incrementado corretamente
  - [ ] Data/hora atual

### ❌ Teste 5: Cancelamento de Restauração

#### Passos:
1. Iniciar processo de restauração
2. No dialog de confirmação, clicar em "Cancelar"
3. Verificar que nada foi alterado

#### Validações:
- [ ] **Comportamento do Dialog**
  - [ ] Fecha imediatamente ao cancelar
  - [ ] Não executa nenhuma ação
  - [ ] Modal de histórico permanece aberto

- [ ] **Estado da Aplicação**
  - [ ] Nenhum dado foi alterado
  - [ ] Nenhuma nova revisão criada
  - [ ] Nenhum toast de notificação
  - [ ] Pode tentar restaurar novamente

### 🆕 Teste 6: Primeira Revisão (Criação)

#### Passos:
1. Criar uma nova instalação
2. Salvar e fechar o modal
3. Reabrir a instalação
4. Acessar o histórico de revisões

#### Validações:
- [ ] **Timeline com Item Único**
  - [ ] Apenas 1 item na timeline
  - [ ] Sem linha vertical (ou linha curta)
  - [ ] Dot único no início

- [ ] **Informações da Revisão**
  - [ ] Tipo: "Criado" com badge verde
  - [ ] Revisão número 1
  - [ ] Data/hora da criação

- [ ] **Visualização de Detalhes**
  - [ ] Ao expandir, mostra apenas "Esta Versão"
  - [ ] Sem comparação (não há versão anterior)
  - [ ] Badge "Primeira Versão" em verde
  - [ ] Todos os campos da instalação listados

- [ ] **Botão de Restauração**
  - [ ] Desabilitado ou com texto indicando versão atual
  - [ ] Mensagem: "Esta já é a versão atual da instalação."

### 📱 Teste 7: Responsividade do Sistema

#### Dispositivos a Testar:
- Desktop: 1920x1080, 1366x768
- Tablet: 768x1024 (iPad)
- Mobile: 375x667 (iPhone), 360x640 (Android)

#### Passos:
1. Abrir DevTools (F12)
2. Ativar modo responsivo
3. Testar cada resolução listada
4. Navegar pelo sistema de revisões

#### Validações por Dispositivo:

**Desktop (≥1024px)**
- [ ] Modal ocupa largura máxima de 896px (max-w-4xl)
- [ ] Comparação em grid de 2 colunas
- [ ] Timeline visível completamente
- [ ] Todos os botões acessíveis
- [ ] Scroll suave se conteúdo exceder altura

**Tablet (768px - 1023px)**
- [ ] Modal ajusta largura proporcionalmente
- [ ] Pode manter 2 colunas ou empilhar
- [ ] Botões com tamanho adequado para toque
- [ ] Preview de campos pode ser em 2 colunas

**Mobile (<768px)**
- [ ] Modal ocupa quase toda a tela
- [ ] Comparação empilhada verticalmente
- [ ] Labels "Versão Anterior" e "Esta Versão" visíveis
- [ ] Botões em tamanho touch-friendly (min 44px)
- [ ] Scroll vertical funcional
- [ ] Preview de campos empilhados

### 💾 Teste 8: Persistência de Dados

#### Passos:
1. Fazer uma alteração em uma instalação
2. Verificar nova revisão no histórico
3. Restaurar uma versão anterior
4. Fechar todos os modais
5. Recarregar a página (F5)
6. Reabrir a mesma instalação

#### Validações:
- [ ] **Após Alteração**
  - [ ] Nova revisão aparece imediatamente
  - [ ] Contador no botão atualizado
  - [ ] Dados corretos na nova revisão

- [ ] **Após Restauração**
  - [ ] Dados restaurados visíveis no modal principal
  - [ ] Nova revisão "Restaurado" no histórico
  - [ ] Contador incrementado

- [ ] **Após Refresh da Página**
  - [ ] Todos os dados permanecem iguais
  - [ ] Histórico completo preservado
  - [ ] Última restauração ainda visível
  - [ ] Contadores corretos

- [ ] **Sincronização**
  - [ ] Verificar no Supabase se dados foram salvos
  - [ ] Testar em outra aba/navegador
  - [ ] Dados consistentes entre sessões

## 🐛 Cenários de Erro e Edge Cases

### Teste de Robustez

1. **Instalação sem Revisões**
   - [ ] Mensagem apropriada: "Nenhuma revisão registrada"
   - [ ] Ícone de relógio com opacity reduzida
   - [ ] Texto explicativo sobre futuras revisões

2. **Muitas Revisões (20+)**
   - [ ] Scroll funciona corretamente
   - [ ] Performance não degradada
   - [ ] Timeline renderiza sem quebras

3. **Campos com Valores Extremos**
   - [ ] Textos muito longos truncados com ellipsis
   - [ ] Números grandes formatados corretamente
   - [ ] Caracteres especiais exibidos sem erro

4. **Ações Simultâneas**
   - [ ] Abrir múltiplos detalhes rapidamente
   - [ ] Clicar em restaurar durante loading
   - [ ] Fechar modal durante restauração

## 📊 Métricas de Sucesso

### Performance
- [ ] Modal abre em < 300ms
- [ ] Expansão de detalhes em < 100ms
- [ ] Restauração completa em < 2s
- [ ] Scroll suave sem travamentos

### Usabilidade
- [ ] Todos os elementos interativos com feedback visual
- [ ] Mensagens claras e em português
- [ ] Fluxo intuitivo sem manual
- [ ] Acessível via teclado (Tab, Enter, Esc)

### Confiabilidade
- [ ] Zero perda de dados
- [ ] Recuperação elegante de erros
- [ ] Estados de loading apropriados
- [ ] Sincronização consistente

## 🔧 Ferramentas de Teste

### Browser DevTools
- Network tab para verificar requests
- Console para erros JavaScript
- Application tab para verificar storage
- Performance tab para métricas

### Extensões Úteis
- React Developer Tools
- Redux DevTools (se aplicável)
- Lighthouse para auditorias

## 📝 Template de Reporte de Bugs

```markdown
### Bug #[NÚMERO]

**Título:** [Descrição curta do problema]

**Severidade:** Crítico | Alto | Médio | Baixo

**Passos para Reproduzir:**
1. [Passo 1]
2. [Passo 2]
3. [...]

**Comportamento Esperado:**
[O que deveria acontecer]

**Comportamento Atual:**
[O que está acontecendo]

**Screenshots/Vídeos:**
[Anexar evidências]

**Ambiente:**
- Browser: [Chrome 120, Firefox 119, etc]
- OS: [Windows 11, macOS 14, etc]
- Resolução: [1920x1080]

**Logs do Console:**
```
[Colar erros se houver]
```

**Informações Adicionais:**
[Qualquer contexto relevante]
```

## 🎯 Checklist Final

Antes de aprovar o sistema:

- [ ] Todos os testes passaram sem erros críticos
- [ ] Bugs encontrados foram documentados
- [ ] Performance está dentro dos padrões
- [ ] UI/UX consistente com o design system
- [ ] Funcionalidades acessíveis em todos os dispositivos
- [ ] Dados persistem corretamente
- [ ] Sem regressões em funcionalidades existentes
- [ ] Código de produção sem console.logs desnecessários

## 🚀 Próximos Passos

1. Executar todos os testes listados
2. Documentar resultados e evidências
3. Reportar bugs encontrados
4. Priorizar correções por severidade
5. Re-testar após correções
6. Aprovar para produção quando todos os critérios forem atendidos

---

**Data do Teste:** ___/___/______  
**Testador:** _________________  
**Versão da Aplicação:** _______  
**Status:** ⬜ Em Progresso | ⬜ Concluído | ⬜ Aprovado