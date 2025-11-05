import { db } from '@/db/indexedDb';
import type {
  Project,
  Installation,
  ProjectContact,
  ProjectBudget,
  ItemVersion,
  ProjectFile,
  ReportHistoryEntry,
  ChangeSummary,
  RevisionActionType
} from '@/types';
import { autoSyncManager } from '@/services/sync/autoSync';
import { supabase } from '@/integrations/supabase/client';
import { syncStateManager } from '@/services/sync/syncState';
import { realtimeManager } from '@/services/realtime/realtime';
import { withRetry, isRetryableNetworkError } from '@/services/sync/utils';
import { logger } from '@/lib/logger';
import { scheduleTemporaryDeletion } from '@/lib/utils';

const now = () => Date.now();

// Verificar se está online
const isOnline = () => navigator.onLine;

// Fila de sincronização para operações offline
const syncQueue: Array<{ type: string; data: unknown }> = [];

type InstallationRevisionOptions = {
  motivo?: ItemVersion['motivo'];
  descricaoMotivo?: string;
  actionType?: RevisionActionType;
  type?: ItemVersion['type'];
  forceRevision?: boolean;
  userEmail?: string | null;
  changesSummaryOverride?: ChangeSummary | null;
  snapshotOverride?: Partial<Installation>;
};

const TRACKED_INSTALLATION_FIELDS: Array<keyof Installation> = [
  'tipologia',
  'codigo',
  'descricao',
  'quantidade',
  'pavimento',
  'diretriz_altura_cm',
  'diretriz_dist_batente_cm',
  'installed',
  'status',
  'pendencia_tipo',
  'pendencia_descricao',
  'observacoes',
  'comentarios_fornecedor',
  'photos',
  'revisao',
  'revisado',
];

const generateRevisionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const resolveUserEmail = async (explicit?: string | null): Promise<string | null> => {
  if (typeof explicit !== 'undefined') {
    return explicit;
  }

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    return user?.email ?? null;
  } catch {
    return null;
  }
};

const valuesAreDifferent = (current: unknown, previous: unknown): boolean => {
  if (Array.isArray(current) || Array.isArray(previous)) {
    return JSON.stringify(current ?? []) !== JSON.stringify(previous ?? []);
  }
  if (current instanceof Date || previous instanceof Date) {
    const currentTime = current instanceof Date ? current.getTime() : new Date(String(current ?? '')).getTime();
    const previousTime = previous instanceof Date ? previous.getTime() : new Date(String(previous ?? '')).getTime();
    return currentTime !== previousTime;
  }
  if (typeof current === 'number' && typeof previous === 'number') {
    return Number.isNaN(current) ? !Number.isNaN(previous) : current !== previous;
  }
  return (current ?? null) !== (previous ?? null);
};

const computeChangesSummary = (
  previous: Installation | undefined,
  current: Installation
): ChangeSummary => {
  const summary: ChangeSummary = {};

  for (const field of TRACKED_INSTALLATION_FIELDS) {
    const currentValue = (current as Record<string, unknown>)[field as string];
    const previousValue = previous ? (previous as Record<string, unknown>)[field as string] : undefined;

    if (field === 'photos') {
      const currentCount = Array.isArray(currentValue) ? currentValue.length : 0;
      const previousCount = Array.isArray(previousValue) ? previousValue.length : 0;

      if (!previous) {
        if (currentCount > 0) {
          summary[field as string] = { before: null, after: currentCount };
        }
      } else if (currentCount !== previousCount) {
        summary[field as string] = { before: previousCount, after: currentCount };
      }
      continue;
    }

    if (!previous) {
      if (typeof currentValue !== 'undefined' && currentValue !== null && currentValue !== '') {
        summary[field as string] = { before: null, after: currentValue };
      }
      continue;
    }

    if (valuesAreDifferent(currentValue, previousValue)) {
      summary[field as string] = {
        before: typeof previousValue === 'undefined' ? null : previousValue,
        after: typeof currentValue === 'undefined' ? null : currentValue
      };
    }
  }

  return summary;
};

