const out = Bun.argv[2] ?? "samples/sample-100x150.pdf";
const W = (100 / 25.4) * 72;
const H = (150 / 25.4) * 72;

function page(n: number): string {
  const ops: string[] = ["2 w", `10 10 ${W - 20} ${H - 20} re S`];
  ops.push(`BT /F1 28 Tf 24 ${H - 60} Td (BP730i TEST ${n}/2) Tj ET`);
  ops.push(`BT /F1 10 Tf 24 ${H - 80} Td (Synthetic label - no real data) Tj ET`);
  let x = 24;
  for (let i = 0; i < 40; i++) {
    const w = ((i % 4) + 1) * (72 / 300);
    ops.push(`${x.toFixed(3)} ${H - 180} ${w.toFixed(3)} 80 re f`);
    x += w * 2 + 0.5;
  }
  for (let i = 0; i < 10; i++) ops.push(`${i / 9} g ${24 + i * 23} ${H - 260} 23 50 re f`);
  ops.push("0 g");
  for (const [cx, cy] of [
    [0, 0],
    [W - 12, 0],
    [0, H - 12],
    [W - 12, H - 12],
  ])
    ops.push(`${cx} ${cy} 12 12 re f`);
  ops.push(`BT /F1 60 Tf 60 120 Td (${n === 1 ? "A" : "B"}) Tj ET`);
  ops.push(`40 ${H / 2} m ${W - 40} 60 l S`);
  return ops.join("\n");
}

const objects: string[] = [];
const add = (body: string) => objects.push(body) - 1 + 1;
const catalog = add("<< /Type /Catalog /Pages 2 0 R >>");
add("PLACEHOLDER");
const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
const kids: number[] = [];
for (const n of [1, 2]) {
  const content = page(n);
  const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  kids.push(
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${stream} 0 R >>`,
    ),
  );
}
objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;

let pdf = "%PDF-1.4\n";
const offsets: number[] = [];
objects.forEach((body, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xref = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const o of offsets) pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
await Bun.write(out, pdf);
console.log(`${out}: 2 pages, 100 x 150 mm`);
