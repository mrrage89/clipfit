export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Map a crop rectangle from displayed-image pixels to source pixels: scale by
// source/display ratio, clamp inside the source, and round to even dimensions
// (yuv420p / libx264 require even width & height).
export function mapCropToSource(
  rect: Rect,
  displayW: number,
  displayH: number,
  srcW: number,
  srcH: number,
): Rect {
  const sx = srcW / displayW;
  const sy = srcH / displayH;
  let x = Math.round(rect.x * sx);
  let y = Math.round(rect.y * sy);
  let w = Math.round(rect.w * sx);
  let h = Math.round(rect.h * sy);

  x = Math.max(0, Math.min(x, srcW - 2));
  y = Math.max(0, Math.min(y, srcH - 2));
  w = Math.max(2, Math.min(w, srcW - x));
  h = Math.max(2, Math.min(h, srcH - y));

  w -= w % 2;
  h -= h % 2;
  return { x, y, w: Math.max(2, w), h: Math.max(2, h) };
}