const determineActionType = (
  previous: Installation | undefined,
  summary: ChangeSummary,
  explicit?: RevisionActionType
): RevisionActionType => {
  if (explicit) {
    return explicit;
  }

  if (!previous) {
    return 'created';
  }

  if (summary.installed && summary.installed.after === true && summary.installed.before !== true) {
    return 'installed';
  }

  return 'updated';
};

const mapActionTypeToMotivo = (
  actionType: RevisionActionType,
  provided?: ItemVersion['motivo']
): ItemVersion['motivo'] => {
  if (provided) {
    return provided;
  }

  switch (actionType) {
    case 'created':
      return 'created';
    case 'deleted':
      return 'deleted';
    case 'installed':
      return 'installed';
    default:
      return 'edited';
  }
};

const mapMotivoToRevisionType = (
  motivo: ItemVersion['motivo'],
  provided?: ItemVersion['type']
): ItemVersion['type'] => {
  if (provided) {
    return provided;
  }

  switch (motivo) {
    case 'created':
      return 'created';
    case 'restored':
      return 'restored';
    case 'deleted':
      return 'deleted';
    case 'installed':
      return 'installed';
    default:
      return 'edited';
  }
};

const buildDefaultDescription = (
  motivo: ItemVersion['motivo'],
  action: RevisionActionType
): string => {
  switch (motivo) {
    case 'created':
      return 'Versão inicial registrada automaticamente';
    case 'restored':
      return 'Versão restaurada a partir do histórico';
    case 'deleted':
      return 'Instalação removida';
    case 'installed':
      return 'Instalação marcada como concluída';
    default:
      if (action === 'installed') {
        return 'Instalação marcada como concluída';
      }
      return 'Alterações registradas automaticamente';
  }
};

const buildSnapshot = (
  installation: Installation,
  override?: Partial<Installation>
): Record<string, unknown> => {
  const {
    id: _id,
    revisado: _revisado,
    revisao: _revisao,
    revisions: _revisions,
    _dirty: _dirtyFlag,
    _deleted: _deletedFlag,
    ...rest
  } = installation as unknown as Record<string, unknown>;

  return {
    ...rest,
    ...(override ?? {})
  };
};

const persistItemVersion = async (version: ItemVersion) => {
  const withDates = {
    ...version,
    createdAt: version.createdAt ?? now(),
    _dirty: 1,
    _deleted: 0
  } as ItemVersion;

  await db.itemVersions.put(withDates);
  syncStateManager.incrementPending('itemVersions', 1);
  autoSyncManager.triggerDebouncedSync();

  return withDates;
};

const recordInstallationRevision = async (
  current: Installation,
  previous: Installation | undefined,
  options: InstallationRevisionOptions = {}
) => {
  const summary = options.changesSummaryOverride ?? computeChangesSummary(previous, current);
  const hasChanges = Object.keys(summary).length > 0;
  const shouldPersist = options.forceRevision || !previous || hasChanges;

  if (!shouldPersist) {
    return;
  }

  const actionType = determineActionType(previous, summary, options.actionType);
  const motivo = mapActionTypeToMotivo(actionType, options.motivo);
  const revisionType = mapMotivoToRevisionType(motivo, options.type);
  const descricao = options.descricaoMotivo ?? buildDefaultDescription(motivo, actionType);
  const timestamp = new Date();
  const timestampIso = timestamp.toISOString();
  const timestampMs = timestamp.getTime();
  const userEmail = await resolveUserEmail(options.userEmail);

  const snapshot = buildSnapshot(current, options.snapshotOverride);

  const version: ItemVersion = {
    id: generateRevisionId(),
    installationId: current.id,
    snapshot: snapshot as ItemVersion['snapshot'],
    revisao: current.revisao ?? previous?.revisao ?? 0,
    motivo,
    type: revisionType,
    descricao_motivo: descricao,
    criadoEm: timestampIso,
    createdAt: timestampMs,
    action_type: actionType,
    user_email: userEmail,
    changes_summary: hasChanges ? summary : options.forceRevision ? summary : null,
  };

  await persistItemVersion(version);
};

