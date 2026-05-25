# Phase 3 Manual UAT — iOS Save Flow

> 실기기(아이폰) 필수. 시뮬레이터는 Share Extension 동작이 부정확함 (03-RESEARCH §"Environment Availability").
> 본 체크리스트는 자동화 불가능한 부분만 다룬다. drainPendingLinks 로직과 resolve-place Edge Function은 unit/integration 테스트로 별도 검증.

## Prerequisites

- iPhone (iOS 16+) connected via USB or paired wirelessly
- `apps/ios/.env.local` 설정됨 (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
- `pnpm --filter @moajoa/ios prebuild --clean` + `pnpm --filter @moajoa/ios ios` 으로 실기기 install 완료
- Supabase 프로젝트 (`apps/ios/lib/supabase.ts` 가 가리키는) 에서 본인 계정으로 가입 완료
- 적어도 1개 보드 존재 (없으면 시나리오 1에서 생성)

## Scenario 1 — SAVE-01: 로그인 → 보드 목록 → 보드 상세 진입

1. 앱을 cold launch (홈스크린에서 MOAJOA 아이콘 탭)
2. 로그인 화면이 표시되는지 확인
3. 본인 이메일/비밀번호로 로그인
4. 보드 목록 화면(`/(tabs)/boards`)이 표시되는지 확인
5. 보드 카드를 탭하여 보드 상세(`/boards/[id]`)로 진입
6. 막힘 / 흰 화면 / crash 없이 진입 완료

**Pass:** 1~6 모두 성공, 각 화면 전환 < 1초
**Fail 조건:** 어느 단계든 crash, 흰 화면, "Login required" loop

## Scenario 2 — SAVE-02: URL → 30초 안에 핀 (p90)

1. Scenario 1 완료 후 보드 상세 화면에서 시작
2. URL TextInput에 YouTube URL 붙여넣기 (예: 일본 카페 vlog)
3. "추가" 버튼 탭
4. 화면에 spinner overlay + "분석 중..." 텍스트 표시 확인
5. 시간 기록 시작 (t0)
6. spinner가 사라지고 "{N}개 핀 추가됨" toast 표시될 때까지 대기
7. 시간 기록 종료 (t1). 경과 = t1 - t0
8. MapView에 새 marker가 N개 추가되었는지 시각 확인

**Pass:** 경과 ≤ 30초 (3회 반복 중 최소 2회 통과 = p90 추정). 핀 marker가 MapView에 표시됨.
**Fail 조건:** spinner 60초+ 지속, error toast 표시, MapView marker 미표시.
**p90 정밀 측정:** Phase 6 dogfooding 7일치 `extraction_costs.duration_ms` SQL aggregate (D-11)로 최종 확정.

## Scenario 3 — SAVE-03: 카톡/사파리 Share Sheet → 1탭 저장

1. 사파리에서 YouTube 비디오 URL 열기 (어떤 비디오든 무관)
2. 사파리 하단 share 버튼 (네모+위쪽 화살표) 탭
3. Share sheet 두 번째 줄에서 "MOAJOA 저장" 아이콘 탭
4. Share Extension UI가 0.5~1초 안에 자동으로 닫히고 "{보드명} - 저장됨" 토스트 표시 (D-01 정확한 형식)
5. MOAJOA 메인 앱 열기 → 마지막 사용 보드(last_board_id) 진입 → 새 link 카드 + spinner 또는 새 핀 확인

**Pass:** Share Extension dismiss < 1.5초, toast 표시 정확히 "{보드명} - 저장됨", 메인 앱 진입 시 해당 URL의 link/place 존재
**Fail 조건:** Share Extension에 BoardPicker 표시 (D-01 위반), toast 누락, dismiss > 3초, link 미저장.

> 카톡 안에서의 share는 카카오톡 사용 시 동일 절차. 카카오 앱이 share sheet에서 MOAJOA 노출 안 하면 (카카오 정책), 사파리만으로 확인 충분.

## Scenario 4 — SAVE-04: Offline enqueue + 메인 앱 launch 시 drain

1. iPhone 설정 → 비행기 모드 ON (또는 Wi-Fi/셀룰러 모두 OFF)
2. 사파리에서 YouTube URL 열기 → share → MOAJOA 저장
3. Share Extension 토스트 = "오프라인 — 나중에 저장돼요" (D-04, §UI-SPEC §2)
4. 비행기 모드 OFF (네트워크 복구)
5. MOAJOA 메인 앱 열기 (cold launch — 앱 swipe out 후 다시 열기)
6. 마지막 보드 자동 진입 → 그 보드에 share했던 URL이 link로 추가됨 + 추출 spinner 또는 핀 표시
7. (추가) 두 번째 검증: 앱이 background 상태에서 share → 비행기 모드 OFF → 앱 foreground 복귀 (홈스크린 → MOAJOA 탭) → 같은 drain 동작 확인

**Pass:** offline share 후 online 복구 시 cold launch AND foreground 복귀 둘 다에서 enqueue된 link가 자동 추출됨 (D-04). drain은 silent — 사용자 별도 action 없음.
**Fail 조건:** drain 안 일어남 / 같은 URL 중복 link 생성 (Pitfall 7 retry storm) / app crash on launch with pending queue.

## Scenario 5 — SAVE-05: 수동 핀 추가/편집/삭제

1. 보드 상세 화면에서 우측 상단 "+ 핀" 탭
2. modal이 화면 하단에서 올라옴 (pageSheet 스타일). 키보드 자동 노출.
3. 검색창에 "스타벅스 리저브 도쿄" 입력 (300ms debounce 후 검색)
4. 결과 dropdown에 최대 5개 (D-07) 검색 결과 표시
5. 첫 번째 결과 탭 → modal dismiss → "핀 추가됨" toast → MapView에 새 marker
6. 그 marker 탭 → bottom sheet 표시 (D-09): 장소명 / 주소 / "수동" badge / [이름 수정] / [삭제] 버튼 (영상에서 위치 보기는 manual이라 숨김)
7. [이름 수정] 탭 → 장소명 inline TextInput으로 전환 → "내가 좋아하는 곳"으로 수정 → blur 또는 save
8. bottom sheet 닫고 다시 그 marker 탭 → 수정된 이름이 반영됨
9. [삭제] 탭 → Alert.alert("핀 삭제", "정말 삭제할까요?") → [삭제] 탭 → bottom sheet dismiss → MapView marker 사라짐 → "삭제됨" toast

**Pass:** 1~9 모두 성공, RLS 차단 없음 (본인이 board owner / member이므로)
**Fail 조건:** 검색 결과 빈 응답, marker 미표시, RLS 거부 (`new row violates row-level security policy`), 삭제 후 marker 재출현.

## 부정 시나리오 (Negative)

### N1 — SAVE-04 retry > 3 fallback
1. apps/ios/lib/pending.ts 의 addLink mock을 강제 실패하도록 한 상태에서 drain → retry_count = 1, 2, 3, 4 진행 → 4번째에 `pending_links_failed`로 이동 확인
2. 보드 목록 상단에 "저장 실패 N개 — 탭하여 확인" banner 표시 (UI-SPEC §5)

**Pass:** retry > 3 시 pending_links_failed로 이동 + banner 표시
(N1은 unit test로도 검증 — `__tests__/pending.test.ts` from Plan 03-04)

### N2 — SAVE-05 non-member RLS
1. 두 번째 계정 (board member 아님) 으로 로그인 → 보드 ID를 알아도 + 핀 추가 시도 → Edge Function 또는 DB RLS 거부 응답
**Pass:** 401 또는 RLS error 응답, 핀 INSERT 안 됨

---

## 실행 기록

각 시나리오 실행 시 commit message에 결과 기록: `test(03): UAT scenario {N} PASS — {date}`

마지막 모든 시나리오 PASS 시점에 Phase 3 종료 가능.
