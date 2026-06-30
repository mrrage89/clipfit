# WebCodecs Fast-Path for Compress — Design

**Date:** 2026-06-29
**Status:** Approved. User waived the written-spec review gate — proceed straight to planning and implementation.

## Summary

Add a hardware-accelerated WebCodecs pipeline that **transparently accelerates the
Compress operation** when the browser supports the needed codecs, falling back to
the existing ffmpeg.wasm engine for everything it can't handle. Purely additive:
no functional coverage is lost, the output format is exactly what the user chose,
and the 2 GB wasm-heap ceiling (large-file OOM) disappears on the fast-path because
frames stream rather than loading the whole file into memory.

## Background & constraints

- Current engine (`src/engine/ffmpegEngine.ts`): single-thread ffmpeg.wasm, 2 GB
  growable heap. A `Job` builds ffmpeg arg-arrays; `runJob` writes the input into
  the wasm FS, runs passes, returns a blob. Large files are slow (single-thread
  decode) and can OOM.
- WebCodecs does only raw decode (`VideoDecoder`) and encode (`VideoEncoder`) on the
  GPU. It does NOT demux/mux, filter, or bitrate-target — we assemble those.
- Codec availability varies per browser/OS. Measured on the dev machine
  (Linux Chromium): H.264 (`avc1`) encode = unavailable; VP9 (`vp09`) and AV1
  (`av01`) encode = available. Most Windows/macOS/Android Chrome users DO have
  H.264 encode. Availability must therefore be **probed at runtime, per session**.

## Goals / non-goals

**Goals (v1):**
- Transparently speed up Compress (Balanced quality) via WebCodecs when available.
- Support **trim, mute, and downscale-to-fit** on the fast-path.
- Preserve the user's chosen output format (MP4/H.264 or WebM/VP9·AV1) — never
  silently change it.
- Keep size-targeting accurate.
- Zero functional regressions: anything unsupported falls back to ffmpeg.

