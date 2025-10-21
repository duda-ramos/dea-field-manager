import { useState, useEffect, useMemo, useRef, lazy, Suspense, useCallback, memo } from "react";
import { FixedSizeList as VirtualList } from 'react-window';
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useUndo } from "@/hooks/useUndo";
import { showUndoToast } from "@/lib/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatsCard } from "@/components/ui/stats-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  ArrowLeft, Upload, CheckCircle2, Clock, 
  Search, FileSpreadsheet, RefreshCw, Plus, Edit, ExternalLink,
  ChevronDown, Filter, Menu, Home, FileText, Calculator, Archive, Users, UserCog, Loader2
} from "lucide-react";
import { Project, Installation, ItemVersion } from "@/types";
import { storage } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuthContext';
import { logger } from '@/lib/logger';
import { EnhancedImageUpload } from "@/components/image-upload";
import { importExcelFile, syncImportedPhotosToGallery } from "@/lib/excel-import";
import { StorageBar } from "@/components/storage-bar";
import { FileUpload } from "@/components/file-upload";
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingBoundary } from '@/components/loading-boundary';
import { 
  ProjectErrorFallback, 
  UploadErrorFallback, 
  ReportErrorFallback
} from '@/components/error-fallbacks';
import type { ReportConfig } from "@/components/reports/ReportCustomizationModal.types";
import { CardLoadingState } from "@/components/ui/loading-spinner";

// Lazy load heavy components - Modals and Panels (loaded on demand when user interacts)
const InstallationDetailModalNew = lazy(() => import("@/components/installation-detail-modal-new").then(mod => ({ default: mod.InstallationDetailModalNew })));
const AddInstallationModal = lazy(() => import("@/components/add-installation-modal").then(mod => ({ default: mod.AddInstallationModal })));
const EditProjectModal = lazy(() => import("@/components/edit-project-modal").then(mod => ({ default: mod.EditProjectModal })));
const CollaborationPanel = lazy(() => import("@/components/collaboration/CollaborationPanel").then(mod => ({ default: mod.CollaborationPanel })));
const BudgetTab = lazy(() => import("@/components/project/BudgetTab").then(mod => ({ default: mod.BudgetTab })));
const ReportCustomizationModal = lazy(() => import("@/components/reports/ReportCustomizationModal").then(mod => ({ default: mod.ReportCustomizationModal })));
const ReportShareModal = lazy(() => import("@/components/reports/ReportShareModal").then(mod => ({ default: mod.ReportShareModal })));
const ReportHistoryPanel = lazy(() => import("@/components/reports/ReportHistoryPanel").then(mod => ({ default: mod.ReportHistoryPanel })));
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ItemStatusFilterValue = 'all' | NonNullable<Installation['status']>;

const ITEM_STATUS_OPTIONS: Array<{ value: NonNullable<Installation['status']>; label: string }> = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'on hold', label: 'Em espera' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'pendente', label: 'Pendente' },
];

type InstallationCardProps = {
  installation: Installation;
  isSelected: boolean;
  onSelectChange: (id: string, selected: boolean) => void;
  onToggleInstallation: (id: string) => void;
  onOpenDetails: (installation: Installation) => void;
  isDetailsOpen: boolean;
};

