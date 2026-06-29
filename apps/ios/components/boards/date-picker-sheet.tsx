// DatePickerSheet — Mozi "Date" bottom sheet. Single date or a range:
// first tap = start, second tap (>= start) = end, tapping a date before the
// start restarts the selection. Accent is brand blue (not Mozi's orange — the
// MOAJOA tone reserves orange for AI pins only).

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { formatDateRangeKo } from '@/lib/trip-format';

interface Props {
  visible: boolean;
  initialStart: Date | null;
  initialEnd: Date | null;
  onClose: () => void;
  onConfirm: (start: Date, end: Date | null) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Cells for a month grid: leading blanks (nulls) to align weekday 0=Sun, then days.
// Always padded to 6 rows (42 cells) so the sheet height stays fixed when paging
// between a 5-week and a 6-week month (only the days change, not the layout).
function monthCells(year: number, month: number): (Date | null)[] {
  const lead = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length < 42) cells.push(null);
  return cells;
}

export function DatePickerSheet({ visible, initialStart, initialEnd, onClose, onConfirm }: Props) {
  const [today] = useState(() => new Date());
  const [start, setStart] = useState<Date | null>(initialStart);
  const [end, setEnd] = useState<Date | null>(initialEnd);
  const [view, setView] = useState(() => {
    const base = initialStart ?? new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  // Re-seed selection + visible month each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setStart(initialStart);
    setEnd(initialEnd);
    const base = initialStart ?? new Date();
    setView({ year: base.getFullYear(), month: base.getMonth() });
  }, [visible, initialStart, initialEnd]);

  function onTapDay(d: Date) {
    if (!start || (start && end)) {
      setStart(d);
      setEnd(null);
      return;
    }
    if (d < start) {
      setStart(d);
      return;
    }
    if (isSameDay(d, start)) return;
    setEnd(d);
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  const cells = monthCells(view.year, view.month);
  const rangeLabel = formatDateRangeKo(start, end);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} />
        <View className="bg-white rounded-t-3xl px-5 pt-5 pb-9">
          {/* Header: 여행 날짜 / X */}
          <View className="flex-row items-center justify-center mb-5">
            <Text className="text-lg font-bold text-neutral-900">여행 날짜</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="absolute right-0 w-9 h-9 rounded-full bg-neutral-900 items-center justify-center"
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Month navigation */}
          <View className="flex-row items-center justify-between mb-3 px-1">
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} className="p-1">
              <Ionicons name="chevron-back" size={22} color="#374151" />
            </Pressable>
            <Text className="text-base font-bold text-neutral-900">
              {view.year}년 {view.month + 1}월
            </Text>
            <Pressable onPress={() => shiftMonth(1)} hitSlop={10} className="p-1">
              <Ionicons name="chevron-forward" size={22} color="#374151" />
            </Pressable>
          </View>

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
              const isStart = !!start && isSameDay(day, start);
              const isEnd = !!end && isSameDay(day, end);
              const isEndpoint = isStart || isEnd;
              const inMid = !!start && !!end && day > start && day < end;
              const isToday = isSameDay(day, today);
              return (
                <View
                  key={day.toISOString()}
                  className="basis-[14.28%] h-11 items-center justify-center"
                  style={inMid ? { backgroundColor: '#E0EAFF' } : undefined}
                >
                  <Pressable onPress={() => onTapDay(day)} hitSlop={6}>
                    {isEndpoint ? (
                      <View className="w-10 h-10 rounded-full bg-brand-500 items-center justify-center">
                        <Text className="text-base font-bold text-white">{day.getDate()}</Text>
                      </View>
                    ) : isToday ? (
                      <View className="w-10 h-10 rounded-full border-2 border-brand-500 items-center justify-center">
                        <Text className="text-base font-medium text-brand-500">
                          {day.getDate()}
                        </Text>
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

          {/* Confirm */}
          <Pressable
            disabled={!start}
            onPress={() => start && onConfirm(start, end)}
            className={`mt-6 rounded-full py-4 items-center ${start ? 'bg-brand-500' : 'bg-neutral-200'}`}
          >
            <Text className={`text-base font-bold ${start ? 'text-white' : 'text-neutral-400'}`}>
              {start ? `${rangeLabel} 저장` : '날짜를 선택하세요'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
