// In-app YouTube preview (v1.3 / Phase 14-03).
//
// Embeds the source video seeked to the place's timestamp so the user can watch
// the exact moment without leaving the board (B안 — decide-in-context). Uses the
// youtube /embed player in a WebView; inline playback + autoplay are enabled so
// it starts on the moment that places the pin.

import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  /** YouTube video id (Link.external_id for youtube sources). */
  videoId: string;
  /** Seconds into the video where the place first appears. */
  startSec?: number | null;
}

export function VideoPreview({ videoId, startSec }: Props) {
  const [loading, setLoading] = useState(true);
  const start = Math.max(0, Math.floor(startSec ?? 0));
  const uri = `https://www.youtube.com/embed/${videoId}?start=${start}&autoplay=1&playsinline=1&rel=0`;

  return (
    <View className="w-full rounded-lg overflow-hidden" style={{ aspectRatio: 16 / 9, backgroundColor: '#000' }}>
      <WebView
        source={{ uri }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        onLoadEnd={() => setLoading(false)}
        style={{ flex: 1, backgroundColor: '#000' }}
      />
      {loading && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </View>
  );
}
