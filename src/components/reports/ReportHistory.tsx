import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Table, Download, Trash2, Calendar, User, ExternalLink } from 'lucide-react';
import { storage } from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ReportHistoryEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface ReportHistoryProps {
  projectId: string;
}

export function ReportHistory({ projectId }: ReportHistoryProps) {
  const [reports, setReports] = useState<ReportHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadReports();
  }, [projectId]);

  const loadReports = async () => {
    try {
      setLoading(true);
      
      // Load from local storage
      const localReports = await storage.getReports(projectId);
      
      // Load from Supabase
      const supabaseReports: any[] = [];
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        try {
          const { data, error } = await supabase
            .from('report_history')
            .select('*')
            .eq('project_id', projectId)
            .order('generated_at', { ascending: false });

          if (error) {
            console.error('Error loading reports from Supabase:', error);
          } else if (data) {
            // Transform Supabase data to ReportHistoryEntry format
            supabaseReports.push(...data.map(report => ({
              id: report.id,
              projectId: report.project_id,
              project_id: report.project_id,
              fileName: report.file_name,
              format: report.format as 'pdf' | 'xlsx',
              interlocutor: report.interlocutor as 'cliente' | 'fornecedor',
              config: report.sections_included || {},
              generatedAt: report.generated_at,
              generated_at: report.generated_at,
              generatedBy: report.generated_by,
              generated_by: report.generated_by,
              storagePath: report.file_url,
              stats: report.stats,
              source: 'supabase', // Mark as Supabase source
              userId: report.user_id
            })));
          }
        } catch (error) {
          console.error('Error fetching Supabase reports:', error);
        }
      }

      // Merge reports, prioritizing Supabase reports (remove duplicates from local)
      const supabaseFileNames = new Set(supabaseReports.map(r => r.fileName));
      const filteredLocalReports = localReports.filter(r => !supabaseFileNames.has(r.fileName));
      
      const allReports = [...supabaseReports, ...filteredLocalReports];
      setReports(allReports);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o histórico de relatórios',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const convertBase64ToBlob = (dataUrl: string, fallbackMime?: string) => {
    const [header, data] = dataUrl.split(',');
    if (!header || !data) {
      throw new Error('Dados do relatório inválidos');
    }

    const mimeMatch = header.match(/data:(.*);base64/);
    const mimeType = mimeMatch?.[1] ?? fallbackMime ?? 'application/octet-stream';
    const byteCharacters = atob(data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const resolveReportBlob = (report: ReportHistoryEntry) => {
    if (report.blob instanceof Blob) {
      return report.blob;
    }

    if (typeof report.blobData === 'string') {
      return convertBase64ToBlob(report.blobData, report.mimeType);
    }

    return undefined;
  };

  const handleDownload = async (report: ReportHistoryEntry) => {
    try {
      // If report is from Supabase, download directly from storage
      if ((report as any).source === 'supabase' && (report as any).storagePath) {
        const storagePath = (report as any).storagePath as string;

        const { data, error } = await supabase.storage
          .from('reports')
          .download(storagePath);

        if (error || !data) {
          throw new Error('Falha ao baixar arquivo do servidor');
        }

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = report.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'Download realizado',
          description: 'Relatório baixado com sucesso'
        });
      } else {
        // Local storage report
        const blob = resolveReportBlob(report);
        if (!blob) {
          throw new Error('Arquivo do relatório indisponível');
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = report.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'Download realizado',
          description: 'Relatório baixado com sucesso'
        });
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível baixar o relatório',
        variant: 'destructive'
      });
    }
  };

  const handleOpenInBrowser = async (report: ReportHistoryEntry) => {
    if (!((report as any).source === 'supabase' && (report as any).storagePath)) {
      return;
    }

    try {
      const storagePath = (report as any).storagePath as string;
      const { data, error } = await supabase.storage
        .from('reports')
        .createSignedUrl(storagePath, 60);

      if (error || !data?.signedUrl) {
        throw new Error('Não foi possível gerar o link do relatório');
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening report in browser:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível abrir o relatório na nuvem',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este relatório?')) return;

    try {
      const report = reports.find(r => r.id === reportId);
      const { data: { user } } = await supabase.auth.getUser();
      
      // Delete from Supabase if it's a Supabase report
      if (report && (report as any).source === 'supabase') {
        // Delete from database
        const { error: dbError } = await supabase
          .from('report_history')
          .delete()
          .eq('id', reportId);

        if (dbError) {
          console.error('Error deleting from Supabase database:', dbError);
        }

        // Delete from storage
        if ((report as any).storagePath && user) {
          const { error: storageError } = await supabase.storage
            .from('reports')
            .remove([(report as any).storagePath]);

          if (storageError) {
            console.error('Error deleting from Supabase storage:', storageError);
          }
        }
      }
      
      // Delete from local storage
      try {
        await storage.deleteReport(reportId);
      } catch (error) {
        console.error('Error deleting from local storage:', error);
      }

      await loadReports();

      toast({
        title: 'Relatório excluído',
        description: 'O relatório foi removido do histórico'
      });
    } catch (error) {
      console.error('Error deleting report:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o relatório',
        variant: 'destructive'
      });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    return `${Math.round(value * 100) / 100} ${sizes[i]}`;
  };

  const formatGeneratedAt = (report: ReportHistoryEntry) => {
    const dateValue = report.generatedAt || report.generated_at;
    if (!dateValue) return 'Data desconhecida';

    try {
      return formatDistanceToNow(new Date(dateValue), {
        addSuffix: true,
        locale: ptBR
      });
    } catch (error) {
      console.error('Error formatting report date:', error);
      return 'Data desconhecida';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Relatórios</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando histórico...</p>
        </CardContent>
      </Card>
    );
  }

  if (reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Relatórios</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhum relatório gerado ainda.
            <br />
            Gere um relatório para vê-lo aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Histórico de Relatórios</span>
          <Badge variant="secondary">{reports.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {reports.map((report) => (
              <Card key={report.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {report.format === 'pdf' ? (
                      <FileText className="h-8 w-8 text-red-500 shrink-0 mt-1" />
                    ) : (
                      <Table className="h-8 w-8 text-green-500 shrink-0 mt-1" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{report.fileName}</div>

                      <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatGeneratedAt(report)}
                        </div>

                        {(report.generatedBy || report.generated_by) && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {report.generatedBy || report.generated_by}
                          </div>
                        )}

                        <Badge variant="outline" className="text-xs">
                          {report.interlocutor || 'N/A'}
                        </Badge>

                        {(report as any).source === 'supabase' && (
                          <Badge variant="default" className="text-xs">
                            ☁️ Cloud
                          </Badge>
                        )}

                        <span className="text-xs">
                          {formatFileSize(report.size ?? report.blob?.size)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {(report as any).source === 'supabase' && (report as any).storagePath && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenInBrowser(report)}
                        title="Abrir no navegador"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(report)}
                      title="Baixar arquivo"
                    >
                      <Download className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(report.id)}
                      title="Excluir relatório"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
