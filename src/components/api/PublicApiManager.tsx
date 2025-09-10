import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Key, 
  Copy, 
  Eye, 
  EyeOff, 
  Plus,
  Trash2,
  Settings,
  Globe,
  Code2,
  Shield,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ApiKey {
  id: string;
  name: string;
  key_hash: string;
  permissions: any;
  is_active: boolean;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

export function PublicApiManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    permissions: { read: true, write: false },
    expires_in_days: 30
  });
  const [generatedKey, setGeneratedKey] = useState<string>('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadApiKeys();
    }
  }, [user]);

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error('Error loading API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'pk_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const hashKey = async (key: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleCreateApiKey = async () => {
    try {
      const newKey = generateApiKey();
      const keyHash = await hashKey(newKey);
      
      const expiresAt = newKeyData.expires_in_days 
        ? new Date(Date.now() + newKeyData.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { error } = await supabase
        .from('api_keys')
        .insert([{
          user_id: user?.id,
          name: newKeyData.name,
          key_hash: keyHash,
          permissions: newKeyData.permissions,
          expires_at: expiresAt
        }]);

      if (error) throw error;

      setGeneratedKey(newKey);
      setShowKey(true);
      
      toast({
        title: 'API Key criada',
        description: 'Nova API key foi gerada com sucesso'
      });

      loadApiKeys();
      
      // Reset form
      setNewKeyData({
        name: '',
        permissions: { read: true, write: false },
        expires_in_days: 30
      });

    } catch (error) {
      console.error('Error creating API key:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao criar API key',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;

      toast({
        title: 'API Key removida',
        description: 'API key foi removida com sucesso'
      });

      loadApiKeys();
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao remover API key',
        variant: 'destructive'
      });
    }
  };

  const handleToggleApiKey = async (keyId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: isActive })
        .eq('id', keyId);

      if (error) throw error;

      toast({
        title: isActive ? 'API Key ativada' : 'API Key desativada',
        description: `API key foi ${isActive ? 'ativada' : 'desativada'} com sucesso`
      });

      loadApiKeys();
    } catch (error) {
      console.error('Error toggling API key:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao alterar status da API key',
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado',
      description: 'API key copiada para a área de transferência'
    });
  };

  const getPermissionBadges = (permissions: any) => {
    const badges = [];
    if (permissions.read) badges.push(<Badge key="read" variant="outline">Leitura</Badge>);
    if (permissions.write) badges.push(<Badge key="write" variant="default">Escrita</Badge>);
    return badges;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              API Pública
            </CardTitle>
            <CardDescription>
              Gerencie chaves de API para integração externa
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova API Key
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-6 text-muted-foreground">
            Carregando API keys...
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-8">
            <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma API Key</h3>
            <p className="text-muted-foreground mb-4">
              Crie sua primeira API key para começar a integrar
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira API Key
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {apiKeys.map((apiKey) => (
              <div key={apiKey.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{apiKey.name}</h4>
                    {apiKey.is_active ? (
                      <Badge variant="default">Ativa</Badge>
                    ) : (
                      <Badge variant="outline">Inativa</Badge>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mb-2">
                    {getPermissionBadges(apiKey.permissions)}
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <p>Criada em: {new Date(apiKey.created_at).toLocaleDateString('pt-BR')}</p>
                    {apiKey.last_used_at && (
                      <p>Último uso: {new Date(apiKey.last_used_at).toLocaleDateString('pt-BR')}</p>
                    )}
                    {apiKey.expires_at && (
                      <p>Expira em: {new Date(apiKey.expires_at).toLocaleDateString('pt-BR')}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={apiKey.is_active}
                    onCheckedChange={(checked) => handleToggleApiKey(apiKey.id, checked)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteApiKey(apiKey.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* API Documentation */}
        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Documentação da API
          </h4>
          <p className="text-sm text-muted-foreground mb-2">
            Base URL: <code className="bg-muted px-1 rounded">https://yfyousmorhjgoclxidwm.supabase.co/functions/v1/public-api</code>
          </p>
          <p className="text-sm text-muted-foreground">
            Inclua sua API key no header: <code className="bg-muted px-1 rounded">Authorization: Bearer YOUR_API_KEY</code>
          </p>
        </div>
      </CardContent>

      {/* Create API Key Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Criar Nova API Key
            </DialogTitle>
            <DialogDescription>
              Configure uma nova chave de API para integração externa
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da API Key</Label>
              <Input
                id="name"
                value={newKeyData.name}
                onChange={(e) => setNewKeyData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Integração Mobile App"
              />
            </div>

            <div>
              <Label>Permissões</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm">Leitura</label>
                  <Switch
                    checked={newKeyData.permissions.read}
                    onCheckedChange={(checked) => 
                      setNewKeyData(prev => ({
                        ...prev,
                        permissions: { ...prev.permissions, read: checked }
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">Escrita</label>
                  <Switch
                    checked={newKeyData.permissions.write}
                    onCheckedChange={(checked) => 
                      setNewKeyData(prev => ({
                        ...prev,
                        permissions: { ...prev.permissions, write: checked }
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="expires">Expira em (dias)</Label>
              <Input
                id="expires"
                type="number"
                value={newKeyData.expires_in_days}
                onChange={(e) => setNewKeyData(prev => ({ 
                  ...prev, 
                  expires_in_days: parseInt(e.target.value) || 0 
                }))}
                placeholder="30"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateApiKey}
                disabled={!newKeyData.name.trim()}
                className="flex-1"
              >
                Criar API Key
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Show Generated Key Modal */}
      <Dialog open={showKey} onOpenChange={setShowKey}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              API Key Gerada
            </DialogTitle>
            <DialogDescription>
              Copie e guarde esta chave em local seguro. Ela não será exibida novamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Label>Sua API Key</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(generatedKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <code className="text-sm break-all">{generatedKey}</code>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <strong>Importante:</strong> Esta é a única vez que a chave será exibida. 
                  Certifique-se de copiá-la e armazená-la em local seguro.
                </div>
              </div>
            </div>

            <Button onClick={() => setShowKey(false)} className="w-full">
              Entendi, copiei a chave
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}