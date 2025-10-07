import { db } from '@/db/indexedDb';
import type { Project, Installation, ProjectContact, ProjectBudget, ItemVersion, ProjectFile } from '@/types';
import { autoSyncManager } from '@/services/sync/autoSync';
import { supabase } from '@/integrations/supabase/client';
import { syncStateManager } from '@/services/sync/syncState';

const now = () => Date.now();

// Verificar se está online
const isOnline = () => navigator.onLine;

// Fila de sincronização para operações offline
const syncQueue: Array<{ type: string; data: any }> = [];

// Sincronizar item imediatamente se online
async function syncToServerImmediate(entityType: string, data: any) {
  if (!isOnline()) {
    syncQueue.push({ type: entityType, data });
    return;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    syncStateManager.updateState({ status: 'syncing' });

    switch (entityType) {
      case 'project':
        await supabase.from('projects').upsert(transformProjectForSupabase(data, user.id));
        break;
      case 'installation':
        await supabase.from('installations').upsert(transformInstallationForSupabase(data, user.id));
        break;
      case 'contact':
        await supabase.from('contacts').upsert(transformContactForSupabase(data, user.id));
        break;
      case 'budget':
        await supabase.from('supplier_proposals').upsert(transformBudgetForSupabase(data, user.id));
        break;
      case 'file':
        await supabase.from('files').upsert(transformFileForSupabase(data, user.id));
        break;
    }

    syncStateManager.updateState({ 
      status: 'idle',
      lastSyncAt: Date.now(),
      pendingPush: syncQueue.length 
    });
  } catch (error) {
    console.error('Erro ao sincronizar:', error);
    syncQueue.push({ type: entityType, data });
    syncStateManager.setError('Falha na sincronização - item adicionado à fila');
  }
}

// Transformadores para Supabase
function transformProjectForSupabase(project: any, userId: string) {
  return {
    id: project.id,
    name: project.name,
    client: project.client,
    city: project.city,
    code: project.code,
    status: project.status,
    installation_date: project.installation_date || null,
    inauguration_date: project.inauguration_date || null,
    installation_time_estimate_days: project.installation_time_estimate_days || null,
    owner_name: project.owner,
    suppliers: project.suppliers,
    project_files_link: project.project_files_link || null,
    user_id: userId,
    updated_at: new Date().toISOString()
  };
}

function transformInstallationForSupabase(installation: any, userId: string) {
  return {
    id: installation.id,
    project_id: installation.project_id,
    tipologia: installation.tipologia,
    codigo: installation.codigo,
    descricao: installation.descricao,
    quantidade: installation.quantidade,
    pavimento: installation.pavimento,
    revisado: installation.revisado || false,
    pendencia_tipo: installation.pendencia_tipo || null,
    pendencia_descricao: installation.pendencia_descricao || null,
    photos: installation.photos || [],
    user_id: userId,
    updated_at: new Date().toISOString()
  };
}

function transformContactForSupabase(contact: any, userId: string) {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    role: contact.role,
    project_id: contact.projetoId || contact.project_id,
    user_id: userId,
    updated_at: new Date().toISOString()
  };
}

function transformBudgetForSupabase(budget: any, userId: string) {
  return {
    id: budget.id,
    project_id: budget.projectId,
    supplier: budget.supplier,
    status: budget.status || 'pending',
    file_name: budget.fileName,
    file_path: budget.filePath,
    file_size: budget.fileSize,
    user_id: userId,
    updated_at: new Date().toISOString()
  };
}

function transformFileForSupabase(file: any, userId: string) {
  return {
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    url: file.url,
    storage_path: file.storagePath,
    project_id: file.projectId || null,
    installation_id: file.installationId || null,
    user_id: userId,
    updated_at: new Date().toISOString()
  };
}

// Processar fila de sincronização
export async function processSyncQueue() {
  if (!isOnline() || syncQueue.length === 0) return;

  const itemsToSync = [...syncQueue];
  syncQueue.length = 0;

  for (const item of itemsToSync) {
    await syncToServerImmediate(item.type, item.data);
  }
}

