# BP730i: GoLabel commands and vendor documents

Scope: commands that GoLabel II sends to a Labelident BP730i (Godex RT730i, 300 dpi, EZPL), plus facts from the Labelident support PDF, the datasheets, the RT730i user manual, and the public Godex EZPL Programmer's Manual. All downloads were anonymous. No downloaded file was executed.

## 1. Sources

| Artifact | Origin | SHA-256 | Notes |
|---|---|---|---|
| GoLabel zip (Labelident copy) | `https://cdn.labelident.com/downloads/b20a4ffa-22ce-4cba-85d8-4b36048b52b0.zip`, linked as "Etikettensoftware GoLabel" on `https://www.labelident.com/bp730.html` | `a08d5b3920fea0640ef885ef2511297dfd0364987beae8aa2ecbf56e780c4067` | 221349622 bytes, HTTP Last-Modified 2026-08-28. Contains `setup.exe`, `Setup.msi`, .NET 4.8 and VC++ redistributables. |
| `Setup.msi` (from the zip) | as above | `f30918a7eb254c5b18f722fe0b68c2f1245029133ec552e76f3f7c43f2838240` | MSI ProductName "GoLabel II", ProductVersion 1.4.0001, Manufacturer "BP" (Labelident build). |
| `GoLabel.exe` | inside `Setup.msi` | `46451654d5f8ec02380cedc474c58a651d354fa527e4446ef5a96f5bdc6fa9b7` | FileVersion and ProductVersion 2.1.9558.30493. |
| Support PDF | `~/re-bp730i/dl/51fc1237-b213-4040-84df-1a2f28b02fb2.pdf` (given) | `9008243491091d1679d2aa6c312ced01e4731f9fafd2a6ffe8907c493ea22522` | "Support & Downloads BP730 / BP730i", 6 pages, ModDate 2024-09-11. |
| Datasheet (EN) | `~/re-bp730i/dl/labelident_bp730_bp730i_datasheet_en.pdf` (given) | `fe5f181da958c62e6ff548a9a46f48f82b7146a80ba0d7e05f1000ae28dc7602` | 1 page. |
| RT730i user manual (German, "RT700i_UM_Final_1707") | `https://godex.s3-accelerate.amazonaws.com/NeNyR89wscbEmWS0s6VG1g.preview?v01` (link printed in the support PDF, page 1) | `f9dcfaa4f076431e238096c9d6e6a0ce80cd276060b3b29ca5a06daead2d071d` | 75 pages. This is the BP730i manual according to the support PDF. |
| RT730 user manual (non-i) | `https://godex.s3-accelerate.amazonaws.com/Sh6sSB6saUgzYmfj8UcFvw.preview?v01`; identical to Labelident "Handbuch" `630e29bb-...pdf` | `d9a45a7a979340fbe3b2547bf694186dd9ec6df6bcc6cc5399d615f195a445e5` | 53 pages. Not read in depth (no display model). |
| Labelident "Konfigurationsanleitung" | `https://cdn.labelident.com/downloads/d9585601-c566-4c87-8e55-7e80dba95a21.pdf` | `3ee4ac91923a22b6b4ee3ba6fa5b50e416addfb0bc30849a49a30e549b5a5bcb` | Newer copy of the support PDF (same content). |
| Labelident "Kurzanleitung" | `https://cdn.labelident.com/downloads/042c1426-93aa-4edd-b4a1-d41050b9c88a.pdf` | `4bf56531a40ab3172d8be1e9c95220570247addd160056f0e8135f4a4e07455d` | Godex RT700/RT700i/RT700x Quick Guide 317-025600-403 (pictures only). |
| Labelident "Druckerdatenblatt" | `https://cdn.labelident.com/downloads/8fedcd87-733e-47f8-84a1-7ced78a940fe.pdf` | `2f127be47676b50605699578fc847913fdfc08cedcaff893992f5ea364c19b9c` | Godex RT700/RT730 datasheet (German). |
| GoLabel handbook (DE) | `https://download.labelident.com/handbuch/GoLabel_Handbuch_Online_Help.pdf` | `e576f6a499c84066ddf597763a307f56450cd2dd8a6e2f38f3930a2a2d437207` | 78 pages. Not mined; `GoLabel_II_UM.pdf` from the MSI was grepped instead. |
| EZPL Programmer's Manual Rev. O.4 (2025-06-19, P/N 920-013412-01) | third-party mirror `https://godex.com.ua/components/com_jshopping/files/demo_products/EZPL_O.4_EN.pdf` | `31d243c21311f98b30efa6b035903f282f0db68680df5e288dc2971a236ec90c` | 156 PDF pages. Printed page = PDF page + 12. Page refs below use the printed number ("m.p") and the PDF page ("pdf"). |
| EZPL Programmer's Manual Ed. E 06.2009 | third-party mirror `https://www.ultrafactor.ro/coduri%20bare/coduri%20de%20bare/EZPL_en.pdf` | `82133edb31944bc68a94e1dc353c61ab30b39e00847d9e1f7be5d96ed3e4a06d` | 50 pages. Backup only; not cited. |

The old URL `https://download.labelident.com/treiber/labelident/GoLabel_II_V2.1.2_BP.zip` still returns S3 AccessDenied. The Labelident CDN copy above is the current link on the BP730 product page (the BP730i has no separate page; `bp730i.html` is 404, and `bp730.html` covers BP730/BP730i).

## 2. Layout on disk

- `~/re-bp730i/dl-*/`: one directory per download.
- `~/re-bp730i/golabel/zip/Setup.msi`: MSI from the zip.
- `~/re-bp730i/golabel/msi/`: MSI extracted with `msiextract` (GoLabel.exe, QLabelSDK.dll, QlabelDlg.dll, GlobalInfo.dll, WiFiTool.exe, LibBLE.dll, native EZio32.dll, PrinterModel.xml, CmdlineHelp.txt, GoLabel_II_UM.pdf).
- `~/re-bp730i/golabel/decomp/<Assembly>/`: C# from ilspycmd 8.2.0.7535 (run on .NET 8 with `DOTNET_ROLL_FORWARD=Major`; SDK in `~/re-bp730i/tools/dotnet`, tool in `~/re-bp730i/tools/ilspy`).
- `~/re-bp730i/golabel/strings/`: `strings -td` (ASCII) and `strings -el -td` (UTF-16LE) per binary, with decimal file offsets.
- `~/re-bp730i/golabel/cmd_literals.tsv`: every `^`/`~` string literal in the decompiled C#, with `file:line` and `Class.Method`. Regenerate with `python3 -I ~/re-bp730i/scripts/cmd_literals.py ~/re-bp730i/golabel/decomp`.
- `~/re-bp730i/docs-txt/`: pdftotext output. `docs-txt/ezpl/pNNN.txt` is the EZPL manual, one file per PDF page.
- `~/re-bp730i/scripts/pdfgrep.sh <pdf> <regex>`: grep with PDF page numbers.

