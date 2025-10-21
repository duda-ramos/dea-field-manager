import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatsCard } from "@/components/ui/stats-card";
import { ProjectCard } from "@/components/project-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, FolderOpen, CheckCircle2, Clock, AlertTriangle, LayoutTemplate } from "lucide-react";
import { InstallationCalendar } from "@/components/installation-calendar";
import { Project } from "@/types";
import { storage } from "@/lib/storage";
import { CardLoadingState } from "@/components/ui/loading-spinner";
import { LoadingBoundary } from "@/components/loading-boundary";
import { DashboardErrorFallback } from "@/components/error-fallbacks";
import { useUndo } from "@/hooks/useUndo";
import { showUndoToast } from "@/lib/toast";

import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { useOnboarding } from "@/hooks/useOnboarding";

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
    suppliers: "",
    installation_time_estimate_days: "",
    installation_date: "",
    inauguration_date: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { toast } = useToast();
  const { showOnboarding, closeOnboarding, markOnboardingComplete } = useOnboarding();
  const { addAction, undo } = useUndo();

  useEffect(() => {
    loadProjects();
  }, []);

  // Atualizar projetos quando a janela volta ao foco (usuário volta de outras páginas)
  useEffect(() => {
    const handleFocus = () => {
      loadProjects();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadProjects();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const allProjects = await storage.getProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error('[Dashboard] Falha ao carregar projetos:', error);
      // Error loading projects - logged via logger service
      
      toast({
        title: "Erro ao carregar projetos",
        description: "Não foi possível carregar seus projetos. Verifique sua conexão e tente novamente",
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Nome do projeto: obrigatório, mínimo 3 caracteres
    if (!newProject.name.trim()) {
      newErrors.name = 'Nome do projeto é obrigatório';
    } else if (newProject.name.trim().length < 3) {
      newErrors.name = 'Nome do projeto deve ter no mínimo 3 caracteres';
    }

    // Cliente: obrigatório
    if (!newProject.client.trim()) {
      newErrors.client = 'Cliente é obrigatório';
    }

    // Validação de datas: data de início não pode ser maior que data de fim
    if (newProject.installation_date && newProject.inauguration_date) {
      const startDate = new Date(newProject.installation_date);
      const endDate = new Date(newProject.inauguration_date);
      if (startDate > endDate) {
        newErrors.installation_date = 'Data de início deve ser anterior à data de término';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateProject = async () => {
    if (!validateForm()) {
      toast({
        title: "Erro de validação",
        description: "Corrija os erros no formulário antes de continuar",
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
        installation_time_estimate_days: newProject.installation_time_estimate_days ? parseInt(newProject.installation_time_estimate_days) : undefined,
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

      // Add undo action for project creation
      addAction({
        type: 'CREATE_PROJECT',
        description: `Criou projeto "${createdProject.name}"`,
        data: { project: createdProject },
        undo: async () => {
          // Deletar projeto do storage
          await storage.deleteProject(createdProject.id);
          // Atualizar UI removendo da lista
          setProjects(prev => prev.filter(p => p.id !== createdProject.id));
        }
      });

      // Show undo toast
      showUndoToast(
        `Criou projeto "${createdProject.name}"`,
        async () => {
          await undo();
        }
      );

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
        suppliers: "",
        installation_time_estimate_days: "",
        installation_date: "",
        inauguration_date: ""
      });
      setErrors({});

      toast({
        title: "Projeto criado com sucesso",
        description: `"${createdProject.name}" foi adicionado aos seus projetos`,
        duration: 3000
      });

    } catch (error) {
      console.error('[Dashboard] Falha ao criar projeto:', error, {
        projectName: newProject.name,
        clientName: newProject.client
      });
      // Error creating project - logged via logger service
      
      toast({
        title: "Erro ao criar projeto",
        description: "Não foi possível criar o projeto. Verifique os dados e tente novamente",
        variant: "destructive",
        duration: 5000
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
      suppliers: "",
      installation_time_estimate_days: "",
      installation_date: "",
      inauguration_date: ""
    });
    setErrors({});
  };

  const _handleSelectTemplate = async (template: any) => {
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
      suppliers: "",
      installation_time_estimate_days: "",
      installation_date: "",
      inauguration_date: ""
    });
  };

  // Filter out deleted and archived projects
  const activeProjects = projects.filter(p => !p.deleted_at && !p.archived_at);

  const filteredProjects = activeProjects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.city && project.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getProjectStats = () => {
    const total = activeProjects.length;
    const active = activeProjects.filter(p => p.status === 'in-progress').length;
    const completed = activeProjects.filter(p => p.status === 'completed').length;
    const planning = activeProjects.filter(p => p.status === 'planning').length;

    return { total, active, completed, planning };
  };

  const stats = getProjectStats();

  return (
    <LoadingBoundary
      isLoading={loading}
      loadingMessage="Carregando dashboard..."
      fallback={DashboardErrorFallback}
    >
      <div className="space-y-responsive">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Gerencie seus projetos e acompanhe o progresso
            </p>
          </div>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="mobile-button gap-1 sm:gap-2">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Novo Projeto</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">Criar Novo Projeto</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 sm:space-y-4">
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
                    onChange={(e) => {
                      setNewProject(prev => ({ ...prev, name: e.target.value }));
                      if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                    }}
                    placeholder="Nome do projeto"
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">{errors.name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="client">Cliente *</Label>
                  <Input
                    id="client"
                    value={newProject.client}
                    onChange={(e) => {
                      setNewProject(prev => ({ ...prev, client: e.target.value }));
                      if (errors.client) setErrors(prev => ({ ...prev, client: '' }));
                    }}
                    placeholder="Nome do cliente"
                    className={errors.client ? 'border-destructive' : ''}
                  />
                  {errors.client && (
                    <p className="text-sm text-destructive mt-1">{errors.client}</p>
                  )}
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
                <div>
                  <Label htmlFor="installation_time_estimate_days">Estimativa de Tempo de Instalação (dias úteis)</Label>
                  <Input
                    id="installation_time_estimate_days"
                    type="number"
                    min="1"
                    value={newProject.installation_time_estimate_days}
                    onChange={(e) => setNewProject(prev => ({ ...prev, installation_time_estimate_days: e.target.value }))}
                    placeholder="Ex: 15"
                  />
                </div>
                <div>
                  <Label htmlFor="installation_date">Data de Início</Label>
                  <Input
                    id="installation_date"
                    type="date"
                    value={newProject.installation_date}
                    onChange={(e) => {
                      setNewProject(prev => ({ ...prev, installation_date: e.target.value }));
                      if (errors.installation_date) setErrors(prev => ({ ...prev, installation_date: '' }));
                    }}
                    className={errors.installation_date ? 'border-destructive' : ''}
                  />
                  {errors.installation_date && (
                    <p className="text-sm text-destructive mt-1">{errors.installation_date}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="inauguration_date">Data de Término</Label>
                  <Input
                    id="inauguration_date"
                    type="date"
                    value={newProject.inauguration_date}
                    onChange={(e) => {
                      setNewProject(prev => ({ ...prev, inauguration_date: e.target.value }));
                      if (errors.installation_date) setErrors(prev => ({ ...prev, installation_date: '' }));
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCreateProject} 
                    disabled={creating || Object.keys(errors).some(key => errors[key] !== '')} 
                    className="flex-1"
                  >
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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

        {/* Installation Calendar */}
        <InstallationCalendar projects={activeProjects} />

        {/* Search and Filter */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3 sm:h-4 sm:w-4" />
            <Input
              placeholder="Buscar projetos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mobile-input pl-8 sm:pl-10"
            />
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid-projects">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CardLoadingState key={i} />
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
        <div className="grid-projects">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
            />
          ))}
        </div>
        ) : (
          <div className="text-center py-8 sm:py-12">
            <FolderOpen className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              {searchTerm ? "Nenhum projeto encontrado" : "Nenhum projeto ainda"}
            </h3>
            <p className="text-muted-foreground mb-3 sm:mb-4 text-sm sm:text-base px-4">
              {searchTerm
                ? "Tente ajustar os termos de busca"
                : "Comece criando seu primeiro projeto"}
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsCreateModalOpen(true)} className="mobile-button gap-1 sm:gap-2">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
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