**Non-goals (deferred to v2 / Pro):**
- crop / rotate / flip / speed / volume on the fast-path → fall back to ffmpeg in v1.
- Best/two-pass on the fast-path → stays ffmpeg (WebCodecs is single-pass).
- Audio **re-encode** (v1 copies source audio; can't-copy → fallback).
- GIF and audio-export → always ffmpeg.
- WebM/MKV/AVI *input* demux (v1 demuxes MP4/MOV only; other inputs → ffmpeg).
- AV1 output as a Pro option + advanced encode controls (later).

## Architecture

### Engine selection (router)
`selectCompressEngine(params, ctx, caps)` chooses WebCodecs **iff ALL hold**:
- job = Compress and `quality === 'balanced'`
- active edits ⊆ {trim, mute} (downscale is implicit from the size target)
- input container is MP4/MOV (mp4box-demuxable)
- input video codec is `VideoDecoder`-decodable (per probe)
- output video codec is `VideoEncoder`-encodable (`avc1` for mp4; `vp09`/`av01` for webm)
- audio is absent, muted, or copyable into the output container
  (AAC → mp4; opus/vorbis → webm)

Otherwise → existing ffmpeg path, unchanged.

### Capability probe
`webcodecsCaps()` — memoized, async. Uses `VideoDecoder.isConfigSupported` /
`VideoEncoder.isConfigSupported` with `hardwareAcceleration: 'prefer-hardware'` to
report which input/output codecs are usable. Runs once per session; cached.

### Module layout
- `src/engine/webcodecs/caps.ts` — capability probe (memoized).
- `src/engine/webcodecs/demux.ts` — mp4box.js wrapper → `{ videoChunks, audioSamples, meta }`.
- `src/engine/webcodecs/compress.ts` — the decode → transform → encode → mux pipeline.
- `src/engine/webcodecs/mux.ts` — thin wrappers over mp4-muxer / webm-muxer.
- `src/engine/router.ts` — `selectCompressEngine` + a unified `runCompress` entry
  that tries WebCodecs then falls back.
- ffmpeg path stays in `ffmpegEngine.ts`, unchanged.

## The pipeline (`compress.ts`)

1. **Demux** (mp4box.js): parse MP4/MOV → encoded video chunks (timestamps +
   decoder description), encoded audio samples (kept for copy), and metadata
   (codec, width, height, fps, duration, rotation).
2. **Decode**: `VideoDecoder` (prefer-hardware) from the demuxed description →
   `VideoFrame`s in presentation order. For **trim**: seek to the keyframe ≤ start,
   decode forward, drop frames before start, stop after end.
3. **Transform**: if target dims < source dims (downscale to fit the bitrate
   budget), draw each frame onto a reused `OffscreenCanvas` at target size and build
   a new `VideoFrame`; if dims are unchanged, pass the frame straight to the encoder
   (no canvas — fastest).
4. **Encode**: `VideoEncoder` (prefer-hardware) with the output codec, target dims,
   and `bitrate` from `computeVideoKbps`. Bounded encoder queue with backpressure so
   decode and encode run concurrently without unbounded memory.
5. **Audio (copy)**: feed demuxed encoded audio samples straight into the muxer's
   audio track (no re-encode). Mute → omit.
6. **Mux**: mp4-muxer (MP4) or webm-muxer (WebM), interleaving encoded video chunks +
   copied audio → a final `Blob` with the same mime/downloadName the ffmpeg path
   produces.

### Throughput tuning (the point of the feature)
- `hardwareAcceleration: 'prefer-hardware'` on both decoder and encoder.
- Skip the canvas/transform stage entirely when output dims == input dims.
- Concurrent decode ↔ encode with a bounded in-flight queue; await encoder backpressure.
- One reused `OffscreenCanvas`; close `VideoFrame`s promptly (they hold GPU memory).

## Size / bitrate budgeting

Reuse `computeVideoKbps` and `pickMaxDimension`. Audio is copied, so its exact byte
size is known from the demux: subtract it from `targetBytes` and budget the remainder
to video bitrate over the (trimmed) duration. Single-pass VBR + the existing safety
margin keeps output under target. Best/two-pass (which needs accuracy single-pass
WebCodecs can't give) stays on ffmpeg.

## Fallback & error handling (safety net)

`runCompress` wraps the WebCodecs attempt in try/catch. ANY failure —
`isConfigSupported` false, a decoder/encoder error callback, a demux/mux throw, or an
empty produced blob — discards partial work and **re-runs the job on ffmpeg.wasm**,
transparently. Consequences:
- WebCodecs can never make a job fail that ffmpeg could complete.
- Worst case == today's speed; best case == hardware-fast.
- Large-file OOM is only possible on the fallback (the WebCodecs path streams).

A one-line dev log records which engine ran; no user-facing change.

## Progress reporting

Progress ratio = encoded-frame-count ÷ estimated-total-frames (duration × fps),
clamped 0–1, wired to the same `onProgress` the UI already consumes. Phase labels
unchanged.

## Dependencies (all permissively licensed, bundled locally for the MV3 build)

- `mp4box` (BSD-3-Clause) — MP4/MOV demux.
- `mp4-muxer` (MIT) — MP4 mux.
- `webm-muxer` (MIT) — WebM mux.

## Testing

- **Unit (Vitest, WebCodecs mocked):** the router decision table
  (caps × format × edits × audio → engine) and the audio-subtracted bitrate budget.
  Pure logic; stays green in jsdom.
- **Browser smoke (gated):** a minimal decode → encode → mux of a tiny generated
  clip, skipped where WebCodecs is unavailable.
- **Manual verification matrix:** real-file checks — the ~800 MB case (speed + no
  OOM), a trimmed clip, MP4 and WebM output, audio-kept and muted, and a
  forced-fallback (Best quality) confirming identical results. Record
  WebCodecs-vs-ffmpeg timings.

## Risks & mitigations

- **Demux + audio-copy interleaving is the fiddliest part.** If audio-copy proves
  unreliable, degrade to "mute or fall back" — still ships the full video speedup.
  The router gates most incompatibilities up front.
- **Codec quirks** (dev machine: H.264 encode false). Probe-driven routing — MP4
  jobs fall back there, WebM jobs go fast; correct everywhere.
- **A/V sync / timestamp drift** on trim. Carry through original timestamps; validate
  on the manual matrix.
- **VideoFrame leaks** (GPU memory). Close frames immediately; bounded in-flight queue.

## Implementation milestones

1. **Spike (de-risk first):** hardcoded decode → encode → mux of one real MP4
   end-to-end; measure speed vs ffmpeg. Gate the rest of the work on a clear win.
2. Capability probe + router + unit tests.
3. Pipeline (demux, decode, transform, encode, mux) through `runCompress` + fallback.
4. Progress + integration into `App.run`.
5. Manual verification matrix; tune throughput.
6. Ship behind the existing Compress UI (no UI change).
