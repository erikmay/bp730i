# EZPL output of the Seagull GDX driver (BP730i = Godex RT730i, 300 dpi)

Driver: Seagull "xg#gdx" 2023.4.1.0. Windows queue `BP730i` uses
`Driver.d:396 [BP730i]` -> `Model.d:5394 [Godex_RT730i]` -> `Features:Godex_PlusSeries`,
`Method:EZPL`, `Drawing:EZPL_Mirror`, `BarCode:EZPL_1XXXPlus_2DPlus_Aztec`.

## Sources and labels

- **driver binary**: `Seagull_PrintModule_GDX.dll` (x64, image base 0x180000000), called "PM" below.
  `Seagull_ConfigModule_GDX.dll` is "CM". Function addresses are Ghidra VAs. String offsets are
  file offsets in PM unless noted.
- **driver data file**: `drv/ddz/xg#gdx_2023.4.1.0/*.d`.
- **help file**: `gdxXGenu_2023.4.1.0.chm`, extracted to `~/re-bp730i/work/chm/gdx/*.html`.
- **manual only**: nothing in this file. A web search for the Godex EZPL manual found no usable
  command reference, so command *semantics* that the driver does not show stay as open questions.
- Base-library facts come from `Seagull_DriverCore.dll` ("DC") and `Seagull_PrintBase.dll` ("PB").

Work artifacts: `~/re-bp730i/work/decomp/PrintModule.c`, `ConfigModule.c` (full decompile),
`DriverCore.sel.c`, `PrintBase.sel.c` (selected functions), `*.vtables.txt`, Ghidra scripts in
`~/re-bp730i/work/ghidra_scripts/`.

## Line terminator and number formatting (driver binary)

- `endl` writes `0D 0A` (CR LF). Source: DC `prtstream::write_endl` @0x1800d5c40 writes 2 bytes
  from DC .rdata file offset 0x2caef4 (`0d 0a`).
- A few lines end with a bare `\r` (0x0D) before binary data: `Q` graphic header, `~Ep` header,
  `~H,TTF` and `~J` font headers (PM string `"\r"` at 0xf4b4).
- Integers are plain decimal, no padding, `-` sign for negatives.
- Internal length unit is 0.1 µm (254000 per inch). `Measurement::MM` = MulDiv(v,1,10000),
  `MM10` = MulDiv(v,1,1000), `Dots` = MulDiv(v,dpi,254000). MulDiv rounds half away from zero.
  Source: DC @0x18010cb10, 0x18010cba0, 0x18010d0d0.
- "mm.d" format below means `MM10/10` `.` `MM10%10` (one decimal digit). For a negative value the
  code would print `-1.-5` for -1.5 mm (C `/` and `%` on a negative number). This is a latent driver
  bug and affects only negative stop positions.

## Command table

All setting commands are built by one emitter, PM `FUN_18000c2f0` (vtable slot of
`CommandSet_GDX::{Darkness,PrintSpeed,Cut,Stripper,CopiesPerLabel,StopPosition,LabelWidth}`):
it writes `^`, a letter chosen by a type id, the value, CR LF.

