import { spike } from './engine/webcodecs/spike';

const f = document.getElementById('f') as HTMLInputElement;
const out = document.getElementById('out')!;

f.addEventListener('change', async () => {
  const file = f.files?.[0];
  if (!file) return;
  out.textContent = `running on ${file.name} (${(file.size / 1048576).toFixed(1)} MB)...`;
  try {
    const r = await spike(file);
    out.textContent = JSON.stringify(r, null, 2);
    (window as any).__spikeResult = { ok: true, ...r };
  } catch (e) {
    const err = e as Error;
    out.textContent = `ERROR: ${err.message}\n${err.stack ?? ''}`;
    (window as any).__spikeResult = { ok: false, error: err.message };
  }
});
