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
import { buildDraft } from './_lib/build-draft';

/**
 * /onboarding — 단일 라우트 클라이언트 위저드 (D-02). 4단계(어디로→날짜→누구랑→봐둔 곳)를
 * 거쳐 마지막 단계에서 모아를 한 번에 생성한다 (D-03). 중간 저장 없음 — 이탈 시 소실 허용
 * (D-04 — 초안 영속화 안 함). 상태는 전부 이 컴포넌트가 소유하고 step 컴포넌트에 내려준다.
 */

type Step = 1 | 2 | 3 | 4;

const HEADINGS: Record<Step, string> = {
  1: '어디로 떠나요?',
  2: '언제 가요?',
  3: '누구랑 가요?',
  4: '봐둔 곳이 있나요?',
};

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [city, setCity] = useState<string | null>(null);
  const [cityCustom, setCityCustom] = useState(false);
  const [dateMode, setDateMode] = useState<'fixed' | 'unset' | null>(null);
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

  const canProceed =
    step === 1
      ? city !== null && city.trim().length > 0
      : step === 2
        ? dateMode === 'unset' || (dateMode === 'fixed' && range?.from != null)
        : step === 3
          ? companion !== null && companion.trim().length > 0
          : true;

  async function handleSubmit() {
    if (submitting || dateMode === null || city === null) return;
    setSubmitting(true);
    try {
      const draft = buildDraft({ city, cityCustom, dateMode, range, companion });
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
      {/* 상단: 스텝 인디케이터 (A-6) + 뒤로 chevron */}
      <div className="relative flex h-14 items-center justify-center px-4">
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
        <div className="flex items-center gap-1.5" aria-hidden>
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <span
              key={s}
              className={
                s === step
                  ? 'h-1.5 w-6 rounded-full bg-brand-600'
                  : 'h-1.5 w-1.5 rounded-full bg-neutral-300'
              }
            />
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 px-4 pt-12">
        <h1 className="mb-8 text-lg font-semibold leading-tight text-neutral-900">
          {HEADINGS[step]}
        </h1>

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
            range={range}
            onModeChange={setDateMode}
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
        {step < 4 ? (
          <Button className="w-full" disabled={!canProceed} onClick={goNext}>
            다음
          </Button>
        ) : (
          <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
            모아 만들기
          </Button>
        )}
      </div>
    </main>
  );
}
