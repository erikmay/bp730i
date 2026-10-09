import type { Bitmap } from "../raster.ts";
import type { PrintSettings } from "../settings.ts";
import { mmToDots } from "../units.ts";
import { type Dialect, encodeText, type Job } from "./types.ts";

const CRLF = "\r\n";

/** Rounds half away from zero on whole micrometres, like the driver (Measurement::MM10 via MulDiv). */
const mmOneDecimal = (mm: number): string =>
  (Math.sign(mm) * (Math.round(Math.round(Math.abs(mm) * 1000) / 100) / 10)).toFixed(1);

function persistentConfigLines(s: PrintSettings): string[] {
  const out: string[] = [];
  if (s.method !== undefined) out.push(s.method === "thermal-transfer" ? "^AT" : "^AD");
  if (s.postPrint !== undefined) {
    const p = s.postPrint;
    out.push(`^O${p.kind === "peel" ? 1 : 0}`);
    out.push(p.kind === "cut" ? `^D${p.every}` : p.kind === "batch-cut" ? "^Db" : "^D0");
  }
  if (s.speedIps !== undefined) out.push(`^S${s.speedIps}`);
  if (s.darkness !== undefined) out.push(`^H${s.darkness}`);
  if (s.sensor !== undefined) out.push(`^G${{ reflective: 0, "see-through": 1, auto: 2 }[s.sensor]}`);
  if (s.homeXMm !== undefined) out.push(`^R${mmToDots(s.homeXMm)}`);
  return out;
}

function formatLines(s: PrintSettings): string[] {
  const out: string[] = [];
  if (s.lengthMm !== undefined) {
    const len = mmOneDecimal(s.lengthMm);
    const sensing = s.sensing ?? { kind: "gap", gapMm: 3 };
    switch (sensing.kind) {
      case "gap":
        out.push(`^Q${len},${mmOneDecimal(sensing.gapMm)}`);
        break;
      case "black-mark": {
        const sign = sensing.offsetMm < 0 ? "-" : "+";
        out.push(`^Q${len},${mmOneDecimal(sensing.markMm)},${mmOneDecimal(Math.abs(sensing.offsetMm))}${sign}`);
        break;
      }
      case "continuous":
        out.push(`^Q${len},0,${mmOneDecimal(sensing.feedMm)}`);
        break;
    }
  }
  if (s.widthMm !== undefined) out.push(`^W${Math.round(s.widthMm)}`);
  if (s.homeYMm !== undefined) {
    const dots = mmToDots(s.homeYMm);
    out.push(`~Q${dots > 0 ? "+" : ""}${dots}`);
  }
  if (s.stopPositionMm !== undefined) out.push(`^E${mmOneDecimal(s.stopPositionMm)}`);
  return out;
}

const lines = (l: readonly string[]) => l.map((x) => x + CRLF).join("");

function encodeJob(job: Job): Uint8Array {
  const s = job.settings;
  const parts: Uint8Array[] = [encodeText(lines([...persistentConfigLines(s), "^C1"]))];
  const format = lines([`^P${job.copies}`, ...formatLines(s), `^L${s.mirror ? "M" : ""}${s.inverse ? "I" : ""}`]);
  for (const page of job.pages) {
    parts.push(encodeText(format));
    parts.push(encodeText(`Q0,0,${page.bytesPerRow},${page.height}\r`));
    parts.push(page.data);
    parts.push(encodeText(`${CRLF}E${CRLF}`));
  }
  return new Uint8Array(Bun.concatArrayBuffers(parts));
}

function decodeGraphics(data: Uint8Array): Bitmap[] {
  const out: Bitmap[] = [];
  const text = new TextDecoder("latin1").decode(data);
  const header = /(?:^|\r\n)Q(\d+),(\d+),(\d+),(\d+)[\r\n]/g;
  for (let m = header.exec(text); m; m = header.exec(text)) {
    const bytesPerRow = Number(m[3]);
    const height = Number(m[4]);
    const start = m.index + m[0].length;
    const length = bytesPerRow * height;
    out.push({ width: bytesPerRow * 8, height, bytesPerRow, data: data.slice(start, start + length) });
    header.lastIndex = start + length;
  }
  return out;
}

/**
 * EZPL command that fixes the command language or returns to auto-detection. The printer
 * accepts it in any mode while auto-detection is on (EZPL manual m.84; unverified).
 */
export const LANGUAGE_SWITCH = { ezpl: "~S,ESG\r\n", zpl: "~S,ESZ\r\n", auto: "~S,ESA\r\n" } as const;

export const ezpl: Dialect = {
  language: "ezpl",
  encodeJob,
  encodeSettings: (s) => encodeText(lines([...persistentConfigLines(s), ...formatLines(s)])),
  controls: {
    calibrate: "~S,SENSOR\r\n",
    feed: "~S,FEED\r\n",
    cancel: "~S,CANCEL\r\n",
    reset: "~Z\r\n",
    "factory-reset": "^Z\r\n",
    "self-test": "~V\r\n",
  },
  queries: {
    status: "^XSET,IMMEDIATE,1\r\n~S,STATUS\r\n",
    config: "^XGET,CONFIG\r\n",
    version: "~B\r\n",
  },
  unsupported: [],
  decodeGraphics,
};
