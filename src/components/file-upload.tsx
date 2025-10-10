import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, File as FileIcon, Download, Trash2, Eye, CloudUpload, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { StorageManagerDexie as Storage } from '@/services/StorageManager';
import { uploadToStorage, getSignedUrl, deleteFromStorage } from '@/services/storage/filesStorage';
import type { ProjectFile } from '@/types';

interface UploadedFile extends Omit<ProjectFile, 'uploadedAt'> {
  uploadedAt: Date;
}

interface FileUploadProps {
  projectId: string;
  installationId?: string;
  onFilesChange?: (files: UploadedFile[]) => void;
  acceptedTypes?: string[];
  maxFileSize?: number; // in MB
  className?: string;
}

export function FileUpload({ 
  projectId,
  installationId,
  onFilesChange, 
  acceptedTypes = ['.pdf', '.xlsx', '.xls', '.doc', '.docx', '.png', '.jpg', '.jpeg'],
  maxFileSize = 10,
  className 
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [currentPreviewFile, setCurrentPreviewFile] = useState<UploadedFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      return `Arquivo muito grande. Tamanho máximo: ${maxFileSize}MB`;
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(fileExtension)) {
      return `Tipo de arquivo não suportado. Tipos aceitos: ${acceptedTypes.join(', ')}`;
    }

    return null;
  };

  const uploadFile = async (file: File): Promise<UploadedFile> => {
    const id = crypto.randomUUID();
    setUploadProgress(prev => ({ ...prev, [id]: 0 }));

    let storagePath: string | undefined;
    let uploadedAtISO = new Date().toISOString();
    let needsUpload = 0;

    try {
      const res = await uploadToStorage(file, { projectId, installationId, id });
      storagePath = res.storagePath;
      uploadedAtISO = res.uploadedAtISO;
    } catch (err) {
      console.error('File upload to storage failed:', err);
      needsUpload = 1;
    }

    await Storage.upsertFile({
      id,
      projectId,
      installationId,
      name: file.name,
      size: file.size,
      type: file.type,
      storagePath,
      uploadedAt: uploadedAtISO,
      updatedAt: Date.now(),
      needsUpload
    } as ProjectFile);

    setUploadProgress(prev => ({ ...prev, [id]: 100 }));
    setUploadProgress(prev => {
      const { [id]: removed, ...rest } = prev;
      return rest;
    });

    return {
      id,
      projectId,
      installationId,
      name: file.name,
      size: file.size,
      type: file.type,
      storagePath,
      uploadedAt: new Date(uploadedAtISO),
      needsUpload
    } as UploadedFile;
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const filesToUpload = Array.from(fileList);

    for (const file of filesToUpload) {
      const validationError = validateFile(file);
      if (validationError) {
        toast({
          title: 'Erro no upload',
          description: `${file.name}: ${validationError}`,
          variant: 'destructive'
        });
        continue;
      }

      try {
        const uploadedFile = await uploadFile(file);
        setFiles(prev => {
          const updated = [...prev, uploadedFile];
          onFilesChange?.(updated);
          return updated;
        });

        toast({
          title: uploadedFile.needsUpload ? 'Arquivo adicionado' : 'Arquivo enviado',
          description: uploadedFile.needsUpload
            ? `${file.name} será enviado quando online.`
            : `${file.name} foi enviado com sucesso.`
        });
      } catch (error) {
        console.error('File upload failed:', error, { fileName: file.name });
        toast({
          title: 'Erro no upload',
          description: `Falha ao enviar ${file.name}`,
          variant: 'destructive'
        });
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = e.dataTransfer.files;
    handleFiles(droppedFiles);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = async (file: UploadedFile) => {
    try {
      setFiles(prev => {
        const updated = prev.filter(f => f.id !== file.id);
        onFilesChange?.(updated);
        return updated;
      });

      if (navigator.onLine && file.storagePath) {
        await deleteFromStorage(file.storagePath);
      }

      await Storage.deleteFile(file.id);

      toast({
        title: 'Arquivo removido',
        description: navigator.onLine
          ? 'O arquivo foi removido com sucesso.'
          : 'Arquivo marcado para remoção. Será removido quando online.'
      });
    } catch (error) {
      console.error('File removal failed:', error, { fileId: file.id });
      toast({
        title: 'Erro ao remover arquivo',
        description: 'Houve um problema ao remover o arquivo. Tente novamente.',
        variant: 'destructive'
      });
    }
  };

  const migrateFile = async (file: UploadedFile) => {
    try {
      if (!file.url) {
        toast({
          title: 'Arquivo indisponível',
          description: 'Não foi possível localizar o arquivo original. Reenvie manualmente.',
          variant: 'destructive'
        });
        return;
      }

      const response = await fetch(file.url);
      if (!response.ok) throw new Error('Failed to fetch file');
      const blob = await response.blob();
      const fileObj = new File([blob], file.name, { type: file.type });

      try {
        const { storagePath, uploadedAtISO } = await uploadToStorage(fileObj, { projectId, installationId, id: file.id });

          await Storage.upsertFile({
            ...file,
            storagePath,
            uploadedAt: uploadedAtISO,
            updatedAt: Date.now(),
            needsUpload: 0,
            url: undefined
          } as ProjectFile);

        setFiles(prev =>
          prev.map(f =>
            f.id === file.id
              ? { ...f, storagePath, uploadedAt: new Date(uploadedAtISO), needsUpload: 0, url: undefined }
              : f
          )
        );

        if (file.url && file.url.startsWith('blob:')) {
          URL.revokeObjectURL(file.url);
        }

        toast({
          title: 'Arquivo migrado',
          description: `${file.name} enviado para a nuvem.`
        });
      } catch (err) {
        const errorCode = (err as { code?: string }).code;
        if (errorCode === 'OFFLINE') {
          await Storage.upsertFile({
            ...file,
            uploadedAt: file.uploadedAt instanceof Date ? file.uploadedAt.toISOString() : file.uploadedAt,
            updatedAt: Date.now(),
            needsUpload: 1
          } as ProjectFile);
          setFiles(prev =>
            prev.map(f =>
              f.id === file.id ? { ...f, needsUpload: 1 } : f
            )
          );
          toast({
            title: 'Arquivo pendente',
            description: `${file.name} será enviado quando online.`
          });
        } else {
          throw err;
        }
      }
    } catch (error) {
      console.error('File migration failed:', error, { fileId: file.id });
      toast({
        title: 'Falha na migração',
        description: 'Não foi possível migrar o arquivo. Reenvie manualmente.',
        variant: 'destructive'
      });
    }
  };

  const downloadFile = async (file: UploadedFile) => {
    try {
      let url: string | undefined;
      if (file.storagePath) {
        ({ url } = await getSignedUrl(file.storagePath));
      } else if (file.url) {
        url = file.url;
      }
      if (!url) throw new Error('Arquivo não disponível');

      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('File download failed:', error, { fileId: file.id });
      toast({
        title: 'Erro no download',
        description: 'Não foi possível baixar o arquivo. Verifique sua conexão.',
        variant: 'destructive'
      });
    }
  };

  const openPreview = async (file: UploadedFile) => {
    setCurrentPreviewFile(file);
    setIsPreviewOpen(true);
    setIsLoadingPreview(true);

    try {
      if (file.storagePath) {
        const { url } = await getSignedUrl(file.storagePath);
        setPreviewUrl(url);
      } else if (file.url) {
        setPreviewUrl(file.url);
      } else {
        throw new Error('Arquivo não disponível');
      }
    } catch (error) {
      console.error('File preview failed:', error, { fileId: file.id });
      toast({
        title: 'Erro na prévia',
        description: 'Não foi possível carregar a prévia. Verifique sua conexão.',
        variant: 'destructive'
      });
      setPreviewUrl('');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const isPreviewable = (file: UploadedFile) => {
    const extension = getFileExtension(file.name);
    return ['pdf', 'png', 'jpg', 'jpeg'].includes(extension);
  };

  const renderFilePreview = () => {
    if (!currentPreviewFile) return null;

    if (isLoadingPreview) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando prévia...</p>
        </div>
      );
    }

    if (!previewUrl) {
      return (
        <div className="text-center py-12">
          <FileIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Preview não disponível</h3>
          <p className="text-muted-foreground">
            {!isOnline ? "Conecte-se à internet para ver a prévia." : "Erro ao carregar prévia."}
          </p>
          <Button 
            className="mt-4" 
            onClick={() => downloadFile(currentPreviewFile)}
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar arquivo
          </Button>
        </div>
      );
    }

    const extension = getFileExtension(currentPreviewFile.name);

    if (extension === 'pdf') {
      return (
        <iframe
          src={previewUrl}
          className="w-full h-[600px] border rounded"
          title={currentPreviewFile.name}
        />
      );
    }

    if (['png', 'jpg', 'jpeg'].includes(extension)) {
      return (
        <img
          src={previewUrl}
          alt={currentPreviewFile.name}
          className="max-w-full max-h-[600px] object-contain mx-auto"
        />
      );
    }

    return (
      <div className="text-center py-12">
        <FileIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Preview não disponível</h3>
        <p className="text-muted-foreground">
          Este tipo de arquivo não pode ser visualizado no navegador.
        </p>
        <Button 
          className="mt-4" 
          onClick={() => downloadFile(currentPreviewFile)}
        >
          <Download className="h-4 w-4 mr-2" />
          Baixar arquivo
        </Button>
      </div>
    );
  };

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load files from IndexedDB on component mount
  useEffect(() => {
    const load = async () => {
      let storedFiles: ProjectFile[];
      
      if (installationId) {
        storedFiles = await Storage.getFilesByInstallation(installationId);
      } else {
        storedFiles = await Storage.getFilesByProject(projectId);
      }
      
      const filesWithDates = storedFiles.map((file: ProjectFile) => ({
        ...file,
        uploadedAt: new Date(file.uploadedAt ?? file.uploaded_at ?? Date.now())
      })) as UploadedFile[];
      
      setFiles(filesWithDates);
      onFilesChange?.(filesWithDates);
    };
    load();
  }, [projectId, installationId, onFilesChange]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Network Status */}
      <div className="flex items-center justify-between mb-4 p-2 rounded-lg bg-muted/30">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-sm text-green-500">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-orange-500 shrink-0" />
              <span className="text-xs sm:text-sm text-orange-500 line-clamp-2">
                Offline - arquivos serão sincronizados quando conectar
              </span>
            </>
          )}
        </div>
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="p-3 sm:p-6">
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-4 sm:p-8 text-center transition-colors",
              isDragOver 
                ? "border-primary bg-primary/5" 
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {isOnline ? (
              <CloudUpload className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
            ) : (
              <Upload className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
            )}
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              {isOnline ? "Enviar arquivos para nuvem" : "Adicionar arquivos localmente"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 px-2">
              Arraste e solte os arquivos aqui ou clique para selecionar
            </p>
            <Button 
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="mb-3"
            >
              Selecionar Arquivos
            </Button>
            <div className="text-xs text-muted-foreground px-2">
              <div className="mb-1">
                <span className="font-medium">Tipos:</span> {acceptedTypes.join(', ')}
              </div>
              <div className="mb-1">
                <span className="font-medium">Tamanho máximo:</span> {maxFileSize}MB
              </div>
              {!isOnline && (
                <div className="text-orange-500 mt-2">
                  ⚠️ Arquivos serão enviados à nuvem quando voltar online
                </div>
              )}
            </div>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedTypes.join(',')}
            onChange={handleFileInput}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-3">Enviando arquivos...</h4>
            <div className="space-y-2">
              {Object.entries(uploadProgress).map(([fileId, progress]) => (
                <div key={fileId} className="space-y-1">
                  <div className="flex justify-between text-xs">
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

      {/* Files List */}
      {files.length > 0 && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <h4 className="text-sm font-medium mb-3">Arquivos enviados ({files.length})</h4>
            <div className="space-y-2">
              {files.map((file) => (
                <div 
                  key={file.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2 shrink-0">
                      <FileIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                      {file.storagePath ? (
                        <CloudUpload className="h-3 w-3 text-green-500" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-orange-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium break-words line-clamp-1">{file.name}</p>
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs text-muted-foreground mt-1">
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {file.name.split('.').pop()?.toUpperCase()}
                        </Badge>
                        <span className="shrink-0">{formatFileSize(file.size)}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="shrink-0">{file.uploadedAt.toLocaleDateString('pt-BR')}</span>
                        {!file.storagePath && (
                          <Badge variant="outline" className="text-blue-500 border-blue-500 text-xs shrink-0">
                            Migrar
                          </Badge>
                        )}
                        {file.needsUpload === 1 && (
                          <span className="text-orange-500 shrink-0">Pendente</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 self-start sm:self-center">
                    {!file.storagePath && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => migrateFile(file)}
                        className="h-8 w-8 p-0"
                        title="Enviar para nuvem"
                      >
                        <CloudUpload className="h-4 w-4" />
                      </Button>
                    )}
                    {isPreviewable(file) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPreview(file)}
                        className="h-8 w-8 p-0"
                        title="Prévia do arquivo"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadFile(file)}
                      className="h-8 w-8 p-0"
                      title="Baixar arquivo"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title="Remover arquivo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg pr-6">
              <Eye className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span className="truncate">{currentPreviewFile?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[calc(90vh-120px)]">
            {renderFilePreview()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}