import { createContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import type { PermissionAction, UserRole } from '@/middleware/permissions';
import type { InviteLink } from '@/lib/supabase';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  role: UserRole;
  permissions: PermissionAction[];
  hasPermission: (permission: PermissionAction | PermissionAction[], requireAll?: boolean) => boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, displayName?: string, role?: UserRole) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  inviteUser: (email: string, role: UserRole) => Promise<{ data: InviteLink | null; error: Error | null }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
