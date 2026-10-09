/** 8-bit grayscale image. 0 is black, 255 is white. Rows are packed without padding. */
export interface GrayImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/** 1-bit image as printers expect it: 1 is black, MSB first, each row padded to a full byte. */
export interface Bitmap {
  readonly width: number;
  readonly height: number;
  readonly bytesPerRow: number;
  readonly data: Uint8Array;
}

export type Rotation = 0 | 90 | 180 | 270;
export type ScaleMode = "fit" | "fill" | "none";
export type Dither = "threshold" | "floyd-steinberg" | "ordered";

export interface RasterOptions {
  readonly widthDots: number;
  readonly heightDots: number;
  readonly scale: ScaleMode;
  readonly rotate: Rotation;
  readonly dither: Dither;
  /** Gray level below which a pixel prints black, 0..255. Used by "threshold" and as the bias of the other modes. */
  readonly threshold: number;
  readonly offsetXDots: number;
  readonly offsetYDots: number;
}

export function rotate(img: GrayImage, deg: Rotation): GrayImage {
  if (deg === 0) return img;
  const { width: w, height: h, data } = img;
  const swap = deg !== 180;
  const out = new Uint8Array(w * h);
  const ow = swap ? h : w;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ox: number;
      let oy: number;
      if (deg === 90) {
        ox = h - 1 - y;
        oy = x;
      } else if (deg === 180) {
        ox = w - 1 - x;
        oy = h - 1 - y;
      } else {
        ox = y;
        oy = w - 1 - x;
      }
      out[oy * ow + ox] = data[y * w + x]!;
    }
  }
  return { width: ow, height: swap ? w : h, data: out };
}

export function resize(img: GrayImage, width: number, height: number): GrayImage {
  if (width === img.width && height === img.height) return img;
  const sx = img.width / width;
  const sy = img.height / height;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.min(img.height, Math.max(y0 + 1, Math.ceil((y + 1) * sy)));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.min(img.width, Math.max(x0 + 1, Math.ceil((x + 1) * sx)));
      let sum = 0;
      for (let yy = y0; yy < y1; yy++) {
        const row = yy * img.width;
        for (let xx = x0; xx < x1; xx++) sum += img.data[row + xx]!;
      }
      out[y * width + x] = Math.round(sum / ((y1 - y0) * (x1 - x0)));
    }
  }
  return { width, height, data: out };
}

export function layout(img: GrayImage, opts: RasterOptions): GrayImage {
  const { widthDots: W, heightDots: H } = opts;
  let scaled = img;
  if (opts.scale !== "none") {
    const fx = W / img.width;
    const fy = H / img.height;
    const f = opts.scale === "fit" ? Math.min(fx, fy) : Math.max(fx, fy);
    // pdftoppm rounds page sizes up (100 mm becomes 1182 dots, not 1181). Resampling by such a
    // small factor only blurs barcode bars, so a 1 % difference is centered and cropped instead.
    if (Math.abs(f - 1) > 0.01)
      scaled = resize(img, Math.max(1, Math.round(img.width * f)), Math.max(1, Math.round(img.height * f)));
  }
  const out = new Uint8Array(W * H).fill(255);
  const left = Math.round((W - scaled.width) / 2) + opts.offsetXDots;
  const top = Math.round((H - scaled.height) / 2) + opts.offsetYDots;
  for (let y = Math.max(0, top); y < Math.min(H, top + scaled.height); y++) {
    const srcRow = (y - top) * scaled.width;
    const x0 = Math.max(0, left);
    const x1 = Math.min(W, left + scaled.width);
    if (x1 > x0) out.set(scaled.data.subarray(srcRow + x0 - left, srcRow + x1 - left), y * W + x0);
  }
  return { width: W, height: H, data: out };
}

const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54,
  22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29,
  53, 21,
];

export function toBitmap(img: GrayImage, dither: Dither, threshold: number): Bitmap {
  const { width, height } = img;
  const bytesPerRow = Math.ceil(width / 8);
  const data = new Uint8Array(bytesPerRow * height);
  const setBlack = (x: number, y: number) => {
    data[y * bytesPerRow + (x >> 3)]! |= 0x80 >> (x & 7);
  };
  switch (dither) {
    case "threshold":
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) if (img.data[y * width + x]! < threshold) setBlack(x, y);
      break;
    case "ordered": {
      const bias = threshold - 128;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const t = ((BAYER8[(y & 7) * 8 + (x & 7)]! + 0.5) / 64) * 255 + bias;
          if (img.data[y * width + x]! < t) setBlack(x, y);
        }
      break;
    }
    case "floyd-steinberg": {
      const err = new Float32Array(width * height);
      for (let i = 0; i < err.length; i++) err[i] = img.data[i]!;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          const old = err[i]!;
          const black = old < threshold;
          if (black) setBlack(x, y);
          const e = old - (black ? 0 : 255);
          if (x + 1 < width) err[i + 1]! += (e * 7) / 16;
          if (y + 1 < height) {
            if (x > 0) err[i + width - 1]! += (e * 3) / 16;
            err[i + width]! += (e * 5) / 16;
            if (x + 1 < width) err[i + width + 1]! += e / 16;
          }
        }
      break;
    }
    default:
      dither satisfies never;
  }
  return { width, height, bytesPerRow, data };
}

export function rasterize(img: GrayImage, opts: RasterOptions): Bitmap {
  return toBitmap(layout(rotate(img, opts.rotate), opts), opts.dither, opts.threshold);
}

export function bitmapToGray(bmp: Bitmap): GrayImage {
  const out = new Uint8Array(bmp.width * bmp.height);
  for (let y = 0; y < bmp.height; y++)
    for (let x = 0; x < bmp.width; x++) {
      const black = (bmp.data[y * bmp.bytesPerRow + (x >> 3)]! & (0x80 >> (x & 7))) !== 0;
      out[y * bmp.width + x] = black ? 0 : 255;
    }
  return { width: bmp.width, height: bmp.height, data: out };
}
