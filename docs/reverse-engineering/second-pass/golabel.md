# GoLabel II: second pass for the BP730i

This is the second, deeper pass over GoLabel II. The first pass is `docs/reverse-engineering/golabel-and-docs.md` in the bp730i repository. This file adds to that pass and corrects it. Where the two disagree, this file states the evidence.

## 0. Sources and conventions

- Build: Labelident GoLabel II. `GoLabel.exe` SHA-256 `46451654d5f8ec02380cedc474c58a651d354fa527e4446ef5a96f5bdc6fa9b7` (the same file as in the first pass). `QLabelSDK.dll` `3138210513f2aafe6562bfffb4b3d45085992b7ed6e63e203dcaca302aa9f83f`. `PrinterModel.xml` `cc298bfa0ba7591b2e68d17d5f886a32b6e7269a5b48ce28db322bb322cd97e8`. `Trace.dll` `6741f261a0bd0b369aa40d6c600012f981ff0cae6a006fabf09009751c241e52` (internal string "Ver1.0.0.24 2025_12_10").
- C# from ILSpy, under `/home/agent/re-bp730i-deep/golabel/decomp/`. Path abbreviations:
  - `SDK` = `QLabelSDK/QLabelSDK/`
  - `PC` = `QLabelSDK/QLabelSDK.PrinterControl/`
  - `SOCK` = `QLabelSDK/SocketSDK/SocketSDK.cs`
  - `DLG` = `QlabelDlg/QlabelDlg/`
  - `VIEW` = `QlabelDlg/LibView/`
  - `GI` = `GlobalInfo/GlobalInfo/`
  - `GL` = `GoLabel/QLabelNet/`
  - `DRAW` = `GoLabel/DrawTools/`
  - `WIFI` = `WiFiTool/WiFiTool/`
  - `MSI` = `/home/agent/re-bp730i-deep/golabel/msi/`
- Every `file:line` below was read in this pass. "Inference" marks a conclusion that the code does not state directly.
- Helper table: `/home/agent/re-bp730i-deep/work/cmd_literals.tsv` lists every `^`/`~` string literal with `file:line` and `Class.Method`. To regenerate it, run `python3 -I /home/agent/re-bp730i-deep/work/scripts/cmd_literals.py /home/agent/re-bp730i-deep/golabel/decomp`.
- "BP730i-relevant" means that GoLabel can send the command when the selected model is `BP730i`. The gating comes from the `MSI/PrinterModel.xml` entry and the defaults in `GI/clsPrintModelData.cs:74-111` (section 2e).

## 1. Corrections to the first pass

1. **`~S,CHECK` is not polled in normal printing.** GoLabel sends it only in the RFID print loop. That loop runs when `GlobalInfo.DefaultRFID.Enable` is true (`GI/GlobalPrint.cs:612-660`, `DLG/PrinterSetup.cs:3297`). The first pass said "print by label" mode.
2. **`^XSET,UNICODE,2 ... ,0` is never sent for a BP730i.** `bNeedSendUtf8Cmd` returns false unless the model name starts with `EZ`. It also returns false when the model name contains 2050 or 2250, and when no line starts with `AT,` or `ATx,` (`GI/GlobalPrint.cs:341-372`).
3. **The default print method is direct thermal (`^AD`), not `^AT`.** `GoLabel.exe.config` sets `PrintMode=1` (`MSI/GoLabel.exe.config:48`), and `DRAW/DrawArea.cs:722` copies it into the job. `Setup.GetCommandEZPL` sends `^AT` only when `PrintMode==0` (`SDK/Setup.cs:396-403`).
4. **`^E` is written with the Windows culture decimal separator.** `Setup.GetCommandEZPL` replaces the culture separator with `.` for `^Q` and `^W` only (`SDK/Setup.cs:335-343`). For `^E` it uses `Math.Round(Stop,1,AwayFromZero).ToString()` (`SDK/Setup.cs:421-422`). On a German Windows, a stop of 12.5 mm therefore becomes `^E12,5`. How the firmware reads that is an inference: probably as `^E12` with an extra parameter.
5. **QA compression is not model-gated.** It is one global checkbox (section 2a).
6. **USB I/O goes through native `Trace.dll`, not `EZio32.dll`.** `API_EZio`/`API_EZio_64` import `Trace.dll`/`Trace64.dll` (`PC/API_EZio.cs:7-38`). `EZio32.dll` is used only by WiFiTool (`WIFI/../EzioDll/EZioApi.cs`, 59 `DllImport("Ezio32.dll")`).

## 2. Answers to the specific questions

### 2a. QA compression

- **Header.** `QA<x>,<y>,<widthBytes>,<heightDots>` followed by LF (0x0A) only (`SDK/PrintJob.cs:2219`). This is the same as `Q`, with `QA` in place of `Q`. `widthBytes = (widthPx+7)/8` (`SDK/PrintJob.cs:2218`). The header contains no byte count for the compressed payload.
- **Payload.** `Zlib_Compress` (`SDK/PrintJob.cs:2288-2309`) builds an RFC 1950 zlib stream by hand:
  - byte `0x78`, then `0x9C` (the level byte for `CompressionLevel.Optimal`; `Zlib_GetCompressionHeader`, `SDK/PrintJob.cs:2277-2286`)
  - raw deflate from .NET `DeflateStream(Optimal)`
  - Adler-32 of the uncompressed data, big-endian (s2 high byte, s2 low byte, s1 high byte, s1 low byte)
