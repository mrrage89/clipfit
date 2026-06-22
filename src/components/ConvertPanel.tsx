import { useState } from 'react';
import { Select } from './Select';

export function ConvertPanel({ onRun }: { onRun: (params: { target: 'mp4' | 'webm' }) => void }) {
  const [target, setTarget] = useState<'mp4' | 'webm'>('mp4');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      <div className="field">
        <span className="field-label">Target format</span>
        <Select value={target} onChange={(v) => setTarget(v as 'mp4' | 'webm')}>
          <option value="mp4">MP4</option>
          <option value="webm">WebM</option>
        </Select>
      </div>
      <button className="primary" style={{ width: '100%' }} onClick={() => onRun({ target })}>
        Convert
      </button>
    </div>
  );
}
