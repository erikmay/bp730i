# BP730i GZPL: ZPL emitted by the Seagull driver (xg#zpl 2023.4.1.0)

Scope: the Windows driver queue "BP730i GZPL" (Labelident rebrand of the Godex RT730i, 300 dpi) as handled by `Seagull_PrintModule_ZPL.dll` (job output) and `Seagull_ConfigModule_ZPL.dll` (UI, Tools actions, status queries). All findings are static analysis. Nothing was executed and no real printer output was captured.

Source labels used below:

- **driver binary**: decompiled with Ghidra 12.1.4 (`~/re-bp730i/work/zpl/decomp/*.c`). Cited as `PM:FUN_xxxxxxxx` (PrintModule) or `CM:FUN_xxxxxxxx` (ConfigModule). String file offsets are from `strings -t x` (`~/re-bp730i/work/zpl/strings/`). PrintModule .rdata maps VA = file offset + 0x180001200; ConfigModule .rdata maps VA = file offset + 0x180001800.
- **driver data file**: `~/re-bp730i/drv/ddz/xg#zpl_2023.4.1.0/*.d`, cited as `file:line`.
- **help file**: `zplXGenu_2023.4.1.0.chm`, extracted to `~/re-bp730i/work/zpl/chm/`, text in `~/re-bp730i/work/zpl/chmtxt/`.
- **manual only**: not confirmed from driver artifacts.

