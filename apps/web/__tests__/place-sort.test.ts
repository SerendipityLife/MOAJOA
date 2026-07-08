import { describe, expect, it } from 'vitest';
import { sortByLove } from '@/lib/place-sort';

/**
 * Pure-comparator tests for MOA-02: 찜 desc, tie → seq_no asc.
 * Sorting only reorders the array — inputs are never mutated and each element's
 * seq_no stays the original (badge numbering is always place.seq_no, Pitfall 9).
 */
describe('sortByLove', () => {
  const places = [
    { id: 'a', seq_no: 7 },
    { id: 'b', seq_no: 2 },
  ];

  it('sorts by love count descending', () => {
    const out = sortByLove(places, { a: 2, b: 5 });
    expect(out.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('ties break by seq_no ascending', () => {
    const out = sortByLove(places, { a: 3, b: 3 });
    expect(out.map((p) => p.id)).toEqual(['b', 'a']); // seq 2 before seq 7
  });

  it('treats ids missing from loveCounts as 0', () => {
    const out = sortByLove(places, { a: 1 });
    expect(out.map((p) => p.id)).toEqual(['a', 'b']); // a:1 > b:0
  });

  it('does not mutate the input array (spread copy)', () => {
    const original = [...places];
    sortByLove(places, { a: 2, b: 5 });
    expect(places).toEqual(original);
    expect(places.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('returned elements are the same object references (seq_no unchanged)', () => {
    const out = sortByLove(places, { a: 2, b: 5 });
    expect(out[0]).toBe(places[1]); // b
    expect(out[1]).toBe(places[0]); // a
    expect(out[1].seq_no).toBe(7);
  });
});
