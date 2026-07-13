'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, RotateCcw, Share2 } from 'lucide-react';
import {
  CITY_KO_MAP,
  PLAN_STEP_KO,
  TravelMode,
  type Link,
  type Place,
  type Plan,
  type PlanItem,
  type PlanStepType,
  type TravelModeType,
  type Trip,
} from '@moajoa/core';
import { Button } from '@/components';
import { cn } from '@/lib/cn';
import { DurationGateSheet } from './duration-gate-sheet';
import { DaySelectSheet } from './day-select-sheet';

/**
 * api 패키지 `getPlanByTrip`의 반환 형태와 **구조 동치**인 뷰 타입. 그 패키지를 import하지
 * 않는 이유는 이 컴포넌트가 쿼리·mutation을 소유하지 않기 때문이다 — 구조 타이핑 덕에 island가
 * 실제 반환값을 그대로 넘길 수 있다.
 */
export type PlanWithItemsView = Plan & { plan_items: PlanItem[] };

/** 이동수단 라벨 (D-18). 기본은 transit(전철) — 일본 도시 자유여행 전제. */
const MODE_LABEL: Record<TravelModeType, string> = {
  transit: '전철',
  walk: '도보',
  drive: '차',
};

/** 이동시간 캡션. leg가 없으면 '이동시간 —'(iOS 관례 미러) — 수동 배치 직후가 그 상태다. */
function legCaption(seconds: number | null, mode: TravelModeType): string {
  if (seconds == null) return '이동시간 —';
  return `${MODE_LABEL[mode]} ${Math.max(1, Math.round(seconds / 60))}분`;
}

/** DaySelectSheet가 무엇을 옮기는 중인지 — 풀 편입이냐, 이미 배치된 항목의 Day 변경이냐. */
type MoveTarget =
  | { kind: 'pool'; placeId: string }
  | { kind: 'item'; itemId: string; placeId: string };

export interface PlanSectionProps {
  plan: PlanWithItemsView | null;
  /** hidden 제외 상태로 전달됨 (PlaceList와 동일 계약). */
  places: Place[];
  links: Link[];
  trip: Trip;
  currentUserId: string;
  /** 생성 중 — 연타 차단(유료 API 이중 지출 방지)의 단일 출처(T-28-19). */
  generating: boolean;
  planStep: PlanStepType | null;
  error: string | null;
  /** 0-based day_index. island이 소유 — 지도 핀 필터링과 같은 값을 쓴다(D-16). */
  selectedDay: number;
  onSelectDay: (day: number) => void;
  onGenerate: () => void;
  /** D-13 게이트 확정 — 저장(updateTrip) 후 생성까지는 island 몫. */
  onSaveDuration: (dayCount: number) => void;
  onMovePlaceToDay: (placeId: string, dayIndex: number) => void;
  onMoveItemToDay: (itemId: string, placeId: string, dayIndex: number) => void;
  onMoveToPool: (itemId: string) => void;
  onTravelModeChange: (mode: TravelModeType) => void;
  onShare: () => void;
  /**
   * 미배치 풀 리스트 본문(D-17). PlanSection이 pool을 파생해 넘기고, 렌더는 호출부가 한다 —
   * PlaceList의 12개 prop(찜·프로필·색·재시도…)을 이 컴포넌트가 다시 떠안지 않기 위한 seam.
   * island은 이미 그 배선을 갖고 있으므로 같은 클로저를 재사용하면 된다.
   */
  renderPool?: (pool: Place[], onAddToPlan: (placeId: string) => void) => React.ReactNode;
}