| Command | Exact syntax | Parameters, range, unit | Driver setting | Source |
|---|---|---|---|---|
| Print method | `^AT` / `^AD` CRLF | `T` = thermal transfer (setting 0), `D` = direct thermal (setting 1). Not sent when the setting is "Use Current Printer Settings" (-1). | Stock page > Print Method. RT730i has no `~PrintMode.Default`, so the default is "use current" (no command). `~PrintMode=Direct Thermal,Thermal Transfer` enables both. | driver binary: PM `FUN_18000c280` (`CommandSet_GDX::PrintMode`), strings `"A"` 0xf950, `"T"` 0xfee4, `"D"` 0xf4c4; caller `FUN_18000b1b0`. data file: Model.d:5419 |
| Stripper / post-print mode | `^O<n>` CRLF | `0` = none (also sent for None and Cut), `1` = peel off, `2` = applicator | Post-Print Action: None -> `^O0`, Cut -> `^O0`, Peel Off -> `^O1`, Applicator -> `^O2` | driver binary: PM `FUN_18000b1b0` (type 6 values 0/1/2), `"O"` 0xf960 |
| Cutter | `^D<n>` CRLF | `0` = cutter off; `1` = cut every label; `n` = cut interval 1..32767 labels | Post-Print Action Cut + Occurrence. After Every Label -> `^D1`. After Interval -> `^D<Interval>`. Not Cut -> `^D0`. The driver tracks the last sent value and skips repeats (state reset to -1 at job start). | driver binary: PM `FUN_18000b1b0`, `FUN_18000b790` (per page), `FUN_18000c9a0`; range from `validate_range(0x440, 1, 0x7fff)` in `FUN_18000ab40`; `"D"` 0xf4c4 |
| Print speed | `^S<n>` CRLF | `n` = the number before `:` in `~Speeds.Print` (RT730i: 2,3,4,5; unit in/s). If the stored speed does not match a list entry, the last entry is used. | Options > Print Speed. Not sent when "Use Current Printer Settings" is checked (default; config flag bit 2). | driver binary: PM `FUN_18000b1b0`, `FUN_180009620` (parses `"n:x in/sec"`), `"S"` 0xf948. data file: Model.d:5420 |
| Darkness | `^H<n>` CRLF | 0..19 (validated 0..0x13), unitless. RT730i default 8. | Options > Darkness. Not sent when "Use Current Printer Settings" is checked (default; flag bit 3). | driver binary: PM `FUN_18000c2f0` case 5, range in `FUN_18000ab40`; `"H"` 0xf97c. data file: Model.d:5417 |
| Copies per label | `^C1` CRLF | always 1 | always sent at job configuration, unless `Features ~Suppress.CopiesPerLabel` (not set for Godex_PlusSeries) | driver binary: PM `FUN_18000b1b0` (type 4 value 1), `"C"` 0xf724 |
| Label length / media | `^Q<len>,<gap>` (gap labels), `^Q<len>,<bmw>,<bmo><+|->` (black mark), `^Q<len>,0,<extra>` (continuous), then CRLF | All values mm.d (mm with 1 decimal) because `~Command.LabelLength=Q`. `len` = page height. `gap` = Label Gap (default 3.0). `bmw` = Black Mark Width (default 3.0). `bmo` = abs(Black Mark Offset) followed by `+` if >= 0 else `-`. `extra` = Extra Feed. Variant `QD` would use dots; any other letter uses integer mm. | Stock page > Media Type (0 continuous, 1 gaps, 2 marks), Label Gap, Black Mark Width/Offset, Extra Feed. Default media type = gaps. | driver binary: PM `FUN_18000bd50` (`CommandSet_GDX::LabelLength`), caller `FUN_18000b570`; defaults in `FUN_18000a2b0` (`~GapLength.Default`/`~BlackMarkWidth.Default` default 3000 µm). data file: Features.d `[Godex_PlusSeries] ~Command.LabelLength=Q`. help file: Stock.html |
| Label width | `^W<mm>` CRLF | integer mm, rounded (`Measurement::MM`) | page width from page setup (stock width) | driver binary: PM `FUN_18000b570` (type 10), `"W"` 0xf4cc |
| Start position (row offset) | `~Q<+n|-n|0>` CRLF | dots; `+` written only for n > 0. Range -100..+100 dots (`~RowOffset.Minimun/Maximum` defaults, not overridden for RT730i). | Stock > Position Adjustments > Start Position. Sent only when "Use Current Printer Settings" is unchecked (default checked, flag bit 1, `~UseCurrentPositionAdjustmentsByDefault` default true). | driver binary: PM `FUN_18000c780` (`CommandSet_GDX::RowOffsetAdjustment`), `"~Q"` 0x103e8, `"+"` 0xf728 |
| Stop position | Absolute: `^E<mm>` CRLF `^E<mm.d>` CRLF. Relative: `^EA<mm.d>` CRLF | mm; range -40.000..+40.000 mm (`~StopPosition.Min/Max` defaults ±40000 µm). Absolute sends the value twice: integer, then one decimal. | Stock > Stop Position with Relative/Absolute radio (flag bit 4; control 0x13af Relative = index 0, 0x13ae Absolute = index 1; default bit set = Absolute). Same "Use Current Printer Settings" gate as Start Position. | driver binary: PM `FUN_18000c2f0` case 3, `"EA"` 0x103d8, `"E"` 0xf4d0; CM radio binding @ConfigModule.c:3089-3091, 3546-3557; resource ids from gdx-r[enu].dll dialog. help file: Stock.html (Relative adds to printer value, Absolute replaces) |
| Begin label format | `^L` [`M`] [`I`] CRLF | `M` = mirror, `I` = inverse, only because `~Command.BeginLabelFormat.MirrorInverseOptions=true` | Mirror image / negative image options of the base driver (prtconfig flags 0x404 bit 1 / bit 2; label "inferred" for the UI name) | driver binary: PM `FUN_18000bc50`, `"M"` 0xf984, `"I"` 0xf974. data file: Features.d `[Godex_PlusSeries]` |
| End label format | `E` CRLF | none | always closes a format | driver binary: PM `FUN_18000bb80`. data file: Features.d `~Command.EndLabelFormat=E` |
| Copies (inline format) | `^P<n>` CRLF | 1..9999 (`Copies.Limit`) | application copy count (batch total) | driver binary: PM `FUN_18000bab0` (`CommandSet_GDX::PagesToPrint`), string 0x103cc; data file: Method.d `[EZPL] Copies.Limit=9999` |
| Print stored format | `~P<n>` CRLF | copies | after a `^K` recall | driver binary: PM `FUN_18000b9f0` (`CommandSet_GDX::PrintLabel`), string 0x103c8 |
| Inverse (whole label) | `Le,0,0,<w>,<h>` CRLF | dots, XOR rectangle over the full page | negative image when MirrorInverseOptions is false (not the case for RT730i) | driver binary: PM `FUN_18000c700`, string 0x103e0 |
| Raw bitmap | `Q<x>,<y>,<wbytes>,<h>` CR, then `wbytes*h` raw bytes, then CRLF | x, y in dots; `wbytes` = bytes per row; `h` = rows, rounded up to a multiple of 8 with zero rows | every bitmap on a normal (non-cached) page | driver binary: PM `FUN_180006900` (`field_segment`), split logic `FUN_180006090`, `FUN_180006a40`; `"Q"` 0xfa10 |
| Store graphic | `~MDELG,<name>` CRLF, then `~Ep,<name>,<size>` CR, `<PCX file>` CRLF | `name` = `GRAPHIC_<n>`; `size` = 128-byte PCX header + RLE data length | graphic caching (Method.d `Cache.Graphic=true`) | driver binary: PM `FUN_180006390`, `"~Ep,"` 0xfb48, `"GRAPHIC_"` 0xf458; PB `ImagePCX::GetSize/output_segment` |
| Recall graphic | `Y<x>,<y>,<name>` CRLF | dots | cached graphic placement | driver binary: PM `FUN_18000c670` (`CommandSet_GDX::PrintGraphic`), `"Y"` 0x103dc |
| Delete file | `~MDEL<t>,<name>` CRLF | `t`: `F` format, `G` graphic, `C` TrueType font, `E` bitmap font | cache management, font download | driver binary: PM `FUN_18000b870`, ctors `FUN_18000b8f0` (0x46), `FUN_18000b930` (0x47), `FUN_18000b970` (0x43), `FUN_18000b9b0` (0x45); `"~MDEL"` 0x103c0 |
| Store format | `^F<name>` CRLF, format body, `E` CRLF | `name` = `FORMAT_<n>` | format caching (Method.d `Cache.Format=true`) | driver binary: PM `FUN_180001230`, `"^F"` 0xf448, `"FORMAT_"` 0xf440 |
| Recall format | `^K<name>` CRLF, variable fields, `E` CRLF, `~P<n>` CRLF | | format caching | driver binary: PM `FUN_1800012e0`, `"^K"` 0xf44c |
| Sample print | `E` CRLF `~P1` CRLF (format); `^L` CRLF `Y10,10,GRAPHIC_n` CRLF `E` CRLF (graphic) | | cache viewer "print sample" | driver binary: PM `FUN_1800015c0`, `FUN_1800016f0`; `"~P1"` 0xf450 |
| Line | `Lo,<x1>,<y1>,<x2>,<y2>` CRLF; `Le,...` for inverse pen | dots | vector lines | driver binary: PM `FUN_1800075a0`, `"Lo,"` 0xfe50, `"Le,"` 0xfe54 |
| Box | `R<x1>,<y1>,<x2>,<y2>,<t>,<t>` CRLF | dots | vector boxes | driver binary: PM `FUN_180005e00`, `"R"` 0xfa1c |
| Text / TTF / barcodes | `A...`, `AT...`, `V...`, `B...` | not analysed in detail | printer fonts and barcodes | driver binary: PM `FUN_180008820` area, `FUN_180004f..` |
| TTF download | `~H,TTF,<name><size>,` ... CR + data | not analysed in detail | font download | driver binary: PM `FUN_1800025d0`, string 0xf4a8 |
| Bitmap font download | `~J<name>` CR, PCL-style `ESC*c<n>D ESC)s64W` header and `ESC*c<n>E ESC(s<n>W` per char | not analysed in detail | soft font download | driver binary: PM `FUN_1800025d0`, `FUN_180002980`, strings 0xf4b8, 0xf4c0, 0xf4c8, 0xf4d4 |
| RFID IC position | `~HE<mm>,<n>` CRLF (if `RFID ~Command.Supports.WM`) else `^RS<mm>,-1,-1,-1,-1` CRLF | mm integer | RFID options > Adjust RFID IC Position, Offset Amount, Offset Printing | driver binary: PM `FUN_18000c9f0`, strings 0x10594, 0x105bc |
| RFID write (brief) | `RFW,H,<start>,<len>,<seg>,...`, `HS42,<1|2|3>`, `WB<n>,<len/2>,2,<data>`, `PW2,...`, `LK2,...`, `RZ...` | not analysed | RFID fields | driver binary: PM `FUN_180007750` and neighbours, strings 0xfd78-0xfdf8 |
| Clock set | `~D<MM>,<DD>,<YY>,<hh>,<mm>,<ss>` CRLF | 2-digit fields from SYSTEMTIME | printer clock (RTC) data | driver binary: PM `FUN_180009dd0`, CM same function |
| User commands | free text | | "Send Printer Command" at start of job (phase 0), end of job (1), start of format after `^L` (2), end of page (3) | driver binary: DC `prtconfig::print_user`; PM calls with 0/1/2/3 |

