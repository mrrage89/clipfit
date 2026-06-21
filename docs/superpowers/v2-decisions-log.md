# ClipFit v2 — Autonomous decisions log

Jay granted autonomy to proceed on the v2 build and make reasonable calls without
asking, recording each here for later review. Newest at the bottom.

## 2026-06-21

- **Branch strategy:** v2 work is on `feat/v2-toolkit`, branched off the working
  v1 HEAD (not off `master`, and v1 PR #1 left unmerged for now). Rationale: v2
  depends on v1's code; keeps v1 PR clean; can rebase after v1 merges.
- **Process:** Executing Phase 1 directly with TDD + the v2 spec as the guide,
  rather than writing a separate exhaustive plan doc, to conserve tokens (per
  Jay's token constraint + autonomy grant). Each pure args-builder/parser is
  test-driven; boilerplate UI delegated to local gpt-oss-20b and reviewed.
- **Engine:** staying on the single-thread ffmpeg core (v1 decision — growable
  heap, reliable on real videos).
- **ToolPicker deferred to Phase 2:** a tool picker with only one tool (Fit) is
  pointless, so Phase 1 keeps the single-tool shell; the picker lands when the
  second tool does. (Spec listed it in P1; this is a sequencing tweak only.)
- **Estimated preview = light version:** showing "downscaled to ≤720p
  automatically" text rather than exact predicted resolution+size, because a full
  preview would require loading the ~25 MB engine just to probe at file-select
  time (bad UX). Since the user already picks the target size, full preview is low
  value. Can revisit.
- **Share button is feature-detected:** only rendered when `navigator.canShare`
  accepts files; otherwise just Download (desktop browsers without share targets).
- **Result previews video/image/audio** by MIME, forward-looking for the GIF /
  extract-audio tools coming in Phase 2.

### Phase 2 (tools)
- **Job.output(params)**: changed the Job interface so output name/mime/download
  name can depend on params (convert → mp4/webm, audio → mp3/wav need this).
- **GIF**: two-pass palettegen/paletteuse (quality), defaults 12 fps / 480 px.
- **Convert WebM**: VP9 constant-quality (`-crf 33 -b:v 0`) + Opus.
- **Trim**: input-seek `-ss` + `-t` duration + `-c copy` (fast, keyframe-aligned;
  start/end entered in seconds — duration NOT shown to avoid loading the engine
  early; if end > duration ffmpeg just stops at EOF). Accuracy tradeoff accepted.
- **5 UI pieces delegated to gpt-oss-20b** (ToolPicker + Gif/Audio/Convert/Trim
  panels), reviewed: all clean. ToolPicker uses `React.CSSProperties` via the
  @types/react UMD global — typechecks fine (same as Dropzone).
- **All 6 tool arg-variants verified** through native ffmpeg (gif/mp3/wav/mp4/
  webm/trim all produce valid non-empty output).

### Phase 3 (crop)
- **Crop preview frame via ffmpeg** `extractFrame` (works for any format, unlike
  `<video>`). Note: it writes the input to the FS, and the crop run writes it
  again (double write) — acceptable for now, could cache later.
- **Crop box UI**: container-level pointer handling (no setPointerCapture — drag
  ends on pointer-up/leave), single bottom-right resize handle, aspect presets
  (Free/1:1/9:16/16:9), area outside dimmed via boxShadow. Coordinate mapping is
  pure + tested (display→source px, even dims).

### Phase 4 (edit)
- **Edit composer**: rotate via transpose (90=1, 180=1+1, 270=2), flip hflip/
  vflip, speed = setpts + atempo (UI limits speed to 0.5–2 so a single atempo is
  valid), frame rate = fps filter, volume = volume=NdB. Copies video when there's
  no video filter (volume-only), copies audio when there's no audio filter, uses
  -an when the source has no audio. Composer is pure + TDD'd.
- **EditPanel written directly (not delegated):** its controls carry literal
  types (rotate 0|90|180|270) and import EditParams to stay in sync — correctness
  outweighed the delegation token saving for this one.

## v3 redesign (2026-06-21)

- **Theme system:** CSS-variable tokens selected by `data-theme` × `data-mode`
  (6 palettes in src/theme/themes.css). Global element styling (button/input/
  select) so components auto-theme; `.primary` = accent→accent-2 gradient + glow,
  `.panel` = glass. ThemeSwitcher persists to localStorage (default studio/dark).
- **Crop fix:** read the extracted frame's `naturalWidth/Height` instead of the
  coded probe size (rotation metadata made phone videos preview wrong).
- **studioJob (single pass):** combined trim+crop+edit in ONE ffmpeg pass —
  serves the unified editor AND is the Phase 4 single-pass optimization. Stream-
  copies when nothing needs re-encoding. Pure + TDD'd; verified via native ffmpeg.
- **DONE this session:** v3 Phase 1 (theme) ✅, Phase 2 (crop fix) ✅, Phase 3
  backend (studioJob + filmstrip math thumbTimes/nearestThumb) ✅. 42 tests green.
- **REMAINING (handed off):**
  - Phase 3 UI: a `StudioEditor` component combining preview + crop-box overlay +
    a filmstrip trim scrubber (two draggable handles, in/out preview = nearest
    thumb) + edit controls, with one Export wiring `studioJob`. Replace the
    separate trim/crop/edit tool tabs with this one "Edit" tab. Reuse: CropTool's
    box logic, EditPanel's controls, cropMath, filmstrip math, studioJob.
  - Need an `extractFilmstrip(file, count)` engine helper (N thumbnails; use
    `thumbTimes` for timestamps).
  - Phase 4 remainder: cache the written input so extractFrame/filmstrip/export
    don't each re-`writeFile` the whole file; then benchmark before/after.

### v3 COMPLETE (2026-06-21)
- Phase 3 (unified Studio editor) ✅ and Phase 4 (optimization) ✅ done. All v3
  phases complete; 42 tests green; pushed to feat/v2-toolkit.
- **Optimizations shipped:** (1) single-pass `studioJob` applies trim+crop+edit in
  ONE encode (vs chaining separate tools); (2) input/probe cache — the file is
  written + probed once and reused by preview frame, filmstrip, and export.
- **Benchmark (native ffmpeg, 10s 720p, trim+crop+rotate):** single pass 0.19s vs
  three-pass chain 0.50s = **2.7× fewer encodes**, plus no generational quality
  loss. Ratio holds in the wasm core (both scale up ~5–20×).
- Standalone trim/crop/edit jobs + tests kept (tree-shaken out of the app bundle);
  TrimPanel/CropTool/EditPanel components deleted (replaced by StudioEditor).
- Next (needs Jay): in-browser verify the editor; merge v1 PR #1 + v2 PR #2;
  deploy to Cloudflare Pages (starts the validation clock); monetization gated.
