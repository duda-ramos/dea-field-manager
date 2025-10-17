// Database refresh utility for development
import { db } from '@/db/indexedDb';

export async function refreshDatabase() {
  try {
    // Close the database connection
    db.close();
    
    // Delete the database to force recreation with new schema
    await db.delete();
    
    // Reopen with new schema
    await db.open();
    
    return true;
  } catch {
    return false;
  }
}

// Add to window for debugging in development
if (import.meta.env.DEV) {
  (window as any).refreshDatabase = refreshDatabase;
}