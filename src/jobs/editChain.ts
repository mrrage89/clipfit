// Shared builder that turns an Edits object into ffmpeg fragments, so the output
// jobs (compress, audio) can bake edits into a single pass instead of a separate
// edit encode.
export interface Edits {
  trim?: { startSec: number; endSec: number };
  crop?: { x: number; y: number; w: number; h: number };
  rotate?: 0 | 90 | 180 | 270;
  flipH?: boolean;
  flipV?: boolean;
  speed?: number;
  fps?: number;
  volumeDb?: number;
}

export interface EditChain {
  seek: string[]; // input-seek args for trim (before -i)
  vf: string[]; // ordered video filters
  af: string[]; // audio filters
}

export function buildEditChain(e: Edits | undefined, hasAudio: boolean): EditChain {
  const seek: string[] = [];
  if (e?.trim) {
    seek.push('-ss', String(e.trim.startSec), '-t', String(Math.max(0, e.trim.endSec - e.trim.startSec)));
  }
  const vf: string[] = [];
  if (e?.crop) vf.push(`crop=${e.crop.w}:${e.crop.h}:${e.crop.x}:${e.crop.y}`);
  if (e?.rotate === 90) vf.push('transpose=1');
  else if (e?.rotate === 180) vf.push('transpose=1', 'transpose=1');
  else if (e?.rotate === 270) vf.push('transpose=2');
  if (e?.flipH) vf.push('hflip');
  if (e?.flipV) vf.push('vflip');
  if (e?.speed && e.speed !== 1) vf.push(`setpts=PTS/${e.speed}`);
  if (e?.fps && e.fps > 0) vf.push(`fps=${e.fps}`);

  const af: string[] = [];
  if (hasAudio) {
    if (e?.speed && e.speed !== 1) af.push(`atempo=${e.speed}`);
    if (e?.volumeDb && e.volumeDb !== 0) af.push(`volume=${e.volumeDb}dB`);
  }
  return { seek, vf, af };
}

export function effectiveDurationSec(fullDurationSec: number, e?: Edits): number {
  const trimmed = e?.trim ? Math.max(0, e.trim.endSec - e.trim.startSec) : fullDurationSec;
  const speed = e?.speed && e.speed > 0 ? e.speed : 1;
  return trimmed / speed;
}
