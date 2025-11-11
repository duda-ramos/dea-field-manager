import { logger } from '@/services/logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  onRetry: () => {},
};

/**
 * Retry com backoff exponencial
 * 
 * Problema resolvido: Falhas temporárias causavam perda de dados
 * Solução: Retry inteligente com delays crescentes
 * 
 * @example
 * const result = await retryWithBackoff(
 *   async () => await uploadFile(file),
 *   { maxAttempts: 5, initialDelayMs: 500 }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let currentDelayMs = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      logger.debug('retryWithBackoff', {
        message: 'Tentativa de execução',
        attempt,
        maxAttempts: opts.maxAttempts
      });

      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Se for a última tentativa, não faz retry
      if (attempt === opts.maxAttempts) {
        logger.error('retryWithBackoff', {
          message: 'Todas as tentativas falharam',
          attempts: attempt,
          error: lastError.message
        });
        throw lastError;
      }

      // Log do retry
      logger.warn('retryWithBackoff', {
        message: 'Tentativa falhou, aguardando retry',
        attempt,
        nextAttempt: attempt + 1,
        delayMs: currentDelayMs,
        error: lastError.message
      });

      // Callback de retry
      opts.onRetry(attempt, lastError);

      // Aguarda o delay antes da próxima tentativa
      await delay(currentDelayMs);

      // Calcula próximo delay com backoff exponencial
      currentDelayMs = Math.min(
        currentDelayMs * opts.backoffMultiplier,
        opts.maxDelayMs
      );

      // Adiciona jitter (variação aleatória de ±20%) para evitar thundering herd
      const jitter = currentDelayMs * 0.2 * (Math.random() * 2 - 1);
      currentDelayMs = Math.round(currentDelayMs + jitter);
    }
  }

  // Nunca deve chegar aqui, mas TypeScript precisa
  throw lastError || new Error('Retry failed');
}

/**
 * Helper para delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry especializado para operações de rede
 * Inclui detecção de erros que não devem ser retentados
 */
export async function retryNetworkOperation<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(fn, {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    ...options,
    onRetry: (attempt, error) => {
      // Não retenta erros de autenticação ou validação
      if (isNonRetryableError(error)) {
        logger.warn('retryNetworkOperation', {
          message: 'Erro não retentável detectado',
          error: error.message
        });
        throw error;
      }

      options.onRetry?.(attempt, error);
    }
  });
}

/**
 * Verifica se um erro não deve ser retentado
 */
function isNonRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Erros de autenticação
  if (message.includes('unauthorized') || message.includes('authentication')) {
    return true;
  }

  // Erros de validação
  if (message.includes('validation') || message.includes('invalid')) {
    return true;
  }

  // Erros 4xx (exceto 429 - rate limit)
  if (message.includes('400') || message.includes('403') || message.includes('404')) {
    return true;
  }

  return false;
}

/**
 * Retry para operações de storage
 */
export async function retryStorageOperation<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(fn, {
    maxAttempts: 5,
    initialDelayMs: 500,
    maxDelayMs: 8000,
    backoffMultiplier: 2.5,
    ...options
  });
}
