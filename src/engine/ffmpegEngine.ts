import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const CORE_VERSION = '0.12.10';

let enginePromise: Promise<FFmpeg> | null = null;

function crossOriginIsolatedAvailable(): boolean {
  return typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated === true;
}

async function createEngine(onLog?: (msg: string) => void): Promise<FFmpeg> {
  // Multithread core needs SharedArrayBuffer (cross-origin isolation).
  // Fall back to the single-thread core when that's unavailable.
  const mt = crossOriginIsolatedAvailable();
  const pkg = mt ? 'core-mt' : 'core';
  const baseURL = `https://unpkg.com/@ffmpeg/${pkg}@${CORE_VERSION}/dist/esm`;

  const ffmpeg = new FFmpeg();
  if (onLog) ffmpeg.on('log', ({ message }) => onLog(message));

  const config: { coreURL: string; wasmURL: string; workerURL?: string } = {
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  };
  if (mt) {
    config.workerURL = await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript');
  }

  await ffmpeg.load(config);
  return ffmpeg;
}

export function loadEngine(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (!enginePromise) enginePromise = createEngine(onLog);
  return enginePromise;
}

export interface RunOptions {
  file: File;
  passes: string[][]; // from buildMakeItFitArgs
  inputName: string;
  outputName: string;
  onProgress?: (ratio: number) => void; // 0..1
}

export async function runJob(opts: RunOptions): Promise<Blob> {
  const engine = await loadEngine();
  const progressHandler = (e: { progress: number }) =>
    opts.onProgress?.(Math.min(1, Math.max(0, e.progress)));
  engine.on('progress', progressHandler);
  try {
    await engine.writeFile(opts.inputName, await fetchFile(opts.file));
    for (const args of opts.passes) {
      await engine.exec(args);
    }
    const data = (await engine.readFile(opts.outputName)) as Uint8Array;
    // Copy into a fresh ArrayBuffer-backed array: the multithread core can
    // return a SharedArrayBuffer-backed view, which Blob's types reject.
    return new Blob([new Uint8Array(data)], { type: 'video/mp4' });
  } finally {
    engine.off('progress', progressHandler);
  }
}