// Sincronizar item imediatamente se online
async function syncToServerImmediate(entityType: string, data: Record<string, unknown>) {
  if (!isOnline()) {
    syncQueue.push({ type: entityType, data });
    return;
  }

  let userId: string | undefined;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    userId = user.id;

    syncStateManager.updateState({ status: 'syncing' });

    // Apply retry to Supabase operations
    await withRetry(
      async () => {
        switch (entityType) {
          case 'project':
            await supabase.from('projects').upsert([transformProjectForSupabase(data, user.id)]);
            break;
          case 'installation':
            await supabase.from('installations').upsert([transformInstallationForSupabase(data, user.id)]);
            break;
          case 'contact':
            await supabase.from('contacts').upsert([transformContactForSupabase(data, user.id)]);
            break;
          case 'budget':
            await supabase.from('supplier_proposals').upsert([transformBudgetForSupabase(data, user.id)]);
            break;
          case 'file':
            await supabase.from('files').upsert([transformFileForSupabase(data, user.id)]);
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
    logger.error('Falha na sincronização após retries', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        entityType,
        dataId: (data as Record<string, unknown>)?.id,
        userId,
        operacao: 'syncToServerImmediate',
        timestamp: new Date().toISOString()
      }
    });
    syncQueue.push({ type: entityType, data });
    syncStateManager.setError('Falha na sincronização - item adicionado à fila');
  }
}

// Transformadores para Supabase
function transformProjectForSupabase(project: Record<string, unknown>, userId: string) {
  return {
    id: project.id as string | undefined,
    name: project.name as string,
    client: project.client as string,
    city: project.city as string,
    code: project.code as string | undefined,
    status: project.status as string | undefined,
    installation_date: (project.installation_date as string) || null,
    inauguration_date: (project.inauguration_date as string) || null,
    installation_time_estimate_days: (project.installation_time_estimate_days as number) || null,
    owner_name: project.owner as string | undefined,
    suppliers: project.suppliers as string[] | undefined,
    project_files_link: (project.project_files_link as string) || null,
    user_id: userId,
    updated_at: new Date().toISOString()
  };
}

function transformInstallationForSupabase(installation: Record<string, unknown>, userId: string) {
  return {
    id: installation.id as string | undefined,
    project_id: installation.project_id as string,
    tipologia: installation.tipologia as string,
    codigo: installation.codigo as number,
    descricao: installation.descricao as string,
    quantidade: installation.quantidade as number,
    pavimento: installation.pavimento as string,
    revisado: (installation.revisado as boolean) || false,
    pendencia_tipo: (installation.pendencia_tipo as string) || null,
    pendencia_descricao: (installation.pendencia_descricao as string) || null,
    photos: (installation.photos as string[]) || [],
    user_id: userId,
    updated_at: new Date().toISOString()
  };
}

function transformContactForSupabase(contact: Record<string, unknown>, userId: string) {
  return {
    id: contact.id as string | undefined,
    name: contact.name as string,
    email: contact.email as string,
    phone: contact.phone as string,
    role: contact.role as string,
    project_id: (contact.projetoId || contact.project_id) as string,
    user_id: userId,
    updated_at: new Date().toISOString()
  };
}

function transformBudgetForSupabase(budget: Record<string, unknown>, userId: string) {
  return {
    id: budget.id as string | undefined,
    project_id: budget.projectId as string,
    supplier: budget.supplier as string,
    status: (budget.status as string) || 'pending',
    file_name: budget.fileName as string | undefined,
    file_path: budget.filePath as string | undefined,
    file_size: budget.fileSize as number | undefined,
    user_id: userId,
    updated_at: new Date().toISOString()
  };
}

