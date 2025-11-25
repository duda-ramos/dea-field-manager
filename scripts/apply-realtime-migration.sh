#!/bin/bash

# Script to apply realtime migration to Supabase
# This script helps apply the realtime configuration migration

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Realtime Migration Application Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found"
    echo ""
    echo "Please install it first:"
    echo "  npm install -g supabase"
    echo ""
    echo "Or apply the migration manually via Supabase Dashboard:"
    echo "  1. Go to https://supabase.com/dashboard"
    echo "  2. Select your project"
    echo "  3. Go to SQL Editor"
    echo "  4. Copy and paste the content from:"
    echo "     supabase/migrations/20251125140000_enable_realtime_for_all_tables.sql"
    echo "  5. Run the SQL"
    echo ""
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Check if we're in the project root
if [ ! -d "supabase/migrations" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   (the directory containing the 'supabase' folder)"
    exit 1
fi

echo "📁 Project structure verified"
echo ""

# Check if the migration file exists
MIGRATION_FILE="supabase/migrations/20251125140000_enable_realtime_for_all_tables.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "✅ Migration file found: $MIGRATION_FILE"
echo ""

# Show migration content
echo "📄 Migration content:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$MIGRATION_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ask for confirmation
read -p "Do you want to apply this migration? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 0
fi

echo ""
echo "🚀 Applying migration..."
echo ""

# Apply the migration
supabase db push

echo ""
echo "✅ Migration applied successfully!"
echo ""

# Run verification
echo "🔍 Running verification..."
echo ""

VERIFY_FILE="supabase/migrations/verify_realtime_config.sql"
if [ -f "$VERIFY_FILE" ]; then
    echo "To verify the migration, run this SQL in Supabase Dashboard:"
    echo ""
    cat "$VERIFY_FILE"
else
    echo "Run this query in Supabase SQL Editor to verify:"
    echo ""
    echo "SELECT tablename FROM pg_publication_tables"
    echo "WHERE pubname = 'supabase_realtime'"
    echo "ORDER BY tablename;"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Done!"
echo ""
echo "Next steps:"
echo "  1. Verify tables in Supabase Dashboard (see query above)"
echo "  2. Restart your development server: npm run dev"
echo "  3. Check realtime status in the app (Sync Status Panel)"
echo "  4. Test with multiple browser tabs/devices"
echo ""
echo "For more information, see: REALTIME_SYNC_FIX.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
