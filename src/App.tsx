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
  const [pendingLarge, setPendingLarge] = useState<File | null>(null);

  const activeEdits = editOn ? edits : undefined;

  function resetRun() {
    setPhase('idle');
    setRatio(0);
    setResult(null);
    setError(null);
  }

  function accept(f: File) {
    setPendingLarge(null);
    setFile(f);
    setEditOn(false);
    setEdits({});
    resetRun();
  }

  function onFile(f: File) {
    setError(null);
    setPendingLarge(null);
    // Over the soft cap → don't reject outright; let the user proceed knowingly.
    if (f.size > MAX_BYTES) {
      setPendingLarge(f);
      return;
    }
    accept(f);
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
        {!file && !pendingLarge && <Dropzone onFile={onFile} />}

        {!file && pendingLarge && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ color: 'var(--danger)', margin: 0, fontWeight: 500 }}>
              {pendingLarge.name} — {humanizeBytes(pendingLarge.size)}
            </p>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              That's over the ~{Math.round(MAX_BYTES / (1024 * 1024))} MB limit. Processing keeps the
              whole file in memory (the engine caps at 2 GB), so it may run out of memory and fail
              {isMobile ? ' — very likely on a phone' : ' on weaker machines'}. You can still try.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="primary" onClick={() => accept(pendingLarge)}>
                Try anyway
              </button>
              <button onClick={() => setPendingLarge(null)}>Pick a different file</button>
            </div>
          </div>
        )}

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
              full
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
                onExportAudio={() => run(audioJob, { format: 'mp3', edits: activeEdits })}
              />
            )}
            {output === 'gif' && (
              <>
                <GifPanel
                  file={file}
                  onRun={(p) => run(gifJob, p)}
                  onExportAudio={() => run(audioJob, { format: 'mp3', edits: activeEdits })}
                />
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  Edit controls don't affect GIF — use the options here.
                </p>
              </>
            )}

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

      <footer style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}>
        <span className="muted">Free, private, no uploads — </span>
        <a
          href="https://ko-fi.com/richardrage"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent)', fontWeight: 500 }}
        >
          ♥ Support ClipFit
        </a>
      </footer>
    </main>
  );
}
