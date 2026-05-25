// Unit test for subscribeExtractProgress (Plan 03-04 lib/realtime.ts).
//
// Why: realtime.ts is a thin wiring layer over supabase.channel().on(...).subscribe().
// The contract that matters to callers in Plan 03-05 (boards/[id].tsx subscribe
// effect) is:
//   1. The channel name is `extract:{link_id}` (matches Phase 2 broadcaster).
//   2. The 'progress' broadcast event fires the user's onProgress with the raw
//      payload (D-10 — UI decides which steps to surface).
//   3. The function returns the same channel reference supabase.channel(...)
//      returned, so callers can pass it to supabase.removeChannel(ch) in their
//      useEffect cleanup (Pitfall 5 — avoid listener leak on link_id change).
//
// Mock the supabase client BEFORE importing realtime so the SUT picks up the
// fake channel factory.

interface FakeChannel {
  name: string;
  on: jest.Mock;
  subscribe: jest.Mock;
}

let lastChannel: FakeChannel | null = null;
let lastBroadcastHandler: ((msg: { payload: unknown }) => void) | undefined;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: jest.fn((name: string) => {
      const ch: FakeChannel = {
        name,
        on: jest.fn(),
        subscribe: jest.fn(),
      };
      ch.on.mockImplementation(
        (_event: string, _filter: unknown, handler: (msg: { payload: unknown }) => void) => {
          lastBroadcastHandler = handler;
          return ch;
        },
      );
      ch.subscribe.mockImplementation(() => ch);
      lastChannel = ch;
      return ch;
    }),
  },
}));

import { subscribeExtractProgress } from '@/lib/realtime';

beforeEach(() => {
  lastChannel = null;
  lastBroadcastHandler = undefined;
});

test('subscribeExtractProgress uses extract:{link_id} channel name', () => {
  subscribeExtractProgress('link-123', () => {});
  expect(lastChannel).not.toBeNull();
  expect(lastChannel!.name).toBe('extract:link-123');
});

test('broadcast progress event invokes onProgress with payload', () => {
  const onProgress = jest.fn();
  subscribeExtractProgress('link-abc', onProgress);
  expect(lastBroadcastHandler).toBeDefined();
  lastBroadcastHandler!({ payload: { step: 'done', places_extracted: 3 } });
  expect(onProgress).toHaveBeenCalledWith({ step: 'done', places_extracted: 3 });
});

test('returned channel object is the supabase channel (caller can removeChannel)', () => {
  const result = subscribeExtractProgress('link-xyz', () => {});
  expect(result).toBe(lastChannel);
});
