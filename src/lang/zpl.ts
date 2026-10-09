import type { Bitmap } from "../raster.ts";
import type { PrintSettings } from "../settings.ts";
import { mmToDots } from "../units.ts";
import { type Dialect, encodeText, type Job } from "./types.ts";

const CRLF = "\r\n";

export const linearGuessZplDarkness = (godex: number): number => Math.round((godex * 30) / 19);

function setupFormat(s: PrintSettings, persist: boolean): string {
  const out: string[] = ["^XA"];
  if (s.mirror !== undefined) out.push(`^PM${s.mirror ? "Y" : "N"}`);
  if (s.widthMm !== undefined) out.push(`^PW${mmToDots(s.widthMm)}`);
  if (s.method !== undefined) out.push(`^MT${s.method === "thermal-transfer" ? "T" : "D"}`);
  if (s.sensing !== undefined) out.push(`^MN${{ gap: "W", "black-mark": "M", continuous: "N" }[s.sensing.kind]}`);
  if (s.lengthMm !== undefined) out.push(`^LL${mmToDots(s.lengthMm)}`);
  if (s.homeYMm !== undefined) out.push(`^LT${mmToDots(s.homeYMm)}`);
  if (s.postPrint !== undefined)
    out.push(`^MM${s.postPrint.kind === "peel" ? "P" : s.postPrint.kind === "tear" ? "T" : "C"}`);
  if (s.darkness !== undefined) out.push(`~SD${String(linearGuessZplDarkness(s.darkness)).padStart(2, "0")}^MD0`);
  if (s.speedIps !== undefined) out.push(`^PR${s.speedIps}`);
  if (s.homeXMm !== undefined) out.push(`^LH${mmToDots(s.homeXMm)},0`);
  if (persist) out.push("^JUS");
  out.push("^XZ");
  return out.length > 2 ? out.join(CRLF) + CRLF : "";
}

const hex = (b: Bitmap) => Buffer.from(b.data).toString("hex").toUpperCase();

function inverseBox(s: PrintSettings, b: Bitmap): string {
  return s.inverse ? `^LRY^FO0,0^GB${b.width},${b.height},${Math.max(b.width, b.height)}^FS^LRN${CRLF}` : "";
}

type CutPlan = { readonly kind: "same-for-every-label" } | { readonly kind: "per-label"; readonly cutAfter: boolean[] };

function cutPlan(job: Job): CutPlan {
  const p = job.settings.postPrint;
  if ((p?.kind !== "cut" && p?.kind !== "batch-cut") || (p.kind === "cut" && p.every === 1))
    return { kind: "same-for-every-label" };
  const total = job.pages.length * job.copies;
  const cutAfter = Array.from(
    { length: total },
    (_, i) => (p.kind === "cut" ? (i + 1) % p.every === 0 : false) || i === total - 1,
  );
  return { kind: "per-label", cutAfter };
}

function encodeJob(job: Job): Uint8Array {
  const s = job.settings;
  const plan = cutPlan(job);
  let out = setupFormat(s, false);
  if (plan.kind === "same-for-every-label") {
    for (const page of job.pages) {
      out += `^XA${CRLF}^FO0,0^GFA,${page.data.length},${page.data.length},${page.bytesPerRow},${hex(page)}^FS${CRLF}`;
      out += `${inverseBox(s, page)}^PQ${job.copies},0,1,Y${CRLF}^XZ${CRLF}`;
    }
    return encodeText(out);
  }
  job.pages.forEach((page, i) => {
    out += `~DGR:BP${i}.GRF,${page.data.length},${page.bytesPerRow},${hex(page)}${CRLF}`;
  });
  let label = 0;
  job.pages.forEach((page, i) => {
    for (let c = 0; c < job.copies; c++, label++) {
      out += `^XA^MM${plan.cutAfter[label] ? "C" : "T"}${CRLF}^FO0,0^XGR:BP${i}.GRF,1,1^FS${CRLF}`;
      out += `${inverseBox(s, page)}^PQ1,0,1,Y${CRLF}^XZ${CRLF}`;
    }
  });
  out += `^XA^IDR:BP*.GRF^XZ${CRLF}`;
  return encodeText(out);
}

function decodeGraphics(data: Uint8Array): Bitmap[] {
  const text = new TextDecoder("latin1").decode(data);
  const toBitmap = (bytesPerRow: number, total: number, h: string): Bitmap => ({
    width: bytesPerRow * 8,
    height: total / bytesPerRow,
    bytesPerRow,
    data: new Uint8Array(Buffer.from(h, "hex")),
  });
  const out: Bitmap[] = [];
  for (const m of text.matchAll(/\^GFA,(\d+),\d+,(\d+),([0-9A-Fa-f]+)/g))
    out.push(toBitmap(Number(m[2]), Number(m[1]), m[3]!));
  for (const m of text.matchAll(/~DG[^,]+,(\d+),(\d+),([0-9A-Fa-f]+)/g))
    out.push(toBitmap(Number(m[2]), Number(m[1]), m[3]!));
  return out;
}

export const zpl: Dialect = {
  language: "zpl",
  encodeJob,
  encodeSettings: (s, persist) => encodeText(setupFormat(s, persist)),
  controls: {
    calibrate: "~JC\r\n",
    feed: "~PH\r\n",
    cancel: "~JA\r\n",
    reset: "~JR\r\n",
    "factory-reset": "^XA^JUF^XZ\r\n",
    "self-test": "~WC\r\n",
  },
  queries: {
    status: "~HS\r\n",
    config: "^XA^HH^XZ\r\n",
    version: "~HI\r\n",
  },
  unsupported: ["sensor", "stopPositionMm"],
  decodeGraphics,
};