### Utility and status commands (ConfigModule, driver binary)

| Command | Exact bytes | When | Source |
|---|---|---|---|
| Status query | `~S,STATUS` CRLF | status monitor | CM `FUN_1800010a0`. Response parsed from the last line: `SS,LLLLL` (2-digit status code, comma, 5-digit labels remaining) in `FUN_1800010c0`. Codes 00..11, 13, 20, 21, 22, 50, 60, 62 map to Seagull states; 00 = ready. |
| Immediate mode | `^XSET,IMMEDIATE,1` CRLF | once when the communication channel opens | CM `FUN_180001430` |
| Head test | `~T` CRLF | Tools > "Print Head Test" (action 0x3f3) | CM `FUN_180002810` |
| Configuration print | `~Z` CRLF (action 7), `~V` CRLF (action 10) | both jobs are named "Print Configuration" | CM `FUN_180002810` |
| Sensor calibration | `~S,SENSOR` CRLF | printer action 9 (job name comes from a resource string) | CM `FUN_180002810` |
| File lists | `~X1` formats, `~X2` graphics, `~X3` CRLF `~X5` fonts, `~X4` all files | Tools menu | CM `FUN_180002810` |
| Media sensor | `^G<n>` CRLF | Set Media Sensor dialog. n = 2 Automatic, 0 Reflective, 1 See-Through (item data 2/0/1 for string ids 0x1ced/0x1cee/0x1cef; text order in gdx-r[enu].dll is Automatic, Reflective, See-Through). Help says default is Automatic. | CM `FUN_180003bb0`, `FUN_180003a30`; help file: SetMediaSensor.html |
| Memory | `^XSET,MEMORY,<n>` CRLF | Configure Memory dialog. 0 = internal flash, 1 = extended memory (USB host). | CM `FUN_180003f10`, `FUN_180003dd0`; help file: MemoryConfiguration.html |

