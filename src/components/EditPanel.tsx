import { useState } from 'react';
import type { EditParams } from '../jobs/edit';

export function EditPanel({ onRun }: { onRun: (params: EditParams) => void }) {
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fps, setFps] = useState(0);
  const [volumeDb, setVolumeDb] = useState(0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 280 }}>
      <label>
        Rotate{' '}
        <select
          value={rotate}
          onChange={(e) => setRotate(Number(e.target.value) as 0 | 90 | 180 | 270)}
        >
          <option value={0}>0°</option>
          <option value={90}>90°</option>
          <option value={180}>180°</option>
          <option value={270}>270°</option>
        </select>
      </label>
      <label>
        <input type="checkbox" checked={flipH} onChange={(e) => setFlipH(e.target.checked)} /> Flip
        horizontal
      </label>
      <label>
        <input type="checkbox" checked={flipV} onChange={(e) => setFlipV(e.target.checked)} /> Flip
        vertical
      </label>
      <label>
        Speed{' '}
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={1.5}>1.5×</option>
          <option value={2}>2×</option>
        </select>
      </label>
      <label>
        Frame rate (0 = keep){' '}
        <input
          type="number"
          value={fps}
          min={0}
          style={{ width: 70 }}
          onChange={(e) => setFps(Number(e.target.value))}
        />
      </label>
      <label>
        Volume dB (0 = none){' '}
        <input
          type="number"
          value={volumeDb}
          style={{ width: 70 }}
          onChange={(e) => setVolumeDb(Number(e.target.value))}
        />
      </label>
      <button onClick={() => onRun({ rotate, flipH, flipV, speed, fps, volumeDb })}>
        Apply edits
      </button>
    </div>
  );
}
