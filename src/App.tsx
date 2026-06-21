import { useState } from 'react';
import { Dropzone } from './components/Dropzone';
import { TargetPicker } from './components/TargetPicker';
import { Progress } from './components/Progress';
import { Result } from './components/Result';
import { loadEngine, runMakeItFit } from './engine/ffmpegEngine';
import { humanizeBytes } from './lib/format';
import type { JobPhase, JobResult, SizeTarget } from './types';

const MAX_BYTES = 500 * 1024 * 1024; // guard against the WASM ~2GB memory ceiling

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<JobPhase>('idle');
  const [ratio, setRatio] = useState(0);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setPhase('idle');
    setRatio(0);
    setResult(null);
    setError(null);
  }

  function onFile(f: File) {
    setError(null);
    if (f.size > MAX_BYTES) {
      setError(
        `That file is ${humanizeBytes(f.size)}. In-browser processing is limited to about ` +
          `500 MB — use a desktop tool for larger files.`,
      );
      return;
    }
    setFile(f);
    setPhase('idle');
  }

  async function onStart(target: SizeTarget, mute: boolean) {
    if (!file) return;
    setError(null);
    setRatio(0);
    try {
      setPhase('loading-engine');
      await loadEngine();
      setPhase('processing');
      const { blob, outputBytes } = await runMakeItFit({
        file,
        targetBytes: target.bytes,
        mute,
        onProgress: setRatio,
      });
      setResult({ blob, outputBytes, targetBytes: target.bytes });
      setPhase('done');
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  }

  return (
    <main
      style={{ maxWidth: 640, margin: '2rem auto', fontFamily: 'system-ui', padding: '0 1rem' }}
    >
      <h1>ClipFit — make any video fit</h1>
      <p style={{ color: '#555' }}>
        Shrink a video to fit a size limit. Runs entirely in your browser — your file is never
        uploaded.
      </p>

      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

      {!file && <Dropzone onFile={onFile} />}

      {file && phase === 'idle' && (
        <>
          <p style={{ fontSize: 14, color: '#555' }}>
            Selected: {file.name} — {humanizeBytes(file.size)}
          </p>
          <TargetPicker onStart={onStart} />
          <button onClick={reset}>Choose a different file</button>
        </>
      )}

      {(phase === 'loading-engine' || phase === 'processing') && (
        <Progress phase={phase} ratio={ratio} />
      )}

      {phase === 'done' && result && <Result result={result} onReset={reset} />}

      {phase === 'error' && <button onClick={reset}>Try again</button>}
    </main>
  );
}
