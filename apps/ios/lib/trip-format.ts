// Korean date/title formatting for the "새 여행" (new board) creation flow.
// Shared between the date picker sheet (button label) and the new-board screen
// (selected-range display + auto board title).

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Local-time YYYY-MM-DD (avoids the UTC shift that toISOString() introduces). */
export function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * "2월 14일" (single) · "2월 14일 – 17일" (same month range) ·
 * "2월 28일 – 3월 2일" (cross-month range). Empty string when no start.
 */
export function formatDateRangeKo(start: Date | null, end: Date | null): string {
  if (!start) return '';
  const s = `${start.getMonth() + 1}월 ${start.getDate()}일`;
  if (!end || isSameDay(start, end)) return s;
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${s} – ${end.getDate()}일`;
  }
  return `${s} – ${end.getMonth() + 1}월 ${end.getDate()}일`;
}

/** Auto board title: "도쿄 · 2월 14일 – 17일", or just "도쿄" when no dates. */
export function autoBoardTitle(cityKo: string, start: Date | null, end: Date | null): string {
  const range = formatDateRangeKo(start, end);
  return range ? `${cityKo} · ${range}` : cityKo;
}
