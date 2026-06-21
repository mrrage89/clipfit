# ClipFit v3 — UX Redesign + Theming — Design Spec

- **Date:** 2026-06-21
- **Status:** Design approved (directed by Jay) — implementing in phases
- **Builds on:** v2 toolkit (7 tools, on `feat/v2-toolkit`)

## 1. Summary

Make ClipFit feel like a polished product: a **theme system** (3 themes ×
light/dark, switchable + persisted), a **unified Studio editor** that combines
Trim + Crop + Edit on one page with a real trim scrubber, a **fix** for the crop
aspect/orientation bug, and **backend optimization** (combine operations into one
ffmpeg pass, stop double-writing the input, stream-copy where possible).

## 2. Goals / non-goals

- Goal: intuitive, attractive UI; one editing surface for trim/crop/edit; correct
  crop preview; faster/leaner processing.
- Non-goal: timeline/multi-clip editing, text overlay, monetization (still gated).

## 3. Theme system

- **Tokens** as CSS custom properties on `:root`, selected by
  `data-theme` (studio | noir | sunset) × `data-mode` (dark | light) → 6 palettes.
  Tokens: `--bg, --surface, --surface-2, --border, --accent, --accent-2, --text,
  --text-dim, --danger, --glow, --radius`.
- **Polish** (the part the flat previews can't show): glassy panels
  (`backdrop-filter: blur`, translucent surface), soft accent **glow** on active
  controls (`box-shadow` using `--glow`), rounded corners, accent gradient on
  primary buttons (accent → accent-2).
- **`ThemeSwitcher`** component: theme dropdown + light/dark toggle; choice saved
  to `localStorage`, applied on load (default: studio / dark).
- **All components restyled** to consume tokens (replace hardcoded hex/gray).
- Palettes (dark / light) defined in `src/theme/themes.ts` — Studio (violet+cyan),
  Noir (magenta+cyan), Sunset (amber+pink).

## 4. Crop aspect fix (bug)

Root cause: rotation metadata. `probeMedia` reports the **coded** resolution
(e.g. 1920×1080) but the decoded/extracted frame is **auto-rotated** to display
orientation (e.g. 1080×1920). Fix: in the crop UI, derive source dimensions from
the **extracted frame's actual pixels** (`Image.naturalWidth/Height`), and map
crop coords in that display space (which is what ffmpeg's filtergraph sees after
autorotate). Add a `naturalSize(blobUrl)` helper.

## 5. Unified Studio editor

- One page (replaces separate Trim/Crop/Edit tabs): **preview + crop box overlay**
  on an extracted frame, a **trim scrubber** beneath, and rotate/flip/speed/
  volume/fps controls in a side panel. Single **Export** button.
- **Composite job** `studioJob` with params
  `{ trim?: {startSec,endSec}; crop?: {x,y,w,h}; edit?: EditParams }` → one ffmpeg
  pass: input-seek `-ss/-t` (trim) + `-vf` chain `[crop, transpose/flip, fps,
  setpts]` + `-af` `[atempo, volume]` + libx264/yuv420p re-encode. Pure composer,
  TDD'd. Stream-copy when no filters apply.
- Compress / GIF / Extract-audio / Convert remain separate single-purpose tools.

## 6. Trim scrubber

- Extract a **filmstrip** of ~10 thumbnails in one ffmpeg pass
  (`-vf fps,scale,tile` or N seeks) up front.
- A range bar with draggable **in/out handles** over the filmstrip; the in/out
  **preview** is the nearest thumbnail to each handle (instant — no per-drag
  re-encode). Pure `nearestThumb(timeSec, duration, count)` helper, tested.

## 7. Backend optimization

- **Single-pass** composite (trim+crop+edit) instead of chaining tools (avoids
  multiple decode/encode round-trips).
- **Cache the written input**: `extractFrame`/filmstrip + the export currently each
  `writeFile` the whole file; key by file identity and reuse the FS copy.
- **Stream-copy** (`-c copy`) when an operation needs no re-encode (trim-only).
- Benchmark a representative clip before/after; record numbers in the decisions log.

## 8. Testing

- Theme: assert every theme×mode defines all tokens (no undefined).
- `studioJob` composer (pure, TDD): trim-only → stream copy; crop+rotate+speed →
  correct `-vf`/`-af`; no-op → copy.
- Crop mapping unchanged (already tested) + `nearestThumb` math.
- Native-ffmpeg E2E for the composite pass.

## 9. Build phases

1. **Theme system** (tokens, themes.ts, ThemeSwitcher, restyle components, polish).
2. **Crop aspect fix** (natural-dims).
3. **Unified Studio editor + trim scrubber** (composite job, filmstrip, scrubber).
4. **Backend optimization** (single-pass, input cache, benchmark).

## 10. Delegation

Restyling boilerplate + simple presentational components → gpt-oss; theme token
definitions, the composite args composer, crop math, scrubber interaction, and the
input-cache logic → main session.
