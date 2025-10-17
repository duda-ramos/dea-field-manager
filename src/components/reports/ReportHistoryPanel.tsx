import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Table as TableIcon, Download, Trash2, Calendar, User, Search } from 'lucide-react';
import { storage } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDebounce } from '@/hooks/use-debounce';
import type { ReportHistoryEntry } from '@/types';

interface ReportHistoryPanelProps {
  projectId: string;
}

interface ReportStats {
  pendentes: number;
  concluidos: number;
  revisao: number;
}

export function ReportHistoryPanel({ projectId }: ReportHistoryPanelProps) {
  const [reports, setReports] = useState<ReportHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | 'pdf' | 'xlsx'>('all');
  const [interlocutorFilter, setInterlocutorFilter] = useState<'all' | 'cliente' | 'fornecedor'>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'week' | 'month' | '3months'>('all');
  const { toast } = useToast();

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    loadHistory();
  }, [projectId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const projectReports = await storage.getReports(projectId);
      setReports(projectReports);
    } catch (error) {
      console.error('Error loading report history:', error);
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
      await loadHistory();

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

  const getFormattedDate = (report: ReportHistoryEntry) => {
    const dateValue = report.generatedAt || report.generated_at;
    if (!dateValue) return '';

    try {
      return new Date(dateValue).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('[ReportHistoryPanel] Falha ao formatar data do relatório:', error, {
        reportId: report.id,
        dateValue: dateValue
      });
      return '';
    }
  };

  const extractStats = (report: ReportHistoryEntry): ReportStats => {
    // Try to extract stats from config or fallback to zeros
    const config = report.config || {};
    return {
      pendentes: config.stats?.pendentes || 0,
      concluidos: config.stats?.concluidos || 0,
      revisao: config.stats?.revisao || 0
    };
  };

  // Filter reports based on all filters
  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      // Search filter
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase();
        const matchesSearch = 
          report.fileName.toLowerCase().includes(searchLower) ||
          (report.generatedBy || report.generated_by || '').toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Format filter
      if (formatFilter !== 'all' && report.format !== formatFilter) {
        return false;
      }

      // Interlocutor filter
      if (interlocutorFilter !== 'all' && report.interlocutor !== interlocutorFilter) {
        return false;
      }

      // Period filter
      if (periodFilter !== 'all') {
        const dateValue = report.generatedAt || report.generated_at;
        if (!dateValue) return false;

        const reportDate = new Date(dateValue);
        const now = new Date();
        const diffDays = (now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24);

        if (periodFilter === 'week' && diffDays > 7) return false;
        if (periodFilter === 'month' && diffDays > 30) return false;
        if (periodFilter === '3months' && diffDays > 90) return false;
      }

      return true;
    });
  }, [reports, debouncedSearchTerm, formatFilter, interlocutorFilter, periodFilter]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Relatórios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Histórico de Relatórios</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Mostrando {filteredReports.length} de {reports.length} relatórios
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search" className="text-sm">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Nome do arquivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="period" className="text-sm">Período</Label>
            <Select value={periodFilter} onValueChange={(value: any) => setPeriodFilter(value)}>
              <SelectTrigger id="period">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mês</SelectItem>
                <SelectItem value="3months">Últimos 3 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="format" className="text-sm">Formato</Label>
            <Select value={formatFilter} onValueChange={(value: any) => setFormatFilter(value)}>
              <SelectTrigger id="format">
                <SelectValue placeholder="Selecione o formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="xlsx">XLSX</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interlocutor" className="text-sm">Interlocutor</Label>
            <Select value={interlocutorFilter} onValueChange={(value: any) => setInterlocutorFilter(value)}>
              <SelectTrigger id="interlocutor">
                <SelectValue placeholder="Selecione o interlocutor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="fornecedor">Fornecedor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Empty State */}
        {filteredReports.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum relatório encontrado</h3>
            <p className="text-muted-foreground">
              {reports.length === 0
                ? 'Gere um relatório para vê-lo aqui.'
                : 'Tente ajustar os filtros de busca.'}
            </p>
          </div>
        )}

        {/* Desktop Table View */}
        {filteredReports.length > 0 && (
          <>
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Formato</TableHead>
                    <TableHead>Gerado por</TableHead>
                    <TableHead>Estatísticas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => {
                    const stats = extractStats(report);
                    return (
                      <TableRow key={report.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-sm">{formatGeneratedAt(report)}</div>
                              <div className="text-xs text-muted-foreground">
                                {getFormattedDate(report)}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {report.format === 'pdf' ? (
                              <FileText className="h-4 w-4 text-red-500" />
                            ) : (
                              <TableIcon className="h-4 w-4 text-green-500" />
                            )}
                            <div className="max-w-[200px] truncate" title={report.fileName}>
                              {report.fileName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={report.interlocutor === 'cliente' ? 'default' : 'secondary'}
                            className={report.interlocutor === 'cliente' ? 'bg-blue-500' : 'bg-green-500'}
                          >
                            {report.interlocutor || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">
                            {report.format}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {report.generatedBy || report.generated_by || 'Sistema'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-mono">
                            <span className="text-orange-600">P: {stats.pendentes}</span>
                            {' | '}
                            <span className="text-green-600">C: {stats.concluidos}</span>
                            {' | '}
                            <span className="text-blue-600">R: {stats.revisao}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(report)}
                              title="Baixar relatório"
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredReports.map((report) => {
                const stats = extractStats(report);
                return (
                  <Card key={report.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        {report.format === 'pdf' ? (
                          <FileText className="h-8 w-8 text-red-500 shrink-0" />
                        ) : (
                          <TableIcon className="h-8 w-8 text-green-500 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate" title={report.fileName}>
                            {report.fileName}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatGeneratedAt(report)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Destinatário:</span>
                          <div className="mt-1">
                            <Badge 
                              variant={report.interlocutor === 'cliente' ? 'default' : 'secondary'}
                              className={report.interlocutor === 'cliente' ? 'bg-blue-500' : 'bg-green-500'}
                            >
                              {report.interlocutor || 'N/A'}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Formato:</span>
                          <div className="mt-1">
                            <Badge variant="outline" className="uppercase">
                              {report.format}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="text-sm">
                        <span className="text-muted-foreground">Gerado por:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <User className="h-3 w-3" />
                          {report.generatedBy || report.generated_by || 'Sistema'}
                        </div>
                      </div>

                      <div className="text-sm">
                        <span className="text-muted-foreground">Estatísticas:</span>
                        <div className="font-mono mt-1">
                          <span className="text-orange-600">P: {stats.pendentes}</span>
                          {' | '}
                          <span className="text-green-600">C: {stats.concluidos}</span>
                          {' | '}
                          <span className="text-blue-600">R: {stats.revisao}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(report)}
                          className="flex-1 gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Baixar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(report.id)}
                          className="flex-1 gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
