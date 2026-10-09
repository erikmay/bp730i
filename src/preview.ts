import { PNG } from "pngjs";
import { type Bitmap, bitmapToGray } from "./raster.ts";

export function bitmapToPng(bmp: Bitmap): Uint8Array {
  const gray = bitmapToGray(bmp);
  const png = new PNG({ width: gray.width, height: gray.height, colorType: 0, inputColorType: 0, bitDepth: 8 });
  png.data = Buffer.from(gray.data);
  return PNG.sync.write(png, { colorType: 0, inputColorType: 0 });
}
