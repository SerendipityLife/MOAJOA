/**
 * Domain constants for MOAJOA.
 *
 * Why centralized: limits enforced in UI, API, and Edge Functions must match.
 * Single source prevents drift.
 */

export const Limits = {
  /** Max trips per user (free tier). */
  TripsPerUser: 20,
  /** Max links per board. */
  LinksPerBoard: 50,
  /** Max members per shared board (incl. owner). */
  MembersPerBoard: 20,
  /** Max places extracted from a single link (truncated if LLM returns more). */
  PlacesPerLink: 30,
  /** Max characters in trip title. */
  TripTitleMax: 60,
  /** Max characters in trip description. */
  TripDescMax: 280,
  /** Max characters in a vote/comment note. */
  VoteNoteMax: 140,
  /**
   * Max Day count for a trip's itinerary (trips.day_count, migration 0031).
   *
   * SINGLE SOURCE — this number is duplicated by necessity in exactly two other
   * places and they MUST stay equal:
   *   1. `supabase/migrations/0031_trip_day_count.sql` CHECK literal (SQL cannot
   *      import constants — its header comment records the binding)
   *   2. the 위저드 캘린더 range max 제약 (Phase 28), which imports THIS constant
   *
   * Drift is not a cosmetic bug: a legit long trip would pass Zod, reach INSERT,
   * and get rejected by the DB CHECK — 모아 생성이 통째로 실패한다. The cap also
   * bounds Claude prompt + Routes leg cost per plan (T-28-02).
   */
  TripDayCountMax: 30,
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
 * User profile gender — optional self-identification shown in "내 정보".
 */
export const Gender = ['male', 'female', 'other'] as const;
export type GenderType = (typeof Gender)[number];

/**
 * Trip sharing modes.
 * - private: only owner can view
 * - shared: invited members can view/edit/vote (collaborative)
 * - public: anyone with link can view (read-only, requires login to copy)
 */
export const TripVisibility = ['private', 'shared', 'public'] as const;
export type TripVisibilityType = (typeof TripVisibility)[number];

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
export const ExtractionStep = ['metadata', 'transcript', 'llm', 'places', 'done', 'error'] as const;
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

/**
 * Phase 5 — Korean fixture for broadcast step names (D-09).
 * Used by iOS step indicator overlay (TRUST-02).
 * `done` / `error` are terminal (overlay dismisses) — not in this map.
 * Single source so UI never displays raw broadcast.step strings.
 */
export const EXTRACT_STEP_KO = {
  metadata: '영상 정보 가져오는 중',
  transcript: '자막 읽는 중',
  llm: '장소 찾는 중',
  places: '지도에 표시하는 중',
} as const;

/**
 * Phase 5 — Low confidence threshold (D-15).
 * Pins with confidence < this value get the "신뢰도 낮음" treatment
 * (opacity 0.5 marker + low_confidence badge + confirm/reject actions).
 * `confidence === null` (legacy / manual pins) is NOT low confidence.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Phase 5 — AsyncStorage keys for iOS onboarding state (D-20).
 * Centralized so iOS code and any future test code share the source of truth.
 * Pattern mirrors SharedDefaultsKeys above — namespaced under `@moajoa/onboard:`.
 */
export const OnboardKeys = {
  /** '@moajoa/onboard:link_card_dismissed' — global once, all boards (D-20). */
  LinkCardDismissed: '@moajoa/onboard:link_card_dismissed',
  /** '@moajoa/onboard:walkthrough_done' — first-run tab coachmark completed. */
  WalkthroughDone: '@moajoa/onboard:walkthrough_done',
} as const;

/** AsyncStorage keys for trip state. Mirrors OnboardKeys namespace pattern. */
export const TripKeys = {
  /** UUID string — last trip the user opened (N-entry restore, NAV-01). */
  LastTripId: '@moajoa/trip:last_id',
} as const;

/**
 * Phase 19 — anon date-poll device identity. The poll device token namespaces
 * an anonymous voter so dedup (cast_date_vote upsert) is per-device. Mirrors the
 * OnboardKeys/TripKeys namespace idiom. Note: web uses the bare 'moajoa:...'
 * localStorage key shape (RESEARCH device-token snippet); centralized here so the
 * source of truth is shared.
 */
export const PollKeys = {
  /** Anonymous voter device token (localStorage). */
  DeviceToken: 'moajoa:poll_device_token',
} as const;

/** Phase 18 — Realtime Broadcast channel for plan generation progress (trip-scoped, D-02). */
export const PLAN_CHANNEL_PREFIX = 'plan:';
export function planChannelName(tripId: string): string {
  return `plan:${tripId}`;
}
/** Plan generation broadcast steps (D-02). done/error terminal (not in PLAN_STEP_KO). */
export const PlanStep = ['loading', 'clustering', 'routing', 'done', 'error'] as const;
export type PlanStepType = (typeof PlanStep)[number];
/** Korean labels for plan steps — UI never displays raw step strings. Mirror EXTRACT_STEP_KO. */
export const PLAN_STEP_KO = {
  loading: '장소 불러오기',
  clustering: '동선 짜기',
  routing: '이동시간 계산',
} as const;
/** Per-plan travel mode toggle (D-08). default = transit (일본 도시 자유여행). */
export const TravelMode = ['transit', 'walk', 'drive'] as const;
export type TravelModeType = (typeof TravelMode)[number];

/**
 * Phase 19 — Realtime Broadcast channel for a date poll (trip-scoped, mirrors
 * planChannelName). ONE public channel carries votes + comments + presence (D-11).
 * Keyed by trip_id so the host (plan tab) and anon voters (web /poll/[code])
 * subscribe to the same channel.
 */
export const POLL_CHANNEL_PREFIX = 'poll:';
export function pollChannelName(tripId: string): string {
  return `poll:${tripId}`;
}
/** Date-poll mode (D-07). range = candidate date ranges; grid = per-day availability. */
export const DatePollMode = ['range', 'grid'] as const;
export type DatePollModeType = (typeof DatePollMode)[number];
/** Per-vote availability on a candidate date/range (UI-SPEC 4b 가능/불가). */
export const DateAvailability = ['available', 'unavailable'] as const;
export type DateAvailabilityType = (typeof DateAvailability)[number];
/** Max candidate ranges a host may add in range mode. */
export const POLL_RANGE_OPTIONS_MAX = 10;
/** Max span of days a grid-mode poll window may cover. */
export const POLL_GRID_WINDOW_MAX_DAYS = 60;

/**
 * Phase 23 — trips.share_mode: what the moa share link exposes (SHARE-03).
 * - dates: date poll only → join_moa grants 'voter'
 * - places: place board only → join_moa grants 'editor'
 * - both: dates + places → join_moa grants 'editor' (D-A1)
 * Locked CHARACTER-FOR-CHARACTER to the 0025 CHECK — any drift breaks share links at runtime.
 */
export const ShareMode = ['dates', 'places', 'both'] as const;
export type ShareModeType = (typeof ShareMode)[number];

/**
 * Phase 23 — Realtime channel for the unified moa share screen (Phase 26 consumer).
 * ONE channel per screen carries presence + message + vote + place_added —
 * never open two channels for one topic (Phase 19/20 lesson). Mirrors pollChannelName.
 */
export const MOA_CHANNEL_PREFIX = 'moa:';
export function moaChannelName(tripId: string): string {
  return `moa:${tripId}`;
}
