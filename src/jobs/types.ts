import type { ProbeResult } from '../lib/probe';

export type { ProbeResult };

// A tool = a pure builder of ffmpeg passes + output metadata. The generic engine
// runner probes the input, calls buildPasses, runs the passes, and returns the blob.
export interface JobOutput {
  name: string; // filename inside the ffmpeg FS
  mime: string; // output blob MIME type
  downloadName: string; // suggested download filename
}

export interface Job<P> {
  id: string;
  label: string;
  accept: string; // file input accept attribute
  output(params: P): JobOutput; // output info (may depend on params, e.g. format)
  buildPasses(input: string, output: string, ctx: ProbeResult, params: P): string[][];
}