function transformFileForSupabase(file: Record<string, unknown>, userId: string) {
  return {
    id: file.id as string | undefined,
    name: file.name as string,
    type: file.type as string,
    size: file.size as number,
    url: (file.url as string) || null,
    storage_path: (file.storagePath as string) || null,
    project_id: (file.projectId as string | undefined) || null,
    installation_id: (file.installationId as string | undefined) || null,
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
      await syncToServerImmediate(item.type, item.data as Record<string, unknown>);
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
      createdAt: (project as Partial<Project>)?.createdAt ?? now(),
      _dirty: 0,
      _deleted: 0
    };

    // ONLINE FIRST: Tentar salvar no servidor imediatamente
    if (isOnline()) {
      let userId: string | undefined;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');
        userId = user.id;

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
              .upsert([transformProjectForSupabase(withDates, user.id)]);

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
        logger.error('Falha ao salvar projeto online após retries', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            projectId: withDates.id,
            projectName: withDates.name,
            userId,
            operacao: 'upsertProject',
            isNewProject: !project.id || project.id === '' || project.id.startsWith('project_'),
            timestamp: new Date().toISOString()
          }
        });
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

  /**
   * Delete project with undo capability (10 second grace period)
   * @returns Object with undoId and undo function
   */
  async deleteProjectWithUndo(id: string) {
    const existing = await db.projects.get(id);
    if (!existing) {
      throw new Error('Project not found');
    }

    // Collect all related data for potential restoration
    const installations = await db.installations.where('project_id').equals(id).toArray();
    const budgets = await db.budgets.where('projectId').equals(id).toArray();
    const files = await db.files.where('projectId').equals(id).toArray();
    const contacts = await db.contacts.where('projetoId').equals(id).toArray();

    const relatedData = {
      installations,
      budgets,
      files,
      contacts,
    };

    // Permanent deletion function (called after timeout)
    const permanentDelete = async () => {
      await StorageManagerDexie.deleteProject(id);
    };

    // Schedule temporary deletion
    const { undoId, undo } = await scheduleTemporaryDeletion(
      'project',
      id,
      { ...existing, _relatedData: relatedData } as any,
      permanentDelete
    );

    // Enhanced undo function that restores the project
    const undoWithRestore = async () => {
      const restoredData = await undo();
      if (restoredData) {
        const { _relatedData, ...projectData } = restoredData;
        
        // Restore project
        await db.projects.put({ 
          ...projectData, 
          _deleted: 0, 
          _dirty: 1, 
          updatedAt: now() 
        });
        
        // Restore related records if they exist
        if (_relatedData) {
          for (const installation of _relatedData.installations || []) {
            await db.installations.put({ 
              ...installation, 
              _deleted: 0, 
              _dirty: 1, 
              updatedAt: now() 
            });
          }
          for (const budget of _relatedData.budgets || []) {
            await db.budgets.put({ 
              ...budget, 
              _deleted: 0, 
              _dirty: 1, 
              updatedAt: now() 
            });
          }
          for (const file of _relatedData.files || []) {
            await db.files.put({ 
              ...file, 
              _deleted: 0, 
              _dirty: 1, 
              updatedAt: now() 
            });
          }
          for (const contact of _relatedData.contacts || []) {
            await db.contacts.put({ 
              ...contact, 
              _deleted: 0, 
              _dirty: 1 
            });
          }
        }
        
        realtimeManager.trackLocalOperation('projects');
        return projectData;
      }
      return null;
    };

    return { undoId, undo: undoWithRestore };
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
            (mergedInstallation as unknown as Record<string, unknown>)[key] = value;
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
  async upsertInstallation(installation: Installation, options: InstallationRevisionOptions = {}) {
    const existing = installation.id ? await db.installations.get(installation.id) : undefined;
    const withDates = {
      ...installation,
      updatedAt: now(),
      createdAt: (installation as Partial<Installation>)?.createdAt ?? now(),
      _dirty: 0,
      _deleted: 0
    };

    // ONLINE FIRST: Sincronizar imediatamente
    await syncToServerImmediate('installation', withDates);
    await db.installations.put(withDates);
    realtimeManager.trackLocalOperation('installations');
    autoSyncManager.triggerDebouncedSync();

    await recordInstallationRevision(withDates as Installation, existing as Installation | undefined, options);

    return withDates;
  },
  async deleteInstallation(id: string) {
    // Mark as deleted instead of actually deleting (tombstone)
    const existing = await db.installations.get(id);
    if (existing) {
      const deletedInstallation = { ...existing, _deleted: 1, _dirty: 1, updatedAt: now() } as Installation;
      await db.installations.put(deletedInstallation);
      await recordInstallationRevision(
        deletedInstallation,
        existing as Installation,
        {
          actionType: 'deleted',
          motivo: 'deleted',
          descricaoMotivo: `Instalação ${existing.codigo} removida`,
          forceRevision: true,
          changesSummaryOverride: {
            deleted: { before: false, after: true }
          }
        }
      );
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

  /**
   * Delete installation with undo capability (10 second grace period)
   * @returns Object with undoId and undo function
   */
  async deleteInstallationWithUndo(id: string) {
    const existing = await db.installations.get(id);
    if (!existing) {
      throw new Error('Installation not found');
    }

    // Collect all related data for potential restoration
    const itemVersions = await db.itemVersions.where('installationId').equals(id).toArray();
    const files = await db.files.where('installationId').equals(id).toArray();

    const relatedData = {
      itemVersions,
      files,
    };

    // Permanent deletion function (called after timeout)
    const permanentDelete = async () => {
      await StorageManagerDexie.deleteInstallation(id);
    };

    // Schedule temporary deletion
    const { undoId, undo } = await scheduleTemporaryDeletion(
      'installation',
      id,
      { ...existing, _relatedData: relatedData } as any,
      permanentDelete
    );

    // Enhanced undo function that restores the installation
    const undoWithRestore = async () => {
      const restoredData = await undo();
      if (restoredData) {
        const { _relatedData, ...installationData } = restoredData;
        
        // Restore installation
        await db.installations.put({ 
          ...installationData, 
          _deleted: 0, 
          _dirty: 1, 
          updatedAt: now() 
        });
        
        // Restore related records if they exist
        if (_relatedData) {
          for (const itemVersion of _relatedData.itemVersions || []) {
            await db.itemVersions.put({ 
              ...itemVersion, 
              _deleted: 0, 
              _dirty: 1 
            });
          }
          for (const file of _relatedData.files || []) {
            await db.files.put({ 
              ...file, 
              _deleted: 0, 
              _dirty: 1, 
              updatedAt: now() 
            });
          }
        }
        
        realtimeManager.trackLocalOperation('installations');
        return installationData;
      }
      return null;
    };

    return { undoId, undo: undoWithRestore };
  },

  // -------- ITEM VERSIONS ----------
  async getItemVersions(installationId: string) {
    return db.itemVersions.where('installationId').equals(installationId).toArray();
  },
  async upsertItemVersion(version: ItemVersion) {
    return persistItemVersion(version);
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
      createdAt: (budget as Partial<ProjectBudget>)?.createdAt ?? now(),
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
    await syncToServerImmediate('file', metaAtualizado as unknown as Record<string, unknown>);
    await db.files.put(metaAtualizado);
    autoSyncManager.triggerDebouncedSync();

    return metaAtualizado;
  },
  async deleteFile(id: string) {
    const fileToDelete: Partial<ProjectFile> & { id: string } = { 
      id, 
      _deleted: 1, 
      _dirty: 1, 
      updatedAt: Date.now() 
    };
    await db.files.put(fileToDelete as any);
    syncStateManager.incrementPending('files', 1);
  },

  /**
   * Update photo metadata (caption, etc.)
   * @param id - Photo file ID
   * @param metadata - Partial metadata to update
   */
  async updatePhotoMetadata(id: string, metadata: Partial<ProjectFile>) {
    const existing = await db.files.get(id);
    if (!existing) {
      throw new Error('Photo not found');
    }

    const updated: ProjectFile = {
      ...existing,
      ...metadata,
      updatedAt: Date.now(),
      _dirty: 1
    };

    await db.files.put(updated);
    realtimeManager.trackLocalOperation('files');
    syncStateManager.incrementPending('files', 1);
    
    // Try to sync immediately if online
    if (isOnline()) {
      await syncToServerImmediate('file', updated as unknown as Record<string, unknown>);
    }
    
    return updated;
  },

  /**
   * Delete photo with confirmation
   * @param id - Photo file ID
   */
  async deletePhoto(id: string) {
    return StorageManagerDexie.deleteFile(id);
  }
};

// Compatibility aliases
(StorageManagerDexie as Record<string, unknown>).saveProject = StorageManagerDexie.upsertProject;
(StorageManagerDexie as Record<string, unknown>).updateProject = StorageManagerDexie.upsertProject;
(StorageManagerDexie as Record<string, unknown>).getProject = StorageManagerDexie.getProjectById;

// Export undo utilities for external use
export { isPendingDeletion, undoDeletion } from '@/lib/utils';

// Installations
(StorageManagerDexie as Record<string, unknown>).getInstallations = StorageManagerDexie.getInstallationsByProject;
(StorageManagerDexie as Record<string, unknown>).saveInstallation = StorageManagerDexie.upsertInstallation;
(StorageManagerDexie as Record<string, unknown>).updateInstallation = StorageManagerDexie.upsertInstallation;
(StorageManagerDexie as Record<string, unknown>).overwriteInstallation = StorageManagerDexie.upsertInstallation;
(StorageManagerDexie as Record<string, unknown>).deleteInstallation = StorageManagerDexie.deleteInstallation;
(StorageManagerDexie as Record<string, unknown>).importInstallations = async (projectId: string, installations: Installation[]) => {
  const results = [];
  for (const installation of installations) {
    const result = await StorageManagerDexie.upsertInstallation({ ...installation, project_id: projectId });
    results.push(result);
  }
  return results;
};

// Item Versions
(StorageManagerDexie as Record<string, unknown>).getInstallationVersions = StorageManagerDexie.getItemVersions;
(StorageManagerDexie as Record<string, unknown>).saveItemVersion = StorageManagerDexie.upsertItemVersion;

// Contacts - with projectId filter support
(StorageManagerDexie as Record<string, unknown>).getProjectContacts = StorageManagerDexie.getContacts;
(StorageManagerDexie as Record<string, unknown>).getContacts = async (projectId?: string) => {
  const allContacts = await db.contacts.toArray();
  return projectId ? allContacts.filter(c => c.projetoId === projectId) : allContacts;
};
(StorageManagerDexie as Record<string, unknown>).saveProjectContact = StorageManagerDexie.upsertContact;
(StorageManagerDexie as Record<string, unknown>).saveContact = async (projectId: string, contact: ProjectContact) => {
  return StorageManagerDexie.upsertContact({ ...contact, projetoId: projectId });
};
(StorageManagerDexie as Record<string, unknown>).updateContact = async (id: string, contact: Partial<ProjectContact>) => {
  return StorageManagerDexie.upsertContact({ ...contact, id });
};
(StorageManagerDexie as Record<string, unknown>).deleteProjectContact = StorageManagerDexie.deleteContact;
(StorageManagerDexie as Record<string, unknown>).deleteContact = StorageManagerDexie.deleteContact;

// Budgets
(StorageManagerDexie as Record<string, unknown>).getBudgets = StorageManagerDexie.getBudgetsByProject;
(StorageManagerDexie as Record<string, unknown>).saveBudget = StorageManagerDexie.upsertBudget;

// Files
(StorageManagerDexie as Record<string, unknown>).saveFile = StorageManagerDexie.upsertFile;

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
  if (typeof globalThis !== 'undefined' && typeof (globalThis as { atob?: (str: string) => string }).atob === 'function') {
    const binaryString = (globalThis as { atob: (str: string) => string }).atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof globalThis !== 'undefined' && (globalThis as { Buffer?: { from: (str: string, encoding: string) => { buffer: ArrayBuffer; byteOffset: number; byteLength: number } } }).Buffer) {
    const buffer = (globalThis as { Buffer: { from: (str: string, encoding: string) => { buffer: ArrayBuffer; byteOffset: number; byteLength: number } } }).Buffer.from(base64, 'base64');
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
      : Number.isFinite(Date.parse(generatedAt as string))
        ? Date.parse(generatedAt as string)
        : Date.now();

  const generatedBy = String(rest.generatedBy ?? rest.generated_by ?? 'Sistema');
  const size = rest.size ?? payload?.size ?? storedBlob?.size ?? 0;
  const payloadId = existingPayloadId ?? payload_id ?? rest.id ?? `report_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const id = String(rest.id ?? payloadId ?? `report_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`);

  const normalized: ReportHistoryEntry = {
    ...rest,
    id,
    projectId: String(projectId),
    project_id: String(projectId),
    fileName: String(rest.fileName || rest.file_name || 'relatorio'),
    format: (rest.format as 'pdf' | 'xlsx') || 'pdf',
    interlocutor: (rest.interlocutor as 'cliente' | 'fornecedor') || 'cliente',
    generatedAt: String(generatedAt),
    generated_at: String(generatedAt),
    generatedBy: String(generatedBy),
    generated_by: String(generatedBy),
    size: Number(size),
    mimeType: inferReportMimeType((rest.format as 'pdf' | 'xlsx') || 'pdf', String(mimeType || '')),
    blob: storedBlob,
    createdAt,
    payloadId: String(payloadId),
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

(StorageManagerDexie as Record<string, unknown>).getReports = async (projectId?: string) => {
  try {
    await migrateLegacyReportHistory();

    // Get local reports from IndexedDB
    const localReports = projectId
      ? await db.reports.where('projectId').equals(projectId).toArray()
      : await db.reports.toArray();

    const payloadIds = localReports.map((report) => (report as { payloadId?: string; id: string }).payloadId ?? report.id);
    const payloads = payloadIds.length > 0 ? await db.reportPayloads.bulkGet(payloadIds) : [];
    const payloadMap = new Map<string, ReportPayloadRecord>();

    payloads.forEach((payload, index) => {
      if (payload) {
        payloadMap.set(payloadIds[index]!, payload);
      }
    });

    const normalizedLocalReports = localReports.map((report) => 
      normalizeReportHistoryEntry(report, payloadMap.get((report as { payloadId?: string; id: string }).payloadId ?? report.id))
    );

    // Fetch reports from Supabase
    let supabaseReports: ReportHistoryEntry[] = [];
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        let query = supabase
          .from('report_history')
          .select('*')
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false });
        
        if (projectId) {
          query = query.eq('project_id', projectId);
        }
        
        const { data, error } = await query;
        
        if (!error && data) {
          supabaseReports = data.map((report: Record<string, unknown>) => ({
            id: String(report.id),
            projectId: String(report.project_id),
            fileName: String(report.file_name || 'relatorio'),
            format: (report.format as 'pdf' | 'xlsx') || 'pdf',
            interlocutor: (report.interlocutor as 'cliente' | 'fornecedor') || 'cliente',
            config: (report.config as Record<string, unknown>) || {},
            size: 0, // Size not stored in Supabase
            generatedAt: String(report.generated_at),
            generatedBy: String(report.generated_by),
            fileUrl: String(report.file_url || ''),
            file_url: String(report.file_url || ''),
            createdAt: new Date(String(report.created_at)).getTime(),
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

(StorageManagerDexie as Record<string, unknown>).saveReport = async (report: ReportHistoryEntry) => {
  let normalizedForLogging: ReturnType<typeof normalizeReportHistoryEntry> | undefined;

  try {
    await migrateLegacyReportHistory();
    const normalized = normalizeReportHistoryEntry(report);
    normalizedForLogging = normalized;

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
          await db.reportPayloads.bulkDelete(sorted.map((entry) => (entry as { payloadId?: string; id: string }).payloadId ?? entry.id));
        }
      }
    });

    // Report saved successfully
    return normalized;
  } catch (error) {
    logger.error('Falha ao salvar relatório', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        reportId: normalizedForLogging?.id,
        projectId: normalizedForLogging?.projectId,
        format: normalizedForLogging?.format,
        operacao: 'saveReport',
        timestamp: new Date().toISOString()
      }
    });
    throw error;
  }
};

(StorageManagerDexie as Record<string, unknown>).deleteReport = async (reportId: string) => {
  try {
    await migrateLegacyReportHistory();
    
    // Try to delete from Supabase first
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Get report details to delete file from storage
        const { data: report } = await supabase
          .from('report_history')
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
            .from('report_history')
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

      const payloadId = existing ? ((existing as { payloadId?: string }).payloadId ?? reportId) : reportId;
      await db.reportPayloads.delete(payloadId);
    });
    // Report deleted successfully
  } catch (error) {
    logger.error('Falha ao deletar relatório', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        reportId,
        operacao: 'deleteReport',
        timestamp: new Date().toISOString()
      }
    });
    throw error;
  }
};
