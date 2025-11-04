import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, FileText, Table, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { calculateReportSections, calculatePavimentoSummary, ReportSections, PavimentoSummary } from '@/lib/reports-new';
import { StorageBar } from '@/components/storage-bar';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/use-toast';
import { showToast } from '@/lib/toast';
import { ReportErrorBoundary } from './report-error-boundary';
import type { ReportCustomizationModalProps, ReportConfig } from './ReportCustomizationModal.types';
import type { ItemVersion } from '@/types';
import { DEFAULT_REPORT_CONFIG, REPORT_CONFIG_STORAGE_KEY } from './ReportCustomizationModal.constants';

const mergeConfigWithDefaults = (config: Partial<ReportConfig> | null | undefined): ReportConfig => {
  if (!config) {
    return DEFAULT_REPORT_CONFIG;
  }

  return {
    ...DEFAULT_REPORT_CONFIG,
    ...config,
    sections: {
      ...DEFAULT_REPORT_CONFIG.sections,
      ...config.sections,
    },
    includeDetails: {
      ...DEFAULT_REPORT_CONFIG.includeDetails,
      ...config.includeDetails,
    },
    pdfOptions: {
      ...DEFAULT_REPORT_CONFIG.pdfOptions,
      ...config.pdfOptions,
    },
    visibleColumns: {
      ...DEFAULT_REPORT_CONFIG.visibleColumns,
      ...config.visibleColumns,
    },
  };
};

const COLUMN_LABELS: Record<keyof ReportConfig['visibleColumns'], string> = {
  pavimento: 'Pavimento',
  tipologia: 'Tipologia',
  codigo: 'Código',
  descricao: 'Descrição',
  status: 'Status',
  observations: 'Observações',
  supplierComments: 'Comentários do Fornecedor',
  updatedAt: 'Atualizado em',
  photos: 'Fotos',
};

