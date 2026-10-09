import type { Bitmap } from "./raster.ts";
import type { PrintSettings } from "./settings.ts";
import { mmToDots } from "./units.ts";
import { validateSettings } from "./validate.ts";

export interface Job {
  readonly settings: PrintSettings;
  /** One bitmap per label. Each must already have the label size in dots. */
  readonly pages: readonly Bitmap[];
  /** Copies of each page. */
  readonly copies: number;
}

const CRLF = "\r\n";

/** One-way commands that change printer state or move media. */
export const CONTROLS = {
  calibrate: `~S,SENSOR${CRLF}`,
  feed: `~S,FEED${CRLF}`,
  cancel: `~S,CANCEL${CRLF}`,
  "self-test": `~V${CRLF}`,
  /** Restarts the printer like a power cycle and drops any half-received job from its buffer. */
  reset: `~Z${CRLF}`,
} as const;
export type Control = keyof typeof CONTROLS;

/** Commands that make the printer answer. Answers only arrive over TCP. */
export const QUERIES = {
  status: `^XSET,IMMEDIATE,1${CRLF}~S,STATUS${CRLF}`,
  config: `^XGET,CONFIG${CRLF}`,
  version: `~B${CRLF}`,
} as const;
export type Query = keyof typeof QUERIES;

export const encodeText = (s: string): Uint8Array => new TextEncoder().encode(s);

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
  if (s.lengthMm !== undefined && s.sensing !== undefined) {
    const len = mmOneDecimal(s.lengthMm);
    const sensing = s.sensing;
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
    out.push(`~Q${dots >= 0 ? "+" : ""}${dots}`);
  }
  if (s.stopPositionMm !== undefined) out.push(`^E${mmOneDecimal(s.stopPositionMm)}`);
  return out;
}

const lines = (l: readonly string[]) => l.map((x) => x + CRLF).join("");

/** Validates the settings and encodes a complete print job: setup commands and one label format per page. */
export function encodeJob(job: Job): Uint8Array {
  validateSettings(job.settings, job.copies);
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

/** Validates the settings and encodes them without a label. The printer stores them. */
export function encodeSettings(settings: PrintSettings): Uint8Array {
  validateSettings(settings);
  return encodeText(lines([...persistentConfigLines(settings), ...formatLines(settings)]));
}

/** Extracts the bitmaps of an encoded job. Used for previews and round-trip checks. */
export function decodeGraphics(data: Uint8Array): Bitmap[] {
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

/** ~S,CHECK / ~S,STATUS codes. Source: EZPL Programmer's Manual Rev. O.4 p.80; the driver maps the same codes. */
const STATUS_CODES: Readonly<Record<string, string>> = {
  "00": "Ready",
  "01": "Media empty or media jam",
  "02": "Media jam",
  "03": "Ribbon empty",
  "04": "Print head open",
  "05": "Rewinder full",
  "06": "File system full",
  "07": "Filename not found",
  "08": "Duplicate name",
  "09": "Syntax error",
  "10": "Cutter jam",
  "11": "Extended memory not found",
  "13": "Waiting for label removal (peel)",
  "20": "Pause",
  "21": "Setting mode",
  "22": "Keyboard mode",
  "50": "Printing",
  "60": "Data in process",
  "62": "Print head overheat",
};

export function describeReply(query: Query, reply: string): string {
  const text = reply.trim();
  if (query === "status") {
    const m = /(\d{2}),(\d{5})\s*$/.exec(text);
    if (m)
      return `${text}\nStatus ${m[1]}: ${STATUS_CODES[m[1]!] ?? "unknown code"}, ${Number(m[2])} labels left in job`;
  }
  return text;
}
