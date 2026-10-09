#!/usr/bin/env bun
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import {
  type Control,
  DEFAULT_IMAGE_OPTIONS,
  DEFAULT_LANGUAGE,
  DEFAULT_QUEUE,
  DEFAULT_TCP_PORT,
  DIALECTS,
  type Dither,
  encodeJob,
  encodeSettings,
  exchange,
  type ImageOptions,
  type Language,
  type MediaSensing,
  mmToDots,
  type PostPrint,
  type PrintSettings,
  parsePageRange,
  type Query,
  queueSetupCommands,
  type Rotation,
  renderLabels,
  send,
  type Transport,
  validateSettings,
} from "./index.ts";
import { LANGUAGE_SWITCH } from "./lang/ezpl.ts";
import { describeReply } from "./lang/replies.ts";
import { encodeText } from "./lang/types.ts";
import { bitmapToPng } from "./preview.ts";
import { describe, MACOS_GENERIC_PPD } from "./transport.ts";

const HELP = `bp730i: driverless printing for the Labelident BP730i (Godex RT730i)

Usage:
  bp730i print <file.pdf|png|jpg> [options]   Print a PDF (all pages or --pages) or an image
  bp730i settings [options] [--save]          Send media and print settings only
  bp730i calibrate | feed | cancel | self-test
  bp730i reset [--factory]                    Restart the printer (--factory: factory defaults)
  bp730i language <ezpl|zpl|auto>             Force or release the command language
  bp730i status | config | version            Ask the printer (needs --host, TCP 9100)
  bp730i raw <file|->                         Send a file of printer commands unchanged
  bp730i preview <job-file> [--out dir]       Decode a job file's graphics to PNG
  bp730i setup [--queue NAME] [--uri URI]     Create the raw CUPS queue (macOS)

Label and media (mm):
  --size WxL            Label width x length, e.g. 100x150 (required for print)
  --gap MM              Gap media with this gap (default media type, 3 mm)
  --mark MM             Black-mark media with this mark width
  --mark-offset MM      Mark to top-of-form distance; negative = inside the mark
                        (write negative values as --mark-offset=-2)
  --continuous [MM]     Continuous media, optional extra feed in mm
  --sensor TYPE         reflective | see-through | auto (EZPL only)
  --method TYPE         dt (direct thermal) | tt (thermal transfer)
  --darkness N          0..19 (Godex scale)
  --speed N             2..5 inches per second
  --mode MODE           tear | peel | cut | batch-cut
  --cut-every N         With --mode cut: cut after every N labels (default 1)
  --stop MM             Stop position after print, -40..40 (tear 12-16, cutter 28-30)
  --home-x MM           Printer left margin (EZPL ^R, ZPL ^LH)
  --home-y MM           Printer vertical offset (EZPL ~Q, ZPL ^LT)
  --mirror, --inverse   Mirror or invert the whole label

Image:
  --pages RANGE         PDF pages: 2, 2-4, 3- (default: all)
  --scale MODE          fit | fill | none (default fit)
  --rotate DEG          0 | 90 | 180 | 270
  --dither MODE         threshold | floyd-steinberg | ordered (default threshold)
  --threshold N         0..255, gray level that prints black below it (default 128)
  --offset-x MM, --offset-y MM   Move the image on the label
  --dpi N               PDF render resolution (default 300)
  --copies N            Copies of each page (default 1)

Output:
  --lang ezpl|zpl       Command language (default ${DEFAULT_LANGUAGE})
  --queue NAME          CUPS queue (default ${DEFAULT_QUEUE})
  --host HOST           Send over TCP instead of CUPS
  --port N              TCP port (default ${DEFAULT_TCP_PORT})
  --output FILE         Write the job to a file instead (- = stdout). Nothing is sent.
  --dry-run             Same as --output, to <name>.<lang> in the current directory
  --preview DIR         Also write one PNG per label as the printer will see it
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
  pages: { type: "string" },
  scale: { type: "string" },
  rotate: { type: "string" },
  dither: { type: "string" },
  threshold: { type: "string" },
  "offset-x": { type: "string" },
  "offset-y": { type: "string" },
  dpi: { type: "string" },
  copies: { type: "string" },
  lang: { type: "string" },
  queue: { type: "string" },
  host: { type: "string" },
  port: { type: "string" },
  output: { type: "string" },
  "dry-run": { type: "boolean" },
  preview: { type: "string" },
  out: { type: "string" },
  save: { type: "boolean" },
  factory: { type: "boolean" },
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

function oneOf<T extends string>(v: Values, key: keyof Values, allowed: readonly T[]): T | undefined {
  const raw = v[key];
  if (raw === undefined || typeof raw === "boolean") return undefined;
  if (!(allowed as readonly string[]).includes(raw))
    throw new UsageError(`--${key} must be one of ${allowed.join(", ")}, got "${raw}"`);
  return raw as T;
}

function parseSize(raw: string): { widthMm: number; lengthMm: number } {
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i.exec(raw.trim());
  if (!m) throw new UsageError(`--size expects WxL in mm, e.g. 100x150, got "${raw}"`);
  return { widthMm: Number(m[1]), lengthMm: Number(m[2]) };
}

function parseSensing(v: Values): MediaSensing | undefined {
  const given = [v.gap, v.mark, v.continuous].filter((x) => x !== undefined).length;
  if (given > 1) throw new UsageError("Use only one of --gap, --mark, --continuous");
  if (v.mark !== undefined)
    return { kind: "black-mark", markMm: number(v, "mark") ?? 0, offsetMm: number(v, "mark-offset") ?? 0 };
  if (v.continuous !== undefined) return { kind: "continuous", feedMm: number(v, "continuous") ?? 0 };
  if (v.gap !== undefined) return { kind: "gap", gapMm: number(v, "gap") ?? 3 };
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

function parseSettings(v: Values): PrintSettings {
  const s: { -readonly [K in keyof PrintSettings]?: PrintSettings[K] } = {};
  const set = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K] | undefined) => {
    if (value !== undefined) s[key] = value;
  };
  if (v.size !== undefined) {
    const size = parseSize(v.size);
    set("widthMm", size.widthMm);
    set("lengthMm", size.lengthMm);
  }
  const method = oneOf(v, "method", ["dt", "tt"] as const);
  set("sensing", parseSensing(v));
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

const ROTATIONS = { "0": 0, "90": 90, "180": 180, "270": 270 } as const satisfies Record<string, Rotation>;

function parseImage(v: Values): ImageOptions {
  return {
    scale: oneOf(v, "scale", ["fit", "fill", "none"] as const) ?? DEFAULT_IMAGE_OPTIONS.scale,
    rotate: ROTATIONS[oneOf(v, "rotate", ["0", "90", "180", "270"] as const) ?? "0"],
    dither: oneOf<Dither>(v, "dither", ["threshold", "floyd-steinberg", "ordered"]) ?? DEFAULT_IMAGE_OPTIONS.dither,
    threshold: number(v, "threshold") ?? DEFAULT_IMAGE_OPTIONS.threshold,
    offsetXDots: mmToDots(number(v, "offset-x") ?? 0),
    offsetYDots: mmToDots(number(v, "offset-y") ?? 0),
  } satisfies ImageOptions;
}

function transportFor(v: Values, defaultFile: string): Transport {
  if (v.output !== undefined) return { kind: "file", path: v.output };
  if (v["dry-run"]) return { kind: "file", path: defaultFile };
  if (v.host !== undefined) return { kind: "tcp", host: v.host, port: number(v, "port") ?? DEFAULT_TCP_PORT };
  return { kind: "cups", queue: v.queue ?? DEFAULT_QUEUE };
}

function warnUnsupported(lang: Language, settings: PrintSettings): void {
  for (const key of DIALECTS[lang].unsupported)
    if (settings[key] !== undefined)
      console.error(`Warning: ${lang.toUpperCase()} has no command for ${key}. Ignored.`);
}

async function deliver(t: Transport, data: Uint8Array, title: string): Promise<void> {
  await send(t, data, title);
  if (!(t.kind === "file" && t.path === "-")) console.error(`Sent ${data.length} bytes to ${describe(t)}`);
}

async function writePreviews(dir: string, stem: string, bitmaps: readonly import("./raster.ts").Bitmap[]) {
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
  const lang = oneOf<Language>(v, "lang", ["ezpl", "zpl"]) ?? DEFAULT_LANGUAGE;
  const dialect = DIALECTS[lang];

  switch (command) {
    case "print": {
      const file = args[0];
      if (!file) throw new UsageError("print needs a file");
      const settings = parseSettings(v);
      if (settings.widthMm === undefined || settings.lengthMm === undefined)
        throw new UsageError("print needs --size WxL (mm)");
      const copies = number(v, "copies") ?? 1;
      validateSettings(settings, copies);
      warnUnsupported(lang, settings);
      const pages = await renderLabels(
        file,
        { widthMm: settings.widthMm, lengthMm: settings.lengthMm },
        parseImage(v),
        { dpi: number(v, "dpi") ?? 300, ...(v.pages === undefined ? {} : { pages: parsePageRange(v.pages) }) },
      );
      const data = encodeJob(lang, { settings, pages, copies });
      const stem = basename(file).replace(/\.[^.]+$/, "");
      if (v.preview !== undefined) await writePreviews(v.preview, stem, dialect.decodeGraphics(data));
      await deliver(transportFor(v, `${stem}.${lang}`), data, basename(file));
      return;
    }
    case "settings": {
      const settings = parseSettings(v);
      if (Object.keys(settings).length === 0) throw new UsageError("settings needs at least one setting flag");
      warnUnsupported(lang, settings);
      await deliver(transportFor(v, `settings.${lang}`), encodeSettings(lang, settings, v.save ?? false), "settings");
      return;
    }
    case "calibrate":
    case "feed":
    case "cancel":
    case "self-test":
    case "reset": {
      const control: Control = command === "reset" && v.factory ? "factory-reset" : command;
      await deliver(transportFor(v, `${control}.${lang}`), encodeText(dialect.controls[control]), control);
      return;
    }
    case "language": {
      const target = args[0];
      if (target !== "ezpl" && target !== "zpl" && target !== "auto")
        throw new UsageError("language needs ezpl, zpl or auto");
      await deliver(transportFor(v, `language-${target}.ezpl`), encodeText(LANGUAGE_SWITCH[target]), "language");
      return;
    }
    case "status":
    case "config":
    case "version": {
      const query: Query = command;
      if (v.host === undefined)
        throw new UsageError(`${query} needs --host: answers only come back over TCP. CUPS (USB) is one-way.`);
      const t = { kind: "tcp", host: v.host, port: number(v, "port") ?? DEFAULT_TCP_PORT } as const;
      const reply = await exchange(t, encodeText(dialect.queries[query]), 1500);
      const text = new TextDecoder("latin1").decode(reply);
      if (text.length === 0) console.error("No answer within the timeout.");
      else console.log(describeReply(lang, query, text));
      return;
    }
    case "raw": {
      const file = args[0];
      if (!file) throw new UsageError("raw needs a file or -");
      const data = file === "-" ? await new Response(Bun.stdin.stream()).bytes() : await Bun.file(file).bytes();
      await deliver(transportFor(v, "raw.out"), data, "raw");
      return;
    }
    case "preview": {
      const file = args[0];
      if (!file) throw new UsageError("preview needs a job file");
      const data = await Bun.file(file).bytes();
      const head = new TextDecoder("latin1").decode(data.subarray(0, 64 * 1024));
      const detected: Language = /\^XA/.test(head) ? "zpl" : "ezpl";
      const bitmaps = DIALECTS[detected].decodeGraphics(data);
      if (bitmaps.length === 0) throw new Error(`No graphics found in ${file}`);
      await writePreviews(v.out ?? ".", basename(file).replace(/\.[^.]+$/, ""), bitmaps);
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
  process.exit(e instanceof UsageError || (e as { code?: string }).code?.startsWith("ERR_PARSE_ARGS") ? 2 : 1);
}
