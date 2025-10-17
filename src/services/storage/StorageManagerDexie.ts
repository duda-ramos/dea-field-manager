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
import { realtimeManager } from '@/services/realtime/realtime';
import { withRetry, isRetryableNetworkError } from '@/services/sync/utils';

const now = () => Date.now();

// Verificar se está online
const isOnline = () => navigator.onLine;

// Fila de sincronização para operações offline
const syncQueue: Array<{ type: string; data: unknown }> = [];

// Sincronizar item imediatamente se online
async function syncToServerImmediate(entityType: string, data: Record<string, unknown>) {
  if (!isOnline()) {
    syncQueue.push({ type: entityType, data });
    return;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    syncStateManager.updateState({ status: 'syncing' });

    // Apply retry to Supabase operations
    await withRetry(
      async () => {
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
      },
      {
        maxAttempts: 5,
        baseDelay: 500,
        retryCondition: isRetryableNetworkError
      },
      `Sincronização de ${entityType}`
    );

    syncStateManager.updateState({ 
      status: 'idle',
      lastSyncAt: Date.now(),
      pendingPush: syncQueue.length 
    });
  } catch (error) {
    console.error('❌ Erro ao sincronizar após retries:', error);
    syncQueue.push({ type: entityType, data });
    syncStateManager.setError('Falha na sincronização - item adicionado à fila');
  }
}

