import { useState } from 'react';

export function ConvertPanel({ onRun }: { onRun: (params: { target: 'mp4' | 'webm' }) => void }) {
  const [target, setTarget] = useState<'mp4' | 'webm'>('mp4');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <label>
        Target format
        <select value={target} onChange={(e) => setTarget(e.target.value as 'mp4' | 'webm')}>
          <option value="mp4">MP4</option>
          <option value="webm">WebM</option>
        </select>
      </label>
      <button className="primary" onClick={() => onRun({ target })}>
        Convert
      </button>
    </div>
  );
}
