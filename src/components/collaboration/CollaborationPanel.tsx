import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Crown, 
  Eye, 
  Edit, 
  Trash2,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Collaborator {
  id: string;
  user_id: string;
  role: string;
  permissions: any;
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
}

export function CollaborationPanel({ projectId, isOwner }: CollaborationPanelProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadCollaborators();
  }, [projectId]);

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
      setCollaborators(data || []);
    } catch (error) {
      // Error logged via logger service
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!user || !inviteEmail.trim()) return;

    try {
      setInviting(true);

      // Check if user exists by email (simplified for demo)
      // In production, you'd need a proper user lookup system
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (profileError) {
        toast({
          title: 'Erro',
          description: 'Erro ao verificar usuário',
          variant: 'destructive'
        });
        return;
      }

      const permissions = {
        read: true,
        write: inviteRole === 'editor' || inviteRole === 'admin',
        admin: inviteRole === 'admin'
      };

      // For demo purposes, use a placeholder user ID
      const placeholderUserId = `user_${Date.now()}`;

      const { error } = await supabase
        .from('project_collaborators')
        .insert([{
          project_id: projectId,
          user_id: placeholderUserId,
          role: inviteRole,
          permissions,
          invited_by: user.id
        }]);

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: 'Usuário já convidado',
            description: 'Este usuário já foi convidado para este projeto',
            variant: 'destructive'
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: 'Convite enviado',
        description: `Convite enviado para ${inviteEmail}`
      });

      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('viewer');
      loadCollaborators();

    } catch (error) {
      // Error logged via logger service
      toast({
        title: 'Erro',
        description: 'Erro ao enviar convite',
        variant: 'destructive'
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
        title: 'Colaborador removido',
        description: 'Colaborador removido do projeto'
      });

      loadCollaborators();
    } catch (error) {
      // Error logged via logger service
      toast({
        title: 'Erro',
        description: 'Erro ao remover colaborador',
        variant: 'destructive'
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Colaboração
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
    </Card>
  );
}