/**
 * NOTA: Este é um exemplo de como a detecção foi integrada.
 * O sistema agora está ATIVO em src/services/sync/sync.ts
 * Este arquivo serve apenas como referência de implementação.
 * 
 * Exemplo de integração da detecção de conflitos na sincronização
 * 
 * Este arquivo demonstra como modificar a função pullEntityType existente
 * para incluir detecção de conflitos
 */

// Unused imports removed - this is an example file
// import { db } from '@/db/indexedDb';
// import { checkForRemoteEdits, getRecordDisplayName } from './conflictUtils';
// import { conflictStore } from '@/stores/conflictStore';

// Exemplo de modificação necessária na função pullEntityType do sync.ts
export const pullEntityTypeModification = `
// Adicionar após a linha 140 (após transformar o registro):
const localRecord = await localTable.get(record.id);

if (localRecord && localRecord._dirty === 1) {
  // Mapear entity name para record type
  const recordType = entityName.slice(0, -1) as 'project' | 'installation' | 'contact' | 'budget';
  
  const conflictInfo = checkForRemoteEdits(
    localRecord,
    record,
    record.id,
    recordType
  );

  if (conflictInfo.hasConflict) {
    // Detectado conflito - adicionar ao store
    const recordName = getRecordDisplayName(recordType, localRecord);
    
    conflictStore.addConflict({
      recordType,
      recordName,
      localVersion: localRecord,
      remoteVersion: transformedRecord
    });
    
    logger.warn('[Conflict] Edit conflict detected', {
      recordType,
      recordId: record.id,
      localUpdatedAt: localRecord.updated_at,
      remoteUpdatedAt: record.updated_at
    });
    
    continue; // Pular atualização automática
  }
}

// Continuar com o código existente para salvar o registro
await localTable.put(localRecord);
`;

// Exemplo de modificação para push com force upload
export const pushEntityTypeModification = `
// Modificar a transformação do registro antes do upsert (linha ~83):
const normalizedRecord = transformRecordForSupabase(record, entityName, user.id);

// Adicionar verificação de force upload
if (record._forceUpload === 1) {
  // Forçar updated_at atual para garantir que sobrescreve versão remota
  normalizedRecord.updated_at = new Date().toISOString();
}

// Após o upsert bem-sucedido, limpar flags:
await localTable.update(record.id, { _dirty: 0, _forceUpload: 0 });
`;

// Exemplo de uso no componente
export const componentUsageExample = `
import { ConflictManager } from '@/components/ConflictManager';

// No App.tsx, adicionar o ConflictManager:
<ConflictManager />

// No header, adicionar o badge de conflitos:
import { ConflictBadge } from '@/components/ConflictManager';

<ConflictBadge />
`;

// Exemplo de teste manual
export const testConflictDetection = `
Para testar a detecção de conflitos:

1. Abrir a aplicação em duas abas diferentes
2. Na aba 1: Editar uma instalação e ficar offline
3. Na aba 2: Editar a mesma instalação
4. Na aba 1: Voltar online
5. O sistema deve detectar o conflito e mostrar o modal

O usuário pode então escolher:
- "Manter Minha Versão": Força upload da versão local
- "Usar Versão Remota": Descarta mudanças locais
`;