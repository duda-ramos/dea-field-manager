import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageManagerDexie } from '../StorageManagerDexie';
import { db } from '@/db/indexedDb';
import { autoSyncManager } from '@/services/sync/autoSync';
import { supabase } from '@/integrations/supabase/client';
import {
  createMockProject,
  createMockInstallation,
  createMockFileAttachment
} from '@/__tests__/fixtures/testData';
import type { Project, Installation, ProjectFile, ProjectContact, ProjectBudget } from '@/types';

// Mock dependencies
vi.mock('@/db/indexedDb', () => ({
  db: {
    projects: {
      get: vi.fn(),
      put: vi.fn(),
      toArray: vi.fn(),
      where: vi.fn()
    },
    installations: {
      get: vi.fn(),
      put: vi.fn(),
      toArray: vi.fn(),
      where: vi.fn()
    },
    itemVersions: {
      get: vi.fn(),
      put: vi.fn(),
      toArray: vi.fn(),
      where: vi.fn()
    },
    files: {
      get: vi.fn(),
      put: vi.fn(),
      toArray: vi.fn(),
      where: vi.fn()
    },
    contacts: {
      get: vi.fn(),
      put: vi.fn(),
      toArray: vi.fn(),
      where: vi.fn()
    },
    budgets: {
      get: vi.fn(),
      put: vi.fn(),
      toArray: vi.fn(),
      where: vi.fn()
    }
  }
}));

vi.mock('@/services/sync/autoSync', () => ({
  autoSyncManager: {
    triggerDebouncedSync: vi.fn()
  }
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn()
  }
}));

vi.mock('@/services/sync/syncState', () => ({
  syncStateManager: {
    getLastSyncTime: vi.fn(),
    setLastSyncTime: vi.fn()
  }
}));

vi.mock('@/services/realtime/realtime', () => ({
  realtimeManager: {
    start: vi.fn(),
    stop: vi.fn()
  }
}));

