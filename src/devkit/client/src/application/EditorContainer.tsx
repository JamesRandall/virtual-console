import {useState, useCallback, useRef, useEffect} from "react";
import {Editor, type Monaco, type OnMount} from "@monaco-editor/react";
import type * as MonacoEditor from "monaco-editor";

import {useDevkitStore} from "../stores/devkitStore.ts";
import {updateVirtualConsoleSnapshot} from "../stores/utilities.ts";
import "./EditorContainer.css";

import {useVirtualConsole} from "../consoleIntegration/virtualConsole.tsx";
import {assemble, type AssemblerError} from "../../../../console/src/assembler.ts";
import {
    registerAssemblerLanguage,
    ASSEMBLER_LANGUAGE_ID,
} from "./assemblerLanguageSpecification.ts";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHammer} from "@fortawesome/free-solid-svg-icons";

const DEFAULT_PROGRAM = `
  .org $B80
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
infiniteloop:
  JMP infiniteloop
`;

export function EditorContainer() {
    // Zustand store hooks
    const updateMemorySnapshot = useDevkitStore((state) => state.updateMemorySnapshot);
    const updateCpuSnapshot = useDevkitStore((state) => state.updateCpuSnapshot);
    const setSourceMap = useDevkitStore((state) => state.setSourceMap);
    const setSymbolTable = useDevkitStore((state) => state.setSymbolTable);
    const sourceMap = useDevkitStore((state) => state.sourceMap);
    const cpuSnapshot = useDevkitStore((state) => state.cpuSnapshot);
    const isConsoleRunning = useDevkitStore((state) => state.isConsoleRunning);
    const breakpointLines = useDevkitStore((state) => state.breakpointLines);
    const toggleBreakpoint = useDevkitStore((state) => state.toggleBreakpoint);
    const updateBreakpointAddresses = useDevkitStore((state) => state.updateBreakpointAddresses);
    const codeChangedSinceAssembly = useDevkitStore((state) => state.codeChangedSinceAssembly);
    const setCodeChangedSinceAssembly = useDevkitStore((state) => state.setCodeChangedSinceAssembly);

    // Virtual console hook
    const virtualConsole = useVirtualConsole();

    // Local state
    const [editorContent, setEditorContent] = useState(DEFAULT_PROGRAM);
    const [assemblyError, setAssemblyError] = useState<string | null>(null);

    // Refs
    const monacoRef = useRef<Monaco | null>(null);
    const editorRef = useRef<MonacoEditor.editor.IStandaloneCodeEditor | null>(null);
    const decorationsCollectionRef = useRef<MonacoEditor.editor.IEditorDecorationsCollection | null>(null);

    // Find the line number for a given program counter address
    const findLineForPC = useCallback((pc: number): number | null => {
        if (sourceMap.length === 0) {
            return null;
        }

        // Find the source map entry for the current PC
        // Source map is sorted by address, so we find the last entry with address <= PC
        let line: number | null = null;
        for (const entry of sourceMap) {
            if (entry.address <= pc) {
                line = entry.line;
            } else {
                break;
            }
        }
        return line;
    }, [sourceMap]);

    // Update gutter decorations based on current PC and breakpoints
    const updateDecorations = useCallback(() => {
        if (!editorRef.current || !monacoRef.current || !decorationsCollectionRef.current) {
            return;
        }

        const monaco = monacoRef.current;
        const decorationsCollection = decorationsCollectionRef.current;
        const newDecorations: MonacoEditor.editor.IModelDeltaDecoration[] = [];

        // Add breakpoint decorations
        breakpointLines.forEach((line) => {
            newDecorations.push({
                range: new monaco.Range(line, 1, line, 1),
                options: {
                    isWholeLine: false,
                    glyphMarginClassName: 'breakpoint-glyph',
                    glyphMarginHoverMessage: { value: 'Breakpoint' },
                }
            });
        });

        // Add PC decoration if not running
        if (!isConsoleRunning) {
            const currentLine = findLineForPC(cpuSnapshot.programCounter);

            if (currentLine !== null) {
                // Check if there's a breakpoint on the current line
                const hasBreakpoint = breakpointLines.has(currentLine);

                newDecorations.push({
                    range: new monaco.Range(currentLine, 1, currentLine, 1),
                    options: {
                        isWholeLine: false,
                        glyphMarginClassName: hasBreakpoint ? 'breakpoint-with-pc-glyph' : 'current-line-glyph',
                        glyphMarginHoverMessage: { value: `PC: 0x${cpuSnapshot.programCounter.toString(16).toUpperCase().padStart(4, '0')}` },
                    }
                });
            }
        }

        decorationsCollection.set(newDecorations);
    }, [isConsoleRunning, cpuSnapshot.programCounter, findLineForPC, breakpointLines]);

    // Update decorations when CPU state changes
    useEffect(() => {
        updateDecorations();
    }, [updateDecorations]);

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

        // Create decorations collection
        decorationsCollectionRef.current = editor.createDecorationsCollection();

        // Add mouse down handler for breakpoint toggling
        editor.onMouseDown((e) => {
            if (!monacoRef.current) return;

            // Check if click is in the glyph margin
            if (e.target.type === monacoRef.current.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
                const line = e.target.position?.lineNumber;
                if (line) {
                    toggleBreakpoint(line);
                }
            }
        });

        // Validate initial content
        validateCode(DEFAULT_PROGRAM);
    }, [validateCode, toggleBreakpoint]);

    const handleEditorChange = useCallback((value: string | undefined) => {
        const code = value || "";
        setEditorContent(code);

        // Mark code as changed if we have an existing source map (assembly has occurred)
        if (sourceMap.length > 0) {
            setCodeChangedSinceAssembly(true);
        }

        // Validate code on change
        validateCode(code);
    }, [validateCode, sourceMap.length, setCodeChangedSinceAssembly]);

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
                virtualConsole.setProgramCounter(result.segments[0].startAddress);
            }

            // Store source map and symbol table
            setSourceMap(result.sourceMap);
            setSymbolTable(result.symbolTable);

            // Update breakpoint addresses based on new source map
            updateBreakpointAddresses(result.sourceMap);

            // Clear the code changed flag since we just assembled
            setCodeChangedSinceAssembly(false);

            // Update snapshots
            updateVirtualConsoleSnapshot(virtualConsole, updateMemorySnapshot, updateCpuSnapshot).catch((error) => {
                console.error("Error updating snapshots:", error);
            });

            // Clear error on success
            setAssemblyError(null);
        } catch (error) {
            console.error("Unexpected error assembling code:", error);
            setAssemblyError("assembly error");
        }
    }, [editorContent, setSourceMap, setSymbolTable, updateBreakpointAddresses, setCodeChangedSinceAssembly, virtualConsole, updateMemorySnapshot, updateCpuSnapshot]);

    // Determine if we should show the warning banner
    const showWarningBanner = codeChangedSinceAssembly && breakpointLines.size > 0 && sourceMap.length > 0;

    // Render
    return <div className="flex flex-col h-full w-full bg-zinc-800">
        <div className="flex-1 min-h-0 overflow-hidden relative">
            {/* Warning banner for out-of-sync breakpoints */}
            {showWarningBanner && (
                <div className="absolute top-0 left-0 right-0 z-10 bg-amber-600 text-white px-4 py-2 text-sm flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Code changed since last assembly</span>
                        <span>- Breakpoint addresses may be out of sync. Reassemble to update.</span>
                    </div>
                </div>
            )}
            <Editor
                height="100%"
                defaultLanguage={ASSEMBLER_LANGUAGE_ID}
                defaultValue={DEFAULT_PROGRAM}
                theme="vs-dark"
                beforeMount={handleEditorBeforeMount}
                onMount={handleEditorMount}
                onChange={handleEditorChange}
                options={{
                    glyphMargin: true,
                }}
            />
        </div>
        <div className="flex justify-end gap-4 p-4 border-t border-zinc-300 items-center text-zinc-200 flex-shrink-0">
            <button
                onClick={handleAssemble}
                className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white rounded"
            >
                <FontAwesomeIcon icon={faHammer} />
            </button>
            {assemblyError && (
                <span className="text-red-600">{assemblyError}</span>
            )}
        </div>
    </div>
}