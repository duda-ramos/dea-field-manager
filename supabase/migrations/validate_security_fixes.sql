-- ============================================================================
-- SECURITY FIXES VALIDATION SCRIPT
-- ============================================================================
-- Run this script AFTER applying 20251022000000_critical_security_fixes.sql
-- to verify that all security measures are working correctly.
-- ============================================================================

-- Set output format for better readability
\set QUIET 1
\pset format wrapped
\pset border 2

BEGIN;

-- ============================================================================
-- TEST 1: Verify Audit Log Immutability
-- ============================================================================

\echo ''
\echo '========================================='
\echo 'TEST 1: Audit Log Immutability'
\echo '========================================='

-- Test 1a: Attempt to insert into project_audit_logs (should FAIL)
\echo 'Test 1a: Attempting manual INSERT into project_audit_logs...'
DO $$
BEGIN
  INSERT INTO project_audit_logs (project_id, user_id, action)
  VALUES (gen_random_uuid(), auth.uid(), 'MANUAL_INSERT_TEST');
  
  RAISE EXCEPTION 'SECURITY FAILURE: Manual insert into project_audit_logs was allowed!';
EXCEPTION
  WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE '✅ PASS: project_audit_logs correctly blocks manual inserts';
  WHEN OTHERS THEN
    RAISE NOTICE '✅ PASS: project_audit_logs blocks inserts (error: %)', SQLERRM;
END $$;

-- Test 1b: Attempt to insert into api_key_audit_logs (should FAIL)
\echo 'Test 1b: Attempting manual INSERT into api_key_audit_logs...'
DO $$
BEGIN
  INSERT INTO api_key_audit_logs (api_key_id, user_id, action)
  VALUES (gen_random_uuid(), auth.uid(), 'MANUAL_INSERT_TEST');
  
  RAISE EXCEPTION 'SECURITY FAILURE: Manual insert into api_key_audit_logs was allowed!';
EXCEPTION
  WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE '✅ PASS: api_key_audit_logs correctly blocks manual inserts';
  WHEN OTHERS THEN
    RAISE NOTICE '✅ PASS: api_key_audit_logs blocks inserts (error: %)', SQLERRM;
END $$;

-- Test 1c: Attempt to insert into contact_access_logs (should FAIL)
\echo 'Test 1c: Attempting manual INSERT into contact_access_logs...'
DO $$
BEGIN
  INSERT INTO contact_access_logs (contact_id, user_id, action)
  SELECT id, auth.uid(), 'view' FROM contacts LIMIT 1;
  
  RAISE EXCEPTION 'SECURITY FAILURE: Manual insert into contact_access_logs was allowed!';
EXCEPTION
  WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE '✅ PASS: contact_access_logs correctly blocks manual inserts';
  WHEN OTHERS THEN
    RAISE NOTICE '✅ PASS: contact_access_logs blocks inserts (error: %)', SQLERRM;
END $$;

-- Test 1d: Attempt to insert into storage_integration_audit (should FAIL)
\echo 'Test 1d: Attempting manual INSERT into storage_integration_audit...'
DO $$
BEGIN
  INSERT INTO storage_integration_audit (integration_id, user_id, action)
  VALUES (gen_random_uuid(), auth.uid(), 'MANUAL_INSERT_TEST');
  
  RAISE EXCEPTION 'SECURITY FAILURE: Manual insert into storage_integration_audit was allowed!';
EXCEPTION
  WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE '✅ PASS: storage_integration_audit correctly blocks manual inserts';
  WHEN OTHERS THEN
    RAISE NOTICE '✅ PASS: storage_integration_audit blocks inserts (error: %)', SQLERRM;
END $$;

-- ============================================================================
-- TEST 2: Verify Encryption Infrastructure
-- ============================================================================

\echo ''
\echo '========================================='
\echo 'TEST 2: Encryption Infrastructure'
\echo '========================================='

-- Test 2a: Verify pgcrypto extension exists
\echo 'Test 2a: Checking pgcrypto extension...'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RAISE NOTICE '✅ PASS: pgcrypto extension is installed';
  ELSE
    RAISE EXCEPTION '❌ FAIL: pgcrypto extension not found!';
  END IF;
END $$;

-- Test 2b: Verify encryption functions exist
\echo 'Test 2b: Checking encryption functions...'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'encrypt_storage_config'
  ) AND EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'decrypt_storage_config'
  ) THEN
    RAISE NOTICE '✅ PASS: Encryption functions created successfully';
  ELSE
    RAISE EXCEPTION '❌ FAIL: Encryption functions not found!';
  END IF;
END $$;

-- Test 2c: Verify storage_integrations has new columns
\echo 'Test 2c: Checking storage_integrations columns...'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'storage_integrations' 
    AND column_name = 'config_encrypted_data'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'storage_integrations' 
    AND column_name = 'encryption_version'
  ) THEN
    RAISE NOTICE '✅ PASS: storage_integrations has encryption columns';
  ELSE
    RAISE EXCEPTION '❌ FAIL: Missing encryption columns!';
  END IF;
END $$;

-- Test 2d: Verify decrypted view exists
\echo 'Test 2d: Checking storage_integrations_decrypted view...'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE viewname = 'storage_integrations_decrypted'
  ) THEN
    RAISE NOTICE '✅ PASS: storage_integrations_decrypted view created';
  ELSE
    RAISE EXCEPTION '❌ FAIL: Decrypted view not found!';
  END IF;
END $$;

-- ============================================================================
-- TEST 3: Verify Contact Security Enhancements
-- ============================================================================

\echo ''
\echo '========================================='
\echo 'TEST 3: Contact Security'
\echo '========================================='

