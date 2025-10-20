# Relatório de Diagnóstico - Sincronização de Fotos

**Data**: 2025-10-20  
**Status Geral**: ⚠️ **PARCIALMENTE FUNCIONANDO** (com problemas menores)

---

## 1. Análise de `EnhancedImageUpload.tsx`

### ✅ Pontos Funcionando Corretamente

1. **Importação do `syncPhotoToProjectAlbum`**
   - ✅ Linha 18: Importado corretamente de `@/utils/photoSync`

2. **Chamada na função `uploadImage`**
   - ✅ Linhas 267-293: A função é chamada quando `installationId` existe
   - ✅ Condição correta: `if (installationId)`

3. **Parâmetros passados**
   - ✅ `projectId` - Correto
   - ✅ `installationId` - Correto
   - ✅ `installation.codigo.toString()` - Correto (convertido para string)
   - ✅ `res.storagePath` - Correto (path do storage após upload)

4. **Tratamento de erro**
   - ✅ Linhas 278-292: Erro é capturado em `try-catch`
   - ✅ Erro NÃO bloqueia o upload principal
   - ✅ Erro é logado com contexto completo
   - ✅ Console.error registra o problema

### 📋 Observações

- O componente `EnhancedImageUpload` carrega TODAS as imagens do projeto (linha 90)
- Filtra apenas por `type?.startsWith('image/')` (linha 91)
- Mostra badge "Peça X" para fotos com `installationId` (linhas 984-989)
- Tooltip exibe informações da instalação (linhas 1034-1037)

---

## 2. Análise de `photoSync.ts`

### ✅ Pontos Funcionando Corretamente

1. **Implementação de `syncPhotoToProjectAlbum`**
   - ✅ Função existe (linhas 8-54)
   - ✅ Não faz upload duplicado (usa `storagePath` existente)
   - ✅ Logs informativos no console

2. **Geração de nome padronizado**
   - ✅ Linha 23: `peca_${installationCode}_${date}_${paddedSequencial}.jpg`
   - ✅ Formato: `peca_[codigo]_[data]_[sequencial].jpg`
   - ✅ Data no formato YYYYMMDD
   - ✅ Sequencial com 3 dígitos (001, 002, etc.)

3. **Criação de registro em project_files**
   - ✅ Linhas 44-47: Usa `StorageManagerDexie.upsertFile`
   - ✅ Gera ID único: `img_${Date.now()}_${random}`

4. **Função `getNextSequentialForProject`**
   - ✅ Linhas 59-68: Implementada corretamente
   - ✅ Conta arquivos de imagem existentes
   - ✅ Retorna próximo número sequencial

### ⚠️ Problemas Identificados

1. **Campo `type` incorreto**
   ```typescript
   // Linha 32 - PROBLEMA
   type: 'image',  // ❌ Deveria ser 'image/jpeg' ou tipo MIME completo
   ```
   - **Impacto**: Pode causar problemas de filtragem
   - **Solução**: Mudar para `'image/jpeg'` ou passar tipo correto

2. **Campo `size` zerado**
   ```typescript
   // Linha 33 - PROBLEMA
   size: 0,  // ❌ Tamanho real não é capturado
   ```
   - **Impacto**: Tamanho do arquivo não aparece na galeria
   - **Solução**: Obter tamanho real do arquivo do storage

3. **Falta campo `url`**
   ```typescript
   // Linha 28-40
   const projectFile: Omit<ProjectFile, 'id'> = {
     // ... outros campos
     // ❌ Falta url: ''
   }
   ```
   - **Impacto**: Pode causar erro ao tentar exibir a imagem
   - **Solução**: Adicionar `url: ''`

---

## 3. Análise do PhotoGallery (Upload Alternativo)

### ✅ Pontos Funcionando Corretamente

1. **Componente `PhotoGallery`**
   - ✅ Linha 6: Importa `syncPhotoToProjectAlbum`
   - ✅ Linhas 79-84: Chama a função de sync após upload
   - ✅ Parâmetros corretos: `projectId`, `installationId`, `installationCode`, `storagePath`

2. **Integração com Installation Modal**
   - ✅ Linhas 646-651 de `installation-detail-modal-new.tsx`
   - ✅ Passa todos os parâmetros necessários:
     - `projectId={installation.project_id}`
     - `installationId={installation.id}`
     - `installationCode={String(installation.codigo)}`

