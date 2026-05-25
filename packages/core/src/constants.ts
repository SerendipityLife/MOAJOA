/**
 * Domain constants for MOAJOA.
 *
 * Why centralized: limits enforced in UI, API, and Edge Functions must match.
 * Single source prevents drift.
 */

export const Limits = {
  /** Max boards per user (free tier). */
  BoardsPerUser: 20,
  /** Max links per board. */
  LinksPerBoard: 50,
  /** Max members per shared board (incl. owner). */
  MembersPerBoard: 20,
  /** Max places extracted from a single link (truncated if LLM returns more). */
  PlacesPerLink: 30,
  /** Max characters in board title. */
  BoardTitleMax: 60,
  /** Max characters in board description. */
  BoardDescMax: 280,
  /** Max characters in a vote/comment note. */
  VoteNoteMax: 140,
} as const;

/**
 * Supported source link types. Extraction strategy differs per type.
 * - youtube: auto-extract via Edge Function
 * - blog: link saved, extraction queued for ops
 * - instagram: link saved, extraction queued for ops
 * - manual: user-added place with no source link
 */
export const SourceKind = ['youtube', 'blog', 'instagram', 'manual'] as const;
export type SourceKindType = (typeof SourceKind)[number];

/**
 * Vote types on a place within a shared board.
 * 1차 MVP: single ❤️ love vote. "Confirmed" filter = places with >= 1 love.
 * (Threshold and types may evolve — see core/schemas/vote.ts.)
 */
export const VoteKind = ['love'] as const;
export type VoteKindType = (typeof VoteKind)[number];

/**
 * Board sharing modes.
 * - private: only owner can view
 * - shared: invited members can view/edit/vote (collaborative)
 * - public: anyone with link can view (read-only, requires login to copy)
 */
export const BoardVisibility = ['private', 'shared', 'public'] as const;
export type BoardVisibilityType = (typeof BoardVisibility)[number];

/**
 * Membership roles for shared boards.
 * - owner: full control, deletion rights
 * - editor: add links/places, edit metadata, vote
 * - voter: vote only
 */
export const MemberRole = ['owner', 'editor', 'voter'] as const;
export type MemberRoleType = (typeof MemberRole)[number];

/**
 * Link extraction status.
 * - pending: queued for processing
 * - processing: Edge Function or ops actively working
 * - ready: places extracted and stored
 * - failed: extraction failed (see error_message)
 * - manual_review: low confidence; ops staff queued
 */
export const ExtractionStatus = [
  'pending',
  'processing',
  'ready',
  'failed',
  'manual_review',
] as const;
export type ExtractionStatusType = (typeof ExtractionStatus)[number];

/**
 * Realtime Broadcast channel prefix. Server broadcasts to `extract:{link_id}`,
 * clients subscribe to same. Shared to prevent channel name mismatch.
 */
export const EXTRACT_CHANNEL_PREFIX = 'extract:';

/**
 * Origin of a place pin.
 * - 'ai': auto-extracted by Edge Function
 * - 'manual': user-added
 */
export const PlaceSourceKind = ['ai', 'manual'] as const;
export type PlaceSourceKindType = (typeof PlaceSourceKind)[number];

/**
 * Broadcast step names for extraction progress (D-02).
 * Clients display progress based on these steps.
 */
export const ExtractionStep = [
  'metadata',
  'transcript',
  'llm',
  'places',
  'done',
  'error',
] as const;
export type ExtractionStepType = (typeof ExtractionStep)[number];

/**
 * iOS App Group identifier shared between the main app target and the
 * Share Extension target. MUST exactly match:
 *   - apps/ios/app.config.ts entitlements + plugin option (Plan 03-02)
 *   - apps/ios/ios/MOAJOA.entitlements after prebuild
 *   - SharedDefaults(suiteName: APP_GROUP_ID) in Swift (Plan 03-04)
 *
 * Mismatch = silent nil from UserDefaults — no error, just data loss
 * (Phase 3 RESEARCH Pitfall 2).
 */
export const APP_GROUP_ID = 'group.com.serendipitylife.moajoa' as const;

/**
 * Keys written to App Group SharedDefaults. Single source of truth so
 * Share Extension Swift code and main-app TS code never drift.
 */
export const SharedDefaultsKeys = {
  /** JSON array of {url, board_id, queued_at, retry_count} — D-05. */
  PendingLinks: 'pending_links',
  /** JSON array of {...PendingLink, failed_at, reason} — D-06 (retry_count > 3). */
  PendingLinksFailed: 'pending_links_failed',
  /** UUID string — last board the user saved to. Used by Share Extension default. */
  LastBoardId: 'last_board_id',
  /** Boolean string ('1' / '0') — Share Extension uses this to decide D-03 fallback. */
  AuthStatus: 'auth_status',
} as const;

/**
 * Supabase Realtime channel name builder for extraction broadcast.
 * Phase 2 sends; Phase 3 subscribes.
 */
export function extractChannelName(linkId: string): string {
  return `extract:${linkId}`;
}

/**
 * city_code → Korean display name (ko-KR only — I18N-01 v2).
 * Shared between web (OG image, meta description) and iOS.
 * Per Phase 4 CONTEXT D-09 + UI-SPEC §"Open Items".
 *
 * If a board's city_code is missing from this map, callers should gracefully
 * omit the city line (per D-09 "city 없으면 omit").
 */
export const CITY_KO_MAP: Readonly<Record<string, string>> = {
  tokyo: '도쿄',
  osaka: '오사카',
  kyoto: '교토',
  seoul: '서울',
  busan: '부산',
  jeju: '제주',
  fukuoka: '후쿠오카',
  sapporo: '삿포로',
  okinawa: '오키나와',
} as const;
