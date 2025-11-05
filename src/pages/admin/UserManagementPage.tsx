import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, MailPlus, RefreshCcw, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuthContext";
import { withPermission, type UserRole } from "@/middleware/permissions";
import { fetchUsersWithRoles, updateUserRole, type UserWithRole } from "@/lib/supabase";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  viewer: 'Visualizador',
  field_tech: 'Técnico de Campo'
};

const UserManagementPageBase = () => {
  const { toast } = useToast();
  const { inviteUser, user, role: currentRole } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer');
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const nameA = (a.display_name || a.email).toLowerCase();
      const nameB = (b.display_name || b.email).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [users]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await fetchUsersWithRoles();
    if (error) {
      console.error('[UserManagementPage] Failed to load users', error);
      toast({
        title: 'Erro ao carregar usuários',
        description: 'Não foi possível carregar a lista de usuários. Tente novamente mais tarde.',
        variant: 'destructive'
      });
    } else if (data) {
      setUsers(data);
    }
    setLoadingUsers(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (currentRole !== 'admin') {
      toast({
        title: 'Permissão insuficiente',
        description: 'Apenas administradores podem alterar permissões de usuários.',
        variant: 'destructive'
      });
      return;
    }

    const { error } = await updateUserRole(userId, newRole);
    if (error) {
      console.error('[UserManagementPage] Failed to update role', error);
      toast({
        title: 'Erro ao atualizar permissão',
        description: 'Não foi possível atualizar a permissão do usuário. Tente novamente.',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Permissão atualizada',
      description: 'A permissão do usuário foi atualizada com sucesso.'
    });
    loadUsers();
  };

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsInviting(true);
    setInviteLink(null);

    const { data, error } = await inviteUser(inviteEmail, inviteRole);

    if (error || !data) {
      console.error('[UserManagementPage] Failed to invite user', error);
      toast({
        title: 'Erro ao criar convite',
        description: error?.message ?? 'Não foi possível gerar o convite. Verifique os dados informados.',
        variant: 'destructive'
      });
      setIsInviting(false);
      return;
    }

    setInviteLink(data.inviteUrl);
    setInviteEmail('');
    setInviteRole('viewer');
    toast({
      title: 'Convite gerado',
      description: 'Compartilhe o link gerado com o usuário convidado.'
    });
    setIsInviting(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Convidar novo usuário</CardTitle>
          <CardDescription>Envie um convite com um link único para adicionar novos colaboradores à plataforma.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="grid gap-4 md:grid-cols-[2fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={event => setInviteEmail(event.target.value)}
                placeholder="exemplo@empresa.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Permissão</Label>
              <Select value={inviteRole} onValueChange={value => setInviteRole(value as UserRole)}>
                <SelectTrigger id="invite-role">
                  <SelectValue placeholder="Selecione a permissão" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                    <SelectItem key={role} value={role}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={isInviting} className="w-full gap-2">
                {isInviting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MailPlus className="h-4 w-4" />
                )}
                Gerar convite
              </Button>
            </div>
          </form>

          {inviteLink && (
            <Alert className="mt-4">
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Convite gerado com sucesso</AlertTitle>
              <AlertDescription>
                Compartilhe o link abaixo com o usuário convidado:
                <br />
                <span className="font-mono text-sm break-all">{inviteLink}</span>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Usuários cadastrados</CardTitle>
            <CardDescription>Gerencie as permissões dos usuários ativos.</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={loadUsers} disabled={loadingUsers}>
            <RefreshCcw className={`h-4 w-4 ${loadingUsers ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Carregando usuários...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Permissão</TableHead>
                  <TableHead className="hidden sm:table-cell">Última atualização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map(userItem => (
                  <TableRow key={userItem.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{userItem.display_name ?? 'Usuário sem nome'}</span>
                        {user?.id === userItem.id && (
                          <Badge variant="secondary" className="mt-1 self-start">
                            Você
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{userItem.email}</TableCell>
                    <TableCell>
                      <Select
                        value={userItem.role}
                        onValueChange={value => handleRoleChange(userItem.id, value as UserRole)}
                        disabled={currentRole !== 'admin' || user?.id === userItem.id}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([role, label]) => (
                            <SelectItem key={role} value={role}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {new Date(userItem.updated_at).toLocaleString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
                {sortedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default withPermission(UserManagementPageBase, 'users:manage');