Paths in "Source" columns use these abbreviations: `SDK` = `golabel/decomp/QLabelSDK/QLabelSDK/`, `DLG` = `golabel/decomp/QlabelDlg/`, `GI` = `golabel/decomp/GlobalInfo/GlobalInfo/`, `GL` = `golabel/decomp/GoLabel/QLabelNet/`, `WIFI` = `golabel/decomp/WiFiTool/`. A binary offset `X.dll@0x...` is the file offset of the UTF-16 literal in the `#US` heap.

## 3. How GoLabel builds an EZPL print job

Source: `SDK/PrintJob.cs` `PrintJob.Print` (lines 420-470) and `PrintJob.GetCommand` (1464-1490), `SDK/Setup.cs` `Setup.GetCommandEZPL` (324-430), `SDK/QLabel.cs` `GetBeginPage_Normal`/`GetEndPage` (4387-4410). Every command is sent as UTF-8 and ends with `\r\n`.

1. Optional, only when "check reply" is on and the port can read back: `^XSET,ACTIVERESPONSE,1\r\n~K1\r\n` (`PrintJob.CheckReply_FW_Enable`, `SDK/PrintJob.cs:2565`). After the job it sends the same with `0`.
2. Optional, partial cut enabled: `^XSETCUT,MODE,1` (`Set_Partial_Cut`, `SDK/PrintJob.cs:2095`); a later `^XSETCUT,MODE,0` switches back to full cut (`Set_Full_Cut`, 2077).
3. Begin-job commands. GoLabel always adds `^XSETCUT,DOUBLECUT,0`, or `^XSETCUT,DOUBLECUT,<offset>,<firstCutMode>` when double cut is on (`BeforePrintSetup`, `SDK/PrintJob.cs:336-354`).
4. Setup block from `Setup.GetCommandEZPL`, in this order:
   - `^Q<len>,<gap>` (gap media, LabelType 0), `^Q<len>,0,<feed>` (continuous, LabelType 1), or `^Q<len>,<bmWidth>,<pos>+|-` (black mark, LabelType 2). `^QD...` is the same in dots when the unit is "dot". Values are mm with `.` as the decimal separator (culture separator is replaced).
   - `^W<width mm>`
   - `^H<darkness>`
   - `^P<n>` or `^PI` (infinite print)
   - `^S<speed>`
   - `^AT` (PrintMode 0, thermal transfer) or `^AD` (direct thermal)
   - `^C<copies>`
   - `^R<left margin, dots>`
   - `~Q+<top>` or `~Q-<top>` (top offset, dots)
   - `^O<stripper>` (0 off, 1 peel)
   - `^D<labels per cut>` or `^Db` (batch cut: cut once at end of job)
   - `^E<stop position mm>`, rounded to 0.1 mm away from zero
   - `~R<n>`: GoLabel sends `~R255` normally and `~R0` when "rotate 180" is checked (`DLG/QlabelDlg/PrinterSetup.cs:1416`, `GL/../DrawTools/DrawArea.cs:731`). The default field value 300 is replaced before printing.
   - `^RW`/`^RS` only when an RFID object exists.
5. Optional `^XSET,DRAWMODE,<n>` (n = 1 or 2) before `^L`.
6. `^L`, with `I` (inverse) and/or `M` (mirror) appended (`QLabel.GetBeginPage`, `SDK/QLabel.cs:4375-4395`).
7. Objects. A rendered bitmap object is sent by `SendBitmapToPrinterEZPL` (`SDK/PrintJob.cs:2169-2275`):
   - Header `Q<x>,<y>,<widthBytes>,<heightDots>\n` (note: LF only), then `widthBytes*height` raw bytes, then `\r\n`.
   - `widthBytes = (widthPx + 7) / 8`. Rows top to bottom, MSB = leftmost pixel. Bit 1 = black dot (dark pixels become 0 in `ImageAccess.AnyBitmapTo1Bits`, then GoLabel XORs with 0xFF because it passes `Invese = 1`). Pad bits at the row end are 0 (no dot).
   - Negative x/y are cropped to 0 before sending.
   - When the setting `ImageCompress` is true, the header is `QA<x>,<y>,<widthBytes>,<height>\n` and the payload is a zlib stream (`78 9C` + deflate + Adler-32). The shipped default is `ImageCompress=False` (`golabel/msi/GoLabel.exe.config:453`).
   - A stored graphic is printed with `Y<x>,<y>,<name>` (`SDK/Image.cs:708-823`).
8. `E` (plus `^XSET,DRAWMODE,0` before it when draw mode was set).
9. End-job commands, for example `^XSETCUT,DOUBLECUT,0` when double cut was on.
10. When the text needs UTF-8, the whole job is wrapped in `^XSET,UNICODE,2` ... `^XSET,UNICODE,0` (`GI/GlobalPrint.cs:331-338`).

Cutter loops in `PrintJob.Print` (`SDK/PrintJob.cs:690-830`): with "full cut after last label" GoLabel sends `^C1` once and then per label `^D0` or `^D1`, the label, or `~P1` to repeat the last label. With partial cut and copies it sends `^C<n-1>` before the last label.

Example job that GoLabel would emit for a 100 x 50 mm gap label on BP730i defaults (inferred from the code above; not captured on the wire):

```
^XSETCUT,DOUBLECUT,0
^Q50,3
^W100
^H8
^P1
^S4
^AT
^C1
^R0
~Q+0
^O0
^D0
^E16
~R255
^L
Q<x>,<y>,<wb>,<h>
<raw bitmap bytes>
E
```

BP730i model defaults from `golabel/msi/PrinterModel.xml` (`<PrinterModel ID="BP730i">`, line 1644): Resolution 300, Darkness 0-19 (default 8), Speed 2,3,4,5 (default 4), StopPosition 16, LCD 1, Cutter 1, UseDispenser 1, UseApplicator 0, Label width 4-106 mm, label height 3-762 mm. BP730 (no display): speed 2-4, default 3. GoLabel UI clamps stop position to 0-60 mm for EZPL (10 mm for MX), with designer max 40 and one decimal (`DLG/QlabelDlg/PrinterSetup.cs:1869-1877, 8257-8260`).

