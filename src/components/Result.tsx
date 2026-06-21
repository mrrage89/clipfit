import React, { useEffect } from 'react';
import type { JobResult } from '../types';
import { humanizeBytes } from '../lib/format';

export interface ResultProps {
  result: JobResult;
  onReset: () => void;
}

export const Result: React.FC<ResultProps> = ({ result, onReset }) => {
  const url = URL.createObjectURL(result.blob);
  const ok = result.outputBytes <= result.targetBytes;

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [url]);

  return (
    <div style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>
      <video
        src={url}
        controls
        style={{ maxWidth: '100%', borderRadius: '8px' }}
      />
      <p style={{ marginTop: '8px' }}>
        Output: {humanizeBytes(result.outputBytes)} (target{' '}
        {humanizeBytes(result.targetBytes)}){' '}
        {ok ? '✓ fits' : '⚠ over target — try a smaller preset or mute audio'}
      </p>
      <div style={{ marginTop: '8px' }}>
        <a href={url} download="clipfit-output.mp4" style={{ textDecoration: 'none' }}>
          <button style={{ marginRight: '8px' }}>Download</button>
        </a>
        <button onClick={onReset}>Start over</button>
      </div>
    </div>
  );
};
