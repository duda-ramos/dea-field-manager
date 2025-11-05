import { StorageManagerDexie } from '@/services/StorageManager';
import type {
  Project,
  Installation,
  ItemVersion,
  ProjectContact,
  ProjectBudget,
  ProjectFile,
  ReportHistoryEntry,
  ChangeSummary,
  RevisionActionType
} from '@/types';

export interface InstallationUpsertOptions {
  motivo?: ItemVersion['motivo'];
  descricaoMotivo?: string;
  actionType?: RevisionActionType;
  type?: ItemVersion['type'];
  forceRevision?: boolean;
  userEmail?: string | null;
  changesSummaryOverride?: ChangeSummary | null;
  snapshotOverride?: Partial<Installation>;
}

interface StorageLike {
  // Projects
  getProjects(): Promise<Project[]>;
  getProjectById(id: string): Promise<Project | undefined>;
  upsertProject(project: Project): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  deleteProjectWithUndo(
    id: string
  ): Promise<{ undoId: string; undo: () => Promise<Project | null> }>;

  // Installations
  getInstallationsByProject(projectId: string): Promise<Installation[]>;
  upsertInstallation(installation: Installation, options?: InstallationUpsertOptions): Promise<Installation>;
  deleteInstallation(id: string): Promise<void>;
  deleteInstallationWithUndo(
    id: string
  ): Promise<{ undoId: string; undo: () => Promise<Installation | null> }>;
  getItemVersions(installationId: string): Promise<ItemVersion[]>;
  upsertItemVersion(version: ItemVersion): Promise<ItemVersion>;

  // Contacts
  getContacts(projectId?: string): Promise<ProjectContact[]>;
  upsertContact(contact: ProjectContact): Promise<ProjectContact>;
  deleteContact(id: string): Promise<void>;

  // Budgets
  getBudgetsByProject(projectId: string): Promise<ProjectBudget[]>;
  upsertBudget(budget: ProjectBudget): Promise<ProjectBudget>;

  // Files
  getFilesByProject(projectId: string): Promise<ProjectFile[]>;
  getFilesByInstallation(installationId: string): Promise<ProjectFile[]>;
  upsertFile(file: ProjectFile): Promise<ProjectFile>;

  // Reports
  getReports(projectId?: string): Promise<ReportHistoryEntry[]>;
  saveReport(report: ReportHistoryEntry): Promise<ReportHistoryEntry>;
  deleteReport(id: string): Promise<void>;
}

export const storage: StorageLike = StorageManagerDexie as unknown as StorageLike;
