import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Trip } from '@moajoa/core';

// --- @/components seam (mock BEFORE importing MoaSwitcher, moa-chat.test idiom). ---
// Radix 메뉴는 jsdom에서 포인터캡처/ResizeObserver를 요구하고 user-event는 미설치라,
// Dropdown* 을 패스스루로 통과시켜 항목 클릭을 fireEvent로 직접 친다.
const toast = vi.fn();
vi.mock('@/components', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="moa-menu">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { onSelect?: () => void }) => (
    <button role="menuitem" onClick={() => onSelect?.()} {...rest}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
  useToast: () => ({ toast }),
}));

// --- @moajoa/api seam (per-fn vi.fn wrap, add-sheet.test idiom). ---
const updateTrip = vi.fn(async (_c: unknown, _id: string, _patch: { title?: string }) => ({}));
const deleteTrip = vi.fn(async (_c: unknown, _id: string) => undefined);
vi.mock('@moajoa/api', () => ({
  updateTrip: (c: unknown, id: string, patch: { title?: string }) => updateTrip(c, id, patch),
  deleteTrip: (c: unknown, id: string) => deleteTrip(c, id),
}));

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({}),
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

// @moajoa/core는 mock하지 않는다 — TripUpdateSchema 실물 검증이 그대로 돌아야 한다.
import { MoaSwitcher } from '@/app/moa/[id]/_components/moa-switcher';

function makeTrip(over: Partial<Trip>): Trip {
  return {
    id: 't1',
    owner_id: 'u1',
    representative_id: 'u1',
    title: '도쿄 모아',
    description: null,
    visibility: 'private',
    share_slug: null,
    city_code: 'tokyo',
    start_date: null,
    end_date: null,
    cover_image_url: null,
    share_mode: null,
    companion: null,
    day_count: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...over,
  } as unknown as Trip;
}

const MOAS = [
  makeTrip({ id: 't1', title: '도쿄 모아' }),
  makeTrip({ id: 't2', title: '오사카 모아' }),
];

// 소유(u1) / 비소유(u9) 혼합 — 소유자 게이팅 검증용.
const MOAS_MIXED = [
  makeTrip({ id: 't1', title: '도쿄 모아' }),
  makeTrip({ id: 't2', title: '오사카 모아', owner_id: 'u9' }),
];

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  updateTrip.mockClear();
  deleteTrip.mockClear();
  toast.mockClear();
});

describe('MoaSwitcher — 인플레이스 모아 전환 드롭다운', () => {
  it('Test 1: 현재 모아 제목 pill + 메뉴에 내 모아 전부 + 새 모아 만들기 + 둘러보기', () => {
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" moas={MOAS} />);
    expect(screen.getByLabelText('모아 바꾸기')).toHaveTextContent('도쿄 모아');
    const menu = screen.getByTestId('moa-menu');
    expect(menu).toHaveTextContent('도쿄 모아');
    expect(menu).toHaveTextContent('오사카 모아');
    expect(screen.getByRole('menuitem', { name: '새 모아 만들기' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '둘러보기' })).toBeInTheDocument();
  });

  it('Test 2: 다른 모아 클릭 → router.push(/moa/t2) 1회', () => {
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" moas={MOAS} />);
    fireEvent.click(screen.getByRole('menuitem', { name: '오사카 모아' }));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/moa/t2');
  });

  it('Test 3: 현재 모아 클릭 → 라우팅 없이 닫힘 + 그 행에 aria-current', () => {
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" moas={MOAS} />);
    const current = screen.getByRole('menuitem', { name: '도쿄 모아' });
    expect(current).toHaveAttribute('aria-current', 'true');
    fireEvent.click(current);
    expect(push).not.toHaveBeenCalled();
  });

  it('Test 4: 둘러보기 클릭 → router.push(/discover) (리스트 페이지 소멸로 끊기는 유일 진입 보전)', () => {
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" moas={MOAS} />);
    fireEvent.click(screen.getByRole('menuitem', { name: '둘러보기' }));
    expect(push).toHaveBeenCalledWith('/discover');
  });

  it('Test 5: moas 미전달(게스트 /t) → 정적 제목 pill만, 메뉴·트리거 버튼 없음', () => {
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" />);
    expect(screen.getByText('도쿄 모아')).toBeInTheDocument();
    expect(screen.queryByTestId('moa-menu')).toBeNull();
    expect(screen.queryByLabelText('모아 바꾸기')).toBeNull();
  });
});

