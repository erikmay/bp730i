#!/usr/bin/env bun
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import {
  CONTROLS,
  type Control,
  DEFAULT_IMAGE_OPTIONS,
  DEFAULT_QUEUE,
  DEFAULT_TCP_PORT,
  type Dither,
  decodeGraphics,
  describeReply,
  encodeJob,
  encodeSettings,
  encodeText,
  exchange,
  type ImageOptions,
  type LabelSize,
  type MediaSensing,
  mmToDots,
  type PageRange,
  type PostPrint,
  type PrintSettings,
  parsePageRange,
  QUERIES,
  type Query,
  type Rotation,
  renderLabels,
  SettingsError,
  send,
  type Transport,
  validateSettings,
} from "./index.ts";
import { bitmapToPng } from "./preview.ts";
import type { Bitmap } from "./raster.ts";
import { describe, MACOS_GENERIC_PPD, queueSetupCommands } from "./transport.ts";

/** The 100 x 150 mm shipping label roll with 2 mm gaps that this printer runs most of the time. */
const DEFAULT_SIZE: LabelSize = { widthMm: 100, lengthMm: 150 };
const DEFAULT_GAP_MM = 2;

const HELP = `bp730i: driverless printing for the Labelident BP730i (Godex RT730i)

Usage:
  bp730i print <file.pdf|png|jpg> [options]   Print a PDF (all pages or --pages) or an image
  bp730i settings [options]                   Send media and print settings only (the printer stores them)
  bp730i calibrate | feed | cancel | self-test | reset
  bp730i status | config | version            Ask the printer (needs --host, TCP 9100)
  bp730i raw <file|->                         Send a file of printer commands unchanged
  bp730i setup [--queue NAME] [--uri URI]     Create the raw CUPS queue (macOS)

All commands use EZPL. If the printer ignores every job (only the display reacts), it is
locked to another command language: switch it off and on. See "Language lock" in the README.
To stop a job, use "bp730i reset". Do not cancel a running job in CUPS: the printer keeps the
half-received image and prints the next job as garbage.

Label and media (mm):
  --size WxL            Label width x length (default ${DEFAULT_SIZE.widthMm}x${DEFAULT_SIZE.lengthMm} for print)
  --gap MM              Gap media with this gap (default media type, ${DEFAULT_GAP_MM} mm)
  --mark MM             Black-mark media with this mark width
  --mark-offset MM      Mark to top-of-form distance; negative = inside the mark
                        (write negative values as --mark-offset=-2)
  --continuous MM       Continuous media with this extra feed after each label (0 for none)
  --sensor TYPE         reflective | see-through | auto
  --method TYPE         dt (direct thermal) | tt (thermal transfer)
  --darkness N          0..19
  --speed N             2..5 inches per second
  --mode MODE           tear | peel | cut | batch-cut
  --cut-every N         With --mode cut: cut after every N labels (default 1)
  --stop MM             Stop position after print, 0..40 (tear 12-16, cutter 28-30)
  --home-x MM           Printer left margin (^R)
  --home-y MM           Printer vertical offset (~Q)
  --mirror, --inverse   Mirror or invert the whole label

Image:
  --pages RANGE         PDF pages: 2, 2-4, 3- (default: all)
  --scale MODE          fit | fill | none (default fit)
  --rotate DEG          auto | 0 | 90 | 180 | 270 (default auto: turn landscape pages
                        on a portrait label by 90 degrees, and the reverse)
  --dither MODE         threshold | floyd-steinberg | ordered (default threshold)
  --photo               For photos: stretch contrast, lighten midtones against dot gain,
                        and use ordered dithering unless --dither is given
  --threshold N         1..255, gray level that prints black below it (default 128)
  --offset-x MM, --offset-y MM   Move the image on the label
  --copies N            Copies of each page (default 1)

Output:
  --queue NAME          CUPS queue (default ${DEFAULT_QUEUE})
  --host HOST           Send over TCP instead of CUPS
  --port N              TCP port (default ${DEFAULT_TCP_PORT})
  --output FILE         Write the job to a file instead (- = stdout). Nothing is sent.
  --dry-run             Same as --output, to <name>.ezpl in the current directory
  --preview DIR         Also write one PNG per label, decoded from the job
`;

