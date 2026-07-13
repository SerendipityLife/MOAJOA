'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { addLink, addManualPlace, createMoaDraft, triggerExtraction } from '@moajoa/api';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { Button, useToast, type PickedPlace } from '@/components';
import { StepWhere } from './_components/step-where';
import { StepDates } from './_components/step-dates';
import { StepWho } from './_components/step-who';
import { StepSeed } from './_components/step-seed';
import {
  buildDraft,
  deriveDayCount,
  isDayCountWithinLimit,
  type DateMode,
} from './_lib/build-draft';

/**
 * /onboarding — 단일 라우트 클라이언트 위저드 (D-02). 4단계(어디로→날짜→누구랑→봐둔 곳)를
 * 거쳐 마지막 단계에서 모아를 한 번에 생성한다 (D-03). 중간 저장 없음 — 이탈 시 소실 허용
 * (D-04 — 초안 영속화 안 함). 상태는 전부 이 컴포넌트가 소유하고 step 컴포넌트에 내려준다.
 */

type Step = 1 | 2 | 3 | 4;

/**
 * 타이틀 앙상블 (D-03): 중앙 이모지 → 큰 타이틀 → 회색 서브카피.
 * 아이콘은 이모지 텍스트다(A-6) — 신규 에셋·아이콘 라이브러리 0.
 * step 4의 서브카피(D-22)는 step-seed가 소유한다 — 여기서 렌더하면 중복이라 null.
 */