describe('MoaSwitcher — 소유자 전용 이름 수정·삭제', () => {
  it('Test 6: 내가 소유한 행에만 [이름 수정]·[삭제] 버튼이 뜬다', () => {
    render(
      <MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" moas={MOAS_MIXED} />,
    );
    // 소유 t1 행에만 — 비소유 t2(owner u9) 행에는 없다.
    expect(screen.getAllByLabelText('이름 수정')).toHaveLength(1);
    expect(screen.getAllByLabelText('삭제')).toHaveLength(1);
    expect(
      within(screen.getByRole('menuitem', { name: '오사카 모아' }).parentElement!).queryByLabelText(
        '이름 수정',
      ),
    ).toBeNull();
  });

  it('Test 7: 아이콘 버튼은 DropdownMenuItem의 자손이 아니다(형제) → 연필 클릭에 onSelect 미발화', () => {
    render(
      <MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" moas={MOAS_MIXED} />,
    );
    const item = screen.getByRole('menuitem', { name: '도쿄 모아' });
    // 연필이 Item의 자손이면 Radix가 selection 이벤트를 만들어 메뉴를 닫는다. 자손이 아니어야 한다.
    expect(within(item).queryByLabelText('이름 수정')).toBeNull();

    fireEvent.click(screen.getByLabelText('이름 수정'));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText('모아 이름')).toBeInTheDocument();
  });

  it('Test 8: 연필 → 인라인 입력창(현재 제목 프리필) → Enter → updateTrip + 목록·pill 즉시 반영', async () => {
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" moas={MOAS} />);
    fireEvent.click(screen.getAllByLabelText('이름 수정')[0]!);

    const input = screen.getByLabelText('모아 이름') as HTMLInputElement;
    expect(input.value).toBe('도쿄 모아');

    fireEvent.change(input, { target: { value: '새 이름' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(updateTrip).toHaveBeenCalledWith(expect.anything(), 't1', { title: '새 이름' }),
    );
    expect(screen.getByRole('menuitem', { name: '새 이름' })).toBeInTheDocument();
    expect(screen.getByLabelText('모아 바꾸기')).toHaveTextContent('새 이름');
    expect(toast).not.toHaveBeenCalled();
  });

  it('Test 9: 조합 중(isComposing) Enter는 저장으로 오인하지 않는다 (한글 IME)', () => {
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" moas={MOAS} />);
    fireEvent.click(screen.getAllByLabelText('이름 수정')[0]!);

    const input = screen.getByLabelText('모아 이름');
    fireEvent.change(input, { target: { value: '새 이름' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    expect(updateTrip).not.toHaveBeenCalled();
    expect(screen.getByLabelText('모아 이름')).toBeInTheDocument(); // 편집 유지
  });

  it('Test 10: Esc → 편집 취소, 원래 제목 복귀, updateTrip 미호출', () => {
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" moas={MOAS} />);
    fireEvent.click(screen.getAllByLabelText('이름 수정')[0]!);

    const input = screen.getByLabelText('모아 이름');
    fireEvent.change(input, { target: { value: '새 이름' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByLabelText('모아 이름')).toBeNull();
    expect(screen.getByRole('menuitem', { name: '도쿄 모아' })).toBeInTheDocument();
    expect(updateTrip).not.toHaveBeenCalled();
  });

  it('Test 11: 빈 제목(공백만) Enter → 저장하지 않고 편집만 종료', () => {
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" moas={MOAS} />);
    fireEvent.click(screen.getAllByLabelText('이름 수정')[0]!);

    const input = screen.getByLabelText('모아 이름');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(updateTrip).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('모아 이름')).toBeNull();
    expect(screen.getByRole('menuitem', { name: '도쿄 모아' })).toBeInTheDocument();
  });

  it('Test 12: 저장 실패 → 낙관적 갱신 롤백 + 에러 토스트', async () => {
    updateTrip.mockRejectedValueOnce(new Error('rls'));
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" moas={MOAS} />);
    fireEvent.click(screen.getAllByLabelText('이름 수정')[0]!);

    fireEvent.change(screen.getByLabelText('모아 이름'), { target: { value: '새 이름' } });
    fireEvent.keyDown(screen.getByLabelText('모아 이름'), { key: 'Enter' });

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('이름을 바꾸지 못했어요', { variant: 'error' }),
    );
    expect(screen.getByRole('menuitem', { name: '도쿄 모아' })).toBeInTheDocument();
  });

  it('Test 13: X → confirm 취소면 deleteTrip 미호출, 승인이면 호출 (문구에 장소 함께 사라짐 명시)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" moas={MOAS} />);

    fireEvent.click(screen.getAllByLabelText('삭제')[1]!); // t2 (현재 모아 아님)
    expect(deleteTrip).not.toHaveBeenCalled();
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('담긴 장소도 함께 사라'));

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getAllByLabelText('삭제')[1]!);
    await waitFor(() => expect(deleteTrip).toHaveBeenCalledWith(expect.anything(), 't2'));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('Test 14: 현재 열람 중인 모아 삭제 → router.push(/moa)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" moas={MOAS} />);

    fireEvent.click(screen.getAllByLabelText('삭제')[0]!); // t1 = 현재 모아
    await waitFor(() => expect(deleteTrip).toHaveBeenCalledWith(expect.anything(), 't1'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/moa'));

    confirmSpy.mockRestore();
  });

  it('Test 15: 삭제 실패 → 목록 롤백 + 에러 토스트, 이탈 없음', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteTrip.mockRejectedValueOnce(new Error('rls'));
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" currentUserId="u1" moas={MOAS} />);

    fireEvent.click(screen.getAllByLabelText('삭제')[1]!);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('삭제하지 못했어요', { variant: 'error' }),
    );
    expect(screen.getByRole('menuitem', { name: '오사카 모아' })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
