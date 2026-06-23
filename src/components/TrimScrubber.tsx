import { useRef } from 'react';
import { nearestThumb } from '../lib/filmstrip';

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

type Drag = { mode: 'in' | 'out' | 'move'; startX: number; startIn: number; startOut: number };

export function TrimScrubber({
  duration,
  strip,
  valueIn,
  valueOut,
  onChange,
  inLabel = 'In',
  outLabel = 'Out',
  maxLength,
}: {
  duration: number;
  strip: string[];
  valueIn: number;
  valueOut: number;
  onChange: (inSec: number, outSec: number) => void;
  inLabel?: string;
  outLabel?: string;
  maxLength?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  function timeAt(clientX: number): number {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return pct * duration;
  }
  function spanFor(dxPx: number): number {
    const el = trackRef.current;
    if (!el) return 0;
    return (dxPx / el.getBoundingClientRect().width) * duration;
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'in') {
      const ni = Math.max(0, Math.min(timeAt(e.clientX), valueOut - 0.1));
      // past the max length? drag the other end along instead of growing
      let no = valueOut;
      if (maxLength && no - ni > maxLength) no = ni + maxLength;
      onChange(ni, Math.min(no, duration));
    } else if (d.mode === 'out') {
      const no = Math.min(duration, Math.max(timeAt(e.clientX), valueIn + 0.1));
      let ni = valueIn;
      if (maxLength && no - ni > maxLength) ni = no - maxLength;
      onChange(Math.max(0, ni), no);
    } else {
      // slide the whole selection, keeping its length
      const len = d.startOut - d.startIn;
      let ni = d.startIn + spanFor(e.clientX - d.startX);
      ni = Math.max(0, Math.min(ni, duration - len));
      onChange(ni, ni + len);
    }
  }
  function end() {
    drag.current = null;
  }

  const pctIn = duration ? (valueIn / duration) * 100 : 0;
  const pctOut = duration ? (valueOut / duration) * 100 : 100;
  const inThumb = strip[nearestThumb(valueIn, duration, strip.length)];
  const outThumb = strip[nearestThumb(valueOut, duration, strip.length)];

  const handle = (left: number, which: 'in' | 'out') => (
    <div
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        drag.current = { mode: which, startX: e.clientX, startIn: valueIn, startOut: valueOut };
      }}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${left}%`,
        width: 14,
        transform: 'translateX(-7px)',
        background: 'var(--accent)',
        cursor: 'ew-resize',
        borderRadius: 4,
        boxShadow: '0 0 8px var(--glow)',
        zIndex: 2,
      }}
    />
  );

  return (
    <div>
      <div
        ref={trackRef}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerLeave={end}
        style={{
          position: 'relative',
          display: 'flex',
          height: 54,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {strip.map((u, i) => (
          <img
            key={i}
            src={u}
            alt=""
            style={{ height: '100%', flex: 1, objectFit: 'cover', pointerEvents: 'none' }}
          />
        ))}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pctIn}%`, background: 'rgba(0,0,0,0.55)' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: `${100 - pctOut}%`, background: 'rgba(0,0,0,0.55)' }} />
        {/* selection body — drag to slide the whole slice */}
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            drag.current = { mode: 'move', startX: e.clientX, startIn: valueIn, startOut: valueOut };
          }}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${pctIn}%`,
            width: `${pctOut - pctIn}%`,
            border: '2px solid var(--accent)',
            boxSizing: 'border-box',
            cursor: 'grab',
            zIndex: 1,
          }}
        />
        {handle(pctIn, 'in')}
        {handle(pctOut, 'out')}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <div style={{ textAlign: 'center' }}>
          {inThumb && <img src={inThumb} alt={`${inLabel} point`} style={{ height: 64, borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />}
          <div className="muted" style={{ fontSize: 12 }}>{inLabel} {fmt(valueIn)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          {outThumb && <img src={outThumb} alt={`${outLabel} point`} style={{ height: 64, borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />}
          <div className="muted" style={{ fontSize: 12 }}>{outLabel} {fmt(valueOut)}</div>
        </div>
      </div>
    </div>
  );
}
