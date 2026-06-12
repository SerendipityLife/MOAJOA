# SESSION NOTES — 2026-06-07

## 주제: 유튜브 영상 "요약·해설" 고도화 논의 → 추출 깊이 마일스톤으로 확장

브레인스토밍 세션. 코드는 아직 안 건드림. 결정사항 잠금 + 다음 마일스톤 라우팅.

---

## 0. 발견 (premise correction)

사용자 인식은 "유튜브 영상 *설명(description)만* 추출 가능"이었으나, **실제 코드는 이미 lilys.ai 방식으로 동작 중**:

- `supabase/functions/extract-youtube/pipeline/youtube.ts:93` — 자막(transcript) ko→ja→en + ASR 폴백, `[mm:ss]` 타임스탬프 청크
- `.../pipeline/claude.ts:41` — 제목+설명+자막(≤12000자) → Claude(`claude-sonnet-4-6`) → 장소 추출 (timestamp, source_quote, confidence)
- Google Places API로 좌표·주소 해석

즉 "URL → 자막 기반 AI 이해 → 추출"은 이미 있음. **lilys.ai 대비 빠진 것 = 사람이 읽는 "요약·해설" 텍스트.**

---

## 1. 제품 본질 재정렬

세 가지 고통에서 출발한 서비스:
1. **모으기** — 여행 전 본 정보(글)를 한곳에 모으기 어렵다
2. **공유** — 같이 갈 사람에게 전달하기 어렵다
3. **같이 고르기** — 함께 갈 장소를 투표·결정하기 어렵다

→ **이번 초점 = 모으기 (입력·추출).** 입구가 약하면 뒤가 안 굴러감.

### 모으기 = 독립적 3개 하위 프로젝트
| | 하위 프로젝트 | 성격 |
|---|---|---|
| **②** | 추출 깊이 (출력 계약) | 서버/Edge + 스키마. 유튜브 파이프라인 확장 |
| **①** | 소스 넓이 (블로그·인스타) | 서버/Edge. 소스별 파서 |
| **③** | 캡처 마찰 (공유시트/share extension) | iOS 클라이언트. 거의 독립 |

**순서 = ② → ① → ③.** ②가 "좋은 추출 결과물이란 무엇인가" 출력 계약을 정의 → ①이 그 계약을 재사용. ③은 직교(병렬 가능).

---

## 2. ② 추출 깊이 — 잠긴 설계 (출력 계약 v1)

**방향: 장소 중심 (place-centric), 접근 A (한 줄 해설).**

- **단일 Claude 호출 확장** — 자막이 이미 컨텍스트에 있으니 출력 스키마만 넓힘. 새 호출/레이턴시 없음, 출력 토큰만 소폭↑.
- **새 필드 2개 (둘 다 nullable, 추가형):**
  - `places.summary_ko` — 장소당 1~2문장 한국어 해설 (기존 `source_quote` 옆, 동일 단일출처 패턴)
  - `links.summary_ko` — 영상 2~3문장 TL;DR (보조)
- **반환각 규칙 유지** — 해설은 자막·설명 근거 범위 내에서만. 근거 없으면 짧거나 비움(지어내기 금지). 기존 `confidence<0.4` 필터·`source_quote` 필수 유지.
- **언어** — 해설은 한국어 출력 (영상이 JP/EN이어도).
- **서버사이드라 웹·앱 양쪽에 자동 노출.**
- **에러 처리** — 해설은 부가 기능, 절대 추출을 실패시키지 않음. 누락 시 NULL 저장 + UI에서 해설 블록만 숨김.

### 알려진 한계 (이번엔 수용)
한 장소가 여러 영상에 나오면 `places` upsert(unique board_id+google_place_id)로 해설이 덮어써짐. 멀티-영상 출처는 별도 테이블 필요하나, 기존 단일 `source_quote` 패턴 따라가고 **나중 마이그레이션으로 미룸** (surgical — 새 테이블 임의 생성 안 함).

### 손댈 파일 (plan 단계에서 정밀화)
- `supabase/functions/extract-youtube/pipeline/claude.ts` — 프롬프트 + 출력 파싱
- `supabase/functions/extract-youtube/index.ts` — places upsert / link 업데이트에 summary_ko
- `packages/core/src/schemas/{place,link,extraction}.ts` — summary_ko optional
- `supabase/migrations/NNNN_extraction_summaries.sql` — **새 마이그레이션**(append-only): `places.summary_ko`, `links.summary_ko` text nullable
- `pnpm supabase:types` → database.ts 재생성
- UI 노출 — 웹 공개 보드 핀/리스트에 장소 해설 (+링크 카드 영상 요약). 웹엔 새 생성/추가 UI 안 만듦 (규칙 준수)

### 성공 기준 (검증 가능)
1. 자막 있는 여행 영상 추출 → 각 장소 비어있지 않은 `summary_ko` + 링크 영상 요약 생성
2. 해설이 자막 근거 범위 내 (스팟체크 환각 없음)
3. 자막 빈약 영상 → 해설 짧거나 비어도 추출 자체는 성공
4. 레거시(요약 없는) 데이터도 UI에서 안 깨짐 (조건부 렌더)

### 확장 경로
nullable 추가형이라 나중에 접근 B(`highlights[]`·태그)를 계약 안 깨고 얹을 수 있음.

---

## 3. 웹 범위 결정 (동료 합의 완료)

**웹 = 조회 + 공유 + 투표(참여).** 캡처·편집·관리는 앱 전용.

근거: 작은 팀 최대 비용은 "2벌 유지". 리스트 편집 미러링은 비싸고 안 남음(캡처는 앱에서 했는데 편집만 웹 갈 이유 약함). 반대로 **투표를 웹에 여는 것** = 초대받은 친구가 무설치로 "여기 가자" 가능 → 소셜 루프의 핵심이라 값함. 앱은 공유시트 캡처(모바일 고유)로 존재 이유 영구.

### ⚠️ CLAUDE.md 갱신 플래그 (실제 투표 빌드 시점에)
- 144번 줄 `web/ = 열람·공개 보드` → `열람·공개 + 투표 참여`로 확장
- 145번 줄 `ios/ = 저장·공유·투표` → 저장·공유·**캡처·편집** 중심
- 213번 줄 하드룰(`웹에 보드생성·링크추가 ❌`)은 **유지** — 우리가 추가하는 건 투표/열람이지 생성 아님

---

## 4. 라우팅 결정

**v1 현황:** 86% (27/28 plans, 6/7 phases). 코드 phase(1,2,5,7) 완료, 3·4 code-complete(UAT 미룸). **남은 단 하나 = Phase 6 Dogfooding Gate** (7일 실사용 + 추출정확도 baseline).

**중요:** ②해설·①넓이·웹투표는 STATE.md "Out of Scope (v1)"에 명시됨 (협업 투표 UI, 블로그/IG 자동 추출). → 전부 **post-v1 = 새 마일스톤감.**

**도그푸딩 트레이드오프 surfaced & 사용자 선택:** 도그푸딩이 "정확도가 병목인지 vs 해설이 다음 베팅인지"를 싸게 알려주지만, 사용자는 **새 마일스톤 시작(②+①+투표)**을 선택. 도그푸딩은 병행/나중.

---

## 다음 스텝

→ **`/gsd-new-milestone`** — v1.1 "추출 고도화 + 협업". 첫 phase 후보 = ② 장소별 해설 (이 노트 §2가 discuss-phase 결정 역할). 이후 ① 소스 넓이, 웹 투표.
