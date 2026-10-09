# Seagull GDX driver (EZPL) for BP730i / Godex RT730i: second pass

Driver: Seagull "xg#gdx" 2023.4.1.0. Queue `BP730i` uses `Driver.d:396` -> `Model.d:5394 [Godex_RT730i]`.
This file extends `docs/reverse-engineering/ezpl-driver.md` (called "previous analysis" below).

## Sources and citation keys

- `PM:L<n>` = `work/decomp/Seagull_PrintModule_GDX.c` line n (function VA in the text).
- `CM:L<n>` = `work/decomp/Seagull_ConfigModule_GDX.c` line n.
- `PB:L<n>` = `work/gdx-deep/decomp/Seagull_PrintBase.c` (new full decompile, this pass).
- `DC:L<n>` = `work/gdx-deep/decomp/Seagull_DriverCore.c` (new full decompile, this pass).
- `PBsel:L<n>` = `~/re-bp730i/work/decomp/PrintBase.sel.c` (previous selected decompile).
- `ZCM:L<n>` = `work/decomp/Seagull_ConfigModule_ZPL.c` (used only for cross-reference).
- `.d` files: `drv/ddz/xg#gdx_2023.4.1.0/<file>:<line>` (line numbers after CR removal).
- `EZPL:pNNN` = `txt/ezpl/pNNN.txt` (text of `dl-ezpl/EZPL_O.4_EN.pdf`).
- `STR:<id>` = string table ids. Extracted with 7z to `work/gdx-deep/rsrc/` (`base_strings.txt`,
  `gdx_strings.txt`, `status_strings.txt`).
- `HELP:<page>` = CHM help text in `work/gdx-deep/chmtxt/` (made from `~/re-bp730i/work/chm`).
- `CMVT` = `work/gdx-deep/CM_GDX.vtables.txt` (new vtable dump of the ConfigModule).
- All paths are relative to `/home/agent/re-bp730i-deep/` unless absolute.
- "Inferred" marks a conclusion that the code does not state directly.

## RT730i data-file profile (what gates what)

| Item | Value for RT730i | Source |
|---|---|---|
| Features | `Godex_PlusSeries`: `Action.Cut=Continuous,Interval`, `Status.Ports=Serial,USB`, `Stock.Continuous.VariableLength=true`, `~Command.BeginLabelFormat=^L`, `MirrorInverseOptions=true`, `~Command.EndLabelFormat=E`, `~Command.LabelLength=Q` | Features.d:78-85 |
| Method | `EZPL`: `Cache.Format=true`, `Cache.Graphic=true`, `Copies.Limit=9999`, `Serialization=true` (count/step limit 9999), `StaticFields=true`, `TemplateExport=true` (name pattern `[A-Za-z][A-Za-z0-9]{0,19}`), `VariableData=true` | Method.d:4-23 |
| Drawing | `EZPL_Mirror`: `Box=true` (no fill), `Line=true` (no diagonal, pens Black and Inverse), `Text.Rotation=90`, `Transform.Inverse=true`, `Transform.Mirror=true`, `Transform.Origin=Adjustable`, `Transform.System=ES` | Drawing.d:63-91 |
| Font | `Standard`: `Download.Bitmap=true`, `Download.TrueType=true`, resident group CG Triumvirate 6..30 pt, code page 850 (`CP850-Euro.pcp`) | Font.d:7-17, FontGroup.d, FontEncoding.d |
| BarCode | `EZPL_1XXXPlus_2DPlus_Aztec` (list below) | BarCode.d:638-823 |
| Ports | `Ports.Bidirectional=Serial,USB`, `Ports.PNP.ID+=GODEX_RT730i0096` | Model.d:5401-5403 |
| Resolution | 300 | Model.d:5404 |
| Stock | default 4.00 x 4.00 in; min 1.00 in x 3 mm; max 118 mm x 30 in; printable 105.7 mm x 30 in; `Stock.Tracking=Center`; `Stock.UnprintableWidth=0 in` | Model.d:5405-5414 |
| Options | `~Cache.DefaultSize=64`, `~Cutter=yes`, `~Darkness.Default=8`, `~Memory.Configuration=true`, `~PrintMode=Direct Thermal,Thermal Transfer`, `~Speeds.Print=2..5 in/sec`, `~Stripper=yes` | Model.d:5415-5421 |
| Absent keys | no `~Applicator`, no `RFID=`, no `~PrintMode.Default`, no `~MediaType.Default`, no `~GapLength.Default`, no `~StopPosition.*`, no `~RowOffset.*`, no `~UseCurrentPositionAdjustmentsByDefault`, no `~Speeds.Print.Default`, no `~TPL`, no `~GraphicProductsFalcon` | Model.d:5394-5421 |
| Manufacturer | `Godex_Generic` = CompanyName "Barcode Printer" | Driver.d:397, Manufacturer.d:68-71 |

