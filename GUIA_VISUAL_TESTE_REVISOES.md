# 🎨 Guia Visual - Sistema de Revisões

## 📸 Screenshots de Referência

### 1. Botão de Histórico de Revisões
**Localização:** Aba "Informações" do modal de instalação

```
┌─────────────────────────────────────────┐
│ 🏢 Instalação - EXT-001                 │
├─────────────────────────────────────────┤
│ [Informações] [Galeria] [Links]         │
├─────────────────────────────────────────┤
│                                         │
│ Tipologia: Extintor                     │
│ Código: EXT-001                         │
│ ...                                     │
│                                         │
│ ┌─────────────────────────────────┐     │
│ │ 🕐 Histórico de Revisões (5)   │     │
│ └─────────────────────────────────┘     │
│                                         │
└─────────────────────────────────────────┘
```

### 2. Modal de Histórico - Timeline
**Visual esperado após clicar no botão**

```
┌─────────────────────────────────────────────────┐
│ Histórico de Revisões - EXT-001            [X] │
│ Extintor de incêndio ABC 6kg                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  │  ┌─────────────────────────────────────┐    │
│  ●──│ Revisão 5 [Restaurado]             │    │
│  │  │ 🕐 14/10/2024 às 15:30            │    │
│  │  │ Restauração para versão anterior   │    │
│  │  │                                     │    │
│  │  │ Tip: Extintor | Qtd: 2 | Pav: 1º  │    │
│  │  │ [👁️ Ver Detalhes]                  │    │
│  │  └─────────────────────────────────────┘    │
│  │                                              │
│  │  ┌─────────────────────────────────────┐    │
│  ●──│ Revisão 4 [Problema de Instalação] │    │
│  │  │ 🕐 13/10/2024 às 14:15            │    │
│  │  │ Altura incorreta detectada         │    │
│  │  │ ...                                │    │
│  │  └─────────────────────────────────────┘    │
│  │                                              │
└─────────────────────────────────────────────────┘
```

### 3. Detalhes Expandidos - Comparação
**Ao clicar em "Ver Detalhes"**

```
┌───────────────────────────────────────────────┐
│ 🔄 Comparação de Versões                      │
│ Campos com alterações destacados              │
├───────────────────────────────────────────────┤
│                                               │
│ Quantidade                        [Alterado]  │
│ ┌─────────────┐     ┌─────────────┐          │
│ │ Versão Ant. │     │ Esta Versão │          │
│ │     1       │     │      2      │          │
│ └─────────────┘     └─────────────┘          │
│                                               │
│ Pavimento                                     │
│ ┌─────────────┐     ┌─────────────┐          │
│ │   Térreo    │     │   Térreo    │          │
│ └─────────────┘     └─────────────┘          │
│                                               │
│ Status                            [Alterado]  │
│ ┌─────────────┐     ┌─────────────┐          │
│ │  Pendente   │     │  Instalado  │          │
│ └─────────────┘     └─────────────┘          │
│                                               │
│ 2 campo(s) alterado(s)                        │
│                                               │
│ [Restaurar Esta Versão]                       │
└───────────────────────────────────────────────┘
```

### 4. Dialog de Confirmação de Restauração
**Ao clicar em "Restaurar Esta Versão"**

```
┌─────────────────────────────────────────┐
│         Restaurar Versão?               │
├─────────────────────────────────────────┤
│                                         │
│ Os dados da instalação voltarão para   │
│ esta versão. Uma nova revisão será     │
│ criada no histórico.                   │
│                                         │
│   [Cancelar]    [Restaurar]            │
└─────────────────────────────────────────┘
```

## 🎨 Códigos de Cores dos Badges

### Tipos de Revisão e Suas Cores

| Tipo | Badge | Cor de Fundo | Cor do Texto | Borda |
|------|-------|--------------|--------------|--------|
| Criado | 🟢 | Verde claro (green-100) | Verde escuro (green-800) | Verde (green-300) |
| Editado | 🟡 | Amarelo claro (yellow-100) | Amarelo escuro (yellow-800) | Amarelo (yellow-300) |
| Restaurado | 🟣 | Roxo claro (purple-100) | Roxo escuro (purple-800) | Roxo (purple-300) |
| Problema de Instalação | 🔴 | Vermelho claro (red-100) | Vermelho escuro (red-800) | Vermelho (red-300) |
| Revisão de Conteúdo | 🔵 | Azul claro (blue-100) | Azul escuro (blue-800) | Azul (blue-300) |
| Desaprovado pelo Cliente | 🟠 | Laranja claro (orange-100) | Laranja escuro (orange-800) | Laranja (orange-300) |
| Outros | ⚪ | Cinza claro (gray-100) | Cinza escuro (gray-800) | Cinza (gray-300) |

## 📱 Layouts Responsivos

### Desktop (≥1024px)
- Modal com largura máxima de 896px
- Comparação lado a lado em 2 colunas
- Timeline completa visível
- Hover effects nos cards

### Tablet (768-1023px)
- Modal ocupa 90% da largura
- Pode manter 2 colunas ou empilhar
- Botões maiores para toque

### Mobile (<768px)
- Modal quase fullscreen
- Comparação empilhada verticalmente
- Botões full-width quando apropriado
- Labels acima dos valores

## ✅ Checklist Visual Rápido

### Elementos Obrigatórios em Cada Tela

**Modal Principal:**
- [ ] Título com código da instalação
- [ ] Subtítulo com descrição
- [ ] Botão X para fechar
- [ ] Área scrollable

**Timeline:**
- [ ] Linha vertical conectando revisões
- [ ] Dots (pontos) em cada revisão
- [ ] Cards com sombra
- [ ] Ordem cronológica reversa

**Card de Revisão:**
- [ ] Número da revisão
- [ ] Badge colorido do tipo
- [ ] Data/hora formatada
- [ ] Preview com 3 campos principais
- [ ] Botão "Ver Detalhes"

**Comparação:**
- [ ] Badge "Alterado" nos campos modificados
- [ ] Destaque amarelo nos campos alterados
- [ ] Contador de alterações
- [ ] Botão de restauração

## 🔍 Pontos de Atenção Visual

1. **Consistência de Espaçamento**
   - Padding uniforme em todos os cards
   - Margens consistentes entre elementos
   - Espaçamento adequado entre seções

2. **Hierarquia Visual**
   - Títulos maiores e em negrito
   - Labels em texto secundário
   - Valores em destaque

3. **Feedback Visual**
   - Hover states em todos os botões
   - Loading states durante operações
   - Transições suaves

4. **Acessibilidade**
   - Contraste adequado de cores
   - Tamanho mínimo de 44px para áreas clicáveis (mobile)
   - Focus states visíveis

## 🎯 Estados Especiais

### Sem Revisões
```
┌─────────────────────────────────────┐
│        🕐                           │
│   Nenhuma revisão registrada        │
│                                     │
│ As revisões desta instalação        │
│ aparecerão aqui quando forem        │
│ criadas.                            │
└─────────────────────────────────────┘
```

### Durante Restauração
```
┌─────────────────────────────────────┐
│  [Restaurando...]  (botão disabled) │
└─────────────────────────────────────┘
```

### Primeira Versão
```
┌─────────────────────────────────────┐
│ 🟢 Primeira Versão                  │
│ Esta é a versão inicial             │
├─────────────────────────────────────┤
│ (Mostra apenas "Esta Versão")       │
└─────────────────────────────────────┘
```