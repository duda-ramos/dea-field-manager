import { ComponentType, ReactNode } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { UserRole } from '@/middleware/permissions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface WithPermissionOptions {
  // Required minimum role
  minRole?: UserRole;
  
  // Required specific role
  requiredRole?: UserRole;
  
  // Resource and action for permission check
  resource?: string;
  action?: string;
  
  // Custom permission check function
  customCheck?: (userRole: UserRole | null, context: any) => boolean;
  
  // Fallback component or message
  fallback?: ReactNode;
  
  // Whether to show access denied message
  showDeniedMessage?: boolean;
  
  // Custom denied message
  deniedMessage?: string;
  
  // Redirect to a specific path on denial
  redirectTo?: string;
}

/**
 * HOC to protect components based on user permissions
 * 
 * @example
 * // Require admin role
 * const AdminPanel = withPermission(Panel, { requiredRole: 'admin' });
 * 
 * @example
 * // Require minimum manager role
 * const ProjectEditor = withPermission(Editor, { minRole: 'manager' });
 * 
 * @example
 * // Require specific permission
 * const DeleteButton = withPermission(Button, { 
 *   resource: 'projects', 
 *   action: 'delete' 
 * });
 */
export function withPermission<P extends object>(
  Component: ComponentType<P>,
  options: WithPermissionOptions = {}
): ComponentType<P> {
  const {
    minRole,
    requiredRole,
    resource,
    action,
    customCheck,
    fallback,
    showDeniedMessage = true,
    deniedMessage,
    redirectTo,
  } = options;

  return function ProtectedComponent(props: P) {
    const auth = useAuthContext();
    const navigate = useNavigate();
    
    // Check if user is authenticated
    if (!auth.user || !auth.userRole) {
      if (redirectTo) {
        navigate(redirectTo);
        return null;
      }
      
      if (fallback) {
        return <>{fallback}</>;
      }
      
      if (showDeniedMessage) {
        return (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertTitle>Acesso Negado</AlertTitle>
            <AlertDescription>
              {deniedMessage || 'Você precisa estar autenticado para acessar este recurso.'}
            </AlertDescription>
            <Button 
              variant="outline" 
              className="mt-2"
              onClick={() => navigate('/auth/login')}
            >
              Fazer Login
            </Button>
          </Alert>
        );
      }
      
      return null;
    }

    // Check minimum role
    if (minRole && !auth.hasMinimumRole(minRole)) {
      return renderDenied();
    }

    // Check specific required role
    if (requiredRole && auth.userRole !== requiredRole) {
      return renderDenied();
    }

    // Check resource/action permission
    if (resource && action && !auth.hasPermission(resource, action)) {
      return renderDenied();
    }

    // Custom permission check
    if (customCheck && !customCheck(auth.userRole, auth)) {
      return renderDenied();
    }

    // User has permission, render component
    return <Component {...props} />;

    function renderDenied() {
      if (redirectTo) {
        navigate(redirectTo);
        return null;
      }
      
      if (fallback) {
        return <>{fallback}</>;
      }
      
      if (showDeniedMessage) {
        return (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acesso Negado</AlertTitle>
            <AlertDescription>
              {deniedMessage || 'Você não tem permissão para acessar este recurso.'}
            </AlertDescription>
          </Alert>
        );
      }
      
      return null;
    }
  };
}

/**
 * Component wrapper for conditional rendering based on permissions
 * 
 * @example
 * <PermissionGate minRole="manager">
 *   <EditButton />
 * </PermissionGate>
 */
interface PermissionGateProps extends WithPermissionOptions {
  children: ReactNode;
}

export function PermissionGate({
  children,
  minRole,
  requiredRole,
  resource,
  action,
  customCheck,
  fallback,
  showDeniedMessage = false,
  deniedMessage,
}: PermissionGateProps) {
  const auth = useAuthContext();

  // Check if user is authenticated
  if (!auth.user || !auth.userRole) {
    if (fallback) return <>{fallback}</>;
    if (showDeniedMessage) {
      return (
        <Alert variant="destructive" className="my-2">
          <Lock className="h-4 w-4" />
          <AlertTitle>Acesso Negado</AlertTitle>
          <AlertDescription>
            {deniedMessage || 'Você precisa estar autenticado.'}
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  }

  // Check minimum role
  if (minRole && !auth.hasMinimumRole(minRole)) {
    return renderDenied();
  }

  // Check specific required role
  if (requiredRole && auth.userRole !== requiredRole) {
    return renderDenied();
  }

  // Check resource/action permission
  if (resource && action && !auth.hasPermission(resource, action)) {
    return renderDenied();
  }

  // Custom permission check
  if (customCheck && !customCheck(auth.userRole, auth)) {
    return renderDenied();
  }

  // User has permission, render children
  return <>{children}</>;

  function renderDenied() {
    if (fallback) return <>{fallback}</>;
    if (showDeniedMessage) {
      return (
        <Alert variant="destructive" className="my-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acesso Negado</AlertTitle>
          <AlertDescription>
            {deniedMessage || 'Você não tem permissão para acessar este recurso.'}
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  }
}

/**
 * Hook to check permissions inline
 * 
 * @example
 * const { canEdit, canDelete } = usePermissions('projects');
 */
export function usePermissions(resource: string) {
  const auth = useAuthContext();

  return {
    canCreate: auth.hasPermission(resource, 'create'),
    canRead: auth.hasPermission(resource, 'read'),
    canUpdate: auth.hasPermission(resource, 'update'),
    canDelete: auth.hasPermission(resource, 'delete'),
    canEdit: auth.hasPermission(resource, 'update'),
    userRole: auth.userRole,
    isAdmin: auth.isAdmin,
    isManager: auth.isManager,
    isFieldTech: auth.isFieldTech,
    isViewer: auth.isViewer,
  };
}
