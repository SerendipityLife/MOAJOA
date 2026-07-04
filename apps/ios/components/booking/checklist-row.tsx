// apps/ios/components/booking/checklist-row.tsx
// Phase 20 (BOOK-02, UI-SPEC Screen 3 항목 2·3) — one booking-checklist row.
// Mirrors the plan-item-row skeleton (white rounded-2xl + ROW_SHADOW + neutral
// kind chip + text-sm/600 title + text-xs neutral-500 sub-line) and adds the
// 3-state status control that must read at a glance (UI-SPEC Color):
//   todo    → neutral ellipse-outline #D1D5DB
//   clicked → brand ellipse-outline #2979FF + badge + the quiet inline
//             hint (D-15 — never a popup)
//   done    → semantic-green check glyph #10B981 (NOT brand) + muted title
//             (no strikethrough)
// Tapping the status control fires onToggleDone directly — no confirmation
// dialog (D-11: 완료의 원천은 사용자). Body tap toggles expand; expanded shows
// the children slot (embedded CompareFrameCard) + 항목 삭제, which is HIDDEN for
// source 'auto' && status 'done' rows (돈 쓴 기록 보존 — D-13).
import { Ionicons } from '@expo/vector-icons';
import type { ChecklistItem } from '@moajoa/core';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

// Same opacity-light card shadow as plan-item-row.tsx (visual continuity).
const ROW_SHADOW = {
  shadowColor: '#1E293B',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 1,
} as const;

const KIND_ICON: Record<ChecklistItem['kind'], keyof typeof Ionicons.glyphMap> = {
  stay: 'bed-outline',
  esim: 'cellular-outline',
  transport: 'train-outline',
  activity: 'ticket-outline',
  custom: 'create-outline',
};

const KIND_LABEL: Record<ChecklistItem['kind'], string> = {
  stay: '숙소',
  esim: '유심',
  transport: '교통',
  activity: '액티비티',
  custom: '직접 추가',
};

interface Props {
  item: ChecklistItem;
  /** Render-time plan-desync badge predicate (core isDesynced) — never stored (D-13). */
  desynced?: boolean;
  expanded?: boolean;
  /** Status control tap — the parent decides where the toggle lands (done ↔ clicked/todo). */
  onToggleDone: () => void;
  onToggleExpand: () => void;
  onDelete: () => void;
  /** Expanded slot — the kind's embedded CompareFrameCard (manual rows pass nothing). */
  children?: ReactNode;
}

export function ChecklistRow({
  item,
  desynced = false,
  expanded = false,
  onToggleDone,
  onToggleExpand,
  onDelete,
  children,
}: Props) {
  const done = item.status === 'done';
  const clicked = item.status === 'clicked';
  // 3색 진행: neutral → brand → semantic green ('완료' is green, NOT brand).
  const statusIcon = done ? 'checkmark-circle' : 'ellipse-outline';
  const statusColor = done ? '#10B981' : clicked ? '#2979FF' : '#D1D5DB';
  // D-13: an auto row that reached 완료 is a money-spent record — delete hidden.
  const deleteHidden = item.source === 'auto' && done;

  return (
    <View style={ROW_SHADOW} className="bg-white rounded-2xl mb-2.5 px-3 py-3">
      <View className="flex-row items-center">
        {/* Status control — direct toggle, no dialog (D-11). */}
        <Pressable
          onPress={onToggleDone}
          className="w-11 h-11 items-center justify-center -ml-1"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={done ? '완료 해제' : '완료로 표시'}
        >
          <Ionicons name={statusIcon} size={22} color={statusColor} />
        </Pressable>

        {/* Row body — tap anywhere (except the status control) toggles expand. */}
        <Pressable
          onPress={onToggleExpand}
          className="flex-1 flex-row items-center"
          accessibilityRole="button"
          accessibilityLabel={expanded ? '항목 접기' : '항목 펼치기'}
        >
          <View className="w-10 h-10 rounded-xl bg-neutral-100 items-center justify-center">
            <Ionicons name={KIND_ICON[item.kind]} size={18} color="#4B5563" />
          </View>

          <View className="flex-1 px-3">
            <View className="flex-row items-center">
              <Text
                className={`text-sm font-semibold ${done ? 'text-neutral-400' : 'text-neutral-900'}`}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {clicked && (
                <View className="ml-2 px-1.5 py-0.5 rounded-full bg-brand-50">
                  <Text className="text-[10px] text-brand-600">확인함</Text>
                </View>
              )}
              {desynced && (
                <View className="ml-2 px-1.5 py-0.5 rounded-full bg-neutral-100">
                  <Text className="text-[10px] text-neutral-500">플랜에 없음</Text>
                </View>
              )}
            </View>
            <Text className="text-xs text-neutral-500 mt-0.5" numberOfLines={1}>
              {clicked ? '예약했으면 체크해주세요' : KIND_LABEL[item.kind]}
            </Text>
          </View>

          <View className="w-11 h-11 items-center justify-center">
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#D1D5DB" />
          </View>
        </Pressable>
      </View>

      {expanded && (
        <View className="border-t border-neutral-100 mt-3 pt-3">
          {children}
          {!deleteHidden && (
            <Pressable
              onPress={onDelete}
              className="self-start justify-center mt-2"
              style={{ minHeight: 44 }}
              accessibilityRole="button"
              accessibilityLabel="항목 삭제"
            >
              <Text className="text-xs" style={{ color: '#EF4444' }}>
                항목 삭제
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
