// THROWAWAY spike (Task 1): prove demux -> decode -> encode -> mux end-to-end and
// measure speed vs ffmpeg. Deleted in Task 10. No trim/scale/audio yet.
import * as MP4Box from 'mp4box';
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from 'webm-muxer';

interface Chunk { type: 'key' | 'delta'; timestamp: number; duration: number; data: Uint8Array }

function getDescription(file: any, trackId: number): Uint8Array {
  const trak = file.getTrackById(trackId);
  for (const entry of trak.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC ?? entry.hvcC ?? entry.vpcC ?? entry.av1C;
    if (box) {
      const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
      box.write(stream);
      return new Uint8Array(stream.buffer, 8); // strip 8-byte box header
    }
  }
  throw new Error('no codec description box found');
}

async function demux(file: File) {
  const mp4 = MP4Box.createFile();
  const chunks: Chunk[] = [];
  let vt: any = null;
  let description: Uint8Array | null = null;
  let total = 0;
  const done = new Promise<void>((resolve, reject) => {
    mp4.onError = (e: string) => reject(new Error('mp4box: ' + e));
    mp4.onReady = (info: any) => {
      vt = info.videoTracks[0];
      if (!vt) { reject(new Error('no video track')); return; }
      description = getDescription(mp4, vt.id);
      total = vt.nb_samples;
      console.log('[spike] ready: codec', vt.codec, 'dims', vt.video.width, 'x', vt.video.height, 'samples', total);
      // Extraction options MUST be set inside onReady (before mp4box finishes
      // processing the mdat) or no samples are ever emitted.
      mp4.setExtractionOptions(vt.id, null, { nbSamples: total });
      mp4.start();
    };
    mp4.onSamples = (_id: number, _user: any, samples: any[]) => {
      for (const s of samples) {
        chunks.push({
          type: s.is_sync ? 'key' : 'delta',
          timestamp: (s.cts / s.timescale) * 1e6,
          duration: (s.duration / s.timescale) * 1e6,
          data: s.data,
        });
      }
      console.log('[spike] onSamples batch', samples.length, 'accum', chunks.length, '/', total);
      if (chunks.length >= total) resolve();
    };
  });
  const buf = (await file.arrayBuffer()) as any;
  buf.fileStart = 0;
  mp4.appendBuffer(buf);
  mp4.flush();
  await done;
  console.log('[spike] demux done, chunks', chunks.length);
  return { vt, description: description!, chunks };
}

export async function spike(
  file: File,
): Promise<{ ms: number; engine: string; frames: number; outBytes: number; width: number; height: number }> {
  const t0 = performance.now();
  const { vt, description, chunks } = await demux(file);
  const width: number = vt.video.width;
  const height: number = vt.video.height;
  const fps = vt.nb_samples / (vt.duration / vt.timescale);
  const bitrate = 1_500_000;

  const candidates = [
    { codec: 'avc1.640028', container: 'mp4' as const, muxCodec: 'avc' },
    { codec: 'vp09.00.10.08', container: 'webm' as const, muxCodec: 'V_VP9' },
    { codec: 'av01.0.04M.08', container: 'webm' as const, muxCodec: 'V_AV1' },
  ];
  let chosen: (typeof candidates)[number] | null = null;
  for (const c of candidates) {
    const res = await VideoEncoder.isConfigSupported({ codec: c.codec, width, height, bitrate });
    if (res.supported) { chosen = c; break; }
  }
  if (!chosen) throw new Error('no encodable codec on this browser');

  let target: any;
  let muxer: any;
  if (chosen.container === 'mp4') {
    target = new Mp4Target();
    muxer = new Mp4Muxer({
      target,
      video: { codec: chosen.muxCodec as 'avc', width, height },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });
  } else {
    target = new WebmTarget();
    muxer = new WebmMuxer({
      target,
      video: { codec: chosen.muxCodec as 'V_VP9', width, height, frameRate: fps },
      firstTimestampBehavior: 'offset',
    });
  }

  let encErr: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encErr = e as Error; },
  });
  encoder.configure({ codec: chosen.codec, width, height, bitrate, framerate: fps });
  console.log('[spike] encoder configured:', chosen.codec, '->', chosen.container);

  let frames = 0;
  const decoder = new VideoDecoder({
    output: (frame) => { encoder.encode(frame); frame.close(); frames++; },
    error: (e) => { encErr = e as Error; },
  });
  decoder.configure({ codec: vt.codec, description, codedWidth: width, codedHeight: height });

  for (const c of chunks) {
    decoder.decode(new EncodedVideoChunk({ type: c.type, timestamp: c.timestamp, duration: c.duration, data: c.data }));
  }
  console.log('[spike] queued', chunks.length, 'chunks to decoder');
  await decoder.flush();
  console.log('[spike] decoder flushed, frames', frames);
  await encoder.flush();
  console.log('[spike] encoder flushed');
  muxer.finalize();
  if (encErr) throw encErr;

  return {
    ms: Math.round(performance.now() - t0),
    engine: `${chosen.codec}/${chosen.container}`,
    frames,
    outBytes: (target.buffer as ArrayBuffer).byteLength,
    width,
    height,
  };
}
