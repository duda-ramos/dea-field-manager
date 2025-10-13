/**
 * Image Compression Utility
 * Provides functions to compress images before upload
 */

// Types
export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  fileType?: string;
  useWebWorker?: boolean;
}

export interface CompressionMetrics {
  originalSizeMB: number;
  compressedSizeMB: number;
  reductionPercent: number;
  fileName: string;
  wasCompressed: boolean;
  originalDimensions?: { width: number; height: number };
  compressedDimensions?: { width: number; height: number };
}

export interface CompressionResult {
  file: File;
  metrics: CompressionMetrics;
}

interface ImageDimensions {
  width: number;
  height: number;
}

// Constants
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1920,
  quality: 0.85,
  fileType: 'image/jpeg',
  useWebWorker: true
};

const SIZE_THRESHOLD_MB = 1; // 1MB threshold for compression

/**
 * Validates if the file is an accepted image type
 * @param file - File to validate
 * @throws Error if file type is not accepted
 */
function validateImageType(file: File): void {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      `Tipo de arquivo não aceito: ${file.type}. ` +
      `Tipos aceitos: ${ACCEPTED_IMAGE_TYPES.join(', ')}`
    );
  }
}

/**
 * Gets the dimensions of an image file
 * @param file - Image file to measure
 * @returns Promise with width and height
 */
export async function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    try {
      validateImageType(file);
      
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          width: img.width,
          height: img.height
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Erro ao carregar imagem para obter dimensões'));
      };

      img.src = objectUrl;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Determines if an image should be compressed based on size, format, and dimensions
 * @param file - Image file to check
 * @returns true if compression is recommended
 */
export function shouldCompress(file: File): boolean {
  try {
    // Check if file type is accepted
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return false;
    }

    // Check file size (convert bytes to MB)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > SIZE_THRESHOLD_MB) {
      return true;
    }

    // Check if format is different from JPEG
    if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') {
      return true;
    }

    // Note: Dimension check requires async operation (getImageDimensions)
    // For synchronous check, we rely on size and format only
    return false;
  } catch (error) {
    console.error('Erro ao verificar se imagem precisa de compressão:', error);
    return false;
  }
}

/**
 * Checks if image dimensions exceed the threshold
 * @param file - Image file to check
 * @param maxDimension - Maximum allowed dimension
 * @returns Promise<boolean> - true if dimensions exceed threshold
 */
export async function shouldCompressByDimensions(
  file: File,
  maxDimension: number = 1920
): Promise<boolean> {
  try {
    const dimensions = await getImageDimensions(file);
    return dimensions.width > maxDimension || dimensions.height > maxDimension;
  } catch (error) {
    console.error('Erro ao verificar dimensões da imagem:', error);
    return false;
  }
}

/**
 * Compresses an image using canvas API
 * @param file - Original image file
 * @param options - Compression options
 * @returns Promise<File> - Compressed image file
 */
