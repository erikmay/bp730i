# bp730i

A Bun library and CLI that prints on the Labelident BP730i label printer from macOS without a vendor driver. The BP730i is a rebranded Godex RT730i (300 dpi, 105.7 mm print width). The tool renders PDF, PNG and JPEG files to 1-bit labels and sends them as EZPL or ZPL. It sends them through a raw CUPS queue (USB) or TCP port 9100.

Most commands come from the decompiled Windows driver (`Generic_BP_v2023.2.exe`, a Seagull Scientific driver) and from GoLabel II. A few come only from the Godex EZPL manual or the Zebra ZPL language. The [command reference](#command-reference) names the source of each command.

> **Hardware status.** Only the ZPL `^GFA` raster path is confirmed on a real BP730i: the proof of concept printed a 100 x 150 mm label correctly. The EZPL output and all settings, calibration, reset and query commands are **unverified**. To check them, run the [hardware check](#check-the-commands-on-the-printer) on the Mac.

## Install

You need macOS with the printer on USB, [Bun](https://bun.sh) (tested with 1.4.3), and poppler for PDF input.

```sh
brew install poppler
git clone https://github.com/erikmay/bp730i.git
cd bp730i
bun install
bun link            # optional: puts `bp730i` on your PATH
```

Without `bun link`, run the CLI as `bun src/cli.ts <command>`.

### Create the raw CUPS queue

macOS no longer offers raw queues in the UI. `bp730i setup` creates the queue `BP730i_RAW` with the generic PPD of macOS. With `lp -o raw`, CUPS then passes job bytes through unchanged.

```sh
bp730i setup --dry-run          # show the lpadmin commands
bp730i setup                    # run them (use sudo if lpadmin asks for it)
bp730i setup --uri 'usb://...'  # if lpinfo -v does not list the printer
```

The command takes the first USB URI from `lpinfo -v` that contains `BP730`. Your existing queue uses `usb:///BP730i?serial=190307B1`, so it matches. Running the command again updates the same queue.

## Print

```sh
bp730i print label.pdf --size 100x150
bp730i print label.pdf --size 100x150 --gap 3 --darkness 10 --speed 4 --copies 2
bp730i print scan.png --size 50x30 --rotate 90 --scale fill --dither floyd-steinberg
bp730i print doc.pdf --size 100x150 --pages 2-3 --mode cut --cut-every 2 --stop 29
```

Each PDF page or image becomes one label. Use `--output file` or `--dry-run` to write the job to a file instead of sending it. Use `--preview dir` to write one PNG per label, made from the encoded job, so you see exactly what the printer receives.

### Pick the command language

The CLI uses **EZPL** by default. Use `--lang zpl` for ZPL.

EZPL is the default for three reasons:

- The Windows driver sends EZPL for the queue named "BP730i" (`BarcodePrinter.inf:258`, `Driver.d [BP730i]` maps to the GDX module). GoLabel II also sends only EZPL.
- Every media and print setting of the Windows driver has an EZPL command. ZPL mode has no command for gap size, black-mark width, stop position, or sensor type (see [What plain commands cannot do](#can-plain-commands-replace-the-windows-driver)).
- EZPL sends images as raw bytes. ZPL `^GFA` sends hexadecimal text, so a 100 x 150 mm label is 262 KB in EZPL and 524 KB in ZPL.

The counter-argument is evidence: until the hardware check passes, ZPL is the only path that has printed on your printer. If the EZPL baseline step fails, use `--lang zpl`, which matches the proof of concept.

## CLI reference

```text
bp730i print <file.pdf|png|jpg> [options]   Print a PDF (all pages or --pages) or an image
bp730i settings [options] [--save]          Send media and print settings only
bp730i calibrate | feed | cancel | self-test
bp730i reset [--factory]                    Restart the printer (--factory: factory defaults)
bp730i language <ezpl|zpl|auto>             Force or release the command language
bp730i status | config | version            Ask the printer (needs --host, TCP 9100)
bp730i raw <file|->                         Send a file of printer commands unchanged
bp730i preview <job-file> [--out dir]       Decode a job file's graphics to PNG
bp730i setup [--queue NAME] [--uri URI]     Create the raw CUPS queue (macOS)
```

Label and media options (all lengths in mm):

| Option | Values | EZPL | ZPL |
|---|---|---|---|
| `--size WxL` | width 4..106, length 3..762 | `^W`, `^Q` | `^PW`, `^LL` |
| `--gap MM` | gap media (default type, 3 mm) | `^Qlen,gap` | `^MNW` (size not sent) |
| `--mark MM`, `--mark-offset MM` | black-mark media | `^Qlen,mark,offset±` | `^MNM` (sizes not sent) |
| `--continuous MM` | continuous media, extra feed (0 for none) | `^Qlen,0,feed` | `^MNN` |
| `--sensor TYPE` | `reflective`, `see-through`, `auto` | `^G` | no command, ignored |
| `--method TYPE` | `dt` direct thermal, `tt` thermal transfer | `^AD`, `^AT` | `^MTD`, `^MTT` |
| `--darkness N` | 0..19 (Godex scale) | `^H` | `~SD` (scaled to 0..30) |
| `--speed N` | 2..5 inch/s | `^S` | `^PR` |
| `--mode MODE` | `tear`, `peel`, `cut`, `batch-cut` | `^O`, `^D` | `^MM` |
| `--cut-every N` | with `--mode cut` | `^Dn` | `^MMC`/`^MMT` per label |
| `--stop MM` | -40..40, stop position after print | `^E` | no command, ignored |
| `--home-x MM` | 0..33.7 (399 dots), printer left margin | `^R` (dots) | `^LH` |
| `--home-y MM` | -8.4..8.4 (±100 dots), printer vertical offset | `~Q` (dots) | `^LT` |
| `--mirror`, `--inverse` | whole label | `^LM`, `^LI` | `^PMY`, `^LRY` box |

A setting you leave out produces no command. The printer then keeps its stored value. One exception: in EZPL the label length and the media type are one command (`^Q`), so `--size` without `--mark` or `--continuous` also sets gap media with a 3 mm gap. The Windows driver uses the same default. The Windows driver works the same way ("Use Current Printer Settings"). EZPL stores these settings permanently. In ZPL, `settings --save` adds `^JUS`.

Labelident's support PDF gives useful stop positions: 12..16 mm for tearing and 28..30 mm with a cutter. Use the `=` form for negative values: `--home-y=-2`.

Image options:

| Option | Default | Meaning |
|---|---|---|
| `--pages RANGE` | all | PDF pages: `2`, `2-4`, `3-` |
| `--scale MODE` | `fit` | `fit` keeps the whole image, `fill` crops to cover the label, `none` keeps 300 dpi size. The image is centered. |
| `--rotate DEG` | `0` | `0`, `90`, `180`, `270`, clockwise |
| `--dither MODE` | `threshold` | `threshold`, `floyd-steinberg`, `ordered` |
| `--threshold N` | `128` | Gray levels below N print black |
| `--offset-x MM`, `--offset-y MM` | `0` | Move the image on the label (in the raster, not on the printer) |
| `--dpi N` | `300` | PDF render resolution |
| `--copies N` | `1` | Copies of each page |

Output options: `--lang ezpl|zpl`, `--queue NAME` (default `BP730i_RAW`), `--host HOST` and `--port N` (default 9100) for TCP, `--output FILE` (`-` for stdout), `--dry-run`, and `--preview DIR`.

### Queries need TCP

CUPS USB queues are one-way, so `status`, `config` and `version` work only with `--host`. Over USB you can still print the configuration label with `bp730i self-test`.

```sh
bp730i status --host 192.168.1.50                 # EZPL ~S,STATUS, decoded
bp730i status --host 192.168.1.50 --lang zpl      # ZPL ~HS, decoded
bp730i config --host 192.168.1.50                 # EZPL ^XGET,CONFIG
```

Direct USB access without CUPS is not included. On macOS it needs libusb or IOKit bindings, which are native code. The CUPS raw queue already passes bytes through unchanged.

## Use the library

```ts
import { DEFAULT_IMAGE_OPTIONS, encodeJob, renderLabels, send } from "bp730i";

const settings = {
  widthMm: 100,
  lengthMm: 150,
  sensing: { kind: "gap", gapMm: 3 },
  method: "direct-thermal",
  darkness: 10,
  speedIps: 4,
  postPrint: { kind: "tear" },
  stopPositionMm: 14,
} as const;

const pages = await renderLabels("label.pdf", settings, { ...DEFAULT_IMAGE_OPTIONS, dither: "floyd-steinberg" });
const job = encodeJob("ezpl", { settings, pages, copies: 1 });
await send({ kind: "cups", queue: "BP730i_RAW" }, job);
// or: await send({ kind: "tcp", host: "192.168.1.50", port: 9100 }, job);
```

`encodeJob` validates the settings and throws one error that lists every value out of range. `DIALECTS.ezpl` and `DIALECTS.zpl` expose `encodeSettings`, `controls` (calibrate, feed, cancel, reset, factory-reset, self-test) and `queries` (status, config, version). `exchange` sends bytes over TCP and returns the printer's answer.

## Check the commands on the printer

Run this on the Mac with the printer connected and labels loaded:

```sh
bun scripts/hardware-check.ts --size 100x150          # over CUPS
bun scripts/hardware-check.ts --host 192.168.1.50     # over TCP, adds the query steps
```

The script prints the synthetic sample label in 18 steps (23 with `--host`) and uses about 35 labels. The first step prints a configuration label: keep it, because the check changes stored settings. At the end the script shows the `settings` command that restores them. Each step says what you should see, then asks `y`, `n` or `s` (skip) and an optional note. It writes the answers to `hardware-check-<time>.md`. Steps for the cutter and the peeler ask first whether you have one. At the end the script sends `~S,ESA`, so the printer returns to automatic language detection. If you stop the script early, run `bp730i language auto`.

For each step marked "as expected", set `hardware: "verified"` for its commands in `src/reference.ts`, then run `bun run docs:commands` to update the table below.

## Can plain commands replace the Windows driver?

**For EZPL, yes. Every label-size and media setting of the Windows driver is a plain EZPL command.** The Seagull driver has no side channel. Its print module writes all settings into the same byte stream as the label, and its config module sends a few utility commands (`~S,SENSOR`, `^G`, `^XSET,MEMORY`, `~V`, `~T`, `~X1..5`) over the same port. "Use Current Printer Settings" sends nothing. This library sends the same commands or leaves them out in the same way, with one small difference: for an absolute stop position the driver sends `^E` twice (whole mm, then one decimal), and this library sends only the decimal form.

These driver features are not in this library. They are all commands too, so you can send them with `bp730i raw`:

- Relative stop position `^EA` (the driver default is absolute `^E`).
- Applicator mode `^O2`.
- Printer-side fonts, barcodes, lines and boxes, graphic and format caching (`~Ep`, `Y`, `^F`/`^K`), serialization, and RFID. They are rendering features, not media settings. This library sends every label as one bitmap.
- GoLabel extras such as `^XSET,BACKFEED` (pre-print), `^XSET,TOPOFFORM`, `^XSETCUT,MODE` (partial cut) and `^XSETCUT,DOUBLECUT`.

**In ZPL (GZPL) mode, some media settings have no command.** The Windows GZPL driver itself never sends them:

- Gap height and black-mark width. The driver sends only `^MNW` or `^MNM`, so the printer must measure them (calibration).
- Absolute stop position. ZPL has only `~TA`, a relative tear-off adjustment of ±120 dots (±10 mm). This library does not send it.
- Sensor type (reflective or see-through).
- A defined darkness scale. The driver sends `~SD` 0..30 unchanged. The mapping from the Godex 0..19 scale to `~SD` is this library's linear guess.

Settings that need a person, not a command: moving the media sensor, loading ribbon and media, and the network settings in the web interface (EZPL `^NS` and `^XSET` commands also cover the network, but this library does not send them).

## Command reference

`Q` and `E` are EZPL commands without a prefix. Sources: `GDX-PM`/`GDX-CM` and `ZPL-PM`/`ZPL-CM` are the Windows driver's print and config modules for EZPL and ZPL (Ghidra function address). `GL` is decompiled GoLabel II 2.1.9558 (file and line). `EZPL m.N` is page N of the Godex EZPL Programmer's Manual Rev. O.4, used only as a cross-check. `user PoC` is the proof of concept that printed on the real printer. The full evidence, with string offsets, is in [docs/reverse-engineering](docs/reverse-engineering/).

<!-- command-table:start -->

### EZPL

| Syntax | Used for | Source | Hardware |
|---|---|---|---|
| `^AD / ^AT` | --method dt / tt | GDX-PM FUN_18000c280; GL Setup.cs:396; EZPL m.19 | **unverified** |
| `^AT` | --method tt | GDX-PM FUN_18000c280; GL Setup.cs:396 | **unverified** |
| `^On, n=0 none, 1 peel, 2 applicator` | --mode (peel = 1, else 0) | GDX-PM FUN_18000b1b0; GL Setup.cs:412; EZPL m.26 | **unverified** |
| `^Dn, n=0 off, n=cut every n labels` | --mode cut --cut-every n | GDX-PM FUN_18000b1b0; GL Setup.cs:419; EZPL m.22 | **unverified** |
| `^Db` | --mode batch-cut (one cut at job end) | GL Setup.cs:415 (not in Windows driver or manual) | **unverified** |
| `^Sn, n=2..5 ips` | --speed | GDX-PM FUN_18000b1b0, FUN_180009620; .d Model.d:5420; EZPL m.30 | **unverified** |
| `^Hn, n=0..19` | --darkness | GDX-PM FUN_18000c2f0 case 5; GL PrinterModel.xml BP730i; EZPL m.24 | **unverified** |
| `^Gn, n=0 reflective, 1 see-through, 2 auto` | --sensor | GDX-CM FUN_180003bb0; GL PrinterSetup.cs:6124; EZPL m.24 (manual contradicts itself on 0/1) | **unverified** |
| `^Rn, n=0..399 dots` | --home-x (left margin) | GL Setup.cs:403; EZPL m.30 (not emitted by Windows driver) | **unverified** |
| `^C1` | always 1 (copies via ^P) | GDX-PM FUN_18000b1b0 type 4 | **unverified** |
| `^Pn, n=1..9999` | --copies (per format) | GDX-PM FUN_18000bab0; .d Method.d Copies.Limit | **unverified** |
| `^Qlen,gap \| ^Qlen,mark,offset+/- \| ^Qlen,0,feed (mm, 1 decimal)` | --size L, --gap / --mark / --continuous | GDX-PM FUN_18000bd50; GL Setup.cs:370; EZPL m.28 | **unverified** |
| `^Wn (whole mm)` | --size W | GDX-PM FUN_18000b570 type 10; GL Setup.cs:383; EZPL m.31 | **unverified** |
| `~Q+n / ~Q-n, dots -100..100` | --home-y | GDX-PM FUN_18000c780; GL Setup.cs:406; EZPL m.79 | **unverified** |
| `^En (mm, 1 decimal)` | --stop | GDX-PM FUN_18000c2f0 case 3; GL Setup.cs:422; EZPL m.23 | **unverified** |
| `^L[M][I]` | begin label; --mirror, --inverse | GDX-PM FUN_18000bc50; .d Features.d [Godex_PlusSeries]; EZPL m.25 | **unverified** |
| `Qx,y,bytesPerRow,rows<CR> + raw rows, 1 = black, MSB left` | every image | GDX-PM FUN_180006900; GL PrintJob.cs:2169 (LF instead of CR); EZPL m.114 | **unverified** |
| `E` | end label, print | GDX-PM FUN_18000bb80; GL QLabel.cs:4409 | **unverified** |
| `~S,SENSOR` | calibrate | GDX-CM FUN_180002810; GL SvgArtiste.cs:5513; EZPL m.82 | **unverified** |
| `~S,FEED` | feed | EZPL m.84 only | **unverified** |
| `~S,CANCEL` | cancel | GL SvgArtiste.cs:10275; EZPL m.84 | **unverified** |
| `~Z` | reset (restart) | GL SvgArtiste.cs:5388 'reset printer'; EZPL m.87. Windows driver names its ~Z job 'Print Configuration' (GDX-CM FUN_180002810) | **unverified** |
| `^Z` | reset --factory | EZPL m.69 only | **unverified** |
| `~V` | self-test (prints configuration label) | GDX-CM FUN_180002810; GL SvgArtiste.cs:5404; EZPL m.85 | **unverified** |
| `~S,ESG / ~S,ESZ / ~S,ESA` | language ezpl / zpl / auto | EZPL m.84 only | **unverified** |
| `^XSET,IMMEDIATE,1` | sent before status | GDX-CM FUN_180001430; EZPL m.44 | **unverified** |
| `~S,STATUS -> aa,nnnnn` | status (TCP) | GDX-CM FUN_1800010a0 / FUN_1800010c0; EZPL m.84 | **unverified** |
| `^XGET,CONFIG` | config (TCP) | GL SvgArtiste.cs:8457; EZPL m.31 | **unverified** |
| `~B` | version (TCP) | GL TestInterface.cs:178; EZPL m.70 | **unverified** |

### ZPL (GZPL emulation)

| Syntax | Used for | Source | Hardware |
|---|---|---|---|
| `^XA ... ^XZ` | every format | ZPL-PM FUN_1800026a0; user PoC | verified |
| `^XZ` | every format | ZPL-PM FUN_1800026a0; user PoC | verified |
| `^PWdots` | --size W | ZPL-PM FUN_180016a20; user PoC | verified |
| `^LLdots` | --size L (driver sends it only for continuous media) | ZPL-PM FUN_180016a20; user PoC | verified |
| `^LHx,0` | --home-x | ZPL-PM FUN_1800026a0 (driver always ^LH0,0); user PoC sent ^LH0,0 | verified |
| `^FO0,0` | every image | ZPL-PM FUN_180012d50; user PoC | verified |
| `^GFA,total,total,bytesPerRow,HEX` | every image (no cut interval) | user PoC; driver uses ~DG+Z64 (ZPL-PM FUN_180009210) | verified |
| `^FS` | field end | ZPL-PM; user PoC | verified |
| `^PQq,0,1,Y` | --copies | ZPL-PM FUN_1800131f0; user PoC sent ^PQ1 | verified |
| `^PMY / ^PMN` | --mirror | ZPL-PM FUN_180016a20 | **unverified** |
| `^MTD / ^MTT` | --method | ZPL-PM FUN_180016a20 | **unverified** |
| `^MNW gap / ^MNM mark / ^MNN continuous` | --gap / --mark / --continuous (gap and mark sizes are not sent) | ZPL-PM FUN_180016a20; CM FUN_180006820 | **unverified** |
| `^LTdots, -120..120` | --home-y | ZPL-PM FUN_180016a20, FUN_1800151d0 | **unverified** |
| `^MMT tear / ^MMP peel / ^MMC cut` | --mode | ZPL-PM FUN_180016a20; CM FUN_180006d80 | **unverified** |
| `~SDnn^MD0, nn=00..30` | --darkness (Godex 0..19 scaled to 0..30, guess) | ZPL-PM FUN_180016a20 (driver passes 0..30 unchanged) | **unverified** |
| `^MD0` | clears relative darkness after ~SD | ZPL-PM FUN_180016a20 str 0x1ebb0 | **unverified** |
| `^PRn, n=2..5` | --speed | ZPL-PM FUN_180016a20 (driver sends ^PRp,s,b) | **unverified** |
| `^JUS` | settings --save | ZPL-CM FUN_18000eb80 action 0x40a | **unverified** |
| `^LRY ... ^LRN with full ^GB` | --inverse | ZPL-PM FUN_180013730 | **unverified** |
| `^GBw,h,t` | --inverse box | ZPL-PM FUN_180013730 | **unverified** |
| `~DGR:name,total,bytesPerRow,HEX` | image store for --mode cut --cut-every n>1 / batch-cut | ZPL-PM FUN_180009210 (driver uses Z64 data, here hex) | **unverified** |
| `^XGR:name,1,1` | recall stored image | ZPL-PM FUN_180009210 | **unverified** |
| `^IDR:BP*.GRF` | delete stored images at job end | ZPL-PM FUN_180001a80 | **unverified** |
| `~JC` | calibrate | ZPL-CM FUN_18000eb80 action 9 | **unverified** |
| `~PH` | feed | ZPL-CM FUN_18000eb80 action 4 | **unverified** |
| `~JA` | cancel | ZPL-CM FUN_18000eb80 action 0x1b | **unverified** |
| `~JR` | reset | ZPL-CM FUN_18000eb80 action 7 | **unverified** |
| `^XA^JUF^XZ` | reset --factory | ZPL-CM FUN_18000eb80 action 8 | **unverified** |
| `~WC` | self-test (configuration label) | ZPL-CM FUN_18000eb80 action 10 | **unverified** |
| `~HS` | status (TCP) | ZPL-CM FUN_180030110 | **unverified** |
| `^XA^HH^XZ` | config (TCP) | Zebra ZPL only; driver suppresses it for Godex (no ~Command.HH) | **unverified** |
| `~HI` | version (TCP) | ZPL-CM FUN_180030110 | **unverified** |

<!-- command-table:end -->

## Reverse-engineering notes

These are the main findings. The details are in [docs/reverse-engineering](docs/reverse-engineering/).

- **The driver is a Seagull Scientific "Drivers by Seagull" build.** It is not a Godex driver. `Generic_BP_v2023.2.exe` is an InstallShield self-extractor (SHA-256 `d5508861…c8772`). It holds `BarcodePrinter.inf`, CAB files with the DLLs, and `.ddz` ZIP files with plain-text model tables (`Model.d`, `Features.d`, `Driver.d`).
- **The queue name decides the language.** `BP730i` uses the GDX (EZPL) module. `BP730i GZPL` uses the ZPL module and `BP730i GEPL` the EPL module. All three map to the model entry `Godex_RT730i`.
- **Model limits come from `Model.d [Godex_RT730i]`.** They are 300 dpi, printable width 105.7 mm, speeds 2..5 in/s, darkness default 8, cutter and stripper supported. GoLabel's `PrinterModel.xml` adds darkness 0..19, width 4..106 mm and length 3..762 mm.
- **EZPL images are raw bitmaps.** The driver and GoLabel send `Qx,y,bytesPerRow,rows`, then raw rows with 1 as a black dot and the most significant bit on the left. The driver ends the header with CR and GoLabel with LF. This library uses CR. The driver also skips blank 8-row bands. This library sends the full page.
- **The ZPL driver is different from the proof of concept.** It puts the settings in a separate leading `^XA…^XZ` format. It sends images with `~DG` and Z64 compression and recalls them with `^XG`. This library keeps `^GFA` hex, the one image path that has printed on this printer.
- **The GoLabel download URL in the task returns HTTP 403.** The current GoLabel link on the [BP730 product page](https://www.labelident.com/bp730.html) works (SHA-256 `a08d5b39…4c067`). GoLabel II 2.1.9558 is a .NET program. ILSpy decompiles it to C#.
- **The sources disagree in two places.** The Windows driver names its `~Z` job "Print Configuration", but GoLabel's "reset printer" menu and the EZPL manual use `~Z` for reset. The EZPL manual gives `^G0`/`^G1` opposite meanings on two pages. Both points are unverified.

To repeat the extraction, run `bun tools/re/fetch-and-unpack.ts [dir] [--ghidra]`. It downloads the vendor files, checks their SHA-256, unpacks them, and with `--ghidra` decompiles the four driver modules with Ghidra headless (`GHIDRA_HOME` must be set). The Ghidra scripts and the helper scripts that the analysis used are in `tools/re/`.

## Develop

```sh
bun run check        # tsc, biome, README table check, tests
bun run format       # biome with fixes
bun scripts/make-sample-pdf.ts samples/sample-100x150.pdf   # synthetic 2-page test PDF
```
