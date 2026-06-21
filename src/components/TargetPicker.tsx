import React, { useRef } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = Number(inputRef.current?.value);
      if (value > 0) {
        onStart(
          { label: `Custom (${value} MB)`, bytes: value * MB },
          false
        );
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          onClick={() => onStart(preset, false)}
          style={{
            padding: '6px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: '#f5f5f5',
            cursor: 'pointer',
          }}
        >
          {preset.label}
        </button>
      ))}
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        Custom MB:
        <input
          type="number"
          min={1}
          ref={inputRef}
          onKeyDown={handleKeyDown}
          style={{ width: '80px', padding: '4px' }}
        />
      </label>
    </div>
  );
}
