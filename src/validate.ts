import type { PrintSettings } from "./settings.ts";
import { dotsToMm } from "./units.ts";

/**
 * Accepted ranges. Sources: GoLabel PrinterModel.xml <PrinterModel ID="BP730i"> (darkness 0-19,
 * speed 2-5, width 4-106 mm, height 3-762 mm), driver Model.d [Godex_RT730i], EZPL ^R/~Q limits.
 */
export const LIMITS = {
  widthMm: [4, 106],
  lengthMm: [3, 762],
  gapMm: [0, 30],
  markOffsetMm: [-30, 30],
  feedMm: [0, 100],
  darkness: [0, 19],
  speedIps: [2, 5],
  stopPositionMm: [0, 40],
  homeXMm: [0, dotsToMm(399)],
  homeYMm: [-dotsToMm(100), dotsToMm(100)],
  cutEvery: [1, 32767],
  copies: [1, 9999],
} as const satisfies Record<string, readonly [number, number]>;

function check(errors: string[], name: keyof typeof LIMITS, value: number | undefined, integer = false): void {
  if (value === undefined) return;
  const [min, max] = LIMITS[name];
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    errors.push(
      `${name} must be ${integer ? "an integer " : ""}between ${+min.toFixed(2)} and ${+max.toFixed(2)}, got ${value}`,
    );
}

export class SettingsError extends Error {}

/** Throws one error that lists every out-of-range setting. */
export function validateSettings(s: PrintSettings, copies = 1): void {
  const errors: string[] = [];
  check(errors, "widthMm", s.widthMm);
  check(errors, "lengthMm", s.lengthMm);
  check(errors, "darkness", s.darkness, true);
  check(errors, "speedIps", s.speedIps, true);
  check(errors, "stopPositionMm", s.stopPositionMm);
  check(errors, "homeXMm", s.homeXMm);
  check(errors, "homeYMm", s.homeYMm);
  check(errors, "copies", copies, true);
  if (s.sensing?.kind === "gap") check(errors, "gapMm", s.sensing.gapMm);
  if (s.sensing?.kind === "black-mark") {
    check(errors, "gapMm", s.sensing.markMm);
    check(errors, "markOffsetMm", s.sensing.offsetMm);
  }
  if (s.sensing?.kind === "continuous") check(errors, "feedMm", s.sensing.feedMm);
  if (s.postPrint?.kind === "cut") check(errors, "cutEvery", s.postPrint.every, true);
  if (errors.length > 0) throw new SettingsError(`Invalid settings:\n  ${errors.join("\n  ")}`);
}
