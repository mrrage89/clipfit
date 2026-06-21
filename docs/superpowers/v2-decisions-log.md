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