export const StorageManagerDexie = {
  // -------- PROJECTS ----------
  async getProjects() {
    const projects = await db.projects.where('_deleted').notEqual(1).toArray();
    return projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },
  async getProjectById(id: string) {
    return db.projects.get(id);
  },
  async upsertProject(project: Project) {
    const withDates = { 
      ...project, 
      updatedAt: now(), 
      createdAt: (project as any)?.createdAt ?? now(),
      _dirty: 0,
      _deleted: 0
    };

    // ONLINE FIRST: Tentar salvar no servidor imediatamente
    if (isOnline()) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        // Se é novo projeto, criar no Supabase
        if (!project.id || project.id === '' || project.id.startsWith('project_')) {
          const { data, error } = await supabase
            .from('projects')
            .insert([transformProjectForSupabase({ ...withDates, id: undefined }, user.id)])
            .select()
            .single();

          if (error) throw error;

          withDates.id = data.id;
          await db.projects.put(withDates);
          syncStateManager.updateState({ lastSyncAt: Date.now() });
          return withDates;
        }

        // Atualizar projeto existente
        const { error } = await supabase
          .from('projects')
          .upsert(transformProjectForSupabase(withDates, user.id));

        if (error) throw error;

        await db.projects.put(withDates);
        syncStateManager.updateState({ lastSyncAt: Date.now() });
        return withDates;
      } catch (error) {
        console.error('Erro ao salvar online, salvando offline:', error);
        withDates._dirty = 1;
        await db.projects.put(withDates);
        syncQueue.push({ type: 'project', data: withDates });
        syncStateManager.updateState({ pendingPush: syncQueue.length });
        return withDates;
      }
    }

    // OFFLINE: Salvar localmente e marcar para sincronizar
    withDates._dirty = 1;
    await db.projects.put(withDates);
    syncQueue.push({ type: 'project', data: withDates });
    syncStateManager.updateState({ pendingPush: syncQueue.length });
    return withDates;
  },
  async deleteProject(id: string) {
    // Mark as deleted instead of actually deleting (tombstone)
    const existing = await db.projects.get(id);
    if (existing) {
      await db.projects.put({ ...existing, _deleted: 1, _dirty: 1, updatedAt: now() });
    }
    
    // Also mark related records as deleted
    const installations = await db.installations.where('project_id').equals(id).toArray();
    for (const installation of installations) {
      await db.installations.put({ ...installation, _deleted: 1, _dirty: 1, updatedAt: now() });
    }
    
    const budgets = await db.budgets.where('projectId').equals(id).toArray();
    for (const budget of budgets) {
      await db.budgets.put({ ...budget, _deleted: 1, _dirty: 1, updatedAt: now() });
    }
    
    const files = await db.files.where('projectId').equals(id).toArray();
    for (const file of files) {
      await db.files.put({ ...file, _deleted: 1, _dirty: 1, updatedAt: now() });
    }
  },

  // -------- INSTALLATIONS ----------
  async getInstallationsByProject(projectId: string) {
    return db.installations.where('project_id').equals(projectId).and(item => item._deleted !== 1).toArray();
  },
  async upsertInstallation(installation: Installation) {
    const withDates = { 
      ...installation, 
      updatedAt: now(), 
      createdAt: (installation as any)?.createdAt ?? now(),
      _dirty: 0,
      _deleted: 0
    };

    // ONLINE FIRST: Sincronizar imediatamente
    await syncToServerImmediate('installation', withDates);
    await db.installations.put(withDates);
    
    return withDates;
  },
  async deleteInstallation(id: string) {
    // Mark as deleted instead of actually deleting (tombstone)
    const existing = await db.installations.get(id);
    if (existing) {
      await db.installations.put({ ...existing, _deleted: 1, _dirty: 1, updatedAt: now() });
    }
    
    // Also mark related records as deleted
    const itemVersions = await db.itemVersions.where('installationId').equals(id).toArray();
    for (const itemVersion of itemVersions) {
      await db.itemVersions.put({ ...itemVersion, _deleted: 1, _dirty: 1 });
    }
    
    const files = await db.files.where('installationId').equals(id).toArray();
    for (const file of files) {
      await db.files.put({ ...file, _deleted: 1, _dirty: 1, updatedAt: now() });
    }
  },

  // -------- ITEM VERSIONS ----------
  async getItemVersions(installationId: string) {
    return db.itemVersions.where('installationId').equals(installationId).toArray();
  },
  async upsertItemVersion(version: ItemVersion) {
    const withDates = { 
      ...version, 
      createdAt: (version as any)?.createdAt ?? now(),
      _dirty: 1,
      _deleted: 0
    };
    await db.itemVersions.put(withDates);
    
    // Trigger debounced auto-sync
    autoSyncManager.triggerDebouncedSync();
    
    return withDates;
  },

  // -------- CONTACTS ----------
  async getContacts() {
    return db.contacts.where('_deleted').notEqual(1).toArray();
  },
  async upsertContact(contact: ProjectContact) {
    const withFlags = { ...contact, _dirty: 0, _deleted: 0 };
    
    // ONLINE FIRST: Sincronizar imediatamente
    await syncToServerImmediate('contact', withFlags);
    await db.contacts.put(withFlags);
    
    return withFlags;
  },
  async deleteContact(id: string) {
    const existing = await db.contacts.get(id);
    if (existing) {
      await db.contacts.put({ ...existing, _deleted: 1, _dirty: 1 });
    }
  },

  // -------- BUDGETS ----------
  async getBudgetsByProject(projectId: string) {
    return db.budgets.where('projectId').equals(projectId).toArray();
  },
  async upsertBudget(budget: ProjectBudget) {
    const withDates = { 
      ...budget, 
      updatedAt: now(), 
      createdAt: (budget as any)?.createdAt ?? now(),
      _dirty: 0,
      _deleted: 0
    };
    
    // ONLINE FIRST: Sincronizar imediatamente
    await syncToServerImmediate('budget', withDates);
    await db.budgets.put(withDates);
    
    return withDates;
  },

  // -------- FILES / ATTACHMENTS ----------
  async getFilesByProject(projectId: string) {
    const files = await db.files
      .where('projectId')
      .equals(projectId)
      .and(f => f._deleted !== 1)
      .toArray();
    return files.sort((a, b) => {
      const aTime = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const bTime = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return bTime - aTime;
    });
  },
  async getFilesByInstallation(installationId: string) {
    const files = await db.files
      .where('installationId')
      .equals(installationId)
      .and(f => f._deleted !== 1)
      .toArray();
    return files.sort((a, b) => {
      const aTime = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const bTime = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return bTime - aTime;
    });
  },
  async upsertFile(file: ProjectFile) {
    const metaAtualizado: ProjectFile = {
      ...file,
      updatedAt: Date.now(),
      uploadedAt: file.uploadedAt ?? new Date().toISOString(),
      _dirty: 0,
      _deleted: 0
    };
    
    // ONLINE FIRST: Sincronizar imediatamente
    await syncToServerImmediate('file', metaAtualizado);
    await db.files.put(metaAtualizado);

    return metaAtualizado;
  },
  async deleteFile(id: string) {
    await db.files.put({ id, _deleted: 1, _dirty: 1, updatedAt: Date.now() } as any);
  }
};

