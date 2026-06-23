import { useState } from 'react';
import type { SizeTarget } from '../types';
import { Toggle } from './Toggle';
import { Select } from './Select';
import { Segmented } from './Segmented';

const MB = 1024 * 1024;
export const PRESETS: SizeTarget[] = [
  { label: 'Discord (10 MB)', bytes: 10 * MB },
  { label: 'Discord (25 MB)', bytes: 25 * MB },
  { label: 'Discord (50 MB)', bytes: 50 * MB },
  { label: 'Email (25 MB)', bytes: 25 * MB },
  { label: 'WhatsApp (16 MB)', bytes: 16 * MB },
];

export function CompressPanel({
  onStart,
  onExportAudio,
}: {
  onStart: (
    target: SizeTarget,
    mute: boolean,
    quality: 'balanced' | 'best',
    format: 'mp4' | 'webm',
  ) => void;
  onExportAudio: () => void;
}) {
  const [mute, setMute] = useState(false);
  const [idx, setIdx] = useState(1); // Discord (25 MB)
  const [customMb, setCustomMb] = useState(25);
  const [quality, setQuality] = useState<'balanced' | 'best'>('balanced');
  const [format, setFormat] = useState<'mp4' | 'webm'>('mp4');
  const isCustom = idx === PRESETS.length;

  function go() {
    const target = isCustom
      ? { label: `Custom (${customMb} MB)`, bytes: customMb * MB }
      : PRESETS[idx];
    onStart(target, mute, quality, format);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div className="field" style={{ width: 'auto' }}>
          <span className="field-label">Quality</span>
          <Segmented
            value={quality}
            onChange={setQuality}
            options={[
              { value: 'balanced', label: 'Balanced' },
              { value: 'best', label: 'Best' },
            ]}
          />
        </div>
        <div className="field" style={{ width: 'auto' }}>
          <span className="field-label">Format</span>
          <Segmented
            value={format}
            onChange={setFormat}
            options={[
              { value: 'mp4', label: 'MP4' },
              { value: 'webm', label: 'WebM' },
            ]}
          />
        </div>
      </div>
      <span className="muted" style={{ fontSize: 12 }}>
        Best is two-pass — sharper at the same size, but slower.
      </span>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Toggle on={mute} onChange={setMute}>
          Mute (remove audio)
        </Toggle>
        <div className="field" style={{ width: 'auto' }}>
          <span className="field-label">Fit to</span>
          <Select style={{ width: 190 }} value={idx} onChange={(v) => setIdx(Number(v))}>
            {PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
            <option value={PRESETS.length}>Custom size…</option>
          </Select>
        </div>
      </div>
      {isCustom && (
        <div className="field">
          <span className="field-label">Size (MB)</span>
          <input type="number" min={1} value={customMb} onChange={(e) => setCustomMb(Number(e.target.value))} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="primary" style={{ flex: 1 }} onClick={go}>
          Compress
        </button>
        <button className="primary" style={{ flex: 1 }} onClick={onExportAudio}>
          Export audio (MP3)
        </button>
      </div>
    </div>
  );
}
