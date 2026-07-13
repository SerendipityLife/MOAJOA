import {
  CITY_KO_MAP,
  Limits,
  TripCreateDraftSchema,
  type TripCreateDraft,
} from '@moajoa/core';
import type { DateRange } from 'react-day-picker';

/**
 * 위저드 상태 → TripCreateDraft 순수 매퍼. title 파생 규칙(재량 확정):
 *  칩 도시 = `${CITY_KO_MAP[code]} 모아` (예: "도쿄 모아"), 기타 입력 = `${입력값} 모아`.
 *  날짜는 로컬 타임존 기준 YYYY-MM-DD 포맷 (UTC 변환 금지 — 하루 시프트 버그 회피).
 *  스키마 검증이 제출 게이트 (T-24-10) — 여기서 강제한다.
 */

/**
 * 날짜 스텝의 3택 (Phase 28 D-06/D-07):
 *  - `duration` — 기간 pill로 일수만 정함 (날짜 없음)
 *  - `fixed`    — 캘린더로 정확한 날짜를 정함 (day_count는 파생)
 *  - `unset`    — 나중에 정함 (ONBOARD-04)
 */
export type DateMode = 'duration' | 'fixed' | 'unset';

/**
 * 두 날짜 사이의 **포함 일수**. 같은 날 = 1, 6/14~6/16 = 3. `to`가 없으면(캘린더에서
 * 시작일만 찍은 상태) 당일치기로 본다. `from`이 없으면 null.
 *
 * 로컬 자정으로 정규화해서 뺀다 — `fmt`와 같은 로컬 타임존 관례(UTC 변환 금지, 24-04에서
 * 잡은 하루 시프트 함정)를 깨지 않고, DST로 인한 23/25시간 하루도 반올림으로 흡수한다.
 *
 * **상한 클램프를 하지 않는다** — 35일을 고르면 35를 그대로 돌려준다. 조용히 30으로 깎으면
 * 사용자 의도를 말없이 바꾸는 것이라 금지. 상한 판정은 호출부가 `isDayCountWithinLimit`으로
 * 하고, "왜 못 고르는지"를 안내 카피로 설명한다.
 */
export function deriveDayCount(from?: Date, to?: Date): number | null {
  if (!from) return null;
  const end = to ?? from;
  const startMs = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const days = Math.round((endMs - startMs) / 86_400_000);
  return days + 1;
}

/**
 * Day 수가 상한 이내인가. 상한은 `Limits.TripDayCountMax` **단일 소스** — 0031 CHECK ·
 * core Zod · 캘린더 `max` 제약과 같은 숫자여야 장기 여행이 INSERT에서 거부되지 않는다
 * (리터럴 하드코딩 금지).
 *
 * 판정 로직은 이 한 함수뿐이다 — step-dates(안내 카피)와 page.tsx(`canProceed` 게이트)가
 * 함께 쓴다. 두 벌로 갈라지면 상한이 어긋난다.
 *
 * `null`(기간 미정)은 상한 위반이 아니므로 통과.
 */
export function isDayCountWithinLimit(dayCount: number | null): boolean {
  return dayCount === null || dayCount <= Limits.TripDayCountMax;
}

export function buildDraft(input: {
  city: string;
  cityCustom: boolean;
  dateMode: DateMode;
  /** 기간 pill로 고른 일수. 캘린더 경로에서는 range에서 파생하므로 무시된다. */
  dayCount?: number | null;
  range?: DateRange;
  companion: string | null;
}): TripCreateDraft {
  const cityLabel = input.cityCustom ? input.city : (CITY_KO_MAP[input.city] ?? input.city);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  const start =
    input.dateMode === 'fixed' && input.range?.from ? fmt(input.range.from) : null;
  const end =
    input.dateMode === 'fixed' && input.range?.from
      ? fmt(input.range.to ?? input.range.from)
      : null;

  // 정합 규칙(D-08): day_count는 항상 채운다. 캘린더로 정확한 날짜를 정하면 그 범위에서
  // **파생**시켜 함께 저장한다. EF fallback이 `day_count ?? computeDayCount(start,end)`로
  // day_count를 항상 우선하므로(28-03), 파생하지 않으면 이전 pill 값이 남아 새 날짜를
  // 무시하는 드리프트가 생긴다(Pitfall 7). 모드가 단일 진실 — stale 값은 흘리지 않는다.
  const day_count =
    input.dateMode === 'fixed'
      ? deriveDayCount(input.range?.from, input.range?.to)
      : input.dateMode === 'duration'
        ? (input.dayCount ?? null)
        : null;

  // 마지막 방어선(T-24-10): 상한 초과 day_count는 여기서 throw → INSERT가 발생하지 않는다.
  // 정상 UI 경로는 캘린더 `max`(1차) + `canProceed`(2차)가 앞단에서 막으므로 여기 오지 않는다.
  return TripCreateDraftSchema.parse({
    title: `${cityLabel} 모아`,
    city_code: input.city,
    start_date: start,
    end_date: end,
    companion: input.companion,
    day_count,
  });
}
