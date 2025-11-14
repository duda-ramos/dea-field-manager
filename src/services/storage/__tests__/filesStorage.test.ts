import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadToStorage, getSignedUrl, deleteFromStorage } from '../filesStorage';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn()
    }
  }
}));

// Mock environment variable
vi.stubEnv('VITE_SUPABASE_STORAGE_BUCKET', 'test-bucket');

describe('filesStorage', () => {
  const mockStorageBucket = {
    upload: vi.fn(),
    createSignedUrl: vi.fn(),
    remove: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('navigator', { onLine: true });
    vi.mocked(supabase.storage.from).mockReturnValue(mockStorageBucket as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('uploadToStorage', () => {
    it('should successfully upload file to storage', async () => {
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const ids = {
        projectId: 'proj-1',
        installationId: 'inst-1',
        id: 'file-1'
      };

      mockStorageBucket.upload.mockResolvedValue({ error: null });

      const result = await uploadToStorage(mockFile, ids);

      expect(supabase.storage.from).toHaveBeenCalledWith('test-bucket');
      expect(mockStorageBucket.upload).toHaveBeenCalledWith(
        'proj-1/inst-1/file-1-test.jpg',
        mockFile,
        { upsert: true }
      );
      expect(result).toMatchObject({
        storagePath: 'proj-1/inst-1/file-1-test.jpg',
        uploadedAtISO: expect.any(String)
      });
      expect(new Date(result.uploadedAtISO)).toBeInstanceOf(Date);
    });

    it('should handle missing projectId in storage path', async () => {
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const ids = {
        installationId: 'inst-1',
        id: 'file-1'
      };

      mockStorageBucket.upload.mockResolvedValue({ error: null });

      const result = await uploadToStorage(mockFile, ids);

      expect(mockStorageBucket.upload).toHaveBeenCalledWith(
        'noproj/inst-1/file-1-test.jpg',
        mockFile,
        { upsert: true }
      );
      expect(result.storagePath).toBe('noproj/inst-1/file-1-test.jpg');
    });

    it('should handle missing installationId in storage path', async () => {
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const ids = {
        projectId: 'proj-1',
        id: 'file-1'
      };

      mockStorageBucket.upload.mockResolvedValue({ error: null });

      const result = await uploadToStorage(mockFile, ids);

      expect(mockStorageBucket.upload).toHaveBeenCalledWith(
        'proj-1/noinst/file-1-test.jpg',
        mockFile,
        { upsert: true }
      );
      expect(result.storagePath).toBe('proj-1/noinst/file-1-test.jpg');
    });

    it('should throw error when offline', async () => {
      vi.stubGlobal('navigator', { onLine: false });

      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const ids = { projectId: 'proj-1', installationId: 'inst-1', id: 'file-1' };

      await expect(uploadToStorage(mockFile, ids)).rejects.toThrow(
        'Offline: unable to upload to storage'
      );
      await expect(uploadToStorage(mockFile, ids)).rejects.toMatchObject({
        code: 'OFFLINE'
      });
    });

    it('should throw error when storage bucket not configured', async () => {
      vi.stubEnv('VITE_SUPABASE_STORAGE_BUCKET', '');

      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const ids = { projectId: 'proj-1', installationId: 'inst-1', id: 'file-1' };

      await expect(uploadToStorage(mockFile, ids)).rejects.toThrow(
        'Supabase storage bucket not configured'
      );
    });

    it('should throw error when upload fails', async () => {
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const ids = { projectId: 'proj-1', installationId: 'inst-1', id: 'file-1' };

      mockStorageBucket.upload.mockResolvedValue({
        error: { message: 'Upload failed' }
      });

      await expect(uploadToStorage(mockFile, ids)).rejects.toThrow(
        'Failed to upload file: Upload failed'
      );
    });

    it('should support upsert functionality', async () => {
      const mockFile = new File(['updated content'], 'test.jpg', { type: 'image/jpeg' });
      const ids = { projectId: 'proj-1', installationId: 'inst-1', id: 'file-1' };

      mockStorageBucket.upload.mockResolvedValue({ error: null });

      await uploadToStorage(mockFile, ids);

      expect(mockStorageBucket.upload).toHaveBeenCalledWith(
        expect.any(String),
        mockFile,
        { upsert: true }
      );
    });

    it('should handle special characters in file name', async () => {
      const mockFile = new File(['test content'], 'test (1).jpg', { type: 'image/jpeg' });
      const ids = { projectId: 'proj-1', installationId: 'inst-1', id: 'file-1' };

      mockStorageBucket.upload.mockResolvedValue({ error: null });

      const result = await uploadToStorage(mockFile, ids);

      expect(result.storagePath).toBe('proj-1/inst-1/file-1-test (1).jpg');
    });
  });

  describe('getSignedUrl', () => {
    it('should generate signed URL with default expiration', async () => {
      const storagePath = 'proj-1/inst-1/file-1-test.jpg';
      const mockSignedUrl = 'https://example.com/signed-url';

      mockStorageBucket.createSignedUrl.mockResolvedValue({
        data: { signedUrl: mockSignedUrl },
        error: null
      });

      const result = await getSignedUrl(storagePath);

      expect(supabase.storage.from).toHaveBeenCalledWith('test-bucket');
      expect(mockStorageBucket.createSignedUrl).toHaveBeenCalledWith(storagePath, 900); // 15 min default
      expect(result).toEqual({ url: mockSignedUrl });
    });

    it('should generate signed URL with custom expiration', async () => {
      const storagePath = 'proj-1/inst-1/file-1-test.jpg';
      const mockSignedUrl = 'https://example.com/signed-url';
      const customExpiration = 3600; // 1 hour

      mockStorageBucket.createSignedUrl.mockResolvedValue({
        data: { signedUrl: mockSignedUrl },
        error: null
      });

      const result = await getSignedUrl(storagePath, customExpiration);

      expect(mockStorageBucket.createSignedUrl).toHaveBeenCalledWith(storagePath, customExpiration);
      expect(result).toEqual({ url: mockSignedUrl });
    });

    it('should throw error when bucket not configured', async () => {
      vi.stubEnv('VITE_SUPABASE_STORAGE_BUCKET', '');

      await expect(getSignedUrl('some/path')).rejects.toThrow(
        'Supabase storage bucket not configured'
      );
    });

    it('should throw error when signed URL generation fails', async () => {
      const storagePath = 'proj-1/inst-1/file-1-test.jpg';

      mockStorageBucket.createSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'URL generation failed' }
      });

      await expect(getSignedUrl(storagePath)).rejects.toThrow(
        'Failed to generate signed URL: URL generation failed'
      );
    });

    it('should throw error when signedUrl is missing in response', async () => {
      const storagePath = 'proj-1/inst-1/file-1-test.jpg';

      mockStorageBucket.createSignedUrl.mockResolvedValue({
        data: { signedUrl: null },
        error: null
      });

      await expect(getSignedUrl(storagePath)).rejects.toThrow(
        'Failed to generate signed URL: Unknown error'
      );
    });
  });

  describe('deleteFromStorage', () => {
    it('should successfully delete file from storage', async () => {
      const storagePath = 'proj-1/inst-1/file-1-test.jpg';

      mockStorageBucket.remove.mockResolvedValue({ error: null });

      await deleteFromStorage(storagePath);

      expect(supabase.storage.from).toHaveBeenCalledWith('test-bucket');
      expect(mockStorageBucket.remove).toHaveBeenCalledWith([storagePath]);
    });

    it('should throw error when bucket not configured', async () => {
      vi.stubEnv('VITE_SUPABASE_STORAGE_BUCKET', '');

      await expect(deleteFromStorage('some/path')).rejects.toThrow(
        'Supabase storage bucket not configured'
      );
    });

    it('should throw error when deletion fails', async () => {
      const storagePath = 'proj-1/inst-1/file-1-test.jpg';

      mockStorageBucket.remove.mockResolvedValue({
        error: { message: 'Deletion failed' }
      });

      await expect(deleteFromStorage(storagePath)).rejects.toThrow(
        'Failed to delete file: Deletion failed'
      );
    });

    it('should handle deletion of multiple paths', async () => {
      // Note: Current implementation only supports single file deletion
      // This test documents the current behavior
      const storagePath = 'proj-1/inst-1/file-1-test.jpg';

      mockStorageBucket.remove.mockResolvedValue({ error: null });

      await deleteFromStorage(storagePath);

      // The path is wrapped in an array
      expect(mockStorageBucket.remove).toHaveBeenCalledWith([storagePath]);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_SUPABASE_STORAGE_BUCKET', 'test-bucket');
    });

    it('should handle empty file name', async () => {
      const mockFile = new File(['test content'], '', { type: 'image/jpeg' });
      const ids = { projectId: 'proj-1', installationId: 'inst-1', id: 'file-1' };

      mockStorageBucket.upload.mockResolvedValue({ error: null });

      const result = await uploadToStorage(mockFile, ids);

      expect(result.storagePath).toBe('proj-1/inst-1/file-1-');
    });

    it('should handle very long file names', async () => {
      const longFileName = 'a'.repeat(200) + '.jpg';
      const mockFile = new File(['test content'], longFileName, { type: 'image/jpeg' });
      const ids = { projectId: 'proj-1', installationId: 'inst-1', id: 'file-1' };

      mockStorageBucket.upload.mockResolvedValue({ error: null });

      const result = await uploadToStorage(mockFile, ids);

      expect(result.storagePath).toContain(longFileName);
      expect(result.storagePath).toMatch(/^proj-1\/inst-1\/file-1-/);
    });

    it('should handle concurrent uploads', async () => {
      const mockFile1 = new File(['test 1'], 'test1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['test 2'], 'test2.jpg', { type: 'image/jpeg' });
      const ids1 = { projectId: 'proj-1', installationId: 'inst-1', id: 'file-1' };
      const ids2 = { projectId: 'proj-1', installationId: 'inst-1', id: 'file-2' };

      mockStorageBucket.upload.mockResolvedValue({ error: null });

      const [result1, result2] = await Promise.all([
        uploadToStorage(mockFile1, ids1),
        uploadToStorage(mockFile2, ids2)
      ]);

      expect(result1.storagePath).toBe('proj-1/inst-1/file-1-test1.jpg');
      expect(result2.storagePath).toBe('proj-1/inst-1/file-2-test2.jpg');
      expect(mockStorageBucket.upload).toHaveBeenCalledTimes(2);
    });
  });
});
