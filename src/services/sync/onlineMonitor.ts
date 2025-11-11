import { syncStateManager } from './syncState';
import { processSyncQueue } from '@/services/storage/StorageManagerDexie';
import { fullSync } from './sync';
import { toast } from '@/hooks/use-toast';
import { realtimeManager } from '@/services/realtime/realtime';

class OnlineMonitor {
  private checkInterval: number | null = null;
  private isMonitoring = false;
  private reconnectDebounceTimer: NodeJS.Timeout | null = null;
  private isHandlingReconnect = false;
  private abortController: AbortController | null = null;

  initialize() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Listeners de eventos nativos
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Verificação periódica (a cada 30 segundos)
    this.checkInterval = window.setInterval(() => {
      this.checkConnection();
    }, 30000);
    
    // Verificação inicial
    this.checkConnection();
  }

  cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // Limpar debounce timer
    if (this.reconnectDebounceTimer) {
      clearTimeout(this.reconnectDebounceTimer);
      this.reconnectDebounceTimer = null;
    }
    
    // Cancelar syncs em andamento
    this.abortController?.abort();
    this.abortController = null;
    
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.isMonitoring = false;
  }

  private handleOnline = async () => {
    // Connection restored
    
    // Limpar timer anterior se existir
    if (this.reconnectDebounceTimer) {
      clearTimeout(this.reconnectDebounceTimer);
      this.reconnectDebounceTimer = null;
    }

    // Atualizar estado imediatamente
    syncStateManager.updateState({
      isOnline: true,
      status: 'idle'
    });

    try {
      await realtimeManager.reconnect();
    } catch (error) {
      // Reconnect error handled by realtime manager
    }

    // Debounce de 2000ms antes de sincronizar
    this.reconnectDebounceTimer = setTimeout(async () => {
      this.reconnectDebounceTimer = null;

      if (!navigator.onLine) {
        // Reconnection cancelled - connection lost again
        return;
      }

      // Verificar se já está processando uma reconexão
      if (this.isHandlingReconnect) {
        // Sync already in progress, skip
        return;
      }

      try {
        this.isHandlingReconnect = true;
        
        const pendingCount = syncStateManager.getState().pendingPush;

        if (pendingCount > 0) {
          toast({
            title: "Conexão Restaurada",
            description: `Sincronizando ${pendingCount} alteração${pendingCount > 1 ? 'ões' : ''} pendente${pendingCount > 1 ? 's' : ''}...`,
          });

          try {
            // Processar fila de sincronização
            await processSyncQueue();
            
            // Fazer sincronização completa
            await fullSync();
            
            toast({
              title: "Sincronização Concluída",
              description: "Todas as alterações foram sincronizadas com sucesso!",
            });
          } catch (error) {
            // Sync error after reconnect - handled by sync state manager
            syncStateManager.setError({
              message: error instanceof Error ? error.message : 'Erro desconhecido',
              timestamp: Date.now(),
              operation: 'reconnect-sync'
            });
            syncStateManager.updateState({
              status: 'error'
            });
            toast({
              title: "Erro na Sincronização",
              description: "Algumas alterações não puderam ser sincronizadas. Tentaremos novamente.",
              variant: "destructive"
            });
          }
        } else {
          toast({
            title: "Online",
            description: "Conexão com servidor restaurada",
          });
        }
      } finally {
        this.isHandlingReconnect = false;
      }
    }, 2000);
  };

  private handleOffline = () => {
    // Connection lost - working offline

    if (this.reconnectDebounceTimer) {
      clearTimeout(this.reconnectDebounceTimer);
      this.reconnectDebounceTimer = null;
    }

    syncStateManager.updateState({
      isOnline: false,
      status: 'idle'
    });

    toast({
      title: "Sem Conexão",
      description: "Trabalhando offline. Suas alterações serão sincronizadas quando a conexão for restaurada.",
      variant: "destructive"
    });
  };

  private async checkConnection() {
    const wasOnline = syncStateManager.getState().isOnline;
    const isCurrentlyOnline = navigator.onLine;

    // Se mudou de offline para online
    if (!wasOnline && isCurrentlyOnline) {
      await this.handleOnline();
    }
    // Se mudou de online para offline
    else if (wasOnline && !isCurrentlyOnline) {
      this.handleOffline();
    }
  }

  getPendingCount(): number {
    return syncStateManager.getState().pendingPush;
  }

  isOnline(): boolean {
    return navigator.onLine;
  }
}

export const onlineMonitor = new OnlineMonitor();
