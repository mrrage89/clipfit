// Drive the WebCodecs spike headlessly and report timing.
// Usage: node scripts/webcodecs-spike.mjs [path-to-mp4]  (vite dev must be on :5173)
import puppeteer from 'puppeteer-core';

const URL = 'http://localhost:5173/spike.html';
const VID = process.argv[2] || '/tmp/spike-src.mp4';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.on('console', (m) => console.log(`[page:${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => console.log(`[page:error] ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle2' });
const input = await page.$('#f');
await input.uploadFile(VID);
try {
  await page.waitForFunction(() => window.__spikeResult !== undefined, { timeout: 90000 });
  const result = await page.evaluate(() => window.__spikeResult);
  console.log('RESULT', JSON.stringify(result, null, 2));
} catch (e) {
  console.log('TIMEOUT/ERROR', e.message);
}
await browser.close();
