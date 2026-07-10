'use client';

import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { Button, useToast } from '@/components';

/**
 * GuestPromote — 계정 승격 최소 심 (D-03, UI-SPEC C6).
 *
 * 게스트(익명 세션)가 카카오로 로그인하면 익명 `auth.uid`를 그대로 정식 계정으로
 * 전환한다(`linkIdentity`) — added_by/votes/memberships가 uid에 묶여 있어 이력이
 * 자동 보존된다(별도 병합/재소유 로직 0, Supabase 위임).
 *
 * login/page.tsx oauth() L105-115 미러 — `signInWithOAuth`를 `linkIdentity`로 교체.
 * 성공 시 브라우저가 카카오로 리다이렉트하므로 여기서 성공 처리 없음. 에러(및 Manual
 * linking 미활성 런타임 실패)만 토스트로 노출. 충돌(identity_already_exists) 상세
 * 처리·전체 승격 UX는 deferred(진입점만).
 *
 * 전제: 프로젝트 Auth Manual linking 활성화(config.toml enable_manual_linking = true
 * + 원격 대시보드 토글). 미활성 시 클릭 시점 런타임 에러 → 토스트.
 */
export function GuestPromote() {
  const { toast } = useToast();

  async function promote() {
    try {
      const { error } = await getSupabaseBrowser().auth.linkIdentity({ provider: 'kakao' });
      // 성공 시 카카오로 리다이렉트 — 아래 도달 안 함. error면 여기 남는다.
      if (error) toast(error.message, { variant: 'error' });
    } catch (err) {
      toast(err instanceof Error ? err.message : '로그인에 실패했어요', { variant: 'error' });
    }
  }

  return (
    <Button variant="outline" onClick={promote} className="w-full">
      로그인하고 내 여행에 담기
    </Button>
  );
}
