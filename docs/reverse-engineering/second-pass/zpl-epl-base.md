# BP730i: ZPL, EPL and base modules (Seagull 2023.4.1.0)

Static analysis only. Nothing was sent to a printer.

Labels: **fact** = read in a file or decomp; **inference** = my conclusion from facts; **guess** = untested hypothesis.

Sources and abbreviations:

- `INF` = `drv/exe/BarcodePrinter.inf`.
- `ZPL/`, `EPL/`, `GDX/` = `drv/ddz/xg#{zpl,epl,gdx}_2023.4.1.0/*.d`.
- `ZPL-PM`, `ZPL-CM`, `GDX-PM`, `GDX-CM` = `work/decomp/Seagull_{Print,Config}Module_{ZPL,GDX}.c`.
- `EPL-PM`, `EPL-CM` = `work/decomp_epl/Seagull_{Print,Config}Module_EPL.c`. I made these today with `DecompAll.java`. Project: `work/ghidra_epl`.
- `CB` = `work/decomp_base/ConfigBase_comm.c`. These are the Seagull_ConfigBase.dll functions that match `CommunicationInterface|ProtocolInterface|StatusCapabilities|NetworkPolicy|Bidi` (`DecompMatching.java`, project `work/ghidra_base`).
- `str:<file>@<off>` = `strings -a -t x` file offset. Dumps are in `work/strings/<dll>.{a,w}.txt` (`.w` = UTF-16).
- `EZPL m.84` = `txt/ezpl/p072.txt` (EZPL manual O.4, page 84).

All paths are relative to `/home/agent/re-bp730i-deep/`.

## 1. ZPL module: what `zpl-driver.md` missed or got wrong

The command table in `zpl-driver.md` is correct as far as I checked it. I found no command it got wrong. It misses these points:

1. **No TCP/IP in `Ports.Bidirectional` for the RT730i model.** `ZPL/Model.d:12720` sets `Ports.Bidirectional=Serial,USB`, `Ports.PNP=USB` and `Ports.PNP.ID+=GODEX_RT730i_GZPL40D5` (12721-12722). The doc lists only `Status.Ports=Serial,USB,TCP/IP` from the feature group (Features.d:1080). The GDX model (`GDX/Model.d:5401`) and the EPL model (`EPL/Model.d:9299`) also say `Serial,USB`. Only `Godex_RT730i+` adds TCP/IP (`EPL/Model.d:9330`). Inference: the driver treats the RT730i as bidirectional only on USB and serial.
2. **The Zebra language preamble also exists in the ConfigModule, and it is also gated off for GZPL.** `! U1 setvar "device.languages" "zpl"\r\n` is at str:ZPL-CM@0x475d8 and @0x49420. It is written in ZPL-CM `FUN_180001f30` and `FUN_180001f70` (status and query path) and in `FUN_18000e580` (Tools jobs). The doc cites only the PrintModule. Every path needs both flags. `+0x83` = `FUN_180032b00` = "not Argox PPLZ, CPLZ, GZPL, Bixolon, ESCLabel, HPRT or Gprinter". `+0x84` = `FUN_180035bf0` = `~Language.Initialize` (ZPL-CM lines 47-95, 29207-29235, 31152-31165). `~Language.Initialize=true` is set only for `ZQ300_Series`, `ZQ500_Series` and `ZQ600_Series` (`ZPL/Features.d:2298, 2319, 2339`). So a GZPL queue never sends it.
3. **The status monitor polls `~HS`, and nothing else for GZPL.** ZPL-CM `FUN_180001200` sets the status query to `~HS`. It sends `~H(SEA,E ~H(SPA,P ~H(SMA,S ~H(QWN` only for `~Language.ESCLabel` (flag `+0x80`). `~HQES` is sent only with `~Command.HQ` (ZPL-CM `FUN_180003080`, flag `+0x86` = `FUN_180034a40`). RT730i does not have that flag. The reply parser is ZPL-CM `FUN_1800012f0`. It expects three STX-framed 36-byte strings, with STX at offsets 0, 0x24 and 0x48.
4. **The ConfigModule reads the same prefix registry keys as the PrintModule.** These are `Settings:Format Instruction Prefix` (default `^`) and `Settings:Control Instruction Prefix` (default `~`), read in ZPL-CM `FUN_180032980` and `FUN_180032a40`. Status queries and Tools commands use the same prefixes as jobs.
5. **Smaller items.** `BarCode=Godex` and `Font=Godex_304` (`ZPL/Model.d:12714, 12718`) matter only for driver-native text and barcodes, not for bitmaps. `[Godex RT730i GZPL]` (`ZPL/Driver.d:3931-3934`) has no `PNP=` line. Only the `BP730i GZPL` alias has one (1287).

