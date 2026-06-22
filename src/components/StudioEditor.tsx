import { useEffect, useRef, useState } from 'react';
import { extractFrame, extractFilmstrip, probeFile } from '../engine/ffmpegEngine';
import { mapCropToSource } from '../lib/cropMath';
import { TrimScrubber } from './TrimScrubber';
import { Toggle } from './Toggle';
import { Select } from './Select';
import type { StudioParams } from '../jobs/studio';
import type { EditParams } from '../jobs/edit';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Frame {
  url: string;
  srcW: number;
  srcH: number;
}

const DISPLAY_MAX = 460;
const STRIP = 10;
const MIN = 20;

export function StudioEditor({
  file,
  onRun,
}: {
  file: File;
  onRun: (params: StudioParams) => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [strip, setStrip] = useState<string[]>([]);
  const [trimIn, setTrimIn] = useState(0);
  const [trimOut, setTrimOut] = useState(0);
  const [cropOn, setCropOn] = useState(false);
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const drag = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; start: Box } | null>(null);
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fps, setFps] = useState(0);
  const [volumeDb, setVolumeDb] = useState(0);

  useEffect(() => {
    let alive = true;
    setErr(null);
    setFrame(null);
    setStrip([]);
    (async () => {
      try {
        const ctx = await probeFile(file);
        if (!alive) return;
        setDuration(ctx.durationSec);
        setTrimIn(0);
        setTrimOut(ctx.durationSec);
        const { url } = await extractFrame(file, 1);
        const img = new Image();
        img.onload = () => {
          if (!alive) return;
          const sw = img.naturalWidth;
          const sh = img.naturalHeight;
          const w = Math.min(DISPLAY_MAX, sw);
          const h = Math.round((w * sh) / sw);
          setFrame({ url, srcW: sw, srcH: sh });
          setBox({ x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.8 });
        };
        img.src = url;
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

  const dispW = frame ? Math.min(DISPLAY_MAX, frame.srcW) : DISPLAY_MAX;
  const dispH = frame ? Math.round((dispW * frame.srcH) / frame.srcW) : 0;

  function clamp(b: Box): Box {
    let { x, y, w, h } = b;
    w = Math.max(MIN, w);
    h = Math.max(MIN, h);
    x = Math.max(0, Math.min(x, dispW - w));
    y = Math.max(0, Math.min(y, dispH - h));
    w = Math.min(w, dispW - x);
    h = Math.min(h, dispH - y);
    return { x, y, w, h };
  }
  function startDrag(mode: 'move' | 'resize', e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: box };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (d.mode === 'move') setBox(clamp({ ...d.start, x: d.start.x + dx, y: d.start.y + dy }));
    else setBox(clamp({ ...d.start, w: d.start.w + dx, h: d.start.h + dy }));
  }

  function doExport() {
    const params: StudioParams = {};
    if (trimIn > 0.05 || trimOut < duration - 0.05) {
      params.trim = { startSec: trimIn, endSec: trimOut };
    }
    if (cropOn && frame) {
      params.crop = mapCropToSource(box, dispW, dispH, frame.srcW, frame.srcH);
    }
    const edit: EditParams = {};
    if (rotate) edit.rotate = rotate;
    if (flipH) edit.flipH = true;
    if (flipV) edit.flipV = true;
    if (speed !== 1) edit.speed = speed;
    if (fps > 0) edit.fps = fps;
    if (volumeDb !== 0) edit.volumeDb = volumeDb;
    if (Object.keys(edit).length) params.edit = edit;
    onRun(params);
  }

  if (err) return <p style={{ color: 'var(--danger)' }}>{err}</p>;
  if (!frame) return <p>Preparing editor… (loading engine on first use)</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ marginBottom: 8 }}>
          <Toggle on={cropOn} onChange={setCropOn}>Crop</Toggle>
        </div>
        <div
          style={{ position: 'relative', width: dispW, height: dispH, touchAction: 'none', userSelect: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerLeave={() => (drag.current = null)}
        >
          <img src={frame.url} width={dispW} height={dispH} draggable={false} alt="preview" style={{ display: 'block', borderRadius: 8 }} />
          {cropOn && (
            <div
              onPointerDown={(e) => startDrag('move', e)}
              style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, border: '2px solid var(--accent)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)', cursor: 'move', boxSizing: 'border-box' }}
            >
              <div
                onPointerDown={(e) => startDrag('resize', e)}
                style={{ position: 'absolute', right: -7, bottom: -7, width: 14, height: 14, background: 'var(--accent)', borderRadius: 3, cursor: 'nwse-resize' }}
              />
            </div>
          )}
        </div>
      </div>

      {duration > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>
            Trim{strip.length === 0 ? ' · loading…' : ''}
          </div>
          <TrimScrubber
            duration={duration}
            strip={strip}
            valueIn={trimIn}
            valueOut={trimOut}
            onChange={(i, o) => {
              setTrimIn(i);
              setTrimOut(o);
            }}
          />
        </div>
      )}

      <div className="controls" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <label>
            Rotate
            <Select value={rotate} onChange={(v) => setRotate(Number(v) as 0 | 90 | 180 | 270)}>
              <option value={0}>0°</option>
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </Select>
          </label>
          <label>
            Speed
            <Select value={speed} onChange={(v) => setSpeed(Number(v))}>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={1.5}>1.5×</option>
              <option value={2}>2×</option>
            </Select>
          </label>
          <label>
            FPS
            <input type="number" value={fps} min={0} style={{ width: 56 }} onChange={(e) => setFps(Number(e.target.value))} />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className={flipH ? 'toggle-on' : ''}
            onClick={() => setFlipH(!flipH)}
            aria-label="Flip horizontal"
            title="Flip horizontal"
            style={{ padding: '6px 9px', lineHeight: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 2" />
              <path d="M9 7 L9 17 L4.5 12 Z" fill="currentColor" />
              <path d="M15 7 L15 17 L19.5 12 Z" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className={flipV ? 'toggle-on' : ''}
            onClick={() => setFlipV(!flipV)}
            aria-label="Flip vertical"
            title="Flip vertical"
            style={{ padding: '6px 9px', lineHeight: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 2" />
              <path d="M7 9 L17 9 L12 4.5 Z" fill="currentColor" />
              <path d="M7 15 L17 15 L12 19.5 Z" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
          <label>
            Vol
            <input
              type="range"
              min={-20}
              max={20}
              step={1}
              value={volumeDb}
              style={{ width: 140 }}
              onChange={(e) => setVolumeDb(Number(e.target.value))}
            />
            <span className="muted" style={{ minWidth: 44, fontSize: 12 }}>
              {volumeDb > 0 ? '+' : ''}
              {volumeDb} dB
            </span>
          </label>
        </div>
      </div>

      <button className="primary" onClick={doExport} style={{ alignSelf: 'flex-start' }}>
        Export
      </button>
    </div>
  );
}
