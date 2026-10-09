# BP730i: what the EZPL manual and the vendor documents say

Scope: EZPL Programmer's Manual Rev. O.4 (2025-06-19), the German RT730i user manual, the Labelident support PDF, and the Labelident datasheet. The question is what matters for printing PDF-rendered 1-bit bitmaps of shipping labels (100 x 150 mm, 2 mm gap, direct thermal, no cutter, no peeler) and product labels.

Citation keys:

- "EZPL m.pN (pdfM)" means the printed page N of the EZPL manual and the PDF page M. The text is in `txt/ezpl/pMMM.txt`. Printed page = PDF page + 12.
- "UM pdfN" means the PDF page N of the RT730i user manual (German).
- "DS" means the Labelident datasheet. "SUP pN" means page N of the Labelident support PDF.
- "inferred" marks a conclusion that the documents do not state.

The repo document `docs/reverse-engineering/golabel-and-docs.md` already covers the GoLabel wire format and most setup commands. This file adds exact wording, contradictions, and the gaps.

## 1. Command groups in EZPL Rev. O.4

Command classes (EZPL m.p18 (pdf6)): "Setup commands" and "Control commands" use the prefixes `^` and `~`. "Label Format commands have no prefix." The rule for all commands: "The comma (,) is the delimiter to separate each parameter, and the CR (Carriage Return) signifies the end of every command."

Each group ends with a "Value" line. It says if the group can help to print PDF-rendered bitmaps of shipping or product labels.

### 1.1 Media and label setup (setup commands)

| Command | Meaning | Source |
|---|---|---|
| `^An` | `^AD` direct thermal (ribbon sensor off), `^AT` thermal transfer. Permanent. | m.p19 (pdf7) |
| `^Bx` / `^Mx` | Feed back / forward x mm, 1-1000. Temporary. | m.p19 (pdf7), m.p26 (pdf14) |
| `^Cx` | Copies per label, 1-32767. Permanent, default 1. | m.p20 (pdf8) |
| `^Dx[,delay][,back delay]` | Labels per cut, 0 = cutter off. Permanent. | m.p22 (pdf10) |
| `^Ex` | Stop position, 0-40 mm. Permanent. | m.p23 (pdf11) |
| `^Gn` | Sensor: 0 reflective, 1 see-through, 2 auto. Permanent, default 2. | m.p24 (pdf12) |
| `^Hx` | Darkness 00-19. Permanent. Out-of-range values clamp. | m.p24 (pdf12) |
| `^Lx` | Start of label format. `I` inverse, `M` mirror, `Rn` rotation 0-3. | m.p25 (pdf13) |
| `^On` | 0 none, 1 dispenser (peel), 2 applicator. | m.p26 (pdf14) |
| `^Px` / `^PAx` / `^PI` | Labels per job / auto print after recall / print until Cancel. | m.p27-28 (pdf15-16) |
| `^Qx,y(,z)` / `^QDx,y(,z)` | Label length, gap or mark, feed. mm or dots. Permanent. | m.p28-29 (pdf16-17) |
| `^Rx` | Left margin 0-399 dots. Permanent. | m.p30 (pdf18) |
| `^Sx` (`^SF`, `^SB`, `^SJ`, `^ST`) | Print speed in ips; feed, backfeed, top-of-form, "RespondSpace" speed. | m.p30 (pdf18) |
| `^Wx` | Label width in mm. Permanent. | m.p31 (pdf19) |
| `~Q±x` | Vertical start offset, -100..+100 dots. Permanent. | m.p79 (pdf67) |
| `~Rx` | Rotate 180 degrees when `~Rx < ^Wx`. Permanent. | m.p79 (pdf67) |
| `~S,OFFSETa,n` | Fine position adjust X or Y, -100..+100. | m.p81 (pdf69) |
| `~S,SENSOR[,length,gap,percent]` | Auto sensing (media calibration). | m.p82-83 (pdf70-71) |
| `~S,CSENSOR` | Empty-media calibration, factory use on some models. | m.p80 (pdf68) |
| `^XSET,ACROSSGAP,n` | Print one image across the gap. Permanent, default 0. | m.p37 (pdf25) |
| `^XSET,LENGTHOFFSET,n` | Shorten the declared label length by n mm (0-50). | m.p49 (pdf37) |
| `^XSET,SENSING,n` | Sensor for continuous media: 0 reflective, 1 see-through, 2 none. | m.p58 (pdf46) |
| `^XSET,WHENTOSENSING,n` | Auto sensing at power on (1), after cover close (2), on open and close (3). | m.p64 (pdf52) |
| `^XSET,TOPOFFORM,n` / `^XSET,TOF,n` | Top-of-form at power on or after error. | m.p61 (pdf49) |
| `^XSET,PAPEROUT,n` | Extra paper-out detection length in dots. | m.p53 (pdf41) |
| `^XSET,REALLENGTHPRINT,n` | Label length follows content (continuous media). | m.p56 (pdf44) |
| `^XSET,GEARCOMP,n`, `^XSET,FIRSTPAGEGEARCOMP,n` | Gear backlash and first-label offset correction (default 12 dots). | m.p43-44 (pdf31-32) |
| `^XSET,AUTOLOAD,n[,m]` | Autoload (HD830 only). | m.p68 (pdf56) |

