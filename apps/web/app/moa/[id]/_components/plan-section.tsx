'use client';

import type { Link, Place, Plan, PlanItem, PlanStepType, TravelModeType, Trip } from '@moajoa/core';

/** RED stub — 28-05 Task 3. 구현은 GREEN 커밋에서. */
export type PlanWithItemsView = Plan & { plan_items: PlanItem[] };

export interface PlanSectionProps {
  plan: PlanWithItemsView | null;
  places: Place[];
  links: Link[];
  trip: Trip;
  currentUserId: string;
  generating: boolean;
  planStep: PlanStepType | null;
  error: string | null;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  onGenerate: () => void;
  onSaveDuration: (dayCount: number) => void;
  onMovePlaceToDay: (placeId: string, dayIndex: number) => void;
  onMoveItemToDay: (itemId: string, placeId: string, dayIndex: number) => void;
  onMoveToPool: (itemId: string) => void;
  onTravelModeChange: (mode: TravelModeType) => void;
  onShare: () => void;
  renderPool?: (pool: Place[], onAddToPlan: (placeId: string) => void) => React.ReactNode;
}

export function PlanSection(_props: PlanSectionProps) {
  return null;
}
