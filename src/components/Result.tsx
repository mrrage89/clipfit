import type { JobResult } from '../types';
import { humanizeBytes } from '../lib/format';
import { canShareFiles, shareFile } from '../lib/share';

export function Result({ result, onReset }: { result: JobResult; onReset: () => void }) {
  const url = URL.createObjectURL(result.blob);
  const canShare = canShareFiles(result.blob, result.downloadName, result.mime);
  const fits = result.targetBytes === undefined || result.outputBytes <= result.targetBytes;

  return (
    <div>
      {result.mime.startsWith('video/') && (
        <video src={url} controls style={{ maxWidth: '100%', borderRadius: 8 }} />
      )}
      {result.mime.startsWith('image/') && (
        <img src={url} alt="result" style={{ maxWidth: '100%', borderRadius: 8 }} />
      )}
      {result.mime.startsWith('audio/') && <audio src={url} controls />}

      <p>
        Output: {humanizeBytes(result.outputBytes)}
        {result.targetBytes !== undefined &&
          ` (target ${humanizeBytes(result.targetBytes)}) ` +
            (fits ? '✓ fits' : '⚠ over target — try a smaller preset or mute audio')}
      </p>

      <a href={url} download={result.downloadName}>
        <button className="primary">Download</button>
      </a>
      {canShare && (
        <button
          onClick={() => shareFile(result.blob, result.downloadName, result.mime)}
          style={{ marginLeft: 8 }}
        >
          Share
        </button>
      )}
      <button onClick={onReset} style={{ marginLeft: 8 }}>
        Start over
      </button>
    </div>
  );
}
