import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Upload, Download, Clock, Wifi, Settings } from 'lucide-react';
import { getSyncPreferences, setSyncPreferences, type SyncPreferences } from '@/lib/preferences';
import { autoSyncManager } from '@/services/sync/autoSync';

export function SyncPreferences() {
  const [preferences, setPreferences] = useState<SyncPreferences>(getSyncPreferences());

  useEffect(() => {
    // Load preferences on mount
    setPreferences(getSyncPreferences());
  }, []);

  const updatePreference = <K extends keyof SyncPreferences>(
    key: K, 
    value: SyncPreferences[K]
  ) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    setSyncPreferences({ [key]: value });
    
    // Update auto-sync manager if periodic settings changed
    if (key === 'periodicPullEnabled' || key === 'periodicPullInterval') {
      autoSyncManager.updatePeriodicSync();
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configurações de Sincronização
        </CardTitle>
        <CardDescription>
          Configure quando e como seus dados são sincronizados automaticamente
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Auto-pull on start */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Download className="h-4 w-4 text-green-600" />
              <div>
                <Label htmlFor="auto-pull-start" className="font-medium">
                  Atualizar ao abrir o app
                </Label>
                <p className="text-sm text-muted-foreground">
                  Busca automaticamente novos dados quando você abre o aplicativo
                </p>
              </div>
            </div>
            <Switch
              id="auto-pull-start"
              checked={preferences.autoPullOnStart}
              onCheckedChange={(checked) => updatePreference('autoPullOnStart', checked)}
            />
          </div>
          {preferences.autoPullOnStart && (
            <Badge variant="secondary" className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />
              Ativo
            </Badge>
          )}
        </div>

        <Separator />

        {/* Auto-push on exit */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Upload className="h-4 w-4 text-blue-600" />
              <div>
                <Label htmlFor="auto-push-exit" className="font-medium">
                  Salvar ao sair
                </Label>
                <p className="text-sm text-muted-foreground">
                  Envia suas alterações para a nuvem antes de fechar o aplicativo
                </p>
              </div>
            </div>
            <Switch
              id="auto-push-exit"
              checked={preferences.autoPushOnExit}
              onCheckedChange={(checked) => updatePreference('autoPushOnExit', checked)}
            />
          </div>
          {preferences.autoPushOnExit && (
            <Badge variant="secondary" className="text-xs">
              <Upload className="h-3 w-3 mr-1" />
              Ativo
            </Badge>
          )}
        </div>

        <Separator />

        {/* Periodic sync */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-purple-600" />
              <div>
                <Label htmlFor="periodic-sync" className="font-medium">
                  Sincronização periódica
                </Label>
                <p className="text-sm text-muted-foreground">
                  Busca atualizações automaticamente em intervalos regulares
                </p>
              </div>
            </div>
            <Switch
              id="periodic-sync"
              checked={preferences.periodicPullEnabled}
              onCheckedChange={(checked) => updatePreference('periodicPullEnabled', checked)}
            />
          </div>

          {preferences.periodicPullEnabled && (
            <div className="ml-7 space-y-3">
              <div className="flex items-center gap-3">
                <Label htmlFor="sync-interval" className="text-sm">
                  Intervalo:
                </Label>
                <Select
                  value={preferences.periodicPullInterval.toString()}
                  onValueChange={(value) => updatePreference('periodicPullInterval', parseInt(value))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 minuto</SelectItem>
                    <SelectItem value="5">5 minutos</SelectItem>
                    <SelectItem value="10">10 minutos</SelectItem>
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Badge variant="outline" className="text-xs">
                <Wifi className="h-3 w-3 mr-1" />
                Apenas quando online e app em foco
              </Badge>
            </div>
          )}
        </div>

        <Separator />

        {/* Realtime Sync (Beta) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wifi className="h-4 w-4 text-orange-600" />
              <div>
                <Label htmlFor="realtime-sync" className="font-medium flex items-center gap-2">
                  Realtime Sync
                  <Badge variant="outline" className="text-xs">Beta</Badge>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Sincroniza mudanças em tempo real entre dispositivos
                </p>
              </div>
            </div>
            <Switch
              id="realtime-sync"
              checked={preferences.realtimeEnabled ?? false}
              onCheckedChange={(checked) => updatePreference('realtimeEnabled', checked)}
            />
          </div>
          
          {(preferences.realtimeEnabled ?? false) && (
            <div className="ml-7 space-y-2">
              <Badge variant="secondary" className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                Ativo
              </Badge>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ Experimental. Requer reload da página após ativar/desativar.
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Info section */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium">ℹ️ Como funciona</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Atualizar ao abrir:</strong> Busca dados do servidor quando você abre o app</li>
            <li>• <strong>Salvar ao sair:</strong> Envia suas alterações antes de fechar (não bloqueia)</li>
            <li>• <strong>Sincronização periódica:</strong> Busca atualizações automaticamente em background</li>
            <li>• <strong>Debounce:</strong> Alterações são enviadas automaticamente após 3s de inatividade</li>
            <li>• <strong>Realtime Sync (Beta):</strong> Recebe atualizações em tempo real de outros dispositivos</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}