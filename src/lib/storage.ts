// Local storage management for offline functionality
import { Project, Installation, ItemVersion, ProjectBudget, ProjectContact, ProjectReport } from '@/types';
import { Contato } from '@/features/contatos';

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

  saveInstallation(projectId: string, data: Omit<Installation, 'id' | 'project_id' | 'updated_at'>): Installation {
    const installation: Installation = {
      ...data,
      id: this.generateId(),
      project_id: projectId,
      updated_at: new Date().toISOString(),
    };
    
    const installations = this.getInstallations();
    installations.push(installation);
    this.setItems('installations', installations);
    
    return installation;
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

  // Overwrite installation with version history
  overwriteInstallation(
    installationId: string, 
    data: Partial<Omit<Installation, 'id' | 'project_id' | 'revisado' | 'revisao'>>,
    motivo: 'problema-instalacao' | 'revisao-conteudo' | 'desaprovado-cliente' | 'outros',
    descricaoMotivo?: string
  ): Installation {
    const installations = this.getInstallations();
    const installation = installations.find(i => i.id === installationId);
    
    if (!installation) {
      throw new Error('Installation not found');
    }

    // Create version snapshot before overwriting
    const version: ItemVersion = {
      id: this.generateId(),
      itemId: installationId,
      snapshot: {
        project_id: installation.project_id,
        tipologia: installation.tipologia,
        codigo: installation.codigo,
        descricao: installation.descricao,
        quantidade: installation.quantidade,
        pavimento: installation.pavimento,
        diretriz_altura_cm: installation.diretriz_altura_cm,
        diretriz_dist_batente_cm: installation.diretriz_dist_batente_cm,
        observacoes: installation.observacoes,
        installed: installation.installed,
        installed_at: installation.installed_at,
        updated_at: installation.updated_at,
        photos: installation.photos,
      },
      revisao: installation.revisao,
      motivo,
      descricao_motivo: descricaoMotivo,
      criadoEm: new Date().toISOString(),
    };

    // Save version to history
    const versions = this.getInstallationVersions(installationId);
    versions.push(version);
    localStorage.setItem(`versions_${installationId}`, JSON.stringify(versions));

    // Update installation with new data
    const index = installations.findIndex(i => i.id === installationId);
    installations[index] = {
      ...installation,
      ...data,
      revisado: true,
      revisao: installation.revisao + 1,
      updated_at: new Date().toISOString(),
    };

    this.setItems('installations', installations);
    return installations[index];
  }

  // Get installation version history
  getInstallationVersions(installationId: string): ItemVersion[] {
    try {
      const data = localStorage.getItem(`versions_${installationId}`);
      return data ? JSON.parse(data).sort((a: ItemVersion, b: ItemVersion) => 
        new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
      ) : [];
    } catch {
      return [];
    }
  }

  // Bulk import installations from Excel data with floor/pavimento support
  importInstallations(projectId: string, data: { pavimento: string; items: any[] }[]): { summary: Record<string, number>; installations: Installation[] } {
    const allInstallations: Installation[] = [];
    const summary: Record<string, number> = {};

    for (const floorData of data) {
      const { pavimento, items } = floorData;
      summary[pavimento] = items.length;

      const installations: Installation[] = items.map(row => ({
        id: this.generateId(),
        project_id: projectId,
        tipologia: row.tipologia || '',
        codigo: Number(row.codigo) || 0,
        descricao: row.descricao || '',
        quantidade: Number(row.quantidade) || 0,
        pavimento: pavimento,
        diretriz_altura_cm: row.diretriz_altura_cm ? Number(row.diretriz_altura_cm) : undefined,
        diretriz_dist_batente_cm: row.diretriz_dist_batente_cm ? Number(row.diretriz_dist_batente_cm) : undefined,
        observacoes: row.observacoes || undefined,
        installed: false,
        photos: [],
        updated_at: new Date().toISOString(),
        revisado: false,
        revisao: 1,
      }));

      allInstallations.push(...installations);
    }

    // Save all installations
    const existingInstallations = this.getInstallations();
    const updatedInstallations = [...existingInstallations, ...allInstallations];
    this.setItems('installations', updatedInstallations);

    return { summary, installations: allInstallations };
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

  // Contacts (legacy - ProjectContact)
  getProjectContacts(projectId?: string): ProjectContact[] {
    const contacts = this.getItems<ProjectContact>('contacts');
    return projectId ? contacts.filter(c => c.project_id === projectId) : contacts;
  }

  saveProjectContact(contact: Omit<ProjectContact, 'id'>): ProjectContact {
    const contacts = this.getProjectContacts();
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

  // =============== NEW CONTATOS MANAGEMENT ===============
  
  getContacts(projectId?: string): Contato[] {
    const contacts = JSON.parse(localStorage.getItem('project_contacts') || '[]');
    return projectId ? contacts.filter((c: Contato) => c.projetoId === projectId) : contacts;
  }
  
  saveContact(projectId: string, data: Omit<Contato, 'id' | 'projetoId' | 'criadoEm' | 'atualizadoEm'>): Contato {
    const contacts = this.getContacts();
    const now = new Date().toISOString();
    
    const contact: Contato = {
      id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projetoId: projectId,
      criadoEm: now,
      atualizadoEm: now,
      ...data
    };

    contacts.push(contact);
    localStorage.setItem('project_contacts', JSON.stringify(contacts));
    return contact;
  }

  updateContact(id: string, updates: Partial<Contato>): Contato | null {
    const contacts = this.getContacts();
    const index = contacts.findIndex(c => c.id === id);
    
    if (index === -1) return null;

    const updatedContact = {
      ...contacts[index],
      ...updates,
      atualizadoEm: new Date().toISOString()
    };

    contacts[index] = updatedContact;
    localStorage.setItem('project_contacts', JSON.stringify(contacts));
    return updatedContact;
  }

  deleteContact(id: string): boolean {
    const contacts = this.getContacts();
    const filtered = contacts.filter(c => c.id !== id);
    
    if (filtered.length === contacts.length) return false;
    
    localStorage.setItem('project_contacts', JSON.stringify(filtered));
    return true;
  }
}

export const storage = new StorageManager();