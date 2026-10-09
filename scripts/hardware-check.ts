import { parseArgs } from "node:util";

import { DEFAULT_QUEUE, DEFAULT_TCP_PORT, describeReply, exchange, QUERIES, type Query } from "../src/index.ts";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: { queue: { type: "string" }, host: { type: "string" } },
});
const sample = "samples/sample-100x150.pdf";
const cli = ["bun", "src/cli.ts"];
const target = values.host ? ["--host", values.host] : ["--queue", values.queue ?? DEFAULT_QUEUE];

interface Step {
  readonly id: string;
  readonly proves: string;
  readonly run: () => Promise<void>;
  readonly expect: string;
}

async function bp(...args: string[]): Promise<void> {
  const proc = Bun.spawn([...cli, ...args, ...target], { stdout: "inherit", stderr: "inherit" });
  if ((await proc.exited) !== 0) throw new Error(`bp730i ${args.join(" ")} failed`);
}
const print = (...args: string[]) => bp("print", sample, "--pages", "1", ...args);

/** Values from the configuration label of this printer (^E16, sensor "See."). */
const RESTORE = ["--stop", "16", "--sensor", "see-through"];

const STEPS: Step[] = [
  {
    id: "stored-settings",
    proves: "^G2 ^E are stored",
    run: async () => {
      await bp("settings", "--sensor", "auto", "--stop", "15");
      await bp("self-test");
    },
    expect:
      "A configuration label with ^E15 and a sensor line that no longer starts with 'See.'. (2026-10-09: ^E15 stored, sensor stayed 'See.'.)",
  },
  {
    id: "sensor-see-through",
    proves: "^G1 = see-through",
    run: async () => {
      await bp("settings", "--sensor", "see-through");
      await bp("self-test");
    },
    expect: "A configuration label whose sensor line starts with 'See.' again.",
  },
  {
    id: "stop-position",
    proves: "^E moves the stop position",
    run: async () => {
      await print("--stop", "0");
      await print("--stop", "16");
    },
    expect:
      "After the second label the gap stops at the tear bar. After the first it stopped about 16 mm further back.",
  },
];

if (values.host) {
  const host = values.host;
  // Over CUPS the cancel arrives only after the whole job, too late to stop it. Over TCP it can overtake the job.
  STEPS.push({
    id: "cancel",
    proves: "~S,CANCEL",
    run: async () => {
      await print("--copies", "5");
      await bp("cancel");
    },
    expect: "The printer stops before it has printed all 5 labels.",
  });
  for (const query of Object.keys(QUERIES) as Query[])
    STEPS.push({
      id: `tcp-${query}`,
      proves: QUERIES[query].trim().replaceAll("\r\n", " "),
      run: async () => {
        const t = { kind: "tcp", host, port: DEFAULT_TCP_PORT } as const;
        const reply = await exchange(t, new TextEncoder().encode(QUERIES[query]), 1500);
        console.log(describeReply(query, new TextDecoder("latin1").decode(reply)) || "(no reply)");
      },
      expect: "A reply was printed above and it looks like printer data.",
    });
}

if (!(await Bun.file(sample).exists())) await Bun.$`bun scripts/make-sample-pdf.ts ${sample}`;
const reportPath = `hardware-check-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
const report: string[] = [
  `# BP730i hardware check ${new Date().toISOString()}`,
  "",
  `Transport: ${values.host ?? `CUPS ${values.queue ?? DEFAULT_QUEUE}`}. Label: 100 x 150 mm, 2 mm gap.`,
  "",
  "| Step | Proves | Result | Note |",
  "|---|---|---|---|",
];
console.log(`The printer locks its command language at the first job after power-on.
Switch the printer off and on now, so that this check sends the first job (EZPL).`);
prompt("Press Enter when the display shows ready.");
console.log("\nAnswer y (as expected), n (not as expected), s (skip). Add a note after a space: n shifted 2 mm\n");
const saveReport = () => Bun.write(reportPath, `${report.join("\n")}\n`);
let restored = false;
async function restore(): Promise<void> {
  if (restored) return;
  restored = true;
  console.log(`\nRestoring this printer's values: settings ${RESTORE.join(" ")}`);
  await bp("settings", ...RESTORE);
  await bp("self-test");
  console.log("Check the configuration label: ^E16 and the sensor line 'See.'.");
}
process.on("SIGINT", async () => {
  await restore();
  process.exit(130);
});

try {
  for (const step of STEPS) {
    console.log(`\n== ${step.id}\nExpect: ${step.expect}`);
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
    await saveReport();
  }
} finally {
  await saveReport();
  await restore();
}
console.log(`\nWrote ${reportPath}. Steps marked "as expected" can be set to verified in src/reference.ts.`);
