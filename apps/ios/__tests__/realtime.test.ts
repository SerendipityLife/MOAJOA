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
  presenceState: jest.Mock;
  /** Handlers captured per (type, event) key, e.g. 'broadcast:progress', 'presence:sync'. */
  handlers: Record<string, (msg: { payload: unknown }) => void>;
}

let lastChannel: FakeChannel | null = null;
let lastBroadcastHandler: ((msg: { payload: unknown }) => void) | undefined;
let mockPresenceState: Record<string, unknown> = {};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: jest.fn((name: string) => {
      const ch: FakeChannel = {
        name,
        on: jest.fn(),
        subscribe: jest.fn(),
        presenceState: jest.fn(() => mockPresenceState),
        handlers: {},
      };
      ch.on.mockImplementation(
        (
          type: string,
          filter: { event?: string },
          handler: (msg: { payload: unknown }) => void,
        ) => {
          // Last-handler shim (extract/plan single-broadcast tests) + keyed capture
          // (poll multi-event tests) so the same fake serves both contracts.
          lastBroadcastHandler = handler;
          ch.handlers[`${type}:${filter?.event ?? ''}`] = handler;
          return ch;
        },
      );
      ch.subscribe.mockImplementation(() => ch);
      lastChannel = ch;
      return ch;
    }),
  },
}));

import {
  subscribeExtractProgress,
  subscribePlanProgress,
  subscribePollChannel,
} from '@/lib/realtime';

beforeEach(() => {
  lastChannel = null;
  lastBroadcastHandler = undefined;
  mockPresenceState = {};
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

// Phase 18: subscribePlanProgress is the trip-scoped sibling. Same wiring contract:
//   1. channel name is `plan:{trip_id}` (matches generate-plan broadcaster).
//   2. the 'progress' broadcast fires onProgress with the raw payload.
//   3. the returned channel === supabase.channel(...) for removeChannel cleanup.

test('subscribePlanProgress uses plan:{trip_id} channel name', () => {
  subscribePlanProgress('trip-123', () => {});
  expect(lastChannel).not.toBeNull();
  expect(lastChannel!.name).toBe('plan:trip-123');
});

test('subscribePlanProgress broadcast progress event invokes onProgress with payload', () => {
  const onProgress = jest.fn();
  subscribePlanProgress('trip-abc', onProgress);
  expect(lastBroadcastHandler).toBeDefined();
  lastBroadcastHandler!({ payload: { step: 'clustering', progress_pct: 50 } });
  expect(onProgress).toHaveBeenCalledWith({ step: 'clustering', progress_pct: 50 });
});

test('subscribePlanProgress returns the supabase channel (caller can removeChannel)', () => {
  const result = subscribePlanProgress('trip-xyz', () => {});
  expect(result).toBe(lastChannel);
});

// Phase 19: subscribePollChannel is the date-poll sibling. The single
// poll:{trip_id} channel (D-11) carries vote/comment broadcasts + presence:
//   1. channel name is `poll:{trip_id}` (pollChannelName).
//   2. the 'vote' / 'comment' broadcasts fire onEvent with kind + raw payload.
//   3. presence sync fires onEvent with kind:'presence' + the viewer count.
//   4. the returned channel === supabase.channel(...) for removeChannel cleanup.

test('subscribePollChannel uses poll:{trip_id} channel name', () => {
  subscribePollChannel('t1', () => {});
  expect(lastChannel).not.toBeNull();
  expect(lastChannel!.name).toBe('poll:t1');
});

test('subscribePollChannel vote broadcast invokes onEvent with kind:vote + payload', () => {
  const onEvent = jest.fn();
  subscribePollChannel('t1', onEvent);
  lastChannel!.handlers['broadcast:vote']!({ payload: { nickname: '윤' } });
  expect(onEvent).toHaveBeenCalledWith({ kind: 'vote', payload: { nickname: '윤' } });
});

test('subscribePollChannel comment broadcast invokes onEvent with kind:comment + payload', () => {
  const onEvent = jest.fn();
  subscribePollChannel('t1', onEvent);
  lastChannel!.handlers['broadcast:comment']!({ payload: { body: '안녕' } });
  expect(onEvent).toHaveBeenCalledWith({ kind: 'comment', payload: { body: '안녕' } });
});

test('subscribePollChannel presence sync invokes onEvent with viewer count', () => {
  const onEvent = jest.fn();
  mockPresenceState = { a: [{}], b: [{}] };
  subscribePollChannel('t1', onEvent);
  lastChannel!.handlers['presence:sync']!({ payload: {} });
  expect(onEvent).toHaveBeenCalledWith({ kind: 'presence', viewers: 2 });
});

test('subscribePollChannel returns the supabase channel (caller can removeChannel)', () => {
  const result = subscribePollChannel('t-xyz', () => {});
  expect(result).toBe(lastChannel);
});
