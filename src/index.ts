import { ezpl } from "./lang/ezpl.ts";
import type { Dialect, Job, Language } from "./lang/types.ts";
import { zpl } from "./lang/zpl.ts";
import { type Bitmap, type RasterOptions, rasterize } from "./raster.ts";
import { loadPages, type RenderOptions } from "./render.ts";
import type { PrintSettings } from "./settings.ts";
import { MAX_PRINT_WIDTH_DOTS, mmToDots } from "./units.ts";
import { validateSettings } from "./validate.ts";

export type { Control, Dialect, Job, Language, Query } from "./lang/types.ts";
export type { Bitmap, Dither, GrayImage, RasterOptions, Rotation, ScaleMode } from "./raster.ts";
export { rasterize } from "./raster.ts";
export type { PageRange, RenderOptions } from "./render.ts";
export { loadPages, parsePageRange } from "./render.ts";
export type { MediaSensing, PostPrint, PrintMethod, PrintSettings, SensorType } from "./settings.ts";
export type { Transport } from "./transport.ts";
export { DEFAULT_QUEUE, DEFAULT_TCP_PORT, exchange, queueSetupCommands, send } from "./transport.ts";
export { DPI, mmToDots } from "./units.ts";
export { LIMITS, validateSettings } from "./validate.ts";

export const DIALECTS: Readonly<Record<Language, Dialect>> = { ezpl, zpl };

export const DEFAULT_LANGUAGE: Language = "ezpl";

export type ImageOptions = Omit<RasterOptions, "widthDots" | "heightDots">;

export const DEFAULT_IMAGE_OPTIONS: ImageOptions = {
  scale: "fit",
  rotate: 0,
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
  render: RenderOptions = { dpi: 300 },
): Promise<Bitmap[]> {
  const widthDots = Math.min(mmToDots(size.widthMm), MAX_PRINT_WIDTH_DOTS);
  const heightDots = mmToDots(size.lengthMm);
  const pages = await loadPages(path, render);
  return pages.map((p) => rasterize(p, { ...image, widthDots, heightDots }));
}

/** Validates the settings and encodes a complete print job. */
export function encodeJob(language: Language, job: Job): Uint8Array {
  validateSettings(job.settings, job.copies);
  return DIALECTS[language].encodeJob(job);
}

export function encodeSettings(language: Language, settings: PrintSettings, persist: boolean): Uint8Array {
  validateSettings(settings);
  return DIALECTS[language].encodeSettings(settings, persist);
}
