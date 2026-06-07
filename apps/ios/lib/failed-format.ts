import type { FailedPendingLink } from '@/lib/pending';

/**
 * D-04: failed-queue reason → 한국어 사유 카피.
 *
 * Same shape as [id].tsx's mapErrorReason, but the reason union differs
 * (classifyError emits network/auth/api/unknown), so this is a fresh mapping
 * rather than reuse. Unknown values fall back to the catch-all so a future
 * build's reason string never blanks the badge.
 */
export function mapFailReason(reason: FailedPendingLink['reason']): string {
  switch (reason) {
    case 'network':
      return '네트워크 오류';
    case 'auth':
      return '로그인 필요';
    case 'api':
      return '서버 처리 실패';
    default:
      return '알 수 없는 오류';
  }
}

/**
 * 상대시각 포맷: "방금"(<60s) / "N분 전"(<60m) / "N시간 전"(<24h) / "N일 전".
 *
 * `now` is injectable for deterministic tests; defaults to Date.now().
 * Input is an already-typed ISO string from SharedDefaults (failed_at) — no
 * external/untrusted input, so no Zod validation needed.
 */
export function formatRelativeTime(failedAtISO: string, now: number = Date.now()): string {
  const diffMs = now - Date.parse(failedAtISO);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return '방금';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}
