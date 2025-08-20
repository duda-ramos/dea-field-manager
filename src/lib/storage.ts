// Local storage management for offline functionality
import { Project, Installation, ProjectBudget, ProjectContact, ProjectReport } from '@/types';

class StorageManager {
  private getStorageKey(type: string): string {
    return `dea_manager_${type}`;
  }

  // Generic storage operations
  private getItems<T>(type: string): T[] {
    try {
      const data = localStorage.getItem(this.getStorageKey(type));
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private setItems<T>(type: string, items: T[]): void {
    localStorage.setItem(this.getStorageKey(type), JSON.stringify(items));
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Projects
  getProjects(): Project[] {
    return this.getItems<Project>('projects');
  }

  saveProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Project {
    const projects = this.getProjects();
    const newProject: Project = {
      ...project,
      id: this.generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    projects.push(newProject);
    this.setItems('projects', projects);
    return newProject;
  }

  updateProject(id: string, updates: Partial<Project>): Project | null {
    const projects = this.getProjects();
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) return null;

    projects[index] = {
      ...projects[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.setItems('projects', projects);
    return projects[index];
  }

  deleteProject(id: string): boolean {
    const projects = this.getProjects();
    const filtered = projects.filter(p => p.id !== id);
    if (filtered.length === projects.length) return false;
    
    this.setItems('projects', filtered);
    // Also delete related installations
    const installations = this.getInstallations().filter(i => i.project_id !== id);
    this.setItems('installations', installations);
    return true;
  }

  // Installations
  getInstallations(projectId?: string): Installation[] {
    const installations = this.getItems<Installation>('installations');
    return projectId ? installations.filter(i => i.project_id === projectId) : installations;
  }

  saveInstallation(installation: Omit<Installation, 'id' | 'updated_at'>): Installation {
    const installations = this.getInstallations();
    const newInstallation: Installation = {
      ...installation,
      id: this.generateId(),
      updated_at: new Date().toISOString(),
    };
    installations.push(newInstallation);
    this.setItems('installations', installations);
    return newInstallation;
  }

  updateInstallation(id: string, updates: Partial<Installation>): Installation | null {
    const installations = this.getInstallations();
    const index = installations.findIndex(i => i.id === id);
    if (index === -1) return null;

    installations[index] = {
      ...installations[index],
      ...updates,
      updated_at: new Date().toISOString(),
      installed_at: updates.installed && !installations[index].installed 
        ? new Date().toISOString() 
        : installations[index].installed_at,
    };
    this.setItems('installations', installations);
    return installations[index];
  }

  // Bulk import installations from Excel data
  importInstallations(projectId: string, data: any[]): Installation[] {
    const installations: Installation[] = data.map(row => ({
      id: this.generateId(),
      project_id: projectId,
      typology: row.tipologia || row.typology || '',
      code: row.codigo || row.code || '',
      description: row.descricao || row.description || '',
      height_guideline_cm: Number(row.altura || row.height || 0),
      distance_from_frame_cm: Number(row.distancia || row.distance || 0),
      installed: false,
      observations: '',
      photos: [],
      updated_at: new Date().toISOString(),
    }));

    const existingInstallations = this.getInstallations();
    const allInstallations = [...existingInstallations, ...installations];
    this.setItems('installations', allInstallations);
    return installations;
  }

  // Budgets
  getBudgets(projectId?: string): ProjectBudget[] {
    const budgets = this.getItems<ProjectBudget>('budgets');
    return projectId ? budgets.filter(b => b.project_id === projectId) : budgets;
  }

  saveBudget(budget: Omit<ProjectBudget, 'id' | 'created_at'>): ProjectBudget {
    const budgets = this.getBudgets();
    const newBudget: ProjectBudget = {
      ...budget,
      id: this.generateId(),
      created_at: new Date().toISOString(),
    };
    budgets.push(newBudget);
    this.setItems('budgets', budgets);
    return newBudget;
  }

  // Contacts
  getContacts(projectId?: string): ProjectContact[] {
    const contacts = this.getItems<ProjectContact>('contacts');
    return projectId ? contacts.filter(c => c.project_id === projectId) : contacts;
  }

  saveContact(contact: Omit<ProjectContact, 'id'>): ProjectContact {
    const contacts = this.getContacts();
    const newContact: ProjectContact = {
      ...contact,
      id: this.generateId(),
    };
    contacts.push(newContact);
    this.setItems('contacts', contacts);
    return newContact;
  }

  // Reports
  getReports(projectId?: string): ProjectReport[] {
    const reports = this.getItems<ProjectReport>('reports');
    return projectId ? reports.filter(r => r.project_id === projectId) : reports;
  }

  saveReport(report: Omit<ProjectReport, 'id'>): ProjectReport {
    const reports = this.getReports();
    const newReport: ProjectReport = {
      ...report,
      id: this.generateId(),
    };
    reports.push(newReport);
    this.setItems('reports', reports);
    return newReport;
  }
}

export const storage = new StorageManager();