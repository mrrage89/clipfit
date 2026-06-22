import { useEffect, useMemo, useState } from 'react';

// Playable preview of the selected source file, before any processing. Uses a
// native <video> (no engine load, file stays local). Some formats the browser
// can't decode (e.g. certain HEVC / mkv) — fall back to a quiet note in that case.
export function VideoPreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  if (failed) {
    return (
      <p className="muted" style={{ fontSize: 13 }}>
        Preview isn't available for this format in-browser — it'll still process fine.
      </p>
    );
  }

  return (
    <video
      src={url}
      controls
      preload="metadata"
      onError={() => setFailed(true)}
      style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 'var(--radius)', display: 'block' }}
    />
  );
}
