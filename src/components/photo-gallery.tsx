import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, X, Plus, Image as ImageIcon, Download, FileText, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { syncPhotoToProjectAlbum } from "@/utils/photoSync";
import { uploadToStorage } from "@/services/storage/filesStorage";
import { useToast } from "@/hooks/use-toast";
import { showToast } from "@/lib/toast";
import { logger } from '@/services/logger';
import { LazyImage } from "@/components/ui/LazyImage";
import { Skeleton } from "@/components/ui/skeleton";
import { StorageManagerDexie as Storage } from '@/services/StorageManager';
import type { ProjectFile } from '@/types';
import JSZip from 'jszip';
import { compressImage, shouldCompress } from '@/utils/imageCompression';
import { getSignedUrl } from '@/services/storage/filesStorage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

interface PhotoGalleryProps {
  photos?: string[]; // Made optional to handle undefined
  onPhotosChange: (photos: string[]) => void;
  className?: string;
  projectId?: string; // Adiciona projectId opcional
  installationId?: string; // Adiciona installationId opcional
  installationCode?: string; // Adiciona código da instalação opcional
  isLoading?: boolean; // Adiciona estado de carregamento
}

interface PhotoMetadata extends ProjectFile {
  caption?: string;
}

interface FilePreview {
  file: File;
  preview: string;
  id: string;
  originalSize: number;
  wasCompressed?: boolean;
}

