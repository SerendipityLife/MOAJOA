**Goal:** 추가 API 비용 0으로, 장소 카드의 카테고리 색이 (맵링크 포함) 항상 살아난다. 추출 LLM이 장소마다 coarse vibe(6택: food/cafe/nature/culture/shopping/other)를 부여하고, 맵링크 장소는 동명 LLM 후보의 vibe를 빌려오며, `places.category = primaryType ?? vibe`로 저장. iOS `vibeOf`/웹 `categoryVisual` 중복 매퍼를 `packages/core`의 단일 `placeVibe` resolver로 통일(아이콘은 클라이언트별 유지, 색 hex는 core VIBE_META 공유).
**Requirements**: EXTRACT-12
**Depends on:** Phase 14
**Plans:** 3 plans

Plans:
- [x] 15-01-PLAN.md — core 단일 resolver: placeVibe + Vibe + VIBE_META (TDD)
- [ ] 15-02-PLAN.md — Edge 추출: LLM vibe 필드 + 맵링크 vibe 매칭 + category=primaryType??vibe (deploy/UAT 게이트)
- [x] 15-03-PLAN.md — iOS/웹 클라이언트 매퍼를 core placeVibe 호출로 교체