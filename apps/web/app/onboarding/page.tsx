'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components';
import { StepWhere } from './_components/step-where';
import { StepWho } from './_components/step-who';

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
  const [step, setStep] = useState<Step>(1);
  const [city, setCity] = useState<string | null>(null);
  const [cityCustom, setCityCustom] = useState(false);
  const [dateMode, setDateMode] = useState<'fixed' | 'unset' | null>(null);
  const [companion, setCompanion] = useState<string | null>(null);
  const [companionCustom, setCompanionCustom] = useState(false);

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
        ? dateMode !== null
        : step === 3
          ? companion !== null && companion.trim().length > 0
          : true;

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
          // Task 2가 <StepDates>로 교체 — 임시 모드 토글(dateMode 배선 유지).
          <div className="flex flex-col gap-3" data-testid="step-dates-placeholder">
            <button
              type="button"
              onClick={() => setDateMode('fixed')}
              className={
                dateMode === 'fixed'
                  ? 'rounded-xl border border-brand-500 bg-surface-raised p-4 text-left'
                  : 'rounded-xl border border-neutral-200 bg-surface-raised p-4 text-left'
              }
            >
              날짜 정했어요
            </button>
            <button
              type="button"
              onClick={() => setDateMode('unset')}
              className={
                dateMode === 'unset'
                  ? 'rounded-xl border border-brand-500 bg-surface-raised p-4 text-left'
                  : 'rounded-xl border border-neutral-200 bg-surface-raised p-4 text-left'
              }
            >
              아직 미정이에요
            </button>
          </div>
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
          // Task 2가 <StepSeed>로, Task 3가 제출 핸들러를 배선.
          <div data-testid="step-seed-placeholder" />
        )}
      </div>

      {/* 하단 고정 CTA */}
      <div className="sticky bottom-0 bg-surface-background px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        {step < 4 ? (
          <Button className="w-full" disabled={!canProceed} onClick={goNext}>
            다음
          </Button>
        ) : (
          <Button className="w-full">모아 만들기</Button>
        )}
      </div>
    </main>
  );
}
