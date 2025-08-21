import { db } from '@/db/indexedDb';
import type { Project, Installation, ProjectContact, ProjectBudget, ItemVersion, ProjectFile } from '@/types';
import { autoSyncManager } from '@/services/sync/autoSync';

const now = () => Date.now();

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
      _dirty: 1,
      _deleted: 0
    };
    await db.projects.put(withDates);
    
    // Trigger debounced auto-sync
    autoSyncManager.triggerDebouncedSync();
    
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
      _dirty: 1,
      _deleted: 0
    };
    await db.installations.put(withDates);
    
    // Trigger debounced auto-sync
    autoSyncManager.triggerDebouncedSync();
    
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
    const withFlags = { ...contact, _dirty: 1, _deleted: 0 };
    await db.contacts.put(withFlags);
    
    // Trigger debounced auto-sync
    autoSyncManager.triggerDebouncedSync();
    
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
      _dirty: 1,
      _deleted: 0
    };
    await db.budgets.put(withDates);
    
    // Trigger debounced auto-sync
    autoSyncManager.triggerDebouncedSync();
    
    return withDates;
  },

  // -------- FILES / ATTACHMENTS ----------
  async getFilesByProject(projectId: string) {
    return db.files.where('projectId').equals(projectId).toArray();
  },
  async getFilesByInstallation(installationId: string) {
    return db.files.where('installationId').equals(installationId).toArray();
  },
  async upsertFile(file: ProjectFile) {
    const withFlags = { ...file, _dirty: 1, _deleted: 0 };
    await db.files.put(withFlags);
    
    // Trigger debounced auto-sync
    autoSyncManager.triggerDebouncedSync();
    
    return withFlags;
  },
  async deleteFile(id: string) {
    const existing = await db.files.get(id);
    if (existing) {
      await db.files.put({ ...existing, _deleted: 1, _dirty: 1 });
    }
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