/**
 * PlanSection — `/moa/[id]` place-sheet 본문 안의 **[일정] 영역** (D-12~D-18, D-20, D-23, D-25).
 *
 * 신규 라우트도 신규 탭도 아니다(D-15/HC-4) — 기존 시트의 children으로 들어간다.
 * iOS `plan.tsx`의 상태기계 A~E를 웹으로 이식했지만 **iOS 파일은 읽기 전용 참고**일 뿐
 * 복사·import 대상이 아니다(v2.1 전면 동결).
 *
 * **props-driven 프레젠테이션이다** — 상태·mutation·realtime은 moa-island(28-06)가 소유하고,
 * 여기서 갖는 로컬 상태는 시트 열림/닫힘·이동수단 변경 여부 같은 **순수 UI 상태**뿐이다.
 * 쿼리 0: Day 버킷·미배치 풀은 전부 props에서 클라 파생한다(별도 테이블·요청 없음).
 *
 * ⚠ **제스처 소유권(HC-5 — 회귀 최상위 위험).** Day 탭 스트립은 시트 **본문 스크롤 영역 안**의
 * sticky 가로 스크롤러다(가로 팬만 허용). 포인터 이벤트 핸들러·포인터 캡처·
 * 터치 완전 차단 클래스를 절대 얹지 않는다 — 셋 중 하나라도 들어가면 시트 드래그와 페이지
 * 핀치줌이 회귀한다(커밋 3f32204가 청산한 버그). `place-sheet.tsx`는 한 줄도 수정하지 않는다.
 * 소유권: 가로 스와이프=Day 스트립 · 세로 스크롤=시트 본문 · 앵커 드래그=핸들/헤더 · 팬줌=지도.
 * **한 표면이 두 제스처를 겸하지 않는다.**
 */
