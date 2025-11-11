import { useEffect, useState, ReactNode, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/services/logger';
import { errorMonitoring } from '@/services/errorMonitoring';
import { authRateLimiter } from '@/services/auth/rateLimiter';
import { autoSyncManager } from '@/services/sync/autoSync';
import { AuthContext } from '@/contexts/AuthContext';
import type { UserRole } from '@/middleware/permissions';
import * as permissions from '@/middleware/permissions';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  role_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface AuthProviderProps {
  children: ReactNode;
}

// Global flags to prevent duplicate auto-sync initialization
let _autoSyncInitialized = false;
let _autoSyncInitializing = false;

// Helper function to initialize auto-sync only once
const initializeAutoSyncOnce = async () => {
  // Return immediately if already initialized
  if (_autoSyncInitialized) {
    logger.debug('[initializeAutoSyncOnce] Already initialized, skipping');
    return;
  }
  
  // Return if initialization is in progress
  if (_autoSyncInitializing) {
    logger.debug('[initializeAutoSyncOnce] Initialization in progress, skipping');
    return;
  }
  
  // Set flag to prevent concurrent initializations
  _autoSyncInitializing = true;
  
  try {
    logger.debug('[initializeAutoSyncOnce] Starting auto-sync initialization');
    await autoSyncManager.initialize();
    await autoSyncManager.initializeWithAuth();
    _autoSyncInitialized = true;
    logger.debug('[initializeAutoSyncOnce] Auto-sync initialized successfully');
  } catch (error) {
    console.error('[initializeAutoSyncOnce] Falha ao inicializar auto-sync:', error);
    // Reset flag on error to allow retry
    _autoSyncInitializing = false;
    throw error;
  } finally {
    _autoSyncInitializing = false;
  }
};

// Helper function to get the correct redirect URL based on environment
const getRedirectUrl = (path = '/') => {
  const isProduction = window.location.hostname !== 'localhost';
  if (isProduction) {
    return `https://deamanager.lovable.app${path}`;
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
        setProfile(data as any); // Type assertion needed - profiles table structure
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[useAuth] Falha ao buscar perfil:', error, { userId });
      logger.error('Unexpected error fetching profile:', err);
      errorMonitoring.captureError(err, {
        action: 'fetch_profile',
        userId: userId
      });
    }
  };

  useEffect(() => {
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
          
          // Initialize auto-sync when user logs in (only once globally)
          setTimeout(() => {
            initializeAutoSyncOnce().catch(_error => {
              // Error already logged in initializeAutoSyncOnce
            });
          }, 100);
        } else {
          setProfile(null);
          
          // Reset flags when user signs out
          if (event === 'SIGNED_OUT') {
            logger.debug('[useAuth] SIGNED_OUT event - resetting auto-sync flags');
            _autoSyncInitialized = false;
            _autoSyncInitializing = false;
          }
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
        
        // Initialize auto-sync for existing session (only once globally)
        setTimeout(() => {
          initializeAutoSyncOnce().catch(_error => {
            // Error already logged in initializeAutoSyncOnce
          });
        }, 100);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      
      // Cleanup auto-sync on unmount or HMR
      if (_autoSyncInitialized) {
        logger.debug('[useAuth] Cleaning up auto-sync');
        autoSyncManager.cleanup();
        _autoSyncInitialized = false;
        _autoSyncInitializing = false;
      }
    };
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
      errorMonitoring.captureError(error, {
        action: 'auth_signup',
        component: 'AuthProvider'
      });
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
      errorMonitoring.captureError(error, {
        action: 'auth_signin', 
        component: 'AuthProvider'
      });
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
      console.error('[useAuth] Falha ao atualizar perfil:', error, {
        userId: user?.id,
        updates: JSON.stringify(updates)
      });
      logger.error('Profile update exception:', error);
      return { error };
    }
  };

  // Memoize role-based values to prevent unnecessary re-renders
  const userRole = useMemo(() => profile?.role || null, [profile?.role]);
  
  const isAdmin = useMemo(() => permissions.isAdmin(userRole), [userRole]);
  const isManager = useMemo(() => permissions.isManager(userRole), [userRole]);
  const isFieldTech = useMemo(() => permissions.isFieldTech(userRole), [userRole]);
  const isViewer = useMemo(() => userRole === 'viewer', [userRole]);
  
  const hasPermission = useMemo(() => {
    return (resource: string, action: string) => 
      permissions.hasPermission(userRole, resource, action);
  }, [userRole]);
  
  const hasMinimumRole = useMemo(() => {
    return (minRole: UserRole) => 
      permissions.hasMinimumRole(userRole, minRole);
  }, [userRole]);

  const value = {
    user,
    session,
    profile,
    loading,
    userRole,
    isAdmin,
    isManager,
    isFieldTech,
    isViewer,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    hasPermission,
    hasMinimumRole
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};