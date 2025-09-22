import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CollaborationPanel } from './CollaborationPanel';
import { 
  Users, 
  Activity, 
  Clock 
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RealtimeEvent {
  id: string;
  user_id: string;
  event_type: string;
  event_data: any;
  created_at: string;
}

interface RealtimeCollaborationProps {
  projectId: string;
  isOwner: boolean;
}

export function RealtimeCollaboration({ projectId, isOwner }: RealtimeCollaborationProps) {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!projectId) return;

    // Subscribe to collaboration events
    const eventsChannel = supabase
      .channel(`collaboration_events:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'collaboration_events',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          setEvents(prev => [payload.new as RealtimeEvent, ...prev.slice(0, 9)]);
        }
      )
      .subscribe();

    // Subscribe to user presence
    const presenceChannel = supabase
      .channel(`project_presence:${projectId}`)
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const users = Object.keys(newState);
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers(prev => [...prev, key]);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers(prev => prev.filter(u => u !== key));
      })
      .subscribe();

    // Track user presence
    if (user) {
      presenceChannel.track({
        user_id: user.id,
        online_at: new Date().toISOString(),
      });
    }

    // Load initial events
    loadEvents();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [projectId, user]);

  const loadEvents = async () => {
    const { data } = await supabase
      .from('collaboration_events')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setEvents(data);
    }
  };

  const publishEvent = async (eventType: string, eventData?: any) => {
    if (!user) return;

    await supabase
      .from('collaboration_events')
      .insert([{
        project_id: projectId,
        user_id: user.id,
        event_type: eventType,
        event_data: eventData
      }]);
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'installation_updated': return '🔧';
      case 'file_uploaded': return '📁';
      case 'collaborator_added': return '👥';
      case 'project_updated': return '📝';
      default: return '📋';
    }
  };

  const getEventDescription = (event: RealtimeEvent) => {
    switch (event.event_type) {
      case 'installation_updated': 
        return `atualizou a instalação ${event.event_data?.codigo || ''}`;
      case 'file_uploaded':
        return `enviou o arquivo ${event.event_data?.filename || ''}`;
      case 'collaborator_added':
        return `adicionou um novo colaborador`;
      case 'project_updated':
        return `atualizou as informações do projeto`;
      default:
        return `realizou uma ação`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Online Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Colaboradores Online
            <Badge variant="secondary">{onlineUsers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {onlineUsers.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum colaborador online</p>
            ) : (
              onlineUsers.map((userId, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-background"></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Collaboration Panel */}
      <CollaborationPanel 
        projectId={projectId} 
        isOwner={isOwner}
        onCollaboratorAdded={() => publishEvent('collaborator_added')}
      />

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma atividade recente</p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <span className="text-lg">{getEventIcon(event.event_type)}</span>
                  <div className="flex-1">
                    <p className="text-sm">
                      <strong>Usuário</strong> {getEventDescription(event)}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(event.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}