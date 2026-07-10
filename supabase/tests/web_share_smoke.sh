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
# -q 필수: INSERT...RETURNING은 -t만으론 커맨드 태그("INSERT 0 1")가 섞여 나옴
T_BOTH=$(psql "$DB" -qtAc "insert into trips (owner_id, title) values ('$HOST','smoke-both-$(date +%s)') returning id")
T_DATES=$(psql "$DB" -qtAc "insert into trips (owner_id, title) values ('$HOST','smoke-dates-$(date +%s)') returning id")
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

# =============================================================================
# (6) 게스트 익명-세션 RLS 통과 프로브 (Plan 25-05, SHARE-03 / T-25-17)
#     step 1의 익명 JWT/ANON_UID 재사용(signInAnonymously 등가 — 비 device_token
#     세션). join 전에는 places/votes/trip_messages direct-read가 RLS로 0건이고,
#     join_moa(both→editor) 후에만 add_manual_place·votes·trip_messages·
#     cast_date_vote_authed가 통과함을 실증한다.
# =============================================================================
count_json() { printf '%s' "$1" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else -1)"; }

# 호스트가 게스트-미가입 shared trip(both) 셋업 + 장소·표 시드
#   (join 전 direct-read 0건이 '빈 테이블'이 아니라 RLS 게이트임을 실증하기 위함)
T_GUEST=$(psql "$DB" -qtAc "insert into trips (owner_id, title) values ('$HOST','smoke-guest-$(date +%s)') returning id")
psql "$DB" -qc "update trips set visibility='shared', share_mode='both' where id='$T_GUEST'"
SLUG_GUEST=$(psql "$DB" -tAc "select share_slug from trips where id='$T_GUEST'")
[ -n "$SLUG_GUEST" ] || { echo "FAIL: guest trip slug 미생성"; exit 1; }
SEED_PLACE=$(psql "$DB" -qtAc "insert into places (trip_id, added_by, name_local, lat, lng) values ('$T_GUEST','$HOST','host-seed',35,139) returning id")
psql "$DB" -qc "insert into votes (place_id, user_id, kind) values ('$SEED_PLACE','$HOST','love')"

# (a) join 전 direct-read = 0건 (Pitfall 1: 비멤버는 can_read_trip=false)
P_BEFORE=$(curl -s "$API/rest/v1/places?trip_id=eq.$T_GUEST&select=id" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT")
V_BEFORE=$(curl -s "$API/rest/v1/votes?select=id&place_id=eq.$SEED_PLACE" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT")
M_BEFORE=$(curl -s "$API/rest/v1/trip_messages?trip_id=eq.$T_GUEST&select=id" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT")
[ "$(count_json "$P_BEFORE")" = "0" ] || { echo "FAIL: join 전 places direct-read=$(count_json "$P_BEFORE") (want 0 — RLS 미차단)"; exit 1; }
[ "$(count_json "$V_BEFORE")" = "0" ] || { echo "FAIL: join 전 votes direct-read=$(count_json "$V_BEFORE") (want 0)"; exit 1; }
[ "$(count_json "$M_BEFORE")" = "0" ] || { echo "FAIL: join 전 trip_messages direct-read=$(count_json "$M_BEFORE") (want 0)"; exit 1; }

# (b) join_moa(both → editor)
curl -s -X POST "$API/rest/v1/rpc/join_moa" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" -d "{\"p_share_slug\":\"$SLUG_GUEST\"}" > /dev/null
R_GUEST=$(psql "$DB" -tAc "select role from memberships where trip_id='$T_GUEST' and user_id='$ANON_UID'")
[ "$R_GUEST" = "editor" ] || { echo "FAIL: guest join_moa role='$R_GUEST' (want editor)"; exit 1; }

# (c) join 후 add_manual_place(editor) 통과 — 서버 채번 seq_no·added_by=auth.uid
ADDED=$(curl -s -X POST "$API/rest/v1/rpc/add_manual_place" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"p_trip_id\":\"$T_GUEST\",\"p_google_place_id\":\"guest-$(date +%s)\",\"p_name_local\":\"게스트장소\",\"p_lat\":35.2,\"p_lng\":139.2}")
GUEST_PLACE=$(printf '%s' "$ADDED" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
[ -n "$GUEST_PLACE" ] || { echo "FAIL: guest add_manual_place 거부 ($ADDED)"; exit 1; }
G_ADDED_BY=$(psql "$DB" -tAc "select added_by from places where id='$GUEST_PLACE'")
[ "$G_ADDED_BY" = "$ANON_UID" ] || { echo "FAIL: guest place added_by='$G_ADDED_BY' (want $ANON_UID)"; exit 1; }

# votes upsert — user_id 트리거 파생(=auth.uid) + can_vote_trip 통과
VCODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/rest/v1/votes" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d "{\"place_id\":\"$GUEST_PLACE\",\"kind\":\"love\"}")
[ "$VCODE" = "201" ] || { echo "FAIL: guest votes insert HTTP $VCODE (want 201)"; exit 1; }
V_OWNER=$(psql "$DB" -tAc "select user_id from votes where place_id='$GUEST_PLACE' and user_id='$ANON_UID'")
[ "$V_OWNER" = "$ANON_UID" ] || { echo "FAIL: vote user_id 파생 실패 (want $ANON_UID)"; exit 1; }

# trip_messages insert — user_id 트리거 파생 + can_vote_trip 통과
MCODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/rest/v1/trip_messages" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d "{\"trip_id\":\"$T_GUEST\",\"nickname\":\"게스트닉네임\",\"body\":\"게스트 채팅\"}")
[ "$MCODE" = "201" ] || { echo "FAIL: guest trip_messages insert HTTP $MCODE (want 201)"; exit 1; }

# (d) cast_date_vote_authed — device_token := auth.uid()(서버파생, spoof 불가)
POLL=$(psql "$DB" -qtAc "insert into date_polls (trip_id, mode, status) values ('$T_GUEST','range','open') returning id")
POLL_CODE=$(psql "$DB" -tAc "select poll_code from date_polls where id='$POLL'")
OPT=$(psql "$DB" -qtAc "insert into date_poll_options (poll_id, start_date, end_date) values ('$POLL','2026-08-01','2026-08-03') returning id")
curl -s -X POST "$API/rest/v1/rpc/cast_date_vote_authed" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"p_code\":\"$POLL_CODE\",\"p_nickname\":\"게스트닉네임\",\"p_option_id\":\"$OPT\"}" > /dev/null
DT=$(psql "$DB" -tAc "select device_token from date_votes where poll_id='$POLL' and option_id='$OPT'")
[ "$DT" = "$ANON_UID" ] || { echo "FAIL: cast_date_vote_authed device_token='$DT' (want $ANON_UID=auth.uid)"; exit 1; }

echo "PASS: anon(is_anonymous=true, role=authenticated) + join_moa(both→editor, dates→voter) + trip_messages RLS(200) + kakao authorize"
echo "PASS: 게스트 익명 RLS — join 전 0건(places/votes/trip_messages) · join 후 add_manual_place(editor)·votes·trip_messages·cast_date_vote_authed(device_token=auth.uid) 통과"