No `~Z` reset, no `^XSET` other than IMMEDIATE and MEMORY, and no `~S,` other than STATUS and
SENSOR appear in either module.

## Job structure (driver binary)

Order of calls, from the `extdev` vtable (PM 0x180010fa0) matched to the `prtdev` base vtable
(PB 0x18006a8c8):

1. `StartDocW` (PM `FUN_180001a90`): validate settings, user command phase 0.
2. `Configuration` (PM `FUN_180001ae0` -> `FUN_18000b1b0`): `^A?`, `^O?`, `^D?`, `^S?`, `^H?`, `^C1`.
3. `EndPage` (PM `FUN_180001d30`, page type 0 -> `FUN_1800020b0`):
   - per-page cutter update (`FUN_18000b790`).
   - Phase -0x21: graphic downloads, only in cache mode.
   - `OutputFormat` (PB `CacheEngineBase::GenerateFormat` @0x180009030) captures the output of
     PM `FUN_180001110` into a buffer: `^Q`, `^W`, [`~Q`, `^E`], [RFID adjust], `^L`, user phase 2,
     fixed fields (phases -0xb, -0x15, -1).
   - `SelectFormat` -> PM `FUN_1800012e0` (not cached): `^P<copies>` CRLF, the buffer, phase 1
     fields (raw `Q` bitmaps), [`Le` inverse], `E` CRLF.
   - user phase 3.
