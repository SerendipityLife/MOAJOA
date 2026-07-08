import { CITY_KO_MAP, TripCreateDraftSchema, type TripCreateDraft } from '@moajoa/core';
import type { DateRange } from 'react-day-picker';

/**
 * 위저드 상태 → TripCreateDraft 순수 매퍼. title 파생 규칙(재량 확정):
 *  칩 도시 = `${CITY_KO_MAP[code]} 모아` (예: "도쿄 모아"), 기타 입력 = `${입력값} 모아`.
 *  날짜는 로컬 타임존 기준 YYYY-MM-DD 포맷 (UTC 변환 금지 — 하루 시프트 버그 회피).
 *  스키마 검증이 제출 게이트 (T-24-10) — 여기서 강제한다.
 */
export function buildDraft(input: {
  city: string;
  cityCustom: boolean;
  dateMode: 'fixed' | 'unset';
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
  return TripCreateDraftSchema.parse({
    title: `${cityLabel} 모아`,
    city_code: input.city,
    start_date: start,
    end_date: end,
    companion: input.companion,
  });
}
