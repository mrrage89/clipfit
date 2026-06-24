# Browser Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 browser-extension wrapper of ClipFit — a toolbar button opens the full tool in a tab, with the ffmpeg core bundled locally — and package it for the Chrome/Edge/Opera/Firefox stores.

**Architecture:** One app, two build outputs. A Vite `extension` mode emits `dist-ext/` with relative paths; a post-build script bundles the ffmpeg core and the extension static files (manifest, background, icons). The engine branches on `import.meta.env.VITE_EXT` to load the core from local absolute URLs (extension) vs jsdelivr (web).

**Tech Stack:** Vite, TypeScript, Manifest V3, rsvg-convert (icons).

This is config/packaging work, so most tasks verify with build + structural checks rather than unit tests. The existing unit suite must stay green throughout.

Spec: `docs/superpowers/specs/2026-06-23-browser-extension-design.md`

---

### Task 1: Engine — load core locally in the extension build

**Files:**
- Modify: `src/engine/ffmpegEngine.ts:11-24`
- Create/modify: `src/vite-env.d.ts`

- [ ] **Step 1: Declare the env var** — create `src/vite-env.d.ts` (or add the interface if it exists):

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EXT?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 2: Replace the `createEngine` body** in `src/engine/ffmpegEngine.ts`:

```ts
async function createEngine(): Promise<FFmpeg> {
  // Single-thread core: growable heap, reliable on large real-world videos.
  const ffmpeg = new FFmpeg();
  if (import.meta.env.VITE_EXT === '1') {
    // Browser-extension build: the core is BUNDLED locally (MV3 forbids remote
    // code). Absolute chrome-extension:// URL so the worker (which lives under
    // /assets/) resolves it against the extension page, not its own path.
    const base = new URL(`ffmpeg/${CORE_VERSION}/`, location.href).href;
    await ffmpeg.load({ coreURL: `${base}ffmpeg-core.js`, wasmURL: `${base}ffmpeg-core.wasm` });
  } else {
    // Web build: core from jsdelivr (Cloudflare's 25 MiB asset cap can't hold the
    // ~31MB wasm). toBlobURL makes the cross-origin core same-origin for the worker.
    const baseURL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`;
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  }
  return ffmpeg;
}
```

- [ ] **Step 3: Verify web build unaffected** — `npm run typecheck && npx vitest run && npm run build`. Expected: all green, `dist/` still produced. (`import.meta.env.VITE_EXT` is undefined in the web build → the jsdelivr branch runs.)
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(ext): engine loads bundled core when VITE_EXT=1"`

---

### Task 2: Vite extension mode

**Files:**
- Modify: `vite.config.ts`
- Create: `.env.extension`

- [ ] **Step 1: Rewrite `vite.config.ts`** to switch base/outDir on mode:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `--mode extension` builds the browser-extension variant: relative asset paths
// (for chrome-extension://) and a separate output dir. `.env.extension` sets
// VITE_EXT=1 so the engine bundles the core. No COOP/COEP (single-thread core).
export default defineConfig(({ mode }) => {
  const ext = mode === 'extension';
  return {
    base: ext ? './' : '/',
    build: { outDir: ext ? 'dist-ext' : 'dist' },
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test-setup.ts',
    },
  };
});
```

- [ ] **Step 2: Create `.env.extension`**:

```
VITE_EXT=1
```

- [ ] **Step 3: Verify** — `npm run build` still emits `dist/` (web). `npx vite build --mode extension` emits `dist-ext/` with `index.html` referencing `./assets/...` (relative). Check: `grep -q './assets' dist-ext/index.html && echo OK`.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(ext): vite extension mode (relative base, dist-ext)"`

---

### Task 3: Extension static files (manifest, background, icon SVGs)

**Files:**
- Create: `extension/manifest.json`, `extension/manifest.firefox.json`, `extension/background.js`, `extension/icon.svg`, `extension/icon-16.svg`

