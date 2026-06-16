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
  // why: the /embed player gates on the embedding page's HTTP Referer/origin.
  // Loading the embed URL directly via `source={{ uri }}` sends no referer → YouTube
  // rejects it ("오류 153 구성 오류"); using baseUrl=youtube.com sends a self-referer
  // → rejected as not-embeddable ("오류 152"). Wrapping the iframe in an HTML doc with
  // a third-party https baseUrl gives a valid embedding origin so playback succeeds.
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"><style>*{margin:0;padding:0}html,body{height:100%;background:#000;overflow:hidden}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head><body><iframe src="https://www.youtube.com/embed/${videoId}?start=${start}&autoplay=1&playsinline=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></body></html>`;

  return (
    <View className="w-full rounded-lg overflow-hidden" style={{ aspectRatio: 16 / 9, backgroundColor: '#000' }}>
      <WebView
        source={{ html, baseUrl: 'https://moajoa.app' }}
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
