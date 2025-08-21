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
  Settings, Search, FileSpreadsheet, RefreshCw, Plus, Edit, ExternalLink 
} from "lucide-react";
import { Project, Installation, ProjectReport } from "@/types";
import { storage } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { InstallationDetailModalNew } from "@/components/installation-detail-modal-new";
import { AddInstallationModal } from "@/components/add-installation-modal";
import { EditProjectModal } from "@/components/edit-project-modal";
import { importExcelFile } from "@/lib/excel-import";
import { StorageBar } from "@/components/storage-bar";
import { calculateReportSections, calculatePavimentoSummary } from "@/lib/reports-new";
import { FileUpload } from "@/components/file-upload";

export default function ProjectDetailNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [project, setProject] = useState<Project | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [reports, setReports] = useState<ProjectReport[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "installed" | "pending">("all");
  const [pavimentoFilter, setPavimentoFilter] = useState<string>("all");
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedInterlocutor, setSelectedInterlocutor] = useState<'cliente' | 'fornecedor'>('cliente');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportFilter, setReportFilter] = useState<'all' | 'pendentes' | 'emAndamento' | 'instalados'>('all');
  const [reportPavimentoFilter, setReportPavimentoFilter] = useState<string>('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    loadProjectData();
  }, [id, navigate]);

  const loadProjectData = async () => {
    if (!id) return;
    
    const projects = await storage.getProjects();
    const projectData = projects.find(p => p.id === id);
    if (!projectData) {
      navigate('/');
      return;
    }
    
    setProject(projectData);
    const projectInstallations = await storage.getInstallationsByProject(id);
    const projectReports = await storage.getReports();
    setInstallations(projectInstallations);
    setReports(projectReports);
  };

  const handleProjectUpdated = (updatedProject: Project) => {
    setProject(updatedProject);
  };

  if (!project) return null;

  // Determine current section based on route
  const currentSection = location.pathname.includes('/pecas') ? 'pecas' : 
                        location.pathname.includes('/relatorios') ? 'relatorios' :
                        location.pathname.includes('/orcamentos') ? 'orcamentos' :
                        location.pathname.includes('/contatos') ? 'contatos' :
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

  const toggleInstallation = async (installationId: string) => {
    const installation = installations.find(i => i.id === installationId);
    if (!installation) return;

    const updated = await storage.upsertInstallation({
      ...installation,
      installed: !installation.installed
    });

    if (updated) {
      const updatedInstallations = await storage.getInstallationsByProject(project.id);
      setInstallations(updatedInstallations);
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

      // Import installations one by one using the compatibility alias
      const results = [];
      for (const installation of result.data) {
        const result = await storage.upsertInstallation({ ...installation, project_id: project.id });
        results.push(result);
      }
      const importResult = { summary: {}, data: results };
      const updatedInstallations = await storage.getInstallationsByProject(project.id);
      setInstallations(updatedInstallations);
      
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

  // Remove this old function since we have the new implementation

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
            <div className="flex items-center justify-between">
              <CardTitle>Informações Básicas</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsEditModalOpen(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
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
            {project.project_files_link && (
              <div>
                <Label>Link dos Arquivos do Projeto</Label>
                <div className="flex gap-2">
                  <Input value={project.project_files_link} readOnly />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open(project.project_files_link, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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

  const renderRelatoriosSection = () => {
    const handleGenerateNewReport = async (format: 'pdf' | 'xlsx') => {
      setIsGenerating(true);
      try {
        const { generatePDFReport, generateXLSXReport, generateFileName } = await import('@/lib/reports-new');
        
        const versions = await Promise.all(
          installations.map(installation => storage.getItemVersions(installation.id))
        ).then(results => results.flat());

        const reportData = {
          project,
          installations,
          versions,
          generatedBy: project.owner,
          generatedAt: new Date().toISOString(),
          interlocutor: selectedInterlocutor
        };

        let blob: Blob;
        if (format === 'pdf') {
          blob = await generatePDFReport(reportData);
        } else {
          blob = await generateXLSXReport(reportData);
        }

        // Download file
        const fileName = generateFileName(project, selectedInterlocutor, format);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Calculate totals
        const { calculateReportSections } = await import('@/lib/reports-new');
        const sections = calculateReportSections(reportData);
        const totals = {
          pendentes: sections.pendencias.length,
          instalados: sections.concluidas.length,
          andamento: sections.emAndamento.length + sections.emRevisao.length
        };

        // Save to history
        const newReport = await storage.saveReport({
          project_id: project.id,
          interlocutor: selectedInterlocutor,
          generated_by: project.owner,
          generated_at: new Date().toISOString(),
          arquivo_pdf: format === 'pdf' ? blob : undefined,
          arquivo_xlsx: format === 'xlsx' ? blob : undefined,
          totais: totals
        });

        setReports(prev => [newReport, ...prev]);

        toast({
          title: "Relatório gerado",
          description: `Relatório ${format.toUpperCase()} para ${selectedInterlocutor} foi baixado com sucesso`,
        });
      } catch (error) {
        toast({
          title: "Erro na geração",
          description: "Erro ao gerar relatório",
          variant: "destructive"
        });
      } finally {
        setIsGenerating(false);
      }
    };

    return (
      <div className="space-y-6">
        {/* 1. Gerar Relatórios */}
        <Card>
          <CardHeader>
            <CardTitle>Gerar Relatórios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Label>Selecionar Interlocutor</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant={selectedInterlocutor === 'cliente' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedInterlocutor('cliente')}
                  >
                    Cliente
                  </Button>
                  <Button
                    variant={selectedInterlocutor === 'fornecedor' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedInterlocutor('fornecedor')}
                  >
                    Fornecedor
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground mb-4">
                  Gere relatórios específicos para {selectedInterlocutor} com classificação automática: Pendências, Concluídas, Em Revisão e {selectedInterlocutor === 'fornecedor' ? 'Aguardando Instalação' : 'Em Andamento'}.
                </p>
                <div className="flex gap-4 flex-wrap">
                  <Button 
                    onClick={() => handleGenerateNewReport('pdf')}
                    disabled={isGenerating}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isGenerating ? 'Gerando...' : 'Gerar Relatório PDF'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleGenerateNewReport('xlsx')}
                    disabled={isGenerating}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    {isGenerating ? 'Gerando...' : 'Gerar Relatório Excel'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Histórico de Relatórios */}
        {reports.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Relatórios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reports
                  .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())
                  .map((report) => {
                    const date = new Date(report.generated_at);
                    
                    return (
                      <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col gap-1">
                            {report.arquivo_pdf && (
                              <div className="flex items-center gap-2">
                                <Download className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">PDF</span>
                              </div>
                            )}
                            {report.arquivo_xlsx && (
                              <div className="flex items-center gap-2">
                                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Excel</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium capitalize">{report.interlocutor}</span>
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {report.totais ? `${report.totais.pendentes}P | ${report.totais.instalados}I | ${report.totais.andamento}A` : ''}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {date.toLocaleDateString('pt-BR')} às {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - por {report.generated_by}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {report.arquivo_pdf && (
                            <Button variant="ghost" size="sm" onClick={() => {
                              const url = URL.createObjectURL(report.arquivo_pdf!);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `Relatorio-${project.name}-${date.toISOString().split('T')[0]}-${report.interlocutor.toUpperCase()}.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}>
                              <Download className="h-4 w-4" />
                              PDF
                            </Button>
                          )}
                          {report.arquivo_xlsx && (
                            <Button variant="ghost" size="sm" onClick={() => {
                              const url = URL.createObjectURL(report.arquivo_xlsx!);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `Relatorio-${project.name}-${date.toISOString().split('T')[0]}-${report.interlocutor.toUpperCase()}.xlsx`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}>
                              <FileSpreadsheet className="h-4 w-4" />
                              Excel
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {installations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Visão Geral - {selectedInterlocutor === 'cliente' ? 'Cliente' : 'Fornecedor'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Main Storage Bar */}
                <div className="space-y-4">
                  {(() => {
                    const reportData = {
                      project,
                      installations,
                      versions: [],
                      generatedBy: 'Usuario',
                      generatedAt: new Date().toISOString(),
                      interlocutor: selectedInterlocutor
                    };
                    const sections = calculateReportSections(reportData);
                    const pavimentoSummary = calculatePavimentoSummary(sections);
                    
                    return (
                      <>
                        <StorageBar
                          instalados={sections.concluidas.length}
                          pendentes={sections.pendencias.length}
                          emAndamento={sections.emAndamento.length}
                          title="Distribuição Geral"
                          onSegmentClick={(segment) => {
                            setReportFilter(segment);
                            setReportPavimentoFilter('all');
                          }}
                        />
                        
                        {/* Pavimento Summary */}
                        {pavimentoSummary.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium">Resumo por Pavimento</h4>
                            <div className="grid gap-3 max-h-64 overflow-y-auto">
                              {pavimentoSummary.map((pav) => (
                                <StorageBar
                                  key={pav.pavimento}
                                  instalados={pav.instalados}
                                  pendentes={pav.pendentes}
                                  emAndamento={pav.emAndamento}
                                  title={pav.pavimento}
                                  size="mini"
                                  onSegmentClick={(segment) => {
                                    setReportFilter(segment);
                                    setReportPavimentoFilter(pav.pavimento);
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Active Filters */}
                        {(reportFilter !== 'all' || reportPavimentoFilter !== 'all') && (
                          <div className="flex gap-2 flex-wrap">
                            <span className="text-sm text-muted-foreground">Filtros ativos:</span>
                            {reportFilter !== 'all' && (
                              <Badge variant="secondary" className="cursor-pointer" onClick={() => setReportFilter('all')}>
                                {reportFilter === 'instalados' ? 'Instalados' : 
                                 reportFilter === 'pendentes' ? 'Pendentes' : 'Em Andamento'} ×
                              </Badge>
                            )}
                            {reportPavimentoFilter !== 'all' && (
                              <Badge variant="secondary" className="cursor-pointer" onClick={() => setReportPavimentoFilter('all')}>
                                {reportPavimentoFilter} ×
                              </Badge>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => {
                              setReportFilter('all');
                              setReportPavimentoFilter('all');
                            }}>
                              Limpar filtros
                            </Button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 4. Filtros ativos - Itens Filtrados */}

        {/* Filtered Items List */}
        {(reportFilter !== 'all' || reportPavimentoFilter !== 'all') && (
          <Card>
            <CardHeader>
              <CardTitle>Itens Filtrados</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const reportData = {
                  project,
                  installations,
                  versions: [],
                  generatedBy: 'Usuario',
                  generatedAt: new Date().toISOString(),
                  interlocutor: selectedInterlocutor
                };
                const sections = calculateReportSections(reportData);
                
                let filteredItems: Installation[] = [];
                if (reportFilter === 'instalados') filteredItems = sections.concluidas;
                else if (reportFilter === 'pendentes') filteredItems = sections.pendencias;
                else if (reportFilter === 'emAndamento') filteredItems = sections.emAndamento;
                else filteredItems = [...sections.concluidas, ...sections.pendencias, ...sections.emAndamento];
                
                if (reportPavimentoFilter !== 'all') {
                  filteredItems = filteredItems.filter(item => item.pavimento === reportPavimentoFilter);
                }
                
                if (filteredItems.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum item encontrado com os filtros selecionados.
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-2">
                    {filteredItems.map((item) => (
                      <div 
                        key={item.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedInstallation(item)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            sections.concluidas.includes(item) ? 'bg-green-400' :
                            sections.pendencias.includes(item) ? 'bg-orange-400' :
                            'bg-gray-400'
                          }`} />
                          <div>
                            <div className="font-medium">
                              {item.pavimento} - {item.tipologia} {item.codigo}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {item.descricao}
                            </div>
                            {(item.observacoes || item.comentarios_fornecedor) && (
                              <div className="text-xs text-orange-600 mt-1">
                                {item.observacoes && `Obs: ${item.observacoes}`}
                                {item.observacoes && item.comentarios_fornecedor && ' | '}
                                {item.comentarios_fornecedor && `Comentário: ${item.comentarios_fornecedor}`}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.installed && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {item.photos.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {item.photos.length} foto{item.photos.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderOrcamentosSection = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestão de Arquivos de Orçamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Faça upload e gerencie os arquivos relacionados aos orçamentos do projeto. Você pode arrastar e soltar os arquivos ou usar o botão para navegar e selecionar.
          </p>
          
          <FileUpload 
            projectId={project.id}
            acceptedTypes={['.pdf', '.xlsx', '.xls', '.doc', '.docx', '.png', '.jpg', '.jpeg']}
            maxFileSize={10}
            onFilesChange={(files) => {
              // Handle files change if needed
              console.log('Files updated:', files);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );

  const renderContatosSection = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contatos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-lg font-semibold mb-2">Sistema de Contatos Completo</div>
            <p className="text-muted-foreground mb-4">
              Acesse a página dedicada de contatos para gerenciar clientes, obra e fornecedores.
            </p>
            <Button onClick={() => navigate(`/projeto/${id}/contatos`)}>
              Gerenciar Contatos
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Calcular contadores de contatos
  const [contadores, setContadores] = useState({ cliente: 0, obra: 0, fornecedor: 0, total: 0 });
  
  useEffect(() => {
    const loadContadores = async () => {
      const allContacts = await storage.getContacts();
      const contatos = allContacts.filter(c => c.projetoId === id);
      setContadores({
        cliente: contatos.filter(c => c.tipo === 'cliente').length,
        obra: contatos.filter(c => c.tipo === 'obra').length,
        fornecedor: contatos.filter(c => c.tipo === 'fornecedor').length,
        total: contatos.length
      });
    };
    if (id) loadContadores();
  }, [id]);

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
            <Button 
              variant={currentSection === 'contatos' ? 'default' : 'outline'}
              onClick={() => navigate(`/projeto/${id}/contatos`)}
            >
              Contatos {contadores.total > 0 && `(${contadores.total})`}
            </Button>
            
            {/* Import button - only shows import functionality */}
            <div className="relative ml-auto">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onClick={(e) => e.stopPropagation()}
              />
              <Button variant="outline" disabled={isImporting} className="pointer-events-none">
                <Upload className="h-4 w-4 mr-2" />
                {isImporting ? "Importando..." : "Importar Planilha"}
              </Button>
            </div>

            {/* Add Installation button - only shows for pecas section */}
            {currentSection === 'pecas' && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar ou Atualizar Peça
              </Button>
            )}
          </div>
        </div>

        {/* Content based on current section */}
        {currentSection === 'info' && renderInfoSection()}
        {currentSection === 'pecas' && renderPecasSection()}
        {currentSection === 'relatorios' && renderRelatoriosSection()}
        {currentSection === 'orcamentos' && renderOrcamentosSection()}
        {currentSection === 'contatos' && renderContatosSection()}
      </div>

      {/* Add Installation Modal */}
      <AddInstallationModal
        projectId={id!}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onUpdate={async () => {
          const updatedInstallations = await storage.getInstallationsByProject(id!);
          setInstallations(updatedInstallations);
        }}
      />

      {/* Installation Detail Modal */}
      {selectedInstallation && (
        <InstallationDetailModalNew
          installation={selectedInstallation}
          isOpen={!!selectedInstallation}
          onClose={() => setSelectedInstallation(null)}
          onUpdate={async () => {
            const updatedInstallations = await storage.getInstallationsByProject(project.id);
            setInstallations(updatedInstallations);
          }}
        />
      )}

      {/* Edit Project Modal */}
      <EditProjectModal
        project={project}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onProjectUpdated={handleProjectUpdated}
      />
    </div>
  );
}