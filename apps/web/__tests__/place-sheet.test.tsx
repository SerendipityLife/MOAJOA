import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { PlaceSheet } from '@/app/moa/[id]/_components/place-sheet';

/**
 * PlaceSheet 제스처 소유권 계약 (QUICK-01).
 *
 * 본문 = 스크롤 전용(체이닝 차단), 핸들·헤더 = 드래그 전용.
 * 드래그 체감·snap은 jsdom 검증 불가 → 브라우저 UAT. 여기선 "누가 앵커를 바꾸는가"만 고정.
 */

// jsdom 25는 PointerEvent·setPointerCapture 미구현 — 포인터 시퀀스에 필요한 만큼만 스텁.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEventShim extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    window.PointerEvent = PointerEventShim as unknown as typeof window.PointerEvent;
  }
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const onAnchorChange = vi.fn();

beforeEach(() => {
  onAnchorChange.mockClear();
});

function renderSheet(anchor: 'collapsed' | 'expanded' = 'expanded') {
  const { container } = render(
    <PlaceSheet anchor={anchor} onAnchorChange={onAnchorChange} header={<p>도쿄 3박 4일</p>}>
      <div data-testid="body-child">아직 담은 장소가 없어요</div>
    </PlaceSheet>,
  );
  // 본문 = children의 스크롤 컨테이너. 핸들 = cursor-grab 드래그 표면.
  const body = screen.getByTestId('body-child').parentElement as HTMLElement;
  const handle = container.querySelector('.cursor-grab') as HTMLElement;
  return { body, handle };
}

/** 위로 크게 끄는 포인터 시퀀스 (드래그로 해석될 만한 이동량). */
function dragUp(el: HTMLElement) {
  fireEvent.pointerDown(el, { pointerId: 1, clientY: 500 });
  fireEvent.pointerMove(el, { pointerId: 1, clientY: 400 });
  fireEvent.pointerMove(el, { pointerId: 1, clientY: 200 });
  fireEvent.pointerUp(el, { pointerId: 1, clientY: 200 });
}

describe('PlaceSheet 제스처 소유권', () => {
  it('Test 1 (본문 = 스크롤 전용): 본문 드래그는 앵커를 바꾸지 않는다', () => {
    const { body } = renderSheet('expanded');

    dragUp(body);

    expect(onAnchorChange).not.toHaveBeenCalled();
  });

  it('Test 1b (collapsed에서도): 본문 드래그는 시트를 펴지 않는다', () => {
    const { body } = renderSheet('collapsed');

    dragUp(body);

    expect(onAnchorChange).not.toHaveBeenCalled();
  });

  it('Test 2 (핸들·헤더 = 드래그 전용): 핸들 드래그는 앵커 변경을 발화한다', () => {
    const { handle } = renderSheet('collapsed');

    dragUp(handle);

    // 최종 앵커 값은 단언하지 않는다 — jsdom은 높이가 0이라 collapsedOffset이 0.
    expect(onAnchorChange).toHaveBeenCalled();
  });

  it('Test 3 (체이닝 차단): 본문은 overscroll-contain으로 document 스크롤 체이닝을 막는다', () => {
    const { body } = renderSheet('expanded');

    expect(body.className).toContain('overscroll-contain');
    expect(body.className).toContain('overflow-y-auto');
  });
});