- **Input to zlib.** The uncompressed data is exactly `widthBytes*height` bytes: rows top to bottom, MSB = leftmost pixel, 1 = dot. Pad bits at the row end are forced to 0, which means no dot (`SDK/PrintJob.cs:2224-2251`).
- **Terminator.** `\r\n` (0x0D 0x0A) after the payload, for both `Q` and `QA` (`SDK/PrintJob.cs:2263-2266`). Inference: the printer must find the end of the payload from the zlib stream itself, because the header gives only the uncompressed size.
- **Gating.** No model or firmware check exists.
  - `QLabel.bCompress` is the only switch. Its static default is `true` (`SDK/QLabel.cs:151`), but GoLabel overwrites it at startup from the user setting `ImageCompress` (`GL/Program.cs:848`, `GL/SvgArtiste.cs:1819`).
  - The setting default is `False` (`GL/../QLabelNet.Properties/Settings.cs:2210-2223` `[DefaultSettingValue("False")]`; `MSI/GoLabel.exe.config:453-455`).
  - The UI checkbox is `Chk_QA` in Global Setup. Its text is "When printing images, use the compression format command (QA)" (`QlabelDlg/LibView.FrmGlobalSetup.resx:131`). It is wired at `GL/SvgArtiste.cs:11067, 11201-11202`.
- **Scope.** All bitmap paths go through `SendBitmapToPrinterEZPL`, so QA applies to every host-rendered object: images, Windows text, shapes, and bitmap barcodes (30 call sites; see section 3.5).

### 2b. Command language handling

- **GoLabel sends no language-switch command in EZPL mode.** It never sends `~S,ES*`. No `~S,ES` string exists in any assembly or native DLL in the MSI. I checked with `strings` in ASCII and UTF-16 over every `*.dll` and `*.exe`.
- **The language is a PC-side toggle.** `PrintJob.printerLanguage` is EZPL or EPL. It comes from `ProgInfo.use [PrinterLanguage] Language` (default "EZPL", `GL/SvgArtiste.cs:1821-1829`) or from the toolbar button `Btn_ChgPrntLng_Click` (`GL/SvgArtiste.cs:9091-9107`). That button only changes what GoLabel generates.
- **The only in-band language escape is for EPL.** In EPL mode, `openport()` sends `ESC G CR LF` (`1B 47 0D 0A`) after it opens the port, and `closeport()` sends `ESC B CR LF` (`1B 42 0D 0A`) before it closes (`SDK/PrintJob.cs:32-34, 1949-1970`). The field names are `MT_Swich_On`/`MT_Swich_Off`. `FrmSendCommandDlg` wraps EPL jobs the same way (`DLG/FrmSendCommandDlg.cs:34-36`). In EZPL mode nothing is sent. Inference: this escape selects GEPL emulation on Godex firmware for one job. It is not a general language lock, and nothing like it exists for GZPL.
- **No handshake before printing.** `PrintJob.Print`/`PrintNornal` open the port and send the job at once (`SDK/PrintJob.cs:401-493, 615-912`).
  - `~B` is sent only by the "connected printer" scan dialog, and only for COM and LPT ports (`DLG/ConnectedPrinter.cs:427-458`). It waits for the keyword "F/W".
  - USB discovery reads printer names from the Windows registry through `Trace.dll FindFirstUSB/FindNextUSB` (`PC/Printer.cs:415-443`). No command is sent.
  - Network discovery uses UDP (section 2d).
  - The scan dialog opens at startup only when `bAutoDetectPrinter` is on. The default is `False` (`MSI/GoLabel.exe.config:258`; `GL/SvgArtiste.cs:2843-2846`). When a printer is chosen there, GoLabel sends `^XGET,CONFIG` and copies `^E ^H ^S ^O ^D` from the reply into the label setup (`GL/SvgArtiste.cs:8452-8466, 8483-8640`).
- **No firmware check.** No code compares firmware versions before printing.
  - `~B` replies and UDP replies are parsed for the model name only (`DLG/ConnectedPrinter.cs:257-309`, `DLG/UDP_Server.cs:177-216`).
  - `^XGET,APPINFO2` field 16 is used only to decide the buzzer state after "locate printer" (`DLG/ConnectedPrinter.cs:505-523`).
- **Today's hardware observation.** In Auto mode, the first job after power-on locks the language. After a ZPL job, EZPL jobs (even `~V`) are ignored. GoLabel has no code that would detect or undo this. Inference: GoLabel assumes the printer is in EZPL or Auto and has not yet locked to another language. A GoLabel user who sends ZPL first would see the same silent failure. Nothing in GoLabel contradicts the observation.

### 2c. Byte sequence of one job (BP730i, default settings, one bitmap object)

The assumptions are listed here; each one has its source.

- Model BP730i selected. The model defaults are then Darkness 8, Speed 4, Stop 16 (`GL/SvgArtiste.cs:2948-2955`; `DLG/PrinterSetup.cs:3871-3899`).
- Gap media, 3 mm gap (`MSI/GoLabel.exe.config:36-40`).
- PrintMode 1, which gives `^AD`.
- Rotate180 normalised to 255 (`DRAW/DrawArea.cs:730-731`).
- CheckReply False, SyncDateTime False, ImageCompress False, AutoBufferCtrl False, IsInverse False, IsMirror False (`MSI/GoLabel.exe.config:288, 303-307, 348, 423, 453`).
- No cutter, no double cut, no partial cut. Copies 1, quantity N.

