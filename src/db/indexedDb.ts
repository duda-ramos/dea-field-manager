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
  meta!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('DeaFieldManagerDB');
    
    // Version 1 - Original schema
    this.version(1).stores({
      projects: 'id, updatedAt, name',
      installations: 'id, project_id, updatedAt, status',
      contacts: 'id, projetoId, tipo, nome, email, telefone, atualizadoEm',
      budgets: 'id, projectId, updatedAt',
      itemVersions: 'id, installationId, createdAt',
      files: 'id, projectId, installationId'
    });

    // Version 2 - Add sync support
    this.version(2).stores({
      projects: 'id, updatedAt, name, _dirty, _deleted',
      installations: 'id, project_id, updatedAt, status, _dirty, _deleted',
      contacts: 'id, projetoId, tipo, nome, email, telefone, atualizadoEm, _dirty, _deleted',
      budgets: 'id, projectId, updatedAt, _dirty, _deleted',
      itemVersions: 'id, installationId, createdAt, _dirty, _deleted',
      files: 'id, projectId, installationId, _dirty, _deleted',
      meta: 'key'
    });
  }
}

export const db = new DeaFieldManagerDB();

