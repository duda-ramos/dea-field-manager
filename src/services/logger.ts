import { getLogLevel, getFeatureFlag } from '@/config/featureFlags';

type LogLevel = 'verbose' | 'normal' | 'minimal';
type LogType = 'info' | 'warn' | 'error' | 'debug' | 'performance';

interface LogEntry {
  timestamp: string;
  level: LogType;
  message: string;
  data?: Record<string, unknown>;
  duration?: number;
}

class Logger {
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  constructor() {
    this.logLevel = getLogLevel();
  }

  private shouldLog(type: LogType): boolean {
    switch (this.logLevel) {
      case 'verbose':
        return true;
      case 'normal':
        return ['info', 'warn', 'error'].includes(type);
      case 'minimal':
        return ['error'].includes(type);
      default:
        return false;
    }
  }

  private formatMessage(message: string, data?: Record<string, unknown>): string {
    if (this.logLevel === 'minimal') {
      // Single line format for production
      return data ? `${message} ${JSON.stringify(data)}` : message;
    }
    return message;
  }

  private log(type: LogType, message: string, data?: Record<string, unknown>, duration?: number) {
    if (!this.shouldLog(type)) return;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: type,
      message: this.formatMessage(message, data),
      data: this.logLevel === 'verbose' ? data : undefined,
      duration
    };

    // Store log entry
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output based on environment
    if (getFeatureFlag('CONSOLE_LOGS')) {
      const emoji = this.getLogEmoji(type);
      const durationStr = duration ? ` (${duration}ms)` : '';
      
      switch (type) {
        case 'error':
          // Keep error console logging for critical issues
          console.error(`${emoji} ${message}${durationStr}`, data || '');
          break;
        case 'warn':
          // Keep warning console logging for important issues
          console.warn(`${emoji} ${message}${durationStr}`, data || '');
          break;
        case 'debug':
          // Debug logging only in development
          if (import.meta.env.DEV) {
            console.debug(`${emoji} ${message}${durationStr}`, data || '');
          }
          break;
        default:
          // Info logging only in development
          if (import.meta.env.DEV) {
            console.log(`${emoji} ${message}${durationStr}`, data || '');
          }
      }
    }
  }

  private getLogEmoji(type: LogType): string {
    const emojis = {
      info: '📋',
      warn: '⚠️',
      error: '❌',
      debug: '🐛',
      performance: '⏱️'
    };
    return emojis[type] || '📋';
  }

  info(message: string, data?: Record<string, unknown>) {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.log('error', message, data);
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.log('debug', message, data);
  }

  performance(message: string, startTime: number, data?: Record<string, unknown>) {
    const duration = Date.now() - startTime;
    this.log('performance', message, data, duration);
  }

  // Sync-specific logging methods
  syncStart(operation: 'push' | 'pull' | 'full') {
    this.info(`🚀 Starting ${operation} sync...`);
    return Date.now();
  }

  syncComplete(operation: 'push' | 'pull' | 'full', startTime: number, metrics: Record<string, unknown>) {
    const duration = Date.now() - startTime;
    
    if (this.logLevel === 'minimal') {
      // Production: single line summary
      const summary = `${operation}: ${metrics.success ? 'OK' : 'FAIL'} ${duration}ms`;
      this.info(summary, {
        pushed: metrics.push?.total || 0,
        pulled: metrics.pull?.total || 0,
        errors: metrics.errors?.length || 0
      });
    } else {
      // Development: detailed logging
      this.performance(`✅ ${operation} sync completed`, startTime, metrics);
    }
  }

  syncError(operation: string, error: Error, context?: Record<string, unknown>) {
    const errorData = {
      operation,
      message: error.message,
      stack: getFeatureFlag('VERBOSE_LOGS') ? error.stack : undefined,
      context
    };
    
    this.error(`Sync ${operation} failed: ${error.message}`, errorData);
  }

  // Rate limiting logs
  rateLimitHit(operation: string, retryAfter: number) {
    this.warn(`🚦 Rate limit hit for ${operation}, retry in ${retryAfter}ms`);
  }

  // Get recent logs for debugging
  getRecentLogs(count = 20): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
  }

  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = new Logger();