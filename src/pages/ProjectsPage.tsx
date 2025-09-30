import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatsCard } from "@/components/ui/stats-card";
import { ProjectCard } from "@/components/project-card";
import { BulkOperationPanel } from "@/components/bulk-operations/BulkOperationPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, FolderOpen, CheckCircle2, Clock, AlertTriangle, Trash2, Archive } from "lucide-react";
import { Project } from "@/types";
import { storage } from "@/lib/storage";

export default function ProjectsPage() {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'deleted' | 'archived'>('active');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const projects = await storage.getProjects();
    setAllProjects(projects);
  };

  // Filter projects based on active tab
  const getProjectsByTab = () => {
    switch (activeTab) {
      case 'deleted':
        return allProjects.filter(p => p.deleted_at && !p.archived_at);
      case 'archived':
        return allProjects.filter(p => p.archived_at && !p.deleted_at);
      default:
        return allProjects.filter(p => !p.deleted_at && !p.archived_at);
    }
  };

  const projects = getProjectsByTab();

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

    const project = await storage.upsertProject({
      ...newProject,
      id: '',
      status: 'planning' as const,
      suppliers: newProject.suppliers.filter(s => s.trim() !== ''),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    await loadProjects();
    setIsCreateModalOpen(false);
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

  // Calculate statistics
  const activeProjects = allProjects.filter(p => !p.deleted_at && !p.archived_at);
  const totalProjects = activeProjects.length;
  const completedProjects = activeProjects.filter(p => p.status === 'completed').length;
  const inProgressProjects = activeProjects.filter(p => p.status === 'in-progress').length;
  const planningProjects = activeProjects.filter(p => p.status === 'planning').length;
  const deletedCount = allProjects.filter(p => p.deleted_at).length;
  const archivedCount = allProjects.filter(p => p.archived_at).length;

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Projetos</h1>
          <p className="text-muted-foreground">
            Gerencie seus projetos
          </p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Novo Projeto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
                  placeholder="Nome do cliente" 
                />
              </div>
              <div>
                <Label htmlFor="city">Cidade *</Label>
                <Input 
                  id="city" 
                  value={newProject.city} 
                  onChange={e => setNewProject(prev => ({ ...prev, city: e.target.value }))} 
                  placeholder="Cidade do projeto" 
                />
              </div>
              <div>
                <Label htmlFor="code">Código do Projeto</Label>
                <Input 
                  id="code" 
                  value={newProject.code} 
                  onChange={e => setNewProject(prev => ({ ...prev, code: e.target.value }))} 
                  placeholder="Ex: P-2024-001" 
                />
              </div>
              <div>
                <Label htmlFor="owner">Responsável</Label>
                <Input 
                  id="owner" 
                  value={newProject.owner} 
                  onChange={e => setNewProject(prev => ({ ...prev, owner: e.target.value }))} 
                  placeholder="Nome do responsável" 
                />
              </div>
              <div>
                <Label htmlFor="project_files_link">Link dos Arquivos do Projeto</Label>
                <Input 
                  id="project_files_link" 
                  value={newProject.project_files_link} 
                  onChange={e => setNewProject(prev => ({ ...prev, project_files_link: e.target.value }))} 
                  placeholder="https://..." 
                />
              </div>
              <div>
                <Label>Fornecedores</Label>
                {newProject.suppliers.map((supplier, index) => (
                  <div key={index} className="mt-2">
                    <Input 
                      value={supplier} 
                      onChange={e => updateSupplier(index, e.target.value)} 
                      placeholder={`Fornecedor ${index + 1}`} 
                    />
                  </div>
                ))}
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addSupplierField} 
                  className="mt-2"
                >
                  + Adicionar Fornecedor
                </Button>
              </div>
              <Button onClick={handleCreateProject} className="w-full">
                Criar Projeto
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total de Projetos"
          value={totalProjects}
          icon={FolderOpen}
        />
        <StatsCard
          title="Concluídos"
          value={completedProjects}
          icon={CheckCircle2}
          variant="success"
        />
        <StatsCard
          title="Em Andamento"
          value={inProgressProjects}
          icon={Clock}
          variant="warning"
        />
        <StatsCard
          title="Planejamento"
          value={planningProjects}
          icon={AlertTriangle}
          variant="default"
        />
      </div>

      {/* Tabs for filtering */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">
            Ativos ({totalProjects})
          </TabsTrigger>
          <TabsTrigger value="deleted">
            <Trash2 className="h-4 w-4 mr-2" />
            Lixeira ({deletedCount})
          </TabsTrigger>
          <TabsTrigger value="archived">
            <Archive className="h-4 w-4 mr-2" />
            Arquivados ({archivedCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6 space-y-4">
          {/* Search */}
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar projetos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Projects List */}
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchTerm ? "Nenhum projeto encontrado." : 
                  activeTab === 'deleted' ? "Nenhum projeto na lixeira." :
                  activeTab === 'archived' ? "Nenhum projeto arquivado." :
                  "Nenhum projeto encontrado. Crie seu primeiro projeto!"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isSelected={selectedProjects.includes(project.id)}
                  onSelectionChange={(selected) => {
                    if (selected) {
                      setSelectedProjects([...selectedProjects, project.id]);
                    } else {
                      setSelectedProjects(selectedProjects.filter(id => id !== project.id));
                    }
                  }}
                  onUpdate={loadProjects}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