vi.mock('@/services/sync/utils', () => ({
  withRetry: vi.fn((fn) => fn()),
  isRetryableNetworkError: vi.fn(() => false)
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('@/lib/utils', () => ({
  scheduleTemporaryDeletion: vi.fn((fn, timeout) => {
    const id = setTimeout(fn, timeout);
    return { id, undo: () => clearTimeout(id) };
  })
}));

describe('StorageManagerDexie - Projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset online status
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getProjects', () => {
    it('should fetch all non-deleted projects sorted by updatedAt', async () => {
      const mockProjects = [
        createMockProject({ id: '1', updatedAt: 1000 }),
        createMockProject({ id: '2', updatedAt: 3000 }),
        createMockProject({ id: '3', updatedAt: 2000 })
      ];

      const whereMock = {
        notEqual: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockProjects)
        })
      };

      vi.mocked(db.projects.where).mockReturnValue(whereMock as any);

      const result = await StorageManagerDexie.getProjects();

      expect(db.projects.where).toHaveBeenCalledWith('_deleted');
      expect(whereMock.notEqual).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(3);
      // Should be sorted by updatedAt descending
      expect(result[0].id).toBe('2');
      expect(result[1].id).toBe('3');
      expect(result[2].id).toBe('1');
    });

    it('should return empty array when no projects exist', async () => {
      const whereMock = {
        notEqual: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([])
        })
      };

      vi.mocked(db.projects.where).mockReturnValue(whereMock as any);

      const result = await StorageManagerDexie.getProjects();

      expect(result).toEqual([]);
    });
  });

  describe('getProjectById', () => {
    it('should fetch project by ID', async () => {
      const mockProject = createMockProject({ id: 'proj-1' });
      vi.mocked(db.projects.get).mockResolvedValue(mockProject);

      const result = await StorageManagerDexie.getProjectById('proj-1');

      expect(db.projects.get).toHaveBeenCalledWith('proj-1');
      expect(result).toEqual(mockProject);
    });

    it('should return undefined for non-existent project', async () => {
      vi.mocked(db.projects.get).mockResolvedValue(undefined);

      const result = await StorageManagerDexie.getProjectById('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('upsertProject', () => {
    it('should create new project with dirty flag when online', async () => {
      const mockProject = createMockProject({ id: '', name: 'New Project' });
      vi.mocked(db.projects.put).mockResolvedValue('proj-new');
      vi.mocked(db.projects.get).mockResolvedValue(undefined);
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
        error: null
      } as any);

      const result = await StorageManagerDexie.upsertProject(mockProject);

      expect(result).toMatchObject({
        name: 'New Project',
        _dirty: 1
      });
      expect(result.id).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(db.projects.put).toHaveBeenCalled();
      expect(autoSyncManager.triggerDebouncedSync).toHaveBeenCalled();
    });

    it('should update existing project with dirty flag', async () => {
      const existingProject = createMockProject({ id: 'proj-1', name: 'Old Name' });
      const updatedProject = { ...existingProject, name: 'Updated Name' };

      vi.mocked(db.projects.get).mockResolvedValue(existingProject);
      vi.mocked(db.projects.put).mockResolvedValue('proj-1');
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
        error: null
      } as any);

      const result = await StorageManagerDexie.upsertProject(updatedProject);

      expect(result).toMatchObject({
        id: 'proj-1',
        name: 'Updated Name',
        _dirty: 1
      });
      expect(db.projects.put).toHaveBeenCalled();
    });

    it('should mark project as dirty when offline', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      const mockProject = createMockProject({ id: 'proj-1' });

      vi.mocked(db.projects.get).mockResolvedValue(undefined);
      vi.mocked(db.projects.put).mockResolvedValue('proj-1');

      const result = await StorageManagerDexie.upsertProject(mockProject);

      expect(result._dirty).toBe(1);
      expect(autoSyncManager.triggerDebouncedSync).toHaveBeenCalled();
    });

    it('should preserve existing timestamps when not provided', async () => {
      const existingProject = createMockProject({
        id: 'proj-1',
        createdAt: 1000,
        updatedAt: 2000
      });

      vi.mocked(db.projects.get).mockResolvedValue(existingProject);
      vi.mocked(db.projects.put).mockResolvedValue('proj-1');
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null
      } as any);

      const result = await StorageManagerDexie.upsertProject({ ...existingProject });

      expect(result.createdAt).toBe(1000);
      expect(result.updatedAt).toBeGreaterThan(2000); // Should update to now
    });
  });

  describe('deleteProject', () => {
    it('should mark project as deleted (tombstone)', async () => {
      const mockProject = createMockProject({ id: 'proj-1' });
      vi.mocked(db.projects.get).mockResolvedValue(mockProject);
      vi.mocked(db.projects.put).mockResolvedValue('proj-1');

      await StorageManagerDexie.deleteProject('proj-1');

      expect(db.projects.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'proj-1',
          _deleted: 1,
          _dirty: 1
        })
      );
      expect(autoSyncManager.triggerDebouncedSync).toHaveBeenCalled();
    });

    it('should not throw error if project does not exist', async () => {
      vi.mocked(db.projects.get).mockResolvedValue(undefined);

      await expect(StorageManagerDexie.deleteProject('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('deleteProjectWithUndo', () => {
    it('should provide undo capability for project deletion', async () => {
      const mockProject = createMockProject({ id: 'proj-1' });
      vi.mocked(db.projects.get).mockResolvedValue(mockProject);
      vi.mocked(db.projects.put).mockResolvedValue('proj-1');

      const result = await StorageManagerDexie.deleteProjectWithUndo('proj-1');

      expect(result).toHaveProperty('undoId');
      expect(result).toHaveProperty('undo');
      expect(typeof result.undo).toBe('function');
    });

    it('should throw error when project not found', async () => {
      vi.mocked(db.projects.get).mockResolvedValue(undefined);

      await expect(
        StorageManagerDexie.deleteProjectWithUndo('non-existent')
      ).rejects.toThrow('Project not found');
    });
  });
});

