import { describe, it, expect } from 'vitest';
import { audioJob } from '../src/jobs/audio';

const ctx = { durationSec: 60, width: 0, height: 0, hasAudio: true };

describe('audioJob edits', () => {
  it('applies trim seek and audio filters, ignores video filters', () => {
    const a = audioJob.buildPasses('in.mp4', 'out.mp3', ctx, {
      format: 'mp3',
      edits: { trim: { startSec: 1, endSec: 4 }, volumeDb: 6, crop: { x: 0, y: 0, w: 9, h: 9 } },
    })[0];
    expect(a.slice(0, 4)).toEqual(['-ss', '1', '-t', '3']);
    expect(a.join(' ')).toContain('-af volume=6dB');
    expect(a.join(' ')).not.toContain('crop');
    expect(a).toContain('-vn');
  });
  it('plain extraction unchanged when no edits', () => {
    const a = audioJob.buildPasses('in.mp4', 'out.mp3', ctx, { format: 'mp3' })[0];
    expect(a).toEqual(['-i', 'in.mp4', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', 'out.mp3']);
  });
});
