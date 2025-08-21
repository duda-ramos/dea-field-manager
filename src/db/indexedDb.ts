import Dexie, { Table } from 'dexie';

// Se existirem, importe os tipos reais:
import type { Project, Installation, ItemVersion } from '@/types';

// Temporário (trocar por tipos reais quando possível):
export type Contact = any;
export type Budget = any;
export type FileAttachment = any;

class DeaFieldManagerDB extends Dexie {
  projects!: Table<Project, string>;
  installations!: Table<Installation, string>;
  contacts!: Table<Contact, string>;
  budgets!: Table<Budget, string>;
  itemVersions!: Table<ItemVersion, string>;
  files!: Table<FileAttachment, string>;

  constructor() {
    super('DeaFieldManagerDB');
    this.version(1).stores({
      projects: 'id, updatedAt, name',
      installations: 'id, projectId, updatedAt, status',
      contacts: 'id, type, name',
      budgets: 'id, projectId, updatedAt',
      itemVersions: 'id, installationId, createdAt',
      files: 'id, projectId, installationId'
    });
  }
}

export const db = new DeaFieldManagerDB();

