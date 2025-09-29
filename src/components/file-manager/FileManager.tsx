import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Upload, Download, Search, Filter, Eye, Trash2, 
  FileText, Image, Folder, MoreHorizontal, Plus 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ProjectFile {
  id: string;
  project_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  category: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface FileManagerProps {
  projectId: string;
}

export function FileManager({ projectId }: FileManagerProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadCategory, setUploadCategory] = useState("general");
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadFiles();
  }, [projectId]);

  const loadFiles = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar arquivos",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    setUploadProgress(0);

    try {
      // Upload file to Supabase Storage
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${user.id}/${projectId}/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save file metadata to database
      const { error: dbError } = await supabase
        .from('project_files')
        .insert({
          project_id: projectId,
          user_id: user.id,
          file_name: file.name,
          file_path: uploadData.path,
          file_size: file.size,
          file_type: file.type,
          category: uploadCategory,
          description: uploadDescription
        });

      if (dbError) throw dbError;

      toast({
        title: "Arquivo enviado",
        description: `${file.name} foi enviado com sucesso`
      });

      setIsUploadModalOpen(false);
      setUploadDescription("");
      setUploadCategory("general");
      loadFiles();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Erro no upload",
        description: "Erro ao enviar arquivo",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleDownload = async (file: ProjectFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-files')
        .download(file.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download iniciado",
        description: `Download de ${file.file_name} iniciado`
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Erro no download",
        description: "Erro ao baixar arquivo",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (file: ProjectFile) => {
    if (!confirm(`Tem certeza que deseja excluir ${file.file_name}?`)) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-files')
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('project_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      toast({
        title: "Arquivo excluído",
        description: `${file.file_name} foi excluído com sucesso`
      });

      loadFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Erro ao excluir",
        description: "Erro ao excluir arquivo",
        variant: "destructive"
      });
    }
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (file.description && file.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === "all" || file.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      general: 'Geral',
      photos: 'Fotos',
      documents: 'Documentos',
      drawings: 'Desenhos'
    };
    return labels[category as keyof typeof labels] || category;
  };

  const getCategoryBadgeVariant = (category: string) => {
    const variants = {
      general: 'default',
      photos: 'secondary',
      documents: 'outline',
      drawings: 'destructive'
    };
    return variants[category as keyof typeof variants] || 'default';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold truncate">Arquivos do Projeto</h2>
          <p className="text-muted-foreground text-sm">
            {files.length} arquivo{files.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-md mx-auto max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-lg">Upload de Arquivo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
              <div>
                <Label htmlFor="file" className="text-sm font-medium">Arquivo</Label>
                <Input 
                  id="file" 
                  type="file" 
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="category" className="text-sm font-medium">Categoria</Label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Geral</SelectItem>
                    <SelectItem value="photos">Fotos</SelectItem>
                    <SelectItem value="documents">Documentos</SelectItem>
                    <SelectItem value="drawings">Desenhos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="description" className="text-sm font-medium">Descrição (opcional)</Label>
                <Textarea 
                  id="description" 
                  placeholder="Descreva o arquivo..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="mt-1 min-h-[80px] resize-none"
                />
              </div>
              
              {loading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Enviando...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar arquivos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-52 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Categorias</SelectItem>
            <SelectItem value="general">Geral</SelectItem>
            <SelectItem value="photos">Fotos</SelectItem>
            <SelectItem value="documents">Documentos</SelectItem>
            <SelectItem value="drawings">Desenhos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Files List */}
      <div className="space-y-3">
        {filteredFiles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Folder className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm || categoryFilter !== "all" ? "Nenhum arquivo encontrado" : "Nenhum arquivo enviado"}
              </h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchTerm || categoryFilter !== "all" 
                  ? "Tente ajustar os filtros de busca" 
                  : "Faça upload do primeiro arquivo para começar"
                }
              </p>
              {!searchTerm && categoryFilter === "all" && (
                <Button onClick={() => setIsUploadModalOpen(true)} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Primeiro Arquivo
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredFiles.map((file) => (
            <Card key={file.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="shrink-0 mt-1">
                      {getFileIcon(file.file_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm sm:text-base break-words">{file.file_name}</h4>
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
                        <Badge variant={getCategoryBadgeVariant(file.category) as any} className="text-xs">
                          {getCategoryLabel(file.category)}
                        </Badge>
                        <span className="hidden sm:inline">•</span>
                        <span className="whitespace-nowrap">{formatFileSize(file.file_size)}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="whitespace-nowrap">{new Date(file.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {file.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2 break-words">
                          {file.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0 self-start">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(file)}
                      className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline sm:ml-2">Download</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(file)}
                      className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3 text-destructive hover:text-destructive"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline sm:ml-2">Excluir</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}