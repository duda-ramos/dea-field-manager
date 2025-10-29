import { describe, it, expect } from 'vitest';
import { shouldCompress } from './imageCompression';

describe('shouldCompress', () => {
  // Test case that will fail with the current buggy implementation
  it('should return false for a small PNG file (under the size threshold)', () => {
    // Create a mock PNG file smaller than SIZE_THRESHOLD_MB (1MB)
    const smallPngFile = new File([''], 'small.png', { type: 'image/png' });
    expect(shouldCompress(smallPngFile)).toBe(false);
  });

  // Test case to ensure large PNGs are still compressed
  it('should return true for a large PNG file (over the size threshold)', () => {
    // Create a mock PNG file larger than 1MB
    const largePngFile = new File([new ArrayBuffer(2 * 1024 * 1024)], 'large.png', {
      type: 'image/png',
    });
    expect(shouldCompress(largePngFile)).toBe(true);
  });

  // Test case for small JPG file
  it('should return false for a small JPG file (under the size threshold)', () => {
    const smallJpgFile = new File([''], 'small.jpg', { type: 'image/jpeg' });
    expect(shouldCompress(smallJpgFile)).toBe(false);
  });

  // Test case for large JPG file
  it('should return true for a large JPG file (over the size threshold)', () => {
    const largeJpgFile = new File([new ArrayBuffer(2 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    });
    expect(shouldCompress(largeJpgFile)).toBe(true);
  });

  // Test case for an unsupported file type
  it('should return false for an unsupported file type', () => {
    const unsupportedFile = new File([''], 'document.pdf', { type: 'application/pdf' });
    expect(shouldCompress(unsupportedFile)).toBe(false);
  });
});
