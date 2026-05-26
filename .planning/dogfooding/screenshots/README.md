# Dogfooding Screenshots Layout

**Lock:** D-16 (스크린샷 위치 친구별 폴더, 실명 X)

## Directory layout

```
.planning/dogfooding/screenshots/
├── README.md                         ← 본 파일
├── (pre-dogfooding T1 evidence — Plan 06-01 체크리스트 슬롯)
│   ├── cold-launch.png               ← Plan 06-01 C-4
│   ├── ios-safari-public-board.png   ← Plan 06-01 E-1
│   ├── kakao-og-preview.png          ← Plan 06-01 E-3 (본인 카톡 — 친구와 별개)
│   ├── maps-static-api-enabled.png   ← Plan 06-01 B-5
│   └── ...                           (필요 시 본인이 케밥케이스로 추가)
├── friend-A/                         ← Friend A 검증 (D-15)
│   ├── 01-kakao-og.png
│   ├── 02-board-page.png
│   ├── 03-youtube-jump.png  (또는 .mp4)
│   └── meta.txt                      ← device meta (1줄당 1 키:값)
└── friend-B/
    ├── 01-kakao-og.png
    ├── 02-board-page.png
    ├── 03-youtube-jump.png  (또는 .mp4)
    └── meta.txt
```

## Naming convention

- **본인 evidence:** kebab-case 영문 + `.png` (예: `cold-launch.png`, `maps-static-api-enabled.png`)
- **친구 evidence:** `NN-<step>.png`로 prefix (정렬 보장) — `friend-share-checklist.md` 체크박스 1~3과 1-1 매핑
  - `01-kakao-og.png`       ↔ checkbox 1 (카톡 OG 카드)
  - `02-board-page.png`     ↔ checkbox 2 (보드 페이지 로드)
  - `03-youtube-jump.{png,mp4}` ↔ checkbox 3 (YouTube 영상 jump)
  - (checkbox 4 비로그인은 별도 스크린샷 X — 위 3개 중 상단에 로그인 banner 없는지로 확인)
  - (checkbox 5 피드백은 markdown 텍스트 — 스크린샷 X)
- **`meta.txt`:** 1줄당 1 키:값
  ```
  platform:iOS
  os:18.2
  browser:Safari
  locale:ko-KR
  kakao:11.4.0
  ```

## Locale labeling rules (Known Pitfall)

06-CONTEXT.md Known Pitfall "Friend device language" 대응:

- Friend의 device locale을 `meta.txt`에 반드시 기록.
- 카톡 OG 스크린샷에 한글이 깨져 보이면 (예: Pretendard 안 로드 + 시스템 폰트 fallback), locale 영향인지 server-side 문제인지 구분 가능.
- 일본어 locale 친구는 일본어 글꼴(예: Noto Sans JP) fallback → 한글이 어색해 보일 수 있으나 정상 동작 (서버 OG는 Pretendard ArrayBuffer로 embed되어 device 무관).

## What NOT to include

- 친구 실명, 카톡 ID, 전화번호, 이메일 — D-16 명시
- 다른 사람과의 카톡 채팅 내용 (보드 URL share 한 줄만 crop)
- 보드 share-slug full URL이 만약 brute-force 가능한 형태라면 redact (현 schema는 nanoid → 안전)

## Git

- 스크린샷은 `.planning/` 하위라 git에 commit됨.
- LFS는 도입 X — 친구 4개 × ~100KB이면 무시 가능.
- `meta.txt`도 commit.

---

*Screenshots layout per Phase 6 D-16. friend-A/B 폴더는 dogfooding 시점에 본인이 mkdir.*
*Document created: 2026-05-26 (Plan 06-04 Task 2)*
