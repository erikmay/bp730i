// Converts a binary PBM (P4) bitmap into a ZPL label with one ^GFA graphic.
// Usage: bun pbm-to-zpl.ts <input.pbm> <output.zpl>
const [input, output] = Bun.argv.slice(2);
if (!input || !output) throw new Error("Usage: bun pbm-to-zpl.ts <input.pbm> <output.zpl>");

const data = new Uint8Array(await Bun.file(input).arrayBuffer());

// Parse the P4 header: magic, width, height, separated by whitespace and comments.
let pos = 0;
const tokens: string[] = [];
while (tokens.length < 3) {
  while (/\s/.test(String.fromCharCode(data[pos]!))) pos++;
  if (data[pos] === 0x23) {
    while (data[pos] !== 0x0a) pos++;
    continue;
  }
  let token = "";
  while (!/\s/.test(String.fromCharCode(data[pos]!))) token += String.fromCharCode(data[pos++]!);
  tokens.push(token);
}
pos++; // Single whitespace byte before the raster.
const [magic, w, h] = tokens;
if (magic !== "P4") throw new Error(`Expected a binary PBM (P4), got ${magic}`);
const width = Number(w);
const height = Number(h);
const bytesPerRow = Math.ceil(width / 8);
const raster = data.subarray(pos, pos + bytesPerRow * height);

// PBM and ZPL both use 1 = black, MSB first, rows padded to full bytes.
const hex = Buffer.from(raster).toString("hex").toUpperCase();
const zpl =
  `^XA^PW${width}^LL${height}^LH0,0^FO0,0` +
  `^GFA,${raster.length},${raster.length},${bytesPerRow},${hex}^FS^PQ1^XZ\n`;

await Bun.write(output, zpl);
console.log(`${output}: ${width}x${height} dots, ${raster.length} bytes raster, ${zpl.length} bytes ZPL`);
