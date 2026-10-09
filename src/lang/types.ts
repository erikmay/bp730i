import type { Bitmap } from "../raster.ts";
import type { PrintSettings, SettingKey } from "../settings.ts";

export type Language = "ezpl" | "zpl";

export interface Job {
  readonly settings: PrintSettings;
  /** One bitmap per label. Each must already have the label size in dots. */
  readonly pages: readonly Bitmap[];
  /** Copies of each page. */
  readonly copies: number;
}

/** One-way commands that change printer state or move media. */
export type Control = "calibrate" | "feed" | "cancel" | "reset" | "factory-reset" | "self-test";

/** Commands that make the printer answer. Answers only arrive over TCP. */
export type Query = "status" | "config" | "version";

export interface Dialect {
  readonly language: Language;
  /** Setup commands and one label format per page. */
  encodeJob(job: Job): Uint8Array;
  /** Setup commands only. For ZPL, `persist` also saves them with ^JUS. EZPL setup commands always persist. */
  encodeSettings(settings: PrintSettings, persist: boolean): Uint8Array;
  readonly controls: Readonly<Record<Control, string>>;
  readonly queries: Readonly<Record<Query, string>>;
  /** Settings this language has no command for. They are ignored. */
  readonly unsupported: readonly SettingKey[];
  /** Extracts the bitmaps of a job this dialect encoded. Used for previews and round-trip checks. */
  decodeGraphics(data: Uint8Array): Bitmap[];
}

export const encodeText = (s: string): Uint8Array => new TextEncoder().encode(s);
