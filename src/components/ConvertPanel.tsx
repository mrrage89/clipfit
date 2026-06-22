import { useState } from 'react';
import { Select } from './Select';

export function ConvertPanel({ onRun }: { onRun: (params: { target: 'mp4' | 'webm' }) => void }) {
  const [target, setTarget] = useState<'mp4' | 'webm'>('mp4');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <label>
        Target format
        <Select value={target} onChange={(v) => setTarget(v as 'mp4' | 'webm')}>
          <option value="mp4">MP4</option>
          <option value="webm">WebM</option>
        </Select>
      </label>
      <button className="primary" onClick={() => onRun({ target })}>
        Convert
      </button>
    </div>
  );
}
