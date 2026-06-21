# ClipFit v2 — Private All-in-One Media Toolkit — Design Spec

- **Date:** 2026-06-21
- **Status:** Design approved — pending spec review
- **Builds on:** v1 (single "make it fit" compressor, shipped & working)

## 1. Summary

Expand ClipFit from a one-job compressor into a **multi-tool, fully client-side
media toolkit**: compress, GIF, extract audio, convert, trim, crop, and basic
edits — plus one-tap **Share to Discord/anywhere** via the Web Share API. All
processing stays in-browser via `ffmpeg.wasm` (single-thread core). The edge
remains: private (no upload), no watermark, no signup, no limits.

## 2. Goals

- Reach and exceed competitor feature parity while keeping the privacy edge.
- Generalize the architecture to a **Job model** so each tool is a small, pure,
  testable args-builder plugged into the existing engine.
- Build in **verifiable phases**, each shippable on its own.

## 3. Non-goals (v2)

- Full timeline editor, multi-clip merge, transitions, video reverse (memory-heavy).
- Text/caption overlay (future increment).
- Two-pass "best quality" mode and batch (deferred — Increment C).
- Multithread engine (speed optimization, later).
- Monetization (still deferred behind `LicenseGate` until the validation gate).

## 4. Architecture

- **Job model** (`src/jobs/`): `Job<P> = { id, label, accept, outputName, mime,
  buildPasses(input: string, ctx: ProbeResult, params: P): string[][] }`.
  `ProbeResult = { durationSec, width, height, hasAudio }`. Each `buildPasses`
  is a **pure function** — unit-testable without the engine.
- **Generic runner** (`src/engine/ffmpegEngine.ts`): replace `runMakeItFit` with
  `runJob(file, job, params, onProgress) → { blob, mime, outputName }`. Loads the
  single-thread core, writes input, probes `ctx`, runs the job's passes, reads
  output. Keeps the existing OOM-friendly / real-error surfacing.
- **Probe** (`src/lib/probe.ts`): `probeMedia(engine, input) → ProbeResult` by
  running `ffmpeg -i` and parsing logs. Pure parsers `parseDurationSec` (exists)
  and new `parseResolution` + `parseHasAudio`, all tested.
- **Frame extract** (for crop): `extractFrame(file, atSec) → Blob(image/png)` via
  `ffmpeg -ss <t> -frames:v 1`.
- **UI**: `ToolPicker` (tabs) → `Dropzone` → per-tool params panel → `Progress`
  → `Result` (download + **Share**).
- **Web Share** (`src/lib/share.ts`): `shareFile(blob, name, mime)` using
  `navigator.canShare({files})` / `navigator.share`; falls back to download when
  unsupported (desktop browsers without share targets).

## 5. Tools (each a `Job`; core = FFmpeg 5.1 w/ libx264/265, libvpx, libmp3lame, libopus/vorbis, libwebp, libfreetype/ass)

1. **Fit** (existing `makeItFit`) — add a **mute-audio toggle** and an
   **estimated-output preview** (`≈ {downscaledW}×{downscaledH}, ~{targetMB} MB`
   from `ctx` + target). Args unchanged (scale + veryfast + yuv420p + bitrate).
2. **GIF** — two passes: `-vf fps=F,scale=W:-1:flags=lanczos,palettegen` →
   `-i input -i palette.png -lavfi fps=F,scale=W:-1:flags=lanczos,paletteuse`.
   Defaults F=12, W=480. Params: `{ fps, width }`. Output `image/gif`.
3. **Extract audio** — `-vn -c:a libmp3lame -b:a 192k` → mp3 (or `pcm_s16le` wav).
   Params: `{ format: 'mp3' | 'wav' }`.
4. **Convert** — MP4 (`libx264 -pix_fmt yuv420p -c:a aac`) or WebM
   (`libvpx-vp9 -c:a libopus`). Params: `{ target: 'mp4' | 'webm' }`.
5. **Trim** — `-ss {start} -to {end} -c copy` (fast, keyframe-aligned). Params:
   `{ startSec, endSec }`, validated `0 ≤ start < end ≤ duration`.
6. **Crop** (interactive) — `crop={w}:{h}:{x}:{y}` (even dims) + re-encode
   (`libx264 -pix_fmt yuv420p -c:a copy`). Params: `{ x, y, w, h }` in source px.
   See §6 for the UI.
7. **Edit** (composable) — builds a filter chain from optional transforms, one
   re-encode: **rotate** 90/180/270 (`transpose`/`transpose,transpose`), **flip**
   (`hflip`/`vflip`), **speed** 0.5–2× (`setpts=PTS/r` + `atempo=r`), **volume**
   (`volume=g`), and **frame rate** (`fps=N` — typically to *reduce* fps, e.g.
   60→30/24, which also shrinks the file; raising fps only duplicates frames).
   Params: `{ rotate?, flipH?, flipV?, speed?, fps?, volumeDb? }`. The
   args-builder composes `-vf`/`-af` from whichever are set.

## 6. Crop UI (the one hand-built interactive component)

- On selecting Crop: `extractFrame(file, min(1, duration/2))` → show the PNG as a
  fixed-width backdrop.
- Overlay a **draggable + resizable rectangle** with 8 handles; optional
  **aspect-lock presets** (Free / 1:1 / 9:16 / 16:9) constrain resizing.
- **Coordinate mapping** is a pure, tested function:
  `displayRect × (sourceW / displayW) → sourcePx`, clamped to bounds, rounded to
  even width/height (yuv420p requirement), min 16px.
- Output `{x,y,w,h}` → the Crop job. (Using an ffmpeg-extracted frame, not a
  `<video>` element, so the preview works for any format the core decodes.)

## 7. Error handling

- Reuse the engine's failure surfacing (friendly OOM message; real ffmpeg error
  tail otherwise).
- Validate params before running (trim range, crop bounds/min size, speed range).
- Web Share unsupported / user-cancelled → silent fallback to download.

## 8. Testing

- **Unit (TDD):** every `buildPasses` (fit, gif, audio, convert, trim, crop,
  edit), `parseResolution`, `parseHasAudio`, and the crop coordinate-mapping fn.
- **E2E harness:** run each tool's args through native ffmpeg on a real clip and
  assert a valid, non-empty output (extends the existing `/tmp` harness).
- **Engine/UI:** build + a real-file browser run per phase.

## 9. Build phases (each shippable & verified before the next)

1. **Foundation** — Job model + generic `runJob` + probe upgrade + `ToolPicker` +
   `shareFile` (Web Share) + refactor **Fit** into the model (incl. mute toggle +
   estimated preview). *Ships: today's tool + Share, restructured.*
2. **Simple tools** — GIF, Extract audio, Convert, Trim.
3. **Crop** — frame extract + interactive crop box + mapping.
4. **Edit** — rotate/flip/speed/volume composer.

## 10. Delegation (local gpt-oss-20b)

- Delegate: param-panel components, ToolPicker, Result/Share button markup.
- Keep in main session: all `buildPasses` args-builders, the generic runner,
  probe parsers, the crop coordinate-mapping logic, and the interactive crop box.