- [ ] **Step 1: `extension/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "ClipFit — Video Compressor & Editor",
  "version": "1.0.0",
  "description": "Compress, convert, trim, crop & GIF videos right in your browser. No uploads, no watermark, no sign-up.",
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "action": { "default_title": "Open ClipFit" },
  "background": { "service_worker": "background.js" },
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  "permissions": []
}
```

- [ ] **Step 2: `extension/manifest.firefox.json`** (same, Firefox background form + id)

```json
{
  "manifest_version": 3,
  "name": "ClipFit — Video Compressor & Editor",
  "version": "1.0.0",
  "description": "Compress, convert, trim, crop & GIF videos right in your browser. No uploads, no watermark, no sign-up.",
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "action": { "default_title": "Open ClipFit" },
  "background": { "scripts": ["background.js"] },
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  "permissions": [],
  "browser_specific_settings": {
    "gecko": { "id": "clipfit@mrrage.dev", "strict_min_version": "121.0" }
  }
}
```

- [ ] **Step 3: `extension/background.js`**

```js
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});
```

- [ ] **Step 4: `extension/icon.svg`** (compress-frame mark, for 32/48/128)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c6cf6"/>
      <stop offset="1" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="22" fill="url(#g)"/>
  <rect x="24" y="24" width="48" height="48" rx="8" fill="none" stroke="#ffffff" stroke-width="6"/>
  <path d="M30 40 L30 56 L42 48 Z" fill="#ffffff"/>
  <path d="M66 40 L66 56 L54 48 Z" fill="#ffffff"/>
</svg>
```

- [ ] **Step 5: `extension/icon-16.svg`** (bolder, for the 16px render)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c6cf6"/>
      <stop offset="1" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="20" fill="url(#g)"/>
  <rect x="20" y="20" width="56" height="56" rx="10" fill="none" stroke="#ffffff" stroke-width="9"/>
  <path d="M28 38 L28 58 L44 48 Z" fill="#ffffff"/>
  <path d="M68 38 L68 58 L52 48 Z" fill="#ffffff"/>
</svg>
```

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(ext): MV3 manifests, background worker, icon sources"`

---

### Task 4: Render icon PNGs

**Files:**
- Create: `extension/icons/icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`

- [ ] **Step 1: Render** (rsvg-convert is installed):

```bash
mkdir -p extension/icons
rsvg-convert -w 16 -h 16 extension/icon-16.svg -o extension/icons/icon-16.png
rsvg-convert -w 32 -h 32 extension/icon.svg -o extension/icons/icon-32.png
rsvg-convert -w 48 -h 48 extension/icon.svg -o extension/icons/icon-48.png
rsvg-convert -w 128 -h 128 extension/icon.svg -o extension/icons/icon-128.png
```

- [ ] **Step 2: Verify** — `file extension/icons/*.png` shows `PNG image data, 16 x 16`, `32 x 32`, `48 x 48`, `128 x 128`.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat(ext): rendered icon PNGs (16/32/48/128)"`

---

### Task 5: Packaging script + npm scripts

**Files:**
- Create: `scripts/build-ext.mjs`
- Modify: `package.json`, `.gitignore`

- [ ] **Step 1: `scripts/build-ext.mjs`** — runs after `vite build --mode extension` to add the core + static files, and emit the Firefox variant:

```js
import { copyFileSync, mkdirSync, readFileSync, cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreDir = join(root, 'node_modules', '@ffmpeg', 'core');
const version = JSON.parse(readFileSync(join(coreDir, 'package.json'), 'utf8')).version;

function addExtras(outDir, manifestFile) {
  const out = join(root, outDir);
  const dest = join(out, 'ffmpeg', version);
  mkdirSync(dest, { recursive: true });
  for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
    copyFileSync(join(coreDir, 'dist', 'esm', f), join(dest, f));
  }
  copyFileSync(join(root, 'extension', manifestFile), join(out, 'manifest.json'));
  copyFileSync(join(root, 'extension', 'background.js'), join(out, 'background.js'));
  cpSync(join(root, 'extension', 'icons'), join(out, 'icons'), { recursive: true });
  console.log(`packed ${outDir} (core ${version}, ${manifestFile})`);
}

addExtras('dist-ext', 'manifest.json');

// Firefox: identical app build, different manifest.
const ff = join(root, 'dist-ext-firefox');
rmSync(ff, { recursive: true, force: true });
cpSync(join(root, 'dist-ext'), ff, { recursive: true });
copyFileSync(join(root, 'extension', 'manifest.firefox.json'), join(ff, 'manifest.json'));
console.log('packed dist-ext-firefox (manifest.firefox.json)');
```