Value: high. `^AD`, `^Q`, `^W`, `^E`, `^H`, `^S`, `^R`, `~Q`, `~R`, `^L` and `~S,SENSOR` control every bitmap label. `^XSET,ACROSSGAP` explains why a bitmap that is longer than the label is cut at the gap.

### 1.2 Image and graphics (inline)

| Command | Meaning | Source |
|---|---|---|
| `Qx,y,width,height` + data | Inline raw bitmap. width in bytes, height in dots, data length = width x height. | m.p114 (pdf102) |
| `QAx,y,width,height<CR>` + data | Same, data "compressed with Zlib". | m.p114 (pdf102) |
| `~G` + `Gw<data>` lines | "Graphic mode": raw rows sent "directly from host to the printing buffer". | m.p72 (pdf60), m.p105 (pdf93), m.p158 (pdf146) |
| `^XSET,DRAWMODE,n` | Overlap mode: 0 OR, 1 XOR, 2 overwrite. Until power off. | m.p42 (pdf30) |
| `^XSET,DPIEMULATE,n` | DPI emulation. "300 DPI can emulate 150 DPI resolution". | m.p42 (pdf30) |
| `^XSET,ROTATION,n` | Rotate whole label; swaps length and width. | m.p57 (pdf45) |

Value: high for `Q`. Medium for `QA` (smaller transfers, but untested on this firmware). Low for `~G` (inferred: row-wise only, max 255 bytes per row, no position control except `^R`). `^XSET,DPIEMULATE,150` could halve the bitmap size, but it loses print quality (inferred).

### 1.3 Stored graphics, forms, fonts, files

| Command | Meaning | Source |
|---|---|---|
| `~En,name,size` | Store a PCX (`P`), BMP (`B`), or PNG (`N`) image in flash. "maximum 512K byte". | m.p71 (pdf59) |
| `~Ix,name,length` | Same, in SDRAM only. Lost at power off. Max 512 KB. | m.p73 (pdf61) |
| `Yx,y,name` | Print a stored graphic. The name can be a variable. | m.p126 (pdf114) |
| `^Fname` ... `E` / `^Kname` / `~Px` | Store / recall a label format, print it again. | m.p23 (pdf11), m.p25 (pdf13), m.p79 (pdf67) |
| `AUTOFR` | Stored form that runs in standalone mode at power on. | m.p88 (pdf76) |
| `~H,TTF,...` / `~H,TTF_TABLE,...` | Download a TrueType font / Unicode table. | m.p73 (pdf61) |
| `~Jx`, `~C`, `~c`, `~F`, `~f` | Bitmap font, Asian font downloads. | m.p70-73 (pdf58-61) |
| `~L,DBASE` / `~L,DBASECSV` / `~L,SERIAL` | Database and serial-number files. | m.p74 (pdf62) |
| `~MDEL`, `~MDEL*`, `~MDELn,name`, `~MDIR`, `~MCPY`, `~MMOV`, `~MGETF`, `~MGETS`, `~MSETT`, `~MGETT` | Memory and file management. | m.p74-78 (pdf62-66) |
| `~X1`..`~X9` | Print memory directory listings; `~X6` returns the odometer. | m.p86-87 (pdf74-75) |
| `^XSET,FORMAT,0`, `^XSET,MEMORY,n` | Format flash; choose flash, USB memory, or DRAM. | m.p43 (pdf31), m.p51 (pdf39) |

Value: low. A stored logo plus an inline variable part could save transfer time for product labels. But the PDF already contains the full label, and stored state adds failure modes (full memory, duplicate names, stale files). A `~E`/`~I` upload is capped at 512 KB.

### 1.4 Native text and fonts

`At` bitmap fonts A-H, I, K (OCR-B), L (OCR-A), Asian fonts `Zn` (m.p89 (pdf77)). `AT` built-in TrueType and `ATt` downloaded TrueType (m.p90-91 (pdf78-79)). `Vt` downloaded character sets (m.p122 (pdf110)). Related settings: `^XSET,CODEPAGE,n` (m.p41 (pdf29)), `^XSET,UNICODE,n` (m.p63 (pdf51)), `^XSET,SLASHZERO,n` (m.p59 (pdf47)), `^XSET,TEXTBLOCK` (m.p61 (pdf49)).

Value: none. The PDF already contains the text as rendered glyphs.

### 1.5 Native barcodes

`Bt` 1-D barcodes (Code 39, EAN/UPC, Code 128, EAN 128, ITF14, Codabar, Code 93, Postnet, MSI, and more) (m.p92 (pdf80)). `B050` Code 11 (m.p95), `B053` DotCode (m.p98), `B5n` GS1 DataBar (m.p99), `BE2` SAN4 (m.p99). PDF417 family `P`, `PA`, `PB`, `PC`, `PD`, `PH`, `PM` (m.p108-113 (pdf96-101)). `M` MaxiCode (m.p107 (pdf95)). `W` QR / Micro QR (m.p124 (pdf112)). `XRB` DataMatrix (m.p125 (pdf113)). `Z` Aztec (m.p126 (pdf114)). Settings: `^XSET,BARCODEALIGN`, `^XSETBAR,ADDWHITE`, `^XSETBAR,VERSION` (m.p39-40 (pdf27-28)).

