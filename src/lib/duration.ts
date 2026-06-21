// Parse the first "Duration: HH:MM:SS.ss" line from ffmpeg's log output into
// seconds. Returns null when no usable duration is present (e.g. "Duration: N/A").
export function parseDurationSec(logLines: string[]): number | null {
  for (const line of logLines) {
    const m = line.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
    if (m) {
      const total = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      return total > 0 ? total : null;
    }
  }
  return null;
}
