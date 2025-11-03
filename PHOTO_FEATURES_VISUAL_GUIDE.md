# 📸 Guia Visual: Gestão Avançada de Fotos

## 🎨 Interface do Usuário

### 1. Galeria Principal

```
┌─────────────────────────────────────────────────────────────┐
│ Fotos (12)                    [Baixar Todas] [Adicionar]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐    │
│  │ 📄  │  │     │  │     │  │     │  │     │  │     │    │
│  │  ❌ │  │  ❌  │  │  ❌  │  │  ❌  │  │  ❌  │  │  ❌  │    │
│  │     │  │     │  │     │  │     │  │     │  │     │    │
│  │[img]│  │[img]│  │[img]│  │[img]│  │[img]│  │[img]│    │
│  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘    │
│  1.2 MB    850 KB   2.1 MB   750 KB   1.5 MB   900 KB     │
│                                                              │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐    │
│  │     │  │     │  │     │  │     │  │     │  │  +  │    │
│  │[img]│  │[img]│  │[img]│  │[img]│  │[img]│  │     │    │
│  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Legenda:
📄 = Foto tem legenda
❌ = Botão de exclusão (visível ao hover)
+ = Adicionar mais fotos
```

### 2. Preview de Upload

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️  Preview das Fotos (5)      [Cancelar Todas] [Confirmar] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │    ❌   │  │    ❌   │  │    ❌   │  │    ❌   │       │
│  │         │  │         │  │         │  │         │       │
│  │ [IMAGE] │  │ [IMAGE] │  │ [IMAGE] │  │ [IMAGE] │       │
│  │         │  │         │  │         │  │         │       │
│  │ 2.5 MB  │  │ 1.8 MB  │  │ 3.2 MB  │  │ 950 KB  │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│  foto1.jpg   foto2.jpg   foto3.jpg   foto4.jpg            │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Estados:
- Border azul = área de preview
- Botão X em cada foto
- Tamanho visível
- Nome do arquivo
```

### 3. Modal de Legenda

```
┌─────────────────────────────────────────┐
│  Legenda da Foto                    ✕  │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐ │
│  │                                   │ │
│  │         [PREVIEW DA FOTO]         │ │
│  │                                   │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Legenda:                               │
│  ┌───────────────────────────────────┐ │
│  │ Digite uma legenda descritiva...  │ │
│  │                                   │ │
│  │                                   │ │
│  └───────────────────────────────────┘ │
│                                         │
│          [Cancelar]  [Salvar Legenda]  │
└─────────────────────────────────────────┘
```

### 4. Dialog de Confirmação de Exclusão

```
┌─────────────────────────────────────────┐
│  ⚠️  Confirmar Exclusão                 │
├─────────────────────────────────────────┤
│                                         │
│  Tem certeza que deseja excluir esta   │
│  foto? Esta ação não pode ser          │
│  desfeita.                              │
│                                         │
│                                         │
│              [Cancelar]  [Excluir]     │
└─────────────────────────────────────────┘
```

### 5. Overlay de Compressão

```
┌─────────────────────────────────────────┐
│                                         │
│         ⟳ Comprimindo imagens...       │
│                                         │
│              3 de 5 imagens             │
│                                         │
│          Por favor, aguarde             │
│                                         │
└─────────────────────────────────────────┘
```

### 6. Overlay de Upload

```
┌─────────────────────────────────────────┐
│                                         │
│         ⟳ Enviando imagens...          │
│                                         │
│          Por favor, aguarde             │
│                                         │
└─────────────────────────────────────────┘
```

### 7. Download em Lote - Progresso

```
┌─────────────────────────────────────────┐
│  Baixar Todas                       ✕  │
├─────────────────────────────────────────┤
│                                         │
│  📦 Resumo do Download                  │
│                                         │
│  Total de imagens:               12    │
│  📁 peca_001:                     8     │
│  📁 peca_002:                     4     │
│                                         │
│  Processando...                    75%  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░       │
│                                         │
│          [Cancelar]  [Baixar ZIP]      │
│                                         │
│  As imagens serão organizadas em       │
│  pastas por contexto dentro do ZIP.    │
└─────────────────────────────────────────┘
```

---

## 🎯 Interações do Usuário

### Hover States

#### Sobre uma Foto
```
Normal:                    Hover:
┌─────┐                   ┌─────┐
│     │                   │ 📄❌ │  ← Botões aparecem
│     │         →         │     │
│[img]│                   │[img]│
└─────┘                   └─────┘
```

#### Botão Adicionar
```
Normal:                    Hover:
┌─────┐                   ┌─────┐
│  +  │                   │  +  │  ← Border azul
│     │         →         │     │
│     │                   │     │
└─────┘                   └─────┘
```

### Click Actions

```
Foto Individual:
├── Click na imagem → Abre modal visualização
├── Click no 📄     → Abre modal de legenda
└── Click no ❌     → Abre dialog de confirmação

