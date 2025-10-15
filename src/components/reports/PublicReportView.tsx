import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Download, 
  RefreshCw, 
  AlertCircle, 
  Calendar,
  CheckCircle,
  Clock,
  Search,
  Filter,
  Image as ImageIcon,
  Building,
  FileText
} from 'lucide-react';
import { reportSharingService } from '@/services/reportSharing';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Installation, PublicReportData } from '@/types';

type SectionFilters = Record<string, boolean> | undefined;

const calculateStats = (installations: Installation[]) => ({
  total: installations.length,
  completed: installations.filter(i => i.installed).length,
  pending: installations.filter(i => !i.installed && i.status === 'pendente').length,
  in_progress: installations.filter(i => !i.installed && i.status === 'ativo').length,
  in_review: installations.filter(i => !i.installed && i.status === 'on hold').length,
});

const filterInstallationsBySections = (
  installations: Installation[],
  sections: SectionFilters
) => {
  if (!sections) {
    return installations;
  }

  const hasSelectedSection = Object.values(sections).some(Boolean);

  if (!hasSelectedSection) {
    return [];
  }

  return installations.filter(installation => {
    const isCompleted = installation.installed;
    const isPending = !installation.installed && installation.status === 'pendente';
    const isInProgress = !installation.installed && installation.status === 'ativo';
    const isInReview = !installation.installed && installation.status === 'on hold';

    return (
      (sections.pendencias && isPending) ||
      (sections.concluidas && isCompleted) ||
      (sections.emAndamento && isInProgress) ||
      (sections.emRevisao && isInReview)
    );
  });
};

type FilterType = 'all' | 'completed' | 'pending';

