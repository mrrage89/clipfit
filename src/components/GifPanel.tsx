import { useState } from 'react';

export function GifPanel({ onRun }: { onRun: (params: { fps: number; width: number }) => void }) {
  const [fps, setFps] = useState(12);
  const [width, setWidth] = useState(480);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <label>
        FPS
        <input type="number" value={fps} style={{ width: 80 }} onChange={(e) => setFps(Number(e.target.value))} />
      </label>
      <label>
        Width (px)
        <input type="number" value={width} style={{ width: 80 }} onChange={(e) => setWidth(Number(e.target.value))} />
      </label>
      <button className="primary" onClick={() => onRun({ fps, width })}>
        Make GIF
      </button>
    </div>
  );
}
