// apps/ios/components/ledger/ledger-row.tsx
// Phase 21 (LEDGER-03/06, UI-SPEC Component 0) — one payment = one row. Mirrors
// checklist-row.tsx (ROW_SHADOW white card + neutral platform chip + text-sm/600
// title + text-xs neutral caption) but the right column is the ledger's job: the
// original-currency amount, a DERIVED ≈₩ caption (deriveAmountKrw — KRW is never a
// source, Pitfall 4), and the FX-source trust badge (D-06 gisualization):
//   email       → success '실청구'      (actual billed amount = most trusted)
//   frankfurter → neutral '추정 환율'    (looked-up rate = reference)
//   unavailable → warning '환율 확인 안 됨' (no rate = caution)
// The row owns NO assignment/URL logic — an actionable entry (unassigned or
// needs_review) shows a brand badge and fires onPress; the parent decides what
// the tap does (open the assign/review sheet). ready rows just no-op on press.
import { Ionicons } from '@expo/vector-icons';
import { deriveAmountKrw, type LedgerEntry } from '@moajoa/core';
import { Pressable, Text, View } from 'react-native';

// Same opacity-light card shadow as checklist-row.tsx (visual continuity).
const ROW_SHADOW = {
  shadowColor: '#1E293B',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 1,
} as const;

/**
 * platform is a free-form string from the parse pipeline — map common categories
 * to a glyph, default to a receipt. Keyword match keeps it resilient to the
 * exact label the model emits (항공/hotel/klook/카드 …).
 */
function platformIcon(platform: string | null): keyof typeof Ionicons.glyphMap {
  const p = (platform ?? '').toLowerCase();
  if (/flight|air|항공/.test(p)) return 'airplane';
  if (/hotel|stay|호텔|숙박|숙소|agoda|booking|airbnb/.test(p)) return 'bed';
  if (/klook|kkday|ticket|티켓|투어|tour|액티/.test(p)) return 'ticket';
  if (/card|카드|결제|신한|삼성|현대|국민|우리|롯데|하나/.test(p)) return 'card';
  return 'receipt-outline';
}

/** ISO date/datetime → 'MM.DD' (parse pipeline stores paid_at as ISO). */
function shortDate(paidAt: string | null): string | null {
  if (!paidAt) return null;
  const m = paidAt.slice(0, 10).match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}.${m[2]}` : null;
}

interface Props {
  entry: LedgerEntry;
  /** Fires only when the row is actionable (unassigned / needs_review). */
  onPress: () => void;
}

export function LedgerRow({ entry, onPress }: Props) {
  const isUnassigned = entry.trip_id === null;
  const isNeedsReview = entry.status === 'needs_review';
  const actionable = isUnassigned || isNeedsReview;
  const badgeLabel = isUnassigned ? '미분류' : isNeedsReview ? '확인 필요' : null;

  const merchant = entry.merchant ?? entry.platform ?? '결제';
  const caption = [
    entry.platform,
    entry.card_last4 ? `••••${entry.card_last4}` : null,
    shortDate(entry.paid_at),
  ]
    .filter(Boolean)
    .join(' · ');

  const amountForeign =
    entry.amount_foreign !== null
      ? `${entry.amount_foreign.toLocaleString()} ${entry.currency ?? ''}`.trim()
      : '—';
  const amountKrw = deriveAmountKrw(entry.amount_foreign, entry.fx_rate);

  return (
    <Pressable
      onPress={actionable ? onPress : undefined}
      disabled={!actionable}
      style={ROW_SHADOW}
      className="bg-white rounded-2xl mb-2.5 px-3 py-3 flex-row items-center"
      accessibilityRole={actionable ? 'button' : undefined}
      accessibilityLabel={actionable ? `${merchant} 확인` : merchant}
    >
      {/* Left: platform chip */}
      <View className="w-11 h-11 rounded-xl bg-neutral-100 items-center justify-center">
        <Ionicons name={platformIcon(entry.platform)} size={20} color="#4B5563" />
      </View>

      {/* Center: merchant + meta caption */}
      <View className="flex-1 ml-3">
        <View className="flex-row items-center">
          <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
            {merchant}
          </Text>
          {badgeLabel && (
            <View className="ml-2 px-1.5 py-0.5 rounded-full bg-brand-50">
              <Text className="text-[10px] text-brand-600">{badgeLabel}</Text>
            </View>
          )}
        </View>
        {caption.length > 0 && (
          <Text className="text-xs text-neutral-400 mt-0.5" numberOfLines={1}>
            {caption}
          </Text>
        )}
      </View>

      {/* Right: amount + KRW caption + FX-source badge */}
      <View className="items-end ml-2">
        <Text className="text-base font-semibold text-neutral-900">{amountForeign}</Text>
        {amountKrw !== null && (
          <Text className="text-xs text-neutral-400 mt-0.5">≈ ₩{amountKrw.toLocaleString()}</Text>
        )}
        {entry.fx_source === 'email' ? (
          <View className="mt-0.5 px-1.5 py-0.5 rounded-full bg-success/10">
            <Text className="text-[10px] text-success">실청구</Text>
          </View>
        ) : entry.fx_source === 'frankfurter' ? (
          <Text className="text-xs text-neutral-400 mt-0.5">추정 환율</Text>
        ) : (
          <Text className="text-xs text-warning mt-0.5">환율 확인 안 됨</Text>
        )}
      </View>
    </Pressable>
  );
}