Every line below ends with CR LF unless marked otherwise.

```
^XSETCUT,DOUBLECUT,0          <- BeginJobCMDs, always added for EZPL (SDK/PrintJob.cs:337-354)
^Q100,3                       <- Setup.GetCommandEZPL (SDK/Setup.cs:324-430); length,gap in mm; float.ToString, "." forced
^W102
^H8
^P<N> or ^P1                  <- see "two paths" below
^S4
^AD
^C1
^R0
~Q+0
^O0
^D0
^E16                          <- culture separator NOT replaced (correction 4)
~R255
^L                            <- QLabel.GetBeginPage (SDK/QLabel.cs:4373-4400)
Q<x>,<y>,<wb>,<h><LF>         <- LF only (SDK/PrintJob.cs:2219)
<wb*h raw bytes>
<CR><LF>                      <- SDK/PrintJob.cs:2265
E                             <- QLabel.GetEndPage (SDK/QLabel.cs:4402-4415)
```

- **Two paths.** `GlobalPrint.RunPrintJobThread` calls `PrintNornal()` when `GlobalInfo.UseNormalPrint` is true, and `Print()` otherwise (`GI/GlobalPrint.cs:1176-1185`).
  - `UseNormalPrint` is true for a simple label: no variables or serials, no multi-across layout, no `LabelsPerCut>1`, no GraphicMode (`GI/GlobalInfo.cs:3713-3868`).
  - `PrintNornal` sends `^P<N>` once and one format (`SDK/PrintJob.cs:401-493`).
  - `Print()` forces `Setup.Number=1`, sends `^P1`, and then sends the whole `^L ... E` format N times (`SDK/PrintJob.cs:632-633, 666, 691-711`).
  - Inference: the static single-bitmap case takes `PrintNornal`.
- **Nothing is sent after `E`** in this configuration. `EndJobCMDs` is empty without double cut (`SDK/PrintJob.cs:357-370`). `Set_Full_Cut` returns early without partial cut (`SDK/PrintJob.cs:2067-2083`). `CheckReply_FW_Enable(false)` sends nothing when CheckReply is off (`SDK/PrintJob.cs:2558-2578`).
- **Nothing is sent before `^XSETCUT`.**
  - No reset, no `~S,ES`, no `^XSET,IMMEDIATE`.
  - `~D<MM,dd,yy,HH,mm,ss>` comes first only if "sync date/time" is on (`GI/GlobalPrint.cs:1172-1175`).
  - `^XSETCUT,MODE,1` comes first only with partial cut (`SDK/PrintJob.cs:2085-2101`).
- **Object position.** The x/y values are the object position in dots. Negative values are cropped to 0 (`SDK/PrintJob.cs:2179-2210`).
- **Height is not padded.** The object height is not padded to the label length or to any multiple. The bitmap is `(int)BoundRect.Width x (int)BoundRect.Height` of the image object (`SDK/Image.cs:840-853`). Only the width is padded, to whole bytes (`SDK/ImageAccess.cs:139-147`).
- **Thresholding.** `AnyBitmapTo1Bits` makes a pixel black when its green channel is ≤ 192 in the default FontThick mode (128 for Thin, 254 for Wide). The other modes test all three channels (`SDK/ImageAccess.cs:161-232`). Images are dithered first (`SDK/Image.cs:849`).
- **Encoding and port use.** Strings are sent as UTF-8 (`SDK/PrintJob.cs:2062-2065`). The port is opened per job and closed after the job (`SDK/PrintJob.cs:426, 477`).
- **Our encoder differs.** `src/lang/ezpl.ts` ends the `Q` header with CR, not LF. That matches the Windows driver, not GoLabel. The Windows driver detail comes from the first pass.

### 2d. Status between jobs or labels, and how replies are read

- **Default: no status traffic at all.** CheckReply is `False` (`MSI/GoLabel.exe.config:423`). `QueryReplyData` then returns at once (`SDK/QLabel.cs:6414-6424`).
- **CheckReply on** (Global Setup checkbox; user action). The flow:
  - After the port opens, GoLabel sends `^XSET,ACTIVERESPONSE,1\r\n~K1\r\n`. It then drains replies in 100 ms steps until a read returns nothing (`SDK/PrintJob.cs:2558-2578`).
  - After each format (`E`), `QueryReplyData` reads until it has seen `CheckReplyQty` bytes `Y` (`SDK/QLabel.cs:6414-6474`). `CheckReplyQty` is Number×Copy in `PrintNornal` (`SDK/PrintJob.cs:451`) and Copy per format in `Print()` (`SDK/PrintJob.cs:687`; 1 in the cutter loop, 773). It waits `CheckReplyTimeout_Sec`, default 10 s (`MSI/GoLabel.exe.config:426`), and then shows a dialog (wait again / continue / abort).
  - At the end GoLabel sends `^XSET,ACTIVERESPONSE,0\r\n~K0\r\n`.
  - `CheckReply_WorkType` turns the waiting off for PrintToFile, Driver and LPT. It does not suppress the enable and disable commands (`SDK/PrintJob.cs:2546-2556` against `2558-2578`).
