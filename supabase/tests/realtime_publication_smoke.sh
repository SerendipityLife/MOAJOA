#!/usr/bin/env bash
# realtime_publication_smoke.sh — Phase 24 (D-14 postgres_changes)
#   (1) places·links가 supabase_realtime publication에 등록됐는지 psql 카운트 단언
#   (2) postgres_changes 이벤트 실수신 + 비멤버 0건(WALRUS RLS) — node 스모크 위임
# 전제: `supabase db reset`로 0026 적용 + 로컬 스택 실행 중 (24-01 Task 3).
set -euo pipefail
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[1/2] publication 멤버십 카운트..."
PUB_COUNT=$(psql "$DB_URL" -tAc \
  "select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename in ('places','links')")
[ "$PUB_COUNT" = "2" ] || { echo "FAIL: publication 등록 카운트 $PUB_COUNT (want 2 — 0026 미적용?)"; exit 1; }
echo "  OK: places·links 등록됨 (2)"

echo "[2/2] postgres_changes 이벤트 실수신 스모크..."
ANON_KEY=$(supabase status -o env 2>/dev/null | grep '^ANON_KEY' | cut -d= -f2 | tr -d '"')
SERVICE_ROLE_KEY=$(supabase status -o env 2>/dev/null | grep '^SERVICE_ROLE_KEY' | cut -d= -f2 | tr -d '"')
API_URL=$(supabase status -o env 2>/dev/null | grep '^API_URL' | cut -d= -f2 | tr -d '"')
[ -n "$ANON_KEY" ] && [ -n "$SERVICE_ROLE_KEY" ] || { echo "FAIL: supabase status 키 추출 실패 (스택 실행 중?)"; exit 1; }

if SUPABASE_URL="${API_URL:-http://127.0.0.1:54321}" \
   SUPABASE_ANON_KEY="$ANON_KEY" \
   SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
   node "$SCRIPT_DIR/realtime_events_smoke.mjs"; then
  RC=0
else
  RC=$?
fi
[ "$RC" -eq 0 ] || { echo "FAIL: realtime_events_smoke.mjs exit $RC"; exit "$RC"; }

echo "PASS: publication(2) + postgres_changes 실수신 + WALRUS RLS 필터"
