# Unified Single-Page Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 5-tab tool picker with one page: an optional Edit pill, a Compress/GIF output pill (default Compress, MP4/WebM folded in), and an Export-audio button — with edits baked into the chosen output in a single pass.

**Architecture:** A shared `buildEditChain` turns an `Edits` object into ffmpeg seek/vf/af fragments. `fitJob` and `audioJob` become edit-aware and compose those fragments into one command; `fitJob` also gains an MP4/WebM format and budgets bitrate from the trimmed/sped-up duration. GIF stays self-contained. `studioJob`/`convertJob`/`editJob` are retired.

**Tech Stack:** TypeScript, React 19, Vitest, ffmpeg (libx264 / libvpx-vp9).

Spec: `docs/superpowers/specs/2026-06-23-unified-page-design.md`

---

### Task 1: `editChain` — shared edit-filter builder

**Files:**
- Create: `src/jobs/editChain.ts`
- Test: `tests/editChain.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { buildEditChain, effectiveDurationSec } from '../src/jobs/editChain';

describe('buildEditChain', () => {
  it('is empty for no edits', () => {
    expect(buildEditChain(undefined, true)).toEqual({ seek: [], vf: [], af: [] });
  });
  it('builds trim seek + ordered video filters + audio filters', () => {
    const c = buildEditChain(
      { trim: { startSec: 2, endSec: 7 }, crop: { x: 1, y: 2, w: 10, h: 20 }, rotate: 90, flipH: true, speed: 2, fps: 24, volumeDb: -3 },
      true,
    );
    expect(c.seek).toEqual(['-ss', '2', '-t', '5']);
    expect(c.vf).toEqual(['crop=10:20:1:2', 'transpose=1', 'hflip', 'setpts=PTS/2', 'fps=24']);
    expect(c.af).toEqual(['atempo=2', 'volume=-3dB']);
  });
  it('drops audio filters when the source has no audio', () => {
    expect(buildEditChain({ volumeDb: 5, speed: 1.5 }, false).af).toEqual([]);
  });
  it('rotate 180 is two transposes; 270 is transpose=2', () => {
    expect(buildEditChain({ rotate: 180 }, false).vf).toEqual(['transpose=1', 'transpose=1']);
    expect(buildEditChain({ rotate: 270 }, false).vf).toEqual(['transpose=2']);
  });
});

describe('effectiveDurationSec', () => {
  it('returns full duration with no edits', () => {
    expect(effectiveDurationSec(60)).toBe(60);
  });
  it('uses the trim length', () => {
    expect(effectiveDurationSec(60, { trim: { startSec: 10, endSec: 25 } })).toBe(15);
  });
  it('divides by speed (trim + speed)', () => {
    expect(effectiveDurationSec(60, { trim: { startSec: 0, endSec: 20 }, speed: 2 })).toBe(10);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run tests/editChain.test.ts`

- [ ] **Step 3: Implement `src/jobs/editChain.ts`**

```ts
export interface Edits {
  trim?: { startSec: number; endSec: number };
  crop?: { x: number; y: number; w: number; h: number };
  rotate?: 0 | 90 | 180 | 270;
  flipH?: boolean;
  flipV?: boolean;
  speed?: number;
  fps?: number;
  volumeDb?: number;
}

export interface EditChain {
  seek: string[]; // input-seek args for trim
  vf: string[]; // ordered video filters
  af: string[]; // audio filters
}

export function buildEditChain(e: Edits | undefined, hasAudio: boolean): EditChain {
  const seek: string[] = [];
  if (e?.trim) {
    seek.push('-ss', String(e.trim.startSec), '-t', String(Math.max(0, e.trim.endSec - e.trim.startSec)));
  }
  const vf: string[] = [];
  if (e?.crop) vf.push(`crop=${e.crop.w}:${e.crop.h}:${e.crop.x}:${e.crop.y}`);
  if (e?.rotate === 90) vf.push('transpose=1');
  else if (e?.rotate === 180) vf.push('transpose=1', 'transpose=1');
  else if (e?.rotate === 270) vf.push('transpose=2');
  if (e?.flipH) vf.push('hflip');
  if (e?.flipV) vf.push('vflip');
  if (e?.speed && e.speed !== 1) vf.push(`setpts=PTS/${e.speed}`);
  if (e?.fps && e.fps > 0) vf.push(`fps=${e.fps}`);
  const af: string[] = [];
  if (hasAudio) {
    if (e?.speed && e.speed !== 1) af.push(`atempo=${e.speed}`);
    if (e?.volumeDb && e.volumeDb !== 0) af.push(`volume=${e.volumeDb}dB`);
  }
  return { seek, vf, af };
}

export function effectiveDurationSec(fullDurationSec: number, e?: Edits): number {
  const trimmed = e?.trim ? Math.max(0, e.trim.endSec - e.trim.startSec) : fullDurationSec;
  const speed = e?.speed && e.speed > 0 ? e.speed : 1;
  return trimmed / speed;
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(unified): shared buildEditChain + effectiveDurationSec"`

