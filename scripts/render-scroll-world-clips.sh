#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/frontend/src/assets/landing/scroll-world/connected"
OUTPUT_DIR="$ROOT_DIR/frontend/src/assets/landing/scroll-world/clips"
FRAME_DIR="$(mktemp -d "${TMPDIR:-/tmp}/bw-scroll-world.XXXXXX")"
trap 'rm -rf "$FRAME_DIR"' EXIT

FPS=24
DURATION="2.5"
TRANSITION_OFFSET="1.55"
TRANSITION_DURATION="0.60"

mkdir -p "$OUTPUT_DIR"

SOURCES=(
  "income-payment.webp"
  "income-payment.webp"
  "limits-choice.webp"
  "limits-choice.webp"
  "growth-goal.webp"
  "growth-goal.webp"
  "achievement.webp"
)

NAMES=(
  "01-income"
  "02-payment"
  "03-limits"
  "04-choice"
  "05-growth"
  "06-goal"
  "07-achievement"
)

# The crops follow the lime paper road and move the active subject toward the
# right side, leaving a calm field for the landing-page copy on the left.
CROP_X=(0 300 0 300 0 220 110)
CROP_Y=(78 108 68 94 72 88 82)
TRANSITIONS=(smoothleft fade smoothleft fade smoothleft fade)

echo "Rendering frame-matched ScrollWorld clips..."

for index in "${!NAMES[@]}"; do
  source_file="$SOURCE_DIR/${SOURCES[$index]}"
  frame_file="$FRAME_DIR/${NAMES[$index]}.png"

  ffmpeg -hide_banner -loglevel error -y \
    -i "$source_file" \
    -vf "scale=2240:1260:flags=lanczos,crop=1920:1080:${CROP_X[$index]}:${CROP_Y[$index]},unsharp=5:5:0.32:3:3:0.12" \
    -frames:v 1 "$frame_file"

done

for index in 0 1 2 3 4 5; do
  current_frame="$FRAME_DIR/${NAMES[$index]}.png"
  next_frame="$FRAME_DIR/${NAMES[$((index + 1))]}.png"
  output_file="$OUTPUT_DIR/${NAMES[$index]}.mp4"
  transition="${TRANSITIONS[$index]}"

  ffmpeg -hide_banner -loglevel error -y \
    -loop 1 -framerate "$FPS" -t "$DURATION" -i "$current_frame" \
    -loop 1 -framerate "$FPS" -t "$DURATION" -i "$next_frame" \
    -filter_complex "\
      [0:v]zoompan=z='min(1+on*0.00046,1.032)':x='iw/2-(iw/zoom/2)+sin(on/16)*3':y='ih/2-(ih/zoom/2)-on*0.12':d=1:s=1600x900:fps=${FPS},hqdn3d=0.8:0.6:1.6:1.2,trim=duration=${DURATION},setpts=PTS-STARTPTS,setsar=1[current];\
      [1:v]scale=1600:900:flags=lanczos,hqdn3d=0.8:0.6:1.6:1.2,trim=duration=${DURATION},setpts=PTS-STARTPTS,setsar=1[next];\
      [current][next]xfade=transition=${transition}:duration=${TRANSITION_DURATION}:offset=${TRANSITION_OFFSET},trim=duration=${DURATION},format=yuv420p[out]" \
    -map "[out]" -an \
    -c:v libx264 -preset slow -crf 23 -profile:v high -level 4.1 \
    -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart \
    "$output_file"
done

final_index=6
final_frame="$FRAME_DIR/${NAMES[$final_index]}.png"
final_output="$OUTPUT_DIR/${NAMES[$final_index]}.mp4"

ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -framerate "$FPS" -t "$DURATION" -i "$final_frame" \
  -vf "zoompan=z='min(1+on*0.00042,1.029)':x='iw/2-(iw/zoom/2)+sin(on/18)*2':y='ih/2-(ih/zoom/2)-on*0.10':d=1:s=1600x900:fps=${FPS},hqdn3d=0.8:0.6:1.6:1.2,trim=duration=${DURATION},setsar=1,format=yuv420p" \
  -an -c:v libx264 -preset slow -crf 23 -profile:v high -level 4.1 \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart \
  "$final_output"

echo "Done. Clips written to $OUTPUT_DIR"
