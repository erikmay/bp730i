import { init, type WrappedPdfiumModule } from "@embedpdf/pdfium";
// The PDFium build (Chrome's PDF engine) as WebAssembly. A file import keeps the path valid in a compiled binary.
import pdfiumWasm from "@embedpdf/pdfium/pdfium.wasm" with { type: "file" };
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

import type { GrayImage } from "./raster.ts";
import { DPI } from "./units.ts";

export interface PageRange {
  readonly first: number;
  /** Inclusive. Undefined means the last page. */
  readonly last?: number;
}

/** Parses "3", "2-5", "4-" into a page range. */
export function parsePageRange(spec: string): PageRange {
  const m = /^(\d+)(?:-(\d*))?$/.exec(spec.trim());
  if (!m) throw new Error(`Invalid page range "${spec}". Use N, N-M, or N-.`);
  const first = Number(m[1]);
  const last = m[2] === undefined ? first : m[2] === "" ? undefined : Number(m[2]);
  if (first < 1 || (last !== undefined && last < first)) throw new Error(`Invalid page range "${spec}".`);
  return last === undefined ? { first } : { first, last };
}

/** Loads a PDF, PNG or JPEG file as one grayscale image per page. PDFs render at the printer resolution. */
export async function loadPages(path: string, pages?: PageRange): Promise<GrayImage[]> {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`File not found: ${path}`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (kind === "pdf") return renderPdf(bytes, pages);
  if (pages && (pages.first !== 1 || (pages.last ?? 1) !== 1)) throw new Error("Page ranges apply only to PDF input.");
  return [kind === "png" ? decodePng(bytes) : decodeJpeg(bytes)];
}

function sniff(b: Uint8Array): "pdf" | "png" | "jpeg" {
  const starts = (...sig: number[]) => sig.every((x, i) => b[i] === x);
  if (starts(0x25, 0x50, 0x44, 0x46)) return "pdf";
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "png";
  if (starts(0xff, 0xd8)) return "jpeg";
  throw new Error("Unsupported input. Use PDF, PNG or JPEG.");
}

function flattenOnWhiteToGray(width: number, height: number, rgba: Uint8Array): GrayImage {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) {
    const r = rgba[i * 4]!;
    const g = rgba[i * 4 + 1]!;
    const b = rgba[i * 4 + 2]!;
    const a = rgba[i * 4 + 3]! / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    data[i] = Math.round(lum * a + 255 * (1 - a));
  }
  return { width, height, data };
}

function decodePng(bytes: Uint8Array): GrayImage {
  const png = PNG.sync.read(Buffer.from(bytes));
  return flattenOnWhiteToGray(png.width, png.height, png.data);
}

function decodeJpeg(bytes: Uint8Array): GrayImage {
  const img = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
  return flattenOnWhiteToGray(img.width, img.height, img.data);
}

const FPDFBITMAP_GRAY = 1;
const FPDF_ANNOT = 0x01;
const FPDF_PRINTING = 0x800;
const WHITE = 0xffffffff;

let pdfium: Promise<WrappedPdfiumModule> | undefined;

function loadPdfium(): Promise<WrappedPdfiumModule> {
  pdfium ??= (async () => {
    const module = await init({ wasmBinary: await Bun.file(pdfiumWasm).arrayBuffer() });
    module.PDFiumExt_Init();
    return module;
  })();
  return pdfium;
}

/** Renders PDF pages as 8-bit grayscale at the printer resolution, with annotations, in print mode. */
async function renderPdf(bytes: Uint8Array, pages?: PageRange): Promise<GrayImage[]> {
  const m = await loadPdfium();
  const memory = m.pdfium.wasmExports.malloc(bytes.length);
  m.pdfium.HEAPU8.set(bytes, memory);
  const doc = m.FPDF_LoadMemDocument(memory, bytes.length, "");
  try {
    if (doc === 0) throw new Error(`Cannot open the PDF (PDFium error ${m.FPDF_GetLastError()}).`);
    const count = m.FPDF_GetPageCount(doc);
    const first = pages?.first ?? 1;
    const last = Math.min(pages?.last ?? count, count);
    if (first > last) throw new Error(`No pages to print: the PDF has ${count} page(s). Check the page range.`);
    const images: GrayImage[] = [];
    for (let index = first - 1; index < last; index++) images.push(renderPage(m, doc, index));
    return images;
  } finally {
    if (doc !== 0) m.FPDF_CloseDocument(doc);
    m.pdfium.wasmExports.free(memory);
  }
}

function renderPage(m: WrappedPdfiumModule, doc: number, index: number): GrayImage {
  const page = m.FPDF_LoadPage(doc, index);
  if (page === 0) throw new Error(`Cannot load PDF page ${index + 1}.`);
  const width = Math.ceil((m.FPDF_GetPageWidthF(page) * DPI) / 72);
  const height = Math.ceil((m.FPDF_GetPageHeightF(page) * DPI) / 72);
  const bitmap = m.FPDFBitmap_CreateEx(width, height, FPDFBITMAP_GRAY, 0, 0);
  try {
    m.FPDFBitmap_FillRect(bitmap, 0, 0, width, height, WHITE);
    m.FPDF_RenderPageBitmap(bitmap, page, 0, 0, width, height, 0, FPDF_ANNOT | FPDF_PRINTING);
    const stride = m.FPDFBitmap_GetStride(bitmap);
    const buffer = m.FPDFBitmap_GetBuffer(bitmap);
    const data = new Uint8Array(width * height);
    for (let y = 0; y < height; y++)
      data.set(m.pdfium.HEAPU8.subarray(buffer + y * stride, buffer + y * stride + width), y * width);
    return { width, height, data };
  } finally {
    m.FPDFBitmap_Destroy(bitmap);
    m.FPDF_ClosePage(page);
  }
}
