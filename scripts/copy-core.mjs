// Self-host the ffmpeg-core wasm so the app doesn't depend on a third-party CDN
// (unpkg) at runtime — more reliable, works on restrictive networks, and faster.
// Copies into a version-stamped folder so it can be cached immutably.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreDir = join(root, 'node_modules', '@ffmpeg', 'core');
const version = JSON.parse(readFileSync(join(coreDir, 'package.json'), 'utf8')).version;
const src = join(coreDir, 'dist', 'esm');
const dest = join(root, 'public', 'ffmpeg', version);

mkdirSync(dest, { recursive: true });
for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  copyFileSync(join(src, f), join(dest, f));
}
console.log(`copied @ffmpeg/core@${version} -> public/ffmpeg/${version}/`);
