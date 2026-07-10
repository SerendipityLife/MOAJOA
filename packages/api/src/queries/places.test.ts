import { describe, it, expect, vi } from 'vitest';
import { addManualPlace, hidePlace } from './places';
import type { MoajoaSupabaseClient } from '../client';
import type { PlaceAddManual } from '@moajoa/core';

// uuid v4 fixture (mirror trips.test.ts idiom).
const TRIP = '11111111-1111-4111-8111-111111111111';

function makeClient(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn(() => Promise.resolve(result));
  const client = { rpc } as unknown as MoajoaSupabaseClient;
  return { client, rpc };
}

describe('addManualPlace — forwards resolved name/coords to add_manual_place RPC', () => {
  it('threads p_name_local/p_lat/p_lng/p_address when the resolved fields are provided', async () => {
    const row = { id: 'place-1' };
    const { client, rpc } = makeClient({ data: row, error: null });
    const input: PlaceAddManual = {
      board_id: TRIP,
      google_place_id: 'gp1',
      name_local: '一蘭 道頓堀',
      lat: 34.668,
      lng: 135.501,
      address: '大阪府大阪市',
    };
    const out = await addManualPlace(client, input);
    expect(rpc).toHaveBeenCalledWith('add_manual_place', {
      p_trip_id: TRIP,
      p_google_place_id: 'gp1',
      p_note: null,
      p_name_local: '一蘭 道頓堀',
      p_lat: 34.668,
      p_lng: 135.501,
      p_address: '大阪府大阪市',
    });
    expect(out).toEqual(row);
  });

  it('passes nulls for omitted resolved fields (minimal input)', async () => {
    const { client, rpc } = makeClient({ data: { id: 'place-2' }, error: null });
    await addManualPlace(client, { board_id: TRIP, google_place_id: 'gp1' });
    expect(rpc).toHaveBeenCalledWith('add_manual_place', {
      p_trip_id: TRIP,
      p_google_place_id: 'gp1',
      p_note: null,
      p_name_local: null,
      p_lat: null,
      p_lng: null,
      p_address: null,
    });
  });

  it('throws when the mock returns { error } (house contract)', async () => {
    const { client } = makeClient({ data: null, error: { message: 'boom' } });
    await expect(
      addManualPlace(client, { board_id: TRIP, google_place_id: 'gp1' }),
    ).rejects.toBeTruthy();
  });
});

describe('hidePlace — rpc(hide_place_as_member), D-12 own-only soft-delete (T-25-08)', () => {
  it('calls rpc with p_place_id (no raw places UPDATE)', async () => {
    const { client, rpc } = makeClient({ data: null, error: null });
    await hidePlace(client, 'place-1');
    expect(rpc).toHaveBeenCalledWith('hide_place_as_member', { p_place_id: 'place-1' });
  });

  it('throws when the rpc returns { error } (non-owner hiding another place)', async () => {
    const { client } = makeClient({ data: null, error: { message: 'not authorized' } });
    await expect(hidePlace(client, 'place-1')).rejects.toBeTruthy();
  });
});