GoLabel command line (`golabel/msi/CmdlineHelp.txt`): `-dark 0~19`, `-speed <ips>`, `-cut <labels per cut>`, `-stop <tear-off mm>`, `-pmode 0|1` (0 = thermal transfer, 1 = direct thermal), `-option N|S|A` (none, stripper, applicator), `-i USB|COMx|LPTx|<driver name>|<ip>[:9100]`.

## 4. Command table

Kind values: "GoLabel binary" = string literal found in the GoLabel assemblies (with the method that sends it); "support PDF", "datasheet", "manual only" = only documented. Rows marked GoLabel binary also carry the EZPL manual page for cross-check. "RT730i UM" = RT730i user manual (German), PDF page.

### 4.1 Label setup (sent with every job)

| Command | Syntax | Meaning | Source | Kind |
|---|---|---|---|---|
| `^Q` | `^Qx,y[,z]` (mm, decimals allowed) | Gap: `^Q<len>,<gap>`. Continuous: `^Q<len>,0,<feed>`. Black mark: `^Q<len>,<markWidth>,<pos>+` (pos outside mark) or `-` (inside mark). Permanent; default `^Q100,3`. | `SDK/Setup.cs:370-376` `Setup.GetCommandEZPL`; QLabelSDK.dll@0xd53e0. EZPL m.p28 (pdf16). | GoLabel binary |
| `^QD` | `^QDx,y[,z]` (dots) | Same as `^Q` in dots. Default `^QD800,24`. | `SDK/Setup.cs:351-357`; QLabelSDK.dll@0xd53d8. EZPL m.p29 (pdf17). | GoLabel binary |
| `^W` | `^Wx` (mm) | Label width. Default 102 on 4-inch models. | `SDK/Setup.cs:383`; QLabelSDK.dll@0xd53e6. EZPL m.p31 (pdf19). | GoLabel binary |
| `^H` | `^Hx`, x = 0-19 | Darkness. Out-of-range values clamp. Guidance: H2-H5 wax ribbon, H5-H10 DT, H10-H15 resin. | `SDK/Setup.cs:384`; QLabelSDK.dll@0xd53ec. EZPL m.p24 (pdf12). | GoLabel binary |
| `^P` | `^Px`, x = 1-32767 (0 means 1) | Number of labels (pages); resets serial numbers. | `SDK/Setup.cs:391`. EZPL m.p27 (pdf15). | GoLabel binary |
| `^PI` | `^PI` | Print continuously until Cancel or power off. | `SDK/Setup.cs:387`; QLabelSDK.dll@0xd53f2. EZPL m.p28 (pdf16). | GoLabel binary |
| `^PA` | `^PAx`, x = 1-30000 | Auto print x copies after `^K` recall. | `DLG/LibView/FrmObjectDownload.cs:3182-3194` `ReplacePACommand`. EZPL m.p27 (pdf15). | GoLabel binary |
| `^S` | `^Sx`, x = 1-10 ips (model limits); also `^SF`, `^SB`, `^SJ`, `^ST` | Print speed. S2 = 50.8, S3 = 76.2, S4 = 101.6, S5 = 127 mm/s. BP730i allows 2-5. | `SDK/Setup.cs:393`. EZPL m.p30 (pdf18). | GoLabel binary |
| `^AT` / `^AD` | `^An`, n = T or D | Thermal transfer (ribbon sensor on) or direct thermal (ribbon sensor off). Permanent. | `SDK/Setup.cs:396-400`; QLabelSDK.dll@0xd53fa / 0xd5402. EZPL m.p19 (pdf7). | GoLabel binary |
| `^C` | `^Cx`, x = 1-32767 or `^Vnn` | Copies per label; total = `^C` x `^P`. Permanent, default 1. | `SDK/Setup.cs:402`; `SDK/QLabel.cs:4427,4444`; `SDK/PrintJob.cs:705,774`. EZPL m.p20 (pdf8). | GoLabel binary |
| `^R` | `^Rx`, x = 0-399 dots, must fit in `^W` | Left margin. Permanent, default 0. | `SDK/Setup.cs:403`; QLabelSDK.dll@0xd540a. EZPL m.p30 (pdf18). | GoLabel binary |
| `~Q` | `~Q+x` / `~Q-x`, x = 0-100 dots | Vertical start offset. Permanent, default 0. | `SDK/Setup.cs:406-410`; QLabelSDK.dll@0xd5410 / 0xd5418. EZPL m.p79 (pdf67). | GoLabel binary |
| `^O` | `^On`, n = 0, 1, 2 | 0 = no dispenser, 1 = label dispenser (peel), 2 = applicator. Use with `^E` (7-8 mm recommended in manual). | `SDK/Setup.cs:412`; QLabelSDK.dll@0xd541e. EZPL m.p26 (pdf14). | GoLabel binary |
| `^D` | `^Dx[,delay][,backDelay]`, x = 0-32767 | Labels per cut; 0 = cutter off. Last label is always cut. Delay: guillotine 5-20, rotary 4" 230. | `SDK/Setup.cs:419`; `SDK/PrintJob.cs:793-810` (`^D0`/`^D1` per label). EZPL m.p22 (pdf10). | GoLabel binary |
| `^Db` | `^Db` | Batch cut: one cut at the end of the job. GoLabel extension, not in the EZPL manual. | `SDK/Setup.cs:415`; QLabelSDK.dll@0xd5424. Support PDF p5 ("Batch Cut"). | GoLabel binary |
| `^E` | `^Ex`, x = 0-40 mm, decimals since 2016 | Stop (tear/cut/peel) position. Permanent, default 0 in manual; self-test shows `^E18`. | `SDK/Setup.cs:422`; QLabelSDK.dll@0xd542c. EZPL m.p23 (pdf11). Support PDF p4 (tear 12-16 mm), p6 (cutter 28-30 mm). | GoLabel binary |
| `~R` | `~Rx` (mm) | Rotate 180 when x < `^W`. GoLabel: `~R255` = normal, `~R0` = rotated. | `SDK/Setup.cs:423`; QLabelSDK.dll@0xd5432. EZPL m.p79 (pdf67). | GoLabel binary |
| `^L` | `^L[I][M][Rn]` | Start of label format. I = inverse, M = mirror, Rn = whole-label rotation 0-3. | `SDK/QLabel.cs:4394`; QLabelSDK.dll@0xd493c. EZPL m.p25 (pdf13). | GoLabel binary |
| `E` | `E` | End of format; print the label. | `SDK/QLabel.cs:4409` `GetEndPage`. EZPL m.p104 (pdf92). | GoLabel binary |
| `^XSET,DRAWMODE` | `^XSET,DRAWMODE,n`, n = 0 OR, 1 XOR, 2 overwrite | Overlap mode for graphics. Until power off. | `SDK/QLabel.cs:4392,4407`; `SDK/PrintJob.cs:311`. EZPL m.p42 (pdf30). | GoLabel binary |
| `^XSET,UNICODE` | `^XSET,UNICODE,n`, n = 0 default, 2 UTF-8 | Text encoding. | `GI/GlobalPrint.cs:336,386`; GlobalInfo.dll@0x2d9d8. EZPL m.p63 (pdf51). | GoLabel binary |
| `^XSET,ROTATION` | `^XSET,ROTATION,n`, n = 0-3 | Rotate whole label (swaps length and width). | `GL/SvgArtiste.cs:14125-14140`. EZPL m.p57 (pdf45). | GoLabel binary |

