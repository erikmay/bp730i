# BP730i feature coverage

This file lists every printer feature and command group found in the Windows driver, GoLabel II and the vendor documents. For each one it records whether this library uses it, and why.

The rule for every decision: a feature belongs in the library only if it helps to print shipping labels (100 x 150 mm, 2 mm gap, direct thermal, no cutter, no peeler) or product labels from a PDF or image on a Mac. The library renders every label to one bitmap. A printer feature that duplicates what the bitmap already contains has no value here.

Decisions:

- **Included**: the library sends it.
- **Left out**: the library does not send it, for the reason given. `bp730i raw` can still send it.
- **Document only**: not sent, but the fact matters for users or for a later decision.

## Sources

Short names in the "Source" column:

| Key | Meaning |
|---|---|
| `GDX` | Second pass over the Windows EZPL driver: [second-pass/gdx-driver.md](second-pass/gdx-driver.md) (section number). Ghidra addresses and `.d` lines are in that file. |
| `ZEB` | Second pass over the ZPL, EPL and base modules and the INF: [second-pass/zpl-epl-base.md](second-pass/zpl-epl-base.md). |
| `GL` | Second pass over GoLabel II 2.1.9558: [second-pass/golabel.md](second-pass/golabel.md). C# file and line are in that file. |
| `M` | EZPL Programmer's Manual Rev. O.4, printed page. Details in [second-pass/manual.md](second-pass/manual.md). |
| `UM` | RT730i user manual (German), PDF page. |
| `HW` | Hardware test on the BP730i, 2026-10-09 (firmware `BP730i V1.00F`, USB, CUPS raw queue). |

The first-pass notes ([ezpl-driver.md](ezpl-driver.md), [zpl-driver.md](zpl-driver.md), [golabel-and-docs.md](golabel-and-docs.md)) hold more detail. Where they disagree with the second pass, the second pass is correct. Each second-pass file has a "corrections" section.

## Command language

| Feature | Commands | Source | Decision | Reason |
|---|---|---|---|---|
| EZPL (Godex native) | all below | GDX; GL; M | **Included** | The only language. Hardware-verified for the full image job. Every media setting has a command. Images are raw binary. |
| GZPL (ZPL emulation) | `^XA ... ^XZ`, `^GFA`, `~DG`, `~SD`, `^MM` ... | ZEB 1; [zpl-driver.md](zpl-driver.md) | **Left out** (removed in this pass) | Its image path worked (HW), but it adds nothing for PDF labels. It has no command for gap size, stop position or sensor type, its darkness scale was a guess, and hex images are twice the size. Above all, mixing languages triggers the language lock. The last version with ZPL is commit `522ef90`. |
| GEPL (EPL emulation) | EPL module, `ESC G` / `ESC B` session escape in GoLabel | ZEB 2; GL 2b | **Left out** | Same reasons as GZPL. Never tested. |
| Automatic language detection and its lock | none (printer behaviour) | HW; M p.84 | **Document only** (README "Language lock") | In "Auto", the first job after power-on fixes the language until the next power cycle. M p.84: "When a printer switch to certain language, it can auto detect and switch again by rebooting printer." A library that sends only EZPL cannot cause the lock. |
| Language switch | `~S,ESA`, `~S,ESG`, `~S,ESE`, `~S,ESZ` | M p.84; ZEB 4; GDX 2b; GL 2b | **Left out** (removed in this pass) | Documented only in the EZPL manual, as "Temporary". Neither the driver nor GoLabel sends it. It cannot help after a ZPL lock, because the locked printer ignores EZPL (`~V` was ignored on HW). Inferred: it would need to be a ZPL command to reach a ZPL-locked printer, and none is documented. |
| Language query | none | M (full command list); ZEB 4 | **Document only** | No command reports the active language. `^XGET,LANGUAGE` is the display language. |
| Lock detection over USB | USB device ID per language (guess) | ZEB 3 | **Document only** | The INF has one USB ID per queue language. It is a guess that the printer changes its USB ID with the active language. A check on the Mac: compare `lpinfo -l -v` before and after a ZPL job. |

## Job setup and media

