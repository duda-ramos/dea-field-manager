import { supabase } from '@/integrations/supabase/client';
import { db } from '@/db/indexedDb';
import { getLastPulledAt, setLastPulledAt, setSyncStatus } from './localFlags';
import { withRetry, createBatches, createEmptyMetrics, logSyncMetrics, type SyncMetrics } from './utils';
import { syncStateManager } from './syncState';
import { fileSyncService } from './fileSync';
import { rateLimiter } from './rateLimiter';
import { logger } from '@/services/logger';
import { getFeatureFlag } from '@/config/featureFlags';
import type { Project, Installation, ProjectContact, ProjectBudget, ItemVersion, ProjectFile } from '@/types';

const BATCH_SIZE = getFeatureFlag('SYNC_BATCH_SIZE') as number;
const PULL_PAGE_SIZE = 1000;

// Timestamp normalization helpers
const normalizeTimestamps = (obj: any) => ({
  ...obj,
  created_at: obj.createdAt || obj.created_at,
  updated_at: obj.updatedAt || obj.updated_at
});

const denormalizeTimestamps = (obj: any) => ({
  ...obj,
  createdAt: obj.created_at,
  updatedAt: obj.updated_at ? new Date(obj.updated_at).getTime() : Date.now()
});

// Push operations with batching
async function pushProjects(metrics: SyncMetrics, user: any): Promise<void> {
  const dirtyProjects = await db.projects.where('_dirty').equals(1).toArray();
  if (dirtyProjects.length === 0) return;

  console.log(`📤 Pushing ${dirtyProjects.length} projects...`);
  const batches = createBatches(dirtyProjects, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    syncStateManager.setProgress(i + 1, batches.length, 'Enviando projetos');

    await withRetry(async () => {
      const operations = batch.map(async (project) => {
        try {
          if (project._deleted) {
            await supabase.from('projects').delete().eq('id', project.id);
            metrics.deleted.projects++;
          } else {
            const normalizedProject = normalizeTimestamps({
              ...project,
              user_id: user.id,
              owner_name: project.owner,
              suppliers: project.suppliers || []
            });
            delete normalizedProject._dirty;
            delete normalizedProject._deleted;
            delete normalizedProject.owner;
            delete normalizedProject.updatedAt;
            delete normalizedProject.createdAt;
            
            await supabase.from('projects').upsert(normalizedProject);
            metrics.pushed.projects++;
          }
          
          // Clear dirty flag
          if (project._deleted) {
            await db.projects.delete(project.id);
          } else {
            await db.projects.update(project.id, { _dirty: 0 });
          }
        } catch (error) {
          metrics.errors.push({
            operation: `push_project_${project.id}`,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now()
          });
          throw error;
        }
      });

      await Promise.all(operations);
    });
  }
}

async function pushInstallations(metrics: SyncMetrics, user: any): Promise<void> {
  const dirtyInstallations = await db.installations.where('_dirty').equals(1).toArray();
  if (dirtyInstallations.length === 0) return;

  console.log(`📤 Pushing ${dirtyInstallations.length} installations...`);
  const batches = createBatches(dirtyInstallations, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    syncStateManager.setProgress(i + 1, batches.length, 'Enviando instalações');

    await withRetry(async () => {
      const operations = batch.map(async (installation) => {
        try {
          if (installation._deleted) {
            await supabase.from('installations').delete().eq('id', installation.id);
            metrics.deleted.installations++;
          } else {
            const normalizedInstallation = normalizeTimestamps({
              ...installation,
              user_id: user.id,
              photos: installation.photos || []
            });
            delete normalizedInstallation._dirty;
            delete normalizedInstallation._deleted;
            delete normalizedInstallation.updatedAt;
            delete normalizedInstallation.createdAt;
            
            await supabase.from('installations').upsert(normalizedInstallation);
            metrics.pushed.installations++;
          }
          
          if (installation._deleted) {
            await db.installations.delete(installation.id);
          } else {
            await db.installations.update(installation.id, { _dirty: 0 });
          }
        } catch (error) {
          metrics.errors.push({
            operation: `push_installation_${installation.id}`,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now()
          });
          throw error;
        }
      });

      await Promise.all(operations);
    });
  }
}

