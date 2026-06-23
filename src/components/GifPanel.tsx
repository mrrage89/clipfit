import { useEffect, useState } from 'react';
import { extractFilmstrip, probeFile } from '../engine/ffmpegEngine';
import { TrimScrubber } from './TrimScrubber';
import type { GifParams } from '../jobs/gif';

const STRIP = 10;
const DEFAULT_LEN = 5;

export function GifPanel({ file, onRun }: { file: File; onRun: (params: GifParams) => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [strip, setStrip] = useState<string[]>([]);
  const [trimIn, setTrimIn] = useState(0);
  const [trimOut, setTrimOut] = useState(DEFAULT_LEN);
  const [fps, setFps] = useState(12);
  const [width, setWidth] = useState(480);

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
        setTrimOut(Math.min(DEFAULT_LEN, ctx.durationSec));
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
  const long = lengthSec > 15;

  if (err) return <p style={{ color: 'var(--danger)' }}>{err}</p>;
  if (duration === 0) return <p>Preparing… (loading engine on first use)</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>
          GIF slice — drag to slide, drag the ends to resize{strip.length === 0 ? ' · loading…' : ''}
        </div>
        <TrimScrubber
          duration={duration}
          strip={strip}
          valueIn={trimIn}
          valueOut={trimOut}
          inLabel="Start"
          outLabel="Stop"
          onChange={(i, o) => {
            setTrimIn(i);
            setTrimOut(o);
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div className="field" style={{ width: 'auto' }}>
          <span className="field-label">FPS</span>
          <input type="number" min={1} value={fps} style={{ width: 80 }} onChange={(e) => setFps(Number(e.target.value))} />
        </div>
        <div className="field" style={{ width: 'auto' }}>
          <span className="field-label">Width (px)</span>
          <input type="number" min={1} value={width} style={{ width: 100 }} onChange={(e) => setWidth(Number(e.target.value))} />
        </div>
      </div>

      <p
        className="muted"
        style={{ fontSize: 12, margin: 0, ...(long ? { color: 'var(--danger)' } : {}) }}
      >
        {lengthSec.toFixed(1)}s slice · ≈ {frames} frames. GIFs aren't video-compressed — keep the
        slice short or the file gets very large.
      </p>

      <button
        className="primary"
        style={{ width: '100%' }}
        onClick={() => onRun({ fps, width, startSec: trimIn, lengthSec })}
      >
        Make GIF
      </button>
    </div>
  );
}