export function PublicReportView() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<PublicReportData | null>(null);
  const [linkExpired, setLinkExpired] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Validar token e buscar dados do relatório
  useEffect(() => {
    if (!token) {
      setError('Link inválido');
      setLoading(false);
      return;
    }

    validateAndFetchReport();
  }, [token]);

  const validateAndFetchReport = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validar o token
      const accessData = await reportSharingService.validatePublicToken(token!);
      
      if (!accessData) {
        setError('Link não encontrado ou inválido');
        setLinkExpired(true);
        setLoading(false);
        return;
      }

      // Verificar se o link expirou
      const expiresAt = new Date(accessData.expires_at);
      if (expiresAt < new Date()) {
        setError(`Este link expirou em ${format(expiresAt, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}`);
        setLinkExpired(true);
        setLoading(false);
        return;
      }

      // Buscar dados do projeto
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('name, client')
        .eq('id', accessData.project_id)
        .single();

      if (projectError) {
        console.error('Erro ao buscar projeto:', projectError);
      }

      // Buscar instalações se incluídas no relatório
      let installations: Installation[] = [];
      if (accessData.sections_included?.pendencias ||
          accessData.sections_included?.concluidas ||
          accessData.sections_included?.emAndamento ||
          accessData.sections_included?.emRevisao) {

        const { data: installData, error: installError } = await supabase
          .from('installations')
          .select('*')
          .eq('project_id', accessData.project_id)
          .order('codigo', { ascending: true });

        if (installError) {
          console.error('Erro ao buscar instalações:', installError);
        } else {
          installations = installData || [];
        }
      }

      const filteredInstallations = filterInstallationsBySections(
        installations,
        accessData.sections_included
      );
      const computedStats = calculateStats(filteredInstallations);
      const stats = {
        ...(accessData.stats || {}),
        ...computedStats,
      };

      // Montar dados do relatório
      const reportData: PublicReportData = {
        id: accessData.report_id,
        project_name: project?.name || 'Projeto',
        client_name: project?.client,
        generated_at: accessData.generated_at,
        expires_at: accessData.expires_at,
        format: accessData.format,
        file_url: accessData.file_url,
        sections_included: accessData.sections_included,
        stats,
        installations: filteredInstallations,
        interlocutor: accessData.interlocutor
      };

      setReportData(reportData);
    } catch (err) {
      console.error('Erro ao validar token:', err);
      setError('Erro ao carregar relatório. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar instalações
  const visibleInstallations = reportData?.installations?.filter(installation => {
    // Aplicar filtro de status
    if (filter === 'completed' && !installation.installed) return false;
    if (filter === 'pending' && installation.installed) return false;

    // Aplicar busca
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        installation.descricao.toLowerCase().includes(search) ||
        installation.codigo.toString().includes(search) ||
        installation.tipologia.toLowerCase().includes(search)
      );
    }

    return true;
  }) || [];

  // Download do arquivo PDF/XLSX
  const handleDownload = async () => {
    if (!reportData?.file_url) return;

    try {
      // Obter URL pública do arquivo
      const { data } = supabase.storage
        .from('reports')
        .getPublicUrl(reportData.file_url);

      if (data?.publicUrl) {
        window.open(data.publicUrl, '_blank');
      }
    } catch (err) {
      console.error('Erro ao baixar arquivo:', err);
    }
  };

  // Renderizar estado de carregamento
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header skeleton */}
          <div className="bg-card rounded-lg p-6 shadow-sm">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-4 w-64" />
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Content skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Renderizar erro
  if (error || !reportData) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-6">
            <Alert variant={linkExpired ? "default" : "destructive"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{linkExpired ? "Link expirado" : "Erro"}</AlertTitle>
              <AlertDescription className="mt-2">
                {error || "Não foi possível carregar o relatório."}
              </AlertDescription>
            </Alert>
            
            {!linkExpired && (
              <Button 
                onClick={() => validateAndFetchReport()} 
                className="w-full mt-4"
                variant="outline"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Renderizar relatório
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Building className="h-6 w-6" />
                DEA Manager
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Relatório de Instalações
              </p>
            </div>
            
            {reportData.format === 'pdf' && reportData.file_url && (
              <Button onClick={handleDownload} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Baixar PDF
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Informações do projeto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Informações do Projeto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Projeto</p>
                <p className="font-medium">{reportData.project_name}</p>
              </div>
              {reportData.client_name && (
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{reportData.client_name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Gerado em</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(reportData.generated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Para</p>
                <p className="font-medium capitalize">{reportData.interlocutor}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Itens</p>
                  <p className="text-2xl font-bold">{reportData.stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Concluídos</p>
                  <p className="text-2xl font-bold text-green-600">{reportData.stats.completed}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-600">{reportData.stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Progresso</p>
                  <p className="text-2xl font-bold">
                    {reportData.stats.total > 0 
                      ? Math.round((reportData.stats.completed / reportData.stats.total) * 100)
                      : 0}%
                  </p>
                </div>
                <div className="relative h-8 w-8">
                  <svg className="h-8 w-8 transform -rotate-90">
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      className="text-muted-foreground/20"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 14}`}
                      strokeDashoffset={`${2 * Math.PI * 14 * (1 - (reportData.stats.completed / reportData.stats.total || 0))}`}
                      className="text-primary transition-all duration-300"
                    />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de instalações */}
        {reportData.installations && reportData.installations.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-xl">Instalações</CardTitle>
                
                {/* Controles de filtro e busca */}
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Filtros */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={filter === 'all' ? 'default' : 'outline'}
                      onClick={() => setFilter('all')}
                    >
                      <Filter className="h-4 w-4 mr-1" />
                      Todos
                    </Button>
                    <Button
                      size="sm"
                      variant={filter === 'completed' ? 'default' : 'outline'}
                      onClick={() => setFilter('completed')}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Concluídos
                    </Button>
                    <Button
                      size="sm"
                      variant={filter === 'pending' ? 'default' : 'outline'}
                      onClick={() => setFilter('pending')}
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      Pendentes
                    </Button>
                  </div>

                  {/* Busca */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Buscar por código ou descrição..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-full sm:w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {visibleInstallations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma instalação encontrada
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleInstallations.map((installation) => (
                    <Card key={installation.id} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-muted-foreground">
                                #{installation.codigo}
                              </span>
                              <Badge variant={installation.installed ? "success" : "secondary"}>
                                {installation.installed ? "Concluído" : "Pendente"}
                              </Badge>
                            </div>
                            <h4 className="font-medium">{installation.descricao}</h4>
                            <p className="text-sm text-muted-foreground">
                              {installation.tipologia} • {installation.pavimento}
                            </p>
                          </div>
                          <Badge variant="outline">
                            Qtd: {installation.quantidade}
                          </Badge>
                        </div>
                      </CardHeader>
                      
                      {(installation.observacoes || installation.comentarios_fornecedor || installation.pendencia_descricao || installation.photos?.length) && (
                        <CardContent className="pt-0 space-y-3">
                          {installation.observacoes && (
                            <div className="text-sm">
                              <p className="font-medium text-muted-foreground">Observações:</p>
                              <p>{installation.observacoes}</p>
                            </div>
                          )}
                          
                          {installation.comentarios_fornecedor && (
                            <div className="text-sm">
                              <p className="font-medium text-muted-foreground">Comentários do Fornecedor:</p>
                              <p>{installation.comentarios_fornecedor}</p>
                            </div>
                          )}
                          
                          {installation.pendencia_descricao && (
                            <div className="text-sm">
                              <p className="font-medium text-muted-foreground">
                                Pendência ({installation.pendencia_tipo}):
                              </p>
                              <p className="text-yellow-600">{installation.pendencia_descricao}</p>
                            </div>
                          )}
                          
                          {installation.photos && installation.photos.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-2">Fotos:</p>
                              <div className="grid grid-cols-3 gap-2">
                                {installation.photos.slice(0, 3).map((photo, index) => (
                                  <button
                                    key={index}
                                    onClick={() => setSelectedPhoto(photo)}
                                    className="relative aspect-square rounded-md overflow-hidden bg-muted hover:opacity-80 transition-opacity"
                                  >
                                    <img 
                                      src={photo} 
                                      alt={`Foto ${index + 1}`}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                    {index === 2 && installation.photos!.length > 3 && (
                                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <span className="text-white text-sm font-medium">
                                          +{installation.photos!.length - 3}
                                        </span>
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-8 border-t">
          <p className="text-sm text-muted-foreground">
            Relatório gerado por <span className="font-medium">DEA Manager</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Este link expira em {format(new Date(reportData.expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </main>

      {/* Modal de foto ampliada */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Visualizar Foto</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="relative aspect-video">
              <img 
                src={selectedPhoto} 
                alt="Foto ampliada"
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}