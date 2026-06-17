// BoardPickerSheet — D-04 in-app board picker ("어느 보드에 담을까요?").
// Shown by share-handler when the user has 2+ boards. On select it runs the
// SAME add+extract+navigate as the auto path (addAndNavigate), so the user still
// sees the pin forming (D-03). No native/SwiftUI selection UI (D-06).
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
import { listMyBoardsWithPreview, type BoardPreview } from '@moajoa/api';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

interface Props {
  /** The validated http(s) url held in share-handler state. Non-null drives open. */
  url: string | null;
  /** Called with the chosen board id. share-handler runs addAndNavigate(boardId, url). */
  onSelect: (boardId: string) => void;
  /** Called when the sheet is dismissed (pan-down) without a selection. */
  onClose: () => void;
}

export function BoardPickerSheet({ url, onSelect, onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  // Keep-mounted (Pitfall 6): never unmount on close — only toggle `shown`.
  const [shown, setShown] = useState<string | null>(null);
  const [boards, setBoards] = useState<BoardPreview[]>([]);

  useEffect(() => {
    if (url) {
      setShown(url);
      listMyBoardsWithPreview(supabase)
        .then(setBoards)
        .catch(() => setBoards([]));
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
              어느 보드에 담을까요?
            </Text>
            {boards.map((b) => (
              <Pressable key={b.id} onPress={() => onSelect(b.id)} className="py-3">
                <Text className="text-base text-neutral-900">{b.title}</Text>
                <Text className="text-xs text-neutral-500">{b.place_count}개 장소</Text>
              </Pressable>
            ))}
          </View>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}