export function PlanSection({
  plan,
  places,
  links,
  trip,
  currentUserId,
  generating,
  planStep,
  error,
  selectedDay,
  onSelectDay,
  onGenerate,
  onSaveDuration,
  onMovePlaceToDay,
  onMoveItemToDay,
  onMoveToPool,
  onTravelModeChange,
  onShare,
  renderPool,
}: PlanSectionProps) {
  // 순수 UI 상태만 로컬 소유.
  const [gateOpen, setGateOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [modeChanged, setModeChanged] = useState(false);

  // 상태 A — 장소가 없으면 [일정] 섹션 자체가 없다. 기존 PlaceList 빈 상태만 남는다.
  if (places.length === 0) return null;

  // D-14 추출 대기 게이트: place-list의 판별식을 그대로 재사용한다(manual은 추출 대상이 아님).
  // 추출이 끝나면 links UPDATE → island reconcile로 자동 활성화되므로 신규 realtime 배선이 0이다.
  const analyzingCount = links.filter(
    (l) =>
      l.source_kind !== 'manual' &&
      (l.extraction_status === 'pending' || l.extraction_status === 'processing'),
  ).length;

  // D-13 기간 미정: day_count·start_date가 **둘 다** null일 때만. 1일 기본 생성을 하지 않는다.
  const durationUnset = trip.day_count == null && trip.start_date == null;
  const isOwner = currentUserId === trip.owner_id;
  // A-9: trips UPDATE RLS가 owner 전용(0016)이라 editor의 day_count 저장은 조용히 실패한다.
  // UI에서 먼저 막고(여기), DB가 최종 방어한다 — 심층방어 2겹(T-28-18).
  const gateBlocked = durationUnset && !isOwner;

  // Day 수 = max(trip.day_count, max(day_index)+1).
  //
  // 왜 trip.day_count를 함께 보나: max(day_index)+1만 쓰면 사용자가 5박 6일을 골랐는데 AI가
  // 장소 부족으로 4일에 몰아넣은 경우 탭이 4개만 떠서 "고른 기간이 무시됐다"로 읽힌다.
  // 왜 max()로 감싸나: day_count가 stale하거나(6→3으로 줄였는데 기존 플랜이 6일치) null인
  // 레거시 플랜에서 items가 있는 Day를 숨기지 않기 위해서다. 어느 쪽도 데이터를 잃지 않는다.
  //
  // ⚠ 날짜(start/end)에서 Day 수를 다시 계산하지 않는다 — 그건 EF의 fallback 몫이다(D-09).
  const maxDayIndex = (plan?.plan_items ?? []).reduce((m, it) => Math.max(m, it.day_index), -1);
  const dayTotal = Math.max(trip.day_count ?? 0, maxDayIndex + 1, 1);

  const openDaySheet = (target: MoveTarget) => setMoveTarget(target);

  const handleDayPicked = (dayIndex: number) => {
    if (!moveTarget) return;
    if (moveTarget.kind === 'pool') onMovePlaceToDay(moveTarget.placeId, dayIndex);
    else onMoveItemToDay(moveTarget.itemId, moveTarget.placeId, dayIndex);
    setMoveTarget(null);
  };

  // D-20 '아직 모르겠다' — 풀에 남긴다. 이미 배치된 항목이면 풀로 되돌린다.
  // 즉시 재생성·자동 배치는 하지 않는다.
  const handleDaySkipped = () => {
    if (moveTarget?.kind === 'item') onMoveToPool(moveTarget.itemId);
    setMoveTarget(null);
  };

  const daySheet = (
    <DaySelectSheet
      open={moveTarget !== null}
      onClose={() => setMoveTarget(null)}
      dayCount={dayTotal}
      onSelectDay={handleDayPicked}
      onSkip={handleDaySkipped}
    />
  );

  // ── 상태 C — 생성 중. 연타 차단은 이 단일 boolean이 담당한다(T-28-19). ──
  if (generating) {
    // 진행 카피는 core 상수만 쓴다 — 신규 문자열 금지. done/error는 터미널이라 라벨이 없다.
    const stepKo: string | null = planStep
      ? ((PLAN_STEP_KO as Record<string, string | undefined>)[planStep] ?? null)
      : null;
    return (
      <section className="flex flex-col gap-2 border-b border-neutral-100 py-6">
        {/* 재생성 중(plan 존재)에는 '아직 일정이 없어요'가 거짓이므로 헤딩을 내지 않는다. */}
        {!plan && <p className="text-lg font-semibold text-neutral-900">아직 일정이 없어요</p>}
        <Button className="w-full disabled:text-white" disabled>
          일정을 짜고 있어요…
        </Button>
        <div aria-live="polite" className="flex items-center gap-2 pt-1">
          <Loader2 className="size-4 shrink-0 animate-spin text-neutral-400" aria-hidden />
          <span className="text-xs font-normal text-neutral-500">{stepKo}</span>
        </div>
      </section>
    );
  }

  // ── 상태 E — 에러. 파괴적 확인창 없음(재생성은 수동 배치를 보존한다, D-21). ──
  if (error) {
    return (
      <section className="flex flex-col gap-3 border-b border-neutral-100 py-6">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-5 shrink-0 text-danger" aria-hidden />
          <span className="flex-1 text-sm font-normal text-neutral-700">
            일정을 만들지 못했어요
          </span>
          <Button variant="outline" size="sm" onClick={onGenerate}>
            다시 시도
          </Button>
        </div>
      </section>
    );
  }

  // ── 상태 B / B-1 / B-2 / B-3 — 플랜 전. ──
  if (!plan) {
    const ctaDisabled = analyzingCount > 0 || gateBlocked;
    return (
      <section className="flex flex-col gap-2 border-b border-neutral-100 py-6">
        <p className="text-lg font-semibold text-neutral-900">아직 일정이 없어요</p>
        <p className="pb-2 text-sm font-normal text-neutral-500">
          링크를 넣거나 장소를 담고 일정 만들기를 누르면 AI가 동선을 짜드려요
        </p>
        <Button
          className="w-full disabled:text-white"
          disabled={ctaDisabled}
          onClick={() => {
            // D-13: 기간이 미정이면 생성 대신 게이트 시트부터 연다(owner에게만).
            if (durationUnset && isOwner) {
              setGateOpen(true);
              return;
            }
            onGenerate();
          }}
        >
          일정 만들기
        </Button>
        {/* 비활성 사유를 버튼 바로 아래 텍스트로 병기 — 색 대비 면제분을 텍스트로 보상. */}
        {analyzingCount > 0 && (
          <p className="text-xs font-normal text-neutral-500">
            영상에서 장소를 찾고 있어요 · {analyzingCount}개 분석 중
          </p>
        )}
        {gateBlocked && (
          <p className="text-xs font-normal text-neutral-500">
            호스트가 여행 기간을 정하면 일정을 만들 수 있어요
          </p>
        )}

        <DurationGateSheet
          open={gateOpen}
          onClose={() => setGateOpen(false)}
          onConfirm={(dayCount) => {
            setGateOpen(false);
            onSaveDuration(dayCount);
          }}
        />
      </section>
    );
  }

  // ── 상태 D — 플랜 있음. Day 탭 + 타임라인 + 미배치 풀 + 하단 액션 3종. ──
  const travelMode = plan.travel_mode;
  const activeDay = Math.min(Math.max(selectedDay, 0), dayTotal - 1);

  // Day 버킷 파생 (쿼리 0). place가 삭제된 항목은 건너뛴다(FK-safety).
  const placesById = new Map(places.map((p) => [p.id, p]));
  const buckets: { itemId: string; place: Place; order: number; legSeconds: number | null }[][] =
    Array.from({ length: dayTotal }, () => []);
  for (const it of [...plan.plan_items].sort((a, b) => a.sort_order - b.sort_order)) {
    const place = placesById.get(it.place_id);
    if (!place) continue;
    const di = it.day_index < dayTotal ? it.day_index : dayTotal - 1;
    buckets[di]!.push({
      itemId: it.id,
      place,
      // 그날 방문 순서 = sort_order + 1. place-list의 seq_no(담은 순)와 **다른 체계**이며
      // 혼용하면 안 된다. 지도의 Day 번호 핀도 이 값을 쓴다(D-16).
      order: it.sort_order + 1,
      legSeconds: it.leg_travel_seconds,
    });
  }
  const timeline = buckets[activeDay] ?? [];

  // 미배치 풀 = places − plan_items의 place_id (D-17 — 별도 테이블·쿼리 없음).
  const placedIds = new Set(plan.plan_items.map((it) => it.place_id));
  const pool = places.filter((p) => !placedIds.has(p.id));

  // 섹션 타이틀: {도시}, {N}박 {N+1}일 추천 일정 — '추천 일정' 어절만 brand 색.
  const cityKo = trip.city_code ? CITY_KO_MAP[trip.city_code] : undefined;
  const durationLabel = dayTotal >= 2 ? `${dayTotal - 1}박 ${dayTotal}일` : '당일치기';
  const titlePrefix = [cityKo, durationLabel].filter(Boolean).join(', ');

  return (
    <section className="flex flex-col border-b border-neutral-100 pb-6">
      <h2 className="py-4 text-2xl font-semibold leading-tight text-neutral-900">
        {titlePrefix && `${titlePrefix} `}
        <span className="text-brand-600">추천 일정</span>
      </h2>

      {/* Day 탭 스트립 (HC-5). 시트 본문(px-6) 폭을 넘기려 -mx-6 px-6으로 확장.
          가로 스크롤만 허용하고 포인터 핸들러·포인터 캡처·터치 차단은 얹지 않는다. */}
      <div
        role="tablist"
        aria-label="일정 Day 선택"
        className="sticky top-0 z-10 -mx-6 flex touch-pan-x gap-2 overflow-x-auto bg-white px-6 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Array.from({ length: dayTotal }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === activeDay}
            aria-controls="plan-timeline"
            onClick={() => onSelectDay(i)}
            className={cn(
              'h-10 shrink-0 rounded-full px-5 text-base font-semibold',
              'transition-colors duration-150 ease-out',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info',
              i === activeDay
                ? 'bg-brand-500 text-white'
                : 'border border-neutral-300 bg-white text-neutral-600',
            )}
          >
            Day {i + 1}
          </button>
        ))}
      </div>

      {/* 타임라인. 아코디언·찜은 노출하지 않는다(A-13 — 장소 상세는 풀 섹션에서). */}
      {timeline.length === 0 ? (
        <p id="plan-timeline" className="py-8 text-center text-sm font-normal text-neutral-500">
          이 날은 아직 비어 있어요. 아래에서 장소를 넣어보세요
        </p>
      ) : (
        <ul id="plan-timeline" className="flex flex-col">
          {timeline.map((row) => (
            <li
              key={row.itemId}
              className="flex min-h-[44px] items-start gap-3 border-b border-neutral-100 py-4"
            >
              <span
                aria-hidden
                className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-500 text-xs font-semibold leading-none text-white"
              >
                {row.order}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-neutral-900">
                  {row.place.name_local}
                </p>
                {row.place.address && (
                  <p className="truncate text-sm font-normal text-neutral-500">
                    {row.place.address}
                  </p>
                )}
                <p className="text-xs font-normal text-neutral-500">
                  {legCaption(row.legSeconds, travelMode)}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  openDaySheet({ kind: 'item', itemId: row.itemId, placeId: row.place.id })
                }
                className="shrink-0 text-sm font-medium text-neutral-700"
              >
                옮기기
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 미배치 풀 (D-17) — 0개면 섹션 미렌더. */}
      {pool.length > 0 && (
        <div className="flex flex-col pt-6">
          <p className="pb-2 text-sm font-normal text-neutral-500">
            아직 안 넣은 곳 {pool.length}
          </p>
          {renderPool?.(pool, (placeId) => openDaySheet({ kind: 'pool', placeId }))}
        </div>
      )}

      {/* 하단 액션 3종 (D-18), 순서 고정. 레퍼런스의 '내 일정으로 담기'는 만들지 않는다. */}
      <div className="flex flex-col gap-3 pt-6">
        <Button variant="outline" className="w-full" onClick={onGenerate}>
          <RotateCcw className="size-4" aria-hidden />
          일정 다시 만들기
        </Button>
        {/* D-25 — 28-03의 D-21 계약(pinned_placements 사후 강제)이 동작하므로 이 문구는 진실이다. */}
        <p className="text-xs font-normal text-neutral-500">
          직접 옮긴 장소는 그대로 두고 나머지만 다시 짜요
        </p>

        <div>
          <p className="pb-2 text-sm font-normal text-neutral-500">이동수단</p>
          <div className="flex gap-1 rounded-full bg-neutral-100 p-1">
            {TravelMode.map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={mode === travelMode}
                onClick={() => {
                  // A-10: 저장만 한다. 자동 재생성하지 않는다 — 토글 연타로 Claude+Routes가
                  // 반복 호출되는 비용 경로를 원천 차단(T-28-19).
                  onTravelModeChange(mode);
                  setModeChanged(true);
                }}
                className={cn(
                  'h-10 flex-1 rounded-full text-sm font-semibold',
                  'transition-colors duration-150 ease-out',
                  mode === travelMode ? 'bg-white text-brand-600' : 'text-neutral-600',
                )}
              >
                {MODE_LABEL[mode]}
              </button>
            ))}
          </div>
          {modeChanged && (
            <p className="pt-2 text-xs font-normal text-neutral-500">
              이동수단을 바꿨어요. 일정 다시 만들기를 누르면 경로를 새로 계산해요
            </p>
          )}
        </div>

        <Button className="w-full" onClick={onShare}>
          <Share2 className="size-4" aria-hidden />
          일정 공유하기
        </Button>
      </div>

      {daySheet}
    </section>
  );
}
