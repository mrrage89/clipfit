import { useState } from 'react';

export interface TrimPanelProps {
  onRun: (params: { startSec: number; endSec: number }) => void;
}

export function TrimPanel({ onRun }: TrimPanelProps) {
  const [startSec, setStartSec] = useState<number>(0);
  const [endSec, setEndSec] = useState<number>(10);

  const handleTrim = () => {
    onRun({ startSec, endSec });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '200px' }}>
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px' }}>
        Start (s)
        <input
          type="number"
          value={startSec}
          onChange={(e) => setStartSec(Number(e.target.value))}
          style={{ marginTop: '4px', padding: '4px' }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px' }}>
        End (s)
        <input
          type="number"
          value={endSec}
          onChange={(e) => setEndSec(Number(e.target.value))}
          style={{ marginTop: '4px', padding: '4px' }}
        />
      </label>
      <button
        onClick={handleTrim}
        style={{ padding: '6px 12px', marginTop: '8px', cursor: 'pointer' }}
      >
        Trim
      </button>
    </div>
  );
}
