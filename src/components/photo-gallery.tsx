import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, Plus, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { syncPhotoToProjectAlbum } from "@/utils/photoSync";
import { uploadToStorage } from "@/services/storage/filesStorage";
import { useToast } from "@/hooks/use-toast";
import { showToast } from "@/lib/toast";
import { logger } from '@/services/logger';

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
    let syncedCount = 0;
    let syncFailed = false;

    for (const file of fileArray) {
      try {
        const photoUrl = await readFileAsDataUrl(file);
        newPhotos.push(photoUrl);

        if (projectId && installationId && installationCode) {
          try {
            const renamedFile = new File(
              [file],
              buildStorageFileName(file, installationCode),
              { type: file.type }
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
              fileName: file.name,
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
        <div className="grid grid-cols-3 gap-2">
          {safePhotos.map((photo, index) => (
            <div key={index} className="relative group">
              <img
                src={photo}
                alt={`Foto ${index + 1}`}
                className="w-full h-20 object-cover rounded-md border cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setSelectedPhoto(photo)}
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removePhoto(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
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
      )}

      {/* Photo Viewer Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Visualizar Foto</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <img
              src={selectedPhoto}
              alt="Foto ampliada"
              className="w-full h-auto max-h-[70vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}