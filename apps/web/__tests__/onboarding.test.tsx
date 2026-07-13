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

// react-day-picker 하네스 — 실제 캘린더의 날짜 그리드를 클릭해서는 상한 초과 range를
// **만들 수 없다**(DayPicker `max`가 애초에 막으므로). 그래서 캘린더를 하네스로 바꿔
// (a) `max`가 실제로 전달되는지, (b) 상한 초과 range가 흘러들어왔을 때 우리 게이트
// (canProceed·안내 카피)가 잡는지를 직접 검증한다. RDP의 `max` 동작 자체는 라이브러리
// 계약(실측 확인됨)이고, 여기서 우리가 지켜야 할 것은 **우리 쪽 배선**이다.
vi.mock('react-day-picker', () => ({
  DayPicker: ({
    max,
    onSelect,
  }: {
    max?: number;
    onSelect: (range: { from: Date; to: Date } | undefined) => void;
  }) => (
    <div data-testid="day-picker" data-max={max}>
      <button
        type="button"
        onClick={() => onSelect({ from: new Date(2026, 5, 14), to: new Date(2026, 5, 16) })}
      >
        mock-pick-3day
      </button>
      <button
        type="button"
        onClick={() => onSelect({ from: new Date(2026, 5, 1), to: new Date(2026, 6, 5) })}
      >
        mock-pick-35day
      </button>
    </div>
  ),
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
  SelectPill: ({
    children,
    selected,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) => (
    <button aria-pressed={selected} {...props}>
      {children}
    </button>
  ),
  AddContentTabs: ({ onAddLink }: { onAddLink: (url: string) => void }) => (
    <button type="button" onClick={() => onAddLink('https://youtu.be/abc123')}>
      mock-stage-link
    </button>
  ),
  useToast: () => ({ toast: vi.fn() }),
}));

// Import AFTER mocks.
import OnboardingPage from '@/app/onboarding/page';
// 상한 단일 소스 — 테스트도 리터럴 30을 쓰지 않는다.
import { Limits } from '@moajoa/core';

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
  fireEvent.click(screen.getByText('나중에 정할게요'));
  fireEvent.click(screen.getByText('다음'));
  fireEvent.click(screen.getByText('친구'));
  fireEvent.click(screen.getByText('다음'));
}

/** step 1(도쿄) → step 2까지 진행. */
function advanceToDateStep() {
  fireEvent.click(screen.getByText('도쿄'));
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

  it('gates step 2: "정확한 날짜 고르기" with no range picked keeps 다음 disabled (M-01)', () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByText('도쿄'));
    fireEvent.click(screen.getByText('다음'));
    // 캘린더만 열고 range 미선택 → 다음 비활성.
    fireEvent.click(screen.getByText('정확한 날짜 고르기'));
    const next = screen.getByText('다음') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it('creates with no seeds → no addLink/addManualPlace, createMoaDraft still called (ONBOARD-05)', async () => {
    render(<OnboardingPage />);
    advanceToSeedStep();
    fireEvent.click(screen.getByText('모아 만들기'));

    await waitFor(() => expect(createMoaDraft).toHaveBeenCalledTimes(1));
    expect(addLink).not.toHaveBeenCalled();
    expect(addManualPlace).not.toHaveBeenCalled();
  });
});

// --- Phase 28 step 2: 기간 pill 1차 + 캘린더 escape hatch (D-06 · D-07 · A-8) ------

describe('OnboardingPage — step 2 기간 (D-06/D-07)', () => {
  it('renders the 6 duration pills and no calendar up front', () => {
    render(<OnboardingPage />);
    advanceToDateStep();

    for (const label of ['당일치기', '1박 2일', '2박 3일', '3박 4일', '4박 5일', '5박 6일']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByTestId('day-picker')).toBeNull();
  });

  it('picking a duration pill enables 다음 and stores day_count on the draft (SC-2)', async () => {
    render(<OnboardingPage />);
    advanceToDateStep();
    fireEvent.click(screen.getByText('2박 3일'));

    expect((screen.getByText('다음') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByText('다음'));
    fireEvent.click(screen.getByText('친구'));
    fireEvent.click(screen.getByText('다음'));
    fireEvent.click(screen.getByText('모아 만들기'));

    await waitFor(() => expect(createMoaDraft).toHaveBeenCalledTimes(1));
    const draft = createMoaDraft.mock.calls[0]![1] as Record<string, unknown>;
    expect(draft.day_count).toBe(3);
    expect(draft.start_date).toBeNull();
    expect(draft.end_date).toBeNull();
  });

  it('"정확한 날짜 고르기" reveals the calendar (escape hatch preserved, D-07)', () => {
    render(<OnboardingPage />);
    advanceToDateStep();
    fireEvent.click(screen.getByText('정확한 날짜 고르기'));

    expect(screen.getByTestId('day-picker')).toBeTruthy();
  });

  it('caps the calendar range at Limits.TripDayCountMax (1차 방어 — 31일 이상 선택 불가)', () => {
    render(<OnboardingPage />);
    advanceToDateStep();
    fireEvent.click(screen.getByText('정확한 날짜 고르기'));

    expect(screen.getByTestId('day-picker').getAttribute('data-max')).toBe(
      String(Limits.TripDayCountMax),
    );
  });

  it('opening the calendar clears the duration pill selection (상호 배타)', () => {
    render(<OnboardingPage />);
    advanceToDateStep();
    fireEvent.click(screen.getByText('2박 3일'));
    expect(screen.getByText('2박 3일').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByText('정확한 날짜 고르기'));
    expect(screen.getByText('2박 3일').getAttribute('aria-pressed')).toBe('false');
  });

  it('an over-limit range surfaces the cap copy; an in-limit range does not', () => {
    render(<OnboardingPage />);
    advanceToDateStep();
    fireEvent.click(screen.getByText('정확한 날짜 고르기'));

    fireEvent.click(screen.getByText('mock-pick-35day'));
    expect(
      screen.getByText('여행 기간은 최대 30일까지 정할 수 있어요. 날짜를 다시 골라주세요'),
    ).toBeTruthy();

    fireEvent.click(screen.getByText('mock-pick-3day'));
    expect(
      screen.queryByText('여행 기간은 최대 30일까지 정할 수 있어요. 날짜를 다시 골라주세요'),
    ).toBeNull();
  });

  it('a calendar range derives day_count onto the draft (Pitfall 7 드리프트 0)', async () => {
    render(<OnboardingPage />);
    advanceToDateStep();
    fireEvent.click(screen.getByText('정확한 날짜 고르기'));
    fireEvent.click(screen.getByText('mock-pick-3day'));
    fireEvent.click(screen.getByText('다음'));
    fireEvent.click(screen.getByText('친구'));
    fireEvent.click(screen.getByText('다음'));
    fireEvent.click(screen.getByText('모아 만들기'));

    await waitFor(() => expect(createMoaDraft).toHaveBeenCalledTimes(1));
    const draft = createMoaDraft.mock.calls[0]![1] as Record<string, unknown>;
    expect(draft.start_date).toBe('2026-06-14');
    expect(draft.end_date).toBe('2026-06-16');
    expect(draft.day_count).toBe(3);
  });

  it('"나중에 정할게요" still passes the gate (ONBOARD-04 회귀 없음)', () => {
    render(<OnboardingPage />);
    advanceToDateStep();
    expect((screen.getByText('다음') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByText('나중에 정할게요'));
    expect((screen.getByText('다음') as HTMLButtonElement).disabled).toBe(false);
  });
});
