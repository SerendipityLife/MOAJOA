#!/usr/bin/env node
// realtime_events_smoke.mjs — Phase 24 (D-14 postgres_changes 실수신 + WALRUS RLS 필터)
//
// 무엇을 증명하나:
//   (1) places INSERT가 owner 구독자에게 postgres_changes 이벤트로 실수신됨
//       → 0026 publication 등록이 무음 no-op(Pitfall 2)을 막았다는 실증.
//   (2) 비멤버(익명) 구독자는 동일 INSERT를 수신하지 못함
//       → WALRUS가 구독자 JWT로 places SELECT RLS(can_read_trip)를 평가한다는 실증
//         (T-24-01 정보노출 완화의 런타임 게이트).
//
// env: SUPABASE_URL(기본 http://127.0.0.1:54321) · SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY
//   (호출측 realtime_publication_smoke.sh가 `supabase status`에서 주입 — 로컬 데모 키).
// supabase-js는 레포 루트 node_modules에서 2.110.x로 해소된다 (24-01 Task 1 게이트).

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANON || !SERVICE) {
  console.error('FAIL: SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY 미주입');
  process.exit(1);
}

const TIMEOUT_MS = 10000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeClient(key) {
  return createClient(URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// 채널 SUBSCRIBED 도달 대기 (CHANNEL_ERROR/TIMED_OUT은 실패로 reject).
function waitSubscribed(channel) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('subscribe 타임아웃')), TIMEOUT_MS);
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(t);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(t);
        reject(err || new Error(status));
      }
    });
  });
}

async function main() {
  // 1) owner 클라이언트 — 로컬 autoconfirm이라 signUp이 바로 세션 발급.
  const owner = makeClient(ANON);
  const email = `rt-smoke-${Date.now()}@test.local`;
  const { data: su, error: suErr } = await owner.auth.signUp({
    email,
    password: 'smoke-pass-1234',
  });
  if (suErr || !su.session) {
    throw new Error('owner signUp 실패: ' + (suErr?.message || 'no session'));
  }
  const ownerUserId = su.user.id;
  // WALRUS가 구독자 역할/RLS를 평가하려면 realtime에 JWT를 넘겨야 함.
  await owner.realtime.setAuth(su.session.access_token);

  // 2) owner가 trip 생성 (owner_id는 JWT auth.uid()로 기본 채움).
  const { data: trip, error: tErr } = await owner
    .from('trips')
    .insert({ title: 'rt smoke', city_code: 'tokyo' })
    .select('id')
    .single();
  if (tErr) throw new Error('trip insert 실패: ' + tErr.message);
  const tripId = trip.id;

  // 3) 비멤버(익명) 클라이언트 — RLS 배제 검증용.
  const stranger = makeClient(ANON);
  const { data: anonData, error: anonErr } = await stranger.auth.signInAnonymously();
  if (anonErr || !anonData.session) {
    throw new Error('anon signIn 실패: ' + (anonErr?.message || 'no session'));
  }
  await stranger.realtime.setAuth(anonData.session.access_token);

  // 4) 양측 구독 — 동일 filter(trip_id) places INSERT.
  let ownerCount = 0;
  let strangerCount = 0;
  const ownerCh = owner
    .channel(`moa:${tripId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'places', filter: `trip_id=eq.${tripId}` },
      () => {
        ownerCount++;
      },
    );
  const strangerCh = stranger
    .channel(`moa-nonmember:${tripId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'places', filter: `trip_id=eq.${tripId}` },
      () => {
        strangerCount++;
      },
    );

  await Promise.all([waitSubscribed(ownerCh), waitSubscribed(strangerCh)]);
  await sleep(700); // WALRUS 구독 정착 여유

  // 5) service_role로 place INSERT.
  //    seq_no는 0024 assign_place_seq 트리거가 서버 채번 — payload에 절대 전송 금지.
  const svc = makeClient(SERVICE);
  const { error: pErr } = await svc.from('places').insert({
    trip_id: tripId,
    added_by: ownerUserId,
    name_local: 'rt smoke place',
    lat: 35.0,
    lng: 139.0,
    source_kind: 'manual',
  });
  if (pErr) throw new Error('place insert 실패: ' + pErr.message);

  // 6) owner 수신 대기 + 비멤버 누출 여부 최종 확인.
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS && ownerCount === 0) {
    await sleep(200);
  }
  await sleep(500);

  await owner.removeChannel(ownerCh);
  await stranger.removeChannel(strangerCh);

  console.log(`owner events=${ownerCount} · nonmember events=${strangerCount}`);
  if (ownerCount < 1) {
    console.error(
      'FAIL: owner가 places INSERT 이벤트 미수신 (publication 미등록 또는 realtime 무동작)',
    );
    process.exit(1);
  }
  if (strangerCount > 0) {
    console.error('FAIL: 비멤버가 이벤트 수신 — WALRUS RLS 누출 (T-24-01)');
    process.exit(1);
  }
  console.log('PASS: owner 1건+ 수신 · 비멤버 0건 (WALRUS RLS 필터 실증)');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
