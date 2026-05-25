# Phase 2: Extraction Pipeline Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 02-extraction-pipeline-hardening
**Areas discussed:** Realtime broadcast, Citation 강제, 컬럼 매핑, 비용 로깅, FieldMask 검증, Billing alert

---

## Discussion Flow

사용자가 4개 회색지대(Realtime broadcast 방식, Citation 강제 + 컬럼 매핑, 비용 로깅 설계, Billing alert 검증 방법)를 제시받고 "Extract-01 ~ 06에서 해야할건 다 하자"로 응답. 전체 영역을 Claude 재량으로 결정하고 진행하기로 함.

## Claude's Discretion

사용자가 전체 결정을 위임. 코드베이스 분석 기반으로 14개 결정(D-01~D-14)을 도출:

- **Realtime:** Broadcast channel.send() 방식 채택 (DB polling 아닌 push)
- **Citation:** source_quote required + 후처리 필터링 (Zod parse 전체 실패 방지)
- **컬럼:** 기존 source_timestamp_sec/source_quote 유지 + source_kind/inferred_city 추가 (rename 없음)
- **비용:** API 호출 단위 1행, provider별 분리, link_id로 영상당 집계
- **FieldMask:** 이미 적용됨 (grep 검증만)
- **Billing alert:** 수동 GCP Console 설정 + 문서화

## Deferred Ideas

- EXTRACT-07 baseline 측정 → Phase 6
- 비용 대시보드 UI → 별도 phase
- 블로그·인스타 추출 → v2
