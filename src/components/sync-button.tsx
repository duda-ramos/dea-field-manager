import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Loader2, Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';
import { fullSync } from '@/services/sync/sync';
import { supabase } from '@/integrations/supabase/client';
import { syncStateManager, type SyncState } from '@/services/sync/syncState';
import { SyncSettingsModal } from './sync-settings-modal';

export function SyncButton() {
  const [syncState, setSyncState] = useState<SyncState>(syncStateManager.getState());
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = syncStateManager.subscribe(setSyncState);
    return unsubscribe;
  }, []);

  const handleSync = async () => {
    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({
          title: "Erro de Autenticação",
          description: "Você precisa estar logado para sincronizar os dados.",
          variant: "destructive"
        });
        return;
      }

      if (!syncState.isOnline) {
        toast({
          title: "Sem Conexão",
          description: "Conecte-se à internet para sincronizar os dados.",
          variant: "destructive"
        });
        return;
      }

      const result = await fullSync();
      
      // Calculate totals from push and pull results
      const pushTotals = Object.values(result.push).reduce((acc, entityResult) => {
        if (entityResult) {
          acc.pushed += entityResult.pushed || 0;
          acc.deleted += entityResult.deleted || 0;
        }
        return acc;
      }, { pushed: 0, deleted: 0 });

      const pullTotals = Object.values(result.pull).reduce((acc, entityResult) => {
        if (entityResult) {
          acc.pulled += entityResult.pulled || 0;
        }
        return acc;
      }, { pulled: 0 });

      toast({
        title: "Sincronização Concluída",
        description: `Enviados: ${pushTotals.pushed} | Recebidos: ${pullTotals.pulled} | Removidos: ${pushTotals.deleted}`
      });
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Erro na Sincronização",
        description: error instanceof Error ? error.message : "Erro desconhecido ao sincronizar dados.",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = () => {
    if (!syncState.isOnline) return <WifiOff className="h-4 w-4" />;
    if (syncState.status === 'syncing') return <Loader2 className="h-4 w-4 animate-spin" />;
    if (syncState.status === 'error') return <AlertCircle className="h-4 w-4" />;
    return <RefreshCw className="h-4 w-4" />;
  };

  const getStatusText = () => {
    switch (syncState.status) {
      case 'offline': return 'Offline';
      case 'syncing': return 'Sincronizando...';
      case 'error': return 'Erro';
      default: return 'Sincronizar';
    }
  };

  const getStatusVariant = () => {
    switch (syncState.status) {
      case 'offline': return 'secondary';
      case 'syncing': return 'default';
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Status indicator */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        {syncState.isOnline ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-500" />
        )}
        
        {syncState.lastSyncAt && (
          <span className="text-xs">
            {new Date(syncState.lastSyncAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Pending changes badge */}
      {syncState.pendingPush > 0 && (
        <Badge variant="secondary" className="px-2 py-1 text-xs">
          {syncState.pendingPush} pendentes
        </Badge>
      )}

      {/* Sync button */}
      <div className="flex items-center gap-1">
        <Button 
          onClick={handleSync} 
          disabled={syncState.status === 'syncing' || !syncState.isOnline}
          variant={getStatusVariant()}
          size="sm"
          className="min-w-[120px]"
        >
          {getStatusIcon()}
          <span className="ml-2">{getStatusText()}</span>
        </Button>
        
        {/* Settings button */}
        <SyncSettingsModal />
      </div>

      {/* Progress indicator */}
      {syncState.progress && (
        <div className="flex items-center gap-2 text-sm">
          <Progress 
            value={(syncState.progress.current / syncState.progress.total) * 100} 
            className="w-20 h-2"
          />
          <span className="text-xs text-muted-foreground">
            {syncState.progress.operation}
          </span>
        </div>
      )}

      {/* Error indicator */}
      {syncState.status === 'error' && syncState.lastError && (
        <div className="text-xs text-red-500 max-w-48 truncate" title={syncState.lastError.message}>
          {syncState.lastError.message}
        </div>
      )}
    </div>
  );
}