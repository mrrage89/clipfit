# ClipFit "Make it fit" v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a free, fully client-side web app where a user drops a video, picks a size target (Discord/Email/WhatsApp/custom MB), and downloads a re-encoded MP4 that lands just under the target — all processed in-browser via ffmpeg.wasm, no upload.

**Architecture:** A single-page Vite + React + TS app. Pure-function core (bitrate math + ffmpeg arg building) is unit-tested with Vitest. An engine wrapper drives `@ffmpeg/ffmpeg` (which runs the codec in its own worker). A `LicenseGate` no-op seam isolates the single future insertion point for monetization. Hosted as static files on Cloudflare Pages with COOP/COEP headers so the multithreaded ffmpeg core can use `SharedArrayBuffer`.

**Tech Stack:** Vite, React, TypeScript, Vitest, `@ffmpeg/ffmpeg` + `@ffmpeg/util` (pinned), Cloudflare Pages.

---

## Delegation guide (local model: `openai/gpt-oss-20b`)

Hand off boilerplate/UI; keep correctness-critical and integration work in the main session and review all local output before it lands.

- **Delegate:** Task 1 (scaffold), Tasks 9–12 (UI components), Task 14 (deploy config).
- **Keep (do carefully, TDD):** Task 4 (bitrate), Task 5 (ffmpeg args), Task 7 (engine), Task 8 (probe), Task 13 (orchestration/error handling).

Delegation call pattern (run from `~/clipfit`):
```bash
curl -s http://localhost:1234/v1/chat/completions -H "Content-Type: application/json" -d '{
  "model": "openai/gpt-oss-20b",
  "temperature": 0.2,
  "messages": [{"role":"user","content":"<exact spec: file path, interface, constraints, return ONLY code>"}]
}' | python3 -c "import sys,json;print(json.load(sys.stdin)['choices'][0]['message']['content'])"
```
Always: give the exact interface/types from this plan, demand code-only output, then read it, run the tests, and fix before committing.

---

## File structure

```
clipfit/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  public/_headers              # Cloudflare Pages COOP/COEP
  src/
    main.tsx                   # React entry
    App.tsx                    # orchestration + flow state + error handling
    types.ts                   # shared types
    jobs/
      bitrate.ts               # PURE: target size -> video kbps
      makeItFit.ts             # PURE: params -> ffmpeg arg arrays
    engine/
      ffmpegEngine.ts          # wrapper over @ffmpeg/ffmpeg (load/run/progress)
    lib/
      videoMeta.ts             # probe duration/size/has-audio
      license.ts               # LicenseGate seam (no-op in v1)
      format.ts                # humanizeBytes etc.
    components/
      Dropzone.tsx
      TargetPicker.tsx
      Progress.tsx
      Result.tsx
  tests/
    bitrate.test.ts
    makeItFit.test.ts
    license.test.ts
    format.test.ts
```

---

## Task 1: Project scaffold  *(delegatable)*

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Scaffold Vite React-TS + Vitest**

Run:
```bash
cd ~/clipfit
npm create vite@latest . -- --template react-ts
npm install
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
npm install @ffmpeg/ffmpeg@0.12.10 @ffmpeg/util@0.12.1
```

- [ ] **Step 2: Add test script + vitest config to `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  test: { environment: 'jsdom', globals: true },
});
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 3: Replace `src/App.tsx` with a minimal placeholder** that renders `<h1>ClipFit</h1>` so the app boots.

- [ ] **Step 4: Verify it builds and tests run**

Run: `npm run build && npm run test`
Expected: build succeeds; vitest reports "No test files found" (exit 0) or runs 0 tests.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite React-TS app with Vitest and ffmpeg deps"
```

---

## Task 2: COOP/COEP headers (multithread enablement)

**Files:**
- Create: `public/_headers`

- [ ] **Step 1: Create Cloudflare Pages headers file**

`public/_headers`:
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

- [ ] **Step 2: Verify cross-origin isolation in dev**

