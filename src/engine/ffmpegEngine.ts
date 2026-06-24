import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { probeMedia, type ProbeResult } from '../lib/probe';
import { thumbTimes } from '../lib/filmstrip';
import type { Job } from '../jobs/types';

const CORE_VERSION = '0.12.10';

let enginePromise: Promise<FFmpeg> | null = null;

async function createEngine(): Promise<FFmpeg> {
  // Single-thread core: growable heap, reliable on large real-world videos.
  const ffmpeg = new FFmpeg();
  if (import.meta.env.VITE_EXT === '1') {
    // Browser-extension build: the core is BUNDLED locally (MV3 forbids remote
    // code). Absolute chrome-extension:// URL so the worker (which lives under
    // /assets/) resolves it against the extension page, not its own path.
    const base = new URL(`ffmpeg/${CORE_VERSION}/`, location.href).href;
    await ffmpeg.load({ coreURL: `${base}ffmpeg-core.js`, wasmURL: `${base}ffmpeg-core.wasm` });
  } else {
    // Web build: core from jsdelivr (Cloudflare's 25 MiB asset cap can't hold the
    // ~31MB wasm). toBlobURL makes the cross-origin core same-origin for the worker.
    const baseURL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`;
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  }
  return ffmpeg;
}

export function loadEngine(): Promise<FFmpeg> {
  if (!enginePromise) enginePromise = createEngine();
  return enginePromise;
}

function inputNameFor(file: File): string {
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot) : '.mp4';
  return `input${ext}`;
}

// Cache the written input + its probe so repeated operations on the same file
// (preview frame, filmstrip, export) don't re-copy/re-probe the whole video.
let cachedFile: File | null = null;
let cachedName: string | null = null;
let cachedCtx: ProbeResult | null = null;

async function ensureInput(engine: FFmpeg, file: File): Promise<string> {
  if (cachedFile === file && cachedName) return cachedName;
  const name = inputNameFor(file);
  await engine.writeFile(name, await fetchFile(file));
  cachedFile = file;
  cachedName = name;
  cachedCtx = null;
  return name;
}

async function getCtx(engine: FFmpeg, input: string): Promise<ProbeResult> {
  if (cachedCtx) return cachedCtx;
  cachedCtx = await probeMedia(engine, input);
  return cachedCtx;
}

function errorTail(logs: string[]): string {
  const errs = logs.filter((l) =>
    /error|invalid|unable|not found|no such|failed|decoder|unsupported/i.test(l),
  );
  return (errs.length ? errs.slice(-2) : logs.slice(-2)).join(' | ').slice(0, 300);
}

export interface EngineOutput {
  blob: Blob;
  mime: string;
  downloadName: string;
}

export async function runJob<P>(opts: {
  file: File;
  job: Job<P>;
  params: P;
  onProgress?: (ratio: number) => void;
}): Promise<EngineOutput> {
  const engine = await loadEngine();
  const input = await ensureInput(engine, opts.file);
  const ctx = await getCtx(engine, input);
  if (!ctx.durationSec && !ctx.width) {
    throw new Error(
      "Couldn't read this video — it may be corrupt or use a codec the in-browser engine " +
        'cannot decode.',
    );
  }

  const out = opts.job.output(opts.params);
  const passes = opts.job.buildPasses(input, out.name, ctx, opts.params);

  const logs: string[] = [];
  const onLog = ({ message }: { message: string }) => logs.push(message);
  const onProg = (e: { progress: number }) =>
    opts.onProgress?.(Math.min(1, Math.max(0, e.progress)));
  engine.on('log', onLog);
  engine.on('progress', onProg);
  let failed = false;
  try {
    for (const args of passes) {
      const code = await engine.exec(args);
      if (code !== 0) {
        failed = true;
        break;
      }
    }
  } catch {
    failed = true;
  } finally {
    engine.off('progress', onProg);
    engine.off('log', onLog);
  }

  if (failed) {
    const joined = logs.join('\n');
    if (/oom|out of memory|aborted|memory access out of bounds/i.test(joined)) {
      throw new Error(
        'This video is too large or high-resolution for in-browser processing — the engine ran ' +
          'out of memory. Try a shorter clip or a smaller / lower-resolution source.',
      );
    }
    throw new Error(`Conversion failed: ${errorTail(logs)}`);
  }

  let data: Uint8Array;
  try {
    data = (await engine.readFile(out.name)) as Uint8Array;
  } catch {
    throw new Error(`Conversion produced no output: ${errorTail(logs)}`);
  }

  return {
    blob: new Blob([new Uint8Array(data)], { type: out.mime }),
    mime: out.mime,
    downloadName: out.downloadName,
  };
}

export function probeFile(file: File): Promise<ProbeResult> {
  return loadEngine().then((engine) => ensureInput(engine, file).then((input) => getCtx(engine, input)));
}

// One still frame (for crop preview). Returns an object URL.
export async function extractFrame(file: File, atSec = 1): Promise<{ url: string }> {
  const engine = await loadEngine();
  const input = await ensureInput(engine, file);
  const ctx = await getCtx(engine, input);
  const t = Math.min(Math.max(0, atSec), Math.max(0, ctx.durationSec / 2));
  await engine.exec(['-ss', String(t), '-i', input, '-frames:v', '1', '-y', 'frame.png']);
  const data = (await engine.readFile('frame.png')) as Uint8Array;
  return { url: URL.createObjectURL(new Blob([new Uint8Array(data)], { type: 'image/png' })) };
}

// A filmstrip of `count` evenly-spaced thumbnails (for the trim scrubber).
export async function extractFilmstrip(file: File, count: number): Promise<string[]> {
  const engine = await loadEngine();
  const input = await ensureInput(engine, file);
  const ctx = await getCtx(engine, input);
  const cap = Math.max(0, ctx.durationSec - 0.1); // a seek at exactly EOF yields no frame
  const times = thumbTimes(ctx.durationSec, count);
  const urls: string[] = [];
  for (let i = 0; i < times.length; i++) {
    const name = `thumb${i}.png`;
    try {
      await engine.exec([
        '-ss', String(Math.min(times[i], cap)), '-i', input, '-frames:v', '1', '-vf', 'scale=160:-1', '-y', name,
      ]);
      const data = (await engine.readFile(name)) as Uint8Array;
      if (data && data.length > 0) {
        urls.push(URL.createObjectURL(new Blob([new Uint8Array(data)], { type: 'image/png' })));
      }
    } catch {
      /* skip a thumbnail that fails to render; the scrubber still works */
    }
  }
  return urls;
}
