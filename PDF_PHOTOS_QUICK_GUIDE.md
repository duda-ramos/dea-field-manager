# Guia Rápido - Fotos em PDF

## 🎯 Como Usar

### 1. Abrir Modal de Relatório
```
Dashboard → Projetos → [Selecionar Projeto] → Botão "Gerar Relatório"
```

### 2. Configurar Fotos no PDF

#### Aba "Detalhes" → Seção "Opções do PDF"

**Opção 1: Toggle Simples**
```
[✓] Incluir Fotos no PDF
```
- ✅ ON = Versão Completa (com fotos)
- ❌ OFF = Versão Compacta (sem fotos)

**Opção 2: Seleção de Variante**
```
◉ Compacta
  - Ideal para envio rápido
  - Fotos desativadas automaticamente
  - ~100KB-1MB

○ Completa
  - Inclui miniaturas (150x150px)
  - Até 3 fotos por item
  - ~2-10MB
```

### 3. Gerar PDF

1. Clique em **"Gerar PDF"**
2. Aguarde o progresso:
   ```
   Otimizando fotos (15/45)... [████████░░░░] 67%
   ```
3. Se PDF > 10MB, aparece aviso:
   ```
   ⚠️ PDF muito grande
   O arquivo ultrapassou 10MB.
   Considere usar a versão compacta.
   ```

---

## 📊 Comparação de Tamanhos

| Projeto | Itens | Fotos | Compacta | Completa |
|---------|-------|-------|----------|----------|
| Pequeno | 10 | 20 | 150 KB | 800 KB |
| Médio | 50 | 100 | 400 KB | 3.5 MB |
| Grande | 100 | 200 | 800 KB | 7.2 MB |
| Enorme | 200 | 400 | 1.5 MB | 14 MB ⚠️ |

---

## 🎨 Visualização das Fotos no PDF

### Exemplo 1: Item com 2 Fotos
```
┌───────────────────────────────────────┐
│ Código: A101                          │
│ Descrição: Ponto de Energia           │
│ Status: Pendente                      │
│ Fotos: [📷] [📷]                      │
└───────────────────────────────────────┘
```

### Exemplo 2: Item com 5 Fotos (mostra 3)
```
┌───────────────────────────────────────┐
│ Código: B202                          │
│ Descrição: Tomada 20A                 │
│ Status: Concluído                     │
│ Fotos: [📷] [📷] [📷] +2              │
└───────────────────────────────────────┘
```

### Exemplo 3: Item sem Fotos
```
┌───────────────────────────────────────┐
│ Código: C303                          │
│ Descrição: Interruptor Simples        │
│ Status: Em Revisão                    │
│ Fotos: —                              │
└───────────────────────────────────────┘
```

---

## ⚡ Performance

### Tempo de Geração (estimado)

| Itens com Fotos | Tempo (Compacta) | Tempo (Completa) |
|-----------------|------------------|------------------|
| 10 | 1-2s | 3-5s |
| 50 | 3-5s | 10-15s |
| 100 | 5-8s | 20-30s |

### Dicas de Otimização

1. **Use Compacta para envios rápidos**
   - Email
   - Pré-visualizações
   - Impressão simples

2. **Use Completa para documentação**
   - Aprovações
   - Arquivamento
   - Auditoria

3. **Filtre seções desnecessárias**
   - Desmarque seções que não precisa
   - Reduz processamento e tamanho

4. **Para projetos gigantes (>200 itens)**
   - Use Excel em vez de PDF para fotos
   - Ou gere PDFs por seção separadamente

---

## 🐛 Troubleshooting

### Problema: Fotos não aparecem no PDF

**Solução:**
1. Verifique se toggle está ativado:
   ```
   [✓] Incluir Fotos no PDF
   ```
2. Confirme variante "Completa" selecionada
3. Verifique na aba "Detalhes":
   ```
   [✓] Fotos das Instalações
   ```

### Problema: PDF muito lento para gerar

**Solução:**
1. Use versão Compacta
2. Reduza número de seções
3. Filtre itens antes de gerar
4. Considere dividir em múltiplos relatórios

### Problema: PDF acima de 10MB

**Solução 1: Compacta**
```
◉ Compacta → Gerar PDF
```

**Solução 2: Filtrar Seções**
```
Desmarque seções com muitos itens:
[ ] Concluídas (se já arquivadas)
[ ] Em Andamento (se não necessárias)
```

**Solução 3: Excel para Fotos**
```
Use "Gerar Excel" → Aba "Fotos" separada
```

### Problema: Progresso trava em X%

**Possíveis Causas:**
- Rede lenta (download de fotos)
- Muitas fotos para processar
- Memória insuficiente

**Solução:**
1. Aguarde (pode demorar até 30s)
2. Se travar >1min, recarregue página
3. Tente versão Compacta
4. Verifique conexão de internet

---

## 💡 Casos de Uso

### Caso 1: Relatório para Cliente (Aprovação)
```
✓ Incluir Fotos no PDF: ON
✓ Variante: Completa
✓ Seções: Pendências + Em Revisão
✓ Detalhes: Observações + Fotos
```

### Caso 2: Relatório para Fornecedor (Instalação)
```
✓ Incluir Fotos no PDF: ON
✓ Variante: Completa
✓ Interlocutor: Fornecedor
✓ Seções: Em Andamento
✓ Detalhes: Comentários do Fornecedor + Fotos
```

### Caso 3: Relatório Rápido (Email)
```
✓ Incluir Fotos no PDF: OFF
✓ Variante: Compacta
✓ Seções: Resumo rápido
✓ Tamanho: ~200KB
```

### Caso 4: Relatório Completo (Arquivamento)
```
✓ Incluir Fotos no PDF: ON
✓ Variante: Completa
✓ Seções: Todas
✓ Detalhes: Todos
✓ Incluir: Gráfico + Resumo por Pavimento
```

---

## 🔍 FAQ

**P: Por que limite de 3 fotos por item?**
R: Equilíbrio entre informação e tamanho. 3 fotos geralmente são suficientes para contexto visual.

**P: Posso aumentar a qualidade das fotos?**
R: Sim, mas aumentará o tamanho. Edite `fetchCompressedImageDataUrl` em `reports-new.ts`.

**P: Por que 150x150px?**
R: Tamanho ideal para miniaturas: legíveis mas compactas.

**P: Fotos originais ficam no Excel?**
R: Sim! Excel tem aba "Fotos" com imagens full-size.

**P: Posso desativar fotos para alguns itens?**
R: Não diretamente. Use filtros ou gere relatórios separados.

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique console do navegador (F12)
2. Tire screenshot da configuração
3. Note o tamanho do projeto (itens/fotos)
4. Reporte com detalhes

---

**Atualizado:** 2025-11-10
