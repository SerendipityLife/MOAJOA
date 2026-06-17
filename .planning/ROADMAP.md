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
**회색지대(discuss 필요):** (A) `+native-intent.tsx`로 딥링크 가로채고 expo-share-intent 페이로드(App Group)→`enqueuePendingLink` 연결 vs (B) `useShareIntent`/`ShareIntentProvider` 통합 대체 / 보드 미지정 케이스(D-03 board picker) 처리 / 충돌위험영역: `packages/core` `SharedDefaultsKeys`, 네이티브 익스텐션 설정(`app.config.ts`).
**Requirements**: TBD
**Depends on:** Phase 15
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 16 to break down)
