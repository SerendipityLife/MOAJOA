import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TripMessage } from '@moajoa/core';

// --- @/components seam (mock BEFORE importing MoaChat, moa-island.test idiom). ---
// Chip → passthrough button so #N 장소명 renders as clickable text; useToast → spy.
const toast = vi.fn();
vi.mock('@/components', () => ({
  useToast: () => ({ toast }),
  Chip: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

import { MoaChat, type MoaChatProps } from '@/app/moa/[id]/_components/moa-chat';

// jsdom does not implement scrollIntoView — the auto-scroll effect calls it.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => {
  toast.mockClear();
});

const ME = 'user-me';
const OTHER = 'user-other';

function msg(over: Partial<TripMessage> = {}): TripMessage {
  return {
    id: 'm1',
    trip_id: 't1',
    user_id: OTHER,
    nickname: '지수',
    body: '안녕하세요',
    reply_to_place_id: null,
    created_at: new Date().toISOString(),
    ...over,
  };
}

function renderChat(over: Partial<MoaChatProps> = {}) {
  const props: MoaChatProps = {
    messages: [],
    currentUserId: ME,
    viewers: 0,
    onSend: vi.fn(async () => {}),
    replyToPlaceId: null,
    onClearReply: vi.fn(),
    placesById: {},
    onChipTap: vi.fn(),
    ...over,
  };
  return { props, ...render(<MoaChat {...props} />) };
}

describe('MoaChat', () => {
  it('renders a message body + nickname; mine aligns end, other aligns start', () => {
    renderChat({
      messages: [
        msg({ id: 'a', user_id: OTHER, nickname: '지수', body: '반가워요' }),
        msg({ id: 'b', user_id: ME, nickname: '나', body: '저도요' }),
      ],
    });
    expect(screen.getByText('반가워요')).toBeInTheDocument();
    expect(screen.getByText('지수')).toBeInTheDocument();

    const otherLi = screen.getByText('반가워요').closest('li')!;
    const mineLi = screen.getByText('저도요').closest('li')!;
    expect(otherLi.className).toContain('justify-start');
    expect(mineLi.className).toContain('justify-end');
  });

  it('type + 보내기 → onSend called once with (trimmed, replyToPlaceId); input clears', async () => {
    const onSend = vi.fn(async () => {});
    renderChat({ onSend, replyToPlaceId: null });

    const input = screen.getByPlaceholderText('메시지 남기기') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  하이  ' } });
    fireEvent.click(screen.getByText('보내기'));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend).toHaveBeenCalledWith('하이', null);
    await waitFor(() => expect(input.value).toBe(''));
  });

  it('Enter also sends; passes replyToPlaceId through', async () => {
    const onSend = vi.fn(async () => {});
    renderChat({ onSend, replyToPlaceId: 'p9', placesById: { p9: { seqNo: 9, name: '스벅' } } });

    const input = screen.getByPlaceholderText('메시지 남기기') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '거기 좋아요' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(onSend).toHaveBeenCalledWith('거기 좋아요', 'p9'));
  });

  it('Enter during IME composition does NOT send (한글 조합 확정)', async () => {
    const onSend = vi.fn(async () => {});
    renderChat({ onSend, replyToPlaceId: null });

    const input = screen.getByPlaceholderText('메시지 남기기') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '안녕' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    await Promise.resolve();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('onSend rejects → draft restored + error toast', async () => {
    const onSend = vi.fn(async () => {
      throw new Error('fail');
    });
    renderChat({ onSend });

    const input = screen.getByPlaceholderText('메시지 남기기') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '다시' } });
    fireEvent.click(screen.getByText('보내기'));

    await waitFor(() => expect(input.value).toBe('다시'));
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('보내지 못했'), { variant: 'error' });
  });

  it('viewers=2 → "지금 2명 보는 중"; viewers=0 → strip absent', () => {
    const { unmount } = renderChat({ viewers: 2 });
    expect(screen.getByText('지금 2명 보는 중')).toBeInTheDocument();
    unmount();

    renderChat({ viewers: 0 });
    expect(screen.queryByText(/보는 중/)).not.toBeInTheDocument();
  });

  it('message with resolvable reply_to_place_id → #N 장소명 chip; click → onChipTap(placeId)', () => {
    const onChipTap = vi.fn();
    renderChat({
      messages: [msg({ id: 'a', reply_to_place_id: 'p3', body: '여기 어때' })],
      placesById: { p3: { seqNo: 3, name: '홍대 카페' } },
      onChipTap,
    });
    const chip = screen.getByText('#3 홍대 카페');
    expect(chip).toBeInTheDocument();
    fireEvent.click(chip);
    expect(onChipTap).toHaveBeenCalledWith('p3');
  });

  it('unresolvable reply_to_place_id → no chip', () => {
    renderChat({
      messages: [msg({ id: 'a', reply_to_place_id: 'gone', body: '삭제된 장소' })],
      placesById: {},
    });
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
  });

  it('replyToPlaceId set → reply banner shows #N 장소명; x → onClearReply', () => {
    const onClearReply = vi.fn();
    renderChat({
      replyToPlaceId: 'p5',
      placesById: { p5: { seqNo: 5, name: '남산타워' } },
      onClearReply,
    });
    expect(screen.getByText(/답장 · #5 남산타워/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('답장 취소'));
    expect(onClearReply).toHaveBeenCalledTimes(1);
  });

  it('empty messages → empty-state prompt', () => {
    renderChat({ messages: [] });
    expect(screen.getByText(/첫 메시지를 남겨보세요/)).toBeInTheDocument();
  });
});
