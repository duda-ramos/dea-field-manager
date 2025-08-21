import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Loader2 } from 'lucide-react';
import { fullSync } from '@/services/sync/sync';
import { supabase } from '@/integrations/supabase/client';

export function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de Autenticação",
          description: "Você precisa estar logado para sincronizar os dados.",
          variant: "destructive"
        });
        return;
      }

      await fullSync();
      
      toast({
        title: "Sincronização Concluída",
        description: "Dados sincronizados com sucesso!"
      });
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Erro na Sincronização",
        description: error instanceof Error ? error.message : "Erro desconhecido ao sincronizar dados.",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button 
      onClick={handleSync} 
      disabled={isSyncing}
      variant="outline"
      size="sm"
    >
      {isSyncing ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
    </Button>
  );
}