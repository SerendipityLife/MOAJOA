#!/usr/bin/env bash
# MOA-01 동시성 하네스 — 0024 assign_place_seq 트리거 검증.
# 전제: supabase local 가동 + 0024 적용 (23-04 [BLOCKING] 이후 실행).
# 단언: (1) 동시 40건 무중복·무결번 (2) soft-delete 복원 시 순번 유지
#       (3) hard-delete 후 번호 무재사용 (4) 클라이언트 seq_no forge 차단
set -euo pipefail
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"

ANON_KEY=$(supabase status -o env 2>/dev/null | grep ANON_KEY | cut -d= -f2 | tr -d '"')

# 테스트 유저 확보 (email signup — 로컬 autoconfirm. 이미 있으면 signup은 무시)
EMAIL="seqtest@local.test"
curl -s -X POST "$API/auth/v1/signup" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password-seqtest-1\"}" > /dev/null || true
USER_ID=$(psql "$DB" -tAc "select id from auth.users where email='$EMAIL' limit 1")
[ -n "$USER_ID" ] || { echo "FAIL: test user missing"; exit 1; }

# -q 필수: INSERT...RETURNING은 -t만으론 커맨드 태그("INSERT 0 1")가 섞여 나옴
TRIP=$(psql "$DB" -qtAc "insert into trips (owner_id, title) values ('$USER_ID','seq-test-$(date +%s)') returning id")

# (1) 동시 40건 삽입, 8-way 병렬
seq 1 40 | xargs -P 8 -I{} psql "$DB" -qc \
  "insert into places (trip_id, added_by, name_local, lat, lng)
   values ('$TRIP','$USER_ID','p{}',35.0,139.0)"

RES=$(psql "$DB" -tAc "select count(*)||'|'||count(distinct seq_no)||'|'||max(seq_no) from places where trip_id='$TRIP'")
[ "$RES" = "40|40|40" ] || { echo "FAIL: concurrency — got $RES (want 40|40|40)"; exit 1; }

# (2)(3) soft delete·복원 + 최고번호 hard delete 후 재삽입
psql "$DB" -qc "update places set hidden_at = now() where trip_id='$TRIP' and seq_no = 3"
psql "$DB" -qc "delete from places where trip_id='$TRIP' and seq_no = 40"
psql "$DB" -qc "insert into places (trip_id, added_by, name_local, lat, lng) values ('$TRIP','$USER_ID','after-delete',35,139)"
psql "$DB" -qc "update places set hidden_at = null where trip_id='$TRIP' and seq_no = 3"

NEWSEQ=$(psql "$DB" -tAc "select seq_no from places where trip_id='$TRIP' and name_local='after-delete'")
[ "$NEWSEQ" = "41" ] || { echo "FAIL: hard-delete reuse — got seq $NEWSEQ (want 41, 40 재사용 금지)"; exit 1; }
# boolean은 ||로 text 캐스트되면 'true'/'false' (psql 표시형 t/f 아님)
KEPT=$(psql "$DB" -tAc "select seq_no||'|'||(hidden_at is null) from places where trip_id='$TRIP' and seq_no=3")
[ "$KEPT" = "3|true" ] || { echo "FAIL: soft-delete restore — got $KEPT (want 3|true)"; exit 1; }

# (4) forge 차단: 클라이언트가 seq_no=999를 보내도 트리거가 덮어씀
FORGE=$(psql "$DB" -qtAc "insert into places (trip_id, added_by, name_local, lat, lng, seq_no) values ('$TRIP','$USER_ID','forge',35,139,999) returning seq_no")
[ "$FORGE" = "42" ] || { echo "FAIL: forge guard — got seq $FORGE (want 42)"; exit 1; }

# (5) 게스트(익명) 이어지는 순번 #N+1 (Plan 25-05, SHARE-04 / MOA-01 / T-25-16)
#     기존 N개 장소가 있는 trip을 공유(both→게스트=editor)하고, 익명 세션이
#     add_manual_place → seq_no = 현재 max+1(이어짐·결번/중복 0). 서버 채번(0024
#     assign_place_seq)이라 게스트가 seq를 위조해도 트리거가 덮어씀.
PREV_MAX=$(psql "$DB" -tAc "select max(seq_no) from places where trip_id='$TRIP'")   # 42
psql "$DB" -qc "update trips set visibility='shared', share_mode='both' where id='$TRIP'"
GSLUG=$(psql "$DB" -tAc "select share_slug from trips where id='$TRIP'")
[ -n "$GSLUG" ] || { echo "FAIL: guest share slug 미생성"; exit 1; }

# 익명(게스트) 세션 발급 (비 device_token — signInAnonymously 등가)
GRESP=$(curl -s -X POST "$API/auth/v1/signup" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"data":{"name":"게스트채번"}}')
GJWT=$(printf '%s' "$GRESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")
curl -s -X POST "$API/rest/v1/rpc/join_moa" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $GJWT" \
  -H "Content-Type: application/json" -d "{\"p_share_slug\":\"$GSLUG\"}" > /dev/null

# 게스트가 seq_no=999 forge 시도 — 트리거가 무시하고 #N+1 채번
GADDED=$(curl -s -X POST "$API/rest/v1/rpc/add_manual_place" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $GJWT" \
  -H "Content-Type: application/json" \
  -d "{\"p_trip_id\":\"$TRIP\",\"p_google_place_id\":\"guest-seq-$(date +%s)\",\"p_name_local\":\"guest-added\",\"p_lat\":35.3,\"p_lng\":139.3}")
GSEQ=$(printf '%s' "$GADDED" | python3 -c "import json,sys; print(json.load(sys.stdin).get('seq_no',''))" 2>/dev/null || true)
WANT_SEQ=$((PREV_MAX + 1))
[ "$GSEQ" = "$WANT_SEQ" ] || { echo "FAIL: 게스트 채번 seq $GSEQ (want $WANT_SEQ=이어짐, resp=$GADDED)"; exit 1; }
# 결번·중복 0 재확인: distinct count == count, max == want
GRES=$(psql "$DB" -tAc "select count(*)||'|'||count(distinct seq_no)||'|'||max(seq_no) from places where trip_id='$TRIP'")
echo "$GRES" | grep -q "|$WANT_SEQ\$" || { echo "FAIL: 게스트 추가 후 max seq mismatch ($GRES, want max=$WANT_SEQ)"; exit 1; }

echo "PASS: place_seq concurrency (40|40|40, hard-delete→41, soft-restore 3|true, forge→42)"
echo "PASS: 게스트(익명) add_manual_place → 이어지는 순번 #$WANT_SEQ (결번/중복 0, 서버 채번 forge 불가)"
