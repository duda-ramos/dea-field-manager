import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  softDeleteProject,
  archiveProject,
  restoreProject,
  permanentlyDeleteProject,
  downloadProjectZip,
  getFilteredProjects
} from '../projectLifecycle';
import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/lib/storage';
import { toast } from 'sonner';
import { createMockProject } from '@/__tests__/fixtures/testData';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn()
    }
  }
}));

vi.mock('@/lib/storage', () => ({
  storage: {
    getProjectById: vi.fn(),
    upsertProject: vi.fn()
  }
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('@/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('file-saver', () => ({
  saveAs: vi.fn()
}));

vi.mock('jszip');

describe('projectLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('softDeleteProject', () => {
    it('should soft delete project with 7-day grace period', async () => {
      const mockProject = createMockProject({ id: 'proj-1', name: 'Test Project' });
      const baseDate = new Date('2024-01-01T00:00:00Z');
      vi.setSystemTime(baseDate);

      vi.mocked(storage.getProjectById).mockResolvedValue(mockProject);
      vi.mocked(storage.upsertProject).mockResolvedValue(mockProject as any);

      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate
      } as any);
      mockUpdate.mockReturnValue({ eq: mockEq } as any);

      const result = await softDeleteProject('proj-1');

      expect(result.success).toBe(true);
      expect(storage.getProjectById).toHaveBeenCalledWith('proj-1');
      expect(storage.upsertProject).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: '2024-01-01T00:00:00.000Z',
          permanent_deletion_at: '2024-01-08T00:00:00.000Z' // 7 days later
        })
      );
      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: expect.any(String),
          permanent_deletion_at: expect.any(String)
        })
      );
      expect(mockEq).toHaveBeenCalledWith('id', 'proj-1');
      expect(toast.success).toHaveBeenCalledWith(
        'Projeto movido para lixeira',
        expect.objectContaining({
          description: 'Será excluído permanentemente em 7 dias'
        })
      );
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(storage.getProjectById).mockRejectedValue(new Error('Database error'));

      const result = await softDeleteProject('proj-1');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(toast.error).toHaveBeenCalledWith('Erro ao excluir projeto');
    });

    it('should handle Supabase update errors', async () => {
      const mockProject = createMockProject({ id: 'proj-1' });
      vi.mocked(storage.getProjectById).mockResolvedValue(mockProject);
      vi.mocked(storage.upsertProject).mockResolvedValue(mockProject as any);

      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: { message: 'Update failed' } });

      vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);
      mockUpdate.mockReturnValue({ eq: mockEq } as any);

      const result = await softDeleteProject('proj-1');

      expect(result.success).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });

    it('should handle missing project in local storage', async () => {
      vi.mocked(storage.getProjectById).mockResolvedValue(null);

      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);
      mockUpdate.mockReturnValue({ eq: mockEq } as any);

      const result = await softDeleteProject('proj-1');

      expect(result.success).toBe(true);
      expect(storage.upsertProject).not.toHaveBeenCalled();
      expect(supabase.from).toHaveBeenCalledWith('projects');
    });
  });

  describe('archiveProject', () => {
    it('should archive project and set status to completed', async () => {
      const mockProject = createMockProject({ id: 'proj-1', status: 'in-progress' });
      const baseDate = new Date('2024-01-01T00:00:00Z');
      vi.setSystemTime(baseDate);

      vi.mocked(storage.getProjectById).mockResolvedValue(mockProject);
      vi.mocked(storage.upsertProject).mockResolvedValue(mockProject as any);

      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);
      mockUpdate.mockReturnValue({ eq: mockEq } as any);

      const result = await archiveProject('proj-1');

      expect(result.success).toBe(true);
      expect(storage.upsertProject).toHaveBeenCalledWith(
        expect.objectContaining({
          archived_at: '2024-01-01T00:00:00.000Z',
          status: 'completed'
        })
      );
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          archived_at: expect.any(String),
          status: 'completed'
        })
      );
      expect(toast.success).toHaveBeenCalledWith(
        'Projeto arquivado com sucesso',
        expect.objectContaining({
          description: 'Mantido por 6 meses'
        })
      );
    });

    it('should handle archive errors', async () => {
      vi.mocked(storage.getProjectById).mockRejectedValue(new Error('Archive error'));

      const result = await archiveProject('proj-1');

      expect(result.success).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Erro ao arquivar projeto');
    });
  });

  describe('restoreProject', () => {
    it('should restore deleted project to in-progress status', async () => {
      const mockProject = createMockProject({
        id: 'proj-1',
        deleted_at: '2024-01-01T00:00:00.000Z',
        status: 'completed'
      });

      vi.mocked(storage.getProjectById).mockResolvedValue(mockProject);
      vi.mocked(storage.upsertProject).mockResolvedValue(mockProject as any);

      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);
      mockUpdate.mockReturnValue({ eq: mockEq } as any);

      const result = await restoreProject('proj-1');

      expect(result.success).toBe(true);
      expect(storage.upsertProject).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: null,
          archived_at: null,
          permanent_deletion_at: null,
          status: 'in-progress'
        })
      );
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: null,
          archived_at: null,
          permanent_deletion_at: null,
          status: 'in-progress'
        })
      );
      expect(toast.success).toHaveBeenCalledWith('Projeto restaurado com sucesso');
    });

    it('should restore archived project', async () => {
      const mockProject = createMockProject({
        id: 'proj-1',
        archived_at: '2024-01-01T00:00:00.000Z'
      });

      vi.mocked(storage.getProjectById).mockResolvedValue(mockProject);
      vi.mocked(storage.upsertProject).mockResolvedValue(mockProject as any);

      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);
      mockUpdate.mockReturnValue({ eq: mockEq } as any);

      const result = await restoreProject('proj-1');

      expect(result.success).toBe(true);
      expect(storage.upsertProject).toHaveBeenCalledWith(
        expect.objectContaining({
          archived_at: null,
          status: 'in-progress'
        })
      );
    });

    it('should handle restore errors', async () => {
      vi.mocked(storage.getProjectById).mockRejectedValue(new Error('Restore error'));

      const result = await restoreProject('proj-1');

      expect(result.success).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Erro ao restaurar projeto');
    });
  });

  describe('permanentlyDeleteProject', () => {
    it('should permanently delete project and all related data', async () => {
      const mockDelete = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete
      } as any);
      mockDelete.mockReturnValue({ eq: mockEq } as any);

      const result = await permanentlyDeleteProject('proj-1');

      expect(result.success).toBe(true);

      // Verify all related tables are deleted in correct order
      const callOrder = vi.mocked(supabase.from).mock.calls.map(call => call[0]);

      expect(callOrder).toContain('calendar_events');
      expect(callOrder).toContain('collaboration_events');
      expect(callOrder).toContain('project_versions');
      expect(callOrder).toContain('project_backups');
      expect(callOrder).toContain('project_activities');
      expect(callOrder).toContain('project_collaborators');
      expect(callOrder).toContain('project_files');
      expect(callOrder).toContain('installations');
      expect(callOrder).toContain('contacts');
      expect(callOrder).toContain('files');
      expect(callOrder).toContain('supplier_proposals');
      expect(callOrder).toContain('projects');

      // Verify project is deleted last
      const projectDeleteIndex = callOrder.lastIndexOf('projects');
      expect(projectDeleteIndex).toBe(callOrder.length - 1);

      expect(toast.success).toHaveBeenCalledWith('Projeto excluído permanentemente');
    });

    it('should handle installation deletion errors', async () => {
      const mockDelete = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockImplementation((field, value) => {
        if (field === 'project_id' && value === 'proj-1') {
          // First few deletes succeed
          const callCount = vi.mocked(supabase.from).mock.calls.length;
          if (callCount > 7) { // Installations is the 8th call
            return Promise.resolve({ error: { message: 'Delete failed' } });
          }
        }
        return Promise.resolve({ error: null });
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete
      } as any);
      mockDelete.mockReturnValue({ eq: mockEq } as any);

      const result = await permanentlyDeleteProject('proj-1');

      expect(result.success).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(
        'Erro ao excluir projeto permanentemente',
        expect.any(Object)
      );
    });

    it('should handle project deletion errors', async () => {
      const mockDelete = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockImplementation((field, value) => {
        // All dependent deletes succeed, but project delete fails
        const tableName = vi.mocked(supabase.from).mock.calls[
          vi.mocked(supabase.from).mock.calls.length - 1
        ][0];

        if (tableName === 'projects') {
          return Promise.resolve({ error: { message: 'Cannot delete project' } });
        }
        return Promise.resolve({ error: null });
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete
      } as any);
      mockDelete.mockReturnValue({ eq: mockEq } as any);

      const result = await permanentlyDeleteProject('proj-1');

      expect(result.success).toBe(false);
    });
  });

  describe('downloadProjectZip', () => {
    it('should download complete project as ZIP', async () => {
      const mockProject = createMockProject({ id: 'proj-1', name: 'Test Project' });
      const mockInstallations = [{ id: 'inst-1', codigo: 'INST-001', project_id: 'proj-1' }];
      const mockContacts = [{ id: 'cont-1', nome: 'Contact 1', project_id: 'proj-1' }];
      const mockBudgets = [{ id: 'budg-1', fornecedor: 'Supplier 1', project_id: 'proj-1' }];
      const mockFiles = [
        {
          id: 'file-1',
          name: 'test.jpg',
          storage_path: 'proj-1/test.jpg',
          project_id: 'proj-1'
        }
      ];

      // Mock Supabase queries
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn();

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle
      } as any);

      // Setup different responses for different tables
      let callCount = 0;
      mockEq.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Projects query (with single())
          return {
            single: vi.fn().mockResolvedValue({ data: mockProject, error: null })
          };
        } else if (callCount === 2) {
          // Installations query
          return Promise.resolve({ data: mockInstallations, error: null });
        } else if (callCount === 3) {
          // Contacts query
          return Promise.resolve({ data: mockContacts, error: null });
        } else if (callCount === 4) {
          // Budgets query
          return Promise.resolve({ data: mockBudgets, error: null });
        } else {
          // Files query
          return Promise.resolve({ data: mockFiles, error: null });
        }
      });

      // Mock storage download
      const mockDownload = vi.fn().mockResolvedValue({
        data: new Blob(['file content'], { type: 'image/jpeg' }),
        error: null
      });

      vi.mocked(supabase.storage.from).mockReturnValue({
        download: mockDownload
      } as any);

      // Mock JSZip
      const mockZipFile = vi.fn();
      const mockZipFolder = vi.fn().mockReturnValue({
        file: vi.fn()
      });
      const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['zip content']));

      vi.mocked(JSZip).mockImplementation(() => ({
        file: mockZipFile,
        folder: mockZipFolder,
        generateAsync: mockGenerateAsync
      } as any));

      const result = await downloadProjectZip('proj-1');

      expect(result.success).toBe(true);
      expect(toast.info).toHaveBeenCalledWith(
        'Preparando download...',
        expect.objectContaining({ description: 'Isso pode levar alguns minutos' })
      );
      expect(mockZipFile).toHaveBeenCalled();
      expect(mockZipFolder).toHaveBeenCalledWith('instalacoes');
      expect(mockZipFolder).toHaveBeenCalledWith('arquivos');
      expect(mockGenerateAsync).toHaveBeenCalledWith({ type: 'blob' });
      expect(saveAs).toHaveBeenCalledWith(
        expect.any(Blob),
        expect.stringMatching(/Test_Project_\d+\.zip/)
      );
      expect(toast.success).toHaveBeenCalledWith('Download concluído!');
    });

    it('should handle missing project', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq
      } as any);

      const result = await downloadProjectZip('non-existent');

      expect(result.success).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Erro ao criar arquivo ZIP');
    });

    it('should handle file download errors gracefully', async () => {
      const mockProject = createMockProject({ id: 'proj-1', name: 'Test Project' });
      const mockFiles = [
        { id: 'file-1', name: 'test.jpg', storage_path: 'proj-1/test.jpg' }
      ];

      const mockSelect = vi.fn().mockReturnThis();
      let callCount = 0;
      const mockEq = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            single: vi.fn().mockResolvedValue({ data: mockProject, error: null })
          };
        } else if (callCount === 5) {
          return Promise.resolve({ data: mockFiles, error: null });
        } else {
          return Promise.resolve({ data: [], error: null });
        }
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq
      } as any);

      // Mock storage download failure
      vi.mocked(supabase.storage.from).mockReturnValue({
        download: vi.fn().mockRejectedValue(new Error('Download failed'))
      } as any);

      const mockZipFile = vi.fn();
      const mockZipFolder = vi.fn().mockReturnValue({ file: vi.fn() });
      const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['zip content']));

      vi.mocked(JSZip).mockImplementation(() => ({
        file: mockZipFile,
        folder: mockZipFolder,
        generateAsync: mockGenerateAsync
      } as any));

      const result = await downloadProjectZip('proj-1');

      // Should still succeed, just skip the failed file
      expect(result.success).toBe(true);
    });
  });

  describe('getFilteredProjects', () => {
    it('should fetch only deleted projects', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockNot = vi.fn().mockReturnThis();
      const mockIs = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({
        data: [createMockProject({ deleted_at: '2024-01-01' })],
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        not: mockNot,
        is: mockIs,
        order: mockOrder
      } as any);

      const result = await getFilteredProjects({
        showDeleted: true,
        showActive: false,
        showArchived: false
      });

      expect(result.data).toHaveLength(1);
      expect(mockNot).toHaveBeenCalledWith('deleted_at', 'is', null);
      expect(mockOrder).toHaveBeenCalledWith('updated_at', { ascending: false });
    });

    it('should fetch only archived projects', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockNot = vi.fn().mockReturnThis();
      const mockIs = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({
        data: [createMockProject({ archived_at: '2024-01-01' })],
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        not: mockNot,
        is: mockIs,
        order: mockOrder
      } as any);

      const result = await getFilteredProjects({
        showDeleted: false,
        showActive: false,
        showArchived: true
      });

      expect(result.data).toHaveLength(1);
      expect(mockNot).toHaveBeenCalledWith('archived_at', 'is', null);
      expect(mockIs).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should fetch only active projects', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockIs = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({
        data: [createMockProject()],
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        is: mockIs,
        order: mockOrder
      } as any);

      const result = await getFilteredProjects({
        showDeleted: false,
        showActive: true,
        showArchived: false
      });

      expect(result.data).toHaveLength(1);
      expect(mockIs).toHaveBeenCalledWith('deleted_at', null);
      expect(mockIs).toHaveBeenCalledWith('archived_at', null);
    });

    it('should fetch all projects when multiple filters selected', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({
        data: [createMockProject(), createMockProject()],
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        order: mockOrder
      } as any);

      const result = await getFilteredProjects({
        showDeleted: true,
        showActive: true,
        showArchived: true
      });

      expect(result.data).toHaveLength(2);
    });

    it('should handle query errors', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Query failed' }
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        order: mockOrder
      } as any);

      const result = await getFilteredProjects({ showActive: true });

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });
  });
});
