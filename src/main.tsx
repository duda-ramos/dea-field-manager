import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { migrateLocalToIndexedIfNeeded } from '@/migrations/migrateLocalToIndexed'
import { db } from '@/db/indexedDb'
import { autoSyncManager } from '@/services/sync/autoSync'
import { logger } from '@/services/logger'
import { refreshDatabase } from '@/lib/dbRefresh'

// Debug helper (somente em DEV)
if (import.meta.env.DEV) {
  (window as any).__db = db;
  (window as any).refreshDatabase = refreshDatabase;
  
  // Initialize IndexedDB for development
  db.projects.count().then(count => {
    if (count === 0) {
      logger.info('Initializing IndexedDB for development...');
    }
  }).catch(error => {
    logger.error('IndexedDB initialization failed:', error);
    // Try to refresh database on error
    refreshDatabase().then(() => {
      logger.info('Database refreshed after error');
    });
  });
}

// Initialize app
async function initializeApp() {
  try {
    // Run migration first
    await migrateLocalToIndexedIfNeeded();
    
    // Initialize auto-sync after migration
    await autoSyncManager.initialize();
    
    // Render app
    createRoot(document.getElementById("root")!).render(<App />);
  } catch (error) {
    console.error('Failed to initialize app:', error);
    // Render app anyway
    createRoot(document.getElementById("root")!).render(<App />);
  }
}

initializeApp();
