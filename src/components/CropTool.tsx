import { useEffect, useRef, useState } from 'react';
import { extractFrame } from '../engine/ffmpegEngine';
import { mapCropToSource } from '../lib/cropMath';
import type { CropParams } from '../jobs/crop';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DISPLAY_MAX = 480;
const MIN = 20;

export function CropTool({
  file,
  onRun,
}: {
  file: File;
  onRun: (rect: CropParams) => void;
}) {
  const [frame, setFrame] = useState<{ url: string; srcW: number; srcH: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const drag = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; start: Box } | null>(null);

  const dispW = frame ? Math.min(DISPLAY_MAX, frame.srcW) : DISPLAY_MAX;
  const dispH = frame ? Math.round((dispW * frame.srcH) / frame.srcW) : 0;

  useEffect(() => {
    let alive = true;
    setFrame(null);
    setErr(null);
    extractFrame(file, 1)
      .then(({ url, width, height }) => {
        if (!alive) return;
        const w = Math.min(DISPLAY_MAX, width);
        const h = Math.round((w * height) / width);
        setFrame({ url, srcW: width, srcH: height });
        setBox({ x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.8 });
      })
      .catch((e) => alive && setErr((e as Error).message));
    return () => {
      alive = false;
    };
  }, [file]);

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
  function endDrag() {
    drag.current = null;
  }

  function preset(ratio: number | null) {
    if (ratio === null) {
      setBox(clamp({ x: dispW * 0.1, y: dispH * 0.1, w: dispW * 0.8, h: dispH * 0.8 }));
      return;
    }
    let w = dispW;
    let h = w / ratio;
    if (h > dispH) {
      h = dispH;
      w = h * ratio;
    }
    setBox(clamp({ x: (dispW - w) / 2, y: (dispH - h) / 2, w, h }));
  }

  if (err) return <p style={{ color: '#b91c1c' }}>{err}</p>;
  if (!frame) return <p>Preparing preview… (loading engine on first use)</p>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 14 }}>Aspect:</span>
        <button onClick={() => preset(null)}>Free</button>
        <button onClick={() => preset(1)}>1:1</button>
        <button onClick={() => preset(9 / 16)}>9:16</button>
        <button onClick={() => preset(16 / 9)}>16:9</button>
      </div>
      <div
        style={{
          position: 'relative',
          width: dispW,
          height: dispH,
          touchAction: 'none',
          userSelect: 'none',
        }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <img
          src={frame.url}
          width={dispW}
          height={dispH}
          draggable={false}
          alt="crop preview"
          style={{ display: 'block', borderRadius: 4 }}
        />
        <div
          onPointerDown={(e) => startDrag('move', e)}
          style={{
            position: 'absolute',
            left: box.x,
            top: box.y,
            width: box.w,
            height: box.h,
            border: '2px solid #4f46e5',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
            cursor: 'move',
            boxSizing: 'border-box',
          }}
        >
          <div
            onPointerDown={(e) => startDrag('resize', e)}
            style={{
              position: 'absolute',
              right: -7,
              bottom: -7,
              width: 14,
              height: 14,
              background: '#4f46e5',
              borderRadius: 3,
              cursor: 'nwse-resize',
            }}
          />
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#555', marginTop: 6 }}>Drag to move, drag the corner to resize.</p>
      <button onClick={() => onRun(mapCropToSource(box, dispW, dispH, frame.srcW, frame.srcH))} style={{ marginTop: 8 }}>
        Crop
      </button>
    </div>
  );
}