Value: none for PDF labels. Carrier PDFs already contain the barcode. A native barcode would need the PDF to be parsed and re-laid out. One narrow case (inferred): a raster barcode that is scaled by a non-integer factor can lose module-width accuracy. Native `B`/`W` commands avoid that, but only for labels that we design ourselves.

### 1.6 Lines and boxes

`La,x,y,x1,y1` line, `Ls` diagonal line, `H` table, `R` rectangle (m.p106-107 (pdf94-95), m.p114 (pdf102)).

Value: none. The bitmap contains them.

### 1.7 Counters, serialisation, variables, database

`Cx,ys,value,prompt` serial numbers (m.p102 (pdf90)), `C#SET,UNPROMPT` (m.p101). `Vxx` variables and `V#...` operations (m.p115-123 (pdf103-111)). `FILEDB,OPEN|MOVE|FIND` (m.p104 (pdf92)). `^XSET,INVISIBLE`, `^XSET,UNPROMPT`, `^XSET,PROMPTTIME`, `^XSET,DBSEARCH`, `^XSET,LABELSEARCH` (m.p42-54).

Value: none. These serve standalone printing from stored forms, not host-rendered bitmaps.

### 1.8 Real-time clock

`~Dm,d,y,h,i,s` sets the clock (m.p71 (pdf59)). `^XGET,RTC` reads it (m.p35 (pdf23)). `^D+dddd.hh`, `^D±xnnnn`, `^T+hhh.mm` date and time arithmetic (m.p21, m.p31 (pdf9, pdf19)). `Th|m|s` and `D...` layouts (m.p115 (pdf103)). `^XSETRTC,ISOWEEKNUM`, `^XSETRTC,LANGUAGE` (m.p66-67 (pdf54-55)).

Value: none. The host renders dates into the bitmap.

### 1.9 Status and queries

| Command | Meaning | Source |
|---|---|---|
| `~S,CHECK` | Reply `aa<CR><LF>`. Status codes 00-62. Needs `^XSET,IMMEDIATE,1`. | m.p80 (pdf68) |
| `~S,STATUS` | Reply `aa,nnnnn<CR><LF>`. nnnnn = labels still to print, 00000-99999. | m.p84 (pdf72) |
| `^XSET,IMMEDIATE,n` | Switch for `~S,CHECK` / `~S,STATUS`. | m.p44 (pdf32) |
| `^XSET,ACTIVERESPONSE,n` | Printer pushes `ERRORxx` on errors. | m.p38 (pdf26) |
| `~Kn` | Send `Y` after each printed label (needs ACTIVERESPONSE 1); `X` before print. | m.p73 (pdf61) |
| `~B` / `~BOK` | Firmware version / version, date, model names, USB name. | m.p70 (pdf58) |
| `^XGET,CONFIG` | Self-test page text. | m.p31-33 (pdf19-21) |
| `^XGET,PRINTNAME`, `^XGET,PRINTINFO` | Model name; cutter count, label count, print length. | m.p34 (pdf22) |
| `^XGET,SENSORSTATUS` | Auto-sensing values. | m.p35 (pdf23) |
| `^XGET,TPHDOTSTATE`, `^XGET,TPHRESISTANCE[2]` | Print-head dot test. | m.p35-36 (pdf23-24) |
| `^XGET,USBINFO`, `^XGET,CODEPAGE`, `^XGET,LANGUAGE`, `^XGET,KEYBOARD`, `^XGET,AUTOLOAD` | Other queries. `^XGET,LANGUAGE` is the LCD language, not the command language. | m.p31-37 (pdf19-25) |
| `~V` / `~T` | Print self-test page / print-head test pattern. | m.p84-85 (pdf72-73) |
| `~S,DUMP` | Hex dump mode. Exit with FEED or power cycle. | m.p81 (pdf69) |

Value: high for `~S,CHECK` / `~S,STATUS` (job completion and error detection over TCP) and `~V`. Medium for `^XGET,CONFIG` and `~B`. The documents list no query that reports the active command language (inferred from the full command list).

### 1.10 Printer behaviour settings (`^XSET`, `^XSETCUT`, `^XGET`)

Not listed elsewhere in this file: `^XSET,ACTIVEMESSAGE` (print file errors), `^XSET,AHEATSYSTEM` (600 dpi only), `^XSET,ALIAS`, `^XSET,AUTOTPHTEST`, `^XSET,BACKFEED` / `^XSET,SMARTBACK` (pre-print while waiting for cut or peel), `^XSET,BACKFEEDAFTERCUTTING`, `^XSET,BEEP` / `^XSET,BUZZER`, `^XSET,ERRORPRINT` (reprint after error), `^XSET,FEEDCUT`, `^XSET,FEEDKCM`, `^XSET,FEEDTYPE`, `^XSET,HEATOFFSET`, `^XSET,HEATUP`, `^XSET,KEYBOARD[MODE]`, `^XSET,LABELCMD`, `^XSET,LABELINPUT`, `^XSET,LABELMODE` (skip blank labels), `^XSET,LANGUAGE` (LCD), LCD settings (`LCDCOUNTER`, `LCDSHOWSERVICE`, `LCDDATETIMEFORMAT`, `LCDVOLUME`, `LCDLOCK`, `SHOWCLOCK`, `SHOWDATETIME`), `^XSET,LINERLESS`, `^XSET,LOCKCMD`, `^XSET,PADLEFT`, `^XSET,PAGEDELAY` (0-300000 ms between pages), `^XSET,PASSWORD`, `^XSET,PAUSEPRINT`, `^XSET,PORTACTIVE`, `^XSET,PRTPWD`, `^VERIFYHOSTID`, `^XSET,RECALLCRLF`, `^XSET,REWINDER`, `^XSET,RIBBONDIAMETER`, `^XSET,RIBBONNEAREND`, `^XSET,SCANNERMODE`, `^XSET,SHUTDOWN`, `^XSET,SPEEDDOWN`, `^XSET,STANDBY`, `^XSET,TEARPAPERTIME`, `^XSET,TPHLENGTH`, `^XSET,USBPRODUCT`, `^XSET,USBVENDOR`, `^XSET,SELFPAGEADD`, `^Yb,p,d,s` (RS-232). Sources: m.p37-69 (pdf25-57).