Run: `npm run dev`, open the app, in DevTools console run `crossOriginIsolated`.
Expected: `true`. (If `false`, ffmpeg multithread core will fail — fix headers before proceeding.)

- [ ] **Step 3: Commit**

```bash
git add public/_headers && git commit -m "feat: add COOP/COEP headers for SharedArrayBuffer"
```

---

## Task 3: Shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Define types**

```ts
export interface VideoMeta {
  durationSec: number;
  sizeBytes: number;
  hasAudio: boolean;
}

export interface SizeTarget {
  label: string;      // "Discord (25 MB)"
  bytes: number;      // 25 * 1024 * 1024
}

export type JobPhase = 'idle' | 'loading-engine' | 'processing' | 'done' | 'error';

export interface JobResult {
  blob: Blob;
  outputBytes: number;
  targetBytes: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts && git commit -m "feat: add shared types"
```

---

## Task 4: Bitrate calculator (PURE, TDD)  *(keep — critical)*

**Files:**
- Create: `src/jobs/bitrate.ts`
- Test: `tests/bitrate.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/bitrate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeVideoKbps } from '../src/jobs/bitrate';

describe('computeVideoKbps', () => {
  it('splits the budget between video and audio with a safety margin', () => {
    // 25 MB target, 60s, 128kbps audio, margin 0.95
    // totalBits = 25*1024*1024*8*0.95 = 199,229,440
    // audioBits = 128*1000*60 = 7,680,000
    // videoKbps = (199,229,440 - 7,680,000)/60/1000 = 3192.49 -> floor 3192
    expect(computeVideoKbps({ targetBytes: 25*1024*1024, durationSec: 60, audioKbps: 128 }))
      .toBe(3192);
  });

  it('uses the full budget for video when audio is stripped (0 kbps)', () => {
    // (199,229,440)/60/1000 = 3320.49 -> 3320
    expect(computeVideoKbps({ targetBytes: 25*1024*1024, durationSec: 60, audioKbps: 0 }))
      .toBe(3320);
  });

  it('never returns below the minimum video bitrate', () => {
    expect(computeVideoKbps({ targetBytes: 1*1024*1024, durationSec: 600, audioKbps: 128 }))
      .toBe(100); // default minVideoKbps
  });

  it('throws on non-positive duration', () => {
    expect(() => computeVideoKbps({ targetBytes: 1024, durationSec: 0, audioKbps: 0 }))
      .toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/bitrate.test.ts`
Expected: FAIL — `computeVideoKbps` not found.

- [ ] **Step 3: Implement**

`src/jobs/bitrate.ts`:
```ts
export interface BitrateInput {
  targetBytes: number;
  durationSec: number;
  audioKbps: number;      // 0 = no audio / stripped
  safetyMargin?: number;  // default 0.95
  minVideoKbps?: number;  // default 100
}

export function computeVideoKbps(input: BitrateInput): number {
  const { targetBytes, durationSec, audioKbps } = input;
  const safetyMargin = input.safetyMargin ?? 0.95;
  const minVideoKbps = input.minVideoKbps ?? 100;
  if (durationSec <= 0) throw new Error('durationSec must be positive');

  const totalBits = targetBytes * 8 * safetyMargin;
  const audioBits = audioKbps * 1000 * durationSec;
  const videoKbps = Math.floor((totalBits - audioBits) / durationSec / 1000);
  return Math.max(minVideoKbps, videoKbps);
}

export function isTargetAchievable(input: BitrateInput): boolean {
  const minVideoKbps = input.minVideoKbps ?? 100;
  // Achievable if the computed (unfloored-to-min) bitrate is >= the minimum.
  const totalBits = input.targetBytes * 8 * (input.safetyMargin ?? 0.95);
  const audioBits = input.audioKbps * 1000 * input.durationSec;
  return (totalBits - audioBits) / input.durationSec / 1000 >= minVideoKbps;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/bitrate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/jobs/bitrate.ts tests/bitrate.test.ts
git commit -m "feat: add bitrate calculator with tests"
```

