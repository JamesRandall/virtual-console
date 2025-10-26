import {useState, useCallback, useRef} from "react";
import {Editor, type Monaco, type OnMount} from "@monaco-editor/react";
import type * as MonacoEditor from "monaco-editor";

import {useDevkitStore} from "../stores/devkitStore.ts";
import {updateVirtualConsoleSnapshot} from "../stores/utilities.ts";

import {useVirtualConsole} from "../consoleIntegration/virtualConsole.tsx";
import {assemble, type AssemblerError} from "../../../console/src/assembler.ts";
import {
    registerAssemblerLanguage,
    ASSEMBLER_LANGUAGE_ID,
} from "./assemblerLanguageSpecification.ts";

const DEFAULT_PROGRAM = `
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
    // Zustand store hooks
    const updateMemorySnapshot = useDevkitStore((state) => state.updateMemorySnapshot);
    const updateCpuSnapshot = useDevkitStore((state) => state.updateCpuSnapshot);

    // Virtual console hook
    const virtualConsole = useVirtualConsole();

    // Local state
    const [editorContent, setEditorContent] = useState(DEFAULT_PROGRAM);
    const [assemblyError, setAssemblyError] = useState<string | null>(null);

    // Refs
    const monacoRef = useRef<Monaco | null>(null);
    const editorRef = useRef<MonacoEditor.editor.IStandaloneCodeEditor | null>(null);

    // Validation function
    const validateCode = useCallback((code: string) => {
        if (!monacoRef.current || !editorRef.current) {
            return;
        }

        const monaco = monacoRef.current;
        const editor = editorRef.current;
        const model = editor.getModel();

        if (!model) {
            return;
        }

        try {
            // Assemble the code to get errors
            const result = assemble(code);

            // Convert assembler errors to Monaco markers
            const markers: MonacoEditor.editor.IMarkerData[] = result.errors.map(
                (error: AssemblerError) => ({
                    startLineNumber: error.line,
                    startColumn: error.column || 1,
                    endLineNumber: error.line,
                    endColumn: error.column ? error.column + 1 : Number.MAX_SAFE_INTEGER,
                    message: error.message + (error.suggestion ? `\n💡 ${error.suggestion}` : ""),
                    severity: error.severity === "error"
                        ? monaco.MarkerSeverity.Error
                        : monaco.MarkerSeverity.Warning,
                })
            );

            // Set markers on the model
            monaco.editor.setModelMarkers(model, ASSEMBLER_LANGUAGE_ID, markers);
        } catch (error) {
            console.error("Unexpected assembler error validating code:", error);
            // If assembler throws an exception, clear markers
            monaco.editor.setModelMarkers(model, ASSEMBLER_LANGUAGE_ID, []);
        }
    }, []);

    // Event handlers
    const handleEditorBeforeMount = useCallback((monaco: Monaco) => {
        // Store Monaco instance
        monacoRef.current = monaco;

        // Register the custom assembler language with Monaco before the editor mounts
        registerAssemblerLanguage(monaco);
    }, []);

    const handleEditorMount: OnMount = useCallback((editor) => {
        // Store editor instance
        editorRef.current = editor;

        // Validate initial content
        validateCode(DEFAULT_PROGRAM);
    }, [validateCode]);

    const handleEditorChange = useCallback((value: string | undefined) => {
        const code = value || "";
        setEditorContent(code);

        // Validate code on change
        validateCode(code);
    }, [validateCode]);

    const handleAssemble = useCallback(() => {
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

            // Update snapshots
            updateVirtualConsoleSnapshot(virtualConsole, updateMemorySnapshot, updateCpuSnapshot);

            // Clear error on success
            setAssemblyError(null);
        } catch (error) {
            console.error("Unexpected error assembling code:", error);
            setAssemblyError("assembly error");
        }
    }, [editorContent, virtualConsole, updateMemorySnapshot, updateCpuSnapshot]);

    // Render
    return <div className="flex flex-col h-full w-full bg-zinc-800">
        <div className="flex gap-4 p-2 border-b border-zinc-300 items-center text-zinc-200">
            <button
                onClick={handleAssemble}
                className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
                Assemble
            </button>
            {assemblyError && (
                <span className="text-red-600">{assemblyError}</span>
            )}
        </div>
        <div className="flex-1">
            <Editor
                height="100%"
                defaultLanguage={ASSEMBLER_LANGUAGE_ID}
                defaultValue={DEFAULT_PROGRAM}
                theme="vs-dark"
                beforeMount={handleEditorBeforeMount}
                onMount={handleEditorMount}
                onChange={handleEditorChange}
            />
        </div>
    </div>
}