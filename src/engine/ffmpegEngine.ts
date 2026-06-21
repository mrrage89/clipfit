import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { probeMedia } from '../lib/probe';
import type { Job } from '../jobs/types';

const CORE_VERSION = '0.12.10';

let enginePromise: Promise<FFmpeg> | null = null;

async function createEngine(): Promise<FFmpeg> {
  // Single-thread core: growable heap, reliable on large real-world videos
  // (the multithread core has a fixed ~1GB heap that OOMs on normal phone clips).
  const baseURL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;
  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
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
  const input = inputNameFor(opts.file);
  await engine.writeFile(input, await fetchFile(opts.file));

  const ctx = await probeMedia(engine, input);
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

// Extract a single still frame (for the crop preview) + the source dimensions.
export async function extractFrame(
  file: File,
  atSec = 1,
): Promise<{ url: string; width: number; height: number }> {
  const engine = await loadEngine();
  const input = inputNameFor(file);
  await engine.writeFile(input, await fetchFile(file));
  const ctx = await probeMedia(engine, input);
  const t = Math.min(Math.max(0, atSec), Math.max(0, ctx.durationSec / 2));
  await engine.exec(['-ss', String(t), '-i', input, '-frames:v', '1', '-y', 'frame.png']);
  const data = (await engine.readFile('frame.png')) as Uint8Array;
  const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: 'image/png' }));
  return { url, width: ctx.width, height: ctx.height };
}
