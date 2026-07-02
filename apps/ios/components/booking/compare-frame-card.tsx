// apps/ios/components/booking/compare-frame-card.tsx
// Phase 20 (BOOK-03, UI-SPEC Component 0) — one card that reads as a COMPARISON,
// not two thrown buttons (D-06). Reused for stay (Agoda/Booking), activity
// (Klook/KKday) and single-provider rows (Airalo eSIM / transport pass).
//
// This component is URL-BLIND: [보기] fires the row's onView callback and the
// PARENT injects openBooking/openDirectSearch (assembly knowledge stays in
// lib/booking.ts + @moajoa/core). Provider copy is injected too — labels come
// from @moajoa/core COMPARE_LABELS, never hardcoded here (UI-SPEC Cross-Screen).
//
// D-02 광고판 금지: the card surface is white/neutral; brand color appears ONLY
// on the [보기] buttons. No loading state — a tap opens Safari instantly (D-14).
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

// Same standalone-card shadow as onboarding.tsx / trip/create.tsx (visual continuity).
const cardShadow = {
  shadowColor: '#1E293B',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
} as const;

export interface CompareRow {
  /** Display name (e.g. 'Klook') — also keys the a11y label "{provider}에서 보기". */
  providerName: string;
  /** Static comparison label injected from @moajoa/core COMPARE_LABELS. */
  labelKo: string;
  /** [보기] tap — parent decides what opens (openBooking / openDirectSearch). */
  onView: () => void;
}

interface Props {
  variant: 'full' | 'compact';
  /** Kind glyph for the full-variant header chip (bed/cellular/train/ticket…). */
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  /** Right-aligned header caption, e.g. '{도시} · {MM.DD–MM.DD}' prefill context. */
  caption?: string;
  rows: CompareRow[];
  /** true → borderless (embedded inside an expanded checklist row). */
  embedded?: boolean;
  /** D-16 flag-gated affiliate disclosure. DEFAULT OFF (RESEARCH Open Q2). */
  footerVisible?: boolean;
}

/** The [보기] CTA — the ONLY brand-colored element on the card (D-02). */
function ViewButton({
  providerName,
  onView,
  mini,
}: {
  providerName: string;
  onView: () => void;
  mini?: boolean;
}) {
  return (
    <Pressable
      onPress={onView}
      // Visual button is small; hitSlop lifts the touch target to ≥44px.
      hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
      className={`bg-brand-50 rounded-full px-3 ${mini ? 'py-1' : 'py-1.5'} active:opacity-70`}
      accessibilityRole="button"
      accessibilityLabel={`${providerName}에서 보기`}
    >
      <Text className="text-xs font-semibold text-brand-600">보기</Text>
    </Pressable>
  );
}

export function CompareFrameCard({
  variant,
  icon,
  title,
  caption,
  rows,
  embedded = false,
  footerVisible = false,
}: Props) {
  if (variant === 'compact') {
    // Plan-tab activity strip (D-02 "작은 버튼/컴팩트") — static labels omitted;
    // the fully labeled frame lives in the book tab.
    return (
      <View className="flex-row items-center bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-2">
        <Ionicons name="ticket-outline" size={14} color="#9CA3AF" />
        <Text className="text-xs text-neutral-500 ml-1.5">예약 비교</Text>
        <View className="flex-1" />
        {rows.map((row, i) => (
          <View
            key={row.providerName}
            className={`flex-row items-center ${i > 0 ? 'ml-2' : ''}`}
          >
            <Text className="text-xs font-semibold text-neutral-900 mr-1">
              {row.providerName}
            </Text>
            <ViewButton providerName={row.providerName} onView={row.onView} mini />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View
      className={embedded ? undefined : 'bg-white rounded-2xl px-4 py-4'}
      style={embedded ? undefined : cardShadow}
    >
      <View className="flex-row items-center">
        {icon && (
          <View className="w-10 h-10 rounded-xl bg-neutral-100 items-center justify-center">
            <Ionicons name={icon} size={18} color="#4B5563" />
          </View>
        )}
        <Text
          className={`text-sm font-semibold text-neutral-900 flex-1 ${icon ? 'px-3' : ''}`}
          numberOfLines={1}
        >
          {title}
        </Text>
        {caption != null && <Text className="text-xs text-neutral-400">{caption}</Text>}
      </View>

      {rows.map((row) => (
        <View key={row.providerName} className="flex-row items-center mt-3">
          <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
            {row.providerName}
          </Text>
          <Text className="text-xs text-neutral-400 mx-1.5">─</Text>
          <Text className="text-xs text-neutral-500" numberOfLines={1}>
            {row.labelKo}
          </Text>
          {/* THE PRICE SLOT (D-06) — a future price lands here with ZERO relayout. */}
          <View className="flex-1" />
          <ViewButton providerName={row.providerName} onView={row.onView} />
        </View>
      ))}

      {footerVisible && (
        <Text className="text-[10px] text-neutral-400 mt-2">
          예약 시 수수료를 받을 수 있어요
        </Text>
      )}
    </View>
  );
}
