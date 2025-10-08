import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Table, Download, Trash2, Calendar, User } from 'lucide-react';
import { storage } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ReportHistoryEntry } from '@/types';

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
      const projectReports = await storage.getReports(projectId);
      setReports(projectReports);
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

  const handleDownload = (report: ReportHistoryEntry) => {
    try {
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
    } catch (error) {
      console.error('Error downloading report:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível baixar o relatório',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este relatório?')) return;

    try {
      await storage.deleteReport(reportId);
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

                        <span className="text-xs">
                          {formatFileSize(report.size ?? report.blob?.size)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(report)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(report.id)}
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
