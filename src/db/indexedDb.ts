import Dexie, { Table } from 'dexie';

// Se existirem, importe os tipos reais:
import type { Project, Installation, ItemVersion, FileAttachment, ReportHistoryEntry } from '@/types';

// Temporário (trocar por tipos reais quando possível):
export type Contact = any;
export type Budget = any;

class DeaFieldManagerDB extends Dexie {
  projects!: Table<Project, string>;
  installations!: Table<Installation, string>;
  contacts!: Table<Contact, string>;
  budgets!: Table<Budget, string>;
  itemVersions!: Table<ItemVersion, string>;
  files!: Table<FileAttachment, string>;
  meta!: Table<{ key: string; value: any }, string>;
  reports!: Table<ReportHistoryEntry, string>;
  reportPayloads!: Table<{ id: string; projectId?: string; blob?: Blob; mimeType?: string; size?: number; createdAt?: number }, string>;

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

      // Version 3 - Add uploadedAt index for files
      this.version(3).stores({
        projects: 'id, updatedAt, name, _dirty, _deleted',
        installations: 'id, project_id, updatedAt, status, _dirty, _deleted',
        contacts: 'id, projetoId, tipo, nome, email, telefone, atualizadoEm, _dirty, _deleted',
        budgets: 'id, projectId, updatedAt, _dirty, _deleted',
        itemVersions: 'id, installationId, createdAt, _dirty, _deleted',
        files: 'id, projectId, installationId, uploadedAt, _dirty, _deleted',
        meta: 'key'
      });

      // Version 4 - Add needsUpload index for files to fix sync errors
      this.version(4).stores({
        projects: 'id, updatedAt, name, _dirty, _deleted',
        installations: 'id, project_id, updatedAt, status, _dirty, _deleted',  
        contacts: 'id, projetoId, tipo, nome, email, telefone, atualizadoEm, _dirty, _deleted',
        budgets: 'id, projectId, updatedAt, _dirty, _deleted',
        itemVersions: 'id, installationId, createdAt, _dirty, _deleted',
        files: 'id, projectId, installationId, uploadedAt, needsUpload, _dirty, _deleted',
        meta: 'key'
      });

      // Version 5 - Final stable schema with all required indexes
      this.version(5).stores({
        projects: 'id, updatedAt, name, _dirty, _deleted',
        installations: 'id, project_id, updatedAt, status, _dirty, _deleted',
        contacts: 'id, projetoId, tipo, nome, email, telefone, atualizadoEm, _dirty, _deleted',
        budgets: 'id, projectId, updatedAt, _dirty, _deleted',
        itemVersions: 'id, installationId, createdAt, _dirty, _deleted',
        files: 'id, projectId, installationId, uploadedAt, needsUpload, _dirty, _deleted',
        meta: 'key'
      });

      this.version(6).stores({
        projects: 'id, updatedAt, name, _dirty, _deleted',
        installations: 'id, project_id, updatedAt, status, _dirty, _deleted',
        contacts: 'id, projetoId, tipo, nome, email, telefone, atualizadoEm, _dirty, _deleted',
        budgets: 'id, projectId, updatedAt, _dirty, _deleted',
        itemVersions: 'id, installationId, createdAt, _dirty, _deleted',
        files: 'id, projectId, installationId, uploadedAt, needsUpload, _dirty, _deleted',
        meta: 'key',
        reports: 'id, projectId, project_id, createdAt, generatedAt'
      });

      this.version(7)
        .stores({
          projects: 'id, updatedAt, name, _dirty, _deleted',
          installations: 'id, project_id, updatedAt, status, _dirty, _deleted',
          contacts: 'id, projetoId, tipo, nome, email, telefone, atualizadoEm, _dirty, _deleted',
          budgets: 'id, projectId, updatedAt, _dirty, _deleted',
          itemVersions: 'id, installationId, createdAt, _dirty, _deleted',
          files: 'id, projectId, installationId, uploadedAt, needsUpload, _dirty, _deleted',
          meta: 'key',
          reports: 'id, projectId, project_id, createdAt, generatedAt, payloadId',
          reportPayloads: 'id, projectId'
        })
        .upgrade(async (tx) => {
          const reportsTable = tx.table('reports');
          const payloadsTable = tx.table('reportPayloads');
          const reports = await reportsTable.toArray();

          for (const report of reports) {
            const payloadId = (report as any).payloadId ?? report.id;
            const blob: Blob | undefined = (report as any).blob instanceof Blob ? (report as any).blob : undefined;

            if (blob) {
              await payloadsTable.put({
                id: payloadId,
                projectId: (report as any).projectId ?? (report as any).project_id,
                blob,
                mimeType: (report as any).mimeType,
                size: (report as any).size ?? blob.size,
                createdAt: (report as any).createdAt ?? Date.now()
              });
              delete (report as any).blob;
            }

            if (!(report as any).payloadId) {
              (report as any).payloadId = payloadId;
            }

            await reportsTable.put(report);
          }
        });
  }
}

export const db = new DeaFieldManagerDB();