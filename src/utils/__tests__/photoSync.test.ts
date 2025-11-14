import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  syncPhotoToProjectAlbum,
  syncAllInstallationPhotos,
  type PhotoMetadata
} from '../photoSync';
import { StorageManagerDexie } from '@/services/StorageManager';
import { createMockFileAttachment } from '@/__tests__/fixtures/testData';

// Mock dependencies
vi.mock('@/services/StorageManager', () => ({
  StorageManagerDexie: {
    upsertFile: vi.fn(),
    getFilesByProject: vi.fn()
  }
}));

vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('photoSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('syncPhotoToProjectAlbum', () => {
    it('should sync photo with standardized naming format', async () => {
      const baseDate = new Date('2024-01-15T10:30:00Z');
      vi.setSystemTime(baseDate);

      vi.mocked(StorageManagerDexie.getFilesByProject).mockResolvedValue([
        createMockFileAttachment({ id: 'file-1', type: 'image/jpeg' }),
        createMockFileAttachment({ id: 'file-2', type: 'image/png' })
      ]);

      vi.mocked(StorageManagerDexie.upsertFile).mockResolvedValue(
        createMockFileAttachment() as any
      );

      await syncPhotoToProjectAlbum(
        'proj-1',
        'inst-1',
        'EQUIP-001',
        'proj-1/inst-1/photo.jpg',
        2048000,
        'image/jpeg'
      );

      expect(StorageManagerDexie.upsertFile).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          installationId: 'inst-1',
          name: 'peca_EQUIP-001_20240115_003.jpg', // Sequential number is 3 (2 existing + 1)
          type: 'image/jpeg',
          size: 2048000,
          storagePath: 'proj-1/inst-1/photo.jpg',
          _dirty: 1,
          _deleted: 0
        })
      );
      expect(StorageManagerDexie.upsertFile).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^img_\d+_[a-z0-9]+$/)
        })
      );
    });

    it('should use provided sequential number', async () => {
      const baseDate = new Date('2024-02-20T14:45:00Z');
      vi.setSystemTime(baseDate);

      vi.mocked(StorageManagerDexie.upsertFile).mockResolvedValue(
        createMockFileAttachment() as any
      );

      await syncPhotoToProjectAlbum(
        'proj-1',
        'inst-1',
        'EQUIP-002',
        'proj-1/inst-1/photo.jpg',
        1024000,
        'image/jpeg',
        5 // Explicit sequential number
      );

      expect(StorageManagerDexie.upsertFile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'peca_EQUIP-002_20240220_005.jpg'
        })
      );
      expect(StorageManagerDexie.getFilesByProject).not.toHaveBeenCalled();
    });

    it('should handle zero sequential number', async () => {
      const baseDate = new Date('2024-03-10T08:00:00Z');
      vi.setSystemTime(baseDate);

      vi.mocked(StorageManagerDexie.getFilesByProject).mockResolvedValue([]);
      vi.mocked(StorageManagerDexie.upsertFile).mockResolvedValue(
        createMockFileAttachment() as any
      );

      await syncPhotoToProjectAlbum(
        'proj-1',
        'inst-1',
        'EQUIP-003',
        'proj-1/inst-1/photo.jpg',
        512000,
        'image/jpeg'
      );

      expect(StorageManagerDexie.upsertFile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'peca_EQUIP-003_20240310_001.jpg' // First photo, sequential = 1
        })
      );
    });

    it('should generate unique file IDs', async () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

      vi.mocked(StorageManagerDexie.getFilesByProject).mockResolvedValue([]);
      vi.mocked(StorageManagerDexie.upsertFile).mockResolvedValue(
        createMockFileAttachment() as any
      );

      await syncPhotoToProjectAlbum(
        'proj-1',
        'inst-1',
        'EQUIP-001',
        'path/photo1.jpg',
        1024,
        'image/jpeg'
      );

      await syncPhotoToProjectAlbum(
        'proj-1',
        'inst-1',
        'EQUIP-001',
        'path/photo2.jpg',
        2048,
        'image/jpeg'
      );

      expect(StorageManagerDexie.upsertFile).toHaveBeenCalledTimes(2);

      const call1 = vi.mocked(StorageManagerDexie.upsertFile).mock.calls[0][0];
      const call2 = vi.mocked(StorageManagerDexie.upsertFile).mock.calls[1][0];

      expect(call1.id).not.toBe(call2.id);
      expect(call1.id).toMatch(/^img_\d+_[a-z0-9]+$/);
      expect(call2.id).toMatch(/^img_\d+_[a-z0-9]+$/);
    });

    it('should not throw error on failure', async () => {
      vi.mocked(StorageManagerDexie.getFilesByProject).mockRejectedValue(
        new Error('Database error')
      );

      // Should not throw - errors are isolated
      await expect(
        syncPhotoToProjectAlbum(
          'proj-1',
          'inst-1',
          'EQUIP-001',
          'path/photo.jpg',
          1024,
          'image/jpeg'
        )
      ).resolves.toBeUndefined();
    });

    it('should handle upsert failures gracefully', async () => {
      vi.mocked(StorageManagerDexie.getFilesByProject).mockResolvedValue([]);
      vi.mocked(StorageManagerDexie.upsertFile).mockRejectedValue(
        new Error('Upsert failed')
      );

      // Should not throw
      await expect(
        syncPhotoToProjectAlbum(
          'proj-1',
          'inst-1',
          'EQUIP-001',
          'path/photo.jpg',
          1024,
          'image/jpeg'
        )
      ).resolves.toBeUndefined();
    });

    it('should pad sequential numbers correctly', async () => {
      const baseDate = new Date('2024-04-01T12:00:00Z');
      vi.setSystemTime(baseDate);

      vi.mocked(StorageManagerDexie.getFilesByProject).mockResolvedValue(
        // 99 existing files
        Array.from({ length: 99 }, (_, i) =>
          createMockFileAttachment({ id: `file-${i}`, type: 'image/jpeg' })
        )
      );

      vi.mocked(StorageManagerDexie.upsertFile).mockResolvedValue(
        createMockFileAttachment() as any
      );

      await syncPhotoToProjectAlbum(
        'proj-1',
        'inst-1',
        'EQUIP-999',
        'path/photo.jpg',
        1024,
        'image/jpeg'
      );

      expect(StorageManagerDexie.upsertFile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'peca_EQUIP-999_20240401_100.jpg' // 100th file, padded to 3 digits
        })
      );
    });

    it('should preserve storage path and metadata', async () => {
      vi.mocked(StorageManagerDexie.getFilesByProject).mockResolvedValue([]);
      vi.mocked(StorageManagerDexie.upsertFile).mockResolvedValue(
        createMockFileAttachment() as any
      );

      const storagePath = 'custom/path/to/photo.jpg';
      const fileSize = 3145728; // 3MB
      const fileType = 'image/png';

      await syncPhotoToProjectAlbum(
        'proj-1',
        'inst-1',
        'EQUIP-001',
        storagePath,
        fileSize,
        fileType
      );

      expect(StorageManagerDexie.upsertFile).toHaveBeenCalledWith(
        expect.objectContaining({
          storagePath,
          size: fileSize,
          type: fileType
        })
      );
    });
  });

  describe('syncAllInstallationPhotos', () => {
    it('should sync multiple photos with PhotoMetadata array', async () => {
      const baseDate = new Date('2024-05-10T16:20:00Z');
      vi.setSystemTime(baseDate);

      const photos: PhotoMetadata[] = [
        { storagePath: 'path/photo1.jpg', size: 1024000, type: 'image/jpeg' },
        { storagePath: 'path/photo2.jpg', size: 2048000, type: 'image/jpeg' },
        { storagePath: 'path/photo3.jpg', size: 512000, type: 'image/png' }
      ];

      vi.mocked(StorageManagerDexie.getFilesByProject)
        .mockResolvedValueOnce([]) // First call: 0 existing files
        .mockResolvedValueOnce([createMockFileAttachment()]) // Second call: 1 file
        .mockResolvedValueOnce([
          createMockFileAttachment(),
          createMockFileAttachment()
        ]); // Third call: 2 files

      vi.mocked(StorageManagerDexie.upsertFile).mockResolvedValue(
        createMockFileAttachment() as any
      );

      await syncAllInstallationPhotos('proj-1', 'inst-1', 'EQUIP-100', photos);

      expect(StorageManagerDexie.upsertFile).toHaveBeenCalledTimes(3);

      // Verify sequential numbers: 1, 2, 3
      expect(StorageManagerDexie.upsertFile).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          name: 'peca_EQUIP-100_20240510_001.jpg'
        })
      );
      expect(StorageManagerDexie.upsertFile).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          name: 'peca_EQUIP-100_20240510_002.jpg'
        })
      );
      expect(StorageManagerDexie.upsertFile).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          name: 'peca_EQUIP-100_20240510_003.jpg'
        })
      );
    });

    it('should handle legacy string array format', async () => {
      const baseDate = new Date('2024-06-01T10:00:00Z');
      vi.setSystemTime(baseDate);

      const photos = [
        'path/photo1.jpg',
        'path/photo2.jpg'
      ];

      vi.mocked(StorageManagerDexie.getFilesByProject)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([createMockFileAttachment()]);

      vi.mocked(StorageManagerDexie.upsertFile).mockResolvedValue(
        createMockFileAttachment() as any
      );

      await syncAllInstallationPhotos('proj-1', 'inst-1', 'EQUIP-200', photos as any);

      expect(StorageManagerDexie.upsertFile).toHaveBeenCalledTimes(2);

      // Should use default values for legacy format
      expect(StorageManagerDexie.upsertFile).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          storagePath: 'path/photo1.jpg',
          size: 0, // Default value
          type: 'image/jpeg' // Default value
        })
      );
    });

    it('should handle empty photo array', async () => {
      await syncAllInstallationPhotos('proj-1', 'inst-1', 'EQUIP-001', []);

      expect(StorageManagerDexie.upsertFile).not.toHaveBeenCalled();
    });

    it('should continue on individual photo sync failure', async () => {
      const photos: PhotoMetadata[] = [
        { storagePath: 'path/photo1.jpg', size: 1024, type: 'image/jpeg' },
        { storagePath: 'path/photo2.jpg', size: 2048, type: 'image/jpeg' },
        { storagePath: 'path/photo3.jpg', size: 512, type: 'image/jpeg' }
      ];

      vi.mocked(StorageManagerDexie.getFilesByProject)
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Database error')) // Second photo fails
        .mockResolvedValueOnce([createMockFileAttachment()]);

      vi.mocked(StorageManagerDexie.upsertFile).mockResolvedValue(
        createMockFileAttachment() as any
      );

      // Should not throw - errors are isolated
      await expect(
        syncAllInstallationPhotos('proj-1', 'inst-1', 'EQUIP-001', photos)
      ).resolves.toBeUndefined();

      // Should still attempt all photos
      expect(StorageManagerDexie.getFilesByProject).toHaveBeenCalledTimes(3);
    });

    it('should calculate correct sequential numbers for batch', async () => {
      const baseDate = new Date('2024-07-15T14:30:00Z');
      vi.setSystemTime(baseDate);

      const photos: PhotoMetadata[] = [
        { storagePath: 'path/photo1.jpg', size: 1024, type: 'image/jpeg' },
        { storagePath: 'path/photo2.jpg', size: 2048, type: 'image/jpeg' },
        { storagePath: 'path/photo3.jpg', size: 512, type: 'image/jpeg' }
      ];

      // 5 existing files
      const existingFiles = Array.from({ length: 5 }, (_, i) =>
        createMockFileAttachment({ id: `file-${i}`, type: 'image/jpeg' })
      );

      vi.mocked(StorageManagerDexie.getFilesByProject)
        .mockResolvedValueOnce(existingFiles) // First call gets base count
        .mockResolvedValueOnce([...existingFiles, createMockFileAttachment()]) // 6 files
        .mockResolvedValueOnce([
          ...existingFiles,
          createMockFileAttachment(),
          createMockFileAttachment()
        ]); // 7 files

      vi.mocked(StorageManagerDexie.upsertFile).mockResolvedValue(
        createMockFileAttachment() as any
      );

      await syncAllInstallationPhotos('proj-1', 'inst-1', 'EQUIP-300', photos);

      // Sequential numbers should be: 6, 7, 8 (base is 5 + 1, 2, 3)
      expect(StorageManagerDexie.upsertFile).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          name: 'peca_EQUIP-300_20240715_006.jpg'
        })
      );
      expect(StorageManagerDexie.upsertFile).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          name: 'peca_EQUIP-300_20240715_007.jpg'
        })
      );
      expect(StorageManagerDexie.upsertFile).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          name: 'peca_EQUIP-300_20240715_008.jpg'
        })
      );
    });

    it('should handle mixed PhotoMetadata and string formats', async () => {
      const baseDate = new Date('2024-08-20T09:15:00Z');
      vi.setSystemTime(baseDate);

      const photos = [
        { storagePath: 'path/photo1.jpg', size: 1024, type: 'image/jpeg' },
        'path/photo2.jpg', // Legacy string format
        { storagePath: 'path/photo3.jpg', size: 2048, type: 'image/png' }
      ];

      vi.mocked(StorageManagerDexie.getFilesByProject)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([createMockFileAttachment()])
        .mockResolvedValueOnce([
          createMockFileAttachment(),
          createMockFileAttachment()
        ]);

      vi.mocked(StorageManagerDexie.upsertFile).mockResolvedValue(
        createMockFileAttachment() as any
      );

      await syncAllInstallationPhotos('proj-1', 'inst-1', 'EQUIP-400', photos as any);

      expect(StorageManagerDexie.upsertFile).toHaveBeenCalledTimes(3);

      // First and third should use provided metadata
      expect(StorageManagerDexie.upsertFile).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          size: 1024,
          type: 'image/jpeg'
        })
      );

      // Second should use defaults
      expect(StorageManagerDexie.upsertFile).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          size: 0,
          type: 'image/jpeg'
        })
      );

      // Third should use provided metadata
      expect(StorageManagerDexie.upsertFile).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          size: 2048,
          type: 'image/png'
        })
      );
    });
  });
});
