/**
 * User management service for admin operations
 */

import { supabase } from "@/integrations/supabase/client"
import { UserRole } from "@/middleware/permissions"
import { logger } from "./logger"

interface AdminUserListResponse {
  users: UserProfile[]
}

export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  email?: string;
}

// UserInvitation interface - Table does not exist yet
export interface UserInvitation {
  id: string;
  email: string;
  role: UserRole;
  invited_by: string;
  invitation_token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

// AccessLog interface - Table does not exist yet
export interface AccessLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers(): Promise<{
  data: UserProfile[] | null
  error: Error | null
}> {
  try {
    const { data: response, error } = await supabase.functions.invoke<AdminUserListResponse>(
      "admin-user-management",
      {
        body: {
          action: "list_users",
        },
      }
    )

    if (error) throw error

    return { data: response?.users ?? [], error: null }
  } catch (error) {
    logger.error("Error fetching users:", error)
    return { data: null, error: error as Error }
  }
}

/**
 * Update user role (admin only)
 * NOTE: Roles should be managed in a separate user_roles table
 */
export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<{ error: Error | null }> {
  logger.warn('updateUserRole: profiles table does not have role column - implement user_roles table');
  return { 
    error: new Error('User roles feature not implemented - table does not exist') 
  };
}

/**
 * Create user invitation
 * NOTE: user_invitations table does not exist yet
 */
export async function createInvitation(
  email: string,
  role: UserRole
): Promise<{ data: any | null; error: Error | null }> {
  logger.warn('createInvitation called but user_invitations table does not exist');
  return { 
    data: null, 
    error: new Error('User invitations feature not implemented - table does not exist') 
  };
}

/**
 * Get all invitations (admin only)
 * NOTE: user_invitations table does not exist yet
 */
export async function getAllInvitations(): Promise<{
  data: any[] | null;
  error: Error | null;
}> {
  logger.warn('getAllInvitations called but user_invitations table does not exist');
  return { 
    data: [], 
    error: new Error('User invitations feature not implemented - table does not exist') 
  };
}

/**
 * Cancel/delete invitation
 * NOTE: user_invitations table does not exist yet
 */
export async function cancelInvitation(invitationId: string): Promise<{ error: Error | null }> {
  logger.warn('cancelInvitation called but user_invitations table does not exist');
  return { 
    error: new Error('User invitations feature not implemented - table does not exist') 
  };
}

/**
 * Accept invitation (used during signup)
 * NOTE: user_invitations table does not exist yet
 */
export async function acceptInvitation(token: string): Promise<{
  data: { email: string; role: UserRole } | null;
  error: Error | null;
}> {
  logger.warn('acceptInvitation called but user_invitations table does not exist');
  return { 
    data: null, 
    error: new Error('User invitations feature not implemented - table does not exist') 
  };
}

/**
 * Get user access logs
 * NOTE: user_access_logs table does not exist yet
 */
export async function getUserAccessLogs(
  userId?: string,
  limit = 100
): Promise<{ data: any[] | null; error: Error | null }> {
  logger.warn('getUserAccessLogs called but user_access_logs table does not exist');
  return { 
    data: [], 
    error: new Error('User access logs feature not implemented - table does not exist') 
  };
}

/**
 * Log user access (audit trail)
 * NOTE: user_access_logs table does not exist yet
 */
export async function logUserAccess(
  action: string,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, any>
): Promise<{ error: Error | null }> {
  logger.debug('logUserAccess: user_access_logs table does not exist', { action, resourceType, resourceId });
  return { error: null }; // Silent fail
}

/**
 * Delete user (admin only - soft delete)
 * NOTE: Deactivation not implemented - profiles table does not have role fields
 */
export async function deleteUser(userId: string): Promise<{ error: Error | null }> {
  logger.warn('deleteUser: profiles table does not have role fields - implement user_roles table');
  return { 
    error: new Error('User deactivation feature not implemented - role fields do not exist') 
  };
}

/**
 * Generate secure invitation token
 */
function generateInvitationToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get user statistics (admin dashboard)
 * NOTE: user_access_logs table does not exist yet
 */
export async function getUserStats(): Promise<{
  data: {
    total: number;
    byRole: Record<UserRole, number>;
    activeToday: number;
    activeThisWeek: number;
  } | null;
  error: Error | null;
}> {
  logger.warn('getUserStats: user_access_logs table does not exist');
  return { 
    data: null, 
    error: new Error('User stats feature not implemented - table does not exist') 
  };
}
