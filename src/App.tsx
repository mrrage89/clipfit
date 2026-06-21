import { useState } from 'react';
import { Dropzone } from './components/Dropzone';
import { TargetPicker } from './components/TargetPicker';
import { Progress } from './components/Progress';
import { Result } from './components/Result';
import { probeVideo } from './lib/videoMeta';
import { computeVideoKbps } from './jobs/bitrate';
import { buildMakeItFitArgs } from './jobs/makeItFit';
import { loadEngine, runJob } from './engine/ffmpegEngine';
import { humanizeBytes } from './lib/format';
import type { JobPhase, JobResult, SizeTarget, VideoMeta } from './types';

const MAX_BYTES = 500 * 1024 * 1024; // guard against the WASM ~2GB memory ceiling
const INPUT_NAME = 'input.mp4';
const OUTPUT_NAME = 'output.mp4';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [phase, setPhase] = useState<JobPhase>('idle');
  const [ratio, setRatio] = useState(0);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setMeta(null);
    setPhase('idle');
    setRatio(0);
    setResult(null);
    setError(null);
  }

  async function onFile(f: File) {
    setError(null);
    if (f.size > MAX_BYTES) {
      setError(
        `That file is ${humanizeBytes(f.size)}. In-browser processing is limited to about ` +
          `500 MB — use a desktop tool for larger files.`,
      );
      return;
    }
    try {
      const m = await probeVideo(f);
      setFile(f);
      setMeta(m);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onStart(target: SizeTarget, mute: boolean) {
    if (!file || !meta) return;
    setError(null);
    setRatio(0);
    try {
      const audioKbps = mute ? 0 : 128;
      const videoKbps = computeVideoKbps({
        targetBytes: target.bytes,
        durationSec: meta.durationSec,
        audioKbps,
      });
      const passes = buildMakeItFitArgs({
        inputName: INPUT_NAME,
        outputName: OUTPUT_NAME,
        videoKbps,
        audioKbps,
      });

      setPhase('loading-engine');
      await loadEngine();
      setPhase('processing');

      const blob = await runJob({
        file,
        passes,
        inputName: INPUT_NAME,
        outputName: OUTPUT_NAME,
        onProgress: setRatio,
      });

      setResult({ blob, outputBytes: blob.size, targetBytes: target.bytes });
      setPhase('done');
    } catch (e) {
      setError(`Processing failed: ${(e as Error).message}`);
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

      {file && meta && phase === 'idle' && (
        <>
          <p style={{ fontSize: 14, color: '#555' }}>
            Selected: {file.name} — {humanizeBytes(meta.sizeBytes)}, {Math.round(meta.durationSec)}s
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
