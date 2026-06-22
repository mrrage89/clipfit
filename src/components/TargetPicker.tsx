import { useState } from 'react';
import type { SizeTarget } from '../types';
import { Toggle } from './Toggle';

const MB = 1024 * 1024;
export const PRESETS: SizeTarget[] = [
  { label: 'Discord (10 MB)', bytes: 10 * MB },
  { label: 'Discord (25 MB)', bytes: 25 * MB },
  { label: 'Discord (50 MB)', bytes: 50 * MB },
  { label: 'Email (25 MB)', bytes: 25 * MB },
  { label: 'WhatsApp (16 MB)', bytes: 16 * MB },
];

export function TargetPicker({
  onStart,
}: {
  onStart: (target: SizeTarget, mute: boolean) => void;
}) {
  const [mute, setMute] = useState(false);
  const [idx, setIdx] = useState(1); // Discord (25 MB)
  const [customMb, setCustomMb] = useState(25);
  const isCustom = idx === PRESETS.length;

  function go() {
    const target = isCustom
      ? { label: `Custom (${customMb} MB)`, bytes: customMb * MB }
      : PRESETS[idx];
    onStart(target, mute);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <Toggle on={mute} onChange={setMute}>
        Mute (remove audio)
      </Toggle>
      <label>
        Fit to
        <select value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
          {PRESETS.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
          <option value={PRESETS.length}>Custom size…</option>
        </select>
      </label>
      {isCustom && (
        <label>
          Size (MB)
          <input
            type="number"
            min={1}
            value={customMb}
            style={{ width: 80 }}
            onChange={(e) => setCustomMb(Number(e.target.value))}
          />
        </label>
      )}
      <button className="primary" onClick={go}>
        Compress
      </button>
    </div>
  );
}
