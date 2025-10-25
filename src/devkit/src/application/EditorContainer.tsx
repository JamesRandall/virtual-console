import {Editor} from "@monaco-editor/react";
import {useState} from "react";
import {useVirtualConsole} from "../consoleIntegration/virtualConsole.tsx";
import {assemble} from "../../../console/src/assembler.ts";
import {useDevkitStore} from "../stores/devkitStore.ts";

export function EditorContainer() {
    const [editorContent, setEditorContent] = useState("// some comment");
    const [assemblyError, setAssemblyError] = useState<string | null>(null);
    const virtualConsole = useVirtualConsole();
    const updateMemorySnapshot = useDevkitStore((state) => state.updateMemorySnapshot);
    const viewSize = useDevkitStore((state) => state.viewSize);
    const firstRowAddress = useDevkitStore((state) => state.firstRowAddress);

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

            // Create a snapshot of the current memory view
            const snapshot = new Uint8Array(65536);
            for (let i = 0; i < 65536; i++) {
                snapshot[i] = virtualConsole.memory.read8(i);
            }
            updateMemorySnapshot(snapshot);

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
                defaultValue="// some comment"
                theme="vs-dark"
                onChange={(value) => setEditorContent(value || "")}
            />
        </div>
    </div>
}