# Reverse-engineering notes

These files hold the evidence for every command in `src/reference.ts`.

- `ezpl-driver.md` covers the EZPL output of the Windows driver (Seagull GDX print and config modules, decompiled with Ghidra).
- `zpl-driver.md` covers the GZPL output of the same driver (Seagull ZPL modules).
- `golabel-and-docs.md` covers GoLabel II (decompiled with ILSpy), the Labelident support PDF, the datasheets, the RT730i manual and the EZPL Programmer's Manual.
- `decisions.tsv` is the decision log of the run that produced this repository.

The notes cite paths under `~/re-bp730i/`, the working directory of the analysis. `bun tools/re/fetch-and-unpack.ts ~/re-bp730i --ghidra` recreates the `dl/`, `drv/`, `golabel/` and `work/decomp/` parts of that layout. Ghidra function addresses are virtual addresses with the default image base `0x180000000`.

None of these notes is confirmed on hardware unless `src/reference.ts` marks the command as verified.