// Compatibility aliases
(StorageManagerDexie as any).saveProject = StorageManagerDexie.upsertProject;
(StorageManagerDexie as any).updateProject = StorageManagerDexie.upsertProject;
(StorageManagerDexie as any).getProject = StorageManagerDexie.getProjectById;

// Installations
(StorageManagerDexie as any).getInstallations = StorageManagerDexie.getInstallationsByProject;
(StorageManagerDexie as any).saveInstallation = StorageManagerDexie.upsertInstallation;
(StorageManagerDexie as any).updateInstallation = StorageManagerDexie.upsertInstallation;
(StorageManagerDexie as any).overwriteInstallation = StorageManagerDexie.upsertInstallation;
(StorageManagerDexie as any).importInstallations = async (projectId: string, installations: any[]) => {
  const results = [];
  for (const installation of installations) {
    const result = await StorageManagerDexie.upsertInstallation({ ...installation, project_id: projectId });
    results.push(result);
  }
  return results;
};

// Item Versions
(StorageManagerDexie as any).getInstallationVersions = StorageManagerDexie.getItemVersions;
(StorageManagerDexie as any).saveItemVersion = StorageManagerDexie.upsertItemVersion;

// Contacts - with projectId filter support
(StorageManagerDexie as any).getProjectContacts = StorageManagerDexie.getContacts;
(StorageManagerDexie as any).getContacts = async (projectId?: string) => {
  const allContacts = await db.contacts.toArray();
  return projectId ? allContacts.filter(c => c.projetoId === projectId) : allContacts;
};
(StorageManagerDexie as any).saveProjectContact = StorageManagerDexie.upsertContact;
(StorageManagerDexie as any).saveContact = async (projectId: string, contact: any) => {
  return StorageManagerDexie.upsertContact({ ...contact, projetoId: projectId });
};
(StorageManagerDexie as any).updateContact = async (id: string, contact: any) => {
  return StorageManagerDexie.upsertContact({ ...contact, id });
};
(StorageManagerDexie as any).deleteProjectContact = StorageManagerDexie.deleteContact;
(StorageManagerDexie as any).deleteContact = StorageManagerDexie.deleteContact;

// Budgets
(StorageManagerDexie as any).getBudgets = StorageManagerDexie.getBudgetsByProject;
(StorageManagerDexie as any).saveBudget = StorageManagerDexie.upsertBudget;

// Files
(StorageManagerDexie as any).saveFile = StorageManagerDexie.upsertFile;

// Reports (mock for compatibility)
(StorageManagerDexie as any).getReports = async () => [];
(StorageManagerDexie as any).saveReport = async (report: any) => report;