Effects of the absent keys (code defaults in `FUN_18000a2b0` PM:L5903 and `FUN_18000ab40` PM:L6136):
print method default "use current" (-1); media type default gaps; gap 3.0 mm; mark width 3.0 mm;
stop position 0; row offset range -100..+100 dots; stop position range -40..+40 mm;
position adjustments default "use current" (true); post-print action None; occurrence After Every Label;
interval 1. Applicator is reset to None at validation because `~Applicator` is absent (PM:L6248-6256).
Graphic cache size is 64 KiB (`FUN_180001030` PM:L12, `~Cache.DefaultSize << 10`).

## 1. Feature inventory

All lines end with CR LF unless noted (`endl`, previous analysis). Coordinates are dots.

### 1.1 Job and label setup

These are in the previous analysis and are confirmed. Additions only:

| Command | Syntax | RT730i gate | Evidence |
|---|---|---|---|
| Print method | `^AT` / `^AD` | sent only if the user picks a method; default "use current" | PM:L6372-6376, `FUN_18000c280` PM:L6975 |
| Post-print | `^O0` none or cut, `^O1` peel, `^O2` applicator | applicator not offered (no `~Applicator`) | PM:L6382-6432, CM:L3229-3248 (UI adds Peel/Cut/Applicator only if model flag), STR:7410-7412 |
| Cutter | `^D1` (every label), `^D<n>` (interval), `^D0` (off) | `~Cutter=yes` | PM:L6392-6409, `FUN_18000b790` PM:L6567, `FUN_18000c9a0` PM:L7268 |
| Speed | `^S<n>`, n from `~Speeds.Print` | sent only when "Use current printer speed" is off (cfg 0x454 bit 2, default on) | PM:L6434-6479 |
| Darkness | `^H<n>`, 0..19 | sent only when "Use current darkness" is off (bit 3, default on) | PM:L6480-6484 |
| Copies per label | `^C1` | always (no `~Suppress.CopiesPerLabel`) | PM:L6485-6494 |
| Copies | `^P<n>` | 1..9999 | PM:L6711 |
| Label length | `^Q<len>,<gap>` / `^Q<len>,<mark>,<off>+|-` / `^Q<len>,0,<feed>`; mm with 1 decimal | `~Command.LabelLength=Q` | PM:L6816-6970 |
| Label width | `^W<mm>` | value from `prtdev::GetPrinterPageWidth` (see 2e) | PM:L79-86, L6546-6549 |
| Start position | `~Q+n` / `~Q-n` / `~Q0` | only when "use current position adjustments" is off | PM:L6550-6553, L7163 |
| Stop position | absolute `^E<int>` CRLF `^E<int>.<d>`; relative `^EA<int>.<d>` | same gate as `~Q` | PM:L7017-7037 |
| Begin/end | `^L[M][I]` ... `E` | MirrorInverseOptions=true | PM:L6780-6811, L6752 |
| Unused emitter letters | `^B<mm>`, `^M<mm>`, `^R<n>` | the type-id emitter `FUN_18000c2f0` supports type 1 `B`, 2 `M`, 8 `R`, but no caller builds these types | PM:L7010-7062; only types 3,4,5,6,7,9,10 are built (PM:L6387-6493, L6546-6558) |

### 1.2 Bitmap paths

| Path | Syntax | When | Evidence |
|---|---|---|---|
| Direct raster | `Q<x>,<y>,<bytesPerRow>,<rows>` CR, raw rows, CR LF | see 2c | `field_segment` output PM:L3710-3753 |
| Cached/temporary PCX | `~MDELG,<name>` CRLF, `~Ep,<name>,<size>` CR, PCX file, CRLF; then `Y<x>,<y>,<name>` CRLF in the format | see 2c | PM:L3425-3472, L7118-7136 |
| Falcon raster | `Q<n>,<w>,<h>` LF + data | only `~GraphicProductsFalcon` (not RT730i) | PM:L4248-4288 |

