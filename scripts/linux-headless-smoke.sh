#!/usr/bin/env bash
# Headless smoke test for the Linux release binary.
#
# Starts an isolated Xvfb display (no root), launches target/release/rustmd
# with a throw-away HOME, captures the window via xwd and verifies that it
# rendered content (window size, colour variety, dark pixels, edge density).
# It never opens a window on the user's desktop and never displays the image.
#
# Usage: scripts/linux-headless-smoke.sh
# Requires: bash, python3, xwininfo; apt-get/dpkg-deb only if Xvfb/xwd missing.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="${RUSTMD_BIN:-$ROOT/target/release/rustmd}"
OUT="$ROOT/target/headless-smoke"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/rustmd-headless"

die() { echo "linux-headless-smoke: $*" >&2; exit 1; }

[ -x "$BIN" ] || die "missing $BIN; run: npx tauri build --no-bundle"
command -v python3 >/dev/null 2>&1 || die "python3 is required"
command -v xwininfo >/dev/null 2>&1 || die "xwininfo is required (apt install x11-utils)"
mkdir -p "$OUT" "$CACHE"

ensure_xvfb() {
  if command -v Xvfb >/dev/null 2>&1; then
    XVFB_BIN="$(command -v Xvfb)"
  elif [ -x "$CACHE/xvfb/usr/bin/Xvfb" ]; then
    XVFB_BIN="$CACHE/xvfb/usr/bin/Xvfb"
  else
    command -v apt-get >/dev/null 2>&1 || die "Xvfb not found and apt-get unavailable"
    command -v dpkg-deb >/dev/null 2>&1 || die "dpkg-deb not found"
    local tmp
    tmp="$(mktemp -d)"
    echo "downloading xvfb into $CACHE ..."
    ( cd "$tmp" && apt-get download xvfb >/dev/null 2>&1 \
      && dpkg-deb -x xvfb_*.deb "$CACHE/xvfb" ) \
      || { rm -rf "$tmp"; die "failed to download/unpack xvfb"; }
    rm -rf "$tmp"
    XVFB_BIN="$CACHE/xvfb/usr/bin/Xvfb"
    [ -x "$XVFB_BIN" ] || die "Xvfb not found after unpack"
  fi
}

ensure_xwd() {
  if command -v xwd >/dev/null 2>&1; then
    XWD_BIN="$(command -v xwd)"
  elif [ -x "$CACHE/x11-apps/usr/bin/xwd" ]; then
    XWD_BIN="$CACHE/x11-apps/usr/bin/xwd"
  else
    command -v apt-get >/dev/null 2>&1 || die "xwd not found and apt-get unavailable"
    command -v dpkg-deb >/dev/null 2>&1 || die "dpkg-deb not found"
    local tmp
    tmp="$(mktemp -d)"
    echo "downloading x11-apps (xwd) into $CACHE ..."
    ( cd "$tmp" && apt-get download x11-apps >/dev/null 2>&1 \
      && dpkg-deb -x x11-apps_*.deb "$CACHE/x11-apps" ) \
      || { rm -rf "$tmp"; die "failed to download/unpack x11-apps"; }
    rm -rf "$tmp"
    XWD_BIN="$CACHE/x11-apps/usr/bin/xwd"
    [ -x "$XWD_BIN" ] || die "xwd not found after unpack"
  fi
}

ensure_xvfb
ensure_xwd

DISP=""
for n in $(seq 99 109); do
  if [ ! -e "/tmp/.X11-unix/X$n" ] && [ ! -e "/tmp/.X$n-lock" ]; then
    DISP="$n"
    break
  fi
done
[ -n "$DISP" ] || die "no free X display in :99-:109"
export DISPLAY=":$DISP"

APP_PID=""
APP_PGID=""
XVFB_PID=""

