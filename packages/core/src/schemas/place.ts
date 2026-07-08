import { z } from 'zod';
import { Limits } from '../constants';

/**
 * Place = a point on the map within a board. Either extracted from a link or
 * added manually by the user.
 *
 * Place naming convention:
 * - name_local: canonical name in destination language (ja for Tokyo, etc.)
 * - name_ko: user-facing Korean name (transliteration or translation)
 * - name_en: English name when present (Google Places gives this)
 */
export const PlaceSchema = z.object({
  id: z.string().uuid(),
  board_id: z.string().uuid(),
  /** Null when manually added without a source link. */
  link_id: z.string().uuid().nullable(),
  added_by: z.string().uuid(),

  /** Google Place ID — canonical identifier. */
  google_place_id: z.string().min(1).max(255).nullable(),

  name_local: z.string().max(200),
  name_ko: z.string().max(200).nullable(),
  name_en: z.string().max(200).nullable(),

  /** WGS84 latitude. */
  lat: z.number().min(-90).max(90),
  /** WGS84 longitude. */
  lng: z.number().min(-180).max(180),

  /** Google Places primary type, e.g. "restaurant", "cafe", "tourist_attraction". */
  category: z.string().max(60).nullable(),
  address: z.string().max(500).nullable(),
  /** Timestamp in the source video where this place is mentioned, in seconds. */
  source_timestamp_sec: z.number().int().nonnegative().nullable(),
  /** Quote from the source explaining context ("...라멘이 진짜 맛있어요"). */
  source_quote: z.string().max(500).nullable(),

  /** 1~2문장 한국어 해설 (Phase 8 EXTRACT-12). null = legacy/근거 없음. */
  summary_ko: z.string().max(500).nullable(),

  /** User notes attached after adding. */
  note: z.string().max(500).nullable(),

  /** Soft delete: hide from board but keep for vote history. */
  hidden_at: z.string().datetime().nullable(),

  /**
   * Origin of this pin (Phase 5 TRUST-01).
   * - 'ai': auto-extracted by extract-youtube Edge Function
   * - 'manual': user-added (via PinAddModal or confirmAiPlace promotion)
   *
   * Source of truth: places.source_kind column (migration 0004) + public_board_view RPC
   * (migration 0006 appended this field for web parity).
   */
  source_kind: z.enum(['ai', 'manual']),

  /**
   * LLM confidence 0..1 for AI-extracted pins (Phase 5 TRUST-04).
   * - null = manual pin OR legacy AI pin before 0006 backfill
   * - < LOW_CONFIDENCE_THRESHOLD (0.7) = low-confidence treatment (D-15)
   * - >= 0.7 = trusted AI pin
   *
   * Source of truth: places.confidence column (migration 0006) + public_board_view RPC.
   */
  confidence: z.number().min(0).max(1).nullable(),

  /**
   * Trip-scoped permanent ordinal (#1, #2…) — MOA-01.
   * Source of truth: places.seq_no column (migration 0024) — advisory-lock
   * trigger assigns it; client-supplied values are ignored (forge-proof).
   * Never reassigned: survives soft-delete/restore and hard deletes.
   */
  seq_no: z.number().int().positive(),

  created_at: z.string().datetime(),
});

export type Place = z.infer<typeof PlaceSchema>;

/** For manual user place additions via Places Autocomplete. */
export const PlaceAddManualSchema = z.object({
  board_id: z.string().uuid(),
  google_place_id: z.string().min(1),
  note: z.string().max(500).optional(),
  /** Resolved display name (EF displayName) — relayed so the RPC stores it instead of the place_id. */
  name_local: z.string().max(200).optional(),
  /** Resolved WGS84 latitude (EF location.lat) — relayed so the pin isn't dropped at 0,0. */
  lat: z.number().min(-90).max(90).optional(),
  /** Resolved WGS84 longitude (EF location.lng). */
  lng: z.number().min(-180).max(180).optional(),
  /** Resolved formatted address (EF formattedAddress). */
  address: z.string().max(500).nullable().optional(),
});

export type PlaceAddManual = z.infer<typeof PlaceAddManualSchema>;

/** Extracted place candidate from LLM, before Places API resolution. */
export const ExtractedPlaceCandidateSchema = z.object({
  name_local: z.string().min(1).max(200),
  name_ko: z.string().max(200).optional(),
  source_timestamp_sec: z.number().int().nonnegative().optional(),
  source_quote: z.string().max(500).optional(),
  summary_ko: z.string().max(500).optional(),
  /** LLM's confidence 0-1 that this is a real place. */
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ExtractedPlaceCandidate = z.infer<typeof ExtractedPlaceCandidateSchema>;

export const ExtractedPlacesPayloadSchema = z.object({
  places: z.array(ExtractedPlaceCandidateSchema).max(Limits.PlacesPerLink),
});

export type ExtractedPlacesPayload = z.infer<typeof ExtractedPlacesPayloadSchema>;

// ----- resolve-place Edge Function contract (Phase 3 SAVE-05) -----

/**
 * Request to the resolve-place Edge Function. Either `query` (free text)
 * or `{lat,lng}` (location bias) must be provided. `query` is the primary
 * mode per D-07 (text input + dropdown); lat/lng bias is for future
 * map long-press (deferred to v2).
 */
export const ResolvePlaceRequestSchema = z
  .object({
    query: z.string().min(1).max(200).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    language: z.string().min(2).max(8).default('ko'),
  })
  .refine((v) => v.query !== undefined || (v.lat !== undefined && v.lng !== undefined), {
    message: 'Either query or (lat,lng) is required',
  });

export type ResolvePlaceRequest = z.infer<typeof ResolvePlaceRequestSchema>;

/**
 * One resolved place candidate. Shape mirrors Google Places API v1
 * Text Search response with our FieldMask whitelist (D-08 + Phase 2 D-12).
 */
export const ResolvedPlaceSchema = z.object({
  google_place_id: z.string().min(1),
  displayName: z.string(),
  formattedAddress: z.string().nullable(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  primaryType: z.string().nullable(),
});

export type ResolvedPlace = z.infer<typeof ResolvedPlaceSchema>;

/** Response from resolve-place: up to 5 candidates per D-07. */
export const ResolvePlaceResponseSchema = z.object({
  places: z.array(ResolvedPlaceSchema).max(5),
});

export type ResolvePlaceResponse = z.infer<typeof ResolvePlaceResponseSchema>;
