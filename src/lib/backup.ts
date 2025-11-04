import { db } from '@/db/indexedDb';
import type { Project, Installation, ProjectContact, ProjectBudget, ItemVersion, ProjectFile } from '@/types';
import { logger } from './logger';

export interface BackupData {
  version: string;
  timestamp: number;
  userId: string;
  data: {
    projects: Project[];
    installations: Installation[];
    contacts: ProjectContact[];
    budgets: ProjectBudget[];
    itemVersions: ItemVersion[];
    files: ProjectFile[];
  };
  metadata: {
    totalRecords: number;
    projectCount: number;
    installationCount: number;
  };
}

export interface StorageUsage {
  usedMB: number;
  estimatedTotalMB: number;
  percentageUsed: number;
  isNearLimit: boolean;
  details: {
    projects: number;
    installations: number;
    contacts: number;
    budgets: number;
    itemVersions: number;
    files: number;
  };
}

/**
 * Calcula o tamanho aproximado em bytes de um objeto
 */
function calculateObjectSize(obj: unknown): number {
  const str = JSON.stringify(obj);
  return new Blob([str]).size;
}

/**
 * Calcula o uso de armazenamento do IndexedDB
 */
export async function calculateStorageUsage(): Promise<StorageUsage> {
  try {
    const [projects, installations, contacts, budgets, itemVersions, files] = await Promise.all([
      db.projects.toArray(),
      db.installations.toArray(),
      db.contacts.toArray(),
      db.budgets.toArray(),
      db.itemVersions.toArray(),
      db.files.toArray(),
    ]);

    const details = {
      projects: calculateObjectSize(projects),
      installations: calculateObjectSize(installations),
      contacts: calculateObjectSize(contacts),
      budgets: calculateObjectSize(budgets),
      itemVersions: calculateObjectSize(itemVersions),
      files: calculateObjectSize(files),
    };

    const totalBytes = Object.values(details).reduce((sum, size) => sum + size, 0);
    const usedMB = totalBytes / (1024 * 1024);
    
    // Estimar limite do IndexedDB (geralmente 50-60% da storage quota disponível)
    let estimatedTotalMB = 500; // Default fallback
    
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota) {
        // IndexedDB pode usar ~50% da quota total
        estimatedTotalMB = (estimate.quota * 0.5) / (1024 * 1024);
      }
    }

    const percentageUsed = (usedMB / estimatedTotalMB) * 100;
    const isNearLimit = percentageUsed >= 80;

    return {
      usedMB: parseFloat(usedMB.toFixed(2)),
      estimatedTotalMB: parseFloat(estimatedTotalMB.toFixed(2)),
      percentageUsed: parseFloat(percentageUsed.toFixed(2)),
      isNearLimit,
      details,
    };
  } catch (error) {
    logger.error('Erro ao calcular uso de armazenamento', error);
    throw error;
  }
}

/**
 * Exporta todos os dados do sistema como JSON
 */
