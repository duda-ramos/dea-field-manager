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
export interface SyncMetrics {
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  pushed: {
    projects: number;
    installations: number;
    contacts: number;
    budgets: number;
    itemVersions: number;
    files: number;
  };
  pulled: {
    projects: number;
    installations: number;
    contacts: number;
    budgets: number;
    itemVersions: number;
    files: number;
  };
  deleted: {
    projects: number;
    installations: number;
    contacts: number;
    budgets: number;
    itemVersions: number;
    files: number;
  };
  errors: Array<{
    operation: string;
    error: string;
    timestamp: number;
  }>;
}

export function createEmptyMetrics(): SyncMetrics {
  return {
    startTime: Date.now(),
    pushed: { projects: 0, installations: 0, contacts: 0, budgets: 0, itemVersions: 0, files: 0 },
    pulled: { projects: 0, installations: 0, contacts: 0, budgets: 0, itemVersions: 0, files: 0 },
    deleted: { projects: 0, installations: 0, contacts: 0, budgets: 0, itemVersions: 0, files: 0 },
    errors: []
  };
}

export function logSyncMetrics(metrics: SyncMetrics): void {
  const duration = metrics.totalDuration || 0;
  
  console.group('📊 Sync Metrics');
  console.log(`⏱️ Duration: ${duration}ms`);
  
  console.group('📤 Pushed');
  Object.entries(metrics.pushed).forEach(([table, count]) => {
    if (count > 0) console.log(`  ${table}: ${count}`);
  });
  console.groupEnd();
  
  console.group('📥 Pulled');
  Object.entries(metrics.pulled).forEach(([table, count]) => {
    if (count > 0) console.log(`  ${table}: ${count}`);
  });
  console.groupEnd();
  
  console.group('🗑️ Deleted');
  Object.entries(metrics.deleted).forEach(([table, count]) => {
    if (count > 0) console.log(`  ${table}: ${count}`);
  });
  console.groupEnd();
  
  if (metrics.errors.length > 0) {
    console.group('❌ Errors');
    metrics.errors.forEach(error => {
      console.error(`  ${error.operation}: ${error.error}`);
    });
    console.groupEnd();
  }
  
  console.groupEnd();
}