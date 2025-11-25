import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthProvider } from './useAuth';
import { AuthContext } from '@/contexts/AuthContext';
import { useContext } from 'react';
import {
  createMockSupabaseClient,
  createMockUser,
  createMockSession,
  createMockAuthError,
  mockSuccessfulAuth,
  mockFailedAuth,
} from '@/__tests__/utils/supabaseMock';
import { createMockProfile } from '@/__tests__/fixtures/testData';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: createMockSupabaseClient(),
}));

vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/services/errorMonitoring', () => ({
  errorMonitoring: {
    captureError: vi.fn(),
  },
}));

vi.mock('@/services/auth/rateLimiter', () => ({
  authRateLimiter: {
    checkLimit: vi.fn(() => ({ allowed: true })),
    recordAttempt: vi.fn(),
  },
}));

vi.mock('@/services/sync/autoSync', () => ({
  autoSyncManager: {
    initialize: vi.fn(),
    initializeWithAuth: vi.fn(),
    cleanup: vi.fn(),
  },
}));

vi.mock('@/middleware/permissions', () => ({
  isAdmin: vi.fn((role) => role === 'admin'),
  isManager: vi.fn((role) => role === 'manager' || role === 'admin'),
  isFieldTech: vi.fn((role) => role === 'field_tech'),
  hasPermission: vi.fn(() => true),
  hasMinimumRole: vi.fn(() => true),
}));

import { supabase } from '@/integrations/supabase/client';
import { authRateLimiter } from '@/services/auth/rateLimiter';
import { autoSyncManager } from '@/services/sync/autoSync';