No zlib/`QA` path exists. The PrintModule contains no `"QA"` string (string list of PM).
The EZPL manual documents `QA` (zlib) at EZPL:p102 lines 35-47, but the driver does not use it.

### 1.3 Graphic and format caching (BarTender "optimizations")

| Command | Syntax | Evidence |
|---|---|---|
| Store format | `^FFORMAT_<n>` CRLF, body, `E` CRLF | PM:L104-123, name PM:L42-56 |
| Recall format | `^KFORMAT_<n>` CRLF, variable data, [`Le,...` inverse], `E` CRLF, `~P<n>` CRLF | PM:L172-202 |
| Delete | `~MDEL<t>,<name>`; t = `F` format, `G` graphic, `C` TTF, `E` bitmap font | PM:L6612-6677 |
| Store graphic | `~MDELG,GRAPHIC_<n>` then `~Ep,GRAPHIC_<n>,<size>` CR + PCX | PM:L3453-3470 |
| Recall graphic | `Y<x>,<y>,GRAPHIC_<n>` | PM:L3443-3448 |
| Print sample (cache viewer) | `^L` `Y10,10,GRAPHIC_<n>` `E`; format sample `E` `~P1` | PM:L313-339, L255-269 |

The manual limits `~E` images to 512 KB and rejects a duplicate name (EZPL:p059 lines 25-34).
That explains the delete before each store (inferred).

### 1.4 Native text and font download (not in previous analysis in detail)

| Command | Syntax | Evidence |
|---|---|---|
| Resident font text | `A<font>,<x>,<y>,<xmag>,<ymag>,0,<rot>,<data>` CRLF; magnification 1..8 | PM:L4988-5019, L5043-5045 |
| Downloaded TTF text | `AT<id>,<x>,<y>,<w>,<h>,0,<rot>,0,1,<data>` CRLF | PM:L5020-5045 |
| Downloaded bitmap font text | `V<id>,<x>,<y>,<xmag>,<ymag>,0,<rot>,<data>` (prefix `V` + file id) | PM:L4994-4999 |
| White-on-black text | `Lo,x1,y1,x2,y2` + `Le,x1,y1,x2,y2` before the text, `Le,...` after | PM:L4949-4986, L5046-5058 |
| TTF download | `~MDELC,<id>` then `~H,TTF,<id><name>,<size>` CR + font data | PM:L1026-1041 |
| Bitmap font download | `~MDELE,<id>`, `~J<id>` CR, `ESC*c<n>D ESC)s64W` + 64-byte header, per char `ESC*c<code>E ESC(s<len+16>W` + 16-byte char header + bits | PM:L1043-1093, L1125-1182, L1199-1236 |
| Font delete only | `~MDELC` or `~MDELE` | PM:L1103-1114 |
| Rotation | rotation digit = `(4 - r) & 3` | PM:L2331-2336, L4941 |

Gates: `Font.d:12-14` (`Download.Bitmap=true`, `Download.TrueType=true`), `Drawing.d:83` (`Text.Rotation=90`).

### 1.5 Native barcodes

Generic 1D: `B<code>,<x>,<y>,<narrow>,<wide>,<height>,<rot>,<hr 0|1>,<data>` CRLF (PM:L2306-2347, L2594-2598).
Code letters chosen in `FUN_1800037d0` (PM:L1763-1972) and `FUN_180005520` (PM:L2740-2846):

- Code 39: `A`, `A2` (check digit), `A3`/`A4` (full ASCII). The driver adds a MOD43 digit itself when the
  model flag `Code39.~CheckDigit.Supported` is false (RT730i: true, BarCode.d:683).
- I 2 of 5: `N`, `N2` (check digit); `I-2/5.~CheckDigit.Supported=false` (BarCode.d:745), so the driver
  appends a MOD10 digit and uses `N` (PM:L1855-1877).
- EAN/UPC families: letters `B/C/D`, `E/F/G`, `H/I/J`, `K/L/M` (base, +2, +5 add-on) (PM:L1878-1948).
  Which symbology maps to which group is inferred from the add-on pattern only.
- Code 128: `Q` (auto), `Q2` (manual or external data), `Q4`, `R` (UCC/EAN AI 00, 22 chars), `U` (single AI 23)
  (PM:L2754-2836). Function codes: FNC1 `&G`, FNC2 `&B`, FNC3 `&A`, FNC4 `&F`/`&E`, code set A/B/C `&F`/`&E`/`&D`,
  shift `&C` (PM:L2625-2634).
