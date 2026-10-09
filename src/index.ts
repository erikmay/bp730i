import { type Bitmap, type RasterOptions, rasterize } from "./raster.ts";
import { loadPages, type PageRange } from "./render.ts";
import { MAX_PRINT_WIDTH_DOTS, mmToDots } from "./units.ts";

export type { Control, Job, Query } from "./ezpl.ts";
export { CONTROLS, decodeGraphics, describeReply, encodeJob, encodeSettings, QUERIES } from "./ezpl.ts";
export type { Bitmap, Dither, GrayImage, RasterOptions, Rotation, ScaleMode } from "./raster.ts";
export { rasterize } from "./raster.ts";
export type { PageRange } from "./render.ts";
export { loadPages, parsePageRange } from "./render.ts";
export type { MediaSensing, PostPrint, PrintMethod, PrintSettings, SensorType } from "./settings.ts";
export type { Transport } from "./transport.ts";
export { DEFAULT_QUEUE, DEFAULT_TCP_PORT, exchange, send } from "./transport.ts";
export { DPI, mmToDots } from "./units.ts";
export { LIMITS, SettingsError, validateSettings } from "./validate.ts";

export type ImageOptions = Omit<RasterOptions, "widthDots" | "heightDots">;

export const DEFAULT_IMAGE_OPTIONS: ImageOptions = {
  scale: "fit",
  rotate: "auto",
  dither: "threshold",
  threshold: 128,
  offsetXDots: 0,
  offsetYDots: 0,
};

export interface LabelSize {
  readonly widthMm: number;
  readonly lengthMm: number;
}

/** Loads a PDF, PNG or JPEG and turns each page into a label-sized bitmap. */
export async function renderLabels(
  path: string,
  size: LabelSize,
  image: ImageOptions = DEFAULT_IMAGE_OPTIONS,
  pages?: PageRange,
): Promise<Bitmap[]> {
  const widthDots = Math.min(mmToDots(size.widthMm), MAX_PRINT_WIDTH_DOTS);
  const heightDots = mmToDots(size.lengthMm);
  const images = await loadPages(path, pages);
  return images.map((p) => rasterize(p, { ...image, widthDots, heightDots }));
}
