import {useCallback, useRef, useEffect} from "react";
import {Editor, type Monaco, type OnMount} from "@monaco-editor/react";
import type * as MonacoEditor from "monaco-editor";

import {useDevkitStore} from "../../../stores/devkitStore.ts";
import {updateVirtualConsoleSnapshot} from "../../../stores/utilities.ts";
import {useVirtualConsole} from "../../../consoleIntegration/virtualConsole.tsx";
import {assemble, type AssemblerError} from "../../../../../../console/src/assembler.ts";
import {
    registerAssemblerLanguage,
    ASSEMBLER_LANGUAGE_ID,
} from "./assemblerLanguageSpecification.ts";

interface AssemblyEditorProps {
    content: string;
    filePath: string;
    onChange: (content: string) => void;
}

export function AssemblyEditor({ content, filePath, onChange }: AssemblyEditorProps) {
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
    const setCodeChangedSinceAssembly = useDevkitStore((state) => state.setCodeChangedSinceAssembly);
    const openFiles = useDevkitStore((state) => state.openFiles);

    // Virtual console hook
    const virtualConsole = useVirtualConsole();

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

    // Update editor content when content prop changes
    useEffect(() => {
        if (editorRef.current) {
            const model = editorRef.current.getModel();
            if (model && model.getValue() !== content) {
                model.setValue(content);
            }
        }
    }, [content]);

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

    // Handle assembly
    const handleAssemble = useCallback(() => {
        // Assemble main.asm
        const mainAsmFile = openFiles.find(f => f.path === 'src/main.asm');

        if (!mainAsmFile) {
            console.error("main.asm not found");
            return { success: false, error: "main.asm not found" };
        }

        console.log('📝 Assembling code (length:', mainAsmFile.content.length, 'chars)');

        try {
            // Assemble the code
            const result = assemble(mainAsmFile.content);

            // Check for errors
            if (result.errors.length > 0) {
                console.error("Assembly errors:", result.errors);
                return {
                    success: false,
                    errors: result.errors.map(err => ({
                        line: err.line,
                        column: err.column,
                        message: err.message
                    }))
                };
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

            console.log("Assembly successful");
            return { success: true, programCounter: result.segments[0]?.startAddress ?? 0 };
        } catch (error) {
            console.error("Unexpected error assembling code:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, error: errorMessage };
        }
    }, [openFiles, setSourceMap, setSymbolTable, updateBreakpointAddresses, setCodeChangedSinceAssembly, virtualConsole, updateMemorySnapshot, updateCpuSnapshot]);

    // Set up event listeners for AI tools
    const setupAiToolListeners = useCallback((editor: MonacoEditor.editor.IStandaloneCodeEditor) => {
        // Get editor content
        const handleGetEditorContent = () => {
            const model = editor.getModel();
            if (!model) {
                window.dispatchEvent(new CustomEvent('editor-content-response', {
                    detail: { code: '', error: 'No editor model' }
                }));
                return;
            }

            const position = editor.getPosition();
            const selection = editor.getSelection();

            const response = {
                code: model.getValue(),
                cursorLine: position?.lineNumber,
                cursorColumn: position?.column,
                selection: selection ? {
                    startLine: selection.startLineNumber,
                    startColumn: selection.startColumn,
                    endLine: selection.endLineNumber,
                    endColumn: selection.endColumn,
                } : undefined
            };

            console.log('Sending editor content response:', response.code.substring(0, 50) + '...');
            window.dispatchEvent(new CustomEvent('editor-content-response', { detail: response }));
        };

        // Set editor content
        const handleSetEditorContent = (e: Event) => {
            const customEvent = e as CustomEvent;
            const { code, cursorLine, cursorColumn } = customEvent.detail;
            const model = editor.getModel();
            if (!model) {
                window.dispatchEvent(new CustomEvent('editor-content-updated', {
                    detail: { success: false, error: 'No editor model' }
                }));
                return;
            }

            console.log('🔧 Setting editor content (length:', code?.length ?? 0, 'chars)');
            model.setValue(code);

            if (cursorLine && cursorColumn) {
                editor.setPosition({ lineNumber: cursorLine, column: cursorColumn });
                editor.revealLineInCenter(cursorLine);
            }

            // Send confirmation that editor was updated
            window.dispatchEvent(new CustomEvent('editor-content-updated', {
                detail: { success: true, length: code?.length ?? 0 }
            }));
        };

        // Assemble code
        const handleEditorAssemble = () => {
            const result = handleAssemble();
            console.log('🔧 Assembly result:', result);
            // Dispatch the assembly result immediately
            window.dispatchEvent(new CustomEvent('editor-assemble-response', {
                detail: result
            }));
        };

        window.addEventListener('get-editor-content', handleGetEditorContent);
        window.addEventListener('set-editor-content', handleSetEditorContent);
        window.addEventListener('editor-assemble', handleEditorAssemble);

        // Return cleanup function
        return () => {
            window.removeEventListener('get-editor-content', handleGetEditorContent);
            window.removeEventListener('set-editor-content', handleSetEditorContent);
            window.removeEventListener('editor-assemble', handleEditorAssemble);
        };
    }, [handleAssemble]);

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
        validateCode(content);

        // Set up AI tool event listeners and store cleanup function
        const cleanup = setupAiToolListeners(editor);

        // Return cleanup on editor unmount
        return () => {
            if (cleanup) cleanup();
        };
    }, [validateCode, setupAiToolListeners, toggleBreakpoint, content]);

    const handleEditorChange = useCallback((value: string | undefined) => {
        const code = value || "";

        // Notify parent of content change
        onChange(code);

        // Mark code as changed if we have an existing source map (assembly has occurred) and this is main.asm
        if (sourceMap.length > 0 && filePath === 'src/main.asm') {
            setCodeChangedSinceAssembly(true);
        }

        // Validate code on change
        validateCode(code);
    }, [onChange, sourceMap.length, filePath, setCodeChangedSinceAssembly, validateCode]);

    return (
        <Editor
            height="100%"
            language={ASSEMBLER_LANGUAGE_ID}
            value={content}
            theme="vs-dark"
            beforeMount={handleEditorBeforeMount}
            onMount={handleEditorMount}
            onChange={handleEditorChange}
            options={{
                glyphMargin: true,
            }}
        />
    );
}
