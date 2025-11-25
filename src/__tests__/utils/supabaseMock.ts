import { vi } from 'vitest';
import type {
  SupabaseClient,
  User,
  Session,
  AuthError
} from '@supabase/supabase-js';

/**
 * Create a mock Supabase user
 */
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    ...overrides,
  } as User;
}

/**
 * Create a mock Supabase session
 */
export function createMockSession(user?: User): Session {
  const mockUser = user || createMockUser();
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Date.now() + 3600000,
    token_type: 'bearer',
    user: mockUser,
  };
}

/**
 * Create a mock auth error
 */
export function createMockAuthError(message: string, status = 400): AuthError {
  return {
    name: 'AuthError',
    message,
    status,
  } as AuthError;
}

/**
 * Create a mock Postgrest filter builder
 */
export function createMockFilterBuilder<T = any>() {
  const builder = {
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    rangeGt: vi.fn().mockReturnThis(),
    rangeGte: vi.fn().mockReturnThis(),
    rangeLt: vi.fn().mockReturnThis(),
    rangeLte: vi.fn().mockReturnThis(),
    rangeAdjacent: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    select: vi.fn().mockReturnThis(),
  };

  return builder;
}

/**
 * Create a mock Postgrest query builder
 */
export function createMockQueryBuilder<T = any>() {
  const filterBuilder = createMockFilterBuilder<T>();

  const builder = {
    select: vi.fn().mockReturnValue(filterBuilder),
    insert: vi.fn().mockReturnValue(filterBuilder),
    update: vi.fn().mockReturnValue(filterBuilder),
    upsert: vi.fn().mockReturnValue(filterBuilder),
    delete: vi.fn().mockReturnValue(filterBuilder),
  };

  return builder;
}

/**
 * Create a comprehensive mock Supabase client
 */
export function createMockSupabaseClient(): SupabaseClient {
  let currentSession: Session | null = null;
  let authStateChangeCallback: ((event: string, session: Session | null) => void) | null = null;

  const mockAuth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: currentSession }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: currentSession?.user || null }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    onAuthStateChange: vi.fn((callback) => {
      authStateChangeCallback = callback;
      return {
        data: {
          subscription: {
            id: 'mock-subscription',
            unsubscribe: vi.fn(),
          },
        },
      };
    }),
    // Helper to trigger auth state change in tests
    _triggerAuthStateChange: (event: string, session: Session | null) => {
      currentSession = session;
      if (authStateChangeCallback) {
        authStateChangeCallback(event, session);
      }
    },
  };

  const mockStorage = {
    from: vi.fn((bucket: string) => ({
      upload: vi.fn().mockResolvedValue({ data: { path: 'mock-path' }, error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
      remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/${bucket}/${path}` } })),
    })),
  };

  const mockFrom = vi.fn((table: string) => createMockQueryBuilder());

  const client = {
    auth: mockAuth,
    storage: mockStorage,
    from: mockFrom,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn().mockReturnThis(),
    })),
  } as unknown as SupabaseClient;

  return client;
}

/**
 * Helper to set up successful auth responses
 */
export function mockSuccessfulAuth(client: SupabaseClient, user?: User, session?: Session) {
  const mockUser = user || createMockUser();
  const mockSession = session || createMockSession(mockUser);

  (client.auth.signInWithPassword as any).mockResolvedValue({
    data: { user: mockUser, session: mockSession },
    error: null,
  });

  (client.auth.getSession as any).mockResolvedValue({
    data: { session: mockSession },
    error: null,
  });

  return { user: mockUser, session: mockSession };
}

/**
 * Helper to set up failed auth responses
 */
export function mockFailedAuth(client: SupabaseClient, errorMessage: string) {
  const error = createMockAuthError(errorMessage);

  (client.auth.signInWithPassword as any).mockResolvedValue({
    data: { user: null, session: null },
    error,
  });

  return { error };
}

/**
 * Helper to set up database query responses
 */
export function mockDatabaseQuery<T = any>(
  client: SupabaseClient,
  table: string,
  data: T[] | T | null,
  error: Error | null = null
) {
  const queryBuilder = createMockQueryBuilder<T>();
  const filterBuilder = createMockFilterBuilder<T>();

  // Mock the response for various query methods
  (filterBuilder.single as any).mockResolvedValue({ data, error });
  (filterBuilder.maybeSingle as any).mockResolvedValue({ data, error });

  // For select queries that return arrays
  (queryBuilder.select as any).mockReturnValue({
    ...filterBuilder,
    then: (resolve: any) => resolve({ data, error }),
  });

  (client.from as any).mockReturnValue(queryBuilder);

  return queryBuilder;
}
