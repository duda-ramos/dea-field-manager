// Auto-sync preferences management
export interface SyncPreferences {
  autoPullOnStart: boolean;
  autoPushOnExit: boolean;
  periodicPullEnabled: boolean;
  periodicPullInterval: number; // minutes
  realtimeEnabled?: boolean; // Feature flag for realtime sync (default: false)
}

const DEFAULT_PREFERENCES: SyncPreferences = {
  autoPullOnStart: true,
  autoPushOnExit: true,
  periodicPullEnabled: false,
  periodicPullInterval: 5,
  realtimeEnabled: false
};

const STORAGE_KEY = 'sync_preferences';

export function getSyncPreferences(): SyncPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error loading sync preferences:', error);
  }
  return DEFAULT_PREFERENCES;
}

export function setSyncPreferences(preferences: Partial<SyncPreferences>): void {
  try {
    const current = getSyncPreferences();
    const updated = { ...current, ...preferences };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving sync preferences:', error);
  }
}

export function updateSyncPreference<K extends keyof SyncPreferences>(
  key: K, 
  value: SyncPreferences[K]
): void {
  setSyncPreferences({ [key]: value });
}