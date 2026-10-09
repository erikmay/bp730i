import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.listing.*;
import java.io.*;
import java.util.regex.*;

public class DumpMatching extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] a = getScriptArgs();
        Pattern p = Pattern.compile(a[1]);
        DecompInterface d = new DecompInterface();
        d.openProgram(currentProgram);
        try (PrintWriter w = new PrintWriter(new FileWriter(a[0]))) {
            for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
                String n = f.getName(true);
                if (!p.matcher(n).find()) continue;
                DecompileResults r = d.decompileFunction(f, 120, monitor);
                w.println("//// FUNCTION " + n + " @ " + f.getEntryPoint());
                if (r != null && r.decompileCompleted()) w.println(r.getDecompiledFunction().getC());
            }
        }
    }
}