const HEADINGS: Record<Step, { icon: string; title: string; subtitle: string | null }> = {
  1: { icon: '🌏', title: '어디로 떠나요?', subtitle: '도시 1곳을 선택해 주세요' },
  2: { icon: '📅', title: '언제 가요?', subtitle: '원하는 기간을 선택해 주세요' },
  3: { icon: '😎', title: '누구랑 가요?', subtitle: '함께 갈 사람을 선택해 주세요' },
  4: { icon: '📍', title: '봐둔 곳이 있나요?', subtitle: null },
};

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [city, setCity] = useState<string | null>(null);
  const [cityCustom, setCityCustom] = useState(false);
  const [dateMode, setDateMode] = useState<DateMode | null>(null);
  const [dayCount, setDayCount] = useState<number | null>(null);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [companion, setCompanion] = useState<string | null>(null);
  const [companionCustom, setCompanionCustom] = useState(false);
  const [seedLinks, setSeedLinks] = useState<string[]>([]);
  const [seedPlaces, setSeedPlaces] = useState<PickedPlace[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 브라우저 뒤로가기 (Pitfall 6 최소 구현): step 전진 시 history에 push, popstate로 후퇴.
  // step 1에서의 back은 이탈 허용(D-04 — 초안 미보존).
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      setStep((e.state?.step as Step | undefined) ?? 1);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const goNext = useCallback(() => {
    setStep((s) => {
      const next = Math.min(s + 1, 4) as Step;
      if (next !== s) window.history.pushState({ step: next }, '');
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  // 날짜 3경로는 상호 배타 — 하나를 고르면 나머지 값을 비운다. 남겨두면 buildDraft가
  // 모드를 단일 진실로 삼더라도 UI가 두 선택을 동시에 켜 놓은 것처럼 보인다.
  const pickDuration = useCallback((n: number) => {
    setDateMode('duration');
    setDayCount(n);
    setRange(undefined);
  }, []);

  const pickDateMode = useCallback((mode: DateMode) => {
    setDateMode(mode);
    if (mode !== 'duration') setDayCount(null);
    if (mode !== 'fixed') setRange(undefined);
  }, []);

  // 2차 방어(BLOCKER): 캘린더 경로는 상한 검사를 통과해야 진행할 수 있다. 상한을 넘으면
  // CTA가 눌리지 않으므로 createMoaDraft INSERT가 **물리적으로 발생하지 않는다**.
  // 판정은 step-dates와 같은 함수 한 벌(deriveDayCount + isDayCountWithinLimit)로 한다.
  // 안내 카피는 step-dates가 캘린더 밑에 이미 띄우므로 여기서 중복 렌더하지 않는다.
  const canProceed =
    step === 1
      ? city !== null && city.trim().length > 0
      : step === 2
        ? dateMode === 'unset' ||
          (dateMode === 'duration' && dayCount !== null) ||
          (dateMode === 'fixed' &&
            range?.from != null &&
            isDayCountWithinLimit(deriveDayCount(range.from, range.to)))
        : step === 3
          ? companion !== null && companion.trim().length > 0
          : true;

  async function handleSubmit() {
    if (submitting || dateMode === null || city === null) return;
    setSubmitting(true);
    try {
      const draft = buildDraft({ city, cityCustom, dateMode, dayCount, range, companion });
      const client = getSupabaseBrowser();
      const trip = await createMoaDraft(client, draft);
      for (const url of seedLinks) {
        const link = await addLink(client, { board_id: trip.id, url });
        if (link.source_kind !== 'manual') {
          triggerExtraction(client, link.id).catch(console.error); // fire-and-forget
        }
      }
      for (const place of seedPlaces) {
        await addManualPlace(client, {
          board_id: trip.id,
          google_place_id: place.id,
          name_local: place.name,
          lat: place.location?.lat,
          lng: place.location?.lng,
          address: place.address,
        });
      }
      router.replace(`/moa/${trip.id}`);
    } catch (err) {
      console.error(err);
      toast('모아를 만들지 못했어요. 다시 시도해 주세요', { variant: 'error' });
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-surface-background">
      {/* 상단 (D-02): 좌 뒤로 chevron(step>1) + 우 N/4 카운터. 4-dot 인디케이터는 제거됨.
          카운터는 step 상태에서 파생 — pushState/popstate 배선은 무수정. */}
      <div className="relative flex h-14 items-center px-4">
        {step > 1 && (
          <button
            type="button"
            aria-label="뒤로"
            onClick={goBack}
            className="absolute left-2 grid size-11 place-items-center text-neutral-700"
          >
            <ChevronLeft className="size-6" strokeWidth={2} />
          </button>
        )}
        {/* 총 스텝은 4 고정(D-02). 시각 표기는 `1/4`(공백 없음, A-5)이고, 슬래시는
            시각 전용이라 스크린리더에는 문장형 라벨로 따로 전달한다(A11y Contract). */}
        <span
          aria-label={`4단계 중 ${step}단계`}
          className="ml-auto text-xs font-semibold tabular-nums text-brand-600"
        >
          {step}/4
        </span>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 px-4 pt-12">
        {/* 타이틀 앙상블 (D-03) — 이모지는 장식이라 스크린리더에서 숨긴다. */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <span aria-hidden className="text-4xl">
            {HEADINGS[step].icon}
          </span>
          <h1 className="text-center text-2xl font-semibold leading-tight text-neutral-900">
            {HEADINGS[step].title}
          </h1>
          {HEADINGS[step].subtitle && (
            <p className="text-center text-sm text-neutral-500">{HEADINGS[step].subtitle}</p>
          )}
        </div>

        {step === 1 && (
          <StepWhere
            value={city}
            custom={cityCustom}
            onChange={(code, custom) => {
              setCityCustom(custom);
              setCity(code);
            }}
          />
        )}

        {step === 2 && (
          <StepDates
            mode={dateMode}
            dayCount={dayCount}
            range={range}
            onDayCountChange={pickDuration}
            onModeChange={pickDateMode}
            onRangeChange={setRange}
          />
        )}

        {step === 3 && (
          <StepWho
            value={companion}
            custom={companionCustom}
            onChange={(value, custom) => {
              setCompanionCustom(custom);
              setCompanion(value);
            }}
          />
        )}

        {step === 4 && (
          <StepSeed
            seedLinks={seedLinks}
            seedPlaces={seedPlaces}
            onAddLink={(url) => setSeedLinks((l) => [...l, url])}
            onPickPlace={(place) => setSeedPlaces((p) => [...p, place])}
            onRemoveLink={(i) => setSeedLinks((l) => l.filter((_, idx) => idx !== i))}
            onRemovePlace={(i) => setSeedPlaces((p) => p.filter((_, idx) => idx !== i))}
          />
        )}
      </div>

      {/* 하단 고정 CTA */}
      <div className="sticky bottom-0 bg-surface-background px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        {/* 비활성 CTA (D-05) = 연한 파랑 채움 + **흰 글씨**. Button primary는 이미
            `disabled:bg-brand-300`을 갖고 있고 기본 글씨가 반투명(text-white/60)이라,
            twMerge로 불투명 흰색만 덮는다 — 신규 Button variant 추가 없음(A-4). */}
        {step < 4 ? (
          <Button className="w-full disabled:text-white" disabled={!canProceed} onClick={goNext}>
            다음
          </Button>
        ) : (
          <Button
            className="w-full disabled:text-white"
            disabled={submitting}
            onClick={handleSubmit}
          >
            모아 만들기
          </Button>
        )}
      </div>
    </main>
  );
}
