import { useEffect, useMemo, useState } from 'react';
import { extractFrame } from '../engine/ffmpegEngine';

// Preview of the selected source before processing. Tries a native <video>
// (instant, playable, local). If the browser can't decode the format — e.g.
// Linux Chromium has no H.264 — fall back to an ffmpeg-extracted poster frame,
// which works for any codec.
export function VideoPreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const [poster, setPoster] = useState<string | null>(null);
  const [status, setStatus] = useState<'video' | 'loading' | 'poster' | 'none'>('video');

  useEffect(() => {
    setStatus('video');
    setPoster(null);
  }, [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  useEffect(() => () => {
    if (poster) URL.revokeObjectURL(poster);
  }, [poster]);

  async function fallback() {
    setStatus('loading');
    try {
      const { url: p } = await extractFrame(file, 1);
      setPoster(p);
      setStatus('poster');
    } catch {
      setStatus('none');
    }
  }

  const mediaStyle = {
    maxWidth: '100%',
    maxHeight: 360,
    borderRadius: 'var(--radius)',
    display: 'block',
    margin: '0 auto',
  } as const;

  if (status === 'video') {
    return (
      <div>
        <video src={url} controls preload="metadata" onError={fallback} style={mediaStyle} />
      </div>
    );
  }
  if (status === 'loading') {
    return <p className="muted" style={{ fontSize: 13 }}>Loading preview…</p>;
  }
  if (status === 'poster' && poster) {
    return (
      <div>
        <img src={poster} alt="preview frame" style={mediaStyle} />
        <p className="muted" style={{ fontSize: 12, marginTop: 4, textAlign: 'center' }}>
          Preview frame — your browser can't play this format inline, but it'll still process fine.
        </p>
      </div>
    );
  }
  return (
    <p className="muted" style={{ fontSize: 13 }}>
      Preview unavailable for this format — it'll still process fine.
    </p>
  );
}
