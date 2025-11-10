# Guia de Testes - Fotos em PDF

## ✅ Checklist de Testes Funcionais

### 🎯 Teste 1: Configuração Básica

**Objetivo:** Verificar que o toggle e variantes funcionam corretamente

**Passos:**
1. Abra o modal de personalização de relatório
2. Vá para a aba "Detalhes"
3. Role até "Opções do PDF"
4. Teste o toggle "Incluir Fotos no PDF"

**Verificações:**
- [ ] Toggle inicia no estado configurado (padrão: ON)
- [ ] Ao desativar: variante muda para "Compacta"
- [ ] Ao ativar: variante muda para "Completa"
- [ ] Descrição atualiza conforme estado
- [ ] Estado persiste ao trocar de abas

**Resultado Esperado:**
```
Toggle OFF → Variante = Compacta
Toggle ON → Variante = Completa
```

---

### 🎯 Teste 2: Geração de PDF Compacto (Sem Fotos)

**Objetivo:** Verificar que versão compacta não inclui fotos

**Setup:**
- Projeto com 10 instalações
- 2-3 fotos por instalação
- Total: ~25 fotos

**Passos:**
1. Configure toggle: OFF (ou variante: Compacta)
2. Selecione seção "Pendências"
3. Clique "Gerar PDF"
4. Aguarde geração
5. Abra o PDF baixado

**Verificações:**
- [ ] PDF gerado em < 5 segundos
- [ ] Tamanho do arquivo < 500KB
- [ ] Coluna "Fotos" mostra links ou "—"
- [ ] Nenhuma miniatura renderizada
- [ ] Sem aviso de tamanho

**Resultado Esperado:**
```
Tempo: ~2s
Tamanho: ~200KB
Fotos: Não incluídas
```

---

### 🎯 Teste 3: Geração de PDF Completo (Com Fotos)

**Objetivo:** Verificar que versão completa inclui fotos inline

**Setup:**
- Projeto com 10 instalações
- 2-3 fotos por instalação
- Total: ~25 fotos

**Passos:**
1. Configure toggle: ON (variante: Completa)
2. Selecione seção "Pendências"
3. Clique "Gerar PDF"
4. Observe o progresso
5. Aguarde geração
6. Abra o PDF baixado

**Verificações:**
- [ ] Progresso mostra "Otimizando fotos (X/Y)..."
- [ ] PDF gerado em 5-10 segundos
- [ ] Tamanho do arquivo: 1-3MB
- [ ] Fotos aparecem como miniaturas na tabela
- [ ] Até 3 fotos por linha
- [ ] Fotos extras mostram "+N"
- [ ] Layout não quebrado

**Resultado Esperado:**
```
Tempo: ~5s
Tamanho: ~1.5MB
Fotos: Miniaturas inline (até 3/item)
Progresso: "Otimizando fotos (25/25)... 100%"
```

---

### 🎯 Teste 4: Progresso Detalhado

**Objetivo:** Verificar que indicador de progresso funciona

**Setup:**
- Projeto com 50+ instalações
- Várias fotos por item

**Passos:**
1. Configure variante: Completa
2. Selecione todas as seções
3. Clique "Gerar PDF"
4. Observe a barra de progresso

**Verificações:**
- [ ] Barra aparece abaixo dos botões
- [ ] Percentual atualiza suavemente
- [ ] Mensagens descritivas aparecem:
  - [ ] "Preparando dados do relatório..."
  - [ ] "Otimizando fotos (X/Y)..."
  - [ ] "Configurando cabeçalho..."
- [ ] Progresso não trava
- [ ] Progresso chega a 100%
- [ ] Barra desaparece ao finalizar

**Resultado Esperado:**
```
0% → "Validando dados..."
20% → "Otimizando fotos (10/50)..."
40% → "Otimizando fotos (50/50)..."
45% → "Configurando cabeçalho..."
100% → "PDF gerado com sucesso"
```

---

### 🎯 Teste 5: Limite de Tamanho (>10MB)

