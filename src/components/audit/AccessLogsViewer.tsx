import { useState, useEffect } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { getUserAccessLogs, AccessLog } from '@/services/userManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { toast } from '@/hooks/use-toast';
import { Activity, RefreshCw, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AccessLogsViewerProps {
  userId?: string;
  title?: string;
  description?: string;
  maxHeight?: string;
}

export function AccessLogsViewer({
  userId,
  title = 'Logs de Acesso',
  description = 'Histórico de ações e acessos no sistema',
  maxHeight = '600px',
}: AccessLogsViewerProps) {
  const auth = useAuthContext();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    loadLogs();
  }, [userId, limit]);

  async function loadLogs() {
    setLoading(true);
    try {
      const { data, error } = await getUserAccessLogs(userId, limit);

      if (error) throw error;

      setLogs(data || []);
    } catch (error) {
      console.error('Error loading access logs:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar logs de acesso',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function getActionBadge(action: string) {
    const colors: Record<string, string> = {
      login: 'default',
      logout: 'secondary',
      create: 'default',
      update: 'secondary',
      delete: 'destructive',
      view: 'outline',
      download: 'outline',
      export: 'secondary',
      import: 'secondary',
    };

    const actionType = action.split('_')[0].toLowerCase();
    const variant = colors[actionType] || 'outline';

    return <Badge variant={variant as any}>{action}</Badge>;
  }

  function getResourceTypeLabel(resourceType: string | null): string {
    if (!resourceType) return '-';

    const labels: Record<string, string> = {
      projects: 'Projeto',
      installations: 'Instalação',
      contacts: 'Contato',
      budgets: 'Orçamento',
      files: 'Arquivo',
      reports: 'Relatório',
      users: 'Usuário',
      profiles: 'Perfil',
    };

    return labels[resourceType] || resourceType;
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchTerm ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.resource_type && log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAction = actionFilter === 'all' || log.action.includes(actionFilter);

    return matchesSearch && matchesAction;
  });

  // Get unique actions for filter
  const uniqueActions = Array.from(new Set(logs.map((log) => log.action.split('_')[0])));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Label htmlFor="search">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Buscar por ação ou recurso..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="w-[180px]">
            <Label htmlFor="action-filter">Filtrar por Ação</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger id="action-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[120px]">
            <Label htmlFor="limit">Limite</Label>
            <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
              <SelectTrigger id="limit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Logs Table */}
        <div style={{ maxHeight, overflow: 'auto' }}>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              Carregando logs...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>
                      {log.resource_type ? (
                        <div>
                          <div className="font-medium">
                            {getResourceTypeLabel(log.resource_type)}
                          </div>
                          {log.resource_id && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {log.resource_id.substring(0, 8)}...
                            </div>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {log.ip_address || '-'}
                    </TableCell>
                    <TableCell>
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-primary hover:underline">
                            Ver detalhes
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-w-md">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum log encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Summary */}
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Exibindo {filteredLogs.length} de {logs.length} logs
          </div>
          {auth.isAdmin && !userId && (
            <div>Visualizando logs de todos os usuários</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
