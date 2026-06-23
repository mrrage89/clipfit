import { useEffect, useState } from 'react';
import { extractFilmstrip, probeFile, loadEngine, runJob } from '../engine/ffmpegEngine';
import { TrimScrubber } from './TrimScrubber';
import { Select } from './Select';
import { gifJob, type GifParams } from '../jobs/gif';
import { humanizeBytes } from '../lib/format';

const STRIP = 10;
const MAX_LEN = 5;

// quality presets — fewer colors roughly halves the file at modest quality cost
const QUALITY = {
  small: { maxColors: 64, dither: 'bayer' as const },
  sharp: { maxColors: 256, dither: 'sierra' as const },
};

export function GifPanel({
  file,
  onRun,
  onExportAudio,
}: {
  file: File;
  onRun: (params: GifParams) => void;
  onExportAudio: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [strip, setStrip] = useState<string[]>([]);
  const [trimIn, setTrimIn] = useState(0);
  const [trimOut, setTrimOut] = useState(MAX_LEN);
  const [fps, setFps] = useState(10);
  const [width, setWidth] = useState(480);
  const [quality, setQuality] = useState<'small' | 'sharp'>('small');
  const [estimate, setEstimate] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);

  const tune = QUALITY[quality];

  useEffect(() => {
    let alive = true;
    setErr(null);
    setStrip([]);
    (async () => {
      try {
        const ctx = await probeFile(file);
        if (!alive) return;
        setDuration(ctx.durationSec);
        setTrimIn(0);
        setTrimOut(Math.min(MAX_LEN, ctx.durationSec));
        const s = await extractFilmstrip(file, STRIP);
        if (alive) setStrip(s);
      } catch (e) {
        if (alive) setErr((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [file]);

  const lengthSec = Math.max(0, trimOut - trimIn);
  const frames = Math.round(fps * lengthSec);

  // a stale estimate would mislead — clear it whenever the settings change
  useEffect(() => {
    setEstimate(null);
  }, [trimIn, trimOut, fps, width, quality]);

  async function estimateSize() {
    if (lengthSec <= 0) return;
    setEstimating(true);
    try {
      await loadEngine();
      const sampleLen = Math.min(1, lengthSec);
      const out = await runJob({
        file,
        job: gifJob,
        params: { fps, width, startSec: trimIn, lengthSec: sampleLen, ...tune },
        onProgress: () => {},
      });
      setEstimate(out.blob.size * (lengthSec / sampleLen));
    } catch {
      setEstimate(null);
    } finally {
      setEstimating(false);
    }
  }

  if (err) return <p style={{ color: 'var(--danger)' }}>{err}</p>;
  if (duration === 0) return <p>Preparing… (loading engine on first use)</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>
          GIF slice (max {MAX_LEN}s) — drag to slide{strip.length === 0 ? ' · loading…' : ''}
        </div>
        <TrimScrubber
          duration={duration}
          strip={strip}
          valueIn={trimIn}
          valueOut={trimOut}
          inLabel="Start"
          outLabel="Stop"
          maxLength={MAX_LEN}
          onChange={(i, o) => {
            setTrimIn(i);
            setTrimOut(o);
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div className="field" style={{ width: 'auto' }}>
          <span className="field-label">Quality</span>
          <Select value={quality} onChange={(v) => setQuality(v as 'small' | 'sharp')}>
            <option value="small">Smaller file</option>
            <option value="sharp">Sharper (larger)</option>
          </Select>
        </div>
        <div className="field" style={{ width: 'auto' }}>
          <span className="field-label">FPS</span>
          <input type="number" min={1} value={fps} style={{ width: 70 }} onChange={(e) => setFps(Number(e.target.value))} />
        </div>
        <div className="field" style={{ width: 'auto' }}>
          <span className="field-label">Width (px)</span>
          <input type="number" min={1} value={width} style={{ width: 90 }} onChange={(e) => setWidth(Number(e.target.value))} />
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        {lengthSec.toFixed(1)}s slice · ≈ {frames} frames
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={estimateSize} disabled={estimating || lengthSec <= 0}>
          {estimating ? 'Estimating…' : 'Estimate size'}
        </button>
        {estimate != null && !estimating && (
          <span className="muted" style={{ fontSize: 13 }}>
            ≈ {humanizeBytes(estimate)} (estimated)
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          className="primary"
          style={{ flex: 1 }}
          disabled={estimating}
          onClick={() => onRun({ fps, width, startSec: trimIn, lengthSec, ...tune })}
        >
          Make GIF
        </button>
        <button className="primary" style={{ flex: 1 }} onClick={onExportAudio}>
          Export audio (MP3)
        </button>
      </div>
    </div>
  );
}
