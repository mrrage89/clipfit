export function Progress({ phase, ratio }: { phase: string; ratio: number }) {
  const pct = Math.round(ratio * 100);
  return (
    <div>
      <p className="muted">
        {phase === 'loading-engine' ? 'Loading engine…' : `Processing… ${pct}%`}
      </p>
      <div style={{ background: 'var(--surface-2)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: 10,
            background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
            boxShadow: '0 0 12px var(--glow)',
            transition: 'width 0.2s',
          }}
        />
      </div>
    </div>
  );
}
