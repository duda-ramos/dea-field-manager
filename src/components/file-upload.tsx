import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, File, X, Download, Trash2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: Date;
}

interface FileUploadProps {
  projectId: string;
  onFilesChange?: (files: UploadedFile[]) => void;
  acceptedTypes?: string[];
  maxFileSize?: number; // in MB
  className?: string;
}

export function FileUpload({ 
  projectId, 
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
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate upload progress
    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));
    
    // Create blob URL for local storage
    const url = URL.createObjectURL(file);
    
    // Simulate upload progress
    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise(resolve => setTimeout(resolve, 50));
      setUploadProgress(prev => ({ ...prev, [fileId]: progress }));
    }

    const uploadedFile: UploadedFile = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      url,
      uploadedAt: new Date()
    };

    // Store in localStorage
    const storageKey = `project_files_${projectId}`;
    const existingFiles = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const updatedFiles = [...existingFiles, uploadedFile];
    localStorage.setItem(storageKey, JSON.stringify(updatedFiles));

    setUploadProgress(prev => {
      const { [fileId]: _, ...rest } = prev;
      return rest;
    });

    return uploadedFile;
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const filesToUpload = Array.from(fileList);
    
    for (const file of filesToUpload) {
      const validationError = validateFile(file);
      if (validationError) {
        toast({
          title: "Erro no upload",
          description: `${file.name}: ${validationError}`,
          variant: "destructive"
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
          title: "Arquivo enviado",
          description: `${file.name} foi enviado com sucesso.`
        });
      } catch (error) {
        toast({
          title: "Erro no upload",
          description: `Falha ao enviar ${file.name}`,
          variant: "destructive"
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

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      onFilesChange?.(updated);
      
      // Remove from localStorage
      const storageKey = `project_files_${projectId}`;
      localStorage.setItem(storageKey, JSON.stringify(updated));
      
      return updated;
    });
    
    toast({
      title: "Arquivo removido",
      description: "O arquivo foi removido com sucesso."
    });
  };

  const downloadFile = (file: UploadedFile) => {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openPreview = (file: UploadedFile) => {
    setCurrentPreviewFile(file);
    setIsPreviewOpen(true);
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

    const extension = getFileExtension(currentPreviewFile.name);

    if (extension === 'pdf') {
      return (
        <iframe
          src={currentPreviewFile.url}
          className="w-full h-[600px] border rounded"
          title={currentPreviewFile.name}
        />
      );
    }

    if (['png', 'jpg', 'jpeg'].includes(extension)) {
      return (
        <img
          src={currentPreviewFile.url}
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

  // Load files from localStorage on component mount
  useState(() => {
    const storageKey = `project_files_${projectId}`;
    const storedFiles = JSON.parse(localStorage.getItem(storageKey) || '[]');
    // Ensure uploadedAt is converted back to Date object
    const filesWithDates = storedFiles.map((file: any) => ({
      ...file,
      uploadedAt: new Date(file.uploadedAt)
    }));
    setFiles(filesWithDates);
    onFilesChange?.(filesWithDates);
  });

  return (
    <div className={cn("space-y-4", className)}>
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
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Enviar arquivos de orçamento
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
                    <File className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>{file.uploadedAt.toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {file.name.split('.').pop()?.toUpperCase()}
                    </Badge>
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
                      onClick={() => removeFile(file.id)}
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