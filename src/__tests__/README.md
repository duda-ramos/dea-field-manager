# Test Infrastructure

This directory contains test utilities, fixtures, and helpers for the DEA Field Manager test suite.

## Phase 1 Implementation (Complete)

### Test Utilities (`utils/`)

#### `testUtils.tsx`
- Custom render function with React Query provider
- Helper functions for async operations
- Re-exports from @testing-library/react

#### `supabaseMock.ts`
- Comprehensive Supabase client mocking
- Mock user, session, and auth error creators
- Database query mocking helpers
- Storage operation mocking

### Test Fixtures (`fixtures/`)

#### `testData.ts`
- Mock data factories for:
  - Projects
  - Installations
  - File attachments
  - User profiles
- Helper functions to create multiple records

## Test Files Created

### Services Layer Tests

1. **`src/services/sync/retryWithBackoff.test.ts`** (✅ 64 tests)
   - Basic retry logic
   - Backoff timing with exponential delays
   - Jitter implementation
   - Max delay enforcement
   - Retry callbacks
   - Network-specific retry logic (non-retryable errors)
   - Storage-specific retry logic

2. **`src/services/auth/rateLimiter.test.ts`** (✅ 41 tests)
   - Login rate limiting (5 attempts per 15 min)
   - Signup rate limiting (3 attempts per hour)
   - Password reset rate limiting (3 attempts per hour)
   - Block period enforcement
   - Window expiration
   - Cross-operation isolation
   - Status tracking

3. **`src/services/sync/unifiedSync.test.ts`** (✅ 15 tests)
   - Full sync orchestration
   - Concurrent sync prevention
   - Retry integration
   - Timestamp tracking
   - Error handling
   - Result formatting

4. **`src/services/sync/autoSync.test.ts`** (✅ 23 tests)
   - Initialization
   - Boot pull on authentication
   - Visibility change handling
   - Page hide/unload handling
   - Debounced sync (3 second delay)
   - Periodic sync (configurable interval)
   - Online/offline awareness
   - Event listener cleanup

### Hooks Tests

5. **`src/hooks/useAuth.test.tsx`** (✅ 24 tests)
   - Session initialization
   - Sign in/up/out flows
   - Password reset
   - Profile updates
   - Rate limiting integration
   - Role-based access (admin, manager, field_tech, viewer)
   - Permission checking
   - Auto-sync initialization
   - Auth state change handling
   - Cleanup on unmount

## Running Tests

### Install Dependencies

Note: If you encounter issues with the `canvas` package (PDF generation dependency), you can skip it:

```bash
npm install --ignore-scripts
```

Or install system dependencies (Ubuntu/Debian):

```bash
sudo apt-get install libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test -- --coverage
```

### Run Tests in Watch Mode

```bash
npx vitest
```

### Run Specific Test File

```bash
npx vitest src/services/auth/rateLimiter.test.ts
```

## Coverage Thresholds

Current thresholds are set conservatively at 10% to establish a baseline:

```typescript
thresholds: {
  statements: 10,
  branches: 10,
  functions: 10,
  lines: 10,
}
```

These should be gradually increased as more tests are added.

## Test Organization

```
src/
├── __tests__/
│   ├── utils/
│   │   ├── testUtils.tsx       # React testing utilities
│   │   └── supabaseMock.ts     # Supabase mocking
│   └── fixtures/
│       └── testData.ts         # Test data factories
├── services/
│   ├── sync/
│   │   ├── retryWithBackoff.test.ts
│   │   ├── unifiedSync.test.ts
│   │   └── autoSync.test.ts
│   └── auth/
│       └── rateLimiter.test.ts
└── hooks/
    └── useAuth.test.tsx
```

## Key Testing Patterns

### 1. Mocking Supabase

```typescript
import { createMockSupabaseClient, mockSuccessfulAuth } from '@/__tests__/utils/supabaseMock';

const mockClient = createMockSupabaseClient();
mockSuccessfulAuth(mockClient);
```

### 2. Using Test Fixtures

```typescript
import { createMockProject, createMockInstallations } from '@/__tests__/fixtures/testData';

const project = createMockProject({ name: 'Custom Project' });
const installations = createMockInstallations(project.id, 10);
```

### 3. Testing Hooks with Context

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { AuthProvider } from './useAuth';

const { result } = renderHook(() => useAuth(), {
  wrapper: AuthProvider,
});

await waitFor(() => {
  expect(result.current.loading).toBe(false);
});
```

### 4. Timer Testing

```typescript
import { vi } from 'vitest';

vi.useFakeTimers();

// Trigger debounced function
autoSyncManager.triggerDebouncedSync();

// Fast-forward time
vi.advanceTimersByTime(3000);
await vi.runAllTimersAsync();

vi.useRealTimers();
```

## Next Steps (Phase 2+)

- [ ] Storage management tests (`StorageManagerDexie.ts`)
- [ ] Project lifecycle tests
- [ ] Photo management tests
- [ ] Component tests (forms, dashboards, reports)
- [ ] Integration tests (Supabase + IndexedDB)
- [ ] E2E test expansion (user workflows)
- [ ] Increase coverage thresholds to 70%

## Contributing

When adding new tests:

1. Place unit tests next to the source file (e.g., `foo.test.ts` next to `foo.ts`)
2. Use test utilities from `__tests__/utils/`
3. Use fixtures from `__tests__/fixtures/`
4. Follow existing patterns for mocking and assertions
5. Ensure tests are isolated (no shared state)
6. Use fake timers for time-dependent tests
7. Clean up mocks in `afterEach` hooks
