'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TripUpdateSchema, type Trip } from '@moajoa/core';
import { deleteTrip, updateTrip } from '@moajoa/api';
import { Check, ChevronDown, Pencil, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useToast,
} from '@/components';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export interface MoaSwitcherProps {
  currentTripId: string;
  title: string;
  /** 소유자 판정의 유일한 입력 — 내 모아 행에만 이름 수정·삭제 버튼을 노출한다. */
  currentUserId: string;
  /**
   * 내 모아 목록. 미전달/빈 배열이면 드롭다운 없이 정적 pill만 렌더한다 —
   * 게스트 공유뷰(/t/[slug])는 남의 모아 열람이라 갈아탈 목록이 없다.
   */
  moas?: Trip[];
}

/**
 * MoaSwitcher — 지도 좌상단 "{모아 제목} ▾" pill.
 *
 * 모아 전환에 화면 이동(지도 언마운트 → 리스트 → 다시 지도)을 강요하지 않는다.
 * pill을 누르면 내 모아 목록이 바로 아래(align=start) 열리고, 고르면 그 지도로 라우팅한다.
 * 별도 /moa 리스트 화면이 사라지므로 /discover 진입을 여기서 보전한다.
 * 스위처가 유일한 모아 목록 표면이라 이름 수정·삭제도 여기서 한다(관리 화면 없음).
 */
export function MoaSwitcher({ currentTripId, title, currentUserId, moas }: MoaSwitcherProps) {
  const router = useRouter();
  const { toast } = useToast();

  // moas는 서버(RSC) prop이라 낙관적 편집/삭제를 담을 로컬 미러가 필요하다.
  const [rows, setRows] = useState<Trip[]>(moas ?? []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  // router.refresh()로 RSC가 새 배열을 내려주면 미러를 서버 진실로 되돌린다(stale 표시 방지).
  useEffect(() => {
    setRows(moas ?? []);
  }, [moas]);

  // 좌상단 오버레이 위치·레이어는 기존 버튼과 동일. max-w-180px는 좁은 폰(375px)에서
  // 우측 [함께 정하기](right-4 top-4)와 겹치지 않는 제목 상한이다.
  // 제목은 로컬 미러에서 파생 — 리네임 직후 pill도 같이 바뀐다(정적 pill 경로는 title 폴백).
  const shownTitle = rows.find((m) => m.id === currentTripId)?.title ?? title;
  const pill = (
    <>
      <span className="max-w-[180px] truncate text-sm font-semibold text-neutral-900">
        {shownTitle}
      </span>
      <ChevronDown className="size-4 shrink-0 text-neutral-500" aria-hidden />
    </>
  );
  const pillClass =
    'absolute left-4 top-4 z-50 flex items-center gap-1 rounded-full bg-white px-3 py-2 shadow-md';

  if (!moas || moas.length === 0) {
    return <div className={pillClass}>{pill}</div>;
  }

  function onPick(id: string) {
    if (id === currentTripId) return; // 현재 모아 — 라우팅 없이 그냥 닫힌다.
    router.push(`/moa/${id}`);
  }

  function startEdit(m: Trip) {
    setEditingId(m.id);
    setDraft(m.title);
  }

  async function commitRename(m: Trip) {
    const next = draft.trim();
    setEditingId(null);
    if (!next || next === m.title) return; // 빈 제목·무변경은 저장하지 않는다.

    const prev = rows;
    setRows((r) => r.map((x) => (x.id === m.id ? ({ ...x, title: next } as Trip) : x)));
    try {
      // 외부 입력 — 길이 상한(Limits.TripTitleMax) 위반은 여기서 throw된다(CLAUDE.md §4.5).
      const patch = TripUpdateSchema.parse({ title: next });
      await updateTrip(getSupabaseBrowser(), m.id, patch);
      router.refresh();
    } catch (err) {
      console.error(err);
      setRows(prev);
      toast('이름을 바꾸지 못했어요', { variant: 'error' });
    }
  }

  function onEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>, m: Trip) {
    // Radix Menu Content는 printable key를 typeahead로 가로채 포커스를 항목으로 튕겨낸다.
    // 입력창에서 난 키가 Content까지 올라가지 않게 먼저 막아야 한글 타이핑이 정상 동작한다.
    e.stopPropagation();
    // 한글 IME 조합 확정용 Enter를 저장으로 오인하지 않는다.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitRename(m);
    } else if (e.key === 'Escape') {
      // Radix의 Escape는 document capture 리스너라 stopPropagation으로 막히지 않아
      // 메뉴도 함께 닫힌다. Esc = 취소이므로 허용한다.
      e.preventDefault();
      setEditingId(null);
    }
  }

  async function onDelete(m: Trip) {
    if (!window.confirm(`'${m.title}' 모아를 삭제할까요? 담긴 장소도 함께 사라져요.`)) return;

    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== m.id));
    try {
      await deleteTrip(getSupabaseBrowser(), m.id);
    } catch (err) {
      console.error(err);
      setRows(prev);
      toast('삭제하지 못했어요', { variant: 'error' });
      return;
    }
    // /moa는 리다이렉트 허브 — 남은 최근 모아(없으면 온보딩)로 알아서 보낸다.
    if (m.id === currentTripId) router.push('/moa');
    else router.refresh();
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) setEditingId(null); // 다음 오픈 때 입력창이 유령처럼 남지 않게.
      }}
    >
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="모아 바꾸기" className={pillClass}>
          {pill}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-56">
        {rows.map((m) => {
          const isCurrent = m.id === currentTripId;
          // 비소유 모아의 trips UPDATE/DELETE는 RLS(0016 owner full access)가 조용히 0행을
          // 반환한다 — 실패할 버튼은 아예 보여주지 않는다(UI 게이트, RLS가 최종 게이트).
          const isOwner = m.owner_id === currentUserId;

          if (editingId === m.id) {
            return (
              <div key={m.id} className="flex items-center px-2 py-1.5">
                <input
                  autoFocus
                  aria-label="모아 이름"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => onEditKeyDown(e, m)}
                  className="min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-1 text-sm"
                />
              </div>
            );
          }

          // 아이콘 버튼은 DropdownMenuItem의 **형제**다. Item 안에 넣으면 Radix onSelect가
          // 발화해 (a) 모아 라우팅이 터지고 (b) 메뉴가 닫혀 인라인 편집이 불가능해진다.
          return (
            <div key={m.id} className="flex items-center">
              <DropdownMenuItem
                className="min-w-0 flex-1"
                onSelect={() => onPick(m.id)}
                {...(isCurrent && { 'aria-current': true })}
              >
                {isCurrent ? (
                  <Check className="size-4 shrink-0 text-brand-600" aria-hidden />
                ) : (
                  <span className="size-4 shrink-0" />
                )}
                <span className="truncate">{m.title}</span>
              </DropdownMenuItem>
              {isOwner && (
                <>
                  <button
                    type="button"
                    aria-label="이름 수정"
                    className="shrink-0 rounded-md p-1.5 text-neutral-400"
                    onClick={() => startEdit(m)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="삭제"
                    className="shrink-0 rounded-md p-1.5 text-neutral-400"
                    onClick={() => void onDelete(m)}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </>
              )}
            </div>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/onboarding')}>
          새 모아 만들기
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/discover')}>둘러보기</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