describe('StorageManagerDexie - Installations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getInstallationsByProject', () => {
    it('should fetch all non-deleted installations for a project', async () => {
      const mockInstallations = [
        createMockInstallation({ id: '1', project_id: 'proj-1' }),
        createMockInstallation({ id: '2', project_id: 'proj-1' })
      ];

      const whereMock = {
        equals: vi.fn().mockReturnThis(),
        and: vi.fn().mockReturnThis(),
        notEqual: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockInstallations)
      };

      vi.mocked(db.installations.where).mockReturnValue(whereMock as any);

      const result = await StorageManagerDexie.getInstallationsByProject('proj-1');

      expect(result).toHaveLength(2);
      expect(result[0].project_id).toBe('proj-1');
    });

    it('should return empty array when no installations exist', async () => {
      const whereMock = {
        equals: vi.fn().mockReturnThis(),
        and: vi.fn().mockReturnThis(),
        notEqual: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([])
      };

      vi.mocked(db.installations.where).mockReturnValue(whereMock as any);

      const result = await StorageManagerDexie.getInstallationsByProject('proj-empty');

      expect(result).toEqual([]);
    });
  });

  describe('upsertInstallation', () => {
    it('should create new installation with dirty flag', async () => {
      const mockInstallation = createMockInstallation({
        id: '',
        project_id: 'proj-1',
        codigo: 'INST-001'
      });

      vi.mocked(db.installations.get).mockResolvedValue(undefined);
      vi.mocked(db.installations.put).mockResolvedValue('inst-new');
      vi.mocked(db.itemVersions.put).mockResolvedValue('ver-1');
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { email: 'test@example.com' } },
        error: null
      } as any);

      const result = await StorageManagerDexie.upsertInstallation(mockInstallation);

      expect(result).toMatchObject({
        project_id: 'proj-1',
        codigo: 'INST-001',
        _dirty: 1
      });
      expect(result.id).toBeDefined();
      expect(db.installations.put).toHaveBeenCalled();
    });

    it('should update existing installation and record revision', async () => {
      const existingInstallation = createMockInstallation({
        id: 'inst-1',
        codigo: 'OLD-CODE',
        status: 'pending'
      });

      const updatedInstallation = {
        ...existingInstallation,
        codigo: 'NEW-CODE',
        status: 'installed' as const
      };

      vi.mocked(db.installations.get).mockResolvedValue(existingInstallation);
      vi.mocked(db.installations.put).mockResolvedValue('inst-1');
      vi.mocked(db.itemVersions.put).mockResolvedValue('ver-1');
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { email: 'test@example.com' } },
        error: null
      } as any);

      const result = await StorageManagerDexie.upsertInstallation(updatedInstallation);

      expect(result).toMatchObject({
        id: 'inst-1',
        codigo: 'NEW-CODE',
        status: 'installed',
        _dirty: 1
      });
      expect(db.installations.put).toHaveBeenCalled();
      expect(db.itemVersions.put).toHaveBeenCalled(); // Revision recorded
    });

    it('should not record revision when forceRevision is false', async () => {
      const installation = createMockInstallation({ id: 'inst-1' });

      vi.mocked(db.installations.get).mockResolvedValue(installation);
      vi.mocked(db.installations.put).mockResolvedValue('inst-1');

      await StorageManagerDexie.upsertInstallation(installation, { forceRevision: false });

      expect(db.itemVersions.put).not.toHaveBeenCalled();
    });
  });

  describe('deleteInstallation', () => {
    it('should mark installation as deleted', async () => {
      const mockInstallation = createMockInstallation({ id: 'inst-1' });
      vi.mocked(db.installations.get).mockResolvedValue(mockInstallation);
      vi.mocked(db.installations.put).mockResolvedValue('inst-1');
      vi.mocked(db.itemVersions.put).mockResolvedValue('ver-1');
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { email: 'test@example.com' } },
        error: null
      } as any);

      await StorageManagerDexie.deleteInstallation('inst-1');

      expect(db.installations.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'inst-1',
          _deleted: 1,
          _dirty: 1
        })
      );
    });
  });
});

describe('StorageManagerDexie - Files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getFilesByProject', () => {
    it('should fetch all non-deleted files for a project', async () => {
      const mockFiles = [
        createMockFileAttachment({ id: '1', projectId: 'proj-1' }),
        createMockFileAttachment({ id: '2', projectId: 'proj-1' })
      ];

      const whereMock = {
        equals: vi.fn().mockReturnThis(),
        and: vi.fn().mockReturnThis(),
        notEqual: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockFiles)
      };

      vi.mocked(db.files.where).mockReturnValue(whereMock as any);

      const result = await StorageManagerDexie.getFilesByProject('proj-1');

      expect(result).toHaveLength(2);
      expect(result[0].projectId).toBe('proj-1');
    });
  });

  describe('upsertFile', () => {
    it('should create new file with dirty flag', async () => {
      const mockFile = createMockFileAttachment({
        id: '',
        projectId: 'proj-1',
        name: 'test.jpg'
      });

      vi.mocked(db.files.put).mockResolvedValue('file-new');

      const result = await StorageManagerDexie.upsertFile(mockFile);

      expect(result).toMatchObject({
        projectId: 'proj-1',
        name: 'test.jpg',
        _dirty: 1
      });
      expect(result.id).toBeDefined();
      expect(db.files.put).toHaveBeenCalled();
    });

    it('should update existing file', async () => {
      const existingFile = createMockFileAttachment({
        id: 'file-1',
        name: 'old.jpg',
        uploadedAt: 1000
      });

      const updatedFile = { ...existingFile, name: 'new.jpg' };

      vi.mocked(db.files.put).mockResolvedValue('file-1');

      const result = await StorageManagerDexie.upsertFile(updatedFile);

      expect(result).toMatchObject({
        id: 'file-1',
        name: 'new.jpg',
        _dirty: 1
      });
    });
  });

  describe('deleteFile', () => {
    it('should mark file as deleted', async () => {
      const mockFile = createMockFileAttachment({ id: 'file-1' });
      vi.mocked(db.files.get).mockResolvedValue(mockFile);
      vi.mocked(db.files.put).mockResolvedValue('file-1');

      await StorageManagerDexie.deleteFile('file-1');

      expect(db.files.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'file-1',
          _deleted: 1,
          _dirty: 1
        })
      );
    });
  });

  describe('updatePhotoMetadata', () => {
    it('should update photo metadata for file', async () => {
      const mockFile = createMockFileAttachment({
        id: 'file-1',
        metadata: {}
      });

      vi.mocked(db.files.get).mockResolvedValue(mockFile);
      vi.mocked(db.files.put).mockResolvedValue('file-1');

      await StorageManagerDexie.updatePhotoMetadata('file-1', { caption: 'Test caption' });

      expect(db.files.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'file-1',
          metadata: { caption: 'Test caption' },
          _dirty: 1
        })
      );
    });
  });
});

