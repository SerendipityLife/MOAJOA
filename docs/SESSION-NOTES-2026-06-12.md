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

### 4-1. YOUTUBE_API_KEY 발급 — 유튜브 추출 품질의 유일한 차단 요소
- timedtext(자막)·InnerTube(설명) 모두 데이터센터 IP에서 봇 차단 → 현재 유튜브 링크는 LLM 입력이 제목뿐이라 장소 0개 (환각 방지는 정상 동작).
- **할 일:** GCP 콘솔(Places 키와 같은 프로젝트) → YouTube Data API v3 활성화 → API 키 발급 → `supabase secrets set YOUTUBE_API_KEY=...` (재배포 불필요, secrets는 즉시 반영). 설명 기반 추출이 살아남 — 자막은 v1.2에서 제3자 transcript 공급자 검토.
- 키 설정 후: 자막·설명 풍부한 영상으로 08-04 스팟체크 재실행 (테스트 보드 그대로 있음).

### 4-2. migration 0011 적용 여부 — 확정 분모에 owner 포함
- 발견: `accepted_member_count`가 owner 미포함 → 분자(투표)엔 owner 표가 들어가 비율 왜곡, owner 단독 보드는 영원히 확정 불가.
- 0011은 `count+1`로 교정 (도메인 규칙 "멤버 한도 owner 포함"과 정합). **커밋만 됨, prod 미적용** — 분류기 가드(승인 범위 외 prod 변경)에 따름. 동의하면 `supabase db push`.

### 4-3. 기타 발견 (기록만)
- `join_shared_board`에 멤버 20명 정원(Limits) 미적용 — 어뷰즈 여지, v1.2 후보.
- 장소 지점 구분 한계: GLITCH COFFEE가 긴자점 대신 칸다 본점으로 해석 — inferred_city가 도시 단위라서. source_quote의 주소를 textQuery에 활용하는 개선이 v1.2 후보.
- 실기기 검증(09-05 iOS 트리거 + 10-03 VoteIsland 확정 토글 브라우저 확인) 남음.

## 5. 테스트 자원 (정리 또는 재활용)

- 계정: `moajoa.claude.test1@example.com` / `moajoa.claude.test2@example.com` (비번: Moajoa-Claude-Test-2026!)
- 보드: "Claude 라이브 검증 보드 (도쿄)" — slug `claude-live-check-tokyo`, shared, 장소 10곳 + 투표 2표 + 실패 IG 링크 2개
- 도그푸딩 전 정리 권장 (또는 데모용으로 유지)
