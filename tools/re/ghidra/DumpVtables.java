import ghidra.app.script.GhidraScript;
import ghidra.program.model.symbol.*;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.*;
import java.io.*;

public class DumpVtables extends GhidraScript {
    @Override
    public void run() throws Exception {
        PrintWriter w = new PrintWriter(new FileWriter(getScriptArgs()[0]));
        for (Symbol s : currentProgram.getSymbolTable().getAllSymbols(true)) {
            if (!s.getName().equals("vftable")) continue;
            String ns = s.getParentNamespace().getName(true);
            w.println("== " + ns + " @ " + s.getAddress());
            Address a = s.getAddress();
            for (int i = 0; i < 80; i++) {
                Address e = a.add(i * 8L);
                if (i > 0 && currentProgram.getSymbolTable().getPrimarySymbol(e) != null
                    && currentProgram.getSymbolTable().getPrimarySymbol(e).getName().equals("vftable")) break;
                long v = currentProgram.getMemory().getLong(e);
                Address t = toAddr(v);
                Function f = getFunctionAt(t);
                if (f == null && !currentProgram.getMemory().contains(t)) break;
                Symbol ts = currentProgram.getSymbolTable().getPrimarySymbol(t);
                if (f == null && (ts == null || !ts.getName().startsWith("FUN_") && !ts.getName().startsWith("LAB_"))) {
                    w.println("  [" + i + "] " + t + " " + (ts == null ? "?" : ts.getName(true)));
                    if (ts != null && !ts.getName().startsWith("LAB_")) break;
                    continue;
                }
                w.println("  [" + i + "] " + t + " " + (f != null ? f.getName(true) : ts.getName(true)));
            }
        }
        w.close();
    }
}
