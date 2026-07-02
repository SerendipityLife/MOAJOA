import { z } from 'zod';

// Phase 20 — booking checklist contract (D-10/D-13). Pure derivation lives here so
// @moajoa/api's reconcile (20-04) only mirrors the output into the DB. Enum values are
// locked CHARACTER-FOR-CHARACTER to the 0021 booking_checklist_items CHECK constraints.

/** Checklist row kinds. stay/esim/transport are auto singletons (0021 partial unique on
 * (trip_id, kind) where source='auto'); activity keys on place_id; custom is user-added. */
export const ChecklistKind = ['stay', 'esim', 'transport', 'activity', 'custom'] as const;
export type ChecklistKindType = (typeof ChecklistKind)[number];

/** todo → clicked ('확인함', D-11 auto transition) → done (user check, D-15). */
export const ChecklistStatus = ['todo', 'clicked', 'done'] as const;
export type ChecklistStatusType = (typeof ChecklistStatus)[number];

/** auto = derived by deriveChecklistAutos; manual = user-added (D-10, untouchable). */
export const ChecklistSource = ['auto', 'manual'] as const;
export type ChecklistSourceType = (typeof ChecklistSource)[number];

/** D-10 manual-add input gate — pairs with the 0021 title CHECK (1..80). */
export const ManualItemTitleSchema = z.string().min(1).max(80);

export const ChecklistItemSchema = z.object({
  id: z.string().uuid(),
  trip_id: z.string().uuid(),
  place_id: z.string().uuid().nullable(),
  kind: z.enum(ChecklistKind),
  title: z.string().min(1).max(80),
  status: z.enum(ChecklistStatus).default('todo'),
  source: z.enum(ChecklistSource).default('auto'),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export interface DeriveChecklistAutosArgs {
  /** Region coverage from BOOKING_REGION_MAP — null means the item is not derived (D-09). */
  covered: { esimSlug: string | null; transportLabel: string | null };
  /** Current plan's bookable places (isBookableActivity-filtered by the caller). */
  bookablePlaces: Array<{ placeId: string; title: string }>;
  /** All existing checklist rows for the trip (auto AND manual — manual is read-only here). */
  existing: ChecklistItem[];
}

export interface DeriveChecklistAutosResult {
  toInsert: Array<{ kind: ChecklistKindType; place_id: string | null; title: string }>;
  toDeleteIds: string[];
}

const SINGLETON_KINDS: readonly ChecklistKindType[] = ['stay', 'esim', 'transport'];

/**
 * Pure reconcile derivation (RESEARCH Pattern 3). Computes the wanted auto set, then diffs
 * against existing AUTO rows. Two inviolable rules (D-13/D-10), enforced structurally:
 * - status 'clicked'/'done' rows are money-spent records — NEVER in toDeleteIds.
 * - source 'manual' rows are NEVER emitted (not deleted, not dedup blockers for singletons —
 *   the 0021 partial unique only guards source='auto').
 * stay is always wanted: the D-04 date-confirmed gate belongs to the caller.
 * '플랜에 없음' badge is NOT derived here — render-time via isDesynced (D-13).
 */
export function deriveChecklistAutos(
  args: DeriveChecklistAutosArgs,
): DeriveChecklistAutosResult {
  const { covered, bookablePlaces, existing } = args;

  const wantedSingletons = new Map<ChecklistKindType, string>();
  wantedSingletons.set('stay', '숙소 예약');
  if (covered.esimSlug !== null) wantedSingletons.set('esim', '여행 유심');
  if (covered.transportLabel !== null) wantedSingletons.set('transport', covered.transportLabel);

  const wantedActivities = new Map(bookablePlaces.map((p) => [p.placeId, p.title]));

  const autoRows = existing.filter((i) => i.source === 'auto');
  const haveSingletonKinds = new Set(
    autoRows.filter((i) => SINGLETON_KINDS.includes(i.kind)).map((i) => i.kind),
  );
  const haveActivityPlaceIds = new Set(
    autoRows
      .filter((i) => i.kind === 'activity' && i.place_id !== null)
      .map((i) => i.place_id as string),
  );

  const toInsert: DeriveChecklistAutosResult['toInsert'] = [];
  wantedSingletons.forEach((title, kind) => {
    if (!haveSingletonKinds.has(kind)) toInsert.push({ kind, place_id: null, title });
  });
  wantedActivities.forEach((title, placeId) => {
    if (!haveActivityPlaceIds.has(placeId)) {
      toInsert.push({ kind: 'activity', place_id: placeId, title });
    }
  });

  const toDeleteIds: string[] = [];
  for (const item of autoRows) {
    if (item.status !== 'todo') continue; // D-13: clicked/done untouchable
    if (SINGLETON_KINDS.includes(item.kind)) {
      if (!wantedSingletons.has(item.kind)) toDeleteIds.push(item.id);
    } else if (item.kind === 'activity') {
      if (item.place_id === null || !wantedActivities.has(item.place_id)) {
        toDeleteIds.push(item.id);
      }
    }
    // kind 'custom': never derived, never reconciled.
  }

  return { toInsert, toDeleteIds };
}

/** Render-time '플랜에 없음' badge predicate (D-13) — desync is computed, never stored. */
export function isDesynced(item: ChecklistItem, currentBookablePlaceIds: Set<string>): boolean {
  return (
    item.kind === 'activity' &&
    item.place_id !== null &&
    !currentBookablePlaceIds.has(item.place_id)
  );
}