cleanup() {
  set +e
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" 2>/dev/null; then
    if [ "$APP_PGID" = "$APP_PID" ]; then
      kill -TERM -- "-$APP_PID" 2>/dev/null
    else
      kill -TERM "$APP_PID" 2>/dev/null
    fi
  fi
  if [ -n "$XVFB_PID" ] && kill -0 "$XVFB_PID" 2>/dev/null; then
    kill -TERM "$XVFB_PID" 2>/dev/null
  fi
  sleep 1
  if [ -n "$APP_PID" ] && [ "$APP_PGID" = "$APP_PID" ]; then
    kill -KILL -- "-$APP_PID" 2>/dev/null
  fi
  if [ -n "$XVFB_PID" ]; then
    kill -KILL "$XVFB_PID" 2>/dev/null
  fi
  wait 2>/dev/null
}
trap cleanup EXIT
trap 'exit 130' INT TERM

"$XVFB_BIN" ":$DISP" -screen 0 1440x900x24 -ac -nolisten tcp \
  +extension GLX +render -noreset >"$OUT/xvfb.log" 2>&1 &
XVFB_PID=$!

ready=0
for _ in $(seq 1 50); do
  if xwininfo -root >/dev/null 2>&1; then ready=1; break; fi
  kill -0 "$XVFB_PID" 2>/dev/null || { tail -20 "$OUT/xvfb.log"; die "Xvfb exited"; }
  sleep 0.2
done
[ "$ready" = 1 ] || { tail -20 "$OUT/xvfb.log"; die "Xvfb did not start"; }

APP_HOME="$OUT/home"
mkdir -p "$APP_HOME/config" "$APP_HOME/data" "$APP_HOME/cache"

APP_ENV=(
  env
  "DISPLAY=:$DISP"
  "GDK_BACKEND=x11"
  "LIBGL_ALWAYS_SOFTWARE=1"
  "WEBKIT_DISABLE_COMPOSITING_MODE=1"
  "NO_AT_BRIDGE=1"
  "HOME=$APP_HOME"
  "XDG_CONFIG_HOME=$APP_HOME/config"
  "XDG_DATA_HOME=$APP_HOME/data"
  "XDG_CACHE_HOME=$APP_HOME/cache"
)
if command -v dbus-run-session >/dev/null 2>&1; then
  APP_CMD=(dbus-run-session -- "$BIN")
else
  APP_CMD=("$BIN")
fi

if command -v setsid >/dev/null 2>&1; then
  setsid "${APP_ENV[@]}" "${APP_CMD[@]}" >"$OUT/app.log" 2>&1 &
else
  "${APP_ENV[@]}" "${APP_CMD[@]}" >"$OUT/app.log" 2>&1 &
fi
APP_PID=$!
APP_PGID="$(ps -o pgid= -p "$APP_PID" 2>/dev/null | tr -d ' ' || true)"

WID=""
for _ in $(seq 1 60); do
  kill -0 "$APP_PID" 2>/dev/null || {
    tail -30 "$OUT/app.log"
    die "app exited before creating a window"
  }
  WID="$(xwininfo -root -tree 2>/dev/null \
    | grep '"rustmd"' \
    | grep -E '[0-9]{3,}x[0-9]{3,}' \
    | head -1 | awk '{print $1}' || true)"
  [ -n "$WID" ] && break
  sleep 0.25
done
[ -n "$WID" ] || { tail -30 "$OUT/app.log"; die "rustmd window not found"; }

echo "window $WID found on DISPLAY=:$DISP"
# The window is mapped before WebKit paints its first frame; give it time.
sleep 5
"$XWD_BIN" -id "$WID" -silent -out "$OUT/window.xwd" \
  || die "xwd failed to capture window $WID"

python3 - "$OUT/window.xwd" "$OUT/window.ppm" "$OUT/window.png" <<'PY'
import struct
import sys
from pathlib import Path

xwd_path, ppm_path, png_path = sys.argv[1:4]
data = Path(xwd_path).read_bytes()

def unpack_header(endian):
    return struct.unpack(endian + "25I", data[:100])

hdr = unpack_header(">")
if hdr[1] != 7:
    hdr = unpack_header("<")
(
    header_size, file_version, pixmap_format, depth, width, height, xoffset,
    byte_order, bitmap_unit, bitmap_bit_order, bitmap_pad, bpp, bytes_per_line,
    visual_class, red_mask, green_mask, blue_mask, bits_per_rgb,
    colormap_entries, ncolors, win_w, win_h, win_x, win_y, border_width,
) = hdr

