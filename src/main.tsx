import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { migrateLocalToIndexedIfNeeded } from '@/migrations/migrateLocalToIndexed'
import { db } from '@/db/indexedDb'
import { autoSyncManager } from '@/services/sync/autoSync'

// Debug helper (somente em DEV)
if (import.meta.env.DEV) {
  (window as any).__db = db;
  
  // Gravação de teste para garantir criação do banco
  db.projects.count().then(count => {
    if (count === 0) {
      console.log('Initializing IndexedDB for development...');
    }
  }).catch(console.error);
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