export function PhotoGallery({ 
  photos = [], 
  onPhotosChange, 
  className,
  projectId,
  installationId,
  installationCode,
  isLoading = false
}: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<number | null>(null);
  const [captionModalOpen, setCaptionModalOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [currentCaption, setCurrentCaption] = useState("");
  const [photoMetadata, setPhotoMetadata] = useState<Map<string, PhotoMetadata>>(new Map());
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const { toast } = useToast();

  // Ensure photos is always an array
  const safePhotos = photos || [];

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const buildStorageFileName = (file: File, code: string) => {
    const extension = file.name.split(".").pop() || "jpg";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const suffix = crypto.randomUUID();
    return `peca_${code}_${timestamp}_${suffix}.${extension}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const previews: FilePreview[] = [];

    for (const file of fileArray) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showToast.error("Formato inválido", `${file.name} não é uma imagem`);
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast.error("Arquivo muito grande", `${file.name} excede 10MB`);
        continue;
      }

      const preview = URL.createObjectURL(file);
      previews.push({
        file,
        preview,
        id: crypto.randomUUID(),
        originalSize: file.size
      });
    }

    if (previews.length > 0) {
      setFilePreviews(prev => [...prev, ...previews]);
    }

    event.target.value = "";
  };

  const removePreview = (id: string) => {
    setFilePreviews(prev => {
      const preview = prev.find(p => p.id === id);
      if (preview) {
        URL.revokeObjectURL(preview.preview);
      }
      return prev.filter(p => p.id !== id);
    });
  };

  const cancelAllPreviews = () => {
    filePreviews.forEach(preview => {
      URL.revokeObjectURL(preview.preview);
    });
    setFilePreviews([]);
  };

  const confirmUpload = async () => {
    if (filePreviews.length === 0) return;

    setIsUploading(true);
    const newPhotos: string[] = [];
    let syncedCount = 0;
    let syncFailed = false;

    try {
      // Compress images if needed
      let filesToUpload = filePreviews;
      
      const filesToCompress = filePreviews.filter(preview => shouldCompress(preview.file));
      
      if (filesToCompress.length > 0) {
        setIsCompressing(true);
        showToast.info(
          'Comprimindo imagens',
          `Otimizando ${filesToCompress.length} ${filesToCompress.length === 1 ? 'imagem' : 'imagens'}...`
        );

        const compressedFiles = await Promise.all(
          filePreviews.map(async (preview) => {
            if (shouldCompress(preview.file)) {
              const compressed = await compressImage(preview.file);
              return { ...preview, file: compressed, wasCompressed: true };
            }
            return preview;
          })
        );

        filesToUpload = compressedFiles;
        setIsCompressing(false);
      }

      // Upload all files
      for (const preview of filesToUpload) {
        try {
          const photoUrl = await readFileAsDataUrl(preview.file);
          newPhotos.push(photoUrl);

          if (projectId && installationId && installationCode) {
            try {
              const renamedFile = new File(
                [preview.file],
                buildStorageFileName(preview.file, installationCode),
                { type: preview.file.type }
              );

              const { storagePath } = await uploadToStorage(renamedFile, {
                projectId,
                installationId,
                id: crypto.randomUUID()
              });

              await syncPhotoToProjectAlbum(
                projectId,
                installationId,
                installationCode,
                storagePath,
                preview.file.size,
                preview.file.type
              );

              syncedCount += 1;
            } catch (error) {
              logger.error("Erro ao sincronizar foto com álbum do projeto", {
                error,
                projectId,
                installationId,
                installationCode,
                fileName: preview.file.name,
                operacao: 'syncPhotoToProjectAlbum'
              });
              syncFailed = true;
            }
          }
        } catch (error) {
          logger.error("Erro ao processar arquivo de foto", {
            error,
            fileName: preview.file.name,
            fileSize: preview.file.size,
            fileType: preview.file.type,
            operacao: 'confirmUpload'
          });
          showToast.error("Erro ao processar foto", `Não foi possível carregar "${preview.file.name}"`);
        }
      }

      if (newPhotos.length > 0) {
        onPhotosChange([...safePhotos, ...newPhotos]);
      }

      // Clear previews
      filePreviews.forEach(preview => {
        URL.revokeObjectURL(preview.preview);
      });
      setFilePreviews([]);

      if (syncedCount > 0) {
        const photoWord = syncedCount === 1 ? 'foto' : 'fotos';
        toast({
          title: `${syncedCount} ${photoWord} sincronizada${syncedCount === 1 ? '' : 's'}`,
          description: `Peça ${installationCode}: ${photoWord} adicionada${syncedCount === 1 ? '' : 's'} ao álbum do projeto`,
          duration: 3000
        });
      }

      if (syncFailed) {
        toast({
          title: "Atenção: Sincronização pendente",
          description: "Foto salva na peça, mas não sincronizada com o álbum. Tente sincronizar depois",
          variant: "destructive",
          duration: 5000
        });
      }
    } finally {
      setIsUploading(false);
      setIsCompressing(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotoToDelete(index);
  };

  const confirmDeletePhoto = () => {
    if (photoToDelete !== null) {
      const newPhotos = safePhotos.filter((_, i) => i !== photoToDelete);
      onPhotosChange(newPhotos);
      
      // Remove metadata if exists
      const photoUrl = safePhotos[photoToDelete];
      if (photoUrl) {
        const newMetadata = new Map(photoMetadata);
        newMetadata.delete(photoUrl);
        setPhotoMetadata(newMetadata);
      }
      
      toast({
        title: "Foto excluída",
        description: "A foto foi removida com sucesso",
        duration: 2000
      });
    }
    setPhotoToDelete(null);
  };

  const openCaptionModal = (index: number, photoUrl: string) => {
    setSelectedPhotoIndex(index);
    const metadata = photoMetadata.get(photoUrl);
    setCurrentCaption(metadata?.caption || "");
    setCaptionModalOpen(true);
  };

  const saveCaption = async () => {
    if (selectedPhotoIndex === null) return;

    const photoUrl = safePhotos[selectedPhotoIndex];
    if (!photoUrl) return;

    // Update metadata
    const newMetadata = new Map(photoMetadata);
    const existingMetadata = newMetadata.get(photoUrl) || {
      id: crypto.randomUUID(),
      name: `photo_${selectedPhotoIndex}`,
      size: 0,
      type: 'image/*',
      url: photoUrl,
      uploadedAt: new Date().toISOString(),
      updatedAt: Date.now(),
    } as PhotoMetadata;

    const updatedMetadata = {
      ...existingMetadata,
      caption: currentCaption,
      updatedAt: Date.now()
    };

    newMetadata.set(photoUrl, updatedMetadata);
    setPhotoMetadata(newMetadata);

    // Save to storage if we have IDs
    if (projectId && updatedMetadata.id) {
      try {
        await Storage.upsertFile(updatedMetadata);
        showToast.success("Legenda salva", "A legenda foi atualizada com sucesso");
      } catch (error) {
        logger.error("Erro ao salvar legenda da foto", {
          error,
          photoId: updatedMetadata.id,
          operacao: 'saveCaption'
        });
        showToast.error("Erro ao salvar", "Não foi possível salvar a legenda");
      }
    }

    setCaptionModalOpen(false);
    setSelectedPhotoIndex(null);
    setCurrentCaption("");
  };

  const downloadAllPhotos = async () => {
    if (safePhotos.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Nenhuma foto disponível para download.',
        variant: 'destructive'
      });
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const zip = new JSZip();
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const folderName = installationCode ? `peca_${installationCode}` : 'fotos';

      let processedCount = 0;
      const totalPhotos = safePhotos.length;

      for (const [index, photoUrl] of safePhotos.entries()) {
        try {
          const response = await fetch(photoUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch photo ${index}`);
          }

          const imageBlob = await response.blob();
          const metadata = photoMetadata.get(photoUrl);
          const fileName = metadata?.name || `foto_${index + 1}.jpg`;
          
          zip.file(`${folderName}/${fileName}`, imageBlob);

          // Add caption as text file if exists
          if (metadata?.caption) {
            zip.file(`${folderName}/${fileName.replace(/\.[^/.]+$/, "")}_legenda.txt`, metadata.caption);
          }

          processedCount++;
          setDownloadProgress((processedCount / totalPhotos) * 100);
        } catch (error) {
          logger.error('Erro ao baixar foto individual para ZIP', {
            error,
            photoIndex: index,
            operacao: 'downloadAllPhotos'
          });
        }
      }

      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${folderName}_${date}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      toast({
        title: 'Sucesso',
        description: `Download concluído! ${processedCount} fotos baixadas.`
      });
    } catch (error) {
      logger.error('Erro ao criar arquivo ZIP', {
        error,
        photoCount: safePhotos.length,
        operacao: 'downloadAllPhotos'
      });
      toast({
        title: 'Erro',
        description: 'Erro ao criar arquivo ZIP. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Fotos ({safePhotos.length})</h4>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={downloadAllPhotos}
            disabled={safePhotos.length === 0 || isDownloading}
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {Math.round(downloadProgress)}%
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Baixar Todas
              </>
            )}
          </Button>
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onClick={(e) => e.stopPropagation()}
              disabled={isUploading || isCompressing}
            />
            <Button 
              variant="outline" 
              size="sm" 
              className="pointer-events-none"
              disabled={isUploading || isCompressing}
            >
              <Camera className="h-4 w-4 mr-2" />
              Adicionar Fotos
            </Button>
          </div>
        </div>
      </div>

      {/* File Previews */}
      {filePreviews.length > 0 && (
        <div className="border-2 border-primary rounded-lg p-4 space-y-3 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              <span className="font-medium">Preview das Fotos ({filePreviews.length})</span>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={cancelAllPreviews}
                disabled={isUploading || isCompressing}
              >
                Cancelar Todas
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
                ) : isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Confirmar Upload'
                )}
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {filePreviews.map((preview) => (
              <div key={preview.id} className="relative group">
                <div className="aspect-square rounded-md overflow-hidden border-2 border-border">
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
                <Badge variant="secondary" className="absolute bottom-2 left-2 text-xs">
                  {formatFileSize(preview.originalSize)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
            <Skeleton key={i} className="w-full h-20 rounded-md" />
          ))}
        </div>
      ) : safePhotos.length === 0 ? (
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma foto adicionada</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {safePhotos.map((photo, index) => {
            const metadata = photoMetadata.get(photo);
            return (
              <div key={index} className="relative group">
                <LazyImage
                  src={photo}
                  alt={metadata?.caption || `Foto ${index + 1}`}
                  className="w-full h-20 object-cover rounded-md border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setSelectedPhoto(photo)}
                  threshold={0.1}
                  rootMargin="50px"
                />
                {metadata?.caption && (
                  <div className="absolute bottom-1 left-1 z-10">
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                    </Badge>
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-1 left-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCaptionModal(index, photo);
                  }}
                  title="Adicionar/editar legenda"
                >
                  <FileText className="h-3 w-3" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto(index);
                  }}
                  title="Excluir foto"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-md h-20 flex items-center justify-center hover:border-primary/50 transition-colors relative">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onClick={(e) => e.stopPropagation()}
              disabled={isUploading || isCompressing}
            />
            <Button variant="ghost" size="sm" className="h-full w-full pointer-events-none">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Photo Viewer Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedPhoto && photoMetadata.get(selectedPhoto)?.caption 
                ? photoMetadata.get(selectedPhoto)?.caption 
                : "Visualizar Foto"}
            </DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="space-y-4">
              <LazyImage
                src={selectedPhoto}
                alt="Foto ampliada"
                className="w-full h-auto max-h-[70vh] object-contain rounded-md"
                threshold={0.1}
                rootMargin="50px"
              />
              {photoMetadata.get(selectedPhoto)?.caption && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    {photoMetadata.get(selectedPhoto)?.caption}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={photoToDelete !== null} onOpenChange={() => setPhotoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta foto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePhoto} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Caption Modal */}
      <Dialog open={captionModalOpen} onOpenChange={setCaptionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Legenda da Foto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedPhotoIndex !== null && safePhotos[selectedPhotoIndex] && (
              <div className="aspect-video w-full rounded-md overflow-hidden border">
                <LazyImage
                  src={safePhotos[selectedPhotoIndex]}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  threshold={0.1}
                  rootMargin="50px"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="caption">Legenda</Label>
              <Textarea
                id="caption"
                placeholder="Digite uma legenda descritiva para esta foto..."
                value={currentCaption}
                onChange={(e) => setCurrentCaption(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCaptionModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveCaption}>
              Salvar Legenda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
