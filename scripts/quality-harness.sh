#!/usr/bin/env bash
# Throwaway verification (not shipped logic): compare OLD vs NEW "Best" encode
# settings at equal bitrate on a real clip, reported as VMAF vs a near-lossless
# reference at the same resolution.
#   Usage: scripts/quality-harness.sh <clip> [seconds]
set -e
SRC="$1"; SECS="${2:-10}"; W=854
clip () { ffmpeg -y -loglevel error -i "$SRC" -t "$SECS" "$@"; }

# near-lossless reference at the test resolution
clip -vf "scale='min($W,iw)':-2" -c:v libx264 -preset veryfast -crf 0 -pix_fmt yuv420p -an /tmp/ref.mp4
vmaf () { ffmpeg -i "$1" -i /tmp/ref.mp4 -lavfi "[0:v][1:v]libvmaf" -f null - 2>&1 | grep -oiE "VMAF score: [0-9.]+" | grep -oE "[0-9.]+"; }
kb () { echo "$(( $(stat -c%s "$1") / 1024 ))KB"; }

for KBPS in 500 1000 2000; do
  clip -vf "scale='min($W,iw)':-2" -c:v libx264 -preset medium   -b:v ${KBPS}k -pix_fmt yuv420p -an /tmp/old.mp4
  clip -vf "scale='min($W,iw)':-2" -c:v libx264 -preset veryslow  -b:v ${KBPS}k -pix_fmt yuv420p -an /tmp/new.mp4
  clip -vf "scale='min($W,iw)':-2" -c:v libx264 -preset veryslow -x264-params aq-mode=3 -b:v ${KBPS}k -pix_fmt yuv420p -an /tmp/newaq.mp4
  printf "== %sk ==\n  old medium:   VMAF %-7s %s\n  new veryslow: VMAF %-7s %s\n  new + aq3:    VMAF %-7s %s\n" \
    "$KBPS" "$(vmaf /tmp/old.mp4)" "$(kb /tmp/old.mp4)" \
    "$(vmaf /tmp/new.mp4)" "$(kb /tmp/new.mp4)" \
    "$(vmaf /tmp/newaq.mp4)" "$(kb /tmp/newaq.mp4)"
done
rm -f /tmp/old.mp4 /tmp/new.mp4 /tmp/newaq.mp4 /tmp/ref.mp4