- **AutoBufferCtrl** (default off, `MSI/GoLabel.exe.config:348`). The PC sleeps `(len[+gap]) / (speed*25.4) * 1000` ms after each label (`SDK/QLabel.cs:3385-3401`; used at `SDK/PrintJob.cs:763, 868`). This is time-based pacing with no reply.
- **RFID only.** Before each label after the first, GoLabel polls `~S,CHECK` up to three times until the reply contains "00" (`GI/GlobalPrint.cs:648-664`). The BP730i has no RFID.
- **USB read path.**
  - The calls are `Printer.Read` → `Trace.dll RcvBuf` (`PC/Printer.cs:327-361`), `SendBuf` for writes, `OpenUSB(name)` and `closeport`.
  - Inference from `Trace.dll` strings at offsets 1880592-1881052: the device name comes from `SYSTEM\CurrentControlSet\Control\DeviceClasses\{28d78fad-5a12-11d1-ae5b-0000f803a8c2}` (GUID_DEVINTERFACE_USBPRINT) and `services\usbprint\Enum`. The handle is opened as `\\.\%s` / `\\?\...`. So GoLabel uses the Windows usbprint.sys bidirectional pipe, not the spooler.
  - `SetReadTimeout` does nothing for USB (`PC/Printer.cs:363-382`).
  - The terminal dialog uses a managed copy of this path: `clsDevUSB` with `CreateFile`/`ReadFile`/`WriteFile` (`SDK/../QLabelSDK.PrinterControl.DevCtrl/clsDevUSB.cs:38-57, 296-345`, used at `VIEW/FrmTerminal.cs:135`).
  - The "Driver" port (Windows spooler) is write-only. GoLabel refuses queries on it: "No Support Driver Port" (`GI/GlobalPrint.cs:206-219`).
- **TCP.**
  - `SocketSDK` connects to port 9100 with a 5 s connect timeout (`SOCK:111-150, 242-297`). The send timeout is 60 s, with a retry dialog after 3 partial sends (`SOCK:416-565`).
  - Reads are synchronous `Receive` calls on the same socket (`SOCK:623-735`).
  - `Thread_SendQuery` reads until a keyword appears or 4 empty reads occur (`SDK/PrintJob.cs:1873-1936`).
  - Unused fallback: after a connect timeout in the async mode, `CheckPrinterStatus` opens TCP 4900, sends `printer state`, and reads one line (`SOCK:217-240`). The default `bSyncSend=true` takes the sync path, which does not call it (`SOCK:36, 133`).
- **UDP discovery (new).**
  - GoLabel broadcasts `Where is Godex Printer?` to UDP 8888, five times per network card (`DLG/UDP_Client.cs:46-57`; `DLG/ConnectedPrinter.cs:204-210`). It listens on UDP 6666 (`DLG/ConnectedPrinter.cs:20`).
  - Reply layout (`DLG/UDP_Server.cs:149-216`): byte 0 `P`, then CRLF-separated fields: alias; serial; 6-byte MAC; skip 8 bytes from the MAC start; 4-byte IP; skip 6; port text; boot code line; then lines `STATUS:aa,dns,smtp` and `F/W ... <model words> <version>`.
  - Status codes 00-62 are the same table as `~S,CHECK` (`DLG/UDP_Server.cs:362-384`).
  - A second broadcast `WHERE ARE YOU KC300` (53 bytes) goes to UDP 7303 for another module type (`DLG/UDP_Client.cs:59-86`).

### 2e. PrinterModel.xml: full BP730i entry

`MSI/PrinterModel.xml:1644-1669`:

| Element | Value | Used by (file:line) | Effect |
|---|---|---|---|
| `ID` (attribute) | `BP730i` | `GI/PrintModelParameter.cs:42-44`; `DLG/ConnectedPrinter.cs:257-301` | Model key. Discovery matches it as a substring of the `~B`, USB or UDP name. |
| `Resolution` / `ResolutionDefault` | 300 / 300 | `DLG/ConnectedPrinter.cs:286` | Sets the DPI on discovery. |
| `Darkness` / `DarknessDefault` | 0..19 / 8 | `DLG/PrinterSetup.cs:3871-3881`; `GL/SvgArtiste.cs:2952` | Combo list and default. |
| `Speed` / `SpeedDefault` | 2,3,4,5 / 4 | `DLG/PrinterSetup.cs:3882-3891`; `GL/SvgArtiste.cs:2953` | Combo list and default (ips). |
| `USB`, `COM`, `Network`, `LPT`, `Driver` | 1 each | `DLG/PrinterSetup.cs:3820-3838` | Enables the port radio buttons. |
| `PrinterMode` | 1 | `DLG/PrinterSetup.cs:3839-3845` | 1 = the TT/DT combo is enabled. 0 forces index 1 (DT). |
| `UseApplicator` | 0 | `DLG/PrinterSetup.cs:3846-3850` | Removes "applicator" (`^O2`) from the list. |
| `UseDispenser` | 1 | `DLG/PrinterSetup.cs:3851-3855` | Keeps "peel" (`^O1`). |
| `StopPosition` | 16 | `DLG/PrinterSetup.cs:3894-3901`; `GL/SvgArtiste.cs:2954` | Default `^E` in mm. The UI maximum is 60 for EZPL (`DLG/PrinterSetup.cs:4114-4122`). |
| `Cutter` | 1 | `DLG/PrinterSetup.cs:3856-3866` | Enables "labels per cut". |
| `CloudFW` | 1 | `DLG/PrinterSetup.cs:4127-4130` | Shows the "Miscellaneous" tab (section 3.9). Despite the name, it is not a firmware feature. |
| `LCD` | 1 | `DLG/PrinterSetup.cs:5908` | Adds `^XGET,LANGUAGE` / `^XGET,KEYBOARD` to the Refresh query. |
| `Label_Width_Min` / `Max` | 4 / 106 mm | `DLG/PrinterSetup.cs:1229-1235`; `VIEW/FrmPageSetup.cs:556-566` | Clamps the label width. |
| `Label_Height_Min` / `Max` | 3 / 762 mm | same | Clamps the label length. 762 mm is the only "max label length" in GoLabel. |
| `Label_Margin_L` / `Label_Margin_T` | 0 / 0 | `GI/GlobalPrint.cs:1301`; `GL/SvgArtiste.cs:5939` | Designer offset only. |
| Not present: `WiFi`, `Rewinder`, `BuiltInTTF`, `Linerless`, `PaperLeftAlign`, `RFID_*`, `CN_Only`, `US_Only`, `KR_Only` | defaults "0" (`GI/clsPrintModelData.cs:101-110`) | `GL/SvgArtiste.cs:10881-10897` (WiFi); `GL/../TextForms/PrinterText.cs:820` (BuiltInTTF); `DLG/PrinterSetup.cs:3867-3870` (Rewinder) | No Wi-Fi menu, no rewinder group, no resident Noto TTF fonts T1-T5. |

