import { db } from '@/db/indexedDb';
import type {
  Project,
  Installation,
  ProjectContact,
  ProjectBudget,
  ItemVersion,
  ProjectFile,
  ReportHistoryEntry
} from '@/types';
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

// Reports - IndexedDB implementation
const REPORT_HISTORY_STORAGE_KEY = 'dea_manager_reports-new';
let legacyReportHistoryMigrated = false;

function inferReportMimeType(format?: string, fallback?: string) {
  if (fallback) return fallback;
  if (format === 'xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (format === 'pdf') {
    return 'application/pdf';
  }
  return 'application/octet-stream';
}

function decodeBase64ToUint8Array(base64: string) {
  if (typeof globalThis !== 'undefined' && typeof (globalThis as any).atob === 'function') {
    const binaryString = (globalThis as any).atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof globalThis !== 'undefined' && (globalThis as any).Buffer) {
    const buffer = (globalThis as any).Buffer.from(base64, 'base64');
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  throw new Error('No base64 decoder available in this environment');
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const [header, data] = dataUrl.split(',');
  if (!header || !data) {
    throw new Error('Invalid data URL');
  }

  const mimeMatch = header.match(/data:(.*);base64/);
  const mimeType = mimeMatch?.[1] ?? 'application/octet-stream';
  const bytes = decodeBase64ToUint8Array(data);

  return {
    blob: new Blob([bytes], { type: mimeType }),
    mimeType,
  };
}

function normalizeReportHistoryEntry(report: any): ReportHistoryEntry {
  if (!report) {
    throw new Error('Report payload is required');
  }

  const { blobData, blob, ...rest } = report;
  const projectId = rest.projectId ?? rest.project_id;
  const generatedAt = rest.generatedAt ?? rest.generated_at ?? new Date().toISOString();
  const createdAtCandidate = rest.createdAt ?? rest.created_at;
  let storedBlob: Blob | undefined = blob instanceof Blob ? blob : undefined;
  let mimeType = rest.mimeType ?? rest.mime_type ?? storedBlob?.type;

  if (!storedBlob && typeof blobData === 'string') {
    try {
      const converted = dataUrlToBlob(blobData);
      storedBlob = converted.blob;
      mimeType = mimeType ?? converted.mimeType;
    } catch (error) {
      console.error('Failed to convert legacy report blobData:', error);
    }
  }

  const createdAt =
    typeof createdAtCandidate === 'number'
      ? createdAtCandidate
      : Number.isFinite(Date.parse(generatedAt))
        ? Date.parse(generatedAt)
        : Date.now();

  const generatedBy = rest.generatedBy ?? rest.generated_by ?? 'Sistema';
  const size = rest.size ?? storedBlob?.size ?? 0;

  const normalized: ReportHistoryEntry = {
    ...rest,
    id: rest.id ?? `report_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    projectId,
    project_id: projectId,
    generatedAt,
    generated_at: generatedAt,
    generatedBy,
    generated_by: generatedBy,
    size,
    mimeType: inferReportMimeType(rest.format, mimeType),
    blob: storedBlob,
    createdAt,
  };

  return normalized;
}

async function migrateLegacyReportHistory() {
  if (legacyReportHistoryMigrated) return;
  legacyReportHistoryMigrated = true;

  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return;
  }

  try {
    const stored = window.localStorage.getItem(REPORT_HISTORY_STORAGE_KEY);
    if (!stored) return;

    const legacyReports = JSON.parse(stored);
    if (!Array.isArray(legacyReports) || legacyReports.length === 0) {
      window.localStorage.removeItem(REPORT_HISTORY_STORAGE_KEY);
      return;
    }

    await db.transaction('rw', db.reports, async () => {
      for (const legacyReport of legacyReports) {
        try {
          const normalized = normalizeReportHistoryEntry(legacyReport);
          await db.reports.put(normalized);
        } catch (error) {
          console.error('Failed to migrate legacy report history entry:', error);
        }
      }
    });

    window.localStorage.removeItem(REPORT_HISTORY_STORAGE_KEY);
  } catch (error) {
    console.error('Error migrating legacy report history:', error);
  }
}

(StorageManagerDexie as any).getReports = async (projectId?: string) => {
  try {
    await migrateLegacyReportHistory();

    const reports = projectId
      ? await db.reports.where('projectId').equals(projectId).toArray()
      : await db.reports.toArray();

    return reports
      .map((report) => normalizeReportHistoryEntry(report))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } catch (error) {
    console.error('Error getting reports:', error);
    return [];
  }
};

(StorageManagerDexie as any).saveReport = async (report: ReportHistoryEntry) => {
  try {
    await migrateLegacyReportHistory();
    const normalized = normalizeReportHistoryEntry(report);

    if (!normalized.projectId) {
      throw new Error('Report must include a projectId');
    }

    await db.transaction('rw', db.reports, async () => {
      await db.reports.put(normalized);

      const projectReports = await db.reports.where('projectId').equals(normalized.projectId).toArray();
      if (projectReports.length > 20) {
        const sorted = projectReports
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
          .slice(20);

        if (sorted.length > 0) {
          await db.reports.bulkDelete(sorted.map((entry) => entry.id));
        }
      }
    });

    console.log('✅ Report saved to history:', normalized.id);
    return normalized;
  } catch (error) {
    console.error('❌ Error saving report:', error);
    throw error;
  }
};

(StorageManagerDexie as any).deleteReport = async (reportId: string) => {
  try {
    await migrateLegacyReportHistory();
    await db.reports.delete(reportId);
    console.log('✅ Report deleted from history:', reportId);
  } catch (error) {
    console.error('❌ Error deleting report:', error);
    throw error;
  }
};