### 4.2 Cutter, peel, tear

| Command | Syntax | Meaning | Source | Kind |
|---|---|---|---|---|
| `^XSETCUT,MODE` | `^XSETCUT,MODE,n[,m][,p]` | n = 0 full cut (default), 1 partial cut. m = cutter type. p = cut leading edge after continuous-paper error. | `SDK/PrintJob.cs:2077,2095` (`Set_Full_Cut`, `Set_Partial_Cut`); QLabelSDK.dll@0xd46de / 0xd4702. EZPL m.p65 (pdf53). | GoLabel binary |
| `^XSETCUT,DOUBLECUT` | `^XSETCUT,DOUBLECUT,x[,y]` | x = 0 off, else offset in mm (< label length). Temporary. | `SDK/PrintJob.cs:336-359`; `GL/SvgArtiste.cs:12041`. EZPL m.p65 (pdf53). | GoLabel binary |
| `^XSETCUT,DOCUTTING,1` | as shown | Cut once now. | EZPL m.p64 (pdf52). | manual only |
| `^XSET,BACKFEED` | `^XSET,BACKFEED,n`, n = 0/1 | Smart backfeed ("pre-print"): print part of next label while the previous waits for cut/peel. GoLabel UI item 0 "on" sends 1. | `DLG/QlabelDlg/PrinterSetup.cs:6125` `SetMiscellaneous`. EZPL m.p39 (pdf27), same as `SMARTBACK` m.p60 (pdf48). | GoLabel binary |
| `^XSET,BACKFEEDAFTERCUTTING` | `^XSET,BACKFEEDAFTERCUTTING,n`, n = 0-100 % | Pull-back ratio after cut. | EZPL m.p39 (pdf27). | manual only |
| `^XSET,TEARPAPERTIME` | `^XSET,TEARPAPERTIME,n`, ms, default 300 | Wait time for label removal. | EZPL m.p61 (pdf49). | manual only |
| `^XSET,TOPOFFORM` | `^XSET,TOPOFFORM,n`, n = 0-3 | Top-of-form behavior at power on / after error. | `DLG/QlabelDlg/PrinterSetup.cs:6126`. EZPL m.p61 (pdf49). | GoLabel binary |
| `^XSET,REWINDER` | `^XSET,REWINDER,0/1` | Rewinder off/on. | `GL/SvgArtiste.cs:10721-10726`; `DLG/QlabelDlg/PrinterSetup.cs:7111-7116`. EZPL m.p55. | GoLabel binary |
| `^XSET,LINERLESS` | `^XSET,LINERLESS,0/1/2` | Linerless mode. | `GL/SvgArtiste.cs:10754-10764`. EZPL m.p49. | GoLabel binary |

### 4.3 Sensor and calibration

| Command | Syntax | Meaning | Source | Kind |
|---|---|---|---|---|
| `~S,SENSOR` | `~S,SENSOR[,length,gap,percent]`; `~S,SENSOR,0` | Auto sensing (media calibration). length 100-999 mm (default 250), gap 1-499 mm (default 3), percent 1-98 (default 30). `,0` restores default parameters and senses. No reply to host. LCD shows "Calibration". | GoLabel menu "Calibrate sensor"/"Auto sensing": `GL/SvgArtiste.cs:5513` `langCalibrateSensor_Click` and 15198; WiFiTool `clsPrinterCommand.AutoSensing` (`WIFI/EzioDll/clsPrinterCommand.cs:100`); GoLabel.exe@0x114a73. EZPL m.p82-83 (pdf70-71). | GoLabel binary |
| `^G` | `^Gn`, n = 0, 1, 2 | Sensor select. Manual text: 0 = reflective, 1 = see-through, 2 = auto (default). GoLabel combo items are [Reflect, Transmit, Auto] and it sends the index. Note: the `~S,SENSOR` example table in the manual (m.p82) labels `^G0` "see-through" and `^G1` "reflective", which contradicts m.p24. | `DLG/QlabelDlg/PrinterSetup.cs:6124` `SetMiscellaneous`, items at 9094. EZPL m.p24 (pdf12). | GoLabel binary |
| `^XSET,WHENTOSENSING` | `^XSET,WHENTOSENSING,n` | 0 none, 1 auto-sense at power on, 2 after cover close, 3 on cover open and close. | `GL/SvgArtiste.cs:14553-14568`; GoLabel.exe@0x116a3d. EZPL m.p64 (pdf52). | GoLabel binary |
| `^XSET,SENSING` | `^XSET,SENSING,n` | Sensor for continuous media: 0 reflective, 1 see-through, 2 none. | EZPL m.p58 (pdf46). | manual only |
| `~S,CSENSOR` | `~S,CSENSOR` | Empty calibration (factory use, some models). | EZPL m.p80 (pdf68). | manual only |
| `^XGET,SENSORSTATUS` | `^XGET,SENSORSTATUS` | Return auto-sensing values. | EZPL m.p35. | manual only |
| `~S,OFFSETX` / `~S,OFFSETY` | `~S,OFFSETa,n`, n = -100..+100; without value = query | Print position fine adjust (X/Y). | `DLG/QlabelDlg/PrinterSetup.cs:5931` (query), 6127-6128 (set). EZPL m.p81 (pdf69). | GoLabel binary |
| `^XSET,DISMOFFSET` | GoLabel sends `^XSET,DISMOFFSET,0,<mm*10>`; query without value; reply line `Unprintable: a,b,c` (tenths of mm) | Unprintable length setting (0-3 mm in GoLabel UI). Not in EZPL Rev. O.4. | `DLG/QlabelDlg/PrinterSetup.cs:5932, 6137`; parse at `GetMiscellaneous`. | GoLabel binary |

