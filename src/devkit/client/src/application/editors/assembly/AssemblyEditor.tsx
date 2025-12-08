import {useCallback, useRef, useEffect, useMemo} from "react";
import {Editor, type Monaco, type OnMount} from "@monaco-editor/react";
import type * as MonacoEditor from "monaco-editor";
import {useShallow} from "zustand/react/shallow";

import {useDevkitStore} from "../../../stores/devkitStore.ts";
import {updateVirtualConsoleSnapshot} from "../../../stores/utilities.ts";
import {useVirtualConsole} from "../../../consoleIntegration/virtualConsole.tsx";
import {assembleMultiFile, type AssemblerError} from "../../../../../../console/src/assembler.ts";
import {readAllSourceFiles} from "../../../services/fileSystemService.ts";
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
    const toggleBreakpoint = useDevkitStore((state) => state.toggleBreakpoint);

    // Get breakpoints for this specific file - use useShallow for proper array comparison
    const breakpointLinesArray = useDevkitStore(
        useShallow((state) => {
            const fileBreakpoints = state.breakpointsByFile.get(filePath);
            return fileBreakpoints ? Array.from(fileBreakpoints).sort((a, b) => a - b) : [];
        })
    );
    // Memoize the Set to avoid recreating on every render
    const breakpointLines = useMemo(() => new Set(breakpointLinesArray), [breakpointLinesArray]);
    const updateBreakpointAddresses = useDevkitStore((state) => state.updateBreakpointAddresses);
    const setCodeChangedSinceAssembly = useDevkitStore((state) => state.setCodeChangedSinceAssembly);
    const openFiles = useDevkitStore((state) => state.openFiles);
    const currentProjectHandle = useDevkitStore((state) => state.currentProjectHandle);
    const navigateToLine = useDevkitStore((state) => state.navigateToLine);
    const setNavigateToLine = useDevkitStore((state) => state.setNavigateToLine);

    // Virtual console hook
    const virtualConsole = useVirtualConsole();

    // Refs
    const monacoRef = useRef<Monaco | null>(null);
    const editorRef = useRef<MonacoEditor.editor.IStandaloneCodeEditor | null>(null);
    const decorationsCollectionRef = useRef<MonacoEditor.editor.IEditorDecorationsCollection | null>(null);
    const filePathRef = useRef(filePath);

    // Keep filePathRef up to date
    useEffect(() => {
        filePathRef.current = filePath;
    }, [filePath]);

    // Find the line number for a given program counter address (only for this file)
    const findLineForPC = useCallback((pc: number): number | null => {
        if (sourceMap.length === 0) {
            return null;
        }

        // Find the source map entry for the current PC that matches this file
        // Source map is sorted by address, so we find the last entry with address <= PC
        let line: number | null = null;
        for (const entry of sourceMap) {
            if (entry.address <= pc && entry.file === filePath) {
                line = entry.line;
            } else if (entry.address > pc) {
                break;
            }
        }
        return line;
    }, [sourceMap, filePath]);

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

    // Handle navigation to a specific line
    useEffect(() => {
        if (!navigateToLine) return;
        if (navigateToLine.file !== filePath) return;
        if (!editorRef.current) return;

        const editor = editorRef.current;
        const line = navigateToLine.line;

        // Set cursor position and reveal the line in center
        editor.setPosition({ lineNumber: line, column: 1 });
        editor.revealLineInCenter(line);
        editor.focus();

        // Clear the navigation request
        setNavigateToLine(null);
    }, [navigateToLine, filePath, setNavigateToLine]);

    // Validation function - uses multi-file assembly to properly resolve includes
    const validateCode = useCallback(async (code: string) => {
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
            // Build source files map from disk and open files
            let sourceFiles = new Map<string, string>();

            // Read files from disk if we have a project handle
            if (currentProjectHandle) {
                sourceFiles = await readAllSourceFiles(currentProjectHandle);
            }

            // Merge with currently open files (they may have unsaved changes)
            for (const openFile of openFiles) {
                if (openFile.path.endsWith('.asm')) {
                    sourceFiles.set(openFile.path, openFile.content);
                }
            }

            // Update the current file's content with what's being validated
            sourceFiles.set(filePath, code);

            // Assemble all files starting from main.asm
            const result = assembleMultiFile({
                sourceFiles,
                entryPoint: 'src/main.asm',
            });

            // Filter errors to only show those for the current file
            const fileErrors = result.errors.filter(e => e.file === filePath);

            // Convert assembler errors to Monaco markers
            const markers: MonacoEditor.editor.IMarkerData[] = fileErrors.map(
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
    }, [currentProjectHandle, openFiles, filePath]);

    // Handle assembly - uses multi-file assembly
    const handleAssemble = useCallback(async () => {
        // Build source files map from open files
        const sourceFiles = new Map<string, string>();

        // Read files from disk if we have a project handle
        if (currentProjectHandle) {
            const diskFiles = await readAllSourceFiles(currentProjectHandle);
            for (const [path, content] of diskFiles) {
                sourceFiles.set(path, content);
            }
        }

        // Merge with currently open files (they may have unsaved changes)
        for (const openFile of openFiles) {
            if (openFile.path.endsWith('.asm')) {
                sourceFiles.set(openFile.path, openFile.content);
            }
        }

        if (!sourceFiles.has('src/main.asm')) {
            console.error("main.asm not found");
            return { success: false, error: "main.asm not found" };
        }

        console.log('📝 Assembling code with', sourceFiles.size, 'source files');

        try {
            // Assemble all files starting from main.asm
            const result = assembleMultiFile({
                sourceFiles,
                entryPoint: 'src/main.asm',
            });

            // Check for errors
            if (result.errors.length > 0) {
                console.error("Assembly errors:", result.errors);
                return {
                    success: false,
                    errors: result.errors.map(err => ({
                        line: err.line,
                        column: err.column,
                        file: err.file,
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
    }, [currentProjectHandle, openFiles, setSourceMap, setSymbolTable, updateBreakpointAddresses, setCodeChangedSinceAssembly, virtualConsole, updateMemorySnapshot, updateCpuSnapshot]);

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
        // Use filePathRef to always get the current filePath, since this handler
        // is registered once and won't be updated when filePath changes
        editor.onMouseDown((e) => {
            if (!monacoRef.current) return;

            // Check if click is in the glyph margin
            if (e.target.type === monacoRef.current.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
                const line = e.target.position?.lineNumber;
                if (line) {
                    toggleBreakpoint(filePathRef.current, line);
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

        // Mark code as changed if we have an existing source map (assembly has occurred)
        // This applies to any .asm file since changes to includes also affect the build
        if (sourceMap.length > 0) {
            setCodeChangedSinceAssembly(true);
        }

        // Validate code on change
        validateCode(code);
    }, [onChange, sourceMap.length, setCodeChangedSinceAssembly, validateCode]);

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
