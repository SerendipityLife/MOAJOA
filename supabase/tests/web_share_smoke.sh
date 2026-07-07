#!/usr/bin/env bash
# Phase 23 smoke — (1) 익명 세션 is_anonymous 클레임 (2) join_moa share_mode 분기
# (3) trip_messages RLS 런타임 프로브 (4) kakao authorize 시작 가능.
# 전제: config.toml 반영 재시작 + 0025 적용 (23-04).
# 주의: 익명 signup은 IP당 30/hr rate limit — 반복 실행 시 유의.
set -euo pipefail
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"
ANON_KEY=$(supabase status -o env 2>/dev/null | grep ANON_KEY | cut -d= -f2 | tr -d '"')

# (1) 익명 세션 — data.name 주입 (Pitfall 4: 미주입 시 display_name='user')
RESP=$(curl -s -X POST "$API/auth/v1/signup" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"data":{"name":"게스트닉네임"}}')
JWT=$(printf '%s' "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")
CLAIMS=$(printf '%s' "$JWT" | python3 -c "
import json,base64,sys
p=sys.stdin.read().split('.')[1]
c=json.loads(base64.urlsafe_b64decode(p+'=='))
print(str(c['is_anonymous'])+'|'+c['role']+'|'+c['sub'])")
IS_ANON=$(echo "$CLAIMS" | cut -d'|' -f1)
ROLE=$(echo "$CLAIMS" | cut -d'|' -f2)
ANON_UID=$(echo "$CLAIMS" | cut -d'|' -f3)
[ "$IS_ANON" = "True" ] || { echo "FAIL: is_anonymous claim ($IS_ANON)"; exit 1; }
[ "$ROLE" = "authenticated" ] || { echo "FAIL: role claim ($ROLE, want authenticated)"; exit 1; }

# (2) 호스트 + shared trip 2개 셋업 (superuser psql — ensure_share_slug 트리거가 slug 생성)
EMAIL="sharehost@local.test"
curl -s -X POST "$API/auth/v1/signup" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password-share-1\"}" > /dev/null || true
HOST=$(psql "$DB" -tAc "select id from auth.users where email='$EMAIL' limit 1")
[ -n "$HOST" ] || { echo "FAIL: host user missing"; exit 1; }
T_BOTH=$(psql "$DB" -tAc "insert into trips (owner_id, title) values ('$HOST','smoke-both-$(date +%s)') returning id")
T_DATES=$(psql "$DB" -tAc "insert into trips (owner_id, title) values ('$HOST','smoke-dates-$(date +%s)') returning id")
psql "$DB" -qc "update trips set visibility='shared', share_mode='both' where id='$T_BOTH'"
psql "$DB" -qc "update trips set visibility='shared', share_mode='dates' where id='$T_DATES'"
SLUG_BOTH=$(psql "$DB" -tAc "select share_slug from trips where id='$T_BOTH'")
SLUG_DATES=$(psql "$DB" -tAc "select share_slug from trips where id='$T_DATES'")
[ -n "$SLUG_BOTH" ] && [ -n "$SLUG_DATES" ] || { echo "FAIL: ensure_share_slug minted no slug"; exit 1; }

# (3) join_moa — both→editor, dates→voter (D-A1)
curl -s -X POST "$API/rest/v1/rpc/join_moa" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" -d "{\"p_share_slug\":\"$SLUG_BOTH\"}" > /dev/null
curl -s -X POST "$API/rest/v1/rpc/join_moa" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" -d "{\"p_share_slug\":\"$SLUG_DATES\"}" > /dev/null
R_BOTH=$(psql "$DB" -tAc "select role from memberships where trip_id='$T_BOTH' and user_id='$ANON_UID'")
R_DATES=$(psql "$DB" -tAc "select role from memberships where trip_id='$T_DATES' and user_id='$ANON_UID'")
[ "$R_BOTH" = "editor" ] || { echo "FAIL: share_mode=both → '$R_BOTH' (want editor)"; exit 1; }
[ "$R_DATES" = "voter" ] || { echo "FAIL: share_mode=dates → '$R_DATES' (want voter)"; exit 1; }

# (4) trip_messages RLS 런타임 프로브 — 정책은 authenticated 쿼리 시점에만 평가됨.
#     db reset(superuser)·DEFINER RPC 어느 경로도 이 정책을 밟지 않으므로 익명 JWT GET으로 실증.
#     42P17 recursion 발화 시 200이 아닌 5xx → FAIL (성공 기준 1의 런타임 보강).
MSG_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  "$API/rest/v1/trip_messages?trip_id=eq.$T_BOTH&select=id" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT")
[ "$MSG_CODE" = "200" ] || { echo "FAIL: trip_messages RLS probe HTTP $MSG_CODE (want 200 — 42P17 recursion?)"; exit 1; }

# (5) kakao authorize 시작 가능 — redirect_url에 kauth.kakao.com
LOC=$(curl -s -o /dev/null -w '%{redirect_url}' "$API/auth/v1/authorize?provider=kakao")
echo "$LOC" | grep -q "kauth.kakao.com" || { echo "FAIL: kakao authorize redirect ($LOC)"; exit 1; }

echo "PASS: anon(is_anonymous=true, role=authenticated) + join_moa(both→editor, dates→voter) + trip_messages RLS(200) + kakao authorize"
