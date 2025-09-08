import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatsCard } from "@/components/ui/stats-card";
import { ProjectCard } from "@/components/project-card";
import { BulkOperationPanel } from "@/components/bulk-operations/BulkOperationPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, FolderOpen, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Project } from "@/types";
import { storage } from "@/lib/storage";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
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
    setProjects(projects);
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

    const project = await storage.upsertProject({
      ...newProject,
      id: '', // Temporário - será substituído pelo UUID do Supabase
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

  const handleBulkOperation = async (operation: string, projectIds: string[]) => {
    try {
      switch (operation) {
        case 'archive':
          // Implement bulk archive
          await Promise.all(projectIds.map(id => {
            const project = projects.find(p => p.id === id);
            if (project) {
              return storage.upsertProject({ ...project, status: 'completed' });
            }
          }));
          break;
        case 'delete':
          // Implement bulk delete
          await Promise.all(projectIds.map(id => storage.deleteProject(id)));
          break;
        case 'export':
          // Implement bulk export
          const selectedProjectsData = projects.filter(p => projectIds.includes(p.id));
          const dataStr = JSON.stringify(selectedProjectsData, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'projetos-exportados.json';
          link.click();
          break;
      }
      
      await loadProjects();
      setSelectedProjects([]);
      
      toast({
        title: "Operação concluída",
        description: `${projectIds.length} projeto(s) processado(s) com sucesso`
      });
    } catch (error) {
      toast({
        title: "Erro na operação",
        description: "Ocorreu um erro ao processar a operação",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container-modern py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Projetos</h1>
          <p className="text-muted-foreground">Gerencie todos os seus projetos</p>
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
              <Button onClick={handleCreateProject} className="w-full">
                Criar Projeto
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total de Projetos" value={totalProjects} icon={FolderOpen} variant="default" />
        <StatsCard title="Concluídos" value={completedProjects} icon={CheckCircle2} variant="success" />
        <StatsCard title="Em Andamento" value={inProgressProjects} icon={Clock} variant="warning" />
        <StatsCard title="Planejamento" value={planningProjects} icon={AlertTriangle} variant="default" />
      </div>

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
        
        {selectedProjects.length > 0 && (
          <BulkOperationPanel
            items={projects.filter(p => selectedProjects.includes(p.id))}
            itemType="projects"
            onItemsChange={(updatedItems) => {
              // Handle updated items if needed
              loadProjects();
              setSelectedProjects([]);
            }}
          />
        )}
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
            <ProjectCard 
              key={project.id} 
              project={project}
              isSelected={selectedProjects.includes(project.id)}
              onSelectionChange={(selected) => {
                if (selected) {
                  setSelectedProjects(prev => [...prev, project.id]);
                } else {
                  setSelectedProjects(prev => prev.filter(id => id !== project.id));
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}