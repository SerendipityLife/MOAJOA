#!/usr/bin/env bash
# Phase 25 (0029) smoke — (1) public_trip_poll anon slug→poll read (SHARE-02, T-25-01)
# (2) public_trip_view share_mode 노출 (D-09) (3) hide_place_as_member D-12 own-only
# 소프트삭제 강제 (T-25-08, Pitfall 5). web_share_smoke.sh psql/curl 프로브 스타일 미러.
# 전제: supabase db reset (0016→0029 적용) + colima/docker 가동.
# 주의: 익명 signup은 IP당 30/hr rate limit — 반복 실행 시 유의.
set -euo pipefail
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"
ANON_KEY=$(supabase status -o env 2>/dev/null | grep ANON_KEY | cut -d= -f2 | tr -d '"')

# (0) 게스트 익명 세션 — JWT + uid (hide own-only 프로브의 비호스트 신원)
GRESP=$(curl -s -X POST "$API/auth/v1/signup" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"data":{"name":"게스트"}}')
GJWT=$(printf '%s' "$GRESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")
GUID=$(printf '%s' "$GJWT" | python3 -c "
import json,base64,sys
p=sys.stdin.read().split('.')[1]
print(json.loads(base64.urlsafe_b64decode(p+'=='))['sub'])")
[ -n "$GUID" ] || { echo "FAIL: guest anon session"; exit 1; }

# (1) 호스트 + dates trip + poll + option 시드 (superuser psql; ensure_share_slug가 slug 채번)
EMAIL="poll-smoke-host@local.test"
curl -s -X POST "$API/auth/v1/signup" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password-poll-1\"}" > /dev/null || true
HOST=$(psql "$DB" -tAc "select id from auth.users where email='$EMAIL' limit 1")
[ -n "$HOST" ] || { echo "FAIL: host user missing"; exit 1; }
# -q 필수: INSERT...RETURNING은 -t만으론 커맨드 태그가 섞여 나옴 (23-04 학습)
TRIP=$(psql "$DB" -qtAc "insert into trips (owner_id, title) values ('$HOST','poll-smoke-$(date +%s)') returning id")
psql "$DB" -qc "update trips set visibility='shared', share_mode='dates' where id='$TRIP'"
SLUG=$(psql "$DB" -tAc "select share_slug from trips where id='$TRIP'")
[ -n "$SLUG" ] || { echo "FAIL: ensure_share_slug minted no slug"; exit 1; }
POLL=$(psql "$DB" -qtAc "insert into date_polls (trip_id, mode) values ('$TRIP','range') returning id")
psql "$DB" -qc "insert into date_poll_options (poll_id, start_date, end_date) values ('$POLL','2026-08-01','2026-08-03')"

# (2) public_trip_poll — anon role(no JWT)로 poll_code·mode·options 반환(not null)
POLL_JSON=$(curl -s -X POST "$API/rest/v1/rpc/public_trip_poll" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "{\"p_slug\":\"$SLUG\"}")
echo "$POLL_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d is not None, 'poll null'
assert d.get('poll_code'), 'no poll_code'
assert d.get('mode')=='range', 'mode'
assert isinstance(d.get('options'),list) and len(d['options'])==1, 'options'
print('  (2) public_trip_poll(anon): poll_code=%s mode=%s options=%d' % (d['poll_code'], d['mode'], len(d['options'])))
" || { echo "FAIL: public_trip_poll anon read ($POLL_JSON)"; exit 1; }

# (3) public_trip_view — share_mode='dates' 노출 (anon role)
VIEW_JSON=$(curl -s -X POST "$API/rest/v1/rpc/public_trip_view" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "{\"p_slug\":\"$SLUG\"}")
SM=$(echo "$VIEW_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['trip']['share_mode'])")
[ "$SM" = "dates" ] || { echo "FAIL: public_trip_view share_mode ($SM want dates)"; exit 1; }
echo "  (3) public_trip_view.share_mode=$SM"

# (4) hide_place_as_member own-only (D-12, T-25-08)
#   place_other: added_by=HOST (남의 장소) · place_own: added_by=GUEST (내 장소). superuser 시드.
POTHER=$(psql "$DB" -qtAc "insert into places (trip_id, google_place_id, name_local, lat, lng, added_by) values ('$TRIP','gp-other','남의장소',35.0,139.0,'$HOST') returning id")
POWN=$(psql "$DB" -qtAc "insert into places (trip_id, google_place_id, name_local, lat, lng, added_by) values ('$TRIP','gp-own','내장소',35.1,139.1,'$GUID') returning id")

# 게스트가 남의 장소 hide 시도 → 거부 (비호스트 & added_by != guest → raise)
OCODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/rest/v1/rpc/hide_place_as_member" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $GJWT" -H "Content-Type: application/json" \
  -d "{\"p_place_id\":\"$POTHER\"}")
{ [ "$OCODE" != "204" ] && [ "$OCODE" != "200" ]; } || { echo "FAIL: guest hid another's place (HTTP $OCODE, want 4xx)"; exit 1; }
STILL_VISIBLE=$(psql "$DB" -tAc "select hidden_at is null from places where id='$POTHER'")
[ "$STILL_VISIBLE" = "t" ] || { echo "FAIL: other's place got hidden despite denial"; exit 1; }

# 게스트가 자기 장소 hide → 성공 (added_by == guest)
WCODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/rest/v1/rpc/hide_place_as_member" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $GJWT" -H "Content-Type: application/json" \
  -d "{\"p_place_id\":\"$POWN\"}")
{ [ "$WCODE" = "204" ] || [ "$WCODE" = "200" ]; } || { echo "FAIL: guest own-hide HTTP $WCODE (want 204)"; exit 1; }
NOW_HIDDEN=$(psql "$DB" -tAc "select hidden_at is not null from places where id='$POWN'")
[ "$NOW_HIDDEN" = "t" ] || { echo "FAIL: own place not hidden after RPC"; exit 1; }
echo "  (4) hide_place_as_member: deny other(HTTP $OCODE) · allow own(HTTP $WCODE)"

echo "PASS: public_trip_poll(anon) + public_trip_view.share_mode=dates + hide_place_as_member own-only(D-12 airtight)"
