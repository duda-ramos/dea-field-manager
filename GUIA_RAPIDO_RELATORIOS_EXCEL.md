# 🚀 Guia Rápido - Relatórios Excel Avançados

## 📋 Como Usar em 5 Passos

### 1️⃣ Abrir Modal de Relatórios
```
Projeto → Botão "Gerar Relatório"
```

### 2️⃣ Escolher Destinatário
- **Cliente:** Relatório de aprovação
- **Fornecedor:** Relatório técnico com instruções

### 3️⃣ Configurar (3 Abas)

#### 📑 Aba "Seções"
```
✓ Pendências
✓ Concluídas
✓ Em Revisão
✓ Em Andamento

Organização:
- Agrupar por: Pavimento / Tipologia / Nenhum
- Ordenar por: Código / Pavimento / Tipologia / Data
```

#### 🔍 Aba "Detalhes"
```
Informações Incluídas:
✓ Fotos das Instalações
✓ Incluir Miniaturas (100x100px) ← NOVO!
✓ Observações
✓ Comentários do Fornecedor
✓ Datas de Criação/Atualização
✓ Resumo por Pavimento
✓ Gráfico de Status

Colunas Visíveis no Excel: ← NOVO!
✓ Pavimento
✓ Tipologia
✓ Código
✓ Descrição
✓ Status (com cores!) ← NOVO!
✓ Observações
✓ Fotos
```

#### 👁️ Aba "Prévia"
```
Visualize antes de gerar:
- Estatísticas
- Gráfico de Status
- Resumo por Pavimento
- Configurações Aplicadas
```

### 4️⃣ Gerar Excel
```
Clique: "Gerar Excel" (botão verde)
⏱️ Aguarde: Download automático
```

### 5️⃣ Abrir e Verificar
```
Abra o arquivo .xlsx
Verifique as abas:
1. Resumo Geral
2. Por Pavimento
3. Por Tipologia
4. Fotos (com miniaturas!)
5. Análise (com gráficos!)
6. Pendências
7. Concluídas
8. Em Revisão
9. Em Andamento
```

---

## 🎨 Novidades Visuais

### Cores por Status (Formatação Condicional)

| Status | Cor |
|--------|-----|
| 🟡 Pendente | Amarelo |
| 🔵 Em Andamento | Azul |
| 🟣 Em Revisão | Roxo |
| 🟢 Concluído | Verde |
| 🔴 Cancelado | Vermelho |

### Miniaturas de Fotos

```
Aba "Fotos":
┌─────────────────────┬──────────────┐
│ Descrição           │ Miniatura    │
├─────────────────────┼──────────────┤
│ Ponto elétrico 101  │ [🖼️ 100x100] │
│ Tomada sala 202     │ [🖼️ 100x100] │
└─────────────────────┴──────────────┘
```

### Gráficos na Aba Análise

```
📊 Gráfico de Barras:
████████████████ Concluídas (45%)
████████ Em Andamento (25%)
█████ Pendências (20%)
███ Em Revisão (10%)

📈 Gráfico de Pizza:
Distribuição visual de todos os status
```

---

## ⚙️ Configurações Recomendadas

### 👤 Para Cliente (Aprovação)

```yaml
Destinatário: Cliente
Seções:
  - Pendências ✓
  - Concluídas ✓
  - Em Revisão ✓
Detalhes:
  - Fotos: SIM
  - Miniaturas: SIM
  - Observações: SIM
  - Timestamps: SIM
Colunas:
  - Pavimento, Tipologia, Código, Descrição, Status, Fotos
```

### 🔧 Para Fornecedor (Técnico)

```yaml
Destinatário: Fornecedor
Seções:
  - Pendências ✓
  - Em Andamento ✓
Detalhes:
  - Fotos: SIM
  - Miniaturas: NÃO (reduz tamanho)
  - Observações: SIM
  - Comentários Fornecedor: SIM
Colunas:
  - Todas (exceto Timestamps)
```

### 📊 Para Análise (Gerência)

