export interface SizeTarget {
  label: string; // e.g. "Discord (25 MB)"
  bytes: number; // e.g. 25 * 1024 * 1024
}

export type JobPhase = 'idle' | 'loading-engine' | 'processing' | 'done' | 'error';

export interface JobResult {
  blob: Blob;
  outputBytes: number;
  targetBytes: number;
}
