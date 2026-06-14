---
phase: 15
slug: llm-vibe-llm-vibe-vibe-core-resolver
title: 장소 카테고리 보강 (LLM vibe)
created: 2026-06-14
---

# Phase 15 — CONTEXT (장소 카테고리 보강, LLM vibe)

## 문제 (근본 원인)

UI 고도화(2026-06-14) 중 발견: 보드/장소 카드의 카테고리 색이 대부분 회색('장소')으로 뜬다.

추출(`supabase/functions/extract-youtube/index.ts`)에 장소 해석 경로가 둘:
1. **맵링크 장소** (index.ts:286-312) — 영상 설명의 구글맵 링크에서 직접 시드. **Places API 검색 없이(keyless·무료)** placeId/이름/좌표만 → `primaryType: null` → `places.category` 비어있음.
2. **텍스트 검색 장소** (327-347) — LLM 후보 → `resolveGooglePlace` → `primaryType` 받음 → category 채워짐.

한글 음역 이름 영상(동료 영상 등)은 대부분 경로 1 → category null → 카드가 회색. (경로 1은 spike-002에서 0장소 버그를 고친 의도적 keyless 최적화 — 되돌리지 않는다.)

## 목표

추가 API 비용 0으로, 장소 카드의 카테고리 색이 (맵링크 포함) **항상** 살아나게 한다. LLM 추론으로 vibe를 부여한다.

---

## 결정 (LOCKED)

### D1. 정규 vibe 택소노미 — 6개 (사용자 결정)
`food`(맛집) · `cafe`(카페) · `nature`(자연) · `culture`(명소) · `shopping`(쇼핑) · `other`(기타)
- 바/이자카야/술집 → `food`. 힐링/온천/스파/숙소 → `other`.
- iOS(현행 6 vibe)와 웹(현행 7 bucket: restaurant/cafe/bar/shopping/nature/culture/lodging)을 **이 6개로 통일**.

### D2. 단일 resolver를 `packages/core`에 (중복 제거)
- 현재 iOS `apps/ios/lib/category.ts`(`vibeOf`)와 웹 `apps/web/lib/category-icon.ts`(`categoryVisual`)가 **중복**이고 Google primaryType substring만 인식.
- `packages/core`에 **단일 resolver** 신설: `placeVibe(category: string | null): Vibe` (6개 키 중 하나 반환).
  - **두 입력 모두 인식**: (a) 정확한 vibe 키("food"…)면 그대로, (b) Google primaryType substring이면 버킷 매핑.
  - core는 `Vibe` 키 + **공유 색 hex**(VIBE_META)까지 소유(색=토큰, 공유 타당). **아이콘은 클라이언트별 유지**(iOS Ionicons / 웹 lucide — 아이콘 라이브러리가 다름).
- iOS `vibeOf`/웹 `categoryVisual`은 core resolver를 호출하도록 교체(각자 아이콘 매핑만 보유). §4.2 충돌위험영역(core 매퍼는 공유) 준수.

### D3. `places.category` 저장 = `primaryType ?? vibe`
- 텍스트검색 장소: Google `primaryType` 그대로(더 정확·풍부) 저장.
- 맵링크 장소: LLM `vibe` 키 저장.
- 컬럼은 혼합(Google 타입 + vibe 키) 허용 — 표시 시 `placeVibe`가 둘 다 정규화. **마이그레이션 불필요**(컬럼 존재, 의미만 확장).

### D4. LLM vibe 부여 (claude.ts)
- `PlaceCandidate`에 `vibe: enum(6키).optional()` 추가 + 프롬프트 출력 스키마/제약에 6 버킷 설명 1줄.
- **맵링크 장소 커버**: 맵링크 장소는 LLM 후보가 아니지만, 설명의 같은 장소를 LLM도 추출하므로 — **정규화된 이름(name_local/name_ko)으로 LLM 후보와 매칭**해 vibe를 빌려온다(무료, 추가 호출 0). 매칭 실패 → vibe 생략(resolver가 'other').

### D5. confident-wrong 비게이팅
- vibe는 색일 뿐 저위험 → confidence 게이팅 없음. (장소 존재/이름의 신뢰 신호는 기존 source_kind/confidence 그대로.)

---

## 범위 외 (Deferred)
- **기존 데이터 백필**: 이 변경은 forward fix(새 추출만). 기존 보드 장소는 재추출 전까지 회색 유지. 백필(기존 null category 장소를 LLM로 분류)은 별도 작업.
- 클라이언트 아이콘 세트 재디자인.
- 웹 bucket의 색조(orange/amber/violet…) 미세 재조정.

## 검증 메모 (planner/executor용)
- Edge Function 변경은 **로컬 스샷 검증 불가** — `supabase functions deploy extract-youtube` + 실제 영상 추출로 확인. claude.ts `buildPrompt` regression-0 스냅샷 테스트가 있으니 프롬프트 변경 시 갱신 필요.
- `placeVibe` resolver는 core 단위 테스트로 검증(키 입력 + Google 타입 입력 둘 다).
- iOS/웹은 resolver 교체 후 타입체크 + (가능하면) 프리뷰/시뮬 렌더.

## 영향 파일 (예상)
- `packages/core/src/…` — `placeVibe` + `Vibe` + `VIBE_META`(신규)
- `supabase/functions/extract-youtube/pipeline/claude.ts` — vibe 필드 + 프롬프트
- `supabase/functions/extract-youtube/index.ts` — 맵링크 vibe 매칭 + insert `category`
- `apps/ios/lib/category.ts` — core resolver 호출로 교체(아이콘 매핑 유지)
- `apps/web/lib/category-icon.ts` — core resolver 호출로 교체(아이콘 매핑 유지)
