import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, Archive, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSignedUrl } from '@/services/storage/filesStorage';
import JSZip from 'jszip';
import type { ProjectFile } from '@/types';
import { logger } from '@/services/logger';

interface BulkDownloaderProps {
  images: ProjectFile[];
  projectName: string;
  className?: string;
}

export function BulkDownloader({ images, projectName, className }: BulkDownloaderProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const downloadAllImages = async () => {
    if (images.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Nenhuma imagem disponível para download.',
        variant: 'destructive'
      });
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const zip = new JSZip();
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      
      // Group images by context (extracted from filename)
      const imagesByContext: Record<string, ProjectFile[]> = {};
      
      images.forEach(image => {
        const parts = image.name.split('_');
        const context = parts.length >= 3 ? parts[0] : 'geral';
        
        if (!imagesByContext[context]) {
          imagesByContext[context] = [];
        }
        imagesByContext[context].push(image);
      });

      let processedCount = 0;
      const totalImages = images.length;

      // Process each context folder
      for (const [context, contextImages] of Object.entries(imagesByContext)) {
        const contextFolder = zip.folder(context);
        
        if (!contextFolder) continue;

        // Download and add each image to the ZIP
        for (const image of contextImages) {
          try {
            // Get image URL
            let imageUrl = image.url;
            if (image.storage_path) {
              const { url } = await getSignedUrl(image.storage_path);
              imageUrl = url;
            }

            // Fetch image data
            const response = await fetch(imageUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch ${image.name}`);
            }

            const imageBlob = await response.blob();
            contextFolder.file(image.name, imageBlob);

            processedCount++;
            setDownloadProgress((processedCount / totalImages) * 100);
          } catch (error) {
            console.error('[BulkDownloader] Falha ao baixar imagem individual para ZIP:', error, {
              imageName: image.name,
              imageId: image.id,
              storagePath: image.storagePath || image.storage_path
            });
            logger.error('Error downloading individual image for ZIP', {
              error,
              imageName: image.name,
              imageId: image.id,
              storagePath: image.storagePath,
              operacao: 'handleBulkDownload_individual'
            });
            // Continue with other images even if one fails
          }
        }
      }

      // Generate and download ZIP file
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Create download link
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${projectName}_${date}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      toast({
        title: 'Sucesso',
        description: `Download concluído! ${processedCount} imagens baixadas.`
      });

      setIsDialogOpen(false);
    } catch (error) {
      console.error('[BulkDownloader] Falha ao criar arquivo ZIP para download em lote:', error, {
        imageCount: images.length,
        projectName,
        processedCount: downloadProgress
      });
      logger.error('Error creating ZIP file for bulk download', {
        error,
        imageCount: images.length,
        projectName,
        operacao: 'handleBulkDownload'
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

  const getImagesByContext = () => {
    const contextGroups: Record<string, number> = {};
    
    images.forEach(image => {
      const parts = image.name.split('_');
      const context = parts.length >= 3 ? parts[0] : 'geral';
      contextGroups[context] = (contextGroups[context] || 0) + 1;
    });

    return contextGroups;
  };

  const contextGroups = getImagesByContext();

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            className={className}
            disabled={images.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Download em Lote
          </Button>
        </DialogTrigger>
        
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Download em Lote</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Archive className="h-5 w-5 text-primary" />
                <span className="font-medium">Resumo do Download</span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total de imagens:</span>
                  <span className="font-medium">{images.length}</span>
                </div>
                
                {Object.entries(contextGroups).map(([context, count]) => (
                  <div key={context} className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FolderOpen className="h-3 w-3" />
                      {context}:
                    </span>
                    <span>{count} imagens</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Download Progress */}
            {isDownloading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processando...</span>
                  <span>{Math.round(downloadProgress)}%</span>
                </div>
                <Progress value={downloadProgress} className="h-2" />
              </div>
            )}

            {/* Download Button */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsDialogOpen(false)}
                disabled={isDownloading}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={downloadAllImages}
                disabled={isDownloading || images.length === 0}
              >
                {isDownloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Baixando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar ZIP
                  </>
                )}
              </Button>
            </div>

            {/* Info */}
            <p className="text-xs text-muted-foreground text-center">
              As imagens serão organizadas em pastas por contexto dentro do arquivo ZIP.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}