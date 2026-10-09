import sys, re
src = open(sys.argv[1]).read()
parts = re.split(r"(?m)^//// FUNCTION ", src)
want = set(sys.argv[2:])
for p in parts:
    name = p.split(" ", 1)[0]
    addr = p.split("@ ", 1)[-1].split("\n", 1)[0].strip() if "@ " in p else ""
    if name in want or addr in want or name.replace("FUN_", "") in want:
        print("//// " + p)