| Feature | Commands | Source | Decision | Reason |
|---|---|---|---|---|
| Print method | `^AD`, `^AT` | GDX 1.1; GL 3.1; M p.19 | **Included** (`--method`) | Needed when a roll changes between direct thermal and ribbon. M p.19: in DT mode the ribbon sensor is off. |
| Label length and gap / mark / continuous | `^Q`, `^QD` | GDX 1.1; GL 3.1; M p.28-29 | **Included** (`--size`, `--gap`, `--mark`, `--continuous`) | Required for every label. `^QD` (dots) adds nothing over mm with one decimal. Changed in this pass: the default gap is 2 mm (this roll), and the library sends `^Q` only when the settings name a media type, so a missing gap no longer overwrites the stored gap with 3 mm. |
| Label width | `^W` | GDX 1.1, 2e; M p.31 | **Included** | Required. |
| Darkness | `^H` 0..19 | GDX 1.1; M p.24; HW | **Included** (`--darkness`) | Verified on HW. M p.44: H16..H19 need `^XSET,HEATUP,1` and work only at 2 ips (inferred from garbled text). Not handled: values above 15 are rarely needed for DT labels. |
| Darkness fine tuning | `^XSET,HEATOFFSET`, `^XSET,HEATUP` | M p.44 | **Left out** | `^H` covers the use case. |
| Print speed | `^S` 2..5 | GDX 1.1; M p.30; HW | **Included** (`--speed`) | Verified on HW. |
| Feed, backfeed, top-of-form speeds | `^SF`, `^SB`, `^SJ`, `^ST`, `^XSET,SPEEDDOWN` | M p.30, p.60 | **Left out** | No label-quality effect. |
| Copies | `^P`, `^C1` | GDX 1.1; M p.20, p.27; HW | **Included** | Verified on HW. `^C` is permanent (M p.20), so every job sends `^C1`: a stale `^C` from another tool would multiply every label. |
| Infinite print, recall print | `^PI`, `^PA`, `~P` | M p.27-28, p.79 | **Left out** | `^P` is enough. `~P` needs stored formats. |
| Stop position | `^E` (mm, one decimal) | GDX 1.1, 2f; GL 1; M p.23 | **Included** (`--stop`) | Tear position for the 2 mm gap roll (this printer: `^E16`). The driver sends an integer `^E` first, inferred as a fallback for firmware before 2016 (M p.23: decimals "starting from the year 2016"). Not needed for firmware V1.00F. Unverified on HW. |
| Relative stop position | `^EA` | GDX 1.1 | **Left out** | Absolute `^E` is simpler and is what GoLabel sends. |
| Left margin, vertical offset | `^R`, `~Q` | GDX 1.1; GL 3.1; M p.30, p.79 | **Included** (`--home-x`, `--home-y`) | Corrects a printer-side offset without changing the PDF. Unverified on HW. |
| Fine position adjust | `~S,OFFSETX`, `~S,OFFSETY` | GL 3.9; M p.81 | **Left out** | Duplicates `^R` / `~Q`. |
| 180 degree rotation | `~R` | GL 3.1; M p.79 | **Left out** | The printer stores `~R255` (no rotation). The library rotates in the raster (`--rotate`). |
| Whole-label rotation | `^L Rn`, `^XSET,ROTATION` | M p.25, p.57 | **Left out** | Done in the raster. `--rotate auto` (new in this pass) turns landscape pages on portrait labels. |
| Mirror, inverse | `^LM`, `^LI` | GDX 1.1; M p.25 | **Included** (`--mirror`, `--inverse`) | Cheap. Unverified on HW. |
| Sensor type | `^G` 0/1/2 | GDX 1.10; GL 3.9; M p.24 | **Included** (`--sensor`) | Needed when changing between gap and black-mark rolls. The manual contradicts itself on 0 and 1. The hardware check verifies the mapping through the configuration label. |
| Sensor for continuous media | `^XSET,SENSING` | M p.58 | **Left out** | No continuous roll in use. |
| Calibration | `~S,SENSOR[,len,gap,pct]` | GDX 1.10; GL 3.9; M p.82 | **Included** (`calibrate`, no parameters) | Needed after a roll change. Parameters are left out: the printer measures. |
| Auto calibration triggers | `^XSET,WHENTOSENSING`, `^XSET,TOPOFFORM` | GL 3.9; M p.61, p.64 | **Left out** | Printer menu settings, set once. |
| Media sensing fine tuning | `^XSET,PAPEROUT`, `^XSET,LENGTHOFFSET`, `^XSET,GEARCOMP`, `^XSET,FIRSTPAGEGEARCOMP`, `^XSET,DISMOFFSET` | M p.43-53; GL 3.9 | **Left out** | Service settings. Note: M p.53 says the paper-out window scales with the declared gap ("Gap*2.5 + n"), one more reason to send the real 2 mm gap. |
| Print across the gap | `^XSET,ACROSSGAP` | M p.37 | **Document only** | Without it, the printer cuts an image at the gap. The library sends exactly one label height (1772 rows = 150.03 mm). |
| Real-length print, label mode | `^XSET,REALLENGTHPRINT`, `^XSET,LABELMODE` | GL 3.9; M p.47, p.56 | **Left out** | For continuous media and for skipping blank labels. Not needed. |
| Feed, backfeed by length | `^M`, `^B` | GL 3.9; M p.19, p.26 | **Left out** | `feed` (`~S,FEED`) covers the use case. The driver emitter supports them but never calls them (GDX 1.1). |
| Feed one label | `~S,FEED` | M p.84 | **Included** (`feed`) | Cheap. Unverified on HW. |

