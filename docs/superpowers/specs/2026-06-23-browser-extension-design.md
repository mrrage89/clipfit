# ClipFit — Browser extension (design)

- **Date:** 2026-06-23
- **Status:** Approved (brainstorm), pending implementation plan
- **Branch:** `feat/browser-extension`

## Goal

Package the existing ClipFit web app as a browser extension and publish it to the
major stores (Chrome, Edge, Opera, Firefox). The extension is a thin wrapper: a
toolbar button opens the full ClipFit tool in a tab, running entirely locally.

## The constraint that shapes everything

The website loads the ~31 MB ffmpeg core from the jsdelivr CDN. **Manifest V3 and
every store forbid remote code**, so an extension that fetches+runs remote
JS/wasm gets rejected. Therefore the extension must **bundle the ffmpeg core
locally**. Extensions have no per-file size cap (unlike Cloudflare's 25 MiB), so
this is fine — and it reuses the `copy-core.mjs` self-hosting script we already
wrote. Net: **one shared app, two build outputs** — web (CDN core) and extension
(bundled core + manifest).

## Architecture

### Two build outputs

- **Web build** (unchanged): `npm run build` → `dist/`, core from jsdelivr. Deploys
  to Cloudflare.
- **Extension build** (new): `npm run build:ext` →
  1. `VITE_EXT=1 vite build` with `base: './'` and `outDir: 'dist-ext'` (relative
     paths so assets resolve under `chrome-extension://<id>/`).
  2. A post-step (`scripts/build-ext.mjs`) copies the ffmpeg core into
     `dist-ext/ffmpeg/<version>/`, and copies the static extension files
     (`extension/manifest.json`, `extension/background.js`, `extension/icons/*`)
     into `dist-ext/`.
- `vite.config.ts` reads `process.env.VITE_EXT` to switch `base` + `outDir`. No
  separate config file.

### Engine: core source by build flag

`src/engine/ffmpegEngine.ts` branches on `import.meta.env.VITE_EXT`:

```ts
const EXT = import.meta.env.VITE_EXT === '1';
if (EXT) {
  // Absolute chrome-extension:// URL — must NOT be relative, or the worker (which
  // lives under /assets/) resolves it against the wrong path. new URL(..., location.href)
  // resolves against the extension page (chrome-extension://<id>/index.html).
  const base = new URL(`ffmpeg/${CORE_VERSION}/`, location.href).href;
  await ffmpeg.load({ coreURL: `${base}ffmpeg-core.js`, wasmURL: `${base}ffmpeg-core.wasm` });
} else {
  const baseURL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`;
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
}
```

Why: the web build's core is cross-origin (jsdelivr), so the worker needs the
`toBlobURL` trick. The extension's core is **same-origin local**, so we pass direct
**absolute** URLs and avoid `blob:` entirely — which keeps it within the MV3 CSP
(`blob:` is not in `'self'`).

### UX: toolbar button → new tab

MV3 `action` with a background service worker that opens the bundled page:

```js
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});
```

A tab (not a popup) because the editor/preview needs room. Opening a tab needs **no
permissions**.

### Manifest (Chromium — Chrome / Edge / Opera)

`extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "ClipFit — Video Compressor & Editor",
  "version": "1.0.0",
  "description": "Compress, convert, trim, crop & GIF videos right in your browser. No uploads, no watermark, no sign-up.",
  "icons": { "16": "icons/icon-16.png", "32": "icons/icon-32.png", "48": "icons/icon-48.png", "128": "icons/icon-128.png" },
  "action": { "default_title": "Open ClipFit" },
  "background": { "service_worker": "background.js" },
  "content_security_policy": { "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" },
  "permissions": []
}
```

- `wasm-unsafe-eval` is required for WebAssembly to instantiate.
- No host permissions, no `tabs`/storage — the app is self-contained (localStorage
  for theme/webhook is page-local, no permission needed).

### Firefox variant

`extension/manifest.firefox.json` — same, with:
- `"background": { "scripts": ["background.js"] }` (Firefox event-page form; the
  same `chrome.*` calls work in Firefox).
- `"browser_specific_settings": { "gecko": { "id": "clipfit@mrrage.dev", "strict_min_version": "121.0" } }`.

`build-ext.mjs` emits a second output (`dist-ext-firefox/`) using this manifest.

### Icon

The chosen **compress-frame** mark (white rounded frame + two inward arrows on the
purple→cyan brand gradient). Source SVG at `extension/icon.svg`; a slightly bolder
16px source (`extension/icon-16.svg`) so the arrows stay crisp small. Rendered to
PNGs (16/32/48/128) with `rsvg-convert` in `build-ext.mjs`. The 128px doubles as
the store-listing icon.

## What's removed/added

- **Add:** `extension/` (manifest×2, background.js, icon SVGs), `scripts/build-ext.mjs`,
  `build:ext` npm script, `VITE_EXT` branch in `vite.config.ts` and `ffmpegEngine.ts`.
- **No changes** to the app's components or the web build.

## Testing

- `npm run build:ext`, then **load unpacked** (`chrome://extensions` → Load
  unpacked → `dist-ext`). Verify: icon appears; clicking it opens ClipFit in a tab;
  a Compress / GIF / Export-audio run completes; **DevTools Network shows the core
  loading from the extension (no jsdelivr request)**.
- Firefox: `about:debugging` → Load Temporary Add-on → `dist-ext-firefox`.
- Unit tests unaffected (no logic changes); existing suite stays green.

## Store submission runbook (your actions — accounts/fees are yours)

| Store | Account | Package | Notes |
|---|---|---|---|
| Chrome Web Store | $5 one-time | `dist-ext` zip | Covers Chrome + Brave/Vivaldi/Arc/Opera-GX (they install Chrome extensions) |
| Edge Add-ons | free | same `dist-ext` zip | Partner Center |
| Opera add-ons | free | same `dist-ext` zip | addons.opera.com |
| Firefox AMO | free | `dist-ext-firefox` zip | May ask for source → point to the public repo |

**Listing assets** (I'll prepare): 128px icon, 3–4 screenshots captured from the
live app (main page, Compress, GIF, Edit), short + long description, category
(Productivity/Tools), and the privacy line: *"ClipFit processes everything locally
in your browser. It collects, transmits, and stores no user data."*

**Safari:** out of scope — requires macOS + Xcode + an Apple Developer account
($99/yr); revisit only with Mac access.

## Out of scope (noted)

- Any extension-specific features (in-page video enhancement, context menus). This
  is purely a wrapper around the existing tool.
- Auto-publishing/CI for store uploads (manual uploads for v1).
