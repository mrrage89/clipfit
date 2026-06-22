import { useState } from 'react';
import { Dropzone } from './components/Dropzone';
import { TargetPicker } from './components/TargetPicker';
import { GifPanel } from './components/GifPanel';
import { AudioPanel } from './components/AudioPanel';
import { ConvertPanel } from './components/ConvertPanel';
import { StudioEditor } from './components/StudioEditor';
import { ToolPicker } from './components/ToolPicker';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { VideoPreview } from './components/VideoPreview';
import { Progress } from './components/Progress';
import { Result } from './components/Result';
import { loadEngine, runJob } from './engine/ffmpegEngine';
import { fitJob } from './jobs/fit';
import { gifJob } from './jobs/gif';
import { audioJob } from './jobs/audio';
import { convertJob } from './jobs/convert';
import { studioJob } from './jobs/studio';
import { humanizeBytes } from './lib/format';
import type { Job } from './jobs/types';
import type { JobPhase, JobResult } from './types';

const MAX_BYTES = 500 * 1024 * 1024; // single-thread core grows its heap as needed

const TOOLS = [
  { id: 'fit', label: 'Compress', desc: 'Shrink a video to fit a size limit (Discord, email, WhatsApp).' },
  { id: 'gif', label: 'GIF', desc: 'Turn a video into an animated GIF.' },
  { id: 'audio', label: 'Extract audio', desc: 'Pull the audio out as MP3 or WAV.' },
  { id: 'convert', label: 'Convert', desc: 'Change the format — MP4 or WebM.' },
  { id: 'edit', label: 'Edit', desc: 'Trim, crop, rotate, flip, change speed / volume / frame rate.' },
];

export default function App() {
  const [toolId, setToolId] = useState('fit');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<JobPhase>('idle');
  const [ratio, setRatio] = useState(0);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetRun() {
    setPhase('idle');
    setRatio(0);
    setResult(null);
    setError(null);
  }

  function selectTool(id: string) {
    setToolId(id);
    resetRun(); // keep the file; just switch the tool
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

  return (
    <main
      style={{ maxWidth: 520, margin: '2rem auto', padding: '0 1rem' }}
    >
      <header
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
      >
        <h1 style={{ margin: 0, fontSize: 24 }}>
          <span className="accent-text">Clip</span>Fit
        </h1>
        <ThemeSwitcher />
      </header>
      <p className="muted" style={{ marginTop: 4 }}>
        Compress, convert, trim, crop & more — entirely in your browser. Your file is never
        uploaded.
      </p>

      <ToolPicker tools={TOOLS} active={toolId} onSelect={selectTool} />

      <p style={{ marginTop: 10, marginBottom: 0 }}>
        <span className="accent-text" style={{ fontWeight: 500 }}>
          {TOOLS.find((t) => t.id === toolId)?.label}
        </span>
        <span className="muted"> — {TOOLS.find((t) => t.id === toolId)?.desc}</span>
      </p>

      {error && <p style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</p>}

      <div className="card" style={{ marginTop: 16 }}>
        {!file && <Dropzone onFile={onFile} />}

        {file && phase === 'idle' && (
          <>
            <p className="muted" style={{ fontSize: 14 }}>
              {file.name} — {humanizeBytes(file.size)}
            </p>
            {toolId !== 'edit' && (
              <div style={{ marginBottom: 14 }}>
                <VideoPreview file={file} />
              </div>
            )}
            {toolId === 'fit' && (
              <TargetPicker
                onStart={(t, mute, quality) =>
                  run(fitJob, { targetBytes: t.bytes, mute, quality }, t.bytes)
                }
              />
            )}
            {toolId === 'gif' && <GifPanel onRun={(p) => run(gifJob, p)} />}
            {toolId === 'audio' && <AudioPanel onRun={(p) => run(audioJob, p)} />}
            {toolId === 'convert' && <ConvertPanel onRun={(p) => run(convertJob, p)} />}
            {toolId === 'edit' && <StudioEditor file={file} onRun={(p) => run(studioJob, p)} />}
            <button onClick={() => setFile(null)} style={{ marginTop: 14, width: '100%' }}>
              Choose a different file
            </button>
          </>
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
