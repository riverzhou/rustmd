#!/usr/bin/env bash
# Headless Wayland smoke test for the Linux release binary.
#
# Starts sway with its headless backend in a private XDG_RUNTIME_DIR, launches
# target/release/rustmd with GDK_BACKEND=wayland, waits for the first frame and
# captures the compositor output with grim. A non-blank frame proves the GTK 3
# / WebKitGTK Wayland path rendered.
#
# This is a smoke test, not a replacement for the Xvfb E2E suite: CI runs it
# with continue-on-error, so a headless-Wayland quirk never blocks a release.
#
# Usage: scripts/linux-wayland-smoke.sh
# Requires: bash, sway, grim, ImageMagick (magick or convert).
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="${RUSTMD_BIN:-$ROOT/target/release/rustmd}"
OUT="${RUSTMD_WAYLAND_SMOKE_OUT:-$ROOT/target/wayland-smoke}"

die() { echo "linux-wayland-smoke: $*" >&2; exit 1; }

[ -x "$BIN" ] || die "missing $BIN; run: npx tauri build --no-bundle"
command -v sway >/dev/null 2>&1 || die "sway is required"
command -v grim >/dev/null 2>&1 || die "grim is required"
if command -v magick >/dev/null 2>&1; then
  IMAGE_TOOL="magick"
elif command -v convert >/dev/null 2>&1; then
  IMAGE_TOOL="convert"
else
  die "ImageMagick (magick or convert) is required"
fi

mkdir -p "$OUT"
RUNTIME="$(mktemp -d "${TMPDIR:-/tmp}/rustmd-wayland-XXXXXX")"
chmod 700 "$RUNTIME"
export XDG_RUNTIME_DIR="$RUNTIME"
export WLR_BACKENDS=headless
export WLR_LIBINPUT_NO_DEVICES=1
export WLR_RENDERER=pixman

SWAY_PID=""
APP_PID=""
cleanup() {
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" 2>/dev/null; then
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  if [ -n "$SWAY_PID" ] && kill -0 "$SWAY_PID" 2>/dev/null; then
    kill "$SWAY_PID" 2>/dev/null || true
    wait "$SWAY_PID" 2>/dev/null || true
  fi
  rm -rf "$RUNTIME"
}
trap cleanup EXIT

echo "starting sway headless (runtime: $RUNTIME)"
sway --config /dev/null --unsupported-gpu >"$OUT/sway.log" 2>&1 &
SWAY_PID=$!

WAYLAND_DISPLAY=""
for _ in $(seq 1 100); do
  for sock in "$XDG_RUNTIME_DIR"/wayland-*; do
    if [ -S "$sock" ]; then
      WAYLAND_DISPLAY="$(basename "$sock")"
      break 2
    fi
  done
  if ! kill -0 "$SWAY_PID" 2>/dev/null; then
    tail -40 "$OUT/sway.log" >&2 || true
    die "sway exited before creating a Wayland socket"
  fi
  sleep 0.1
done
[ -n "$WAYLAND_DISPLAY" ] || {
  tail -40 "$OUT/sway.log" >&2 || true
  die "sway did not create a Wayland socket"
}
export WAYLAND_DISPLAY
echo "using $WAYLAND_DISPLAY"

export GDK_BACKEND=wayland
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export WEBKIT_DISABLE_DMABUF_RENDERER=1
export LIBGL_ALWAYS_SOFTWARE=1
APP_HOME="$(mktemp -d "$OUT/home-XXXXXX")"
HOME="$APP_HOME" "$BIN" >"$OUT/app.log" 2>&1 &
APP_PID=$!

# GTK/WebKit can need several seconds to map and paint on a cold software
# renderer. Poll compositor frames instead of sleeping a fixed amount: the
# first frames may legitimately be black while WebKit starts its processes.
STATS="$OUT/frame-stats.txt"
: >"$STATS"
MEAN=""
SD=""
READY=0
for attempt in $(seq 1 15); do
  sleep 2
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    tail -40 "$OUT/app.log" >&2 || true
    die "rustmd exited before the first frame"
  fi
  grim "$OUT/wayland-smoke.png" >"$OUT/grim.log" 2>&1 || {
    tail -40 "$OUT/grim.log" >&2 || true
    die "grim could not capture the Wayland output"
  }
  [ -s "$OUT/wayland-smoke.png" ] || die "grim produced an empty screenshot"
  stats="$("$IMAGE_TOOL" "$OUT/wayland-smoke.png" -colorspace Gray \
    -format "%[fx:mean] %[fx:standard_deviation]" info:)" || {
    die "ImageMagick could not read the screenshot"
  }
  read -r MEAN SD <<<"$stats"
  if [ -z "${MEAN:-}" ] || [ -z "${SD:-}" ]; then
    die "ImageMagick returned no frame statistics (mean='${MEAN:-}', stddev='${SD:-}')"
  fi
  echo "frame $attempt: mean=$MEAN stddev=$SD" | tee -a "$STATS"
  if awk -v mean="$MEAN" -v sd="$SD" 'BEGIN { exit !(mean > 0.01 && sd > 0.02) }'; then
    READY=1
    break
  fi
done
[ "$READY" = 1 ] || die "no non-blank frame after 30s (last mean=$MEAN, stddev=$SD)"

echo "wayland smoke OK: mean=$MEAN stddev=$SD screenshot=$OUT/wayland-smoke.png"