---

### Task 2: `makeItFit` — accept edits + format (backward-compatible)

**Files:**
- Modify: `src/jobs/makeItFit.ts`
- Test: `tests/makeItFit.test.ts`

The new params are all optional and default to today's behavior, so the existing tests keep passing.

- [ ] **Step 1: Add failing tests** (append to `tests/makeItFit.test.ts`)

```ts
describe('buildMakeItFitArgs edits + format', () => {
  it('prepends edit video filters before scale and seeks for trim', () => {
    const a = buildMakeItFitArgs({
      inputName: 'in.mp4', outputName: 'out.mp4', videoKbps: 1000, audioKbps: 128,
      seek: ['-ss', '2', '-t', '5'], editVf: ['crop=10:20:1:2'], editAf: ['volume=-3dB'],
    })[0];
    expect(a.slice(0, 4)).toEqual(['-ss', '2', '-t', '5']);
    const vf = a[a.indexOf('-vf') + 1];
    expect(vf.startsWith('crop=10:20:1:2,scale=')).toBe(true);
    const af = a[a.indexOf('-af') + 1];
    expect(af).toBe('volume=-3dB');
  });
  it('webm format uses vp9 + opus', () => {
    const a = buildMakeItFitArgs({
      inputName: 'in.mp4', outputName: 'out.webm', videoKbps: 1000, audioKbps: 128, format: 'webm',
    })[0];
    expect(a.join(' ')).toContain('libvpx-vp9');
    expect(a.join(' ')).toContain('libopus');
    expect(a).not.toContain('+faststart');
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Rewrite the body of `buildMakeItFitArgs`** (keep the interface fields, add the new optional ones)

Add to `MakeItFitParams`:
```ts
  format?: 'mp4' | 'webm'; // default 'mp4'
  seek?: string[]; // trim input-seek args
  editVf?: string[]; // edit video filters, applied before scale
  editAf?: string[]; // edit audio filters
```

Replace the function body:
```ts
export function buildMakeItFitArgs(p: MakeItFitParams): string[][] {
  const maxDim = p.maxDimension ?? 1280;
  const preset = p.preset ?? 'veryfast';
  const webm = p.format === 'webm';
  const scale =
    `scale='min(${maxDim},iw)':'min(${maxDim},ih)':` +
    `force_original_aspect_ratio=decrease:force_divisible_by=2`;
  const vf = [...(p.editVf ?? []), scale].join(',');
  const seek = p.seek ?? [];

  const vcodec = webm
    ? ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-b:v', `${p.videoKbps}k`]
    : [
        '-c:v', 'libx264', '-preset', preset,
        ...(p.aqMode ? ['-x264-params', `aq-mode=${p.aqMode}`] : []),
        '-pix_fmt', 'yuv420p', '-b:v', `${p.videoKbps}k`,
      ];
  const video = ['-vf', vf, ...vcodec];

  const editAf = p.editAf?.length ? ['-af', p.editAf.join(',')] : [];
  const acodec = webm ? ['-c:a', 'libopus', '-b:a', `${p.audioKbps}k`] : ['-c:a', 'aac', '-b:a', `${p.audioKbps}k`];
  const audio = p.audioKbps > 0 ? [...editAf, ...acodec] : ['-an'];
  const finalize = webm ? [] : ['-movflags', '+faststart'];

  if (!p.twoPass) {
    return [[...seek, '-i', p.inputName, ...video, ...audio, ...finalize, p.outputName]];
  }
  return [
    [...seek, '-i', p.inputName, ...video, '-pass', '1', '-an', '-f', 'null', '-'],
    [...seek, '-i', p.inputName, ...video, '-pass', '2', ...audio, ...finalize, p.outputName],
  ];
}
```

Note: with no new params, `vf` = `scale`, `format` = mp4, `seek` = [], so the existing exact-match tests still pass.

- [ ] **Step 4: Run, expect PASS** (whole `tests/makeItFit.test.ts`).
- [ ] **Step 5: Commit** — `git commit -am "feat(unified): makeItFit accepts edit filters + MP4/WebM format"`

---

### Task 3: `fitJob` — edits, format, trimmed-duration budget

**Files:**
- Modify: `src/jobs/fit.ts`
- Test: `tests/fit.test.ts`

- [ ] **Step 1: Add failing tests** (append to `tests/fit.test.ts`)

```ts
import type { Edits } from '../src/jobs/editChain';