```yaml
Destinatário: Cliente
Seções:
  - Todas ✓
Detalhes:
  - Resumo por Pavimento: SIM
  - Gráfico de Status: SIM
  - Timestamps: SIM
Colunas:
  - Todas
```

---

## 💾 Dicas de Uso

### 💡 Economia de Espaço
```
❌ Arquivo grande (20 MB):
   - Miniaturas: SIM
   - Todas as seções
   - Muitas fotos

✅ Arquivo pequeno (2 MB):
   - Miniaturas: NÃO
   - Apenas seções necessárias
   - Links para fotos (sem miniaturas)
```

### ⚡ Performance
```
✅ Rápido:
   - Até 1000 instalações
   - Miniaturas desativadas
   - Poucas seções

⚠️ Lento:
   - Mais de 2000 instalações
   - Miniaturas ativadas
   - Todas as seções
```

### 🎯 Melhores Práticas

1. **Use Prévia:** Sempre verifique antes de gerar
2. **Miniaturas:** Apenas quando necessário (aumenta muito o tamanho)
3. **Colunas:** Selecione apenas as relevantes
4. **Seções:** Não inclua seções vazias
5. **Persistência:** Configure uma vez, use sempre (salvamento automático)

---

## 🔍 Atalhos Úteis

| Ação | Atalho |
|------|--------|
| Filtrar dados | Clique nos ▼ dos cabeçalhos |
| Congelar painel | Já vem ativado (linha 1) |
| Ordenar | Clique no ▼ e escolha ordem |
| Ver foto grande | Clique no link azul na célula |
| Copiar dados | Ctrl+C nas células |

---

## ❓ FAQ Rápido

**P: Posso editar o Excel gerado?**  
R: Sim! É um arquivo .xlsx padrão e editável.

**P: As miniaturas funcionam em Google Sheets?**  
R: Não, apenas em Microsoft Excel ou LibreOffice.

**P: Posso compartilhar o Excel?**  
R: Sim, mas os links de fotos podem expirar.

**P: Como ativar miniaturas?**  
R: Aba "Detalhes" → Marque "Fotos" → Marque "Incluir Miniaturas"

**P: Onde vejo as cores de status?**  
R: Abra no Excel (não Sheets) → Abas detalhadas (Pendências, etc.)

**P: Posso escolher quais colunas exportar?**  
R: Sim! Aba "Detalhes" → Seção "Colunas Visíveis"

**P: Minhas configurações são salvas?**  
R: Sim! Automaticamente em localStorage do navegador.

**P: Como restaurar padrões?**  
R: Botão "Restaurar Padrões" no rodapé do modal.

---

## 🎓 Recursos Avançados

### Filtros Automáticos
Todas as abas têm filtros prontos:
- Clique no ▼ ao lado do cabeçalho
- Selecione valores específicos
- Combine múltiplos filtros

### Ordenação Personalizada
- Pavimento: Ordenação natural (1, 2, 10, 20)
- Tipologia: Ordem alfabética
- Código: Ordem numérica

### Links Clicáveis
Na aba "Fotos":
- Links em azul sublinhado
- Clique para abrir foto no navegador
- Tooltip com descrição

---

## 📱 Compatibilidade

| Software | Miniaturas | Cores | Gráficos |
|----------|-----------|-------|----------|
| Excel (Desktop) | ✅ | ✅ | ✅ |
| Excel (Online) | ✅ | ✅ | ✅ |
| LibreOffice | ✅ | ✅ | ✅ |
| Google Sheets | ❌ | ⚠️ | ❌ |
| Numbers (Mac) | ⚠️ | ⚠️ | ⚠️ |

**Recomendado:** Microsoft Excel ou LibreOffice

---

## 🆘 Precisa de Ajuda?

1. Leia: `RELATORIOS_AVANCADOS_EXCEL.md` (documentação completa)
2. Veja: Aba "Prévia" no modal (antes de gerar)
3. Teste: Gere um relatório pequeno primeiro
4. Ajuste: Use "Restaurar Padrões" se algo der errado

---

**Última Atualização:** 2025-11-10  
**Versão:** 1.0  
**Status:** ✅ Pronto para Uso