- Others: `P` (case 2), `O` (case 4), `S` (case 0xd), `4` (0x17), `3` (0x24) (PM:L1849-1969). Symbology names inferred.

2D (PM:L2348-2593):
- PDF417: `P<x>,<y>,<narrow>,<rowh>,<rows>,<cols>,<ec>,<len>,<rot>` CRLF + data.
- DataMatrix: `XRB<x>,<y>,<narrow>,<rot>` + `R` (rectangle) or `S<rrr><ccc>` (with `~DataMatrix.Size=true`, BarCode.d:823) + `,<len>` CRLF + data. `^^` in data becomes `^` (PM:L2077-2091).
- MaxiCode: `M<x>,<y>,1,1,<mode>,<postal/class/country>,<rot>,<msg>` (PM:L2093-2161).
- QR: `W<x>,<y>,5,<model>,<ec>,<mask>,<mul>,<len>,<rot>` CRLF + data. MicroQR: `W<x>,<y>,1,3,<ec>,0,<mul>,<len>,<rot>`.
- MicroPDF417: `PM<x>,<y>,<narrow>,<rowh>,<mode>,<len>,<rot>`.
- Aztec: `Z<x>,<y>,<rot>,<mul>,N,<ec/layers>,N,<len>` + data.
- RSS / Composite: `B5<type>,<x>,<y>,<narrow 1..10>,<segments>,0,<rot>,<hr>` + data (`primary|secondary`).

Enabled set for RT730i (BarCode.d:638-823): Aztec, Codabar, Code128, Code39, Code93, Composite, DataMatrix (ECC200),
EAN-13, EAN-8, FIM, I-2/5, MaxiCode (modes 2,3), MicroPDF417, MicroQR, PDF417, Postnet, QR (model 1,2), RSS, Telepen, UPC-A, UPC-E.
Disabled: Australian Post, Code 11/16K/49/One, Codablock, Japan Post, KIX, MSI, Planet, Royal Mail, add-ons as separate symbols, Vericode.
`Drawing.d:66-67`: unsupported symbologies are drawn as lines or bitmap.

### 1.6 Lines and boxes

- Line: `Lo,x1,y1,x2,y2` (black) or `Le,...` (inverse/XOR) (PM:L4306-4350). Gate `Drawing.d:75-80`.
- Box: `R<x1>,<y1>,<x2>,<y2>,<t>,<t>` (PM:L3191-3230). Gate `Drawing.d:68-74`, no fill.
- Whole-label inverse: `Le,0,0,<w>,<h>`; not used on RT730i because inverse goes in `^LI` (PM:L161-168).
- HELP:Advanced_DriverOptions: "Device Line Substitution" turns graphic lines into printer lines.

### 1.7 Serialization, variables, RTC

Driven by `Method.d:8-23`. Field sub-strings in `FUN_180003210` (PM:L1559-1706):

- Variable field declaration (phase -0x15): `V<nn>,98,prompt_V<nn>` CRLF. 98 is printed as an integer
  (inferred from the decompiled literal). Matches manual form `V00,16,Prompt` (EZPL:p104 line 13).
- Counter declaration (phase -0xb): `C<nn>,<zeros of field width>,<+step|step>,prompt_C<nn>` CRLF.
- Use in data: `^V<nn>` / `^C<nn>`, or `<fixed part>^C<nn>` (phase -1).
- Names: `V`/`C` + fixed-width counter per job (PM:L1664-1686).
- RTC field (phase -0x29): a layout line `T<h|m|s...>` or `D<y4|y2|me|mn|dd...>` CRLF, then `^T` or `^D`
  in the data, with optional offset `+DDDD.HH` (PM:L5065-5266). Offset range 0..9999 days, 0..99 hours
  (`FUN_180009480` PM:L5295). Manual: `AF,...,^T+010.30` (EZPL:p019 lines 20-21).
- Set clock: `~D<MM>,<DD>,<YY>,<hh>,<mm>,<ss>` CRLF from a SYSTEMTIME (PM:L5699-5737, CM same).
  Tool "Set Printer Clock" (HELP:SetClock).

### 1.8 RFID (not active on RT730i)