export function ReportCustomizationModal({
  isOpen,
  onClose,
  onGenerate,
  onShare,
  project,
  installations,
}: ReportCustomizationModalProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<ReportConfig>(() => mergeConfigWithDefaults(DEFAULT_REPORT_CONFIG));
  const [previewData, setPreviewData] = useState<{
    sections: ReportSections;
    pavimentoSummary: PavimentoSummary[];
    totals: {
      pendencias: number;
      concluidas: number;
      emRevisao: number;
      emAndamento: number;
    };
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingFormat, setGeneratingFormat] = useState<'pdf' | 'xlsx' | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationMessage, setGenerationMessage] = useState('');
  const [activeTab, setActiveTab] = useState('sections');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Load saved preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REPORT_CONFIG_STORAGE_KEY);
      if (saved) {
        const savedConfig = JSON.parse(saved) as Partial<ReportConfig>;
        setConfig(mergeConfigWithDefaults(savedConfig));
      }
    } catch (_error) {
      // Error já tratado com valores padrão
    }
  }, []);

  // Save preferences to localStorage whenever config changes
  useEffect(() => {
    try {
      localStorage.setItem(REPORT_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (_error) {
      // Error ignorado: não-crítico
    }
  }, [config]);

  // Calculate preview data with useMemo
  const calculatePreview = useCallback((currentConfig: ReportConfig) => {
    setIsLoadingPreview(true);
    try {
      const versions: ItemVersion[] = []; // Simplified for preview
      const reportData = {
        project,
        installations,
        versions,
        generatedBy: project.owner || 'Sistema',
        generatedAt: new Date().toISOString(),
        interlocutor: currentConfig.interlocutor,
      };

      const sections = calculateReportSections(reportData);
      const pavimentoSummary = calculatePavimentoSummary(sections);

      setPreviewData({
        sections,
        pavimentoSummary,
        totals: {
          pendencias: sections.pendencias.length,
          concluidas: sections.concluidas.length,
          emRevisao: sections.emRevisao.length,
          emAndamento: sections.emAndamento.length,
        },
      });
    } catch (_error) {
      // Error ignorado: não-crítico
      toast({
        title: 'Erro ao atualizar prévia',
        description: 'Não foi possível calcular a prévia. As configurações serão mantidas',
        variant: 'destructive',
        duration: 4000
      });
      showToast.error('Erro ao atualizar prévia', 'Não foi possível calcular a prévia do relatório.');
    } finally {
      setIsLoadingPreview(false);
    }
  }, [project, installations, toast]);

  // Debounced configuration to throttle preview updates
  const debouncedConfig = useDebounce(config, 300);

  // Update preview when modal opens or config changes
  useEffect(() => {
    if (isOpen && installations.length > 0) {
      calculatePreview(debouncedConfig);
    }
  }, [isOpen, installations, debouncedConfig, calculatePreview]);

  // Check if at least one section is selected
  const hasSelectedSections = useMemo(() => {
    return Object.values(config.sections).some(value => value);
  }, [config.sections]);

  const selectedColumnLabels = useMemo(() => {
    return Object.entries(config.visibleColumns)
      .filter(([key, value]) => {
        if (!value) return false;
        if (key === 'supplierComments' && config.interlocutor !== 'fornecedor') return false;
        if (key === 'observations' && !config.includeDetails.observations) return false;
        if (key === 'photos' && !config.includeDetails.photos) return false;
        if (key === 'updatedAt' && !config.includeDetails.timestamps) return false;
        return true;
      })
      .map(([key]) => COLUMN_LABELS[key as keyof ReportConfig['visibleColumns']]);
  }, [config.visibleColumns, config.includeDetails, config.interlocutor]);

  // Memoized handlers with useCallback
  const handleSectionToggle = useCallback((section: keyof ReportConfig['sections']) => {
    setConfig(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: !prev.sections[section],
      },
    }));
  }, []);

  const handleDetailToggle = useCallback((detail: keyof ReportConfig['includeDetails']) => {
    setConfig(prev => {
      const nextIncludeDetails = {
        ...prev.includeDetails,
        [detail]: !prev.includeDetails[detail],
      };

      const nextVisibleColumns = { ...prev.visibleColumns };

      if (detail === 'photos') {
        if (!nextIncludeDetails.photos) {
          nextVisibleColumns.photos = false;
          nextIncludeDetails.thumbnails = false;
        } else {
          nextVisibleColumns.photos = true;
        }
      }

      if (detail === 'observations') {
        nextVisibleColumns.observations = nextIncludeDetails.observations;
      }

      if (detail === 'supplierComments') {
        nextVisibleColumns.supplierComments = nextIncludeDetails.supplierComments;
      }

      if (detail === 'timestamps') {
        nextVisibleColumns.updatedAt = nextIncludeDetails.timestamps;
      }

      if (detail === 'thumbnails' && !nextIncludeDetails.photos) {
        nextIncludeDetails.thumbnails = false;
      }

      return {
        ...prev,
        includeDetails: nextIncludeDetails,
        visibleColumns: nextVisibleColumns,
      };
    });
  }, []);

  const handleColumnToggle = useCallback((column: keyof ReportConfig['visibleColumns']) => {
    setConfig(prev => ({
      ...prev,
      visibleColumns: {
        ...prev.visibleColumns,
        [column]: !prev.visibleColumns[column],
      },
    }));
  }, []);

  const handlePdfIncludePhotosToggle = useCallback((checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      pdfOptions: {
        ...prev.pdfOptions,
        includePhotos: checked,
        variant: checked ? 'complete' : 'compact',
      },
    }));
  }, []);

  const handlePdfVariantChange = useCallback((variant: 'compact' | 'complete') => {
    setConfig(prev => ({
      ...prev,
      pdfOptions: {
        ...prev.pdfOptions,
        variant,
        includePhotos: variant === 'complete',
      },
    }));
  }, []);

  const handleRestoreDefaults = useCallback(() => {
    setConfig(mergeConfigWithDefaults(DEFAULT_REPORT_CONFIG));
    toast({
      title: 'Configurações restauradas',
      description: 'As preferências padrão do relatório foram aplicadas',
      duration: 2000
    });
    showToast.success('Preferências restauradas', 'As configurações padrão foram restauradas.');
  }, [toast]);

  const handleGenerate = useCallback(async (format: 'pdf' | 'xlsx') => {
    if (!hasSelectedSections) {
      toast({
        title: 'Selecione ao menos uma seção',
        description: 'Escolha as seções que deseja incluir no relatório',
        variant: 'destructive',
        duration: 4000
      });
      showToast.error('Seleção necessária', 'Selecione pelo menos uma seção para gerar o relatório.');
      return;
    }

    setIsGenerating(true);
    setGeneratingFormat(format);
    if (format === 'pdf') {
      setGenerationProgress(0.05);
      setGenerationMessage('Preparando dados do relatório...');
    } else {
      setGenerationProgress(0);
      setGenerationMessage('');
    }
    try {
      const blob = await onGenerate(config, format, {
        onProgress: (progress, message) => {
          setGenerationProgress(prev => {
            if (!Number.isFinite(progress)) {
              return prev;
            }
            return Math.min(Math.max(progress, 0), 1);
          });
          if (message) {
            setGenerationMessage(message);
          }
        }
      });

      if (format === 'pdf') {
        setGenerationProgress(1);
        setGenerationMessage('PDF gerado com sucesso');
        const maxBytes = 10 * 1024 * 1024;
        if (blob.size > maxBytes) {
          toast({
            title: 'PDF muito grande',
            description: 'O arquivo ultrapassou 10MB. Considere usar a versão compacta sem fotos.',
            variant: 'default',
            duration: 6000
          });
          showToast.info('PDF excedeu 10MB', 'Considere gerar a versão compacta sem fotos.');
        }
      }

      onShare(blob, format, config);
      const formatName = format === 'pdf' ? 'PDF' : 'Excel';
      toast({
        title: `Relatório ${formatName} gerado com sucesso`,
        description: `"${project.name}" pronto para download`,
        duration: 3000
      });
      showToast.success(
        'Relatório gerado com sucesso',
        `O relatório ${format.toUpperCase()} foi gerado.`
      );
      onClose();
    } catch (error) {
      toast({
        title: 'Erro ao gerar relatório',
        description: 'Não foi possível criar o relatório. Verifique as configurações e tente novamente',
        variant: 'destructive',
        duration: 5000
      });
      showToast.error(
        'Erro ao gerar relatório',
        error instanceof Error ? error.message : 'Não foi possível gerar o relatório. Tente novamente.'
      );
    } finally {
      setIsGenerating(false);
      setGeneratingFormat(null);
      setGenerationProgress(0);
      setGenerationMessage('');
    }
  }, [config, hasSelectedSections, onGenerate, onShare, onClose, toast]);

  const getSectionLabel = useCallback((section: string) => {
    const labels = {
      pendencias: 'Pendências',
      concluidas: 'Concluídas',
      emRevisao: 'Em Revisão',
      emAndamento: config.interlocutor === 'fornecedor' ? 'Aguardando Instalação' : 'Em Andamento',
    };
    return labels[section as keyof typeof labels] || section;
  }, [config.interlocutor]);

  const getDetailLabel = useCallback((detail: string) => {
    const labels = {
      photos: 'Fotos das Instalações',
      observations: 'Observações',
      supplierComments: 'Comentários do Fornecedor',
      timestamps: 'Datas de Criação/Atualização',
      pavimentoSummary: 'Resumo por Pavimento',
      storageChart: 'Gráfico de Status',
      thumbnails: 'Incluir Miniaturas',
    };
    return labels[detail as keyof typeof labels] || detail;
  }, []);

  // Disable tabs during generation
  const tabsDisabled = isGenerating;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] sm:max-w-4xl flex flex-col">
        <ReportErrorBoundary onClose={onClose}>
          <DialogHeader className="flex-shrink-0 pb-4">
            <DialogTitle className="text-lg sm:text-xl">Personalizar Relatório</DialogTitle>
            <DialogDescription className="text-sm">
              Configure as informações que devem ser incluídas no seu relatório e veja uma prévia antes de gerar.
            </DialogDescription>
          </DialogHeader>

        {!hasSelectedSections && (
          <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950 flex-shrink-0">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              Selecione pelo menos uma seção para gerar o relatório.
            </AlertDescription>
          </Alert>
        )}

        <Card className="flex-shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Destinatário do Relatório</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup 
              value={config.interlocutor} 
              onValueChange={(value: 'cliente' | 'fornecedor') => 
                setConfig(prev => ({ ...prev, interlocutor: value }))
              }
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="cliente" id="cliente" />
                <Label htmlFor="cliente" className="cursor-pointer flex-1">
                  <div className="font-medium">Cliente</div>
                  <div className="text-xs text-muted-foreground">Relatório para aprovação</div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="fornecedor" id="fornecedor" />
                <Label htmlFor="fornecedor" className="cursor-pointer flex-1">
                  <div className="font-medium">Fornecedor</div>
                  <div className="text-xs text-muted-foreground">Relatório técnico com instruções</div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <div className="flex-1 overflow-hidden">
          <Tabs 
            value={activeTab} 
            onValueChange={tabsDisabled ? undefined : setActiveTab} 
            className="h-full flex flex-col"
          >
            <TabsList className="grid w-full grid-cols-3 h-9 flex-shrink-0 mb-4">
              <TabsTrigger value="sections" className="text-xs sm:text-sm" disabled={tabsDisabled}>
                Seções
              </TabsTrigger>
              <TabsTrigger value="details" className="text-xs sm:text-sm" disabled={tabsDisabled}>
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs sm:text-sm" disabled={tabsDisabled}>
                Prévia
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="pr-4">
                  <TabsContent value="sections" className="space-y-4 mt-0">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">Seções do Relatório</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {Object.entries(config.sections).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center space-x-3 min-w-0">
                              <Checkbox
                                id={key}
                                checked={value}
                                onCheckedChange={() => handleSectionToggle(key as keyof ReportConfig['sections'])}
                              />
                              <Label htmlFor={key} className="text-sm font-medium cursor-pointer truncate">
                                {getSectionLabel(key)}
                              </Label>
                            </div>
                            {previewData && (
                              <Badge variant="outline" className="shrink-0 text-xs">
                                {previewData.totals[key as keyof typeof previewData.totals] || 0}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">Organização</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium">Agrupar por:</Label>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            {[
                              { value: 'none', label: 'Nenhum' },
                              { value: 'pavimento', label: 'Pavimento' },
                              { value: 'tipologia', label: 'Tipologia' },
                            ].map(option => (
                              <Button
                                key={option.value}
                                variant={config.groupBy === option.value ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setConfig(prev => ({ ...prev, groupBy: option.value as 'none' | 'pavimento' | 'tipologia' }))}
                                className="text-xs"
                              >
                                {option.label}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Ordenar por:</Label>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {[
                              { value: 'codigo', label: 'Código' },
                              { value: 'pavimento', label: 'Pavimento' },
                              { value: 'tipologia', label: 'Tipologia' },
                              { value: 'updated_at', label: 'Data' },
                            ].map(option => (
                              <Button
                                key={option.value}
                                variant={config.sortBy === option.value ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setConfig(prev => ({ ...prev, sortBy: option.value as 'codigo' | 'pavimento' | 'tipologia' | 'updated_at' }))}
                                className="text-xs"
                              >
                                {option.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="details" className="space-y-4 mt-0">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">Informações Incluídas</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {Object.entries(config.includeDetails)
                          .filter(([key]) => {
                            // Only show supplierComments when interlocutor is fornecedor
                            if (key === 'supplierComments') {
                              return config.interlocutor === 'fornecedor';
                            }
                            return true;
                          })
                          .map(([key, value]) => {
                            const detailKey = key as keyof ReportConfig['includeDetails'];
                            const isThumbnails = detailKey === 'thumbnails';
                            const isDisabled = isThumbnails && !config.includeDetails.photos;

                            return (
                              <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <Checkbox
                                    id={key}
                                    checked={value}
                                    disabled={isDisabled}
                                    onCheckedChange={() => handleDetailToggle(detailKey)}
                                  />
                                  <Label
                                    htmlFor={key}
                                    className={`text-sm font-medium cursor-pointer ${isDisabled ? 'text-muted-foreground' : ''}`}
                                  >
                                    {getDetailLabel(key)}
                                  </Label>
                                </div>
                                {isThumbnails && !config.includeDetails.photos && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Requer fotos
                                  </Badge>
                                )}
                              </div>
                            );
                          })
                        }
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">Opções do PDF</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Controle a versão do relatório em PDF e como as fotos serão apresentadas.
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg">
                          <div>
                            <Label htmlFor="pdf-include-photos" className="text-sm font-medium">
                              Incluir Fotos no PDF
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {config.pdfOptions.includePhotos
                                ? 'Versão completa com galeria de miniaturas.'
                                : 'Versão compacta sem fotos para reduzir o tamanho do arquivo.'}
                            </p>
                          </div>
                          <Switch
                            id="pdf-include-photos"
                            checked={config.pdfOptions.includePhotos}
                            onCheckedChange={handlePdfIncludePhotosToggle}
                            disabled={isGenerating}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Versão do PDF</Label>
                          <RadioGroup
                            value={config.pdfOptions.variant}
                            onValueChange={(value: 'compact' | 'complete') => handlePdfVariantChange(value)}
                            className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                          >
                            <div className={`border rounded-lg p-3 space-y-1 ${config.pdfOptions.variant === 'compact' ? 'border-primary bg-primary/5' : ''}`}>
                              <RadioGroupItem value="compact" id="pdf-variant-compact" className="sr-only" />
                              <Label htmlFor="pdf-variant-compact" className="cursor-pointer font-medium">
                                Compacta
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Ideal para envio rápido. Fotos são desativadas automaticamente.
                              </p>
                            </div>
                            <div className={`border rounded-lg p-3 space-y-1 ${config.pdfOptions.variant === 'complete' ? 'border-primary bg-primary/5' : ''}`}>
                              <RadioGroupItem value="complete" id="pdf-variant-complete" className="sr-only" />
                              <Label htmlFor="pdf-variant-complete" className="cursor-pointer font-medium">
                                Completa
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Inclui miniaturas comprimidas (até {config.pdfOptions.maxPhotosPerItem} fotos por item).
                              </p>
                            </div>
                          </RadioGroup>
                        </div>

                        {config.pdfOptions.includePhotos && (
                          <p className="text-xs text-muted-foreground">
                            As imagens são otimizadas automaticamente para 150x150px antes de serem adicionadas ao PDF.
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">Colunas Visíveis</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Personalize quais colunas estarão disponíveis na exportação em Excel.
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {Object.entries(config.visibleColumns)
                          .filter(([key]) => {
                            if (key === 'supplierComments') {
                              return config.interlocutor === 'fornecedor';
                            }
                            if (key === 'observations') {
                              return config.includeDetails.observations;
                            }
                            if (key === 'photos') {
                              return config.includeDetails.photos;
                            }
                            if (key === 'updatedAt') {
                              return config.includeDetails.timestamps;
                            }
                            return true;
                          })
                          .map(([key, value]) => {
                            const columnKey = key as keyof ReportConfig['visibleColumns'];
                            return (
                              <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <Checkbox
                                    id={`column-${key}`}
                                    checked={value}
                                    onCheckedChange={() => handleColumnToggle(columnKey)}
                                  />
                                  <Label htmlFor={`column-${key}`} className="text-sm font-medium cursor-pointer">
                                    {COLUMN_LABELS[columnKey]}
                                  </Label>
                                </div>
                              </div>
                            );
                          })
                        }
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="preview" className="space-y-4 mt-0">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          Prévia do Relatório
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {isLoadingPreview ? (
                          <>
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                              {[1, 2, 3, 4].map((i) => (
                                <Skeleton key={i} className="h-20 w-full" />
                              ))}
                            </div>
                            <Skeleton className="h-32 w-full" />
                            <Skeleton className="h-24 w-full" />
                          </>
                        ) : previewData ? (
                          <>
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                              <div className="text-center p-2 sm:p-3 border rounded-lg bg-muted/50">
                                <div className="text-base sm:text-lg font-bold text-orange-600">
                                  {config.sections.pendencias ? previewData.totals.pendencias : 0}
                                </div>
                                <div className="text-xs text-muted-foreground">Pendências</div>
                              </div>
                              <div className="text-center p-2 sm:p-3 border rounded-lg bg-muted/50">
                                <div className="text-base sm:text-lg font-bold text-green-600">
                                  {config.sections.concluidas ? previewData.totals.concluidas : 0}
                                </div>
                                <div className="text-xs text-muted-foreground">Concluídas</div>
                              </div>
                              <div className="text-center p-2 sm:p-3 border rounded-lg bg-muted/50">
                                <div className="text-base sm:text-lg font-bold text-blue-600">
                                  {config.sections.emRevisao ? previewData.totals.emRevisao : 0}
                                </div>
                                <div className="text-xs text-muted-foreground">Em Revisão</div>
                              </div>
                              <div className="text-center p-2 sm:p-3 border rounded-lg bg-muted/50">
                                <div className="text-base sm:text-lg font-bold text-yellow-600">
                                  {config.sections.emAndamento ? previewData.totals.emAndamento : 0}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {config.interlocutor === 'fornecedor' ? 'Aguardando' : 'Em Andamento'}
                                </div>
                              </div>
                            </div>

                            {config.includeDetails.storageChart && (
                              <div className="border rounded-lg p-4">
                                <h4 className="font-medium mb-3 text-sm">Gráfico de Status</h4>
                                <StorageBar
                                  pendentes={config.sections.pendencias ? previewData.totals.pendencias : 0}
                                  emAndamento={config.sections.emAndamento ? previewData.totals.emAndamento : 0}
                                  instalados={config.sections.concluidas ? previewData.totals.concluidas : 0}
                                />
                              </div>
                            )}

                            {config.includeDetails.pavimentoSummary && previewData.pavimentoSummary && (
                              <div className="border rounded-lg p-4">
                                <h4 className="font-medium mb-3 text-sm">Resumo por Pavimento</h4>
                                <div className="text-sm text-muted-foreground">
                                  {previewData.pavimentoSummary.length} pavimentos encontrados
                                </div>
                              </div>
                            )}

                            <div className="border rounded-lg p-4">
                              <h4 className="font-medium mb-3 text-sm">Configurações Aplicadas</h4>
                              <div className="space-y-2 text-xs sm:text-sm">
                                <div>
                                  <strong>Agrupamento:</strong> {config.groupBy === 'none' ? 'Sem agrupamento' : 
                                    config.groupBy === 'pavimento' ? 'Por pavimento' : 'Por tipologia'}
                                </div>
                                <div>
                                  <strong>Ordenação:</strong> {config.sortBy === 'codigo' ? 'Por código' :
                                    config.sortBy === 'pavimento' ? 'Por pavimento' :
                                    config.sortBy === 'tipologia' ? 'Por tipologia' : 'Por data de atualização'}
                                </div>
                                <div>
                                  <strong>Versão do PDF:</strong> {config.pdfOptions.variant === 'complete' ? 'Completa (com fotos)' : 'Compacta (sem fotos)'}
                                </div>
                                {config.pdfOptions.variant === 'complete' && (
                                  <div>
                                    <strong>Fotos por item:</strong> Até {config.pdfOptions.maxPhotosPerItem}
                                  </div>
                                )}
                                <div>
                                  <strong>Incluir fotos:</strong> {config.includeDetails.photos ? 'Sim' : 'Não'}
                                </div>
                                <div>
                                  <strong>Incluir observações:</strong> {config.includeDetails.observations ? 'Sim' : 'Não'}
                                </div>
                                {config.interlocutor === 'fornecedor' && (
                                  <div>
                                    <strong>Comentários do fornecedor:</strong> {config.includeDetails.supplierComments ? 'Sim' : 'Não'}
                                  </div>
                                )}
                                <div>
                                  <strong>Datas:</strong> {config.includeDetails.timestamps ? 'Sim' : 'Não'}
                                </div>
                                <div>
                                  <strong>Miniaturas:</strong> {config.includeDetails.photos && config.includeDetails.thumbnails ? 'Sim' : 'Não'}
                                </div>
                                <div>
                                  <strong>Colunas visíveis:</strong> {selectedColumnLabels.length > 0 ? selectedColumnLabels.join(', ') : 'Padrão'}
                                </div>
                              </div>
                            </div>
                          </>
                        ) : null}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </ScrollArea>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row pt-4 flex-shrink-0 border-t mt-4">
          {isGenerating && generatingFormat === 'pdf' && (
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{generationMessage || 'Gerando PDF...'}</span>
                <span>{`${Math.round(Math.max(0, Math.min(1, generationProgress)) * 100)}%`}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round(Math.max(0, Math.min(1, generationProgress)) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleRestoreDefaults}
            className="gap-2 w-full sm:w-auto"
            disabled={isGenerating}
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar Padrões
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto" disabled={isGenerating}>
            Cancelar
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-full sm:w-auto inline-block">
                  <Button
                    onClick={() => handleGenerate('pdf')}
                    disabled={isGenerating || !hasSelectedSections}
                    className="gap-2 w-full sm:w-auto"
                  >
                    {isGenerating && generatingFormat === 'pdf' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Gerando PDF...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Gerar PDF
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {!hasSelectedSections && (
                <TooltipContent>
                  <p>Selecione pelo menos uma seção</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-full sm:w-auto inline-block">
                  <Button
                    variant="outline"
                    onClick={() => handleGenerate('xlsx')}
                    disabled={isGenerating || !hasSelectedSections}
                    className="gap-2 w-full sm:w-auto"
                  >
                    {isGenerating && generatingFormat === 'xlsx' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Gerando Excel...
                      </>
                    ) : (
                      <>
                        <Table className="h-4 w-4" />
                        Gerar Excel
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {!hasSelectedSections && (
                <TooltipContent>
                  <p>Selecione pelo menos uma seção</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </DialogFooter>
        </ReportErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}
