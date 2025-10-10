import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Activity, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Database, 
  Upload, 
  Download, 
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Wifi,
  WifiOff,
  Eye,
  Trash2
} from 'lucide-react';
import { syncStateManager, type SyncState, type SyncLogEntry } from '@/services/sync/syncState';
import { fullSync, syncPush, syncPull } from '@/services/sync/sync';
import { useToast } from '@/hooks/use-toast';
import { getSyncPreferences } from '@/lib/preferences';
import { realtimeManager } from '@/services/realtime/realtime';

export function SyncStatusPanel() {
  const [syncState, setSyncState] = useState<SyncState>(syncStateManager.getState());
  const [isExpanded, setIsExpanded] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = syncStateManager.subscribe(setSyncState);
    
    // Check realtime status
    const prefs = getSyncPreferences();
    const envEnabled = import.meta.env.VITE_REALTIME_ENABLED === 'true';
    setRealtimeEnabled(envEnabled && (prefs.realtimeEnabled ?? false));
    
    return unsubscribe;
  }, []);

  const handleFullSync = async () => {
    try {
      await fullSync();
      toast({
        title: "Sincronização Completa",
        description: "Push e Pull executados com sucesso!"
      });
    } catch (error) {
      toast({
        title: "Erro na Sincronização",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  const handlePushOnly = async () => {
    try {
      await syncPush();
      toast({
        title: "Push Concluído",
        description: "Dados locais enviados para a nuvem!"
      });
    } catch (error) {
      toast({
        title: "Erro no Push",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  const handlePullOnly = async () => {
    try {
      await syncPull();
      toast({
        title: "Pull Concluído",
        description: "Dados atualizados da nuvem!"
      });
    } catch (error) {
      toast({
        title: "Erro no Pull",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusIcon = () => {
    if (!syncState.isOnline) return <WifiOff className="h-5 w-5 text-red-500" />;
    if (syncState.status === 'syncing') return <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />;
    if (syncState.status === 'error') return <AlertCircle className="h-5 w-5 text-red-500" />;
    if (syncState.pendingPush > 0) return <Clock className="h-5 w-5 text-yellow-500" />;
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  };

  const getStatusText = () => {
    if (!syncState.isOnline) return 'Offline';
    if (syncState.status === 'syncing') return 'Sincronizando...';
    if (syncState.status === 'error') return 'Erro';
    if (syncState.pendingPush > 0) return 'Pendente';
    return 'Atualizado';
  };

  const getStatusColor = () => {
    if (!syncState.isOnline) return 'destructive';
    if (syncState.status === 'syncing') return 'default';
    if (syncState.status === 'error') return 'destructive';
    if (syncState.pendingPush > 0) return 'secondary';
    return 'default';
  };

  const getLogIcon = (type: SyncLogEntry['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const stats = syncStateManager.getSyncStats();

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            Status do Sync
            <Badge variant={getStatusColor()}>{getStatusText()}</Badge>
            <Badge 
              variant={realtimeEnabled ? "default" : "outline"} 
              className={realtimeEnabled ? "bg-green-600 hover:bg-green-700" : ""}
              title={realtimeEnabled ? "Realtime ativo" : "Realtime desativado - ative em Configurações"}
            >
              <Wifi className={`h-3 w-3 mr-1 ${realtimeEnabled ? '' : 'opacity-50'}`} />
              Realtime: {realtimeEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => syncStateManager.clearLogs()}
              disabled={syncState.logs.length === 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-primary">{syncState.pendingPush}</div>
            <div className="text-sm text-muted-foreground">Pendentes</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.isHealthy ? '✓' : '✗'}</div>
            <div className="text-sm text-muted-foreground">Status</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {syncState.metrics.lastSyncDuration ? formatDuration(syncState.metrics.lastSyncDuration) : '—'}
            </div>
            <div className="text-sm text-muted-foreground">Duração</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {syncState.metrics.cursor ? new Date(syncState.metrics.cursor).toLocaleDateString() : '—'}
            </div>
            <div className="text-sm text-muted-foreground">Cursor</div>
          </div>
        </div>

        {/* Progress */}
        {syncState.progress && (
          <Alert>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <AlertDescription>
              {syncState.progress.operation} ({syncState.progress.current}/{syncState.progress.total})
            </AlertDescription>
          </Alert>
        )}

        {/* Error Details */}
        {syncState.lastError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{syncState.lastError.message}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowErrorDetails(!showErrorDetails)}
              >
                <Eye className="h-4 w-4 mr-1" />
                Detalhes
              </Button>
            </AlertDescription>
            {showErrorDetails && syncState.lastError.stack && (
              <pre className="mt-2 text-xs bg-muted/50 p-2 rounded overflow-auto max-h-32">
                {syncState.lastError.stack}
              </pre>
            )}
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleFullSync}
            disabled={syncState.status === 'syncing' || !syncState.isOnline}
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Sync Completo
          </Button>
          <Button
            onClick={handlePushOnly}
            disabled={syncState.status === 'syncing' || !syncState.isOnline || syncState.pendingPush === 0}
            variant="outline"
            size="sm"
          >
            <Upload className="h-4 w-4 mr-1" />
            Apenas Push
          </Button>
          <Button
            onClick={handlePullOnly}
            disabled={syncState.status === 'syncing' || !syncState.isOnline}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-1" />
            Apenas Pull
          </Button>
        </div>

        <Collapsible open={isExpanded}>
          <CollapsibleContent className="space-y-4">
            <Separator />
            
            {/* Detailed Metrics */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                Pendências por Tabela
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {Object.entries(syncState.pendingByTable).map(([table, count]) => (
                  <div key={table} className="flex justify-between p-2 bg-muted/50 rounded">
                    <span className="capitalize">{table}</span>
                    <Badge variant={count > 0 ? "secondary" : "outline"} className="text-xs">
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Sync Info */}
            {syncState.metrics.lastSyncAt && (
              <div className="space-y-2">
                <h4 className="font-medium">Última Sincronização</h4>
                <div className="text-sm space-y-1 p-3 bg-muted/50 rounded">
                  <div>📅 {formatTimestamp(syncState.metrics.lastSyncAt)}</div>
                  {syncState.metrics.lastSyncType && (
                    <div>🔄 Tipo: {syncState.metrics.lastSyncType}</div>
                  )}
                  {syncState.metrics.lastSyncDuration && (
                    <div>⏱️ Duração: {formatDuration(syncState.metrics.lastSyncDuration)}</div>
                  )}
                </div>
              </div>
            )}

            {/* Logs */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Logs Recentes ({syncState.logs.length}/20)
              </h4>
              <ScrollArea className="h-40 w-full border rounded-md p-2">
                {syncState.logs.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    Nenhum log disponível
                  </div>
                ) : (
                  <div className="space-y-2">
                    {syncState.logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 text-sm">
                        {getLogIcon(log.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="truncate">{log.message}</span>
                          </div>
                          {log.details && (
                            <pre className="text-xs text-muted-foreground mt-1 overflow-hidden">
                              {JSON.stringify(log.details, null, 2).slice(0, 100)}...
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}