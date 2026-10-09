# bp730i

A Bun library and CLI that prints on the Labelident BP730i label printer from macOS without a vendor driver. The BP730i is a rebranded Godex RT730i (300 dpi, 105.7 mm print width). The tool renders PDF, PNG and JPEG files to 1-bit labels and sends them as EZPL through a raw CUPS queue (USB) or TCP port 9100.

Most commands come from the decompiled Windows driver (`Generic_BP_v2023.2.exe`, a Seagull Scientific driver) and from GoLabel II. A few come only from the Godex EZPL manual. The [command reference](#command-reference) names the source of each command and whether it worked on the real printer.

> **Hardware status.** A complete EZPL label job prints correctly on a BP730i over USB (`^C1 ^P ^Q ^W ^L`, the `Q` raster and `E`), in the right position, not mirrored or inverted. Copies, several pages in one job, darkness (`^H`), speed (`^S`) and the configuration label (`~V`) also work. The other commands are **unverified**. To check them, run the [hardware check](#check-the-commands-on-the-printer) on the Mac.

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
bp730i print shipping-label.pdf                       # 100 x 150 mm, 2 mm gap
bp730i print shipping-label.pdf --darkness 10 --copies 2
bp730i print product.pdf --size 50x30 --gap 3 --pages 2-3
bp730i print logo.png --size 50x30 --scale fill --dither floyd-steinberg
```

Each PDF page or image becomes one label. Without `--size`, `print` uses the 100 x 150 mm roll with a 2 mm gap. A PDF page in landscape on a portrait label (or the reverse) is turned by 90 degrees clockwise. Use `--rotate 0` to keep it as it is, or `--rotate 270` to turn it the other way.

Use `--output file` or `--dry-run` to write the job to a file instead of sending it. Use `--preview dir` to write one PNG per label, decoded from the encoded job, so you see exactly what the printer receives.

### Language lock

The printer understands EZPL, ZPL (GZPL) and EPL (GEPL). With the language setting "Auto" (the default), the printer picks the language of the **first job after power-on** and keeps it until the next power cycle. Jobs in any other language are then ignored without an error: the display reacts, but nothing prints.

This tool sends only EZPL, so it cannot lock the printer to another language. The lock matters only when other software sends ZPL or EPL first. If the printer ignores every job, including `bp730i self-test`:

1. Switch the printer off and on.
2. Send an EZPL job first, for example `bp730i self-test`.

The EZPL manual confirms this behavior: "When a printer switch to certain language, it can auto detect and switch again by rebooting printer" (EZPL manual Rev. O.4, p. 84). It documents a command switch (`~S,ESG`, `~S,ESZ`, `~S,ESA`), but calls it temporary and gives no way back from ZPL without a reboot. This tool does not send the switch: it adds nothing when every job is EZPL, and an EZPL command probably cannot reach a printer that is locked to ZPL, because `~V` cannot. The RT730i manual lists no menu item for the command language. See [coverage](docs/reverse-engineering/coverage.md) for the evidence.

## CLI reference

```text
bp730i print <file.pdf|png|jpg> [options]   Print a PDF (all pages or --pages) or an image
bp730i settings [options]                   Send media and print settings only (the printer stores them)
bp730i calibrate | feed | cancel | self-test
bp730i status | config | version            Ask the printer (needs --host, TCP 9100)
bp730i raw <file|->                         Send a file of printer commands unchanged
bp730i setup [--queue NAME] [--uri URI]     Create the raw CUPS queue (macOS)
```

Label and media options (all lengths in mm):

| Option | Values | EZPL |
|---|---|---|
| `--size WxL` | width 4..106, length 3..762; `print` default 100x150 | `^W`, `^Q` |
| `--gap MM` | gap media (default type, 2 mm) | `^Qlen,gap` |
| `--mark MM`, `--mark-offset MM` | black-mark media | `^Qlen,mark,offset±` |
| `--continuous MM` | continuous media, extra feed (0 for none) | `^Qlen,0,feed` |
| `--sensor TYPE` | `reflective`, `see-through`, `auto` | `^G` |
| `--method TYPE` | `dt` direct thermal, `tt` thermal transfer | `^AD`, `^AT` |
| `--darkness N` | 0..19 | `^H` |
| `--speed N` | 2..5 inch/s | `^S` |
| `--mode MODE` | `tear`, `peel`, `cut`, `batch-cut` | `^O`, `^D` |
| `--cut-every N` | with `--mode cut` | `^Dn` |
| `--stop MM` | 0..40, stop position after print | `^E` |
| `--home-x MM` | 0..33.78 (399 dots), printer left margin | `^R` (dots) |
| `--home-y MM` | -8.47..8.47 (±100 dots), printer vertical offset | `~Q` (dots) |
| `--mirror`, `--inverse` | whole label | `^LM`, `^LI` |

A setting you leave out produces no command. The printer then keeps its stored value, like "Use Current Printer Settings" in the Windows driver. The printer stores every setting except `--mirror` and `--inverse` permanently. In EZPL the label length and the media type are one command (`^Q`), so `--size` without `--mark` or `--continuous` also sets gap media with a 2 mm gap. The library itself sends `^Q` only when the settings name a media type.

This printer's configuration label shows `^S5 ^H8 ^E16`, `^W100 ^Q150,2`, `^R000 ~Q+0`, `^D0 ^O0 ^AD` and a see-through sensor. Labelident's support PDF gives useful stop positions: 12..16 mm for tearing and 28..30 mm with a cutter. Use the `=` form for negative values: `--home-y=-2`.

Image options:

| Option | Default | Meaning |
|---|---|---|
| `--pages RANGE` | all | PDF pages: `2`, `2-4`, `3-` |
| `--scale MODE` | `fit` | `fit` keeps the whole image, `fill` crops to cover the label, `none` keeps 300 dpi size. The image is centered. |
| `--rotate DEG` | `auto` | `auto`, `0`, `90`, `180`, `270`, clockwise. `auto` turns by 90 when page and label orientation differ. |
| `--dither MODE` | `threshold` | `threshold`, `floyd-steinberg`, `ordered` |
| `--threshold N` | `128` | Gray levels below N print black |
| `--offset-x MM`, `--offset-y MM` | `0` | Move the image on the label (in the raster, not on the printer) |
| `--copies N` | `1` | Copies of each page |

PDFs render at 300 dpi, the printer resolution. Output options: `--queue NAME` (default `BP730i_RAW`), `--host HOST` and `--port N` (default 9100) for TCP, `--output FILE` (`-` for stdout), `--dry-run`, and `--preview DIR`.

### Queries need TCP

CUPS USB queues are one-way, so `status`, `config` and `version` work only with `--host`. Over USB you can still print the configuration label with `bp730i self-test`.

```sh
bp730i status --host 192.168.1.50     # ~S,STATUS, decoded
bp730i config --host 192.168.1.50     # ^XGET,CONFIG: the configuration label as text
```

Direct USB access without CUPS is not included. On macOS it needs libusb or IOKit bindings, which are native code. The CUPS raw queue already passes bytes through unchanged.

## Use the library

```ts
import { DEFAULT_IMAGE_OPTIONS, encodeJob, renderLabels, send } from "bp730i";

const settings = {
  widthMm: 100,
  lengthMm: 150,
  sensing: { kind: "gap", gapMm: 2 },
  method: "direct-thermal",
  darkness: 8,
  speedIps: 4,
} as const;

const pages = await renderLabels("label.pdf", settings, { ...DEFAULT_IMAGE_OPTIONS, dither: "floyd-steinberg" });
const job = encodeJob({ settings, pages, copies: 1 });
await send({ kind: "cups", queue: "BP730i_RAW" }, job);
// or: await send({ kind: "tcp", host: "192.168.1.50", port: 9100 }, job);
```

`encodeJob` and `encodeSettings` validate the settings and throw one error that lists every value out of range. `CONTROLS` holds the one-way commands (calibrate, feed, cancel, self-test) and `QUERIES` the commands that answer (status, config, version). `exchange` sends bytes over TCP and returns the printer's answer, and `describeReply` decodes a status answer.

## Check the commands on the printer

Run this on the Mac with the printer connected and the 100 x 150 mm labels loaded:

```sh
bun scripts/hardware-check.ts                         # over CUPS
bun scripts/hardware-check.ts --host 192.168.1.50     # over TCP, adds the query steps
```

The script covers only the commands that are still unverified, in 8 steps (11 with `--host`), and uses about 18 labels. It first asks you to switch the printer off and on, so that its EZPL job is the first job after power-on (see [Language lock](#language-lock)). The first two steps store test values and print configuration labels that must show them. At the end, also after an error or Ctrl-C, the script restores this printer's values (`--stop 16 --home-x 0 --home-y 0 --sensor see-through`) and prints a configuration label to confirm them. It saves the answers after each step. Each step says what you should see, then asks `y`, `n` or `s` (skip) and an optional note. The answers go to `hardware-check-<time>.md`.

For each step marked "as expected", set the command to verified in `src/reference.ts`, then run `bun run docs:commands` to update the table below.

## Can plain commands replace the Windows driver?

**Yes. Every label-size and media setting of the Windows driver is a plain EZPL command.** The Seagull driver has no side channel. Its print module writes all settings into the same byte stream as the label, and its config module sends a few utility commands (`~S,SENSOR`, `^G`, `^XSET,MEMORY`, `~V`, `~T`, `~X1..5`) over the same port. "Use Current Printer Settings" sends nothing. This library sends the same commands or leaves them out in the same way, with one small difference: for an absolute stop position the driver sends `^E` twice (whole mm, then one decimal), and this library sends only the decimal form.

The printer has many more features: native fonts and barcodes, stored graphics and formats, compression, counters, status replies, and `^XSET` settings. [docs/reverse-engineering/coverage.md](docs/reverse-engineering/coverage.md) lists every feature found in the driver, GoLabel and the manual, with the decision whether this library uses it and why. You can send any of them with `bp730i raw`.

Settings that need a person, not a command: moving the media sensor, loading ribbon and media, and the network settings in the web interface.

## Command reference

`Q` and `E` are EZPL commands without a prefix. Sources: `GDX-PM`/`GDX-CM` are the Windows driver's EZPL print and config modules (Ghidra function address). `GL` is decompiled GoLabel II 2.1.9558 (file and line). `EZPL m.N` is page N of the Godex EZPL Programmer's Manual Rev. O.4, used only as a cross-check. The full evidence, with string offsets, is in [docs/reverse-engineering](docs/reverse-engineering/).

<!-- command-table:start -->

| Syntax | Used for | Source | Hardware |
|---|---|---|---|
| `^AD` | --method dt | GDX-PM FUN_18000c280; GL Setup.cs:396; EZPL m.19 | **unverified** |
| `^AT` | --method tt | GDX-PM FUN_18000c280; GL Setup.cs:396 | **unverified** |
| `^On, n=0 none, 1 peel, 2 applicator` | --mode (peel = 1, else 0) | GDX-PM FUN_18000b1b0; GL Setup.cs:412; EZPL m.26 | **unverified** |
| `^Dn, n=0 off, n=cut every n labels` | --mode cut --cut-every n | GDX-PM FUN_18000b1b0; GL Setup.cs:419; EZPL m.22 | **unverified** |
| `^Db` | --mode batch-cut (one cut at job end) | GL Setup.cs:415 (not in Windows driver or manual) | **unverified** |
| `^Sn, n=2..5 ips` | --speed | GDX-PM FUN_18000b1b0, FUN_180009620; .d Model.d:5420; EZPL m.30 | verified |
| `^Hn, n=0..19` | --darkness | GDX-PM FUN_18000c2f0 case 5; GL PrinterModel.xml BP730i; EZPL m.24 | verified |
| `^Gn, n=0 reflective, 1 see-through, 2 auto` | --sensor | GDX-CM FUN_180003bb0; GL PrinterSetup.cs:6124; EZPL m.24 (manual contradicts itself on 0/1) | **unverified** |
| `^Rn, n=0..399 dots` | --home-x (left margin) | GL Setup.cs:403; EZPL m.30 (not emitted by Windows driver) | **unverified** |
| `^C1` | always 1 (copies via ^P) | GDX-PM FUN_18000b1b0 type 4 | verified |
| `^Pn, n=1..9999` | --copies (per page) | GDX-PM FUN_18000bab0; .d Method.d Copies.Limit | verified |
| `^Qlen,gap (mm, 1 decimal), e.g. ^Q150.0,2.0` | --size L, --gap | GDX-PM FUN_18000bd50; GL Setup.cs:370; EZPL m.28 | verified |
| `^Qlen,mark,offset+/- \| ^Qlen,0,feed (mm, 1 decimal)` | --mark / --continuous | GDX-PM FUN_18000bd50; GL Setup.cs:370; EZPL m.28 | **unverified** |
| `^Wn (whole mm)` | --size W | GDX-PM FUN_18000b570 type 10; GL Setup.cs:383; EZPL m.31 | verified |
| `~Q+n / ~Q-n, dots -100..100` | --home-y | GDX-PM FUN_18000c780; GL Setup.cs:406; EZPL m.79 | **unverified** |
| `^En (mm, 1 decimal)` | --stop | GDX-PM FUN_18000c2f0 case 3; GL Setup.cs:422; EZPL m.23 | **unverified** |
| `^L` | begin label | GDX-PM FUN_18000bc50; EZPL m.25 | verified |
| `^L[M][I]` | --mirror, --inverse | GDX-PM FUN_18000bc50; .d Features.d [Godex_PlusSeries]; EZPL m.25 | **unverified** |
| `Qx,y,bytesPerRow,rows<CR> + raw rows, 1 = black, MSB left` | every image | GDX-PM FUN_180006900; GL PrintJob.cs:2169 (LF instead of CR); EZPL m.114 | verified |
| `E` | end label, print | GDX-PM FUN_18000bb80; GL QLabel.cs:4409 | verified |
| `~S,SENSOR` | calibrate | GDX-CM FUN_180002810; GL SvgArtiste.cs:5513; EZPL m.82 | **unverified** |
| `~S,FEED` | feed | EZPL m.84 only | **unverified** |
| `~S,CANCEL` | cancel | GL SvgArtiste.cs:10275; EZPL m.84 | **unverified** |
| `~V` | self-test (prints the configuration label) | GDX-CM FUN_180002810; GL SvgArtiste.cs:5404; EZPL m.85 | verified |
| `^XSET,IMMEDIATE,1` | sent before status | GDX-CM FUN_180001430; EZPL m.44 | **unverified** |
| `~S,STATUS -> aa,nnnnn` | status (TCP) | GDX-CM FUN_1800010a0 / FUN_1800010c0; EZPL m.84 | **unverified** |
| `^XGET,CONFIG` | config (TCP) | GL SvgArtiste.cs:8457; EZPL m.31 | **unverified** |
| `~B` | version (TCP) | GL TestInterface.cs:178; EZPL m.70 | **unverified** |

<!-- command-table:end -->

## Reverse-engineering notes

These are the main findings. The details are in [docs/reverse-engineering](docs/reverse-engineering/). [coverage.md](docs/reverse-engineering/coverage.md) lists every printer feature with the decision whether this library uses it.

- **The driver is a Seagull Scientific "Drivers by Seagull" build.** It is not a Godex driver. `Generic_BP_v2023.2.exe` is an InstallShield self-extractor (SHA-256 `d5508861…c8772`). It holds `BarcodePrinter.inf`, CAB files with the DLLs, and `.ddz` ZIP files with plain-text model tables (`Model.d`, `Features.d`, `Driver.d`).
- **The queue name decides the language.** `BP730i` uses the GDX (EZPL) module. `BP730i GZPL` uses the ZPL module and `BP730i GEPL` the EPL module. All three map to the model entry `Godex_RT730i`.
- **Model limits come from `Model.d [Godex_RT730i]`.** They are 300 dpi, printable width 105.7 mm, speeds 2..5 in/s, darkness default 8, cutter and stripper supported. GoLabel's `PrinterModel.xml` adds darkness 0..19, width 4..106 mm and length 3..762 mm.
- **EZPL images are raw bitmaps.** The driver and GoLabel send `Qx,y,bytesPerRow,rows`, then raw rows with 1 as a black dot and the most significant bit on the left. The driver ends the header with CR and GoLabel with LF. This library uses CR, as the manual's general rule says. The driver skips blank 8-row bands and pads the last band to a multiple of 8 rows. That is a side effect of its band splitter, not a firmware rule: GoLabel does not pad, and the exact height printed correctly. This library sends the full page with the exact height.
- **The GoLabel download URL in the task returns HTTP 403.** The current GoLabel link on the [BP730 product page](https://www.labelident.com/bp730.html) works (SHA-256 `a08d5b39…4c067`). GoLabel II 2.1.9558 is a .NET program. ILSpy decompiles it to C#.
- **The sources disagree on `^G`.** The EZPL manual gives `^G0`/`^G1` opposite meanings on two pages. The hardware check settles `^G1` through the configuration label.
- **Neither the driver nor GoLabel handles the language lock.** No module sends a language switch, and no command brings a ZPL-locked printer back to EZPL. Only a power cycle does.

To repeat the extraction, run `bun tools/re/fetch-and-unpack.ts [dir] [--ghidra] [--ilspy]`. It downloads the driver, GoLabel, the EZPL manual and the RT730i manual, checks their SHA-256 and unpacks them. With `--ghidra` it decompiles the four driver modules with Ghidra headless (`GHIDRA_HOME` must be set). With `--ilspy` it decompiles the GoLabel assemblies (`ILSPYCMD` or `ilspycmd` on the PATH). The Ghidra scripts and the helper scripts that the analysis used are in `tools/re/`.

## Develop

```sh
bun run check        # tsc, biome, README table check, tests
bun run format       # biome with fixes
bun scripts/make-sample-pdf.ts samples/sample-100x150.pdf   # synthetic 2-page test PDF
```
