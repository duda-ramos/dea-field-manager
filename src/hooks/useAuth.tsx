import { useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/services/logger';
import { errorMonitoring } from '@/services/errorMonitoring';
import { authRateLimiter } from '@/services/auth/rateLimiter';
import { autoSyncManager } from '@/services/sync/autoSync';
import { AuthContext } from '@/contexts/AuthContext';
import { resolvePermissions, type PermissionAction, type UserRole } from '@/middleware/permissions';
import { createUserInvite, recordAccessLog } from '@/lib/supabase';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
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
  const [role, setRole] = useState<UserRole>('viewer');
  const [permissions, setPermissions] = useState<PermissionAction[]>(() => resolvePermissions('viewer'));
  const [loading, setLoading] = useState(true);
  const userId = user?.id ?? null;

  const applyRole = useCallback((nextRole: UserRole | null | undefined) => {
    const normalizedRole: UserRole = (nextRole && ['admin', 'manager', 'viewer', 'field_tech'].includes(nextRole))
      ? (nextRole as UserRole)
      : 'viewer';
    setRole(normalizedRole);
    setPermissions(resolvePermissions(normalizedRole));
    return normalizedRole;
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
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
        const nextRole = applyRole((data as Partial<Profile>).role);
        setProfile({
          id: data.id,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
          created_at: data.created_at,
          updated_at: data.updated_at,
          role: nextRole
        });
      } else {
        applyRole('viewer');
        setProfile(null);
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
  }, [applyRole]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        logger.debug('Auth state changed:', { event, userId: nextSession?.user?.id });

        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          // Log access asynchronously so UI is not blocked
          recordAccessLog({
            userId: nextSession.user.id,
            action: event === 'TOKEN_REFRESHED' ? 'session_refresh' : 'signin'
          }).catch(error => {
            logger.warn('[useAuth] Falha ao registrar log de acesso', error);
          });

          // Defer profile fetch with setTimeout to prevent recursion
          setTimeout(() => {
            fetchProfile(nextSession.user!.id);
          }, 0);

          // Initialize auto-sync when user logs in (only once globally)
          setTimeout(() => {
            initializeAutoSyncOnce().catch(_error => {
              // Error already logged in initializeAutoSyncOnce
            });
          }, 100);
        } else {
          setProfile(null);
          applyRole('viewer');

          if (event === 'SIGNED_OUT') {
            recordAccessLog({
              userId: session?.user?.id ?? null,
              action: 'signout'
            }).catch(error => {
              logger.warn('[useAuth] Falha ao registrar log de saída', error);
            });

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
          fetchProfile(session.user!.id);
        }, 0);

        setTimeout(() => {
          initializeAutoSyncOnce().catch(_error => {
            // Error already logged in initializeAutoSyncOnce
          });
        }, 100);
      } else {
        setProfile(null);
        applyRole('viewer');
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

  const signUp = async (email: string, password: string, displayName?: string, requestedRole: UserRole = 'viewer') => {
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
        data: {
          ...(displayName ? { display_name: displayName } : {}),
          role: requestedRole
        }
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
    } else {
      recordAccessLog({
        userId: user?.id ?? null,
        action: 'signout'
      }).catch(logError => {
        logger.warn('Falha ao registrar log de saída manual', logError);
      });
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
      if (updates.role) {
        applyRole(updates.role as UserRole);
      }
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

  const refreshProfile = useCallback(async () => {
    if (userId) {
      await fetchProfile(userId);
    }
  }, [userId, fetchProfile]);

  const hasPermission = useCallback(
    (permission: PermissionAction | PermissionAction[], requireAll = false) => {
      const permissionList = Array.isArray(permission) ? permission : [permission];

      if (role === 'admin') {
        return true;
      }

      if (requireAll) {
        return permissionList.every(value => permissions.includes(value));
      }

      return permissionList.some(value => permissions.includes(value));
    },
    [permissions, role]
  );

  const inviteUser = async (email: string, inviteRole: UserRole) => {
    if (!userId) {
      return { data: null, error: new Error('Usuário não autenticado') };
    }

    return createUserInvite({
      email,
      role: inviteRole,
      invitedBy: userId
    });
  };

  const value = {
    user,
    session,
    profile,
    loading,
    role,
    permissions,
    isAdmin: role === 'admin',
    hasPermission,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    refreshProfile,
    inviteUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};