## Cutter, peeler, applicator

| Feature | Commands | Source | Decision | Reason |
|---|---|---|---|---|
| Peel, cut, batch cut | `^O0/1`, `^D0/n`, `^Db` | GDX 1.1; GL 3.1; M p.22, p.26 | **Included** (`--mode`) | Kept: four lines of code, and `--mode tear` sends `^O0 ^D0`, which undoes a stale cutter or peel setting from another tool. This printer has no cutter and no peeler, so `cut`, `batch-cut` and `peel` stay unverified. |
| Applicator | `^O2` | GDX 1.1; M p.26 | **Left out** | Not offered by the driver for the RT730i (no `~Applicator`). |
| Partial cut, double cut, cut now, cut timing | `^XSETCUT,MODE`, `^XSETCUT,DOUBLECUT`, `^XSETCUT,DOCUTTING`, `^XSET,FEEDCUT`, `^XSET,BACKFEEDAFTERCUTTING` | GL 3.1; M p.39-43, p.64-65 | **Left out** | No cutter. |
| Pre-print while waiting | `^XSET,BACKFEED`, `^XSET,SMARTBACK` | GL 3.9; M p.39, p.60 | **Left out** | Only with cutter or peeler. |
| Tear wait time, rewinder, linerless | `^XSET,TEARPAPERTIME`, `^XSET,REWINDER`, `^XSET,LINERLESS` | GL 3.9; M p.49, p.55, p.61 | **Left out** | No such hardware. |

## Images

| Feature | Commands | Source | Decision | Reason |
|---|---|---|---|---|
| Raw inline bitmap | `Qx,y,bytesPerRow,rows` + raw rows | GDX 1.2, 2a; GL 2c; M p.114; HW | **Included** | Verified on HW. Header ends with CR, like the driver. GoLabel uses LF. M p.18: CR ends every command. Height is the exact label height. The driver pads to a multiple of 8 rows because its band splitter works on 8-row blocks, not because the firmware needs it (GDX 2a). GoLabel does not pad (GL 2c), and the manual states no row rule (M p.114). Both points worked on HW, so no change. |
| Blank band skipping | driver splits the page into bands, skips blank 8-row blocks, trims blank bytes | GDX 1.2, 2a | **Left out** | Saves bytes only. A 100 x 150 mm label is 256 KiB, which takes well under a second over USB and uses 18 % of the 1500 KB image buffer (UM p.39). |
| Zlib-compressed bitmap | `QA` + zlib stream (`78 9C`, deflate, Adler-32) | GL 2a; M p.114 | **Left out** | Untested on this firmware, and off by default in GoLabel. The driver never uses it (GDX 1.2). The header has no compressed length, so a wrong stream would desynchronise the parser (inferred). The gain is transfer time only, which is not a bottleneck. |
| Stored graphic | `~MDELG`, `~EB`/`~Ep`/`~EN` (BMP, PCX, PNG), `~I` (RAM), `Y` | GDX 1.3; GL 3.2; M p.71-73, p.126 | **Left out** | Saves transfer for repeated logos. Each PDF already holds the full label, and stored files add state (512 KB limit, duplicate names, full memory). |
| Graphic mode | `~G` + `Gw` rows | M p.72, p.105 | **Left out** | No advantage over `Q`. |
| Overlap mode, DPI emulation | `^XSET,DRAWMODE`, `^XSET,DPIEMULATE` | GL 3.1; M p.42 | **Left out** | One bitmap per label has nothing to overlap. 150 dpi emulation lowers quality. |
| 1-bit threshold | (host side) GoLabel: green channel <= 192 is black; library: gray < 128 is black | GL 4 item 17 | **Document only** | Pure black-and-white shipping labels print the same. Light gray on product labels prints black in GoLabel and white here. Use `--threshold 193` to match GoLabel, or a dither mode. |

