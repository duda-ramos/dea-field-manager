import { db } from '@/db/indexedDb';
import type { Project, Installation, ProjectContact, ProjectBudget, ItemVersion, ProjectFile } from '@/types';

const now = () => Date.now();

export const StorageManagerDexie = {
  // -------- PROJECTS ----------
  async getProjects() {
    return db.projects.orderBy('updatedAt').reverse().toArray();
  },
  async getProjectById(id: string) {
    return db.projects.get(id);
  },
  async upsertProject(project: Project) {
    const withDates = { ...project, updatedAt: now(), createdAt: (project as any)?.createdAt ?? now() };
    await db.projects.put(withDates);
    return withDates;
  },
  async deleteProject(id: string) {
    await db.transaction('rw', db.projects, db.installations, db.budgets, db.files, async () => {
      await db.projects.delete(id);
      await db.installations.where('projectId').equals(id).delete();
      await db.budgets.where('projectId').equals(id).delete();
      await db.files.where('projectId').equals(id).delete();
    });
  },

  // -------- INSTALLATIONS ----------
  async getInstallationsByProject(projectId: string) {
    return db.installations.where('projectId').equals(projectId).toArray();
  },
  async upsertInstallation(installation: Installation) {
    const withDates = { ...installation, updatedAt: now(), createdAt: (installation as any)?.createdAt ?? now() };
    await db.installations.put(withDates);
    return withDates;
  },
  async deleteInstallation(id: string) {
    await db.transaction('rw', db.installations, db.itemVersions, db.files, async () => {
      await db.installations.delete(id);
      await db.itemVersions.where('installationId').equals(id).delete();
      await db.files.where('installationId').equals(id).delete();
    });
  },

  // -------- ITEM VERSIONS ----------
  async getItemVersions(installationId: string) {
    return db.itemVersions.where('installationId').equals(installationId).toArray();
  },
  async upsertItemVersion(version: ItemVersion) {
    const withDates = { ...version, createdAt: (version as any)?.createdAt ?? now() };
    await db.itemVersions.put(withDates);
    return withDates;
  },

  // -------- CONTACTS ----------
  async getContacts() {
    return db.contacts.toArray();
  },
  async upsertContact(contact: ProjectContact) {
    await db.contacts.put(contact);
    return contact;
  },
  async deleteContact(id: string) {
    await db.contacts.delete(id);
  },

  // -------- BUDGETS ----------
  async getBudgetsByProject(projectId: string) {
    return db.budgets.where('projectId').equals(projectId).toArray();
  },
  async upsertBudget(budget: ProjectBudget) {
    const withDates = { ...budget, updatedAt: now(), createdAt: (budget as any)?.createdAt ?? now() };
    await db.budgets.put(withDates);
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
    await db.files.put(file);
    return file;
  },
  async deleteFile(id: string) {
    await db.files.delete(id);
  }
};

// Compatibility aliases
(StorageManagerDexie as any).saveProject = StorageManagerDexie.upsertProject;
(StorageManagerDexie as any).updateProject = StorageManagerDexie.upsertProject;
(StorageManagerDexie as any).getProject = StorageManagerDexie.getProjectById;

(StorageManagerDexie as any).getInstallations = StorageManagerDexie.getInstallationsByProject;
(StorageManagerDexie as any).saveInstallation = StorageManagerDexie.upsertInstallation;
(StorageManagerDexie as any).updateInstallation = StorageManagerDexie.upsertInstallation;

(StorageManagerDexie as any).getInstallationVersions = StorageManagerDexie.getItemVersions;
(StorageManagerDexie as any).saveItemVersion = StorageManagerDexie.upsertItemVersion;

(StorageManagerDexie as any).getProjectContacts = StorageManagerDexie.getContacts;
(StorageManagerDexie as any).saveProjectContact = StorageManagerDexie.upsertContact;
(StorageManagerDexie as any).deleteProjectContact = StorageManagerDexie.deleteContact;

(StorageManagerDexie as any).getBudgets = StorageManagerDexie.getBudgetsByProject;
(StorageManagerDexie as any).saveBudget = StorageManagerDexie.upsertBudget;

(StorageManagerDexie as any).saveFile = StorageManagerDexie.upsertFile;
