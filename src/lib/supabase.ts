import { supabase } from '@/integrations/supabase/client';
import type { UserRole } from '@/middleware/permissions';

export interface InviteLink {
  id: string;
  email: string;
  role: UserRole;
  token: string;
  expires_at: string;
  invited_by: string | null;
  inviteUrl: string;
}

export interface CreateInviteInput {
  email: string;
  role: UserRole;
  invitedBy: string;
  expiresInHours?: number;
}

export interface AccessLogInput {
  userId: string | null;
  action: 'signin' | 'signout' | 'session_refresh';
  metadata?: Record<string, unknown> | null;
}

export interface UserWithRole {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  updated_at: string;
  created_at: string;
}

export interface ProjectMemberProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  email: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: UserRole;
  invited_at: string;
  invited_by: string | null;
  profile?: ProjectMemberProfile | null;
}

export interface ProfileSummary {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
}

export interface AddProjectMemberInput {
  projectId: string;
  userId: string;
  role: UserRole;
  invitedBy?: string | null;
}

interface ProjectMemberRecord {
  id: string;
  project_id: string;
  user_id: string;
  role: UserRole | null;
  invited_at: string;
  invited_by: string | null;
  profiles?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    role: UserRole | null;
    email: string;
  } | null;
  profile?: ProjectMemberProfile | null;
}

const getInviteUrl = (token: string) => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/register?token=${token}`;
  }
  return `/auth/register?token=${token}`;
};

const normalizeError = (error: unknown): Error | null => {
  if (!error) {
    return null;
  }
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return new Error(typeof message === 'string' ? message : 'Erro desconhecido');
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  return new Error('Erro desconhecido');
};

const normalizeProjectMemberRecord = (member: ProjectMemberRecord): ProjectMember => ({
  id: member.id,
  project_id: member.project_id,
  user_id: member.user_id,
  role: (member.role ?? 'viewer') as UserRole,
  invited_at: member.invited_at,
  invited_by: member.invited_by,
  profile: member.profiles
    ? {
      id: member.profiles.id,
      display_name: member.profiles.display_name,
      avatar_url: member.profiles.avatar_url,
      role: (member.profiles.role ?? 'viewer') as UserRole,
      email: member.profiles.email
    }
    : member.profile ?? undefined
});

export const createUserInvite = async ({
  email,
  role,
  invitedBy,
  expiresInHours = 72
}: CreateInviteInput) => {
  const token = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;

  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('user_invites')
    .insert({
      email,
      role,
      token,
      invited_by: invitedBy,
      expires_at: expiresAt
    })
    .select()
    .single();

  const normalizedError = normalizeError(error);
  if (normalizedError) {
    return { data: null, error: normalizedError };
  }

  const inviteLink: InviteLink = {
    ...data,
    inviteUrl: getInviteUrl(token)
  };

  return { data: inviteLink, error: null };
};

export const recordAccessLog = async ({ userId, action, metadata = null }: AccessLogInput) => {
  if (!userId) {
    return { error: null };
  }

  const { error } = await supabase.from('access_audit_logs').insert({
    user_id: userId,
    action,
    metadata
  });

  return { error: normalizeError(error) };
};

export const fetchUsersWithRoles = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, updated_at, created_at')
    .order('display_name', { ascending: true });

  const normalizedError = normalizeError(error);
  if (normalizedError) {
    return { data: null, error: normalizedError };
  }

  const normalized: UserWithRole[] = data.map(item => ({
    id: item.id,
    email: item.email,
    display_name: item.display_name,
    role: (item.role ?? 'viewer') as UserRole,
    updated_at: item.updated_at,
    created_at: item.created_at
  }));

  return { data: normalized, error: null };
};

export const updateUserRole = async (userId: string, role: UserRole) => {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  return { error: normalizeError(error) };
};

export const fetchProjectMembers = async (projectId: string) => {
  const { data, error } = await supabase
    .from('project_members')
    .select('id, project_id, user_id, role, invited_at, invited_by, profiles:profiles(id, display_name, avatar_url, role, email)')
    .eq('project_id', projectId)
    .order('invited_at', { ascending: true });

  const normalizedError = normalizeError(error);
  if (normalizedError) {
    return { data: null, error: normalizedError };
  }

  const members: ProjectMember[] = data.map(member => normalizeProjectMemberRecord(member));

  return { data: members, error: null };
};

export const updateProjectMemberRole = async (memberId: string, role: UserRole) => {
  const { error } = await supabase.from('project_members').update({ role }).eq('id', memberId);
  return { error: normalizeError(error) };
};

export const addProjectMember = async ({ projectId, userId, role, invitedBy = null }: AddProjectMemberInput) => {
  const { data, error } = await supabase
    .from('project_members')
    .insert({
      project_id: projectId,
      user_id: userId,
      role,
      invited_by: invitedBy
    })
    .select('id, project_id, user_id, role, invited_at, invited_by, profiles:profiles(id, display_name, avatar_url, role, email)')
    .single();

  const normalizedError = normalizeError(error);
  if (normalizedError) {
    return { data: null, error: normalizedError };
  }

  return { data: normalizeProjectMemberRecord(data), error: null };
};

export const removeProjectMember = async (memberId: string) => {
  const { error } = await supabase.from('project_members').delete().eq('id', memberId);
  return { error: normalizeError(error) };
};

export const findProfileByEmail = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url, role')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  const normalizedError = normalizeError(error);
  if (normalizedError) {
    return { data: null, error: normalizedError };
  }

  if (!data) {
    return { data: null, error: null };
  }

  const profile: ProfileSummary = {
    id: data.id,
    email: data.email,
    display_name: data.display_name,
    avatar_url: data.avatar_url,
    role: (data.role ?? 'viewer') as UserRole
  };

  return { data: profile, error: null };
};
