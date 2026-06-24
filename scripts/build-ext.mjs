// Runs after `vite build --mode extension`: bundles the ffmpeg core into the
// output, copies the extension static files (manifest, background, icons), and
// emits the Firefox variant (same app, different manifest).
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

const ff = join(root, 'dist-ext-firefox');
rmSync(ff, { recursive: true, force: true });
cpSync(join(root, 'dist-ext'), ff, { recursive: true });
copyFileSync(join(root, 'extension', 'manifest.firefox.json'), join(ff, 'manifest.json'));
console.log('packed dist-ext-firefox (manifest.firefox.json)');