// Helper to use AuthContext in tests
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should start with loading state', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      expect(result.current.loading).toBe(true);
    });

    it('should load existing session on mount', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);
      const mockProfile = createMockProfile();

      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      (supabase.from as any)('profiles').select('*').eq('id', mockUser.id).maybeSingle.mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
    });

    it('should handle no existing session', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });

    it('should initialize auto-sync for authenticated user', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await vi.runAllTimersAsync();

      expect(autoSyncManager.initialize).toHaveBeenCalled();
      expect(autoSyncManager.initializeWithAuth).toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('should sign in successfully', async () => {
      const mockUser = createMockUser({ email: 'test@example.com' });
      const mockSession = createMockSession(mockUser);

      mockSuccessfulAuth(supabase, mockUser, mockSession);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@example.com', 'password123');
      });

      expect(signInResult.error).toBeNull();
      expect(authRateLimiter.recordAttempt).toHaveBeenCalledWith('login', 'test@example.com', true);
    });

    it('should handle sign in failure', async () => {
      const errorMessage = 'Invalid credentials';
      mockFailedAuth(supabase, errorMessage);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@example.com', 'wrong-password');
      });

      expect(signInResult.error).toBeDefined();
      expect(signInResult.error.message).toBe(errorMessage);
      expect(authRateLimiter.recordAttempt).toHaveBeenCalledWith('login', 'test@example.com', false);
    });

    it('should respect rate limiting', async () => {
      (authRateLimiter.checkLimit as any).mockReturnValue({
        allowed: false,
        retryAfter: 300,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@example.com', 'password123');
      });

      expect(signInResult.error).toBeDefined();
      expect(signInResult.error.message).toContain('Too many login attempts');
      expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });
  });

  describe('signUp', () => {
    it('should sign up successfully', async () => {
      (supabase.auth.signUp as any).mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUp('newuser@example.com', 'password123', 'New User');
      });

      expect(signUpResult.error).toBeNull();
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'password123',
        options: {
          emailRedirectTo: expect.any(String),
          data: { display_name: 'New User' },
        },
      });
      expect(authRateLimiter.recordAttempt).toHaveBeenCalledWith('signup', 'newuser@example.com', true);
    });

    it('should handle sign up failure', async () => {
      const error = createMockAuthError('Email already registered');
      (supabase.auth.signUp as any).mockResolvedValue({
        data: { user: null, session: null },
        error,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUp('existing@example.com', 'password123');
      });

      expect(signUpResult.error).toBeDefined();
      expect(authRateLimiter.recordAttempt).toHaveBeenCalledWith('signup', 'existing@example.com', false);
    });

    it('should respect rate limiting for signup', async () => {
      (authRateLimiter.checkLimit as any).mockReturnValue({
        allowed: false,
        retryAfter: 3600,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUp('test@example.com', 'password123');
      });

      expect(signUpResult.error).toBeDefined();
      expect(signUpResult.error.message).toContain('Too many signup attempts');
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      (supabase.auth.signOut as any).mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      let signOutResult: any;
      await act(async () => {
        signOutResult = await result.current.signOut();
      });

      expect(signOutResult.error).toBeNull();
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('should handle sign out error', async () => {
      const error = new Error('Sign out failed');
      (supabase.auth.signOut as any).mockResolvedValue({ error });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      let signOutResult: any;
      await act(async () => {
        signOutResult = await result.current.signOut();
      });

      expect(signOutResult.error).toBeDefined();
    });
  });

  describe('resetPassword', () => {
    it('should request password reset successfully', async () => {
      (supabase.auth.resetPasswordForEmail as any).mockResolvedValue({
        data: {},
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      let resetResult: any;
      await act(async () => {
        resetResult = await result.current.resetPassword('test@example.com');
      });

      expect(resetResult.error).toBeNull();
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          redirectTo: expect.any(String),
        })
      );
      expect(authRateLimiter.recordAttempt).toHaveBeenCalledWith('reset', 'test@example.com', true);
    });

    it('should handle password reset failure', async () => {
      const error = createMockAuthError('Email not found');
      (supabase.auth.resetPasswordForEmail as any).mockResolvedValue({
        data: {},
        error,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      let resetResult: any;
      await act(async () => {
        resetResult = await result.current.resetPassword('nonexistent@example.com');
      });

      expect(resetResult.error).toBeDefined();
      expect(authRateLimiter.recordAttempt).toHaveBeenCalledWith('reset', 'nonexistent@example.com', false);
    });

    it('should respect rate limiting for password reset', async () => {
      (authRateLimiter.checkLimit as any).mockReturnValue({
        allowed: false,
        retryAfter: 3600,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      let resetResult: any;
      await act(async () => {
        resetResult = await result.current.resetPassword('test@example.com');
      });

      expect(resetResult.error).toBeDefined();
      expect(resetResult.error.message).toContain('Too many password reset attempts');
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);
      const mockProfile = createMockProfile();

      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const mockQueryBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQueryBuilder);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.user).toBeDefined();
      });

      let updateResult: any;
      await act(async () => {
        updateResult = await result.current.updateProfile({ display_name: 'Updated Name' });
      });

      expect(updateResult.error).toBeNull();
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ display_name: 'Updated Name' });
    });

    it('should return error when not logged in', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let updateResult: any;
      await act(async () => {
        updateResult = await result.current.updateProfile({ display_name: 'Name' });
      });

      expect(updateResult.error).toBeDefined();
      expect(updateResult.error.message).toBe('No user logged in');
    });
  });

  describe('role-based access', () => {
    it('should correctly identify admin role', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);
      const mockProfile = createMockProfile({ role: 'admin' });

      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const mockFilterBuilder = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      };
      const mockQueryBuilder = {
        select: vi.fn().mockReturnValue(mockFilterBuilder),
      };
      (supabase.from as any).mockReturnValue(mockQueryBuilder);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.userRole).toBe('admin');
      });

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isManager).toBe(true);
    });

    it('should correctly identify manager role', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);
      const mockProfile = createMockProfile({ role: 'manager' });

      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const mockFilterBuilder = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      };
      const mockQueryBuilder = {
        select: vi.fn().mockReturnValue(mockFilterBuilder),
      };
      (supabase.from as any).mockReturnValue(mockQueryBuilder);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.userRole).toBe('manager');
      });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isManager).toBe(true);
    });

    it('should provide permission checking functions', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.user).toBeDefined();
      });

      expect(result.current.hasPermission).toBeInstanceOf(Function);
      expect(result.current.hasMinimumRole).toBeInstanceOf(Function);
    });
  });

  describe('auth state change handling', () => {
    it('should handle SIGNED_OUT event', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.user).toBeDefined();
      });

      // Trigger sign out event
      act(() => {
        (supabase.auth as any)._triggerAuthStateChange('SIGNED_OUT', null);
      });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
        expect(result.current.session).toBeNull();
        expect(result.current.profile).toBeNull();
      });
    });

    it('should fetch profile on auth state change', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);
      const mockProfile = createMockProfile();

      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const mockFilterBuilder = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      };
      const mockQueryBuilder = {
        select: vi.fn().mockReturnValue(mockFilterBuilder),
      };
      (supabase.from as any).mockReturnValue(mockQueryBuilder);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Trigger sign in event
      await act(async () => {
        (supabase.auth as any)._triggerAuthStateChange('SIGNED_IN', mockSession);
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });
    });
  });

  describe('cleanup', () => {
    it('should unsubscribe from auth state changes on unmount', async () => {
      const unsubscribeSpy = vi.fn();
      (supabase.auth.onAuthStateChange as any).mockReturnValue({
        data: {
          subscription: {
            id: 'mock-subscription',
            unsubscribe: unsubscribeSpy,
          },
        },
      });

      const { unmount } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      unmount();

      expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should cleanup auto-sync on unmount when initialized', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { unmount } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await vi.runAllTimersAsync();

      unmount();

      expect(autoSyncManager.cleanup).toHaveBeenCalled();
    });
  });
});
