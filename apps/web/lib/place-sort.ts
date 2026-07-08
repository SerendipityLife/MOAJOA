/** MOA-02 — 찜 desc, 동률 seq_no asc. 정렬은 배열 순서만 바꾼다.
 *  순번 배지는 항상 place.seq_no 표기 — 정렬 인덱스 넘버링 금지 (Pitfall 9). */
export function sortByLove<T extends { id: string; seq_no: number }>(
  places: T[],
  loveCounts: Record<string, number>,
): T[] {
  return [...places].sort(
    (a, b) => (loveCounts[b.id] ?? 0) - (loveCounts[a.id] ?? 0) || a.seq_no - b.seq_no,
  );
}
