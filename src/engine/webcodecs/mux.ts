import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from 'webm-muxer';

export type MuxVideoCodec = 'avc' | 'vp9' | 'av1';

export interface MuxerFacade {
  addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): void;
  addAudioChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): void;
  finalize(): Blob;
}

export interface CreateMuxerOpts {
  format: 'mp4' | 'webm';
  width: number;
  height: number;
  videoCodec: MuxVideoCodec;
  fps: number;
  // v1 copies AAC audio into MP4 only; WebM-with-audio routes to ffmpeg upstream.
  audio: { sampleRate: number; channels: number } | null;
}

export function createMuxer(opts: CreateMuxerOpts): MuxerFacade {
  if (opts.format === 'mp4') {
    const target = new Mp4Target();
    const muxer = new Mp4Muxer({
      target,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
      video: { codec: opts.videoCodec, width: opts.width, height: opts.height },
      ...(opts.audio
        ? { audio: { codec: 'aac', sampleRate: opts.audio.sampleRate, numberOfChannels: opts.audio.channels } }
        : {}),
    });
    return {
      addVideoChunk: (c, m) => muxer.addVideoChunk(c, m),
      addAudioChunk: (c, m) => muxer.addAudioChunk(c, m),
      finalize: () => {
        muxer.finalize();
        return new Blob([target.buffer], { type: 'video/mp4' });
      },
    };
  }

  const target = new WebmTarget();
  const muxer = new WebmMuxer({
    target,
    firstTimestampBehavior: 'offset',
    video: {
      codec: opts.videoCodec === 'av1' ? 'V_AV1' : 'V_VP9',
      width: opts.width,
      height: opts.height,
      frameRate: opts.fps,
    },
  });
  return {
    addVideoChunk: (c, m) => muxer.addVideoChunk(c, m),
    addAudioChunk: (c, m) => muxer.addAudioChunk(c, m),
    finalize: () => {
      muxer.finalize();
      return new Blob([target.buffer], { type: 'video/webm' });
    },
  };
}
