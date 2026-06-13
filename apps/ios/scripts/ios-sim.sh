#!/usr/bin/env bash
# apps/ios를 iOS 시뮬레이터에 빌드·설치·실행하는 헬퍼.
#
# why: expo run:ios는 Xcode 26에서 시뮬레이터를 물리 기기로 오인해
# "No code signing certificates" 오류로 멈춘다(devicectl/CoreDevice 통합을
# @expo/cli가 못 따라감). SDK 56(@expo/cli 56.1.15)에서도 여전히 깨짐을 확인함
# (2026-06-13) — SDK 버전 문제가 아니라 Xcode 26 상위 버그. 그래서 expo를
# 거치지 않고 xcodebuild로 직접 시뮬레이터 빌드한다. 실기기/배포는 EAS 사용.
#
# 사용법:  pnpm sim                 # 기본 "iPhone 17 Pro"
#          pnpm sim -- "iPhone 17"  # 다른 시뮬레이터 지정
set -euo pipefail

DEVICE="${1:-iPhone 17 Pro}"
SCHEME="MOAJOA"
BUNDLE_ID="com.serendipitylife.moajoa"

# Homebrew의 CommandLineTools가 xcode-select를 가로채도 전체 Xcode를 쓰도록 강제.
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

# RN 코드젠 빌드 단계가 node를 호출 → PATH에 없으면 nvm 로드 시도.
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 22 >/dev/null 2>&1 || true
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$APP_DIR/ios"
if [ ! -d "$IOS_DIR" ]; then
  echo "❌ $IOS_DIR 없음 — 먼저 'pnpm --filter @moajoa/ios prebuild' 실행 필요." >&2
  exit 1
fi

# 대상 시뮬레이터 UDID 해석.
UDID="$(xcrun simctl list devices available | grep -m1 "$DEVICE (" | grep -oE '[0-9A-Fa-f-]{36}' || true)"
if [ -z "$UDID" ]; then
  echo "❌ '$DEVICE' 시뮬레이터를 못 찾음. 사용 가능 목록:" >&2
  xcrun simctl list devices available | grep -E "iPhone|iPad" >&2
  exit 1
fi

echo "▶ 대상: $DEVICE ($UDID)"
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator

echo "▶ 빌드 (xcodebuild, 사이닝 비활성)…"
cd "$IOS_DIR"
xcodebuild \
  -workspace "$SCHEME.xcworkspace" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "id=$UDID" \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO \
  build

APP="$IOS_DIR/build/Build/Products/Debug-iphonesimulator/$SCHEME.app"
echo "▶ 설치 + 실행…"
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" "$BUNDLE_ID"
echo "✅ 실행됨: $BUNDLE_ID"

# Debug 빌드는 Metro에서 JS를 받아온다. 안 떠 있으면 포그라운드로 시작(Ctrl+C 종료).
if lsof -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ℹ Metro가 이미 :8081에서 실행 중 — 앱이 거기에 연결됩니다."
else
  echo "▶ Metro 시작 (Ctrl+C로 종료)…"
  cd "$APP_DIR"
  exec pnpm exec expo start
fi
