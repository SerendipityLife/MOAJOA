'use client';

import { useState } from 'react';
import { BottomSheet, useToast } from '@/components';

interface NicknameGateSheetProps {
  open: boolean;
  /** 확정 콜백 — trim된 닉네임을 넘긴다. 익명 인증·join_moa는 GuestSurface가 소유. */
  onConfirm: (nickname: string) => void;
  onClose?: () => void;
}

/**
 * 닉네임 게이트 바텀시트 (UI-SPEC C1).
 *
 * 첫 참여 액션(찜/추가/투표) 시 뜨는 인터럽트 시트. poll-vote-island의 inline
 * 닉네임 게이트(confirmNickname L218-226 + input/CTA L370-381)를 `@/components`
 * BottomSheet로 승격 — 호스트 add/share 시트와 시각 일관(OQ-1). 중복 검증 없음
 * (D-06 — 신원은 auth.uid, 닉네임은 표시 라벨). 확정 흐름(signInAnonymously→
 * join_moa→액션 재개)은 GuestSurface가 소유하고, 여기선 trim·빈값 에러·onConfirm만.
 * 신규 hex/spacing 없음 — 토큰 클래스만.
 */
export function NicknameGateSheet({ open, onConfirm, onClose }: NicknameGateSheetProps) {
  const { toast } = useToast();
  const [nicknameDraft, setNicknameDraft] = useState('');

  function confirmNickname() {
    const trimmed = nicknameDraft.trim();
    if (!trimmed) {
      toast('닉네임을 정해야 참여할 수 있어요.', { variant: 'error' });
      return;
    }
    onConfirm(trimmed);
  }

  return (
    <BottomSheet open={open} onClose={onClose ?? (() => {})} title="닉네임을 정해주세요">
      <p className="text-sm text-neutral-600">이 이름으로 담고 투표한 게 표시돼요.</p>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={nicknameDraft}
          onChange={(e) => setNicknameDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmNickname();
          }}
          placeholder="닉네임"
          maxLength={20}
          className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-brand-300"
        />
        <button
          type="button"
          onClick={confirmNickname}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          시작하기
        </button>
      </div>
    </BottomSheet>
  );
}
