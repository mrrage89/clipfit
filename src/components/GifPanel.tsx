import { useState } from 'react';

export function GifPanel({ onRun }: { onRun: (params: { fps: number; width: number }) => void }) {
  const [fps, setFps] = useState(12);
  const [width, setWidth] = useState(480);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      <div className="field">
        <span className="field-label">FPS</span>
        <input type="number" value={fps} onChange={(e) => setFps(Number(e.target.value))} />
      </div>
      <div className="field">
        <span className="field-label">Width (px)</span>
        <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
      </div>
      <button className="primary" style={{ width: '100%' }} onClick={() => onRun({ fps, width })}>
        Make GIF
      </button>
    </div>
  );
}
