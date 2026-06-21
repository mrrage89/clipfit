// Share a generated file via the Web Share API (e.g. "Share → Discord").
// Returns true if the share sheet was invoked; false if unsupported/cancelled so
// the caller can fall back to a normal download.
export function canShareFiles(blob: Blob, filename: string, mime: string): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [new File([blob], filename, { type: mime })] });
  } catch {
    return false;
  }
}

export async function shareFile(blob: Blob, filename: string, mime: string): Promise<boolean> {
  if (!canShareFiles(blob, filename, mime)) return false;
  try {
    await navigator.share({ files: [new File([blob], filename, { type: mime })], title: filename });
    return true;
  } catch {
    return false; // user cancelled or share failed
  }
}
