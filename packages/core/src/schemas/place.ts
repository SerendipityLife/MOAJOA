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

  /** User notes attached after adding. */
  note: z.string().max(500).nullable(),

  /** Soft delete: hide from board but keep for vote history. */
  hidden_at: z.string().datetime().nullable(),

  created_at: z.string().datetime(),
});

export type Place = z.infer<typeof PlaceSchema>;

/** For manual user place additions via Places Autocomplete. */
export const PlaceAddManualSchema = z.object({
  board_id: z.string().uuid(),
  google_place_id: z.string().min(1),
  note: z.string().max(500).optional(),
});

export type PlaceAddManual = z.infer<typeof PlaceAddManualSchema>;

/** Extracted place candidate from LLM, before Places API resolution. */
export const ExtractedPlaceCandidateSchema = z.object({
  name_local: z.string().min(1).max(200),
  name_ko: z.string().max(200).optional(),
  source_timestamp_sec: z.number().int().nonnegative().optional(),
  source_quote: z.string().max(500).optional(),
  /** LLM's confidence 0-1 that this is a real place. */
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ExtractedPlaceCandidate = z.infer<typeof ExtractedPlaceCandidateSchema>;

export const ExtractedPlacesPayloadSchema = z.object({
  places: z.array(ExtractedPlaceCandidateSchema).max(Limits.PlacesPerLink),
});

export type ExtractedPlacesPayload = z.infer<typeof ExtractedPlacesPayloadSchema>;
