export type Filter = "original" | "contrast" | "edges" | "negative";
export const FILTER_LABELS: Record<Filter, string> = {
  original: "원본 보기",
  contrast: "반사 강조",
  edges: "윤곽 강조",
  negative: "색상 반전",
};

/** Image enhancement only: these pixels cannot establish camera/HUD identity. */
export function applyFilter(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  filter: Filter,
  threshold = 215,
): void {
  if (filter === "original") return;
  if (filter === "edges") {
    const luminance = new Float32Array(width * height);
    for (let p = 0; p < luminance.length; p++)
      luminance[p] =
        data[p * 4]! * 0.299 +
        data[p * 4 + 1]! * 0.587 +
        data[p * 4 + 2]! * 0.114;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        const edge =
          x && y && x < width - 1 && y < height - 1
            ? Math.min(
                255,
                (Math.abs(luminance[p + 1]! - luminance[p - 1]!) +
                  Math.abs(luminance[p + width]! - luminance[p - width]!)) *
                  2,
              )
            : 0;
        data[p * 4] = edge * 0.4;
        data[p * 4 + 1] = edge;
        data[p * 4 + 2] = edge * 0.83;
      }
    return;
  }
  for (let i = 0; i < data.length; i += 4) {
    if (filter === "negative") {
      data[i] = 255 - data[i]!;
      data[i + 1] = 255 - data[i + 1]!;
      data[i + 2] = 255 - data[i + 2]!;
    } else {
      const lum =
        data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
      const bright = lum >= threshold;
      data[i] = bright ? 255 : lum * 0.36;
      data[i + 1] = bright ? 190 : lum * 0.44;
      data[i + 2] = bright ? 100 : lum * 0.46;
    }
  }
}
