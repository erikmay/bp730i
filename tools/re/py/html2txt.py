import sys, re, html, pathlib
out = pathlib.Path(sys.argv[1])
for p in sys.argv[2:]:
    t = open(p, encoding="utf-8", errors="replace").read()
    t = re.sub(r"(?is)<(script|style).*?</\1>", "", t)
    t = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</tr>|</h\d>", "\n", t)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    rel = pathlib.Path(p).parent.name + "_" + pathlib.Path(p).stem + ".txt"
    (out / rel).write_text("\n".join(" ".join(l.split()) for l in t.splitlines() if l.strip()))