**Objetivo:** Verificar aviso quando PDF excede 10MB

**Setup:**
- Projeto grande (100+ instalações)
- Muitas fotos (200+ fotos)
- Variante: Completa

**Passos:**
1. Configure variante: Completa
2. Selecione todas as seções
3. Clique "Gerar PDF"
4. Aguarde geração

**Verificações:**
- [ ] PDF gerado normalmente (não bloqueia)
- [ ] Toast aparece com título "PDF muito grande"
- [ ] Descrição sugere versão compacta
- [ ] Toast permanece por 6 segundos
- [ ] Mensagem de progresso atualizada
- [ ] PDF pode ser baixado normalmente

**Resultado Esperado:**
```
PDF Gerado: Sim (12.5 MB)
Toast: ⚠️ "PDF muito grande"
Mensagem: "Considere usar a versão compacta sem fotos."
Duração: 6 segundos
Bloqueio: Não
```

---

### 🎯 Teste 6: Compressão de Imagens

**Objetivo:** Verificar que fotos são comprimidas corretamente

**Setup:**
- 5 instalações com fotos grandes (>5MB cada)
- Variante: Completa

**Método:**
1. Gere PDF completo
2. Compare tamanho esperado vs real

**Cálculo Esperado:**
```
5 instalações × 3 fotos × 150x150px × 0.72 qualidade
≈ 5 × 3 × 15KB = ~225KB de fotos

PDF total: ~500KB (fotos + estrutura)
```

**Verificações:**
- [ ] Fotos originais grandes não inflam PDF
- [ ] Miniaturas legíveis (150x150px)
- [ ] Qualidade aceitável (72%)
- [ ] Tamanho dentro do esperado

**Resultado Esperado:**
```
Fotos Originais: 5MB cada
Fotos no PDF: ~15KB cada (comprimidas)
PDF Total: ~500KB (não 25MB!)
```

---

### 🎯 Teste 7: Quebras de Página

**Objetivo:** Verificar que fotos não quebram layout

**Setup:**
- Projeto com muitos itens (50+)
- Variante: Completa

**Passos:**
1. Gere PDF completo
2. Navegue página por página
3. Observe quebras de página

**Verificações:**
- [ ] Tabelas não cortadas no meio
- [ ] Fotos não sobrepostas
- [ ] Cabeçalhos em todas as páginas
- [ ] Rodapés em todas as páginas
- [ ] Espaçamento consistente
- [ ] Nenhuma página em branco extra

**Resultado Esperado:**
```
Quebras: Inteligentes (antes de seções/tabelas)
Overflow: Controlado
Layout: Consistente em todas páginas
```

---

### 🎯 Teste 8: Múltiplas Fotos por Item

**Objetivo:** Verificar limite de 3 fotos e indicador "+N"

**Setup:**
- 3 instalações com números variados de fotos:
  - Item 1: 1 foto
  - Item 2: 3 fotos
  - Item 3: 7 fotos

**Passos:**
1. Gere PDF completo
2. Localize os 3 itens no PDF

**Verificações:**
- [ ] Item 1: Mostra 1 foto
- [ ] Item 2: Mostra 3 fotos (todas)
- [ ] Item 3: Mostra 3 fotos + "+4"
- [ ] Layout em grade horizontal
- [ ] Espaçamento entre fotos (~2mm)
- [ ] Fotos alinhadas verticalmente

**Resultado Esperado:**
```
Item 1: [📷]
Item 2: [📷] [📷] [📷]
Item 3: [📷] [📷] [📷] +4
```

---

### 🎯 Teste 9: Erro de Rede (Fotos Indisponíveis)

**Objetivo:** Verificar robustez quando fotos falham

**Setup:**
- Simular falha de rede (Offline ou URLs inválidas)
- Ou deletar fotos do storage

**Passos:**
1. Configure variante: Completa
2. Tente gerar PDF com fotos quebradas
3. Observe comportamento

