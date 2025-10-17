// IndexedDB management for offline functionality
import { Project, Installation, ProjectBudget, ProjectContact, ProjectReport } from '@/types';

class IndexedDBManager {
  private dbName = 'dea_manager_db';
  private version = 2;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('installations')) {
          const installationsStore = db.createObjectStore('installations', { keyPath: 'id' });
          installationsStore.createIndex('project_id', 'project_id', { unique: false });
          installationsStore.createIndex('pavimento', 'pavimento', { unique: false });
        }
        if (!db.objectStoreNames.contains('item_versions')) {
          const versionsStore = db.createObjectStore('item_versions', { keyPath: 'id' });
          versionsStore.createIndex('itemId', 'itemId', { unique: false });
        }
        if (!db.objectStoreNames.contains('budgets')) {
          const budgetsStore = db.createObjectStore('budgets', { keyPath: 'id' });
          budgetsStore.createIndex('project_id', 'project_id', { unique: false });
        }
        if (!db.objectStoreNames.contains('contacts')) {
          const contactsStore = db.createObjectStore('contacts', { keyPath: 'id' });
          contactsStore.createIndex('project_id', 'project_id', { unique: false });
        }
        if (!db.objectStoreNames.contains('reports')) {
          const reportsStore = db.createObjectStore('reports', { keyPath: 'id' });
          reportsStore.createIndex('project_id', 'project_id', { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Generic operations
  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async add<T>(storeName: string, item: T): Promise<T> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(item);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(item);
    });
  }

  async update<T>(storeName: string, item: T): Promise<T> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(item);
    });
  }

  async delete(storeName: string, id: string): Promise<boolean> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    });
  }

  async getByIndex<T>(storeName: string, indexName: string, value: string): Promise<T[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return this.getAll<Project>('projects');
  }

  async saveProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
    const newProject: Project = {
      ...project,
      id: this.generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return this.add('projects', newProject);
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    const projects = await this.getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) return null;

    const updatedProject = {
      ...project,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return this.update('projects', updatedProject);
  }

  async deleteProject(id: string): Promise<boolean> {
    // Delete project and related installations
    const installations = await this.getInstallations(id);
    for (const installation of installations) {
      await this.delete('installations', installation.id);
    }
    return this.delete('projects', id);
  }

  // Installations
  async getInstallations(projectId?: string): Promise<Installation[]> {
    if (projectId) {
      return this.getByIndex<Installation>('installations', 'project_id', projectId);
    }
    return this.getAll<Installation>('installations');
  }

  async saveInstallation(installation: Omit<Installation, 'id' | 'updated_at'>): Promise<Installation> {
    const newInstallation: Installation = {
      ...installation,
      id: this.generateId(),
      updated_at: new Date().toISOString(),
    };
    return this.add('installations', newInstallation);
  }

  async updateInstallation(id: string, updates: Partial<Installation>): Promise<Installation | null> {
    const installations = await this.getInstallations();
    const installation = installations.find(i => i.id === id);
    if (!installation) return null;

    const updatedInstallation = {
      ...installation,
      ...updates,
      updated_at: new Date().toISOString(),
      installed_at: updates.installed && !installation.installed 
        ? new Date().toISOString() 
        : installation.installed_at,
    };
    return this.update('installations', updatedInstallation);
  }

  // Bulk import installations from Excel data with floor/pavimento support
  async importInstallations(projectId: string, data: { pavimento: string; items: any[] }[]): Promise<{ summary: Record<string, number>; installations: Installation[] }> {
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
    for (const installation of allInstallations) {
      await this.add('installations', installation);
    }

    return { summary, installations: allInstallations };
  }

  // Budgets
  async getBudgets(projectId?: string): Promise<ProjectBudget[]> {
    if (projectId) {
      return this.getByIndex<ProjectBudget>('budgets', 'project_id', projectId);
    }
    return this.getAll<ProjectBudget>('budgets');
  }

  async saveBudget(budget: Omit<ProjectBudget, 'id' | 'created_at'>): Promise<ProjectBudget> {
    const newBudget: ProjectBudget = {
      ...budget,
      id: this.generateId(),
      created_at: new Date().toISOString(),
    };
    return this.add('budgets', newBudget);
  }

  // Contacts
  async getContacts(projectId?: string): Promise<ProjectContact[]> {
    if (projectId) {
      return this.getByIndex<ProjectContact>('contacts', 'project_id', projectId);
    }
    return this.getAll<ProjectContact>('contacts');
  }

  async saveContact(contact: Omit<ProjectContact, 'id'>): Promise<ProjectContact> {
    const newContact: ProjectContact = {
      ...contact,
      id: this.generateId(),
    };
    return this.add('contacts', newContact);
  }

  // Reports
  async getReports(projectId?: string): Promise<ProjectReport[]> {
    if (projectId) {
      return this.getByIndex<ProjectReport>('reports', 'project_id', projectId);
    }
    return this.getAll<ProjectReport>('reports');
  }

  async saveReport(report: Omit<ProjectReport, 'id'>): Promise<ProjectReport> {
    const newReport: ProjectReport = {
      ...report,
      id: this.generateId(),
    };
    return this.add('reports', newReport);
  }
}

export const db = new IndexedDBManager();