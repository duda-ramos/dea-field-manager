import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatsCard } from "@/components/ui/stats-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  ArrowLeft, Upload, Download, CheckCircle2, Clock, AlertTriangle, 
  Settings, Search, FileSpreadsheet, RefreshCw 
} from "lucide-react";
import { Project, Installation } from "@/types";
import { storage } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { InstallationDetailModalNew } from "@/components/installation-detail-modal-new";
import { importExcelFile } from "@/lib/excel-import";
import { generatePDFReport, generateXLSXReport } from "@/lib/reports";

export default function ProjectDetailNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [project, setProject] = useState<Project | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "installed" | "pending">("all");
  const [pavimentoFilter, setPavimentoFilter] = useState<string>("all");
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null);
  const [isImporting, setIsImporting] = useState(false);

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

  // Determine current section based on route
  const currentSection = location.pathname.includes('/pecas') ? 'pecas' : 
                        location.pathname.includes('/relatorios') ? 'relatorios' :
                        location.pathname.includes('/orcamentos') ? 'orcamentos' :
                        'info';

  // Get unique pavimentos for filter
  const pavimentos = Array.from(new Set(installations.map(i => i.pavimento))).sort();

  const filteredInstallations = installations.filter(installation => {
    const matchesSearch = installation.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          installation.tipologia.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(installation.codigo).includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || 
                          (statusFilter === "installed" && installation.installed) ||
                          (statusFilter === "pending" && !installation.installed);
                          
    const matchesPavimento = pavimentoFilter === "all" || installation.pavimento === pavimentoFilter;
    
    return matchesSearch && matchesStatus && matchesPavimento;
  });

  const completedInstallations = installations.filter(i => i.installed).length;
  const pendingInstallations = installations.length - completedInstallations;
  const installationsWithObservations = installations.filter(i => i.observacoes && i.observacoes.trim() !== "").length;
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
        description: `${updated.descricao} foi ${updated.installed ? "marcado como instalado" : "desmarcado"}`,
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    
    try {
      const result = await importExcelFile(file);
      
      if (!result.success) {
        toast({
          title: "Erro na importação",
          description: result.error,
          variant: "destructive"
        });
        return;
      }

      const importResult = storage.importInstallations(project.id, result.data);
      setInstallations(storage.getInstallations(project.id));
      
      // Show summary
      const summaryText = Object.entries(importResult.summary)
        .map(([pavimento, count]) => `${pavimento}: ${count} itens`)
        .join(', ');
      
      toast({
        title: "Planilha importada com sucesso!",
        description: `Importados: ${summaryText}`,
      });
    } catch (error) {
      toast({
        title: "Erro na importação",
        description: "Erro ao processar arquivo Excel",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      // Clear file input
      event.target.value = '';
    }
  };

  const handleGenerateReport = (format: 'pdf' | 'xlsx') => {
    const reportData = {
      project,
      installations,
      generatedBy: project.owner,
      generatedAt: new Date().toISOString()
    };

    if (format === 'pdf') {
      generatePDFReport(reportData);
    } else {
      generateXLSXReport(reportData);
    }

    // Save report to history
    storage.saveReport({
      project_id: project.id,
      generated_by: project.owner,
      generated_at: new Date().toISOString(),
      file_path: `relatorio-${project.name}-${Date.now()}.${format}`
    });

    toast({
      title: "Relatório gerado",
      description: `Relatório ${format.toUpperCase()} foi baixado com sucesso`,
    });
  };

  const renderPecasSection = () => {
    // Group installations by tipologia
    const groupedInstallations = filteredInstallations.reduce((groups, installation) => {
      const tipologia = installation.tipologia;
      if (!groups[tipologia]) {
        groups[tipologia] = [];
      }
      groups[tipologia].push(installation);
      return groups;
    }, {} as Record<string, Installation[]>);

    // Sort installations within each group by codigo as number
    Object.keys(groupedInstallations).forEach(tipologia => {
      groupedInstallations[tipologia].sort((a, b) => {
        const codeA = typeof a.codigo === 'number' ? a.codigo : parseInt(String(a.codigo)) || 0;
        const codeB = typeof b.codigo === 'number' ? b.codigo : parseInt(String(b.codigo)) || 0;
        return codeA - codeB;
      });
    });

    return (
      <div className="space-y-6">
        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo das Peças</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{installations.length}</div>
                <div className="text-sm text-muted-foreground">Total de Peças</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{completedInstallations}</div>
                <div className="text-sm text-muted-foreground">Instaladas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{pendingInstallations}</div>
                <div className="text-sm text-muted-foreground">Pendentes</div>
              </div>
            </div>
          </CardContent>
        </Card>

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
              placeholder="Buscar por código, tipologia ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="all">Todos os Status</option>
              <option value="installed">Instalados</option>
              <option value="pending">Pendentes</option>
            </select>
            
            <select
              value={pavimentoFilter}
              onChange={(e) => setPavimentoFilter(e.target.value)}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="all">Todos os Pavimentos</option>
              {pavimentos.map(pavimento => (
                <option key={pavimento} value={pavimento}>{pavimento}</option>
              ))}
            </select>
            
            <Button variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar
            </Button>
          </div>
        </div>

        {/* Installations List - Grouped by Tipologia */}
        <div className="space-y-4">
          {Object.keys(groupedInstallations).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum item encontrado</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {searchTerm || statusFilter !== "all" || pavimentoFilter !== "all"
                    ? "Tente ajustar os filtros de busca"
                    : "Importe uma planilha Excel para começar"
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {Object.entries(groupedInstallations)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([tipologia, installations]) => (
                  <AccordionItem key={tipologia} value={tipologia} className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <span className="font-semibold">{tipologia}</span>
                        <Badge variant="outline" className="ml-2">
                          {installations.length} {installations.length === 1 ? 'item' : 'itens'}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-3">
                        {installations.map((installation) => (
                          <Card key={installation.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
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
                                      <h4 className="font-semibold">
                                        {installation.codigo} {installation.descricao}
                                      </h4>
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span className="font-medium">{installation.pavimento}</span>
                                        <span>•</span>
                                        <span>qtd: {installation.quantidade}</span>
                                      </div>
                                    </div>
                                  </div>
                                  {(installation.diretriz_altura_cm || installation.diretriz_dist_batente_cm) && (
                                    <div className="text-sm text-muted-foreground ml-8">
                                      {installation.diretriz_altura_cm && `Altura: ${installation.diretriz_altura_cm}cm`}
                                      {installation.diretriz_altura_cm && installation.diretriz_dist_batente_cm && " • "}
                                      {installation.diretriz_dist_batente_cm && `Distância do batente: ${installation.diretriz_dist_batente_cm}cm`}
                                    </div>
                                  )}
                                  {installation.observacoes && installation.observacoes.trim() !== "" && (
                                    <div className="bg-warning/10 border border-warning/20 p-3 rounded-md ml-8">
                                      <p className="text-sm"><strong>Observação:</strong> {installation.observacoes}</p>
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
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          )}
        </div>
      </div>
    );
  };

  const renderInfoSection = () => (
    <div className="space-y-6">
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
    </div>
  );

  const renderRelatoriosSection = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerar Relatórios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Gere relatórios completos com classificação automática: Pendências, Próximos Passos e Instaladas.
            </p>
            <div className="flex gap-4 flex-wrap">
              <Button onClick={() => handleGenerateReport('pdf')}>
                <Download className="h-4 w-4 mr-2" />
                Gerar Relatório PDF
              </Button>
              <Button variant="outline" onClick={() => handleGenerateReport('xlsx')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Gerar Relatório Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderOrcamentosSection = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Orçamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Seção de Orçamentos</h3>
            <p className="text-muted-foreground">
              Esta seção será implementada em versões futuras do sistema.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

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
        {/* Navigation Menu */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={currentSection === 'info' ? 'default' : 'outline'}
              onClick={() => navigate(`/projeto/${id}`)}
            >
              Informações
            </Button>
            <Button 
              variant={currentSection === 'pecas' ? 'default' : 'outline'}
              onClick={() => navigate(`/projeto/${id}/pecas`)}
            >
              Peças
            </Button>
            <Button 
              variant={currentSection === 'relatorios' ? 'default' : 'outline'}
              onClick={() => navigate(`/projeto/${id}/relatorios`)}
            >
              Relatórios
            </Button>
            <Button 
              variant={currentSection === 'orcamentos' ? 'default' : 'outline'}
              onClick={() => navigate(`/projeto/${id}/orcamentos`)}
            >
              Orçamentos
            </Button>
            
            {/* Import button - only shows import functionality */}
            <Button variant="outline" disabled={isImporting} className="ml-auto">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? "Importando..." : "Importar Planilha"}
            </Button>
          </div>
        </div>

        {/* Content based on current section */}
        {currentSection === 'info' && renderInfoSection()}
        {currentSection === 'pecas' && renderPecasSection()}
        {currentSection === 'relatorios' && renderRelatoriosSection()}
        {currentSection === 'orcamentos' && renderOrcamentosSection()}
      </div>

      {/* Installation Detail Modal */}
      {selectedInstallation && (
        <InstallationDetailModalNew
          installation={selectedInstallation}
          isOpen={!!selectedInstallation}
          onClose={() => setSelectedInstallation(null)}
          onUpdate={() => setInstallations(storage.getInstallations(project.id))}
        />
      )}
    </div>
  );
}