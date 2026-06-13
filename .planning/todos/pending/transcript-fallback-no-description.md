---
created: 2026-06-13
priority: low
source: spikes/001-innertube-caption-tracks, spikes/002-description-maplink-resolver
blocked_on: 외부 서비스 가입/키 (supadata or OpenAI) — 또는 채택 결정
---

# 설명란에 장소가 없는 영상용 자막(transcript) 폴백

## 배경
- spike 001: 키리스 자막 확보는 **불가**. timedtext는 PoToken 요구 → 빈 응답(가정용 IP에서도). InnerTube/ANDROID/WEB_EMBEDDED 모두 captionTracks 없음.
- spike 002 + 배포된 map-link 해석으로 **창작자가 맵링크를 나열한 영상은 자막 없이도 완벽 추출**. → 자막 우선순위 대폭 하락.
- 남는 케이스: **설명란에 장소도 맵링크도 없고, 음성으로만 장소를 말하는 영상**. 이때만 자막/STT 필요.

## 선택지 (채택 결정 필요)
| 경로 | 내용 | 비용 | 블로커 |
|---|---|---|---|
| A. 서드파티 자막 API | supadata / youtube-transcript.io 등이 PoToken·Whisper를 자기 인프라에서 처리 | 월 구독(무료티어 有), 영상당 과금 | 가입 + API 키 |
| B. 오디오 → Whisper STT | 오디오 받아 직접 받아쓰기 (lilys 방식) | ~$0.09/15분 + 다운로드 인프라 | OpenAI 키 + audio fetch 경로 |

## 절차 (A 채택 시)
1. supadata 등 무료티어 가입 → 키 발급
2. `pipeline/transcript-provider.ts` 신규: 키 있으면 호출, 없으면 no-op
3. `index.ts` youtube 브랜치: timedtext 빈 값일 때만 provider 호출 → `content.bodyText`에 주입
4. 실영상(설명란 빈 영상)으로 검증: 자막 텍스트 길이 > 0, 장소 추출됨

## 검증 기준
- 설명란에 장소 없는 KR 여행영상 1개로 추출 시 placesextracted > 0
- map-link 영상에는 영향 0 (provider 호출 안 함 → 비용 0)
