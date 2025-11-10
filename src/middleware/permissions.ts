/**
 * Permission middleware for role-based access control
 * 
 * Role hierarchy:
 * - admin: Full access to everything
 * - manager: Can edit projects and installations
 * - field_tech: Can mark as installed and upload photos
 * - viewer: Read-only access
 */

export type UserRole = 'admin' | 'manager' | 'field_tech' | 'viewer';

export interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete';
}

/**
 * Role hierarchy levels for comparison
 */
const ROLE_LEVELS: Record<UserRole, number> = {
  admin: 4,
  manager: 3,
  field_tech: 2,
  viewer: 1,
};

/**
 * Permission matrix defining what each role can do
 */
const PERMISSION_MATRIX: Record<UserRole, Record<string, string[]>> = {
  admin: {
    projects: ['create', 'read', 'update', 'delete'],
    installations: ['create', 'read', 'update', 'delete'],
    contacts: ['create', 'read', 'update', 'delete'],
    budgets: ['create', 'read', 'update', 'delete'],
    files: ['create', 'read', 'update', 'delete'],
    users: ['create', 'read', 'update', 'delete'],
    invitations: ['create', 'read', 'update', 'delete'],
    reports: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update'],
    calendar: ['create', 'read', 'update', 'delete'],
  },
  manager: {
    projects: ['create', 'read', 'update', 'delete'],
    installations: ['create', 'read', 'update', 'delete'],
    contacts: ['create', 'read', 'update', 'delete'],
    budgets: ['create', 'read', 'update', 'delete'],
    files: ['create', 'read', 'update', 'delete'],
    users: ['read'],
    invitations: ['read'],
    reports: ['create', 'read', 'update'],
    settings: ['read'],
    calendar: ['create', 'read', 'update', 'delete'],
  },
  field_tech: {
    projects: ['read'],
    installations: ['read', 'update'], // Can only update status and photos
    contacts: ['read'],
    budgets: ['read'],
    files: ['create', 'read'], // Can upload photos
    users: [],
    invitations: [],
    reports: ['read'],
    settings: ['read'],
    calendar: ['read'],
  },
  viewer: {
    projects: ['read'],
    installations: ['read'],
    contacts: ['read'],
    budgets: ['read'],
    files: ['read'],
    users: [],
    invitations: [],
    reports: ['read'],
    settings: ['read'],
    calendar: ['read'],
  },
};

/**
 * Special permissions for field techs on installations
 * These fields can be edited by field techs
 */
export const FIELD_TECH_EDITABLE_FIELDS = [
  'installed',
  'installed_at',
  'photos',
  'observacoes',
];

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  userRole: UserRole | null | undefined,
  resource: string,
  action: string
): boolean {
  if (!userRole) return false;
  
  const permissions = PERMISSION_MATRIX[userRole][resource];
  return permissions ? permissions.includes(action) : false;
}

/**
 * Check if a user has at least a minimum role level
 */
export function hasMinimumRole(
  userRole: UserRole | null | undefined,
  minRole: UserRole
): boolean {
  if (!userRole) return false;
  
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[minRole];
}

/**
 * Check if a user is admin
 */
export function isAdmin(userRole: UserRole | null | undefined): boolean {
  return userRole === 'admin';
}

/**
 * Check if a user is manager or higher
 */
export function isManager(userRole: UserRole | null | undefined): boolean {
  return hasMinimumRole(userRole, 'manager');
}

/**
 * Check if a user is field tech or higher
 */
export function isFieldTech(userRole: UserRole | null | undefined): boolean {
  return hasMinimumRole(userRole, 'field_tech');
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Record<string, string[]> {
  return PERMISSION_MATRIX[role];
}

/**
 * Check if field can be edited based on user role
 */
export function canEditField(
  userRole: UserRole | null | undefined,
  resource: string,
  field: string
): boolean {
  if (!userRole) return false;
  
  // Admins and managers can edit all fields
  if (isManager(userRole)) return true;
  
  // Field techs can only edit specific installation fields
  if (userRole === 'field_tech' && resource === 'installations') {
    return FIELD_TECH_EDITABLE_FIELDS.includes(field);
  }
  
  return false;
}

/**
 * Check if user can access a specific project
 * This needs to be combined with backend checks for project ownership/collaboration
 */
export function canAccessProject(
  userRole: UserRole | null | undefined,
  isOwner: boolean,
  isCollaborator: boolean
): boolean {
  if (!userRole) return false;
  
  // Admins can access all projects
  if (isAdmin(userRole)) return true;
  
  // Others need to be owner or collaborator
  return isOwner || isCollaborator;
}

/**
 * Get disabled state for UI components based on permissions
 */
export function getFieldDisabledState(
  userRole: UserRole | null | undefined,
  resource: string,
  action: string,
  field?: string
): boolean {
  if (!userRole) return true;
  
  // Check basic permission first
  if (!hasPermission(userRole, resource, action)) {
    return true;
  }
  
  // If field is specified, check field-level permission
  if (field) {
    return !canEditField(userRole, resource, field);
  }
  
  return false;
}

/**
 * Filter allowed actions based on user role
 */
export function getAllowedActions(
  userRole: UserRole | null | undefined,
  resource: string
): string[] {
  if (!userRole) return [];
  
  return PERMISSION_MATRIX[userRole][resource] || [];
}

/**
 * Permission error messages
 */
export const PERMISSION_ERRORS = {
  NO_PERMISSION: 'Você não tem permissão para realizar esta ação',
  ADMIN_ONLY: 'Esta ação requer privilégios de administrador',
  MANAGER_ONLY: 'Esta ação requer privilégios de gerente ou superior',
  READ_ONLY: 'Você tem acesso apenas de leitura',
  FIELD_TECH_LIMITED: 'Técnicos de campo só podem marcar como instalado e adicionar fotos',
};

/**
 * Get appropriate error message for permission denial
 */
export function getPermissionErrorMessage(
  userRole: UserRole | null | undefined,
  resource: string,
  action: string
): string {
  if (!userRole) {
    return PERMISSION_ERRORS.NO_PERMISSION;
  }
  
  if (action === 'delete' && !hasPermission(userRole, resource, 'delete')) {
    if (userRole === 'viewer') {
      return PERMISSION_ERRORS.READ_ONLY;
    }
    return PERMISSION_ERRORS.MANAGER_ONLY;
  }
  
  if (action === 'update' && userRole === 'viewer') {
    return PERMISSION_ERRORS.READ_ONLY;
  }
  
  if (action === 'create' && !hasPermission(userRole, resource, 'create')) {
    return PERMISSION_ERRORS.MANAGER_ONLY;
  }
  
  return PERMISSION_ERRORS.NO_PERMISSION;
}

/**
 * Role display names for UI
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  field_tech: 'Técnico de Campo',
  viewer: 'Visualizador',
};

/**
 * Role descriptions for UI
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Acesso total ao sistema, incluindo gerenciamento de usuários',
  manager: 'Pode criar e editar projetos, instalações e relatórios',
  field_tech: 'Pode marcar instalações como concluídas e adicionar fotos',
  viewer: 'Acesso apenas para visualização',
};
