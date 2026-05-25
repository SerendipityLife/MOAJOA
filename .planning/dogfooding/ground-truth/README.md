# Ground Truth Authoring Guide

**Goal:** 12 sample videos × 평균 5~15 places = 약 100 pair. 일관된 방법으로 채워야 baseline이 의미 있음.

본 디렉토리는 `samples.json` 12 entry 각각의 ground truth JSON. 한 영상 = 한 파일 (`sample-01.json` ~ `sample-12.json`). dogfooding 시작 직전 본인이 12회 일관된 방법으로 채운다.

## Per-video procedure (평균 5~15분/video × 12 = 약 1~3시간 일회성)

1. **Copy template:** `cp _template.json sample-XX.json` (sample-01 ~ sample-12)
2. **메타 채우기:** `url`, `video_title`, `video_duration_sec` (sample-videos.md 표의 URL과 일치)
3. **수동 시청 (1.5x 권장):** 영상을 처음부터 끝까지 보면서 다음 단서로 place 후보 수집:
   - 영상 내 화면 caption / 자막
   - 영상 설명란 (description) 의 링크
   - 등장하는 간판 / 메뉴판 / 영수증 등 비주얼 단서
   - creator가 음성으로 언급한 이름
4. **Google Maps에서 각 후보 검색:**
   - "이름 + 도시" 검색 → 후보 1개로 좁혀지면 → URL 또는 share dialog에서 `place_id` 추출
   - Google Maps place_id 추출 방법: [Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id) ("Find the ID of a particular place" 섹션의 finder tool)
   - `place_id`를 `google_place_id` 칸에 paste
5. **confidence_label:**
   - **high:** creator가 명시적으로 이름 언급 + Google Maps에서 1개로 명확히 resolve
   - **medium:** 화면에 짧게 나오지만 이름은 안 부름 + Google Maps resolve는 가능
   - **low:** 등장은 했으나 정확한 place_id 모호 (예: "어떤 동네 카페")
6. **first_mention_sec:** YouTube player의 timestamp (s 단위). 영상 안 첫 등장 시각.
7. **notes:** 특이사항 (creator 발음 오류, 영업종료, 동명이인 가게 구분 단서 등)
8. **completed_by, completed_date, time_spent_min** 채우고 저장.

## Matching with extraction (later — Plan 06-05 evaluator + dogfooding 본인 작업)

`scripts/dogfooding/measure-accuracy.sql` (Plan 06-03 산출물)으로 places 테이블 추출 → 본인이 다음 기준으로 markdown 표에서 수동 매칭:

- **Primary (D-06 a):** `google_place_id` 동일
- **Fallback (D-06 b):** normalized name + city 매칭 (`replace(/\s/g,'').toLowerCase()`)
- 6종 failure label (D-07)로 mismatch 분류: `hallucination` / `wrong_place` / `wrong_city` / `missing_lowconf` / `missing_dropped` / `transcript_fail`

매칭 자체는 사람 수동 (D-08) — v2 EXTRACT-08에서 자동화.

## Quality bar

- 한 영상당 `ground_truth_places` ≥ 3 (너무 적으면 recall/precision 분모 작아 noise 큼)
- `google_place_id` 비율 ≥ 80% (낮으면 매칭이 (a)에서 (b)로 떨어지면서 false-match 위험)
- 매트릭스 D-04를 위반 X (각 영상은 매트릭스의 정해진 라벨에 속함)

## Out of scope (v1)

- 시간 구간 정확한 라벨링 — `first_mention_sec`만 (v2에서 `[from, to]` 구간)
- 영상 내 화자가 여러 명인 경우 발화자 라벨 — v2
- 영상 내 등장한 장소가 visited(긍정) vs avoided(부정)인지 라벨 — v2

## File layout

```
.planning/dogfooding/ground-truth/
├── README.md           ← 본 파일
├── _template.json      ← 복사 원본 (commit 됨)
├── sample-01.json      ← 본인이 채워서 commit
├── sample-02.json      ← 본인이 채워서 commit
└── ...                 (총 12개)
```

---

*Ground truth authoring per Phase 6 D-05 / D-06 / D-08. URL과 ground_truth는 dogfooding 시작 직전 본인이 채움.*
*Document created: 2026-05-26 (Plan 06-02 Task 2)*
