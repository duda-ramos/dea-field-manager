import { ComponentType, PropsWithChildren } from 'react';
import { useAuth } from '@/hooks/useAuthContext';

export type UserRole = 'admin' | 'manager' | 'viewer' | 'field_tech';

export type PermissionAction =
  | 'projects:view'
  | 'projects:create'
  | 'projects:edit'
  | 'projects:delete'
  | 'installations:update'
  | 'files:manage'
  | 'members:manage'
  | 'users:manage'
  | 'audit:view'
  | 'audit:log';

const BASE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  admin: [
    'projects:view',
    'projects:create',
    'projects:edit',
    'projects:delete',
    'installations:update',
    'files:manage',
    'members:manage',
    'users:manage',
    'audit:view',
    'audit:log'
  ],
  manager: [
    'projects:view',
    'projects:create',
    'projects:edit',
    'installations:update',
    'files:manage',
    'members:manage'
  ],
  viewer: ['projects:view'],
  field_tech: ['projects:view', 'installations:update', 'files:manage']
};

export const resolvePermissions = (role: UserRole | null | undefined): PermissionAction[] => {
  if (!role) {
    return BASE_PERMISSIONS.viewer;
  }
  return BASE_PERMISSIONS[role] ?? BASE_PERMISSIONS.viewer;
};

const ensureArray = (permission: PermissionAction | PermissionAction[]): PermissionAction[] =>
  Array.isArray(permission) ? permission : [permission];

export const roleHasPermission = (
  role: UserRole | null | undefined,
  permission: PermissionAction | PermissionAction[]
) => {
  const permissions = resolvePermissions(role);
  const required = ensureArray(permission);

  if (role === 'admin') {
    return true;
  }

  return required.every(value => permissions.includes(value));
};

interface WithPermissionOptions {
  fallback?: ComponentType | null;
  loadingComponent?: ComponentType | null;
  requireAll?: boolean;
}

export function withPermission<P extends object>(
  WrappedComponent: ComponentType<P>,
  permission: PermissionAction | PermissionAction[],
  options: WithPermissionOptions = {}
) {
  const { fallback: FallbackComponent = null, loadingComponent: LoadingComponent = null } = options;

  const PermissionWrapped = (props: PropsWithChildren<P>) => {
    const { loading, hasPermission } = useAuth();

    if (loading) {
      return LoadingComponent ? <LoadingComponent /> : null;
    }

    const allowed = hasPermission(permission, options.requireAll);

    if (!allowed) {
      return FallbackComponent ? <FallbackComponent /> : null;
    }

    return <WrappedComponent {...props} />;
  };

  PermissionWrapped.displayName = `withPermission(${WrappedComponent.displayName ?? WrappedComponent.name ?? 'Component'})`;

  return PermissionWrapped;
}

export const guardPermission = (
  role: UserRole | null | undefined,
  permission: PermissionAction | PermissionAction[]
) => roleHasPermission(role, permission);