### 4.4 Status, queries, reset

| Command | Syntax | Meaning | Source | Kind |
|---|---|---|---|---|
| `~S,CHECK` | `~S,CHECK` -> `aa\r\n` | Immediate status. 00 Ready, 01 Media empty, 02 Media jam, 03 Ribbon empty, 04 Head open, 05 Rewinder full, 06 File system full, 07 Filename not found, 08 Duplicate name, 09 Syntax error, 10 Cutter jam, 11 Extended memory not found, 13 Waiting peel, 20 Pause, 21 Setting mode, 22 Keyboard mode, 50 Printing, 60 Data in process, 62 TPH overheat. Needs `^XSET,IMMEDIATE,1`. GoLabel polls it between labels in "print by label" mode and waits for "00". | `GI/GlobalPrint.cs:658`; `DLG/QlabelDlg/PrinterSetup.cs:3297`; GlobalInfo.dll@0x2dade. EZPL m.p80 (pdf68). | GoLabel binary |
| `~S,STATUS` | `~S,STATUS` -> `aa,nnnnn\r\n` | Like `~S,CHECK` plus remaining label count 00000-99999. | EZPL m.p84 (pdf72). Not in GoLabel. | manual only |
| `^XSET,IMMEDIATE` | `^XSET,IMMEDIATE,n` | Enables `~S,CHECK`/`~S,STATUS` replies. Manual says "default = 1" in one line and "n = 0 ... (default)" in the next. | EZPL m.p44 (pdf32). | manual only |
| `^XSET,ACTIVERESPONSE` | `^XSET,ACTIVERESPONSE,n`; without value = query | 1 = printer pushes `ERRORxx` (codes as `~S,CHECK` 01-11, 62) on error. | `SDK/PrintJob.cs:2565`; `SDK/SocketSDK/SocketSDK.cs:795-823`; `DLG/LibView/FrmSetIP.cs:583-626`. EZPL m.p38 (pdf26). | GoLabel binary |
| `~K` | `~Kn`, n = 0, 1, 2 | 1 = send `Y` to host after each printed label (needs ACTIVERESPONSE 1); 2 = send `X` before print. GoLabel counts `Y` bytes to track progress. | `SDK/PrintJob.cs:2565` (sent as `~K1`/`~K0`); `SDK/QLabel.cs:6440`. EZPL m.p73 (pdf61). | GoLabel binary |
| `~S,CANCEL` | `~S,CANCEL` | Same as Cancel key; clears error state. GoLabel "cancel job". | `GL/SvgArtiste.cs:10275`; `DLG/QlabelDlg/PrinterSetup.cs:5715`. EZPL m.p84 (pdf72). | GoLabel binary |
| `~S,FEED` / `~S,PAUSE` / `~S,BUFCLR` | `~S,n` | Emulate Feed / Pause key; BUFCLR stops and clears buffer. | EZPL m.p84 (pdf72). | manual only |
| `~S,BUFUSAGEWARNING` | `~S,BUFUSAGEWARNING` | Buffer usage warning query, sent over BLE only. Not in manual. | `golabel/decomp/LibBLE/LibBLE/BLECtrl.cs:293-294`; LibBLE.dll@22154 (dec). | GoLabel binary |
| `~V` | `~V` | Print self-test page. | `GL/SvgArtiste.cs:5404` `langPrinterVersionMsg_Click`; GoLabel.exe@0x11499f. EZPL m.p85 (pdf73). | GoLabel binary |
| `~B` / `~BOK` | `~B`, `~BOK` | Return firmware version (and date, model names, USB name). GoLabel uses `~B` as a handshake. | `DLG/QlabelDlg/TestInterface.cs:178-182`; `DLG/QlabelDlg/ConnectedPrinter.cs:434`. EZPL m.p70 (pdf58). | GoLabel binary |
| `^XGET,CONFIG` | `^XGET,CONFIG` | Return the self-test page text over the same port. GoLabel parses `^E`, `^H`, `^S`, `^O`, `^D`, `^A` tokens and `SERIAL PORT: <baud>,...` from it. | `GL/SvgArtiste.cs:8457` `StartScanConnectedPrinter`, parse in `SetConfigFromPrinter` (8475-8640); `DLG/QlabelDlg/PrinterSetup.cs:4671`. EZPL m.p31-33 (pdf19-21). | GoLabel binary |
| `^XSET,NETCONFIG` | query | GoLabel "Refresh" in printer setup; reply is `;`-separated `^G..`, `^Y..`, `^XSET,CODEPAGE,..`, `^XSET,BACKFEED,..`, `^XSET,TOPOFFORM,..`, `^XSET,BUZZER,..`, `Unprintable: ..`. Not in EZPL Rev. O.4. | `DLG/QlabelDlg/PrinterSetup.cs:5922-5935`, parse `GetMiscellaneous`. | GoLabel binary |
| `^XGET,LANGUAGE` / `^XGET,KEYBOARD` / `^XGET,CODEPAGE` | query | LCD language index / PS2 keyboard / code page index. | `DLG/QlabelDlg/PrinterSetup.cs:5925-5929`. EZPL m.p31-34. | GoLabel binary |
| `^XGET,APPINFO2` | query | Model/app info used in "connected printers" list. Not in manual. | `DLG/QlabelDlg/ConnectedPrinter.cs:507`. | GoLabel binary |
| `^XGET,TPHRESISTANCE` | query | Print-head dot resistance. | `DLG/QlabelDlg/TestInterface.cs:189`. EZPL m.p36. | GoLabel binary |
| `^XGET,PREVIEW,name,x,y` | query | Preview of a stored label. Not in manual. | `DLG/QlabelDlg/PrinterControl.cs:230`. | GoLabel binary |
| `~X1`..`~X6` | `~Xn` | 1 forms, 2 graphics, 3 bitmap fonts, 4 all, 5 Asian fonts (printed); 6 = odometer returned over serial (`<n> METER(S)`). | `GL/SvgArtiste.cs:5334-5380, 14210`. EZPL m.p86-87 (pdf74-75). | GoLabel binary |
| `~T` | `~T` | Print-head test pattern. | `GL/SvgArtiste.cs:5385`; GoLabel.exe@0x114981. EZPL m.p84 (pdf72). RT730i UM p64. | GoLabel binary |
| `~Z` | `~Z` | Reset printer (standby only; LED flashes once). GoLabel "reset printer" menu (EPL: `^@`). | `GL/SvgArtiste.cs:5388-5396` (`buttonItem4_Click_1`); `WIFI/WiFiTool/FrmWiFi.cs:1470,1547`; GoLabel.exe@0x11498b. EZPL m.p87 (pdf75). | GoLabel binary |
| `^Z` | `^Z` | Reset to factory defaults (same as `~~INTERNALCOMMAND+INIT`). | EZPL m.p69 (pdf57). | manual only |
| `~S,DUMP` | `~S,DUMP` | Hex dump mode; exit with FEED key or power cycle. | `WIFI/WiFiTool/FrmWiFi.cs:1456`. EZPL m.p81 (pdf69). | GoLabel binary |
| `~S,ES` | `~S,ES[p1]`, p1 = A/blank auto, G EZPL, E GEPL, Z GZPL | Change command language. Default `~S,ESA` (auto). A printer that was switched auto-detects again after reboot. | EZPL m.p84 (pdf72). Not in GoLabel. Datasheet: "EZPL, EEPL, GZPL, automatic adjustment". | manual only |
| `~D` | `~Dm,d,y,h,i,s` | Set RTC. GoLabel sends `~D` + `MM,dd,yy,HH,mm,ss` before a job when "sync date/time" is on. | `GI/GlobalPrint.cs:1174`; `DLG/QlabelDlg/PrinterSetup.cs:6224`. EZPL m.p71 (pdf59). | GoLabel binary |