4. `EndDoc` (PM `FUN_180001ce0`): user phase 1.

## Bitmap encoding (driver binary)

- Direct path (normal printing): command `Q`, **uncompressed**, 1 bit per dot, rows top to bottom.
- Polarity: **1 = black (print), 0 = white**. Evidence: the band splitter treats a zero byte as
  blank (PM `FUN_1800065e0`), and the PCX converter inverts the same SBITMAP bytes and pads with
  0xFF (PB `ImagePCX::Convert` @0x180028bc0), because PCX 1-bit uses 1 = white.
- Bit order: MSB = leftmost dot. This is inferred from the Windows 1-bpp DIB layout that SBITMAP
  wraps. The decompiled code does not show any bit swap.
- The driver splits the page into horizontal bands. It skips blocks of 8 all-blank rows and
  starts a new band after an all-blank 8-row block. It trims all-zero bytes on the left and
  right of each band (the `x` origin moves by 8 dots per trimmed byte). The band height is rounded
  up to a multiple of 8 with zero rows. Source: PM `FUN_180006090`, `FUN_180006a40`, `FUN_180006620`,
  `FUN_180006790`.
- Cache path (graphic caching on): PCX file (128-byte header + PCX RLE, inverted polarity) sent
  with `~Ep,GRAPHIC_n,<size>` CR, then placed with `Y<x>,<y>,GRAPHIC_n`.