## 2. EPL (GEPL) module

**Yes, a BP730i GEPL queue exists.**

- `INF:259` (x86) and `INF:762` (amd64) define `"BP730i GEPL"=EPL,USBPRINT\__BP730i_GEPLB47E`.
- `EPL/Driver.d:1141-1145` defines `[BP730i GEPL]`: `Manufacturer:Godex_Generic`, `Model:Godex_RT730i`, the same PNP ID.
- `EPL/Model.d:9292-9321` defines the model:
  - `Features=Godex_EZ1200Plus`, `Method=Godex`, `Drawing=Godex`, `Font=Godex_300`.
  - `Ports.Bidirectional=Serial,USB`, `Ports.PNP.ID+=GODEX_RT730i_GEPL86E4`.
  - `~GodexGEPL=true`, `~Speeds.Print=1..5`, `~TearOff=false`, `~Memory.Configuration=Godex`.
- `EPL/Features.d:570-582` defines `Godex_EZ1200Plus`:
  - `Status.Ports=Serial,USB`.
  - `~Bidirectional.ReadConfiguration` and `~Bidirectional.FileManagement`.
  - `~Command.Reset.Factory.Defaults=^default`.
  - `~Darkness.Default=10`, `~Sensor.Reverse=true`.

Command groups. These are group level only and are fact unless marked otherwise.

| Group | Commands | Evidence |
|---|---|---|
| Page/job setup | `I8,` code page, `q` width, `S` speed, `O` options (Godex-specific branch), `WN`, `D` density, `ZT`/`ZB` print direction, `Q` length/gap, `rN`/`rY` double buffer | EPL-PM `FUN_1800020c0` (decomp lines 780-1060). `O`: `FUN_18000fa10` (GodexGEPL branch at line 9314) and `FUN_18000f580` (`P`, `P,`, `P,L,` options at 9029-9070). `Q`: `FUN_180003230`, `FUN_1800032d0` |
| Vendor branches not used by RT730i | `ESC G`/`ESC B` (Godex line mode), `ESC KIJ`, `ESC KIL`, `ESC KI8`, `d8,`, `ZN`, `PM`, `H` | Gated by `~OperatingMode.Default.GodexLineMode` (only `[MettlerToledo]`, `EPL/Features.d:688`), `~ArgoxPPLB`, `~POSTEK` and others (EPL-PM `FUN_18000ca80`, `FUN_18000bc90`, `FUN_18000bd70`) |
| Label body | `N` clear, `GW` raw graphic, `GG`/`GK`/`GM` stored graphics, `A` text, `B` barcode, `LO`/`LE`/`LW` lines, `P`/`PA` print | EPL-PM `FUN_180002940` (`P`, `N`), `FUN_1800094e0` and `FUN_180009c70` (`GW`), lines 279-327 (`GK`, `GG`), 5151 (`GM`), 5911-5916 (lines), `FUN_1800041f0` (`PA`) |
| Forms/templates | `FK`, `FS`, `FR`, `FE`, `EK`/`ES` (soft fonts) | EPL-PM lines 116-217, `FUN_180003ba0` |
| Tools (ConfigModule) | `C` cut, `^@` reset, `^default` factory defaults, `xa` sensor auto-sense (GodexGEPL; `~S,SENSOR` only for OPAL), `U` print configuration, `EI`/`FI`/`GI` list fonts/forms/graphics, `UE`/`UF`/`UG`/`UM`/`UQ` reads, `^XSET,MEMORY,` | EPL-CM `FUN_180003730` switch (lines 2150-2310), `FUN_180011460` = `~GodexGEPL`, `FUN_180011aa0`, line 7197 |
| Status | `^ee\r\n`, reply = 2-digit code. Monitoring is turned off when the interface level is below 2 | EPL-CM `FUN_180001140`, `FUN_180001160`, `FUN_180001120` |