const InstallationCard = memo(function InstallationCard({
  installation,
  isSelected,
  onSelectChange,
  onToggleInstallation,
  onOpenDetails,
  isDetailsOpen,
}: InstallationCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow" role="article" aria-label={`Instalação ${installation.codigo} - ${installation.descricao}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelectChange(installation.id, e.target.checked)}
              className="w-4 h-4 mt-1 shrink-0"
              aria-label={`Selecionar instalação ${installation.codigo} - ${installation.descricao}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-2 mb-2 sm:flex-row sm:items-start">
                <div className="text-xs px-1 py-1 border border-input bg-background rounded text-left leading-tight min-w-0 break-words shrink-0 w-fit" aria-label={`Código ${installation.codigo}`}>
                  {installation.codigo}
                </div>
                <h4 className="font-medium text-sm break-words text-left min-w-0">{installation.descricao}</h4>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pavimento:</span>
                  <span className="font-medium">{installation.pavimento}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge 
                    variant={installation.status === "ativo" ? "default" : 
                             installation.status === "on hold" ? "secondary" : 
                             installation.status === "cancelado" ? "destructive" : "outline"}
                    className="text-xs"
                  >
                    {installation.status}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant={installation.installed ? "default" : "outline"}
              size="sm"
              onClick={() => onToggleInstallation(installation.id)}
              className="flex-1 gap-2"
              aria-label={installation.installed ? `Marcar ${installation.codigo} como pendente` : `Marcar ${installation.codigo} como instalado`}
              aria-pressed={installation.installed}
            >
              {installation.installed ? (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Instalado
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  Pendente
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenDetails(installation)}
              className="shrink-0"
              aria-label={`Abrir fotos da instalação ${installation.codigo}`}
              aria-expanded={isDetailsOpen}
              aria-haspopup="dialog"
              title="Abrir fotos"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          {installation.observacoes && (
            <div className="text-sm">
              <span className="text-muted-foreground">Observações:</span>
              <div className="text-sm bg-muted/50 rounded p-2 mt-1">
                {installation.observacoes}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export default function ProjectDetailNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { addAction, undo } = useUndo();
  
  const [project, setProject] = useState<Project | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedInstallations, setSelectedInstallations] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "installed" | "pending">("all");
  const [pavimentoFilter, setPavimentoFilter] = useState<string>("all");
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReportCustomization, setShowReportCustomization] = useState(false);
  const [showReportShare, setShowReportShare] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<{ blob: Blob; format: 'pdf' | 'xlsx'; config: ReportConfig } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [contadores, setContadores] = useState({ cliente: 0, obra: 0, fornecedor: 0, total: 0 });
  const [lastReportDate, setLastReportDate] = useState<string | null>(null);
  const [itemStatusFilter, setItemStatusFilter] = useState<ItemStatusFilterValue>('all');
  const installationToggleQueue = useRef<Map<string, Promise<void>>>(new Map());

  const enqueueInstallationUpdate = (
    installationId: string,
    operation: () => Promise<void>
  ) => {
    const queue = installationToggleQueue.current;
    const previous = queue.get(installationId) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(operation);
    const cleanupPromise: Promise<void> = next.finally(() => {
      if (queue.get(installationId) === cleanupPromise) {
        queue.delete(installationId);
      }
    });
    queue.set(installationId, cleanupPromise);
    return cleanupPromise;
  };

  useEffect(() => {
    loadProjectData();
    loadLastReportDate();
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
    
    setIsLoadingData(true);
    try {
      const projects = await storage.getProjects();
      const projectData = projects.find(p => p.id === id);
      if (!projectData) {
        toast({
          title: "Projeto não encontrado",
          description: "O projeto que você está tentando acessar não existe.",
          variant: "destructive"
        });
        navigate('/');
        return;
      }
      
      setProject(projectData);
      const projectInstallations = await storage.getInstallationsByProject(id);
      setInstallations(projectInstallations);
    } catch (error) {
      logger.error('Erro ao carregar dados do projeto', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          projectId: id,
          userId: user?.id,
          operacao: 'loadProjectData',
          timestamp: new Date().toISOString()
        }
      });
      toast({
        title: "Erro ao carregar projeto",
        description: "Não foi possível carregar os dados do projeto. Tente novamente.",
        variant: "destructive"
      });
      navigate('/');
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadLastReportDate = async () => {
    if (!id) return;
    
    try {
      const reports = await storage.getReports(id);
      if (reports.length > 0) {
        // Reports are already sorted by date (most recent first)
        const lastReport = reports[0];
        const dateValue = lastReport.generatedAt || lastReport.generated_at;
        if (dateValue) {
          setLastReportDate(dateValue);
        }
      }
    } catch (error) {
      console.error('Error loading last report date:', error);
    }
  };

  const handleProjectUpdated = (updatedProject: Project) => {
    setProject(updatedProject);
  };

  // Calculate stats for info section - memoized to ensure updates when installations change
  const { completedInstallations, pendingInstallations, installationsWithObservations, progressPercentage } = useMemo(() => {
    const completed = installations.filter(i => i.installed).length;
    const pending = installations.length - completed;
    const withObservations = installations.filter(i => i.observacoes && i.observacoes.trim() !== "").length;
    const progress = installations.length > 0 ? (completed / installations.length) * 100 : 0;
    
    return {
      completedInstallations: completed,
      pendingInstallations: pending,
      installationsWithObservations: withObservations,
      progressPercentage: progress
    };
  }, [installations]);

  const pavimentos = useMemo(() => 
    Array.from(new Set(installations.map(i => i.pavimento))).sort(),
    [installations]
  );

  const filteredInstallations = useMemo(() => {
    return installations.filter(installation => {
      // Converter searchTerm para lowercase uma única vez
      const searchLower = searchTerm.toLowerCase();
      
      // Busca case-insensitive nos campos
      const matchesSearch = searchLower === '' || 
                            installation.descricao.toLowerCase().includes(searchLower) ||
                            installation.tipologia.toLowerCase().includes(searchLower) ||
                            String(installation.codigo).toLowerCase().includes(searchLower);
      
      const matchesStatus = statusFilter === "all" ||
                            (statusFilter === "installed" && installation.installed) ||
                            (statusFilter === "pending" && !installation.installed);

      const matchesItemStatus = itemStatusFilter === "all" ||
                               installation.status === itemStatusFilter;
                            
      const matchesPavimento = pavimentoFilter === "all" || installation.pavimento === pavimentoFilter;
      
      return matchesSearch && matchesStatus && matchesItemStatus && matchesPavimento;
    });
  }, [installations, searchTerm, statusFilter, itemStatusFilter, pavimentoFilter]);

  const isOwner = project?.user_id ? project.user_id === user?.id : true;

  const currentSection = location.pathname.includes('/pecas') ? 'pecas' : 
                        location.pathname.includes('/relatorios') ? 'relatorios' :
                        location.pathname.includes('/orcamentos') ? 'orcamentos' :
                        location.pathname.includes('/arquivos') ? 'arquivos' :
                        location.pathname.includes('/contatos') ? 'contatos' :
                        location.pathname.includes('/colaboracao') ? 'colaboracao' :
                        'info';


  const toggleInstallation = useCallback(async (installationId: string) => {
    if (!project) {
      toast({
        title: "Erro",
        description: "Projeto não carregado. Tente novamente.",
        variant: "destructive"
      });
      return;
    }

    let targetInstallation: Installation | undefined;
    let previousInstalled = false;
    let newInstalledState = false;

    setInstallations(prevInstallations => {
      const updatedInstallations = prevInstallations.map(inst => {
        if (inst.id === installationId) {
          targetInstallation = inst;
          previousInstalled = inst.installed;
          newInstalledState = !inst.installed;
          return { ...inst, installed: !inst.installed };
        }
        return inst;
      });

      return targetInstallation ? updatedInstallations : prevInstallations;
    });

    if (!targetInstallation) {
      return;
    }

    const installationSnapshot = targetInstallation;

    const persistToggle = async () => {
      try {
        const updated = await storage.upsertInstallation({
          ...installationSnapshot,
          installed: newInstalledState
        });

        // Add undo action only after persistence succeeds to avoid stale state
        addAction({
          type: 'UPDATE_INSTALLATION',
          description: updated.installed
            ? `Marcou "${installationSnapshot.descricao}" como instalado`
            : `Marcou "${installationSnapshot.descricao}" como pendente`,
          data: {
            installationId: installationSnapshot.id,
            previousInstalled
          },
          undo: async () => {
            setInstallations(prevInstallations =>
              prevInstallations.map(inst =>
                inst.id === installationSnapshot.id
                  ? { ...inst, installed: previousInstalled }
                  : inst
              )
            );

            try {
              await enqueueInstallationUpdate(installationSnapshot.id, async () => {
                await storage.upsertInstallation({
                  ...installationSnapshot,
                  installed: previousInstalled
                });
              });
            } catch (_error) {
              logger.error('Falha ao reverter estado da instalação', {
                error: _error instanceof Error ? _error.message : String(_error),
                stack: _error instanceof Error ? _error.stack : undefined,
                context: {
                  installationId: installationSnapshot.id,
                  installationCode: installationSnapshot.codigo,
                  previousState: previousInstalled,
                  newState: newInstalledState,
                  userId: user?.id,
                  operacao: 'undo_toggleInstallation',
                  timestamp: new Date().toISOString()
                }
              });
              setInstallations(prevInstallations =>
                prevInstallations.map(inst =>
                  inst.id === installationSnapshot.id
                    ? { ...inst, installed: newInstalledState }
                    : inst
                )
              );

              toast({
                title: "Erro ao desfazer",
                description: "Não foi possível desfazer a alteração. Tente novamente.",
                variant: "destructive"
              });
            }
          }
        });

        showUndoToast(
          updated.installed
            ? `Marcou "${installationSnapshot.descricao}" como instalado`
            : `Marcou "${installationSnapshot.descricao}" como pendente`,
          async () => {
            await undo();
          }
        );

        toast({
          title: updated.installed ? "Item instalado" : "Item desmarcado",
          description: `${updated.descricao} foi ${updated.installed ? "marcado como instalado" : "desmarcado"}`,
        });
      } catch (error) {
        logger.error('Falha ao alternar status de instalação', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            installationId: installationSnapshot.id,
            installationCode: installationSnapshot.codigo,
            previousState: previousInstalled,
            newState: newInstalledState,
            userId: user?.id,
            projectId: project.id,
            operacao: 'toggleInstallation',
            timestamp: new Date().toISOString()
          }
        });
        setInstallations(prevInstallations =>
          prevInstallations.map(inst =>
            inst.id === installationSnapshot.id
              ? { ...inst, installed: previousInstalled }
              : inst
          )
        );

        toast({
          title: "Erro ao atualizar status",
          description: "Não foi possível atualizar o status do item. Tente novamente.",
          variant: "destructive"
        });

        throw error;
      }
    };

    try {
      await enqueueInstallationUpdate(installationSnapshot.id, persistToggle);
    } catch {
      // Errors are handled inside persistToggle
    }
  }, [addAction, logger, project, storage, toast, undo, user?.id]);

  const handleSelectChange = useCallback((id: string, selected: boolean) => {
    setSelectedInstallations(prev => selected ? [...prev, id] : prev.filter(itemId => itemId !== id));
  }, []);

  const handleOpenDetails = useCallback((installation: Installation) => {
    setSelectedInstallation(installation);
  }, []);

  const handleToggleInstallationClick = useCallback((id: string) => {
    toggleInstallation(id);
  }, [toggleInstallation]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!project) {
      toast({
        title: "Erro",
        description: "Projeto não carregado. Tente recarregar a página.",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    
    try {
      const result = await importExcelFile(file, project.id);
      
      // Handle complete failure (no data imported)
      if (!result.success && !result.data) {
        const errorMessages = result.errors
          .slice(0, 5) // Show max 5 errors
          .map(err => err.mensagem)
          .join('\n');
        
        const moreErrors = result.errors.length > 5 
          ? `\n... e mais ${result.errors.length - 5} erro(s)`
          : '';
        
        toast({
          title: "Erro na importação",
          description: errorMessages + moreErrors,
          variant: "destructive"
        });
        return;
      }

      // Import installations - data is now a direct array of Installation objects
      const results = [];
      if (result.data && Array.isArray(result.data)) {
        for (const installation of result.data) {
          const now = new Date();
          const nowIso = now.toISOString();
          const nowTimestamp = now.getTime();
          
          const installationData = {
            ...installation,
            project_id: project.id,
            updated_at: nowIso,
            revisao: 0 // Garantir que comece em 0
          };
          const installResult = await storage.upsertInstallation(installationData);
          results.push(installResult);
          
          // Criar versão inicial (Revisão 0) para instalações importadas
          const { id: _id, revisado: _revisado, revisao: _revisao, revisions: _revisions, ...snapshot } = installResult;

          const initialVersion: ItemVersion = {
            id: crypto.randomUUID(),
            installationId: installResult.id,
            snapshot,
            revisao: 0,
            motivo: 'created' as const,
            type: 'created' as const,
            descricao_motivo: 'Versão inicial (importada)',
            criadoEm: nowIso,
            createdAt: nowTimestamp,
          };

          await storage.upsertItemVersion(initialVersion);
        }
      }
      
      // Group by pavimento for summary
      const pavimentoCounts = results.reduce((acc, inst) => {
        acc[inst.pavimento] = (acc[inst.pavimento] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const importResult = { summary: pavimentoCounts, data: results };
      const updatedInstallations = await storage.getInstallationsByProject(project.id);
      setInstallations(updatedInstallations);
      
      // Sincronizar fotos com galeria (não-bloqueante)
      try {
        await syncImportedPhotosToGallery(project.id, results);
      } catch (error) {
        logger.warn('Falha ao sincronizar fotos importadas com galeria', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            projectId: project.id,
            importedCount: results.length,
            userId: user?.id,
            operacao: 'syncImportedPhotosToGallery',
            timestamp: new Date().toISOString()
          }
        });
        // Silently fail - photo sync is not critical
      }
      
      // Show summary
      const summaryText = Object.entries(importResult.summary)
        .map(([pavimento, count]) => `${pavimento}: ${count} itens`)
        .join(', ');
      
      // Handle partial success (some rows rejected or sheet-level issues)
      const sheetErrors = result.errors ?? [];
      const sheetLevelErrorCount = sheetErrors.length;
      const hasPartialIssues = result.linhasRejeitadas > 0 || sheetLevelErrorCount > 0;

      if (hasPartialIssues) {
        const errorSummary = sheetErrors
          .slice(0, 3) // Show first 3 errors
          .map(err => err.mensagem)
          .join('\n');

        const moreErrors = sheetLevelErrorCount > 3
          ? `\n... e mais ${sheetLevelErrorCount - 3} erro(s)`
          : '';

        const toastTitle = result.linhasRejeitadas > 0
          ? `Importação parcial: ${result.linhasImportadas} de ${result.totalLinhas} linhas`
          : 'Importação concluída com alertas';
        const issueHeader = result.linhasRejeitadas > 0 ? 'Erros encontrados' : 'Alertas encontrados';

        toast({
          title: toastTitle,
          description: `${summaryText}\n\n${issueHeader}:\n${errorSummary}${moreErrors}`,
          variant: "default",
          duration: 5000
        });
      } else {
        // Complete success
        toast({
          title: "Planilha importada com sucesso",
          description: `${result.linhasImportadas} instalações processadas (${result.linhasRejeitadas} rejeitadas)`,
          duration: 3000
        });
      }
    } catch (error) {
      logger.error('Falha na importação de planilha Excel', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          projectId: project.id,
          projectName: project.name,
          userId: user?.id,
          operacao: 'handleFileUpload',
          timestamp: new Date().toISOString()
        }
      });
      toast({
        title: "Erro ao importar planilha",
        description: "Não foi possível processar o arquivo Excel. Verifique o formato e tente novamente",
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsImporting(false);
      // Clear file input
      event.target.value = '';
    }
  };

  // Info Section (wrapped with LoadingBoundary)
  const renderInfoSection = () => {
    if (isLoadingData) {
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-4 w-1/3 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
                <div>
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    return (
      <LoadingBoundary
        isLoading={isLoadingData}
        loadingMessage="Carregando projeto..."
        fallback={ProjectErrorFallback}
      >
      <div className="space-y-6">
        {/* Project Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-xl">{project.name}</CardTitle>
                <p className="text-muted-foreground">{project.client}</p>
              </div>
              <Badge variant={project.status === 'completed' ? 'default' : 'secondary'}>
                {project.status === 'planning' && 'Planejamento'}
                {project.status === 'in-progress' && 'Em Andamento'}
                {project.status === 'completed' && 'Concluído'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Cidade</Label>
                <p className="text-sm text-muted-foreground">{project.city}</p>
              </div>
              {project.code && (
                <div>
                  <Label className="text-sm font-medium">Código</Label>
                  <p className="text-sm text-muted-foreground">{project.code}</p>
                </div>
              )}
              {project.owner && (
                <div>
                  <Label className="text-sm font-medium">Responsável</Label>
                  <p className="text-sm text-muted-foreground">{project.owner}</p>
                </div>
              )}
              {project.installation_date && (
                <div>
                  <Label className="text-sm font-medium">Data de Instalação</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(project.installation_date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
            </div>

            {(('address' in project && (project as unknown as { address?: string | null }).address) ||
              ('access_notes' in project && (project as unknown as { access_notes?: string | null }).access_notes)) && (
              <div className="grid grid-cols-1 gap-4 pt-2 border-t">
                {(project as unknown as { address?: string | null }).address && (
                  <div>
                    <Label className="text-sm font-medium">Endereço</Label>
                    <p className="text-sm text-muted-foreground">{(project as unknown as { address?: string | null }).address}</p>
                  </div>
                )}
                {(project as unknown as { access_notes?: string | null }).access_notes && (
                  <div>
                    <Label className="text-sm font-medium">Observações de Acesso</Label>
                    <p className="text-sm text-muted-foreground">{(project as unknown as { access_notes?: string | null }).access_notes}</p>
                  </div>
                )}
              </div>
            )}
            
            {project.suppliers && project.suppliers.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Fornecedores</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {project.suppliers.map((supplier, index) => (
                    <Badge key={index} variant="outline">{supplier}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collaboration Card - New! */}
        {isOwner && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Colaboradores</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Gerencie quem tem acesso ao projeto
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/projeto/${id}/colaboracao`)}
                  className="gap-2"
                >
                  <UserCog className="h-4 w-4" />
                  Gerenciar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Adicione colaboradores para trabalhar em conjunto neste projeto
              </div>
            </CardContent>
          </Card>
        )}

        {/* Project Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total de Itens"
            value={installations.length}
            description="Itens no projeto"
          />
          <StatsCard
            title="Concluídos"
            value={completedInstallations}
            description="Itens instalados"
          />
          <StatsCard
            title="Pendentes"
            value={pendingInstallations}
            description="Aguardando instalação"
          />
          <StatsCard
            title="Com Observações"
            value={installationsWithObservations}
            description="Itens com notas"
          />
        </div>

        {/* Progress Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Progresso do Projeto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso Geral</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} className="w-full" />
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>Concluídos: {completedInstallations}</div>
                <div>Pendentes: {pendingInstallations}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => navigate(`/projeto/${id}/pecas`)}
                className="justify-start gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Ver Peças
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/projeto/${id}/relatorios`)}
                className="justify-start gap-2"
              >
                <FileText className="h-4 w-4" />
                Gerar Relatório
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/projeto/${id}/orcamentos`)}
                className="justify-start gap-2"
              >
                <Calculator className="h-4 w-4" />
                Ver Orçamentos
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/projeto/${id}/arquivos`)}
                className="justify-start gap-2"
              >
                <Archive className="h-4 w-4" />
                Gerenciar Arquivos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </LoadingBoundary>
    );
  };

  // Reports Section (wrapped with LoadingBoundary)
  const renderRelatoriosSection = () => {
    const getLastReportText = () => {
      if (!lastReportDate) {
        return 'Nenhum relatório gerado';
      }
      try {
        return formatDistanceToNow(new Date(lastReportDate), {
          addSuffix: true,
          locale: ptBR
        });
      } catch (error) {
        console.error('[ProjectDetail] Falha ao formatar data do último relatório:', error, {
          lastReportDate,
          projectId: project.id
        });
        return 'Data desconhecida';
      }
    };

    const getLastReportFullDate = () => {
      if (!lastReportDate) return '';
      try {
        return new Date(lastReportDate).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (error) {
        console.error('[ProjectDetail] Falha ao formatar data completa do relatório:', error, {
          lastReportDate,
          projectId: project.id
        });
        return '';
      }
    };

    return (
      <LoadingBoundary
        isLoading={isGenerating}
        loadingMessage="Gerando relatório..."
        fallback={ReportErrorFallback}
      >
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Relatórios do Projeto
                  {lastReportDate && (
                    <span className="text-xs font-normal text-muted-foreground flex items-center gap-1" title={getLastReportFullDate()}>
                      <Clock className="h-3 w-3" />
                      Último: {getLastReportText()}
                    </span>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Gere e personalize relatórios detalhados
                </p>
              </div>
              <Button
                onClick={() => setShowReportCustomization(true)}
                disabled={isGenerating}
                className="gap-2 w-full sm:w-auto"
                aria-label={isGenerating ? "Gerando relatório" : "Gerar novo relatório"}
              >
                {isGenerating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Gerando...</>
                ) : (
                  <><FileText className="h-4 w-4" aria-hidden="true" /> Gerar Relatório</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Gere relatórios personalizados</h3>
              <p className="text-muted-foreground mb-4">
                Utilize a personalização para criar relatórios específicos para cada interlocutor
              </p>
            </div>
          </CardContent>
        </Card>

          <Suspense fallback={<CardLoadingState message="Carregando histórico..." />}>
            <ReportHistoryPanel projectId={project.id} />
          </Suspense>
        </div>
      </LoadingBoundary>
    );
  };

  // Budget Section
  const renderOrcamentosSection = () => {
    return (
      <div className="space-y-6 max-w-full overflow-x-hidden">
        <Card className="w-full">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0 flex-1">
                <CardTitle className="break-words">Orçamentos</CardTitle>
                <p className="text-sm text-muted-foreground break-words">
                  Gerencie os orçamentos do projeto
                </p>
              </div>
              <Button className="gap-2 w-full sm:w-auto shrink-0">
                <Plus className="h-4 w-4" />
                Novo Orçamento
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-hidden">
            <div className="max-w-full">
              <Suspense fallback={<CardLoadingState message="Carregando orçamentos..." />}>
                <BudgetTab projectId={project.id} projectName={project.name} />
              </Suspense>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Files Section (wrapped with LoadingBoundary)
  const renderArquivosSection = () => {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Gerenciamento de Imagens</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sistema completo de upload, edição e organização de imagens
            </p>
          </CardHeader>
          <CardContent>
            <LoadingBoundary
              fallback={UploadErrorFallback}
              loadingMessage="Carregando galeria..."
            >
              <EnhancedImageUpload 
              projectId={project.id}
              context="projeto"
            />
            </LoadingBoundary>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Outros Arquivos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Documentos, PDFs e outros tipos de arquivo
            </p>
          </CardHeader>
          <CardContent>
            <LoadingBoundary
              fallback={UploadErrorFallback}
              loadingMessage="Carregando arquivos..."
            >
              <FileUpload 
              projectId={project.id}
              acceptedTypes={['.pdf', '.doc', '.docx', '.xlsx', '.xls', '.txt']}
              onFilesChange={() => loadProjectData()}
            />
            </LoadingBoundary>
          </CardContent>
        </Card>
        
        <StorageBar
          instalados={completedInstallations}
          pendentes={pendingInstallations}
          emAndamento={0}
        />
      </div>
    );
  };

  const renderContatosSection = () => {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Contatos do Projeto</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Gerencie os contatos relacionados a este projeto
                </p>
              </div>
              <Button
                onClick={() => navigate('/contatos')}
                className="gap-2 w-full sm:w-auto"
              >
                <Users className="h-4 w-4" />
                Ver Todos os Contatos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Clientes</span>
                  </div>
                  <div className="text-2xl font-bold">{contadores.cliente}</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Obra</span>
                  </div>
                  <div className="text-2xl font-bold">{contadores.obra}</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Fornecedores</span>
                  </div>
                  <div className="text-2xl font-bold">{contadores.fornecedor}</div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground text-center">
                Total de {contadores.total} contatos neste projeto
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderColaboracaoSection = () => {
    return (
      <div className="space-y-6">
        <Suspense fallback={<CardLoadingState message="Carregando painel de colaboração..." />}>
          <CollaborationPanel
            projectId={project.id}
            isOwner={isOwner}
            onCollaboratorAdded={loadProjectData}
          />
        </Suspense>
      </div>
    );
  };

  // Peças Section (wrapped with LoadingBoundary for data loading)
  const renderPecasSection = () => {
    const groupedInstallations = filteredInstallations.reduce((groups, installation) => {
      const tipologia = installation.tipologia;
      if (!groups[tipologia]) {
        groups[tipologia] = [];
      }
      groups[tipologia].push(installation);
      return groups;
    }, {} as Record<string, Installation[]>);

    Object.keys(groupedInstallations).forEach(tipologia => {
      groupedInstallations[tipologia].sort((a, b) => {
        const codeA = typeof a.codigo === 'number' ? a.codigo : parseInt(String(a.codigo)) || 0;
        const codeB = typeof b.codigo === 'number' ? b.codigo : parseInt(String(b.codigo)) || 0;
        return codeA - codeB;
      });
    });

    return (
      <LoadingBoundary
        isLoading={isImporting}
        loadingMessage="Importando planilha Excel..."
        fallback={UploadErrorFallback}
      >
      <div className="space-y-4">
        {/* Compact Summary Cards - Mobile Optimized */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card className="text-center">
            <CardContent className="p-3 sm:p-4">
              <div className="text-lg sm:text-2xl font-bold text-primary">{installations.length}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3 sm:p-4">
              <div className="text-lg sm:text-2xl font-bold text-green-600">{completedInstallations}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Instaladas</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3 sm:p-4">
              <div className="text-lg sm:text-2xl font-bold text-orange-600">{pendingInstallations}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Pendentes</div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Card - Mobile Optimized */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso Geral</span>
              <span className="text-lg font-bold">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{completedInstallations} concluídas</span>
              <span>{installationsWithObservations} com observações</span>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters - Mobile Optimized */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por código, tipologia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => document.getElementById('excel-upload-input')?.click()}
              disabled={isImporting}
              className="gap-2"
            >
              {isImporting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</>
              ) : (
                <><Upload className="h-4 w-4" /> Importar Excel</>
              )}
            </Button>
            <input
              id="excel-upload-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 justify-between" aria-label="Abrir filtros">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <div className="p-2 space-y-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                      className="w-full mt-1 px-2 py-1 border border-input bg-background rounded text-sm"
                    >
                      <option value="all">Todos</option>
                      <option value="installed">Instalados</option>
                      <option value="pending">Pendentes</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Situação do item</label>
                    <select
                      value={itemStatusFilter}
                      onChange={(e) => setItemStatusFilter(e.target.value as ItemStatusFilterValue)}
                      className="w-full mt-1 px-2 py-1 border border-input bg-background rounded text-sm"
                    >
                      <option value="all">Todas</option>
                      {ITEM_STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Pavimento</label>
                    <select
                      value={pavimentoFilter}
                      onChange={(e) => setPavimentoFilter(e.target.value)}
                      className="w-full mt-1 px-2 py-1 border border-input bg-background rounded text-sm"
                    >
                      <option value="all">Todos</option>
                      {pavimentos.map(pavimento => (
                        <option key={pavimento} value={pavimento}>{pavimento}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button variant="outline" size="sm" aria-label="Recarregar lista" title="Recarregar">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Mobile-Optimized Installation List */}
        <div className="space-y-4">
          {isLoadingData || isImporting ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-4 w-4 mt-1" />
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                          <Skeleton className="h-6 w-16" />
                          <Skeleton className="h-5 w-3/4" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Skeleton className="h-9 flex-1" />
                          <Skeleton className="h-9 w-9" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : Object.keys(groupedInstallations).length === 0 ? (
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
                    <AccordionTrigger className="px-4 hover:no-underline text-left">
                      <div className="flex items-center justify-between w-full pr-4 min-w-0">
                        <span className="font-semibold text-left break-words min-w-0 flex-1">{tipologia}</span>
                        <Badge variant="outline" className="ml-2 shrink-0">
                          {installations.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-3">
                        {installations.length > 100 ? (
                          <div style={{ height: 600 }}>
                            <VirtualList
                              height={600}
                              width={"100%"}
                              itemCount={installations.length}
                              itemSize={160}
                              itemKey={(index) => installations[index].id}
                            >
                              {({ index, style }) => (
                                <div style={style}>
                                  <InstallationCard
                                    installation={installations[index]}
                                    isSelected={selectedInstallations.includes(installations[index].id)}
                                    onSelectChange={handleSelectChange}
                                    onToggleInstallation={handleToggleInstallationClick}
                                    onOpenDetails={handleOpenDetails}
                                    isDetailsOpen={!!selectedInstallation && selectedInstallation.id === installations[index].id}
                                  />
                                </div>
                              )}
                            </VirtualList>
                          </div>
                        ) : (
                          installations.map((installation) => (
                            <InstallationCard
                              key={installation.id}
                              installation={installation}
                              isSelected={selectedInstallations.includes(installation.id)}
                              onSelectChange={handleSelectChange}
                              onToggleInstallation={handleToggleInstallationClick}
                              onOpenDetails={handleOpenDetails}
                              isDetailsOpen={!!selectedInstallation && selectedInstallation.id === installation.id}
                            />
                          ))
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          )}
        </div>
      </div>
      </LoadingBoundary>
    );
  };

  // Guard UI render until project is available to keep hook order stable
  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/4 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/')}
                className="p-2 shrink-0"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg font-bold truncate">{project.name}</h1>
                <p className="text-xs text-muted-foreground truncate">
                  {project.client}
                </p>
              </div>
            </div>
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="lg:hidden" aria-label="Abrir menu">
                  <Menu className="h-4 w-4" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Opções do Projeto</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditModalOpen(true)}
                  className="w-full justify-start gap-2"
                  aria-label="Editar projeto"
                >
                  <Edit className="h-4 w-4" aria-hidden="true" />
                  Editar Projeto
                </Button>
                <Button
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowAddModal(true)}
                  className="w-full justify-start gap-2"
                  aria-label="Adicionar item ao projeto"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Adicionar Item
                </Button>
                </div>
              </SheetContent>
            </Sheet>

            <div className="hidden lg:flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(true)}
                className="gap-2"
                aria-label="Editar projeto"
              >
                <Edit className="h-4 w-4" aria-hidden="true" />
                Editar
              </Button>
              <Button
                variant="outline" 
                size="sm"
                onClick={() => setShowAddModal(true)}
                className="gap-2"
                aria-label="Adicionar item ao projeto"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="container mx-auto px-4">
        <div className="lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between mb-4">
                <div className="flex items-center gap-2">
                  {currentSection === 'info' && <Home className="h-4 w-4" />}
                  {currentSection === 'pecas' && <FileSpreadsheet className="h-4 w-4" />}
                  {currentSection === 'relatorios' && <FileText className="h-4 w-4" />}
                  {currentSection === 'orcamentos' && <Calculator className="h-4 w-4" />}
                  {currentSection === 'arquivos' && <Archive className="h-4 w-4" />}
                  {currentSection === 'contatos' && <Users className="h-4 w-4" />}
                  {currentSection === 'colaboracao' && <UserCog className="h-4 w-4" />}
                  {currentSection === 'info' && 'Informações'}
                  {currentSection === 'pecas' && 'Peças'}
                  {currentSection === 'relatorios' && 'Relatórios'}
                  {currentSection === 'orcamentos' && 'Orçamentos'}
                  {currentSection === 'arquivos' && 'Arquivos'}
                  {currentSection === 'contatos' && 'Contatos'}
                  {currentSection === 'colaboracao' && 'Colaboração'}
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full">
              <DropdownMenuItem onClick={() => navigate(`/projeto/${id}`)}>
                <Home className="h-4 w-4 mr-2" />
                Informações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/projeto/${id}/pecas`)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Peças
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/projeto/${id}/relatorios`)}>
                <FileText className="h-4 w-4 mr-2" />
                Relatórios
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/projeto/${id}/orcamentos`)}>
                <Calculator className="h-4 w-4 mr-2" />
                Orçamentos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/projeto/${id}/arquivos`)}>
                <Archive className="h-4 w-4 mr-2" />
                Arquivos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/projeto/${id}/colaboracao`)}>
                <UserCog className="h-4 w-4 mr-2" />
                Colaboração
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/projeto/${id}/contatos`)}>
                <Users className="h-4 w-4 mr-2" />
                Contatos
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="hidden lg:flex gap-2 border-b pb-4 mb-6" role="tablist" aria-label="Navegação do projeto">
          {[
            { key: 'info', label: 'Informações', path: `/projeto/${id}`, icon: Home },
            { key: 'pecas', label: 'Peças', path: `/projeto/${id}/pecas`, icon: FileSpreadsheet },
            { key: 'relatorios', label: 'Relatórios', path: `/projeto/${id}/relatorios`, icon: FileText },
            { key: 'orcamentos', label: 'Orçamentos', path: `/projeto/${id}/orcamentos`, icon: Calculator },
            { key: 'arquivos', label: 'Arquivos', path: `/projeto/${id}/arquivos`, icon: Archive },
            { key: 'colaboracao', label: 'Colaboração', path: `/projeto/${id}/colaboracao`, icon: UserCog },
            { key: 'contatos', label: 'Contatos', path: `/projeto/${id}/contatos`, icon: Users }
          ].map(tab => (
            <Button
              key={tab.key}
              variant={currentSection === tab.key ? "default" : "ghost"}
              size="sm"
              onClick={() => navigate(tab.path)}
              className="gap-2"
              role="tab"
              aria-selected={currentSection === tab.key}
              aria-controls={`panel-${tab.key}`}
            >
              <tab.icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 pb-6 max-w-full overflow-x-hidden">
        <div className="space-y-4 max-w-full" role="tabpanel" id={`panel-${currentSection}`} aria-labelledby={`tab-${currentSection}`}>
          {currentSection === 'info' && renderInfoSection()}
          {currentSection === 'pecas' && renderPecasSection()}
          {currentSection === 'relatorios' && renderRelatoriosSection()}
          {currentSection === 'orcamentos' && renderOrcamentosSection()}
          {currentSection === 'arquivos' && renderArquivosSection()}
          {currentSection === 'colaboracao' && renderColaboracaoSection()}
          {currentSection === 'contatos' && renderContatosSection()}
        </div>
      </div>

      {/* Modals - Lazy loaded with Suspense */}
      {selectedInstallation && (
        <Suspense fallback={null}>
          <InstallationDetailModalNew
            installation={selectedInstallation}
            isOpen={!!selectedInstallation}
            onClose={() => setSelectedInstallation(null)}
            onUpdate={loadProjectData}
          />
        </Suspense>
      )}

      {showAddModal && (
        <Suspense fallback={null}>
          <AddInstallationModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onUpdate={loadProjectData}
            projectId={project.id}
          />
        </Suspense>
      )}

      {isEditModalOpen && (
        <Suspense fallback={null}>
          <EditProjectModal
            project={project}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onProjectUpdated={handleProjectUpdated}
          />
        </Suspense>
      )}

      {showReportCustomization && (
        <Suspense fallback={null}>
          <ReportCustomizationModal
            isOpen={showReportCustomization}
            onClose={() => setShowReportCustomization(false)}
            onGenerate={async (config, format) => {
              setIsGenerating(true);
              try {
                const { generatePDFReport, generateXLSXReport } = await import('@/lib/reports-new');
                
                const versions = await Promise.all(
                  installations.map(installation => storage.getItemVersions(installation.id))
                ).then(results => results.flat());

                const filteredInstallations = installations;

                const reportData = {
                  project,
                  installations: filteredInstallations,
                  versions,
                  generatedBy: project.owner || 'Sistema',
                  generatedAt: new Date().toISOString(),
                  interlocutor: config.interlocutor,
                  customConfig: config
                };

                if (format === 'pdf') {
                  return await generatePDFReport(reportData);
                } else {
                  return await generateXLSXReport(reportData);
                }
              } finally {
                setIsGenerating(false);
              }
            }}
            onShare={(blob, format, config) => {
              setGeneratedReport({ blob, format, config });
              setShowReportCustomization(false);
              setShowReportShare(true);
            }}
            project={project}
            installations={installations}
          />
        </Suspense>
      )}

      {showReportShare && generatedReport && (
        <Suspense fallback={null}>
          <ReportShareModal
            isOpen={showReportShare}
            onClose={() => {
              setShowReportShare(false);
              setGeneratedReport(null);
              // Reload last report date after saving
              loadLastReportDate();
            }}
            blob={generatedReport.blob}
            format={generatedReport.format}
            config={generatedReport.config}
            project={project}
            interlocutor={generatedReport.config.interlocutor}
            installations={installations}
          />
        </Suspense>
      )}
    </div>
  );
}
