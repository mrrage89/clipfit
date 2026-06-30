import * as MP4Box from 'mp4box';

export interface DemuxedChunk {
  type: 'key' | 'delta';
  timestamp: number; // microseconds
  duration: number; // microseconds
  data: Uint8Array;
}

export interface DemuxResult {
  video: {
    codec: string; // WebCodecs codec string (e.g. 'avc1.640028')
    width: number;
    height: number;
    fps: number;
    durationSec: number;
    description: Uint8Array; // avcC/hvcC/... for VideoDecoder.configure
    chunks: DemuxedChunk[];
  };
  audio: {
    codec: string; // e.g. 'mp4a.40.2'
    sampleRate: number;
    channels: number;
    description?: Uint8Array; // AudioSpecificConfig (AAC)
    chunks: DemuxedChunk[];
  } | null;
}

function boxBytes(box: any): Uint8Array {
  const s = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
  box.write(s);
  return new Uint8Array(s.buffer, 8); // strip the 8-byte box header
}

function videoDescription(file: any, trackId: number): Uint8Array {
  const trak = file.getTrackById(trackId);
  for (const entry of trak.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC ?? entry.hvcC ?? entry.vpcC ?? entry.av1C;
    if (box) return boxBytes(box);
  }
  throw new Error('no video codec description box found');
}

function audioDescription(file: any, trackId: number): Uint8Array | undefined {
  const trak = file.getTrackById(trackId);
  for (const entry of trak.mdia.minf.stbl.stsd.entries) {
    const dsi = entry.esds?.esd?.descs?.[0]?.descs?.[0];
    if (dsi?.data) return new Uint8Array(dsi.data);
  }
  return undefined;
}

function toChunks(samples: any[]): DemuxedChunk[] {
  return samples.map((s) => ({
    type: s.is_sync ? 'key' : 'delta',
    timestamp: (s.cts / s.timescale) * 1e6,
    duration: (s.duration / s.timescale) * 1e6,
    data: s.data as Uint8Array,
  }));
}

export async function demuxMp4(file: File): Promise<DemuxResult> {
  const mp4 = MP4Box.createFile();
  const vChunks: DemuxedChunk[] = [];
  const aChunks: DemuxedChunk[] = [];
  let vt: any = null;
  let at: any = null;
  let vDesc: Uint8Array | null = null;
  let aDesc: Uint8Array | undefined;
  let vTotal = 0;
  let aTotal = 0;

  const done = new Promise<void>((resolve, reject) => {
    mp4.onError = (e: string) => reject(new Error('mp4box: ' + e));
    mp4.onReady = (info: any) => {
      vt = info.videoTracks[0];
      at = info.audioTracks?.[0] ?? null;
      if (!vt) {
        reject(new Error('no video track'));
        return;
      }
      vDesc = videoDescription(mp4, vt.id);
      vTotal = vt.nb_samples;
      // Extraction options MUST be set inside onReady, before mp4box finishes the mdat.
      mp4.setExtractionOptions(vt.id, null, { nbSamples: vTotal });
      if (at) {
        aDesc = audioDescription(mp4, at.id);
        aTotal = at.nb_samples;
        mp4.setExtractionOptions(at.id, null, { nbSamples: aTotal });
      }
      mp4.start();
    };
    mp4.onSamples = (id: number, _user: any, samples: any[]) => {
      if (vt && id === vt.id) vChunks.push(...toChunks(samples));
      else if (at && id === at.id) aChunks.push(...toChunks(samples));
      if (vChunks.length >= vTotal && (!at || aChunks.length >= aTotal)) resolve();
    };
  });

  const buf = (await file.arrayBuffer()) as any;
  buf.fileStart = 0;
  mp4.appendBuffer(buf);
  mp4.flush();
  await done;

  const durationSec = vt.duration / vt.timescale;
  return {
    video: {
      codec: vt.codec,
      width: vt.video.width,
      height: vt.video.height,
      fps: vt.nb_samples / durationSec,
      durationSec,
      description: vDesc!,
      chunks: vChunks,
    },
    audio: at
      ? {
          codec: at.codec,
          sampleRate: at.audio.sample_rate,
          channels: at.audio.channel_count,
          description: aDesc,
          chunks: aChunks,
        }
      : null,
  };
}