async function pushContacts(metrics: SyncMetrics, user: any): Promise<void> {
  const dirtyContacts = await db.contacts.where('_dirty').equals(1).toArray();
  if (dirtyContacts.length === 0) return;

  console.log(`📤 Pushing ${dirtyContacts.length} contacts...`);
  const batches = createBatches(dirtyContacts, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    syncStateManager.setProgress(i + 1, batches.length, 'Enviando contatos');

    await withRetry(async () => {
      const operations = batch.map(async (contact) => {
        try {
          if (contact._deleted) {
            await supabase.from('contacts').delete().eq('id', contact.id);
            metrics.deleted.contacts++;
          } else {
            const normalizedContact = normalizeTimestamps({
              id: contact.id,
              project_id: contact.projetoId,
              name: contact.nome,
              role: contact.tipo,
              phone: contact.telefone,
              email: contact.email,
              user_id: user.id
            });
            delete normalizedContact._dirty;
            delete normalizedContact._deleted;
            
            await supabase.from('contacts').upsert(normalizedContact);
            metrics.pushed.contacts++;
          }
          
          if (contact._deleted) {
            await db.contacts.delete(contact.id);
          } else {
            await db.contacts.update(contact.id, { _dirty: 0 });
          }
        } catch (error) {
          metrics.errors.push({
            operation: `push_contact_${contact.id}`,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now()
          });
          throw error;
        }
      });

      await Promise.all(operations);
    });
  }
}

async function pushBudgets(metrics: SyncMetrics, user: any): Promise<void> {
  const dirtyBudgets = await db.budgets.where('_dirty').equals(1).toArray();
  if (dirtyBudgets.length === 0) return;

  console.log(`📤 Pushing ${dirtyBudgets.length} budgets...`);
  const batches = createBatches(dirtyBudgets, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    syncStateManager.setProgress(i + 1, batches.length, 'Enviando orçamentos');

    await withRetry(async () => {
      const operations = batch.map(async (budget) => {
        try {
          if (budget._deleted) {
            await supabase.from('budgets').delete().eq('id', budget.id);
            metrics.deleted.budgets++;
          } else {
            const normalizedBudget = normalizeTimestamps({
              ...budget,
              user_id: user.id,
              project_id: budget.projectId
            });
            delete normalizedBudget._dirty;
            delete normalizedBudget._deleted;
            delete normalizedBudget.projectId;
            delete normalizedBudget.updatedAt;
            delete normalizedBudget.createdAt;
            
            await supabase.from('budgets').upsert(normalizedBudget);
            metrics.pushed.budgets++;
          }
          
          if (budget._deleted) {
            await db.budgets.delete(budget.id);
          } else {
            await db.budgets.update(budget.id, { _dirty: 0 });
          }
        } catch (error) {
          metrics.errors.push({
            operation: `push_budget_${budget.id}`,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now()
          });
          throw error;
        }
      });

      await Promise.all(operations);
    });
  }
}

async function pushItemVersions(metrics: SyncMetrics, user: any): Promise<void> {
  const dirtyItemVersions = await db.itemVersions.where('_dirty').equals(1).toArray();
  if (dirtyItemVersions.length === 0) return;

  console.log(`📤 Pushing ${dirtyItemVersions.length} item versions...`);
  const batches = createBatches(dirtyItemVersions, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    syncStateManager.setProgress(i + 1, batches.length, 'Enviando versões');

    await withRetry(async () => {
      const operations = batch.map(async (itemVersion) => {
        try {
          if (itemVersion._deleted) {
            await supabase.from('item_versions').delete().eq('id', itemVersion.id);
            metrics.deleted.itemVersions++;
          } else {
            const normalizedItemVersion = normalizeTimestamps({
              id: itemVersion.id,
              installation_id: itemVersion.itemId,
              snapshot: itemVersion.snapshot,
              revisao: itemVersion.revisao,
              motivo: itemVersion.motivo,
              descricao_motivo: itemVersion.descricao_motivo,
              user_id: user.id
            });
            delete normalizedItemVersion._dirty;
            delete normalizedItemVersion._deleted;
            delete normalizedItemVersion.updatedAt;
            delete normalizedItemVersion.createdAt;
            
            await supabase.from('item_versions').upsert(normalizedItemVersion);
            metrics.pushed.itemVersions++;
          }
          
          if (itemVersion._deleted) {
            await db.itemVersions.delete(itemVersion.id);
          } else {
            await db.itemVersions.update(itemVersion.id, { _dirty: 0 });
          }
        } catch (error) {
          metrics.errors.push({
            operation: `push_itemversion_${itemVersion.id}`,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now()
          });
          throw error;
        }
      });

      await Promise.all(operations);
    });
  }
}

