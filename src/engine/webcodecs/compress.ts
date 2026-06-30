import { demuxMp4 } from './demux';
import { createMuxer, type MuxVideoCodec } from './mux';
import { videoKbpsForCopiedAudio } from './budget';
import { pickMaxDimension } from '../../jobs/bitrate';

export interface FastCompressParams {
  file: File;
  format: 'mp4' | 'webm';
  videoCodec: string; // encoder codec string from caps (avc1.../vp09.../av01...)
  targetBytes: number;
  mute: boolean;
  trim?: { startSec: number; endSec: number };
  onProgress?: (ratio: number) => void;
}

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

function muxVideoCodec(codec: string): MuxVideoCodec {
  if (codec.startsWith('av01')) return 'av1';
  if (codec.startsWith('vp09') || codec.startsWith('vp9')) return 'vp9';
  return 'avc';
}

// v1 copies AAC into MP4 only; other audio/container combos route to ffmpeg upstream.
export function audioCopyable(audioCodec: string, format: 'mp4' | 'webm'): boolean {
  return format === 'mp4' && audioCodec.startsWith('mp4a');
}

async function drain(encoder: VideoEncoder, max: number): Promise<void> {
  while (encoder.encodeQueueSize > max) await new Promise((r) => setTimeout(r, 0));
}

// Index of the last keyframe at or before startUs, so decoding can start there.
function trimStartIndex(chunks: { type: 'key' | 'delta'; timestamp: number }[], startUs: number): number {
  if (startUs <= 0) return 0;
  let idx = 0;
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].type === 'key' && chunks[i].timestamp <= startUs) idx = i;
    if (chunks[i].timestamp > startUs) break;
  }
  return idx;
}

export async function compressFast(p: FastCompressParams): Promise<Blob> {
  const dem = await demuxMp4(p.file);
  const v = dem.video;

  const startUs = Math.max(0, (p.trim?.startSec ?? 0) * 1e6);
  const endUs = p.trim ? p.trim.endSec * 1e6 : Number.POSITIVE_INFINITY;
  const keptDur = (Math.min(endUs, v.durationSec * 1e6) - startUs) / 1e6;
  if (keptDur <= 0) throw new Error('webcodecs: empty trim range');

  const keepAudio =
    !p.mute &&
    !!dem.audio &&
    audioCopyable(dem.audio.codec, p.format) &&
    !!dem.audio.description;
  const audioChunksKept = keepAudio
    ? dem.audio!.chunks.filter((c) => c.timestamp >= startUs && c.timestamp < endUs)
    : [];
  const audioBytes = audioChunksKept.reduce((n, c) => n + c.data.byteLength, 0);

  const kbps = videoKbpsForCopiedAudio({
    targetBytes: p.targetBytes,
    durationSec: keptDur,
    audioBytes,
    safetyMargin: 0.95,
  });
  if (kbps <= 0) throw new Error('webcodecs: cannot fit target');

  const maxDim = pickMaxDimension(kbps);
  const scale = Math.min(1, maxDim / Math.max(v.width, v.height));
  const outW = even(Math.round(v.width * scale));
  const outH = even(Math.round(v.height * scale));
  const needScale = outW !== v.width || outH !== v.height;

  const muxer = createMuxer({
    format: p.format,
    width: outW,
    height: outH,
    videoCodec: muxVideoCodec(p.videoCodec),
    fps: v.fps,
    audio: keepAudio ? { sampleRate: dem.audio!.sampleRate, channels: dem.audio!.channels } : null,
  });

  let err: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { err = e as Error; },
  });
  encoder.configure({
    codec: p.videoCodec,
    width: outW,
    height: outH,
    bitrate: kbps * 1000,
    framerate: v.fps,
  });

  const canvas = needScale ? new OffscreenCanvas(outW, outH) : null;
  const ctx = canvas ? canvas.getContext('2d') : null;

  const totalFrames = Math.max(1, Math.round(keptDur * v.fps));
  let encoded = 0;
  const decoder = new VideoDecoder({
    output: (frame) => {
      if (frame.timestamp < startUs || frame.timestamp >= endUs) {
        frame.close();
        return;
      }
      const tsOut = frame.timestamp - startUs;
      let out: VideoFrame;
      if (needScale && ctx) {
        ctx.drawImage(frame, 0, 0, outW, outH);
        out = new VideoFrame(canvas as OffscreenCanvas, { timestamp: tsOut });
        frame.close();
      } else {
        out = new VideoFrame(frame, { timestamp: tsOut });
        frame.close();
      }
      encoder.encode(out);
      out.close();
      encoded++;
      p.onProgress?.(Math.min(1, encoded / totalFrames));
    },
    error: (e) => { err = e as Error; },
  });
  decoder.configure({
    codec: v.codec,
    description: v.description,
    codedWidth: v.width,
    codedHeight: v.height,
  });

  const startIdx = trimStartIndex(v.chunks, startUs);
  const stopUs = endUs === Number.POSITIVE_INFINITY ? endUs : endUs + 1e6; // B-frame margin
  for (let i = startIdx; i < v.chunks.length; i++) {
    const c = v.chunks[i];
    if (err) break;
    await drain(encoder, 16);
    decoder.decode(new EncodedVideoChunk({ type: c.type, timestamp: c.timestamp, duration: c.duration, data: c.data }));
    if (c.timestamp >= stopUs) break;
  }
  await decoder.flush();
  await encoder.flush();

  if (keepAudio) {
    const aMeta: EncodedAudioChunkMetadata = {
      decoderConfig: {
        codec: dem.audio!.codec,
        sampleRate: dem.audio!.sampleRate,
        numberOfChannels: dem.audio!.channels,
        description: dem.audio!.description,
      },
    };
    for (const c of audioChunksKept) {
      muxer.addAudioChunk(
        new EncodedAudioChunk({ type: 'key', timestamp: c.timestamp - startUs, duration: c.duration, data: c.data }),
        aMeta,
      );
    }
  }

  const blob = muxer.finalize();
  if (err) throw err;
  return blob;
}
