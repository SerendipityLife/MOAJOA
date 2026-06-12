# SESSION NOTES — 2026-06-12 (Claude 자율 세션, 사용자 부재 ~6h 위임)

> 사전 승인: 라이브 적용 전부 허용 · 작업 4종 전부 · 새 테스트 계정 · 작업 단위 push.

## 1. 한 줄 요약

v1.1 모닝 게이트의 자동화 가능한 범위를 전부 라이브 검증 완료 — **블로그 추출 풀 파이프라인이 프로덕션에서 동작**(10곳, conf 0.94, 해설 우수, 환각 0). 유튜브만 YOUTUBE_API_KEY 부재로 차단.

## 2. 라이브 적용/검증 결과

| 항목 | 결과 |
|---|---|
| 마이그레이션 0008+0009+0010 | ✅ 적용 확인 (0008/0009는 동료가 선적용, 0010 포함 전부 라이브 — 컬럼/RPC 직접 검증) |
| `pnpm supabase:types` | ✅ `--linked`로 재생성 (1567줄, summary_ko/extraction_started_at 포함) |
| extract-youtube 배포 | ✅ 3회 배포 (리뷰픽스 → InnerTube 폴백 → Low픽스) |
| 보안: anon 키 직접 호출 | ✅ 401 |
| 보안: ready 재추출 | ✅ 409 |
| failed/manual_review 재클레임 | ✅ 동작 |
| 블로그 추출 (SRC-01) | ✅ 디에디트 도쿄 맛집 글 → 장소 10곳, conf 0.94, summary_ko 전부 생성, **환각 0** (영문 원문 음차 3건 원문 대조로 확인) |
| 인스타 (SRC-02) | ✅ 명시적 한국어 실패 사유, 절대 ready 안 됨 |
| join_shared_board + 투표 | ✅ 테스트 계정 2개로 자가참여 → ❤️ 2표 |
| anon public_board_view (shared) | ✅ D27 가시성 확대 라이브 동작 |
| 프로덕션 웹 렌더 | ✅ https://moajoa-web.vercel.app/b/claude-live-check-tokyo — 해설+VoteIsland 노출 |
| **유튜브 추출 (08-04)** | ⚠️ **차단** — 아래 §4-1 |

## 3. 코드 변경 (전부 main에 push됨, 2abb6bd까지)

1. **InnerTube 설명 폴백** — timedtext가 봇 게이트로 전 영상 빈 응답(라이브 확인), oEmbed는 설명 없음 → 키 없이 설명을 받는 InnerTube 경유 추가. 단 Edge IP에서도 차단됨(desc=0 확인) — 최종 해법은 Data API 키.
2. **자가 진단 강화** — `no places found` 에러에 입력 크기 기록 (desc/body chars).
3. **09-05 iOS 트리거 확장** — 두 사이트 youtube → blog/insta. tsc 0, jest 38/38. **실기기 검증만 남음.**
4. **marker-svg 팔레트 단일 출처화** — ui-tokens import, 5건 테스트 실패 해소. 웹 60/60.
5. **리뷰 Low 정리** — already-processing 409 일관화 · 실패 행 메타데이터 보존 · SSRF 가드 강화(10진/16진/8진 IP, 127.1, 0.0.0.0/8, IPv4-mapped IPv6) + 테스트 8건. deno 44/44.
6. **CLAUDE.md D26** — web=열람+투표 참여, ios=저장·공유·캡처·편집. 하드룰(웹 생성 UI ❌) 유지.
7. **migration 0011 작성·커밋 (prod 미적용)** — 아래 §4-2.

## 4. 사용자 판단 필요 (귀가 후)

### 4-1. ~~YOUTUBE_API_KEY 발급~~ ✅ 해소 (사용자 원격 제공, 같은 날)
- 키 설정 + 재배포 + 08-04 재검증 완료: 도쿄 맛집 영상 → **장소 9곳 ready (conf 0.85), 환각 0** — 설명의 타임스탬프 목록 8줄과 1:1 대응, 타임스탬프 파싱 정확, 영상 summary_ko 근거 기반.
- 자막(timedtext)은 여전히 서버 IP 차단 → 추출은 **설명 기반**. 자막 의존 영상(설명 빈약)은 manual_review로 graceful — v1.2에서 transcript 공급자 검토.
- 발견 사례: "본젠 커피" → 米本珈琲(요네모토)로 해석 (실제는 긴자 Bongen Coffee 추정) — 이름 단독 Places 검색의 한계 (§4-3 지점 구분 한계와 동일 계열).