Barra Superior:
├── Click "Baixar Todas"   → Inicia download ZIP
└── Click "Adicionar Fotos" → Abre seletor de arquivos

Preview de Upload:
├── Click "Cancelar Todas" → Limpa todos previews
├── Click "Confirmar"      → Inicia processo upload
└── Click ❌ em preview    → Remove aquela foto
```

---

## 🎨 Cores e Estilos

### Badges
```css
/* Tamanho de arquivo */
.size-badge {
  background: secondary;
  position: bottom-left;
  color: foreground;
}

/* Indicador de legenda */
.caption-badge {
  background: secondary;
  position: bottom-left;
  icon: FileText;
}
```

### Botões
```css
/* Exclusão */
.delete-button {
  variant: destructive;
  position: top-right;
  transition: opacity;
}

/* Legenda */
.caption-button {
  variant: secondary;
  position: top-left;
  transition: opacity;
}
```

### Estados
```css
/* Loading */
.skeleton {
  animation: pulse;
  background: muted;
}

/* Preview area */
.preview-area {
  border: 2px solid primary;
  background: primary/5;
  border-radius: md;
}
```

---

## 📱 Responsividade

### Desktop (> 1024px)
```
Grid: 6 colunas
Tamanho: 180x180px
Espaçamento: 16px
Modal: max-width 4xl
```

### Tablet (768px - 1024px)
```
Grid: 4 colunas
Tamanho: 160x160px
Espaçamento: 12px
Modal: max-width 2xl
```

### Mobile (< 768px)
```
Grid: 3 colunas (mantido)
Tamanho: auto
Espaçamento: 8px
Modal: full-width
Botões: stack vertical
```

---

## ⚡ Animações

### Transições
```typescript
// Botões de ação
opacity: {
  from: 0,
  to: 1,
  duration: 200ms
}

// Modals
scale: {
  from: 0.95,
  to: 1,
  duration: 200ms
}

// Progress bar
width: {
  duration: 300ms,
  easing: ease-in-out
}
```

### Loading States
```typescript
// Spinner
rotation: {
  from: 0deg,
  to: 360deg,
  duration: 1000ms,
  repeat: infinite
}

// Skeleton
opacity: {
  from: 1,
  to: 0.5,
  duration: 1000ms,
  repeat: infinite,
  alternate: true
}
```

---

## 🔔 Toasts e Feedback

### Tipos de Toast

#### Sucesso
```
✅ Foto excluída
A foto foi removida com sucesso
[2 segundos]
```

```
✅ Legenda salva
A legenda foi atualizada com sucesso
[2 segundos]
```

```
✅ 5 fotos sincronizadas
Peça 001: fotos adicionadas ao álbum do projeto
[3 segundos]
```

```
✅ Sucesso
Download concluído! 12 imagens baixadas.
[3 segundos]
```

#### Erro
```
❌ Formato não suportado
Use JPG, PNG ou WEBP
[5 segundos]
```

```
❌ Arquivo muito grande
Máximo 10MB por imagem
[5 segundos]
```

```
❌ Erro
Erro ao criar arquivo ZIP. Tente novamente.
[5 segundos]
```

#### Info
```
ℹ️ Comprimindo imagens
Otimizando 5 imagens...
[Até concluir]
```

```
⚠️ Atenção: Sincronização pendente
Foto salva na peça, mas não sincronizada com o álbum
[5 segundos]
```

---

## 🎬 Fluxos Animados

### Upload com Compressão
```
1. Selecionar fotos
   ↓ [fade in]