Two-letter mnemonics (`PW`, `MD`, ...) are below the `strings` minimum length, so they are cited by function address. Every command is written as `<prefix char><mnemonic>`. The prefix chars come from the stream (`stream[0x59]` format prefix, default `^`; `stream[0x58]` control prefix, default `~`; `stream[0x5a]` hex prefix, default `\`), defaults `0x5e7e`/`0x5c` set in PM:FUN_180011a60 and read back in PM:FUN_180011ce0 and overridable via registry `Settings:Format Instruction Prefix` / `Settings:Control Instruction Prefix` / `Settings:Field Hex Prefix` (PM strings 0x1db00, 0x1db28, 0x1e8b8).

## 1. Model mapping (driver data file)

| Item | Value | Source |
|---|---|---|
| Driver entry | `[BP730i GZPL]` Manufacturer=`Godex_Generic`, Model=`Model:Godex_RT730i`, PNP `__BP730i_GZPL724F` | Driver.d:1283-1287 |
| Manufacturer | `CompanyName=Barcode Printer`, `ProductName=GZPL Driver` | Manufacturer.d:116-119 |
| Model | BarCode=`Godex`, Drawing=`Standard`, Features=`Godex_RTXi`, Font=`Godex_304`, Method=`Standard`, Resolution=300 | Model.d:12713-12723 |
| Stock | default 4x4 in; max X 118 mm, max Y 30 in; min X 1 in, min Y 3 mm; printable X 105.7 mm; Tracking=Center | Model.d:12724-12733 |
| Model flags | `~Cutter=true`, `~LabelTop.Min/Max=-120/120`, `~Mode.Backfeed.Speed=true`, `~Mode.Slew.Speed=true`, `~PrintMethod=DT,TT`, `~Speeds.Print=2:2 in/sec,3:3 in/sec,4:4 in/sec,5:5 in/sec`, `~Speeds.Print.Default=5 in/sec`, `~TearOff=true`, `~TearOff.Min/Max=-120/120` | Model.d:12734-12744 |
| Not set for RT730i | No `~Darkness.*`, `~MediaType.Default`, `~PostPrintAction.Default`, `~PrintMethod.Default`, `~Firmware.Version.Default` | Model.d:12713-12744 |
| Feature group | `Godex_RTXi` | Features.d:1076-1098 |
| Method | `Standard`: Cache.Format=true, Cache.Graphic=true, Copies.Limit=99999999, Serialization=true | Method.d:48-70 |
| Drawing | `Standard`: Transform.Inverse=true, Transform.Mirror=true, Transform.Orientation=0, Transform.Origin=Adjustable | Drawing.d:189-219 |

`Features:Godex_RTXi` (Features.d:1076-1098):

```
Action.Cut=Continuous,Interval        ~Command.UsePrintWidth=false
Action.CutPause=Continuous,Interval   ~Darkness.Absolute.Supported=true
Action.Pause=Continuous,Interval      ~Graphics.Encoding=Hex,HexComp,ZB64,PNG
Status.Ports=Serial,USB,TCP/IP        ~Language.GZPL=true
Stock.Continuous.VariableLength=true  ~Memory.DefaultLocation=R
~Command.JB=true                      ~Memory.DefaultLocation.OptionalFonts=*
~Command.JS=true                      ~Memory.Options=B,E
~Command.JS.Options.NoBackfeed=true   ~Mode.PeelOff=true
~Command.JS.Options.SpecifiedPercentage=true  ~Mode.Rewind=false
~Command.ML=false                     ~RealTimeClock=true
                                      ~Sensor.Mark=true, ~Sensor.Web=true
```

### Godex-specific differences from Zebra groups (driver data file + driver binary)

Compared with `XiIIIPlus_Series` (Features.d:2021-2049), `Xi4_Series` (1934-1962) and `ZD220` (2050-2073):

- `~Language.GZPL=true` is set on 15 of 106 groups: all 11 Godex groups plus Citizen_CLS_321Z, Compuprint_6074, Dinkle, and MettlerToledo (all Godex-engine OEMs, inferred). No Zebra group sets it. In the binary it does the following. PM:FUN_18000f550 reads it. PM:FUN_18000f340 ("is genuine Zebra ZPL") returns false for GZPL. That removes the `! U1 setvar "device.languages" "zpl"` preamble (PM:FUN_1800026a0, string 0x1d068). It also removes the Zebra `e:` drive-extension handling for cached names (PM:FUN_180001d90) and the Zebra default firmware level 10 (PM:FUN_180011ce0, decomp ~10733). It also changes the default QR Y offset from 10 to 0 (PM:FUN_180010210), and it is copied into barcode fields (PM:FUN_180006140, FUN_1800066a0). In the UI the ZPL module does not enable Tools action 0x19 ("Sensor Profile", `~JG`) or action 0x401 (unidentified) for GZPL. For Zebra it enables both. Each falls through to the base module's default (CM:FUN_18000e790).
- No `~Command.HH`, so the Information dialog does not send `^XA^HH^XZ` (query mask 0x0f instead of 0x2f; CM:FUN_1800271b0 calls CM:FUN_180030110).
- No `~Command.A@`, no `~Command.HQ`, and no `~PossibleInstalledOptions.Fonts`.
- `~Command.ML=false`, so the "Detect Missing Label" check box is forced off (CM:FUN_1800097e0) and no `^ML` is sent.
- `~Command.UsePrintWidth=false`. This is only used in the `^LH` right-tracking formula (PM:FUN_1800026a0). RT730i is center-tracked, so `^LH0,0`.
- `~Memory.DefaultLocation=R` (RAM) instead of `E`. Cached graphics/formats go to `R:` (PM:FUN_1800010d0 via PM:FUN_180010170).
- `~Mode.Rewind=false`, `~Mode.PeelOff=true`, no `~Mode.Applicator`. Godex_RT7i+ is the opposite (PeelOff=false, Rewind=true; Features.d:1053-1075). Godex_ZX1200 has all three (Features.d:1099-1122).
- `~Graphics.Encoding=Hex,HexComp,ZB64,PNG`, the same as XiIII/Xi4.

## 2. Command table

Config field offsets refer to the `prtconfig` struct (DEVMODE private part) and are given so the logic can be re-checked in the decomp. "UC" = the UI's "Use Current Printer Settings" state, which suppresses the command.

### 2.1 Job setup format (sent once per job, before page data)

Built by PM:FUN_1800026a0 → PM:FUN_180016a20. It is wrapped in its own `^XA ... ^XZ` format. Each line below is one `endl` in the stream. `endl` calls the virtual `prtstream::write_endl`, which writes the 2 bytes `\r\n` (driver binary: DriverCore `prtstream::write_endl` @0x1800d5c40, data @0x1802cc4f4 = `0D 0A`). Settings are **inside a separate leading format, not before `^XA`, and are never followed by `^JU`** in a print job.

| Order | Command | Exact syntax | Values / units | Driver setting | Source |
|---|---|---|---|---|---|
| 0 | (Zebra preamble) | `! U1 setvar "device.languages" "zpl"` | Not sent for GZPL | `~Language.Initialize` and genuine Zebra only | driver binary PM:FUN_1800026a0, str 0x1d068 |
| 1 | `^XA` | `^XA` | | | PM:FUN_1800026a0 |
| 2 | `^SZ` `^JM` | `^SZ2^JMA` | Always ZPL II, full dot density | Always (skipped only for Argox PPLZ / Bixolon) | driver binary PM:FUN_180016a20, str 0x1eb50, 0x1eb54 |
| 3 | `^MC` `^PM` | `^MCY^PM{Y\|N}` | `Y` when mirror flag set | Page Setup mirror (`cfg+0x404 & 2`) | PM:FUN_180016a20, str 0x1eb58 |
| 4 | `^PW` | `^PW{dots}` | Dots, `ceil(width_um * 300 / 25400)` | Page (stock) width | PM:FUN_180016a20; rounding in PrintBase `prtdev::GetPrinterPageWidth` @0x18003a900 |
| 4b | `^MT` | `^MT{D\|T}` (same line as `^PW`) | `D` = DT (cfg value 0), `T` = TT (2) | Stock > Print Method; omitted when "Use Current" (-1) | PM:FUN_180016a20 (needs `~PrintMethod` to contain DT and TT) |
| 5 | `^MN` | `^MN{N\|Y\|W\|M}` | `N` continuous, `W` gap (web), `M` mark, `Y` generic non-continuous (not offered for RT730i) | Stock > Media Type (cfg+0x426: 0/1/2/3, -1 = UC sends nothing) | PM:FUN_180016a20; UI list CM:FUN_180006820 |
| 5b | `^LL` | `^LL{dots}` | Page height in dots | **Only for Continuous** (`^MNN`). Gap/mark media get no `^LL` | PM:FUN_180016a20 |
| 6 | `^LT` | `^LT{dots}` | `MulDiv(top_um, 300, 25400)`, range ±120 dots (`~LabelTop.Min/Max`) | Stock > "Set Top Adjustment" check box (`cfg+0x458 & 2`) | PM:FUN_180016a20, range PM:FUN_1800151d0 |
| 7 | `~TA` | `~TA{-}{ddd}` (3 digits, `-` only if negative) | Dots, ±120 (`~TearOff.Min/Max`); 3-digit form because TearOff.Max ≥ 100 | "Set Tear-Off Adjustment" (`cfg+0x458 & 4`). For RT730i only in modes UC/Tear/Cut | PM:FUN_180016a20, PM:FUN_180012850 |
| 8 | `~JS` | `~JS{N\|B\|A\|O\|pct}` | Normal/Before/After/None/percentage 0-100 | Stock > Backfeed (cfg+0x428/0x42c). **Not sent in Tear-Off or Rewind mode** | PM:FUN_1800168d0; UI CM:FUN_180007660 |
| 9 | `^MM` | `^MM{T\|P\|R\|C\|A\|K}` | Tear=T, Peel=P, Rewind=R, Cut=C, Applicator=A, Kiosk=K | Stock > Feed Mode (cfg+0x44c: 0/1/2/3/4; -1 = UC, no `^MM`). RT730i UI offers UC, Tear, Peel, Cut | PM:FUN_180016a20; UI CM:FUN_180006d80 |
| 10 | `^MD` (relative) | `^MD{n}` | -30..+30, default 0 | Options > Darkness, Relative (`cfg+0x458 & 0x10` set, `& 0x20` clear) | PM:FUN_180016a20; ranges PM:FUN_1800151d0 |
| 10 | `~SD` (absolute) | `~SD{-}{dd}^MD0` | Exactly 2 digits; 0..30, default 12 | Options > Darkness, Absolute (`& 0x30`). Then `^MD0` clears the relative offset | PM:FUN_180016a20, str "MD0" 0x1ebb0 |
| 11 | `^PR` | `^PR{p},{s},{b}` | Label text before `:` in `~Speeds.Print` (2,3,4,5 = in/s). Slew and backfeed appended because both model flags are true | Options > Speed: Print / Slew / Backfeed (`cfg+0x430/0x434/0x438` µm/s). Each defaults to `~Speeds.Print.Default` (5) | PM:FUN_180016a20, PM:FUN_180016740, PM:FUN_18000faf0 |
| 12 | `^ML` | `^ML{LL+1}` | | Printer Options > Detect Missing Label. **Forced off for RT730i** (`~Command.ML=false`) | PM:FUN_180016a20; CM:FUN_1800097e0; help zpl_PrinterOptions |
| 13 | `^JZ` | `^JZ{Y\|N}` | Default `Y` | Printer Options > Reprint After Error (`Settings:Reprint After Error`, default true) | PM:FUN_180016a20, str 0x1eb10 |
| 14 | `^LH` | `^LH0,0` | Center/left tracked: always `0,0` | (right-tracked models only use a formula) | PM:FUN_1800026a0 |
| 15 | `^LR` | `^LRN` (same line as `^LH`) | | Always | PM:FUN_1800026a0, str 0x1e90c |
| 16 | `^XZ` | `^XZ` | | | PM:FUN_1800026a0 |

When cut mode is selected, the setup also sets a "cutter on" flag. `^PQ` handling then toggles `^MMC` / `^MMT^JSB` between formats according to the cut interval (PM:FUN_1800131f0, str 0x1e83c, 0x1e87c, 0x1e880).

`~!G` (double heat), `^KV`, `ESC KI…` and the `ESC Arg label …` media feed belong to other vendors. They are gated by flags that RT730i lacks (`~Command.DoubleHeat`, `~Mode.Kiosk`, `~Command.Argox.*`).

### 2.2 Page formats

| Command | Exact syntax | Notes | Source |
|---|---|---|---|
| `^XA` / `^XZ` | `^XA` … `^XZ` | One format per page. STX/ETX (`\x02`/`\x03`, `\x0f` for `^FS`) only when `stream[0x4b]==0`. That flag is set to 1 by default, and no RT730i path clears it | PM:FUN_180012c90, PM:FUN_180012cf0 |
| `^LL` (variable length) | `^XA^LL{dots}^XZ` | Only when Continuous **and** variable page length, before the page format, when the length changes | PM:FUN_180003100 |
| `^FO` | `^FO{x},{y}` | Dots, x clamped ≥ 0 | PM:FUN_180012d50 |
| `^XG` | `^XG{name},1,1^FS` | Recall stored graphic, scale 1,1 | PM:FUN_180009210 |
| `^GF` (only encoding "None") | `^GFB,{total},{total},{rowbytes},{raw binary rows}` | Encoding value 5. Not offered for RT730i (no `none` in `~Graphics.Encoding`) | PM:FUN_180009210 |
| `^PQ` | `^PQ{q},{p},{r},{Y\|N}` | q = labels (copies × serial count), p = pause/cut interval, r = copies, last = override pause (`Y` unless pause "After Label"/"After Interval") | PM:FUN_1800131f0 |
| Blank page filler | `^FO..^AA,N,9,5^FH^FD…^FS` | Only for an empty page so that a label still feeds | PM:FUN_1800131f0, str 0x1e8d8 |
| `^LRY…^LRN` | `^LRY^FO0,0^GB{w},{h},{t}^FS^LRN` | Whole-label inverse (Drawing Transform.Inverse) | PM:FUN_180013730 |
| `^CI` | `^CI{n}` | Only before text fields that use printer fonts | PM:FUN_18000de80 |
| `^FT`, `^A`, `^A@`, `^FH`, `^FD`, `^FS`, `^BY`, `^B*`, `^GB`, `^GC`, `^GE`, `^GD`, `^FR` | | Only for driver-native text, barcode and line objects (BarTender-style). Not used for a pure bitmap page | PM:FUN_18000de80, FUN_1800087b0, FUN_18000ac90, FUN_180006f80 |
| Format caching | `^XA^DF{name}^FS…^XZ`, `^XF{name}^FS`, `^XA^ID{m}:SSFMT*{ext}^XZ` | Method.Cache.Format=true | PM:FUN_180001310, FUN_180001450, FUN_180001630 |
| Image save/load | `^ISR:SS_TEMP.GRF,N` / `^ILR:SS_TEMP.GRF^FS` | Static/variable field split. Temp image deleted at job end | PM:FUN_180003100, str 0x1e930 |
| Serialization tags | `^SN`, `^SF`, `^FN` | Template/serialized jobs only | PM:FUN_1800138c0, FUN_1800059a0 |

### 2.3 Graphics download and encodings

The graphic name is `{mem}:SSGFX{n}{ext}`. `{mem}` comes from `~Memory.DefaultLocation` (= `R` for RT730i) and `{ext}` is `.GRF` (PM:FUN_1800010d0, name builder at PM decomp line ~330, str "SSGFX" 0x1cf28). `{n}` is `FormatFixedInt(index, 3)`, a 3-digit zero-padded cache index (`mov r8d,3` at PM 0x1800018cc; DriverCore `FormatFixedInt` @0x18014fec0 → `OString::FixedInt`). Result: `R:SSGFX000.GRF`-style names. Formats use the same pattern, `R:SSFMT{nnn}{ext}` (PM:FUN_1800011a0, `mov r8d,3` at 0x18000120c). The start value of the index is not traced.

`~DG` is sent before the page format that recalls it (field pass codes -0x21/-0x20 in PM:FUN_180003100 → PM:FUN_180009210):

```
~DG{name},{total_bytes},{bytes_per_row},{data}
```

`total_bytes` = rows × bytes_per_row, and bytes_per_row = ceil(width_dots / 8).

| UI value (Options > Graphics Encoding) | cfg+0x44e | Data format | Source |
|---|---|---|---|
| Auto | 0 | Resolves to **4 (Z64)** if the model lists `ZB64`, else 2. **RT730i → Z64** | PM:FUN_180008c20 + PM:FUN_180011490 |
| Uncompressed ("Hex") | 1 | Uppercase ASCII hex, 2 chars/byte, all rows concatenated, then newline | PM:FUN_180008e30 (table 0x1d5e0) |
| Compressed ("Hex Compressed") | 2 | Zebra ASCII run-length compression per hex row, see below | PM:FUN_180008f20 (tables 0x1d600, 0x1d620) |
| B64 ("Base64") | 3 | `:B64:{base64 of raw rows}:{crc}` | PM:FUN_180009210, str 0x1d638 |
| Z64 ("Base64 / LZ77") | 4 | `:Z64:{base64 of LZ77::Encode(raw) with the first 12 bytes removed}:{crc}` | PM:FUN_180009210, str 0x1d0d8 |
| None | 5 | Inline `^GFB` binary. Not offered for RT730i | CM:FUN_1800059d0 |

The CRC is `CRC16(encoded base64 text, init 0)`. DriverCore `CRC16` @0x180103800 is the bytewise CRC-16/CCITT (poly 0x1021, init 0, XMODEM form). It is written with `write_hex_reverse(&crc,2)` (DriverCore @0x1800d5840), which emits the high byte first in uppercase hex, so 4 digits, for example `:3A7F`.

Z64 payload: DriverCore `LZ77::Encode` @0x18010b080 calls a zlib-`compress()`-shaped routine (dest, &destLen, src, srcLen; bound len + len/1000 + 24) after a 12-byte header (`ZLIB` magic 0x42494c5a, raw size, compressed size). PM:FUN_180009210 strips those 12 bytes. So the payload is base64(zlib stream), which is the Zebra Z64 format. The zlib identity is inferred from the call signature and the bound formula. I did not decompile the compressor body. The UI labels come from zpl-r[enu].dll strings 10581-10585 ("Automatic", "Hex", "Hex Compressed", "Base64", "Base64 / LZ77"). The help (zpl_Options) only says "By default, the best available method is used".

Hex-compressed algorithm (PM:FUN_180008f20). It works on each row's hex string:

- A run of identical hex chars that reaches the end of the row, made of `0` or `F` and at least 2 long, is replaced by `,` (zeros) or `!` (ones). If the run length is odd, one literal char is emitted first.
- Other runs longer than 2: first one `z` per 400. Then `"gghijklmnopqrstuvwxyz"[n/20]` if the remainder is ≥ 20 (g=20, h=40, … y=380). Then `"GGHIJKLMNOPQRSTUVWXY"[n%20]` (G=1 … Y=19) if nonzero. Then the char.
- Runs of 1 or 2 are written literally.
- A row whose compressed text equals the previous row's becomes `:`.

PNG (`~Graphics.Encoding` has PNG): `~DY{name},B,P,{size},,{data}` + `^FO…^IM{name}^FS` exists in PM:FUN_18000a7e0. The UI does not offer it as a Graphics Encoding choice (CM:FUN_1800059d0). I did not trace when the driver selects it for a monochrome page; see section 6.

### 2.4 End of job

PM:FUN_180002ce0 (EndDoc):

| Command | Syntax | When |
|---|---|---|
| `^PP` | `^XA^PP^XZ` | Pause = "After Job" and feed mode is not Cut |
| `^ID` | `^XA^IDR:SS_TEMP.GRF^XZ` | A temp image was stored (`^IS`) and encoding ≠ None |
| `^JU` | `^XA^JUS^XZ` | **Only for Gprinter ZPL** (`~Language.GprinterZPL`), never for Godex |

### 2.5 Tools, Configure, and status (ConfigModule)

Action IDs come from CM:FUN_18000eb80. Enable logic is in CM:FUN_18000e790. Names are matched to the help Tools page (base_Tools) by function. The name mapping is inferred.

| Action (inferred name) | ID | Exact output | RT730i availability | Source |
|---|---|---|---|---|
| Cut | 3 | `^XA^MMC^PH^XZ` | Enabled when `~Cutter` and Feed Mode ≠ UC | CM:FUN_18000eb80 |
| Form Feed | 4 | (send configuration) then `~PH` | Enabled | CM:FUN_18000eb80 |
| Reset Printer | 7 | `~JR` | Enabled (only Gprinter differs) | CM:FUN_18000eb80 |
| Reset to Factory Defaults | 8 | (send configuration) `^XA^JUF^XZ` | Enabled | CM:FUN_18000eb80, str 0x494bc |
| Run Calibration | 9 | `~JC` | Enabled | CM:FUN_18000eb80 |
| Print Configuration | 10 | `~WC` | Enabled | CM:FUN_18000eb80 |
| Sensor Profile | 0x19 | `~JG` | **Not enabled for GZPL** (falls through to the base default) | CM:FUN_18000e790 |
| Set Label Length | 0x1a | `~JL` | Enabled | CM:FUN_18000eb80 |
| (cancel all) | 0x1b | `~JA` | Base-module default | CM:FUN_18000eb80 |
| Save settings | 0x40a | `^XA^JUS^XZ` | Enabled | CM:FUN_18000eb80 |
| File/format/graphic lists | 0x13/0x15/0x16 | `^XA^WD*:*.*^XZ`, `^XA^WD*:*.ZPL^XZ`, `^XA^WD*:*.GRF^XZ` | Enabled | CM:FUN_18000eb80 |
| Font list / supported fonts / barcodes | 0x14/0x17/0x18 | `^XA^WD*:*.FNT^XZ` (+`*:*.TTF`), `^XA^WDZ:*.FNT^XZ`, `^XA^WDZ:*.BAR^XZ` | Enabled unless `~GraphicsOnly` | CM:FUN_18000eb80 |
| Hex Dump | 0x3ea | `~JD` + bytes 0x00..0xFF + `~JE` | Only with `~HexDump` (absent) | CM:FUN_18000eb80 |
| Configure Printer dialog | 0x11 | `^XA^JUR^MF{p},{h}^JUS^XZ` | Enabled for GZPL. p = power-up, h = head-close: F feed, N none, L label length, C calibrate (UI 0..3) | CM:FUN_180011fe0, CM:FUN_18001cfb0; help zpl_ConfigurePrinter |
| Format Memory | 0xc/0x1e | `~JB…`, `^XA^WD{m}:*.*^XZ`, `^XA^ID{m}:*.*^XZ` | `~Command.JB=true` | CM:FUN_1800237f0 |
| Information dialog | 0xf | `~HI`, `~HS`, `~HM`, `^XA^HW*:*.*^XZ` (no `^HH`) | Query mask 0x0f | CM:FUN_180030110, CM:FUN_1800271b0 |
| Set clock | | `^XA^ST{MM},{DD},{YYYY},{hh},{mm},{ss},M^XZ` | `~RealTimeClock=true` | PM:FUN_180010e90, CM:FUN_180036570 |
| Real-time clock mode | | `^SLS` (start time), `^SLT` (time now), `^SL{n}` (interval), `^SL1` | Printer Options > Time Mode | PM:FUN_18000e530 |
| File manager | | `^XA^TO{src},{dst}^XZ`, `^XA^ID{file}^XZ`, `^HW`, `^HY`, `^HG`, `^HF` | | CM:FUN_180016140, 180016340, 180016510, 180017430, 180017630 |

### 2.6 Commands the driver never emits for this model

There are no matching literals in either DLL, or they are gated off for RT730i. Source: driver binary, full-decomp grep.

- `^LS`, `^PO`, `^MU`, `^XB`, `^MF` inside print jobs, `^JU` inside print jobs, `~JL`/`~JC` inside print jobs, `^HH` (gated by `~Command.HH`), `^ML` (gated by `~Command.ML`), `~HQES` (string in CM, used only for `~Command.HQ` models).
- Orientation is rendered by the driver into the bitmap (Drawing.d:217 `Transform.Orientation=0`). No `^PO`/`^FW` is sent.
- Gap height (Stock > Gap Height, cfg+0x4a0, default 0xbe5 µm = 3.045 mm) is **not sent to a GZPL printer**. It is only used by the Argox `ESC Arg label …` feed (PM:FUN_180013cc0).

## 3. Darkness mapping

- The driver does **not** convert to the Godex 1..19 EZPL scale. It sends ZPL values unchanged. Source: driver binary PM:FUN_180016a20.
- Absolute: `~SDnn^MD0`, nn = 00..30, UI default 12. The range and default are built-in defaults (`~Darkness.Absolute.Minimum`=0, `Maximum`=0x1e, `Default`=0xc). Model.d has no `~Darkness.*` override for RT730i. Absolute is allowed because `~Darkness.Absolute.Supported=true` (Features.d:1089). Source: PM:FUN_180014cd0, PM:FUN_1800151d0, CM:FUN_180035e20..35f00.
- Relative: `^MDn`, n = -30..+30, UI default 0. Source: same.
- Help text (zpl_Options): "Relative darkness uses the ^MD command, and absolute darkness uses the ~SD command".
- How the RT730i GZPL firmware maps `~SD` 0..30 onto its own heat levels is **manual only**.

## 4. Sample job

Scenario: 100 × 150 mm label, gap 3 mm, darkness 10 (Absolute), speed 4 ips, Direct Thermal, Tear Off, 1 copy, one full-page bitmap, Graphics Encoding = Automatic.

Assumptions:

- Slew and Backfeed speeds stay at their default (5 in/s). If they are set to 4 as well, the line is `^PR4,4,4`.
- "Set Top Adjustment" and "Set Tear-Off Adjustment" are unchecked. If tear-off is checked with 0, `~TA000` is added after `^MNW`.
- Reprint After Error has its default value (on).

```
^XA
^SZ2^JMA
^MCY^PMN
^PW1182^MTD
^MNW
^MMT
~SD10^MD0
^PR4,5,5
^JZY
^LH0,0^LRN
^XZ
~DGR:SSGFX<n>.GRF,262256,148,:Z64:<base64 of deflate(raw 1-bpp rows)>:<CRC16 hex>
^XA
^FO0,0
^XGR:SSGFX<n>.GRF,1,1^FS
^PQ1,0,1,Y
^XZ
```

Derivation:

- `^PW1182` = ceil(100000 µm × 300 / 25400) = ceil(1181.10). Source: PrintBase `prtdev::GetPrinterPageWidth` @0x18003a900. This was measured from the formula, not from a captured job.
- Rows = page height in dots. 150 mm → 1771.65, so 1772 when rounded up (as `^PW` is) or to nearest. Only truncation would give 1771. Bytes per row = ceil(1182/8) = 148. 148 × 1772 = 262256. The rounding of the height is an open question (section 6).
- No `^LL` is sent and the 3 mm gap is not sent. For gap media the driver sends only `^MNW` and relies on the printer's sensing or calibration.
- No `~JS` is sent in Tear-Off mode.
- The whole bitmap may be split into several `~DG`/`^XG` pairs by the Seagull field engine (for example, to skip white bands). That is not confirmed (section 6).
- With "Use Current Printer Settings" checked for darkness, speed, method, media type and feed mode, lines `^MTD`, `^MNW`, `^MMT`, `~SD10^MD0`, `^PR…` disappear. This is the RT730i default, because Model.d defines no defaults for these.

## 5. UI option names and value lists (driver binary + zpl-r[enu].dll strings)

- Media Type: Use Current (-1), Continuous (0), Non Continuous (Web Sensing) (2), Non Continuous (Mark Sensing) (3). "Non Continuous" (1) is shown only when the model lacks `~Sensor.Mark`. Source: CM:FUN_180006820; strings 10482-10485.
- Feed Mode: Use Current (-1), Tear Off (0), Peel Off (1), Cut (3). Rewind (2) is hidden because `~Mode.Rewind=false`. Applicator (4) is hidden. Partial Cut (5) is Argox/kiosk only. Source: CM:FUN_180006d80; strings 10487-10490, 10604.
- Pause / Cut interval: None (0), After Label (1), After Interval (2), Identical Copies (3), After Job (4). Interval 1..9999. Source: CM:FUN_180007240, CM:FUN_180007930.
- Backfeed: Normal (0), Before (1), After (2), None (3), Percentage (4, 0-100). Source: CM:FUN_180007660, CM:FUN_180007ba0.
- Print Method: Use Current, Direct Thermal (0), Thermal Transfer (2). Source: CM:FUN_180006650, PM:FUN_180014cd0.
- Darkness: Relative / Absolute radio + "Use Current Printer Darkness Settings". Source: strings 40028-40031.
- Speed: Print / Slew / Backfeed from `~Speeds.Print` (2, 3, 4, 5 in/s) + "Use Current Printer Speed Settings". Source: strings 40032-40035, Model.d:12740.
- Graphics Encoding: Automatic, Hex, Hex Compressed, Base64, Base64 / LZ77. Source: strings 10581-10585, CM:FUN_1800059d0.

## 6. Open questions

1. Resolved: line terminator is CRLF (section 2.1).
2. The start value of the `SSGFX{nnn}` index. Also whether cached graphics are reused across jobs and deleted (`^XA^ID{m}:SSGFX*.GRF^XZ`, PM:FUN_180001a80) or overwritten per page.
3. Page height rounding. `prtstream::GetPageHeight` (DriverCore @0x1800d6390) is a virtual call into the page object and was not traced. 1772 is expected unless it truncates.
4. Whether a full-page bitmap becomes one `~DG` or several band graphics. Also whether "Auto" ever picks PNG (`~DY`/`^IM`) for this model.
5. Mostly resolved: the Z64 payload is a zlib stream (section 2.3). The compressor body was not decompiled.
6. How the GZPL firmware on the BP730i interprets `~SD` (0..30), `^MD`, `^PR` (2..5 → ips?), `^MNW`, `^SZ2`, `^JMA`, `^JZY`, `~TA`, and `^MCY`. This is manual only.
7. Whether the RT730i GZPL firmware accepts `:Z64:` inside `~DG`. On Zebra this needs newer firmware. If not, select "Hex Compressed".
8. When the setup format is sent. FUN_180002650 calls FUN_1800026a0 from the job/page start, once per job, but I inferred the vtable slot (StartDoc vs StartPage). A captured `PRINT TO FILE` job from Windows would settle questions 2-4 and 8.
