// resolve-place test suite (Deno).
//
// Phase 3 Plan 03-03 — RED phase: schemas are declared here in sync with
// packages/core/src/schemas/place.ts (Deno cannot import the workspace package
// directly without a bundle). The FIELD_MASK constant is imported from the
// implementation to guard against wildcard regressions (Phase 2 D-12 lock).

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { z } from 'npm:zod@3';

// ----- Mirror of ResolvePlaceRequestSchema (packages/core/src/schemas/place.ts) -----
const RequestSchema = z
  .object({
    query: z.string().min(1).max(200).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    language: z.string().min(2).max(8).default('ko'),
  })
  .refine((v) => v.query !== undefined || (v.lat !== undefined && v.lng !== undefined));

// ----- Mirror of ResolvedPlaceSchema (packages/core/src/schemas/place.ts) -----
const ResolvedSchema = z.object({
  google_place_id: z.string().min(1),
  displayName: z.string(),
  formattedAddress: z.string().nullable(),
  location: z.object({ lat: z.number(), lng: z.number() }),
  primaryType: z.string().nullable(),
});

// ----- Request validation -----

Deno.test('RequestSchema rejects empty body (no query, no lat/lng)', () => {
  const result = RequestSchema.safeParse({});
  assertEquals(result.success, false);
});

Deno.test('RequestSchema accepts query only', () => {
  const result = RequestSchema.safeParse({ query: 'cafe' });
  assertEquals(result.success, true);
});

Deno.test('RequestSchema accepts lat/lng without query', () => {
  const result = RequestSchema.safeParse({ lat: 35.6, lng: 139.7 });
  assertEquals(result.success, true);
});

Deno.test('RequestSchema rejects query > 200 chars', () => {
  const result = RequestSchema.safeParse({ query: 'a'.repeat(201) });
  assertEquals(result.success, false);
});

Deno.test('RequestSchema rejects empty query string', () => {
  const result = RequestSchema.safeParse({ query: '' });
  assertEquals(result.success, false);
});

// ----- FIELD_MASK guard (Phase 2 D-12 lock) -----

Deno.test('FIELD_MASK has exactly five whitelisted fields and no wildcard', async () => {
  const mod = await import('./pipeline/places-search.ts');
  assertEquals(
    mod.FIELD_MASK,
    'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType',
  );
  assert(!mod.FIELD_MASK.includes('*'), 'FieldMask must not contain wildcard (Phase 2 D-12 lock)');
});

// ----- Response shape validation -----

Deno.test('ResolvedSchema parses Google Places API v1 response shape', () => {
  const example = {
    google_place_id: 'ChIJxxxxxx',
    displayName: 'Blue Bottle Shibuya',
    formattedAddress: '도쿄도 시부야구...',
    location: { lat: 35.659, lng: 139.700 },
    primaryType: 'cafe',
  };
  const result = ResolvedSchema.safeParse(example);
  assertEquals(result.success, true);
});

Deno.test('ResolvedSchema rejects when google_place_id missing', () => {
  const example = {
    displayName: 'X',
    formattedAddress: null,
    location: { lat: 1, lng: 2 },
    primaryType: null,
  };
  const result = ResolvedSchema.safeParse(example);
  assertEquals(result.success, false);
});