Inference: GEPL Tools send the EZPL-style strings `^default`, `^XSET,MEMORY,` and `~S,SENSOR` to a GEPL printer. So the Godex GEPL interpreter accepts some `^`/`~S,` utility commands. Nothing in the EPL module selects or changes the printer language.

## 3. Base, port monitor and INF

**Queues for BP730i.** There are three, one per language. Each is a separate INF model that maps to a separate module:

| Queue | INF section → module | Hardware ID (INF) | Model.d PnP ID |
|---|---|---|---|
| `BP730i` | `GDX` (EZPL) | `USBPRINT\__BP730iA1C4` (`INF:258`, `INF:761`) | `GODEX_RT730i0096` (`GDX/Model.d:5403`) |
| `BP730i GEPL` | `EPL` | `USBPRINT\__BP730i_GEPLB47E` (`INF:259`) | `GODEX_RT730i_GEPL86E4` (`EPL/Model.d:9301`) |
| `BP730i GZPL` | `ZPL` | `USBPRINT\__BP730i_GZPL724F` (`INF:260`) | `GODEX_RT730i_GZPL40D5` (`ZPL/Model.d:12722`) |

- All three INF sections use the same dispatchers and the same language monitor: `LanguageMonitor="Seagull V3 Network Monitor,Seagull_V3_NetMonDispatcher.dll"` (`INF:1083-1140`).
- There is one port monitor, `"Seagull Scientific Port"=SeagullTCPIPPortMonitor` (`INF:56-66`).
- The same family exists for `BP730`, `BP730i+`, `BP730iW`, `BP730W` and `BP730x` (`INF:255-272`).

**PnP mapping.** The INF matches on `USBPRINT\<id>`. Windows builds `<id>` from the IEEE-1284 MFG and MDL fields and adds a 4-hex-digit checksum.

- Inference: the `__BP730i…` IDs fit a device that reports `MDL:BP730i` with an empty MFG. The Mac CUPS URI `usb:///BP730i?serial=190307B1` (repo `README.md:33`) also has an empty host, and the host part is the MFG.
- I could not reproduce the checksum with the CRC-16 variants I tried. So which ID matches the real device is not proven.
- Guess: a language-suffixed ID such as `__BP730i_GZPL…` can only match automatically if the printer reports `MDL:BP730i GZPL`. Then the printer would change its 1284 ID with the active language. This is untested. It can be checked on the Mac with `lpinfo -l -v` before and after a ZPL job.

**Language selection or initialisation preambles.** Fact for each module:

- GDX (EZPL): sends `^XSET,IMMEDIATE,1\r\n` once when the status channel opens (GDX-CM `FUN_180001430`). It polls `~S,STATUS\r\n` (GDX-CM `FUN_1800010a0`). It has no language command.
- ZPL (GZPL): no preamble. `^XA^SZ2^JMA…` is the first format (PM `FUN_180016a20`). The Zebra `setvar` is gated off (section 1, item 2).
- EPL (GEPL): no preamble for RT730i. `ESC G` is only for `GodexLineMode` models.
- User text: "Send Printer Command" can inject any text at the start of a job. It is empty by default (help `zpl/base/SendPrinterCommand.html`, `prtconfig::print_user` phase 0). This is the only way the driver could send `~S,ESG`, and only if a person typed it.

**Status paths.**