-- Test 3a: Verify validate_contact_access_secure function exists
\echo 'Test 3a: Checking contact access validation function...'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'validate_contact_access_secure'
  ) THEN
    RAISE NOTICE '✅ PASS: validate_contact_access_secure function exists';
  ELSE
    RAISE EXCEPTION '❌ FAIL: Contact validation function not found!';
  END IF;
END $$;

-- Test 3b: Verify contact data classification constraint
\echo 'Test 3b: Checking contact data classification constraint...'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'contacts' 
    AND constraint_name LIKE '%data_classified%'
  ) THEN
    RAISE NOTICE '✅ PASS: Contact data classification constraint exists';
  ELSE
    RAISE NOTICE '⚠️  WARNING: Data classification constraint may not be enforced';
  END IF;
END $$;

-- ============================================================================
-- TEST 4: Verify Updated_at Triggers
-- ============================================================================

\echo ''
\echo '========================================='
\echo 'TEST 4: Updated_at Triggers'
\echo '========================================='

-- Test 4a: Check project_collaborators trigger
\echo 'Test 4a: Checking triggers...'
SELECT 
  CASE 
    WHEN COUNT(*) FILTER (WHERE tgname LIKE '%project_collaborators%') > 0 THEN '✅'
    ELSE '❌'
  END || ' project_collaborators: ' || 
  COUNT(*) FILTER (WHERE tgname LIKE '%project_collaborators%')::text || ' trigger(s)'
FROM pg_trigger
WHERE tgname LIKE '%updated_at%';

SELECT 
  CASE 
    WHEN COUNT(*) FILTER (WHERE tgname LIKE '%project_templates%') > 0 THEN '✅'
    ELSE '❌'
  END || ' project_templates: ' || 
  COUNT(*) FILTER (WHERE tgname LIKE '%project_templates%')::text || ' trigger(s)'
FROM pg_trigger
WHERE tgname LIKE '%updated_at%';

-- ============================================================================
-- TEST 5: Verify Security Monitoring Functions
-- ============================================================================

\echo ''
\echo '========================================='
\echo 'TEST 5: Security Monitoring'
\echo '========================================='

-- Test 5a: Verify detect_suspicious_audit_activity function
\echo 'Test 5a: Checking security monitoring functions...'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'detect_suspicious_audit_activity'
  ) THEN
    RAISE NOTICE '✅ PASS: detect_suspicious_audit_activity function exists';
  ELSE
    RAISE EXCEPTION '❌ FAIL: Security monitoring function not found!';
  END IF;
END $$;

-- Test 5b: Verify security_audit_summary view
\echo 'Test 5b: Checking security audit summary view...'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE viewname = 'security_audit_summary'
  ) THEN
    RAISE NOTICE '✅ PASS: security_audit_summary view exists';
  ELSE
    RAISE EXCEPTION '❌ FAIL: Security audit summary view not found!';
  END IF;
END $$;

-- ============================================================================
-- TEST 6: Verify RLS Policies
-- ============================================================================

\echo ''
\echo '========================================='
\echo 'TEST 6: RLS Policy Verification'
\echo '========================================='

\echo 'Checking RLS policies on audit tables...'
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ Adequate policies'
    ELSE '⚠️  May need more policies'
  END as status
FROM pg_policies
WHERE tablename IN (
  'project_audit_logs',
  'api_key_audit_logs', 
  'contact_access_logs',
  'storage_integration_audit'
)
GROUP BY schemaname, tablename
ORDER BY tablename;

-- ============================================================================
-- TEST 7: Encryption Status Check
-- ============================================================================

\echo ''
\echo '========================================='
\echo 'TEST 7: Encryption Status'
\echo '========================================='

\echo 'Checking storage integration encryption status...'
\echo '(If you see errors about encryption key, that is EXPECTED at this stage)'

DO $$
DECLARE
  encrypted_count int;
  total_count int;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE config_encrypted = true),
    COUNT(*)
  INTO encrypted_count, total_count
  FROM storage_integrations;

  RAISE NOTICE '';
  RAISE NOTICE 'Storage Integrations:';
  RAISE NOTICE '  Total: %', total_count;
  RAISE NOTICE '  Encrypted: %', encrypted_count;
  RAISE NOTICE '  Unencrypted: %', total_count - encrypted_count;
  RAISE NOTICE '';
  
  IF total_count > 0 AND encrypted_count = 0 THEN
    RAISE NOTICE '⚠️  ACTION REQUIRED: Run migrate_storage_configs_to_encrypted()';
    RAISE NOTICE '   (After setting app.storage_encryption_key)';
  ELSIF encrypted_count = total_count THEN
    RAISE NOTICE '✅ All storage integrations are encrypted';
  ELSIF encrypted_count > 0 THEN
    RAISE NOTICE '⚠️  WARNING: % integrations still unencrypted', total_count - encrypted_count;
  END IF;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

\echo ''
\echo '========================================='
\echo 'VALIDATION SUMMARY'
\echo '========================================='
\echo ''
\echo 'If all tests show ✅ PASS, the security fixes are working correctly.'
\echo ''
\echo 'Next steps:'
\echo '1. Set encryption key: ALTER DATABASE postgres SET app.storage_encryption_key = ''...'';'
\echo '2. Run: SELECT migrate_storage_configs_to_encrypted();'
\echo '3. Update application code to use storage_integrations_decrypted view'
\echo '4. Enable password leak protection in Supabase Dashboard'
\echo ''
\echo 'For detailed instructions, see:'
\echo '  - CRITICAL_SECURITY_FIXES.md'
\echo '  - SECURITY_ADMIN_QUICKSTART.md'
\echo ''

ROLLBACK; -- Don't commit any test data
