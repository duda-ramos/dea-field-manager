import { db } from '@/db/indexedDb';
import { StorageManagerDexie } from '@/services/StorageManager';
import { toast } from 'sonner';
import { 
  markForForceUpload, 
  cleanSyncFlags, 
  logConflict
} from './conflictUtils';
import { logger } from '@/services/logger';

/**
 * Resolve conflitos de edição entre versões local e remota
 * 
 * Função principal de resolução que orquestra o processo completo:
 * 1. Aplica a estratégia escolhida (local ou remota)
 * 2. Atualiza o banco de dados apropriadamente
 * 3. Registra a resolução para auditoria
 * 4. Notifica o usuário sobre o resultado
 * 
 * @param recordId - ID do registro em conflito
 * @param recordType - Tipo do registro para roteamento correto
 * @param useLocal - true para manter versão local, false para usar remota
 * @param localVersion - Objeto completo da versão local
 * @param remoteVersion - Objeto completo da versão remota
 * @throws Error se houver falha na atualização do banco
 */
export async function resolveEditConflict(
  recordId: string,
  recordType: 'project' | 'installation' | 'contact' | 'budget',
  useLocal: boolean,
  localVersion: any,
  remoteVersion: any
): Promise<void> {
  try {
    if (useLocal) {
      // User chose to keep local version
      await keepLocalVersion(recordId, recordType, localVersion);
    } else {
      // User chose to use remote version
      await useRemoteVersion(recordId, recordType, remoteVersion);
    }

    // Log the resolution
    logConflict('resolved', {
      recordId,
      recordType,
      resolution: useLocal ? 'local' : 'remote'
    });

  } catch (error) {
    logger.error('Error resolving conflict:', error);
    toast.error('Erro ao resolver conflito. Por favor, tente novamente.');
    throw error;
  }
}

/**
 * Mantém versão local e força upload para o servidor
 * 
 * Processo Last Write Wins (LWW) do lado do cliente:
 * 1. Marca registro com flag _forceUpload
 * 2. Atualiza timestamp para garantir precedência
 * 3. Usa StorageManagerDexie para persistir com garantias
 * 4. Notifica sucesso ao usuário
 * 
 * O flag _forceUpload garante que na próxima sincronização
 * esta versão sobrescreverá qualquer versão remota
 * 
 * @param recordId - ID do registro (não usado diretamente, mas mantido para consistência)
 * @param recordType - Tipo para roteamento do método de persistência
 * @param localVersion - Versão local completa a ser mantida
 */
async function keepLocalVersion(
  recordId: string,
  recordType: string,
  localVersion: any
): Promise<void> {
  // Mark record for force upload
  const markedRecord = markForForceUpload(localVersion);

  // Update in database based on type
  switch (recordType) {
    case 'project':
      await StorageManagerDexie.upsertProject(markedRecord);
      break;
    case 'installation':
      await StorageManagerDexie.upsertInstallation(markedRecord);
      break;
    case 'contact':
      await StorageManagerDexie.upsertContact(markedRecord);
      break;
    case 'budget':
      await StorageManagerDexie.upsertBudget(markedRecord);
      break;
  }

  toast.success('Sua versão foi mantida e enviada ao servidor');
}

/**
 * Descarta mudanças locais e aplica versão remota
 * 
 * Processo de aceitação da versão do servidor:
 * 1. Remove flags de sincronização da versão remota
 * 2. Salva diretamente no Dexie (sem passar pelo StorageManager)
 * 3. Isso evita marcar como dirty e resincronizar
 * 4. Notifica usuário sobre aplicação bem-sucedida
 * 
 * Usa db.put() diretamente para evitar triggers de modificação
 * 
 * @param recordId - ID do registro (usado implicitamente no put)
 * @param recordType - Tipo para selecionar tabela correta
 * @param remoteVersion - Versão remota a ser aplicada localmente
 */
async function useRemoteVersion(
  recordId: string,
  recordType: string,
  remoteVersion: any
): Promise<void> {
  // Clean sync flags from remote version
  const cleanedRecord = cleanSyncFlags(remoteVersion);

  // Update in database based on type
  switch (recordType) {
    case 'project':
      await db.projects.put(cleanedRecord);
      break;
    case 'installation':
      await db.installations.put(cleanedRecord);
      break;
    case 'contact':
      await db.contacts.put(cleanedRecord);
      break;
    case 'budget':
      await db.budgets.put(cleanedRecord);
      break;
  }

  toast.success('Versão remota foi aplicada');
}

/**
 * Verifica se registro deve forçar upload (ignorando verificações de timestamp)
 * 
 * Usado durante sincronização para identificar registros que devem
 * sobrescrever versão remota independentemente de timestamps
 * 
 * @param record - Registro a verificar
 * @returns true se registro tem flag de forçar upload
 */
export function shouldForceUpload(record: any): boolean {
  return record._forceUpload === 1;
}

/**
 * Limpa flag de force upload após sincronização bem-sucedida
 * 
 * Chamado após confirmação de que o servidor aceitou a versão local
 * Remove o flag para evitar forçar uploads desnecessários no futuro
 * 
 * @param recordId - ID do registro para limpar
 * @param recordType - Tipo para localizar tabela correta
 */
export async function clearForceUploadFlag(
  recordId: string,
  recordType: string
): Promise<void> {
  const table = getTableByType(recordType);
  if (!table) return;

  const record = await table.get(recordId);
  if (record && record._forceUpload) {
    delete record._forceUpload;
    await table.put(record);
  }
}

/**
 * Obtém tabela Dexie correspondente ao tipo de registro
 * 
 * Função utilitária para mapear tipos string para tabelas Dexie
 * Centraliza o mapeamento para facilitar manutenção
 * 
 * @param recordType - Tipo do registro como string
 * @returns Tabela Dexie correspondente ou null se tipo inválido
 */
function getTableByType(recordType: string) {
  switch (recordType) {
    case 'project':
      return db.projects;
    case 'installation':
      return db.installations;
    case 'contact':
      return db.contacts;
    case 'budget':
      return db.budgets;
    default:
      return null;
  }
}