Value: low, with three exceptions. `^XSET,ERRORPRINT,n` decides if a label is printed again after a media error (m.p43 (pdf31)); a duplicate shipping label is a real risk. `^XSET,STANDBY,1` shuts down "all communication ports" after about 100 s until FEED is pressed (m.p60 (pdf48)); it must stay 0. `^XSET,LABELMODE,1` skips blank labels (m.p47 (pdf35)).

### 1.11 Cutter and peeler

`^D`, `^O`, `^XSETCUT,DOCUTTING,1`, `^XSETCUT,DOUBLECUT,x[,y]`, `^XSETCUT,MODE,n[,m][,p]`, `^XSET,FEEDCUT`, `^XSET,BACKFEEDAFTERCUTTING`, `^XSET,SMARTBACK` (m.p22, m.p26, m.p39, m.p43, m.p60, m.p64-65 (pdf10, 14, 27, 31, 48, 52-53)). The GoLabel-only `^Db` is not in the manual.

Value: none for the owner's hardware (no cutter, no peeler). Send `^D0` and `^O0` only to undo old settings.

### 1.12 Network

`^NS[a,...,i]` IP settings, last field = port, reply example `D,192.168.0.1,255.255.255.0,192.168.0.1,,,,,9100` (m.p129 (pdf117)). `^NR` SMTP/SNMP alert mask, `^NA` SMTP, `^NL` SNMP, `^NMACADDR`, `^NH,x` web page on/off (m.p26, m.p128-129 (pdf14, pdf116-117)). `^NTCPCONNECTMODE,a`: 0/255 default queue, 1 = "When a new device connects, the previously connected devices will be disconnected" (m.p135 (pdf123)). `^XSET,NETPASSWORD`, `^XSET,NETSPEED`, `^XSET,NETSOCKETIDLETIME,n` (0 = disable, else idle timeout in s) (m.p51-52 (pdf39-40)). Bluetooth `^NW,B...` (m.p131-135) and Wi-Fi `^NW,W...` (m.p137-142). `^XSET,EXTERNCARDMODE` (m.p144).

Value: low. `^NTCPCONNECTMODE` and `^XSET,NETSOCKETIDLETIME` could explain TCP 9100 hangs when a socket stays open (inferred).

### 1.13 RFID

Rev. O.4 has no RFID chapter. The TOC lists no RFID command (m.p2-6 TOC, pdf2-6). GoLabel sends `^RW` / `^RS` only for RFID objects (repo doc section 3).

Value: none.

### 1.14 Command language switching

`~S,ES[p1]` only (m.p84 (pdf72)). Details in 2b.

Value: high, because of the "Auto" lock seen on hardware.

### 1.15 Misc: keys, reset, LCD, service

`~S,FEED`, `~S,PAUSE`, `~S,CANCEL`, `~S,BUFCLR` (m.p84 (pdf72)). `~Z` reset (m.p87 (pdf75)). `^Z` factory defaults (m.p69 (pdf57)). `~Fn` keyboard mode (m.p72 (pdf60)). `~N,...` LCD message (m.p78 (pdf66)). `~~INTERNALCOMMANDS,n`, `~~INTERNALCOMMANDC` (checksum page), `~~INTERNALCOMMAND+INIT`, `~~INTERNALCOMMANDQ`, `~~INTERNALCOMMANDPROMPT2` are mentioned but not documented as separate commands (m.p19 (pdf7), m.p47 (pdf35), m.p63 (pdf51), m.p82 (pdf70)).

Value: medium. `~S,CANCEL` and `~S,BUFCLR` are the recovery tools, `~Z` is the soft reset.

## 2. Answers

### 2a. `Q` and `QA` (inline bitmap)

