import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Download, Filter, TrendingUp, Calendar, FileText } from "lucide-react";
import { Project, Installation } from "@/types";
import { storage } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";

interface ReportData {
  totalProjects: number;
  totalInstallations: number;
  completedInstallations: number;
  pendingInstallations: number;
  projectsInProgress: number;
  completedProjects: number;
  averageCompletion: number;
}

export default function ReportsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [reportData, setReportData] = useState<ReportData>({
    totalProjects: 0,
    totalInstallations: 0,
    completedInstallations: 0,
    pendingInstallations: 0,
    projectsInProgress: 0,
    completedProjects: 0,
    averageCompletion: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateReportData();
  }, [projects, installations, selectedProject]);

  const loadData = async () => {
    const projectsData = await storage.getProjects();
    setProjects(projectsData);

    const allInstallations = [];
    for (const project of projectsData) {
      const projectInstallations = await storage.getInstallationsByProject(project.id);
      allInstallations.push(...projectInstallations);
    }
    setInstallations(allInstallations);
  };

  const calculateReportData = () => {
    let filteredProjects = projects;
    let filteredInstallations = installations;

    if (selectedProject !== "all") {
      filteredProjects = projects.filter(p => p.id === selectedProject);
      filteredInstallations = installations.filter(i => i.project_id === selectedProject);
    }

    const completedInstallations = filteredInstallations.filter(i => i.installed).length;
    const totalInstallations = filteredInstallations.length;
    const pendingInstallations = totalInstallations - completedInstallations;
    const completedProjects = filteredProjects.filter(p => p.status === 'completed').length;
    const projectsInProgress = filteredProjects.filter(p => p.status === 'in-progress').length;
    const averageCompletion = totalInstallations > 0 ? (completedInstallations / totalInstallations) * 100 : 0;

    setReportData({
      totalProjects: filteredProjects.length,
      totalInstallations,
      completedInstallations,
      pendingInstallations,
      projectsInProgress,
      completedProjects,
      averageCompletion
    });
  };

  const generateCSVReport = () => {
    let dataToExport = installations;
    
    if (selectedProject !== "all") {
      dataToExport = installations.filter(i => i.project_id === selectedProject);
    }

    const csvContent = [
      ['Projeto', 'Código', 'Descrição', 'Tipologia', 'Pavimento', 'Quantidade', 'Status', 'Data Instalação'].join(','),
      ...dataToExport.map(installation => {
        const project = projects.find(p => p.id === installation.project_id);
        return [
          project?.name || 'N/A',
          installation.codigo,
          installation.descricao,
          installation.tipologia,
          installation.pavimento,
          installation.quantidade,
          installation.installed ? 'Instalado' : 'Pendente',
          installation.installed_at || 'N/A'
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_${selectedProject}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Relatório exportado",
      description: "O relatório foi baixado com sucesso em formato CSV."
    });
  };

  const getProjectsByStatus = () => {
    let filteredProjects = projects;
    if (selectedProject !== "all") {
      filteredProjects = projects.filter(p => p.id === selectedProject);
    }

    const statusCounts = filteredProjects.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return statusCounts;
  };

  const statusCounts = getProjectsByStatus();

  return (
    <div className="container-modern py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Visualize dados e estatísticas dos seus projetos</p>
        </div>
        <Button onClick={generateCSVReport} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Projeto</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Projetos</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Projetos</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalProjects}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Instalações</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalInstallations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instalações Concluídas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{reportData.completedInstallations}</div>
            <p className="text-xs text-muted-foreground">
              {reportData.averageCompletion.toFixed(1)}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instalações Pendentes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{reportData.pendingInstallations}</div>
          </CardContent>
        </Card>
      </div>

      {/* Project Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Status dos Projetos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(statusCounts).map(([status, count]) => {
              const getStatusInfo = (status: string) => {
                switch (status) {
                  case 'planning':
                    return { label: 'Planejamento', variant: 'secondary' as const };
                  case 'in-progress':
                    return { label: 'Em Andamento', variant: 'default' as const };
                  case 'completed':
                    return { label: 'Concluído', variant: 'success' as const };
                  default:
                    return { label: status, variant: 'outline' as const };
                }
              };

              const statusInfo = getStatusInfo(status);
              const percentage = reportData.totalProjects > 0 ? (count / reportData.totalProjects) * 100 : 0;

              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    <span className="text-sm text-muted-foreground">{count} projetos</span>
                  </div>
                  <span className="text-sm font-medium">{percentage.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Progress Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Progresso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Projetos Concluídos</span>
              <span className="font-medium">{reportData.completedProjects} de {reportData.totalProjects}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Projetos Em Andamento</span>
              <span className="font-medium">{reportData.projectsInProgress}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Taxa de Conclusão Média</span>
              <span className="font-medium">{reportData.averageCompletion.toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}