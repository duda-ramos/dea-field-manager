import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  GitBranch, 
  Save, 
  History, 
  Download,
  FileText,
  Calendar,
  User
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Project, Installation } from '@/types';
import { storage } from '@/lib/storage';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProjectVersion {
  id: string;
  version_number: number;
  snapshot: any;
  change_description: string;
  created_at: string;
  size_bytes: number;
}

interface ProjectVersioningProps {
  project: Project;
  installations: Installation[];
  onVersionRestored: () => void;
}

export function ProjectVersioning({ project, installations, onVersionRestored }: ProjectVersioningProps) {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ProjectVersion | null>(null);
  const [changeDescription, setChangeDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadVersions();
  }, [project.id]);

  const loadVersions = async () => {
    const { data, error } = await supabase
      .from('project_versions')
      .select('*')
      .eq('project_id', project.id)
      .order('version_number', { ascending: false });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar versões',
        variant: 'destructive'
      });
      return;
    }

    setVersions(data || []);
  };

  const createVersion = async () => {
    if (!user || !changeDescription.trim()) return;

    setLoading(true);
    try {
      const versionNumber = Math.max(...versions.map(v => v.version_number), 0) + 1;
      
      const snapshot = {
        project,
        installations,
        timestamp: new Date().toISOString()
      };

      const snapshotJson = JSON.stringify(snapshot);
      const sizeBytes = new Blob([snapshotJson]).size;

      const { error } = await supabase
        .from('project_versions')
        .insert({
          project_id: project.id,
          user_id: user.id,
          version_number: versionNumber,
          snapshot: snapshot as any,
          change_description: changeDescription,
          size_bytes: sizeBytes
        });

      if (error) throw error;

      toast({
        title: 'Versão criada',
        description: `Versão ${versionNumber} criada com sucesso`
      });

      setIsCreateModalOpen(false);
      setChangeDescription('');
      loadVersions();
    } catch (error) {
      console.error('[ProjectVersioning] Falha ao criar versão:', error, {
        projectId: project.id,
        projectName: project.name,
        versionNumber: Math.max(...versions.map(v => v.version_number), 0) + 1,
        sizeBytes: new Blob([JSON.stringify({ project, installations, timestamp: new Date().toISOString() })]).size
      });
      toast({
        title: 'Erro',
        description: 'Erro ao criar versão',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const restoreVersion = async (version: ProjectVersion) => {
    if (!user) return;

    try {
      const snapshot = version.snapshot;
      
      // Restore project data
      if (snapshot.project) {
        await storage.upsertProject(snapshot.project);
      }

      // Restore installations
      if (snapshot.installations) {
        for (const installation of snapshot.installations) {
          await storage.upsertInstallation(installation);
        }
      }

      toast({
        title: 'Versão restaurada',
        description: `Projeto restaurado para versão ${version.version_number}`
      });

      onVersionRestored();
    } catch (error) {
      console.error('[ProjectVersioning] Falha ao restaurar versão:', error, {
        versionId: version.id,
        versionNumber: version.version_number,
        projectId: project.id,
        projectName: project.name
      });
      toast({
        title: 'Erro',
        description: 'Erro ao restaurar versão',
        variant: 'destructive'
      });
    }
  };

  const downloadVersion = (version: ProjectVersion) => {
    const dataStr = JSON.stringify(version.snapshot, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `projeto_v${version.version_number}_${project.name}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Controle de Versões
            </CardTitle>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Save className="h-4 w-4 mr-2" />
              Criar Versão
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <div className="text-center py-6">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Nenhuma versão criada ainda</p>
              <Button variant="outline" onClick={() => setIsCreateModalOpen(true)}>
                Criar primeira versão
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {versions.map((version) => (
                  <div key={version.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">v{version.version_number}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatFileSize(version.size_bytes)}
                          </span>
                        </div>
                        
                        <p className="font-medium mb-1">{version.change_description}</p>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(version.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Você
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedVersion(version);
                            setIsViewModalOpen(true);
                          }}
                        >
                          <FileText className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadVersion(version)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => restoreVersion(version)}
                        >
                          Restaurar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Version Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Versão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descrição da Versão</Label>
              <Textarea
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
                placeholder="Descreva as mudanças desta versão..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={createVersion}
                disabled={loading || !changeDescription.trim()}
                className="flex-1"
              >
                {loading ? 'Criando...' : 'Criar Versão'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Version Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Versão {selectedVersion?.version_number} - Detalhes
            </DialogTitle>
          </DialogHeader>
          {selectedVersion && (
            <ScrollArea className="h-96">
              <div className="space-y-4">
                <div>
                  <Label>Descrição</Label>
                  <p className="text-sm bg-muted p-2 rounded">
                    {selectedVersion.change_description}
                  </p>
                </div>
                <div>
                  <Label>Snapshot</Label>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(selectedVersion.snapshot, null, 2)}
                  </pre>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}