- **No limits on memory, buffer or image size.** PrinterModel.xml has no field for any of these, and no C# code checks image size before sending.
- **The only memory figure GoLabel reads** is the `KB free` line of the `~MDIR` reply, in the object download and maintenance dialogs (`DLG/PrinterControl.cs:156`; `VIEW/FrmObjectSync.cs:316`; `VIEW/FrmObjectMaintain.cs:231`).
- **Neighbouring models (context).**
  - `BP730` (line 1618) is the same except Speed 2-4, default 3, and LCD 0.
  - `BP730i+` has Label_Height_Max 3200, WiFi, Rewinder, BuiltInTTF, and StopPosition 12.
  - `BP730i Pro` has Label_Height_Max 8890.
- **Model list can be replaced online.** The menu item `mi_PrinterModelOnlineUpdate` downloads `https://raw.githubusercontent.com/godexsw/GoLabel_PrinterModel/main/PrinterModel.xml` into AppData (`GL/SvgArtiste.cs:16324-16345`). This is a user action.

### 2f. Persistent changes without an explicit request

| What | When | Source | Notes |
|---|---|---|---|
| `^Q ^W ^H ^P ^S ^AT/^AD ^C ^R ~Q ^O ^D/^Db ^E ~R` | Every job | `SDK/Setup.cs:324-430`; sent at `SDK/PrintJob.cs:437-447` (PrintNornal) and `666-679` (Print) | The EZPL manual marks most of these as permanent (first pass §4.1). Every job overwrites the stored printer setup with GoLabel's values, including `^AD` by default and `~R255`. |
| `^XSETCUT,DOUBLECUT,0` | Every EZPL job | `SDK/PrintJob.cs:337-354` | The manual says "temporary" (first pass §4.2). |
| `^XSETCUT,MODE,1` … `,0` | Jobs with partial cut | `SDK/PrintJob.cs:2067-2101` | Leaves full cut on at the end. |
| `^XSET,ACTIVERESPONSE,0` + `~K0` | End of every job when CheckReply is on | `SDK/PrintJob.cs:2558-2578` | Overwrites any user value with 0. |
| `^XSET,ACTIVERESPONSE,1` | After the network or alert dialogs | `VIEW/FrmSetIP.cs:579-627`; `VIEW/FrmSetAlertMsg.cs:393-435`; `VIEW/FrmSetAlertPath.cs:373-415` | Restore after a temporary `,0`. Inference: it is restored only when the query showed a nonzero value. |
| `~D` (RTC) | Before every job when "sync date/time" is on (default off) | `GI/GlobalPrint.cs:1172-1175` | |
| `^XSET,BUZZER,1` ×3, then `^XSET,BUZZER,0` | "Locate printer" cell in the scan dialog | `DLG/ConnectedPrinter.cs:505-523` | Turns the buzzer off unless `^XGET,APPINFO2` field 16 is "1". If the parse fails, a buzzer that was on ends up off (inference). |
| `^XSET,LANGUAGE/KEYBOARD/CODEPAGE/BUZZER`, `^G`, `^XSET,BACKFEED/TOPOFFORM`, `~S,OFFSETX/Y`, `^XSET,DISMOFFSET` | One "Set" click on the Miscellaneous tab | `DLG/PrinterSetup.cs:6110-6150` | All are sent together, even the ones the user did not change. |

## 3. Inventory of EZPL features in GoLabel II

All rows are BP730i-relevant unless the last column says otherwise. "Auto" means sent with print jobs. "User" means sent only on a menu or dialog action.

### 3.1 Job setup and per-format prelude

