import { describe, it, expect } from 'vitest';
import { editJob } from '../src/jobs/edit';

const withAudio = { durationSec: 10, width: 1920, height: 1080, hasAudio: true };
const noAudio = { ...withAudio, hasAudio: false };

const argstr = (p: Parameters<typeof editJob.buildPasses>[3]) =>
  editJob.buildPasses('in.mp4', 'out.mp4', withAudio, p)[0].join(' ');

describe('editJob.buildPasses', () => {
  it('rotate 90 -> transpose=1, copies audio when only video changes', () => {
    const a = argstr({ rotate: 90 });
    expect(a).toContain('transpose=1');
    expect(a).toContain('-c:a copy');
  });
  it('rotate 180 -> two transposes', () => {
    expect(argstr({ rotate: 180 })).toContain('transpose=1,transpose=1');
  });
  it('flip horizontal + vertical', () => {
    const a = argstr({ flipH: true, flipV: true });
    expect(a).toContain('hflip');
    expect(a).toContain('vflip');
  });
  it('speed sets video setpts AND audio atempo', () => {
    const a = argstr({ speed: 2 });
    expect(a).toContain('setpts=PTS/2');
    expect(a).toContain('atempo=2');
    expect(a).toContain('-c:a aac');
  });
  it('fps filter', () => {
    expect(argstr({ fps: 30 })).toContain('fps=30');
  });
  it('volume-only copies video and re-encodes audio', () => {
    const a = argstr({ volumeDb: 6 });
    expect(a).toContain('-c:v copy');
    expect(a).toContain('volume=6dB');
    expect(a).toContain('-c:a aac');
  });
  it('no audio -> -an, no atempo even with speed', () => {
    const a = editJob.buildPasses('in.mp4', 'out.mp4', noAudio, { speed: 2 })[0].join(' ');
    expect(a).toContain('-an');
    expect(a).not.toContain('atempo');
  });
});
