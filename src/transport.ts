export type Transport =
  | { readonly kind: "cups"; readonly queue: string }
  | { readonly kind: "tcp"; readonly host: string; readonly port: number }
  | { readonly kind: "file"; readonly path: string };

export const DEFAULT_QUEUE = "BP730i_RAW";
export const DEFAULT_TCP_PORT = 9100;
/** The generic PPD shipped with macOS. With `-o raw` CUPS passes the job bytes through unchanged. */
export const MACOS_GENERIC_PPD =
  "/System/Library/Frameworks/ApplicationServices.framework/Versions/A/Frameworks/PrintCore.framework/Versions/A/Resources/Generic.ppd";

export function describe(t: Transport): string {
  switch (t.kind) {
    case "cups":
      return `CUPS queue ${t.queue}`;
    case "tcp":
      return `tcp://${t.host}:${t.port}`;
    case "file":
      return t.path === "-" ? "stdout" : `file ${t.path}`;
  }
}

export async function send(t: Transport, data: Uint8Array, title = "bp730i"): Promise<void> {
  switch (t.kind) {
    case "cups": {
      const proc = Bun.spawn(["lp", "-d", t.queue, "-o", "raw", "-t", title], {
        stdin: data,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [err, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
      if (code !== 0) throw new Error(`lp failed (${code}): ${err.trim()}. Run "bp730i setup" to create the queue.`);
      return;
    }
    case "tcp":
      await exchange(t, data, 0);
      return;
    case "file":
      if (t.path === "-") await Bun.write(Bun.stdout, data);
      else await Bun.write(t.path, data);
      return;
  }
}

/**
 * Sends data over TCP and collects what the printer answers until it has been quiet for
 * `quietMs`. With `quietMs` 0 it only sends.
 */
export async function exchange(
  t: Extract<Transport, { kind: "tcp" }>,
  data: Uint8Array,
  quietMs: number,
  totalMs = 5000,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const { promise: closed, resolve: onClose, reject: onError } = Promise.withResolvers<void>();
  let lastData = Date.now();
  const socket = await Bun.connect({
    hostname: t.host,
    port: t.port,
    socket: {
      data(_s, chunk) {
        chunks.push(new Uint8Array(chunk));
        lastData = Date.now();
      },
      close: () => onClose(),
      error: (_s, e) => onError(e),
      connectError: (_s, e) => onError(e),
    },
  });
  let offset = 0;
  while (offset < data.length) {
    const n = socket.write(data.subarray(offset));
    offset += n;
    if (n === 0) await Bun.sleep(5);
  }
  socket.flush();
  if (quietMs > 0) {
    const start = Date.now();
    lastData = start;
    while (Date.now() - start < totalMs && Date.now() - lastData < quietMs) await Bun.sleep(20);
  }
  socket.end();
  await Promise.race([closed, Bun.sleep(1000)]);
  return new Uint8Array(Bun.concatArrayBuffers(chunks));
}

export interface QueueSetup {
  readonly queue: string;
  /** Device URI. When missing, the first USB device that `lpinfo -v` reports with "BP730" in its URI. */
  readonly uri?: string;
  readonly ppd: string;
}

/** Commands that create (or update) the raw CUPS queue. Running them twice gives the same result. */
export async function queueSetupCommands(setup: QueueSetup): Promise<string[][]> {
  const uri = setup.uri ?? (await findUsbUri());
  return [
    ["lpadmin", "-p", setup.queue, "-E", "-v", uri, "-P", setup.ppd, "-D", "Labelident BP730i (raw)"],
    ["cupsenable", setup.queue],
    ["cupsaccept", setup.queue],
  ];
}

async function findUsbUri(): Promise<string> {
  const proc = Bun.spawn(["lpinfo", "-v"], { stdout: "pipe", stderr: "pipe" });
  const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  if (code !== 0) throw new Error("lpinfo -v failed. Pass the device URI with --uri.");
  const uri = out
    .split("\n")
    .map((l) => l.trim().split(/\s+/)[1] ?? "")
    .find((u) => u.startsWith("usb:") && /BP730/i.test(u));
  if (!uri)
    throw new Error("No BP730i USB device found by lpinfo -v. Connect and power on the printer, or pass --uri.");
  return uri;
}
