'use client';

interface PollOption {
  id: string;
  start_date: string;
  end_date: string;
}

export interface PollGuestIslandProps {
  code: string;
  tripId: string;
  mode: 'range' | 'grid';
  status: 'open' | 'closed';
  options: PollOption[];
}

/** RED stub — GREEN에서 구현 (29-04 Task 1). */
export function PollGuestIsland(_props: PollGuestIslandProps) {
  return null;
}
