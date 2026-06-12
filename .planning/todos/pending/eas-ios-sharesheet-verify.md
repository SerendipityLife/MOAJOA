---
created: 2026-06-12
priority: medium
source: SESSION-NOTES-2026-06-12 §4-2c
---

# [실기기] iOS share-sheet 추출 트리거 검증 (v1.1 잔여)

09-05 human checkpoint의 유일한 미완 leg. 시뮬레이터에 share extension이 없어 시뮬레이터로는 불가.

## 절차
1. `eas login` 상태 확인 (Apple Developer 계정 $99/yr 가입됨)
2. `cd apps/ios && eas build -p ios --profile development`
   - 폰 UDID 미등록이면 등록 링크를 폰으로 먼저 열기
   - 빌드 ~20-30분 (클라우드, 개발 PC 근처 불필요)
3. 폰에서 빌드 링크 열어 설치
4. youtube/blog/instagram 링크를 공유시트로 MOAJOA에 던지기
5. 확인:
   - youtube/blog → extraction_status가 processing→ready로, 장소+summary_ko 생성
   - instagram → failed + 한국어 사유 (TRUST-03 failed-row UI)
   - 절대 processing에 고착 안 됨

## 이미 검증된 것 (재확인 불필요)
- 추출 파이프라인 자체: 웹 경로로 youtube 9곳/blog 10곳 라이브 PASS
- 트리거 코드(boards/[id].tsx + pending.ts): grep+tsc+jest 38/38
- drain의 blog 처리: 시뮬레이터에서 addLink까지 확인
