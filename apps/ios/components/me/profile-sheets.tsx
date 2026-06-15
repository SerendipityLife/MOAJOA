// Profile edit bottom sheets for the "내 정보" tab — nickname / gender / birthday.
// All three share the same slide-up sheet shell (white rounded-t-3xl, dark round
// close button) used elsewhere in the app (see date-picker-sheet). Brand blue is
// the accent; orange is reserved for AI pins.

import { Ionicons } from '@expo/vector-icons';
import { Gender, type GenderType } from '@moajoa/core';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

// Korean labels for the gender enum — reused by me.tsx to render the current value.
export const GENDER_LABELS: Record<GenderType, string> = {
  male: '남성',
  female: '여성',
  other: '기타',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function SheetShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-1 justify-end">
      <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} />
      <View className="bg-white rounded-t-3xl px-5 pt-5 pb-9">
        <View className="flex-row items-center justify-center mb-5">
          <Text className="text-lg font-bold text-neutral-900">{title}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            className="absolute right-0 w-9 h-9 rounded-full bg-neutral-900 items-center justify-center"
          >
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
        {children}
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Nickname
// ----------------------------------------------------------------------------
export function NicknameSheet({
  visible,
  initial,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  initial: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);

  const trimmed = value.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 60;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SheetShell title="닉네임" onClose={onClose}>
        <TextInput
          value={value}
          onChangeText={setValue}
          autoFocus
          maxLength={60}
          placeholder="닉네임을 입력하세요"
          placeholderTextColor="#9CA3AF"
          returnKeyType="done"
          onSubmitEditing={() => valid && onConfirm(trimmed)}
          className="bg-neutral-50 rounded-2xl px-4 py-4 text-base text-neutral-900"
        />
        <Text className="text-xs text-neutral-400 mt-2 px-1">{trimmed.length}/60</Text>
        <Pressable
          disabled={!valid}
          onPress={() => onConfirm(trimmed)}
          className={`mt-5 rounded-full py-4 items-center ${valid ? 'bg-brand-500' : 'bg-neutral-200'}`}
        >
          <Text className={`text-base font-bold ${valid ? 'text-white' : 'text-neutral-400'}`}>
            저장
          </Text>
        </Pressable>
      </SheetShell>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Gender
// ----------------------------------------------------------------------------
export function GenderSheet({
  visible,
  initial,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  initial: GenderType | null;
  onClose: () => void;
  onConfirm: (value: GenderType) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SheetShell title="성별" onClose={onClose}>
        <View className="gap-2">
          {Gender.map((g) => {
            const selected = g === initial;
            return (
              <Pressable
                key={g}
                onPress={() => onConfirm(g)}
                className={`flex-row items-center justify-between rounded-2xl px-5 py-4 ${
                  selected ? 'bg-brand-50 border border-brand-500' : 'bg-neutral-50'
                }`}
              >
                <Text
                  className={`text-base font-bold ${selected ? 'text-brand-600' : 'text-neutral-900'}`}
                >
                  {GENDER_LABELS[g]}
                </Text>
                {selected && <Ionicons name="checkmark" size={20} color="#2563EB" />}
              </Pressable>
            );
          })}
        </View>
      </SheetShell>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Birthday — custom year/month grid (no native picker dependency).
// ----------------------------------------------------------------------------
const MIN_BIRTH_YEAR = 1950;
// Youngest allowed birth year — someone turning 15 this year.
const MIN_AGE = 15;

// Always 6 week-rows (42 cells) so the grid height never changes between months.
function monthCells(year: number, month: number): (Date | null)[] {
  const lead = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length < 42) cells.push(null);
  return cells;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function Stepper({
  label,
  onPrev,
  onNext,
  onPressLabel,
  prevDisabled,
  nextDisabled,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onPressLabel?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
}) {
  return (
    <View className="flex-1 flex-row items-center justify-between bg-neutral-50 rounded-2xl px-3 py-2">
      <Pressable onPress={onPrev} disabled={prevDisabled} hitSlop={8} className="p-1">
        <Ionicons name="chevron-back" size={20} color={prevDisabled ? '#D1D5DB' : '#374151'} />
      </Pressable>
      <Pressable onPress={onPressLabel} disabled={!onPressLabel} hitSlop={8}>
        <Text className="text-base font-bold text-neutral-900">{label}</Text>
      </Pressable>
      <Pressable onPress={onNext} disabled={nextDisabled} hitSlop={8} className="p-1">
        <Ionicons name="chevron-forward" size={20} color={nextDisabled ? '#D1D5DB' : '#374151'} />
      </Pressable>
    </View>
  );
}

export function BirthdaySheet({
  visible,
  initial,
  todayYMD,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  initial: string | null; // 'YYYY-MM-DD'
  todayYMD: string; // 'YYYY-MM-DD' — supplied by caller (no Date.now in render)
  onClose: () => void;
  onConfirm: (ymd: string) => void;
}) {
  const maxYear = new Date(todayYMD).getFullYear() - MIN_AGE;
  const clampYear = (y: number) => Math.min(maxYear, Math.max(MIN_BIRTH_YEAR, y));

  const [selected, setSelected] = useState<Date | null>(null);
  const [view, setView] = useState({ year: maxYear, month: 0 });
  const [picking, setPicking] = useState(false); // year-selection mode

  useEffect(() => {
    if (!visible) return;
    const max = new Date(todayYMD).getFullYear() - MIN_AGE;
    const clamp = (y: number) => Math.min(max, Math.max(MIN_BIRTH_YEAR, y));
    const base = initial ? new Date(initial) : new Date(max - 5, 0, 1);
    setSelected(initial ? new Date(initial) : null);
    setView({ year: clamp(base.getFullYear()), month: base.getMonth() });
    setPicking(false);
  }, [visible, initial, todayYMD]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const total = v.year * 12 + v.month + delta;
      const year = Math.floor(total / 12);
      if (year < MIN_BIRTH_YEAR || year > maxYear) return v; // stay within range
      return { year, month: ((total % 12) + 12) % 12 };
    });
  }

  const cells = monthCells(view.year, view.month);
  // Years descending (most recent first) — most users are closer to maxYear.
  const years: number[] = [];
  for (let y = maxYear; y >= MIN_BIRTH_YEAR; y--) years.push(y);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SheetShell title="생일" onClose={onClose}>
        {/* Year + month steppers (tap the year to pick from a list) */}
        <View className="flex-row gap-3 mb-4">
          <Stepper
            label={`${view.year}년`}
            onPressLabel={() => setPicking((p) => !p)}
            onPrev={() => setView((v) => ({ ...v, year: clampYear(v.year - 1) }))}
            onNext={() => setView((v) => ({ ...v, year: clampYear(v.year + 1) }))}
            prevDisabled={view.year <= MIN_BIRTH_YEAR}
            nextDisabled={view.year >= maxYear}
          />
          <Stepper
            label={`${view.month + 1}월`}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
          />
        </View>

        {/* Fixed-height body: either the year picker or the day grid. */}
        <View className="h-[300px]">
          {picking ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="flex-row flex-wrap">
                {years.map((y) => {
                  const isSel = y === view.year;
                  return (
                    <View key={y} className="basis-1/3 p-1">
                      <Pressable
                        onPress={() => {
                          setView((v) => ({ ...v, year: y }));
                          setPicking(false);
                        }}
                        className={`rounded-xl py-3 items-center ${isSel ? 'bg-brand-500' : 'bg-neutral-50'}`}
                      >
                        <Text
                          className={`text-base font-bold ${isSel ? 'text-white' : 'text-neutral-900'}`}
                        >
                          {y}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <>
              {/* Weekday header */}
              <View className="flex-row mb-1">
                {WEEKDAYS.map((w) => (
                  <Text
                    key={w}
                    className="flex-1 text-center text-xs font-medium text-neutral-400 py-1"
                  >
                    {w}
                  </Text>
                ))}
              </View>

              {/* Day grid */}
              <View className="flex-row flex-wrap">
                {cells.map((day, i) => {
                  if (!day) return <View key={`b${i}`} className="basis-[14.28%] h-11" />;
                  const isSel = !!selected && isSameDay(day, selected);
                  return (
                    <View
                      key={day.toISOString()}
                      className="basis-[14.28%] h-11 items-center justify-center"
                    >
                      <Pressable onPress={() => setSelected(day)} hitSlop={6}>
                        {isSel ? (
                          <View className="w-10 h-10 rounded-full bg-brand-500 items-center justify-center">
                            <Text className="text-base font-bold text-white">{day.getDate()}</Text>
                          </View>
                        ) : (
                          <View className="w-10 h-10 items-center justify-center">
                            <Text className="text-base text-neutral-900">{day.getDate()}</Text>
                          </View>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>

        <Pressable
          disabled={!selected}
          onPress={() => {
            if (!selected) return;
            const y = selected.getFullYear();
            const m = String(selected.getMonth() + 1).padStart(2, '0');
            const d = String(selected.getDate()).padStart(2, '0');
            onConfirm(`${y}-${m}-${d}`);
          }}
          className={`mt-6 rounded-full py-4 items-center ${selected ? 'bg-brand-500' : 'bg-neutral-200'}`}
        >
          <Text className={`text-base font-bold ${selected ? 'text-white' : 'text-neutral-400'}`}>
            저장
          </Text>
        </Pressable>
      </SheetShell>
    </Modal>
  );
}
