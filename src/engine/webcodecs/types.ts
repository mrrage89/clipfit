export type EngineChoice = 'webcodecs' | 'ffmpeg';

export interface WebcodecsCaps {
  encodeAvc: boolean; // H.264 / avc1
  encodeVp9: boolean; // vp09
  encodeAv1: boolean; // av01
}

export interface CompressRouteInput {
  quality: 'balanced' | 'best';
  format: 'mp4' | 'webm';
  hasUnsupportedEdits: boolean; // crop/rotate/flip/speed/fps/volume present
  inputContainer: 'mp4' | 'other'; // mp4box-demuxable (mp4/mov/m4v) => 'mp4'
  inputDecodable: boolean; // VideoDecoder supports the input codec
  outputEncodable: boolean; // caps say the chosen output codec is encodable
  audioOk: boolean; // no audio || muted || copyable into the target container
}

export interface VideoMeta {
  codec: string; // WebCodecs codec string, e.g. 'avc1.640028'
  width: number;
  height: number;
  fps: number;
  durationSec: number;
}
