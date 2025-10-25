import {Editor} from "@monaco-editor/react";
import {useState} from "react";
import {useVirtualConsole} from "../consoleIntegration/virtualConsole.tsx";
import {assemble} from "../../../console/src/assembler.ts";
import {useDevkitStore} from "../stores/devkitStore.ts";

const defaultProgram = `
  .org $20
  LD R0, #$AA      ; Load pattern
  LD R1, #0        ; Counter
  LD R2, #0        ; Address high byte
  LD R3, #0        ; Address low byte
loop:
  ST R0, [R2:R3]   ; Store pattern
  INC R3           ; Next address
  INC R1           ; Increment counter
  CMP R1, #16      ; Check if done
  BRNZ loop        ; Loop if not done
  NOP
`;

export function EditorContainer() {
    const [editorContent, setEditorContent] = useState(defaultProgram);
    const [assemblyError, setAssemblyError] = useState<string | null>(null);
    const virtualConsole = useVirtualConsole();
    const updateMemorySnapshot = useDevkitStore((state) => state.updateMemorySnapshot);
    const updateCpuSnapshot = useDevkitStore((state) => state.updateCpuSnapshot);

    const handleAssemble = () => {
        if (!editorContent) {
            setAssemblyError("No code to assemble");
            return;
        }

        try {
            // Assemble the code
            const result = assemble(editorContent);

            // Check for errors
            if (result.errors.length > 0) {
                setAssemblyError("assembly error");
                return;
            }

            // Load the assembled code into memory
            for (const segment of result.segments) {
                for (let i = 0; i < segment.data.length; i++) {
                    virtualConsole.memory.write8(segment.startAddress + i, segment.data[i]);
                }
            }

            // Set program counter to the start of the first segment
            if (result.segments.length > 0) {
                virtualConsole.cpu.setProgramCounter(result.segments[0].startAddress);
            }

            // Create a snapshot of the current memory
            const memorySnapshot = new Uint8Array(65536);
            for (let i = 0; i < 65536; i++) {
                memorySnapshot[i] = virtualConsole.memory.read8(i);
            }
            updateMemorySnapshot(memorySnapshot);

            // Create a snapshot of the CPU state
            const registers = new Uint8Array(6);
            for (let i = 0; i < 6; i++) {
                registers[i] = virtualConsole.cpu.getRegister(i);
            }
            updateCpuSnapshot({
                registers,
                stackPointer: virtualConsole.cpu.getStackPointer(),
                programCounter: virtualConsole.cpu.getProgramCounter(),
                statusRegister: virtualConsole.cpu.getStatus(),
                cycleCount: virtualConsole.cpu.getCycles(),
            });

            // Clear error on success
            setAssemblyError(null);
        } catch (error) {
            setAssemblyError("assembly error");
        }
    };

    return <div className="flex flex-col h-full w-full bg-zinc-800">
        <div className="flex gap-4 p-2 border-b border-gray-300 items-center text-zinc-200">
            <button
                onClick={handleAssemble}
                className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
                Assemble
            </button>
            {assemblyError && (
                <span className="text-red-500">{assemblyError}</span>
            )}
        </div>
        <div className="flex-1">
            <Editor
                height="100%"
                defaultLanguage="typescript"
                defaultValue={defaultProgram}
                theme="vs-dark"
                onChange={(value) => setEditorContent(value || "")}
            />
        </div>
    </div>
}