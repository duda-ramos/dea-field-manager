import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { migrateLocalToIndexedIfNeeded } from '@/migrations/migrateLocalToIndexed'
import { db } from '@/db/indexedDb'

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

migrateLocalToIndexedIfNeeded().catch(console.error)
createRoot(document.getElementById("root")!).render(<App />);
