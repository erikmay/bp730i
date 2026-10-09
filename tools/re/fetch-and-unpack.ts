// Downloads the vendor driver, GoLabel II and documents, checks their SHA-256, and unpacks them
// to the layout the notes in docs/reverse-engineering/ refer to. Optionally decompiles the
// driver modules with Ghidra headless.
//
// Needs: 7z, cabextract, msiextract (msitools). Ghidra step needs GHIDRA_HOME and a JDK.
// Usage: bun tools/re/fetch-and-unpack.ts [dir=~/re-bp730i] [--ghidra]
// Downloaded files are untrusted: nothing here executes them.

import { homedir } from "node:os";
import { basename, join } from "node:path";
import { $ } from "bun";

const args = Bun.argv.slice(2);
const root = args.find((a) => !a.startsWith("--")) ?? join(homedir(), "re-bp730i");
const withGhidra = args.includes("--ghidra");

const DOWNLOADS = [
  {
    dir: "dl",
    url: "https://download.labelident.com/treiber/labelident/Generic_BP_v2023.2.exe",
    sha256: "d5508861e08fb748a4791049c90d8b3e5bbf570c8da42b205ae965c9605c8772",
  },
  {
    // Current "Etikettensoftware GoLabel" link on https://www.labelident.com/bp730.html.
    // The older download.labelident.com/.../GoLabel_II_V2.1.2_BP.zip URL returns HTTP 403.
    dir: "dl-golabel-li",
    url: "https://cdn.labelident.com/downloads/b20a4ffa-22ce-4cba-85d8-4b36048b52b0.zip",
    sha256: "a08d5b3920fea0640ef885ef2511297dfd0364987beae8aa2ecbf56e780c4067",
  },
  {
    dir: "dl",
    url: "https://cdn.labelident.com/downloads/51fc1237-b213-4040-84df-1a2f28b02fb2.pdf",
    sha256: "9008243491091d1679d2aa6c312ced01e4731f9fafd2a6ffe8907c493ea22522",
  },
  {
    dir: "dl",
    url: "https://cdn.labelident.com/media/productattach/l/a/labelident_bp730_bp730i_datasheet_en.pdf",
    sha256: "fe5f181da958c62e6ff548a9a46f48f82b7146a80ba0d7e05f1000ae28dc7602",
  },
];

async function fetchChecked(d: (typeof DOWNLOADS)[number]): Promise<string> {
  const path = join(root, d.dir, d.url.split("/").pop()!);
  const file = Bun.file(path);
  if (!(await file.exists())) {
    console.log(`download ${d.url}`);
    const res = await fetch(d.url);
    if (!res.ok) throw new Error(`${d.url}: HTTP ${res.status}`);
    await Bun.write(path, res);
  }
  const hash = new Bun.CryptoHasher("sha256").update(await Bun.file(path).arrayBuffer()).digest("hex");
  if (hash !== d.sha256) throw new Error(`${path}: SHA-256 ${hash}, expected ${d.sha256}`);
  return path;
}

const [driverExe, golabelZip] = await Promise.all(DOWNLOADS.map(fetchChecked));
const drv = join(root, "drv");

await $`7z x -y -o${join(drv, "exe")} ${driverExe}`.quiet();
for (const cab of await Array.fromAsync(new Bun.Glob("x64/*.cab").scan(join(drv, "exe")))) {
  const name = cab.slice(4, -4);
  await $`cabextract -q -d ${join(drv, "cab", name)} ${join(drv, "exe", cab)}`;
}
for (const ddz of await Array.fromAsync(new Bun.Glob("**/*.ddz").scan(join(drv, "exe")))) {
  const name = basename(ddz, ".ddz");
  await $`7z x -y -o${join(drv, "ddz", name)} ${join(drv, "exe", ddz)}`.quiet();
}

const gl = join(root, "golabel");
await $`7z x -y -o${join(gl, "zip")} ${golabelZip!}`.quiet();
await $`mkdir -p ${join(gl, "msi")} && cd ${join(gl, "msi")} && msiextract ../zip/Setup.msi`.quiet();
console.log(`Unpacked to ${drv} and ${gl}`);
console.log("Decompile GoLabel with: ilspycmd -p -o <out> <assembly.dll> (needs a .NET SDK)");

if (withGhidra) {
  const ghidra = process.env.GHIDRA_HOME;
  if (!ghidra) throw new Error("Set GHIDRA_HOME to the unpacked Ghidra directory.");
  const scripts = join(import.meta.dir, "ghidra");
  const modules = [
    "xg#gdx_2023.4.1.0/Seagull_PrintModule_GDX.dll",
    "xg#gdx_2023.4.1.0/Seagull_ConfigModule_GDX.dll",
    "xg#zpl_2023.4.1.0/Seagull_PrintModule_ZPL.dll",
    "xg#zpl_2023.4.1.0/Seagull_ConfigModule_ZPL.dll",
  ];
  for (const m of modules) {
    const out = join(root, "work", "decomp", `${m.split("/")[1]!.replace(".dll", "")}.c`);
    await $`mkdir -p ${join(root, "work", "decomp")} ${join(root, "work", "ghidra_proj")}`;
    console.log(`decompile ${m}`);
    await $`${join(ghidra, "support", "analyzeHeadless")} ${join(root, "work", "ghidra_proj")} bp730i -import ${join(drv, "cab", m)} -overwrite -scriptPath ${scripts} -postScript DecompAll.java ${out}`.quiet();
  }
}
