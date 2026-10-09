import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import type { GrayImage } from "./raster.ts";

export interface PageRange {
  readonly first: number;
  /** Inclusive. Undefined means the last page. */
  readonly last?: number;
}

export interface RenderOptions {
  /** Resolution for PDF rendering. The BP730i prints at 300 dpi. */
  readonly dpi: number;
  readonly pages?: PageRange;
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

/** Loads a PDF, PNG or JPEG file as one grayscale image per page. */
export async function loadPages(path: string, opts: RenderOptions): Promise<GrayImage[]> {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`File not found: ${path}`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (kind === "pdf") return renderPdf(path, opts);
  if (opts.pages && (opts.pages.first !== 1 || (opts.pages.last ?? 1) !== 1))
    throw new Error("Page ranges apply only to PDF input.");
  return [kind === "png" ? decodePng(bytes) : decodeJpeg(bytes)];
}

function sniff(b: Uint8Array): "pdf" | "png" | "jpeg" {
  const starts = (...sig: number[]) => sig.every((x, i) => b[i] === x);
  if (starts(0x25, 0x50, 0x44, 0x46)) return "pdf";
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "png";
  if (starts(0xff, 0xd8)) return "jpeg";
  throw new Error("Unsupported input. Use PDF, PNG or JPEG.");
}

/** Mixes RGBA onto white, then converts to luminance. */
function rgbaToGray(width: number, height: number, rgba: Uint8Array): GrayImage {
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
  return rgbaToGray(png.width, png.height, png.data);
}

function decodeJpeg(bytes: Uint8Array): GrayImage {
  const img = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
  return rgbaToGray(img.width, img.height, img.data);
}

async function renderPdf(path: string, opts: RenderOptions): Promise<GrayImage[]> {
  const args = ["pdftoppm", "-gray", "-r", String(opts.dpi)];
  if (opts.pages) {
    args.push("-f", String(opts.pages.first));
    if (opts.pages.last !== undefined) args.push("-l", String(opts.pages.last));
  }
  args.push(path);
  let proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
  try {
    proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  } catch {
    throw new Error("pdftoppm not found. Install poppler: brew install poppler");
  }
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).bytes(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`pdftoppm failed (${code}): ${err.trim()}`);
  const pages = parsePgmStream(out);
  if (pages.length === 0) throw new Error(`No pages rendered from ${path}. Check the page range.`);
  return pages;
}

/** Parses one or more concatenated binary PGM (P5, maxval 255) images. pdftoppm writes this to stdout. */
export function parsePgmStream(buf: Uint8Array): GrayImage[] {
  const pages: GrayImage[] = [];
  let pos = 0;
  const isSpace = (c: number) => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09;
  const token = (): string => {
    for (;;) {
      while (pos < buf.length && isSpace(buf[pos]!)) pos++;
      if (buf[pos] !== 0x23) break;
      while (pos < buf.length && buf[pos] !== 0x0a) pos++;
    }
    let t = "";
    while (pos < buf.length && !isSpace(buf[pos]!)) t += String.fromCharCode(buf[pos++]!);
    return t;
  };
  while (pos < buf.length) {
    const magic = token();
    if (magic === "") break;
    if (magic !== "P5") throw new Error(`Expected PGM P5, got ${magic}`);
    const width = Number(token());
    const height = Number(token());
    const maxval = Number(token());
    if (maxval !== 255) throw new Error(`Unsupported PGM maxval ${maxval}`);
    pos++;
    pages.push({ width, height, data: buf.slice(pos, pos + width * height) });
    pos += width * height;
  }
  return pages;
}
