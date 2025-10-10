import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Camera, Upload, Image as ImageIcon, Download, Search, Filter, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { uploadToStorage } from '@/services/storage/filesStorage';
import { StorageManagerDexie as Storage } from '@/services/StorageManager';
import { ImageEditor } from './ImageEditor';
import { BulkDownloader } from './BulkDownloader';
import type { ProjectFile } from '@/types';
import { syncPhotoToProjectAlbum } from '@/utils/photoSync';
import { storage } from '@/lib/storage';

interface EnhancedImageUploadProps {
  projectId: string;
  installationId?: string;
  context?: string; // For naming convention
  onImagesChange?: (images: ProjectFile[]) => void;
  className?: string;
}

export function EnhancedImageUpload({ 
  projectId, 
  installationId, 
  context = 'arquivo',
  onImagesChange,
  className 
}: EnhancedImageUploadProps) {
  const [images, setImages] = useState<ProjectFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [filterBy, setFilterBy] = useState<'all' | 'general' | 'installation'>('all');
  const [editingImage, setEditingImage] = useState<ProjectFile | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [installations, setInstallations] = useState<Map<string, { codigo: number; descricao: string }>>(new Map());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load all images from project (including from installations)
  useEffect(() => {
    loadAllImages();
    loadInstallations();
  }, [projectId]);

  const loadAllImages = async () => {
    try {
      const allImages = await Storage.getFilesByProject(projectId);
      const imageFiles = allImages.filter(f => f.type?.startsWith('image/'));
      setImages(imageFiles);
      onImagesChange?.(imageFiles);
    } catch (error) {
      console.error('Error loading images:', error);
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
      console.error('Error loading installations:', error);
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

  // Upload single image
  const uploadImage = async (file: File): Promise<ProjectFile> => {
    const id = crypto.randomUUID();
    const sequential = await getNextSequential();
    const newFileName = generateFileName(file.name, sequential);
    
    setUploadProgress(prev => ({ ...prev, [id]: 0 }));

    try {
      // Create new file with renamed filename
      const renamedFile = new File([file], newFileName, { type: file.type });
      
      const res = await uploadToStorage(renamedFile, { projectId, installationId, id });
      
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
              res.storagePath
            );
          }
        } catch (syncError) {
          // Erro de sync não deve bloquear o upload principal
          console.error('Erro ao sincronizar foto com álbum:', syncError);
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
      setUploadProgress(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      throw error;
    }
  };

  // Handle file uploads
  const handleFiles = async (files: FileList) => {
    const imageFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    );

    if (imageFiles.length === 0) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione apenas arquivos de imagem.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const uploadPromises = imageFiles.map(uploadImage);
      const uploadedImages = await Promise.all(uploadPromises);
      
      const newImages = [...images, ...uploadedImages];
      setImages(newImages);
      onImagesChange?.(newImages);
      
      toast({
        title: 'Sucesso',
        description: installationId 
          ? `${uploadedImages.length} foto(s) salva(s) no item e sincronizada(s) com a galeria.`
          : `${uploadedImages.length} imagem(ns) enviada(s) com sucesso.`
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao enviar imagens. Tente novamente.',
        variant: 'destructive'
      });
    }
  };

  // Handle file input change
  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      handleFiles(files);
    }
  };

  // Handle camera capture
  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  // Handle gallery upload
  const handleGalleryUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

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

  // Count images by type
  const generalCount = images.filter(img => !img.installationId).length;
  const installationCount = images.filter(img => img.installationId).length;

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
    
    try {
      const newImage = await uploadImage(editedFile);
      const newImages = [...images, newImage];
      setImages(newImages);
      onImagesChange?.(newImages);
      
      setIsEditorOpen(false);
      setEditingImage(null);
      
      toast({
        title: 'Sucesso',
        description: 'Imagem editada salva com sucesso.'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar imagem editada.',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className={cn('space-y-6 max-w-full overflow-x-hidden', className)}>
      {/* Upload Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={handleCameraCapture}
              className="flex-1 h-12"
              variant="default"
            >
              <Camera className="h-5 w-5 mr-2" />
              Capturar Foto
            </Button>
            <Button 
              onClick={handleGalleryUpload}
              variant="outline"
              className="flex-1 h-12"
            >
              <Upload className="h-5 w-5 mr-2" />
              Galeria/Arquivo
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
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
        </CardContent>
      </Card>

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

      {/* Image Counter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Total: {images.length} {images.length === 1 ? 'imagem' : 'imagens'}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                ({generalCount} {generalCount === 1 ? 'geral' : 'gerais'} + {installationCount} de peças)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filteredAndSortedImages.map((image) => {
            const installation = image.installationId ? installations.get(image.installationId) : null;
            
            return (
              <Card key={image.id} className="group overflow-hidden">
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
            );
          })}
        </div>
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