const OPTIONS = {
  size: { type: "string" },
  gap: { type: "string" },
  mark: { type: "string" },
  "mark-offset": { type: "string" },
  continuous: { type: "string" },
  sensor: { type: "string" },
  method: { type: "string" },
  darkness: { type: "string" },
  speed: { type: "string" },
  mode: { type: "string" },
  "cut-every": { type: "string" },
  stop: { type: "string" },
  "home-x": { type: "string" },
  "home-y": { type: "string" },
  mirror: { type: "boolean" },
  inverse: { type: "boolean" },
  photo: { type: "boolean" },
  pages: { type: "string" },
  scale: { type: "string" },
  rotate: { type: "string" },
  dither: { type: "string" },
  threshold: { type: "string" },
  "offset-x": { type: "string" },
  "offset-y": { type: "string" },
  copies: { type: "string" },
  queue: { type: "string" },
  host: { type: "string" },
  port: { type: "string" },
  output: { type: "string" },
  "dry-run": { type: "boolean" },
  preview: { type: "string" },
  uri: { type: "string" },
  ppd: { type: "string" },
  help: { type: "boolean", short: "h" },
} as const;

type Values = ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>["values"];

class UsageError extends Error {}

function number(v: Values, key: keyof Values): number | undefined {
  const raw = v[key];
  if (raw === undefined || typeof raw === "boolean") return undefined;
  const n = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(n)) throw new UsageError(`--${key} expects a number, got "${raw}"`);
  return n;
}

function numberIn(v: Values, key: keyof Values, min: number, max: number): number | undefined {
  const n = number(v, key);
  if (n !== undefined && (n < min || n > max))
    throw new UsageError(`--${key} must be between ${min} and ${max}, got ${n}`);
  return n;
}

function oneOf<T extends string>(v: Values, key: keyof Values, allowed: readonly T[]): T | undefined {
  const raw = v[key];
  if (raw === undefined || typeof raw === "boolean") return undefined;
  const match = allowed.find((a) => a === raw);
  if (match === undefined) throw new UsageError(`--${key} must be one of ${allowed.join(", ")}, got "${raw}"`);
  return match;
}

function parseSize(raw: string): LabelSize {
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i.exec(raw.trim());
  if (!m) throw new UsageError(`--size expects WxL in mm, e.g. 100x150, got "${raw}"`);
  return { widthMm: Number(m[1]), lengthMm: Number(m[2]) };
}

function parseSensing(v: Values): MediaSensing | undefined {
  const given = [v.gap, v.mark, v.continuous].filter((x) => x !== undefined).length;
  if (given > 1) throw new UsageError("Use only one of --gap, --mark, --continuous");
  if (v["mark-offset"] !== undefined && v.mark === undefined) throw new UsageError("--mark-offset needs --mark");
  if (v.mark !== undefined)
    return { kind: "black-mark", markMm: number(v, "mark") ?? 0, offsetMm: number(v, "mark-offset") ?? 0 };
  if (v.continuous !== undefined) return { kind: "continuous", feedMm: number(v, "continuous") ?? 0 };
  if (v.gap !== undefined) return { kind: "gap", gapMm: number(v, "gap") ?? DEFAULT_GAP_MM };
  return undefined;
}

function parsePostPrint(v: Values): PostPrint | undefined {
  const mode = oneOf(v, "mode", ["tear", "peel", "cut", "batch-cut"] as const);
  if (v["cut-every"] !== undefined && mode !== "cut") throw new UsageError("--cut-every needs --mode cut");
  switch (mode) {
    case undefined:
      return undefined;
    case "cut":
      return { kind: "cut", every: number(v, "cut-every") ?? 1 };
    default:
      return { kind: mode };
  }
}