### 4-2. migration 0011 적용 여부 — 확정 분모에 owner 포함
- 발견: `accepted_member_count`가 owner 미포함 → 분자(투표)엔 owner 표가 들어가 비율 왜곡, owner 단독 보드는 영원히 확정 불가.
- 0011은 `count+1`로 교정 (도메인 규칙 "멤버 한도 owner 포함"과 정합). **커밋만 됨, prod 미적용** — 분류기 가드(승인 범위 외 prod 변경)에 따름. 동의하면 `supabase db push`.

### 4-2b. ~~migration 0011~~ ✅ 적용 + 0012 추가 (10-03 브라우저 검증 중 버그 2건)
- **0011 적용 완료** (사용자 승인) — accepted_member_count 분모에 owner 포함, 라이브 2 확인.
- **0012 추가 (votes UPDATE RLS + owner join 가드):** test2 계정으로 실제 투표 클릭 중 발견 —
  1. `castVote`가 upsert(ON CONFLICT DO UPDATE)인데 votes에 UPDATE 정책 없어 재투표 시 RLS 42501 → 하트 조용히 롤백. `votes: update own` 추가.
  2. owner가 자기 공유링크로 참여 시 voter membership 행 생성 → 0011 분모와 이중계산. owner self-join을 no-op으로.
- **vote-island 하이드레이션 추가:** 재방문 시 멤버 뷰 자동 진입(`getMyBoardRole`) + 기존 ❤️ 복원(`getMyVotedPlaceIds`). 웹 61/61 그린(회귀 1건 추가).
- 적용 경로: git push → Supabase GitHub 연동 자동 적용(이번 세션에 발견한 패턴 — 0008~0010, 0011, 0012 모두 동일).

### 4-2c. iOS 시뮬레이터 검증 (부분) + 실기기 잔여
- `ios-sim.sh`로 빌드·설치·세션 주입·실행 성공. drain이 큐의 blog 항목을 읽어 addLink로 링크 생성까지 확인(첫 실행) — drain이 blog를 처리함을 입증.
- triggerExtraction 발화의 깨끗한 재현은 시뮬레이터 App Group UserDefaults의 **cfprefsd 캐싱 race**로 불가(외부 `defaults write` 주입 큐를 앱이 launch 때 일관되게 못 읽음 — 테스트 하네스 한계, 앱 코드 무관).
- **[잔여] 실기기 share-sheet:** 시뮬레이터에 share extension 없음 → EAS dev build 필요. `eas build -p ios --profile development` → 폰에서 설치 → 공유시트로 youtube/blog/insta 던져 추출 발화 확인. `eas login` 상태 확인 선행. 09-05 in-app 트리거 코드(boards/[id].tsx + pending.ts)는 grep+tsc+jest로 검증됨.

### 4-3. 기타 발견 (기록만)
- `join_shared_board`에 멤버 20명 정원(Limits) 미적용 — 어뷰즈 여지, v1.2 후보.
- 장소 지점 구분 한계: GLITCH COFFEE가 긴자점 대신 칸다 본점으로 해석 — inferred_city가 도시 단위라서. source_quote의 주소를 textQuery에 활용하는 개선이 v1.2 후보.
- 실기기 검증(09-05 iOS 트리거 + 10-03 VoteIsland 확정 토글 브라우저 확인) 남음.

## 5. 테스트 자원 (정리 또는 재활용)

- 계정: `moajoa.claude.test1@example.com` / `moajoa.claude.test2@example.com` (비번: Moajoa-Claude-Test-2026!)
- 보드: "Claude 라이브 검증 보드 (도쿄)" — slug `claude-live-check-tokyo`, shared, 장소 10곳 + 투표 2표 + 실패 IG 링크 2개
- 도그푸딩 전 정리 권장 (또는 데모용으로 유지)
