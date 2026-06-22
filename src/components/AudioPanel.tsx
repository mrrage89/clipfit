import { useState } from 'react';
import { Select } from './Select';

export function AudioPanel({ onRun }: { onRun: (params: { format: 'mp3' | 'wav' }) => void }) {
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <label>
        Format
        <Select value={format} onChange={(v) => setFormat(v as 'mp3' | 'wav')}>
          <option value="mp3">MP3</option>
          <option value="wav">WAV</option>
        </Select>
      </label>
      <button className="primary" onClick={() => onRun({ format })}>
        Extract audio
      </button>
    </div>
  );
}
