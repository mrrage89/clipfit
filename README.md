# ClipFit

Make any video fit a size limit — **entirely in your browser**. Drop a video,
pick a target (Discord / Email / WhatsApp / custom MB), and download a re-encoded
MP4 that lands just under the limit. No upload, no watermark, no size cap, no
account. Powered by `ffmpeg.wasm`.

> v1 ships the **"Make it fit"** job only. Video→GIF, extract-audio, and trim are
> planned fast-follows on the same engine.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # vitest (unit tests for the pure logic)
npm run typecheck  # tsc --noEmit
npm run build      # -> dist/
```

## How it works

- **Bitrate targeting** (`src/jobs/bitrate.ts`): given a target size and the
  video's duration, computes the video bitrate (minus audio + a 5% safety margin)
  so the output lands just under the limit.
- **Encoding** (`src/jobs/makeItFit.ts` + `src/engine/ffmpegEngine.ts`): builds
  the ffmpeg args and runs `ffmpeg.wasm` (H.264/AAC MP4) in a worker.
- **Scope:** tuned for ffmpeg.wasm's sweet spot — small/medium files. Inputs over
  ~500 MB are rejected up front (the WASM heap caps near 2 GB).

## Cross-origin isolation (required)

The multithreaded ffmpeg core needs `SharedArrayBuffer`, which requires the page
to be **cross-origin isolated** via two response headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

- **Dev:** set in `vite.config.ts` (`server.headers`).
- **Prod:** set in `public/_headers` (Cloudflare Pages format; Vite copies
  `public/` into `dist/`).
- If isolation is unavailable, the engine automatically falls back to the
  single-threaded core (slower, but still works).

Verify in the browser console: `crossOriginIsolated === true`.

## Deploy (Cloudflare Pages)

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- `dist/_headers` ships automatically — confirm COOP/COEP on the live URL.

## Analytics

A privacy-friendly, cookieless analytics placeholder lives commented in
`index.html`. Paste your Cloudflare Web Analytics or Plausible snippet there to
enable it. No personal data and no file data ever leaves the device.

## Manual test matrix (run in a browser before release)

| Input | Target | Expect |
|-------|--------|--------|
| ~100 MB 1080p clip | Discord (25 MB) | output ≤ 25 MB, plays, has audio |
| same clip | Discord (10 MB) | output ≤ 10 MB |
| short (~5s) clip | WhatsApp (16 MB) | completes, plays |
| a non-video file | — | clear error, no crash |
| a >500 MB file | — | guard message, no crash |

If outputs consistently overshoot the target, lower the safety margin in the
`computeVideoKbps` call (e.g. 0.92) or add a two-pass encode in
`buildMakeItFitArgs`.