describe('StorageManagerDexie - Contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getContacts', () => {
    it('should fetch all non-deleted contacts for a project', async () => {
      const mockContacts: ProjectContact[] = [
        {
          id: '1',
          projetoId: 'proj-1',
          nome: 'Contact 1',
          tipo: 'cliente' as const,
          email: 'contact1@example.com',
          criadoEm: Date.now(),
          atualizadoEm: Date.now()
        }
      ];

      const whereMock = {
        equals: vi.fn().mockReturnThis(),
        and: vi.fn().mockReturnThis(),
        notEqual: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockContacts)
      };

      vi.mocked(db.contacts.where).mockReturnValue(whereMock as any);

      const result = await StorageManagerDexie.getContacts('proj-1');

      expect(result).toHaveLength(1);
      expect(result[0].projetoId).toBe('proj-1');
    });
  });

  describe('upsertContact', () => {
    it('should create new contact with dirty flag', async () => {
      const mockContact: Partial<ProjectContact> = {
        id: '',
        projetoId: 'proj-1',
        nome: 'New Contact',
        tipo: 'cliente' as const,
        email: 'new@example.com'
      };

      vi.mocked(db.contacts.put).mockResolvedValue('contact-new');

      const result = await StorageManagerDexie.upsertContact(mockContact as ProjectContact);

      expect(result).toMatchObject({
        projetoId: 'proj-1',
        nome: 'New Contact',
        _dirty: 1
      });
      expect(result.id).toBeDefined();
    });
  });

  describe('deleteContact', () => {
    it('should mark contact as deleted', async () => {
      const mockContact: ProjectContact = {
        id: 'contact-1',
        projetoId: 'proj-1',
        nome: 'Contact',
        tipo: 'cliente' as const,
        criadoEm: Date.now(),
        atualizadoEm: Date.now()
      };

      vi.mocked(db.contacts.get).mockResolvedValue(mockContact);
      vi.mocked(db.contacts.put).mockResolvedValue('contact-1');

      await StorageManagerDexie.deleteContact('contact-1');

      expect(db.contacts.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'contact-1',
          _deleted: 1,
          _dirty: 1
        })
      );
    });
  });
});

describe('StorageManagerDexie - Budgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getBudgetsByProject', () => {
    it('should fetch all non-deleted budgets for a project', async () => {
      const mockBudgets: ProjectBudget[] = [
        {
          id: '1',
          projectId: 'proj-1',
          fornecedor: 'Supplier 1',
          valor: 1000,
          descricao: 'Budget 1',
          updatedAt: Date.now()
        }
      ];

      const whereMock = {
        equals: vi.fn().mockReturnThis(),
        and: vi.fn().mockReturnThis(),
        notEqual: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockBudgets)
      };

      vi.mocked(db.budgets.where).mockReturnValue(whereMock as any);

      const result = await StorageManagerDexie.getBudgetsByProject('proj-1');

      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe('proj-1');
    });
  });

  describe('upsertBudget', () => {
    it('should create new budget with dirty flag', async () => {
      const mockBudget: Partial<ProjectBudget> = {
        id: '',
        projectId: 'proj-1',
        fornecedor: 'New Supplier',
        valor: 2000,
        descricao: 'New Budget'
      };

      vi.mocked(db.budgets.put).mockResolvedValue('budget-new');

      const result = await StorageManagerDexie.upsertBudget(mockBudget as ProjectBudget);

      expect(result).toMatchObject({
        projectId: 'proj-1',
        fornecedor: 'New Supplier',
        _dirty: 1
      });
      expect(result.id).toBeDefined();
    });
  });
});
