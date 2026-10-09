import { COMMANDS } from "../src/reference.ts";

const START = "<!-- command-table:start -->";
const END = "<!-- command-table:end -->";
const cell = (s: string) => s.replaceAll("|", "\\|");

function table(): string {
  const rows = COMMANDS.map(
    (c) =>
      `| \`${cell(c.syntax)}\` | ${cell(c.use)} | ${cell(c.source)} | ${c.hardware === "verified" ? "verified" : "**unverified**"} |`,
  );
  return ["| Syntax | Used for | Source | Hardware |", "|---|---|---|---|", ...rows].join("\n");
}

const generated = `${START}\n\n${table()}\n\n${END}`;
const readme = await Bun.file("README.md").text();
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start < 0 || end < 0) throw new Error("README.md has no command-table markers");
const updated = readme.slice(0, start) + generated + readme.slice(end + END.length);

if (Bun.argv.includes("--check")) {
  if (updated !== readme) {
    console.error("README.md command table is out of date. Run: bun run docs:commands");
    process.exit(1);
  }
} else {
  await Bun.write("README.md", updated);
}
