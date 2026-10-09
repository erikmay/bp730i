import type { Language, Query } from "./types.ts";

/** EZPL ~S,CHECK / ~S,STATUS codes. Source: EZPL Programmer's Manual Rev. O.4 p.80; the driver maps the same codes. */
export const EZPL_STATUS: Readonly<Record<string, string>> = {
  "00": "Ready",
  "01": "Media empty or media jam",
  "02": "Media jam",
  "03": "Ribbon empty",
  "04": "Print head open",
  "05": "Rewinder full",
  "06": "File system full",
  "07": "Filename not found",
  "08": "Duplicate name",
  "09": "Syntax error",
  "10": "Cutter jam",
  "11": "Extended memory not found",
  "13": "Waiting for label removal (peel)",
  "20": "Pause",
  "21": "Setting mode",
  "22": "Keyboard mode",
  "50": "Printing",
  "60": "Data in process",
  "62": "Print head overheat",
};

/** Adds a readable line to a printer answer where the format is known. Unknown answers pass through. */
export function describeReply(language: Language, query: Query, reply: string): string {
  const text = reply.trim();
  if (language === "ezpl" && query === "status") {
    const m = /(\d{2}),(\d{5})\s*$/.exec(text);
    if (m)
      return `${text}\nStatus ${m[1]}: ${EZPL_STATUS[m[1]!] ?? "unknown code"}, ${Number(m[2])} labels left in job`;
  }
  if (language === "zpl" && query === "status") return describeZplHostStatus(text) ?? text;
  return text;
}

/**
 * ZPL ~HS answers with three STX...ETX strings. Field positions per the Zebra ZPL II
 * Programming Guide (~HS). Godex GZPL support for ~HS is unverified.
 */
function describeZplHostStatus(text: string): string | undefined {
  const strings = text
    .split("\x03")
    .map((s) => s.replaceAll("\x02", "").trim())
    .filter((s) => s.length > 0);
  if (strings.length < 2) return undefined;
  const one = strings[0]!.split(",");
  const two = strings[1]!.split(",");
  const flag = (v: string | undefined, name: string) => (v === "1" ? [name] : []);
  const problems = [
    ...flag(one[1], "paper out"),
    ...flag(one[2], "pause"),
    ...flag(one[5], "buffer full"),
    ...flag(one[9], "corrupt RAM"),
    ...flag(one[10], "under temperature"),
    ...flag(one[11], "over temperature"),
    ...flag(two[2], "head up"),
    ...flag(two[3], "ribbon out"),
  ];
  return `${text}\nStatus: ${problems.length === 0 ? "no error flags" : problems.join(", ")}; formats in buffer ${one[4] ?? "?"}, labels remaining ${two[8] ?? "?"}`;
}
