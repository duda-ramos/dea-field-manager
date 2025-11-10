import { useState, useEffect } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { withPermission } from '@/components/auth/withPermission';
import {
  getAllUsers,
  updateUserRole,
  createInvitation,
  getAllInvitations,
  cancelInvitation,
  getUserStats,
  UserProfile,
  UserInvitation,
} from '@/services/userManagement';
import { UserRole, ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/middleware/permissions';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  UserPlus,
  Users,
  Shield,
  Mail,
  Calendar,
  Activity,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function UserManagementPage() {
  const auth = useAuthContext();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersResult, invitationsResult, statsResult] = await Promise.all([
        getAllUsers(),
        getAllInvitations(),
        getUserStats(),
      ]);

      if (usersResult.data) setUsers(usersResult.data);
      if (invitationsResult.data) setInvitations(invitationsResult.data);
      if (statsResult.data) setStats(statsResult.data);
    } catch (error) {
      console.error('Error loading user management data:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar dados de usuários',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteUser() {
    if (!inviteEmail) {
      toast({
        title: 'Erro',
        description: 'Digite um email válido',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await createInvitation(inviteEmail, inviteRole);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao criar convite: ' + error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Convite Enviado',
      description: `Convite enviado para ${inviteEmail} com role ${ROLE_LABELS[inviteRole]}`,
    });

    setInviteEmail('');
    setInviteRole('viewer');
    setInviteDialogOpen(false);
    loadData();
  }

  async function handleUpdateRole(userId: string, newRole: UserRole) {
    // Prevent changing own role
    if (userId === auth.user?.id) {
      toast({
        title: 'Erro',
        description: 'Você não pode alterar seu próprio role',
        variant: 'destructive',
      });
      return;
    }

    setUpdatingUserId(userId);
    const { error } = await updateUserRole(userId, newRole);
    setUpdatingUserId(null);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar role: ' + error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Role Atualizado',
      description: 'Role do usuário atualizado com sucesso',
    });

    loadData();
  }

  async function handleCancelInvitation(invitationId: string) {
    const { error } = await cancelInvitation(invitationId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao cancelar convite: ' + error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Convite Cancelado',
      description: 'Convite cancelado com sucesso',
    });

    loadData();
  }

  function getRoleBadgeVariant(role: UserRole) {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'manager':
        return 'default';
      case 'field_tech':
        return 'secondary';
      case 'viewer':
        return 'outline';
      default:
        return 'outline';
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie usuários, roles e convites do sistema
          </p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Novo Usuário</DialogTitle>
              <DialogDescription>
                Envie um convite por email para adicionar um novo usuário ao sistema
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@exemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <div>
                          <div className="font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground">
                            {ROLE_DESCRIPTIONS[value as UserRole]}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleInviteUser}>Enviar Convite</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administradores</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byRole.admin}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ativos Hoje</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeToday}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ativos esta Semana</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeThisWeek}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" />
            Usuários ({users.length})
          </TabsTrigger>
          <TabsTrigger value="invitations">
            <Mail className="mr-2 h-4 w-4" />
            Convites ({invitations.filter((i) => !i.accepted_at).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usuários do Sistema</CardTitle>
              <CardDescription>Gerencie roles e permissões dos usuários</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.display_name || 'Sem nome'}
                      </TableCell>
                      <TableCell>{user.email || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(v) => handleUpdateRole(user.id, v as UserRole)}
                          disabled={updatingUserId === user.id || user.id === auth.user?.id}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROLE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Convites Pendentes</CardTitle>
              <CardDescription>Gerencie convites enviados aos usuários</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Enviado em</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(invitation.role)}>
                          {ROLE_LABELS[invitation.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(invitation.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invitation.expires_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {invitation.accepted_at ? (
                          <Badge variant="outline">Aceito</Badge>
                        ) : new Date(invitation.expires_at) < new Date() ? (
                          <Badge variant="destructive">Expirado</Badge>
                        ) : (
                          <Badge>Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!invitation.accepted_at && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelInvitation(invitation.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {invitations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhum convite encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Protect the page with admin-only access
export default withPermission(UserManagementPage, {
  requiredRole: 'admin',
  showDeniedMessage: true,
  deniedMessage: 'Apenas administradores podem acessar o gerenciamento de usuários',
});
