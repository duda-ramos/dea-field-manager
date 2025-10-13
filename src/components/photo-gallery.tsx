import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Camera, X, Plus, Image as ImageIcon, Zap, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { syncPhotoToProjectAlbum } from "@/utils/photoSync";
import { uploadToStorage } from "@/services/storage/filesStorage";
import { useToast } from "@/hooks/use-toast";
import { showToast } from "@/lib/toast";
import { logger } from '@/services/logger';
import { LazyImage } from "@/components/ui/LazyImage";
import { compressImageWithMetrics, formatFileSize, isLargeFile } from "@/utils/imageCompression";
import type { CompressionMetrics } from "@/utils/imageCompression";

interface PhotoGalleryProps {
  photos?: string[]; // Made optional to handle undefined
  onPhotosChange: (photos: string[]) => void;
  className?: string;
  projectId?: string; // Adiciona projectId opcional
  installationId?: string; // Adiciona installationId opcional
  installationCode?: string; // Adiciona código da instalação opcional
}

export function PhotoGallery({ 
  photos = [], 
  onPhotosChange, 
  className,
  projectId,
  installationId,
  installationCode
}: PhotoGalleryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [photoMetrics, setPhotoMetrics] = useState<Map<string, CompressionMetrics>>(new Map());
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const newPhotos: string[] = [];
    const newMetrics = new Map(photoMetrics);
    let syncedCount = 0;
    let syncFailed = false;
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    for (const file of fileArray) {
      try {
        // Compress image with metrics
        const { file: processedFile, metrics } = await compressImageWithMetrics(file);
        
        // Track compression metrics
        totalOriginalSize += metrics.originalSizeMB;
        totalCompressedSize += metrics.compressedSizeMB;
        
        const photoUrl = await readFileAsDataUrl(processedFile);
        newPhotos.push(photoUrl);
        
        // Store metrics for this photo
        newMetrics.set(photoUrl, metrics);

        if (projectId && installationId && installationCode) {
          try {
            const renamedFile = new File(
              [processedFile],
              buildStorageFileName(processedFile, installationCode),
              { type: processedFile.type }
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
              storagePath
            );

            syncedCount += 1;
          } catch (error) {
            logger.error("Erro ao sincronizar foto com álbum do projeto", {
              error,
              projectId,
              installationId,
              installationCode,
              fileName: processedFile.name,
              operacao: 'syncPhotoToProjectAlbum'
            });
            syncFailed = true;
          }
        }
      } catch (error) {
        logger.error("Erro ao processar arquivo de foto", {
          error,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          operacao: 'handleFileUpload'
        });
        toast({
          title: "Erro ao carregar foto",
          description: "Não foi possível processar uma das fotos selecionadas.",
          variant: "destructive"
        });
        showToast.error("Erro ao carregar foto", "Não foi possível processar uma das fotos selecionadas.");
      }
    }

    if (newPhotos.length > 0) {
      onPhotosChange([...safePhotos, ...newPhotos]);
      setPhotoMetrics(newMetrics);
      
      // Show compression summary if any images were compressed
      const compressedCount = Array.from(newMetrics.values()).filter(m => m.wasCompressed).length;
      if (compressedCount > 0) {
        const savings = totalOriginalSize - totalCompressedSize;
        const savingsPercent = (savings / totalOriginalSize) * 100;
        
        toast({
          title: "🖼️ Imagens Otimizadas",
          description: `${compressedCount} imagem(ns) comprimida(s). Economia: ${savings.toFixed(2)}MB (${savingsPercent.toFixed(1)}%)`,
        });
      }
    }

    if (syncedCount > 0) {
      toast({
        title: "Foto sincronizada",
        description: `Foto da peça ${installationCode} adicionada ao álbum de mídias do projeto.`
      });
    }

    if (syncFailed) {
      toast({
        title: "Aviso",
        description: "Foto adicionada à peça, mas não foi possível sincronizar com o álbum.",
        variant: "destructive"
      });
    }

    event.target.value = "";
  };

  const removePhoto = (index: number) => {
    const newPhotos = safePhotos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Fotos ({safePhotos.length})</h4>
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onClick={(e) => e.stopPropagation()}
          />
          <Button variant="outline" size="sm" className="pointer-events-none">
            <Camera className="h-4 w-4 mr-2" />
            Adicionar Fotos
          </Button>
        </div>
      </div>

      {safePhotos.length === 0 ? (
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma foto adicionada</p>
        </div>
      ) : (
        <TooltipProvider>
          <div className="grid grid-cols-3 gap-2">
            {safePhotos.map((photo, index) => {
              const metrics = photoMetrics.get(photo);
              const isLarge = metrics && isLargeFile(metrics.originalSizeMB * 1024 * 1024);
              
              return (
                <div key={index} className="relative group">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <LazyImage
                          src={photo}
                          alt={`Foto ${index + 1}`}
                          className={cn(
                            "w-full h-20 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity border-2",
                            isLarge ? "border-orange-400" : "border-border"
                          )}
                          onClick={() => setSelectedPhoto(photo)}
                          threshold={0.1}
                          rootMargin="50px"
                        />
                        {metrics?.wasCompressed && (
                          <Badge 
                            variant="success" 
                            className="absolute bottom-1 left-1 text-[10px] px-1 py-0 h-4"
                          >
                            <Zap className="h-2.5 w-2.5 mr-0.5" />
                            Otimizada
                          </Badge>
                        )}
                        {isLarge && (
                          <AlertTriangle className="absolute top-1 left-1 h-4 w-4 text-orange-500" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs space-y-1">
                        {metrics ? (
                          <>
                            <p><strong>Arquivo:</strong> {metrics.fileName}</p>
                            <p><strong>Tamanho original:</strong> {metrics.originalSizeMB.toFixed(2)}MB</p>
                            {metrics.wasCompressed && (
                              <>
                                <p><strong>Tamanho final:</strong> {metrics.compressedSizeMB.toFixed(2)}MB</p>
                                <p><strong>Economia:</strong> {metrics.reductionPercent.toFixed(1)}%</p>
                              </>
                            )}
                            {metrics.originalDimensions && (
                              <p><strong>Dimensões:</strong> {metrics.originalDimensions.width}x{metrics.originalDimensions.height}px</p>
                            )}
                          </>
                        ) : (
                          <p>Foto {index + 1}</p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={() => removePhoto(index)}
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
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onClick={(e) => e.stopPropagation()}
              />
              <Button variant="ghost" size="sm" className="h-full w-full pointer-events-none">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TooltipProvider>
      )}

      {/* Photo Viewer Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Visualizar Foto</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <LazyImage
              src={selectedPhoto}
              alt="Foto ampliada"
              className="w-full h-auto max-h-[70vh] object-contain rounded-md"
              threshold={0.1}
              rootMargin="50px"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}