import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatsCard } from "@/components/ui/stats-card";
import { ArrowLeft, Upload, Download, CheckCircle2, Clock, AlertTriangle, Camera, Plus, Search, Filter, Settings } from "lucide-react";
import { Project, Installation } from "@/types";
import { storage } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { InstallationDetailModal } from "@/components/installation-detail-modal";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [project, setProject] = useState<Project | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "installed" | "pending">("all");
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null);

  useEffect(() => {
    if (!id) return;
    
    const projectData = storage.getProjects().find(p => p.id === id);
    if (!projectData) {
      navigate('/');
      return;
    }
    
    setProject(projectData);
    setInstallations(storage.getInstallations(id));
  }, [id, navigate]);

  if (!project) return null;

  const filteredInstallations = installations.filter(installation => {
    const matchesSearch = installation.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         installation.typology.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         installation.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "installed" && installation.installed) ||
                         (statusFilter === "pending" && !installation.installed);
    
    return matchesSearch && matchesStatus;
  });

  const completedInstallations = installations.filter(i => i.installed).length;
  const pendingInstallations = installations.length - completedInstallations;
  const installationsWithObservations = installations.filter(i => i.observations.trim() !== "").length;
  const progressPercentage = installations.length > 0 ? (completedInstallations / installations.length) * 100 : 0;

  const toggleInstallation = (installationId: string) => {
    const installation = installations.find(i => i.id === installationId);
    if (!installation) return;

    const updated = storage.updateInstallation(installationId, {
      installed: !installation.installed
    });

    if (updated) {
      setInstallations(storage.getInstallations(project.id));
      toast({
        title: updated.installed ? "Item instalado" : "Item desmarcado",
        description: `${updated.description} foi ${updated.installed ? "marcado como instalado" : "desmarcado"}`,
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Simulated Excel import - in real app would parse Excel file
    const mockData = [
      { tipologia: "Saída de Emergência", codigo: "SE001", descricao: "Placa de saída de emergência - Escada A", altura: 220, distancia: 15 },
      { tipologia: "Extintor", codigo: "EXT001", descricao: "Extintor CO2 6kg - Térreo", altura: 160, distancia: 10 },
      { tipologia: "Hidrante", codigo: "HID001", descricao: "Hidrante de parede - Subsolo", altura: 150, distancia: 5 },
    ];

    const importedInstallations = storage.importInstallations(project.id, mockData);
    setInstallations(storage.getInstallations(project.id));
    
    toast({
      title: "Planilha importada",
      description: `${importedInstallations.length} itens foram importados com sucesso`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <p className="text-muted-foreground">{project.client} • {project.city}</p>
            </div>
            <Badge variant={
              project.status === 'completed' ? 'success' : 
              project.status === 'in-progress' ? 'warning' : 
              'secondary'
            }>
              {project.status === 'completed' ? 'Concluído' : 
               project.status === 'in-progress' ? 'Em Andamento' : 
               'Planejamento'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="installations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="installations">Instalações</TabsTrigger>
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="installations" className="space-y-6">
            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatsCard
                title="Instalações Concluídas"
                value={completedInstallations}
                description={`${installations.length} total`}
                icon={CheckCircle2}
                variant="success"
              />
              <StatsCard
                title="Pendentes"
                value={pendingInstallations}
                icon={Clock}
                variant="warning"
              />
              <StatsCard
                title="Com Observações"
                value={installationsWithObservations}
                icon={AlertTriangle}
                variant="default"
              />
            </div>

            {/* Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Progresso Geral
                  <span className="text-2xl font-bold">{Math.round(progressPercentage)}%</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={progressPercentage} className="h-3" />
              </CardContent>
            </Card>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar instalações..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                >
                  <option value="all">Todos</option>
                  <option value="installed">Instalados</option>
                  <option value="pending">Pendentes</option>
                </select>
                <Button variant="outline">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Planilha
                </Button>
              </div>
            </div>

            {/* Installations List */}
            <div className="space-y-4">
              {filteredInstallations.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum item encontrado</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      {searchTerm || statusFilter !== "all" 
                        ? "Tente ajustar os filtros de busca"
                        : "Importe uma planilha Excel para começar"
                      }
                    </p>
                    {!searchTerm && statusFilter === "all" && (
                      <Button variant="outline">
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleFileUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Upload className="h-4 w-4 mr-2" />
                        Importar Primeira Planilha
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                filteredInstallations.map((installation) => (
                  <Card key={installation.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={installation.installed}
                              onChange={() => toggleInstallation(installation.id)}
                              className="h-5 w-5 rounded border-2 border-primary"
                            />
                            <div>
                              <h4 className="font-semibold">{installation.description}</h4>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Código: {installation.code}</span>
                                <span>Tipologia: {installation.typology}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Altura: {installation.height_guideline_cm}cm • 
                            Distância do batente: {installation.distance_from_frame_cm}cm
                          </div>
                          {installation.observations && (
                            <div className="bg-warning-light p-3 rounded-md">
                              <p className="text-sm"><strong>Observação:</strong> {installation.observations}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {installation.installed && (
                            <Badge variant="success">Instalado</Badge>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setSelectedInstallation(installation)}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Detalhes
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="info" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Nome do Projeto</Label>
                    <Input value={project.name} readOnly />
                  </div>
                  <div>
                    <Label>Cliente</Label>
                    <Input value={project.client} readOnly />
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input value={project.city} readOnly />
                  </div>
                  <div>
                    <Label>Código</Label>
                    <Input value={project.code} readOnly />
                  </div>
                  <div>
                    <Label>Responsável</Label>
                    <Input value={project.owner} readOnly />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cronograma</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Data de Instalação</Label>
                    <Input 
                      type="date" 
                      value={project.installation_date || ''} 
                      readOnly 
                    />
                  </div>
                  <div>
                    <Label>Data de Inauguração</Label>
                    <Input 
                      type="date" 
                      value={project.inauguration_date || ''} 
                      readOnly 
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Input value={
                      project.status === 'completed' ? 'Concluído' : 
                      project.status === 'in-progress' ? 'Em Andamento' : 
                      'Planejamento'
                    } readOnly />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Fornecedores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {project.suppliers.map((supplier, index) => (
                    <div key={index} className="p-3 bg-muted rounded-md">
                      {supplier}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerar Relatório</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Gere um relatório completo com todas as instalações, progresso e observações do projeto.
                  </p>
                  <Button className="w-full sm:w-auto">
                    <Download className="h-4 w-4 mr-2" />
                    Gerar Relatório PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Installation Detail Modal */}
      {selectedInstallation && (
        <InstallationDetailModal
          installation={selectedInstallation}
          isOpen={!!selectedInstallation}
          onClose={() => setSelectedInstallation(null)}
          onUpdate={() => setInstallations(storage.getInstallations(project.id))}
        />
      )}
    </div>
  );
}