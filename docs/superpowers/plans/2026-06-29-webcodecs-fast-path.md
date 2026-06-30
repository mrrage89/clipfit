# WebCodecs Fast-Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transparently accelerate the Compress operation with a hardware WebCodecs pipeline when the browser supports the needed codecs, falling back to ffmpeg.wasm for everything else — zero functional regressions.

**Architecture:** A new `src/engine/webcodecs/` module (caps probe, demux, pipeline, mux) plus a `router` that picks WebCodecs vs ffmpeg per Compress job. Pure-logic units (router, bitrate budget, caps shape) are TDD'd in Vitest with WebCodecs mocked; the browser pipeline is implemented and verified manually against real files, de-risked by a spike in Task 1.

**Tech Stack:** TypeScript, WebCodecs (`VideoDecoder`/`VideoEncoder`), `mp4box` (BSD-3, demux), `mp4-muxer` + `webm-muxer` (MIT), OffscreenCanvas. Existing: Vite/React/Vitest, ffmpeg.wasm.

---

## File Structure

- `src/engine/webcodecs/types.ts` — shared types (`WebcodecsCaps`, `CompressRouteInput`, `EngineChoice`, `DemuxResult`, `VideoMeta`).
- `src/engine/webcodecs/caps.ts` — memoized capability probe (`webcodecsCaps`, `canDecodeCodec`).
- `src/engine/webcodecs/budget.ts` — `videoKbpsForCopiedAudio` (pure size→bitrate math).
- `src/engine/webcodecs/router.ts` — `selectCompressEngine` (pure decision).
- `src/engine/webcodecs/demux.ts` — mp4box.js wrapper → `DemuxResult`.
- `src/engine/webcodecs/mux.ts` — mp4-muxer / webm-muxer wrappers.
- `src/engine/webcodecs/compress.ts` — decode → transform → encode → mux pipeline.
- `src/engine/webcodecs/run.ts` — `runCompressFast` orchestrator + ffmpeg fallback.
- `src/engine/webcodecs/spike.ts` — throwaway end-to-end proof (deleted after Task 1).
- `tests/webcodecsRouter.test.ts`, `tests/webcodecsBudget.test.ts`, `tests/webcodecsCaps.test.ts`.
- Modify `src/App.tsx` — route the Compress run through `runCompressFast`.

---

## Task 1: Dependencies + spike (de-risk the whole feature)

**Files:**
- Modify: `package.json` (deps)
- Create: `src/engine/webcodecs/spike.ts`

- [ ] **Step 1: Install libraries**

```bash
cd ~/clipfit && npm i mp4box mp4-muxer webm-muxer
```
Expected: added to `dependencies`, lockfile updated.

- [ ] **Step 2: Write a minimal end-to-end spike** (`src/engine/webcodecs/spike.ts`)

A single exported `async function spike(file: File): Promise<{ blob: Blob; ms: number }>` that: demuxes the MP4 with mp4box, decodes with `VideoDecoder`, re-encodes each frame with `VideoEncoder` (`avc1` for mp4, else `vp09`) at a fixed 1.5 Mbps, muxes with mp4-muxer/webm-muxer, returns the output blob + elapsed ms. No trim, no scale, no audio yet — just prove the chain and measure speed.

- [ ] **Step 3: Verify in the browser against a real file**

Temporarily expose it (e.g. `window.__spike = spike` in `App.tsx`), run `npm run dev`, load a large MP4, call `await __spike(file)` in the console. Compare elapsed ms against the current ffmpeg compress time for the same file.
Expected: a valid playable output blob AND a clear speedup (target: multiples faster). On Linux Chromium expect `avc1` to fail → confirm `vp09` path works.

- [ ] **Step 4: Decision gate**

If no clear speedup or the chain can't produce valid output, STOP and report — the feature's premise is unproven. Otherwise continue. Record the measured timings in the commit message.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/engine/webcodecs/spike.ts
git commit -m "spike(webcodecs): prove decode→encode→mux end-to-end + measure speed"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/engine/webcodecs/types.ts`

- [ ] **Step 1: Define the shared types**

```ts
export type EngineChoice = 'webcodecs' | 'ffmpeg';

