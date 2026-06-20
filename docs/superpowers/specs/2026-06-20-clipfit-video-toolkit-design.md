# ClipFit (working name) — v1 Design Spec

- **Date:** 2026-06-20
- **Status:** Approved design — pre-implementation
- **Owner:** Jay (solo, AI-assisted build)

## 1. Summary

A free, fully client-side (in-browser) video utility. v1 ships a **single hero
job: "Make it fit"** — compress a video so it lands *just under* a chosen size
target (Discord / Email / WhatsApp / custom MB), processed entirely on the
user's device via `ffmpeg.wasm`. **No upload, no watermark, no size cap, no
account.** Privacy ("your file never leaves your device") is a trust signal, not
the differentiator.

## 2. Why this, briefly

Chosen after demand-vs-incumbent research:

- "Video compressor" draws ~90,500 searches/month, yet video-compressor
  *extensions* are tiny (~1k users) — the demand is captured by **websites**, and
  the web incumbents are nearly all **upload-based, size-capped, and
  watermarked.** That is the gap a clean client-side tool attacks.
- The "make it fit under N MB" job is **inherently a small-file job**, so
  `ffmpeg.wasm`'s main weaknesses (slow on large files, ~2 GB memory ceiling)
  never bite.
- Near-zero infra (static host + domain) fits the goal: steady, low-upkeep
  side income.

This is an **execution + discovery** play with a thin moat, not a defensible
monopoly. Realistic odds (per research): ~15–25% of clearing $1–5k/mo on a single
shot, higher across a 2–3 tool portfolio.

## 3. Goals

- Solo-built, AI-assisted, **low ongoing upkeep** (≤5 hrs/week post-launch).
- **Near-zero infra cost** (static hosting + a domain, ~$12/yr).
- Wide consumer audience via one **sharp, high-intent** job.
- **Validate organic discovery before investing further.**

## 4. Non-goals (v1)

- **No monetization at launch** — deferred (see §11). Architecture must leave a
  clean seam so a Pro/paywall layer or ads can be added with no refactor.
- No accounts; no backend that stores user files or data.
- No large-file handling beyond **graceful detection + warning** (files near the
  ~2 GB WASM memory ceiling, or roughly >500 MB, are out of scope and must fail
  loudly with a clear message, not crash).
- The fast-follow jobs (video→GIF, extract-audio, trim) are **designed for but
  not built** in v1.

## 5. Success criteria & validation gate

1. Ship the hero job **free, with zero paid promotion.**
2. Instrument privacy-friendly analytics (sessions, job starts, job completions).
3. **Green-light gate for the next phase** (monetization research + Pro layer):
   **≥ ~300 organic sessions/week sustained over 4–6 weeks post-launch, with a
   job-completion rate ≥ 50%.** If organic traffic does not materialize, the tool
   has failed its core hypothesis (discovery) and we either iterate on
   SEO/positioning or move to the next portfolio shot rather than build more
   features.

## 6. Users & core flow

Single-page, no navigation:

1. **Dropzone** — drag/drop or pick a video file.
2. **Auto-detect** duration, dimensions, current size, audio track presence.
3. **Target picker** — presets (Discord 10/25/50 MB, Email 25 MB, WhatsApp
   16 MB) or custom MB.
4. **Progress** — live % from `ffmpeg`'s progress callback.
5. **Result** — preview + one-click download; show final size vs target.

## 7. Architecture (designed for isolation + testability)

Each unit has one purpose, a defined interface, and is testable in isolation.

- **Engine module** — thin wrapper over `ffmpeg.wasm`, runs in a **Web Worker**
  so the UI stays responsive. Interface: `run(file, jobSpec) → { blob,
  onProgress }`. Knows nothing about specific jobs.
- **Job module: `makeItFit`** — a **pure function** `params → ffmpegArgs`. No
  WASM needed to test it.
- **Bitrate calculator** — a **pure function**
  `(targetBytes, durationSec, audioKbps, safetyMargin) → videoKbps`. The brain of
  the hero job; built test-first.
- **UI components** — `Dropzone`, `TargetPicker`, `Progress`, `Result`. Each
  independently understandable.
- **`LicenseGate` seam** — a no-op interface in v1 where **every feature returns
  "allowed."** This is the single insertion point for future Pro gating; nothing
  else in the app references monetization.
- **Error handling (fail fast, fail loud):**
  - File too large for memory ceiling → detect **before** processing, warn.
  - Unsupported codec/container → clear message.
  - Browser missing cross-origin isolation (no `SharedArrayBuffer`) → fall back
    to single-thread `ffmpeg.wasm`, or warn if unavailable.
  - `ffmpeg` failure → caught, surfaced with a friendly, specific error.

## 8. "Make it fit" algorithm

```
target_bits      = target_bytes * 8 * safety_margin   # safety_margin ≈ 0.95
audio_bits       = audio_kbps * 1000 * duration_sec    # 0 if stripping/no audio
video_kbps       = max(MIN_VIDEO_KBPS,
                       (target_bits - audio_bits) / duration_sec / 1000)
```

- Output **H.264 video / AAC audio in MP4** (max compatibility for Discord,
  email, WhatsApp).
- Prefer **two-pass** encoding for accurate size if viable in `ffmpeg.wasm`;
  otherwise single-pass at computed bitrate + safety margin, with an **optional
  verify-and-retry** if the output overshoots the target.
- Guard rails for: very short/long clips, audio-only or no-audio inputs, targets
  so small they're physically unachievable at acceptable quality (warn).

## 9. Tech stack & hosting

- **Vite + React + TypeScript** (largest ecosystem / strongest AI-assist;
  framework choice is low-stakes since `ffmpeg.wasm` is the heavy part).
- **`@ffmpeg/ffmpeg`** in a Web Worker; multithread build behind **COOP + COEP**
  response headers.
- **Cloudflare Pages** (free tier, supports custom headers for COOP/COEP).
  Infra cost ≈ a domain (~$12/yr).
- **Privacy-friendly analytics** (Cloudflare Web Analytics / Plausible / Umami) —
  no PII, no file data.

## 10. Distribution

- **Transactional SEO**: a landing page per preset/job ("compress video for
  discord", "compress video for email", etc.) — bottom-of-funnel queries that
  resist AI Overviews because the user must perform the action.
- **One-time community seeding**: a single targeted post each to relevant
  communities (e.g. r/discordapp, r/webdev, Show HN). Not a pipeline — a launch
  spike + first reviews.
- **Chrome-extension wrapper**: deferred second discovery channel.

## 11. Future / deferred (NOT v1)

- **Fast-follow jobs** (share the engine): video→GIF, extract-audio (MP3/WAV),
  trim.
- **Monetization** — explicitly deferred until the validation gate (§5) is met.
  Plan: a **deeper, dedicated monetization research pass**, then most likely a
  one-time **Pro unlock** (Lemon Squeezy / Paddle as Merchant-of-Record to offload
  global tax/VAT), or free + unobtrusive ads. Plugs into the `LicenseGate` seam.
- **Chrome-extension wrapper** for a second discovery channel.

## 12. Risks

- **Discovery is the real risk**, not the build. Thin moat; clones are cheap.
  Mitigation: own specific transactional queries, accumulate first reviews, ship
  a portfolio over time.
- **`ffmpeg.wasm` performance/memory** — mitigated by the deliberate small-file
  scope and upfront size guards.
- **COOP/COEP host configuration** — required for multithreading; verified on
  Cloudflare Pages during setup.
- **Platform/SEO shifts** (AI Overviews eroding clicks) — mitigated by leaning on
  transactional queries and community/extension channels, not informational SEO.
