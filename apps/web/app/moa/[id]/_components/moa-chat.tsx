'use client';

import { useEffect, useRef, useState } from 'react';
import type { TripMessage } from '@moajoa/core';
import { Chip, useToast } from '@/components';

/**
 * Presentational moa chat surface (CHAT-01/02/03).
 *
 * Fully controlled — the island (Plan 03/04) owns message state + the single
 * moa:{tripId} realtime channel and passes everything as props. This component
 * opens no channel/subscription and imports no data-layer package: because the
 * trip_messages INSERT binding must live in the island's pre-subscribe chain
 * (RESEARCH Q3), message state is lifted to the island — inverting poll-chat's
 * "child owns bindings" shape (copying it here would silently break live messages).
 */
export interface MoaChatProps {
  messages: TripMessage[];
  /** mine-check: m.user_id === currentUserId (authed members, not device_token). */
  currentUserId: string;
  /** CHAT-02 presence count ("지금 N명 보는 중"). */
  viewers: number;
  /** Throws → restore the draft + error toast. Island does query + append + clearReply. */
  onSend: (body: string, replyToPlaceId: string | null) => Promise<void>;
  /** CHAT-03 compose target (place being replied to), or null. */
  replyToPlaceId: string | null;
  onClearReply: () => void;
  /** Chip resolution: reply_to_place_id → #N 장소명. Unresolvable → no chip (Pitfall 9). */
  placesById: Record<string, { seqNo: number; name: string }>;
  /** CHAT-03 chip tap → island 모으기-tab nav + scroll/highlight. */
  onChipTap: (placeId: string) => void;
}

/** `방금 · N분 전 · HH:MM` relative-ish time for a chat bubble (poll-chat idiom). */
function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export function MoaChat({
  messages,
  currentUserId,
  viewers,
  onSend,
  replyToPlaceId,
  onClearReply,
  placesById,
  onChipTap,
}: MoaChatProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message (standard messenger behavior, D-10 discretion).
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft(''); // optimistic clear
    try {
      await onSend(body, replyToPlaceId);
    } catch {
      setDraft(body); // restore the unsent text
      toast('메시지를 보내지 못했어요. 다시 시도해주세요.', { variant: 'error' });
    } finally {
      setSending(false);
    }
  }

  const replyPlace = replyToPlaceId ? placesById[replyToPlaceId] : undefined;

  return (
    <div className="flex h-full flex-col">
      {/* Presence strip — "지금 N명 보는 중" (hidden at 0, singular at 1). */}
      {viewers > 0 && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
          <span>{viewers <= 1 ? '지금 보는 중' : `지금 ${viewers}명 보는 중`}</span>
        </div>
      )}

      {/* Bubble list */}
      {messages.length === 0 ? (
        <p className="flex-1 py-10 text-center text-sm text-neutral-400">
          첫 메시지를 남겨보세요 💬
        </p>
      ) : (
        <ul className="flex-1 space-y-2 overflow-y-auto">
          {messages.map((m) => {
            const mine = m.user_id === currentUserId;
            const p = m.reply_to_place_id ? placesById[m.reply_to_place_id] : undefined;
            return (
              <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'}`}>
                  {/* CHAT-03 quote chip — only when reply_to_place_id resolves (Pitfall 9). */}
                  {p && (
                    <div className={`mb-1 flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <Chip onClick={() => onChipTap(m.reply_to_place_id!)}>
                        #{p.seqNo} {p.name}
                      </Chip>
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-3 py-2 ${
                      mine ? 'bg-brand-50 text-neutral-900' : 'bg-neutral-100 text-neutral-900'
                    }`}
                  >
                    <p className="text-xs font-semibold text-neutral-500">{m.nickname}</p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{m.body}</p>
                  </div>
                  <div className={`mt-0.5 flex ${mine ? 'justify-end' : ''}`}>
                    <span className="text-[11px] text-neutral-400">{relTime(m.created_at)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div ref={endRef} />

      {/* CHAT-03 reply-compose banner — shows the target place with a clear (x). */}
      {replyPlace && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
          <span className="min-w-0 flex-1 truncate">
            답장 · #{replyPlace.seqNo} {replyPlace.name}
          </span>
          <button
            type="button"
            onClick={onClearReply}
            aria-label="답장 취소"
            className="shrink-0 text-neutral-400 transition-colors hover:text-neutral-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Compose row */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // 한글 IME 조합 중 Enter는 조합 확정용이므로 전송하지 않는다 (오전송 방지)
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send();
          }}
          placeholder="메시지 남기기"
          maxLength={140}
          disabled={sending}
          className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-brand-300 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          보내기
        </button>
      </div>
    </div>
  );
}
