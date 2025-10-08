# 🧪 Guia de Teste: Links de Fotos no PDF

## Checklist de Teste

### ✅ Preparação
- [ ] Abrir o DEA Manager no navegador
- [ ] Criar ou abrir um projeto existente

### ✅ Teste 1: Item com 1 Foto

1. **Criar instalação pendente**
   - [ ] Adicionar nova instalação
   - [ ] Preencher código, descrição, tipologia, pavimento
   - [ ] Adicionar observação (ex: "Aguardando material")
   - [ ] **NÃO** marcar como instalado
   - [ ] Adicionar **1 foto** (usando o botão de câmera)
   - [ ] Salvar

2. **Gerar relatório PDF**
   - [ ] Clicar em "Gerar Relatório"
   - [ ] Escolher formato: **PDF**
   - [ ] Escolher interlocutor: **Cliente**
   - [ ] Confirmar geração

3. **Verificar PDF**
   - [ ] Abrir PDF gerado
   - [ ] Ir para seção **"Pendências"**
   - [ ] Localizar a linha do item criado
   - [ ] Na coluna "Foto", verificar se aparece: **"📷 Ver foto"** em azul
   - [ ] Verificar se o texto está **sublinhado**
   - [ ] **Clicar** no link "📷 Ver foto"
   - [ ] Confirmar que a **imagem abre** corretamente

### ✅ Teste 2: Item com Múltiplas Fotos

1. **Criar instalação com múltiplas fotos**
   - [ ] Adicionar nova instalação
   - [ ] Preencher dados básicos
   - [ ] Adicionar observação
   - [ ] **NÃO** marcar como instalado
   - [ ] Adicionar **3 fotos** diferentes
   - [ ] Salvar

2. **Gerar relatório PDF**
   - [ ] Gerar relatório PDF para Cliente
   - [ ] Abrir PDF

3. **Verificar PDF**
   - [ ] Ir para seção "Pendências"
   - [ ] Na coluna "Foto", verificar se aparece: **"📷 Foto 1 | 📷 Foto 2 | 📷 Foto 3"**
   - [ ] Todos os links devem estar em **azul** e **sublinhados**
   - [ ] **Clicar** em "📷 Foto 1" → deve abrir a primeira imagem
   - [ ] **Clicar** em "📷 Foto 2" → deve abrir a segunda imagem
   - [ ] **Clicar** em "📷 Foto 3" → deve abrir a terceira imagem

### ✅ Teste 3: Item sem Foto

1. **Criar instalação sem foto**
   - [ ] Adicionar nova instalação
   - [ ] Preencher dados básicos
   - [ ] Adicionar observação
   - [ ] **NÃO** adicionar fotos
   - [ ] Salvar

2. **Verificar PDF**
   - [ ] Gerar relatório PDF
   - [ ] Na seção "Pendências", verificar o item
   - [ ] Na coluna "Foto", deve estar **vazia** ou com **"-"**
   - [ ] **NÃO** deve aparecer "Ver foto"

### ✅ Teste 4: Relatório para Fornecedor

1. **Gerar relatório para fornecedor**
   - [ ] Usar o mesmo projeto com itens pendentes com fotos
   - [ ] Gerar relatório PDF para **Fornecedor**
   - [ ] Abrir PDF

2. **Verificar PDF**
   - [ ] Ir para seção "Pendências"
   - [ ] Verificar se os links de foto aparecem corretamente
   - [ ] Clicar nos links para confirmar que funcionam

### ✅ Teste 5: Excel/XLSX

1. **Gerar relatório Excel**
   - [ ] Gerar relatório **XLSX** para Cliente
   - [ ] Abrir Excel

2. **Verificar Excel**
   - [ ] Na aba "Pendências"
   - [ ] Coluna "Foto" deve mostrar: **"Arquivo de foto disponível"**
   - [ ] **NÃO** deve ser um link clicável (comportamento esperado)

### ✅ Teste 6: Compatibilidade de Visualizadores

Testar com diferentes visualizadores de PDF:

- [ ] **Chrome PDF Viewer** (padrão do navegador)
  - Abrir PDF no Chrome
  - Clicar nos links de foto
  - Confirmar que abre

- [ ] **Firefox PDF Viewer** (se disponível)
  - Abrir PDF no Firefox
  - Clicar nos links de foto
  - Confirmar que abre

- [ ] **Adobe Acrobat Reader** (se disponível)
  - Baixar PDF
  - Abrir com Adobe Reader
  - Clicar nos links de foto
  - Confirmar que abre

## ❌ Problemas Conhecidos

### Se os links não abrirem:
1. **Visualizador muito antigo**: Alguns visualizadores de PDF antigos não suportam data URLs
   - Solução: Use Chrome ou Firefox (visualizadores modernos)

2. **Bloqueio de popup**: Navegador pode bloquear abertura de imagens
   - Solução: Permitir popups para o PDF

3. **PDF corrompido**: Problema na geração
   - Solução: Gerar novamente o relatório

## ✅ Resultado Esperado

### Visual Correto:
```
┌────────┬──────────────┬─────────────────┬─────────────────────────┐
│ Código │ Descrição    │ Observação      │ Foto                    │
├────────┼──────────────┼─────────────────┼─────────────────────────┤
│ 101    │ Tomada TUG   │ Aguardando peça │ 📷 Ver foto             │ ← Azul + Sublinhado
│ 102    │ Interruptor  │ Em análise      │ 📷 Foto 1 | 📷 Foto 2   │ ← Links individuais
│ 103    │ Luminária    │ Problema        │                         │ ← Vazio (sem foto)
└────────┴──────────────┴─────────────────┴─────────────────────────┘
```

## 📝 Relatar Problemas

Se encontrar algum problema:

1. **Anote**:
   - Visualizador de PDF usado
   - Navegador e versão
   - Número de fotos no item
   - Mensagem de erro (se houver)

2. **Verifique**:
   - Console do navegador (F12) para erros
   - Se o PDF foi gerado completamente
   - Se as fotos existem na instalação

3. **Capture**:
   - Screenshot do PDF
   - Screenshot do erro
   - Export dos dados do item (se possível)

## 🎉 Sucesso!

Se todos os testes passarem:
- ✅ Links aparecem em azul
- ✅ Links são sublinhados
- ✅ Emoji 📷 está presente
- ✅ Clicar abre as imagens
- ✅ Múltiplas fotos têm links separados
- ✅ Itens sem foto não mostram link

**Parabéns! A funcionalidade está 100% funcional!** 🎊
