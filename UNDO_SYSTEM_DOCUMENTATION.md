# Sistema de Undo - Documentação e Testes

## 📋 Visão Geral

O sistema de Undo permite que usuários desfaçam ações críticas no sistema, como criar, editar ou deletar projetos e instalações. Utiliza SessionStorage para persistência durante a sessão.

## 🧪 Como Testar

### Acesso à Página de Testes
1. Acesse a página `/debug` (apenas em modo de desenvolvimento)
2. Role até a seção "Sistema de Undo - Testes"

### Testes Disponíveis

#### 1. **Criar Projeto**
- **Ação**: Cria um projeto de teste
- **Validação**: 
  - ✅ Toast aparece com botão "Desfazer"
  - ✅ Projeto é adicionado ao banco de dados
  - ✅ Ação aparece no histórico
  - ✅ Clicar em "Desfazer" remove o projeto

#### 2. **Editar Projeto**
- **Ação**: Edita o nome do primeiro projeto encontrado
- **Validação**:
  - ✅ Toast aparece com botão "Desfazer"
  - ✅ Nome do projeto é atualizado
  - ✅ Desfazer restaura o nome anterior

#### 3. **Deletar Projeto**
- **Ação**: Cria e depois deleta um projeto
- **Validação**:
  - ✅ Toast aparece com botão "Desfazer"
  - ✅ Projeto é removido do banco
  - ✅ Desfazer restaura o projeto deletado

#### 4. **Criar Instalação**
- **Ação**: Cria uma instalação de teste
- **Validação**:
  - ✅ Toast aparece com botão "Desfazer"
  - ✅ Instalação é criada
  - ✅ Desfazer remove a instalação

#### 5. **Operação em Lote (3 itens)**
- **Ação**: Cria 3 instalações simultaneamente
- **Validação**:
  - ✅ Toast aparece com botão "Desfazer"
  - ✅ Todas as 3 instalações são criadas
  - ✅ Desfazer remove todas as 3 instalações de uma vez

#### 6. **Criar 15 Ações (Testar Limite)**
- **Ação**: Cria 15 ações fictícias para testar o limite de 10
- **Validação**:
  - ✅ Apenas as últimas 10 ações ficam no histórico
  - ✅ As 5 primeiras ações são descartadas (FIFO)

## ✅ Checklist de Testes Manuais

### Funcionalidades Básicas
- [ ] **Criar projeto** → Toast aparece → Desfazer → Projeto removido
- [ ] **Editar projeto** → Desfazer → Volta ao estado anterior
- [ ] **Deletar projeto** → Desfazer → Projeto restaurado
- [ ] **Criar instalação** → Desfazer → Instalação removida
- [ ] **Editar instalação** → Desfazer → Volta ao estado anterior
- [ ] **Deletar instalação** → Desfazer → Instalação restaurada
- [ ] **Marcar como instalado** → Desfazer → Volta a pendente

### Operações Avançadas
- [ ] **Operação em lote (3 itens)** → Desfazer → Todos restaurados
- [ ] **Fazer 15 ações** → Apenas últimas 10 no histórico
- [ ] **Múltiplos undos seguidos** → Cada ação é desfeita corretamente

### Atalhos e UI
- [ ] **Ctrl+Z desfaz última ação** (Windows/Linux)
- [ ] **Cmd+Z desfaz última ação** (Mac)
- [ ] **Toast desaparece após 10 segundos**
- [ ] **Clicar em "Desfazer" no toast funciona**
- [ ] **Tentar desfazer sem ações** → Nada acontece / Mensagem informativa

### Persistência
- [ ] **Recarregar página** → Histórico persiste (SessionStorage)
- [ ] **Fechar e reabrir aba** → Histórico é limpo (comportamento esperado)
- [ ] **Abrir em outra aba** → Históricos são independentes

### Edge Cases
- [ ] **Undo após deletar item que não existe mais** → Erro tratado graciosamente
- [ ] **Undo após rede ficar offline** → Erro é capturado e exibido
- [ ] **Undo de operação em lote com 50+ itens** → Funciona corretamente
- [ ] **Ctrl+Z em input de texto** → Não interfere no undo do navegador
- [ ] **Ctrl+Z em textarea** → Não interfere no undo do navegador

## 🚫 Limitações Conhecidas

### ❌ Limitações Críticas
1. **Undo não funciona após fechar a aba**
   - **Motivo**: SessionStorage é limpo ao fechar a aba
   - **Solução alternativa**: Use durante a mesma sessão

2. **Undo não funciona entre dispositivos**
   - **Motivo**: SessionStorage é local ao navegador
   - **Solução alternativa**: Não há (por design)

### ⚠️ Limitações de Design
3. **Máximo de 10 ações no histórico**
   - **Motivo**: Evitar consumo excessivo de memória
   - **Comportamento**: FIFO (First In, First Out) - as mais antigas são removidas

4. **Funções undo() não são persistidas**
   - **Motivo**: Funções JavaScript não podem ser serializadas para JSON
   - **Solução**: Funções são reconstruídas ao carregar usando os tipos de ação