async function compressImageWithCanvas(
  file: File,
  options: Required<CompressionOptions>
): Promise<File> {
  return new Promise(async (resolve, reject) => {
    try {
      const dimensions = await getImageDimensions(file);
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        try {
          URL.revokeObjectURL(objectUrl);

          // Calculate new dimensions while maintaining aspect ratio
          let { width, height } = dimensions;
          const maxDimension = options.maxWidthOrHeight;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          // Create canvas and draw image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            throw new Error('Não foi possível criar contexto do canvas');
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Convert canvas to blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Erro ao converter canvas para blob'));
                return;
              }

              // Check if compressed size is within limit
              const compressedSizeMB = blob.size / (1024 * 1024);
              if (compressedSizeMB > options.maxSizeMB) {
                // Try with lower quality
                const lowerQuality = Math.max(0.5, options.quality - 0.2);
                canvas.toBlob(
                  (retryBlob) => {
                    if (!retryBlob) {
                      reject(new Error('Erro ao comprimir imagem com qualidade reduzida'));
                      return;
                    }
                    const compressedFile = new File([retryBlob], file.name, {
                      type: options.fileType,
                      lastModified: Date.now()
                    });
                    resolve(compressedFile);
                  },
                  options.fileType,
                  lowerQuality
                );
              } else {
                const compressedFile = new File([blob], file.name, {
                  type: options.fileType,
                  lastModified: Date.now()
                });
                resolve(compressedFile);
              }
            },
            options.fileType,
            options.quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Erro ao carregar imagem para compressão'));
      };

      img.src = objectUrl;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Main compression function - compresses an image file
 * @param file - Original image file
 * @param options - Optional compression settings
 * @returns Promise<File> - Compressed image file (or original if compression fails)
 */
export async function compressImage(
  file: File,
  options?: CompressionOptions
): Promise<File> {
  try {
    // Validate image type
    validateImageType(file);

    // Merge options with defaults
    const mergedOptions: Required<CompressionOptions> = {
      ...DEFAULT_OPTIONS,
      ...options
    };

    const originalSizeMB = file.size / (1024 * 1024);

    // Check if compression is needed
    const needsCompression = shouldCompress(file);
    const needsDimensionCheck = await shouldCompressByDimensions(
      file,
      mergedOptions.maxWidthOrHeight
    );

    if (!needsCompression && !needsDimensionCheck) {
      console.log('ℹ️ Imagem não precisa de compressão:', file.name);
      return file;
    }

    console.group('🖼️ Compressão de Imagem');
    console.log('📁 Arquivo:', file.name);
    console.log('📊 Tamanho original:', `${originalSizeMB.toFixed(2)}MB`);

    // Compress the image
    const compressedFile = await compressImageWithCanvas(file, mergedOptions);
    const compressedSizeMB = compressedFile.size / (1024 * 1024);
    const reductionPercent = ((file.size - compressedFile.size) / file.size) * 100;

    console.log('✅ Compressão concluída!');
    console.log('📊 Tamanho final:', `${compressedSizeMB.toFixed(2)}MB`);
    console.log('💾 Economia:', `${reductionPercent.toFixed(1)}%`);
    console.log(`🎯 ${originalSizeMB.toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB (${reductionPercent.toFixed(1)}% de redução)`);
    console.groupEnd();

    return compressedFile;
  } catch (error) {
    console.error('❌ Erro ao comprimir imagem:', error);
    
    // Return original file if compression fails
    console.warn('⚠️ Retornando arquivo original devido a erro na compressão');
    return file;
  }
}

/**
 * Main compression function with detailed metrics
 * @param file - Original image file
 * @param options - Optional compression settings
 * @returns Promise<CompressionResult> - Compressed file with metrics
 */
export async function compressImageWithMetrics(
  file: File,
  options?: CompressionOptions
): Promise<CompressionResult> {
  const startTime = performance.now();
  const originalSizeMB = file.size / (1024 * 1024);
  
  try {
    validateImageType(file);

    const mergedOptions: Required<CompressionOptions> = {
      ...DEFAULT_OPTIONS,
      ...options
    };

    const originalDimensions = await getImageDimensions(file);
    const needsCompression = shouldCompress(file);
    const needsDimensionCheck = await shouldCompressByDimensions(
      file,
      mergedOptions.maxWidthOrHeight
    );

    if (!needsCompression && !needsDimensionCheck) {
      const metrics: CompressionMetrics = {
        originalSizeMB,
        compressedSizeMB: originalSizeMB,
        reductionPercent: 0,
        fileName: file.name,
        wasCompressed: false,
        originalDimensions,
        compressedDimensions: originalDimensions
      };
      
      console.log('ℹ️ Imagem não precisa de compressão:', file.name);
      return { file, metrics };
    }

    console.group('🖼️ Compressão de Imagem');
    console.log('📁 Arquivo:', file.name);
    console.log('📊 Tamanho original:', `${originalSizeMB.toFixed(2)}MB`);
    console.log('📐 Dimensões originais:', `${originalDimensions.width}x${originalDimensions.height}px`);

    const compressedFile = await compressImageWithCanvas(file, mergedOptions);
    const compressedSizeMB = compressedFile.size / (1024 * 1024);
    const reductionPercent = ((file.size - compressedFile.size) / file.size) * 100;
    const compressedDimensions = await getImageDimensions(compressedFile);
    const processingTime = performance.now() - startTime;

    const metrics: CompressionMetrics = {
      originalSizeMB,
      compressedSizeMB,
      reductionPercent,
      fileName: file.name,
      wasCompressed: true,
      originalDimensions,
      compressedDimensions
    };

    console.log('✅ Compressão concluída!');
    console.log('📊 Tamanho final:', `${compressedSizeMB.toFixed(2)}MB`);
    console.log('📐 Dimensões finais:', `${compressedDimensions.width}x${compressedDimensions.height}px`);
    console.log('💾 Economia:', `${reductionPercent.toFixed(1)}%`);
    console.log('⏱️ Tempo de processamento:', `${processingTime.toFixed(0)}ms`);
    console.log(`🎯 ${originalSizeMB.toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB (${reductionPercent.toFixed(1)}% de redução)`);
    console.groupEnd();

    // Update global statistics
    updateCompressionStats(metrics);

    return { file: compressedFile, metrics };
  } catch (error) {
    console.error('❌ Erro ao comprimir imagem:', error);
    
    const metrics: CompressionMetrics = {
      originalSizeMB,
      compressedSizeMB: originalSizeMB,
      reductionPercent: 0,
      fileName: file.name,
      wasCompressed: false
    };
    
    console.warn('⚠️ Retornando arquivo original devido a erro na compressão');
    return { file, metrics };
  }
}

/**
 * Compresses multiple images in batch
 * @param files - Array of image files
 * @param options - Optional compression settings
 * @returns Promise<File[]> - Array of compressed image files
 */
export async function compressImages(
  files: File[],
  options?: CompressionOptions
): Promise<File[]> {
  console.group(`🗂️ Compressão em Lote (${files.length} arquivo${files.length > 1 ? 's' : ''})`);
  
  try {
    const compressionPromises = files.map(file => compressImage(file, options));
    const results = await Promise.all(compressionPromises);
    
    console.log(`✅ Processamento concluído: ${files.length} arquivo${files.length > 1 ? 's' : ''}`);
    console.groupEnd();
    
    return results;
  } catch (error) {
    console.error('❌ Erro ao comprimir múltiplas imagens:', error);
    console.groupEnd();
    throw error;
  }
}

/**
 * Get file size in a human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if file is large (>5MB)
 * @param file - File to check
 * @returns true if file is larger than 5MB
 */
export function isLargeFile(file: File | number): boolean {
  const bytes = typeof file === 'number' ? file : file.size;
  const sizeMB = bytes / (1024 * 1024);
  return sizeMB > 5;
}

// Global compression statistics storage
const STATS_STORAGE_KEY = 'image_compression_stats';

export interface CompressionStats {
  totalImages: number;
  totalCompressed: number;
  totalOriginalSizeMB: number;
  totalCompressedSizeMB: number;
  totalSavingsMB: number;
  compressionHistory: Array<{
    timestamp: string;
    fileName: string;
    originalSizeMB: number;
    compressedSizeMB: number;
    reductionPercent: number;
  }>;
}

/**
 * Get compression statistics from localStorage
 */
export function getCompressionStats(): CompressionStats {
  try {
    const stored = localStorage.getItem(STATS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading compression stats:', error);
  }
  
  return {
    totalImages: 0,
    totalCompressed: 0,
    totalOriginalSizeMB: 0,
    totalCompressedSizeMB: 0,
    totalSavingsMB: 0,
    compressionHistory: []
  };
}

/**
 * Save compression statistics to localStorage
 */
function saveCompressionStats(stats: CompressionStats): void {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Error saving compression stats:', error);
  }
}

/**
 * Update global compression statistics
 */
export function updateCompressionStats(metrics: CompressionMetrics): void {
  const stats = getCompressionStats();
  
  stats.totalImages += 1;
  stats.totalOriginalSizeMB += metrics.originalSizeMB;
  stats.totalCompressedSizeMB += metrics.compressedSizeMB;
  
  if (metrics.wasCompressed) {
    stats.totalCompressed += 1;
    stats.totalSavingsMB = stats.totalOriginalSizeMB - stats.totalCompressedSizeMB;
    
    // Add to history (keep last 50 compressions)
    stats.compressionHistory.unshift({
      timestamp: new Date().toISOString(),
      fileName: metrics.fileName,
      originalSizeMB: metrics.originalSizeMB,
      compressedSizeMB: metrics.compressedSizeMB,
      reductionPercent: metrics.reductionPercent
    });
    
    if (stats.compressionHistory.length > 50) {
      stats.compressionHistory = stats.compressionHistory.slice(0, 50);
    }
  }
  
  saveCompressionStats(stats);
}

/**
 * Clear compression statistics
 */
export function clearCompressionStats(): void {
  localStorage.removeItem(STATS_STORAGE_KEY);
}
