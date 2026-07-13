import { cn } from '@/lib/cn';

/**
 * SelectPill — Phase 28 D-04 / UI-SPEC §SelectPill 상태표.
 *
 * 대형 stadium pill: 높이 56px(터치 타깃 44px 상회) · 16px/600 중앙 정렬 ·
 * 풀폭(2열 그리드 셀을 채움). 위저드 선택지(도시·기간·동행)와 Day 선택 시트가 쓴다.
 *
 * `Chip`의 변형이 아니라 독립 컴포넌트다(A-2): Chip은 12px/500·px-3 py-1.5 소형이라
 * anatomy가 다르고, 변형을 얹으면 기존 Chip 사용처가 회귀한다.
 * 접근성 롤도 다르다 — Chip은 `aria-selected`, SelectPill은 **`aria-pressed`**(토글 버튼).
 *
 * 색은 전부 Tailwind 토큰 클래스(HC-2 — 신규 hex 리터럴 0). 선택 텍스트는 `brand-600`,
 * 테두리는 `brand-500`: brand-500 텍스트는 흰 배경 대비 3.72:1로 WCAG AA 미달이라
 * 테두리 같은 비텍스트에만 쓴다(A-3).
 *
 * 두 상태 모두 `border-2`(unselected는 transparent) — 선택 시 레이아웃 시프트 0.
 */

export interface SelectPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
}

export function SelectPill({
  selected,
  className,
  type,
  children,
  ...props
}: SelectPillProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-pressed={selected}
      className={cn(
        'inline-flex w-full min-h-14 items-center justify-center rounded-full border-2 px-4 text-base font-semibold',
        'transition-colors duration-150 ease-out active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info',
        selected
          ? 'border-brand-500 bg-white text-brand-600'
          : 'border-transparent bg-neutral-100 text-neutral-600',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
