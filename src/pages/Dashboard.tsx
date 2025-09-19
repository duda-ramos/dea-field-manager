import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatsCard } from "@/components/ui/stats-card";
import { ProjectCard } from "@/components/project-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, FolderOpen, CheckCircle2, Clock, AlertTriangle, LayoutTemplate } from "lucide-react";
import { Project } from "@/types";
import { storage } from "@/lib/storage";
import { LoadingState, CardLoadingState } from "@/components/ui/loading-spinner";
import { LoadingBoundary } from "@/components/loading-boundary";
import { errorMonitoring } from "@/services/errorMonitoring";
import { ProjectProgressCharts } from "@/components/dashboard/ProjectProgressCharts";
import { OnboardingFlow, useOnboarding } from "@/components/onboarding/OnboardingFlow";
import { useAuth } from "@/hooks/useAuth";
import { ProjectTemplateSelector } from "@/components/templates/ProjectTemplateSelector";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [newProject, setNewProject] = useState({
    name: "",
    client: "",
    city: "",
    code: "",
    owner: "",
    project_files_link: "",
    suppliers: ""
  });
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { showOnboarding, closeOnboarding, markOnboardingComplete } = useOnboarding();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const allProjects = await storage.getProjects();
      setProjects(allProjects);
    } catch (error) {
      // Error loading projects - logged via logger service
      
      toast({
        title: "Erro ao carregar projetos",
        description: "Tente novamente em alguns instantes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.client) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome do projeto e cliente são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      setCreating(true);
      
      // Use template data if selected
      let projectData = {
        ...newProject,
        id: '', // Temporário - será substituído pelo UUID do Supabase
        status: 'planning' as const,
        suppliers: newProject.suppliers ? newProject.suppliers.split(',').map(s => s.trim()) : [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Apply template data if available
      if (selectedTemplate) {
        projectData = {
          ...projectData,
          ...selectedTemplate.template_data,
          // Keep user-entered data for these fields
          name: newProject.name,
          client: newProject.client,
          city: newProject.city,
          code: newProject.code || selectedTemplate.template_data?.code || '',
        };
      }

      const createdProject = await storage.upsertProject(projectData);

      await loadProjects();
      setIsCreateModalOpen(false);
      setSelectedTemplate(null);
      setNewProject({
        name: "",
        client: "",
        city: "",
        code: "",
        owner: "",
        project_files_link: "",
        suppliers: ""
      });

      toast({
        title: "Projeto criado",
        description: `Projeto "${createdProject.name}" foi criado com sucesso.`,
      });

    } catch (error) {
      // Error creating project - logged via logger service
      
      toast({
        title: "Erro ao criar projeto",
        description: "Tente novamente em alguns instantes",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setNewProject({
      name: "",
      client: "",
      city: "",
      code: "",
      owner: "",
      project_files_link: "",
      suppliers: ""
    });
  };

  const handleSelectTemplate = async (template: any) => {
    setSelectedTemplate(template);
    setShowTemplateSelector(false);
    
    // Pre-fill some fields from template if available
    if (template.template_data) {
      setNewProject(prev => ({
        ...prev,
        owner: template.template_data.owner_name || prev.owner,
        project_files_link: template.template_data.project_files_link || prev.project_files_link,
        suppliers: template.template_data.suppliers || prev.suppliers
      }));
    }
    
    toast({
      title: "Template selecionado",
      description: `Template "${template.name}" foi aplicado ao projeto`
    });
  };

  const startFromScratch = () => {
    setSelectedTemplate(null);
    setNewProject({
      name: "",
      client: "",
      city: "",
      code: "",
      owner: "",
      project_files_link: "",
      suppliers: ""
    });
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.city && project.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getProjectStats = () => {
    const total = projects.length;
    const active = projects.filter(p => p.status === 'in-progress').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const planning = projects.filter(p => p.status === 'planning').length;

    return { total, active, completed, planning };
  };

  const stats = getProjectStats();

  return (
    <LoadingBoundary>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Gerencie seus projetos e acompanhe o progresso
            </p>
          </div>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Projeto
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Novo Projeto</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Template Selection */}
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowTemplateSelector(true)}
                    className="gap-2"
                  >
                    <LayoutTemplate className="h-4 w-4" />
                    Usar Template
                  </Button>
                  {selectedTemplate && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={startFromScratch}
                    >
                      Começar do Zero
                    </Button>
                  )}
                </div>

                {selectedTemplate && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Template: {selectedTemplate.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                  </div>
                )}

                <div>
                  <Label htmlFor="name">Nome do Projeto *</Label>
                  <Input
                    id="name"
                    value={newProject.name}
                    onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome do projeto"
                  />
                </div>
                <div>
                  <Label htmlFor="client">Cliente *</Label>
                  <Input
                    id="client"
                    value={newProject.client}
                    onChange={(e) => setNewProject(prev => ({ ...prev, client: e.target.value }))}
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={newProject.city}
                    onChange={(e) => setNewProject(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Cidade do projeto"
                  />
                </div>
                <div>
                  <Label htmlFor="code">Código</Label>
                  <Input
                    id="code"
                    value={newProject.code}
                    onChange={(e) => setNewProject(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="Código do projeto"
                  />
                </div>
                <div>
                  <Label htmlFor="owner">Responsável</Label>
                  <Input
                    id="owner"
                    value={newProject.owner}
                    onChange={(e) => setNewProject(prev => ({ ...prev, owner: e.target.value }))}
                    placeholder="Responsável pelo projeto"
                  />
                </div>
                <div>
                  <Label htmlFor="project_files_link">Link dos Arquivos</Label>
                  <Input
                    id="project_files_link"
                    value={newProject.project_files_link}
                    onChange={(e) => setNewProject(prev => ({ ...prev, project_files_link: e.target.value }))}
                    placeholder="Link para arquivos do projeto"
                  />
                </div>
                <div>
                  <Label htmlFor="suppliers">Fornecedores</Label>
                  <Input
                    id="suppliers"
                    value={newProject.suppliers}
                    onChange={(e) => setNewProject(prev => ({ ...prev, suppliers: e.target.value }))}
                    placeholder="Lista de fornecedores"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateProject} disabled={creating} className="flex-1">
                    {creating ? "Criando..." : "Criar Projeto"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Limpar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Template Selector Modal */}
        <ProjectTemplateSelector
          isOpen={showTemplateSelector}
          onClose={() => setShowTemplateSelector(false)}
          onSelectTemplate={handleSelectTemplate}
        />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total de Projetos"
          value={stats.total}
          icon={FolderOpen}
        />
        <StatsCard
          title="Projetos Ativos"
          value={stats.active}
          icon={Clock}
        />
        <StatsCard
          title="Projetos Concluídos"
          value={stats.completed}
          icon={CheckCircle2}
        />
        <StatsCard
          title="Projetos Planejando"
          value={stats.planning}
          icon={AlertTriangle}
        />
      </div>

        {/* Progress Charts */}
        <ProjectProgressCharts projects={projects} />

        {/* Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar projetos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CardLoadingState key={i} />
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
            />
          ))}
        </div>
        ) : (
          <div className="text-center py-12">
            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? "Nenhum projeto encontrado" : "Nenhum projeto ainda"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? "Tente ajustar os termos de busca"
                : "Comece criando seu primeiro projeto"}
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Primeiro Projeto
              </Button>
            )}
          </div>
        )}

        <OnboardingFlow
          isOpen={showOnboarding}
          onClose={closeOnboarding}
          onComplete={markOnboardingComplete}
        />
      </div>
    </LoadingBoundary>
  );
}
