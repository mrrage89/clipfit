// Capture store screenshots from a running preview (npm run preview on :4173).
// Uses the system Chrome (has H.264) via puppeteer-core.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const URL = 'http://localhost:4173/';
const VID = '/tmp/shot.mp4';
const OUT = process.cwd() + '/screenshots';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle2' });
await sleep(900);
await page.screenshot({ path: `${OUT}/01-landing.png` });
console.log('landing ✓');

const input = await page.$('input[type=file]');
await input.uploadFile(VID);
await page.waitForFunction(
  () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Compress' && b.className.includes('primary')),
  { timeout: 30000 },
);
await page.evaluate(() => { const v = document.querySelector('video'); if (v) v.currentTime = 1.5; });
await sleep(1500);
await page.screenshot({ path: `${OUT}/02-compress.png` });
console.log('compress ✓');

await page.evaluate(() => { const b = [...document.querySelectorAll('button.switch')].find((x) => x.textContent.includes('Edit')); if (b) b.click(); });
try {
  await page.waitForSelector('img[alt="preview"]', { timeout: 90000 });
  await sleep(3000);
  await page.screenshot({ path: `${OUT}/03-edit.png` });
  console.log('edit ✓');
} catch (e) { console.log('edit skipped:', e.message); }

await page.evaluate(() => { const b = [...document.querySelectorAll('button.switch')].find((x) => x.textContent.includes('Edit')); if (b) b.click(); });
await page.evaluate(() => { const b = [...document.querySelectorAll('.segmented button')].find((x) => x.textContent.trim() === 'GIF'); if (b) b.click(); });
try {
  await page.waitForFunction(() => document.body.textContent.includes('GIF slice'), { timeout: 90000 });
  await sleep(3000);
  await page.screenshot({ path: `${OUT}/04-gif.png` });
  console.log('gif ✓');
} catch (e) { console.log('gif skipped:', e.message); }

await browser.close();
console.log('done');
