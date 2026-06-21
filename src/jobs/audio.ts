import type { Job } from './types';

export interface AudioParams {
  format: 'mp3' | 'wav';
}

export const audioJob: Job<AudioParams> = {
  id: 'audio',
  label: 'Extract audio',
  accept: 'video/*',
  output: (p) =>
    p.format === 'wav'
      ? { name: 'output.wav', mime: 'audio/wav', downloadName: 'clipfit.wav' }
      : { name: 'output.mp3', mime: 'audio/mpeg', downloadName: 'clipfit.mp3' },
  buildPasses(input, output, _ctx, p) {
    const codec =
      p.format === 'wav' ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'libmp3lame', '-b:a', '192k'];
    return [['-i', input, '-vn', ...codec, output]];
  },
};