## Native rendering

| Feature | Commands | Source | Decision | Reason |
|---|---|---|---|---|
| Printer fonts and TrueType text | `A`, `AT`, `V`, `AZ`; `~H,TTF`, `~J`, `~C`, `~F` downloads; `^XSET,CODEPAGE`, `^XSET,UNICODE` | GDX 1.4; GL 3.3, 3.7; M p.89-91 | **Left out** | The PDF already contains the text. |
| Native barcodes | 1D `B…` (Code 128 `Q`, GS1-128 `BU`, EAN/UPC, Code 39 ...), QR `W`, DataMatrix `XRB`, PDF417 `P`, MaxiCode `M`, Aztec `Z`, GS1 DataBar `B5n` | GDX 1.5; GL 3.4; M p.92-126 | **Left out** | Carrier PDFs already contain the barcodes. Using native barcodes would mean parsing and re-laying out the PDF. At 300 dpi, `--scale none` or an unscaled 100 x 150 mm page keeps module widths exact (the 1 % rule in `raster.ts`). Revisit only for self-designed product labels with tight barcode grades. |
| Lines, boxes | `Lo`, `Le`, `Ls`, `R`, `H` | GDX 1.6; GL 3.5; M p.106-114 | **Left out** | Part of the bitmap. |

## Stored formats, variables, counters, clock

| Feature | Commands | Source | Decision | Reason |
|---|---|---|---|---|
| Stored formats | `^F`, `^K`, `~P`, `AUTOFR` | GDX 1.3; GL 3.6; M p.23-25, p.88 | **Left out** | For standalone printing. The Mac renders each label. |
| Variables, counters, database | `V`, `V#…`, `C`, `FILEDB`, `~L,DBASE`, `~L,SERIAL` | GDX 1.7; GL 3.6; M p.101-123 | **Left out** | Serial numbers on product labels belong in the PDF. |
| Real-time clock | `~D`, `^XGET,RTC`, `^D`, `^T` | GDX 1.7; GL 3.8; M p.21, p.71 | **Left out** | Dates are rendered on the Mac. |
| File management | `~MDEL`, `~MDIR`, `~MCPY`, `~MGETF`, `~X1`..`~X9`, `^XSET,MEMORY`, `^XSET,FORMAT` | GDX 1.10; GL 3.7; M p.43, p.74-87 | **Left out** | The library stores nothing on the printer. |

## Status, queries, recovery

| Feature | Commands | Source | Decision | Reason |
|---|---|---|---|---|
| Status | `^XSET,IMMEDIATE,1` + `~S,STATUS` -> `aa,nnnnn` | GDX 2d; M p.44, p.84 | **Included** (`status --host`) | Shows paper out, head open and labels left. Only over TCP: CUPS USB is one-way on the Mac. `^XSET,IMMEDIATE` is permanent, and the manual contradicts itself on its default, so it is sent each time. Unverified on HW. |
| Short status | `~S,CHECK` -> `aa` | GL 1; M p.80 | **Left out** | `~S,STATUS` gives the same code plus the label count. |
| Configuration as text, firmware version | `^XGET,CONFIG`, `~B`, `~BOK` | GL 2b; M p.31, p.70 | **Included** (`config`, `version` with `--host`) | Reads the stored settings without printing. Unverified on HW. |
| Configuration label | `~V` | GDX 1.10; M p.85; HW | **Included** (`self-test`) | Verified on HW. Works over USB and shows every stored setting, so the hardware check uses it to verify `^E ^R ~Q ^AD ^O ^D ^G`. |
| Other queries | `^XGET,PRINTINFO` (counters), `^XGET,SENSORSTATUS`, `^XGET,TPHRESISTANCE`, `^XGET,APPINFO2`, `~X6` (odometer) | GL 3.9; M p.31-36, p.86 | **Left out** | No label use case. Send with `raw` over TCP when needed. |
| Push status | `^XSET,ACTIVERESPONSE` + `~K1` (one `Y` per printed label) | GL 2d; M p.38, p.73 | **Left out** | GoLabel's optional per-label progress. Only useful over TCP for long jobs. `~S,STATUS` covers the need. |
| Cancel | `~S,CANCEL` | GL 3.9; M p.84 | **Included** (`cancel`) | Stops a wrong job. GoLabel uses it. Unverified on HW. If it does not stop printing, try `~S,BUFCLR` ("stop printing immediately and clean printer buffer", M p.84) with `bp730i raw`. |
| Pause, buffer clear | `~S,PAUSE`, `~S,BUFCLR` | M p.84 | **Document only** | See cancel. |
| Restart | `~Z` | GDX 1.10; GL 3.9; M p.87 | **Left out** (removed in this pass) | The power switch does the same, and a power cycle also clears the language lock. The driver names its `~Z` job "Print Configuration", so the meaning was uncertain. |
| Factory defaults | `^Z`, `~~INTERNALCOMMAND+INIT` | M p.69 | **Left out** (removed in this pass) | Rarely needed and destructive. The printer menu has "Einstellungen zurücksetzen" (UM p.37). |
| Print-head test, hex dump | `~T`, `~S,DUMP` | GDX 1.10; GL 3.9; M p.81, p.84 | **Left out** | Service functions. `~S,DUMP` is useful for debugging with `raw`. |
| Reprint after error | `^XSET,ERRORPRINT` | M p.43 | **Document only** | Decides whether a label is printed again after a media error. The printer default is kept. |
| Standby | `^XSET,STANDBY` | M p.60 | **Document only** | Must stay 0. With 1 the printer shuts all ports after about 100 s until FEED is pressed. |

