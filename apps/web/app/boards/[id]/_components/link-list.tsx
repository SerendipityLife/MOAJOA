import type { Link as LinkRow } from '@moajoa/core';
import { RetryExtractionButton } from './retry-extraction-button';

const STATUS_LABEL: Record<LinkRow['extraction_status'], string> = {
  pending: '대기 중',
  processing: '분석 중...',
  ready: '완료',
  failed: '실패',
  manual_review: '검토 필요',
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
      <p className="text-sm text-neutral-500">
        링크를 추가하면 영상 속 장소가 자동 추출됩니다.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {links.map((link) => (
        <li
          key={link.id}
          className="p-3 border border-neutral-200 rounded-lg flex items-start gap-3"
        >
          {link.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={link.thumbnail_url}
              alt=""
              className="w-20 h-12 object-cover rounded shrink-0"
            />
          ) : (
            <div className="w-20 h-12 bg-neutral-100 rounded shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{link.title ?? link.url}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500 min-w-0">
              <span className="shrink-0">{KIND_LABEL[link.source_kind]}</span>
              <span className="shrink-0">·</span>
              <span
                className={
                  'shrink-0 ' +
                  (link.extraction_status === 'ready'
                    ? 'text-success'
                    : link.extraction_status === 'failed'
                      ? 'text-danger'
                      : 'text-neutral-500')
                }
              >
                {STATUS_LABEL[link.extraction_status]}
              </span>
              {link.author_name && (
                <>
                  <span className="shrink-0">·</span>
                  <span className="truncate min-w-0">{link.author_name}</span>
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
      ))}
    </ul>
  );
}
