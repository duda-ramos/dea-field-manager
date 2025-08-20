import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, FolderOpen } from "lucide-react";
import { Project } from "@/types";
import { storage } from "@/lib/storage";

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const savedProjects = storage.getProjects();
    setProjects(savedProjects);
  }, []);

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createSampleProject = () => {
    const sampleProject = storage.saveProject({
      name: "Shopping Center ABC",
      client: "Construtora XYZ",
      city: "São Paulo, SP",
      code: "DEA-2024-001",
      status: 'planning',
      owner: "João Silva",
      suppliers: ["Fornecedor A", "Fornecedor B"]
    });

    setProjects(storage.getProjects());
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">DEA Manager</h1>
              <p className="text-primary-foreground/80">Sistema de Gestão de Projetos e Instalações</p>
            </div>
            <Button 
              variant="secondary" 
              size="lg" 
              onClick={createSampleProject}
            >
              <Plus className="h-5 w-5 mr-2" />
              Projeto de Exemplo
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Search */}
        <div className="mb-6">
          <Input
            placeholder="Buscar projetos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Projects */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? "Nenhum projeto encontrado" : "Nenhum projeto criado"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? "Tente ajustar os termos de busca"
                : "Comece criando um projeto de exemplo"
              }
            </p>
            {!searchTerm && (
              <Button onClick={createSampleProject}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Projeto de Exemplo
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(project => (
              <Card key={project.id} className="hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>Cliente:</strong> {project.client}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Cidade:</strong> {project.city}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Código:</strong> {project.code}
                  </p>
                  <Button className="w-full mt-4">
                    Ver Projeto
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}