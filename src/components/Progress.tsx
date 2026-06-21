import React from 'react';

export interface ProgressProps {
  phase: string;
  ratio: number;
}

export const Progress: React.FC<ProgressProps> = ({ phase, ratio }) => {
  const pct = Math.round(ratio * 100);

  const outerStyle: React.CSSProperties = {
    backgroundColor: '#e0e0e0',
    borderRadius: '6px',
    height: '12px',
    width: '100%',
    overflow: 'hidden',
  };

  const innerStyle: React.CSSProperties = {
    backgroundColor: '#4f46e5',
    height: '12px',
    width: `${pct}%`,
    borderRadius: '6px',
  };

  return (
    <div>
      <div style={{ marginBottom: '8px' }}>
        {phase === 'loading-engine' ? 'Loading engine…' : `Processing… ${pct}%`}
      </div>
      <div style={outerStyle}>
        <div style={innerStyle} />
      </div>
    </div>
  );
};
