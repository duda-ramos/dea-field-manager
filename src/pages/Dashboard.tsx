import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatsCard } from "@/components/ui/stats-card";
import { ProjectCard } from "@/components/project-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, FolderOpen, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Project } from "@/types";
import { storage } from "@/lib/storage";
import { SyncButton } from "@/components/sync-button";
import { SyncStatusBar } from "@/components/sync-status-bar";
import { SyncStatusPanel } from "@/components/sync-status-panel";
export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
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
  const {
    toast
  } = useToast();
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const projects = await storage.getProjects();
    setProjects(projects);
  };
  const filteredProjects = projects.filter(project => project.name.toLowerCase().includes(searchTerm.toLowerCase()) || project.client.toLowerCase().includes(searchTerm.toLowerCase()) || project.city.toLowerCase().includes(searchTerm.toLowerCase()) || project.code.toLowerCase().includes(searchTerm.toLowerCase()));
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
      id: `project_${Date.now()}`,
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
  const totalProjects = projects.length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;
  const inProgressProjects = projects.filter(p => p.status === 'in-progress').length;
  const planningProjects = projects.filter(p => p.status === 'planning').length;
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-hover text-primary-foreground">
        <div className="container mx-auto px-4 py-8 bg-black">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-[#00ff00] font-bold text-3xl">DEA Manager</h1>
              <p className="text-orange-50">Sistema de Gestão de Projetos e Instalações</p>
            </div>
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="lg" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                  <Plus className="h-5 w-5 mr-2" />
                  Novo Projeto
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar Novo Projeto</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome do Projeto *</Label>
                    <Input id="name" value={newProject.name} onChange={e => setNewProject(prev => ({
                    ...prev,
                    name: e.target.value
                  }))} placeholder="Ex: Shopping Center ABC" />
                  </div>
                  <div>
                    <Label htmlFor="client">Cliente *</Label>
                    <Input id="client" value={newProject.client} onChange={e => setNewProject(prev => ({
                    ...prev,
                    client: e.target.value
                  }))} placeholder="Ex: Construtora XYZ" />
                  </div>
                  <div>
                    <Label htmlFor="city">Cidade *</Label>
                    <Input id="city" value={newProject.city} onChange={e => setNewProject(prev => ({
                    ...prev,
                    city: e.target.value
                  }))} placeholder="Ex: São Paulo, SP" />
                  </div>
                  <div>
                    <Label htmlFor="code">Código do Projeto</Label>
                    <Input id="code" value={newProject.code} onChange={e => setNewProject(prev => ({
                    ...prev,
                    code: e.target.value
                  }))} placeholder="Ex: DEA-2024-001" />
                  </div>
                  <div>
                    <Label htmlFor="owner">Responsável</Label>
                    <Input id="owner" value={newProject.owner} onChange={e => setNewProject(prev => ({
                    ...prev,
                    owner: e.target.value
                  }))} placeholder="Ex: João Silva" />
                  </div>
                  <div>
                    <Label htmlFor="project_files_link">Link dos Arquivos do Projeto</Label>
                    <Input 
                      id="project_files_link" 
                      value={newProject.project_files_link} 
                      onChange={e => setNewProject(prev => ({
                        ...prev,
                        project_files_link: e.target.value
                      }))} 
                      placeholder="Ex: https://drive.google.com/folder/..." 
                    />
                  </div>
                  <div>
                    <Label>Fornecedores</Label>
                    {newProject.suppliers.map((supplier, index) => <Input key={index} className="mt-2" value={supplier} onChange={e => updateSupplier(index, e.target.value)} placeholder={`Fornecedor ${index + 1}`} />)}
                    <Button type="button" variant="outline" size="sm" onClick={addSupplierField} className="mt-2">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Fornecedor
                    </Button>
                  </div>
                  <Button onClick={handleCreateProject} className="w-full">
                    Criar Projeto
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Sync Status Bar */}
        <SyncStatusBar />

        {/* Sync Status Panel */}
        <div className="mb-8">
          <SyncStatusPanel />
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard title="Total de Projetos" value={totalProjects} icon={FolderOpen} variant="default" />
          <StatsCard title="Concluídos" value={completedProjects} icon={CheckCircle2} variant="success" />
          <StatsCard title="Em Andamento" value={inProgressProjects} icon={Clock} variant="warning" />
          <StatsCard title="Planejamento" value={planningProjects} icon={AlertTriangle} variant="default" />
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input placeholder="Buscar projetos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <SyncButton />
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? <div className="text-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? "Nenhum projeto encontrado" : "Nenhum projeto criado"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "Tente ajustar os termos de busca" : "Comece criando seu primeiro projeto"}
            </p>
            {!searchTerm && <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Projeto
              </Button>}
          </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(project => <ProjectCard key={project.id} project={project} />)}
          </div>}
      </div>
    </div>;
}