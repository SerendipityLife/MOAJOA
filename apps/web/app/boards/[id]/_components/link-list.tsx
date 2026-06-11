import type { Link as LinkRow } from '@moajoa/core';
import { cn } from '@/lib/cn';
import { RetryExtractionButton } from './retry-extraction-button';

const STATUS_LABEL: Record<LinkRow['extraction_status'], string> = {
  pending: '대기 중',
  processing: '분석 중...',
  ready: '완료',
  failed: '실패',
  manual_review: '검토 필요',
};

// Colored dot + text per extraction state — processing pulses to read as live.
const STATUS_STYLE: Record<
  LinkRow['extraction_status'],
  { text: string; dot: string }
> = {
  pending: { text: 'text-neutral-500', dot: 'bg-neutral-400' },
  processing: { text: 'text-info', dot: 'bg-info animate-pulse' },
  ready: { text: 'text-success', dot: 'bg-success' },
  failed: { text: 'text-danger', dot: 'bg-danger' },
  manual_review: { text: 'text-warning', dot: 'bg-warning' },
};

const KIND_LABEL: Record<LinkRow['source_kind'], string> = {
  youtube: '유튜브',
  blog: '블로그',
  instagram: '인스타',
  manual: '수동',
};

export function LinkList({ links }: { links: LinkRow[] }) {
  if (links.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-10 text-center">
        <p className="text-sm leading-relaxed text-neutral-500">
          링크를 추가하면 영상 속 장소가
          <br />
          자동으로 추출됩니다.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {links.map((link, i) => {
        const st = STATUS_STYLE[link.extraction_status];
        return (
          <li
            key={link.id}
            className="animate-fade-up flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3 transition-colors hover:border-brand-200"
            style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
          >
            {link.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={link.thumbnail_url}
                alt=""
                className="h-12 w-20 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="h-12 w-20 shrink-0 rounded-lg bg-neutral-100" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">
                {link.title ?? link.url}
              </p>
              <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-neutral-500">
                <span className="shrink-0">{KIND_LABEL[link.source_kind]}</span>
                <span className="shrink-0 text-neutral-300">·</span>
                <span
                  className={cn('inline-flex shrink-0 items-center gap-1', st.text)}
                >
                  <span className={cn('size-1.5 rounded-full', st.dot)} />
                  {STATUS_LABEL[link.extraction_status]}
                </span>
                {link.author_name && (
                  <>
                    <span className="shrink-0 text-neutral-300">·</span>
                    <span className="min-w-0 truncate">{link.author_name}</span>
                  </>
                )}
              </div>
            </div>
            {link.source_kind === 'youtube' &&
              link.extraction_status !== 'processing' &&
              link.extraction_status !== 'ready' && (
                <RetryExtractionButton linkId={link.id} />
              )}
          </li>
        );
      })}
    </ul>
  );
}
