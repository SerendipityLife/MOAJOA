#!/usr/bin/env bash
# Phase 29 gap closure (0034) smoke — public_trip_messages anon slug→messages
# 스냅샷 읽기(CHAT-10, T-29-07-02). public_trip_poll_smoke.sh 미러(psql 시드 + anon
# curl + python3 assert). 검증: (2) anon 읽기 len==2·asc 순서·user_id PII 미노출,
# (3) 없는 slug→null. 전제: supabase db reset (0016→0034 적용) + colima/docker 가동.
set -euo pipefail
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"
ANON_KEY=$(supabase status -o env 2>/dev/null | grep ANON_KEY | cut -d= -f2 | tr -d '"')

# (0) 호스트 + shared trip 시드 (superuser psql; ensure_share_slug가 slug 채번)
EMAIL="msg-smoke-host@local.test"
curl -s -X POST "$API/auth/v1/signup" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password-msg-1\"}" > /dev/null || true
HOST=$(psql "$DB" -tAc "select id from auth.users where email='$EMAIL' limit 1")
[ -n "$HOST" ] || { echo "FAIL: host user missing"; exit 1; }
# -q 필수: INSERT...RETURNING은 -t만으론 커맨드 태그가 섞여 나옴 (23-04 학습)
TRIP=$(psql "$DB" -qtAc "insert into trips (owner_id, title) values ('$HOST','msg-smoke-$(date +%s)') returning id")
psql "$DB" -qc "update trips set visibility='shared', share_mode='places' where id='$TRIP'"
SLUG=$(psql "$DB" -tAc "select share_slug from trips where id='$TRIP'")
[ -n "$SLUG" ] || { echo "FAIL: ensure_share_slug minted no slug"; exit 1; }

# (1) 호스트 uid로 trip_messages 2행 시드 (created_at 순서를 위해 두 번째를 늦게 삽입)
psql "$DB" -qc "insert into trip_messages (trip_id, user_id, nickname, body) values ('$TRIP','$HOST','호스트','안녕 게스트')"
psql "$DB" -qc "insert into trip_messages (trip_id, user_id, nickname, body) values ('$TRIP','$HOST','호스트','두번째')"

# (2) public_trip_messages — anon role(no JWT)로 스냅샷 읽기 + PII 미노출 단언
MSG_JSON=$(curl -s -X POST "$API/rest/v1/rpc/public_trip_messages" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "{\"p_slug\":\"$SLUG\"}")
echo "$MSG_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert isinstance(d,list), 'not a list: %r' % d
assert len(d)==2, 'want 2 messages, got %d' % len(d)
# created_at asc = 오래된 것 먼저
assert d[0]['nickname']=='호스트', 'nickname'
assert d[0]['body']=='안녕 게스트', 'body[0]=%r' % d[0].get('body')
assert d[1]['body']=='두번째', 'body[1]=%r' % d[1].get('body')
# T-29-07-02: user_id(auth PII) 반환 shape에서 제외
assert 'user_id' not in d[0], 'user_id LEAKED: %r' % d[0]
assert 'created_at' in d[0], 'created_at missing'
assert 'reply_to_place_id' in d[0], 'reply_to_place_id missing'
print('  (2) public_trip_messages(anon): len=%d asc[0]=%s user_id-hidden' % (len(d), d[0]['body']))
" || { echo "FAIL: public_trip_messages anon read ($MSG_JSON)"; exit 1; }

# (3) 존재하지 않는 slug → null (not found 게이트)
NULL_JSON=$(curl -s -X POST "$API/rest/v1/rpc/public_trip_messages" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "{\"p_slug\":\"does-not-exist-xyz\"}")
[ "$NULL_JSON" = "null" ] || { echo "FAIL: missing slug want null, got ($NULL_JSON)"; exit 1; }
echo "  (3) missing slug → null"

echo "PASS: public_trip_messages(anon) 읽기 + user_id PII 미노출"
