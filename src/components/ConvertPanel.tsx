import { useState } from 'react';
import type { ChangeEvent } from 'react';

export function ConvertPanel({
  onRun,
}: {
  onRun: (params: { target: 'mp4' | 'webm' }) => void;
}) {
  const [target, setTarget] = useState<'mp4' | 'webm'>('mp4');

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setTarget(e.target.value as 'mp4' | 'webm');
  };

  const handleClick = () => {
    onRun({ target });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        Target format:
        <select value={target} onChange={handleChange} style={{ padding: '4px' }}>
          <option value="mp4">mp4</option>
          <option value="webm">webm</option>
        </select>
      </label>
      <button onClick={handleClick} style={{ padding: '6px 12px' }}>
        Convert
      </button>
    </div>
  );
}
