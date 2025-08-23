import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, MapPin, User, ArrowRight, Building, Code } from "lucide-react";
import { Project } from "@/types";
import { storage } from "@/lib/storage";
import { useNavigate } from "react-router-dom";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();
  const [installations, setInstallations] = useState<any[]>([]);

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

  const statusConfig = {
    planning: { label: "Planejamento", variant: "secondary" as const },
    "in-progress": { label: "Em Andamento", variant: "default" as const },
    completed: { label: "Concluído", variant: "success" as const }
  };

  const handleViewProject = () => {
    navigate(`/projeto/${project.id}`);
  };

  return (
    <Card className="card-modern group cursor-pointer" onClick={handleViewProject}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors line-clamp-2">
              {project.name}
            </CardTitle>
            <Badge variant={statusConfig[project.status].variant} className="w-fit">
              {statusConfig[project.status].label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center text-sm text-muted-foreground">
            <Building className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate">{project.client}</span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate">{project.city}</span>
          </div>
          {project.code && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Code className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate font-mono">{project.code}</span>
            </div>
          )}
          {project.installation_date && (
            <div className="flex items-center text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>{new Date(project.installation_date).toLocaleDateString('pt-BR')}</span>
            </div>
          )}
        </div>

        {totalInstallations > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Instalações</span>
              <span className="font-medium">
                {completedInstallations}/{totalInstallations}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="text-xs text-muted-foreground">
              {Math.round(progressPercentage)}% concluído
            </div>
          </div>
        )}

        <Button 
          className="w-full group/btn mt-4"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            handleViewProject();
          }}
        >
          <span>Ver Projeto</span>
          <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
}