RT730i has no `RFID=` key (Model.d:5394-5421), so the RFID UI and fields are off (inferred).
Syntax for completeness: `RFW,H,<start>,<len>,<seg>,<data>`, `RFW,H,2,8,0,<lockpw>`, `RFW,H,2,0,0,<killpw>`,
`RZ<mode>,<bank>,<pw>` (lock/unlock), or with `~Command.Supports.WM`: `HS42,<1|2|3>`, `WB<n>,<len/2>,2,<data>`,
`PW2,...`, `LK2,...`; IC position `~HE<mm>,<n>` or `^RS<mm>,-1,-1,-1,-1` (PM:L4370-4883, L7288-7360).

### 1.9 User commands and passthrough

- User commands at job start (0), job end (1), after `^L` (2), page end (3) (PM:L558, L665, L92, L796).
- Printer Command Font, PASSTHROUGH escape, escaped text, Generic/Text Only mode (HELP:PassthroughOptions).
- For manufacturers "Godex" or "Barcode Printer" (BP730i), the UI module sets the passthrough escape
  character to none and the USB write timeout to infinite (`FUN_1800023f0` CM:L1143-1180, test `FUN_180008a40` CM:L4851).

### 1.10 Tools actions (ConfigModule)

Dispatcher `FUN_180002810` CM:L1293-1403; support mask `FUN_180002670` CM:L1237-1288.

| Action id | Menu text (inferred) | Bytes sent | Gate |
|---|---|---|---|
| 7 | Reset Printer | `~Z` (job named "Print Configuration") | always. Name inferred: ZPL module uses action 7 for `~JR` reset |
| 9 | Run Calibration | `~S,SENSOR` | always |
| 10 | Print configuration | `~V` | not Falcon |
| 0x3f3 | Test Print Head | `~T` | always |
| 0x13 | file list | `~X4` | not Falcon |
| 0x14 | font list | `~X3` CRLF `~X5` | not Falcon |
| 0x15 | format list | `~X1` | not Falcon |
| 0x16 | graphic list | `~X2` | not Falcon |
| 0xb | Configure Memory | `^XSET,MEMORY,<0 internal flash|1 extended>` | `~Memory.Configuration=true` (CM:L1270-1274, L2308-2329, STR:7403-7404) |
| 0x414 | Set Media Sensor | `^G<2 auto|0 reflective|1 see-through>` | manufacturer must be "Barcode Printer" (CM:L1245-1247, L4884-4896). BP730i qualifies. Default 2 (CM:L2109-2134, L2165-2187, STR:7405-7407) |
| 0x419 | Set Cutter Type | dialog only | `~Cutter.Fabulous` (not RT730i) |
| 0xd | RFID Options | dialog | RFID capability |

Base actions such as Send Printer Command, Set Printer Clock, Manage Cache are generic (STR:2449-2497, HELP:Tools).

### 1.11 Status monitor

See 2d.

### 1.12 Stock / media profiles

See 2e. Shared preset stocks in `exe/Common/Defaults[XG]_2023.4.1.0.sds`: 2x4, 3x2, 3.94x5.91 (die cut), 4x3, 4x4, 4x6 in.
Users can override printable width, tracking, and size limits under Printer Specifications (`DriverSettings::GetTracking` etc., DC:L177900-177919).

### 1.13 Not emitted at all

No `~S,ES*`, no `^XSET` other than `IMMEDIATE` and `MEMORY`, no `^XGET`, no `~S,CHECK`, no `~B`, no `QA`, no `^R`, no `^Z`.
Evidence: string scan of every DLL/EXE in `drv/cab/*` and `drv/exe/x64` for `~S,` and `^XSET`: only the GDX and EPL
ConfigModules match, with `^XSET,IMMEDIATE,1`, `^XSET,MEMORY,`, `~S,STATUS`, `~S, STATUS`, `~S,SENSOR`.

## 2. Answers

### a. Why is the Q height padded to a multiple of 8?

Answer: it is a side effect of the 8-row band splitter. Nothing shows a firmware need (inferred).

Evidence:

1. `FUN_180006090` (PM:L3333-3376) cuts the page into bands. Band starts and ends sit on 8-row block edges.
   It skips all-blank 8-row blocks (`FUN_180006620`, rows r..r+7, PM:L3532). It ends a band after the first
   all-blank 8-row block that follows ink (`FUN_180006790`, rows r-1..r-8, PM:L3621). The last band runs to the
   true image end (`iVar8 = rows`, PM:L3344-3346). So only the last band can have a height that is not a multiple of 8.