describe('fitJob edits + format', () => {
  const ctx2 = { durationSec: 60, width: 1920, height: 1080, hasAudio: true };
  it('budgets bitrate from the trimmed duration', () => {
    const edits: Edits = { trim: { startSec: 0, endSec: 30 } }; // half the clip
    const full = fitJob.buildPasses('in.mp4', 'out.mp4', ctx2, { targetBytes: 25 * 1024 * 1024, mute: false, quality: 'balanced', format: 'mp4' });
    const trimmed = fitJob.buildPasses('in.mp4', 'out.mp4', ctx2, { targetBytes: 25 * 1024 * 1024, mute: false, quality: 'balanced', format: 'mp4', edits });
    const bps = (p: string[][]) => Number(p[0][p[0].indexOf('-b:v') + 1].replace('k', ''));
    expect(bps(trimmed)).toBeGreaterThan(bps(full)); // shorter clip → more kbps for same size
    expect(trimmed[0].slice(0, 2)).toEqual(['-ss', '0']);
  });
  it('webm format selects the webm output + vp9', () => {
    const out = fitJob.output({ targetBytes: 1, mute: false, quality: 'balanced', format: 'webm' });
    expect(out.downloadName.endsWith('.webm')).toBe(true);
    const a = fitJob.buildPasses('in.mp4', out.name, ctx2, { targetBytes: 25 * 1024 * 1024, mute: false, quality: 'balanced', format: 'webm' });
    expect(a[0].join(' ')).toContain('libvpx-vp9');
  });
});
```

(Update the existing balanced/best/mute tests to include `format: 'mp4'` in their params object — TypeScript will require it.)

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Rewrite `src/jobs/fit.ts`**

```ts
import type { Job } from './types';
import { computeVideoKbps, pickMaxDimension } from './bitrate';
import { buildMakeItFitArgs } from './makeItFit';
import { buildEditChain, effectiveDurationSec, type Edits } from './editChain';

export interface FitParams {
  targetBytes: number;
  mute: boolean;
  quality: 'balanced' | 'best';
  format: 'mp4' | 'webm';
  edits?: Edits;
}

export function bestPreset(durationSec: number): string {
  if (durationSec <= 20) return 'veryslow';
  if (durationSec <= 60) return 'slower';
  return 'slow';
}

