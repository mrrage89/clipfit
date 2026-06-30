import { it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

it('reports encode caps from VideoEncoder.isConfigSupported', async () => {
  vi.stubGlobal('VideoEncoder', {
    isConfigSupported: vi.fn(async (c: { codec: string }) => ({
      supported: c.codec.startsWith('vp09') || c.codec.startsWith('av01'),
    })),
  });
  const { webcodecsCaps } = await import('../src/engine/webcodecs/caps');
  const caps = await webcodecsCaps();
  expect(caps).toEqual({ encodeAvc: false, encodeVp9: true, encodeAv1: true });
});

it('returns all-false when VideoEncoder is undefined', async () => {
  vi.stubGlobal('VideoEncoder', undefined);
  const { webcodecsCaps } = await import('../src/engine/webcodecs/caps');
  expect(await webcodecsCaps()).toEqual({ encodeAvc: false, encodeVp9: false, encodeAv1: false });
});
