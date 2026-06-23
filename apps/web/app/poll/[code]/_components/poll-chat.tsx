'use client';

import { useEffect, useRef, useState } from 'react';
import { postComment, deleteComment } from '@moajoa/api';
import { pollChannelName } from '@moajoa/core';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { getDeviceToken } from '@/lib/device-token';
import { useToast, Dialog } from '@/components';

interface Props {
  code: string;
  tripId: string;
  status: 'open' | 'closed';
  nickname: string;
  /** Test seam: seed the thread (skips realtime subscribe). */
  initialMessages?: ChatMessage[];
}

interface ChatMessage {
  id: string;
  device_token: string;
  nickname: string;
  body: string;
  created_at: string;
}

/** `방금 · N분 전 · HH:MM` relative-ish time for a chat bubble. */
function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Flat anonymous chat thread on a poll (D-11, Phase 19).
 *
 * The thread is realtime-fan-out only: anon visitors have NO read path for prior
 * comments (date_comments grants no anon SELECT and there is no anon comment-list
 * RPC — by design, Plan 01), so the thread starts empty and fills with messages
 * posted while connected (own optimistic appends + peer comment broadcasts on the
 * shared poll:{tripId} channel). Send goes through the postComment anon RPC with an
 * optimistic append + rollback on error.
 *
 * Read-only when the poll is closed (matches Plan 01's post_poll_comment poll-open
 * gate — RESEARCH Open Q3 default).
 */
export function PollChat({ code, tripId, status, nickname, initialMessages }: Props) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null);

  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowser>['channel']> | null>(
    null,
  );

  // Subscribe a comment listener on the SHARED poll channel (broadcast fan-out).
  useEffect(() => {
    if (initialMessages) return; // test seam: skip realtime
    const client = getSupabaseBrowser();
    const channel = client.channel(pollChannelName(tripId), {
      config: { presence: { key: getDeviceToken() } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'comment' }, (msg) => {
        const c = msg.payload as ChatMessage;
        setMessages((prev) =>
          prev.some((m) => m.id === c.id) ? prev : [...prev, c],
        );
      })
      .on('broadcast', { event: 'comment_deleted' }, (msg) => {
        const { id } = msg.payload as { id: string };
        setMessages((prev) => prev.filter((m) => m.id !== id));
      })
      .subscribe();

    return () => {
      channelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [tripId, initialMessages]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    if (!nickname) {
      toast('닉네임을 입력해야 투표할 수 있어요.', { variant: 'error' });
      return;
    }
    const client = getSupabaseBrowser();
    setSending(true);
    setDraft('');
    try {
      const row = (await postComment(client, {
        code,
        deviceToken: getDeviceToken(),
        nickname,
        body,
      })) as ChatMessage;
      // Optimistic append of the server-truth row + broadcast for other viewers.
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
      channelRef.current?.send({ type: 'broadcast', event: 'comment', payload: row });
    } catch {
      setDraft(body); // restore the unsent text
      toast('메시지를 보내지 못했어요. 다시 시도해주세요.', { variant: 'error' });
    } finally {
      setSending(false);
    }
  }

  async function doDelete(msg: ChatMessage) {
    setPendingDelete(null);
    const client = getSupabaseBrowser();
    const snapshot = messages;
    setMessages((prev) => prev.filter((m) => m.id !== msg.id)); // optimistic
    try {
      await deleteComment(client, { commentId: msg.id, deviceToken: getDeviceToken() });
      channelRef.current?.send({
        type: 'broadcast',
        event: 'comment_deleted',
        payload: { id: msg.id },
      });
    } catch {
      setMessages(snapshot); // rollback
      toast('메시지를 삭제하지 못했어요. 다시 시도해주세요.', { variant: 'error' });
    }
  }

  const myToken = typeof window !== 'undefined' ? getDeviceToken() : '';

  return (
    <div className="mt-8 border-t border-neutral-200 pt-6">
      <h3 className="mb-3 text-sm font-semibold text-neutral-700">한마디</h3>

      {messages.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-400">
          첫 메시지를 남겨보세요 💬
        </p>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => {
            const mine = m.device_token === myToken;
            return (
              <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-2xl px-3 py-2 ${
                      mine ? 'bg-brand-50 text-neutral-900' : 'bg-neutral-100 text-neutral-900'
                    }`}
                  >
                    <p className="text-xs font-semibold text-neutral-500">{m.nickname}</p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{m.body}</p>
                  </div>
                  <div className={`mt-0.5 flex items-center gap-2 ${mine ? 'justify-end' : ''}`}>
                    <span className="text-[11px] text-neutral-400">{relTime(m.created_at)}</span>
                    {mine && (
                      <button
                        type="button"
                        onClick={() => setPendingDelete(m)}
                        className="text-[11px] text-neutral-400 hover:text-danger"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Compose row — hidden when the poll is closed (read-only thread). */}
      {status === 'open' ? (
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void send();
            }}
            placeholder="메시지 남기기"
            maxLength={140}
            className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-brand-300"
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
      ) : (
        <p className="mt-4 text-center text-xs text-neutral-400">
          투표가 마감되어 메시지를 남길 수 없어요
        </p>
      )}

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="이 메시지를 삭제할까요?"
        actions={[
          { label: '취소', variant: 'outline', onClick: () => setPendingDelete(null) },
          {
            label: '삭제',
            variant: 'primary',
            onClick: () => {
              if (pendingDelete) void doDelete(pendingDelete);
            },
          },
        ]}
      />
    </div>
  );
}
