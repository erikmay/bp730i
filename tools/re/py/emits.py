import sys, re
fn = None
for i, line in enumerate(open(sys.argv[1]), 1):
    m = re.match(r"//// FUNCTION (\S+)", line)
    if m: fn = m.group(1); continue
    for s in re.findall(r'(?:prtstream|OString)::operator<<\([^,]+,"((?:[^"\\]|\\.)*)"\)', line):
        print(f"{fn}\t{i}\t{s}")
    for s in re.findall(r'pcVar\d+ = "((?:[^"\\]|\\.)*)";', line):
        print(f"{fn}\t{i}\t={s}")