| Command | Syntax | Source | Trigger |
|---|---|---|---|
| `^Q`/`^QD` | `^Q<len>,<gap>`; `^Q<len>,0,<feed>`; `^Q<len>,<mark>,<pos><+\|->` (mm); `^QD` the same in dots | `SDK/Setup.cs:345-379` `GetCommandEZPL` | Auto |
| `^W ^H ^P/^PI ^S ^AT/^AD ^C ^R ~Q± ^O ^D/^Db ^E ~R` | see section 2c | `SDK/Setup.cs:380-424` | Auto |
| `^RW<power>`, `^RS<len>,<retry>,-1,-1,-1` | RFID only | `SDK/Setup.cs:425-429` | Auto. Not relevant (no RFID). |
| `^XSET,DRAWMODE,n` … `,0` | Before `^L` and before `E` when DrawMode ≠ 0 | `SDK/QLabel.cs:4387-4415` | Auto |
| `^L[I][M]` | `I` = inverse, `M` = mirror (global settings) | `SDK/QLabel.cs:4373-4385` | Auto |
| `D<fmt>`, `T<fmt>` | Date and time format lines after `^L` | `SDK/QLabel.cs:2995-3002, 3041-3048` | Auto, when the label uses a date or time |
| `C<nn>,<start>,<step>,...` | Serial counter definitions after `^L` | `SDK/QLabel.cs:3008-3012` | Auto, with serial objects |
| `E` | End of format | `SDK/QLabel.cs:4402-4415` | Auto |
| `^C<n>`, `^D0/^D1`, `~P1` | Cutter loop | `SDK/PrintJob.cs:695-731, 773-830` | Auto, with a cutter |
| user "start job command" | Free text | `DLG/PrinterSetup.cs:1546-1549` | Only for the Driver port |

### 3.2 Raster images

- `Q` / `QA`: section 2a.
- `Y<x>,<y>,<name>` prints a stored graphic (`SDK/Image.cs:791-835`).
- `~EB,<name>,<size>` + BMP bytes stores a graphic. GoLabel sends `~MDELG,<name>` first (`VIEW/FrmObjectDownload.cs:2889`; `GoLabel/QLabelNet.NewToolForms.GraphicFm/GraphicFm.cs:688`). User action.

### 3.3 Native text

All text commands come from `SDK/Text.cs:3970-4150` `MyToStringEZPL_GetCommand`.

- Built-in bitmap fonts: `A<id>,x,y,w,h,gap,rot[I][E][M][P2|P3],data` (`SDK/Text.cs:4067`).
- TrueType: `AT<id>,x,y,w,h,gap,rot[B][T][S][U][I][E][M][P2|P3],<enc>,0,data` (`SDK/Text.cs:4033`). `<id>` is empty for the resident TTF, A-Z for downloaded fonts, or 1-5 for the Noto fonts (BuiltInTTF models only, so not the BP730i).
- Soft fonts: `V<A-Z>,...` (`SDK/Text.cs:4100`).
- Asian fonts: `AZ1..AZ8,...` (`SDK/Text.cs:4129`).
- Windows text, RTF text, WordArt and curved text are always sent as `Q` bitmaps (`SDK/WindowText.cs:1388`, `SDK/RichTextImage.cs:743`, `SDK/WinWordArt.cs:1155`, `SDK/CurvedText.cs:793`).

### 3.4 Native barcodes

- **Format.** `B<sym>,x,y,narrow,wide,height,rot[ext],readable,data` (`SDK/BarCode.cs:3171-3266`).
- **Symbol table.** `SDK/BarCode.cs:73-81`, indexed by `SDK/BarCodeType.cs`. I verified the EAN128 entry: index 25 maps to `U`, so **GS1-128 = `BU`**. Other symbols:

| Symbology | Command(s) |
|---|---|
| Code39 | `BA`..`BA8` |
| EAN-8 | `BB`-`BD` |
| EAN-13 | `BE`-`BG` (`BE2` for EAN13P7) |
| UPC-A | `BH`-`BJ` |
| UPC-E | `BK`-`BM` |
| 2of5 variants | `BN`, `BN2`, `BN4`-`BN6` |
| Codabar | `BO` |
| Code93 | `BP` |
| Code128 | `BQ`, `BQ2`+A/B/C |
| ISBT | `BQI` |
| UCC128 | `BR` |
| PostNet / Planet | `BS` / `BS1` |
| DUN14 | `BT2` |
| RPS128 | `BV` |
| ChinaPost | `BW` |
| HIBC | `BX` |
| I2of5 bearer bar | `BZ` |
| Plessey | `B7` |
| Misc. (UCC128 variants, Telepen, FIM) | `B1`-`B4` |
| MSI | `BY`-`BY4` |
| GermanPost | `B001` |
| Pharmacode | `B002` |
| Code11 | `B050` |

- **2D and stacked:**

| Symbology | Command | Source |
|---|---|---|
| QR | `Wx,y,mode,type,<ECL><ver>,mask,mul,len,rot\r\n[~1]data` | `SDK/QRCode.cs:602-660` |
| DataMatrix | `XRBx,y,mul,rot[R\|Srrrccc],len\r\n[~1]data` | `SDK/DataMatrix.cs:924-960` |
| PDF417 | `Px,y,w,h,rows,cols,ECL,len,rot` | `SDK/Pdf417.cs:676-693` |
| Macro PDF417 | `PH...` | `SDK/Pdf417.cs:688-692` |
| MicroPDF417 | `PM...` | `SDK/MicroPdf417.cs:241` |
| TLC39 | `PT...` | `SDK/TLC39.cs:280` |
| Aztec | `Z...` | `SDK/Aztec.cs:385` |
| MaxiCode | `M...` | `SDK/MaxiCode.cs:270` |
| Codablock F | `B052,...` | `SDK/CodaBlockF.cs:259` |
| GS1 DataBar | `B5<0-6>,...` | `SDK/GS1DataBar.cs:871` |
| GS1 Composite | `B6<0-9,A-C>,...` | `SDK/GS1Composite.cs:667` |

