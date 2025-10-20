import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MapPin, ArrowRight, Building, Code, RefreshCw, Clock } from "lucide-react";
import { Project } from "@/types";
import { storage } from "@/lib/storage";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ProjectLifecycleActions } from "./project/ProjectLifecycleActions";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProjectCardProps {
  project: Project;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  onUpdate?: () => void;
}

export function ProjectCard({ project, isSelected = false, onSelectionChange, onUpdate }: ProjectCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [installations, setInstallations] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const isDeleted = !!project.deleted_at;
  const isArchived = !!project.archived_at;
  const isActive = !isDeleted && !isArchived;

  useEffect(() => {
    const loadInstallations = async () => {
      const projectInstallations = await storage.getInstallationsByProject(project.id);
      setInstallations(projectInstallations);
    };
    loadInstallations();
  }, [project.id]);

  const completedInstallations = installations.filter(i => i.installed).length;
  const totalInstallations = installations.length;
  const progressPercentage = totalInstallations > 0 ? (completedInstallations / totalInstallations) * 100 : 0;

  // Verificar se o projeto já foi sincronizado
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isLocalProject = !uuidRegex.test(project.id);

  const statusConfig = {
    planning: { label: "Planejamento", variant: "secondary" as const },
    "in-progress": { label: "Em Andamento", variant: "default" as const },
    completed: { label: "Concluído", variant: "success" as const }
  };

  const handleViewProject = () => {
    if (!isDeleted && !isArchived) {
      navigate(`/projeto/${project.id}`);
    }
  };

  const handleSyncProject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSyncing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Autenticação necessária",
          description: "Faça login para sincronizar este projeto",
          variant: "destructive",
          duration: 4000
        });
        return;
      }

      // Criar projeto no Supabase
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          name: project.name,
          client: project.client,
          city: project.city,
          code: project.code,
          status: project.status,
          installation_date: project.installation_date || null,
          inauguration_date: project.inauguration_date || null,
          owner_name: project.owner,
          suppliers: project.suppliers,
          project_files_link: project.project_files_link || null,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Atualizar o projeto local com o ID do Supabase
      await storage.upsertProject({
        ...project,
        id: data.id,
        _dirty: 0
      });

      toast({
        title: "Projeto sincronizado com sucesso",
        description: `"${project.name}" foi enviado para a nuvem`,
        duration: 3000
      });

      onUpdate?.();

    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Erro na sincronização",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-lg p-3 sm:p-4 ${isSelected ? 'ring-2 ring-primary bg-primary-light/30' : ''} ${isDeleted ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-2 sm:pb-3 p-0">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2 flex-1">
            {onSelectionChange && isActive && (
              <div className="pt-1">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onSelectionChange(e.target.checked);
                  }}
                  className="h-3 w-3 sm:h-4 sm:w-4 rounded border-2 border-primary"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm sm:text-lg font-semibold transition-colors line-clamp-2 leading-tight">
                {project.name}
              </CardTitle>
            </div>
          </div>
          
          <div className="flex flex-col gap-1 ml-2">
            <Badge variant={statusConfig[project.status].variant} className="text-xs px-1.5 py-0.5 w-fit">
              {statusConfig[project.status].label}
            </Badge>
            {isLocalProject && isActive && (
              <Badge variant="outline" className="text-xs px-1.5 py-0.5 text-orange-600 border-orange-200 w-fit">
                Não sync
              </Badge>
            )}
            {isDeleted && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0.5 w-fit">
                Lixeira
              </Badge>
            )}
            {isArchived && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5 w-fit">
                Arquivado
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 sm:space-y-4 p-0">
        <div className="space-y-2">
          <div className="flex items-center text-xs text-muted-foreground">
            <Building className="h-3 w-3 mr-2 flex-shrink-0" />
            <span className="truncate">{project.client}</span>
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 mr-2 flex-shrink-0" />
            <span className="truncate">{project.city}</span>
          </div>
          {project.code && (
            <div className="flex items-center text-xs text-muted-foreground">
              <Code className="h-3 w-3 mr-2 flex-shrink-0" />
              <span className="truncate font-mono text-xs">{project.code}</span>
            </div>
          )}
          {isDeleted && project.permanent_deletion_at && (
            <div className="flex items-center text-xs text-destructive">
              <Clock className="h-3 w-3 mr-2 flex-shrink-0" />
              <span className="text-xs">
                Exclusão em {formatDistanceToNow(new Date(project.permanent_deletion_at), { locale: ptBR, addSuffix: true })}
              </span>
            </div>
          )}
        </div>

        {totalInstallations > 0 && isActive && (
          <div className="space-y-1.5 pt-2 border-t border-border">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Instalações</span>
              <span className="font-medium">
                {completedInstallations}/{totalInstallations}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-1.5" />
            <div className="text-xs text-muted-foreground">
              {Math.round(progressPercentage)}% concluído
            </div>
          </div>
        )}

        <div className="flex gap-1.5 mt-3 flex-wrap">
          {isLocalProject && isActive && (
            <Button 
              variant="outline"
              className="mobile-button flex-1"
              onClick={handleSyncProject}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  <span className="hidden sm:inline">Sincronizando...</span>
                  <span className="sm:hidden">Sync...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Sincronizar</span>
                  <span className="sm:hidden">Sync</span>
                </>
              )}
            </Button>
          )}
          {isActive && !isDeleted && !isArchived && (
            <Button 
              className="mobile-button flex-1 group/btn"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleViewProject();
              }}
            >
              <span className="text-xs">Ver Projeto</span>
              <ArrowRight className="h-3 w-3 ml-1 group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          )}
          <ProjectLifecycleActions 
            project={project} 
            onUpdate={() => onUpdate?.()} 
          />
        </div>
      </CardContent>
    </Card>
  );
}
