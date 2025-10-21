import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { showToast } from '@/lib/toast';
import { Camera, Upload, Image as ImageIcon, Search, Filter, Tag, Loader2, X, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { uploadToStorage } from '@/services/storage/filesStorage';
import { StorageManagerDexie as Storage } from '@/services/StorageManager';
import { ImageEditor } from './ImageEditor';
import { BulkDownloader } from './BulkDownloader';
import type { ProjectFile } from '@/types';
import { syncPhotoToProjectAlbum } from '@/utils/photoSync';
import { storage } from '@/lib/storage';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { logger } from '@/services/logger';
import { withRetry, isRetryableNetworkError } from '@/services/sync/utils';
import { compressImage, shouldCompress } from '@/utils/imageCompression';

// Validation constants
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const MAX_IMAGES_PER_INSTALLATION = 10;

interface FilePreview {
  file: File;
  preview: string;
  id: string;
  wasCompressed?: boolean;
}

interface EnhancedImageUploadProps {
  projectId: string;
  installationId?: string;
  context?: string; // For naming convention
  onImagesChange?: (images: ProjectFile[]) => void;
  className?: string;
  disableCompression?: boolean; // Optional: disable automatic compression
}

export function EnhancedImageUpload({ 
  projectId, 
  installationId, 
  context = 'arquivo',
  onImagesChange,
  className,
  disableCompression = false
}: EnhancedImageUploadProps) {
  const [images, setImages] = useState<ProjectFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [filterBy, setFilterBy] = useState<'all' | 'general' | 'installation'>('all');
  const [editingImage, setEditingImage] = useState<ProjectFile | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [installations, setInstallations] = useState<Map<string, { codigo: number; descricao: string }>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<{ current: number; total: number } | null>(null);
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load all images from project (including from installations)
  useEffect(() => {
    loadAllImages();
    loadInstallations();
  }, [projectId]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      filePreviews.forEach(preview => {
        URL.revokeObjectURL(preview.preview);
      });
    };
  }, [filePreviews]);

  const loadAllImages = async () => {
    try {
      const allImages = await Storage.getFilesByProject(projectId);
      const imageFiles = allImages.filter(f => f.type?.startsWith('image/'));
      setImages(imageFiles);
      onImagesChange?.(imageFiles);
    } catch (error) {
      console.error('[EnhancedImageUpload] Falha ao carregar imagens:', error, {
        projectId,
        imageCount: images.length
      });
      logger.error('Error loading images', {
        error,
        projectId,
        operacao: 'loadAllImages'
      });
    }
  };

  const loadInstallations = async () => {
    try {
      const installs = await Storage.getInstallationsByProject(projectId);
      const map = new Map();
      installs.forEach(inst => {
        map.set(inst.id, { codigo: inst.codigo, descricao: inst.descricao });
      });
      setInstallations(map);
    } catch (error) {
      console.error('[EnhancedImageUpload] Falha ao carregar instalações:', error, {
        projectId
      });
      logger.error('Error loading installations', {
        error,
        projectId,
        operacao: 'loadInstallations'
      });
    }
  };

  // Generate automatic filename
  const generateFileName = (originalName: string, sequencial: number): string => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const extension = originalName.split('.').pop();
    const paddedSequencial = String(sequencial).padStart(3, '0');
    return `${context}_${date}_${paddedSequencial}.${extension}`;
  };

  // Get next sequential number
  const getNextSequential = async (): Promise<number> => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todayImages = images.filter(img => 
      img.name.includes(`${context}_${today}`)
    );
    return todayImages.length + 1;
  };

  // Validate file type
  const validateFileType = (file: File): boolean => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    return ALLOWED_FILE_TYPES.includes(file.type) && 
           extension !== undefined && 
           ALLOWED_EXTENSIONS.includes(extension);
  };

  // Validate file size
  const validateFileSize = (file: File): boolean => {
    return file.size <= MAX_FILE_SIZE;
  };

  // Validate image limit
  const validateImageLimit = (newFilesCount: number): boolean => {
    if (!installationId) return true; // No limit for general project images
    const currentInstallationImages = images.filter(img => img.installationId === installationId).length;
    return (currentInstallationImages + newFilesCount) <= MAX_IMAGES_PER_INSTALLATION;
  };

  // Check for duplicate files
  const isDuplicateFile = (fileName: string): boolean => {
    return images.some(img => img.name === fileName) || 
           filePreviews.some(preview => preview.file.name === fileName);
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Upload single image
  const uploadImage = async (
    file: File,
    options: { alreadyCompressed?: boolean } = {}
  ): Promise<ProjectFile> => {
    const { alreadyCompressed = false } = options;
    const id = crypto.randomUUID();
    const sequential = await getNextSequential();
    const newFileName = generateFileName(file.name, sequential);

    setUploadProgress(prev => ({ ...prev, [id]: 0 }));

    try {
      // Compress image before upload (unless disabled)
      let fileToUpload = file;
      const startTime = Date.now();

      if (!disableCompression && !alreadyCompressed && shouldCompress(file)) {
        logger.info('Comprimindo imagem antes do upload', {
          fileName: file.name,
          originalSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
          operacao: 'uploadImage'
        });

        const compressedFile = await compressImage(file);
        const compressionTime = Date.now() - startTime;
        
        // Calculate reduction
        const originalSizeMB = file.size / (1024 * 1024);
        const compressedSizeMB = compressedFile.size / (1024 * 1024);
        const reductionPercent = ((file.size - compressedFile.size) / file.size) * 100;
        
        // Log compression results
        logger.info('Imagem comprimida com sucesso', {
          fileName: file.name,
          originalSize: `${originalSizeMB.toFixed(2)}MB`,
          compressedSize: `${compressedSizeMB.toFixed(2)}MB`,
          reduction: `${reductionPercent.toFixed(1)}%`,
          compressionTime: `${compressionTime}ms`,
          operacao: 'uploadImage'
        });

        console.log(`📦 Comprimiu ${file.name} de ${originalSizeMB.toFixed(2)}MB para ${compressedSizeMB.toFixed(2)}MB (${reductionPercent.toFixed(1)}% redução) em ${compressionTime}ms`);
        
        fileToUpload = compressedFile;
      } else if (!disableCompression) {
        logger.info('Imagem não requer compressão', {
          fileName: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
          operacao: 'uploadImage'
        });
      }

      // Create new file with renamed filename
      const renamedFile = new File([fileToUpload], newFileName, { type: fileToUpload.type });
      
      const res = await withRetry(
        () => uploadToStorage(renamedFile, { projectId, installationId, id }),
        {
          maxAttempts: 5,
          baseDelay: 500,
          retryCondition: isRetryableNetworkError
        },
        `Upload de imagem: ${newFileName}`
      );
      
      const imageRecord: ProjectFile = {
        id,
        projectId,
        project_id: projectId,
        installationId,
        installation_id: installationId,
        name: newFileName,
        size: file.size,
        type: file.type,
        storagePath: res.storagePath,
        storage_path: res.storagePath,
        uploadedAt: res.uploadedAtISO,
        uploaded_at: res.uploadedAtISO,
        updatedAt: Date.now(),
        createdAt: Date.now(),
        _dirty: 0,
        _deleted: 0,
        url: '' // Will be generated on demand
      };

      await Storage.upsertFile(imageRecord);
      setUploadProgress(prev => ({ ...prev, [id]: 100 }));
      
      // Sincronizar foto com álbum do projeto (se for de uma instalação)
      if (installationId) {
        try {
          const installation = await storage.getInstallation(installationId);
          if (installation) {
            await syncPhotoToProjectAlbum(
              projectId,
              installationId,
              installation.codigo.toString(),
              res.storagePath,
              file.size,
              file.type
            );
          }
        } catch (syncError) {
          // Erro de sync não deve bloquear o upload principal
          console.error('[EnhancedImageUpload] Falha ao sincronizar foto com álbum:', syncError, {
            projectId,
            installationId,
            storagePath: res.storagePath
          });
          logger.error('Erro ao sincronizar foto com álbum', {
            error: syncError,
            projectId,
            installationId,
            storagePath: res.storagePath,
            operacao: 'syncPhotoToProjectAlbum'
          });
        }
      }
      
      // Remove progress after delay
      setTimeout(() => {
        setUploadProgress(prev => {
          const { [id]: _, ...rest } = prev;
          return rest;
        });
      }, 2000);

      return imageRecord;
    } catch (error) {
      console.error('[EnhancedImageUpload] Falha no upload de imagem após retries:', error, {
        fileName: file.name,
        fileSize: file.size,
        projectId,
        installationId
      });
      logger.error('Image upload failed after retries', {
        error,
        fileName: file.name,
        fileSize: file.size,
        projectId,
        installationId,
        operacao: 'uploadImage'
      });
      setUploadProgress(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      
      // Show user-friendly error message
      showToast.error(
        'Erro no upload',
        'Não foi possível enviar a imagem após várias tentativas. Verifique sua conexão e tente novamente.'
      );
      
      throw error;
    }
  };

  // Handle file uploads - validate and create previews
  const handleFiles = async (files: FileList) => {
    if (isUploading) return; // Prevent handling new files during upload
    
    const fileArray = Array.from(files);
    const errors: string[] = [];
    const validFiles: FilePreview[] = [];

    // Validate each file
    for (const file of fileArray) {
      // Check file type
      if (!validateFileType(file)) {
        const error = `${file.name}: Formato não suportado. Use JPG, PNG ou WEBP`;
        errors.push(error);
        showToast.error("Formato não suportado", "Use JPG, PNG ou WEBP");
        continue;
      }

      // Check file size
      if (!validateFileSize(file)) {
        const error = `${file.name}: Arquivo muito grande (${formatFileSize(file.size)})`;
        errors.push(error);
        showToast.error("Arquivo muito grande", "Máximo 5MB por imagem");
        continue;
      }

      // Check for duplicates
      if (isDuplicateFile(file.name)) {
        errors.push(`${file.name}: Esta foto já foi adicionada`);
        showToast.error("Foto duplicada", "Esta foto já foi adicionada");
        continue;
      }

      // Create preview
      const preview = URL.createObjectURL(file);
      validFiles.push({
        file,
        preview,
        id: crypto.randomUUID()
      });
    }

    // Check image limit
    if (!validateImageLimit(validFiles.length + filePreviews.length)) {
      const error = `Limite de ${MAX_IMAGES_PER_INSTALLATION} fotos atingido para esta instalação`;
      errors.push(error);
      showToast.error("Limite atingido", `Máximo de ${MAX_IMAGES_PER_INSTALLATION} fotos por instalação`);
      setValidationErrors(errors);
      return;
    }

    // Update state
    if (validFiles.length > 0) {
      setFilePreviews(prev => [...prev, ...validFiles]);
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
    }
  };

  // Remove preview
  const removePreview = (id: string) => {
    setFilePreviews(prev => {
      const preview = prev.find(p => p.id === id);
      if (preview) {
        URL.revokeObjectURL(preview.preview);
      }
      return prev.filter(p => p.id !== id);
    });
  };

  // Confirm and upload all previewed files
  const confirmUpload = async () => {
    if (filePreviews.length === 0) return;

    setValidationErrors([]);
    
    try {
      // Compress images first if compression is enabled
      let filesToUpload = filePreviews;
      
      if (!disableCompression) {
        const filesToCompress = filePreviews.filter(preview => shouldCompress(preview.file));
        
        if (filesToCompress.length > 0) {
          setIsCompressing(true);
          setCompressionProgress({ current: 0, total: filesToCompress.length });
          
          logger.info('Iniciando compressão em lote', {
            totalFiles: filePreviews.length,
            filesToCompress: filesToCompress.length,
            operacao: 'confirmUpload'
          });

          // Show compression toast
          if (filesToCompress.length > 1) {
            showToast.info(
              'Comprimindo imagens',
              `Comprimindo ${filesToCompress.length} ${filesToCompress.length === 1 ? 'imagem' : 'imagens'}...`
            );
          }

          // Compress all images in parallel
          const compressionStartTime = Date.now();
          const compressedFiles = await Promise.all(
            filePreviews.map(async (preview, index) => {
              if (shouldCompress(preview.file)) {
                const compressed = await compressImage(preview.file);
                setCompressionProgress({ current: index + 1, total: filesToCompress.length });
                return { ...preview, file: compressed, wasCompressed: true };
              }
              return preview;
            })
          );
          
          const totalCompressionTime = Date.now() - compressionStartTime;
          
          logger.info('Compressão em lote concluída', {
            totalFiles: filesToCompress.length,
            totalTime: `${totalCompressionTime}ms`,
            avgTime: `${(totalCompressionTime / filesToCompress.length).toFixed(0)}ms`,
            operacao: 'confirmUpload'
          });

          filesToUpload = compressedFiles;
          setIsCompressing(false);
          setCompressionProgress(null);
        }
      }

      // Now upload all files
      setIsUploading(true);
      const uploadPromises = filesToUpload.map(preview =>
        uploadImage(preview.file, { alreadyCompressed: preview.wasCompressed })
      );
      const uploadedImages = await Promise.all(uploadPromises);
      
      const newImages = [...images, ...uploadedImages];
      setImages(newImages);
      onImagesChange?.(newImages);
      
      // Clear previews
      filePreviews.forEach(preview => {
        URL.revokeObjectURL(preview.preview);
      });
      setFilePreviews([]);
      
      const photoWord = uploadedImages.length === 1 ? 'foto' : 'fotos';
      toast({
        title: `${uploadedImages.length} ${photoWord} ${uploadedImages.length === 1 ? 'enviada' : 'enviadas'} com sucesso`,
        description: installationId 
          ? `${photoWord.charAt(0).toUpperCase() + photoWord.slice(1)} ${uploadedImages.length === 1 ? 'adicionada' : 'adicionadas'} à instalação e sincronizada com a galeria`
          : `Upload concluído: ${uploadedImages.length} ${uploadedImages.length === 1 ? 'imagem processada' : 'imagens processadas'}`,
        duration: 3000
      });
      showToast.success(
        'Imagens enviadas com sucesso',
        installationId 
          ? `${uploadedImages.length} foto(s) salva(s) no item e sincronizada(s) com a galeria.`
          : `${uploadedImages.length} imagem(ns) enviada(s) com sucesso.`
      );
    } catch (error) {
      console.error('[EnhancedImageUpload] Falha ao enviar imagens em lote:', error, {
        fileCount: filePreviews.length,
        projectId,
        installationId
      });
      logger.error('Erro ao enviar imagens em lote após retries', {
        error,
        fileCount: filePreviews.length,
        projectId,
        installationId,
        operacao: 'confirmUpload'
      });
      toast({
        title: 'Erro no upload de imagens',
        description: `Falha ao enviar ${filePreviews.length} ${filePreviews.length === 1 ? 'imagem' : 'imagens'}. Verifique sua conexão e tente novamente`,
        variant: 'destructive',
        duration: 5000
      });
      showToast.error(
        'Erro ao enviar imagens',
        'Não foi possível completar a operação após várias tentativas. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setIsUploading(false);
      setIsCompressing(false);
      setCompressionProgress(null);
    }
  };

  // Cancel all previews
  const cancelPreviews = () => {
    filePreviews.forEach(preview => {
      URL.revokeObjectURL(preview.preview);
    });
    setFilePreviews([]);
    setValidationErrors([]);
  };

  // Handle file input change
  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return; // Prevent multiple uploads
    const files = event.target.files;
    if (files) {
      handleFiles(files);
    }
  };

  // Handle camera capture
  const handleCameraCapture = () => {
    if (isUploading) return; // Prevent multiple uploads
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  // Handle gallery upload
  const handleGalleryUpload = () => {
    if (isUploading) return; // Prevent multiple uploads
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Calculate statistics with useMemo for performance
  const statistics = useMemo(() => {
    const total = images.length;
    const withInstallation = images.filter(img => img.installationId).length;
    const general = images.filter(img => !img.installationId).length;
    return { total, withInstallation, general };
  }, [images]);

  // Calculate current installation image count
  const currentInstallationImageCount = useMemo(() => {
    if (!installationId) return 0;
    return images.filter(img => img.installationId === installationId).length;
  }, [images, installationId]);

  // Check if upload should be disabled due to limit
  const isUploadDisabled = useMemo(() => {
    if (!installationId) return false;
    return currentInstallationImageCount >= MAX_IMAGES_PER_INSTALLATION;
  }, [currentInstallationImageCount, installationId]);

  // Filter and sort images
  const filteredAndSortedImages = images
    .filter(img => {
      // Filter by category
      if (filterBy === 'general' && img.installationId) return false;
      if (filterBy === 'installation' && !img.installationId) return false;
      
      // Filter by search term
      return (
        img.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (img.uploadedAt && img.uploadedAt.includes(searchTerm))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
        const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
        return dateB - dateA;
      }
      return a.name.localeCompare(b.name);
    });

  // Edit image
  const editImage = (image: ProjectFile) => {
    setEditingImage(image);
    setIsEditorOpen(true);
  };

  // Handle edited image save
  const handleImageEdited = async (editedImageBlob: Blob, originalImage: ProjectFile) => {
    const sequential = await getNextSequential();
    const newFileName = generateFileName(originalImage.name, sequential);
    const editedFile = new File([editedImageBlob], newFileName, { type: 'image/png' });
    
    setIsUploading(true);
    try {
      const newImage = await uploadImage(editedFile);
      const newImages = [...images, newImage];
      setImages(newImages);
      onImagesChange?.(newImages);
      
      setIsEditorOpen(false);
      setEditingImage(null);
      
      toast({
        title: 'Imagem editada com sucesso',
        description: 'A versão editada foi salva na galeria',
        duration: 3000
      });
      showToast.success('Imagem editada salva com sucesso');
    } catch (error) {
      console.error('[EnhancedImageUpload] Falha ao salvar imagem editada:', error, {
        originalImageId: originalImage.id,
        originalImageName: originalImage.name,
        projectId,
        installationId
      });
      logger.error('Erro ao salvar imagem editada após retries', {
        error,
        originalImageId: originalImage.id,
        originalImageName: originalImage.name,
        projectId,
        installationId,
        operacao: 'handleImageEdited'
      });
      toast({
        title: 'Erro ao salvar imagem editada',
        description: 'Não foi possível salvar as edições. Tente novamente',
        variant: 'destructive',
        duration: 5000
      });
      showToast.error(
        'Erro ao salvar imagem editada',
        'Não foi possível completar a operação após várias tentativas. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn('space-y-6 max-w-full overflow-x-hidden relative', className)}>
      {/* Compression Overlay */}
      {isCompressing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-background p-6 rounded-lg shadow-lg flex flex-col items-center gap-4 min-w-[300px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium text-lg">Comprimindo imagens...</p>
              {compressionProgress && (
                <p className="text-sm text-muted-foreground mt-2">
                  {compressionProgress.current} de {compressionProgress.total} imagens
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Por favor, aguarde</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Overlay */}
      {isUploading && !isCompressing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-background p-6 rounded-lg shadow-lg flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium text-lg">Enviando imagens...</p>
              <p className="text-sm text-muted-foreground">Por favor, aguarde</p>
            </div>
          </div>
        </div>
      )}
      {/* Upload Controls */}
      <Card>
        <CardContent className="p-6">
          {/* Photo Counter for Installations */}
          {installationId && (
            <div className="mb-4 flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                <span className="font-medium">
                  Fotos desta instalação: {currentInstallationImageCount}/{MAX_IMAGES_PER_INSTALLATION}
                </span>
              </div>
              {currentInstallationImageCount >= MAX_IMAGES_PER_INSTALLATION && (
                <Badge variant="destructive" className="ml-2">
                  Limite Atingido
                </Badge>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={handleCameraCapture}
              className="flex-1 h-12"
              variant="default"
              disabled={isUploading || isCompressing || isUploadDisabled}
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Camera className="h-5 w-5 mr-2" />
              )}
              {isUploading ? 'Enviando...' : 'Capturar Foto'}
            </Button>
            <Button 
              onClick={handleGalleryUpload}
              variant="outline"
              className="flex-1 h-12"
              disabled={isUploading || isCompressing || isUploadDisabled}
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Upload className="h-5 w-5 mr-2" />
              )}
              {isUploading ? 'Enviando...' : 'Galeria/Arquivo'}
            </Button>
            <div className="shrink-0 w-full sm:w-auto">
              <BulkDownloader 
                images={images}
                projectName={`projeto_${projectId}`}
              />
            </div>
          </div>

          {/* Hidden inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            capture="environment"
            multiple
            onChange={handleFileInput}
            className="hidden"
            disabled={isUploading || isCompressing}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            multiple
            onChange={handleFileInput}
            className="hidden"
            disabled={isUploading || isCompressing}
          />
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* File Previews */}
      {filePreviews.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Preview das Fotos ({filePreviews.length})
                </h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={cancelPreviews}
                    disabled={isUploading || isCompressing}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button 
                    size="sm"
                    onClick={confirmUpload}
                    disabled={isUploading || isCompressing}
                  >
                    {isCompressing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Comprimindo...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Confirmar Upload
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filePreviews.map((preview) => (
                  <div key={preview.id} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden border-2 border-border">
                      <img
                        src={preview.preview}
                        alt={preview.file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removePreview(preview.id)}
                      disabled={isUploading || isCompressing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium truncate" title={preview.file.name}>
                        {preview.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(preview.file.size)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Progress */}
      {Object.entries(uploadProgress).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              {Object.entries(uploadProgress).map(([id, progress]) => (
                <div key={id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Enviando...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ImageIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statistics.total}</p>
                <p className="text-xs text-muted-foreground">Total de Imagens</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Tag className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statistics.withInstallation}</p>
                <p className="text-xs text-muted-foreground">De Instalações</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Filter className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statistics.general}</p>
                <p className="text-xs text-muted-foreground">Gerais</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar por nome ou data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterBy} onValueChange={(value: 'all' | 'general' | 'installation') => setFilterBy(value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as imagens</SelectItem>
            <SelectItem value="general">Apenas gerais</SelectItem>
            <SelectItem value="installation">Apenas de peças</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(value: 'date' | 'name') => setSortBy(value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Data (mais recente)</SelectItem>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Images Grid */}
      {filteredAndSortedImages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma imagem encontrada</h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm ? 'Tente ajustar sua busca.' : 'Comece enviando suas primeiras imagens.'}
            </p>
            {!searchTerm && (
              <Button onClick={handleGalleryUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Enviar Primeira Imagem
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <TooltipProvider>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {filteredAndSortedImages.map((image) => {
              const installation = image.installationId ? installations.get(image.installationId) : null;
              
              return (
                <Tooltip key={image.id}>
                  <TooltipTrigger asChild>
                    <Card className="group overflow-hidden cursor-pointer">
                      <CardContent className="p-0">
                        <div className="aspect-square relative">
                          <img
                            src={image.url || ''}
                            alt={image.name}
                            className="w-full h-full object-cover transition-transform hover:scale-105"
                          />
                          {installation && (
                            <div className="absolute top-2 left-2 z-10">
                              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                Peça {installation.codigo}
                              </Badge>
                            </div>
                          )}
                          {!image.installationId && (
                            <div className="absolute top-2 left-2 z-10">
                              <Badge variant="outline" className="text-xs bg-background/80">
                                Geral
                              </Badge>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => editImage(image)}
                            >
                              Editar
                            </Button>
                          </div>
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium truncate">{image.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {image.uploadedAt ? new Date(image.uploadedAt).toLocaleDateString('pt-BR') : 'Data indisponível'}
                          </p>
                          {installation && (
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {installation.descricao}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{image.name}</p>
                      <p className="text-xs text-muted-foreground">
                        📅 Upload: {image.uploadedAt ? new Date(image.uploadedAt).toLocaleDateString('pt-BR', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'Data indisponível'}
                      </p>
                      {installation ? (
                        <p className="text-xs text-muted-foreground">
                          🏷️ Peça {installation.codigo}: {installation.descricao}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          📁 Foto Geral
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        💾 {(image.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      )}

      {/* Image Editor Modal */}
      {editingImage && (
        <ImageEditor
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingImage(null);
          }}
          image={editingImage}
          onSave={handleImageEdited}
        />
      )}
    </div>
  );
}