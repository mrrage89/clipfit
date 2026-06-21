import { useState } from 'react';

export function AudioPanel({
  onRun,
}: {
  onRun: (params: { format: 'mp3' | 'wav' }) => void;
}) {
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        Format:
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as 'mp3' | 'wav')}
          style={{ padding: '4px' }}
        >
          <option value="mp3">mp3</option>
          <option value="wav">wav</option>
        </select>
      </label>
      <button
        onClick={() => onRun({ format })}
        style={{ padding: '6px 12px', cursor: 'pointer' }}
      >
        Extract audio
      </button>
    </div>
  );
}
