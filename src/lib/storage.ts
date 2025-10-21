import { StorageManagerDexie } from '@/services/StorageManager';
import type { 
  Project, 
  Installation, 
  ItemVersion, 
  ProjectContact, 
  ProjectBudget, 
  ProjectFile, 
  ReportHistoryEntry 
} from '@/types';

interface StorageLike {
  // Projects
  getProjects(): Promise<Project[]>;
  getProjectById(id: string): Promise<Project | undefined>;
  upsertProject(project: Project): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  // Installations
  getInstallationsByProject(projectId: string): Promise<Installation[]>;
  upsertInstallation(installation: Installation): Promise<Installation>;
  deleteInstallation(id: string): Promise<void>;
  getItemVersions(installationId: string): Promise<ItemVersion[]>;
  upsertItemVersion(version: ItemVersion): Promise<ItemVersion>;

  // Contacts
  getContacts(projectId?: string): Promise<ProjectContact[]>;

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
