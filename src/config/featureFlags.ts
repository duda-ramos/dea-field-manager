/**
 * Feature flags for production readiness
 */

// Environment detection
const isDev = window.location.hostname === 'localhost' || window.location.hostname.includes('sandbox');
const isProd = !isDev;

export const FeatureFlags = {
  // Auto-sync behavior
  AUTO_PULL_ON_BOOT: true,
  AUTO_PUSH_ON_PAGE_HIDE: true, // Modern replacement for unload events
  AUTO_SYNC_PERIODIC: isDev, // Only in dev by default
  
  // Logging levels
  VERBOSE_LOGS: isDev,
  CONSOLE_LOGS: isDev,
  PERFORMANCE_LOGS: isDev,
  
  // UI features
  SYNC_STATUS_PANEL: true,
  SYNC_METRICS_DISPLAY: isDev, // Detailed metrics only in dev
  
  // Development/QA features
  QA_MODE: isDev,
  DEBUG_SYNC: isDev,
  FORCE_OFFLINE_MODE: false, // For testing
  
  // Performance settings
  SYNC_BATCH_SIZE: 500,
  SYNC_TIMEOUT_MS: 30000,
  RATE_LIMIT_CALLS_PER_MINUTE: isProd ? 10 : 60, // Stricter in prod
  
  // Error handling
  MAX_RETRY_ATTEMPTS: 5,
  RETRY_BACKOFF_MS: 500,
} as const;

export type FeatureFlagKey = keyof typeof FeatureFlags;

/**
 * Get feature flag value with environment override
 */
export function getFeatureFlag(key: FeatureFlagKey): boolean | number {
  // Check for environment variable override
  const envKey = `VITE_FF_${key}`;
  const envValue = import.meta.env[envKey];
  
  if (envValue !== undefined) {
    // Parse boolean or number from env
    if (envValue === 'true') return true;
    if (envValue === 'false') return false;
    const numValue = Number(envValue);
    if (!isNaN(numValue)) return numValue;
  }
  
  return FeatureFlags[key];
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return isDev;
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return isProd;
}

/**
 * Get environment-appropriate log level
 */
export function getLogLevel(): 'verbose' | 'normal' | 'minimal' {
  if (getFeatureFlag('VERBOSE_LOGS')) return 'verbose';
  if (getFeatureFlag('CONSOLE_LOGS')) return 'normal';
  return 'minimal';
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): { valid: boolean; missing: string[] } {
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];
  
  const missing = required.filter(key => !import.meta.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    return { valid: false, missing };
  }
  
  return { valid: true, missing: [] };
}