if file_version != 7:
    sys.exit(f"not an XWD file (version {file_version})")
if pixmap_format != 2:
    sys.exit(f"unsupported XWD pixmap format {pixmap_format}")
if bpp not in (24, 32):
    sys.exit(f"unsupported XWD bpp {bpp}")
if width < 800 or height < 500:
    sys.exit(f"window too small: {width}x{height}")

pixel_offset = header_size + ncolors * 12
need = pixel_offset + bytes_per_line * height
if need > len(data):
    sys.exit(f"truncated XWD: need {need}, have {len(data)}")

def channel(value, mask):
    if mask == 0:
        return 0
    shift = (mask & -mask).bit_length() - 1
    return ((value & mask) >> shift) * 255 // (mask >> shift)

rgb = bytearray(width * height * 3)
step = max(1, width // 300)
for y in range(height):
    row = data[pixel_offset + y * bytes_per_line:
               pixel_offset + (y + 1) * bytes_per_line]
    for x in range(width):
        if bpp == 32:
            if byte_order == 0:
                v = row[x * 4] | row[x * 4 + 1] << 8 | row[x * 4 + 2] << 16 | row[x * 4 + 3] << 24
            else:
                v = row[x * 4] << 24 | row[x * 4 + 1] << 16 | row[x * 4 + 2] << 8 | row[x * 4 + 3]
        else:
            if byte_order == 0:
                v = row[x * 3] | row[x * 3 + 1] << 8 | row[x * 3 + 2] << 16
            else:
                v = row[x * 3] << 16 | row[x * 3 + 1] << 8 | row[x * 3 + 2]
        r = channel(v, red_mask) if red_mask else (v >> 16) & 0xFF
        g = channel(v, green_mask) if green_mask else (v >> 8) & 0xFF
        b = channel(v, blue_mask) if blue_mask else v & 0xFF
        i = (y * width + x) * 3
        rgb[i] = r
        rgb[i + 1] = g
        rgb[i + 2] = b

samples = 0
dark = 0
colors = set()
for y in range(0, height, step):
    for x in range(0, width, step):
        i = (y * width + x) * 3
        r, g, b = rgb[i], rgb[i + 1], rgb[i + 2]
        lum = (r * 299 + g * 587 + b * 114) // 1000
        samples += 1
        if lum < 100:
            dark += 1
        colors.add((r >> 3, g >> 3, b >> 3))

edges = 0
edge_samples = 0
for y in range(0, height, step):
    for x in range(0, width, step):
        i = (y * width + x) * 3
        lum = (rgb[i] * 299 + rgb[i + 1] * 587 + rgb[i + 2] * 114) // 1000
        x2 = min(width - 1, x + step)
        y2 = min(height - 1, y + step)
        j = (y * width + x2) * 3
        k = (y2 * width + x) * 3
        lum_x = (rgb[j] * 299 + rgb[j + 1] * 587 + rgb[j + 2] * 114) // 1000
        lum_y = (rgb[k] * 299 + rgb[k + 1] * 587 + rgb[k + 2] * 114) // 1000
        edge_samples += 1
        if abs(lum - lum_x) > 30 or abs(lum - lum_y) > 30:
            edges += 1

dark_pct = dark * 100 / samples
edge_pct = edges * 100 / edge_samples
Path(ppm_path).write_bytes(
    f"P6\n{width} {height}\n255\n".encode() + bytes(rgb)
)

png_note = ""
try:
    from PIL import Image
    Image.frombytes("RGB", (width, height), bytes(rgb)).save(png_path)
    png_note = f" png={png_path}"
except Exception:
    pass

print(
    f"window {width}x{height} colors={len(colors)} "
    f"dark={dark_pct:.2f}% edge={edge_pct:.2f}% ppm={ppm_path}{png_note}"
)
if len(colors) < 24:
    sys.exit("blank window: too few colours")
if edge_pct < 0.5:
    sys.exit("blank window: too few edges")
PY

echo "PASS: headless smoke test (artifacts in $OUT)"