2. `FUN_180006a40` (PM:L3780) sets `height = (h + 7) & ~7`. It fills the extra rows with new zero rows (PM:L3836-3851).
   This is the only padding site.
3. The PCX path (`ImagePCX::Convert`, PB:L37259-37487) keeps the exact height. Its PCX header uses `rows-1` (PB:L37302).
   So the same driver sends non-multiple-of-8 images to the same firmware by another path.
4. The manual defines `Q` with any height. Its example uses height 8 but states no rule (EZPL:p102 lines 1-30).
5. Your hardware test today printed one exact-height `Q` with a CR terminator correctly.

Note: each band also carries one trailing blank 8-row block (point 1). The splitter is a size optimisation, not a protocol rule.

### b. Language switch or preamble?

Answer: no. The driver never sends `~S,ES*`. No module sends a print-job preamble.

- No `~S,E` string exists in any Seagull binary (scan in 1.13). The manual says `~S,ES` exists and the default is
  auto switch (EZPL:p072 lines 17-29).
- The job starts with user command phase 0, then `^A?`, `^O?`, `^D?`, `^S?`, `^H?`, `^C1` (PM:L546-579, L6350-6496).
- The only unsolicited write is `^XSET,IMMEDIATE,1` CRLF from the status interface. It is sent once per
  `CommunicationInterface_GDX` object, before a status poll (`FUN_180001430` CM:L172-187, vtable slot 15 in CMVT;
  slot name OnPreStatus is inferred from export order). The manual says this setting is permanent (EZPL:p032 lines 29-36).
- Port monitor `Seagull_TCPIP_PortMonitor.dll` and language monitor `Seagull_V3_NetMon*.dll` contain no EZPL strings
  (string scan). INF wiring: `BarcodePrinter.inf:56-66` (port monitor), `:1126` (language monitor).
- Status is enabled only on Serial and USB for this model (Features.d:80). Over TCP the monitor should not poll (inferred).

### c. Compression and the cached PCX path

Answer: no compression on the direct path. The only compression is PCX RLE inside `~Ep`.

- Direct `Q`: raw bytes, rows trimmed left/right to non-zero bytes (PM:L3742-3748, L3799-3833).
- PCX: standard PCX RLE (runs up to 63, `0xC0|n` prefix), inverted polarity, right pad 0xFF, even bytes per line
  (`(w+15)>>3 & ~1`) (PB:L37291-37440). Output = 128-byte header + rows (PB:L37502-37515).
- No `QA`/zlib anywhere in the PrintModule.

Path choice (`FUN_180006090` PM:L3304-3321):

- PCX path if `prtdev[0x471] == 0` OR the image has an application cache id (`prtcachegfx+0x80`, copied from `prtdev+0x1f8` in `FUN_180002310` PM:L893).
- Direct `Q` path only if `prtdev[0x471] == 1` AND cache id == 0.

`prtdev[0x471]` is set in `FUN_1800024b0` (= `prtdev::UpdateOptimizations`, slot 32, PM:L934-953):

- page type 0 and graphic caching NOT allowed -> 1;
- page type 0x10 -> 1;
- otherwise 0.

Graphic caching allowed = `CacheEngineBase+0x30` (PBsel:L108-117), loaded from optimisation flags `prtdev+0x298` bit 5 (PBsel:L468, L529).
Page type comes from the same flags (`prtdev::page_type`, PB:L49702-49728): no flags -> 0; flags & 0x1a -> 0x10 (8 for static pages);
bit 2 -> 4 (or 2); bit 0 -> 1.
HELP:Cache_Settings says caching works "when used with BarTender".

Result for us: a plain Windows application sets no optimisation flags. Then page type is 0, caching is off,
and every bitmap goes as direct `Q` (inferred from the flag source). The PCX path appears only with BarTender
optimisations (graphic caching, formats, serialised or template pages). With cache id 0 and caching off, `UseGraphic`
stores the PCX in the temporary location and marks it for deletion (PBsel:L1018-1170).

### d. Status monitor

Query: `~S,STATUS` CRLF (`FUN_1800010a0` CM:L38-45, slot 4 GetStatusCommand).
Before polls: `^XSET,IMMEDIATE,1` CRLF once (see b).
Retry: on read timeout it resends the query if 2000 ms passed since the last send and the retry count is below a limit
(`FUN_180001520` CM:L235-252, slot 20, OnReadTimeout inferred).

Reply parser `FUN_1800010c0` (CM:L52-167, slot 5 InterpretResponse):

