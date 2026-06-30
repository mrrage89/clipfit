// Smoke-test the real app's Compress path end-to-end (dev on :5173).
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox'],
});
const VID = process.argv[2] || '/tmp/spike-src.mp4';
const page = await browser.newPage();
const engineLogs = [];
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('compress engine')) engineLogs.push(t);
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
const input = await page.$('input[type=file]');
await input.uploadFile(VID);

// Over the soft cap → the app shows a "Try anyway" gate first; click through it.
await page.waitForFunction(
  () => {
    const btns = [...document.querySelectorAll('button')];
    return (
      btns.some((b) => b.textContent.trim() === 'Try anyway') ||
      btns.some((b) => b.textContent.trim() === 'Compress' && b.className.includes('primary') && !b.closest('.segmented'))
    );
  },
  { timeout: 60000 },
);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Try anyway');
  if (b) b.click();
});
await page.waitForFunction(
  () => [...document.querySelectorAll('button.primary')].some((b) => b.textContent.trim() === 'Compress' && !b.closest('.segmented')),
  { timeout: 30000 },
);
const t0 = Date.now();
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button.primary')].find(
    (x) => x.textContent.trim() === 'Compress' && !x.closest('.segmented'),
  );
  b.click();
});

await page.waitForFunction(
  () => /Output:/.test(document.body.textContent || ''),
  { timeout: 120000 },
);
const resultText = await page.evaluate(() => {
  const m = (document.body.textContent || '').match(/Output:[^✓]*(✓ fits|over target)?/);
  return m ? m[0].trim() : '(not found)';
});

console.log('engine:', engineLogs.join(' | ') || '(none logged)');
console.log('result:', resultText);
console.log('elapsed ms:', Date.now() - t0);
await browser.close();
