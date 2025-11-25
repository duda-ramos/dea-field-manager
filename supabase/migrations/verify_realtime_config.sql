-- Verification Script for Realtime Configuration
-- Run this in Supabase SQL Editor to verify that realtime is properly configured

-- 1. Check if tables are in the realtime publication
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN tablename IN ('projects', 'installations', 'contacts', 'supplier_proposals', 'item_versions', 'files') 
    THEN '✅ Configured'
    ELSE '❌ Not in core tables'
  END as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Expected result: Should show at least these 6 tables:
-- - projects
-- - installations  
-- - contacts
-- - supplier_proposals
-- - item_versions
-- - files

-- 2. Check if realtime publication exists
SELECT 
  pubname,
  puballtables,
  pubinsert,
  pubupdate,
  pubdelete,
  pubtruncate
FROM pg_publication
WHERE pubname = 'supabase_realtime';

-- 3. Count configured tables
SELECT 
  COUNT(*) as total_tables_in_realtime,
  CASE 
    WHEN COUNT(*) >= 6 THEN '✅ All core tables configured'
    ELSE '⚠️ Missing core tables - run migration'
  END as configuration_status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('projects', 'installations', 'contacts', 'supplier_proposals', 'item_versions', 'files');

-- 4. Check RLS policies for realtime tables (should have SELECT policies)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'installations', 'contacts', 'supplier_proposals', 'item_versions', 'files')
  AND cmd = 'SELECT'
ORDER BY tablename, policyname;

-- 5. Quick diagnostic
DO $$
DECLARE
  configured_count INT;
  expected_count INT := 6;
BEGIN
  SELECT COUNT(*) INTO configured_count
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND tablename IN ('projects', 'installations', 'contacts', 'supplier_proposals', 'item_versions', 'files');

  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'Realtime Configuration Diagnostic';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'Core tables configured: % of %', configured_count, expected_count;
  
  IF configured_count = expected_count THEN
    RAISE NOTICE '✅ Status: All core tables are configured for realtime';
    RAISE NOTICE '✅ Realtime sync should be working properly';
  ELSIF configured_count > 0 THEN
    RAISE NOTICE '⚠️  Status: Partial configuration (% missing)', expected_count - configured_count;
    RAISE NOTICE '⚠️  Action: Run migration 20251125140000_enable_realtime_for_all_tables.sql';
  ELSE
    RAISE NOTICE '❌ Status: No core tables configured';
    RAISE NOTICE '❌ Action: URGENT - Run migration 20251125140000_enable_realtime_for_all_tables.sql';
  END IF;
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
