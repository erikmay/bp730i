import type { Language } from "./lang/types.ts";

export interface CommandRef {
  readonly language: Language;
  readonly token: string;
  readonly syntax: string;
  readonly use: string;
  readonly source: string;
  readonly hardware: "verified" | "unverified";
}

const ez = (token: string, syntax: string, use: string, source: string): CommandRef => ({
  language: "ezpl",
  token,
  syntax,
  use,
  source,
  hardware: "unverified",
});

const zp = (token: string, syntax: string, use: string, source: string, verified = false): CommandRef => ({
  language: "zpl",
  token,
  syntax,
  use,
  source,
  hardware: verified ? "verified" : "unverified",
});

export const COMMANDS: readonly CommandRef[] = [
  ez("^AD", "^AD / ^AT", "--method dt / tt", "GDX-PM FUN_18000c280; GL Setup.cs:396; EZPL m.19"),
  ez("^AT", "^AT", "--method tt", "GDX-PM FUN_18000c280; GL Setup.cs:396"),
  ez(
    "^O",
    "^On, n=0 none, 1 peel, 2 applicator",
    "--mode (peel = 1, else 0)",
    "GDX-PM FUN_18000b1b0; GL Setup.cs:412; EZPL m.26",
  ),
  ez(
    "^D",
    "^Dn, n=0 off, n=cut every n labels",
    "--mode cut --cut-every n",
    "GDX-PM FUN_18000b1b0; GL Setup.cs:419; EZPL m.22",
  ),
  ez("^Db", "^Db", "--mode batch-cut (one cut at job end)", "GL Setup.cs:415 (not in Windows driver or manual)"),
  ez("^S", "^Sn, n=2..5 ips", "--speed", "GDX-PM FUN_18000b1b0, FUN_180009620; .d Model.d:5420; EZPL m.30"),
  ez("^H", "^Hn, n=0..19", "--darkness", "GDX-PM FUN_18000c2f0 case 5; GL PrinterModel.xml BP730i; EZPL m.24"),
  ez(
    "^G",
    "^Gn, n=0 reflective, 1 see-through, 2 auto",
    "--sensor",
    "GDX-CM FUN_180003bb0; GL PrinterSetup.cs:6124; EZPL m.24 (manual contradicts itself on 0/1)",
  ),
  ez(
    "^R",
    "^Rn, n=0..399 dots",
    "--home-x (left margin)",
    "GL Setup.cs:403; EZPL m.30 (not emitted by Windows driver)",
  ),
  ez("^C", "^C1", "always 1 (copies via ^P)", "GDX-PM FUN_18000b1b0 type 4"),
  ez("^P", "^Pn, n=1..9999", "--copies (per format)", "GDX-PM FUN_18000bab0; .d Method.d Copies.Limit"),
  ez(
    "^Q",
    "^Qlen,gap | ^Qlen,mark,offset+/- | ^Qlen,0,feed (mm, 1 decimal)",
    "--size L, --gap / --mark / --continuous",
    "GDX-PM FUN_18000bd50; GL Setup.cs:370; EZPL m.28",
  ),
  ez("^W", "^Wn (whole mm)", "--size W", "GDX-PM FUN_18000b570 type 10; GL Setup.cs:383; EZPL m.31"),
  ez("~Q", "~Q+n / ~Q-n, dots -100..100", "--home-y", "GDX-PM FUN_18000c780; GL Setup.cs:406; EZPL m.79"),
  ez("^E", "^En (mm, 1 decimal)", "--stop", "GDX-PM FUN_18000c2f0 case 3; GL Setup.cs:422; EZPL m.23"),
  ez(
    "^L",
    "^L[M][I]",
    "begin label; --mirror, --inverse",
    "GDX-PM FUN_18000bc50; .d Features.d [Godex_PlusSeries]; EZPL m.25",
  ),
  ez(
    "Q",
    "Qx,y,bytesPerRow,rows<CR> + raw rows, 1 = black, MSB left",
    "every image",
    "GDX-PM FUN_180006900; GL PrintJob.cs:2169 (LF instead of CR); EZPL m.114",
  ),
  ez("E", "E", "end label, print", "GDX-PM FUN_18000bb80; GL QLabel.cs:4409"),
  ez("~S,SENSOR", "~S,SENSOR", "calibrate", "GDX-CM FUN_180002810; GL SvgArtiste.cs:5513; EZPL m.82"),
  ez("~S,FEED", "~S,FEED", "feed", "EZPL m.84 only"),
  ez("~S,CANCEL", "~S,CANCEL", "cancel", "GL SvgArtiste.cs:10275; EZPL m.84"),
  ez(
    "~Z",
    "~Z",
    "reset (restart)",
    "GL SvgArtiste.cs:5388 'reset printer'; EZPL m.87. Windows driver names its ~Z job 'Print Configuration' (GDX-CM FUN_180002810)",
  ),
  ez("^Z", "^Z", "reset --factory", "EZPL m.69 only"),
  ez("~V", "~V", "self-test (prints configuration label)", "GDX-CM FUN_180002810; GL SvgArtiste.cs:5404; EZPL m.85"),
  ez("~S,ES", "~S,ESG / ~S,ESZ / ~S,ESA", "language ezpl / zpl / auto", "EZPL m.84 only"),
  ez("^XSET,IMMEDIATE", "^XSET,IMMEDIATE,1", "sent before status", "GDX-CM FUN_180001430; EZPL m.44"),
  ez("~S,STATUS", "~S,STATUS -> aa,nnnnn", "status (TCP)", "GDX-CM FUN_1800010a0 / FUN_1800010c0; EZPL m.84"),
  ez("^XGET,CONFIG", "^XGET,CONFIG", "config (TCP)", "GL SvgArtiste.cs:8457; EZPL m.31"),
  ez("~B", "~B", "version (TCP)", "GL TestInterface.cs:178; EZPL m.70"),

  zp("^XA", "^XA ... ^XZ", "every format", "ZPL-PM FUN_1800026a0; user PoC", true),
  zp("^XZ", "^XZ", "every format", "ZPL-PM FUN_1800026a0; user PoC", true),
  zp("^PW", "^PWdots", "--size W", "ZPL-PM FUN_180016a20; user PoC", true),
  zp("^LL", "^LLdots", "--size L (driver sends it only for continuous media)", "ZPL-PM FUN_180016a20; user PoC", true),
  zp("^LH", "^LHx,0", "--home-x", "ZPL-PM FUN_1800026a0 (driver always ^LH0,0); user PoC sent ^LH0,0", true),
  zp("^FO", "^FO0,0", "every image", "ZPL-PM FUN_180012d50; user PoC", true),
  zp(
    "^GFA",
    "^GFA,total,total,bytesPerRow,HEX",
    "every image (no cut interval)",
    "user PoC; driver uses ~DG+Z64 (ZPL-PM FUN_180009210)",
    true,
  ),
  zp("^FS", "^FS", "field end", "ZPL-PM; user PoC", true),
  zp("^PQ", "^PQq,0,1,Y", "--copies", "ZPL-PM FUN_1800131f0; user PoC sent ^PQ1", true),
  zp("^PM", "^PMY / ^PMN", "--mirror", "ZPL-PM FUN_180016a20"),
  zp("^MT", "^MTD / ^MTT", "--method", "ZPL-PM FUN_180016a20"),
  zp(
    "^MN",
    "^MNW gap / ^MNM mark / ^MNN continuous",
    "--gap / --mark / --continuous (gap and mark sizes are not sent)",
    "ZPL-PM FUN_180016a20; CM FUN_180006820",
  ),
  zp("^LT", "^LTdots, -120..120", "--home-y", "ZPL-PM FUN_180016a20, FUN_1800151d0"),
  zp("^MM", "^MMT tear / ^MMP peel / ^MMC cut", "--mode", "ZPL-PM FUN_180016a20; CM FUN_180006d80"),
  zp(
    "~SD",
    "~SDnn^MD0, nn=00..30",
    "--darkness (Godex 0..19 scaled to 0..30, guess)",
    "ZPL-PM FUN_180016a20 (driver passes 0..30 unchanged)",
  ),
  zp("^MD", "^MD0", "clears relative darkness after ~SD", "ZPL-PM FUN_180016a20 str 0x1ebb0"),
  zp("^PR", "^PRn, n=2..5", "--speed", "ZPL-PM FUN_180016a20 (driver sends ^PRp,s,b)"),
  zp("^JUS", "^JUS", "settings --save", "ZPL-CM FUN_18000eb80 action 0x40a"),
  zp("^LR", "^LRY ... ^LRN with full ^GB", "--inverse", "ZPL-PM FUN_180013730"),
  zp("^GB", "^GBw,h,t", "--inverse box", "ZPL-PM FUN_180013730"),
  zp(
    "~DG",
    "~DGR:name,total,bytesPerRow,HEX",
    "image store for --mode cut --cut-every n>1 / batch-cut",
    "ZPL-PM FUN_180009210 (driver uses Z64 data, here hex)",
  ),
  zp("^XG", "^XGR:name,1,1", "recall stored image", "ZPL-PM FUN_180009210"),
  zp("^ID", "^IDR:BP*.GRF", "delete stored images at job end", "ZPL-PM FUN_180001a80"),
  zp("~JC", "~JC", "calibrate", "ZPL-CM FUN_18000eb80 action 9"),
  zp("~PH", "~PH", "feed", "ZPL-CM FUN_18000eb80 action 4"),
  zp("~JA", "~JA", "cancel", "ZPL-CM FUN_18000eb80 action 0x1b"),
  zp("~JR", "~JR", "reset", "ZPL-CM FUN_18000eb80 action 7"),
  zp("^JUF", "^XA^JUF^XZ", "reset --factory", "ZPL-CM FUN_18000eb80 action 8"),
  zp("~WC", "~WC", "self-test (configuration label)", "ZPL-CM FUN_18000eb80 action 10"),
  zp("~HS", "~HS", "status (TCP)", "ZPL-CM FUN_180030110"),
  zp("^HH", "^XA^HH^XZ", "config (TCP)", "Zebra ZPL only; driver suppresses it for Godex (no ~Command.HH)"),
  zp("~HI", "~HI", "version (TCP)", "ZPL-CM FUN_180030110"),
];
