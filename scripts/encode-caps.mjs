import puppeteer from 'puppeteer-core';
const exe = process.argv[2] || '/usr/bin/google-chrome-stable';
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('http://localhost:5173/spike.html', { waitUntil: 'domcontentloaded' });
const r = await page.evaluate(async () => {
  const codecs = ['avc1.640028', 'vp09.00.10.08', 'av01.0.04M.08'];
  const out = {};
  for (const c of codecs) {
    try {
      out[c] = (await VideoEncoder.isConfigSupported({ codec: c, width: 1920, height: 1080, bitrate: 5e6 })).supported;
    } catch (e) {
      out[c] = 'err:' + e.message;
    }
  }
  return out;
});
console.log(exe.split('/').pop(), JSON.stringify(r));
await browser.close();
