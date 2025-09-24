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
import { BulkOperationPanel } from "@/components/bulk-operations/BulkOperationPanel";
import { importExcelFile } from "@/lib/excel-import";
import { StorageBar } from "@/components/storage-bar";
import { calculateReportSections, calculatePavimentoSummary } from "@/lib/reports-new";
import { FileUpload } from "@/components/file-upload";
import { FileManager } from "@/components/file-manager/FileManager";
import { CollaborationPanel } from "@/components/collaboration/CollaborationPanel";
import { ProjectVersioning } from "@/components/versioning/ProjectVersioning";
import { AutomaticBackup } from "@/components/backup/AutomaticBackup";
import { BudgetTab } from "@/components/project/BudgetTab";
import { logger } from '@/services/logger';
import { ReportCustomizationModal, ReportConfig } from "@/components/reports/ReportCustomizationModal";
import { ReportShareModal } from "@/components/reports/ReportShareModal";

export default function ProjectDetailNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [project, setProject] = useState<Project | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedInstallations, setSelectedInstallations] = useState<string[]>([]);
  const [reports, setReports] = useState<ProjectReport[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "installed" | "pending">("all");
  const [itemStatusFilter, setItemStatusFilter] = useState<"all" | "ativo" | "on hold" | "cancelado">("all");
  const [pavimentoFilter, setPavimentoFilter] = useState<string>("all");
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedInterlocutor, setSelectedInterlocutor] = useState<'cliente' | 'fornecedor'>('cliente');
  const [showReportCustomization, setShowReportCustomization] = useState(false);
  const [showReportShare, setShowReportShare] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<{ blob: Blob; format: 'pdf' | 'xlsx'; config: ReportConfig } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportFilter, setReportFilter] = useState<'all' | 'pendentes' | 'emAndamento' | 'instalados'>('all');
  const [reportPavimentoFilter, setReportPavimentoFilter] = useState<string>('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Calcular contadores de contatos
  const [contadores, setContadores] = useState({ cliente: 0, obra: 0, fornecedor: 0, total: 0 });

  useEffect(() => {
    loadProjectData();
  }, [id, navigate]);

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
    const projectReports = await (storage as any).getReports();
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
                        location.pathname.includes('/arquivos') ? 'arquivos' :
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
    
    const matchesItemStatus = itemStatusFilter === "all" || 
                             installation.status === itemStatusFilter;
                          
    const matchesPavimento = pavimentoFilter === "all" || installation.pavimento === pavimentoFilter;
    
    return matchesSearch && matchesStatus && matchesItemStatus && matchesPavimento;
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

      // Import installations - handle the data structure properly
      const results = [];
      for (const importData of result.data) {
        // importData should have structure like { pavimento: string, items: Installation[] }
        if (importData.items && Array.isArray(importData.items)) {
          for (const installation of importData.items) {
            const installationData = {
              ...installation,
              id: installation.id || `install_${Date.now()}_${Math.random()}`,
              project_id: project.id,
              pavimento: importData.pavimento, // IMPORTANTE: Atribuir o pavimento do nome da aba
              updated_at: new Date().toISOString(),
              revisado: false
            };
            const installResult = await storage.upsertInstallation(installationData);
            results.push(installResult);
          }
        }
      }
      const importResult = { summary: { total: results.length }, data: results };
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-primary">{installations.length}</div>
                <div className="text-sm text-muted-foreground">Total de Peças</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-green-600">{completedInstallations}</div>
                <div className="text-sm text-muted-foreground">Instaladas</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-orange-600">{pendingInstallations}</div>
                <div className="text-sm text-muted-foreground">Pendentes</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

            <select
              value={itemStatusFilter}
              onChange={(e) => setItemStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="all">Todos os Status</option>
              <option value="ativo">Ativo</option>
              <option value="pendente">Pendente</option>
              <option value="on hold">On Hold</option>
              <option value="cancelado">Cancelado</option>
            </select>
            
            <Button variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar
            </Button>
          </div>
        </div>

        {/* Bulk Operations Panel */}
        {selectedInstallations.length > 0 && (
          <BulkOperationPanel
            items={installations.filter(i => selectedInstallations.includes(i.id))}
            itemType="installations"
            onItemsChange={(updatedItems) => {
              loadProjectData();
              setSelectedInstallations([]);
            }}
          />
        )}

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
                                       checked={selectedInstallations.includes(installation.id)}
                                       onChange={(e) => {
                                         e.stopPropagation();
                                         if (e.target.checked) {
                                           setSelectedInstallations(prev => [...prev, installation.id]);
                                         } else {
                                           setSelectedInstallations(prev => prev.filter(id => id !== installation.id));
                                         }
                                       }}
                                       className="h-4 w-4 rounded border-2 border-muted-foreground"
                                     />
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
                                   {/* Status Badge - only show if not ativo */}
                                   {installation.status && installation.status !== 'ativo' && (
                                     <Badge 
                                       className={
                                         installation.status === 'pendente'
                                           ? "bg-orange-100 text-orange-800 border-orange-300"
                                           : installation.status === 'on hold'
                                           ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                           : installation.status === 'cancelado'
                                           ? "bg-red-100 text-red-800 border-red-300"
                                           : ""
                                       }
                                     >
                                       {installation.status}
                                     </Badge>
                                   )}
                                   {installation.pendencia_tipo && (
                                     <Badge 
                                       variant="outline" 
                                       className={
                                         installation.pendencia_tipo === 'cliente' 
                                           ? "border-red-300 bg-red-50 text-red-700"
                                           : installation.pendencia_tipo === 'fornecedor'
                                           ? "border-yellow-300 bg-yellow-50 text-yellow-700"
                                           : "border-blue-300 bg-blue-50 text-blue-700"
                                       }
                                     >
                                       Pendência: {installation.pendencia_tipo.charAt(0).toUpperCase() + installation.pendencia_tipo.slice(1)}
                                     </Badge>
                                   )}
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
              <Label>Estimativa de Tempo de Instalação (dias úteis)</Label>
              <Input 
                type="number"
                value={(project as any).installation_time_estimate_days || ''} 
                readOnly 
                placeholder="Ex: 15 dias"
              />
            </div>
            <div>
              <Label>Data de Entrega (Finalização da Instalação)</Label>
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
            {project.suppliers && project.suppliers.map((supplier, index) => (
              <div key={index} className="p-3 bg-muted rounded-md">
                {supplier}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Collaboration Panel */}
      <CollaborationPanel 
        projectId={project.id} 
        isOwner={true}
        onCollaboratorAdded={() => {
          // Trigger real-time event
          toast({
            title: 'Colaborador adicionado',
            description: 'Novo colaborador foi adicionado ao projeto'
          });
        }}
      />
      
      <ProjectVersioning 
        project={project}
        installations={installations}
        onVersionRestored={loadProjectData}
      />
      
      <AutomaticBackup 
        project={project}
      />
    </div>
  );

  const handleGenerateCustomReport = async (config: ReportConfig, format: 'pdf' | 'xlsx'): Promise<Blob> => {
    const { generatePDFReport, generateXLSXReport } = await import('@/lib/reports-new');
    
    const versions = await Promise.all(
      installations.map(installation => storage.getItemVersions(installation.id))
    ).then(results => results.flat());

    // Filter installations based on config
    let filteredInstallations = installations;
    
    // Apply filters based on selected sections
    if (!config.sections.pendencias && !config.sections.concluidas && 
        !config.sections.emRevisao && !config.sections.emAndamento) {
      // If no sections selected, include all
      filteredInstallations = installations;
    } else {
      // Filter based on selected sections (this is a simplified approach)
      // In a real implementation, you'd want more sophisticated filtering
      filteredInstallations = installations.filter(installation => {
        // This is a simplified logic - you might want to implement more complex filtering
        return true; // For now, include all installations
      });
    }

    const reportData = {
      project,
      installations: filteredInstallations,
      versions,
      generatedBy: project.owner || 'Sistema',
      generatedAt: new Date().toISOString(),
      interlocutor: selectedInterlocutor,
      customConfig: config // Pass custom config for advanced filtering
    };

    if (format === 'pdf') {
      return await generatePDFReport(reportData);
    } else {
      return await generateXLSXReport(reportData);
    }
  };

  const handleShareReport = async (blob: Blob, format: 'pdf' | 'xlsx', config: ReportConfig) => {
    try {
      // Save to history
      const { calculateReportSections } = await import('@/lib/reports-new');
      const versions = await Promise.all(
        installations.map(installation => storage.getItemVersions(installation.id))
      ).then(results => results.flat());

      const reportData = {
        project,
        installations,
        versions,
        generatedBy: project.owner || 'Sistema',
        generatedAt: new Date().toISOString(),
        interlocutor: selectedInterlocutor
      };

      const sections = calculateReportSections(reportData);
      const totals = {
        pendentes: sections.pendencias.length,
        instalados: sections.concluidas.length,
        andamento: sections.emAndamento.length + sections.emRevisao.length
      };

      const newReport = await (storage as any).saveReport({
        project_id: project.id,
        interlocutor: selectedInterlocutor,
        generated_by: project.owner || 'Sistema',
        generated_at: new Date().toISOString(),
        arquivo_pdf: format === 'pdf' ? blob : undefined,
        arquivo_xlsx: format === 'xlsx' ? blob : undefined,
        totais: totals
      });

      setReports(prev => [newReport, ...prev]);

      // Open share modal
      setGeneratedReport({ blob, format, config });
      setShowReportShare(true);
      setShowReportCustomization(false);

      toast({
        title: "Relatório gerado",
        description: `Relatório ${format.toUpperCase()} para ${selectedInterlocutor} criado com sucesso`,
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Erro ao salvar relatório no histórico",
        variant: "destructive"
      });
    }
  };

  const renderRelatoriosSection = () => {

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
                  Gere relatórios personalizados para {selectedInterlocutor} com opções avançadas de personalização e compartilhamento.
                </p>
                <div className="flex gap-4 flex-wrap">
                  <Button 
                    onClick={() => setShowReportCustomization(true)}
                    disabled={isGenerating}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isGenerating ? 'Gerando...' : 'Personalizar e Gerar'}
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
                          {item.photos && item.photos.length > 0 && (
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
    <BudgetTab projectId={project.id} projectName={project.name} />
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
        <div className="mb-6">
          {/* Mobile Navigation - Dropdown */}
          <div className="block sm:hidden">
            <select 
              value={currentSection}
              onChange={(e) => {
                const section = e.target.value;
                const path = section === 'info' ? `/projeto/${id}` : `/projeto/${id}/${section}`;
                navigate(path);
              }}
              className="w-full p-3 border border-input bg-background rounded-md text-sm"
            >
              <option value="info">Informações</option>
              <option value="pecas">Peças</option>
              <option value="relatorios">Relatórios</option>
              <option value="orcamentos">Orçamentos</option>
              <option value="arquivos">Arquivos</option>
              <option value="contatos">Contatos {contadores.total > 0 ? `(${contadores.total})` : ''}</option>
            </select>
          </div>

          {/* Desktop Navigation - Buttons */}
          <div className="hidden sm:block">
            <div className="flex flex-wrap gap-2">
              <Button 
                variant={currentSection === 'info' ? 'default' : 'outline'}
                onClick={() => navigate(`/projeto/${id}`)}
                size="sm"
              >
                Informações
              </Button>
              <Button 
                variant={currentSection === 'pecas' ? 'default' : 'outline'}
                onClick={() => navigate(`/projeto/${id}/pecas`)}
                size="sm"
              >
                Peças
              </Button>
              <Button 
                variant={currentSection === 'relatorios' ? 'default' : 'outline'}
                onClick={() => navigate(`/projeto/${id}/relatorios`)}
                size="sm"
              >
                Relatórios
              </Button>
              <Button 
                variant={currentSection === 'orcamentos' ? 'default' : 'outline'}
                onClick={() => navigate(`/projeto/${id}/orcamentos`)}
                size="sm"
              >
                Orçamentos
              </Button>
              <Button 
                variant={currentSection === 'arquivos' ? 'default' : 'outline'}
                onClick={() => navigate(`/projeto/${id}/arquivos`)}
                size="sm"
              >
                Arquivos
              </Button>
              <Button 
                variant={currentSection === 'contatos' ? 'default' : 'outline'}
                onClick={() => navigate(`/projeto/${id}/contatos`)}
                size="sm"
              >
                Contatos {contadores.total > 0 && `(${contadores.total})`}
              </Button>
            </div>
          </div>
          
          {/* Action Buttons Row */}
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            {/* Import button */}
            <div className="relative">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onClick={(e) => e.stopPropagation()}
              />
              <Button variant="outline" disabled={isImporting} className="pointer-events-none w-full sm:w-auto">
                <Upload className="h-4 w-4 mr-2" />
                {isImporting ? "Importando..." : "Importar Planilha"}
              </Button>
            </div>

            {/* Add Installation button - only shows for pecas section */}
            {currentSection === 'pecas' && (
              <Button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar ou Atualizar Peça
              </Button>
            )}

            {/* Edit Project button for mobile */}
            <Button 
              variant="outline" 
              onClick={() => setIsEditModalOpen(true)}
              className="sm:hidden w-full"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar Projeto
            </Button>
          </div>
        </div>

        {/* Content based on current section */}
        {currentSection === 'info' && renderInfoSection()}
        {currentSection === 'pecas' && renderPecasSection()}
        {currentSection === 'relatorios' && renderRelatoriosSection()}
        {currentSection === 'orcamentos' && renderOrcamentosSection()}
        {currentSection === 'arquivos' && <FileManager projectId={project.id} />}
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

      {/* Report Customization Modal */}
      <ReportCustomizationModal
        isOpen={showReportCustomization}
        onClose={() => setShowReportCustomization(false)}
        onGenerate={handleGenerateCustomReport}
        onShare={handleShareReport}
        project={project}
        installations={installations}
        interlocutor={selectedInterlocutor}
      />

      {/* Report Share Modal */}
      {generatedReport && (
        <ReportShareModal
          isOpen={showReportShare}
          onClose={() => {
            setShowReportShare(false);
            setGeneratedReport(null);
          }}
          blob={generatedReport.blob}
          format={generatedReport.format}
          config={generatedReport.config}
          project={project}
          interlocutor={selectedInterlocutor}
        />
      )}
    </div>
  );
}