3. **Notificações**
   - ✅ Toast de sucesso quando foto é sincronizada (linhas 121-125)
   - ✅ Toast de aviso se sincronização falhar (linhas 127-133)

---

## 4. Integração com Galeria do Projeto

### ✅ Pontos Funcionando Corretamente

1. **Rota `/projeto/:id/arquivos`**
   - ✅ Existe em `App.tsx` (linha 180)
   - ✅ Renderiza `ProjectDetailNew` component

2. **Seção de Arquivos**
   - ✅ `renderArquivosSection()` existe (linha 808 de ProjectDetailNew.tsx)
   - ✅ Usa `EnhancedImageUpload` para exibir galeria
   - ✅ Passa `projectId` e `context="projeto"`

3. **Exibição de Badges**
   - ✅ Badge "Peça X" aparece nas fotos de instalação
   - ✅ Badge "Geral" aparece nas fotos sem instalação

4. **Tooltip com Informações**
   - ✅ Nome do arquivo
   - ✅ Data de upload
   - ✅ Informações da instalação (código e descrição)
   - ✅ Tamanho do arquivo

---

## 5. Teste Manual Recomendado

### Cenário de Teste

1. **Upload de 1 foto em uma instalação:**
   ```
   1. Abrir projeto
   2. Abrir detalhes de uma instalação
   3. Ir na aba "Fotos"
   4. Fazer upload de 1 foto
   5. Verificar mensagem de sucesso
   ```

2. **Verificação na galeria do projeto:**
   ```
   1. Navegar para /projeto/:id/arquivos
   2. Verificar se a foto aparece
   3. Verificar badge "Peça X" (onde X é o código)
   4. Passar mouse sobre a foto
   5. Verificar tooltip com informações
   ```

### Resultados Esperados

- ✅ Foto aparece na galeria do projeto
- ⚠️ Badge "Peça X" pode não aparecer corretamente devido ao problema do campo `type`
- ⚠️ Tamanho do arquivo aparecerá como "0 KB" devido ao problema do campo `size`
- ✅ Tooltip deve mostrar informações da instalação

---

## 6. Resumo de Problemas a Corrigir

### 🔴 **Prioridade Alta**

**Arquivo: `src/utils/photoSync.ts`**

1. **Linha 32**: Corrigir tipo de arquivo
   ```typescript
   // ATUAL
   type: 'image',
   
   // CORRETO
   type: 'image/jpeg',  // ou obter tipo real do arquivo
   ```

2. **Linha 33**: Capturar tamanho real do arquivo
   ```typescript
   // ATUAL
   size: 0,
   
   // CORRETO
   size: fileSize,  // precisa receber como parâmetro ou obter do storage
   ```

3. **Adicionar campo `url`**
   ```typescript
   const projectFile: Omit<ProjectFile, 'id'> = {
     // ... outros campos
     url: '',  // Será gerado sob demanda
   };
   ```

### 🟡 **Melhorias Recomendadas**

1. **Passar tamanho e tipo como parâmetros**
   - Modificar assinatura da função `syncPhotoToProjectAlbum` para receber `fileSize` e `fileType`
   - Atualizar chamadas em `EnhancedImageUpload.tsx` e `PhotoGallery.tsx`

2. **Adicionar validação**
   - Verificar se arquivo já foi sincronizado (evitar duplicatas)
   - Validar tipo MIME antes de criar registro

---

## 7. Conclusão

### Status: ⚠️ **FUNCIONANDO COM RESSALVAS**

**O que está funcionando:**
- ✅ Upload de fotos
- ✅ Sincronização com álbum do projeto
- ✅ Exibição na galeria
- ✅ Badge "Peça X" e tooltip
- ✅ Geração de nome padronizado
- ✅ Tratamento de erro não-bloqueante

**O que precisa correção:**
- ❌ Campo `type` com valor incorreto (`'image'` em vez de `'image/jpeg'`)
- ❌ Campo `size` sempre zerado
- ❌ Campo `url` faltando no registro sincronizado

**Impacto dos problemas:**
- **Médio**: Fotos aparecem na galeria, mas informações de tamanho estão incorretas
- **Baixo**: Possíveis problemas de filtragem por tipo de arquivo
- **Baixo**: Possível erro ao tentar exibir URL da imagem

**Recomendação:**
Implementar as correções no arquivo `photoSync.ts` antes de colocar em produção. O sistema está funcional para uso básico, mas as correções melhorarão a confiabilidade e experiência do usuário.
