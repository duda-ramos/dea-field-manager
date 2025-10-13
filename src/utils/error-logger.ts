/**
 * Error Logger Utility
 * 
 * Sistema de logging de erros que:
 * - Registra no console em desenvolvimento
 * - Armazena em localStorage (últimos 50 erros)
 * - Adiciona timestamp, contexto e stack trace
 */

const ERROR_LOG_KEY = 'dea_error_logs';
const MAX_LOGS = 50;

export interface ErrorLog {
  id: string;
  timestamp: string;
  error: {
    message: string;
    name: string;
    stack?: string;
  };
  context?: Record<string, any>;
  userAgent: string;
  url: string;
}

/**
 * Registra um erro no sistema de logging
 * @param error - O erro capturado
 * @param context - Contexto adicional sobre o erro
 */
export function logError(error: Error | unknown, context?: Record<string, any>): void {
  const errorLog = createErrorLog(error, context);
  
  // Log no console em desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    console.group('🔴 Error Logged');
    console.error('Error:', error);
    console.log('Context:', context);
    console.log('Timestamp:', errorLog.timestamp);
    console.log('Stack:', errorLog.error.stack);
    console.groupEnd();
  }
  
  // Salvar no localStorage
  saveErrorToLocalStorage(errorLog);
}

/**
 * Cria um objeto de log estruturado
 */
function createErrorLog(error: Error | unknown, context?: Record<string, any>): ErrorLog {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    error: {
      message: errorObj.message,
      name: errorObj.name,
      stack: errorObj.stack,
    },
    context,
    userAgent: navigator.userAgent,
    url: window.location.href,
  };
}

/**
 * Salva o erro no localStorage
 */
function saveErrorToLocalStorage(errorLog: ErrorLog): void {
  try {
    const existingLogs = getErrorLogs();
    const updatedLogs = [errorLog, ...existingLogs].slice(0, MAX_LOGS);
    
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(updatedLogs));
  } catch (e) {
    // Se falhar ao salvar (ex: localStorage cheio), limpar logs antigos
    console.warn('Failed to save error log, clearing old logs:', e);
    try {
      localStorage.setItem(ERROR_LOG_KEY, JSON.stringify([errorLog]));
    } catch (e) {
      console.error('Failed to save error log even after clearing:', e);
    }
  }
}

/**
 * Recupera todos os logs de erro do localStorage
 */
export function getErrorLogs(): ErrorLog[] {
  try {
    const logs = localStorage.getItem(ERROR_LOG_KEY);
    return logs ? JSON.parse(logs) : [];
  } catch (e) {
    console.error('Failed to retrieve error logs:', e);
    return [];
  }
}

/**
 * Limpa todos os logs de erro do localStorage
 */
export function clearErrorLogs(): void {
  try {
    localStorage.removeItem(ERROR_LOG_KEY);
  } catch (e) {
    console.error('Failed to clear error logs:', e);
  }
}

/**
 * Exporta os logs como JSON
 */
export function exportErrorLogsAsJSON(): string {
  const logs = getErrorLogs();
  return JSON.stringify(logs, null, 2);
}

/**
 * Baixa os logs como arquivo JSON
 */
export function downloadErrorLogs(): void {
  const logs = exportErrorLogsAsJSON();
  const blob = new Blob([logs], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = `error-logs-${new Date().toISOString()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Gera um ID único para o log
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Obtém estatísticas dos logs
 */
export function getErrorStats(): {
  total: number;
  byType: Record<string, number>;
  last24Hours: number;
} {
  const logs = getErrorLogs();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const byType: Record<string, number> = {};
  let last24Hours = 0;
  
  logs.forEach(log => {
    // Contar por tipo
    const type = log.error.name || 'Unknown';
    byType[type] = (byType[type] || 0) + 1;
    
    // Contar últimas 24h
    const logDate = new Date(log.timestamp);
    if (logDate >= twentyFourHoursAgo) {
      last24Hours++;
    }
  });
  
  return {
    total: logs.length,
    byType,
    last24Hours,
  };
}