export const fitJob: Job<FitParams> = {
  id: 'fit',
  label: 'Compress',
  accept: 'video/*',
  output: (p) =>
    p.format === 'webm'
      ? { name: 'output.webm', mime: 'video/webm', downloadName: 'clipfit.webm' }
      : { name: 'output.mp4', mime: 'video/mp4', downloadName: 'clipfit-output.mp4' },
  buildPasses(input, output, ctx, params) {
    const best = params.quality === 'best';
    const dur = effectiveDurationSec(ctx.durationSec, params.edits);
    const chain = buildEditChain(params.edits, ctx.hasAudio && !params.mute);
    const bytesPerSec = dur > 0 ? params.targetBytes / dur : Infinity;
    const audioKbps = params.mute ? 0 : bytesPerSec < 150 * 1024 ? 96 : 128;
    const videoKbps = computeVideoKbps({
      targetBytes: params.targetBytes,
      durationSec: dur,
      audioKbps,
      safetyMargin: best ? 0.97 : 0.95,
    });
    return buildMakeItFitArgs({
      inputName: input,
      outputName: output,
      videoKbps,
      audioKbps,
      maxDimension: pickMaxDimension(videoKbps),
      preset: best ? bestPreset(dur) : 'fast',
      twoPass: best,
      format: params.format,
      seek: chain.seek,
      editVf: chain.vf,
      editAf: chain.af,
    });
  },
};
```

- [ ] **Step 4: Run, expect PASS** (whole `tests/fit.test.ts`, after adding `format: 'mp4'` to the older tests).
- [ ] **Step 5: Commit** — `git commit -am "feat(unified): fitJob is edit-aware + MP4/WebM + trimmed-duration budget"`

---

### Task 4: `audioJob` — edit-aware

**Files:**
- Modify: `src/jobs/audio.ts`
- Test: `tests/` (wherever audio is tested; else add `tests/audio.test.ts`)

- [ ] **Step 1: Add failing test**

```ts
import { describe, it, expect } from 'vitest';
import { audioJob } from '../src/jobs/audio';

const ctx = { durationSec: 60, width: 0, height: 0, hasAudio: true };

