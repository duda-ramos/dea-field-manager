# 🧪 Instruções para Teste Manual Completo

**Objetivo:** Validar correções e funcionalidades do sistema de fotos conforme solicitado.

---

## 📋 Pré-requisitos

1. ✅ Aplicação rodando localmente ou em ambiente de testes
2. ✅ Console do navegador aberto (F12)
3. ✅ Pelo menos 1 projeto criado com algumas instalações
4. ✅ Algumas fotos para fazer upload de teste

---

## 🧪 TESTE 1: Upload Nova Foto em Instalação

### Objetivo
Verificar que uploads novos têm metadados corretos.

### Passos

1. **Abrir um projeto existente**
   - Clicar em um projeto da lista

2. **Abrir uma instalação**
   - Clicar em uma instalação da lista

3. **Fazer upload de uma foto**
   - Clicar em "Adicionar Fotos" ou "Capturar Foto"
   - Selecionar 1 foto do seu dispositivo
   - Aguardar o upload

4. **Verificar na galeria do projeto**
   - Ir para a galeria de fotos do projeto
   - Localizar a foto recém-enviada

### ✅ Validações

#### Na Galeria:

- [ ] **Tamanho correto**
  - Passar o mouse sobre a foto
  - Verificar no tooltip: "💾 X.X KB" (não "0 KB" ou "0 B")
  
- [ ] **Tipo correto**
  - Abrir console (F12)
  - Executar:
    ```javascript
    const files = await window.__db.projectFiles.toArray();
    const lastFile = files[files.length - 1];
    console.log('Tipo:', lastFile.type); // Deve ser "image/jpeg", "image/png", etc.
    console.log('Tamanho:', lastFile.size); // Deve ser > 0
    ```
  - **Esperado:** 
    - `type`: `"image/jpeg"` ou `"image/png"` (não apenas `"image"`)
    - `size`: número > 0

- [ ] **Badge "Peça X"**
  - Verificar se aparece badge com número da peça no canto superior esquerdo da foto

- [ ] **Tooltip completo**
  - Passar o mouse sobre a foto
  - Verificar se mostra:
    - ✅ Nome do arquivo (`peca_XXX_YYYYMMDD_001.jpg`)
    - ✅ Data e hora de upload
    - ✅ Peça associada (código e descrição)
    - ✅ Tamanho do arquivo (em KB/MB, **não "0 KB"**)

### ✅ Resultado Esperado

- ✅ Foto aparece na galeria
- ✅ Tamanho mostrado corretamente (não é "0 KB")
- ✅ Tipo é MIME completo (ex: "image/jpeg")
- ✅ Badge e tooltip corretos

---

## 🔄 TESTE 2: Migração de Fotos Antigas

### Objetivo
Executar script de migração e verificar correção de metadados.

### Passos

#### Parte A: Verificar Fotos com Metadados Incorretos

1. **Abrir console do navegador** (F12)

2. **Listar fotos com metadados incorretos:**
   ```javascript
   // Ver todas as fotos
   const allFiles = await window.__db.projectFiles.toArray();
   console.log('Total de fotos:', allFiles.length);
   
   // Filtrar fotos com metadados incorretos
   const badMetadata = allFiles.filter(f => 
     f.type?.startsWith('image/') && (
       f.size === 0 || 
       !f.type || 
       f.type === 'image'
     )
   );
   
   console.log('Fotos com metadados incorretos:', badMetadata.length);
   console.table(badMetadata.map(f => ({
     id: f.id,
     name: f.name,
     size: f.size,
     type: f.type,
     projectId: f.projectId
   })));
   ```

#### Parte B: Executar Migração

1. **Obter ID de um projeto para testar:**
   ```javascript
   const projects = await window.__db.projects.toArray();
   console.table(projects.map(p => ({ id: p.id, name: p.name })));
   
   // Copiar o ID de um projeto
   const projectId = 'COLAR_ID_AQUI';
   ```

2. **Executar migração do projeto:**
   ```javascript
   console.log('🚀 Iniciando migração...');
   const stats = await window.migrateInstallationPhotos.migrateProject(projectId);
   
   console.log('\n📊 RESULTADO:');
   console.log('Instalações processadas:', stats.totalInstallations);
   console.log('Total de fotos:', stats.totalPhotos);
   console.log('✅ Fotos sincronizadas (novas):', stats.photosSynced);
   console.log('🔧 Metadados corrigidos:', stats.metadataFixed);
   console.log('❌ Erros:', stats.errors.length);
   
   if (stats.errors.length > 0) {
     console.error('Erros encontrados:', stats.errors);
   }
   ```

3. **OU migrar todos os projetos:**
   ```javascript
   console.log('🌍 Iniciando migração global...');
   const allStats = await window.migrateInstallationPhotos.migrateAll();
   
   // Ver estatísticas por projeto
   allStats.forEach((stats, projectId) => {
     console.log(`\nProjeto ${projectId}:`);
     console.log('  Fotos sincronizadas:', stats.photosSynced);
     console.log('  Metadados corrigidos:', stats.metadataFixed);
   });
   ```

#### Parte C: Validar Correções

1. **Verificar novamente fotos com metadados incorretos:**
   ```javascript
   const allFilesAfter = await window.__db.projectFiles.toArray();
   const badMetadataAfter = allFilesAfter.filter(f => 
     f.type?.startsWith('image/') && (
       f.size === 0 || 
       !f.type || 
       f.type === 'image'
     )
   );
   
   console.log('Fotos com metadados incorretos APÓS migração:', badMetadataAfter.length);
   
   if (badMetadataAfter.length === 0) {
     console.log('✅ SUCESSO! Todas as fotos têm metadados corretos!');
   } else {
     console.warn('⚠️ Ainda há fotos com metadados incorretos:');
     console.table(badMetadataAfter);
   }
   ```