**Verificações:**
- [ ] PDF gerado mesmo com falhas
- [ ] Progresso não trava
- [ ] Warnings aparecem no console
- [ ] Células de fotos falhas ficam vazias
- [ ] Outras fotos válidas aparecem normalmente
- [ ] Toast de sucesso aparece ao final

**Resultado Esperado:**
```
Fotos válidas: Renderizadas ✓
Fotos falhas: Ignoradas (célula vazia)
PDF: Gerado normalmente ✓
Console: Warnings de fotos específicas
```

---

### 🎯 Teste 10: Performance (Projeto Grande)

**Objetivo:** Verificar performance com volume alto

**Setup:**
- Projeto com 100+ instalações
- 200+ fotos totais
- Variante: Completa

**Passos:**
1. Inicie cronômetro
2. Clique "Gerar PDF"
3. Aguarde conclusão
4. Pare cronômetro

**Verificações:**
- [ ] Tempo < 30 segundos
- [ ] UI não trava (progresso atualiza)
- [ ] Memória não estoura
- [ ] PDF gerado corretamente
- [ ] Todas fotos (até limite) incluídas

**Resultado Esperado:**
```
100 itens × 2 fotos médias = 200 fotos
Tempo: 20-30 segundos
Memória: Estável (<500MB)
PDF: ~8MB
```

---

## 🔍 Testes de Regressão

### Verificar que funcionalidades antigas ainda funcionam:

- [ ] PDF sem fotos funciona (compacto)
- [ ] Excel com fotos funciona
- [ ] Filtros de seção funcionam
- [ ] Agrupamento funciona
- [ ] Ordenação funciona
- [ ] Gráficos aparecem
- [ ] Resumo por pavimento funciona
- [ ] Links no PDF funcionam
- [ ] Configurações persistem (localStorage)
- [ ] Restaurar padrões funciona

---

## 🐛 Casos de Erro

### Teste E1: Item sem Fotos
**Resultado:** Célula vazia ou "—"

### Teste E2: Todas Fotos Falham
**Resultado:** PDF gerado, colunas vazias

### Teste E3: Cancelar Durante Geração
**Resultado:** (Modal fecha, geração pode continuar em background)

### Teste E4: Trocar de Aba Durante Geração
**Resultado:** Progresso preservado, geração continua

### Teste E5: Projeto sem Instalações
**Resultado:** Erro amigável ou PDF vazio

---

## 📊 Métricas de Sucesso

### Performance
- [ ] Geração < 30s para 100 itens
- [ ] Progresso atualiza a cada 100ms
- [ ] UI responsiva durante geração

### Qualidade
- [ ] Fotos legíveis (150x150px)
- [ ] Layout não quebrado
- [ ] Tamanho otimizado (<10MB ideal)

### UX
- [ ] Progresso claro e descritivo
- [ ] Avisos informativos (não bloqueantes)
- [ ] Configuração intuitiva

### Robustez
- [ ] Lida com fotos grandes
- [ ] Lida com fotos indisponíveis
- [ ] Não quebra com erros isolados

---

## 🏁 Aprovação Final

Para aprovar a feature, todos os testes devem passar:

**Funcionalidade:**
- ✅ Toggle funciona
- ✅ Variantes funcionam
- ✅ Fotos aparecem inline
- ✅ Compressão funciona
- ✅ Limite de 3 fotos respeitado

**Performance:**
- ✅ Geração em tempo aceitável
- ✅ Progresso fluido
- ✅ Memória controlada

**Robustez:**
- ✅ Lida com erros
- ✅ Não quebra com volume
- ✅ Avisos apropriados

**UX:**
- ✅ Interface clara
- ✅ Feedback adequado
- ✅ Configuração preservada

---

**Status:** ✅ PRONTO PARA TESTE
**Cobertura:** 10 testes funcionais + 5 casos de erro
**Critério:** Todos os checkboxes devem ser ✓
**Prazo Estimado:** 2-3 horas de testes manuais

---

**Atualizado:** 2025-11-10
**Tester:** [Seu nome]
**Resultado:** [ ] PASSOU | [ ] FALHOU | [ ] PENDENTE
