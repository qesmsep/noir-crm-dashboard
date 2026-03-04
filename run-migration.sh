#!/bin/bash

# Noir CRM - Database Migration Script
# Run this to apply the custom forms migration

echo "🚀 Noir CRM - Custom Forms Migration"
echo "====================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found"
    echo ""
    echo "Please install it:"
    echo "  npm install -g supabase"
    echo "  or"
    echo "  brew install supabase/tap/supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Check if we're linked to a project
if [ ! -f ".env.local" ]; then
    echo "⚠️  No .env.local file found"
    echo "Please ensure your Supabase credentials are configured"
    exit 1
fi

echo "📋 Migration file: supabase/migrations/20260303_custom_forms_simplified.sql"
echo ""
echo "This migration will:"
echo "  • Create questionnaires table"
echo "  • Create questionnaire_questions table"
echo "  • Create questionnaire_responses table"
echo "  • Create agreements table"
echo "  • Create agreement_signatures table"
echo "  • Extend waitlist table with new columns"
echo "  • Add indexes and RLS policies"
echo "  • Insert seed data (default forms)"
echo ""

read -p "Ready to run migration? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 1
fi

echo ""
echo "🔄 Running migration..."
echo ""

# Run the migration via psql directly (requires SUPABASE_DB_URL in .env.local)
if [ -n "$SUPABASE_DB_URL" ]; then
    psql "$SUPABASE_DB_URL" -f supabase/migrations/20260303_custom_forms_simplified.sql
else
    echo "⚠️  SUPABASE_DB_URL not set"
    echo ""
    echo "Alternative methods:"
    echo "1. Copy the SQL file contents and run in Supabase SQL Editor"
    echo "2. Set SUPABASE_DB_URL in .env.local and re-run this script"
    echo ""
    echo "SQL file location:"
    echo "  supabase/migrations/20260303_custom_forms_simplified.sql"
    exit 1
fi

echo ""
echo "✅ Migration completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Verify tables in Supabase dashboard"
echo "  2. Test questionnaire builder in /admin/membership"
echo "  3. Create your first custom form!"
echo ""
