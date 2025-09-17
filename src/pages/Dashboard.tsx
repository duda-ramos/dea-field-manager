import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatsCard } from "@/components/ui/stats-card";
import { ProjectCard } from "@/components/project-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, FolderOpen, CheckCircle2, Clock, AlertTriangle, Template } from "lucide-react";
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
    suppliers: [""]
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const { 
    showOnboarding, 
    markOnboardingComplete, 
    closeOnboarding 
  } = useOnboarding();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projects = await storage.getProjects();
      setProjects(projects);
    } catch (error) {
      errorMonitoring.captureError(
        error instanceof Error ? error : new Error(String(error)),
        {
          action: 'load_projects',
          component: 'Dashboard'
        }
      );
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os projetos.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.client || !newProject.city) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
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
        suppliers: newProject.suppliers.filter(s => s.trim() !== ''),
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

      const project = await storage.upsertProject(projectData);

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
        suppliers: [""]
      });

      toast({
        title: "Projeto criado",
        description: `Projeto "${project.name}" foi criado com sucesso`
      });
    } catch (error) {
      errorMonitoring.captureError(
        error instanceof Error ? error : new Error(String(error)),
        {
          action: 'create_project',
          component: 'Dashboard',
          metadata: { projectName: newProject.name }
        }
      );
      toast({
        title: "Erro",
        description: "Não foi possível criar o projeto. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const addSupplierField = () => {
    setNewProject(prev => ({
      ...prev,
      suppliers: [...prev.suppliers, ""]
    }));
  };

  const updateSupplier = (index: number, value: string) => {
    setNewProject(prev => ({
      ...prev,
      suppliers: prev.suppliers.map((s, i) => i === index ? value : s)
    }));
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
      suppliers: [""]
    });
  };

  // Calculate statistics
  const totalProjects = projects.length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;
  const inProgressProjects = projects.filter(p => p.status === 'in-progress').length;
  const planningProjects = projects.filter(p => p.status === 'planning').length;

  return (
    <LoadingBoundary isLoading={loading} loadingMessage="Carregando projetos...">
      <div className="container-modern py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral dos seus projetos e instalações</p>
          </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
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
                  <Template className="h-4 w-4" />
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
                  onChange={e => setNewProject(prev => ({ ...prev, name: e.target.value }))} 
                  placeholder="Ex: Shopping Center ABC" 
                />
              </div>
              <div>
                <Label htmlFor="client">Cliente *</Label>
                <Input 
                  id="client" 
                  value={newProject.client} 
                  onChange={e => setNewProject(prev => ({ ...prev, client: e.target.value }))} 
                  placeholder="Ex: Construtora XYZ" 
                />
              </div>
              <div>
                <Label htmlFor="city">Cidade *</Label>
                <Input 
                  id="city" 
                  value={newProject.city} 
                  onChange={e => setNewProject(prev => ({ ...prev, city: e.target.value }))} 
                  placeholder="Ex: São Paulo, SP" 
                />
              </div>
              <div>
                <Label htmlFor="code">Código do Projeto</Label>
                <Input 
                  id="code" 
                  value={newProject.code} 
                  onChange={e => setNewProject(prev => ({ ...prev, code: e.target.value }))} 
                  placeholder="Ex: DEA-2024-001" 
                />
              </div>
              <div>
                <Label htmlFor="owner">Responsável</Label>
                <Input 
                  id="owner" 
                  value={newProject.owner} 
                  onChange={e => setNewProject(prev => ({ ...prev, owner: e.target.value }))} 
                  placeholder="Ex: João Silva" 
                />
              </div>
              <div>
                <Label htmlFor="project_files_link">Link dos Arquivos do Projeto</Label>
                <Input 
                  id="project_files_link" 
                  value={newProject.project_files_link} 
                  onChange={e => setNewProject(prev => ({ ...prev, project_files_link: e.target.value }))} 
                  placeholder="Ex: https://drive.google.com/folder/..." 
                />
              </div>
              <div>
                <Label>Fornecedores</Label>
                {newProject.suppliers.map((supplier, index) => (
                  <Input 
                    key={index} 
                    className="mt-2" 
                    value={supplier} 
                    onChange={e => updateSupplier(index, e.target.value)} 
                    placeholder={`Fornecedor ${index + 1}`} 
                  />
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addSupplierField} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Fornecedor
                </Button>
              </div>
              <Button onClick={handleCreateProject} className="w-full" disabled={creating}>
                {creating ? <LoadingState message="Criando projeto..." size="sm" /> : "Criar Projeto"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Template Selector Modal */}
        <ProjectTemplateSelector
          isOpen={showTemplateSelector}
          onClose={() => setShowTemplateSelector(false)}
          onSelectTemplate={handleSelectTemplate}
        />
      </div>


        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total de Projetos" value={totalProjects} icon={FolderOpen} variant="default" />
          <StatsCard title="Concluídos" value={completedProjects} icon={CheckCircle2} variant="success" />
          <StatsCard title="Em Andamento" value={inProgressProjects} icon={Clock} variant="warning" />
          <StatsCard title="Planejamento" value={planningProjects} icon={AlertTriangle} variant="default" />
        </div>

        {/* Progress Charts */}
        {projects.length > 0 && (
          <ProjectProgressCharts projects={projects} />
        )}

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input 
            placeholder="Buscar projetos..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="pl-10" 
          />
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {searchTerm ? "Nenhum projeto encontrado" : "Nenhum projeto criado"}
          </h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            {searchTerm ? "Tente ajustar os termos de busca" : "Comece criando seu primeiro projeto para gerenciar suas instalações"}
          </p>
          {!searchTerm && (
            <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Primeiro Projeto
            </Button>
          )}
         </div>
       ) : (
         <div className="grid-projects">
           {filteredProjects.map(project => (
             <ProjectCard key={project.id} project={project} />
           ))}
         </div>
       )}
     </div>

     {/* Onboarding Flow */}
     <OnboardingFlow
       isOpen={showOnboarding}
       onClose={closeOnboarding}
       onComplete={markOnboardingComplete}
     />
   </LoadingBoundary>
 );
}