2. Previews aparecem
   ↓ [scale in]
3. Confirmar upload
   ↓ [overlay fade in]
4. "Comprimindo..." (se necessário)
   ↓ [spinner rotate]
5. "Enviando..."
   ↓ [progress bar]
6. Fotos na galeria
   ↓ [fade in]
7. Toast de sucesso
   ↓ [slide in from top]
```

### Adicionar Legenda
```
1. Hover sobre foto
   ↓ [buttons fade in]
2. Click botão legenda
   ↓ [modal scale in]
3. Digitar texto
   ↓ [textarea focus]
4. Salvar
   ↓ [modal fade out]
5. Badge aparece
   ↓ [badge fade in]
6. Toast sucesso
   ↓ [slide in from top]
```

### Download ZIP
```
1. Click "Baixar Todas"
   ↓ [modal scale in]
2. Resumo exibido
   ↓ [fade in]
3. Confirmar download
   ↓ [progress bar animating]
4. "Processando... X%"
   ↓ [number increments]
5. Download automático
   ↓ [modal fade out]
6. Toast sucesso
   ↓ [slide in from top]
```

---

## 🎯 Acessibilidade

### Keyboard Navigation
```
Tab       → Navega entre controles
Enter     → Ativa botão/confirma
Escape    → Fecha modal
Space     → Ativa botão
Arrow keys → Navega grid (futuro)
```

### Screen Readers
```html
<!-- Botões com aria-label -->
<Button aria-label="Excluir foto">
  <X />
</Button>

<Button aria-label="Adicionar legenda">
  <FileText />
</Button>

<!-- Estados -->
<div aria-busy="true">Enviando...</div>
<div role="progressbar" aria-valuenow="75">
```

### Contraste
```
✅ Botões: 4.5:1
✅ Texto: 4.5:1
✅ Ícones: 3:1
✅ Estados focus: visible outline
```

---

## 📊 Visual Examples

### Estado Vazio
```
┌─────────────────────────────────────────┐
│ Fotos (0)          [Baixar] [Adicionar]│
├─────────────────────────────────────────┤
│                                         │
│              ╔═══════════╗              │
│              ║           ║              │
│              ║   🖼️     ║              │
│              ║           ║              │
│              ╚═══════════╝              │
│                                         │
│         Nenhuma foto adicionada         │
│                                         │
└─────────────────────────────────────────┘
```

### Loading
```
┌─────────────────────────────────────────┐
│ Fotos (?)          [Baixar] [Adicionar]│
├─────────────────────────────────────────┤
│                                         │
│  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓   │
│  ░░░░  ░░░░  ░░░░  ░░░░  ░░░░  ░░░░   │
│                                         │
│  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓   │
│  ░░░░  ░░░░  ░░░░  ░░░░  ░░░░  ░░░░   │
│                                         │
└─────────────────────────────────────────┘
```

### Com Fotos
```
┌─────────────────────────────────────────┐
│ Fotos (8)      🔽 75%   [↓] [📷]        │
├─────────────────────────────────────────┤
│                                         │
│  🖼️📄  🖼️    🖼️📄  🖼️    🖼️    🖼️   │
│  1.2MB  850KB  2.1MB  750KB  1.5MB  900KB│
│                                         │
│  🖼️📄  🖼️    [+]                        │
│  1.1MB  800KB                           │
│                                         │
└─────────────────────────────────────────┘

Legenda visual:
🖼️ = Foto
📄 = Tem legenda
[↓] = Baixar todas
[📷] = Adicionar
[+] = Adicionar mais
```

---

## 🎨 Temas (Dark/Light)

### Light Mode
```css
Background: white
Border: gray-200
Text: gray-900
Muted: gray-100
Primary: blue-600
Destructive: red-600
```

### Dark Mode
```css
Background: gray-950
Border: gray-800
Text: gray-50
Muted: gray-900
Primary: blue-500
Destructive: red-500
```

---

Este guia visual fornece uma referência completa para entender a interface e interações do sistema de gestão avançada de fotos. Use como referência para implementações futuras ou melhorias de UX.