// Transformadores para Supabase
function transformProjectForSupabase(project: Record<string, unknown>, userId: string) {
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

function transformInstallationForSupabase(installation: Record<string, unknown>, userId: string) {
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

function transformContactForSupabase(contact: Record<string, unknown>, userId: string) {
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

function transformBudgetForSupabase(budget: Record<string, unknown>, userId: string) {
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

function transformFileForSupabase(file: Record<string, unknown>, userId: string) {
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
          const result = await withRetry(
            async () => {
              const { data, error } = await supabase
                .from('projects')
                .insert([transformProjectForSupabase({ ...withDates, id: undefined }, user.id)])
                .select()
                .single();

              if (error) throw error;
              return data;
            },
            {
              maxAttempts: 5,
              baseDelay: 500,
              retryCondition: isRetryableNetworkError
            },
            'Criação de novo projeto'
          );

          withDates.id = result.id;
          await db.projects.put(withDates);
          syncStateManager.updateState({ lastSyncAt: Date.now() });
          return withDates;
        }

        // Atualizar projeto existente
        await withRetry(
          async () => {
            const { error } = await supabase
              .from('projects')
              .upsert(transformProjectForSupabase(withDates, user.id));

            if (error) throw error;
          },
            {
              maxAttempts: 5,
              baseDelay: 500,
              retryCondition: isRetryableNetworkError
            },
          `Atualização de projeto: ${withDates.name}`
        );

        await db.projects.put(withDates);
        realtimeManager.trackLocalOperation('projects');
        syncStateManager.updateState({ lastSyncAt: Date.now() });
        return withDates;
      } catch (error) {
        console.error('❌ Erro ao salvar projeto online após retries, salvando offline:', error);
        withDates._dirty = 1;
        await db.projects.put(withDates);
        realtimeManager.trackLocalOperation('projects');
        syncStateManager.incrementPending('projects', 1);
        syncQueue.push({ type: 'project', data: withDates });
        syncStateManager.updateState({ pendingPush: syncQueue.length });
        return withDates;
      }
    }

    // OFFLINE: Salvar localmente e marcar para sincronizar
    withDates._dirty = 1;
    await db.projects.put(withDates);
    realtimeManager.trackLocalOperation('projects');
    syncStateManager.incrementPending('projects', 1);
    syncQueue.push({ type: 'project', data: withDates });
    syncStateManager.updateState({ pendingPush: syncQueue.length });
    autoSyncManager.triggerDebouncedSync();
    return withDates;
  },
  async deleteProject(id: string) {
    // Mark as deleted instead of actually deleting (tombstone)
    const existing = await db.projects.get(id);
    if (existing) {
      await db.projects.put({ ...existing, _deleted: 1, _dirty: 1, updatedAt: now() });
      realtimeManager.trackLocalOperation('projects');
      syncStateManager.incrementPending('projects', 1);
    }
    
    // Also mark related records as deleted
    const installations = await db.installations.where('project_id').equals(id).toArray();
    for (const installation of installations) {
      await db.installations.put({ ...installation, _deleted: 1, _dirty: 1, updatedAt: now() });
      syncStateManager.incrementPending('installations', 1);
    }
    
    const budgets = await db.budgets.where('projectId').equals(id).toArray();
    for (const budget of budgets) {
      await db.budgets.put({ ...budget, _deleted: 1, _dirty: 1, updatedAt: now() });
      syncStateManager.incrementPending('budgets', 1);
    }
    
    const files = await db.files.where('projectId').equals(id).toArray();
    for (const file of files) {
      await db.files.put({ ...file, _deleted: 1, _dirty: 1, updatedAt: now() });
      syncStateManager.incrementPending('files', 1);
    }
  },

  // -------- INSTALLATIONS ----------
  async getInstallationsByProject(projectId: string) {
    const installations = await db.installations
      .where('project_id')
      .equals(projectId)
      .and(item => item._deleted !== 1)
      .toArray();

    if (installations.length === 0) {
      return installations;
    }

    const installationIds = installations.map(installation => installation.id);
    const allVersions = await db.itemVersions
      .where('installationId')
      .anyOf(installationIds)
      .and(version => version._deleted !== 1)
      .toArray();

    const versionsByInstallation = new Map<string, ItemVersion[]>();
    for (const version of allVersions) {
      const existing = versionsByInstallation.get(version.installationId) ?? [];
      existing.push(version);
      versionsByInstallation.set(version.installationId, existing);
    }

    const installationsWithLatest = await Promise.all(
      installations.map(async installation => {
        const versions = versionsByInstallation.get(installation.id);
        if (!versions || versions.length === 0) {
          return installation;
        }

        const latestVersion = versions.reduce<ItemVersion | null>((latest, current) => {
          if (!latest) return current;

          const latestRevision = latest.revisao ?? 0;
          const currentRevision = current.revisao ?? 0;

          if (currentRevision > latestRevision) {
            return current;
          }

          if (currentRevision === latestRevision) {
            const latestCreated = latest.createdAt ?? new Date(latest.criadoEm).getTime();
            const currentCreated = current.createdAt ?? new Date(current.criadoEm).getTime();
            if (currentCreated > latestCreated) {
              return current;
            }
          }

          return latest;
        }, null);

        if (!latestVersion) {
          return installation;
        }

        const snapshotData = latestVersion.snapshot ?? {};
        const mergedInstallation: Installation = { ...installation };

        Object.entries(snapshotData).forEach(([key, value]) => {
          if (value !== undefined) {
            (mergedInstallation as any)[key] = value;
          }
        });

        const latestRevisionNumber = latestVersion.revisao ?? installation.revisao ?? 0;
        mergedInstallation.revisao = latestRevisionNumber;

        const snapshotRevisado = (snapshotData as Record<string, unknown>).revisado;
        if (typeof snapshotRevisado === 'boolean') {
          mergedInstallation.revisado = snapshotRevisado;
        } else {
          mergedInstallation.revisado =
            installation.revisado ?? (latestRevisionNumber >= 1);
        }
        mergedInstallation.project_id = installation.project_id;

        if (installation.projectId) {
          mergedInstallation.projectId = installation.projectId;
        }

        if (!mergedInstallation.updated_at && installation.updated_at) {
          mergedInstallation.updated_at = installation.updated_at;
        }

        if (!mergedInstallation.updatedAt && installation.updatedAt) {
          mergedInstallation.updatedAt = installation.updatedAt;
        }

        const hasChanges = Object.keys(mergedInstallation).some(key => {
          const typedKey = key as keyof Installation;
          return mergedInstallation[typedKey] !== installation[typedKey];
        });

        if (hasChanges) {
          await db.installations.put(mergedInstallation);
          return mergedInstallation;
        }

        return installation;
      })
    );

    return installationsWithLatest;
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
    realtimeManager.trackLocalOperation('installations');
    autoSyncManager.triggerDebouncedSync();
    
    return withDates;
  },
  async deleteInstallation(id: string) {
    // Mark as deleted instead of actually deleting (tombstone)
    const existing = await db.installations.get(id);
    if (existing) {
      await db.installations.put({ ...existing, _deleted: 1, _dirty: 1, updatedAt: now() });
      realtimeManager.trackLocalOperation('installations');
      syncStateManager.incrementPending('installations', 1);
    }
    
    // Also mark related records as deleted
    const itemVersions = await db.itemVersions.where('installationId').equals(id).toArray();
    for (const itemVersion of itemVersions) {
      await db.itemVersions.put({ ...itemVersion, _deleted: 1, _dirty: 1 });
      syncStateManager.incrementPending('itemVersions', 1);
    }
    
    const files = await db.files.where('installationId').equals(id).toArray();
    for (const file of files) {
      await db.files.put({ ...file, _deleted: 1, _dirty: 1, updatedAt: now() });
      syncStateManager.incrementPending('files', 1);
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
    syncStateManager.incrementPending('itemVersions', 1);
    
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
    realtimeManager.trackLocalOperation('contacts');
    autoSyncManager.triggerDebouncedSync();
    
    return withFlags;
  },
  async deleteContact(id: string) {
    const existing = await db.contacts.get(id);
    if (existing) {
      await db.contacts.put({ ...existing, _deleted: 1, _dirty: 1 });
      realtimeManager.trackLocalOperation('contacts');
      syncStateManager.incrementPending('contacts', 1);
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
    realtimeManager.trackLocalOperation('budgets');
    autoSyncManager.triggerDebouncedSync();
    
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
    autoSyncManager.triggerDebouncedSync();

    return metaAtualizado;
  },
  async deleteFile(id: string) {
    await db.files.put({ id, _deleted: 1, _dirty: 1, updatedAt: Date.now() } as any);
    syncStateManager.incrementPending('files', 1);
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
(StorageManagerDexie as Record<string, unknown>).importInstallations = async (projectId: string, installations: Installation[]) => {
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
(StorageManagerDexie as Record<string, unknown>).saveContact = async (projectId: string, contact: ProjectContact) => {
  return StorageManagerDexie.upsertContact({ ...contact, projetoId: projectId });
};
(StorageManagerDexie as Record<string, unknown>).updateContact = async (id: string, contact: Partial<ProjectContact>) => {
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
const LEGACY_REPORT_HISTORY_STORAGE_KEY = 'dea_manager_reports-new';
let legacyReportHistoryMigrated = false;

type ReportPayloadRecord = {
  id: string;
  projectId?: string;
  blob?: Blob;
  mimeType?: string;
  size?: number;
  createdAt?: number;
};

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

function normalizeReportHistoryEntry(report: Record<string, unknown>, payload?: ReportPayloadRecord): ReportHistoryEntry {
  if (!report) {
    throw new Error('Report payload is required');
  }

  const {
    blobData,
    blob,
    payloadId: existingPayloadId,
    payload_id,
    payload: legacyPayload,
    payloadData,
    payload_base64,
    base64,
    base64Payload,
    dataUrl,
    data_url,
    ...rest
  } = report;
  const projectId = rest.projectId ?? rest.project_id;
  const generatedAt = rest.generatedAt ?? rest.generated_at ?? new Date().toISOString();
  const createdAtCandidate = rest.createdAt ?? rest.created_at;
  const fallbackBlob = payload?.blob;
  let storedBlob: Blob | undefined = blob instanceof Blob ? blob : fallbackBlob;
  let mimeType = rest.mimeType ?? rest.mime_type ?? payload?.mimeType ?? storedBlob?.type;

  if (!storedBlob && typeof blobData === 'string') {
    try {
      const converted = dataUrlToBlob(blobData);
      storedBlob = converted.blob;
      mimeType = mimeType ?? converted.mimeType;
    } catch (error) {
      console.error('Failed to convert legacy report blobData:', error);
    }
  }

  if (!storedBlob && typeof legacyPayload === 'string') {
    try {
      const converted = dataUrlToBlob(legacyPayload);
      storedBlob = converted.blob;
      mimeType = mimeType ?? converted.mimeType;
    } catch (error) {
      console.error('Failed to convert legacy report payload string:', error);
    }
  }

  if (!storedBlob && typeof payloadData === 'string') {
    try {
      const converted = dataUrlToBlob(payloadData);
      storedBlob = converted.blob;
      mimeType = mimeType ?? converted.mimeType;
    } catch (error) {
      console.error('Failed to convert legacy report payloadData string:', error);
    }
  }

  if (!storedBlob && typeof payload_base64 === 'string') {
    try {
      const converted = dataUrlToBlob(`data:${mimeType ?? ''};base64,${payload_base64}`);
      storedBlob = converted.blob;
      mimeType = mimeType ?? converted.mimeType;
    } catch (error) {
      console.error('Failed to convert legacy report payload_base64 string:', error);
    }
  }

  if (!storedBlob && typeof base64 === 'string') {
    try {
      const converted = dataUrlToBlob(`data:${mimeType ?? ''};base64,${base64}`);
      storedBlob = converted.blob;
      mimeType = mimeType ?? converted.mimeType;
    } catch (error) {
      console.error('Failed to convert legacy report base64 string:', error);
    }
  }

  if (!storedBlob && typeof base64Payload === 'string') {
    try {
      const converted = dataUrlToBlob(`data:${mimeType ?? ''};base64,${base64Payload}`);
      storedBlob = converted.blob;
      mimeType = mimeType ?? converted.mimeType;
    } catch (error) {
      console.error('Failed to convert legacy report base64Payload string:', error);
    }
  }

  if (!storedBlob && typeof dataUrl === 'string') {
    try {
      const converted = dataUrlToBlob(dataUrl);
      storedBlob = converted.blob;
      mimeType = mimeType ?? converted.mimeType;
    } catch (error) {
      console.error('Failed to convert legacy report dataUrl string:', error);
    }
  }

  if (!storedBlob && typeof data_url === 'string') {
    try {
      const converted = dataUrlToBlob(data_url);
      storedBlob = converted.blob;
      mimeType = mimeType ?? converted.mimeType;
    } catch (error) {
      console.error('Failed to convert legacy report data_url string:', error);
    }
  }

  const createdAt =
    typeof createdAtCandidate === 'number'
      ? createdAtCandidate
      : Number.isFinite(Date.parse(generatedAt))
        ? Date.parse(generatedAt)
        : Date.now();

  const generatedBy = rest.generatedBy ?? rest.generated_by ?? 'Sistema';
  const size = rest.size ?? payload?.size ?? storedBlob?.size ?? 0;
  const payloadId = existingPayloadId ?? payload_id ?? rest.id ?? `report_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const id = rest.id ?? payloadId ?? `report_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  const normalized: ReportHistoryEntry = {
    ...rest,
    id,
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
    payloadId,
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
    const stored = window.localStorage.getItem(LEGACY_REPORT_HISTORY_STORAGE_KEY);
    if (!stored) return;

    const legacyReports = JSON.parse(stored);
    if (!Array.isArray(legacyReports) || legacyReports.length === 0) {
      window.localStorage.removeItem(LEGACY_REPORT_HISTORY_STORAGE_KEY);
      return;
    }

    await db.transaction('rw', db.reports, db.reportPayloads, async () => {
      for (const legacyReport of legacyReports) {
        try {
          const normalized = normalizeReportHistoryEntry(legacyReport);
          const payloadId = normalized.payloadId ?? normalized.id;
          const { blob, ...metadata } = normalized as ReportHistoryEntry & { blob?: Blob };

          await db.reports.put(metadata);

          if (blob instanceof Blob) {
            await db.reportPayloads.put({
              id: payloadId,
              projectId: normalized.projectId,
              blob,
              mimeType: normalized.mimeType,
              size: normalized.size,
              createdAt: normalized.createdAt,
            });
          }
        } catch (error) {
          console.error('Failed to migrate legacy report history entry:', error);
        }
      }
    });

    window.localStorage.removeItem(LEGACY_REPORT_HISTORY_STORAGE_KEY);
  } catch (error) {
    console.error('Error migrating legacy report history:', error);
  }
}

(StorageManagerDexie as any).getReports = async (projectId?: string) => {
  try {
    await migrateLegacyReportHistory();

    // Get local reports from IndexedDB
    const localReports = projectId
      ? await db.reports.where('projectId').equals(projectId).toArray()
      : await db.reports.toArray();

    const payloadIds = localReports.map((report) => (report as any).payloadId ?? report.id);
    const payloads = payloadIds.length > 0 ? await db.reportPayloads.bulkGet(payloadIds) : [];
    const payloadMap = new Map<string, ReportPayloadRecord>();

    payloads.forEach((payload, index) => {
      if (payload) {
        payloadMap.set(payloadIds[index]!, payload);
      }
    });

    const normalizedLocalReports = localReports.map((report) => 
      normalizeReportHistoryEntry(report, payloadMap.get((report as any).payloadId ?? report.id))
    );

    // Fetch reports from Supabase
    let supabaseReports: any[] = [];
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        let query = supabase
          .from('project_report_history')
          .select('*')
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false });
        
        if (projectId) {
          query = query.eq('project_id', projectId);
        }
        
        const { data, error } = await query;
        
        if (!error && data) {
          supabaseReports = data.map((report: any) => ({
            id: report.id,
            projectId: report.project_id,
            fileName: report.file_name,
            format: report.format,
            interlocutor: report.interlocutor,
            config: report.config || {},
            size: 0, // Size not stored in Supabase
            generatedAt: report.generated_at,
            generatedBy: report.generated_by,
            fileUrl: report.file_url,
            file_url: report.file_url,
            createdAt: new Date(report.created_at).getTime(),
          }));
        }
      }
    } catch (error) {
      console.warn('[getReports] Failed to fetch from Supabase, using local only:', error);
    }

    // Merge and deduplicate reports (prefer Supabase version if exists)
    const allReports = [...supabaseReports, ...normalizedLocalReports];
    const uniqueReports = new Map();
    
    allReports.forEach(report => {
      const key = `${report.projectId}-${report.fileName}`;
      if (!uniqueReports.has(key) || report.fileUrl) {
        // Prefer reports with fileUrl (from Supabase)
        uniqueReports.set(key, report);
      }
    });

    return Array.from(uniqueReports.values())
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

    const payloadId = normalized.payloadId ?? normalized.id;
    const { blob, ...metadataToPersist } = normalized as ReportHistoryEntry & { blob?: Blob };

    await db.transaction('rw', db.reports, db.reportPayloads, async () => {
      await db.reports.put(metadataToPersist);

      if (blob instanceof Blob) {
        await db.reportPayloads.put({
          id: payloadId,
          projectId: normalized.projectId,
          blob,
          mimeType: normalized.mimeType,
          size: normalized.size,
          createdAt: normalized.createdAt,
        });
      }

      const projectReports = await db.reports.where('projectId').equals(normalized.projectId).toArray();
      if (projectReports.length > 20) {
        const sorted = projectReports
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
          .slice(20);

        if (sorted.length > 0) {
          await db.reports.bulkDelete(sorted.map((entry) => entry.id));
          await db.reportPayloads.bulkDelete(sorted.map((entry) => (entry as any).payloadId ?? entry.id));
        }
      }
    });

    // Report saved successfully
    return normalized;
  } catch (error) {
    console.error('❌ Error saving report:', error);
    throw error;
  }
};

(StorageManagerDexie as any).deleteReport = async (reportId: string) => {
  try {
    await migrateLegacyReportHistory();
    
    // Try to delete from Supabase first
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Get report details to delete file from storage
        const { data: report } = await supabase
          .from('project_report_history')
          .select('file_url, project_id')
          .eq('id', reportId)
          .eq('user_id', user.id)
          .single();
        
        if (report) {
          // Extract file path from URL
          const fileUrl = report.file_url;
          if (fileUrl) {
            // Parse the URL to get the file path
            const urlParts = fileUrl.split('/storage/v1/object/public/reports/');
            if (urlParts.length > 1) {
              const filePath = urlParts[1];
              
              // Delete file from storage
              await supabase.storage
                .from('reports')
                .remove([filePath]);
            }
          }
          
          // Delete from database
          await supabase
            .from('project_report_history')
            .delete()
            .eq('id', reportId)
            .eq('user_id', user.id);
        }
      }
    } catch (error) {
      console.warn('[deleteReport] Failed to delete from Supabase, continuing with local delete:', error);
    }
    
    // Delete from local IndexedDB
    await db.transaction('rw', db.reports, db.reportPayloads, async () => {
      const existing = await db.reports.get(reportId);
      await db.reports.delete(reportId);

      const payloadId = existing ? ((existing as any).payloadId ?? reportId) : reportId;
      await db.reportPayloads.delete(payloadId);
    });
    // Report deleted successfully
  } catch (error) {
    console.error('❌ Error deleting report:', error);
    throw error;
  }
};