- Needs at least 10 bytes. It finds the last LF. It reads `pcVar6[-9..-8]` as a 2-digit code, needs `,` at -7,
  reads 5 digits at -6..-2 as labels remaining. So the reply is `aa,nnnnn` CR LF. Manual: same format (EZPL:p072 lines 33-47).
- Completeness check `FUN_1800014d0` (CM:L215-230) only works when the query string equals `"~S, STATUS\r\n"` (with a space,
  `FUN_1800014a0` CM:L202-210). The poll string has no space. So this check likely never matches the poll (inferred bug, low impact).

Code map. EZPL meaning from EZPL:p068 lines 6-25. Seagull code meaning cross-checked with the ZPL module
(`~HS` paper out -> 0x10001, ribbon out -> 0x10002, head up -> 0x10012, pause -> 4, busy -> 3; ZCM:L208-242, ~HQES bits ZCM:L1605-1632).

| EZPL | Meaning (manual) | Seagull code | Evidence |
|---|---|---|---|
| 00 | Ready | 1 | CM:L96-98 |
| 01 | Media empty | 0x10001 (media out) | CM:L99-101 |
| 02 | Media jam | 0x10031 | CM:L102-104 |
| 03 | Ribbon empty | 0x10002 (ribbon out) | CM:L105-107 |
| 04 | Printhead up | 0x10012 (head open) | CM:L108-110 |
| 05 | Rewinder full | 0x10032 | CM:L111-113 |
| 06 | File system full | 0x10021 | CM:L114-116 |
| 07 | File name not found | 0x10022 | CM:L117-119 |
| 08 | Duplicate name | 0x1002a | CM:L120-122 |
| 09 | Syntax error | 0x10020 | CM:L123-125 |
| 10 | Cutter jam | 0x10033 (cutter fault) | CM:L126-128 |
| 11 | Extended memory not found | 0x10025 | CM:L129-131 |
| 13 | Waiting peel | 0x1000e | CM:L143-145 |
| 20 | Pause | 4 (paused) | CM:L146-148 |
| 21, 22 | Setting mode, keyboard mode | 0x10010 | CM:L149-152 |
| 50 | Printing | 3 (busy) | CM:L153-155 |
| 60 | Data in process | 2 | CM:L156-158 |
| 62 | Head overheat | 0x1006a | CM:L159-161 |
| other | unknown | `0xA1000000 | code` + debug string | CM:L132-142 |

High bit 0x10000 marks an error state (inferred from both modules). Status texts are in `status_strings.txt` (STR:14000-14166).

### e. Stock, width, centering

Defaults and limits: table above (Model.d:5405-5414). Gap and mark default 3.0 mm (PM:L5972-5983). Media type default gaps (PM:L5955-5970).

Tracking enum: 0 Right, 1 Left, 2 Center (`IsRightTracked`/`IsLeftTracked`/`IsCenterTracked`, DC:L115201-115235). RT730i = Center.

`^W` value (`prtdev::GetPrinterPageWidthMicrons`, PB:L51690-51767): with tracking > 1 (Center) it returns the stock printable
width and clamps it to `Stock.Printable.X` (105.7 mm). No offset is added. Dots use ceiling: `(um*dpi + 25399)/25400`
(PB:L51769-51783, L54691-54707). `^W` = that dot count back to mm (PM:L6522-6549). Example: 100 mm -> 1182 dots -> `^W100`.
Wider stock (up to 118 mm) is clamped to 105.7 mm (inferred `^W106` after rounding).

Horizontal image position (`TransformGraphics::Init` PB:L72887-72975, `TransformES` PB:L73217-73360):

- `Transform.Origin=Adjustable` (Drawing.d:90) makes `PrinterOriginAdjustable` true (DC:L115237-115245, parse DC:L155623-155626).
- With Center or Right tracking and an adjustable origin, the code subtracts the printing offset again (PB:L73326-73350).
  Image x = image left edge in the page + the user's horizontal offset (Printing Position dialog, HELP:PrintingPosition).
- The centering formula `(printhead width - stock width)/2` (PB:L73352-73357) runs only when the origin is NOT adjustable.
  So for EZPL the driver applies no centering. It relies on the printer and `^W` (inferred).
- Our encoder (`Q0,0,...` with `^W<label mm>`) matches this.

Vertical: `TranslateVerticalPositionDots` changes y only for variable-length pages (DC:L194260-194300).

