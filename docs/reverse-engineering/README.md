# Reverse-engineering notes

These files hold the evidence for every command in `src/reference.ts` and for every feature decision.

- `coverage.md` lists every printer feature found in the driver, GoLabel and the documents, with the decision whether the library uses it, and why. Start here.
- `second-pass/` holds the second analysis (2026-10-09): `gdx-driver.md` (EZPL driver), `zpl-epl-base.md` (ZPL, EPL and base modules, INF), `golabel.md` (GoLabel II) and `manual.md` (EZPL manual, RT730i manual, Labelident documents). Where they disagree with the first pass, they are correct. Each has a section with corrections.
- `ezpl-driver.md` covers the EZPL output of the Windows driver (Seagull GDX print and config modules, decompiled with Ghidra).
- `zpl-driver.md` covers the GZPL output of the same driver (Seagull ZPL modules). The library no longer sends ZPL.
- `golabel-and-docs.md` covers GoLabel II (decompiled with ILSpy), the Labelident support PDF, the datasheets, the RT730i manual and the EZPL Programmer's Manual.
- `decisions.tsv` is the decision log of both runs.

`bun tools/re/fetch-and-unpack.ts <dir> --ghidra --ilspy` downloads every source, checks its SHA-256, unpacks it, and decompiles the driver modules and the GoLabel assemblies. The first-pass notes cite paths under `~/re-bp730i/`, the second pass under `~/re-bp730i-deep/`. Both have the same layout below the root (`dl*/`, `drv/`, `golabel/`, `work/decomp/`). The second pass also made `txt/ezpl/pNNN.txt` with `pdftotext -layout` per page of the EZPL manual, and further decompiles under `work/`. Ghidra function addresses are virtual addresses with the default image base `0x180000000`.

None of these notes is confirmed on hardware unless `src/reference.ts` marks the command as verified.
