'use client';

import { CITY_KO_MAP } from '@moajoa/core';
import { Input, SelectPill } from '@/components';

/**
 * Step 1 — "어디로 떠나요?" (D-05). 도시 9개(CITY_KO_MAP) + "기타" 직접입력.
 * 단일 선택. 기타 선택 시 Input 노출(maxLength 20 — trips.city_code ≤20 정합).
 * 상태는 page.tsx 소유 — 이 컴포넌트는 순수 표시/콜백.
 *
 * Phase 28 D-04: 소형 Chip → 대형 `SelectPill` 2열 그리드(레퍼런스 IMG_2918).
 * 개수가 홀수면 마지막 pill이 1열만 점유한다 — 레퍼런스와 동일.
 */

const CITY_ENTRIES = Object.entries(CITY_KO_MAP);

interface StepWhereProps {
  /** 선택된 city_code (칩 코드 또는 기타 텍스트). */
  value: string | null;
  /** 기타 직접입력 모드 여부. */
  custom: boolean;
  onChange: (cityCode: string, custom: boolean) => void;
}

export function StepWhere({ value, custom, onChange }: StepWhereProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {CITY_ENTRIES.map(([code, label]) => (
          <SelectPill
            key={code}
            selected={!custom && value === code}
            onClick={() => onChange(code, false)}
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
          placeholder="도시 이름을 입력해 주세요"
          maxLength={20}
          autoFocus
        />
      )}
    </div>
  );
}
