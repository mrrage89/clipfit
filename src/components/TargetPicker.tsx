import { useState } from 'react';
import type { SizeTarget } from '../types';

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
  return (
    <div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '8px 0' }}>
        <input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} />
        Mute (remove audio)
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => onStart(p, mute)}>
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <label>
          Custom MB:{' '}
          <input
            type="number"
            min={1}
            style={{ width: 80 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const mb = Number((e.target as HTMLInputElement).value);
                if (mb > 0) onStart({ label: `Custom (${mb} MB)`, bytes: mb * MB }, mute);
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}
