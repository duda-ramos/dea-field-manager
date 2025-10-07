import { syncStateManager } from './syncState';
import { processSyncQueue } from '@/services/storage/StorageManagerDexie';
import { fullSync } from './sync';
import { toast } from '@/hooks/use-toast';

class OnlineMonitor {
  private checkInterval: number | null = null;
  private isMonitoring = false;

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
    
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.isMonitoring = false;
  }

  private handleOnline = async () => {
    console.log('🟢 Conexão restaurada');
    
    syncStateManager.updateState({ 
      isOnline: true,
      status: 'idle' 
    });

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
        console.error('Erro ao sincronizar após reconexão:', error);
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
  };

  private handleOffline = () => {
    console.log('🔴 Conexão perdida - trabalhando offline');
    
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
