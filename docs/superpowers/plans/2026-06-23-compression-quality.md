# Sender-side Compression Quality — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get more perceived quality from ClipFit's compressed output at the same size budget, staying H.264 for universal playback.

**Architecture:** Two compatibility-safe levers in the existing Fit pipeline — a duration-adaptive slower x264 preset for "Best", and a tighter resolution-vs-bitrate cap — plus an optional `aq-mode`, all validated by a native VMAF harness. No new architecture; pure-logic changes in `bitrate.ts` / `fit.ts` / `makeItFit.ts`.

**Tech Stack:** TypeScript, Vitest, ffmpeg (libx264), VMAF (native, for verification).

Spec: `docs/superpowers/specs/2026-06-23-compression-quality-design.md`

---

### Task 1: Tighter resolution-vs-bitrate cap

**Files:**
- Modify: `src/jobs/bitrate.ts:31-36`
- Test: `tests/bitrate.test.ts:28-35`

- [ ] **Step 1: Update the test to the new thresholds**

Replace the `pickMaxDimension` describe block in `tests/bitrate.test.ts`:

```ts
describe('pickMaxDimension', () => {
  it('caps resolution lower as bitrate drops (blocking is worse than softness)', () => {
    expect(pickMaxDimension(4000)).toBe(1920);
    expect(pickMaxDimension(2000)).toBe(1280);
    expect(pickMaxDimension(1000)).toBe(854);
    expect(pickMaxDimension(500)).toBe(640);
    expect(pickMaxDimension(300)).toBe(480);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run tests/bitrate.test.ts` (old thresholds return different values, e.g. `pickMaxDimension(2000)` returns 1920).

- [ ] **Step 3: Replace `pickMaxDimension` in `src/jobs/bitrate.ts`**

```ts
export function pickMaxDimension(videoKbps: number): number {
  if (videoKbps >= 3500) return 1920;
  if (videoKbps >= 1800) return 1280;
  if (videoKbps >= 900) return 854;
  if (videoKbps >= 450) return 640;
  return 480;
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(quality): tighter resolution-vs-bitrate cap"`

---

### Task 2: Duration-adaptive "Best" preset

**Files:**
- Modify: `src/jobs/fit.ts`
- Test: `tests/fit.test.ts`

- [ ] **Step 1: Add failing tests** (append to `tests/fit.test.ts`, and change the import on line 2 to `import { fitJob, bestPreset } from '../src/jobs/fit';`)

```ts
describe('bestPreset', () => {
  it('uses a slower x264 preset for shorter clips, bounded for long ones', () => {
    expect(bestPreset(10)).toBe('veryslow');
    expect(bestPreset(20)).toBe('veryslow');
    expect(bestPreset(45)).toBe('slower');
    expect(bestPreset(60)).toBe('slower');
    expect(bestPreset(120)).toBe('slow');
  });
});

describe('fitJob preset wiring', () => {
  it('best uses the duration-adaptive preset', () => {
    const short = { durationSec: 10, width: 1920, height: 1080, hasAudio: true };
    const passes = fitJob.buildPasses('in.mp4', 'out.mp4', short, {
      targetBytes: 25 * 1024 * 1024,
      mute: false,
      quality: 'best',
    });
    expect(passes[1].join(' ')).toContain('-preset veryslow');
  });
  it('balanced still uses the fast preset', () => {
    const a = fitJob.buildPasses('in.mp4', 'out.mp4', { durationSec: 60, width: 1920, height: 1080, hasAudio: true }, {
      targetBytes: 25 * 1024 * 1024,
      mute: false,
      quality: 'balanced',
    })[0];
    expect(a.join(' ')).toContain('-preset fast');
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run tests/fit.test.ts` (`bestPreset` not exported).

- [ ] **Step 3: Implement in `src/jobs/fit.ts`** — add the export above `fitJob`, and change the `preset` line inside `buildPasses`.

Add near the top (after imports):

```ts
// Slower x264 presets squeeze more quality per bit; cap effort by duration so
// single-thread wasm encode time stays reasonable on long clips.
export function bestPreset(durationSec: number): string {
  if (durationSec <= 20) return 'veryslow';
  if (durationSec <= 60) return 'slower';
  return 'slow';
}
```

Change the `buildMakeItFitArgs` call's preset line from:

```ts
      preset: best ? 'medium' : 'fast',
```

to:

```ts
      preset: best ? bestPreset(ctx.durationSec) : 'fast',
```

- [ ] **Step 4: Run, expect PASS** (whole `tests/fit.test.ts`; the existing two-pass test still passes — it asserts `-pass 1` / `-pass 2`, not the preset).
- [ ] **Step 5: Commit** — `git commit -am "feat(quality): duration-adaptive veryslow/slower preset for Best"`

---

### Task 3: Optional aq-mode capability in makeItFit

**Files:**
- Modify: `src/jobs/makeItFit.ts`
- Test: `tests/makeItFit.test.ts`

- [ ] **Step 1: Add a failing test** (append to `tests/makeItFit.test.ts`)

