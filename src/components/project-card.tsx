import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, MapPin, User, ArrowRight } from "lucide-react";
import { Project } from "@/types";
import { storage } from "@/lib/storage";
import { useNavigate } from "react-router-dom";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();
  const installations = storage.getInstallations(project.id);
  const completedInstallations = installations.filter(i => i.installed).length;
  const totalInstallations = installations.length;
  const progressPercentage = totalInstallations > 0 ? (completedInstallations / totalInstallations) * 100 : 0;

  const statusConfig = {
    planning: { label: "Planejamento", variant: "secondary" as const },
    "in-progress": { label: "Em Andamento", variant: "default" as const },
    completed: { label: "Concluído", variant: "success" as const }
  };

  const handleViewProject = () => {
    navigate(`/project/${project.id}`);
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {project.name}
            </CardTitle>
            <Badge variant={statusConfig[project.status].variant}>
              {statusConfig[project.status].label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <User className="h-4 w-4 mr-2" />
            {project.client}
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mr-2" />
            {project.city}
          </div>
          {project.installation_date && (
            <div className="flex items-center text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4 mr-2" />
              {new Date(project.installation_date).toLocaleDateString('pt-BR')}
            </div>
          )}
        </div>

        {totalInstallations > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso das Instalações</span>
              <span className="font-medium">
                {completedInstallations}/{totalInstallations}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        )}

        <Button 
          onClick={handleViewProject}
          className="w-full group/btn"
          variant="outline"
        >
          Ver Projeto
          <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
}