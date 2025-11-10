import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuthContext';
import { Loader2 } from 'lucide-react';
import type { PermissionAction } from '@/middleware/permissions';

interface ProtectedRouteProps {
  children: ReactNode;
  permission?: PermissionAction | PermissionAction[];
  requireAll?: boolean;
}

export const ProtectedRoute = ({ children, permission, requireAll }: ProtectedRouteProps) => {
  const { user, loading, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Verificando autenticação...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login but save the attempted location
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (permission && !hasPermission(permission, requireAll)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Você não possui permissão para acessar este recurso.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};