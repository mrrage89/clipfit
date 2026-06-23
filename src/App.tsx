import { useState } from 'react';
import { Dropzone } from './components/Dropzone';
import { Editor } from './components/Editor';
import { CompressPanel } from './components/CompressPanel';
import { GifPanel } from './components/GifPanel';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { VideoPreview } from './components/VideoPreview';
import { Toggle } from './components/Toggle';
import { Segmented } from './components/Segmented';
import { Progress } from './components/Progress';
import { Result } from './components/Result';
import { loadEngine, runJob } from './engine/ffmpegEngine';
import { fitJob } from './jobs/fit';
import { gifJob } from './jobs/gif';
import { audioJob } from './jobs/audio';
import { humanizeBytes } from './lib/format';
import type { Edits } from './jobs/editChain';
import type { Job } from './jobs/types';
import type { JobPhase, JobResult } from './types';

// Phones have hard per-tab memory limits, so cap smaller there to avoid OOM crashes.
const isMobile =
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const MAX_BYTES = (isMobile ? 100 : 500) * 1024 * 1024;
const WASM_OK = typeof WebAssembly === 'object';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [editOn, setEditOn] = useState(false);
  const [edits, setEdits] = useState<Edits>({});
  const [output, setOutput] = useState<'compress' | 'gif'>('compress');
  const [phase, setPhase] = useState<JobPhase>('idle');
  const [ratio, setRatio] = useState(0);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeEdits = editOn ? edits : undefined;

  function resetRun() {
    setPhase('idle');
    setRatio(0);
    setResult(null);
    setError(null);
  }

  function onFile(f: File) {
    setError(null);
    if (f.size > MAX_BYTES) {
      setError(
        `That file is ${humanizeBytes(f.size)}. In-browser processing here is limited to about ` +
          `${Math.round(MAX_BYTES / (1024 * 1024))} MB${isMobile ? ' on phones' : ''} — try a ` +
          `shorter clip or use a computer for larger files.`,
      );
      return;
    }
    setFile(f);
    setEditOn(false);
    setEdits({});
    resetRun();
  }

  async function run<P>(job: Job<P>, params: P, targetBytes?: number) {
    if (!file) return;
    setError(null);
    setRatio(0);
    try {
      setPhase('loading-engine');
      await loadEngine();
      setPhase('processing');
      const out = await runJob({ file, job, params, onProgress: setRatio });
      setResult({
        blob: out.blob,
        downloadName: out.downloadName,
        mime: out.mime,
        outputBytes: out.blob.size,
        targetBytes,
      });
      setPhase('done');
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  }

  if (!WASM_OK) {
    return (
      <main style={{ maxWidth: 520, margin: '2rem auto', padding: '0 1rem' }}>
        <h1 style={{ fontSize: 24 }}>
          <span className="accent-text">Clip</span>Fit
        </h1>
        <p className="muted">
          ClipFit processes video using WebAssembly, which this browser doesn't support. Please use
          an up-to-date version of Chrome, Edge, Firefox, or Safari.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 520, margin: '2rem auto', padding: '0 1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>
          <span className="accent-text">Clip</span>Fit
        </h1>
        <ThemeSwitcher />
      </header>
      <p className="muted" style={{ marginTop: 4 }}>
        Compress, convert, trim, crop & more — entirely in your browser. Your file is never
        uploaded.
      </p>
      {isMobile && (
        <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          On phones, keep clips short — mobile browsers limit how much video can be processed in
          memory.
        </p>
      )}

      {error && <p style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</p>}

      <div className="card" style={{ marginTop: 16 }}>
        {!file && <Dropzone onFile={onFile} />}

        {file && phase === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              {file.name} — {humanizeBytes(file.size)}
            </p>

            <Toggle on={editOn} onChange={setEditOn}>
              Edit
            </Toggle>

            {editOn ? <Editor file={file} onChange={setEdits} /> : <VideoPreview file={file} />}

            <Segmented
              value={output}
              onChange={setOutput}
              options={[
                { value: 'compress', label: 'Compress' },
                { value: 'gif', label: 'GIF' },
              ]}
            />

            {output === 'compress' && (
              <CompressPanel
                onStart={(t, mute, quality, format) =>
                  run(fitJob, { targetBytes: t.bytes, mute, quality, format, edits: activeEdits }, t.bytes)
                }
              />
            )}
            {output === 'gif' && (
              <>
                <GifPanel file={file} onRun={(p) => run(gifJob, p)} />
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  Edit controls don't affect GIF — use the options here.
                </p>
              </>
            )}

            <button onClick={() => run(audioJob, { format: 'mp3', edits: activeEdits })}>
              Export audio (MP3)
            </button>
            <button onClick={() => setFile(null)} style={{ width: '100%' }}>
              Choose a different file
            </button>
          </div>
        )}

        {(phase === 'loading-engine' || phase === 'processing') && (
          <Progress phase={phase} ratio={ratio} />
        )}

        {phase === 'done' && result && <Result result={result} onReset={resetRun} />}

        {phase === 'error' && <button onClick={resetRun}>Try again</button>}
      </div>
    </main>
  );
}
