import { useState } from 'react';
import type { GifParams } from '../jobs/gif';

export function GifPanel({ onRun }: { onRun: (params: GifParams) => void }) {
  const [startSec, setStartSec] = useState(0);
  const [lengthSec, setLengthSec] = useState(5);
  const [fps, setFps] = useState(12);
  const [width, setWidth] = useState(480);

  const frames = Math.max(0, Math.round(fps * lengthSec));
  const long = lengthSec > 15;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      <div className="field">
        <span className="field-label">Start (seconds)</span>
        <input type="number" min={0} value={startSec} onChange={(e) => setStartSec(Number(e.target.value))} />
      </div>
      <div className="field">
        <span className="field-label">Length (seconds)</span>
        <input type="number" min={0.5} value={lengthSec} onChange={(e) => setLengthSec(Number(e.target.value))} />
      </div>
      <div className="field">
        <span className="field-label">FPS</span>
        <input type="number" min={1} value={fps} onChange={(e) => setFps(Number(e.target.value))} />
      </div>
      <div className="field">
        <span className="field-label">Width (px)</span>
        <input type="number" min={1} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
      </div>
      <p
        className="muted"
        style={{ fontSize: 12, margin: 0, ...(long ? { color: 'var(--danger)' } : {}) }}
      >
        ≈ {frames} frames. GIFs aren't video-compressed — keep them short (a few seconds) or the
        file gets very large.
      </p>
      <button
        className="primary"
        style={{ width: '100%' }}
        onClick={() => onRun({ fps, width, startSec, lengthSec })}
      >
        Make GIF
      </button>
    </div>
  );
}
