import type { VideoMeta } from '../types';

export function probeVideo(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        durationSec: video.duration,
        sizeBytes: file.size,
        // Heuristic: assume audio is present; the user can choose "mute".
        // Precise per-track detection would require ffmpeg `-i` parsing.
        hasAudio: true,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this video. The format may be unsupported.'));
    };
    video.src = url;
  });
}
