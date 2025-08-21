// Network detection utilities
export function isOnline(): boolean {
  return navigator.onLine;
}

export function onNetworkChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// Retry logic with exponential backoff
export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryCondition?: (error: any) => boolean;
}

const defaultRetryOptions: Required<RetryOptions> = {
  maxAttempts: 5,
  baseDelay: 500,
  maxDelay: 8000,
  retryCondition: (error: any) => {
    // Retry on network errors, 429 (rate limit), 5xx server errors
    if (error?.status) {
      return error.status === 429 || (error.status >= 500 && error.status < 600);
    }
    // Retry on network/connection errors
    return error?.message?.includes('fetch') || 
           error?.message?.includes('network') ||
           error?.message?.includes('timeout');
  }
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultRetryOptions, ...options };
  let lastError: any;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === opts.maxAttempts || !opts.retryCondition(error)) {
        throw error;
      }
      
      const delay = Math.min(opts.baseDelay * Math.pow(2, attempt - 1), opts.maxDelay);
      console.log(`Sync attempt ${attempt} failed, retrying in ${delay}ms:`, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Batch processing utilities
export function createBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

// Sync metrics tracking
export interface LegacySyncMetrics {
  success: boolean;
  duration: number;
  error?: string;
  push: {
    projects?: { pushed: number; deleted: number; errors: string[] };
    installations?: { pushed: number; deleted: number; errors: string[] };
    contacts?: { pushed: number; deleted: number; errors: string[] };
    budgets?: { pushed: number; deleted: number; errors: string[] };
    item_versions?: { pushed: number; deleted: number; errors: string[] };
    files?: { pushed: number; deleted: number; errors: string[] };
  };
  pull: {
    projects?: { pulled: number; errors: string[] };
    installations?: { pulled: number; errors: string[] };
    contacts?: { pulled: number; errors: string[] };
    budgets?: { pulled: number; errors: string[] };
    item_versions?: { pulled: number; errors: string[] };
    files?: { pulled: number; errors: string[] };
  };
}

export function createEmptyMetrics(): LegacySyncMetrics {
  return {
    success: false,
    duration: 0,
    push: {},
    pull: {}
  };
}

export function logSyncMetrics(operation: string, metrics: LegacySyncMetrics): void {
  const duration = metrics.duration || 0;
  
  console.group(`📊 ${operation} Sync Metrics`);
  console.log(`⏱️ Duration: ${duration}ms`);
  console.log(`✅ Success: ${metrics.success}`);
  
  if (metrics.push && Object.keys(metrics.push).length > 0) {
    console.group('📤 Pushed');
    Object.entries(metrics.push).forEach(([table, data]) => {
      if (data && data.pushed > 0) console.log(`  ${table}: ${data.pushed} pushed, ${data.deleted} deleted`);
    });
    console.groupEnd();
  }
  
  if (metrics.pull && Object.keys(metrics.pull).length > 0) {
    console.group('📥 Pulled');
    Object.entries(metrics.pull).forEach(([table, data]) => {
      if (data && data.pulled > 0) console.log(`  ${table}: ${data.pulled}`);
    });
    console.groupEnd();
  }
  
  if (metrics.error) {
    console.error('❌ Error:', metrics.error);
  }
  
  console.groupEnd();
}