### 4.5 Media movement and misc printer settings

| Command | Syntax | Meaning | Source | Kind |
|---|---|---|---|---|
| `^M` | `^Mx`, x = 1-1000 mm | Feed forward x mm. | `GL/SvgArtiste.cs:5435` `langPaperForward_Click`. EZPL m.p26 (pdf14). | GoLabel binary |
| `^B` | `^Bx`, x = 1-1000 mm | Feed backward x mm. | `GL/SvgArtiste.cs:5451` `langPaperBackward_Click`. EZPL m.p19 (pdf7). | GoLabel binary |
| `~P` | `~Px`, x = 1-32767 | Print the last/recalled format again x times. | `GL/SvgArtiste.cs:5419`; `SDK/PrintJob.cs:727,826`. EZPL m.p79 (pdf67). | GoLabel binary |
| `^XSET,BUZZER` | `^XSET,BUZZER,0/1` | Reminder beep off/on (error beeps stay). Same as `^XSET,BEEP`. | `GL/SvgArtiste.cs:5461-5466`; `DLG/QlabelDlg/PrinterSetup.cs:6122`. EZPL m.p41 (pdf29). | GoLabel binary |
| `^XSET,CODEPAGE` | `^XSET,CODEPAGE,n`, 0 = 850 ... 14 = Win1252 ... 20 = Win1257 | Code page. | `DLG/QlabelDlg/PrinterSetup.cs:6118`. EZPL m.p41 (pdf29). | GoLabel binary |
| `^XSET,LANGUAGE` | `^XSET,LANGUAGE,n` | LCD language. | `DLG/QlabelDlg/PrinterSetup.cs:6116`. EZPL m.p47. | GoLabel binary |
| `^XSET,KEYBOARD` | `^XSET,KEYBOARD,n` | PS2 keyboard layout. | `DLG/QlabelDlg/PrinterSetup.cs:6117`. EZPL m.p45. | GoLabel binary |
| `^XSET,MEMORY` / `^XSET,CF_FORMAT,1` | as shown | Select flash (0) or external memory (1); format CF. | `GL/SvgArtiste.cs:5471-5486`. Not in Rev. O.4 index. | GoLabel binary |
| `^XSET,REALLENGTHPRINT` | `0/1` | "Real length print". Not in manual. | `GL/SvgArtiste.cs:14573-14578`. | GoLabel binary |
| `^XSET,BARCODEALIGN` / `^XSET,TEXTBLOCK` | `0/1` | Variable barcode alignment / text wrap. | `GL/SvgArtiste.cs:11945-11993`. EZPL m.p39, m.p61. | GoLabel binary |
| `^Y` | `^Yb,p,d,s` (b = 48/96/19/38/57/11) | RS-232 settings, default `96,N,8,1`. | `GL/SvgArtiste.cs:8552` (parse only). EZPL m.p69 (pdf57). | GoLabel binary |
| `~~INTERNALCOMMAND...` | `~~INTERNALCOMMANDPROMPT0/1/2`, `A,HFRE`, `RFID,ENGINEER`; manual also lists `S,n`, `C`, `+INIT`, `Q` | Undocumented service commands. | `GL/SvgArtiste.cs:11897-11929`; `DLG/QlabelDlg/RFID_Setup.cs:624,1380`. EZPL m.p19 (pdf7), m.p69. | GoLabel binary |

### 4.6 Graphics, files, memory

