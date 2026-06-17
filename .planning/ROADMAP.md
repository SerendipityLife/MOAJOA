**Goal:** 추가 API 비용 0으로, 장소 카드의 카테고리 색이 (맵링크 포함) 항상 살아난다. 추출 LLM이 장소마다 coarse vibe(6택: food/cafe/nature/culture/shopping/other)를 부여하고, 맵링크 장소는 동명 LLM 후보의 vibe를 빌려오며, `places.category = primaryType ?? vibe`로 저장. iOS `vibeOf`/웹 `categoryVisual` 중복 매퍼를 `packages/core`의 단일 `placeVibe` resolver로 통일(아이콘은 클라이언트별 유지, 색 hex는 core VIBE_META 공유).
**Requirements**: EXTRACT-12
**Depends on:** Phase 14
**Plans:** 3 plans

Plans:
- [x] 15-01-PLAN.md — core 단일 resolver: placeVibe + Vibe + VIBE_META (TDD)
- [x] 15-02-PLAN.md — Edge 추출: LLM vibe 필드 + 맵링크 vibe 매칭 + category=primaryType??vibe (배포 v78 + 라이브 UAT ✅ 2026-06-15: 짧은 영상 추출→맛집/카페 색 카드 확인)
- [x] 15-03-PLAN.md — iOS/웹 클라이언트 매퍼를 core placeVibe 호출로 교체
### Phase 16: iOS share ingestion

**Goal:** 공유 시트로 유튜브/블로그/인스타 링크를 MOAJOA로 보내면 앱이 받아 보드에 링크 추가 + 추출 트리거까지 동작한다. 현재(2026-06-17 디버깅 확인): expo-share-intent 표준 네이티브 익스텐션(`ios/byMOAJOA`, App Group `group.com.serendipitylife.moajoa`)은 공유 데이터를 키 `moajoaShareKey`에 쓰고 `moajoa://dataUrl=moajoaShareKey?nonce=…` 딥링크로 앱을 열지만, JS 수신이 전무 — `app/+native-intent.tsx` 부재로 딥링크가 expo-router 직행→"Unmatched Route"이고, 커스텀 드레인 `lib/pending.ts`의 `drainPendingLinks()`는 다른 키 `SharedDefaultsKeys.PendingLinks`를 읽는데 익스텐션은 거기에 안 써서 네이티브 캡처↔JS 드레인이 끊겨 있음.
**결정 잠금 (discuss 완료):** D-05 A안 채택 — `+native-intent.tsx`(리다이렉트 전용) + 마운트된 `share-handler.tsx`(읽기/검증/라우팅) 두 조각으로 분해(`redirectSystemPath`는 앱 컨텍스트 밖이라 auth/Supabase 불가). 기존 큐·드레인·실패화면 인프라 전부 보존. D-01 스마트 라우팅(1개→자동, 2개+→인앱 피커), D-02 로그아웃/0보드→큐 머묾, D-03 자동시 보드 이동+추출 진행 표시, D-04 인앱 바텀시트 피커, D-06 표준 익스텐션 유지(app.config.ts 변경 없음, prebuild 불필요).
**Requirements**: D-01..D-06 (ROADMAP에 REQ-ID 미할당 — CONTEXT 결정으로 커버)
**Depends on:** Phase 15
**Plans:** 3 plans

Plans:
- [x] 16-01-PLAN.md — Wave 0 순수 기반: `decideShareRoute`(D-01/D-02) + `+native-intent.tsx` 리다이렉트(D-05) + 유닛 테스트 (TDD RED→GREEN, 11 신규 테스트 / iOS 풀스위트 54/54, tsc clean; jest는 이 환경에서 `--watchman=false` 필요)
- [x] 16-02-PLAN.md — 마운트 핸들러 `share-handler.tsx`: 페이로드 읽기·Zod http(s) 검증(V5)·라우팅 → enqueue 머묾(D-02) 또는 자동추가+추출+이동(D-03/D-05) + `_layout` ShareIntentProvider 래핑 (TDD RED→GREEN, 15 신규 테스트[9 share-payload + 6 share-handler] / iOS 풀스위트 69/69, tsc clean; `extractSharedUrl` V5 가드 + `handleSharedUrl` 테스트 가능 seam; 자동경로는 직접 addLink+startExtraction[D-03 가시], 드레인 triggerExtraction 아님; 프로바이더 reader-only·드레인 미변경)
- [~] 16-03-PLAN.md — **구현 ✅ / 디바이스 UAT ⏳ 대기.** Task 1(코드+유닛) 완료: `board-picker-sheet.tsx`(D-04 인앱 피커 — keep-mounted `shown` + 인라인 backgroundStyle + 내부 View className, pin-sheet 미러·Pitfall 6 첫오픈 no-op 회피; listMyBoardsWithPreview→title+place_count 행) + `share-handler.tsx` 피커 분기 배선(`addAndNavigate` 공유 헬퍼로 auto[1보드]·picker[2+] 단일 경로, `pickerUrl` state 보유 후 시트 마운트). TDD RED→GREEN 044cb1b/a82dffa, 5 신규 피커-셀렉트 와이어링 = iOS 풀스위트 74/74, tsc clean; Rule 3: 테스트가 BoardPickerSheet 모듈 stub(@gorhom→reanimated jest 미로드 회피, 설정/소스 변경 0). **Task 2 `checkpoint:human-verify` gate=blocking — 디바이스/심 UAT 4 시나리오(피커 첫오픈·1보드 자동이동·로그아웃 머묾·중복방지) 사용자 측 미수행 → 통과 전까지 fully-done 아님** (상세 16-03-SUMMARY.md "Pending: Device UAT")
