# 온보딩 사진 출처

이 디렉토리의 사진 3장은 `apps/ios/assets/onboarding/` 의 **동일한 원본 바이트**이며, iOS 웰컴 화면과 웹 랜딩(`/`)이 같은 파일을 공유한다. (웹은 `public/` 에서 서빙해야 하므로 iOS 자산을 **복사**한 것 — 이동이 아니다.)

> ⚠ **경고 — 추정 2건.** 아래 `lake-photo.jpg` · `fuji-photo.jpg` 는 원 다운로드 이력이 남아 있지 않아 출처를 **확정할 수 없다**. 파일명·업로더 흔적에서 역추적한 **추정**이다.
> 랜딩은 공개 마케팅 표면이므로, **상업적 배포·유료 광고 집행 전에 반드시 아래 링크를 방문해 라이선스를 재확인**할 것. 재확인이 안 되면 교체 대상.

---

## travel-photo.jpg — **확인됨**

| 항목 | 값 |
|---|---|
| 출처 | Unsplash |
| 사진작가 | `oxana-v` |
| photo id | `qoAIlAmLJBU` |
| URL | https://unsplash.com/photos/qoAIlAmLJBU |
| 라이선스 | Unsplash License — 상업적 사용 무료, 출처 표기 불요 (그래도 여기 기록) |
| 확정도 | **확인됨** (photo id 보유) |

## lake-photo.jpg — **(추정)**

| 항목 | 값 |
|---|---|
| 출처 | **(추정)** Pixabay |
| 업로더 | **(추정)** `kanenori` |
| image id | **(추정)** `9802950` |
| 라이선스 | **(추정)** Pixabay Content License — 상업적 사용 무료, 출처 표기 불요 |
| 확정도 | **미확정** — 원 다운로드 기록 없음 |
| 재확인 방법 | https://pixabay.com/images/id-9802950/ 방문 → 썸네일이 이 파일과 동일한지 육안 대조. 불일치 시 Pixabay 역검색 또는 사진 교체 |

## fuji-photo.jpg — **(추정)**

| 항목 | 값 |
|---|---|
| 출처 | **(추정)** Pixabay |
| 단서 | 원 파일명 `fuji-2720999_1920` → Pixabay image id `2720999` 로 추정 |
| 업로더 | **불명** |
| 라이선스 | **(추정)** Pixabay Content License — 상업적 사용 무료, 출처 표기 불요 |
| 확정도 | **미확정** — 원 다운로드 기록 없음 |
| 재확인 방법 | https://pixabay.com/images/id-2720999/ 방문 → 썸네일 육안 대조. 불일치 시 사진 교체 |

---

## 사용처

- `apps/ios/app/welcome.tsx` — 웰컴 캐러셀 3슬라이드
- `apps/web/app/_components/landing-carousel.tsx` — 랜딩(`/`) 캐러셀 3슬라이드