| Command | Syntax | Meaning | Source | Kind |
|---|---|---|---|---|
| `Q` | `Qx,y,widthBytes,heightDots` + `widthBytes*height` bytes | Inline 1-bit raster. GoLabel ends the header with `\n` and the data with `\r\n`. Bit 1 = dot, MSB = left. | `SDK/PrintJob.cs:2169-2275` `SendBitmapToPrinterEZPL`; QLabelSDK.dll@0xd4772 (`Q{0},{1},{2},{3}`). EZPL m.p114 (pdf102). | GoLabel binary |
| `QA` | `QAx,y,widthBytes,height<CR>` + zlib data | Same, zlib-compressed. Used only when `ImageCompress=True` (default False). | Same method; QLabelSDK.dll@0xd474c. EZPL m.p114 (pdf102). | GoLabel binary |
| `~EB` | `~En,name,size` + file bytes; n = B BMP, P PCX, N PNG; max 512 KB | Store a monochrome image in flash. GoLabel writes `~MDELG,<name>` first, then `~EB,<name>,<size>` and the raw BMP file. | `DLG/LibView/FrmObjectDownload.cs:2890` `SaveImageDownloadFile`; `DLG/LibView/FrmObjectSync.cs:1256`; GoLabel.exe@0x122ded. EZPL m.p71 (pdf59). | GoLabel binary |
| `~I` | `~Ix,name,length` | Store image in RAM only. | EZPL m.p73 (pdf61). | manual only |
| `Y` | `Yx,y,name` | Print a stored graphic. | `SDK/Image.cs:708-823`. EZPL m.p126 (pdf114). | GoLabel binary |
| `~MDEL` family | `~MDEL`, `~MDEL*`, `~MDELn,name` (n = D,A,C,E,F,G,S,T,B; name `*` = all of type) | Format memory / delete files. | `DLG/LibView/FrmObjectMaintain.cs:432-531`; `GL/SvgArtiste.cs:7481`; `DLG/LibView/FrmObjectDownload.cs:1005,1740,2125,3165`. EZPL m.p74-75 (pdf62-63). | GoLabel binary |
| `~MDIR` | `~MDIR` | Return memory directory. | `DLG/QlabelDlg/PrinterControl.cs:156`; `DLG/LibView/FrmObjectDownload.cs:1863`. EZPL m.p75 (pdf63). | GoLabel binary |
| `~MGETF` | `~MGETF,name` | Return stored label format text. | `DLG/QlabelDlg/PrinterControl.cs:216`. EZPL m.p77 (pdf65). | GoLabel binary |
| `^F` / `^K` | `^Fname` ... `E`; `^Kname` | Store / recall label format. | `SDK/PrintJob.cs:1044,1073`; `DLG/LibView/FrmRecallLabelForm.cs:313`. EZPL m.p23, m.p25. | GoLabel binary |
| `~H,TTF` / `~H,TTF_TABLE` | `~H,TTF,Xname,size<CR>data` | Download TrueType font / Unicode table. | `GL/../QLabelNet.NewToolForms.Dialog/TTOTFontDialog.cs:229-233`, `FontTableDialog.cs:73`. EZPL m.p73 (pdf61). | GoLabel binary |
| `~L,DBASE` / `~L,DBASECSV` / `~L,SERIAL` | as manual | Download database / CSV / serial file. | `DLG/LibView/FrmObjectDownload.cs:1006,1084,3166`. EZPL m.p74 (pdf62). | GoLabel binary |

### 4.7 Network (Ethernet, Wi-Fi, 802.1X)

| Command | Syntax | Meaning | Source | Kind |
|---|---|---|---|---|
| `^NS` | `^NS[a,...]`; bare `^NS` = query | Set/query IP settings. | `DLG/LibView/FrmSetIP.cs:30,395`; `WIFI/WiFiTool/FrmWiFi.cs:2438,2746`. EZPL m.p129. | GoLabel binary |
| `^NT` | `^NT[,..]` | Network parameter (used with `^NS` in IP dialog). Not in Rev. O.4 index. | `DLG/LibView/FrmSetIP.cs:442,700`. | GoLabel binary |
| `^XSET,ALIAS` | `^XSET,ALIAS[,name]` (< 16 bytes) | Printer alias. | `DLG/LibView/FrmSetIP.cs:388`. EZPL m.p39 (pdf27). | GoLabel binary |
| `^XSET,NETSPEED` | query | Link speed. | `SDK/SocketSDK/SocketSDK.cs:830`. | GoLabel binary |
| `^NR`, `^NA`, `^NL` | see manual | Alert messages, SMTP, SNMP. | `DLG/LibView/FrmSetAlertMsg.cs`, `FrmSetAlertPath.cs`. EZPL m.p128-129. | GoLabel binary |
| `~L,METHOD` etc. | `~L,METHOD|TLSVERSION|INNERMETHOD|IDENTITY|USERNAME|USERPASS|PSKPASSWORD[,v]`, `~L,CAPEM|USERCERT|PSKFILE,<size>`, `~L,RESET` | 802.1X configuration. Not in Rev. O.4. | `DLG/LibView/FrmSetIP.cs:1033-1356`. | GoLabel binary |
| `^NW,...` | `^NW,WGET*/WSET*` | Wi-Fi module settings (WiFiTool). BP730i has no Wi-Fi in `PrinterModel.xml`. | `WIFI/WiFiTool/FrmWiFi.cs`. EZPL m.p137-142. | GoLabel binary |

## 5. Facts from the Labelident and Godex documents

### 5.1 Support PDF (`51fc1237-...pdf`, 6 pages, German)

- p1: links to the RT730/RT730i manuals (Godex S3), "GoLabel für BP Drucker V1.16" (dead link `GoLabel_II_V2.1.2_BP.zip`), the GoLabel handbook, and the Windows driver `Generic_BP_v2023.2.exe`. Web interface login: user `admin`, password `1111`.
- p2-p3: put the label sensor roughly in the middle under a label (video 1 at 1:42). Calibrate by pressing the button on the back for about 2 s (video 2). Error "printer beeps after job and LED is red" or LCD "Check Media" means: reload media, check sensor position, recalibrate.
- p4: label does not stop at the tear edge: set stop position to 12-16 mm (GoLabel "Druckereinstellungen > Stopp Position", or driver tab "Etikett > Positionseinstellungen").
- p5: cutter setup needs labels at least 30 mm high. GoLabel: "Schneiden nach" (cut every n labels) and "Batch Cut" (cut at end of job). Driver: "Etikett > Medienbehandlung > Nachdruckaktion".
- p6: cutter cuts at wrong place: set stop position to about 28-30 mm.

### 5.2 Datasheet (`labelident_bp730_bp730i_datasheet_en.pdf`)

- BP730i: 300 dpi, max print width 108.0 mm (BP730: 105.7 mm), print height 3-1727 mm (BP730: 4-762 mm), 127 mm/s (BP730: 102 mm/s). These BP730i width/height/speed figures differ from the Godex RT730i manual (105.7 mm, 762 mm max, 127 mm/s); the datasheet seems to mix 203 dpi RT700i figures. Treat the RT730i manual as authoritative.
- 8 MB flash (4 MB for applications), 16 MB SDRAM.
- Sensor: "adjustable and reflecting, movable media sensor" (the RT730i manual adds a center-fixed see-through sensor).
- Interfaces: RS-232 (DB-9), USB 2.0, Ethernet 10/100 print server, USB host.
- Printer languages: "EZPL, EEPL, GZPL, automatic adjustment". GoLabel supports EZPL only.
- BP730i panel: colour TFT LCD with navigation button, automatic calibration button. BP730: READY and STATUS LEDs, calibration button, FEED button.
- Media: gap ("matrix free"), black mark, marker holes, continuous; thickness 0.06-0.20 mm; liner width 25.4-118 mm; core 1" or 1.5"; outer diameter max 127 mm. Ribbon: 1" core, outside wound, 30-110 mm wide, max 300 m.
- BMP and PCX can be stored directly in the printer.