- Syntax: "Qx,y,width,height" then "Data..." on the next line. "width = width of graphic (unit: byte)", "height = height of graphic (unit: dots)", "(data length = width x height)" (m.p114 (pdf102)).
- Header terminator: the `Q` entry does not name one. The general rule is "the CR (Carriage Return) signifies the end of every command" (m.p18 (pdf6)). The `QA` title is explicit: "QAx,y,width,height<CR>data" (m.p114 (pdf102)). GoLabel sends LF (repo doc). The repo sends CR only (`src/lang/ezpl.ts:63`), which matches the manual. Inferred: the parser accepts CR or LF and reads exactly width x height bytes after it. A CRLF header would add one stray byte (LF) to the data, unless the parser skips it. That is not documented, so do not send CRLF after the header.
- Height constraint: none. Height is in dots, with no multiple-of-8 rule. Only the width is in whole bytes, so the row width is padded to 8 dots (m.p114 (pdf102)). The examples use heights 8 and 20 (m.p114, m.p159 (pdf147)).
- Polarity and bit order: not stated in words. The example sends `A` = "01000001 ( Binary )" and the print result shows two thin bars per byte (picture on m.p114 (pdf102)). The `G` example (01000111) shows the same in m.p159 (pdf147). So bit 1 = printed dot, MSB first. This matches GoLabel.
- Origin: the manual says "x = Hori. of left-bottom pos." and "y = Vert. of left-bottom pos." for both `Q` and `QA` (m.p114 (pdf102)). Text, barcode, and `Y` graphics use "top-left" (m.p89, m.p92, m.p126). Inferred: "left-bottom" is a copy error, because GoLabel and the repo place the top-left at x,y and the hardware prints correctly.
- Maximum size: not documented for `Q`. The documented limits nearby are the image buffer (see 2g) and 512 KB for stored graphics (`~E`, `~I`; m.p71, m.p73 (pdf59, pdf61)).
- `QA`: "Can handle images that have been compressed with Zlib." Header "QAx,y,width,height<CR>" then data. "Parameter is not valid: Parameter is not processed." (m.p114 (pdf102)). The header has no compressed-length field. Inferred: the printer finds the end of the data from the self-terminating zlib stream (RFC 1950 header, deflate, Adler-32). GoLabel emits `78 9C` + deflate + Adler-32 when `ImageCompress=True` (repo doc). The manual does not say if raw deflate without the zlib wrapper works, or if the stream must be followed by CR or LF. Treat `QA` as untested on this firmware.

### 2b. `~S,ES` (command language)

- Syntax: "~S, ES[p1]" with "p1 = A or blank : auto switch ; p1 = G : EZPL ; p1 = E : GEPL ; p1 = Z : GZPL" (m.p84 (pdf72)). The manual prints a space after the comma in the title. The `~S,n` table writes it as "n = ES[p1]" with no space, and the other `~S` commands have no space (m.p84 (pdf72)). Inferred: send `~S,ESG` with no space.
- Default and persistence: "Current printer default = ~S,ESA (auto switch). When a printer switch to certain language, it can auto detect and switch again by rebooting printer." (m.p84 (pdf72)). The shared `~S,n` entry lists `ES[p1]` among its parameters and gives "Effect& default: Temporary, None" (m.p84 (pdf72)). Inferred: `~S,ESG` and `~S,ESZ` are temporary, and a power cycle returns the printer to auto detection. No document says that a fixed language survives a reboot.
- How auto detection decides: not documented. No document describes the detection rule, the bytes it looks at, or a timeout.
- When it locks: the only text is the sentence above. "When a printer switch to certain language, it can auto detect and switch again by rebooting printer." The most direct reading: once the printer has switched to one language, it detects again only after a reboot. This matches the hardware observation: in Auto, the first job after power-on fixes the language until the next power cycle. No document contradicts the observation.
- Does `~S,ES` work while the printer is in another language: not documented. `~S,ES` is described only in the EZPL manual. No GZPL manual was found (repo doc section 7). Inferred: a printer that is locked to GZPL parses the input as ZPL. `~S,ESG` is then not a valid ZPL command, so it is probably ignored, the same way `~V` is ignored. The repo comment in `src/lang/ezpl.ts:87` says "The printer accepts it in any mode while auto-detection is on (EZPL manual m.84; unverified)". The manual does not support that claim. It should be reworded or removed.
- Documented way back without a power cycle: none. `~Z` is EZPL and works "only ... when printer is in standby mode" (m.p87 (pdf75)), so it is unreachable from GZPL (inferred). Untested idea (inferred): Zebra `~JR`, the reset that the Windows ZPL driver sends (repo reference table). If GZPL mode honours it as a reboot, the printer returns to auto detection. It is not in these documents.
- RT730i menu: the menu tree has no "Emulation", "Command language", or "Auto" item for the command language. "Sprache" is the LCD language only (English, Deutsch, Chinese, Français, Español, Japanese, Italiano, Russian, Türkçe) (UM pdf36). "Automatische Medienerkennung" is media detection, not language (UM pdf36). The datasheet only lists "Printer Language: EZPL, EEPL, GZPL, automatic adjustment" (DS). `^XGET,CONFIG` and the self-test page show no language field (m.p33 (pdf21) picture; UM pdf39).
- Related: `^XSET,RECALLCRLF` has "EZPL: default = 0, GEPL: default = 1" (m.p56 (pdf44)), and `^XSET,REALLENGTHPRINT` says "Only support EZPL(GoDEX mode).GZPL(Zebra mode)" (m.p56 (pdf44)). Inferred: some settings have a separate default per language mode. Nothing more is said about mode state.
- Practical consequence (inferred): with Auto, the first job after power-on must be EZPL. Never send a ZPL job to this printer unless ZPL is the chosen language for the whole power cycle.

