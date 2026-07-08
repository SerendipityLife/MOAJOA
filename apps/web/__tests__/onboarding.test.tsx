import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// --- Mocks (import AFTER declaration) -----------------------------------
const createMoaDraft = vi.fn(async (_client: unknown, _draft: unknown) => ({ id: 'trip-1' }));
const addLink = vi.fn(async (_client: unknown, _input: { board_id: string; url: string }) => ({
  id: 'link-1',
  source_kind: 'youtube' as string,
}));
const triggerExtraction = vi.fn(async (_client: unknown, _linkId: string) => ({
  status: 'ready',
  places_extracted: 1,
  error: null,
}));
const addManualPlace = vi.fn(async (_client: unknown, _input: unknown) => ({ id: 'place-1' }));

vi.mock('@moajoa/api', () => ({
  createMoaDraft: (c: unknown, d: unknown) => createMoaDraft(c, d),
  addLink: (c: unknown, i: { board_id: string; url: string }) => addLink(c, i),
  triggerExtraction: (c: unknown, id: string) => triggerExtraction(c, id),
  addManualPlace: (c: unknown, i: unknown) => addManualPlace(c, i),
}));

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({}),
}));

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

// @/components pass-through — Chip/Button/Input as bare DOM, AddContentTabs as a
// test harness that exposes the onAddLink/onPickPlace callbacks via buttons.
vi.mock('@/components', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => {
    const { variant: _v, size: _s, ...rest } = props as Record<string, unknown>;
    return <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>;
  },
  Chip: ({
    children,
    selected: _selected,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  AddContentTabs: ({ onAddLink }: { onAddLink: (url: string) => void }) => (
    <button type="button" onClick={() => onAddLink('https://youtu.be/abc123')}>
      mock-stage-link
    </button>
  ),
  useToast: () => ({ toast: vi.fn() }),
}));

// Import AFTER mocks.
import OnboardingPage from '@/app/onboarding/page';

beforeEach(() => {
  createMoaDraft.mockClear();
  addLink.mockClear();
  triggerExtraction.mockClear();
  addManualPlace.mockClear();
  replace.mockClear();
  createMoaDraft.mockResolvedValue({ id: 'trip-1' });
  addLink.mockResolvedValue({ id: 'link-1', source_kind: 'youtube' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** step 1(도쿄)→step 2(미정)→step 3(친구)까지 진행하고 step 4에 도달. */
function advanceToSeedStep() {
  fireEvent.click(screen.getByText('도쿄'));
  fireEvent.click(screen.getByText('다음'));
  fireEvent.click(screen.getByText('아직 미정이에요'));
  fireEvent.click(screen.getByText('다음'));
  fireEvent.click(screen.getByText('친구'));
  fireEvent.click(screen.getByText('다음'));
}

describe('OnboardingPage', () => {
  it('completes the unset-date path → createMoaDraft once + router.replace (ONBOARD-03)', async () => {
    render(<OnboardingPage />);
    advanceToSeedStep();
    fireEvent.click(screen.getByText('모아 만들기'));

    await waitFor(() => expect(createMoaDraft).toHaveBeenCalledTimes(1));
    const draft = createMoaDraft.mock.calls[0]![1] as Record<string, unknown>;
    expect(draft.city_code).toBe('tokyo');
    expect(draft.start_date).toBeNull();
    expect(draft.end_date).toBeNull();
    expect(draft.companion).toBe('친구');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/moa/trip-1'));
  });

  it('stages a link then finishes → addLink + triggerExtraction (ONBOARD-05, D-03)', async () => {
    render(<OnboardingPage />);
    advanceToSeedStep();
    fireEvent.click(screen.getByText('mock-stage-link'));
    fireEvent.click(screen.getByText('모아 만들기'));

    await waitFor(() => expect(createMoaDraft).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(addLink).toHaveBeenCalledWith(expect.anything(), {
        board_id: 'trip-1',
        url: 'https://youtu.be/abc123',
      }),
    );
    await waitFor(() => expect(triggerExtraction).toHaveBeenCalledWith(expect.anything(), 'link-1'));
  });

  it('skip (건너뛰기) → no addLink/addManualPlace, createMoaDraft still called (ONBOARD-05)', async () => {
    render(<OnboardingPage />);
    advanceToSeedStep();
    fireEvent.click(screen.getByText('건너뛰기'));

    await waitFor(() => expect(createMoaDraft).toHaveBeenCalledTimes(1));
    expect(addLink).not.toHaveBeenCalled();
    expect(addManualPlace).not.toHaveBeenCalled();
  });
});
