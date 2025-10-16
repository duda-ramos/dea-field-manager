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
import { Eye, Download, FileText, Table, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import { calculateReportSections, calculatePavimentoSummary, ReportSections, PavimentoSummary } from '@/lib/reports-new';
import { StorageBar } from '@/components/storage-bar';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/use-toast';
import { showToast } from '@/lib/toast';
import { ReportErrorBoundary } from './report-error-boundary';
import type { ReportCustomizationModalProps, ReportConfig } from './ReportCustomizationModal.types';
import { DEFAULT_REPORT_CONFIG, REPORT_CONFIG_STORAGE_KEY } from './ReportCustomizationModal.constants';

export function ReportCustomizationModal({
  isOpen,
  onClose,
  onGenerate,
  onShare,
  project,
  installations,
}: ReportCustomizationModalProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_REPORT_CONFIG);
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
  const [activeTab, setActiveTab] = useState('sections');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Load saved preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REPORT_CONFIG_STORAGE_KEY);
      if (saved) {
        const savedConfig = JSON.parse(saved);
        setConfig(savedConfig);
      }
    } catch (error) {
      console.error('Error loading saved preferences:', error);
    }
  }, []);

  // Save preferences to localStorage whenever config changes
  useEffect(() => {
    try {
      localStorage.setItem(REPORT_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  }, [config]);

  // Calculate preview data with useMemo
  const calculatePreview = useCallback((currentConfig: ReportConfig) => {
    setIsLoadingPreview(true);
    try {
      const versions: any[] = []; // Simplified for preview
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
    } catch (error) {
      console.error('Error updating preview:', error);
      toast({
        title: 'Erro ao atualizar prévia',
        description: 'Não foi possível calcular a prévia do relatório.',
        variant: 'destructive',
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
    setConfig(prev => ({
      ...prev,
      includeDetails: {
        ...prev.includeDetails,
        [detail]: !prev.includeDetails[detail],
      },
    }));
  }, []);

  const handleRestoreDefaults = useCallback(() => {
    setConfig(defaultConfig);
    toast({
      title: 'Preferências restauradas',
      description: 'As configurações padrão foram restauradas.',
    });
    showToast.success('Preferências restauradas', 'As configurações padrão foram restauradas.');
  }, [toast]);

  const handleGenerate = useCallback(async (format: 'pdf' | 'xlsx') => {
    if (!hasSelectedSections) {
      toast({
        title: 'Seleção necessária',
        description: 'Selecione pelo menos uma seção para gerar o relatório.',
        variant: 'destructive',
      });
      showToast.error('Seleção necessária', 'Selecione pelo menos uma seção para gerar o relatório.');
      return;
    }

    setIsGenerating(true);
    setGeneratingFormat(format);
    try {
      const blob = await onGenerate(config, format);
      onShare(blob, format, config);
      toast({
        title: 'Relatório gerado com sucesso',
        description: `O relatório ${format.toUpperCase()} foi gerado.`,
      });
      showToast.success(
        'Relatório gerado com sucesso',
        `O relatório ${format.toUpperCase()} foi gerado.`
      );
      onClose();
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'Erro ao gerar relatório',
        description: error instanceof Error ? error.message : 'Não foi possível gerar o relatório. Tente novamente.',
        variant: 'destructive',
      });
      showToast.error(
        'Erro ao gerar relatório',
        error instanceof Error ? error.message : 'Não foi possível gerar o relatório. Tente novamente.'
      );
    } finally {
      setIsGenerating(false);
      setGeneratingFormat(null);
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
                                onClick={() => setConfig(prev => ({ ...prev, groupBy: option.value as any }))}
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
                                onClick={() => setConfig(prev => ({ ...prev, sortBy: option.value as any }))}
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
                        {Object.entries(config.includeDetails).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={key}
                                checked={value}
                                onCheckedChange={() => handleDetailToggle(key as keyof ReportConfig['includeDetails'])}
                              />
                              <Label htmlFor={key} className="text-sm font-medium cursor-pointer">
                                {getDetailLabel(key)}
                              </Label>
                            </div>
                          </div>
                        ))}
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
                                  <strong>Incluir fotos:</strong> {config.includeDetails.photos ? 'Sim' : 'Não'}
                                </div>
                                <div>
                                  <strong>Incluir observações:</strong> {config.includeDetails.observations ? 'Sim' : 'Não'}
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
