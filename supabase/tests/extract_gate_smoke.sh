#!/usr/bin/env bash
# Phase 27 smoke — SEC-01 extract-youtube 멤버십 게이트 (401/403/409, 유료 API 발화 0)
# 전제: 로컬 supabase 스택 실행 중(colima+docker) + 별도 터미널에서 supabase functions serve extract-youtube
# 주의: 익명 signup은 IP당 30/hr rate limit — 반복 실행 시 유의.
set -euo pipefail
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"
ANON_KEY=$(supabase status -o env 2>/dev/null | grep ANON_KEY | cut -d= -f2 | tr -d '"')

# ---- 호스트(owner) signup + id 확보 -----------------------------------------
EMAIL="gatehost@local.test"
curl -s -X POST "$API/auth/v1/signup" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password-gate-1\"}" > /dev/null || true
HOST=$(psql "$DB" -tAc "select id from auth.users where email='$EMAIL' limit 1")
[ -n "$HOST" ] || { echo "FAIL: host user missing"; exit 1; }
# signup은 기존 유저로 실패할 수 있으므로 호스트 JWT는 password grant로 확보
HOST_JWT=$(curl -s -X POST "$API/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password-gate-1\"}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")

# ---- trip + ready 링크 시드 ---------------------------------------------------
# source_kind='youtube' 필수 — 게이트가 KNOWN_SOURCES 체크 뒤라서 manual이면 400으로 먼저 걸림.
# extraction_status='ready' 필수 — claim 불가라 유료 파이프라인 진입 0 (무비용 트릭).
# -q 필수: INSERT...RETURNING은 -t만으론 커맨드 태그("INSERT 0 1")가 섞여 나옴
TRIP=$(psql "$DB" -qtAc "insert into trips (owner_id, title) values ('$HOST','gate-smoke-$(date +%s)') returning id")
LINK=$(psql "$DB" -qtAc "insert into links (trip_id, added_by, source_kind, url, original_url, extraction_status) values ('$TRIP','$HOST','youtube','https://www.youtube.com/watch?v=gatesmoke','https://www.youtube.com/watch?v=gatesmoke','ready') returning id")
[ -n "$TRIP" ] && [ -n "$LINK" ] || { echo "FAIL: trip/link seed"; exit 1; }

# ---- 비멤버 익명 세션 (signup만 — join 없이 비멤버 유지가 핵심) ---------------
GUEST_JWT=$(curl -s -X POST "$API/auth/v1/signup" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"data":{"name":"게이트게스트"}}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")
[ -n "$GUEST_JWT" ] || { echo "FAIL: anon guest signup"; exit 1; }

# ---- 단언 3종 -----------------------------------------------------------------
# (1) anon-key 원시 토큰 → 401 (T-18-08 getUser 게이트 무회귀)
C1=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/functions/v1/extract-youtube" \
  -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"link_id\":\"$LINK\"}")
[ "$C1" = "401" ] || { echo "FAIL: (1) anon-key raw → $C1 (want 401)"; exit 1; }

# (2) 비멤버 익명 세션 → 403 (SEC-01 신규 게이트 — 게이트 부재 시 claim 도달 409)
C2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/functions/v1/extract-youtube" \
  -H "Authorization: Bearer $GUEST_JWT" -H "Content-Type: application/json" \
  -d "{\"link_id\":\"$LINK\"}")
[ "$C2" = "403" ] || { echo "FAIL: (2) non-member anon session → $C2 (want 403 — SEC-01 gate)"; exit 1; }

# (3) 멤버(owner) → 409 (게이트 통과 실증 — ready라 claim 실패, 유료 API 발화 0)
C3=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/functions/v1/extract-youtube" \
  -H "Authorization: Bearer $HOST_JWT" -H "Content-Type: application/json" \
  -d "{\"link_id\":\"$LINK\"}")
[ "$C3" = "409" ] || { echo "FAIL: (3) owner on ready link → $C3 (want 409 already)"; exit 1; }

echo "PASS: extract gate smoke (401/403/409)"