### 2c. `^E`, `^Q`, `~Q`, `^R`, `~R`

- `^E`: "x = 0~40 (unit: mm)". "Starting from the year 2016, decimal values are allowed for this parameter." "Permanent, default = 0" (m.p23 (pdf11)). The BP730i self-test shows `^E18` (UM pdf39). The UM menu range is "Stopp-Position 0-40" (UM pdf36). Labelident recommends 12-16 mm for tearing (SUP p4). Out-of-range handling: "Parameter is not processed" (m.p23 (pdf11)), so invalid input is dropped, not clamped.
- `^Q` gap value: "Gap label: x = Label length (unit: mm), y = Gap length (unit: mm)". "Permanent, default = "^Q100,3" for most models." "Decimal points are allowed for parameters." Out-of-range numbers are "replaced with the minimum or maximum value allowed within the range" (m.p28 (pdf16)). The manual does not say how the printer uses the gap value or how 2 mm and 3 mm differ. Facts that touch it:
  - `^XSET,PAPEROUT`: "Gap > 0 paper out len = Gap*2.5 + n (dot)" (m.p53 (pdf41)). Inferred: the declared gap scales the paper-out (missing-gap) window. A gap that is declared too large lets the printer run further before "media empty" or "jam". A gap that is declared too small can cause false errors.
  - `~S,SENSOR` has its own gap parameter "gap: 1 ~ 499 mm, default = 3" (m.p82 (pdf70)).
  - An example uses "^Q50,2 ; Label height = 50mm, gap = 2 mm" (m.p155 (pdf143)). So 2 mm is a normal value.
  - Inferred: on gap media the printer aligns to the sensed gap. The declared gap then mostly affects the error windows and the pitch (length + gap) that is used before the first gap is seen. Send the real 2 mm.
- `^Q` third field: "Plain paper: x = Label length, y = 0 (constant), z = Feed paper length (unit: mm)". For black mark: "y = Black mark width", "z = Black line to top of form position", "z+: When the position is outside the black mark. z-: When the position is within the black mark." (m.p28 (pdf16)). `^QD` is the same in dots, "default = ^Q800,24" (m.p29 (pdf17)). The `^QD` examples use 8 dots/mm (203 dpi). On 300 dpi, the manual elsewhere says "1mm=12 dots in 300dpi printer" (m.p89 (pdf77)), which is an approximation (the true value is 11.81).
- Cross-gap printing: "If this command is not used, the printer will automatically cut off any screen larger than 100mm when encountering a GAP and will not print it." (`^XSET,ACROSSGAP`, m.p37 (pdf25)). Inferred: a bitmap that is taller than `^Q` length is cut at the gap. 1772 rows at 11.811 dots/mm = 150.03 mm, so the last row or so can fall into the gap. This has no visible effect.
- `~Q`: "X =-100 ~ +100 (unit: dots)". "Permanent, default = 0". "+n move the start position downward, and the –n move the position upward (it can be set across 2 labels)". Invalid input: "If the input is a number, set the upper and lower limits" (m.p79 (pdf67)), so it clamps.
- `^R`: "X = 0~399 dots. However, it must not exceed the setting value of "^W"". "If the value of "x" exceeds the allowed limit, it will not be processed." "Permanent, default = 0". Example "^R08 (move right 1mm)" uses 203 dpi (m.p30 (pdf18)). `^L` rotation "will not affect by ^R" (m.p25 (pdf13)).
- `~R`: "x = label width (unit: mm)". "If ~Rx < ^Wx, rotate the label 180 degrees for printing." Example "^W100, ~R101: Print in the normal orientation. ^W100, ~R99: Rotate 180 degrees" (m.p79 (pdf67)). "Permanent, None". The self-test shows `~R200` (UM pdf39), so the default does not rotate. The appendix uses "~R200" to "Disable the rotate function" (m.p159 (pdf147)).

### 2d. `^XSET,IMMEDIATE`, `~S,CHECK`, `~S,STATUS`, `^XGET,CONFIG`

