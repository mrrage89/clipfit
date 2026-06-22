import { useState } from 'react';
import type { SizeTarget } from '../types';
import { Toggle } from './Toggle';
import { Select } from './Select';

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
  onStart: (target: SizeTarget, mute: boolean, quality: 'balanced' | 'best') => void;
}) {
  const [mute, setMute] = useState(false);
  const [idx, setIdx] = useState(1);
  const [customMb, setCustomMb] = useState(25);
  const [quality, setQuality] = useState<'balanced' | 'best'>('balanced');
  const isCustom = idx === PRESETS.length;

  function go() {
    const target = isCustom
      ? { label: `Custom (${customMb} MB)`, bytes: customMb * MB }
      : PRESETS[idx];
    onStart(target, mute, quality);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      <Toggle on={mute} onChange={setMute}>
        Mute (remove audio)
      </Toggle>
      <div className="field">
        <span className="field-label">Fit to</span>
        <Select value={idx} onChange={(v) => setIdx(Number(v))}>
          {PRESETS.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
          <option value={PRESETS.length}>Custom size…</option>
        </Select>
      </div>
      {isCustom && (
        <div className="field">
          <span className="field-label">Size (MB)</span>
          <input
            type="number"
            min={1}
            value={customMb}
            onChange={(e) => setCustomMb(Number(e.target.value))}
          />
        </div>
      )}
      <div className="field">
        <span className="field-label">Quality</span>
        <Select value={quality} onChange={(v) => setQuality(v as 'balanced' | 'best')}>
          <option value="balanced">Balanced (faster)</option>
          <option value="best">Best (slower, 2-pass)</option>
        </Select>
      </div>
      <button className="primary" style={{ width: '100%' }} onClick={go}>
        Compress
      </button>
    </div>
  );
}
