# Building ClipFit from source

This document lets a reviewer reproduce the submitted extension package
(`clipfit-firefox.zip` for AMO, `clipfit-chromium.zip` for Chrome/Edge/Opera)
from the source in this archive.

## Environment

- **Node.js** 20 or newer (this release was built with Node 26.3.1)
- **npm** 10 or newer (used 11.16.0)
- **OS**: any — developed on Linux, but the build is platform-independent.
- The only network access needed at build time is the npm registry, to install
  dependencies. **The extension itself makes no network requests** and collects
  no data; all video processing runs locally in the browser via WebAssembly.

## Build steps

1. Unzip this archive and open a terminal in its root (the folder containing
   `package.json`).
2. Install the exact pinned dependencies:

   ```
   npm ci
   ```
3. Build the extension:

   ```
   npm run build:ext
   ```
4. The complete, unpacked extensions are produced in:

   - `dist-ext-firefox/` — Firefox build (uses `extension/manifest.firefox.json`)
   - `dist-ext/` — Chromium build (Chrome / Edge / Opera)

   The submitted ZIP is simply the contents of the matching folder, zipped from
   inside it, e.g. for Firefox:

   ```
   cd dist-ext-firefox && zip -r ../clipfit-firefox.zip .
   ```

## What the build does

- `vite build --mode extension` bundles the app (React + TypeScript, all in
  `src/`) with `VITE_EXT=1` (set in `.env.extension`). That flag makes the app
  load the FFmpeg WebAssembly core from a file **bundled inside the extension**
  instead of from a CDN — so the package contains no remote code, per MV3.
- `node scripts/build-ext.mjs` then:
  - copies the FFmpeg core (`@ffmpeg/core`, a pinned dependency) into
    `dist-ext-firefox/ffmpeg/<version>/`,
  - copies the icons and `extension/background.js`,
  - installs `extension/manifest.firefox.json` as `manifest.json`.

## Third-party libraries (unmodified, installed via npm)

- `react`, `react-dom` — UI framework
- `@ffmpeg/ffmpeg`, `@ffmpeg/util`, `@ffmpeg/core` — a WebAssembly build of
  FFmpeg, used for all video/audio processing

Note on AMO automated warnings: the "unsafe call to import" warning originates
from `@ffmpeg/ffmpeg`'s worker loader, and the "unsafe assignment to innerHTML"
warnings originate from React's DOM renderer. There are no uses of `innerHTML`
in the first-party source under `src/`.