- `^XSET,IMMEDIATE`: the manual contradicts itself. "Effect & default: Permanent, default = 1", and in the next row "n = 0, set immediate response function off (default)" (m.p44 (pdf32)). It is "the switch for "~S,CHECK" and "~S,STATUS" commands" (m.p44 (pdf32)). `^XSET,ACTIVERESPONSE` has the same contradiction: "Permanent, default = 0" and "n = 1, return the error message (default)" (m.p38 (pdf26)). Inferred: keep sending `^XSET,IMMEDIATE,1` before `~S,STATUS`, as the repo does. It is permanent, so one send per session is enough.
- `~S,CHECK`: reply "aa<CR><LF>". Codes: 00 Ready, 01 Media Empty, 02 Media Jam, 03 Ribbon Empty, 04 Printhead Up (Open), 05 Rewinder Full, 06 File System Full, 07 Filename Not Found, 08 Duplicate Name, 09 Syntax error, 10 Cutter Jam, 11 Extended Memory Not Found, 13 Waiting Peel, 20 Pause, 21 In Setting Mode, 22 In Keyboard Mode, 50 Printer is Printing, 60 Data in Process, 62 TPH Over Heat (m.p80 (pdf68)).
- `~S,STATUS`: "Almost same as ~S,CHECK, the only difference is the response format of ~S,STATUS is "aa,nnnnn<CR><LF>"". "nnnnn : remaining number of prints, range from 00000 to 99999". Example reply "04,00100" (m.p84 (pdf72)). The note "This function is limited to models with Door Open Switch Sensor" refers to code 04.
- Code 01 versus 02: `~S,CHECK` separates them. `^XSET,ACTIVERESPONSE` lists both 01 and 02 as "MediaEmpty or Media Jam" (m.p38 (pdf26)).
- `^XGET,CONFIG`: "The printer will return configure status (the content is same as Self Test page) from RS232 or USB". "Send the self-test page back from the port it was sent from, whether it was sent from RS-232 or USB." (m.p31 (pdf19)). Ethernet is not mentioned. Inferred: TCP probably works too, because GoLabel uses it on network printers (repo doc), but the manual does not promise it. The example reply (picture, m.p33 (pdf21), from an RT730W V2.006) has these lines in order: `^xget,config` echo, model and version, `USB S/N`, `Serial port`, `MAC`, `IP ... (DHCP)`, `Gateway`, `Sub-Mask`, `Card Status`, `Network`, `PORT State L S E U B` / `1 1 1 1 1`, a `####` line, form / graphic / font / Asian font / database / TTF counts, `63980 KB FREE MEMORY`, `^S4 ^H10 ^R000 ~R200 ~Q+0`, `^W68 ^Q66,2 ^E0`, `Option:^D0 ^O0 ^AT`, `Ref.:2.7 2.8 2.8 [0.1_9]`, `Code Page:850`. The BP730i self-test adds `1 DRAM installed` and `Image buffer size:1500 KB`, and shows `Reflective AD:...` and `Default state=Yes` (UM pdf39). There is no language line and no darkness scale line.

### 2e. `~Z`, `^Z`, `~~INTERNALCOMMAND+INIT`

- `~Z`: "Reset the printer and the LED will flash once. It only applied when printer is in standby mode." (m.p87 (pdf75)). It is a restart, not a settings reset. Inferred from the `AUTOFR` example, which ends with `~Z` and says "Printer will reboot after the save the file" (m.p88 (pdf76)). Also, `^B`/`^M` say "If ~Z printer would turn on immediately" (m.p19, m.p26 (pdf7, pdf14)). Inferred: a reboot also returns `~S,ES` to auto, if the printer is in EZPL (2b).
- `^Z`: "Reset to factory default settings". "^Z: default value comes from EEPROM default area." "Reset to factory default. Same as ~~INTERNALCOMMAND+INIT" (m.p69 (pdf57)). Some settings survive it: `^XSET,LINERLESS` ("^Z goto default will not restore the factory default settings", m.p49 (pdf37)), `^XSET,AHEATSYSTEM` (m.p38 (pdf26)), `^XSET,PRTPWD` host ID and password (m.p55 (pdf43)), `^XSET,RIBBONDIAMETER` and `^XSET,RIBBONNEAREND` (m.p56 (pdf44)), `^XSET,DBSEARCH` (m.p42 (pdf30)), and `^XSET,FEEDKCM` (m.p43 (pdf31)).
- `~~INTERNALCOMMAND+INIT`: the same as `^Z` (m.p69 (pdf57)). It is also named as the way to restore the default ribbon-out detection length (m.p19 (pdf7)). It has no entry of its own.
- The UM menu "Einstellungen zurücksetzen" (Analyse) is the panel equivalent (UM pdf37). Inferred: it equals `^Z`.

### 2f. `^P`, `^C`, `~P`

- `^Px`: "Set the amount of copies for a printing. The Serial Number will be reset for each time the command is implemented." "x = 1 ~ 32767", 0 is "treated as "^P1"". "Effect & default: temporary" (m.p27 (pdf15)). `^XSET,LABELCMD` bit 2 can make `^Px` print "with unlimited number of sheets" (m.p46 (pdf34)).
- `^Cx`: "Number of copies per label". "x = 1 ~ 32767" or `^Vnn`. "Permanent, default = ^C1". "If you input the command ^C2 ^P3, the printer will print 6 pieces labels. If you input the command ^C3 ~P3, the printer will printer 9 pieces labels." (m.p20 (pdf8)). The example shows that `^C` repeats each serial value: 001, 001, 002, 002, 003, 003 (m.p20 (pdf8)). Because it is permanent, a stale `^C` from another tool multiplies every later job. The repo sends `^C1` in every job for this reason.
- `~Px`: "This command will repeatedly print the specific copies of label format." "x = 1 ~ 32767", 0 is treated as `~P1`. "Temporary" (m.p79 (pdf67)). It is used after `^Kname ... E`.
- `^PAx`: 1-30000, auto print after recall (m.p27 (pdf15)). `^PI`: print "until the "Cancel" key is pressed or the printer is turned off" (m.p28 (pdf16)).
- For bitmaps: `^P` and `^C` give the same output (no serial numbers). Use `^P` with `^C1`, as the repo does.

### 2g. Buffer and size limits

