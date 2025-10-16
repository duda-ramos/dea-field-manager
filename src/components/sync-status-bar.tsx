import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { fullSync } from '@/services/sync/sync';
import { syncStateManager, type SyncState } from '@/services/sync/syncState';

export function SyncStatusBar() {
  const [syncState, setSyncState] = useState<SyncState>(syncStateManager.getState());
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = syncStateManager.subscribe(setSyncState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Show offline alert when coming back online with pending changes
    if (syncState.isOnline && syncState.pendingPush > 0 && showOfflineAlert) {
      setShowOfflineAlert(false);
    } else if (!syncState.isOnline && !showOfflineAlert) {
      setShowOfflineAlert(true);
    }
  }, [syncState.isOnline, syncState.pendingPush, showOfflineAlert]);

  const handleSyncNow = async () => {
    try {
      await fullSync();
      toast({
        title: "Sincronização Concluída",
        description: "Todos os dados foram sincronizados com sucesso!"
      });
    } catch (error) {
      console.error('Auto-sync error:', error);
      toast({
        title: "Erro na Sincronização",
        description: "Falha ao sincronizar automaticamente. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Show alert when offline with pending changes
  if (!syncState.isOnline && syncState.pendingPush > 0) {
    return (
      <Alert className="mx-4 mb-4">
        <WifiOff className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            Você está offline. {syncState.pendingPush} alterações serão sincronizadas quando você voltar online.
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  // Show sync prompt when back online with pending changes
  if (syncState.isOnline && syncState.pendingPush > 0 && syncState.status !== 'syncing') {
    return (
      <Alert className="mx-4 mb-4">
        <Wifi className="h-4 w-4 text-green-500" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            Você voltou online! {syncState.pendingPush} alterações estão aguardando sincronização.
          </span>
          <Button 
            size="sm" 
            onClick={handleSyncNow}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Sincronizar Agora
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}