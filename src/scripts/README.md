# Script de Migração de Fotos de Instalações

## Descrição

Este script migra fotos existentes de instalações para o álbum de fotos do projeto e corrige metadados incorretos (tamanho = 0, tipo incorreto).

## Funcionalidades

### 1. `migrateInstallationPhotosForProject(projectId: string)`

Migra e corrige fotos de todas as instalações de um projeto específico.

**Comportamento:**
- Para cada instalação com fotos:
  - **Se a foto NÃO existe na galeria:** Sincroniza usando `syncPhotoToProjectAlbum`
  - **Se a foto JÁ existe mas tem metadados incorretos:** Corrige usando `fixPhotoMetadata`

**Retorno:**
```typescript
interface MigrationStats {
  totalInstallations: number;
  totalPhotos: number;
  photosSynced: number;        // Fotos novas sincronizadas
  metadataFixed: number;        // Metadados corrigidos
  errors: Array<{
    installationCode: number;
    photoPath: string;
    error: string;
  }>;
}
```

### 2. `fixPhotoMetadata(fileId: string, storagePath: string)`

Corrige metadados de uma foto específica.

**Ações:**
1. Busca o arquivo real no Supabase Storage
2. Obtém tamanho e tipo MIME corretos
3. Atualiza os campos `size`, `type`, e `url` no banco de dados

**Retorno:** `Promise<boolean>` - `true` se os metadados foram corrigidos

### 3. `migrateAllProjects()`

Migra fotos de todos os projetos do sistema.

**Retorno:** `Map<string, MigrationStats>` - Estatísticas por projeto

## Como Usar

### Opção 1: No Console do Navegador

O script se registra automaticamente no objeto `window` quando carregado.

```javascript
// Migrar um projeto específico
await migrateInstallationPhotos.migrateProject('project-id-aqui')

// Migrar todos os projetos
await migrateInstallationPhotos.migrateAll()

// Corrigir metadados de uma foto específica
await migrateInstallationPhotos.fixMetadata('file-id', 'storage/path/to/photo.jpg')
```

### Opção 2: Importar no Código

```typescript
import { 
  migrateInstallationPhotosForProject,
  fixPhotoMetadata 
} from '@/scripts/migrateInstallationPhotos';

// Usar as funções
const stats = await migrateInstallationPhotosForProject(projectId);
console.log(`Fotos sincronizadas: ${stats.photosSynced}`);
console.log(`Metadados corrigidos: ${stats.metadataFixed}`);
```

## Estatísticas

O script fornece estatísticas detalhadas após a execução:

```
============================================================
📊 ESTATÍSTICAS DA MIGRAÇÃO
============================================================
Total de instalações processadas: 150
Total de fotos encontradas: 450
✅ Fotos sincronizadas (novas): 120
🔧 Metadados corrigidos (existentes): 85
❌ Erros encontrados: 2
============================================================
```

## Logs Detalhados

O script gera logs coloridos e informativos:

- `🚀` Início da migração
- `📦` Processando instalação
- `➕` Nova foto sendo sincronizada
- `🔍` Foto existente encontrada
- `🔧` Corrigindo metadados
- `✅` Operação bem-sucedida
- `✓` Metadados já corretos
- `❌` Erro encontrado
- `⚠️` Aviso

## Segurança

- **Não faz upload duplicado:** Usa `storagePath` existente
- **Não sobrescreve fotos existentes:** Apenas atualiza metadados quando necessário
- **Erros isolados:** Um erro em uma foto não interrompe o processamento das demais
- **Idempotente:** Pode ser executado múltiplas vezes sem efeitos colaterais

## Casos de Uso

1. **Primeira migração:** Sincroniza todas as fotos das instalações para o álbum do projeto
2. **Correção de metadados:** Corrige fotos que foram sincronizadas com `size=0` ou `type='image'`
3. **Manutenção:** Pode ser executado periodicamente para garantir consistência

## Exemplo de Saída

```
🚀 Iniciando migração de fotos para projeto: abc-123

📊 Total de instalações: 15

📦 Processando instalação 101 (Porta de Entrada)
   Fotos encontradas: 3
   ➕ Nova foto: project/abc-123/inst-101/photo1.jpg
   ✅ Foto sincronizada
   🔍 Foto existente: peca_101_20231020_001.jpg
   🔧 Corrigindo metadados (size=0, type=image)
   ✅ Metadados corrigidos: 2450000 bytes, tipo: image/jpeg
   🔍 Foto existente: peca_101_20231020_002.jpg
   ✓ Metadados OK (size=1800000, type=image/jpeg)

============================================================
📊 ESTATÍSTICAS DA MIGRAÇÃO
============================================================
Total de instalações processadas: 15
Total de fotos encontradas: 45
✅ Fotos sincronizadas (novas): 12
🔧 Metadados corrigidos (existentes): 8
❌ Erros encontrados: 0
============================================================
```

## Solução de Problemas

### Erro: "Supabase storage bucket not configured"

Certifique-se de que a variável de ambiente `VITE_SUPABASE_STORAGE_BUCKET` está configurada.

### Erro: "Arquivo não encontrado no storage"

A foto pode ter sido deletada do storage mas ainda está referenciada no banco. Verifique se o `storagePath` está correto.

### Metadados não são corrigidos

Verifique se:
1. O arquivo existe no Supabase Storage
2. Você tem permissões para acessar o bucket
3. O caminho do storage está correto

## Manutenção

- O script é **idempotente** - pode ser executado múltiplas vezes sem problemas
- **Recomendação:** Execute após importações em massa de dados
- **Performance:** Processa fotos sequencialmente para evitar sobrecarga da API
