import { parseArgs } from "node:util";
import { DEFAULT_QUEUE, DEFAULT_TCP_PORT, DIALECTS, exchange, send, type Transport } from "../src/index.ts";
import { LANGUAGE_SWITCH } from "../src/lang/ezpl.ts";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: { size: { type: "string" }, queue: { type: "string" }, host: { type: "string" } },
});
const size = values.size ?? "100x150";
const transport: Transport = values.host
  ? { kind: "tcp", host: values.host, port: DEFAULT_TCP_PORT }
  : { kind: "cups", queue: values.queue ?? DEFAULT_QUEUE };
const sample = "samples/sample-100x150.pdf";
const cli = ["bun", "src/cli.ts"];
const target = values.host ? ["--host", values.host] : ["--queue", values.queue ?? DEFAULT_QUEUE];

interface Step {
  readonly id: string;
  readonly proves: string;
  readonly run: () => Promise<void>;
  readonly expect: string;
  readonly needs?: string;
}

async function bp(...args: string[]): Promise<void> {
  const proc = Bun.spawn([...cli, ...args, ...target], { stdout: "inherit", stderr: "inherit" });
  if ((await proc.exited) !== 0) throw new Error(`bp730i ${args.join(" ")} failed`);
}
const print = (...args: string[]) => bp("print", sample, "--pages", "1", "--size", size, ...args);

const STEPS: Step[] = [
  {
    id: "zpl-baseline",
    proves: "ZPL ^XA ^PW ^MT ^MN ^LL ^MM ~SD ^MD ^PR ^FO ^GFA ^PQ ^XZ",
    run: () =>
      print("--lang", "zpl", "--gap", "3", "--method", "dt", "--mode", "tear", "--darkness", "8", "--speed", "4"),
    expect: "One label 'BP730i TEST 1/2', border and corner marks complete, label stops at the tear edge.",
  },
  {
    id: "ezpl-baseline",
    proves: "EZPL ^AD ^O ^D ^S ^H ^C ^P ^Q ^W ^L Q E",
    run: () =>
      print("--lang", "ezpl", "--gap", "3", "--method", "dt", "--mode", "tear", "--darkness", "8", "--speed", "4"),
    expect: "Same label as the ZPL step, same position, not mirrored or inverted.",
  },
  {
    id: "ezpl-all-pages-copies",
    proves: "EZPL ^P (copies), multiple formats per job",
    run: () => bp("print", sample, "--size", size, "--copies", "2"),
    expect: "Four labels in this order: 1/2, 1/2, 2/2, 2/2 (A, A, B, B).",
  },
  {
    id: "ezpl-darkness",
    proves: "EZPL ^H range",
    run: async () => {
      await print("--darkness", "2");
      await print("--darkness", "16");
    },
    expect: "The second label is clearly darker than the first.",
  },
  {
    id: "ezpl-speed",
    proves: "EZPL ^S",
    run: async () => {
      await print("--speed", "2");
      await print("--speed", "5");
    },
    expect: "The second label prints clearly faster than the first.",
  },
  {
    id: "ezpl-stop",
    proves: "EZPL ^E",
    run: async () => {
      await print("--stop", "0");
      await print("--stop", "16");
    },
    expect: "With --stop 16 the gap stops at the tear bar; with 0 it stops further back.",
  },
  {
    id: "ezpl-home",
    proves: "EZPL ^R ~Q",
    run: async () => {
      await print("--home-x", "5", "--home-y", "5");
      await print("--home-x", "0", "--home-y", "0");
    },
    expect: "The first label is shifted about 5 mm right and 5 mm down compared with the second.",
  },
  {
    id: "ezpl-mirror-inverse",
    proves: "EZPL ^LM ^LI",
    run: async () => {
      await print("--mirror");
      await print("--inverse");
    },
    expect: "First label mirrored left to right. Second label white on black.",
  },
  {
    id: "ezpl-self-test",
    proves: "EZPL ~V, and that ^H ^S ^E ^W ^Q persist",
    run: async () => {
      await bp("settings", "--size", size, "--gap", "3", "--darkness", "9", "--speed", "3", "--stop", "15");
      await bp("self-test");
    },
    expect: "A configuration label. It lists ^H9 ^S3 ^E15 and ^W/^Q values for your label size.",
  },
  {
    id: "ezpl-calibrate",
    proves: "EZPL ~S,SENSOR",
    run: () => bp("calibrate"),
    expect: "The printer feeds a few labels, measures them and stops at a label start.",
  },
  {
    id: "ezpl-feed",
    proves: "EZPL ~S,FEED",
    run: () => bp("feed"),
    expect: "The printer feeds exactly one label.",
  },
  {
    id: "ezpl-cut",
    proves: "EZPL ^D ^Db",
    needs: "cutter",
    run: async () => {
      await bp("print", sample, "--size", size, "--mode", "cut", "--stop", "29");
      await bp("print", sample, "--size", size, "--mode", "batch-cut", "--stop", "29");
    },
    expect: "First job: a cut after each label. Second job: one cut after the last label.",
  },
  {
    id: "ezpl-peel",
    proves: "EZPL ^O1",
    needs: "peeler/dispenser",
    run: () => print("--mode", "peel", "--stop", "8"),
    expect: "The label is peeled off the liner and the printer waits until you take it.",
  },
  {
    id: "zpl-darkness",
    proves: "ZPL ~SD scale",
    run: async () => {
      await print("--lang", "zpl", "--darkness", "2");
      await print("--lang", "zpl", "--darkness", "16");
    },
    expect: "The second label is clearly darker than the first.",
  },
  {
    id: "zpl-cut-interval",
    proves: "ZPL ~DG ^XG ^ID ^MMC",
    needs: "cutter",
    run: () => print("--lang", "zpl", "--mode", "cut", "--cut-every", "2", "--copies", "3"),
    expect: "Three labels: a cut after the second and after the third.",
  },
  {
    id: "zpl-calibrate-self-test",
    proves: "ZPL ~JC ~WC",
    run: async () => {
      await bp("calibrate", "--lang", "zpl");
      await bp("self-test", "--lang", "zpl");
    },
    expect: "Calibration feed, then a configuration label.",
  },
  {
    id: "language-switch",
    proves: "~S,ESZ ~S,ESA",
    run: async () => {
      await send(transport, new TextEncoder().encode(LANGUAGE_SWITCH.zpl));
      await print("--lang", "ezpl");
      await send(transport, new TextEncoder().encode(LANGUAGE_SWITCH.auto));
      await print("--lang", "ezpl");
    },
    expect: "With ZPL forced the EZPL job does NOT print correctly. After auto it prints again.",
  },
  {
    id: "reset",
    proves: "EZPL ~Z",
    run: () => bp("reset"),
    expect: "The printer restarts (display or LED restarts), without printing.",
  },
];

