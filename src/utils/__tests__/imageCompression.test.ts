import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getImageDimensions,
  shouldCompress,
  shouldCompressByDimensions,
  compressImage,
  compressImages,
  type CompressionOptions
} from '../imageCompression';
import imageCompression from 'browser-image-compression';

// Mock browser-image-compression
vi.mock('browser-image-compression', () => ({
  default: vi.fn()
}));

vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('imageCompression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getImageDimensions', () => {
    it('should get dimensions of valid image file', async () => {
      const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });

      // Mock Image constructor and URL.createObjectURL
      const mockImg = {
        width: 1920,
        height: 1080,
        onload: null as any,
        onerror: null as any
      };

      vi.stubGlobal('Image', function() {
        return mockImg;
      });

      const mockObjectUrl = 'blob:http://localhost/test';
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => mockObjectUrl),
        revokeObjectURL: vi.fn()
      });

      // Simulate image load
      const dimensionsPromise = getImageDimensions(mockFile);
      setTimeout(() => mockImg.onload?.(), 0);

      const dimensions = await dimensionsPromise;

      expect(dimensions).toEqual({
        width: 1920,
        height: 1080
      });
      expect(URL.createObjectURL).toHaveBeenCalledWith(mockFile);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl);
    });

    it('should reject for invalid image type', async () => {
      const mockFile = new File([''], 'test.txt', { type: 'text/plain' });

      await expect(getImageDimensions(mockFile)).rejects.toThrow(
        /Tipo de arquivo não aceito/
      );
    });

    it('should reject on image load error', async () => {
      const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });

      const mockImg = {
        width: 0,
        height: 0,
        onload: null as any,
        onerror: null as any
      };

      vi.stubGlobal('Image', function() {
        return mockImg;
      });

      const mockObjectUrl = 'blob:http://localhost/test';
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => mockObjectUrl),
        revokeObjectURL: vi.fn()
      });

      const dimensionsPromise = getImageDimensions(mockFile);
      setTimeout(() => mockImg.onerror?.(), 0);

      await expect(dimensionsPromise).rejects.toThrow(
        'Erro ao carregar imagem para obter dimensões'
      );
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl);
    });

    it('should handle different image formats', async () => {
      const formats = [
        { type: 'image/jpeg', ext: '.jpg' },
        { type: 'image/png', ext: '.png' },
        { type: 'image/webp', ext: '.webp' }
      ];

      for (const format of formats) {
        const mockFile = new File([''], `test${format.ext}`, { type: format.type });

        const mockImg = {
          width: 800,
          height: 600,
          onload: null as any,
          onerror: null as any
        };

        vi.stubGlobal('Image', function() {
          return mockImg;
        });

        vi.stubGlobal('URL', {
          createObjectURL: vi.fn(() => 'blob:url'),
          revokeObjectURL: vi.fn()
        });

        const dimensionsPromise = getImageDimensions(mockFile);
        setTimeout(() => mockImg.onload?.(), 0);

        const dimensions = await dimensionsPromise;

        expect(dimensions).toEqual({ width: 800, height: 600 });
      }
    });
  });

  describe('shouldCompress', () => {
    it('should return true for files larger than 1MB', () => {
      const largeFile = new File(
        [new ArrayBuffer(2 * 1024 * 1024)], // 2MB
        'large.jpg',
        { type: 'image/jpeg' }
      );

      expect(shouldCompress(largeFile)).toBe(true);
    });

    it('should return false for files smaller than 1MB', () => {
      const smallFile = new File(
        [new ArrayBuffer(500 * 1024)], // 500KB
        'small.jpg',
        { type: 'image/jpeg' }
      );

      expect(shouldCompress(smallFile)).toBe(false);
    });

    it('should return false for non-image files', () => {
      const textFile = new File(['text content'], 'document.txt', { type: 'text/plain' });

      expect(shouldCompress(textFile)).toBe(false);
    });

    it('should return false for unsupported image formats', () => {
      const gifFile = new File([''], 'animation.gif', { type: 'image/gif' });

      expect(shouldCompress(gifFile)).toBe(false);
    });

    it('should handle edge case at exactly 1MB', () => {
      const exactFile = new File(
        [new ArrayBuffer(1024 * 1024)], // Exactly 1MB
        'exact.jpg',
        { type: 'image/jpeg' }
      );

      expect(shouldCompress(exactFile)).toBe(false);
    });
  });

  describe('shouldCompressByDimensions', () => {
    it('should return true for images exceeding max dimension', async () => {
      const mockFile = new File([''], 'large.jpg', { type: 'image/jpeg' });

      const mockImg = {
        width: 2560,
        height: 1440,
        onload: null as any,
        onerror: null as any
      };

      vi.stubGlobal('Image', function() {
        return mockImg;
      });

      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:url'),
        revokeObjectURL: vi.fn()
      });

      const shouldCompressPromise = shouldCompressByDimensions(mockFile, 1920);
      setTimeout(() => mockImg.onload?.(), 0);

      const result = await shouldCompressPromise;

      expect(result).toBe(true);
    });

    it('should return false for images within max dimension', async () => {
      const mockFile = new File([''], 'normal.jpg', { type: 'image/jpeg' });

      const mockImg = {
        width: 1280,
        height: 720,
        onload: null as any,
        onerror: null as any
      };

      vi.stubGlobal('Image', function() {
        return mockImg;
      });

      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:url'),
        revokeObjectURL: vi.fn()
      });

      const shouldCompressPromise = shouldCompressByDimensions(mockFile, 1920);
      setTimeout(() => mockImg.onload?.(), 0);

      const result = await shouldCompressPromise;

      expect(result).toBe(false);
    });

    it('should handle errors and return false', async () => {
      const mockFile = new File([''], 'error.jpg', { type: 'image/jpeg' });

      const mockImg = {
        width: 0,
        height: 0,
        onload: null as any,
        onerror: null as any
      };

      vi.stubGlobal('Image', function() {
        return mockImg;
      });

      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:url'),
        revokeObjectURL: vi.fn()
      });

      const shouldCompressPromise = shouldCompressByDimensions(mockFile);
      setTimeout(() => mockImg.onerror?.(), 0);

      const result = await shouldCompressPromise;

      expect(result).toBe(false);
    });
  });

  describe('compressImage', () => {
    it('should compress image exceeding size threshold', async () => {
      const largeFile = new File(
        [new ArrayBuffer(3 * 1024 * 1024)], // 3MB
        'large.jpg',
        { type: 'image/jpeg' }
      );

      const compressedBlob = new Blob(
        [new ArrayBuffer(1.5 * 1024 * 1024)], // 1.5MB
        { type: 'image/jpeg' }
      );

      vi.mocked(imageCompression).mockResolvedValue(compressedBlob as any);

      // Mock Image for dimension check
      const mockImg = {
        width: 1920,
        height: 1080,
        onload: null as any,
        onerror: null as any
      };

      vi.stubGlobal('Image', function() {
        return mockImg;
      });

      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:url'),
        revokeObjectURL: vi.fn()
      });

      const compressPromise = compressImage(largeFile);
      setTimeout(() => mockImg.onload?.(), 0);

      const result = await compressPromise;

      expect(imageCompression).toHaveBeenCalledWith(
        largeFile,
        expect.objectContaining({
          maxSizeMB: 2,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: 'image/jpeg',
          initialQuality: 0.85
        })
      );
      expect(result).toBeInstanceOf(File);
      expect(result.name).toBe('large.jpg');
      expect(result.size).toBeLessThan(largeFile.size);
    });

    it('should use custom compression options', async () => {
      const file = new File(
        [new ArrayBuffer(3 * 1024 * 1024)],
        'test.jpg',
        { type: 'image/jpeg' }
      );

      const compressedBlob = new Blob(
        [new ArrayBuffer(1 * 1024 * 1024)],
        { type: 'image/jpeg' }
      );

      vi.mocked(imageCompression).mockResolvedValue(compressedBlob as any);

      const mockImg = {
        width: 1920,
        height: 1080,
        onload: null as any,
        onerror: null as any
      };

      vi.stubGlobal('Image', function() {
        return mockImg;
      });

      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:url'),
        revokeObjectURL: vi.fn()
      });

      const customOptions: CompressionOptions = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1280,
        quality: 0.7
      };

      const compressPromise = compressImage(file, customOptions);
      setTimeout(() => mockImg.onload?.(), 0);

      await compressPromise;

      expect(imageCompression).toHaveBeenCalledWith(
        file,
        expect.objectContaining({
          maxSizeMB: 1,
          maxWidthOrHeight: 1280,
          initialQuality: 0.7
        })
      );
    });

    it('should return original file if compression not needed', async () => {
      const smallFile = new File(
        [new ArrayBuffer(500 * 1024)], // 500KB
        'small.jpg',
        { type: 'image/jpeg' }
      );

      const mockImg = {
        width: 800,
        height: 600,
        onload: null as any,
        onerror: null as any
      };

      vi.stubGlobal('Image', function() {
        return mockImg;
      });

      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:url'),
        revokeObjectURL: vi.fn()
      });

      const compressPromise = compressImage(smallFile);
      setTimeout(() => mockImg.onload?.(), 0);

      const result = await compressPromise;

      expect(result).toBe(smallFile);
      expect(imageCompression).not.toHaveBeenCalled();
    });

    it('should return original file if compression fails', async () => {
      const file = new File(
        [new ArrayBuffer(3 * 1024 * 1024)],
        'test.jpg',
        { type: 'image/jpeg' }
      );

      vi.mocked(imageCompression).mockRejectedValue(new Error('Compression failed'));

      const mockImg = {
        width: 1920,
        height: 1080,
        onload: null as any,
        onerror: null as any
      };

      vi.stubGlobal('Image', function() {
        return mockImg;
      });

      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:url'),
        revokeObjectURL: vi.fn()
      });

      const compressPromise = compressImage(file);
      setTimeout(() => mockImg.onload?.(), 0);

      const result = await compressPromise;

      expect(result).toBe(file); // Should return original file
    });

    it('should reject invalid image types', async () => {
      const invalidFile = new File([''], 'test.bmp', { type: 'image/bmp' });

      await expect(compressImage(invalidFile)).rejects.toThrow(
        /Tipo de arquivo não aceito/
      );
    });

    it('should compress images with large dimensions even if file size is small', async () => {
      const file = new File(
        [new ArrayBuffer(800 * 1024)], // 800KB (below threshold)
        'large-dimensions.jpg',
        { type: 'image/jpeg' }
      );

      const compressedBlob = new Blob(
        [new ArrayBuffer(500 * 1024)],
        { type: 'image/jpeg' }
      );

      vi.mocked(imageCompression).mockResolvedValue(compressedBlob as any);

      const mockImg = {
        width: 4096, // Exceeds default max dimension of 1920
        height: 3072,
        onload: null as any,
        onerror: null as any
      };

      vi.stubGlobal('Image', function() {
        return mockImg;
      });

      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:url'),
        revokeObjectURL: vi.fn()
      });

      const compressPromise = compressImage(file);
      setTimeout(() => mockImg.onload?.(), 0);

      const result = await compressPromise;

      expect(imageCompression).toHaveBeenCalled();
      expect(result.size).toBeLessThan(file.size);
    });
  });

  describe('compressImages', () => {
    it('should compress multiple images in batch', async () => {
      const files = [
        new File([new ArrayBuffer(2 * 1024 * 1024)], 'file1.jpg', { type: 'image/jpeg' }),
        new File([new ArrayBuffer(3 * 1024 * 1024)], 'file2.jpg', { type: 'image/jpeg' }),
        new File([new ArrayBuffer(1.5 * 1024 * 1024)], 'file3.jpg', { type: 'image/jpeg' })
      ];

      const compressedBlob = new Blob([new ArrayBuffer(1 * 1024 * 1024)], { type: 'image/jpeg' });
      vi.mocked(imageCompression).mockResolvedValue(compressedBlob as any);

      const mockImg = {
        width: 1920,
        height: 1080,
        onload: null as any,
        onerror: null as any
      };

      vi.stubGlobal('Image', function() {
        return mockImg;
      });

      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:url'),
        revokeObjectURL: vi.fn()
      });

      const compressPromise = compressImages(files);

      // Trigger all image loads
      setTimeout(() => {
        mockImg.onload?.();
        mockImg.onload?.();
        mockImg.onload?.();
      }, 0);

      const results = await compressPromise;

      expect(results).toHaveLength(3);
      expect(imageCompression).toHaveBeenCalledTimes(3);
    });

    it('should handle empty array', async () => {
      const results = await compressImages([]);

      expect(results).toEqual([]);
      expect(imageCompression).not.toHaveBeenCalled();
    });

    it('should apply custom options to all images', async () => {
      const files = [
        new File([new ArrayBuffer(2 * 1024 * 1024)], 'file1.jpg', { type: 'image/jpeg' }),
        new File([new ArrayBuffer(2 * 1024 * 1024)], 'file2.jpg', { type: 'image/jpeg' })
      ];

      const compressedBlob = new Blob([new ArrayBuffer(1 * 1024 * 1024)], { type: 'image/jpeg' });
      vi.mocked(imageCompression).mockResolvedValue(compressedBlob as any);

      const mockImg = {
        width: 1920,
        height: 1080,
        onload: null as any,
        onerror: null as any
      };

      vi.stubGlobal('Image', function() {
        return mockImg;
      });

      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:url'),
        revokeObjectURL: vi.fn()
      });

      const customOptions: CompressionOptions = {
        maxSizeMB: 1,
        quality: 0.8
      };

      const compressPromise = compressImages(files, customOptions);

      setTimeout(() => {
        mockImg.onload?.();
        mockImg.onload?.();
      }, 0);

      await compressPromise;

      expect(imageCompression).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          maxSizeMB: 1,
          initialQuality: 0.8
        })
      );
    });
  });
});
