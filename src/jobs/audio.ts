import type { Job } from './types';
import { buildEditChain, type Edits } from './editChain';

export interface AudioParams {
  format: 'mp3' | 'wav';
  edits?: Edits;
}

export const audioJob: Job<AudioParams> = {
  id: 'audio',
  label: 'Extract audio',
  accept: 'video/*',
  output: (p) =>
    p.format === 'wav'
      ? { name: 'output.wav', mime: 'audio/wav', downloadName: 'clipfit.wav' }
      : { name: 'output.mp3', mime: 'audio/mpeg', downloadName: 'clipfit.mp3' },
  buildPasses(input, output, ctx, p) {
    const chain = buildEditChain(p.edits, ctx.hasAudio);
    const af = chain.af.length ? ['-af', chain.af.join(',')] : [];
    const codec =
      p.format === 'wav' ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'libmp3lame', '-b:a', '192k'];
    return [[...chain.seek, '-i', input, '-vn', ...af, ...codec, output]];
  },
};