- Status uses the same raw channel as printing. The base asks the module for a query string, writes it with `CommunicationInterface::Write` and reads the reply with `Read` (ZPL-CM `FUN_180003080`, which waits up to 5 s).
- USB read-back goes through the language monitor (`lmReadPortW`, `lmGetPrinterDataFromPortW`, str:Seagull_V3_NetMonDispatcher). Inference: this is bidirectional USB through usbprint.
- TCP status port: `_GetTCPStatusPortNumber_V2` (CB @0x18009eac0) reads the registry value `Settings:TcpIp Status Port`. If that is 0, it calls `PrinterModel::GetTCPStatusPortDefault`. The base `GetTCPStatusPortNumber` returns its default argument unchanged (CB @0x18009d570).
- No Godex model sets `Status.Ports.TCP.StatusPortDefault`. A grep of all `*.d` finds only `Status.Ports=` lines.
- Inference: TCP status uses the print port. The port monitor UI says "Most printers use port 9100" (`ddz/sstcpipmon/sstcpipmon[enu].dll`). `ModelDefaultPorts.txt` has no Godex or BP entry.
- Only GZPL lists TCP/IP in `Status.Ports`. EZPL and GEPL list `Serial,USB` only (`GDX/Features.d:80`, `EPL/Features.d:574`).
- SNMP: none. The only "snmp" strings in the whole driver are OpenSSL OID names in `Seagull_V3_NetMon.dll` (str @0x405f64). There are no `1.3.6.1` OIDs.

## 4. Language lock and switching

What I found:

- **No module sends a Godex language command.** I searched for `~S,ES`, `ESZ`, `ESG`, `ESA`, `^XSET,…LANG…` and `EMUL`. They do not appear in any GDX, ZPL, EPL or base binary (`work/strings/*.txt`) or in the decomps.
- **GoLabel also never sends a Godex language command.** The same strings are absent from `golabel/decomp`. The only hits were base64 noise in `.resx` files.
- **The only language command in the driver is Zebra's** `! U1 setvar "device.languages" "zpl"`. It is gated to genuine Zebra models with `~Language.Initialize` (section 1, item 2). The driver deliberately does not send it to Godex GZPL.
- **The driver has no auto-detection logic.** The queue the user installs fixes the language. Each module assumes its printer already speaks that language.
- **The only documented switch is EZPL `~S,ES[p]`** (`EZPL m.84`): `A` or blank = auto, `G` = EZPL, `E` = GEPL, `Z` = GZPL. The `~S,n` family is listed as "Effect & default: Temporary". The text says: "When a printer switch to certain language, it can auto detect and switch again by rebooting printer."

Answer: **No.** The Godex and Seagull artifacts contain no command that switches a GZPL-locked printer back to EZPL.

- Fact: no artifact sends a GZPL-side command for this. `~S,ESG` is EZPL syntax.
- Inference from today's hardware result: a GZPL-locked printer ignores all EZPL, so it also ignores `~S,ESG`. The manual names a power cycle as the way out.
- Guess, untested: Zebra SGD (`! U1 setvar "device.languages" …`) or Zebra `^XA…^XZ` with a Godex `~S,ESG` inside it. The driver avoids SGD for GZPL. I found no Godex evidence that GZPL accepts either form.

Consequences for a Mac library. These are inferences:

- The language is decided by the first bytes after power-on. Any first job, query or setting counts. For example, a ZPL `~HS` status probe sent first would lock GZPL.
- Use one language for this printer. Never send ZPL to a printer that you want in EZPL.
- An EZPL preamble `~S,ESG\r\n` at the start of each EZPL job does no harm. It fixes EZPL for the rest of the power cycle, and the printer ignores it if it is already locked to GZPL.
- A library cannot recover from a GZPL lock by command. It can only detect the lock and tell the user to power-cycle. Detection options:
  - EZPL `~S,STATUS`, `~V` or `~S,CHECK` gets no reply over TCP.
  - Guess: the 1284 MDL changes with the language (section 3).
