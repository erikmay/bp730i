export const DPI = 300;
export const DOTS_PER_MM = DPI / 25.4;
/** Print head width: 105.7 mm (driver data file Model.d [Godex_RT730i] Stock.Printable.X). */
export const MAX_PRINT_WIDTH_DOTS = Math.floor(105.7 * DOTS_PER_MM);

export const mmToDots = (mm: number): number => Math.round(mm * DOTS_PER_MM);
export const dotsToMm = (dots: number): number => dots / DOTS_PER_MM;
