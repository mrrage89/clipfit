# ClipFit — Unified single-page flow (design)

- **Date:** 2026-06-23
- **Status:** Approved (brainstorm), pending implementation plan
- **Branch:** `feat/unified-page`

## Goal

Collapse the 5-tool tab picker into one page where **editing is an optional
prepare step** and the user picks an **output**. Editing (trim/crop/rotate/flip/
speed/fps/volume) is conceptually pre-processing for the video about to be
compressed — not a peer operation — so it becomes a toggle, and its edits bake
into whatever output runs.

## Layout (top to bottom)

```
drop a video  ·  [filename]
┌─ source preview ─────────────┐   poster/video when Edit OFF;
└──────────────────────────────┘   editor canvas when Edit ON

( ● ) Edit            pill, default OFF
   └ ON: Trim scrubber + Crop + Rotate/Speed/FPS + Volume slider + flip icons

[ Compress | GIF ]    pill, default Compress
   └ Compress: Size ▾ · Quality ▾ · Format MP4/WebM · Mute
   └ GIF: slice · FPS · Width · Quality · Estimate

[  Compress  ]        primary run button (label follows the output pill)
[ Export audio ]      separate button (MP3 default, small WAV option)
[ Choose a different file ]
```

The `ToolPicker` (5 tabs) is removed. Convert becomes the **MP4/WebM** choice
inside Compress. The old Edit tab becomes the Edit pill.

## Behavior — which edits apply to which output

- **Edit pill OFF** → no edits; outputs run on the source.
- **Compress** → full edit chain applies: trim, crop, rotate, flip, speed, fps,
  volume.
- **Export audio** → trim, speed (atempo), and volume apply; video-only filters
  (crop/rotate/flip/fps) are ignored.
- **GIF** → keeps its existing **self-contained panel** (its own short slice,
  fps, width, quality, estimate). In v1 the Edit-pill edits do **not** feed GIF —
  GIFs need their length-capped slice, and that UX already exists. (Crop-into-GIF
  is a noted future enhancement.) The Edit pill stays visible regardless of
  output; when the output is GIF, the GIF panel shows a one-line note: *"Edit
  controls don't affect GIF — use the options here."*

## Architecture — edits bake into the output (single pass)

Today each tool builds its own ffmpeg command and `studioJob` does edits
separately. Extract the edit logic into one reusable builder and make the video
output jobs edit-aware so "trim + crop + compress" is a **single encode** (best
quality, no double pass — same principle as the existing single-pass work).

### `src/jobs/editChain.ts` (new, pure, unit-tested)

```ts
import type { EditParams } from './edit';
export interface EditChain {
  seek: string[]; // input-seek for trim, e.g. ['-ss','3','-t','5']
  vf: string[];   // ordered video filters: crop,transpose,hflip/vflip,fps,setpts
  af: string[];   // audio filters: atempo,volume
}
export function buildEditChain(edits?: EditParams): EditChain;
export function effectiveDurationSec(fullDurationSec: number, edits?: EditParams): number;
```

- `buildEditChain` returns the trim seek + ordered filters (lifted from the
  current `studio.ts`/`edit.ts` logic). Empty arrays when a piece is unset.
- `effectiveDurationSec` = `(trim ? trim.end - trim.start : full) / (speed ?? 1)`
  — the **output** duration after trim+speed.

### `fitJob` becomes edit-aware + format

- New params: `edits?: EditParams`, `format: 'mp4' | 'webm'`.
- **Bitrate budget uses `effectiveDurationSec`**, not the full clip — so a trimmed
  (and/or sped-up) clip still lands under the size target.
- Compose: `[...seek, '-i', input, '-vf', [...editVf, scale].join(','), <codec>,
  '-af', editAf...]`. `format='webm'` → `-c:v libvpx-vp9 -c:a libopus`, `.webm`
  container; `'mp4'` → current libx264 path. Two-pass (Best) keeps edit filters in
  both passes.

### `audioJob` becomes edit-aware

- Accepts `edits?`; prepends trim seek and the `af` (atempo/volume); ignores `vf`.

### Retired

- `studioJob` — its filter logic moves into `editChain.ts`; there is no longer a
  standalone "export edited video" output (Compress with a generous size covers
  "trim & keep quality"; an explicit "original quality" mode is a noted future
  add).
- `convertJob` — folded into `fitJob`'s `format`.
- `gifJob` — **unchanged** (self-contained).

## Components / files

- **Remove:** `ToolPicker.tsx`, `ConvertPanel.tsx`.
- **`Editor.tsx`** (refactor of `StudioEditor.tsx`): controlled — props
  `{ file, onChange(edits: EditParams | undefined) }`. Owns probe/frame/filmstrip/
  crop/trim/transform state and the canvas + controls UI; reports the assembled
  `EditParams` up. Mounted only when the Edit pill is ON.
- **`CompressPanel.tsx`** (from `TargetPicker`): size + quality + **format
  MP4/WebM** + mute.
- **`GifPanel.tsx`**: unchanged.
- **`App.tsx`**: single-page orchestrator. State: `file`, `editOn`, `edits`,
  `output: 'compress'|'gif'`. Runs the chosen edit-aware job, passing `edits` (or
  `undefined` when the pill is off). The Export-audio button runs `audioJob` with
  `edits`.
- **`Toggle.tsx`**: reused for the Edit pill; a segmented control (existing
  `.segmented` styles) for the Compress/GIF pill.

## Data flow

1. Load file → if Edit ON, `Editor` probes + renders; reports `edits` up on every
   change. If OFF, `App` shows `VideoPreview`, `edits = undefined`.
2. User picks output (Compress default) + its options; clicks Run (or Export
   audio).
3. `App` calls `runJob` with the edit-aware job + `{ ...outputParams, edits }`.
4. Job builds one composed ffmpeg command (seek + edit filters + output
   encoding) and runs.

## Testing

- `buildEditChain`: each edit produces the right ordered filters / seek; empty
  when unset.
- `effectiveDurationSec`: trim, speed, and trim+speed math.
- `fitJob`: edits compose (seek before `-i`; editVf before `scale`); budget uses
  effective duration; `format='webm'` selects vp9/opus + `.webm`.
- `audioJob`: trim seek + af present; no video filters.
- Native ffmpeg spot-check: a trim+crop+compress runs as a single pass and lands
  under target; a webm compress plays.

## Out of scope (noted, not built)

- Crop/transform applied to GIF output.
- An explicit "original quality" (CRF, no size target) export mode.
- Multiple simultaneous outputs.
