import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/services/logger';
import { authRateLimiter } from '@/services/auth/rateLimiter';
import { autoSyncManager } from '@/services/sync/autoSync';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Helper function to get the correct redirect URL based on environment
const getRedirectUrl = (path = '/') => {
  const isProduction = window.location.hostname !== 'localhost';
  if (isProduction) {
    return `https://dea-field-manager.lovable.app${path}`;
  }
  return `${window.location.origin}${path}`;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      logger.error('Unexpected error fetching profile:', error);
    }
  };

  useEffect(() => {
    let hasInitialized = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        logger.debug('Auth state changed:', { event, userId: session?.user?.id });
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch with setTimeout to prevent recursion
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
          
          // Initialize auto-sync when user logs in
          if (!hasInitialized) {
            hasInitialized = true;
            setTimeout(() => {
              autoSyncManager.initialize().then(() => {
                autoSyncManager.initializeWithAuth();
              }).catch(error => {
                console.error('Auto-sync initialization failed:', error);
              });
            }, 100);
          }
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
        }, 0);
        
        // Initialize auto-sync for existing session
        if (!hasInitialized) {
          hasInitialized = true;
          setTimeout(() => {
            autoSyncManager.initialize().then(() => {
              autoSyncManager.initializeWithAuth();
            }).catch(error => {
              console.error('Auto-sync initialization failed:', error);
            });
          }, 100);
        }
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    // Check rate limit
    const rateCheck = authRateLimiter.checkLimit('signup', email);
    if (!rateCheck.allowed) {
      const error = new Error(`Too many signup attempts. Try again in ${rateCheck.retryAfter} seconds.`);
      return { error };
    }

    const redirectUrl = getRedirectUrl('/');
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: displayName ? { display_name: displayName } : undefined
      }
    });
    
    // Record rate limit attempt
    authRateLimiter.recordAttempt('signup', email, !error);
    
    if (error) {
      logger.error('Sign up error:', error);
    }
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    // Check rate limit
    const rateCheck = authRateLimiter.checkLimit('login', email);
    if (!rateCheck.allowed) {
      const error = new Error(`Too many login attempts. Try again in ${rateCheck.retryAfter} seconds.`);
      return { error };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    // Record rate limit attempt
    authRateLimiter.recordAttempt('login', email, !error);
    
    if (error) {
      logger.error('Sign in error:', error);
    }
    
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      logger.error('Sign out error:', error);
    }
    
    return { error };
  };

  const resetPassword = async (email: string) => {
    // Check rate limit
    const rateCheck = authRateLimiter.checkLimit('reset', email);
    if (!rateCheck.allowed) {
      const error = new Error(`Too many password reset attempts. Try again in ${rateCheck.retryAfter} seconds.`);
      return { error };
    }

    const redirectUrl = getRedirectUrl('/auth/reset-password');
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    
    // Record rate limit attempt
    authRateLimiter.recordAttempt('reset', email, !error);
    
    if (error) {
      logger.error('Password reset error:', error);
    }
    
    return { error };
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        logger.error('Profile update error:', error);
        return { error };
      }

      // Refresh profile data
      await fetchProfile(user.id);
      return { error: null };
    } catch (error) {
      logger.error('Profile update exception:', error);
      return { error };
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};