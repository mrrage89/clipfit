import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { computeVideoKbps } from '../jobs/bitrate';
import { buildMakeItFitArgs } from '../jobs/makeItFit';
import { parseDurationSec } from '../lib/duration';

const CORE_VERSION = '0.12.10';
const OUTPUT = 'output.mp4';

let enginePromise: Promise<FFmpeg> | null = null;

function crossOriginIsolatedAvailable(): boolean {
  return typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated === true;
}

async function createEngine(): Promise<FFmpeg> {
  // Multithread core needs SharedArrayBuffer (cross-origin isolation);
  // fall back to the single-thread core when that's unavailable.
  const mt = crossOriginIsolatedAvailable();
  const pkg = mt ? 'core-mt' : 'core';
  const baseURL = `https://unpkg.com/@ffmpeg/${pkg}@${CORE_VERSION}/dist/esm`;

  const ffmpeg = new FFmpeg();
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

export interface MakeItFitResult {
  blob: Blob;
  outputBytes: number;
  durationSec: number;
}

export async function runMakeItFit(opts: {
  file: File;
  targetBytes: number;
  mute: boolean;
  onProgress?: (ratio: number) => void;
}): Promise<MakeItFitResult> {
  const engine = await loadEngine();
  const input = inputNameFor(opts.file);
  await engine.writeFile(input, await fetchFile(opts.file));

  // Probe duration via ffmpeg itself (handles any container the core supports).
  // `-i` with no output prints the "Duration:" line, then exits with an error —
  // that error is expected; we only want the log lines.
  const probeLogs: string[] = [];
  const onProbe = ({ message }: { message: string }) => probeLogs.push(message);
  engine.on('log', onProbe);
  try {
    await engine.exec(['-hide_banner', '-i', input]);
  } catch {
    /* expected: "At least one output file must be specified" */
  } finally {
    engine.off('log', onProbe);
  }
  const durationSec = parseDurationSec(probeLogs);
  if (!durationSec) {
    throw new Error(
      "Couldn't read this video's duration — it may be corrupt or use a codec the in-browser " +
        'engine cannot decode.',
    );
  }

  const audioKbps = opts.mute ? 0 : 128;
  const videoKbps = computeVideoKbps({ targetBytes: opts.targetBytes, durationSec, audioKbps });
  const passes = buildMakeItFitArgs({ inputName: input, outputName: OUTPUT, videoKbps, audioKbps });

  const encLogs: string[] = [];
  const onEnc = ({ message }: { message: string }) => encLogs.push(message);
  const onProg = (e: { progress: number }) =>
    opts.onProgress?.(Math.min(1, Math.max(0, e.progress)));
  engine.on('log', onEnc);
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
    engine.off('log', onEnc);
  }
  if (failed) {
    const joined = encLogs.join('\n');
    if (/oom|out of memory|aborted|memory access out of bounds/i.test(joined)) {
      throw new Error(
        'This video is too large or high-resolution for in-browser processing — the engine ran ' +
          'out of memory. Try a shorter clip or a smaller / lower-resolution source.',
      );
    }
    throw new Error(`Conversion failed: ${errorTail(encLogs)}`);
  }

  let data: Uint8Array;
  try {
    data = (await engine.readFile(OUTPUT)) as Uint8Array;
  } catch {
    throw new Error(`Conversion produced no output: ${errorTail(encLogs)}`);
  }
  // Copy into a fresh ArrayBuffer-backed array (multithread core may hand back a
  // SharedArrayBuffer-backed view, which Blob's types reject).
  const blob = new Blob([new Uint8Array(data)], { type: 'video/mp4' });
  return { blob, outputBytes: blob.size, durationSec };
}
