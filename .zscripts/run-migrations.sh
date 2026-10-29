#!/usr/bin/env bash
# ============================================
# Sudoku Arena — Run Supabase SQL migrations automatically
# ============================================
# Usage: bun run db:migrate
# This script reads all supabase-*.sql files and runs them via the
# Supabase Management API (requires SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF in .env).
# ============================================

set -euo pipefail

cd "$(dirname "$0")/.."

# Load .env
if [ ! -f .env ]; then
  echo "ERROR: .env not found"
  exit 1
fi

export $(grep -v '^#' .env | grep -E 'SUPABASE_' | xargs)

TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
REF="${SUPABASE_PROJECT_REF:-}"

if [ -z "$TOKEN" ] || [ -z "$REF" ]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF not set in .env"
  exit 1
fi

API="https://api.supabase.com/v1/projects/$REF/database/query"

# Order matters: schema first, then fixes, then features
SQL_FILES=(
  "supabase-schema.sql"
  "supabase-fix-leaderboard-friends.sql"
  "supabase-login-username.sql"
  "supabase-fix-username-permissions.sql"
  "supabase-unify-username.sql"
  "supabase-ranked.sql"
  "supabase-ranked-fixes.sql"
  "supabase-ranked-overhaul.sql"
  "supabase-ranked-xp-matches.sql"
  "supabase-audit-fixes.sql"
  "supabase-fix-c01-email-leak.sql"
  "supabase-fix-c02-forgery.sql"
  "supabase-fix-c03-update-user-rating.sql"
  "supabase-fix-c04-xp-server-side.sql"
)

echo "============================================"
echo "Running Supabase migrations ($REF)"
echo "============================================"

for sql_file in "${SQL_FILES[@]}"; do
  if [ ! -f "$sql_file" ]; then
    echo "SKIP: $sql_file (not found)"
    continue
  fi
  echo -n "Running: $sql_file ... "
  SQL_CONTENT=$(cat "$sql_file")
  RESULT=$(curl -s -X POST "$API" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg sql "$SQL_CONTENT" '{query: $sql}')" 2>&1)

  if echo "$RESULT" | jq -e 'type == "array"' >/dev/null 2>&1; then
    echo "OK"
  else
    echo "ERROR"
    echo "$RESULT" | head -c 500
    echo ""
  fi
done

echo "============================================"
echo "Done. Verifying..."
echo "============================================"

# Verify key RPCs exist
VERIFY=$(curl -s -X POST "$API" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "select proname from pg_proc where proname in ('\''finish_ranked_match'\'','\''try_matchmake_atomic'\'','\''check_username_available'\'','\''get_email_by_username'\'','\''set_username'\'','\''update_display_info'\'','\''heartbeat_ranked_queue'\'') order by proname"}')

echo "Installed RPCs:"
echo "$VERIFY" | jq -r '.[].proname' 2>/dev/null || echo "$VERIFY"