## Connection

| Feature | Commands | Source | Decision | Reason |
|---|---|---|---|---|
| USB through CUPS raw | `lp -o raw` | HW | **Included** | Verified on HW. One-way. |
| TCP port 9100 | raw socket | ZEB 3; GL 2d | **Included** (`--host`) | Prints over the network and is the only way to read answers on a Mac. Unverified on HW. |
| Direct USB (bidirectional) | usbprint / `Trace.dll` on Windows | GL 2d | **Left out** | Needs native code on macOS. Out of scope by the task. |
| Network settings | `^NS`, `^NT`, `^NR`, `^NA`, `^NL`, `^NH`, `^XSET,ALIAS`, `^NTCPCONNECTMODE`, `^XSET,NETSOCKETIDLETIME`, 802.1X `~L,...` | GL 3.10; M p.51, p.128-135 | **Left out** | Set once in the web interface. `^NTCPCONNECTMODE` and `NETSOCKETIDLETIME` can explain a TCP 9100 hang when another socket stays open (M p.135, inferred). |
| Network discovery | UDP 8888 `Where is Godex Printer?`, replies on UDP 6666; TCP 4900 | GL 4 items 7-8 | **Left out** | The printer's IP address is known or fixed. |
| Wi-Fi, Bluetooth | `^NW,...`, BLE service | GL 3.11; M p.131-142 | **Left out** | The BP730i has neither (GoLabel model entry). |
| Status ports | driver polls status only on serial and USB for the RT730i | ZEB 1; GDX 1 | **Document only** | Windows only. The Mac has no bidirectional USB path through CUPS raw. |

## Other

| Feature | Commands | Source | Decision | Reason |
|---|---|---|---|---|
| Display, keys, buzzer, keyboard, password | `^XSET,LANGUAGE`, `^XSET,BUZZER`, `^XSET,KEYBOARD`, LCD `^XSET` items, `~N`, `~F`, `^XSET,PASSWORD` | GL 3.9; M p.37-69 | **Left out** | Printer menu settings. |
| Serial port | `^Y` | M p.69 | **Left out** | Not used. |
| RFID | `^RW`, `^RS`, `RFW`, `~HE` | GDX 1.8; GL 3.1 | **Left out** | No RFID in the RT730i model. |
| Firmware update | `Trace.dll Download_FW` (`~O ... GODEX_FW_MARK_STRING`) | GL 3.11 | **Left out** | Unused by GoLabel and only partly understood. Use the vendor tool. |
| User commands at job start or end | driver "Send Printer Command" phases | GDX 1.9 | **Left out** | `bp730i raw` covers it. |
| Stock presets | driver stock list (4x6 in = 101.6 x 152.4 mm ...) | GDX 1.12 | **Document only** | The CLI default is this printer's roll: 100 x 150 mm with a 2 mm gap, from its configuration label (`^W100 ^Q150,2`). Other rolls use `--size` and `--gap`. A profile file was rejected: one default plus two flags covers two label sizes. |
