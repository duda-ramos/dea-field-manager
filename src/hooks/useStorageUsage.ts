import { useState, useEffect } from 'react';
import { db } from '@/db/indexedDb';
import { logger } from '@/services/logger';

interface StorageUsage {
  used: number;
  quota: number;
  percentage: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
}

const STORAGE_CHECK_INTERVAL = 60000; // 1 minuto
const NEAR_LIMIT_THRESHOLD = 0.8; // 80%
const AT_LIMIT_THRESHOLD = 0.95; // 95%

/**
 * Hook para monitorar uso do IndexedDB
 * 
 * Problema resolvido: IndexedDB enche sem aviso e app quebra
 * Solução: Monitoramento em tempo real com alertas
 */
export function useStorageUsage() {
  const [usage, setUsage] = useState<StorageUsage>({
    used: 0,
    quota: 0,
    percentage: 0,
    isNearLimit: false,
    isAtLimit: false
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateUsage = async () => {
    try {
      // API de Storage moderna
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percentage = quota > 0 ? (used / quota) * 100 : 0;

        setUsage({
          used,
          quota,
          percentage,
          isNearLimit: percentage >= NEAR_LIMIT_THRESHOLD * 100,
          isAtLimit: percentage >= AT_LIMIT_THRESHOLD * 100
        });

        // Log se estiver próximo do limite
        if (percentage >= NEAR_LIMIT_THRESHOLD * 100) {
          logger.warn('storageUsage', {
            message: 'Uso de storage próximo do limite',
            percentage: percentage.toFixed(2),
            usedMB: (used / 1024 / 1024).toFixed(2),
            quotaMB: (quota / 1024 / 1024).toFixed(2)
          });
        }

        setError(null);
      } else {
        // Fallback: estima baseado no tamanho das tabelas
        const estimate = await estimateIndexedDBSize();
        setUsage(estimate);
        setError(null);
      }
    } catch (err) {
      logger.error('storageUsage', {
        message: 'Erro ao calcular uso de storage',
        error: err instanceof Error ? err.message : String(err)
      });
      setError('Não foi possível calcular o uso de armazenamento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateUsage();

    // Atualiza periodicamente
    const interval = setInterval(calculateUsage, STORAGE_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return {
    ...usage,
    loading,
    error,
    refresh: calculateUsage,
    formatUsed: () => formatBytes(usage.used),
    formatQuota: () => formatBytes(usage.quota)
  };
}

/**
 * Estima tamanho do IndexedDB (fallback)
 */
async function estimateIndexedDBSize(): Promise<StorageUsage> {
  try {
    const [projects, installations, files, contacts] = await Promise.all([
      db.projects.count(),
      db.installations.count(),
      db.files.count(),
      db.contacts.count()
    ]);

    // Estimativa grosseira: 
    // - Projeto: ~10KB
    // - Instalação: ~5KB
    // - Arquivo (metadata): ~2KB
    // - Contato: ~1KB
    const estimatedUsed = 
      (projects * 10 * 1024) +
      (installations * 5 * 1024) +
      (files * 2 * 1024) +
      (contacts * 1 * 1024);

    // Quota padrão: 50MB (browsers modernos)
    const quota = 50 * 1024 * 1024;
    const percentage = (estimatedUsed / quota) * 100;

    return {
      used: estimatedUsed,
      quota,
      percentage,
      isNearLimit: percentage >= NEAR_LIMIT_THRESHOLD * 100,
      isAtLimit: percentage >= AT_LIMIT_THRESHOLD * 100
    };
  } catch (error) {
    logger.error('estimateIndexedDBSize', {
      message: 'Erro ao estimar tamanho',
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      used: 0,
      quota: 0,
      percentage: 0,
      isNearLimit: false,
      isAtLimit: false
    };
  }
}

/**
 * Formata bytes para formato legível
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Hook para limpar storage quando necessário
 */
export function useStorageCleanup() {
  const clearOldData = async () => {
    try {
      // Remove projetos deletados há mais de 30 dias
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      const deletedProjects = await db.projects
        .where('deleted_at')
        .below(thirtyDaysAgo)
        .toArray();

      for (const project of deletedProjects) {
        await db.projects.delete(project.id);
      }

      logger.info('storageCleanup', {
        message: 'Limpeza de storage concluída',
        projectsDeleted: deletedProjects.length
      });

      return { success: true, deletedCount: deletedProjects.length };
    } catch (error) {
      logger.error('storageCleanup', {
        message: 'Erro ao limpar storage',
        error: error instanceof Error ? error.message : String(error)
      });

      return { success: false, deletedCount: 0 };
    }
  };

  return { clearOldData };
}
