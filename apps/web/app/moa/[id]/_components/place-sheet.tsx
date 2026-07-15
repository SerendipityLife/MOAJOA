'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export type SheetAnchor = 'collapsed' | 'expanded';

export interface PlaceSheetProps {
  /** controlled — 마커 탭 시 island가 expanded로 올린다. */
  anchor: SheetAnchor;
  onAnchorChange: (a: SheetAnchor) => void;
  /** 모아 이름 + 장소 N개 (드래그 손잡이 영역). */
  header: React.ReactNode;
  /** PlaceList (expanded에서 스크롤). */
  children: React.ReactNode;
}

/**
 * PlaceSheet — /moa/[id] 지도탭 non-modal 상시 드래그 시트 (D-09).
 *
 * 기존 BottomSheet(components/bottom-sheet.tsx)는 모달(뒷막 + 닫기 콜백)이라
 * 재사용 불가 — 시각 언어만 미러한다: 28px 상단 라운드 · bg-white · 핸들 h-1.5 w-10 ·
 * snap 250ms ease-out(bounce 없음). 상시 표시(뒷막·닫기 없음),
 * 2단 앵커(collapsed ~30vh peek / expanded 85vh, A-3), 데스크톱 max-w-lg 컬럼(A-10).
 *
 * 제스처 소유권은 표면별로 배타적이다: 본문 = 스크롤 전용(overscroll-contain으로
 * document 체이닝 차단 — 안 그러면 빈 본문에서 스크롤이 페이지로 새어 fixed 지도까지
 * 같이 밀린다), 핸들·헤더 = 드래그 전용. 한 표면이 두 제스처를 겸하지 않는다.
 *
 * 드래그·snap·플릭은 jsdom에서 검증 불가 → 로컬 브라우저 UAT 항목. 계약은
 * controlled anchor prop으로 고정되어 island(24-06)이 상태만 배선하면 된다.
 */
export function PlaceSheet({ anchor, onAnchorChange, header, children }: PlaceSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // collapsed에서 화면에 남길 peek(~30vh)만큼만 보이도록 아래로 내리는 px.
  // = 시트 높이(85vh) − peek(30vh). 리사이즈에 반응해 재측정.
  const [collapsedOffset, setCollapsedOffset] = useState(0);
  // 드래그 중 live translateY(px). null이면 앵커 기반 resting transform + transition on.
  const [dragY, setDragY] = useState<number | null>(null);

  useEffect(() => {
    const measure = () => {
      const h = sheetRef.current?.getBoundingClientRect().height ?? 0;
      const peek = window.innerHeight * 0.3;
      setCollapsedOffset(Math.max(0, h - peek));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Drag bookkeeping — ref로 유지해 pointermove마다 리렌더 없이 추적.
  const drag = useRef<{
    startY: number;
    startTranslate: number;
    currentTranslate: number;
    lastDelta: number; // 마지막 이동 증분 — 플릭 방향 바이어스
    active: boolean;
  } | null>(null);

  const restingTranslate = anchor === 'expanded' ? 0 : collapsedOffset;

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const start = anchor === 'expanded' ? 0 : collapsedOffset;
      drag.current = {
        startY: e.clientY,
        startTranslate: start,
        currentTranslate: start,
        lastDelta: 0,
        active: true,
      };
      setDragY(start);
    },
    [anchor, collapsedOffset],
  );

  const moveDrag = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d?.active) return;
      const total = e.clientY - d.startY;
      const next = Math.min(collapsedOffset, Math.max(0, d.startTranslate + total));
      d.lastDelta = next - d.currentTranslate;
      d.currentTranslate = next;
      setDragY(next);
    },
    [collapsedOffset],
  );

  const endDrag = useCallback(() => {
    const d = drag.current;
    if (!d?.active) return;
    d.active = false;
    drag.current = null;
    let next: SheetAnchor;
    if (d.lastDelta > 2) next = 'collapsed'; // 아래로 플릭
    else if (d.lastDelta < -2) next = 'expanded'; // 위로 플릭
    else next = d.currentTranslate < collapsedOffset / 2 ? 'expanded' : 'collapsed';
    setDragY(null);
    onAnchorChange(next);
  }, [collapsedOffset, onAnchorChange]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div
        ref={sheetRef}
        className={cn(
          'pointer-events-auto flex h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.08)]',
          dragY === null && 'transition-transform duration-[250ms] ease-out',
        )}
        style={{ transform: `translateY(${dragY ?? restingTranslate}px)` }}
      >
        {/* 핸들 + 헤더 = 드래그 전용 표면 (시트 앵커를 바꾸는 유일한 곳). */}
        <div
          className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="flex justify-center pt-3 pb-1">
            <span className="h-1.5 w-10 rounded-full bg-neutral-300" aria-hidden />
          </div>
          <div className="px-6 pt-2 pb-3">{header}</div>
        </div>

        {/* 본문 — 스크롤 전용. overscroll-contain: 스크롤할 게 없어도 document로 체이닝 X.
            하단 여백은 fixed MoaTabBar(~74px) + iOS 홈 인디케이터 안전영역을 예약해야
            마지막 장소 카드가 탭바 뒤로 잘리지 않는다(iOS Safari: env(safe-area-inset-bottom)). */}
        <div className="flex-1 touch-pan-y overflow-y-auto overscroll-contain px-6 pb-[calc(88px+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