- **Bitmap fallback.** A barcode is sent as a `Q` bitmap in these cases:
  - 1D: a Windows caption font, GraphicMode, or Code128CheckDigit (`SDK/BarCode.cs:3331-3346`).
  - DataMatrix: a caption, or GraphicMode (`SDK/DataMatrix.cs:690-705`).
  - QR: a caption or a logo.
  - Always: DotCode, Han Xin and HIBC 1D, in practice (inference from constructors that set `bBuiltinFont=false`).
- **No model or firmware gating** exists for any symbology.
- These rows come from a delegated read. I spot-checked `BarCode.cs:73-81`, `BarCodeType.cs`, `Text.cs:4030-4036` and `DataMatrix.cs:924-935`.

### 3.5 Lines and shapes

| Object | Output | Source |
|---|---|---|
| Line | `Lo,x1,y1,x2,y2` (overwrite) or `Le,...` (XOR) | `SDK/Line.cs:498-522` |
| Rectangle | `Rx1,y1,x2,y2,<vstroke>,<hstroke>` | `SDK/QRectangle.cs:333-340` |
| Table | outer `R`, then `Lo`/`Le` lines | `SDK/TableForm.cs:674-690` |
| Ellipse, rounded rectangle, oblique line, variable shape | always a `Q` bitmap | `SDK/Ellipse.cs:493`, `SDK/RoundRect.cs:538`, `SDK/ObliqueLine.cs:478`, `SDK/VarShape.cs:415` |

### 3.6 Variables, counters, database (delegated read; key lines checked)

- **Direct printing.** GoLabel computes variable values on the PC and sends only literal text. The `Cnn` serial definitions are sent after `^L` (`SDK/QLabel.cs:3008-3012`). The PC advances the counters (`UpdateSerialFormatAll`).
- **Command export and stored forms.** These emit `Vnn,...` and `V#OP`/`V#STRSUB`/`V#SET,...` lines and keep `^Vnn`/`^Cnn`/`^D`/`^T` tokens (`SDK/QLabel.cs:2246-2324`; `SDK/../QLabelSDK.Variable/clsVariableList.cs:544-640`).
- **Database printing** is done on the PC, one label per record (`SDK/QLabel.cs:3479`, `4123`).
- **Downloads** (user actions): `~L,DBASE`, `~L,DBASECSV` with `^XSET,CSV,DELIMITER,<c>`, and `~L,SERIAL` (`VIEW/FrmObjectDownload.cs:1005-1084, 3150-3166`).
- **Stored forms:** `^F<name>` … `E` stores a form, `^K<name>` recalls it, and `^PA<n>` sets auto print (`SDK/PrintJob.cs:1037-1107`; `VIEW/FrmObjectDownload.cs:3173-3195`).

### 3.7 Fonts and files (user actions)

- `~H,TTF,<id><name>,<size>\r<bytes>`, preceded by `~MDELC,<id>` (`VIEW/FrmObjectDownload.cs:2125-2157`).
- `~H,TTF_TABLE`.
- Bitmap and Asian fonts are built by native `FontFile.dll`. The format string `~%c,%c,%s,%d,%d,%d,%d` was not decompiled.
- `~MDEL*`, `~MDIR`, `~MGETF`, `^XGET,PREVIEW` (first pass §4.6).

### 3.8 RTC

- `~D<MM,dd,yy,HH,mm,ss>` (`GI/GlobalPrint.cs:1174`; `VIEW/FrmClockSetup.cs:70, 96`; `VIEW/FrmObjectDownload.cs:3605`).
- Text objects use the printer clock by default: `^D`/`^T` tokens are sent and the printer fills them in (`SDK/Text.cs:3161`; `SDK/Graphic.cs:2474`).

### 3.9 Printer settings dialogs (user actions)

- **Refresh** sends one query: `^XSET,NETCONFIG`, then `^XGET,LANGUAGE` and `^XGET,KEYBOARD` (LCD models), then `~S,OFFSETX`, `~S,OFFSETY`, `^XSET,DISMOFFSET`. It waits for the keyword "rintable" (`DLG/PrinterSetup.cs:5922-5935`).
- **Set** sends one block (`DLG/PrinterSetup.cs:6110-6150`): `^XSET,LANGUAGE,i`, `^XSET,KEYBOARD,i`, `^XSET,CODEPAGE,i`, `^XSET,BUZZER,0/1`, `^G<i>`, `^XSET,BACKFEED,1/0`, `^XSET,TOPOFFORM,i`, `~S,OFFSETX,n`, `~S,OFFSETY,n`, `^XSET,DISMOFFSET,0,<mm*10>`.
- **Menu items** (`GL/SvgArtiste.cs`):
  - `^XSET,ROTATION,0-3` (14123)
  - `^XSET,WHENTOSENSING,0-3` (14551)
  - `^XSET,REALLENGTHPRINT,0/1` (14571)
  - `^XSET,TEXTBLOCK` and `^XSET,BARCODEALIGN` (11939-11993)
  - `^XSETCUT,DOUBLECUT` (12041)
  - `^XSET,REWINDER` (10719; hidden for BP730i)
  - `^XSET,LINERLESS` (10752; hidden)
  - `~S,SENSOR`, `~V`, `~T`, `~Z`, `~X1-6`, `^M`, `^B`, `~P`, `~S,CANCEL` (first pass §4.4-4.5)

### 3.10 Network (user actions)