```ts
import { buildMakeItFitArgs } from '../src/jobs/makeItFit';

describe('buildMakeItFitArgs aq-mode', () => {
  it('adds x264 aq-mode params when provided', () => {
    const a = buildMakeItFitArgs({
      inputName: 'in.mp4', outputName: 'out.mp4', videoKbps: 1000, audioKbps: 128, aqMode: 3,
    })[0];
    const i = a.indexOf('-x264-params');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(a[i + 1]).toBe('aq-mode=3');
  });
  it('omits aq-mode params by default', () => {
    const a = buildMakeItFitArgs({
      inputName: 'in.mp4', outputName: 'out.mp4', videoKbps: 1000, audioKbps: 128,
    })[0];
    expect(a).not.toContain('-x264-params');
  });
});
```

(If `tests/makeItFit.test.ts` already imports `buildMakeItFitArgs`, don't duplicate the import — append only the `describe` block.)

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement in `src/jobs/makeItFit.ts`** — add `aqMode?: number;` to `MakeItFitParams`, and build the param into the shared `video` array:

```ts
  const x264params = p.aqMode ? ['-x264-params', `aq-mode=${p.aqMode}`] : [];
  const video = [
    '-vf', scale,
    '-c:v', 'libx264', '-preset', preset, ...x264params, '-pix_fmt', 'yuv420p', '-b:v', `${p.videoKbps}k`,
  ];
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(quality): optional x264 aq-mode in makeItFit"`

---

### Task 4: Native VMAF verification + decisions

**Files:**
- Create: `scripts/quality-harness.sh` (throwaway verification, not shipped logic)

- [ ] **Step 1: Write the harness**

```bash
#!/usr/bin/env bash
# Compares OLD vs NEW encode settings at equal size targets and reports VMAF.
# Usage: scripts/quality-harness.sh path/to/realclip.mp4
set -e
SRC="$1"; W=854   # downscaled ref for fair compare; adjust per clip
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")
for KBPS in 400 800 1500; do
  # OLD: medium, old res cap behavior approximated at this res
  ffmpeg -y -loglevel error -i "$SRC" -vf "scale='min($W,iw)':-2" -c:v libx264 -preset medium -b:v ${KBPS}k -pix_fmt yuv420p -an /tmp/old.mp4
  # NEW: veryslow (+ optional aq-mode=3)
  ffmpeg -y -loglevel error -i "$SRC" -vf "scale='min($W,iw)':-2" -c:v libx264 -preset veryslow -b:v ${KBPS}k -pix_fmt yuv420p -an /tmp/new.mp4
  ffmpeg -y -loglevel error -i "$SRC" -vf "scale='min($W,iw)':-2" -c:v libx264 -preset veryslow -x264-params aq-mode=3 -b:v ${KBPS}k -pix_fmt yuv420p -an /tmp/newaq.mp4
  vmaf () { ffmpeg -i "$1" -i "$SRC" -lavfi "[0:v]scale=$W:-2[d];[1:v]scale=$W:-2[r];[d][r]libvmaf" -f null - 2>&1 | grep -oiE "VMAF score: [0-9.]+"; }
  echo "== ${KBPS}k =="; echo " old:   $(vmaf /tmp/old.mp4)"; echo " new:   $(vmaf /tmp/new.mp4)"; echo " new+aq:$(vmaf /tmp/newaq.mp4)"
done
rm -f /tmp/old.mp4 /tmp/new.mp4 /tmp/newaq.mp4
```

- [ ] **Step 2: Run on 2–3 real clips** (e.g. a real phone `.MOV` found on the system). Record VMAF numbers.

- [ ] **Step 3: Decisions (record in the commit message):**
  - Confirm `new` ≥ `old` VMAF at every bitrate. (Expected from earlier synthetic test: ~+3.)
  - If `new+aq` beats `new` by a meaningful margin (≳0.5 VMAF) consistently → adopt aq-mode in Task 5. Otherwise leave it out.
  - If any resolution threshold from Task 1 looks wrong (a bitrate where a *different* cap scores clearly higher), adjust the constant in `bitrate.ts` and re-run its unit test.

- [ ] **Step 4: Commit the harness + findings** — `git add scripts/quality-harness.sh && git commit -m "test(quality): native VMAF verification harness + findings"`

---

### Task 5: Adopt aq-mode (only if Task 4 favored it) + final gate

**Files:**
- Modify: `src/jobs/fit.ts` (only if adopting aq-mode)

- [ ] **Step 1 (conditional):** If Task 4 showed aq-mode helps, pass it for Best — change the `buildMakeItFitArgs` call in `fit.ts` to add `aqMode: best ? 3 : undefined,`. Then add to the `tests/fit.test.ts` "best" test: `expect(passes[1].join(' ')).toContain('aq-mode=3');`

- [ ] **Step 2: Full gate** — `npm run typecheck && npx vitest run && npm run build` all green.
- [ ] **Step 3: Commit** — `git commit -am "feat(quality): finalize Best encode settings"` (skip if Step 1 was skipped and nothing changed).