Page height: `GetPhysicalPageHeight` also uses ceiling (PB:L54715-54730). For 150 mm this gives 1772 rows (inferred that
the print-time height uses the same value). Bytes per row: `SBITMAP::SetDimensions` uses `(w+7)>>3`, no 4-byte padding (PB:L35456-35480).

### f. `^E` integer then decimal

Code: for Absolute it writes `E<MM>` CRLF `^` then `E<MM10/10>.<MM10%10>` CRLF. Relative writes only `EA<mm.d>` (PM:L7017-7037).
No model check exists in this branch. The Absolute/Relative bit is UI-only (cfg 0x454 bit 4, default Absolute, PM:L6037, CM:L3545-3557).

Reason (inferred): the manual says decimal values for `^E` are allowed "starting from the year 2016" (EZPL:p011 lines 1-7).
Older firmware gets a valid integer first. Newer firmware then takes the decimal value. Relative `^EA` has no integer fallback.
The manual also says invalid parameters are "not processed" (EZPL:p011 line 4), so the second line is harmless on old firmware (inferred).
Note: the decimal form prints `-1.-5` for -1.5 mm (previous analysis, C `%` on negatives).

## 3. Corrections to the previous analysis

1. Cache path condition is reversed. Previous text: PCX "is taken when PrtDev flag 0x471 is set ... and the image is not marked".
   Correct: direct `Q` needs 0x471 set AND no cache id; PCX is used otherwise. 0x471 means page type 0 with graphic caching OFF, or page type 0x10 (2c).
2. Band splitter detail: a band ends AFTER the first blank 8-row block that follows ink (that block is inside the band).
   Only the last band can be padded (2a).
3. Page size: base code rounds up. 100 mm = 1182 dots, not 1181. 150 mm = 1772 rows. Bytes per row stay 148 (2e).
4. Open question 2 (stride): no 4-byte padding (2e).
5. Open question 5 (`^E` double send): explained by the 2016 firmware note (2f).
6. Open question 8: action 7 is "Reset Printer" (`~Z`); the job name "Print Configuration" is a driver label error (inferred).
   Action 10 is the configuration print `~V`.
7. Open question 9: status codes now mapped (2d).
8. Utility table: there is also a `"~S, STATUS\r\n"` (with space) string, used in the query-complete check (CM:L207).
9. The status module does not send `^XSET,IMMEDIATE,1` "when the channel opens"; it sends it before the first status poll of each interface object (CM:L172-187; slot name inferred).
10. Applicator `^O2` is listed without a gate. RT730i has no `~Applicator`, so the option is not offered and is reset to None.
11. "Text / TTF / barcodes not analysed": now covered in 1.4 and 1.5.
12. The emitter also knows `^B`, `^M`, `^R` (types 1, 2, 8), but nothing calls them (1.1). The previous table did not say this.

## 4. Items not in the previous analysis

- RT730i stock limits, tracking, printable width, absent-key defaults.
- `^W` clamping to 105.7 mm; no driver-side centering with an adjustable origin.
- Ceiling rounding of page dots.
- Exact path-selection rule (BarTender optimisation flags, page types).
- PCX encoder details; no zlib/`QA`.
- Full status code table with EZPL meanings; retry timing 2 s; space-mismatch bug.
- Media sensor tool is gated on manufacturer "Barcode Printer".
- Memory tool gated on `~Memory.Configuration`.
- Passthrough escape disabled and USB timeout infinite for Godex/"Barcode Printer".
- Native text (`A`, `AT`, `V`), white-on-black via `Lo`/`Le`, bitmap and TTF font download headers.
- Native barcode command letters for 1D and 2D, check-digit handling, Code 128 function codes.
- Serialization (`V<nn>`, `C<nn>`, `^V`, `^C`), RTC fields (`^T`, `^D`, offsets), `~D` clock set.
- Unused emitter letters `^B`, `^M`, `^R`.
- Cache size 64 KiB; `~Ep` 512 KB limit and duplicate-name rule from the manual.

## Work artifacts made in this pass

- `work/gdx-deep/decomp/Seagull_PrintBase.c`, `Seagull_DriverCore.c`, `Seagull_V3_Status.c` (full Ghidra decompile).
- `work/gdx-deep/CM_GDX.vtables.txt` (ConfigModule vtables).
- `work/gdx-deep/rsrc/*_strings.txt` (string tables), `work/gdx-deep/chmtxt/*.txt` (help text).