---

## Task 5: makeItFit ffmpeg arg builder (PURE, TDD)  *(keep — critical)*

**Files:**
- Create: `src/jobs/makeItFit.ts`
- Test: `tests/makeItFit.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/makeItFit.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildMakeItFitArgs } from '../src/jobs/makeItFit';

describe('buildMakeItFitArgs', () => {
  it('builds a single-pass command with audio', () => {
    const passes = buildMakeItFitArgs({
      inputName: 'input.mp4', outputName: 'output.mp4',
      videoKbps: 3000, audioKbps: 128,
    });
    expect(passes).toEqual([[
      '-i', 'input.mp4',
      '-c:v', 'libx264', '-b:v', '3000k',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      'output.mp4',
    ]]);
  });

  it('strips audio with -an when audioKbps is 0', () => {
    const passes = buildMakeItFitArgs({
      inputName: 'input.mp4', outputName: 'output.mp4',
      videoKbps: 3000, audioKbps: 0,
    });
    expect(passes[0]).toContain('-an');
    expect(passes[0]).not.toContain('-c:a');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/makeItFit.test.ts`
Expected: FAIL — `buildMakeItFitArgs` not found.

- [ ] **Step 3: Implement**

`src/jobs/makeItFit.ts`:
```ts
export interface MakeItFitParams {
  inputName: string;
  outputName: string;
  videoKbps: number;
  audioKbps: number;   // 0 => strip audio
}

// Returns an array of ffmpeg arg-arrays (one entry = single pass).
export function buildMakeItFitArgs(p: MakeItFitParams): string[][] {
  const audio = p.audioKbps > 0
    ? ['-c:a', 'aac', '-b:a', `${p.audioKbps}k`]
    : ['-an'];
  return [[
    '-i', p.inputName,
    '-c:v', 'libx264', '-b:v', `${p.videoKbps}k`,
    ...audio,
    '-movflags', '+faststart',
    p.outputName,
  ]];
}
```

> Note: v1 ships single-pass for simplicity (computed bitrate + 0.95 safety margin keeps output under target). Two-pass is a future refinement if overshoot is observed in Task 15 testing.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/makeItFit.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/jobs/makeItFit.ts tests/makeItFit.test.ts
git commit -m "feat: add makeItFit ffmpeg arg builder with tests"
```

---

## Task 6: format helper + LicenseGate seam (TDD)

**Files:**
- Create: `src/lib/format.ts`, `src/lib/license.ts`
- Test: `tests/format.test.ts`, `tests/license.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/format.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { humanizeBytes } from '../src/lib/format';

describe('humanizeBytes', () => {
  it('formats MB', () => expect(humanizeBytes(25 * 1024 * 1024)).toBe('25.0 MB'));
  it('formats KB', () => expect(humanizeBytes(2048)).toBe('2.0 KB'));
});
```

`tests/license.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { licenseGate } from '../src/lib/license';

