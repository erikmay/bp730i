import re, sys, os
root = sys.argv[1]
lit = re.compile(r'"((?:\^|~|\\u001b|\\x1b)[A-Za-z@#$%&*!?][^"]{0,80})"')
meth = re.compile(r'^\s*(?:public|private|internal|protected|static|override|virtual|async|\s)+[\w<>\[\],. ]+\s+(\w+)\s*\([^;]*$')
cls = re.compile(r'^\s*(?:public |internal |private |static |sealed |partial |abstract )*(?:class|struct)\s+(\w+)')
for dp, _, fs in os.walk(root):
    for f in sorted(fs):
        if not f.endswith('.cs'): continue
        p = os.path.join(dp, f); c = m = '?'
        for i, line in enumerate(open(p, encoding='utf-8', errors='replace'), 1):
            mc = cls.match(line); c = mc.group(1) if mc else c
            mm = meth.match(line); m = mm.group(1) if mm else m
            for x in lit.finditer(line):
                print(f"{os.path.relpath(p, root)}:{i}\t{c}.{m}\t{x.group(1)}")
