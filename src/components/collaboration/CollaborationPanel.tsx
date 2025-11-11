import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Crown, 
  Eye, 
  Edit, 
  Trash2,
  Clock,
  CheckCircle2,
  Activity
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logger } from '@/services/logger';

interface RealtimeEvent {
  id: string;
  user_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

interface Collaborator {
  id: string;
  user_id: string;
  role: string;
  permissions: Record<string, boolean>;
  invited_by: string;
  invited_at: string;
  accepted_at?: string;
  status: string;
  user_email?: string;
  user_name?: string;
}

interface CollaborationPanelProps {
  projectId: string;
  isOwner: boolean;
  onCollaboratorAdded?: () => void;
}

export function CollaborationPanel({ projectId, isOwner, onCollaboratorAdded }: CollaborationPanelProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadCollaborators();
    loadEvents();
    setupRealtimeSubscriptions();
  }, [projectId]);

  const setupRealtimeSubscriptions = () => {
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

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(presenceChannel);
    };
  };

  const loadCollaborators = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project_collaborators')
        .select(`
          *,
          profiles:user_id (
            display_name
          )
        `)
        .eq('project_id', projectId);

      if (error) throw error;
      setCollaborators((data as any) || []);
    } catch (error) {
      logger.error('Error loading collaborators', {
        error,
        projectId,
        operacao: 'loadCollaborators'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    const { data } = await supabase
      .from('collaboration_events')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setEvents(data as any);
    }
  };

  const publishEvent = async (eventType: string, eventData?: Record<string, unknown>) => {
    if (!user) return;

    await supabase
      .from('collaboration_events')
      .insert([{
        project_id: projectId,
        user_id: user.id,
        event_type: eventType,
        event_data: eventData as any
      }]);
  };

  const handleInviteUser = async () => {
    if (!user || !inviteEmail.trim()) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast({
        title: 'Email inválido',
        description: 'Verifique o endereço de email e tente novamente',
        variant: 'destructive',
        duration: 4000
      });
      return;
    }

    try {
      setInviting(true);

      // Search for user by email using the security definer function
      const { data: foundUserId, error: searchError } = await supabase
        .rpc('get_user_by_email', { user_email: inviteEmail.toLowerCase().trim() });

      if (searchError) {
        logger.error('Error searching user by email', {
          error: searchError,
          email: inviteEmail,
          operacao: 'get_user_by_email'
        });
        toast({
          title: 'Erro ao buscar usuário',
          description: 'Não foi possível verificar o email. Tente novamente',
          variant: 'destructive',
          duration: 5000
        });
        return;
      }

      if (!foundUserId) {
        toast({
          title: 'Usuário não encontrado',
          description: `"${inviteEmail}" não possui conta. Convide-o a se cadastrar primeiro`,
          variant: 'destructive',
          duration: 5000
        });
        return;
      }

      // Check if user is the project owner
      if (foundUserId === user.id) {
        toast({
          title: 'Operação inválida',
          description: 'Você já é o proprietário deste projeto',
          variant: 'destructive',
          duration: 4000
        });
        return;
      }

      // Check if user is already a collaborator
      const { data: existingCollaborator } = await supabase
        .from('project_collaborators')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', foundUserId)
        .maybeSingle();

      if (existingCollaborator) {
        toast({
          title: 'Colaborador já existe',
          description: `"${inviteEmail}" já tem acesso a este projeto`,
          variant: 'destructive',
          duration: 4000
        });
        return;
      }

      const permissions = {
        read: true,
        write: inviteRole === 'editor' || inviteRole === 'admin',
        admin: inviteRole === 'admin'
      };

      const { error } = await supabase
        .from('project_collaborators')
        .insert([{
          project_id: projectId,
          user_id: foundUserId,
          role: inviteRole,
          permissions,
          invited_by: user.id,
          status: 'accepted' // User exists, so mark as accepted immediately
        }]);

      if (error) {
        logger.error('Error adding collaborator', {
          error,
          projectId,
          email: inviteEmail,
          role: inviteRole,
          operacao: 'handleInviteUser_insert'
        });
        throw error;
      }

      // Publish collaboration event
      await publishEvent('collaborator_added', { email: inviteEmail, role: inviteRole });

      const roleLabel = inviteRole === 'admin' ? 'administrador' : inviteRole === 'editor' ? 'editor' : 'visualizador';
      toast({
        title: 'Colaborador adicionado com sucesso',
        description: `"${inviteEmail}" agora tem acesso como ${roleLabel}`,
        duration: 3000
      });

      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('viewer');
      loadCollaborators();
      onCollaboratorAdded?.();

    } catch (error) {
      logger.error('Error inviting user', {
        error,
        projectId,
        email: inviteEmail,
        role: inviteRole,
        operacao: 'handleInviteUser'
      });
      toast({
        title: 'Erro ao adicionar colaborador',
        description: 'Não foi possível adicionar o colaborador. Tente novamente',
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    try {
      const { error } = await supabase
        .from('project_collaborators')
        .delete()
        .eq('id', collaboratorId);

      if (error) throw error;

      toast({
        title: 'Colaborador removido com sucesso',
        description: 'O acesso ao projeto foi revogado',
        duration: 3000
      });

      loadCollaborators();
    } catch (error) {
      logger.error('Error removing collaborator', {
        error,
        collaboratorId,
        projectId,
        operacao: 'handleRemoveCollaborator'
      });
      toast({
        title: 'Erro ao remover colaborador',
        description: 'Não foi possível revogar o acesso. Tente novamente',
        variant: 'destructive',
        duration: 5000
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="h-4 w-4" />;
      case 'editor': return <Edit className="h-4 w-4" />;
      default: return <Eye className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default' as const;
      case 'editor': return 'secondary' as const;
      default: return 'outline' as const;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      default: return <Clock className="h-4 w-4 text-orange-600" />;
    }
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Colaboradores do Projeto
              </CardTitle>
              <CardDescription>
                Gerencie quem pode acessar e editar este projeto
              </CardDescription>
            </div>
            {isOwner && (
              <Button onClick={() => setIsInviteModalOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Convidar
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-6 text-muted-foreground">
              Carregando colaboradores...
            </div>
          ) : collaborators.length === 0 ? (
            <div className="text-center py-6">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Nenhum colaborador ainda</p>
              {isOwner && (
                <Button variant="outline" onClick={() => setIsInviteModalOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convidar primeiro colaborador
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {collaborators.map((collaborator) => (
                <div key={collaborator.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {collaborator.user_email?.substring(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {(collaborator as any).profiles?.display_name || collaborator.user_email || 'Usuário'}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {getStatusIcon(collaborator.status)}
                        <span>{collaborator.status === 'accepted' ? 'Ativo' : 'Pendente'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={getRoleBadgeVariant(collaborator.role)} className="gap-1">
                      {getRoleIcon(collaborator.role)}
                      {collaborator.role === 'admin' ? 'Admin' : 
                       collaborator.role === 'editor' ? 'Editor' : 'Visualizador'}
                    </Badge>
                    
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCollaborator(collaborator.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Invite Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Convidar Colaborador
            </DialogTitle>
            <DialogDescription>
              Envie um convite para colaborar neste projeto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email do usuário</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="usuario@email.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Permissão</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Visualizador - Apenas visualizar
                    </div>
                  </SelectItem>
                  <SelectItem value="editor">
                    <div className="flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      Editor - Visualizar e editar
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      Admin - Controle total
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsInviteModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleInviteUser}
                disabled={inviting || !inviteEmail.trim()}
                className="flex-1"
              >
                {inviting ? 'Enviando...' : 'Enviar Convite'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}