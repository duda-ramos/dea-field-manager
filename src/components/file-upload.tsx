import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, File, Download, Trash2, Eye, CloudUpload, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { StorageManagerDexie as Storage } from '@/services/StorageManager';
import { uploadToStorage, getSignedUrl, deleteFromStorage } from '@/services/storage/filesStorage';
import type { ProjectFile } from '@/types';

interface UploadedFile extends ProjectFile {
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
    } as any);

    setUploadProgress(prev => ({ ...prev, [id]: 100 }));
    setUploadProgress(prev => {
      const { [id]: _, ...rest } = prev;
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
      } catch {
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
      if (!response.ok) throw new Error('blob');
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
        } as any);

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
      } catch (err: any) {
        if (err.code === 'OFFLINE') {
          await Storage.upsertFile({
            ...file,
            uploadedAt: file.uploadedAt instanceof Date ? file.uploadedAt.toISOString() : file.uploadedAt,
            updatedAt: Date.now(),
            needsUpload: 1
          } as any);
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
          <File className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
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
        <File className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
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
        uploadedAt: new Date(file.uploadedAt ?? Date.now())
      })) as UploadedFile[];
      
      setFiles(filesWithDates);
      onFilesChange?.(filesWithDates);
    };
    load();
  }, [projectId, installationId, onFilesChange]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Network Status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-500">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-orange-500">Offline - arquivos serão sincronizados quando conectar</span>
            </>
          )}
        </div>
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              isDragOver 
                ? "border-primary bg-primary/5" 
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {isOnline ? (
              <CloudUpload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            ) : (
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            )}
            <h3 className="text-lg font-semibold mb-2">
              {isOnline ? "Enviar arquivos para nuvem" : "Adicionar arquivos localmente"}
            </h3>
            <p className="text-muted-foreground mb-4">
              Arraste e solte os arquivos aqui ou clique para selecionar
            </p>
            <Button 
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
            >
              Selecionar Arquivos
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Tipos aceitos: {acceptedTypes.join(', ')} | Tamanho máximo: {maxFileSize}MB
              {!isOnline && <br />}
              {!isOnline && "⚠️ Arquivos serão enviados à nuvem quando voltar online"}
            </p>
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
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-3">Arquivos enviados ({files.length})</h4>
            <div className="space-y-2">
              {files.map((file) => (
                <div 
                  key={file.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <File className="h-5 w-5 text-muted-foreground" />
                      {file.storagePath ? (
                        <CloudUpload className="h-3 w-3 text-green-500" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-orange-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>{file.uploadedAt.toLocaleDateString('pt-BR')}</span>
                        {!file.storagePath && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-blue-500 border-blue-500">Migrar</Badge>
                          </>
                        )}
                        {file.needsUpload === 1 && (
                          <>
                            <span>•</span>
                            <span className="text-orange-500">Pendente</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {file.name.split('.').pop()?.toUpperCase()}
                    </Badge>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {currentPreviewFile?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {renderFilePreview()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}