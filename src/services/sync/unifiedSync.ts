import { logger } from '@/services/logger';
import { retryWithBackoff } from './retryWithBackoff';
import { fullSync } from './sync';
import { fileSyncService } from './fileSync';

interface SyncResult {
  entity: string;
  pushed: number;
  pulled: number;
  errors: string[];
  duration: number;
}

interface UnifiedSyncResult {
  success: boolean;
  results: SyncResult[];
  totalDuration: number;
  timestamp: string;
}

/**
 * Sistema Unificado de Sincronização
 * 
 * Problema resolvido: Múltiplos pontos de sincronização causavam inconsistências
 * Solução: Ponto único de entrada com ordem garantida e retry automático
 */
class UnifiedSyncService {
  private isSyncing = false;
  private lastSyncAt: number | null = null;

  /**
   * Executa sincronização completa de todas as entidades
   */
  async syncAll(): Promise<UnifiedSyncResult> {
    if (this.isSyncing) {
      logger.warn('unifiedSync', { message: 'Sincronização já em andamento' });
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      logger.info('unifiedSync', { message: 'Iniciando sincronização unificada' });

      // Usa a sincronização completa existente com retry
      const result = await retryWithBackoff(
        async () => await fullSync(),
        {
          maxAttempts: 2,
          initialDelayMs: 2000,
          onRetry: (attempt, error) => {
            logger.warn('unifiedSync', {
              message: 'Retry de sincronização completa',
              attempt,
              error: error.message
            });
          }
        }
      );

      const totalDuration = Date.now() - startTime;
      this.lastSyncAt = Date.now();

      // Converte resultado legacy para novo formato
      const unifiedResult: UnifiedSyncResult = {
        success: result.success,
        results: [
          {
            entity: 'all',
            pushed: typeof result.pushed === 'number' ? result.pushed : 0,
            pulled: typeof result.pulled === 'number' ? result.pulled : 0,
            errors: result.error ? [result.error] : [],
            duration: totalDuration
          }
        ],
        totalDuration,
        timestamp: new Date().toISOString()
      };

      logger.info('unifiedSync', {
        message: 'Sincronização concluída',
        success: result.success,
        totalDuration,
        pushed: result.pushed,
        pulled: result.pulled
      });

      return unifiedResult;
    } catch (error) {
      logger.error('unifiedSync', {
        message: 'Erro durante sincronização',
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sincroniza arquivos (inclui upload pendentes e metadata)
   */
  private async syncFiles(): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      logger.debug('unifiedSync', { message: 'Sincronizando arquivos' });

      // 1. Upload pendentes (arquivos com blob URLs)
      const uploadResult = await retryWithBackoff(
        async () => await fileSyncService.uploadPendingFiles(),
        { maxAttempts: 2, initialDelayMs: 2000 }
      );

      errors.push(...uploadResult.errors);

      // 2. Push metadata
      const pushResult = await retryWithBackoff(
        async () => await fileSyncService.pushFiles(),
        { maxAttempts: 3, initialDelayMs: 1000 }
      );

      errors.push(...pushResult.errors);

      // 3. Pull metadata
      const lastPulledAt = this.lastSyncAt || 0;
      const pullResult = await retryWithBackoff(
        async () => await fileSyncService.pullFiles(lastPulledAt),
        { maxAttempts: 3, initialDelayMs: 1000 }
      );

      errors.push(...pullResult.errors);

      const duration = Date.now() - startTime;

      return {
        entity: 'files',
        pushed: uploadResult.uploaded + pushResult.pushed,
        pulled: pullResult.pulled,
        errors,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      logger.error('unifiedSync', {
        message: 'Falha ao sincronizar arquivos',
        error: errorMsg,
        duration
      });

      return {
        entity: 'files',
        pushed: 0,
        pulled: 0,
        errors: [...errors, errorMsg],
        duration
      };
    }
  }

  /**
   * Verifica se há sincronização em andamento
   */
  get syncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Timestamp da última sincronização
   */
  get lastSync(): number | null {
    return this.lastSyncAt;
  }

  /**
   * Sincroniza apenas uma entidade específica
   * Nota: Usa sincronização completa pois entidades são interdependentes
   */
  async syncSingle(entity: 'projects' | 'installations' | 'contacts' | 'budgets' | 'files' | 'all'): Promise<UnifiedSyncResult> {
    logger.info('unifiedSync', {
      message: `Sincronização de ${entity} solicitada - executando sync completo`,
      reason: 'Entidades são interdependentes'
    });
    
    return await this.syncAll();
  }
}

export const unifiedSync = new UnifiedSyncService();
