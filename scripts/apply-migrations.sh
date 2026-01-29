#!/bin/bash
# Apply database migrations to Supabase

echo "🚀 Applying database migrations..."
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found"
    echo "Please create .env.local with:"
    echo "  NEXT_PUBLIC_SUPABASE_URL=your_url"
    echo "  SUPABASE_SERVICE_ROLE_KEY=your_key"
    exit 1
fi

# Load environment variables
export $(cat .env.local | grep -v '^#' | xargs)

# Check if required env vars are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: Missing Supabase credentials"
    echo "Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

echo "📍 Supabase URL: $NEXT_PUBLIC_SUPABASE_URL"
echo ""

# Run TypeScript migration script
echo "Running migration script..."
npx tsx scripts/run-migrations.ts

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo "✅ All migrations applied successfully!"
else
    echo ""
    echo "⚠️  Migrations failed. See scripts/apply-migrations-manual.md for manual instructions."
fi

exit $exit_code
