# Friend Share Test Pack (D-14 / D-15 / D-16 lock)

> **Goal:** Phase 6 Success Criterion 3 — 친구 2명이 카톡으로 받은 보드 URL을 모바일 브라우저에서 정상 열람 + 핀 탭 → YouTube 영상 jump.
>
> **Lock:** D-14 (친구 2명) + D-15 (체크박스 5종) + D-16 (스크린샷 위치)
> **Estimated time per friend:** ~5분 (친구 협조 시간만)
> **When to ask:** dogfooding Day 5~6 (보드에 ≥ 5 핀 채워졌을 때 — 공유할 콘텐츠가 의미 있는 시점)

---

## Test scaffold (per friend)

각 친구는 익명 라벨 (Friend A / Friend B). 실명·연락처 기록 X (D-16).

### Friend A

**Device meta:**
- Platform: iOS / Android (선택)
- OS version: <예: iOS 18.x / Android 14>
- Browser: Safari / Chrome / Samsung Internet / 기타
- Locale: ko-KR / en-US / ja-JP / 기타 (Known Pitfall — locale 다르면 시스템 폰트 fallback 변화 가능)
- Kakao version: <앱 version, 최신 권장>

**Board URL shared:** `https://<prod-host>/b/<my-share-slug>` (Day 5~6 시점에 채움)
**Share method:** 카톡 1:1 채팅 (그룹 채팅 X — OG 캐시 분리 위해)

**Checklist (D-15):**

- [ ] **1. 카톡 OG 카드 정상 표시** — 보드명(Pretendard 한글) + 미니맵 thumbnail + 핀 N개 + MOAJOA wordmark.
  - Evidence: `.planning/dogfooding/screenshots/friend-A/01-kakao-og.png`
  - Note: 카톡 OG는 첫 본 URL을 24시간 캐싱 (Known Pitfall) — 친구가 처음 받는 URL이어야 fresh OG 보임. 보드 제목 변경한 직후라면 fresh slug 권장.

- [ ] **2. 카드 탭 → 보드 페이지 로드** — 모바일 브라우저에서 지도 + 핀 N개 정상 표시. SSR이므로 로딩 spinner 없이 첫 paint에 지도.
  - Evidence: `.planning/dogfooding/screenshots/friend-A/02-board-page.png`
  - Note: VIEW-01 SSR TTFB target < 800ms — 친구 체감 "빠르네" 1초 이내

- [ ] **3. 핀 1개 탭 → YouTube 영상 정확 timestamp로 jump** — 새 탭 또는 YouTube 앱에서 `?t=Xs` 위치부터 재생.
  - Evidence: `.planning/dogfooding/screenshots/friend-A/03-youtube-jump.png` 또는 화면 녹화 3~5초 (`.mp4`)
  - Note: D-14/D-15/D-16 (04-CONTEXT) `window.open(buildYouTubeWatchUrl(...))` 동작 검증

- [ ] **4. 비로그인 상태로 모든 위 동작** — 친구가 MOAJOA 계정 없이도 모든 step 완료. 어디서도 "로그인 필요" 게이트 X.
  - Evidence: 위 3개 스크린샷 어느 것이든 상단에 로그인 banner 없음 확인 (별도 스크린샷 X)

- [ ] **5. 친구 한 줄 피드백 (자유 형식)** — 향후 v2 UX 개선 시드.
  - Feedback: ____________________ (친구가 카톡으로 보낸 한 줄 그대로 paste — 친구 이름 X)

---

### Friend B

**Device meta:**
- Platform: iOS / Android (선택)
- OS version: 
- Browser: 
- Locale: 
- Kakao version: 

**Board URL shared:** `https://<prod-host>/b/<my-share-slug>` (Friend A와 동일 보드 권장 — OG 캐시 분리 위해 sched 차이 시 fresh slug 고려)
**Share method:** 카톡 1:1 채팅

**Checklist (D-15):**

- [ ] **1. 카톡 OG 카드 정상 표시**
  - Evidence: `.planning/dogfooding/screenshots/friend-B/01-kakao-og.png`

- [ ] **2. 카드 탭 → 보드 페이지 로드**
  - Evidence: `.planning/dogfooding/screenshots/friend-B/02-board-page.png`

- [ ] **3. 핀 1개 탭 → YouTube 영상 정확 timestamp로 jump**
  - Evidence: `.planning/dogfooding/screenshots/friend-B/03-youtube-jump.png` 또는 `.mp4`

- [ ] **4. 비로그인 상태로 모든 위 동작**
  - Evidence: 위 3개 스크린샷에서 로그인 banner 없음 확인

- [ ] **5. 친구 한 줄 피드백 (자유 형식)**
  - Feedback: ____________________

---

## Aggregation (모두 완료 시)

- [ ] Friend A: 5/5 ☑️
- [ ] Friend B: 5/5 ☑️
- [ ] Device coverage: iOS ≥ 1 AND Android ≥ 1 (D-14 권장 — 동일 platform 2명이라도 fail은 아님이지만 coverage 약함)
- [ ] 양쪽 친구 모두 카톡 OG 정상 → Plan 06-05 PASS criterion 4 충족
- [ ] 친구 피드백 2개 → v2 UX 개선 시드로 `.planning/research/PITFALLS.md` Phase 6 섹션 또는 `v2-backlog.md`에 정리 여부 결정

## Pitfall reminders

- **카톡 OG 캐시 24h** — Kakao scraper가 처음 본 URL을 24시간 동안 캐시. 보드 제목·메타 변경 직후 친구한테 share하면 옛날 OG가 보일 수 있음. fresh slug 생성하거나 OG 변경 후 24h 대기.
- **Friend device language** (Known Pitfall, 06-CONTEXT) — locale이 영어/일본어인 친구는 모바일 브라우저 시스템 폰트 fallback이 달라 한글 글꼴이 어색해 보일 수 있음. Pretendard는 SSR로 보드 페이지 + OG ImageResponse에 embed되므로 server-side는 안전. 스크린샷 locale 라벨링 필수 (`screenshots/README.md` 명세).
- **VPN/방화벽** — 일부 친구 회사 wifi에서 supabase.com 또는 vercel.app 차단 가능. 4G/LTE에서 재시도 권장.

---

*Friend share test per Phase 6 D-14 / D-15 / D-16. 친구 부탁 직전 본인이 양식 보고 5분 안에 share + 결과 paste 가능하게.*
*Document created: 2026-05-26 (Plan 06-04 Task 1)*
