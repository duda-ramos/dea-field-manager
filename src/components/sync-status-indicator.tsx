import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock,
  ChevronDown
} from "lucide-react";
import { SyncState, syncStateManager } from "@/services/sync/syncState";
import { fullSync } from "@/services/sync/sync";

export function SyncStatusIndicator() {
  const [syncState, setSyncState] = useState<SyncState>(syncStateManager.getState());
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    return syncStateManager.subscribe(setSyncState);
  }, []);

  const handleFullSync = async () => {
    try {
      await fullSync();
      toast({
        title: "Sincronização concluída",
        description: "Dados sincronizados com sucesso!"
      });
    } catch (error) {
      console.error('[SyncStatusIndicator] Falha na sincronização:', error, {
        isOnline: syncState.isOnline,
        status: syncState.status,
        pendingPush: syncState.pendingPush
      });
      toast({
        title: "Erro na sincronização",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = () => {
    if (syncState.status === 'syncing') return <RefreshCw className="h-3 w-3 animate-spin" />;
    if (syncState.status === 'error') return <AlertTriangle className="h-3 w-3" />;
    if (syncState.status === 'offline') return <WifiOff className="h-3 w-3" />;
    return <Wifi className="h-3 w-3" />;
  };

  const getStatusText = () => {
    if (syncState.status === 'syncing') return 'Sincronizando';
    if (syncState.status === 'error') return 'Erro';
    if (syncState.status === 'offline') return 'Offline';
    return 'Online';
  };

  const getStatusVariant = () => {
    if (syncState.status === 'syncing') return 'secondary';
    if (syncState.status === 'error') return 'destructive';
    if (syncState.status === 'offline') return 'secondary';
    return syncState.pendingPush > 0 ? 'outline' : 'secondary';
  };

  const formatTime = (date: string | number | undefined) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-9 gap-2 text-xs"
        >
          {getStatusIcon()}
          <span className="hidden sm:inline">{getStatusText()}</span>
          {syncState.pendingPush > 0 && (
            <Badge variant="outline" className="h-5 text-xs">
              {syncState.pendingPush}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Status de Sincronização</h4>
            <Badge variant={getStatusVariant()} className="text-xs">
              {getStatusText()}
            </Badge>
          </div>

          {/* Progress */}
          {syncState.progress !== undefined && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{syncState.progress.operation}...</span>
                <span>{Math.round((syncState.progress.current / syncState.progress.total) * 100)}%</span>
              </div>
              <Progress value={(syncState.progress.current / syncState.progress.total) * 100} className="h-2" />
            </div>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="text-muted-foreground">Pendentes</div>
              <div className="font-medium">{syncState.pendingPush}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Último Sync</div>
              <div className="font-medium">{formatTime(syncState.lastSyncAt)}</div>
            </div>
          </div>

          {/* Error Display */}
          {syncState.status === 'error' && syncState.lastError && (
            <div className="p-3 bg-destructive/10 rounded-md">
              <div className="text-xs text-destructive font-medium">
                Erro na sincronização
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {typeof syncState.lastError === 'string' 
                  ? syncState.lastError 
                  : syncState.lastError.message}
              </div>
            </div>
          )}

          {/* Recent Logs */}
          {syncState.logs.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium">Atividade Recente</div>
              <ScrollArea className="h-20">
                <div className="space-y-1">
                  {syncState.logs.slice(-3).reverse().map((log, index) => (
                    <div key={index} className="text-xs p-2 rounded bg-muted/50">
                      <div className="flex justify-between items-start">
                        <span className={
                          log.type === 'error' ? 'text-destructive' :
                          log.type === 'success' ? 'text-green-600' :
                          'text-foreground'
                        }>
                          {log.message}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatTime(log.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={handleFullSync}
              disabled={syncState.status === 'syncing' || syncState.status === 'offline'}
              className="flex-1"
            >
              <RefreshCw className="h-3 w-3 mr-2" />
              Sincronizar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}