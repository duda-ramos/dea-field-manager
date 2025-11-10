import { useState, useEffect } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, ROLE_LABELS } from '@/middleware/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { UserPlus, Trash2, Mail, Crown, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Collaborator {
  id: string;
  user_id: string;
  project_id: string;
  role: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
  invited_by: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
    email?: string;
  };
}

interface ProjectCollaboratorsProps {
  projectId: string;
  projectOwnerId: string;
}

export function ProjectCollaborators({ projectId, projectOwnerId }: ProjectCollaboratorsProps) {
  const auth = useAuthContext();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer');

  const isOwner = auth.user?.id === projectOwnerId;
  const canManageCollaborators = isOwner || auth.isAdmin;

  useEffect(() => {
    loadCollaborators();
  }, [projectId]);

  async function loadCollaborators() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_collaborators')
        .select(`
          *,
          profile:user_id (
            display_name,
            avatar_url
          )
        `)
        .eq('project_id', projectId)
        .order('invited_at', { ascending: false });

      if (error) throw error;

      // Get emails if admin
      if (auth.isAdmin) {
        const collaboratorsWithEmails = await Promise.all(
          (data || []).map(async (collab) => {
            try {
              const { data: { user } } = await supabase.auth.admin.getUserById(collab.user_id);
              return {
                ...collab,
                profile: {
                  ...collab.profile,
                  email: user?.email || null,
                },
              };
            } catch (err) {
              return collab;
            }
          })
        );
        setCollaborators(collaboratorsWithEmails as any);
      } else {
        setCollaborators(data || []);
      }
    } catch (error) {
      console.error('Error loading collaborators:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar colaboradores',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteCollaborator() {
    if (!inviteEmail) {
      toast({
        title: 'Erro',
        description: 'Digite um email válido',
        variant: 'destructive',
      });
      return;
    }

    try {
      // First, check if user exists
      const { data: userData } = await supabase.rpc('get_user_by_email', {
        user_email: inviteEmail,
      });

      if (!userData) {
        toast({
          title: 'Erro',
          description: 'Usuário não encontrado. O usuário precisa criar uma conta primeiro.',
          variant: 'destructive',
        });
        return;
      }

      // Check if already a collaborator
      const { data: existing } = await supabase
        .from('project_collaborators')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userData)
        .single();

      if (existing) {
        toast({
          title: 'Erro',
          description: 'Este usuário já é um colaborador deste projeto',
          variant: 'destructive',
        });
        return;
      }

      // Add collaborator
      const { error } = await supabase.from('project_collaborators').insert({
        project_id: projectId,
        user_id: userData,
        role: inviteRole,
        status: 'pending',
        invited_by: auth.user!.id,
        permissions: {},
      });

      if (error) throw error;

      toast({
        title: 'Convite Enviado',
        description: `Convite enviado para ${inviteEmail}`,
      });

      setInviteEmail('');
      setInviteRole('viewer');
      setInviteDialogOpen(false);
      loadCollaborators();
    } catch (error) {
      console.error('Error inviting collaborator:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao convidar colaborador',
        variant: 'destructive',
      });
    }
  }

  async function handleRemoveCollaborator(collaboratorId: string) {
    try {
      const { error } = await supabase
        .from('project_collaborators')
        .delete()
        .eq('id', collaboratorId);

      if (error) throw error;

      toast({
        title: 'Colaborador Removido',
        description: 'Colaborador removido do projeto com sucesso',
      });

      loadCollaborators();
    } catch (error) {
      console.error('Error removing collaborator:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao remover colaborador',
        variant: 'destructive',
      });
    }
  }

  async function handleUpdateRole(collaboratorId: string, newRole: UserRole) {
    try {
      const { error } = await supabase
        .from('project_collaborators')
        .update({ role: newRole })
        .eq('id', collaboratorId);

      if (error) throw error;

      toast({
        title: 'Role Atualizado',
        description: 'Role do colaborador atualizado com sucesso',
      });

      loadCollaborators();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar role',
        variant: 'destructive',
      });
    }
  }

  function getStatusBadge(status: string, acceptedAt: string | null) {
    if (status === 'accepted' && acceptedAt) {
      return <Badge variant="outline">Ativo</Badge>;
    }
    if (status === 'pending') {
      return <Badge variant="secondary">Pendente</Badge>;
    }
    if (status === 'rejected') {
      return <Badge variant="destructive">Rejeitado</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  }

  function getInitials(name: string | null): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Colaboradores do Projeto
            </CardTitle>
            <CardDescription>
              Gerencie quem tem acesso a este projeto
            </CardDescription>
          </div>
          {canManageCollaborators && (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Adicionar Colaborador
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Colaborador</DialogTitle>
                  <DialogDescription>
                    Convide um usuário existente para colaborar neste projeto
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email do Usuário</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@exemplo.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role no Projeto</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(v) => setInviteRole(v as UserRole)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">
                          <div>
                            <div className="font-medium">Gerente</div>
                            <div className="text-xs text-muted-foreground">
                              Pode editar o projeto
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="field_tech">
                          <div>
                            <div className="font-medium">Técnico de Campo</div>
                            <div className="text-xs text-muted-foreground">
                              Pode marcar instalações e adicionar fotos
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="viewer">
                          <div>
                            <div className="font-medium">Visualizador</div>
                            <div className="text-xs text-muted-foreground">
                              Apenas visualização
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleInviteCollaborator}>Adicionar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Convidado em</TableHead>
                {canManageCollaborators && <TableHead>Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Show project owner first */}
              <TableRow>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-yellow-500" />
                    <span>Proprietário</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="destructive">Proprietário</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">Ativo</Badge>
                </TableCell>
                <TableCell>-</TableCell>
                {canManageCollaborators && <TableCell>-</TableCell>}
              </TableRow>

              {collaborators.map((collaborator) => (
                <TableRow key={collaborator.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={collaborator.profile?.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(collaborator.profile?.display_name || null)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div>{collaborator.profile?.display_name || 'Sem nome'}</div>
                        {collaborator.profile?.email && (
                          <div className="text-xs text-muted-foreground">
                            {collaborator.profile.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canManageCollaborators ? (
                      <Select
                        value={collaborator.role}
                        onValueChange={(v) =>
                          handleUpdateRole(collaborator.id, v as UserRole)
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">Gerente</SelectItem>
                          <SelectItem value="field_tech">Técnico</SelectItem>
                          <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge>{ROLE_LABELS[collaborator.role as UserRole]}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(collaborator.status, collaborator.accepted_at)}
                  </TableCell>
                  <TableCell>
                    {format(new Date(collaborator.invited_at), 'dd/MM/yyyy', {
                      locale: ptBR,
                    })}
                  </TableCell>
                  {canManageCollaborators && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCollaborator(collaborator.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}

              {collaborators.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canManageCollaborators ? 5 : 4}
                    className="text-center text-muted-foreground"
                  >
                    Nenhum colaborador adicionado ainda
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
