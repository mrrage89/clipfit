import { useState } from 'react';

export interface GifPanelProps {
  onRun: (params: { fps: number; width: number }) => void;
}

export function GifPanel({ onRun }: GifPanelProps) {
  const [fps, setFps] = useState<number>(12);
  const [width, setWidth] = useState<number>(480);

  const handleRun = () => {
    onRun({ fps, width });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '200px' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        FPS
        <input
          type="number"
          value={fps}
          onChange={(e) => setFps(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        Width (px)
        <input
          type="number"
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </label>
      <button onClick={handleRun} style={{ marginTop: '8px', padding: '6px 12px' }}>
        Make GIF
      </button>
    </div>
  );
}