function pageRangeOption(raw: string): PageRange {
  try {
    return parsePageRange(raw);
  } catch (e) {
    throw new UsageError(e instanceof Error ? e.message : String(e));
  }
}

/** A label size without a media flag means gap media with the default gap. */
function parseSettings(v: Values, size: LabelSize | undefined): PrintSettings {
  const s: { -readonly [K in keyof PrintSettings]?: PrintSettings[K] } = {};
  const set = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K] | undefined) => {
    if (value !== undefined) s[key] = value;
  };
  if (size !== undefined) {
    set("widthMm", size.widthMm);
    set("lengthMm", size.lengthMm);
  }
  const sensing = parseSensing(v);
  set("sensing", sensing ?? (size === undefined ? undefined : { kind: "gap", gapMm: DEFAULT_GAP_MM }));
  const method = oneOf(v, "method", ["dt", "tt"] as const);
  set("sensor", oneOf(v, "sensor", ["reflective", "see-through", "auto"] as const));
  set("method", method && (method === "tt" ? "thermal-transfer" : "direct-thermal"));
  set("darkness", number(v, "darkness"));
  set("speedIps", number(v, "speed"));
  set("postPrint", parsePostPrint(v));
  set("stopPositionMm", number(v, "stop"));
  set("homeXMm", number(v, "home-x"));
  set("homeYMm", number(v, "home-y"));
  set("mirror", v.mirror);
  set("inverse", v.inverse);
  return s;
}

const ROTATIONS = { auto: "auto", "0": 0, "90": 90, "180": 180, "270": 270 } as const satisfies Record<
  string,
  Rotation | "auto"
>;

function parseImage(v: Values): ImageOptions {
  return {
    scale: oneOf(v, "scale", ["fit", "fill", "none"] as const) ?? DEFAULT_IMAGE_OPTIONS.scale,
    rotate: ROTATIONS[oneOf(v, "rotate", ["auto", "0", "90", "180", "270"] as const) ?? "auto"],
    dither:
      oneOf<Dither>(v, "dither", ["threshold", "floyd-steinberg", "ordered"]) ??
      (v.photo ? "ordered" : DEFAULT_IMAGE_OPTIONS.dither),
    threshold: numberIn(v, "threshold", 1, 255) ?? DEFAULT_IMAGE_OPTIONS.threshold,
    offsetXDots: mmToDots(number(v, "offset-x") ?? 0),
    offsetYDots: mmToDots(number(v, "offset-y") ?? 0),
    photo: v.photo ?? false,
  } satisfies ImageOptions;
}

function tcpTarget(v: Values, host: string): Extract<Transport, { kind: "tcp" }> {
  return { kind: "tcp", host, port: numberIn(v, "port", 1, 65535) ?? DEFAULT_TCP_PORT };
}

function transportFor(v: Values, defaultFile: string): Transport {
  if (v.output !== undefined) return { kind: "file", path: v.output };
  if (v["dry-run"]) return { kind: "file", path: defaultFile };
  if (v.host !== undefined) return tcpTarget(v, v.host);
  return { kind: "cups", queue: v.queue ?? DEFAULT_QUEUE };
}

async function deliver(t: Transport, data: Uint8Array, title: string): Promise<void> {
  await send(t, data, title);
  if (!(t.kind === "file" && t.path === "-")) console.error(`Sent ${data.length} bytes to ${describe(t)}`);
}

async function writePreviews(dir: string, stem: string, bitmaps: readonly Bitmap[]) {
  await mkdir(dir, { recursive: true });
  for (const [i, bmp] of bitmaps.entries()) {
    const path = join(dir, `${stem}-${i + 1}.png`);
    await Bun.write(path, bitmapToPng(bmp));
    console.error(`Preview ${path} (${bmp.width}x${bmp.height} dots)`);
  }
}

