export interface CommandRef {
  readonly token: string;
  readonly syntax: string;
  readonly use: string;
  readonly source: string;
  readonly hardware: "verified" | "unverified";
}

const cmd = (token: string, syntax: string, use: string, source: string, verified = false): CommandRef => ({
  token,
  syntax,
  use,
  source,
  hardware: verified ? "verified" : "unverified",
});

const VERIFIED = true;

export const COMMANDS: readonly CommandRef[] = [
  cmd("^AD", "^AD", "--method dt", "GDX-PM FUN_18000c280; GL Setup.cs:396; EZPL m.19"),
  cmd("^AT", "^AT", "--method tt", "GDX-PM FUN_18000c280; GL Setup.cs:396"),
  cmd(
    "^O",
    "^On, n=0 none, 1 peel, 2 applicator",
    "--mode (peel = 1, else 0)",
    "GDX-PM FUN_18000b1b0; GL Setup.cs:412; EZPL m.26",
  ),
  cmd(
    "^D",
    "^Dn, n=0 off, n=cut every n labels",
    "--mode cut --cut-every n",
    "GDX-PM FUN_18000b1b0; GL Setup.cs:419; EZPL m.22",
  ),
  cmd("^Db", "^Db", "--mode batch-cut (one cut at job end)", "GL Setup.cs:415 (not in Windows driver or manual)"),
  cmd("^S", "^Sn, n=2..5 ips", "--speed", "GDX-PM FUN_18000b1b0, FUN_180009620; .d Model.d:5420; EZPL m.30", VERIFIED),
  cmd(
    "^H",
    "^Hn, n=0..19",
    "--darkness",
    "GDX-PM FUN_18000c2f0 case 5; GL PrinterModel.xml BP730i; EZPL m.24",
    VERIFIED,
  ),
  cmd(
    "^G",
    "^Gn, n=0 reflective, 1 see-through, 2 auto",
    "--sensor",
    "GDX-CM FUN_180003bb0; GL PrinterSetup.cs:6124; EZPL m.24 (manual contradicts itself on 0/1)",
  ),
  cmd(
    "^R",
    "^Rn, n=0..399 dots",
    "--home-x (left margin)",
    "GL Setup.cs:403; EZPL m.30 (not emitted by Windows driver)",
    VERIFIED,
  ),
  cmd("^C", "^C1", "always 1 (copies via ^P)", "GDX-PM FUN_18000b1b0 type 4", VERIFIED),
  cmd("^P", "^Pn, n=1..9999", "--copies (per page)", "GDX-PM FUN_18000bab0; .d Method.d Copies.Limit", VERIFIED),
  cmd(
    "^Q",
    "^Qlen,gap (mm, 1 decimal), e.g. ^Q150.0,2.0",
    "--size L, --gap",
    "GDX-PM FUN_18000bd50; GL Setup.cs:370; EZPL m.28",
    VERIFIED,
  ),
  cmd(
    "^Q",
    "^Qlen,mark,offset+/- | ^Qlen,0,feed (mm, 1 decimal)",
    "--mark / --continuous",
    "GDX-PM FUN_18000bd50; GL Setup.cs:370; EZPL m.28",
  ),
  cmd("^W", "^Wn (whole mm)", "--size W", "GDX-PM FUN_18000b570 type 10; GL Setup.cs:383; EZPL m.31", VERIFIED),
  cmd("~Q", "~Q+n / ~Q-n, dots -100..100", "--home-y", "GDX-PM FUN_18000c780; GL Setup.cs:406; EZPL m.79", VERIFIED),
  cmd("^E", "^En (mm, 1 decimal)", "--stop", "GDX-PM FUN_18000c2f0 case 3; GL Setup.cs:422; EZPL m.23"),
  cmd("^L", "^L", "begin label", "GDX-PM FUN_18000bc50; EZPL m.25", VERIFIED),
  cmd(
    "^L",
    "^L[M][I]",
    "--mirror, --inverse",
    "GDX-PM FUN_18000bc50; .d Features.d [Godex_PlusSeries]; EZPL m.25",
    VERIFIED,
  ),
  cmd(
    "Q",
    "Qx,y,bytesPerRow,rows<CR> + raw rows, 1 = black, MSB left",
    "every image",
    "GDX-PM FUN_180006900; GL PrintJob.cs:2169 (LF instead of CR); EZPL m.114",
    VERIFIED,
  ),
  cmd("E", "E", "end label, print", "GDX-PM FUN_18000bb80; GL QLabel.cs:4409", VERIFIED),
  cmd("~S,SENSOR", "~S,SENSOR", "calibrate", "GDX-CM FUN_180002810; GL SvgArtiste.cs:5513; EZPL m.82", VERIFIED),
  cmd("~S,FEED", "~S,FEED", "feed", "EZPL m.84 only", VERIFIED),
  cmd("~Z", "~Z", "reset (printer restarts)", "GL SvgArtiste.cs:5388 'reset printer'; EZPL m.87", VERIFIED),
  cmd("~S,CANCEL", "~S,CANCEL", "cancel", "GL SvgArtiste.cs:10275; EZPL m.84"),
  cmd(
    "~V",
    "~V",
    "self-test (prints the configuration label)",
    "GDX-CM FUN_180002810; GL SvgArtiste.cs:5404; EZPL m.85",
    VERIFIED,
  ),
  cmd("^XSET,IMMEDIATE", "^XSET,IMMEDIATE,1", "sent before status", "GDX-CM FUN_180001430; EZPL m.44"),
  cmd("~S,STATUS", "~S,STATUS -> aa,nnnnn", "status (TCP)", "GDX-CM FUN_1800010a0 / FUN_1800010c0; EZPL m.84"),
  cmd("^XGET,CONFIG", "^XGET,CONFIG", "config (TCP)", "GL SvgArtiste.cs:8457; EZPL m.31"),
  cmd("~B", "~B", "version (TCP)", "GL TestInterface.cs:178; EZPL m.70"),
];
