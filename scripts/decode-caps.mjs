import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.goto('http://localhost:5173/spike.html', { waitUntil: 'domcontentloaded' });
const codecs = [
  'hvc1.2.4.L153.B0', // HEVC Main10, 4K  (this file)
  'hev1.2.4.L153.B0',
  'hvc1.1.6.L120.B0', // HEVC Main (8-bit)
  'avc1.640028', // H.264 High
];
const r = await page.evaluate(async (list) => {
  const out = {};
  for (const c of list) {
    try {
      const res = await VideoDecoder.isConfigSupported({ codec: c, codedWidth: 3840, codedHeight: 2160 });
      out[c] = res.supported;
    } catch (e) {
      out[c] = 'err: ' + e.message;
    }
  }
  return out;
}, codecs);
console.log(JSON.stringify(r, null, 2));
await browser.close();