async function pushFiles(metrics: SyncMetrics, user: any): Promise<void> {
  const dirtyFiles = await db.files.where('_dirty').equals(1).toArray();
  if (dirtyFiles.length === 0) return;

  console.log(`📤 Pushing ${dirtyFiles.length} files...`);
  const batches = createBatches(dirtyFiles, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    syncStateManager.setProgress(i + 1, batches.length, 'Enviando arquivos');

    await withRetry(async () => {
      const operations = batch.map(async (file) => {
        try {
          if (file._deleted) {
            await supabase.from('files').delete().eq('id', file.id);
            metrics.deleted.files++;
          } else {
            const normalizedFile = normalizeTimestamps({
              ...file,
              user_id: user.id,
              project_id: file.projectId,
              installation_id: file.installationId
            });
            delete normalizedFile._dirty;
            delete normalizedFile._deleted;
            delete normalizedFile.projectId;
            delete normalizedFile.installationId;
            delete normalizedFile.updatedAt;
            delete normalizedFile.createdAt;
            
            await supabase.from('files').upsert(normalizedFile);
            metrics.pushed.files++;
          }
          
          if (file._deleted) {
            await db.files.delete(file.id);
          } else {
            await db.files.update(file.id, { _dirty: 0 });
          }
        } catch (error) {
          metrics.errors.push({
            operation: `push_file_${file.id}`,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now()
          });
          throw error;
        }
      });

      await Promise.all(operations);
    });
  }
}