describe('audioJob edits', () => {
  it('applies trim seek and audio filters, ignores video filters', () => {
    const a = audioJob.buildPasses('in.mp4', 'out.mp3', ctx, {
      format: 'mp3',
      edits: { trim: { startSec: 1, endSec: 4 }, volumeDb: 6, crop: { x: 0, y: 0, w: 9, h: 9 } },
    })[0];
    expect(a.slice(0, 4)).toEqual(['-ss', '1', '-t', '3']);
    expect(a.join(' ')).toContain('-af volume=6dB');
    expect(a.join(' ')).not.toContain('crop');
    expect(a).toContain('-vn');
  });
  it('plain extraction unchanged when no edits', () => {
    const a = audioJob.buildPasses('in.mp4', 'out.mp3', ctx, { format: 'mp3' })[0];
    expect(a).toEqual(['-i', 'in.mp4', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', 'out.mp3']);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Rewrite `src/jobs/audio.ts`**

```ts
import type { Job } from './types';
import { buildEditChain, type Edits } from './editChain';

export interface AudioParams {
  format: 'mp3' | 'wav';
  edits?: Edits;
}

export const audioJob: Job<AudioParams> = {
  id: 'audio',
  label: 'Extract audio',
  accept: 'video/*',
  output: (p) =>
    p.format === 'wav'
      ? { name: 'output.wav', mime: 'audio/wav', downloadName: 'clipfit.wav' }
      : { name: 'output.mp3', mime: 'audio/mpeg', downloadName: 'clipfit.mp3' },
  buildPasses(input, output, ctx, p) {
    const chain = buildEditChain(p.edits, ctx.hasAudio);
    const af = chain.af.length ? ['-af', chain.af.join(',')] : [];
    const codec = p.format === 'wav' ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'libmp3lame', '-b:a', '192k'];
    return [[...chain.seek, '-i', input, '-vn', ...af, ...codec, output]];
  },
};
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(unified): audioJob applies trim + volume/speed edits"`

---

### Task 5: `Editor` — controlled edit component

**Files:**
- Create: `src/components/Editor.tsx` (refactor of `StudioEditor.tsx`)
- Delete: `src/components/StudioEditor.tsx`

- [ ] **Step 1:** Copy `StudioEditor.tsx` to `Editor.tsx`. Change the component name to `Editor` and the props to `{ file: File; onChange: (edits: Edits) => void }` (import `Edits` from `../jobs/editChain`). Remove the `onRun`/`StudioParams` import and the **Export button**.

- [ ] **Step 2:** Replace the `doExport` function with an effect that reports edits upward whenever any edit state changes:

```tsx
useEffect(() => {
  const edits: Edits = {};
  if (trimIn > 0.05 || trimOut < duration - 0.05) edits.trim = { startSec: trimIn, endSec: trimOut };
  if (cropOn && frame) {
    const c = mapCropToSource(box, dispW, dispH, frame.srcW, frame.srcH);
    edits.crop = c;
  }
  if (rotate) edits.rotate = rotate;
  if (flipH) edits.flipH = true;
  if (flipV) edits.flipV = true;
  if (speed !== 1) edits.speed = speed;
  if (fps > 0) edits.fps = fps;
  if (volumeDb !== 0) edits.volumeDb = volumeDb;
  onChange(edits);
}, [trimIn, trimOut, cropOn, box, frame, rotate, flipH, flipV, speed, fps, volumeDb, duration, dispW, dispH, onChange]);
```

(Keep all the existing preview/filmstrip/crop/trim/controls JSX exactly; only the Export button is removed.)

- [ ] **Step 3: Verify** — `npm run typecheck` passes (no remaining references to `StudioEditor`/`studioJob` yet will fail until Task 7; that's expected — proceed, Task 7 fixes App).

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(unified): controlled Editor component (reports edits up)"`

---

### Task 6: `CompressPanel` — size/quality/format/mute

**Files:**
- Create: `src/components/CompressPanel.tsx` (from `TargetPicker.tsx`)
- Delete: `src/components/TargetPicker.tsx`

- [ ] **Step 1:** Copy `TargetPicker.tsx` to `CompressPanel.tsx`. Keep `PRESETS`, mute toggle, the size dropdown + custom MB, and the quality dropdown. Add a **Format** field and change the callback to include format:

```tsx
const [format, setFormat] = useState<'mp4' | 'webm'>('mp4');
// ...props:
}: { onStart: (target: SizeTarget, mute: boolean, quality: 'balanced' | 'best', format: 'mp4' | 'webm') => void }) {
// ...add a field after Quality:
<div className="field">
  <span className="field-label">Format</span>
  <Select value={format} onChange={(v) => setFormat(v as 'mp4' | 'webm')}>
    <option value="mp4">MP4 (most compatible)</option>
    <option value="webm">WebM (smaller)</option>
  </Select>
</div>
// ...go(): onStart(target, mute, quality, format);
```

- [ ] **Step 2: Verify** — `npm run typecheck` (App still references TargetPicker until Task 7 — expected to fail there; that's fine, continue).

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat(unified): CompressPanel with MP4/WebM format"`

---

### Task 7: Rewrite `App` as the single page; retire old tools

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/ToolPicker.tsx`, `src/components/ConvertPanel.tsx`, `src/components/AudioPanel.tsx`, `src/jobs/studio.ts`, `src/jobs/convert.ts`, `src/jobs/edit.ts`
- Delete tests for retired jobs: `tests/studio.test.ts`, `tests/edit.test.ts`, and remove any `convertJob`/`editJob`/`studioJob` cases from `tests/tools.test.ts` / `tests/crop.test.ts` (keep `cropMath` tests).

- [ ] **Step 1: Rewrite `src/App.tsx`** to the single-page layout. Key structure (keep the existing `isMobile`/`MAX_BYTES`/`WASM_OK`, `onFile`, `run`, phase/result/error, header, mobile note, Progress/Result/error blocks):

```tsx
import { useState } from 'react';
import { Dropzone } from './components/Dropzone';
import { Editor } from './components/Editor';
import { CompressPanel } from './components/CompressPanel';
import { GifPanel } from './components/GifPanel';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { VideoPreview } from './components/VideoPreview';
import { Toggle } from './components/Toggle';
import { Progress } from './components/Progress';
import { Result } from './components/Result';
import { loadEngine, runJob } from './engine/ffmpegEngine';
import { fitJob } from './jobs/fit';
import { gifJob } from './jobs/gif';
import { audioJob } from './jobs/audio';
import { humanizeBytes } from './lib/format';
import type { Edits } from './jobs/editChain';
import type { Job } from './jobs/types';
import type { JobPhase, JobResult } from './types';

// ...isMobile / MAX_BYTES / WASM_OK unchanged...

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [editOn, setEditOn] = useState(false);
  const [edits, setEdits] = useState<Edits>({});
  const [output, setOutput] = useState<'compress' | 'gif'>('compress');
  const [phase, setPhase] = useState<JobPhase>('idle');
  const [ratio, setRatio] = useState(0);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeEdits = editOn ? edits : undefined;

  // ...resetRun, onFile, run<P> unchanged from current App...

  // (WASM_OK fallback block unchanged)

  return (
    <main style={{ maxWidth: 520, margin: '2rem auto', padding: '0 1rem' }}>
      {/* header + subtitle + mobile note (unchanged) */}
      {error && <p style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</p>}
      <div className="card" style={{ marginTop: 16 }}>
        {!file && <Dropzone onFile={onFile} />}
        {file && phase === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>{file.name} — {humanizeBytes(file.size)}</p>

            {editOn ? <Editor file={file} onChange={setEdits} /> : <VideoPreview file={file} />}
            <Toggle on={editOn} onChange={setEditOn}>Edit</Toggle>

            <div className="segmented" role="tablist">
              <button className={output === 'compress' ? 'primary' : ''} onClick={() => setOutput('compress')}>Compress</button>
              <button className={output === 'gif' ? 'primary' : ''} onClick={() => setOutput('gif')}>GIF</button>
            </div>

            {output === 'compress' && (
              <CompressPanel onStart={(t, mute, quality, format) =>
                run(fitJob, { targetBytes: t.bytes, mute, quality, format, edits: activeEdits }, t.bytes)} />
            )}
            {output === 'gif' && (
              <>
                <GifPanel file={file} onRun={(p) => run(gifJob, p)} />
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>Edit controls don't affect GIF — use the options here.</p>
              </>
            )}

            <button onClick={() => run(audioJob, { format: 'mp3', edits: activeEdits })}>Export audio (MP3)</button>
            <button onClick={() => setFile(null)} style={{ width: '100%' }}>Choose a different file</button>
          </div>
        )}
        {(phase === 'loading-engine' || phase === 'processing') && <Progress phase={phase} ratio={ratio} />}
        {phase === 'done' && result && <Result result={result} onReset={resetRun} />}
        {phase === 'error' && <button onClick={resetRun}>Try again</button>}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Delete retired files** —
```bash
git rm src/components/ToolPicker.tsx src/components/ConvertPanel.tsx src/components/AudioPanel.tsx \
       src/jobs/studio.ts src/jobs/convert.ts src/jobs/edit.ts \
       tests/studio.test.ts tests/edit.test.ts 2>/dev/null || true
```
Then open `tests/tools.test.ts` and `tests/crop.test.ts`; remove any block importing `convertJob`, `editJob`, or `studioJob` (keep `cropMath`/`gif`/`trim` cases that don't reference deleted jobs).

- [ ] **Step 3: Gate** — `npm run typecheck && npx vitest run && npm run build`. Fix any dangling imports the compiler flags (these are the only references to the deleted modules).

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(unified): single-page App (Edit pill + Compress/GIF + audio); retire tool tabs/convert/studio"`

---

### Task 8: Native composition spot-check + final gate

- [ ] **Step 1:** Confirm a trim+crop+compress is ONE pass and lands under target, using the args `fitJob` produces. With `/home/jayf/Downloads/IMG_6775.MOV`:

```bash
ffmpeg -y -loglevel error -ss 0 -t 5 -i /home/jayf/Downloads/IMG_6775.MOV \
  -vf "crop=in_w/2:in_h/2:0:0,scale='min(854,iw)':'min(854,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2" \
  -c:v libx264 -preset fast -pix_fmt yuv420p -b:v 1500k -c:a aac -b:a 128k -movflags +faststart /tmp/u.mp4
ls -la /tmp/u.mp4 && ffprobe -v error -show_entries format=duration -of csv=p=0 /tmp/u.mp4
# webm sanity:
ffmpeg -y -loglevel error -i /home/jayf/Downloads/IMG_6775.MOV -t 3 -vf "scale='min(854,iw)':-2" -c:v libvpx-vp9 -b:v 1000k -c:a libopus -b:a 96k /tmp/u.webm && echo "webm ok $(stat -c%s /tmp/u.webm)"
rm -f /tmp/u.mp4 /tmp/u.webm
```
Expected: both produce valid files; the mp4 duration ≈ 5s (trim applied).

- [ ] **Step 2: Final gate** — `npm run typecheck && npx vitest run && npm run build` all green.
- [ ] **Step 3: Manual** — `npm run dev`; load a clip, toggle **Edit**, set a trim+crop, **Compress** (MP4 and WebM), make a **GIF**, **Export audio**; confirm each downloads and the trim is reflected.
- [ ] **Step 4: Commit** if anything changed — `git commit -am "test(unified): native single-pass + webm spot-check"`
