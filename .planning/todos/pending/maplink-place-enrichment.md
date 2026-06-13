---
created: 2026-06-13
priority: low
source: spikes/002-description-maplink-resolver, feat 282158f
blocked_on: GOOGLE_PLACES_SERVER_KEY로 실제 Details 응답 검증 + 비용 결정
---

# Map-link 장소 보강 (canonical place_id + address + category)

## 배경
배포된 map-link 해석은 `{name, lat, lng}` + place id를 **키 없이** 가져와 핀을 띄운다.
다만 저장되는 값에 두 갭이 있다 (`index.ts` map-link seed):
- `google_place_id` = `/g/...` 또는 `cid:0x...` — iOS `resolve-place`가 만드는 `ChIJ...`와 **형식이 달라 cross-source dedup 불가**
- `category: null`, `address: null` — Text Search 경로 장소는 채워지는데 map-link 장소는 빈 값

## 해법 (옵션, 키 있을 때만)
map-link 장소마다 Google Places **Details** 1콜 → canonical `place_id` + formattedAddress + primaryType 보강.
- 키리스 코어는 유지, 키 있으면 enrich (graceful)
- 비용: ~$0.017/place (Details). 18개 영상 ≈ $0.30/video 추가

## 결정 필요
- 이 비용을 감수할 가치가 있나? (핀은 name+coords로 이미 동작 → v1엔 불필요할 수 있음)
- 감수 시: `pipeline/places.ts`에 `getPlaceDetailsById(placeId)` 추가 → index.ts에서 map-link 장소 enrich

## 검증 기준
- Details URL 빌더 + 응답 파서 단위테스트 (mock)
- 실키로 map-link 장소 1개 enrich → place_id가 `ChIJ` 형식, address/category 채워짐
- 키 없으면 기존 keyless 동작 그대로 (회귀 0)

## 주의 (surgical)
지금 의도적으로 미구현. 검증 안 된 과금 네트워크 콜을 라이브 함수에 blind로 넣지 않기 위함.
