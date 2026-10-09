import { describe, expect, test } from "bun:test";
import { CONTROLS, decodeGraphics, encodeJob, encodeSettings, type PrintSettings, QUERIES } from "../src/index.ts";
import type { Bitmap } from "../src/raster.ts";
import { COMMANDS } from "../src/reference.ts";

const blank = (width: number, height: number): Bitmap => {
  const bytesPerRow = Math.ceil(width / 8);
  return { width, height, bytesPerRow, data: new Uint8Array(bytesPerRow * height) };
};

/** "^Db" must not count as "^D": a lowercase letter after the token makes it a different command. */
const startsWithWholeToken = (piece: string, token: string) =>
  piece.startsWith(token) && !/^[a-z]/.test(piece.slice(token.length));

const latin1 = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

describe("EZPL job", () => {
  test("matches the Windows driver's command sequence for a 100 x 150 mm tear-off job", () => {
    const settings: PrintSettings = {
      widthMm: 100,
      lengthMm: 150,
      sensing: { kind: "gap", gapMm: 2 },
      darkness: 10,
      speedIps: 4,
      method: "direct-thermal",
      postPrint: { kind: "tear" },
    };
    const out = latin1(encodeJob({ settings, pages: [blank(1181, 1772)], copies: 1 }));
    const header = "^AD\r\n^O0\r\n^D0\r\n^S4\r\n^H10\r\n^C1\r\n^P1\r\n^Q150.0,2.0\r\n^W100\r\n^L\r\nQ0,0,148,1772\r";
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
    const out = latin1(encodeSettings(settings));
    expect(out).toBe("^O0\r\n^D5\r\n^Q50.0,3.0,2.0-\r\n~Q-6\r\n^E28.0\r\n");
  });
});

describe("EZPL output", () => {
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
    const tokens = COMMANDS.map((c) => c.token);
    const text = [
      latin1(encodeJob({ settings, pages: [blank(16, 2)], copies: 2 })),
      latin1(encodeSettings(settings)),
      ...Object.values(CONTROLS),
      ...Object.values(QUERIES),
    ].join("\r\n");
    const pieces = text.split(/[\r\n]+/).filter((l) => l !== "" && !/^\0+$/.test(l));
    const unknown = pieces.filter((p) => !tokens.some((t) => startsWithWholeToken(p, t)));
    expect(unknown).toEqual([]);
  });

  test("sends no ^Q without a media type, so the stored gap stays", () => {
    expect(latin1(encodeSettings({ widthMm: 100, lengthMm: 150 }))).toBe("^W100\r\n");
  });

  test("decodes back to the same raster", () => {
    const page = blank(24, 3);
    page.data.set([0x80, 0x01, 0xff, 0x0f, 0xf0, 0x00, 0xaa, 0x55, 0x81]);
    const [decoded] = decodeGraphics(encodeJob({ settings: {}, pages: [page], copies: 1 }));
    expect(decoded?.data).toEqual(page.data);
  });
});
