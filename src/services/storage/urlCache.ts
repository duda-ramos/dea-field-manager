import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/services/logger';

interface CachedUrl {
  url: string;
  expiresAt: number;
  storagePath: string;
}

/**
 * URL Cache Service - Gerencia URLs assinadas com renovação automática
 * 
 * Problema resolvido: URLs expiram em 15min causando fotos "desaparecidas"
 * Solução: Cache em memória com renovação automática antes da expiração
 */
class UrlCacheService {
  private cache = new Map<string, CachedUrl>();
  private readonly EXPIRY_BUFFER_MS = 5 * 60 * 1000; // Renova 5min antes de expirar
  private readonly DEFAULT_EXPIRY_SEC = 900; // 15min
  private cleanupInterval: number | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  /**
   * Obtém URL assinada (do cache ou gerando nova)
   */
  async getSignedUrl(storagePath: string, bucketName = 'attachments'): Promise<string | null> {
    // Verifica cache
    const cached = this.cache.get(storagePath);
    const now = Date.now();

    if (cached && cached.expiresAt > now + this.EXPIRY_BUFFER_MS) {
      logger.debug('urlCache', { message: 'URL em cache', storagePath });
      return cached.url;
    }

    // Gera nova URL
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(storagePath, this.DEFAULT_EXPIRY_SEC);

      if (error || !data?.signedUrl) {
        logger.error('urlCache', {
          message: 'Falha ao gerar URL assinada',
          error: error?.message,
          storagePath
        });
        return null;
      }

      // Atualiza cache
      const expiresAt = now + (this.DEFAULT_EXPIRY_SEC * 1000) - this.EXPIRY_BUFFER_MS;
      this.cache.set(storagePath, {
        url: data.signedUrl,
        expiresAt,
        storagePath
      });

      logger.debug('urlCache', { message: 'URL gerada e cacheada', storagePath });
      return data.signedUrl;
    } catch (error) {
      logger.error('urlCache', {
        message: 'Erro ao gerar URL',
        error: error instanceof Error ? error.message : String(error),
        storagePath
      });
      return null;
    }
  }

  /**
   * Obtém múltiplas URLs em lote (otimizado)
   */
  async getSignedUrls(storagePaths: string[], bucketName = 'attachments'): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const pathsToFetch: string[] = [];

    // Verifica cache primeiro
    const now = Date.now();
    for (const path of storagePaths) {
      const cached = this.cache.get(path);
      if (cached && cached.expiresAt > now + this.EXPIRY_BUFFER_MS) {
        results.set(path, cached.url);
      } else {
        pathsToFetch.push(path);
      }
    }

    // Busca URLs não cacheadas em paralelo
    if (pathsToFetch.length > 0) {
      const promises = pathsToFetch.map(path => this.getSignedUrl(path, bucketName));
      const urls = await Promise.all(promises);

      pathsToFetch.forEach((path, index) => {
        const url = urls[index];
        if (url) {
          results.set(path, url);
        }
      });
    }

    return results;
  }

  /**
   * Remove URL do cache
   */
  invalidate(storagePath: string): void {
    this.cache.delete(storagePath);
    logger.debug('urlCache', { message: 'URL removida do cache', storagePath });
  }

  /**
   * Remove múltiplas URLs do cache
   */
  invalidateMany(storagePaths: string[]): void {
    for (const path of storagePaths) {
      this.cache.delete(path);
    }
    logger.debug('urlCache', { 
      message: 'URLs removidas do cache', 
      count: storagePaths.length 
    });
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    logger.debug('urlCache', { message: 'Cache limpo', count });
  }

  /**
   * Inicia limpeza automática de URLs expiradas
   */
  private startCleanupInterval(): void {
    // Limpa a cada 5 minutos
    this.cleanupInterval = window.setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);
  }

  /**
   * Remove URLs expiradas do cache
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let removed = 0;

    for (const [path, cached] of this.cache.entries()) {
      if (cached.expiresAt <= now) {
        this.cache.delete(path);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug('urlCache', { 
        message: 'URLs expiradas removidas', 
        removed,
        remaining: this.cache.size 
      });
    }
  }

  /**
   * Para o serviço e limpa recursos
   */
  destroy(): void {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats(): { size: number; paths: string[] } {
    return {
      size: this.cache.size,
      paths: Array.from(this.cache.keys())
    };
  }
}

export const urlCache = new UrlCacheService();
