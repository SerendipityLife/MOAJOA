// TripPickerSheet — D-04 in-app trip picker ("어느 여행에 담을까요?").
// Shown by share-handler when the user has 2+ trips. On select it runs the SAME
// add+extract+navigate as the auto path (addAndNavigate), so the user still sees
// the pin forming (D-03). No native/SwiftUI selection UI (D-06). (Phase 16; trip
// vocab repoint in 17-04.)
//
// Mirrors pin-sheet.tsx exactly:
//  - keep-mounted `shown` state (Pitfall 6): unmounting drops the ref's measured
//    layout, so the FIRST snapToIndex after a closed state would be a no-op — the
//    sheet would only open on the second share. `shown` retains the url so content
//    keeps rendering through the close animation while BottomSheet never unmounts.
//  - NativeWind-on-BottomSheetView gotcha (pin-sheet.tsx:5-8,148-160): className on
//    BottomSheetView silently fails; BottomSheetView gets inline backgroundStyle and
//    all visible content lives in an inner <View className="...">.

import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { listMyTripsWithPreview, type TripPreview } from '@moajoa/api';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

interface Props {
  /** The validated http(s) url held in share-handler state. Non-null drives open. */
  url: string | null;
  /** Called with the chosen trip id. share-handler runs addAndNavigate(tripId, url). */
  onSelect: (tripId: string) => void;
  /** Called when the sheet is dismissed (pan-down) without a selection. */
  onClose: () => void;
}

export function TripPickerSheet({ url, onSelect, onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  // Keep-mounted (Pitfall 6): never unmount on close — only toggle `shown`.
  const [shown, setShown] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripPreview[]>([]);

  useEffect(() => {
    if (url) {
      setShown(url);
      listMyTripsWithPreview(supabase)
        .then(setTrips)
        .catch(() => setTrips([]));
      sheetRef.current?.snapToIndex(1);
    } else {
      sheetRef.current?.close();
    }
  }, [url]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={['40%', '90%']}
      enablePanDownToClose
      onClose={onClose}
      handleStyle={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
      backgroundStyle={{ backgroundColor: '#fff' }}
    >
      <BottomSheetView>
        {shown && (
          <View className="px-6 pt-2 pb-6 bg-white">
            <Text className="text-lg font-semibold text-neutral-900 mb-3">
              어느 여행에 담을까요?
            </Text>
            {trips.map((t) => (
              <Pressable key={t.id} onPress={() => onSelect(t.id)} className="py-3">
                <Text className="text-base text-neutral-900">{t.title}</Text>
                <Text className="text-xs text-neutral-500">{t.place_count}개 장소</Text>
              </Pressable>
            ))}
          </View>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}
