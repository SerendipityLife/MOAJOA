---
quick_id: 260612-0cx
slug: youtube-pipeline-fixes
status: complete
date: 2026-06-12
---

# Summary — 유튜브 추출 파이프라인 리뷰 픽스 #1~#6

**One-liner:** Fable 5 코드 리뷰에서 나온 High/Medium 이슈 6건을 6개 atomic commit으로 수정 — LLM 출력 잘림, anon 비용 어뷰즈, 클레임 레이스/고착, 도시 힌트 미연결, 키 미설정 침묵.

## Commits

| # | Commit | 내용 |
|---|--------|------|
| 1 | 66c8b74 | `claude.ts` max_tokens 2048→8192 + `stop_reason=max_tokens` 명시적 에러 (Phase 8 summary 필드로 잘림 위험) |
| 2 | (0010) | migration `0010_extraction_started_at.sql` — links.extraction_started_at nullable 컬럼 |
| 3 | a922fe7 | anon JWT 거부 — `admin.auth.getUser()`로 실제 유저 세션만 통과 (public_board_view가 link id 노출 → 비용 어뷰즈 차단) |
| 4 | 0d5b01e | processing 클레임 원자화 (조건부 UPDATE + 영향행 확인), `ready` 재추출 차단, stale(>10분 또는 started_at NULL) processing 재클레임 |
| 5 | 7b58ff6 | board.city_code → LLM cityHint + Places languageCode(seoul/busan/jeju→ko, else ja) + textQuery에 inferred_city 부가, revalidate의 boards 중복 조회 제거 |
| 6 | f8919bd | YOUTUBE_API_KEY 미설정 시 console.warn (oEmbed 폴백은 description 없음) |

## Verification

- `deno check` index.ts / claude.ts / youtube.ts — clean
- `deno test` extract-youtube 36/36 PASS (프롬프트 regression-0 스냅샷 무변경 확인)
- `deno test` resolve-place 8/8 PASS

## Deployment notes (모닝 게이트에 합류)

- **`supabase db push`에 0010 포함** (0008+0009+0010 한 배치)
- **Edge Function 재배포 필요** (`supabase functions deploy extract-youtube`)
- 라이브 스팟체크 추가 항목: ① 로그인 세션으로 추출 정상 동작 + anon 키 직접 호출 401 확인, ② ready 링크 재트리거 409 확인, ③ `YOUTUBE_API_KEY` env 설정 여부 확인 (경고 로그 모니터)
- 클라이언트 영향: `triggerExtraction`이 ready 링크에서 throw하게 됨 — 현 호출부는 전부 catch 처리됨 (drain warn / retry UI는 failed 전용)

## Deferred (리뷰 Low 항목 — 미수정)

- already-processing 응답이 `status: 'manual_review'`로 내려가는 의미 불일치
- 실패 경로에서 title/thumbnail 미저장
- SSRF 가드 한계 (10진수 IP, ::ffff: 매핑, 리다이렉트, DNS 리바인딩)
- blog/instagram 프롬프트의 "this YouTube video" 문구 (D20 byte-identical 잠금)
- structured outputs 전환, 보드 멤버십 검증 — v1.2 후보