- **IP dialog.** It queries with `^XSET,ALIAS`, `^NS`, `^XSET,NETSPEED` and `^NT`. It sets with `^XSET,ALIAS,<name>`, `^NS<P|D>,ip,mask,gw,,,,,port` and `^NT,<dns>,<name>` (`VIEW/FrmSetIP.cs:30, 379-450, 633, 700`).
- **802.1X:** `~L,METHOD|TLSVERSION|...` (`VIEW/FrmSetIP.cs:1033-1356`).
- **Alert messages:** `^NR` (`VIEW/FrmSetAlertMsg.cs`).
- **SNMP and SMTP:** `^NL`, `^NA` (`VIEW/FrmSetAlertPath.cs`).
- **UDP discovery:** section 2d.

### 3.11 Wi-Fi, BLE, firmware

- **Wi-Fi.** WiFiTool sends `^NW,WGET*`/`WSET*`, `^WI`, `^YZ2` and `^XSET,BTSTATUS`. **Not BP730i-relevant.** The menu is hidden when `WiFi` is 0 (`GL/SvgArtiste.cs:10881-10897`), and the BP730i entry has no `WiFi` element.
- **BLE.** LibBLE uses service `0000FFF0-...` (old module) or `0000A002-...` (ESP32). It writes 20-byte chunks with a 100 ms pause (old module) or 512-byte chunks (ESP32). ESP32 flow control uses `~S,BUFUSAGEWARNING` with the replies "Data buffer is full" / "Data buffer isn't full" (`LibBLE/LibBLE/BLECtrl.cs:124-133, 290-295, 400-455`). **Not BP730i-relevant** (inference: the BP730i has no BLE hardware, and its model entry has no BLE attribute).
- **Firmware update.**
  - GoLabel C# has no printer firmware update path.
  - `RunAutoUpgrade` updates the application only, and only when `CompanyName=="GoDEX"` (`GL/SvgArtiste.cs:3206-3215`).
  - Native `Trace.dll` exports `Download_FW` (ordinal 0x17). No C# code imports it (`grep Download_FW` finds nothing). Partial disassembly of the function at `0x1000c770` gives this flow (inference):
    1. Read the file.
    2. If the file contains the string `FW_Limit`, send it raw in 128 KiB chunks.
    3. Otherwise, send 20 × CR, then `~O\r\nGODEX_FW_MARK_STRING,\r\nD0,<size>\r\n` byte by byte, then two CRs.
    4. Then send the data in 512-byte blocks with a table-driven CRC-16 (initial value 0xFFFF).
  - Not tested. Do not use it without the vendor tool.

## 4. Features not in the first pass

1. QA payload details. GoLabel builds the zlib wrapper by hand (`78 9C` + deflate + big-endian Adler-32). The header carries no compressed length. The only gate is the global `Chk_QA` checkbox.
2. EPL mode wraps each port session in `ESC G CR LF` / `ESC B CR LF`. EZPL mode has no language escape and no handshake.
3. The two print paths `PrintNornal` (`^P<N>`, one format) and `Print()` (`^P1`, N formats), and the `UseNormalPrint` rules that choose between them.
4. The CheckReply protocol in detail: `^XSET,ACTIVERESPONSE,1` + `~K1`, counting `Y` bytes against Number×Copy, a 10 s timeout dialog, and ending with ACTIVERESPONSE 0 / `~K0`.
5. AutoBufferCtrl, time-based pacing between labels.
6. USB I/O through `Trace.dll` and usbprint.sys (bidirectional). The Driver port is write-only and refuses queries.
7. UDP discovery: `Where is Godex Printer?` to UDP 8888, replies on UDP 6666, with a binary reply layout that includes STATUS and F/W. Also `WHERE ARE YOU KC300` to UDP 7303.
8. TCP 4900 `printer state` probe (present in the code, not used by default).
9. The `^E` culture decimal-separator bug.
10. The default `^AD`. The workspace defaults from `GoLabel.exe.config` (102×100 mm, gap 3, darkness 5, speed 2, stop 12, model G500) apply until the BP730i model defaults (8 / 4 / 16) are loaded.
11. Every PrinterModel.xml element and its effect. CloudFW only shows a tab. No memory or image limits exist. The model list can be updated online from GitHub.
12. "Locate printer" side effect (`^XSET,BUZZER,0`). The network dialogs force ACTIVERESPONSE.
13. The native barcode table (GS1-128 = `BU`, QR = `W`, DataMatrix = `XRB`, PDF417 = `P`, and others), with its bitmap fallback rules.
14. Native text (`A`, `AT`, `V`, `AZ`) and shapes (`Lo`/`Le`, `R`). Ellipses and rounded shapes are bitmaps.
15. Printer-side variables (`V`, `V#...`, `C`) are used only for export and stored forms. Direct printing computes values on the PC.
16. `Trace.dll Download_FW` firmware framing (native, unused by GoLabel).
17. Thresholding in `AnyBitmapTo1Bits`: green channel ≤ 192 means black.

## 5. Not done

- `Trace.dll`/`EZio32.dll`/`FontFile.dll` were not fully disassembled. Only `Download_FW` was partly read. The USB open path is inferred from strings.
- Nothing was run on hardware or captured on the wire in this pass. The byte sequence in section 2c is reconstructed from the code.
- The barcode, text and variable rows in sections 3.3, 3.4 and 3.6 come from a delegated read. They were spot-checked, not re-read line by line.