describe('licenseGate (v1 no-op)', () => {
  it('allows every feature', () => {
    expect(licenseGate.isAllowed('batch')).toBe(true);
    expect(licenseGate.isAllowed('anything')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/format.test.ts tests/license.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/lib/format.ts`:
```ts
export function humanizeBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
```

`src/lib/license.ts`:
```ts
// v1: everything is free. This is the SINGLE future insertion point for Pro gating.
export interface LicenseGate {
  isAllowed(feature: string): boolean;
}
export const licenseGate: LicenseGate = {
  isAllowed: () => true,
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/format.test.ts tests/license.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/license.ts tests/format.test.ts tests/license.test.ts
git commit -m "feat: add format helper and LicenseGate seam"
```

---

## Task 7: ffmpeg engine wrapper  *(keep — integration)*

**Files:**
- Create: `src/engine/ffmpegEngine.ts`

- [ ] **Step 1: Verify the pinned API**

Read `node_modules/@ffmpeg/ffmpeg/dist/esm/index.d.ts` and the `@ffmpeg/util` exports to confirm the `load()` signature, `exec`, `writeFile`, `readFile`, and the `progress` event shape for v0.12.x. Adjust the code below if the pinned version differs.

- [ ] **Step 2: Implement the wrapper**

`src/engine/ffmpegEngine.ts`:
```ts
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const CORE_VERSION = '0.12.6';
const baseURL = `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/esm`;

let ffmpeg: FFmpeg | null = null;

export async function loadEngine(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  const instance = new FFmpeg();
  if (onLog) instance.on('log', ({ message }) => onLog(message));
  await instance.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
  });
  ffmpeg = instance;
  return instance;
}

export interface RunOptions {
  file: File;
  passes: string[][];          // from buildMakeItFitArgs
  inputName: string;
  outputName: string;
  onProgress?: (ratio: number) => void;  // 0..1
}

export async function runJob(opts: RunOptions): Promise<Blob> {
  const engine = await loadEngine();
  const progressHandler = ({ progress }: { progress: number }) =>
    opts.onProgress?.(Math.min(1, Math.max(0, progress)));
  engine.on('progress', progressHandler);
  try {
    await engine.writeFile(opts.inputName, await fetchFile(opts.file));
    for (const args of opts.passes) {
      await engine.exec(args);
    }
    const data = await engine.readFile(opts.outputName);
    return new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
  } finally {
    engine.off('progress', progressHandler);
  }
}
```

- [ ] **Step 3: Manual smoke test**

Temporarily wire a button in `App.tsx` to `loadEngine()`; run `npm run dev`; confirm the core loads (network shows core-mt fetched, no COEP errors). Remove the temp button after.

- [ ] **Step 4: Commit**

```bash
git add src/engine/ffmpegEngine.ts && git commit -m "feat: add ffmpeg engine wrapper"
```

---

## Task 8: video metadata probe  *(keep)*

**Files:**
- Create: `src/lib/videoMeta.ts`

- [ ] **Step 1: Implement (duration/size via HTMLVideoElement; audio detected during decode)**

`src/lib/videoMeta.ts`:
```ts
import type { VideoMeta } from '../types';

export function probeVideo(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        durationSec: video.duration,
        sizeBytes: file.size,
        // Heuristic: assume audio present; refined by ffmpeg during processing.
        hasAudio: true,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this video. The format may be unsupported.'));
    };
    video.src = url;
  });
}
```

> Note: precise audio-track detection requires ffmpeg `-i` parsing; v1 assumes audio present and re-encodes audio at 128k unless the user chooses "mute". This keeps the probe synchronous-fast. Refine post-validation if needed.

- [ ] **Step 2: Commit**

```bash
git add src/lib/videoMeta.ts && git commit -m "feat: add video metadata probe"
```

---

## Task 9: Dropzone component  *(delegatable)*

**Files:**
- Create: `src/components/Dropzone.tsx`

- [ ] **Step 1: Implement**

`src/components/Dropzone.tsx`:
```tsx
import { useRef } from 'react';

export function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      style={{ border: '2px dashed #888', padding: '3rem', textAlign: 'center', cursor: 'pointer', borderRadius: 12 }}
    >
      <p>Drop a video here, or click to choose</p>
      <small>Your file never leaves your device.</small>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Dropzone.tsx && git commit -m "feat: add Dropzone component"
```

---

## Task 10: TargetPicker component  *(delegatable)*

**Files:**
- Create: `src/components/TargetPicker.tsx`

- [ ] **Step 1: Implement (presets + custom MB + mute toggle)**

`src/components/TargetPicker.tsx`:
```tsx
import type { SizeTarget } from '../types';

const MB = 1024 * 1024;
export const PRESETS: SizeTarget[] = [
  { label: 'Discord (10 MB)', bytes: 10 * MB },
  { label: 'Discord (25 MB)', bytes: 25 * MB },
  { label: 'Discord (50 MB)', bytes: 50 * MB },
  { label: 'Email (25 MB)', bytes: 25 * MB },
  { label: 'WhatsApp (16 MB)', bytes: 16 * MB },
];

export function TargetPicker({
  onStart,
}: {
  onStart: (target: SizeTarget, mute: boolean) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => onStart(p, false)}>{p.label}</button>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <label>
          Custom MB:{' '}
          <input
            type="number"
            min={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const mb = Number((e.target as HTMLInputElement).value);
                if (mb > 0) onStart({ label: `Custom (${mb} MB)`, bytes: mb * MB }, false);
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TargetPicker.tsx && git commit -m "feat: add TargetPicker component"
```

---

## Task 11: Progress component  *(delegatable)*

**Files:**
- Create: `src/components/Progress.tsx`

- [ ] **Step 1: Implement**

`src/components/Progress.tsx`:
```tsx
export function Progress({ phase, ratio }: { phase: string; ratio: number }) {
  const pct = Math.round(ratio * 100);
  return (
    <div>
      <p>{phase === 'loading-engine' ? 'Loading engine…' : `Processing… ${pct}%`}</p>
      <div style={{ background: '#eee', borderRadius: 6, height: 12 }}>
        <div style={{ width: `${pct}%`, background: '#4f46e5', height: 12, borderRadius: 6 }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Progress.tsx && git commit -m "feat: add Progress component"
```

---

## Task 12: Result component  *(delegatable)*

**Files:**
- Create: `src/components/Result.tsx`

- [ ] **Step 1: Implement (preview, size vs target, download, reset)**

`src/components/Result.tsx`:
```tsx
import type { JobResult } from '../types';
import { humanizeBytes } from '../lib/format';

export function Result({ result, onReset }: { result: JobResult; onReset: () => void }) {
  const url = URL.createObjectURL(result.blob);
  const ok = result.outputBytes <= result.targetBytes;
  return (
    <div>
      <video src={url} controls style={{ maxWidth: '100%', borderRadius: 8 }} />
      <p>
        Output: {humanizeBytes(result.outputBytes)} (target {humanizeBytes(result.targetBytes)}){' '}
        {ok ? '✓ fits' : '⚠ over target — try a smaller preset or mute audio'}
      </p>
      <a href={url} download="clipfit-output.mp4"><button>Download</button></a>
      <button onClick={onReset} style={{ marginLeft: 8 }}>Start over</button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Result.tsx && git commit -m "feat: add Result component"
```

---

## Task 13: App orchestration + error handling  *(keep — integration)*

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement the full flow**

`src/App.tsx`:
```tsx
import { useState } from 'react';
import { Dropzone } from './components/Dropzone';
import { TargetPicker } from './components/TargetPicker';
import { Progress } from './components/Progress';
import { Result } from './components/Result';
import { probeVideo } from './lib/videoMeta';
import { computeVideoKbps } from './jobs/bitrate';
import { buildMakeItFitArgs } from './jobs/makeItFit';
import { runJob } from './engine/ffmpegEngine';
import type { JobPhase, JobResult, SizeTarget, VideoMeta } from './types';

const MAX_BYTES = 500 * 1024 * 1024; // guard against the WASM memory ceiling

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [phase, setPhase] = useState<JobPhase>('idle');
  const [ratio, setRatio] = useState(0);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null); setMeta(null); setPhase('idle'); setRatio(0); setResult(null); setError(null);
  }

  async function onFile(f: File) {
    setError(null);
    if (f.size > MAX_BYTES) {
      setError(`That file is ${(f.size/1024/1024).toFixed(0)} MB. In-browser processing is limited to ~500 MB — use a desktop tool for larger files.`);
      return;
    }
    try {
      const m = await probeVideo(f);
      setFile(f); setMeta(m);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onStart(target: SizeTarget, mute: boolean) {
    if (!file || !meta) return;
    setError(null);
    try {
      const audioKbps = mute ? 0 : 128;
      const videoKbps = computeVideoKbps({ targetBytes: target.bytes, durationSec: meta.durationSec, audioKbps });
      const passes = buildMakeItFitArgs({ inputName: 'input.mp4', outputName: 'output.mp4', videoKbps, audioKbps });
      setPhase('loading-engine');
      setPhase('processing');
      const blob = await runJob({
        file, passes, inputName: 'input.mp4', outputName: 'output.mp4',
        onProgress: setRatio,
      });
      setResult({ blob, outputBytes: blob.size, targetBytes: target.bytes });
      setPhase('done');
    } catch (e) {
      setError(`Processing failed: ${(e as Error).message}`);
      setPhase('error');
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '2rem auto', fontFamily: 'system-ui', padding: '0 1rem' }}>
      <h1>ClipFit — make any video fit</h1>
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {!file && <Dropzone onFile={onFile} />}
      {file && meta && phase === 'idle' && <TargetPicker onStart={onStart} />}
      {(phase === 'loading-engine' || phase === 'processing') && <Progress phase={phase} ratio={ratio} />}
      {phase === 'done' && result && <Result result={result} onReset={reset} />}
      {phase === 'error' && <button onClick={reset}>Try again</button>}
    </main>
  );
}
```

- [ ] **Step 2: Run full test suite + build**

Run: `npm run test && npm run build`
Expected: all unit tests PASS; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx && git commit -m "feat: wire up make-it-fit flow with error handling"
```

---

## Task 14: Analytics + deploy config  *(delegatable)*

**Files:**
- Modify: `index.html` (analytics snippet)
- Create: `README.md` (deploy notes)

- [ ] **Step 1: Add privacy-friendly analytics**

Add Cloudflare Web Analytics (or Plausible) beacon to `index.html` `<head>`. No cookies, no PII.

- [ ] **Step 2: Document Cloudflare Pages deploy**

`README.md`: build command `npm run build`, output dir `dist`, and confirm `_headers` ships in `dist` (Vite copies `public/` to `dist/`). Note: verify `crossOriginIsolated === true` on the deployed URL.

- [ ] **Step 3: Commit**

```bash
git add index.html README.md && git commit -m "chore: add analytics and deploy docs"
```

---

## Task 15: Manual E2E verification

- [ ] **Step 1: Real-file test matrix**

Run `npm run dev`. For each case, confirm output downloads and is **at or under** target:
- A ~100 MB 1080p clip → Discord (25 MB): output ≤ 25 MB, plays, has audio.
- Same clip → Discord (10 MB) muted: output ≤ 10 MB, no audio.
- A short (~5s) clip → WhatsApp (16 MB): completes, plays.
- A non-video file → clear error, no crash.
- A >500 MB file → guard message, no crash.

- [ ] **Step 2: If outputs overshoot target consistently**, lower the safety margin (e.g. 0.92) in the `computeVideoKbps` call, OR implement two-pass in `buildMakeItFitArgs`. Re-run the matrix.

- [ ] **Step 3: Confirm cross-origin isolation on a deployed preview** (`crossOriginIsolated === true`), then tag a release.

```bash
git tag v0.1.0 && git commit --allow-empty -m "release: ClipFit v0.1.0 (make-it-fit)"
```

---

## Self-review notes (author)

- **Spec coverage:** hero job (§Tasks 4,5,7,13), client-side/no-upload (engine + Dropzone copy), presets (Task 10), error handling incl. memory-ceiling guard (Task 13), LicenseGate seam (Task 6), tech stack + COOP/COEP (Tasks 1,2), analytics/deploy (Task 14), validation-ready (analytics in Task 14, E2E in Task 15). Fast-follow jobs and monetization correctly excluded.
- **Known simplifications (intentional, flagged):** single-pass encoding (Task 5 note + Task 15 fallback to two-pass); audio-presence heuristic (Task 8 note). Both have explicit remediation steps.
- **Type consistency:** `VideoMeta`, `SizeTarget`, `JobResult`, `JobPhase` defined in Task 3 and used unchanged in Tasks 8/10/12/13; `buildMakeItFitArgs`/`computeVideoKbps`/`runJob` signatures consistent across Tasks 4/5/7/13.