export async function exportAllData(userId: string): Promise<BackupData> {
  try {
    logger.info('Iniciando exportação de dados');

    const [projects, installations, contacts, budgets, itemVersions, files] = await Promise.all([
      db.projects.where('_deleted').notEqual(1).toArray(),
      db.installations.where('_deleted').notEqual(1).toArray(),
      db.contacts.where('_deleted').notEqual(1).toArray(),
      db.budgets.where('_deleted').notEqual(1).toArray(),
      db.itemVersions.where('_deleted').notEqual(1).toArray(),
      db.files.where('_deleted').notEqual(1).toArray(),
    ]);

    const backupData: BackupData = {
      version: '1.0.0',
      timestamp: Date.now(),
      userId,
      data: {
        projects,
        installations,
        contacts,
        budgets,
        itemVersions,
        files,
      },
      metadata: {
        totalRecords:
          projects.length +
          installations.length +
          contacts.length +
          budgets.length +
          itemVersions.length +
          files.length,
        projectCount: projects.length,
        installationCount: installations.length,
      },
    };

    logger.info('Exportação concluída', {
      totalRecords: backupData.metadata.totalRecords,
      projectCount: backupData.metadata.projectCount,
    });

    return backupData;
  } catch (error) {
    logger.error('Erro ao exportar dados', error);
    throw new Error('Falha ao exportar dados: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
  }
}

/**
 * Valida a integridade do arquivo de backup
 */
export function validateBackupData(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const backup = data as Partial<BackupData>;

  // Validar estrutura básica
  if (!backup.version || !backup.timestamp || !backup.userId || !backup.data || !backup.metadata) {
    return false;
  }

  // Validar data object
  const requiredFields = ['projects', 'installations', 'contacts', 'budgets', 'itemVersions', 'files'];
  for (const field of requiredFields) {
    if (!Array.isArray((backup.data as any)[field])) {
      return false;
    }
  }

  // Validar metadata
  if (typeof backup.metadata.totalRecords !== 'number' || typeof backup.metadata.projectCount !== 'number') {
    return false;
  }

  return true;
}

/**
 * Importa dados de um backup
 */
export async function importBackup(
  backupData: BackupData,
  options: {
    clearExisting?: boolean;
    onProgress?: (progress: number, message: string) => void;
  } = {}
): Promise<void> {
  const { clearExisting = false, onProgress } = options;

  try {
    logger.info('Iniciando importação de backup', {
      version: backupData.version,
      timestamp: new Date(backupData.timestamp).toISOString(),
      totalRecords: backupData.metadata.totalRecords,
    });

    onProgress?.(0, 'Validando dados...');

    // Validar integridade
    if (!validateBackupData(backupData)) {
      throw new Error('Arquivo de backup inválido ou corrompido');
    }

    // Limpar dados existentes se solicitado
    if (clearExisting) {
      onProgress?.(10, 'Limpando dados existentes...');
      await Promise.all([
        db.projects.clear(),
        db.installations.clear(),
        db.contacts.clear(),
        db.budgets.clear(),
        db.itemVersions.clear(),
        db.files.clear(),
      ]);
    }

    // Importar projetos
    onProgress?.(20, 'Importando projetos...');
    if (backupData.data.projects.length > 0) {
      await db.projects.bulkPut(backupData.data.projects);
    }

    // Importar instalações
    onProgress?.(40, 'Importando instalações...');
    if (backupData.data.installations.length > 0) {
      await db.installations.bulkPut(backupData.data.installations);
    }

    // Importar contatos
    onProgress?.(60, 'Importando contatos...');
    if (backupData.data.contacts.length > 0) {
      await db.contacts.bulkPut(backupData.data.contacts);
    }

    // Importar orçamentos
    onProgress?.(70, 'Importando orçamentos...');
    if (backupData.data.budgets.length > 0) {
      await db.budgets.bulkPut(backupData.data.budgets);
    }

    // Importar versões de itens
    onProgress?.(80, 'Importando histórico de versões...');
    if (backupData.data.itemVersions.length > 0) {
      await db.itemVersions.bulkPut(backupData.data.itemVersions);
    }

    // Importar arquivos
    onProgress?.(90, 'Importando arquivos...');
    if (backupData.data.files.length > 0) {
      await db.files.bulkPut(backupData.data.files);
    }

    onProgress?.(100, 'Importação concluída!');

    logger.info('Importação de backup concluída com sucesso', {
      recordsImported: backupData.metadata.totalRecords,
    });
  } catch (error) {
    logger.error('Erro ao importar backup', error);
    throw new Error('Falha ao importar backup: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
  }
}

/**
 * Faz download do backup como arquivo JSON
 */
export function downloadBackupFile(backupData: BackupData, filename?: string): void {
  const json = JSON.stringify(backupData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `backup-dea-manager-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Lê arquivo de backup
 */
export function readBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (!validateBackupData(data)) {
          reject(new Error('Arquivo de backup inválido'));
          return;
        }

        resolve(data);
      } catch (error) {
        reject(new Error('Erro ao ler arquivo: ' + (error instanceof Error ? error.message : 'Formato inválido')));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    reader.readAsText(file);
  });
}
