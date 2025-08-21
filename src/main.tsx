import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { migrateLocalToIndexedIfNeeded } from '@/migrations/migrateLocalToIndexed'

migrateLocalToIndexedIfNeeded().catch(console.error)
createRoot(document.getElementById("root")!).render(<App />);