async function main(argv: string[]): Promise<void> {
  const { values: v, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  const [command, ...args] = positionals;
  if (v.help || command === undefined || command === "help") {
    console.log(HELP);
    return;
  }
  if (args.length > 1) throw new UsageError(`Unexpected arguments: ${args.slice(1).join(" ")}`);

  switch (command) {
    case "print": {
      const file = args[0];
      if (!file) throw new UsageError("print needs a file");
      const size = v.size === undefined ? DEFAULT_SIZE : parseSize(v.size);
      const settings = parseSettings(v, size);
      const copies = number(v, "copies") ?? 1;
      validateSettings(settings, copies);
      const pageRange = v.pages === undefined ? undefined : pageRangeOption(v.pages);
      const pages = await renderLabels(file, size, parseImage(v), pageRange);
      const data = encodeJob({ settings, pages, copies });
      const stem = basename(file).replace(/\.[^.]+$/, "");
      if (v.preview !== undefined) await writePreviews(v.preview, stem, decodeGraphics(data));
      await deliver(transportFor(v, `${stem}.ezpl`), data, basename(file));
      return;
    }
    case "settings": {
      if (v.size === undefined && (v.gap ?? v.mark ?? v.continuous) !== undefined)
        throw new UsageError("--gap, --mark and --continuous need --size");
      if (v.mirror || v.inverse) throw new UsageError("--mirror and --inverse apply only to print");
      const settings = parseSettings(v, v.size === undefined ? undefined : parseSize(v.size));
      if (Object.keys(settings).length === 0) throw new UsageError("settings needs at least one setting flag");
      const data = encodeSettings(settings);
      await deliver(transportFor(v, "settings.ezpl"), data, "settings");
      return;
    }
    case "calibrate":
    case "feed":
    case "cancel":
    case "self-test":
    case "reset": {
      const control: Control = command;
      await deliver(transportFor(v, `${control}.ezpl`), encodeText(CONTROLS[control]), control);
      return;
    }
    case "status":
    case "config":
    case "version": {
      const query: Query = command;
      if (v.host === undefined)
        throw new UsageError(`${query} needs --host: answers only come back over TCP. CUPS (USB) is one-way.`);
      if (v.output !== undefined || v["dry-run"]) throw new UsageError(`${query} cannot write to a file`);
      const reply = await exchange(tcpTarget(v, v.host), encodeText(QUERIES[query]), 1500);
      const text = new TextDecoder("latin1").decode(reply);
      if (text.length === 0) console.error("No answer within the timeout.");
      else console.log(describeReply(query, text));
      return;
    }
    case "raw": {
      const file = args[0];
      if (!file) throw new UsageError("raw needs a file or -");
      const data = file === "-" ? await new Response(Bun.stdin.stream()).bytes() : await Bun.file(file).bytes();
      await deliver(transportFor(v, "raw.out"), data, "raw");
      return;
    }
    case "setup": {
      const cmds = await queueSetupCommands({
        queue: v.queue ?? DEFAULT_QUEUE,
        ppd: v.ppd ?? MACOS_GENERIC_PPD,
        ...(v.uri === undefined ? {} : { uri: v.uri }),
      });
      for (const cmd of cmds) {
        console.error(`$ ${cmd.join(" ")}`);
        if (v["dry-run"]) continue;
        const proc = Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit" });
        if ((await proc.exited) !== 0) throw new Error(`${cmd[0]} failed. Try again with sudo.`);
      }
      return;
    }
    default:
      throw new UsageError(`Unknown command "${command}". Run bp730i --help.`);
  }
}

try {
  await main(Bun.argv.slice(2));
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`bp730i: ${message}`);
  process.exit(
    e instanceof UsageError ||
      e instanceof SettingsError ||
      (e instanceof Error && "code" in e && String(e.code).startsWith("ERR_PARSE_ARGS"))
      ? 2
      : 1,
  );
}
