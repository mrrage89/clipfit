import type { ProbeResult } from '../lib/probe';

export type { ProbeResult };

// A tool = a pure builder of ffmpeg passes + output metadata. The generic engine
// runner probes the input, calls buildPasses, runs the passes, and returns the blob.
export interface Job<P> {
  id: string;
  label: string;
  accept: string; // file input accept attribute
  outputName: string; // filename inside the ffmpeg FS
  mime: string; // output blob MIME type
  downloadName: string; // suggested download filename
  buildPasses(input: string, output: string, ctx: ProbeResult, params: P): string[][];
}