### 5.3 RT730i user manual (Godex, German, 75 pages)

- p25: power switch (hold 3 s to switch off), FEED key: feeds to the set stop position; on continuous media it feeds while held; on labels it feeds one label. If the stop is wrong, run auto calibration (chapter 3.6).
- p26: LCD shows "Bereit" (ready). Hold the menu key 3 s to open the main menu.
- p36-37 (menu tree): Printer settings: language (EN, DE, zh, FR, ES, JA, IT, RU, TR), speed 2-5, darkness 0-19, wizard (paper type gap/mark/continuous, print mode DT/TT, stop position 0-40). Label settings: auto media detection, sensor (see-through / reflective), media type (gap / mark / continuous), print mode, stop position 0-40, top-of-form, code page (437, 737, 850-869, Win 1250-1257), rotation 0/90/180/270, X and Y adjust -100..100, print-head position -100..100, open stored label. Accessories: buzzer, modules (none / cutter / dispenser / applicator), pre-print, network (port 9100, DHCP default off, gateway 192.168.000.254, example IP 192.168.102.76, mask 255.255.255.0), LCD password, COM port (4800-115200, parity, 7/8 data bits, 1/2 stop bits), clock. Analysis: auto-calibrate, self test, print-head resistance test, reset settings, delete memory (forms, graphics, bitmap fonts, TTF, Asian fonts, all).
- p39 (calibration and self test): switch off; hold FEED while switching on; release FEED when the LED flashes red. The printer measures the media, stores the label length, and prints a self-test label. Self-test content: model and version, USB S/N, `Serial port:96,N,8,1`, MAC, DHCP, IP, gateway, mask, DRAM count, `Image buffer size:1500 KB`, counts of forms/graphics/fonts/Asian fonts/databases/TTF, free memory (`4073 KB FREE MEMORY`), then the current settings as EZPL: `^S4 ^H8 ^R000 ~R200`, `^W102 ^Q100,3 ^E18`, `Option:^D0 ^O0 ^AD`, `Reflective AD:1.96 2.84 2.49[0.88_23]` (sensor setting and AD values), `Code Page:850`, `Default state=Yes`.
- p40: auto-calibration key (rear). Hold 1 s: automatic label detection. Hold 2 s: auto sensing that calibrates label and ribbon parameters.
- p41-42 (errors): head open = 2x4 beeps; head overheat = no beep, recovers when cool; ribbon empty / ribbon error ("Farbband prüfen") = 2x3 beeps; media not detected / empty / jam ("Etiketten prüfen") = 2x2 beeps; memory full; file not found ("use `~X4` to list files") and duplicate filename = 2x2 beeps.
- p43-49: NetSetting tool for Ethernet; default password 1111; "Send Command" can send printer commands over Ethernet.
- p58: dispenser has its own paper sensor; FEED dispenses one label.
- p64: troubleshooting; "check with internal command `~T`".
- p65 (specs): RT730i 300 dpi, 127 mm/s (5 ips), width 105.7 mm, length 4-762 mm, sensors adjustable reflective + center-fixed see-through, media gap/black mark/notch/continuous, 25.4-118 mm wide, 0.06-0.2 mm thick; Unicode UTF-8/UTF-16; real-time clock standard.

### 5.4 Godex RT700/RT730 datasheet (Labelident "Druckerdatenblatt", German)

- Languages: "EZPL, GEPL, GZPL, GDPL, Automatische Einstellung". GoLabel only for EZPL. Unicode UTF8, UTF16BE, UTF16LE.

### 5.5 GoLabel II user manual (`golabel/msi/GoLabel_II_UM.pdf`)

- p24-25: darkness 0-19; peeler; labels per cut; batch cut; "Tear-off / Cut" = distance from print line to tear line in mm.
- p29: sensing mode Reflective / See-through / Auto; "Pre-Printing (BACKFEED)" works with cutter or peeler.
- p30: X/Y position offset. Chapter 4.8.10 "Auto Sensing" (p136), 4.8.17 "Set up Autosensing" (p138).

## 6. Observations that matter for the driver

- GoLabel sends the full setup block (`^Q ^W ^H ^P ^S ^A ^C ^R ~Q ^O ^D ^E ~R`) with every job. All of these are "permanent" in the EZPL manual, so each job overwrites the stored printer settings.
- The image path that GoLabel uses for every non-native object is the inline `Q` raster. Header `Qx,y,wb,h` then raw bytes; 1 = black; no compression by default. This matches what a PBM-to-printer path needs.
- `~R` semantics: rotation by 180 happens when the `~R` value is smaller than `^W`. GoLabel uses 255 (never rotate) and 0 (always rotate). The factory self-test shows `~R200` with `^W102`, so default output is not rotated.
- Calibration: `~S,SENSOR` (no reply), or the rear button (1 s label detection, 2 s label + ribbon), or FEED held at power-on (calibrate + self-test print).
- Status: `~S,CHECK` gives a two-digit code. It needs `^XSET,IMMEDIATE,1` according to the manual; GoLabel does not send `^XSET,IMMEDIATE`, which suggests that it is on by default on current firmware (inference, not verified on hardware).
- Language: the printer auto-detects EZPL/GEPL/GZPL by default (`~S,ESA`). `~S,ESG` forces EZPL, `~S,ESZ` forces GZPL. GoLabel never sends these.

## 7. Not obtained

- No GZPL or GEPL programming manual or Godex GZPL emulation notes. Searches found only Seagull driver pages. The EZPL manual only documents `~S,ES[p1]` for switching.
- No `~S,STATUS`, `^XSET,IMMEDIATE`, `~S,ES`, or `^Z` usage in GoLabel; these are manual-only.
- The native `EZio32.dll` (Godex SDK used by WiFiTool and the EZio API) did not yield readable command format strings with `strings`. Its `setup()`/`intloadimage()` byte formats are not extracted. GoLabel's own print path does not use it.
- `Trace.dll` and `FontFile.dll` (native) were not analyzed.
- Godex official EZPL download on godexintl.com was not used (task asked for third-party mirrors). Revision O.4 from godex.com.ua (a Godex distributor site) was used.
- The German GoLabel handbook (`GoLabel_Handbuch_Online_Help.pdf`) was downloaded but not mined.
- The responses of `^XGET,CONFIG`, `^XSET,NETCONFIG`, `^XGET,APPINFO2` were inferred from GoLabel parsers and the self-test example; no wire capture exists.