### ✅ Validações

- [ ] **Estatísticas mostram correções aplicadas**
  - `metadataFixed` > 0 se havia fotos com metadados incorretos

- [ ] **Fotos antigas agora têm:**
  - [ ] Tamanho correto (`size > 0`)
  - [ ] Tipo correto (`type` = "image/jpeg", "image/png", etc.)

- [ ] **Nenhuma foto com `size=0` após migração**

- [ ] **Nenhuma foto com `type='image'` genérico**

### ✅ Resultado Esperado

```
📊 RESULTADO:
Instalações processadas: [N]
Total de fotos: [N]
✅ Fotos sincronizadas (novas): [N]
🔧 Metadados corrigidos: [N]
❌ Erros: 0

✅ SUCESSO! Todas as fotos têm metadados corretos!
```

---

## 📋 TESTE 3: Checklist Original (TESTES_SYNC_GALERIA.md)

### Teste 1 - Upload Individual

1. Abrir projeto → Instalação
2. Upload 1 foto
3. Verificar:
   - [ ] Toast de sucesso
   - [ ] Nome: `peca_[codigo]_[data]_001.jpg`
   - [ ] Badge "Peça X"
   - [ ] Tooltip completo **com tamanho correto**
   - [ ] Estatísticas atualizadas

### Teste 2 - Upload Múltiplo

1. Abrir projeto → Instalação
2. Selecionar 3 fotos simultaneamente
3. Fazer upload
4. Verificar:
   - [ ] Barra de progresso
   - [ ] Sequencial correto (001, 002, 003)
   - [ ] Todas na galeria
   - [ ] Todas com badge "Peça X"
   - [ ] Estatísticas +3

### Teste 6 - Funcionalidades da Galeria

1. Acessar galeria de fotos
2. Testar filtros:
   - [ ] "Todas as imagens"
   - [ ] "Apenas gerais"
   - [ ] "Apenas de peças"
3. Testar busca:
   - [ ] Por nome de arquivo
   - [ ] Por data
4. Testar ordenação:
   - [ ] Por data (mais recente)
   - [ ] Por nome (A-Z)
5. Verificar estatísticas:
   - [ ] Total correto
   - [ ] De instalações correto
   - [ ] Gerais correto

---

## ✅ Validações Adicionais

### Nenhuma foto com size=0

```javascript
const files = await window.__db.projectFiles.toArray();
const zeroSize = files.filter(f => f.type?.startsWith('image/') && f.size === 0);
console.log('Fotos com size=0:', zeroSize.length);
console.assert(zeroSize.length === 0, '❌ Há fotos com size=0!');
```

### Nenhuma foto com type='image' genérico

```javascript
const files = await window.__db.projectFiles.toArray();
const genericType = files.filter(f => f.type === 'image');
console.log('Fotos com type="image":', genericType.length);
console.assert(genericType.length === 0, '❌ Há fotos com type genérico!');
```

### Filtros por tipo funcionam

1. Ir para galeria
2. Selecionar filtro "Apenas de peças"
3. Verificar que só aparecem fotos com badge "Peça X"
4. Selecionar filtro "Apenas gerais"
5. Verificar que só aparecem fotos com badge "Geral"

---

## 📊 Resultado Final Esperado

### ✅ Sistema 100% Funcional

- ✅ Todos os uploads novos têm metadados corretos
- ✅ Fotos antigas corrigidas pela migração
- ✅ Nenhuma foto com `size=0`
- ✅ Nenhuma foto com `type='image'` genérico
- ✅ Badges e tooltips corretos
- ✅ Filtros funcionam corretamente
- ✅ Nomenclatura padronizada
- ✅ Estatísticas precisas

---

## 🐛 Solução de Problemas

### Erro: "migrateInstallationPhotos is not defined"

**Solução:** O script pode não estar carregado. Verifique se está importado em `src/main.tsx`:

```typescript
import '@/scripts/migrateInstallationPhotos'
```

### Erro: "Supabase storage bucket not configured"

**Solução:** Verifique a variável de ambiente:

```bash
# .env
VITE_SUPABASE_STORAGE_BUCKET=project-files
```

### Migração não corrige fotos

**Possíveis causas:**
1. Arquivo não existe mais no Storage
2. Permissões insuficientes
3. Bucket incorreto

**Debug:**
```javascript
// Ver detalhes de uma foto específica
const file = await window.__db.projectFiles.get('FILE_ID');
console.log('Detalhes da foto:', file);

// Tentar corrigir manualmente
await window.migrateInstallationPhotos.fixMetadata(
  file.projectId,
  file.id,
  file.storagePath
);
```

---

## 📝 Relatório de Teste

Após executar todos os testes, preencha:

### Resultado Geral

- [ ] ✅ Teste 1: Upload nova foto - **PASSOU**
- [ ] ✅ Teste 2: Migração - **PASSOU**
- [ ] ✅ Teste 3: Checklist original - **PASSOU**
- [ ] ✅ Validações adicionais - **PASSOU**

### Estatísticas

- Total de fotos no sistema: ______
- Fotos com metadados incorretos antes: ______
- Fotos corrigidas pela migração: ______
- Fotos com metadados incorretos depois: **0**

### Observações

```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

**Status:** ⬜ Aprovado  ⬜ Aprovado com ressalvas  ⬜ Reprovado  
**Testado por:** ___________________________  
**Data:** ____/____/______
