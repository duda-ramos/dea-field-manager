/**
 * Image Compression Utility
 * Provides functions to compress images before upload using browser-image-compression
 */

import imageCompression from 'browser-image-compression';

// Types
export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  fileType?: string;
  useWebWorker?: boolean;
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

    // Non-JPEG formats should still go through the compression pipeline so
    // that we can enforce the dimension constraints asynchronously inside
    // `compressImage`. Without this check, PNG/WebP files smaller than the
    // size threshold would exit early and skip the resize validation.
    if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') {
      return true;
    }

    // Check file size (convert bytes to MB)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > SIZE_THRESHOLD_MB) {
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
 * Compresses an image using browser-image-compression library
 * @param file - Original image file
 * @param options - Compression options
 * @returns Promise<File> - Compressed image file
 */
async function compressImageWithLibrary(
  file: File,
  options: Required<CompressionOptions>
): Promise<File> {
  try {
    // Configure compression options for browser-image-compression
    const compressionOptions = {
      maxSizeMB: options.maxSizeMB,
      maxWidthOrHeight: options.maxWidthOrHeight,
      useWebWorker: options.useWebWorker,
      fileType: options.fileType,
      initialQuality: options.quality
    };

    // Compress the image using browser-image-compression
    const compressedFile = await imageCompression(file, compressionOptions);

    // Return the compressed file with original filename
    return new File([compressedFile], file.name, {
      type: compressedFile.type,
      lastModified: Date.now()
    });
  } catch (error) {
    console.error('Erro ao comprimir imagem com browser-image-compression:', error);
    throw new Error('Falha ao comprimir imagem usando biblioteca');
  }
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

    // Evaluate if the file exceeds the size threshold. We keep this separate
    // from `shouldCompress` so that non-JPEG files (which return `true` to
    // ensure the dimension checks run) don't get unnecessarily recompressed
    // when they are already within the allowed limits.
    const fileSizeMB = file.size / (1024 * 1024);
    const sizeExceedsThreshold = fileSizeMB > SIZE_THRESHOLD_MB;
    const needsDimensionCheck = await shouldCompressByDimensions(
      file,
      mergedOptions.maxWidthOrHeight
    );

    if (!sizeExceedsThreshold && !needsDimensionCheck) {
      console.log('Imagem não precisa de compressão');
      return file;
    }

    const startTime = Date.now();
    
    console.log('Comprimindo imagem...', {
      original: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
      name: file.name
    });

    // Compress the image using browser-image-compression library
    const compressedFile = await compressImageWithLibrary(file, mergedOptions);

    const compressionTime = Date.now() - startTime;
    const reductionPercent = ((file.size - compressedFile.size) / file.size) * 100;

    console.log('Imagem comprimida com sucesso', {
      original: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
      compressed: `${(compressedFile.size / (1024 * 1024)).toFixed(2)}MB`,
      reduction: `${reductionPercent.toFixed(1)}%`,
      time: `${compressionTime}ms`
    });

    return compressedFile;
  } catch (error) {
    console.error('Erro ao comprimir imagem:', error);
    
    // Return original file if compression fails
    console.warn('Retornando arquivo original devido a erro na compressão');
    return file;
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
  try {
    const compressionPromises = files.map(file => compressImage(file, options));
    return await Promise.all(compressionPromises);
  } catch (error) {
    console.error('Erro ao comprimir múltiplas imagens:', error);
    throw error;
  }
}