// Pull operations with pagination
async function pullProjects(metrics: SyncMetrics, user: any, lastPulledAt: number): Promise<void> {
  let hasMore = true;
  let page = 0;
  const lastPulledDate = new Date(lastPulledAt).toISOString();

  while (hasMore) {
    const { data: projects, error } = await withRetry(async () => {
      return await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .gt('updated_at', lastPulledDate)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(page * PULL_PAGE_SIZE, (page + 1) * PULL_PAGE_SIZE - 1);
    });

    if (error) throw error;

    if (projects && projects.length > 0) {
      console.log(`📥 Pulling ${projects.length} projects (page ${page + 1})...`);
      
      for (const project of projects) {
        const localProject = denormalizeTimestamps({
          ...project,
          owner: project.owner_name,
          _dirty: 0,
          _deleted: 0
        });
        delete localProject.owner_name;
        delete localProject.user_id;
        
        await db.projects.put(localProject);
        metrics.pulled.projects++;
      }

      hasMore = projects.length === PULL_PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }
}

async function pullInstallations(metrics: SyncMetrics, user: any, lastPulledAt: number): Promise<void> {
  let hasMore = true;
  let page = 0;
  const lastPulledDate = new Date(lastPulledAt).toISOString();

  while (hasMore) {
    const { data: installations, error } = await withRetry(async () => {
      return await supabase
        .from('installations')
        .select('*')
        .eq('user_id', user.id)
        .gt('updated_at', lastPulledDate)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(page * PULL_PAGE_SIZE, (page + 1) * PULL_PAGE_SIZE - 1);
    });

    if (error) throw error;

    if (installations && installations.length > 0) {
      console.log(`📥 Pulling ${installations.length} installations (page ${page + 1})...`);
      
      for (const installation of installations) {
        const localInstallation = denormalizeTimestamps({
          ...installation,
          _dirty: 0,
          _deleted: 0
        });
        delete localInstallation.user_id;
        
        await db.installations.put(localInstallation);
        metrics.pulled.installations++;
      }

      hasMore = installations.length === PULL_PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }
}

async function pullContacts(metrics: SyncMetrics, user: any, lastPulledAt: number): Promise<void> {
  let hasMore = true;
  let page = 0;
  const lastPulledDate = new Date(lastPulledAt).toISOString();

  while (hasMore) {
    const { data: contacts, error } = await withRetry(async () => {
      return await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .gt('updated_at', lastPulledDate)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(page * PULL_PAGE_SIZE, (page + 1) * PULL_PAGE_SIZE - 1);
    });

    if (error) throw error;

    if (contacts && contacts.length > 0) {
      console.log(`📥 Pulling ${contacts.length} contacts (page ${page + 1})...`);
      
      for (const contact of contacts) {
        const localContact = denormalizeTimestamps({
          id: contact.id,
          projetoId: contact.project_id,
          nome: contact.name,
          tipo: contact.role,
          telefone: contact.phone,
          email: contact.email,
          atualizadoEm: contact.updated_at,
          _dirty: 0,
          _deleted: 0
        });
        
        await db.contacts.put(localContact);
        metrics.pulled.contacts++;
      }

      hasMore = contacts.length === PULL_PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }
}

async function pullBudgets(metrics: SyncMetrics, user: any, lastPulledAt: number): Promise<void> {
  let hasMore = true;
  let page = 0;
  const lastPulledDate = new Date(lastPulledAt).toISOString();

  while (hasMore) {
    const { data: budgets, error } = await withRetry(async () => {
      return await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .gt('updated_at', lastPulledDate)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(page * PULL_PAGE_SIZE, (page + 1) * PULL_PAGE_SIZE - 1);
    });

    if (error) throw error;

    if (budgets && budgets.length > 0) {
      console.log(`📥 Pulling ${budgets.length} budgets (page ${page + 1})...`);
      
      for (const budget of budgets) {
        const localBudget = denormalizeTimestamps({
          ...budget,
          projectId: budget.project_id,
          _dirty: 0,
          _deleted: 0
        });
        delete localBudget.project_id;
        delete localBudget.user_id;
        
        await db.budgets.put(localBudget);
        metrics.pulled.budgets++;
      }

      hasMore = budgets.length === PULL_PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }
}

async function pullItemVersions(metrics: SyncMetrics, user: any, lastPulledAt: number): Promise<void> {
  let hasMore = true;
  let page = 0;
  const lastPulledDate = new Date(lastPulledAt).toISOString();

  while (hasMore) {
    const { data: itemVersions, error } = await withRetry(async () => {
      return await supabase
        .from('item_versions')
        .select('*')
        .eq('user_id', user.id)
        .gt('updated_at', lastPulledDate)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(page * PULL_PAGE_SIZE, (page + 1) * PULL_PAGE_SIZE - 1);
    });

    if (error) throw error;

    if (itemVersions && itemVersions.length > 0) {
      console.log(`📥 Pulling ${itemVersions.length} item versions (page ${page + 1})...`);
      
      for (const itemVersion of itemVersions) {
        const localItemVersion = denormalizeTimestamps({
          id: itemVersion.id,
          itemId: itemVersion.installation_id,
          snapshot: itemVersion.snapshot,
          revisao: itemVersion.revisao,
          motivo: itemVersion.motivo,
          descricao_motivo: itemVersion.descricao_motivo,
          criadoEm: itemVersion.created_at,
          _dirty: 0,
          _deleted: 0
        });
        
        await db.itemVersions.put(localItemVersion);
        metrics.pulled.itemVersions++;
      }

      hasMore = itemVersions.length === PULL_PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }
}

async function pullFiles(metrics: SyncMetrics, user: any, lastPulledAt: number): Promise<void> {
  let hasMore = true;
  let page = 0;
  const lastPulledDate = new Date(lastPulledAt).toISOString();

  while (hasMore) {
    const { data: files, error } = await withRetry(async () => {
      return await supabase
        .from('files')
        .select('*')
        .eq('user_id', user.id)
        .gt('updated_at', lastPulledDate)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(page * PULL_PAGE_SIZE, (page + 1) * PULL_PAGE_SIZE - 1);
    });

    if (error) throw error;

    if (files && files.length > 0) {
      console.log(`📥 Pulling ${files.length} files (page ${page + 1})...`);
      
      for (const file of files) {
        const localFile = denormalizeTimestamps({
          ...file,
          projectId: file.project_id,
          installationId: file.installation_id,
          uploaded_at: file.created_at,
          _dirty: 0,
          _deleted: 0
        });
        delete localFile.project_id;
        delete localFile.installation_id;
        delete localFile.user_id;
        
        await db.files.put(localFile);
        metrics.pulled.files++;
      }

      hasMore = files.length === PULL_PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }
}

// Main sync functions
export async function syncPush(): Promise<SyncMetrics> {
  const metrics = createEmptyMetrics();
  console.log('🚀 Starting push sync...');
  
  syncStateManager.setSyncing('push');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    await pushProjects(metrics, user);
    await pushInstallations(metrics, user);
    await pushContacts(metrics, user);
    await pushBudgets(metrics, user);
    await pushItemVersions(metrics, user);
    await pushFiles(metrics, user);
    
    console.log('✅ Push sync completed');
    return metrics;
  } catch (error) {
    console.error('❌ Push sync failed:', error);
    throw error;
  }
}

export async function syncPull(): Promise<SyncMetrics> {
  const metrics = createEmptyMetrics();
  console.log('🚀 Starting pull sync...');
  
  syncStateManager.setSyncing('pull');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const lastPulledAt = await getLastPulledAt();

  try {
    await pullProjects(metrics, user, lastPulledAt);
    await pullInstallations(metrics, user, lastPulledAt);
    await pullContacts(metrics, user, lastPulledAt);
    await pullBudgets(metrics, user, lastPulledAt);
    await pullItemVersions(metrics, user, lastPulledAt);
    await pullFiles(metrics, user, lastPulledAt);
    
    // Update last pulled timestamp
    await setLastPulledAt(Date.now());
    console.log('✅ Pull sync completed');
    return metrics;
  } catch (error) {
    console.error('❌ Pull sync failed:', error);
    throw error;
  }
}

// Full sync operation
export async function fullSync(): Promise<{ pushMetrics: SyncMetrics; pullMetrics: SyncMetrics }> {
  console.log('🔄 Starting full sync...');
  
  syncStateManager.setSyncing('full');
  
  try {
    if (!navigator.onLine) {
      throw new Error('Sem conexão com a internet. Conecte-se para sincronizar.');
    }

    syncStateManager.clearProgress();
    const pushMetrics = await syncPush();
    const pullMetrics = await syncPull();
    
    const totalMetrics: SyncMetrics = {
      startTime: Math.min(pushMetrics.startTime, pullMetrics.startTime),
      endTime: Date.now(),
      totalDuration: Date.now() - Math.min(pushMetrics.startTime, pullMetrics.startTime),
      pushed: pushMetrics.pushed,
      pulled: pullMetrics.pulled,
      deleted: pushMetrics.deleted,
      errors: [...pushMetrics.errors, ...pullMetrics.errors]
    };

    logSyncMetrics(totalMetrics);
    console.log('✅ Full sync completed successfully');
    
    syncStateManager.setIdle({
      tablesProcessed: {
        projects: pushMetrics.pushed.projects + pullMetrics.pulled.projects,
        installations: pushMetrics.pushed.installations + pullMetrics.pulled.installations,
        contacts: pushMetrics.pushed.contacts + pullMetrics.pulled.contacts,
        budgets: pushMetrics.pushed.budgets + pullMetrics.pulled.budgets,
        itemVersions: pushMetrics.pushed.itemVersions + pullMetrics.pulled.itemVersions,
        files: pushMetrics.pushed.files + pullMetrics.pulled.files
      }
    });
    
    return { pushMetrics, pullMetrics };
  } catch (error) {
    console.error('❌ Full sync failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido durante a sincronização';
    syncStateManager.setError(errorMessage);
    throw error;
  } finally {
    syncStateManager.clearProgress();
  }
}