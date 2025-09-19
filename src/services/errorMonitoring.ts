import { logger } from './logger';
import { getFeatureFlag } from '@/config/featureFlags';

export interface ErrorContext {
  userId?: string;
  action?: string;
  component?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  count: number;
  lastOccurred: string;
}

class ErrorMonitoring {
  private errors: Map<string, ErrorReport> = new Map();
  private maxErrors = 1000;

  constructor() {
    // Set up global error handlers
    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers() {
    // Capture unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.captureError(event.error || new Error(event.message), {
        action: 'window_error',
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        {
          action: 'unhandled_rejection',
          url: window.location.href,
          userAgent: navigator.userAgent,
        }
      );
    });

    // React error boundary integration (if needed)
    if (getFeatureFlag('VERBOSE_LOGS')) {
      // Error monitoring initialized
    }
  }

  captureError(
    error: Error, 
    context: ErrorContext = {}, 
    severity: ErrorReport['severity'] = 'medium'
  ): string {
    const errorId = this.generateErrorId(error.message, error.stack);
    const timestamp = new Date().toISOString();

    const enrichedContext: ErrorContext = {
      ...context,
      timestamp,
      url: context.url || window.location.href,
      userAgent: context.userAgent || navigator.userAgent,
    };

    // Check if this error already exists
    const existingError = this.errors.get(errorId);
    
    if (existingError) {
      // Update existing error
      existingError.count++;
      existingError.lastOccurred = timestamp;
      existingError.context = { ...existingError.context, ...enrichedContext };
      
      logger.warn(`Recurring error #${existingError.count}`, {
        errorId,
        message: error.message,
        context: enrichedContext
      });
    } else {
      // Create new error report
      const errorReport: ErrorReport = {
        id: errorId,
        message: error.message,
        stack: getFeatureFlag('VERBOSE_LOGS') ? error.stack : undefined,
        context: enrichedContext,
        severity,
        resolved: false,
        count: 1,
        lastOccurred: timestamp
      };

      this.errors.set(errorId, errorReport);

      // Log based on severity
      switch (severity) {
        case 'critical':
          logger.error(`🚨 CRITICAL ERROR: ${error.message}`, {
            errorId,
            context: enrichedContext,
            stack: error.stack
          });
          break;
        case 'high':
          logger.error(`❌ HIGH SEVERITY: ${error.message}`, {
            errorId,
            context: enrichedContext
          });
          break;
        case 'medium':
          logger.warn(`⚠️ ERROR: ${error.message}`, {
            errorId,
            context: enrichedContext
          });
          break;
        case 'low':
          logger.debug(`⚪ Minor error: ${error.message}`, {
            errorId,
            context: enrichedContext
          });
          break;
      }

      // Clean up old errors if we're at the limit
      if (this.errors.size > this.maxErrors) {
        this.cleanupOldErrors();
      }
    }

    return errorId;
  }

  // Capture API errors specifically
  captureApiError(
    error: Error, 
    endpoint: string, 
    method: string = 'GET',
    statusCode?: number,
    responseData?: any
  ): string {
    return this.captureError(error, {
      action: 'api_error',
      component: 'api_client',
      metadata: {
        endpoint,
        method,
        statusCode,
        responseData: getFeatureFlag('VERBOSE_LOGS') ? responseData : undefined
      }
    }, statusCode && statusCode >= 500 ? 'high' : 'medium');
  }

  // Capture component errors
  captureComponentError(
    error: Error,
    componentName: string,
    props?: any,
    action?: string
  ): string {
    return this.captureError(error, {
      action: action || 'component_error',
      component: componentName,
      metadata: {
        props: getFeatureFlag('VERBOSE_LOGS') ? props : undefined
      }
    }, 'medium');
  }

  // Get error statistics
  getErrorStats(): {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    unresolved: number;
    recentErrors: ErrorReport[];
  } {
    const errors = Array.from(this.errors.values());
    const now = Date.now();
    const last24Hours = now - (24 * 60 * 60 * 1000);

    return {
      total: errors.length,
      critical: errors.filter(e => e.severity === 'critical').length,
      high: errors.filter(e => e.severity === 'high').length,
      medium: errors.filter(e => e.severity === 'medium').length,
      low: errors.filter(e => e.severity === 'low').length,
      unresolved: errors.filter(e => !e.resolved).length,
      recentErrors: errors
        .filter(e => new Date(e.lastOccurred).getTime() > last24Hours)
        .sort((a, b) => new Date(b.lastOccurred).getTime() - new Date(a.lastOccurred).getTime())
        .slice(0, 10)
    };
  }

  // Get specific error by ID
  getError(errorId: string): ErrorReport | undefined {
    return this.errors.get(errorId);
  }

  // Mark error as resolved
  resolveError(errorId: string): boolean {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolved = true;
      logger.info(`✅ Error resolved: ${errorId}`);
      return true;
    }
    return false;
  }

  // Clear all errors
  clearErrors(): void {
    const count = this.errors.size;
    this.errors.clear();
    logger.info(`🧹 Cleared ${count} error reports`);
  }

  // Export errors for debugging
  exportErrors(): ErrorReport[] {
    return Array.from(this.errors.values()).sort(
      (a, b) => new Date(b.lastOccurred).getTime() - new Date(a.lastOccurred).getTime()
    );
  }

  private generateErrorId(message: string, stack?: string): string {
    const content = `${message}${stack || ''}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `err_${Math.abs(hash).toString(36)}`;
  }

  private cleanupOldErrors(): void {
    const errors = Array.from(this.errors.entries());
    // Sort by last occurred date and remove the oldest 20%
    errors.sort(([, a], [, b]) => 
      new Date(a.lastOccurred).getTime() - new Date(b.lastOccurred).getTime()
    );
    
    const toRemove = errors.slice(0, Math.floor(errors.length * 0.2));
    toRemove.forEach(([id]) => this.errors.delete(id));
    
    logger.debug(`🧹 Cleaned up ${toRemove.length} old error reports`);
  }
}

export const errorMonitoring = new ErrorMonitoring();

// React Error Boundary helper
export class ErrorBoundary extends Error {
  constructor(
    public componentStack: string,
    public errorBoundary: string,
    originalError: Error
  ) {
    super(originalError.message);
    this.name = 'ErrorBoundary';
    this.stack = originalError.stack;
  }
}

// Helper function for async error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: ErrorContext,
  severity?: ErrorReport['severity']
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    errorMonitoring.captureError(
      error instanceof Error ? error : new Error(String(error)),
      context,
      severity
    );
    return null;
  }
}

// Performance monitoring integration
export function monitorPerformance(
  name: string,
  fn: () => void | Promise<void>
): void | Promise<void> {
  const startTime = performance.now();
  
  try {
    const result = fn();
    
    if (result instanceof Promise) {
      return result
        .then((value) => {
          const duration = performance.now() - startTime;
          logger.performance(`Performance: ${name}`, startTime, { duration });
          return value;
        })
        .catch((error) => {
          const duration = performance.now() - startTime;
          errorMonitoring.captureError(error, {
            action: 'performance_monitoring',
            metadata: { operation: name, duration }
          });
          throw error;
        });
    } else {
      const duration = performance.now() - startTime;
      logger.performance(`Performance: ${name}`, startTime, { duration });
      return result;
    }
  } catch (error) {
    const duration = performance.now() - startTime;
    errorMonitoring.captureError(
      error instanceof Error ? error : new Error(String(error)),
      {
        action: 'performance_monitoring',
        metadata: { operation: name, duration }
      }
    );
    throw error;
  }
}