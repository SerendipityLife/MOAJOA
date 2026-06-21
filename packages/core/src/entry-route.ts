// Pure function — unit-tested for the 0/1/N entry branch (NAV-01).
// Edge: "last trip just deleted" → lastTripId not in trips → fall back to trips[0].
export function decideEntryRoute(
  trips: { id: string }[],
  lastTripId: string | null,
): { kind: 'onboarding' } | { kind: 'trip'; tripId: string } {
  // noUncheckedIndexedAccess: capture trips[0] once; guard satisfies the type
  // checker (length checks below guarantee it is defined at runtime).
  const first = trips[0];
  if (trips.length === 0 || !first) return { kind: 'onboarding' };
  if (trips.length === 1) return { kind: 'trip', tripId: first.id };
  const last =
    lastTripId && trips.some((t) => t.id === lastTripId) ? lastTripId : first.id;
  return { kind: 'trip', tripId: last };
}
