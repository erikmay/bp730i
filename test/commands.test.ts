import { describe, expect, test } from "bun:test";
import { DIALECTS, encodeJob, type Job, type Language, type PrintSettings } from "../src/index.ts";
import type { Bitmap } from "../src/raster.ts";
import { COMMANDS } from "../src/reference.ts";

const blank = (width: number, height: number): Bitmap => {
  const bytesPerRow = Math.ceil(width / 8);
  return { width, height, bytesPerRow, data: new Uint8Array(bytesPerRow * height) };
};

const latin1 = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

describe("EZPL", () => {
  test("matches the Windows driver's command sequence for a 100 x 150 mm tear-off job", () => {
    // Expected text from the decompiled driver (notes: sample job), with the raster removed.
    const settings: PrintSettings = {
      widthMm: 100,
      lengthMm: 150,
      sensing: { kind: "gap", gapMm: 3 },
      darkness: 10,
      speedIps: 4,
      method: "direct-thermal",
      postPrint: { kind: "tear" },
    };
    const out = latin1(encodeJob("ezpl", { settings, pages: [blank(1181, 1772)], copies: 1 }));
    const header = "^AD\r\n^O0\r\n^D0\r\n^S4\r\n^H10\r\n^C1\r\n^P1\r\n^Q150.0,3.0\r\n^W100\r\n^L\r\nQ0,0,148,1772\r";
    expect(out.startsWith(header)).toBe(true);
    expect(out.length).toBe(header.length + 148 * 1772 + "\r\nE\r\n".length);
    expect(out.endsWith("\r\nE\r\n")).toBe(true);
  });

  test("encodes black mark, cutter interval and offsets", () => {
    const settings: PrintSettings = {
      lengthMm: 50,
      sensing: { kind: "black-mark", markMm: 3, offsetMm: -2 },
      postPrint: { kind: "cut", every: 5 },
      homeYMm: -0.5,
      stopPositionMm: 28,
    };
    const out = latin1(DIALECTS.ezpl.encodeSettings(settings, false));
    expect(out).toBe("^O0\r\n^D5\r\n^Q50.0,3.0,2.0-\r\n~Q-6\r\n^E28.0\r\n");
  });
});

describe("ZPL", () => {
  test("puts settings in a leading format and the image in ^GFA", () => {
    const settings: PrintSettings = {
      widthMm: 100,
      lengthMm: 150,
      sensing: { kind: "gap", gapMm: 3 },
      method: "direct-thermal",
      postPrint: { kind: "tear" },
      darkness: 19,
      speedIps: 4,
    };
    const out = latin1(encodeJob("zpl", { settings, pages: [blank(1181, 1772)], copies: 2 }));
    expect(out.startsWith("^XA\r\n^PW1181\r\n^MTD\r\n^MNW\r\n^LL1772\r\n^MMT\r\n~SD30^MD0\r\n^PR4\r\n^XZ\r\n")).toBe(
      true,
    );
    expect(out).toContain("^XA\r\n^FO0,0^GFA,262256,262256,148,");
    expect(out.endsWith("^FS\r\n^PQ2,0,1,Y\r\n^XZ\r\n")).toBe(true);
  });

  test("cuts every second label and after the last one", () => {
    const job: Job = { settings: { postPrint: { kind: "cut", every: 2 } }, pages: [blank(8, 1)], copies: 3 };
    const modes = [...latin1(encodeJob("zpl", job)).matchAll(/\^XA\^MM([CT])/g)].map((m) => m[1]);
    expect(modes).toEqual(["T", "C", "C"]);
  });
});

describe.each(["ezpl", "zpl"] as const)("%s output", (language: Language) => {
  const settings: PrintSettings = {
    widthMm: 50,
    lengthMm: 30,
    sensing: { kind: "gap", gapMm: 2 },
    sensor: "auto",
    method: "thermal-transfer",
    darkness: 8,
    speedIps: 3,
    postPrint: { kind: "batch-cut" },
    stopPositionMm: 12,
    homeXMm: 1,
    homeYMm: 1,
    mirror: true,
    inverse: true,
  };

  test("uses only commands listed in the reference table", () => {
    const tokens = COMMANDS.filter((c) => c.language === language).map((c) => c.token);
    const d = DIALECTS[language];
    const text = [
      latin1(d.encodeJob({ settings, pages: [blank(16, 2)], copies: 2 })),
      latin1(d.encodeSettings(settings, true)),
      ...Object.values(d.controls),
      ...Object.values(d.queries),
    ].join("\r\n");
    const pieces =
      language === "zpl"
        ? text.split(/(?=[\^~])/).map((p) => p.trim())
        : text.split(/[\r\n]+/).filter((l) => l !== "" && !/^\0+$/.test(l));
    // A token matches when the piece starts with it and no lowercase letter follows (so ^Db is not ^D).
    const known = (p: string) => tokens.some((t) => p.startsWith(t) && !/^[a-z]/.test(p.slice(t.length)));
    const unknown = pieces.filter((p) => p !== "" && !known(p));
    expect(unknown).toEqual([]);
  });

  test("decodes back to the same raster", () => {
    const page = blank(24, 3);
    page.data.set([0x80, 0x01, 0xff, 0x0f, 0xf0, 0x00, 0xaa, 0x55, 0x81]);
    const [decoded] = DIALECTS[language].decodeGraphics(
      DIALECTS[language].encodeJob({ settings: {}, pages: [page], copies: 1 }),
    );
    expect(decoded?.data).toEqual(page.data);
  });
});