- This path is taken when PrtDev flag 0x471 is set (page type 0 with caching off, or page
  type 0x10) and the image is not marked for caching. Source: PM `FUN_1800024b0`, `FUN_180006090`.

## Sample job

Settings: 100 x 150 mm label, gaps 3 mm, darkness 10, speed 4, direct thermal, post-print action
None (tear-off), 1 copy, one full-page bitmap with ink in the first and last byte column and in
every 8-row block. "Use Current Printer Settings" is unchecked for speed and darkness and the
print method is set to Direct Thermal. Position adjustments stay at the default ("use current"),
so no `~Q` / `^E`.

Assumed page size in dots: 1181 x 1772 (100 mm and 150 mm at 300 dpi, rounded). Bytes per row =
ceil(1181/8) = 148. `^W`: MulDiv(1181,25400,300) = 99993 µm -> 100 mm. `^Q`: MulDiv(1772,25400,300)
= 150029 µm -> 150.0. If Seagull truncates the height to 1771 dots, the value is `149.9`.

```
^AD<CR><LF>
^O0<CR><LF>
^D0<CR><LF>
^S4<CR><LF>
^H10<CR><LF>
^C1<CR><LF>
^P1<CR><LF>
^Q150.0,3.0<CR><LF>
^W100<CR><LF>
^L<CR><LF>
Q0,0,148,1776<CR><148*1776 = 262848 raw bytes, rows 1772..1775 are 0x00><CR><LF>
E<CR><LF>
```

Hex of the text part: `5E 41 44 0D 0A 5E 4F 30 0D 0A 5E 44 30 0D 0A 5E 53 34 0D 0A 5E 48 31 30 0D 0A
5E 43 31 0D 0A 5E 50 31 0D 0A 5E 51 31 35 30 2E 30 2C 33 2E 30 0D 0A 5E 57 31 30 30 0D 0A 5E 4C 0D 0A
51 30 2C 30 2C 31 34 38 2C 31 37 37 36 0D` ... data ... `0D 0A 45 0D 0A`.

With all defaults (use current printer settings for method, speed, darkness) the first lines
reduce to `^O0`, `^D0`, `^C1`.

## Open questions and uncertainties

1. Page size in dots for 100 x 150 mm (1181/1772 vs 1181/1771) comes from Seagull's page
   setup code, which was not decompiled. This changes `^Q150.0` vs `^Q149.9` and the `Q` height.
2. SBITMAP row stride: assumed `ceil(width/8)`. If SBITMAP pads rows to 4 bytes, `wbytes` can be
   larger before trimming (for 1181 dots both give 148).
3. MSB-first bit order is inferred, not proven by code.
4. Cut with occurrence "After Job" or "After Identical Copies": per page the driver sends
   `^D<Interval field>` (default 1). It is unclear whether the base layer rewrites the interval
   to the job count. Not verified.
5. `^EA` (relative stop position) and the double `^E<int>` / `^E<mm.d>` for absolute come from
   the binary. Their firmware meaning on RT730i is not confirmed. The double send is likely for
   firmware that does not accept decimals (guess).
6. `^Q<len>,0,<extra feed>` for continuous media: the meaning of the third field on the printer
   is not confirmed. The `+`/`-` suffix for black-mark offset is from the binary only.
7. `~Q` units are dots (binary). Whether the printer reads it as dots is not confirmed.
8. Printer action numbers 7, 9, 10 map to menu items through base resources. Their menu text was
   not extracted. `~Z` and `~V` both use the job name "Print Configuration".
9. Status code meanings beyond "00 = ready" are only Seagull internal codes. A table of Godex
   meanings needs the manual.
10. Mirror/inverse flags (prtconfig 0x404 bits 1 and 2) are mapped to the base driver's
    mirror/negative options by inference.
11. `Tag_Copies` returns the plain number when no template tagger is attached (normal printing).
    In template export it can return a placeholder instead.
12. Text, barcode, font download, and RFID syntax were skimmed only.
