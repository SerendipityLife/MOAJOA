'use client';

import { Input, SelectPill } from '@/components';

/**
 * Step 3 — "누구랑 가요?" (D-07). 5개(혼자/연인/친구/가족/동료) + "기타" 직접입력.
 * step-where와 동일한 pill 패턴(시각 일관성). 값은 0025 trips.companion(≤20자) 텍스트.
 * 상태는 page.tsx 소유.
 *
 * Phase 28 D-04: 소형 Chip → 대형 `SelectPill` 2열 그리드. 단일 선택 — 레퍼런스
 * IMG_2920의 "다중 선택이 가능해요"는 트리플 사양이라 채택하지 않는다(시각만 미러).
 */

const COMPANION_PRESETS = ['혼자', '연인', '친구', '가족', '동료'] as const;

interface StepWhoProps {
  /** 선택된 companion 텍스트. */
  value: string | null;
  /** 기타 직접입력 모드 여부. */
  custom: boolean;
  onChange: (companion: string, custom: boolean) => void;
}

export function StepWho({ value, custom, onChange }: StepWhoProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {COMPANION_PRESETS.map((label) => (
          <SelectPill
            key={label}
            selected={!custom && value === label}
            onClick={() => onChange(label, false)}
          >
            {label}
          </SelectPill>
        ))}
        <SelectPill selected={custom} onClick={() => onChange('', true)}>
          기타
        </SelectPill>
      </div>

      {custom && (
        <Input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value, true)}
          placeholder="누구와 함께 가나요?"
          maxLength={20}
          autoFocus
        />
      )}
    </div>
  );
}
