import type { WebcodecsCaps } from './types';

let cached: Promise<WebcodecsCaps> | null = null;

async function canEncode(codec: string): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false;
  try {
    const res = await VideoEncoder.isConfigSupported({
      codec,
      width: 1280,
      height: 720,
      bitrate: 1_000_000,
      hardwareAcceleration: 'prefer-hardware',
    } as VideoEncoderConfig);
    return !!res.supported;
  } catch {
    return false;
  }
}

async function probe(): Promise<WebcodecsCaps> {
  const [encodeAvc, encodeVp9, encodeAv1] = await Promise.all([
    canEncode('avc1.42001f'),
    canEncode('vp09.00.10.08'),
    canEncode('av01.0.04M.08'),
  ]);
  return { encodeAvc, encodeVp9, encodeAv1 };
}

export function webcodecsCaps(): Promise<WebcodecsCaps> {
  if (!cached) cached = probe();
  return cached;
}

export async function canDecodeCodec(codec: string): Promise<boolean> {
  if (typeof VideoDecoder === 'undefined') return false;
  try {
    const res = await VideoDecoder.isConfigSupported({ codec } as VideoDecoderConfig);
    return !!res.supported;
  } catch {
    return false;
  }
}
