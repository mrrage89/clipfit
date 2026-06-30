import { compressFast } from './engine/webcodecs/compress';
import { demuxMp4 } from './engine/webcodecs/demux';

(window as any).__compress = compressFast;
(window as any).__probe = async (blob: Blob) => {
  const d = await demuxMp4(new File([blob], 'out.mp4'));
  return {
    hasAudio: !!d.audio,
    audioCodec: d.audio?.codec ?? null,
    audioChunks: d.audio?.chunks.length ?? 0,
  };
};
(window as any).__validate = (blob: Blob) =>
  new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () =>
      resolve({ w: v.videoWidth, h: v.videoHeight, dur: Math.round(v.duration * 100) / 100 });
    v.onerror = () => reject(new Error('output video failed to load'));
    v.src = URL.createObjectURL(blob);
  });

const f = document.getElementById('f') as HTMLInputElement;
const out = document.getElementById('out')!;
f.addEventListener('change', () => {
  (window as any).__file = f.files?.[0] ?? null;
  out.textContent = 'file ready: ' + (f.files?.[0]?.name ?? 'none');
});