- [ ] **Step 2: Add npm scripts** to `package.json` (after `"build": "vite build",`):

```json
    "build:ext": "vite build --mode extension && node scripts/build-ext.mjs",
```

- [ ] **Step 3: Gitignore the outputs** — append to `.gitignore`:

```
dist-ext/
dist-ext-firefox/
```

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(ext): build:ext packaging script (core + manifest + Firefox variant)"`

---

### Task 6: Build, verify, and document loading

**Files:**
- Modify: `docs/superpowers/specs/2026-06-23-browser-extension-design.md` (none) — verification only.

- [ ] **Step 1: Build** — `npm run build:ext`. Expected console: `packed dist-ext ...` and `packed dist-ext-firefox ...`.

- [ ] **Step 2: Structural checks**

```bash
ls dist-ext/manifest.json dist-ext/background.js dist-ext/index.html dist-ext/icons/icon-128.png
ls dist-ext/ffmpeg/0.12.10/ffmpeg-core.wasm
node -e "JSON.parse(require('fs').readFileSync('dist-ext/manifest.json','utf8')); console.log('manifest OK')"
grep -rl "jsdelivr" dist-ext/assets && echo "WARN: jsdelivr string present (dead branch)" || echo "no jsdelivr in ext bundle (DCE worked)"
ls dist-ext-firefox/manifest.json && grep -q gecko dist-ext-firefox/manifest.json && echo "firefox manifest OK"
```
Expected: all files exist, manifest parses, no jsdelivr in the extension bundle, Firefox manifest has the gecko block.

- [ ] **Step 3: Manual load-unpacked smoke test** (record the result):
  - Chrome/Edge: `chrome://extensions` → enable Developer mode → **Load unpacked** → select `dist-ext`. Confirm the icon appears in the toolbar, clicking it opens ClipFit in a tab.
  - In that tab, open DevTools → Network, run a small **Compress**. Confirm the job completes and **there is no request to jsdelivr** (the core loads from `chrome-extension://…/ffmpeg/…`).
  - Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → `dist-ext-firefox/manifest.json`. Same checks.

- [ ] **Step 4: Final gate** — `npm run typecheck && npx vitest run && npm run build` green (web build still fine).
- [ ] **Step 5: Commit** if anything changed — `git commit -am "test(ext): verified unpacked load + local core"`

---

### Store submission runbook (separate from the build — your accounts)

After the package builds clean, zip and upload:

```bash
cd dist-ext && zip -r ../clipfit-chromium.zip . && cd ..
cd dist-ext-firefox && zip -r ../clipfit-firefox.zip . && cd ..
```

- **Chrome Web Store** (`chrome.google.com/webstore/devconsole`, $5 one-time): new item → upload `clipfit-chromium.zip` → fill listing (description, screenshots, 128px icon, category Productivity, privacy: "processes everything locally, collects no data") → submit.
- **Edge Add-ons** (`partner.microsoft.com`, free): same `clipfit-chromium.zip`.
- **Opera add-ons** (`addons.opera.com`, free): same `clipfit-chromium.zip`.
- **Firefox AMO** (`addons.mozilla.org/developers`, free): upload `clipfit-firefox.zip`; if asked for source, point to the public repo.

Listing assets (prepared separately): screenshots captured from the live site at clipfit.mrrage.workers.dev (main page, Compress, GIF, Edit).
