import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Eye, Download, FileText, Table } from 'lucide-react';
import { Installation, Project } from '@/types';
import { calculateReportSections, calculatePavimentoSummary } from '@/lib/reports-new';
import { StorageBar } from '@/components/storage-bar';

interface ReportCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: ReportConfig, format: 'pdf' | 'xlsx') => Promise<Blob>;
  onShare: (blob: Blob, format: 'pdf' | 'xlsx', config: ReportConfig) => void;
  project: Project;
  installations: Installation[];
  interlocutor: 'cliente' | 'fornecedor';
}

export interface ReportConfig {
  sections: {
    pendencias: boolean;
    concluidas: boolean;
    emRevisao: boolean;
    emAndamento: boolean;
  };
  includeDetails: {
    photos: boolean;
    observations: boolean;
    supplierComments: boolean;
    timestamps: boolean;
    pavimentoSummary: boolean;
    storageChart: boolean;
  };
  groupBy: 'none' | 'pavimento' | 'tipologia';
  sortBy: 'codigo' | 'pavimento' | 'tipologia' | 'updated_at';
}

const defaultConfig: ReportConfig = {
  sections: {
    pendencias: true,
    concluidas: true,
    emRevisao: true,
    emAndamento: true,
  },
  includeDetails: {
    photos: true,
    observations: true,
    supplierComments: true,
    timestamps: true,
    pavimentoSummary: true,
    storageChart: true,
  },
  groupBy: 'pavimento',
  sortBy: 'codigo',
};

export function ReportCustomizationModal({
  isOpen,
  onClose,
  onGenerate,
  onShare,
  project,
  installations,
  interlocutor,
}: ReportCustomizationModalProps) {
  const [config, setConfig] = useState<ReportConfig>(defaultConfig);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('sections');

  useEffect(() => {
    if (isOpen && installations.length > 0) {
      updatePreview();
    }
  }, [isOpen, installations, config, interlocutor]);

  const updatePreview = () => {
    try {
      const versions: any[] = []; // Simplified for preview
      const reportData = {
        project,
        installations,
        versions,
        generatedBy: project.owner || 'Sistema',
        generatedAt: new Date().toISOString(),
        interlocutor,
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
    }
  };

  const handleSectionToggle = (section: keyof ReportConfig['sections']) => {
    setConfig(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: !prev.sections[section],
      },
    }));
  };

  const handleDetailToggle = (detail: keyof ReportConfig['includeDetails']) => {
    setConfig(prev => ({
      ...prev,
      includeDetails: {
        ...prev.includeDetails,
        [detail]: !prev.includeDetails[detail],
      },
    }));
  };

  const handleGenerate = async (format: 'pdf' | 'xlsx') => {
    setIsGenerating(true);
    try {
      const blob = await onGenerate(config, format);
      onShare(blob, format, config);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const getSectionLabel = (section: string) => {
    const labels = {
      pendencias: 'Pendências',
      concluidas: 'Concluídas',
      emRevisao: 'Em Revisão',
      emAndamento: interlocutor === 'fornecedor' ? 'Aguardando Instalação' : 'Em Andamento',
    };
    return labels[section as keyof typeof labels] || section;
  };

  const getDetailLabel = (detail: string) => {
    const labels = {
      photos: 'Fotos das Instalações',
      observations: 'Observações',
      supplierComments: 'Comentários do Fornecedor',
      timestamps: 'Datas de Criação/Atualização',
      pavimentoSummary: 'Resumo por Pavimento',
      storageChart: 'Gráfico de Status',
    };
    return labels[detail as keyof typeof labels] || detail;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] sm:max-w-4xl flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-lg sm:text-xl">Personalizar Relatório</DialogTitle>
          <DialogDescription className="text-sm">
            Configure as informações que devem ser incluídas no seu relatório e veja uma prévia antes de gerar.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 h-9 shrink-0">
            <TabsTrigger value="sections" className="text-xs sm:text-sm">Seções</TabsTrigger>
            <TabsTrigger value="details" className="text-xs sm:text-sm">Detalhes</TabsTrigger>
            <TabsTrigger value="preview" className="text-xs sm:text-sm">Prévia</TabsTrigger>
          </TabsList>

          <div className="flex-1 mt-4 min-h-0">
            <ScrollArea className="h-full max-h-[calc(95vh-200px)]">
              <TabsContent value="sections" className="space-y-4 mt-0 pr-4">
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

              <TabsContent value="details" className="space-y-4 mt-0 pr-4">
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

              <TabsContent value="preview" className="space-y-4 mt-0 pr-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Prévia do Relatório
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {previewData && (
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
                              {interlocutor === 'fornecedor' ? 'Aguardando' : 'Em Andamento'}
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
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>

        <DialogFooter className="gap-2 flex-col sm:flex-row pt-4 shrink-0 border-t">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={() => handleGenerate('pdf')}
            disabled={isGenerating}
            className="gap-2 w-full sm:w-auto"
          >
            <FileText className="h-4 w-4" />
            {isGenerating ? 'Gerando...' : 'Gerar PDF'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleGenerate('xlsx')}
            disabled={isGenerating}
            className="gap-2 w-full sm:w-auto"
          >
            <Table className="h-4 w-4" />
            {isGenerating ? 'Gerando...' : 'Gerar Excel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}