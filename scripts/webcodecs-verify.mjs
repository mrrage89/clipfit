// Verify the compressFast pipeline headlessly across a scenario matrix.
// vite dev must be on :5173. Each output is validated by loading into a <video>.
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[page:error]', e.message));
await page.goto('http://localhost:5173/spike.html', { waitUntil: 'networkidle2' });
const input = await page.$('#f');

async function runMatrix(file, scenarios) {
  await page.evaluate(() => { window.__file = null; });
  await input.uploadFile(file);
  await page.waitForFunction(() => !!window.__file, { timeout: 10000 });
  for (const s of scenarios) {
    try {
      const r = await page.evaluate(async (p, probe) => {
        const t = performance.now();
        const blob = await window.__compress({ file: window.__file, ...p });
        const meta = await window.__validate(blob);
        const extra = probe ? await window.__probe(blob) : {};
        return { ok: true, ms: Math.round(performance.now() - t), kb: Math.round(blob.size / 1024), ...meta, ...extra };
      }, s.p, !!s.probe);
      console.log('  ', s.name, JSON.stringify(r));
    } catch (e) {
      console.log('  ', s.name, 'ERROR', e.message);
    }
  }
}

console.log('=== no-audio clip (1280x720, 30s) ===');
await runMatrix('/tmp/spike-src.mp4', [
  { name: 'full-mp4-mute ', p: { format: 'mp4', videoCodec: 'avc1.640028', targetBytes: 5e6, mute: true } },
  { name: 'trim-2to6-mp4 ', p: { format: 'mp4', videoCodec: 'avc1.640028', targetBytes: 5e6, mute: true, trim: { startSec: 2, endSec: 6 } } },
  { name: 'downscale-mp4 ', p: { format: 'mp4', videoCodec: 'avc1.640028', targetBytes: 300000, mute: true } },
  { name: 'webm-vp9-mute ', p: { format: 'webm', videoCodec: 'vp09.00.10.08', targetBytes: 5e6, mute: true } },
]);
console.log('=== audio clip (854x480, 10s, AAC) ===');
await runMatrix('/tmp/spike-av.mp4', [
  { name: 'full-mp4-audio', probe: true, p: { format: 'mp4', videoCodec: 'avc1.640028', targetBytes: 5e6, mute: false } },
]);

await browser.close();
