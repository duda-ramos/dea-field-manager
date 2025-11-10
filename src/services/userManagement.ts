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
  role: UserRole;
  role_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  email?: string;
}

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
 */
export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    if (error) throw error;

    // Log the action
    await logUserAccess('update_user_role', 'profiles', userId, { new_role: role });

    return { error: null };
  } catch (error) {
    logger.error('Error updating user role:', error);
    return { error: error as Error };
  }
}

/**
 * Create user invitation
 */
export async function createInvitation(
  email: string,
  role: UserRole
): Promise<{ data: UserInvitation | null; error: Error | null }> {
  try {
    // Generate invitation token
    const token = generateInvitationToken();
    
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('user_invitations')
      .insert({
        email,
        role,
        invited_by: currentUser.user.id,
        invitation_token: token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // TODO: Send invitation email
    // await sendInvitationEmail(email, token);

    return { data, error: null };
  } catch (error) {
    logger.error('Error creating invitation:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Get all invitations (admin only)
 */
export async function getAllInvitations(): Promise<{
  data: UserInvitation[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('user_invitations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    logger.error('Error fetching invitations:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Cancel/delete invitation
 */
export async function cancelInvitation(invitationId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('user_invitations')
      .delete()
      .eq('id', invitationId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    logger.error('Error canceling invitation:', error);
    return { error: error as Error };
  }
}

/**
 * Accept invitation (used during signup)
 */
export async function acceptInvitation(token: string): Promise<{
  data: { email: string; role: UserRole } | null;
  error: Error | null;
}> {
  try {
    // Find invitation by token
    const { data: invitation, error: fetchError } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('invitation_token', token)
      .single();

    if (fetchError) throw fetchError;
    if (!invitation) throw new Error('Invitation not found');

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error('Invitation has expired');
    }

    // Check if already accepted
    if (invitation.accepted_at) {
      throw new Error('Invitation already accepted');
    }

    // Mark as accepted
    const { error: updateError } = await supabase
      .from('user_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    if (updateError) throw updateError;

    return {
      data: {
        email: invitation.email,
        role: invitation.role,
      },
      error: null,
    };
  } catch (error) {
    logger.error('Error accepting invitation:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Get user access logs
 */
export async function getUserAccessLogs(
  userId?: string,
  limit = 100
): Promise<{ data: AccessLog[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from('user_access_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    logger.error('Error fetching access logs:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Log user access (audit trail)
 */
export async function logUserAccess(
  action: string,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, any>
): Promise<{ error: Error | null }> {
  try {
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user) {
      // Silent fail if not authenticated
      return { error: null };
    }

    const { error } = await supabase.from('user_access_logs').insert({
      user_id: currentUser.user.id,
      action,
      resource_type: resourceType || null,
      resource_id: resourceId || null,
      metadata: metadata || {},
    });

    if (error) throw error;

    return { error: null };
  } catch (error) {
    // Log but don't fail the operation
    logger.error('Error logging user access:', error);
    return { error: null };
  }
}

/**
 * Delete user (admin only - soft delete)
 */
export async function deleteUser(userId: string): Promise<{ error: Error | null }> {
  try {
    // In Supabase, we can't directly delete auth users from client
    // This should be done via Supabase Admin API or Edge Functions
    // For now, we'll just deactivate the user by changing their role
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        role: 'viewer',
        role_metadata: { deactivated: true, deactivated_at: new Date().toISOString() }
      })
      .eq('id', userId);

    if (error) throw error;

    await logUserAccess('deactivate_user', 'profiles', userId);

    return { error: null };
  } catch (error) {
    logger.error('Error deleting user:', error);
    return { error: error as Error };
  }
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
  try {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('role, created_at');

    if (profilesError) throw profilesError;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: accessLogs, error: logsError } = await supabase
      .from('user_access_logs')
      .select('user_id, created_at')
      .gte('created_at', weekStart.toISOString());

    if (logsError) throw logsError;

    const byRole: Record<UserRole, number> = {
      admin: 0,
      manager: 0,
      field_tech: 0,
      viewer: 0,
    };

    profiles?.forEach((profile) => {
      byRole[profile.role as UserRole]++;
    });

    const uniqueUsersToday = new Set(
      accessLogs
        ?.filter((log) => new Date(log.created_at) >= todayStart)
        .map((log) => log.user_id)
    ).size;

    const uniqueUsersWeek = new Set(accessLogs?.map((log) => log.user_id)).size;

    return {
      data: {
        total: profiles?.length || 0,
        byRole,
        activeToday: uniqueUsersToday,
        activeThisWeek: uniqueUsersWeek,
      },
      error: null,
    };
  } catch (error) {
    logger.error('Error fetching user stats:', error);
    return { data: null, error: error as Error };
  }
}
