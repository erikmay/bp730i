export type MediaSensing =
  | { readonly kind: "gap"; readonly gapMm: number }
  /** `offsetMm` is the distance from the mark to the top of form. Negative means inside the mark. */
  | { readonly kind: "black-mark"; readonly markMm: number; readonly offsetMm: number }
  /** `feedMm` is extra feed after each label. */
  | { readonly kind: "continuous"; readonly feedMm: number };

export type PrintMethod = "direct-thermal" | "thermal-transfer";

export type PostPrint =
  | { readonly kind: "tear" }
  | { readonly kind: "peel" }
  /** Cut after every `every` labels. */
  | { readonly kind: "cut"; readonly every: number }
  /** One cut after the last label of the job. */
  | { readonly kind: "batch-cut" };

export type SensorType = "reflective" | "see-through" | "auto";

/**
 * Media and print settings. Every field is optional:
 * a missing field means "send no command, keep what the printer has stored".
 */
export interface PrintSettings {
  readonly widthMm?: number;
  /** Sent (^Q) only together with `sensing`, because ^Q also sets the gap or mark. */
  readonly lengthMm?: number;
  readonly sensing?: MediaSensing;
  readonly sensor?: SensorType;
  readonly method?: PrintMethod;
  /** Godex darkness scale 0..19 (GoLabel and the printer menu). */
  readonly darkness?: number;
  /** Inches per second. The BP730i accepts 2..5. */
  readonly speedIps?: number;
  readonly postPrint?: PostPrint;
  /** Where the label stops after printing, in mm (^E, 0..40). Tear 12..16, cutter 28..30 per Labelident support PDF. */
  readonly stopPositionMm?: number;
  /** Printer-side left margin in mm (^R). 0 or more. */
  readonly homeXMm?: number;
  /** Printer-side vertical start offset in mm (~Q). Can be negative. */
  readonly homeYMm?: number;
  readonly mirror?: boolean;
  readonly inverse?: boolean;
}
