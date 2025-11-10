import { createContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import type { UserRole } from '@/middleware/permissions';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  role_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  userRole: UserRole | null;
  isAdmin: boolean;
  isManager: boolean;
  isFieldTech: boolean;
  isViewer: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  hasPermission: (resource: string, action: string) => boolean;
  hasMinimumRole: (minRole: UserRole) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