if (values.host) {
  for (const [lang, query] of [
    ["ezpl", "status"],
    ["ezpl", "config"],
    ["ezpl", "version"],
    ["zpl", "status"],
    ["zpl", "version"],
  ] as const)
    STEPS.push({
      id: `tcp-${lang}-${query}`,
      proves: `${lang.toUpperCase()} ${DIALECTS[lang].queries[query].trim()}`,
      run: async () => {
        const t = { kind: "tcp", host: values.host!, port: DEFAULT_TCP_PORT } as const;
        const reply = await exchange(t, new TextEncoder().encode(DIALECTS[lang].queries[query]), 1500);
        console.log(`Reply (${reply.length} bytes): ${JSON.stringify(new TextDecoder("latin1").decode(reply))}`);
      },
      expect: "A reply was printed above and it looks like printer data.",
    });
}

if (!(await Bun.file(sample).exists())) await Bun.$`bun scripts/make-sample-pdf.ts ${sample}`;
const report: string[] = [
  `# BP730i hardware check ${new Date().toISOString()}`,
  "",
  `Transport: ${values.host ?? `CUPS ${values.queue ?? DEFAULT_QUEUE}`}. Label size: ${size}.`,
  "",
  "| Step | Proves | Result | Note |",
  "|---|---|---|---|",
];
console.log("Answer y (as expected), n (not as expected), s (skip). Add a note after a space: n shifted 2 mm\n");
for (const step of STEPS) {
  console.log(`\n== ${step.id}${step.needs ? ` (needs ${step.needs})` : ""}\nExpect: ${step.expect}`);
  if (step.needs && prompt(`Do you have a ${step.needs}? [y/N]`)?.trim().toLowerCase() !== "y") {
    report.push(`| ${step.id} | ${step.proves} | skipped | no ${step.needs} |`);
    continue;
  }
  let error = "";
  try {
    await step.run();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.log(`Error: ${error}`);
  }
  const answer = (prompt("Result [y/n/s] + note:") ?? "s").trim();
  const [first = "s", ...note] = answer.split(" ");
  const result = { y: "as expected", n: "NOT as expected" }[first.toLowerCase()] ?? "skipped";
  report.push(`| ${step.id} | ${step.proves} | ${result} | ${[error, note.join(" ")].filter(Boolean).join("; ")} |`);
}
await send(transport, new TextEncoder().encode(LANGUAGE_SWITCH.auto));
const path = `hardware-check-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
await Bun.write(path, `${report.join("\n")}\n`);
console.log(`\nWrote ${path}. Steps marked "as expected" can be set to hardware: "verified" in src/reference.ts.`);
