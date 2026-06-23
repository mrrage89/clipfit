# ClipFit — Sender-side compression quality (design)

- **Date:** 2026-06-23
- **Status:** Approved (brainstorm), pending implementation plan
- **Branch:** `feat/compress-quality`

## Goal

Squeeze more *perceived* quality out of ClipFit's compressed output at the same
size budget, **without changing the output codec** — it stays H.264 so the result
plays everywhere (Discord, mobile, old devices, Linux Chromium). This is the
physics-honest answer to "keep quality": lose less at encode time, since detail
destroyed by compression can't be restored afterward.

## Background & measurements (2026-06-23)

Native VMAF at a fixed bitrate (~600 kbps, 720p), wasm is ~5–15× slower:

| Encode | VMAF | Encode time | Note |
|---|---|---|---|
| x264 `medium` (current "Best") | 83.0 | 0.45s | baseline |
| x264 `veryslow` | 85.9 | 1.5s | +2.9, smaller file, **still H.264** |
| HEVC (x265) | 85.1 | — | +2, poor browser/Linux playback |
| AV1 (SVT) | 89.5 | 1.2s | +6.5, compatibility + core-support blockers |
| AV1 (aom) | 93.6 | 4.5s | +10.7, slow + same blockers |

**Decision:** AV1/HEVC are deferred — they break ClipFit's "plays anywhere"
promise (the user's own Linux box can't decode HEVC; AV1 fails on older
apps/devices) and likely aren't even in the ffmpeg.wasm core. The compatibility-safe
win is a **slower x264 preset plus smarter resolution/rate heuristics.**

## Scope

**In scope (v1):**
- "Best" mode: raise the x264 preset, chosen adaptively by clip duration to bound
  encode time.
- Smarter resolution-vs-bitrate selection (avoid blocking at low bitrates).
- Evaluate a low-risk x264 perceptual knob (`-aq-mode 3`); keep only if VMAF agrees.
- A native VMAF verification harness to prove the change helps at equal size.

**Out of scope:**
- AV1 / HEVC output (separate gated investigation; needs core support + a "may not
  play everywhere" opt-in).
- Changes to "Balanced" mode — it stays fast (`fast` preset) for speed.

## Design

### 1. Adaptive "Best" preset (by duration)

`makeItFit.ts` already takes a `preset`. Today `fit.ts` passes `medium` for Best.
Pick the preset from clip duration so short clips (the common share case) get the
full quality bump while long clips stay tractable in single-thread wasm:

```ts
// in fit.ts, only for quality === 'best'
function bestPreset(durationSec: number): string {
  if (durationSec <= 20) return 'veryslow'; // +~3 VMAF, ~3x time — fine when short
  if (durationSec <= 60) return 'slower';
  return 'slow';
}
```

Balanced stays `fast`. The existing "Best is slower" UI note already sets the
expectation.

### 2. Smarter resolution-vs-bitrate heuristic

Refine `pickMaxDimension(videoKbps)` in `bitrate.ts` to cap resolution lower when
the bitrate is too small to support it (blocking is perceptually worse than
softness). Proposed starting thresholds (kbps → max long edge), to be **validated
by the VMAF sweep in implementation** and adjusted to the VMAF-optimal points:

```ts
export function pickMaxDimension(videoKbps: number): number {
  if (videoKbps >= 3500) return 1920;
  if (videoKbps >= 1800) return 1280;
  if (videoKbps >= 900) return 854;
  if (videoKbps >= 450) return 640;
  return 480;
}
```

### 3. Perceptual knob (conditional)

In the Best `-c:v libx264` args, evaluate adding `-aq-mode 3`. Include it only if
the VMAF harness shows a non-trivial gain at equal size; otherwise drop it. (No
other x264 tuning in v1 — avoid fragile over-tuning.)

## Verification harness (native ffmpeg, throwaway)

A script that, for 2–3 representative clips and 2–3 size targets, encodes with the
**old** settings and the **new** settings, then reports VMAF and output size for
each. Acceptance: new ≥ old VMAF at equal-or-smaller size on every case, with no
size overshoot past the target. This is how we confirm the preset, the resolution
thresholds, and the `aq-mode` decision — not guesswork.

## Files touched

- `src/jobs/bitrate.ts` — refined `pickMaxDimension`.
- `src/jobs/makeItFit.ts` — pass through `aq-mode` if adopted (preset already a param).
- `src/jobs/fit.ts` — `bestPreset(duration)` selection for Best; Balanced unchanged.
- Tests: `tests/bitrate.test.ts`, `tests/fit.test.ts`, `tests/makeItFit.test.ts`.

## Testing

- `pickMaxDimension`: new thresholds map sample bitrates to expected dimensions.
- `bestPreset`: duration → expected preset at the 20s/60s boundaries.
- `fit.ts`: Best at a short duration yields `veryslow` in the args; Balanced still
  yields `fast`; Best still two-pass.
- Native VMAF harness (manual, in implementation) confirms the real quality gain.

## Out-of-scope follow-ups (noted, not built)

- AV1 opt-in ("Max compression — may not play on older apps") *if* the ffmpeg.wasm
  core supports an AV1 encoder; otherwise a custom core build is its own project.
