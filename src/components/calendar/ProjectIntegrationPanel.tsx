import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { calendarIntegration } from '@/services/calendarIntegration';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ProjectIntegrationPanel() {
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();

  const handleSyncInstallations = async () => {
    try {
      setLoading(true);
      await calendarIntegration.syncProjectInstallations();
      setLastSync(new Date());
      
      toast({
        title: 'Sincronização concluída',
        description: 'Os eventos de instalação foram sincronizados com os projetos.'
      });
    } catch (error) {
      console.error('Error syncing installations:', error);
      toast({
        title: 'Erro na sincronização',
        description: 'Não foi possível sincronizar os eventos de instalação.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeadlines = async () => {
    try {
      setLoading(true);
      await calendarIntegration.createProjectDeadlines();
      
      toast({
        title: 'Prazos criados',
        description: 'Os eventos de prazo foram criados para os projetos.'
      });
    } catch (error) {
      console.error('Error creating deadlines:', error);
      toast({
        title: 'Erro ao criar prazos',
        description: 'Não foi possível criar os eventos de prazo.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Integração com Projetos
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Sincronize automaticamente eventos com os cronogramas dos projetos
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="font-medium">Instalações</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Sincroniza datas de instalação dos projetos com eventos do calendário
            </p>
            <Button 
              onClick={handleSyncInstallations}
              disabled={loading}
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Sincronizando...' : 'Sincronizar Instalações'}
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="font-medium">Prazos</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Cria lembretes de prazo uma semana antes das instalações
            </p>
            <Button 
              onClick={handleCreateDeadlines}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Criar Prazos
            </Button>
          </div>
        </div>

        {lastSync && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              <span>
                Última sincronização: {format(lastSync, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-2">Tipos de Eventos Sincronizados</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs">
              <div className="w-2 h-2 bg-orange-500 rounded-full mr-1" />
              Instalações
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-1" />
              Prazos
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <div className="w-2 h-2 bg-purple-500 rounded-full mr-1" />
              Lembretes
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}