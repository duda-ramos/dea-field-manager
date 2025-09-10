import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  Cloud, 
  CloudOff,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  FolderOpen
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface StorageIntegration {
  id: string;
  provider: string;
  config: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ExternalStorageIntegrationProps {
  className?: string;
}

export function ExternalStorageIntegration({ className }: ExternalStorageIntegrationProps) {
  const [integrations, setIntegrations] = useState<StorageIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<Record<string, string>>({});
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const { user } = useAuth();
  const { toast } = useToast();

  const providers = [
    {
      id: 'google_drive',
      name: 'Google Drive',
      icon: '🔗',
      description: 'Sincronizar com Google Drive',
      features: ['Sync automático', 'Backup em nuvem', 'Colaboração']
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      icon: '📦',
      description: 'Sincronizar com Dropbox',
      features: ['Versionamento', 'Sincronização', 'Acesso offline']
    },
    {
      id: 'onedrive',
      name: 'OneDrive',
      icon: '☁️',
      description: 'Sincronizar com Microsoft OneDrive',
      features: ['Integração Office', 'Backup automático', 'Compartilhamento']
    }
  ];

  useEffect(() => {
    if (user) {
      loadIntegrations();
    }
  }, [user]);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('storage_integrations')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error('Error loading integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleIntegration = async (providerId: string, enabled: boolean) => {
    try {
      if (enabled) {
        // Start configuration process
        setSelectedProvider(providerId);
        setIsConfigModalOpen(true);
      } else {
        // Disable integration
        const { error } = await supabase
          .from('storage_integrations')
          .update({ is_active: false })
          .eq('user_id', user?.id)
          .eq('provider', providerId);

        if (error) throw error;

        toast({
          title: 'Integração desativada',
          description: `Integração com ${providers.find(p => p.id === providerId)?.name} foi desativada`
        });

        loadIntegrations();
      }
    } catch (error) {
      console.error('Error toggling integration:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao alterar integração',
        variant: 'destructive'
      });
    }
  };

  const handleSyncNow = async (providerId: string) => {
    try {
      setSyncStatus(prev => ({ ...prev, [providerId]: 'syncing' }));

      // Call edge function for sync
      const { data, error } = await supabase.functions.invoke('sync-external-storage', {
        body: { provider: providerId }
      });

      if (error) throw error;

      setSyncStatus(prev => ({ ...prev, [providerId]: 'success' }));
      
      toast({
        title: 'Sincronização concluída',
        description: `Arquivos sincronizados com ${providers.find(p => p.id === providerId)?.name}`
      });

    } catch (error) {
      console.error('Error syncing:', error);
      setSyncStatus(prev => ({ ...prev, [providerId]: 'error' }));
      
      toast({
        title: 'Erro na sincronização',
        description: 'Erro ao sincronizar arquivos',
        variant: 'destructive'
      });
    }
  };

  const getIntegrationByProvider = (providerId: string) => {
    return integrations.find(i => i.provider === providerId);
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'syncing': return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Cloud className="h-4 w-4" />;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Storage Externo
        </CardTitle>
        <CardDescription>
          Integre com serviços de armazenamento em nuvem
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {providers.map((provider) => {
          const integration = getIntegrationByProvider(provider.id);
          const isConnected = integration?.is_active;
          const status = syncStatus[provider.id];

          return (
            <div 
              key={provider.id} 
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">{provider.icon}</div>
                <div>
                  <h4 className="font-medium">{provider.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {provider.description}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {provider.features.map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isConnected && (
                  <div className="flex items-center gap-2">
                    {getSyncStatusIcon(status)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncNow(provider.id)}
                      disabled={status === 'syncing'}
                    >
                      {status === 'syncing' ? 'Sincronizando...' : 'Sincronizar'}
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    checked={isConnected}
                    onCheckedChange={(checked) => 
                      handleToggleIntegration(provider.id, checked)
                    }
                  />
                  {isConnected ? (
                    <Badge variant="default">Conectado</Badge>
                  ) : (
                    <Badge variant="outline">Desconectado</Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Configuration Modal */}
        <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurar Integração
              </DialogTitle>
              <DialogDescription>
                Configure a integração com {providers.find(p => p.id === selectedProvider)?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="text-center py-6">
                <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  A configuração será implementada na próxima atualização
                </p>
                <Progress value={75} className="w-full" />
                <p className="text-xs text-muted-foreground mt-2">
                  Funcionalidade em desenvolvimento - 75% concluída
                </p>
              </div>

              <Button 
                onClick={() => setIsConfigModalOpen(false)}
                className="w-full"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}