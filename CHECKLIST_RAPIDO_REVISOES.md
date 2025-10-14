# ✅ Checklist Rápido - Teste do Sistema de Revisões

## 🚀 Preparação (5 min)
- [ ] App rodando localmente
- [ ] Projeto com instalações de teste
- [ ] DevTools aberto (F12)

## 📋 Execução dos Testes (15-20 min)

### 1️⃣ Abertura do Histórico (2 min)
- [ ] Abrir instalação → Aba "Informações"
- [ ] Botão "Histórico de Revisões" visível com contador
- [ ] Clicar → Modal abre < 300ms
- [ ] Timeline renderizada corretamente

### 2️⃣ Visualização de Detalhes (3 min)
- [ ] Clicar "Ver Detalhes" em qualquer revisão
- [ ] Expansão suave com VersionDiffView
- [ ] Campos comparados lado a lado (desktop)
- [ ] Campos alterados destacados em amarelo
- [ ] Badge "Alterado" nos campos modificados

### 3️⃣ Teste de Restauração (5 min)
- [ ] Expandir revisão anterior
- [ ] Clicar "Restaurar Esta Versão"
- [ ] Dialog de confirmação aparece
- [ ] Confirmar → Loading "Restaurando..."
- [ ] Toast de sucesso
- [ ] Modal fecha automaticamente
- [ ] Reabrir → Nova revisão "Restaurado" no topo

### 4️⃣ Teste Mobile (3 min)
- [ ] DevTools → Toggle device (Ctrl+Shift+M)
- [ ] Selecionar iPhone ou Android
- [ ] Comparação empilhada verticalmente
- [ ] Todos os elementos acessíveis
- [ ] Scroll funcional

### 5️⃣ Validações Finais (2 min)
- [ ] F5 → Dados persistem
- [ ] Console sem erros
- [ ] Performance adequada
- [ ] UI consistente

## 🐛 Problemas Comuns

| Sintoma | Possível Causa | Ação |
|---------|----------------|------|
| Botão não aparece | Sem revisões | Criar/editar instalação |
| Modal não abre | Erro de loading | Verificar console |
| Restauração falha | Permissões | Verificar auth |
| Layout quebrado | CSS não carregado | Rebuild app |

## 📊 Critérios de Aprovação

**✅ APROVADO se:**
- Todos os itens marcados
- Sem erros no console
- Performance < 2s para operações
- UI responsiva e consistente

**❌ REPROVADO se:**
- Erros críticos encontrados
- Perda de dados
- UI quebrada em mobile
- Loading > 5s

## 🎯 Resultado do Teste

**Data:** ___/___/___  
**Hora:** ___:___  
**Testador:** ________________

**Status Final:**
- [ ] ✅ APROVADO
- [ ] ⚠️ APROVADO COM RESSALVAS
- [ ] ❌ REPROVADO

**Observações:**
_________________________________
_________________________________
_________________________________

---

💡 **Dica:** Use este checklist para testes rápidos de regressão após mudanças no código.