import { logger } from '@/services/logger';

/**
 * Blob Cleanup Service - Gerencia limpeza de blob URLs
 * 
 * Problema resolvido: Memory leaks por blob URLs não liberados
 * Solução: Rastreamento e limpeza automática de blob URLs
 */
class BlobCleanupService {
  private trackedBlobs = new Set<string>();

  /**
   * Registra blob URL para rastreamento
   */
  track(blobUrl: string): void {
    if (blobUrl.startsWith('blob:')) {
      this.trackedBlobs.add(blobUrl);
      logger.debug('blobCleanup', { 
        message: 'Blob URL rastreado', 
        url: blobUrl,
        total: this.trackedBlobs.size 
      });
    }
  }

  /**
   * Libera blob URL específico
   */
  revoke(blobUrl: string): void {
    if (blobUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(blobUrl);
        this.trackedBlobs.delete(blobUrl);
        logger.debug('blobCleanup', { 
          message: 'Blob URL liberado', 
          url: blobUrl,
          remaining: this.trackedBlobs.size 
        });
      } catch (error) {
        logger.error('blobCleanup', {
          message: 'Erro ao liberar blob URL',
          error: error instanceof Error ? error.message : String(error),
          url: blobUrl
        });
      }
    }
  }

  /**
   * Libera múltiplos blob URLs
   */
  revokeMany(blobUrls: string[]): void {
    let revoked = 0;
    for (const url of blobUrls) {
      if (url.startsWith('blob:')) {
        this.revoke(url);
        revoked++;
      }
    }
    
    if (revoked > 0) {
      logger.debug('blobCleanup', { 
        message: 'Múltiplos blobs liberados', 
        count: revoked,
        remaining: this.trackedBlobs.size 
      });
    }
  }

  /**
   * Libera todos os blob URLs rastreados
   */
  revokeAll(): void {
    const count = this.trackedBlobs.size;
    
    for (const url of this.trackedBlobs) {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        logger.error('blobCleanup', {
          message: 'Erro ao liberar blob',
          error: error instanceof Error ? error.message : String(error),
          url
        });
      }
    }
    
    this.trackedBlobs.clear();
    
    logger.debug('blobCleanup', { 
      message: 'Todos os blobs liberados', 
      count 
    });
  }

  /**
   * Obtém estatísticas de blob URLs rastreados
   */
  getStats(): { count: number; urls: string[] } {
    return {
      count: this.trackedBlobs.size,
      urls: Array.from(this.trackedBlobs)
    };
  }

  /**
   * Verifica se blob URL está sendo rastreado
   */
  isTracked(blobUrl: string): boolean {
    return this.trackedBlobs.has(blobUrl);
  }
}

export const blobCleanup = new BlobCleanupService();
