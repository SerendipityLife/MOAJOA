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
import { execSync } from 'node:child_process';

// 키 미주입 시(래퍼 없이 직접 `node ...mjs` 실행) `supabase status`에서 자동 로드.
// 래퍼(realtime_publication_smoke.sh)는 계속 env로 주입 — 그 경로는 이 폴백을 건너뜀.
function loadEnvFromCli() {
  try {
    const out = execSync('supabase status -o env', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    for (const line of out.split('\n')) {
      const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
      if (!m) continue;
      const [, k, v] = m;
      if (k === 'ANON_KEY' && !process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = v;
      if (k === 'SERVICE_ROLE_KEY' && !process.env.SUPABASE_SERVICE_ROLE_KEY)
        process.env.SUPABASE_SERVICE_ROLE_KEY = v;
      if (k === 'API_URL' && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = v;
    }
  } catch {
    /* CLI 부재 — 아래 미주입 가드가 처리 */
  }
}
if (!process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) loadEnvFromCli();

const URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANON || !SERVICE) {
  console.error('FAIL: SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY 미주입 (supabase 스택 실행 중?)');
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

  // service_role place INSERT 헬퍼.
  //   seq_no는 0024 assign_place_seq 트리거가 서버 채번 — payload에 절대 전송 금지.
  const svc = makeClient(SERVICE);
  const insertPlace = async (label) => {
    const { error } = await svc.from('places').insert({
      trip_id: tripId,
      added_by: ownerUserId,
      name_local: `rt smoke place ${label}`,
      lat: 35.0,
      lng: 139.0,
      source_kind: 'manual',
    });
    if (error) throw new Error('place insert 실패: ' + error.message);
  };

  // 5·6) INSERT → owner 수신 대기.
  //   `supabase db reset`가 realtime 컨테이너를 재시작한 직후엔 WAL 디코딩이
  //   콜드스타트라 첫 이벤트 창(10s)을 놓칠 수 있음 — 최대 2회 재시도로 게이트를
  //   결정론적으로 만든다. 비멤버(strangerCount)는 전 시도에 걸쳐 0이어야 통과.
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && ownerCount === 0; attempt++) {
    await insertPlace(attempt);
    const start = Date.now();
    while (Date.now() - start < TIMEOUT_MS && ownerCount === 0) {
      await sleep(200);
    }
  }
  await sleep(500); // 비멤버 누출 여부 마지막 확인 여유

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
  console.log('PASS(1/2): service-role INSERT — owner 1건+ · 비멤버 0건 (WALRUS RLS 필터 실증)');

  // ===========================================================================
  // 게스트 익명 fan-out (Plan 25-05, SHARE-04 / T-25-15)
  //   익명 세션이 join_moa(both→editor) 후 add_manual_place INSERT →
  //   호스트 구독(moa 채널)으로 fan-out 수신 ≥1 AND 비멤버 익명은 0건
  //   (WALRUS 구독자 JWT로 places SELECT RLS 재평가).
  // ===========================================================================
  // 1) 호스트가 shared trip(both) 생성 → 게스트는 join 시 editor.
  const { data: gTrip, error: gtErr } = await owner
    .from('trips')
    .insert({ title: 'rt guest smoke', city_code: 'tokyo' })
    .select('id')
    .single();
  if (gtErr) throw new Error('guest trip insert 실패: ' + gtErr.message);
  const gTripId = gTrip.id;
  const { error: shErr } = await svc
    .from('trips')
    .update({ visibility: 'shared', share_mode: 'both' })
    .eq('id', gTripId);
  if (shErr) throw new Error('guest trip share 실패: ' + shErr.message);
  const { data: gSlugRow, error: slErr } = await svc
    .from('trips')
    .select('share_slug')
    .eq('id', gTripId)
    .single();
  if (slErr || !gSlugRow?.share_slug) throw new Error('guest slug 미생성');

  // 2) 게스트(익명) 세션 → join_moa(both→editor).
  const guest = makeClient(ANON);
  const { data: gAuth, error: gaErr } = await guest.auth.signInAnonymously();
  if (gaErr || !gAuth.session) {
    throw new Error('guest anon signIn 실패: ' + (gaErr?.message || 'no session'));
  }
  const { error: joinErr } = await guest.rpc('join_moa', { p_share_slug: gSlugRow.share_slug });
  if (joinErr) throw new Error('guest join_moa 실패: ' + joinErr.message);

  // 3) 호스트 구독 + 비멤버 익명 구독 (동일 filter).
  let hostCount = 0;
  let nonmemberCount = 0;
  const hostCh = owner
    .channel(`moa:${gTripId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'places', filter: `trip_id=eq.${gTripId}` },
      () => {
        hostCount++;
      },
    );
  const nonmember = makeClient(ANON);
  const { data: nmAuth, error: nmErr } = await nonmember.auth.signInAnonymously();
  if (nmErr || !nmAuth.session) {
    throw new Error('nonmember anon signIn 실패: ' + (nmErr?.message || 'no session'));
  }
  await nonmember.realtime.setAuth(nmAuth.session.access_token);
  const nonmemberCh = nonmember
    .channel(`moa-nonmember2:${gTripId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'places', filter: `trip_id=eq.${gTripId}` },
      () => {
        nonmemberCount++;
      },
    );

  await Promise.all([waitSubscribed(hostCh), waitSubscribed(nonmemberCh)]);
  await sleep(700);

  // 4) 게스트가 add_manual_place(editor) INSERT — 콜드스타트 2회 재시도 하드닝.
  const guestInsert = async (label) => {
    const { error } = await guest.rpc('add_manual_place', {
      p_trip_id: gTripId,
      p_google_place_id: `guest-rt-${label}-${Date.now()}`,
      p_name_local: `guest rt place ${label}`,
      p_lat: 35.2,
      p_lng: 139.2,
    });
    if (error) throw new Error('guest add_manual_place 실패: ' + error.message);
  };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && hostCount === 0; attempt++) {
    await guestInsert(attempt);
    const start = Date.now();
    while (Date.now() - start < TIMEOUT_MS && hostCount === 0) {
      await sleep(200);
    }
  }
  await sleep(500); // 비멤버 누출 여부 마지막 확인 여유

  await owner.removeChannel(hostCh);
  await nonmember.removeChannel(nonmemberCh);

  console.log(`guest fan-out: host=${hostCount} · nonmember=${nonmemberCount}`);
  if (hostCount < 1) {
    console.error('FAIL: 게스트(익명) INSERT가 호스트 구독으로 fan-out 안 됨 (SHARE-04)');
    process.exit(1);
  }
  if (nonmemberCount > 0) {
    console.error('FAIL: 비멤버 익명이 게스트 INSERT 수신 — WALRUS RLS 누출 (T-25-15)');
    process.exit(1);
  }

  console.log('PASS(2/2): 게스트(익명) join→add_manual_place fan-out ≥1 · 비멤버 0건 (WALRUS RLS)');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
