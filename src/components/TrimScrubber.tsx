import { useRef } from 'react';
import { nearestThumb } from '../lib/filmstrip';

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TrimScrubber({
  duration,
  strip,
  valueIn,
  valueOut,
  onChange,
}: {
  duration: number;
  strip: string[];
  valueIn: number;
  valueOut: number;
  onChange: (inSec: number, outSec: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<'in' | 'out' | null>(null);

  function timeAt(clientX: number): number {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return pct * duration;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const t = timeAt(e.clientX);
    if (drag.current === 'in') onChange(Math.min(t, valueOut - 0.1), valueOut);
    else onChange(valueIn, Math.max(t, valueIn + 0.1));
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
        drag.current = which;
      }}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${left}%`,
        width: 12,
        transform: 'translateX(-6px)',
        background: 'var(--accent)',
        cursor: 'ew-resize',
        borderRadius: 4,
        boxShadow: '0 0 8px var(--glow)',
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
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pctIn}%`, width: `${pctOut - pctIn}%`, border: '2px solid var(--accent)', boxSizing: 'border-box' }} />
        {handle(pctIn, 'in')}
        {handle(pctOut, 'out')}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <div style={{ textAlign: 'center' }}>
          {inThumb && <img src={inThumb} alt="in point" style={{ width: 120, borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />}
          <div className="muted" style={{ fontSize: 12 }}>In {fmt(valueIn)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          {outThumb && <img src={outThumb} alt="out point" style={{ width: 120, borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />}
          <div className="muted" style={{ fontSize: 12 }}>Out {fmt(valueOut)}</div>
        </div>
      </div>
    </div>
  );
}
