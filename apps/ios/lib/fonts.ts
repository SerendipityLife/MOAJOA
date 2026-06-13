// App-wide default font: Pretendard.
//
// Pretendard is bundled via the expo-font plugin (app.config.ts) but nothing in
// RN/NativeWind ever referenced it, so every Text/TextInput fell back to the system
// font. React Native has no global "default font" setting, and React 19 dropped
// `Text.defaultProps`, so we inject the family by wrapping the host components'
// render. We only set fontFamily — Pretendard registers every weight under the one
// "Pretendard" family (verified on-device), so each element's existing fontWeight
// (e.g. NativeWind `font-bold`) still selects the right cut. Icon fonts are safe:
// @expo/vector-icons sets its own fontFamily in `style`, which wins (applied last).
import { Text, TextInput } from 'react-native';

const DEFAULT_FONT = { fontFamily: 'Pretendard' } as const;

type Renderable = {
  render?: (props: { style?: unknown }, ref: unknown) => unknown;
  __pretendardPatched?: boolean;
};

function applyDefaultFont(component: unknown) {
  const target = component as Renderable;
  // Guard keeps Fast Refresh from stacking wrappers on re-evaluation.
  if (typeof target.render !== 'function' || target.__pretendardPatched) return;
  const original = target.render;
  target.render = function patchedRender(props, ref) {
    return original.call(this, { ...props, style: [DEFAULT_FONT, props.style] }, ref);
  };
  target.__pretendardPatched = true;
}

applyDefaultFont(Text);
applyDefaultFont(TextInput);
