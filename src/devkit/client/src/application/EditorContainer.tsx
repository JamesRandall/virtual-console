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
import {faImage, faSave} from "@fortawesome/free-solid-svg-icons";
import {ImageGenerator} from "../components/ImageGenerator";
import {TabStrip, type Tab} from "../components/TabStrip.tsx";
import {writeFile} from "../services/fileSystemService.ts";

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

    // Project state
    const currentProjectHandle = useDevkitStore((state) => state.currentProjectHandle);
    const openFiles = useDevkitStore((state) => state.openFiles);
    const activeFilePath = useDevkitStore((state) => state.activeFilePath);
    const setActiveFile = useDevkitStore((state) => state.setActiveFile);
    const closeFile = useDevkitStore((state) => state.closeFile);
    const updateFileContent = useDevkitStore((state) => state.updateFileContent);
    const markFileDirty = useDevkitStore((state) => state.markFileDirty);

    // Virtual console hook
    const virtualConsole = useVirtualConsole();

    // Local state
    const [isImageGeneratorOpen, setIsImageGeneratorOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Refs
    const monacoRef = useRef<Monaco | null>(null);
    const editorRef = useRef<MonacoEditor.editor.IStandaloneCodeEditor | null>(null);
    const decorationsCollectionRef = useRef<MonacoEditor.editor.IEditorDecorationsCollection | null>(null);

    // Get the active file
    const activeFile = openFiles.find(f => f.path === activeFilePath);

    // Check if active file is .asm
    const isAsmFile = activeFilePath?.endsWith('.asm') ?? false;

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
        if (!editorRef.current || !monacoRef.current || !decorationsCollectionRef.current || !isAsmFile) {
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
    }, [isConsoleRunning, cpuSnapshot.programCounter, findLineForPC, breakpointLines, isAsmFile]);

    // Update decorations when CPU state changes
    useEffect(() => {
        updateDecorations();
    }, [updateDecorations]);

    // Update editor content when active file changes
    useEffect(() => {
        if (editorRef.current && activeFile) {
            const model = editorRef.current.getModel();
            if (model && model.getValue() !== activeFile.content) {
                model.setValue(activeFile.content);
            }
        }
    }, [activeFilePath, activeFile]);

    // Validation function
    const validateCode = useCallback((code: string) => {
        if (!monacoRef.current || !editorRef.current || !isAsmFile) {
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
    }, [isAsmFile]);

    // Event handlers
    const handleEditorBeforeMount = useCallback((monaco: Monaco) => {
        // Store Monaco instance
        monacoRef.current = monaco;

        // Register the custom assembler language with Monaco before the editor mounts
        registerAssemblerLanguage(monaco);
    }, []);

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

    const handleSaveFile = useCallback(async () => {
        if (!activeFile || !currentProjectHandle || !activeFilePath) {
            return;
        }

        setIsSaving(true);

        try {
            await writeFile(currentProjectHandle, activeFilePath, activeFile.content);
            markFileDirty(activeFilePath, false);
        } catch (error) {
            console.error('Error saving file:', error);
            alert('Failed to save file: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsSaving(false);
        }
    }, [activeFile, currentProjectHandle, activeFilePath, markFileDirty]);

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

    const handleEditorMount: OnMount = useCallback((editor) => {
        // Store editor instance
        editorRef.current = editor;

        // Create decorations collection
        decorationsCollectionRef.current = editor.createDecorationsCollection();

        // Add mouse down handler for breakpoint toggling (only for .asm files)
        editor.onMouseDown((e) => {
            if (!monacoRef.current || !isAsmFile) return;

            // Check if click is in the glyph margin
            if (e.target.type === monacoRef.current.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
                const line = e.target.position?.lineNumber;
                if (line) {
                    toggleBreakpoint(line);
                }
            }
        });

        // Validate initial content if it's an .asm file
        if (activeFile && isAsmFile) {
            validateCode(activeFile.content);
        }

        // Set up AI tool event listeners and store cleanup function
        const cleanup = setupAiToolListeners(editor);

        // Return cleanup on editor unmount
        return () => {
            if (cleanup) cleanup();
        };
    }, [validateCode, setupAiToolListeners, toggleBreakpoint, isAsmFile, activeFile]);

    const handleEditorChange = useCallback((value: string | undefined) => {
        const code = value || "";

        if (!activeFilePath) {
            return;
        }

        // Update the file content in the store
        updateFileContent(activeFilePath, code);

        // Mark as dirty if content changed
        const currentFile = openFiles.find(f => f.path === activeFilePath);
        if (currentFile && currentFile.content !== code) {
            markFileDirty(activeFilePath, true);
        }

        // Mark code as changed if we have an existing source map (assembly has occurred) and this is main.asm
        if (sourceMap.length > 0 && activeFilePath === 'src/main.asm') {
            setCodeChangedSinceAssembly(true);
        }

        // Validate code on change for .asm files
        if (isAsmFile) {
            validateCode(code);
        }
    }, [activeFilePath, updateFileContent, openFiles, markFileDirty, sourceMap.length, setCodeChangedSinceAssembly, validateCode, isAsmFile]);

    const handleGenerateFromImage = useCallback((assemblyCode: string) => {
        // Set the generated code in the editor
        if (editorRef.current && activeFilePath) {
            const model = editorRef.current.getModel();
            if (model) {
                model.setValue(assemblyCode);
                updateFileContent(activeFilePath, assemblyCode);
                markFileDirty(activeFilePath, true);
                // Validate the generated code
                if (isAsmFile) {
                    validateCode(assemblyCode);
                }
            }
        }
    }, [activeFilePath, updateFileContent, markFileDirty, validateCode, isAsmFile]);

    const handleTabChange = useCallback((tabId: string) => {
        setActiveFile(tabId);
    }, [setActiveFile]);

    const handleTabClose = useCallback((tabId: string) => {
        const file = openFiles.find(f => f.path === tabId);
        if (file?.isDirty) {
            const shouldClose = confirm(`${file.path} has unsaved changes. Close anyway?`);
            if (!shouldClose) {
                return;
            }
        }
        closeFile(tabId);
    }, [openFiles, closeFile]);

    // Determine if we should show the warning banner
    const showWarningBanner = codeChangedSinceAssembly && breakpointLines.size > 0 && sourceMap.length > 0;

    // Convert open files to tabs
    const tabs: Tab[] = openFiles.map(file => ({
        id: file.path,
        label: file.path.split('/').pop() || file.path,
        isDirty: file.isDirty,
    }));

    // Render
    if (!currentProjectHandle) {
        return (
            <div className="flex flex-col h-full w-full bg-zinc-800 items-center justify-center text-zinc-400">
                <p>No project loaded. Open or create a project to start editing.</p>
            </div>
        );
    }

    if (openFiles.length === 0) {
        return (
            <div className="flex flex-col h-full w-full bg-zinc-800 items-center justify-center text-zinc-400">
                <p>No files open. Double-click a file in the project explorer to open it.</p>
            </div>
        );
    }

    return <div className="flex flex-col h-full w-full bg-zinc-800">
        <ImageGenerator
            isOpen={isImageGeneratorOpen}
            onClose={() => setIsImageGeneratorOpen(false)}
            onGenerate={handleGenerateFromImage}
        />

        {/* Tabs */}
        {tabs.length > 0 && (
            <TabStrip
                tabs={tabs}
                activeTabId={activeFilePath || ''}
                onTabChange={handleTabChange}
                onTabClose={handleTabClose}
            />
        )}

        {/* Editor */}
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

            {isAsmFile ? (
                <Editor
                    height="100%"
                    language={ASSEMBLER_LANGUAGE_ID}
                    value={activeFile?.content || ''}
                    theme="vs-dark"
                    beforeMount={handleEditorBeforeMount}
                    onMount={handleEditorMount}
                    onChange={handleEditorChange}
                    options={{
                        glyphMargin: true,
                    }}
                />
            ) : (
                <div className="flex flex-col h-full items-center justify-center text-zinc-400">
                    <p>This file type is not editable yet.</p>
                    <p className="text-sm mt-2">Only .asm files can be edited in the Monaco editor.</p>
                </div>
            )}
        </div>

        {/* Toolbar */}
        <div className="flex justify-end dk-gap-compact px-3 py-1.5 dk-border-t items-center dk-text-primary flex-shrink-0">
            <button
                onClick={handleSaveFile}
                disabled={!activeFile?.isDirty || isSaving}
                className="dk-btn-icon dk-btn-disabled border border-transparent"
                title="Save file"
            >
                <FontAwesomeIcon icon={faSave} />
            </button>
            {isAsmFile && (
                <button
                    onClick={() => setIsImageGeneratorOpen(true)}
                    className="dk-btn-icon border border-transparent"
                    title="Convert image to assembly"
                >
                    <FontAwesomeIcon icon={faImage} />
                </button>
            )}
        </div>
    </div>
}
