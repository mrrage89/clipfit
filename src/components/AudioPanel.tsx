import { useState } from 'react';
import { Select } from './Select';

export function AudioPanel({ onRun }: { onRun: (params: { format: 'mp3' | 'wav' }) => void }) {
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      <div className="field">
        <span className="field-label">Format</span>
        <Select value={format} onChange={(v) => setFormat(v as 'mp3' | 'wav')}>
          <option value="mp3">MP3</option>
          <option value="wav">WAV</option>
        </Select>
      </div>
      <button className="primary" style={{ width: '100%' }} onClick={() => onRun({ format })}>
        Extract audio
      </button>
    </div>
  );
}