- Image buffer: "Image buffer size:1500 KB" on the RT730i self-test (UM pdf39). The EZPL appendix example shows "Image buffer size : 1475K" for a generic model (m.p161 (pdf149)).
- Memory: "8 MB Flash (4 MB für Anwendung)", "SDRAM 16 MB" (UM pdf65, DS). The self-test shows "4073 KB FREE MEMORY" (UM pdf39).
- Print length: "Max. 762 mm (30”)" at 300 dpi (UM pdf65). The datasheet says 1727 mm for the BP730i, but that is the 203 dpi figure (DS; repo doc 5.2).
- Stored graphics: "maximum 512K byte" for `~E` and `~I` (m.p71, m.p73 (pdf59, pdf61)).
- Receive (input) buffer: no size is documented anywhere. No flow-control rule for USB or TCP is documented.
- Multi-page jobs: no limit is documented. `~S,STATUS` counts up to 99999 labels waiting (m.p84 (pdf72)). `~S,BUFCLR` "will stop printing immediately and clean printer buffer" (m.p84 (pdf72)).
- Arithmetic (inferred): a full 100 x 150 mm label is 148 bytes x 1772 rows = 262,256 bytes (256 KiB). A full-head-width label at the maximum length is 156 bytes (1248 dots = 105.7 mm) x 9000 rows (762 mm) = 1,404,000 bytes = 1371 KiB. That is just below 1500 KB. So the image buffer looks sized for one maximum-length label at full width. A 150 mm label uses about 18 % of it.
- Inferred for multi-page jobs: the documents imply that the printer renders one `^L ... E` format at a time into the image buffer and prints it. Later pages wait as raw bytes in the receive path. The documents say nothing about how many raw pages can queue. A slow host-side write or TCP back-pressure is the expected behaviour, not an error. This needs a hardware test (for example 20 pages over TCP while polling `~S,STATUS`).
- `~G` graphic mode sends data "directly from host to the printing buffer" (m.p72 (pdf60)). It is not a way around the image buffer.

### 2h. Head protection, darkness scale, speed per model

- Darkness: `^Hx`, "x = 00 ~ 19". Out-of-range values clamp. Guidance: "H5 ~ H10 general DT media", "H10 ~ H15 special DT media ( Tag , or low sensitive DT media )" (m.p24 (pdf12)). The UM menu is "Schwärzung 0-19" (UM pdf36). The BP730i default is `^H8` (UM pdf39).
- H16-H19: `^XSET,HEATUP,1` enables them. "At a printing speed of 2 inches per second (IPS), the command has no effect. However, for printing speeds of 3 IPS and above, the H16 to H19 settings become ineffective. By default, the command is set to 0." (m.p44 (pdf32)). The sentence is garbled. Inferred: H16-H19 work at 2 ips only and are capped at higher speeds. Avoid them for shipping labels.
- `^XSET,HEATOFFSET,n`: n = -5..5, "increase (or decrease) 10% ~ 50% from the original heating heat, but the maximum will not exceed H19" (m.p44 (pdf32)).
- Speed: "x = 1 to 10 inch/sec (Varies with the initial setting value of each model)". Out-of-range values clamp. "S2 = 50.8 mm/s ... S5 = 127.0 mm/s" (m.p30 (pdf18)). The RT730i (300 dpi) does "127 mm/s (bis zu 5 IPS)" (UM pdf65). The menu shows "Geschwindigkeit 2-5 bzw. 7" (7 is for the 203 dpi RT700i) (UM pdf36). The default is `^S4` (UM pdf39). `^XSET,SPEEDDOWN,n` (0-90) reduces the speed overall (m.p60 (pdf48)).
- Head protection: no "head protect" setting is documented. Overheat: "Hohe Druckkopftemperatur", no beep, "Sobald der Druckkopf abgekühlt ist, wechselt der Drucker automatisch wieder in den Modus Standby" (UM pdf41). Status code 62 "TPH Over Heat" (m.p80 (pdf68)). Head open gives 2x4 beeps (UM pdf41).
- Ribbon in DT mode: "In DT mode, if a ribbon is not installed, detection will not occur." (m.p19 (pdf7)). So `^AD` is required on DT-only media, or the printer reports a ribbon error.

## 3. Summary of value per group

| Group | Value for PDF-rendered bitmaps |
|---|---|
| Media and label setup | High. Required for every job. |
| Inline image (`Q`, `QA`, `~G`) | High for `Q`; `QA` worth one hardware test; `~G` no. |
| Stored graphics, forms, fonts | Low. Adds state; 512 KB cap. |
| Native text | None. Duplicates the PDF. |
| Native barcodes | None for carrier PDFs. Possible only for self-designed product labels. |
| Lines and boxes | None. |
| Counters, variables, database | None. |
| RTC | None. |
| Status and queries | High (`~S,STATUS`, `~V`); medium (`^XGET,CONFIG`, `~B`). |
| `^XSET` behaviour settings | Low, except `ERRORPRINT`, `STANDBY` (keep 0), `LABELMODE`. |
| Cutter and peeler | None (no hardware); send `^D0 ^O0` only to reset. |
| Network | Low; `^NTCPCONNECTMODE` and `NETSOCKETIDLETIME` for TCP debugging. |
| RFID | None; not in the manual. |
| Language switching | High; the only documented recovery is a reboot. |
| Misc (keys, reset) | Medium; `~S,CANCEL`, `~S,BUFCLR`, `~Z`. |
