import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { parseDurationSec } from './duration';

export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

// Pure: extract WxH from the first "Video:" line of ffmpeg -i output.
// Uses \d{2,5} for the first group so codec hex tags like "0x31637661" (single
// "0" before the x) can't false-match as a resolution.
export function parseResolution(logLines: string[]): { width: number; height: number } | null {
  for (const line of logLines) {
    if (!/Video:/.test(line)) continue;
    const m = line.match(/(\d{2,5})x(\d{2,5})/);
    if (m) return { width: Number(m[1]), height: Number(m[2]) };
  }
  return null;
}

// Pure: true if ffmpeg -i reported any audio stream.
export function parseHasAudio(logLines: string[]): boolean {
  return logLines.some((l) => /Audio:/.test(l));
}

// Probe a media file already written to the core FS. `-i` with no output prints
// the stream info then errors (expected); we only want the log lines.
export async function probeMedia(engine: FFmpeg, input: string): Promise<ProbeResult> {
  const logs: string[] = [];
  const onLog = ({ message }: { message: string }) => logs.push(message);
  engine.on('log', onLog);
  try {
    await engine.exec(['-hide_banner', '-i', input]);
  } catch {
    /* expected: "At least one output file must be specified" */
  } finally {
    engine.off('log', onLog);
  }
  const res = parseResolution(logs);
  return {
    durationSec: parseDurationSec(logs) ?? 0,
    width: res?.width ?? 0,
    height: res?.height ?? 0,
    hasAudio: parseHasAudio(logs),
  };
}