export interface WebcodecsCaps {
  encodeAvc: boolean; // H.264 / avc1
  encodeVp9: boolean; // vp09
  encodeAv1: boolean; // av01
}

export interface CompressRouteInput {
  quality: 'balanced' | 'best';
  format: 'mp4' | 'webm';
  hasUnsupportedEdits: boolean; // crop/rotate/flip/speed/fps/volume present
  inputContainer: 'mp4' | 'other'; // mp4box-demuxable (mp4/mov/m4v) => 'mp4'
  inputDecodable: boolean; // VideoDecoder supports the input codec
  outputEncodable: boolean; // caps say the chosen output codec is encodable
  audioOk: boolean; // no audio || muted || copyable into the target container
}

export interface VideoMeta {
  codec: string; // WebCodecs codec string, e.g. 'avc1.640028'
  width: number;
  height: number;
  fps: number;
  durationSec: number;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd ~/clipfit && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/engine/webcodecs/types.ts
git commit -m "feat(webcodecs): shared types for the fast-path"
```

---

## Task 3: Router decision (TDD, pure)

**Files:**
- Create: `src/engine/webcodecs/router.ts`
- Test: `tests/webcodecsRouter.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { selectCompressEngine } from '../src/engine/webcodecs/router';
import type { CompressRouteInput } from '../src/engine/webcodecs/types';

const ok: CompressRouteInput = {
  quality: 'balanced', format: 'mp4', hasUnsupportedEdits: false,
  inputContainer: 'mp4', inputDecodable: true, outputEncodable: true, audioOk: true,
};

describe('selectCompressEngine', () => {
  it('picks webcodecs when everything is supported', () => {
    expect(selectCompressEngine(ok)).toBe('webcodecs');
  });
  it('falls back for best/two-pass', () => {
    expect(selectCompressEngine({ ...ok, quality: 'best' })).toBe('ffmpeg');
  });
  it('falls back when unsupported edits are present', () => {
    expect(selectCompressEngine({ ...ok, hasUnsupportedEdits: true })).toBe('ffmpeg');
  });
  it('falls back for non-mp4 input containers', () => {
    expect(selectCompressEngine({ ...ok, inputContainer: 'other' })).toBe('ffmpeg');
  });
  it('falls back when input is not decodable', () => {
    expect(selectCompressEngine({ ...ok, inputDecodable: false })).toBe('ffmpeg');
  });
  it('falls back when output is not encodable', () => {
    expect(selectCompressEngine({ ...ok, outputEncodable: false })).toBe('ffmpeg');
  });
  it('falls back when audio cannot be copied', () => {
    expect(selectCompressEngine({ ...ok, audioOk: false })).toBe('ffmpeg');
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `cd ~/clipfit && npx vitest run tests/webcodecsRouter.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import type { CompressRouteInput, EngineChoice } from './types';

export function selectCompressEngine(r: CompressRouteInput): EngineChoice {
  if (r.quality !== 'balanced') return 'ffmpeg';
  if (r.hasUnsupportedEdits) return 'ffmpeg';
  if (r.inputContainer !== 'mp4') return 'ffmpeg';
  if (!r.inputDecodable) return 'ffmpeg';
  if (!r.outputEncodable) return 'ffmpeg';
  if (!r.audioOk) return 'ffmpeg';
  return 'webcodecs';
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd ~/clipfit && npx vitest run tests/webcodecsRouter.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/webcodecs/router.ts tests/webcodecsRouter.test.ts
git commit -m "feat(webcodecs): pure router for webcodecs-vs-ffmpeg compress"
```

---

## Task 4: Bitrate budget for copied audio (TDD, pure)

**Files:**
- Create: `src/engine/webcodecs/budget.ts`
- Test: `tests/webcodecsBudget.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { videoKbpsForCopiedAudio } from '../src/engine/webcodecs/budget';

describe('videoKbpsForCopiedAudio', () => {
  it('budgets remaining bytes to video after subtracting audio', () => {
    // 10s, 10MB target * 0.95 = 9.5MB usable, minus 0.5MB audio = 9.0MB video
    // 9.0MB * 8 / 1000 / 10 = 7200 kbps
    const kbps = videoKbpsForCopiedAudio({
      targetBytes: 10 * 1024 * 1024, durationSec: 10,
      audioBytes: 0.5 * 1024 * 1024, safetyMargin: 0.95,
    });
    expect(kbps).toBe(7200);
  });
  it('returns 0 when audio alone exceeds the budget (caller falls back)', () => {
    expect(videoKbpsForCopiedAudio({
      targetBytes: 1 * 1024 * 1024, durationSec: 10,
      audioBytes: 2 * 1024 * 1024, safetyMargin: 0.95,
    })).toBe(0);
  });
  it('returns 0 for non-positive duration', () => {
    expect(videoKbpsForCopiedAudio({
      targetBytes: 10 * 1024 * 1024, durationSec: 0, audioBytes: 0, safetyMargin: 0.95,
    })).toBe(0);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `cd ~/clipfit && npx vitest run tests/webcodecsBudget.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
export function videoKbpsForCopiedAudio(opts: {
  targetBytes: number;
  durationSec: number;
  audioBytes: number;
  safetyMargin: number;
}): number {
  if (opts.durationSec <= 0) return 0;
  const usable = opts.targetBytes * opts.safetyMargin - opts.audioBytes;
  if (usable <= 0) return 0;
  const kbps = (usable * 8) / 1000 / opts.durationSec;
  return Math.max(1, Math.floor(kbps));
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd ~/clipfit && npx vitest run tests/webcodecsBudget.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/webcodecs/budget.ts tests/webcodecsBudget.test.ts
git commit -m "feat(webcodecs): audio-subtracted video bitrate budget"
```

---

## Task 5: Capability probe (caps.ts) with mocked-codec test

**Files:**
- Create: `src/engine/webcodecs/caps.ts`
- Test: `tests/webcodecsCaps.test.ts`

- [ ] **Step 1: Implement the probe**

```ts
import type { WebcodecsCaps } from './types';

let cached: Promise<WebcodecsCaps> | null = null;

async function canEncode(codec: string): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false;
  try {
    const res = await VideoEncoder.isConfigSupported({
      codec, width: 1280, height: 720, bitrate: 1_000_000,
      hardwareAcceleration: 'prefer-hardware',
    } as VideoEncoderConfig);
    return !!res.supported;
  } catch {
    return false;
  }
}

async function probe(): Promise<WebcodecsCaps> {
  const [encodeAvc, encodeVp9, encodeAv1] = await Promise.all([
    canEncode('avc1.42001f'),
    canEncode('vp09.00.10.08'),
    canEncode('av01.0.04M.08'),
  ]);
  return { encodeAvc, encodeVp9, encodeAv1 };
}

export function webcodecsCaps(): Promise<WebcodecsCaps> {
  if (!cached) cached = probe();
  return cached;
}

export async function canDecodeCodec(codec: string): Promise<boolean> {
  if (typeof VideoDecoder === 'undefined') return false;
  try {
    const res = await VideoDecoder.isConfigSupported({ codec } as VideoDecoderConfig);
    return !!res.supported;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Write a test mocking the globals**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => { vi.resetModules(); });

it('reports encode caps from VideoEncoder.isConfigSupported', async () => {
  vi.stubGlobal('VideoEncoder', {
    isConfigSupported: vi.fn(async (c: { codec: string }) => ({
      supported: c.codec.startsWith('vp09') || c.codec.startsWith('av01'),
    })),
  });
  const { webcodecsCaps } = await import('../src/engine/webcodecs/caps');
  const caps = await webcodecsCaps();
  expect(caps).toEqual({ encodeAvc: false, encodeVp9: true, encodeAv1: true });
});

it('returns all-false when VideoEncoder is undefined', async () => {
  vi.stubGlobal('VideoEncoder', undefined);
  const { webcodecsCaps } = await import('../src/engine/webcodecs/caps');
  expect(await webcodecsCaps()).toEqual({ encodeAvc: false, encodeVp9: false, encodeAv1: false });
});
```

- [ ] **Step 3: Run, verify pass**

Run: `cd ~/clipfit && npx vitest run tests/webcodecsCaps.test.ts`
Expected: PASS (2 tests). (Mirrors the dev-machine finding: avc false, vp9/av1 true.)

- [ ] **Step 4: Commit**

```bash
git add src/engine/webcodecs/caps.ts tests/webcodecsCaps.test.ts
git commit -m "feat(webcodecs): memoized capability probe"
```

---

## Task 6: Demux wrapper (demux.ts)

**Files:**
- Create: `src/engine/webcodecs/demux.ts`

- [ ] **Step 1: Implement the mp4box demux**

Export `async function demuxMp4(file: File): Promise<DemuxResult>` where:

```ts
export interface DemuxResult {
  meta: VideoMeta;
  description: Uint8Array; // avcC/hvcC for the VideoDecoder config
  videoSamples: EncodedVideoChunkInit[]; // {type,timestamp,duration,data} per frame
  audio: { codec: string; samples: EncodedAudioChunkInit[]; description?: Uint8Array } | null;
}
```

Use `mp4box`: create a file, feed the `ArrayBuffer` (set `buffer.fileStart = 0`), `onReady` gives tracks; pull the video track's `avcC`/`hvcC` box for `description`; use `mp4box.extractTracks` + `onSamples` to collect samples, converting each to `{ type: sample.is_sync ? 'key' : 'delta', timestamp: sample.cts * 1e6 / timescale, duration: sample.duration * 1e6 / timescale, data: sample.data }`. Derive `fps` from sample count / duration. Collect audio samples the same way (codec from track, e.g. `mp4a.40.2`). The exact box-extraction details are pinned during the Task 1 spike — reuse that working code here.

- [ ] **Step 2: Verify in the browser**

Add a temporary `window.__demux = demuxMp4`, `npm run dev`, load an MP4, confirm `meta` (dims/fps/duration), a non-empty `videoSamples` array with the first sample `type: 'key'`, and a populated `description`.
Expected: correct metadata and sample counts roughly matching duration × fps.

- [ ] **Step 3: Commit**

```bash
git add src/engine/webcodecs/demux.ts
git commit -m "feat(webcodecs): mp4box demux → samples + decoder description"
```

---

## Task 7: Mux wrappers (mux.ts)

**Files:**
- Create: `src/engine/webcodecs/mux.ts`

- [ ] **Step 1: Implement a unified muxer facade**

```ts
export interface Muxer {
  addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): void;
  addAudioChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): void;
  finalize(): Blob;
}
export function createMuxer(opts: {
  format: 'mp4' | 'webm';
  width: number; height: number;
  videoCodec: 'avc' | 'vp9' | 'av1';
  audio: { codec: 'aac' | 'opus'; sampleRate: number; channels: number } | null;
}): Muxer;
```

Wrap `mp4-muxer`'s `Muxer` + `ArrayBufferTarget` for `format==='mp4'` (video codec `'avc'`/`'av1'`, audio `'aac'`/`'opus'`) and `webm-muxer` for `'webm'` (video `'V_VP9'`/`'V_AV01'`, audio `'A_OPUS'`). `finalize()` returns `new Blob([target.buffer], { type })`. Match the library constructor option names exactly (verified in the spike).

- [ ] **Step 2: Verify in the browser**

Reuse the spike path but route muxing through `createMuxer`; confirm the produced MP4 and WebM blobs play in a `<video>`.
Expected: both play with correct duration.

- [ ] **Step 3: Commit**

```bash
git add src/engine/webcodecs/mux.ts
git commit -m "feat(webcodecs): unified mp4/webm muxer facade"
```

---

## Task 8: Compress pipeline (compress.ts)

**Files:**
- Create: `src/engine/webcodecs/compress.ts`

- [ ] **Step 1: Implement the pipeline**

Export:

```ts
export interface FastCompressParams {
  file: File;
  format: 'mp4' | 'webm';
  videoCodec: string; // encoder codec string from caps (avc1/vp09/av01)
  targetBytes: number;
  mute: boolean;
  trim?: { startSec: number; endSec: number };
  onProgress?: (ratio: number) => void;
}
export async function compressFast(p: FastCompressParams): Promise<Blob>;
```

Pipeline: `demuxMp4(file)` → compute audio bytes (sum of kept audio sample sizes; 0 if mute) → `videoKbpsForCopiedAudio(...)` (fall back by throwing a sentinel if it returns 0) → target dims via `pickMaxDimension(kbps)` capped to source → create `VideoDecoder` from `description`, `VideoEncoder` at `{codec, width, height, bitrate, hardwareAcceleration:'prefer-hardware'}` → for each video sample in `[trim.start, trim.end]` (seek to keyframe ≤ start): decode; in the decoder `output` callback, if dims differ draw the `VideoFrame` to a reused `OffscreenCanvas` and `new VideoFrame(canvas, {timestamp})`, else pass through; `encoder.encode(frame)`; `frame.close()`. Apply backpressure: `await` when `encoder.encodeQueueSize` exceeds a cap (e.g. 8). On `encoder.output`, `muxer.addVideoChunk`. After flush, add copied audio chunks (unless mute). `muxer.finalize()` → Blob. Report progress as encoded/total frames. Reuse the spike's verified decoder/encoder wiring.

- [ ] **Step 2: Verify in the browser**

Temporary `window.__compress = compressFast`; test: full clip, trimmed clip, mp4 + webm, audio-kept + muted. Check output plays, is under target size, and trim boundaries are correct.
Expected: all variants produce valid, on-target output.

- [ ] **Step 3: Commit**

```bash
git add src/engine/webcodecs/compress.ts
git commit -m "feat(webcodecs): compress pipeline (trim, downscale, audio-copy, backpressure)"
```

---

## Task 9: Orchestrator + fallback (run.ts) with fallback test

**Files:**
- Create: `src/engine/webcodecs/run.ts`
- Test: `tests/webcodecsRun.test.ts`

- [ ] **Step 1: Implement the orchestrator**

```ts
import { selectCompressEngine } from './router';
import { compressFast, type FastCompressParams } from './compress';

export async function runCompressFast(args: {
  route: import('./types').CompressRouteInput;
  fast: () => Promise<Blob>;
  ffmpeg: () => Promise<Blob>;
}): Promise<{ blob: Blob; engine: 'webcodecs' | 'ffmpeg' }> {
  if (selectCompressEngine(args.route) === 'ffmpeg') {
    return { blob: await args.ffmpeg(), engine: 'ffmpeg' };
  }
  try {
    const blob = await args.fast();
    if (!blob || blob.size === 0) throw new Error('empty output');
    return { blob, engine: 'webcodecs' };
  } catch (e) {
    console.warn('[clipfit] webcodecs failed, falling back to ffmpeg:', e);
    return { blob: await args.ffmpeg(), engine: 'ffmpeg' };
  }
}
export type { FastCompressParams };
export { compressFast };
```

- [ ] **Step 2: Write the fallback test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { runCompressFast } from '../src/engine/webcodecs/run';
import type { CompressRouteInput } from '../src/engine/webcodecs/types';

const route: CompressRouteInput = {
  quality: 'balanced', format: 'mp4', hasUnsupportedEdits: false,
  inputContainer: 'mp4', inputDecodable: true, outputEncodable: true, audioOk: true,
};
const fastBlob = new Blob(['x']);
const ffmpegBlob = new Blob(['y']);

it('uses webcodecs when it succeeds', async () => {
  const r = await runCompressFast({ route, fast: async () => fastBlob, ffmpeg: async () => ffmpegBlob });
  expect(r.engine).toBe('webcodecs');
  expect(r.blob).toBe(fastBlob);
});
it('falls back to ffmpeg when webcodecs throws', async () => {
  const ffmpeg = vi.fn(async () => ffmpegBlob);
  const r = await runCompressFast({ route, fast: async () => { throw new Error('boom'); }, ffmpeg });
  expect(r.engine).toBe('ffmpeg');
  expect(ffmpeg).toHaveBeenCalledOnce();
});
it('falls back when webcodecs returns an empty blob', async () => {
  const r = await runCompressFast({ route, fast: async () => new Blob([]), ffmpeg: async () => ffmpegBlob });
  expect(r.engine).toBe('ffmpeg');
});
it('skips webcodecs entirely when the route says ffmpeg', async () => {
  const fast = vi.fn(async () => fastBlob);
  const r = await runCompressFast({ route: { ...route, quality: 'best' }, fast, ffmpeg: async () => ffmpegBlob });
  expect(r.engine).toBe('ffmpeg');
  expect(fast).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run, verify pass**

Run: `cd ~/clipfit && npx vitest run tests/webcodecsRun.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4: Commit**

```bash
git add src/engine/webcodecs/run.ts tests/webcodecsRun.test.ts
git commit -m "feat(webcodecs): runCompressFast orchestrator with transparent ffmpeg fallback"
```

---

## Task 10: Wire into App + full verification

**Files:**
- Modify: `src/App.tsx` (the `run(fitJob, ...)` compress path only)

- [ ] **Step 1: Build the route input + branch the compress run**

In `App.tsx`, where Compress currently calls `run(fitJob, {...}, t.bytes)`: build a `CompressRouteInput` from the current state (probe gives input codec/container/audio; `webcodecsCaps()` gives encode booleans; `hasUnsupportedEdits` = any of crop/rotate/flip/speed/fps/volume set on `activeEdits`). Call `runCompressFast({ route, fast: () => compressFast({...}), ffmpeg: () => <existing ffmpeg runJob returning a Blob> })`. Feed the resulting blob into the existing `setResult(...)`. Leave GIF, audio-export, and the non-balanced/edited paths calling the ffmpeg engine exactly as today. Keep the temporary `window.__*` hooks removed.

- [ ] **Step 2: Remove the spike file**

```bash
git rm src/engine/webcodecs/spike.ts
```

- [ ] **Step 3: Full gate**

Run: `cd ~/clipfit && npm run typecheck && npx vitest run && npm run build && npm run build:ext`
Expected: typecheck clean, all tests pass (existing 56 + new ~16), both builds succeed.

- [ ] **Step 4: Manual verification matrix** (`npm run dev`, real files)

Verify each and confirm console shows which engine ran:
  - Large MP4 (~800 MB): webcodecs, no OOM, multiples faster than before, plays.
  - Trimmed MP4 → mp4: correct trim, on-target size.
  - MP4 → webm: webcodecs (vp9), plays.
  - Audio kept vs muted: audio present/absent correctly.
  - Best quality: routes to ffmpeg (identical to today).
  - Crop/rotate enabled: routes to ffmpeg.
  - A non-mp4 input (e.g. .webm): routes to ffmpeg.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(webcodecs): route balanced Compress through the WebCodecs fast-path"
```

---

## Notes for the executor

- **The spike (Task 1) pins the exact mp4box/muxer API calls.** Tasks 6–8 say "reuse the spike's verified code" deliberately — finalize library specifics there, not from memory.
- **Never change the ffmpeg path.** All new behavior is additive and gated by the router; the fallback must reproduce today's output exactly.
- **WebCodecs objects leak GPU memory** — always `frame.close()` after encode/transform and bound the in-flight queue.
- This branch must NOT merge to master until the full verification matrix passes (master auto-deploys to the live site).