5. **Reconstrução de funções ao recarregar**
   - **Motivo**: As funções undo precisam ser re-registradas
   - **Comportamento**: Automático através do hook `useRegisterUndoFunctions`

### ✅ Funcionalidades Garantidas
6. **Toast desaparece após 10 segundos**
   - Configurado em `src/lib/toast.ts`

7. **Ctrl+Z funciona globalmente**
   - Exceto em inputs de texto e áreas editáveis (comportamento esperado)

## 🏗️ Arquitetura

### Componentes Principais

1. **`src/lib/undo.ts`**
   - Classe `UndoManager` (singleton)
   - Gerencia histórico e persistência
   - Limita a 10 ações

2. **`src/hooks/useUndo.ts`**
   - Hook React para gerenciar undo
   - Interface: `addAction`, `undo`, `canUndo`, `clearHistory`, `history`

3. **`src/hooks/useUndoShortcut.ts`**
   - Adiciona suporte a Ctrl+Z / Cmd+Z
   - Evita interferir em inputs editáveis

4. **`src/lib/toast.ts`**
   - Função `showUndoToast` para toast com botão desfazer
   - Duração de 10 segundos

### Fluxo de Dados

```
┌─────────────────┐
│  Ação do User   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   addAction()   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  UndoManager    │
│  - Adiciona     │
│  - Limita a 10  │
│  - Salva SS     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SessionStorage  │
└─────────────────┘

Ao desfazer:
┌─────────────────┐
│   undo()        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Executa função  │
│ undo da ação    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Remove do       │
│ histórico       │
└─────────────────┘
```

## 📊 Tipos de Ação Suportados

```typescript
type ActionType = 
  | 'CREATE_PROJECT'
  | 'UPDATE_PROJECT'
  | 'DELETE_PROJECT'
  | 'CREATE_INSTALLATION'
  | 'UPDATE_INSTALLATION'
  | 'DELETE_INSTALLATION'
  | 'BULK_UPDATE'
  | 'BULK_DELETE';
```

## 🔧 Como Adicionar Nova Ação com Undo

### Exemplo: Adicionar undo para criar projeto

```typescript
import { useUndo } from '@/hooks/useUndo';
import { showUndoToast } from '@/lib/toast';

function MyComponent() {
  const { addAction, undo } = useUndo();

  const handleCreateProject = async (projectData) => {
    // 1. Executa a ação
    const { data } = await supabase
      .from('projects')
      .insert([projectData])
      .select()
      .single();

    // 2. Adiciona ao histórico de undo
    addAction({
      type: 'CREATE_PROJECT',
      description: `Criou projeto ${data.name}`,
      data: { projectId: data.id },
      undo: async () => {
        // Função que desfaz a ação
        await supabase.from('projects').delete().eq('id', data.id);
        toast.success('Projeto removido');
      },
    });

    // 3. Mostra toast com botão desfazer
    showUndoToast(`Projeto criado: ${data.name}`, async () => {
      await undo();
    });
  };

  return (
    <button onClick={handleCreateProject}>
      Criar Projeto
    </button>
  );
}
```

## 🐛 Debugging

### Verificar Histórico no Console

```javascript
// No console do navegador:
const history = JSON.parse(sessionStorage.getItem('undo-history'));
console.log('Histórico de Undo:', history);
```

### Limpar Histórico Manualmente

```javascript
// No console do navegador:
sessionStorage.removeItem('undo-history');
```

### Verificar Tamanho do SessionStorage

```javascript
// No console do navegador:
let total = 0;
for (let key in sessionStorage) {
  if (sessionStorage.hasOwnProperty(key)) {
    total += sessionStorage[key].length + key.length;
  }
}
console.log('SessionStorage usado:', Math.round(total / 1024) + ' KB');
```

## 📝 Notas de Implementação

1. **SessionStorage vs LocalStorage**
   - Escolhemos SessionStorage para limitar o escopo à sessão
   - LocalStorage persistiria entre sessões, o que poderia causar confusão

2. **Limite de 10 Ações**
   - Testado e considerado suficiente para casos de uso típicos
   - Evita consumo excessivo de memória

3. **Serialização de Funções**
   - Funções não podem ser serializadas
   - Solução: registrar funções undo por tipo de ação
   - Ao carregar, reconstruir funções com base no tipo

4. **Toast Duration**
   - 10 segundos é tempo suficiente para o usuário reagir
   - Balanceamento entre UX e não poluir a tela

## 🎯 Próximos Passos

- [ ] Adicionar telemetria para rastrear uso do undo
- [ ] Considerar redo (refazer ações desfeitas)
- [ ] Adicionar histórico visual mais detalhado
- [ ] Permitir configurar limite de histórico
- [ ] Adicionar testes automatizados (Jest/Playwright)

## 📞 Suporte

Para bugs ou sugestões relacionadas ao sistema de undo:
1. Acesse a página `/debug`
2. Teste o comportamento
3. Verifique os logs do console
4. Reporte com detalhes da ação e erro
